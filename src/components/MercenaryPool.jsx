import { useState } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { RULES } from '../data/rules.js'

const TYPE_BADGE = {
  반장: 'bg-blue-800 text-blue-200',
  분위기메이커: 'bg-pink-800 text-pink-200',
  용감이: 'bg-green-800 text-green-200',
  '4차원': 'bg-yellow-800 text-yellow-200',
  겁쟁이: 'bg-purple-800 text-purple-200',
  평범: 'bg-gray-700 text-gray-300',
}

const TYPE_COLOR = {
  반장: 'border-blue-500 bg-blue-950/40',
  분위기메이커: 'border-pink-500 bg-pink-950/40',
  용감이: 'border-green-500 bg-green-950/40',
  '4차원': 'border-yellow-500 bg-yellow-950/40',
  겁쟁이: 'border-purple-500 bg-purple-950/40',
  평범: 'border-gray-500 bg-gray-900/40',
}

const TYPE_BG = {
  반장: 'bg-blue-950/40',
  분위기메이커: 'bg-pink-950/40',
  용감이: 'bg-green-950/40',
  '4차원': 'bg-yellow-950/40',
  겁쟁이: 'bg-purple-950/40',
  평범: 'bg-gray-900/40',
}

function getPartySlotCount(party = []) {
  let count = 0
  let lastStackGroupKey = null

  for (const survivor of party) {
    const stackGroupKey = survivor.stackGroupKey ?? null
    if (stackGroupKey && stackGroupKey === lastStackGroupKey) continue
    count += 1
    lastStackGroupKey = stackGroupKey
  }
  return count
}

function getSharedDepartedSurvivors(players = [], departedSurvivors = []) {
  const merged = [
    ...departedSurvivors,
    ...players.flatMap((player) => player.graveyard ?? []),
  ]
  const seen = new Set()
  return merged.filter((survivor) => {
    if (!survivor || seen.has(survivor.uid)) return false
    seen.add(survivor.uid)
    return true
  })
}

function isAnimalSurvivor(survivor) {
  return [
    's_military_2',
    's_charge_2',
    's_charge_4',
    's_coward_1',
    's_mood_3',
  ].includes(survivor?.id)
}

function canStackOnExistingSlot(party = [], survivor) {
  if (!survivor) return false
  if (survivor.stackKey && party.some((entry) => entry.uid !== survivor.uid && entry.stackKey === survivor.stackKey)) return true
  return party.some((entry) => entry.id === 's_mood_3') && isAnimalSurvivor(survivor)
}

function canRecruitSurvivorLocally(player, survivor) {
  if (!survivor) return false
  if (survivor.type !== '평범') return true
  return !(player?.party ?? []).some((entry) => entry.id === 's_military_2')
}

function getRecruitCostForPlayer(player, survivor) {
  const baseCost = survivor?.recruitCost ?? 0
  const moodGirlDiscount = (player?.party ?? []).some((entry) => entry.id === 's_mood_1') ? 1 : 0
  return Math.max(0, baseCost - moodGirlDiscount)
}

function getAccessibleSearchTier(player) {
  return player?.unlockedExplorationTier ?? 1
}

function getSearchTierMeta(tier) {
  return {
    1: { label: '1단계', subtitle: '근처 탐색', border: 'border-emerald-800', text: 'text-emerald-300', deck: 'bg-emerald-950/30 border-emerald-700' },
    2: { label: '2단계', subtitle: '외곽 탐색', border: 'border-amber-800', text: 'text-amber-300', deck: 'bg-amber-950/30 border-amber-700' },
    3: { label: '3단계', subtitle: '먼 곳 탐색', border: 'border-rose-800', text: 'text-rose-300', deck: 'bg-rose-950/30 border-rose-700' },
  }[tier]
}

