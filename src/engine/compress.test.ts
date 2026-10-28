import { describe, expect, it } from 'vitest'
import * as mupdf from 'mupdf'
import { compressAtLevel, compressToTarget, analyze, saveOptions, targetPixels } from './compress'
import { DEFAULT_OPTIONS, EngineError, LEVELS, type CompressOptions } from './types'
import { makeTestPdf, pageText, renderDiff } from './testPdf'

const open = (data: Uint8Array) => mupdf.Document.openDocument(data, 'application/pdf').asPDF()!

function sizesOf(data: Uint8Array) {
  const doc = open(data)
  const s = analyze(doc)
  doc.destroy()
  return s
}

/** 문서 안 이미지 XObject들의 사전 문자열 */
function imageDicts(data: Uint8Array): string[] {
  const doc = open(data)
  const out: string[] = []
  for (let i = 1; i < doc.countObjects(); i++) {
    const ref = doc.newIndirect(i)
    try {
      if (ref.isStream() && ref.get('Subtype').asName() === 'Image') out.push(ref.resolve().toString())
    } catch {
      /* skip */
    }
  }
  doc.destroy()
  return out
}

describe('targetPixels', () => {
  it('300DPI 이미지를 150DPI 상한이면 절반으로', () => {
    expect(targetPixels(1200, 900, { w: 288, h: 216 }, 150)).toEqual({ w: 600, h: 450 })
  })
  it('이미 상한보다 낮으면 그대로', () => {
    expect(targetPixels(400, 300, { w: 288, h: 216 }, 150)).toEqual({ w: 400, h: 300 })
  })
  it('거의 같으면(5% 이내) 그대로', () => {
    expect(targetPixels(620, 465, { w: 288, h: 216 }, 150)).toEqual({ w: 620, h: 465 })
  })
})

describe('saveOptions', () => {
  it('기본 옵션', () => {
    expect(saveOptions(DEFAULT_OPTIONS)).toBe('garbage=4,clean,compress,compress-fonts,compress-images')
  })
  it('모두 끄면 빈 문자열', () => {
    const off: CompressOptions = { removeUnused: false, dedupe: false, compressStructure: false, removeMetadata: false, removeThumbnails: false }
    expect(saveOptions(off)).toBe('')
  })
  it('중복 제거 없이 미사용만', () => {
    expect(saveOptions({ ...DEFAULT_OPTIONS, dedupe: false, compressStructure: false })).toBe('garbage=compact,clean')
  })
})

describe('analyze', () => {
  it('이미지의 실제 표시 크기를 잰다', () => {
    const sizes = sizesOf(makeTestPdf({ widthIn: 4, heightIn: 3, dpi: 100 }))
    expect(sizes.size).toBe(1)
    const [s] = [...sizes.values()]
    expect(s.w).toBeCloseTo(288)
    expect(s.h).toBeCloseTo(216)
  })
  it('SMask도 본 이미지 크기를 물려받는다', () => {
    const sizes = sizesOf(makeTestPdf({ kind: 'smask', dpi: 100 }))
    expect(sizes.size).toBe(2)
  })
})

