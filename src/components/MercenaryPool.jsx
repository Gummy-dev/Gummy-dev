import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../store/gameStore.js'
import { RULES } from '../data/rules.js'
import CardBack from './CardBack.jsx'
import SurvivorCardFace from './SurvivorCardFace.jsx'
import { Token } from '../tabletop/Token.jsx'

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

function isPlainSurvivor(survivor) {
  const normalizedName = String(survivor?.name ?? '').replace(/\s/g, '')
  return survivor?.id?.startsWith('s_plain_') || normalizedName === '평범생존자' || survivor?.type === '평범'
}

function canRecruitSurvivorLocally(player, survivor) {
  if (!survivor) return false
  if (!isPlainSurvivor(survivor)) return true
  return !(player?.party ?? []).some((entry) => entry.id === 's_military_2')
}

function getRecruitCostForPlayer(player, survivor) {
  const baseCost = survivor?.recruitCost ?? 0
  const moodGirlDiscount = (player?.party ?? []).some((entry) => entry.id === 's_mood_1') ? 1 : 0
  return Math.max(0, baseCost - moodGirlDiscount)
}

function getRecruitCostResourceForPlayer(player, preferredResource = null) {
  if (player?.leaderId !== 'shy') return 'bottleCap'
  return preferredResource === 'can' ? 'can' : 'bottleCap'
}

function canPayRecruitCost(player, survivor, resource) {
  const cost = getRecruitCostForPlayer(player, survivor)
  return (player?.resources?.[resource] ?? 0) >= cost
}

