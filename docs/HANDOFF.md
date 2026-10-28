# 인계 메모 (HANDOFF)

새 대화는 이 파일만 먼저 읽고 시작한다. 단계가 끝날 때마다 갱신한다.

- 최종 갱신: 2026-10-29 (4단계 테스트 완료)
- 다음 할 일: **5단계 배포·안정화** (아래 '10. 5단계 시작 메모')

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
| 기획서 | [docs/PLAN.md](./PLAN.md) (사본) / 원본: Claude Docs "PDF 용량 줄이기 웹앱 기획서" https://claude.ai/artifact/14xmFP9miFdscjjpL1ULko |

연결 상태(다시 할 필요 없음): Claude GitHub 앱 설치됨(push 가능), Vercel ↔ GitHub 연결됨, Vercel 커넥터 연결됨, Claude 앱 내장 브라우저에 GitHub·Vercel 로그인됨.

## 4. 현재 코드 (4단계 완료)

```
index.html              lang=ko, 제목 "PDF 다이어트 — PDF 용량 줄이기"
vite.config.ts          React + Tailwind v4, worker ES 형식, __APP_VERSION__ 주입
vercel.json             CSP(connect-src 'self', wasm-unsafe-eval, worker blob:), assets 1년 캐시
src/App.tsx             화면 상태(upload→settings→working→done), 엔진 호출·취소·오류 처리, 하단 안내·소스 링크·버전
src/components/         UploadView(드래그·선택) / SettingsView(목표 %·고급 옵션) / WorkingView(진행률·취소) / ResultView(전후 크기·다운로드) / FileCard
src/strings.ts          화면 문구 전부 (오류 코드·파일 검사 문구 포함), outputName(원본이름_compressed.pdf)
src/lib/format.ts       formatBytes (+ format.test.ts)
src/lib/validate.ts     파일 검사(T-03: 형식·빈 파일·100MB, %PDF- 머리말), 목표 크기·감소율 계산 (+ validate.test.ts)
src/lib/progress.ts     엔진 Progress → 0~1 (분석 10% + 시도 최대 4회로 나눔)
src/engine/types.ts     옵션·단계표(LEVELS 0~6)·결과·오류 코드(EngineError)
src/engine/compress.ts  순수 로직: analyze(표시 크기 측정) / compressAtLevel / compressToTarget(이진 탐색)
src/engine/search.ts    목표 % 이진 탐색(searchLevels). 최종 후보 결과만 들고 있음
src/engine/worker.ts    Comlink 노출(analyze / compressLevel 각 1회). mupdf는 동적 import
src/engine/client.ts    startCompress(file, %, opts, onProgress) → {promise, cancel}. 분석·단계 시도마다 새 Worker
src/engine/testPdf.ts   테스트용 PDF 생성기(사진/회색/CMYK/SMask/1비트/중복/메타데이터/썸네일/암호)
src/engine/compress.test.ts, search.test.ts  엔진 테스트 28개 (전체 43개 통과)
src/engine/measure.test.ts  T-05 단계표 측정 (DOC 환경변수 있을 때만 실행)
tests/fixtures/fixtures.ts  기획서 7.1 묶음 생성 함수(FIXTURES) + makeBig(95MB)
tests/fixtures/make.ts      묶음을 tests/fixtures/out/에 씀 (git 제외). `npm run fixtures [-- big]`
tests/engine/fixtures.test.ts  묶음으로 엔진 확인 21개: T-04 옵션 단독, T-06 글자 보존(단계 0~6), T-07, photo-heavy 50·75%, scan-like, 암호, 손상
tests/e2e/server.mjs        dist/ + vercel.json 헤더 그대로 붙이는 정적 서버 (GET/HEAD만 받음)
tests/e2e/global-setup.ts   묶음 생성 (BIG=1이면 95MB도)
tests/e2e/app.spec.ts       Playwright 14개: T-08~T-12, 360px 폭
playwright.config.ts        chromium 기본, E2E_ALL=1이면 firefox·webkit(T-08만), PW_CHROMIUM_PATH로 브라우저 지정
```

버전: Node 22 / Vite 8.3 / React 19.3 / TypeScript 7.0 / Tailwind 4.3 / Vitest 5.0 / Playwright 1.64. 앱 버전 0.3.0.
테스트: Vitest 64개 통과(+측정 1개 건너뜀), Playwright Chromium 13개 통과(+T-12는 BIG=1일 때).

## 5. 남은 단계

