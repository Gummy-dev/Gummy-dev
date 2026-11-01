import { OmenFace, OmenCrew, OmenLoss, EventFace } from './JourneyRail.jsx'
import { useEffect, useState } from 'react'
import { Token } from '../tabletop/Visuals.jsx'
import { LEADERS, LEADER_STRATEGIES, abilityPhase, siteCapacity } from './cards.js'
import { partyLimit, reorderCost, ownedCrew, requirements, disasterCrewValid, counterCrew, canSolveEvent, eventSolveCost, recruitCost } from './engine.js'

export function PendingManagement({ game: g, me, actionable, act }) {
  const q = g.pending, [uid, setUid] = useState(''), [slot, setSlot] = useState('')
  if (q.stage === 'trade' || q.stage === 'barter') {
    const from = g.players.find(p => p.seatId === q.proposer), to = g.players.find(p => p.seatId === q.actor)
    return <div className="exp-selection"><h3>{q.stage === 'barter' ? '물물교환 제안' : '생존자 교환 제안'}</h3>{q.stage === 'barter' ? <p>{from.name}의 {q.resource === 'can' ? '통조림' : '병뚜껑'} 2 ↔ {to.name}의 {q.other === 'can' ? '통조림' : '병뚜껑'} 2</p> : <><p>{from.name}의 {from.party.find(c => c.uid === q.give)?.name} ↔ {to.name}의 {to.party.find(c => c.uid === q.take)?.name}</p><p>수락하면 양쪽 동료는 피로 상태로 합류합니다.</p></>}{q.siteId && <p>교환 성사 시 양쪽 병뚜껑 +1. 파견자는 즉시 피로 상태로 귀환합니다.</p>}<p>거절하면 재화와 동료는 그대로 남습니다.</p><button disabled={!actionable} onClick={() => act({ type: 'tradeReply', accept: true })}>교환 수락</button><button disabled={!actionable} onClick={() => act({ type: 'tradeReply', accept: false })}>교환 거절</button></div>
  }
  const cards = (q.mode === 'lose' ? [me] : g.players.filter(p => p.seatId !== me.seatId && !p.escaped)).flatMap(p => p.party.filter(c => c.type === '용감이').map(c => ({ ...c, ownerName: p.name })))
  return <div className="exp-selection"><h3>비 · 좀비 행동</h3><p>{q.mode === 'lose' ? '주사위 1 · 내 용감이 한 명이 떠납니다.' : '주사위 6 · 상대 용감이 한 명을 데려옵니다.'}</p><select aria-label="지도자 능력 대상" value={uid} onChange={e => setUid(e.target.value)}><option value="">대상 선택</option>{cards.map(c => <option key={c.uid} value={c.uid}>{c.ownerName} · {c.name}</option>)}</select>{q.mode === 'steal' && <select aria-label="지도자 영입 자리" value={slot} onChange={e => setSlot(e.target.value)}><option value="">가능한 자리 자동 선택</option>{Array.from({ length: partyLimit(me) }, (_, i) => <option key={i} value={i}>{i + 1}번 자리</option>)}</select>}<button disabled={!actionable || !uid} onClick={() => act({ type: 'leaderChoice', uid, ...(slot === '' ? {} : { slot: Number(slot) }) })}>대상 확정</button></div>
}

