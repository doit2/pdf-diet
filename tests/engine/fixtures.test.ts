// 기획서 7.1 묶음으로 엔진을 확인한다 (T-04, T-06, T-07 + 묶음별 확인할 점).
import { describe, expect, it } from 'vitest'
import * as mupdf from 'mupdf'
import { analyze, compressAtLevel, compressToTarget } from '../../src/engine/compress'
import { DEFAULT_OPTIONS, LEVELS, type CompressOptions } from '../../src/engine/types'
import { renderDiff } from '../../src/engine/testPdf'
import { FIXTURES } from '../fixtures/fixtures'

const ALL_OFF: CompressOptions = {
  removeUnused: false,
  dedupe: false,
  compressStructure: false,
  removeMetadata: false,
  removeThumbnails: false,
}

const open = (data: Uint8Array) => mupdf.Document.openDocument(data, 'application/pdf').asPDF()!

function sizesOf(data: Uint8Array) {
  const doc = open(data)
  const s = analyze(doc)
  doc.destroy()
  return s
}

function inspect(data: Uint8Array) {
  const doc = open(data)
  const pages = doc.countPages()
  const texts: string[] = []
  for (let i = 0; i < pages; i++) texts.push(doc.loadPage(i).toStructuredText('').asText())
  let images = 0
  let objects = 0
  const bits: number[] = []
  for (let i = 1; i < doc.countObjects(); i++) {
    const ref = doc.newIndirect(i)
    try {
      if (ref.resolve().isNull()) continue
      objects++
      if (ref.isStream() && ref.get('Subtype').asName() === 'Image') {
        images++
        bits.push(ref.get('BitsPerComponent').asNumber())
      }
    } catch {
      /* skip */
    }
  }
  const info = {
    pages,
    texts,
    images,
    objects,
    bits,
    title: doc.getMetaData('info:Title') ?? '',
    xmp: !doc.getTrailer().get('Root').get('Metadata').isNull(),
    thumbs: Array.from({ length: pages }, (_, i) => !doc.findPage(i).get('Thumb').isNull()).filter(Boolean).length,
  }
  doc.destroy()
  return info
}

/** 어느 페이지에서도 쓰지 않는 객체를 하나 넣는다 (미사용 리소스 제거 확인용) */
function withOrphan(data: Uint8Array): Uint8Array {
  const doc = open(data)
  doc.addStream('orphan stream that nobody uses', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 1, 1] })
  const buf = doc.saveToBuffer('')
  const out = buf.asUint8Array().slice()
  buf.destroy()
  doc.destroy()
  return out
}

const F = Object.fromEntries(Object.entries(FIXTURES).map(([k, make]) => [k, make()])) as Record<keyof typeof FIXTURES, Uint8Array>

describe('T-04 옵션 하나씩 적용', () => {
  const src = F['with-thumbs-meta']
  const sizes = sizesOf(src)
  const before = inspect(src)
  const only = (key: keyof CompressOptions) => inspect(compressAtLevel(src, 0, { ...ALL_OFF, [key]: true }, sizes).data)

  it('준비: 썸네일·메타데이터가 들어 있다', () => {
    expect(before.thumbs).toBe(3)
    expect(before.title).toBe('테스트 문서')
    expect(before.xmp).toBe(true)
  })

  it('모두 끄면 아무것도 사라지지 않는다', () => {
    const r = inspect(compressAtLevel(src, 0, ALL_OFF, sizes).data)
    expect(r).toMatchObject({ pages: 3, thumbs: 3, title: '테스트 문서', xmp: true, images: before.images })
  })

  it('썸네일 제거만: 썸네일만 사라진다', () => {
    const r = only('removeThumbnails')
    expect(r).toMatchObject({ pages: 3, thumbs: 0, title: '테스트 문서', xmp: true })
  })

  it('메타데이터 제거만: 제목·XMP만 사라진다', () => {
    const r = only('removeMetadata')
    expect(r).toMatchObject({ pages: 3, thumbs: 3, title: '', xmp: false })
  })

  it('미사용 리소스 제거만: 쓰지 않는 객체가 사라진다', () => {
    const orphaned = withOrphan(src)
    const s = sizesOf(orphaned)
    const off = inspect(compressAtLevel(orphaned, 0, ALL_OFF, s).data)
    const on = inspect(compressAtLevel(orphaned, 0, { ...ALL_OFF, removeUnused: true }, s).data)
    expect(on.objects).toBeLessThan(off.objects)
    expect(on).toMatchObject({ pages: 3, thumbs: 3, title: '테스트 문서' })
  })

  it('중복 객체 제거만: 50쪽 반복 로고가 1개로', () => {
    const dup = F['duplicate-images']
    const s = sizesOf(dup)
    const off = compressAtLevel(dup, 0, ALL_OFF, s)
    const on = compressAtLevel(dup, 0, { ...ALL_OFF, dedupe: true }, s)
    expect(inspect(off.data).images).toBe(50)
    const r = inspect(on.data)
    expect(r.images).toBe(1)
    expect(r.pages).toBe(50)
    expect(on.data.length).toBeLessThan(off.data.length * 0.1)
    expect(renderDiff(dup, on.data, 49)).toBe(0)
  })

  it('문서 구조 압축만: 페이지·내용 유지, 크기는 같거나 작다', () => {
    const off = compressAtLevel(src, 0, ALL_OFF, sizes)
    const on = compressAtLevel(src, 0, { ...ALL_OFF, compressStructure: true }, sizes)
    expect(on.data.length).toBeLessThanOrEqual(off.data.length)
    expect(inspect(on.data)).toMatchObject({ pages: 3, thumbs: 3, title: '테스트 문서' })
    expect(renderDiff(src, on.data)).toBe(0)
  })
})

