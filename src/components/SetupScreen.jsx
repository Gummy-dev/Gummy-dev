import { useGameStore } from '../store/gameStore.js'
import { LEADERS } from '../data/leaders.js'
import { useState, useEffect } from 'react'

export default function SetupScreen() {
  const { playerCount, playerConfigs, initConfigs, setPlayerConfig, startGame } = useGameStore()
  const [count, setCount] = useState(2)

  useEffect(() => {
    initConfigs(count)
  }, [count])

  const usedLeaderIds = playerConfigs.map((c) => c?.leaderId)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-amber-400 mb-1">멸망했는데 바쁨</h1>
        <p className="text-gray-400 text-sm">아포칼립스 생존자 카드게임 프로토타입</p>
      </div>

      {/* 플레이어 수 */}
      <div className="flex flex-col items-center gap-3">
        <label className="text-sm text-gray-400 font-semibold tracking-wide">플레이어 수</label>
        <div className="flex gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors
                ${count === n ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 플레이어 설정 */}
      <div className="grid gap-4 w-full max-w-3xl">
        {Array.from({ length: count }).map((_, i) => (
          <PlayerConfig
            key={i}
            index={i}
            config={playerConfigs[i] ?? {}}
            usedLeaderIds={usedLeaderIds}
            onUpdate={(cfg) => setPlayerConfig(i, cfg)}
          />
        ))}
      </div>

      <button
        onClick={startGame}
        disabled={playerConfigs.length < count || playerConfigs.some((c) => !c?.leaderId)}
        className="btn-primary px-8 py-3 text-base rounded-xl"
      >
        게임 시작 🚀
      </button>
    </div>
  )
}

function PlayerConfig({ index, config, usedLeaderIds, onUpdate }) {
  const isBot = config.isBot ?? index > 0
  const selectedLeader = LEADERS.find((l) => l.id === config.leaderId)

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-200">
          {index === 0 ? '👤 플레이어 1 (나)' : `플레이어 ${index + 1}`}
        </span>
        {index > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isBot}
              onChange={(e) => onUpdate({ isBot: e.target.checked })}
              className="accent-amber-500"
            />
            봇으로 플레이
          </label>
        )}
      </div>

      {/* 지도자 선택 */}
      <div className="grid grid-cols-5 gap-2">
        {LEADERS.map((leader) => {
          const taken = usedLeaderIds.includes(leader.id) && leader.id !== config.leaderId
          return (
            <button
              key={leader.id}
              disabled={taken}
              onClick={() => onUpdate({ leaderId: leader.id })}
              className={`rounded-lg p-2 text-center transition-all border-2 text-xs
                ${config.leaderId === leader.id
                  ? 'border-amber-400 bg-gray-700'
                  : taken
                  ? 'border-transparent bg-gray-900 opacity-30 cursor-not-allowed'
                  : 'border-transparent bg-gray-800 hover:border-gray-600'
                }`}
            >
              <div className="text-2xl mb-1">{leader.emoji}</div>
              <div className="font-semibold" style={{ color: leader.color }}>{leader.name}</div>
              <div className="text-gray-500">{leader.type}</div>
            </button>
          )
        })}
      </div>

      {selectedLeader && (
        <p className="text-xs text-gray-500 italic">{selectedLeader.description}</p>
      )}
    </div>
  )
}