export default function MercenaryPool({ isMyTurn }) {
  const {
    mercenaryPool,
    searchState,
    returnedMercenary,
    players,
    currentPlayerIndex,
    recruitReturnedSurvivor,
    recruitSurvivor,
    discardMercenary,
    revealSearchSlot,
    revealCard,
    revealedUids,
    departedSurvivors,
    interaction,
    selectGraveSurvivor,
    selectLeaderSearchCandidate,
    cancelRobotSearch,
    startRobotExtraSearch,
    phase,
    endTurn,
  } = useGameStore()
  const player = players[currentPlayerIndex]
  const canAct = isMyTurn && phase === 'party_maintenance'
  const canLocalResolveInteraction = currentPlayerIndex === 0 && !player?.isBot
  const sharedDeparted = getSharedDepartedSurvivors(players, departedSurvivors)
  const returnedAvailable = returnedMercenary?.availableToPlayerIndex === currentPlayerIndex
  const isDepartedSelectable = canLocalResolveInteraction && interaction?.step === 'select_grave_survivor'
  const isVetRevive = interaction?.kind === 'survivor_recruit_vet_revive'
  const visibleSearchSlots = searchState?.visibleSlots?.length ? searchState.visibleSlots : mercenaryPool
  const visibleByTier = searchState?.visibleByTier ?? { 1: visibleSearchSlots, 2: [], 3: [] }
  const deckCountsByTier = {
    1: searchState?.decksByTier?.[1]?.length ?? 0,
    2: searchState?.decksByTier?.[2]?.length ?? 0,
    3: searchState?.decksByTier?.[3]?.length ?? 0,
  }
  const accessibleTier = getAccessibleSearchTier(player)
  const [selectedSurvivorUid, setSelectedSurvivorUid] = useState(null)

  function handleRecruitClick(survivor) {
    if (!survivor) return
    if (selectedSurvivorUid === survivor.uid) {
      recruitSurvivor(survivor.uid)
      setSelectedSurvivorUid(null)
    } else {
      setSelectedSurvivorUid(survivor.uid)
    }
  }

  return (
    <div onClick={() => setSelectedSurvivorUid(null)}>
      {interaction?.kind === 'leader_skill_robot_search' && (
        <RobotSearchModal
          interaction={interaction}
          player={player}
          onSelect={selectLeaderSearchCandidate}
          onCancel={cancelRobotSearch}
        />
      )}

      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '1fr auto' }}>
        <div style={{ gridColumn: 1, gridRow: 1 }}>
          <SearchTierRow
            tier={3}
            survivors={visibleByTier[3] ?? []}
            deckCount={deckCountsByTier[3]}
            isLocked={3 > accessibleTier}
            player={player}
            canAct={canAct}
            revealedUids={revealedUids}
            revealCard={revealCard}
            discardMercenary={discardMercenary}
            revealSearchSlot={revealSearchSlot}
            startRobotExtraSearch={startRobotExtraSearch}
            interaction={interaction}
            selectedSurvivorUid={selectedSurvivorUid}
            setSelectedSurvivorUid={setSelectedSurvivorUid}
            onRecruitClick={handleRecruitClick}
          />
        </div>

        <div style={{ gridColumn: 1, gridRow: 2 }}>
          <SearchTierRow
            tier={2}
            survivors={visibleByTier[2] ?? []}
            deckCount={deckCountsByTier[2]}
            isLocked={2 > accessibleTier}
            player={player}
            canAct={canAct}
            revealedUids={revealedUids}
            revealCard={revealCard}
            discardMercenary={discardMercenary}
            revealSearchSlot={revealSearchSlot}
            startRobotExtraSearch={startRobotExtraSearch}
            interaction={interaction}
            selectedSurvivorUid={selectedSurvivorUid}
            setSelectedSurvivorUid={setSelectedSurvivorUid}
            onRecruitClick={handleRecruitClick}
          />
        </div>

        <div className="flex flex-col gap-2 w-44 min-w-[11rem] shrink-0" style={{ gridColumn: 2, gridRow: 2 }}>
          <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-gray-400">떠난 생존자</div>
                <div className="text-[11px] text-gray-600">부활/데려오기 선택</div>
              </div>
              <div className="text-xs text-gray-500">{sharedDeparted.length}장</div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2 min-h-6">
              {sharedDeparted.length === 0 && <span className="text-xs text-gray-700">아직 없음</span>}
              {sharedDeparted.map((sv) => (
                (() => {
                  const selectable = isDepartedSelectable && (!isVetRevive || isAnimalSurvivor(sv))
                  return (
                    <button
                      key={sv.uid}
                      onClick={() => selectable && selectGraveSurvivor(sv.uid)}
                      title={sv.name}
                      className={`text-base leading-none transition-all ${
                        selectable
                          ? 'cursor-pointer hover:scale-125 ring-1 ring-violet-400 rounded'
                          : 'opacity-50 cursor-default grayscale'
                      }`}
                    >
                      {sv.emoji}
                    </button>
                  )
                })()
              ))}
            </div>
          </div>

          {returnedMercenary && (
            <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-emerald-300">되돌려진 생존자</div>
                  <div className="text-[11px] text-emerald-100/70">
                    {players[returnedMercenary.fromPlayerIndex]?.name}가 되돌림
                  </div>
                </div>
                <div className="text-lg">{returnedMercenary.survivor.emoji}</div>
              </div>
              <div className="mt-2 text-xs text-gray-200">
                {returnedMercenary.survivor.name}
                <span className={`ml-2 rounded-full px-1.5 py-0.5 ${TYPE_BADGE[returnedMercenary.survivor.type]}`}>
                  {returnedMercenary.survivor.type}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-gray-400">{returnedMercenary.survivor.effect}</div>
              {returnedAvailable ? (
                <button onClick={recruitReturnedSurvivor} disabled={!canAct} className="btn-primary text-xs px-3 py-1 mt-2 w-full disabled:opacity-50">
                  무료로 합류
                </button>
              ) : (
                <div className="mt-2 text-[11px] text-gray-500">
                  다음 차례의 {players[returnedMercenary.availableToPlayerIndex]?.name}만 무료로 가져갈 수 있습니다.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ gridColumn: 1, gridRow: 3 }}>
          <SearchTierRow
            tier={1}
            survivors={visibleByTier[1] ?? []}
            deckCount={deckCountsByTier[1]}
            isLocked={1 > accessibleTier}
            player={player}
            canAct={canAct}
            revealedUids={revealedUids}
            revealCard={revealCard}
            discardMercenary={discardMercenary}
            revealSearchSlot={revealSearchSlot}
            startRobotExtraSearch={startRobotExtraSearch}
            interaction={interaction}
            selectedSurvivorUid={selectedSurvivorUid}
            setSelectedSurvivorUid={setSelectedSurvivorUid}
            onRecruitClick={handleRecruitClick}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">생존자 수색</span>
        <span className={`text-[11px] rounded-full px-2 py-0.5 ${
          phase === 'party_maintenance' ? 'bg-sky-900/50 text-sky-300' : 'bg-gray-800 text-gray-500'
        } whitespace-nowrap`}>
          {phase === 'party_maintenance' ? '파티 정비 단계' : '행동 단계 대기'}
        </span>
        <span className="text-xs text-gray-600">교체 🥫 {RULES.mercenaryDiscardCanCost}</span>
      </div>

      {isMyTurn && phase === 'party_maintenance' && (
        <button onClick={endTurn} className="btn-secondary text-xs px-3 py-1 w-full mt-1">
          턴 종료 →
        </button>
      )}
    </div>
  )
}

