import { AFFINITY_MATRIX, LEADER_ADJACENCY_BONUS } from '../data/survivors.js'
import { RULES } from '../data/rules.js'

// 파티 내 상성 점수 계산
export function calcPartyScore(party, leaderId) {
  if (!party || party.length === 0) return { total: 0, breakdown: [] }

  const leaderBonus = LEADER_ADJACENCY_BONUS[leaderId]
  const breakdown = []
  let total = 0

  party.forEach((survivor, i) => {
    const baseScore = survivor.score ?? 0
    let adjacencyScore = 0
    const details = []

    const left = party[i - 1]
    const right = party[i + 1]

    ;[left, right].forEach((neighbor) => {
      if (!neighbor) return
      const delta = AFFINITY_MATRIX[survivor.type]?.[neighbor.type] ?? 0
      if (delta !== 0) {
        adjacencyScore += delta
        details.push(`${neighbor.name}(${delta > 0 ? '+' : ''}${delta})`)
      }
    })

    // 지도자 인접 보너스
    let leaderBonusScore = 0
    if (leaderBonus && survivor.type === leaderBonus.type) {
      leaderBonusScore = leaderBonus.bonus
      details.push(`지도자 인접 +${leaderBonus.bonus}`)
    }

    const rowTotal = baseScore + adjacencyScore + leaderBonusScore
    total += rowTotal
    breakdown.push({
      survivor,
      baseScore,
      adjacencyScore,
      leaderBonusScore,
      rowTotal,
      details,
    })
  })

  // 전원 평범 보너스
  const allNormal = party.every((s) => s.type === '평범')
  if (allNormal && party.length > 0) {
    total += RULES.allNormalPartyBonus
    breakdown.push({ specialBonus: `전원 평범 보너스 +${RULES.allNormalPartyBonus}` })
  }

  return { total, breakdown }
}

// 이벤트 해결 점수 계산
export function calcEventScore(diceResults, party, event) {
  const diceSum = diceResults.reduce((a, b) => a + b, 0)

  let bonus = 0
  if (event.affinityBonus) {
    const types = event.affinityBonus.type.split('+')
    const hasAll = types.every((t) => party.some((s) => s.type === t || s.leaderId === t))
    if (hasAll) bonus += 3
  }

  return { diceSum, bonus, total: diceSum + bonus }
}

// 주사위 굴리기
export function rollDice(count = 2, faces = 6) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1)
}
