import { randomBytes, randomInt } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import * as original from '../src/game/restored.js'
import * as expedition from '../src/expedition/engine.js'
import * as expeditionV1 from '../src/legacy/expedition-v1/engine.js'
import { VERSION } from '../src/expedition/cards.js'
// Keep archived engines for saved rooms; their rules never fall back into current games.
const engines = { [VERSION]: expedition, 'expedition-v1': expeditionV1, 'original-v2': original }
const engineFor = r => {
  const version = r.rulesVersion ?? r.game?.rulesVersion ?? 'original-v2', engine = engines[version]
  if (!engine) throw new Error('지원하지 않는 게임 버전입니다.')
  engine.upgradeGame?.(r.game)
  return engine
}
import { LEADERS } from '../src/data/leaders.js'

const random = () => randomInt(0, 0x1000000) / 0x1000000
const id = () => randomBytes(18).toString('base64url')
const fail = (condition, message, status = 400) => { if (!condition) throw Object.assign(new Error(message), { status }) }
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  res.end(JSON.stringify(value))
}
async function body(req) {
  let buffer = ''
  for await (const chunk of req) { buffer += chunk; fail(Buffer.byteLength(buffer) <= 16_384, '요청이 너무 큽니다.', 413) }
  try { const value = JSON.parse(buffer || '{}'); fail(value && typeof value === 'object' && !Array.isArray(value), '요청 형식이 올바르지 않습니다.'); return value }
  catch { throw Object.assign(new Error('요청 형식이 올바르지 않습니다.'), { status: 400 }) }
}
function seatName(value) {
  fail(typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 16, '이름은 1~16자로 입력하세요.')
  return value.trim().replace(/[\x00-\x1f]/g, '')
}

