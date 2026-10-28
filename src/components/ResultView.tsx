import { outputName, t } from '../strings'
import type { CompressResult } from '../engine/types'
import { formatBytes } from '../lib/format'
import { reductionPercent } from '../lib/validate'

interface Props {
  file: File
  result: CompressResult
  url: string
  seconds: number
  pages: number | null
  target: number
  onRetry: () => void
  onNew: () => void
}

export function ResultView({ file, result, url, seconds, pages, target, onRetry, onNew }: Props) {
  const actual = reductionPercent(result.originalSize, result.size)
  const fewImages = result.imagesTotal === 0 || result.imagesRewritten === 0

  let note: string | null = null
  if (result.usedOriginal) note = t.usedOriginal
  else if (!result.targetMet) note = fewImages ? `${t.targetMissed(target, actual)} ${t.textOnlyHint}` : t.targetMissed(target, actual)

  const facts = [
    result.level !== null ? t.levelInfo(result.level) : null,
    result.imagesTotal > 0 ? t.imagesInfo(result.imagesRewritten, result.imagesTotal) : null,
    pages ? t.pages(pages) : null,
    t.elapsed(seconds.toFixed(1)),
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-teal-800">{t.doneTitle}</h2>
        <p className="mt-1 truncate text-sm text-stone-500" title={file.name}>{file.name}</p>
        <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2" data-testid="sizes">
          <span className="text-xl text-stone-500 line-through decoration-stone-300 tabular-nums">{formatBytes(result.originalSize)}</span>
          <span aria-hidden className="text-stone-400 text-xl">→</span>
          <span className="text-4xl font-bold tabular-nums">{formatBytes(result.size)}</span>
          <span className={`mb-1 rounded-full px-3 py-1 text-sm font-semibold ${actual > 0 ? 'bg-teal-100 text-teal-800' : 'bg-stone-100 text-stone-600'}`} data-testid="reduced">
            {t.reduced(actual)}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200" aria-hidden>
          <div className="h-full bg-teal-600" style={{ width: `${Math.max(100 - actual, 1)}%` }} />
        </div>
        <p className="mt-4 text-sm text-stone-600">{facts.join(' · ')}</p>
        {note && (
          <p role="status" className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900" data-testid="note">
            {note}
          </p>
        )}
      </section>

      <a
        href={url}
        download={outputName(file.name)}
        className="block w-full rounded-xl bg-teal-700 py-4 text-center text-lg font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {t.download}
      </a>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onRetry} className="rounded-xl border border-stone-300 bg-white py-3 font-semibold text-stone-700 hover:border-stone-500">
          {t.retry}
        </button>
        <button type="button" onClick={onNew} className="rounded-xl border border-stone-300 bg-white py-3 font-semibold text-stone-700 hover:border-stone-500">
          {t.newFile}
        </button>
      </div>
    </div>
  )
}
