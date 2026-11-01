import { SURVIVORS } from '../data/survivors.js'
import { LEADERS as ORIGINAL_LEADERS } from '../data/leaders.js'

export const VERSION = 'expedition-v2'
export const TYPES = ['겁쟁이', '분위기메이커', '반장', '용감이', '4차원']
export const COLORS = ['#b45d43', '#397f94', '#7a619d', '#6d8740']
export const RULES = { route: 20, escapePeople: 3, escapeFood: 3, utopiaTarget: 12, escapeTypes: 3, routeBonus: 0, party: 5, mealCost: 2, utopiaFirst: 5, utopiaLater: 3, suppliesPerPoint: 3 }
// Every ability prints its timing. Original source cards remain untouched.
export const ABILITIES = {
  plain: { timing: '탐색', text: '파견하면 주사위 1개. 필요한 타입 하나를 담당합니다.' },
  teacher: { timing: '탐색', text: '내 동료와 동행 시 최저 주사위 1·2 재굴림. 파티당 1회.' },
  scout: { timing: '탐색', text: '다른 타입의 내 동료와 동행 시 주사위 +1. 파티당 1회. 개와 같은 자리·인접 불가.' },
  guard: { timing: '탐색·상시', text: '탐색 중 내 동료 실종 방지. 준비 중엔 자신과 이웃의 피로 공격 방지.' },
  free: { timing: '상시', text: '스스로 먹을 것을 구합니다. 식사 비용 0.' },
  jam: { timing: '낮 · 거점', text: '상대의 준비된 생존자 1명을 피로하게 합니다. 보호 중인 대상 제외.' },
  hunter: { timing: '낮 · 거점', text: '상대 한 파티에게서 병뚜껑 2개를 가져옵니다.' },
  dog: { timing: '탐색', text: '탐색을 마치면 통조림 +2. 고양이와 인접할 수 없습니다.' },
  doctor: { timing: '낮 · 거점', text: '내 다른 동료 1명의 이번 밤 식사를 무료로 하고 통조림 +1. 파견 중인 동료도 선택 가능.' },
  alien: { timing: '밤 · 거점', text: '식사 때 양옆 동료의 식사 비용을 각각 1 줄입니다. 최저 0.' },
  capybara: { timing: '거점 · 지속', text: '동료 1명과 같은 자리 사용. 그 동료의 식사 비용 −1. 최저 0.' },
  runner: { timing: '낮 · 거점', text: '통조림 +4. 주사위 1이면 식량 2개를 들고 다른 파티로 떠납니다.' },
  captain: { timing: '낮 · 거점', text: '내 파티 두 자리를 바꿉니다. 통조림 +2. 빈자리도 선택 가능.' },
  guide: { timing: '낮 · 거점', text: '파견 중인 내 동료 1명을 다른 미완성 탐색으로 옮깁니다. 금기는 적용됩니다.' },
  tax: { timing: '낮 · 거점', text: '다른 파티마다 병뚜껑 1개씩 가져옵니다.' },
  wizard: { timing: '낮 · 거점', text: '통조림 또는 병뚜껑 2개를 내고 다른 재화 4개를 얻습니다.' },
  ghost: { timing: '상시', text: '동료 1명과 같은 자리 사용. 식사 0. 동료가 떠나도 남습니다.' },
  twins: { timing: '상시', text: '쌍둥이끼리 같은 자리 사용. 동행 시 주사위 +1. 파티당 1회.' },
  vet: { timing: '낮 · 거점', text: '공개 생존자 1명을 병뚜껑 1개 적게 내고 데려옵니다. 최저 0.' },
  shelter: { timing: '낮 · 거점', text: '공개된 재난의 불이익에서 내 파티를 보호합니다. 다음 사건까지 유지.' },
  wildcard: { timing: '출발', text: '부족한 타입 1개를 대신합니다. 금기 판정은 원래 타입인 4차원으로 합니다.' },
  sabotage: { timing: '낮 · 파견', text: '이 탐색을 즉시 실패시킵니다. 자신은 낙오합니다.' },
  chaos: { timing: '낮 · 파견', text: '출발 준비 후 주사위: 1~3 탐색 실패, 4~6 통조림·병뚜껑 보상 ×2. 이동·구조는 그대로. 탐색마다 1회.' },
  counter: { timing: '반격', text: '내 동료의 탐색 실패를 취소하고 낙오합니다. 거점 준비 중·동행 중 사용 가능.' },
  recruiter: { timing: '낮 · 거점', text: '공개 생존자 1명을 병뚜껑 2개 적게 내고 데려옵니다. 최저 0.' },
}
const picked = [
  ['s_military_5', 'teacher'], ['s_coward_1', 'scout'], ['s_charge_4', 'guard'],
  ['s_mood_1', 'free'], ['s_weird_1', 'jam'], ['s_charge_6', 'hunter'],
  ['s_charge_2', 'dog'], ['s_coward_2', 'doctor'], ['s_weird_5', 'alien'],
  ['s_mood_3', 'capybara'], ['s_military_1', 'captain'], ['s_weird_3', 'runner'],
  ['s_military_2', 'guide'], ['s_military_3', 'jam'], ['s_military_6', 'tax'],
  ['s_weird_4', 'wizard'], ['s_weird_7', 'ghost'], ['s_coward_twins', 'twins'],
  ['s_mood_twins', 'twins'], ['s_mood_4', 'vet'], ['s_coward_6', 'free'],
  ['s_charge_3', 'shelter'], ['s_mood_5', 'recruiter'],
  ['s_weird_2', 'wildcard'], ['s_weird_6', 'sabotage'], ['s_charge_1', 'counter'],
]
// Recruitment reflects ability value. Meals use the common rule.
const abilityCosts = {
  plain: 2, teacher: 5, scout: 6, guard: 5, free: 4,
  jam: 4, hunter: 4, dog: 4, doctor: 3, alien: 5,
  capybara: 4, runner: 5, captain: 3, guide: 4, tax: 5,
  wizard: 5, ghost: 6, twins: 3, vet: 3, shelter: 5,
  recruiter: 5, wildcard: 5, sabotage: 5, counter: 4, chaos: 6,
}
function adapt(source, ability) {
  const tier = source.searchTier ?? source.tier ?? 1, definition = ABILITIES[ability]
  const cost = abilityCosts[ability]
  return { id: source.id, name: source.name, art: source.id, type: source.type, tier, ability,
    cost, score: source.score ?? 1,
    timing: definition.timing, text: definition.text }
}
export const PLAIN = TYPES.map(type => adapt(SURVIVORS.find(s => s.id.startsWith('s_plain_') && s.type === type), 'plain'))
export const SURVIVOR_CARDS = [...picked.map(([id, ability]) => adapt(SURVIVORS.find(s => s.id === id), ability)),
  { ...adapt(SURVIVORS.find(s => s.id === 's_weird_4'), 'chaos'), id: 's_weird_4_chaos', name: '확률 마법사' },
]
// Final party score uses the original printed card score. Cards saved in older rooms have no score field.
const scoreById = Object.fromEntries([...PLAIN, ...SURVIVOR_CARDS].map(c => [c.id, c.score]))
export const cardScore = card => card.score ?? scoreById[card.id] ?? 1
const art = { shy: 's_coward_1', robot: 's_military_5', zombie: 's_charge_6', duck: 's_weird_1', idol: 's_mood_1' }
const leaderSkills = {
  robot: '밤에 추가 수색으로 비공개 후보 2장을 확인하고, 비용을 내어 1명을 영입할 수 있습니다.',
  idol: '밤마다 공개 생존자 1명을 예비 팬으로 확보합니다. 최대 3명이며 정식 영입비는 별도입니다.',
  zombie: '밤 종료 주사위 6: 상대 용감이 1명을 피로 상태로 영입. 1: 내 용감이 1명이 낙오합니다.',
  duck: '사건 해결 병뚜껑 −1. 재난 공개 시 주사위를 굴립니다. 6이면 다음 사건까지 내 파티가 재난의 불이익을 받지 않습니다.',
  shy: '생존자 영입비를 같은 수의 통조림으로 대신 낼 수 있습니다.',
}
const leaderEconomy = {
  robot: [6,4,4,1], idol: [6,6,3,2], zombie: [6,5,4,1], duck: [6,3,4,1], shy: [7,3,5,0],
}
export const LEADERS = ORIGINAL_LEADERS.map(l => ({ ...l,
  initialResources: { can: leaderEconomy[l.id][0], bottleCap: leaderEconomy[l.id][1] },
  passiveIncome: { can: leaderEconomy[l.id][2], bottleCap: leaderEconomy[l.id][3] }, art: art[l.id], title: l.uniqueSkill.name,
  skill: leaderSkills[l.id], utopia: '동료들과 함께 탈출' }))