export function ExplorationTrade({ game: g, me, site, actionable, act }) {
  const [target, setTarget] = useState(''), [resource, setResource] = useState('can'), [give, setGive] = useState(''), [take, setTake] = useState('')
  const enemy = g.players.find(p => p.seatId === target), barter = site.card.interaction === 'barter'
  const available = actionable && requirements(site).ready && site.crew.some(c => c.owner === me.seatId) && site.offered?.[me.seatId] !== g.day
  return <div className="exp-selection"><h3>{site.card.name} · {barter ? '물물교환' : '생존자 교환'}</h3><p>동료를 파견해 조건을 채운 뒤 제안합니다. 상대 수락 시 양쪽 병뚜껑 +1. 파티마다 하루 한 번 제안할 수 있습니다.</p>
    <label>상대 파티<select aria-label="교환할 파티" value={target} onChange={e => { setTarget(e.target.value); setTake('') }}><option value="">선택하세요</option>{g.players.filter(p => p !== me && !p.escaped).map(p => <option key={p.seatId} value={p.seatId}>{p.name}</option>)}</select></label>
    {barter ? <label>내가 줄 재화<select aria-label="교환할 재화" value={resource} onChange={e => setResource(e.target.value)}><option value="can">통조림 2 → 병뚜껑 2</option><option value="bottleCap">병뚜껑 2 → 통조림 2</option></select></label> : <>
      <label>내 동료<select aria-label="교환할 내 동료" value={give} onChange={e => setGive(e.target.value)}><option value="">선택하세요</option>{me.party.map(c => <option key={c.uid} value={c.uid}>{c.name} · {c.type}</option>)}</select></label>
      <label>상대 동료<select aria-label="교환할 상대 동료" value={take} onChange={e => setTake(e.target.value)}><option value="">선택하세요</option>{enemy?.party.map(c => <option key={c.uid} value={c.uid}>{c.name} · {c.type}</option>)}</select></label>
    </>}
    <button className="primary-button" disabled={!available || !enemy || (barter ? me.resources[resource] < 2 || enemy.resources[resource === 'can' ? 'bottleCap' : 'can'] < 2 : !give || !take)} onClick={() => act({ type: 'offerTrade', siteId: site.id, targetPlayer: target, resource, uid: give, targetUid: take })}>교환 제안 · 상대 수락 필요</button>
    {!available && <small>{site.resolved ? '교환이 성사된 장소입니다.' : site.offered?.[me.seatId] === g.day ? '다음 파견부터 다시 제안할 수 있습니다.' : '내 동료를 보내 출발 조건을 채우세요.'}</small>}
  </div>
}

export function LeaderActions({ game: g, me: p }) {
  const l = LEADERS.find(x => x.id === p.leaderId)
  return <section className="exp-leader-ability" aria-label="내 지도자 능력과 전략">
    <h3>{l.name}의 능력</h3><p>{l.skill}</p>
    <div className="exp-leader-income"><b>내 밤 시작 보급</b><div><Token kind="can" value={'+' + l.passiveIncome.can} small/><Token kind="cap" value={'+' + l.passiveIncome.bottleCap} small/></div></div>
    <p className="exp-leader-strategy">{LEADER_STRATEGIES[l.id]}</p>
  </section>
}

export default function Management({ game: g, me: p, selected, actionable, act }) {
  const [targetPlayer, setTargetPlayer] = useState(''), [targetUid, setTargetUid] = useState(''), [slot, setSlot] = useState(''), [payment, setPayment] = useState('bottleCap')
  const [from, setFrom] = useState(0), [to, setTo] = useState(1)
  const own = p.party.find(c => c.uid === selected)
  const recruit = [...g.market, ...p.fans, ...p.candidates].find(c => c?.uid === selected)
  const opponents = g.players.filter(x => x.seatId !== p.seatId && !x.escaped), enemy = opponents.find(x => x.seatId === targetPlayer)
  const chosenSlot = slot === '' ? {} : { slot: Number(slot) }
  useEffect(() => { setTargetUid(''); setFrom(own?.slot ?? 0); setTo(own?.slot === 1 ? 0 : 1) }, [selected])
  const playerSelect = <label>상대 파티<select aria-label="상대 파티 선택" value={targetPlayer} onChange={e => { setTargetPlayer(e.target.value); setTargetUid('') }}><option value="">선택하세요</option>{opponents.map(x => <option key={x.seatId} value={x.seatId}>{x.name}</option>)}</select></label>
  const slots = <label>합류 자리<select aria-label="합류 자리" value={slot} onChange={e => setSlot(e.target.value)}><option value="">가능한 자리 자동 선택</option>{Array.from({ length: partyLimit(p) }, (_, i) => <option key={i} value={i}>{i + 1}번 자리</option>)}</select></label>
  const reorder = <div className="exp-slot-selects">{[[from, setFrom, '바꿀 자리'], [to, setTo, '이동할 자리']].map(([v, setter, label]) => <label key={label}>{label}<select aria-label={label} value={v} onChange={e => setter(Number(e.target.value))}>{Array.from({ length: partyLimit(p) }, (_, i) => <option key={i} value={i}>{i + 1}번</option>)}</select></label>)}</div>
  return <div className="exp-management">
    {recruit && <div className="exp-selection"><h3>{recruit.name} 영입</h3><p>{recruit.tier}등급 · 영입 후 피로 상태</p>{slots}{p.leaderId === 'shy' && <label>지불 재화<select aria-label="영입 지불 재화" value={payment} onChange={e => setPayment(e.target.value)}><option value="bottleCap">병뚜껑</option><option value="can">통조림 · 샤이 능력</option></select></label>}<button className="primary-button" disabled={!actionable || p.resources[payment] < recruitCost(g,p,recruit) || recruit.availableDay > g.day} onClick={() => act({ type: 'recruit', uid: recruit.uid, payment, ...chosenSlot })}>영입 확인 · {recruitCost(g,p,recruit)}</button>{p.leaderId === 'idol' && g.market.some(c => c?.uid === recruit.uid) && <button disabled={!actionable || p.reserved || p.fans.length >= 3} onClick={() => act({ type: 'reserve', uid: recruit.uid })}>예비 팬으로 확보 · {p.fans.length}/3</button>}</div>}
    {own && <div className="exp-selection"><details><summary>자리 변경 · 교환 · 방출</summary>{reorder}<button disabled={!actionable || from === to || p.resources.bottleCap < reorderCost(p)} onClick={() => act({ type: 'reorder', from, to })}>자리 변경 · 병뚜껑 {reorderCost(p)}</button>{playerSelect}<label>교환할 상대 동료<select aria-label="교환 대상" value={targetUid} onChange={e => setTargetUid(e.target.value)}><option value="">선택하세요</option>{enemy?.party.map(c => <option key={c.uid} value={c.uid}>{c.name}</option>)}</select></label><button disabled={!actionable || p.tradeUsed || !targetUid || !targetPlayer} onClick={() => act({ type: 'offerTrade', uid: own.uid, targetPlayer, targetUid })}>교환 제안 · 상대 수락 필요</button><button className="text-button exp-danger-action" disabled={!actionable} onClick={() => act({ type: 'dismiss', uid: own.uid })}>파티에서 내보내기</button></details></div>}
  </div>
}

