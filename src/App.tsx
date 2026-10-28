// 한 페이지 앱. 상태에 따라 업로드 → 설정 → 처리 중 → 결과 화면을 바꿔 보여 준다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from './strings'
import { DEFAULT_OPTIONS, startCompress, type CompressJob, type CompressOptions, type CompressResult, type Progress } from './engine/client'
import { errorCodeOf } from './engine/types'
import { checkFile, hasPdfHeader } from './lib/validate'
import { UploadView } from './components/UploadView'
import { SettingsView } from './components/SettingsView'
import { WorkingView } from './components/WorkingView'
import { ResultView } from './components/ResultView'

const REPO_URL = 'https://github.com/doit2/pdf-diet'

export type Screen =
  | { kind: 'upload' }
  | { kind: 'settings'; file: File }
  | { kind: 'working'; file: File; progress: Progress | null; pages: number | null }
  | { kind: 'done'; file: File; result: CompressResult; url: string; seconds: number; pages: number | null; target: number }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'upload' })
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [percent, setPercent] = useState(50)
  const [options, setOptions] = useState<CompressOptions>(DEFAULT_OPTIONS)
  const job = useRef<CompressJob | null>(null)

  // 결과 다운로드 주소(blob:)는 화면을 떠날 때 해제해 메모리를 돌려준다
  const doneUrl = screen.kind === 'done' ? screen.url : null
  useEffect(() => () => { if (doneUrl) URL.revokeObjectURL(doneUrl) }, [doneUrl])

  // 처리 중에 탭을 닫으려 하면 한 번 묻는다
  const working = screen.kind === 'working'
  useEffect(() => {
    if (!working) return
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [working])

  // 화면 밖에 파일을 떨어뜨려도 브라우저가 PDF를 열어 버리지 않게 막는다
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  const openFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const problem = checkFile(file)
    if (problem) {
      setNotice({ tone: 'error', text: t.fileProblem[problem] })
      return
    }
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
    if (!hasPdfHeader(head)) {
      setNotice({ tone: 'error', text: t.fileProblem['not-pdf'] })
      return
    }
    setNotice(files.length > 1 ? { tone: 'info', text: t.fileProblem.multiple } : null)
    setScreen({ kind: 'settings', file })
  }, [])

  const start = useCallback((file: File) => {
    setNotice(null)
    setScreen({ kind: 'working', file, progress: null, pages: null })
    const began = performance.now()
    let pages: number | null = null
    const j = startCompress(file, percent, options, (p) => {
      if (p.phase === 'analyze') pages = p.total
      setScreen((s) => (s.kind === 'working' && s.file === file ? { ...s, progress: p, pages } : s))
    })
    job.current = j
    j.promise.then(
      (result) => {
        if (job.current !== j) return
        job.current = null
        const url = URL.createObjectURL(new Blob([result.data as BlobPart], { type: 'application/pdf' }))
        const seconds = (performance.now() - began) / 1000
        setScreen({ kind: 'done', file, result, url, seconds, pages, target: percent })
      },
      (e) => {
        if (job.current !== j) return
        job.current = null
        const code = errorCodeOf(e)
        if (code === 'cancelled') {
          setNotice({ tone: 'info', text: t.cancelledNote })
          setScreen({ kind: 'settings', file })
        } else if (code === 'encrypted' || code === 'invalid-pdf' || code === 'too-large') {
          // 이 파일로는 다시 해도 안 되므로 처음 화면으로
          setNotice({ tone: 'error', text: t.engineError[code] })
          setScreen({ kind: 'upload' })
        } else {
          setNotice({ tone: 'error', text: t.engineError[code] })
          setScreen({ kind: 'settings', file })
        }
      },
    )
  }, [percent, options])

  const cancel = useCallback(() => job.current?.cancel(), [])

  const reset = useCallback(() => {
    setNotice(null)
    setScreen({ kind: 'upload' })
  }, [])

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 flex flex-col">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-10 pb-8 sm:pt-14">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            <button type="button" onClick={screen.kind === 'working' ? undefined : reset} className="cursor-default sm:cursor-pointer">
              {t.appName}
            </button>
          </h1>
          <p className="mt-2 text-stone-600">{t.tagline}</p>
        </header>

        {notice && (
          <div
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`mt-6 rounded-xl px-4 py-3 text-sm ${notice.tone === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-stone-100 text-stone-700 border border-stone-200'}`}
          >
            {notice.text}
          </div>
        )}

        <div className="mt-6">
          {screen.kind === 'upload' && <UploadView onFiles={openFiles} />}
          {screen.kind === 'settings' && (
            <SettingsView
              file={screen.file}
              percent={percent}
              onPercent={setPercent}
              options={options}
              onOptions={setOptions}
              onStart={() => start(screen.file)}
              onChangeFile={reset}
            />
          )}
          {screen.kind === 'working' && <WorkingView file={screen.file} progress={screen.progress} onCancel={cancel} />}
          {screen.kind === 'done' && (
            <ResultView
              file={screen.file}
              result={screen.result}
              url={screen.url}
              seconds={screen.seconds}
              pages={screen.pages}
              target={screen.target}
              onRetry={() => { setNotice(null); setScreen({ kind: 'settings', file: screen.file }) }}
              onNew={reset}
            />
          )}
        </div>
      </main>
      <footer className="w-full max-w-2xl mx-auto px-4 py-6 text-sm text-stone-500">
        <p>{t.privacy}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <a className="underline hover:text-stone-800" href={REPO_URL} target="_blank" rel="noreferrer">{t.source}</a>
          <span aria-hidden>·</span>
          <span>{t.license}</span>
          <span aria-hidden>·</span>
          <span>v{__APP_VERSION__}</span>
        </p>
      </footer>
    </div>
  )
}