describe('compressAtLevel', () => {
  const photo = makeTestPdf({ dpi: 300 })
  const sizes = sizesOf(photo)

  it('사진 이미지를 줄이고 글자는 유지한다', () => {
    const out = compressAtLevel(photo, 2, DEFAULT_OPTIONS, sizes)
    expect(out.imagesRewritten).toBe(1)
    expect(out.data.length).toBeLessThan(photo.length * 0.3)
    expect(pageText(out.data)).toContain('PDF diet test page 1')
    expect(renderDiff(photo, out.data)).toBeLessThan(6)
    const [dict] = imageDicts(out.data)
    expect(dict).toContain('/DCTDecode')
    expect(dict).toContain('/Width 600')
  })

  it('단계 0은 이미지를 건드리지 않는다', () => {
    const out = compressAtLevel(photo, 0, DEFAULT_OPTIONS, sizes)
    expect(out.imagesRewritten).toBe(0)
    expect(renderDiff(photo, out.data)).toBe(0)
  })

  it('1비트 흑백 이미지는 JPEG로 바꾸지 않는다', () => {
    const bw = makeTestPdf({ kind: 'bilevel', dpi: 300 })
    const out = compressAtLevel(bw, 6, DEFAULT_OPTIONS, sizesOf(bw))
    expect(out.imagesRewritten).toBe(0)
    expect(imageDicts(out.data)[0]).toContain('/BitsPerComponent 1')
  })

  // 색이 뒤집히거나 위아래가 바뀌면 평균 픽셀 차가 수십~100 이상 난다.
  // 10 안팎은 테스트 이미지의 잡음이 축소되며 평균화된 정도라 정상이다.
  it('CMYK 이미지 색이 뒤집히지 않는다', () => {
    const cmyk = makeTestPdf({ kind: 'cmyk', dpi: 300 })
    const out = compressAtLevel(cmyk, 2, DEFAULT_OPTIONS, sizesOf(cmyk))
    expect(out.imagesRewritten).toBe(1)
    expect(imageDicts(out.data)[0]).not.toContain('/DeviceRGB')
    expect(renderDiff(cmyk, out.data)).toBeLessThan(15)
  })

  it('회색 이미지', () => {
    const gray = makeTestPdf({ kind: 'gray', dpi: 300 })
    const out = compressAtLevel(gray, 2, DEFAULT_OPTIONS, sizesOf(gray))
    expect(out.imagesRewritten).toBe(1)
    expect(renderDiff(gray, out.data)).toBeLessThan(15)
  })

  it('투명 마스크(SMask)가 있는 이미지', () => {
    const sm = makeTestPdf({ kind: 'smask', dpi: 300 })
    const out = compressAtLevel(sm, 2, DEFAULT_OPTIONS, sizesOf(sm))
    expect(out.imagesRewritten).toBe(2)
    expect(renderDiff(sm, out.data)).toBeLessThan(6)
  })

  it('메타데이터·썸네일 제거', () => {
    const src = makeTestPdf({ dpi: 100, metadata: true, thumbnail: true })
    const keep = compressAtLevel(src, 0, { ...DEFAULT_OPTIONS, removeThumbnails: false }, sizesOf(src))
    const kd = open(keep.data)
    expect(kd.getMetaData('info:Title')).toBe('테스트 문서')
    expect(kd.findPage(0).get('Thumb').isNull()).toBe(false)
    kd.destroy()

    const out = compressAtLevel(src, 0, { ...DEFAULT_OPTIONS, removeMetadata: true }, sizesOf(src))
    const d = open(out.data)
    expect(d.getMetaData('info:Title') ?? '').toBe('')
    expect(d.getTrailer().get('Root').get('Metadata').isNull()).toBe(true)
    expect(d.findPage(0).get('Thumb').isNull()).toBe(true)
    d.destroy()
  })

  it('중복 객체 제거', () => {
    const dup = makeTestPdf({ dpi: 100, duplicate: true })
    const sizes = sizesOf(dup)
    const off = compressAtLevel(dup, 0, { ...DEFAULT_OPTIONS, dedupe: false }, sizes)
    const on = compressAtLevel(dup, 0, DEFAULT_OPTIONS, sizes)
    expect(imageDicts(off.data).length).toBe(2)
    expect(imageDicts(on.data).length).toBe(1)
  })
})

describe('compressToTarget', () => {
  const photo = makeTestPdf({ dpi: 300, pages: 2 })

  it('목표를 만족하는 가장 약한 단계를 고른다', async () => {
    const r = await compressToTarget(photo, 50, DEFAULT_OPTIONS)
    expect(r.targetMet).toBe(true)
    expect(r.size).toBeLessThanOrEqual(photo.length * 0.5)
    expect(r.level).not.toBeNull()
    // 한 단계 약하면 목표를 못 채워야 한다
    if (r.level! > 0) {
      const weaker = compressAtLevel(photo, r.level! - 1, DEFAULT_OPTIONS, sizesOf(photo))
      expect(weaker.data.length).toBeGreaterThan(photo.length * 0.5)
    }
  })

  it('목표를 못 채우면 가장 작은 결과를 주고 targetMet=false', async () => {
    // 1비트 흑백 이미지는 다시 쓰지 않으므로 90%는 불가능
    const bw = makeTestPdf({ kind: 'bilevel', dpi: 300 })
    const r = await compressToTarget(bw, 90, DEFAULT_OPTIONS)
    expect(r.targetMet).toBe(false)
    expect(r.size).toBeLessThanOrEqual(bw.length)
    const strongest = compressAtLevel(bw, LEVELS.length - 1, DEFAULT_OPTIONS, sizesOf(bw))
    expect(r.size).toBeLessThanOrEqual(strongest.data.length)
  })

  it('줄일 것이 없으면 원본을 그대로 돌려준다', async () => {
    const tiny = compressAtLevel(makeTestPdf({ dpi: 20 }), 0, DEFAULT_OPTIONS, new Map()).data
    const r = await compressToTarget(tiny, 30, DEFAULT_OPTIONS)
    expect(r.size).toBeLessThanOrEqual(tiny.length)
    if (r.usedOriginal) expect(r.data).toEqual(tiny)
  })

  it('진행률을 알린다', async () => {
    const phases = new Set<string>()
    await compressToTarget(photo, 50, DEFAULT_OPTIONS, (p) => phases.add(p.phase))
    expect([...phases]).toEqual(expect.arrayContaining(['open', 'analyze', 'images', 'save']))
  })

  it('PDF가 아니면 invalid-pdf', async () => {
    await expect(compressToTarget(new TextEncoder().encode('hello'), 50, DEFAULT_OPTIONS)).rejects.toMatchObject({
      name: 'EngineError',
      code: 'invalid-pdf',
    })
  })

  it('암호 걸린 PDF는 encrypted', async () => {
    const enc = makeTestPdf({ dpi: 50, encryptPassword: 'secret' })
    await expect(compressToTarget(enc, 50, DEFAULT_OPTIONS)).rejects.toBeInstanceOf(EngineError)
    await expect(compressToTarget(enc, 50, DEFAULT_OPTIONS)).rejects.toMatchObject({ code: 'encrypted' })
  })
})
