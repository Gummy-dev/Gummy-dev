import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../store/gameStore.js'
import { UTOPIA_CARDS } from '../data/utopias.js'
import PlayerPanel from './PlayerPanel.jsx'
import EventZone from './EventZone.jsx'
import MercenaryPool from './MercenaryPool.jsx'
import DiceRollModal from './DiceRollModal.jsx'
import SurvivorDiceModal from './SurvivorDiceModal.jsx'
import { PersonalIcon } from '../assets/personal-icons/index.jsx'
import '../tabletop/restored.css'

export default function GameBoard({ myIndex = 0, onExit }) {
  const {
    players, currentPlayerIndex, round, phase,
    resetGame, globalLog, actionEffects, dismissActionEffect,
    pendingTreasureUse, pendingTreasureReveal, confirmTreasureCardUse, cancelTreasureCardEffect, closeTreasureRevealPopup,
    gameEnded, finalRoundActive, winnerIds, finalStandings, finalReason, utopiaState,
  } = useGameStore()
  const [zoom, setZoom] = useState(1)
  const [actionsTarget, setActionsTarget] = useState(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const viewport = useRef(null)
  const ownParty = useRef(null)
  const opponentsArea = useRef(null)
  const explorationArea = useRef(null)
  const searchArea = useRef(null)
  const pan = useRef(null)
  const currentPlayer = players[currentPlayerIndex]
  const isMyTurn = currentPlayerIndex === myIndex && !currentPlayer?.isBot
  const myPlayer = players[myIndex]
  const opponents = players.filter((_, index) => index !== myIndex)
  const leave = onExit ?? resetGame
  const reachableTier = Math.min(3, Math.max(1, myPlayer?.unlockedExplorationTier ?? 1))

  function moveToReachable(section, rowSelector) {
    section.current?.querySelectorAll(rowSelector)[3 - reachableTier]?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  function startPan(event) {
    if (event.button !== 0 || event.target.closest('button, input, select, a, [role="button"], [draggable="true"], [data-board-card], .cursor-pointer, .cursor-grab')) return
    const el = viewport.current
    pan.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop }
    el.setPointerCapture(event.pointerId)
    el.classList.add('is-panning')
  }
  function movePan(event) {
    if (!pan.current) return
    viewport.current.scrollLeft = pan.current.left - event.clientX + pan.current.x
    viewport.current.scrollTop = pan.current.top - event.clientY + pan.current.y
  }
  function stopPan() {
    pan.current = null
    viewport.current?.classList.remove('is-panning')
  }

  return (
    <div className="restored-table">
      <header className="restored-toolbar">
        <div><h1>{round}라운드 · {currentPlayer?.name} 차례</h1><p>{finalRoundActive ? '최종 라운드 · ' : ''}{phase === 'action' ? '주변 탐색' : phase === 'party_maintenance' ? '파티 정비' : '진행 중'}</p></div>
        <div className="restored-view-controls">
          <button type="button" onClick={() => setZoom(value => Math.max(0.4, +(value - 0.1).toFixed(1)))} aria-label="보드 축소">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom(value => Math.min(1.5, +(value + 0.1).toFixed(1)))} aria-label="보드 확대">＋</button>
          <button type="button" onClick={() => setZoom(Math.max(0.25, Math.min(1.5, viewport.current.clientWidth / viewport.current.firstElementChild.offsetWidth)))}>가로 맞춤</button>
          <span className="restored-view-divider" aria-hidden="true" />
          <button type="button" onClick={() => opponentsArea.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>상대 파티</button>
          <button type="button" onClick={() => moveToReachable(explorationArea, '.restored-event-tier')}>{reachableTier}단계 탐색</button>
          <button type="button" onClick={() => moveToReachable(searchArea, '.restored-search-tier')}>{reachableTier}단계 수색</button>
          <button type="button" className="restored-actions-toggle" aria-expanded={actionsOpen} aria-controls="restored-sidebar" onClick={() => setActionsOpen(value => !value)}>테이블 행동</button>
          <button type="button" onClick={() => ownParty.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })}>내 파티</button>
          <button type="button" onClick={leave}>방 나가기</button>
        </div>
      </header>
      <main className="restored-table-layout">
        <div ref={viewport} className="restored-board-viewport" aria-label="게임 보드. 빈 공간을 끌어 이동" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onLostPointerCapture={stopPan}>
          <div className="restored-board-surface" style={{ zoom }}>
            <div ref={opponentsArea} className="restored-opponents">
              {opponents.map(player => {
                const playerIndex = players.indexOf(player)
                return <PlayerPanel key={player.id} player={player} playerIndex={playerIndex} isActive={playerIndex === currentPlayerIndex} isMyTurn={false} compact />
              })}
            </div>
            <div className="restored-shared-board">
              <section ref={explorationArea} className="restored-exploration" aria-label="주변 탐색"><h2>주변 탐색</h2><EventZone isMyTurn={isMyTurn} actionsTarget={actionsTarget} /></section>
              <section ref={searchArea} className="restored-search" aria-label="생존자 수색"><h2>생존자 수색</h2><MercenaryPool isMyTurn={isMyTurn} actionsTarget={actionsTarget} /></section>
            </div>
            <div ref={ownParty} className="restored-own-party"><PlayerPanel player={myPlayer} playerIndex={myIndex} isActive={isMyTurn} isMyTurn={isMyTurn} /></div>
          </div>
        </div>
        <aside id="restored-sidebar" className={`restored-sidebar ${actionsOpen ? 'is-open' : ''}`}>
          <h2>테이블 행동</h2>
          <div className="restored-turn-status"><strong>{isMyTurn ? '내 차례' : currentPlayer?.name + ' 차례'}</strong><span>{gameEnded ? '게임 종료' : phase === 'action' ? '행동 단계' : phase === 'party_maintenance' ? '파티 정비' : phase}</span><p>{isMyTurn ? phase === 'action' ? '탐색 카드를 고르고, 함께 보낼 동료를 선택하세요.' : '생존자를 영입하거나 동료에게 식사를 제공하세요.' : '다른 파티의 선택을 살피며 다음 차례를 준비하세요.'}</p></div>
          <div ref={setActionsTarget} id="restored-table-actions" />
          <p className="restored-pan-hint">빈 공간을 끌어 보드를 이동합니다.</p>
          <details className="restored-log"><summary>최근 기록</summary>{globalLog.map((msg, index) => <p key={index}>{msg}</p>)}</details>
        </aside>
      </main>
      {gameEnded && <EndingModal finalReason={finalReason} winnerIds={winnerIds} finalStandings={finalStandings} utopiaState={utopiaState} onReset={leave} />}
      <ActionEffectOverlay effects={actionEffects} onDismiss={dismissActionEffect} />
      <TreasureCardModal pending={isMyTurn ? pendingTreasureReveal : null} players={players} mode="reveal" onCancel={closeTreasureRevealPopup} />
      <TreasureCardModal pending={isMyTurn ? pendingTreasureUse : null} players={players} mode="use" onConfirm={confirmTreasureCardUse} onCancel={cancelTreasureCardEffect} />
      <DiceRollModal isMyTurn={isMyTurn} myIndex={myIndex} />
      <SurvivorDiceModal />
    </div>
  )
}

