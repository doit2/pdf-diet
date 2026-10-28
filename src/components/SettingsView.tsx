import { t } from '../strings'
import type { CompressOptions } from '../engine/types'
import { formatBytes } from '../lib/format'
import { targetBytes } from '../lib/validate'
import { FileCard } from './FileCard'

const QUICK = [25, 50, 75]
const OPTION_ORDER: (keyof CompressOptions)[] = ['removeUnused', 'compressStructure', 'dedupe', 'removeThumbnails', 'removeMetadata']

interface Props {
  file: File
  percent: number
  onPercent: (p: number) => void
  options: CompressOptions
  onOptions: (o: CompressOptions) => void
  onStart: () => void
  onChangeFile: () => void
}

export function SettingsView({ file, percent, onPercent, options, onOptions, onStart, onChangeFile }: Props) {
  return (
    <div className="space-y-6">
      <FileCard
        file={file}
        action={
          <button type="button" onClick={onChangeFile} className="shrink-0 rounded-lg px-3 py-2 text-sm text-stone-600 underline hover:text-stone-900">
            {t.changeFile}
          </button>
        }
      />

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">{t.targetLabel}</h2>
        <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={t.targetLabel}>
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={percent === q}
              onClick={() => onPercent(q)}
              className={`rounded-xl border py-3 text-lg font-semibold tabular-nums ${percent === q ? 'border-teal-700 bg-teal-700 text-white' : 'border-stone-300 bg-white text-stone-800 hover:border-stone-500'}`}
            >
              {q}%
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-4">
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={percent}
            onChange={(e) => onPercent(Number(e.target.value))}
            aria-label={t.slider}
            className="w-full accent-teal-700"
          />
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{percent}%</span>
        </div>
        <p className="mt-3 text-sm text-stone-600" data-testid="target-hint">
          {t.targetHint(percent, formatBytes(targetBytes(file.size, percent)))}
        </p>
      </section>

      <details className="group rounded-2xl border border-stone-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold">
          {t.advanced}
          <span aria-hidden className="text-stone-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <ul className="space-y-1 px-3 pb-3">
          {OPTION_ORDER.map((key) => {
            const [label, help] = t.options[key]
            return (
              <li key={key}>
                <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 hover:bg-stone-50">
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) => onOptions({ ...options, [key]: e.target.checked })}
                    className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
                  />
                  <span>
                    <span className="block">{label}</span>
                    <span className="block text-sm text-stone-500">{help}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </details>

      <div>
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-xl bg-teal-700 py-4 text-lg font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          {t.start}
        </button>
        <p className="mt-2 text-center text-xs text-stone-500">{t.firstLoadNote}</p>
      </div>
    </div>
  )
}
