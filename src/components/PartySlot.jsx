import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../store/gameStore.js'
import { calcPartyScore } from '../logic/scoring.js'
import SurvivorCardFace from './SurvivorCardFace.jsx'
import { PLACEMENT_EFFECT_TYPES, getActivePlacementEffectsForParty, getPlacementEffectsForSlot } from '../data/placementBonuses.js'

const COMMON_UPKEEP_TEXT = '파티 정비 단계: 통조림을 먹여서 기력회복 | 종료시: 모든 배치 보너스 활성화 ★+3'

function getSurvivorSlotIndex(survivor, fallbackIndex = 0) {
  return Number.isInteger(survivor?.partySlotIndex) ? survivor.partySlotIndex : fallbackIndex
}

function getPartyDisplaySlots(party = [], maxPartySize = 5, breakdown = []) {
  const slots = Array.from({ length: maxPartySize }, () => null)
  party.forEach((survivor, index) => {
    const slotIndex = Math.max(0, Math.min(maxPartySize - 1, getSurvivorSlotIndex(survivor, index)))
    const existing = slots[slotIndex]
    const stackKey = survivor.stackGroupKey ?? null
    if (existing && stackKey && existing.stackGroupKey === stackKey) {
      existing.members.push(survivor)
      existing.indices.push(index)
      existing.edgeRight = breakdown[index]?.edgeRight ?? existing.edgeRight ?? 0
      return
    }
    if (!existing) {
      slots[slotIndex] = {
        key: stackKey ? `stack:${stackKey}` : survivor.uid,
        stackGroupKey: stackKey,
        members: [survivor],
        indices: [index],
        slotIndex,
        edgeRight: breakdown[index]?.edgeRight ?? 0,
      }
    }
  })
  return slots
}

function isPlainSurvivor(survivor) {
  const normalizedName = String(survivor?.name ?? '').replace(/\s/g, '')
  return survivor?.id?.startsWith('s_plain_') || normalizedName === '평범생존자' || survivor?.type === '평범'
}

function getEffectiveSurvivorTypeForPlayer(survivor, slotIndex, leaderId) {
  if (survivor?.id === 's_coward_6' && slotIndex === 0 && leaderId === 'zombie') return '용감이'
  if (isPlainSurvivor(survivor) && slotIndex === 0 && leaderId === 'robot') return '반장'
  return survivor?.type
}

function getPartyReorderCostReduction(player) {
  const placementReduction = getActivePlacementEffectsForParty(player, getEffectiveSurvivorTypeForPlayer)
    .filter(({ effect }) => effect.type === PLACEMENT_EFFECT_TYPES.REDUCE_REORDER_COST)
    .reduce((sum, { effect }) => sum + (effect.amount ?? 0), 0)
  const passiveReduction = (player?.party ?? []).reduce((sum, survivor) => {
    if (survivor.partyPassive?.type === 'reduce_reorder_cost') return sum + (survivor.partyPassive.amount ?? 0)
    return sum
  }, 0)
  return placementReduction + passiveReduction
}

function getReactivationCost(player, survivor, survivorIndex) {
  const base = survivor.reactivationCost
    ? (typeof survivor.reactivationCost === 'number' ? { can: survivor.reactivationCost } : survivor.reactivationCost)
    : { can: 1 }

  const slotIndex = getSurvivorSlotIndex(survivor, survivorIndex)
  const effectiveType = getEffectiveSurvivorTypeForPlayer(survivor, slotIndex, player?.leaderId)
  const reduction = getPlacementEffectsForSlot(player?.leaderId, slotIndex)
    .filter((effect) => effect.type === PLACEMENT_EFFECT_TYPES.REDUCE_REACTIVATION_COST && effect.survivorType === effectiveType)
    .reduce((sum, effect) => sum + (effect.amount ?? 0), 0)

  return { can: Math.max(0, (base.can ?? 0) - reduction), bottleCap: base.bottleCap ?? 0 }
}


function getEffectiveUiSurvivorType(survivor, index, leaderId) {
  const slotIndex = getSurvivorSlotIndex(survivor, index)
  if (survivor?.id === 's_coward_6' && slotIndex === 0 && leaderId === 'zombie') return '용감이'
  if ((survivor?.id?.startsWith('s_plain_') || String(survivor?.name ?? '').replace(/\s/g, '') === '평범생존자' || survivor?.type === '평범') && slotIndex === 0 && leaderId === 'robot') return '반장'
  return survivor?.type
}

function hasOnlyEffectiveUiSurvivorType(player, targetType) {
  const party = player?.party ?? []
  return party.length > 0 && party.every((survivor, index) => (
    getEffectiveUiSurvivorType(survivor, index, player?.leaderId) === targetType
  ))
}

