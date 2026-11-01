// Compatibility for saved games from before persistent events. New games use expedition/events.js.
// Face-down omen tiles on the Utopia journey track. A flipped tile is a disaster or a miracle; both hit every party.
export const OMEN_SPACES = [3, 6, 9, 12, 15, 18]
export const OMEN_TILES = [
  { id: 'food-cut', stage: 1, kind: 'disaster', name: '식량 공급 단절', icon: '▧', resource: 'bottleCap', cost: 2, crew: 2, types: ['분위기메이커', '4차원'], loss: { can: 4 }, peopleLoss: 0, legacyDay: 2 },
  { id: 'sandstorm', stage: 1, kind: 'disaster', name: '모래 폭풍', icon: '≈', resource: 'can', cost: 2, crew: 2, types: ['겁쟁이', '반장'], loss: { bottleCap: 3 }, peopleLoss: 0 },
  { id: 'airdrop', stage: 1, kind: 'miracle', name: '보급 낙하산', icon: '✚', gain: { can: 3 } },
  { id: 'scrap-truck', stage: 1, kind: 'miracle', name: '고물 트럭', icon: '✦', gain: { bottleCap: 3 } },
  { id: 'raiders', stage: 2, kind: 'disaster', name: '약탈자 습격', icon: '⚑', resource: 'can', cost: 3, crew: 2, types: ['용감이', '반장'], loss: { bottleCap: 4 }, peopleLoss: 1, legacyDay: 4 },
  { id: 'bridge', stage: 2, kind: 'disaster', name: '무너진 다리', icon: '╳', resource: 'bottleCap', cost: 3, crew: 2, types: ['용감이', '4차원'], loss: { can: 2 }, routeLoss: 3, peopleLoss: 0 },
  { id: 'warm-night', stage: 2, kind: 'miracle', name: '따뜻한 밤', icon: '☾', gain: {}, rest: true },
  { id: 'radio', stage: 2, kind: 'miracle', name: '선명한 무전', icon: '✧', gain: { route: 2 } },
  { id: 'flood', stage: 3, kind: 'disaster', name: '대홍수', icon: '≋', resource: 'bottleCap', cost: 4, crew: 3, allTypes: true, types: ['겁쟁이', '반장'], loss: { can: 3, bottleCap: 2 }, peopleLoss: 1, legacyDay: 6 },
  { id: 'cold', stage: 3, kind: 'disaster', name: '마지막 한파', icon: '❄', resource: 'bottleCap', cost: 5, crew: 3, allTypes: true, types: ['4차원', '겁쟁이'], loss: { can: 5 }, routeLoss: 4, peopleLoss: 2, legacyDay: 8 },
  { id: 'beacon', stage: 3, kind: 'miracle', name: '유토피아의 신호', icon: '☀', gain: { route: 3 } },
  { id: 'hope-song', stage: 3, kind: 'miracle', name: '희망의 노래', icon: '♪', gain: { can: 2, bottleCap: 2 } },
]
export const STAGE_MARKS = ['Ⅰ', 'Ⅱ', 'Ⅲ']

// Each stage puts two of its four tiles face down, in stage order along the track.
export function createOmens(shuffle, random) {
  const drawn = [1, 2, 3].flatMap(stage => shuffle(OMEN_TILES.filter(t => t.stage === stage), random).slice(0, 2))
  return OMEN_SPACES.map((at, i) => ({ at, stage: drawn[i].stage, tile: drawn[i], revealed: false, resolved: false }))
}
// Only the tile currently being resolved is face up and unresolved.
export const upcomingOmen = g => g.omens?.find(o => o.revealed && !o.resolved) ?? null
export const publicOmens = omens => omens?.map(o => o.revealed ? o : { at: o.at, stage: o.stage, revealed: false, resolved: false })
export const disasterCrewValid = (d, crew) => crew.length === d.crew && crew.every(c => c.ready) && (d.allTypes ? d.types.every(t => crew.some(c => c.type === t)) : crew.some(c => d.types.includes(c.type)))
