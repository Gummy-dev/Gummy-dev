export const UTOPIA_CARDS = {
  shy: {
    id: 'utopia_shy',
    leaderId: 'shy',
    leaderType: '겁쟁이',
    name: '고요한 은신처',
    emoji: '🌿',
    description: '누구도 침범하지 않는 안전한 숨숨집. 겁쟁이들이 오래 살아남을 수 있는 유토피아.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5,
    },
    recommendedParty: [
      { type: '겁쟁이', count: 2 },
      { type: '반장', count: 1 },
    ],
    check: {
      type: 'roll_dice',
      diceCount: 1, target: 15,
      recommendedPartyBonus: 2,
    },
  },

  zombie: {
    id: 'utopia_zombie',
    leaderId: 'zombie',
    leaderType: '용감이',
    name: '끝없는 사냥터',
    emoji: '🩸',
    description: '용감한 자만 살아남는 약육강식의 낙원. 밀어붙이는 자에게만 길이 열린다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5,
    },
    recommendedParty: [
      { type: '용감이', count: 2 },
      { type: '분위기메이커', count: 1 },
    ],
    check: {
      type: 'roll_dice',
      diceCount: 1, target: 15,
      recommendedPartyBonus: 2,
    },
  },

  robot: {
    id: 'utopia_robot',
    leaderId: 'robot',
    leaderType: '반장',
    name: '완전 관리 구역',
    emoji: '🏙️',
    description: '모든 것이 계획되고 통제되는 도시. 정돈된 조합만이 진입할 수 있다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5,
    },
    recommendedParty: [
      { type: '반장', count: 2 },
      { type: '4차원', count: 1 },
    ],
    check: {
      type: 'roll_dice',
      diceCount: 1, target: 15,
      recommendedPartyBonus: 2,
    },
  },

  duck: {
    id: 'utopia_duck',
    leaderId: 'duck',
    leaderType: '4차원',
    name: '꽥의 차원문',
    emoji: '🌀',
    description: '상식이 무너진 문 너머의 낙원. 규칙을 비트는 자만이 도달할 수 있다.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5,
    },
    recommendedParty: [
      { type: '4차원', count: 2 },
      { type: '겁쟁이', count: 1 },
    ],
    check: {
      type: 'roll_dice',
      diceCount: 1, target: 15,
      recommendedPartyBonus: 2,
    },
  },

  idol: {
    id: 'utopia_idol',
    leaderId: 'idol',
    leaderType: '분위기메이커',
    name: '영원한 페스티벌',
    emoji: '🎆',
    description: '모두가 서로를 북돋우는 끝없는 축제. 연결과 증폭이 완성되는 무대.',
    assignment: {
      minSurvivors: 3,
      maxSurvivors: 5,
    },
    recommendedParty: [
      { type: '분위기메이커', count: 2 },
      { type: '용감이', count: 1 },
    ],
    check: {
      type: 'roll_dice',
      diceCount: 1, target: 15,
      recommendedPartyBonus: 2,
    },
  },
}

export const UTOPIA_CARD_LIST = Object.values(UTOPIA_CARDS)
