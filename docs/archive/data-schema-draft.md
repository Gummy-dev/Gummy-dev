> 보관 문서: 과거 기획·실험 기록입니다. 현재 규칙은 [프로토타입 규칙](../expedition-prototype.md)을 따릅니다.

# 탐색 개편용 데이터 스키마 초안

기준일: 2026-05-05

이 문서는 `주변 탐색 / 생존자 수색 / 활성-비활성 / 단계별 단서 / 지도자별 유토피아` 구조를 실제 코드 데이터로 옮기기 위한 `events.js`, `rules.js` 중심 스키마 초안입니다.

현재 구현과 1:1로 맞는 문서가 아니라, `다음 개편 버전의 목표 데이터 형태`를 고정하는 용도입니다.

## 1. 설계 목표

이번 개편에서 데이터 스키마가 만족해야 할 요구는 아래와 같습니다.

- `이벤트 구역`이 아니라 `주변 탐색 덱`을 단계별로 관리할 수 있어야 함
- `용병소`가 아니라 `생존자 수색`을 별도 덱/슬롯 구조로 관리할 수 있어야 함
- 생존자 파견 인원, 권장 파티, 주사위 목표치, 위험도 같은 탐색 정보를 카드에 직접 실을 수 있어야 함
- 유토피아 단서를 `해결 후 소유하는 카드`로 다룰 수 있어야 함
- 유토피아 카드를 일반 탐색 덱과 분리하고, 지도자별로 다른 카드 5종을 들고 있을 수 있어야 함
- 재활성화 비용을 일괄 기본값으로 쓰되, 생존자별 예외도 지정할 수 있어야 함

## 2. 스키마 분리 원칙

개편 후에는 데이터를 아래 파일/영역으로 분리하는 것을 권장합니다.

- `src/data/rules.js`
  - 전역 규칙 상수
  - 단계별 파견 인원, 슬롯 수, 기본 비용 등
- `src/data/events.js`
  - 단계별 주변 탐색 카드
  - 단계별 단서 카드
  - 단계별 재난 카드
- `src/data/utopias.js`
  - 지도자별 유토피아 카드 5종
- `src/data/survivors.js`
  - 생존자 카드
  - `reactivationCost` 포함
- `src/data/search.js` 또는 `rules.js` 내부 영역
  - 생존자 수색 슬롯/공개 규칙

초기 구현 속도를 위해 `events.js` 안에 여러 export를 두는 것도 가능하지만, 장기적으로는 `utopias.js` 분리가 가장 깔끔합니다.

## 3. rules.js 목표 스키마

기존 `RULES`는 단순 상수 모음이었지만, 다음 개편에서는 하위 영역을 가진 구조가 더 적합합니다.

권장 형태:

```js
export const RULES = {
  party: {
    maxSize: 5,
    reorderCost: 2,
  },

  economy: {
    capPerSurvivorPerTurn: 1,
    defaultReactivationCost: { can: 1 },
  },

  turn: {
    phases: ['action', 'party_maintenance'],
  },

  search: {
    slotCount: 2,
    revealActionCost: 1,
    recruitStartsInactive: true,
  },

  exploration: {
    slotCountByTier: {
      1: 4,
      2: 4,
      3: 4,
    },
    displayOrder: [3, 2, 1],
    tiers: {
      1: {
        label: '가까운 탐색',
        minAssigned: 1,
        maxAssigned: 1,
        color: 'light',
      },
      2: {
        label: '중간 탐색',
        minAssigned: 2,
        maxAssigned: 3,
        color: 'mid',
      },
      3: {
        label: '먼 곳 탐색',
        minAssigned: 3,
        maxAssigned: 5,
        color: 'dark',
      },
    },
  },

  clues: {
    ownershipRequiredForTierAccess: true,
    copiesPerTierByPlayerCount: {
      2: 2,
      3: 3,
      4: 4,
      5: 5,
    },
  },

  utopia: {
    revealOnFirstTier3Clue: true,
    restrictActionToUtopiaForTier3Players: true,
    finalRoundAfterClaim: true,
    visibleSlotTier: 3,
  },

  scoring: {
    allNormalPartyBonus: 3,
  },

  bot: {
    thinkDelay: 900,
  },
}
```

