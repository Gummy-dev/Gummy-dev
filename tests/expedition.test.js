import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, applyCommand, actorId, botCommand, runBot, mealCost, publicGame, joinSlot, upgradeGame, requirements, explorationPrizes, canEscape, escapeCrew, escapeBonus, disasterCrewValid, eventCrewValid, canSolveEvent, eventSolveCost, eventBonus, recruitCost, dispatchLimit } from '../src/expedition/engine.js'
import { PLAIN, SURVIVOR_CARDS, LOCATIONS, VERSION, RULES, LEADERS, cardScore } from '../src/expedition/cards.js'
import { EVENT_CARDS, EVENT_SPACES, eventModifier } from '../src/expedition/events.js'
import { OMEN_TILES } from '../src/legacy/omens.js'
const DISASTERS = OMEN_TILES.filter(d => d.legacyDay).map(d => ({ ...d, day: d.legacyDay }))
const seats = [{ id: 'a', name: 'A', leaderId: 'shy' }, { id: 'b', name: 'B', leaderId: 'robot' }]
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const card = (ability, uid, slot = 0, ready = true) => ({ ...(ability === 'plain' ? PLAIN[0] : SURVIVOR_CARDS.find(c => c.ability === ability)), uid, slot, ready })
const act = (g, c, who = actorId(g), random = () => .8) => applyCommand(g, who, c, random)
test('recruitment uses only the 27 named survivors; old pools shrink without removing committed crew', () => {
  const g = createGame(seats, rng(5))
  const pool = [...g.recruitDeck, ...g.market]
  assert.equal(pool.length, 27)
  assert.equal(new Set(pool.map(c => c.id)).size, 27)
  assert.ok(pool.every(c => c.ability !== 'plain'))
  delete g.recruitRevision
  const first = g.market[0], owned = card('plain', 'owned'), away = { ...card('plain', 'away'), owner: 'b' }
  g.recruitDeck.unshift(first, card('plain', 'in-deck'))
  g.market[0] = card('plain', 'on-market')
  g.players[0].party = [owned]; g.sites[0].crew = [away]
  g.stranded = [card('plain', 'lost')]; g.players[0].fans = [card('plain', 'fan')]; g.players[0].candidates = [card('plain', 'candidate')]
  upgradeGame(g)
  assert.equal(g.market[0].uid, first.uid)
  assert.equal(g.recruitDeck.length + g.market.length, 27)
  assert.ok([...g.recruitDeck, ...g.market].every(c => c.ability !== 'plain'))
  assert.deepEqual([g.stranded, g.players[0].fans, g.players[0].candidates], [[], [], []])
  assert.deepEqual(g.players[0].party, [owned]); assert.deepEqual(g.sites[0].crew, [away])
  const snapshot = structuredClone(g); upgradeGame(g); assert.deepEqual(g, snapshot)
})
function claimRewards(g, choose = prizes => prizes[0]) {
  while (g.pending?.stage === 'reward') {
    const prize = choose(g.pending.prizes, g.pending)
    g = act(g, { type: 'claim', prize: prize.id, ...(prize.kind === 'survivor' ? { decline: true } : {}) })
  }
  return g
}
function fixture(phase = 'maintenance') { const g = createGame(seats, rng(1)); g.phase = phase; g.omens = []; g.eventSpaces = []; g.players.forEach(p => { p.resources = { can: 15, bottleCap: 15 }; p.party = [card('captain', p.seatId+'-captain', 0), card('plain', p.seatId+'-plain', 1), card('doctor', p.seatId+'-doctor', 2)] }); return g }
function disasterFixture(day) { const g=fixture();g.day=day;g.omens=[{at:3,stage:1,tile:OMEN_TILES.find(d=>d.legacyDay===day),revealed:true,resolved:false}];return g }
function openDisaster(g, prayer = false) {
  const d = g.omens[0].tile
  const results = g.players.map(p => ({seatId:p.seatId,name:p.name,lost:[],protected:p.prepared.includes(d.id)||(prayer&&p.leaderId==='duck')}))
  g.lastOmen={...d,results};g.omenResume={pending:null}
  g.pending={stage:'disaster',omenId:d.id,order:results.filter(r=>!r.protected).map(r=>r.seatId),index:0,choice:true}
  if(!g.pending.order.length){g.pending=null;g.omens[0].resolved=true;delete g.omenResume}
  return g
}
function assertState(g) {
  const all = [...g.recruitDeck, ...g.market.filter(Boolean), ...g.stranded, ...g.players.flatMap(p => [...p.party, ...p.fans, ...p.candidates]), ...g.sites.flatMap(s => s?.crew ?? [])]
  assert.equal(new Set(all.map(c => c.uid)).size, all.length, 'no duplicate physical card')
  for (const p of g.players) {
    assert.ok(Object.values(p.resources).every(n => Number.isInteger(n) && n >= 0))
    for (const c of p.party) assert.ok(Number.isInteger(c.slot) && c.slot >= 0 && c.slot < (['idol','duck'].includes(p.leaderId) ? 6 : 5))
    const owned=[...p.party,...g.sites.flatMap(s=>s?.crew.filter(c=>c.owner===p.seatId)??[])];for(const slot of new Set(owned.map(c=>c.slot))) assert.ok(owned.filter(c=>c.slot===slot).length<=2)
  }
}

test('meals cost two cans per survivor, with only ability and placement discounts including saved cards', () => {
  const g = fixture(), p = g.players[0]
  p.party = [card('guard', 'ordinary', 0, false)]
  const ordinary = p.party[0]
  ordinary.mealCost = 1 // Old rooms retain obsolete per-card values.
  assert.equal(mealCost(p, ordinary), 2)
  p.resources.can = 1
  assert.throws(() => act(g, { type: 'feed', uid: ordinary.uid }), /통조림이 부족/)
  p.resources.can = 2
  const fed = act(g, { type: 'feed', uid: ordinary.uid })
  assert.equal(fed.players[0].resources.can, 0)
  assert.equal(fed.players[0].party[0].ready, true)
  for (const ability of ['free', 'ghost']) assert.equal(mealCost(p, card(ability, ability)), 0)
  p.party.push(card('alien', 'neighbour', 1))
  assert.equal(mealCost(p, ordinary), 1)
  p.party.push(card('capybara', 'roommate', 0))
  assert.equal(mealCost(p, ordinary), 0)
  p.party = [ordinary, card('doctor', 'doctor', 1)]
  p.medical[ordinary.uid] = 1 // An already promised free meal stays free after the rule change.
  assert.equal(mealCost(p, ordinary), 0)
  p.medical = {}; g.phase = 'dispatch'
  const supported = act(g, { type: 'ability', uid: 'doctor', targetUid: ordinary.uid })
  assert.equal(mealCost(supported.players[0], supported.players[0].party[0]), 0)
})

test('card meal immediately pays the discounted cost and recovers without ending management; abilities cannot loop', () => {
  let g = fixture()
  g.players[0].party[1].ready = false
  const cost = mealCost(g.players[0], g.players[0].party[1]), before = structuredClone(g)
  assert.throws(() => act(g, { type: 'feed', uid: 'b-plain' }), /피로한 내/)
  assert.deepEqual(g, before)
  g = act(g, { type: 'feed', uid: 'a-plain' })
  assert.equal(g.players[0].resources.can, 15 - cost)
  assert.equal(g.players[0].party[1].ready, true)
  assert.equal(actorId(g), 'a'); assert.equal(g.phase, 'maintenance')
  const paid = structuredClone(g)
  assert.throws(() => act(g, { type: 'feed', uid: 'a-plain' }), /피로한 내/); assert.deepEqual(g, paid)
  assert.throws(() => act(g, { type: 'ability', uid: 'a-captain', from: 0, to: 4 }), /시점/)
  g = act(g, { type: 'endManagement', uids: [] }); assert.equal(actorId(g), 'b')
  const empty = fixture(); empty.players[0].resources.can = 0; empty.players[0].party[1].ready = false
  assert.throws(() => act(empty, { type: 'feed', uid: 'a-plain' }), /통조림이 부족/)
  assert.equal(empty.players[0].party[1].ready, false)
})

test('gain notices record real payouts and arrivals once, while trade proposals and rejected commands announce no gain', () => {
  let g = fixture('dispatch')
  g.players[0].party = []
  g = act(g, { type: 'forage' })
  assert.deepEqual(g.notices[0], { id: 1, owner: 'a', source: '안전한 탐색', items: [{ kind: 'can', amount: 1 }, { kind: 'bottleCap', amount: 1 }] })
  assert.deepEqual(g.players[0].resources, { can: 16, bottleCap: 16 })
  assert.equal(g.players[0].party.length, 0)
  assert.throws(() => act(g, { type: 'forage' }, 'a'), /하루에 한 번/)
  assert.equal(g.noticeSeq, 1)
  assert.equal(publicGame(g, 'a').noticeSeq, 1)
  g = fixture()
  g = act(g, { type: 'offerTrade', uid: 'a-plain', targetPlayer: 'b', targetUid: 'b-plain' })
  assert.equal(g.noticeSeq, undefined, 'simulated arrival during proposal validation is not a gain')
  g = act(g, { type: 'tradeReply', accept: true })
  assert.deepEqual(g.notices.map(n => n.items[0].name), [g.players[0].party.at(-1).name, g.players[1].party.at(-1).name])
  assert.deepEqual(g.notices.map(n => n.id), [1, 2])
  g = fixture(); g.market[0] = card('plain', 'new-survivor', undefined, false)
  g = act(g, { type: 'recruit', uid: 'new-survivor' })
  assert.equal(g.notices[0].source, '생존자 영입'); assert.equal(g.notices[0].items[0].kind, 'survivor')
})

test('leader safe forage is only available without any owned survivors, once per day', () => {
 for(const state of ['ready','tired','deployed']){
  const g=fixture('dispatch');g.players[0].party=g.players[0].party.map(c=>({...c,ready:state==='ready'}))
  if(state==='deployed'){g.sites[0].crew=g.players[0].party.map(c=>({...c,owner:'a'}));g.players[0].party=[]}
  const before=structuredClone(g);assert.throws(()=>act(g,{type:'forage'}),/생존자가 없을/);assert.deepEqual(g,before)
  assert.notEqual(botCommand(g).type,'forage')
 }
 let g=fixture('dispatch');g.players[0].party=[]
 assert.deepEqual(botCommand(g),{type:'forage'})
 g=act(g,{type:'forage'});assert.equal(actorId(g),'a');assert.deepEqual(g.players[0].resources,{can:16,bottleCap:16});assert.equal(g.players[0].forageDay,g.day)
 const once=structuredClone(g);assert.throws(()=>act(g,{type:'forage'}),/하루에 한 번/);assert.deepEqual(g,once);assert.deepEqual(botCommand(g),{type:'pass'})
 g.players[0].forageDay=g.day-1;assert.doesNotThrow(()=>act(g,{type:'forage'}))
 g.phase='maintenance';assert.throws(()=>act(g,{type:'forage'}),/밤 정비/)
})

test('unfinished crew can recall freely at night without a forced return decision or abandonment', () => {
 let g=fixture();const departed=g.players[0].party.splice(0,3).map(c=>({...c,owner:'a',ready:false}))
 g.sites=[{id:'ongoing',card:{...LOCATIONS[0],people:6},crew:departed}]
 g.players[0].resources.bottleCap=0
 const before=structuredClone(g);assert.throws(()=>act(g,{type:'returnOne',uid:'b-plain'}),/내 파견/);assert.deepEqual(g,before)
 g=act(g,{type:'returnOne',uid:'a-captain'})
 assert.equal(g.pending,null);assert.deepEqual(g.players[0].resources,{can:15,bottleCap:0});assert.equal(g.players[0].party[0].ready,false)
 const snapshot=structuredClone(g);assert.throws(()=>act(g,{type:'returnOne',uid:'a-captain'}),/내 파견/);assert.deepEqual(g,snapshot)
 g=act(g,{type:'endManagement',uids:[]});assert.equal(actorId(g),'b')
 assert.deepEqual(g.sites[0].crew.map(c=>c.uid),['a-plain','a-doctor']);assert.equal(g.stranded.length,0)
})