export function SearchActions({ game: g, me: p, actionable, act }) {
  const [index, setIndex] = useState(0), cost = p.party.some(c => c.slot === 2 && c.type === '분위기메이커') ? 0 : 1
  const available = actionable && ['setup', 'maintenance'].includes(g.phase) && !g.pending
  return <div className="exp-management"><p>필요할 때 밤에 한 번 사용할 수 있습니다. {p.leaderId === 'robot' ? 'HAL은 비공개 후보 두 장을 확인합니다.' : '바꿀 공개 후보를 선택하세요.'}</p>{p.leaderId !== 'robot' && <select aria-label="수색으로 교체할 카드" value={index} onChange={e => setIndex(Number(e.target.value))}>{g.market.map((c, i) => <option key={i} value={i}>{c?.name ?? '빈자리'}</option>)}</select>}<p>보유 통조림 {p.resources.can} · 수색 비용 {cost}</p><button className="primary-button" disabled={!available || p.searched || !g.recruitDeck.length || p.resources.can < cost} onClick={() => act({ type: 'search', index })}>{p.leaderId === 'robot' ? 'HAL · 후보 2장 보기' : '선택한 후보 교체'} · 통조림 {cost}</button>{!available && <small>내 밤 정비 차례에 사용할 수 있습니다.</small>}{p.searched && <small>이번 밤의 추가 수색은 사용했습니다.</small>}</div>
}

