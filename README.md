# pdf-diet (PDF 다이어트)

브라우저에서 PDF 용량을 줄이는 웹앱입니다. **파일은 서버로 전송되지 않고** 사용자 브라우저 안에서만 처리됩니다.

- 서비스 주소: https://pdf-diet.vercel.app
- 라이선스: [AGPL-3.0](./LICENSE)

## 상태

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 1. 골격 | Vite + React + TypeScript, Tailwind, CI, Vercel 자동 배포 | 완료 |
| 2. 엔진 | MuPDF.js(WASM) + Web Worker, 이미지 재압축, 옵션 5종, 목표 % 탐색 | 완료 |
| 3. 화면 | 업로드·설정·진행·결과 4단계 화면 | 완료 |
| 4. 테스트 | 테스트 PDF 생성, 단위·엔진·화면 테스트(Playwright), CI | 완료 |
| 5. 배포·안정화 | 운영 점검, 모바일 메모리 안내, 실제 기기 점검([T-13](./docs/T13-CHECKLIST.md)), v1.0.0 릴리스 | 완료 (iPhone·화질 재확인 남음) |

## 다음 작업자에게

새 대화·새 작업자는 [docs/HANDOFF.md](./docs/HANDOFF.md)부터 읽으세요. 전체 기획은 [docs/PLAN.md](./docs/PLAN.md)에 있습니다.

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm test           # 단위·엔진 테스트 (Vitest)
npm run build      # 배포용 빌드 (dist/)
npm run test:e2e   # 화면 테스트 (빌드 → 운영 CSP 정적 서버 → Playwright)
npm run fixtures   # 테스트 PDF 묶음을 tests/fixtures/out/ 에 생성 (big: 95MB 포함)
```

- Node.js 20 이상
- `main` 브랜치에 올라가면 Vercel이 자동 배포합니다. PR마다 미리보기 주소가 생깁니다.
- GitHub Actions가 PR마다 타입 검사 → 테스트 → 빌드 → 화면 테스트(Chromium, Firefox·WebKit)를 실행합니다.
- 화면 테스트 처음 한 번: `npx playwright install chromium`. 95MB 성능 확인은 `BIG=1 npm run test:e2e`.

## 구조

```
src/
  App.tsx        화면 상태 전환·엔진 호출
  components/    업로드·설정·처리 중·결과 화면
  strings.ts     화면 문구 모음 (다국어 추가 시 이 파일 확장)
  lib/           계산·변환 로직 (단위 테스트 대상)
  engine/        압축 엔진 (MuPDF.js WASM, Web Worker)
tests/
  fixtures/      테스트 PDF 묶음 생성기 (기획서 7.1)
  engine/        묶음으로 엔진 확인 (T-04·T-06·T-07)
  e2e/           Playwright 화면·보안·성능 (T-08~T-12), 운영 헤더를 붙인 정적 서버
docs/
  HANDOFF.md     인계 메모 (새 작업자는 여기부터)
  PLAN.md        기획서 사본
  T13-CHECKLIST.md  실제 기기 수동 점검표
vercel.json      보안 헤더(CSP: 외부 전송 차단), 정적 파일 캐시
```