function getSearchDiscardCostForPlayer(player) {
  const centerLimit = player?.leaderId === 'idol' ? 3 : 2
  const moodMakerDiscount = (player?.party ?? []).some((entry, index) => (
    index >= 2 && index <= centerLimit && entry.type === '분위기메이커'
  )) ? 1 : 0
  return Math.max(0, RULES.mercenaryDiscardCanCost - moodMakerDiscount)
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

export default function MercenaryPool({ isMyTurn, tier: onlyTier, actionsTarget }) {
  const {
    mercenaryPool,
    searchState,
    returnedMercenary,
    players,
    currentPlayerIndex,
    localPlayerIndex = 0,
    recruitReturnedSurvivor,
    recruitSurvivor,
    reserveIdolFan,
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
  const player = players[localPlayerIndex] ?? players[currentPlayerIndex]
  const canAct = isMyTurn && phase === 'party_maintenance' && !interaction
  const canLocalResolveInteraction = currentPlayerIndex === localPlayerIndex && !player?.isBot
  const sharedDeparted = getSharedDepartedSurvivors(players, departedSurvivors)
  const returnedAvailable = returnedMercenary?.availableToPlayerIndex === localPlayerIndex
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
  const searchDiscardCost = getSearchDiscardCostForPlayer(player)
  const [selectedSurvivorUid, setSelectedSurvivorUid] = useState(null)
  const [selectedPaymentResource, setSelectedPaymentResource] = useState('bottleCap')
  const [inspected, setInspected] = useState(null)

  function clearSelectedSurvivor() {
    setSelectedSurvivorUid(null)
    setSelectedPaymentResource('bottleCap')
  }

  function getDefaultPaymentResource(survivor) {
    if (player?.leaderId !== 'shy') return 'bottleCap'
    if (canPayRecruitCost(player, survivor, 'bottleCap')) return 'bottleCap'
    if (canPayRecruitCost(player, survivor, 'can')) return 'can'
    return 'bottleCap'
  }

  function handleRecruitClick(survivor) {
    if (!survivor) return
    setSelectedSurvivorUid(survivor.uid)
    setSelectedPaymentResource(getDefaultPaymentResource(survivor))
  }

  function confirmRecruit(survivor) {
    recruitSurvivor(survivor.uid, selectedPaymentResource)
    clearSelectedSurvivor()
  }

  function handleReserveFanClick(survivor) {
    if (!survivor) return
    reserveIdolFan(survivor.uid)
    clearSelectedSurvivor()
  }

  const showAuxiliary = !onlyTier || onlyTier === 1
  const endTurnControl = isMyTurn && phase === 'party_maintenance' && !interaction && <button onClick={endTurn} className="btn-secondary text-xs px-3 py-1 w-full mt-1">턴 종료 →</button>
  return <div className="w-fit max-w-full restored-search-pool" onClick={clearSelectedSurvivor}>
    {showAuxiliary && canLocalResolveInteraction && interaction?.kind === 'leader_skill_robot_search' && createPortal(<RobotSearchModal interaction={interaction} player={player} onSelect={selectLeaderSearchCandidate} onCancel={cancelRobotSearch} />, document.body)}
    <div className="grid w-fit max-w-full grid-cols-1 justify-items-start gap-3 mb-3">
      {(onlyTier ? [onlyTier] : [3, 2, 1]).map(tier => <SearchTierRow key={tier} tier={tier}
        actionsTarget={actionsTarget} onInspect={setInspected}
        survivors={visibleByTier[tier] ?? []} deckCount={deckCountsByTier[tier]} isLocked={tier > accessibleTier}
        player={player} canAct={canAct} revealedUids={revealedUids} revealCard={revealCard} discardMercenary={discardMercenary}
        revealSearchSlot={revealSearchSlot} startRobotExtraSearch={startRobotExtraSearch} interaction={interaction}
        selectedSurvivorUid={selectedSurvivorUid} selectedPaymentResource={selectedPaymentResource}
        setSelectedPaymentResource={setSelectedPaymentResource} setSelectedSurvivorUid={setSelectedSurvivorUid}
        clearSelectedSurvivor={clearSelectedSurvivor} onRecruitClick={handleRecruitClick} onRecruitConfirm={confirmRecruit} onReserveFanClick={handleReserveFanClick} />)}
    </div>
    <div className="text-xs text-gray-500">생존자 수색 · {phase === 'party_maintenance' ? '파티 정비 단계' : '행동 단계 대기'} · 교체 🥫 {searchDiscardCost}</div>
        {showAuxiliary && returnedMercenary && (
          <div className="max-w-sm">
            <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-emerald-300">되돌려진 생존자</div>
                  <div className="text-[11px] text-emerald-100/70">
                    {players[returnedMercenary.fromPlayerIndex]?.name}가 되돌림
                  </div>
                </div>
              </div>
              <SurvivorCardFace survivor={returnedMercenary.survivor} />
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
          </div>
        )}
    {showAuxiliary && <>
      <div className="mt-1 flex w-full items-center justify-start gap-2 rounded-md border border-gray-800 bg-gray-950/35 px-2 py-1.5 text-left">
        <div className="shrink-0 text-[10px] font-semibold text-gray-500">떠난 생존자</div>
        <div className="shrink-0 text-[10px] text-gray-600">{sharedDeparted.length}장</div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-1">
          {sharedDeparted.length === 0 && <span className="text-[10px] text-gray-700">아직 없음</span>}
          {sharedDeparted.map((sv) => {
            const selectable = isDepartedSelectable && (!isVetRevive || isAnimalSurvivor(sv))
            return (
              <button
                key={sv.uid}
                onClick={() => selectable ? selectGraveSurvivor(sv.uid) : setInspected(sv)}
                title={sv.name}
                className={`text-[15px] leading-none transition-all ${
                  selectable
                    ? 'cursor-pointer hover:scale-125 ring-1 ring-violet-400 rounded'
                    : 'cursor-pointer'
                }`}
              >
                {sv.emoji} {sv.name}
              </button>
            )
          })}
        </div>
      </div>
      {inspected && createPortal(<div className="survivor-inspect-backdrop" onClick={() => setInspected(null)}><div className="survivor-inspect" role="dialog" aria-modal="true" aria-label={`${inspected.name} 카드 정보`} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setInspected(null) }}><SurvivorCardFace survivor={inspected} /><button type="button" autoFocus onClick={() => setInspected(null)}>닫기</button></div></div>, document.body)}
      {actionsTarget ? createPortal(endTurnControl, actionsTarget) : endTurnControl}
    </>}
  </div>
}

