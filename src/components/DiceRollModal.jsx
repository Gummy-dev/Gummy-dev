import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore.js'

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

const CATEGORY_COLOR = {
  clue: 'border-yellow-500 bg-yellow-950/40',
  dice: 'border-violet-600 bg-violet-950/40',
}

export default function DiceRollModal({ isMyTurn = false, myIndex = 0 }) {
  const { diceRollModal, confirmDiceRoll } = useGameStore()
  const [phase, setPhase] = useState('idle') // idle | rolling | settled
  const [displayRolls, setDisplayRolls] = useState([1, 1])
  const [finalRolls, setFinalRolls] = useState(null)
  const intervalRef = useRef(null)

  // 모달이 새로 열릴 때마다 초기화
  useEffect(() => {
    if (diceRollModal) {
      setPhase('idle')
      setDisplayRolls(Array(diceRollModal.event.resolution.diceCount ?? 1).fill(1))
      setFinalRolls(null)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [diceRollModal?.slotIndex, diceRollModal?.event?.id])

  if (!diceRollModal) return null
  if (!isMyTurn || diceRollModal.playerIndex !== myIndex) return null

  const { event, partyScore = 0, recommendedBonus = 0, bonusLabel = '추천' } = diceRollModal
  const resolution = event.resolution
  const diceCount = resolution.diceCount ?? 1
  const borderClass = CATEGORY_COLOR[event.category] ?? 'border-violet-600 bg-violet-950/40'

  const rollSum = finalRolls ? finalRolls.reduce((a, b) => a + b, 0) : 0
  const total = rollSum + partyScore
  const success = phase === 'settled' && total >= resolution.target

  function handleRoll() {
    const final = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6))
    setFinalRolls(final)
    setPhase('rolling')

    let elapsed = 0
    intervalRef.current = setInterval(() => {
      setDisplayRolls(Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6)))
      elapsed += 80
      if (elapsed >= 1400) {
        clearInterval(intervalRef.current)
        setDisplayRolls(final)
        setPhase('settled')
      }
    }, 80)
  }

  function handleConfirm() {
    confirmDiceRoll(finalRolls)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className={`relative w-full max-w-sm rounded-2xl border-2 p-6 flex flex-col gap-5 shadow-2xl ${borderClass}`}>

        {/* 헤더 */}
        <div className="text-center">
          <div className="text-4xl mb-2">{event.emoji}</div>
          <div className="text-lg font-bold text-gray-100 leading-tight">{event.name}</div>
          <div className="text-xs text-gray-400 mt-1">{event.description}</div>
        </div>

        {/* 조건 정보 */}
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          <div className="rounded-lg bg-black/30 px-3 py-1.5 text-center">
            <div className="text-gray-500 leading-tight">달성 목표</div>
            <div className="text-violet-300 font-bold text-base">{resolution.target}+</div>
          </div>
          <div className="rounded-lg bg-black/30 px-3 py-1.5 text-center">
            <div className="text-gray-500 leading-tight">주사위</div>
            <div className="text-white font-bold text-base">{diceCount}개</div>
          </div>
          <div className="rounded-lg bg-sky-900/50 border border-sky-700 px-3 py-1.5 text-center">
            <div className="text-sky-400 leading-tight">{bonusLabel} 보너스</div>
            <div className="text-sky-300 font-bold text-base">+{partyScore}</div>
          </div>
        </div>

        {/* 주사위 */}
        <div className="flex justify-center gap-5">
          {Array.from({ length: diceCount }).map((_, i) => (
            <div
              key={i}
              className={`text-7xl leading-none select-none transition-transform duration-75 ${
                phase === 'rolling' ? 'scale-110 drop-shadow-[0_0_12px_rgba(167,139,250,0.8)]' :
                phase === 'settled' ? 'scale-100' : 'opacity-40'
              }`}
            >
              {DICE_FACES[(displayRolls[i] ?? 1) - 1]}
            </div>
          ))}
        </div>

        {/* 결과 */}
        {phase === 'settled' && (
          <div className={`rounded-xl px-4 py-3 text-center border ${
            success
              ? 'bg-emerald-950/70 border-emerald-500'
              : 'bg-rose-950/70 border-rose-600'
          }`}>
            <div className="text-sm text-gray-300">
              🎲 {finalRolls.join(' + ')}
              <span className="text-sky-300"> + {partyScore} ({bonusLabel})</span>
              {' = '}
              <span className="font-bold text-white text-lg">{total}</span>
            </div>
            <div className={`text-xl font-bold mt-1 ${success ? 'text-emerald-300' : 'text-rose-300'}`}>
              {success ? '✅ 성공!' : '❌ 실패'}
            </div>
            {success && event.reward && (
              <div className="text-xs text-emerald-400 mt-1">
                보상 획득!
              </div>
            )}
            {!success && event.failPenalty && (
              <div className="text-xs text-rose-400 mt-1">
                {event.failPenalty.type === 'remove_random' ? '생존자 1명 무작위 이탈' : `통조림 -${event.failPenalty.amount}`}
              </div>
            )}
          </div>
        )}

        {/* 버튼 */}
        {phase === 'idle' && (
          <button
            onClick={handleRoll}
            className="py-3 rounded-xl border-2 border-violet-500 bg-violet-800 hover:bg-violet-700 text-white font-bold text-sm tracking-wide transition-colors"
          >
            🎲 주사위 굴리기
          </button>
        )}

        {phase === 'rolling' && (
          <div className="text-center text-violet-300 text-sm font-semibold animate-pulse py-3">
            굴리는 중...
          </div>
        )}

        {phase === 'settled' && (
          <button
            onClick={handleConfirm}
            className={`py-3 rounded-xl border-2 font-bold text-sm tracking-wide transition-colors ${
              success
                ? 'border-emerald-500 bg-emerald-800 hover:bg-emerald-700 text-white'
                : 'border-rose-600 bg-rose-900 hover:bg-rose-800 text-red-200'
            }`}
          >
            확인
          </button>
        )}
      </div>
    </div>
  )
}
