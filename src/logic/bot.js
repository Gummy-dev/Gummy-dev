import { calcPartyScore } from './scoring.js'
import { RULES } from '../data/rules.js'
import { DEFAULT_TURN_END_RESOURCES } from '../data/survivors.js'
import { LEADERS } from '../data/leaders.js'
import { PLACEMENT_EFFECT_TYPES, getActivePlacementEffectsForParty, getPlacementEffectsForSlot } from '../data/placementBonuses.js'

const VALUE = {
  can: 0.28,
  bottleCap: 0.45,
  score: 1.6,
  key: 1.4,
  item: 1.2,
  treasure: 2.4,
  survivor: 2.3,
  abandoned: 2.8,
  upkeep: 1.0,
  revealSafety: 0.65,
  clue: 2.6,
  humanThreat: 0.8,
}

const BOT_EVENT_REPLACE_MARGIN = 1.25


function normalizeRewardEntries(reward) {
  if (!reward) return []
  return Array.isArray(reward) ? reward : [reward]
}

function hasRewardType(event, types = []) {
  const typeSet = new Set(types)
  return normalizeRewardEntries(event?.reward).some((entry) => typeSet.has(entry?.type))
}

function isKeyUnlockEvent(event) {
  return Boolean(
    event &&
    (event.requiresKey || event.resolution?.requiresKey) &&
    (event.resolution?.type === 'roll_dice' || event.resolution?.type === 'roll_dice_score_bonus') &&
    hasRewardType(event, ['item', 'treasure'])
  )
}

function canUseKeyToUnlock(player, event) {
  return isKeyUnlockEvent(event) && (player?.keyCards?.length ?? 0) > 0
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
    if (stackMatch) return stackMatch
  }

  const capybaraHost = party.find((entry) => entry.id === 's_mood_3')
  if (capybaraHost && ANIMAL_SURVIVOR_IDS.has(survivor.id)) {
    return capybaraHost
  }

  return null
}

function canStackOnExistingSlot(party = [], survivor) {
  return !!resolveStackHost(party, survivor)
}

function canBeAttackTarget(player, survivor) {
  if (!survivor) return false
  if (survivor.id === 's_coward_4') return false
  if (survivor.id === 's_coward_1') return (player?.party?.length ?? 0) <= 1
  return true
}

function getAttackTargetableSurvivors(player) {
  return (player?.party ?? []).filter((survivor) => canBeAttackTarget(player, survivor))
}

function isPlainSurvivor(survivor) {
  const normalizedName = String(survivor?.name ?? '').replace(/\s/g, '')
  return survivor?.id?.startsWith('s_plain_') || normalizedName === '평범생존자' || survivor?.type === '평범'
}

function getEffectiveBotSurvivorType(survivor, index, leaderId) {
  if (survivor?.id === 's_coward_6' && index === 0 && leaderId === 'zombie') return '용감이'
  if (isPlainSurvivor(survivor) && index === 0 && leaderId === 'robot') return '반장'
  return survivor?.type
}

function getBotPlacementEffectsByType(player, type) {
  return getActivePlacementEffectsForParty(player, getEffectiveBotSurvivorType)
    .filter(({ effect }) => effect.type === type)
}

function hasOnlyEffectiveBotSurvivorType(player, targetType) {
  const party = player?.party ?? []
  return party.length > 0 && party.every((survivor, index) => (
    getEffectiveBotSurvivorType(survivor, index, player.leaderId) === targetType
  ))
}

function canBotSurvivorActAsType(player, survivor, targetType, usedUids = new Set()) {
  if (!survivor || usedUids.has(survivor.uid)) return false
  const idx = player.party.indexOf(survivor)
  const effectiveType = getEffectiveBotSurvivorType(survivor, idx, player.leaderId)
  if (effectiveType === targetType) return true
  if (!hasOnlyEffectiveBotSurvivorType(player, '용감이')) return false
  return getBotPlacementEffectsByType(player, PLACEMENT_EFFECT_TYPES.BRAVE_WILDCARD)
    .some(({ survivor: wildcardSurvivor }) => wildcardSurvivor.uid === survivor.uid)
}

function isRequiredKeyEntry(entry) {
  return entry?.type === 'key' || entry?.type === '열쇠'
}

function getRequiredKeyCountForBot(event) {
  return getRequiredPartyTypesForBot(event)
    .filter(isRequiredKeyEntry)
    .reduce((sum, entry) => sum + (entry.count ?? 1), 0)
}

function getRequiredSurvivorTypesForBot(event) {
  return getRequiredPartyTypesForBot(event).filter((entry) => !isRequiredKeyEntry(entry))
}

function canBotSatisfyTypeRequirements(player, requiredTypes = [], candidates = []) {
  const usedUids = new Set()
  const survivorTypes = requiredTypes.filter((entry) => !isRequiredKeyEntry(entry))
  const expanded = survivorTypes.flatMap(({ type, count = 1 }) => Array.from({ length: count }, () => type))
  return expanded.every((type) => {
    const match = candidates.find((survivor) => canBotSurvivorActAsType(player, survivor, type, usedUids))
    if (!match) return false
    usedUids.add(match.uid)
    return true
  })
}

function countActiveEffectiveType(player, activeMembers, type) {
  const usedUids = new Set()
  return activeMembers.filter((survivor) => {
    const matched = canBotSurvivorActAsType(player, survivor, type, usedUids)
    if (matched) usedUids.add(survivor.uid)
    return matched
  }).length
}

