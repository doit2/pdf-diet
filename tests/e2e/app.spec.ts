// 화면·보안·성능 테스트 (기획서 7.2 T-08~T-12). 운영과 같은 CSP를 붙인 정적 서버에서 돈다.
import { test, expect, type Page } from '@playwright/test'
import { readFileSync, writeFileSync, openSync, ftruncateSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import * as mupdf from 'mupdf'
import { OUT_DIR } from '../fixtures/make'

const fixture = (name: string) => join(OUT_DIR, name)

async function open(page: Page, name: string) {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture(name))
}

/** 설정 화면에서 목표 %를 고르고 압축을 시작한다 */
async function compress(page: Page, percent: 25 | 50 | 75) {
  await expect(page.getByTestId('target-hint')).toBeVisible()
  await page.getByRole('button', { name: `${percent}%`, exact: true }).click()
  await expect(page.getByRole('button', { name: `${percent}%`, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '압축 시작' }).click()
}

async function waitDone(page: Page) {
  await expect(page.getByRole('heading', { name: '다 줄였습니다' })).toBeVisible()
}

async function reducedPercent(page: Page): Promise<number> {
  const text = await page.getByTestId('reduced').innerText()
  return Number(text.match(/(\d+)%/)![1])
}

function pdfTexts(data: Uint8Array): string[] {
  const doc = mupdf.Document.openDocument(data, 'application/pdf')
  const out = Array.from({ length: doc.countPages() }, (_, i) => doc.loadPage(i).toStructuredText('').asText())
  doc.destroy()
  return out
}

test.describe('T-08 업로드 → 50% → 다운로드', () => {
  test('T-08 사진 PDF가 목표만큼 줄고, 받은 파일이 올바른 PDF다', async ({ page }) => {
    await open(page, 'photo-heavy.pdf')
    await compress(page, 50)
    await waitDone(page)
    expect(await reducedPercent(page)).toBeGreaterThanOrEqual(50)
    await expect(page.getByTestId('note')).toHaveCount(0)

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: '다운로드' }).click()])
    expect(download.suggestedFilename()).toBe('photo-heavy_compressed.pdf')
    const data = new Uint8Array(readFileSync((await download.path())!))
    const original = readFileSync(fixture('photo-heavy.pdf'))
    expect(new TextDecoder().decode(data.slice(0, 5))).toBe('%PDF-')
    expect(data.length).toBeLessThanOrEqual(original.length * 0.5)
    expect(pdfTexts(data)).toHaveLength(20)
  })

  test('T-08 글자·표가 있는 PDF — 받은 파일의 글자가 원본과 같다', async ({ page }) => {
    await open(page, 'mixed.pdf')
    await compress(page, 50)
    await waitDone(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: '다운로드' }).click()])
    const data = new Uint8Array(readFileSync((await download.path())!))
    expect(pdfTexts(data)).toEqual(pdfTexts(new Uint8Array(readFileSync(fixture('mixed.pdf')))))
  })
})