| 단계 | 내용 | 예상 토큰 |
| --- | --- | --- |
| 2. 엔진 (완료) | Worker + MuPDF, 이미지 재압축, 옵션 5종, 목표 % 탐색 | 30만 |
| 3. 화면 (완료) | 업로드 → 설정 → 처리 중(진행률·취소) → 결과 | 15만 |
| 4. 테스트 (완료) | 테스트 PDF 생성 스크립트, 엔진·화면 테스트(Playwright) | 20만 |
| **5. 배포·안정화** | 수동 점검(T-13), 릴리스 v1.0.0 | 15만 |

## 6-1. 2단계 진행 상황 (2026-10-28)

완료
- **T-01 결론**: MuPDF.js 1.28.1에는 `pdf_rewrite_images` 대응 API·저장 옵션이 **없음** → 대안 경로로 구현.
  이미지 XObject → `loadImage` → `toPixmap` → `Pixmap.warp`로 축소 → `asJPEG` → `writeRawStream` + DCTDecode.
  1비트·ImageMask·색상키 Mask·JBIG2·CCITT·64×64 미만은 건드리지 않음. 새 스트림이 5% 이상 작을 때만 교체.
- DPI는 페이지를 Device로 실행해 **이미지별 실제 표시 크기**로 계산(SMask는 본 이미지 크기 상속). 그려지지 않는 이미지는 손대지 않음.
- 옵션 5종, 목표 % 이진 탐색(단계 0 = 이미지 그대로·구조만 정리 추가), 원본보다 크면 원본 반환.
- 헤드리스 크로미움 + 운영 CSP로 확인: 9.3MB → 247KB(0.9초), 취소·잘못된 파일 오류 정상.

확인된 함정 (코드에 주석 있음)
- `saveToBuffer().asUint8Array()`는 WASM 메모리를 가리킴 → 반드시 `.slice()` 복사.
- `isStream()`·`writeRawStream()`은 `resolve()`한 객체가 아니라 간접 참조(ref)에서 호출.
- `garbage=deduplicate`(3)는 스트림 중복을 못 잡음 → `garbage=4` 사용.
- Worker에서 mupdf를 정적 import하면 WASM 로딩(top-level await) 중 온 요청이 버려짐 → 동적 import.
- 저장 옵션에 object-streams 없음(이 빌드). WASM 10.4MB(gzip 4.8MB), Worker 생성 때만 받음.

**T-02b 메모리 누수 — 해결 (사용자 결정: A안)**
- 원인: 같은 WASM 인스턴스에서 압축을 반복하면 `toPixmap` 경로 메모리가 시도마다 약 100MB씩 쌓임(상한 2GB). `emptyStore()`·GC로도 안 줄어듦.
- 대책: client.ts가 이진 탐색을 돌리고 **분석 1회 + 단계 시도마다 새 Worker**를 만들어 끝나면 terminate. 시도당 WASM 재초기화 비용은 작음(9.3MB 사진 PDF 전체 1.7초, Worker 4개).
- 분석 쪽 누수(장치 콜백 이미지 래퍼)는 즉시 destroy로 해결.
- 브라우저 확인(운영 CSP): 결과 정상, 끝나면 Worker 0개, 취소 시 진행 중 Worker 종료·이후 시도 없음.

**T-05 측정 결과 (2026-10-28, `src/engine/measure.test.ts`, 사용법은 파일 머리말)**

스캔형(9pt 글자 페이지를 300DPI 회색 이미지로 + 잡음, 5.6MB) — 판단 기준 문서

| 단계 | 크기 | 감소 | 9pt 글자 (144DPI 확대 육안) |
| --- | --- | --- | --- |
| 1 (200/85) | 1044KB | -81.8% | 선명 |
| 2 (150/75) | 490KB | -91.5% | 선명 |
| 3 (120/65) | 302KB | -94.7% | 선명 |
| 4 (96/55) | 185KB | -96.8% | 읽힘, 약간 흐림 |
| 5 (72/45) | 100KB | -98.3% | 대체로 읽히나 **숫자 혼동**(4→1 등) |
| 6 (60/35) | 63KB | -98.9% | **읽을 수 없음** |

- 사진·혼합 예제는 합성 이미지라 지나치게 잘 줄어(-97~99%) 단계표 근거로는 약함. 실제 사진 PDF로 4단계에서 재확인 필요.
- 처리 시간: 페이지당 0.1~0.9초(Node).
- **발견·수정한 버그**: ICC 회색 이미지를 `asJPEG`하면 3색 JPEG가 나와 PDF 색공간(1색)과 어긋나 화면이 밀려 보였음.
  → JPEG 헤더 색 수를 확인해 다르면 Device 색공간으로 다시 만들고, 그래도 다르면 원본 유지. 회귀 테스트 추가.