function getSharedDepartedSurvivors(gameState) {
  const players = gameState?.players ?? []
  const extra = gameState?.departedSurvivors ?? []
  const merged = [...extra, ...players.flatMap((player) => player.graveyard ?? [])]
  const seen = new Set()
  return merged.filter((survivor) => {
    if (!survivor || seen.has(survivor.uid)) return false
    seen.add(survivor.uid)
    return true
  })
}

export function decideBotAction(player, gameState, availableSurvivors) {
  const upkeep = calcBotUpkeep(player)
  const canReserve = upkeep + 2
  const partyFull = getPartySlotCount(player.party) >= player.maxPartySize

  // 파티에 여유가 있을 때만 영입 시도
  if (!partyFull) {
    const canBuffer = player.resources.can - canReserve
    const recruit = pickRecruitAction(player, availableSurvivors, canBuffer, upkeep)
    if (recruit) return [recruit]
  }

  const reorder = findBestReorder(player)
  if (
    reorder &&
    reorder.gain > Math.max(0.75, calcReorderCost(player) * VALUE.bottleCap) &&
    player.resources.bottleCap >= calcReorderCost(player)
  ) {
    return [{ type: 'REORDER', from: reorder.from, to: reorder.to }]
  }

  return [{ type: 'SKIP', reason: '기대값이 높은 구매 행동 없음' }]
}

export function evaluateEvent(event, player, gameState) {
  if (!event || event.scope !== 'personal') {
    return { resolve: false, replace: false, score: -Infinity, reason: 'not personal' }
  }
  if (!canBotAttemptEvent(event, player)) {
    return { resolve: false, replace: false, score: -Infinity, reason: 'cannot assign required survivors' }
  }

  if (event.opponentRequirement && !getOpponents(gameState, player.id).some((opponent) => botTargetSatisfiesOpponentRequirement(opponent, event.opponentRequirement))) {
    return { resolve: false, replace: true, score: -Infinity, reason: 'no target satisfies opponent requirement' }
  }

  const score = scoreEvent(event, player, gameState)
  const pressure = getHumanPressure(player, gameState)
  const resolveThreshold = canUseKeyToUnlock(player, event) ? -Infinity : (pressure > 3 ? -0.45 : 0)
  const resolve = score >= resolveThreshold
  return {
    resolve,
    replace: !resolve && shouldBotReplaceEvent(event, player, score),
    score,
    reason: resolve ? 'expected value positive' : 'expected value too low',
  }
}

function shouldBotReplaceEvent(event, player, score) {
  if (event?.category === 'clue') return false
  return score < -(VALUE.abandoned + BOT_EVENT_REPLACE_MARGIN)
}

export function canBotAttemptEvent(event, player) {
  if (!event || !player) return false
  if ((event.requiresKey || event.resolution?.requiresKey) && (player.keyCards?.length ?? 0) <= 0) return false
  if ((player.keyCards?.length ?? 0) < getRequiredKeyCountForBot(event)) return false
  const requiredCount = canUseKeyToUnlock(player, event) ? 1 : getRequiredAssignmentCount(event)
  const activeMembers = getActivePartyMembers(player)
  if (activeMembers.length < requiredCount) return false

  const requiredTypes = getRequiredSurvivorTypesForBot(event)
  const hasRequiredTypes = canBotSatisfyTypeRequirements(player, requiredTypes, activeMembers)
  if (!hasRequiredTypes) return false

  if (event?.resolution?.type === 'check_survivor_type') {
    const usedUids = new Set()
    return activeMembers.some((survivor) => canBotSurvivorActAsType(player, survivor, event.resolution.survivorType, usedUids))
  }

  return true
}

export function shouldAcceptGlobalEvent(event) {
  return !!event && event.scope !== 'personal'
}

export function calcBotUpkeep(player) {
  const rawUpkeep = player.party.reduce((sum, survivor, index) => {
    const endDelta = getTurnEndCanDelta(survivor, index, player)
    return sum + Math.max(0, -endDelta)
  }, 0)
  // 지도자 패시브 통조림 수입으로 실질 유지비 감산
  const leader = LEADERS.find((l) => l.id === player.leaderId)
  const leaderCanIncome = leader?.passiveIncome?.can ?? 0
  return Math.max(0, rawUpkeep - leaderCanIncome)
}

export function findBestReorder(player) {
  return findBestPartySwap(player.party, player.leaderId, 'maximize')
}

export function findBestPartySwap(party, leaderId, mode = 'maximize') {
  if (!party || party.length < 2) return null

  const current = calcPartyScore(party, leaderId).total
  let best = null

  for (let i = 0; i < party.length - 1; i += 1) {
    for (let j = i + 1; j < party.length; j += 1) {
      const swapped = [...party]
      ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
      const score = calcPartyScore(swapped, leaderId).total
      const delta = score - current
      const gain = mode === 'minimize' ? -delta : delta
      if (!best || gain > best.gain) {
        best = { from: i, to: j, gain, delta, score }
      }
    }
  }

  return best
}

export function findBestTake(player, candidates) {
  if (!candidates?.length) return null

  let best = null
  let bestGain = -Infinity
  const currentValue = evaluatePlayerState(player)

  candidates.forEach((candidate) => {
    if (getPartySlotCount(player.party) >= player.maxPartySize && !canStackOnExistingSlot(player.party, candidate)) return
    const nextPlayer = { ...player, party: [...player.party, candidate] }
    const nextValue = evaluatePlayerState(nextPlayer)
    const gain = nextValue - currentValue + calcSurvivorUtility(candidate, player)
    if (gain > bestGain) {
      bestGain = gain
      best = candidate
    }
  })

  return best
}