### rules.js 변경 의도

- `eventRevealCost`, `eventSlotCount`, `clueTarget`처럼 기존 이벤트 중심 상수는 삭제 또는 재해석
- `exploration.tiers` 아래에 인원수, 색상, 단계명, 슬롯 수를 모아 두면 UI와 로직이 같은 기준을 공유하기 쉬움
- `economy.defaultReactivationCost`를 두면 생존자 데이터에 비용이 없는 경우 기본값을 바로 참조할 수 있음
- `exploration.displayOrder`를 두면 실제 보드 렌더 순서 `3 -> 2 -> 1`을 규칙과 UI가 함께 공유할 수 있음

## 4. survivors.js 관련 최소 확장

이번 단계의 중심은 `events.js`와 `rules.js`지만, 실제로는 생존자 데이터에 아래 필드가 같이 필요합니다.

```js
{
  id: 's_escapee',
  name: '탈옥 생존자',
  type: '4차원',
  reactivationCost: { can: 1 },
}
```

권장 원칙:

- `reactivationCost`가 없으면 `RULES.economy.defaultReactivationCost` 사용
- 모든 생존자는 기본적으로 `inactive` 상태를 가질 수 있다고 가정
- 새 영입 생존자는 `inactive`로 시작

## 5. events.js 목표 export 구조

기존처럼 `EVENTS` 단일 배열 하나로 관리하기보다, 아래처럼 목적별 export를 분리하는 편이 좋습니다.

```js
export const EXPLORATION_TIERS = {
  1: [...],
  2: [...],
  3: [...],
}

export const CLUE_CARDS = {
  1: [...],
  2: [...],
  3: [...],
}

export const DISASTER_CARDS = {
  1: [...],
  2: [...],
  3: [...],
}
```

또는 배열을 선호하면:

```js
export const EXPLORATION_CARDS = [
  { id: 'exp_1_001', tier: 1, deck: 'exploration', ... },
  { id: 'clue_1_001', tier: 1, deck: 'clue', ... },
  { id: 'dis_1_001', tier: 1, deck: 'disaster', ... },
]
```

하지만 현재 기획 기준으로는 `분리 export` 쪽이 셔플/보충/복제 수량 계산에 더 유리합니다.

실제 상태 모델은 `덱`과 `공개 시장`을 분리해 들고 가는 구조를 권장합니다.

```js
explorationState = {
  decksByTier: {
    1: [...],
    2: [...],
    3: [...],
  },
  visibleByTier: {
    1: [cardOrNull, cardOrNull, cardOrNull, cardOrNull],
    2: [cardOrNull, cardOrNull, cardOrNull, cardOrNull],
    3: [cardOrNull, cardOrNull, cardOrNull, cardOrNull],
  },
  discardByTier: {
    1: [],
    2: [],
    3: [],
  },
}
```

권장 원칙:

- `visibleByTier`는 항상 길이 4 배열 유지
- 카드가 해결되면 해당 칸은 즉시 `null`
- 리필은 다음 턴 시작 직전 `null` 슬롯만 보충

## 6. 주변 탐색 카드 스키마

주변 탐색 카드는 기존 `scope`, `resolution`, `reward` 개념을 일부 유지하되, `파견 인원`과 `권장 파티`를 1급 정보로 승격합니다.

권장 형태:

```js
{
  id: 'exp_2_bridge_toll',
  tier: 2,
  deck: 'exploration',
  category: 'resource',
  name: '다리 통행료',
  emoji: '🌉',
  colorBand: 'mid',

  assignment: {
    minSurvivors: 2,
    maxSurvivors: 3,
  },

  recommendedParty: [
    { type: '반장', count: 1 },
    { type: '용감이', count: 1 },
  ],

  check: {
    type: 'roll_dice',
    diceCount: 2,
    target: 9,
    recommendedPartyBonus: 1,
  },

  onSuccess: {
    rewards: [
      { type: 'can', amount: 3 },
      { type: 'cap', amount: 2 },
    ],
    claimCard: false,
  },

  onFailure: {
    penalty: { type: 'lose_can', amount: 2 },
    stayOpen: false,
  },

  tags: ['bridge', 'travel'],
}
```

