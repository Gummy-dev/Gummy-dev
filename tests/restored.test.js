import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, applyCommand, publicGame, runBot } from '../src/game/restored.js'
import { SURVIVORS } from '../src/data/survivors.js'
import { CLUE_CARDS } from '../src/data/events.js'
import { RULES } from '../src/data/rules.js'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createRoomService } from '../server/rooms.js'

const seats = [{ id: 'a', name: '첫째', leaderId: 'shy' }, { id: 'b', name: '둘째', leaderId: 'robot' }]
const act = (g, action, args = [], actor = 'a', extra = {}) => applyCommand(g, actor, { type: 'original', action, args, ...extra }, () => .99)
function clueGame() {
  const g = createGame(seats)
  g.phase = 'action'
  const plain = SURVIVORS.find(s => s.id.startsWith('s_plain_'))
  g.players[0].party = [0, 1].map(i => ({ ...plain, uid: `plain-${i}`, partySlotIndex: i }))
  g.players[0].survivorActivity = { 'plain-0': true, 'plain-1': true }
  g.eventSlots[0] = { ...CLUE_CARDS[1][0], uid: 'test-clue' }
  g.explorationState.visibleByTier[1][0] = g.eventSlots[0]
  g.revealedSlots[0] = true
  return g
}

test('original setup: first maintenance, empty parties, one search slot, only tier1 public', () => {
  const g = createGame(seats), view = publicGame(g, 'a')
  assert.equal(g.phase, 'party_maintenance')
  assert.deepEqual(g.players.map(p => p.party.length), [0, 0])
  assert.deepEqual(Object.values(g.searchState.visibleByTier).map(v => v.length), [1, 1, 1])
  assert.deepEqual(Object.values(g.searchState.visibleByTier).map(v => v.filter(Boolean).length), [1, 0, 0])
  assert.deepEqual(Object.values(view.explorationState.visibleByTier).map(v => v.filter(Boolean).length), [3, 0, 0])
  assert.equal(view.actions, undefined)
  assert.ok(view.explorationState.decksByTier[2].every(c => c === null))
  assert.ok(view.eventSlots.slice(3).every(c => c === null))
  assert.equal(publicGame(g, 'b').localPlayerIndex, 1)
})

test('both selection orders preserve people; human dispatch waits for explicit confirmation', () => {
  const initial = clueGame()
  let g = act(initial, 'startEventResolution', [0], 'a', { preselectedIds: ['plain-0'] })
  assert.deepEqual(g.interaction.payload.selectedMyUids, ['plain-0'])
  g = act(g, 'selectMySurvivor', ['plain-1'])
  assert.equal(g.interaction.payload.selectedMyUids.length, 2)
  assert.equal(g.diceRollModal, null)
  assert.ok(Object.values(g.players[0].survivorActivity).every(Boolean))
  g = act(g, 'confirmEventAssignment')
  assert.ok(g.diceRollModal)
  assert.ok(Object.values(g.players[0].survivorActivity).every(v => v === false))
  assert.ok(Object.values(initial.players[0].survivorActivity).every(Boolean), 'input snapshot remains unchanged')
})

test('clue reveals shared next tier but grants access only to its owner; rolls are server-owned', () => {
  let g = act(clueGame(), 'startEventResolution', [0])
  g = act(g, 'selectMySurvivor', ['plain-0']); g = act(g, 'selectMySurvivor', ['plain-1'])
  g = act(g, 'confirmEventAssignment')
  assert.throws(() => act(g, 'confirmDiceRoll', [[6, 6]]), /올바른 행동/)
  assert.throws(() => act(g, 'confirmDiceRoll'), /먼저 주사위/)
  g = act(g, 'rollDice')
  assert.deepEqual(g.serverDiceRolls, [6, 6])
  assert.throws(() => act(g, 'rollDice'), /이미 굴렸/)
  g = act(g, 'confirmDiceRoll')
  assert.equal(g.players[0].unlockedExplorationTier, 2)
  assert.equal(g.players[1].unlockedExplorationTier, 1)
  for (const seat of seats) assert.equal(publicGame(g, seat.id).explorationState.visibleByTier[2].filter(Boolean).length, RULES.exploration.eventSlotCountByTier[2])
  g.currentPlayerIndex = 1
  g = act(g, 'startEventResolution', [3], 'b')
  assert.equal(g.interaction, null, 'other player cannot enter revealed tier2')
  assert.equal(g.diceRollModal, null)
})

