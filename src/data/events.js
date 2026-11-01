/**
 * 이벤트 카드
 *
 * 데이터 구조 메모:
 * - requiredTypes: 해결에 반드시 필요한 타입 조건
 * - recommendedParty: 주사위 판정의 타입점수 조건
 * - action_attack은 실제 상대 자원/생존자 상태에 영향을 주는 resolution을 사용
 * - action_coop은 주사위를 쓰지 않는 확정 상호작용/타입조건 이벤트로 사용
 */
import {
  parseAssignmentCell,
  parseGlobalEffectCell,
  parseOpponentRequirementCell,
  parsePenaltyCell,
  parseResolutionCell,
  parseRewardCell,
  parseTypeCountList,
} from './excelCellParsers.js'
import { DESIGN_EVENTS } from './designDataAdapters.js'

const FALLBACK_EVENTS = [
  {
    id: 'e_near_cache',
    tier: 1,
    count: 3,
    category: 'resource',
    eventType: 'resource',
    name: '버려진 슈퍼마켓',
    scope: 'personal',
    emoji: '🛒',
    description: '인적 드문 골목 끝 슈퍼마켓이다. 약탈 흔적이 있지만 창고 한쪽만 유독 깨끗하게 비워져 있다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 5
    },
    reward: {
      type: 'can',
      amount: 5
    },
    failPenalty: null
  },
  {
    id: 'e_barter_market',
    tier: 1,
    count: 2,
    category: 'resource',
    eventType: 'resource',
    name: '폐 편의점',
    scope: 'personal',
    emoji: '🏪',
    description: '문이 반쯤 열린 편의점. 진열대에 통조림이 몇 개 남아 있고, 계산대 서랍에는 병뚜껑도 조금 있다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 5
    },
    reward: [
      {
        type: 'can',
        amount: 2
      },
      {
        type: 'cap',
        amount: 3
      }
    ],
    failPenalty: null
  },
  {
    id: 'e_scrap_deal',
    tier: 1,
    count: 3,
    category: 'resource',
    eventType: 'resource',
    name: '고철 매각',
    scope: 'personal',
    emoji: '🔩',
    description: '근처 폐차장에서 고철을 팔아 병뚜껑을 번다. 별 위험은 없다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 3
    },
    reward: {
      type: 'cap',
      amount: 4
    },
    failPenalty: null
  },
  {
    id: 'e_dice_lucky',
    tier: 1,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '행운의 발견',
    scope: 'personal',
    emoji: '🍀',
    description: '뒷골목 폐허에서 홀로 떠도는 생존자를 발견했다. 이 구역을 꿰고 있는 것처럼 움직인다. 같이 가자고 제안해볼까?\n실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 5
    },
    reward: [
      {
        type: 'survivor',
        amount: 1
      },
      {
        type: 'cap',
        amount: 1
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_dice_scavenge',
    tier: 2,
    count: 1,
    category: 'interaction',
    eventType: 'action_attack',
    name: '공정한 약탈',
    scope: 'personal',
    emoji: '⚖️',
    description: '상대 1명을 골라 폐품 구역의 권리를 빼앗는다. 성공하면 상대 병뚜껑을 크게 가져온다.\n실패시 병뚜껑 1개를 잃는다.',
    requiredTypes: [
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_cap_from_player',
      amount: 8
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 1
    }
  },
  {
    id: 'e_dice_rescue',
    tier: 1,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '구조 작전',
    scope: 'personal',
    emoji: '🆘',
    description: '골목 안쪽 은신처에서 생존자를 찾았다. 오래 머문 흔적이 남아 있다. 실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 5
    },
    reward: [
      {
        type: 'survivor',
        amount: 1
      },
      {
        type: 'can',
        amount: 2
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_key_caution',
    tier: 1,
    count: 2,
    category: 'score',
    eventType: 'item',
    name: '낡은 열쇠',
    scope: 'personal',
    emoji: '🛤️',
    description: '무너진 담장 사이에서 오래된 열쇠를 발견했다. 조심성, 설득력, 통솔력이 모두 갖춰진 파티라면 안전하게 회수할 수 있다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 3
    },
    requiredTypes: [
      {
        type: '분위기메이커',
        count: 2
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'check_survivors_n',
      amount: 3
    },
    reward: {
      type: 'key',
      amount: 1
    },
    failPenalty: null
  },
  {
    id: 'e_key_bold',
    tier: 1,
    count: 2,
    category: 'score',
    eventType: 'item',
    name: '낡은 열쇠',
    scope: 'personal',
    emoji: '🚪',
    description: '지하 대피소 철문 옆에서 열쇠가 보인다. 문 아랫부분에 손가락으로 긁은 것 같은 흔적이 있다. 담력과 신중함이 조화를 이루는 파티라면 소리 없이 들어갈 수 있다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 3
    },
    requiredTypes: [
      {
        type: '겁쟁이',
        count: 2
      },
      {
        type: '용감이',
        count: 1
      }
    ],
    resolution: {
      type: 'check_survivors_n',
      amount: 3
    },
    reward: {
      type: 'key',
      amount: 1
    },
    failPenalty: null
  },
  {
    id: 'e_key_front',
    tier: 1,
    count: 0,
    category: 'score',
    eventType: 'item',
    name: '낡은 열쇠',
    scope: 'personal',
    emoji: '🤝',
    description: '건물 경비가 지키는 잠긴 문 너머에 열쇠가 있다. 행동력, 설득력, 통솔력이 갖춰진 파티라면 경비를 통과시킬 수 있다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 3
    },
    requiredTypes: [
      {
        type: '겁쟁이',
        count: 2
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'check_survivors_n',
      amount: 3
    },
    reward: {
      type: 'key',
      amount: 1
    },
    failPenalty: null
  },
  {
    id: 'e_dice_negotiate',
    tier: 1,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '동네 창고 수색',
    scope: 'personal',
    emoji: '📦',
    description: '지하 대피소 옆에 딸린 창고다. 선반 위에 귀마개 하나가 얌전히 놓여 있다. 조심스럽게 뒤지면 쓸 만한 물자가 나온다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 8
    },
    reward: {
      type: 'cap',
      amount: 6
    },
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_recruit_crowd',
    tier: 1,
    count: 1,
    category: 'encounter',
    eventType: 'resource',
    name: '군중 속 합류',
    scope: 'personal',
    emoji: '🎭',
    description: '무너진 콘서트장 광장 쪽으로 사람들이 또 모여들었다. 분위기메이커가 먼저 다가가야 영입이 가능하다.\n실패시 통조림 1개를 잃는다.',
    requiredTypes: [
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 6
    },
    reward: [
      {
        type: 'survivor',
        amount: 1
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_coop_supply_share',
    tier: 1,
    count: 1,
    category: 'interaction',
    eventType: 'action_coop',
    name: '비상식량 분배',
    scope: 'personal',
    emoji: '🤝',
    description: '상대 1명과 생존자 1명씩 파견해 비상식량을 나눈다. 조건이 맞으면 주사위 없이 바로 이득이다.',
    assignment: {
      minSurvivors: 1,
      maxSurvivors: 1
    },
    resolution: {
      type: 'shared_dispatch_reward',
      resource: 'can',
      currentAmount: 3,
      targetAmount: 2
    },
    reward: [
      {
        type: 'can',
        amount: 3
      },
      {
        type: 'can',
        amount: 2,
        scopeLabel: '(상대)'
      }
    ]
  },
  {
    id: 'e_need_numbers',
    tier: 2,
    count: 1,
    category: 'encounter',
    eventType: 'resource',
    name: '인원 부족',
    scope: 'personal',
    emoji: '👥',
    description: '외곽 피난민들을 설득한다. 분위기를 살릴 수 있으면 합류 가능성이 높아진다.\n실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 13
    },
    reward: [
      {
        type: 'survivor',
        amount: 1
      },
      {
        type: 'can',
        amount: 3
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_recruit_expert',
    tier: 2,
    count: 1,
    category: 'encounter',
    eventType: 'resource',
    name: '전문가 설득',
    scope: 'personal',
    emoji: '🌟',
    description: '무너진 콘서트장 백스테이지 쪽에서 혼자 작업하는 사람이 보인다. 분위기메이커가 협상을 주도해야 영입이 가능하다.\n실패시 통조림 2개를 잃는다.',
    requiredTypes: [
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 12
    },
    reward: [
      {
        type: 'survivor',
        amount: 1
      },
      {
        type: 'cap',
        amount: 3
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_global_supply',
    tier: 1,
    category: 'resource',
    eventType: 'resource',
    name: '구호물자 도착',
    scope: 'personal',
    emoji: '📦',
    description: '구호물자 수송대가 도착했다. 받아들이면 모든 플레이어가 통조림 3개를 받는다.',
    resolution: {
      type: 'global_effect'
    },
    globalEffect: {
      type: 'gain_can_all',
      amount: 3
    }
  },
  {
    id: 'e_global_cap_run',
    tier: 1,
    category: 'resource',
    eventType: 'resource',
    name: '병뚜껑 유통',
    scope: 'personal',
    emoji: '🪙',
    description: '근처 물물교환 시장이 열렸다. 받아들이면 모든 플레이어가 병뚜껑 2개를 받는다.',
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 2
    },
    resolution: {
      type: 'global_effect'
    },
    globalEffect: {
      type: 'gain_cap_all',
      amount: 2
    }
  },
  {
    id: 'e_global_recruit',
    tier: 2,
    category: 'encounter',
    eventType: 'luck',
    name: '대규모 합류',
    scope: 'personal',
    emoji: '🧑\u200d🤝\u200d🧑',
    description: '근처 생존자 무리가 몰려온다. 받아들이면 모든 파티에 생존자 1명이 덱에서 자동 합류한다.',
    resolution: {
      type: 'global_effect'
    },
    globalEffect: {
      type: 'add_survivors_all',
      amount: 1
    }
  },
  {
    id: 'e_t1_trade_offer',
    tier: 2,
    count: 1,
    category: 'interaction',
    eventType: 'action_coop',
    name: '고철 맞교환',
    scope: 'personal',
    emoji: '🔁',
    description: '관리 구역 경계 초소 앞에서 만나기로 했다. 반장끼리만 통하는 거래다. 병뚜껑 4개를 넘기고 통조림 5개를 받는다.',
    requiredTypes: [
      {
        type: '반장',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 1,
      maxSurvivors: 3
    },
    resolution: {
      type: 'trade_offer',
      give: {
        resource: 'bottleCap',
        amount: 4
      },
      receive: {
        resource: 'can',
        amount: 5,
        bonus: 0
      }
    },
    reward: [
      {
        type: 'cap',
        amount: -4
      },
      {
        type: 'exchange_arrow'
      },
      {
        type: 'can',
        amount: 5
      }
    ]
  },
  {
    id: 'e_t1_supply_split',
    tier: 2,
    count: 1,
    category: 'interaction',
    eventType: 'action_coop',
    name: '구호품 나누기',
    scope: 'personal',
    emoji: '🎁',
    description: '구획된 배급소 앞에 구호품 상자가 쌓여 있다. 상대 1명과 배분하면 나는 통조림을 더 많이, 상대는 일부를 얻는다.',
    assignment: {
      minSurvivors: 1,
      maxSurvivors: 3
    },
    resolution: {
      type: 'shared_distribution',
      resource: 'can',
      currentAmount: 6,
      targetAmount: 3
    },
    reward: [
      {
        type: 'can',
        amount: 6
      },
      {
        type: 'can',
        amount: 3,
        scopeLabel: '(상대)'
      }
    ],
    failPenalty: null,
    requiredTypes: [
      {
        type: '반장',
        count: 1
      }
    ]
  },
  {
    id: 'e_t1_coin_split_run',
    tier: 2,
    count: 1,
    category: 'interaction',
    eventType: 'action_coop',
    name: '공동 폐품 운반',
    scope: 'personal',
    emoji: '🛒',
    description: '상대 1명과 생존자 1명씩 파견해 폐품을 운반한다. 파견한 두 파티가 병뚜껑을 나눠 가진다.',
    assignment: {
      minSurvivors: 1,
      maxSurvivors: 1
    },
    resolution: {
      type: 'shared_dispatch_reward',
      resource: 'bottleCap',
      currentAmount: 6,
      targetAmount: 4
    },
    reward: [
      {
        type: 'cap',
        amount: 6
      },
      {
        type: 'cap',
        amount: 4,
        scopeLabel: '(상대)'
      }
    ]
  },
  {
    id: 'e_coop_cap_alliance',
    tier: 2,
    count: 1,
    category: 'interaction',
    eventType: 'action_coop',
    name: '분위기 동맹',
    scope: 'personal',
    emoji: '🤲',
    description: '예전에 페스티벌이 열렸던 공터에서 만나기로 했다. 각자 분위기메이커 1명씩 보내 병뚜껑을 모아 나눈다. 주사위 없이 조건만 맞으면 바로 이득이다.',
    requiredTypes: [
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 1,
      maxSurvivors: 1
    },
    resolution: {
      type: 'shared_dispatch_reward',
      resource: 'bottleCap',
      currentAmount: 8,
      targetAmount: 6
    },
    reward: [
      {
        type: 'cap',
        amount: 8
      },
      {
        type: 'cap',
        amount: 6,
        scopeLabel: '(상대)'
      }
    ]
  },
  {
    id: 'e_t1_raid',
    tier: 2,
    count: 0,
    category: 'interaction',
    eventType: 'action_attack',
    name: '식량 강탈',
    scope: 'personal',
    emoji: '🪓',
    description: '폐쇄된 병원 주변 보급로다. 사람들이 이유 없이 가까이 오지 않으려는 구역이라 경쟁자가 드물다. 성공하면 상대 통조림을 빼앗아 온다.\n실패시 통조림 1개를 잃는다.',
    requiredTypes: [
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_can_from_player',
      amount: 8
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_t1_beg',
    tier: 2,
    count: 0,
    category: 'interaction',
    eventType: 'action_attack',
    name: '병뚜껑 갈취',
    scope: 'personal',
    emoji: '🙏',
    description: '버려진 시장에서 병뚜껑을 두고 실랑이가 벌어진다. 기세를 잡으면 상대 병뚜껑을 빼앗는다.\n실패시 병뚜껑 1개를 잃는다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_cap_from_player',
      amount: 8
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 1
    },
    requiredTypes: [
      {
        type: '용감이',
        count: 1
      }
    ]
  },
  {
    id: 'e_food_tax',
    tier: 1,
    count: 0,
    category: 'resource',
    eventType: 'resource',
    name: '검문소 통행료',
    scope: 'personal',
    emoji: '🛂',
    description: '검문소를 통과하려면 통조림 4개가 필요하다.\n대신 병뚜껑을 넉넉히 챙길 수 있다.',
    requiredType: '겁쟁이',
    resolution: {
      type: 'pay_can',
      amount: 4
    },
    reward: [
      {
        type: 'can',
        amount: 2
      },
      {
        type: 'cap',
        amount: 4
      }
    ]
  },
  {
    id: 'e_street_vendor',
    tier: 1,
    count: 0,
    category: 'resource',
    eventType: 'resource',
    name: '노점 판매',
    scope: 'personal',
    emoji: '🛒',
    description: '외곽 거리의 노점에서 잡동사니를 팔아 병뚜껑을 모은다. \n실패시 아무것도 얻지 못한다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 7
    },
    reward: [
      {
        type: 'can',
        amount: 2
      },
      {
        type: 'cap',
        amount: 4
      }
    ],
    failPenalty: null
  },
  {
    id: 'e_need_muscle',
    tier: 1,
    category: 'resource',
    eventType: 'resource',
    name: '지하 벙커',
    scope: 'personal',
    emoji: '🪖',
    description: '입구가 잠긴 지하 벙커. 내부에 비상식량이 대량 비축되어 있다. 신중하게 접근해야 경보를 피할 수 있다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 8
    },
    reward: {
      type: 'can',
      amount: 5
    },
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_sacrifice',
    tier: 3,
    count: 0,
    category: 'score',
    eventType: 'item',
    name: '위험한 잔해 정리',
    scope: 'personal',
    emoji: '🔥',
    description: '무너진 잔해 너머에서 아이템 신호가 잡힌다. 4차원의 직감이 있으면 돌파 가능성이 높아진다.\n실패시 생존자 1명이 다친다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 20
    },
    reward: {
      type: 'item',
      amount: 1
    },
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_random_misfortune',
    tier: 3,
    category: 'score',
    eventType: 'item',
    name: '낙석 사고',
    scope: 'personal',
    emoji: '💥',
    autoStartOnReveal: true,
    penalizeOnFail: true,
    assignment: {
      minSurvivors: 0,
      maxSurvivors: 0
    },
    description: '외곽 절벽에서 돌무더기가 쏟아진다. \n사고를 수습하는 동안 무작위 생존자 1명을 잃지만, \n잔해 속에서 쓸만한 아이템을 발견한다.',
    resolution: {
      type: 'remove_random',
      amount: 1
    },
    reward: {
      type: 'item',
      amount: 1
    }
  },
  {
    id: 'e_key_tactics',
    tier: 2,
    count: 1,
    category: 'score',
    eventType: 'item',
    name: '낡은 열쇠',
    scope: 'personal',
    emoji: '🗝️',
    description: '외곽의 잠긴 보급함에서 오래된 열쇠를 발견했다. 돌파력, 기묘한 발상, 지휘가 모두 맞아떨어지면 안전하게 회수할 수 있다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 3
    },
    requiredTypes: [
      {
        type: '용감이',
        count: 2
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'check_survivors_n',
      amount: 3
    },
    reward: {
      type: 'key',
      amount: 1
    },
    failPenalty: null
  },
  {
    id: 'e_key_trap',
    tier: 2,
    count: 1,
    category: 'score',
    eventType: 'item',
    name: '낡은 열쇠',
    scope: 'personal',
    emoji: '⚙️',
    description: '함정으로 뒤덮인 복도 끝에 열쇠가 보인다. 기묘한 예측을 두 겹으로 세우고 조직력이 받쳐주는 파티라면 안전하게 회수할 수 있다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 3
    },
    requiredTypes: [
      {
        type: '반장',
        count: 2
      },
      {
        type: '용감이',
        count: 1
      }
    ],
    resolution: {
      type: 'check_survivors_n',
      amount: 3
    },
    reward: {
      type: 'key',
      amount: 1
    },
    failPenalty: null
  },
  {
    id: 'e_t2_keyed_safe',
    tier: 2,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '잠긴 금고함',
    scope: 'personal',
    emoji: '🔐',
    description: '외곽 은신처에서 열쇠 구멍이 남은 금고함을 찾았다. 열쇠가 있으면 바로 열고, 없으면 위험하게 뜯어야 한다.\n실패시 병뚜껑 2개를 잃는다.',
    recommendedParty: [
      {
        type: '반장',
        count: 1
      },
      {
        type: '4차원',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 18,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_cap',
      amount: 2
    }
  },
  {
    id: 'e_t2_buried_box',
    tier: 2,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '묻힌 보관함',
    scope: 'personal',
    emoji: '📦',
    description: '무너진 주유소 바닥 아래에 작은 보관함이 묻혀 있다. 열쇠가 있으면 안전하지만 억지로 열 수도 있다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      },
      {
        type: '4차원',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 18,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_t2_locked_truck',
    tier: 2,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '잠긴 수송차',
    scope: 'personal',
    emoji: '🚚',
    description: '외곽 도로에 멈춘 수송차가 있다. 열쇠가 있으면 짐칸을 열 수 있고, 없으면 힘으로 비틀어야 한다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '반장',
        count: 1
      },
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_t2_hidden_locker',
    tier: 2,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '숨겨진 사물함',
    scope: 'personal',
    emoji: '🗄️',
    description: '낡은 대피소 벽 뒤에서 비밀 사물함을 발견했다. 열쇠가 있으면 조용히 열 수 있다.\n실패시 병뚜껑 2개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_cap',
      amount: 2
    }
  },
  {
    id: 'e_t2_old_cache',
    tier: 2,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '낡은 은닉처',
    scope: 'personal',
    emoji: '🧭',
    description: '지도에 없는 은닉처를 발견했다. 열쇠가 있으면 바로 챙길 수 있지만, 없으면 위험한 해체가 필요하다.\n실패시 통조림 3개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 2
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 3
    }
  },
  {
    id: 'e_send_troublemaker',
    tier: 2,
    category: 'interaction',
    eventType: 'action_attack',
    name: '가짜 좌표 흘리기',
    scope: 'personal',
    emoji: '↗️',
    description: '관리 구역 이동 경로에 가짜 좌표를 흘려놓는다. 성공하면 상대 생존자 1명을 비활성화한다.\n실패시 통조림 1개를 잃는다.',
    requiredTypes: [
      {
        type: '반장',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'deactivate_from_party'
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_refugee_wave',
    tier: 2,
    count: 0,
    category: 'interaction',
    eventType: 'action_attack',
    name: '난민 행렬 유도',
    scope: 'personal',
    emoji: '🚶',
    description: '난민 행렬을 유도해 모든 상대의 보급권을 조금씩 빼앗는다.\n실패시 병뚜껑 1개를 잃는다.',
    recommendedParty: [
      {
        type: '반장',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_cap_from_all_others',
      amount: 2
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 1
    },
    requiredTypes: [
      {
        type: '반장',
        count: 1
      }
    ]
  },
  {
    id: 'e_t2_food_raid',
    tier: 2,
    count: 1,
    category: 'interaction',
    eventType: 'action_attack',
    name: '외곽 식량 강탈',
    scope: 'personal',
    emoji: '🍖',
    description: '외곽 보급 창고를 가진 상대를 습격한다. 성공하면 상대 통조림을 빼앗아 온다.\n실패시 통조림 2개를 잃는다.',
    requiredTypes: [
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_can_from_player',
      amount: 8
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_t2_supply_cut',
    tier: 2,
    count: 0,
    category: 'interaction',
    eventType: 'action_attack',
    name: '보급로 차단',
    scope: 'personal',
    emoji: '⛔',
    description: '외곽 보급선을 끊어 모든 상대의 식량 흐름을 조금씩 빼앗는다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '반장',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_can_from_all_others',
      amount: 2
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 2
    },
    requiredTypes: [
      {
        type: '반장',
        count: 1
      }
    ]
  },
  {
    id: 'e_provoke',
    tier: 2,
    count: 0,
    category: 'interaction',
    eventType: 'action_attack',
    name: '경로 교란',
    scope: 'personal',
    emoji: '😤',
    description: '이동 경로를 비틀어 상대 파티를 혼란시킨다. 성공하면 상대 생존자 1명을 비활성화한다.\n실패시 병뚜껑 1개를 잃는다.',
    requiredTypes: [
      {
        type: '반장',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'deactivate_from_party'
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 1
    }
  },
  {
    id: 'e_steal_grave',
    tier: 2,
    count: 0,
    category: 'encounter',
    eventType: 'action_attack',
    name: '무덤 약탈',
    scope: 'personal',
    emoji: '⚰️',
    description: '떠난 생존자 더미를 뒤져 쓸 만한 인재를 빼낸다. 성공하면 떠난 생존자 1명을 데려온다.\n실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_from_grave'
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_revive_grave',
    tier: 3,
    count: 0,
    category: 'score',
    eventType: 'item',
    name: '기적의 소생',
    scope: 'personal',
    emoji: '💫',
    description: '떠난 생존자의 흔적을 따라 기적을 노린다. 성공하면 아이템과 통조림을 얻는다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19
    },
    reward: [
      {
        type: 'item',
        amount: 1
      },
      {
        type: 'can',
        amount: 3
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_dice_trap',
    tier: 1,
    count: 0,
    category: 'dice',
    eventType: 'resource',
    name: '함정 피하기',
    scope: 'personal',
    emoji: '⚙️',
    description: '누군가 장치해 둔 함정이 있다. \n실패시 동료를 한 명 잃는다.',
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 8
    },
    reward: [
      {
        type: 'can',
        amount: 2
      },
      {
        type: 'cap',
        amount: 3
      }
    ],
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_dice_ruins',
    tier: 1,
    count: 0,
    category: 'dice',
    eventType: 'resource',
    name: '폐허 탐색',
    scope: 'personal',
    emoji: '🏚️',
    description: '폐건물 더미를 뒤져 물자를 찾는다. \n실패시 생존자 1명이 다친다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 8
    },
    reward: [
      {
        type: 'can',
        amount: 4
      },
      {
        type: 'cap',
        amount: 2
      }
    ],
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_dice_wait',
    tier: 3,
    category: 'dice',
    eventType: 'item',
    name: '숨죽여 기다리기',
    scope: 'personal',
    emoji: 'U0001fae3',
    description: '4차원의 이상한 예감으로 잠긴 보급함 앞에서 위험이 지나가길 기다린다. 열쇠가 있다면 조용히 열어 아이템을 챙길 수 있다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'item',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_key_cache_supply',
    tier: 3,
    category: 'dice',
    eventType: 'item',
    name: '잠긴 구호함',
    scope: 'personal',
    emoji: '🧰',
    description: '낡은 열쇠가 맞는 구호함을 발견했다. 조심스럽게 열면 아직 쓸 수 있는 아이템이 나온다.\n실패시 병뚜껑 2개를 잃는다.',
    recommendedParty: [
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'item',
      amount: 1
    },
    failPenalty: {
      type: 'lose_cap',
      amount: 2
    }
  },
  {
    id: 'e_key_old_armory',
    tier: 3,
    category: 'dice',
    eventType: 'item',
    name: '봉인된 장비고',
    scope: 'personal',
    emoji: '🧥',
    description: '오래된 장비고 문이 열쇠에 반응한다. 안쪽에서 파티를 지켜줄 물건을 꺼낼 수 있다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'item',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_dice_signal',
    tier: 1,
    count: 0,
    category: 'dice',
    eventType: 'resource',
    name: '수상한 신호',
    scope: 'personal',
    emoji: '📡',
    description: '미지의 신호를 수신했다.\n실패시 통조림 2개를 잃는다.',
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 8
    },
    reward: [
      {
        type: 'can',
        amount: 4
      },
      {
        type: 'cap',
        amount: 2
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_dice_credibility',
    tier: 3,
    category: 'dice',
    eventType: 'resource',
    name: '통제 구역 돌파',
    scope: 'personal',
    emoji: '🎖️',
    description: '철저히 통제된 구역을 뚫는다. 파티 역량이 높을수록 유리하다.\n주사위 합 + 파티 총점으로 판정한다.\n실패시 통조림 2개를 잃는다.',
    resolution: {
      type: 'roll_dice_score_bonus',
      diceCount: 1,
      target: 24
    },
    reward: [
      {
        type: 'can',
        amount: 3
      },
      {
        type: 'cap',
        amount: 2
      },
      {
        type: 'score',
        amount: 1
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_t2_joint_expedition',
    tier: 2,
    count: 0,
    category: 'interaction',
    eventType: 'action_coop',
    name: '합동 수송 작전',
    scope: 'personal',
    emoji: '🚚',
    description: '상대 파티에서 생존자 1명을 지원받아 수송로를 연다. 지원 생존자는 비활성화되고 두 파티가 병뚜껑을 나눠 가진다.',
    assignment: {
      minSurvivors: 1,
      maxSurvivors: 3
    },
    resolution: {
      type: 'shared_dispatch_reward',
      resource: 'bottleCap',
      currentAmount: 7,
      targetAmount: 4
    },
    reward: [
      {
        type: 'cap',
        amount: 7
      },
      {
        type: 'cap',
        amount: 4,
        scopeLabel: '(지원)'
      }
    ],
    failPenalty: null,
    requiredTypes: [
      {
        type: '반장',
        count: 1
      }
    ]
  },
  {
    id: 'e_global_conflict',
    tier: 2,
    count: 0,
    name: '세력 충돌',
    scope: 'global',
    eventType: 'disaster',
    emoji: '⚔️',
    description: '각 파티에서 생존자 1명씩 제거된다.',
    globalEffect: {
      type: 'remove_all_n',
      amount: 1
    }
  },
  {
    id: 'e_global_drain',
    tier: 2,
    count: 0,
    category: 'disaster',
    eventType: 'disaster',
    name: '물자 약탈',
    scope: 'disaster',
    emoji: '💸',
    description: '약탈이 번진다. 받아들이면 모든 플레이어의 병뚜껑이 2개 감소한다.',
    resolution: {
      type: 'global_effect'
    },
    globalEffect: {
      type: 'lose_cap_all',
      amount: 2
    }
  },
  {
    id: 'e_border_raid',
    tier: 2,
    count: 0,
    category: 'attack',
    eventType: 'action_attack',
    name: '외곽 초소 급습',
    scope: 'personal',
    emoji: '🛡️',
    description: '외곽 초소를 급습해 상대 보관품을 턴다. 성공하면 상대 병뚜껑을 빼앗는다.\n실패시 병뚜껑 2개를 잃는다.',
    requiredTypes: [
      {
        type: '용감이',
        count: 1
      },
      {
        type: '반장',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_cap_from_player',
      amount: 9
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 2
    }
  },
  {
    id: 'e_coerce',
    tier: 2,
    count: 0,
    category: 'attack',
    eventType: 'action_attack',
    name: '협박',
    scope: 'personal',
    emoji: '😠',
    description: '아무것도 없는 공터에서 마주쳤다. 피할 곳도 없고 변명할 것도 없다. 위압적인 협박으로 상대 병뚜껑을 빼앗는다.\n실패시 병뚜껑 1개를 잃는다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_cap_from_player',
      amount: 8
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 1
    },
    requiredTypes: [
      {
        type: '용감이',
        count: 1
      }
    ]
  },
  {
    id: 'e_poach',
    tier: 2,
    category: 'attack',
    eventType: 'action_attack',
    name: '인재 영입',
    scope: 'personal',
    emoji: '🎭',
    description: '상대 파티의 인재를 설득해 움직임을 흔든다. 성공하면 상대 생존자 1명을 비활성화한다.\n실패시 병뚜껑 1개를 잃는다.',
    assignment: {
      minSurvivors: 2,
      maxSurvivors: 5
    },
    resolution: {
      type: 'deactivate_from_party'
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 1
    },
    requiredTypes: [
      {
        type: '분위기메이커',
        count: 1
      },
      {
        type: '용감이',
        count: 1
      }
    ]
  },
  {
    id: 'e_two_gone',
    tier: 3,
    category: 'score',
    eventType: 'resource',
    name: '최종 진형 정비',
    scope: 'personal',
    emoji: '🚪',
    description: '유토피아 직전의 위험한 선택. 4차원의 판단이 맞아떨어지면 숨겨진 보물을 찾는다.\n실패시 통조림 3개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 21
    },
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 3
    }
  },
  {
    id: 'e_raid',
    tier: 3,
    count: 0,
    category: 'attack',
    eventType: 'action_attack',
    name: '습격',
    scope: 'personal',
    emoji: '⚡',
    description: '먼 곳의 거친 습격전. 성공하면 상대 생존자 1명을 수색 덱으로 돌려보낸다.\n실패시 통조림 2개를 잃는다.',
    requiredTypes: [
      {
        type: '4차원',
        count: 1
      },
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'return_survivor_to_deck'
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_sabotage',
    tier: 3,
    count: 0,
    category: 'attack',
    eventType: 'action_attack',
    name: '방해 공작',
    scope: 'personal',
    emoji: '💣',
    description: '오리교 세력이 퍼져 있는 구역이다. 방해 공작을 펼치면 이쪽 사람들이 특히 잘 흔들린다. 성공하면 상대 4차원 생존자들을 비활성화한다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'deactivate_type_all_others',
      survivorType: '4차원'
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 2
    },
    requiredTypes: [
      {
        type: '4차원',
        count: 2
      }
    ]
  },
  {
    id: 'e_headhunt',
    tier: 3,
    count: 0,
    category: 'attack',
    eventType: 'action_attack',
    name: '스카우트',
    scope: 'personal',
    emoji: '🎯',
    description: '위험한 스카우트 작전. 성공하면 상대 생존자 1명을 내 파티로 데려온다.\n실패시 병뚜껑 2개를 잃는다.',
    requiredTypes: [
      {
        type: '4차원',
        count: 1
      },
      {
        type: '반장',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'take_from_party'
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 2
    }
  },
  {
    id: 'e_necromancer',
    tier: 3,
    count: 0,
    category: 'interaction',
    eventType: 'resource',
    name: '강령 의식',
    scope: 'personal',
    emoji: '🧟',
    description: '기묘한 의식으로 떠난 생존자의 흔적을 되살린다. 근처 벽에 꽥꽥 소리를 적어 놓은 낙서가 가득한데, 아마 상관없을 것이다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 20
    },
    reward: [
      {
        type: 'survivor',
        amount: 1
      },
      {
        type: 'can',
        amount: 4
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_distorted_beacon',
    tier: 3,
    category: 'attack',
    eventType: 'resource',
    name: '왜곡된 신호탑',
    scope: 'personal',
    emoji: '📶',
    description: '먼 곳의 신호탑을 조작해 숨겨진 보물 좌표를 찾는다. 탑 기단부에 오리 모양 낙서가 잔뜩 그려져 있다. 아무도 설명하지 않는다.\n실패시 병뚜껑 2개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 21
    },
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_cap',
      amount: 2
    }
  },
  {
    id: 'e_infiltrate',
    tier: 3,
    count: 0,
    category: 'attack',
    eventType: 'action_attack',
    name: '침투 공작',
    scope: 'personal',
    emoji: '🕵️',
    description: '먼 곳 깊숙이 침투해 상대 파티를 흔든다. 성공하면 상대 생존자 1명을 수색 덱으로 돌려보낸다.\n실패시 통조림 2개를 잃는다.',
    requiredTypes: [
      {
        type: '4차원',
        count: 2
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'return_survivor_to_deck'
    },
    reward: null,
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_double_threat',
    tier: 3,
    category: 'attack',
    eventType: 'resource',
    name: '이중 협박',
    scope: 'personal',
    emoji: '🔱',
    description: '이중 협박으로 숨겨진 보물의 위치를 알아낸다.\n실패시 병뚜껑 3개를 잃는다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 21
    },
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_cap',
      amount: 3
    }
  },
  {
    id: 'e_t3_rich_cache',
    tier: 3,
    count: 1,
    category: 'interaction',
    eventType: 'action_attack',
    name: '소문난 병뚜껑 창고',
    scope: 'personal',
    emoji: '🏦',
    description: '소문난 병뚜껑 창고를 가진 상대를 턴다. 성공하면 상대 병뚜껑을 대량으로 빼앗는다.\n실패시 병뚜껑 2개를 잃는다.',
    requiredTypes: [
      {
        type: '4차원',
        count: 1
      },
      {
        type: '용감이',
        count: 1
      }
    ],
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5
    },
    resolution: {
      type: 'steal_cap_from_player',
      amount: 12
    },
    reward: null,
    failPenalty: {
      type: 'lose_cap',
      amount: 2
    }
  },
  {
    id: 'e_dice_elite_gate',
    tier: 3,
    category: 'dice',
    eventType: 'resource',
    name: '정예 관문',
    scope: 'personal',
    emoji: '🏛️',
    description: '유토피아로 향하는 마지막 방어선. 파티의 진가를 증명해야만 통과할 수 있다.\n주사위 합 + 파티 총점으로 판정한다.\n실패시 생존자 1명이 다친다.',
    resolution: {
      type: 'roll_dice_score_bonus',
      diceCount: 1,
      target: 30
    },
    reward: [
      {
        type: 'score',
        amount: 2
      },
      {
        type: 'can',
        amount: 4
      },
      {
        type: 'cap',
        amount: 3
      }
    ],
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_dice_ambush',
    tier: 3,
    count: 0,
    category: 'dice',
    eventType: 'resource',
    name: '군수창고 기습',
    scope: 'personal',
    emoji: '🌙',
    description: '야간을 틈타 버려진 군수창고를 급습한다.\n실패시 생존자 1명이 다친다.',
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19
    },
    reward: [
      {
        type: 'score',
        amount: 2
      },
      {
        type: 'can',
        amount: 3
      },
      {
        type: 'cap',
        amount: 2
      }
    ],
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_dice_abandoned',
    tier: 3,
    count: 0,
    category: 'dice',
    eventType: 'resource',
    name: '버려진 기지',
    scope: 'personal',
    emoji: '🏕️',
    description: '오래된 군사 기지를 발견했다. \n실패시 통조림 2개를 잃는다.',
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19
    },
    reward: [
      {
        type: 'survivor',
        amount: 1
      },
      {
        type: 'cap',
        amount: 3
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_dice_gamble',
    tier: 3,
    count: 0,
    category: 'dice',
    eventType: 'resource',
    name: '목숨을 건 도박',
    scope: 'personal',
    emoji: '🎰',
    description: '다 걸었다.\n실패시 통조림 4개를 잃는다.',
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 20
    },
    reward: [
      {
        type: 'score',
        amount: 2
      },
      {
        type: 'can',
        amount: 5
      },
      {
        type: 'cap',
        amount: 2
      }
    ],
    failPenalty: {
      type: 'lose_can',
      amount: 4
    }
  },
  {
    id: 'e_dice_lastbet',
    tier: 3,
    count: 1,
    category: 'dice',
    eventType: 'resource',
    name: '최후의 도박',
    scope: 'personal',
    emoji: '🃏',
    description: '열쇠로 봉인된 금고를 연다. 모든 것을 걸었다. \n실패시 동료를 한명 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 2
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 22,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_key_hidden_vault',
    tier: 3,
    category: 'dice',
    eventType: 'resource',
    name: '숨겨진 금고',
    scope: 'personal',
    emoji: '💎',
    description: '여정 끝에서 열쇠 구멍이 남은 금고를 발견했다. 열면 판을 뒤집을 만한 보물이 잠들어 있다.\n실패시 통조림 3개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 1
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 21,
      requiresKey: true
    },
    requiresKey: true,
    reward: {
      type: 'treasure',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 3
    }
  },
  {
    id: 'e_clue_1_flyer',
    tier: 1,
    category: 'clue',
    eventType: 'item',
    name: '낡은 전단지',
    scope: 'personal',
    emoji: '📄',
    description: '근처 건물 벽에 붙어있던 오래된 전단지. \n점선이 어딘가를 가리키고 있다.\n실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 10
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_clue_1_radio',
    tier: 1,
    category: 'clue',
    eventType: 'item',
    name: '흐릿한 라디오 신호',
    scope: 'personal',
    emoji: '📻',
    description: '잡음 속에 누군가의 목소리가 들린다. \n집중하면 방향을 파악할 수 있을 것 같다.\n실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 10
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_clue_1_sketch',
    tier: 1,
    category: 'clue',
    eventType: 'item',
    name: '낙서된 약도',
    scope: 'personal',
    emoji: '✏️',
    description: '누군가 급히 그린 것 같은 약도가 보인다. \n해독하면 단서가 될 수 있다.\n실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 12
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_clue_1_rumor',
    tier: 1,
    category: 'clue',
    eventType: 'item',
    name: '목격자의 소문',
    scope: 'personal',
    emoji: '👂',
    description: '근처 주민에게 들은 소문. \n어딘가에 안전한 곳이 있다고...\n실패시 통조림 1개를 잃는다.',
    recommendedParty: [
      {
        type: '분위기메이커',
        count: 1
      },
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 12
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 1
    }
  },
  {
    id: 'e_clue_map',
    tier: 2,
    category: 'clue',
    eventType: 'item',
    name: '유토피아 지도 조각',
    scope: 'personal',
    emoji: '🗺️',
    description: '찢긴 지도 한 조각. \n점선이 가리키는 방향에 우리가 찾던 그 땅이 있는 것 같다.\n실패시 생존자 1명이 다친다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 17
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_clue_witness',
    tier: 2,
    category: 'clue',
    eventType: 'item',
    name: '생존자의 증언',
    scope: 'personal',
    emoji: '👁️',
    description: '「거긴 진짜 있어. 내가 봤다고.」 유토피아를 목격한 생존자의 증언.\n실패시 통조림 3개를 잃는다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 17
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 3
    }
  },
  {
    id: 'e_clue_2_audio',
    tier: 2,
    category: 'clue',
    eventType: 'item',
    name: '음성 기록 단편',
    scope: 'personal',
    emoji: '🎙️',
    description: '연구소에서 발견한 손상된 녹음기. \n내용을 복원하면 좌표에 대한 단서를 얻을 수 있다.\n실패시 통조림 2개를 잃는다.',
    recommendedParty: [
      {
        type: '용감이',
        count: 1
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 2
    }
  },
  {
    id: 'e_clue_2_docs',
    tier: 2,
    category: 'clue',
    eventType: 'item',
    name: '비밀 연구 문서',
    scope: 'personal',
    emoji: '📋',
    description: '분류 표시가 된 문서. \n유토피아 관련 연구 기록인 것 같다.\n실패시 생존자 1명이 다친다.',
    recommendedParty: [
      {
        type: '겁쟁이',
        count: 1
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 19
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_clue_3_broadcast',
    tier: 3,
    category: 'clue',
    eventType: 'item',
    name: '최후의 방송',
    scope: 'personal',
    emoji: '📺',
    description: '세상이 무너지기 직전 마지막으로 송출된 방송. 당시 공연 중이던 아이돌이 마이크를 들고 직접 읽었다고 한다.\n좌표를 해독할 수 있다면...\n실패시 생존자 1명이 다친다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 2
      },
      {
        type: '분위기메이커',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 24
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_clue_3_coords',
    tier: 3,
    category: 'clue',
    eventType: 'item',
    name: '유토피아 좌표',
    scope: 'personal',
    emoji: '🛰️',
    description: '암호화된 좌표 데이터. \n해독 완료 시 목적지가 확정된다.\n실패시 통조림 4개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 2
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 24
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 4
    }
  },
  {
    id: 'e_clue_3_blueprint',
    tier: 3,
    category: 'clue',
    eventType: 'item',
    name: '유토피아 설계도',
    scope: 'personal',
    emoji: '📐',
    description: '방대한 도면. \n규모가 실제라면, 수천 명이 살 수 있는 곳이다.\n실패시 생존자 1명이 다친다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 2
      },
      {
        type: '반장',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 25
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'remove_random',
      amount: 1
    }
  },
  {
    id: 'e_clue_3_code',
    tier: 3,
    category: 'clue',
    eventType: 'item',
    name: '핵심 접근 코드',
    scope: 'personal',
    emoji: '🔑',
    description: '유토피아 진입을 위한 마지막 코드. \n이게 진짜라면...\n실패시 통조림 3개를 잃는다.',
    recommendedParty: [
      {
        type: '4차원',
        count: 2
      },
      {
        type: '겁쟁이',
        count: 1
      }
    ],
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 25
    },
    reward: {
      type: 'clue',
      amount: 1
    },
    failPenalty: {
      type: 'lose_can',
      amount: 3
    }
  },
  {
    id: 'e_utopia',
    tier: 3,
    category: 'utopia',
    eventType: 'item',
    name: '유토피아',
    scope: 'personal',
    emoji: '🌅',
    description: '마침내, 전설로만 전해지던 그 땅이 눈앞에 펼쳐졌다.\n운명이 이곳으로 이끈 것인지, 아니면 실낱 같은 희망이 기적을 불러온 것인지...\n파티의 전력을 모아 끝까지 돌파하라.',
    resolution: {
      type: 'roll_dice',
      diceCount: 1,
      target: 15
    },
    recommendedParty: [
      {
        type: '4차원',
        count: 2
      },
      {
        type: '용감이',
        count: 1
      }
    ],
    reward: {
      type: 'score',
      amount: 5
    }
  },
  {
    id: 'e_disaster_rain',
    tier: 1,
    count: 0,
    name: '폭우',
    scope: 'disaster',
    eventType: 'disaster',
    emoji: '🌧️',
    description: '갑작스러운 폭우가 쏟아진다. 식량이 물에 잠긴다.\n모든 플레이어의 통조림이 2개 감소한다.',
    globalEffect: {
      type: 'lose_can_all',
      amount: 2
    }
  },
  {
    id: 'e_disaster_drought',
    tier: 2,
    name: '극심한 가뭄',
    scope: 'disaster',
    eventType: 'disaster',
    emoji: '🏜️',
    description: '모든 플레이어의 통조림이 절반으로 줄어든다.',
    globalEffect: {
      type: 'halve_can_all'
    }
  },
  {
    id: 'e_disaster_quake',
    tier: 2,
    name: '대지진',
    scope: 'disaster',
    eventType: 'disaster',
    emoji: '🌋',
    description: '모든 파티의 생존자 순서가 무작위로 섞이고 생존자 1명이 제거된다.',
    globalEffect: {
      type: 'compound',
      effects: [
        {
          type: 'shuffle_all_parties'
        },
        {
          type: 'remove_all_n',
          amount: 1
        }
      ]
    }
  },
  {
    id: 'e_disaster_flood',
    tier: 3,
    name: '대홍수',
    scope: 'disaster',
    eventType: 'disaster',
    emoji: '🌊',
    description: '모든 플레이어의 통조림 5개 감소, 생존자 1명 무작위 제거.',
    globalEffect: {
      type: 'compound',
      effects: [
        {
          type: 'lose_can_all',
          amount: 5
        },
        {
          type: 'remove_all_n',
          amount: 1
        }
      ]
    }
  },
  {
    id: 'e_disaster_comet',
    tier: 3,
    name: '혜성 충돌',
    scope: 'disaster',
    eventType: 'disaster',
    emoji: '☄️',
    description: '모든 파티에서 생존자 2명씩 제거된다.',
    globalEffect: {
      type: 'remove_all_n',
      amount: 2
    }
  },
  {
    id: 'e_disaster_nuclear',
    tier: 3,
    name: '핵폭발 여파',
    scope: 'disaster',
    eventType: 'disaster',
    emoji: '☢️',
    description: '지평선 너머에서 버섯구름이 피어오른다.\n모든 파티에서 생존자 2명이 제거되고, 병뚜껑이 4개 감소한다.',
    globalEffect: {
      type: 'compound',
      effects: [
        {
          type: 'remove_all_n',
          amount: 2
        },
        {
          type: 'lose_cap_all',
          amount: 4
        }
      ]
    }
  }
]

