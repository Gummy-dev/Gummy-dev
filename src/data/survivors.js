// 속성별 상성 매트릭스
// affinity[A][B] = A 옆에 B가 있을 때 A가 받는 점수 변화
export const AFFINITY_MATRIX = {
  군기반장: { 군기반장: -2, 분위기메이커: 0, 돌격대장: -1, '4차원': -1, 겁쟁이: 0, 평범: 0 },
  분위기메이커: { 군기반장: 0, 분위기메이커: 1, 돌격대장: 1, '4차원': 0, 겁쟁이: 1, 평범: 0 },
  돌격대장: { 군기반장: -1, 분위기메이커: 1, 돌격대장: -1, '4차원': 0, 겁쟁이: 0, 평범: 0 },
  '4차원': { 군기반장: -1, 분위기메이커: 0, 돌격대장: 0, '4차원': 0, 겁쟁이: -1, 평범: 0 },
  겁쟁이: { 군기반장: 0, 분위기메이커: 1, 돌격대장: 0, '4차원': -1, 겁쟁이: 0, 평범: 0 },
  평범: { 군기반장: 0, 분위기메이커: 0, 돌격대장: 0, '4차원': 0, 겁쟁이: 0, 평범: 0 },
}

// 지도자 타입별 인접 보너스 (해당 지도자와 같은 파티일 때)
export const LEADER_ADJACENCY_BONUS = {
  robot: { type: '군기반장', bonus: 2 },   // 로봇 지도자 인접 시 군기반장 +2
  zombie: { type: '돌격대장', bonus: 2 },
  duck: { type: '4차원', bonus: 2 },
  idol: { type: '분위기메이커', bonus: 2 },
  shy: { type: '겁쟁이', bonus: 2 },
}

export const DEFAULT_TURN_START_RESOURCES = {
  bottleCap: 1,
}

export const DEFAULT_TURN_END_RESOURCES = {
  can: -1,
  bottleCap: 0,
}

const SPECIAL_BONUS_BY_TYPE = {
  군기반장: '군기반장 인접 시 -2 / 돌격대장, 4차원 인접 시 -1 / 로봇 지도자 인접 시 병뚜껑 +2',
  돌격대장: '군기반장, 돌격대장 인접 시 -1 / 분위기메이커 인접 시 +1 / 좀비 지도자 인접 시 병뚜껑 +2',
  '4차원': '군기반장, 겁쟁이 인접 시 -1 / 오리교 지도자 인접 시 병뚜껑 +2',
  겁쟁이: '분위기메이커 인접 시 +1 / 4차원 인접 시 -1 / 샤이 지도자 인접 시 병뚜껑 +2',
  분위기메이커: '분위기메이커, 돌격대장, 겁쟁이 인접 시 +1 / 아이돌 지도자 인접 시 병뚜껑 +2',
  평범: '파티 전원 평범 생존자일 경우 +3',
}

