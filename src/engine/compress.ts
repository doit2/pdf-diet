// PDF 압축 순수 로직 (Worker 안에서 동기 실행). MuPDF.js 1.28에는 이미지 재압축 API
// (pdf_rewrite_images)가 없어서, 이미지 XObject 스트림을 직접 축소 JPEG로 교체한다.
import * as mupdf from 'mupdf'
import {
  EngineError,
  LEVELS,
  type CompressOptions,
  type CompressResult,
  type Progress,
  type QualityLevel,
} from './types'

/** 이미지가 페이지에 실제로 그려지는 최대 크기 (pt, 1pt = 1/72인치) */
export interface DisplaySize {
  w: number
  h: number
}

/** 이 크기보다 작은 이미지는 손대지 않는다 (아이콘·장식선 등, 이득이 없음) */
const MIN_PIXELS = 64 * 64
/** 축소 비율이 이보다 크면(거의 그대로면) 해상도는 유지한다 */
const RESIZE_THRESHOLD = 0.95
/** 새 스트림이 원래보다 이 비율 이상 작아질 때만 교체한다 */
const MIN_GAIN = 0.95

type Doc = mupdf.PDFDocument
type Ref = mupdf.PDFObject

function openPdf(data: Uint8Array): Doc {
  let doc: mupdf.Document
  try {
    doc = mupdf.Document.openDocument(data, 'application/pdf')
  } catch (e) {
    throw new EngineError('invalid-pdf', e instanceof Error ? e.message : String(e))
  }
  const pdf = doc.asPDF()
  if (!pdf) {
    doc.destroy()
    throw new EngineError('invalid-pdf')
  }
  if (pdf.needsPassword()) {
    pdf.destroy()
    throw new EngineError('encrypted')
  }
  return pdf
}

function nameOf(obj: Ref): string | null {
  return obj.isName() ? obj.asName() : null
}

/** 이미지 XObject인 스트림 객체 번호 목록 */
function listImageObjects(doc: Doc): number[] {
  const out: number[] = []
  const n = doc.countObjects()
  for (let i = 1; i < n; i++) {
    try {
      const ref = doc.newIndirect(i)
      if (ref.isStream() && nameOf(ref.get('Subtype')) === 'Image') out.push(i)
    } catch {
      // 깨진 객체는 건너뛴다
    }
  }
  return out
}

/**
 * 모든 페이지를 그려 보며(래스터화 없이) 이미지별 최대 표시 크기를 잰다.
 * 장치가 받는 Image는 loadImage(ref)와 같은 객체이므로 포인터로 객체 번호를 찾는다.
 * 한 번도 그려지지 않는 이미지(쓰이지 않는 이미지 등)는 결과에 없다 → 손대지 않음.
 */
export function analyze(doc: Doc, onProgress?: (done: number, total: number) => void): Map<number, DisplaySize> {
  const nums = listImageObjects(doc)
  const byPointer = new Map<number, number>()
  const held: mupdf.Image[] = []
  for (const num of nums) {
    try {
      const img = doc.loadImage(doc.newIndirect(num))
      held.push(img) // 들고 있어야 같은 포인터가 유지된다
      byPointer.set(img.pointer as unknown as number, num)
    } catch {
      // 읽을 수 없는 이미지는 건너뛴다
    }
  }

  const sizes = new Map<number, DisplaySize>()
  const record = (image: mupdf.Image, ctm: mupdf.Matrix) => {
    const num = byPointer.get(image.pointer as unknown as number)
    // 콜백마다 생기는 래퍼는 바로 해제한다 (GC에 맡기면 WASM 메모리가 쌓인다)
    image.destroy()
    if (num === undefined) return
    const w = Math.hypot(ctm[0], ctm[1])
    const h = Math.hypot(ctm[2], ctm[3])
    const prev = sizes.get(num)
    sizes.set(num, { w: Math.max(w, prev?.w ?? 0), h: Math.max(h, prev?.h ?? 0) })
  }
  const device = new mupdf.Device({
    fillImage: (image, ctm) => record(image, ctm),
    fillImageMask: (image, ctm) => record(image, ctm),
    clipImageMask: (image, ctm) => record(image, ctm),
  })

  const pages = doc.countPages()
  for (let p = 0; p < pages; p++) {
    try {
      const page = doc.loadPage(p)
      page.run(device, mupdf.Matrix.identity)
      page.destroy()
    } catch {
      // 그리기에 실패한 페이지의 이미지는 손대지 않는다
    }
    onProgress?.(p + 1, pages)
  }
  device.close()
  device.destroy()
  for (const img of held) img.destroy()

  // 부드러운 마스크(SMask)는 직접 그려지지 않으므로 본 이미지의 크기를 물려받는다
  for (const [num, size] of [...sizes]) {
    try {
      const smask = doc.newIndirect(num).get('SMask')
      if (smask.isIndirect()) {
        const m = smask.asIndirect()
        const prev = sizes.get(m)
        sizes.set(m, { w: Math.max(size.w, prev?.w ?? 0), h: Math.max(size.h, prev?.h ?? 0) })
      }
    } catch {
      // 무시
    }
  }
  return sizes
}

