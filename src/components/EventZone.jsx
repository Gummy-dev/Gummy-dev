import { useGameStore } from '../store/gameStore.js'
import { RULES } from '../data/rules.js'

const SCOPE_STYLE = {
  personal: { label: '개인', border: 'border-blue-700', badge: 'bg-blue-900/50 text-blue-300' },
  global:   { label: '전체', border: 'border-yellow-700', badge: 'bg-yellow-900/50 text-yellow-300' },
  disaster: { label: '재난', border: 'border-red-700',    badge: 'bg-red-900/50 text-red-400' },
}

const CATEGORY_STYLE = {
  score: { label: '점수', badge: 'bg-emerald-900/50 text-emerald-300' },
  attack: { label: '공격', badge: 'bg-rose-900/50 text-rose-300' },
  resource: { label: '자원', badge: 'bg-amber-900/50 text-amber-300' },
  encounter: { label: '조우', badge: 'bg-cyan-900/50 text-cyan-300' },
}

export default function EventZone({ isMyTurn }) {
  const {
    eventSlots, revealedSlots, eventDeck,
    revealEventSlot, startEventResolution, replaceEventSlot,
    players, currentPlayerIndex,
    phase, interaction, endActionPhase, cancelInteraction,
  } = useGameStore()

  const player = players[currentPlayerIndex]
  const canReveal = isMyTurn && phase === 'action' && (player?.resources?.can ?? 0) >= RULES.eventRevealCost
  const canResolve = isMyTurn && phase === 'action' && !interaction
  const canMoveToPurchase = isMyTurn && phase === 'action' && !interaction
  const phaseLabel = phase === 'action' ? '행동 단계' : '구매 단계'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 mb-1 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">이벤트 구역</span>
          <span className={`text-[11px] rounded-full px-2 py-0.5 ${
            phase === 'action' ? 'bg-amber-900/60 text-amber-300' : 'bg-sky-900/50 text-sky-300'
          }`}>
            {phaseLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-600">이벤트 확인: 🥫 {RULES.eventRevealCost}</span>
          {canMoveToPurchase && (
            <button onClick={endActionPhase} className="btn-secondary text-xs px-3 py-1">
              구매 단계로
            </button>
          )}
        </div>
      </div>

      {interaction && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-amber-300">
              {interaction.kind === 'upkeep_discard'
                ? '턴 종료 정산'
                : `${interaction.event.emoji} ${interaction.event.name}`}
            </div>
            <div className="text-xs text-amber-100/80">{getInteractionGuide(interaction, players, currentPlayerIndex)}</div>
          </div>
          {interaction.kind !== 'upkeep_discard' && (
            <button onClick={cancelInteraction} className="btn-secondary text-xs px-3 py-1">
              취소
            </button>
          )}
        </div>
      )}

      {/* 가로 배치: 덱 + 슬롯 3개 */}
      <div className="flex gap-2 items-stretch overflow-x-auto pb-1">
        {/* 전체 이벤트 덱 */}
        <DeckPile count={eventDeck.length} />

        {/* 이벤트 슬롯 3개 */}
        {eventSlots.map((event, i) => (
          <EventSlot
            key={i}
            slotIndex={i}
            event={event}
            isRevealed={revealedSlots[i]}
            isMyTurn={isMyTurn}
            canReveal={canReveal}
            canResolve={canResolve}
            isResolving={interaction?.slotIndex === i}
            canReplace={canResolve}
            onReveal={() => revealEventSlot(i)}
            onResolve={() => startEventResolution(i)}
            onReplace={() => replaceEventSlot(i)}
          />
        ))}
      </div>
    </div>
  )
}

function DeckPile({ count }) {
  return (
    <div className="flex flex-col items-center justify-center w-24 h-60 rounded-lg border-2 border-dashed border-gray-700 bg-gray-900/50 gap-1 shrink-0">
      <div className="text-3xl">🂠</div>
      <div className="text-xs text-gray-500 font-semibold">이벤트 덱</div>
      <div className="text-xs text-gray-600">{count}장 남음</div>
    </div>
  )
}