test('original recruit/meal costs and one-slot search survive the online adapter', () => {
  let g = createGame(seats)
  const plain = { ...SURVIVORS.find(s => s.id.startsWith('s_plain_')), uid: 'recruit-plain' }
  g.searchState.visibleByTier[1][0] = plain
  g.searchState.visibleSlots[0] = plain
  g.mercenaryPool[0] = plain
  g.revealedUids = [plain.uid]
  const before = g.players[0].resources.bottleCap
  g = act(g, 'recruitSurvivor', [plain.uid])
  assert.equal(g.players[0].party.length, 1)
  assert.equal(g.players[0].resources.bottleCap, before - plain.recruitCost)
  assert.equal(g.players[0].survivorActivity[plain.uid], false)
  g = act(g, 'reactivateSurvivor', [plain.uid])
  assert.equal(g.players[0].survivorActivity[plain.uid], true)
  assert.equal(g.searchState.visibleByTier[1].length, 1)
})

test('server rejects cross-seat, private methods, wrong steps and other-party edits', () => {
  const g = createGame(seats), before = JSON.stringify(g)
  assert.throws(() => act(g, 'endTurn', [], 'b'), /다른 플레이어/)
  assert.throws(() => act(g, '_advanceTurn'), /올바른 행동/)
  assert.throws(() => act(g, 'swapPartyMembers', [1, 0, 1]), /내 파티/)
  assert.throws(() => act(g, 'selectTargetPlayer', [1]), /선택 단계/)
  assert.throws(() => act(g, '__proto__'), /올바른 행동/)
  assert.equal(JSON.stringify(g), before)
})

test('original bots complete their first maintenance and return control to the human', () => {
  let g = createGame([seats[0], { ...seats[1], bot: true }])
  g = act(g, 'endTurn')
  assert.equal(g.currentPlayerIndex, 1)
  g = runBot(g)
  assert.equal(g.currentPlayerIndex, 0)
  assert.equal(g.round, 2)
  assert.equal(g.phase, 'action')
  assert.ok(g.players[1].resources.can >= 0)
})

test('two online seats retain their own viewpoint, original actions, sync and reconnect', async t => {
  const service = createRoomService({ savePath: null }), server = createServer(service.handle)
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const controller = new AbortController()
  t.after(() => { controller.abort(); service.close(); server.closeAllConnections(); server.close() })
  const base = `http://127.0.0.1:${server.address().port}`
  async function request(path, data, token) {
    const res = await fetch(base + path, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) })
    return { status: res.status, ...await res.json() }
  }
  const a = await request('/api/rooms', { name: '첫째', rulesVersion: 'original-v2' })
  const path = `/api/rooms/${a.room.code}`
  const b = await request(path + '/join', { name: '둘째', rulesVersion: 'original-v2' })
  const readers = []
  for (const seat of [a, b]) {
    const stream = await fetch(base + path + '/stream?token=' + seat.token, { signal: controller.signal })
    readers.push(stream.body.getReader()); await readers.at(-1).read()
  }
  let counter = 0
  async function command(seat, c) {
    const current = await request(path, null, seat.token)
    return request(path + '/commands', { revision: current.room.revision, requestId: `original-command-${++counter}`, command: c }, seat.token)
  }
  for (const [seat, leaderId] of [[a, 'shy'], [b, 'idol']]) assert.equal((await command(seat, { type: 'configure', leaderId, starters: [0, 1], ready: true })).status, 200)
  assert.equal((await command(a, { type: 'start' })).status, 200)
  assert.equal((await request(path, null, b.token)).room.game.localPlayerIndex, 1)
  assert.equal((await command(b, { type: 'original', action: 'endTurn', args: [] })).status, 400)
  assert.equal((await command(a, { type: 'original', action: 'endTurn', args: [] })).status, 200)
  const state = (await request(path, null, b.token)).room.game
  const candidate = state.mercenaryPool[0]
  assert.ok(candidate)
  const result = await command(b, { type: 'original', action: 'recruitSurvivor', args: [candidate.uid] })
  assert.equal(result.status, 200)
  assert.equal(result.room.game.players[1].party[0].uid, candidate.uid)
  const reconnected = (await request(path, null, a.token)).room
  assert.equal(reconnected.game.localPlayerIndex, 0)
  assert.equal(reconnected.game.players[1].party[0].uid, candidate.uid)
  assert.ok(reconnected.game.searchState.decksByTier[1].every(c => c === null))
  assert.equal((await command(a, { type: 'original', action: 'reactivateSurvivor', args: [candidate.uid] })).status, 400)
  controller.abort()
  await Promise.all(readers.map(reader => reader.cancel().catch(() => {})))
})
