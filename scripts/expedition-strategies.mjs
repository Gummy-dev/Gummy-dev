// Pair every visible-state policy with every other policy; reverse seats and rotate leaders.
// These are bot diagnostics, not measured human strategy win rates or play times.
import {createGame,actorId,botCommand,applyCommand,crewCount} from '../src/expedition/engine.js'
import {LEADERS} from '../src/expedition/cards.js'
const rounds=Number(process.argv[2]??5)
if(!Number.isInteger(rounds)||rounds<1)throw new Error('Use a positive round count')
const styles=['rush','economy','elite','prepared','opportunist',...(process.argv.includes('--hoarding')?['idle']:[])]
const rng=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)
const totals=Object.fromEntries(styles.map(s=>[s,{played:0,wins:0,cycles:0,events:0,abilities:0,crew:0}]))
const matches=[]
for(let a=0;a<styles.length;a++)for(let b=a+1;b<styles.length;b++)for(let seed=1;seed<=rounds;seed++)for(let reverse=0;reverse<2;reverse++){
 const policies=reverse?[styles[b],styles[a]]:[styles[a],styles[b]], random=rng(seed*79+a*7+b)
 const seats=policies.map((_,i)=>({id:'p'+i,name:'P'+i,leaderId:LEADERS[(seed+(reverse?1-i:i))%LEADERS.length].id}))
 let g=createGame(seats,random),steps=0
 const events=[0,0],abilities=[0,0]
 while(!g.gameEnded&&steps++<1800){
  const actor=actorId(g),i=seats.findIndex(p=>p.id===actor)
  const command=policies[i]==='idle'&&!g.pending ? (g.phase==='dispatch'?{type:'pass'}:{type:'endManagement',uids:[]}) : botCommand(g,policies[i])
  if(command.type==='solveEvent')events[i]++
  if(command.type==='ability')abilities[i]++
  try{g=applyCommand(g,actor,command,random)}catch(error){throw new Error(JSON.stringify({a,b,seed,reverse,day:g.day,actor,command})+': '+error.message)}
 }
 const winners=g.standings?.filter(p=>p.rank===1).map(p=>seats.findIndex(s=>s.id===p.seatId))??[]
 const winner=winners.length===1?winners[0]:-1
 for(let i=0;i<2;i++){if(policies.includes('idle')&&policies[i]!=='idle')continue;const t=totals[policies[i]];t.played++;t.wins+=winners.includes(i)?1/winners.length:0;t.cycles+=g.day;t.events+=events[i];t.abilities+=abilities[i];t.crew+=crewCount(g,seats[i].id)}
 matches.push({policies,seed,reverse,leaders:seats.map(p=>p.leaderId),winner:winner<0?null:policies[winner],ended:g.gameEnded,tied:winners.length>1,score:g.standings,resources:g.players.map(p=>p.resources),firstEntry:g.players.find(p=>p.utopiaPoints===5)?.seatId,cycles:g.day,steps,route:g.players.map(p=>p.route),events,abilities})
}
console.log(JSON.stringify({note:'20-space eligibility; final-round scoring, each resource scored separately. Strategy totals exclude idle-control matches; idle totals are the control only. Ties split equally. Not human win-rate estimates.',rounds,games:matches.length,unfinished:matches.filter(m=>!m.ended),tied:matches.filter(m=>m.tied).length,policies:Object.fromEntries(Object.entries(totals).map(([s,t])=>[s,{...t,winPercent:Math.round(t.wins/t.played*1000)/10,meanCycles:Math.round(t.cycles/t.played*10)/10}])),matches},null,2))
