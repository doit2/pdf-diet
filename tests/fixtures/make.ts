// 테스트 PDF 묶음을 tests/fixtures/out/ 에 쓴다 (git에 넣지 않음).
//   npm run fixtures          기본 8개
//   npm run fixtures -- big   95MB 파일도 (T-12, 수십 초 걸림)
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIXTURES, makeBig, type FixtureName } from './fixtures'

export const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'out')

export function writeFixtures(withBig = false): void {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const name of Object.keys(FIXTURES) as FixtureName[]) {
    const path = join(OUT_DIR, `${name}.pdf`)
    writeFileSync(path, FIXTURES[name]())
    console.log(`${name}.pdf`.padEnd(24), `${(statSync(path).size / 1024).toFixed(0)} KB`)
  }
  // 이름은 .pdf인데 PDF 머리말이 없는 파일 (비PDF 거부)
  writeFileSync(join(OUT_DIR, 'not-a-pdf.pdf'), 'hello, this is not a pdf\n')
  if (withBig) {
    const path = join(OUT_DIR, 'big-95mb.pdf')
    writeFileSync(path, makeBig(95))
    console.log('big-95mb.pdf'.padEnd(24), `${(statSync(path).size / 1048576).toFixed(1)} MB`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFixtures(process.argv.includes('big'))
}
