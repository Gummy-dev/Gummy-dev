import { useGameStore } from '../store/gameStore.js'
import { calcPartyScore } from '../logic/scoring.js'
import PartySlot from './PartySlot.jsx'

export default function PlayerPanel({ player, playerIndex, isActive, isMyTurn, compact = false }) {
  const { interaction, currentPlayerIndex, selectTargetPlayer } = useGameStore()
  if (!player) return null
  const isTargetable =
    interaction?.step === 'select_target_player' &&
    playerIndex !== currentPlayerIndex
  const isSelectedTarget = interaction?.payload?.targetPlayerIndex === playerIndex
  const partyScore = calcPartyScore(player.party, player.leaderId).total
  const eventBonus = player.scoreTokens ?? 0
  const eventPenalty = player.abandonedEvents?.length ?? 0

  return (
    <div className={`card border-2 transition-all ${
      isSelectedTarget ? 'border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]' : isActive ? 'border-amber-500' : 'border-gray-700'
    }`}>
      <div className={`flex ${compact ? 'flex-col gap-3' : 'flex-col gap-2 lg:flex-row lg:items-stretch'}`}>
        <div className={`${compact ? '' : 'lg:w-32 lg:min-w-[7.5rem]'} flex flex-col gap-2`}>
          <div className="flex items-start gap-3">
            <span className={compact ? 'text-xl' : 'text-3xl'}>{player.leaderEmoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold ${compact ? 'text-sm' : 'text-lg'}`} style={{ color: player.leaderColor }}>
                  {player.name}
                </span>
                {player.isBot && (
                  <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-2">봇</span>
                )}
                {isActive && (
                  <span className="text-xs bg-amber-900 text-amber-300 rounded-full px-2 animate-pulse">현재 턴</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">{player.leaderName}</div>
            </div>
          </div>

          {isTargetable && (
            <button onClick={() => selectTargetPlayer(playerIndex)} className="btn-secondary text-xs px-2 py-1 self-start">
              대상 선택
            </button>
          )}

          <div className="flex items-center gap-1 text-sm font-semibold">
            <div className="text-amber-300">총점 {player.score}점</div>
            <div className="text-gray-500">/</div>
            <div className="text-gray-200">파티 {partyScore}점</div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="font-semibold text-red-300">🥫 {player.resources.can}</div>
            <div className="font-semibold text-amber-300">🪙 {player.resources.bottleCap}</div>
          </div>

          {(player.eventDiscard?.length > 0 || eventBonus > 0 || eventPenalty > 0) && (
            <div className="text-xs space-y-1">
              {player.eventDiscard?.length > 0 && (
                <div className="text-gray-400">📋 해결한 이벤트 {player.eventDiscard.length}장</div>
              )}
              {eventBonus > 0 && (
                <div className="text-emerald-400">🏁 이벤트 점수 +{eventBonus}</div>
              )}
              {eventPenalty > 0 && (
                <div className="text-red-400">🂠 넘긴 이벤트 {eventPenalty}장 · 벌점 -{eventPenalty}</div>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <PartySlot playerIndex={playerIndex} isEditable={isMyTurn} compact={compact} showSummary={false} />
        </div>
      </div>
    </div>
  )
}
