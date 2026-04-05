/**
 * 이벤트 카드
 *
 * scope: 'personal' | 'global' | 'disaster'
 *   - personal  : 현재 플레이어가 해결 조건을 수행
 *   - global    : 공개 즉시 모든 플레이어에게 globalEffect 적용
 *   - disaster  : global과 동일, 난이도/시각적 구분
 *
 * resolution (scope === 'personal' 전용)
 *   해결 조건 타입:
 *   check_survivor_type   — 특정 속성 생존자가 내 파티에 존재하면 해결
 *   check_survivors_n     — 아무 생존자 N명 이상 존재하면 해결
 *   pay_can               — 통조림 N개 소모
 *   pay_cap               — 병뚜껑 N개 소모
 *   send_survivor_type    — 특정 속성 생존자 1명을 선택한 타 파티로 이전
 *   send_survivors_n      — 아무 생존자 N명을 선택한 타 파티로 이전
 *   remove_choice         — 내 파티 생존자 1명 직접 선택 제거
 *   remove_random         — 내 파티 생존자 무작위 제거
 *   take_from_party       — 타 파티 생존자 1명 선택 획득
 *   remove_from_party     — 타 파티 생존자 1명 선택 제거
 *   reorder_other_party   — 타 파티 생존자 순서 변경 (swap 1회)
 *   reorder_my_party      — 내 파티 생존자 순서 변경 (swap 1회)
 *
 * reward: 해결 성공 시 현재 플레이어가 받는 보상
 *
 * globalEffect (scope !== 'personal' 전용, 공개 즉시 발동)
 *   remove_all_n          — 모든 파티 생존자 N명 제거 (후미부터)
 *   add_survivors_all     — 모든 파티에 덱에서 생존자 N명 추가
 *   lose_can_n            — 모든 플레이어 통조림 N개 감소
 *   lose_cap_n            — 모든 플레이어 병뚜껑 N개 감소
 *   shuffle_all_parties   — 모든 파티 순서 랜덤 셔플
 */
