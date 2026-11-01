import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Die, Icon, Portrait, Scene, Token, TypeBadge } from '../tabletop/Visuals.jsx'
import { RULES, DISASTERS, LEADERS, locationPrizes, distributionText } from './cards.js'
import { actorId, crewCount, nextDisaster, requirements } from './engine.js'
import { TYPES, TYPE_COLORS } from '../game/cards.js'
import './expedition.css'

const resourceKind = kind => kind === 'bottleCap' ? 'cap' : kind === 'route' ? 'clue' : kind

function effectSymbols(text) {
  return text.split(/((?:주사위|통조림|병뚜껑)(?:\s*[+-]?\d+(?:개)?)?)/g).map((part, i) => {
    const resource = part.match(/^(주사위|통조림|병뚜껑)(.*)$/)
    if (!resource) return part
    const [, name, amount] = resource
    return <span className="exp-effect-resource" key={i} role="img" aria-label={part}>{name === '주사위' ? <Icon name="dice" size={17}/> : <Token kind={name === '통조림' ? 'can' : 'cap'} small label={false}/>}<span>{amount.trim().replace('개', '')}</span></span>
  })
}

export function SurvivorFace({ card }) {
  const [effect, limit] = card.text.replace(/^(파견|귀환) · /, '').split(/ (?=파티당)/)
  return <article className="exp-card-front" data-exp-card="survivor" data-survivor-id={card.id} style={{ '--card-color': TYPE_COLORS[TYPES.indexOf(card.type)] }}>
    <header className="exp-card-heading"><h3>{card.name.replace(' 생존자', '')}</h3><span aria-label={'영입 비용 병뚜껑 ' + card.cost}><Token kind="cap" value={card.cost} small label={false}/></span></header>
    <div className="exp-portrait"><Portrait card={card}/></div>
    <div className="exp-ability"><p>{effectSymbols(effect)}</p>{limit && <p className="exp-ability-limit">{limit}</p>}</div>
    <footer><TypeBadge type={card.type}/><span>귀환 비용<Token kind="can" value={card.returnCost} small label={false}/></span></footer>
  </article>
}
function PlaceFace({ card }) {
  return <article className={'exp-place-front tier-' + card.tier} data-exp-card="location" data-distribution={card.distribution ?? 'choice'}>
    <header className="exp-place-heading"><h3>{card.name}</h3><span title={card.tier + '단계'} aria-label={card.tier + '단계'}>{['Ⅰ', 'Ⅱ', 'Ⅲ'][card.tier - 1]}</span></header>
    <Scene tier={card.tier} variant={Number(card.id.split('-').at(-1))}/>
    <div className="exp-condition"><small>출발 조건</small><div className="exp-people-condition"><span><Icon name="people" size={15}/>{card.people ?? card.roles.length}명 이상</span>{card.roles.length > 0 && <div className="exp-required-types">{card.roles.map((type, i) => type === '*' ? <span key={i}>아무나</span> : <TypeBadge key={i} type={type}/>)}<span>필수</span></div>}</div>
      {(card.food > 0 || card.caps > 0) && <div className="exp-required-supplies">{card.food > 0 && <Token kind="can" value={card.food} small label={false}/>} {card.caps > 0 && <Token kind="cap" value={card.caps} small label={false}/>}</div>}
      {card.danger && <p className="exp-danger-print">내 최종 <Icon name="dice" size={12}/>에 1 → 첫 파견자 실종<br/>보호 능력으로 방지</p>}
    </div>
    <footer className="exp-prize-print"><div>{locationPrizes(card).map(prize => <Token key={prize.id} kind={resourceKind(prize.kind)} value={prize.amount} small label={false}/>)}</div><small>{distributionText(card)}</small></footer>
  </article>
}
function Dialog({ title, children, close }) {
  const ref = useRef(null)
  useEffect(() => { const node = ref.current; node.showModal(); return () => node.close() }, [])
  return createPortal(<dialog ref={ref} className="paper-dialog exp-dialog" aria-label={title} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}><header><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="닫기"><Icon name="close"/></button></header>{children}</dialog>, document.body)
}
export function ExpeditionRules() {
  return <div className="rules-list exp-rule-copy">
    <p><b>8일의 여정</b> 하루에 각자 두 행동, 한 행동씩 번갈아 합니다. 첫 특수 동료만 지도자에 따라 다르며 구판 지도자 능력은 사용하지 않습니다.</p>
    <p><b>공동 파견</b> 활성 동료를 장소에 놓습니다. 다른 타입도 참가할 수 있습니다. 모든 파티가 총 필요 인원·타입·추가 물자을 채우면 즉시 탐색을 해결합니다. 타입에 맞는 사람도 총 인원에 포함되며 한 동료는 타입 조건 하나만 담당합니다.</p>
    <p><b>성과 경쟁</b> 파견자당 주사위 1개와 카드 능력을 적용합니다. 높은 눈부터 비교하고 완전 동률이면 먼저 참가한 파티가 앞섭니다. 모두 식량 1을 받습니다. 카드에 따라 순위대로 한 묶음씩 선택하거나, 1위가 인쇄된 발견물 전체를 획득합니다. 순위 선택형은 묶음이 소진되면 분배를 끝냅니다. 어느 방식이든 모든 참가 파티가 귀환을 결정합니다.</p>
    <p><b>귀환과 낙오</b> 보상을 받은 뒤 동료당 식량 1을 내고 귀환합니다. 자급 동료는 0입니다. 귀환자는 가로로 쉬고 다음 날 무료 회복합니다. 데려오지 않은 동료는 낙오하며 다음 날부터 누구나 영입할 수 있습니다.</p>
    <p><b>위험한 3단계</b> 최종 주사위에 1이 있으면 그 파티의 첫 파견자가 실종됩니다. 보호 동료가 있으면 방지합니다.</p>
    <p><b>준비와 철수</b> 안전한 탐색은 동료 없이 식량 2를 줍니다. 내 동료 한 명을 철수시키는 것도 한 행동이며 귀환 비용을 냅니다. 영입·방출·재난 대비도 각각 한 행동입니다.</p>
    <p><b>예고된 재난</b> 2·4·6·8일 끝에 재난을 처리합니다. 행동 1회로 인쇄된 물자를 내거나 활성 동료 2명을 사용해 대비합니다. 2명 중 1명은 지정 타입이어야 합니다. 파견 중인 사람은 대비에 쓸 수 없습니다. 미대비 시 물자를 잃고 내 거점·파견자 중 동료 1명(8일차 2명)을 직접 골라 낙오시킵니다. 다음 날부터 누구나 영입할 수 있습니다.</p>
    <p><b>경로와 탈출</b> 단서 10개 이상이면 활성 동료 3명을 골라 식량 3개를 내고 유토피아에 도전합니다. 파견자는 먼저 돌아와야 합니다. 1명당 주사위 1개에 추가 주사위·재굴림 능력을 적용하고 합계 10 이상이면 탈출합니다. 실패하면 단서는 유지하고 참가자는 휴식합니다. 최종 탐색은 참가 물자 보상과 실종이 없습니다. 최초 탈출한 날까지 모든 파티가 같은 행동 수를 갖고 끝납니다. 8일이 상한입니다.</p>
    <p><b>최종 순위</b> 탈출 여부 → 경로 → 파티 인원(파견자 포함) → 식량 순입니다. 모두 같으면 공동 순위입니다.</p>
    <p><b>장소 덱</b> 1·2·3단계를 각각 섞어 위에서부터 순서대로 쌓습니다. 단서와 무관하게 모두 참가할 수 있습니다. 다음 날 비어 있는 가장 왼쪽 장소 하나가 새 장소로 바뀝니다. 파견자가 있는 장소는 유지됩니다.</p>
    <p><b>판 조작</b> 내 카드와 장소를 차례로 누르면 바깥에서 파견을 확인합니다. 활성 동료를 탐색지에 끌어 놓으면 추가 물자 없이 바로 파견합니다. 통조림·병뚜껑은 클릭 파견에서 함께 보내거나 별도 행동으로 공급합니다. 카드 앞면은 어디서나 동일합니다. 빈 바닥 드래그와 확대·축소를 지원합니다.</p>
  </div>
}
function SharedRoute({ players }) {
  return <section className="exp-shared-route" aria-label="공용 탈출 경로"><b>유토피아 단서 · {RULES.route}개 이상이면 도전</b><div className="exp-route-stops">{Array.from({ length: RULES.route + 1 }, (_, n) => <div className="exp-route-stop" key={n} data-route-step={n}><strong>{n === 0 ? '출발' : n === RULES.route ? n + '+' : n}</strong><div>{players.filter(p => Math.min(p.route, RULES.route) === n).map(p => <span className="exp-route-pawn" key={p.seatId} data-route-owner={p.seatId} style={{ '--pawn': p.color }}><i/>{p.name}{p.route >= RULES.route ? ' · ' + p.route + '개' : ''}{p.escaped ? ' · 탈출' : ''}</span>)}</div></div>)}</div></section>
}
function Journey({ game }) {
  return <section className="exp-journey" aria-label="남은 날들과 재난"><header><div><span>앞으로 남은 날들</span><h2>DAY {game.day} / {RULES.days}</h2><small>재난은 해당 날짜의 마지막 행동 후 발생</small></div><SharedRoute players={game.players}/></header><div className="exp-day-tiles">{Array.from({ length: RULES.days }, (_, i) => {
    const day = i + 1, d = DISASTERS.find(d => d.day === day)
    return <article key={day} data-journey-day={day} aria-current={game.day === day ? 'step' : undefined} className={'exp-day-tile ' + (d ? 'has-disaster ' : '') + (game.day === day ? 'is-today ' : '') + (game.day > day ? 'is-past' : '')}><header><b>{day}일차</b><span>{game.day === day ? '오늘' : game.day > day ? '지나온 날' : d ? '재난 예고' : '준비'}</span></header>{d ? <><h3>{d.name}</h3><p>{d.text}</p><div className="exp-tile-preparation"><b>대비 · 아래 중 하나</b><div>{d.types.map(t => <TypeBadge key={t} type={t}/>)}<small>위 타입 포함 활성 2명 사용</small></div><div><Token kind={resourceKind(d.resource)} value={d.cost} small/><small>{d.preparation}</small></div></div><footer>{game.players.map(p => <span key={p.seatId} style={{ color: p.color }}>{p.name} {p.prepared.includes(day) || p.escaped ? '✓' : '—'}</span>)}</footer></> : <div className="exp-quiet-day"><Icon name="camp" size={40}/><b>길을 나설 시간</b><span>동료를 보내고<br/>다가올 재난에 대비하세요.</span></div>}</article>
  })}</div></section>
}
function Results({ results, players }) {
  return <div className="exp-dice-results">{results.map((r, i) => <div key={r.owner}><b style={{ color: players.find(p => p.seatId === r.owner).color }}>{i + 1}. {players.find(p => p.seatId === r.owner).name}</b><div>{r.rolls.map((v, j) => <Die key={j} value={v}/>)}</div>{r.notes.map(note => <small key={note}>{note}</small>)}{r.lost.length > 0 && <small className="exp-loss">첫 파견자 실종</small>}</div>)}</div>
}

