const TYPE_ALIASES = {
  반: '반장',
  반장: '반장',
  군기반장: '반장',
  용: '용감이',
  용감이: '용감이',
  돌격대장: '용감이',
  분: '분위기메이커',
  분위기메이커: '분위기메이커',
  4: '4차원',
  '4차원': '4차원',
  겁: '겁쟁이',
  겁쟁이: '겁쟁이',
  key: 'key',
  열쇠: 'key',
}

const RESOURCE_ALIASES = {
  can: 'can',
  통조림: 'can',
  bottleCap: 'cap',
  cap: 'cap',
  병뚜껑: 'cap',
  score: 'score',
  점수: 'score',
  key: 'key',
  열쇠: 'key',
  clue: 'clue',
  단서: 'clue',
  survivor: 'survivor',
  생존자: 'survivor',
  treasure: 'treasure',
  보물: 'treasure',
  item: 'item',
  아이템: 'item',
  exchange_arrow: 'exchange_arrow',
  교환: 'exchange_arrow',
}

function isBlank(value) {
  return value == null || String(value).trim() === ''
}

function tryParseJsonCell(value) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return null
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function normalizeTypeName(type) {
  if (type == null) return null
  const clean = String(type).trim().replace(/^\(/, '').replace(/\)$/, '')
  return TYPE_ALIASES[clean] ?? clean
}

function splitCellList(value) {
  return String(value)
    .split(/[,\n/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function parseTypeCountList(value) {
  if (isBlank(value)) return []
  const parsed = tryParseJsonCell(value)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed).map(([type, count]) => ({
      type: normalizeTypeName(type),
      count: Number(count) || 1,
    }))
  }

  const counts = new Map()
  const add = (type, count = 1) => {
    const normalized = normalizeTypeName(type)
    if (!normalized || normalized === '상대') return
    counts.set(normalized, (counts.get(normalized) ?? 0) + (Number(count) || 1))
  }

  for (const part of splitCellList(value)) {
    const colon = part.match(/^(.+?)\s*[:：]\s*(\d+)$/)
    if (colon) {
      add(colon[1], colon[2])
      continue
    }

    const compactCount = part.match(/^\(?([^):：]+)\)?\s*[x×*]\s*(\d+)$/i)
    if (compactCount) {
      add(compactCount[1], compactCount[2])
      continue
    }

    const parenthesized = [...part.matchAll(/\(([^)]+)\)\s*(\d+)?/g)]
    if (parenthesized.length > 0) {
      parenthesized.forEach((match) => add(match[1], match[2] ?? 1))
      continue
    }

    add(part, 1)
  }

  return Array.from(counts, ([type, count]) => ({ type, count }))
}

export function parseAssignmentCell(value) {
  if (isBlank(value)) return null
  const parsed = tryParseJsonCell(value)
  if (parsed && typeof parsed === 'object') {
    const minSurvivors = parsed.minSurvivors ?? parsed.min ?? parsed.amount
    return minSurvivors != null ? { minSurvivors: Number(minSurvivors) } : null
  }

  const text = String(value).trim()
  const count = text.match(/(\d+)/)
  if (count) return { minSurvivors: Number(count[1]) }

  return null
}

function parseResourceToken(part) {
  const text = part.trim()
  if (!text) return null
  if (text === 'exchange_arrow' || text === '교환') return { type: 'exchange_arrow' }

  const colon = text.match(/^(.+?)\s*[:：]\s*([+-]?\d+)$/)
  const signed = text.match(/^(.+?)\s*([+-]\d+)$/)
  const match = colon ?? signed
  if (!match) return null

  const resource = RESOURCE_ALIASES[match[1].trim()] ?? match[1].trim()
  return {
    type: resource,
    amount: Number(match[2]),
  }
}

export function parseRewardCell(value) {
  if (isBlank(value)) return null
  const parsed = tryParseJsonCell(value)
  if (parsed !== undefined) return parsed

  const rewards = splitCellList(value)
    .map(parseResourceToken)
    .filter(Boolean)

  if (rewards.length === 0) return null
  return rewards.length === 1 ? rewards[0] : rewards
}

function toResourceKey(resource) {
  if (resource === 'cap') return 'bottleCap'
  return resource
}

function parseOpponentRequirementToken(part) {
  const text = part.trim()
  if (!text) return null

  const activeSurvivor = text.match(/(?:활성\s*)?(?:생존자|survivor)\s*[:：]?\s*([+-]?\d+)/i)
  if (activeSurvivor) {
    const isActive = text.includes('활성') || /active/i.test(text)
    return { type: isActive ? 'active_survivor' : 'survivor', amount: Math.abs(Number(activeSurvivor[1])) }
  }

  const resource = parseResourceToken(text)
  if (resource && (resource.type === 'can' || resource.type === 'cap' || resource.type === 'bottleCap')) {
    return { type: 'resource', resource: toResourceKey(resource.type), amount: Math.abs(resource.amount ?? 0) }
  }

  const typeEntry = parseTypeCountList(text)[0]
  if (typeEntry?.type && TYPE_ALIASES[typeEntry.type]) {
    return { type: 'survivor_type', survivorType: normalizeTypeName(typeEntry.type), amount: typeEntry.count ?? 1 }
  }

  return { type: text }
}

export function parseOpponentRequirementCell(value) {
  if (isBlank(value)) return null
  const parsed = tryParseJsonCell(value)
  if (parsed !== undefined) return parsed

  const requirements = splitCellList(value)
    .map(parseOpponentRequirementToken)
    .filter(Boolean)

  if (requirements.length === 0) return null
  return requirements.length === 1 ? requirements[0] : requirements
}

