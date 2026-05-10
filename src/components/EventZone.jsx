import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { RULES } from '../data/rules.js'

const SCOPE_STYLE = {
  personal: { label: '개인', border: 'border-blue-700', badge: 'bg-blue-900/50 text-blue-300' },
  global:   { label: '전체', border: 'border-yellow-700', badge: 'bg-yellow-900/50 text-yellow-300' },
  disaster: { label: '재난', border: 'border-red-500',    badge: 'bg-red-900/50 text-red-400' },
  clue:     { label: '유토피아 단서', border: 'border-yellow-500', badge: 'bg-yellow-800/60 text-yellow-200' },
}

const REWARD_TEXT = {
  can: '🥫',
  cap: '🪙',
  survivor: '👥',
  score: '★',
  clue: '단서',
  disaster: '재난',
}

const REWARD_BADGE_STYLE = {
  score: { label: '점수', badge: 'bg-emerald-900/50 text-emerald-300' },
  resource: { label: '자원', badge: 'bg-amber-900/50 text-amber-300' },
  encounter: { label: '조우', badge: 'bg-cyan-900/50 text-cyan-300' },
  attack: { label: '공격', badge: 'bg-rose-900/50 text-rose-300' },
  special: { label: '특수', badge: 'bg-violet-900/50 text-violet-300' },
  disaster: { label: '재난', badge: 'bg-rose-950/70 text-rose-400' },
}

const TYPE_TAG_META = {
  반장: { label: '반', className: 'border-blue-500/70 bg-blue-900/70 text-blue-100' },
  용감이: { label: '용', className: 'border-green-500/70 bg-green-900/70 text-green-100' },
  분위기메이커: { label: '분', className: 'border-pink-500/70 bg-pink-900/70 text-pink-100' },
  '4차원': { label: '4', className: 'border-yellow-500/70 bg-yellow-900/70 text-yellow-100' },
  겁쟁이: { label: '겁', className: 'border-purple-500/70 bg-purple-900/70 text-purple-100' },
}

function getActivePartyCount(player) {
  return player?.party?.filter((survivor) => player?.survivorActivity?.[survivor.uid] !== false).length ?? 0
}

function getRequiredSurvivorsForEvent(event) {
  if (!event) return 0
  if (event.resolution?.type === 'roll_dice') return 1
  const tier = event.tier ?? 1
  if (event.assignment?.minSurvivors) return event.assignment.minSurvivors
  return RULES.exploration?.tiers?.[tier]?.minAssigned ?? 1
}

function getMaxSurvivorsForEvent(event) {
  if (!event) return 0
  if (event.resolution?.type === 'roll_dice') return 5
  const tier = event.tier ?? 1
  if (event.assignment?.maxSurvivors) return event.assignment.maxSurvivors
  return RULES.exploration?.tiers?.[tier]?.maxAssigned ?? getRequiredSurvivorsForEvent(event)
}

function getRequiredAssignedTypeForEvent(event) {
  return event?.resolution?.type === 'check_survivor_type'
    ? event.resolution.survivorType
    : null
}

function getAccessibleExplorationTier(player) {
  return player?.unlockedExplorationTier ?? 1
}

function getRewardBadges(event, rewards = []) {
  const keys = []
  if (rewards.some((reward) => reward.type === 'can' || reward.type === 'cap')) keys.push('resource')
  if (rewards.some((reward) => reward.type === 'survivor')) keys.push('encounter')
  if (rewards.some((reward) => reward.type === 'score')) keys.push('score')
  if (event?.scope === 'global' || event?.scope === 'disaster') keys.push('disaster')
  if (keys.length === 0 && event?.category === 'attack') keys.push('attack')
  if (keys.length === 0 && event?.reward === null) keys.push('special')
  return keys.map((key) => REWARD_BADGE_STYLE[key]).filter(Boolean)
}

function getRecommendedPartyBonus(event, player = null) {
  if (!event?.recommendedParty?.length) return 0
  const base = event.recommendedPartyBonus ?? event.resolution?.recommendedPartyBonus ?? event.check?.recommendedPartyBonus ?? 2
  const moodMakerBoost = player?.party?.[2]?.type === '분위기메이커' ? 1 : 0
  return base + moodMakerBoost
}

