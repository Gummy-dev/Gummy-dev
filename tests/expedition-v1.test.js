import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, applyCommand, actorId, publicGame, runBot, requirements, crewCount } from '../src/expedition-v1/engine.js'
import { RULES, PLAIN, SURVIVOR_CARDS, LOCATIONS, DISASTERS, locationPrizes } from '../src/expedition-v1/cards.js'
const seats = [{ id: 'a', name: '첫째', leaderId: 'shy', starters: [0, 2] }, { id: 'b', name: '둘째', leaderId: 'robot', starters: [1, 3] }]
const act = (g, command, id = actorId(g), random = () => .75) => applyCommand(g, id, command, random)
function sharedGame() {
  const g = createGame(seats, () => .4)
  g.sites[0] = { id: 'shared', card: { ...LOCATIONS[0], id: 'shared', people: 2, rewardRoute: 3, rewardCan: 4, rewardCap: 0, roles: ['겁쟁이', '분위기메이커'] }, food: 0, crew: [] }
  return g
}
function departure() {
  let g = sharedGame()
  g = act(g, { type: 'dispatch', siteId: 'shared', uid: g.players[0].party[0].uid })
  g = act(g, { type: 'dispatch', siteId: 'shared', uid: g.players[1].party[0].uid })
  return g
}
function returnsStage() {
  let g = act(departure(), { type: 'roll' })
  g = act(g, { type: 'claim', prize: 'route' }); g = act(g, { type: 'claim', prize: 'food' })
  return g
}
function invariants(g) {
  const cards = [...g.players.flatMap(p => p.party), ...g.sites.flatMap(s => s?.crew ?? []), ...g.market.filter(Boolean), ...g.recruitDeck, ...g.stranded]
  assert.equal(new Set(cards.map(c => c.uid)).size, cards.length, 'one physical card in exactly one location')
  assert.ok(g.players.every(p => Number.isInteger(p.resources.can) && p.resources.can >= 0 && p.resources.bottleCap >= 0 && Number.isInteger(p.route) && p.route >= 0 && crewCount(g, p.seatId) <= RULES.party))
  if (!g.gameEnded) assert.ok(g.players.some(p => p.seatId === actorId(g)))
}

