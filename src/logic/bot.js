import { calcPartyScore } from './scoring.js'
import { RULES } from '../data/rules.js'
import { DEFAULT_TURN_END_RESOURCES } from '../data/survivors.js'

// 봇 행동 결정 — 랜덤 봇 (V1)
export function decideBotAction(player, gameState, availableSurvivors) {
  const actions = []

  // 1. 통조림이 부족하면 자원 확보 우선
  const canNeeded = player.party.reduce((sum, survivor) => {
    const canDelta = survivor.turnEndResources?.can ?? DEFAULT_TURN_END_RESOURCES.can
    return sum + Math.max(0, -canDelta)
  }, 0)
  if (player.resources.can < canNeeded + 2) {
    actions.push({ type: 'SKIP', reason: '자원 부족 — 이번 턴 영입 건너뜀' })
    return actions
  }

  // 2. 파티가 다 찼으면 순서 변경 시도
  if (player.party.length >= player.maxPartySize) {
    if (player.resources.bottleCap >= RULES.partyReorderCost) {
      const reorderAction = tryReorder(player)
      if (reorderAction) {
        actions.push(reorderAction)
        return actions
      }
    }
    actions.push({ type: 'SKIP', reason: '파티 풀 — 순서 조정 후 대기' })
    return actions
  }

  // 3. 병뚜껑이 있으면 생존자 영입
  const affordable = availableSurvivors.filter(
    (s) => (s.recruitCost ?? 0) <= player.resources.bottleCap
  )
  if (affordable.length > 0) {
    const picked = pickBestSurvivor(affordable, player)
    actions.push({ type: 'RECRUIT', survivorUid: picked.uid, reason: `${picked.name} 영입` })
    return actions
  }

  actions.push({ type: 'SKIP', reason: '병뚜껑 부족' })
  return actions
}

// 상성을 고려해 가장 점수가 높은 생존자 선택
function pickBestSurvivor(survivors, player) {
  let best = survivors[0]
  let bestScore = -Infinity

  survivors.forEach((s) => {
    const testParty = [...player.party, s]
    const { total } = calcPartyScore(testParty, player.leaderId)
    if (total > bestScore) {
      bestScore = total
      best = s
    }
  })

  return best
}

// 순서 변경 시 점수가 올라가는지 확인
function tryReorder(player) {
  const current = calcPartyScore(player.party, player.leaderId).total
  const party = [...player.party]

  for (let i = 0; i < party.length - 1; i++) {
    const swapped = [...party]
    ;[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]]
    const newScore = calcPartyScore(swapped, player.leaderId).total
    if (newScore > current) {
      return { type: 'REORDER', from: i, to: i + 1, reason: `순서 변경 (${i}↔${i + 1}), 점수 +${newScore - current}` }
    }
  }
  return null
}