test('setup purchases first party, final meal ends setup without consuming day or resetting fatigue', () => {
  let g = createGame(seats, rng(7)); assert.equal(g.rulesVersion, VERSION); assert.equal(g.phase, 'setup'); assert.equal(g.players[0].party.length, 0)
  g.market[0] = card('plain', 'market-basic', undefined, false)
  g = act(g, { type: 'recruit', uid: 'market-basic', slot: 3 }); assert.equal(g.players[0].party[0].ready, false)
  assert.throws(() => act(g, { type: 'dispatch', uid: 'market-basic', siteId: g.sites[0].id }), /밤 정비 단계/)
  g = act(g, { type: 'endManagement', uids: ['market-basic'] }); assert.equal(actorId(g), 'b')
  assert.throws(() => act(g, { type: 'endManagement', uids: [] }, 'a'), /차례/)
  g = act(g, { type: 'endManagement', uids: [] }); assert.equal(g.phase, 'dispatch'); assert.equal(g.day, 1); assert.equal(g.players[0].party[0].ready, true)
})
test('settlement returns both parties exhausted for free, replaces location and pays night income once', () => {
 let g=fixture('dispatch');g.sites=[{id:'shared',card:{...LOCATIONS[0],people:2,roles:[],rewards:undefined,rewardCan:3,rewardCap:0},crew:[],food:0,caps:0}]
 g=act(g,{type:'dispatch',uid:'a-plain',siteId:'shared'});g=act(g,{type:'pass'});g=act(g,{type:'dispatch',uid:'b-plain',siteId:'shared'})
 assert.equal(g.pending,null);g=act(g,{type:'pass'});assert.equal(g.pending.stage,'roll')
 const before=g.players.map(p=>({...p.resources}));g=act(g,{type:'roll'});g=claimRewards(g,prizes=>prizes.find(p=>p.kind==='can')??prizes[0])
 assert.equal(g.lastResult.choices.length,1);assert.equal(g.phase,'maintenance');assert.equal(g.pending,null);assert.notEqual(g.sites[0].id,'shared')
 for(const p of g.players){const c=p.party.find(c=>c.uid===p.seatId+'-plain');assert.equal(c.ready,false);assert.equal(c.slot,1);assert.equal(c.owner,undefined);assert.equal(c.returnCost,undefined)}
 assert.equal(g.players[0].resources.can,before[0].can+3+5);assert.equal(g.players[0].resources.bottleCap,before[0].bottleCap)
 g=act(g,{type:'endManagement',uids:[]});assert.equal(actorId(g),'b');assert.equal(g.pending,null);assert.equal(g.players[1].resources.can,before[1].can+4)
 g=act(g,{type:'endManagement',uids:[]});assert.equal(g.day,2);assert.ok(g.players.every(p=>!p.party.find(c=>c.uid===p.seatId+'-plain').ready));assertState(g)
})

test('each die earns one pick, including consecutive owners; exhausted rewards skip all remaining dice', () => {
  for (const scenario of [
    { rolls: [6,4,2], owners: ['a','a','b'], winners: ['a','a'] },
    { rolls: [6,2,4], owners: ['a','b','a'], winners: ['a','b','a'], clues: 1 },
    { rolls: [4,4,4], owners: ['a','a','b'], winners: ['a','a'] },
    { rolls: [4,2,5], owners: ['a','b','a'], winners: ['a','b'], front: true },
    { rolls: [6,4,2], winners: ['a','a'], distribution: 'all' },
  ]) {
    let g=fixture('dispatch');g.sites=[{id:'dice',card:{...LOCATIONS[0],people:3,roles:[],rewards:undefined,rewardRoute:scenario.clues??0,rewardCan:3,rewardCap:2,distribution:scenario.distribution??'choice'},crew:[],food:0,caps:0}]
    if(scenario.front) g.players[0].party[0].type='용감이'
    g=act(g,{type:'dispatch',uids:['a-captain','a-plain'],siteId:'dice'});g=act(g,{type:'pass'});g=act(g,{type:'dispatch',uid:'b-plain',siteId:'dice'});g=act(g,{type:'pass'})
    let i=0;g=act(g,{type:'roll'},'a',()=>(scenario.rolls[i++]-1)/6)
    if(scenario.front) assert.deepEqual(g.pending.results.map(r=>r.sorted),[[5,2],[5]])
    g = claimRewards(g)
    assert.deepEqual(g.lastResult.choices.map(c=>c.owner),scenario.winners)
    assert.equal(g.phase,'maintenance');assert.equal(g.pending,null);assert.equal(g.sites[0].crew.length,0);assert.ok(g.players.flatMap(p=>p.party).filter(c=>['a-captain','a-plain','b-plain'].includes(c.uid)).every(c=>!c.ready))
    assert.throws(()=>act(g,{type:'claim',prize:'food'}),/밤 정비 단계/)
  }
})

test('every dice exploration loses its first survivor on a final 1, unless protected', () => {
  for (const tier of [1, 2, 3]) for (const protectedCrew of [false, true]) {
    let g = fixture('resolution')
    const first = { ...card('plain', 'first'), owner: 'a' }
    const second = { ...card(protectedCrew ? 'guard' : 'plain', 'second', 1), owner: 'a' }
    g.sites = [{ id: 'loss', card: { ...LOCATIONS.find(c => c.tier === tier), danger: false, distribution: 'all', rewardSurvivors: 0 }, crew: [first, second], food: 0, caps: 0 }]
    g.pending = { stage: 'roll', siteId: 'loss', trigger: 'a', order: [], index: 0 }
    g = act(g, { type: 'roll' }, 'a', () => 0)
    assert.deepEqual(g.lastResult.results[0].rolls, [1, 1])
    assert.deepEqual(g.lastResult.results[0].lost, protectedCrew ? [] : ['first'])
    assert.equal(g.sites[0].crew.length,0);assert.ok(g.players[0].party.some(c=>c.uid==='second'&&!c.ready));assert.equal(g.players[0].party.some(c=>c.uid==='first'),protectedCrew);if(!protectedCrew)assert.equal(g.recruitDeck.at(-1).uid,'first')
  }
})

test('first-come fills conditions immediately, chooses rewards in physical placement order and resumes dispatch', () => {
  let g = fixture('dispatch')
  g.sites = [{ id: 'first', card: { ...LOCATIONS.find(c => c.distribution === 'first'), hazard: null }, crew: [], food: 0, caps: 0 }]
  // Crew left on this unfinished location from an earlier day keeps its placement order.
  for(const p of g.players){const c=p.party.shift();g.sites[0].crew.push({...c,owner:p.seatId,ready:false})}
  g.sites[0].crew[0].type = '4차원'
  assert.equal(g.pending, null)
  g = act(g, { type: 'dispatch', uid: 'a-plain', siteId: 'first' }, 'a', () => { throw new Error('선착순은 주사위를 굴리지 않음') })
  assert.equal(g.pending.stage, 'reward'); assert.equal(g.pending.firstCome, true)
  assert.ok(g.pending.results.every(r => !r.rolls.length))
  const chosen = []
  g = claimRewards(g, prizes => { const prize = prizes.at(-1); chosen.push(prize.amount); return prize })
  assert.notEqual(g.sites[0].id,'first'); assert.equal(g.pending, null);assert.ok(g.players[0].party.some(c=>c.uid==='a-plain'&&!c.ready));assert.throws(()=>act(g,{type:'dispatch',uid:'a-plain',siteId:g.sites[0].id},'a'),/소유권/)
  assert.equal(actorId(g), 'a')
  assert.deepEqual(chosen, [2,3,6]); assert.deepEqual(g.lastResult.choices.map(c => c.owner), ['a','b','a'])
})