function SearchTierRow({
  tier,
  survivors,
  deckCount,
  isLocked,
  player,
  canAct,
  revealedUids,

  revealCard,
  discardMercenary,
  revealSearchSlot,
  startRobotExtraSearch,
  interaction,
  selectedSurvivorUid,
  setSelectedSurvivorUid,
  onRecruitClick,
}) {
  const meta = getSearchTierMeta(tier)
  const paddedSurvivors = Array.from({ length: RULES.search.slotCountByTier?.[tier] ?? 4 }, (_, index) => survivors[index] ?? null)
  const canUseRobotExtraSearch = canAct &&
    !interaction &&
    !isLocked &&
    player?.leaderId === 'robot' &&
    deckCount >= 2

  return (
    <div className={`rounded-xl border px-2 py-2 ${isLocked ? 'border-gray-800/70 bg-gray-950/20 opacity-70' : `${meta.border} bg-gray-950/35`}`}>
      <div className="flex gap-1.5 items-stretch">
        <div className={`flex flex-col items-center justify-center w-24 h-60 rounded-lg border-2 gap-1 shrink-0 ${meta.deck}`}>
          <div className="text-2xl">🂠</div>
          <div className={`text-xs font-semibold ${meta.text}`}>{meta.label}</div>
          <div className="text-[10px] text-gray-400">{meta.subtitle}</div>
          <div className="mt-1 text-[10px] text-gray-500">{deckCount}장</div>
          {canUseRobotExtraSearch && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setSelectedSurvivorUid(null)
                startRobotExtraSearch(tier)
              }}
              className="mt-2 rounded border border-blue-500/60 bg-blue-950/70 px-1.5 py-1 text-[10px] font-black leading-tight text-blue-100 hover:border-amber-300"
            >
              HAL 능력:<br />추가 수색
            </button>
          )}
        </div>
        {paddedSurvivors.map((survivor, index) => {
          const canRevealEmpty = !isLocked && deckCount > 0
          if (!survivor) {
            return (
              <EmptySlot
                key={`${tier}-empty-${index}`}
                tier={tier}
                isLocked={isLocked}
                canAct={canAct}
                canReveal={canRevealEmpty}
                deckEmpty={deckCount <= 0}
                onReveal={() => { setSelectedSurvivorUid(null); revealSearchSlot(tier, index) }}
              />
            )
          }

          const isRevealed = revealedUids.includes(survivor.uid)
          const cost = getRecruitCostForPlayer(player, survivor)
          const affordable = (player?.resources?.bottleCap ?? 0) >= cost
          const canReveal = !isLocked
          const partyFull = getPartySlotCount(player?.party ?? []) >= (player?.maxPartySize ?? 5) && !canStackOnExistingSlot(player?.party ?? [], survivor)
          const restricted = !canRecruitSurvivorLocally(player, survivor)

          return isRevealed
            ? (
              <RevealedCard
                key={survivor.uid}
                survivor={survivor}
                cost={cost}
                canAct={canAct && !isLocked}
                affordable={affordable}
                partyFull={partyFull}
                restricted={restricted}
                canDiscard={(player?.resources?.can ?? 0) >= RULES.mercenaryDiscardCanCost}
                isSelected={selectedSurvivorUid === survivor.uid}
                onRecruit={() => onRecruitClick(survivor)}
                onDiscard={() => { setSelectedSurvivorUid(null); discardMercenary(survivor.uid) }}
              />
            ) : (
              <HiddenCard
                key={survivor.uid}
                tier={tier}
                isLocked={isLocked}
                canAct={canAct}
                canReveal={canReveal}
                onReveal={() => { setSelectedSurvivorUid(null); revealCard(survivor.uid) }}
              />
            )
        })}
      </div>
      {isLocked && <div className="mt-1 text-[11px] text-gray-500">이전 단계 단서를 확보해야 수색할 수 있습니다.</div>}
    </div>
  )
}

