/**
 * 이벤트 카드
 *
 * tier: 1 | 2 | 3 — 주변 탐색 난이도
 *   1단계: 근처 (일반 1명 / 단서 카드별 2~3명)
 *   2단계: 외곽 (일반 2~3명 / 단서 카드별 3~4명)
 *   3단계: 먼 곳 (일반 3~5명 / 단서 카드별 5명)
 *
 * scope: 'personal' | 'global' | 'disaster'
 *   personal : 현재 플레이어가 해결 조건을 수행
 *   global   : 공개 즉시 모든 플레이어에게 globalEffect 적용
 *   disaster : global과 동일, 난이도/시각적 구분
 *
 * recommendedParty (선택): 권장 파티 구성 — 충족 시 주사위 보너스
 *   [{ type: '타입명', count: n }]
 *
 * resolution (scope === 'personal' 전용)
 *   check_survivor_type   — 특정 타입 생존자를 실제 파견해야 해결
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
 *   global_effect         — 카드에 적힌 전체 효과를 현재 플레이어가 선택해 발동
 *   roll_dice             — 주사위 굴리기 (파견 인원 수만큼 주사위, 추천 파티 보너스 가산)
 *   roll_dice_score_bonus — 주사위 굴리기 (파견 인원 수만큼 주사위, 파티 총점 가산)
 *
 * reward: 해결 성공 시 현재 플레이어가 받는 보상
 *
 * globalEffect (scope !== 'personal' 전용, 공개 즉시 발동)
 *   remove_all_n        — 모든 파티 생존자 N명 제거 (후미부터)
 *   add_survivors_all   — 모든 파티에 덱에서 생존자 N명 추가
 *   lose_can_all        — 모든 플레이어 통조림 N개 감소
 *   lose_cap_all        — 모든 플레이어 병뚜껑 N개 감소
 *   gain_can_all        — 모든 플레이어 통조림 N개 증가
 *   shuffle_all_parties — 모든 파티 순서 랜덤 셔플
 *   halve_can_all       — 모든 플레이어 통조림 절반으로 감소
 *   compound            — 복합 효과
 */
