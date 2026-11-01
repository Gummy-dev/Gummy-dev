import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Die, Icon, Portrait, Scene, Token, TypeBadge } from '../tabletop/Visuals.jsx'
import { RULES, LEADERS, cardScore, locationPrizes, distributionText, placementLabel, hazardText } from './cards.js'
import { actorId, crewCount, requirements, partyLimit, explorationPrizes, canEscape, escapeCrew, ownedCrew, joinSlot, mealCost, reorderCost, eventBonus, dispatchLimit } from './engine.js'
import { TYPES, TYPE_COLORS, TYPE_PAPER_COLORS } from '../game/cards.js'
import Management, { PendingManagement, LeaderActions, ExplorationTrade, SearchActions, DisasterActions, AbilityActions, CounterActions, EventActions } from './Management.jsx'
import PlaceFace from './LocationCard.jsx'
import { CardMenu, GainToasts } from './CardMenu.jsx'
import './expedition.css'
import { eventModifier } from './events.js'
import JourneyBoard, { OmenFace } from './JourneyRail.jsx'

const resourceKind = kind => kind === 'bottleCap' ? 'cap' : kind === 'route' ? 'clue' : kind
const NEXT_PHASE = { setup: '모두 출발 준비를 마치면 첫 낮', dispatch: '모두 낮 종료하면 탐색 해결', resolution: '준비된 탐색을 왼쪽부터 해결하면 밤', maintenance: '모두 밤 종료하면 다음 낮' }

function effectSymbols(text) {
  return text.split(/((?:주사위|통조림|병뚜껑)(?:\s*[+-]?\d+(?:개)?)?)/g).map((part, i) => {
    const resource = part.match(/^(주사위|통조림|병뚜껑)(.*)$/)
    if (!resource) return part
    const [, name, amount] = resource
    return <span className="exp-effect-resource" key={i} role="img" aria-label={part}>{name === '주사위' ? <Icon name="dice" size={17}/> : <Token kind={name === '통조림' ? 'can' : 'cap'} small label={false}/>}<span>{amount.trim().replace('개', '')}</span></span>
  })
}