function EventSlot({ event, isRevealed, isMyTurn, canReveal, canResolve, isResolving, canReplace, onReveal, onResolve, onReplace }) {
  if (!event) {
    return (
      <div className="w-36 h-60 rounded-lg border-2 border-dashed border-gray-800 bg-gray-950/50 flex items-center justify-center shrink-0">
        <span className="text-xs text-gray-700">슬롯 비어있음</span>
      </div>
    )
  }

  if (!isRevealed) {
    return (
      <div className="w-36 h-60 rounded-lg border-2 border-dashed border-gray-600 bg-gray-900/60 flex flex-col items-center justify-center gap-2 relative overflow-hidden shrink-0">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #666 0, #666 1px, transparent 0, transparent 50%)',
            backgroundSize: '8px 8px',
          }}
        />
        <span className="text-3xl z-10">❓</span>
        <span className="text-xs text-gray-500 z-10">미지의 이벤트</span>
        {isMyTurn && (
          <button
            onClick={onReveal}
            disabled={!canReveal}
            className="btn-secondary text-xs px-2 py-1 z-10 mt-1"
          >
            {canReveal ? `🥫 ${RULES.eventRevealCost} 확인` : '통조림 부족'}
          </button>
        )}
      </div>
    )
  }

  const style = SCOPE_STYLE[event.scope] ?? SCOPE_STYLE.personal

  return (
    <div
      className={`w-36 h-60 rounded-lg border-2 ${style.border} bg-gray-900 flex flex-col gap-1.5 p-3 pb-4 relative shrink-0 overflow-hidden`}
    >
      {/* 배지 */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${style.badge}`}>
            {style.label}
          </span>
          {event.category && CATEGORY_STYLE[event.category] && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CATEGORY_STYLE[event.category].badge}`}>
              {CATEGORY_STYLE[event.category].label}
            </span>
          )}
        </div>
        <span className="text-lg">{event.emoji}</span>
      </div>

      <div className="text-sm font-semibold text-gray-100 leading-tight min-h-[2.25rem] line-clamp-2">{event.name}</div>

      <div className="rounded bg-gray-950/60 px-2 py-1.5 text-[10px] leading-snug text-gray-300 min-h-[4.5rem] line-clamp-5">
        {event.description}
      </div>

      {event.targetScore && (
        <div className="text-xs text-amber-400">
          목표 {event.targetScore}점 → {event.rewardType} +{event.rewardAmount}
        </div>
      )}

      {event.affinityBonus && (
        <div className="text-xs text-green-500 truncate">✨ {event.affinityBonus.desc}</div>
      )}

      {/* 개인 이벤트 해결 버튼 */}
      {isMyTurn && event.scope === 'personal' && (
        <div className="mt-auto grid grid-cols-1 gap-1 pt-1 mb-1">
          <button
            onClick={onResolve}
            disabled={!canResolve}
            className="btn-primary text-[10px] py-1 w-full disabled:opacity-50"
          >
            {isResolving ? '진행 중' : '해결 시작'}
          </button>
          <button
            onClick={onReplace}
            disabled={!canReplace}
            className="btn-secondary text-[10px] py-1 w-full disabled:opacity-50"
          >
            넘기기 -1점
          </button>
        </div>
      )}

      {event.scope !== 'personal' && (
        <div className="text-xs text-gray-600 mt-auto italic">⚡ 공개 즉시 발동</div>
      )}
    </div>
  )
}

function getInteractionGuide(interaction, players, currentPlayerIndex) {
  if (interaction.kind === 'upkeep_discard') {
    return `통조림이 부족합니다. 내 파티에서 버릴 생존자 ${interaction.requiredCount}명을 선택하세요.`
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
    default:
      return '이벤트를 해결 중입니다.'
  }
}