export const EVENTS = [

  // ════════════════════════════════════════════════════════
  // 1단계 이벤트 — 근처
  // ════════════════════════════════════════════════════════

  // ── 자원 교환 ──────────────────────────────────────────
  {
    id: 'e_toll_road',
    tier: 1,
    count: 2,
    category: 'resource',
    name: '통행세 징수',
    scope: 'personal',
    emoji: '🪙',
    description: '이 지역을 지나려면 통행세를 식량으로 내야 한다. \n통조림 4개를 지불하면 병뚜껑 2개를 받는다.',
    resolution: { type: 'pay_can', amount: 4 },
    reward: { type: 'cap', amount: 2 },
  },
  {
    id: 'e_bridge_fee',
    tier: 1,
    count: 2,
    category: 'resource',
    name: '다리 통행료',
    scope: 'personal',
    emoji: '🌉',
    description: '다리를 건너려면 요금을 내야 한다. \n병뚜껑 2개를 지불하라.',
    resolution: { type: 'pay_cap', amount: 2 },
    reward: { type: 'can', amount: 3 },
  },

  // ── 조건 확인 ──────────────────────────────────────────
  {
    id: 'e_need_mood',
    tier: 1,
    category: 'resource',
    name: '숨은 식량 창고',
    scope: 'personal',
    emoji: '🥫',
    description: '근처 골목 깊숙한 곳에 비축 식량이 숨겨져 있다. 겁쟁이의 조심스러운 발걸음이 필요하다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: [{ type: 'can', amount: 1 }, { type: 'cap', amount: 2 }],
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_need_numbers',
    tier: 1,
    category: 'encounter',
    name: '인원 부족',
    scope: 'personal',
    emoji: '👥',
    description: '이 작업은 최소 3명이 필요하다. 생존자 3명 이상이면 해결 가능하며, 소문을 듣고 떠돌이 생존자 1명이 합류한다.',
    assignment: { minSurvivors: 3, maxSurvivors: 3 },
    resolution: { type: 'check_survivors_n', amount: 3 },
    reward: { type: 'survivor', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },

  // ── 근처 탐색 성과 ─────────────────────────────────────
  {
    id: 'e_safe_shortcut',
    tier: 1,
    category: 'score',
    name: '안전한 샛길',
    scope: 'personal',
    emoji: '🛤️',
    description: '무너진 담장 사이로 비교적 안전한 샛길을 발견했다. 길을 표시해두면 다음 탐색이 쉬워질 것이다.\n주사위 판정에 실패하면 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: { type: 'score', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 1 },
  },

  // ── 주사위 (쉬움, target ≤9) ─────────────────────────
  {
    id: 'e_dice_lucky',
    tier: 1,
    count: 2,
    category: 'dice',
    name: '행운의 발견',
    scope: 'personal',
    emoji: '🍀',
    description: '폐허에서 홀로 떠도는 생존자를 발견했다. \n같이 가자고 제안해볼까?\n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: [{ type: 'survivor', amount: 1 }, { type: 'cap', amount: 1 }],
    failPenalty: { type: 'lose_can', amount: 1 },
  },
  {
    id: 'e_dice_scavenge',
    tier: 1,
    count: 2,
    category: 'dice',
    name: '약탈 원정',
    scope: 'personal',
    emoji: '🎒',
    description: '황폐한 마을을 훑는다. \n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: [{ type: 'can', amount: 2 }, { type: 'cap', amount: 2 }],
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_near_cache',
    tier: 1,
    count: 2,
    category: 'resource',
    name: '동네 비상식량',
    scope: 'personal',
    emoji: '🧃',
    description: '가까운 주택가 지하실에서 비상식량 상자를 발견했다. 조심스럽게 꺼내오면 큰 도움이 된다.\n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: [{ type: 'can', amount: 4 }, { type: 'cap', amount: 1 }],
    failPenalty: { type: 'lose_can', amount: 1 },
  },
  {
    id: 'e_dice_negotiate',
    tier: 1,
    count: 2,
    category: 'dice',
    name: '불안한 협상',
    scope: 'personal',
    emoji: '🤝',
    description: '적대 세력과 협상을 시도한다. \n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: { type: 'cap', amount: 3 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_dice_rescue',
    tier: 1,
    count: 2,
    category: 'dice',
    name: '구조 작전',
    scope: 'personal',
    emoji: '🆘',
    description: '위험에 빠진 생존자를 찾았다. \n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: [{ type: 'survivor', amount: 1 }, { type: 'cap', amount: 2 }],
    failPenalty: { type: 'lose_can', amount: 1 },
  },
  {
    id: 'e_scrap_deal',
    tier: 1,
    count: 2,
    category: 'resource',
    name: '고철 거래',
    scope: 'personal',
    emoji: '🔩',
    description: '근처 폐차장에서 고철을 팔아 병뚜껑을 번다. \n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 5 },
    reward: { type: 'cap', amount: 4 },
    failPenalty: { type: 'lose_can', amount: 1 },
  },

  // ── 글로벌 (1단계) ────────────────────────────────────
  {
    id: 'e_global_supply',
    tier: 1,
    category: 'resource',
    name: '구호물자 도착',
    scope: 'personal',
    emoji: '📦',
    description: '구호물자 수송대가 도착했다. 받아들이면 모든 플레이어가 통조림 3개를 받는다.',
    resolution: { type: 'global_effect' },
    globalEffect: { type: 'gain_can_all', amount: 3 },
  },
  {
    id: 'e_global_recruit',
    tier: 1,
    category: 'encounter',
    name: '대규모 합류',
    scope: 'personal',
    emoji: '🧑‍🤝‍🧑',
    description: '근처 생존자 무리가 몰려온다. 받아들이면 모든 파티에 생존자 1명이 덱에서 자동 합류한다.',
    resolution: { type: 'global_effect' },
    globalEffect: { type: 'add_survivors_all', amount: 1 },
  },
  {
    id: 'e_global_dance',
    tier: 1,
    name: '광란의 댄스파티',
    scope: 'global',
    emoji: '🕺',
    description: '모든 파티의 생존자 순서가 무작위로 섞인다.',
    globalEffect: { type: 'shuffle_all_parties' },
  },


  // ════════════════════════════════════════════════════════
  // 2단계 이벤트 — 외곽
  // ════════════════════════════════════════════════════════

  // ── 자원 교환 ──────────────────────────────────────────
  {
    id: 'e_food_tax',
    tier: 2,
    category: 'resource',
    name: '식량 공출',
    scope: 'personal',
    emoji: '🥫',
    description: '인근 세력이 식량을 요구하고 있다. \n통조림 4개를 납부하면 안전하게 이동할 수 있다.',
    resolution: { type: 'pay_can', amount: 4 },
    reward: { type: 'cap', amount: 5 },
  },
  {
    id: 'e_street_vendor',
    tier: 2,
    count: 2,
    category: 'resource',
    name: '노점 거래',
    scope: 'personal',
    emoji: '🛒',
    description: '외곽 거리의 노점에서 잡동사니를 팔아 병뚜껑을 모은다. \n실패시 아무것도 얻지 못한다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 7 },
    reward: { type: 'cap', amount: 5 },
    failPenalty: null,
  },
  {
    id: 'e_cap_stash',
    tier: 2,
    count: 2,
    category: 'resource',
    name: '병뚜껑 은닉처',
    scope: 'personal',
    emoji: '💰',
    description: '외곽 폐건물에서 숨겨진 병뚜껑 더미를 발견했다. 재빨리 챙기면 큰 도움이 된다.\n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'cap', amount: 6 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },

  // ── 조건 확인 ──────────────────────────────────────────
  {
    id: 'e_need_muscle',
    tier: 2,
    category: 'resource',
    name: '험한 길',
    scope: 'personal',
    emoji: '🏔️',
    description: '험준한 산길. 군기반장이 있어야 안전하게 통과할 수 있다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'cap', amount: 5 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_need_scout',
    tier: 2,
    category: 'encounter',
    name: '위험 구역',
    scope: 'personal',
    emoji: '⚠️',
    description: '4차원 생존자의 예측 능력이 필요하다. 길을 잡아내면 숨어 있던 생존자 1명이 파티에 합류한다. 없으면 무작위로 한 명이 다친다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'survivor', amount: 1 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },

  // ── 희생/손실 ──────────────────────────────────────────
  {
    id: 'e_internal_chaos',
    tier: 2,
    category: 'score',
    name: '무너진 검문소 정리',
    scope: 'personal',
    emoji: '🚧',
    description: '외곽 검문소가 무너져 길이 막혔다. 파티 진형을 정리해 통로를 확보하면 점수 1을 얻는다.',
    resolution: { type: 'reorder_my_party' },
    reward: { type: 'score', amount: 1 },
  },
  {
    id: 'e_sacrifice',
    tier: 2,
    category: 'score',
    name: '위험한 잔해 정리',
    scope: 'personal',
    emoji: '🔥',
    description: '무너진 잔해 너머로 길이 이어진다. \n생존자 한 명을 직접 골라 보내면 위기를 넘긴 공으로 점수 1을 얻는다.',
    resolution: { type: 'remove_choice' },
    reward: { type: 'score', amount: 1 },
  },
  {
    id: 'e_random_misfortune',
    tier: 2,
    category: 'score',
    name: '낙석 사고',
    scope: 'personal',
    emoji: '💥',
    autoStartOnReveal: true,
    penalizeOnFail: true,
    description: '외곽 절벽에서 돌무더기가 쏟아진다. \n사고를 수습하는 동안 무작위 생존자 1명을 잃지만, \n위기를 넘긴 공으로 점수 1을 얻는다.',
    resolution: { type: 'remove_random', amount: 1 },
    reward: { type: 'score', amount: 1 },
  },

  // ── 이전 (send) ────────────────────────────────────────
  {
    id: 'e_send_troublemaker',
    tier: 2,
    category: 'interaction',
    name: '가짜 좌표 흘리기',
    scope: 'personal',
    emoji: '↗️',
    description: '4차원이 경로 정보를 비틀어 다른 파티에 골칫덩이를 떠넘긴다. 성공하면 통조림을 받는다.',
    requiredType: '4차원',
    resolution: { type: 'send_survivor_type', survivorType: '반장' },
    reward: { type: 'can', amount: 4 },
  },
  {
    id: 'e_refugee_wave',
    tier: 2,
    category: 'interaction',
    name: '난민 행렬 유도',
    scope: 'personal',
    emoji: '🚶',
    description: '반장 생존자의 지휘 하에 흩어진 난민 행렬의 방향을 조정한다. 생존자 2명을 원하는 타 파티로 보내면 병뚜껑을 보상받는다.',
    requiredType: '반장',
    resolution: { type: 'send_survivors_n', amount: 2 },
    reward: { type: 'cap', amount: 6 },
  },

  // ── 교란 / 무덤 ────────────────────────────────────────
  {
    id: 'e_provoke',
    tier: 2,
    category: 'interaction',
    name: '경로 교란',
    scope: 'personal',
    emoji: '😤',
    description: '4차원 생존자의 비틀린 직관으로 다른 파티의 이동 경로를 꼬아놓는다. 병뚜껑 1개를 지불하고 상대 파티 생존자 2명의 순서를 바꾼다.',
    requiredType: '4차원',
    resolution: { type: 'pay_cap', amount: 1, then: 'reorder_other_party' },
    reward: null,
  },
  {
    id: 'e_steal_grave',
    tier: 2,
    category: 'encounter',
    name: '무덤 약탈',
    scope: 'personal',
    emoji: '⚰️',
    description: '떠난 생존자 더미에서 생존자 1명을 데려온다.',
    resolution: { type: 'steal_from_grave' },
    reward: { type: 'survivor', amount: 1 },
  },
  {
    id: 'e_revive_grave',
    tier: 2,
    category: 'score',
    name: '기적의 소생',
    scope: 'personal',
    emoji: '💫',
    description: '겁쟁이 생존자의 간절한 바람이 기적을 불러온다. 떠난 생존자 더미에서 생존자 1명을 파티로 되돌린다. 파티가 가득 차 있거나 떠난 생존자가 없으면 해결 불가.',
    requiredType: '겁쟁이',
    resolution: { type: 'revive_from_grave' },
    reward: { type: 'score', amount: 1 },
  },

  // ── 주사위 (중급, target 10~11) ──────────────────────
  {
    id: 'e_dice_ruins',
    tier: 2,
    category: 'dice',
    name: '폐허 탐색',
    scope: 'personal',
    emoji: '🏚️',
    description: '폐건물 더미를 뒤져 물자를 찾는다. \n실패시 생존자 1명이 다친다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: [{ type: 'can', amount: 3 }, { type: 'cap', amount: 2 }],
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_dice_storm',
    tier: 2,
    category: 'dice',
    name: '폭풍 속 행군',
    scope: 'personal',
    emoji: '⛈️',
    description: '거센 폭풍을 뚫고 전진한다. \n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'cap', amount: 4 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_dice_crossing',
    tier: 2,
    category: 'dice',
    name: '위험한 도하',
    scope: 'personal',
    emoji: '🏊',
    description: '급류를 건너야 한다. \n실패시 통조림 3개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'cap', amount: 4 },
    failPenalty: { type: 'lose_can', amount: 3 },
  },
  {
    id: 'e_dice_trap',
    tier: 2,
    category: 'dice',
    name: '함정 피하기',
    scope: 'personal',
    emoji: '⚙️',
    description: '누군가 장치해 둔 함정이 있다. \n실패시 동료를 한명 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'cap', amount: 4 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_dice_escape',
    tier: 2,
    category: 'dice',
    name: '어둠 속 탈출',
    scope: 'personal',
    emoji: '🚀',
    description: '추격자들을 따돌려야 한다. \n실패하면 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'cap', amount: 4 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_dice_wait',
    tier: 2,
    category: 'dice',
    name: '숨죽여 기다리기',
    scope: 'personal',
    emoji: '🫣',
    description: '위험이 지나가길 기다려볼까?\n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: { type: 'score', amount: 2 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_dice_signal',
    tier: 2,
    category: 'dice',
    name: '수상한 신호',
    scope: 'personal',
    emoji: '📡',
    description: '미지의 신호를 수신했다.\n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: [{ type: 'cap', amount: 3 }, { type: 'can', amount: 3 }],
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_dice_parley',
    tier: 2,
    category: 'dice',
    name: '담판 짓기',
    scope: 'personal',
    emoji: '🗣️',
    description: '세력 수장과 맞담판을 벌인다. \n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 9 },
    reward: [{ type: 'cap', amount: 4 }, { type: 'score', amount: 1 }],
    failPenalty: { type: 'lose_can', amount: 2 },
  },

  {
    id: 'e_dice_credibility',
    tier: 2,
    category: 'dice',
    name: '세력 심사',
    scope: 'personal',
    emoji: '🎖️',
    description: '외곽 세력이 파티를 심사한다. 파티의 총 역량이 높을수록 유리하다.\n주사위 합 + 파티 총점으로 판정한다.\n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice_score_bonus', diceCount: 1, target: 14 },
    reward: [{ type: 'cap', amount: 4 }, { type: 'score', amount: 1 }],
    failPenalty: { type: 'lose_can', amount: 2 },
  },

  // ── 글로벌 (2단계) ────────────────────────────────────
  {
    id: 'e_global_conflict',
    tier: 2,
    name: '세력 충돌',
    scope: 'global',
    emoji: '⚔️',
    description: '각 파티에서 생존자 1명씩 제거된다.',
    globalEffect: { type: 'remove_all_n', amount: 1 },
  },
  {
    id: 'e_global_drain',
    tier: 2,
    category: 'attack',
    name: '물자 약탈',
    scope: 'personal',
    emoji: '💸',
    description: '약탈이 번진다. 받아들이면 모든 플레이어의 병뚜껑이 2개 감소한다.',
    resolution: { type: 'global_effect' },
    globalEffect: { type: 'lose_cap_all', amount: 2 },
  },
  {
    id: 'e_border_raid',
    tier: 2,
    category: 'attack',
    name: '외곽 초소 급습',
    scope: 'personal',
    emoji: '🛡️',
    description: '외곽 초소를 급습해 상대 파티의 핵심 인원을 흔든다. 병뚜껑 2개를 지불하면 상대 생존자 1명을 제거할 수 있다.',
    resolution: { type: 'pay_cap', amount: 2, then: 'remove_from_party' },
    reward: null,
  },
  {
    id: 'e_coerce',
    tier: 2,
    category: 'attack',
    name: '협박',
    scope: 'personal',
    emoji: '😠',
    description: '용감이 생존자의 위압적인 태도로 상대 파티에서 생존자 1명을 이탈시킨다. 병뚜껑 1개를 소모한다.',
    requiredType: '용감이',
    resolution: { type: 'pay_cap', amount: 1, then: 'remove_from_party' },
    reward: null,
  },
  {
    id: 'e_poach',
    tier: 2,
    category: 'attack',
    name: '인재 영입',
    scope: 'personal',
    emoji: '🎭',
    description: '분위기메이커 생존자의 매력으로 상대 파티의 생존자 1명을 설득해 영입한다.',
    requiredType: '분위기메이커',
    resolution: { type: 'take_from_party' },
    reward: null,
  },


  // ════════════════════════════════════════════════════════
  // 3단계 이벤트 — 먼 탐색
  // ════════════════════════════════════════════════════════

  // ── 고위험 희생 ────────────────────────────────────────
  {
    id: 'e_two_gone',
    tier: 3,
    category: 'score',
    name: '최종 진형 정비',
    scope: 'personal',
    emoji: '🚪',
    description: '유토피아 직전, 더는 모두를 데려갈 수 없다. \n원하는 생존자 2명을 제거해 최종 진형을 완성하면 점수 2를 얻는다.',
    resolution: { type: 'remove_choice', amount: 2 },
    reward: { type: 'score', amount: 2 },
  },

  // ── 강탈 / 교전 ────────────────────────────────────────
  {
    id: 'e_raid',
    tier: 3,
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
    tier: 3,
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
    tier: 3,
    category: 'attack',
    name: '스카우트',
    scope: 'personal',
    emoji: '🎯',
    description: '다른 파티의 특정 생존자를 병뚜껑 3개로 데려온다.',
    resolution: { type: 'pay_cap', amount: 3, then: 'take_from_party' },
    reward: null,
  },
  {
    id: 'e_necromancer',
    tier: 3,
    category: 'interaction',
    name: '강령술사의 거래',
    scope: 'personal',
    emoji: '🧟',
    description: '통조림 3개를 지불하고 떠난 생존자 더미에서 생존자 1명을 데려와 내 파티에 합류시킨다.',
    resolution: { type: 'pay_can', amount: 3, then: 'steal_from_grave' },
    reward: null,
  },
  {
    id: 'e_distorted_beacon',
    tier: 3,
    category: 'attack',
    name: '왜곡된 신호탑',
    scope: 'personal',
    emoji: '📶',
    description: '먼 곳의 신호탑을 조작해 상대 파티의 생존자 1명을 혼란에 빠뜨려 이탈시킨다. 병뚜껑 3개를 지불하면 점수 1을 얻는다.',
    resolution: { type: 'pay_cap', amount: 3, then: 'remove_from_party' },
    reward: { type: 'score', amount: 1 },
  },
  {
    id: 'e_infiltrate',
    tier: 3,
    category: 'attack',
    name: '침투 공작',
    scope: 'personal',
    emoji: '🕵️',
    description: '겁쟁이 생존자의 은밀한 침투로 상대 파티에서 생존자 1명을 몰래 빼온다.',
    requiredType: '겁쟁이',
    resolution: { type: 'take_from_party' },
    reward: null,
  },
  {
    id: 'e_double_threat',
    tier: 3,
    category: 'attack',
    name: '이중 협박',
    scope: 'personal',
    emoji: '🔱',
    description: '강력한 위협으로 상대 파티의 생존자 1명을 이탈시킨다. 병뚜껑 4개를 지불하면 점수 1도 얻는다.',
    resolution: { type: 'pay_cap', amount: 4, then: 'remove_from_party' },
    reward: { type: 'score', amount: 1 },
  },

  {
    id: 'e_dice_elite_gate',
    tier: 3,
    category: 'dice',
    name: '정예 관문',
    scope: 'personal',
    emoji: '🏛️',
    description: '유토피아로 향하는 마지막 방어선. 파티의 진가를 증명해야만 통과할 수 있다.\n주사위 합 + 파티 총점으로 판정한다.\n실패시 생존자 1명이 다친다.',
    resolution: { type: 'roll_dice_score_bonus', diceCount: 1, target: 20 },
    reward: [{ type: 'score', amount: 2 }, { type: 'cap', amount: 5 }],
    failPenalty: { type: 'remove_random', amount: 1 },
  },

  // ── 주사위 (고난이도, target 11~13) ──────────────────
  {
    id: 'e_dice_ambush',
    tier: 3,
    category: 'dice',
    name: '야간 기습',
    scope: 'personal',
    emoji: '🌙',
    description: '어둠 속에서 적 세력을 기습한다. \n실패시 생존자 1명이 다친다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 13 },
    reward: [{ type: 'score', amount: 2 }, { type: 'cap', amount: 3 }],
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_dice_abandoned',
    tier: 3,
    category: 'dice',
    name: '버려진 기지',
    scope: 'personal',
    emoji: '🏕️',
    description: '오래된 군사 기지를 발견했다. \n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 13 },
    reward: [{ type: 'survivor', amount: 1 }, { type: 'cap', amount: 3 }],
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_dice_tunnel',
    tier: 3,
    category: 'dice',
    name: '비밀 통로',
    scope: 'personal',
    emoji: '🕳️',
    description: '지하 통로를 발견했다. \n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 13 },
    reward: [{ type: 'survivor', amount: 1 }, { type: 'cap', amount: 3 }],
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_dice_miracle',
    tier: 3,
    category: 'dice',
    name: '기적의 경로',
    scope: 'personal',
    emoji: '🌈',
    description: '예상치 못한 안전한 길이 열렸다.\n파티의 운을 시험해 보자\n실패시 통조림 3개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 13 },
    reward: [{ type: 'score', amount: 2 }, { type: 'cap', amount: 3 }],
    failPenalty: { type: 'lose_can', amount: 3 },
  },
  {
    id: 'e_dice_gamble',
    tier: 3,
    category: 'dice',
    name: '목숨을 건 도박',
    scope: 'personal',
    emoji: '🎰',
    description: '다 걸었다.\n실패시 통조림 4개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 13 },
    reward: [{ type: 'score', amount: 2 }, { type: 'cap', amount: 4 }],
    failPenalty: { type: 'lose_can', amount: 4 },
  },
  {
    id: 'e_dice_lastbet',
    tier: 3,
    category: 'dice',
    name: '최후의 도박',
    scope: 'personal',
    emoji: '🃏',
    description: '모든 것을 걸었다. \n실패시 동료를 한명 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 15 },
    reward: { type: 'score', amount: 4 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },


  // ════════════════════════════════════════════════════════
  // 유토피아 단서 — 단계당 최대 4장 (게임 시작 시 플레이어 수만큼 포함)
  // ════════════════════════════════════════════════════════

  // ── 1단계 단서 (2명→target 8 / 3명→target 11) ─────────────
  {
    id: 'e_clue_1_flyer',
    tier: 1,
    category: 'clue',
    name: '낡은 전단지',
    scope: 'personal',
    emoji: '📄',
    description: '근처 건물 벽에 붙어있던 오래된 전단지. \n점선이 어딘가를 가리키고 있다.\n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 8 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 1 },
  },
  {
    id: 'e_clue_1_radio',
    tier: 1,
    category: 'clue',
    name: '흐릿한 라디오 신호',
    scope: 'personal',
    emoji: '📻',
    description: '잡음 속에 누군가의 목소리가 들린다. \n집중하면 방향을 파악할 수 있을 것 같다.\n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 8 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 1 },
  },
  {
    id: 'e_clue_1_sketch',
    tier: 1,
    category: 'clue',
    name: '낙서된 약도',
    scope: 'personal',
    emoji: '✏️',
    description: '누군가 급히 그린 것 같은 약도가 보인다. \n해독하면 단서가 될 수 있다.\n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 11 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 1 },
  },
  {
    id: 'e_clue_1_rumor',
    tier: 1,
    category: 'clue',
    name: '목격자의 소문',
    scope: 'personal',
    emoji: '👂',
    description: '근처 주민에게 들은 소문. \n어딘가에 안전한 곳이 있다고...\n실패시 통조림 1개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 11 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 1 },
  },

  // ── 2단계 단서 (3명→target 11 / 4명→target 14) ─────────────
  {
    id: 'e_clue_map',
    tier: 2,
    category: 'clue',
    name: '유토피아 지도 조각',
    scope: 'personal',
    emoji: '🗺️',
    description: '찢긴 지도 한 조각. \n점선이 가리키는 방향에 우리가 찾던 그 땅이 있는 것 같다.\n실패시 생존자 1명이 다친다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 11 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_clue_witness',
    tier: 2,
    category: 'clue',
    name: '생존자의 증언',
    scope: 'personal',
    emoji: '👁️',
    description: '「거긴 진짜 있어. 내가 봤다고.」 유토피아를 목격한 생존자의 증언.\n실패시 통조림 3개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 11 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 3 },
  },
  {
    id: 'e_clue_2_audio',
    tier: 2,
    category: 'clue',
    name: '음성 기록 단편',
    scope: 'personal',
    emoji: '🎙️',
    description: '연구소에서 발견한 손상된 녹음기. \n내용을 복원하면 좌표에 대한 단서를 얻을 수 있다.\n실패시 통조림 2개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 14 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 2 },
  },
  {
    id: 'e_clue_2_docs',
    tier: 2,
    category: 'clue',
    name: '비밀 연구 문서',
    scope: 'personal',
    emoji: '📋',
    description: '분류 표시가 된 문서. \n유토피아 관련 연구 기록인 것 같다.\n실패시 생존자 1명이 다친다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 14 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },

  // ── 3단계 단서 (5명→target 17) ───────────
  {
    id: 'e_clue_3_broadcast',
    tier: 3,
    category: 'clue',
    name: '최후의 방송',
    scope: 'personal',
    emoji: '📺',
    description: '세상이 무너지기 직전 마지막으로 송출된 방송. \n좌표를 해독할 수 있다면...\n실패시 생존자 1명이 다친다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 17 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_clue_3_coords',
    tier: 3,
    category: 'clue',
    name: '유토피아 좌표',
    scope: 'personal',
    emoji: '🛰️',
    description: '암호화된 좌표 데이터. \n해독 완료 시 목적지가 확정된다.\n실패시 통조림 4개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 17 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 4 },
  },
  {
    id: 'e_clue_3_blueprint',
    tier: 3,
    category: 'clue',
    name: '유토피아 설계도',
    scope: 'personal',
    emoji: '📐',
    description: '방대한 도면. \n규모가 실제라면, 수천 명이 살 수 있는 곳이다.\n실패시 생존자 1명이 다친다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 17 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'remove_random', amount: 1 },
  },
  {
    id: 'e_clue_3_code',
    tier: 3,
    category: 'clue',
    name: '핵심 접근 코드',
    scope: 'personal',
    emoji: '🔑',
    description: '유토피아 진입을 위한 마지막 코드. \n이게 진짜라면...\n실패시 통조림 3개를 잃는다.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 17 },
    reward: { type: 'clue', amount: 1 },
    failPenalty: { type: 'lose_can', amount: 3 },
  },


  // ════════════════════════════════════════════════════════
  // 유토피아 — 3단계 단서 1개 획득 시 공개 / 3단계 진입 플레이어만 도전 가능
  // ════════════════════════════════════════════════════════
  {
    id: 'e_utopia',
    tier: 3,
    category: 'utopia',
    name: '유토피아',
    scope: 'personal',
    emoji: '🌅',
    description: '마침내, 전설로만 전해지던 그 땅이 눈앞에 펼쳐졌다.\n운명이 이곳으로 이끈 것인지, 아니면 실낱 같은 희망이 기적을 불러온 것인지...\n파티의 전력을 모아 끝까지 돌파하라.',
    resolution: { type: 'roll_dice', diceCount: 1, target: 15 },
    recommendedParty: [
      { type: '용감이', count: 2 },
      { type: '분위기메이커', count: 1 },
    ],
    reward: { type: 'score', amount: 5 },
  },


  // ════════════════════════════════════════════════════════
  // 재난 — 단계별 배분 (1단계 1장 / 2단계 2장 / 3단계 3장)
  // ════════════════════════════════════════════════════════

  // ── 1단계 재난 ────────────────────────────────────────
  {
    id: 'e_disaster_rain',
    tier: 1,
    name: '폭우',
    scope: 'disaster',
    emoji: '🌧️',
    description: '갑작스러운 폭우가 쏟아진다. 식량이 물에 잠긴다.\n모든 플레이어의 통조림이 2개 감소한다.',
    globalEffect: { type: 'lose_can_all', amount: 2 },
  },

  // ── 2단계 재난 ────────────────────────────────────────
  {
    id: 'e_disaster_drought',
    tier: 2,
    name: '극심한 가뭄',
    scope: 'disaster',
    emoji: '🏜️',
    description: '모든 플레이어의 통조림이 절반으로 줄어든다.',
    globalEffect: { type: 'halve_can_all' },
  },
  {
    id: 'e_disaster_quake',
    tier: 2,
    name: '대지진',
    scope: 'disaster',
    emoji: '🌋',
    description: '모든 파티의 생존자 순서가 무작위로 섞이고 생존자 1명이 제거된다.',
    globalEffect: { type: 'compound', effects: [
      { type: 'shuffle_all_parties' },
      { type: 'remove_all_n', amount: 1 },
    ]},
  },

  // ── 3단계 재난 ────────────────────────────────────────
  {
    id: 'e_disaster_flood',
    tier: 3,
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
    id: 'e_disaster_comet',
    tier: 3,
    name: '혜성 충돌',
    scope: 'disaster',
    emoji: '☄️',
    description: '모든 파티에서 생존자 2명씩 제거된다.',
    globalEffect: { type: 'remove_all_n', amount: 2 },
  },
  {
    id: 'e_disaster_nuclear',
    tier: 3,
    name: '핵폭발 여파',
    scope: 'disaster',
    emoji: '☢️',
    description: '지평선 너머에서 버섯구름이 피어오른다.\n모든 파티에서 생존자 2명이 제거되고, 병뚜껑이 4개 감소한다.',
    globalEffect: { type: 'compound', effects: [
      { type: 'remove_all_n', amount: 2 },
      { type: 'lose_cap_all', amount: 4 },
    ]},
  },
]

const TIER_ASSIGNMENT = {
  1: { minSurvivors: 1, maxSurvivors: 1 },
  2: { minSurvivors: 2, maxSurvivors: 3 },
  3: { minSurvivors: 3, maxSurvivors: 5 },
}

const DEFAULT_RECOMMENDED_PARTY_BONUS = 2

const RECOMMENDED_PARTY_BY_EVENT_ID = {
  // 1단계: 근처에서 식량/돈/동료를 모으는 구간. 겁쟁이와 분위기메이커 사용 빈도를 높인다.
  e_toll_road: [{ type: '겁쟁이', count: 1 }],
  e_bridge_fee: [{ type: '겁쟁이', count: 1 }],
  e_need_mood: [{ type: '겁쟁이', count: 1 }],
  e_need_numbers: [{ type: '분위기메이커', count: 1 }],
  e_safe_shortcut: [{ type: '겁쟁이', count: 1 }],
  e_dice_lucky: [{ type: '분위기메이커', count: 1 }],
  e_dice_scavenge: [{ type: '겁쟁이', count: 1 }],
  e_near_cache: [{ type: '겁쟁이', count: 1 }],
  e_dice_negotiate: [{ type: '4차원', count: 1 }],
  e_dice_rescue: [{ type: '분위기메이커', count: 1 }],
  e_clue_1_flyer: [{ type: '4차원', count: 1 }],
  e_clue_1_radio: [{ type: '4차원', count: 1 }],
  e_clue_1_sketch: [{ type: '반장', count: 1 }],
  e_clue_1_rumor: [{ type: '분위기메이커', count: 1 }],

  // 2단계: 외곽 세력과 재난성 난관. 반장/용감이 중심, 견제는 4차원으로 분리한다.
  e_food_tax: [{ type: '반장', count: 1 }, { type: '겁쟁이', count: 1 }],
  e_need_muscle: [{ type: '반장', count: 1 }, { type: '용감이', count: 1 }],
  e_need_scout: [{ type: '분위기메이커', count: 1 }, { type: '4차원', count: 1 }],
  e_internal_chaos: [{ type: '반장', count: 1 }, { type: '4차원', count: 1 }],
  e_sacrifice: [{ type: '반장', count: 1 }, { type: '용감이', count: 1 }],
  e_random_misfortune: [{ type: '반장', count: 1 }, { type: '겁쟁이', count: 1 }],
  e_send_troublemaker: [{ type: '4차원', count: 1 }, { type: '겁쟁이', count: 1 }],
  e_refugee_wave: [{ type: '4차원', count: 1 }, { type: '분위기메이커', count: 1 }],
  e_provoke: [{ type: '4차원', count: 1 }, { type: '반장', count: 1 }],
  e_steal_grave: [{ type: '분위기메이커', count: 1 }, { type: '4차원', count: 1 }],
  e_revive_grave: [{ type: '분위기메이커', count: 1 }, { type: '반장', count: 1 }],
  e_dice_ruins: [{ type: '겁쟁이', count: 1 }, { type: '반장', count: 1 }],
  e_dice_storm: [{ type: '반장', count: 1 }, { type: '용감이', count: 1 }],
  e_dice_crossing: [{ type: '용감이', count: 1 }, { type: '반장', count: 1 }],
  e_dice_trap: [{ type: '반장', count: 1 }, { type: '4차원', count: 1 }],
  e_dice_escape: [{ type: '용감이', count: 1 }, { type: '겁쟁이', count: 1 }],
  e_dice_wait: [{ type: '겁쟁이', count: 1 }, { type: '반장', count: 1 }],
  e_dice_signal: [{ type: '겁쟁이', count: 1 }, { type: '4차원', count: 1 }],
  e_dice_parley: [{ type: '분위기메이커', count: 1 }, { type: '반장', count: 1 }],
  e_dice_credibility: [{ type: '반장', count: 1 }, { type: '분위기메이커', count: 1 }],
  e_global_drain: [{ type: '용감이', count: 1 }, { type: '반장', count: 1 }],
  e_border_raid: [{ type: '용감이', count: 1 }, { type: '반장', count: 1 }],
  e_clue_map: [{ type: '반장', count: 1 }, { type: '겁쟁이', count: 1 }],
  e_clue_witness: [{ type: '분위기메이커', count: 1 }, { type: '반장', count: 1 }],
  e_clue_2_audio: [{ type: '4차원', count: 1 }, { type: '반장', count: 1 }],
  e_clue_2_docs: [{ type: '반장', count: 1 }, { type: '4차원', count: 1 }],

  // 3단계: 먼 곳. 점수 최적화는 반장, 역전/규칙 비틀기는 4차원, 강행 돌파는 용감이가 담당한다.
  e_two_gone: [{ type: '반장', count: 2 }, { type: '4차원', count: 1 }],
  e_raid: [{ type: '용감이', count: 2 }, { type: '반장', count: 1 }],
  e_sabotage: [{ type: '용감이', count: 1 }, { type: '4차원', count: 1 }, { type: '반장', count: 1 }],
  e_headhunt: [{ type: '용감이', count: 1 }, { type: '분위기메이커', count: 1 }, { type: '4차원', count: 1 }],
  e_necromancer: [{ type: '4차원', count: 2 }, { type: '분위기메이커', count: 1 }],
  e_distorted_beacon: [{ type: '4차원', count: 2 }, { type: '반장', count: 1 }],
  e_dice_ambush: [{ type: '용감이', count: 2 }, { type: '겁쟁이', count: 1 }],
  e_dice_abandoned: [{ type: '분위기메이커', count: 1 }, { type: '반장', count: 1 }, { type: '용감이', count: 1 }],
  e_dice_tunnel: [{ type: '분위기메이커', count: 1 }, { type: '4차원', count: 1 }, { type: '겁쟁이', count: 1 }],
  e_dice_miracle: [{ type: '분위기메이커', count: 1 }, { type: '4차원', count: 1 }, { type: '겁쟁이', count: 1 }],
  e_dice_gamble: [{ type: '4차원', count: 2 }, { type: '용감이', count: 1 }],
  e_dice_lastbet: [{ type: '4차원', count: 1 }, { type: '용감이', count: 2 }],
  e_dice_elite_gate: [{ type: '반장', count: 2 }, { type: '분위기메이커', count: 1 }],
  e_clue_3_broadcast: [{ type: '4차원', count: 2 }, { type: '분위기메이커', count: 1 }],
  e_clue_3_coords: [{ type: '4차원', count: 2 }, { type: '반장', count: 1 }],
  e_clue_3_blueprint: [{ type: '반장', count: 2 }, { type: '4차원', count: 1 }],
  e_clue_3_code: [{ type: '4차원', count: 2 }, { type: '겁쟁이', count: 1 }],
}

const CLUE_ASSIGNMENT_SEQUENCE = {
  1: [2, 2, 3, 3],
  2: [3, 3, 4, 4],
  3: [5, 5, 5, 5],
}

function cloneAssignmentForTier(tier) {
  const assignment = TIER_ASSIGNMENT[tier] ?? TIER_ASSIGNMENT[1]
  return { ...assignment }
}

function cloneCardAssignment(card) {
  if (card.assignment) return { ...card.assignment }
  return cloneAssignmentForTier(card.tier)
}

function cloneClueAssignment(card) {
  const tier = card.tier ?? 1
  const tierClues = EVENTS.filter((entry) => entry.category === 'clue' && entry.tier === tier)
  const clueIndex = Math.max(0, tierClues.findIndex((entry) => entry.id === card.id))
  const required = card.assignment?.minSurvivors
    ?? CLUE_ASSIGNMENT_SEQUENCE[tier]?.[clueIndex % (CLUE_ASSIGNMENT_SEQUENCE[tier]?.length ?? 1)]
    ?? cloneAssignmentForTier(tier).minSurvivors
  return {
    minSurvivors: required,
    maxSurvivors: required,
  }
}

function inferDeck(card) {
  if (card.category === 'clue') return 'clue'
  if (card.scope === 'disaster') return 'disaster'
  if (card.category === 'utopia') return 'utopia'
  return 'exploration'
}

function normalizeRewards(reward) {
  if (!reward) return []
  return Array.isArray(reward) ? reward : [reward]
}

function normalizeRecommendedParty(card) {
  const recommendedParty = card.recommendedParty ?? RECOMMENDED_PARTY_BY_EVENT_ID[card.id] ?? []
  return recommendedParty.map((entry) => ({ ...entry }))
}

function normalizeExplorationCard(card) {
  const deck = inferDeck(card)
  const isClue = deck === 'clue'
  const isDisaster = deck === 'disaster'
  const isUtopia = deck === 'utopia'
  const recommendedParty = normalizeRecommendedParty(card)

  const base = {
    ...card,
    deck,
    assignment: isDisaster ? null : (isClue ? cloneClueAssignment(card) : cloneCardAssignment(card)),
    ...(recommendedParty.length > 0 ? {
      recommendedParty,
      recommendedPartyBonus: card.recommendedPartyBonus ?? DEFAULT_RECOMMENDED_PARTY_BONUS,
    } : {}),
  }

  if (isDisaster) {
    return {
      ...base,
      autoResolve: true,
      effect: card.globalEffect ?? null,
    }
  }

  if (isUtopia) {
    return {
      ...base,
      check: card.resolution ?? null,
      onSuccess: {
        rewards: normalizeRewards(card.reward),
        claimCard: true,
      },
      onFailure: {
        penalty: card.failPenalty ?? null,
        stayOpen: true,
      },
    }
  }

    return {
      ...base,
      check: card.resolution ?? null,
      onSuccess: {
        rewards: normalizeRewards(card.reward),
        claimCard: isClue,
        unlocksTier: isClue && card.tier < 3 ? card.tier + 1 : null,
        revealsUtopia: isClue && card.tier === 3,
      },
      onFailure: {
        penalty: card.failPenalty ?? null,
        stayOpen: isClue,
      },
  }
}

export const NORMALIZED_EVENTS = EVENTS.map(normalizeExplorationCard)

export const EXPLORATION_TIER_CARDS = {
  1: NORMALIZED_EVENTS.filter((card) => card.deck === 'exploration' && card.tier === 1),
  2: NORMALIZED_EVENTS.filter((card) => card.deck === 'exploration' && card.tier === 2),
  3: NORMALIZED_EVENTS.filter((card) => card.deck === 'exploration' && card.tier === 3),
}

export const CLUE_CARDS = {
  1: NORMALIZED_EVENTS.filter((card) => card.deck === 'clue' && card.tier === 1),
  2: NORMALIZED_EVENTS.filter((card) => card.deck === 'clue' && card.tier === 2),
  3: NORMALIZED_EVENTS.filter((card) => card.deck === 'clue' && card.tier === 3),
}

export const DISASTER_CARDS = {
  1: NORMALIZED_EVENTS.filter((card) => card.deck === 'disaster' && card.tier === 1),
  2: NORMALIZED_EVENTS.filter((card) => card.deck === 'disaster' && card.tier === 2),
  3: NORMALIZED_EVENTS.filter((card) => card.deck === 'disaster' && card.tier === 3),
}

export const LEGACY_UTOPIA_EVENT = NORMALIZED_EVENTS.find((card) => card.deck === 'utopia') ?? null

export const EVENT_DECKS = {
  exploration: EXPLORATION_TIER_CARDS,
  clues: CLUE_CARDS,
  disasters: DISASTER_CARDS,
  utopia: LEGACY_UTOPIA_EVENT,
}
