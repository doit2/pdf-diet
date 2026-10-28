// 기획서 7.1 테스트용 PDF 묶음. 저작권 문제가 없도록 모두 스크립트로 만든다.
// 엔진 테스트(vitest)는 이 함수를 직접 부르고, 화면 테스트(Playwright)는 make.ts가 쓴 파일을 올린다.
import { makeTestPdf } from '../../src/engine/testPdf'

export type FixtureName =
  | 'text-only'
  | 'photo-heavy'
  | 'mixed'
  | 'duplicate-images'
  | 'with-thumbs-meta'
  | 'scan-like'
  | 'encrypted'
  | 'broken'

/** 파일 이름 → 만드는 함수. big-95mb는 크기가 커서 makeBig로 따로 만든다. */
export const FIXTURES: Record<FixtureName, () => Uint8Array> = {
  // 글자만 10쪽 → 거의 줄지 않음 (안내 문구, 원본 반환)
  'text-only': () => makeTestPdf({ kind: 'none', pages: 10, lines: 55 }),
  // 고해상도(300DPI) 사진 20장 → 50%·75% 달성
  'photo-heavy': () => makeTestPdf({ kind: 'photo', pages: 20, dpi: 300, widthIn: 3, heightIn: 2 }),
  // 글자 + 사진 + 표 → 글자 추출 결과가 원본과 같아야 함
  mixed: () => makeTestPdf({ kind: 'photo', pages: 3, dpi: 300, lines: 40, table: true }),
  // 같은 로고가 50쪽에 별도 객체로 반복 → 중복 제거 효과
  'duplicate-images': () => makeTestPdf({ kind: 'photo', pages: 50, dpi: 150, widthIn: 1.5, heightIn: 1, sameImage: true }),
  // 썸네일·메타데이터 포함 → 옵션 켜면 사라짐
  'with-thumbs-meta': () => makeTestPdf({ kind: 'photo', pages: 3, dpi: 150, metadata: true, thumbnail: true }),
  // 1비트 흑백 스캔 → JPEG로 바뀌거나 깨지지 않아야 함
  'scan-like': () => makeTestPdf({ kind: 'bilevel', pages: 3, dpi: 300, widthIn: 7.5, heightIn: 6, lines: 20 }),
  // 암호 걸림 → 거부 안내
  encrypted: () => makeTestPdf({ kind: 'photo', pages: 1, dpi: 72, encryptPassword: 'secret' }),
  // 끝부분이 잘린 PDF → 오류 안내 또는 복구
  broken: () => {
    const full = makeTestPdf({ kind: 'photo', pages: 2, dpi: 150, lines: 10 })
    return full.slice(0, Math.floor(full.length * 0.6))
  },
}

/**
 * 약 targetMB 크기의 사진 PDF (T-12 성능). 잡음 많은 사진이라 원본은 잘 안 줄어든 상태로 저장된다.
 * 한 쪽 크기를 먼저 재고 쪽수를 맞춘다.
 */
export function makeBig(targetMB = 95): Uint8Array {
  const page = { kind: 'photo' as const, dpi: 200, widthIn: 7.5, heightIn: 6.5 }
  const one = makeTestPdf({ ...page, pages: 1 }).length
  const pages = Math.max(1, Math.round((targetMB * 1024 * 1024) / one))
  return makeTestPdf({ ...page, pages })
}