test('rescue chooses current public survivors one at a time, refills market and validates full-party replacement atomically', () => {
  let g = fixture('resolution')
  const location = LOCATIONS.find(c => c.rewardSurvivors === 2)
  g.sites = [{ id: 'rescue', card: { ...location, rewards:location.rewards.filter(r=>r.kind==='survivor'), roles: [] }, crew: [
    { ...g.players[0].party.shift(), owner: 'a' }, { ...g.players[0].party.shift(), owner: 'a' }, { ...g.players[1].party.shift(), owner: 'b' },
  ], food: 1, caps: 0, chaosRoll: 6 }]
  assert.deepEqual(explorationPrizes(g.sites[0]).map(p => p.amount), [1,1], 'doubling never gives more than two survivors')
  g.pending = { stage: 'roll', siteId: 'rescue', trigger: 'a', order: [], index: 0 }
  g.market[0] = card('plain','first-rescue-public',undefined,false)
  g = act(g, { type: 'roll' }, 'a', () => .9)
  const old = g.market[0], resources = structuredClone(g.players[0].resources)
  const snapshot = structuredClone(g)
  assert.throws(() => act(g, { type: 'claim', prize: 'survivor-0', uid: 'not-public' }), /공개/)
  assert.deepEqual(g, snapshot)
  g = act(g, { type: 'claim', prize: 'survivor-0', uid: old.uid })
  assert.ok(g.players[0].party.some(c => c.uid === old.uid && !c.ready))
  assert.notEqual(g.market[0]?.uid, old.uid); assert.deepEqual(g.players[0].resources, resources)
  assertState(g)
  // Five reserved slots remain occupied while their cards are away.
  g.players[0].party.push(card('plain','full-4',4))
  const candidate = { ...card('plain', 'rescue-public', undefined, false), cost: 3 }
  g.market[0] = candidate
  const full = structuredClone(g)
  assert.throws(() => act(g, { type: 'claim', prize: 'survivor-1', uid: candidate.uid }), /빈자리/)
  assert.deepEqual(g, full)
  const replace = g.players[0].party.find(c => c.uid === 'full-4')
  g = act(g, { type: 'claim', prize: 'survivor-1', uid: candidate.uid, replaceUid: replace.uid })
  assert.ok(g.players[0].party.some(c => c.uid === candidate.uid))
  assert.equal(g.recruitDeck.at(-1).uid,replace.uid);assert.equal(g.stranded.length,0);assert.notEqual(g.sites[0].id,'rescue')
  assertState(g)
})
test('saved reward choice keeps earned prizes and resumes remaining individual dice once', () => {
  const g=fixture('resolution')
  g.pending={stage:'reward',siteId:g.sites[0].id,order:['a','b'],index:1,
    results:[{owner:'a',first:0,sorted:[6,4]},{owner:'b',first:1,sorted:[2]}],
    choices:[{owner:'a',id:'food',kind:'can',amount:3}],prizes:[{id:'caps',kind:'bottleCap',amount:2,label:'폐품 매각'}]}
  const resources=structuredClone(g.players.map(p=>p.resources))
  upgradeGame(g);assert.deepEqual(g.pending.order,['a','a','b']);assert.equal(g.pending.index,1);assert.equal(actorId(g),'a')
  assert.deepEqual(g.players.map(p=>p.resources),resources)
  const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
})
test('day doctor supports an away survivor through night; feeding is separate from return and active abilities', () => {
  let g=fixture('dispatch')
  g.players[0].party.push(card('alien','alien',3,false),card('scout','cat',4,false))
  assert.equal(mealCost(g.players[0],g.players[0].party.find(c=>c.uid==='cat')),0,'exhausted camp passives still discount food')
  g.sites=[{id:'wait',card:{...LOCATIONS[0],people:6},crew:[],food:0,caps:0}]
  g=act(g,{type:'dispatch',uid:'a-plain',siteId:'wait'})
  g=act(g,{type:'ability',uid:'a-doctor',targetUid:'a-plain'})
  assert.equal(g.players[0].party.find(c=>c.uid==='a-doctor').ready,false)
  assert.throws(()=>act(g,{type:'ability',uid:'a-doctor',targetUid:'cat'}),/준비/)
  assert.throws(()=>act(g,{type:'feed',uid:'a-doctor'}),/지금은 낮/)
  g=act(g,{type:'pass'});g=act(g,{type:'pass'});assert.equal(g.phase,'maintenance')
  g=act(g,{type:'returnOne',uid:'a-plain'})
  assert.equal(g.players[0].party.find(c=>c.uid==='a-plain').ready,false)
  assert.equal(mealCost(g.players[0],g.players[0].party.find(c=>c.uid==='a-plain')),0)
  const food=g.players[0].resources.can
  g=act(g,{type:'feed',uid:'a-plain'});assert.equal(g.players[0].resources.can,food)
  g=act(g,{type:'feed',uid:'a-doctor'})
  assert.throws(()=>act(g,{type:'ability',uid:'a-doctor',targetUid:'cat'}),/시점/)
  g=act(g,{type:'endManagement',uids:[]});assert.equal(g.players[0].medical['a-plain'],undefined)
  g=act(g,{type:'endManagement',uids:[]});g=act(g,{type:'pass'})
  assert.equal(actorId(g),'a');assert.equal(g.phase,'dispatch')
  g=act(g,{type:'ability',uid:'a-doctor',targetUid:'cat'});assert.equal(g.players[0].medical.cat,2)
})
test('day active abilities exhaust their users, retain the active player and validate targets atomically', () => {
  let g=fixture('dispatch');g.players[0].party=[card('jam','jam',0),card('hunter','hunter',1),card('wizard','wizard',2)]
  const original=structuredClone(g);assert.throws(()=>act(g,{type:'ability',uid:'jam',targetPlayer:'b',targetUid:'a-captain'}),/준비/);assert.deepEqual(g,original)
  g=act(g,{type:'ability',uid:'jam',targetPlayer:'b',targetUid:'b-captain'});assert.equal(g.players[1].party[0].ready,false);assert.equal(actorId(g),'a')
  assert.throws(()=>act(g,{type:'forage',uid:'b-plain'},'b'),/차례/)
  assert.throws(()=>act(g,{type:'ability',uid:'jam',targetPlayer:'b',targetUid:'b-plain'}),/준비/)
  assert.throws(()=>act(g,{type:'dispatch',uid:'jam',siteId:g.sites[0].id}),/소유권/)
  g=act(g,{type:'ability',uid:'hunter',targetPlayer:'b'});assert.equal(g.players[0].resources.bottleCap,17);assert.equal(g.players[1].resources.bottleCap,13)
  g=act(g,{type:'ability',uid:'wizard',resource:'bottleCap'});assert.equal(g.players[0].resources.can,19);assert.equal(g.players[0].resources.bottleCap,15)
  assert.ok(g.players[0].party.every(c=>!c.ready))
})
test('mixed three-card market has no tier slots, HAL private candidates and idol reserve', () => {
  let g=fixture();g.market[0]=card('plain','basic-market',undefined,false);g.recruitDeck=[card('teacher','next-high',undefined,false),...g.recruitDeck]
  g=act(g,{type:'recruit',uid:'basic-market',slot:3});assert.equal(g.market[0].uid,'next-high');assert.equal(g.market[0].tier,3)
  g.players[0].leaderId='robot';g=act(g,{type:'search',index:1});assert.equal(g.players[0].candidates.length,2)
  assert.deepEqual(publicGame(g,'b').players[0].candidates,[null,null]);assert.ok(publicGame(g,'a').players[0].candidates[0].name)
  assert.throws(()=>act(g,{type:'search',index:1}),/한 번/)
  g=act(g,{type:'endManagement',uids:[]});g.players[1].leaderId='idol';const uid=g.market[0].uid
  g=act(g,{type:'reserve',uid});assert.equal(g.players[1].fans[0].uid,uid);assert.throws(()=>act(g,{type:'reserve',uid:g.market[0].uid}),/밤마다/)
})
test('relationships, stacking, agreed exchange and incoming fatigue retain valid ownership', () => {
  let g=fixture();g.players[0].party=[card('scout','cat',0),card('capybara','capy',2)];g.market[0]=card('dog','dog-market',undefined,false)
  assert.throws(()=>act(g,{type:'recruit',uid:'dog-market',slot:1}),/자리/)
  g=act(g,{type:'recruit',uid:'dog-market',slot:2});assert.equal(g.players[0].party.filter(c=>c.slot===2).length,2)
  assert.equal(joinSlot(g.players[0],card('ghost','g'),2),-1)
  assert.equal(joinSlot({...g.players[0],party:[card('scout','cat-only',0)]},card('dog','auto-dog')),2)
  g=act(g,{type:'offerTrade',uid:'cat',targetPlayer:'b',targetUid:'b-plain'});assert.equal(actorId(g),'b');assert.equal(g.players[0].party[0].uid,'cat')
  g=act(g,{type:'tradeReply',accept:true});assert.equal(actorId(g),'a');assert.equal(g.players[0].party.find(c=>c.uid==='b-plain').ready,false)
  assert.ok(g.players[1].party.some(c=>c.uid==='cat'));assert.throws(()=>act(g,{type:'offerTrade',uid:'b-plain',targetPlayer:'b',targetUid:'cat'}),/한 번/)
})
test('unfinished dispatch returns exhausted at night and legacy supplies remain', () => {
  let g=fixture('dispatch');g.sites=[{id:'stuck',card:{...LOCATIONS[7],people:4,hazard:null},crew:[],food:1,caps:1}]
  g=act(g,{type:'dispatch',uid:'a-plain',siteId:'stuck'});g=act(g,{type:'pass'});g=act(g,{type:'pass'});assert.equal(g.phase,'maintenance');assert.equal(g.pending,null);g=act(g,{type:'returnOne',uid:'a-plain'})
  assert.equal(g.phase,'maintenance');assert.equal(g.sites[0].crew.length,0);assert.equal(g.sites[0].food,1);assert.equal(g.players[0].party.find(c=>c.uid==='a-plain').ready,false)
  assert.throws(()=>act(g,{type:'ability',uid:'a-captain',from:0,to:2}),/시점/)
  g=act(g,{type:'endManagement',uids:[]});assert.throws(()=>act(g,{type:'endManagement',uids:[]},'a'),/차례/)
  g=act(g,{type:'endManagement',uids:[]});assert.notEqual(g.sites[0]?.id,'stuck','obsolete paid supplies do not block replacement of an empty location')
})
test('disaster preparation, casualties, duck prayer and final exploration remain playable', () => {
  let g=disasterFixture(4);g.players[0].prepared=['raiders'];g=openDisaster(g);assert.equal(g.pending.stage,'disaster')
  const before=g.players[1].party.length;g=act(g,{type:'disasterLoss',uids:['b-plain']});assert.equal(g.day,4);assert.equal(g.players[1].party.length,before-1)
  g=disasterFixture(2);g.players[0].prepared=['food-cut'];g.players[1].leaderId='duck';g=openDisaster(g,true);assert.equal(g.pending,null);assert.equal(g.lastOmen.results[1].protected,true)
  g=fixture('dispatch');g.players[0].route=RULES.route;g.players[0].party[2].type='분위기메이커';g=act(g,{type:'escape',uids:g.players[0].party.map(c=>c.uid)},'a',()=>.99);assert.equal(g.players[0].escaped,true);assert.equal(g.gameEnded,false);assert.equal(g.players[0].utopiaPoints,RULES.utopiaFirst)
})
test('recruiter, vet and shelter abilities connect recruitment and risk to crew use',()=>{
  let g=disasterFixture(2);g.phase='dispatch';g.players[0].party=[card('recruiter','recruiter',0),card('vet','vet',1),card('shelter','shelter',2)];g.market[0]=card('plain','new',undefined,false);g.market[1]=card('plain','lost',undefined,false)
  g=act(g,{type:'ability',uid:'recruiter',targetUid:'new',slot:3});assert.equal(g.players[0].resources.bottleCap,15);assert.ok(g.players[0].party.some(c=>c.uid==='new'&&!c.ready))
  g=act(g,{type:'ability',uid:'vet',targetUid:'lost',slot:4});assert.equal(g.players[0].resources.bottleCap,14);assert.ok(g.players[0].party.some(c=>c.uid==='lost'&&!c.ready))
  assert.throws(()=>act(g,{type:'ability',uid:'shelter'}),/공개된 재난/);g=openDisaster(g);g=act(g,{type:'shelter',uid:'shelter'});assert.deepEqual(g.players[0].prepared,['food-cut']);assert.equal(g.players[0].party.find(c=>c.uid==='shelter').ready,false)
})
test('all five leaders and 2–4 player tables finish with valid resources and unique cards',()=>{
  const leaders=['shy','robot','idol','zombie','duck']
  for(let seed=1;seed<=60;seed++){
    const random=rng(seed),players=Array.from({length:2+seed%3},(_,i)=>({id:'p'+i,name:'P'+i,leaderId:leaders[(seed+i)%5]}));let g=createGame(players,random),steps=0
    while(!g.gameEnded&&steps++<3000){g=runBot(g,random);assertState(g)}
    assert.ok(g.gameEnded,'seed '+seed+' must finish');assert.ok(g.players.some(p=>p.escaped))
  }
})

test('front-row exploration bonus also changes the final expedition total',()=>{
 let g=fixture('dispatch');g.players[0].route=RULES.route+4;g.players[0].party=[{...card('plain','one',0),type:'용감이'},{...card('plain','two',1),type:'반장'},card('plain','three',3)];
 g=act(g,{type:'escape',uids:['one','two','three']},'a',()=>.4);assert.deepEqual(g.lastUtopia.rolls,[3,3,3]);assert.equal(g.lastUtopia.total,10);assert.equal(g.lastUtopia.success,false);
})

test('unfinished recall costs no caps; feeding still costs two cans and readies the survivor',()=>{
 let g=fixture('dispatch');g.players[0].leaderId='robot';g.sites=[{id:'wait',card:{...LOCATIONS[0],people:4},crew:[],food:0,caps:0}];g.players[0].resources={can:0,bottleCap:0}
 g=act(g,{type:'dispatch',uids:['a-captain','a-plain'],siteId:'wait'});g=act(g,{type:'pass'});g=act(g,{type:'pass'});assert.equal(g.pending,null);assert.deepEqual(g.players[0].resources,{can:4,bottleCap:1})
 g.players[0].resources.bottleCap=0;g=act(g,{type:'returnOne',uid:'a-captain'});assert.deepEqual(g.players[0].resources,{can:4,bottleCap:0});assert.equal(g.players[0].party.find(c=>c.uid==='a-captain').ready,false);assert.equal(g.sites[0].crew[0].uid,'a-plain')
 g=act(g,{type:'feed',uid:'a-captain'});assert.equal(g.players[0].resources.can,2);assert.equal(g.players[0].party.find(c=>c.uid==='a-captain').ready,true)
 g=act(g,{type:'endManagement',uids:[]});assert.equal(g.players[0].resources.can,2)
})

