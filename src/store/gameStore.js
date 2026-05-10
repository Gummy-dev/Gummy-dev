import { create } from 'zustand'
import { DEFAULT_TURN_END_RESOURCES, DEFAULT_TURN_START_RESOURCES, SURVIVORS } from '../data/survivors.js'
import { CLUE_CARDS, DISASTER_CARDS, EVENT_DECKS, EVENTS, EXPLORATION_TIER_CARDS } from '../data/events.js'
import { LEADERS } from '../data/leaders.js'
import { RULES } from '../data/rules.js'
import { UTOPIA_CARDS } from '../data/utopias.js'
import { calcPartyScore } from '../logic/scoring.js'
import {
  calcBotUpkeep,
  chooseBotDiscardUids,
  chooseBotSacrifice,
  decideBotAction,
  canBotAttemptEvent,
  evaluateEvent,
  findBestPartySwap,
  findBestTake,
  findBotDismissTarget,
} from '../logic/bot.js'

// ── 유틸 ──────────────────────────────────────────────────────────────
function rollD6() {
  return Math.ceil(Math.random() * 6)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildSurvivorDeck() {
  const deck = []
  SURVIVORS.forEach((s) => {
    const copies = s.count ?? 1
    for (let i = 0; i < copies; i++) {
      deck.push({ ...s, searchTier: getSurvivorSearchTier(s), uid: `${s.id}_${i}` })
    }
  })
  return shuffle(deck)
}

function getSurvivorSearchTier(survivor) {
  if (survivor?.searchTier) return survivor.searchTier
  if (survivor?.tier) return survivor.tier
  const cost = survivor?.recruitCost ?? 0
  if (cost <= 5) return 1
  if (cost <= 7) return 2
  return 3
}

function isNormalSurvivor(survivor) {
  return survivor?.type === '평범'
}

function getNormalSurvivorCount(party = []) {
  return party.filter(isNormalSurvivor).length
}

function buildEventDeck() {
  const deck = []
  EVENTS.forEach((event) => {
    const copies = event.count ?? 1
    for (let i = 0; i < copies; i += 1) {
      deck.push({ ...event, uid: `${event.id}_${i}` })
    }
  })
  return shuffle(deck)
}

function buildCardCopies(cards = [], overrideCopies = null) {
  const deck = []
  cards.forEach((card) => {
    const copies = overrideCopies ?? card.count ?? 1
    for (let i = 0; i < copies; i += 1) {
      deck.push({ ...card, uid: `${card.id}_${i}` })
    }
  })
  return deck
}

function buildTierDeck(cards = []) {
  return shuffle(buildCardCopies(cards))
}

function buildClueDeck(cards = [], clueCopies = 0) {
  return shuffle(buildCardCopies(cards, clueCopies || null))
}

function buildTierClueCards(cards = [], clueCount = 0) {
  const selectedCards = shuffle(cards).slice(0, Math.min(clueCount, cards.length))
  return buildCardCopies(selectedCards)
}

function getExplorationSlotCountForTier(tier) {
  return RULES.exploration?.eventSlotCountByTier?.[tier] ?? 4
}

function getLegacyExplorationSlotCount() {
  return [1, 2, 3].reduce((sum, tier) => sum + getExplorationSlotCountForTier(tier), 0)
}

function getSearchSlotCountForTier(tier) {
  return RULES.search?.slotCountByTier?.[tier] ?? RULES.search?.slotCount ?? 2
}

function getLegacySearchSlotCount() {
  return [1, 2, 3].reduce((sum, tier) => sum + getSearchSlotCountForTier(tier), 0)
}

function getTierForSearchSlotIndex(slotIndex) {
  const tier1Count = getSearchSlotCountForTier(1)
  const tier2Count = getSearchSlotCountForTier(2)
  if (slotIndex < tier1Count) return 1
  if (slotIndex < tier1Count + tier2Count) return 2
  return 3
}

function getTierForEventSlotIndex(slotIndex) {
  const tier1Count = getExplorationSlotCountForTier(1)
  const tier2Count = getExplorationSlotCountForTier(2)
  if (slotIndex < tier1Count) return 1
  if (slotIndex < tier1Count + tier2Count) return 2
  return 3
}

function canAccessExplorationTier(player, tier) {
  return (player?.unlockedExplorationTier ?? 1) >= tier
}

function flattenVisibleByTier(visibleByTier = {}) {
  return [
    ...(visibleByTier[1] ?? []),
    ...(visibleByTier[2] ?? []),
    ...(visibleByTier[3] ?? []),
  ]
}

function flattenSearchDecksByTier(decksByTier = {}) {
  return [
    ...(decksByTier[1] ?? []),
    ...(decksByTier[2] ?? []),
    ...(decksByTier[3] ?? []),
  ]
}

function buildSearchDecksByTierFromCards(cards = []) {
  const decksByTier = { 1: [], 2: [], 3: [] }
  cards.forEach((survivor) => {
    decksByTier[getSurvivorSearchTier(survivor)].push(survivor)
  })
  return decksByTier
}

function buildExplorationState(playerCount) {
  const clueCopies = RULES.clues?.copiesPerTierByPlayerCount?.[playerCount] ?? playerCount
  const decksByTier = {
    1: shuffle([
      ...buildCardCopies(EXPLORATION_TIER_CARDS[1] ?? []),
      ...buildTierClueCards(CLUE_CARDS[1] ?? [], clueCopies),
      ...buildCardCopies(DISASTER_CARDS[1] ?? []),
    ]),
    2: shuffle([
      ...buildCardCopies(EXPLORATION_TIER_CARDS[2] ?? []),
      ...buildTierClueCards(CLUE_CARDS[2] ?? [], clueCopies),
      ...buildCardCopies(DISASTER_CARDS[2] ?? []),
    ]),
    3: shuffle([
      ...buildCardCopies(EXPLORATION_TIER_CARDS[3] ?? []),
      ...buildTierClueCards(CLUE_CARDS[3] ?? [], clueCopies),
      ...buildCardCopies(DISASTER_CARDS[3] ?? []),
    ]),
  }

  const visibleByTier = { 1: [], 2: [], 3: [] }

  ;[1, 2, 3].forEach((tier) => {
    for (let i = 0; i < getExplorationSlotCountForTier(tier); i += 1) {
      visibleByTier[tier].push(decksByTier[tier].shift() ?? null)
    }
  })

  return {
    decksByTier,
    clueDecksByTier: { 1: [], 2: [], 3: [] },
    disasterDecksByTier: { 1: [], 2: [], 3: [] },
    visibleByTier,
  }
}

function buildSearchState(survivorDeck = []) {
  const decksByTier = { 1: [], 2: [], 3: [] }
  survivorDeck.forEach((survivor) => {
    const tier = getSurvivorSearchTier(survivor)
    decksByTier[tier].push(survivor)
  })
  decksByTier[1] = shuffle(decksByTier[1])
  decksByTier[2] = shuffle(decksByTier[2])
  decksByTier[3] = shuffle(decksByTier[3])

  const visibleByTier = { 1: [], 2: [], 3: [] }
  ;[1, 2, 3].forEach((tier) => {
    for (let i = 0; i < getSearchSlotCountForTier(tier); i += 1) {
      visibleByTier[tier].push(null)
    }
  })

  return {
    decksByTier,
    visibleByTier,
    visibleSlots: flattenVisibleByTier(visibleByTier),
    revealActionCost: RULES.search.revealActionCost,
    assignedSurvivorsRequired: RULES.search.assignedSurvivorsRequired,
    recruitStartsInactive: RULES.search.recruitStartsInactive,
  }
}

function revealInitialSearchTier(searchState = {}, tier = 1) {
  const decksByTier = {
    1: [...(searchState.decksByTier?.[1] ?? [])],
    2: [...(searchState.decksByTier?.[2] ?? [])],
    3: [...(searchState.decksByTier?.[3] ?? [])],
  }
  const visibleByTier = {
    1: [...(searchState.visibleByTier?.[1] ?? [])],
    2: [...(searchState.visibleByTier?.[2] ?? [])],
    3: [...(searchState.visibleByTier?.[3] ?? [])],
  }

  for (let i = 0; i < getSearchSlotCountForTier(tier); i += 1) {
    if (visibleByTier[tier][i]) continue
    visibleByTier[tier][i] = decksByTier[tier].shift() ?? null
  }

  return {
    ...searchState,
    decksByTier,
    visibleByTier,
    visibleSlots: flattenVisibleByTier(visibleByTier),
  }
}

function buildVisibleByTierFromEventSlots(eventSlots = []) {
  const visibleByTier = { 1: [], 2: [], 3: [] }
  eventSlots.forEach((event) => {
    if (!event) return
    const tier = event.tier ?? 1
    if (visibleByTier[tier].length < (RULES.exploration?.slotCountByTier?.[tier] ?? 4)) {
      visibleByTier[tier].push(event)
    }
  })
  return visibleByTier
}

function syncExplorationStateWithEventSlots(explorationState = {}, eventSlots = []) {
  return {
    ...explorationState,
    visibleByTier: {
      1: eventSlots.slice(0, getExplorationSlotCountForTier(1)),
      2: eventSlots.slice(getExplorationSlotCountForTier(1), getExplorationSlotCountForTier(1) + getExplorationSlotCountForTier(2)),
      3: eventSlots.slice(getExplorationSlotCountForTier(1) + getExplorationSlotCountForTier(2), getLegacyExplorationSlotCount()),
    },
  }
}

function syncSearchStateWithMercenaryPool(searchState = {}, mercenaryPool = []) {
  const visibleByTier = {
    1: mercenaryPool.slice(0, getSearchSlotCountForTier(1)),
    2: mercenaryPool.slice(getSearchSlotCountForTier(1), getSearchSlotCountForTier(1) + getSearchSlotCountForTier(2)),
    3: mercenaryPool.slice(getSearchSlotCountForTier(1) + getSearchSlotCountForTier(2), getLegacySearchSlotCount()),
  }
  return {
    ...searchState,
    visibleSlots: [...mercenaryPool],
    visibleByTier,
  }
}

function buildUtopiaState() {
  return {
    revealed: false,
    claimed: false,
    revealedForLeaderId: null,
    claimedByPlayerId: null,
    cardsByLeaderId: Object.fromEntries(
      Object.values(UTOPIA_CARDS).map((card) => [card.leaderId, { ...card }])
    ),
  }
}

function getPartySlotCount(party = []) {
  let count = 0
  let lastStackGroupKey = null

  for (const survivor of party) {
    const stackGroupKey = survivor.stackGroupKey ?? null
    if (stackGroupKey && stackGroupKey === lastStackGroupKey) continue
    count += 1
    lastStackGroupKey = stackGroupKey
  }

  return count
}

const ANIMAL_SURVIVOR_IDS = new Set([
  's_charge_2',
  's_coward_1',
  's_charge_4',
  's_military_2',
])

function resolveStackHost(party = [], survivor) {
  if (!survivor) return null

  if (survivor.stackKey) {
    const stackMatch = party.find((entry) => entry.uid !== survivor.uid && entry.stackKey === survivor.stackKey)
    if (stackMatch) return { mode: 'stackKey', host: stackMatch }
  }

  const capybaraHost = party.find((entry) => entry.id === 's_mood_3')
  if (capybaraHost && ANIMAL_SURVIVOR_IDS.has(survivor.id)) {
    return { mode: 'capybara', host: capybaraHost }
  }

  return null
}

function canStackOnExistingSlot(party = [], survivor) {
  return !!resolveStackHost(party, survivor)
}

function addSurvivorToParty(party = [], survivor, maxPartySize = RULES.maxPartySize) {
  const nextParty = [...party]

  if (!survivor || nextParty.some((entry) => entry.uid === survivor.uid)) {
    return { party: nextParty, added: false, stacked: false }
  }

  if (!canAddSurvivorToParty(nextParty, survivor)) {
    return { party: nextParty, added: false, stacked: false }
  }

  const stackHost = resolveStackHost(nextParty, survivor)
  if (stackHost) {
    const hostIndex = nextParty.findIndex((entry) => entry.uid === stackHost.host.uid)
    const host = nextParty[hostIndex]
    const stackGroupKey = host.stackGroupKey ?? host.uid
    nextParty[hostIndex] = { ...host, stackGroupKey }
    nextParty.splice(hostIndex + 1, 0, { ...survivor, stackGroupKey })
    return { party: nextParty, added: true, stacked: true }
  }

  if (getPartySlotCount(nextParty) >= maxPartySize) {
    return { party: nextParty, added: false, stacked: false }
  }

  nextParty.push(survivor)
  return { party: nextParty, added: true, stacked: false }
}

function getContiguousPartyGroupBounds(party = [], index) {
  if (index < 0 || index >= party.length) return null
  const survivor = party[index]
  const stackGroupKey = survivor.stackGroupKey ?? null
  if (!stackGroupKey) {
    return { start: index, end: index, members: [survivor], isStacked: false }
  }

  let start = index
  let end = index
  while (start > 0 && party[start - 1]?.stackGroupKey === stackGroupKey) start -= 1
  while (end < party.length - 1 && party[end + 1]?.stackGroupKey === stackGroupKey) end += 1

  return {
    start,
    end,
    members: party.slice(start, end + 1),
    isStacked: true,
  }
}

function swapPartyGroups(party = [], fromIdx, toIdx) {
  if (fromIdx === toIdx) return [...party]
  const fromGroup = getContiguousPartyGroupBounds(party, fromIdx)
  const toGroup = getContiguousPartyGroupBounds(party, toIdx)
  if (!fromGroup || !toGroup) return [...party]
  if (fromGroup.start === toGroup.start && fromGroup.end === toGroup.end) return [...party]

  if (!fromGroup.isStacked && !toGroup.isStacked) {
    const nextParty = [...party]
    ;[nextParty[fromIdx], nextParty[toIdx]] = [nextParty[toIdx], nextParty[fromIdx]]
    return nextParty
  }

  if (fromGroup.start < toGroup.start) {
    return [
      ...party.slice(0, fromGroup.start),
      ...toGroup.members,
      ...party.slice(fromGroup.end + 1, toGroup.start),
      ...fromGroup.members,
      ...party.slice(toGroup.end + 1),
    ]
  }

  return [
    ...party.slice(0, toGroup.start),
    ...fromGroup.members,
    ...party.slice(toGroup.end + 1, fromGroup.start),
    ...toGroup.members,
    ...party.slice(fromGroup.end + 1),
  ]
}

function getPartyReorderCostReduction(player) {
  return (player.party ?? []).reduce((sum, survivor, index) => {
    let next = sum
    if (survivor.type === '반장' && index <= 1) {
      next += 1
    }
    if (survivor.partyPassive?.type === 'reduce_reorder_cost') {
      next += survivor.partyPassive.amount ?? 0
    }
    return next
  }, 0)
}

function hasCenterWeirdType(player) {
  return player.party?.[2]?.type === '4차원'
}

function isAnimalSurvivor(survivor) {
  return [
    's_military_2',
    's_charge_2',
    's_charge_4',
    's_coward_1',
    's_mood_3',
  ].includes(survivor?.id)
}

function canReceiveTransferredSurvivors(targetPlayer, survivors = []) {
  if (!targetPlayer || !survivors.length) return false
  let nextParty = [...(targetPlayer.party ?? [])]
  for (const survivor of survivors) {
    const applied = addSurvivorToParty(nextParty, survivor, targetPlayer.maxPartySize)
    if (!applied.added) return false
    nextParty = applied.party
  }
  return true
}

function createFollowUpResolution(resolution) {
  if (!resolution?.then) return resolution
  const { then, ...rest } = resolution
  return { ...rest, type: then }
}

function isSurvivorActive(player, survivorOrUid) {
  const uid = typeof survivorOrUid === 'string' ? survivorOrUid : survivorOrUid?.uid
  if (!uid) return true
  return player?.survivorActivity?.[uid] !== false
}

function setSurvivorActiveState(player, survivorOrUid, active) {
  const uid = typeof survivorOrUid === 'string' ? survivorOrUid : survivorOrUid?.uid
  if (!uid) return player
  return {
    ...player,
    survivorActivity: {
      ...(player.survivorActivity ?? {}),
      [uid]: !!active,
    },
  }
}

function setMultipleSurvivorsActiveState(player, survivors = [], active) {
  let nextPlayer = player
  for (const survivor of survivors) {
    nextPlayer = setSurvivorActiveState(nextPlayer, survivor, active)
  }
  return nextPlayer
}

function normalizeCost(cost) {
  if (typeof cost === 'number') return { can: cost }
  return {
    can: cost?.can ?? 0,
    bottleCap: cost?.bottleCap ?? 0,
  }
}

function canAffordCost(resources = {}, cost = {}) {
  return (resources.can ?? 0) >= (cost.can ?? 0) && (resources.bottleCap ?? 0) >= (cost.bottleCap ?? 0)
}

function subtractCost(resources = {}, cost = {}) {
  return {
    ...resources,
    can: Math.max(0, (resources.can ?? 0) - (cost.can ?? 0)),
    bottleCap: Math.max(0, (resources.bottleCap ?? 0) - (cost.bottleCap ?? 0)),
  }
}

function getReactivationCostForSurvivor(player, survivor, survivorIndex) {
  const base = normalizeCost(survivor?.reactivationCost ?? RULES.economy.defaultReactivationCost)
  if (survivor?.type === '겁쟁이' && survivorIndex >= 3) {
    return {
      ...base,
      can: Math.max(0, base.can - 1),
    }
  }
  return base
}

function pruneSurvivorActivity(player) {
  const partyUids = new Set((player.party ?? []).map((survivor) => survivor.uid))
  const nextActivity = {}
  for (const [uid, active] of Object.entries(player.survivorActivity ?? {})) {
    if (partyUids.has(uid)) nextActivity[uid] = active
  }
  return {
    ...player,
    survivorActivity: nextActivity,
  }
}

function getActivePartyMembers(player) {
  return (player?.party ?? []).filter((survivor) => isSurvivorActive(player, survivor))
}

function isRollDiceType(type) {
  return type === 'roll_dice' || type === 'roll_dice_score_bonus'
}

function getRequiredExplorationSurvivorCount(event) {
  if (isRollDiceType(event?.resolution?.type)) return 1
  const tier = event?.tier ?? 1
  if (event?.assignment?.minSurvivors) return event.assignment.minSurvivors
  return RULES.exploration?.tiers?.[tier]?.minAssigned ?? 1
}

function getMaxExplorationSurvivorCount(event) {
  if (isRollDiceType(event?.resolution?.type)) return 5
  const tier = event?.tier ?? 1
  if (event?.assignment?.maxSurvivors) return event.assignment.maxSurvivors
  return RULES.exploration?.tiers?.[tier]?.maxAssigned ?? getRequiredExplorationSurvivorCount(event)
}

function getRecommendedDiceAssignmentCount(event, activeCount) {
  if (!isRollDiceType(event?.resolution?.type)) return getRequiredExplorationSurvivorCount(event)
  const target = event.resolution?.target ?? 4
  return Math.max(1, Math.min(5, activeCount, Math.ceil(target / 3.5)))
}

function getRequiredAssignedTypeForEvent(event) {
  return event?.resolution?.type === 'check_survivor_type'
    ? event.resolution.survivorType
    : null
}

function hasRequiredAssignedType(player, event, selectedUids = []) {
  const requiredType = getRequiredAssignedTypeForEvent(event)
  if (!requiredType) return true
  return selectedUids
    .map((uid) => player?.party?.find((survivor) => survivor.uid === uid))
    .some((survivor) => survivor?.type === requiredType)
}

function getRecommendedPartyBonusForAssignment(event, assignedSurvivors = [], player = null) {
  const requirements = event?.recommendedParty ?? []
  if (requirements.length === 0) return 0
  const matches = requirements.every(({ type, count = 1 }) => (
    assignedSurvivors.filter((survivor) => survivor?.type === type).length >= count
  ))
  if (!matches) return 0
  const base = event?.resolution?.recommendedPartyBonus ?? event?.check?.recommendedPartyBonus ?? event?.recommendedPartyBonus ?? 2
  const moodMakerBoost = player?.party?.[2]?.type === '분위기메이커' ? 1 : 0
  return base + moodMakerBoost
}

function getAssignedSurvivorScore(assignedSurvivors = []) {
  return assignedSurvivors.reduce((sum, survivor) => sum + (survivor?.score ?? 0), 0)
}

function createUtopiaEventFromCard(card) {
  if (!card) return null
  return {
    ...card,
    tier: 3,
    category: 'utopia',
    scope: 'personal',
    resolution: card.check,
    reward: { type: 'score', amount: 5 },
    isUtopiaCard: true,
  }
}

function canAttemptRevealedUtopia(player, utopiaState) {
  return Boolean(
    utopiaState?.revealed &&
    !utopiaState?.claimed &&
    (player?.claimedCluesByTier?.[3]?.length ?? 0) > 0
  )
}

function getSharedDepartedSurvivors(players = [], departedSurvivors = []) {
  const merged = [
    ...departedSurvivors,
    ...players.flatMap((player) => player.graveyard ?? []),
  ]
  const seen = new Set()
  return merged.filter((survivor) => {
    if (!survivor || seen.has(survivor.uid)) return false
    seen.add(survivor.uid)
    return true
  })
}

function applyClueClaimProgress(player, event) {
  if (event?.category !== 'clue') return player
  const tier = event?.tier ?? 1
  const nextClaimed = {
    1: [...(player.claimedCluesByTier?.[1] ?? [])],
    2: [...(player.claimedCluesByTier?.[2] ?? [])],
    3: [...(player.claimedCluesByTier?.[3] ?? [])],
  }
  nextClaimed[tier].push({
    id: event.id,
    uid: event.uid,
    name: event.name,
    emoji: event.emoji,
    tier,
  })

  return {
    ...player,
    clueTokens: (player.clueTokens ?? 0) + 1,
    claimedCluesByTier: nextClaimed,
    unlockedExplorationTier: Math.max(player.unlockedExplorationTier ?? 1, Math.min(3, tier + 1)),
  }
}

function removeSurvivorFromSharedDeparted(players = [], departedSurvivors = [], uid) {
  let removed = null
  const nextPlayers = players.map((player) => {
    const graveyard = [...(player.graveyard ?? [])]
    const foundIndex = graveyard.findIndex((survivor) => survivor.uid === uid)
    if (foundIndex < 0) return player
    removed = graveyard[foundIndex]
    graveyard.splice(foundIndex, 1)
    return { ...player, graveyard }
  })

  if (removed) {
    return { players: nextPlayers, departedSurvivors, survivor: removed }
  }

  const nextDeparted = [...departedSurvivors]
  const departedIndex = nextDeparted.findIndex((survivor) => survivor.uid === uid)
  if (departedIndex >= 0) {
    removed = nextDeparted[departedIndex]
    nextDeparted.splice(departedIndex, 1)
  }

  return { players: nextPlayers, departedSurvivors: nextDeparted, survivor: removed }
}

function createPlayer(id, leaderId, isBot = false) {
  const leader = LEADERS.find((l) => l.id === leaderId)
  return {
    id,
    name: leader.name,
    isBot,
    turnsTaken: 0,
    leaderId,
    leaderName: leader.name,
    leaderEmoji: leader.emoji,
    leaderColor: leader.color,
    type: leader.type,
    specialWin: leader.specialWin,
    uniqueSkill: { ...(leader.uniqueSkill ?? {}) },
    passiveIncome: { ...(leader.passiveIncome ?? { can: 0, bottleCap: 0 }) },
    resources: { ...leader.initialResources },
    maxResources: { ...leader.maxResources },
    party: [],
    leaderFans: [],
    survivorActivity: {},
    graveyard: [],
    eventDiscard: [],
    scoreTokens: 0,
    clueTokens: 0,
    claimedCluesByTier: { 1: [], 2: [], 3: [] },
    unlockedExplorationTier: 1,
    abandonedEvents: [],
    turnFlags: {
      doctorShieldUsed: false,
      returnedSurvivorUsed: false,
      wizardSpellUsed: false,
    },
    maxPartySize: leader.maxPartySize ?? RULES.maxPartySize,
    score: 0,
  }
}

// ── 전역 이벤트 효과 적용 ─────────────────────────────────────────────
function applyGlobalEffectToState(state, effect, sourceEvent = null, logs = null, dicePopups = null) {
  if (!effect) return state
  if (effect.type === 'compound') {
    return effect.effects.reduce((s, e) => applyGlobalEffectToState(s, e, sourceEvent, logs, dicePopups), state)
  }

  const players = state.players.map((p) => {
    let u = { ...p, resources: { ...p.resources }, party: [...p.party], graveyard: [...(p.graveyard ?? [])], turnFlags: { ...(p.turnFlags ?? {}) } }
    switch (effect.type) {
      case 'remove_all_n': {
        let removeCount = effect.amount
        const disasterDefense = sourceEvent?.scope === 'disaster' ? getDisasterDefenseResult(u) : null
        if (disasterDefense?.log && logs) logs.push(disasterDefense.log)
        if (disasterDefense?.dicePopup && dicePopups) dicePopups.push(disasterDefense.dicePopup)
        if (disasterDefense?.prevented > 0) {
          removeCount = Math.max(0, removeCount - disasterDefense.prevented)
        }

        if (removeCount > 0 && hasDoctorShieldAvailable(u)) {
          removeCount -= 1
          u.turnFlags.doctorShieldUsed = true
          u.resources.can = Math.max(0, u.resources.can - 3)
        }

        for (let removedCount = 0; removedCount < removeCount; removedCount += 1) {
          const target = u.party[u.party.length - 1]
          if (!target) break
          const loss = preventSingleSurvivorLoss(u, target, { reason: sourceEvent?.scope === 'disaster' ? 'disaster_damage' : 'event_damage' })
          u = loss.player
          if ((loss.canGain ?? 0) > 0) u.resources.can += loss.canGain
          if (loss.message && logs) logs.push(loss.message)
        }

        if (disasterDefense?.sacrificedUid) {
          const sacrificed = u.party.find((survivor) => survivor.uid === disasterDefense.sacrificedUid)
          if (sacrificed) {
            u.party = u.party.filter((survivor) => survivor.uid !== disasterDefense.sacrificedUid)
            u.graveyard = [...u.graveyard, sacrificed]
          }
        }

        // s_coward_5 가든일: 재난 후 통조림 +2 (제거 여부와 무관)
        if (sourceEvent?.scope === 'disaster' && u.party.some((sv) => sv.id === 's_coward_5')) {
          u.resources.can += 2
          if (logs) logs.push(`🌊 가든일 효과: 재난 후 통조림 +2`)
        }
        break
      }
      case 'add_survivors_all': {
        const deck = state._tmpDeck ?? state.survivorDeck
        const added = []
        for (const candidate of deck) {
          if (added.length >= effect.amount) break
          const applied = addSurvivorToParty(u.party, candidate, u.maxPartySize)
          if (!applied.added) continue
          u.party = applied.party
          u.survivorActivity = {
            ...(u.survivorActivity ?? {}),
            [candidate.uid]: false,
          }
          added.push(candidate)
        }
        break
      }
      case 'shuffle_all_parties':
        u.party = shuffle(u.party)
        break
      case 'lose_can_all':
        u.resources.can = Math.max(0, u.resources.can - effect.amount)
        break
      case 'lose_cap_all':
        u.resources.bottleCap = Math.max(0, u.resources.bottleCap - effect.amount)
        break
      case 'gain_can_all':
        u.resources.can += effect.amount
        break
      case 'halve_can_all':
        u.resources.can = Math.floor(u.resources.can / 2)
        break
      default:
        break
    }
    return clampPlayerResources(u)
  })

  // add_survivors_all 인 경우 덱에서 사용한 만큼 제거
  let survivorDeck = state.survivorDeck
  let searchState = state.searchState
  if (effect.type === 'add_survivors_all') {
    const used = players.reduce((acc, player, index) => acc + Math.max(0, player.party.length - state.players[index].party.length), 0)
    survivorDeck = survivorDeck.slice(used)
    searchState = { ...searchState, decksByTier: buildSearchDecksByTierFromCards(survivorDeck) }
  }

  return {
    ...state,
    players: players.map((player) => ({ ...player, score: calcPlayerScore(player) })),
    survivorDeck,
    searchState,
  }
}

// ────────────────────────────────────────────────────────────────────
export const useGameStore = create((set, get) => ({
  // ── 화면 ──────────────────────────────────────
  screen: 'setup',

  // ── 설정 ──────────────────────────────────────
  playerCount: 2,
  playerConfigs: [],

  // ── 게임 상태 ─────────────────────────────────
  players: [],
  currentPlayerIndex: 0,
  round: 1,
  gameEnded: false,
  finalRoundActive: false,
  finalRoundTriggerPlayerIndex: null,
  winnerIds: [],
  finalStandings: [],
  finalReason: '',

  // 턴 페이즈
  // 'action'            : 주변 탐색 확인 및 해결
  // 'party_maintenance' : 파티 정비, 영입, 자원 교환
  phase: 'action',
  turnStructure: {
    version: 'legacy',
    phases: ['action', 'party_maintenance'],
    current: 'action',
  },

  // 다음 개편용 상태
  explorationState: {
    decksByTier: { 1: [], 2: [], 3: [] },
    clueDecksByTier: { 1: [], 2: [], 3: [] },
    disasterDecksByTier: { 1: [], 2: [], 3: [] },
    visibleByTier: { 1: [], 2: [], 3: [] },
  },
  searchState: {
    decksByTier: { 1: [], 2: [], 3: [] },
    visibleByTier: { 1: [], 2: [], 3: [] },
    visibleSlots: [],
    revealActionCost: RULES.search.revealActionCost,
    assignedSurvivorsRequired: RULES.search.assignedSurvivorsRequired,
    recruitStartsInactive: RULES.search.recruitStartsInactive,
  },
  utopiaState: {
    revealed: false,
    claimed: false,
    revealedForLeaderId: null,
    claimedByPlayerId: null,
    cardsByLeaderId: {},
  },

  // 이벤트 슬롯
  eventDeck: [],
  eventSlots: Array(getLegacyExplorationSlotCount()).fill(null),
  revealedSlots: Array(getLegacyExplorationSlotCount()).fill(false),   // 공개 여부 — 턴이 바뀌어도 유지
  utopiaSlotIndex: null,

  // 인터랙션 상태 (이벤트 해결 중 플레이어 선택이 필요할 때)
  interaction: null,
  /*
    interaction = {
      slotIndex: number,
      event: { ...eventData },
      step: 'select_my_survivor'
            | 'select_target_player'
            | 'select_target_survivor'
            | 'select_swap_a'
            | 'select_swap_b',
      payload: {
        selectedMyUids: [],      // 내 파티에서 고른 uid 목록
        targetPlayerIndex: null,
        targetSurvivorUid: null,
        swapA: null,
        swapB: null,
      },
      resolvedSlots: [],         // 이미 해결 완료된 슬롯 (리필 대기)
    }
  */

  // 구매 단계
  survivorDeck: [],
  mercenaryPool: [],
  revealedUids: [],
  departedSurvivors: [],
  returnedMercenary: null,
  pendingTurnEndShortage: null,
  actionEffects: [],
  diceRollModal: null, // { slotIndex, event, partyScore, recommendedBonus }
  survivorDiceQueue: [], // [{ icon, name, rolls, successOn, success, outcomeLabel, detail, extraRoll? }]

  globalLog: [],

  // ── 설정 화면 ─────────────────────────────────
  setPlayerConfig(index, config) {
    set((state) => {
      const configs = [...state.playerConfigs]
      configs[index] = { ...configs[index], ...config }
      return { playerConfigs: configs }
    })
  },

  initConfigs(count) {
    const configs = Array.from({ length: count }, (_, i) => ({
      leaderId: LEADERS[i % LEADERS.length].id,
      isBot: i > 0,
    }))
    set({ playerCount: count, playerConfigs: configs })
  },

  // ── 게임 시작 ─────────────────────────────────
  startGame() {
    const { playerConfigs } = get()
    const fullSurvivorDeck = buildSurvivorDeck()
    const rawEventDeck = buildEventDeck()
    const players = playerConfigs.map((cfg, i) =>
      createPlayer(i + 1, cfg.leaderId, cfg.isBot)
    )
    const explorationState = buildExplorationState(players.length)
    const eventSlots = flattenVisibleByTier(explorationState.visibleByTier)
    const eventDeck = rawEventDeck
    const searchState = revealInitialSearchTier(buildSearchState(fullSurvivorDeck), 1)
    const mercenaryPool = flattenVisibleByTier(searchState.visibleByTier)
    const survivorDeck = flattenSearchDecksByTier(searchState.decksByTier)
    const utopiaState = buildUtopiaState()

    set({
      screen: 'game',
      players, currentPlayerIndex: 0, round: 1, phase: 'party_maintenance',
      turnStructure: {
        version: 'legacy',
        phases: ['action', 'party_maintenance'],
        current: 'action',
      },
      gameEnded: false,
      finalRoundActive: false,
      finalRoundTriggerPlayerIndex: null,
      winnerIds: [],
      finalStandings: [],
      finalReason: '',
      survivorDeck, mercenaryPool, revealedUids: mercenaryPool.filter(Boolean).map((sv) => sv.uid),
      departedSurvivors: [],
      returnedMercenary: null,
      pendingTurnEndShortage: null,
      actionEffects: [],
      eventDeck,
      eventSlots,
      revealedSlots: eventSlots.map((event) => Boolean(event)),
      utopiaSlotIndex: null,
      explorationState,
      searchState,
      utopiaState,
      interaction: null,
      globalLog: ['게임 시작! 각 플레이어의 첫 턴은 파티 정비 단계만 진행합니다.'],
    })

    get().settleCurrentPlayerTurnStart()

    if (players[0].isBot) setTimeout(() => get().runBotTurn(), RULES.botThinkDelay)
  },

  // ── 이벤트 슬롯 공개 (legacy: 현재 주변 탐색 카드는 해금된 단계에서 기본 공개) ─────────────
  revealEventSlot(slotIndex) {
    const state = get()
    const player = state.players[state.currentPlayerIndex]
    const event = state.eventSlots[slotIndex]
    if (state.phase !== 'action' || state.interaction) return
    if (!event || state.revealedSlots[slotIndex]) return
    const tier = event.tier ?? getTierForEventSlotIndex(slotIndex)
    if (!canAccessExplorationTier(player, tier)) {
      get().addLog(`${player.name} — ${event.emoji} ${event.name} 확인 불가 (탐색 단계 미해금)`)
      return
    }

    const revealCost = RULES.exploration?.revealCanCostByTier?.[tier] ?? tier
    if ((player.resources?.can ?? 0) < revealCost) {
      get().addLog(`${player.name} — 탐색 확인 불가 (🥫 ${revealCost} 필요)`)
      return
    }

    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
      p.resources.can -= revealCost
      players[s.currentPlayerIndex] = clampPlayerResources(p)
      const revealedSlots = [...s.revealedSlots]
      revealedSlots[slotIndex] = true
      return { players, revealedSlots }
    })

    get().addLog(`${player.name} — 탐색 확인: ${event.emoji} ${event.name} (🥫-${revealCost})`)
  },

  // ── 전체/재난 이벤트 수동 수락 후 발동 ────────
  acceptGlobalEvent(slotIndex) {
    const { eventSlots, revealedSlots, currentPlayerIndex, players, phase, interaction } = get()
    const event = eventSlots[slotIndex]
    if (phase !== 'action' || interaction || !revealedSlots[slotIndex]) return
    if (!event || event.scope === 'personal') return
    if (!canAccessExplorationTier(players[currentPlayerIndex], event.tier ?? getTierForEventSlotIndex(slotIndex))) return

    const defLogs = []
    const defDicePopups = []
    set((s) => {
      const next = applyGlobalEffectToState(s, event.globalEffect, event, defLogs, defDicePopups)
      const eventSlots = [...next.eventSlots]
      eventSlots[slotIndex] = null
      const revealedSlots = [...next.revealedSlots]
      revealedSlots[slotIndex] = false
      const players = [...next.players]
      const p = { ...players[s.currentPlayerIndex] }
      p.eventDiscard = [...p.eventDiscard, event]
      p.score = calcPlayerScore(p)
      players[s.currentPlayerIndex] = p
      return {
        ...next,
        players,
        eventSlots,
        revealedSlots,
        explorationState: syncExplorationStateWithEventSlots(next.explorationState, eventSlots),
      }
    })
    defLogs.forEach((log) => get().addLog(log))
    if (defDicePopups.length > 0) {
      set((s) => ({ survivorDiceQueue: [...s.survivorDiceQueue, ...defDicePopups] }))
    }
    get().addLog(`⚡ ${event.emoji} ${event.name} 전체 발동 완료`)
    get().pushActionEffect(createGlobalActionEffect(event))
  },

  replaceEventSlot(slotIndex) {
    const state = get()
    const player = state.players[state.currentPlayerIndex]
    const event = state.eventSlots[slotIndex]
    if (!event || !state.revealedSlots[slotIndex] || state.phase !== 'action' || state.interaction) return
    if (event.category === 'clue') return
    const skipIsFree = hasCenterWeirdType(player)

    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex] }
      if (!skipIsFree) {
        p.abandonedEvents = [...p.abandonedEvents, event]
      }
      p.score = calcPlayerScore(p)
      players[s.currentPlayerIndex] = p

      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      const tier = getTierForEventSlotIndex(slotIndex)
      const explorationState = {
        ...s.explorationState,
        decksByTier: {
          ...s.explorationState.decksByTier,
          [tier]: [...(s.explorationState.decksByTier?.[tier] ?? [])],
        },
      }
      eventSlots[slotIndex] = explorationState.decksByTier[tier].shift() ?? null
      revealedSlots[slotIndex] = Boolean(eventSlots[slotIndex])

      return {
        players,
        eventSlots,
        revealedSlots,
        eventDeck: s.eventDeck,
        explorationState: syncExplorationStateWithEventSlots(explorationState, eventSlots),
      }
    })

    get().addLog(
      `${player.name} — ${event.emoji} ${event.name} 넘기기 (${skipIsFree ? '4차원 중앙 효과로 무료 (벌점 없음)' : '벌점 -1'})`,
    )
    if (slotIndex === 0) get()._triggerFirstSlotIfGlobal()
  },

  // ── 파견 인원 범위 선택 후 수동 확정 ─────────────────────
  confirmEventAssignment() {
    const { interaction } = get()
    if (!interaction) return
    const { payload, requiredCount } = interaction
    const selected = payload.selectedMyUids ?? []
    if (selected.length < requiredCount) return
    if (interaction.kind === 'assign_utopia_party') {
      get()._continueAssignedUtopiaResolution(interaction)
    } else if (interaction.kind === 'assign_event_party') {
      get()._continueAssignedEventResolution(interaction)
    }
  },

  // ── 개인 이벤트 해결 시작 ─────────────────────
  startEventResolution(slotIndex) {
    const state = get()
    const { eventSlots, players, currentPlayerIndex } = state
    const event = eventSlots[slotIndex]
    if (state.phase !== 'action' || state.interaction || !state.revealedSlots[slotIndex]) return
    if (!event || event.scope !== 'personal') return

    const resolution = event.resolution
    const player = players[currentPlayerIndex]
    if (!canAccessExplorationTier(player, event.tier ?? getTierForEventSlotIndex(slotIndex))) {
      get().addLog(`${player.name} — ${event.emoji} ${event.name} 도전 불가 (탐색 단계 미해금)`)
      return
    }

    const requiredSurvivorCount = getRequiredExplorationSurvivorCount(event)
    const maxSurvivorCount = getMaxExplorationSurvivorCount(event)
    if (getActivePartyMembers(player).length < requiredSurvivorCount) {
      get().addLog(`${player.name} — ${event.emoji} ${event.name} 도전 불가 (활성 생존자 ${requiredSurvivorCount}명 필요)`)
      return
    }
    const requiredAssignedType = getRequiredAssignedTypeForEvent(event)
    if (requiredAssignedType && !getActivePartyMembers(player).some((survivor) => survivor.type === requiredAssignedType)) {
      get().addLog(`${player.name} — ${event.emoji} ${event.name} 도전 불가 (활성 ${requiredAssignedType} 생존자 필요)`)
      return
    }
    const requiredPartyType = event.requiredType
    if (requiredPartyType && !player.party.some((survivor) => survivor.type === requiredPartyType)) {
      get().addLog(`${player.name} — ${event.emoji} ${event.name} 도전 불가 (파티에 ${requiredPartyType} 생존자 필요)`)
      return
    }

    if (resolution.type === 'pay_can' || resolution.type === 'pay_cap') {
      const resourceKey = resolution.type === 'pay_can' ? 'can' : 'bottleCap'
      const label = resolution.type === 'pay_can' ? '통조림' : '병뚜껑'
      if (player.resources[resourceKey] < resolution.amount) {
        if (event.penalizeOnFail) {
          get()._markEventAsPenalty(slotIndex, event, `${label} 부족`)
          return
        }
        // 자원 부족 + 패널티 없음: 행동 소모 없이 종료
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 실패 (${label} 부족)`)
        return
      }

      if (resolution.then) {
        const followUpResolution = createFollowUpResolution(resolution)
        set(() => ({
          interaction: {
            kind: 'assign_event_party',
            requiredCount: requiredSurvivorCount,
            maxCount: maxSurvivorCount,
            slotIndex,
            event: {
              ...event,
              resolution: followUpResolution,
            },
            step: 'select_my_survivor',
            payload: {
              selectedMyUids: [],
              targetPlayerIndex: null,
              targetSurvivorUid: null,
              swapA: null,
              swapB: null,
              pendingCost: { resourceKey, amount: resolution.amount },
            },
          },
        }))
        const rangeText = requiredSurvivorCount === maxSurvivorCount ? `${requiredSurvivorCount}명` : `${requiredSurvivorCount}~${maxSurvivorCount}명`
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 준비: 파견할 생존자 ${rangeText}을 선택하세요.`)
        return
      }
    }

    if (resolution.type === 'revive_from_grave') {
      const departed = getSharedDepartedSurvivors(state.players, state.departedSurvivors)
      if (departed.length === 0) {
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 실패 (떠난 생존자 없음)`)
        return
      }
      if (getPartySlotCount(player.party) >= player.maxPartySize) {
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 실패 (빈 슬롯 없음)`)
        return
      }
    }

    if (resolution.type === 'steal_from_grave') {
      const departed = getSharedDepartedSurvivors(state.players, state.departedSurvivors)
      if (departed.length === 0) {
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 실패 (떠난 생존자 없음)`)
        return
      }
      if (getPartySlotCount(player.party) >= player.maxPartySize) {
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 실패 (빈 슬롯 없음)`)
        return
      }
    }

    set({
      interaction: {
        kind: 'assign_event_party',
        requiredCount: requiredSurvivorCount,
        maxCount: maxSurvivorCount,
        slotIndex,
        event,
        step: 'select_my_survivor',
        payload: {
          selectedMyUids: [],
          targetPlayerIndex: null,
          targetSurvivorUid: null,
          swapA: null,
          swapB: null,
        },
      },
    })
    const rangeText = requiredSurvivorCount === maxSurvivorCount ? `${requiredSurvivorCount}명` : `${requiredSurvivorCount}~${maxSurvivorCount}명`
    get().addLog(`${player.name} — ${event.emoji} ${event.name} 도전: 파견할 생존자 ${rangeText}을 선택하세요.`)
  },

  startUtopiaResolution() {
    const state = get()
    const { players, currentPlayerIndex, utopiaState } = state
    const player = players[currentPlayerIndex]
    if (!canAttemptRevealedUtopia(player, utopiaState)) {
      get().addLog(`${player.name} — 유토피아 도전 불가 (3단계 단서 필요)`)
      return
    }

    const utopiaCard = utopiaState.cardsByLeaderId?.[utopiaState.revealedForLeaderId]
    const event = createUtopiaEventFromCard(utopiaCard)
    if (!event) return

    const requiredCount = 1
    const maxCount = RULES.utopia?.maxAssigned ?? 5
    if (getActivePartyMembers(player).length < requiredCount) {
      get().addLog(`${player.name} — ${event.emoji} ${event.name} 도전 불가 (활성 생존자 ${requiredCount}명 필요)`)
      return
    }

    set({
      interaction: {
        kind: 'assign_utopia_party',
        requiredCount,
        maxCount,
        event,
        step: 'select_my_survivor',
        payload: {
          selectedMyUids: [],
        },
      },
    })
    get().addLog(`${player.name} — ${event.emoji} ${event.name} 최종 도전: 파견할 생존자 ${requiredCount}~${maxCount}명을 선택하세요.`)
  },

  _continueAssignedUtopiaResolution(interaction) {
    const { players, currentPlayerIndex } = get()
    const { event, payload, requiredCount } = interaction
    const player = players[currentPlayerIndex]
    const selectedUids = payload.selectedMyUids ?? []
    const selectedSurvivors = selectedUids
      .map((uid) => player.party.find((survivor) => survivor.uid === uid))
      .filter(Boolean)
    if (selectedSurvivors.length < requiredCount) return

    const assignedCount = selectedSurvivors.length
    if (!get()._assignActiveSurvivorsForAction(currentPlayerIndex, assignedCount, `${event.name} 최종 도전`, selectedUids)) return

    const recommendedBonus = getRecommendedPartyBonusForAssignment(event, selectedSurvivors, player)
    const partyScore = recommendedBonus
    set({
      interaction: null,
      diceRollModal: {
        kind: 'utopia',
        playerIndex: currentPlayerIndex,
        event: { ...event, assignedSurvivorUids: selectedUids, resolution: { ...event.resolution, diceCount: assignedCount } },
        partyScore,
        recommendedBonus,
      },
    })
  },

  _continueAssignedEventResolution(interaction) {
    const { players, currentPlayerIndex } = get()
    const { slotIndex, event, payload, requiredCount } = interaction
    const player = players[currentPlayerIndex]
    const resolution = event.resolution

    if ((payload.selectedMyUids ?? []).length < requiredCount) return

    if (payload.pendingCost) {
      const { resourceKey, amount } = payload.pendingCost
      if ((player.resources?.[resourceKey] ?? 0) < amount) {
        const label = resourceKey === 'can' ? '통조림' : '병뚜껑'
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 실패 (${label} 부족)`)
        set({ interaction: null })
        return
      }
      set((s) => {
        const players = [...s.players]
        const p = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
        p.resources[resourceKey] -= amount
        players[s.currentPlayerIndex] = p
        return {
          players,
          interaction: {
            ...s.interaction,
            payload: {
              ...s.interaction.payload,
              pendingCost: null,
            },
          },
        }
      })
    }

    get()._beginAssignedEventResolution(slotIndex, event, requiredCount, payload.selectedMyUids)
  },

  // 주사위 이벤트 → 모달로 처리
  _openDiceRollModal(slotIndex, event, player) {
    const { currentPlayerIndex } = get()
    const partyScore = 0
    set({ diceRollModal: { slotIndex, event, partyScore, recommendedBonus: 0, playerIndex: currentPlayerIndex } })
  },

  // ── 카드 공개 (용병소) ────────────────────────
  revealSearchSlot(tier, slotIndexInTier) {
    const { players, currentPlayerIndex, searchState, phase, interaction } = get()
    const player = players[currentPlayerIndex]
    if (phase !== 'party_maintenance' || interaction) return
    if (!canAccessExplorationTier(player, tier)) {
      get().addLog(`${player.name} — ${tier}단계 생존자 수색 불가 (단서 필요)`)
      return
    }
    if ((searchState.visibleByTier?.[tier]?.[slotIndexInTier] ?? null) !== null) return
    if ((searchState.decksByTier?.[tier]?.length ?? 0) === 0) {
      get().addLog(`${player.name} — ${tier}단계 생존자 수색 불가 (덱 없음)`)
      return
    }

    set((s) => {
      const decksByTier = {
        1: [...(s.searchState.decksByTier?.[1] ?? [])],
        2: [...(s.searchState.decksByTier?.[2] ?? [])],
        3: [...(s.searchState.decksByTier?.[3] ?? [])],
      }
      const visibleByTier = {
        1: [...(s.searchState.visibleByTier?.[1] ?? [])],
        2: [...(s.searchState.visibleByTier?.[2] ?? [])],
        3: [...(s.searchState.visibleByTier?.[3] ?? [])],
      }
      const revealedSurvivor = decksByTier[tier].shift() ?? null
      if (!revealedSurvivor) return {}

      visibleByTier[tier][slotIndexInTier] = revealedSurvivor
      const nextSearchState = {
        ...s.searchState,
        decksByTier,
        visibleByTier,
        visibleSlots: flattenVisibleByTier(visibleByTier),
      }

      return {
        players,
        mercenaryPool: nextSearchState.visibleSlots,
        survivorDeck: flattenSearchDecksByTier(decksByTier),
        revealedUids: [...s.revealedUids, revealedSurvivor.uid],
        searchState: nextSearchState,
      }
    })
    get().addLog(`${player.name} — ${tier}단계 생존자 수색`)
  },

  selectLeaderSearchCandidate(uid) {
    const { interaction } = get()
    if (interaction?.kind !== 'leader_skill_robot_search') return
    const { tier, slotIndexInTier, candidates = [], mode = 'fill_slot' } = interaction.payload ?? {}
    const chosen = candidates.find((survivor) => survivor.uid === uid)
    if (!chosen) return

    set((s) => {
      const players = [...s.players]
      const playerIndex = s.currentPlayerIndex
      let player = {
        ...players[playerIndex],
        resources: { ...players[playerIndex].resources },
        party: [...players[playerIndex].party],
        survivorActivity: { ...(players[playerIndex].survivorActivity ?? {}) },
      }
      const decksByTier = {
        1: [...(s.searchState.decksByTier?.[1] ?? [])],
        2: [...(s.searchState.decksByTier?.[2] ?? [])],
        3: [...(s.searchState.decksByTier?.[3] ?? [])],
      }
      const visibleByTier = {
        1: [...(s.searchState.visibleByTier?.[1] ?? [])],
        2: [...(s.searchState.visibleByTier?.[2] ?? [])],
        3: [...(s.searchState.visibleByTier?.[3] ?? [])],
      }
      const returned = candidates.filter((survivor) => survivor.uid !== uid)
      if (returned.length > 0) {
        decksByTier[tier] = shuffle([...decksByTier[tier], ...returned])
      }

      if (mode === 'recruit_from_deck') {
        const baseCost = chosen.recruitCost ?? 0
        const moodGirlDiscount = player.party.some((sv) => sv.id === 's_mood_1') ? 1 : 0
        const cost = Math.max(0, baseCost - moodGirlDiscount)
        if (player.resources.bottleCap < cost) return {}
        if (!canRecruitSurvivor(player, chosen)) return {}
        const applied = addSurvivorToParty(player.party, chosen, player.maxPartySize)
        if (!applied.added) return {}
        player.resources.bottleCap -= cost
        player.party = applied.party
        player = setSurvivorActiveState(player, chosen, false)
        player.score = calcPlayerScore(player)
        players[playerIndex] = clampPlayerResources(player)
        return {
          players,
          interaction: null,
          survivorDeck: flattenSearchDecksByTier(decksByTier),
          searchState: { ...s.searchState, decksByTier },
        }
      }

      visibleByTier[tier][slotIndexInTier] = chosen
      const nextSearchState = {
        ...s.searchState,
        decksByTier,
        visibleByTier,
        visibleSlots: flattenVisibleByTier(visibleByTier),
      }
      return {
        interaction: null,
        mercenaryPool: nextSearchState.visibleSlots,
        survivorDeck: flattenSearchDecksByTier(decksByTier),
        revealedUids: [...s.revealedUids, chosen.uid],
        searchState: nextSearchState,
      }
    })

    get().addLog(`🤖 행복수치 계산 — ${chosen.emoji} ${chosen.name} 선택`)
    if (mode === 'recruit_from_deck') {
      get().addLog(`${get().players[get().currentPlayerIndex].name} → ${chosen.emoji} ${chosen.name} 추가 수색 영입`)
      get()._applyOnRecruitTriggers(chosen)
      if (get().players[get().currentPlayerIndex]?.isBot && get().interaction) {
        let guard = 0
        while (get().interaction && guard < 6) {
          get()._botHandleInteraction()
          guard += 1
        }
      }
    }
  },

  cancelRobotSearch() {
    const { interaction, searchState } = get()
    if (interaction?.kind !== 'leader_skill_robot_search') return
    const { tier, candidates = [] } = interaction.payload ?? {}
    if (!tier || candidates.length === 0) {
      set({ interaction: null })
      return
    }
    set((s) => {
      const decksByTier = {
        1: [...(s.searchState.decksByTier?.[1] ?? [])],
        2: [...(s.searchState.decksByTier?.[2] ?? [])],
        3: [...(s.searchState.decksByTier?.[3] ?? [])],
      }
      decksByTier[tier] = shuffle([...decksByTier[tier], ...candidates])
      return {
        interaction: null,
        survivorDeck: flattenSearchDecksByTier(decksByTier),
        searchState: { ...s.searchState, decksByTier },
      }
    })
    get().addLog(`${get().players[get().currentPlayerIndex]?.name} — 🤖 행복수치 계산 취소 (후보 덱으로 반환)`)
  },

  startRobotExtraSearch(tier) {
    const { players, currentPlayerIndex, searchState, phase, interaction } = get()
    const player = players[currentPlayerIndex]
    if (phase !== 'party_maintenance' || interaction) return
    if (!player || player.leaderId !== 'robot') return
    if (!canAccessExplorationTier(player, tier)) {
      get().addLog(`${player.name} — ${tier}단계 HAL 추가 수색 불가 (단서 필요)`)
      return
    }
    if ((searchState.decksByTier?.[tier]?.length ?? 0) < 2) {
      get().addLog(`${player.name} — ${tier}단계 HAL 추가 수색 불가 (덱 2장 미만)`)
      return
    }

    let noRecruitableCandidate = false
    set((s) => {
      const decksByTier = {
        1: [...(s.searchState.decksByTier?.[1] ?? [])],
        2: [...(s.searchState.decksByTier?.[2] ?? [])],
        3: [...(s.searchState.decksByTier?.[3] ?? [])],
      }
      const candidates = [decksByTier[tier].shift(), decksByTier[tier].shift()].filter(Boolean)
      const current = s.players[s.currentPlayerIndex]
      const hasRecruitableCandidate = candidates.some((survivor) => {
        const hasSlot = getPartySlotCount(current.party) < current.maxPartySize || canStackOnExistingSlot(current.party, survivor)
        return hasSlot &&
          canRecruitSurvivor(current, survivor) &&
          (current.resources?.bottleCap ?? 0) >= (survivor.recruitCost ?? 0)
      })
      if (!hasRecruitableCandidate) {
        noRecruitableCandidate = true
        decksByTier[tier] = shuffle([...decksByTier[tier], ...candidates])
        return {
          survivorDeck: flattenSearchDecksByTier(decksByTier),
          searchState: { ...s.searchState, decksByTier },
        }
      }
      return {
        survivorDeck: flattenSearchDecksByTier(decksByTier),
        searchState: { ...s.searchState, decksByTier },
        interaction: {
          kind: 'leader_skill_robot_search',
          step: 'select_search_survivor',
          payload: { mode: 'recruit_from_deck', tier, candidates },
        },
      }
    })
    if (noRecruitableCandidate) {
      get().addLog(`${player.name} — 🤖 행복수치 계산: 영입 가능한 후보가 없어 덱으로 되돌림`)
      return
    }
    get().addLog(`${player.name} — 🤖 행복수치 계산: ${tier}단계 덱 2장 확인`)
    if (player.isBot) get()._botHandleInteraction()
  },

  revealCard(uid) {
    const { mercenaryPool } = get()
    const flatIndex = mercenaryPool.findIndex((survivor) => survivor?.uid === uid)
    if (flatIndex < 0) return
    const tier = getTierForSearchSlotIndex(flatIndex)
    const tierStartIndex = [1, 2, 3]
      .filter((entry) => entry < tier)
      .reduce((sum, entry) => sum + getSearchSlotCountForTier(entry), 0)
    get().revealSearchSlot(tier, flatIndex - tierStartIndex)
  },

  // ── 자동 해결 ─────────────────────────────────
  _resolveAuto(slotIndex, event, player) {
    const resolution = event.resolution
    let success = false
    let penaltyApplied = false
    let rewardLogs = []
    let revealedUtopiaForLeader = null

    set((s) => {
      let players = [...s.players]
      const idx = s.currentPlayerIndex
      let survivorDeck = [...s.survivorDeck]
      let utopiaState = { ...s.utopiaState }
      let p = { ...players[idx], resources: { ...players[idx].resources }, party: [...players[idx].party] }

      switch (resolution.type) {
        case 'pay_can':
          if (p.resources.can >= resolution.amount) {
            p.resources.can -= resolution.amount
            success = true
          }
          break
        case 'pay_cap':
          if (p.resources.bottleCap >= resolution.amount) {
            p.resources.bottleCap -= resolution.amount
            success = true
          }
          break
        case 'check_survivor_type':
          success = (event.assignedSurvivorUids ?? [])
            .map((uid) => p.party.find((sv) => sv.uid === uid))
            .some((sv) => sv?.type === resolution.survivorType)
          if (!success && event.failPenalty) {
            p = applyPenaltyToPlayer(p, event.failPenalty, s.survivorDeck)
            penaltyApplied = true
          }
          break
        case 'check_survivors_n':
          success = p.party.length >= resolution.amount
          if (!success && event.failPenalty) {
            p = applyPenaltyToPlayer(p, event.failPenalty, s.survivorDeck)
            penaltyApplied = true
          }
          break
        case 'remove_random':
          if (p.party.length > 0) {
            const ri = Math.floor(Math.random() * p.party.length)
            const killed = p.party[ri]
            const prevention = preventSingleSurvivorLoss(p, killed, { reason: 'event_damage' })
            p = prevention.player
            success = true
            if (prevention.prevented) {
              rewardLogs.push(`🩺 ${prevention.message}`)
            }
          }
          break
        case 'global_effect': {
          const nextState = applyGlobalEffectToState(
            { ...s, players, survivorDeck },
            event.globalEffect,
            event,
            rewardLogs,
            null
          )
          players = [...nextState.players]
          survivorDeck = [...nextState.survivorDeck]
          p = {
            ...players[idx],
            resources: { ...players[idx].resources },
            party: [...players[idx].party],
          }
          success = true
          break
        }
        case 'roll_dice': {
          const diceCount = resolution.diceCount ?? 1
          const rolls = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6))
          const rollSum = rolls.reduce((a, b) => a + b, 0)
          const total = rollSum
          success = total >= resolution.target
          rewardLogs.push(`🎲 [${rolls.join('+')}] = ${total} (목표 ${resolution.target}: ${success ? '✅ 성공' : '❌ 실패'})`)
          if (!success && event.failPenalty) {
            p = applyPenaltyToPlayer(p, event.failPenalty)
            penaltyApplied = true
          }
          break
        }
        case 'reorder_my_party':
          // UI에서 드래그로 처리 — 이 경우 그냥 성공으로 처리
          success = true
          break
        default:
          success = false
      }

      // 보상 지급
      if (success && event.reward && !penaltyApplied) {
        const applied = applyRewardToPlayer(p, event.reward, survivorDeck)
        p = applied.player
        survivorDeck = applied.survivorDeck
        rewardLogs = applied.logs
      }

      p = clampPlayerResources(p)

      if (success || !event.penalizeOnFail) {
        p.eventDiscard = [...p.eventDiscard, event]
        if (success && event.category === 'clue') {
          p = applyClueClaimProgress(p, event)
          if ((event.tier ?? 0) === 3 && !utopiaState.revealed) {
            utopiaState = {
              ...utopiaState,
              revealed: true,
              revealedForLeaderId: p.leaderId,
            }
            revealedUtopiaForLeader = p.leaderId
          }
        }
      } else {
        p.abandonedEvents = [...p.abandonedEvents, event]
      }
      p.score = calcPlayerScore(p)
      players[idx] = p

      // 슬롯 null 처리 (리필은 행동 단계 종료 시)
      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      eventSlots[slotIndex] = null
      revealedSlots[slotIndex] = false

      return {
        players,
        eventSlots,
        revealedSlots,
        interaction: null,
        survivorDeck,
        searchState: { ...s.searchState, decksByTier: buildSearchDecksByTierFromCards(survivorDeck) },
        utopiaState,
        explorationState: syncExplorationStateWithEventSlots(s.explorationState, eventSlots),
      }
    })

    const result = success ? '해결!' : event.penalizeOnFail ? '실패, 벌점 추가' : '조건 미충족'
    get().addLog(`${player.name} — ${event.emoji} ${event.name} ${result}`)
    rewardLogs.forEach((message) => get().addLog(message))
    if (revealedUtopiaForLeader) {
      const utopiaCard = get().utopiaState.cardsByLeaderId?.[revealedUtopiaForLeader]
      get().addLog(`🌅 유토피아 공개: ${utopiaCard?.name ?? '알 수 없는 유토피아'} (${player.name}이 3단계 단서를 먼저 확보)`)
    }
    if (success && event.category === 'clue') {
      get().addLog(`🗺️ 유토피아 단서 진행도: ${getTotalResolvedClues(get().players)}/${RULES.clueTarget}`)
      get()._checkGameEnd('유토피아 단서 5장 해결')
    }
  },

  // ── 인터랙션: 내 생존자 선택 ─────────────────
  selectMySurvivor(uid) {
    const { interaction } = get()
    if (!interaction) return
    if (interaction.kind === 'assign_event_party' || interaction.kind === 'assign_search_party' || interaction.kind === 'assign_utopia_party') {
      const currentPlayer = get().players[get().currentPlayerIndex]
      const survivor = currentPlayer?.party.find((sv) => sv.uid === uid)
      if (!survivor || !isSurvivorActive(currentPlayer, survivor)) return

      const selected = interaction.payload.selectedMyUids.includes(uid)
        ? interaction.payload.selectedMyUids.filter((u) => u !== uid)
        : [...interaction.payload.selectedMyUids, uid]

      const effectiveMax = interaction.maxCount ?? interaction.requiredCount

      if (
        interaction.kind === 'assign_event_party' &&
        selected.length === effectiveMax &&
        !hasRequiredAssignedType(currentPlayer, interaction.event, selected)
      ) {
        const requiredType = getRequiredAssignedTypeForEvent(interaction.event)
        get().addLog(`${currentPlayer.name} — ${interaction.event.name}에는 ${requiredType} 생존자를 파견해야 합니다.`)
        return
      }

      if (selected.length <= effectiveMax) {
        set({ interaction: { ...interaction, payload: { ...interaction.payload, selectedMyUids: selected } } })
      }

      if (selected.length === effectiveMax) {
        if (interaction.kind === 'assign_search_party') {
          get()._finalizeSearchAssignment(selected, interaction.payload.searchTarget)
        } else if (interaction.kind === 'assign_utopia_party') {
          get()._continueAssignedUtopiaResolution({
            ...interaction,
            payload: { ...interaction.payload, selectedMyUids: selected },
          })
        } else {
          get()._continueAssignedEventResolution({
            ...interaction,
            payload: { ...interaction.payload, selectedMyUids: selected },
          })
        }
      }
      return
    }
    if (interaction.kind === 'upkeep_discard') {
      const selected = interaction.payload.selectedMyUids.includes(uid)
        ? interaction.payload.selectedMyUids.filter((u) => u !== uid)
        : [...interaction.payload.selectedMyUids, uid]

      if (selected.length <= interaction.requiredCount) {
        set({ interaction: { ...interaction, payload: { ...interaction.payload, selectedMyUids: selected } } })
      }

      if (selected.length === interaction.requiredCount) {
        get()._finalizeUpkeepDiscard(selected)
      }
      return
    }
    const { event, slotIndex, payload } = interaction
    const resolution = event.resolution
    const currentPlayer = get().players[get().currentPlayerIndex]
    const survivor = currentPlayer?.party.find((sv) => sv.uid === uid)
    if (!survivor) return

    if (resolution.type === 'send_survivor_type' && survivor.type !== resolution.survivorType) {
      return
    }

    // 단일 선택
    const amount = resolution.amount ?? 1
    const newSelected = payload.selectedMyUids.includes(uid)
      ? payload.selectedMyUids.filter((u) => u !== uid)
      : [...payload.selectedMyUids, uid]

    if (newSelected.length <= amount) {
      set({ interaction: { ...interaction, payload: { ...payload, selectedMyUids: newSelected } } })
    }

    // 선택 완료 시 다음 스텝으로
    if (newSelected.length === amount) {
      const nextStep = getNextStep(resolution, interaction.step)
      if (!nextStep) {
        get()._finalizeInteraction()
      } else {
        set({ interaction: { ...interaction, step: nextStep, payload: { ...payload, selectedMyUids: newSelected } } })
      }
    }
  },

  // ── 인터랙션: 타 플레이어 선택 ───────────────
  selectTargetPlayer(playerIndex) {
    const { interaction } = get()
    if (!interaction) return
    if (interaction.kind === 'leader_skill_zombie_steal' || interaction.kind === 'leader_skill_duck_absorb') {
      set({
        interaction: {
          ...interaction,
          step: 'select_target_survivor',
          payload: { ...interaction.payload, targetPlayerIndex: playerIndex },
        },
      })
      return
    }
    if (interaction.kind === 'survivor_endturn_escape') {
      get()._finalizeEscapeTransfer(playerIndex, interaction.payload?.survivorUid)
      return
    }
    if (interaction.kind === 'survivor_endturn_wizard_swap' || interaction.kind === 'survivor_recruit_magicgirl_take') {
      set({
        interaction: {
          ...interaction,
          step: 'select_target_survivor',
          payload: { ...interaction.payload, targetPlayerIndex: playerIndex },
        },
      })
      return
    }
    if (interaction.kind === 'survivor_skill_wizard') {
      set({
        interaction: {
          ...interaction,
          step: 'select_target_survivor',
          payload: { ...interaction.payload, targetPlayerIndex: playerIndex },
        },
      })
      return
    }
    const nextStep = getNextStep(interaction.event.resolution, interaction.step)
    set({
      interaction: {
        ...interaction,
        step: nextStep ?? interaction.step,
        payload: { ...interaction.payload, targetPlayerIndex: playerIndex },
      },
    })
    if (!nextStep) get()._finalizeInteraction()
  },

  // ── 인터랙션: 타 파티 생존자 선택 ────────────
  selectTargetSurvivor(uid) {
    const { interaction } = get()
    if (!interaction) return
    if (interaction.kind === 'leader_skill_zombie_steal' || interaction.kind === 'leader_skill_duck_absorb') {
      get()._finalizeLeaderStealSelection(interaction.payload?.targetPlayerIndex ?? null, uid)
      return
    }
    if (interaction.kind === 'survivor_endturn_wizard_swap') {
      get()._finalizeWizardSwap(interaction.payload?.targetPlayerIndex ?? null, uid, interaction.payload?.survivorUid)
      return
    }
    if (interaction.kind === 'survivor_recruit_magicgirl_take') {
      get()._finalizeMagicGirlRecruit(interaction.payload?.targetPlayerIndex ?? null, uid)
      return
    }
    if (interaction.kind === 'survivor_skill_wizard') {
      get()._finalizeWizardSpell(interaction.payload?.targetPlayerIndex ?? null, uid)
      return
    }
    if (interaction.event?.category === 'attack') {
      const ti = interaction.payload?.targetPlayerIndex
      const targetPlayer = ti !== null && ti !== undefined ? get().players[ti] : null
      const survivor = targetPlayer?.party.find((entry) => entry.uid === uid)
      if (!canBeAttackTarget(targetPlayer, survivor)) return
    }
    set({ interaction: { ...interaction, payload: { ...interaction.payload, targetSurvivorUid: uid } } })
    get()._finalizeInteraction()
  },

  // ── 인터랙션: 순서 변경 스왑 ─────────────────
  selectSwapSurvivor(uid) {
    const { interaction } = get()
    if (!interaction) return
    const { payload } = interaction
    if (!payload.swapA) {
      const nextStep = getNextStep(interaction.event.resolution, interaction.step)
      set({
        interaction: {
          ...interaction,
          step: nextStep ?? interaction.step,
          payload: { ...payload, swapA: uid },
        },
      })
    } else if (!payload.swapB && uid !== payload.swapA) {
      set({ interaction: { ...interaction, payload: { ...payload, swapB: uid } } })
      get()._finalizeInteraction()
    }
  },

  // ── 인터랙션: 무덤 생존자 선택 ───────────────
  selectGraveSurvivor(uid) {
    const { interaction } = get()
    if (!interaction || interaction.step !== 'select_grave_survivor') return
    if (interaction.kind === 'survivor_recruit_vet_revive') {
      const departed = getSharedDepartedSurvivors(get().players, get().departedSurvivors)
      const survivor = departed.find((entry) => entry.uid === uid)
      if (!isAnimalSurvivor(survivor)) return
      set({ interaction: { ...interaction, payload: { ...interaction.payload, targetSurvivorUid: uid } } })
      get()._finalizeInteraction()
      return
    }
    set({ interaction: { ...interaction, payload: { ...interaction.payload, targetSurvivorUid: uid } } })
    get()._finalizeInteraction()
  },

  // ── 인터랙션 최종 처리 ────────────────────────
  _finalizeInteraction() {
    const state = get()
    const { interaction, players, currentPlayerIndex } = state
    if (!interaction) return
    const { slotIndex, event, payload } = interaction
    const resolution = event.resolution

    let rewardLogs = []
    let actionEffects = []
    let dicePopups = []
    set((s) => {
      const players = [...s.players]
      let survivorDeck = [...s.survivorDeck]
      let departedSurvivors = [...s.departedSurvivors]
      let utopiaState = { ...s.utopiaState }
      let p = { ...players[currentPlayerIndex], resources: { ...players[currentPlayerIndex].resources }, party: [...players[currentPlayerIndex].party], graveyard: [...(players[currentPlayerIndex].graveyard ?? [])] }
      let success = false
      let skipReward = false

      switch (resolution.type) {
        case 'remove_choice': {
          const uids = payload.selectedMyUids
          const removed = p.party.filter((sv) => uids.includes(sv.uid))
          p.graveyard = [...p.graveyard, ...removed]
          p.party = p.party.filter((sv) => !uids.includes(sv.uid))
          success = uids.length > 0
          break
        }
        case 'send_survivor_type':
        case 'send_survivors_n': {
          const uids = payload.selectedMyUids
          const targets = uids.map((uid) => p.party.find((sv) => sv.uid === uid)).filter(Boolean)
          p.party = p.party.filter((sv) => !uids.includes(sv.uid))
          const ti = payload.targetPlayerIndex
          if (ti !== null && ti !== undefined && players[ti]) {
            if (!canReceiveTransferredSurvivors(players[ti], targets)) {
              p.party = [...players[currentPlayerIndex].party]
              rewardLogs.push(`⚠️ ${players[ti].name}의 파티에 전가할 공간이 부족하거나 규칙 충돌이 있어 연쇄이탈이 실패했습니다.`)
              break
            }
            const blocked = tryBlockAttackEvent(players[ti], event)
            if (blocked.log) rewardLogs.push(blocked.log)
            if (blocked.roll !== null) dicePopups.push({ icon: blocked.icon, name: blocked.name, rolls: [blocked.roll], successOn: blocked.successOn, success: blocked.blocked, outcomeLabel: blocked.blocked ? '공격 방어 성공!' : '공격 방어 실패', detail: `${blocked.successOn}이하 성공` })
            if (blocked.blocked) {
              const updatedTarget = applyConsumedAttackBlocker(players[ti], blocked)
              updatedTarget.score = calcPlayerScore(updatedTarget)
              players[ti] = updatedTarget
              p.party = [...p.party, ...targets]
              success = true
              skipReward = true
              actionEffects.push(createActionEffect({
                type: 'global',
                title: `${event.name} 방어`,
                icon: blocked.icon,
                targetName: players[ti].name,
                detail: blocked.message,
              }))
              break
            }
            const tp = { ...players[ti], party: [...players[ti].party] }
            targets.forEach((sv) => {
              const applied = addSurvivorToParty(tp.party, sv, tp.maxPartySize)
              if (applied.added) {
                tp.party = applied.party
                tp.survivorActivity = {
                  ...(tp.survivorActivity ?? {}),
                  [sv.uid]: isSurvivorActive(p, sv),
                }
              }
            })
            players[ti] = tp
            p = pruneSurvivorActivity(p)
            success = targets.length > 0
            if (targets.length > 0) {
              actionEffects.push(createActionEffect({
                type: 'transfer',
                title: `${event.name}`,
                icon: event.emoji,
                targetName: tp.name,
                detail: `${targets.map((sv) => `${sv.emoji} ${sv.name}`).join(', ')} 전가`,
              }))
            }
          } else {
            p.party = [...players[currentPlayerIndex].party]
          }
          break
        }
        case 'take_from_party': {
          const ti = payload.targetPlayerIndex
          const uid = payload.targetSurvivorUid
          if (ti !== null && players[ti] && uid) {
            const blocked = tryBlockAttackEvent(players[ti], event)
            if (blocked.log) rewardLogs.push(blocked.log)
            if (blocked.roll !== null) dicePopups.push({ icon: blocked.icon, name: blocked.name, rolls: [blocked.roll], successOn: blocked.successOn, success: blocked.blocked, outcomeLabel: blocked.blocked ? '공격 방어 성공!' : '공격 방어 실패', detail: `${blocked.successOn}이하 성공` })
            if (blocked.blocked) {
              const updatedTarget = applyConsumedAttackBlocker(players[ti], blocked)
              updatedTarget.score = calcPlayerScore(updatedTarget)
              players[ti] = updatedTarget
              success = true
              skipReward = true
              actionEffects.push(createActionEffect({
                type: 'global',
                title: `${event.name} 방어`,
                icon: blocked.icon,
                targetName: players[ti].name,
                detail: blocked.message,
              }))
              break
            }
            let tp = { ...players[ti], party: [...players[ti].party] }
            const sv = tp.party.find((s) => s.uid === uid)
            if (sv) {
              const applied = addSurvivorToParty(p.party, sv, p.maxPartySize)
              if (!applied.added) break
              tp.party = tp.party.filter((s) => s.uid !== uid)
              p.party = applied.party
              p = setSurvivorActiveState(p, sv, isSurvivorActive(tp, sv))
              tp = pruneSurvivorActivity(tp)
              players[ti] = tp
              success = true
              actionEffects.push(createActionEffect({
                type: 'steal',
                title: `${event.name}`,
                icon: event.emoji,
                targetName: tp.name,
                detail: `${sv.emoji} ${sv.name} 탈취`,
              }))
            }
          }
          break
        }
        case 'remove_from_party': {
          const ti = payload.targetPlayerIndex
          const uid = payload.targetSurvivorUid
          if (ti !== null && players[ti] && uid) {
            const blocked = tryBlockAttackEvent(players[ti], event)
            if (blocked.log) rewardLogs.push(blocked.log)
            if (blocked.roll !== null) dicePopups.push({ icon: blocked.icon, name: blocked.name, rolls: [blocked.roll], successOn: blocked.successOn, success: blocked.blocked, outcomeLabel: blocked.blocked ? '공격 방어 성공!' : '공격 방어 실패', detail: `${blocked.successOn}이하 성공` })
            if (blocked.blocked) {
              const updatedTarget = applyConsumedAttackBlocker(players[ti], blocked)
              updatedTarget.score = calcPlayerScore(updatedTarget)
              players[ti] = updatedTarget
              success = true
              skipReward = true
              actionEffects.push(createActionEffect({
                type: 'global',
                title: `${event.name} 방어`,
                icon: blocked.icon,
                targetName: players[ti].name,
                detail: blocked.message,
              }))
              break
            }
            const removed = players[ti].party.find((s) => s.uid === uid)
            if (removed?.id === 's_military_4') {
              success = true
              skipReward = true
              rewardLogs.push(`👻 ${removed.name} 효과: 공격으로 제거되지 않음`)
              break
            }

            // s_military_2 양아치 햄스터: 공격 대상을 최저 점수 생존자로 전환
            let actualRemoved = removed
            const hamster = removed && players[ti].party.find((sv) => sv.id === 's_military_2' && sv.uid !== removed.uid)
            if (hamster && removed) {
              const lowestScoreMember = [...players[ti].party]
                .filter((sv) => sv.id !== 's_military_2')
                .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
              if (lowestScoreMember && lowestScoreMember.uid !== removed.uid && (lowestScoreMember.score ?? 0) <= (removed.score ?? 0)) {
                rewardLogs.push(`🐹 양아치 햄스터 효과: ${removed.name} 대신 ${lowestScoreMember.name}으로 공격 전환`)
                actualRemoved = lowestScoreMember
              }
            }

            let tp = {
              ...players[ti],
              party: [...players[ti].party],
              graveyard: [...(players[ti].graveyard ?? [])],
              turnFlags: { ...(players[ti].turnFlags ?? {}) },
            }
            const prevention = actualRemoved ? preventSingleSurvivorLoss(tp, actualRemoved, { reason: 'attack_damage' }) : { player: tp, prevented: false }
            tp = prevention.player
            players[ti] = tp
            success = !!removed
            if (removed) {
              if (prevention.prevented) {
                skipReward = true
                rewardLogs.push(`🩺 ${prevention.message}`)
              } else {
                actionEffects.push(createActionEffect({
                  type: 'destroy',
                  title: `${event.name}`,
                  icon: event.emoji,
                  targetName: tp.name,
                  detail: `${(actualRemoved ?? removed).emoji} ${(actualRemoved ?? removed).name} 제거`,
                }))

                // s_charge_5 걷는식물: 공격 성공 시 상대 파티 생존자 1명 추가 제거
                if (p.party.some((sv) => sv.id === 's_charge_5')) {
                  const extraTarget = players[ti].party[players[ti].party.length - 1]
                  if (extraTarget) {
                    players[ti] = {
                      ...players[ti],
                      party: players[ti].party.filter((sv) => sv.uid !== extraTarget.uid),
                      graveyard: [...(players[ti].graveyard ?? []), extraTarget],
                    }
                    rewardLogs.push(`🌿 걷는식물 효과: ${extraTarget.name} 추가 제거`)
                  }
                }
              }
            }
          }
          break
        }
        case 'reorder_other_party': {
          const ti = payload.targetPlayerIndex
          if (ti !== null && players[ti] && payload.swapA && payload.swapB) {
            const blocked = tryBlockAttackEvent(players[ti], event)
            if (blocked.log) rewardLogs.push(blocked.log)
            if (blocked.roll !== null) dicePopups.push({ icon: blocked.icon, name: blocked.name, rolls: [blocked.roll], successOn: blocked.successOn, success: blocked.blocked, outcomeLabel: blocked.blocked ? '공격 방어 성공!' : '공격 방어 실패', detail: `${blocked.successOn}이하 성공` })
            if (blocked.blocked) {
              const updatedTarget = applyConsumedAttackBlocker(players[ti], blocked)
              updatedTarget.score = calcPlayerScore(updatedTarget)
              players[ti] = updatedTarget
              success = true
              skipReward = true
              actionEffects.push(createActionEffect({
                type: 'global',
                title: `${event.name} 방어`,
                icon: blocked.icon,
                targetName: players[ti].name,
                detail: blocked.message,
              }))
              break
            }
            const tp = { ...players[ti], party: [...players[ti].party] }
            const ai = tp.party.findIndex((s) => s.uid === payload.swapA)
            const bi = tp.party.findIndex((s) => s.uid === payload.swapB)
            if (ai >= 0 && bi >= 0) {
              tp.party = swapPartyGroups(tp.party, ai, bi)
              players[ti] = tp
              success = true
            }
          }
          break
        }
        case 'reorder_my_party': {
          if (payload.swapA && payload.swapB) {
            const ai = p.party.findIndex((s) => s.uid === payload.swapA)
            const bi = p.party.findIndex((s) => s.uid === payload.swapB)
            if (ai >= 0 && bi >= 0) {
              p.party = swapPartyGroups(p.party, ai, bi)
              success = true
            }
          }
          break
        }
        case 'revive_from_grave': {
          const uid = payload.targetSurvivorUid
          const removed = removeSurvivorFromSharedDeparted(players, departedSurvivors, uid)
          departedSurvivors = removed.departedSurvivors
          for (let i = 0; i < players.length; i += 1) players[i] = removed.players[i]
          const revived = removed.survivor
          if (revived) {
            p = {
              ...players[currentPlayerIndex],
              resources: { ...players[currentPlayerIndex].resources },
              party: [...players[currentPlayerIndex].party],
              graveyard: [...(players[currentPlayerIndex].graveyard ?? [])],
            }
            const applied = addSurvivorToParty(p.party, revived, p.maxPartySize)
            if (!applied.added) {
              rewardLogs.push(`⚠️ ${revived.emoji} ${revived.name} 부활 실패: 빈 슬롯이 없거나 현재 파티 규칙과 충돌합니다.`)
              break
            }
            p.party = applied.party
            p = setSurvivorActiveState(p, revived, false)
            success = true
            actionEffects.push(createActionEffect({
              type: 'resource_gain',
              title: event.name,
              icon: event.emoji,
              targetName: revived.name,
              detail: `${revived.emoji} ${revived.name} 부활!`,
            }))
          }
          break
        }
        case 'steal_from_grave': {
          const uid = payload.targetSurvivorUid
          if (uid) {
            const removed = removeSurvivorFromSharedDeparted(players, departedSurvivors, uid)
            departedSurvivors = removed.departedSurvivors
            for (let i = 0; i < players.length; i += 1) players[i] = removed.players[i]
            const stolen = removed.survivor
            if (stolen) {
              p = {
                ...players[currentPlayerIndex],
                resources: { ...players[currentPlayerIndex].resources },
                party: [...players[currentPlayerIndex].party],
                graveyard: [...(players[currentPlayerIndex].graveyard ?? [])],
              }
              const applied = addSurvivorToParty(p.party, stolen, p.maxPartySize)
              if (!applied.added) break
              p.party = applied.party
              p = setSurvivorActiveState(p, stolen, false)
              success = true
              actionEffects.push(createActionEffect({
                type: 'steal',
                title: event.name,
                icon: event.emoji,
                targetName: '떠난 생존자',
                detail: `${stolen.emoji} ${stolen.name} 데려옴`,
              }))
            }
          }
          break
        }
        default:
          break
      }

      if (success && event.reward && !skipReward) {
        const applied = applyRewardToPlayer(p, event.reward, survivorDeck)
        p = applied.player
        survivorDeck = applied.survivorDeck
        rewardLogs = applied.logs
      }
      p = clampPlayerResources(p)
      if (success || !event.penalizeOnFail) {
        p.eventDiscard = [...p.eventDiscard, event]
        if (success && event.category === 'clue') {
          p = applyClueClaimProgress(p, event)
          if ((event.tier ?? 0) === 3 && !utopiaState.revealed) {
            utopiaState = {
              ...utopiaState,
              revealed: true,
              revealedForLeaderId: p.leaderId,
            }
          }
        }
      } else {
        p.abandonedEvents = [...p.abandonedEvents, event]
      }
      p.score = calcPlayerScore(p)
      players[currentPlayerIndex] = p

      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      eventSlots[slotIndex] = null
      revealedSlots[slotIndex] = false

      return {
        players,
        eventSlots,
        revealedSlots,
        interaction: null,
        survivorDeck,
        searchState: { ...s.searchState, decksByTier: buildSearchDecksByTierFromCards(survivorDeck) },
        departedSurvivors,
        utopiaState,
        explorationState: syncExplorationStateWithEventSlots(s.explorationState, eventSlots),
      }
    })

    get().addLog(`${players[currentPlayerIndex].name} — ${event.emoji} ${event.name} 판정 완료`)
    rewardLogs.forEach((message) => get().addLog(message))
    actionEffects.forEach((effect) => get().pushActionEffect(effect))
    if (dicePopups.length > 0) {
      set((s) => ({ survivorDiceQueue: [...s.survivorDiceQueue, ...dicePopups] }))
    }
    if (event.category === 'clue') {
      const current = get().players[currentPlayerIndex]
      if ((current.clueTokens ?? 0) > (players[currentPlayerIndex].clueTokens ?? 0)) {
        if ((event.tier ?? 0) === 3 && get().utopiaState.revealedForLeaderId === current.leaderId) {
          const utopiaCard = get().utopiaState.cardsByLeaderId?.[current.leaderId]
          get().addLog(`🌅 유토피아 공개: ${utopiaCard?.name ?? '알 수 없는 유토피아'} (${current.name}이 3단계 단서를 먼저 확보)`)
        }
        get().addLog(`🗺️ 유토피아 단서 진행도: ${getTotalResolvedClues(get().players)}/${RULES.clueTarget}`)
        get()._checkGameEnd('유토피아 단서 5장 해결')
      }
    }
  },

  _markEventAsPenalty(slotIndex, event, reason = '조건 미충족') {
    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex] }
      p.abandonedEvents = [...p.abandonedEvents, event]
      p.score = calcPlayerScore(p)
      players[s.currentPlayerIndex] = p

      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      eventSlots[slotIndex] = null
      revealedSlots[slotIndex] = false

      return {
        players,
        eventSlots,
        revealedSlots,
        interaction: null,
        explorationState: syncExplorationStateWithEventSlots(s.explorationState, eventSlots),
      }
    })

    const { players, currentPlayerIndex } = get()
    get().addLog(`${players[currentPlayerIndex].name} — ${event.emoji} ${event.name} 실패 (${reason}), 벌점 추가`)
  },

  cancelInteraction() {
    const activeInteraction = get().interaction
    set((s) => {
      const nonCancelableKinds = new Set([
        'upkeep_discard',
        'survivor_endturn_escape',
        'survivor_endturn_wizard_swap',
        'survivor_recruit_magicgirl_take',
      ])
      if (nonCancelableKinds.has(s.interaction?.kind)) return {}
      if (!s.interaction?.payload?.paidCost) return { interaction: null }

      const { resourceKey, amount } = s.interaction.payload.paidCost
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
      p.resources[resourceKey] += amount
      players[s.currentPlayerIndex] = p

      return { players, interaction: null }
    })
    if (
      activeInteraction?.kind?.startsWith('leader_skill_') &&
      get().pendingTurnEndShortage !== null
    ) {
      get()._resumeEndTurnFlow()
    }
  },

  // ── 슬롯 0 전체/재난 이벤트 자동 발동 ────────
  _triggerFirstSlotIfGlobal() {
    // 슬롯 0 전체/재난 이벤트는 이제 자동 발동하지 않음 — 플레이어가 수동 수락
  },

  // ── 행동 단계 → 파티 정비 단계 ───────────────
  endActionPhase() {
    set({ phase: 'party_maintenance' })
    get().addLog('▶ 파티 정비 단계 시작')
    get()._triggerFirstSlotIfGlobal()
  },

  // ── 자원 교환 ─────────────────────────────────
  exchangeCapToCan() {
    set((s) => {
      if (s.phase !== 'party_maintenance' || s.interaction) return {}
      const idx = s.currentPlayerIndex
      const p = { ...s.players[idx], resources: { ...s.players[idx].resources } }
      if (p.resources.bottleCap < 1) return {}
      p.resources.bottleCap -= 1
      p.resources.can += RULES.capToCanRate
      const players = [...s.players]
      players[idx] = clampPlayerResources(p)
      return { players }
    })
    get().addLog(`🪙→🥫 병뚜껑 1 → 통조림 ${RULES.capToCanRate}`)
  },

  exchangeCanToCap() {
    set((s) => {
      if (s.phase !== 'party_maintenance' || s.interaction) return {}
      const idx = s.currentPlayerIndex
      const p = { ...s.players[idx], resources: { ...s.players[idx].resources } }
      if (p.resources.can < RULES.canToCapRate) return {}
      p.resources.can -= RULES.canToCapRate
      p.resources.bottleCap += 1
      const players = [...s.players]
      players[idx] = clampPlayerResources(p)
      return { players }
    })
    get().addLog(`🥫→🪙 통조림 ${RULES.canToCapRate} → 병뚜껑 1`)
  },

  reactivateSurvivor(uid) {
    const { players, currentPlayerIndex, phase, interaction } = get()
    if (phase !== 'party_maintenance' || interaction) return
    const player = players[currentPlayerIndex]
    const survivorIndex = player.party.findIndex((survivor) => survivor.uid === uid)
    if (survivorIndex < 0) return
    const survivor = player.party[survivorIndex]
    if (isSurvivorActive(player, survivor)) return

    const cost = getReactivationCostForSurvivor(player, survivor, survivorIndex)
    if (!canAffordCost(player.resources, cost)) return

    set((s) => {
      const players = [...s.players]
      let current = {
        ...players[s.currentPlayerIndex],
        resources: { ...players[s.currentPlayerIndex].resources },
        party: [...players[s.currentPlayerIndex].party],
        survivorActivity: { ...(players[s.currentPlayerIndex].survivorActivity ?? {}) },
      }
      current.resources = subtractCost(current.resources, cost)
      current = setSurvivorActiveState(current, uid, true)
      current = clampPlayerResources(current)
      players[s.currentPlayerIndex] = current
      return { players }
    })

    const costText = []
    if (cost.can > 0) costText.push(`🥫-${cost.can}`)
    if (cost.bottleCap > 0) costText.push(`🪙-${cost.bottleCap}`)
    get().addLog(`${player.name} — ${survivor.emoji} ${survivor.name} 재활성화${costText.length ? ` (${costText.join(' ')})` : ''}`)
  },

  _assignActiveSurvivorsForAction(playerIndex, count, reasonLabel, selectedUids = null) {
    const { players } = get()
    const player = players[playerIndex]
    const activeSurvivors = getActivePartyMembers(player)
    const assigned = Array.isArray(selectedUids)
      ? selectedUids
        .map((uid) => activeSurvivors.find((survivor) => survivor.uid === uid))
        .filter(Boolean)
      : activeSurvivors.slice(0, count)

    if (assigned.length < count) return false

    set((s) => {
      const players = [...s.players]
      let current = {
        ...players[playerIndex],
        survivorActivity: { ...(players[playerIndex].survivorActivity ?? {}) },
      }
      current = setMultipleSurvivorsActiveState(current, assigned, false)
      players[playerIndex] = current
      return { players }
    })

    get().addLog(`${player.name} — ${reasonLabel}: ${assigned.map((sv) => `${sv.emoji} ${sv.name}`).join(', ')} 파견 (비활성화)`)
    return true
  },

  _beginAssignedEventResolution(slotIndex, event, requiredCount, selectedUids) {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]
    const selectedSurvivors = selectedUids
      .map((uid) => player.party.find((survivor) => survivor.uid === uid))
      .filter(Boolean)
    if (selectedSurvivors.length < requiredCount) return
    if (!hasRequiredAssignedType(player, event, selectedUids)) {
      const requiredType = getRequiredAssignedTypeForEvent(event)
      get().addLog(`${player.name} — ${event.emoji} ${event.name} 도전 불가 (${requiredType} 생존자 파견 필요)`)
      set({ interaction: null })
      return
    }

    const assignedCount = selectedSurvivors.length
    if (!get()._assignActiveSurvivorsForAction(currentPlayerIndex, assignedCount, `${event.name} 도전`, selectedUids)) return

    const resolution = event.resolution
    const diceCount = Math.min(assignedCount, 5)
    const assignedEvent = isRollDiceType(resolution.type)
      ? { ...event, assignedSurvivorUids: selectedUids, resolution: { ...resolution, diceCount } }
      : { ...event, assignedSurvivorUids: selectedUids }

    if (isRollDiceType(resolution.type)) {
      const recommendedBonus = getRecommendedPartyBonusForAssignment(event, selectedSurvivors, player)
      const isScoreBonus = resolution.type === 'roll_dice_score_bonus'
      const partyScore = isScoreBonus
        ? calcPartyScore(player.party, player.leaderId ?? '').total
        : recommendedBonus
      const bonusLabel = isScoreBonus ? '파티점수' : '추천'
      set({ diceRollModal: { slotIndex, event: assignedEvent, partyScore, recommendedBonus, bonusLabel, playerIndex: currentPlayerIndex }, interaction: null })
      return
    }

    const autoTypes = ['pay_can', 'pay_cap', 'check_survivor_type', 'check_survivors_n', 'remove_random', 'global_effect']
    if (autoTypes.includes(resolution.type)) {
      get()._resolveAuto(slotIndex, assignedEvent, player)
      return
    }

    const firstStep = getFirstStep(resolution)
    set({
      interaction: {
        slotIndex,
        event: assignedEvent,
        step: firstStep,
        payload: {
          selectedMyUids: [],
          targetPlayerIndex: null,
          targetSurvivorUid: null,
          swapA: null,
          swapB: null,
        },
      },
    })
  },

  _finalizeSearchAssignment() {},

  // ── 생존자 영입 ───────────────────────────────
  recruitSurvivor(survivorUid) {
    const { players, currentPlayerIndex, mercenaryPool, survivorDeck, revealedUids, interaction } = get()
    const player = players[currentPlayerIndex]
    if (get().phase !== 'party_maintenance' || interaction) return
    const slotIndex = mercenaryPool.findIndex((s) => s?.uid === survivorUid)
    const survivor = slotIndex >= 0 ? mercenaryPool[slotIndex] : null
    if (!survivor) return
    const tier = getTierForSearchSlotIndex(slotIndex)
    if (!canAccessExplorationTier(player, tier)) {
      get().addLog(`${player.name} — ${tier}단계 생존자 영입 불가 (단서 필요)`)
      return
    }
    if (getPartySlotCount(player.party) >= player.maxPartySize && !canStackOnExistingSlot(player.party, survivor)) return
    if (!canRecruitSurvivor(player, survivor)) {
      get().addLog(`${player.name} — ${survivor.emoji} ${survivor.name} 영입 불가 (양아치 햄스터 제약)`)
      return
    }
    const baseCost = survivor.recruitCost ?? 0
    const moodGirlDiscount = player.party.some((sv) => sv.id === 's_mood_1') ? 1 : 0
    const cost = Math.max(0, baseCost - moodGirlDiscount)
    if (player.resources.bottleCap < cost) return

    const newPool = [...mercenaryPool]
    newPool[slotIndex] = null

    set((s) => {
      const players = [...s.players]
      const p = { ...players[currentPlayerIndex] }
      p.resources = { ...p.resources, bottleCap: p.resources.bottleCap - cost }
      const applied = addSurvivorToParty(p.party, survivor, p.maxPartySize)
      if (!applied.added) return {}
      p.party = applied.party
      const withInactiveRecruit = setSurvivorActiveState(p, survivor, false)
      p.survivorActivity = withInactiveRecruit.survivorActivity
      p.score = calcPlayerScore(p)
      players[currentPlayerIndex] = clampPlayerResources(p)
      const decksByTier = {
        1: [...(s.searchState.decksByTier?.[1] ?? [])],
        2: [...(s.searchState.decksByTier?.[2] ?? [])],
        3: [...(s.searchState.decksByTier?.[3] ?? [])],
      }
      const replacement = decksByTier[tier].shift() ?? null
      newPool[slotIndex] = replacement
      const nextSearchState = syncSearchStateWithMercenaryPool({ ...s.searchState, decksByTier }, newPool)
      return {
        players,
        mercenaryPool: newPool,
        survivorDeck: flattenSearchDecksByTier(decksByTier),
        revealedUids: [
          ...s.revealedUids.filter((uid) => uid !== survivorUid),
          ...(replacement ? [replacement.uid] : []),
        ],
        searchState: nextSearchState,
      }
    })
    get().addLog(`${player.name} → ${survivor.emoji} ${survivor.name} 영입 (🪙-${cost})`)
    get()._applyOnRecruitTriggers(survivor)
    if (get().players[get().currentPlayerIndex]?.isBot && get().interaction) {
      let guard = 0
      while (get().interaction && guard < 6) {
        get()._botHandleInteraction()
        guard += 1
      }
    }
  },

  recruitReturnedSurvivor() {
    const { players, currentPlayerIndex, returnedMercenary, interaction } = get()
    const player = players[currentPlayerIndex]
    if (get().phase !== 'party_maintenance' || interaction || !returnedMercenary) return
    if (returnedMercenary.availableToPlayerIndex !== currentPlayerIndex) return
    if (!canRecruitSurvivor(player, returnedMercenary.survivor)) return
    if (getPartySlotCount(player.party) >= player.maxPartySize && !canStackOnExistingSlot(player.party, returnedMercenary.survivor)) return

    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex] }
      const applied = addSurvivorToParty(p.party, returnedMercenary.survivor, p.maxPartySize)
      if (!applied.added) return {}
      p.party = applied.party
      const withInactiveRecruit = setSurvivorActiveState(p, returnedMercenary.survivor, false)
      p.survivorActivity = withInactiveRecruit.survivorActivity
      p.score = calcPlayerScore(p)
      players[s.currentPlayerIndex] = clampPlayerResources(p)
      return { players, returnedMercenary: null }
    })

    get().addLog(`${player.name} → ${returnedMercenary.survivor.emoji} ${returnedMercenary.survivor.name} 무료 합류`)
    get()._applyOnRecruitTriggers(returnedMercenary.survivor)
    if (get().players[get().currentPlayerIndex]?.isBot && get().interaction) {
      let guard = 0
      while (get().interaction && guard < 6) {
        get()._botHandleInteraction()
        guard += 1
      }
    }
  },

  returnPartySurvivorToMercenary(uid) {
    const { players, currentPlayerIndex, returnedMercenary, phase, interaction } = get()
    const player = players[currentPlayerIndex]
    if (phase !== 'party_maintenance' || interaction || returnedMercenary) return
    if (player.turnFlags?.returnedSurvivorUsed) return
    const survivor = player.party.find((entry) => entry.uid === uid)
    if (!survivor) return
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length

    set((s) => {
      const players = [...s.players]
      const p = {
        ...players[s.currentPlayerIndex],
        party: [...players[s.currentPlayerIndex].party],
        survivorActivity: { ...(players[s.currentPlayerIndex].survivorActivity ?? {}) },
        turnFlags: { ...(players[s.currentPlayerIndex].turnFlags ?? {}) },
      }
      p.party = p.party.filter((entry) => entry.uid !== uid)
      p.survivorActivity = pruneSurvivorActivity(p).survivorActivity
      p.turnFlags.returnedSurvivorUsed = true
      p.resources = { ...p.resources, can: (p.resources.can ?? 0) + 1 }
      p.score = calcPlayerScore(p)
      players[s.currentPlayerIndex] = clampPlayerResources(p)
      return {
        players,
        returnedMercenary: {
          survivor,
          tier: getSurvivorSearchTier(survivor),
          fromPlayerIndex: currentPlayerIndex,
          availableToPlayerIndex: nextPlayerIndex,
        },
      }
    })

    get().addLog(`${player.name} — ${survivor.emoji} ${survivor.name} 떠나보냄 (+🥫1 / ${players[nextPlayerIndex].name} 무료 영입 가능)`)
  },

  discardMercenary(uid) {
    const { players, currentPlayerIndex, mercenaryPool, revealedUids, interaction } = get()
    const player = players[currentPlayerIndex]
    if (get().phase !== 'party_maintenance' || interaction) return
    if (player.resources.can < RULES.mercenaryDiscardCanCost) return
    const index = mercenaryPool.findIndex((s) => s.uid === uid)
    if (index < 0 || !revealedUids.includes(uid)) return
    const tier = getTierForSearchSlotIndex(index)
    if (!canAccessExplorationTier(player, tier)) return

    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
      p.resources.can -= RULES.mercenaryDiscardCanCost
      players[s.currentPlayerIndex] = clampPlayerResources(p)

      const decksByTier = {
        1: [...(s.searchState.decksByTier?.[1] ?? [])],
        2: [...(s.searchState.decksByTier?.[2] ?? [])],
        3: [...(s.searchState.decksByTier?.[3] ?? [])],
      }
      const discardedCard = s.mercenaryPool[index]
      if (discardedCard) decksByTier[tier] = shuffle([...decksByTier[tier], discardedCard])
      const replacement = decksByTier[tier].shift() ?? null
      const newPool = [...s.mercenaryPool]
      newPool[index] = replacement
      const nextSearchState = syncSearchStateWithMercenaryPool(
        {
          ...s.searchState,
          decksByTier,
        },
        newPool,
      )

      return {
        players,
        mercenaryPool: newPool,
        survivorDeck: flattenSearchDecksByTier(nextSearchState.decksByTier),
        revealedUids: [
          ...s.revealedUids.filter((revealedUid) => revealedUid !== uid),
          ...(replacement ? [replacement.uid] : []),
        ],
        searchState: nextSearchState,
      }
    })

    const discarded = mercenaryPool[index]
    const replacement = get().mercenaryPool[index]
    if (replacement) {
      get().addLog(`${player.name} — ${discarded.emoji} ${discarded.name} 덱으로 반환 후 교체 (🥫-${RULES.mercenaryDiscardCanCost})`)
    } else {
      get().addLog(`${player.name} — ${discarded.emoji} ${discarded.name} 덱으로 반환, 새 카드 없음 (🥫-${RULES.mercenaryDiscardCanCost})`)
    }
  },

  // ── 파티 순서 변경 ────────────────────────────
  swapPartyMembers(playerIndex, fromIdx, toIdx) {
    const { players, currentPlayerIndex, phase, interaction } = get()
    if (playerIndex !== currentPlayerIndex || phase !== 'party_maintenance' || interaction) return
    const player = players[playerIndex]
    const costReduction = getPartyReorderCostReduction(player)
    const actualCost = Math.max(0, RULES.partyReorderCost - costReduction)
    if (player.resources.bottleCap < actualCost) return
    set((s) => {
      const players = [...s.players]
      const p = { ...players[playerIndex] }
      p.resources = { ...p.resources, bottleCap: p.resources.bottleCap - actualCost }
      const swappedParty = swapPartyGroups(p.party, fromIdx, toIdx)
      const hasConflict = swappedParty.some((survivor, index) => {
        if (index === 0) return false
        return isSlasherAdjacencyConflict(swappedParty[index - 1], survivor)
      })
      if (hasConflict) return {}
      p.party = swappedParty
      p.score = calcPlayerScore(p)
      players[playerIndex] = clampPlayerResources(p)
      return { players }
    })
    get().addLog(`${player.name} — 파티 순서 변경 (🪙-${actualCost}${costReduction > 0 ? ` 반장 -${costReduction} 적용` : ''})`)
  },

  // ── 턴 시작 정산 ──────────────────────────────
  settleCurrentPlayerTurnStart() {
    const logMessages = []
    let turnStartDeltas = { can: 0, bottleCap: 0 }

    set((s) => {
      const players = s.players.map((player) => ({
        ...player,
        resources: { ...player.resources },
        party: [...player.party],
      }))

      const currentPlayer = players[s.currentPlayerIndex]
      const normalizedCurrent = pruneSurvivorActivity(currentPlayer)
      players[s.currentPlayerIndex] = normalizedCurrent
      const currentPlayerRef = players[s.currentPlayerIndex]
      currentPlayerRef.turnFlags = {
        ...(currentPlayerRef.turnFlags ?? {}),
        doctorShieldUsed: false,
        returnedSurvivorUsed: false,
        wizardSpellUsed: false,
      }
      const startCan = currentPlayerRef.resources.can
      const startCap = currentPlayerRef.resources.bottleCap

      currentPlayerRef.party.forEach((survivor, survivorIndex) => {
        const turnStartResources = getTurnStartResourcesForSurvivor(survivor, survivorIndex)
        currentPlayerRef.resources.can += turnStartResources.can
        currentPlayerRef.resources.bottleCap = Math.max(0, currentPlayerRef.resources.bottleCap + turnStartResources.bottleCap)
      })

      const clampedCurrentPlayer = clampPlayerResources(currentPlayerRef)
      players[s.currentPlayerIndex] = clampedCurrentPlayer

      turnStartDeltas = {
        can: clampedCurrentPlayer.resources.can - startCan,
        bottleCap: clampedCurrentPlayer.resources.bottleCap - startCap,
      }

      players.forEach((player) => {
        player.score = calcPlayerScore(player)
      })

      return { players }
    })

    logMessages.forEach((message) => get().addLog(message))
    if (turnStartDeltas.bottleCap > 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_gain',
        title: '턴 시작 정산',
        icon: '🪙',
        targetName: '병뚜껑 획득',
        detail: `병뚜껑 +${turnStartDeltas.bottleCap}`,
      }))
    }
    if (turnStartDeltas.can > 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_gain',
        title: '턴 시작 정산',
        icon: '🥫',
        targetName: '통조림 획득',
        detail: `통조림 +${turnStartDeltas.can}`,
      }))
    }
  },

  // ── 턴 종료 정산 ──────────────────────────────
  settleCurrentPlayerTurnEnd() {
    const logMessages = []
    let turnEndDeltas = { can: 0, bottleCap: 0 }
    let shortage = 0
    set((s) => {
      const players = s.players.map((player) => ({
        ...player,
        resources: { ...player.resources },
        party: [...player.party],
      }))

      const currentPlayer = players[s.currentPlayerIndex]
      const normalizedCurrent = pruneSurvivorActivity(currentPlayer)
      players[s.currentPlayerIndex] = normalizedCurrent
      const currentPlayerRef = players[s.currentPlayerIndex]
      const startCan = currentPlayerRef.resources.can
      const startCap = currentPlayerRef.resources.bottleCap

      // 지도자 기본 수입
      const leader = LEADERS.find((l) => l.id === currentPlayerRef.leaderId)
      if (leader?.passiveIncome) {
        currentPlayerRef.resources.can += leader.passiveIncome.can ?? 0
        currentPlayerRef.resources.bottleCap += leader.passiveIncome.bottleCap ?? 0
      }

      currentPlayerRef.party.forEach((survivor, survivorIndex) => {
        const turnEndResources = getTurnEndResourcesForSurvivor(survivor, survivorIndex, currentPlayerRef.party)
        currentPlayerRef.resources.can += turnEndResources.can
        currentPlayerRef.resources.bottleCap = Math.max(0, currentPlayerRef.resources.bottleCap + turnEndResources.bottleCap)

        if (survivor.turnEndRandomGift?.resource === 'bottleCap' && survivor.turnEndRandomGift.amount > 0) {
          const targetIndexes = players
            .map((_, index) => index)
            .filter((index) => index !== s.currentPlayerIndex)

          if (targetIndexes.length > 0 && currentPlayerRef.resources.bottleCap >= survivor.turnEndRandomGift.amount) {
            const targetIndex = targetIndexes[Math.floor(Math.random() * targetIndexes.length)]
            const targetPlayer = players[targetIndex]
            currentPlayerRef.resources.bottleCap -= survivor.turnEndRandomGift.amount
            targetPlayer.resources.bottleCap += survivor.turnEndRandomGift.amount
            players[targetIndex] = clampPlayerResources(targetPlayer)
            logMessages.push(`${survivor.name} 효과: ${targetPlayer.name}에게 병뚜껑 ${survivor.turnEndRandomGift.amount}개 증여`)
          }
        }
      })

      // s_military_6 대통령 추경: 다른 모든 플레이어 병뚜껑 1개씩 수금
      if (currentPlayerRef.party.some((sv) => sv.id === 's_military_6')) {
        let collected = 0
        players.forEach((player, index) => {
          if (index !== s.currentPlayerIndex && player.resources.bottleCap >= 1) {
            players[index] = { ...players[index], resources: { ...players[index].resources, bottleCap: players[index].resources.bottleCap - 1 } }
            collected += 1
          }
        })
        currentPlayerRef.resources.bottleCap += collected
        if (collected > 0) logMessages.push(`🏛️ 대통령 추경: 다른 플레이어 ${collected}명으로부터 병뚜껑 ${collected}개 획득`)
      }


      shortage = Math.max(0, -currentPlayerRef.resources.can)
      currentPlayerRef.resources.can = Math.max(0, currentPlayerRef.resources.can)
      const clampedCurrentPlayer = clampPlayerResources(currentPlayerRef)
      players[s.currentPlayerIndex] = clampedCurrentPlayer
      turnEndDeltas = {
        can: clampedCurrentPlayer.resources.can - startCan,
        bottleCap: clampedCurrentPlayer.resources.bottleCap - startCap,
      }

      players.forEach((player) => {
        player.score = calcPlayerScore(player)
      })

      return { players }
    })

    logMessages.forEach((message) => get().addLog(message))
    if (turnEndDeltas.bottleCap > 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_gain',
        title: '턴 종료 정산',
        icon: '🪙',
        targetName: '병뚜껑 획득',
        detail: `병뚜껑 +${turnEndDeltas.bottleCap}`,
      }))
    }
    if (turnEndDeltas.can < 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_loss',
        title: '턴 종료 정산',
        icon: '🥫',
        targetName: '유지비 소모',
        detail: `통조림 ${turnEndDeltas.can}`,
      }))
    }
    get()._applyOnTurnEndTriggers()
    get()._applyPassiveTriggers()
    get()._applyLeaderTurnEndSkill()
    return { shortage }
  },

  _applyLeaderTurnEndSkill() {
    const state = get()
    const { currentPlayerIndex } = state
    const player = state.players[currentPlayerIndex]
    if (!player) return

    if (player.leaderId === 'idol') {
      const roll = rollD6()
      let detail = '팬 변화 없음'
      set((s) => {
        const players = [...s.players]
        const current = {
          ...players[s.currentPlayerIndex],
          leaderFans: [...(players[s.currentPlayerIndex].leaderFans ?? [])],
        }
        const decksByTier = {
          1: [...(s.searchState.decksByTier?.[1] ?? [])],
          2: [...(s.searchState.decksByTier?.[2] ?? [])],
          3: [...(s.searchState.decksByTier?.[3] ?? [])],
        }

        if (roll >= 4) {
          const fan = decksByTier[1].shift() ?? null
          if (fan) {
            current.leaderFans.push({ ...fan, leaderFan: true })
            detail = `${fan.emoji} ${fan.name} 팬 획득`
          } else {
            detail = '1단계 생존자 덱이 비어 팬을 얻지 못함'
          }
        } else if (current.leaderFans.length > 0) {
          const fan = current.leaderFans.pop()
          const tier = fan.searchTier ?? fan.tier ?? 1
          decksByTier[tier] = shuffle([...decksByTier[tier], { ...fan, leaderFan: undefined }])
          detail = `${fan.emoji} ${fan.name} 팬 이탈`
        }

        current.score = calcPlayerScore(current)
        players[s.currentPlayerIndex] = current
        return {
          players,
          survivorDeck: flattenSearchDecksByTier(decksByTier),
          searchState: { ...s.searchState, decksByTier },
        }
      })
      get().addLog(`🎤 콘서트: 🎲${roll} → ${detail}`)
      get().pushActionEffect(createActionEffect({ type: 'leader_skill', title: '콘서트', icon: '🎤', targetName: player.name, detail: `🎲${roll} · ${detail}` }))
      return
    }

    if (player.leaderId === 'shy') {
      const roll = rollD6()
      if (roll >= 3) {
        set((s) => {
          const players = [...s.players]
          const current = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
          current.resources.can += 3
          players[s.currentPlayerIndex] = clampPlayerResources(current)
          return { players }
        })
      }
      const detail = roll >= 3 ? '통조림 +3' : '아무 일도 없음'
      get().addLog(`😶 울기: 🎲${roll} → ${detail}`)
      get().pushActionEffect(createActionEffect({ type: 'leader_skill', title: '울기', icon: '😶', targetName: player.name, detail: `🎲${roll} · ${detail}` }))
      return
    }

    if (player.leaderId === 'zombie') {
      const roll = rollD6()
      let detail = '아무 일도 없음'
      if (roll >= 5) {
        if (player.isBot) {
          detail = get()._applyLeaderStealOrLoss({
            leaderId: 'zombie',
            shouldSteal: true,
            shouldLoseOwn: false,
            cost: null,
            icon: '🧟',
            title: '자신감있는 좀비행동',
          }) || '흡수할 대상 없음'
        } else if (findBestLeaderStealTarget(state.players, currentPlayerIndex)) {
          detail = '흡수할 생존자 선택 필요'
          get()._startLeaderStealSelection({
            kind: 'leader_skill_zombie_steal',
            title: '자신감있는 좀비행동',
            icon: '🧟',
            roll,
            cost: null,
          })
        } else {
          detail = '흡수할 대상 없음'
        }
      } else if (roll <= 2) {
        detail = get()._applyLeaderStealOrLoss({
          leaderId: 'zombie',
          shouldSteal: false,
          shouldLoseOwn: true,
          cost: null,
          icon: '🧟',
          title: '자신감있는 좀비행동',
        }) || '이탈할 생존자 없음'
      }
      get().addLog(`🧟 자신감있는 좀비행동: 🎲${roll} → ${detail}`)
      get().pushActionEffect(createActionEffect({ type: 'leader_skill', title: '자신감있는 좀비행동', icon: '🧟', targetName: player.name, detail: `🎲${roll} · ${detail}` }))
      return
    }

    if (player.leaderId === 'duck') {
      const canUseDuckMiracle = canAffordCost(player.resources, { bottleCap: 6 }) && findBestLeaderStealTarget(state.players, currentPlayerIndex)
      if (canUseDuckMiracle) {
        if (player.isBot) {
          const result = get()._applyLeaderStealOrLoss({
            leaderId: 'duck',
            shouldSteal: true,
            shouldLoseOwn: false,
            cost: { bottleCap: 6 },
            icon: '🦆',
            title: '오리의 기적',
          })
          if (result) {
            get().addLog(`🦆 오리의 기적 → ${result}`)
            get().pushActionEffect(createActionEffect({ type: 'leader_skill', title: '오리의 기적', icon: '🦆', targetName: player.name, detail: result }))
          }
        } else {
          get()._startLeaderStealSelection({
            kind: 'leader_skill_duck_absorb',
            title: '오리의 기적',
            icon: '🦆',
            roll: null,
            cost: { bottleCap: 6 },
          })
          get().addLog(`🦆 오리의 기적: 흡수할 생존자를 선택하세요. 취소하면 사용하지 않습니다.`)
        }
      }
    }
  },

  _startLeaderStealSelection({ kind, title, icon, roll = null, cost = null }) {
    set({
      interaction: {
        kind,
        step: 'select_target_player',
        event: {
          name: title,
          emoji: icon,
          category: 'leader_skill',
          resolution: { type: 'take_from_party' },
        },
        payload: {
          targetPlayerIndex: null,
          targetSurvivorUid: null,
          roll,
          cost,
          title,
          icon,
        },
      },
    })
  },

  _finalizeLeaderStealSelection(targetPlayerIndex, targetSurvivorUid) {
    const state = get()
    const { interaction, currentPlayerIndex } = state
    if (!interaction || (interaction.kind !== 'leader_skill_zombie_steal' && interaction.kind !== 'leader_skill_duck_absorb')) return
    const { cost, title, icon, roll } = interaction.payload ?? {}
    let detail = ''

    set((s) => {
      const players = s.players.map((entry) => ({
        ...entry,
        resources: { ...entry.resources },
        party: [...entry.party],
        graveyard: [...(entry.graveyard ?? [])],
        survivorActivity: { ...(entry.survivorActivity ?? {}) },
      }))
      const current = players[s.currentPlayerIndex]
      const targetPlayer = targetPlayerIndex !== null && targetPlayerIndex !== undefined ? players[targetPlayerIndex] : null
      const survivor = targetPlayer?.party.find((entry) => entry.uid === targetSurvivorUid)

      if (cost && !canAffordCost(current.resources, cost)) {
        detail = '비용 부족'
        return { interaction: null }
      }
      if (!targetPlayer || !survivor) {
        detail = '대상 없음'
        return { interaction: null }
      }

      const applied = addSurvivorToParty(current.party, survivor, current.maxPartySize)
      if (!applied.added) {
        detail = '파티 공간 부족'
        return { interaction: null }
      }

      if (cost) current.resources = subtractCost(current.resources, cost)
      targetPlayer.party = targetPlayer.party.filter((entry) => entry.uid !== survivor.uid)
      targetPlayer.survivorActivity = Object.fromEntries(
        Object.entries(targetPlayer.survivorActivity ?? {}).filter(([uid]) => uid !== survivor.uid),
      )
      current.party = applied.party
      current.survivorActivity = {
        ...(current.survivorActivity ?? {}),
        [survivor.uid]: false,
      }
      current.score = calcPlayerScore(current)
      targetPlayer.score = calcPlayerScore(targetPlayer)
      players[s.currentPlayerIndex] = clampPlayerResources(current)
      players[targetPlayerIndex] = targetPlayer
      detail = `${targetPlayer.name}의 ${survivor.emoji} ${survivor.name} 흡수${cost ? ' (🪙-6)' : ''}`
      return { players, interaction: null }
    })

    get().addLog(`${icon} ${title}: ${detail}`)
    get().pushActionEffect(createActionEffect({
      type: 'leader_skill',
      title,
      icon,
      targetName: state.players[currentPlayerIndex]?.name ?? '지도자',
      detail: `${roll ? `🎲${roll} · ` : ''}${detail}`,
    }))
    if (get().pendingTurnEndShortage !== null) get()._resumeEndTurnFlow()
  },

  _applyLeaderStealOrLoss({ leaderId, shouldSteal, shouldLoseOwn, cost, icon, title }) {
    let detail = ''
    set((s) => {
      const players = s.players.map((entry) => ({
        ...entry,
        resources: { ...entry.resources },
        party: [...entry.party],
        graveyard: [...(entry.graveyard ?? [])],
        survivorActivity: { ...(entry.survivorActivity ?? {}) },
      }))
      const current = players[s.currentPlayerIndex]

      if (cost && !canAffordCost(current.resources, cost)) {
        detail = '비용 부족'
        return {}
      }

      if (shouldSteal) {
        const target = findBestLeaderStealTarget(players, s.currentPlayerIndex)
        if (!target) {
          detail = '흡수할 대상 없음'
          return {}
        }
        const applied = addSurvivorToParty(current.party, target.survivor, current.maxPartySize)
        if (!applied.added) {
          detail = '파티 공간 부족'
          return {}
        }
        if (cost) current.resources = subtractCost(current.resources, cost)
        const targetPlayer = players[target.playerIndex]
        targetPlayer.party = targetPlayer.party.filter((survivor) => survivor.uid !== target.survivor.uid)
        targetPlayer.survivorActivity = Object.fromEntries(
          Object.entries(targetPlayer.survivorActivity ?? {}).filter(([uid]) => uid !== target.survivor.uid),
        )
        current.party = applied.party
        current.survivorActivity = {
          ...(current.survivorActivity ?? {}),
          [target.survivor.uid]: false,
        }
        current.score = calcPlayerScore(current)
        targetPlayer.score = calcPlayerScore(targetPlayer)
        players[s.currentPlayerIndex] = clampPlayerResources(current)
        players[target.playerIndex] = targetPlayer
        detail = `${targetPlayer.name}의 ${target.survivor.emoji} ${target.survivor.name} 흡수${cost ? ' (🪙-6)' : ''}`
        return { players }
      }

      if (shouldLoseOwn) {
        const victim = findWeakestSurvivor(current.party)
        if (!victim) {
          detail = '이탈할 생존자 없음'
          return {}
        }
        current.party = current.party.filter((survivor) => survivor.uid !== victim.uid)
        current.graveyard = [...current.graveyard, victim]
        current.survivorActivity = Object.fromEntries(
          Object.entries(current.survivorActivity ?? {}).filter(([uid]) => uid !== victim.uid),
        )
        current.score = calcPlayerScore(current)
        players[s.currentPlayerIndex] = current
        detail = `${victim.emoji} ${victim.name} 이탈`
        return { players }
      }

      return {}
    })
    return detail
  },

  _finalizeUpkeepDiscard(selectedUids) {
    const { currentPlayerIndex, players } = get()
    const player = players[currentPlayerIndex]

    set((s) => {
      const players = [...s.players]
      let current = { ...players[s.currentPlayerIndex], party: [...players[s.currentPlayerIndex].party], graveyard: [...(players[s.currentPlayerIndex].graveyard ?? [])], survivorActivity: { ...(players[s.currentPlayerIndex].survivorActivity ?? {}) } }
      const discarded = current.party.filter((survivor) => selectedUids.includes(survivor.uid))
      current.party = current.party.filter((survivor) => !selectedUids.includes(survivor.uid))
      current.graveyard = [...current.graveyard, ...discarded]
      current = pruneSurvivorActivity(current)
      current.score = calcPlayerScore(current)
      players[s.currentPlayerIndex] = current
      return {
        players,
        interaction: null,
      }
    })

    get().addLog(`${player.name} — 통조림 부족으로 생존자 ${selectedUids.length}명 버림`)
    get()._advanceTurn()
  },

  useWizardSpell() {
    const { players, currentPlayerIndex, interaction, gameEnded } = get()
    if (gameEnded || interaction) return
    const player = players[currentPlayerIndex]
    if (!player || !player.party.some((survivor) => survivor.id === 's_weird_4')) return
    if (player.turnFlags?.wizardSpellUsed) return
    if (!players.some((entry, index) => index !== currentPlayerIndex && (entry.party?.length ?? 0) > 0)) return

    set({
      interaction: {
        kind: 'survivor_skill_wizard',
        step: 'select_target_player',
        payload: { targetPlayerIndex: null, targetSurvivorUid: null },
      },
    })
    get().addLog(`${player.name} — 마법사 생존자 능력 사용 준비`)
  },

  _finalizeWizardSpell(targetPlayerIndex, targetSurvivorUid) {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]
    const targetPlayer = players[targetPlayerIndex]
    const victim = targetPlayer?.party.find((survivor) => survivor.uid === targetSurvivorUid)
    if (!victim) return

    set((s) => {
      const players = [...s.players]
      const current = {
        ...players[s.currentPlayerIndex],
        survivorActivity: { ...(players[s.currentPlayerIndex].survivorActivity ?? {}) },
        turnFlags: { ...(players[s.currentPlayerIndex].turnFlags ?? {}) },
      }
      let target = {
        ...players[targetPlayerIndex],
        party: [...players[targetPlayerIndex].party],
        graveyard: [...(players[targetPlayerIndex].graveyard ?? [])],
        survivorActivity: { ...(players[targetPlayerIndex].survivorActivity ?? {}) },
        turnFlags: { ...(players[targetPlayerIndex].turnFlags ?? {}) },
      }

      target = preventSingleSurvivorLoss(target, victim, { reason: 'event_damage' }).player
      target = pruneSurvivorActivity(target)
      current.turnFlags.wizardSpellUsed = true
      current.score = calcPlayerScore(current)
      target.score = calcPlayerScore(target)

      players[s.currentPlayerIndex] = current
      players[targetPlayerIndex] = target
      return { players, interaction: null }
    })

    get().addLog(`${player.name} — 마법사 생존자 효과: ${targetPlayer.name}의 ${victim.emoji} ${victim.name} 제거`)
    get().pushActionEffect(createActionEffect({
      type: 'destroy',
      title: '마법사 생존자',
      icon: '🧙',
      targetName: targetPlayer.name,
      detail: `${victim.emoji} ${victim.name} 분리 제거`,
    }))
  },

  _finalizeEscapeTransfer(targetPlayerIndex, survivorUid) {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]
    const escapee = player?.party.find((survivor) => survivor.uid === survivorUid)
    const targetPlayer = players[targetPlayerIndex]
    if (!escapee || !targetPlayer || targetPlayerIndex === currentPlayerIndex) return
    if (getPartySlotCount(targetPlayer.party) >= targetPlayer.maxPartySize && !canStackOnExistingSlot(targetPlayer.party, escapee)) return

    const carriedCan = player.resources.can ?? 0

    set((s) => {
      const players = [...s.players]
      let current = {
        ...players[s.currentPlayerIndex],
        party: [...players[s.currentPlayerIndex].party],
        resources: { ...players[s.currentPlayerIndex].resources },
        survivorActivity: { ...(players[s.currentPlayerIndex].survivorActivity ?? {}) },
      }
      let target = {
        ...players[targetPlayerIndex],
        party: [...players[targetPlayerIndex].party],
        resources: { ...players[targetPlayerIndex].resources },
        survivorActivity: { ...(players[targetPlayerIndex].survivorActivity ?? {}) },
      }

      const moving = current.party.find((survivor) => survivor.uid === survivorUid)
      if (!moving) return { interaction: null }
      const wasActive = isSurvivorActive(current, moving)
      const applied = addSurvivorToParty(target.party, moving, target.maxPartySize)
      if (!applied.added) return { interaction: null }

      current.party = current.party.filter((survivor) => survivor.uid !== survivorUid)
      current = pruneSurvivorActivity(current)
      current.resources.can = 0
      target.party = applied.party
      target.resources.can += carriedCan
      target = setSurvivorActiveState(target, moving, wasActive)

      current.score = calcPlayerScore(current)
      target.score = calcPlayerScore(target)
      players[s.currentPlayerIndex] = clampPlayerResources(current)
      players[targetPlayerIndex] = clampPlayerResources(target)

      return { players, interaction: null }
    })

    get().addLog(`${player.name} — ${escapee.emoji} ${escapee.name} 탈출: 통조림 ${carriedCan}개를 들고 ${targetPlayer.name} 파티로 이동`)
    get().pushActionEffect(createActionEffect({
      type: 'transfer',
      title: escapee.name,
      icon: escapee.emoji,
      targetName: targetPlayer.name,
      detail: `통조림 ${carriedCan}개와 함께 이동`,
    }))
    get()._resumeEndTurnFlow()
  },

  _finalizeWizardSwap(targetPlayerIndex, targetSurvivorUid, survivorUid) {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]
    const targetPlayer = players[targetPlayerIndex]
    if (!targetPlayer || targetPlayerIndex === currentPlayerIndex) return
    const wizardIndex = player.party.findIndex((survivor) => survivor.uid === survivorUid)
    const targetIndex = targetPlayer.party.findIndex((survivor) => survivor.uid === targetSurvivorUid)
    if (wizardIndex < 0 || targetIndex < 0) return

    const wizard = player.party[wizardIndex]
    const victim = targetPlayer.party[targetIndex]

    set((s) => {
      const players = [...s.players]
      const current = { ...players[s.currentPlayerIndex], party: [...players[s.currentPlayerIndex].party] }
      const target = { ...players[targetPlayerIndex], party: [...players[targetPlayerIndex].party] }

      current.party[wizardIndex] = victim
      target.party[targetIndex] = wizard
      current.score = calcPlayerScore(current)
      target.score = calcPlayerScore(target)

      players[s.currentPlayerIndex] = current
      players[targetPlayerIndex] = target
      return { players, interaction: null }
    })

    get().addLog(`${player.name} — ${wizard.emoji} ${wizard.name} 효과: ${targetPlayer.name}의 ${victim.emoji} ${victim.name} 와 위치 교체`)
    get().pushActionEffect(createActionEffect({
      type: 'transfer',
      title: wizard.name,
      icon: wizard.emoji,
      targetName: targetPlayer.name,
      detail: `${victim.emoji} ${victim.name} 와 위치 교체`,
    }))
    get()._resumeEndTurnFlow()
  },

  _finalizeMagicGirlRecruit(targetPlayerIndex, targetSurvivorUid) {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]
    const targetPlayer = players[targetPlayerIndex]
    if (!targetPlayer || targetPlayerIndex === currentPlayerIndex) return
    if (getPartySlotCount(player.party) >= player.maxPartySize) {
      set({ interaction: null })
      return
    }
    const targetIndex = targetPlayer.party.findIndex((survivor) => survivor.uid === targetSurvivorUid && isNormalSurvivor(survivor))
    if (targetIndex < 0) return
    const survivor = targetPlayer.party[targetIndex]

    set((s) => {
      const players = [...s.players]
      const current = { ...players[s.currentPlayerIndex], party: [...players[s.currentPlayerIndex].party] }
      const target = { ...players[targetPlayerIndex], party: [...players[targetPlayerIndex].party] }
      const applied = addSurvivorToParty(current.party, survivor, current.maxPartySize)
      if (!applied.added) return { interaction: null }
      current.party = applied.party
      target.party = target.party.filter((entry) => entry.uid !== targetSurvivorUid)
      current.score = calcPlayerScore(current)
      target.score = calcPlayerScore(target)
      players[s.currentPlayerIndex] = current
      players[targetPlayerIndex] = target
      return { players, interaction: null }
    })

    get().addLog(`${player.name} — 마법소녀 생존자 효과: ${targetPlayer.name}의 ${survivor.emoji} ${survivor.name} 합류`)
    get().pushActionEffect(createActionEffect({
      type: 'steal',
      title: '마법소녀 생존자',
      icon: '✨',
      targetName: targetPlayer.name,
      detail: `${survivor.emoji} ${survivor.name} 데려옴`,
    }))
  },

  // ── 턴 종료 ───────────────────────────────────
  endTurn() {
    if (get().gameEnded) return
    const { shortage } = get().settleCurrentPlayerTurnEnd()
    const postTurnState = get()
    if (postTurnState.interaction) {
      set({ pendingTurnEndShortage: shortage })
      if (postTurnState.players[postTurnState.currentPlayerIndex]?.isBot) {
        let guard = 0
        while (get().interaction && guard < 8) {
          get()._botHandleInteraction()
          guard += 1
        }
        if (!get().interaction) {
          get()._resumeEndTurnFlow()
        }
      }
      return
    }
    set({ pendingTurnEndShortage: null })
    get()._resumeEndTurnFlow(shortage)
  },

  _resumeEndTurnFlow(explicitShortage = null) {
    const shortage = explicitShortage ?? get().pendingTurnEndShortage ?? 0
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]

    if (shortage > 0 && player.party.length > 0) {
      if (player.isBot) {
        const selected = chooseBotDiscardUids(player, shortage)
        get()._finalizeUpkeepDiscard(selected)
      } else {
        set({
          interaction: {
            kind: 'upkeep_discard',
            step: 'select_my_survivor',
            requiredCount: Math.min(shortage, player.party.length),
            payload: { selectedMyUids: [] },
          },
        })
        get().addLog(`${player.name} — 통조림 부족! 버릴 생존자 ${Math.min(shortage, player.party.length)}명을 선택하세요`)
      }
      return
    }
    if (shortage > 0 && player.party.length === 0) {
      get().addLog(`${player.name} — 통조림 부족이지만 버릴 생존자가 없음`)
    }

    set({ pendingTurnEndShortage: null })
    get()._advanceTurn()
  },

  _advanceTurn() {
    if (get().gameEnded) return
    let shouldFinalizeAfterTurn = false
    let expiredReturnedSurvivor = null
    set((s) => {
      const mercenaryPool = [...s.mercenaryPool]
      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      const revealedUids = [...s.revealedUids]
      let survivorDeck = [...s.survivorDeck]
      let eventDeck = [...s.eventDeck]
      let departedSurvivors = [...s.departedSurvivors]
      let returnedMercenary = s.returnedMercenary
      let explorationState = { ...s.explorationState }
      let searchState = { ...s.searchState }
      const players = [...s.players]

      const current = { ...players[s.currentPlayerIndex] }
      current.turnsTaken = (current.turnsTaken ?? 0) + 1
      players[s.currentPlayerIndex] = current

      if (returnedMercenary?.availableToPlayerIndex === s.currentPlayerIndex) {
        departedSurvivors = [...departedSurvivors, returnedMercenary.survivor]
        expiredReturnedSurvivor = returnedMercenary.survivor
        returnedMercenary = null
      }

      searchState = syncSearchStateWithMercenaryPool(searchState, mercenaryPool)
      survivorDeck = flattenSearchDecksByTier(searchState.decksByTier)

      const next = (s.currentPlayerIndex + 1) % s.players.length
      const round = next === 0 ? s.round + 1 : s.round
      const nextPhase = (players[next]?.turnsTaken ?? 0) === 0 ? 'party_maintenance' : 'action'

      for (let i = 0; i < eventSlots.length; i += 1) {
        if (eventSlots[i] === null) {
          const tier = getTierForEventSlotIndex(i)
          const nextTierDeck = [...(explorationState.decksByTier?.[tier] ?? [])]
          const nextCard = nextTierDeck.shift() ?? null
          explorationState = {
            ...explorationState,
            decksByTier: {
              ...explorationState.decksByTier,
              [tier]: nextTierDeck,
            },
          }
          eventSlots[i] = nextCard
          revealedSlots[i] = Boolean(nextCard)
        }
      }

      explorationState = syncExplorationStateWithEventSlots(explorationState, eventSlots)
      searchState = syncSearchStateWithMercenaryPool(searchState, mercenaryPool)

      if (s.finalRoundActive && next === s.finalRoundTriggerPlayerIndex) {
        shouldFinalizeAfterTurn = true
        return {
          players,
          round,
          interaction: null,
          eventSlots,
          revealedSlots,
          eventDeck,
          mercenaryPool,
          survivorDeck,
          departedSurvivors,
          returnedMercenary,
          revealedUids: revealedUids.filter((uid) => mercenaryPool.some((survivor) => survivor?.uid === uid)),
          explorationState,
          searchState,
        }
      }

      return {
        players,
        currentPlayerIndex: next, round,
        phase: nextPhase,
        interaction: null,
        eventSlots,
        revealedSlots,
        eventDeck,
        mercenaryPool,
        survivorDeck,
        departedSurvivors,
        returnedMercenary,
        revealedUids: revealedUids.filter((uid) => mercenaryPool.some((survivor) => survivor?.uid === uid)),
        explorationState,
        searchState,
      }
    })

    if (shouldFinalizeAfterTurn) {
      get()._finalizeGame('최종 라운드 종료')
      return
    }

    if (expiredReturnedSurvivor) {
      get().addLog(`📦 되돌려진 생존자 정리: ${expiredReturnedSurvivor.emoji} ${expiredReturnedSurvivor.name} 떠난 생존자 더미로 이동`)
    }

    const { players, currentPlayerIndex } = get()
    get().addLog(`--- ${players[currentPlayerIndex].name} 턴 (라운드 ${get().round}) ---`)
    get().settleCurrentPlayerTurnStart()

    if (players[currentPlayerIndex].isBot) {
      setTimeout(() => get().runBotTurn(), RULES.botThinkDelay)
    }
  },

  // ── 봇 턴 ────────────────────────────────────
  runBotTurn() {
    const { players, currentPlayerIndex, phase, gameEnded } = get()
    if (gameEnded) return
    const player = players[currentPlayerIndex]
    if (!player.isBot) return

    const confirmBotDiceModalIfOpen = () => {
      const fresh = get()
      const modal = fresh.diceRollModal
      if (!modal || modal.playerIndex !== fresh.currentPlayerIndex || !fresh.players[fresh.currentPlayerIndex]?.isBot) return false
      const diceCount = modal.event?.resolution?.diceCount ?? 1
      const rolls = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6))
      fresh.confirmDiceRoll(rolls)
      return true
    }

    if (phase === 'action') {
      // 글로벌/재난 이벤트는 봇이 무조건 즉시 수락
      get().eventSlots.forEach((event, i) => {
        if (!event) return
        const fresh = get()
        if (!fresh.revealedSlots[i]) return
        if (!canAccessExplorationTier(fresh.players[currentPlayerIndex], event.tier ?? getTierForEventSlotIndex(i))) return
        if (event.scope !== 'personal') {
          get().acceptGlobalEvent(i)
        }
      })

      // 이벤트 확인 및 선택적 해결
      get().eventSlots.forEach((event, i) => {
        if (!event) return
        const fresh = get()
        const freshPlayer = fresh.players[currentPlayerIndex]
        if (!canAccessExplorationTier(freshPlayer, event.tier ?? getTierForEventSlotIndex(i))) return

        const ev = get().eventSlots[i]
        if (!ev || ev.scope !== 'personal') return
        if (get().interaction) return
        if (!canAccessExplorationTier(get().players[currentPlayerIndex], ev.tier ?? getTierForEventSlotIndex(i))) return

        const fp = get().players[currentPlayerIndex]
        const canAttempt = canBotAttemptEvent(ev, fp)

        // 유토피아 단서는 점수와 무관하게 적극적으로 해결 (교체 불가)
        const isUtopiaEvent = ev.category === 'clue'
        let decision = evaluateEvent(ev, get().players[currentPlayerIndex], get())
        if (isUtopiaEvent) {
          const cluePlayer = get().players[currentPlayerIndex]
          const recommendedBonus = getRecommendedPartyBonusForAssignment(ev, getActivePartyMembers(cluePlayer), cluePlayer)
          const partyScore = calcPartyScore(cluePlayer.party, cluePlayer.leaderId ?? '').total
          const diceCount = ev.resolution?.diceCount ?? 1
          const maxPossible = partyScore + recommendedBonus + (diceCount * 6)
          const hasReasonableShot = maxPossible >= (ev.resolution?.target ?? 0)
          decision = {
            resolve: canAttempt && hasReasonableShot,
            replace: false,
          }
        } else if (!canAttempt) {
          decision = {
            resolve: false,
            replace: false,
          }
        }
        const { resolve, replace } = decision
        if (resolve) {
          get().startEventResolution(i)
          confirmBotDiceModalIfOpen()
        }
        let guard = 0
        while (get().interaction && guard < 8) {
          const before = `${get().interaction.step}:${JSON.stringify(get().interaction.payload)}`
          get()._botHandleInteraction()
          const afterInteraction = get().interaction
          const after = afterInteraction ? `${afterInteraction.step}:${JSON.stringify(afterInteraction.payload)}` : 'done'
          if (before === after) break
          guard += 1
        }
        confirmBotDiceModalIfOpen()

        if (!resolve && replace) {
          get().replaceEventSlot(i)
        }
      })

      const afterExplorationPlayer = get().players[currentPlayerIndex]
      const utopiaState = get().utopiaState
      if (
        !get().interaction &&
        canAttemptRevealedUtopia(afterExplorationPlayer, utopiaState)
      ) {
        if (getActivePartyMembers(afterExplorationPlayer).length >= 1) {
          get().startUtopiaResolution()
          let guard = 0
          while (get().interaction && guard < 8) {
            const before = `${get().interaction.step}:${JSON.stringify(get().interaction.payload)}`
            get()._botHandleInteraction()
            const afterInteraction = get().interaction
            const after = afterInteraction ? `${afterInteraction.step}:${JSON.stringify(afterInteraction.payload)}` : 'done'
            if (before === after) break
            guard += 1
          }
          confirmBotDiceModalIfOpen()
        }
      }

      confirmBotDiceModalIfOpen()
      get().endActionPhase()
    }

    if (get().gameEnded) return

    // 파티 정비 단계: 가능한 한 비활성 생존자를 우선 재활성화
    let refreshGuard = 0
    while (refreshGuard++ < 8) {
      const refreshed = get().players[currentPlayerIndex]
      const inactive = (refreshed.party ?? [])
        .map((survivor, index) => ({ survivor, index }))
        .filter(({ survivor }) => refreshed.survivorActivity?.[survivor.uid] === false)
        .sort((a, b) => (b.survivor.score ?? 0) - (a.survivor.score ?? 0))
      if (inactive.length === 0) break
      const nextTarget = inactive.find(({ survivor, index }) => {
        const cost = getReactivationCostForSurvivor(refreshed, survivor, index)
        return canAffordCost(refreshed.resources, cost)
      })
      if (!nextTarget) break
      get().reactivateSurvivor(nextTarget.survivor.uid)
    }

    const returnedMercenary = get().returnedMercenary
    const refreshedPlayer = get().players[currentPlayerIndex]
    if (
      returnedMercenary &&
      returnedMercenary.availableToPlayerIndex === currentPlayerIndex
    ) {
      get().recruitReturnedSurvivor()
    }

    const runBotMaintenanceActions = () => {
      const freshPlayer = get().players[currentPlayerIndex]
      const botAvailableSurvivors = get().mercenaryPool
        .map((survivor, index) => ({ survivor, index }))
        .filter(({ survivor, index }) => (
          survivor &&
          canAccessExplorationTier(freshPlayer, getTierForSearchSlotIndex(index))
        ))
        .map(({ survivor }) => survivor)
      const actions = decideBotAction(freshPlayer, get(), botAvailableSurvivors)
      let acted = false
      for (const action of actions) {
        if (action.type === 'RECRUIT') {
          get().recruitSurvivor(action.survivorUid)
          acted = true
        } else if (action.type === 'REORDER') {
          get().swapPartyMembers(currentPlayerIndex, action.from, action.to)
          acted = true
        } else if (action.type === 'EXCHANGE_CAP_TO_CAN') {
          get().exchangeCapToCan()
          acted = true
        } else if (action.type === 'EXCHANGE_CAN_TO_CAP') {
          get().exchangeCanToCap()
          acted = true
        }
      }
      return acted
    }

    // 공개된 후보를 먼저 평가하고, 살 것이 없을 때만 추가 수색한다.
    let iterations = 0
    while (iterations++ < 5) {
      const acted = runBotMaintenanceActions()
      if (get().gameEnded) return
      if (acted) continue

      const botPlayer = get().players[currentPlayerIndex]

      const accessibleTier = botPlayer.unlockedExplorationTier ?? 1
      let searched = false
      for (let tier = accessibleTier; tier >= 1; tier -= 1) {
        const slots = get().searchState.visibleByTier?.[tier] ?? []
        const emptyIndex = slots.findIndex((slot) => slot === null)
        if (emptyIndex < 0 || (get().searchState.decksByTier?.[tier]?.length ?? 0) === 0) continue
        get().revealSearchSlot(tier, emptyIndex)
        searched = true
        break
      }
      if (!searched) break
    }

    // 봇 턴 중 쌓인 생존자 주사위 팝업은 자동 소모
    set(() => ({ survivorDiceQueue: [] }))

    setTimeout(() => get().endTurn(), RULES.botThinkDelay)
  },

  // ── 봇 인터랙션 자동 처리 ─────────────────────
  _botHandleInteraction() {
    const state = get()
    const { interaction, players, currentPlayerIndex } = state
    if (!interaction || !players[currentPlayerIndex]?.isBot) return

    // ── 로봇 지도자 스킬: 행복수치 계산 ────────
    if (interaction.kind === 'leader_skill_robot_search') {
      const candidates = interaction.payload?.candidates ?? []
      const botPlayer = players[currentPlayerIndex]
      const recruitMode = interaction.payload?.mode === 'recruit_from_deck'
      const choice = [...candidates].sort((a, b) => (
        ((b.score ?? 0) * 2 - (b.recruitCost ?? 0) * 0.2) -
        ((a.score ?? 0) * 2 - (a.recruitCost ?? 0) * 0.2)
      )).find((survivor) => {
        if (!recruitMode) return true
        const cost = survivor.recruitCost ?? 0
        const hasSlot = getPartySlotCount(botPlayer.party) < botPlayer.maxPartySize || canStackOnExistingSlot(botPlayer.party, survivor)
        return hasSlot && canRecruitSurvivor(botPlayer, survivor) && (botPlayer.resources?.bottleCap ?? 0) >= cost
      })
      if (choice) get().selectLeaderSearchCandidate(choice.uid)
      return
    }

    // ── 턴 종료 탈옥 이동 ────────────────────────
    if (interaction.kind === 'survivor_endturn_escape') {
      const others = players
        .map((p, i) => ({ p, i }))
        .filter(({ i, p }) => i !== currentPlayerIndex && getPartySlotCount(p.party) < p.maxPartySize)
      if (!others.length) return
      const target = others.sort((a, b) => calcPartyScore(a.p.party, a.p.leaderId).total - calcPartyScore(b.p.party, b.p.leaderId).total)[0]
      get().selectTargetPlayer(target.i)
      return
    }

    // ── 턴 종료 마법사 위치 교체 ─────────────────
    if (interaction.kind === 'survivor_endturn_wizard_swap') {
      if (interaction.step === 'select_target_player') {
        const others = players
          .map((p, i) => ({ p, i }))
          .filter(({ i }) => i !== currentPlayerIndex && (players[i].party?.length ?? 0) > 0)
        if (!others.length) return
        const human = others.find(({ i }) => i === 0)
        const target = human ?? others.reduce((best, cur) =>
          calcPartyScore(cur.p.party, cur.p.leaderId).total > calcPartyScore(best.p.party, best.p.leaderId).total ? cur : best
        , others[0])
        get().selectTargetPlayer(target.i)
      } else if (interaction.step === 'select_target_survivor') {
        const ti = interaction.payload.targetPlayerIndex
        if (ti === null) return
        const victim = [...(players[ti]?.party ?? [])].sort((a, b) => b.score - a.score)[0]
        if (victim) get().selectTargetSurvivor(victim.uid)
      }
      return
    }

    // ── 마법소녀 영입 효과 ───────────────────────
    if (interaction.kind === 'survivor_recruit_magicgirl_take') {
      if (interaction.step === 'select_target_player') {
        const others = players
          .map((p, i) => ({ p, i }))
          .filter(({ i, p }) => i !== currentPlayerIndex && p.party.some(isNormalSurvivor))
        if (!others.length) return
        const human = others.find(({ i }) => i === 0)
        const target = human ?? others.reduce((best, cur) =>
          (getNormalSurvivorCount(cur.p.party) > getNormalSurvivorCount(best.p.party) ? cur : best)
        , others[0])
        get().selectTargetPlayer(target.i)
      } else if (interaction.step === 'select_target_survivor') {
        const ti = interaction.payload.targetPlayerIndex
        if (ti === null) return
        const victim = (players[ti]?.party ?? []).find(isNormalSurvivor)
        if (victim) get().selectTargetSurvivor(victim.uid)
      }
      return
    }

    const resolution = interaction.event?.resolution
    if (interaction.kind === 'assign_search_party' && interaction.step === 'select_my_survivor') {
      const active = getActivePartyMembers(players[currentPlayerIndex]).slice(0, interaction.requiredCount)
      active.forEach((survivor) => get().selectMySurvivor(survivor.uid))
      return
    }

    if (interaction.kind === 'assign_event_party' && interaction.step === 'select_my_survivor') {
      const botPlayer = players[currentPlayerIndex]
      const active = getActivePartyMembers(players[currentPlayerIndex])
      const alreadySelected = interaction.payload?.selectedMyUids ?? []
      const desiredCount = isRollDiceType(interaction.event?.resolution?.type)
        ? getRecommendedDiceAssignmentCount(interaction.event, active.length)
        : interaction.requiredCount
      if (alreadySelected.length >= desiredCount) {
        get().confirmEventAssignment()
        return
      }
      if (active.length < interaction.requiredCount) {
        get().addLog(`${botPlayer.name} — ${interaction.event?.emoji ?? ''} ${interaction.event?.name ?? '이벤트'} 도전 취소 (활성 생존자 부족)`)
        set({ interaction: null })
        return
      }

      const requiredType = getRequiredAssignedTypeForEvent(interaction.event)
      const recommended = interaction.event?.recommendedParty ?? []
      const selected = []
      if (requiredType) {
        const requiredSurvivor = active.find((survivor) => survivor.type === requiredType)
        if (requiredSurvivor) selected.push(requiredSurvivor)
        if (!requiredSurvivor) {
          get().addLog(`${botPlayer.name} — ${interaction.event?.emoji ?? ''} ${interaction.event?.name ?? '이벤트'} 도전 취소 (활성 ${requiredType} 생존자 부족)`)
          set({ interaction: null })
          return
        }
      }
      recommended.forEach(({ type, count = 1 }) => {
        active
          .filter((survivor) => survivor.type === type && !selected.some((entry) => entry.uid === survivor.uid))
          .slice(0, count)
          .forEach((survivor) => {
            if (selected.length < desiredCount) selected.push(survivor)
          })
      })
      active.forEach((survivor) => {
        if (selected.length >= desiredCount) return
        if (selected.some((entry) => entry.uid === survivor.uid)) return
        selected.push(survivor)
      })
      if (selected.length < interaction.requiredCount) {
        get().addLog(`${botPlayer.name} — ${interaction.event?.emoji ?? ''} ${interaction.event?.name ?? '이벤트'} 도전 취소 (파견 가능 인원 부족)`)
        set({ interaction: null })
        return
      }
      const selectedUids = selected.slice(0, desiredCount).map((survivor) => survivor.uid)
      set({
        interaction: {
          ...interaction,
          payload: {
            ...interaction.payload,
            selectedMyUids: selectedUids,
          },
        },
      })
      get().confirmEventAssignment()
      return
    }

    if (interaction.kind === 'assign_utopia_party' && interaction.step === 'select_my_survivor') {
      const active = getActivePartyMembers(players[currentPlayerIndex])
      const recommended = interaction.event?.recommendedParty ?? []
      const selected = []
      const desiredCount = getRecommendedDiceAssignmentCount(interaction.event, active.length)
      recommended.forEach(({ type, count = 1 }) => {
        active
          .filter((survivor) => survivor.type === type && !selected.some((entry) => entry.uid === survivor.uid))
          .slice(0, count)
          .forEach((survivor) => {
            if (selected.length < desiredCount) selected.push(survivor)
          })
      })
      active.forEach((survivor) => {
        if (selected.length >= desiredCount) return
        if (selected.some((entry) => entry.uid === survivor.uid)) return
        selected.push(survivor)
      })
      selected.slice(0, desiredCount).forEach((survivor) => get().selectMySurvivor(survivor.uid))
      get().confirmEventAssignment()
      return
    }

    if (!resolution) return

    // select_my_survivor
    if (interaction.step === 'select_my_survivor') {
      const player = players[currentPlayerIndex]
      const amount = resolution.amount ?? 1
      const picks = chooseBotSacrifice(player, amount, resolution.survivorType)
      picks.forEach((uid) => get().selectMySurvivor(uid))
      // 선택 후 target 선택이 필요하면 처리됨
      return
    }

    // select_target_player
    if (interaction.step === 'select_target_player') {
      const others = players
        .map((p, i) => ({ p, i }))
        .filter(({ i }) => i !== currentPlayerIndex && !players[i].eliminated)
      if (others.length === 0) return

      const currentPlayer = players[currentPlayerIndex]
      let target = null

      if (resolution.type === 'send_survivor_type' || resolution.type === 'send_survivors_n') {
        const selected = (interaction.payload.selectedMyUids ?? [])
          .map((uid) => currentPlayer.party.find((survivor) => survivor.uid === uid))
          .filter(Boolean)
        target = others
          .filter(({ p }) => canReceiveTransferredSurvivors(p, selected))
          .reduce((best, cur) => {
            if (!best) return cur
            const bs = calcPartyScore(best.p.party, best.p.leaderId).total
            const cs = calcPartyScore(cur.p.party, cur.p.leaderId).total
            return cs > bs ? cur : best
          }, null)
      } else if (resolution.type === 'take_from_party') {
        const humanTake = others
          .map(({ p, i }) => ({ i, best: findBestTake(currentPlayer, getAttackTargetableSurvivors(p)) }))
          .find((entry) => entry.i === 0 && entry.best)
        target = humanTake ?? others
          .map(({ p, i }) => ({ i, best: findBestTake(currentPlayer, getAttackTargetableSurvivors(p)) }))
          .filter((entry) => entry.best)
          .sort((a, b) => (b.best?.score ?? b.best?.recruitCost ?? 0) - (a.best?.score ?? a.best?.recruitCost ?? 0))[0]
      } else if (resolution.type === 'remove_from_party' || resolution.type === 'reorder_other_party') {
        const human = others.find(({ i, p }) => i === 0 && getAttackTargetableSurvivors(p).length > 0)
        target = human ?? others
          .filter(({ p }) => getAttackTargetableSurvivors(p).length > 0)
          .reduce((best, cur) => {
            if (!best) return cur
            const bs = calcPartyScore(best.p.party, best.p.leaderId).total
            const cs = calcPartyScore(cur.p.party, cur.p.leaderId).total
            return cs > bs ? cur : best
          }, null)
      } else {
        target = others.reduce((best, cur) => {
          const bs = best ? calcPartyScore(best.p.party, best.p.leaderId).total : -Infinity
          const cs = calcPartyScore(cur.p.party, cur.p.leaderId).total
          return cs > bs ? cur : best
        }, null)
      }

      if (target) get().selectTargetPlayer(target.i)
      return
    }

    // select_target_survivor (상대 파티에서)
    if (interaction.step === 'select_target_survivor') {
      const ti = interaction.payload.targetPlayerIndex
      if (ti === null) return
      const targetPlayer = players[ti]

      if (resolution.type === 'remove_from_party') {
        // 점수 가장 높은 생존자 제거
        const victim = [...getAttackTargetableSurvivors(targetPlayer)].sort((a, b) => b.score - a.score)[0]
        if (victim) get().selectTargetSurvivor(victim.uid)
      } else if (resolution.type === 'take_from_party') {
        // 내 파티 시너지가 가장 높아지는 생존자 탈취
        const best = findBestTake(players[currentPlayerIndex], getAttackTargetableSurvivors(targetPlayer))
        if (best) get().selectTargetSurvivor(best.uid)
      } else if (resolution.type === 'steal_from_grave') {
        // 무덤에서 점수 높은 생존자 탈취
        const grave = targetPlayer.graveyard ?? []
        if (grave.length > 0) {
          const best = [...grave].sort((a, b) => b.score - a.score)[0]
          get().selectTargetSurvivor(best.uid)
        }
      }
      return
    }

    // select_grave_survivor (내 무덤에서 부활)
    if (interaction.step === 'select_grave_survivor') {
      const departed = getSharedDepartedSurvivors(players, get().departedSurvivors)
        .filter((survivor) => interaction.kind === 'survivor_recruit_vet_revive' ? isAnimalSurvivor(survivor) : true)
      if (departed.length > 0) {
        const best = [...departed].sort((a, b) => b.score - a.score)[0]
        get().selectGraveSurvivor(best.uid)
      }
      return
    }

    // select_swap_a / select_swap_b (순서 변경)
    if (interaction.step === 'select_swap_a' || interaction.step === 'select_swap_b') {
      const isMyParty = resolution.type === 'reorder_my_party'
      const ti = interaction.payload.targetPlayerIndex
      const targetParty = isMyParty
        ? players[currentPlayerIndex].party
        : players[ti]?.party ?? []
      const leaderId = isMyParty ? players[currentPlayerIndex].leaderId : players[ti]?.leaderId

      if (interaction.step === 'select_swap_a') {
        const swap = findBestPartySwap(targetParty, leaderId, isMyParty ? 'maximize' : 'minimize')
        if (swap && targetParty[swap.from]) get().selectSwapSurvivor(targetParty[swap.from].uid)
      } else {
        const swap = findBestPartySwap(targetParty, leaderId, isMyParty ? 'maximize' : 'minimize')
        const targetUid = swap && targetParty[swap.to] ? targetParty[swap.to].uid : targetParty.find((survivor) => survivor.uid !== interaction.payload.swapA)?.uid
        if (targetUid) get().selectSwapSurvivor(targetUid)
      }
      return
    }
  },

  addLog(msg) {
    set((s) => ({ globalLog: [msg, ...s.globalLog].slice(0, 50) }))
  },

  pushActionEffect(effect) {
    set((s) => ({
      actionEffects: [...s.actionEffects, { id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...effect }],
    }))
  },

  dismissActionEffect(id) {
    set((s) => ({ actionEffects: s.actionEffects.filter((effect) => effect.id !== id) }))
  },

  // ── 영입 트리거 처리 ─────────────────────────
  _applyOnRecruitTriggers(survivor) {
    if (!survivor.triggers) return
    const { currentPlayerIndex } = get()

    survivor.triggers.forEach((trigger) => {
      if (trigger.on !== 'on_recruit') return

      if (trigger.effect === 'gain_can') {
        set((s) => {
          const ps = [...s.players]
          const p = { ...ps[s.currentPlayerIndex], resources: { ...ps[s.currentPlayerIndex].resources } }
          p.resources.can += trigger.amount
          ps[s.currentPlayerIndex] = clampPlayerResources(p)
          return { players: ps }
        })
        get().addLog(`${survivor.emoji} ${survivor.name} 효과: 🥫 통조림 +${trigger.amount}`)
        get().pushActionEffect(createActionEffect({
          type: 'resource_gain',
          title: `${survivor.name} 합류`,
          icon: survivor.emoji,
          targetName: '영입 효과',
          detail: `통조림 +${trigger.amount}`,
        }))
      }

      if (trigger.effect === 'replace_party_member') {
        // 외계인: 파티에 생존자가 2명 이상이고 덱에 카드가 있을 때만 발동
        const player = get().players[currentPlayerIndex]
        if (player.party.length < 2 || get().survivorDeck.length === 0) return
        // 랜덤으로 파티 내 생존자 1명 교체 (영입된 외계인 제외)
        set((s) => {
          const ps = [...s.players]
          let p = { ...ps[s.currentPlayerIndex], party: [...ps[s.currentPlayerIndex].party], survivorActivity: { ...(ps[s.currentPlayerIndex].survivorActivity ?? {}) } }
          const deck = [...s.survivorDeck]
          // 외계인 제외한 파티 멤버 중 랜덤 선택
          const candidates = p.party.filter(sv => sv.id !== survivor.id)
          if (candidates.length === 0 || deck.length === 0) return {}
          const target = candidates[Math.floor(Math.random() * candidates.length)]
          const replacement = deck.shift()
          p.party = p.party.map(sv => sv.uid === target.uid ? replacement : sv)
          delete p.survivorActivity[target.uid]
          p = setSurvivorActiveState(p, replacement, false)
          p.score = calcPlayerScore(p)
          ps[s.currentPlayerIndex] = p
          return {
            players: ps,
            survivorDeck: deck,
            searchState: {
              ...s.searchState,
              decksByTier: buildSearchDecksByTierFromCards(deck),
            },
          }
        })
        get().addLog(`${survivor.emoji} ${survivor.name} 효과: 파티 멤버 1명 교체`)
      }

      if (trigger.effect === 'revive_from_own_grave') {
        const state = get()
        const departed = getSharedDepartedSurvivors(state.players, state.departedSurvivors).filter(isAnimalSurvivor)
        if (departed.length === 0) return
        set({
          interaction: {
            kind: 'survivor_recruit_vet_revive',
            step: 'select_grave_survivor',
            event: {
              name: survivor.name,
              emoji: survivor.emoji,
              resolution: { type: 'revive_from_grave' },
            },
            payload: { targetSurvivorUid: null },
          },
        })
        get().addLog(`${survivor.emoji} ${survivor.name} 효과: 떠난 생존자 더미에서 동물 생존자 1명을 부활시킬 수 있습니다.`)
      }

      if (trigger.effect === 'take_normal_from_other_party') {
        const state = get()
        const currentPlayer = state.players[currentPlayerIndex]
        if (getPartySlotCount(currentPlayer.party) >= currentPlayer.maxPartySize) return

        const targets = state.players
          .map((player, index) => ({ player, index }))
          .filter(({ index, player }) => index !== currentPlayerIndex && player.party.some(isNormalSurvivor))
        if (!targets.length) return

        set({
          interaction: {
            kind: 'survivor_recruit_magicgirl_take',
            step: 'select_target_player',
            payload: { targetPlayerIndex: null, targetSurvivorUid: null },
          },
        })
        get().addLog(`${survivor.emoji} ${survivor.name} 효과: 다른 파티의 평범 생존자 1명을 데려올 수 있습니다.`)
      }

      if (trigger.effect === 'recruit_random_from_deck') {
        const player = get().players[currentPlayerIndex]
        const deck = get().survivorDeck
        if (deck.length === 0 || getPartySlotCount(player.party) >= player.maxPartySize) return
        const randIdx = Math.floor(Math.random() * deck.length)
        set((s) => {
          const ps = [...s.players]
          let p = { ...ps[s.currentPlayerIndex], party: [...ps[s.currentPlayerIndex].party], survivorActivity: { ...(ps[s.currentPlayerIndex].survivorActivity ?? {}) } }
          const newDeck = [...s.survivorDeck]
          const [picked] = newDeck.splice(randIdx, 1)
          const applied = addSurvivorToParty(p.party, picked, p.maxPartySize)
          if (!applied.added) return {}
          p.party = applied.party
          p = setSurvivorActiveState(p, picked, false)
          p.score = calcPlayerScore(p)
          ps[s.currentPlayerIndex] = clampPlayerResources(p)
          return {
            players: ps,
            survivorDeck: newDeck,
            searchState: {
              ...s.searchState,
              decksByTier: buildSearchDecksByTierFromCards(newDeck),
            },
          }
        })
        get().addLog(`🦆 ${survivor.emoji} ${survivor.name} 효과: 덱에서 랜덤 생존자 추가 합류`)
      }

      if (trigger.effect === 'give_cap_all') {
        set((s) => {
          const ps = s.players.map((p) => clampPlayerResources({ ...p, resources: { ...p.resources, bottleCap: p.resources.bottleCap + 1 } }))
          return { players: ps }
        })
        get().addLog(`📣 ${survivor.emoji} ${survivor.name} 효과: 전원 병뚜껑 +1`)
        get().pushActionEffect(createActionEffect({
          type: 'resource_gain',
          title: `${survivor.name} 합류`,
          icon: survivor.emoji,
          targetName: '영입 효과',
          detail: '전원 병뚜껑 +1',
        }))
      }
    })
  },

  // ── 턴 종료 트리거 처리 ───────────────────────
  _applyOnTurnEndTriggers() {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]

    player.party.forEach((survivor) => {
      if (!survivor.triggers) return

      survivor.triggers.forEach((trigger) => {
        if (trigger.on !== 'on_turn_end') return

        if (trigger.effect === 'escape_with_cans') {
          const roll = Math.ceil(Math.random() * 6)
          const fresh = get()
          const candidates = fresh.players
            .map((entry, index) => ({ entry, index }))
            .filter(({ index, entry }) => index !== fresh.currentPlayerIndex && getPartySlotCount(entry.party) < entry.maxPartySize)
          if (roll !== (trigger.successOn ?? 1) || candidates.length === 0) return

          if (fresh.players[fresh.currentPlayerIndex].isBot) {
            const target = candidates
              .sort((a, b) => calcPartyScore(a.entry.party, a.entry.leaderId).total - calcPartyScore(b.entry.party, b.entry.leaderId).total)[0]
            get()._finalizeEscapeTransfer(target.index, survivor.uid)
          } else {
            set({
              interaction: {
                kind: 'survivor_endturn_escape',
                step: 'select_target_player',
                payload: { survivorUid: survivor.uid },
              },
            })
            get().addLog(`🔓 ${survivor.name} 주사위 ${roll}: 통조림을 들고 탈출할 파티를 선택하세요.`)
          }
        }

        if (trigger.effect === 'swap_with_other_party') {
          const roll = Math.ceil(Math.random() * 6)
          const fresh = get()
          const candidates = fresh.players
            .map((entry, index) => ({ entry, index }))
            .filter(({ index, entry }) => index !== fresh.currentPlayerIndex && entry.party.length > 0)
          if (roll > (trigger.successOn ?? 2) || candidates.length === 0) return

          if (fresh.players[fresh.currentPlayerIndex].isBot) {
            const target = candidates.reduce((best, current) =>
              calcPartyScore(current.entry.party, current.entry.leaderId).total > calcPartyScore(best.entry.party, best.entry.leaderId).total ? current : best
            , candidates[0])
            const victim = [...target.entry.party].sort((a, b) => b.score - a.score)[0]
            if (victim) get()._finalizeWizardSwap(target.index, victim.uid, survivor.uid)
          } else {
            set({
              interaction: {
                kind: 'survivor_endturn_wizard_swap',
                step: 'select_target_player',
                payload: { survivorUid: survivor.uid, targetPlayerIndex: null, targetSurvivorUid: null },
              },
            })
            get().addLog(`🧙 ${survivor.name} 주사위 ${roll}: 위치를 바꿀 대상 파티를 선택하세요.`)
          }
        }
      })
    })
  },

  // ── 패시브 트리거 처리 (조건 만족 시 발동) ──────
  _applyPassiveTriggers() {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]

    function checkCondition(trigger, party) {
      if (!trigger.condition) return true
      if (trigger.condition === 'party_has_id') {
        return party.some(sv => sv.id === trigger.targetId)
      }
      if (trigger.condition === 'party_has_type') {
        return party.some(sv => sv.type === trigger.targetType)
      }
      return false
    }

    player.party.forEach((survivor) => {
      if (!survivor.triggers) return
      survivor.triggers.forEach((trigger) => {
        if (trigger.on !== 'passive') return
        const fresh = get()
        const freshPlayer = fresh.players[fresh.currentPlayerIndex]
        if (!checkCondition(trigger, freshPlayer.party)) return
      })
    })

    get()._resolveSlasherAdjacency()
  },

  _resolveSlasherAdjacency() {
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]
    const slasherIndex = player.party.findIndex((survivor) => survivor.id === 's_military_3')
    if (slasherIndex < 0) return

    const left = slasherIndex > 0 ? player.party[slasherIndex - 1] : null
    const right = slasherIndex < player.party.length - 1 ? player.party[slasherIndex + 1] : null
    if (!isSlasherAdjacencyConflict(left, player.party[slasherIndex]) && !isSlasherAdjacencyConflict(player.party[slasherIndex], right)) {
      return
    }

    const slasher = player.party[slasherIndex]
    set((s) => {
      const players = [...s.players]
      const current = {
        ...players[s.currentPlayerIndex],
        party: [...players[s.currentPlayerIndex].party],
        graveyard: [...(players[s.currentPlayerIndex].graveyard ?? [])],
      }
      current.party = current.party.filter((survivor) => survivor.uid !== slasher.uid)
      current.graveyard = [...current.graveyard, slasher]
      current.score = calcPlayerScore(current)
      players[s.currentPlayerIndex] = current
      return { players }
    })

    get().addLog(`🎬 ${slasher.name} 은(는) 평범/겁쟁이와 인접할 수 없어 파티를 떠남`)
    get().pushActionEffect(createActionEffect({
      type: 'destroy',
      title: slasher.name,
      icon: slasher.emoji,
      targetName: player.name,
      detail: '인접 제한 위반으로 이탈',
    }))
  },

  // ── 주사위 모달 결과 확정 ─────────────────────
  confirmDiceRoll(rolls) {
    const { diceRollModal, players, currentPlayerIndex } = get()
    if (!diceRollModal) return
    const { slotIndex, event, partyScore = 0, recommendedBonus = 0, kind, bonusLabel = '추천' } = diceRollModal
    set({ diceRollModal: null })

    const player = players[currentPlayerIndex]
    const resolution = event.resolution

    const rollSum = rolls.reduce((a, b) => a + b, 0)
    const total = rollSum + partyScore
    const success = total >= resolution.target
    let finalSuccess = success

    let rewardLogs = [`🎲 [${rolls.join('+')}]+${bonusLabel}${partyScore} = ${total} (목표 ${resolution.target}: ${success ? '✅ 성공' : '❌ 실패'})`]
    let revealedUtopiaForLeader = null

    if (kind === 'utopia') {
      set((s) => {
        const players = [...s.players]
        const idx = s.currentPlayerIndex
        let survivorDeck = [...s.survivorDeck]
        let p = {
          ...players[idx],
          resources: { ...players[idx].resources },
          party: [...players[idx].party],
        }

        if (success && event.reward) {
          const applied = applyRewardToPlayer(p, event.reward, survivorDeck)
          p = applied.player
          survivorDeck = applied.survivorDeck
          rewardLogs = [...rewardLogs, ...applied.logs]
        }

        p.score = calcPlayerScore(p)
        players[idx] = p

        return {
          players,
          survivorDeck,
          searchState: { ...s.searchState, decksByTier: buildSearchDecksByTierFromCards(survivorDeck) },
          interaction: null,
          utopiaState: success
            ? {
              ...s.utopiaState,
              claimed: true,
              claimedByPlayerId: p.id,
              claimedCard: event,
            }
            : s.utopiaState,
          finalRoundActive: success ? true : s.finalRoundActive,
          finalRoundTriggerPlayerIndex: success ? idx : s.finalRoundTriggerPlayerIndex,
        }
      })

      get().addLog(`${player.name} — ${event.emoji} ${event.name} ${success ? '획득!' : '실패'}`)
      rewardLogs.forEach((msg) => get().addLog(msg))
      if (success) {
        get().addLog(`🏁 유토피아 도달: 최종 라운드 시작`)
        get().addLog(`⏳ ${player.name}의 다음 차례가 오기 직전에 게임이 종료됩니다.`)
      }
      return
    }

    set((s) => {
      const players = [...s.players]
      const idx = s.currentPlayerIndex
      let survivorDeck = [...s.survivorDeck]
      let utopiaState = { ...s.utopiaState }
      let p = { ...players[idx], resources: { ...players[idx].resources }, party: [...players[idx].party], graveyard: [...(players[idx].graveyard ?? [])], turnFlags: { ...(players[idx].turnFlags ?? {}) } }

      if (!success && event.failPenalty) {
        p = applyPenaltyToPlayer(p, event.failPenalty)
      }

      if (success && event.reward) {
        const applied = applyRewardToPlayer(p, event.reward, survivorDeck)
        p = applied.player
        survivorDeck = applied.survivorDeck
        rewardLogs = [...rewardLogs, ...applied.logs]
      }

      // s_charge_1 이세계 탈출: 이벤트 실패 시 1회 재시도
      if (!success && p.party.some((sv) => sv.id === 's_charge_1') && !p.turnFlags?.heroRetryUsed) {
        p.turnFlags = { ...(p.turnFlags ?? {}), heroRetryUsed: true }
        const reRolls = Array.from({ length: resolution?.diceCount ?? 1 }, () => Math.ceil(Math.random() * 6))
        const reTotal = reRolls.reduce((a, b) => a + b, 0) + partyScore
        finalSuccess = reTotal >= (resolution?.target ?? 99)
        rewardLogs = [...rewardLogs, `⚔️ 용사 재시도: 🎲[${reRolls.join('+')}]+${bonusLabel}${partyScore}=${reTotal} → ${finalSuccess ? '✅ 성공' : '❌ 실패, 파티 이탈'}`]
        if (finalSuccess) {
          // 실패 패널티 취소
          if (event.failPenalty) {
            if (event.failPenalty.type === 'lose_can') p.resources.can = Math.min(p.resources.can + event.failPenalty.amount, s.players[idx].resources.can)
            if (event.failPenalty.type === 'lose_cap') p.resources.bottleCap = Math.min(p.resources.bottleCap + event.failPenalty.amount, s.players[idx].resources.bottleCap)
          }
          // 보상 적용
          if (event.reward) {
            const applied = applyRewardToPlayer(p, event.reward, survivorDeck)
            p = applied.player
            survivorDeck = applied.survivorDeck
            rewardLogs = [...rewardLogs, ...applied.logs]
          }
        } else {
          // 재시도도 실패: 용사 파티 이탈
          const hero = p.party.find((sv) => sv.id === 's_charge_1')
          if (hero) {
            p.party = p.party.filter((sv) => sv.uid !== hero.uid)
            p.graveyard = [...(p.graveyard ?? []), hero]
          }
        }
      }

      // s_charge_4 볼주머니: 이벤트 성공 시 통조림 +1
      if (finalSuccess && p.party.some((sv) => sv.id === 's_charge_4')) {
        p.resources.can += 1
        rewardLogs = [...rewardLogs, `🐾 햄스터 볼주머니: 이벤트 성공 통조림 +1`]
      }

      p = clampPlayerResources(p)

      const shouldKeepClueOnFailInner = event.category === 'clue' && !finalSuccess
      if (finalSuccess || !event.penalizeOnFail) {
        p.eventDiscard = [...p.eventDiscard, event]
        if (finalSuccess && event.category === 'clue') {
          p = applyClueClaimProgress(p, event)
          if ((event.tier ?? 0) === 3 && !utopiaState.revealed) {
            utopiaState = {
              ...utopiaState,
              revealed: true,
              revealedForLeaderId: p.leaderId,
            }
            revealedUtopiaForLeader = p.leaderId
          }
        }
      } else if (!shouldKeepClueOnFailInner) {
        p.abandonedEvents = [...p.abandonedEvents, event]
      }
      p.score = calcPlayerScore(p)
      players[idx] = p

      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      if (!shouldKeepClueOnFailInner) {
        eventSlots[slotIndex] = null
        revealedSlots[slotIndex] = false
      }

      return {
        players,
        eventSlots,
        revealedSlots,
        interaction: null,
        survivorDeck,
        searchState: { ...s.searchState, decksByTier: buildSearchDecksByTierFromCards(survivorDeck) },
        utopiaState,
        explorationState: syncExplorationStateWithEventSlots(s.explorationState, eventSlots),
      }
    })

    const shouldKeepClueOnFail = event.category === 'clue' && !finalSuccess
    get().addLog(`${player.name} — ${event.emoji} ${event.name} ${finalSuccess ? '해결!' : '실패'}`)
    rewardLogs.forEach((msg) => get().addLog(msg))
    if (revealedUtopiaForLeader) {
      const utopiaCard = get().utopiaState.cardsByLeaderId?.[revealedUtopiaForLeader]
      get().addLog(`🌅 유토피아 공개: ${utopiaCard?.name ?? '알 수 없는 유토피아'} (${player.name}이 3단계 단서를 먼저 확보)`)
    }
    if (!shouldKeepClueOnFail) {
      set((s) => {
        if (!s.eventSlots[slotIndex] && !s.revealedSlots[slotIndex]) return {}
        const eventSlots = [...s.eventSlots]
        const revealedSlots = [...s.revealedSlots]
        eventSlots[slotIndex] = null
        revealedSlots[slotIndex] = false
        return {
          eventSlots,
          revealedSlots,
          explorationState: syncExplorationStateWithEventSlots(s.explorationState, eventSlots),
        }
      })
    }
    if (shouldKeepClueOnFail) {
      get().addLog(`🗺️ ${event.name} 단서는 남아 있습니다. 다음 턴에 다시 도전할 수 있습니다.`)
    }
    if (finalSuccess && event.category === 'clue') {
      get().addLog(`🗺️ 유토피아 단서 진행도: ${getTotalResolvedClues(get().players)}/${RULES.clueTarget}`)
      get()._checkGameEnd('유토피아 단서 5장 해결')
    }
  },

  // ── 생존자 능력 주사위 팝업 확인 ─────────────────
  confirmSurvivorDice() {
    set((s) => ({ survivorDiceQueue: s.survivorDiceQueue.slice(1) }))
  },

  _checkGameEnd(reason = '게임 종료') {
    const state = get()
    if (state.gameEnded) return

    const totalResolvedClues = getTotalResolvedClues(state.players)
    if (totalResolvedClues < RULES.clueTarget) return
    if (state.finalRoundActive) return

    set({
      finalRoundActive: true,
      finalRoundTriggerPlayerIndex: state.currentPlayerIndex,
    })

    get().addLog(`🏁 ${reason}: 최종 라운드 시작`)
    get().addLog(`⏳ ${state.players[state.currentPlayerIndex].name}의 다음 차례가 오기 직전에 게임이 종료됩니다.`)
  },

  _finalizeGame(reason = '게임 종료') {
    const state = get()
    if (state.gameEnded) return

    const finalStandings = [...state.players]
      .map((player) => calcFinalScoreBreakdown(player, state.players))
      .sort((a, b) => b.total - a.total)

    const topScore = finalStandings[0]?.total ?? 0
    const winnerIds = finalStandings
      .filter((entry) => entry.total === topScore)
      .map((entry) => entry.playerId)

    set({
      gameEnded: true,
      finalRoundActive: false,
      winnerIds,
      finalStandings,
      finalReason: reason,
    })

    const winners = finalStandings
      .filter((entry) => winnerIds.includes(entry.playerId))
      .map((entry) => entry.name)
      .join(', ')
    get().addLog(`🏆 게임 종료: ${reason}`)
    get().addLog(`🏁 승자: ${winners} (${topScore}점)`)
  },

  resetGame() {
    set({
      screen: 'setup',
      players: [],
      playerConfigs: [],
      turnStructure: {
        version: 'legacy',
        phases: ['action', 'party_maintenance'],
        current: 'action',
      },
      explorationState: {
        decksByTier: { 1: [], 2: [], 3: [] },
        clueDecksByTier: { 1: [], 2: [], 3: [] },
        disasterDecksByTier: { 1: [], 2: [], 3: [] },
        visibleByTier: { 1: [], 2: [], 3: [] },
      },
      searchState: {
        decksByTier: { 1: [], 2: [], 3: [] },
        visibleByTier: { 1: [], 2: [], 3: [] },
        visibleSlots: [],
        revealActionCost: RULES.search.revealActionCost,
        assignedSurvivorsRequired: RULES.search.assignedSurvivorsRequired,
        recruitStartsInactive: RULES.search.recruitStartsInactive,
      },
      utopiaState: {
        revealed: false,
        claimed: false,
        revealedForLeaderId: null,
        claimedByPlayerId: null,
        cardsByLeaderId: {},
      },
      eventDeck: [],
      eventSlots: Array(getLegacyExplorationSlotCount()).fill(null),
      revealedSlots: Array(getLegacyExplorationSlotCount()).fill(false),
      survivorDeck: [],
      mercenaryPool: [],
      revealedUids: [],
      departedSurvivors: [],
      returnedMercenary: null,
      globalLog: [],
      gameEnded: false,
      finalRoundActive: false,
      finalRoundTriggerPlayerIndex: null,
      winnerIds: [],
      finalStandings: [],
      finalReason: '',
    })
  },
}))

// ── 헬퍼 ──────────────────────────────────────────────────────────────
function getFirstStep(resolution) {
  switch (resolution.type) {
    case 'remove_choice':
    case 'send_survivor_type':
    case 'send_survivors_n':
      return 'select_my_survivor'
    case 'reorder_my_party':
      return 'select_swap_a'
    case 'take_from_party':
    case 'remove_from_party':
      return 'select_target_player'
    case 'reorder_other_party':
      return 'select_target_player'
    case 'revive_from_grave':
    case 'steal_from_grave':
      return 'select_grave_survivor'
    default:
      return null
  }
}

function getNextStep(resolution, currentStep) {
  const flow = {
    send_survivor_type:  { select_my_survivor: 'select_target_player' },
    send_survivors_n:    { select_my_survivor: 'select_target_player' },
    reorder_my_party:    { select_swap_a: 'select_swap_b' },
    take_from_party:     { select_target_player: 'select_target_survivor' },
    remove_from_party:   { select_target_player: 'select_target_survivor' },
    reorder_other_party: { select_target_player: 'select_swap_a', select_swap_a: 'select_swap_b' },
  }
  return flow[resolution.type]?.[currentStep] ?? null
}

function applyPenaltyToPlayer(p, penalty) {
  if (penalty.type === 'remove_random' && p.party.length > 0) {
    const ri = Math.floor(Math.random() * p.party.length)
    const killed = p.party[ri]
    p = preventSingleSurvivorLoss(p, killed, { reason: 'event_damage' }).player
  }
  if (penalty.type === 'lose_can') {
    p = { ...p, resources: { ...p.resources, can: Math.max(0, p.resources.can - penalty.amount) } }
  }
  return clampPlayerResources(p)
}

function isCatDogConflict(a, b) {
  const ids = [a?.id, b?.id]
  return ids.includes('s_coward_1') && ids.includes('s_charge_2')
}

function isSlasherAdjacencyConflict(a, b) {
  const leftIsSlasher = a?.id === 's_military_3'
  const rightIsSlasher = b?.id === 's_military_3'
  if (!leftIsSlasher && !rightIsSlasher) return false
  const other = leftIsSlasher ? b : a
  return other?.type === '겁쟁이' || other?.type === '평범'
}

function canAddSurvivorToParty(party, survivor) {
  if (!survivor) return false
  if (party.some((entry) => isCatDogConflict(entry, survivor))) return false
  const last = party[party.length - 1]
  if (last && isSlasherAdjacencyConflict(last, survivor)) return false
  return true
}

function canBeAttackTarget(player, survivor) {
  if (!survivor) return false
  if (survivor.id === 's_coward_4') return false
  return true
}

function getAttackTargetableSurvivors(player) {
  return (player?.party ?? []).filter((survivor) => canBeAttackTarget(player, survivor))
}

function canRecruitSurvivor(player, survivor) {
  if (survivor.type !== '평범') return true
  return !player.party.some((entry) => entry.id === 's_military_2')
}

function hasDoctorShieldAvailable(player) {
  return player.party.some((survivor) => survivor.id === 's_coward_2')
    && !player.turnFlags?.doctorShieldUsed
    && (player.resources?.can ?? 0) >= 3
}

function preventSingleSurvivorLoss(player, target, { reason }) {
  let nextPlayer = {
    ...player,
    party: [...player.party],
    graveyard: [...(player.graveyard ?? [])],
    turnFlags: { ...(player.turnFlags ?? {}) },
  }

  if (reason === 'attack_damage' && target?.id === 's_military_4') {
    return {
      player: nextPlayer,
      prevented: true,
      message: `${target.name} 효과: 공격으로 제거되지 않음`,
    }
  }

  if (reason === 'attack_damage' && (target?.id === 's_coward_1' || target?.id === 's_coward_6')) {
    const idx = nextPlayer.party.findIndex((sv) => sv.uid === target.uid)
    if (idx >= 0 && idx < nextPlayer.party.length - 1) {
      nextPlayer.party = [...nextPlayer.party.filter((sv) => sv.uid !== target.uid), target]
    }
    return { player: nextPlayer, prevented: true, message: `${target.emoji ?? ''} ${target.name} 효과: 제거되지 않고 파티 맨 뒤로 밀려남` }
  }

  if (reason === 'disaster_damage' && target?.id === 's_coward_3') {
    return { player: nextPlayer, prevented: true, canGain: 0, message: `🧪 ${target.name} 효과: 재난 면역` }
  }

  if (reason === 'disaster_damage' && target?.id === 's_coward_5') {
    return { player: nextPlayer, prevented: true, canGain: 2, message: `🌊 ${target.name} 효과: 재난 면역, 통조림 +2 획득` }
  }

  if (hasDoctorShieldAvailable(nextPlayer)) {
    nextPlayer.turnFlags.doctorShieldUsed = true
    nextPlayer.resources = { ...nextPlayer.resources, can: Math.max(0, nextPlayer.resources.can - 3) }
    return {
      player: nextPlayer,
      prevented: true,
      canGain: 0,
      message: `👨‍⚕️ 돌팔이 의사 효과: 🥫-3 소모, ${target?.name ?? '생존자'} 피해 무효화`,
    }
  }

  if ((reason === 'attack_damage' || reason === 'disaster_damage') && (target?.type === '겁쟁이' || target?.type === '평범')) {
    const slasher = nextPlayer.party.find((survivor) => survivor.id === 's_military_3' && survivor.uid !== target?.uid)
    if (slasher) {
      nextPlayer.party = nextPlayer.party.filter((survivor) => survivor.uid !== slasher.uid)
      nextPlayer.graveyard = [...nextPlayer.graveyard, slasher]
      return {
        player: nextPlayer,
        prevented: false,
        message: `슬래셔 무비 배우 효과: ${target?.name ?? '생존자'} 대신 ${slasher.name} 제거`,
      }
    }
  }

  if (target) {
    nextPlayer.party = nextPlayer.party.filter((survivor) => survivor.uid !== target.uid)
    nextPlayer.graveyard = [...nextPlayer.graveyard, target]
  }

  return { player: nextPlayer, prevented: false, message: '' }
}

function tryBlockAttackEvent(targetPlayer, event) {
  if (!isAttackEvent(event)) return { blocked: false, log: null, roll: null, successOn: null, icon: null, name: null, consumedUid: null }

  // successOn: 이하이면 방어 성공 (1~6). 6 = 항상 성공 (자동)
  const blockers = []

  for (let index = 0; index < targetPlayer.party.length; index += 1) {
    const survivor = targetPlayer.party[index]
    const blocker = blockers.find((entry) => entry.match(survivor, index))
    if (!blocker) continue

    const auto = blocker.successOn === 6
    const roll = auto ? null : rollD6()
    const success = auto || roll <= blocker.successOn
    const rollText = auto ? '자동' : `🎲${roll} (${blocker.successOn}이하 성공)`
    const resultText = success ? '방어 성공' : '방어 실패'
    const log = `${blocker.icon} ${blocker.name} ${rollText} → ${resultText}`

    if (success) {
      return {
        blocked: true,
        icon: blocker.icon,
        name: blocker.name,
        message: log,
        log,
        roll,
        successOn: auto ? null : blocker.successOn,
        consumedUid: blocker.consumedOnSuccess ? survivor.uid : null,
      }
    }
    return { blocked: false, icon: blocker.icon, name: blocker.name, log, roll, successOn: auto ? null : blocker.successOn, consumedUid: null }
  }

  return { blocked: false, log: null, roll: null, successOn: null, icon: null, name: null, consumedUid: null }
}

function getDisasterDefenseResult(player) {
  const veteran = player.party.find((survivor) => survivor.id === 's_military_1')
  if (veteran) {
    // 숙련된 생존자: 자동으로 최저 점수 파티원을 희생시켜 재난 방어 (주사위 없음)
    const others = player.party.filter((sv) => sv.uid !== veteran.uid)
    const weakestMember = others.length > 0
      ? [...others].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
      : veteran
    return {
      prevented: 1,
      sacrificedUid: weakestMember.uid,
      log: `💂 숙련된 생존자 효과: ${weakestMember.name} 희생 → 재난 방어 성공`,
      dicePopup: null,
    }
  }

  return { prevented: 0, sacrificedUid: null, log: null, dicePopup: null }
}

function isAttackEvent(event) {
  return event?.category === 'attack'
}

function applyConsumedAttackBlocker(player, blockResult) {
  if (!blockResult?.consumedUid) return player
  const blocker = player.party.find((survivor) => survivor.uid === blockResult.consumedUid)
  if (!blocker) return player
  return {
    ...player,
    party: player.party.filter((survivor) => survivor.uid !== blockResult.consumedUid),
    graveyard: [...(player.graveyard ?? []), blocker],
  }
}

function applyRewardToPlayer(player, reward, sourceDeck = []) {
  const rewards = Array.isArray(reward) ? reward : [reward]
  const nextPlayer = {
    ...player,
    resources: { ...player.resources },
    party: [...player.party],
    survivorActivity: { ...(player.survivorActivity ?? {}) },
  }
  let survivorDeck = [...sourceDeck]
  const logs = []

  rewards.forEach((entry) => {
    if (!entry) return

    if (entry.type === 'cap') nextPlayer.resources.bottleCap += entry.amount
    if (entry.type === 'can') nextPlayer.resources.can += entry.amount
    if (entry.type === 'score') nextPlayer.scoreTokens = (nextPlayer.scoreTokens ?? 0) + entry.amount
    if (entry.type === 'survivor') {
      let remaining = entry.amount ?? 1
      while (remaining > 0 && survivorDeck.length > 0) {
        const survivor = survivorDeck[0]
        const applied = addSurvivorToParty(nextPlayer.party, survivor, nextPlayer.maxPartySize)
        if (!applied.added) break
        survivorDeck.shift()
        nextPlayer.party = applied.party
        nextPlayer.survivorActivity = {
          ...(nextPlayer.survivorActivity ?? {}),
          [survivor.uid]: false,
        }
        logs.push(`🤝 조우 보상: ${survivor.emoji} ${survivor.name}${applied.stacked ? ' (쌍둥이 겹침)' : ''} 합류`)
        remaining -= 1
      }
    }

    if (entry.bonus) {
      const bonusApplied = applyRewardToPlayer(nextPlayer, entry.bonus, survivorDeck)
      nextPlayer.resources = bonusApplied.player.resources
      nextPlayer.party = bonusApplied.player.party
      nextPlayer.scoreTokens = bonusApplied.player.scoreTokens
      survivorDeck = bonusApplied.survivorDeck
      logs.push(...bonusApplied.logs)
    }
  })

  return { player: clampPlayerResources(nextPlayer), survivorDeck, logs }
}

function findWeakestSurvivor(party = []) {
  return [...party].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0] ?? null
}

function findBestLeaderStealTarget(players = [], currentPlayerIndex = 0) {
  const current = players[currentPlayerIndex]
  const candidates = []
  players.forEach((player, playerIndex) => {
    if (playerIndex === currentPlayerIndex) return
    ;(player.party ?? []).forEach((survivor) => {
      if (addSurvivorToParty(current.party ?? [], survivor, current.maxPartySize).added) {
        candidates.push({ playerIndex, survivor })
      }
    })
  })
  return candidates.sort((a, b) => (b.survivor.score ?? 0) - (a.survivor.score ?? 0))[0] ?? null
}

function getScoringSurvivorCount(player) {
  return (player.party?.length ?? 0) + (player.leaderFans?.length ?? 0)
}

function getTotalResolvedClues(players) {
  return players.reduce((sum, player) => sum + (player.clueTokens ?? 0), 0)
}

function calcLeaderEndBonus(player, players) {
  const canCount = player.resources?.can ?? 0
  const maxCanCount = Math.max(...players.map((entry) => entry.resources?.can ?? 0), 0)
  const isStrictMostCan =
    canCount > 0 &&
    canCount === maxCanCount &&
    players.filter((entry) => (entry.resources?.can ?? 0) === maxCanCount).length === 1
  const allCharge = player.party.length > 0 && player.party.every((survivor) => survivor.type === '용감이')
  const requiredRobotTypes = ['반장', '분위기메이커', '용감이', '4차원', '겁쟁이']
  const partyTypes = new Set(player.party.map((survivor) => survivor.type))
  const hasAllRobotTypes = requiredRobotTypes.every((type) => partyTypes.has(type))
  const weirdCount = player.party.filter((survivor) => survivor.type === '4차원').length
  const maxSurvivorCount = Math.max(...players.map((entry) => getScoringSurvivorCount(entry)), 0)
  const isStrictMostSurvivors =
    getScoringSurvivorCount(player) > 0 &&
    getScoringSurvivorCount(player) === maxSurvivorCount &&
    players.filter((entry) => getScoringSurvivorCount(entry) === maxSurvivorCount).length === 1

  const achievedByLeader = {
    shy: isStrictMostCan,
    zombie: allCharge,
    robot: hasAllRobotTypes,
    duck: weirdCount >= 3,
    idol: isStrictMostSurvivors,
  }
  const achieved = achievedByLeader[player.leaderId] ?? false

  return {
    score: achieved ? 3 : 0,
    achieved,
    label: player.specialWin?.name ?? '지도자 종료 조건',
    description: player.specialWin?.description ?? '미정',
  }
}

function calcFinalScoreBreakdown(player, players) {
  const party = calcPartyScore(player.party, player.leaderId)
  const leader = calcLeaderEndBonus(player, players)
  const eventScore = player.scoreTokens ?? 0
  const abandonedPenalty = player.abandonedEvents?.length ?? 0

  return {
    playerId: player.id,
    name: player.name,
    total: party.baseTotal + party.bonusTotal + eventScore + leader.score - abandonedPenalty,
    partyScore: party.baseTotal,
    partyBonusScore: party.bonusTotal,
    eventScore,
    abandonedPenalty,
    leaderEndScore: leader.score,
    leaderEndAchieved: leader.achieved,
    leaderEndLabel: leader.label,
    leaderEndDescription: leader.description,
    clueTokens: player.clueTokens ?? 0,
  }
}

function calcPlayerScore(player) {
  return (
    calcPartyScore(player.party, player.leaderId).total +
    (player.scoreTokens ?? 0) -
    (player.abandonedEvents?.length ?? 0)
  )
}

function clampPlayerResources(player) {
  const maxCan = player.maxResources?.can
  const maxBottleCap = player.maxResources?.bottleCap
  return {
    ...player,
    resources: {
      ...player.resources,
      can: Math.max(0, maxCan === undefined ? player.resources.can : Math.min(player.resources.can, maxCan)),
      bottleCap: Math.max(0, maxBottleCap === undefined ? player.resources.bottleCap : Math.min(player.resources.bottleCap, maxBottleCap)),
    },
  }
}

function getTurnEndResourcesForSurvivor(survivor, survivorIndex, party = []) {
  const base = {
    can: survivor.turnEndResources?.can ?? 0,
    bottleCap: survivor.turnEndResources?.bottleCap ?? DEFAULT_TURN_END_RESOURCES.bottleCap,
  }

  // 포지션 보너스 (turnEnd)
  if (survivor.positionBonus?.positions?.includes(survivorIndex) && survivor.positionBonus.turnEnd) {
    base.can += survivor.positionBonus.turnEnd.can ?? 0
    base.bottleCap += survivor.positionBonus.turnEnd.bottleCap ?? 0
  } else if (!survivor.positionBonus?.positions && survivor.positionBonus?.turnEnd) {
    base.can += survivor.positionBonus.turnEnd.can ?? 0
    base.bottleCap += survivor.positionBonus.turnEnd.bottleCap ?? 0
  }

  return base
}

function getTurnStartResourcesForSurvivor(survivor, survivorIndex) {
  const base = {
    can: survivor.turnStartResources?.can ?? DEFAULT_TURN_START_RESOURCES.can ?? 0,
    bottleCap: survivor.turnStartResources?.bottleCap ?? DEFAULT_TURN_START_RESOURCES.bottleCap,
  }

  if (survivorIndex === 0 && survivor.turnStartBonusIfFirst) {
    base.can += survivor.turnStartBonusIfFirst.can ?? 0
    base.bottleCap += survivor.turnStartBonusIfFirst.bottleCap ?? 0
  }

  // 포지션 보너스 (turnStart)
  if (survivor.positionBonus?.positions?.includes(survivorIndex) && survivor.positionBonus.turnStart) {
    base.can += survivor.positionBonus.turnStart.can ?? 0
    base.bottleCap += survivor.positionBonus.turnStart.bottleCap ?? 0
  } else if (!survivor.positionBonus?.positions && survivor.positionBonus?.turnStart) {
    base.can += survivor.positionBonus.turnStart.can ?? 0
    base.bottleCap += survivor.positionBonus.turnStart.bottleCap ?? 0
  }

  return base
}

function createActionEffect({ type, title, icon, targetName, detail }) {
  return { type, title, icon, targetName, detail }
}

function createGlobalActionEffect(event) {
  return createActionEffect({
    type: event.scope === 'disaster' ? 'disaster' : 'global',
    title: event.name,
    icon: event.emoji,
    targetName: event.scope === 'disaster' ? '모든 플레이어' : '전체 적용',
    detail: summarizeGlobalEffect(event.globalEffect),
  })
}

function summarizeGlobalEffect(effect) {
  if (!effect) return '효과 발생'
  if (effect.type === 'compound') {
    return effect.effects.map((entry) => summarizeGlobalEffect(entry)).join(' · ')
  }

  switch (effect.type) {
    case 'remove_all_n':
      return `전원 생존자 ${effect.amount}명 제거`
    case 'add_survivors_all':
      return `전원 생존자 ${effect.amount}명 합류`
    case 'shuffle_all_parties':
      return '전원 파티 순서 섞임'
    case 'lose_can_all':
      return `전원 통조림 ${effect.amount}개 감소`
    case 'lose_cap_all':
      return `전원 병뚜껑 ${effect.amount}개 감소`
    case 'gain_can_all':
      return `전원 통조림 ${effect.amount}개 획득`
    case 'halve_can_all':
      return '전원 통조림 절반 감소'
    default:
      return '전체 효과 발생'
  }
}
