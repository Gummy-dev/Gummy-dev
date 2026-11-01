export const TYPES = ['겁쟁이', '분위기메이커', '반장', '용감이', '4차원']
export const TYPE_COLORS = ['#8063a0', '#aa5d70', '#50819b', '#a65132', '#b18c32']
// Pastel type hues; brave uses warmer, clearer vermilion to stay distinct from rescue pink.
export const TYPE_PAPER_COLORS = ['#d6cedf', '#e5cdd3', '#cdd6da', '#eabdac', '#ecdbb3']
export const LEADERS = [
  { id: 'robot', name: 'HAL-4935', title: '계획대로 살고 싶어', type: '반장', art: 's_military_1', skill: '영입 때 덱 위 2명도 확인하고 선택합니다.', utopia: '완전 관리 구역', goal: '서로 다른 타입 4종' },
  { id: 'idol', name: '소염 더 고트', title: '앙코르는 멸망 이후에', type: '분위기메이커', art: 's_mood_1', skill: '파티에 6명까지 함께할 수 있습니다.', utopia: '영원한 페스티벌', goal: '분위기메이커 2명' },
  { id: 'zombie', name: '비', title: '죽어도 자신감은 살아', type: '용감이', art: 's_charge_1', skill: '차례당 한 번, 실패 뒤 병뚜껑 1개로 주사위 1개를 다시 굴립니다.', utopia: '끝없는 사냥터', goal: '용감이 2명' },
  { id: 'duck', name: '덕이', title: '일단 꽥 하고 보자', type: '4차원', art: 's_weird_1', skill: '차례당 한 번, 파견한 4차원 1명이 다른 추천 타입을 대신합니다.', utopia: '꽥의 차원문', goal: '4차원 2명' },
  { id: 'shy', name: '샤이', title: '안전한 곳 맞죠?', type: '겁쟁이', art: 's_coward_1', skill: '영입비 중 최대 2개를 통조림으로 대신 냅니다.', utopia: '고요한 은신처', goal: '겁쟁이 2명' },
]

const basicArts = ['s_normal_1', 's_normal_2', 's_normal_3', 's_charge_2', 's_weird_2']
export const BASICS = TYPES.map((type, i) => ({ id: `basic_${i}`, name: `${type} 이웃`, type, tier: 1, cost: 3, score: 1, art: basicArts[i], ability: '', text: '특별한 재주는 없어도, 같이 가면 든든하다.' }))
export const SURVIVORS = [
  ...BASICS,
  { id: 'cat', name: '고양이', type: '겁쟁이', tier: 2, art: 's_coward_1', ability: 'cat', text: '안전한 식량 수집 +1. 개와 이웃한 칸에는 앉지 않는다.' },
  { id: 'dog', name: '개', type: '분위기메이커', tier: 2, art: 's_mood_4', ability: 'dog', text: '활성 상태로 정비에 들어오면 통조림 +1. 고양이와 인접 불가.' },
  { id: 'coward_zombie', name: '겁쟁이 좀비', type: '겁쟁이', tier: 2, art: 's_coward_3', ability: 'freeMeal', text: '식사가 필요 없다. 겁이 나도 배는 안 고프다.' },
  { id: 'experiment', name: '실험체', type: '4차원', tier: 2, art: 's_weird_4', ability: 'wild', text: '파견할 때 원하는 추천 타입 하나를 대신한다.' },
  { id: 'vet', name: '수의사', type: '분위기메이커', tier: 2, art: 's_mood_3', ability: 'vet', text: '영입할 때 떠난 기본 생존자 한 명을 함께 데려올 수 있다.' },
  { id: 'runner', name: '탈옥수', type: '4차원', tier: 2, art: 's_weird_7', ability: 'runner', text: '영입 즉시 통조림 +4. 다음 정비에 병뚜껑 2개를 내거나 떠난다.' },
  { id: 'hamster', name: '삐딱한 햄스터', type: '반장', tier: 2, art: 's_military_2', ability: 'guard', text: '자신이 활성 상태라면 약탈로 잃는 자원이 1개 줄어든다.' },
  { id: 'plant', name: '걷는 식물', type: '용감이', tier: 2, art: 's_charge_3', ability: 'freeMeal', text: '식사 대신 광합성. 식사 비용 0.' },
  { id: 'teacher', name: '선생님', type: '반장', tier: 3, art: 's_military_5', ability: 'teacher', text: '자신이 파견된 판정에서 주사위 1개를 다시 굴릴 수 있다.' },
  { id: 'alien', name: '외계인', type: '4차원', tier: 3, art: 's_weird_6', ability: 'alien', text: '정비 때 자신을 포함해 2명까지 무료 식사. 통조림 안먹어 광선!' },
  { id: 'hero', name: '용사', type: '용감이', tier: 3, art: 's_charge_6', ability: 'guard', text: '활성 상태라면 약탈로 잃는 자원이 1개 줄어든다.' },
  { id: 'gardener', name: '가든일', type: '겁쟁이', tier: 3, art: 's_coward_6', ability: 'shelter', text: '재난에 식량을 내지 않는다. 숨을 곳은 이미 마련했다.' },
  { id: 'fan', name: '팬클럽 회장', type: '분위기메이커', tier: 3, art: 's_mood_5', ability: 'fan', text: '차례 시작 보급 때 통조림 +1. 팬들도 밥은 먹어야 한다.' },
].map(s => ({ cost: s.tier === 2 ? 5 : 7, score: s.tier === 2 ? 2 : 3, ...s }))