- **결정(사용자, A안)**: 단계 5·6 하한을 올림 → 5 = 88DPI/50 (151KB, -97.4%), 6 = 80DPI/45 (120KB, -97.9%). 6에서도 9pt 숫자 판독 확인.
- **3단계 화면에 반영할 것**: 목표를 못 채우면(`targetMet=false`) "글자가 읽히는 범위에서 이 이상 줄이기 어렵습니다 — 결과 n% 감소"처럼 안내.

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

### 품질 단계표 (확정, `src/engine/types.ts` LEVELS)

| 단계 | 해상도 상한 | JPEG 품질 |
| --- | --- | --- |
| 0 | 이미지 그대로 (구조만 정리) | - |
| 1 | 200 DPI | 85 |
| 2 | 150 DPI | 75 |
| 3 | 120 DPI | 65 |
| 4 | 96 DPI | 55 |
| 5 | 88 DPI | 50 |
| 6 | 80 DPI | 45 |

## 7. 작업 규칙

- 커밋: 한국어 메시지, 작성자 `doit2 <joybuilder@gmail.com>`, 끝에 Co-Authored-By / Claude-Session 줄.
- push 전 `npm run typecheck && npm test && npm run build` 통과 확인.
- 배포 확인은 Vercel 커넥터 `list_deployments`(projectId `pdf-diet`, slug `k4-6b88`)로 READY 확인.
  커넥터가 403(팀 접근 만료)이면 `authorize_team_access`(teamId `team_RxwKOBgTofukr4wbK5sP4pvA`) 링크를 사용자에게 주거나,
  `gh api repos/doit2/pdf-diet/commits/<sha>/statuses`로 Vercel 상태(success)를 확인해도 된다.
- 단계가 끝나면 이 파일과 README의 상태표를 갱신한다.
- 사용량 절약: 한 대화에 한 단계, 로그는 실패 부분만, 큰 PDF는 대화에 올리지 않음.

## 8. 3단계 시작 메모 (화면) — 완료, 아래 8-1 참고

- 진입점: `src/App.tsx`의 "준비 중" 화면을 교체. 문구는 모두 `src/strings.ts`.
- 엔진 호출: `startCompress(file, %, opts, onProgress)` → `{promise, cancel}` (`src/engine/client.ts`). 취소는 `cancel()`.
- 흐름: 업로드(드래그·선택, PDF 1개, 100MB 상한) → 설정(목표 %, 옵션 5종, 메타데이터 제거 기본 끔) → 처리 중(진행률·취소) → 결과(전/후 크기, 다운로드, 다시 하기).
- 결과에서 `targetMet=false`면 "글자가 읽히는 범위에서 이 이상 줄이기 어렵습니다 — 결과 n% 감소" 안내.
- 오류는 `EngineError` 코드별 문구(암호 PDF, 손상 파일 등)를 strings.ts에 둔다.
- 끝나면 헤드리스 크로미움 + 운영 CSP로 한 번 확인 후 push, 이 파일·README 상태표 갱신.

## 8-1. 3단계 결과 (2026-10-29)

- 화면 4단계 구현. 처리 중 탭 닫기 경고(beforeunload), 화면 밖에 파일을 떨어뜨려도 브라우저가 PDF를 열지 않게 막음.
- 오류 처리: 암호·손상·용량 초과 → 처음 화면 + 안내 / 그 밖의 실패(메모리 부족 등) → 설정 화면 + 안내 / 취소 → 설정 화면 "취소했습니다".
- 목표 미달(`targetMet=false`) 안내, 이미지가 없거나 하나도 못 줄였으면 "이미지가 적은 PDF" 문구 추가, `usedOriginal`이면 "이미 최적화된 파일" 안내.
- 설정 화면에 페이지 수는 표시하지 않음(엔진을 미리 띄워야 해서). 페이지 수는 분석 진행에서 받아 결과 화면에 표시.
- 확인(헤드리스 크로미움 1.63 + vercel.json CSP를 그대로 붙인 정적 서버): 비PDF 거부, 11.9MB 사진 PDF 50% → 321KB(1.5초)·다운로드 파일명/머리말 정상,
  다시 압축(90%), 취소, 글자만 PDF(목표 미달 안내), 암호·손상 PDF 안내, 360px 폭 가로 넘침 없음, 외부 요청 0건.
  손상 PDF에서 MuPDF가 콘솔에 경고(repair 등)를 찍는 것은 정상.
