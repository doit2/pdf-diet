// 엔진 진행 상황(Progress)을 0~1 하나의 값으로 바꾼다.
// 이진 탐색은 단계 7개(0~6)에서 최대 4번 시도하므로 4번을 기준으로 나눠 그린다.
// 시도가 일찍 끝나면 결과 화면으로 바로 넘어가므로 막대가 끝까지 안 차도 괜찮다.
import type { Progress } from '../engine/types'

export const MAX_ATTEMPTS = 4
const ANALYZE_SHARE = 0.1

export function overallProgress(p: Progress): number {
  const frac = p.total > 0 ? Math.min(p.done / p.total, 1) : 0
  if (p.phase === 'open') return 0
  if (p.phase === 'analyze') return ANALYZE_SHARE * frac
  const inAttempt = p.phase === 'save' ? 0.95 : frac * 0.9
  const attempt = Math.min(Math.max(p.attempt, 1), MAX_ATTEMPTS)
  return ANALYZE_SHARE + (1 - ANALYZE_SHARE) * ((attempt - 1 + inAttempt) / MAX_ATTEMPTS)
}
