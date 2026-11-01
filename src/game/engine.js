import { BASICS, SURVIVORS, EVENTS, CLUES, LEADERS, TREASURES } from './cards.js'

const requireRule = (condition, message) => { if (!condition) throw new Error(message) }
const shuffle = (values, random) => {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
const clamp = p => { p.can = Math.min(12, Math.max(0, p.can)); p.cap = Math.min(12, Math.max(0, p.cap)) }
const log = (g, text) => { g.log.unshift(text); g.log = g.log.slice(0, 40) }
function supply(g) {
  const p = g.players[g.current]
  if (g.round > 1) { p.can += 2 + p.party.filter(s => s.ability === 'fan').length; p.cap++; clamp(p) }
}
const member = (card, uid, active = false) => ({ ...card, uid, active })
export const leader = p => LEADERS.find(l => l.id === p.leaderId)
export const partyLimit = p => p.leaderId === 'idol' ? 6 : 5
export const accessTier = p => Math.min(3, p.clues + 1)
export function score(p, utopiaLeader) {
  const party = p.party.reduce((n, s) => n + s.score, 0)
  const clues = p.clues * (p.clues + 1) / 2
  const treasure = p.treasures.reduce((n, t) => n + t.score, 0)
  const types = p.party.map(s => s.type)
  const utopia = p.arrived && (utopiaLeader === 'robot' ? new Set(types).size >= 4 : types.filter(t => t === LEADERS.find(l => l.id === utopiaLeader)?.type).length >= 2) ? 2 : 0
  return { party, clues, treasure, events: p.points, arrival: p.arrivalPoints, utopia, total: party + clues + treasure + p.points + p.arrivalPoints + utopia }
}

export function createGame(seats, random = Math.random) {
  requireRule(seats.length >= 2 && seats.length <= 4, '2~4명이 모이면 출발할 수 있습니다.')
  const players = seats.map((s, i) => ({
    id: s.id, name: s.name, leaderId: s.leaderId, can: 4, cap: 3,
    party: (s.starters ?? [0, 1]).map((n, j) => member(BASICS[n], `starter-${i}-${j}`, true)),
    clues: 0, points: 0, arrivalPoints: 0, arrived: false, treasures: [],
  }))
  const decks = {}, markets = {}, eventDecks = {}, board = {}, discards = {}
  for (const tier of [1, 2, 3]) {
    decks[tier] = shuffle(SURVIVORS.filter(s => s.tier === tier).flatMap(s => Array.from({ length: tier === 1 ? 3 : 2 }, (_, i) => member(s, `${s.id}-${i}`))), random)
    markets[tier] = decks[tier].splice(0, 3)
    eventDecks[tier] = shuffle(EVENTS.filter(e => e.tier === tier).map(e => ({ ...e, uid: e.id })), random)
    board[tier] = eventDecks[tier].splice(0, 3)
    discards[tier] = []
  }
  return { players, decks, markets, eventDecks, board, discards, departed: [], round: 1, current: 0, phase: 'action', actions: 2, turn: 1, flags: {}, pending: null, utopiaLeader: null, finalPlayer: null, ended: false, log: ['멸망했는데 바쁨! 두 생존자와 함께 길을 나섭니다.'], lastRoll: null }
}

function matchedTags(p, survivors, tags, useDuck = false) {
  let best = 0
  function match(index, used, hits) {
    if (index === tags.length) { best = Math.max(best, hits); return }
    match(index + 1, used, hits)
    survivors.forEach((s, i) => {
      if (used.includes(i)) return
      if (s.type === tags[index] || s.ability === 'wild' || (useDuck && s.type === '4차원' && !used.includes('duck'))) {
        const duckMatch = s.type !== tags[index] && s.ability !== 'wild'
        match(index + 1, [...used, i, ...(duckMatch ? ['duck'] : [])], hits + 1)
      }
    })
  }
  match(0, [], 0)
  return best
}
export function previewBonus(p, selected, tags, flags = {}) {
  const party = p.party.filter(s => selected.includes(s.uid))
  const normal = matchedTags(p, party, tags)
  const duck = p.leaderId === 'duck' && !flags.duck ? matchedTags(p, party, tags, true) : normal
  const position = p.party.slice(0, 2).some(s => s.type === '용감이' && selected.includes(s.uid)) ? 1 : 0
  return { bonus: duck * 2 + position + (flags.bonus ?? 0), typeBonus: duck * 2, position, duckUsed: duck > normal }
}
export function successChance(count, target, bonus = 0) {
  let distribution = [1]
  for (let n = 0; n < count; n++) {
    const next = Array(distribution.length + 6).fill(0)
    distribution.forEach((v, sum) => { for (let d = 1; d <= 6; d++) next[sum + d] += v })
    distribution = next
  }
  return distribution.reduce((n, ways, sum) => n + (sum + bonus >= target ? ways : 0), 0) / 6 ** count
}

function assigned(p, ids, minimum = 1, maximum = 5) {
  requireRule(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length >= minimum && ids.length <= maximum, `생존자 ${minimum}~${maximum}명을 선택하세요.`)
  const survivors = ids.map(id => p.party.find(s => s.uid === id))
  requireRule(survivors.every(s => s?.active), '활성 생존자만 파견할 수 있습니다.')
  return survivors
}
function validateAdjacency(party) {
  requireRule(!party.some((s, i) => [s.ability, party[i + 1]?.ability].sort().join(',') === 'cat,dog'), '개와 고양이는 이웃한 칸에 놓을 수 없습니다. 배치를 바꿔 주세요.')
}
function enterMaintenance(g) {
  const p = g.players[g.current]
  g.phase = 'maintenance'
  for (const s of p.party) {
    if (s.ability === 'dog' && s.active) p.can++
  }
  g.flags.runnerDue = p.party.filter(s => s.ability === 'runner' && s.hiredTurn < g.turn).map(s => s.uid)
  clamp(p)
}
function removeEvent(g, event) {
  const index = g.board[event.tier].findIndex(e => e?.uid === event.uid)
  if (index >= 0) { g.board[event.tier][index] = null; g.discards[event.tier].push(event) }
}
function refill(g, random) {
  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < 3; i++) {
      if (!g.board[tier][i]) {
        if (!g.eventDecks[tier].length) { g.eventDecks[tier] = shuffle(g.discards[tier], random); g.discards[tier] = [] }
        g.board[tier][i] = g.eventDecks[tier].shift() ?? null
      }
      if (!g.markets[tier][i]) g.markets[tier][i] = g.decks[tier].shift() ?? null
    }
  }
}
function settleRoll(g, random) {
  const roll = g.pending
  const p = g.players[g.current]
  const total = roll.dice.reduce((n, d) => n + d, 0) + roll.bonus
  const success = total >= roll.event.target
  const e = roll.event
  if (success) {
    if (e.kind === 'clue') {
      p.clues++; g.flags.clue = true
      if (p.clues === 3 && !g.utopiaLeader) { g.utopiaLeader = p.leaderId; log(g, `${leader(p).utopia}의 길이 열렸습니다!`) }
    } else if (e.kind === 'supply') p[e.resource] += e.reward
    else if (e.kind === 'score') p.points += e.reward
    else if (e.kind === 'treasure') {
      const item = TREASURES[Math.floor(random() * TREASURES.length)]
      p.treasures.push({ ...item, uid: `treasure-${g.turn}-${g.actions}`, score: e.reward, used: false })
    } else if (e.kind === 'raid') {
      const victim = g.players.find(x => x.id === roll.targetId)
      const defense = victim.party.some(s => s.active && s.ability === 'guard') ? 1 : 0
      const amount = Math.min(victim[roll.resource], Math.max(0, 2 - defense))
      victim[roll.resource] -= amount; p[roll.resource] += amount
      log(g, `${p.name}이 ${victim.name}에게서 ${roll.resource === 'can' ? '통조림' : '병뚜껑'} ${amount}개를 가져왔습니다.`)
    }
  } else if (e.kind === 'supply') p[e.resource]++
  if (e.kind !== 'clue') removeEvent(g, e)
  g.lastRoll = { ...roll, total, success, turn: g.turn }
  log(g, `${p.name} · ${e.name} ${success ? '성공' : '실패'} (${total}/${e.target})${success && e.kind === 'clue' ? ` · 단서 ${p.clues}/3` : ''}`)
  clamp(p); g.pending = null
}
export function mealCost(p, survivor, flags = {}) {
  const index = p.party.findIndex(s => s.uid === survivor.uid)
  if (survivor.ability === 'freeMeal') return 0
  if (p.party.some(s => s.ability === 'alien')) {
    if (survivor.ability === 'alien' || !flags.alienMeal) return 0
  }
  if (index >= 3 && survivor.type === '겁쟁이' && !flags.cowardMeal) return 0
  return 1
}
export function recruitCost(p, card, useFood = false) {
  const discount = p.party[2]?.type === '분위기메이커' ? 1 : 0
  const total = Math.max(0, card.cost - discount)
  const food = p.leaderId === 'shy' && useFood ? Math.min(2, p.can, total) : 0
  return { can: food, cap: total - food }
}

