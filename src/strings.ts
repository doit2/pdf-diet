// 화면 문구 모음. 나중에 영어를 추가할 때 이 파일만 늘리면 된다.
import type { EngineErrorCode, ProgressPhase } from './engine/types'
import type { FileProblem } from './lib/validate'

export const t = {
  appName: 'PDF 다이어트',
  tagline: '글자는 그대로, 이미지만 줄여 PDF 용량을 낮춥니다',
  privacy: '파일은 서버로 전송되지 않고 내 브라우저에서만 처리됩니다.',
  source: '소스 코드',
  license: 'AGPL-3.0',

  // 1. 업로드
  dropTitle: 'PDF 파일을 여기에 끌어다 놓으세요',
  dropOr: '또는',
  pick: 'PDF 선택',
  dropLimit: 'PDF 1개, 최대 100MB',
  dropActive: '놓으면 바로 열립니다',

  // 2. 설정
  changeFile: '다른 파일',
  targetLabel: '얼마나 줄일까요?',
  targetHint: (pct: number, size: string) => `원본보다 ${pct}% 작게 — 목표 ${size} 이하`,
  slider: '줄일 비율',
  advanced: '고급 옵션',
  options: {
    removeUnused: ['미사용 리소스 제거', '어느 페이지에서도 쓰지 않는 글꼴·이미지를 버립니다'],
    compressStructure: ['문서 구조 압축', '내부 데이터를 다시 압축합니다'],
    dedupe: ['중복 객체 제거', '똑같은 이미지·글꼴을 하나로 합칩니다'],
    removeMetadata: ['메타데이터 제거', '작성자·제목 등 문서 정보를 지웁니다 (제목도 사라집니다)'],
    removeThumbnails: ['페이지 썸네일 제거', '페이지마다 들어 있는 미리보기 이미지를 지웁니다'],
  } as const,
  start: '압축 시작',
  firstLoadNote: '처음 한 번은 압축 엔진(약 5MB)을 내려받습니다.',
  memoryNote: '이 기기에서는 큰 파일을 처리하다 메모리가 부족해 멈출 수 있습니다. 실패하면 PC 브라우저에서 시도해 주세요.',

  // 3. 처리 중
  working: '압축하는 중…',
  phase: {
    open: '파일 여는 중',
    analyze: '페이지 살펴보는 중',
    images: '이미지 다시 압축하는 중',
    save: '저장하는 중',
  } satisfies Record<ProgressPhase, string>,
  attemptInfo: (attempt: number, level: number) => `${attempt}번째 시도 · 품질 단계 ${level}/6`,
  pageCount: (done: number, total: number) => `${done}/${total}쪽`,
  imageCount: (done: number, total: number) => `이미지 ${done}/${total}`,
  cancel: '취소',
  bigFileNote: '큰 파일은 1분 넘게 걸릴 수 있습니다. 이 탭을 닫지 마세요.',

  // 4. 결과
  doneTitle: '다 줄였습니다',
  reduced: (pct: number) => `${pct}% 감소`,
  levelInfo: (level: number) => (level === 0 ? '이미지는 그대로, 구조만 정리' : `이미지 품질 단계 ${level}/6`),
  elapsed: (sec: string) => `${sec}초`,
  pages: (n: number) => `${n}쪽`,
  imagesInfo: (n: number, total: number) => `이미지 ${total}개 중 ${n}개 다시 압축`,
  targetMissed: (goal: number, actual: number) =>
    `목표 ${goal}%에 못 미쳤습니다. 글자가 읽히는 범위에서 이 이상 줄이기 어렵습니다 — 결과 ${actual}% 감소`,
  textOnlyHint: '이미지가 적은 PDF라 많이 줄지 않습니다. 글자는 손대지 않기 때문입니다.',
  usedOriginal: '이미 최적화된 파일입니다. 줄여도 더 커져서 원본을 그대로 드립니다.',
  download: '다운로드',
  retry: '다른 설정으로 다시',
  newFile: '새 파일',
  cancelledNote: '취소했습니다.',

  // 오류
  errorTitle: '처리하지 못했습니다',
  fileProblem: {
    'not-pdf': 'PDF 파일만 올릴 수 있습니다.',
    empty: '빈 파일입니다.',
    'too-large': '100MB 이하의 PDF만 처리할 수 있습니다.',
    multiple: 'PDF는 한 번에 1개씩 올려 주세요. 첫 번째 파일만 열었습니다.',
  } satisfies Record<FileProblem, string>,
  engineError: {
    'invalid-pdf': '손상되었거나 올바르지 않은 PDF입니다.',
    encrypted: '암호가 걸린 PDF는 지원하지 않습니다.',
    'too-large': '100MB 이하의 PDF만 처리할 수 있습니다.',
    cancelled: '취소했습니다.',
    failed: '처리 중 문제가 생겼습니다. 메모리가 부족할 수 있으니 PC 브라우저나 더 작은 파일로 다시 시도해 주세요.',
  } satisfies Record<EngineErrorCode, string>,
  backToStart: '처음으로',
} as const

/** 다운로드 파일명: 원본이름_compressed.pdf */
export function outputName(name: string): string {
  const base = name.replace(/\.pdf$/i, '') || 'document'
  return `${base}_compressed.pdf`
}