export const EVENTS = DESIGN_EVENTS.length > 0 ? DESIGN_EVENTS : FALLBACK_EVENTS

const TIER_ASSIGNMENT = {
  1: { minSurvivors: 1, maxSurvivors: 1 },
  2: { minSurvivors: 2, maxSurvivors: 3 },
  3: { minSurvivors: 3, maxSurvivors: 5 },
}

const DEFAULT_RECOMMENDED_PARTY_BONUS = 2
const RECOMMENDED_PARTY_BY_EVENT_ID = {}

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
  if (Object.prototype.hasOwnProperty.call(card, 'assignment')) {
    return parseAssignmentCell(card.assignment) ?? { minSurvivors: 0 }
  }
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
  const parsedReward = parseRewardCell(reward)
  if (!parsedReward) return []
  return Array.isArray(parsedReward) ? parsedReward : [parsedReward]
}

function normalizeRecommendedParty(card) {
  const recommendedParty = parseTypeCountList(card.recommendedParty ?? RECOMMENDED_PARTY_BY_EVENT_ID[card.id] ?? [])
  return recommendedParty.map((entry) => ({ ...entry }))
}

function isRecommendedPartyBonusEvent(card) {
  return card.resolution?.type === 'roll_dice'
    || card.category === 'utopia'
}

