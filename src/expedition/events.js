// A single physical deck below the journey board; the active card changes everyone's rules.
export const EVENT_SPACES = [3, 6, 9, 12, 15, 18]
export const EVENT_CARDS = [
  { id:'food-cut', stage:1, kind:'disaster', name:'식량 공급 단절', icon:'▧', effect:'incomeCan', amount:-1, text:'밤 보급 통조림 −1. 최저 0.', cost:2, crew:2, types:['분위기메이커','4차원'] },
  { id:'sandstorm', stage:1, kind:'disaster', name:'모래 폭풍', icon:'≈', effect:'exploreDie', amount:-1, text:'탐색에서 각 파티의 가장 높은 주사위 눈 −1. 최저 1.', cost:2, crew:2, types:['겁쟁이','반장'] },
  { id:'airdrop', stage:1, kind:'miracle', name:'보급 낙하산', icon:'✚', effect:'forageCan', amount:1, text:'지도자의 안전한 탐색으로 얻는 통조림 +1.', cost:2, crew:2, types:['분위기메이커','용감이'] },
  { id:'scrap-truck', stage:1, kind:'miracle', name:'고물 트럭', icon:'✦', effect:'forageCap', amount:1, text:'지도자의 안전한 탐색으로 얻는 병뚜껑 +1.', cost:2, crew:2, types:['반장','4차원'] },
  { id:'raiders', stage:2, kind:'disaster', name:'약탈자 습격', icon:'⚑', effect:'recruit', amount:1, text:'생존자 영입 비용 +1. 무료 구조 보상 제외.', cost:3, crew:2, types:['용감이','반장'] },
  { id:'bridge', stage:2, kind:'disaster', name:'무너진 다리', icon:'╳', effect:'dispatchLimit', amount:-1, text:'한 차례에 동료를 1명까지만 파견합니다.', cost:3, crew:2, types:['용감이','4차원'] },
  { id:'warm-night', stage:2, kind:'miracle', name:'따뜻한 밤', icon:'☾', effect:'meal', amount:-1, text:'동료 한 명의 식사 비용 통조림 −1. 최저 0.', cost:3, crew:2, types:['겁쟁이','분위기메이커'] },
  { id:'radio', stage:2, kind:'miracle', name:'선명한 무전', icon:'✧', effect:'exploreDie', amount:1, text:'탐색에서 각 파티의 가장 높은 주사위 눈 +1. 최대 6.', cost:3, crew:2, types:['반장','4차원'] },
  { id:'flood', stage:3, kind:'disaster', name:'대홍수', icon:'≋', effect:'incomeCan', amount:-2, text:'밤 보급 통조림 −2. 최저 0.', cost:4, crew:3, allTypes:true, types:['겁쟁이','반장'] },
  { id:'cold', stage:3, kind:'disaster', name:'마지막 한파', icon:'❄', effect:'meal', amount:1, text:'동료 한 명의 식사 비용 통조림 +1. 식사 면제는 유지.', cost:5, crew:3, allTypes:true, types:['4차원','겁쟁이'] },
  { id:'beacon', stage:3, kind:'miracle', name:'유토피아의 신호', icon:'☀', effect:'routeReward', amount:1, text:'탐색의 여정 보상 한 묶음마다 이동 +1.', cost:4, crew:3, allTypes:true, types:['반장','분위기메이커'] },
  { id:'hope-song', stage:3, kind:'miracle', name:'희망의 노래', icon:'♪', effect:'incomeCan', amount:1, text:'밤 보급 통조림 +1.', cost:4, crew:3, allTypes:true, types:['용감이','분위기메이커'] },
]
export const createEventDeck = (shuffle, random) => [1,2,3].flatMap(stage => shuffle(EVENT_CARDS.filter(c => c.stage === stage), random).slice(0,2))
export const eventModifier = (g, p, effect) => g?.activeEvent?.card.effect === effect && !(g.activeEvent.card.kind === 'disaster' && p?.eventProtection === g.activeEvent.serial) ? g.activeEvent.card.amount : 0
export const eventCrewValid = (event, crew) => crew.length === event.crew && crew.every(c => c.ready) && (event.allTypes ? event.types.every(t => crew.some(c => c.type === t)) : crew.some(c => event.types.includes(c.type)))

export const STAGE_MARKS = ['Ⅰ', 'Ⅱ', 'Ⅲ']
