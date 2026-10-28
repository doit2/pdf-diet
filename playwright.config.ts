// 화면 테스트 (기획서 7.2 T-08~T-12). 실행: npm run test:e2e
//   E2E_ALL=1   Firefox·WebKit도 실행 (T-08 3개 브라우저)
//   BIG=1       95MB 성능 테스트(T-12)도 실행
//   PW_CHROMIUM_PATH=/path/chrome   Playwright 브라우저를 내려받을 수 없는 환경에서 쓸 크로미움
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const chromiumPath = process.env.PW_CHROMIUM_PATH

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 120_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1, // 큰 PDF를 브라우저 여러 개가 동시에 처리하면 메모리가 모자랄 수 있다
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath, args: ['--no-sandbox'] } } : {}),
      },
    },
    ...(process.env.E2E_ALL
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /T-08/ },
          { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /T-08/ },
        ]
      : []),
  ],
  webServer: {
    command: `node tests/e2e/server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