export function parsePenaltyCell(value) {
  if (isBlank(value)) return null
  const parsed = tryParseJsonCell(value)
  if (parsed !== undefined) return parsed

  const text = String(value).trim()
  const can = text.match(/(?:통조림|can)\s*-?\s*(\d+)/i)
  if (can) return { type: 'lose_can', amount: Number(can[1]) }
  const cap = text.match(/(?:병뚜껑|cap|bottleCap)\s*-?\s*(\d+)/i)
  if (cap) return { type: 'lose_cap', amount: Number(cap[1]) }
  const survivor = text.match(/(?:생존자|survivor)\s*-?\s*(\d+)?/i)
  if (survivor) return { type: 'remove_random', amount: Number(survivor[1] ?? 1) }
  return null
}

function parseSignedResolutionAction(text) {
  const match = String(text).trim().match(/^(.+?)\s*[:：]\s*([+-]?\d+)$/)
  if (!match) return null

  const subject = match[1].trim()
  const amount = Number(match[2])
  const resource = RESOURCE_ALIASES[subject] ?? null

  if (resource === 'can' || resource === 'cap' || resource === 'bottleCap') {
    return { type: 'resource_delta', resource: toResourceKey(resource), amount }
  }

  if (resource === 'survivor') {
    return { type: 'survivor_delta', amount }
  }

  const survivorType = normalizeTypeName(subject)
  if ((survivorType !== subject || TYPE_ALIASES[subject]) && survivorType !== 'key') {
    return { type: 'survivor_type_delta', survivorType, amount }
  }

  return null
}

function parseStatusResolutionAction(text) {
  const match = String(text).trim().match(/^(.+?)\s*[:：]\s*(비활성화|비활성|deactivate)\s*(\d+)?$/i)
  if (!match) return null

  const subject = match[1].trim()
  const amount = Number(match[3] ?? 1)
  const resource = RESOURCE_ALIASES[subject] ?? null
  if (resource === 'survivor') {
    return { type: 'deactivate_survivor', amount }
  }

  const survivorType = normalizeTypeName(subject)
  if ((survivorType !== subject || TYPE_ALIASES[subject]) && survivorType !== 'key') {
    return { type: 'deactivate_survivor_type', survivorType, amount }
  }

  return null
}

export function parseResolutionCell(value) {
  if (isBlank(value)) return null
  const parsed = tryParseJsonCell(value)
  if (parsed && typeof parsed === 'object') return parsed

  const text = String(value).trim()
  const statusAction = parseStatusResolutionAction(text)
  if (statusAction) return statusAction

  const signedAction = parseSignedResolutionAction(text)
  if (signedAction) return signedAction

  const scoreDice = text.match(/(?:roll_dice_score_bonus|총점주사위|점수주사위)\s*[:：]?\s*(\d+)\+?/i)
  if (scoreDice) return { type: 'roll_dice_score_bonus', diceCount: 1, target: Number(scoreDice[1]) }

  const keyDice = text.match(/(?:열쇠|key)\s*\+\s*(?:🎲|주사위)?\s*(\d+)\+?/i)
  if (keyDice) return { type: 'roll_dice', diceCount: 1, target: Number(keyDice[1]), requiresKey: true }

  const dice = text.match(/(?:roll_dice|주사위|🎲)\s*[:：]?\s*(\d+)\+?/i)
  if (dice) return { type: 'roll_dice', diceCount: 1, target: Number(dice[1]) }

  const simple = text.match(/^([a-zA-Z_]+)\s*[:：]\s*(\d+)$/)
  if (simple) return { type: simple[1], amount: Number(simple[2]) }

  if (text === 'global_effect' || text === '전체 효과') return { type: 'global_effect' }
  if (text === 'check_survivors_n' || text === '생존자 체크') return { type: 'check_survivors_n', amount: 3 }

  return { type: text }
}

export function parseGlobalEffectCell(value) {
  if (isBlank(value)) return null
  const parsed = tryParseJsonCell(value)
  if (parsed && typeof parsed === 'object') return parsed

  const text = String(value).trim()
  const canGain = text.match(/(?:모든 플레이어|전원)\s*통조림\s*\+(\d+)/)
  if (canGain) return { type: 'gain_can_all', amount: Number(canGain[1]) }
  const capGain = text.match(/(?:모든 플레이어|전원)\s*병뚜껑\s*\+(\d+)/)
  if (capGain) return { type: 'gain_cap_all', amount: Number(capGain[1]) }
  const canLose = text.match(/(?:모든 플레이어|전원)\s*통조림\s*-(\d+)/)
  if (canLose) return { type: 'lose_can_all', amount: Number(canLose[1]) }
  const capLose = text.match(/(?:모든 플레이어|전원)\s*병뚜껑\s*-(\d+)/)
  if (capLose) return { type: 'lose_cap_all', amount: Number(capLose[1]) }
  const addSurvivor = text.match(/(?:모든 파티|전원).*생존자\s*\+(\d+)/)
  if (addSurvivor) return { type: 'add_survivors_all', amount: Number(addSurvivor[1]) }
  if (text.includes('통조림 절반')) return { type: 'halve_can_all' }
  if (text.includes('순서') && text.includes('섞')) return { type: 'shuffle_all_parties' }
  return { type: text }
}