export function SurvivorFace({ card }) {
  const [effect, limit] = card.text.split(/ (?=파티당)/)
  return <article className="exp-card-front exp-survivor-face" data-exp-card="survivor" data-survivor-id={card.id} style={{ '--card-color': TYPE_COLORS[TYPES.indexOf(card.type)], '--card-paper': TYPE_PAPER_COLORS[TYPES.indexOf(card.type)] }}>
    <header className="exp-card-heading"><h3>{card.name.replace(' 생존자', '')}</h3><TypeBadge type={card.type}/></header>
    <div className="exp-portrait"><Portrait card={card}/></div>
    <div className="exp-ability"><small className="exp-ability-timing">{card.tier}등급 · {card.timing}</small><p>{effectSymbols(effect)}</p>{limit && <p className="exp-ability-limit">{limit}</p>}</div>
    <footer><span className="exp-card-score" aria-label={'점수 ' + cardScore(card)}><Token kind="score" value={cardScore(card)} small label={false}/></span><span aria-label={'영입 비용 병뚜껑 ' + card.cost}><Token kind="cap" value={card.cost} small label={false}/></span></footer>
  </article>
}
function Dialog({ title, children, close }) {
  const ref = useRef(null)
  useEffect(() => { const node = ref.current; node.showModal(); return () => node.close() }, [])
  return createPortal(<dialog ref={ref} className="paper-dialog exp-dialog" aria-label={title} onCancel={e => { e.preventDefault(); close?.() }} onClick={e => { if (e.target === e.currentTarget) close?.() }}><header><h2>{title}</h2>{close && <button className="icon-button" onClick={close} aria-label="닫기"><Icon name="close"/></button>}</header>{children}</dialog>, document.body)
}
export function ExpeditionRules() {
  return <div className="rules-list exp-rule-copy">
    <p><b>출발 준비</b> 지도자 물자와 병뚜껑 4개 지원금으로 야영지에서 첫 파티를 영입합니다. 새 동료는 피로 상태이며 식사로 준비합니다. 모두 준비를 마치면 첫 낮을 시작합니다.</p>
    <p><b>진행 흐름</b> 낮의 생존자 활동 → 탐색 해결 → 밤의 야영지 정비 → 다음 낮. 낮·밤은 행동 단계이며 날짜 제한이나 8일 마감은 없습니다. 미완성 탐색은 계속 남고, 탐색 덱을 다 쓰면 지나간 탐색을 순서대로 다시 사용합니다.</p>
    <p><b>파견</b> 내 낮 턴에 준비된 동료의 파견·능력 사용을 가능한 만큼 진행합니다. 한 번에 파견하는 동료는 1~2명입니다. 낮 종료를 누르면 다음 플레이어의 낮 턴으로 넘어갑니다. 안전한 탐색은 보유 생존자가 없을 때 지도자로 하루 한 번 통조림 1개와 병뚜껑 1개를 얻습니다. 파견 중이거나 피로한 생존자가 있어도 사용할 수 없습니다. 선착순은 조건 충족 즉시 배치 순서대로 남은 보상 중 한 묶음씩 선택합니다. 그 외 탐색은 모든 파티가 낮 종료를 선언한 뒤 준비된 장소를 왼쪽부터 해결합니다. 미완성 탐색은 동료를 남겨 다음 파견 계속합니다. 정산된 탐색의 동료는 즉시 피로 상태로 파티에 돌아옵니다.</p>
    <p><b>조건과 성과</b> 모든 파티가 인원과 타입을 함께 채웁니다. 출발 재화 비용은 없습니다. 사람 한 명은 타입 조건 하나를 담당합니다. 주사위는 파견자마다 1개이며 카드 효과와 앞쪽 용감이 최고 눈 보너스를 적용합니다. 나눔은 모든 주사위를 높은 눈부터 나열해 주사위 하나당 남은 보상 한 묶음을 선택합니다. 내 눈이 6·4, 상대가 2라면 내가 두 번 먼저 선택합니다. 같은 눈은 먼저 참가한 파티가 우선하며 보상이 소진되면 남은 차례는 건너뜁니다. 전체 획득형은 기존대로 파티별 높은 눈부터 비교해 1위가 모두 가져갑니다. 공통 참가 식량은 없습니다.</p>
    <p><b>금기와 혼란</b> 인쇄된 금지 타입이 참가하면 즉시 실패하거나 마지막 보상 묶음이 제거됩니다. 제거는 같은 타입이 여러 명이어도 한 번이며 인쇄된 보상 순서를 따릅니다. 요정은 부족한 타입 하나를 대신하지만 금기는 원래 타입으로 판정합니다. 확률 마법사는 출발 준비 후 1~3이면 실패, 4~6이면 통조림·병뚜껑 수량을 두 배로 합니다. 여정·구조 수량은 늘어나지 않습니다. 동행하거나 거점에서 준비된 용사의 반격으로 실패를 취소할 수 있지만 용사는 낙오합니다. 실패한 탐색은 보상 없이 끝납니다.</p>
    <p><b>카드 표식</b> 파견 인원 숫자의 +는 그 인원 이상이 필요하다는 뜻입니다. 기호 아래 작은 이름은 필요한 생존자 타입입니다. 조건 칸에는 타입만 표시합니다. 특이사항의 금기 타입 아래 취소된 탐색 그림은 그 타입 참가 시 즉시 실패입니다. 취소선이 그어진 재화와 수량은 그 타입 참가 시 잃는 마지막 보상 한 묶음입니다. 왕관을 쓴 한 사람은 1위 파티의 독식입니다.</p>
    <p><b>탐색 타입과 구조</b> 보급은 물자, 정찰은 여정 전진, 대규모 탐색은 많은 동료, 쟁탈은 1위 파티 독식, 보물 찾기는 주사위 없이 배치 순서, 구조는 공개 생존자 영입입니다. 구조 보상 하나마다 공개 생존자 1명을 비용 없이 선택하고 바로 보충합니다. 한 탐색에서 최대 2명을 구조하며 각각 별도 보상입니다. 빈자리가 없으면 내 동료를 내보내고 교체하거나 보상을 포기합니다. 합류한 동료는 밤에 식사해야 합니다.</p>
    <p><b>귀환과 위험</b> 탐색 정산이 끝나면 동료는 비용 없이 피로 상태로 파티에 돌아옵니다. 미완성 탐색은 다음 낮까지 유지하며 밤에 중단하고 귀환할 수도 있습니다. 모든 주사위 탐색에서 내 최종 눈에 1이 있으면 첫 파견자가 실종됩니다. 보호 능력으로 막을 수 있으며, 선착순은 주사위를 굴리지 않습니다. 실종·방출된 동료는 생존자 수색 덱 맨 아래로 돌아갑니다.</p>
    <p><b>생존자 관리</b> 낮에는 준비된 동료로 파견·거점 능력 중 하나를 선택합니다. 거점 능력을 쓰면 피로해져 그 낮에 파견할 수 없습니다. 파견 능력은 해당 탐색에 보낸 동안만 사용합니다. 밤에는 지도자 보급을 받은 뒤 영입·식사·자리 변경·교환으로 다음 낮을 준비합니다. 능력으로 영입한 동료도 피로 상태이며 낮에는 식사할 수 없습니다.</p>
    <p><b>정비 중 식사</b> 식사는 생존자 한 명당 기본 통조림 {RULES.mealCost}개입니다. 면제·할인 능력과 배치를 적용한 실제 비용을 식사 버튼에 표시합니다. 밤에 카드 옆에서 식사를 주면 즉시 준비 상태가 됩니다. 먹이지 않은 동료는 피로를 유지합니다. 밤 종료는 별도이며 자동 회복이나 전원 강제 식사는 없습니다.</p>
    <p><b>지속 능력과 반격</b> 식사 할인은 피로한 동료도 거점에 있으면 적용합니다. 의사는 낮에 고른 내 동료의 이번 밤 식사를 무료로 하며 파견 중인 동료도 선택합니다. 반격은 상대 차례의 해당 실패에 응답하고, 대피소는 내 낮에 사용해 다음 사건까지 자기 파티를 재난의 불이익에서 보호합니다.</p>
    <p><b>자리와 관계</b> 앞 두 자리 반장은 재배치 비용을 줄이고 용감이는 탐색 최고 눈을 높입니다. 중앙 분위기메이커는 수색, 4차원은 장소 교체 식량을 줄입니다. 뒤쪽 겁쟁이는 식사 비용 −1입니다. 개와 고양이는 인접 불가, 카피바라·유령·쌍둥이는 지정 관계에 한해 한 자리에 최대 두 명을 놓습니다. 인원과 식사는 카드별로 셉니다.</p>
    <p><b>영입과 교환</b> 혼합 덱에서 세 후보를 공개합니다. 생존자 덱을 눌러 밤마다 한 번 선택적으로 추가 수색합니다. 소염은 예비 팬 한 명을 확보할 수 있습니다. HAL은 비공개 후보 두 장을 보고 영입합니다. 교환은 상대가 수락해야 하며 두 동료 모두 피로 상태로 합류합니다. 고철 교환소에 동료를 보내면 통조림 2와 병뚜껑 2의 물물교환을, 생존자 만남터에서는 거점 동료 한 명씩 교환을 제안할 수 있습니다. 상대는 파견하지 않아도 응답하며, 성사되면 양쪽 병뚜껑 +1입니다. 거절하면 장소는 미완성으로 남고 하루 한 번만 제안할 수 있습니다.</p>
    <p><b>사건</b> 여정 3·6·9·12·15·18칸을 어느 파티든 처음 지나거나 도착하면 진행도 아래 사건 덱을 한 장 공개합니다. 공개 전에는 재난인지 기적인지 알 수 없습니다. 환경 효과는 모든 파티에 적용되고 다음 사건을 공개할 때 교체됩니다. 사건은 적어도 한 번의 낮 전체에 적용됩니다. 그동안 지나친 사건 칸은 대기시키고, 다음 낮 시작에 한 장씩 공개합니다. 낮에 카드의 인원·타입을 갖춘 준비된 동료와 병뚜껑을 함께 사용하면 해결합니다. 먼저 해결한 한 파티만 유토피아에 자기 주사위를 놓거나 눈을 1 올립니다(최대 6). 동료는 피로해지며, 해결한 뒤에도 환경 효과는 유지됩니다.</p>
    <p><b>유토피아</b> 여정 {RULES.route}칸·서로 다른 타입의 준비된 동료 3명·통조림 3개로 낮의 내 차례에 하루 한 번 도전합니다. 파견자는 모두 귀환해야 합니다. 높은 주사위 3개 합계 + 유토피아에 놓인 내 주사위 눈이 {RULES.utopiaTarget} 이상이면 유토피아에 진입합니다. 추가 주사위도 굴리지만 높은 3개만 합산합니다. 20칸을 넘겨도 추가 보너스는 없습니다. 유토피아에 놓인 주사위는 굴리거나 소모하지 않습니다. 실패 시 여정과 보너스는 유지하고 동료는 피로합니다.</p>
    <p><b>승리</b> 처음 진입한 파티는 {RULES.utopiaFirst}점, 그 뒤 진입한 파티는 {RULES.utopiaLater}점을 받습니다. 첫 진입이 나오면 그날 낮·밤을 마저 진행하고, 다음 낮을 마지막 라운드로 진행합니다. 마지막 낮의 탐색 정산이 끝나면 여정을 마칩니다. 유토피아 진입 점수 + 동료 카드 점수 합(파견 중 포함) + 통조림·병뚜껑 각각 {RULES.suppliesPerPoint}개당 1점을 합산합니다. 최종 탐색 정산 후 여정 {RULES.route}칸 이상인 파티끼리 점수를 비교하고 미도달 파티는 탈락합니다. 유토피아 진입에 실패했어도 {RULES.route}칸에 도달했다면 점수로 승리할 수 있습니다. 진입한 파티는 그 뒤 행동하지 않고 밤 보급도 받지 않습니다.</p>
    <p><b>판 조작</b> 생존자를 탐색 카드로 끌어 놓거나 클릭 후 파견을 확인합니다. 카드 근처에서 낮 능력·밤 식사·영입을 선택합니다. 식사는 팝업에서 즉시 확정하고, 오른쪽 바에서는 낮·밤 종료를 선택합니다. 밤에 파티 안의 카드를 끌어 자리를 바꿉니다. 빈 바닥을 끌어 보드를 이동합니다. 구판 원정은 /expedition-v1에서 보존합니다.</p>
  </div>
}
// Player aid: the whole round on one card. Native <details> hides it to a tab at the bottom.
function PlayerAid() {
  const can = n => <Token kind="can" value={n} small label={false}/>
  return <details className="exp-player-aid" open>
    <summary>행동 요약</summary>
    <div className="exp-aid-body">
      <section><h3>1. 낮 · 생존자 행동</h3><ol>
        <li><b>생존자 파견</b><ul className="exp-aid-sub"><li>황무지 탐색</li><li>사건 해결</li><li>유토피아 도전</li></ul></li>
        <li><b>생존자 능력 사용</b></li><li><b>안전한 탐색</b> 생존자가 없을 때 지도자로 하루 1회</li>
      </ol><p>내 행동을 모두 마치면 <b>낮 종료 → 다음 플레이어</b></p>
      <div className="exp-aid-settle"><b>낮의 모든 차례가 끝나면 → 탐색 정산</b><p>주사위 → 높은 눈부터 보상 선택<br/>내 눈에 1이 있으면 첫 파견자 실종<br/>정산 후 피로 상태로 자동 귀환</p></div></section>
      <section><h3>2. 밤 · 파티 정비</h3><ol>

        <li><b>생존자 영입</b></li>
        <li><b>파티 정비</b><ul className="exp-aid-sub"><li>생존자 자리 변경</li><li>피로한 생존자 식사 제공</li></ul></li>
      </ol><p>내 정비를 모두 마치면 <b>밤 종료 → 다음 플레이어</b></p>
      <div className="exp-aid-settle"><b>미완성 탐색</b><p>동료를 남기거나 비용 없이 귀환</p></div></section>
      <section className="exp-aid-utopia"><h3>유토피아 도전</h3><small>낮의 내 차례 행동 · 하루 한 번</small>
        <div className="exp-aid-goals"><span><b>{RULES.route}+</b>진행도</span><span><b>{RULES.escapePeople}명</b>준비 · 서로 다른 타입</span><span><b>{can(RULES.escapeFood)}</b>통조림 지불</span></div>
        <p>파견 동료가 모두 귀환한 상태에서 도전</p>
        <div className="exp-aid-roll"><span><Icon name="dice" size={15}/> 높은 주사위 {RULES.escapePeople}개 합</span><span>+ 사건으로 올린 유토피아 눈 <b>≥ {RULES.utopiaTarget}</b></span></div>
        <p><b>성공</b> 진입 · 이후 행동·밤 보급 종료<br/><b>실패</b> 참가 동료 피로 · 다음 낮부터 재도전</p>
        <small>실패해도 진행도·유토피아 눈은 유지</small></section>
      <footer><h3>승리 조건</h3>
        <p className="exp-aid-ending">첫 진입 → 그날 낮·밤을 마저 진행<br/><b>다음 낮의 탐색 정산 후 종료</b></p>
        <small>모두 진입하면 해당 낮의 정산 후 종료</small>
        <div className="exp-aid-qualification"><b>최종 진행도 {RULES.route}칸 이상만 점수 비교</b><span>미도달은 탈락 · 진입하지 않아도 참가</span></div>
        <dl className="exp-aid-score">
          <div><dt>진입</dt><dd>첫 {RULES.utopiaFirst}점 · 이후 {RULES.utopiaLater}점</dd></div>
          <div><dt>동료</dt><dd>카드 점수 합 <small>파견 중 포함</small></dd></div>
          <div><dt><Token kind="can" small label={false}/><Token kind="cap" small label={false}/></dt><dd>각각 {RULES.suppliesPerPoint}개당 1점</dd></div>
        </dl>
        <p><b>합계가 가장 높은 파티 승리</b></p>
        <small>동점이면 진입 점수 비교 · 같으면 공동 승리</small>
      </footer>
    </div>
  </details>
}
function Results({ results, players }) {
  return <div className="exp-dice-results">{results.map(r => <div key={r.owner}><b style={{ color: players.find(p => p.seatId === r.owner).color }}>{players.find(p => p.seatId === r.owner).name}</b><div>{r.rolls.map((v, j) => <Die key={j} value={v}/>)}</div>{r.sorted && <small>최종 눈 · {r.sorted.join(' · ')}</small>}{r.notes.map(note => <small key={note}>{note}</small>)}{r.lost.length > 0 && <small className="exp-loss">첫 파견자 실종</small>}</div>)}</div>
}

