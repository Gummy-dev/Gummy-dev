import { Die, Icon, Token, TypeBadge } from '../tabletop/Visuals.jsx'
import { RULES } from './cards.js'
import { STAGE_MARKS } from './events.js'
import './journey.css'

const TOP = RULES.route
const tokenKind = kind => kind === 'bottleCap' ? 'cap' : kind === 'route' ? 'clue' : kind
const KIND = { disaster: '재난', miracle: '기적' }

function Person() {
  return <svg className="exp-person" viewBox="0 0 12 16" aria-hidden="true"><circle cx="6" cy="4" r="3.3"/><path d="M.5 16v-3.6a5.5 5.5 0 0 1 11 0V16Z"/></svg>
}
function People({ count, sign = '' }) {
  return <span className="exp-omen-people" role="img" aria-label={'동료 ' + sign + count + '명'}>{sign && <b>{sign}</b>}{Array.from({ length: count }, (_, i) => <Person key={i}/>)}</span>
}
// One line per decision: what stops it, what it costs, what everyone gets.
export function OmenCrew({ tile }) {
  return <span className="exp-omen-crew" role="img" aria-label={tile.types.join(tile.allTypes ? '와 ' : ' 또는 ') + ' 포함 준비된 동료 ' + tile.crew + '명'}>
    {tile.types.map((t, i) => <span key={t} className="exp-omen-type">{i > 0 && <i>{tile.allTypes ? '+' : '/'}</i>}<TypeBadge type={t} label={t === '분위기메이커' ? '분위기' : t}/></span>)}
    <People count={tile.crew}/>
  </span>
}
export function OmenLoss({ tile }) {
  return <span className="exp-omen-items">
    {Object.entries(tile.loss).map(([kind, amount]) => <Token key={kind} kind={tokenKind(kind)} value={'−' + amount} small label={false}/>)}
    {tile.routeLoss > 0 && <Token kind="clue" value={'−' + tile.routeLoss} small label={false}/>}
    {tile.peopleLoss > 0 && <People count={tile.peopleLoss} sign="−"/>}
  </span>
}
export function OmenFace({ omen, players = [] }) {
  const t = omen.tile
  return <article className="exp-omen-face" data-kind={t.kind} aria-label={KIND[t.kind] + ' ' + t.name}>
    <header><span className="exp-omen-glyph" aria-hidden="true">{t.icon}</span><h3>{t.name}</h3><small>{KIND[t.kind]} · {STAGE_MARKS[t.stage - 1]}</small></header>
    {t.kind === 'disaster' ? <>
      <div className="exp-omen-row"><b>대비</b><span className="exp-omen-items"><Token kind={tokenKind(t.resource)} value={t.cost} small label={false}/><i className="exp-omen-or">또는</i><OmenCrew tile={t}/></span></div>
      <div className="exp-omen-row" data-row="loss"><b>피해</b><OmenLoss tile={t}/></div>
    </> : <div className="exp-omen-row" data-row="gain"><b>모두</b><span className="exp-omen-items">
      {Object.entries(t.gain).map(([kind, amount]) => <Token key={kind} kind={tokenKind(kind)} value={'+' + amount} small label={false}/>)}
      {t.rest && <span className="exp-omen-rest" role="img" aria-label="피로한 동료 모두 준비"><Icon name="moon" size={18}/><Person/><Icon name="arrow" size={14}/><Person/></span>}
    </span></div>}
    {t.kind === 'disaster' && players.length > 0 && <footer>{players.map(p => <span key={p.seatId} style={{ '--pawn': p.color }} data-ready={p.prepared.includes(t.id) || t.results?.some(r => r.seatId === p.seatId && r.protected)}>{p.name} {p.prepared.includes(t.id) ? '대비' : t.results?.find(r => r.seatId === p.seatId)?.prayer === 6 ? '기도 6 · 보호' : '—'}</span>)}</footer>}
  </article>
}

export function EventFace({ event, players = [] }) {
  const card = event.card, winner = players.find(p => p.seatId === event.solvedBy)
  return <article className="exp-event-face" data-kind={card.kind} aria-label={KIND[card.kind] + ' ' + card.name}>
    <header><small>{KIND[card.kind]} · {STAGE_MARKS[card.stage - 1]}</small><h3>{card.name}</h3></header>
    <span className="exp-event-glyph" aria-hidden="true">{card.icon}</span>
    <div className="exp-event-effect"><b>공개된 동안 · 모든 파티</b><p>{card.text}</p></div>
    <div className="exp-event-condition"><b>해결 조건</b><OmenCrew tile={card}/><Token kind="cap" value={card.cost} small/><small>동료 사용 + 병뚜껑 지불</small></div>
    <footer><Die value={1}/><span>유토피아 눈 +1<small>먼저 해결한 파티만 · 최대 6</small></span></footer>
    {winner && <div className="exp-event-solved" style={{'--pawn':winner.color}}><i className="exp-pawn"/>{winner.name} 해결</div>}
  </article>
}