function canUiSurvivorActAsType(player, survivor, targetType, usedUids = new Set()) {
  if (!survivor || usedUids.has(survivor.uid)) return false
  const idx = player?.party?.findIndex((entry) => entry.uid === survivor.uid) ?? -1
  const effectiveType = getEffectiveUiSurvivorType(survivor, idx, player?.leaderId)
  if (effectiveType === targetType) return true
  if (!hasOnlyEffectiveUiSurvivorType(player, '용감이')) return false
  return getActivePlacementEffectsForParty(player, getEffectiveSurvivorTypeForPlayer)
    .some(({ effect, survivor: wildcardSurvivor }) => (
      effect.type === PLACEMENT_EFFECT_TYPES.BRAVE_WILDCARD && wildcardSurvivor.uid === survivor.uid
    ))
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
    localPlayerIndex = 0,
    preselectedSurvivors = [],
    phase,
    interaction,
    swapPartyMembers,
    returnPartySurvivorToMercenary,
    reactivateSurvivor,
    selectMySurvivor,
    selectTargetSurvivor,
    selectSwapSurvivor,
    confirmTreasureCardEffect,
  } = useGameStore()
  const player = players[playerIndex]
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const [inspected, setInspected] = useState(null)
  const [stackMembers, setStackMembers] = useState({})

  if (!player) return null
  const canLocalResolveInteraction = currentPlayerIndex === localPlayerIndex && !players[currentPlayerIndex]?.isBot

  const { total, breakdown } = calcPartyScore(player.party, player.leaderId)
  const eventBonus = player.scoreTokens ?? 0
  const treasureBonus = (player.treasureCards ?? []).reduce((sum, card) => sum + (card.score ?? 0), 0)
  const penalty = player.abandonedEvents?.length ?? 0
  const finalScore = total + eventBonus + treasureBonus - penalty

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

    if (interaction.kind === 'use_stim_pack' && playerIndex === currentPlayerIndex) {
      return players[currentPlayerIndex]?.survivorActivity?.[uid] === false ? 'selectable' : null
    }

    if (interaction.step === 'select_my_survivor' && playerIndex === currentPlayerIndex) {
      const currentPlayer = players[currentPlayerIndex]
      const target = currentPlayer?.party?.find((survivor) => survivor.uid === uid)
      if (
        (interaction.kind === 'assign_event_party' || interaction.kind === 'assign_search_party' || interaction.kind === 'assign_utopia_party') &&
        currentPlayer?.survivorActivity?.[uid] === false
      ) {
        return null
      }
      if (interaction.event?.resolution?.type === 'send_survivor_type' && interaction.kind !== 'assign_event_party') {
        if (!canUiSurvivorActAsType(currentPlayer, target, interaction.event.resolution.survivorType)) return null
      }
      const requiredType = getRequiredAssignedType(interaction)
      if (requiredType && interaction.kind === 'assign_event_party') {
        const selected = interaction.payload.selectedMyUids ?? []
        const usedUids = new Set()
        const selectedHasRequired = selected
          .map((selectedUid) => currentPlayer?.party?.find((survivor) => survivor.uid === selectedUid))
          .some((survivor) => {
            const matched = canUiSurvivorActAsType(currentPlayer, survivor, requiredType, usedUids)
            if (matched) usedUids.add(survivor.uid)
            return matched
          })
        const isSelected = selected.includes(uid)
        const remainingAfterThis = (interaction.maxCount ?? interaction.requiredCount) - selected.length
        if (!isSelected && !selectedHasRequired && remainingAfterThis <= 1 && !canUiSurvivorActAsType(currentPlayer, target, requiredType, usedUids)) {
          return null
        }
      }
      return interaction.payload.selectedMyUids.includes(uid) ? 'selected' : 'selectable'
    }

    if (interaction.step === 'select_target_survivor' && playerIndex === interaction.payload.targetPlayerIndex) {
      const targetSurvivor = player.party.find((survivor) => survivor.uid === uid)
      if (interaction.event?.resolution?.type === 'support_roll_dice' && player.survivorActivity?.[uid] === false) {
        return null
      }
      if (interaction.kind === 'survivor_recruit_magicgirl_take' && !(targetSurvivor?.id?.startsWith('s_plain_') || String(targetSurvivor?.name ?? '').replace(/\s/g, '') === '평범생존자' || targetSurvivor?.type === '평범')) {
        return null
      }
      if (interaction.event?.eventType === 'action_attack' || interaction.event?.category === 'attack') {
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

    if (interaction.kind === 'use_stim_pack' && playerIndex === currentPlayerIndex) {
      confirmTreasureCardEffect(uid)
      return
    }

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
            {treasureBonus > 0 && <div className="text-[11px] text-yellow-300">보물 +{treasureBonus}</div>}
            {penalty > 0 && <div className="text-[11px] text-red-400">이벤트 벌점 -{penalty}</div>}
          </div>
        </div>
      )}

      <div className="survivor-party-row">
        {getPartyDisplaySlots(player.party, player.maxPartySize ?? 5, breakdown).map((group, slotIndex) => {
          const hint = <div className="survivor-slot-note"><strong>{slotIndex + 1}. {slotIndex < 2 ? '앞쪽' : slotIndex === 2 ? '중앙' : '뒤쪽'}</strong>{getPlacementEffectsForSlot(player.leaderId, slotIndex).map(effect => <div key={effect.type}>{effect.label} · {effect.detail}</div>)}</div>
          if (!group) return <div key={slotIndex} className={`survivor-party-slot ${compact ? 'compact' : ''}`}><div className="survivor-empty-slot">{slotIndex + 1}번 자리</div>{hint}</div>
          const survivor = group.members.find(member => member.uid === stackMembers[group.key]) ?? group.members[0]
          const i = player.party.findIndex(member => member.uid === survivor.uid)
          const role = getInteractionRole(survivor.uid)
          const canInteract = role === 'selectable' || role === 'selected'
          const active = player.survivorActivity?.[survivor.uid] !== false
          const canPreselect = playerIndex === localPlayerIndex && currentPlayerIndex === localPlayerIndex && phase === 'action' && !interaction && active
          const selected = role === 'selected' || (canPreselect && preselectedSurvivors.includes(survivor.uid))
          const selectCard = () => {
            if (canInteract) handleSelect(survivor.uid)
            else if (canPreselect) useGameStore.setState({ preselectedSurvivors: preselectedSurvivors.includes(survivor.uid) ? preselectedSurvivors.filter(uid => uid !== survivor.uid) : [...preselectedSurvivors, survivor.uid] })
            else setInspected(survivor)
          }
          const canMaintain = isEditable && playerIndex === localPlayerIndex && playerIndex === currentPlayerIndex && phase === 'party_maintenance' && !interaction
          const meal = getReactivationCost(player, survivor, i)
          const canAffordMeal = (player.resources.can ?? 0) >= meal.can && (player.resources.bottleCap ?? 0) >= meal.bottleCap
          return <div key={group.key} className={`survivor-party-slot ${compact ? 'compact' : ''}`}>
            <div className={`survivor-party-stage ${active ? '' : 'is-inactive'}`}>
              {group.members.slice(1, 4).map((member, index) => <div key={member.uid} className="survivor-stack-sheet" style={{ transform: `translate(${(index + 1) * 3}px, ${(index + 1) * 3}px)` }} />)}
              <button type="button" className="survivor-card-button" draggable={canMaintain}
                onDragStart={() => handleDragStart(i)} onDragEnd={() => { setDragging(null); setDragOver(null) }} onDragOver={event => handleDragOver(event, i)} onDrop={() => handleDrop(i)}
                aria-label={`${survivor.name} · ${active ? '활성' : '비활성'} · ${canInteract || canPreselect ? '선택' : '자세히 보기'}`} aria-pressed={selected}
                style={dragOver === i ? { outline: '3px solid #e4a72c' } : undefined}
                onClick={selectCard}>
                <SurvivorCardFace survivor={survivor} />
              </button>
              {!active && <span className="survivor-activity-label">비활성 · 휴식 중</span>}
            </div>
            {group.members.length > 1 && <div className="survivor-card-controls"><label>겹친 동료 <select aria-label={`${slotIndex + 1}번 슬롯 동료 선택`} value={survivor.uid} onChange={event => setStackMembers({ ...stackMembers, [group.key]: event.target.value })}>{group.members.map(member => <option key={member.uid} value={member.uid}>{member.name}</option>)}</select></label></div>}
            {(canInteract || canPreselect) && <div className="survivor-card-controls"><button type="button" onClick={() => setInspected(survivor)}>카드 읽기</button>{selected && canPreselect && <span>탐색 카드를 고르세요</span>}</div>}
            {canMaintain && <div className="survivor-card-controls">
              {!active && <button type="button" disabled={!canAffordMeal} onClick={() => reactivateSurvivor(survivor.uid)}>식사 제공 🥫{meal.can}{meal.bottleCap ? ` 🪙${meal.bottleCap}` : ''}</button>}
              <button type="button" onClick={() => returnPartySurvivorToMercenary(survivor.uid)}>떠나보내기 🥫+1</button>
              {player.party.length > 1 && <select aria-label={`${survivor.name} 자리 교환`} value="" onChange={event => { if (event.target.value !== '') swapPartyMembers(playerIndex, i, Number(event.target.value)) }}><option value="">자리 교환…</option>{player.party.map((member, index) => index !== i && <option key={member.uid} value={index}>{getSurvivorSlotIndex(member, index) + 1}번 · {member.name}</option>)}</select>}
            </div>}
            {hint}
          </div>
        })}
      </div>
      {!compact && <div className="survivor-slot-note">{COMMON_UPKEEP_TEXT}{isEditable && player.party.length > 1 && <span> · 드래그 또는 자리 교환 (🪙-{Math.max(0, 2 - getPartyReorderCostReduction(player))})</span>}</div>}
      {inspected && createPortal(<div className="survivor-inspect-backdrop" onClick={() => setInspected(null)}>
        <div className="survivor-inspect" role="dialog" aria-modal="true" aria-label={`${inspected.name} 카드 정보`} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setInspected(null) }}>
          <SurvivorCardFace survivor={inspected} /><button type="button" autoFocus onClick={() => setInspected(null)}>닫기</button>
        </div>
      </div>, document.body)}
    </div>
  )
}
