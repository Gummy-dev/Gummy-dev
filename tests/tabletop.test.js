import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createGame, applyCommand, botCommand, mealCost, previewBonus, score, successChance, publicGame } from '../src/game/engine.js'
import { SURVIVORS } from '../src/game/cards.js'
import { createRoomService } from '../server/rooms.js'

const seats = [
  { id: 'a', name: '나', leaderId: 'shy', starters: [0, 1] },
  { id: 'b', name: '친구', leaderId: 'robot', starters: [2, 3] },
  { id: 'c', name: '동료', leaderId: 'idol', starters: [1, 4] },
]
function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 } }
const card = (id, uid = id) => ({ ...SURVIVORS.find(s => s.id === id), uid, active: true })

test('shared dice math, partial matching and wildcard cannot double count a survivor', () => {
  assert.equal(successChance(2, 9, 4), 30 / 36)
  const g = createGame(seats, seeded(1)), p = g.players[0]
  assert.equal(previewBonus(p, [p.party[0].uid], ['겁쟁이', '분위기메이커']).bonus, 2)
  p.party = [card('experiment')]
  assert.equal(previewBonus(p, ['experiment'], ['겁쟁이', '분위기메이커']).bonus, 2)
})
test('turn validation rejects forged assignments without mutating state; failure still recovers', () => {
  const original = createGame(seats, seeded(2))
  const before = JSON.stringify(original)
  assert.throws(() => applyCommand(original, 'b', { type: 'rest' }), /다른 플레이어/)
  assert.throws(() => applyCommand(original, 'a', { type: 'gather', ids: ['fake'], resource: 'can' }), /활성/)
  assert.throws(() => applyCommand(original, 'a', { type: 'gather', ids: [original.players[0].party[0].uid], resource: '__proto__' }))
  assert.equal(JSON.stringify(original), before)
  let g = applyCommand(original, 'a', { type: 'clue', route: 0, ids: original.players[0].party.map(s => s.uid), dice: [6, 6] }, () => 0)
  assert.deepEqual(g.pending.dice, [1, 1])
  assert.equal(g.actions, 1)
  g = applyCommand(g, 'a', { type: 'settleRoll' })
  assert.equal(g.players[0].clues, 0)
  assert.equal(g.players[0].party.every(s => !s.active), true)
  g = applyCommand(g, 'a', { type: 'maintain' })
  g = applyCommand(g, 'a', { type: 'meal', uid: g.players[0].party[0].uid })
  assert.equal(g.players[0].can, 3)
  assert.equal(g.players[0].party[0].active, true)
})
test('clues persist and unlock exactly once each turn; decks are never sent to clients', () => {
  let g = createGame(seats, seeded(3))
  g = applyCommand(g, 'a', { type: 'clue', route: 0, ids: g.players[0].party.map(s => s.uid) }, () => 0.99)
  g = applyCommand(g, 'a', { type: 'settleRoll' })
  assert.equal(g.players[0].clues, 1)
  assert.throws(() => applyCommand(g, 'a', { type: 'clue', route: 0, ids: [] }), /한 번/)
  assert.equal(publicGame(g, 'a').decks, undefined)
  assert.equal(publicGame(g, 'a').eventDecks, undefined)
  assert.deepEqual(publicGame(g, 'a').robotChoices, {})
  assert.equal(publicGame(g, 'b').robotChoices[1].length, 2)
  assert.equal(publicGame(g, 'b').robotChoices[3].length, 0)
})
test('rest cannot follow exploration; food cap and free meal limits hold', () => {
  let g = createGame(seats, seeded(4))
  g.players[0].can = 12
  g = applyCommand(g, 'a', { type: 'gather', resource: 'can', ids: [g.players[0].party[0].uid] })
  assert.equal(g.players[0].can, 12)
  assert.throws(() => applyCommand(g, 'a', { type: 'rest' }), /하기 전에/)
  g.players[0].party = [card('basic_2'), card('basic_3'), card('basic_1'), card('basic_0','back1'), card('basic_0','back2')]
  g.players[0].party.forEach(s => { s.active = false })
  g = applyCommand(g, 'a', { type: 'maintain' })
  g = applyCommand(g, 'a', { type: 'meal', uid: 'back1' })
  assert.equal(mealCost(g.players[0], g.players[0].party[4], g.flags), 1)
  assert.equal(g.players[0].can, 12)
})
test('cooperation is a genuine consent action and only the invited seat can answer', () => {
  let g = createGame(seats, seeded(5))
  const e = { id:'coop', uid:'coop', tier:1, kind:'coop', name:'협력', tags:[] }
  g.board[1][0] = e
  const ids = [g.players[0].party[0].uid]
  g = applyCommand(g, 'a', { type:'explore', eventId:'coop', ids, targetId:'b' })
  assert.throws(() => applyCommand(g,'c',{type:'respondCoop',accept:false}), /받은 사람/)
  const accepted = applyCommand(g,'b',{type:'respondCoop',accept:true,uid:g.players[1].party[0].uid})
  assert.equal(accepted.players[0].can,8)
  assert.equal(accepted.players[1].can,7)
  assert.equal(accepted.actions,1)
  const declined = applyCommand(g,'b',{type:'respondCoop',accept:false})
  assert.equal(declined.actions,2)
  assert.equal(declined.players[0].party[0].active,true)
})
test('utopia arrives without RNG, gives everyone one last turn, and scores consistently', () => {
  let g = createGame(seats, seeded(6))
  g.players[0].party.push(card('basic_2'), card('basic_3'))
  g.players[0].clues = 3; g.utopiaLeader = 'shy'
  g = applyCommand(g,'a',{type:'arrive',ids:g.players[0].party.map(s=>s.uid)},()=>{throw Error('Should not roll')})
  assert.equal(g.players[0].arrivalPoints,5)
  assert.equal(g.finalPlayer,'a')
  for (const actor of ['a','b','c']) {
    g = applyCommand(g,actor,{type:'maintain'})
    g = applyCommand(g,actor,{type:'end'},seeded(7))
  }
  assert.equal(g.ended,true)
  assert.equal(score(g.players[0],g.utopiaLeader).total,15)
})
test('disasters offer a real choice, resolve before supply, and the final lap keeps every promised turn', () => {
  let g=createGame(seats,seeded(18))
  g.round=3; g.current=2; g.phase='maintenance'
  g=applyCommand(g,'c',{type:'end'},seeded(19))
  assert.equal(g.pending.kind,'disaster')
  assert.equal(g.players[0].can,4)
  g=applyCommand(g,'a',{type:'disaster',pay:false,uid:g.players[0].party[0].uid})
  assert.equal(g.players[0].can,4)
  assert.equal(g.players[0].party[0].active,false)
  g=applyCommand(g,'b',{type:'disaster',pay:true})
  g=applyCommand(g,'c',{type:'disaster',pay:true})
  assert.equal(g.pending,null)
  assert.equal(g.players[0].can,6)
  g.round=8; g.current=1; g.finalPlayer='b'; g.phase='maintenance'
  g=applyCommand(g,'b',{type:'end'})
  g=applyCommand(g,'c',{type:'maintain'})
  g=applyCommand(g,'c',{type:'end'})
  assert.equal(g.ended,false)
  assert.equal(g.players[g.current].id,'a')
  g=applyCommand(g,'a',{type:'maintain'})
  g=applyCommand(g,'a',{type:'end'})
  assert.equal(g.ended,true)
})
test('100 seeded full games finish, never exceed economy limits or get stuck in bot actions', () => {
  for(let run=1;run<=100;run++) {
    const rng=seeded(run)
    let g=createGame(seats,rng), steps=0
    while(!g.ended && steps++<500) {
      const actor=['coop','disaster'].includes(g.pending?.kind)?g.pending.targetId:g.players[g.current].id
      g=applyCommand(g,actor,botCommand(g,actor),rng)
      for(const p of g.players) { assert.ok(p.can>=0&&p.can<=12); assert.ok(p.cap>=0&&p.cap<=12) }
    }
    assert.ok(g.ended,`seed ${run} did not finish`)
    assert.ok(g.round<=8)
  }
})