export function DisasterActions({ game: g, me: p, actionable, act }) {
  const d = g.lastOmen, [prepare, setPrepare] = useState([]), [loss, setLoss] = useState([])
  const active = p.party.filter(c => c.ready), owned = ownedCrew(g, p.seatId), lossCount = Math.min(d.peopleLoss, owned.length)
  const canPrepare = disasterCrewValid(d, active.filter(c => prepare.includes(c.uid)))
  return <div className="exp-management exp-disaster-decision"><OmenFace omen={{ tile: d }} players={g.players}/><p>{p.name} · 대응 선택</p>{g.pending.choice && <>
    <section className="exp-selection exp-omen-choice"><h3>물자로 대비</h3><p>보유 통조림 {p.resources.can} · 병뚜껑 {p.resources.bottleCap}</p><button className="primary-button" disabled={!actionable || p.resources[d.resource] < d.cost} onClick={() => act({ type: 'prepare' })}><Token kind={d.resource === 'can' ? 'can' : 'cap'} value={d.cost} small/> 지불</button></section>
    <section className="exp-selection exp-omen-choice"><h3>동료를 사용해 대비</h3><OmenCrew tile={d}/><small>거점의 준비된 동료 · 사용 후 피로</small><div className="exp-crew-choices">{active.map(c => <label key={c.uid}><input type="checkbox" checked={prepare.includes(c.uid)} disabled={!actionable || (prepare.length >= d.crew && !prepare.includes(c.uid))} onChange={() => setPrepare(prepare.includes(c.uid) ? prepare.filter(uid => uid !== c.uid) : [...prepare, c.uid])}/>{c.name} · {c.type}</label>)}</div><button disabled={!actionable || !canPrepare} onClick={() => act({ type: 'prepare', uids: prepare })}>동료 {d.crew}명 사용 · 재난 대비</button></section>
  {active.filter(c => c.ability === 'shelter').map(c => <button key={c.uid} disabled={!actionable} onClick={() => act({ type: 'shelter', uid: c.uid })}>{c.name} · 대피소 사용</button>)}</>}<section className="exp-disaster-loss exp-omen-choice"><h3>피해 감수</h3><OmenLoss tile={d}/><p>{g.pending.choice ? '확정할 때 물자를 잃고 선택한 동료가 낙오합니다.' : '물자 피해가 이미 적용된 재난입니다. 낙오자만 선택하세요.'} 낙오 {lossCount}명 선택.</p><div className="exp-crew-choices">{owned.map(c => <label key={c.uid}><input type="checkbox" checked={loss.includes(c.uid)} disabled={!actionable || (loss.length >= lossCount && !loss.includes(c.uid))} onChange={() => setLoss(loss.includes(c.uid) ? loss.filter(uid => uid !== c.uid) : [...loss, c.uid])}/>{c.name}</label>)}</div><button disabled={!actionable || loss.length !== lossCount} onClick={() => act({ type: 'disasterLoss', uids: loss })}>피해 확정 · 낙오 {lossCount}명</button></section></div>
}

export function AbilityActions({ game: g, me: p, card, actionable, act, compact = false }) {
  const [targetPlayer, setTargetPlayer] = useState(''), [targetUid, setTargetUid] = useState(''), [slot, setSlot] = useState('')
  const [from, setFrom] = useState(card.slot ?? 0), [to, setTo] = useState(card.slot === 1 ? 0 : 1), [resource, setResource] = useState('can'), [siteId, setSiteId] = useState('')
  const site = g.sites.find(s => s?.crew.some(c => c.uid === card.uid && c.owner === p.seatId))
  const opponents = g.players.filter(x => x !== p && !x.escaped), enemy = opponents.find(x => x.seatId === targetPlayer)
  const targets = card.ability === 'guide' ? g.sites.flatMap(s => s && !s.resolved ? s.crew.filter(c => c.owner === p.seatId) : []) : card.ability === 'doctor' ? ownedCrew(g, p.seatId).filter(c => c.uid !== card.uid && !p.medical[c.uid]) : ['vet', 'recruiter'].includes(card.ability) ? g.market.filter(Boolean) : enemy?.party.filter(c => c.ready) ?? []
  const needsPlayer = ['jam', 'hunter'].includes(card.ability), needsTarget = ['jam', 'doctor', 'vet', 'recruiter', 'guide'].includes(card.ability)
  const available = abilityPhase(card, g.phase, Boolean(site)) && (card.ability !== 'shelter' || (g.activeEvent?.card.kind === 'disaster' && p.eventProtection !== g.activeEvent.serial))
  return <div className="exp-selection exp-ability-actions">{!compact && <><h3>{card.name}</h3><p>{card.timing} · {card.text}</p></>}{available && <>
    <small>{site ? '자신이 파견된 탐색에 사용합니다.' : card.ready ? '낮 행동 한 번 · 사용하면 피로해져 파견할 수 없습니다.' : '피로 상태에서는 사용할 수 없습니다.'}</small>
    {needsPlayer && <label>상대 파티<select aria-label="상대 파티 선택" value={targetPlayer} onChange={e => { setTargetPlayer(e.target.value); setTargetUid('') }}><option value="">선택하세요</option>{opponents.map(x => <option key={x.seatId} value={x.seatId}>{x.name}</option>)}</select></label>}
    {needsTarget && <label>대상<select aria-label="능력 대상" value={targetUid} onChange={e => setTargetUid(e.target.value)}><option value="">선택하세요</option>{targets.map(c => <option key={c.uid} value={c.uid}>{c.name}</option>)}</select></label>}
    {card.ability === 'guide' && <label>옮겨 갈 탐색<select aria-label="이동할 탐색" value={siteId} onChange={e => setSiteId(e.target.value)}><option value="">선택하세요</option>{g.sites.filter(s => s && !s.resolved && s.crew.length < siteCapacity(s.card) && !s.crew.some(c => c.uid === targetUid)).map(s => <option key={s.id} value={s.id}>{s.card.name}</option>)}</select></label>}
    {card.ability === 'captain' && <div className="exp-slot-selects">{[[from, setFrom, '바꿀 자리'], [to, setTo, '이동할 자리']].map(([value, setter, label]) => <label key={label}>{label}<select aria-label={label} value={value} onChange={e => setter(Number(e.target.value))}>{Array.from({ length: partyLimit(p) }, (_, i) => <option key={i} value={i}>{i + 1}번</option>)}</select></label>)}</div>}
    {['vet', 'recruiter'].includes(card.ability) && <label>합류 자리<select aria-label="합류 자리" value={slot} onChange={e => setSlot(e.target.value)}><option value="">가능한 자리 자동 선택</option>{Array.from({ length: partyLimit(p) }, (_, i) => <option key={i} value={i}>{i + 1}번</option>)}</select></label>}
    {card.ability === 'wizard' && <label>변환할 재화<select aria-label="변환 재화" value={resource} onChange={e => setResource(e.target.value)}><option value="can">통조림 2 → 병뚜껑 3</option><option value="bottleCap">병뚜껑 2 → 통조림 3</option></select></label>}
    <button className="primary-button" disabled={!actionable || (!site && !card.ready) || site?.resolved || (card.ability === 'chaos' && (site?.chaosRoll || !requirements(site).ready)) || (needsPlayer && !targetPlayer) || (needsTarget && !targetUid) || (card.ability === 'guide' && !siteId)} onClick={() => act({ type: 'ability', uid: card.uid, targetPlayer, targetUid, from, to, resource, siteId, ...(slot === '' ? {} : { slot: Number(slot) }) })}>{card.ability === 'sabotage' ? '탐색 방해 · 자신 낙오' : card.ability === 'chaos' ? '탐색 도박 · 주사위 굴리기' : '생존자 능력 사용'}</button>
  </>}</div>
}