export function applyCommand(game, actorId, command, random = Math.random) {
  const g = structuredClone(game)
  requireRule(command && typeof command.type === 'string', '올바른 행동을 선택하세요.')
  requireRule(!g.ended, '이번 탐험은 끝났습니다.')
  const p = g.players[g.current]
  if (command.type === 'disaster') {
    requireRule(g.pending?.kind === 'disaster' && g.pending.targetId === actorId, '재난을 해결할 파티의 차례를 기다려 주세요.')
    const target = g.players.find(p => p.id === actorId)
    if (command.pay) { requireRule(target.can >= 2, '통조림 2개가 필요합니다.'); target.can -= 2 }
    else {
      const active = target.party.filter(s => s.active)
      if (active.length) { const s = active.find(s => s.uid === command.uid); requireRule(s, '쉬게 할 활성 생존자를 선택하세요.'); s.active = false }
    }
    log(g, `${target.name} · 재난을 ${command.pay ? '통조림 2개로' : '동료의 휴식으로'} 넘겼습니다.`)
    const next = g.pending.remaining.shift()
    if (next) g.pending.targetId = next
    else { g.pending = null; supply(g) }
    return g
  }
  if (command.type === 'respondCoop') {
    requireRule(g.pending?.kind === 'coop' && g.pending.targetId === actorId, '협력 제안을 받은 사람만 응답할 수 있습니다.')
    const target = g.players.find(x => x.id === actorId)
    if (command.accept) {
      const helper = assigned(target, [command.uid])[0]
      const sender = assigned(p, g.pending.ids)[0]
      helper.active = false; helper.usedTurn = g.turn; sender.active = false; sender.usedTurn = g.turn; p.can += 4; target.can += 3; g.actions--
      removeEvent(g, g.pending.event); clamp(p); clamp(target)
      log(g, `${p.name}과 ${target.name}이 창고를 함께 옮겼습니다. 식량 +4 / +3!`)
    } else log(g, `${target.name}이 협력 제안을 거절했습니다. 행동은 소모되지 않습니다.`)
    g.pending = null
    return g
  }
  requireRule(p.id === actorId, '지금은 다른 플레이어의 차례입니다.')
  if (g.pending) {
    requireRule(g.pending.kind === 'roll' && ['settleRoll', 'reroll'].includes(command.type), '진행 중인 판정을 먼저 마쳐 주세요.')
    if (command.type === 'settleRoll') settleRoll(g, random)
    else {
      const r = g.pending
      requireRule(Number.isInteger(command.index) && command.index >= 0 && command.index < r.dice.length, '다시 굴릴 주사위를 선택하세요.')
      const teacher = p.party.some(s => r.ids.includes(s.uid) && s.ability === 'teacher') && !r.teacherUsed
      const failed = r.dice.reduce((a, b) => a + b, r.bonus) < r.event.target
      const zombie = p.leaderId === 'zombie' && !g.flags.zombie && p.cap >= 1 && failed
      requireRule(teacher || zombie, '재굴림 능력이나 병뚜껑이 부족합니다.')
      if (teacher) r.teacherUsed = true
      else { g.flags.zombie = true; p.cap-- }
      r.dice[command.index] = 1 + Math.floor(random() * 6)
    }
    return g
  }
  const actionTypes = ['explore', 'clue', 'gather', 'rest', 'arrive', 'item', 'maintain']
  if (actionTypes.includes(command.type)) requireRule(g.phase === 'action', '이 행동은 탐색 단계에서만 할 수 있습니다.')
  else requireRule(g.phase === 'maintenance', '파티 정비 단계에서 할 수 있습니다.')
  if (['explore', 'clue', 'gather', 'arrive'].includes(command.type)) requireRule(g.actions > 0, '이번 차례의 행동을 모두 사용했습니다.')

  if (command.type === 'explore' || command.type === 'clue') {
    let e
    if (command.type === 'clue') {
      requireRule(p.clues < 3 && !g.flags.clue, '단서는 차례당 한 번만 획득할 수 있습니다.')
      const clue = CLUES[p.clues]
      requireRule(command.route === 0 || command.route === 1, '단서 경로를 선택하세요.')
      e = { ...clue, kind: 'clue', tags: clue.routes[command.route] }
    } else {
      e = Object.values(g.board).flat().find(x => x?.uid === command.eventId)
      requireRule(e && e.tier <= accessTier(p), '접근할 수 있는 공개 이벤트를 선택하세요.')
    }
    const people = assigned(p, command.ids, e.min ?? 1, e.kind === 'coop' ? 1 : 5)
    if (e.kind === 'coop') {
      requireRule(!g.flags.coop, '협력 제안은 차례당 한 번 가능합니다.')
      const target = g.players.find(x => x.id === command.targetId && x.id !== p.id)
      requireRule(target?.party.some(s => s.active), '활성 생존자가 있는 다른 파티를 선택하세요.')
      g.flags.coop = true
      g.pending = { kind: 'coop', targetId: target.id, ids: command.ids, event: e }
      return g
    }
    if (e.kind === 'raid') {
      requireRule(!g.flags.raid, '약탈은 차례당 한 번 가능합니다.')
      requireRule(['can', 'cap'].includes(command.resource), '가져올 자원을 선택하세요.')
      requireRule(g.players.some(x => x.id === command.targetId && x.id !== p.id && x[command.resource] > 0), '자원이 있는 다른 파티를 선택하세요.')
      g.flags.raid = true
    }
    const bonus = previewBonus(p, command.ids, e.tags, g.flags)
    requireRule(people.length * 6 + bonus.bonus >= e.target, '이 인원으로는 목표에 도달할 수 없습니다. 한 명 더 보내세요.')
    people.forEach(s => { s.active = false; s.usedTurn = g.turn }); g.actions--
    if (bonus.duckUsed) g.flags.duck = true
    g.flags.bonus = 0
    g.pending = { kind: 'roll', event: e, ids: command.ids, dice: people.map(() => 1 + Math.floor(random() * 6)), bonus: bonus.bonus, targetId: command.targetId, resource: command.resource, teacherUsed: false }
  } else if (command.type === 'gather') {
    requireRule(['can', 'cap'].includes(command.resource), '수집할 자원을 선택하세요.')
    const s = assigned(p, command.ids, 1, 1)[0]
    s.active = false; s.usedTurn = g.turn; g.actions--
    const amount = command.resource === 'can' ? 2 + (s.ability === 'cat' ? 1 : 0) : 1
    p[command.resource] += amount
    log(g, `${p.name} · ${s.name}의 안전한 수집: ${command.resource === 'can' ? '통조림' : '병뚜껑'} +${amount}`)
  } else if (command.type === 'rest') {
    requireRule(g.actions === 2, '휴식은 다른 행동을 하기 전에 선택하세요.')
    p.can += 2; g.actions = 0; enterMaintenance(g)
    log(g, `${p.name}이 쉬어 갑니다. 통조림 +2`)
  } else if (command.type === 'maintain') enterMaintenance(g)
  else if (command.type === 'arrive') {
    requireRule(p.clues === 3 && !p.arrived && p.can >= 2 && p.cap >= 2, '단서 3개와 통조림·병뚜껑 각 2개가 필요합니다.')
    assigned(p, command.ids, 4, 4).forEach(s => { s.active = false; s.usedTurn = g.turn })
    p.can -= 2; p.cap -= 2; p.arrived = true; g.actions--
    p.arrivalPoints = g.finalPlayer === null ? 5 : 3
    if (g.finalPlayer === null) g.finalPlayer = p.id
    log(g, `${p.name}이 ${LEADERS.find(l => l.id === g.utopiaLeader).utopia}에 도착! +${p.arrivalPoints}점${p.arrivalPoints === 5 ? ' · 나머지 플레이어의 마지막 차례입니다.' : ''}`)
  } else if (command.type === 'item') {
    const item = p.treasures.find(t => t.uid === command.uid && !t.used)
    requireRule(item, '사용할 보물을 선택하세요.')
    if (item.effect === 'can') p.can += item.amount
    else if (item.effect === 'bonus') { requireRule(!g.flags.bonus, '이미 다음 판정에 나침반 보너스가 있습니다.'); g.flags.bonus = item.amount }
    else { const s = p.party.find(s => s.uid === command.targetUid && !s.active); requireRule(s, '쉬고 있는 생존자를 선택하세요.'); s.active = true }
    item.used = true
    log(g, `${p.name}이 ${item.name}을 사용했습니다. 보물 점수는 남습니다.`)
  } else if (command.type === 'meal') {
    const s = p.party.find(s => s.uid === command.uid && !s.active)
    requireRule(s, '식사가 필요한 생존자를 선택하세요.')
    const cost = mealCost(p, s, g.flags)
    requireRule(p.can >= cost, '통조림이 부족합니다.')
    if (!cost && s.ability !== 'freeMeal' && s.ability !== 'alien') {
      if (p.party.some(x => x.ability === 'alien') && !g.flags.alienMeal) g.flags.alienMeal = true
      else g.flags.cowardMeal = true
    }
    p.can -= cost; s.active = true; delete s.usedTurn
  } else if (command.type === 'reorder') {
    requireRule(Array.isArray(command.ids) && command.ids.length === p.party.length && new Set(command.ids).size === p.party.length, '모든 생존자를 한 번씩 배치하세요.')
    const next = command.ids.map(id => p.party.find(s => s.uid === id))
    requireRule(next.every(Boolean), '내 파티의 생존자만 옮길 수 있습니다.'); validateAdjacency(next); p.party = next
  } else if (command.type === 'discard') {
    const index = p.party.findIndex(s => s.uid === command.uid)
    requireRule(index >= 0, '떠나보낼 생존자를 선택하세요.')
    const next = p.party.filter(s => s.uid !== command.uid); validateAdjacency(next)
    g.departed.push(...p.party.splice(index, 1))
    log(g, `${p.name}이 생존자 한 명을 떠나보냈습니다.`)
  } else if (command.type === 'recruit') {
    requireRule(!g.flags.recruited && p.party.length < partyLimit(p), '영입은 차례당 한 명, 파티 정원까지 가능합니다.')
    let card, source, index
    for (let t = 1; t <= accessTier(p); t++) {
      for (const cards of [g.markets[t], ...(p.leaderId === 'robot' ? [g.decks[t].slice(0, 2)] : [])]) {
        const found = cards.findIndex(s => s?.uid === command.uid)
        if (found >= 0) { card = cards[found]; source = cards === g.markets[t] ? g.markets[t] : g.decks[t]; index = found }
      }
    }
    requireRule(card, '영입 가능한 생존자를 선택하세요.')
    const cost = recruitCost(p, card, Boolean(command.useFood))
    requireRule(p.can >= cost.can && p.cap >= cost.cap, '영입할 자원이 부족합니다.')
    requireRule(Number.isInteger(command.position) && command.position >= 0 && command.position <= p.party.length, '배치할 자리를 선택하세요.')
    const next = [...p.party]; next.splice(command.position, 0, { ...card, active: false, hiredTurn: g.turn }); validateAdjacency(next)
    p.can -= cost.can; p.cap -= cost.cap; p.party = next; g.flags.recruited = true
    if (source === g.markets[card.tier]) source[index] = null
    else {
      const candidates = source.splice(0, 2)
      source.push(...candidates.filter(s => s.uid !== card.uid))
    }
    if (card.ability === 'runner') p.can += 4
    if (card.ability === 'vet') g.flags.vet = true
    log(g, `${p.name}의 파티에 ${card.name} 합류!`)
  } else if (command.type === 'revive') {
    requireRule(g.flags.vet && p.party.length < partyLimit(p), '수의사의 영입 효과와 빈자리가 필요합니다.')
    const index = g.departed.findIndex(s => s.uid === command.uid && s.tier === 1)
    requireRule(index >= 0, '떠난 기본 생존자를 선택하세요.')
    p.party.push({ ...g.departed.splice(index, 1)[0], active: false }); g.flags.vet = false
  } else if (command.type === 'replace') {
    requireRule(!g.flags.replaced && p.cap >= 1, '시장 교체는 차례당 한 번, 병뚜껑 1개입니다.')
    const tier = command.tier
    requireRule(Number.isInteger(tier) && tier >= 1 && tier <= accessTier(p), '이용 가능한 시장을 선택하세요.')
    requireRule(Number.isInteger(command.index) && command.index >= 0 && command.index < 3, '교체할 카드를 선택하세요.')
    const old = g.markets[tier][command.index]
    requireRule(old && g.decks[tier].length, '교체할 카드가 없습니다.')
    g.markets[tier][command.index] = g.decks[tier].shift(); g.decks[tier].push(old); p.cap--; g.flags.replaced = true
  } else if (command.type === 'keepRunner') {
    requireRule(g.flags.runnerDue?.includes(command.uid) && p.cap >= 2, '붙잡을 탈옥수와 병뚜껑 2개가 필요합니다.')
    p.cap -= 2; g.flags.runnerDue = g.flags.runnerDue.filter(id => id !== command.uid)
    const s = p.party.find(s => s.uid === command.uid); if (s) s.ability = 'keptRunner'
  } else if (command.type === 'end') {
    for (const uid of g.flags.runnerDue ?? []) {
      const s = p.party.find(s => s.uid === uid)
      if (s) { g.departed.push(s); p.party = p.party.filter(s => s.uid !== uid); log(g, `${s.name}가 ${p.name}의 파티를 떠났습니다.`) }
    }
    // Remove an adjacency conflict created by a departing runner by separating the pair.
    for (let i = 0; i < p.party.length - 1; i++) {
      if ([p.party[i].ability, p.party[i + 1].ability].sort().join(',') === 'cat,dog') {
        if (p.party.length > 2) { const pet = p.party.splice(i + 1, 1)[0]; p.party.unshift(pet); if ([p.party[0].ability, p.party[1].ability].sort().join(',') === 'cat,dog') p.party.push(p.party.shift()) }
        else { g.departed.push(p.party.pop()); log(g, '단둘이 남은 개와 고양이 중 뒤쪽 생존자가 떠났습니다.') }
      }
    }
    refill(g, random)
    const next = (g.current + 1) % g.players.length
    if (g.players[next].id === g.finalPlayer || (!g.finalPlayer && next === 0 && g.round === 8)) {
      g.ended = true; log(g, '탐험 종료. 우리가 모은 것들을 세어 봅시다.'); return g
    }
    g.current = next; g.turn++; g.phase = 'action'; g.actions = 2; g.flags = {}; g.lastRoll = null
    if (next === 0 && !g.finalPlayer) {
      g.round++
      if ([4, 6].includes(g.round)) {
        const affected = g.players.filter(player => !player.party.some(s => s.ability === 'shelter')).map(p => p.id)
        if (affected.length) g.pending = { kind: 'disaster', targetId: affected[0], remaining: affected.slice(1) }
        log(g, '예고된 재난! 통조림 2개를 내거나 활성 생존자 1명을 쉬게 하세요.')
      }
    }
    const nextPlayer = g.players[next]
    if (!g.pending) supply(g)
    log(g, `${nextPlayer.name}의 차례 · ${g.round}라운드`)
  } else throw new Error('지원하지 않는 행동입니다.')
  clamp(p)
  return g
}