test('HTTP rooms: separate tokens, SSE, authorization, stale/replayed commands and reconnect', async t => {
  const service=createRoomService({savePath:null,botDelay:1})
  const server=createServer(service.handle)
  server.listen(0,'127.0.0.1'); await once(server,'listening')
  t.after(()=>{service.close();server.closeAllConnections();server.close()})
  const base=`http://127.0.0.1:${server.address().port}`
  async function api(path,method='GET',data,token) {
    const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})})
    return {status:res.status,...await res.json()}
  }
  const a=await api('/api/rooms','POST',{name:'첫째'})
  assert.equal(a.status,201)
  assert.equal(a.room.rulesVersion,'expedition-v2')
  const code=a.room.code, path=`/api/rooms/${code}`
  const b=await api(path+'/join','POST',{name:'둘째'})
  assert.notEqual(a.token,b.token)
  assert.equal(JSON.stringify(b.room).includes(a.token),false)
  assert.equal((await api(path,'GET',null,'forged')).status,401)
  const controller=new AbortController()
  const stream=await fetch(`${base}${path}/stream?token=${a.token}`,{signal:controller.signal})
  assert.equal(stream.headers.get('content-type'),'text/event-stream')
  const reader=stream.body.getReader(); const chunk=new TextDecoder().decode((await reader.read()).value)
  assert.ok(chunk.includes('첫째'))
  const latest=await api(path,'GET',null,a.token)
  assert.equal(latest.room.seats.find(s=>s.id===a.room.me).connected,true)
  const cmd={revision:latest.room.revision,requestId:'test-configure-1',command:{type:'configure',leaderId:'shy',starters:[0,1],ready:true}}
  const done=await api(path+'/commands','POST',cmd,a.token)
  assert.equal(done.status,200)
  const duplicate=await api(path+'/commands','POST',cmd,a.token)
  assert.equal(duplicate.room.revision,done.room.revision)
  assert.equal((await api(path+'/commands','POST',{...cmd,requestId:'test-stale-000'},a.token)).status,409)
  assert.equal((await api(path+'/commands','POST',{revision:done.room.revision,requestId:'bad-start-request',command:{type:'start'}},b.token)).status,400)
  controller.abort(); await reader.cancel().catch(()=>{})
  const reconnected=await api(path,'GET',null,a.token)
  assert.equal(reconnected.room.me,a.room.me)
  assert.equal(reconnected.room.seats.find(s=>s.id===a.room.me).ready,true)
  const practice=await api('/api/rooms','POST',{name:'연습',practice:true})
  assert.equal(practice.room.game.rulesVersion,'expedition-v2')
  assert.equal(practice.room.game.phase,'setup')
  assert.equal(practice.room.game.players.length,3)
  assert.equal(practice.room.game.decks,undefined)
  const archived=await api('/api/rooms','POST',{name:'보존판',rulesVersion:'original-v2'})
  const archivedPath=`/api/rooms/${archived.room.code}`
  const mismatch=await api(archivedPath+'/join','POST',{name:'현재판 참가자',rulesVersion:'expedition-v2'})
  assert.equal(mismatch.status,400)
  assert.match(mismatch.error,/다른 버전/)
  assert.equal((await api(archivedPath,'GET',null,archived.token)).room.seats.length,1)
  const archivedGuest=await api(archivedPath+'/join','POST',{name:'보존판 참가자',rulesVersion:'original-v2'})
  assert.equal(archivedGuest.status,201)
  assert.equal(archivedGuest.room.rulesVersion,'original-v2')
})