export function chooseBotDiscardUids(player, count) {
  return [...player.party]
    .map((survivor) => ({
      uid: survivor.uid,
      value: getMemberRetentionValue(player, survivor.uid),
    }))
    .sort((a, b) => a.value - b.value)
    .slice(0, count)
    .map((entry) => entry.uid)
}

export function chooseBotSacrifice(player, amount = 1, survivorType = null) {
  return [...player.party]
    .filter((survivor) => {
      if (!survivorType) return true
      const idx = player.party.indexOf(survivor)
      return getEffectiveBotSurvivorType(survivor, idx, player.leaderId) === survivorType
    })
    .map((survivor) => ({
      uid: survivor.uid,
      value: getMemberRetentionValue(player, survivor.uid),
    }))
    .sort((a, b) => a.value - b.value)
    .slice(0, amount)
    .map((entry) => entry.uid)
}

function pickRecruitAction(player, available, canBuffer, upkeep = 0) {
  if (!available?.length) return null

  // 파티 유지비가 있고 통조림 여유가 적을 때만 임계값 상향 (파티 없는 초기 상태엔 적용 안 함)
  const canTight = upkeep > 0 && (canBuffer ?? 999) <= 2
  const usedPartySlots = getPartySlotCount(player.party)

  const candidates = available
    .filter((survivor) =>
      survivor &&
      (survivor.recruitCost ?? 0) <= player.resources.bottleCap &&
      (getPartySlotCount(player.party) < player.maxPartySize || canStackOnExistingSlot(player.party, survivor)) &&
      (!isPlainSurvivor(survivor) || !player.party.some((entry) => entry.id === 's_military_2'))
    )
    .map((survivor) => {
      const survivorUpkeep = Math.max(0, -(survivor.turnEndResources?.can ?? DEFAULT_TURN_END_RESOURCES.can))
      // 자원이 빡빡하고 유지비가 있는 생존자면 기준 1.5로 상향
      let threshold = canTight && survivorUpkeep > 0 ? 1.5 : 0.35
      if (usedPartySlots === 0) threshold = -0.4
      else if (usedPartySlots === 1) threshold = 0
      return { survivor, score: scoreRecruit(player, survivor), threshold }
    })
    .filter(({ score, threshold }) => score > threshold)
    .sort((a, b) => b.score - a.score)

  if (candidates.length) return { type: 'RECRUIT', survivorUid: candidates[0].survivor.uid }

  if (usedPartySlots === 0) {
    const starter = available
      .filter((survivor) =>
        survivor &&
        (survivor.recruitCost ?? 0) <= player.resources.bottleCap &&
        (!isPlainSurvivor(survivor) || !player.party.some((entry) => entry.id === 's_military_2'))
      )
      .map((survivor) => ({ survivor, score: scoreRecruit(player, survivor) }))
      .sort((a, b) => b.score - a.score)[0]
    if (starter) return { type: 'RECRUIT', survivorUid: starter.survivor.uid }
  }

  return null
}

function scoreRecruit(player, survivor) {
  const currentValue = evaluatePlayerState(player)
  let bestValue = -Infinity

  for (let index = 0; index <= player.party.length; index += 1) {
    const nextParty = [...player.party]
    nextParty.splice(index, 0, survivor)
    const nextPlayer = {
      ...player,
      party: nextParty,
      resources: {
        ...player.resources,
        bottleCap: player.resources.bottleCap - (survivor.recruitCost ?? 0),
      },
    }
    bestValue = Math.max(bestValue, evaluatePlayerState(nextPlayer))
  }

  return bestValue - currentValue + calcSurvivorUtility(survivor, player)
}

