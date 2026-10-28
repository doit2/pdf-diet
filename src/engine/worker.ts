// Web Worker 진입점. 무거운 압축을 화면 스레드 밖에서 돌린다.
//
// 주의: mupdf 모듈은 top-level await로 WASM을 불러온다. 이를 정적 import하면
// 로딩이 끝날 때까지 Comlink.expose가 실행되지 않아, 그 사이 화면에서 보낸 요청
// 메시지가 버려진다. 그래서 창구(expose)를 먼저 열고 엔진은 동적 import로 불러온다.
import * as Comlink from 'comlink'
import type { CompressOptions, CompressResult, Progress } from './types'

const engine = import('./compress')

const api = {
  async compress(
    input: ArrayBuffer,
    targetPercent: number,
    opts: CompressOptions,
    onProgress?: (p: Progress) => void,
  ): Promise<CompressResult> {
    const { compressToTarget } = await engine
    const result = compressToTarget(new Uint8Array(input), targetPercent, opts, onProgress)
    return Comlink.transfer(result, [result.data.buffer as ArrayBuffer])
  },
}

export type WorkerApi = typeof api

Comlink.expose(api)
