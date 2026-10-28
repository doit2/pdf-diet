import { useRef, useState } from 'react'
import { t } from '../strings'

export function UploadView({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const depth = useRef(0) // 안쪽 요소를 지날 때 dragleave가 섞여 깜빡이는 것 방지

  return (
    <div
      data-testid="dropzone"
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDragLeave={() => { if (--depth.current <= 0) { depth.current = 0; setOver(false) } }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
      className={`rounded-2xl border-2 border-dashed px-6 py-14 sm:py-20 text-center transition-colors ${over ? 'border-teal-600 bg-teal-50' : 'border-stone-300 bg-white'}`}
    >
      <svg aria-hidden viewBox="0 0 48 48" className={`mx-auto h-12 w-12 ${over ? 'text-teal-700' : 'text-stone-400'}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 6H14a4 4 0 0 0-4 4v28a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V16z" />
        <path d="M28 6v10h10M24 34V22M19 27l5-5 5 5" />
      </svg>
      <p className="mt-4 text-lg font-medium text-stone-800">{over ? t.dropActive : t.dropTitle}</p>
      <p className="mt-2 text-sm text-stone-500">{t.dropOr}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-3 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {t.pick}
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label={t.pick}
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = '' // 같은 파일을 다시 골라도 change가 일어나게
        }}
      />
      <p className="mt-5 text-sm text-stone-500">{t.dropLimit}</p>
    </div>
  )
}
