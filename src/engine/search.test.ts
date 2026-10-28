import { describe, expect, it } from 'vitest'
import { searchLevels, type LevelOutput } from './search'

/** 단계별 결과 크기를 흉내 내는 가짜 압축기 */
function fake(sizes: number[]) {
  const calls: number[] = []
  const run = (lv: number): LevelOutput => {
    calls.push(lv)
    return { data: new Uint8Array(sizes[lv]), imagesRewritten: lv, imagesTotal: 6 }
  }
  return { run, calls }
}
const input = new Uint8Array(1000)

describe('searchLevels', () => {
  it('목표를 만족하는 가장 약한 단계', async () => {
    const f = fake([950, 800, 600, 450, 300, 200, 150])
    const r = await searchLevels(input, 50, f.run)
    expect(r.level).toBe(3)
    expect(r.size).toBe(450)
    expect(r.targetMet).toBe(true)
    expect(f.calls.length).toBeLessThanOrEqual(3)
    expect(new Set(f.calls).size).toBe(f.calls.length) // 같은 단계를 두 번 돌리지 않음
  })
  it('단계 0으로 충분하면 0', async () => {
    const r = await searchLevels(input, 5, fake([900, 800, 600, 450, 300, 200, 150]).run)
    expect(r.level).toBe(0)
  })
  it('목표 미달이면 가장 작은 결과', async () => {
    const r = await searchLevels(input, 95, fake([950, 800, 600, 450, 300, 200, 150]).run)
    expect(r.targetMet).toBe(false)
    expect(r.level).toBe(6)
    expect(r.size).toBe(150)
  })
  it('모두 원본보다 크면 원본', async () => {
    const r = await searchLevels(input, 50, fake([1100, 1100, 1100, 1100, 1100, 1100, 1100]).run)
    expect(r.usedOriginal).toBe(true)
    expect(r.size).toBe(1000)
    expect(r.level).toBeNull()
  })
})
