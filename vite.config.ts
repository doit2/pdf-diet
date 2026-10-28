/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
  worker: { format: 'es' },
  build: { target: 'es2022' },
  test: {
    // 화면 테스트(tests/e2e)는 Playwright가 돌린다
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    testTimeout: 60_000,
  },
})