test.describe('T-09 취소 · 다시 압축 · 새 파일', () => {
  test('T-09 처리 중 취소하면 Worker가 정리되고 설정 화면으로 돌아간다', async ({ page }) => {
    await open(page, 'photo-heavy.pdf')
    await compress(page, 75)
    const cancel = page.getByRole('button', { name: '취소' })
    await expect(cancel).toBeVisible()
    await expect.poll(() => page.workers().length).toBeGreaterThan(0)
    await cancel.click()
    await expect(page.getByRole('status').filter({ hasText: '취소했습니다.' })).toBeVisible()
    await expect(page.getByRole('button', { name: '압축 시작' })).toBeVisible()
    await expect.poll(() => page.workers().length, { timeout: 10_000 }).toBe(0)
  })

  test('T-09 다른 설정으로 다시 → 더 줄이기, 새 파일 → 처음 화면', async ({ page }) => {
    await open(page, 'photo-heavy.pdf')
    await compress(page, 25)
    await waitDone(page)
    const first = await reducedPercent(page)
    expect(first).toBeGreaterThanOrEqual(25)

    await page.getByRole('button', { name: '다른 설정으로 다시' }).click()
    await expect(page.getByText('photo-heavy.pdf')).toBeVisible() // 같은 파일 그대로
    await compress(page, 75)
    await waitDone(page)
    expect(await reducedPercent(page)).toBeGreaterThanOrEqual(75)
    await expect.poll(() => page.workers().length, { timeout: 10_000 }).toBe(0)

    await page.getByRole('button', { name: '새 파일' }).click()
    await expect(page.getByTestId('dropzone')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('T-10 오류 파일과 안내 문구', () => {
  const alertText = (page: Page) => page.getByRole('alert')

  test('T-10 이름만 .pdf인 비PDF는 업로드 단계에서 거부', async ({ page }) => {
    await open(page, 'not-a-pdf.pdf')
    await expect(alertText(page)).toHaveText('PDF 파일만 올릴 수 있습니다.')
    await expect(page.getByTestId('dropzone')).toBeVisible()
  })

  test('T-10 PDF가 아닌 확장자도 거부', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
    await expect(alertText(page)).toHaveText('PDF 파일만 올릴 수 있습니다.')
  })

  test('T-10 빈 파일 거부', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type=file]').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) })
    await expect(alertText(page)).toHaveText('빈 파일입니다.')
  })

  test('T-10 100MB 초과 거부', async ({ page }) => {
    // 실제 내용 없이 크기만 큰 파일(희소 파일)을 만든다
    const path = fixture('over-100mb.pdf')
    writeFileSync(path, '%PDF-1.7\n')
    const fd = openSync(path, 'r+')
    ftruncateSync(fd, 100 * 1024 * 1024 + 1)
    closeSync(fd)
    await page.goto('/')
    await page.locator('input[type=file]').setInputFiles(path)
    await expect(alertText(page)).toHaveText('100MB 이하의 PDF만 처리할 수 있습니다.')
  })

  test('T-10 암호 걸린 PDF는 처음 화면 + 안내', async ({ page }) => {
    await open(page, 'encrypted.pdf')
    await compress(page, 50)
    await expect(alertText(page)).toHaveText('암호가 걸린 PDF는 지원하지 않습니다.')
    await expect(page.getByTestId('dropzone')).toBeVisible()
  })

  test('T-10 손상된 PDF는 복구되거나 손상 안내 (메모리 부족 문구가 아님)', async ({ page }) => {
    await open(page, 'broken.pdf')
    await compress(page, 50)
    const done = page.getByRole('heading', { name: '다 줄였습니다' })
    const broken = alertText(page).filter({ hasText: '손상되었거나 올바르지 않은 PDF입니다.' })
    await expect(done.or(broken)).toBeVisible()
    await expect(page.getByText('메모리가 부족할 수 있으니')).toHaveCount(0)
  })

  test('T-10 글자만 있는 PDF는 목표 미달·이미지 적음 안내', async ({ page }) => {
    await open(page, 'text-only.pdf')
    await compress(page, 50)
    await waitDone(page)
    await expect(page.getByTestId('note')).toContainText(/이미지가 적은 PDF|이미 최적화된 파일/)
  })
})

test.describe('T-11 보안', () => {
  test('T-11 처리 중 파일 데이터가 밖으로 나가는 요청 0건', async ({ page, context, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const requests: { url: string; method: string; body: number }[] = []
    context.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postDataBuffer()?.length ?? 0 }))

    const response = await page.goto('/')
    expect(response!.headers()['content-security-policy']).toContain("connect-src 'self'")
    await page.locator('input[type=file]').setInputFiles(fixture('mixed.pdf'))
    await compress(page, 50)
    await waitDone(page)
    await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: '다운로드' }).click()])

    const outside = requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'))
    expect(outside, '다른 주소로 간 요청').toEqual([])
    expect(requests.filter((r) => r.method !== 'GET' || r.body > 0), 'GET 말고 보낸 요청').toEqual([])
    // 원본 PDF(9MB)를 담을 만한 요청이 없어야 한다
    expect(requests.every((r) => r.body === 0)).toBe(true)
  })
})

test.describe('화면 폭', () => {
  test('360px 폭에서 가로 넘침 없음 (업로드·설정·결과)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    const noOverflow = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.goto('/')
    await noOverflow()
    await page.locator('input[type=file]').setInputFiles(fixture('with-thumbs-meta.pdf'))
    await expect(page.getByTestId('target-hint')).toBeVisible()
    await page.getByText('고급 옵션').click()
    await noOverflow()
    await page.getByRole('button', { name: '압축 시작' }).click()
    await waitDone(page)
    await noOverflow()
  })
})

test.describe('모바일 메모리 안내', () => {
  test('메모리 2GB 기기에서 30MB PDF는 안내, PC는 안내 없음', async ({ page, browser, baseURL }) => {
    await open(page, 'photo-heavy.pdf')
    await expect(page.getByTestId('target-hint')).toBeVisible()
    await expect(page.getByTestId('memory-note')).toHaveCount(0)

    const ctx = await browser.newContext({ baseURL })
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }))
    const low = await ctx.newPage()
    await open(low, 'photo-heavy.pdf')
    await expect(low.getByTestId('memory-note')).toBeVisible()
    await expect(low.getByRole('button', { name: '압축 시작' })).toBeEnabled()
    await ctx.close()
  })
})

test.describe('T-12 성능 (BIG=1일 때만)', () => {
  test.skip(!process.env.BIG, 'BIG=1로 실행하면 95MB 파일로 확인합니다')
  test.setTimeout(300_000)

  test('T-12 95MB PDF를 60초 안에, 화면 멈춤 없이', async ({ page }) => {
    await open(page, 'big-95mb.pdf')
    const started = Date.now()
    await compress(page, 50)

    // 처리 중에도 화면 스레드가 응답하는지: 2초마다 왕복 시간을 잰다
    const lags: number[] = []
    const done = page.getByRole('heading', { name: '다 줄였습니다' })
    while (!(await done.isVisible())) {
      const t0 = Date.now()
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
      lags.push(Date.now() - t0)
      if (Date.now() - started > 240_000) break
      await page.waitForTimeout(2000)
    }
    await waitDone(page)
    const seconds = (Date.now() - started) / 1000
    test.info().annotations.push(
      { type: 'seconds', description: seconds.toFixed(1) },
      { type: 'max-frame-ms', description: String(Math.max(...lags)) },
      { type: 'result', description: (await page.getByTestId('sizes').innerText()).replace(/\s+/g, ' ') },
    )
    console.log(`T-12: ${seconds.toFixed(1)}s, 최대 프레임 지연 ${Math.max(...lags)}ms, ${(await page.getByTestId('sizes').innerText()).replace(/\s+/g, ' ')}`)
    expect(Math.max(...lags), '화면 멈춤').toBeLessThan(1000)
    expect(seconds).toBeLessThan(60)
  })
})
