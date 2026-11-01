import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import CardBack from './CardBack.jsx'
import { Scene } from '../tabletop/Visuals.jsx'
import { useGameStore } from '../store/gameStore.js'
import { RULES } from '../data/rules.js'
import { PersonalIcon } from '../assets/personal-icons/index.jsx'
import { PLACEMENT_EFFECT_TYPES, getActivePlacementEffectsForParty } from '../data/placementBonuses.js'

function KeyIcon({ className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} aria-label="열쇠" title="열쇠">
      🗝️
    </span>
  )
}

// Sword shape pointing upward, rotated in pairs to make crossed swords
function SwordShape({ rotate }) {
  return (
    <g transform={`rotate(${rotate}, 50, 50)`}>
      <polygon points="50,4 53,14 53,57 64,57 64,63 53,63 52,75 56,79 56,89 50,94 44,89 44,79 48,75 47,63 36,63 36,57 47,57 47,14" />
    </g>
  )
}

function CrossedSwordsIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-label="공격">
      <SwordShape rotate={-45} />
      <SwordShape rotate={45} />
    </svg>
  )
}

function CansIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-label="자원">
      {/* Back can (tall, upper-right) */}
      <ellipse cx="63" cy="22" rx="19" ry="8" />
      <rect x="44" y="22" width="38" height="44" />
      <ellipse cx="63" cy="66" rx="19" ry="8" />
      {/* Front can (short/flat, lower-left) */}
      <ellipse cx="39" cy="54" rx="23" ry="9" />
      <rect x="16" y="54" width="46" height="24" />
      <ellipse cx="39" cy="78" rx="23" ry="9" />
    </svg>
  )
}

function StarIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-label="유토피아">
      <polygon points="50,6 61,35 92,36 67,56 76,86 50,68 24,86 33,56 8,36 39,35" />
    </svg>
  )
}