function RobotSearchModal({ interaction, player, onSelect, onCancel }) {
  const candidates = interaction.payload?.candidates ?? []
  const recruitFromDeck = interaction.payload?.mode === 'recruit_from_deck'
  const tier = interaction.payload?.tier
  const [selectedUid, setSelectedUid] = useState(null)

  function handleCandidateClick(survivor) {
    if (!survivor) return
    if (selectedUid === survivor.uid) {
      onSelect(survivor.uid)
    } else {
      setSelectedUid(survivor.uid)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="w-full max-w-[34rem] rounded-2xl border border-blue-400/70 bg-gray-950/95 p-4 shadow-2xl shadow-blue-950/60">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">HAL-4935</div>
            <h3 className="mt-1 text-xl font-black text-gray-50">행복수치 계산</h3>
            <p className="mt-1 text-sm leading-relaxed text-blue-100/75">
              {recruitFromDeck
                ? `${tier ?? ''}단계 덱에서 확인한 생존자 2장 중 1장을 선택해 즉시 영입합니다.`
                : '확인한 생존자 2장 중 수색 슬롯에 남길 1장을 선택합니다.'}
            </p>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            <div className="rounded-full border border-blue-500/40 bg-blue-950/50 px-3 py-1 text-xs font-bold text-blue-100">
              선택하지 않은 카드는 덱으로 복귀
            </div>
            <button
              onClick={onCancel}
              title="취소 — 모두 덱으로 반환"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-gray-400 hover:border-rose-500 hover:text-rose-300 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          {candidates.map((survivor) => (
            <RobotCandidateCard
              key={survivor.uid}
              survivor={survivor}
              player={player}
              recruitFromDeck={recruitFromDeck}
              isSelected={selectedUid === survivor.uid}
              onSelect={() => handleCandidateClick(survivor)}
            />
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs leading-relaxed text-gray-400">
          이 팝업은 HAL 능력 처리 중에만 표시됩니다. 후보를 고르면 영입 비용을 지불하고, 선택하지 않은 생존자는 다시 해당 단계 덱에 섞입니다.
        </div>
      </div>
    </div>
  )
}

function RobotCandidateCard({ survivor, player, recruitFromDeck, isSelected, onSelect }) {
  const cost = getRecruitCostForPlayer(player, survivor)
  const partyFull = getPartySlotCount(player?.party ?? []) >= (player?.maxPartySize ?? 5) &&
    !canStackOnExistingSlot(player?.party ?? [], survivor)
  const noMoney = (player?.resources?.bottleCap ?? 0) < cost
  const restricted = !canRecruitSurvivorLocally(player, survivor)
  const disabledReason = recruitFromDeck && partyFull
    ? '파티 슬롯 부족'
    : recruitFromDeck && noMoney
      ? '병뚜껑 부족'
      : recruitFromDeck && restricted
        ? '현재 파티와 합류 불가'
        : ''

  return (
    <SelectableSurvivorCard
      survivor={survivor}
      cost={cost}
      isSelected={isSelected}
      canSelect={!disabledReason}
      disabledReason={disabledReason}
      widthClass="w-44 shrink-0"
      onSelect={onSelect}
    />
  )
}

function EmptySlot({ tier, isLocked, canAct, canReveal, deckEmpty, onReveal }) {
  return (
    <div className="flex-1 h-60 rounded-lg border-2 border-dashed border-gray-800 bg-gray-950/60 flex flex-col items-center justify-center gap-2 min-w-0">
      <span className="text-xs text-gray-700">{tier ? `${tier}단계 빈 슬롯` : '빈 슬롯'}</span>
      {canAct && (
        <button
          onClick={onReveal}
          disabled={!canReveal}
          className="btn-secondary text-xs px-3 py-1 disabled:opacity-50"
        >
          {isLocked ? '단서 필요' : deckEmpty ? '덱 없음' : '수색'}
        </button>
      )}
    </div>
  )
}

function HiddenCard({ canAct, canReveal, isLocked, onReveal }) {
  return (
    <div className={`flex-1 h-60 rounded-lg border-2 border-dashed ${isLocked ? 'border-gray-800 opacity-50' : 'border-gray-600'} bg-gray-900 flex flex-col items-center justify-center gap-2 relative overflow-hidden min-w-0`}>
      {/* 카드 뒷면 패턴 */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #555 0, #555 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }}
      />
      <span className="text-4xl">🃏</span>
      <span className="text-xs text-gray-500">미확인 생존자</span>

      {canAct && (
        <button
          onClick={onReveal}
          disabled={!canReveal}
          className="btn-secondary text-xs px-3 py-1 mt-1 z-10"
        >
          {isLocked ? '단서 필요' : '확인하기'}
        </button>
      )}
    </div>
  )
}

function RevealedCard({ survivor, cost, canAct, affordable, partyFull, restricted, canDiscard, isSelected, onRecruit, onDiscard }) {
  const disabledReason = !canAct
    ? ''
    : partyFull
      ? '파티 슬롯이 가득 찼습니다.'
      : !affordable
        ? '병뚜껑이 부족합니다.'
        : restricted
          ? '현재 파티와 합류할 수 없습니다.'
          : ''

  return (
    <SelectableSurvivorCard
      survivor={survivor}
      cost={cost}
      isSelected={isSelected}
      canSelect={canAct && !disabledReason}
      disabledReason={disabledReason}
      widthClass="flex-1 min-w-0"
      onSelect={onRecruit}
      showTooltip
      topRightAction={canAct && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDiscard() }}
          disabled={!canDiscard}
          title={`덱으로 돌려넣고 교체 (🥫-${RULES.mercenaryDiscardCanCost})`}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-700 bg-gray-950/85 text-[13px] font-black leading-none text-gray-400 shadow-sm hover:border-rose-500 hover:text-rose-300 disabled:opacity-30"
        >
          ×
        </button>
      )}
    />
  )
}

function SelectableSurvivorCard({
  survivor,
  cost,
  isSelected,
  canSelect,
  disabledReason = '',
  widthClass = 'flex-1 min-w-0',
  onSelect,
  topRightAction = null,
  showTooltip = false,
}) {
  const typeColor = TYPE_COLOR[survivor.type] ?? 'border-gray-600 bg-gray-800'
  const typeBg = TYPE_BG[survivor.type] ?? 'bg-gray-800'
  const typeBadge = TYPE_BADGE[survivor.type] ?? 'bg-gray-700 text-gray-300'
  const visuallyDisabled = Boolean(disabledReason)

  return (
    <div
      onClick={(event) => {
        event.stopPropagation()
        if (canSelect) onSelect()
      }}
      title={disabledReason || (canSelect ? (isSelected ? '한 번 더 눌러 영입' : '클릭해서 선택') : '')}
      className={`${widthClass} h-60 flex flex-col text-xs relative group overflow-hidden rounded-[1.15rem] border-2 p-2.5 transition-all ${
        isSelected ? `border-amber-400 ${typeBg} brightness-110` : typeColor
      } ${
        visuallyDisabled
          ? 'cursor-not-allowed opacity-45 grayscale'
          : canSelect
            ? 'cursor-pointer hover:brightness-110'
            : ''
      }`}
    >
      {isSelected && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-amber-500/90 text-center text-[10px] font-black text-gray-950 py-0.5 tracking-wide">
          한 번 더 눌러 영입
        </div>
      )}
      {topRightAction && (
        <div className="absolute right-1.5 top-1.5 z-10">
          {topRightAction}
        </div>
      )}

      <div className="absolute left-2 top-1 text-2xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
        {survivor.score ?? 0}
      </div>

      <div className="px-0.5 pt-7">
        <div className="flex h-14 items-center justify-center rounded-[0.8rem] bg-black/15">
          <div className="text-4xl drop-shadow-[0_3px_0_rgba(0,0,0,0.22)]">{survivor.emoji}</div>
        </div>
        <div className="mt-2 text-center">
          <div className="text-[0.95rem] font-semibold uppercase tracking-[0.05em] leading-tight text-gray-50 line-clamp-2">
            {survivor.name}
          </div>
        </div>
      </div>

      {survivor.effect && (
        <div className="mt-2 text-[11px] leading-snug text-gray-200 line-clamp-4">
          {survivor.effect}
        </div>
      )}

      {survivor.description && (
        <div className="mt-1 text-[9px] leading-snug text-gray-400 line-clamp-3">
          {survivor.description}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] leading-none ${typeBadge}`}>
          {survivor.type}
        </span>
        <span className="text-base font-black leading-none text-amber-300">
          🪙{cost}
        </span>
      </div>

      {disabledReason && (
        <div className="absolute inset-x-2 bottom-7 z-20 rounded bg-gray-950/90 px-2 py-1 text-center text-[10px] font-black text-gray-400">
          {disabledReason}
        </div>
      )}

      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-1 z-20 hidden group-hover:block w-52 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-300 shadow-lg">
          {survivor.description}
          {survivor.specialBonus && (
            <div className="text-green-400 mt-1">✨ {survivor.specialBonus}</div>
          )}
        </div>
      )}
    </div>
  )
}
