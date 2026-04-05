import { useState } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { calcPartyScore } from '../logic/scoring.js'

const TYPE_COLOR = {
  군기반장: 'border-blue-500 bg-blue-950/40',
  분위기메이커: 'border-pink-500 bg-pink-950/40',
  돌격대장: 'border-green-500 bg-green-950/40',
  '4차원': 'border-yellow-500 bg-yellow-950/40',
  겁쟁이: 'border-purple-500 bg-purple-950/40',
  평범: 'border-gray-500 bg-gray-900/40',
}

const TYPE_BADGE_COLOR = {
  군기반장: 'bg-blue-800 text-blue-200',
  분위기메이커: 'bg-pink-800 text-pink-200',
  돌격대장: 'bg-green-800 text-green-200',
  '4차원': 'bg-yellow-800 text-yellow-200',
  겁쟁이: 'bg-purple-800 text-purple-200',
  평범: 'bg-gray-700 text-gray-300',
}

export default function PartySlot({ playerIndex, isEditable, compact = false, showSummary = true }) {
  const {
    players,
    currentPlayerIndex,
    interaction,
    swapPartyMembers,
    selectMySurvivor,
    selectTargetSurvivor,
    selectSwapSurvivor,
  } = useGameStore()
  const player = players[playerIndex]
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  if (!player) return null

  const { total, breakdown } = calcPartyScore(player.party, player.leaderId)
  const eventBonus = player.scoreTokens ?? 0
  const penalty = player.abandonedEvents?.length ?? 0
  const finalScore = total + eventBonus - penalty

  function handleDragStart(i) { setDragging(i) }
  function handleDragOver(e, i) { e.preventDefault(); setDragOver(i) }
  function handleDrop(i) {
    if (dragging === null || dragging === i) { setDragging(null); setDragOver(null); return }
    swapPartyMembers(playerIndex, dragging, i)
    setDragging(null)
    setDragOver(null)
  }

  function getInteractionRole(uid) {
    if (!interaction) return null

    if (interaction.step === 'select_my_survivor' && playerIndex === currentPlayerIndex) {
      return interaction.payload.selectedMyUids.includes(uid) ? 'selected' : 'selectable'
    }

    if (interaction.step === 'select_target_survivor' && playerIndex === interaction.payload.targetPlayerIndex) {
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
      <div className={`flex gap-2 flex-wrap ${compact ? 'min-h-[60px]' : 'min-h-[170px]'}`}>
        {player.party.map((survivor, i) => {
          const rowData = breakdown[i]
          const adjacencyDelta = rowData?.adjacencyScore ?? 0
          const interactionRole = getInteractionRole(survivor.uid)
          const canInteract = interactionRole === 'selectable' || interactionRole === 'selected'

          return (
            <div
              key={survivor.uid}
              draggable={isEditable && !interaction}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onClick={() => canInteract && handleSelect(survivor.uid)}
              className={`relative overflow-hidden border-2 rounded-[1.15rem] cursor-grab transition-all flex flex-col ${
                compact ? 'w-16 h-[60px] p-2 text-center' : 'w-44 h-[18.25rem] p-3 text-left'
              }
                ${TYPE_COLOR[survivor.type] ?? 'border-gray-600 bg-gray-800'}
                ${dragOver === i ? 'scale-105 border-amber-400' : ''}
                ${canInteract ? 'cursor-pointer ring-1 ring-sky-700/60 hover:border-sky-400' : ''}
                ${interactionRole === 'selected' ? 'border-sky-400 ring-2 ring-sky-500/70' : ''}
              `}
            >
              {compact && (
                <>
                  <div className="text-sm text-gray-500 absolute top-1 left-1.5">#{i + 1}</div>
                  <div className="text-2xl mt-3">{survivor.emoji}</div>
                  <div className="text-xs font-semibold text-gray-200 mt-1 leading-tight">{survivor.name}</div>
                  <div className="mt-1 text-xs">
                    <span className="text-gray-400">기본 {survivor.score}</span>
                    {adjacencyDelta !== 0 && (
                      <span className={adjacencyDelta > 0 ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                        {adjacencyDelta > 0 ? '+' : ''}{adjacencyDelta}
                      </span>
                    )}
                  </div>
                </>
              )}

              {!compact && (
                <>
                  <div className="absolute left-3 top-3 text-[11px] font-semibold text-gray-500">#{i + 1}</div>
                  <div className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-gray-200">
                    {survivor.score}
                    {adjacencyDelta !== 0 && (
                      <span className={adjacencyDelta > 0 ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                        {adjacencyDelta > 0 ? '+' : ''}{adjacencyDelta}
                      </span>
                    )}
                  </div>

                  <div className="rounded-[0.9rem] border border-white/10 bg-white/5 px-3 pt-7 pb-3.5">
                    <div className="flex min-h-[4.9rem] items-center justify-center rounded-[0.8rem] bg-black/15">
                      <div className="text-5xl drop-shadow-[0_3px_0_rgba(0,0,0,0.22)]">{survivor.emoji}</div>
                    </div>

                    <div className="mt-3 text-center">
                      <div className="text-[1rem] font-semibold uppercase tracking-[0.06em] leading-tight text-gray-50">
                        {survivor.name}
                      </div>
                    </div>

                    {survivor.effect && (
                      <div className="mt-3 text-[11px] leading-snug text-gray-200 line-clamp-4">
                        {survivor.effect}
                      </div>
                    )}

                    <div className="mt-2 text-[10px] leading-snug text-gray-400 line-clamp-3 min-h-[2.35rem]">
                      {survivor.description}
                    </div>

                    {rowData?.details?.length > 0 && (
                      <div className="mt-2 text-[10px] leading-snug text-gray-500 line-clamp-2">
                        {rowData.details.join(', ')}
                      </div>
                    )}
                  </div>

                  <div className={`mt-auto -mx-3 -mb-3 px-3 pt-2.5 pb-3 ${TYPE_BADGE_COLOR[survivor.type]}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
                      {survivor.type}
                    </div>
                    {survivor.specialBonus && (
                      <div className="mt-0.5 text-[10px] leading-snug">
                        {survivor.specialBonus}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}

        {/* 빈 슬롯 */}
        {Array.from({ length: Math.max(0, player.maxPartySize - player.party.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className={`border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center text-gray-700 text-xs
              ${compact ? 'w-16 h-[60px]' : 'w-44 h-[18.25rem]'}`}
          >
            빈 슬롯
          </div>
        ))}
      </div>

      {isEditable && player.party.length > 1 && (
        <p className="text-xs text-gray-600 mt-2">드래그해서 순서 변경 (병뚜껑 -{2})</p>
      )}
    </div>
  )
}