export default function JourneyBoard({ game: g, actionable, onDraw, onEvent, canAttempt, onAttempt }) {
  const drawing = g.pending?.stage === 'eventDraw'
  // Three spaces per row form a compact vertical score track.
  const rows = Math.ceil((TOP + 1) / 3)
  const position = n => { const turn = Math.floor(n / 3); return { row: rows - 1 - turn, col: turn % 2 ? 2 - n % 3 : n % 3 } }
  const path = Array.from({length:TOP+1},(_,n)=>{const {row,col}=position(n);return (n?'L':'M')+(col*100+50)+' '+(row*100+50)}).join(' ')
  return <section className="exp-journey-board" aria-label="유토피아 진행도">
    <header className="exp-path-header">
      <div><h2>유토피아 진행도</h2></div>
      <ul className="exp-path-parties">{g.players.map(p => <li key={p.seatId} style={{ '--pawn': p.color }}><i className="exp-pawn"/>{p.name}<b>{p.escaped ? '진입' : p.route + '칸'}</b></li>)}</ul>
      <span className="exp-path-legend">사건 칸을 처음 지나면 덱에서 1장 공개</span>
      {canAttempt && <button className="primary-button exp-utopia-open" data-context-trigger aria-label="유토피아 도전 준비" onClick={onAttempt}>유토피아 도전</button>}
    </header>
    <div className="exp-path-map" style={{'--path-rows': rows}}>
      <svg className="exp-path-road" viewBox={'0 0 300 '+rows*100} preserveAspectRatio="none" aria-hidden="true"><path d={path}/></svg>
      <ol className="exp-path-spaces">
        {Array.from({ length: TOP + 1 }, (_, n) => {
          const { row, col } = position(n), eventSpace = g.eventSpaces?.find(o => o.at === n)
          const pawns = g.players.filter(p => !p.escaped && Math.min(p.route, TOP) === n)
          return <li key={n} data-space={n} data-zone={n === 0 ? 'start' : n > RULES.route ? 'bonus' : n === RULES.route ? 'goal' : undefined} style={{ gridRow: row + 1, gridColumn: col + 1 }}>
            <span className="exp-path-number">{n === TOP ? n + '+' : n}</span>
            {n === 0 ? <strong>출발</strong> : n === RULES.route ? <strong>도전 가능</strong> : null}
            <>{eventSpace && <span className="exp-event-space" data-used={eventSpace.used} aria-label={eventSpace.used ? "이미 공개한 사건 칸" : "사건 한 장 공개"}><Icon name="cards" size={15}/></span>}</>
            <div className="exp-path-pawns">{pawns.map(p => <span key={p.seatId} title={p.name + ' · ' + p.route + '칸'} aria-label={p.name + ' · ' + p.route + '칸'} style={{ '--pawn': p.color }}><i className="exp-pawn"/></span>)}</div>
          </li>
        })}
      </ol>
      <div className="exp-path-destination"><b>유토피아</b><div className="exp-utopia-dice" aria-label="유토피아 사건 해결 주사위">{g.players.map(p => <div key={p.seatId} style={{'--pawn':p.color}} aria-label={p.name + ' 유토피아 보너스 ' + (p.utopiaDie ?? 0)}>{p.utopiaDie > 0 ? <Die value={p.utopiaDie}/> : <span className="exp-die-place"/>}<span>{p.name}</span></div>)}</div></div>
    </div>

    <div className="exp-event-table" aria-label="사건 덱과 공개 사건">
      <div><button className="exp-event-deck" disabled={!drawing || !actionable} onClick={onDraw} aria-label={drawing ? '사건 덱에서 한 장 공개' : '사건 덱 ' + g.eventDeck.length + '장'}><Icon name="cards" size={42}/><b>사건</b><span>재난 · 기적</span><small>{g.eventDeck.length}장</small></button><p>{drawing ? g.pending.at + '칸 · 한 장 공개하세요' : g.eventQueue.length ? g.eventQueue.length + '장 대기 · 다음 낮에 공개' : '사건 칸을 처음 지나면 공개'}</p></div>
      <div>{g.activeEvent ? <button className="exp-event-open" data-context-trigger onClick={onEvent} aria-label={g.activeEvent.card.name + ' 사건 선택'}><EventFace event={g.activeEvent} players={g.players}/></button> : <div className="exp-event-empty"><Icon name="cards" size={32}/><span>공개 사건</span></div>}<p>{g.activeEvent ? '다음 사건 공개까지 효과 유지' : '공개된 사건을 여기에 놓습니다'}</p></div>
    </div>
    <small className="exp-event-discard-count">지나간 사건 {g.eventDiscard.length}장</small>
  </section>
}
