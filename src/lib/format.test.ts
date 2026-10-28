import { describe, expect, it } from 'vitest'
import { formatBytes } from './format'

describe('formatBytes', () => {
  it('바이트 단위', () => expect(formatBytes(512)).toBe('512 B'))
  it('KB 소수 한 자리', () => expect(formatBytes(1536)).toBe('1.5 KB'))
  it('MB', () => expect(formatBytes(20 * 1024 * 1024)).toBe('20.0 MB'))
  it('100 이상은 정수', () => expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB'))
  it('잘못된 값', () => expect(formatBytes(-1)).toBe('-'))
})
