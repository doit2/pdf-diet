// 화면 테스트 전에 테스트 PDF 묶음을 만든다. dist/가 없으면 먼저 빌드하라고 알린다.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { writeFixtures, OUT_DIR } from '../fixtures/make'

export default function globalSetup(): void {
  if (!existsSync(join(process.cwd(), 'dist', 'index.html'))) {
    throw new Error('dist/가 없습니다. `npm run build`를 먼저 실행하세요 (npm run test:e2e는 자동으로 빌드합니다).')
  }
  const needBig = !!process.env.BIG && !existsSync(join(OUT_DIR, 'big-95mb.pdf'))
  writeFixtures(needBig)
}
