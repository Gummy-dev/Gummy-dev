const nestedRules = {
  party: {
    maxSize: 5,
    reorderCost: 2,
  },

  economy: {
    canPerSurvivorPerTurn: 1,
    capPerSurvivorPerTurn: 1,
    defaultReactivationCost: { can: 1 },
    exchange: {
      capToCanRate: 2, // 병뚜껑 1개 -> 통조림 2개
      canToCapRate: 3, // 통조림 3개 -> 병뚜껑 1개
    },
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
      1: 4,
      2: 4,
      3: 4,
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
  capToCanRate: nestedRules.economy.exchange.capToCanRate,
  canToCapRate: nestedRules.economy.exchange.canToCapRate,

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
