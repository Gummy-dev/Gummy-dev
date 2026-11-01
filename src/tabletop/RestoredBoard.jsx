import { useLayoutEffect, useRef } from 'react'
import GameBoard from '../components/GameBoard.jsx'
import { useGameStore } from '../store/gameStore.js'
import { RESTORED_ACTIONS } from '../game/restored.js'

export default function RestoredBoard({ api }) {
  const { room } = api
  const dismissed = useRef(new Set())
  const ready = useGameStore(state => state.networkRoom === room.code)
  useLayoutEffect(() => {
    const state = room.game
    const prefix = `${room.code}:${state.round}:${state.currentPlayerIndex}:${state.players[state.currentPlayerIndex].turnsTaken}`
    const diceKey = entry => `${prefix}:${JSON.stringify(entry)}`
    const actions = Object.fromEntries(Object.keys(useGameStore.getState()).filter(key => typeof useGameStore.getState()[key] === 'function').map(key => [key, () => {}]))
    for (const action of Object.keys(RESTORED_ACTIONS)) actions[action] = (...args) => {
      if (api.busy || !api.connected) return Promise.resolve(false)
      // React passes its click event to no-argument handlers; it is not a game command argument.
      if (RESTORED_ACTIONS[action]([])) args = []
      return api.command({ type: 'original', action, args, ...(['startEventResolution', 'startUtopiaResolution'].includes(action) ? { preselectedIds: useGameStore.getState().preselectedSurvivors ?? [] } : {}) })
    }
    actions.resetGame = api.exit
    actions.dismissActionEffect = id => {
      dismissed.current.add(id)
      useGameStore.setState(s => ({ actionEffects: s.actionEffects.filter(e => e.id !== id) }))
    }
    actions.confirmSurvivorDice = () => {
      const first = useGameStore.getState().survivorDiceQueue[0]
      if (first) dismissed.current.add(diceKey(first))
      useGameStore.setState(s => ({ survivorDiceQueue: s.survivorDiceQueue.slice(1) }))
    }
    const previous = useGameStore.getState()
    const keepSelection = previous.networkRoom === room.code && previous.currentPlayerIndex === state.currentPlayerIndex && previous.phase === state.phase && previous.round === state.round && !state.interaction && !state.diceRollModal
    useGameStore.setState({ ...state, ...actions, networkRoom: room.code,
      preselectedSurvivors: keepSelection ? (previous.preselectedSurvivors ?? []).filter(uid => state.players[state.localPlayerIndex].survivorActivity[uid] !== false) : [],
      networkBusy: api.busy || !api.connected,
      actionEffects: state.actionEffects.filter(e => !dismissed.current.has(e.id)),
      survivorDiceQueue: state.survivorDiceQueue.filter(e => !dismissed.current.has(diceKey(e))),
    })
  }, [room, api.busy, api.connected])
  if (!ready) return <p role="status">테이블을 펼치는 중입니다…</p>
  const me = room.seats.find(s => s.id === room.me)
  return <>
    {me.bot && <div className="connection-warning"><span>연습 봇이 내 차례를 대신하고 있습니다.</span><button className="secondary-button" disabled={api.busy || !api.connected} onClick={() => api.command({ type: 'reclaim' })}>내 자리로 돌아오기</button></div>}
    {room.host === room.me && room.seats.some(s => !s.connected && !s.bot && s.id !== room.me) && <div className="connection-warning">{room.seats.filter(s => !s.connected && !s.bot && s.id !== room.me).map(s => <button key={s.id} className="secondary-button" disabled={api.busy || !api.connected} onClick={() => api.command({ type: 'takeOver', id: s.id })}>{s.name} · 연결 종료 30초 후 봇으로 이어가기</button>)}</div>}
    <GameBoard myIndex={room.game.localPlayerIndex} onExit={api.exit}/>
  </>
}
