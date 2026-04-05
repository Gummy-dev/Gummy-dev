import { useGameStore } from './store/gameStore.js'
import SetupScreen from './components/SetupScreen.jsx'
import GameBoard from './components/GameBoard.jsx'

export default function App() {
  const { screen } = useGameStore()

  return (
    <>
      {screen === 'setup' && <SetupScreen />}
      {screen === 'game' && <GameBoard />}
    </>
  )
}
