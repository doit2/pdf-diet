// 목표 % 탐색 (순수 로직). 단계 하나를 실제로 압축하는 함수(runLevel)를 받아 쓴다.
// 브라우저에서는 runLevel이 시도마다 새 Worker를 띄운다 — 같은 WASM 인스턴스에서
// 압축을 반복하면 메모리가 계속 쌓이기 때문 (HANDOFF T-02b).
import { LEVELS, type CompressResult } from './types'

export interface LevelOutput {
  data: Uint8Array
  imagesRewritten: number
  imagesTotal: number
}

/**
 * 목표 감소율(%)을 만족하는 "가장 약한" 품질 단계를 이진 탐색으로 고른다.
 * - 단계 0(구조만 정리)부터 6까지. 단계가 클수록 결과가 작다고 가정한다.
 * - 어느 단계로도 목표에 못 미치면 가장 작은 결과를 돌려준다(targetMet=false).
 * - 결과가 원본 이상이면 원본을 그대로 돌려준다(usedOriginal=true).
 * - 메모리 절약: 최종 후보가 될 수 있는 결과만 들고 있는다.
 */
export async function searchLevels(
  input: Uint8Array,
  targetPercent: number,
  runLevel: (level: number, attempt: number) => Promise<LevelOutput> | LevelOutput,
): Promise<CompressResult> {
  const originalSize = input.length
  const goal = originalSize * (1 - Math.min(Math.max(targetPercent, 0), 99) / 100)
  const last = LEVELS.length - 1

  const sizeOf = new Map<number, number>()
  let best: { level: number; out: LevelOutput } | null = null // 목표 만족 + 가장 약한 단계
  let smallest: { level: number; out: LevelOutput } | null = null // 목표 미달 시 대비
  let attempt = 0

  const run = async (lv: number): Promise<number> => {
    const known = sizeOf.get(lv)
    if (known !== undefined) return known
    const out = await runLevel(lv, ++attempt)
    const size = out.data.length
    sizeOf.set(lv, size)
    if (size <= goal) {
      if (!best || lv < best.level) best = { level: lv, out }
    } else if (!best && (!smallest || size < smallest.out.data.length)) {
      smallest = { level: lv, out }
    }
    if (best) smallest = null
    return size
  }

  let lo = 0
  let hi = last
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((await run(mid)) <= goal) hi = mid - 1
    else lo = mid + 1
  }
  if (!best) await run(last)

  const pick = (best ?? smallest)! as { level: number; out: LevelOutput }
  if (pick.out.data.length >= originalSize) {
    return {
      data: input.slice(),
      originalSize,
      size: originalSize,
      level: null,
      targetMet: originalSize <= goal,
      usedOriginal: true,
      imagesRewritten: 0,
      imagesTotal: pick.out.imagesTotal,
    }
  }
  return {
    data: pick.out.data,
    originalSize,
    size: pick.out.data.length,
    level: pick.level,
    targetMet: pick.out.data.length <= goal,
    usedOriginal: false,
    imagesRewritten: pick.out.imagesRewritten,
    imagesTotal: pick.out.imagesTotal,
  }
}