test('disaster asks for an immediate choice; supplies or ready crew prevent penalty, invalid commands do not charge',()=>{
 let g=disasterFixture(2);const aFood=g.players[0].resources.can,aCaps=g.players[0].resources.bottleCap;
 assert.throws(()=>act(g,{type:'prepare'}),/팝업/);
 g=openDisaster(g);assert.equal(g.pending.choice,true);assert.equal(g.players[0].resources.can,aFood,'no damage before a choice');
 const before=structuredClone(g);assert.throws(()=>act(g,{type:'prepare',uids:['a-captain','a-captain']}),/소유권/);assert.deepEqual(g,before);
 g=act(g,{type:'prepare'});assert.equal(g.players[0].resources.bottleCap,aCaps-2);assert.equal(g.players[0].resources.can,aFood);assert.equal(g.lastOmen.results[0].protected,true);
 g.players[1].party[0].type='4차원';g=act(g,{type:'prepare',uids:['b-captain','b-plain']});assert.equal(g.day,2);assert.equal(g.players[1].party.filter(c=>!c.ready).length,2);
 g=disasterFixture(2);g.players[0].party=[];g.players[1].prepared=['food-cut'];g=openDisaster(g);assert.equal(g.pending.stage,'disaster');
 g=act(g,{type:'disasterLoss',uids:[]});assert.equal(g.players[0].resources.can,11);assert.equal(g.day,2);
})
test('saved in-flight returns migrate once and legacy disaster losses are never charged twice',()=>{
 let g=fixture('resolution');g.rulesRevision=1;delete g.automaticReturnRevision;const away=g.players[0].party.pop();g.sites=[{id:'old',card:LOCATIONS[0],crew:[{...away,owner:'a'}],food:0,caps:0}];g.pending={stage:'return',siteId:'old',order:['a'],index:0,results:[{owner:'a',rolls:[4],lost:[],notes:[]}],choices:[]};
 upgradeGame(g);assert.equal(g.phase,'maintenance');assert.equal(g.pending,null);const food=g.players[0].resources.can;upgradeGame(g);assert.equal(g.players[0].resources.can,food);assert.equal(g.players[0].party.find(c=>c.uid===away.uid).ready,false);
 g=fixture();g.day=4;g.rulesRevision=1;delete g.omenRevision;g.players[0].resources.can=1;g.disastersResolved=[4];g.lastDisaster={results:[{seatId:'a',lost:[]}]};g.pending={stage:'disaster',disasterDay:4,order:['a'],index:0};g=act(g,{type:'disasterLoss',uids:['a-plain']});assert.equal(g.players[0].resources.can,1);
})

test('departure ranges from a solo errand to a six-person mixed-party expedition', () => {
  const small={card:LOCATIONS.find(c=>c.name==='버려진 편의점'),crew:[card('plain','solo')],food:0,caps:0}
  assert.equal(requirements(small).ready,true)
  const large={card:LOCATIONS.find(c=>c.name==='무너진 물류센터'),crew:[{...card('plain','brave'),type:'용감이'},card('captain','boss')],food:1,caps:0}
  assert.equal(requirements(large).people,4);assert.equal(requirements(large).ready,false)
  large.crew.push(...Array.from({length:4},(_,i)=>({...card('plain','other'+i),owner:i<2?'a':'b'})))
  assert.equal(requirements(large).ready,true);large.food=0;assert.equal(requirements(large).ready,true,'departure has no resource cost')
})

test('unfinished expeditions retain crew across days without departure costs, then accept reinforcements', () => {
  let g=fixture('dispatch');const site={id:'ongoing',card:{...LOCATIONS[0],people:3,food:1},crew:[],food:0,caps:0};g.sites=[site]
  g=act(g,{type:'dispatch',uid:'a-plain',siteId:site.id});g=act(g,{type:'pass'});g=act(g,{type:'pass'})
  assert.equal(g.pending,null)
  assert.equal(g.sites[0].crew.length,1);assert.equal(g.stranded.length,0)
  assert.throws(()=>act(g,{type:'reorder',from:0,to:1}),/파견 중/)
  g=act(g,{type:'endManagement',uids:[]});g=act(g,{type:'endManagement',uids:[]})
  assert.equal(g.day,2);assert.equal(g.sites[0].id,site.id);assert.equal(g.sites[0].food,0);assert.equal(g.sites[0].crew[0].uid,'a-plain')
  g=act(g,{type:'dispatch',uids:['b-captain','b-plain'],siteId:site.id});g=act(g,{type:'pass'});g=act(g,{type:'pass'})
  assert.equal(g.pending.stage,'roll');g=act(g,{type:'roll'});g=claimRewards(g)
  assert.notEqual(g.sites[0].id,site.id);assert.equal(g.stranded.length,0);assert.ok(g.players[0].party.some(c=>c.uid==='a-plain'&&!c.ready));assert.ok(g.players[1].party.some(c=>c.uid==='b-plain'&&!c.ready))
})

test('printed taboos cause immediate failure; optional counter interrupts the other player and resumes once', () => {
  for(const counter of [null,false,true]) {
    let g=fixture('dispatch');g.sites=[{id:'taboo',card:LOCATIONS.find(c=>c.name==='방치된 군수창고'),crew:[],food:0,caps:0}]
    if(counter!==null)g.players[0].party[0]=card('counter','hero',0)
    g.players[1].party[0].type='4차원'
    g=act(g,{type:'dispatch',uids:counter===null?['a-plain']:['hero','a-plain'],siteId:'taboo'});g=act(g,{type:'pass'})
    g=act(g,{type:'dispatch',uid:'b-captain',siteId:'taboo'})
    if(counter!==null){
      assert.equal(g.pending.stage,'counter');assert.equal(actorId(g),'a');assert.equal(g.currentPlayerIndex,1)
      const before=structuredClone(g);assert.throws(()=>act(g,{type:'counter',use:true,uid:'b-captain'}),/반격/);assert.deepEqual(g,before)
      assert.throws(()=>act(g,{type:'counter',use:false},'b'),/차례/)
      g=act(g,{type:'counter',use:counter,uid:'hero'})
      assert.equal(g.pending,null);assert.equal(actorId(g),'b');assert.equal(g.turnInDay,3)
    }
    assert.equal(Boolean(g.lastResult?.failed),counter!==true)
    if(counter===true){assert.ok(g.recruitDeck.some(c=>c.uid==='hero'));assert.equal(g.sites[0].crew.length,2)}
    else {assert.throws(()=>act(g,{type:'dispatch',uid:'a-doctor',siteId:'taboo'}),/없는 탐색/);assert.equal(g.lastResult.choices.length,0)}
  }
})

test('wildcard fills just one missing type while its printed type still removes the final reward bundle', () => {
  const site={card:{...LOCATIONS[0],people:2,roles:['반장','용감이'],rewards:undefined,rewardRoute:2,rewardCan:3,rewardCap:4,hazard:{type:'4차원',effect:'lastReward'}},crew:[card('wildcard','fairy'),card('captain','boss')],food:0,caps:0}
  assert.equal(requirements(site).ready,true);assert.equal(new Set(requirements(site).matched).size,2)
  assert.deepEqual(explorationPrizes(site).map(p=>p.id),['route','food'])
  site.crew.push(card('wildcard','fairy2'));assert.equal(explorationPrizes(site).length,2,'same taboo never removes twice')
  site.crew=[card('wildcard','alone')];assert.equal(requirements(site).missing.length,1)
})

test('deployed chaos doubles quantities once or fails; sabotage strands its owner card', () => {
  for(const roll of [1,3,4,6]) {
    let g=fixture('dispatch');const gambler=card('chaos','gambler',3)
    g.sites=[{id:'gamble',card:LOCATIONS[0],crew:[{...gambler,owner:'a',ready:false}],food:0,caps:0}]
    g=act(g,{type:'ability',uid:'gambler'},'a',()=>(roll-1)/6)
    if(roll<=3){assert.ok(g.lastResult.failed);assert.equal(g.lastResult.choices.length,0);assert.ok(g.players[0].party.some(c=>c.uid==='gambler'&&!c.ready))}
    else {
      assert.equal(g.sites[0].chaosRoll,roll);assert.throws(()=>act(g,{type:'ability',uid:'gambler'}),/한 번/)
      g=act(g,{type:'pass'});g=act(g,{type:'pass'});const before=g.players[0].resources.can;g=act(g,{type:'roll'});g=claimRewards(g, prizes => prizes.find(p=>p.kind==='can') ?? prizes[0]);assert.equal(g.lastResult.choices[0].amount,8);assert.equal(g.players[0].resources.can,before+8+5)
    }
  }
  let g=fixture('dispatch');g.sites=[{id:'ruin',card:{...LOCATIONS[0],people:6},crew:[{...card('sabotage','saboteur'),owner:'a'},{...card('plain','victim'),owner:'b'}],food:0,caps:0}]
  g=act(g,{type:'ability',uid:'saboteur'});assert.ok(g.lastResult.failed);assert.ok(g.players[1].party.some(c=>c.uid==='victim'&&!c.ready));assert.equal(g.recruitDeck.at(-1).uid,'saboteur');assert.equal(g.recruitDeck.at(-1).owner,undefined);assert.equal(g.recruitDeck.at(-1).slot,undefined);assert.equal(g.stranded.length,0)
})

test('active abilities work during own dispatch turn, exhaust the user and respect occupied expedition slots', () => {
  let g=fixture('dispatch');g.players[0].party[1]=card('jam','jam',1)
  g=act(g,{type:'ability',uid:'jam',targetPlayer:'b',targetUid:'b-plain'});assert.equal(actorId(g),'a');assert.equal(g.players[0].party[1].ready,false);assert.equal(g.players[1].party[1].ready,false)
  assert.throws(()=>act(g,{type:'ability',uid:'b-plain'},'b'),/차례/)
  assert.throws(()=>act(g,{type:'ability',uid:'jam'}),/준비/)
  assert.throws(()=>act(g,{type:'feed',uid:'jam'}),/지금은 낮/)
  const away=g.players[0].party.pop();g.sites[0].crew=[{...away,owner:'a'}]
  assert.throws(()=>act(g,{type:'ability',uid:'a-captain',from:0,to:2}),/파견 중/)
})

test('balance refresh changes untouched locations only and keeps ongoing investments and printed abilities coherent', () => {
  const g=fixture('dispatch');delete g.locationRevision;delete g.abilityRevision
  g.deck=[{...LOCATIONS[0],people:99}]
  g.sites=Array.from({length:4},(_,i)=>({id:'old'+i,card:{...LOCATIONS[0],people:99},crew:[],food:0,caps:0}))
  g.sites[1].crew=[{...g.players[0].party.pop(),owner:'a'}];g.sites[2].food=1;g.sites[3].resolved=true
  g.players[0].party[0].timing='관리'
  const resources=structuredClone(g.players.map(p=>p.resources));upgradeGame(g)
  assert.equal(g.deck[0].people,1);assert.deepEqual(g.sites.map(s=>s.card.people),[1,99,99,99]);assert.equal(g.players[0].party[0].timing,'낮 · 거점');assert.deepEqual(g.players.map(p=>p.resources),resources)
  const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
})


test('utopia challenge is a day action with three types and one attempt per day', () => {
 let g=fixture();g.day=8;const p=g.players[0];p.route=RULES.route;p.party[2].type='분위기메이커';
 assert.equal(canEscape(g,p),false,'no challenge at night');
 g=fixture('dispatch');g.day=8;g.players[0].route=RULES.route;g.players[0].party[2].type='분위기메이커';
 assert.equal(canEscape(g,g.players[0]),true);assert.equal(escapeCrew(g.players[0]).length,3);
 g.players[0].passed=true;assert.equal(canEscape(g,g.players[0]),false,'a passed player cannot attempt');g.players[0].passed=false;
 g.gameEnded=true;assert.equal(canEscape(g,g.players[0]),false,'the final standings cannot reopen');g.gameEnded=false;
 const before=structuredClone(g);g.players[0].party[2].type='반장';assert.throws(()=>act(g,{type:'escape',uids:g.players[0].party.map(c=>c.uid)}),/타입/);g=before;
 g=act(g,{type:'escape',uids:escapeCrew(g.players[0]).map(c=>c.uid)},'a',()=>0);assert.equal(g.lastUtopia.success,false);assert.equal(g.players[0].route,RULES.route);assert.equal(g.players[0].resources.can,12);
 g.currentPlayerIndex=0;g.players[0].party.forEach(c=>c.ready=true);assert.throws(()=>act(g,{type:'escape',uids:escapeCrew(g.players[0]).map(c=>c.uid)},'a'),/하루 한 번/);
 g=fixture('dispatch');g.day=8;g.players[0].route=99;g.players[0].party=[card('captain','a',0),card('wildcard','b',1),card('plain','c',3)];assert.equal(escapeBonus(g.players[0]),0);
 g=act(g,{type:'escape',uids:['a','b','c']},'a',()=>.99);assert.equal(g.players[0].escaped,true);assert.equal(g.gameEnded,false);assert.equal(g.lastUtopia.total,18);assert.equal(g.finalDay,9);
})

