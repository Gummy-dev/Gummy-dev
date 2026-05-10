import { RULES } from '../data/rules.js'

// 파티 점수 계산
// 인접 상성 점수는 폐기하고, 생존자 기본 점수와 명시적 조건 보너스만 계산합니다.
export function calcPartyScore(party, leaderId) {
  if (!party || party.length === 0) return { total: 0, baseTotal: 0, bonusTotal: 0, breakdown: [] }

  const breakdown = []
  let total = 0
  let baseTotal = 0
  let bonusTotal = 0

  party.forEach((survivor) => {
    const baseScore = survivor.score ?? 0
    total += baseScore
    baseTotal += baseScore
    breakdown.push({
      survivor,
      baseScore,
      adjacencyScore: 0,
      rowTotal: baseScore,
      details: [],
      edgeRight: 0,   // 이 슬롯과 오른쪽 슬롯 사이 엣지 값
    })
  })

  const allNormal = party.every((s) => s.type === '평범')
  if (allNormal && party.length > 0) {
    total += RULES.allNormalPartyBonus
    bonusTotal += RULES.allNormalPartyBonus
    breakdown.push({ specialBonus: `전원 평범 보너스 +${RULES.allNormalPartyBonus}` })
  }

  return { total, baseTotal, bonusTotal, breakdown }
}

// 이벤트 해결 점수 계산
export function calcEventScore(diceResults, party, event) {
  const diceSum = diceResults.reduce((a, b) => a + b, 0)

  return { diceSum, bonus: 0, total: diceSum }
}

// 주사위 굴리기
export function rollDice(count = 2, faces = 6) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1)
}