const OPPONENT_DOT_STYLE = {
  반장: 'border-blue-500 bg-blue-500',
  분위기메이커: 'border-pink-500 bg-pink-500',
  용감이: 'border-green-500 bg-green-500',
  '4차원': 'border-yellow-500 bg-yellow-500',
  겁쟁이: 'border-purple-500 bg-purple-500',
  평범: 'border-gray-500 bg-gray-500',
}

function getPartySlotTypes(party = [], maxPartySize = 5) {
  const slotTypes = Array.from({ length: maxPartySize }, () => null)
  const occupiedStackSlots = new Set()
  party.forEach((survivor, index) => {
    const slotIndex = Number.isInteger(survivor?.partySlotIndex) ? survivor.partySlotIndex : index
    if (slotIndex < 0 || slotIndex >= maxPartySize) return
    const stackGroupKey = survivor.stackGroupKey ?? null
    if (stackGroupKey && occupiedStackSlots.has(slotIndex)) return
    if (stackGroupKey) occupiedStackSlots.add(slotIndex)
    slotTypes[slotIndex] = survivor.type ?? '평범'
  })
  return slotTypes
}

function OpponentSlotDots({ player }) {
  const slotTypes = getPartySlotTypes(player.party ?? [], player.maxPartySize ?? 5)
  return (
    <div className="flex items-center gap-0.5" aria-label={player.name + ' 파티 슬롯'}>
      {slotTypes.map((type, index) => (
        <span
          key={player.id + '-slot-' + index}
          title={type ? String(index + 1) + '번: ' + type : String(index + 1) + '번: 빈 슬롯'}
          className={'h-2 w-2 rounded-full border ' + (type ? (OPPONENT_DOT_STYLE[type] ?? OPPONENT_DOT_STYLE.평범) : 'border-gray-700 bg-gray-950/80')}
        />
      ))}
    </div>
  )
}

