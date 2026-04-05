import { useGameStore } from '../store/gameStore.js'
import { RULES } from '../data/rules.js'

const TYPE_BADGE = {
  군기반장: 'bg-blue-800 text-blue-200',
  분위기메이커: 'bg-pink-800 text-pink-200',
  돌격대장: 'bg-green-800 text-green-200',
  '4차원': 'bg-yellow-800 text-yellow-200',
  겁쟁이: 'bg-purple-800 text-purple-200',
  평범: 'bg-gray-700 text-gray-300',
}

export default function MercenaryPool({ isMyTurn }) {
  const {
    mercenaryPool,
    players,
    currentPlayerIndex,
    recruitSurvivor,
    discardMercenary,
    revealCard,
    revealedUids,
    phase,
    exchangeCapToCan,
    exchangeCanToCap,
  } = useGameStore()
  const player = players[currentPlayerIndex]
  const canAct = isMyTurn && phase === 'purchase'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-400">
            용병소 <span className="text-gray-600">({mercenaryPool.length}명 대기)</span>
          </h3>
          <div className="text-xs text-gray-600 mt-1">
            {phase === 'purchase' ? '구매 단계에서 확인/영입할 수 있습니다.' : '행동 단계를 마치면 구매 단계가 열립니다.'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exchangeCapToCan} disabled={!canAct} className="btn-secondary text-xs px-3 py-1 disabled:opacity-50">
            🪙 1 → 🥫 {RULES.capToCanRate}
          </button>
          <button onClick={exchangeCanToCap} disabled={!canAct} className="btn-secondary text-xs px-3 py-1 disabled:opacity-50">
            🥫 {RULES.canToCapRate} → 🪙 1
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-600 mb-2">
        카드 확인: 🪙 {RULES.revealCost} · 오픈 생존자 교체: 🥫 {RULES.mercenaryDiscardCanCost}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {mercenaryPool.map((survivor, index) => {
          if (!survivor) {
            return <EmptySlot key={`empty-slot-${index}`} />
          }

          const isRevealed = revealedUids.includes(survivor.uid)
          const cost = survivor.recruitCost ?? 0
          const affordable = (player?.resources?.bottleCap ?? 0) >= cost
          const canReveal = (player?.resources?.bottleCap ?? 0) >= RULES.revealCost
          const partyFull = (player?.party?.length ?? 0) >= (player?.maxPartySize ?? 5)

          return isRevealed
            ? (
              <RevealedCard
                key={survivor.uid}
                survivor={survivor}
                canAct={canAct}
                affordable={affordable}
                partyFull={partyFull}
                canDiscard={(player?.resources?.can ?? 0) >= RULES.mercenaryDiscardCanCost}
                onRecruit={() => recruitSurvivor(survivor.uid)}
                onDiscard={() => discardMercenary(survivor.uid)}
              />
            ) : (
              <HiddenCard
                key={survivor.uid}
                canAct={canAct}
                canReveal={canReveal}
                onReveal={() => revealCard(survivor.uid)}
              />
            )
        })}
      </div>
    </div>
  )
}

function EmptySlot() {
  return (
    <div className="w-full h-44 rounded-lg border-2 border-dashed border-gray-800 bg-gray-950/60 flex items-center justify-center min-w-0">
      <span className="text-xs text-gray-700">빈 슬롯</span>
    </div>
  )
}

function HiddenCard({ canAct, canReveal, onReveal }) {
  return (
    <div className="w-full h-44 rounded-lg border-2 border-dashed border-gray-600 bg-gray-900 flex flex-col items-center justify-center gap-2 relative overflow-hidden min-w-0">
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
          {canReveal ? `🪙 ${RULES.revealCost} 확인하기` : '병뚜껑 부족'}
        </button>
      )}
    </div>
  )
}

function RevealedCard({ survivor, canAct, affordable, partyFull, canDiscard, onRecruit, onDiscard }) {
  return (
    <div className="card w-full flex flex-col gap-1 text-xs relative group border-amber-700/50 min-w-0">
      {/* 공개 표시 */}
      <div className="absolute top-1 right-1 text-xs text-amber-500">✓ 확인됨</div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xl">{survivor.emoji}</span>
        <div>
          <div className="font-semibold text-gray-200 leading-tight pr-6">{survivor.name}</div>
          <span className={`text-xs rounded-full px-1.5 py-0.5 ${TYPE_BADGE[survivor.type]}`}>
            {survivor.type}
          </span>
        </div>
      </div>

      <div className="text-gray-400 text-xs leading-tight">{survivor.effect}</div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-amber-400">🪙 {survivor.recruitCost ?? 0}</span>
        <span className="text-gray-500">점수 +{survivor.score}</span>
      </div>

      {canAct && (
        <div className="mt-1 grid grid-cols-1 gap-1">
          <button
            onClick={onRecruit}
            disabled={!affordable || partyFull}
            className="btn-primary w-full text-xs py-1"
          >
            {partyFull ? '파티 풀' : !affordable ? '병뚜껑 부족' : '영입'}
          </button>
          <button
            onClick={onDiscard}
            disabled={!canDiscard}
            className="btn-secondary w-full text-xs py-1 disabled:opacity-50"
          >
            🥫 1로 교체
          </button>
        </div>
      )}

      {/* 툴팁 */}
      <div className="absolute left-0 bottom-full mb-1 z-20 hidden group-hover:block w-52 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-300 shadow-lg">
        {survivor.description}
        {survivor.specialBonus && (
          <div className="text-green-400 mt-1">✨ {survivor.specialBonus}</div>
        )}
      </div>
    </div>
  )
}