test('first utopia entry starts a final round; the next day ends the game and the highest score wins', () => {
 let g=fixture('dispatch');g.day=3;g.sites=[];const [a,b]=g.players
 a.route=RULES.route;a.party[2].type='분위기메이커';a.resources={can:13,bottleCap:4}
 g=act(g,{type:'escape',uids:g.players[0].party.map(c=>c.uid)},'a',()=>.99)
 assert.equal(g.lastUtopia.points,RULES.utopiaFirst);assert.equal(g.finalDay,4);assert.equal(actorId(g),'b')
 const income=g.players[0].resources.can
 g=act(g,{type:'pass'},'b');assert.equal(g.phase,'maintenance');assert.equal(g.gameEnded,false)
 while(g.phase==='maintenance') g=act(g,{type:'endManagement',uids:[]})
 assert.equal(g.day,4);assert.equal(g.phase,'dispatch');assert.equal(g.players[0].resources.can,income,'entered party takes no night income')
 g.players[1].route=RULES.route;g.players[1].party[2].type='분위기메이커';g.players[1].party.forEach(c=>c.ready=true);g.currentPlayerIndex=1
 g=act(g,{type:'escape',uids:g.players[1].party.map(c=>c.uid)},'b',()=>.99)
 assert.equal(g.players[1].utopiaPoints,RULES.utopiaLater);assert.equal(g.gameEnded,true,'everyone entered on the final day')
 for (const s of g.standings) {
   const p=g.players.find(x=>x.seatId===s.seatId), party=p.party.reduce((n,c)=>n+cardScore(c),0)
   assert.deepEqual([s.utopia,s.party,s.supplies,s.total],[p.utopiaPoints,party,(Math.floor(p.resources.can/RULES.suppliesPerPoint)+Math.floor(p.resources.bottleCap/RULES.suppliesPerPoint)),p.utopiaPoints+party+(Math.floor(p.resources.can/RULES.suppliesPerPoint)+Math.floor(p.resources.bottleCap/RULES.suppliesPerPoint))])
 }
 assert.ok(g.standings[0].total>=g.standings[1].total)
 assert.throws(()=>act(g,{type:'search',index:0}),/종료된/)
})
test('scout lets high dice choose among unequal clue bundles and records one discovery per party',()=>{
 let g=fixture('dispatch');const c=LOCATIONS.find(c=>c.name==='끊어진 고가도로');assert.deepEqual(explorationPrizes({card:c,crew:[]}).map(p=>p.amount),[3,1,1]);
 const crew=[{...card('plain','x',2),owner:'a',type:'분위기메이커'},{...card('plain','y',3),owner:'a',type:'4차원'},{...card('plain','z',4),owner:'a',type:'겁쟁이'}];g.sites=[{id:c.id,card:c,crew,food:0,caps:0}];
 g=act(g,{type:'pass'});g=act(g,{type:'pass'});g=act(g,{type:'roll'});g=claimRewards(g, prizes => prizes.find(p=>p.kind==='route') ?? prizes[0]);assert.equal(g.players[0].route,4);assert.equal(g.players[0].discoveries.length,1);
 assert.deepEqual(g.lastResult.choices.map(r=>[r.kind,r.amount]),[['route',3],['route',1],['can',1]]);
})
test('late disasters demand three ready crew and both printed types; early disaster removes no people',()=>{
 for(const day of [6,8]){const d=DISASTERS.find(x=>x.day===day),crew=d.types.map((t,i)=>({...card('plain','x'+i,i),type:t}));assert.equal(disasterCrewValid(d,crew),false);crew.push({...card('plain','z',2),type:'분위기메이커'});assert.equal(disasterCrewValid(d,crew),true);crew[1].type=crew[0].type;assert.equal(disasterCrewValid(d,crew),false)}
 let g=disasterFixture(2);g.players[1].prepared=['food-cut'];g=openDisaster(g);g=act(g,{type:'disasterLoss',uids:[]});assert.equal(g.players[0].party.length,3);assert.equal(g.players[0].resources.can,11);
})
test('guide rescues a misplaced expedition card; a ready camp counter can cancel the destination taboo',()=>{
 let g=fixture('dispatch');g.players[0].party=[card('guide','guide',0),card('counter','hero',1)];const scout={...card('plain','scout',2),type:'겁쟁이',owner:'a',ready:false};
 g.sites=[{id:'from',card:{...LOCATIONS[0],people:5},crew:[scout],food:1,caps:0},{id:'to',card:LOCATIONS.find(c=>c.name==='침수된 연구소'),crew:[],food:0,caps:0}];
 const before=structuredClone(g);assert.throws(()=>act(g,{type:'ability',uid:'guide',targetUid:'scout',siteId:'from'}),/미완성/);assert.deepEqual(g,before);
 g=act(g,{type:'ability',uid:'guide',targetUid:'scout',siteId:'to'});assert.equal(g.sites[0].crew.length,0);assert.equal(g.sites[0].food,1);assert.equal(g.pending.stage,'counter');assert.equal(g.players[0].party[0].ready,false);
 g=act(g,{type:'counter',use:true,uid:'hero'});assert.equal(g.sites[1].resolved,undefined);assert.equal(g.sites[1].hazardCancelled,true);assert.ok(g.recruitDeck.some(c=>c.uid==='hero'));assert.equal(actorId(g),'a');
})

test('last disaster threatens clue standing, and preparedness preserves the route',()=>{
 let g=disasterFixture(8);g.players[0].route=21;g.players[1].route=20;g.players[1].prepared=['cold'];g=openDisaster(g);g=act(g,{type:'disasterLoss',uids:['a-captain','a-plain']});assert.equal(g.gameEnded,false);assert.equal(g.players[0].route,17);assert.equal(g.players[1].route,20);
})

test('old return costs and stranded piles migrate once without charging resources or duplicating cards',()=>{
 const g=fixture();delete g.automaticReturnRevision;g.pending={stage:'return',actor:'a'}
 const done=g.players[0].party.shift(),away=g.players[0].party.pop();done.returnCost=3;away.returnCost=2
 g.stranded=[{...card('vet','old-lost',4,false),owner:'b',availableDay:2,returnCost:1}]
 g.sites=[{id:'done',card:LOCATIONS[0],resolved:true,crew:[{...done,owner:'a'}]},{id:'ongoing',card:LOCATIONS[1],crew:[{...away,owner:'a'}]}]
 const resources=structuredClone(g.players.map(p=>p.resources));upgradeGame(g)
 assert.equal(g.pending,null);assert.equal(g.stranded.length,0);assert.equal(g.recruitDeck.at(-1).uid,'old-lost');assert.equal(g.recruitDeck.at(-1).slot,undefined)
 assert.ok(g.players[0].party.some(c=>c.uid===done.uid&&!c.ready&&c.returnCost===undefined));assert.equal(g.sites[1].crew[0].uid,away.uid);assert.equal(g.sites[1].crew[0].returnCost,undefined)
 assert.deepEqual(g.players.map(p=>p.resources),resources);assertState(g);const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
})

test('sharing keeps mixed rewards, while scout and rescue have clear main rewards',()=>{
 for(const c of LOCATIONS){
   assert.equal(c.food,0);assert.equal(c.caps,0)
   if(['supply','large'].includes(c.explorationType)&&!c.interaction)assert.ok(new Set(c.rewards.map(r=>r.kind)).size>=2,'ordinary expeditions must retain resource variety')
   assert.equal(new Set(c.rewards.map(r=>r.id)).size,c.rewards.length)
   if(c.explorationType==='scout'){assert.equal(c.rewards[0].kind,'route');assert.ok(c.rewards.filter(r=>r.kind!=='route').length<=1);assert.ok(c.rewards.filter(r=>r.kind!=='route').every(r=>r.amount===1))}
   if(c.explorationType==='rescue' && !c.interaction){assert.equal(c.rewards[0].kind,'survivor');assert.ok(c.rewardSurvivors>=1&&c.rewardSurvivors<=2);assert.ok(c.rewards.filter(r=>r.kind!=='survivor').every(r=>r.amount===1&&['can','bottleCap'].includes(r.kind)))}
 }
 for(const count of [2,3,4]){const g=createGame(Array.from({length:count},(_,i)=>({id:String(i),name:String(i)})),rng(count));assert.deepEqual([...g.sites.map(s=>s.card),...g.deck].filter(c=>c.interaction).map(c=>c.interaction).sort(),['barter','survivorTrade'])}
})
test('departure rejects resource payment without charging and accepts a crew with zero resources',()=>{
 let g=fixture('dispatch');g.players[0].resources={can:0,bottleCap:0};const s=g.sites[0]
 const before=structuredClone(g);assert.throws(()=>act(g,{type:'dispatch',uid:'a-plain',siteId:s.id,food:1}),/지불하지/);assert.deepEqual(g,before)
 g=act(g,{type:'dispatch',uid:'a-plain',siteId:s.id});assert.deepEqual(g.players[0].resources,{can:0,bottleCap:0})
})
test('resource barter requires a deployed envoy and consent, resumes the proposer and rewards both parties once',()=>{
 let g=fixture('dispatch');g.sites=[{id:'barter',card:LOCATIONS.find(c=>c.interaction==='barter'),crew:[],food:0,caps:0}]
 assert.throws(()=>act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'can'}),/파견/)
 g=act(g,{type:'dispatch',uids:['a-captain','a-doctor'],siteId:'barter'})
 assert.throws(()=>act(g,{type:'dispatch',uid:'a-plain',siteId:'barter'}),/최대 2명/)
 const before=structuredClone(g.players.map(p=>p.resources));g=act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'can'});assert.equal(actorId(g),'b');assert.equal(g.turnInDay,2)
 assert.throws(()=>act(g,{type:'tradeReply',accept:true},'a'),/차례/)
 g=act(g,{type:'tradeReply',accept:false});assert.equal(actorId(g),'a');assert.deepEqual(g.players.map(p=>p.resources),before);assert.equal(g.sites[0].resolved,undefined)
 assert.throws(()=>act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'can'}),/하루 한 번/)
 g.sites[0].offered={};g=act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'can'});g=act(g,{type:'tradeReply',accept:true})
 assert.equal(actorId(g),'a');assert.deepEqual(g.players.map(p=>p.resources),[{can:13,bottleCap:18},{can:17,bottleCap:14}]);assert.notEqual(g.sites[0].id,'barter');assert.ok(g.players[0].party.some(c=>c.uid==='a-captain'&&!c.ready));assert.equal(g.lastResult.choices.length,2)
 assert.throws(()=>act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'can'}),/없는 탐색/);assertState(g)
})
test('survivor exchange site swaps only consented camp cards, preserves reservations and stops resolving as dice',()=>{
 let g=fixture('dispatch');g.players[0].party.push({...card('plain','envoy',3),type:'분위기메이커'})
 g.sites=[{id:'swap',card:LOCATIONS.find(c=>c.interaction==='survivorTrade'),crew:[],food:0,caps:0}]
 g=act(g,{type:'dispatch',uids:['envoy','a-captain'],siteId:'swap'})
 g=act(g,{type:'offerTrade',siteId:'swap',targetPlayer:'b',uid:'a-plain',targetUid:'b-doctor'});g=act(g,{type:'tradeReply',accept:true})
 assert.ok(g.players[0].party.some(c=>c.uid==='b-doctor'&&!c.ready));assert.ok(g.players[1].party.some(c=>c.uid==='a-plain'&&!c.ready));assert.ok(g.players[0].party.some(c=>c.uid==='envoy'&&!c.ready));assert.notEqual(g.sites[0].id,'swap');assertState(g)
 assert.equal(actorId(g),'a');g=act(g,{type:'pass'});g=act(g,{type:'pass'});assert.equal(g.phase,'maintenance');assert.equal(g.pending,null)
 let h=fixture('dispatch');h.sites=[{id:'unaccepted',card:LOCATIONS.find(c=>c.interaction==='barter'),crew:[{...card('captain','envoy',3),owner:'a'}],food:0,caps:0}];h=act(h,{type:'pass'});h=act(h,{type:'pass'});assert.equal(h.pending,null);assert.equal(h.sites[0].resolved,undefined)
})
test('rescue rewards can be chosen in either order; legacy upgrade preserves a remaining choice',()=>{
 let g=fixture('resolution');g.sites=[{id:'ordered',card:LOCATIONS.find(c=>c.rewardSurvivors===2),crew:[{...card('plain','one',3),owner:'a'},{...card('plain','two',4),owner:'a'}],food:0,caps:0}];g.pending={stage:'roll',siteId:'ordered',trigger:'a',order:[],index:0};g=act(g,{type:'roll'});
 g=act(g,{type:'claim',prize:'survivor-1',decline:true});assert.equal(g.pending.prizes[0].id,'survivor-0')
 g=fixture('resolution');delete g.payoutRevision;g.sites[0].crew=[{...g.players[0].party.pop(),owner:'a'}];g.pending={stage:'reward',siteId:g.sites[0].id,picks:[{owner:'a',value:6},{owner:'a',value:4}],order:['a','a'],index:1,results:[{owner:'a',rolls:[6,4],notes:[],lost:[]}],choices:[{owner:'a',id:'already',kind:'can',amount:3}],prizes:[{id:'remaining',kind:'bottleCap',amount:2,label:'병뚜껑'}]};
 const caps=g.players[0].resources.bottleCap;upgradeGame(g);assert.equal(g.players[0].resources.bottleCap,caps);assert.equal(g.pending.stage,'reward');assert.equal(g.pending.prizes[0].id,'remaining');assert.equal(g.payoutRevision,3);const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
})