function getResolutionLabel(event) {
  const resolution = event?.resolution
  if (!resolution) return event?.scope === 'disaster' || event?.scope === 'global' ? '전체' : ''
  if (resolution.type === 'roll_dice') return `🎲 ${resolution.target}+`
  if (resolution.type === 'roll_dice_score_bonus') return `🎲+점수 ${resolution.target}+`
  if (resolution.type === 'pay_can') return `🥫-${resolution.amount}`
  if (resolution.type === 'pay_cap') return `🪙-${resolution.amount}`
  if (resolution.type === 'check_survivor_type') return ''
  if (resolution.type === 'check_survivors_n') return `👥 ${resolution.amount}인`
  if (resolution.type === 'remove_choice') return `이탈 ${resolution.amount ?? 1}`
  if (resolution.type === 'remove_random') return '랜덤 이탈'
  if (resolution.type === 'global_effect') return ''
  if (resolution.type === 'send_survivor_type') return '생존자 파견'
  if (resolution.type === 'send_survivors_n') return `생존자 ${resolution.amount}인 파견`
  return ''
}

function getPenaltyLabel(penalty) {
  if (!penalty) return ''
  if (penalty.type === 'lose_can') return `🥫-${penalty.amount}`
  if (penalty.type === 'lose_cap') return `🪙-${penalty.amount}`
  if (penalty.type === 'remove_random') return `이탈 ${penalty.amount ?? 1}`
  if (penalty.type === 'remove_choice') return `이탈 ${penalty.amount ?? 1}`
  return '패널티'
}

function RewardSummary({ rewards, compact = false }) {
  if (rewards.length === 0) {
    return <span className="text-[10px] text-gray-500">-</span>
  }

  return (
    <span className={`inline-flex flex-wrap items-center ${compact ? 'gap-x-1' : 'gap-1'}`}>
      {rewards.map((reward, index) => (
        <span
          key={`${reward.type}-${index}`}
          className={`inline-flex items-center gap-0.5 font-black ${reward.type === 'disaster' ? 'text-red-400' : 'text-emerald-300'}`}
        >
          <span>{REWARD_TEXT[reward.type] ?? reward.type}</span>
          {typeof reward.amount === 'number' && <span>{reward.amount}</span>}
          {reward.scopeLabel && <span>{reward.scopeLabel}</span>}
        </span>
      ))}
    </span>
  )
}

function getDisplayRewards(event) {
  const base = event?.reward ? (Array.isArray(event.reward) ? event.reward : [event.reward]) : []
  if (event?.category === 'clue') return [{ type: 'clue', amount: 1 }]
  if (event?.scope === 'disaster') return [{ type: 'disaster' }]
  if (base.length > 0) return base

  const effect = event?.globalEffect ?? event?.effect
  if (!effect) return []
  if (effect.type === 'gain_can_all') return [{ type: 'can', amount: effect.amount, scopeLabel: '(전원)' }]
  if (effect.type === 'gain_cap_all') return [{ type: 'cap', amount: effect.amount, scopeLabel: '(전원)' }]
  if (effect.type === 'add_survivors_all') return [{ type: 'survivor', amount: effect.amount, scopeLabel: '(전원)' }]
  return []
}

function RecommendedPartyBadges({ event, compact = false }) {
  const recommended = event?.recommendedParty ?? []
  if (recommended.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center ${compact ? 'justify-center gap-0.5' : 'gap-1'}`}>
      {recommended.map((entry) => {
        const meta = TYPE_TAG_META[entry.type] ?? { label: entry.type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }
        const count = entry.count ?? 1
        return (
          <span
            key={`${entry.type}-${count}`}
            title={`${entry.type} ${count}명`}
            className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[8px] font-black leading-none ${meta.className}`}
          >
            {meta.label}{count > 1 ? count : ''}
          </span>
        )
      })}
    </div>
  )
}

