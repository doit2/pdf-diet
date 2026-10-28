// 화면에서 쓰는 압축 래퍼.
// - 분석 1회 + 단계 시도마다 새 Worker를 만들고, 끝나면 바로 없앤다
//   (같은 WASM 인스턴스에서 반복하면 메모리가 쌓이므로 — HANDOFF T-02b).
// - 취소 = 지금 돌고 있는 Worker를 terminate()하고 이후 시도를 막는다.
import * as Comlink from 'comlink'
import type { WorkerApi } from './worker'
import { searchLevels } from './search'
import {
  DEFAULT_OPTIONS,
  EngineError,
  MAX_INPUT_BYTES,
  errorCodeOf,
  type CompressOptions,
  type CompressResult,
  type Progress,
} from './types'

export interface CompressJob {
  promise: Promise<CompressResult>
  cancel(): void
}

/** Worker 경계를 넘으면 EngineError가 일반 Error가 되므로 코드를 되살린다 */
function toEngineError(e: unknown): EngineError {
  if (e instanceof EngineError) return e
  const code = errorCodeOf(e)
  const msg = e instanceof Error ? e.message : String(e)
  const detail = msg.startsWith(code) ? msg.slice(code.length + 2) : msg
  return new EngineError(code, detail || undefined)
}

export function startCompress(
  file: Blob,
  targetPercent: number,
  opts: CompressOptions = DEFAULT_OPTIONS,
  onProgress?: (p: Progress) => void,
): CompressJob {
  let current: Worker | null = null
  let cancelled = false
  let rejectCancel: ((e: unknown) => void) | null = null
  const cancelPromise = new Promise<never>((_, reject) => (rejectCancel = reject))
  cancelPromise.catch(() => {}) // 처리 안 된 거부 경고 방지

  /** 새 Worker에서 작업 하나를 돌리고, 끝나면(성공·실패 모두) Worker를 없앤다 */
  async function inWorker<T>(task: (remote: Comlink.Remote<WorkerApi>) => Promise<T>): Promise<T> {
    if (cancelled) throw new EngineError('cancelled')
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    current = worker
    try {
      return await Promise.race([task(Comlink.wrap<WorkerApi>(worker)), cancelPromise])
    } finally {
      worker.terminate()
      if (current === worker) current = null
    }
  }

  const run = async (): Promise<CompressResult> => {
    if (file.size > MAX_INPUT_BYTES) throw new EngineError('too-large')
    const input = new Uint8Array(await file.arrayBuffer())
    // Worker마다 복사본을 넘긴다 (전송하면 원본 버퍼가 비워지므로)
    const copy = () => {
      const c = input.slice()
      return Comlink.transfer(c.buffer, [c.buffer])
    }
    const report = (p: Progress) => onProgress?.(p)

    report({ phase: 'open', level: 0, attempt: 0, done: 0, total: 1 })
    const sizes = await inWorker((r) =>
      r.analyze(copy(), Comlink.proxy((done: number, total: number) => report({ phase: 'analyze', level: 0, attempt: 0, done, total }))),
    )

    return searchLevels(input, targetPercent, (level, attempt) =>
      inWorker((r) =>
        r.compressLevel(
          copy(),
          level,
          opts,
          sizes,
          Comlink.proxy((done: number, total: number) => report({ phase: 'images', level, attempt, done, total })),
          Comlink.proxy(() => report({ phase: 'save', level, attempt, done: 0, total: 1 })),
        ),
      ),
    )
  }

  const promise = run().catch((e) => {
    throw toEngineError(e)
  })

  return {
    promise,
    cancel() {
      if (cancelled) return
      cancelled = true
      current?.terminate()
      current = null
      rejectCancel?.(new EngineError('cancelled'))
    },
  }
}

export { DEFAULT_OPTIONS, EngineError, MAX_INPUT_BYTES } from './types'
export type { CompressOptions, CompressResult, Progress } from './types'
