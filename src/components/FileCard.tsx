import type { ReactNode } from 'react'
import { formatBytes } from '../lib/format'

/** 파일 이름·크기 한 줄 표시 */
export function FileCard({ file, extra, action }: { file: File; extra?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <span aria-hidden className="shrink-0 rounded-md bg-red-100 px-1.5 py-1 text-[10px] font-bold text-red-700">PDF</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={file.name}>{file.name}</p>
        <p className="text-sm text-stone-500">
          {formatBytes(file.size)}
          {extra}
        </p>
      </div>
      {action}
    </div>
  )
}
