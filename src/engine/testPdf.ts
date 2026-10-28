// 테스트·측정용 PDF 생성기 (앱 번들에는 들어가지 않음). Node와 브라우저 모두에서 동작.
import * as mupdf from 'mupdf'

export type ImageKind = 'photo' | 'bilevel' | 'cmyk' | 'smask' | 'gray' | 'none'

export interface TestPdfSpec {
  pages?: number
  /** 이미지 픽셀 밀도 (페이지에 그려지는 크기 기준) */
  dpi?: number
  /** 이미지가 그려지는 크기 (인치) */
  widthIn?: number
  heightIn?: number
  kind?: ImageKind
  text?: string
  /** 본문 글자 줄 수 (글자 보존 확인용, 줄마다 다른 내용) */
  lines?: number
  /** 선으로 그린 표(벡터) + 칸마다 글자 */
  table?: boolean
  /** 모든 페이지에 같은 그림을 별도 객체로 넣는다 (로고 반복) */
  sameImage?: boolean
  metadata?: boolean
  thumbnail?: boolean
  /** 같은 이미지를 두 번 넣어(별도 객체) 중복 제거 효과를 본다 */
  duplicate?: boolean
  encryptPassword?: string
}

/** 결정적 의사난수 (테스트마다 같은 결과) */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** 사진처럼 부드러운 변화 + 약한 잡음 */
function makePixmap(kind: ImageKind, w: number, h: number, seed: number): mupdf.Pixmap {
  const cs =
    kind === 'cmyk' ? mupdf.ColorSpace.DeviceCMYK : kind === 'gray' || kind === 'bilevel' ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB
  const pix = new mupdf.Pixmap(cs, [0, 0, w, h], false)
  const n = pix.getNumberOfComponents()
  const px = pix.getPixels()
  const rnd = rng(seed)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const base = [
        128 + 100 * Math.sin(u * 7 + v * 3 + seed),
        128 + 100 * Math.sin(v * 9 - u * 2),
        128 + 100 * Math.cos((u + v) * 5),
        60 + 50 * Math.sin(u * 4),
      ]
      const i = (y * w + x) * n
      for (let c = 0; c < n; c++) {
        let val = base[c] + (rnd() - 0.5) * 24
        if (kind === 'bilevel') val = (x >> 4) % 2 === (y >> 4) % 2 ? 0 : 255
        px[i + c] = Math.max(0, Math.min(255, val))
      }
    }
  }
  return pix
}

/** 1비트 흑백 이미지 스트림을 직접 만든다 (Image(pixmap)은 8비트가 되므로) */
function addBilevelImage(doc: mupdf.PDFDocument, w: number, h: number): mupdf.PDFObject {
  const stride = Math.ceil(w / 8)
  const data = new Uint8Array(stride * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if ((x >> 4) % 2 === (y >> 4) % 2) data[y * stride + (x >> 3)] |= 0x80 >> (x & 7)
  return doc.addStream(data, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: w,
    Height: h,
    ColorSpace: 'DeviceGray',
    BitsPerComponent: 1,
  })
}

const WORDS = 'alpha beta gamma delta epsilon zeta theta kappa lambda sigma omega quarterly revenue invoice total'.split(' ')

/** 페이지·줄마다 다른 본문 한 줄 (괄호·역슬래시 없음) */
function bodyLine(page: number, line: number): string {
  const r = rng(page * 1000 + line + 1)
  const words = Array.from({ length: 9 }, () => WORDS[Math.floor(r() * WORDS.length)])
  return `${page + 1}.${line + 1} ${words.join(' ')} ${Math.floor(r() * 100000)}`
}

/** 4행 3열 표: 선(벡터) + 칸 글자. 이미지 영역(y 300~) 아래쪽에 그린다 */
function tableContent(page: number): string {
  const x0 = 36, y0 = 60, cw = 120, rh = 18, rows = 4, cols = 3
  let s = '0.5 w '
  for (let r = 0; r <= rows; r++) s += `${x0} ${y0 + r * rh} m ${x0 + cols * cw} ${y0 + r * rh} l S `
  for (let c = 0; c <= cols; c++) s += `${x0 + c * cw} ${y0} m ${x0 + c * cw} ${y0 + rows * rh} l S `
  s += '\n'
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      s += `BT /F1 9 Tf ${x0 + c * cw + 4} ${y0 + (rows - 1 - r) * rh + 5} Td (R${r + 1}C${c + 1} p${page + 1} ${(r + 1) * (c + 7) * 13}) Tj ET\n`
  return s
}

