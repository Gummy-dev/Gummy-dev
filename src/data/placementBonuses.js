export const PLACEMENT_EFFECT_TYPES = {
  REDUCE_REORDER_COST: 'reduce_reorder_cost',
  EXPLORATION_TYPE_BONUS: 'exploration_type_bonus',
  REDUCE_SEARCH_DISCARD_COST: 'reduce_search_discard_cost',
  REDUCE_REACTIVATION_COST: 'reduce_reactivation_cost',
  TURN_START_RESOURCE: 'turn_start_resource',
  DISASTER_IMMUNITY: 'disaster_immunity',
  BRAVE_WILDCARD: 'brave_wildcard',
  REWARD_BONUS: 'reward_bonus',
  RECRUIT_COST_REDUCTION: 'recruit_cost_reduction',
  SEARCH_PEEK_BONUS: 'search_peek_bonus',
  EVENT_REPLACE_COST_REDUCTION: 'event_replace_cost_reduction',
  UTOPIA_DISCOVERY: 'utopia_discovery',
}

function effect(type, survivorType, label, detail, options = {}) {
  return { type, survivorType, label, detail, amount: 1, ...options }
}

const EFFECTS = {
  reorderCaptain: () => effect(PLACEMENT_EFFECT_TYPES.REDUCE_REORDER_COST, '반장', '반', '순서 변경 비용 🪙-1', { resource: 'bottleCap' }),
  braveExplore: () => effect(PLACEMENT_EFFECT_TYPES.EXPLORATION_TYPE_BONUS, '용감이', '용', '탐색 타입 보너스 +1'),
  moodSearch: () => effect(PLACEMENT_EFFECT_TYPES.REDUCE_SEARCH_DISCARD_COST, '분위기메이커', '분', '추가 수색(교체) 비용 🥫-1', { resource: 'can' }),
  cowardMeal: () => effect(PLACEMENT_EFFECT_TYPES.REDUCE_REACTIVATION_COST, '겁쟁이', '겁', '식사 제공 비용 🥫-1', { resource: 'can' }),
  weirdReplace: () => effect(PLACEMENT_EFFECT_TYPES.EVENT_REPLACE_COST_REDUCTION, '4차원', '4', '이벤트 교체 비용 🥫-1', { resource: 'can' }),
  weirdDisasterImmunity: () => effect(PLACEMENT_EFFECT_TYPES.DISASTER_IMMUNITY, '4차원', '4', '재난 면역'),
  weirdUtopiaDiscovery: () => effect(PLACEMENT_EFFECT_TYPES.UTOPIA_DISCOVERY, '4차원', '4', '파티 6인 전원:\n유토피아 발견'),
  braveWildcard: () => effect(PLACEMENT_EFFECT_TYPES.BRAVE_WILDCARD, '용감이', '용', '파티에 용감이만 존재:\n모든 타입으로 사용 가능'),
  canIncomeCoward: () => effect(PLACEMENT_EFFECT_TYPES.TURN_START_RESOURCE, '겁쟁이', '겁', '턴 시작 🥫+1', { resource: 'can' }),
  canIncomeMood: () => effect(PLACEMENT_EFFECT_TYPES.TURN_START_RESOURCE, '분위기메이커', '분', '턴 시작 🥫+1', { resource: 'can' }),
  capIncomeBrave: () => effect(PLACEMENT_EFFECT_TYPES.TURN_START_RESOURCE, '용감이', '용', '턴 시작 🪙+1', { resource: 'bottleCap' }),
  survivorRewardMood: () => effect(PLACEMENT_EFFECT_TYPES.REWARD_BONUS, '분위기메이커', '분', '생존자 보상 +1', { rewardType: 'survivor' }),
  recruitDiscountBrave: () => effect(PLACEMENT_EFFECT_TYPES.RECRUIT_COST_REDUCTION, '용감이', '용', '영입 비용 🪙-1', { resource: 'bottleCap' }),
  searchPeekMood: () => effect(PLACEMENT_EFFECT_TYPES.SEARCH_PEEK_BONUS, '분위기메이커', '분', '수색 후보 +1장'),
}

function zone(key, label, slots, effects) {
  return { key, label, slots, effects }
}

function getSlotPositionLabel(slotIndex) {
  if (slotIndex <= 1) return '앞쪽'
  if (slotIndex === 2) return '중앙'
  return '뒤쪽'
}

function singleSlotZones(effectFactories) {
  return effectFactories.map((makeEffect, index) => zone(`slot_${index + 1}`, getSlotPositionLabel(index), [index], [makeEffect()]))
}

const DEFAULT_PLACEMENT_PROFILE = {
  zones: [
    zone('front', '앞쪽', [0, 1], [EFFECTS.reorderCaptain(), EFFECTS.braveExplore()]),
    zone('center', '중앙', [2], [EFFECTS.moodSearch()]),
    zone('back', '뒤쪽', [3, 4], [EFFECTS.cowardMeal()]),
  ],
}

