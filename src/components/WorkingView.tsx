import { t } from '../strings'
import type { Progress } from '../engine/types'
import { overallProgress } from '../lib/progress'
import { FileCard } from './FileCard'

const BIG_FILE = 30 * 1024 * 1024

export function WorkingView({ file, progress, onCancel }: { file: File; progress: Progress | null; onCancel: () => void }) {
  const ratio = progress ? overallProgress(progress) : 0
  const pct = Math.round(ratio * 100)

  let detail = ''
  if (progress) {
    if (progress.phase === 'analyze' && progress.total > 0) detail = t.pageCount(progress.done, progress.total)
    if (progress.phase === 'images' || progress.phase === 'save') {
      detail = t.attemptInfo(progress.attempt, progress.level)
      if (progress.phase === 'images' && progress.total > 0) detail += ` · ${t.imageCount(progress.done, progress.total)}`
    }
  }

  return (
    <div className="space-y-6">
      <FileCard file={file} />
      <section className="rounded-2xl border border-stone-200 bg-white p-5" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">{progress ? t.phase[progress.phase] : t.working}</h2>
          <span className="tabular-nums text-stone-500">{pct}%</span>
        </div>
        <div
          className="mt-4 h-3 overflow-hidden rounded-full bg-stone-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t.working}
        >
          <div className="h-full rounded-full bg-teal-600 transition-[width] duration-300" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
        <p className="mt-3 min-h-5 text-sm text-stone-600 tabular-nums">{detail}</p>
        {file.size >= BIG_FILE && <p className="mt-1 text-sm text-stone-500">{t.bigFileNote}</p>}
      </section>
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-xl border border-stone-300 bg-white py-3 font-semibold text-stone-700 hover:border-stone-500"
      >
        {t.cancel}
      </button>
    </div>
  )
}