export const LEADER_STRATEGIES = {
  robot: '추가 수색으로 후보를 비교하세요. 원하는 타입과 동행 능력을 골라 파티를 완성하세요.',
  idol: '원하는 동료를 예비 팬으로 먼저 확보하세요. 병뚜껑을 모아 필요한 순서대로 영입하세요.',
  zombie: '용감이를 모아 좀비 행동으로 파티를 늘리세요. 좀비 행동으로 내 용감이도 잃을 수 있어 다른 타입도 준비하세요.',
  duck: '사건 해결 비용이 적습니다. 이동과 사건 준비에 동료를 나누고, 유토피아 도전 확률을 높이세요.',
  shy: '통조림으로 영입할 수 있지만 식사에도 필요합니다. 다음 밤의 식사분을 남기고 동료를 늘리세요.',
}
export const placementLabel = slot => slot < 2 ? '앞 · 반장 재배치 −1 / 용감이 탐색 +1' : slot === 2 ? '중앙 · 분위기 수색 −1 / 4차원 장소 교체 −1' : '뒤 · 겁쟁이 식사 −1'

export const EXPLORATION_TYPES = {
  supply: { name: '보급', flavor: '아직 쓸 만한 것이\n남아 있을지도 몰라.', color: '#267b70', palette: ['#dbe9df', '#9db9aa', '#267b70'], icon: 'supply' },
  scout: { name: '정찰', flavor: '더 멀리, 더 많은 것을\n볼 수 있을 거야.', color: '#615887', palette: ['#e2deec', '#b0a5c1', '#615887'], artHue: true, icon: 'scout' },
  large: { name: '대규모 탐색', flavor: '저 너머에, 아직\n가보지 못한 곳이 있다.', color: '#4975a6', palette: ['#e0e8ee', '#a3b8cb', '#4975a6'], artHue: true, icon: 'large' },
  contest: { name: '쟁탈', flavor: '먼저 찾았다고\n네 것은 아니지.', color: '#aa533f', palette: ['#eddcd1', '#c99c89', '#aa533f'], icon: 'contest' },
  first: { name: '보물 찾기', flavor: '누가 먼저 도착할까?\n좋은 것은 오래 안 남아.', color: '#a57321', palette: ['#eee1bf', '#cab27a', '#a57321'], icon: 'first' },
  rescue: { name: '구조', flavor: '아직 누군가\n기다리고 있을지 몰라.', color: '#aa5d70', palette: ['#efdee1', '#c49ba8', '#aa5d70'], icon: 'rescue' },
}
export const explorationType = card => EXPLORATION_TYPES[card.explorationType
  ?? (card.distribution === 'first' ? 'first' : card.rewardSurvivors ? 'rescue' : card.distribution === 'all' ? 'contest' : card.people >= 5 ? 'large' : card.rewardRoute >= 2 ? 'scout' : 'supply')]

