// Deterministic pacing diagnostics, not a model of negotiation or human win rates.
import { createGame, runBot, botCommand, crewCount, applyCommand } from '../src/expedition/engine.js'
import { LEADERS, SURVIVOR_CARDS, PLAIN, RULES } from '../src/expedition/cards.js'
const count=Number(process.argv[2]??30)
if(!Number.isInteger(count)||count<1)throw new Error('Use a positive game count')
const rng=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)
const mean=a=>+(a.reduce((s,x)=>s+x,0)/Math.max(1,a.length)).toFixed(2)
const summary=[]
for(const n of [2,3,4]){
 const runs=[]
 for(let seed=1;seed<=count;seed++){
  const random=rng(seed*29+n), seats=Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,leaderId:LEADERS[(seed+i)%5].id}))
  let g=createGame(seats,random),steps=0, firstDeep=null, day4=null, attempts=0, resolved=0, failed=0, losses=0, prepared=0, recruited=0, initial=[], fiveParty=false, abilityUses=0
  const actions={}, snapshots=[]
  while(!g.gameEnded&&steps++<1800){
   const cmd=botCommand(g),oldDay=g.day,oldPhase=g.phase,last=JSON.stringify(g.lastResult)
   actions[cmd.type]=(actions[cmd.type]??0)+1
   if(cmd.type==='escape')attempts++
   if(cmd.type==='ability')abilityUses++
   if(cmd.type==='disasterLoss')losses++
   if(cmd.type==='solveEvent')prepared++
   if(cmd.type==='recruit')recruited++
   g=runBot(g,random)
   fiveParty ||= g.players.some(p=>crewCount(g,p.seatId)>=5)
   if(oldPhase==='setup'&&g.phase==='dispatch')initial=g.players.map(p=>p.party.length)
   if(firstDeep===null&&g.sites.some(s=>s?.card.tier===3))firstDeep=g.day
   if(last!==JSON.stringify(g.lastResult)&&g.lastResult){if(g.lastResult.failed)failed++;else resolved++}
   if(oldDay!==g.day||g.gameEnded){
    snapshots.push({day:oldDay,can:mean(g.players.map(p=>p.resources.can)),caps:mean(g.players.map(p=>p.resources.bottleCap)),crew:mean(g.players.map(p=>crewCount(g,p.seatId))),route:mean(g.players.map(p=>p.route)),lead:Math.max(...g.players.map(p=>p.route))})
    if(oldDay===4)day4=g.players.map(p=>p.route)
   }
  }
  if(!g.gameEnded)console.error('step limit '+n+'/'+seed+' day '+g.day)
  const winner=g.players.findIndex(p=>p.seatId===g.standings?.[0]?.seatId)
  runs.push({ended:g.gameEnded,score:g.standings,day:g.day,escaped:g.players.filter(p=>p.escaped).length,topRoute:Math.max(...g.players.map(p=>p.route)),routes:g.players.map(p=>p.route),firstDeep,attempts,resolved,failed,losses,prepared,recruited,initial,fiveParty,abilityUses,actions,snapshots,omens:[...g.eventDiscard,...(g.activeEvent?[g.activeEvent.card]:[])].map(c=>c.kind),comeback:day4&&g.gameEnded&&g.standings.filter(p=>p.rank===1).length===1&&Math.max(...day4)-day4[winner]>=2})
 }
 summary.push({players:n,games:count,gamesWithEscape:runs.filter(r=>r.escaped).length,unfinished:runs.filter(r=>!r.ended).map(r=>({day:r.day,routes:r.routes})),meanDay:mean(runs.filter(r=>r.ended).map(r=>r.day)),medianDay:[...runs].filter(r=>r.ended).sort((a,b)=>a.day-b.day)[Math.floor(runs.filter(r=>r.ended).length/2)]?.day,meanTopRoute:mean(runs.map(r=>r.topRoute)),meanPlayerRoute:mean(runs.flatMap(r=>r.routes)),meanAttempts:mean(runs.map(r=>r.attempts)),meanResolved:mean(runs.map(r=>r.resolved)),meanFailed:mean(runs.map(r=>r.failed)),gamesSeeingTier3:runs.filter(r=>r.firstDeep!==null).length,meanFirstTier3:mean(runs.filter(r=>r.firstDeep!==null).map(r=>r.firstDeep)),meanRecruited:mean(runs.map(r=>r.recruited)),meanInitialParty:mean(runs.flatMap(r=>r.initial)),gamesWithFivePersonParty:runs.filter(r=>r.fiveParty).length,meanAbilityUses:mean(runs.map(r=>r.abilityUses)),meanDisasterLosses:mean(runs.map(r=>r.losses)),meanSolvedEvents:mean(runs.map(r=>r.prepared)),winsFrom2CluesBehindDay4:runs.filter(r=>r.comeback).length,meanEvents:mean(runs.map(r=>r.omens.length)),meanDisasters:mean(runs.map(r=>r.omens.filter(k=>k==='disaster').length)),meanMiracles:mean(runs.map(r=>r.omens.filter(k=>k==='miracle').length)),days:[2,4,6,8].map(day=>{const rows=runs.flatMap(r=>r.snapshots.filter(s=>s.day===day));return{day,samples:rows.length,can:mean(rows.map(r=>r.can)),caps:mean(rows.map(r=>r.caps)),crew:mean(rows.map(r=>r.crew)),route:mean(rows.map(r=>r.route)),lead:mean(rows.map(r=>r.lead))}})})
}
// Enumerate every equally likely die stream through the real final-expedition engine.
const odds=[]
for(const [name, abilities, route, eventDie = 0] of [
 ['기본 3타입', ['plain','plain','plain'],RULES.route],
 ['앞 용감이 포함', ['plain','plain','brave'],RULES.route],
 ['앞 용감이 + 여정 '+(RULES.route+4), ['plain','plain','brave'],RULES.route+4],
 ['선생님 + 앞 용감이', ['teacher','plain','brave'],RULES.route],
 ['고양이 + 앞 용감이', ['plain','scout','brave'],RULES.route],
 ['선생님 + 고양이 + 앞 용감이', ['teacher','scout','brave'],RULES.route],
 ['기본 3타입 + 사건 1', ['plain','plain','plain'],RULES.route,1],
 ['기본 3타입 + 사건 2', ['plain','plain','plain'],RULES.route,2],
 ['고양이 + 선생님 + 앞 용감이 + 사건 1', ['teacher','scout','brave'],RULES.route,1],
]) {
 const g=createGame([{id:'a',name:'A'},{id:'b',name:'B'}],rng(1));g.phase='dispatch';const p=g.players[0];p.route=route;p.utopiaDie=eventDie;p.resources.can=20
 p.party=abilities.map((ability,i)=>({...(['plain','brave'].includes(ability)?PLAIN.find(c=>c.type===(ability==='brave'?'용감이':i===0?'반장':i===1?'겁쟁이':'분위기메이커')):SURVIVOR_CARDS.find(c=>c.ability===ability)),uid:'odds'+i,slot:ability==='brave'?0:i+2,ready:true}))
 const n=3+Number(abilities.includes('scout'))+Number(abilities.includes('teacher')), total=6**n;let wins=0
 for(let sequence=0;sequence<total;sequence++){let encoded=sequence, stream=Array.from({length:n},()=>{const value=encoded%6;encoded=Math.floor(encoded/6);return value/6}),i=0;const out=applyCommand(g,'a',{type:'escape',uids:p.party.map(c=>c.uid)},()=>stream[i++]);wins+=Number(out.lastUtopia.success)}
 odds.push({party:name,successfulStreams:wins,totalStreams:total,chance:+(100*wins/total).toFixed(2)})
}
console.log(JSON.stringify({escapeOdds:odds,note:'Seeded heuristic bots; pacing/legality evidence only, not human balance proof.',gamesPerTableSize:count,summary},null,2))