export function CounterActions({ game: g, me, actionable, act }) {
  const site = g.sites.find(s => s?.id === g.pending.siteId)
  const cards = counterCrew(g, site, me.seatId)
  return <div className="exp-selection"><h3>{site.card.name}</h3><p>{g.pending.reason}</p><p>반격하면 동료 한 명이 낙오하고 실패를 취소합니다. 부족해진 인원은 다시 충원해야 합니다. 취소한 타입 금기는 이 탐색에서 무효입니다.</p>{cards.map(c => <button className="primary-button" key={c.uid} disabled={!actionable} onClick={() => act({ type: 'counter', use: true, uid: c.uid })}>{c.name} 반격 · 자신 낙오</button>)}<button disabled={!actionable} onClick={() => act({ type: 'counter', use: false })}>반격하지 않기</button></div>
}

export function EventActions({ game:g, me:p, actionable, act }) {
  const [uids,setUids] = useState([]), event = g.activeEvent
  if (!event) return null
  const selected = p.party.filter(c=>uids.includes(c.uid)), winner = g.players.find(p=>p.seatId===event.solvedBy)
  return <div className="exp-event-actions"><EventFace event={event} players={g.players}/>
    {g.pending?.stage === 'eventReveal' ? <button className="primary-button" disabled={!actionable} onClick={()=>act({type:'continueEvent'})}>환경 효과 확인 · 계속</button> : winner ? <p>{winner.name}이 보너스를 받았습니다. 환경 효과는 계속 적용됩니다.</p> : <>
      <p>준비된 동료 {event.card.crew}명과 병뚜껑 {eventSolveCost(g,p)}개{p.leaderId === 'duck' ? '(덕이 할인)' : ''}를 함께 사용합니다.</p>
      <div className="exp-crew-choices">{p.party.filter(c=>c.ready).map(c=><label key={c.uid}><input type="checkbox" checked={uids.includes(c.uid)} disabled={!actionable || (uids.length>=event.card.crew&&!uids.includes(c.uid))} onChange={()=>setUids(uids.includes(c.uid)?uids.filter(id=>id!==c.uid):[...uids,c.uid])}/>{c.name} · {c.type}</label>)}</div>
      <button className="primary-button" disabled={!actionable||!canSolveEvent(g,p,selected)} onClick={()=>act({type:'solveEvent',serial:event.serial,uids})}>사건 해결 · 유토피아 눈 +1</button><small>낮 행동 1회 · 동료는 피로 · 환경 효과 유지</small>
    </>}
  </div>
}