function scoreEvent(event, player, gameState) {
  const resolution = event.resolution ?? {}
  const rewardValue = getRewardValue(event.reward, player)
  const penaltyValue = getPenaltyValue(event.failPenalty, player)
  const abandonValue = -VALUE.abandoned
  if (canUseKeyToUnlock(player, event)) {
    return rewardValue - VALUE.key + 0.35
  }
  const opponents = getOpponents(gameState, player.id)
  const pressure = getHumanPressure(player, gameState)
  const comebackScoreBonus = Math.min(1.25, Math.max(0, pressure) * 0.12)

  switch (resolution.type) {
    case 'pay_cap': {
      const cost = (resolution.amount ?? 0) * VALUE.bottleCap
      if (player.resources.bottleCap < (resolution.amount ?? 0)) return abandonValue - 0.5
      if (resolution.then) {
        const followUp = scoreEvent(
          { ...event, resolution: { type: resolution.then, amount: resolution.amount, survivorType: resolution.survivorType } },
          {
            ...player,
            resources: { ...player.resources, bottleCap: player.resources.bottleCap - (resolution.amount ?? 0) },
          },
          gameState
        )
        return followUp - cost
      }
      return rewardValue - cost
    }
    case 'pay_can': {
      const costAmount = resolution.amount ?? 0
      const canFloor = calcBotUpkeep(player) + VALUE.revealSafety
      if (player.resources.can < costAmount) return abandonValue - 0.5
      if (player.resources.can - costAmount < canFloor && !resolution.then) {
        return rewardValue - penaltyValue - costAmount * VALUE.can - 1
      }
      const cost = costAmount * VALUE.can
      if (resolution.then) {
        const followUp = scoreEvent(
          { ...event, resolution: { type: resolution.then, amount: resolution.amount, survivorType: resolution.survivorType } },
          {
            ...player,
            resources: { ...player.resources, can: player.resources.can - costAmount },
          },
          gameState
        )
        return followUp - cost
      }
      return rewardValue - cost
    }
    case 'resource_delta': {
      const amount = resolution.amount ?? 0
      const resourceValue = resolution.resource === 'bottleCap' ? VALUE.bottleCap : VALUE.can
      const resourceCount = player.resources?.[resolution.resource] ?? 0
      if (amount < 0 && resourceCount < Math.abs(amount)) return abandonValue - 0.5
      return rewardValue + amount * resourceValue
    }
    case 'survivor_delta': {
      const amount = resolution.amount ?? 0
      if (amount > 0) {
        const openSlots = Math.max(0, (player.maxPartySize ?? RULES.maxPartySize) - getPartySlotCount(player.party))
        if (openSlots <= 0) return abandonValue - 0.25
        return rewardValue + Math.min(amount, openSlots) * VALUE.survivor
      }
      const count = Math.abs(amount)
      if (player.party.length < count) return abandonValue - 1
      return rewardValue - sumLowestRetention(player, count)
    }
    case 'survivor_type_delta': {
      const amount = resolution.amount ?? 0
      if (amount > 0) {
        const openSlots = Math.max(0, (player.maxPartySize ?? RULES.maxPartySize) - getPartySlotCount(player.party))
        if (openSlots <= 0) return abandonValue - 0.25
        return rewardValue + Math.min(amount, openSlots) * (VALUE.survivor + 0.25)
      }
      const count = Math.abs(amount)
      const candidates = player.party.filter((survivor) => canBotSurvivorActAsType(player, survivor, resolution.survivorType))
      if (candidates.length < count) return abandonValue - 1
      const loss = [...candidates]
        .sort((a, b) => calcSurvivorUtility(a, player) - calcSurvivorUtility(b, player))
        .slice(0, count)
        .reduce((sum, survivor) => sum + calcSurvivorUtility(survivor, player), 0)
      return rewardValue - loss
    }
    case 'deactivate_survivor': {
      const activeCount = getActivePartyMembers(player).length
      const amount = Math.max(1, resolution.amount ?? 1)
      if (activeCount < amount) return abandonValue - 0.5
      return rewardValue - 0.45 * amount
    }
    case 'deactivate_survivor_type': {
      const candidates = getActivePartyMembers(player).filter((survivor) => canBotSurvivorActAsType(player, survivor, resolution.survivorType))
      const amount = Math.max(1, resolution.amount ?? 1)
      if (candidates.length < amount) return abandonValue - 0.5
      return rewardValue - 0.55 * amount
    }
    case 'check_survivor_type': {
      const hasType = player.party.some((survivor) => canBotSurvivorActAsType(player, survivor, resolution.survivorType))
      if (hasType) return rewardValue
      return rewardValue - penaltyValue
    }
    case 'check_survivors_n':
      return (player.party.length >= (resolution.amount ?? 0) ? rewardValue : rewardValue - penaltyValue)
    case 'remove_random': {
      if (!player.party.length) return abandonValue - 1
      const loss = getAverageRetentionLoss(player)
      return rewardValue - loss
    }
    case 'remove_choice': {
      const amount = resolution.amount ?? 1
      if (player.party.length < amount) return abandonValue - 1
      const loss = sumLowestRetention(player, amount)
      return rewardValue - loss
    }
    case 'send_survivor_type': {
      const picks = chooseBotSacrifice(player, 1, resolution.survivorType)
      if (!picks.length || !opponents.length) return abandonValue - 0.5
      return rewardValue - sumRetentionByUids(player, picks)
    }
    case 'send_survivors_n': {
      const amount = resolution.amount ?? 1
      const picks = chooseBotSacrifice(player, amount)
      if (picks.length < amount || !opponents.length) return abandonValue - 0.5
      return rewardValue - sumRetentionByUids(player, picks)
    }
    case 'steal_can_from_player': {
      const target = opponents
        .map((opponent, index) => ({ opponent, index, gain: Math.min(opponent.resources?.can ?? 0, resolution.amount ?? 1) }))
        .sort((a, b) => b.gain - a.gain)[0]
      if (!target || target.gain <= 0) return abandonValue - 0.5
      return target.gain * VALUE.can + getHumanTargetBonus({ player: target.opponent, index: target.index })
    }
    case 'steal_cap_from_player': {
      const target = opponents
        .map((opponent, index) => ({ opponent, index, gain: Math.min(opponent.resources?.bottleCap ?? 0, resolution.amount ?? 1) }))
        .sort((a, b) => b.gain - a.gain)[0]
      if (!target || target.gain <= 0) return abandonValue - 0.5
      return target.gain * VALUE.bottleCap + getHumanTargetBonus({ player: target.opponent, index: target.index })
    }
    case 'steal_can_from_all_others': {
      const total = opponents.reduce((sum, opponent) => sum + Math.min(opponent.resources?.can ?? 0, resolution.amount ?? 1), 0)
      return total > 0 ? total * VALUE.can : abandonValue - 0.25
    }
    case 'steal_cap_from_all_others': {
      const total = opponents.reduce((sum, opponent) => sum + Math.min(opponent.resources?.bottleCap ?? 0, resolution.amount ?? 1), 0)
      return total > 0 ? total * VALUE.bottleCap : abandonValue - 0.25
    }
    case 'deactivate_from_party': {
      const target = getBestTargetForRemoval(opponents)
      if (!target) return abandonValue - 0.5
      return target.gain * 0.45 + rewardValue + getHumanTargetBonus(target)
    }
    case 'return_survivor_to_deck': {
      const target = getBestTargetForRemoval(opponents)
      if (!target) return abandonValue - 0.5
      return target.gain * 0.75 + rewardValue + getHumanTargetBonus(target)
    }
    case 'deactivate_type_all_others': {
      const survivorType = resolution.survivorType
      const gain = opponents.reduce((sum, opponent) => {
        const targetGain = (opponent.party ?? []).reduce((inner, survivor, index) => {
          if (getEffectiveBotSurvivorType(survivor, index, opponent.leaderId) !== survivorType) return inner
          return inner + ((survivor.score ?? 1) * 0.35 + 0.4)
        }, 0)
        return sum + targetGain * getThreatWeight(opponent)
      }, 0)
      return gain > 0 ? gain + rewardValue : abandonValue - 0.25
    }
    case 'take_from_party': {
      const target = getBestTargetForTake(player, opponents)
      if (!target) return abandonValue - 0.5
      return target.gain + rewardValue + getHumanTargetBonus(target)
    }
    case 'remove_from_party': {
      const target = getBestTargetForRemoval(opponents)
      if (!target) return abandonValue - 0.5
      return target.gain * 0.9 + rewardValue + getHumanTargetBonus(target)
    }
    case 'reorder_my_party': {
      const reorder = findBestReorder(player)
      return (reorder?.gain ?? 0) + rewardValue
    }
    case 'reorder_other_party': {
      const target = getBestTargetForBadSwap(opponents)
      if (!target) return abandonValue - 0.5
      return target.gain * 0.75 + rewardValue + getHumanTargetBonus(target)
    }
    case 'revive_from_grave': {
      const departed = getSharedDepartedSurvivors(gameState)
      if (getPartySlotCount(player.party) >= player.maxPartySize || departed.length === 0) return abandonValue - 0.5
      const best = [...departed]
        .map((survivor) => getReviveValue(player, survivor))
        .sort((a, b) => b - a)[0]
      return (best ?? 0) + rewardValue
    }
    case 'steal_from_grave': {
      const target = getBestTargetForGraveSteal(player, gameState)
      if (!target) return abandonValue - 0.5
      return target.gain + rewardValue
    }
    case 'trade_offer': {
      const giveResource = resolution.give?.resource === 'bottleCap' ? 'bottleCap' : 'can'
      const receiveResource = resolution.receive?.resource === 'bottleCap' ? 'bottleCap' : 'can'
      const giveValue = giveResource === 'bottleCap' ? VALUE.bottleCap : VALUE.can
      const receiveValue = receiveResource === 'bottleCap' ? VALUE.bottleCap : VALUE.can
      const hasTradePartner = opponents.some((opponent) => (opponent.resources?.[receiveResource] ?? 0) >= (resolution.receive?.amount ?? 2))
      if (!hasTradePartner || (player.resources?.[giveResource] ?? 0) < (resolution.give?.amount ?? 2)) return abandonValue - 0.5
      return receiveValue * ((resolution.receive?.amount ?? 2) + (resolution.receive?.bonus ?? 1)) -
        giveValue * (resolution.give?.amount ?? 2) + 0.35
    }
    case 'shared_distribution':
      return VALUE.can * (resolution.currentAmount ?? 3) + 0.25
    case 'shared_dispatch_reward': {
      const hasPartner = opponents.some((opponent) => getActivePartyMembers(opponent).length > 0)
      if (!hasPartner) return abandonValue - 0.5
      const resourceValue = resolution.resource === 'can' ? VALUE.can : VALUE.bottleCap
      return resourceValue * (resolution.currentAmount ?? 3) - 0.15
    }
    case 'support_roll_dice': {
      const activeCount = getActivePartyMembers(player).length
      const assignedCount = event.assignment?.minSurvivors ?? 2
      const hasSupporter = opponents.some((opponent) => getActivePartyMembers(opponent).length > 0)
      const diceCount = assignedCount + (hasSupporter ? 1 : 0)
      const successRate = getDiceSuccessRate(Math.min(diceCount, activeCount + 1), resolution.target ?? 8)
      return (VALUE.bottleCap * 3 * successRate) - (hasSupporter ? 0.1 : 0.8)
    }
    case 'resource_duel': {
      const bestTarget = opponents
        .filter((opponent) => (opponent.resources?.bottleCap ?? 0) > 0)
        .sort((a, b) => (b.resources?.bottleCap ?? 0) - (a.resources?.bottleCap ?? 0))[0]
      if (!bestTarget) return abandonValue - 0.5
      const assignedCount = event.assignment?.minSurvivors ?? 2
      const targetCanAccept = getActivePartyMembers(bestTarget).length >= assignedCount
      if (!targetCanAccept) return VALUE.bottleCap * (resolution.declineCost ?? 1)
      return VALUE.bottleCap * (resolution.amount ?? 2) * 0.15
    }
    case 'rich_cap_raid': {
      const richest = opponents.sort((a, b) => (b.resources?.bottleCap ?? 0) - (a.resources?.bottleCap ?? 0))[0]
      if (!richest || (richest.resources?.bottleCap ?? 0) <= 0) return abandonValue - 0.5
      return VALUE.bottleCap * Math.min(richest.resources.bottleCap, resolution.amount ?? 3) + 0.5
    }
    case 'roll_dice': {
      const activeCount = getActivePartyMembers(player).length
      const diceCount = getRecommendedDiceAssignmentCount(event, activeCount)
      const threshold = (resolution.target ?? 0) - getPotentialRecommendedPartyBonus(event, player)
      const successRate = getDiceSuccessRate(diceCount, threshold)
      // 단서 카드는 성공 시 clue 토큰 추가 획득 → 높은 가치
      const clueBonus = event.category === 'clue' ? VALUE.clue : 0
      const scoreRaceBonus = event.reward
        ? getRewardScoreAmount(event.reward) * comebackScoreBonus
        : 0
      return ((rewardValue + clueBonus + scoreRaceBonus) * successRate) - (penaltyValue * (1 - successRate))
    }
    case 'global_effect':
      return scoreGlobalEffect(event.globalEffect, player, gameState)
    default:
      return rewardValue - penaltyValue
  }
}

