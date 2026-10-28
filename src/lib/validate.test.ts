import { describe, expect, it } from 'vitest'
import { checkFile, hasPdfHeader, reductionPercent, targetBytes } from './validate'
import { overallProgress } from './progress'
import { outputName } from '../strings'

const MB = 1024 * 1024
const enc = (s: string) => new TextEncoder().encode(s)

describe('checkFile (T-03)', () => {
  it('PDF는 통과', () => {
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toBeNull()
    expect(checkFile({ name: 'A.PDF', type: '', size: 10 })).toBeNull()
  })
  it('PDF가 아니면 거부', () => {
    expect(checkFile({ name: 'a.png', type: 'image/png', size: 10 })).toBe('not-pdf')
  })
  it('빈 파일 거부', () => {
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toBe('empty')
  })
  it('100MB 경계', () => {
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 100 * MB })).toBeNull()
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 100 * MB + 1 })).toBe('too-large')
  })
})

describe('hasPdfHeader', () => {
  it('머리말 있음', () => expect(hasPdfHeader(enc('%PDF-1.7\n'))).toBe(true))
  it('앞에 쓰레기 바이트가 있어도 1KB 안이면 인정', () => expect(hasPdfHeader(enc('junk\n%PDF-1.4'))).toBe(true))
  it('머리말 없음', () => expect(hasPdfHeader(enc('<html>'))).toBe(false))
})

describe('계산', () => {
  it('목표 크기', () => {
    expect(targetBytes(20 * MB, 50)).toBe(10 * MB)
    expect(targetBytes(1000, 10)).toBe(900)
    expect(targetBytes(1000, 90)).toBe(100)
  })
  it('감소율', () => {
    expect(reductionPercent(1000, 250)).toBe(75)
    expect(reductionPercent(1000, 1200)).toBe(0)
    expect(reductionPercent(0, 0)).toBe(0)
  })
  it('출력 파일명', () => {
    expect(outputName('보고서.PDF')).toBe('보고서_compressed.pdf')
    expect(outputName('a.b.pdf')).toBe('a.b_compressed.pdf')
  })
})

describe('overallProgress', () => {
  it('단조 증가, 0~1', () => {
    const seq = [
      overallProgress({ phase: 'open', level: 0, attempt: 0, done: 0, total: 1 }),
      overallProgress({ phase: 'analyze', level: 0, attempt: 0, done: 5, total: 10 }),
      overallProgress({ phase: 'images', level: 3, attempt: 1, done: 1, total: 4 }),
      overallProgress({ phase: 'save', level: 3, attempt: 1, done: 0, total: 1 }),
      overallProgress({ phase: 'images', level: 1, attempt: 2, done: 0, total: 4 }),
      overallProgress({ phase: 'save', level: 6, attempt: 4, done: 0, total: 1 }),
    ]
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1])
    expect(seq.at(-1)!).toBeLessThanOrEqual(1)
  })
})