function OpponentResourceLine({ player }) {
  const clueTokens = player.clueTokens ?? 0
  const eventScore = player.scoreTokens ?? 0
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] leading-none text-gray-300">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-0.5 text-red-200">
          <PersonalIcon name="can" alt="통조림" className="h-3 w-3" />{player.resources?.can ?? 0}
        </span>
        <span className="inline-flex items-center gap-0.5 text-gray-200">
          <PersonalIcon name="bottleCap" alt="병뚜껑" className="h-3 w-3" />{player.resources?.bottleCap ?? 0}
        </span>
      </div>
      {(clueTokens > 0 || eventScore > 0) && (
        <div className="flex items-center gap-1.5 text-gray-400">
          {clueTokens > 0 && (
            <span className="inline-flex items-center gap-0.5 text-yellow-200">
              <PersonalIcon name="clue" alt="단서" className="h-3 w-3" />{clueTokens}
            </span>
          )}
          {eventScore > 0 && (
            <span className="inline-flex items-center gap-0.5 text-emerald-200">
              <PersonalIcon name="score" alt="이벤트점수" className="h-3 w-3" />{eventScore}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function MyStatusHud({ player }) {
  if (!player) return null

  const hud = (
    <div
      className="fixed bottom-2 left-2 z-[80] w-44 rounded-lg border border-amber-500/40 bg-gray-950/90 p-2 text-[10px] opacity-80 shadow-xl backdrop-blur-sm transition-opacity hover:opacity-100"
      style={{ position: 'fixed', left: 8, bottom: 8 }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold text-amber-100">{player.name}</span>
        <OpponentSlotDots player={player} />
      </div>
      <OpponentResourceLine player={player} />
    </div>
  )

  return createPortal(hud, document.body)
}

function canReceiveTransferredSurvivorsInHud(targetPlayer, survivors = []) {
  if (!targetPlayer || !survivors.length) return false
  const nextParty = [...(targetPlayer.party ?? [])]

  let slotCount = getPartySlotTypes(nextParty, targetPlayer.maxPartySize ?? 5).filter(Boolean).length
  for (const survivor of survivors) {
    if (nextParty.some((entry) => entry.uid === survivor.uid)) continue
    const stackKeyMatch = survivor.stackKey && nextParty.find((entry) => entry.uid !== survivor.uid && entry.stackKey === survivor.stackKey)
    const capybaraHost = nextParty.find((entry) => entry.id === 's_mood_3')
    const isAnimal = ['s_military_2', 's_charge_2', 's_charge_4', 's_coward_1', 's_mood_3'].includes(survivor.id)
    const canStack = !!stackKeyMatch || (!!capybaraHost && isAnimal)
    if (!canStack) {
      if (slotCount >= (targetPlayer.maxPartySize ?? 5)) return false
      slotCount += 1
    }
    nextParty.push(survivor)
  }

  return true
}

function canSelectOpponentFromHud({ interaction, players, currentPlayerIndex, targetPlayer, targetIndex }) {
  if (interaction?.step !== 'select_target_player') return false
  if (!targetPlayer || targetIndex === currentPlayerIndex) return false

  if (interaction.kind === 'survivor_endturn_escape') {
    const slotCount = getPartySlotTypes(targetPlayer.party ?? [], targetPlayer.maxPartySize ?? 5).filter(Boolean).length
    return slotCount < (targetPlayer.maxPartySize ?? 5)
  }
  if (interaction.kind === 'survivor_recruit_magicgirl_take') {
    return targetPlayer.party?.some((survivor) => survivor.id?.startsWith('s_plain_') || String(survivor.name ?? '').replace(/\s/g, '') === '평범생존자' || survivor.type === '평범') ?? false
  }
  if (interaction.kind === 'survivor_endturn_wizard_swap' || interaction.kind === 'survivor_skill_wizard') {
    return (targetPlayer.party?.length ?? 0) > 0
  }
  if (interaction.event?.resolution?.type === 'send_survivor_type' || interaction.event?.resolution?.type === 'send_survivors_n') {
    const currentPlayer = players[currentPlayerIndex]
    const selected = (interaction.payload?.selectedMyUids ?? [])
      .map((uid) => currentPlayer?.party?.find((survivor) => survivor.uid === uid))
      .filter(Boolean)
    return canReceiveTransferredSurvivorsInHud(targetPlayer, selected)
  }
  if (interaction.event?.resolution?.type === 'support_roll_dice' || interaction.event?.resolution?.type === 'shared_dispatch_reward') {
    return targetPlayer.party?.some((survivor) => targetPlayer.survivorActivity?.[survivor.uid] !== false) ?? false
  }
  if (interaction.event?.resolution?.type === 'resource_duel') {
    const resource = interaction.event.resolution.resource === 'bottleCap' ? 'bottleCap' : 'can'
    return (targetPlayer.party?.length ?? 0) > 0 && (targetPlayer.resources?.[resource] ?? 0) > 0
  }
  if (interaction.event?.resolution?.type === 'trade_offer') {
    const resolution = interaction.event.resolution
    let receiveResource
    if (resolution.chooseResource) {
      const giveResource = interaction.payload?.tradeGiveResource ?? 'can'
      receiveResource = giveResource === 'can' ? 'bottleCap' : 'can'
    } else {
      receiveResource = resolution.receive?.resource ?? 'can'
    }
    const amount = resolution.receive?.amount ?? 2
    return (targetPlayer.resources?.[receiveResource] ?? 0) >= amount
  }

  return true
}

function OpponentStatusHover({ players = [], myIndex = 0 }) {
  const { interaction, currentPlayerIndex, selectTargetPlayer } = useGameStore()
  const opponents = players
    .map((player, index) => ({ player, index }))
    .filter(({ player, index }) => player && index !== myIndex)
  const canLocalSelectTarget = currentPlayerIndex === myIndex && !players[currentPlayerIndex]?.isBot && interaction?.step === 'select_target_player'

  if (opponents.length === 0) return null

  const hud = (
    <div
      className="fixed left-2 top-2 z-[80] flex w-44 flex-col gap-1.5 text-[10px] opacity-80 transition-opacity hover:opacity-100"
      style={{ position: 'fixed', left: 8, top: 8 }}
    >
        {opponents.map(({ player, index }) => {
          const isSelectable = canLocalSelectTarget && canSelectOpponentFromHud({
            interaction,
            players,
            currentPlayerIndex,
            targetPlayer: player,
            targetIndex: index,
          })
          const isSelected = interaction?.payload?.targetPlayerIndex === index
          const rowClassName = [
            'rounded-lg border bg-gray-950/90 px-2 py-1.5 shadow-xl backdrop-blur-sm transition-colors',
            isSelected ? 'border-amber-300/90 bg-amber-950/30' : 'border-gray-800/80',
            isSelectable ? 'cursor-pointer hover:border-amber-300/90 hover:bg-amber-950/20' : '',
            canLocalSelectTarget && !isSelectable ? 'cursor-not-allowed opacity-45' : '',
          ].filter(Boolean).join(' ')

          const handleSelect = () => {
            if (isSelectable) selectTargetPlayer(index)
          }

          return (
            <div
              key={player.id}
              role={isSelectable ? 'button' : undefined}
              tabIndex={isSelectable ? 0 : undefined}
              onClick={handleSelect}
              onKeyDown={(event) => {
                if (!isSelectable) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectTargetPlayer(index)
                }
              }}
              className={rowClassName}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-bold text-gray-200">{player.name}</span>
                <OpponentSlotDots player={player} />
              </div>
              <OpponentResourceLine player={player} />
            </div>
          )
        })}
    </div>
  )

  return createPortal(hud, document.body)
}
function EndingModal({ finalReason, winnerIds, finalStandings, utopiaState, onReset }) {
  const claimedLeaderId = utopiaState?.claimedCard?.leaderId
  const utopiaCard = claimedLeaderId ? UTOPIA_CARDS[claimedLeaderId] : null

  const winnerEntry = finalStandings.find((e) => winnerIds.includes(e.playerId))
  const party = winnerEntry?.party ?? []
  const leaderDesc = winnerEntry ? `${winnerEntry.leaderEmoji} ${winnerEntry.leaderName}` : '지도자'
  const partyDesc = party.map((s) => `${s.emoji} ${s.name}`).join(', ') || '파티원'
  const rawEnding = utopiaCard?.endingText ?? '멸망 속에서 유토피아에 도달했습니다.'
  const filledEnding = rawEnding.replace('{지도자}', leaderDesc).replace('{파티원}', partyDesc)

  const filledTemplate = utopiaCard?.boardGameTemplate
    ? party.reduce(
        (text, s, i) => text.replace(`[파티원${i + 1}]`, `${s.emoji} ${s.name}`),
        utopiaCard.boardGameTemplate
      )
    : null

  const isMultiWinner = winnerIds.length > 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-yellow-600/60 bg-gray-950 flex flex-col gap-5 p-6">

        {/* 유토피아 헤더 */}
        <div className="text-center">
          <div className="text-5xl mb-2">{utopiaCard?.emoji ?? '🏁'}</div>
          <div className="text-lg font-bold text-yellow-300">
            {utopiaCard?.name ?? '유토피아'} 도달
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{finalReason}</div>
        </div>

        {/* 승자 */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">최종 승자</div>
          {isMultiWinner ? (
            <div className="text-base font-black text-yellow-300">
              🏆 {finalStandings.filter((e) => winnerIds.includes(e.playerId)).map((e) => e.name).join(' · ')} 공동 우승
            </div>
          ) : (
            <div className="text-xl font-black text-yellow-300">🏆 {winnerEntry?.name}</div>
          )}
          <div className="text-base font-bold text-yellow-100 mt-0.5">{winnerEntry?.total}점</div>
        </div>

        {/* 점수 내역 */}
        <div className="space-y-2">
          {finalStandings.map((entry, idx) => {
            const isWinner = winnerIds.includes(entry.playerId)
            return (
              <div
                key={entry.playerId}
                className={`rounded-xl border px-3 py-2.5 ${
                  isWinner ? 'border-yellow-500/70 bg-yellow-950/30' : 'border-gray-700/60 bg-gray-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${isWinner ? 'text-yellow-200' : 'text-gray-200'}`}>
                    {idx + 1}. {entry.name}
                  </span>
                  <span className={`text-sm font-bold ${isWinner ? 'text-yellow-300' : 'text-gray-300'}`}>
                    {entry.total}점
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                  <span>파티 <span className="text-gray-200">{entry.partyScore}</span></span>
                  {entry.partyBonusScore > 0 && (
                    <span>보너스 <span className="text-gray-200">+{entry.partyBonusScore}</span></span>
                  )}
                  <span>이벤트 <span className="text-gray-200">{entry.eventScore}</span></span>
                  {entry.treasureScore > 0 && (
                    <span>보물 <span className="text-yellow-300">+{entry.treasureScore}</span></span>
                  )}
                  {entry.abandonedPenalty > 0 && (
                    <span className="text-red-400">벌점 -{entry.abandonedPenalty}</span>
                  )}
                  <span>
                    배치 <span className={entry.leaderEndAchieved ? 'text-emerald-300' : 'text-gray-200'}>{entry.leaderEndScore}</span>
                    <span className="text-gray-600"> · {entry.leaderEndLabel}</span>
                  </span>
                  <span>단서 <span className="text-amber-300">{entry.clueTokens}장</span></span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 엔딩 텍스트 */}
        <div className="border-t border-gray-800 pt-4 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-300 leading-relaxed">{filledEnding}</p>
          <p className="text-base font-black tracking-widest text-amber-400">멸망했는데... 바쁨!</p>
        </div>

        {/* 보드게임 템플릿 */}
        {filledTemplate && (
          <div className="rounded-lg border border-gray-700/50 bg-gray-900/50 px-3 py-2.5 text-[11px] text-gray-500 whitespace-pre-line">
            <span className="text-gray-400 font-semibold block mb-1">보드게임 엔딩 카드</span>
            {filledTemplate}
          </div>
        )}

        <button
          onClick={onReset}
          className="w-full rounded-xl border border-gray-600 bg-gray-800 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700 transition-colors"
        >
          처음으로
        </button>
      </div>
    </div>
  )
}

function TreasureCardModal({ pending, players, mode = 'use', onConfirm, onCancel }) {
  if (!pending) return null
  const player = players[pending.playerIndex]
  const card = player?.treasureCards?.find((entry) => entry.uid === pending.cardUid)
  if (!card) return null
  const isItem = card.kind === 'item'
  const isReaction = card.kind === 'reaction'
  const icon = isItem ? '🎒' : isReaction ? '⚡' : '💎'
  const typeLabel = isItem ? '아이템' : isReaction ? '반응' : '보물'

  const isRevealMode = mode === 'reveal'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" onClick={onCancel}>
      <div className="flex flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <div
          className={`relative w-[19rem] min-h-[24rem] overflow-hidden rounded-2xl border-2 p-4 ${
            isItem
              ? 'border-sky-300 bg-sky-950/95 shadow-[0_0_34px_rgba(56,189,248,0.45),0_28px_60px_rgba(0,0,0,0.75)]'
              : isReaction
                ? 'border-violet-300 bg-violet-950/95 shadow-[0_0_34px_rgba(167,139,250,0.45),0_28px_60px_rgba(0,0,0,0.75)]'
                : 'border-amber-300 bg-amber-950/95 shadow-[0_0_38px_rgba(251,191,36,0.5),0_28px_60px_rgba(0,0,0,0.75)]'
          }`}
        >
          <div className="absolute left-4 top-3 text-3xl font-black text-white/90">{card.score ?? 0}</div>
          <div className="absolute right-4 top-3 text-[10px] font-black text-white/65">
            {typeLabel}
          </div>
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="mb-3 flex h-28 w-28 items-center justify-center rounded-2xl bg-black/20 text-6xl shadow-inner">
              {icon}
            </div>
            <div className="text-xl font-black text-white drop-shadow">{card.name}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              게임 종료 시 {card.score ?? 0}점
            </div>
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-white/80">
              {card.description}
            </p>
          </div>
        </div>
        <div className="mt-4 flex w-[19rem] gap-2">
          {isRevealMode ? (
            <button type="button" onClick={onCancel} className="btn-primary flex-1 text-xs py-2">
              확인
            </button>
          ) : (
            <>
              <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-xs py-2">
                취소
              </button>
              <button type="button" onClick={onConfirm} className="btn-primary flex-1 text-xs py-2">
                사용
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ActionEffectOverlay({ effects, onDismiss }) {
  const active = effects[0]

  useEffect(() => {
    if (!active) return
    const timeout = window.setTimeout(() => onDismiss(active.id), 1800)
    return () => window.clearTimeout(timeout)
  }, [active, onDismiss])

  useEffect(() => {
    if (!active || active.type !== 'disaster') return
    document.body.classList.add('screen-shake')
    const timeout = window.setTimeout(() => {
      document.body.classList.remove('screen-shake')
    }, 650)
    return () => {
      window.clearTimeout(timeout)
      document.body.classList.remove('screen-shake')
    }
  }, [active])

  if (!active) return null

  const toneClass = {
    destroy: 'border-rose-500/70 bg-rose-950/80 text-rose-100',
    steal: 'border-amber-500/70 bg-amber-950/80 text-amber-100',
    transfer: 'border-sky-500/70 bg-sky-950/80 text-sky-100',
    global: 'border-yellow-500/70 bg-yellow-950/80 text-yellow-100',
    disaster: 'border-red-500/80 bg-red-950/85 text-red-100',
    resource_gain: 'border-emerald-500/70 bg-emerald-950/80 text-emerald-100',
    resource_loss: 'border-red-500/70 bg-red-950/80 text-red-100',
  }[active.type] ?? 'border-gray-500/70 bg-gray-900/80 text-gray-100'
  const crackEffect = active.type === 'destroy' || active.type === 'disaster'

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className={`action-effect-card ${toneClass} ${crackEffect ? 'action-effect-cracked' : ''}`}>
        <div className="action-effect-burst" />
        {crackEffect && <div className="action-effect-cracks" />}
        <div className="relative flex items-start gap-3">
          <div className="text-3xl leading-none">{active.icon ?? '⚔️'}</div>
          <div>
            <div className="text-sm font-bold tracking-wide">{active.title}</div>
            <div className="text-xs opacity-80">{active.targetName}</div>
            <div className="mt-1 text-sm font-semibold">{active.detail}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