function TreasureCardIcon({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[3px] border border-amber-300/80 bg-amber-950 leading-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] ${className}`}
      aria-label="보물 카드"
      title="보물 카드"
    >
      <svg viewBox="0 0 20 20" className="h-[72%] w-[72%] text-yellow-300" fill="currentColor" aria-hidden="true">
        <path d="M4.2 3.5h11.6l2.2 4.2L10 17.2 2 7.7 4.2 3.5Z" />
        <path d="M4.4 4.6 7 7.7 10 4.6l3 3.1 2.6-3.1M2.7 7.7h14.6M7 7.7l3 8.2 3-8.2" fill="none" stroke="#78350f" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      </svg>
    </span>
  )
}

function ExchangeArrowIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="교환">
      <path d="M2 4h14l-3-3m3 3l-3 3" />
      <path d="M18 10H4l3-3m-3 3l3 3" />
    </svg>
  )
}

function MapIcon({ className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} aria-label="약도" title="약도">
      🗺️
    </span>
  )
}

function ArtifactEmojiIcon({ emoji, label, className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} aria-label={label} title={label}>
      {emoji}
    </span>
  )
}

const CLUE_ARTIFACT_META = {
  e_clue_1_flyer: {
    emoji: '📄',
    text: '건물 벽에 붙어있던 오래된 전단지\n 점선이 어딘가를 가리키고 있다',
  },
  e_clue_1_radio: {
    emoji: '📻',
    text: '잡음 속에 누군가의 목소리가 들린다 집중하면 단서를 찾을 수 있을지도..',
  },
  e_clue_1_sketch: {
    emoji: '🗺️',
    text: '누군가 급히 그린 것 같은 약도 해독하면 단서가 될 수 있다',
  },
  e_clue_1_rumor: {
    emoji: '👂',
    text: '근처 주민에게 들은 소문 어딘가에 안전한 곳이 있다고...',
  },
  e_clue_map: {
    emoji: '🗺️',
    text: '찢긴 지도 한 조각 점선이 우리가 찾던 그 땅을 가리킨다',
  },
  e_clue_witness: {
    emoji: '👁️',
    text: '“거긴 진짜 있어. 내가 봤다고.”유토피아를 목격한 생존자의 증언',
  },
  e_clue_2_audio: {
    emoji: '🎙️',
    text: '연구소에서 발견한 손상된 녹음기 복원하면 좌표 단서가 드러날 것 같다',
  },
  e_clue_2_docs: {
    emoji: '📋',
    text: '분류 표시가 된 문서 유토피아 관련 연구 기록인 것 같다',
  },
  e_clue_3_broadcast: {
    emoji: '📺',
    text: '세상이 무너지기 직전 마지막 방송 좌표를 해독할 수 있다면...',
  },
  e_clue_3_coords: {
    emoji: '🛰️',
    text: '암호화된 좌표 데이터 해독 완료 시 목적지가 확정된다',
  },
  e_clue_3_blueprint: {
    emoji: '📐',
    text: '방대한 도면 규모가 실제라면 수천 명이 살 수 있다',
  },
  e_clue_3_code: {
    emoji: '🔑',
    text: '유토피아 진입을 위한 마지막 코드.이게 진짜라면...',
  },
}

function getClueArtifactMeta(event) {
  return CLUE_ARTIFACT_META[event?.id] ?? {
    emoji: event?.emoji ?? '📝',
    text: String(event?.description ?? '유토피아로 이어지는 단서')
      .split('실패시')[0]
      .replace(/\s+/g, ' ')
      .trim(),
  }
}

const SCOPE_STYLE = {
  personal: { label: '개인', border: 'border-gray-600',   badge: 'bg-blue-900/50 text-blue-300',   headerBg: 'bg-gray-600/10' },
  global:   { label: '전체', border: 'border-yellow-700', badge: 'bg-yellow-900/50 text-yellow-300', headerBg: 'bg-yellow-700/10' },
  disaster: { label: '재난', border: 'border-red-500',    badge: 'bg-red-900/50 text-red-400',     headerBg: 'bg-red-500/10' },
  clue:     { label: '유토피아 단서', border: 'border-yellow-500', badge: 'bg-yellow-800/60 text-yellow-200', headerBg: 'bg-yellow-500/10' },
}

const REWARD_TEXT = {
  can: '통조림',
  cap: '병뚜껑',
  survivor: '생존자',
  score: '점수',
  clue: '단서',
  key: '열쇠',
  item: '💎',
  treasure: '보물',
  disaster: '재난',
  exchange_arrow: '',
}

const REWARD_ICON_NAME = {
  can: 'can',
  cap: 'bottleCap',
  survivor: 'survivor',
  score: 'score',
  clue: 'clue',
}

const TEXT_ICON_NAME = {
  '🥫': 'can',
  '🪙': 'bottleCap',
  '👥': 'survivor',
  '★': 'score',
  '📝': 'clue',
}

// 시스템적 이벤트 분류 태그. 카드에는 직접 표시하지 않고 내부 분류/필터링용으로만 사용한다.
const EVENT_SYSTEM_TAG_META = {
  resource: { label: '재화', className: 'bg-purple-900/60 text-purple-200' },
  item: { label: '아이템', className: 'bg-yellow-800/60 text-yellow-200' },
  action_coop: { label: '액션: 협력', className: 'bg-green-900/60 text-green-200' },
  action_exchange: { label: '액션: 교환', className: 'bg-green-900/60 text-green-200' },
  action_attack: { label: '액션: 공격', className: 'bg-green-900/60 text-green-200' },
  disaster: { label: '재난', className: 'bg-rose-950/70 text-rose-400' },
  luck: { label: '행운', className: 'bg-emerald-900/50 text-emerald-300' },

  // Legacy/internal tags kept for older data and filters.
  encounter: { label: '조우', className: 'bg-cyan-900/50 text-cyan-300' },
  score: { label: '점수', className: 'bg-emerald-900/50 text-emerald-300' },
  attack: { label: '공격', className: 'bg-rose-900/50 text-rose-300' },
  clue: { label: '단서', className: 'bg-yellow-800/60 text-yellow-200' },
  trade_offer: { label: '거래', className: 'bg-amber-900/50 text-amber-200' },
  shared_distribution: { label: '분배', className: 'bg-cyan-900/50 text-cyan-200' },
  shared_dispatch_reward: { label: '공동파견', className: 'bg-cyan-900/50 text-cyan-200' },
  support_roll_dice: { label: '지원', className: 'bg-blue-900/50 text-blue-200' },
  resource_duel: { label: '대결', className: 'bg-rose-900/50 text-rose-200' },
  rich_cap_raid: { label: '부자견제', className: 'bg-violet-900/50 text-violet-200' },
}

// 타입 보너스 미니 뱃지 배경 투명도 (0~100)
const MINI_BADGE_BG_OPACITY = 90

const TYPE_TAG_META = {
  반장: { label: '반', className: 'border-blue-500/70 bg-blue-900/70 text-blue-100' },
  용감이: { label: '용', className: 'border-green-500/70 bg-green-900/70 text-green-100' },
  분위기메이커: { label: '분', className: 'border-pink-500/70 bg-pink-900/70 text-pink-100' },
  '4차원': { label: '4', className: 'border-yellow-500/70 bg-yellow-900/70 text-yellow-100' },
  겁쟁이: { label: '겁', className: 'border-purple-500/70 bg-purple-900/70 text-purple-100' },
}


function normalizeRewardEntries(reward) {
  if (!reward) return []
  return Array.isArray(reward) ? reward : [reward]
}

function eventHasRewardType(event, types = []) {
  const typeSet = new Set(types)
  return normalizeRewardEntries(event?.reward).some((entry) => typeSet.has(entry?.type))
}

function isKeyUnlockEvent(event) {
  return Boolean(
    event &&
    (event.requiresKey || event.resolution?.requiresKey) &&
    (event.resolution?.type === 'roll_dice' || event.resolution?.type === 'roll_dice_score_bonus') &&
    eventHasRewardType(event, ['item', 'treasure'])
  )
}

function canResolveWithKeyOnly(player, event) {
  return isKeyUnlockEvent(event) && (player?.keyCards?.length ?? 0) > 0
}

function getActivePartyCount(player) {
  return player?.party?.filter((survivor) => player?.survivorActivity?.[survivor.uid] !== false).length ?? 0
}

function getPartySlotCount(party = []) {
  return new Set((party ?? []).map((survivor, index) => (
    Number.isInteger(survivor?.partySlotIndex) ? survivor.partySlotIndex : index
  ))).size
}

function isDuckUtopiaDiscoveryReady(player) {
  return player?.leaderId === 'duck' &&
    getPartySlotCount(player.party ?? []) >= 6 &&
    (player.party ?? []).every((survivor) => survivor?.type === '4차원')
}

function isRequiredKeyEntry(entry) {
  return entry?.type === 'key' || entry?.type === '열쇠'
}

function getRequiredKeyCountForEvent(event) {
  return getRequiredPartyTypesForEvent(event)
    .filter(isRequiredKeyEntry)
    .reduce((sum, entry) => sum + (entry.count ?? 1), 0)
}

function getRequiredSurvivorTypesForEvent(event) {
  return getRequiredPartyTypesForEvent(event).filter((entry) => !isRequiredKeyEntry(entry))
}

function getRequiredTypeSlotCount(event) {
  const requiredPartyTypeCount = expandTypeRequirements(getRequiredSurvivorTypesForEvent(event)).length
  const requiredAssignedTypeCount = getRequiredAssignedTypeForEvent(event) ? 1 : 0
  return Math.max(requiredPartyTypeCount, requiredAssignedTypeCount)
}

function getRequiredSurvivorsForEvent(event) {
  if (!event) return 0
  const tier = event.tier ?? 1
  const baseRequired = event.assignment?.minSurvivors != null
    ? event.assignment.minSurvivors
    : (RULES.exploration?.tiers?.[tier]?.minAssigned ?? 1)
  return Math.max(baseRequired, getRequiredTypeSlotCount(event))
}

function getMaxSurvivorsForEvent(event, activePartyCount = 5) {
  if (!event) return 0
  return Math.max(activePartyCount, getRequiredSurvivorsForEvent(event))
}

function getRequiredAssignedTypeForEvent(event) {
  return event?.resolution?.type === 'check_survivor_type'
    ? event.resolution.survivorType
    : null
}

function getRequiredPartyTypesForEvent(event) {
  const required = event?.requiredTypes
    ?? (event?.requiredType ? [{ type: event.requiredType, count: 1 }] : [])
  return required.filter((entry) => entry?.type)
}

function expandTypeRequirements(entries = []) {
  return entries.flatMap(({ type, count = 1 }) => Array.from({ length: count }, () => type))
}

function getSurvivorSlotIndex(survivor, fallbackIndex = 0) {
  return Number.isInteger(survivor?.partySlotIndex) ? survivor.partySlotIndex : fallbackIndex
}

function getEffectiveSurvivorTypeForPlayer(survivor, index, leaderId) {
  const slotIndex = getSurvivorSlotIndex(survivor, index)
  if (survivor?.id === 's_coward_6' && slotIndex === 0 && leaderId === 'zombie') return '용감이'
  return survivor?.type
}

function hasOnlyEffectiveSurvivorType(player, targetType) {
  const party = player?.party ?? []
  return party.length > 0 && party.every((survivor, index) => (
    getEffectiveSurvivorTypeForPlayer(survivor, index, player?.leaderId) === targetType
  ))
}

function canSurvivorActAsType(player, survivor, targetType, usedUids = new Set()) {
  if (!survivor || usedUids.has(survivor.uid)) return false
  const idx = player?.party?.findIndex((entry) => entry.uid === survivor.uid) ?? -1
  const effectiveType = getEffectiveSurvivorTypeForPlayer(survivor, idx, player?.leaderId)
  if (effectiveType === targetType) return true
  if (!hasOnlyEffectiveSurvivorType(player, '용감이')) return false
  return getActivePlacementEffectsForParty(player, getEffectiveSurvivorTypeForPlayer)
    .some(({ effect, survivor: wildcardSurvivor }) => (
      effect.type === PLACEMENT_EFFECT_TYPES.BRAVE_WILDCARD && wildcardSurvivor.uid === survivor.uid
    ))
}

function canSatisfyTypeRequirements(player, requiredTypes = [], survivors = []) {
  const survivorTypes = requiredTypes.filter((entry) => !isRequiredKeyEntry(entry))
  const usedUids = new Set()
  return expandTypeRequirements(survivorTypes).every((type) => {
    const match = survivors.find((survivor) => canSurvivorActAsType(player, survivor, type, usedUids))
    if (!match) return false
    usedUids.add(match.uid)
    return true
  })
}

function getAccessibleExplorationTier(player) {
  return player?.unlockedExplorationTier ?? 1
}

function getEventSystemTagMeta(event) {
  const resolutionType = event?.resolution?.type
  return EVENT_SYSTEM_TAG_META[event?.eventType]
    ?? EVENT_SYSTEM_TAG_META[resolutionType]
    ?? EVENT_SYSTEM_TAG_META[event?.category]
    ?? EVENT_SYSTEM_TAG_META[event?.scope]
    ?? null
}

function hasExchangeMarker(event) {
  const rewards = event?.reward ? (Array.isArray(event.reward) ? event.reward : [event.reward]) : []
  return event?.eventType === 'action_exchange'
    || event?.resolution?.type === 'trade_offer'
    || rewards.some((reward) => reward?.type === 'exchange_arrow')
}

function getEventBottomTypeMeta(event) {
  if (!event) return null
  if (event.scope === 'disaster' || event.category === 'disaster' || event.eventType === 'disaster') return null
  if (event.category === 'clue' || event.eventType === 'luck') return null

  const rewards = event.reward ? (Array.isArray(event.reward) ? event.reward : [event.reward]) : []
  const isKeyItem = event.eventType === 'item' || rewards.some((reward) => reward?.type === 'key')
  if (isKeyItem) return null

  if (hasExchangeMarker(event)) {
    return { label: '액션: 교환', className: 'bg-[#07101a] text-slate-400' }
  }
  if (event.eventType === 'resource') {
    return { label: '재화', className: 'bg-[#07101a] text-slate-400' }
  }
  if (event.eventType === 'encounter') {
    return { label: '조우', className: 'bg-[#07101a] text-slate-400' }
  }
  if (event.eventType === 'action_attack') {
    return { label: '액션: 공격', className: 'bg-[#07101a] text-slate-400' }
  }
  if (event.eventType === 'action_coop') {
    return { label: '액션: 협력', className: 'bg-[#07101a] text-slate-400' }
  }
  return null
}

function getEventHeaderIconType(event) {
  if (event?.eventType === 'resource') return 'resource'
  if (event?.eventType === 'action_coop' || hasExchangeMarker(event)) return 'negotiate'
  if (event?.eventType === 'action_attack') return 'attack'

  const resolution = event?.resolution
  const resolutionType = resolution?.type
  const followUp = resolution?.then
  if (event?.name?.includes('협상') || resolutionType === 'trade_offer') return 'negotiate'
  if (
    event?.category === 'attack'
    || resolutionType === 'steal_can_from_player'
    || resolutionType === 'steal_cap_from_player'
    || resolutionType === 'steal_can_from_all_others'
    || resolutionType === 'steal_cap_from_all_others'
    || resolutionType === 'take_from_party'
    || resolutionType === 'remove_from_party'
    || resolutionType === 'deactivate_from_party'
    || resolutionType === 'return_survivor_to_deck'
    || resolutionType === 'deactivate_type_all_others'
    || resolutionType === 'resource_duel'
    || resolutionType === 'rich_cap_raid'
    || followUp === 'take_from_party'
    || followUp === 'remove_from_party'
  ) {
    return 'attack'
  }
  return null
}

function getRecommendedPartyBonus(event, player = null) {
  if (!event?.recommendedParty?.length) return 0
  const recommended = event.recommendedParty ?? []
  const base = event.recommendedPartyBonus ?? event.resolution?.recommendedPartyBonus ?? event.check?.recommendedPartyBonus ?? (1 + recommended.length)
  const chargeBoost = (player?.party ?? []).reduce((sum, survivor, index) => {
    if (index <= 1 && survivor.type === '용감이') return sum + 1
    return sum
  }, 0)
  return base + chargeBoost
}

function getGenericSurvivorRequirementLabel(event, requiredPartyTypes = []) {
  if (event?.resolution?.type === 'roll_dice' || event?.resolution?.type === 'roll_dice_score_bonus') return ''
  if (event?.resolution?.type === 'send_survivor_type') return ''
  const requiredCount = getRequiredSurvivorsForEvent(event)
  if (requiredCount < 2) return ''
  const typedCount = requiredPartyTypes.reduce((sum, entry) => sum + (entry.count ?? 1), 0)
  const genericCount = Math.max(0, requiredCount - typedCount)
  return genericCount >= 1 ? `👥${genericCount}` : ''
}

function getSendAwaySurvivorCount(event) {
  const type = event?.resolution?.type
  if (type === 'remove_choice' || type === 'remove_from_party') return event.resolution.amount ?? 1
  if (type === 'remove_random') return event.resolution.amount ?? 1
  if (type === 'send_survivor_type') return 0
  if (type === 'send_survivors_n') return event.resolution.amount ?? 1
  if (type === 'take_from_party') return event.resolution.amount ?? 1
  return 0
}

function getResolutionLabel(event, { includeAssignment = true } = {}) {
  const resolution = event?.resolution
  if (!resolution) return event?.scope === 'disaster' || event?.scope === 'global' ? '전체' : ''
  if (resolution.type === 'global_effect') return ''
  if (resolution.type === 'roll_dice') return `🎲 ${resolution.target}+`
  if (resolution.type === 'roll_dice_score_bonus') return `🎲+점수 ${resolution.target}+`
  if (resolution.type === 'pay_can') return `🥫-${resolution.amount}`
  if (resolution.type === 'pay_cap') return `🪙-${resolution.amount}`
  if (resolution.type === 'check_survivor_type') return ''
  if (resolution.type === 'check_survivors_n') return ''
  if (resolution.type === 'remove_choice') return `이탈 ${resolution.amount ?? 1}`
  if (resolution.type === 'remove_random') return '랜덤 이탈'
  if (resolution.type === 'send_survivor_type') return ''
  if (resolution.type === 'send_survivors_n') return `생존자 ${resolution.amount}인 파견`
  if (resolution.type === 'trade_offer') {
    if (resolution.chooseResource) return `🥫/🪙-${resolution.give?.amount ?? 2}`
    const giveIcon = resolution.give?.resource === 'bottleCap' ? '🪙' : '🥫'
    const receiveIcon = resolution.receive?.resource === 'bottleCap' ? '🪙' : '🥫'
    const receiveTotal = (resolution.receive?.amount ?? 0) + (resolution.receive?.bonus ?? 0)
    return `${giveIcon}-${resolution.give?.amount ?? 0} / ${receiveIcon}+${receiveTotal}`
  }
  if (resolution.type === 'shared_distribution') {
    const icon = resolution.resource === 'bottleCap' ? '🪙' : '🥫'
    return `${icon}+${resolution.targetAmount ?? 1}(상대)`
  }
  if (resolution.type === 'shared_dispatch_reward') return ''
  if (resolution.type === 'support_roll_dice') return `🎲${resolution.target}+`
  if (resolution.type === 'rich_cap_raid') return ''
  if (resolution.type === 'resource_duel') return ''
  return ''
}

function getDisasterEffectLabel(event) {
  const effect = event?.globalEffect ?? event?.effect
  if (!effect) return ''
  if (effect.type === 'lose_can_all') return `🥫-${effect.amount}`
  if (effect.type === 'lose_cap_all') return `🪙-${effect.amount}`
  if (effect.type === 'halve_can_all') return `🥫×½`
  if (effect.type === 'halve_cap_all') return `🪙×½`
  if (effect.type === 'remove_random_all') return `이탈 ${effect.amount ?? 1}`
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
    <span className={`inline-flex items-center leading-none ${compact ? 'gap-x-2 flex-nowrap' : 'gap-1 flex-wrap'}`}>
      {rewards.map((reward, index) => (
        <span
          key={`${reward.type}-${index}`}
          className={`inline-flex items-center gap-0.5 leading-none font-bold ${reward.type === 'disaster' ? 'text-red-400' : 'text-emerald-300'} ${reward.type === 'exchange_arrow' ? '-mx-[4px]' : ''}`}
        >
          {reward.type === 'exchange_arrow' ? (
            <span className="text-gray-400 font-bold">/</span>
          ) : reward.type === 'key' ? (
            <KeyIcon className={compact ? 'h-6 w-6 text-[20px]' : 'h-5 w-5 text-[18px]'} />
          ) : reward.type === 'item' || reward.type === 'treasure' ? (
            <TreasureCardIcon className={compact ? 'h-7 w-5 text-[14px]' : 'h-6 w-4 text-[12px]'} />
          ) : REWARD_ICON_NAME[reward.type] ? (
            <PersonalIcon name={REWARD_ICON_NAME[reward.type]} alt={REWARD_TEXT[reward.type] ?? reward.type} className={compact ? 'h-6 w-6' : 'h-5 w-5'} />
          ) : (
            <span className={compact ? 'text-[17px]' : 'text-[15px]'}>{REWARD_TEXT[reward.type] ?? reward.type}</span>
          )}
          {reward.type !== 'key' && reward.type !== 'exchange_arrow' && typeof reward.amount === 'number' && <span>{reward.amount}</span>}
          {reward.scopeLabel && (
            <span className={`${compact ? 'text-[9px]' : 'text-[8.5px]'} font-normal text-emerald-200/75 ml-0.5 leading-none`}>{reward.scopeLabel}</span>
          )}
        </span>
      ))}
    </span>
  )
}

function TextWithPersonalIcons({ text, iconClassName = 'h-3 w-3' }) {
  if (!text) return null
  return String(text).split(/([🥫🪙👥★📝])/gu).map((part, index) => {
    const iconName = TEXT_ICON_NAME[part]
    if (!iconName) return <span key={`${part}-${index}`}>{part}</span>
    return <PersonalIcon key={`${part}-${index}`} name={iconName} alt={part} className={iconClassName} />
  })
}

function EventHeaderIcon({ type }) {
  if (!type) return null

  if (type === 'resource') {
    return (
      <span className="relative inline-flex h-5 w-7 items-center justify-center opacity-80 grayscale" aria-label="재화" title="재화">
        <PersonalIcon name="can" alt="통조림" className="absolute left-0 h-5 w-5" />
        <PersonalIcon name="bottleCap" alt="병뚜껑" className="absolute right-0 h-4 w-4" />
      </span>
    )
  }

  if (type === 'attack') {
    return <PersonalIcon name="sword" alt="공격" className="h-5 w-5 opacity-80 grayscale" />
  }

  if (type === 'negotiate') {
    return <PersonalIcon name="negotiate" alt="협력" className="h-5 w-5 opacity-80 grayscale" />
  }

  return null
}

function getDisplayRewards(event) {
  const base = event?.reward ? (Array.isArray(event.reward) ? event.reward : [event.reward]) : []
  if (event?.category === 'clue') return [{ type: 'clue', amount: 1 }]
  if (event?.scope === 'disaster') return [{ type: 'disaster' }]
  if (base.length > 0) return base

  const resolution = event?.resolution ?? {}
  if (resolution.type === 'steal_can_from_player') return [{ type: 'can', amount: resolution.amount ?? 1, scopeLabel: '(상대)' }]
  if (resolution.type === 'steal_cap_from_player') return [{ type: 'cap', amount: resolution.amount ?? 1, scopeLabel: '(상대)' }]
  if (resolution.type === 'steal_can_from_all_others') return [{ type: 'can', amount: resolution.amount ?? 1, scopeLabel: '(전원)' }]
  if (resolution.type === 'steal_cap_from_all_others') return [{ type: 'cap', amount: resolution.amount ?? 1, scopeLabel: '(전원)' }]
  if (resolution.type === 'take_from_party') return [{ type: 'survivor', amount: 1, scopeLabel: '(상대)' }]
  if (resolution.type === 'remove_from_party') return [{ type: 'survivor', amount: -1, scopeLabel: '(상대)' }]
  if (resolution.type === 'deactivate_from_party') return [{ type: 'survivor', amount: -1, scopeLabel: '(비활성)' }]
  if (resolution.type === 'return_survivor_to_deck') return [{ type: 'survivor', amount: -1, scopeLabel: '(덱)' }]
  if (resolution.type === 'deactivate_type_all_others') return [{ type: 'survivor', amount: -1, scopeLabel: `(${resolution.survivorType ?? '타입'})` }]
  if (resolution.type === 'steal_from_grave') return [{ type: 'survivor', amount: 1, scopeLabel: '(떠남)' }]

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
            className={`inline-flex w-4 h-4 items-center justify-center rounded-full border text-[8px] font-black leading-none ${meta.className}`}
          >
            {meta.label}{count > 1 ? count : ''}
          </span>
        )
      })}
    </div>
  )
}

function RecommendedPartyText({ event }) {
  const recommended = event?.recommendedParty ?? []
  if (recommended.length === 0) return null
  const tokens = recommended.flatMap((entry) => (
    Array.from({ length: entry.count ?? 1 }, (_, index) => ({ ...entry, tokenIndex: index }))
  ))

  return (
    <span className="inline-flex items-center gap-0.5">
      {tokens.map((entry) => {
        const meta = TYPE_TAG_META[entry.type] ?? { label: entry.type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }
        const miniBgClass = meta.className.replace(/(bg-\S+?)(\/\d+)?(?=\s|$)/, `$1/${MINI_BADGE_BG_OPACITY}`)
        return (
          <span
            key={`${entry.type}-${entry.tokenIndex}`}
            title={entry.type}
            className={`inline-flex w-[9.5px] h-[9.5px] items-center justify-center rounded-full border text-[0px] font-black leading-none ${miniBgClass}`}
          >
            {meta.label}
          </span>
        )
      })}
      <span className="text-[8.5px] font-bold text-amber-300/65">점수</span>
    </span>
  )
}

function RequiredTypeStack({ entry }) {
  const count = entry.count ?? 1

  if (isRequiredKeyEntry(entry)) {
    return (
      <span key={entry.type} className="inline-flex flex-col items-start gap-1">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            title={`열쇠 ${count}개 필수`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-yellow-500/70 bg-yellow-950/70 text-yellow-100 leading-none"
          >
            <KeyIcon className="h-5 w-5 text-[18px]" />
          </span>
        ))}
      </span>
    )
  }

  const meta = TYPE_TAG_META[entry.type] ?? { label: entry.type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }

  return (
    <span key={entry.type} className="inline-flex flex-col items-start gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          title={`${entry.type} ${count}명 필수`}
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[11px] font-black leading-none ${meta.className}`}
        >
          {meta.label}
        </span>
      ))}
    </span>
  )
}