function getRequiredPartyTypesForBot(event) {
  return event?.requiredTypes
    ?? (event?.requiredType ? [{ type: event.requiredType, count: 1 }] : [])
}

function getRequiredTypeSlotCountForBot(event) {
  const requiredPartyTypeCount = getRequiredSurvivorTypesForBot(event)
    .flatMap(({ type, count = 1 }) => Array.from({ length: count }, () => type))
    .length
  const requiredAssignedTypeCount = event?.resolution?.type === 'check_survivor_type' ? 1 : 0
  return Math.max(requiredPartyTypeCount, requiredAssignedTypeCount)
}

function getRequiredAssignmentCount(event) {
  const baseRequired = event?.assignment?.minSurvivors != null
    ? event.assignment.minSurvivors
    : (RULES.exploration?.tiers?.[event?.tier ?? 1]?.minAssigned ?? 1)
  return Math.max(baseRequired, getRequiredTypeSlotCountForBot(event))
}

function getRecommendedDiceAssignmentCount(event, activeCount) {
  if (event?.resolution?.type !== 'roll_dice') return getRequiredAssignmentCount(event)
  const required = getRequiredAssignmentCount(event)
  if (required <= 0) return 0
  const target = event.resolution?.target ?? 4
  return Math.max(required, Math.min(activeCount, Math.ceil(target / 3.5)))
}