export default function ExpeditionBoard({ api }) {
  const { room, command, busy, connected } = api, g = room.game, me = g.players.find(p => p.seatId === room.me)
  const actor = g.players.find(p => p.seatId === actorId(g)), myTurn = actor.seatId === me.seatId && !g.gameEnded, actionable = myTurn && !busy && connected
  const [utopiaUids, setUtopiaUids] = useState(null), [prepareUids, setPrepareUids] = useState(null), [lossUids, setLossUids] = useState(null)
  const [selected, setSelected] = useState(null), [siteId, setSiteId] = useState(null), [food, setFood] = useState(0), [caps, setCaps] = useState(0), [inspect, setInspect] = useState(null), [zoom, setZoom] = useState(1), [returns, setReturns] = useState([])
  const viewport = useRef(null), sitesRef = useRef(null), ownRef = useRef(null), campRef = useRef(null), othersRef = useRef(null), tableRef = useRef(null), pan = useRef(null)
  const q = g.pending, site = g.sites.find(s => s?.id === siteId), pendingSite = g.sites.find(s => s?.id === q?.siteId), disaster = nextDisaster(g)
  const ownCard = me.party.find(c => c.uid === selected), dispatched = g.sites.flatMap(s => s ? s.crew.map(c => ({ card: c, site: s })) : []).find(x => x.card.uid === selected)
  const recruit = [...g.market, ...g.stranded].find(c => c?.uid === selected)
  const returnCrew = q?.stage === 'return' ? pendingSite.crew.filter(c => c.owner === me.seatId) : []
  const lost = q?.results?.find(r => r.owner === me.seatId)?.lost ?? []
  const returnCost = returnCrew.filter(c => returns.includes(c.uid)).reduce((sum, c) => sum + c.returnCost, 0)
  const pendingKey = q ? q.siteId + '-' + q.stage + '-' + q.index : ''
  useEffect(() => {
    if (q?.stage === 'return' && myTurn) {
      let available = me.resources.can
      setReturns(returnCrew.filter(c => { if (lost.includes(c.uid) || c.returnCost > available) return false; available -= c.returnCost; return true }).map(c => c.uid))
    } else setReturns([])
  }, [pendingKey])
  useEffect(() => { setSelected(null); setSiteId(null); setFood(0); setCaps(0); setUtopiaUids(null); setPrepareUids(null); setLossUids(null) }, [g.currentPlayerIndex, g.turnInDay, g.day, pendingKey])
  async function act(c) { const ok = await command(c); if (ok) { setSelected(null); setSiteId(null); setFood(0); setCaps(0) } }
  async function dispatchSurvivor(uid, targetId, supply = 0, capSupply = 0) {
    if (!connected) { api.setError('서버에 다시 연결된 뒤 파견할 수 있습니다.'); return }
    if (busy) return
    if (!myTurn || q) { api.setError('지금은 ' + actor.name + '의 ' + (q ? '탐색 결과 선택' : '행동') + ' 차례입니다.'); return }
    const card = me.party.find(c => c.uid === uid)
    if (!card?.ready) { api.setError('내 거점의 활성 동료를 선택하세요. 휴식 중인 동료는 다음 날 돌아옵니다.'); return }
    await act({ type: 'dispatch', siteId: targetId, uid, food: supply, caps: capSupply })
  }
  function toggleReturn(uid) { if (!lost.includes(uid)) setReturns(old => old.includes(uid) ? old.filter(x => x !== uid) : [...old, uid]) }
  function selectCard(card, owner) {
    if (q?.stage === 'return' && myTurn && owner === me.seatId) toggleReturn(card.uid)
    else if (owner && owner !== me.seatId) setInspect({ card })
    else { setSelected(selected === card.uid ? null : card.uid); setFood(0); setCaps(0) }
  }
  function piece(card, owner, options = {}) {
    const isOwn = owner === me.seatId, returning = q?.stage === 'return' && myTurn && returnCrew.some(c => c.uid === card.uid)
    return <div className={'exp-piece ' + (options.resting ? 'exp-resting' : '')} key={card.uid} data-uid={card.uid}>
      <button className={'exp-card-button ' + ((returning ? returns.includes(card.uid) : selected === card.uid) ? 'is-selected' : '')} aria-label={card.name + (isOwn ? ' · 내 동료' : '')} aria-pressed={returning ? returns.includes(card.uid) : selected === card.uid}
        draggable={Boolean(isOwn && card.ready && actionable && !q && !options.deployed)} onDragStart={e => { e.dataTransfer.setData('text/plain', card.uid); e.dataTransfer.effectAllowed = 'move'; setSelected(card.uid); api.setError('') }}
        onClick={() => selectCard(card, owner)}><SurvivorFace card={card}/></button>
      {owner && <span className="exp-owner" style={{ background: g.players.find(p => p.seatId === owner).color }}>{options.stacked ? card.name + ' · ' : ''}{g.players.find(p => p.seatId === owner).name}{options.resting ? ' · 휴식' : ''}</span>}
      {options.deployed && <small className="exp-deployed-label">파견 중</small>}
      {!options.stacked && <button className="exp-inspect" onClick={() => setInspect({ card })} aria-label={card.name + ' 크게 보기'}>카드 크게 보기</button>}
    </div>
  }
  function partySlots(player) {
    const away = g.sites.flatMap(s => s?.crew.filter(c => c.owner === player.seatId) ?? [])
    const cards = [...player.party, ...away].sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }))
    return <div className="exp-party-slots" aria-label={player.name + ' 파티 ' + RULES.party + '자리'}>{Array.from({ length: RULES.party }, (_, i) => {
      const card = cards[i], deployed = card && away.some(c => c.uid === card.uid)
      return <div className={'exp-party-slot ' + (card && !deployed && !card.ready ? 'is-resting' : '')} key={i} data-party-slot={i + 1}><small className="exp-slot-number">{i + 1}</small>{card && !deployed ? piece(card, player.seatId, { resting: !card.ready }) : <div className="exp-slot-empty">{deployed ? <><Icon name="camp"/><b>{card.name}</b><span>파견 중 · 자리 유지</span></> : <><Icon name="people"/><b>빈자리</b><span>생존자를 영입하세요</span></>}</div>}</div>
    })}</div>
  }
  function fitBoard() {
    const view = viewport.current, table = tableRef.current
    if (!view || !table) return
    setZoom(Math.min(1, Math.max(.35, Math.min((view.clientWidth - 28) / table.offsetWidth, (view.clientHeight - 28) / table.offsetHeight))))
    view.scrollTo({ left: 0, top: 0 })
  }
  useEffect(() => {
    fitBoard()
    const observer = new ResizeObserver(fitBoard)
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  function jump(ref) { ref.current?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' }) }
  function beginPan(e) { if (e.button !== 0 || e.target.closest('button, input, select, a, summary, dialog, [draggable=true]')) return; pan.current = { x: e.clientX, y: e.clientY, left: viewport.current.scrollLeft, top: viewport.current.scrollTop }; viewport.current.setPointerCapture(e.pointerId) }
  const activeCrew = me.party.filter(c => c.ready), activeCount = activeCrew.length, awayCount = crewCount(g, me.seatId) - me.party.length
  const utopiaCrew = utopiaUids === null ? activeCrew.slice(0, RULES.escapePeople).map(c => c.uid) : utopiaUids.filter(uid => activeCrew.some(c => c.uid === uid))
  const specialist = activeCrew.find(c => disaster?.types.includes(c.type))
  const preparedCrew = prepareUids === null ? (specialist ? [specialist.uid, ...activeCrew.filter(c => c.uid !== specialist.uid).slice(0, 1).map(c => c.uid)] : []) : prepareUids.filter(uid => activeCrew.some(c => c.uid === uid))
  const canPrepare = preparedCrew.length === disaster?.crew && activeCrew.some(c => preparedCrew.includes(c.uid) && disaster.types.includes(c.type))
  const losingDisaster = q?.stage === 'disaster' ? DISASTERS.find(d => d.day === q.disasterDay) : null
  const ownedCrew = [...me.party, ...g.sites.flatMap(s => s?.crew.filter(c => c.owner === me.seatId) ?? [])]
  const lossCount = losingDisaster ? Math.min(losingDisaster.peopleLoss, ownedCrew.length) : 0
  const lostCrew = lossUids ?? []
  const canEscape = me.route >= RULES.route && utopiaCrew.length === RULES.escapePeople && me.resources.can >= RULES.escapeFood && !awayCount
  function crewChoices(cards, chosen, setChosen, max) {
    return <div className="exp-crew-choices">{cards.map(c => <label key={c.uid}><input type="checkbox" checked={chosen.includes(c.uid)} disabled={!actionable || (!chosen.includes(c.uid) && chosen.length >= max)} onChange={() => setChosen(chosen.includes(c.uid) ? chosen.filter(uid => uid !== c.uid) : [...chosen, c.uid])}/><span>{c.name.replace(' 생존자', '')}<small>{c.type}{c.owner ? ' · 파견 중' : ''}</small></span></label>)}</div>
  }
  return <div className="exp-game" data-exp-day={g.day} data-exp-stage={q?.stage ?? 'action'} data-exp-actor={actor.seatId} data-exp-me={me.seatId}>
    <div className="exp-toolbar"><div><b>공동 파견 · {g.day}일차</b><span>{g.finalDay ? '마지막 날 · ' : ''}{q ? actor.name + '의 ' + ({ roll: '주사위', reward: '발견물 선택', return: '귀환 결정', disaster: '재난 낙오자 선택' })[q.stage] : actor.name + ' 차례 · 오늘 ' + (Math.floor(g.turnInDay / g.players.length) + 1) + '/2번째 행동'}</span></div>
      <nav aria-label="보드 이동"><button onClick={() => setZoom(z => Math.max(.35, +(z - .1).toFixed(2)))} aria-label="축소">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(1.4, +(z + .1).toFixed(2)))} aria-label="확대">＋</button><button onClick={fitBoard}>전체 판</button><button onClick={() => jump(sitesRef)}>공동 탐색</button><button onClick={() => jump(ownRef)}>내 파티</button><button onClick={() => jump(campRef)}>영입·낙오자</button><button onClick={() => jump(othersRef)}>상대 파티</button><button onClick={api.exit}>방 나가기</button></nav>
    </div>
    <div className="exp-layout"><div className="exp-viewport" ref={viewport} onPointerDown={beginPan} onPointerMove={e => { if (!pan.current) return; viewport.current.scrollLeft = pan.current.left - (e.clientX - pan.current.x); viewport.current.scrollTop = pan.current.top - (e.clientY - pan.current.y) }} onPointerUp={() => { pan.current = null }} onPointerCancel={() => { pan.current = null }}>
      <main ref={tableRef} className="exp-table exp-facing-table" style={{ zoom, '--table-width': (g.players.length === 2 ? 2400 : g.players.length === 3 ? 2600 : 2800) + 'px' }}>
        <Journey game={g}/>

        <section ref={othersRef} className="exp-far-side" aria-label="상대 파티"><div className="exp-section-label"><h2>맞은편 파티</h2><p>함께 탐색하고, 먼저 탈출하세요.</p></div><div className="exp-opponents">{g.players.filter(p => p.seatId !== me.seatId).map(p => <div className="exp-opponent" key={p.seatId} data-seat={p.seatId} style={{ '--pawn': p.color }}><header><b>{p.name}{p.escaped ? ' · 탈출 완료' : ''}</b><span>거점 {p.party.length} · 파견 {crewCount(g, p.seatId) - p.party.length}</span></header><div className="exp-opponent-inner">{partySlots(p)}<div className="exp-opponent-supplies"><Token kind="can" value={p.resources.can}/><Token kind="cap" value={p.resources.bottleCap}/></div></div></div>)}</div></section>
        <section ref={sitesRef} className="exp-sites-section"><div className="exp-section-label"><h2>함께 가는 탐색</h2><p>활성 동료를 놓으면 바로 파견합니다. 클릭으로도 선택할 수 있습니다.</p></div><div className="exp-sites">
          <div className="exp-deck"><div className="exp-deck-face"><Icon name="book" size={54}/><strong>황무지 탐색</strong><span>1 → 2 → 3단계</span><small>각 단계 안에서 섞인 덱</small><b>{g.deck.length}장 남음</b></div><p>단서 없이도<br/>모든 장소에 참가 가능</p></div>
          {g.sites.map((s, i) => s ? <div className={'exp-site ' + (siteId === s.id ? 'is-target' : '') + (q?.siteId === s.id ? 'is-resolving' : '')} key={s.id} data-site={s.id}
            onDragOver={e => { if (actionable && !q) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }} onDrop={e => { e.preventDefault(); const uid = e.dataTransfer.getData('text/plain'); if (uid) dispatchSurvivor(uid, s.id) }}>
            <div className="exp-site-cards" style={{ '--crew-count': s.crew.length }}><button className="exp-place-button" onClick={() => { setSiteId(s.id); setFood(0); setCaps(0) }} aria-label={s.card.name + ' 탐색지 선택'} aria-pressed={siteId === s.id}><PlaceFace card={s.card}/></button>
            <div className="exp-assignees">{s.crew.map((c, index) => <div className="exp-assignee" key={c.uid} style={{ '--stack-order': s.crew.length - index }}>{piece(c, c.owner, { deployed: true, stacked: true })}</div>)}</div></div>
            <div className="exp-site-state"><b>인원 {s.crew.length}/{s.card.people ?? s.card.roles.length}명</b><span>{s.card.food > 0 ? '통조림 ' + s.food + '/' + s.card.food : ''}{s.card.caps > 0 ? ' 병뚜껑 ' + (s.caps ?? 0) + '/' + s.card.caps : ''}</span><small>{requirements(s).ready ? '출발 준비 완료' : ['추가 인원 ' + requirements(s).people + '명', requirements(s).missing.length ? '필요 타입: ' + requirements(s).missing.map(t => t === '*' ? '아무나' : t).join(' · ') : '타입 충족', requirements(s).food || requirements(s).caps ? '물자 대기' : '물자 충족'].join(' / ')}</small></div>
            {!s.crew.length && <div className="exp-drop-hint">놓으면 바로 파견 · 행동 1회</div>}
          </div> : <div className="exp-empty-place" key={'empty-' + i}>탐색을 마친 자리<br/><small>남은 장소 없음</small></div>)}
        </div></section>
        <section ref={ownRef} className="exp-camp-own" style={{ '--pawn': me.color }}><div className="exp-section-label"><h2>{me.name} · 내 파티</h2><p>활성 {activeCount} · 파견 {awayCount} · 휴식 {me.party.length - activeCount} / 최대 5명</p></div><div className="exp-own-inner"><div className="exp-leader-note"><Portrait card={LEADERS.find(l => l.id === me.leaderId)}/><strong>{LEADERS.find(l => l.id === me.leaderId).name}</strong><Token kind="can" value={me.resources.can}/><Token kind="cap" value={me.resources.bottleCap}/><p>귀환한 동료는<br/>다음 날 무료 회복</p></div>{partySlots(me)}<div className="exp-clue-pocket"><b>발견한 단서 · {me.route}개</b>{me.discoveries.map(c => <button key={c.uid} onClick={() => setInspect({ place: c })} aria-label={c.name + ' 확보한 단서 크게 보기'}><PlaceFace card={c}/></button>)}<small>단서 {RULES.route}개 이상 + 활성 3명 + 식량 3<br/>주사위 합계 {RULES.utopiaTarget} 이상이면 탈출</small></div></div></section>

        <section ref={campRef} className="exp-recruit-section"><div><div className="exp-section-label"><h2>생존자 캠프</h2><p>영입하면 다음 날부터 함께 행동합니다.</p></div><div className="exp-recruit-row"><div className="exp-small-deck"><Icon name="people" size={36}/><b>생존자 수색</b><small>{g.recruitDeck.length}장</small></div>{g.market.filter(Boolean).map(c => piece(c, null))}</div></div><div className="exp-stranded"><div className="exp-section-label"><h2>돌아오지 못한 사람들</h2><p>다음 날부터 누구나 영입할 수 있습니다.</p></div><div className="exp-recruit-row">{g.stranded.map(c => <div key={c.uid}>{piece(c, null)}<small>{c.availableDay > g.day ? c.availableDay + '일차부터 영입 가능' : '영입 가능'} · {c.reason}</small></div>)}{!g.stranded.length && <div className="exp-empty-note">아직 낙오된 생존자가 없습니다.</div>}</div></div></section>

      </main>
    </div><aside className="exp-actions" aria-label="테이블 행동">
      <div className="exp-action-status"><small>{g.gameEnded ? '여정 종료' : myTurn ? '내가 결정할 시간' : '테이블을 지켜보는 중'}</small><h2>{g.gameEnded ? '우리의 마지막 날' : actor.name + (q ? '의 선택' : ' 차례')}</h2><p>{q ? ({ roll: '출발 조건이 모였습니다. 주사위를 굴리세요.', reward: '모두 참가 식량을 받았습니다. 순위대로 발견물을 고릅니다.', return: '돌아올 동료를 고르고 귀환 식량을 지급합니다.', disaster: '물자 손실이 적용됐습니다. 낙오할 내 동료를 선택하세요.' })[q.stage] : '한 행동씩 번갈아 진행합니다. 동료를 선택하고 장소를 고르세요.'}</p></div>
      {g.gameEnded ? <><table className="exp-standings"><thead><tr><th>순위</th><th>파티</th><th>경로</th><th>동료</th></tr></thead><tbody>{g.standings.map(p => <tr key={p.seatId}><td>{p.rank}</td><th>{p.name}<small>{p.escaped ? '탈출 성공' : '여정 중'}</small></th><td>{p.route}개</td><td>{p.crew}명</td></tr>)}</tbody></table><p>탈출 → 경로 → 동료 수 → 식량 순. 동률은 공동 순위.</p><button className="primary-button" onClick={api.exit}>새 여정 준비</button></> : losingDisaster ? <div className="exp-disaster-loss"><h3>{losingDisaster.name}</h3><p>{losingDisaster.text}</p>{myTurn ? <><p>거점·파견자 중 낙오할 {lossCount}명을 선택하세요.</p>{crewChoices(ownedCrew, lostCrew, setLossUids, lossCount)}<button className="primary-button" disabled={!actionable || lostCrew.length !== lossCount} onClick={() => act({ type: 'disasterLoss', uids: lostCrew })}>낙오 확정 · {lostCrew.length}/{lossCount}명</button></> : <p>{actor.name}이 낙오자를 선택하고 있습니다.</p>}</div> : q ? <>
        <h3>{pendingSite.card.name}</h3><p className="exp-distribution-note">{distributionText(pendingSite.card)} · 참가 파티마다 통조림 1</p>{q.results && <Results results={q.results} players={g.players}/>}
        {q.stage === 'roll' && <button className="primary-button" disabled={!actionable} onClick={() => act({ type: 'roll' })}>탐색 주사위 굴리기</button>}
        {q.stage === 'reward' && <div className="exp-prize-actions">{q.prizes.map(r => <button key={r.id} className="secondary-button" disabled={!actionable} onClick={() => act({ type: 'claim', prize: r.id })}>{r.label}<Token kind={resourceKind(r.kind)} value={r.amount} small label={false}/></button>)}</div>}
        {q.choices?.length > 0 && <div className="exp-chosen-rewards">{q.choices.map(r => <small key={r.owner + '-' + r.id}>{g.players.find(p => p.seatId === r.owner).name} → {r.label} +{r.amount}</small>)}</div>}
        {q.stage === 'return' && myTurn && <div className="exp-return-actions"><p>통조림 <b>{me.resources.can}</b>개 보유 · 선택한 귀환 비용 <b>{returnCost}</b>개</p>{returnCrew.map(c => <label key={c.uid}><input type="checkbox" checked={returns.includes(c.uid)} disabled={lost.includes(c.uid) || busy} onChange={() => toggleReturn(c.uid)}/><span>{c.name}<small>{lost.includes(c.uid) ? '실종 · 귀환 불가' : '귀환 식량 ' + c.returnCost}</small></span></label>)}<p className="exp-loss">{returnCrew.length - returns.length}명은 낙오자 구역에 남습니다.</p><button className="primary-button" disabled={!actionable || returnCost > me.resources.can} onClick={() => act({ type: 'return', uids: returns })}>귀환 확정 · {returns.length}명</button></div>}
        {!myTurn && <p className="exp-waiting">{actor.name}의 결정을 기다립니다.</p>}
      </> : <>
        {ownCard && <div className="exp-selection"><h3>{ownCard.name}</h3><p>{ownCard.ready ? '함께 갈 장소를 고르세요.' : '휴식 중 · 다음 날 다시 행동할 수 있습니다.'}</p>{site && <><b>→ {site.card.name}</b>{requirements(site).food > 0 && <label>함께 보낼 통조림<select aria-label="함께 보낼 통조림" value={food} onChange={e => setFood(Number(e.target.value))}>{Array.from({ length: Math.min(requirements(site).food, me.resources.can) + 1 }, (_, i) => <option key={i} value={i}>{i}개</option>)}</select></label>}{requirements(site).caps > 0 && <label>함께 보낼 병뚜껑<select aria-label="함께 보낼 병뚜껑" value={caps} onChange={e => setCaps(Number(e.target.value))}>{Array.from({ length: Math.min(requirements(site).caps, me.resources.bottleCap) + 1 }, (_, i) => <option key={i} value={i}>{i}개</option>)}</select></label>}<button className="primary-button" disabled={!actionable || !ownCard.ready} onClick={() => dispatchSurvivor(ownCard.uid, siteId, food, caps)}>파견 확인</button></>}<button className="text-button exp-danger-action" disabled={!actionable} onClick={() => act({ type: 'dismiss', uid: ownCard.uid })}>파티에서 내보내기 · 행동 1회</button></div>}
        {recruit && <div className="exp-selection"><h3>{recruit.name} 영입</h3><p>파견자 포함 {crewCount(g, me.seatId)}/5명 · 다음 날 활성화</p><button className="primary-button" disabled={!actionable || crewCount(g, me.seatId) >= 5 || me.resources.bottleCap < recruit.cost || recruit.availableDay > g.day} onClick={() => act({ type: 'recruit', uid: recruit.uid })}>영입 확인 <Token kind="cap" value={recruit.cost} small label={false}/></button>{recruit.availableDay > g.day && <small>{recruit.availableDay}일차부터 영입할 수 있습니다.</small>}</div>}
        {dispatched?.card.owner === me.seatId && <div className="exp-selection"><h3>{dispatched.card.name} 철수</h3><p>{dispatched.site.card.name}에서 돌아옵니다.</p><button className="secondary-button" disabled={!actionable || me.resources.can < dispatched.card.returnCost} onClick={() => act({ type: 'withdraw', siteId: dispatched.site.id, uid: selected, rescue: true })}>귀환시키기 · 식량 {dispatched.card.returnCost}</button><button className="text-button exp-danger-action" disabled={!actionable} onClick={() => act({ type: 'withdraw', siteId: dispatched.site.id, uid: selected, rescue: false })}>귀환 포기 · 낙오자로 남기기</button></div>}
        {site && !ownCard && site.crew.some(c => c.owner === me.seatId) && (requirements(site).food > 0 || requirements(site).caps > 0) && <button className="secondary-button" disabled={!actionable || me.resources.can < requirements(site).food || me.resources.bottleCap < requirements(site).caps} onClick={() => act({ type: 'supply', siteId, food: requirements(site).food, caps: requirements(site).caps })}>물자 보내기{requirements(site).food > 0 && <Token kind="can" value={requirements(site).food} small label={false}/>} {requirements(site).caps > 0 && <Token kind="cap" value={requirements(site).caps} small label={false}/>}</button>}
        <div className="exp-basic-actions"><button className="secondary-button" disabled={!actionable} onClick={() => act({ type: 'forage' })}><Icon name="camp"/>안전한 탐색 <Token kind="can" value="+2" small label={false}/></button><small>활성 동료 없이도 가능 · 행동 1회</small></div>
        {disaster && <div className="exp-preparation"><h3>{disaster.name}</h3><small>{disaster.day}일차 끝 · {me.prepared.includes(disaster.day) ? '대비 완료 ✓' : '대비 필요'}</small><p className="exp-loss">{disaster.text}</p><button className="secondary-button" disabled={!actionable || me.prepared.includes(disaster.day) || me.resources[disaster.resource] < disaster.cost} onClick={() => act({ type: 'prepare' })}>{disaster.preparation} <Token kind={resourceKind(disaster.resource)} value={disaster.cost} small label={false}/></button>{!me.prepared.includes(disaster.day) && <><small>{disaster.types.join(' / ')} 중 1명을 포함해 활성 2명 선택</small>{crewChoices(activeCrew, preparedCrew, setPrepareUids, disaster.crew)}<button className="secondary-button" disabled={!actionable || !canPrepare} onClick={() => act({ type: 'prepare', uids: preparedCrew })}>2명으로 대비 · 행동 1회</button></>}</div>}
        <div className="exp-escape"><h3>유토피아 도전</h3><p>단서 {me.route}/{RULES.route}개 · 활성 {activeCount}/3명<br/>식량 {me.resources.can}/3 · 파견자 {awayCount}명</p><p>3명 파견 · 주사위 합계 {RULES.utopiaTarget} 이상 성공<br/>실패해도 식량 소모·참가자 휴식</p>{me.route >= RULES.route && crewChoices(activeCrew, utopiaCrew, setUtopiaUids, RULES.escapePeople)}<button className="primary-button" disabled={!actionable || !canEscape} onClick={() => act({ type: 'escape', uids: utopiaCrew })}>유토피아 도전 · 식량 3</button></div>
      </>}
      {g.lastUtopia && <div className="exp-utopia-result"><h3>{g.lastUtopia.name} · 유토피아 도전</h3><div>{g.lastUtopia.rolls.map((value, i) => <Die key={i} value={value}/>)}</div><p>합계 {g.lastUtopia.total} / 목표 {g.lastUtopia.target} · {g.lastUtopia.success ? '탈출 성공' : '실패 · 단서 유지, 참가자 휴식'}</p>{g.lastUtopia.notes.map(note => <small key={note}>{note}</small>)}</div>}
      <details className="exp-log"><summary>최근 여정 기록</summary>{[...g.log].reverse().map((line, i) => <p key={i}>{line}</p>)}</details><small>빈 바닥을 끌어 보드를 이동합니다.<br/>끌기 대신 카드 → 장소 선택도 가능합니다.</small>
    </aside></div>
    {inspect && <Dialog title={inspect.card?.name ?? inspect.place.name} close={() => setInspect(null)}><div className="exp-inspection">{inspect.card ? <SurvivorFace card={inspect.card}/> : <PlaceFace card={inspect.place}/>}</div></Dialog>}
  </div>
}