핵심 필드:

- `tier`: 1, 2, 3
- `deck`: `exploration`
- `assignment`: 이 탐색에 파견해야 하는 활성 생존자 수
- `recommendedParty`: 조합 보너스 계산에 쓰이는 권장 타입
- `check`: 해결 판정
- `onSuccess`: 보상
- `onFailure`: 실패 패널티 및 카드 유지 여부

## 7. 단서 카드 스키마

단서 카드는 일반 탐색 카드와 비슷하지만, 해결 시 카드가 버려지지 않고 플레이어가 소유합니다.

```js
{
  id: 'clue_1_map_fragment',
  tier: 1,
  deck: 'clue',
  clueLevel: 1,
  name: '낡은 지도 조각',
  emoji: '🧭',

  assignment: {
    minSurvivors: 1,
    maxSurvivors: 1,
  },

  recommendedParty: [
    { type: '4차원', count: 1 },
  ],

  check: {
    type: 'roll_dice',
    diceCount: 2,
    target: 8,
    recommendedPartyBonus: 1,
  },

  onSuccess: {
    claimCard: true,
    unlocksTier: 2,
  },

  onFailure: {
    penalty: { type: 'lose_can', amount: 2 },
    stayOpen: true,
  },
}
```

추가 필드:

- `clueLevel`: 1, 2, 3
- `claimCard: true`
- `unlocksTier`: 다음 단계 접근 권한
- `stayOpen: true/false`
  - 단서 실패 시 카드가 남는 구조를 계속 쓸지 여부를 카드별로 표현 가능

## 8. 재난 카드 스키마

재난은 별도 덱이지만, 각 티어 탐색 더미에 섞여 들어갑니다.

```js
{
  id: 'dis_2_flood',
  tier: 2,
  deck: 'disaster',
  name: '대홍수',
  emoji: '🌊',
  severity: 'major',

  assignment: null,

  effect: {
    type: 'compound',
    items: [
      { type: 'lose_can_all', amount: 2 },
      { type: 'remove_all_n', amount: 1 },
    ],
  },

  autoResolve: true,
}
```

핵심 차이:

- `deck: 'disaster'`
- `autoResolve: true`
- 일반적으로 `check`, `onSuccess`, `onFailure` 대신 `effect` 사용

## 9. 유토피아 카드 스키마

유토피아 카드는 일반 이벤트가 아니라 지도자별 전용 엔드게임 카드입니다.

권장 파일: `src/data/utopias.js`

```js
export const UTOPIA_CARDS = {
  shy: {
    id: 'utopia_shy',
    leaderId: 'shy',
    name: '고요한 은신처',
    emoji: '🌿',
    description: '겁쟁이 지도자가 꿈꾸는, 누구도 침범하지 않는 안전한 마을',

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
      diceCount: 2,
      target: 14,
      recommendedPartyBonus: 2,
    },
  },
}
```

핵심 필드:

- `leaderId`: 어떤 지도자에 대응하는 유토피아인지
- `recommendedParty`: 엔드게임용 권장 조합
- 일반 탐색 카드와 비슷한 판정 구조를 공유할 수 있게 `assignment`, `check`는 비슷하게 유지

## 10. 생존자 수색 데이터 스키마

생존자 수색은 탐색과 별도로 운용하지만, 액션 규칙을 데이터화해 두는 편이 좋습니다.

권장 형태:

```js
export const SEARCH_RULES = {
  revealActionCost: 1,
  assignedSurvivorsRequired: 1,
  recruitStartsInactive: true,
  visibleSlotCount: 2,
}
```

또는 `RULES.search` 안으로 포함:

```js
search: {
  slotCount: 2,
  assignedSurvivorsRequired: 1,
  revealActionCost: 1,
  recruitStartsInactive: true,
}
```

## 11. 추천 파티 구조

`recommendedParty`는 다음과 같은 단순 배열 구조를 유지하는 게 좋습니다.

```js
recommendedParty: [
  { type: '반장', count: 1 },
  { type: '용감이', count: 1 },
  { type: '4차원', count: 1 },
]
```