test('new setup has sequential tier deck, visible locations, 3 starters, hidden future identities', () => {
  const g = createGame(seats, () => .5)
  assert.equal(g.sites.length, 3); assert.equal(g.players[0].party.length, 3)
  assert.deepEqual(g.deck.map(c => c.tier), [...g.deck.map(c => c.tier)].sort())
  const view = publicGame(g, 'b'); assert.equal(view.localPlayerIndex, 1); assert.ok(view.deck.every(c => c === null)); assert.ok(view.recruitDeck.every(c => c === null))
  assert.equal(view.players[0].party.length, 3); invariants(g)
})
test('shared dispatch pauses action clock through priority rewards and each owner return', () => {
  let g = departure(); assert.equal(g.pending.stage, 'roll'); assert.equal(g.turnInDay, 1)
  const before = JSON.stringify(g)
  assert.throws(() => act(g, { type: 'roll' }, 'a'), /차례/); assert.equal(JSON.stringify(g), before)
  g = act(g, { type: 'roll' }); assert.deepEqual(g.pending.order, ['a', 'b'], 'first participant wins complete tie')
  assert.equal(g.players[0].resources.can, 6)
  assert.throws(() => act(g, { type: 'roll' }), /발견물/)
  g = act(g, { type: 'claim', prize: 'route' }); assert.equal(g.players[0].route, 3)
  assert.throws(() => act(g, { type: 'claim', prize: 'route' }), /이미 선택/)
  g = act(g, { type: 'claim', prize: 'food' }); assert.equal(g.pending.stage, 'return'); assert.equal(actorId(g), 'a')
  const uidA = g.sites[0].crew.find(c => c.owner === 'a').uid, uidB = g.sites[0].crew.find(c => c.owner === 'b').uid
  assert.throws(() => act(g, { type: 'return', uids: [uidB] }), /다른 파티/)
  g = act(g, { type: 'return', uids: [uidA] }); assert.equal(g.players[0].resources.can, 5); assert.equal(g.players[0].party.find(c => c.uid === uidA).ready, false)
  assert.equal(actorId(g), 'b'); assert.equal(g.turnInDay, 1)
  g = act(g, { type: 'return', uids: [uidB] }); assert.equal(g.pending, null); assert.equal(g.turnInDay, 2); assert.equal(actorId(g), 'a'); assert.notEqual(g.sites[0].id, 'shared'); invariants(g)
})
test('unaffordable, duplicate and forged returns are rejected, abandonment unlocks next day', () => {
  let g = returnsStage(); const uid = g.sites[0].crew[0].uid; g.players[0].resources.can = 0
  assert.throws(() => act(g, { type: 'return', uids: [uid, uid] }), /선택/)
  assert.throws(() => act(g, { type: 'return', uids: [uid] }), /부족/)
  g = act(g, { type: 'return', uids: [] }); assert.equal(g.stranded[0].availableDay, 2)
  g = act(g, { type: 'return', uids: g.sites[0].crew.map(c => c.uid) })
  assert.throws(() => act(g, { type: 'recruit', uid }), /영입/)
  g = act(g, { type: 'forage' }); g = act(g, { type: 'forage' }); assert.equal(g.day, 2)
  g = act(g, { type: 'recruit', uid }); assert.equal(g.stranded.length, 0); assert.equal(g.players[0].party.at(-1).ready, false); invariants(g)
})
test('safe forage works without people or resources; refresh respects occupied sites', () => {
  let g = sharedGame(); const saved = g.players[0].party.splice(0); g.stranded.push(...saved.map(c => ({ ...c, availableDay: 2 }))); g.players[0].resources.can = 0
  g.sites[0].crew.push({ ...g.players[1].party.shift(), owner: 'b' })
  const id = g.sites[0].id
  for (let i = 0; i < 4; i++) g = act(g, { type: 'forage' })
  assert.equal(g.day, 2); assert.equal(g.players[0].resources.can, 4); assert.equal(g.sites[0].id, id); invariants(g)
})
test('one survivor cannot satisfy two roles; partial food and foreign cards are validated', () => {
  const g = sharedGame(); const own = g.players[0].party[0]
  assert.equal(requirements({ card: { roles: ['겁쟁이', '*'], food: 0 }, crew: [own], food: 0 }).ready, false)
  for (const food of [-1, 1.1, Infinity, '1']) assert.throws(() => act(g, { type: 'dispatch', siteId: 'shared', uid: own.uid, food }), /식량/)
  assert.throws(() => act(g, { type: 'dispatch', siteId: 'shared', uid: g.players[1].party[0].uid }), /내 거점/)
})
test('preparation pays printed cost; unprepared party chooses a lost survivor before next day', () => {
  let g = sharedGame(); g.day = 2; g.turnInDay = 2
  g = act(g, { type: 'prepare' }); assert.equal(g.players[0].resources.bottleCap, 1)
  g = act(g, { type: 'forage' }); assert.equal(g.day, 2); assert.equal(g.pending.stage, 'disaster')
  assert.equal(actorId(g), 'b'); assert.equal(g.players[0].resources.can, 5); assert.equal(g.players[1].resources.can, 3)
  const before = JSON.stringify(g), uid = g.players[1].party[0].uid
  assert.throws(() => act(g, { type: 'disasterLoss', uids: [g.players[0].party[0].uid] }), /내 동료/)
  assert.equal(JSON.stringify(g), before)
  g = act(g, { type: 'disasterLoss', uids: [uid] })
  assert.equal(g.day, 3); assert.equal(g.pending, null); assert.equal(g.players[1].party.length, 2)
  assert.equal(g.stranded.find(c => c.uid === uid).availableDay, 3)
  assert.ok(g.lastDisaster.results[0].protected); assert.ok(!g.lastDisaster.results[1].protected)
  invariants(g)
})
test('danger loss, protection, free return and printed reroll behave consistently', () => {
  let g = departure(); g.sites[0].card.danger = true; g.sites[0].crew[0] = { ...g.sites[0].crew[0], ...SURVIVOR_CARDS.find(c => c.ability === 'guard') }
  g = act(g, { type: 'roll' }, 'b', () => 0)
  assert.equal(g.pending.results.find(r => r.owner === 'a').lost.length, 0); assert.equal(g.pending.results.find(r => r.owner === 'b').lost.length, 1)
  let free = returnsStage(); free.players[0].resources.can = 0; free.sites[0].crew[0].returnCost = 0
  free = act(free, { type: 'return', uids: [free.sites[0].crew[0].uid] }); assert.equal(free.players[0].party.length, 3)
  let reroll = departure(); reroll.sites[0].crew[0].ability = 'reroll'; let rolls = [0, .99, .5]
  reroll = act(reroll, { type: 'roll' }, 'b', () => rolls.shift() ?? .5)
  assert.deepEqual(reroll.pending.results.find(r => r.owner === 'a').before, [1]); assert.deepEqual(reroll.pending.results.find(r => r.owner === 'a').rolls, [6])
})
test('escape keeps equal scheduled actions, ends that day and handles shared ranking', () => {
  let g = sharedGame(); g.players[0].route = 11; g = act(g, { type: 'escape', uids: g.players[0].party.map(c => c.uid) }); assert.equal(g.finalDay, 1); assert.equal(actorId(g), 'b')
  g = act(g, { type: 'forage' }); assert.equal(actorId(g), 'b'); assert.equal(g.turnInDay, 3)
  g = act(g, { type: 'forage' }); assert.equal(g.gameEnded, true); assert.equal(g.standings[0].seatId, 'a')
  assert.throws(() => act(g, { type: 'forage' }), /종료/)
})
test('100 seeded bot games finish with valid ownership, no negative resources or stuck phases', () => {
  let escaped = 0, advanced = 0
  for (let seed = 1; seed <= 100; seed++) {
    let state = seed; const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296)
    const count = 2 + seed % 3
    let g = createGame(Array.from({ length: count }, (_, i) => ({ id: String(i), name: '봇' + i, leaderId: ['shy', 'robot', 'duck', 'zombie'][i] })), random)
    let actions = 0
    while (!g.gameEnded && actions++ < 400) { g = runBot(g, random); invariants(g); if (g.sites.some(s => s?.card.tier === 3)) advanced++ }
    assert.equal(g.gameEnded, true, 'seed ' + seed); if (g.players.some(p => p.escaped)) escaped++
  }
  assert.ok(escaped > 0); assert.ok(advanced > 0)
})


