// 업로드 파일 검사 (T-03). 엔진을 부르기 전에 화면에서 바로 거른다.
import { MAX_INPUT_BYTES } from '../engine/types'

export type FileProblem = 'not-pdf' | 'empty' | 'too-large' | 'multiple'

/** 이름·형식·크기만 보는 빠른 검사 */
export function checkFile(file: { name: string; type: string; size: number }): FileProblem | null {
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!looksPdf) return 'not-pdf'
  if (file.size === 0) return 'empty'
  if (file.size > MAX_INPUT_BYTES) return 'too-large'
  return null
}

/** 파일 앞부분(최대 1KB)에 PDF 머리말 "%PDF-"가 있는지 */
export function hasPdfHeader(head: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
  const end = Math.min(head.length, 1024) - sig.length
  outer: for (let i = 0; i <= end; i++) {
    for (let j = 0; j < sig.length; j++) if (head[i + j] !== sig[j]) continue outer
    return true
  }
  return false
}

/** 목표 감소율(%)로 목표 크기(바이트) 계산 */
export function targetBytes(size: number, percent: number): number {
  return Math.floor((size * (100 - percent)) / 100)
}

/** 감소율(%) — 정수, 음수면 0 */
export function reductionPercent(original: number, result: number): number {
  if (original <= 0) return 0
  return Math.max(0, Math.round((1 - result / original) * 100))
}
