import { describe, expect, it } from 'vitest'
import { memoryRisk, safeLimitBytes } from './memory'

const MB = 1024 * 1024

describe('memoryRisk (모바일 메모리 안내)', () => {
  it('PC는 메모리를 몰라도 100MB까지 안내 없음', () => {
    expect(safeLimitBytes({ mobile: false })).toBe(Infinity)
    expect(memoryRisk(100 * MB, { mobile: false, deviceMemory: 8 })).toBe(false)
  })

  it('메모리가 적으면 PC여도 안내', () => {
    expect(memoryRisk(30 * MB, { mobile: false, deviceMemory: 2 })).toBe(true)
    expect(memoryRisk(20 * MB, { mobile: false, deviceMemory: 2 })).toBe(false)
    expect(memoryRisk(60 * MB, { mobile: false, deviceMemory: 4 })).toBe(true)
  })

  it('메모리를 알 수 없는 휴대폰(iPhone)은 50MB 초과부터', () => {
    expect(memoryRisk(50 * MB, { mobile: true })).toBe(false)
    expect(memoryRisk(51 * MB, { mobile: true })).toBe(true)
  })

  it('메모리 많은 휴대폰은 80MB 초과부터', () => {
    expect(memoryRisk(70 * MB, { mobile: true, deviceMemory: 8 })).toBe(false)
    expect(memoryRisk(90 * MB, { mobile: true, deviceMemory: 8 })).toBe(true)
  })
})
