import { useGameStore } from '../store/gameStore.js'
import PartySlot from './PartySlot.jsx'
import { RULES } from '../data/rules.js'
import { calcPartyScore } from '../logic/scoring.js'

function LeaderRuleRow({ label, title, description, accentClass }) {
  return (
    <div>
      <div className="leading-tight">
        <span className={`text-[9px] font-black ${accentClass}`}>{label}</span>
        {title && (
          <>
            <span className={`text-[9px] font-black ${accentClass}`}> : </span>
            <span className="text-[9px] font-black text-gray-100">{title}</span>
          </>
        )}
      </div>
      <div className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-gray-300 line-clamp-4">
        {description}
      </div>
    </div>
  )
}

function canReceiveTransferredSurvivors(targetPlayer, survivors = []) {
  if (!targetPlayer || !survivors.length) return false
  const nextParty = [...(targetPlayer.party ?? [])]
  let slotCount = 0

  const countSlots = (party) => {
    let lastStackGroupKey = null
    return party.reduce((count, survivor) => {
      const stackGroupKey = survivor.stackGroupKey ?? null
      if (stackGroupKey && stackGroupKey === lastStackGroupKey) return count
      lastStackGroupKey = stackGroupKey
      return count + 1
    }, 0)
  }

  slotCount = countSlots(nextParty)
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
  }

  return true
}