- 확인용 스크립트는 저장소에 넣지 않았음 → 4단계에서 Playwright 테스트로 정식화.

## 9. 4단계 시작 메모 (테스트) — 완료, 아래 9-1 참고

- 테스트 PDF: `src/engine/testPdf.ts`의 `makeTestPdf`로 기획서 7.1 묶음 생성(`tests/fixtures/make.ts`). 큰 파일(95MB)은 커밋하지 말고 실행 때 생성.
- Playwright: 정적 서버에 vercel.json 헤더를 그대로 붙여 운영 CSP로 돌릴 것(`vite preview`는 헤더를 안 붙임).
  셀렉터: `input[type=file]`, 버튼 이름(압축 시작/취소/다른 설정으로 다시/새 파일/다른 파일), `data-testid` = dropzone, target-hint, sizes, reduced, note.
- 항목: T-04·T-06·T-07(엔진), T-08~T-11(화면·보안), T-12(95MB 성능). CI에 Playwright 추가(Chromium부터, Firefox·WebKit는 시간 보고 결정).

## 9-1. 4단계 결과 (2026-10-29)

- 테스트 PDF 묶음 9종을 스크립트로 생성(저작권 문제 없음). photo-heavy는 100MB 상한 안에 들도록 20장 × 3×2인치 300DPI(30MB).
  `testPdf.ts`에 옵션 추가: `kind: 'none'`(글자만), `lines`(줄마다 다른 본문), `table`(벡터 표 + 칸 글자), `sameImage`(같은 그림을 쪽마다 별도 객체로).
- **발견·수정한 버그 (T-10)**: 끝이 잘린 PDF는 복구로 열리지만 저장 옵션 `clean`에서 MuPDF가 "not a dict (null)"을 던져
  날것의 오류가 화면까지 가서 **"메모리가 부족할 수 있으니…" 문구**가 나왔음. clean을 빼고 다시 저장하면 이번엔 "페이지 트리 순환"이 있는 깨진 PDF가 나옴.
  → `compress.ts`: `saveRepairing()`(clean 빼고 재시도) + 복구로 연 파일은 결과를 다시 열어 모든 페이지를 불러 보는 `checkReopens()`. 실패하면 `invalid-pdf`("손상되었거나 올바르지 않은 PDF").
  수정 전 코드로 T-10 손상 테스트가 실패하는 것 확인 후 수정.
- 결과(Chromium, 운영 CSP): T-08 photo-heavy 50% 달성·파일명·%PDF- 확인, mixed 다운로드 파일 글자 = 원본. T-09 취소 후 Worker 0개.
  T-10 비PDF·빈 파일·100MB 초과·암호·손상·글자만 안내. T-11 외부 요청 0건, GET 외 요청 0건. 360px 가로 넘침 없음.
- **T-12 (95MB, 2코어·7GB 컨테이너의 헤드리스 Chromium 153)**: 96.5MB → 7.2MB(93% 감소), **14.6초**, 처리 중 최대 프레임 지연 38ms. 60초 기준 통과.
- 정리된 확인 사항: 세 쪽이 같은 1비트 스캔 이미지는 중복 제거로 1개가 된다(정상).
- CI: `e2e`(Chromium, T-08~T-11) + `e2e-browsers`(Firefox·WebKit에서 T-08). 실패하면 playwright-report를 아티팩트로 올림.
- 작업 환경 메모: 이 대화 환경에서는 cdn.playwright.dev가 막혀 `npx playwright install`이 안 됨 →
  npm `@sparticuz/chromium`의 크로미움을 `PW_CHROMIUM_PATH=/tmp/chromium`으로 지정해 실행했다. CI는 정상 설치.

## 10. 5단계 시작 메모 (배포·안정화)

- T-13 수동 점검: 실제 PC·Android·iPhone에서 운영 주소로 압축 → 결과 PDF를 Acrobat·브라우저로 열어 깨짐·글자 선택 확인. 실제 사진 PDF로 단계표(4~6) 화질 재확인.
- 모바일 상한: T-12는 PC 기준. 모바일에서 50MB 이상이 되는지 확인하고, 안 되면 기기 메모리(`navigator.deviceMemory`) 기반 경고 문구 추가 검토.
- 릴리스: package.json 1.0.0, Git 태그 v1.0.0, README 정리. Firefox·WebKit CI 결과 확인.
