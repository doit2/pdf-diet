# 인계 메모 (HANDOFF)

새 대화는 이 파일만 먼저 읽고 시작한다. 단계가 끝날 때마다 갱신한다.

- 최종 갱신: 2026-10-28 (1단계 완료 직후)
- 다음 할 일: **2단계 압축 엔진 — T-01부터**

---

## 1. 한 줄 요약

PDF를 **브라우저 안에서만** 압축하는 정적 웹앱. 이미지 해상도·JPEG 품질만 낮추고 글자는 그대로 둔다. 사용자는 "몇 % 줄일지"만 고른다.

## 2. 확정된 결정

| 항목 | 결정 |
| --- | --- |
| 처리 위치 | 브라우저(Web Worker + WASM). 서버 없음, 업로드 없음 |
| 대상 | 외부 공개, PDF 1개씩, 최대 100MB |
| 압축 방식 | 이미지만 재압축(해상도 상한 + JPEG 품질), 글자·벡터·글꼴 유지 |
| 엔진 | MuPDF.js (npm `mupdf`, 확인 시점 1.28.1) — AGPL-3.0 |
| 라이선스 | 저장소 공개, AGPL-3.0, 화면 하단에 소스 링크 |
| 수익화 | 없음 → Vercel Hobby(무료) |
| 화면 언어 | 한국어. 문구는 `src/strings.ts`에 모음(영어 추가 대비) |
| 이름 | pdf-diet / 화면 이름 "PDF 다이어트" |

## 3. 계정·주소

| 항목 | 값 |
| --- | --- |
| GitHub | https://github.com/doit2/pdf-diet (public, main 브랜치) |
| 운영 주소 | https://pdf-diet.vercel.app (로그인 없이 공개 확인됨) |
| Vercel 프로젝트 | `pdf-diet` / id `prj_3o9xlYS3drwbBwOIJsgLnubnctHd` / 팀 slug `k4-6b88` |
| 자동 배포 | main push → 운영 배포, PR → 미리보기 주소 |
| CI | GitHub Actions `.github/workflows/ci.yml`: typecheck → test → build |
| 기획서 | Claude Docs "PDF 용량 줄이기 웹앱 기획서" https://claude.ai/artifact/14xmFP9miFdscjjpL1ULko |

연결 상태(다시 할 필요 없음): Claude GitHub 앱 설치됨(push 가능), Vercel ↔ GitHub 연결됨, Vercel 커넥터 연결됨, Claude 앱 내장 브라우저에 GitHub·Vercel 로그인됨.

## 4. 현재 코드 (1단계 완료)

```
index.html              lang=ko, 제목 "PDF 다이어트 — PDF 용량 줄이기"
vite.config.ts          React + Tailwind v4, worker ES 형식, __APP_VERSION__ 주입
vercel.json             CSP(connect-src 'self', wasm-unsafe-eval, worker blob:), assets 1년 캐시
src/App.tsx             "준비 중" 임시 화면 + 하단 소스 링크·버전
src/strings.ts          화면 문구
src/lib/format.ts       formatBytes (+ format.test.ts, Vitest 5개 통과)
```

버전: Node 22 / Vite 8.3 / React 19.3 / TypeScript 7.0 / Tailwind 4.3 / Vitest 5.0. 앱 버전 0.1.0.

## 5. 남은 단계

| 단계 | 내용 | 예상 토큰 |
| --- | --- | --- |
| **2. 엔진** | Worker + MuPDF, 이미지 재압축, 옵션 5종, 목표 % 탐색 | 30만 |
| 3. 화면 | 업로드 → 설정 → 처리 중(진행률·취소) → 결과 | 15만 |
| 4. 테스트 | 테스트 PDF 생성 스크립트, 엔진·화면 테스트(Playwright) | 20만 |
| 5. 배포·안정화 | 수동 점검(T-13), 릴리스 v1.0.0 | 15만 |

## 6. 2단계 작업 순서

1. **T-01**: `npm i mupdf` 후 MuPDF.js에 이미지 다시 쓰기 API(`pdf_rewrite_images` 대응)가 있는지 확인.
   - 있으면: 그 API로 해상도 상한·JPEG 품질 지정.
   - 없으면: 페이지별 이미지 XObject를 꺼내 Pixmap으로 축소 → JPEG 인코딩 → 스트림 교체(DCTDecode). 흑백(1비트) 이미지는 JPEG로 바꾸지 않는다.
2. `src/engine/` 구성: `compress.ts`(순수 로직), `worker.ts`(Comlink 노출), `client.ts`(UI용 래퍼, 취소 = worker.terminate()).
3. 옵션 5종:
   - 미사용 리소스 제거 → 저장 옵션 `garbage` + `clean`
   - 중복 객체 제거 → `garbage=deduplicate`
   - 문서 구조 압축 → `compress` (+ 지원 시 object streams)
   - 메타데이터 제거(기본 끔) → Info, XMP(Metadata) 삭제
   - 썸네일 제거 → 각 페이지 `Thumb` 삭제
4. 목표 % 탐색: 품질 단계표 6단계를 이진 탐색. 목표를 만족하는 가장 약한 단계를 고른다. 결과가 원본보다 크면 원본을 돌려준다.
5. **T-05**: 단계별 크기·화질 측정 후 단계표 수치 확정.

### 품질 단계표 (초안, T-05에서 조정)

| 단계 | 해상도 상한 | JPEG 품질 |
| --- | --- | --- |
| 1 | 200 DPI | 85 |
| 2 | 150 DPI | 75 |
| 3 | 120 DPI | 65 |
| 4 | 96 DPI | 55 |
| 5 | 72 DPI | 45 |
| 6 | 60 DPI | 35 |

## 7. 작업 규칙

- 커밋: 한국어 메시지, 작성자 `doit2 <joybuilder@gmail.com>`, 끝에 Co-Authored-By / Claude-Session 줄.
- push 전 `npm run typecheck && npm test && npm run build` 통과 확인.
- 배포 확인은 Vercel 커넥터 `list_deployments`(projectId `pdf-diet`)로 상태 READY 확인.
- 단계가 끝나면 이 파일과 README의 상태표를 갱신한다.
- 사용량 절약: 한 대화에 한 단계, 로그는 실패 부분만, 큰 PDF는 대화에 올리지 않음.
