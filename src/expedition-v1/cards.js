import { SURVIVORS } from '../data/survivors.js'
import { LEADERS as ORIGINAL_LEADERS } from '../data/leaders.js'

export const VERSION = 'expedition-v1'
export const TYPES = ['겁쟁이', '분위기메이커', '반장', '용감이', '4차원']
export const COLORS = ['#b45d43', '#397f94', '#7a619d', '#6d8740']
export const RULES = { days: 8, actionsPerDay: 2, route: 10, escapePeople: 3, escapeFood: 3, utopiaTarget: 10, party: 5 }
export const ABILITIES = {
  plain: { name: '함께 가는 사람', text: '파견하면 주사위 1개. 역할 하나를 담당합니다.' },
  reroll: { name: '다시 해 봅시다', text: '파견 · 내 최저 주사위가 1·2이면 한 번 다시 굴립니다. 파티당 1회.' },
  scout: { name: '같이 가면 든든해', text: '파견 · 이 탐색에 다른 타입이 동행하면 내 주사위 +1. 파티당 1회.' },
  guard: { name: '내 뒤에 숨어', text: '파견 · 위험 탐색에서 내 파티의 실종을 막습니다.' },
  free: { name: '제 밥은 챙겨요', text: '귀환 · 이 생존자는 통조림 없이 귀환합니다.' },
  loner: { name: '내가 앞장선다', text: '파견 · 이 탐색에 다른 용감이가 없으면 내 주사위 +1. 파티당 1회.' },
  barter: { name: '몫 챙기기', text: '파견 · 기본 참가 보상으로 내 파티가 병뚜껑 1개를 추가로 받습니다. 파티당 1회.' },
  jam: { name: '그 주사위는 빼고', text: '파견 · 상대 파티의 능력으로 추가된 주사위를 1개 줄입니다. 파티당 최대 1개 감소.' },
}
const picked = [
  ['s_military_5', 'reroll'], ['s_coward_1', 'scout'], ['s_charge_4', 'guard'],
  ['s_mood_1', 'free'], ['s_weird_1', 'jam'], ['s_charge_6', 'loner'],
  ['s_charge_2', 'barter'], ['s_coward_2', 'guard'], ['s_weird_5', 'free'],
  ['s_mood_3', 'scout'], ['s_military_1', 'reroll'], ['s_weird_3', 'barter'],
]
function adapt(source, ability) {
  return { id: source.id, name: source.name, art: source.id, type: source.type, ability,
    cost: ability === 'plain' ? 3 : 4, returnCost: ability === 'free' ? 0 : 1,
    abilityName: ABILITIES[ability].name, text: ABILITIES[ability].text }
}
export const PLAIN = TYPES.map(type => adapt(SURVIVORS.find(s => s.id.startsWith('s_plain_') && s.type === type), 'plain'))
export const SURVIVOR_CARDS = [...PLAIN, ...picked.map(([id, ability]) => adapt(SURVIVORS.find(s => s.id === id), ability))]
const starter = { shy: 's_coward_1', robot: 's_military_5', zombie: 's_charge_6', duck: 's_weird_1', idol: 's_mood_1' }
export const LEADERS = ORIGINAL_LEADERS.map(l => {
  const companion = SURVIVOR_CARDS.find(c => c.id === starter[l.id])
  return { ...l, art: companion.id, title: '함께 출발하는 동료', skill: companion.name + '와 시작합니다. ' + companion.text, companion, utopia: '동료들과 함께 탈출' }
})
// name, minimum people, required types, supplied food, clues, food reward, caps reward, supplied caps, distribution
const locations = {
  1: [
    ['버려진 편의점', 2, [], 0, 0, 5, 2],
    ['지하 주차장', 2, ['반장'], 0, 2, 0, 4, 0, 'all'],
    ['텅 빈 버스 정류장', 2, ['겁쟁이'], 0, 3, 2, 0],
    ['옥상 텃밭', 2, [], 0, 2, 4, 0],
    ['막힌 골목길', 2, ['용감이'], 0, 2, 0, 3],
    ['폐교 급식실', 2, [], 0, 0, 6, 0],
  ],
  2: [
    ['무너진 물류센터', 3, ['용감이'], 1, 0, 7, 5],
    ['침수된 연구소', 3, ['4차원'], 1, 4, 0, 4, 1, 'all'],
    ['끊어진 고가도로', 3, ['반장'], 0, 4, 3, 0],
    ['지하 대피소', 3, [], 1, 3, 6, 0],
    ['낡은 방송국', 3, ['분위기메이커'], 0, 4, 0, 3],
    ['봉쇄된 병원', 3, ['겁쟁이'], 1, 3, 5, 0],
  ],
  3: [
    ['마지막 송신탑', 4, ['반장', '4차원'], 1, 6, 0, 5],
    ['유토피아 관문', 3, ['분위기메이커'], 2, 5, 4, 0],
    ['붉은 협곡', 3, ['용감이'], 1, 5, 0, 6],
    ['방치된 군수창고', 4, ['반장'], 1, 0, 8, 8, 0, 'all'],
    ['안개 속 터널', 3, ['겁쟁이'], 2, 6, 0, 0],
    ['무너지는 방벽', 4, ['용감이', '4차원'], 1, 5, 6, 4],
  ],
}
export const LOCATIONS = [1, 2, 3].flatMap(tier => locations[tier].map(([name, people, roles, food, rewardRoute, rewardCan, rewardCap, caps = 0, distribution = 'choice'], i) => ({
  id: 'place-' + tier + '-' + i, name, tier, people, roles, food, caps, distribution, rewardRoute, rewardCan, rewardCap,
  danger: tier === 3,
  text: tier === 1 ? '가까운 곳에도 아직 쓸 만한 것들이 남아 있다.' : tier === 2 ? '혼자 가기엔 벅차다. 그렇다고 전부 나눠 줄 생각은 없다.' : '이 길의 끝을 확인하려면, 돌아올 몫도 남겨 둬야 한다.',
})))
export const distributionText = card => card.distribution === 'all' ? '주사위 숫자가 가장 큰 플레이어가 전체 획득' : '주사위 순위대로 한 묶음씩 선택'
export function locationPrizes(card) {
  return [
    { id: 'route', kind: 'route', amount: card.rewardRoute ?? 1, label: '유토피아 단서' },
    { id: 'food', kind: 'can', amount: card.rewardCan, label: '비상식량' },
    { id: 'caps', kind: 'bottleCap', amount: card.rewardCap, label: '폐품 매각' },
  ].filter(prize => prize.amount > 0)
}
export const DISASTERS = [
  { day: 2, name: '식량 공급 단절', icon: '▧', resource: 'bottleCap', cost: 3, crew: 2, peopleLoss: 1, preparation: '비상 식량 확보', types: ['분위기메이커', '4차원'], loss: { can: 4 }, text: '대비하지 못한 파티는 통조림 4개를 잃고 동료 1명이 낙오합니다.' },
  { day: 4, name: '약탈자 습격', icon: '⚑', resource: 'can', cost: 3, crew: 2, peopleLoss: 1, preparation: '경비 물자', types: ['용감이', '반장'], loss: { bottleCap: 4 }, text: '대비하지 못한 파티는 병뚜껑 4개를 잃고 동료 1명이 낙오합니다.' },
  { day: 6, name: '대홍수', icon: '≋', resource: 'bottleCap', cost: 4, crew: 2, peopleLoss: 1, preparation: '방수 자재', types: ['겁쟁이', '반장'], loss: { can: 3, bottleCap: 2 }, text: '대비하지 못한 파티는 통조림 3개·병뚜껑 2개를 잃고 동료 1명이 낙오합니다.' },
  { day: 8, name: '마지막 한파', icon: '❄', resource: 'bottleCap', cost: 5, crew: 2, peopleLoss: 2, preparation: '방한 장비', types: ['4차원', '겁쟁이'], loss: { can: 5 }, text: '대비하지 못한 파티는 통조림 5개를 잃고 동료 2명이 낙오합니다.' },
]
