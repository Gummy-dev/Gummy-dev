import { useState } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { calcPartyScore } from '../logic/scoring.js'

const TYPE_COLOR = {
  반장: 'border-blue-500 bg-blue-950/40',
  분위기메이커: 'border-pink-500 bg-pink-950/40',
  용감이: 'border-green-500 bg-green-950/40',
  '4차원': 'border-yellow-500 bg-yellow-950/40',
  겁쟁이: 'border-purple-500 bg-purple-950/40',
  평범: 'border-gray-500 bg-gray-900/40',
}

const TYPE_BADGE_COLOR = {
  반장: 'bg-blue-800 text-blue-200',
  분위기메이커: 'bg-pink-800 text-pink-200',
  용감이: 'bg-green-800 text-green-200',
  '4차원': 'bg-yellow-800 text-yellow-200',
  겁쟁이: 'bg-purple-800 text-purple-200',
  평범: 'bg-gray-700 text-gray-300',
}

const TYPE_HINT_BADGE_COLOR = {
  반장: 'border-blue-400/40 bg-blue-900/30 text-blue-100/80',
  용감이: 'border-green-400/40 bg-green-900/30 text-green-100/80',
  분위기메이커: 'border-pink-400/40 bg-pink-900/30 text-pink-100/80',
  '4차원': 'border-yellow-400/40 bg-yellow-900/30 text-yellow-100/80',
  겁쟁이: 'border-purple-400/40 bg-purple-900/30 text-purple-100/80',
}

const COMMON_UPKEEP_TEXT = '파티 정비: 통조림을 소모해 재활성화'

function getDisplayEffect(effect = '') {
  if (!effect) return ''
  const legacyPrefix = '턴 시작: 병뚜껑 1 획득 / 파티 정비: 통조림을 소모해 재활성화'
  if (effect === legacyPrefix) return ''
  if (effect.startsWith(`${legacyPrefix} / `)) {
    return effect.slice(`${legacyPrefix} / `.length)
  }
  if (effect === COMMON_UPKEEP_TEXT) return ''
  if (effect.startsWith(`${COMMON_UPKEEP_TEXT} / `)) {
    return effect.slice(`${COMMON_UPKEEP_TEXT} / `.length)
  }
  return effect
}

function getPartyDisplayGroups(party = [], breakdown = []) {
  const groups = []

  party.forEach((survivor, index) => {
    const lastGroup = groups[groups.length - 1]
    const stackKey = survivor.stackGroupKey ?? null
    if (stackKey && lastGroup?.stackGroupKey === stackKey) {
      lastGroup.members.push(survivor)
      lastGroup.indices.push(index)
      lastGroup.edgeRight = breakdown[index]?.edgeRight ?? 0
      return
    }

    groups.push({
      key: stackKey ? `stack:${stackKey}` : survivor.uid,
      stackGroupKey: stackKey,
      members: [survivor],
      indices: [index],
      edgeRight: breakdown[index]?.edgeRight ?? 0,
    })
  })

  return groups
}

function getSlotHint(slotIndex) {
  if (slotIndex <= 1) {
    return {
      zone: '앞쪽',
      tags: [{ type: '반장', label: '반' }, { type: '용감이', label: '용' }],
      detail: '반장 배치시 순서 변경 비용 -1',
    }
  }
  if (slotIndex === 2) {
    return {
      zone: '중앙',
      tags: [{ type: '분위기메이커', label: '분' }, { type: '4차원', label: '4' }],
      detail: '배치시 추천 보너스 +1 / 넘기기 무료',
    }
  }
  return {
    zone: '뒤쪽',
    tags: [{ type: '겁쟁이', label: '겁' }],
    detail: '배치시 재활성화 비용 무료',
  }
}