function SearchTierRow({
  actionsTarget,
  onInspect,
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
  selectedPaymentResource,
  setSelectedPaymentResource,
  setSelectedSurvivorUid,
  clearSelectedSurvivor,
  onRecruitClick,
  onRecruitConfirm,
  onReserveFanClick,
}) {
  const meta = getSearchTierMeta(tier)
  const clearSelection = clearSelectedSurvivor ?? (() => setSelectedSurvivorUid(null))
  const paddedSurvivors = Array.from({ length: RULES.search.slotCountByTier?.[tier] ?? 1 }, (_, index) => survivors[index] ?? null)
  const discardCost = getSearchDiscardCostForPlayer(player)
  const canUseRobotExtraSearch = canAct &&
    !interaction &&
    !isLocked &&
    player?.leaderId === 'robot' &&
    deckCount >= 2

  return (
    <div className="restored-search-tier survivor-search-row">
      <div className="flex gap-1.5 items-start">
        <div className="shrink-0"><CardBack tier={tier} kind="생존자 수색" title={meta.label} subtitle={meta.subtitle} count={deckCount} pile />
          {canUseRobotExtraSearch && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                clearSelection()
                startRobotExtraSearch(tier)
              }}
              className="mt-2 rounded border border-blue-500/60 bg-blue-950/70 px-1.5 py-1 text-[10px] font-black leading-tight text-blue-100 hover:border-amber-300"
            >
              HAL 능력:<br />2장 확인
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
                onReveal={() => { clearSelection(); revealSearchSlot(tier, index) }}
              />
            )
          }

          const isRevealed = revealedUids.includes(survivor.uid)
          const cost = getRecruitCostForPlayer(player, survivor)
          const canChooseCanPayment = player?.leaderId === 'shy'
          const selectedForThisCard = selectedSurvivorUid === survivor.uid
          const costResource = canChooseCanPayment && selectedForThisCard
            ? getRecruitCostResourceForPlayer(player, selectedPaymentResource)
            : getRecruitCostResourceForPlayer(player)
          const canReserveFanclub = player?.leaderId === 'idol' && (player?.leaderFans?.length ?? 0) < 3
          const affordable = canChooseCanPayment
            ? canPayRecruitCost(player, survivor, 'bottleCap') || canPayRecruitCost(player, survivor, 'can')
            : (player?.resources?.[costResource] ?? 0) >= cost
          const canReveal = !isLocked
          const partyFull = getPartySlotCount(player?.party ?? []) >= (player?.maxPartySize ?? 5) && !canStackOnExistingSlot(player?.party ?? [], survivor)
          const restricted = !canRecruitSurvivorLocally(player, survivor)

          return isRevealed
            ? (
              <RevealedCard
                actionsTarget={actionsTarget}
                onInspect={onInspect}
                key={survivor.uid}
                survivor={survivor}
                cost={cost}
                costResource={costResource}
                canAct={canAct && !isLocked}
                affordable={affordable}
                partyFull={partyFull}
                restricted={restricted}
                discardCost={discardCost}
                canDiscard={(player?.resources?.can ?? 0) >= discardCost}
                isSelected={selectedForThisCard}
                canChooseCanPayment={canChooseCanPayment}
                paymentResource={costResource}
                canPayBottleCap={canPayRecruitCost(player, survivor, 'bottleCap')}
                canPayCan={canPayRecruitCost(player, survivor, 'can')}
                onPaymentResourceChange={setSelectedPaymentResource}
                onRecruit={() => onRecruitClick(survivor)}
                onConfirm={() => onRecruitConfirm(survivor)}
                canReserveFanclub={canReserveFanclub}
                onReserveFan={() => onReserveFanClick?.(survivor)}
                onDiscard={() => { clearSelection(); discardMercenary(survivor.uid) }}
              />
            ) : (
              <HiddenCard
                key={survivor.uid}
                tier={tier}
                isLocked={isLocked}
                canAct={canAct}
                canReveal={canReveal}
                onReveal={() => { clearSelection(); revealCard(survivor.uid) }}
              />
            )
        })}
      </div>

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
    setSelectedUid(survivor.uid)
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-label="HAL 생존자 선택"
      onKeyDown={event => { if (event.key === 'Escape') onCancel() }}
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
              onConfirm={() => onSelect(survivor.uid)}
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

function RobotCandidateCard({ survivor, player, recruitFromDeck, isSelected, onSelect, onConfirm }) {
  const cost = getRecruitCostForPlayer(player, survivor)
  const costResource = getRecruitCostResourceForPlayer(player)
  const partyFull = getPartySlotCount(player?.party ?? []) >= (player?.maxPartySize ?? 5) &&
    !canStackOnExistingSlot(player?.party ?? [], survivor)
  const noMoney = (player?.resources?.[costResource] ?? 0) < cost
  const restricted = !canRecruitSurvivorLocally(player, survivor)
  const disabledReason = recruitFromDeck && partyFull
    ? '파티 슬롯 부족'
    : recruitFromDeck && noMoney
      ? (costResource === 'can' ? '통조림 부족' : '병뚜껑 부족')
      : recruitFromDeck && restricted
        ? '현재 파티와 합류 불가'
        : ''

  return (
    <SelectableSurvivorCard
      survivor={survivor}
      cost={cost}
      costResource={costResource}
      isSelected={isSelected}
      canSelect={!disabledReason}
      disabledReason={disabledReason}
            onSelect={onSelect}
      onConfirm={onConfirm}
      confirmLabel={recruitFromDeck ? '영입 확인' : '수색 슬롯에 놓기'}
    />
  )
}

function EmptySlot({ tier, isLocked, canAct, canReveal, deckEmpty, onReveal }) {
  if (isLocked) return <CardBack tier={tier} kind="생존자 수색" title="미확인 생존자" />
  return <div className="survivor-search-card">
    <div data-board-card className="printed-empty-slot"><span>{tier}단계 수색 자리</span><small>{isLocked ? '단서 필요' : deckEmpty ? '덱 없음' : '생존자를 수색하세요'}</small></div>
    {canAct && <div className="survivor-card-controls"><button type="button" onClick={onReveal} disabled={!canReveal}>{isLocked ? '단서 필요' : deckEmpty ? '덱 없음' : '수색'}</button></div>}
  </div>
}