export function publicGame(game, playerId) {
  if (!game) return null
  const { decks, eventDecks, discards, ...visible } = game
  const p = game.players.find(p => p.id === playerId)
  return { ...visible, discards, eventDeckCounts: Object.fromEntries([1, 2, 3].map(t => [t, eventDecks[t].length])), deckCounts: Object.fromEntries([1, 2, 3].map(t => [t, decks[t].length])), robotChoices: p?.leaderId === 'robot' ? Object.fromEntries([1, 2, 3].map(t => [t, t <= accessTier(p) ? decks[t].slice(0, 2) : []])) : {} }
}

function combinations(items, max = 5) {
  const out = []
  for (let mask = 1; mask < 2 ** items.length; mask++) {
    const chosen = items.filter((_, i) => mask & (1 << i))
    if (chosen.length <= max) out.push(chosen.map(s => s.uid))
  }
  return out
}
export function botCommand(g, actorId) {
  const p = g.players.find(p => p.id === actorId)
  if (g.pending?.kind === 'disaster') return { type: 'disaster', pay: p.can >= 2, uid: [...p.party].reverse().find(s => s.active)?.uid }
  if (g.pending?.kind === 'coop') return { type: 'respondCoop', accept: p.party.some(s => s.active), uid: p.party.find(s => s.active)?.uid }
  if (g.pending) {
    const r = g.pending
    const index = r.dice.indexOf(Math.min(...r.dice))
    const failed = r.dice.reduce((a, b) => a + b, r.bonus) < r.event.target
    if (failed && ((p.party.some(s => r.ids.includes(s.uid) && s.ability === 'teacher') && !r.teacherUsed) || (p.leaderId === 'zombie' && !g.flags.zombie && p.cap))) return { type: 'reroll', index }
    return { type: 'settleRoll' }
  }
  if (g.phase === 'maintenance') {
    const runner = g.flags.runnerDue?.find(id => p.party.some(s => s.uid === id))
    if (runner && p.cap >= 2) return { type: 'keepRunner', uid: runner }
    if (!g.flags.recruited && p.party.length < partyLimit(p)) {
      const cards = Object.values(g.markets).flat().filter(s => s && s.tier <= accessTier(p)).sort((a, b) => a.cost - b.cost)
      for (const card of cards) {
        const cost = recruitCost(p, card, true)
        if (cost.can <= p.can && cost.cap <= p.cap) for (let position = 0; position <= p.party.length; position++) {
          const next = [...p.party]; next.splice(position, 0, card)
          try { validateAdjacency(next); return { type: 'recruit', uid: card.uid, position, useFood: true } } catch { /* Try another seat. */ }
        }
      }
    }
    const sleeping = p.party.filter(s => !s.active).sort((a, b) => mealCost(p, a, g.flags) - mealCost(p, b, g.flags))
    const feed = sleeping.find(s => mealCost(p, s, g.flags) <= p.can)
    if (feed) return { type: 'meal', uid: feed.uid }
    return { type: 'end' }
  }
  const active = p.party.filter(s => s.active)
  if (!g.actions) return { type: 'maintain' }
  if (p.clues === 3 && !p.arrived && active.length >= 4 && p.can >= 2 && p.cap >= 2) return { type: 'arrive', ids: active.slice(0, 4).map(s => s.uid) }
  if (!active.length) return { type: g.actions === 2 ? 'rest' : 'maintain' }
  const groups = combinations(active)
  if (p.clues < 3 && !g.flags.clue) {
    const c = CLUES[p.clues]
    for (const ids of groups.sort((a, b) => a.length - b.length)) for (const route of [0, 1]) {
      if (ids.length >= c.min && successChance(ids.length, c.target, previewBonus(p, ids, c.routes[route], g.flags).bonus) >= 0.65) return { type: 'clue', ids, route }
    }
  }
  const resource = p.can < Math.max(4, p.party.length) ? 'can' : 'cap'
  let best = null
  for (const e of Object.values(g.board).flat().filter(e => e && e.tier <= accessTier(p) && ['supply', 'score', 'treasure'].includes(e.kind))) for (const ids of groups) {
    const chance = successChance(ids.length, e.target, previewBonus(p, ids, e.tags, g.flags).bonus)
    if (chance < 0.5) continue
    const value = chance * e.reward * (e.resource === resource ? 2 : e.kind === 'score' && p.party.length >= 4 ? 2 : 0.7) / ids.length
    if (!best || value > best.value) best = { type: 'explore', eventId: e.uid, ids, value }
  }
  return best ?? { type: 'gather', resource, ids: [active[0].uid] }
}