function normalizeRequiredTypes(card) {
  const requiredEntries = [
    ...(card.requiredType ? [{ type: card.requiredType, count: 1 }] : []),
    ...parseTypeCountList(card.requiredTypes ?? []),
  ]
  const requiredByType = new Map()
  requiredEntries.forEach(({ type, count = 1 }) => {
    if (!type) return
    requiredByType.set(type, (requiredByType.get(type) ?? 0) + count)
  })
  return Array.from(requiredByType, ([type, count]) => ({ type, count }))
}

function normalizeExplorationCard(card) {
  const deck = inferDeck(card)
  const isClue = deck === 'clue'
  const isDisaster = deck === 'disaster'
  const isUtopia = deck === 'utopia'
  const recommendedParty = normalizeRecommendedParty(card)
  const requiredTypes = normalizeRequiredTypes(card)
  const parsedResolution = parseResolutionCell(card.resolution)
  const resolution = parsedResolution ?? (isDisaster ? null : { type: 'complete' })
  const rewards = normalizeRewards(card.reward)
  const shouldKeepRecommendedParty = isRecommendedPartyBonusEvent({ ...card, resolution })
  const failPenalty = parsePenaltyCell(card.failPenalty)
  const opponentRequirement = parseOpponentRequirementCell(card.opponentRequirement)
  const globalEffect = parseGlobalEffectCell(card.globalEffect)
  const cleanCard = { ...card }
  delete cleanCard.recommendedParty
  delete cleanCard.recommendedPartyBonus
  delete cleanCard.requiredTypes
  delete cleanCard.requiredType

  const base = {
    ...cleanCard,
    ...(resolution ? { resolution } : {}),
    reward: rewards.length > 0 ? rewards : null,
    failPenalty,
    opponentRequirement,
    globalEffect,
    deck,
    assignment: isDisaster ? null : (isClue ? cloneClueAssignment(card) : cloneCardAssignment(card)),
    ...(requiredTypes.length > 0 ? {
      requiredTypes,
      ...(requiredTypes.length === 1 && requiredTypes[0].count === 1 ? { requiredType: requiredTypes[0].type } : {}),
    } : {}),
    ...(shouldKeepRecommendedParty && recommendedParty.length > 0 ? {
      recommendedParty,
      recommendedPartyBonus: card.recommendedPartyBonus ?? (1 + recommendedParty.length),
    } : {}),
  }

  if (isDisaster) {
    return {
      ...base,
      autoResolve: true,
      effect: globalEffect ?? null,
    }
  }

  if (isUtopia) {
    return {
      ...base,
      check: resolution ?? null,
      onSuccess: {
        rewards,
        claimCard: true,
      },
      onFailure: {
        penalty: failPenalty ?? null,
        stayOpen: true,
      },
    }
  }

    return {
      ...base,
      check: resolution ?? null,
      onSuccess: {
        rewards,
        claimCard: isClue,
        unlocksTier: isClue && card.tier < 3 ? card.tier + 1 : null,
        revealsUtopia: isClue && card.tier === 3,
      },
      onFailure: {
        penalty: failPenalty ?? null,
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
