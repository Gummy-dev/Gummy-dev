import { calcPartyScore } from './scoring.js'
import { RULES } from '../data/rules.js'
import { DEFAULT_TURN_END_RESOURCES } from '../data/survivors.js'
import { LEADERS } from '../data/leaders.js'

const VALUE = {
  can: 0.28,
  bottleCap: 0.45,
  score: 1.6,
  survivor: 2.3,
  abandoned: 2.8,
  upkeep: 1.0,
  revealSafety: 0.65,
  clue: 2.6,
  humanThreat: 0.8,
}

const BOT_EVENT_REPLACE_MARGIN = 1.25

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
  const capReserve = partyFull ? 0 : 1

  if (player.resources.can < canReserve && player.resources.bottleCap >= 1) {
    return [{ type: 'EXCHANGE_CAP_TO_CAN' }]
  }

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

  const canSurplus = player.resources.can - canReserve
  if (
    canSurplus >= RULES.canToCapRate + 2 &&
    player.resources.bottleCap < capReserve + 2
  ) {
    return [{ type: 'EXCHANGE_CAN_TO_CAP' }]
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

  const score = scoreEvent(event, player, gameState)
  const pressure = getHumanPressure(player, gameState)
  const resolveThreshold = pressure > 3 ? -0.45 : 0
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
  if (hasCenterWeirdType(player)) return score < 0
  return score < -(VALUE.abandoned + BOT_EVENT_REPLACE_MARGIN)
}

export function canBotAttemptEvent(event, player) {
  if (!event || !player) return false
  const requiredCount = getRequiredAssignmentCount(event)
  const activeMembers = getActivePartyMembers(player)
  if (activeMembers.length < requiredCount) return false

  if (event?.resolution?.type === 'check_survivor_type') {
    return activeMembers.some((survivor) => survivor.type === event.resolution.survivorType)
  }

  return true
}

function hasCenterWeirdType(player) {
  return player?.party?.[2]?.type === '4차원'
}

export function shouldAcceptGlobalEvent(event) {
  return !!event && event.scope !== 'personal'
}

export function calcBotUpkeep(player) {
  const rawUpkeep = player.party.reduce((sum, survivor, index) => {
    const endDelta = getTurnEndCanDelta(survivor, index)
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
    .filter((survivor) => !survivorType || survivor.type === survivorType)
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
      (survivor.type !== '평범' || !player.party.some((entry) => entry.id === 's_military_2'))
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
        (survivor.type !== '평범' || !player.party.some((entry) => entry.id === 's_military_2'))
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
    case 'check_survivor_type': {
      const hasType = player.party.some((survivor) => survivor.type === resolution.survivorType)
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

function getRequiredAssignmentCount(event) {
  if (event?.resolution?.type === 'roll_dice') return 1
  if (event?.assignment?.minSurvivors) return event.assignment.minSurvivors
  const tier = event?.tier ?? 1
  return RULES.exploration?.tiers?.[tier]?.minAssigned ?? 1
}

function getRecommendedDiceAssignmentCount(event, activeCount) {
  if (event?.resolution?.type !== 'roll_dice') return getRequiredAssignmentCount(event)
  const target = event.resolution?.target ?? 4
  return Math.max(1, Math.min(5, activeCount, Math.ceil(target / 3.5)))
}

function getPotentialRecommendedPartyBonus(event, player) {
  const recommended = event?.recommendedParty ?? []
  if (recommended.length === 0) return 0
  const active = getActivePartyMembers(player)
  const hasAll = recommended.every(({ type, count = 1 }) => (
    active.filter((survivor) => survivor?.type === type).length >= count
  ))
  if (!hasAll) return 0
  const base = event.recommendedPartyBonus ?? event.resolution?.recommendedPartyBonus ?? event.check?.recommendedPartyBonus ?? 2
  const moodMakerBoost = player?.party?.[2]?.type === '분위기메이커' ? 1 : 0
  return base + moodMakerBoost
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
  const reduction = player.party.reduce((sum, survivor, index) => {
    if (survivor.type === '반장' && index <= 1) {
      sum += 1
    }
    if (survivor.partyPassive?.type === 'reduce_reorder_cost') {
      return sum + (survivor.partyPassive.amount ?? 0)
    }
    return sum
  }, 0)
  return Math.max(0, RULES.partyReorderCost - reduction)
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

function getTurnEndCanDelta(survivor, survivorIndex) {
  let delta = survivor.turnEndResources?.can ?? DEFAULT_TURN_END_RESOURCES.can
  if (survivor.type === '겁쟁이' && survivorIndex >= 3) {
    delta += 1
  }
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