export function createRoomService({ savePath = process.env.ROOM_SAVE_PATH || join(tmpdir(), 'apocalypse-original-rooms-v2.json'), botDelay = 650 } = {}) {
  const rooms = new Map(), connections = new Map(), timers = new Map(), rateLimits = new Map()
  try {
    for (const r of JSON.parse(readFileSync(savePath, 'utf8'))) if (Date.now() - r.updated < 86_400_000) {
      r.seats.forEach(s => { s.connected = false; s.disconnectedAt = Date.now() }); rooms.set(r.code, r)
    }
  } catch { /* A new server starts with no rooms. */ }
  function save() {
    if (!savePath) return
    mkdirSync(dirname(savePath), { recursive: true, mode: 0o700 })
    writeFileSync(`${savePath}.tmp`, JSON.stringify([...rooms.values()]), { mode: 0o600 })
    renameSync(`${savePath}.tmp`, savePath)
  }
  function snapshot(r, seat) {
    return { code: r.code, revision: r.revision, host: r.host, me: seat.id,
      seats: r.seats.map(({ token, ...s }) => s), rulesVersion: r.rulesVersion ?? r.game?.rulesVersion ?? 'original-v2', game: engineFor(r).publicGame(r.game, seat.id) }
  }
  function broadcast(r) {
    r.updated = Date.now()
    for (const s of r.seats) for (const res of connections.get(s.token) ?? []) res.write(`data: ${JSON.stringify(snapshot(r, s))}\n\n`)
  }
  function schedule(r) {
    if (timers.has(r.code) || !r.game || r.game.gameEnded) return
    const actor = engineFor(r).actorId(r.game)
    if (!r.seats.find(s => s.id === actor)?.bot) return
    const timer = setTimeout(() => {
      timers.delete(r.code)
      try {
        const currentActor = engineFor(r).actorId(r.game)
        if (!r.seats.find(s => s.id === currentActor)?.bot) return
        r.game = engineFor(r).runBot(r.game, random)
        r.revision++; save(); broadcast(r); schedule(r)
      } catch (error) { console.error('Bot action failed:', error.message) }
    }, botDelay)
    timer.unref(); timers.set(r.code, timer)
  }
  const cleanup = setInterval(() => {
    for (const [code, r] of rooms) if (Date.now() - r.updated > 86_400_000) {
      for (const s of r.seats) { for (const res of connections.get(s.token) ?? []) res.end(); connections.delete(s.token) }
      clearTimeout(timers.get(code)); timers.delete(code); rooms.delete(code)
    }
    for (const [key, v] of rateLimits) if (Date.now() - v.time > 60_000) rateLimits.delete(key)
  }, 60_000)
  cleanup.unref()
  const heartbeat = setInterval(() => { for (const clients of connections.values()) for (const res of clients) res.write(': heartbeat\n\n') }, 15_000)
  heartbeat.unref()
  for (const r of rooms.values()) schedule(r)

  async function handle(req, res, next = () => json(res, 404, { error: '찾을 수 없는 주소입니다.' })) {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return next()
    try {
      if (req.headers.origin) fail(new URL(req.headers.origin).host === req.headers.host, '다른 사이트에서 보낸 요청은 허용되지 않습니다.', 403)
      const key = req.socket.remoteAddress
      const limit = rateLimits.get(key) ?? { time: Date.now(), count: 0 }
      if (Date.now() - limit.time > 60_000) { limit.time = Date.now(); limit.count = 0 }
      limit.count++; rateLimits.set(key, limit)
      fail(limit.count <= 500, '잠시 후 다시 시도하세요.', 429)
      if (url.pathname === '/api/health') return json(res, 200, { ok: true })
      if (url.pathname === '/api/rooms' && req.method === 'POST') {
        const data = await body(req)
        fail(rooms.size < 200, '지금은 새 방을 만들 수 없습니다. 잠시 후 다시 시도하세요.', 503)
        const name = seatName(data.name)
        fail(data.rulesVersion == null || Object.hasOwn(engines, data.rulesVersion), '지원하지 않는 게임 버전입니다.')
        let code
        do { code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('') } while (rooms.has(code))
        const seat = { id: id(), token: id(), name, leaderId: 'shy', starters: [0, 1], ready: false, bot: false, connected: false, disconnectedAt: Date.now() }
        const r = { code, rulesVersion: data.rulesVersion ?? VERSION, host: seat.id, seats: [seat], revision: 0, game: null, updated: Date.now(), requests: [] }
        if (data.practice === true) {
          seat.ready = true
          for (const l of LEADERS.slice(0, 2)) r.seats.push({ id: id(), token: id(), name: `${l.name} 봇`, leaderId: l.id, starters: l.id === 'robot' ? [2, 3] : [1, 4], ready: true, bot: true, connected: true })
          r.game = engineFor(r).createGame(r.seats, random)
        }
        rooms.set(code, r); save()
        return json(res, 201, { token: seat.token, room: snapshot(r, seat) })
      }
      const match = url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|stream|commands))?$/)
      fail(match, '올바른 방 코드를 입력하세요.', 404)
      const r = rooms.get(match[1]); fail(r, '방이 없거나 만료되었습니다. 코드를 다시 확인하세요.', 404)
      if (match[2] === 'join' && req.method === 'POST') {
        const data = await body(req)
        fail((data.rulesVersion ?? VERSION) === (r.rulesVersion ?? r.game?.rulesVersion ?? 'original-v2'), '다른 버전의 방입니다. 같은 판의 방 코드를 입력하거나 새 테이블을 열어 주세요.')
        fail(!r.game, '이미 시작된 방입니다. 기존 참가자는 원래 기기에서 재접속하세요.')
        fail(r.seats.length < 4, '이 방은 가득 찼습니다.')
        const name = seatName(data.name)
        const available = LEADERS.find(l => !r.seats.some(s => s.leaderId === l.id))
        const seat = { id: id(), token: id(), name, leaderId: available.id, starters: [0, 1], ready: false, bot: false, connected: false, disconnectedAt: Date.now() }
        r.seats.push(seat); r.revision++; save(); broadcast(r)
        return json(res, 201, { token: seat.token, room: snapshot(r, seat) })
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '') || url.searchParams.get('token')
      const seat = r.seats.find(s => s.token === token)
      fail(seat, '참가 정보가 만료되었습니다. 방에 다시 입장하세요.', 401)
      if (match[2] === 'stream' && req.method === 'GET') {
        const clients = connections.get(token) ?? new Set()
        fail(clients.size < 5, '같은 자리의 접속 창이 너무 많습니다.')
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Referrer-Policy': 'no-referrer' })
        res.flushHeaders()
        clients.add(res); connections.set(token, clients); seat.connected = true; seat.disconnectedAt = null
        broadcast(r)
        req.on('close', () => {
          clients.delete(res)
          if (!clients.size) { connections.delete(token); seat.connected = false; seat.disconnectedAt = Date.now(); broadcast(r) }
        })
        return
      }
      if (!match[2] && req.method === 'GET') return json(res, 200, { room: snapshot(r, seat) })
      fail(match[2] === 'commands' && req.method === 'POST', '지원하지 않는 요청입니다.', 405)
      const data = await body(req)
      fail(typeof data.requestId === 'string' && data.requestId.length >= 8 && data.requestId.length <= 80, '요청 ID가 필요합니다.')
      const requestKey = `${seat.id}:${data.requestId}`
      if (r.requests.includes(requestKey)) return json(res, 200, { room: snapshot(r, seat) })
      fail(data.revision === r.revision, '게임 상태가 바뀌었습니다. 갱신된 화면에서 다시 선택하세요.', 409)
      const c = data.command
      fail(c && typeof c.type === 'string', '행동을 선택하세요.')
      if (c.type === 'configure') {
        fail(!r.game, '이미 시작된 게임입니다.')
        fail(LEADERS.some(l => l.id === c.leaderId) && !r.seats.some(s => s.id !== seat.id && s.leaderId === c.leaderId), '다른 사람이 선택한 지도자입니다.')
        fail(Array.isArray(c.starters) && c.starters.length === 2 && new Set(c.starters).size === 2 && c.starters.every(n => Number.isInteger(n) && n >= 0 && n < 5), '서로 다른 시작 생존자 두 명을 선택하세요.')
        seat.leaderId = c.leaderId; seat.starters = c.starters; seat.ready = Boolean(c.ready)
      } else if (c.type === 'addBot') {
        fail(seat.id === r.host && !r.game && r.seats.length < 4, '방장만 빈자리에 연습 상대를 초대할 수 있습니다.')
        const l = LEADERS.find(l => !r.seats.some(s => s.leaderId === l.id))
        r.seats.push({ id: id(), token: id(), name: `${l.name} 봇`, leaderId: l.id, starters: [randomInt(5), randomInt(5)], ready: true, bot: true, connected: true })
        const bot = r.seats.at(-1); if (bot.starters[0] === bot.starters[1]) bot.starters[1] = (bot.starters[1] + 1) % 5
      } else if (c.type === 'removeSeat') {
        fail(seat.id === r.host && !r.game && c.id !== r.host, '대기실에서 방장만 다른 자리를 정리할 수 있습니다.')
        const target = r.seats.find(s => s.id === c.id); fail(target, '자리를 찾을 수 없습니다.')
        for (const client of connections.get(target.token) ?? []) { client.write('event: removed\ndata: {}\n\n'); client.end() }
        r.seats = r.seats.filter(s => s.id !== c.id)
      } else if (c.type === 'start') {
        fail(seat.id === r.host && !r.game && r.seats.length >= 2, '방장이 2명 이상 모인 뒤 출발할 수 있습니다.')
        fail(r.seats.every(s => s.ready && (s.connected || s.bot)), '모든 참가자가 연결된 상태에서 준비를 마쳐야 합니다.')
        r.game = engineFor(r).createGame(r.seats, random)
      } else if (c.type === 'takeOver') {
        fail(seat.id === r.host && r.game, '방장만 연결이 끊긴 자리에 봇을 둘 수 있습니다.')
        const target = r.seats.find(s => s.id === c.id)
        fail(target && !target.connected && Date.now() - target.disconnectedAt >= 30_000, '연결이 끊긴 뒤 30초가 지나면 봇으로 이어갈 수 있습니다.')
        target.bot = true
        r.game.players.find(p => p.seatId === target.id).isBot = true
      } else if (c.type === 'reclaim') {
        fail(r.game && seat.bot, '대신 플레이 중인 봇이 없습니다.'); seat.bot = false
        r.game.players.find(p => p.seatId === seat.id).isBot = false
      } else if (c.type === 'claimHost') {
        const host = r.seats.find(s => s.id === r.host)
        fail(host && !host.connected && Date.now() - host.disconnectedAt >= 30_000, '방장 연결이 끊긴 뒤 30초가 지나면 방장을 이어받을 수 있습니다.')
        r.host = seat.id
      } else {
        fail(r.game && !seat.bot, '게임을 시작하거나 내 자리를 되찾아 주세요.')
        r.game = engineFor(r).applyCommand(r.game, seat.id, c, random)
      }
      r.requests.push(requestKey); r.requests = r.requests.slice(-100)
      r.revision++; save(); broadcast(r); schedule(r)
      return json(res, 200, { room: snapshot(r, seat) })
    } catch (error) {
      if (!res.headersSent) json(res, error.status ?? 400, { error: error.message })
      else res.end()
    }
  }
  return { handle, close() { clearInterval(cleanup); clearInterval(heartbeat); for (const t of timers.values()) clearTimeout(t); for (const clients of connections.values()) for (const res of clients) res.end() } }
}
