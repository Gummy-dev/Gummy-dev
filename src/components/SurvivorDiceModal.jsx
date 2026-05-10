import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore.js'

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

export default function SurvivorDiceModal() {
  const { survivorDiceQueue, confirmSurvivorDice } = useGameStore()
  const current = survivorDiceQueue[0]

  const [phase, setPhase] = useState('idle') // idle | rolling | settled
  const [displayRolls, setDisplayRolls] = useState([1])
  const intervalRef = useRef(null)

  // 항목이 바뀔 때마다 초기화
  useEffect(() => {
    if (current) {
      setPhase('idle')
      setDisplayRolls(Array(current.rolls?.length ?? 1).fill(1))
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [current?.icon, current?.name, current?.rolls?.join(',')])

  if (!current) return null

  const { icon, name, rolls, successOn, diceValue, success, outcomeLabel, detail, extraRoll } = current
  const finalRolls = rolls ?? [1]

  function handleRoll() {
    setPhase('rolling')
    let elapsed = 0
    intervalRef.current = setInterval(() => {
      setDisplayRolls(Array.from({ length: finalRolls.length }, () => Math.ceil(Math.random() * 6)))
      elapsed += 80
      if (elapsed >= 1200) {
        clearInterval(intervalRef.current)
        setDisplayRolls(finalRolls)
        setPhase('settled')
      }
    }, 80)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className={`relative w-full max-w-sm rounded-2xl border-2 p-6 flex flex-col gap-4 shadow-2xl ${
        success
          ? 'border-emerald-500 bg-emerald-950/60'
          : 'border-rose-600 bg-rose-950/60'
      }`}>

        {/* 생존자 정보 */}
        <div className="text-center">
          <div className="text-4xl mb-1">{icon}</div>
          <div className="text-base font-bold text-gray-100">{name}</div>
          {detail && <div className="text-xs text-gray-400 mt-0.5">{detail}</div>}
        </div>

        {/* 주사위 */}
        <div className="flex justify-center gap-4">
          {Array.from({ length: finalRolls.length }).map((_, i) => (
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

        {/* 판정 기준 표시 */}
        {phase !== 'idle' && (
          <div className="text-center text-sm text-gray-300">
            {successOn !== null
              ? `🎲 ${finalRolls.join(' + ')} (${successOn}이하 성공)`
              : diceValue !== null
              ? `🎲 ${finalRolls.join(' + ')} (${diceValue}이면 내 파티 피해)`
              : `🎲 ${finalRolls.join(' + ')}`}
          </div>
        )}

        {/* 추가 주사위 (개 생존자 희생 판정 등) */}
        {phase === 'settled' && extraRoll && (
          <div className={`text-xs text-center rounded-lg px-3 py-2 ${
            extraRoll.success ? 'bg-rose-900/60 text-rose-300' : 'bg-gray-800/60 text-gray-400'
          }`}>
            {extraRoll.label}: 🎲{extraRoll.roll} ({extraRoll.successOn}이하) → {extraRoll.success ? '해당됨' : '해당 없음'}
          </div>
        )}

        {/* 결과 */}
        {phase === 'settled' && (
          <div className={`rounded-xl px-4 py-3 text-center border font-bold text-lg ${
            success
              ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300'
              : 'bg-rose-900/60 border-rose-600 text-rose-300'
          }`}>
            {success ? '✅' : '❌'} {outcomeLabel}
          </div>
        )}

        {/* 남은 팝업 수 */}
        {survivorDiceQueue.length > 1 && (
          <div className="text-center text-xs text-gray-600">
            대기 중 {survivorDiceQueue.length - 1}개 더 있음
          </div>
        )}

        {/* 버튼 */}
        {phase === 'idle' && (
          <button
            onClick={handleRoll}
            className="py-3 rounded-xl border-2 border-violet-500 bg-violet-800 hover:bg-violet-700 text-white font-bold text-sm tracking-wide transition-colors"
          >
            🎲 주사위 확인
          </button>
        )}
        {phase === 'rolling' && (
          <div className="text-center text-violet-300 text-sm font-semibold animate-pulse py-3">
            굴리는 중...
          </div>
        )}
        {phase === 'settled' && (
          <button
            onClick={confirmSurvivorDice}
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