export default function PlayerPanel({ player, playerIndex, isActive, isMyTurn, compact = false }) {
  const {
    interaction,
    players,
    currentPlayerIndex,
    selectTargetPlayer,
    gameEnded,
    phase,
    exchangeCapToCan,
    exchangeCanToCap,
  } = useGameStore()
  if (!player) return null
  const canLocalResolveInteraction = currentPlayerIndex === 0 && !players[currentPlayerIndex]?.isBot
  const isTargetable = (() => {
    if (!canLocalResolveInteraction) return false
    if (interaction?.step !== 'select_target_player' || playerIndex === currentPlayerIndex) return false
    if (interaction.kind === 'survivor_endturn_escape') {
      let lastStackGroupKey = null
      const slotCount = player.party.reduce((count, survivor) => {
        const stackGroupKey = survivor.stackGroupKey ?? null
        if (stackGroupKey && stackGroupKey === lastStackGroupKey) return count
        lastStackGroupKey = stackGroupKey
        return count + 1
      }, 0)
      return slotCount < (player.maxPartySize ?? 5)
    }
    if (interaction.kind === 'survivor_recruit_magicgirl_take') {
      return player.party.some((survivor) => survivor.type === '평범')
    }
    if (interaction.kind === 'survivor_endturn_wizard_swap' || interaction.kind === 'survivor_skill_wizard') {
      return (player.party?.length ?? 0) > 0
    }
    if (interaction.event?.resolution?.type === 'send_survivor_type' || interaction.event?.resolution?.type === 'send_survivors_n') {
      const currentPlayer = useGameStore.getState().players[currentPlayerIndex]
      const selected = (interaction.payload?.selectedMyUids ?? [])
        .map((uid) => currentPlayer?.party?.find((survivor) => survivor.uid === uid))
        .filter(Boolean)
      return canReceiveTransferredSurvivors(player, selected)
    }
    return true
  })()
  const isSelectedTarget = interaction?.payload?.targetPlayerIndex === playerIndex
  const partyScore = calcPartyScore(player.party, player.leaderId).total
  const eventBonus = player.scoreTokens ?? 0
  const eventPenalty = player.abandonedEvents?.length ?? 0
  const clueTokens = player.clueTokens ?? 0
  const activeCount = player.party.filter((survivor) => player.survivorActivity?.[survivor.uid] !== false).length
  const inactiveCount = Math.max(0, player.party.length - activeCount)
  const canExchange = isMyTurn && phase === 'party_maintenance' && !gameEnded
  const leaderIncome = player.passiveIncome ?? { can: 0, bottleCap: 0 }
  const leaderIncomeText = [
    (leaderIncome.can ?? 0) > 0 ? `🥫+${leaderIncome.can}` : null,
    (leaderIncome.bottleCap ?? 0) > 0 ? `🪙+${leaderIncome.bottleCap}` : null,
  ].filter(Boolean).join(' / ') || '없음'
  const leaderEndBonusText = player.specialWin
    ? `${player.specialWin.description} ★+3`
    : ''
  const leaderFans = player.leaderFans ?? []

  return (
    <div className={`card border-2 transition-all ${
      isSelectedTarget ? 'border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]' : isActive ? 'border-amber-500' : 'border-gray-700'
    }`}>
      <div className={`flex ${compact ? 'flex-col gap-3' : 'flex-col gap-2 lg:flex-row lg:items-stretch'}`}>
        <div className={`${compact ? '' : 'lg:w-44 lg:min-w-[11rem]'} flex flex-col gap-2`}>
          <div
            className="relative overflow-hidden rounded-[1.15rem] border-2 bg-gray-950/60 px-3 py-3"
            style={{ borderColor: player.leaderColor }}
          >
            {player.isBot && (
              <span className="absolute right-2 top-2 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">봇</span>
            )}

            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{player.type}</div>
              <div className={`font-black leading-tight ${compact ? 'text-sm' : 'text-lg'}`} style={{ color: player.leaderColor }}>
                {player.name}
              </div>
            </div>

            <div className="mt-2 space-y-2 rounded-lg bg-black/20 px-2 py-1.5">
              <LeaderRuleRow
                label="생산능력"
                description={`턴 시작시 ${leaderIncomeText}`}
                accentClass="text-emerald-300"
              />
              <LeaderRuleRow
                label="특수능력"
                title={player.uniqueSkill?.name ?? '지도자 스킬'}
                description={player.uniqueSkill?.description ?? '없음'}
                accentClass="text-sky-300"
              />
              {player.specialWin && (
                <LeaderRuleRow
                  label="종료 보너스"
                  title={player.specialWin.name}
                  description={leaderEndBonusText}
                  accentClass="text-yellow-300"
                />
              )}
            </div>

            {leaderFans.length > 0 && (
              <div className="relative mt-2 min-h-8 rounded-lg border border-pink-700/40 bg-pink-950/20 px-2 py-1">
                <div className="text-[10px] font-black text-pink-200">팬 {leaderFans.length}명</div>
                <div className="mt-1 flex items-center">
                  {leaderFans.slice(0, 8).map((fan, index) => (
                    <span
                      key={fan.uid}
                      title={fan.name}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-pink-500/40 bg-gray-950/80 text-sm shadow"
                      style={{ marginLeft: index === 0 ? 0 : -6, zIndex: index }}
                    >
                      {fan.emoji}
                    </span>
                  ))}
                  {leaderFans.length > 8 && <span className="ml-1 text-[10px] text-pink-200">+{leaderFans.length - 8}</span>}
                </div>
              </div>
            )}

            <div className="mt-2 flex flex-col gap-2 items-start">
              {isTargetable && (
                <button onClick={() => selectTargetPlayer(playerIndex)} className="btn-secondary text-xs px-2 py-1 self-start">
                  대상 선택
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-950/45 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2">가방</div>
            <div className="flex items-center gap-1 text-sm font-semibold">
              <div className="text-amber-300">총점 {player.score}</div>
              <div className="text-gray-500">/</div>
              <div className="text-gray-200">생존자 점수 {partyScore}</div>
              {eventPenalty > 0 && (
                <>
                  <div className="text-gray-500">/</div>
                  <div className="text-red-300">벌점 -{eventPenalty}</div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 text-base mt-3">
              <div className="font-bold text-red-300">🥫 {player.resources.can}<span className="text-xs text-red-200/60">/{player.maxResources?.can ?? '-'}</span></div>
              <div className="font-bold text-amber-300">🪙 {player.resources.bottleCap}<span className="text-xs text-amber-200/60">/{player.maxResources?.bottleCap ?? '-'}</span></div>
            </div>

            <div className="inline-flex items-center gap-1 mt-2">
              <button
                onClick={exchangeCapToCan}
                disabled={!canExchange}
                className="btn-secondary text-[10px] px-2 py-0.5 disabled:opacity-50 whitespace-nowrap"
              >
                🪙1→🥫{RULES.capToCanRate}
              </button>
              <button
                onClick={exchangeCanToCap}
                disabled={!canExchange}
                className="btn-secondary text-[10px] px-2 py-0.5 disabled:opacity-50 whitespace-nowrap"
              >
                🥫{RULES.canToCapRate}→🪙1
              </button>
            </div>

            {(player.eventDiscard?.length > 0 || eventBonus > 0 || eventPenalty > 0 || clueTokens > 0) && (
              <div className="text-xs space-y-1 mt-2">
                {player.eventDiscard?.length > 0 && (
                  <div className="text-gray-400">📋 해결한 이벤트 {player.eventDiscard.length}장</div>
                )}
                {clueTokens > 0 && (
                  <div className="text-yellow-300">🗺️ 유토피아 단서 {clueTokens}장</div>
                )}
                {eventBonus > 0 && (
                  <div className="text-emerald-400">🏁 이벤트 점수 +{eventBonus}</div>
                )}
                {eventPenalty > 0 && (
                  <div className="text-red-400">🂠 넘긴 이벤트 {eventPenalty}장 · 벌점 -{eventPenalty}</div>
                )}
              </div>
            )}

            {isActive && (
              <div className="text-xs bg-amber-900 text-amber-300 rounded-full px-2 py-1 self-start animate-pulse mt-2">
                현재 턴
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <PartySlot playerIndex={playerIndex} isEditable={isMyTurn} compact={compact} showSummary={false} />
        </div>
      </div>
    </div>
  )
}