function getPotentialRecommendedPartyBonus(event, player, assignedSurvivors = null) {
  const recommended = event?.recommendedParty ?? []
  const requiredTypes = recommended.flatMap(({ type, count = 1 }) => Array.from({ length: count }, () => type))
  if (requiredTypes.length === 0) return 0

  const active = assignedSurvivors ?? getActivePartyMembers(player)
  const usedByUid = new Set()
  const matches = []

  for (const type of requiredTypes) {
    const match = active
      .filter((survivor) => canBotSurvivorActAsType(player, survivor, type, usedByUid))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
    if (!match) return 0
    usedByUid.add(match.uid)
    matches.push(match)
  }

  const matchedScore = matches.reduce((scoreSum, survivor) => scoreSum + (survivor.score ?? 0), 0)
  const placementBonus = getBotPlacementEffectsByType(player, PLACEMENT_EFFECT_TYPES.EXPLORATION_TYPE_BONUS)
    .reduce((sum, { effect }) => sum + (effect.amount ?? 0), 0)
  return matchedScore + placementBonus
}

function getActivePartyMembers(player) {
  return (player?.party ?? []).filter((survivor) => player?.survivorActivity?.[survivor.uid] !== false)
}

function scoreGlobalEffect(effect, player, gameState) {
  if (!effect) return -VALUE.abandoned
  const opponents = getOpponents(gameState, player.id)
  const human = getHumanOpponent(gameState, player.id)

  switch (effect.type) {
    case 'gain_can_all':
      return human ? -(effect.amount ?? 0) * VALUE.can * 0.25 : (effect.amount ?? 0) * VALUE.can * 0.35
    case 'add_survivors_all': {
      const selfGain = getPartySlotCount(player.party) < player.maxPartySize ? VALUE.survivor * 0.65 : -0.35
      const opponentGain = opponents.reduce((sum, opponent) => {
        const weight = opponent.index === 0 ? 0.65 : 0.15
        return sum + (getPartySlotCount(opponent.party) < opponent.maxPartySize ? VALUE.survivor * weight : 0)
      }, 0)
      return selfGain - opponentGain
    }
    case 'lose_cap_all': {
      const selfLoss = Math.min(player.resources.bottleCap ?? 0, effect.amount ?? 0) * VALUE.bottleCap
      const opponentLoss = opponents.reduce((sum, opponent) => {
        const weight = opponent.index === 0 ? 1.0 : 0.55
        return sum + Math.min(opponent.resources.bottleCap ?? 0, effect.amount ?? 0) * VALUE.bottleCap * weight
      }, 0)
      return opponentLoss - selfLoss
    }
    default:
      return -VALUE.abandoned
  }
}

function evaluatePlayerState(player) {
  const party = calcPartyScore(player.party, player.leaderId)
  return (
    party.total +
    (player.scoreTokens ?? 0) * VALUE.score -
    (player.abandonedEvents?.length ?? 0) * VALUE.abandoned -
    calcBotUpkeep(player) * VALUE.upkeep +
    (player.clueTokens ?? 0) * VALUE.clue +
    (player.keyCards?.length ?? 0) * VALUE.key +
    (player.treasureCards ?? []).reduce((sum, card) => sum + (card.score ?? 0), 0) * VALUE.score +
    getLeaderEndBonusEstimate(player) +
    (player.resources.can ?? 0) * VALUE.can +
    (player.resources.bottleCap ?? 0) * VALUE.bottleCap
  )
}