// Each entry is one physical reward bundle, in its printed payout order.
const reward = (kind, amounts) => amounts.map((amount, i) => ({ id: kind + '-' + i, kind, amount,
  label: { route: '여정', can: '통조림', bottleCap: '병뚜껑', survivor: '공개 생존자 영입' }[kind] }))
const locations = [
  ['place-1-0', '버려진 편의점', 1, 1, [], 'supply', [...reward('can', [4]), ...reward('bottleCap', [2])]],
  ['place-1-1', '지하 주차장', 1, 2, ['용감이'], 'contest', [...reward('route', [3]), ...reward('bottleCap', [3])]],
  ['place-1-2', '텅 빈 버스 정류장', 1, 2, ['겁쟁이'], 'scout', [...reward('route', [2, 1]), ...reward('bottleCap', [1])]],
  ['place-1-3', '옥상 텃밭', 1, 3, ['4차원'], 'first', [...reward('can', [6]), ...reward('bottleCap', [3]), ...reward('can', [2])]],
  ['place-1-4', '막힌 골목길', 1, 4, ['겁쟁이'], 'scout', [...reward('route', [3, 1]), ...reward('bottleCap', [1])]],
  ['place-1-5', '폐교 급식실', 1, 5, ['반장'], 'large', [...reward('can', [8]), ...reward('bottleCap', [4]), ...reward('route', [3]), ...reward('can', [3])]],
  ['place-2-0', '무너진 물류센터', 2, 6, ['용감이', '반장'], 'large', [...reward('bottleCap', [6]), ...reward('can', [8]), ...reward('route', [4]), ...reward('can', [3])]],
  ['place-2-1', '침수된 연구소', 2, 4, ['용감이'], 'contest', [...reward('route', [4]), ...reward('bottleCap', [4])]],
  ['place-2-2', '끊어진 고가도로', 2, 3, ['겁쟁이'], 'scout', [...reward('route', [3, 1]), ...reward('can', [1])]],
  ['place-2-3', '지하 대피소', 2, 2, [], 'rescue', [...reward('survivor', [1]), ...reward('can', [1])]],
  ['place-2-4', '낡은 방송국', 2, 3, ['겁쟁이', '4차원'], 'scout', [...reward('route', [4]), ...reward('bottleCap', [1])]],
  ['place-2-5', '봉쇄된 병원', 2, 5, ['겁쟁이', '분위기메이커'], 'rescue', [...reward('survivor', [1, 1]), ...reward('can', [1])]],
  ['place-2-supply', '버려진 식량 창고', 2, 2, [], 'supply', [...reward('can', [6]), ...reward('bottleCap', [3])]],
  ['place-3-0', '마지막 송신탑', 3, 6, ['반장', '4차원'], 'large', [...reward('route', [5]), ...reward('can', [9]), ...reward('bottleCap', [5]), ...reward('can', [3])]],
  ['place-3-1', '유토피아 관문', 3, 4, ['겁쟁이'], 'scout', [...reward('route', [4, 1]), ...reward('can', [1])]],
  ['place-3-2', '붉은 협곡', 3, 3, ['겁쟁이'], 'scout', [...reward('route', [4]), ...reward('bottleCap', [1])]],
  ['place-3-3', '방치된 군수창고', 3, 6, ['반장', '용감이'], 'large', [...reward('can', [10]), ...reward('bottleCap', [6]), ...reward('route', [5]), ...reward('can', [4])]],
  ['place-3-4', '안개 속 터널', 3, 2, ['겁쟁이'], 'scout', [...reward('route', [3]), ...reward('can', [1])]],
  ['place-3-5', '무너지는 방벽', 3, 5, ['반장', '용감이'], 'large', [...reward('route', [5]), ...reward('can', [8]), ...reward('bottleCap', [4]), ...reward('can', [3])]],
  ['place-3-supply', '옛 배급소', 3, 3, [], 'supply', [...reward('can', [8]), ...reward('bottleCap', [4]), ...reward('can', [2])]],
  ['place-barter', '고철 교환소', 1, 2, ['반장'], 'supply', reward('bottleCap', [1]), 'barter'],
  ['place-swap', '생존자 만남터', 2, 2, ['분위기메이커'], 'rescue', reward('bottleCap', [1]), 'survivorTrade'],
]
const hazards = {
  'place-1-1': { type: '4차원', effect: 'lastReward' },
  'place-1-3': { type: '반장', effect: 'lastReward' },
  'place-2-1': { type: '겁쟁이', effect: 'fail' },
  'place-2-4': { type: '용감이', effect: 'lastReward' },
  'place-3-0': { type: '분위기메이커', effect: 'lastReward' },
  'place-3-3': { type: '4차원', effect: 'fail' },
}
export const LOCATIONS = locations.map(([id, name, tier, people, roles, explorationType, rewards, interaction]) => ({
  id, name, tier, people, roles, food: 0, caps: 0, rewards: rewards.map((r, i) => ({ ...r, id: r.kind + '-' + i })), interaction,
  distribution: interaction ? 'trade' : explorationType === 'first' ? 'first' : explorationType === 'contest' ? 'all' : 'choice',
  explorationType, hazard: hazards[id] ?? null,
  rewardRoute: rewards.filter(r => r.kind === 'route').reduce((sum, r) => sum + r.amount, 0),
  rewardCan: rewards.filter(r => r.kind === 'can').reduce((sum, r) => sum + r.amount, 0),
  rewardCap: rewards.filter(r => r.kind === 'bottleCap').reduce((sum, r) => sum + r.amount, 0),
  rewardSurvivors: rewards.filter(r => r.kind === 'survivor').length,
  text: interaction === 'barter' ? '통조림 2개와 병뚜껑 2개를 서로 교환. 수락하면 양쪽 병뚜껑 +1.' : interaction ? '거점 동료 한 명씩 교환. 수락하면 양쪽 병뚜껑 +1.' : EXPLORATION_TYPES[explorationType].flavor.replace('\n', ' '),
}))
// Exchange sites seat exactly their printed people; other sites allow up to 8.
export const siteCapacity = card => card.interaction ? card.people : 8
export const distributionText = card => card.interaction ? '상대 수락 시 교환 · 양쪽 병뚜껑 +1' : card.distribution === 'first' ? '조건을 채우면 배치 순서대로 남은 보상 한 묶음씩 선택' : card.distribution === 'all' ? '주사위 숫자가 가장 큰 파티가 전체 획득' : '높은 눈부터 주사위 하나당 남은 보상 한 묶음씩 선택'
export function locationPrizes(card, crew = []) {
  // Legacy pending rewards retain their original bundles when an existing room upgrades.
  const prizes = card.rewards ? card.rewards.map(r => ({ ...r })) : [
    { id: 'route', kind: 'route', amount: card.rewardRoute ?? 1, label: '여정' },
    { id: 'food', kind: 'can', amount: card.rewardCan, label: '통조림' },
    { id: 'caps', kind: 'bottleCap', amount: card.rewardCap, label: '병뚜껑' },
    ...Array.from({ length: Math.min(2, card.rewardSurvivors ?? 0) }, (_, i) => ({ id: 'survivor-' + i, kind: 'survivor', amount: 1, label: '공개 생존자 영입' })),
  ].filter(r => r.amount > 0)
  if (!card.rewards && card.rewardOrder?.includes('route-extra') && card.rewardRoute > 1) {
    const clue = prizes.find(p => p.id === 'route'), extra = Math.ceil(clue.amount / 2)
    clue.amount -= extra; prizes.push({ ...clue, id: 'route-extra', amount: extra })
  }
  if (!card.rewards && card.rewardOrder) prizes.sort((a,b) => (card.rewardOrder.indexOf(a.id) < 0 ? card.rewardOrder.length : card.rewardOrder.indexOf(a.id)) - (card.rewardOrder.indexOf(b.id) < 0 ? card.rewardOrder.length : card.rewardOrder.indexOf(b.id)))
  if (card.hazard?.effect === 'lastReward' && crew.some(c => c.type === card.hazard.type)) prizes.pop()
  return prizes
}
export const hazardText = card => card.hazard ? card.hazard.type + (card.hazard.effect === 'fail' ? ' 참가 → 탐색 즉시 실패' : ' 참가 → 마지막 보상 묶음 제거') : ''
export const abilityPhase = (card, phase, deployed = false) => deployed
  ? phase === 'dispatch' && ['sabotage', 'chaos'].includes(card.ability)
  : phase === 'dispatch' && ABILITIES[card?.ability]?.timing === '낮 · 거점'