export const EVENTS = [
  // ────────────────────────────────────────────
  // PERSONAL — pay 계열
  // ────────────────────────────────────────────
  {
    id: 'e_toll_road',
    category: 'resource',
    name: '통행세 징수',
    scope: 'personal',
    emoji: '🪙',
    description: '이 지역을 지나려면 통행세를 내야 한다. 병뚜껑 3개를 지불해 통과하라.',
    resolution: { type: 'pay_cap', amount: 3 },
    reward: { type: 'can', amount: 4 },
  },
  {
    id: 'e_food_tax',
    category: 'resource',
    name: '식량 공출',
    scope: 'personal',
    emoji: '🥫',
    description: '인근 세력이 식량을 요구하고 있다. 통조림 4개를 납부하면 안전하게 이동할 수 있다.',
    resolution: { type: 'pay_can', amount: 4 },
    reward: { type: 'cap', amount: 5 },
  },
  {
    id: 'e_bridge_fee',
    category: 'resource',
    name: '다리 통행료',
    scope: 'personal',
    emoji: '🌉',
    description: '다리를 건너려면 요금을 내야 한다. 병뚜껑 2개를 지불하라.',
    resolution: { type: 'pay_cap', amount: 2 },
    reward: { type: 'can', amount: 3 },
  },

  // ────────────────────────────────────────────
  // PERSONAL — check 계열 (조건 확인 후 자동 해결)
  // ────────────────────────────────────────────
  {
    id: 'e_need_muscle',
    category: 'resource',
    name: '험한 길',
    scope: 'personal',
    emoji: '🏔️',
    description: '험준한 산길. 군기반장이 있어야 안전하게 통과할 수 있다.',
    resolution: { type: 'check_survivor_type', survivorType: '군기반장' },
    reward: { type: 'cap', amount: 5 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_need_mood',
    category: 'resource',
    name: '무너진 사기',
    scope: 'personal',
    emoji: '😔',
    description: '파티의 사기가 바닥났다. 분위기메이커가 없으면 생존자 1명이 이탈한다.',
    resolution: { type: 'check_survivor_type', survivorType: '분위기메이커' },
    reward: { type: 'can', amount: 3 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_need_numbers',
    category: 'encounter',
    name: '인원 부족',
    scope: 'personal',
    emoji: '👥',
    description: '이 작업은 최소 3명이 필요하다. 생존자 3명 이상이면 해결 가능하며, 소문을 듣고 떠돌이 생존자 1명이 합류한다.',
    resolution: { type: 'check_survivors_n', amount: 3 },
    reward: { type: 'survivor', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_need_scout',
    category: 'encounter',
    name: '위험 구역',
    scope: 'personal',
    emoji: '⚠️',
    description: '4차원 생존자의 예측 능력이 필요하다. 길을 잡아내면 숨어 있던 생존자 1명이 파티에 합류한다. 없으면 무작위로 한 명이 다친다.',
    resolution: { type: 'check_survivor_type', survivorType: '4차원' },
    reward: { type: 'survivor', amount: 1 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },

  // ────────────────────────────────────────────
  // PERSONAL — remove 계열
  // ────────────────────────────────────────────
  {
    id: 'e_sacrifice',
    category: 'score',
    name: '희생 요구',
    scope: 'personal',
    emoji: '🔥',
    description: '무언가가 희생을 요구한다. 생존자 한 명을 직접 골라 보내면 위기를 넘긴 공으로 점수 1을 얻는다.',
    resolution: { type: 'remove_choice' },
    reward: { type: 'score', amount: 1 },
  },
  {
    id: 'e_random_misfortune',
    category: 'score',
    name: '불의의 사고',
    scope: 'personal',
    emoji: '💥',
    autoStartOnReveal: true,
    penalizeOnFail: true,
    description: '카드를 넘기는 순간 어딘가가 폭발한다. 사고를 수습하는 동안 무작위 생존자 1명을 잃지만, 위기를 넘긴 공으로 점수 1을 얻는다.',
    resolution: { type: 'remove_random', amount: 1 },
    reward: { type: 'score', amount: 1 },
  },
  {
    id: 'e_two_gone',
    category: 'score',
    name: '연쇄 이탈',
    scope: 'personal',
    emoji: '🚪',
    description: '파티 내 갈등이 심화됐다. 원하는 생존자 2명을 제거해 질서를 바로잡으면 점수 2를 얻는다.',
    resolution: { type: 'remove_choice', amount: 2 },
    reward: { type: 'score', amount: 2 },
  },

  // ────────────────────────────────────────────
  // PERSONAL — send 계열 (타 파티로 이전)
  // ────────────────────────────────────────────
  {
    id: 'e_send_troublemaker',
    category: 'attack',
    name: '골칫덩이 전가',
    scope: 'personal',
    emoji: '↗️',
    description: '군기반장 1명을 다른 파티로 보내면 해결. 그 대가로 통조림을 받는다.',
    resolution: { type: 'send_survivor_type', survivorType: '군기반장' },
    reward: { type: 'can', amount: 5 },
  },
  {
    id: 'e_refugee_wave',
    category: 'attack',
    name: '난민 이전',
    scope: 'personal',
    emoji: '🚶',
    description: '생존자 2명을 원하는 타 파티로 보내면 병뚜껑을 보상받는다.',
    resolution: { type: 'send_survivors_n', amount: 2 },
    reward: { type: 'cap', amount: 6 },
  },

  // ────────────────────────────────────────────
  // PERSONAL — take / remove from other party
  // ────────────────────────────────────────────
  {
    id: 'e_raid',
    category: 'attack',
    name: '습격',
    scope: 'personal',
    emoji: '⚡',
    description: '다른 파티를 습격해 생존자 1명을 데려온다.',
    resolution: { type: 'take_from_party' },
    reward: null,
  },
  {
    id: 'e_sabotage',
    category: 'attack',
    name: '방해 공작',
    scope: 'personal',
    emoji: '💣',
    description: '다른 파티의 생존자 1명을 제거한다. 통조림 2개를 지불하면 가능.',
    resolution: { type: 'pay_can', amount: 2, then: 'remove_from_party' },
    reward: null,
  },
  {
    id: 'e_headhunt',
    category: 'attack',
    name: '스카우트',
    scope: 'personal',
    emoji: '🎯',
    description: '다른 파티의 특정 생존자를 병뚜껑 3개로 데려온다.',
    resolution: { type: 'pay_cap', amount: 3, then: 'take_from_party' },
    reward: null,
  },

  // ────────────────────────────────────────────
  // PERSONAL — reorder 계열
  // ────────────────────────────────────────────
  {
    id: 'e_chaos_in_ranks',
    category: 'score',
    name: '내부 혼란',
    scope: 'personal',
    emoji: '🌀',
    description: '내 파티 내에서 생존자 2명의 순서를 직접 바꿔 질서를 되찾으면 점수 1을 얻는다.',
    resolution: { type: 'reorder_my_party' },
    reward: { type: 'score', amount: 1 },
  },
  {
    id: 'e_provoke',
    category: 'attack',
    name: '도발',
    scope: 'personal',
    emoji: '😤',
    description: '다른 파티의 생존자 2명의 순서를 바꾼다. 병뚜껑 1개를 지불하면 가능.',
    resolution: { type: 'pay_cap', amount: 1, then: 'reorder_other_party' },
    reward: null,
  },

  // ────────────────────────────────────────────
  // GLOBAL — 전체 영향
  // ────────────────────────────────────────────
  {
    id: 'e_global_conflict',
    name: '세력 충돌',
    scope: 'global',
    emoji: '⚔️',
    description: '각 파티에서 생존자 1명씩 제거된다.',
    globalEffect: { type: 'remove_all_n', amount: 1 },
  },
  {
    id: 'e_global_dance',
    name: '광란의 댄스파티',
    scope: 'global',
    emoji: '🕺',
    description: '모든 파티의 생존자 순서가 무작위로 섞인다.',
    globalEffect: { type: 'shuffle_all_parties' },
  },
  {
    id: 'e_global_supply',
    name: '구호물자 도착',
    scope: 'global',
    emoji: '📦',
    description: '모든 플레이어가 통조림 3개를 받는다.',
    globalEffect: { type: 'gain_can_all', amount: 3 },
  },
  {
    id: 'e_global_recruit',
    name: '대규모 합류',
    scope: 'global',
    emoji: '🧑‍🤝‍🧑',
    description: '모든 파티에 생존자 1명이 덱에서 자동 합류한다.',
    globalEffect: { type: 'add_survivors_all', amount: 1 },
  },
  {
    id: 'e_global_drain',
    name: '물자 약탈',
    scope: 'global',
    emoji: '💸',
    description: '모든 플레이어의 병뚜껑이 2개 감소한다.',
    globalEffect: { type: 'lose_cap_all', amount: 2 },
  },

  // ────────────────────────────────────────────
  // DISASTER — 재난
  // ────────────────────────────────────────────
  {
    id: 'e_disaster_comet',
    name: '혜성 충돌',
    scope: 'disaster',
    emoji: '☄️',
    description: '모든 파티에서 생존자 2명씩 제거된다.',
    globalEffect: { type: 'remove_all_n', amount: 2 },
  },
  {
    id: 'e_disaster_flood',
    name: '대홍수',
    scope: 'disaster',
    emoji: '🌊',
    description: '모든 플레이어의 통조림 5개 감소, 생존자 1명 무작위 제거.',
    globalEffect: { type: 'compound', effects: [
      { type: 'lose_can_all', amount: 5 },
      { type: 'remove_all_n', amount: 1 },
    ]},
  },
  {
    id: 'e_disaster_drought',
    name: '극심한 가뭄',
    scope: 'disaster',
    emoji: '🏜️',
    description: '모든 플레이어의 통조림이 절반으로 줄어든다.',
    globalEffect: { type: 'halve_can_all' },
  },
  {
    id: 'e_disaster_quake',
    name: '대지진',
    scope: 'disaster',
    emoji: '🌋',
    description: '모든 파티의 생존자 순서가 무작위로 섞이고 생존자 1명이 제거된다.',
    globalEffect: { type: 'compound', effects: [
      { type: 'shuffle_all_parties' },
      { type: 'remove_all_n', amount: 1 },
    ]},
  },
]
