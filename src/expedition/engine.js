import { VERSION, COLORS, RULES, LEADERS, SURVIVOR_CARDS, LOCATIONS, locationPrizes, abilityPhase, hazardText, siteCapacity, cardScore } from './cards.js'
import { OMEN_TILES, createOmens, upcomingOmen, publicOmens, disasterCrewValid } from './omens.js'
import { EVENT_SPACES, EVENT_CARDS, createEventDeck, eventModifier, eventCrewValid } from './events.js'
export { upcomingOmen, disasterCrewValid, eventCrewValid }
const requireRule = (ok, message) => { if (!ok) throw new Error(message) }
const copy = value => JSON.parse(JSON.stringify(value))
const shuffle = (cards, random) => { const a = [...cards]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const dice = random => Math.floor(random() * 6) + 1
const log = (g, message) => { g.log = [...g.log, message].slice(-80) }
function gained(g, p, source, items) {
  items = items.filter(item => item.amount > 0)
  if (!items.length) return
  g.noticeSeq = (g.noticeSeq ?? 0) + 1
  g.notices = [...(g.notices ?? []), { id: g.noticeSeq, owner: p.seatId, source, items }].slice(-40)
}
const leader = p => LEADERS.find(l => l.id === p.leaderId)
export const ownedCrew = (g, id) => [...g.players.find(p => p.seatId === id).party, ...g.sites.flatMap(s => s?.crew.filter(c => c.owner === id) ?? [])]
export const crewCount = (g, id) => ownedCrew(g, id).length
export const actorId = g => g.pending ? g.pending.actor ?? (g.pending.stage === 'roll' ? g.pending.trigger : g.pending.order[g.pending.index]) : g.players[g.currentPlayerIndex].seatId
export const partyLimit = p => leader(p).maxPartySize
export const reorderCost = p => Math.max(0, 2 - p.party.filter(c => c.slot < 2 && c.type === '반장').length)
export function mealCost(p, card, g) {
  if (['free', 'ghost'].includes(card.ability) || p.medical?.[card.uid] > 0) return 0
  const neighbours = p.party.filter(c => c.uid !== card.uid)
  const reduction = (card.slot >= 3 && card.type === '겁쟁이' ? 1 : 0)
    + neighbours.filter(c => c.ability === 'alien' && Math.abs(c.slot - card.slot) === 1).length
    + neighbours.filter(c => c.ability === 'capybara' && c.slot === card.slot).length
  return Math.max(0, RULES.mealCost - reduction + eventModifier(g, p, 'meal'))
}
export const recruitCost = (g, p, card, discount = 0) => Math.max(0, card.cost - discount + eventModifier(g, p, 'recruit'))
export const dispatchLimit = (g, p) => 2 + eventModifier(g, p, 'dispatchLimit')
export const eventBonus = p => Math.min(6, Math.max(0, p.utopiaDie ?? 0))
export const eventSolveCost = (g, p) => Math.max(0, (g.activeEvent?.card.cost ?? 0) - Number(p.leaderId === 'duck'))
export const canSolveEvent = (g, p, crew) => Boolean(g.activeEvent && !g.activeEvent.solvedBy && !g.pending && g.phase === 'dispatch' && !p.passed && !p.escaped && eventCrewValid(g.activeEvent.card, crew) && crew.every(c => p.party.some(x => x.uid === c.uid && x.ready)) && p.resources.bottleCap >= eventSolveCost(g, p))
export function joinSlot(p, card, requested) {
  const valid = slot => {
    if (p.party.some(c => ((card.ability === 'scout' && c.ability === 'dog') || (card.ability === 'dog' && c.ability === 'scout')) && Math.abs(c.slot - slot) <= 1)) return false
    const here = p.party.filter(c => c.slot === slot)
    if (here.length >= 2) return false
    if (!here.length) return true
    return [card, ...here].some(c => ['capybara', 'ghost'].includes(c.ability)) || (card.ability === 'twins' && here[0].ability === 'twins')
  }
  if (requested != null) return Number.isInteger(requested) && requested >= 0 && requested < partyLimit(p) && valid(requested) ? requested : -1
  const shared = p.party.find(c => valid(c.slot)); if (shared) return shared.slot
  return Array.from({ length: partyLimit(p) }, (_, i) => i).find(valid) ?? -1
}
function relationsValid(p) {
  return !p.party.some(a => a.ability === 'scout' && p.party.some(b => b.ability === 'dog' && Math.abs(a.slot - b.slot) <= 1))
}
function addToParty(g, p, card, slot, source = '동료 합류') {
  const nextSlot = joinSlot({ ...p, party: [...p.party, ...g.sites.flatMap(s => s?.crew.filter(c => c.owner === p.seatId) ?? [])] }, card, slot)
  requireRule(nextSlot >= 0, '빈자리 또는 함께 쓸 수 있는 자리가 필요합니다.')
  p.party.push({ ...card, owner: undefined, slot: nextSlot, ready: false, availableDay: undefined, previousOwner: undefined, reason: undefined })
  requireRule(relationsValid(p), '개와 고양이는 같은 자리나 인접한 자리에 둘 수 없습니다. 합류 자리를 바꿔 주세요.')
  // Proposal validation uses temporary player copies; only a real arrival is announced.
  if (g.players.includes(p)) gained(g, p, source, [{ kind: 'survivor', name: card.name, amount: 1 }])
}
export function requirements(site) {
  if (!site) return { matched: [], missing: [], people: 0, food: 0, caps: 0, ready: false }
  const available = [...site.crew], matched = [], missing = []
  for (const role of site.card.roles) {
    let i = available.findIndex(c => c.ability !== 'wildcard' && (role === '*' || c.type === role))
    if (i < 0) i = available.findIndex(c => c.ability === 'wildcard')
    if (i < 0) missing.push(role); else matched.push(available.splice(i, 1)[0].uid)
  }
  const people = Math.max(0, site.card.people - site.crew.length), food = 0, caps = 0
  return { matched, missing, people, food, caps, ready: !site.resolved && !people && !missing.length && !food && !caps }
}
function combinations(cards, n) {
  if (!n) return [[]]
  return cards.flatMap((card, i) => combinations(cards.slice(i + 1), n - 1).map(rest => [card, ...rest]))
}
// Progress opens the gate; only solved events add a persistent final bonus.
export const escapeBonus = () => 0
export const escapeTypesValid = crew => new Set(crew.filter(c => c.ability !== 'wildcard').map(c => c.type)).size + crew.filter(c => c.ability === 'wildcard').length >= RULES.escapeTypes
export function escapeCrew(p) {
  return combinations(p.party.filter(c => c.ready), RULES.escapePeople).filter(escapeTypesValid)
    .sort((a,b) => b.reduce((n,c) => n + (['scout','teacher'].includes(c.ability) ? 3 : 0) + (c.slot < 2 && c.type === '용감이' ? 1 : 0),0) - a.reduce((n,c) => n + (['scout','teacher'].includes(c.ability) ? 3 : 0) + (c.slot < 2 && c.type === '용감이' ? 1 : 0),0))[0] ?? []
}
export function canEscape(g, p, crew = escapeCrew(p)) {
  return !g.gameEnded && g.phase === 'dispatch' && !g.pending && !p.passed && !p.escaped && p.escapeDay !== g.day && p.route >= RULES.route && p.resources.can >= RULES.escapeFood && crew.length === RULES.escapePeople && crew.every(c => p.party.some(x => x.uid === c.uid && x.ready)) && escapeTypesValid(crew) && !g.sites.some(s => s?.crew.some(c => c.owner === p.seatId))
}
export function counterCrew(g, site, id) {
  if (!site.crew.some(c => c.owner === id)) return []
  return [...site.crew.filter(c => c.owner === id && c.ability === 'counter'), ...g.players.find(p => p.seatId === id).party.filter(c => c.ready && c.ability === 'counter')]
}
function checkTaboo(g, site) {
  if (!site.hazardTriggered && site.card.hazard?.effect === 'fail' && site.crew.some(c => c.type === site.card.hazard.type)) {
    site.hazardTriggered = true; threatenExploration(g, site, hazardText(site.card))
  }
}
export const explorationPrizes = (site, g) => locationPrizes(site.card, site.crew).map(prize => ({ ...prize, amount: (prize.amount + (prize.kind === 'route' ? eventModifier(g, null, 'routeReward') : 0)) * (site.chaosRoll >= 4 && ['can', 'bottleCap'].includes(prize.kind) ? 2 : 1) }))
function drawRecruit(g) { return g.recruitDeck.shift() ?? null }
function drawSite(g, retired = null) {
  g.siteDiscard ??= []
  if (retired) g.siteDiscard.push(retired.card)
  // With no day limit, completed locations return after the staged deck runs out.
  if (!g.deck.length && g.siteDiscard.length) g.deck = g.siteDiscard.splice(0)
  const card = g.deck.shift()
  return card ? { id: card.id, card, crew: [], food: 0, caps: 0 } : null
}
export function createGame(seats, random = Math.random) {
  requireRule(seats.length >= 2 && seats.length <= 4, '2~4명이 함께 출발합니다.')
  let serial = 0
  const instance = c => ({ ...c, uid: 'survivor-' + serial++, ready: false })
  const players = seats.map((seat, index) => {
    const l = LEADERS.find(l => l.id === seat.leaderId) ?? LEADERS[0]
    return { seatId: seat.id, id: seat.id, name: seat.name, leaderId: l.id, isBot: Boolean(seat.bot), color: COLORS[index], party: [],
      resources: { can: l.initialResources.can, bottleCap: l.initialResources.bottleCap + 4 }, route: 0, utopiaDie: 0, escaped: false, prepared: [], discoveries: [], fans: [], candidates: [], medical: {} }
  })
  const recruitDeck = shuffle(SURVIVOR_CARDS, random).map(instance)
  const slots = seats.length + 1, deck = [1, 2, 3].flatMap(tier => {
    const cards = LOCATIONS.filter(c => c.tier === tier), trades = cards.filter(c => c.interaction)
    const supply = cards.find(c => c.explorationType === 'supply' && !c.interaction)
    const scout = shuffle(cards.filter(c => c.explorationType === 'scout'), random)[0]
    const required = [...trades, supply, scout].filter(Boolean)
    return shuffle([...required, ...shuffle(cards.filter(c => !required.includes(c)), random).slice(0, slots + 1 - required.length)], random)
  })
  const g = { rulesVersion: VERSION, rulesRevision: 2, locationRevision: 7, omenRevision: 2, payoutRevision: 3, typeRevision: 1, abilityRevision: 3, recruitRevision: 1, dayNightRevision: 1, eventRevision: 1, balanceRevision: 1, automaticReturnRevision: 1, eventDeck: createEventDeck(shuffle, random), eventDiscard: [], eventSpaces: EVENT_SPACES.map(at => ({ at, used: false })), eventQueue: [], eventSerial: 0, activeEvent: null, phase: 'setup', day: 1, turnInDay: 0, firstPlayer: 0, currentPlayerIndex: 0, players, deck, recruitDeck,
    sites: [], market: [], stranded: [], pending: null, resolutionQueue: [], managementDone: [], omens: [], lastOmen: null, omenQueue: [],
    lastResult: null, gameEnded: false, log: ['출발 준비 · 지도자 물자와 영입 지원 병뚜껑 4개로 첫 파티를 구성하고 식사하세요.'] }
  g.market = Array.from({ length: 3 }, () => drawRecruit(g))
  for (let i = 0; i < slots; i++) g.sites.push(drawSite(g))
  return g
}
function siteFor(g, id) { const site = g.sites.find(s => s?.id === id); requireRule(site, '없는 탐색지입니다.'); return site }
function activeCard(p, uid) { const c = p.party.find(c => c.uid === uid && c.ready); requireRule(c, '내 거점의 준비된 동료를 선택하세요.'); return c }
function chosen(cards, uids, count) {
  requireRule(Array.isArray(uids) && new Set(uids).size === uids.length && (count == null || uids.length === count) && uids.every(uid => typeof uid === 'string' && cards.some(c => c.uid === uid)), '선택한 동료의 수와 소유권을 확인하세요.')
  return uids.map(uid => cards.find(c => c.uid === uid))
}
function recycleSurvivor(g, card, reason) {
  const { owner, slot, availableDay, previousOwner, returnCost, ...survivor } = card
  g.recruitDeck.push({ ...survivor, ready: false })
  log(g, card.name + ' · ' + reason + ' · 생존자 수색 덱 아래로')
}
function removeOwned(g, p, uid, reason) {
  const card = ownedCrew(g, p.seatId).find(c => c.uid === uid); requireRule(card, '내 동료를 선택하세요.')
  p.party = p.party.filter(c => c.uid !== uid); g.sites.forEach(s => { if (s) s.crew = s.crew.filter(c => c.uid !== uid) })
  recycleSurvivor(g, card, reason)
}
function rollCrew(crew, danger, random, modifier = 0) {
  const abilities = new Set(crew.map(c => c.ability)), notes = []
  let extra = 0
  if (abilities.has('scout') && new Set(crew.map(c => c.type)).size > 1) { extra++; notes.push('내 동료와 동행 +1개') }
  if (crew.filter(c => c.ability === 'twins').length >= 2) { extra++; notes.push('쌍둥이 동행 +1개') }
  const rolls = Array.from({ length: crew.length + extra }, () => dice(random)), before = [...rolls]
  if (abilities.has('teacher') && crew.length > 1) { const min = Math.min(...rolls); if (min <= 2) { rolls[rolls.indexOf(min)] = dice(random); notes.push('선생님: 최저 눈 재굴림') } }
  if (modifier) {
    const i = rolls.indexOf(Math.max(...rolls)); rolls[i] = Math.max(1, Math.min(6, rolls[i] + modifier))
    notes.push('사건: 최고 눈 ' + (modifier > 0 ? '+' : '') + modifier)
  }
  const lost = danger && rolls.includes(1) && !abilities.has('guard') ? [crew[0].uid] : []
  if (danger && rolls.includes(1) && abilities.has('guard')) notes.push('동료 보호: 실종 방지')
  const front = crew.filter(c => c.slot < 2 && c.type === '용감이').length
  const sorted = [...rolls].sort((a, b) => b - a); sorted[0] += front
  if (front) notes.push('앞쪽 용감이: 최고 눈 +' + front)
  return { rolls, before, notes, lost, sorted }
}
function awardPrize(g, p, site, prize, command = {}) {
  if (prize.kind === 'survivor') {
    if (command.decline) {
      g.pending.choices.push({ owner: p.seatId, ...prize, amount: 0, label: '생존자 영입 포기' }); log(g, p.name + ': 구조 보상 영입 포기'); return
    }
    const index = g.market.findIndex(c => c?.uid === command.uid), card = g.market[index]
    requireRule(card, '지금 공개된 생존자 중 한 명을 선택하세요.')
    if (command.replaceUid) removeOwned(g, p, command.replaceUid, '구조한 동료에게 자리를 양보함')
    addToParty(g, p, card, command.slot, site.card.name + ' · 구조'); g.market[index] = drawRecruit(g)
    g.pending.choices.push({ owner: p.seatId, ...prize, label: card.name + ' 영입' }); log(g, p.name + ': 구조 보상 · ' + card.name + ' 영입 · 밤에 식사 필요'); return
  }
  if (prize.kind === 'route') { advanceRoute(g, p, prize.amount); if (!p.discoveries.some(c => c.uid === site.id + '-' + p.seatId)) p.discoveries.push({ ...site.card, uid: site.id + '-' + p.seatId }) }
  else p.resources[prize.kind] += prize.amount
  gained(g, p, site.card.name, [{ kind: prize.kind, amount: prize.amount }])
  g.pending.choices.push({ owner: p.seatId, ...prize }); log(g, p.name + ': ' + prize.label + ' +' + prize.amount)
}
function rewardPicks(results) {
  return results.flatMap(r => r.sorted.map(value => ({ owner: r.owner, value, first: r.first })))
    .sort((a, b) => b.value - a.value || a.first - b.first)
}
// Sharing and first-come reward a choice per die/person. The winner of an all-prize site receives everything.
function advanceRewards(g, site) {
  if (g.omenQueue?.length || eventReady(g)) return
  const q = g.pending
  while (q.prizes.length && q.index < q.order.length) {
    const prize = q.prizes[0]
    if (site.card.distribution !== 'all' && (q.prizes.some(r => r.kind !== 'survivor') || g.market.some(Boolean))) return
    if (prize.kind === 'survivor' && g.market.some(Boolean)) return
    const p = g.players.find(p => p.seatId === q.order[q.index])
    awardPrize(g, p, site, prize, { decline: true })
    q.prizes.shift(); q.index++
    if (g.omenQueue?.length || eventReady(g)) return
  }
  finishExploration(g, site)
}
function firstComeExpedition(g, site) {
  const picks = site.crew.map((card, first) => ({ owner: card.owner, first, value: null }))
  const results = [...new Set(picks.map(pick => pick.owner))].map(owner => {
    const food = site.crew.filter(c => c.owner === owner && c.ability === 'dog').length * 2
    if (food) { const p = g.players.find(p => p.seatId === owner); p.resources.can += food; gained(g, p, '개 · 탐색 보급', [{ kind: 'can', amount: food }]); log(g, p.name + ': 개가 찾은 통조림 +' + food) }
    return { owner, rolls: [], sorted: [], lost: [], notes: ['선착순 · 주사위 없이 배치 순서로 획득'] }
  })
  g.pending = { stage: 'reward', siteId: site.id, picks, order: picks.map(pick => pick.owner), index: 0, results, prizes: explorationPrizes(site, g), choices: [], firstCome: true }
  log(g, site.card.name + ': 조건 충족 · 배치 순서대로 보상 선택')
  advanceRewards(g, site)
}
function rollExpedition(g, random) {
  const q = g.pending, site = siteFor(g, q.siteId), owners = [...new Set(site.crew.map(c => c.owner))]
  const results = owners.map((owner, first) => {
    const crew = site.crew.filter(c => c.owner === owner), p = g.players.find(p => p.seatId === owner)
    const food = crew.filter(c => c.ability === 'dog').length * 2
    if (food) { p.resources.can += food; gained(g, p, '개 · 탐색 보급', [{ kind: 'can', amount: food }]); log(g, p.name + ': 개가 찾은 통조림 +' + food) }
    return { owner, first, ...rollCrew(crew, true, random, eventModifier(g, p, 'exploreDie')) }
  })
  results.sort((a, b) => { for (let i = 0; i < Math.max(a.sorted.length, b.sorted.length); i++) { const d = (b.sorted[i] ?? 0) - (a.sorted[i] ?? 0); if (d) return d } return a.first - b.first })
  const picks = rewardPicks(results)
  Object.assign(q, { stage: 'reward', picks, order: site.card.distribution === 'all' ? results.map(r => r.owner) : picks.map(r => r.owner), index: 0, results, prizes: explorationPrizes(site, g), choices: [] })
  log(g, site.card.name + ': ' + results.map(r => g.players.find(p => p.seatId === r.owner).name + ' [' + r.rolls.join(', ') + ']').join(' / '))
  if (site.card.distribution === 'all') {
    q.picks = q.prizes.map((_, first) => ({ owner: results[0].owner, first, value: results[0].sorted[0] }))
    q.order = q.picks.map(pick => pick.owner)
  }
  advanceRewards(g, site)
}
function startManagement(g, index) {
  g.currentPlayerIndex = index
  const p = g.players[index]
  if (g.phase === 'maintenance' && !p.escaped) {
    const income = { ...leader(p).passiveIncome }; income.can = Math.max(0, income.can + eventModifier(g, p, 'incomeCan'))
    p.resources.can += income.can; p.resources.bottleCap += income.bottleCap
    gained(g, p, leader(p).name + ' · 지도자 보급', Object.entries(income).map(([kind, amount]) => ({ kind, amount })))
    log(g, p.name + ': 지도자 보급 · 통조림 +' + income.can + ' / 병뚜껑 +' + income.bottleCap)
  }
  p.searched = false; p.reserved = false; p.tradeUsed = false
}
function finishExploration(g, site) {
  const q = g.pending
  site.resolved = true
  for (const r of q.results) for (const uid of r.lost) {
    const card = site.crew.find(c => c.uid === uid)
    if (card) { recycleSurvivor(g, card, '탐색 주사위 1로 실종'); site.crew = site.crew.filter(c => c.uid !== uid) }
  }
  g.lastResult = { name: site.card.name, day: g.day, results: q.results, choices: q.choices, firstCome: Boolean(q.firstCome) }
  returnResolvedCrew(g, site)
  g.pending = null; if (g.phase === 'dispatch') nextDispatch(g); else nextResolution(g)
}
function failExploration(g, site, reason) {
  site.resolved = true; site.failed = reason
  g.lastResult = { name: site.card.name, day: g.day, results: [], choices: [], failed: reason }
  log(g, site.card.name + ' 탐색 실패 · ' + reason + ' · 보상 없음, 동료는 피로 상태로 귀환')
  returnResolvedCrew(g, site)
}
function threatenExploration(g, site, reason) {
  const order = [...new Set(site.crew.map(c => c.owner))].filter(id => counterCrew(g, site, id).length)
  if (order.length) g.pending = { stage: 'counter', siteId: site.id, reason, order, index: 0 }
  else failExploration(g, site, reason)
}
function nextResolution(g) {
  const id = g.resolutionQueue.shift()
  if (id) {
    const s = g.sites.find(s => s?.id === id)
    if (!s || s.resolved || !requirements(s).ready) { nextResolution(g); return }
    if (s.card.distribution === 'first') firstComeExpedition(g, s)
    else g.pending = { stage: 'roll', siteId: id, trigger: s.crew[0].owner, order: [], index: 0 }
    return
  }
  g.pending = null
  if (g.finalDay && (g.day >= g.finalDay || g.players.every(p => p.escaped))) { endGame(g); return }
  g.phase = 'maintenance'; g.managementDone = []
  startManagement(g, g.firstPlayer)
}
function nextDispatch(g) {
  // Actions and temporary responses resume this player until they end their day.
  const current = g.players[g.currentPlayerIndex]
  if (!current.passed && !current.escaped) return
  const remaining = g.players.filter(p => !p.passed && !p.escaped)
  if (!remaining.length) {
    g.phase = 'resolution'; g.resolutionQueue = g.sites.filter(s => s && !s.card.interaction && requirements(s).ready).map(s => s.id); nextResolution(g); return
  }
  do { g.currentPlayerIndex = (g.currentPlayerIndex + 1) % g.players.length } while (g.players[g.currentPlayerIndex].passed || g.players[g.currentPlayerIndex].escaped)
}
// Only parties at the gate compete. Each resource is scored separately, with no storage cap.
export function finalScore(g, p) {
  const utopia = p.utopiaPoints ?? 0, party = ownedCrew(g, p.seatId).reduce((n, c) => n + cardScore(c), 0)
  const supplies = Math.floor(p.resources.can / RULES.suppliesPerPoint) + Math.floor(p.resources.bottleCap / RULES.suppliesPerPoint)
  return { utopia, party, supplies, total: utopia + party + supplies }
}
function endGame(g) {
  g.gameEnded = true
  g.standings = g.players.map(p => ({ seatId: p.seatId, name: p.name, escaped: p.escaped, route: p.route, eligible: p.route >= RULES.route, ...finalScore(g, p) }))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.total - a.total || b.utopia - a.utopia)
  let rank = 1; g.standings.forEach((p, i, list) => {
    if (!p.eligible) { p.rank = null; return }
    if (i && ['total', 'utopia'].some(k => list[i - 1][k] !== p[k])) rank = i + 1
    p.rank = rank
  })
  log(g, '여정 종료 · ' + g.standings.map(p => p.name + (p.eligible ? ' ' + p.total + '점' : ' · 탈락 (' + p.route + '칸)')).join(' / '))
}
function startDay(g) {
  g.phase = 'dispatch'; g.turnInDay = 0; g.currentPlayerIndex = g.firstPlayer
  g.players.forEach(p => { p.passed = p.escaped })
  if (g.players[g.currentPlayerIndex].passed) nextDispatch(g)
  log(g, '낮 시작 · 생존자를 파견하거나 능력을 사용하세요. 생존자가 없으면 지도자로 안전한 탐색을 할 수 있습니다.')
}
function finishDay(g) {
  g.day++; g.firstPlayer = (g.firstPlayer + 1) % g.players.length
  const empty = g.sites.findIndex(s => s && !s.crew.length)
  if (empty >= 0 && (g.deck.length || g.siteDiscard.length)) g.sites[empty] = drawSite(g, g.sites[empty])
  startDay(g)
}
function advanceRoute(g, p, amount) {
  const before = p.route
  p.route += amount
  g.eventQueue ??= []
  for (const space of g.eventSpaces ?? []) if (!space.used && before < space.at && p.route >= space.at) {
    space.used = true; g.eventQueue.push({ at: space.at, actor: p.seatId })
  }
  g.eventQueue.sort((a,b) => a.at-b.at)
  g.omenQueue ??= []
  for (const o of g.omens ?? []) if (!o.revealed && p.route >= o.at && !g.omenQueue.some(q => q.at === o.at)) g.omenQueue.push({ at: o.at, actor: p.seatId })
  g.omenQueue.sort((a, b) => a.at - b.at)
}
// Suspend the exact reward decision; chained tiles finish before play resumes.
function finishOmen(g) {
  const omen = g.omens.find(o => o.tile.id === g.pending.omenId)
  if (omen) omen.resolved = true
  g.pending = null
  if (g.omenQueue.length) return
  const resume = g.omenResume
  delete g.omenResume
  g.pending = resume?.pending ?? null
  if (resume?.finishDay) finishDay(g)
  else if (g.pending?.stage === 'reward') advanceRewards(g, siteFor(g, g.pending.siteId))
}
function beginNextOmen(g, random) {
  if (['disaster', 'miracle'].includes(g.pending?.stage) || !g.omenQueue?.length) return
  g.omenResume ??= { pending: g.pending }
  const queued = g.omenQueue.shift(), omen = g.omens.find(o => o.at === queued.at)
  Object.assign(omen, { revealed: true, revealedDay: g.day })
  const d = { ...omen.tile, at: omen.at }
  log(g, omen.at + '칸 사건 공개 · ' + (d.kind === 'disaster' ? '재난 ' : '기적 ') + d.name + ' · 즉시 모든 파티')
  if (d.kind === 'miracle') {
    const results = g.players.map(p => {
      for (const [kind, amount] of Object.entries(d.gain)) if (kind !== 'route') p.resources[kind] += amount
      if (d.rest) p.party.forEach(c => { c.ready = true })
      gained(g, p, '기적 · ' + d.name, Object.entries(d.gain).map(([kind, amount]) => ({ kind, amount })))
      return { seatId: p.seatId, name: p.name, protected: false, lost: [] }
    })
    g.lastOmen = { ...d, results }
    for (const p of g.players) if (d.gain.route) advanceRoute(g, p, d.gain.route)
    g.pending = { stage: 'miracle', omenId: d.id, actor: queued.actor }
    return
  }
  const results = g.players.map(p => {
    const prayer = p.leaderId === 'duck' && !p.prepared.includes(d.id) ? dice(random) : null
    return { seatId: p.seatId, name: p.name, protected: p.prepared.includes(d.id) || prayer === 6, prayer, lost: [] }
  })
  g.lastOmen = { ...d, results }
  const order = results.filter(r => !r.protected).map(r => r.seatId)
  g.pending = { stage: 'disaster', omenId: d.id, order, index: 0, choice: true }
  if (!order.length) { finishOmen(g); beginNextOmen(g, random) }
}
// A revealed environment lasts through a full daytime before the next queued card.
function eventReady(g) { return Boolean(g.eventQueue?.length && (!g.activeEvent || g.day > (g.activeEvent.holdThroughDay ?? -1))) }
function beginNextEvent(g) {
  if (g.gameEnded || ['eventDraw','eventReveal','disaster','miracle'].includes(g.pending?.stage) || !eventReady(g)) return
  g.eventResume ??= { pending: g.pending }
  const queued = g.eventQueue.shift()
  g.pending = { stage:'eventDraw', actor:queued.actor, at:queued.at }
}
function continueEvent(g) {
  g.pending = null
  if (eventReady(g)) return
  g.pending = g.eventResume?.pending ?? null; delete g.eventResume
  if (g.pending?.stage === 'reward') advanceRewards(g, siteFor(g, g.pending.siteId))
}
function finishManagement(g, random) {
  const p = g.players[g.currentPlayerIndex]
  g.recruitDeck.push(...p.candidates); p.candidates = []; p.medical = {}
  g.managementDone.push(p.seatId)
  if (g.managementDone.length === g.players.length) {
    if (g.phase === 'setup') startDay(g)
    else finishDay(g)
    return
  }
  startManagement(g, (g.currentPlayerIndex + 1) % g.players.length)
}
function clearEmptyResolvedSites(g) {
  g.sites = g.sites.map(site => site?.resolved && !site.crew.length ? drawSite(g, site) : site)
}
function buy(g, p, c, discount = 0, sourceRestriction = null) {
  const pools = [g.market, p.fans, p.candidates]
  const card = pools.flat().find(card => card?.uid === c.uid)
  requireRule(card, '지금 영입할 수 있는 생존자를 선택하세요.')
  if (sourceRestriction) requireRule(sourceRestriction.some(card => card?.uid === c.uid), '이 능력으로 영입할 수 없는 대상입니다.')
  const resource = c.payment ?? 'bottleCap'
  requireRule(resource === 'bottleCap' || (resource === 'can' && p.leaderId === 'shy'), '샤이만 통조림으로 영입할 수 있습니다.')
  const cost = recruitCost(g, p, card, discount)
  requireRule(p.resources[resource] >= cost, '영입 물자가 부족합니다.')
  addToParty(g, p, card, c.slot, '생존자 영입'); p.resources[resource] -= cost
  const i = g.market.findIndex(card => card?.uid === c.uid)
  if (i >= 0) g.market[i] = drawRecruit(g)
  p.fans = p.fans.filter(card => card.uid !== c.uid); p.candidates = p.candidates.filter(card => card.uid !== c.uid)
  g.recruitDeck.push(...p.candidates); p.candidates = []
  log(g, p.name + ': ' + card.name + ' 영입 · ' + (resource === 'can' ? '통조림 ' : '병뚜껑 ') + cost + ' / 식사 후 다음 파견부터 사용')
}
function returnSurvivor(g, p, card) {
  const { owner, returnCost, ...survivor } = card
  p.party.push({ ...survivor, ready: false })
  log(g, p.name + ': ' + card.name + ' 귀환 · 피로 상태')
}
function returnResolvedCrew(g, site) {
  for (const card of site.crew) returnSurvivor(g, g.players.find(p => p.seatId === card.owner), card)
  site.crew = []
  const index = g.sites.indexOf(site)
  if (index >= 0) g.sites[index] = drawSite(g, site)
}
function swapSlots(g, p, from, to) {
  requireRule(!g.sites.some(s => s?.crew.some(c => c.owner === p.seatId && [from, to].includes(c.slot))), '파견 중인 동료의 자리는 바꿀 수 없습니다.')
  requireRule(Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= 0 && from < partyLimit(p) && to < partyLimit(p) && from !== to && p.party.some(c => c.slot === from), '바꿀 자리 두 곳을 선택하세요.')
  p.party.forEach(c => { if (c.slot === from) c.slot = to; else if (c.slot === to) c.slot = from })
  requireRule(relationsValid({ ...p, party: ownedCrew(g, p.seatId) }), '개와 고양이는 같은 자리나 인접한 자리에 둘 수 없습니다.')
}
function useAbility(g, p, command, random) {
  const site = g.sites.find(s => s?.crew.some(c => c.uid === command.uid && c.owner === p.seatId))
  if (site) {
    const card = site.crew.find(c => c.uid === command.uid)
    requireRule(!site.resolved && abilityPhase(card, g.phase, true), '이 파견 능력은 아직 끝나지 않은 탐색에서 사용합니다.')
    if (card.ability === 'sabotage') {
      site.crew = site.crew.filter(c => c.uid !== card.uid); recycleSurvivor(g, card, '탐색 방해의 대가')
      threatenExploration(g, site, card.name + '의 방해')
    } else {
      requireRule(requirements(site).ready && !site.chaosRoll, '출발 준비를 마친 탐색에서 한 번만 사용할 수 있습니다.')
      site.chaosRoll = dice(random); log(g, card.name + ' [' + site.chaosRoll + '] · ' + (site.chaosRoll <= 3 ? '탐색 실패' : '통조림·병뚜껑 ×2'))
      if (site.chaosRoll <= 3) threatenExploration(g, site, card.name + '의 도박 실패')
    }
    return
  }
  const card = activeCard(p, command.uid)
  requireRule(abilityPhase(card, g.phase), '이 시점에 직접 사용하는 능력이 아닙니다.')
  const other = g.players.find(x => x.seatId === command.targetPlayer && x.seatId !== p.seatId && !x.escaped)
  const before = { ...p.resources }
  card.ready = false
  switch (card.ability) {
    case 'captain':
      swapSlots(g, p, command.from, command.to); p.resources.can += 2; break
    case 'guide': {
      const from = g.sites.find(s => s && !s.resolved && s.crew.some(c => c.owner === p.seatId && c.uid === command.targetUid)), to = siteFor(g, command.siteId)
      requireRule(from && from !== to && !to.resolved && to.crew.length < siteCapacity(to.card), '내 파견자와 다른 미완성 탐색을 선택하세요.')
      const target = from.crew.find(c => c.uid === command.targetUid)
      from.crew = from.crew.filter(c => c !== target); to.crew.push(target); checkTaboo(g, to); break
    }
    case 'jam': {
      requireRule(other, '상대 파티를 선택하세요.'); const target = activeCard(other, command.targetUid)
      requireRule(!other.party.some(c => c.ability === 'guard' && c.ready && Math.abs(c.slot - target.slot) <= 1), '준비된 햄스터가 자신과 이웃 동료를 보호하고 있습니다.')
      target.ready = false; log(g, other.name + ': ' + target.name + ' 피로'); break
    }
    case 'hunter': { requireRule(other, '상대 파티를 선택하세요.'); const amount = Math.min(2, other.resources.bottleCap); other.resources.bottleCap -= amount; p.resources.bottleCap += amount; break }
    case 'tax': for (const x of g.players.filter(x => x !== p && !x.escaped)) { const n = Math.min(1, x.resources.bottleCap); x.resources.bottleCap -= n; p.resources.bottleCap += n } break
    case 'wizard': {
      requireRule(['can', 'bottleCap'].includes(command.resource) && p.resources[command.resource] >= 2, '변환할 재화 2개가 필요합니다.')
      p.resources[command.resource] -= 2; p.resources[command.resource === 'can' ? 'bottleCap' : 'can'] += 4; break
    }
    case 'shelter': {
      requireRule(g.activeEvent?.card.kind === 'disaster' && p.eventProtection !== g.activeEvent.serial, '공개된 재난이 있고 아직 보호받지 않는 파티만 사용할 수 있습니다.')
      p.eventProtection = g.activeEvent.serial; break
    }
    case 'doctor': { const target = ownedCrew(g, p.seatId).find(c => c.uid === command.targetUid && c.uid !== card.uid); requireRule(target && !p.medical[target.uid], '이번 밤 무료 식사를 받을 다른 내 동료를 선택하세요.'); p.medical[target.uid] = RULES.mealCost; p.resources.can++; break }
    case 'vet': case 'recruiter': buy(g, p, { ...command, uid: command.targetUid }, card.ability === 'vet' ? 1 : 2, g.market); break
    case 'runner': {
      p.resources.can += 4; gained(g, p, card.name, [{ kind: 'can', amount: 4 }]); const roll = dice(random); log(g, '탈옥수 [' + roll + '] · 통조림 +4')
      if (roll === 1) {
        const target = g.players.find(x => x !== p && !x.escaped && joinSlot({ ...x, party: ownedCrew(g, x.seatId) }, card) >= 0)
        p.party = p.party.filter(c => c.uid !== card.uid)
        const food = Math.min(2, p.resources.can); p.resources.can -= food
        if (target) { addToParty(g, target, card); target.resources.can += food; gained(g, target, card.name + ' · 동행 식량', [{ kind: 'can', amount: food }]); log(g, target.name + '에게 탈옥수와 식량 ' + food + ' 이동') }
        else recycleSurvivor(g, card, '탈옥수의 이탈')
      }
      break
    }
    default: throw new Error('지원하지 않는 낮 활동 능력입니다.')
  }
  if (card.ability !== 'runner') gained(g, p, card.name, Object.keys(before).map(kind => ({ kind, amount: p.resources[kind] - before[kind] })))
  log(g, p.name + ': ' + card.name + ' 능력 사용')
}
function proposeTrade(g, p, c, site = null) {
  const target = g.players.find(x => x.seatId === c.targetPlayer && x !== p && !x.escaped)
  requireRule(target, '교환할 다른 파티를 선택하세요.')
  if (site) {
    requireRule(site.card.interaction && requirements(site).ready && site.crew.some(x => x.owner === p.seatId), '교환 장소의 조건을 채우고 내 동료를 파견하세요.')
    requireRule(site.offered?.[p.seatId] !== g.day, '이 장소에는 파티마다 하루 한 번 제안할 수 있습니다.')
  } else requireRule(!p.tradeUsed, '밤마다 한 번 교환을 제안할 수 있습니다.')
  const barter = site?.card.interaction === 'barter'
  if (barter) {
    requireRule(['can', 'bottleCap'].includes(c.resource), '교환할 재화를 선택하세요.')
    const other = c.resource === 'can' ? 'bottleCap' : 'can'
    requireRule(p.resources[c.resource] >= 2 && target.resources[other] >= 2, '양쪽 모두 교환할 재화 2개가 필요합니다.')
    g.pending = { stage: 'barter', actor: target.seatId, proposer: p.seatId, resource: c.resource, other, siteId: site.id }
  } else {
    const a = p.party.find(x => x.uid === c.uid), b = target.party.find(x => x.uid === c.targetUid)
    requireRule(a && b, '양쪽 거점의 교환 대상을 선택하세요.')
    const pa = copy(p), pb = copy(target)
    pa.party = pa.party.filter(x => x.uid !== a.uid); pb.party = pb.party.filter(x => x.uid !== b.uid)
    addToParty(g, pa, b, a.slot); addToParty(g, pb, a, b.slot)
    g.pending = { stage: 'trade', actor: target.seatId, proposer: p.seatId, give: c.uid, take: c.targetUid, ...(site ? { siteId: site.id } : {}) }
  }
  if (site) site.offered = { ...site.offered, [p.seatId]: g.day }
  else p.tradeUsed = true
  log(g, p.name + ' → ' + target.name + ': ' + (barter ? '물물교환' : '생존자 교환') + ' 제안')
}
function applyPlayerCommand(game, playerId, command, random) {
  requireRule(game && !game.gameEnded, '종료된 게임입니다.')
  requireRule(game.rulesVersion === VERSION, '이전 규칙의 방입니다. 구판에서 계속하거나 새 방을 만들어 주세요.')
  requireRule(command && typeof command.type === 'string', '행동을 선택하세요.')
  const g = upgradeGame(copy(game))
  requireRule(actorId(g) === playerId, '현재 선택할 파티의 차례를 기다려 주세요.')
  const p = g.players.find(p => p.seatId === playerId), c = command, q = g.pending
  if (q) {
    if (q.stage === 'eventDraw') {
      requireRule(c.type === 'drawEvent', '진행도 아래 사건 덱에서 한 장 공개하세요.')
      requireRule(g.eventDeck.length, '공개할 사건 카드가 없습니다.')
      if (g.activeEvent) g.eventDiscard.push(g.activeEvent.card)
      const card = g.eventDeck.shift(), serial = ++g.eventSerial
      g.activeEvent = { card, serial, at:q.at, holdThroughDay:g.day + Number(g.phase !== 'dispatch') }
      for (const party of g.players) {
        delete party.eventProtection
        if (card.kind === 'disaster' && party.leaderId === 'duck') {
          const prayer = dice(random); if (prayer === 6) party.eventProtection = serial
          log(g, party.name + ': 재난 기도 [' + prayer + ']' + (prayer === 6 ? ' · 이번 사건 보호' : ''))
        }
      }
      log(g, q.at + '칸 · 사건 공개: ' + card.name + ' · ' + card.text)
      g.pending = { stage:'eventReveal', actor:playerId, at:q.at }; return g
    }
    if (q.stage === 'eventReveal') {
      requireRule(c.type === 'continueEvent', '공개된 사건 카드를 확인하세요.')
      continueEvent(g); return g
    }
    if (q.stage === 'counter') {
      requireRule(c.type === 'counter' && typeof c.use === 'boolean', '반격 사용 또는 넘기기를 선택하세요.')
      const site = siteFor(g, q.siteId)
      if (c.use) {
        const card = counterCrew(g, site, playerId).find(x => x.uid === c.uid)
        requireRule(card, '동행 중이거나 거점에서 준비된 내 반격 동료를 선택하세요.')
        removeOwned(g, p, card.uid, '탐색 실패를 막음')
        if (q.reason === hazardText(site.card)) site.hazardCancelled = true
        log(g, p.name + ': ' + card.name + ' 반격 · 탐색 실패 취소')
      } else if (++q.index < q.order.length) return g
      else failExploration(g, site, q.reason)
      g.pending = null
      const first = g.sites.find(s => s?.card.distribution === 'first' && requirements(s).ready)
      if (first) firstComeExpedition(g, first); else nextDispatch(g)
      return g
    }
    if (q.stage === 'trade' || q.stage === 'barter') {
      requireRule(c.type === 'tradeReply' && typeof c.accept === 'boolean', '교환 수락 또는 거절을 선택하세요.')
      const from = g.players.find(x => x.seatId === q.proposer), site = q.siteId ? siteFor(g, q.siteId) : null
      if (c.accept) {
        if (q.stage === 'barter') {
          requireRule(from.resources[q.resource] >= 2 && p.resources[q.other] >= 2, '교환할 재화가 부족합니다.')
          from.resources[q.resource] -= 2; p.resources[q.resource] += 2
          p.resources[q.other] -= 2; from.resources[q.other] += 2
          gained(g, p, '물물교환', [{ kind: q.resource, amount: 2 }]); gained(g, from, '물물교환', [{ kind: q.other, amount: 2 }])
        } else {
          const a = from.party.find(x => x.uid === q.give), b = p.party.find(x => x.uid === q.take)
          requireRule(a && b, '교환 대상이 파티에 없습니다.')
          from.party = from.party.filter(x => x !== a); p.party = p.party.filter(x => x !== b)
          addToParty(g, from, b, a.slot); addToParty(g, p, a, b.slot)
        }
        if (site) {
          site.resolved = true
          const bonus = explorationPrizes(site)[0].amount
          from.resources.bottleCap += bonus; p.resources.bottleCap += bonus
          for (const party of [from, p]) gained(g, party, '교환 성사', [{ kind: 'bottleCap', amount: bonus }])
          g.lastResult = { name: site.card.name, day: g.day, results: [], choices: [from, p].map(x => ({ owner: x.seatId, id: 'trade-bonus', kind: 'bottleCap', amount: bonus, label: '교환 성사 · 병뚜껑' })) }
          returnResolvedCrew(g, site)
        }
      }
      log(g, p.name + ': 교환 ' + (c.accept ? '수락' + (q.stage === 'trade' ? ' · 두 동료 피로' : '') : '거절 · 거래 불발'))
      g.pending = null
      if (site) nextDispatch(g)
      return g
    }
    if (q.stage === 'leader') {
      requireRule(c.type === 'leaderChoice', '지도자 능력 대상을 선택하세요.')
      const owner = g.players.find(x => x.party.some(card => card.uid === c.uid))
      const target = owner?.party.find(card => card.uid === c.uid && card.type === '용감이')
      requireRule(target && (q.mode === 'lose' ? owner === p : owner !== p && !owner.escaped), '용감이 대상을 확인하세요.')
      if (q.mode === 'lose') removeOwned(g, p, target.uid, '비의 좀비 행동')
      else { owner.party = owner.party.filter(card => card.uid !== c.uid); addToParty(g, p, target, c.slot) }
      g.pending = null; finishManagement(g, random); return g
    }
    if (q.stage === 'miracle') {
      requireRule(c.type === 'continueOmen', '기적 결과를 확인하세요.')
      finishOmen(g); return g
    }
    if (q.stage === 'disaster') {
      const d = g.lastOmen, result = d.results.find(x => x.seatId === playerId)
      if (c.type === 'shelter' && q.choice) {
        const card = activeCard(p, c.uid)
        requireRule(card.ability === 'shelter', '대피소 능력을 가진 동료를 선택하세요.')
        card.ready = false; p.prepared.push(d.id); result.protected = true
        log(g, p.name + ': ' + card.name + ' · 재난 대비')
      } else if (c.type === 'prepare' && q.choice) {
        if (c.uids != null) {
          const crew = chosen(p.party.filter(x => x.ready), c.uids, d.crew)
          requireRule(disasterCrewValid(d, crew), '재난에 인쇄된 인원수와 필수 타입을 확인하세요.')
          crew.forEach(x => { x.ready = false })
        } else { requireRule(p.resources[d.resource] >= d.cost, '대비 물자가 부족합니다.'); p.resources[d.resource] -= d.cost }
        p.prepared.push(d.id); result.protected = true
        log(g, p.name + ': ' + d.name + ' 대비 완료')
      } else {
        requireRule(c.type === 'disasterLoss', '물자 지불·동료 사용·피해 감수 중 하나를 선택하세요.')
        const cards = chosen(ownedCrew(g, playerId), c.uids, Math.min(d.peopleLoss, crewCount(g, playerId)))
        if (q.choice) {
          for (const [key, amount] of Object.entries(d.loss)) p.resources[key] = Math.max(0, p.resources[key] - amount)
          p.route = Math.max(0, p.route - (d.routeLoss ?? 0))
        }
        for (const card of cards) { removeOwned(g, p, card.uid, d.name); result.lost.push(card.name) }
        log(g, p.name + ': ' + d.name + ' 피해 감수 · 낙오 ' + cards.length + '명')
      }
      if (++q.index === q.order.length) finishOmen(g)
      return g
    }
    const site = siteFor(g, q.siteId)
    if (q.stage === 'roll') { requireRule(c.type === 'roll', '탐색 주사위를 굴려 주세요.'); rollExpedition(g, random) }
    else if (q.stage === 'reward') {
      const prize = q.prizes.find(prize => prize.id === c.prize)
      requireRule(c.type === 'claim' && prize, '남은 보상 중 하나를 선택하세요.')
      awardPrize(g, p, site, prize, c); q.prizes = q.prizes.filter(r => r.id !== prize.id); q.index++
      advanceRewards(g, site)
    }
    return g
  }
  if (c.type === 'solveEvent') {
    requireRule(g.activeEvent && c.serial === g.activeEvent.serial, '현재 공개된 사건을 선택하세요.')
    const event = g.activeEvent.card, crew = chosen(p.party.filter(c => c.ready), c.uids, event.crew)
    requireRule(canSolveEvent(g, p, crew), '낮에 사건의 인원·타입과 병뚜껑 조건을 함께 지불해야 합니다.')
    p.resources.bottleCap -= eventSolveCost(g, p); crew.forEach(c => { c.ready = false })
    const before = eventBonus(p); p.utopiaDie = Math.min(6, before + 1)
    gained(g, p, event.name + ' 해결', [{ kind:'utopiaDie', amount:p.utopiaDie-before, value:p.utopiaDie }])
    log(g, p.name + ': ' + event.name + ' 해결 · 유토피아 주사위 ' + p.utopiaDie + ' · 환경 효과 유지')
    g.activeEvent.solvedBy = playerId
    g.turnInDay++; nextDispatch(g); return g
  }
  if (c.type === 'escape') {
    const crew = chosen(p.party.filter(x => x.ready), c.uids, RULES.escapePeople)
    requireRule(canEscape(g, p, crew), '낮의 내 차례에 하루 한 번: 여정 ' + RULES.route + '칸·서로 다른 타입 3명·식량 3개·전원 귀환이 필요합니다.')
    const result = rollCrew(crew, false, random), bonus = escapeBonus(p), eventDie = eventBonus(p), total = result.sorted.slice(0, RULES.escapePeople).reduce((a,b) => a+b,0) + eventDie
    crew.forEach(x => { x.ready = false }); p.resources.can -= RULES.escapeFood; p.escapeDay = g.day
    if (result.sorted.length > RULES.escapePeople) result.notes.push('높은 주사위 3개만 합산')
    if (eventDie) result.notes.push('사건 해결 · 유토피아 주사위 +' + eventDie)
    const success = total >= RULES.utopiaTarget
    // The first entry starts the final round: finish this day and night, play one more day, then score.
    const first = success && !g.finalDay, points = success ? (first ? RULES.utopiaFirst : RULES.utopiaLater) : 0
    g.lastUtopia = { ...result, owner: playerId, name: p.name, day: g.day, total, success, target: RULES.utopiaTarget, bonus, eventDie, points, first }
    if (success) { p.escaped = true; p.passed = true; p.utopiaPoints = points; if (first) g.finalDay = g.day + 1 }
    log(g, p.name + ': 유토피아 합계 ' + total + (success ? ' · 유토피아 진입 +' + points + '점' + (first ? ' · 다음 낮이 마지막 라운드' : '') : ' · 실패, 참가자 피로'))
    g.turnInDay++; nextDispatch(g)
    return g
  }
  requireRule(!p.escaped || c.type === 'endManagement', '유토피아에 진입한 파티는 정비를 마치고 여정 종료를 기다립니다.')
  if (g.phase === 'dispatch') {
    requireRule(!p.passed && !p.escaped, '파견을 종료한 파티입니다.')
    if (c.type === 'dispatch') {
      const site = siteFor(g, c.siteId)
      requireRule(!site.resolved, '이미 정산된 탐색입니다. 다른 탐색을 선택하세요.')
      requireRule(!(c.food || c.caps), '탐색 출발에는 재화를 지불하지 않습니다.')
      const uids = c.uids ?? [c.uid]
      requireRule(Array.isArray(uids) && uids.length >= 1 && uids.length <= dispatchLimit(g, p) && site.crew.length + uids.length <= siteCapacity(site.card), '한 번에 동료 1~' + dispatchLimit(g, p) + '명, 이 탐색에는 최대 ' + siteCapacity(site.card) + '명을 파견합니다.')
      const crew = chosen(p.party.filter(x => x.ready), uids)
      p.party = p.party.filter(x => !uids.includes(x.uid)); site.crew.push(...crew.map(x => ({ ...x, owner: playerId, ready: false })))
      log(g, p.name + ': ' + crew.map(x => x.name).join('·') + ' → ' + site.card.name)
      checkTaboo(g, site)
    } else if (c.type === 'offerTrade') {
      proposeTrade(g, p, c, siteFor(g, c.siteId))    } else if (c.type === 'ability') {
      useAbility(g, p, c, random)
    } else if (c.type === 'forage') {
      requireRule(ownedCrew(g, playerId).length === 0, '생존자가 없을 때만 안전한 탐색을 할 수 있습니다.')
      requireRule(p.forageDay !== g.day, '안전한 탐색은 하루에 한 번만 가능합니다.')
      p.forageDay = g.day
      const can = 1 + eventModifier(g,p,'forageCan'), caps = 1 + eventModifier(g,p,'forageCap')
      p.resources.can += can; p.resources.bottleCap += caps
      gained(g, p, '안전한 탐색', [{ kind: 'can', amount: can }, { kind: 'bottleCap', amount: caps }])
      log(g, p.name + ': 안전한 탐색 · 통조림 +' + can + ' / 병뚜껑 +' + caps)
    } else if (c.type === 'pass') { p.passed = true; log(g, p.name + ': 낮 활동 종료') }
    else if (c.type === 'withdraw') { throw new Error('귀환은 밤에 결정합니다.')
    } else if (c.type === 'replaceSite') {
      const card = activeCard(p, c.uid), site = siteFor(g, c.siteId), cost = card.type === '4차원' && card.slot === 2 ? 0 : 1
      requireRule(!site.crew.length && (g.deck.length || g.siteDiscard.length) && p.resources.can >= cost, '동료가 없는 장소와 교체할 덱, 식량이 필요합니다.')
      card.ready = false; p.resources.can -= cost; g.sites[g.sites.indexOf(site)] = drawSite(g, site)
    } else throw new Error('지금은 낮입니다. 일반 영입·식사는 밤에 진행합니다.')
    g.turnInDay++
    if (!g.pending) {
      const first = g.sites.find(s => s?.card.distribution === 'first' && requirements(s).ready)
      if (first) firstComeExpedition(g, first); else nextDispatch(g)
    }
    return g
  }
  requireRule(['setup', 'maintenance'].includes(g.phase), '탐색 해결을 먼저 마치세요.')
  switch (c.type) {
    case 'recruit': buy(g, p, c); break
    case 'returnOne': {
      requireRule(g.phase === 'maintenance', '진행 중인 탐색의 동료는 밤에 귀환합니다.')
      const site = g.sites.find(s => s?.crew.some(card => card.uid === c.uid && card.owner === playerId)), card = site?.crew.find(card => card.uid === c.uid)
      requireRule(card, '내 파견 동료를 선택하세요.')
      returnSurvivor(g, p, card)
      site.crew = site.crew.filter(x => x.uid !== card.uid)
      clearEmptyResolvedSites(g)
      break
    }
    case 'feed': {
      const card = p.party.find(x => x.uid === c.uid && !x.ready)
      requireRule(card, '피로한 내 거점 동료를 선택하세요.')
      const cost = mealCost(p, card, g)
      requireRule(p.resources.can >= cost, '식사할 통조림이 부족합니다.')
      p.resources.can -= cost; card.ready = true
      log(g, p.name + ': ' + card.name + ' 식사 · 통조림 ' + cost + ' · 준비 완료')
      break
    }
    case 'ability': useAbility(g, p, c, random); break
    case 'reorder': { const cost = reorderCost(p); requireRule(p.resources.bottleCap >= cost, '재배치 병뚜껑이 부족합니다.'); swapSlots(g, p, c.from, c.to); p.resources.bottleCap -= cost; break }
    case 'dismiss': requireRule(p.party.some(x => x.uid === c.uid), '거점의 내 동료를 선택하세요.'); removeOwned(g, p, c.uid, '파티에서 떠남'); break
    case 'search': {
      const index = c.index, cost = p.party.some(x => x.slot === 2 && x.type === '분위기메이커') ? 0 : 1
      requireRule(!p.searched && Number.isInteger(index) && index >= 0 && index < 3 && p.resources.can >= cost && g.recruitDeck.length, '수색은 밤마다 한 번이며 교체할 자리와 식량이 필요합니다.')
      p.searched = true; p.resources.can -= cost
      if (p.leaderId === 'robot') { p.candidates = [drawRecruit(g), drawRecruit(g)].filter(Boolean); log(g, p.name + ': HAL 후보 ' + p.candidates.length + '장 확인') }
      else { const old = g.market[index]; g.market[index] = drawRecruit(g); if (old) g.recruitDeck.push(old) }
      break
    }
    case 'reserve': {
      const i = g.market.findIndex(x => x?.uid === c.uid)
      requireRule(p.leaderId === 'idol' && !p.reserved && p.fans.length < 3 && i >= 0, '소염은 밤마다 한 번, 예비 팬 최대 3명을 확보합니다.')
      gained(g, p, '예비 팬 확보', [{ kind: 'survivor', name: g.market[i].name, amount: 1 }])
      p.fans.push(g.market[i]); g.market[i] = drawRecruit(g); p.reserved = true; break
    }
    case 'prepare': throw new Error('재난 공개 직후 팝업에서 대비 방법을 선택하세요.')
    case 'offerTrade': proposeTrade(g, p, c); break
    case 'endManagement': {
      const cards = chosen(p.party.filter(x => !x.ready), c.uids), cost = cards.reduce((sum, x) => sum + mealCost(p, x, g), 0)
      requireRule(p.resources.can >= cost, '선택한 동료의 식량이 부족합니다.'); p.resources.can -= cost; cards.forEach(x => { x.ready = true })
      log(g, p.name + ': 식사 ' + cards.length + '명 / 통조림 ' + cost + ' · 밤 종료')
      if (g.phase === 'maintenance' && !p.escaped && p.leaderId === 'zombie') {
        const roll = dice(random); log(g, '비의 좀비 행동 [' + roll + ']')
        if (roll === 1 && p.party.some(x => x.type === '용감이')) { g.pending = { stage: 'leader', actor: p.seatId, mode: 'lose' }; break }
        if (roll === 6 && g.players.some(x => x !== p && !x.escaped && x.party.some(card => card.type === '용감이' && joinSlot({ ...p, party: ownedCrew(g, p.seatId) }, card) >= 0))) { g.pending = { stage: 'leader', actor: p.seatId, mode: 'steal' }; break }
      }
      finishManagement(g, random); break
    }
    default: throw new Error('지금은 출발 준비 또는 밤 정비 단계입니다.')
  }
  return g
}
export function upgradeGame(g) {
  if (!g) return g
  if ((g.recruitRevision ?? 0) < 1) {
    const keep = card => card?.ability !== 'plain'
    g.recruitDeck = g.recruitDeck.filter(keep)
    g.market = g.market.map(card => keep(card) ? card : drawRecruit(g))
    g.stranded = g.stranded.filter(keep)
    for (const p of g.players) { p.fans = p.fans.filter(keep); p.candidates = p.candidates.filter(keep) }
    // Already recruited or deployed survivors stay in their party; only the recruitment pool shrinks.
    g.recruitRevision = 1
  }
  if ((g.rulesRevision ?? 1) < 2) {
    g.rulesRevision = 2
    if (g.pending?.stage === 'return' && g.phase === 'resolution') {
      if (g.pending.incomplete) { g.pending = null; nextResolution(g) }
      else finishExploration(g, siteFor(g, g.pending.siteId))
    }
  }
  const q = g.pending
  if (q?.stage === 'reward' && !q.picks) {
    const remaining = rewardPicks(q.results)
    const used = q.choices.map(choice => remaining.splice(remaining.findIndex(pick => pick.owner === choice.owner), 1)[0])
    q.picks = [...used, ...remaining]; q.order = q.picks.map(pick => pick.owner); q.index = used.length
  }
  if ((g.locationRevision ?? 0) < 7) {
    const refresh = card => ({ ...card, ...LOCATIONS.find(c => c.id === card.id) })
    g.deck = g.deck.map(refresh)
    g.siteDiscard = (g.siteDiscard ?? []).map(refresh)
    for (const site of g.sites) {
      if (site && !site.crew.length && !site.food && !site.caps && !site.resolved && site.id !== q?.siteId) site.card = refresh(site.card)
    }
    g.locationRevision = 7
  }
  if ((g.typeRevision ?? 0) < 1) {
    const refresh = card => ({ ...card, ...LOCATIONS.find(c => c.id === card.id) })
    g.deck = g.deck.map(refresh)
    for (const site of g.sites) if (site && !site.crew.length && !site.food && !site.caps && !site.resolved && site.id !== q?.siteId) site.card = refresh(site.card)
    g.typeRevision = 1
  }
  if ((g.payoutRevision ?? 0) < 2) {
    const oldRevision = g.payoutRevision ?? 0
    const refresh = card => ({ ...card, ...LOCATIONS.find(c => c.id === card.id) })
    g.deck = g.deck.map(refresh)
    for (const site of g.sites) {
      if (!site) continue
      if (!site.crew.length && !site.resolved && site.id !== q?.siteId) site.card = refresh(site.card)
      site.card.food = 0; site.card.caps = 0
    }
    g.payoutRevision = 2
    if (oldRevision < 1 && q?.stage === 'reward') advanceRewards(g, siteFor(g, q.siteId))
  }
  g.payoutRevision = 3
  if ((g.abilityRevision ?? 0) < 3) {
    const away = g.sites.flatMap(s => s?.crew ?? [])
    const cards = [...g.recruitDeck, ...g.market, ...g.stranded, ...g.players.flatMap(p => [...p.party, ...p.fans, ...p.candidates]), ...away]
    for (const card of cards) {
      const definition = card && SURVIVOR_CARDS.find(c => c.id === card.id)
      if (definition) { const cost = card.returnCost; Object.assign(card, definition); if (away.includes(card)) card.returnCost = cost }
    }
    // Existing investments retain their promised return cost; no physical cards or resources are added.
    g.abilityRevision = 3
  }
  if ((g.omenRevision ?? 0) < 1) {
    // The journey track doubled: scale progress and promised route bundles; omens already passed stay face up without effect.
    let seed = g.players.reduce((n, p) => [...p.seatId].reduce((m, ch) => (m * 31 + ch.charCodeAt(0)) >>> 0, n), 7)
    const seeded = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
    const scale = r => r.kind === 'route' ? { ...r, amount: r.amount * 2 } : r
    g.players.forEach(p => { p.route *= 2 })
    for (const site of g.sites) if (site && (site.crew.length || site.food || site.caps || site.resolved || site.id === q?.siteId)) site.card = { ...site.card, rewards: site.card.rewards?.map(scale), rewardRoute: (site.card.rewardRoute ?? 0) * 2 }
    if (q?.prizes) q.prizes = q.prizes.map(scale)
    g.omens = createOmens(shuffle, seeded)
    const lead = Math.max(0, ...g.players.map(p => p.route))
    for (const o of g.omens) if (o.at <= lead) Object.assign(o, { revealed: true, resolved: true })
    if (q?.stage === 'disaster') { g.lastOmen = { ...OMEN_TILES.find(t => t.legacyDay === q.disasterDay), ...g.lastDisaster }; q.omenId = g.lastOmen.id }
    delete g.disastersResolved; delete g.lastDisaster
    g.omenRevision = 1
  }
  if ((g.omenRevision ?? 0) < 2) {
    g.omenQueue = g.omens.filter(o => o.revealed && !o.resolved && o.tile.id !== g.pending?.omenId).map(o => ({ at: o.at, actor: g.players[g.currentPlayerIndex].seatId }))
    if (g.pending?.stage === 'disaster') g.omenResume = { pending: null, finishDay: true }
    const cards = [...g.recruitDeck, ...g.market, ...g.stranded, ...g.players.flatMap(p => [...p.party, ...p.fans, ...p.candidates]), ...g.sites.flatMap(s => s?.crew ?? [])]
    for (const card of cards) if (card?.ability === 'shelter') Object.assign(card, { timing: '재난', text: SURVIVOR_CARDS.find(c => c.ability === 'shelter').text })
    g.omenRevision = 2
  }
  if ((g.dayNightRevision ?? 0) < 1) {
    const away = g.sites.flatMap(s => s?.crew ?? [])
    const cards = [...g.recruitDeck, ...g.market, ...g.stranded, ...g.players.flatMap(p => [...p.party, ...p.fans, ...p.candidates]), ...away]
    for (const card of cards) {
      const definition = card && SURVIVOR_CARDS.find(c => c.id === card.id)
      if (definition) { const cost = card.returnCost; Object.assign(card, definition); if (away.includes(card)) card.returnCost = cost }
      if (card) delete card.mealCost
    }
    // Preserve paid actions and pending decisions; only future actions follow the new cycle.
    for (const p of g.players) delete p.managementUsed
    g.dayNightRevision = 1
  }
  if ((g.eventRevision ?? 0) < 1) {
    const old = g.omens ?? [], queued = g.omenQueue ?? []
    g.eventDeck = old.filter(o => !o.revealed || queued.some(q => q.at === o.at)).map(o => EVENT_CARDS.find(c => c.id === o.tile.id)).filter(Boolean)
    if (!old.length) g.eventDeck = EVENT_CARDS.filter((c,i) => i % 4 < 2).map(c=>({...c}))
    g.eventDiscard = old.filter(o => o.revealed && !queued.some(q => q.at === o.at)).map(o => EVENT_CARDS.find(c => c.id === o.tile.id)).filter(Boolean)
    g.eventSpaces = EVENT_SPACES.map(at => ({ at, used:old.some(o => o.at === at && o.revealed) || queued.some(q => q.at === at) || g.players.some(p=>p.route >= at) }))
    g.eventQueue = queued; g.omenQueue = []; g.eventSerial = 0; g.activeEvent = null
    for (const p of g.players) p.utopiaDie = eventBonus(p)
    const cards = [...g.recruitDeck,...g.market,...g.stranded,...g.players.flatMap(p=>[...p.party,...p.fans,...p.candidates]),...g.sites.flatMap(s=>s?.crew??[])]
    for (const c of cards) if(c?.ability==='shelter') { const d=SURVIVOR_CARDS.find(x=>x.ability==='shelter'); c.timing=d.timing; c.text=d.text }
    // Keep only an already-open old decision so it can finish without charging anyone twice.
    g.omens = old.filter(o=>o.revealed)
    g.eventRevision = 1
  }
  if (!g.balanceRevision) {
    if (g.activeEvent) g.activeEvent.holdThroughDay = g.day
    g.balanceRevision = 1
  }
  if (!g.automaticReturnRevision) {
    for (const card of g.stranded ?? []) recycleSurvivor(g, card, '이전 더미 정리')
    g.stranded = []
    for (const site of [...g.sites]) if (site?.resolved) returnResolvedCrew(g, site)
    if (g.pending?.stage === 'return') g.pending = null
    for (const card of [...g.recruitDeck, ...g.market, ...g.players.flatMap(p => [...p.party, ...p.fans, ...p.candidates]), ...g.sites.flatMap(s => s?.crew ?? [])]) {
      if (!card) continue
      delete card.returnCost
      const definition = SURVIVOR_CARDS.find(c => c.id === card.id)
      if (definition) { card.text = definition.text; card.timing = definition.timing }
    }
    for (const event of [...(g.eventDeck ?? []), ...(g.eventDiscard ?? []), g.activeEvent?.card].filter(Boolean)) {
      const definition = EVENT_CARDS.find(c => c.id === event.id)
      if (definition) Object.assign(event, definition)
    }
    g.automaticReturnRevision = 1
  }
  return g
}
export function applyCommand(game, playerId, command, random = Math.random) {
  const g = applyPlayerCommand(game, playerId, command, random)
  beginNextOmen(g, random)
  beginNextEvent(g)
  return g
}
export function publicGame(game, playerId) {
  if (!game) return null
  const g = upgradeGame(copy(game)); g.deck = g.deck.map(() => null); g.recruitDeck = g.recruitDeck.map(() => null)
  g.players.forEach(p => { if (p.seatId !== playerId) p.candidates = p.candidates.map(() => null) })
  g.omens = publicOmens(g.omens)
  g.eventDeck = g.eventDeck.map(() => null)
  g.localPlayerIndex = g.players.findIndex(p => p.seatId === playerId); return g
}
// ponytail: visible-state heuristics for diagnostics; human playtests must verify strategic balance.
export function botCommand(g, strategy = 'balanced') {
  const id = actorId(g), p = g.players.find(p => p.seatId === id), q = g.pending
  const crew = ownedCrew(g, id), finalTurn = Boolean(g.finalDay && g.day >= g.finalDay)
  const partyTarget = p.route >= 12 ? 5 : ['rush', 'opportunist'].includes(strategy) ? 4 : 5
  const foodBudget = Math.max(4, crew.reduce((sum,c) => sum + mealCost(p,c,g),0)) + (p.route >= RULES.route - 3 ? RULES.escapeFood : 0)
  const capBudget = (crew.length < partyTarget ? 4 : 1) + (strategy === 'prepared' && !g.activeEvent?.solvedBy ? eventSolveCost(g,p) : 0)
  const prizeValue = prize => {
    if (prize.kind === 'route' && g.finalDay && p.route < RULES.route) return Math.min(prize.amount, RULES.route - p.route) * 10
    if (prize.kind === 'route') return Math.min(prize.amount, Math.max(0, RULES.route - p.route)) * (strategy === 'rush' ? 2.4 : 1.8)
    if (prize.kind === 'survivor') return crew.length < partyTarget ? 6 : 1
    const need = finalTurn ? 0 : Math.max(0, (prize.kind === 'can' ? foodBudget : capBudget) - p.resources[prize.kind])
    return Math.min(prize.amount, need) * (strategy === 'economy' ? 1.7 : 1.4) + Math.max(0, prize.amount - need) / RULES.suppliesPerPoint
  }
  const recruitValue = card => cardScore(card) * 1.5 + (crew.some(c => c.type === card.type) ? 0 : 3) - recruitCost(g,p,card)
    + (['teacher','scout','guard','wildcard'].includes(card.ability) ? (strategy === 'elite' ? 5 : 2) : 0)
    + (['free','alien','capybara','dog','doctor','wizard'].includes(card.ability) ? (strategy === 'economy' ? 5 : 2) : 0)
    + (p.leaderId === 'zombie' && card.type === '용감이' ? 2 : 0)
  if (q?.stage === 'eventDraw') return { type:'drawEvent' }
  if (q?.stage === 'eventReveal') return { type:'continueEvent' }
  if (q?.stage === 'barter') return { type: 'tradeReply', accept: p.resources[q.resource] < p.resources[q.other] }
  if (q?.stage === 'trade') {
    const from = g.players.find(x => x.seatId === q.proposer), incoming = from.party.find(x => x.uid === q.give), outgoing = p.party.find(x => x.uid === q.take)
    return { type: 'tradeReply', accept: incoming.cost >= outgoing.cost && (!p.party.some(x => x !== outgoing && x.type === incoming.type) || incoming.cost > outgoing.cost) }
  }
  if (q?.stage === 'counter') return { type: 'counter', use: true, uid: counterCrew(g, siteFor(g, q.siteId), id)[0].uid }
  if (q?.stage === 'leader') { const pool = q.mode === 'lose' ? [p] : g.players.filter(x => x !== p && !x.escaped); return { type: 'leaderChoice', uid: pool.flatMap(x => x.party).find(c => c.type === '용감이' && (q.mode === 'lose' || joinSlot({ ...p, party: ownedCrew(g, p.seatId) }, c) >= 0)).uid } }
  if (q?.stage === 'miracle') return { type: 'continueOmen' }
  if (q?.stage === 'disaster') {
    const shelter = p.party.find(c => c.ready && c.ability === 'shelter')
    if (q.choice && shelter) return { type: 'shelter', uid: shelter.uid }
    const d = g.lastOmen, crew = combinations(p.party.filter(c => c.ready), d.crew).find(cards => disasterCrewValid(d, cards))
    if (q.choice && crew) return { type: 'prepare', uids: crew.map(c => c.uid) }
    if (q.choice && p.resources[d.resource] >= d.cost) return { type: 'prepare' }
    return { type: 'disasterLoss', uids: ownedCrew(g, id).sort((a, b) => a.cost - b.cost).slice(0, d.peopleLoss).map(c => c.uid) }
  }
  if (q?.stage === 'roll') return { type: 'roll' }
  if (q?.stage === 'reward') {
    const prize = [...q.prizes].sort((a, b) => prizeValue(b) - prizeValue(a))[0]
    if (prize.kind === 'survivor') {
      const crew = ownedCrew(g, id)
      const card = g.market.filter(card => card && joinSlot({ ...p, party: crew }, card) >= 0).sort((a,b) => recruitValue(b)-recruitValue(a))[0]
      if (card) return { type: 'claim', prize: prize.id, uid: card.uid }
      for (const candidate of g.market.filter(Boolean).sort((a,b) => recruitValue(b)-recruitValue(a))) {
        const replace = [...crew].sort((a,b) => recruitValue(a)-recruitValue(b)).find(old => cardScore(old) <= cardScore(candidate) && recruitValue(old) < recruitValue(candidate) && joinSlot({ ...p, party: crew.filter(c => c.uid !== old.uid) }, candidate) >= 0)
        if (replace) return { type: 'claim', prize: prize.id, uid: candidate.uid, replaceUid: replace.uid }
      }
      return { type: 'claim', prize: prize.id, decline: true }
    }
    return { type: 'claim', prize: prize.id }
  }
  const active = p.party.filter(c => c.ready)
  if (p.escaped) return { type: 'endManagement', uids: [] }
  if (canEscape(g,p)) return { type: 'escape', uids: escapeCrew(p).map(c => c.uid) }
  // At the gate, recover the escape party and save its food instead of sending it out again.
  if (p.route >= RULES.route && escapeCrew({ ...p, party: ownedCrew(g, id).map(c => ({ ...c, ready: true })) }).length === RULES.escapePeople) {
    if (g.phase === 'dispatch') return { type: 'pass' }
  }
  if (g.phase === 'dispatch') {
    if (!crew.length) return p.forageDay === g.day ? { type: 'pass' } : { type: 'forage' }
    const usable = active
    const event = g.activeEvent?.card
    const helpers = event && combinations(active, event.crew).find(crew => canSolveEvent(g,p,crew))
    if (helpers && p.utopiaDie < (strategy === 'prepared' ? 3 : strategy === 'rush' ? 0 : 1) && p.resources.can >= (strategy === 'prepared' ? 2 : 4) && p.resources.bottleCap >= eventSolveCost(g,p) + 1) return { type:'solveEvent', serial:g.activeEvent.serial, uids:helpers.map(c=>c.uid) }
    const worker = active.find(c => ['runner','hunter','tax'].includes(c.ability))
    const victim = g.players.find(x => x !== p && !x.escaped && x.resources.bottleCap >= 2)
    if (worker && ((worker.ability === 'runner' && p.resources.can < 5) || (worker.ability !== 'runner' && p.resources.bottleCap < 4 && victim))) return {type:'ability',uid:worker.uid,targetPlayer:victim?.seatId}
    const doctor = active.find(c => c.ability === 'doctor')
    const patient = doctor && ownedCrew(g, id).find(c => c.uid !== doctor.uid && !c.ready && !p.medical[c.uid] && mealCost(p, c, g) >= RULES.mealCost)
    if (patient && p.resources.can < foodBudget) return { type: 'ability', uid: doctor.uid, targetUid: patient.uid }
    const wizard = active.find(c => c.ability === 'wizard')
    if (wizard && p.resources.can < foodBudget / 2 && p.resources.bottleCap >= Math.max(2, 2)) return { type: 'ability', uid: wizard.uid, resource: 'bottleCap' }
    if (wizard && p.resources.bottleCap < capBudget && p.resources.can >= foodBudget + 2) return { type: 'ability', uid: wizard.uid, resource: 'can' }
    const shelter = active.find(c => c.ability === 'shelter')
    if (shelter && event?.kind === 'disaster' && p.eventProtection !== g.activeEvent.serial) return { type:'ability', uid:shelter.uid }
    const jammer = active.find(c => c.ability === 'jam')
    const rival = g.players.filter(x => x !== p && !x.passed && x.route >= p.route).sort((a,b) => b.route-a.route)[0]
    const target = rival?.party.filter(c => c.ready && !rival.party.some(guard => guard.ready && guard.ability === 'guard' && Math.abs(guard.slot-c.slot)<=1)).sort((a,b) => b.cost-a.cost)[0]
    if (jammer && target && active.length >= 3 && (rival.route >= RULES.route || (strategy === 'opportunist' && g.sites.some(s=>s && !s.resolved && s.crew.some(c=>c.owner===rival.seatId) && requirements(s).missing.includes(target.type))))) return {type:'ability',uid:jammer.uid,targetPlayer:rival.seatId,targetUid:target.uid}

    const candidates = []
    const tableCrew = g.players.flatMap(player => ownedCrew(g, player.seatId))
    for (const site of g.sites.filter(s => s && !s.resolved)) {
      const req = requirements(site)
      if (req.missing.some(type => !tableCrew.some(c => c.type === type || c.ability === 'wildcard'))) continue
      const own = site.crew.filter(c => c.owner === id), enemies = site.crew.length - own.length
      const saboteur = own.find(c => c.ability === 'sabotage')
      if (saboteur && enemies >= 2 && own.length === 1) return { type: 'ability', uid: saboteur.uid }
      const gambler = own.find(c => c.ability === 'chaos')
      if (gambler && req.ready && !site.chaosRoll && own.length > enemies && explorationPrizes(site,g).filter(r=>['can','bottleCap'].includes(r.kind)).some(r=>prizeValue(r)>=4)) return { type: 'ability', uid: gambler.uid }
      if (site.card.interaction) {
        const target = g.players.find(x => x !== p && !x.escaped && (site.card.interaction === 'barter'
          ? p.resources.can >= 2 && x.resources.bottleCap >= 2 && p.resources.bottleCap < p.resources.can && x.resources.can < x.resources.bottleCap
          : p.party.some(a => x.party.some(b => a.cost === b.cost && a.type !== b.type && !p.party.some(c => c !== a && c.type === b.type) && !x.party.some(c => c !== b && c.type === a.type)))))
        if (!target || site.offered?.[id] === g.day) continue
        if (req.ready && own.length) {
          if (site.card.interaction === 'barter') return { type: 'offerTrade', siteId: site.id, targetPlayer: target.seatId, resource: 'can' }
          for (const a of p.party) for (const b of target.party) {
            if (a.cost !== b.cost || a.type === b.type || p.party.some(c => c !== a && c.type === b.type) || target.party.some(c => c !== b && c.type === a.type)) continue
            const command = { type: 'offerTrade', siteId: site.id, targetPlayer: target.seatId, uid: a.uid, targetUid: b.uid }
            try { proposeTrade(copy(g), copy(p), command, copy(site)); return command } catch { /* Try a compatible pair. */ }
          }
        }
        if (req.ready) continue
      }
      for (const card of usable) {
        if (site.crew.length >= siteCapacity(site.card) || (!site.card.interaction && req.ready && own.length >= explorationPrizes(site,g).length)) continue
        const taboo = !site.hazardTriggered && site.card.hazard?.effect === 'fail' && site.card.hazard.type === card.type
        if (taboo && (own.length || enemies < 2 || site.crew.some(c => c.ability === 'counter'))) continue
        const after = requirements({ ...site, crew: [...site.crew, card] })
        const helps = req.people - after.people + req.missing.length - after.missing.length
        const rewardLoss = site.card.hazard?.effect === 'lastReward' && card.type === site.card.hazard.type ? 15 : 0
        const value = Math.max(0, ...explorationPrizes(site,g).map(prizeValue))
        if (finalTurn && value <= cardScore(card) / 6) continue
        const support = ['alien','capybara'].includes(card.ability) ? 10 : 0
        const combo = own.length && ['teacher','scout','guard'].includes(card.ability) ? 8 : 0
        const opportunity = strategy === 'opportunist' && enemies && own.length === 0 ? 12 : 0
        candidates.push({ score: taboo ? enemies * 12 : helps * 12 + (after.ready ? 20 : 0) + value * 4 + combo + opportunity - support - own.length * 8 - rewardLoss - req.people * 4 - after.missing.length * 18, command: { type: 'dispatch', siteId: site.id, uid: card.uid } })
      }
    }
    candidates.sort((a, b) => b.score - a.score)
    if (candidates[0]?.score > 0) return candidates[0].command
    if (finalTurn) return { type: 'pass' }
    const emptySite = g.sites.find(s => s && !s.resolved && !s.crew.length)
    const searcher = active.find(c => p.resources.can >= (c.type === '4차원' && c.slot === 2 ? 0 : 1))
    if (emptySite && searcher && (g.deck.length || g.siteDiscard.length)) return { type: 'replaceSite', uid: searcher.uid, siteId: emptySite.id }
    return { type: 'pass' }
  }
  const recall = g.sites.find(s => s?.crew.some(c => c.owner === id) && (p.route >= RULES.route || s.card.interaction || requirements(s).people > g.players.reduce((n,p)=>n+p.party.length,0) || requirements(s).missing.some(t => !g.players.some(x => x.party.some(c => c.type === t || c.ability === 'wildcard')))))
  if (recall && g.phase === 'maintenance') return { type:'returnOne', uid:recall.crew.find(c => c.owner === id).uid }
  const wanted = Math.min(g.phase === 'setup' ? 3 : partyTarget, partyLimit(p))
  if (crew.length < wanted || !escapeTypesValid(crew)) {
    for (const card of [...p.candidates, ...p.fans, ...g.market, ].filter(Boolean).sort((a,b) => recruitValue(b) - recruitValue(a))) {
      const cost = recruitCost(g,p,card)
      const payment = cost <= p.resources.bottleCap ? 'bottleCap' : p.leaderId === 'shy' && p.resources.can >= cost + 3 ? 'can' : null
      if (!payment || joinSlot({ ...p, party: ownedCrew(g, p.seatId) }, card) < 0) continue
      const test = copy(p); try { addToParty(g, test, card) } catch { continue }
      if (!g.finalDay && test.party.filter(c => !c.ready).reduce((sum, x) => sum + mealCost(test, x, g), 0) > p.resources.can - (payment === 'can' ? cost : 0)) continue
      return { type: 'recruit', uid: card.uid, payment }
    }
  }
  if (!p.searched && crew.length < wanted && g.recruitDeck.length && p.resources.can >= foodBudget + 1 && p.resources.bottleCap >= 3) return { type:'search',index:0 }
  if (p.leaderId === 'idol' && !p.reserved && p.fans.length < 3 && crew.length < wanted && g.market.some(Boolean)) {
    const candidate = g.market.filter(Boolean).sort((a,b) => recruitValue(b)-recruitValue(a))[0]
    return {type:'reserve',uid:candidate.uid}
  }
  const finalCrew = p.route >= RULES.route ? escapeCrew({...p,party:p.party.map(c=>({...c,ready:true}))}) : []
  const hungry = p.party.filter(c => !c.ready && mealCost(p, c, g) <= p.resources.can && (!finalCrew.length || finalCrew.some(x=>x.uid===c.uid))).sort((a, b) => mealCost(p, a, g) - mealCost(p, b, g))[0]
  return hungry ? { type: 'feed', uid: hungry.uid } : { type: 'endManagement', uids: [] }
}
export function runBot(game, random = Math.random) { return applyCommand(game, actorId(game), botCommand(game), random) }
