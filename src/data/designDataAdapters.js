import DESIGN_EVENTS_JSON from '../../design/Events.json' with { type: 'json' }
import DESIGN_SURVIVORS_JSON from '../../design/Survivers.json' with { type: 'json' }
import DESIGN_LEADERS_JSON from '../../design/Leaders.json' with { type: 'json' }

function unwrapRows(source) {
  if (Array.isArray(source)) return source
  if (Array.isArray(source?.data)) return source.data
  if (Array.isArray(source?.rows)) return source.rows
  return []
}

function isBlank(value) {
  return value == null || String(value).trim() === ''
}

function cleanObject(row) {
  return Object.fromEntries(
    Object.entries(row ?? {})
      .filter(([key]) => key && !key.match(/^\d+열$/) && key !== '')
      .map(([key, value]) => [key, value === '' ? null : value])
  )
}

function numberOr(value, fallback = 0) {
  if (isBlank(value)) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeEventRow(row) {
  const clean = cleanObject(row)
  if (isBlank(clean.id)) return null

  return {
    ...clean,
    tier: numberOr(clean.tier, 1),
    count: numberOr(clean.count, 1),
    eventType: clean.eventType ?? null,
    opponentRequirement: clean.opponentRequirement ?? null,
    reward: clean.reward ?? null,
    failPenalty: clean.failPenalty ?? null,
    globalEffect: clean.globalEffect ?? null,
    requiredTypes: clean.requiredTypes ?? null,
    recommendedParty: clean.recommendedParty ?? null,
    assignment: clean.assignment ?? null,
    resolution: clean.resolution ?? null,
  }
}

function getSearchTier(row) {
  return numberOr(row.searchTier ?? row.tier, 1)
}

function normalizeSurvivorRow(row) {
  const clean = cleanObject(row)
  if (isBlank(clean.id)) return null
  const tier = getSearchTier(clean)
  return {
    ...clean,
    tier,
    searchTier: tier,
    score: numberOr(clean.score, 1),
    recruitCost: numberOr(clean.recruitCost, 3),
    count: Math.max(1, numberOr(clean.count, 1)),
    reactivationCost: clean.reactivationCost ?? { can: Math.max(1, tier) },
  }
}

const LEADER_META = {
  robot: { name: 'HAL-4935', emoji: '🤖', color: '#4A7FB5', skillEffect: 'happiness_calc', maxResources: { bottleCap: 12, can: 12 } },
  idol: { name: '소염 더 고트', emoji: '🎤', color: '#C45A8A', skillEffect: 'reserve_fanclub', maxResources: { bottleCap: 15, can: 12 } },
  zombie: { name: '비', emoji: '🧟', color: '#5A8A5A', skillEffect: 'zombify', maxResources: { bottleCap: 14, can: 10 } },
  duck: { name: '덕이', emoji: '🦆', color: '#C4A44A', skillEffect: 'disaster_prayer', maxResources: { bottleCap: 10, can: 16 } },
  shy: { name: '샤이', emoji: '😰', color: '#8B7BA8', skillEffect: 'can_recruit', maxResources: { bottleCap: 12, can: 18 } },
}

function getLeaderDisplayName(row, meta) {
  if (!isBlank(row.name)) return row.name
  const fullName = String(row.fullName ?? '')
  if (fullName.includes('/')) return fullName.split('/').pop().trim()
  return meta?.name ?? row.id
}

function normalizeLeaderRow(row) {
  const clean = cleanObject(row)
  if (isBlank(clean.id)) return null
  const meta = LEADER_META[clean.id] ?? {}
  return {
    ...clean,
    name: getLeaderDisplayName(clean, meta),
    fullName: clean.fullName ?? getLeaderDisplayName(clean, meta),
    score: numberOr(clean.score, 0),
    maxPartySize: numberOr(clean.maxPartySize, 5),
    initialResources: clean.initialResources ?? {
      can: numberOr(clean.initialCan, 0),
      bottleCap: numberOr(clean.initialBottleCap, 0),
    },
    maxResources: clean.maxResources ?? meta.maxResources ?? { can: 12, bottleCap: 12 },
    passiveIncome: clean.passiveIncome ?? {
      can: numberOr(clean.incomeCan, 0),
      bottleCap: numberOr(clean.incomeBottleCap, 0),
    },
    uniqueSkill: clean.uniqueSkill ?? {
      name: clean.uniqueSkillName ?? '',
      description: clean.uniqueSkillDescription ?? '',
      effect: clean.uniqueSkillEffect ?? meta.skillEffect ?? null,
    },
    color: clean.color ?? meta.color ?? '#6B7280',
    emoji: clean.emoji ?? meta.emoji ?? '👑',
  }
}

export const DESIGN_EVENTS = unwrapRows(DESIGN_EVENTS_JSON).map(normalizeEventRow).filter(Boolean)
export const DESIGN_SURVIVORS = unwrapRows(DESIGN_SURVIVORS_JSON).map(normalizeSurvivorRow).filter(Boolean)
export const DESIGN_LEADERS = unwrapRows(DESIGN_LEADERS_JSON).map(normalizeLeaderRow).filter(Boolean)
