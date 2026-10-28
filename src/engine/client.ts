// 화면에서 쓰는 압축 래퍼. 작업마다 Worker를 새로 만들고, 끝나거나 취소하면 없앤다
// (WASM 메모리를 확실히 돌려받기 위함). 취소 = worker.terminate().
import * as Comlink from 'comlink'
import type { WorkerApi } from './worker'
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

export function startCompress(
  file: Blob,
  targetPercent: number,
  opts: CompressOptions = DEFAULT_OPTIONS,
  onProgress?: (p: Progress) => void,
): CompressJob {
  let worker: Worker | null = null
  let rejectJob: ((e: unknown) => void) | null = null
  let finished = false

  const stop = () => {
    worker?.terminate()
    worker = null
  }

  const promise = new Promise<CompressResult>((resolve, reject) => {
    rejectJob = reject
    if (file.size > MAX_INPUT_BYTES) {
      reject(new EngineError('too-large'))
      return
    }
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    const remote = Comlink.wrap<WorkerApi>(worker)
    file
      .arrayBuffer()
      .then((buf) =>
        remote.compress(
          Comlink.transfer(buf, [buf]),
          targetPercent,
          opts,
          onProgress ? Comlink.proxy(onProgress) : undefined,
        ),
      )
      .then(resolve, (e) => {
        // Worker 경계를 넘으면 EngineError가 일반 Error가 되므로 코드를 되살린다
        const code = errorCodeOf(e)
        const msg = e instanceof Error ? e.message : String(e)
        const detail = msg.startsWith(code) ? msg.slice(code.length + 2) : msg
        reject(new EngineError(code, detail || undefined))
      })
      .finally(() => {
        finished = true
        stop()
      })
  })

  return {
    promise,
    cancel() {
      if (finished) return
      finished = true
      stop()
      rejectJob?.(new EngineError('cancelled'))
    },
  }
}

export { DEFAULT_OPTIONS, EngineError, MAX_INPUT_BYTES } from './types'
export type { CompressOptions, CompressResult, Progress } from './types'