test('barter proposal validates both balances atomically and doubled exploration bonuses apply to both traders',()=>{
 let g=fixture('dispatch');g.sites=[{id:'barter',card:LOCATIONS.find(c=>c.interaction==='barter'),crew:[{...card('captain','envoy',3),owner:'a'},{...card('plain','envoy2',4),owner:'a'}],food:0,caps:0,chaosRoll:6}]
 g.players[1].resources.bottleCap=1;const before=structuredClone(g);assert.throws(()=>act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'can'}),/재화 2/);assert.deepEqual(g,before)
 assert.throws(()=>act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'route'}),/재화/);assert.deepEqual(g,before)
 g.players[1].resources.bottleCap=15;g=act(g,{type:'offerTrade',siteId:'barter',targetPlayer:'b',resource:'can'});g=act(g,{type:'tradeReply',accept:true});assert.deepEqual(g.players.map(p=>p.resources),[{can:13,bottleCap:19},{can:17,bottleCap:15}]);assert.ok(g.lastResult.choices.every(r=>r.amount===2))
})
test('existing rooms refresh unstarted mixed rewards without replaying a pending rescue',()=>{
 const g=fixture('resolution');g.payoutRevision=1;const c=LOCATIONS[0];g.sites=[{id:'fresh',card:{...c,rewards:[{id:'old',kind:'can',amount:7}]},crew:[],food:0,caps:0},{id:'rescue',card:LOCATIONS.find(c=>c.rewardSurvivors===2),crew:[{...card('plain','envoy',3),owner:'a'}],food:0,caps:0}];g.pending={stage:'reward',siteId:'rescue',picks:[{owner:'a',value:6}],order:['a'],index:0,prizes:[{id:'survivor-0',kind:'survivor',amount:1}],results:[],choices:[]};const q=structuredClone(g.pending);upgradeGame(g);assert.deepEqual(g.sites[0].card.rewards,c.rewards);assert.deepEqual(g.pending,q);assert.equal(g.payoutRevision,3)
})


function journeyReward(ids, amount = 7) {
  const g = fixture('resolution')
  g.omens = ids.map((id,i)=>({at:3*(i+1),stage:OMEN_TILES.find(t=>t.id===id).stage,tile:OMEN_TILES.find(t=>t.id===id),revealed:false,resolved:false}))
  const away = g.players[0].party.pop()
  g.sites = [{id:'journey-test',card:{...LOCATIONS[0],distribution:'choice'},crew:[{...away,owner:'a',ready:false}],food:0,caps:0}]
  g.pending={stage:'reward',siteId:'journey-test',order:['a','b'],picks:[{owner:'a',value:6},{owner:'b',value:4}],index:0,prizes:[{id:'route',kind:'route',amount,label:'여정'},{id:'can',kind:'can',amount:2,label:'통조림'}],results:[{owner:'a',rolls:[6,4],sorted:[6,4],lost:[],notes:[]}],choices:[]}
  return g
}
test('crossed hidden omens interrupt rewards immediately, apply to everyone once, and resume the next chooser',()=>{
 let g=journeyReward(['airdrop','food-cut','beacon'])
 assert.ok(publicGame(g,'a').omens.every(o=>!o.tile));const before=structuredClone(g)
 g=act(g,{type:'claim',prize:'route'})
 assert.equal(before.players[0].route,0);assert.equal(g.players[0].route,7);assert.equal(g.pending.stage,'miracle');assert.equal(g.phase,'resolution')
 assert.deepEqual(g.players.map(p=>p.resources.can),[18,18]);assert.equal(g.omenResume.pending.index,1)
 assert.equal(g.omens[1].revealed,false);assert.equal(publicGame(g,'a').omens[1].tile,undefined)
 assert.throws(()=>act(g,{type:'claim',prize:'can'}),/기적/)
 g=act(g,{type:'continueOmen'});assert.equal(g.pending.stage,'disaster');assert.equal(g.lastOmen.id,'food-cut')
 g=act(g,{type:'prepare'});g=act(g,{type:'prepare'})
 assert.equal(g.pending.stage,'reward');assert.equal(actorId(g),'b');assert.equal(g.day,1)
 assert.deepEqual(g.players.map(p=>p.resources.can),[18,18]);assert.deepEqual(g.players.map(p=>p.resources.bottleCap),[13,13])
 assert.equal(g.omens.filter(o=>o.resolved).length,2);assert.equal(g.omens[2].revealed,false)
 g=act(g,{type:'claim',prize:'can'});assert.equal(g.lastResult.choices.length,2);assert.equal(g.players[1].resources.can,20)
})
test('miracle progress chains lower spaces first; retreat cannot replay resolved tiles; shelter reacts off turn',()=>{
 let g=journeyReward(['radio','bridge','airdrop'],4)
 g=act(g,{type:'claim',prize:'route'});assert.deepEqual(g.players.map(p=>p.route),[6,2]);assert.equal(g.omens[1].revealed,false)
 g=act(g,{type:'continueOmen'});assert.equal(g.lastOmen.id,'bridge')
 g.players[1].party[0]=card('shelter','shelter',0)
 g=act(g,{type:'disasterLoss',uids:[]});g=act(g,{type:'shelter',uid:'shelter'})
 assert.equal(g.players[0].route,3);assert.equal(g.players[1].party[0].ready,false);assert.equal(g.pending.stage,'reward')
 assert.equal(g.omens[1].resolved,true)
 g.pending.prizes=[{id:'again',kind:'route',amount:4,label:'여정'}]
 g=act(g,{type:'claim',prize:'again'});assert.equal(g.omens.filter(o=>o.revealed).length,2)
})
test('progress has no day cap and exhausted exploration cards stay available',()=>{
 let g=fixture();g.day=99;g.deck=[];g.sites[0].crew=[]
 g=act(g,{type:'endManagement',uids:[]});g=act(g,{type:'endManagement',uids:[]})
 assert.equal(g.gameEnded,false);assert.equal(g.phase,'dispatch');assert.equal(RULES.days,undefined)
 const recruit=fixture();recruit.phase='maintenance';recruit.deck=[];recruit.sites=[{id:'last',card:LOCATIONS[0],resolved:true,crew:[{...recruit.players[0].party.pop(),owner:'a'}]}]
 g=act(recruit,{type:'returnOne',uid:recruit.sites[0].crew[0].uid});assert.ok(g.sites[0]);assert.equal(g.sites[0].resolved,undefined)
})

test('day-night migration updates costs and timing once without replaying income or changing paid readiness',()=>{
 const g=fixture();delete g.dayNightRevision;delete g.automaticReturnRevision
 const camp=g.players[0].party[0];camp.returnCost=2;camp.mealCost=1;camp.timing='파견·관리';camp.ready=false
 const away=g.players[0].party.pop();away.returnCost=2;g.sites[0].crew=[{...away,owner:'a'}];g.pending={stage:'return',actor:'a'}
 g.players[0].medical[away.uid]=1;g.players[0].managementUsed=[camp.uid]
 const resources=structuredClone(g.players.map(p=>p.resources))
 upgradeGame(g)
 assert.equal(camp.returnCost,undefined);assert.equal(camp.ready,false);assert.equal(camp.mealCost,undefined);assert.equal(camp.timing,'낮 · 거점')
 assert.equal(g.sites[0].crew[0].returnCost,undefined);assert.equal(g.players[0].medical[away.uid],1)
 assert.deepEqual(g.players.map(p=>p.resources),resources);assert.equal(g.players[0].managementUsed,undefined)
 const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
 for(const phase of ['setup','maintenance']) {const night=fixture(phase);assert.throws(()=>act(night,{type:'ability',uid:'a-captain',from:0,to:4}),/시점/)}
})

