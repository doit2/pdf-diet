// 압축 엔진 공용 타입·상수. 화면(UI)과 Worker 양쪽에서 쓴다.

/** 사용자가 고르는 부가 옵션 5종 */
export interface CompressOptions {
  /** 미사용 리소스 제거 (저장 옵션 garbage + clean) */
  removeUnused: boolean
  /** 중복 객체 제거 (garbage=4: 같은 스트림까지 합침) */
  dedupe: boolean
  /** 문서 구조 압축 (compress, compress-fonts, compress-images) */
  compressStructure: boolean
  /** 메타데이터 제거 (Info, XMP) — 기본 끔 */
  removeMetadata: boolean
  /** 페이지 썸네일 제거 (각 페이지 Thumb) */
  removeThumbnails: boolean
}

export const DEFAULT_OPTIONS: CompressOptions = {
  removeUnused: true,
  dedupe: true,
  compressStructure: true,
  removeMetadata: false,
  removeThumbnails: true,
}

/** 이미지 품질 단계 하나: 해상도 상한(DPI)과 JPEG 품질(1~100) */
export interface QualityLevel {
  dpi: number
  quality: number
}

/**
 * 품질 단계표. 0번은 "이미지 그대로, 구조만 정리".
 * 1~6번은 숫자가 클수록 강하게 줄인다. (T-05 측정으로 확정)
 */
export const LEVELS: readonly (QualityLevel | null)[] = [
  null,
  { dpi: 200, quality: 85 },
  { dpi: 150, quality: 75 },
  { dpi: 120, quality: 65 },
  { dpi: 96, quality: 55 },
  { dpi: 72, quality: 45 },
  { dpi: 60, quality: 35 },
]

export const MAX_INPUT_BYTES = 100 * 1024 * 1024

export type ProgressPhase = 'open' | 'analyze' | 'images' | 'save'

export interface Progress {
  phase: ProgressPhase
  /** 지금 시도 중인 품질 단계 (0~6) */
  level: number
  /** 몇 번째 시도인지 (1부터) */
  attempt: number
  /** 현재 단계 안에서의 진행 (이미지 n개 중 몇 개 등) */
  done: number
  total: number
}

export interface CompressResult {
  data: Uint8Array
  originalSize: number
  size: number
  /** 고른 품질 단계. 원본을 그대로 돌려주면 null */
  level: number | null
  /** 목표 %를 달성했는지 */
  targetMet: boolean
  /** 줄여도 원본보다 커져서 원본을 그대로 돌려줬는지 */
  usedOriginal: boolean
  /** 다시 쓴 이미지 수 / 전체 이미지 수 (고른 단계 기준) */
  imagesRewritten: number
  imagesTotal: number
}

/** 엔진 오류 코드. 화면에서 문구로 바꿔 보여 준다. */
export type EngineErrorCode = 'invalid-pdf' | 'encrypted' | 'too-large' | 'cancelled' | 'failed'

export class EngineError extends Error {
  constructor(public code: EngineErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'EngineError'
  }
}

/** Worker 경계를 넘어온 Error(name, message만 남음)에서 코드를 되살린다 */
export function errorCodeOf(e: unknown): EngineErrorCode {
  if (e instanceof EngineError) return e.code
  const msg = e instanceof Error ? e.message : String(e)
  const code = msg.split(':')[0]
  const known: EngineErrorCode[] = ['invalid-pdf', 'encrypted', 'too-large', 'cancelled', 'failed']
  return (known as string[]).includes(code) ? (code as EngineErrorCode) : 'failed'
}