// 생존자 스택 아이콘 조정값
const SURVIVOR_ICON_SIZE = 18   // px, 아이콘 한 개 크기
const SURVIVOR_STACK_OVERLAP = 6  // px, 겹치는 정도 (클수록 더 겹침)

function SurvivorSilhouette({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-label="생존자">
      <circle cx="10" cy="6" r="5" />
      <path d="M1 20c0-4.97 4.03-9 9-9s9 4.03 9 9H1z" />
    </svg>
  )
}

function SurvivorStack({ count }) {
  return (
    <span className="inline-flex items-center">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="relative inline-flex items-center justify-center text-gray-200 shrink-0"
          style={{
            width: SURVIVOR_ICON_SIZE,
            height: SURVIVOR_ICON_SIZE,
            marginLeft: i === 0 ? 0 : -SURVIVOR_STACK_OVERLAP,
            zIndex: count - i,
          }}
        >
          <SurvivorSilhouette className="h-[82%] w-[82%]" />
        </span>
      ))}
    </span>
  )
}

function SharedDispatchRequirementDisplay() {
  return (
    <span className="inline-flex flex-col items-start gap-0.5 leading-none" title="내 생존자 1명과 상대 생존자 1명 파견">
      <SurvivorStack count={1} />
      <span className="inline-flex items-center gap-1">
        <SurvivorStack count={1} />
        <span className="text-[9px] font-normal text-gray-400 leading-none">(상대)</span>
      </span>
    </span>
  )
}

