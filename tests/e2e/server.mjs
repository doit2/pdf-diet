// 화면 테스트용 정적 서버. dist/를 내려주면서 vercel.json의 헤더(CSP 등)를 그대로 붙여
// 운영과 같은 조건으로 확인한다. (`vite preview`는 vercel.json 헤더를 붙이지 않는다)
//   node tests/e2e/server.mjs [port]
import { createServer } from 'node:http'
import { readFileSync, statSync, createReadStream } from 'node:fs'
import { join, extname, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
}

// vercel.json "source" 패턴(/(.*) 등)을 정규식으로 바꿔 둔다
const rules = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')).headers.map((r) => ({
  re: new RegExp(`^${r.source.replace(/\//g, '\\/')}$`),
  headers: r.headers,
}))

function fileFor(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(DIST, clean)
  if (!candidate.startsWith(DIST)) return null
  try {
    const st = statSync(candidate)
    if (st.isFile()) return candidate
    if (st.isDirectory()) return fileFor(join(clean, 'index.html'))
  } catch {
    /* 없음 */
  }
  return null
}

createServer((req, res) => {
  const path = req.url ?? '/'
  for (const rule of rules) if (rule.re.test(path.split('?')[0])) for (const h of rule.headers) res.setHeader(h.key, h.value)
  // 정적 사이트라 GET/HEAD 말고는 받지 않는다 (업로드가 없다는 확인에도 쓰인다)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  const file = fileFor(path)
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found')
    return
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Content-Length': statSync(file).size })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
}).listen(PORT, '127.0.0.1', () => console.log(`pdf-diet test server: http://127.0.0.1:${PORT}`))