이 방식의 장점:

- UI 표기가 쉬움
- 체크 로직이 단순함
- 이후 `or` 조건이 필요하면 상위 레벨에서 배열 중첩으로 확장 가능

확장 예시:

```js
recommendedParty: {
  mode: 'any',
  options: [
    [{ type: '반장', count: 1 }, { type: '용감이', count: 1 }],
    [{ type: '겁쟁이', count: 2 }],
  ],
}
```

초기 버전은 여기까지는 가지 말고, 단순 배열을 유지하는 편이 좋습니다.

## 12. 현재 스키마에서 제거 또는 축소할 필드

기존 `events.js` 기준으로 아래 요소는 축소 또는 재해석 대상입니다.

- `scope`
  - `personal/global/disaster` 대신 덱 종류와 `autoResolve`로 분기 가능
- `resolution`
  - `check`, `onSuccess`, `onFailure` 구조로 쪼개는 편이 읽기 쉬움
- `reward`
  - `onSuccess.rewards`로 이동
- `globalEffect`
  - 재난/글로벌형 효과는 `effect` 또는 `onResolve`로 통합 가능
- `eventRevealCost`
  - 삭제
  - 카드 확인은 지도자 행동 소비로 대체
- `clueTarget`
  - 삭제
  - 단서 누적 목표가 아니라 `티어별 단서 소유 + 유토피아 공개` 구조로 전환

## 13. 마이그레이션 가이드

### rules.js

기존:

```js
eventSlotCount
eventRevealCost
clueTarget
```

변경:

```js
exploration.slotCountByTier
exploration.tiers
clues.copiesPerTierByPlayerCount
utopia.revealOnFirstTier3Clue
```

### events.js

기존:

```js
resolution
reward
failPenalty
scope
globalEffect
```

변경:

```js
assignment
recommendedParty
check
onSuccess
onFailure
effect
deck
```

## 14. 구현 순서 권장

1. `rules.js`를 중첩 구조로 개편
2. `utopias.js` 신설
3. `events.js`를
   - `EXPLORATION_TIERS`
   - `CLUE_CARDS`
   - `DISASTER_CARDS`
   로 분리
4. `survivors.js`에 `reactivationCost` 기본 필드 추가
5. 이후 `gameStore.js`가 새 스키마를 읽도록 전환

## 15. 슬롯 리필 규칙 초안

실제 코드는 아래 흐름을 따르는 것이 가장 안정적입니다.

### 탐색 보드 리필

```js
for (const tier of [1, 2, 3]) {
  for (let i = 0; i < visibleByTier[tier].length; i += 1) {
    if (visibleByTier[tier][i] === null) {
      visibleByTier[tier][i] = decksByTier[tier].shift() ?? null
    }
  }
}
```

### 생존자 수색 리필

```js
for (let i = 0; i < searchState.visibleSlots.length; i += 1) {
  if (searchState.visibleSlots[i] === null) {
    searchState.visibleSlots[i] = searchState.deck.shift() ?? null
  }
}
```

### 타이밍 규칙

- 카드 해결 시 즉시 그 슬롯은 `null`
- 같은 턴에는 빈칸 상태를 유지
- `endTurn -> advanceTurn` 사이에서 일괄 리필

의도:

- 플레이어가 해결한 자리가 실제로 비워졌다는 감각을 분명히 주기 위함
- 예전 이벤트 슬롯 구조에서 있었던 `성공했는데 안 비워진 것처럼 보이는` 체감 문제를 방지
- 같은 턴에 새 카드가 연속 등장해 정보량이 과도하게 늘어나는 것을 막기 위함

## 16. 현재 권장 결론

현재 단계에서 가장 안전한 출발점은 아래입니다.

- `RULES`는 중첩 객체 구조로 개편
- `events.js`는 `탐색 / 단서 / 재난` export 분리
- `utopias.js`는 별도 신설
- 생존자 `reactivationCost`는 객체형 기본값 `{ can: 1 }`

이렇게 가면, 지금 문서에 정리된 개편 방향을 거의 그대로 코드에 매핑할 수 있습니다.