const eventCard = id => EVENT_CARDS.find(c=>c.id===id)
function withEvent(g, id) { g.activeEvent={card:eventCard(id),serial:1,at:3};g.eventSerial=1;return g }
test('event deck is hidden, ordered by stage, and crossed spaces reveal from the physical deck before resuming rewards',()=>{
 let g=journeyReward([],7);g.eventSpaces=EVENT_SPACES.map(at=>({at,used:false}));g.eventDeck=['airdrop','sandstorm','radio'].map(eventCard)
 const fresh=createGame(seats,rng(23));assert.deepEqual(fresh.eventDeck.map(c=>c.stage),[1,1,2,2,3,3]);assert.equal(new Set(fresh.eventDeck.map(c=>c.id)).size,6)
 assert.deepEqual(publicGame(g,'a').eventDeck,[null,null,null]);assert.equal(fresh.omens.length,0)
 g=act(g,{type:'claim',prize:'route'});assert.equal(g.pending.stage,'eventDraw');assert.equal(g.pending.at,3);assert.equal(g.activeEvent,null)
 assert.deepEqual(g.players.map(p=>p.resources.can),[15,15]);assert.equal(g.eventResume.pending.index,1)
 assert.throws(()=>act(g,{type:'drawEvent'},'b'),/차례/);assert.throws(()=>act(g,{type:'claim',prize:'can'}),/사건 덱/)
 g=act(g,{type:'drawEvent'});assert.equal(g.pending.stage,'eventReveal');assert.equal(g.activeEvent.card.id,'airdrop');assert.equal(g.eventDeck.length,2)
 assert.equal(publicGame(g,'b').activeEvent.card.id,'airdrop');assert.ok(publicGame(g,'b').eventDeck.every(x=>x===null))
 assert.throws(()=>act(g,{type:'drawEvent'}),/확인/)
 g=act(g,{type:'continueEvent'});assert.equal(g.pending.stage,'reward');assert.equal(actorId(g),'b');assert.equal(g.eventResume,undefined)
 assert.equal(g.activeEvent.holdThroughDay,2);assert.deepEqual(g.eventQueue,[{at:6,actor:'a'}])
 assert.deepEqual(g.eventSpaces.filter(s=>s.used).map(s=>s.at),[3,6]);assert.equal(g.eventDeck.length,2)
 // The other party arriving at an already crossed space cannot reveal it again.
 g.pending.prizes=[{id:'same',kind:'route',amount:6,label:'여정'}];g=act(g,{type:'claim',prize:'same'});assert.equal(g.eventDeck.length,2);assert.equal(g.eventSerial,1)
 if(g.pending?.stage==='return')g=act(g,{type:'return',uids:[]})
 g=act(g,{type:'endManagement',uids:[]});g=act(g,{type:'endManagement',uids:[]})
 assert.equal(g.day,2);assert.equal(g.pending,null);assert.equal(g.activeEvent.card.id,'airdrop')
 assert.equal(g.activeEvent.card.id,'airdrop')
 g=act(g,{type:'pass'});g=act(g,{type:'pass'})
 g=act(g,{type:'endManagement',uids:[]});g=act(g,{type:'endManagement',uids:[]})
 assert.equal(g.day,3);assert.equal(g.pending.stage,'eventDraw');assert.equal(g.pending.at,6)
 g=act(g,{type:'drawEvent'});assert.equal(g.activeEvent.card.id,'sandstorm');assert.deepEqual(g.eventDiscard.map(c=>c.id),['airdrop'])
 g=act(g,{type:'continueEvent'});assert.equal(g.phase,'dispatch');assert.equal(g.pending,null);assert.equal(g.eventQueue.length,0)
})
test('solving spends both ready crew and caps once; first winner gains a capped die while the environment stays',()=>{
 let g=withEvent(fixture('dispatch'),'sandstorm'),p=g.players[0],uids=p.party.slice(0,2).map(c=>c.uid)
 const before=structuredClone(g)
 for(const command of [{serial:0,uids},{serial:1,uids:[uids[0],uids[0]]},{serial:1,uids:[uids[0],'b-plain']},{serial:1,uids:[uids[0]]}]) assert.throws(()=>act(g,{type:'solveEvent',...command}))
 assert.deepEqual(g,before)
 g=act(g,{type:'solveEvent',serial:1,uids});p=g.players[0]
 assert.equal(p.resources.bottleCap,13);assert.equal(p.utopiaDie,1);assert.ok(p.party.slice(0,2).every(c=>!c.ready));assert.equal(actorId(g),'a')
 assert.equal(g.activeEvent.solvedBy,'a');assert.equal(g.activeEvent.card.id,'sandstorm');assert.equal(g.eventDiscard.length,0)
 assert.equal(eventModifier(g,p,'exploreDie'),-1);assert.equal(eventModifier(g,g.players[1],'exploreDie'),-1)
 assert.equal(g.notices.at(-1).items[0].value,1)
 assert.throws(()=>act(g,{type:'solveEvent',serial:1,uids:g.players[1].party.slice(0,2).map(c=>c.uid)}))
 for(const value of [1,5,6]) {let n=withEvent(fixture('dispatch'),'sandstorm');n.players[0].utopiaDie=value;n=act(n,{type:'solveEvent',serial:1,uids:n.players[0].party.slice(0,2).map(c=>c.uid)});assert.equal(n.players[0].utopiaDie,Math.min(6,value+1))}
 const night=withEvent(fixture(),'sandstorm');assert.equal(canSolveEvent(night,night.players[0],night.players[0].party.slice(0,2)),false)
 const poor=withEvent(fixture('dispatch'),'sandstorm');poor.players[0].resources.bottleCap=1;assert.throws(()=>act(poor,{type:'solveEvent',serial:1,uids}),/조건/)
 const late=eventCard('cold'),crew=[card('captain','x',0),card('doctor','y',1),card('doctor','z',2)]
 assert.equal(eventCrewValid(late,crew),false);crew[0].type='4차원';crew[1].type='겁쟁이';assert.equal(eventCrewValid(late,crew),true);crew[0].ready=false;assert.equal(eventCrewValid(late,crew),false)
})
test('event costs and safe forage affect both parties and disappear when another event is revealed',()=>{
 for(const [id,can,caps] of [['airdrop',2,1],['scrap-truck',1,2]]) {
  let g=withEvent(fixture('dispatch'),id);g.players.forEach(p=>{p.party=[]})
  for(const owner of ['a','b']) {g=act(g,{type:'forage'},owner);if(owner==='a')g=act(g,{type:'pass'},owner)}
  assert.deepEqual(g.players.map(p=>p.resources),[{can:15+can,bottleCap:15+caps},{can:15+can,bottleCap:15+caps}])
 }
 let g=withEvent(fixture(),'cold'),p=g.players[0],c=p.party[0];c.ready=false;assert.equal(mealCost(p,c,g),3)
 g=act(g,{type:'feed',uid:c.uid});assert.equal(g.players[0].resources.can,12)
 g=withEvent(g,'warm-night');assert.equal(mealCost(g.players[1],g.players[1].party[0],g),1)
 g=withEvent(g,'raiders');assert.equal(recruitCost(g,g.players[0],g.market[0]),g.market[0].cost+1)
 g=withEvent(g,'flood');for(const owner of g.players) assert.equal(eventModifier(g,owner,'incomeCan'),-2)
 g.pending={stage:'eventDraw',at:6,actor:'a'};g.eventDeck=[eventCard('radio')]
 g=act(g,{type:'drawEvent'});assert.equal(eventModifier(g,g.players[0],'incomeCan'),0);assert.equal(g.eventDiscard.at(-1).id,'flood')
 g=withEvent(fixture('dispatch'),'bridge');assert.equal(dispatchLimit(g,g.players[0]),1)
 assert.throws(()=>act(g,{type:'dispatch',uids:['a-captain','a-plain'],siteId:g.sites[0].id}),/1~1명/)
})
test('event environment changes actual recruitment, return, night income and final exploration dice',()=>{
 let g=withEvent(fixture(),'raiders'),cost=g.market[0].cost
 g=act(g,{type:'recruit',uid:g.market[0].uid});assert.equal(g.players[0].resources.bottleCap,14-cost)
 g=withEvent(fixture(),'flood');const away=g.players[0].party.pop();g.sites[0].crew=[{...away,owner:'a',ready:false}]
 g=act(g,{type:'returnOne',uid:away.uid});assert.equal(g.players[0].resources.bottleCap,15)
 for(const id of ['food-cut','hope-song']) {
  let base=fixture('dispatch');base.players.forEach(p=>p.passed=true);base.players[0].passed=false
  let active=withEvent(structuredClone(base),id);base=act(base,{type:'pass'});active=act(active,{type:'pass'})
  assert.equal(active.players[0].resources.can-base.players[0].resources.can,eventCard(id).amount)
  base=act(base,{type:'endManagement',uids:[]});active=act(active,{type:'endManagement',uids:[]});assert.equal(active.players[1].resources.can-base.players[1].resources.can,eventCard(id).amount)
 }
 for(const [id,eye] of [['sandstorm',3],['radio',5]]) {
  let n=withEvent(fixture('resolution'),id);n.sites=[{id:'roll',card:{...LOCATIONS[0],people:2,requires:[],distribution:'choice'},crew:n.players.map(p=>({...p.party.pop(),owner:p.seatId,ready:false})),food:0,caps:0}]
  n.pending={stage:'roll',siteId:'roll',trigger:'a',order:[],index:0};n=act(n,{type:'roll'},'a',()=>.5)
  assert.deepEqual(n.pending.results.map(r=>r.rolls),[[eye],[eye]])
 }
 const reward=withEvent(fixture(),'beacon');const site={card:LOCATIONS.find(c=>c.rewards?.some(p=>p.kind==='route')),crew:[]};assert.ok(site.card)
 assert.deepEqual(explorationPrizes(site,reward).filter(p=>p.kind==='route').map(p=>p.amount),explorationPrizes(site).filter(p=>p.kind==='route').map(p=>p.amount+1))
})
test('shelter and duck protect only their own party until the next revealed event',()=>{
 let g=withEvent(fixture('dispatch'),'cold');g.players[0].party[0]=card('shelter','shelter',0)
 g=act(g,{type:'ability',uid:'shelter'});assert.equal(g.players[0].eventProtection,1);assert.equal(g.players[0].party[0].ready,false)
 assert.equal(eventModifier(g,g.players[0],'meal'),0);assert.equal(eventModifier(g,g.players[1],'meal'),1)
 g.pending={stage:'eventDraw',actor:'a',at:6};g.eventDeck=[eventCard('cold')];g.players[1].leaderId='duck'
 g=act(g,{type:'drawEvent'},'a',()=>.99);assert.equal(g.players[0].eventProtection,undefined);assert.equal(g.players[1].eventProtection,2)
 assert.equal(eventModifier(g,g.players[0],'meal'),1);assert.equal(eventModifier(g,g.players[1],'meal'),0)
})
test('utopia die adds to the final total without rolling or consuming the counter',()=>{
 let g=fixture('dispatch');g.players[0].route=RULES.route;g.players[0].utopiaDie=3;g.players[0].party[2].type='분위기메이커'
 g=act(g,{type:'escape',uids:g.players[0].party.map(c=>c.uid)},'a',()=>.4)
 assert.deepEqual(g.lastUtopia.rolls,[3,3,3]);assert.equal(g.lastUtopia.eventDie,3);assert.equal(g.lastUtopia.total,12);assert.equal(g.lastUtopia.success,true);assert.equal(g.gameEnded,false);assert.equal(eventBonus(g.players[0]),3)
})
test('existing rooms migrate remaining cards without replaying effects or changing an open decision',()=>{
 const g=journeyReward(['airdrop','food-cut','radio'],7);delete g.eventRevision
 g.omens[0].revealed=true;g.omens[0].resolved=true;g.players[0].route=7;g.omenQueue=[{at:6,actor:'a'}]
 const pending=structuredClone(g.pending),resources=g.players.map(p=>({...p.resources}))
 upgradeGame(g);assert.deepEqual(g.eventDeck.map(c=>c.id),['food-cut','radio']);assert.deepEqual(g.eventDiscard.map(c=>c.id),['airdrop'])
 assert.deepEqual(g.eventQueue,[{at:6,actor:'a'}]);assert.deepEqual(g.pending,pending);assert.deepEqual(g.players.map(p=>p.resources),resources);assert.equal(g.activeEvent,null)
 const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
})

test('balanced decks retain supply and scouting at each tier without adding plain survivors', () => {
 for(const n of [2,3,4]) for(let seed=1;seed<=10;seed++) {
  const g=createGame(Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i})),rng(seed))
  const deck=[...g.sites.map(s=>s.card),...g.deck]
  assert.equal(deck.length,(n+2)*3)
  assert.equal(new Set(deck.map(c=>c.id)).size,deck.length)
  for(const tier of [1,2,3]) {
   assert.equal(deck.filter(c=>c.tier===tier).length,n+2)
   assert.ok(deck.some(c=>c.tier===tier&&c.explorationType==='supply'&&!c.interaction))
   assert.ok(deck.some(c=>c.tier===tier&&c.explorationType==='scout'))
  }
  assert.equal(g.market.length,3);assert.equal(g.recruitDeck.length,24)
 }
 const site={card:LOCATIONS.find(c=>c.explorationType==='large'),crew:[],chaosRoll:6}
 for(const prize of explorationPrizes(site)) {
  const printed=site.card.rewards.find(r=>r.id===prize.id)
  assert.equal(prize.amount,printed.amount*(prize.kind==='route'?1:2))
 }
})

test('leader discounts pay the actual cost and doctor support earns food without reactivating the user', () => {
 let g=withEvent(fixture('dispatch'),'sandstorm');g.players[0].leaderId='duck';g.players[0].resources.bottleCap=1
 assert.equal(eventSolveCost(g,g.players[0]),1)
 g=act(g,{type:'solveEvent',serial:1,uids:['a-captain','a-plain']})
 assert.equal(g.players[0].resources.bottleCap,0);assert.equal(g.players[0].utopiaDie,1)
 g=fixture();g.players[0].leaderId='zombie';g.players[0].resources.bottleCap=0
 const away=g.players[0].party.pop();g.sites=[{id:'unfinished',card:LOCATIONS[0],crew:[{...away,owner:'a'}]}]
 g=act(g,{type:'returnOne',uid:away.uid});assert.equal(g.players[0].resources.bottleCap,0);assert.equal(g.players[0].party.at(-1).ready,false)
 g=fixture('dispatch');g=act(g,{type:'ability',uid:'a-doctor',targetUid:'a-plain'})
 assert.equal(g.players[0].resources.can,16);assert.equal(g.players[0].party.find(c=>c.uid==='a-doctor').ready,false)
 assert.equal(mealCost(g.players[0],g.players[0].party.find(c=>c.uid==='a-plain'),g),0)
})

