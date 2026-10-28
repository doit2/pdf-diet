// T-05 단계표 측정 (평소 테스트에서는 건너뜀). 문서별로 따로 실행한다(한 프로세스에서 많이 돌리면 WASM 메모리가 쌓임):
//   mkdir -p /tmp/m && for d in scan photo mixed; do DOC=$d MEASURE_OUT=/tmp/m npx vitest run src/engine/measure.test.ts; done
//   결과: /tmp/m/measure.txt, 스캔 글자 확대 캡처: /tmp/m/scan_L3~6.png
import { it } from 'vitest'
import { writeFileSync, appendFileSync } from 'node:fs'
import * as mupdf from 'mupdf'
import { compressAtLevel, analyzePdf } from './compress'
import { DEFAULT_OPTIONS, LEVELS } from './types'
import { makeTestPdf } from './testPdf'

const OUT = process.env.MEASURE_OUT!
const DOC = process.env.DOC!
const LINE = 'Invoice No. 2026-1028 Total 1,234,567 won. Payment due within 30 days. Tel 02-123-4567. Section 3.2 (b) applies. '

/** 글이 빽빽한 페이지를 300DPI 회색 이미지로 "스캔" (종이 결 잡음 포함) */
function scanPdf(): Uint8Array {
  const src = new mupdf.PDFDocument()
  const font = src.addSimpleFont(new mupdf.Font('Times-Roman'))
  let content = 'BT /F1 9 Tf 11 TL 50 800 Td '
  for (let i = 0; i < 65; i++) content += `(${(LINE + LINE).slice(i % 40, (i % 40) + 105)}) '`
  content += ' ET'
  src.insertPage(-1, src.addPage([0, 0, 595, 842], 0, { Font: { F1: font } }, content))
  const page = src.loadPage(0)
  const pix = page.toPixmap(mupdf.Matrix.scale(300 / 72, 300 / 72), mupdf.ColorSpace.DeviceGray, false, true)
  const px = pix.getPixels()
  let s = 7
  for (let i = 0; i < px.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    px[i] = Math.max(0, Math.min(255, px[i] * 0.92 + 12 + ((s >>> 24) - 128) / 10))
  }
  const out = new mupdf.PDFDocument()
  const im = new mupdf.Image(pix)
  const img = out.addImage(im)
  out.insertPage(-1, out.addPage([0, 0, 595, 842], 0, { XObject: { Im0: img } }, 'q 595 0 0 842 0 0 cm /Im0 Do Q'))
  const buf = out.saveToBuffer('compress').asUint8Array().slice()
  im.destroy(); pix.destroy(); page.destroy(); src.destroy(); out.destroy()
  return buf
}

function render(data: Uint8Array, dpi: number): Uint8ClampedArray {
  const doc = mupdf.Document.openDocument(data, 'application/pdf')
  const pg = doc.loadPage(0)
  const pix = pg.toPixmap(mupdf.Matrix.scale(dpi / 72, dpi / 72), mupdf.ColorSpace.DeviceRGB, false, true)
  const px = pix.getPixels().slice()
  pix.destroy(); pg.destroy(); doc.destroy()
  return px
}

function psnr(ref: Uint8ClampedArray, data: Uint8Array): number {
  const b = render(data, 150)
  let mse = 0
  for (let i = 0; i < ref.length; i++) mse += (ref[i] - b[i]) ** 2
  mse /= ref.length
  return mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse)
}

/** 글자 부분 확대(144DPI = 화면 200%) 캡처 */
function crop(data: Uint8Array, name: string) {
  const doc = mupdf.Document.openDocument(data, 'application/pdf')
  const pg = doc.loadPage(0)
  const pix = pg.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true)
  const w = pix.getWidth()
  const pp = pix.getPixels()
  const sub = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 420, 120], false)
  const sp = sub.getPixels()
  for (let y = 0; y < 120; y++) for (let x = 0; x < 420; x++) for (let c = 0; c < 3; c++) sp[(y * 420 + x) * 3 + c] = pp[((y + 90) * w + x + 95) * 3 + c]
  writeFileSync(`${OUT}/${name}.png`, sub.asPNG().slice())
  sub.destroy(); pix.destroy(); pg.destroy(); doc.destroy()
}

it.skipIf(!process.env.DOC)('measure', () => {
  const data =
    DOC === 'scan' ? scanPdf()
    : DOC === 'photo' ? makeTestPdf({ dpi: 300, widthIn: 7.5, heightIn: 10 })
    : makeTestPdf({ dpi: 200, widthIn: 4, heightIn: 3, pages: 2, duplicate: true })
  const sizes = analyzePdf(data)
  const ref = render(data, 150)
  const row = [`${DOC} 원본 ${(data.length / 1048576).toFixed(2)}MB`]
  for (let lv = 0; lv < LEVELS.length; lv++) {
    const t0 = Date.now()
    const out = compressAtLevel(data, lv, DEFAULT_OPTIONS, sizes)
    const pct = (100 - (out.data.length / data.length) * 100).toFixed(1)
    row.push(`L${lv} ${JSON.stringify(LEVELS[lv])}: ${(out.data.length / 1024).toFixed(0)}KB -${pct}% PSNR ${psnr(ref, out.data).toFixed(1)}dB ${Date.now() - t0}ms`)
    if (DOC === 'scan' && lv >= 3) crop(out.data, `scan_L${lv}`)
  }
  appendFileSync(`${OUT}/measure.txt`, row.join('\n  ') + '\n')
}, 600000)
