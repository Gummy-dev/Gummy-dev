import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { createRoomService } from './rooms.js'

const service = createRoomService()
const root = resolve('dist')
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = createServer((req, res) => service.handle(req, res, async () => {
  try {
    let path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`)
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end(); return }
    try { if (!(await stat(path)).isFile()) path = resolve(root, 'index.html') } catch { path = resolve(root, 'index.html') }
    const content = await readFile(path)
    res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }); res.end(content)
  } catch { res.writeHead(404); res.end('Build the app with npm run build first.') }
}))
server.listen(Number(process.env.PORT ?? 5173), '0.0.0.0', () => console.log(`Board game server: http://localhost:${server.address().port}`))
process.on('SIGTERM', () => { service.close(); server.close() })