test('final expedition sums the best three dice; only event preparation adds a persistent bonus', () => {
 const g=fixture('dispatch'),p=g.players[0]
 p.route=99;p.party=[card('scout','cat',3),card('teacher','teacher',2),{...card('guard','guard',0),type:'용감이'}]
 const values=[6,4,3,3];let i=0
 const h=act(g,{type:'escape',uids:p.party.map(c=>c.uid)},'a',()=>(values[i++]-1)/6)
 assert.deepEqual(h.lastUtopia.sorted,[7,4,3,3]);assert.equal(h.lastUtopia.total,14);assert.equal(h.lastUtopia.bonus,0)
 p.utopiaDie=2;i=0
 const prepared=act(g,{type:'escape',uids:p.party.map(c=>c.uid)},'a',()=>(values[i++]-1)/6)
 assert.equal(prepared.lastUtopia.total,16);assert.equal(prepared.players[0].utopiaDie,2)
})

test('balance migration preserves an in-flight reward and queued events exactly once', () => {
 const g=journeyReward([],4);g.balanceRevision=undefined;g.locationRevision=5;g.abilityRevision=2
 g.eventQueue=[{at:6,actor:'b'}];g.activeEvent={card:eventCard('sandstorm'),serial:1,at:3,solvedBy:'a'}
 const pending=structuredClone(g.pending),resources=structuredClone(g.players.map(p=>p.resources)),away=structuredClone(g.sites[0].crew)
 upgradeGame(g)
 assert.deepEqual(g.pending,pending);assert.deepEqual(g.players.map(p=>p.resources),resources);assert.deepEqual(g.sites[0].crew.map(c=>[c.uid,c.returnCost,c.ready]),away.map(c=>[c.uid,c.returnCost,c.ready]))
 assert.deepEqual(g.eventQueue,[{at:6,actor:'b'}]);assert.equal(g.activeEvent.holdThroughDay,g.day);assert.equal(g.activeEvent.solvedBy,'a')
 const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
})


test('final-round bots prioritize eligibility, then stop buying excess movement', () => {
 const g=fixture('resolution');g.day=5;g.finalDay=5;g.players[0].route=18
 g.pending={stage:'reward',order:['a'],index:0,prizes:[{id:'route',kind:'route',amount:4},{id:'food',kind:'can',amount:3}]}
 assert.deepEqual(botCommand(g,'rush'),{type:'claim',prize:'route'},'movement during final settlement can prevent elimination')
 g.players[0].route=RULES.route;assert.deepEqual(botCommand(g,'rush'),{type:'claim',prize:'food'},'excess movement is not scored')
})


test('only parties at 20 compete; final exploration rewards can qualify a non-entered winner', () => {
 let g=fixture('dispatch');g.day=4;g.finalDay=4;g.currentPlayerIndex=1;g.sites=[]
 const [a,b]=g.players;a.escaped=true;a.passed=true;a.utopiaPoints=5;a.route=20;a.resources={can:2,bottleCap:2}
 b.route=19;b.resources={can:83,bottleCap:46}
 const excluded=act(g,{type:'pass'},'b')
 assert.equal(excluded.gameEnded,true);assert.equal(excluded.standings[0].seatId,'a');assert.equal(excluded.standings[0].supplies,0,'two leftovers do not combine across resources')
 assert.equal(excluded.standings[1].eligible,false);assert.equal(excluded.standings[1].rank,null);assert.equal(excluded.standings[1].supplies,42)
 const location={...LOCATIONS[0],id:'finish-line',roles:[],people:1,rewards:[{id:'last-route',kind:'route',amount:1,label:'이동'}]}
 g.sites=[{id:location.id,card:location,crew:[{...b.party.shift(),owner:'b'}]}]
 g=act(g,{type:'pass'},'b');assert.equal(g.pending.stage,'roll');g=act(g,{type:'roll'},'b');assert.equal(g.gameEnded,false)
 g=act(g,{type:'claim',prize:'last-route'},'b')
 assert.equal(g.gameEnded,true);assert.equal(g.players[1].route,20);assert.equal(g.players[1].escaped,false)
 assert.equal(g.standings[0].seatId,'b');assert.equal(g.standings[0].rank,1);assert.equal(g.standings[0].eligible,true)
 assert.equal(g.standings[0].party,g.players[1].party.reduce((n,c)=>n+cardScore(c),0),'returned cards still count')
})


test('bots recover crews whose missing types are stranded at other unfinished locations', () => {
 const g=fixture();g.players[1].party=[]
 g.players[0].party=[card('doctor','home',3)]
 const captain={...card('captain','away-leader',0),owner:'a'},brave={...card('guard','away-brave',1),owner:'a'}
 g.sites=[{id:'one',card:{...LOCATIONS[0],people:2,roles:['반장']},crew:[brave]},{id:'two',card:{...LOCATIONS[0],people:2,roles:['용감이']},crew:[captain]}]
 const recall=botCommand(g);assert.equal(recall.type,'returnOne');assert.equal(recall.uid,'away-brave');const h=act(g,recall);assert.equal(h.players[0].resources.bottleCap,15);assert.ok(h.players[0].party.some(c=>c.uid==='away-brave'&&!c.ready))
})

test('2–4 players finish their whole day and night before the next player acts', () => {
 for(const count of [2,3,4]) {
  const players=[...seats,{id:'c',name:'C',leaderId:'idol'},{id:'d',name:'D',leaderId:'duck'}].slice(0,count)
  let g=createGame(players,rng(count));g.phase='dispatch';g.omens=[];g.eventSpaces=[]
  g.players.forEach(p=>{p.resources={can:15,bottleCap:15};p.party=[card('captain',p.seatId+'-captain',0),card('plain',p.seatId+'-plain',1),card('doctor',p.seatId+'-doctor',2)]})
  g.sites=[{id:'long',card:{...LOCATIONS[0],people:6,roles:[],hazard:null},crew:[],food:0,caps:0},{id:'spare',card:{...LOCATIONS[0],people:8},crew:[],food:0,caps:0}]
  for(let i=0;i<count;i++) {
   const id=players[i].id,other=players[(i+1)%count].id
   g=act(g,{type:'dispatch',uid:id+'-captain',siteId:'long'},id);assert.equal(actorId(g),id)
   const snapshot=structuredClone(g);assert.throws(()=>act(g,{type:'forage',uid:other+'-plain'},other),/차례/);assert.deepEqual(g,snapshot)
   g=act(g,{type:'ability',uid:id+'-doctor',targetUid:id+'-plain'},id);assert.equal(actorId(g),id)
   g=act(g,{type:'replaceSite',uid:id+'-plain',siteId:g.sites[1].id},id);assert.equal(actorId(g),id);assert.equal(g.phase,'dispatch')
   g=act(g,{type:'pass'},id)
   if(i<count-1){assert.equal(actorId(g),other);assert.equal(g.phase,'dispatch')}
  }
  assert.equal(g.phase,'maintenance');assert.equal(actorId(g),'a');assert.equal(g.sites[0].crew.length,count)
  for(let i=0;i<count;i++) {
   const id=players[i].id,p=g.players[i],income=LEADERS.find(l=>l.id===p.leaderId).passiveIncome
   assert.deepEqual(p.resources,{can:15+income.can,bottleCap:15+income.bottleCap})
   g=act(g,{type:'returnOne',uid:id+'-captain'},id);assert.equal(actorId(g),id)
   g=act(g,{type:'feed',uid:id+'-captain'},id);assert.equal(actorId(g),id)
   const recruit=g.market[0];g=act(g,{type:'recruit',uid:recruit.uid,slot:3},id);assert.equal(actorId(g),id)
   assert.equal(g.players[i].resources.bottleCap,15+income.bottleCap-recruit.cost)
   assert.equal(g.phase,'maintenance');g=act(g,{type:'endManagement',uids:[]},id)
   if(i<count-1){assert.equal(g.phase,'maintenance');assert.equal(actorId(g),players[i+1].id)}
  }
  assert.equal(g.day,2);assert.equal(g.phase,'dispatch');assert.equal(actorId(g),'b');assert.ok(g.players.every(p=>!p.passed));assertState(g)
 }
})

test('a failed utopia attempt and a saved mid-day state keep the active player', () => {
 let g=fixture('dispatch');g.players[0].route=20;g.players[0].party[2].type='분위기메이커'
 g=act(g,{type:'escape',uids:g.players[0].party.map(c=>c.uid)},'a',()=>0)
 assert.equal(g.lastUtopia.success,false);assert.equal(g.phase,'dispatch');assert.equal(actorId(g),'a')
 const saved=JSON.parse(JSON.stringify(g)),snapshot=structuredClone(saved);upgradeGame(saved);assert.deepEqual(saved,snapshot)
 assert.throws(()=>act(saved,{type:'pass'},'b'),/차례/)
 g=act(saved,{type:'pass'},'a');assert.equal(actorId(g),'b');assert.equal(g.phase,'dispatch')
})

test('exploration specialties require their core type and never punish that required type', () => {
 const core = {contest:'용감이',scout:'겁쟁이',large:'반장',rescue:'분위기메이커',first:'4차원'}
 for(const location of LOCATIONS){
  if(location.roles.length && core[location.explorationType]) assert.ok(location.roles.includes(core[location.explorationType]),location.name)
  assert.ok(!location.roles.includes(location.hazard?.type),location.name+' required type must not trigger its taboo')
  if(!location.roles.length) continue
  const crew=Array.from({length:location.people},(_,i)=>({...card('plain','specialist-'+i),type:location.roles[i]??location.roles[0]}))
  const site={card:location,crew}
  assert.equal(requirements(site).ready,true,location.name)
  const missing=location.roles[0]
  const other=['겁쟁이','분위기메이커','반장','용감이','4차원'].find(t=>!location.roles.includes(t))
  site.crew=crew.map(c=>c.type===missing?{...c,type:other}:c)
  assert.equal(requirements(site).ready,false,location.name+' headcount alone cannot satisfy its specialty')
 }
 assert.ok(LOCATIONS.filter(c=>c.explorationType==='supply'&&!c.interaction).every(c=>!c.roles.length))
 assert.equal(LOCATIONS.find(c=>c.name==='지하 대피소').roles.length,0)
})

test('specialty migration refreshes untouched locations but preserves committed and pending expeditions', () => {
 const g=fixture('dispatch');g.locationRevision=6
 const fresh=LOCATIONS.find(c=>c.name==='침수된 연구소')
 const old={...fresh,roles:['4차원'],hazard:{type:'용감이',effect:'fail'}}
 const survivor=g.players[0].party.shift()
 g.sites=[
  {id:'empty',card:structuredClone(old),crew:[],food:0,caps:0},
  {id:'committed',card:structuredClone(old),crew:[{...survivor,owner:'a'}],food:0,caps:0},
  {id:'pending',card:structuredClone(old),crew:[],food:0,caps:0},
 ]
 g.pending={stage:'roll',siteId:'pending',actor:'a'}
 g.deck=[structuredClone(old)];g.siteDiscard=[structuredClone(old)]
 const before=structuredClone(g)
 upgradeGame(g)
 assert.equal(g.locationRevision,7)
 for(const c of [g.deck[0],g.siteDiscard[0],g.sites[0].card]){
  assert.deepEqual(c.roles,['용감이']);assert.deepEqual(c.hazard,{type:'겁쟁이',effect:'fail'})
 }
 assert.deepEqual(g.sites.slice(1),before.sites.slice(1));assert.deepEqual(g.pending,before.pending);assert.deepEqual(g.players,before.players)
 const once=structuredClone(g);upgradeGame(g);assert.deepEqual(g,once)
})
