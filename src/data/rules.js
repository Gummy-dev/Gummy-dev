export const RULES = {
  // 파티
  maxPartySize: 5,
  partyReorderCost: 2,

  // 자원
  canPerSurvivorPerTurn: 1,
  capPerSurvivorPerTurn: 1,

  // 교환 비율 (구매 단계)
  capToCanRate: 2,           // 병뚜껑 1개 → 통조림 2개
  canToCapRate: 3,           // 통조림 3개 → 병뚜껑 1개

  // 용병소
  mercenaryDrawCount: 2,
  revealCost: 1,             // 용병소 카드 확인 비용 (병뚜껑)
  mercenaryDiscardCanCost: 1,

  // 이벤트
  eventSlotCount: 4,
  eventRevealCost: 1,        // 이벤트 카드 확인 비용 (통조림)

  // 점수
  allNormalPartyBonus: 3,

  // 봇
  botThinkDelay: 900,
}
