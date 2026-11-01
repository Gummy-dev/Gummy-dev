import { VERSION, COLORS, RULES, LEADERS, PLAIN, SURVIVOR_CARDS, LOCATIONS, DISASTERS, locationPrizes } from './cards.js'
const requireRule = (ok, message) => { if (!ok) throw new Error(message) }
const copy = value => JSON.parse(JSON.stringify(value))
const shuffle = (cards, random) => { const a = [...cards]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const dice = random => Math.floor(random() * 6) + 1
const log = (g, message) => { g.log = [...g.log, message].slice(-60) }
export const nextDisaster = g => DISASTERS.find(d => d.day >= g.day && !g.disastersResolved.includes(d.day))
export const crewCount = (g, id) => g.players.find(p => p.seatId === id).party.length + g.sites.flatMap(s => s?.crew ?? []).filter(c => c.owner === id).length
export const actorId = g => g.pending ? g.pending.stage === 'roll' ? g.pending.trigger : g.pending.order[g.pending.index] : g.players[g.currentPlayerIndex].seatId
export function requirements(site) {
  if (!site) return { matched: [], missing: [], people: 0, food: 0, caps: 0, ready: false }
  const available = [...site.crew], matched = [], missing = []
  for (const role of [...site.card.roles].sort((a, b) => (a === '*') - (b === '*'))) {
    const i = available.findIndex(c => role === '*' || c.type === role)
    if (i < 0) missing.push(role); else matched.push(available.splice(i, 1)[0].uid)
  }
  const people = Math.max(0, (site.card.people ?? site.card.roles.length) - site.crew.length)
  const food = Math.max(0, site.card.food - site.food), caps = Math.max(0, (site.card.caps ?? 0) - (site.caps ?? 0))
  return { matched, missing, people, food, caps, ready: people === 0 && missing.length === 0 && food === 0 && caps === 0 }
}
function refreshGameCards(g) {
  if (g.rulesRevision === 3) return g
  const current = card => LOCATIONS.find(c => c.id === card.id) ?? card
  g.deck = g.deck.map(current)
  g.sites.forEach(site => { if (site && site.id !== g.pending?.siteId) site.card = current(site.card) })
  g.rulesRevision = 3
  return g
}
export function createGame(seats, random = Math.random) {
  requireRule(seats.length >= 2 && seats.length <= 4, '2~4명이 함께 출발합니다.')
  const slots = seats.length + 1
  let serial = 0
  const instance = c => ({ ...c, uid: 'survivor-' + serial++, ready: true })
  const players = seats.map((seat, index) => {
    const leader = LEADERS.find(l => l.id === seat.leaderId) ?? LEADERS[0]
    const types = seat.starters?.length === 2 ? seat.starters : [index % 5, (index + 2) % 5]
    return { seatId: seat.id, id: seat.id, name: seat.name, leaderId: leader.id, isBot: Boolean(seat.bot), color: COLORS[index],
      party: [...types.map(i => instance(PLAIN[i])), instance(leader.companion)], resources: { can: 5, bottleCap: 4 },
      route: 0, escaped: false, prepared: [], discoveries: [] }
  })
  const assignedSpecials = new Set(players.map(p => p.party[2].id))
  const survivors = shuffle(SURVIVOR_CARDS.filter(c => c.ability !== 'plain' && !assignedSpecials.has(c.id)), random)
  const basics = shuffle(Array.from({ length: 3 }, () => PLAIN).flat(), random)
  const recruitDeck = shuffle([...survivors, ...basics], random).map(instance)
  const deck = [1, 2, 3].flatMap(tier => shuffle(LOCATIONS.filter(c => c.tier === tier), random).slice(0, slots + 1))
  const g = { rulesVersion: VERSION, rulesRevision: 3, day: 1, turnInDay: 0, currentPlayerIndex: 0, players, deck, recruitDeck,
    sites: [], market: recruitDeck.splice(0, 3), stranded: [], pending: null, disastersResolved: [], lastDisaster: null,
    lastResult: null, gameEnded: false, finalDay: null, log: ['1일차 · 함께 출발했습니다. 하루에 각자 두 행동, 한 행동씩 번갈아 진행합니다.'] }
  for (let i = 0; i < slots; i++) g.sites.push(drawSite(g))
  return g
}
function drawSite(g) { const card = g.deck.shift(); return card ? { id: card.id, card, crew: [], food: 0, caps: 0 } : null }
function endGame(g) {
  g.gameEnded = true
  g.standings = g.players.map(p => ({ seatId: p.seatId, name: p.name, escaped: p.escaped, route: p.route, crew: crewCount(g, p.seatId), can: p.resources.can }))
    .sort((a, b) => Number(b.escaped) - Number(a.escaped) || b.route - a.route || b.crew - a.crew || b.can - a.can)
  let rank = 1
  g.standings.forEach((p, i, list) => { if (i && ['escaped', 'route', 'crew', 'can'].some(k => list[i - 1][k] !== p[k])) rank = i + 1; p.rank = rank })
  log(g, g.day + '일차 종료 · ' + g.standings.filter(p => p.rank === 1).map(p => p.name).join(', ') + ' 공동체가 가장 멀리 나아갔습니다.')
}
function nextActor(g) {
  g.currentPlayerIndex = (g.currentPlayerIndex + 1) % g.players.length
  if (g.players[g.currentPlayerIndex].escaped) finishAction(g)
}
function finishDay(g) {
  if (g.day === RULES.days || g.finalDay === g.day) { endGame(g); return }
  g.day++; g.turnInDay = 0
  g.players.forEach(p => p.party.forEach(c => { c.ready = true }))
  const empty = g.sites.findIndex(s => s && s.crew.length === 0)
  if (empty >= 0 && g.deck.length) g.sites[empty] = drawSite(g)
  log(g, g.day + '일차 · 귀환한 동료들이 회복했습니다.')
  nextActor(g)
}
function finishAction(g) {
  g.turnInDay++
  if (g.turnInDay < g.players.length * RULES.actionsPerDay) { nextActor(g); return }
  const disaster = DISASTERS.find(d => d.day === g.day)
  if (disaster) {
    const results = g.players.map(p => {
      const protectedParty = p.escaped || p.prepared.includes(disaster.day)
      if (!protectedParty) for (const [resource, amount] of Object.entries(disaster.loss)) p.resources[resource] = Math.max(0, p.resources[resource] - amount)
      return { seatId: p.seatId, name: p.name, protected: protectedParty, lost: [] }
    })
    g.lastDisaster = { ...disaster, results }; g.disastersResolved.push(disaster.day)
    log(g, disaster.name + ': ' + results.map(p => p.name + (p.protected ? ' 대비 완료' : ' 물자 손실 · 낙오자 선택')).join(' · '))
    const order = results.filter(p => !p.protected && crewCount(g, p.seatId) > 0).map(p => p.seatId)
    if (order.length) { g.pending = { stage: 'disaster', disasterDay: disaster.day, order, index: 0 }; return }
  }
  finishDay(g)
}
function siteFor(g, id) { const site = g.sites.find(s => s?.id === id); requireRule(site, '이미 해결되었거나 없는 탐색지입니다.'); return site }
function takeReady(p, uid) { const i = p.party.findIndex(c => c.uid === uid && c.ready); requireRule(i >= 0, '내 거점의 활성 동료를 선택하세요.'); return p.party.splice(i, 1)[0] }
function addStranded(g, card, owner, reason) { g.stranded.push({ ...card, ready: false, owner: undefined, availableDay: g.day + 1, previousOwner: owner, reason }); log(g, card.name + ' 낙오 · ' + (g.day + 1) + '일차부터 영입 가능') }
function startResolution(g, site, trigger) { if (requirements(site).ready) { g.pending = { stage: 'roll', siteId: site.id, trigger, order: [], index: 0 }; log(g, site.card.name + ' 출발 조건 완성! 참가 파티가 성과를 겨룹니다.') } else finishAction(g) }
function rollCrew(crew, allCrew, danger, random) {
  const owner = crew[0].owner, abilities = new Set(crew.map(c => c.ability))
  let extra = 0; const notes = []
  if (abilities.has('scout') && new Set(allCrew.map(c => c.type)).size > 1) { extra++; notes.push('동행 +1개') }
  if (abilities.has('loner') && allCrew.filter(c => c.type === '용감이').length === 1) { extra++; notes.push('독불장군 +1개') }
  if (extra && allCrew.some(c => c.owner !== owner && c.ability === 'jam')) { extra--; notes.push('오리교도: 추가 주사위 -1개') }
  const rolls = Array.from({ length: crew.length + extra }, () => dice(random)), before = [...rolls]
  if (abilities.has('reroll')) { const min = Math.min(...rolls); if (min <= 2) { rolls[rolls.indexOf(min)] = dice(random); notes.push('최저 눈 재굴림') } }
  const lost = danger && rolls.includes(1) && !abilities.has('guard') ? [crew[0].uid] : []
  if (danger && rolls.includes(1) && abilities.has('guard')) notes.push('동료 보호: 실종 방지')
  return { rolls, before, notes, lost, sorted: [...rolls].sort((a, b) => b - a) }
}
function awardPrize(g, p, site, prize) {
  if (prize.kind === 'route') { p.route += prize.amount; p.discoveries.push({ ...site.card, uid: site.id + '-' + p.seatId }) }
  else p.resources[prize.kind] += prize.amount
  g.pending.choices.push({ owner: p.seatId, ...prize })
  log(g, p.name + ': ' + prize.label + ' +' + prize.amount)
}
function rollExpedition(g, random) {
  const pending = g.pending, site = siteFor(g, pending.siteId)
  const order = [...new Set(site.crew.map(c => c.owner))]
  const results = order.map((owner, first) => {
    const crew = site.crew.filter(c => c.owner === owner), abilities = new Set(crew.map(c => c.ability))
    const rolled = rollCrew(crew, site.crew, site.card.danger, random)
    const p = g.players.find(p => p.seatId === owner)
    p.resources.can++; if (abilities.has('barter')) p.resources.bottleCap++
    return { owner, first, ...rolled }
  })
  results.sort((a, b) => { for (let i = 0; i < Math.max(a.sorted.length, b.sorted.length); i++) { const difference = (b.sorted[i] ?? 0) - (a.sorted[i] ?? 0); if (difference) return difference } return a.first - b.first })
  pending.stage = 'reward'; pending.order = results.map(r => r.owner); pending.index = 0; pending.results = results
  pending.prizes = locationPrizes(site.card)
  pending.choices = []
  log(g, site.card.name + ' 탐색 완료 · 참가 파티마다 통조림 1개. ' + results.map(r => g.players.find(p => p.seatId === r.owner).name + ' [' + r.rolls.join(', ') + ']').join(' / '))
  if (site.card.distribution === 'all') {
    const winner = g.players.find(p => p.seatId === pending.order[0])
    for (const prize of pending.prizes) awardPrize(g, winner, site, prize)
    pending.prizes = []; pending.stage = 'return'
    log(g, winner.name + ': 발견물 전체 획득')
  }
}
function finishResolution(g) {
  const pending = g.pending, site = siteFor(g, pending.siteId)
  g.lastResult = { name: site.card.name, day: g.day, results: pending.results, choices: pending.choices }
  g.sites[g.sites.indexOf(site)] = drawSite(g); g.pending = null; finishAction(g)
}
function contribute(p, site, command) {
  const food = command.food ?? 0, caps = command.caps ?? 0, needed = requirements(site)
  requireRule(Number.isInteger(food) && food >= 0 && food <= needed.food && food <= p.resources.can, '제공할 식량을 확인하세요.')
  requireRule(Number.isInteger(caps) && caps >= 0 && caps <= needed.caps && caps <= p.resources.bottleCap, '제공할 병뚜껑을 확인하세요.')
  requireRule(command.type !== 'supply' || food + caps > 0, '제공할 물자를 선택하세요.')
  p.resources.can -= food; p.resources.bottleCap -= caps
  site.food += food; site.caps = (site.caps ?? 0) + caps
  return [food ? '식량 ' + food : '', caps ? '병뚜껑 ' + caps : ''].filter(Boolean).join(' · ')
}
export function applyCommand(game, playerId, command, random = Math.random) {
  requireRule(game && !game.gameEnded, '게임이 종료되었습니다.')
  requireRule(command && typeof command.type === 'string', '행동을 선택하세요.')
  requireRule(actorId(game) === playerId, '현재 선택할 파티의 차례를 기다려 주세요.')
  const g = refreshGameCards(copy(game)), p = g.players.find(p => p.seatId === playerId), c = command
  if (g.pending?.stage === 'disaster') {
    const q = g.pending, disaster = DISASTERS.find(d => d.day === q.disasterDay)
    const owned = [...p.party, ...g.sites.flatMap(s => s?.crew.filter(card => card.owner === playerId) ?? [])]
    const count = Math.min(disaster.peopleLoss, owned.length)
    requireRule(c.type === 'disasterLoss' && Array.isArray(c.uids) && c.uids.length === count && new Set(c.uids).size === count && c.uids.every(uid => owned.some(card => card.uid === uid)), '낙오할 내 동료 ' + count + '명을 선택하세요.')
    for (const uid of c.uids) {
      const card = owned.find(card => card.uid === uid)
      p.party = p.party.filter(card => card.uid !== uid)
      g.sites.forEach(site => { if (site) site.crew = site.crew.filter(card => card.uid !== uid) })
      addStranded(g, card, playerId, disaster.name)
      g.lastDisaster.results.find(result => result.seatId === playerId).lost.push(card.name)
    }
    if (++q.index === q.order.length) { g.pending = null; finishDay(g) }
    return g
  }
  if (g.pending) {
    const q = g.pending, site = siteFor(g, q.siteId)
    if (q.stage === 'roll') { requireRule(c.type === 'roll', '탐색 주사위를 먼저 굴려 주세요.'); rollExpedition(g, random) }
    else if (q.stage === 'reward') {
      requireRule(c.type === 'claim', '발견물 하나를 선택하세요.')
      const prize = q.prizes.find(r => r.id === c.prize); requireRule(prize, '이미 선택되었거나 없는 보상입니다.')
      awardPrize(g, p, site, prize); q.prizes = q.prizes.filter(r => r !== prize)
      if (++q.index === q.order.length || !q.prizes.length) { q.stage = 'return'; q.index = 0 }
    } else {
      requireRule(c.type === 'return' && Array.isArray(c.uids) && c.uids.length <= RULES.party && c.uids.every(x => typeof x === 'string') && new Set(c.uids).size === c.uids.length, '귀환할 내 동료를 선택하세요.')
      const crew = site.crew.filter(card => card.owner === playerId), lost = q.results.find(r => r.owner === playerId).lost
      requireRule(c.uids.every(uid => crew.some(card => card.uid === uid) && !lost.includes(uid)), '실종되었거나 다른 파티의 동료는 귀환시킬 수 없습니다.')
      const returning = crew.filter(card => c.uids.includes(card.uid)), cost = returning.reduce((sum, card) => sum + card.returnCost, 0)
      requireRule(p.resources.can >= cost, '귀환에 필요한 통조림이 부족합니다.')
      p.resources.can -= cost
      for (const card of crew) {
        if (c.uids.includes(card.uid)) p.party.push({ ...card, owner: undefined, ready: false })
        else addStranded(g, card, playerId, lost.includes(card.uid) ? '위험 탐색에서 실종' : '귀환 물자를 남기지 못함')
      }
      site.crew = site.crew.filter(card => card.owner !== playerId)
      log(g, p.name + ': ' + returning.length + '명 귀환 · 통조림 ' + cost + '개 사용')
      if (++q.index === q.order.length) finishResolution(g)
    }
    return g
  }
  switch (c.type) {
    case 'dispatch': {
      const site = siteFor(g, c.siteId)
      requireRule(site.crew.length < 8, '이 탐색에는 최대 8명이 참가합니다.')
      const supplied = contribute(p, site, c), card = takeReady(p, c.uid)
      site.crew.push({ ...card, owner: playerId })
      log(g, p.name + ': ' + card.name + ' → ' + site.card.name + (supplied ? ' · ' + supplied + ' 제공' : ''))
      startResolution(g, site, playerId); return g
    }
    case 'supply': {
      const site = siteFor(g, c.siteId)
      requireRule(site.crew.some(card => card.owner === playerId), '내 동료가 파견된 장소에 물자를 보낼 수 있습니다.')
      const supplied = contribute(p, site, c)
      log(g, p.name + ': ' + site.card.name + '에 ' + supplied + ' 제공')
      startResolution(g, site, playerId); return g
    }
    case 'withdraw': {
      const site = siteFor(g, c.siteId), card = site.crew.find(card => card.uid === c.uid && card.owner === playerId)
      requireRule(card, '철수할 내 동료를 선택하세요.'); requireRule(typeof c.rescue === 'boolean', '귀환 또는 낙오를 선택하세요.')
      if (c.rescue) { requireRule(p.resources.can >= card.returnCost, '귀환 식량이 부족합니다.'); p.resources.can -= card.returnCost; p.party.push({ ...card, owner: undefined, ready: false }) }
      else addStranded(g, card, playerId, '탐색에서 철수하며 낙오')
      site.crew = site.crew.filter(card => card.uid !== c.uid); log(g, p.name + ': ' + card.name + (c.rescue ? ' 철수·귀환' : ' 철수·낙오')); break
    }
    case 'forage': p.resources.can += 2; log(g, p.name + ': 안전한 탐색 · 통조림 +2'); break
    case 'recruit': {
      requireRule(crewCount(g, playerId) < RULES.party, '파견 중인 동료를 포함해 파티는 최대 5명입니다.')
      const marketIndex = g.market.findIndex(card => card?.uid === c.uid), strandedIndex = g.stranded.findIndex(card => card.uid === c.uid && card.availableDay <= g.day)
      const card = marketIndex >= 0 ? g.market[marketIndex] : g.stranded[strandedIndex]
      requireRule(card, '지금 영입할 수 있는 생존자를 선택하세요.'); requireRule(p.resources.bottleCap >= card.cost, '영입할 병뚜껑이 부족합니다.')
      p.resources.bottleCap -= card.cost; p.party.push({ ...card, ready: false, availableDay: undefined, previousOwner: undefined, reason: undefined })
      if (marketIndex >= 0) g.market[marketIndex] = g.recruitDeck.shift() ?? null; else g.stranded.splice(strandedIndex, 1)
      log(g, p.name + ': ' + card.name + ' 영입 · 다음 정비에 활성화'); break
    }
    case 'dismiss': {
      const i = p.party.findIndex(card => card.uid === c.uid); requireRule(i >= 0, '거점에서 내보낼 내 동료를 선택하세요.')
      addStranded(g, p.party.splice(i, 1)[0], playerId, '파티에서 떠남'); break
    }
    case 'prepare': {
      requireRule(c.uid == null, '대비할 활성 동료 2명을 선택하세요.')
      const d = nextDisaster(g); requireRule(d, '남은 재난이 없습니다.'); requireRule(!p.prepared.includes(d.day), '이미 대비했습니다.')
      if (c.uids != null) {
        requireRule(Array.isArray(c.uids) && c.uids.length === d.crew && new Set(c.uids).size === d.crew && c.uids.every(uid => p.party.some(card => card.uid === uid && card.ready)), '대비할 활성 동료 2명을 선택하세요.')
        const crew = p.party.filter(card => c.uids.includes(card.uid))
        requireRule(crew.some(card => d.types.includes(card.type)), '대비 인원 중 최소 1명은 지정 타입이어야 합니다.')
        crew.forEach(card => { card.ready = false })
      }
      else { requireRule(p.resources[d.resource] >= d.cost, '대비 물자가 부족합니다.'); p.resources[d.resource] -= d.cost }
      p.prepared.push(d.day); log(g, p.name + ': ' + d.name + ' 대비 완료'); break
    }
    case 'escape': {
      requireRule(p.route >= RULES.route, '단서 10개 이상을 모아 유토피아 도전을 준비하세요.')
      requireRule(!g.sites.some(s => s?.crew.some(card => card.owner === playerId)), '파견 중인 동료를 먼저 귀환시키거나 철수시켜 주세요.')
      requireRule(p.party.filter(card => card.ready).length >= RULES.escapePeople && p.resources.can >= RULES.escapeFood, '활성 동료 3명과 통조림 3개가 필요합니다.')
      requireRule(Array.isArray(c.uids) && c.uids.length === RULES.escapePeople && new Set(c.uids).size === RULES.escapePeople && c.uids.every(uid => p.party.some(card => card.uid === uid && card.ready)), '도전할 활성 동료 3명을 선택하세요.')
      const crew = c.uids.map(uid => ({ ...p.party.find(card => card.uid === uid), owner: playerId }))
      const result = rollCrew(crew, crew, false, random), total = result.rolls.reduce((sum, value) => sum + value, 0)
      p.resources.can -= RULES.escapeFood
      p.party.forEach(card => { if (c.uids.includes(card.uid)) card.ready = false })
      const success = total >= RULES.utopiaTarget
      g.lastUtopia = { ...result, owner: playerId, name: p.name, day: g.day, total, success, target: RULES.utopiaTarget }
      if (success) { p.escaped = true; g.finalDay ??= g.day }
      log(g, p.name + ': 유토피아 도전 [' + result.rolls.join(', ') + '] 합계 ' + total + ' / 목표 ' + RULES.utopiaTarget + (success ? ' · 탈출 성공! 오늘의 모든 행동을 마치고 종료합니다.' : ' · 실패. 단서 유지, 참가 동료 휴식.'))
      break
    }
    default: throw new Error('이 실험판에서 지원하지 않는 행동입니다.')
  }
  finishAction(g); return g
}
export function publicGame(game, playerId) {
  if (!game) return null
  const g = refreshGameCards(copy(game)); g.deck = g.deck.map(() => null); g.recruitDeck = g.recruitDeck.map(() => null)
  g.localPlayerIndex = g.players.findIndex(p => p.seatId === playerId)
  return g
}
export function botCommand(g) {
  const id = actorId(g), p = g.players.find(p => p.seatId === id), q = g.pending
  if (q?.stage === 'disaster') {
    const d = DISASTERS.find(d => d.day === q.disasterDay)
    const owned = [...p.party, ...g.sites.flatMap(s => s?.crew.filter(c => c.owner === id) ?? [])].sort((a, b) => a.cost - b.cost)
    return { type: 'disasterLoss', uids: owned.slice(0, d.peopleLoss).map(c => c.uid) }
  }
  if (q?.stage === 'roll') return { type: 'roll' }
  if (q?.stage === 'reward') { const choice = q.prizes.find(r => r.kind === 'route' && p.route < RULES.route) ?? q.prizes.find(r => r.kind === 'can' && p.resources.can < 4) ?? q.prizes[0]; return { type: 'claim', prize: choice.id } }
  if (q?.stage === 'return') { let food = p.resources.can; const lost = q.results.find(r => r.owner === id).lost; const cards = siteFor(g, q.siteId).crew.filter(c => c.owner === id && !lost.includes(c.uid)).sort((a, b) => a.returnCost - b.returnCost || b.cost - a.cost); return { type: 'return', uids: cards.filter(c => { if (food < c.returnCost) return false; food -= c.returnCost; return true }).map(c => c.uid) } }
  const active = p.party.filter(c => c.ready), d = nextDisaster(g)
  if (p.route >= RULES.route && active.length >= 3 && p.resources.can >= 3 && !g.sites.some(s => s?.crew.some(c => c.owner === id))) return { type: 'escape', uids: active.slice(0, RULES.escapePeople).map(c => c.uid) }
  if (d?.day === g.day && !p.prepared.includes(d.day)) {
    const card = active.find(c => d.types.includes(c.type))
    if (card && active.length >= d.crew) return { type: 'prepare', uids: [card.uid, ...active.filter(c => c.uid !== card.uid).slice(0, d.crew - 1).map(c => c.uid)] }
    if (p.resources[d.resource] >= d.cost) return { type: 'prepare' }
  }
  if (p.resources.can < 2) return { type: 'forage' }
  if (crewCount(g, id) < 3) { const card = [...g.market, ...g.stranded.filter(c => c.availableDay <= g.day)].find(c => c && c.cost <= p.resources.bottleCap); if (card) return { type: 'recruit', uid: card.uid } }
  const candidates = []
  for (const site of g.sites.filter(Boolean)) {
    const req = requirements(site)
    if (!req.people && !req.missing.length && (req.food || req.caps) && site.crew.some(c => c.owner === id) && p.resources.can >= req.food && p.resources.bottleCap >= req.caps) candidates.push({ score: 100, command: { type: 'supply', siteId: site.id, food: req.food, caps: req.caps } })
    for (const card of active) {
      if (site.crew.length >= 8) continue
      const food = Math.min(req.food, Math.max(0, p.resources.can - card.returnCost)), caps = Math.min(req.caps, p.resources.bottleCap)
      const after = requirements({ ...site, crew: [...site.crew, card], food: site.food + food, caps: (site.caps ?? 0) + caps })
      const helps = req.missing.length - after.missing.length + req.people - after.people
      const rivalCrew = Math.max(0, ...g.players.filter(player => player.seatId !== id).map(player => site.crew.filter(c => c.owner === player.seatId).length))
      const contest = site.card.distribution === 'all' ? (site.crew.filter(c => c.owner === id).length + 1 - rivalCrew) * 5 : 0
      candidates.push({ score: (after.ready ? 80 : 0) + contest + helps * 20 + site.crew.length * 3 + (p.route < RULES.route ? site.card.rewardRoute ?? 1 : 0) * 3 + (card.ability !== 'plain' ? 1 : 0), command: { type: 'dispatch', siteId: site.id, uid: card.uid, food, caps } })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  if (candidates[0]) return candidates[0].command
  const stuck = g.sites.flatMap(s => s ? s.crew.filter(c => c.owner === id).map(c => ({ site: s, card: c })) : [])
  if (stuck.length && p.party.length < 3 && g.day >= 6) { const { site, card } = stuck[0]; return { type: 'withdraw', siteId: site.id, uid: card.uid, rescue: p.resources.can >= card.returnCost } }
  const recruit = [...g.market, ...g.stranded.filter(c => c.availableDay <= g.day)].find(c => c && c.cost <= p.resources.bottleCap)
  if (recruit && crewCount(g, id) < RULES.party) return { type: 'recruit', uid: recruit.uid }
  return { type: 'forage' }
}
export function runBot(game, random = Math.random) { return applyCommand(game, actorId(game), botCommand(game), random) }
