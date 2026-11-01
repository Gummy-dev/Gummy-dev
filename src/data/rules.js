const nestedRules = {
  party: {
    maxSize: 5,
    reorderCost: 2,
  },

  economy: {
    canPerSurvivorPerTurn: 1,
    capPerSurvivorPerTurn: 1,
    defaultReactivationCost: { can: 1 },
  },

  turn: {
    phases: ['action', 'party_maintenance'],
  },

  search: {
    slotCount: 1,
    slotCountByTier: {
      1: 1,
      2: 1,
      3: 1,
    },
    revealActionCost: 1,
    recruitStartsInactive: true,
    discardCanCost: 1,
    assignedSurvivorsRequired: 1,
  },

  exploration: {
    eventSlotCountByTier: {
      1: 3,
      2: 4,
      3: 3,
    },
    // Legacy alias for older UI/store helpers. Keep synced with eventSlotCountByTier.
    slotCountByTier: {
      1: 3,
      2: 4,
      3: 3,
    },
    revealCanCostByTier: { 1: 1, 2: 2, 3: 3 },
    tiers: {
      1: {
        label: '근처 탐색',
        color: 'light',
        minAssigned: 1,
        maxAssigned: 1,
      },
      2: {
        label: '외곽 탐색',
        color: 'mid',
        minAssigned: 2,
        maxAssigned: 3,
      },
      3: {
        label: '먼 곳 탐색',
        color: 'dark',
        minAssigned: 3,
        maxAssigned: 5,
      },
    },
  },

  clues: {
    legacyResolvedTarget: 5,
    copiesPerTierByPlayerCount: {
      2: 2,
      3: 3,
      4: 4,
      5: 4,
    },
    requiresOwnershipForTierAccess: true,
    assignedByTier: {
      1: { values: [2, 3] },
      2: { values: [3, 4] },
      3: { values: [5] },
    },
  },

  utopia: {
    cardCount: 5,
    revealOnFirstTier3Clue: true,
    restrictActionToUtopiaForTier3Players: true,
    finalRoundAfterClaim: true,
    minAssigned: 5,
  },

  scoring: {
    allNormalPartyBonus: 3,
  },

  bot: {
    thinkDelay: 900,
  },
}

// Backward-compatible flat aliases.
// Keep these until gameStore/components migrate to the nested structure.
export const RULES = {
  ...nestedRules,

  // 파티
  maxPartySize: nestedRules.party.maxSize,
  partyReorderCost: nestedRules.party.reorderCost,

  // 자원
  canPerSurvivorPerTurn: nestedRules.economy.canPerSurvivorPerTurn,
  capPerSurvivorPerTurn: nestedRules.economy.capPerSurvivorPerTurn,

  // 용병소 / 생존자 수색
  mercenaryDrawCount: Object.values(nestedRules.search.slotCountByTier).reduce((sum, count) => sum + count, 0),
  revealCost: nestedRules.search.revealActionCost,
  mercenaryDiscardCanCost: nestedRules.search.discardCanCost,

  // 이벤트 / 주변 탐색 (legacy)
  eventSlotCount: nestedRules.exploration.eventSlotCountByTier[1],
  eventRevealCost: nestedRules.exploration.revealActionCost,
  clueTarget: nestedRules.clues.legacyResolvedTarget,

  // 점수
  allNormalPartyBonus: nestedRules.scoring.allNormalPartyBonus,

  // 봇
  botThinkDelay: nestedRules.bot.thinkDelay,
}

export const SEARCH_RULES = RULES.search
export const EXPLORATION_RULES = RULES.exploration
export const UTOPIA_RULES = RULES.utopia

// 카드 텍스트에서 사용하는 기호 정의.
// RichText 컴포넌트가 이 토큰을 파싱해 실제 뱃지/아이콘으로 렌더링한다.
//
//  자원 이모지 (직접 삽입):
//    🪙  병뚜껑
//    🥫  통조림
//    🔍  단서
//    🎲  주사위
//
//  인라인 토큰 (중괄호 표기 → RichText가 처리):
//    {반}  반장 타입 뱃지
//    {용}  용감이 타입 뱃지
//    {분}  분위기메이커 타입 뱃지
//    {겁}  겁쟁이 타입 뱃지
//    {4}   4차원 타입 뱃지
//    {sv}      생존자 아이콘 (문장 내 인라인: 11px)
//    {dim}...{/dim}  회색 흐린 텍스트 (보조 설명용)
export const GAME_SYMBOLS = {
  can: '🥫',
  bottleCap: '🪙',
  clue: '🔍',
  dice: '🎲',
  typeTokens: {
    반: '반장',
    용: '용감이',
    분: '분위기메이커',
    겁: '겁쟁이',
    '4': '4차원',
  },
}