const scenes = [
  ['동네 비상식량', '고철 매각', '옥상 텃밭', '버려진 슈퍼', '골목의 자판기', '야간 벼룩시장'],
  ['무너진 물류창고', '폐차장 한 바퀴', '급식실을 지켜라', '외곽의 교환소', '전파탑 보급품', '철길 아래 금고'],
  ['최후의 통조림 공장', '군수창고 기습', '구름 위 온실', '마지막 거래소', '꽥의 연구소', '도시 아래 금고'],
]
export const EVENTS = [1, 2, 3].flatMap(tier => {
  const resources = scenes[tier - 1].map((name, i) => ({
    id: `supply_${tier}_${i}`, name, tier, kind: 'supply', target: [0, 5, 9, 13][tier],
    tags: tier === 1 ? [TYPES[i % 5]] : [TYPES[i % 5], TYPES[(i + 2) % 5]],
    resource: i % 2 ? 'cap' : 'can', reward: i % 2 ? [0, 3, 5, 7][tier] : [0, 4, 6, 8][tier],
    text: ['문은 잠겼고, 배는 고프다.', '멀리 갈수록 쓸 만한 것이 남아 있다.', '여기까지 온 김에, 한 상자만 더.'][tier - 1],
  }))
  return [...resources,
    { id: `coop_${tier}`, name: '무너진 창고', tier, kind: 'coop', tags: [], reward: 4, text: '혼자 들기엔 무겁다. 같이 들 사람?' },
    ...(tier > 1 ? [
      { id: `score_${tier}_a`, name: tier === 2 ? '잃어버린 기록' : '멸망 전의 명작', tier, kind: 'score', target: tier === 2 ? 9 : 13, tags: ['반장', '4차원'], reward: tier, text: '먹을 수는 없지만, 버릴 수는 없다.' },
      { id: `score_${tier}_b`, name: '마지막 구조 신호', tier, kind: 'score', target: tier === 2 ? 9 : 13, tags: ['용감이', '분위기메이커'], reward: tier, text: '누군가는 아직 기다리고 있다.' },
      { id: `raid_${tier}`, name: '슬쩍 빌려 갑니다', tier, kind: 'raid', target: 8, tags: ['용감이'], reward: 2, text: '언젠가는 갚을 거다. 아마도.' },
      { id: `treasure_${tier}`, name: '잠긴 여행가방', tier, kind: 'treasure', target: tier === 2 ? 9 : 13, tags: ['겁쟁이', '4차원'], reward: tier - 1, text: '아직 주인이 돌아오지 않았다.' },
    ] : []),
  ]
})
export const CLUES = [
  { tier: 1, name: '낙서된 약도', target: 9, min: 2, routes: [['겁쟁이', '분위기메이커'], ['반장', '용감이']] },
  { tier: 2, name: '끊어진 라디오', target: 13, min: 3, routes: [['반장', '4차원'], ['용감이', '겁쟁이']] },
  { tier: 3, name: '마지막 좌표', target: 17, min: 4, routes: [['4차원', '분위기메이커'], ['반장', '용감이']] },
]
export const TREASURES = [
  { id: 'ration', name: '비상 배낭', text: '행동 단계에 한 번 사용: 통조림 +3.', effect: 'can', amount: 3 },
  { id: 'compass', name: '행운의 나침반', text: '다음 주사위 판정 +2. 행동을 쓰지 않는다.', effect: 'bonus', amount: 2 },
  { id: 'medicine', name: '비상약', text: '행동 단계에 생존자 1명 즉시 활성화.', effect: 'wake', amount: 1 },
]
