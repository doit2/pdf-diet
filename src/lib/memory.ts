// 큰 파일 + 메모리가 적은 기기(주로 휴대폰) 경고 (5단계 모바일 상한).
// 막지는 않고 설정 화면에 안내만 한다. T-12(95MB)는 PC 기준으로만 확인됨.

const MB = 1024 * 1024

export interface DeviceEnv {
  /** navigator.deviceMemory (GB, 0.25~8로 반올림됨). Chrome·Android만 제공, iPhone·Firefox는 없음 */
  deviceMemory?: number
  /** 터치가 주 입력인 기기(휴대폰·태블릿) */
  mobile: boolean
}

/** 이 크기 이하면 경고하지 않는다 (바이트). Infinity = 경고 없음 */
export function safeLimitBytes(env: DeviceEnv): number {
  const gb = env.deviceMemory
  if (gb !== undefined && gb > 0) {
    if (gb <= 2) return 25 * MB
    if (gb <= 4) return 50 * MB
    return env.mobile ? 80 * MB : Infinity
  }
  // 메모리 값을 알 수 없는 휴대폰(iPhone 등): 50MB부터 안내
  return env.mobile ? 50 * MB : Infinity
}

export function memoryRisk(size: number, env: DeviceEnv): boolean {
  return size > safeLimitBytes(env)
}

/** 현재 브라우저 정보 읽기 (화면에서 사용) */
export function readDeviceEnv(): DeviceEnv {
  if (typeof navigator === 'undefined') return { mobile: false }
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)
  return { deviceMemory: nav.deviceMemory, mobile: coarse && mobileUa }
}