function HiddenCard({ tier, canAct, canReveal, isLocked, onReveal }) {
  if (isLocked) return <CardBack tier={tier} kind="생존자 수색" title="미확인 생존자" />
  return <div className="survivor-search-card">
    <div data-board-card className="card-stack"><div className="stack-card"><span className="deck-emblem">🂠</span><strong>미확인 생존자</strong></div></div>
    {canAct && <div className="survivor-card-controls"><button type="button" onClick={onReveal} disabled={!canReveal}>{isLocked ? '단서 필요' : '확인하기'}</button></div>}
  </div>
}

function RevealedCard({ actionsTarget, onInspect, survivor, cost, costResource = 'bottleCap', discardCost, canAct, affordable, partyFull, restricted, canDiscard, isSelected, canChooseCanPayment = false, paymentResource = 'bottleCap', canPayBottleCap = false, canPayCan = false, onPaymentResourceChange, onRecruit, onConfirm, canReserveFanclub = false, onReserveFan, onDiscard }) {
  const disabledReason = !canAct
    ? ''
    : partyFull
      ? '파티 슬롯이 가득 찼습니다.'
      : !affordable
        ? (costResource === 'can' ? '통조림이 부족합니다.' : '병뚜껑이 부족합니다.')
        : restricted
          ? '현재 파티와 합류할 수 없습니다.'
          : ''
  const canSelectForAction = canAct && (!disabledReason || canReserveFanclub)

  return (
    <SelectableSurvivorCard
      actionsTarget={actionsTarget}
      onInspect={onInspect}
      survivor={survivor}
      cost={cost}
      costResource={costResource}
      isSelected={isSelected}
      canChooseCanPayment={canChooseCanPayment}
      paymentResource={paymentResource}
      canPayBottleCap={canPayBottleCap}
      canPayCan={canPayCan}
      onPaymentResourceChange={onPaymentResourceChange}
      canReserveFanclub={canReserveFanclub}
      onReserveFan={onReserveFan}
      canSelect={canSelectForAction}
      disabledReason={disabledReason}
      onSelect={onRecruit}
      onConfirm={onConfirm}
      topRightAction={canAct && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDiscard() }}
          disabled={!canDiscard}
          title={`덱으로 돌려넣고 교체 (🥫-${discardCost})`}
          className="text-xs"
        >
          교체 🥫{discardCost}
        </button>
      )}
    />
  )
}

function SelectableSurvivorCard({ actionsTarget, onInspect, survivor, cost, costResource = 'bottleCap', isSelected,
  canChooseCanPayment = false, paymentResource = 'bottleCap', canPayBottleCap = false, canPayCan = false,
  onPaymentResourceChange, canReserveFanclub = false, onReserveFan, canSelect, disabledReason = '',
  onSelect, onConfirm, confirmLabel = '영입 확인', topRightAction = null,
}) {
  const actions = <div className={`survivor-card-controls ${actionsTarget ? 'restored-recruit-actions' : ''}`}>
    {actionsTarget && <strong>{survivor.name} 영입</strong>}
    {canChooseCanPayment && <><button type="button" disabled={!canPayBottleCap} aria-pressed={paymentResource === 'bottleCap'} onClick={() => onPaymentResourceChange?.('bottleCap')}>병뚜껑으로 지불</button><button type="button" disabled={!canPayCan} aria-pressed={paymentResource === 'can'} onClick={() => onPaymentResourceChange?.('can')}>통조림으로 지불</button></>}
    <button type="button" className={actionsTarget ? 'btn-primary' : ''} disabled={Boolean(disabledReason)} onClick={onConfirm}>{confirmLabel} <Token kind={costResource === 'can' ? 'can' : 'cap'} value={cost} label={false} small /></button>
    {canReserveFanclub && <button type="button" onClick={onReserveFan}>예비 팬클럽에 킵</button>}
  </div>
  return <div className="survivor-search-card" onClick={event => event.stopPropagation()}>
    <button type="button" className="survivor-card-button" aria-label={`${survivor.name} 선택`} aria-pressed={Boolean(isSelected)} aria-disabled={!canSelect}
      onClick={() => canSelect && onSelect()} title={disabledReason || '카드 선택 후 영입 확인'}>
      <SurvivorCardFace survivor={survivor} />
    </button>
    {disabledReason && <div className="survivor-slot-note">{disabledReason}</div>}
    {onInspect && <div className="survivor-card-controls"><button type="button" onClick={() => onInspect(survivor)}>카드 크게 보기</button></div>}
    {isSelected && (actionsTarget ? createPortal(actions, actionsTarget) : actions)}
    {topRightAction && <div className="survivor-card-controls">{topRightAction}</div>}
  </div>
}
