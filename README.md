# pdf-diet (PDF 다이어트)

브라우저에서 PDF 용량을 줄이는 웹앱입니다. **파일은 서버로 전송되지 않고** 사용자 브라우저 안에서만 처리됩니다.

- 서비스 주소: https://pdf-diet.vercel.app
- 라이선스: [AGPL-3.0](./LICENSE)

## 상태

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 1. 골격 | Vite + React + TypeScript, Tailwind, CI, Vercel 자동 배포 | 완료 |
| 2. 엔진 | MuPDF.js(WASM) + Web Worker, 이미지 재압축, 옵션 5종, 목표 % 탐색 | 완료 |
| 3. 화면 | 업로드·설정·진행·결과 4단계 화면 | 예정 |
| 4. 테스트 | 테스트 PDF 생성, 단위·엔진·화면 테스트 | 예정 |
| 5. 배포·안정화 | 운영 점검, 릴리스 | 예정 |

## 다음 작업자에게

새 대화·새 작업자는 [docs/HANDOFF.md](./docs/HANDOFF.md)부터 읽으세요. 전체 기획은 [docs/PLAN.md](./docs/PLAN.md)에 있습니다.

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm test           # 단위 테스트
npm run build      # 배포용 빌드 (dist/)
```

- Node.js 20 이상
- `main` 브랜치에 올라가면 Vercel이 자동 배포합니다. PR마다 미리보기 주소가 생깁니다.
- GitHub Actions가 PR마다 타입 검사 → 테스트 → 빌드를 실행합니다.

## 구조

```
src/
  App.tsx        화면
  strings.ts     화면 문구 모음 (다국어 추가 시 이 파일 확장)
  lib/           계산·변환 로직 (단위 테스트 대상)
  engine/        압축 엔진 (MuPDF.js WASM, Web Worker)
vercel.json      보안 헤더(CSP: 외부 전송 차단), 정적 파일 캐시
```
