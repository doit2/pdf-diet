// Web Worker 진입점. Worker 하나는 작업 "한 번"(분석 또는 단계 1회 압축)만 하고 버려진다.
// 같은 WASM 인스턴스에서 압축을 반복하면 메모리가 계속 쌓이므로(T-02b),
// 탐색은 client.ts가 돌리고 시도마다 새 Worker를 만든다.
//
// 주의: mupdf 모듈은 top-level await로 WASM을 불러온다. 이를 정적 import하면
// 로딩이 끝날 때까지 Comlink.expose가 실행되지 않아, 그 사이 화면에서 보낸 요청
// 메시지가 버려진다. 그래서 창구(expose)를 먼저 열고 엔진은 동적 import로 불러온다.
import * as Comlink from 'comlink'
import type { DisplaySize, LevelOutput } from './compress'
import type { CompressOptions } from './types'

const engine = import('./compress')

const api = {
  async analyze(input: ArrayBuffer, onProgress?: (done: number, total: number) => void): Promise<Map<number, DisplaySize>> {
    const { analyzePdf } = await engine
    return analyzePdf(new Uint8Array(input), onProgress)
  },

  async compressLevel(
    input: ArrayBuffer,
    level: number,
    opts: CompressOptions,
    sizes: Map<number, DisplaySize>,
    onImage?: (done: number, total: number) => void,
    onSave?: () => void,
  ): Promise<LevelOutput> {
    const { compressAtLevel } = await engine
    const out = compressAtLevel(new Uint8Array(input), level, opts, sizes, onImage, onSave)
    return Comlink.transfer(out, [out.data.buffer as ArrayBuffer])
  },
}

export type WorkerApi = typeof api

Comlink.expose(api)