function SurvivorRemoveDisplay({ count = 1 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className="relative inline-flex items-center justify-center text-gray-200 shrink-0"
        style={{ width: SURVIVOR_ICON_SIZE, height: SURVIVOR_ICON_SIZE }}
      >
        <SurvivorSilhouette className="h-[82%] w-[82%]" />
      </span>
      <span className="text-[14px] font-black text-rose-300 leading-none">-{count}</span>
    </span>
  )
}

function RequiredPartyBadges({ requirements }) {
  if (!requirements?.length) return null
  const tokens = requirements.flatMap((entry) => (
    Array.from({ length: entry.count ?? 1 }, (_, index) => ({ ...entry, tokenIndex: index }))
  ))

  return (
    <span className="inline-flex items-center gap-0.5">
      {tokens.map((entry) => {
        const meta = TYPE_TAG_META[entry.type] ?? { label: entry.type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }
        return (
          <span
            key={`${entry.type}-${entry.tokenIndex}`}
            title={`${entry.type} 필수`}
            className={`inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full border px-1 text-[8px] font-black leading-none ${meta.className}`}
          >
            {meta.label}
          </span>
        )
      })}
    </span>
  )
}

export default function EventZone({ isMyTurn, actionsTarget }) {
  const {
    eventSlots, revealedSlots, eventDeck,
    startEventResolution, replaceEventSlot, acceptGlobalEvent, startUtopiaResolution,
    confirmEventAssignment, selectTradeResource, useZombieLeaderSkill,
    players, currentPlayerIndex, localPlayerIndex = 0, departedSurvivors, treasureDeck,
    phase, interaction, endActionPhase, cancelInteraction, gameEnded, utopiaState, explorationState,
  } = useGameStore()

  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null)

  useEffect(() => {
    if (interaction || !isMyTurn || phase !== 'action') setSelectedSlotIndex(null)
  }, [interaction, isMyTurn, phase])

  const player = players[localPlayerIndex]
  const hasDepartedSurvivors = (departedSurvivors?.length ?? 0) > 0 || players.some((p) => (p.graveyard?.length ?? 0) > 0)
  const totalResolvedClues = players.reduce((sum, current) => sum + (current.clueTokens ?? 0), 0)
  const activePartyCount = getActivePartyCount(player)
  const canResolve = !gameEnded && isMyTurn && phase === 'action' && !interaction
  const duckUtopiaReady = isDuckUtopiaDiscoveryReady(player)
  const alreadyCompletedUtopia = (utopiaState?.completedByPlayerIds ?? []).includes(player?.id)
  const canAttemptUtopia = Boolean(
    !alreadyCompletedUtopia &&
    (
      (utopiaState?.revealed && (player?.claimedCluesByTier?.[3]?.length ?? 0) > 0) ||
      (!utopiaState?.revealed && duckUtopiaReady)
    )
  )
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
            replaceIsFree={false}
            hasDepartedSurvivors={hasDepartedSurvivors}
            player={player}
            selectedSlotIndex={selectedSlotIndex}
            onSelectSlot={setSelectedSlotIndex}
            startEventResolution={startEventResolution}
            replaceEventSlot={replaceEventSlot}
            acceptGlobalEvent={acceptGlobalEvent}
            startUtopiaResolution={startUtopiaResolution}
            utopiaState={tier === 3 ? utopiaState : null}
            canAttemptUtopia={canAttemptUtopia}
            treasureDeckCount={treasureDeck?.length ?? 0}
            actionsTarget={actionsTarget}
          />
        ))}
      </div>

      {isMyTurn && interaction?.kind === 'leader_skill_zombie_confirm' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-green-600 bg-gray-950/95 p-5 shadow-[0_0_30px_rgba(34,197,94,0.25)]">
            <div className="text-center text-4xl">🧟</div>
            <div className="mt-2 text-center text-base font-black text-green-200">자신감있는 좀비행동</div>
            <div className="mt-3 text-center text-xs leading-relaxed text-gray-300">
              사용할까요? 사용하면 주사위 1개를 굴립니다.<br />
              🎲6: 상대 용감이 흡수 / 🎲1: 내 용감이 1인 제거
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={useZombieLeaderSkill} className="btn-primary flex-1 text-xs py-2">
                사용하고 굴리기
              </button>
              <button onClick={cancelInteraction} className="btn-secondary flex-1 text-xs py-2">
                사용 안 함
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      <TableActions target={actionsTarget}>
      {interaction && interaction.kind !== 'leader_skill_zombie_confirm' && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-amber-300">
              {getInteractionTitle(interaction)}
            </div>
            <div className="text-xs text-amber-100/80">{getInteractionGuide(interaction, players, currentPlayerIndex)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isMyTurn && <>
            {interaction.step === 'select_trade_resource' && (
              <>
                <button onClick={() => selectTradeResource('can')} className="btn-primary text-xs px-3 py-1">
                  🥫 통조림 제공
                </button>
                <button onClick={() => selectTradeResource('bottleCap')} className="btn-primary text-xs px-3 py-1">
                  🪙 병뚜껑 제공
                </button>
              </>
            )}
            {['assign_event_party', 'assign_utopia_party'].includes(interaction.kind) &&
              interaction.step === 'select_my_survivor' && (() => {
                const selected = interaction.payload.selectedMyUids ?? []
                const minCount = interaction.requiredCount
                const maxCount = interaction.maxCount ?? minCount
                if (selected.length >= minCount && selected.length <= maxCount) {
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
            </>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">주변 탐색</span>
        <span className={`text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap ${
          phase === 'action' ? 'bg-sky-900/50 text-sky-300' : 'bg-gray-800 text-gray-500'
        }`}>
          {phase === 'action' ? '행동 단계' : '행동 단계 대기'}
        </span>
      </div>

      {canMoveToPurchase && (
        <button onClick={endActionPhase} className="btn-secondary text-xs px-3 py-1 w-full mt-1">
          파티 정비 단계로
        </button>
      )}
      </TableActions>
    </div>
  )
}

function TableActions({ target, children }) {
  return target ? createPortal(<div className="restored-event-actions">{children}</div>, target) : null
}

function buildTierRows(visibleByTier = {}, eventSlots = []) {
  const byTier = { 1: [], 2: [], 3: [] }
  const tier1Count = RULES.exploration?.eventSlotCountByTier?.[1] ?? visibleByTier[1]?.length ?? 4
  const tier2Count = RULES.exploration?.eventSlotCountByTier?.[2] ?? visibleByTier[2]?.length ?? 4
  const tierOffset = { 1: 0, 2: tier1Count, 3: tier1Count + tier2Count }

  ;[1, 2, 3].forEach((tier) => {
    const slotCount = RULES.exploration?.eventSlotCountByTier?.[tier] ?? visibleByTier?.[tier]?.length ?? 4
    const slots = [...(visibleByTier?.[tier] ?? [])]
    while (slots.length < slotCount) slots.push(null)
    slots.slice(0, slotCount).forEach((event, localIndex) => {
      const slotIndex = event
        ? eventSlots.findIndex((c) => c?.uid === event.uid)
        : tierOffset[tier] + localIndex
      byTier[tier].push({ event: event ?? null, slotIndex })
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

const TIER_ICON_META = {
  1: { Icon: CansIcon, color: 'text-emerald-400' },
  2: { Icon: CrossedSwordsIcon, color: 'text-amber-400' },
  3: { Icon: StarIcon, color: 'text-rose-400' },
}

function TierBackIcon({ tier }) {
  const { Icon, color } = TIER_ICON_META[tier] ?? TIER_ICON_META[1]
  return (
    <Icon
      className="h-12 w-12"
    />
  )
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
  hasDepartedSurvivors,
  player,
  selectedSlotIndex,
  onSelectSlot,
  startEventResolution,
  replaceEventSlot,
  acceptGlobalEvent,
  startUtopiaResolution,
  utopiaState,
  canAttemptUtopia,
  treasureDeckCount,
  actionsTarget,
}) {
  const meta = getTierMeta(tier)
  return (
    <div className={`restored-event-tier rounded-xl border px-2 py-2 ${
      isTierLocked && !isTierVisibleByOthers
        ? 'border-gray-800/70 bg-gray-950/20 opacity-70'
        : isTierLocked
        ? 'border-gray-700/50 bg-gray-950/20'
        : 'border-gray-800 bg-gray-950/35'
    }`}>
      <div className="flex gap-1.5 items-stretch">
        <TierDeckPile tier={tier} deckCount={deckCount} />
        {entries.map((entry, index) => {
          if (!entry || entry.event === null) {
            return isTierLocked && !isTierVisibleByOthers
              ? <CardBack key={`${tier}-hidden-${index}`} tier={tier} title="미발견 탐색지" />
              : <EmptyExplorationSlot key={entry ? `${tier}-null-${entry.slotIndex}` : `${tier}-pad-${index}`} tier={tier} />
          }
          const isViewOnly = !!(isTierVisibleByOthers && isTierLocked)
          return (
            <EventSlot
              key={`${tier}-${entry.slotIndex}`}
              slotIndex={entry.slotIndex}
              event={entry.event}
              actionsTarget={actionsTarget}
              isRevealed={isViewOnly || (!isTierLocked && revealedSlots[entry.slotIndex])}
              isMyTurn={isMyTurn}
              canResolve={canResolve}
              activePartyCount={activePartyCount}
              isResolving={interaction?.slotIndex === entry.slotIndex}
              canReplace={canReplace}
              replaceIsFree={replaceIsFree}
              hasDepartedSurvivors={hasDepartedSurvivors}
              isUtopiaSlot={entry.event?.category === 'clue'}
              isLocked={isTierLocked}
              isViewOnly={isViewOnly}
              player={player}
              isSelected={selectedSlotIndex === entry.slotIndex}
              onSelect={() => onSelectSlot(entry.slotIndex)}
              onDeselect={() => onSelectSlot(null)}
              onResolve={() => { startEventResolution(entry.slotIndex); onSelectSlot(null) }}
              onReplace={() => { replaceEventSlot(entry.slotIndex); onSelectSlot(null) }}
              onAcceptGlobal={() => { acceptGlobalEvent(entry.slotIndex); onSelectSlot(null) }}
            />
          )
        })}
        {tier === 3 && (
          utopiaState?.revealed ? (
            <UtopiaSlot
              utopiaState={utopiaState}
              player={player}
              isMyTurn={isMyTurn}
              canResolve={canResolve}
              canAttemptUtopia={canAttemptUtopia}
              activePartyCount={activePartyCount}
              onResolve={() => { startUtopiaResolution(); onSelectSlot(null) }}
              actionsTarget={actionsTarget}
              isSelected={selectedSlotIndex === 'utopia'}
              onSelect={() => onSelectSlot('utopia')}
              onDeselect={() => onSelectSlot(null)}
            />
          ) : (
            <ReservedUtopiaSlot />
          )
        )}
        {tier === 3 && <TreasureDeckSlot deckCount={treasureDeckCount} />}
      </div>

    </div>
  )
}

function TierDeckPile({ tier, deckCount }) {
  const meta = getTierMeta(tier)
  return <CardBack tier={tier} title={meta.label} subtitle={meta.subtitle} count={deckCount} pile />
}

function ReservedUtopiaSlot() {
  return <CardBack tier={3} kind="유토피아" title="유토피아" message="누군가 3단계 단서를 처음 획득하면 유토피아 카드가 모두에게 공개됩니다. 도전하려면 내 파티도 3단계 단서를 확보해야 합니다. 지도자 덕이의 특수 도달 조건도 적용됩니다." />
}

function EmptyExplorationSlot({ tier, label }) {
  return <div className="printed-empty-slot"><span>{label ?? tier + '단계 빈 슬롯'}</span></div>
}

function UtopiaSlot({ utopiaState, player, isMyTurn, canResolve, canAttemptUtopia, activePartyCount, onResolve, actionsTarget, isSelected, onSelect, onDeselect }) {
  const duckUtopiaReady = isDuckUtopiaDiscoveryReady(player)
  const revealedForLeaderId = utopiaState?.revealedForLeaderId ?? (!utopiaState?.revealed && duckUtopiaReady ? 'duck' : null)
  const revealedCard = revealedForLeaderId
    ? utopiaState.cardsByLeaderId?.[revealedForLeaderId]
    : null

  if ((utopiaState?.revealed || duckUtopiaReady) && revealedCard) {
    const hasEnoughAssigned = activePartyCount >= 1
    const myCompleted = (utopiaState?.completedByPlayerIds ?? []).includes(player?.id)
    const completedCount = (utopiaState?.completedByPlayerIds ?? []).length
    const target = revealedCard.check?.target ?? revealedCard.resolution?.target ?? 15
    const canSelect = isMyTurn && !myCompleted && canResolve
    return (
      <>
      <div data-board-card="utopia" role={canSelect ? 'button' : undefined} tabIndex={canSelect ? 0 : undefined} aria-label={revealedCard.name}
        onClick={() => { if (canSelect) onSelect() }}
        onKeyDown={event => { if (canSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect() } }}
        className={'expedition-card restored-expedition tier-3' + (isSelected ? ' is-selected' : '') + (canSelect ? ' cursor-pointer' : '')}>
        <div className="expedition-top"><span>유토피아</span><span>🎲 {target}+</span></div>
        <Scene tier={3} utopia />
        <div className="expedition-info">
          <h3>{revealedCard.name}</h3>
          <p className="card-flavor">{myCompleted ? '도달 완료 ✅' : '3단계 단서를 확보한 파티의 최종 도전'}</p>
          {revealedCard.recommendedParty?.length > 0 && <div className="event-tags"><RecommendedPartyBadges event={revealedCard} compact /><small>타입 점수</small></div>}
          <div className="event-reward"><span>도달 보상</span><strong>★ {completedCount === 0 ? '+7' : '+3'}</strong></div>
        </div>
      </div>
      {isSelected && isMyTurn && !myCompleted && <TableActions target={actionsTarget}>
        <strong className="text-xs">{revealedCard.name}</strong>
        <button onClick={onResolve} disabled={!canResolve || !hasEnoughAssigned || !canAttemptUtopia} className="btn-primary text-xs">
          {!hasEnoughAssigned ? '인원 부족' : !canAttemptUtopia ? '단서/덕이 조건 필요' : canResolve ? (completedCount === 0 ? '유토피아 도전 (+7)' : '유토피아 도전 (+3)') : '행동 소진'}
        </button>
        <button onClick={onDeselect} className="btn-secondary text-xs">선택 취소</button>
      </TableActions>}
      </>
    )
  }

  return (
    <div className="w-[160px] h-[290px] rounded-lg border-2 border-dashed border-yellow-800 bg-yellow-950/20 flex flex-col items-center justify-center gap-2 shrink-0">
      <div className="text-3xl">🂠</div>
      <div className="text-sm font-semibold text-yellow-300">유토피아</div>
      <div className="text-[11px] text-yellow-100/60 text-center px-2">3단계 단서 최초 획득 시 공개</div>
    </div>
  )
}



function TreasureDeckSlot({ deckCount = 0 }) {
  return <div data-board-card className="card-stack" style={{ '--tier-color': '#a38a50' }}><div className="stack-card"><span className="stack-corner">보물</span><span className="deck-emblem">💎</span><strong>보물 덱</strong><small>{deckCount}장</small><small className="text-center px-3">열쇠가 필요한 보물 이벤트 해결 시 1장 획득</small></div></div>
}

function TypeSendDisplay({ type }) {
  const meta = TYPE_TAG_META[type] ?? { label: type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-black text-sky-200 leading-none">
      <span
        title={`${type} 1명 파견`}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-black leading-none ${meta.className}`}
      >
        {meta.label}
      </span>
      <span>-1 (파견)</span>
    </span>
  )
}

function ResolutionActionDisplay({ resolution }) {
  if (!resolution) return null

  const amount = resolution.amount ?? 0
  const signText = amount > 0 ? `+${amount}` : `${amount}`
  const colorClass = amount >= 0 ? 'text-emerald-300' : 'text-rose-300'

  if (resolution.type === 'resource_delta') {
    const iconName = resolution.resource === 'bottleCap' ? 'bottleCap' : 'can'
    const label = resolution.resource === 'bottleCap' ? '병뚜껑' : '통조림'
    return (
      <span className={`inline-flex items-center gap-1 text-[14px] font-black leading-none ${colorClass}`} title={`${label} ${signText}`}>
        <PersonalIcon name={iconName} alt={label} className="h-4 w-4" />
        <span>{signText}</span>
      </span>
    )
  }

  if (resolution.type === 'survivor_delta') {
    return (
      <span className={`inline-flex items-center gap-1 text-[14px] font-black leading-none ${colorClass}`} title={`생존자 ${signText}`}>
        <SurvivorStack count={Math.max(1, Math.abs(amount))} />
        <span>{signText}</span>
      </span>
    )
  }

  if (resolution.type === 'survivor_type_delta') {
    const type = resolution.survivorType
    const meta = TYPE_TAG_META[type] ?? { label: type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }
    return (
      <span className={`inline-flex items-center gap-1.5 text-[14px] font-black leading-none ${colorClass}`} title={`${type} ${signText}`}>
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-black leading-none ${meta.className}`}>
          {meta.label}
        </span>
        <span>{signText}</span>
      </span>
    )
  }

  if (resolution.type === 'deactivate_survivor') {
    const count = Math.max(1, resolution.amount ?? 1)
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-black leading-none text-sky-200" title={`생존자 ${count}명 비활성화`}>
        <SurvivorStack count={count} />
        <span>비활성</span>
      </span>
    )
  }

  if (resolution.type === 'deactivate_survivor_type') {
    const type = resolution.survivorType
    const count = Math.max(1, resolution.amount ?? 1)
    const meta = TYPE_TAG_META[type] ?? { label: type?.slice(0, 1) ?? '?', className: 'border-gray-500 bg-gray-800 text-gray-100' }
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-black leading-none text-sky-200" title={`${type} ${count}명 비활성화`}>
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: count }, (_, index) => (
            <span key={index} className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-black leading-none ${meta.className}`}>
              {meta.label}
            </span>
          ))}
        </span>
        <span>비활성</span>
      </span>
    )
  }

  return null
}

function EventSlot({ actionsTarget, event, isRevealed, isMyTurn, canResolve, activePartyCount, isResolving, canReplace, replaceIsFree, hasDepartedSurvivors, isUtopiaSlot, isLocked, isViewOnly, player, isSelected, onSelect, onDeselect, onResolve, onReplace, onAcceptGlobal }) {
  if (!event) {
    return (
      <div className="w-[160px] h-[290px] rounded-lg border-2 border-dashed border-gray-800 bg-gray-950/50 flex items-center justify-center shrink-0">
        <span className="text-sm text-gray-700">슬롯 비어있음</span>
      </div>
    )
  }

  if (!isRevealed) {
    return <CardBack tier={event.tier ?? 1} title={isLocked ? '미발견 탐색지' : '사건 발견'} />
  }

  const style = isUtopiaSlot ? SCOPE_STYLE.clue : (event.category === 'clue' ? SCOPE_STYLE.clue : (SCOPE_STYLE[event.scope] ?? SCOPE_STYLE.personal))
  const rewards = getDisplayRewards(event)
  const isKeyEvent = rewards.some((reward) => reward.type === 'key')
  const isClueEvent = event.category === 'clue'
  const clueArtifact = getClueArtifactMeta(event)
  const isArtifactEvent = isKeyEvent || isClueEvent
  const isDisasterEvent = event.scope === 'disaster'
  const bottomTypeMeta = getEventBottomTypeMeta(event)
  const requiredAssignedType = getRequiredAssignedTypeForEvent(event)
  const keyUnlockOnly = canResolveWithKeyOnly(player, event)
  const requiredActiveCount = keyUnlockOnly ? 1 : getRequiredSurvivorsForEvent(event)
  const hasEnoughAssigned = activePartyCount >= requiredActiveCount
    const penaltyLabel = getPenaltyLabel(event.failPenalty)

  const requiredPartyTypes = getRequiredPartyTypesForEvent(event)
  const requiredSurvivorTypes = getRequiredSurvivorTypesForEvent(event)
  const requiredKeyCount = getRequiredKeyCountForEvent(event)
  const genericSurvivorLabel = getGenericSurvivorRequirementLabel(event, requiredSurvivorTypes)
  const resolutionLabel = getResolutionLabel(event, { includeAssignment: requiredPartyTypes.length === 0 })
  const resolutionAction = ['resource_delta', 'survivor_delta', 'survivor_type_delta', 'deactivate_survivor', 'deactivate_survivor_type'].includes(event?.resolution?.type)
  const sendSurvivorType = event?.resolution?.type === 'send_survivor_type' ? event.resolution.survivorType : null
  const activeSurvivors = (player?.party ?? []).filter((survivor) => player?.survivorActivity?.[survivor.uid] !== false)
  const hasRequiredType = canSatisfyTypeRequirements(player, requiredSurvivorTypes, activeSurvivors)
  const requiresKey = event.requiresKey || event.resolution?.requiresKey
  const ownedKeyCount = player?.keyCards?.length ?? 0
  const hasKey = ownedKeyCount > 0
  const hasRequiredKeys = ownedKeyCount >= requiredKeyCount
  const needsDeparted = event.resolution?.type === 'steal_from_grave' || event.resolution?.type === 'revive_from_grave'
  const hasGraveCondition = !needsDeparted || hasDepartedSurvivors
  const isPersonalResolvable = event.scope === 'personal' && !event.autoStartOnReveal
  const isDisabled = isLocked || !canResolve || !hasEnoughAssigned || !hasRequiredType || !hasRequiredKeys || !hasGraveCondition
  const canSelect = isMyTurn && !isLocked && !isViewOnly && (canResolve || canReplace)

  const isDiceBased = event?.resolution?.type === 'roll_dice' || event?.resolution?.type === 'roll_dice_score_bonus' || event?.resolution?.type === 'support_roll_dice' || !!event?.resolution?.diceGate
  const isSharedDispatch = event?.resolution?.type === 'shared_dispatch_reward'
  const isTypeBased = requiredPartyTypes.length > 0 && !isDiceBased && event.scope !== 'disaster'
  const diceTarget = event?.resolution?.diceGate?.target ?? event?.resolution?.target

  function handleCardClick() {
    if (canSelect) onSelect()
  }

  return (
    <>
    <div
      onClick={handleCardClick}
      aria-label={event.name}
      title={String(event.description ?? '').replace(/\\n/g, '\n')}
      data-board-card="event"
      role={canSelect ? 'button' : undefined}
      tabIndex={canSelect ? 0 : undefined}
      onKeyDown={keyEvent => { if (canSelect && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) { keyEvent.preventDefault(); handleCardClick() } }}
      className={'expedition-card restored-expedition tier-' + (event.tier ?? 1) + (isSelected ? ' is-selected' : '') + (canSelect ? ' cursor-pointer' : '')}
    >
      <div className="expedition-top">
        <span>{isClueEvent ? '유토피아 단서' : isDisasterEvent ? '재난' : (event.tier ?? 1) + '단계 · ' + (bottomTypeMeta?.label ?? '주변 탐색')}</span>
        <span>{isViewOnly ? '🔒 단서 필요' : isDiceBased ? '🎲 ' + diceTarget + '+' : isKeyEvent ? '🗝️ 열쇠' : ''}</span>
      </div>
      <Scene tier={event.tier ?? 1} variant={String(event.id).length} utopia={isClueEvent} />
      <div className="expedition-info">
        <h3>{isKeyEvent ? '낡은 열쇠' : event.name}</h3>
        <p className="card-flavor line-clamp-3">{isArtifactEvent ? isKeyEvent ? '먼 곳의 문을 여는 낡은 증표' : clueArtifact.text : String(event.description ?? '').replace(/\\n/g, ' ')}</p>
        <div className="restored-event-conditions">
      {/* 조건 영역: 좌하단, 실패패널티 우하단 */}
      {event.scope !== 'disaster' && (
        <div className="shrink-0 pl-2 pr-3 pb-[9px]">
          {isTypeBased ? (
            // 타입 조건: 배지가 좌하단부터 위로 쌓임
            <div className="relative flex flex-col items-start gap-1">
              {resolutionLabel ? (
                <span className="text-[14px] font-black text-sky-200">
                  <TextWithPersonalIcons text={resolutionLabel} iconClassName="h-4 w-4 inline-block relative -top-[2px]" />
                </span>
              ) : null}
              {resolutionAction && <ResolutionActionDisplay resolution={event.resolution} />}
              {genericSurvivorLabel ? (
                <SurvivorStack count={parseInt(genericSurvivorLabel.replace(/[^0-9]/g, '')) || 1} />
              ) : null}
              {requiredPartyTypes.map((entry) => <RequiredTypeStack key={entry.type} entry={entry} />)}
              {sendSurvivorType && <TypeSendDisplay type={sendSurvivorType} />}
              {needsDeparted && (
                <span
                  title="무덤에 생존자가 있어야 함"
                  className={`text-[13px] leading-none ${hasGraveCondition ? 'text-gray-400' : 'text-rose-400'}`}
                >
                  ⚰️
                </span>
              )}
              {penaltyLabel && (
                <div className="absolute bottom-0 right-0">
                  <span className="text-[11px] font-bold text-rose-300 border border-rose-500/70 bg-rose-950/60 rounded px-1 py-[2.5px] leading-tight">{penaltyLabel}</span>
                </div>
              )}
            </div>
          ) : isDiceBased ? (
            // 주사위 조건: 필수 조건은 좌하단에 쌓고, 목표값은 같은 축에서 크게 표시
            <div className="flex items-end justify-between gap-1">
              <div className="flex flex-col items-start gap-1 leading-none">
                {requiresKey && <KeyIcon className={`h-5 w-5 shrink-0 text-[18px] ${hasKey ? 'text-yellow-200' : 'text-gray-500'}`} />}
                {genericSurvivorLabel ? (
                  <SurvivorStack count={parseInt(genericSurvivorLabel.replace(/[^0-9]/g, '')) || 1} />
                ) : null}
                {requiredPartyTypes.map((entry) => <RequiredTypeStack key={entry.type} entry={entry} />)}
                <div className="flex items-end gap-[5px]">
                  <div className="flex items-center leading-none gap-[0.0px]">
                    <span className="text-[28px] font-bold leading-none text-sky-300 tracking-[-0.055em]">{diceTarget}</span>
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[8.5px] relative top-[7.9px] left-[-2.8px] inline-flex items-center justify-center rounded border border-gray-700 bg-gray-900/60 leading-none px-[1px] py-[1.5px]">🎲</span>
                    </div>
                  </div>
                  {event.recommendedParty?.length > 0 && (
                    // 타입 보너스 박스 — ml-[Npx]: 오른쪽 / -ml-[Npx]: 왼쪽 / mb-[Npx]: 상하
                    <div className="px-[3.8px] py-[1.3px] ml-[-3.2px] rounded-full bg-[#060813]/85 backdrop-blur-sm flex items-center justify-center mb-[-1.5px]">
                      <RecommendedPartyText event={event} />
                    </div>
                  )}
                </div>
              </div>
              {penaltyLabel && (
                <div className="self-end mb-[2px]">
                  <span className="text-[11px] font-bold text-rose-300 border border-rose-500/70 bg-rose-950/60 rounded px-1 py-[2.5px] leading-tight">{penaltyLabel}</span>
                </div>
              )}
            </div>
          ) : (
            // 기타 조건 (자원 지불, 파견 등)
            <div className="flex items-end justify-between gap-1">
              <div className="flex flex-col items-start gap-1.5 flex-1 min-w-0 leading-none">
                {genericSurvivorLabel ? (
                  <SurvivorStack count={parseInt(genericSurvivorLabel.replace(/[^0-9]/g, '')) || 1} />
                ) : null}
                {isSharedDispatch ? (
                  <SharedDispatchRequirementDisplay />
                ) : sendSurvivorType ? (
                  <TypeSendDisplay type={sendSurvivorType} />
                ) : getSendAwaySurvivorCount(event) > 0 ? (
                  <SurvivorRemoveDisplay count={getSendAwaySurvivorCount(event)} />
                ) : resolutionLabel ? (
                  <span className="text-[16px] font-black text-sky-200">
                    <TextWithPersonalIcons text={resolutionLabel} iconClassName="h-4 w-4 inline-block relative -top-[3.2px]" />
                  </span>
                ) : resolutionAction ? (
                  <ResolutionActionDisplay resolution={event.resolution} />
                ) : null}
                {requiresKey && <KeyIcon className={`h-4 w-4 shrink-0 text-[16px] ${hasKey ? 'text-yellow-200' : 'text-gray-500'}`} />}
                {requiredAssignedType && requiredPartyTypes.length === 0 && (
                  <span className="text-[16px] font-black text-sky-200 truncate">{requiredAssignedType}</span>
                )}
              </div>
              {penaltyLabel && (
                <div className="shrink-0">
                  <span className="text-[11px] font-bold text-rose-300 border border-rose-500/70 bg-rose-950/60 rounded px-1 py-[2.5px] leading-tight">{penaltyLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}



        </div>
        {isDisasterEvent && getDisasterEffectLabel(event) && <div className="printed-failure">{getDisasterEffectLabel(event)}</div>}
        <div className="event-reward"><span>획득</span><RewardSummary rewards={rewards} compact /></div>
      </div>
    </div>
    {isSelected && isMyTurn && !isViewOnly && <TableActions target={actionsTarget}>
      <strong className="text-xs">{event.name}</strong>
      <p className="text-xs whitespace-pre-line">{String(event.description ?? '').replace(/\\n/g, '\n')}</p>
      {event.scope === 'personal' ? (
        <button onClick={onResolve} disabled={isDisabled} className="btn-primary text-xs">
          {isLocked ? '단서 필요' : isResolving ? '진행 중' : !hasEnoughAssigned ? '인원 부족' : !hasRequiredType ? '필요한 성향 없음' : !hasRequiredKeys ? '열쇠 부족' : !hasGraveCondition ? '떠난 생존자 없음' : event.autoStartOnReveal ? '받아들이기(필수)' : '탐색 선택 확인'}
        </button>
      ) : (
        <button onClick={onAcceptGlobal} disabled={isLocked || !canResolve} className="btn-primary text-xs">받아들이기(필수)</button>
      )}
      {isPersonalResolvable && event.category !== 'clue' && <button onClick={onReplace} disabled={isLocked || !canReplace} className="btn-secondary text-xs">{replaceIsFree ? '넘기기 (벌점 없음)' : '넘기기 (-1점)'}</button>}
      <button onClick={onDeselect} className="btn-secondary text-xs">선택 취소</button>
    </TableActions>}
    </>
  )
}

function getInteractionTitle(interaction) {
  if (interaction.kind === 'assign_event_party') return '주변 탐색 파견'
  if (interaction.kind === 'assign_utopia_party') return '유토피아 최종 도전'
  if (interaction.kind === 'upkeep_discard') return '턴 종료 정산'
  if (interaction.kind === 'leader_skill_robot_search') return '지도자 스킬 · 행복수치 계산'
  if (interaction.kind === 'leader_skill_zombie_confirm' || interaction.kind === 'leader_skill_zombie_steal') return '지도자 스킬 · 자신감있는 좀비행동'
  if (interaction.kind === 'leader_skill_duck_absorb') return '지도자 스킬 · 간절한 기도'
  if (interaction.kind === 'survivor_endturn_escape') return '생존자 능력 · 탈옥'
  if (interaction.kind === 'survivor_endturn_wizard_swap') return '생존자 능력 · 위치 왜곡'
  if (interaction.kind === 'survivor_recruit_magicgirl_take') return '생존자 능력 · 마법소녀 합류'
  if (interaction.kind === 'survivor_skill_wizard') return '생존자 능력 · 마법사 분리 마법'
  if (interaction.kind === 'use_stim_pack') return '비상약 사용 중'
  return interaction.event ? `${interaction.event.emoji} ${interaction.event.name}` : '능력 사용'
}

function getInteractionGuide(interaction, players, currentPlayerIndex) {
  if (interaction.step === 'select_trade_resource') {
    const amount = interaction.event?.resolution?.give?.amount ?? 2
    return `제공할 자원 종류를 선택하세요. 상대방은 반대 자원 ${amount}개를 제공합니다.`
  }
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
    if (interaction.event?.resolution?.type === 'support_roll_dice') {
      return `${interaction.event?.name ?? '합동 작전'}에 파견할 활성 생존자 ${rangeStr}을 선택하세요. 이후 지원받을 상대 생존자 1명을 고릅니다.`
    }
    if (interaction.event?.resolution?.type === 'resource_duel') {
      return `${interaction.event?.name ?? '대결'}에 파견할 활성 생존자 ${rangeStr}을 선택하세요. 같은 수의 주사위로 상대와 대결합니다.`
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
  if (interaction.kind === 'leader_skill_zombie_confirm') {
    return '자신감있는 좀비행동을 사용하시겠습니까? 사용하면 주사위 1개를 굴립니다. 🎲6: 상대 용감이 흡수 / 🎲1: 내 용감이 1인 제거'
  }
  if (interaction.kind === 'leader_skill_zombie_steal') {
    if (interaction.step === 'select_target_player') return '흡수할 용감이가 있는 대상 플레이어를 선택하세요.'
    return `${players[interaction.payload?.targetPlayerIndex]?.name ?? '대상 플레이어'}의 파티에서 흡수할 용감이 1명을 선택하세요.`
  }
  if (interaction.kind === 'leader_skill_duck_absorb') {
    if (interaction.step === 'select_target_player') return '🪙6개를 사용해 흡수할 대상 플레이어를 선택하세요. 취소하면 사용하지 않습니다.'
    return `${players[interaction.payload?.targetPlayerIndex]?.name ?? '대상 플레이어'}의 파티에서 흡수할 용감이 1명을 선택하세요.`
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
      if (interaction.event.resolution.type === 'support_roll_dice') return '생존자 1명을 지원받을 대상 플레이어를 선택하세요.'
      if (interaction.event.resolution.type === 'shared_dispatch_reward') return '생존자 1명을 함께 파견할 대상 플레이어를 선택하세요.'
      if (interaction.event.resolution.type === 'resource_duel') return '대결을 신청할 대상 플레이어를 선택하세요.'
      return '대상 플레이어를 선택하세요.'
    case 'select_target_survivor':
      if (interaction.event.resolution.type === 'support_roll_dice') {
        return `${targetPlayer?.name ?? '대상 플레이어'}의 파티에서 지원받을 활성 생존자 1명을 선택하세요.`
      }
      if (interaction.event.resolution.type === 'shared_dispatch_reward') {
        return `${targetPlayer?.name ?? '대상 플레이어'}의 파티에서 함께 파견할 활성 생존자 1명을 선택하세요.`
      }
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
  if (interaction.kind === 'use_stim_pack') return '내 파티에서 비활성 생존자 1명을 선택해 즉시 활성화하세요.'
}