function getRewardValue(reward, player) {
  const rewards = Array.isArray(reward) ? reward : reward ? [reward] : []
  return rewards.reduce((sum, entry) => {
    if (!entry) return sum
    if (entry.type === 'can') return sum + (entry.amount ?? 0) * VALUE.can
    if (entry.type === 'cap') return sum + (entry.amount ?? 0) * VALUE.bottleCap
    if (entry.type === 'score') return sum + (entry.amount ?? 0) * VALUE.score
    if (entry.type === 'key') return sum + (entry.amount ?? 1) * VALUE.key
    if (entry.type === 'item') return sum + (entry.amount ?? 1) * VALUE.item
    if (entry.type === 'treasure') return sum + (entry.amount ?? 1) * VALUE.treasure
    if (entry.type === 'survivor') {
      return sum + Math.min(entry.amount ?? 1, Math.max(0, player.maxPartySize - getPartySlotCount(player.party))) * VALUE.survivor
    }
    return sum
  }, 0)
}

function getPenaltyValue(penalty, player) {
  if (!penalty) return 0
  if (penalty.type === 'lose_can') return (penalty.amount ?? 0) * VALUE.can
  if (penalty.type === 'remove_random') return getAverageRetentionLoss(player) * (penalty.amount ?? 1)
  return VALUE.abandoned
}

function getRewardScoreAmount(reward) {
  const rewards = Array.isArray(reward) ? reward : reward ? [reward] : []
  return rewards.reduce((sum, entry) => sum + (entry?.type === 'score' ? entry.amount ?? 0 : 0), 0)
}

function getHumanTargetBonus(target) {
  return target?.playerIndex === 0 ? VALUE.humanThreat : 0
}

function getHumanOpponent(gameState, playerId) {
  return (gameState?.players ?? [])
    .map((player, index) => ({ ...player, index }))
    .find((player) => player.id !== playerId && player.index === 0)
}

function getHumanPressure(player, gameState) {
  const human = getHumanOpponent(gameState, player.id)
  if (!human) return 0
  return estimateFinalScore(human) - estimateFinalScore(player)
}

function estimateFinalScore(player) {
  const party = calcPartyScore(player.party ?? [], player.leaderId)
  return (
    party.total +
    (player.scoreTokens ?? 0) -
    (player.abandonedEvents?.length ?? 0) +
    (player.treasureCards ?? []).reduce((sum, card) => sum + (card.score ?? 0), 0) +
    getLeaderEndBonusEstimate(player) +
    (player.clueTokens ?? 0) * 0.6
  )
}

function getLeaderEndBonusEstimate(player) {
  if (!player) return 0
  const party = player.party ?? []
  if (player.leaderId === 'zombie' && party.length > 0 && party.every((survivor) => survivor.type === '용감이')) return 2.4
  if (player.leaderId === 'robot') {
    const types = new Set(party.map((survivor) => survivor.type))
    return ['반장', '분위기메이커', '용감이', '4차원', '겁쟁이'].every((type) => types.has(type)) ? 2.4 : types.size * 0.25
  }
  if (player.leaderId === 'duck') {
    return Math.min(2.4, party.filter((survivor) => survivor.type === '4차원').length * 0.8)
  }
  if (player.leaderId === 'idol') return Math.min(2.4, party.length * 0.35)
  if (player.leaderId === 'shy') return Math.min(1.8, ((player.resources?.can ?? 0) + (player.resources?.bottleCap ?? 0)) * 0.08)
  return 0
}

function getThreatWeight(opponent) {
  return opponent?.index === 0 ? 1.35 : 1
}

