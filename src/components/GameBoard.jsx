import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore.js'
import PlayerPanel from './PlayerPanel.jsx'
import EventZone from './EventZone.jsx'
import MercenaryPool from './MercenaryPool.jsx'

export default function GameBoard() {
  const {
    players, currentPlayerIndex, round,
    endTurn, resetGame, globalLog, actionEffects, dismissActionEffect,
  } = useGameStore()

  const myIndex = 0
  const currentPlayer = players[currentPlayerIndex]
  const isMyTurn = currentPlayerIndex === myIndex && !currentPlayer?.isBot

  // 나 / 상대방 분리
  const myPlayer = players[myIndex]
  const opponents = players.filter((_, i) => i !== myIndex)

  return (
    <div className="min-h-screen flex flex-col gap-3 p-3 md:p-4 max-w-7xl mx-auto">

      {/* 상단 상태 바 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-amber-400">멸망했는데 바쁨</h1>
          <p className="text-xs text-gray-500">
            라운드 {round} &nbsp;·&nbsp;
            <span style={{ color: currentPlayer?.leaderColor }}>{currentPlayer?.name}</span> 턴
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMyTurn && (
            <button onClick={endTurn} className="btn-primary text-xs px-4 py-1.5">
              턴 종료 →
            </button>
          )}
          {!isMyTurn && (
            <span className="text-xs text-gray-500 italic">
              {currentPlayer?.isBot ? '🤖 봇 생각 중...' : `${currentPlayer?.name} 턴`}
            </span>
          )}
          <button onClick={resetGame} className="btn-secondary text-xs px-3 py-1.5">처음으로</button>
        </div>
      </div>

      {/* ── 상대 플레이어 패널 ── */}
      {opponents.length > 0 && (
        <div className="flex flex-col gap-2">
          {opponents.map((player, i) => {
            const globalIndex = players.indexOf(player)
            return (
              <PlayerPanel
                key={player.id}
                player={player}
                playerIndex={globalIndex}
                isActive={globalIndex === currentPlayerIndex}
                isMyTurn={false}
                compact={false}
              />
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_18.5rem] xl:grid-cols-[minmax(0,1fr)_19.5rem]">
          {/* ── 이벤트 존 (플레이어 사이) ── */}
          <div className="card border-gray-700 bg-gray-900/80 min-w-0">
            <EventZone isMyTurn={isMyTurn} />
          </div>

          {/* ── 용병소 ── */}
          <div className="card border-gray-700 self-start">
            <MercenaryPool isMyTurn={isMyTurn} />
          </div>
        </div>

        {/* ── 내 플레이어 패널 ── */}
        <PlayerPanel
          player={myPlayer}
          playerIndex={myIndex}
          isActive={myIndex === currentPlayerIndex}
          isMyTurn={isMyTurn}
          compact={false}
        />
      </div>

      {/* ── 게임 로그 ── */}
      <div className="card border-gray-800 max-h-32 overflow-y-auto">
        <h3 className="text-xs font-semibold text-gray-600 mb-1">로그</h3>
        {globalLog.map((msg, i) => (
          <p key={i} className={`text-xs py-0.5 border-b border-gray-800 last:border-0 ${
            i === 0 ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {msg}
          </p>
        ))}
      </div>

      <ActionEffectOverlay effects={actionEffects} onDismiss={dismissActionEffect} />
    </div>
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