test('minimum headcount is independent of types and a matching survivor counts towards both', () => {
  const crew = [{ uid: 'one', type: '반장' }, { uid: 'two', type: '겁쟁이' }, { uid: 'three', type: '4차원' }]
  const site = { card: { people: 3, roles: ['반장'], food: 0 }, crew: crew.slice(0, 1), food: 0 }
  assert.deepEqual(requirements(site).missing, []); assert.equal(requirements(site).people, 2); assert.equal(requirements(site).ready, false)
  site.crew = crew; assert.equal(requirements(site).ready, true)
  site.card.roles = ['용감이']; assert.equal(requirements(site).people, 0); assert.equal(requirements(site).ready, false)
})
test('location prizes vary; exhausted prizes skip remaining claims but every party returns', () => {
  assert.ok(LOCATIONS.some(c => c.rewardRoute === 0)); assert.ok(LOCATIONS.some(c => c.rewardCan === 0)); assert.ok(LOCATIONS.some(c => c.rewardCap === 0))
  assert.ok(LOCATIONS.every(c => c.people >= c.roles.length && locationPrizes(c).length > 0))
  let g = departure(); g.sites[0].card.rewardRoute = 0; g.sites[0].card.rewardCap = 0
  g = act(g, { type: 'roll' }); assert.deepEqual(g.pending.prizes.map(r => r.id), ['food'])
  g = act(g, { type: 'claim', prize: 'food' }); assert.equal(g.pending.stage, 'return'); assert.deepEqual(g.pending.order, ['a', 'b'])
  g = act(g, { type: 'return', uids: g.sites[0].crew.filter(c => c.owner === 'a').map(c => c.uid) })
  assert.equal(actorId(g), 'b')
  g = act(g, { type: 'return', uids: g.sites[0].crew.map(c => c.uid) }); assert.equal(g.pending, null)
  let clues = departure(); clues.players[0].route = 9; clues = act(clues, { type: 'roll' }); clues = act(clues, { type: 'claim', prize: 'route' })
  assert.equal(clues.players[0].route, 12, 'full printed amount, no cap at ten')
})
test('utopia validates ten clues and three own ready survivors; failure spends food and rests crew', () => {
  let g = sharedGame(); const uids = g.players[0].party.map(c => c.uid)
  g.players[0].route = 9; assert.throws(() => act(g, { type: 'escape', uids }), /단서 10/)
  g.players[0].route = 10
  for (const invalid of [uids.slice(1), [uids[0], uids[0], uids[1]], [uids[0], uids[1], g.players[1].party[0].uid]]) assert.throws(() => act(g, { type: 'escape', uids: invalid }), /활성 동료 3명/)
  g = act(g, { type: 'escape', uids }, 'a', () => 0)
  assert.equal(g.lastUtopia.success, false); assert.equal(g.players[0].route, 10); assert.equal(g.players[0].resources.can, 2)
  assert.ok(g.players[0].party.every(c => !c.ready)); assert.equal(g.finalDay, null); assert.equal(actorId(g), 'b')
})
test('staff preparation needs two distinct ready survivors including a required type', () => {
  let g = sharedGame(); g.day = 4; const uids = g.players[0].party.map(c => c.uid)
  assert.throws(() => act(g, { type: 'prepare', uid: uids[1] }), /2명/)
  assert.throws(() => act(g, { type: 'prepare', uids: [uids[1]] }), /2명/)
  assert.throws(() => act(g, { type: 'prepare', uids: [uids[0], uids[2]] }), /지정 타입/)
  g = act(g, { type: 'prepare', uids: uids.slice(0, 2) })
  assert.deepEqual(g.players[0].prepared, [4]); assert.equal(g.players[0].party.filter(c => c.ready).length, 1)
})
test('last disaster removes up to two chosen people including dispatched crew before scoring', () => {
  let g = sharedGame(); g.day = 8; g.turnInDay = 3; g.currentPlayerIndex = 1; g.players[0].prepared = [8]
  const away = g.players[1].party.shift(); g.sites[0].crew.push({ ...away, owner: 'b' })
  g = act(g, { type: 'forage' }); assert.equal(g.pending.stage, 'disaster'); assert.equal(g.gameEnded, false)
  assert.throws(() => act(g, { type: 'disasterLoss', uids: [away.uid] }), /2명/)
  g = act(g, { type: 'disasterLoss', uids: [away.uid, g.players[1].party[0].uid] })
  assert.equal(g.gameEnded, true); assert.equal(crewCount(g, 'b'), 1); invariants(g)
})
test('saved room cards update without losing progress; in-flight resolution stays intact', () => {
  const g = createGame(seats); delete g.rulesRevision; g.players[0].route = 2
  g.sites[0].card = { ...g.sites[0].card, people: undefined, rewardRoute: undefined }
  const view = publicGame(g, 'a'); assert.equal(view.rulesRevision, 3); assert.ok(view.sites[0].card.people); assert.equal(view.players[0].route, 2)
  assert.equal(g.rulesRevision, undefined, 'read-only snapshot does not mutate saved room')
  g.pending = { stage: 'roll', siteId: g.sites[0].id, trigger: 'a', order: [], index: 0 }
  assert.equal(publicGame(g, 'a').sites[0].card.people, undefined)
})