test('current multiplayer keeps a whole day/night turn until that player ends it',async t=>{
 const service=createRoomService({savePath:null}),server=createServer(service.handle)
 server.listen(0,'127.0.0.1');await once(server,'listening')
 t.after(()=>{service.close();server.closeAllConnections();server.close()})
 const base=`http://127.0.0.1:${server.address().port}`
 async function request(path,data,token){const response=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,...await response.json()}}
 const a=await request('/api/rooms',{name:'A'}),path='/api/rooms/'+a.room.code,b=await request(path+'/join',{name:'B'})
 const controller=new AbortController(),readers=[];t.after(()=>controller.abort())
 for(const seat of[a,b]){const stream=await fetch(base+path+'/stream?token='+seat.token,{signal:controller.signal});readers.push(stream.body.getReader());await readers.at(-1).read()}
 let serial=0
 async function command(seat,c){const current=await request(path,null,seat.token);return request(path+'/commands',{revision:current.room.revision,requestId:'whole-turn-'+ ++serial,command:c},seat.token)}
 for(const [seat,leaderId]of[[a,'shy'],[b,'robot']])assert.equal((await command(seat,{type:'configure',leaderId,starters:[0,1],ready:true})).status,200)
 assert.equal((await command(a,{type:'start'})).status,200)
 const uids=[]
 for(const seat of[a,b]){
  const current=await request(path,null,seat.token),uid=current.room.game.market[0].uid;uids.push(uid)
  assert.equal((await command(seat,{type:'recruit',uid})).status,200)
  assert.equal((await command(seat,{type:'feed',uid})).status,200)
  assert.equal((await command(seat,{type:'endManagement',uids:[]})).status,200)
 }
 const active=room=>room.game.players[room.game.currentPlayerIndex].seatId
 let response=await command(a,{type:'replaceSite',uid:uids[0],siteId:(await request(path,null,a.token)).room.game.sites[0].id});assert.equal(response.status,200);assert.equal(active(response.room),a.room.me)
 const revision=response.room.revision;response=await command(b,{type:'pass'});assert.equal(response.status,400);assert.equal((await request(path,null,a.token)).room.revision,revision)
 response=await command(a,{type:'pass'});assert.equal(active(response.room),b.room.me);assert.equal(response.room.game.phase,'dispatch')
 response=await command(b,{type:'replaceSite',uid:uids[1],siteId:(await request(path,null,b.token)).room.game.sites[0].id});assert.equal(response.status,200);assert.equal(active(response.room),b.room.me)
 response=await command(b,{type:'pass'});assert.equal(response.room.game.phase,'maintenance');assert.equal(active(response.room),a.room.me)
 response=await command(a,{type:'feed',uid:uids[0]});assert.equal(response.status,200);assert.equal(active(response.room),a.room.me)
 assert.equal((await command(b,{type:'feed',uid:uids[1]})).status,400)
 response=await command(a,{type:'endManagement',uids:[]});assert.equal(active(response.room),b.room.me)
 response=await command(b,{type:'feed',uid:uids[1]});assert.equal(response.status,200);assert.equal(active(response.room),b.room.me)
 response=await command(b,{type:'endManagement',uids:[]});assert.equal(response.room.game.phase,'dispatch');assert.equal(response.room.game.day,2);assert.equal(active(response.room),b.room.me)
})