function SlotHint({ slotIndex, compact = false }) {
  const hint = getSlotHint(slotIndex)
  return (
    <div className={`pointer-events-none absolute inset-x-3 z-0 select-none text-left opacity-35 ${compact ? 'bottom-1' : 'bottom-4'}`}>
      <div className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-black tracking-wide text-white/70`}>
        {slotIndex + 1}번 : {hint.zone}
      </div>
      <div className="mt-1 flex items-start justify-start gap-1">
        <div className="flex items-center gap-1 shrink-0">
          {hint.tags.map(({ type, label }) => (
            <span
              key={type}
              className={`rounded-full border px-1.5 py-0.5 ${compact ? 'text-[7px]' : 'text-[8px]'} font-black leading-none ${TYPE_HINT_BADGE_COLOR[type]}`}
            >
              {label}
            </span>
          ))}
        </div>
        {!compact && (
          <div className="text-[8px] font-semibold leading-tight text-white/65 flex flex-col">
            {Array.isArray(hint.detail)
              ? hint.detail.map((line, i) => <span key={i}>{line}</span>)
              : <span>{hint.detail}</span>
            }
          </div>
        )}
      </div>
    </div>
  )
}

function getUsedPartySlotCount(party = []) {
  return getPartyDisplayGroups(party).length
}

function getPartyReorderCostReduction(party = []) {
  return party.reduce((sum, survivor, index) => {
    let next = sum
    if (survivor.type === '반장' && index <= 1) {
      next += 1
    }
    if (survivor.partyPassive?.type === 'reduce_reorder_cost') {
      next += survivor.partyPassive.amount ?? 0
    }
    return next
  }, 0)
}

function getReactivationCost(player, survivor, survivorIndex) {
  const base = survivor.reactivationCost
    ? (typeof survivor.reactivationCost === 'number' ? { can: survivor.reactivationCost } : survivor.reactivationCost)
    : { can: 1 }

  if (survivor.type === '겁쟁이' && survivorIndex >= 3) {
    return { ...base, can: Math.max(0, (base.can ?? 0) - 1) }
  }

  return { can: base.can ?? 0, bottleCap: base.bottleCap ?? 0 }
}

function getRequiredAssignedType(interaction) {
  return interaction?.kind === 'assign_event_party' && interaction?.event?.resolution?.type === 'check_survivor_type'
    ? interaction.event.resolution.survivorType
    : null
}

export default function PartySlot({ playerIndex, isEditable, compact = false, showSummary = true }) {
  const {
    players,
    currentPlayerIndex,
    phase,
    interaction,
    swapPartyMembers,
    returnPartySurvivorToMercenary,
    reactivateSurvivor,
    selectMySurvivor,
    selectTargetSurvivor,
    selectSwapSurvivor,
  } = useGameStore()
  const player = players[playerIndex]
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  if (!player) return null
  const canLocalResolveInteraction = currentPlayerIndex === 0 && !players[currentPlayerIndex]?.isBot

  const { total, breakdown } = calcPartyScore(player.party, player.leaderId)
  const eventBonus = player.scoreTokens ?? 0
  const penalty = player.abandonedEvents?.length ?? 0
  const finalScore = total + eventBonus - penalty

  function handleDragStart(i) { setDragging(i) }
  function handleDragOver(e, i) { e.preventDefault(); setDragOver(i) }
  function handleDrop(i) {
    if (!isEditable) { setDragging(null); setDragOver(null); return }
    if (dragging === null || dragging === i) { setDragging(null); setDragOver(null); return }
    swapPartyMembers(playerIndex, dragging, i)
    setDragging(null)
    setDragOver(null)
  }

  function getInteractionRole(uid) {
    if (!interaction) return null
    if (!canLocalResolveInteraction) return null

    if (interaction.step === 'select_my_survivor' && playerIndex === currentPlayerIndex) {
      const currentPlayer = players[currentPlayerIndex]
      const target = currentPlayer?.party?.find((survivor) => survivor.uid === uid)
      if (
        (interaction.kind === 'assign_event_party' || interaction.kind === 'assign_search_party' || interaction.kind === 'assign_utopia_party') &&
        currentPlayer?.survivorActivity?.[uid] === false
      ) {
        return null
      }
      const requiredType = getRequiredAssignedType(interaction)
      if (requiredType && interaction.kind === 'assign_event_party') {
        const selected = interaction.payload.selectedMyUids ?? []
        const selectedHasRequired = selected
          .map((selectedUid) => currentPlayer?.party?.find((survivor) => survivor.uid === selectedUid))
          .some((survivor) => survivor?.type === requiredType)
        const isSelected = selected.includes(uid)
        const remainingAfterThis = (interaction.maxCount ?? interaction.requiredCount) - selected.length
        if (!isSelected && !selectedHasRequired && remainingAfterThis <= 1 && target?.type !== requiredType) {
          return null
        }
      }
      return interaction.payload.selectedMyUids.includes(uid) ? 'selected' : 'selectable'
    }

    if (interaction.step === 'select_target_survivor' && playerIndex === interaction.payload.targetPlayerIndex) {
      const targetSurvivor = player.party.find((survivor) => survivor.uid === uid)
      if (interaction.kind === 'survivor_recruit_magicgirl_take' && targetSurvivor?.type !== '평범') {
        return null
      }
      if (interaction.event?.category === 'attack') {
        if (targetSurvivor?.id === 's_coward_4') return null
        if (targetSurvivor?.id === 's_coward_1' && player.party.length > 1) return null
      }
      return interaction.payload.targetSurvivorUid === uid ? 'selected' : 'selectable'
    }

    if (!interaction.event) return null

    const isSwapTarget =
      (interaction.event.resolution.type === 'reorder_my_party' && playerIndex === currentPlayerIndex) ||
      (interaction.event.resolution.type === 'reorder_other_party' && playerIndex === interaction.payload.targetPlayerIndex)

    if ((interaction.step === 'select_swap_a' || interaction.step === 'select_swap_b') && isSwapTarget) {
      return interaction.payload.swapA === uid || interaction.payload.swapB === uid ? 'selected' : 'selectable'
    }

    return null
  }

  function handleSelect(uid) {
    if (!interaction) return
    if (!canLocalResolveInteraction) return

    if (interaction.step === 'select_my_survivor' && playerIndex === currentPlayerIndex) {
      selectMySurvivor(uid)
    }

    if (interaction.step === 'select_target_survivor' && playerIndex === interaction.payload.targetPlayerIndex) {
      selectTargetSurvivor(uid)
    }

    if (!interaction.event) return

    const isSwapTarget =
      (interaction.event.resolution.type === 'reorder_my_party' && playerIndex === currentPlayerIndex) ||
      (interaction.event.resolution.type === 'reorder_other_party' && playerIndex === interaction.payload.targetPlayerIndex)

    if ((interaction.step === 'select_swap_a' || interaction.step === 'select_swap_b') && isSwapTarget) {
      selectSwapSurvivor(uid)
    }
  }

  return (
    <div>
      {/* 파티 점수 */}
      {showSummary && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">파티 점수</span>
          <div className="text-right">
            <span className="text-lg font-bold text-amber-300">{finalScore}점</span>
            {eventBonus > 0 && <div className="text-[11px] text-emerald-400">해결 이벤트 +{eventBonus}</div>}
            {penalty > 0 && <div className="text-[11px] text-red-400">이벤트 벌점 -{penalty}</div>}
          </div>
        </div>
      )}

      {/* 생존자 슬롯 */}
      <div className={`flex gap-2 overflow-x-auto overflow-y-visible pb-1 ${compact ? 'min-h-[72px]' : 'min-h-[208px]'}`}>
        {getPartyDisplayGroups(player.party, breakdown).flatMap((group, slotIndex, groups) => {
          const survivor = group.members[0]
          const i = group.indices[0]
          const interactionRole = getInteractionRole(survivor.uid)
          const canInteract = interactionRole === 'selectable' || interactionRole === 'selected'
          const displayEffect = getDisplayEffect(survivor.effect)
          const stackPreviewCount = Math.min(Math.max(0, group.members.length - 1), 3)
          const isActiveNow = player.survivorActivity?.[survivor.uid] !== false
          const reactivationCost = getReactivationCost(player, survivor, i)
          const canReactivate =
            !compact &&
            isEditable &&
            playerIndex === currentPlayerIndex &&
            phase === 'party_maintenance' &&
            !interaction &&
            !isActiveNow &&
            (player.resources.can ?? 0) >= (reactivationCost.can ?? 0) &&
            (player.resources.bottleCap ?? 0) >= (reactivationCost.bottleCap ?? 0)
          const baseCardClass = `${compact ? 'w-16 h-[60px] p-2 text-center' : 'w-44 h-[19.25rem] p-3 text-left'} ${TYPE_COLOR[survivor.type] ?? 'border-gray-600 bg-gray-800'}`
          const canReturnPartySurvivor =
            !compact &&
            isEditable &&
            playerIndex === currentPlayerIndex &&
            phase === 'party_maintenance' &&
            !interaction

          const cardEl = (
            <div key={group.key} className={`relative shrink-0 ${compact ? 'pb-4' : 'pb-10'}`}>
              {stackPreviewCount > 0 && Array.from({ length: stackPreviewCount }).map((_, stackIndex) => (
                <div
                  key={`${group.key}-stack-${stackIndex}`}
                  className={`absolute left-0 right-0 border-2 rounded-[1.15rem] ${baseCardClass} opacity-80 brightness-75 pointer-events-none`}
                  style={{
                    transform: `translateY(${compact ? 8 : 16}px) translateX(${(stackIndex + 1) * 2}px)`,
                    zIndex: stackIndex,
                  }}
                />
              ))}
              <div
                draggable={isEditable && !interaction}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onClick={() => canInteract && handleSelect(survivor.uid)}
                className={`relative z-10 overflow-hidden border-2 rounded-[1.15rem] cursor-grab transition-all flex flex-col ${baseCardClass} ${isActiveNow ? '' : 'opacity-70 saturate-75'}
                  ${dragOver === i ? 'scale-105 border-amber-400' : ''}
                  ${canInteract ? 'cursor-pointer ring-1 ring-sky-700/60 hover:border-sky-400' : ''}
                  ${interactionRole === 'selected' ? 'border-sky-400 ring-2 ring-sky-500/70' : ''}
                `}
              >
              {compact && (
                <>
                  <div className="text-sm text-gray-500 absolute top-1 left-1.5">#{slotIndex + 1}</div>
                  <div className="text-2xl mt-3">{survivor.emoji}</div>
                  <div className="text-xs font-semibold text-gray-200 mt-1 leading-tight">{survivor.name}</div>
                  {group.members.length > 1 && <div className="text-[10px] text-yellow-300">x{group.members.length}</div>}
                  <div className="mt-1 text-xs">
                    <span className="text-gray-400">기본 {survivor.score}</span>
                  </div>
                </>
              )}

              {!compact && (
                <>
                  {canReturnPartySurvivor && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        returnPartySurvivorToMercenary(survivor.uid)
                      }}
                      className="absolute right-2 top-2 z-20 rounded-md bg-gray-950/85 px-2 py-1 text-[10px] text-amber-200 border border-amber-700/60 hover:bg-gray-900"
                    >
                      떠나보내기 (+🥫1)
                    </button>
                  )}

                  {!isActiveNow && (
                    <div className="absolute left-2 top-2 z-20 rounded-md bg-black/75 px-2 py-1 text-[10px] text-sky-200 border border-sky-700/60">
                      비활성
                    </div>
                  )}

                  {canReactivate && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        reactivateSurvivor(survivor.uid)
                      }}
                      className="absolute left-2 top-9 z-20 rounded-md bg-emerald-950/90 px-2 py-1 text-[10px] text-emerald-200 border border-emerald-700/60 hover:bg-emerald-900"
                    >
                      {`식사 제공${(reactivationCost.can ?? 0) > 0 ? ` 🥫${reactivationCost.can}` : ''}`}
                    </button>
                  )}

                  <div className="absolute left-2 top-1 text-2xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    {survivor.score}
                  </div>

                  <div className="px-1 pt-7 pb-0.5">
                    <div className="flex min-h-[4.9rem] items-center justify-center rounded-[0.8rem] bg-black/15">
                      <div className="text-5xl drop-shadow-[0_3px_0_rgba(0,0,0,0.22)]">{survivor.emoji}</div>
                    </div>

                    <div className="mt-3 text-center">
                      <div className="text-[1rem] font-semibold uppercase tracking-[0.06em] leading-tight text-gray-50">
                        {survivor.name}
                      </div>
                      {group.members.length > 1 && (
                        <div className="mt-1 text-[11px] font-semibold text-yellow-300">겹침 x{group.members.length}</div>
                      )}
                    </div>

                    {displayEffect && (
                      <div className="mt-3 text-[11px] leading-snug text-gray-200 line-clamp-4">
                        {displayEffect}
                      </div>
                    )}

                    <div className="mt-2 text-[9px] leading-snug text-gray-400 line-clamp-3 min-h-[2.35rem]">
                      {survivor.description}
                    </div>

                  </div>

                  <div className={`mt-auto -mx-3 -mb-3 px-3 py-2 text-center shrink-0 ${TYPE_BADGE_COLOR[survivor.type]}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80 leading-tight">
                      {survivor.type}
                    </div>
                  </div>

                </>
              )}
              </div>
            </div>
          )
          return [cardEl]
        })}

        {/* 빈 슬롯 */}
        {Array.from({ length: Math.max(0, player.maxPartySize - getUsedPartySlotCount(player.party)) }).map((_, i) => {
          const slotIndex = getUsedPartySlotCount(player.party) + i
          return (
          <div
            key={`empty-${i}`}
            className={`relative border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center text-gray-700 text-xs
              ${compact ? 'w-16 h-[60px]' : 'w-44 h-[19.25rem]'}`}
          >
            <SlotHint slotIndex={slotIndex} compact={compact} />
            빈 슬롯
          </div>
          )
        })}
      </div>

      {isEditable && player.party.length > 1 && (
        <p className="text-xs text-gray-600 mt-2">드래그해서 순서 변경 (병뚜껑 -{Math.max(0, 2 - getPartyReorderCostReduction(player.party))})</p>
      )}

      {!compact && (
        <div className="mt-3 rounded-lg border border-white/10 bg-gray-950/60 px-3 py-2 text-center text-[11px] text-gray-400">
          각 생존자: {COMMON_UPKEEP_TEXT}
        </div>
      )}
    </div>
  )
}