test('shared food and cap contributions are validated and both are required for departure', () => {
  let g = sharedGame(); g.sites[0].card.food = 1; g.sites[0].card.caps = 1
  const uid = g.players[0].party[0].uid, before = JSON.stringify(g)
  for (const caps of [-1, 1.5, '1', Infinity, 2]) assert.throws(() => act(g, { type: 'dispatch', siteId: 'shared', uid, food: 1, caps }), /병뚜껑/)
  assert.equal(JSON.stringify(g), before)
  g = act(g, { type: 'dispatch', siteId: 'shared', uid, food: 1 })
  g = act(g, { type: 'dispatch', siteId: 'shared', uid: g.players[1].party[0].uid })
  assert.equal(g.pending, null); assert.equal(requirements(g.sites[0]).caps, 1); assert.equal(requirements(g.sites[0]).ready, false)
  assert.throws(() => act(g, { type: 'supply', siteId: 'shared', caps: 0 }), /물자/)
  g.players[0].resources.bottleCap = 0
  assert.throws(() => act(g, { type: 'supply', siteId: 'shared', caps: 1 }), /병뚜껑/)
  g.players[0].resources.bottleCap = 4
  g = act(g, { type: 'supply', siteId: 'shared', caps: 1 })
  assert.equal(g.pending.stage, 'roll'); assert.equal(g.sites[0].caps, 1); assert.equal(g.players[0].resources.bottleCap, 3)
  let together = sharedGame(); together.sites[0].card.food = 1; together.sites[0].card.caps = 1
  together = act(together, { type: 'dispatch', siteId: 'shared', uid: together.players[0].party[0].uid, food: 1, caps: 1 })
  assert.equal(together.players[0].resources.can, 4); assert.equal(together.players[0].resources.bottleCap, 3)
})
test('winner takes all printed rewards once; other participants retain food and return decisions', () => {
  let g = departure(); g.sites[0].card.distribution = 'all'; g.sites[0].card.rewardCap = 2
  const original = g.players.map(p => ({ ...p.resources })); let rolls = [.1, .9]
  g = act(g, { type: 'roll' }, 'b', () => rolls.shift())
  assert.equal(g.pending.stage, 'return'); assert.equal(actorId(g), 'b')
  assert.equal(g.players[1].route, 3); assert.equal(g.players[1].resources.can, original[1].can + 5); assert.equal(g.players[1].resources.bottleCap, original[1].bottleCap + 2)
  assert.equal(g.players[0].route, 0); assert.equal(g.players[0].resources.can, original[0].can + 1)
  assert.equal(g.players[1].discoveries.length, 1); assert.equal(g.pending.choices.length, 3)
  assert.throws(() => act(g, { type: 'claim', prize: 'route' }), /귀환/)
  g = act(g, { type: 'return', uids: g.sites[0].crew.filter(c => c.owner === 'b').map(c => c.uid) })
  assert.equal(actorId(g), 'a')
  g = act(g, { type: 'return', uids: g.sites[0].crew.map(c => c.uid) }); assert.equal(g.pending, null)
  invariants(g)
})