export function makeTestPdf(spec: TestPdfSpec = {}): Uint8Array {
  const { pages = 1, dpi = 300, widthIn = 4, heightIn = 3, kind = 'photo', text = 'PDF diet test page' } = spec
  const w = Math.round(widthIn * dpi)
  const h = Math.round(heightIn * dpi)
  const doc = new mupdf.PDFDocument()
  const font = doc.addSimpleFont(new mupdf.Font('Helvetica'))

  let first: mupdf.PDFObject | null = null
  for (let p = 0; p < pages; p++) {
    const xobjects: Record<string, mupdf.PDFObject> = {}
    const pw = widthIn * 72
    const ph = heightIn * 72
    let content = ''
    let img: mupdf.PDFObject | null = null
    if (kind === 'none') {
      // 이미지 없음
    } else if (spec.sameImage && first) {
      // addImage는 같은 이미지를 합치므로 원시 스트림을 복사해 별도 객체로 만든다
      const dict = doc.newDictionary()
      first.resolve().forEach((v, k) => dict.put(k, v))
      img = doc.addRawStream(first.readRawStream(), dict)
    } else if (kind === 'bilevel') {
      img = addBilevelImage(doc, w, h)
    } else {
      const pix = makePixmap(kind, w, h, spec.sameImage ? 1 : p + 1)
      if (kind === 'smask') {
        const mask = makePixmap('gray', w, h, 99)
        img = doc.addImage(new mupdf.Image(pix, new mupdf.Image(mask)))
      } else {
        img = doc.addImage(new mupdf.Image(pix))
      }
    }
    if (img) {
      first ??= img
      xobjects.Im0 = img
      content += `q ${pw} 0 0 ${ph} 36 300 cm /Im0 Do Q\n`
    }
    if (img && spec.duplicate && kind !== 'bilevel') {
      // addImage는 같은 이미지를 알아서 합치므로, 원시 스트림을 복사해 별도 객체를 만든다
      const dict = doc.newDictionary()
      img.resolve().forEach((v, k) => dict.put(k, v))
      xobjects.Im1 = doc.addRawStream(img.readRawStream(), dict)
      content += `q ${pw / 2} 0 0 ${ph / 2} 36 60 cm /Im1 Do Q\n`
    }
    content += `BT /F1 14 Tf 36 800 Td (${text} ${p + 1}) Tj ET\n`
    for (let i = 0; i < (spec.lines ?? 0); i++) {
      const y = 780 - i * 12
      if (y < 40) break
      content += `BT /F1 9 Tf 36 ${y} Td (${bodyLine(p, i)}) Tj ET\n`
    }
    if (spec.table) content += tableContent(p)
    const page = doc.addPage([0, 0, 612, 842], 0, { XObject: xobjects, Font: { F1: font } }, content)
    if (spec.thumbnail) {
      const thumb = doc.addImage(new mupdf.Image(makePixmap('photo', 106, 146, 7)))
      page.put('Thumb', thumb)
    }
    doc.insertPage(-1, page)
  }

  if (spec.metadata) {
    doc.setMetaData('info:Title', '테스트 문서')
    doc.setMetaData('info:Author', 'pdf-diet')
    const xmp = doc.addStream('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>', { Type: 'Metadata', Subtype: 'XML' })
    doc.getTrailer().get('Root').put('Metadata', xmp)
  }

  const opts = spec.encryptPassword
    ? `compress,encrypt=aes-256,user-password=${spec.encryptPassword},owner-password=${spec.encryptPassword}`
    : 'compress'
  const buf = doc.saveToBuffer(opts)
  const out = buf.asUint8Array().slice()
  buf.destroy()
  doc.destroy()
  return out
}

/** 페이지를 낮은 해상도로 그려 두 PDF의 평균 픽셀 차(0~255)를 잰다 */
export function renderDiff(a: Uint8Array, b: Uint8Array, page = 0, scale = 0.5): number {
  const draw = (data: Uint8Array) => {
    const doc = mupdf.Document.openDocument(data, 'application/pdf')
    const pix = doc.loadPage(page).toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true)
    const px = pix.getPixels().slice()
    pix.destroy()
    doc.destroy()
    return px
  }
  const pa = draw(a)
  const pb = draw(b)
  if (pa.length !== pb.length) return 255
  let sum = 0
  for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i] - pb[i])
  return sum / pa.length
}

export function pageText(data: Uint8Array, page = 0): string {
  const doc = mupdf.Document.openDocument(data, 'application/pdf')
  const text = doc.loadPage(page).toStructuredText('').asText()
  doc.destroy()
  return text
}