describe('T-06 글자 보존', () => {
  const src = F.mixed
  const sizes = sizesOf(src)
  const original = inspect(src).texts

  it('준비: 본문·표 글자가 있다', () => {
    expect(original).toHaveLength(3)
    expect(original[0]).toContain('1.1 ')
    expect(original[2]).toContain('R4C3 p3')
  })

  it.each(LEVELS.map((_, i) => i))('단계 %i — 모든 쪽 글자가 100% 같다', (level) => {
    const out = compressAtLevel(src, level, DEFAULT_OPTIONS, sizes)
    expect(inspect(out.data).texts).toEqual(original)
  })

  it('목표 75%로 줄여도 글자가 같고 목표를 채운다', async () => {
    const r = await compressToTarget(src, 75, DEFAULT_OPTIONS)
    expect(r.targetMet).toBe(true)
    expect(inspect(r.data).texts).toEqual(original)
  })
})

describe('T-07 원본보다 커지면 원본 반환', () => {
  it('text-only: 원본 크기를 넘지 않고, 목표 미달을 알린다', async () => {
    const src = F['text-only']
    const r = await compressToTarget(src, 50, DEFAULT_OPTIONS)
    expect(r.size).toBeLessThanOrEqual(src.length)
    expect(r.targetMet).toBe(false)
    expect(r.imagesTotal).toBe(0)
    if (r.usedOriginal) expect(r.data).toEqual(src)
    expect(inspect(r.data).texts).toEqual(inspect(src).texts)
  })
})

describe('묶음별 확인할 점 (7.1)', () => {
  it('photo-heavy: 50%·75% 달성, 20쪽 유지', async () => {
    const src = F['photo-heavy']
    for (const pct of [50, 75]) {
      const r = await compressToTarget(src, pct, DEFAULT_OPTIONS)
      expect(r.targetMet, `${pct}%`).toBe(true)
      expect(r.size).toBeLessThanOrEqual(src.length * (1 - pct / 100))
      expect(r.imagesRewritten).toBe(20)
      expect(inspect(r.data).pages).toBe(20)
    }
  }, 120_000)

  it('scan-like: 가장 강한 단계에서도 1비트 그대로, 화면 동일', () => {
    const src = F['scan-like']
    const out = compressAtLevel(src, LEVELS.length - 1, DEFAULT_OPTIONS, sizesOf(src))
    expect(out.imagesRewritten).toBe(0)
    const r = inspect(out.data)
    // 세 쪽이 같은 그림이라 중복 제거로 1개가 될 수 있다. 남은 이미지는 모두 1비트여야 한다
    expect(r.bits.length).toBeGreaterThan(0)
    expect(r.bits.every((b) => b === 1)).toBe(true)
    for (let p = 0; p < 3; p++) expect(renderDiff(src, out.data, p)).toBe(0)
  })

  it('encrypted: 거부', async () => {
    await expect(compressToTarget(F.encrypted, 50, DEFAULT_OPTIONS)).rejects.toMatchObject({ code: 'encrypted' })
  })

  it('broken: 복구해 결과를 주거나 invalid-pdf로 거부 (날것의 오류가 새지 않음)', async () => {
    let result: Awaited<ReturnType<typeof compressToTarget>> | null = null
    try {
      result = await compressToTarget(F.broken, 50, DEFAULT_OPTIONS)
    } catch (e) {
      expect(e).toMatchObject({ name: 'EngineError', code: 'invalid-pdf' })
    }
    // 복구됐다면 다시 열리는 PDF여야 한다
    if (result) expect(inspect(result.data).pages).toBeGreaterThanOrEqual(1)
  })
})