function getAverageRetentionLoss(player) {
  if (!player.party.length) return 0
  const values = player.party.map((survivor) => getMemberRetentionValue(player, survivor.uid))
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sumLowestRetention(player, amount) {
  return [...player.party]
    .map((survivor) => getMemberRetentionValue(player, survivor.uid))
    .sort((a, b) => a - b)
    .slice(0, amount)
    .reduce((sum, value) => sum + value, 0)
}

function sumRetentionByUids(player, uids) {
  return uids.reduce((sum, uid) => sum + getMemberRetentionValue(player, uid), 0)
}

function getMemberRetentionValue(player, uid) {
  const currentValue = evaluatePlayerState(player)
  const nextPlayer = {
    ...player,
    party: player.party.filter((survivor) => survivor.uid !== uid),
  }
  return currentValue - evaluatePlayerState(nextPlayer)
}

function getReviveValue(player, survivor) {
  const currentValue = evaluatePlayerState(player)
  const nextPlayer = {
    ...player,
    party: [...player.party, survivor],
    graveyard: (player.graveyard ?? []).filter((entry) => entry.uid !== survivor.uid),
  }
  return evaluatePlayerState(nextPlayer) - currentValue
}

function getBestTargetForTake(player, opponents) {
  let best = null

  opponents.forEach((opponent) => {
    const candidate = findBestTake(player, getAttackTargetableSurvivors(opponent))
    if (!candidate) return
    const gain = (evaluatePlayerState({ ...player, party: [...player.party, candidate] }) - evaluatePlayerState(player)) * getThreatWeight(opponent)
    if (!best || gain > best.gain) {
      best = { playerIndex: opponent.index, survivorUid: candidate.uid, gain }
    }
  })

  return best
}

function getBestTargetForRemoval(opponents) {
  let best = null

  opponents.forEach((opponent) => {
    getAttackTargetableSurvivors(opponent).forEach((survivor) => {
      const before = evaluatePlayerState(opponent)
      const after = evaluatePlayerState({
        ...opponent,
        party: opponent.party.filter((entry) => entry.uid !== survivor.uid),
      })
      const gain = (before - after) * getThreatWeight(opponent)
      if (!best || gain > best.gain) {
        best = { playerIndex: opponent.index, survivorUid: survivor.uid, gain }
      }
    })
  })

  return best
}

function getBestTargetForBadSwap(opponents) {
  let best = null

  opponents.forEach((opponent) => {
    const targetable = getAttackTargetableSurvivors(opponent)
    const swap = findBestPartySwap(targetable, opponent.leaderId, 'minimize')
    if (!swap) return
    const weightedGain = swap.gain * getThreatWeight(opponent)
    if (!best || weightedGain > best.gain) {
      best = { playerIndex: opponent.index, ...swap, gain: weightedGain }
    }
  })

  return best
}

function getBestTargetForGraveSteal(player, gameState) {
  if (getPartySlotCount(player.party) >= player.maxPartySize) return null

  let best = null
  getSharedDepartedSurvivors(gameState).forEach((survivor) => {
    const gain = getReviveValue(player, survivor)
    if (!best || gain > best.gain) {
      best = { survivorUid: survivor.uid, gain }
    }
  })
  return best
}

function getOpponents(gameState, playerId) {
  return (gameState?.players ?? [])
    .map((player, index) => ({ ...player, index }))
    .filter((player) => player.id !== playerId)
}

function calcReorderCost(player) {
  const placementReduction = getActivePlacementEffectsForParty(player, getEffectiveBotSurvivorType)
    .filter(({ effect }) => effect.type === PLACEMENT_EFFECT_TYPES.REDUCE_REORDER_COST)
    .reduce((sum, { effect }) => sum + (effect.amount ?? 0), 0)
  const passiveReduction = player.party.reduce((sum, survivor) => {
    if (survivor.partyPassive?.type === 'reduce_reorder_cost') return sum + (survivor.partyPassive.amount ?? 0)
    return sum
  }, 0)
  return Math.max(0, RULES.partyReorderCost - placementReduction - passiveReduction)
}

function calcSurvivorUtility(survivor, player) {
  let bonus = 0
  const endCan = survivor.turnEndResources?.can ?? DEFAULT_TURN_END_RESOURCES.can

  if (survivor.partyPassive?.type === 'reduce_event_reveal_cost') {
    const alreadyHasReducer = player.party.some((entry) => entry.partyPassive?.type === 'reduce_event_reveal_cost')
    bonus += alreadyHasReducer ? 0.25 : 1.2
  }

  if (survivor.partyPassive?.type === 'reduce_reorder_cost') {
    bonus += 0.6 + (survivor.partyPassive.amount ?? 0) * 0.35
  }

  if (endCan >= 0) bonus += 1.1

  if (survivor.triggers?.some((trigger) => trigger.on === 'on_recruit' && trigger.effect === 'gain_can')) {
    const trigger = survivor.triggers.find((entry) => entry.on === 'on_recruit' && entry.effect === 'gain_can')
    bonus += (trigger?.amount ?? 0) * VALUE.can
  }

  // 지도자와 같은 타입이면 시너지 우선순위 가산
  const leader = LEADERS.find((l) => l.id === player.leaderId)
  if (leader && survivor.type === leader.type) {
    bonus += 1.0
  }

  return bonus
}

function getTurnEndCanDelta(survivor, survivorIndex, player = null) {
  let delta = survivor.turnEndResources?.can ?? DEFAULT_TURN_END_RESOURCES.can
  const effectiveType = player ? getEffectiveBotSurvivorType(survivor, survivorIndex, player.leaderId) : survivor.type
  const reduction = getPlacementEffectsForSlot(player?.leaderId, survivorIndex)
    .filter((effect) => effect.type === PLACEMENT_EFFECT_TYPES.REDUCE_REACTIVATION_COST && effect.survivorType === effectiveType)
    .reduce((sum, effect) => sum + (effect.amount ?? 0), 0)
  delta += reduction
  if (survivor.positionBonus?.positions?.includes(survivorIndex) && survivor.positionBonus.turnEnd) {
    delta += survivor.positionBonus.turnEnd.can ?? 0
  }
  return delta
}

function getDiceSuccessRate(diceCount, target) {
  if (target <= diceCount) return 1
  if (target > diceCount * 6) return 0

  const outcomes = []
  enumerateDice(diceCount, 0, outcomes)
  const success = outcomes.filter((sum) => sum >= target).length
  return success / outcomes.length
}

function enumerateDice(remaining, sum, outcomes) {
  if (remaining === 0) {
    outcomes.push(sum)
    return
  }
  for (let face = 1; face <= 6; face += 1) {
    enumerateDice(remaining - 1, sum + face, outcomes)
  }
}

// 내보내기 시 상태 개선이 되는 가장 적합한 파티원 uid 반환 (없으면 null)
export function findBotDismissTarget(player) {
  if (!player.party.length) return null
  const currentValue = evaluatePlayerState(player)
  let bestUid = null
  let bestGain = 0.4  // 임계값: 이 이상 개선되어야 내보내기 실행
  for (const survivor of player.party) {
    const reduced = { ...player, party: player.party.filter((sv) => sv.uid !== survivor.uid) }
    const gain = evaluatePlayerState(reduced) - currentValue
    if (gain > bestGain) {
      bestGain = gain
      bestUid = survivor.uid
    }
  }
  return bestUid
}