export default function ExpeditionBoard({ api }) {
  const { room, command, busy, connected } = api, g = room.game, me = g.players.find(p => p.seatId === room.me)
  const actor = g.players.find(p => p.seatId === actorId(g)), myTurn = actor.seatId === me.seatId && !g.gameEnded, actionable = myTurn && !busy && connected
  const [menu, setMenu] = useState(null), [historyOpen, setHistoryOpen] = useState(false), [utopiaResultOpen, setUtopiaResultOpen] = useState(false)
  const [settlementResults, setSettlementResults] = useState([]), [hiddenSettlement, setHiddenSettlement] = useState('')
  const settledResult = settlementResults[0]
  const [dragUid, setDragUid] = useState(null), [dropSlot, setDropSlot] = useState(null)
  const [utopiaUids, setUtopiaUids] = useState(null), [searchOpen, setSearchOpen] = useState(false)
  const [selected, setSelected] = useState(null), [siteId, setSiteId] = useState(null), [inspect, setInspect] = useState(null), [zoom, setZoom] = useState(1)
  const viewport = useRef(null), sitesRef = useRef(null), ownRef = useRef(null), campRef = useRef(null), othersRef = useRef(null), tableRef = useRef(null), pan = useRef(null)
  const q = g.pending, site = g.sites.find(s => s?.id === siteId), pendingSite = g.sites.find(s => s?.id === q?.siteId)
  const ownCard = me.party.find(c => c.uid === selected), dispatched = g.sites.flatMap(s => s ? s.crew.map(c => ({ card: c, site: s })) : []).find(x => x.card.uid === selected)
  const management = ['setup', 'maintenance'].includes(g.phase), dispatching = g.phase === 'dispatch'
  const [companion, setCompanion] = useState('')
  const rescuePrize = q?.stage === 'reward' ? q.prizes.find(prize => prize.kind === 'survivor')?.id : null
  const [rescueReplace, setRescueReplace] = useState('')
  const pendingKey = q ? q.at + '-' + q.omenId + '-' + q.siteId + '-' + q.stage + '-' + q.index + '-' + q.actor : ''
  useEffect(() => { setSelected(null); setSiteId(null); setUtopiaUids(null); setSearchOpen(false); setCompanion(''); setRescueReplace(''); setMenu(null) }, [g.currentPlayerIndex, g.turnInDay, g.day, g.phase, pendingKey])
  async function act(c) {
    if (busy) return false
    const ok = await command(c)
    if (ok) {
      setMenu(current => current === menu ? null : current)
      setSelected(current => current === selected ? null : current)
      if (!['roll', 'claim'].includes(c.type)) setSiteId(current => current === siteId ? null : current)
    }
    return ok
  }
  async function dispatchSurvivor(uid, targetId, partner = '') {
    if (!connected) { api.setError('서버에 다시 연결된 뒤 파견할 수 있습니다.'); return }
    if (busy) return
    if (!myTurn || q || !dispatching) { api.setError('지금은 ' + actor.name + '의 ' + (q ? '탐색 결과·반격 선택' : '행동') + ' 차례입니다.'); return }
    const card = me.party.find(c => c.uid === uid)
    if (!card?.ready) { api.setError('내 거점의 활성 동료를 선택하세요. 피로한 동료는 밤에 식사해야 합니다.'); return }
    await act({ type: 'dispatch', siteId: targetId, uids: [uid, ...(partner && partner !== uid ? [partner] : [])] })
  }
  function selectCard(card, owner, anchor, keyboard) {
    if (!myTurn || g.gameEnded || (owner && owner !== me.seatId) || (!owner && !management && !rescuePrize)) setInspect({ card })
    else { setSelected(card.uid); setCompanion(''); setMenu({ anchor, kind: 'card', keyboard }) }
  }
  function selectSite(s, anchor, keyboard = false) {
    setSiteId(s.id); setMenu({ anchor, kind: 'site', keyboard })
  }
  useEffect(() => {
    if (!['eventDraw','eventReveal'].includes(q?.stage)) return
    const node = document.querySelector(q.stage === 'eventDraw' ? '.exp-event-deck' : '.exp-event-open')
    node?.scrollIntoView({block:'nearest',inline:'nearest'})
    if (q.stage === 'eventReveal' && node) setMenu({anchor:node,kind:'event'})
  }, [pendingKey])
  const resultKey = JSON.stringify(g.lastResult), seenResult = useRef(resultKey)
  useEffect(() => {
    if (seenResult.current === resultKey) return
    seenResult.current = resultKey
    if (g.lastResult) { setSettlementResults(results => [...results, g.lastResult]); setMenu(null) }
  }, [resultKey])
  const utopiaKey = JSON.stringify(g.lastUtopia), seenUtopia = useRef(utopiaKey)
  useEffect(() => { if (seenUtopia.current !== utopiaKey) { seenUtopia.current = utopiaKey; if (g.lastUtopia) setUtopiaResultOpen(true) } }, [utopiaKey])
  function piece(card, owner, options = {}) {
    const isOwn = owner === me.seatId
    return <div className={'exp-piece ' + (options.resting ? 'exp-resting ' : '') + (options.tucked ? 'exp-paired-underlay' : '')} key={card.uid} data-uid={card.uid}>
      <button className={'exp-card-button ' + ((selected === card.uid) ? 'is-selected' : '')} aria-label={card.name + (isOwn ? ' · 내 동료' : '')} aria-pressed={selected === card.uid}
        draggable={Boolean(isOwn && actionable && !q && !options.deployed && !me.escaped && ((dispatching && card.ready) || (management && !g.sites.some(s => s?.crew.some(c => c.owner === me.seatId && c.slot === card.slot)))))} onDragStart={e => { e.dataTransfer.setData('text/plain', card.uid); e.dataTransfer.effectAllowed = 'move'; setSelected(card.uid); setDragUid(card.uid); setMenu(null); api.setError('') }} onDragEnd={() => { setDragUid(null); setDropSlot(null) }}
        onClick={e => selectCard(card, owner, e.currentTarget, e.detail === 0)}><SurvivorFace card={card}/></button>
      {owner && <span className="exp-owner" style={{ background: g.players.find(p => p.seatId === owner).color }}>{g.players.find(p => p.seatId === owner).name}{options.resting ? ' · 휴식' : ''}</span>}
      {options.deployed && <small className="exp-deployed-label">파견 중</small>}
      {!options.stacked && <button className="exp-inspect" onClick={() => setInspect({ card })} aria-label={card.name + ' 크게 보기'}>카드 크게 보기</button>}
    </div>
  }
  function partySlots(player) {
    const away = g.sites.flatMap(s => s?.crew.filter(c => c.owner === player.seatId) ?? [])
    const cards = [...player.party, ...away]
    return <div className="exp-party-slots" aria-label={player.name + ' 파티 ' + partyLimit(player) + '자리'}>{Array.from({ length: partyLimit(player) }, (_, i) => {
      const group = cards.filter(c => c.slot === i).sort((a,b) => Number(['ghost','capybara'].includes(a.ability)) - Number(['ghost','capybara'].includes(b.ability))), resting = group.length > 0 && !group[0].owner && !group[0].ready
      return <div className={'exp-party-slot ' + (resting ? 'is-resting ' : '') + (group.length > 1 ? 'is-paired ' : '') + (dropSlot === i && player === me ? 'is-drop-slot' : '')} key={i} data-party-slot={i + 1}
        onDragOver={e => { const card = me.party.find(c => c.uid === dragUid); if (player === me && actionable && management && !q && card && card.slot !== i && !away.some(c => [card.slot, i].includes(c.slot))) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropSlot(i) } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropSlot(null) }}
        onDrop={e => { if (player !== me || !actionable || !management || q) return; e.preventDefault(); e.stopPropagation(); const card = me.party.find(c => c.uid === e.dataTransfer.getData('text/plain')); setDropSlot(null); setDragUid(null); if (card && card.slot !== i && !away.some(c => [card.slot, i].includes(c.slot))) act({ type: 'reorder', from: card.slot, to: i }) }}>
        {dropSlot === i && player === me && <span className="exp-slot-drop-cost">자리 교환 · <Token kind="cap" value={reorderCost(me)} small label={false}/></span>}<small className="exp-slot-number">{i + 1} · {i < 2 ? '앞' : i === 2 ? '중앙' : '뒤'}</small>{group.length ? <div className={group.length > 1 ? 'exp-party-stack' : undefined}>{group.map((card,index) => away.some(c => c.uid === card.uid) ? <div className="exp-slot-empty" key={card.uid}><Icon name="camp"/><b>{card.name}</b><span>파견 중 · 자리 유지</span></div> : piece(card, player.seatId, { resting: !card.ready, tucked: index > 0, stacked: group.length > 1 }))}</div> : <div className="exp-slot-empty"><Icon name="people"/><b>빈자리</b><span>생존자를 영입하세요</span></div>}<small className="exp-placement-label">{placementLabel(i)}</small></div>
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
  const utopiaCrew = utopiaUids === null ? escapeCrew(me).map(c => c.uid) : utopiaUids.filter(uid => activeCrew.some(c => c.uid === uid))
  const losingDisaster = q?.stage === 'disaster' ? g.lastOmen : null
  const escapeAllowed = canEscape(g, me, activeCrew.filter(c => utopiaCrew.includes(c.uid)))
  function crewChoices(cards, chosen, setChosen, max) {
    return <div className="exp-crew-choices">{cards.map(c => <label key={c.uid}><input type="checkbox" checked={chosen.includes(c.uid)} disabled={!actionable || (!chosen.includes(c.uid) && chosen.length >= max)} onChange={() => setChosen(chosen.includes(c.uid) ? chosen.filter(uid => uid !== c.uid) : [...chosen, c.uid])}/><span>{c.name.replace(' 생존자', '')}<small>{c.type}{c.owner ? ' · 파견 중' : ''}</small></span></label>)}</div>
  }
  const escapeAction = !me.escaped && <div className="exp-escape"><h3>유토피아 도전</h3><p>여정 {me.route}/{RULES.route}칸 · 식량 {me.resources.can}/3<br/>서로 다른 타입 3명 · 전원 귀환 필요</p><p>높은 주사위 3개 + 사건 {eventBonus(me)} ≥ {RULES.utopiaTarget}<br/>낮의 내 차례에 하루 한 번 · 준비된 동료로 도전</p><p>진입하면 +{g.finalDay ? RULES.utopiaLater : RULES.utopiaFirst}점{g.finalDay ? '' : ' · 다음 낮이 마지막 라운드'}</p>{me.route >= RULES.route && crewChoices(activeCrew, utopiaCrew, setUtopiaUids, RULES.escapePeople)}{me.escapeDay === g.day && <small>다음 낮부터 다시 도전할 수 있습니다.</small>}<button className="primary-button" disabled={!actionable || !escapeAllowed} onClick={() => act({ type: 'escape', uids: utopiaCrew })}>유토피아 도전 · 식량 3</button></div>
  const stageLabel = g.gameEnded ? '여정 종료' : q?.stage === 'eventDraw' ? '사건 공개' : q?.stage === 'eventReveal' ? '사건 환경 적용' : q?.stage === 'counter' ? '반격 결정' : q?.stage === 'disaster' ? '재난 대응' : q?.stage === 'miracle' ? '기적 발견' : g.phase === 'setup' ? '출발 준비' : g.phase === 'dispatch' ? '낮 · 생존자 활동' : g.phase === 'resolution' ? '낮 · 탐색 해결' : '밤 · 야영지 정비'
  const leader = LEADERS.find(l => l.id === me.leaderId)
  const turnOrder = [...g.players.slice(g.firstPlayer), ...g.players.slice(0, g.firstPlayer)]
  const doneLabel = p => dispatching ? p.passed && '낮 종료' : management && g.managementDone.includes(p.seatId) && (g.phase === 'setup' ? '준비 완료' : '밤 종료')
  const partyState = p => p.escaped ? '진입' : p.seatId === actor.seatId ? '차례' : doneLabel(p) || '대기'
  const rescueCard = g.market.find(c => c?.uid === selected), rescueCrew = ownedCrew(g, me.seatId)
  const rescueFits = rescueCard && joinSlot({ ...me, party: rescueCrew.filter(c => c.uid !== rescueReplace) }, rescueCard) >= 0
  const stepLabel = g.gameEnded ? '최종 점수' : q ? ({ eventDraw:'진행도 아래 사건 덱에서 1장', eventReveal:'공개된 동안 모든 파티에 적용', counter: '탐색 실패를 막을지 선택', roll: '주사위 굴리기', reward: '보상 선택', return: '동료 귀환', miracle: '모든 파티에 적용 완료', disaster: '지불 · 동료 사용 · 피해 선택', trade: '생존자 교환 결정', barter: '물물교환 결정', leader: '지도자 능력 선택' })[q.stage] : management ? '영입 · 식사 · 자리 변경' : '파견 · 거점 능력 '
  return <div className="exp-game exp-current" data-exp-day={g.day} data-exp-stage={q?.stage ?? g.phase} data-exp-actor={actor.seatId} data-exp-me={me.seatId}>
    <div className="exp-toolbar"><div><b>공동 파견</b><span>{q ? actor.name + '의 ' + ({ eventDraw:'사건 공개', eventReveal:'사건 확인', counter: '반격', roll: '주사위', reward: '보상 선택', return: '귀환 결정', miracle: '기적 확인', disaster: '재난 대응', trade: '교환 결정', barter: '물물교환 결정', leader: '지도자 능력' })[q.stage] : actor.name + ' · ' + ({ setup: '출발 준비', dispatch: '낮 · 생존자 활동', resolution: '낮 · 탐색 해결', maintenance: '밤 · 야영지 정비' })[g.phase]}</span></div>
      <nav aria-label="보드 이동"><button onClick={() => setZoom(z => Math.max(.35, +(z - .1).toFixed(2)))} aria-label="축소">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(1.4, +(z + .1).toFixed(2)))} aria-label="확대">＋</button><button onClick={fitBoard}>전체 판</button><button onClick={() => jump(sitesRef)}>공동 탐색</button><button onClick={() => jump(ownRef)}>내 파티</button><button onClick={() => jump(campRef)}>야영지</button><button onClick={() => jump(othersRef)}>상대 파티</button><button onClick={() => setHistoryOpen(true)}>최근 판정·기록</button><button onClick={api.exit}>방 나가기</button></nav>
    </div>
    <div className="exp-phase-strip" aria-label="행동 단계">{[["setup", "출발 준비"], ["dispatch", "낮 · 생존자 활동"], ["resolution", "낮 · 탐색 해결"], ["maintenance", "밤 · 야영지 정비"]].map(([key, label]) => <span key={key} aria-current={g.phase === key ? "step" : undefined}>{label}</span>)}</div><div className="exp-layout"><div className="exp-viewport" ref={viewport} onPointerDown={beginPan} onPointerMove={e => { if (!pan.current) return; viewport.current.scrollLeft = pan.current.left - (e.clientX - pan.current.x); viewport.current.scrollTop = pan.current.top - (e.clientY - pan.current.y) }} onPointerUp={() => { pan.current = null }} onPointerCancel={() => { pan.current = null }}>
      <main ref={tableRef} className="exp-table exp-facing-table" style={{ zoom, '--table-width': (g.players.length === 2 ? 2400 : g.players.length === 3 ? 2600 : 2800) + 'px' }}>
        <JourneyBoard game={g} actionable={actionable} onDraw={() => act({type:'drawEvent'})} onEvent={e => setMenu({anchor:e.currentTarget,kind:'event',keyboard:e.detail===0})} canAttempt={myTurn && !me.escaped && me.route >= RULES.route && g.phase === 'dispatch' && !q && !g.gameEnded} onAttempt={e => setMenu({ anchor: e.currentTarget, kind: 'utopia', keyboard: e.detail === 0 })}/>



        <section ref={othersRef} className="exp-far-side" aria-label="상대 파티"><div className="exp-section-label"><h2>맞은편 파티</h2><p>함께 탐색하고, 유토피아에서 더 높은 점수를 노리세요.</p></div><div className="exp-opponents">{g.players.filter(p => p.seatId !== me.seatId).map(p => <div className="exp-opponent" key={p.seatId} data-seat={p.seatId} style={{ '--pawn': p.color }}><header><b>{p.name}{p.escaped ? ' · 유토피아 진입' : ''}</b><span>거점 {p.party.length} · 파견 {crewCount(g, p.seatId) - p.party.length}</span></header><div className="exp-opponent-inner">{partySlots(p)}<div className="exp-opponent-supplies"><Token kind="can" value={p.resources.can}/><Token kind="cap" value={p.resources.bottleCap}/></div></div></div>)}</div></section>
        <section ref={sitesRef} className="exp-sites-section"><div className="exp-section-label"><h2>함께 가는 탐색</h2><p>보물 찾기는 조건 충족 즉시, 교환소는 상대 수락 시, 다른 탐색은 낮 종료 후 해결합니다.</p></div><div className="exp-sites">

          <div className="exp-deck"><div className="exp-deck-face"><Icon name="book" size={54}/><strong>황무지 탐색</strong><span>위 1 · 중간 2 · 아래 3</span><small>각 단계 안에서 섞어 한 덱으로</small><b>{g.deck.length}장 남음</b></div><p>모든 파티가<br/>함께 탐색할 수 있습니다</p></div>
          {g.sites.map((s, i) => s ? <div className={'exp-site ' + (siteId === s.id ? 'is-target' : '') + (q?.siteId === s.id ? 'is-resolving' : '')} key={s.id} data-site={s.id}
            onDragOver={e => { if (actionable && dispatching && !q && !s.resolved) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }} onDrop={e => { e.preventDefault(); const uid = e.dataTransfer.getData('text/plain'); if (uid) dispatchSurvivor(uid, s.id) }}>
            <div className="exp-site-cards" style={{ '--crew-count': s.crew.length }}><button className="exp-place-button" onClick={e => selectSite(s, e.currentTarget, e.detail === 0)} aria-label={s.card.name + ' 탐색지 선택'} aria-pressed={siteId === s.id}><PlaceFace card={s.card}/></button>
            <div className="exp-assignees">{s.crew.map((c, index) => <div className="exp-assignee" key={c.uid} style={{ '--stack-order': index + 1 }}>{piece(c, c.owner, { deployed: true, stacked: true })}</div>)}</div></div>
            <div className="exp-site-state"><b>인원 {s.crew.length}/{s.card.people ?? s.card.roles.length}명</b><small>{s.failed ? '탐색 실패 · ' + s.failed : s.resolved ? '탐색 완료 · 동료 귀환' : requirements(s).ready ? s.card.interaction ? '교환 제안 가능 · 장소 선택' : '출발 준비 완료' : ['추가 인원 ' + requirements(s).people + '명', requirements(s).missing.length ? '필요 타입: ' + requirements(s).missing.map(t => t === '*' ? '아무나' : t).join(' · ') : '타입 충족'].join(' / ')}</small>{s.hazardCancelled && <small>반격으로 타입 금기 무효 · 이번 탐색</small>}{s.chaosRoll && <span className="exp-chaos-result"><Die value={s.chaosRoll}/>{s.chaosRoll >= 4 ? '통조림·병뚜껑 ×2' : s.failed ? '도박 실패' : '실패 취소 · 기본 보상'}</span>}{s.card.hazard?.effect === 'lastReward' && locationPrizes(s.card).length > explorationPrizes(s).length && <small className="exp-loss">마지막 보상 묶음 제거됨</small>}</div>
            {!s.crew.length && <div className="exp-drop-hint">파견 · 한 번에 동료 1~{dispatchLimit(g,me)}명</div>}
          </div> : <div className="exp-empty-place" key={'empty-' + i}>탐색을 마친 자리<br/><small>남은 장소 없음</small></div>)}
        </div></section>
        <section ref={ownRef} className="exp-camp-own" style={{ '--pawn': me.color }}><div className="exp-section-label"><h2>{me.name} · 내 파티</h2><p>활성 {activeCount} · 파견 {awayCount} · 휴식 {me.party.length - activeCount} / {partyLimit(me)}자리</p></div><div className="exp-own-inner"><div className="exp-leader-note"><Portrait card={leader}/><strong>{leader.name}</strong>{crewCount(g, me.seatId) === 0 && !me.escaped && !g.gameEnded && <button className="exp-leader-forage" disabled={!actionable || !dispatching || Boolean(q) || me.forageDay === g.day} onClick={() => act({ type: 'forage' })}>{me.forageDay === g.day ? '안전한 탐색 완료' : '안전한 탐색'}<span><Token kind="can" value={1 + eventModifier(g,me,'forageCan')} small label={false}/><Token kind="cap" value={1 + eventModifier(g,me,'forageCap')} small label={false}/></span></button>}</div>{partySlots(me)}<div className="exp-clue-pocket"><b>지나온 장소</b>{me.discoveries.map(c => <button key={c.uid} onClick={() => setInspect({ place: c })} aria-label={c.name + ' 지나온 장소 크게 보기'}><PlaceFace card={c}/></button>)}</div></div></section>

        <section ref={campRef} className="exp-recruit-section"><div><div className="exp-section-label"><h2>야영지</h2><p>밤에 새 동료를 영입하고 식사로 준비</p></div><div className="exp-recruit-row"><button className="exp-search-deck" aria-label="생존자 수색" onClick={() => setSearchOpen(true)}><div className="exp-small-deck"><Icon name="people" size={36}/><b>생존자 수색</b><small>{g.recruitDeck.length}장</small></div></button>{g.market.filter(Boolean).map(c => piece(c, null))}</div>{me.candidates.length > 0 && <><h3>HAL · 나만 보는 후보</h3><div className="exp-recruit-row">{me.candidates.filter(Boolean).map(c => piece(c, null))}</div></>}{me.fans.length > 0 && <><h3>예비 팬클럽 · {me.fans.length}/3</h3><div className="exp-recruit-row">{me.fans.map(c => piece(c, null))}</div></>}</div></section>

      </main>
    </div><aside className="exp-actions" aria-label="지도자와 진행 상황">
      <header className="exp-my-supplies" aria-label="내 지도자와 보유 재화"><Portrait card={leader}/><div><small>{me.name} · 내 지도자</small><b>{leader.name}</b></div><div><Token kind="can" value={me.resources.can}/><Token kind="cap" value={me.resources.bottleCap}/></div></header>
      <section className="exp-action-status"><small>{g.gameEnded ? '여정 종료' : myTurn ? '내 차례' : actor.name + ' 차례'}</small><h2>{stageLabel}</h2><b>{stepLabel}</b><p>{g.gameEnded ? RULES.route + '칸 이상인 파티만 점수 비교 · 미도달은 탈락. 진입 점수 + 동료 점수 + 통조림·병뚜껑 각각 ' + RULES.suppliesPerPoint + '개당 1점. 동점이면 진입 점수가 높은 파티가 앞섭니다.' : q?.stage === 'eventDraw' ? '진행도 아래 사건 덱을 눌러 한 장 공개하세요.' : q?.stage === 'eventReveal' ? '공개된 사건 카드 옆에서 효과를 확인하세요.' : q?.stage === 'return' ? '진행 중인 탐색의 동료를 선택하세요.' : q?.stage === 'disaster' ? myTurn ? '재난 팝업에서 대응을 선택하세요.' : actor.name + '의 재난 대응을 기다립니다.' : q?.stage === 'miracle' ? '기적이 모든 파티에 적용됐습니다. 확인 후 탐색을 이어갑니다.' : q?.stage === 'reward' ? '탐색 카드 옆에서 남은 보상을 하나 선택하세요. 구조 보상은 공개 동료를 클릭합니다.' : q?.stage === 'roll' ? '판정할 탐색 카드 옆에서 주사위를 굴리세요.' : ['trade', 'barter'].includes(q?.stage) ? '교환 제안에 답할 차례입니다.' : q?.stage === 'counter' ? '팝업에서 반격 여부를 결정하세요.' : management ? me.escaped ? '유토피아에 진입했습니다. 밤 종료 후 여정이 끝나기를 기다리세요.' : awayCount ? '돌아온 동료에게 식사를 주세요. 미완성 탐색의 동료는 남기거나 귀환시킬 수 있습니다.' : '야영지에서 영입하고 동료 카드에서 식사를 주세요. 회복한 동료는 다음 낮에 활동합니다.' : '파견·능력을 가능한 만큼 진행한 뒤 낮 종료를 누르세요. 다음 플레이어에게 턴이 넘어갑니다.'}</p>
      {['roll','reward'].includes(q?.stage) && <button className="secondary-button" onClick={() => {setHiddenSettlement('');setMenu(null)}}>탐색 정산 보기</button>}
      {g.gameEnded ?<><table className="exp-standings"><thead><tr><th>순위</th><th>파티</th><th>진입</th><th>동료</th><th>물자</th><th>합계</th></tr></thead><tbody>{g.standings.map(p => <tr key={p.seatId}><td>{p.eligible === false ? '탈락' : p.rank}</td><th>{p.name}<small>{p.eligible === false ? p.route + '칸 · 미도달' : p.escaped ? '유토피아 진입' : '도전 가능 구역'}</small></th><td>{p.eligible === false ? '—' : p.utopia}</td><td>{p.eligible === false ? '—' : p.party}</td><td>{p.eligible === false ? '—' : p.supplies}</td><td><b>{p.eligible === false ? '—' : p.total}</b></td></tr>)}</tbody></table><button className="primary-button" onClick={api.exit}>새 여정 준비</button></> : !q && management ? <div className="exp-phase-end">{myTurn && <><button className="primary-button" disabled={!actionable} onClick={() => act({ type: 'endManagement', uids: [] })}>{g.phase === 'setup' ? '출발 준비 완료' : '밤 종료'}</button></>}</div> : !q && dispatching && myTurn && <div className="exp-phase-end"><button className="primary-button" disabled={!actionable} onClick={() => act({ type: 'pass' })}>낮 종료</button></div>}</section>
      {!g.gameEnded && myTurn && q?.stage === 'leader' && <PendingManagement game={g} me={me} actionable={actionable} act={act}/>}
      {!g.gameEnded && <section className="exp-turn-order" aria-label="진행 순서"><h3>진행 순서</h3><ol>{turnOrder.map(p => <li key={p.seatId} style={{ '--pawn': p.color }} aria-current={p.seatId === actor.seatId ? 'step' : undefined}><i className="exp-pawn"/><b>{p.name}{p === me && ' · 나'}</b><span>{partyState(p)}</span></li>)}</ol><small>{NEXT_PHASE[g.phase]}</small>{g.finalDay && <b className="exp-final-round">{g.day >= g.finalDay ? '마지막 낮 · 정산 후 ' + RULES.route + '칸 미도달은 탈락' : '다음 낮이 마지막 라운드'}</b>}</section>}
      <LeaderActions game={g} me={me}/>
    </aside></div>
    {menu && <CardMenu anchor={menu.anchor} viewport={viewport} title={menu.kind === 'event' ? g.activeEvent?.card.name ?? '사건' : menu.kind === 'utopia' ? '유토피아 도전' : menu.kind === 'site' ? site?.card.name ?? '탐색' : ownCard?.name ?? dispatched?.card.name ?? [...g.market, ...me.fans, ...me.candidates].find(c => c?.uid === selected)?.name ?? '생존자 카드'} close={() => setMenu(null)} zoom={zoom} keyboard={menu.keyboard}>
      {menu.kind === 'event' ? <EventActions key={g.activeEvent?.serial} game={g} me={me} actionable={actionable} act={act}/> : menu.kind === 'utopia' ? escapeAction : menu.kind === 'site' ? <>
        {q?.siteId === siteId ? <><p>{distributionText(site.card)}</p>{q.results && <Results results={q.results} players={g.players}/>} {q.stage === 'roll' && <button className="primary-button" disabled={!actionable} onClick={() => act({ type: 'roll' })}>탐색 주사위 굴리기</button>}{q.stage === 'reward' && <div className="exp-prize-actions"><b>{actor.name} · {q.firstCome ? '배치 순서 ' + (q.index + 1) : '주사위 ' + q.picks[q.index].value} · 보상 선택</b>{q.prizes.filter(prize => prize.kind !== 'survivor').map(prize => <button className="secondary-button" key={prize.id} disabled={!actionable} onClick={() => act({ type: 'claim', prize: prize.id })}><Token kind={resourceKind(prize.kind)} value={prize.amount} small/><span>획득</span></button>)}{rescuePrize && <><button className="primary-button" disabled={!actionable} onClick={() => { setMenu(null); jump(campRef) }}><Icon name="people" size={20}/>구조 · 공개 동료 선택</button><button className="text-button" disabled={!actionable} onClick={() => act({ type: 'claim', prize: rescuePrize, decline: true })}>영입하지 않고 이 보상 넘기기</button></>}</div>}</> : <>
          {site?.resolved ? <p>탐색 완료 · 동료는 피로 상태로 귀환했습니다.</p> : <>
            {dispatching && !q && ownCard?.ready ? <><b>{ownCard.name} 파견</b><label>함께 보낼 동료<select disabled={dispatchLimit(g,me) < 2} aria-label="함께 보낼 동료" value={companion} onChange={e => setCompanion(e.target.value)}><option value="">혼자 파견</option>{activeCrew.filter(c => c.uid !== ownCard.uid).map(c => <option key={c.uid} value={c.uid}>{c.name}</option>)}</select></label>{site?.card.hazard && <p className="exp-loss">{hazardText(site.card)}</p>}<button className="primary-button" disabled={!actionable} onClick={() => dispatchSurvivor(ownCard.uid, siteId, companion)}>파견 확인</button>{!site?.crew.length && <button disabled={!actionable || (!g.deck.length && !g.siteDiscard.length) || me.resources.can < (ownCard.type === '4차원' && ownCard.slot === 2 ? 0 : 1)} onClick={() => act({ type: 'replaceSite', uid: ownCard.uid, siteId })}>장소 교체 · 동료 사용 · 식량 {ownCard.type === '4차원' && ownCard.slot === 2 ? 0 : 1}</button>}</> : <p>내 파티의 준비된 동료를 선택한 뒤 파견하세요.</p>}
            {site?.card.interaction && dispatching && !q && <ExplorationTrade key={site.id} game={g} me={me} site={site} actionable={actionable} act={act}/>}
          </>}
          {g.lastResult?.name === site?.card.name && g.lastResult.day === g.day && <><b>탐색 결과</b><Results results={g.lastResult.results} players={g.players}/>{g.lastResult.failed && <p className="exp-loss">{g.lastResult.failed}</p>}{g.lastResult.choices.map(r => <small key={r.owner + r.id}>{g.players.find(p => p.seatId === r.owner).name} · {r.label} +{r.amount}</small>)}</>}
        </>}
      </> : <>
        {ownCard && !q && management && !me.escaped && <>
          {!ownCard.ready && <div className="exp-meal-action"><button className="primary-button" disabled={!actionable || mealCost(me, ownCard, g) > me.resources.can} onClick={() => act({ type: 'feed', uid: ownCard.uid })}>식사 · <Token kind="can" value={mealCost(me, ownCard, g)} small label={false}/></button><small>식사하면 준비 상태가 되어 다음 낮에 활동할 수 있습니다.</small></div>}
          <Management key={selected} game={g} me={me} selected={selected} actionable={actionable} act={act}/>
        </>}
        {ownCard && !q && dispatching && <>{ownCard.ready ? <><button className="primary-button" disabled={!actionable} onClick={() => { setMenu(null); jump(sitesRef) }}>파견할 장소 선택</button><AbilityActions key={ownCard.uid} game={g} me={me} card={ownCard} actionable={actionable} act={act} compact/>{site && <button disabled={!actionable || site.resolved} onClick={() => dispatchSurvivor(ownCard.uid, siteId)}>파견 확인 · {site.card.name}</button>}</> : <p>피로 상태 · 밤에 식사하면 다음 낮에 활동할 수 있습니다.</p>}</>}
        {dispatched?.card.owner === me.seatId && <>{management && !q && myTurn ? <><p>{dispatched.site.card.name} · 남기면 다음 낮에 탐색을 계속합니다.</p><button className="primary-button" disabled={!actionable} onClick={() => act({ type: 'returnOne', uid: selected })}>탐색 중단 · 귀환</button><small>비용 없이 피로 상태로 귀환합니다.</small></> : <>{!q && <AbilityActions key={selected} game={g} me={me} card={dispatched.card} actionable={actionable} act={act} compact/>}<small>정산이 끝나면 피로 상태로 자동 귀환합니다.</small></>}</>}

        {!ownCard && !dispatched && rescuePrize && rescueCard && <div className="exp-rescue-choice"><p>구조 보상 · 영입 비용 없음</p><label>자리 선택<select value={rescueReplace} onChange={e => setRescueReplace(e.target.value)}><option value="">빈자리·함께 쓰는 자리</option>{rescueCrew.map(c => <option key={c.uid} value={c.uid}>{c.name} 내보내고 교체{c.owner ? ' · 파견 중' : ''}</option>)}</select></label>{!rescueFits && <small>빈자리가 없습니다. 교체할 동료를 선택하세요.</small>}<button className="primary-button" disabled={!actionable || !rescueFits} onClick={() => act({ type: 'claim', prize: rescuePrize, uid: rescueCard.uid, replaceUid: rescueReplace || undefined })}>선택한 동료 데려오기</button><button className="text-button" disabled={!actionable} onClick={() => act({ type: 'claim', prize: rescuePrize, decline: true })}>영입하지 않고 이 보상 넘기기</button></div>}
        {!ownCard && !dispatched && !q && management && !me.escaped && <Management key={selected} game={g} me={me} selected={selected} actionable={actionable} act={act}/>}
        {!myTurn && <p>{actor.name}의 차례입니다.</p>}
        <button className="text-button" onClick={() => { const card = ownCard ?? dispatched?.card ?? [...g.market, ...me.fans, ...me.candidates].find(c => c?.uid === selected); if (card) { setInspect({ card }); setMenu(null) } }}>카드 크게 보기</button>
      </>}
    </CardMenu>}
    <GainToasts game={g} roomCode={room.code}/>
    <PlayerAid/>
    {!settledResult && ['roll','reward'].includes(q?.stage) && hiddenSettlement !== pendingKey && <Dialog title={(pendingSite?.card.name ?? '탐색') + ' · 정산'} close={() => setHiddenSettlement(pendingKey)}>
      <div className="exp-settlement">
        <div className="exp-settlement-steps"><span aria-current={q.stage === 'roll' ? 'step' : undefined}>1 주사위</span><span aria-current={q.stage === 'reward' ? 'step' : undefined}>2 보상 선택</span><span>3 결과 확인</span></div>
        <p>{distributionText(pendingSite.card)}</p>
        {q.results && <Results results={q.results} players={g.players}/>}
        {q.stage === 'roll' ? <><p>{actor.name}이 탐색 주사위를 굴립니다.</p><button className="primary-button" disabled={!actionable} onClick={() => act({type:'roll'})}>{busy ? '판정 중…' : myTurn ? '탐색 주사위 굴리기' : actor.name + '의 판정 대기'}</button></> : <>
          <h3>{myTurn ? '내 보상을 선택하세요' : actor.name + '의 보상 선택을 기다립니다'}</h3>
          {!q.firstCome && pendingSite.card.distribution !== 'all' && <div className="exp-pick-order" aria-label="보상 선택 순서">{q.picks.map((pick,i) => <span key={i} className={i < q.index ? 'is-done' : i === q.index ? 'is-current' : ''}><Die value={pick.value}/><b>{g.players.find(p => p.seatId === pick.owner).name}</b>{i < q.index ? '완료' : i === q.index ? '선택 중' : '대기'}</span>)}</div>}
          <div className="exp-prize-actions">{q.prizes.filter(prize => prize.kind !== 'survivor').map(prize => <button className="secondary-button" key={prize.id} disabled={!actionable} onClick={() => act({type:'claim',prize:prize.id})}><Token kind={resourceKind(prize.kind)} value={prize.amount}/><span>선택</span></button>)}</div>
          {rescuePrize && <button className="primary-button" disabled={!actionable} onClick={() => {setHiddenSettlement(pendingKey);jump(campRef)}}>구조 · 야영지에서 동료 선택</button>}
          {!!q.choices.length && <div className="exp-settlement-gains"><b>지금까지 획득</b>{q.choices.map((r,i) => <p key={i}>{g.players.find(p => p.seatId === r.owner).name} · {r.label} {r.amount > 0 ? '+' + r.amount : ''}</p>)}</div>}
        </>}
      </div>
    </Dialog>}
    {settledResult && <Dialog title={settledResult.name + ' · 탐색 결과'}><div className="exp-settlement">
      <h3 className={settledResult.failed ? 'exp-loss' : ''}>{settledResult.failed ? '탐색 실패' : '탐색 완료'}</h3>
      {settledResult.failed && <p>{settledResult.failed}</p>}
      <Results results={settledResult.results} players={g.players}/>
      <div className="exp-settlement-gains"><b>획득한 보상</b>{settledResult.choices.length ? settledResult.choices.map((r,i) => <p key={i}>{g.players.find(p => p.seatId === r.owner).name} · {r.label} {r.amount > 0 ? '+' + r.amount : ''}</p>) : <p>획득한 보상이 없습니다.</p>}</div>
      <p>실종되지 않은 파견 동료는 피로 상태로 파티에 돌아왔습니다.</p>
      <button className="primary-button" onClick={() => setSettlementResults(results => results.slice(1))}>결과 확인 · 계속하기</button>
    </div></Dialog>}
    {utopiaResultOpen && <Dialog title="유토피아 도전 결과" close={() => setUtopiaResultOpen(false)}><div className="exp-utopia-result"><h3>{g.lastUtopia.name} · {g.lastUtopia.success ? '유토피아 진입 +' + g.lastUtopia.points + '점' : '도전 실패'}</h3>{g.lastUtopia.first && <p>다음 낮이 마지막 라운드입니다.</p>}<div>{g.lastUtopia.rolls.map((v, i) => <Die value={v} key={i}/>)}</div><p>합계 {g.lastUtopia.total} / 목표 {g.lastUtopia.target}</p>{g.lastUtopia.notes.map(note => <small key={note}>{note}</small>)}<button className="primary-button" onClick={() => setUtopiaResultOpen(false)}>판으로 돌아가기</button></div></Dialog>}
    {historyOpen && <Dialog title="최근 판정·여정 기록" close={() => setHistoryOpen(false)}>{g.lastResult && <><h3>{g.lastResult.name}</h3>{g.lastResult.failed && <p className="exp-loss">{g.lastResult.failed}</p>}<Results results={g.lastResult.results} players={g.players}/>{g.lastResult.choices.map(r => <p key={r.owner + r.id}>{g.players.find(p => p.seatId === r.owner).name} · {r.label} +{r.amount}</p>)}</>}{g.lastUtopia && <div className="exp-utopia-result"><h3>{g.lastUtopia.name} · 유토피아 도전</h3><div>{g.lastUtopia.rolls.map((v, i) => <Die value={v} key={i}/>)}</div><p>합계 {g.lastUtopia.total} / {g.lastUtopia.target} · {g.lastUtopia.success ? '유토피아 진입 +' + g.lastUtopia.points + '점' : '실패'}</p></div>}<details className="exp-log"><summary>여정 기록</summary>{[...g.log].reverse().map((line, i) => <p key={i}>{line}</p>)}</details></Dialog>}
    {['trade', 'barter'].includes(q?.stage) && myTurn && <Dialog title="교환 제안"><PendingManagement game={g} me={me} actionable={actionable} act={act}/></Dialog>}
    {q?.stage === 'counter' && myTurn && <Dialog title="탐색 실패 · 반격 결정"><CounterActions game={g} me={me} actionable={actionable} act={act}/></Dialog>}
    {searchOpen && <Dialog title="생존자 수색" close={() => setSearchOpen(false)}><SearchActions game={g} me={me} actionable={actionable} act={async c => { if (await act(c)) setSearchOpen(false) }}/></Dialog>}
    {losingDisaster && <Dialog title={losingDisaster.name + ' · 재난 대응'}>{myTurn ? <DisasterActions key={q.at + '-' + q.omenId + '-' + actor.seatId} game={g} me={me} actionable={actionable} act={act}/> : <><OmenFace omen={{ tile: losingDisaster }} players={g.players}/><p>{actor.name}의 대응을 기다립니다.</p></>}</Dialog>}
    {q?.stage === 'miracle' && <Dialog title={g.lastOmen.name + ' · 기적'}><OmenFace omen={{ tile: g.lastOmen }}/><p>모든 파티에 적용됐습니다.</p><button className="primary-button" disabled={!actionable} onClick={() => act({ type: 'continueOmen' })}>{myTurn ? '확인 · 계속' : actor.name + ' 확인 중'}</button></Dialog>}
    {inspect && <Dialog title={inspect.card?.name ?? inspect.place?.name ?? inspect.omen.tile.name} close={() => setInspect(null)}><div className="exp-inspection">{inspect.card ? <SurvivorFace card={inspect.card}/> : inspect.omen ? <OmenFace omen={inspect.omen}/> : <PlaceFace card={inspect.place}/>}</div></Dialog>}
  </div>
}
