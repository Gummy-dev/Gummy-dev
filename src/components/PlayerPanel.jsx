import { useGameStore } from '../store/gameStore.js'
import { Token } from '../tabletop/Token.jsx'
import PartySlot from './PartySlot.jsx'
import { calcPartyScore } from '../logic/scoring.js'
import { PersonalIcon, RichText } from '../assets/personal-icons/index.jsx'


function LeaderRuleRow({ label, title, description, accentClass }) {
  return (
    <div>
      <div className="leading-tight">
        <span className={`text-[11px] font-black ${accentClass}`}>{label}</span>
        {title && (
          <>
            <span className={`text-[11px] font-black ${accentClass}`}> : </span>
            <span className={`text-[11px] font-black ${accentClass}`}>{title}</span>
          </>
        )}
      </div>
      <div className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-gray-300 line-clamp-10">
        <RichText text={description} />
      </div>
    </div>
  )
}

function LeaderCardStacks({ player, canRevealTreasure, onRevealTreasure, canUseTreasure, onUseTreasure }) {
  const keys = player.keyCards ?? []
  const treasures = player.treasureCards ?? []
  if (keys.length === 0 && treasures.length === 0) return null

  const totalScore = keys.reduce((sum, c) => sum + (c.score ?? 0), 0)
    + treasures.reduce((sum, card) => sum + (card.score ?? 0), 0)

  return (
    <div className="mt-2 rounded-lg border border-yellow-700/35 bg-yellow-950/10 px-2 py-1.5">
      <div className="flex items-center justify-between text-[10px] font-black text-yellow-100/80">
        <span>보관 카드</span>
        <span>{keys.length + treasures.length}장</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {keys.map((card, index) => (
          <span
            key={card.uid ?? `key-${index}`}
            title={`열쇠 (${card.score ?? 0}점)`}
            className="inline-flex h-7 w-5 items-center justify-center rounded border border-yellow-500/60 bg-yellow-950/80 text-[13px] shadow"
            style={{ marginLeft: index === 0 ? 0 : -4 }}
          >
            🗝️
          </span>
        ))}
        {treasures.map((card, index) => (
          <div key={card.uid} className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              title={card.revealed ? `${card.name} (${card.score ?? 0}점)${card.used ? ' · 사용됨' : ''}` : '뒤집힌 보물/아이템'}
              disabled={!canRevealTreasure || card.revealed}
              onClick={() => onRevealTreasure?.(card.uid)}
              className={`inline-flex h-7 w-5 items-center justify-center rounded border text-[12px] font-black shadow ${
                card.kind === 'item'
                  ? 'border-sky-500/60 bg-sky-950/80 text-sky-200'
                  : card.kind === 'reaction'
                    ? 'border-violet-500/60 bg-violet-950/80 text-violet-200'
                    : 'border-amber-500/60 bg-amber-950/80 text-amber-200'
              } ${card.used ? 'opacity-40' : ''} ${canRevealTreasure && !card.revealed ? 'cursor-pointer hover:border-white/80' : 'cursor-default'}`}
              style={{ marginLeft: keys.length === 0 && index === 0 ? 0 : -4 }}
            >
              {card.revealed ? (card.kind === 'item' ? 'I' : card.kind === 'reaction' ? '⚡' : card.score ?? 0) : '🂠'}
            </button>
            {canUseTreasure && card.revealed && card.effectId && !card.used && card.kind !== 'reaction' && (
              <button
                type="button"
                onClick={() => onUseTreasure?.(card.uid)}
                className="text-[8px] font-black text-emerald-300 border border-emerald-600/60 bg-emerald-950/80 rounded px-1 leading-tight hover:border-emerald-400"
                style={{ marginLeft: keys.length === 0 && index === 0 ? 0 : -4 }}
              >
                사용
              </button>
            )}
          </div>
        ))}
      </div>
      {(keys.length > 0 || treasures.length > 0) && (
        <div className="mt-1 text-[10px] leading-tight text-yellow-100/55">
          보물 점수 +{totalScore}
        </div>
      )}
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


function getEffectiveLeaderPlacementType(survivor, slotIndex, leaderId) {
  if (survivor?.id === 's_coward_6' && slotIndex === 0 && leaderId === 'zombie') return '용감이'
  if ((survivor?.id?.startsWith('s_plain_') || String(survivor?.name ?? '').replace(/\s/g, '') === '평범생존자' || survivor?.type === '평범') && slotIndex === 0 && leaderId === 'robot') return '반장'
  return survivor?.type
}

export default function PlayerPanel({ player, playerIndex, isActive, isMyTurn, compact = false }) {
  const {
    interaction,
    players,
    currentPlayerIndex,
    localPlayerIndex = 0,
    phase,
    selectTargetPlayer,
    revealStoredTreasure,
    startTreasureCardEffect,
    activateIdolFan,
  } = useGameStore()
  if (!player) return null
  const canLocalResolveInteraction = currentPlayerIndex === localPlayerIndex && !players[currentPlayerIndex]?.isBot
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
      return player.party.some((survivor) => survivor.id?.startsWith('s_plain_') || String(survivor.name ?? '').replace(/\s/g, '') === '평범생존자' || survivor.type === '평범')
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
    if (interaction.event?.resolution?.type === 'support_roll_dice') {
      return player.party.some((survivor) => player.survivorActivity?.[survivor.uid] !== false)
    }
    if (interaction.event?.resolution?.type === 'resource_duel') {
      const resource = interaction.event.resolution.resource === 'bottleCap' ? 'bottleCap' : 'can'
      return (player.party?.length ?? 0) > 0 && (player.resources?.[resource] ?? 0) > 0
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
      return (player.resources?.[receiveResource] ?? 0) >= amount
    }
    return true
  })()
  const isSelectedTarget = interaction?.payload?.targetPlayerIndex === playerIndex
  const partyScore = calcPartyScore(player.party, player.leaderId).total
  const eventBonus = player.scoreTokens ?? 0
  const treasureScore = (player.treasureCards ?? []).reduce((sum, card) => sum + (card.score ?? 0), 0)
  const eventPenalty = player.abandonedEvents?.length ?? 0
  const clueTokens = player.clueTokens ?? 0
  const activeCount = player.party.filter((survivor) => player.survivorActivity?.[survivor.uid] !== false).length
  const inactiveCount = Math.max(0, player.party.length - activeCount)
  const leaderIncome = player.passiveIncome ?? { can: 0, bottleCap: 0 }
  const leaderIncomeText = [
    (leaderIncome.can ?? 0) > 0 ? `🥫+${leaderIncome.can}` : null,
    (leaderIncome.bottleCap ?? 0) > 0 ? `🪙+${leaderIncome.bottleCap}` : null,
  ].filter(Boolean).join(' / ') || '없음'
  const leaderFans = player.leaderFans ?? []
  const canActivateLeaderFan = isMyTurn && currentPlayerIndex === playerIndex && phase === 'party_maintenance' && !interaction && player.leaderId === 'idol'

  if (compact) return (
    <section className={`restored-opponent-panel ${isActive ? 'is-active' : ''} ${isSelectedTarget ? 'is-targeted' : ''}`} aria-label={`${player.name} 파티`}>
      <div className="restored-opponent-heading">
        <span className="restored-opponent-portrait" aria-hidden="true">{player.leaderEmoji}</span>
        <div className="restored-opponent-name"><strong>{player.name}</strong><span>{player.isBot ? '봇 · ' : ''}파티 {player.party.length}명 · 활성 {activeCount}명{inactiveCount > 0 ? ` · 휴식 ${inactiveCount}명` : ''}</span></div>
        <span className="restored-opponent-score" title="현재 점수">★ {partyScore + eventBonus + treasureScore - eventPenalty}</span>
      </div>
      <div className="restored-opponent-meta">
        <Token kind="can" value={player.resources.can} /><Token kind="cap" value={player.resources.bottleCap} />
        <span>진입 {player.unlockedExplorationTier ?? 1}단계</span>
        {clueTokens > 0 && <span>단서 {clueTokens}</span>}
        {(player.keyCards?.length ?? 0) + (player.treasureCards?.length ?? 0) > 0 && <span>보관 카드 {(player.keyCards?.length ?? 0) + (player.treasureCards?.length ?? 0)}장</span>}
      </div>
      <details className="restored-opponent-skill"><summary>지도자 능력 · {player.uniqueSkill?.name ?? '없음'}</summary><p><RichText text={player.uniqueSkill?.description ?? '없음'} /></p></details>
      {isTargetable && <button type="button" onClick={() => selectTargetPlayer(playerIndex)} className="btn-secondary restored-opponent-target">대상 선택</button>}
      <PartySlot playerIndex={playerIndex} isEditable={false} compact showSummary={false} />
    </section>
  )

  return (
    <div className={`restored-player-panel card border-2 transition-all ${
      isSelectedTarget ? 'border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]' : isActive ? 'border-amber-500' : 'border-gray-700'
    }`}>
      <div className={`flex ${compact ? 'flex-col gap-2' : 'flex-col gap-2 lg:flex-row lg:items-stretch'}`}>
        <div className={`${compact ? '' : 'lg:w-44 lg:min-w-[11rem]'} flex flex-col gap-1`}>
          <div
            className="relative overflow-hidden rounded-[1.15rem] bg-gray-950/60 px-1.5 py-0"
            style={{ borderColor: player.leaderColor }}
          >
            {player.isBot && (
              <span className="absolute right-2 top-2 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">봇</span>
            )}

            <div className="text-center mt-4">
              {/* <div className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{player.type}</div> */}
              <div className={`font-black leading-tight ${compact ? 'text-sm' : 'text-lg'}`} style={{ color: player.leaderColor }}>
                {player.name}
              </div>
              <div className="mt-3 text-7xl leading-none">{player.leaderEmoji}</div>
            </div>

            <div className="mt-4 space-y-1.5 rounded-lg bg-black/20 px-2 py-3">
              <LeaderRuleRow
                label="생산능력"
                description={leaderIncomeText}
                accentClass="text-emerald-300"
              />
              <LeaderRuleRow
                label="특수능력"
                title={player.uniqueSkill?.name ?? '지도자 스킬'}
                description={player.uniqueSkill?.description ?? '없음'}
                accentClass="text-sky-300"
              />
            </div>

            {leaderFans.length > 0 && (
              <div className="relative mt-2 min-h-8 rounded-lg border border-pink-700/40 bg-pink-950/20 px-2 py-1">
                <div className="text-[10px] font-black text-pink-200">예비 팬클럽 {leaderFans.length}명</div>
                <div className="mt-1 flex items-center">
                  {leaderFans.slice(0, 8).map((fan, index) => (
                    <button
                      key={fan.uid}
                      type="button"
                      title={canActivateLeaderFan ? `${fan.name} 활성화 (🪙${fan.recruitCost ?? 0})` : fan.name}
                      disabled={!canActivateLeaderFan}
                      onClick={() => activateIdolFan?.(fan.uid)}
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-pink-500/40 bg-gray-950/80 px-1 text-sm shadow ${canActivateLeaderFan ? 'hover:border-amber-300 hover:text-amber-100' : 'cursor-default'}`}
                      style={{ marginLeft: index === 0 ? 0 : -6, zIndex: index }}
                    >
                      {fan.emoji}
                      {canActivateLeaderFan && <span className="ml-0.5 text-[8px] font-black text-amber-200">{fan.recruitCost ?? 0}</span>}
                    </button>
                  ))}
                  {leaderFans.length > 8 && <span className="ml-1 text-[10px] text-pink-200">+{leaderFans.length - 8}</span>}
                </div>
              </div>
            )}

            <LeaderCardStacks
              player={player}
              canRevealTreasure={isMyTurn && currentPlayerIndex === playerIndex}
              onRevealTreasure={(uid) => revealStoredTreasure(playerIndex, uid)}
              canUseTreasure={isMyTurn && currentPlayerIndex === playerIndex && phase === 'action' && !interaction}
              onUseTreasure={(uid) => startTreasureCardEffect(uid)}
            />

            <div className="mt-2 flex flex-col gap-2 items-start">
              {isTargetable && (
                <button onClick={() => selectTargetPlayer(playerIndex)} className="btn-secondary text-xs px-2 py-1 self-start">
                  대상 선택
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-950/0 px-2 py-0">
            <div className="restored-resource-pouch">
              <div><Token kind="can" value={player.resources.can} /><small>/{player.maxResources?.can ?? '−'}</small></div>
              <div><Token kind="cap" value={player.resources.bottleCap} /><small>/{player.maxResources?.bottleCap ?? '−'}</small></div>
            </div>

            {(eventBonus > 0 || treasureScore > 0 || eventPenalty > 0) && (
              <div className="mt-2 flex items-center gap-4 text-lg font-semibold">
                {eventBonus > 0 && <div className="text-teal-300">★ +{eventBonus}</div>}
                {treasureScore > 0 && <div className="text-yellow-300">💎 +{treasureScore}</div>}
                {eventPenalty > 0 && <div className="text-rose-300">★ -{eventPenalty}</div>}
              </div>
            )}

            {clueTokens > 0 && (
              <div className="mt-2 flex items-center gap-4 text-lg font-semibold">
                <div className="text-yellow-300">📝 {clueTokens}</div>
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