function RecommendedPartyText({ event, bonus }) {
  const recommended = event?.recommendedParty ?? []
  if (recommended.length === 0) return null
  const tokens = recommended.flatMap((entry) => (
    Array.from({ length: entry.count ?? 1 }, (_, index) => ({ ...entry, tokenIndex: index }))
  ))

  return (
    <span className="inline-flex items-center gap-0.5">
      {tokens.map((entry) => {
        const meta = TYPE_TAG_META[entry.type] ?? { label: entry.type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }
        return (
          <span
            key={`${entry.type}-${entry.tokenIndex}`}
            title={entry.type}
            className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[8px] font-black leading-none ${meta.className}`}
          >
            {meta.label}
          </span>
        )
      })}
      <span className="font-black text-amber-300">+{bonus}</span>
    </span>
  )
}

export default function EventZone({ isMyTurn }) {
  const {
    eventSlots, revealedSlots, eventDeck,
    startEventResolution, replaceEventSlot, acceptGlobalEvent, startUtopiaResolution,
    confirmEventAssignment,
    players, currentPlayerIndex,
    phase, interaction, endActionPhase, cancelInteraction, gameEnded, utopiaState, explorationState,
  } = useGameStore()

  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null)

  useEffect(() => {
    if (interaction || !isMyTurn || phase !== 'action') setSelectedSlotIndex(null)
  }, [interaction, isMyTurn, phase])

  const player = players[currentPlayerIndex]
  const totalResolvedClues = players.reduce((sum, current) => sum + (current.clueTokens ?? 0), 0)
  const skipIsFree = player?.party?.[2]?.type === '4차원'
  const activePartyCount = getActivePartyCount(player)
  const canResolve = !gameEnded && isMyTurn && phase === 'action' && !interaction
  const canSkip = !gameEnded && isMyTurn && phase === 'action' && !interaction
  const canMoveToPurchase = !gameEnded && isMyTurn && phase === 'action' && !interaction
  const tierRows = buildTierRows(explorationState?.visibleByTier, eventSlots)
  const accessibleTier = getAccessibleExplorationTier(player)
  const maxUnlockedTier = Math.max(...players.map((p) => p.unlockedExplorationTier ?? 1))
  const tierDeckCounts = {
    1: explorationState?.decksByTier?.[1]?.length ?? eventDeck.filter((event) => (event?.tier ?? 1) === 1).length,
    2: explorationState?.decksByTier?.[2]?.length ?? eventDeck.filter((event) => (event?.tier ?? 1) === 2).length,
    3: explorationState?.decksByTier?.[3]?.length ?? eventDeck.filter((event) => (event?.tier ?? 1) === 3).length,
  }

  return (
    <div className="flex flex-col gap-1.5" onClick={() => setSelectedSlotIndex(null)}>

      <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        {[3, 2, 1].map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            entries={tierRows[tier]}
            revealedSlots={revealedSlots}
            deckCount={tierDeckCounts[tier]}
            isTierLocked={tier > accessibleTier}
            isTierVisibleByOthers={tier > accessibleTier && tier <= maxUnlockedTier}
            isMyTurn={isMyTurn}
            canResolve={canResolve}
            activePartyCount={activePartyCount}
            interaction={interaction}
            canReplace={canSkip}
            replaceIsFree={skipIsFree}
            player={player}
            selectedSlotIndex={selectedSlotIndex}
            onSelectSlot={setSelectedSlotIndex}
            startEventResolution={startEventResolution}
            replaceEventSlot={replaceEventSlot}
            acceptGlobalEvent={acceptGlobalEvent}
            startUtopiaResolution={startUtopiaResolution}
            utopiaState={tier === 3 ? utopiaState : null}
          />
        ))}
      </div>

      {interaction && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-amber-300">
              {getInteractionTitle(interaction)}
            </div>
            <div className="text-xs text-amber-100/80">{getInteractionGuide(interaction, players, currentPlayerIndex)}</div>
          </div>
          <div className="flex gap-2">
            {['assign_event_party', 'assign_utopia_party'].includes(interaction.kind) &&
              interaction.step === 'select_my_survivor' && (() => {
                const selected = interaction.payload.selectedMyUids ?? []
                const minCount = interaction.requiredCount
                const maxCount = interaction.maxCount ?? minCount
                if (selected.length >= minCount && selected.length < maxCount) {
                  return (
                    <button onClick={confirmEventAssignment} className="btn-primary text-xs px-3 py-1">
                      파견 확정 ({selected.length}명)
                    </button>
                  )
                }
                return null
              })()
            }
            {!['upkeep_discard', 'survivor_endturn_escape', 'survivor_endturn_wizard_swap', 'survivor_recruit_magicgirl_take'].includes(interaction.kind) && (
              <button onClick={cancelInteraction} className="btn-secondary text-xs px-3 py-1">
                취소
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">주변 탐색</span>
        <span className="text-xs text-gray-600">활성 생존자 {activePartyCount}명</span>
        <span className="text-xs text-yellow-300/80">유토피아 단서 {totalResolvedClues}/{RULES.clueTarget}</span>
      </div>

      {canMoveToPurchase && (
        <button onClick={endActionPhase} className="btn-secondary text-xs px-3 py-1 w-full mt-1">
          파티 정비 단계로
        </button>
      )}
    </div>
  )
}

function buildTierRows(visibleByTier = {}, eventSlots = []) {
  const byTier = { 1: [], 2: [], 3: [] }
  ;[1, 2, 3].forEach((tier) => {
    const cards = visibleByTier?.[tier]?.length
      ? visibleByTier[tier]
      : eventSlots.filter((event) => event && (event.tier ?? 1) === tier)
    cards.forEach((event) => {
      if (!event) return
      const slotIndex = eventSlots.findIndex((candidate) => candidate?.uid === event.uid)
      if (slotIndex < 0) return
      byTier[tier].push({ event, slotIndex })
    })
  })
  return byTier
}

function getTierMeta(tier) {
  return {
    1: {
      label: '1단계',
      subtitle: '근처 탐색',
      color: 'border-emerald-800 bg-emerald-950/20 text-emerald-300',
      deckCard: 'border-emerald-700 bg-emerald-950/35 text-emerald-200',
    },
    2: {
      label: '2단계',
      subtitle: '외곽 탐색',
      color: 'border-amber-800 bg-amber-950/20 text-amber-300',
      deckCard: 'border-amber-700 bg-amber-950/35 text-amber-200',
    },
    3: {
      label: '3단계',
      subtitle: '먼 곳 탐색',
      color: 'border-rose-800 bg-rose-950/20 text-rose-300',
      deckCard: 'border-rose-700 bg-rose-950/35 text-rose-200',
    },
  }[tier]
}

function TierRow({
  tier,
  entries,
  revealedSlots,
  deckCount,
  isTierLocked,
  isTierVisibleByOthers,
  isMyTurn,
  canResolve,
  activePartyCount,
  interaction,
  canReplace,
  replaceIsFree,
  player,
  selectedSlotIndex,
  onSelectSlot,
  startEventResolution,
  replaceEventSlot,
  acceptGlobalEvent,
  startUtopiaResolution,
  utopiaState,
}) {
  const meta = getTierMeta(tier)
  const paddedEntries = Array.from({ length: 4 }, (_, index) => entries[index] ?? null)

  return (
    <div className={`rounded-xl border px-2 py-2 ${
      isTierLocked && !isTierVisibleByOthers
        ? 'border-gray-800/70 bg-gray-950/20 opacity-70'
        : isTierLocked
        ? 'border-gray-700/50 bg-gray-950/20'
        : 'border-gray-800 bg-gray-950/35'
    }`}>
      <div className="flex gap-1.5 items-stretch overflow-x-auto">
        <TierDeckPile tier={tier} deckCount={deckCount} />
        {paddedEntries.map((entry, index) => {
          if (!entry) {
            return <EmptyExplorationSlot key={`${tier}-empty-${index}`} tier={tier} />
          }
          const isViewOnly = !!(isTierVisibleByOthers && isTierLocked)
          return (
            <EventSlot
              key={`${tier}-${entry.slotIndex}`}
              slotIndex={entry.slotIndex}
              event={entry.event}
              isRevealed={isViewOnly || (!isTierLocked && revealedSlots[entry.slotIndex])}
              isMyTurn={isMyTurn}
              canResolve={canResolve}
              activePartyCount={activePartyCount}
              isResolving={interaction?.slotIndex === entry.slotIndex}
              canReplace={canReplace}
              replaceIsFree={replaceIsFree}
              isUtopiaSlot={entry.event?.category === 'clue'}
              isLocked={isTierLocked}
              isViewOnly={isViewOnly}
              player={player}
              isSelected={selectedSlotIndex === entry.slotIndex}
              onSelect={() => onSelectSlot(entry.slotIndex)}
              onDeselect={() => onSelectSlot(null)}
              onResolve={() => { startEventResolution(entry.slotIndex); onSelectSlot(null) }}
              onReplace={() => replaceEventSlot(entry.slotIndex)}
              onAcceptGlobal={() => acceptGlobalEvent(entry.slotIndex)}
            />
          )
        })}
        {utopiaState && (
          <UtopiaSlot
            utopiaState={utopiaState}
            player={player}
            isMyTurn={isMyTurn}
            canResolve={canResolve}
            activePartyCount={activePartyCount}
            onResolve={startUtopiaResolution}
          />
        )}
      </div>
      {isTierLocked && (
        <div className="mt-1 text-[11px] text-gray-500">
          {isTierVisibleByOthers ? '다른 플레이어가 해금한 단계입니다. 단서를 확보해야 직접 수행할 수 있습니다.' : '이전 단계 단서를 확보해야 접근할 수 있습니다.'}
        </div>
      )}
    </div>
  )
}

function TierDeckPile({ tier, deckCount }) {
  const meta = getTierMeta(tier)
  return (
    <div className={`flex flex-col items-center justify-center w-24 h-60 rounded-lg border-2 gap-1 shrink-0 ${meta.deckCard}`}>
      <div className="text-3xl">🂠</div>
      <div className="text-xs font-semibold">{meta.label}</div>
      <div className="text-[11px] opacity-80">{meta.subtitle}</div>
      <div className="mt-1 text-[11px] font-medium opacity-80">{deckCount}장</div>
    </div>
  )
}

function EmptyExplorationSlot({ tier }) {
  return (
    <div className="w-36 h-60 rounded-lg border-2 border-dashed border-gray-800 bg-gray-950/50 flex items-center justify-center shrink-0">
      <span className="text-xs text-gray-700">{tier}단계 빈 슬롯</span>
    </div>
  )
}

function UtopiaSlot({ utopiaState, player, isMyTurn, canResolve, activePartyCount, onResolve }) {
  const revealedCard = utopiaState?.revealedForLeaderId
    ? utopiaState.cardsByLeaderId?.[utopiaState.revealedForLeaderId]
    : null

  if (utopiaState?.revealed && revealedCard) {
    const hasEnoughAssigned = activePartyCount >= 1
    const isClaimed = utopiaState.claimed
    const recommendedBonus = getRecommendedPartyBonus(revealedCard, player)
    const target = revealedCard.check?.target ?? revealedCard.resolution?.target ?? 15
    return (
      <div className="w-36 h-60 rounded-lg border-2 border-yellow-600 bg-yellow-950/20 flex flex-col items-center justify-center gap-2 p-3 shrink-0">
        <div className="text-3xl">{revealedCard.emoji ?? '🌅'}</div>
        <div className="text-center text-sm font-semibold text-yellow-200">{revealedCard.name}</div>
        <div className="text-center text-[11px] text-yellow-100/70">
          {isClaimed ? '획득 완료' : `최종 도전 · 🎲 ${target}+`}
        </div>
        {revealedCard.recommendedParty?.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            <RecommendedPartyBadges event={revealedCard} compact />
            <span className="text-[10px] text-yellow-100/55">추천 +{recommendedBonus}</span>
          </div>
        )}
        {isMyTurn && !isClaimed && (
          <button
            onClick={onResolve}
            disabled={!canResolve || !hasEnoughAssigned}
            className="btn-primary text-[10px] py-1 w-full disabled:opacity-50 mt-auto"
          >
            {!hasEnoughAssigned ? '인원 부족' : canResolve ? '유토피아 도전' : '행동 소진'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="w-36 h-60 rounded-lg border-2 border-dashed border-yellow-800 bg-yellow-950/20 flex flex-col items-center justify-center gap-2 shrink-0">
      <div className="text-3xl">🂠</div>
      <div className="text-sm font-semibold text-yellow-300">유토피아</div>
      <div className="text-[11px] text-yellow-100/60 text-center px-2">3단계 단서 최초 획득 시 공개</div>
    </div>
  )
}

function EventSlot({ event, isRevealed, isMyTurn, canResolve, activePartyCount, isResolving, canReplace, replaceIsFree, isUtopiaSlot, isLocked, isViewOnly, player, isSelected, onSelect, onDeselect, onResolve, onReplace, onAcceptGlobal }) {
  if (!event) {
    return (
      <div className="w-36 h-60 rounded-lg border-2 border-dashed border-gray-800 bg-gray-950/50 flex items-center justify-center shrink-0">
        <span className="text-xs text-gray-700">슬롯 비어있음</span>
      </div>
    )
  }

  if (!isRevealed) {
    return (
      <div className={`w-36 h-60 rounded-lg border-2 border-dashed bg-gray-900/60 flex flex-col items-center justify-center gap-2 relative overflow-hidden shrink-0 ${isLocked ? 'border-gray-800 opacity-40' : 'border-gray-600'}`}>
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #666 0, #666 1px, transparent 0, transparent 50%)',
            backgroundSize: '8px 8px',
          }}
        />
        {isLocked ? (
          <>
            <span className="text-3xl z-10">🔒</span>
            <span className="text-xs text-gray-600 z-10 text-center px-2">이전 단계 단서 필요</span>
          </>
        ) : (
          <>
            <span className="text-3xl z-10">❓</span>
            <span className="text-xs text-gray-500 z-10">사건 발견</span>
          </>
        )}
      </div>
    )
  }

  const style = isUtopiaSlot ? SCOPE_STYLE.clue : (event.category === 'clue' ? SCOPE_STYLE.clue : (SCOPE_STYLE[event.scope] ?? SCOPE_STYLE.personal))
  const rewards = getDisplayRewards(event)
  const rewardBadges = getRewardBadges(event, rewards)
  const requiredAssignedType = getRequiredAssignedTypeForEvent(event)
  const hasEnoughAssigned = activePartyCount >= getRequiredSurvivorsForEvent(event)
  const recommendedBonus = getRecommendedPartyBonus(event, player)
  const resolutionLabel = getResolutionLabel(event)
  const penaltyLabel = getPenaltyLabel(event.failPenalty)

  const requiredPartyType = event.requiredType ?? null
  const hasRequiredType = !requiredPartyType || (player?.party?.some((s) => s.type === requiredPartyType) ?? false)
  const isPersonalResolvable = event.scope === 'personal' && !event.autoStartOnReveal
  const isDisabled = isLocked || !canResolve || !hasEnoughAssigned || !hasRequiredType
  const canSelect = isPersonalResolvable && isMyTurn && !isDisabled && !isViewOnly

  function handleCardClick() {
    if (!canSelect) return
    if (isSelected) {
      onResolve()
    } else {
      onSelect()
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className={[
        'w-36 h-60 rounded-lg border-2 bg-gray-900 flex flex-col p-2 relative shrink-0 overflow-hidden transition-all',
        isSelected ? 'border-amber-400 brightness-110' : isResolving ? 'border-amber-600' : style.border,
        isViewOnly ? 'opacity-55' : isDisabled && !isResolving ? 'opacity-40' : '',
        canSelect ? 'cursor-pointer hover:brightness-110' : '',
      ].filter(Boolean).join(' ')}
    >
      {!isViewOnly && isMyTurn && event.scope === 'personal' && event.category !== 'clue' && !event.autoStartOnReveal && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReplace() }}
          disabled={isLocked || !canReplace}
          title={replaceIsFree ? '넘기기 (벌점 없음)' : '넘기기 (-1점)'}
          className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-gray-700 bg-gray-950/85 text-[13px] font-black leading-none text-gray-400 shadow-sm hover:border-rose-500 hover:text-rose-300 disabled:opacity-30"
        >
          ×
        </button>
      )}

      {isViewOnly && (
        <div className="absolute inset-x-0 top-0 z-10 bg-gray-900/80 text-center text-[9px] font-black text-gray-400 py-0.5 tracking-wide">
          🔒 단서 필요
        </div>
      )}
      {isSelected && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-amber-500/90 text-center text-[10px] font-black text-gray-950 py-0.5 tracking-wide">
          한 번 더 눌러 해결
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-0.5 border-b border-gray-800/80 pb-1">
        <div
          className="flex min-h-8 items-center text-[18px] leading-tight"
          title={`획득 ${rewards.map((reward) => `${REWARD_TEXT[reward.type] ?? reward.type}${typeof reward.amount === 'number' ? ` ${reward.amount}` : ''}`).join(', ') || '-'}`}
        >
          <RewardSummary rewards={rewards} compact />
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          {event.category === 'clue' && (
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full leading-none ${SCOPE_STYLE.clue.badge}`}>
              유토피아 단서
            </span>
          )}
          {rewardBadges.map((badge) => (
            <span key={badge.label} className={`text-[8px] font-bold px-1 py-0.5 rounded-full leading-none ${badge.badge}`}>
              {badge.label}
            </span>
          ))}
          {(event.scope === 'global' || event.scope === 'disaster') && (
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full leading-none ${SCOPE_STYLE.global.badge}`}>
              전체
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded bg-gray-950/45 px-1.5 py-1.5 mt-1 flex flex-col gap-1">
        <div className="text-center text-[13px] font-black leading-tight text-gray-100 line-clamp-2">
          {event.name}
        </div>
        <div className="text-[10px] leading-snug text-gray-300 line-clamp-6">
          {event.description}
        </div>
      </div>

      <div className="mt-1.5 shrink-0 rounded bg-gray-950/70 px-1.5 py-1 text-[10px] leading-snug shadow-inner">
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1 flex items-center gap-1 overflow-hidden">
            <span className="font-black text-sky-500 shrink-0">조건</span>
            {resolutionLabel && !(requiredPartyType && resolutionLabel === '특수') ? <span className="font-bold text-sky-200 shrink-0">{resolutionLabel}</span> : null}
            {requiredPartyType && (() => {
              const meta = TYPE_TAG_META[requiredPartyType] ?? { label: requiredPartyType.slice(0, 1), className: 'border-gray-500 bg-gray-800 text-gray-100' }
              return (
                <span
                  title={`${requiredPartyType} 필수`}
                  className={`inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full border px-1 text-[8px] font-black leading-none ${meta.className}`}
                >
                  {meta.label}
                </span>
              )
            })()}
            {requiredAssignedType && !requiredPartyType && (
              <span className="font-bold text-sky-200 truncate">{requiredAssignedType}</span>
            )}
          </div>
          {event.recommendedParty?.length > 0 && (event.resolution?.type === 'roll_dice' || event.resolution?.type === 'roll_dice_score_bonus') && (
            <div className="shrink-0 truncate text-right">
              <RecommendedPartyText event={event} bonus={recommendedBonus} />
            </div>
          )}
        </div>
        <div className="mt-0.5 truncate border-t border-gray-800/70 pt-0.5">
          <span className="font-black text-rose-500">실패</span>{' '}
          <span className="font-bold text-rose-300">{penaltyLabel || '-'}</span>
        </div>
      </div>

      {event.affinityBonus && (
        <div className="shrink-0 text-xs text-green-500 truncate">{event.affinityBonus.desc}</div>
      )}

      {/* 필수 이벤트 버튼 (autoStartOnReveal) */}
      {!isViewOnly && isMyTurn && event.scope === 'personal' && event.autoStartOnReveal && (
        <div className="shrink-0 pt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onResolve() }}
            disabled={isLocked || !canResolve || !hasEnoughAssigned}
            className="btn-primary text-[10px] py-1 w-full disabled:opacity-50 bg-rose-700 hover:bg-rose-600 border-rose-600"
          >
            {isLocked ? '단서 필요' : isResolving ? '진행 중' : !hasEnoughAssigned ? '인원 부족' : '받아들이기(필수)'}
          </button>
        </div>
      )}

      {!isViewOnly && event.scope !== 'personal' && (
        <div className="shrink-0 pt-0.5">
          {isMyTurn ? (
            <button
              onClick={(e) => { e.stopPropagation(); onAcceptGlobal() }}
              disabled={isLocked}
              className="btn-primary text-[10px] py-1 w-full bg-rose-700 hover:bg-rose-600 border-rose-600"
            >
              {isLocked ? '단서 필요' : '받아들이기(필수)'}
            </button>
          ) : (
            <div className="text-xs text-gray-600 italic">⚡ 전체 발동 대기 중</div>
          )}
        </div>
      )}
    </div>
  )
}

function getInteractionTitle(interaction) {
  if (interaction.kind === 'assign_event_party') return '주변 탐색 파견'
  if (interaction.kind === 'assign_utopia_party') return '유토피아 최종 도전'
  if (interaction.kind === 'upkeep_discard') return '턴 종료 정산'
  if (interaction.kind === 'leader_skill_robot_search') return '지도자 스킬 · 행복수치 계산'
  if (interaction.kind === 'leader_skill_zombie_steal') return '지도자 스킬 · 자신감있는 좀비행동'
  if (interaction.kind === 'leader_skill_duck_absorb') return '지도자 스킬 · 오리의 기적'
  if (interaction.kind === 'survivor_endturn_escape') return '생존자 능력 · 탈옥'
  if (interaction.kind === 'survivor_endturn_wizard_swap') return '생존자 능력 · 위치 왜곡'
  if (interaction.kind === 'survivor_recruit_magicgirl_take') return '생존자 능력 · 마법소녀 합류'
  if (interaction.kind === 'survivor_skill_wizard') return '생존자 능력 · 마법사 분리 마법'
  return interaction.event ? `${interaction.event.emoji} ${interaction.event.name}` : '능력 사용'
}

function getInteractionGuide(interaction, players, currentPlayerIndex) {
  if (interaction.kind === 'assign_event_party') {
    const min = interaction.requiredCount
    const max = interaction.maxCount ?? min
    const rangeStr = min === max ? `${min}명` : `${min}~${max}명`
    if (interaction.event?.resolution?.type === 'roll_dice') {
      return `${interaction.event?.name ?? '주변 탐색'}에 파견할 활성 생존자를 ${rangeStr} 선택하세요. 선택한 수만큼 주사위를 굴립니다.`
    }
    if (interaction.event?.resolution?.type === 'roll_dice_score_bonus') {
      return `${interaction.event?.name ?? '주변 탐색'}에 파견할 활성 생존자를 ${rangeStr} 선택하세요. 주사위 합 + 파티 총점으로 판정합니다.`
    }
    return `${interaction.event?.name ?? '주변 탐색'}에 파견할 활성 생존자 ${rangeStr}을 선택하세요.`
  }
  if (interaction.kind === 'assign_utopia_party') {
    const min = interaction.requiredCount
    const max = interaction.maxCount ?? min
    const rangeStr = min === max ? `${min}명` : `${min}~${max}명`
    return `${interaction.event?.name ?? '유토피아'}에 파견할 활성 생존자를 ${rangeStr} 선택하세요. 선택한 수만큼 주사위를 굴립니다.`
  }
  if (interaction.kind === 'upkeep_discard') {
    return `통조림이 부족합니다. 내 파티에서 버릴 생존자 ${interaction.requiredCount}명을 선택하세요.`
  }
  if (interaction.kind === 'leader_skill_robot_search') {
    return interaction.payload?.mode === 'recruit_from_deck'
      ? '덱에서 확인한 생존자 2장 중 영입할 1장을 선택하세요.'
      : '확인한 생존자 2장 중 수색 슬롯에 남길 1장을 선택하세요.'
  }
  if (interaction.kind === 'leader_skill_zombie_steal') {
    if (interaction.step === 'select_target_player') return '흡수할 생존자가 있는 대상 플레이어를 선택하세요.'
    return `${players[interaction.payload?.targetPlayerIndex]?.name ?? '대상 플레이어'}의 파티에서 흡수할 생존자 1명을 선택하세요.`
  }
  if (interaction.kind === 'leader_skill_duck_absorb') {
    if (interaction.step === 'select_target_player') return '🪙6개를 사용해 흡수할 대상 플레이어를 선택하세요. 취소하면 사용하지 않습니다.'
    return `${players[interaction.payload?.targetPlayerIndex]?.name ?? '대상 플레이어'}의 파티에서 흡수할 생존자 1명을 선택하세요.`
  }
  if (interaction.kind === 'survivor_endturn_escape') {
    return '탈옥 생존자가 이동할 대상 파티를 선택하세요.'
  }
  if (interaction.kind === 'survivor_endturn_wizard_swap') {
    if (interaction.step === 'select_target_player') return '위치를 바꿀 대상 플레이어를 선택하세요.'
    return `${players[interaction.payload?.targetPlayerIndex]?.name ?? '대상 플레이어'}의 파티에서 위치를 교체할 생존자 1명을 선택하세요.`
  }
  if (interaction.kind === 'survivor_recruit_magicgirl_take') {
    if (interaction.step === 'select_target_player') return '평범 생존자를 데려올 대상 플레이어를 선택하세요.'
    return `${players[interaction.payload?.targetPlayerIndex]?.name ?? '대상 플레이어'}의 파티에서 데려올 평범 생존자 1명을 선택하세요.`
  }
  if (interaction.kind === 'survivor_skill_wizard') {
    if (interaction.step === 'select_target_player') return '분리 마법을 사용할 대상 플레이어를 선택하세요.'
    return `${players[interaction.payload?.targetPlayerIndex]?.name ?? '대상 플레이어'}의 파티에서 제거할 생존자 1명을 선택하세요.`
  }

  const currentPlayer = players[currentPlayerIndex]
  const targetPlayer = interaction.payload.targetPlayerIndex !== null
    ? players[interaction.payload.targetPlayerIndex]
    : null

  switch (interaction.step) {
    case 'select_my_survivor':
      if (interaction.event.resolution.type === 'send_survivor_type') {
        return `내 파티에서 ${interaction.event.resolution.survivorType} 생존자를 선택하세요.`
      }
      return `내 파티에서 생존자 ${interaction.event.resolution.amount ?? 1}명을 선택하세요.`
    case 'select_target_player':
      return '대상 플레이어를 선택하세요.'
    case 'select_target_survivor':
      return `${targetPlayer?.name ?? '대상 플레이어'}의 파티에서 생존자 1명을 선택하세요.`
    case 'select_swap_a':
      return interaction.event.resolution.type === 'reorder_my_party'
        ? `${currentPlayer?.name ?? '내 파티'}에서 첫 번째로 바꿀 생존자를 선택하세요.`
        : `${targetPlayer?.name ?? '대상 플레이어'}의 파티에서 첫 번째 생존자를 선택하세요.`
    case 'select_swap_b':
      return interaction.event.resolution.type === 'reorder_my_party'
        ? `${currentPlayer?.name ?? '내 파티'}에서 두 번째 생존자를 선택하세요.`
        : `${targetPlayer?.name ?? '대상 플레이어'}의 파티에서 두 번째 생존자를 선택하세요.`
    case 'select_grave_survivor':
      if (interaction.event.resolution.type === 'revive_from_grave') {
        return '떠난 생존자 더미에서 부활시킬 생존자를 선택하세요.'
      }
      return '떠난 생존자 더미에서 데려올 생존자를 선택하세요.'
    default:
      return '이벤트를 해결 중입니다.'
  }
}