const ROBOT_PLACEMENT_PROFILE = {
  zones: singleSlotZones([
    EFFECTS.reorderCaptain,
    EFFECTS.braveExplore,
    EFFECTS.moodSearch,
    EFFECTS.weirdReplace,
    EFFECTS.cowardMeal,
  ]),
}

const ZOMBIE_PLACEMENT_PROFILE = {
  zones: [zone('all', '전 슬롯', [0, 1, 2, 3, 4], [EFFECTS.braveWildcard()])],
}

const DUCK_PLACEMENT_PROFILE = {
  zones: [
    zone('slots_1_to_5', '전 슬롯', [0, 1, 2, 3, 4], [EFFECTS.weirdDisasterImmunity()]),
    zone('slot_6', getSlotPositionLabel(5), [5], [EFFECTS.weirdUtopiaDiscovery()]),
  ],
}

const SHY_PLACEMENT_PROFILE = {
  zones: singleSlotZones([
    EFFECTS.cowardMeal,
    EFFECTS.canIncomeMood,
    EFFECTS.capIncomeBrave,
    EFFECTS.canIncomeCoward,
    EFFECTS.canIncomeCoward,
  ]),
}

const IDOL_PLACEMENT_PROFILE = {
  zones: singleSlotZones([
    EFFECTS.survivorRewardMood,
    EFFECTS.braveExplore,
    EFFECTS.cowardMeal,
    EFFECTS.recruitDiscountBrave,
    EFFECTS.searchPeekMood,
  ]),
}

export const LEADER_PLACEMENT_BONUS_PROFILES = {
  default: DEFAULT_PLACEMENT_PROFILE,
  robot: ROBOT_PLACEMENT_PROFILE,
  idol: IDOL_PLACEMENT_PROFILE,
  zombie: ZOMBIE_PLACEMENT_PROFILE,
  duck: DUCK_PLACEMENT_PROFILE,
  shy: SHY_PLACEMENT_PROFILE,
}

export function getLeaderPlacementProfile(leaderId) {
  return LEADER_PLACEMENT_BONUS_PROFILES[leaderId] ?? LEADER_PLACEMENT_BONUS_PROFILES.default
}

export function getPlacementZoneForSlot(leaderId, slotIndex) {
  return getLeaderPlacementProfile(leaderId).zones.find((zone) => zone.slots.includes(slotIndex)) ?? null
}

export function getPlacementEffectsForSlot(leaderId, slotIndex) {
  return getPlacementZoneForSlot(leaderId, slotIndex)?.effects ?? []
}

export function isPlacementEffectActive(effect, { effectiveType, slotIndex, leaderId }) {
  if (!effect) return false
  if (effect.survivorType && effect.survivorType !== effectiveType) return false
  const zone = getLeaderPlacementProfile(leaderId).zones.find((entry) => entry.effects.includes(effect))
  return zone ? zone.slots.includes(slotIndex) : false
}


export function getRequiredPlacementBonusSlots(leaderId) {
  const profile = getLeaderPlacementProfile(leaderId)
  const required = new Map()
  profile.zones.forEach((zone) => {
    zone.slots.forEach((slotIndex) => {
      const effects = zone.effects.filter((effect) => effect.survivorType)
      if (effects.length > 0) required.set(slotIndex, effects)
    })
  })
  return Array.from(required, ([slotIndex, effects]) => ({ slotIndex, effects }))
}

export function hasCompletedPlacementBonus(player, getEffectiveType) {
  const requirements = getRequiredPlacementBonusSlots(player?.leaderId)
  if (requirements.length === 0) return false
  const party = player?.party ?? []
  return requirements.every(({ slotIndex, effects }) => {
    const survivor = party.find((entry, index) => {
      const currentSlotIndex = Number.isInteger(entry?.partySlotIndex) ? entry.partySlotIndex : index
      return currentSlotIndex === slotIndex
    })
    if (!survivor) return false
    const effectiveType = getEffectiveType ? getEffectiveType(survivor, slotIndex, player?.leaderId) : survivor.type
    return effects.some((effect) => effect.survivorType === effectiveType)
  })
}

export function getActivePlacementEffectsForParty(player, getEffectiveType) {
  const leaderId = player?.leaderId
  return (player?.party ?? []).flatMap((survivor, index) => {
    const slotIndex = Number.isInteger(survivor?.partySlotIndex) ? survivor.partySlotIndex : index
    const effectiveType = getEffectiveType ? getEffectiveType(survivor, slotIndex, leaderId) : survivor?.type
    return getPlacementEffectsForSlot(leaderId, slotIndex)
      .filter((effect) => isPlacementEffectActive(effect, { effectiveType, slotIndex, leaderId }))
      .map((effect) => ({ effect, survivor, slotIndex, effectiveType }))
  })
}