/** 표시 크기와 DPI 상한으로 목표 픽셀 크기를 정한다 */
export function targetPixels(w: number, h: number, size: DisplaySize, dpi: number): { w: number; h: number } {
  // 가로·세로 중 더 많이 필요한 쪽에 맞춰 같은 비율로 줄인다(비율 유지, 화질 우선)
  const need = Math.max((dpi * size.w) / 72 / w, (dpi * size.h) / 72 / h)
  const scale = Math.min(1, need)
  if (scale > RESIZE_THRESHOLD) return { w, h }
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

function rawLength(ref: Ref): number {
  const len = ref.get('Length')
  if (len.isNumber()) return len.asNumber()
  return ref.readRawStream().getLength()
}

/** 이미지 하나를 다시 쓴다. 바꿨으면 true */
function rewriteImage(doc: Doc, num: number, size: DisplaySize, level: QualityLevel): boolean {
  const ref = doc.newIndirect(num)

  // 흑백(1비트)·마스크·색상키 마스크 이미지는 JPEG로 바꾸면 손해이거나 깨진다
  if (ref.get('ImageMask').valueOf() === true) return false
  const bpc = ref.get('BitsPerComponent')
  if (bpc.isNumber() && bpc.asNumber() === 1) return false
  if (ref.get('Mask').isArray()) return false
  const filter = ref.get('Filter')
  const filters = filter.isArray()
    ? Array.from({ length: filter.length }, (_, i) => nameOf(filter.get(i)))
    : [nameOf(filter)]
  if (filters.includes('JBIG2Decode') || filters.includes('CCITTFaxDecode')) return false

  const img = doc.loadImage(ref)
  try {
    const w = img.getWidth()
    const h = img.getHeight()
    if (w * h < MIN_PIXELS || img.getImageMask()) return false
    const srcCs = img.getColorSpace()

    let pix = img.toPixmap()
    const n = pix.getNumberOfComponents() - pix.getAlpha()
    const pixCs = pix.getColorSpace()
    // JPEG는 회색(1)·RGB(3)·CMYK(4)만 된다. 그 밖(Lab, DeviceN 등)은 RGB로 바꾼다.
    let outName: 'DeviceGray' | 'DeviceRGB' | 'DeviceCMYK' | null = null
    const okSpace = pixCs && (pixCs.isGray() || pixCs.isRGB() || pixCs.isCMYK()) && [1, 3, 4].includes(n)
    if (!okSpace || pix.getAlpha()) {
      const target = okSpace && pixCs ? pixCs : mupdf.ColorSpace.DeviceRGB
      const converted = pix.convertToColorSpace(target, false)
      pix.destroy()
      pix = converted
    }
    const finalCs = pix.getColorSpace()!
    // 원래 색공간을 그대로 쓸 수 있으면(ICC 프로필 포함) 유지, 아니면 Device 색공간으로
    const keepSourceCs =
      srcCs !== null &&
      !srcCs.isIndexed() &&
      srcCs.getNumberOfComponents() === finalCs.getNumberOfComponents() &&
      (srcCs.isGray() || srcCs.isRGB() || srcCs.isCMYK())
    if (!keepSourceCs) {
      outName = finalCs.isGray() ? 'DeviceGray' : finalCs.isCMYK() ? 'DeviceCMYK' : 'DeviceRGB'
    }

    const t = targetPixels(w, h, size, level.dpi)
    if (t.w !== w || t.h !== h) {
      const small = pix.warp([[0, 0], [w, 0], [w, h], [0, h]], t.w, t.h)
      pix.destroy()
      pix = small
    }
    const jpeg = pix.asJPEG(level.quality, false).slice()
    pix.destroy()

    if (jpeg.length >= rawLength(ref) * MIN_GAIN) return false

    ref.writeRawStream(jpeg)
    ref.put('Filter', doc.newName('DCTDecode'))
    ref.delete('DecodeParms')
    ref.delete('Decode') // toPixmap()이 이미 Decode를 적용했다
    ref.put('Width', t.w)
    ref.put('Height', t.h)
    ref.put('BitsPerComponent', 8)
    if (outName) ref.put('ColorSpace', doc.newName(outName))
    return true
  } finally {
    img.destroy()
  }
}

function removeMetadata(doc: Doc): void {
  const trailer = doc.getTrailer()
  trailer.delete('Info')
  const root = trailer.get('Root')
  if (root.isDictionary()) root.delete('Metadata')
}

function removeThumbnails(doc: Doc): void {
  const pages = doc.countPages()
  for (let p = 0; p < pages; p++) {
    const page = doc.findPage(p)
    if (page.isDictionary()) page.delete('Thumb')
  }
}

/** 옵션 → MuPDF 저장 옵션 문자열 */
export function saveOptions(opts: CompressOptions): string {
  const parts: string[] = []
  // garbage=deduplicate(3)는 스트림 중복을 못 잡는다. 4여야 같은 이미지·글꼴 스트림까지 합친다.
  if (opts.dedupe) parts.push('garbage=4')
  else if (opts.removeUnused) parts.push('garbage=compact')
  if (opts.removeUnused) parts.push('clean')
  if (opts.compressStructure) parts.push('compress', 'compress-fonts', 'compress-images')
  return parts.join(',')
}

export interface LevelOutput {
  data: Uint8Array
  imagesRewritten: number
  imagesTotal: number
}

/** 원본을 새로 열어 한 단계로 압축한 결과를 만든다 */
export function compressAtLevel(
  input: Uint8Array,
  levelIndex: number,
  opts: CompressOptions,
  sizes: Map<number, DisplaySize>,
  onImage?: (done: number, total: number) => void,
  onSave?: () => void,
): LevelOutput {
  const doc = openPdf(input)
  try {
    const level = LEVELS[levelIndex]
    let rewritten = 0
    if (level) {
      let done = 0
      for (const [num, size] of sizes) {
        try {
          if (rewriteImage(doc, num, size, level)) rewritten++
        } catch {
          // 이 이미지는 원본 유지
        }
        onImage?.(++done, sizes.size)
      }
    }
    if (opts.removeMetadata) removeMetadata(doc)
    if (opts.removeThumbnails) removeThumbnails(doc)
    onSave?.()
    const buf = doc.saveToBuffer(saveOptions(opts))
    const data = buf.asUint8Array().slice() // WASM 메모리를 가리키므로 복사해 둔다
    buf.destroy()
    return { data, imagesRewritten: rewritten, imagesTotal: sizes.size }
  } finally {
    doc.destroy()
  }
}

/**
 * 목표 감소율(%)을 만족하는 "가장 약한" 품질 단계를 이진 탐색으로 고른다.
 * - 단계 0(구조만 정리)부터 6까지. 단계가 클수록 결과가 작다고 가정한다.
 * - 어느 단계로도 목표에 못 미치면 가장 작은 결과를 돌려준다(targetMet=false).
 * - 결과가 원본 이상이면 원본을 그대로 돌려준다(usedOriginal=true).
 */
export function compressToTarget(
  input: Uint8Array,
  targetPercent: number,
  opts: CompressOptions,
  onProgress?: (p: Progress) => void,
): CompressResult {
  const originalSize = input.length
  const goal = originalSize * (1 - Math.min(Math.max(targetPercent, 0), 99) / 100)

  onProgress?.({ phase: 'open', level: 0, attempt: 0, done: 0, total: 1 })
  const first = openPdf(input)
  let sizes: Map<number, DisplaySize>
  try {
    sizes = analyze(first, (done, total) => onProgress?.({ phase: 'analyze', level: 0, attempt: 0, done, total }))
  } finally {
    first.destroy()
  }

  const cache = new Map<number, LevelOutput>()
  let attempt = 0
  const run = (lv: number): LevelOutput => {
    const hit = cache.get(lv)
    if (hit) return hit
    attempt++
    const out = compressAtLevel(
      input,
      lv,
      opts,
      sizes,
      (done, total) => onProgress?.({ phase: 'images', level: lv, attempt, done, total }),
      () => onProgress?.({ phase: 'save', level: lv, attempt, done: 0, total: 1 }),
    )
    cache.set(lv, out)
    return out
  }

  let lo = 0
  let hi = LEVELS.length - 1
  let found: number | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (run(mid).data.length <= goal) {
      found = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }

  let level: number
  if (found !== null) {
    level = found
  } else {
    run(LEVELS.length - 1)
    level = [...cache.entries()].reduce((a, b) => (b[1].data.length < a[1].data.length ? b : a))[0]
  }
  const best = cache.get(level)!

  if (best.data.length >= originalSize) {
    return {
      data: input.slice(),
      originalSize,
      size: originalSize,
      level: null,
      targetMet: originalSize <= goal,
      usedOriginal: true,
      imagesRewritten: 0,
      imagesTotal: best.imagesTotal,
    }
  }
  return {
    data: best.data,
    originalSize,
    size: best.data.length,
    level,
    targetMet: best.data.length <= goal,
    usedOriginal: false,
    imagesRewritten: best.imagesRewritten,
    imagesTotal: best.imagesTotal,
  }
}