export const SURVIVORS = [
  // ── 평범 ──────────────────────────────────────
  {
    id: 's_normal_1', name: '평범 생존자', type: '평범', score: 1,
    turnStartResources: { bottleCap: 1 },
    turnEndResources: { can: -1, bottleCap: 0 },
    effect: '턴 시작: 병뚜껑 1 획득 / 턴 종료: 통조림 1 소모',
    specialBonus: SPECIAL_BONUS_BY_TYPE.평범,
    description: '특징이 없는 평범한 생존자입니다.',
    emoji: '🧑', count: 5,
  },

  // ── 군기반장 ──────────────────────────────────
  {
    id: 's_military_1', name: '숙련된 생존자', type: '군기반장', score: 3,
    recruitCost: 3,
    turnStartResources: { bottleCap: 1 },
    turnEndResources: { can: -1, bottleCap: 0 },
    turnStartBonusIfFirst: { bottleCap: 1 },
    effect: '턴 시작: 병뚜껑 1 획득 / 첫 번째 위치면 병뚜껑 +1 / 재난 피해를 확률적으로 막고, 확률적으로 이탈할 수 있음',
    specialBonus: SPECIAL_BONUS_BY_TYPE.군기반장,
    description: '세상이 망한 것이 오히려 너무나 편안해졌습니다.',
    emoji: '💂', count: 1,
  },
  {
    id: 's_military_2', name: '양아치 햄스터', type: '군기반장', score: 3,
    recruitCost: 3,
    effect: '파티에 있으면 평범 생존자를 데려올 수 없음 / 군기반장이 있으면 공격 방어 / 없으면 겁쟁이 생존자 영입 불가',
    specialBonus: SPECIAL_BONUS_BY_TYPE.군기반장,
    description: '원래 주인이 죽은 지금, 양아치 햄스터를 막을 수 있는 사람은 많지 않습니다!',
    emoji: '🐹', count: 1,
  },
  {
    id: 's_military_3', name: '슬레셔 무비 배우', type: '군기반장', score: 3,
    recruitCost: 3,
    effect: '턴 종료 시 주사위: 1이면 내 생존자 1명 제거, 그 외 다른 플레이어 생존자 1명 제거 / 겁쟁이 인접 시 다음 턴 도망감',
    specialBonus: SPECIAL_BONUS_BY_TYPE.군기반장,
    description: '메소드 연기 중에 세상이 망해버렸습니다. 그는 아직도 열심히 연기 중입니다.',
    emoji: '🎬', count: 1,
  },
  {
    id: 's_military_4', name: '요정 생존자', type: '군기반장', score: 3,
    recruitCost: 3,
    effect: '상대 파티에 4차원이 있으면 교환 가능 / 교환한 생존자 위치로 데려옴 / 이번 턴 죽은 생존자를 살려냄',
    specialBonus: SPECIAL_BONUS_BY_TYPE.군기반장,
    description: '요정들이 살던 숲도 망해버려서 세상 밖으로 나왔습니다.',
    emoji: '🧚', count: 1,
  },
  {
    id: 's_military_5', name: '지리선생 생존자', type: '군기반장', score: 3,
    recruitCost: 3,
    effect: '영입 시 위치 지정 가능 / 이벤트 카드 3장을 확인하고 안전한 이벤트로 이동',
    specialBonus: SPECIAL_BONUS_BY_TYPE.군기반장,
    description: '그녀가 30년 넘게 공부한 지리 지식이 생존에 상당한 도움이 됩니다.',
    emoji: '🗺️', count: 1,
  },
  {
    id: 's_military_6', name: '수의사 생존자', type: '군기반장', score: 3,
    recruitCost: 3,
    effect: '버린 더미에서 생존자 1명 부활 가능 / 이번 턴 죽은 생존자를 확률적으로 살려냄',
    specialBonus: SPECIAL_BONUS_BY_TYPE.군기반장,
    description: '사람을 치료하는 것은 불법이지만, 세상이 망해버려서 괜찮습니다!',
    emoji: '🩺', count: 1,
  },

  // ── 돌격대장 ──────────────────────────────────
  {
    id: 's_charge_1', name: '용사 생존자', type: '돌격대장', score: 2,
    recruitCost: 2,
    effect: '다른 그룹의 공격을 확률적으로 막아냄 / 이세계의 마왕을 찾으러 확률적으로 도망감',
    specialBonus: SPECIAL_BONUS_BY_TYPE.돌격대장,
    description: '이세계(지구)로 소환당했습니다. 이세계의 마왕을 잡으러 가고 싶어합니다.',
    emoji: '⚔️', count: 1,
  },
  {
    id: 's_charge_2', name: '개 생존자', type: '돌격대장', score: 2,
    recruitCost: 2,
    effect: '재난 발생 시 확률적으로 막아냄(죽을 수 있음) / 다른 그룹 공격도 확률적으로 방어',
    specialBonus: SPECIAL_BONUS_BY_TYPE.돌격대장,
    description: '충성스러운 개 생존자는 주인을 지키기 위해 무엇이든 할 것입니다.',
    emoji: '🐕', count: 1,
  },
  {
    id: 's_charge_3', name: '티라노 생존자', type: '돌격대장', score: 2,
    recruitCost: 2,
    turnStartResources: { bottleCap: 1 },
    turnEndResources: { can: -6, bottleCap: 0 },
    effect: '이벤트 해결 기회 1회 추가 / 통조림을 많이 소모하며, 부족하면 랜덤 아군을 잡아먹음',
    specialBonus: SPECIAL_BONUS_BY_TYPE.돌격대장,
    description: '또 세상이 멸망하는 것을 두고 볼 수 없습니다.',
    emoji: '🦕', count: 1,
  },
  {
    id: 's_charge_4', name: '햄스터 생존자', type: '돌격대장', score: 2,
    recruitCost: 2,
    effect: '이동 단계에서 이 생존자를 버리고 2칸 추가 이동 가능',
    specialBonus: SPECIAL_BONUS_BY_TYPE.돌격대장,
    description: '귀여운 햄스터입니다. 다른 플레이어가 공격 시 귀여움에 공격을 멈춥니다.',
    emoji: '🐾', count: 1,
  },
  {
    id: 's_charge_5', name: '걷는식물 생존자', type: '돌격대장', score: 2,
    recruitCost: 2,
    turnStartResources: { bottleCap: 1 },
    turnEndResources: { can: 0, bottleCap: 0 },
    effect: '턴 시작: 병뚜껑 1 획득 / 공격 당할 시 반격 / 통조림을 소모하지 않음',
    specialBonus: SPECIAL_BONUS_BY_TYPE.돌격대장,
    description: '어떻게 걷게 되었는지는 알 수 없습니다.',
    emoji: '🌿', count: 1,
  },

  // ── 4차원 ──────────────────────────────────────
  {
    id: 's_weird_1', name: '가든일 생존자', type: '4차원', score: 1,
    recruitCost: 1,
    effect: '언제나 주변을 감시하여 다른 플레이어의 공격을 막아냄',
    specialBonus: SPECIAL_BONUS_BY_TYPE['4차원'],
    description: '바다가 망해서 육지에 적응했는데 육지도 망해버렸습니다.',
    emoji: '🌊', count: 1,
  },
  {
    id: 's_weird_2', name: '유령 생존자', type: '4차원', score: 1,
    recruitCost: 1,
    effect: '어떤 공격에도 죽지 않음. 확률적으로 다른 플레이어 생존자에 빙의해서 데려올 수 있음',
    specialBonus: SPECIAL_BONUS_BY_TYPE['4차원'],
    description: '세상이 망했지만 유령으로 살아남았습니다.',
    emoji: '👻', count: 1,
  },
  {
    id: 's_weird_3', name: '탈옥 생존자', type: '4차원', score: 1,
    recruitCost: 1,
    effect: '1회 즉시 발동: 숨겨놓은 통조림 30개 획득 / 특정 구역 도착 시 한 턴 휴식',
    specialBonus: SPECIAL_BONUS_BY_TYPE['4차원'],
    description: '통조림 공장을 털다가 감옥에 갇혔지만 지금은 자유의 몸입니다.',
    emoji: '🔓', count: 1,
  },
  {
    id: 's_weird_4', name: '마법사 생존자', type: '4차원', score: 1,
    recruitCost: 1,
    effect: '다른 플레이어 생존자의 신체를 분리해서 제거 가능',
    specialBonus: SPECIAL_BONUS_BY_TYPE['4차원'],
    description: '마술사인 척하며 살아왔지만, 이제 속일 필요가 없어졌습니다. 망한 세상은 마법을 연습하기 아주 좋습니다.',
    emoji: '🧙', count: 1,
  },
  {
    id: 's_weird_5', name: '외계인 생존자', type: '4차원', score: 1,
    recruitCost: 1,
    effect: '변신 광선총으로 내 생존자 1명을 생존자 덱 맨 위 카드로 교체 (1회)',
    specialBonus: SPECIAL_BONUS_BY_TYPE['4차원'],
    description: '망해버린 세상을 견학하러 왔습니다.',
    emoji: '👽', count: 1,
  },

  // ── 겁쟁이 ──────────────────────────────────────
  {
    id: 's_coward_1', name: '고양이 생존자', type: '겁쟁이', score: 0,
    recruitCost: 0,
    effect: '이벤트 카드 미리 확인 후 안전한 곳으로 이동. 개 생존자와 함께하면 둘 중 하나 죽음',
    specialBonus: SPECIAL_BONUS_BY_TYPE.겁쟁이,
    description: '길고양이의 예리한 감각을 가지고 있습니다.',
    emoji: '🐱', count: 1,
  },
  {
    id: 's_coward_2', name: '의사 생존자', type: '겁쟁이', score: 0,
    recruitCost: 0,
    effect: '매 턴 생존자 1명의 피해를 무효화',
    specialBonus: SPECIAL_BONUS_BY_TYPE.겁쟁이,
    description: '세상이 망해서 의사 면허 없이도 치료할 수 있게 되었습니다.',
    emoji: '👨‍⚕️', count: 1,
  },
  {
    id: 's_coward_3', name: '실패한 실험체', type: '겁쟁이', score: 0,
    recruitCost: 0,
    effect: '확률적으로 랜덤 능력 발동',
    specialBonus: SPECIAL_BONUS_BY_TYPE.겁쟁이,
    description: '뭔가 잘못된 것 같지만 살아있습니다.',
    emoji: '🧪', count: 1,
  },
  {
    id: 's_coward_4', name: '은밀기동 생존자', type: '겁쟁이', score: 0,
    recruitCost: 0,
    effect: '다른 플레이어 파티에 몰래 침입하여 통조림을 훔쳐옴',
    specialBonus: SPECIAL_BONUS_BY_TYPE.겁쟁이,
    description: '자신의 그룹도 은밀기동 생존자가 있는지 모릅니다.',
    emoji: '🥷', count: 1,
  },

  // ── 분위기메이커 ────────────────────────────────
  {
    id: 's_mood_1', name: '여고생 생존자', type: '분위기메이커', score: 0,
    recruitCost: 0,
    effect: '적 생존자를 확률적으로 기절시킴(능력 사용 불가 1턴)',
    specialBonus: SPECIAL_BONUS_BY_TYPE.분위기메이커,
    description: '일반적인 여고생 생존자입니다.',
    emoji: '🎒', count: 1,
  },
  {
    id: 's_mood_2', name: '마법소녀 생존자', type: '분위기메이커', score: 0,
    recruitCost: 0,
    turnStartResources: { bottleCap: 1 },
    turnEndResources: { can: -1, bottleCap: 0 },
    turnEndRandomGift: { resource: 'bottleCap', amount: 1, target: 'random_other' },
    effect: '턴 시작: 병뚜껑 1 획득 / 턴 종료: 통조림 1 소모 / 랜덤 플레이어에게 병뚜껑 1개 증여',
    specialBonus: SPECIAL_BONUS_BY_TYPE.분위기메이커,
    description: '변신! 정의의 이름으로 용서하지 않겠습니다.',
    emoji: '✨', count: 1,
  },
]
