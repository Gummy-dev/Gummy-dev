import { createGameStore } from '../store/gameStore.js'

const requireRule = (ok, message) => { if (!ok) throw new Error(message) }
const copy = value => JSON.parse(JSON.stringify(value))
const index = value => Number.isInteger(value) && value >= 0 && value < 100
const uid = value => typeof value === 'string' && value.length > 0 && value.length < 200
const resource = value => ['can', 'bottleCap'].includes(value)
const noArgs = args => args.length === 0
const one = check => args => args.length === 1 && check(args[0])
export const RESTORED_ACTIONS = {
  revealEventSlot: one(index), acceptGlobalEvent: one(index), replaceEventSlot: one(index),
  startEventResolution: one(index), startUtopiaResolution: noArgs, confirmEventAssignment: noArgs,
  revealSearchSlot: args => args.length === 2 && [1, 2, 3].includes(args[0]) && index(args[1]),
  selectLeaderSearchCandidate: one(uid), cancelRobotSearch: noArgs, startRobotExtraSearch: one(v => [1, 2, 3].includes(v)),
  revealCard: one(uid), selectMySurvivor: one(uid), selectTargetPlayer: one(index),
  selectTargetSurvivor: one(uid), selectSwapSurvivor: one(uid), selectGraveSurvivor: one(uid),
  selectTradeResource: one(resource), cancelInteraction: noArgs, endActionPhase: noArgs,
  recruitSurvivor: args => args.length >= 1 && args.length <= 2 && uid(args[0]) && (args[1] == null || resource(args[1])),
  reserveIdolFan: one(uid), activateIdolFan: one(uid), recruitReturnedSurvivor: noArgs,
  returnPartySurvivorToMercenary: one(uid), discardMercenary: one(uid), reactivateSurvivor: one(uid),
  swapPartyMembers: args => args.length === 3 && args.every(index),
  revealStoredTreasure: args => args.length === 2 && index(args[0]) && uid(args[1]),
  closeTreasureRevealPopup: noArgs, startTreasureCardEffect: one(uid), cancelTreasureCardEffect: noArgs,
  confirmTreasureCardUse: noArgs, confirmTreasureCardEffect: one(uid),
  useZombieLeaderSkill: noArgs, useWizardSpell: noArgs, endTurn: noArgs,
  rollDice: noArgs, confirmDiceRoll: noArgs,
}

function restore(game) {
  const store = createGameStore({ schedule: () => {} })
  if (game) store.setState(copy(game))
  return store
}
export function createGame(seats) {
  const store = restore()
  store.setState({ playerCount: seats.length, playerConfigs: seats.map(s => ({ leaderId: s.leaderId, isBot: s.bot })) })
  store.getState().startGame()
  store.setState(state => ({ rulesVersion: 'original-v2', serverDiceRolls: null, players: state.players.map((p, i) => ({ ...p, seatId: seats[i].id, name: seats[i].name })) }))
  return copy(store.getState())
}
export const actorId = game => game.players[game.currentPlayerIndex].seatId

export function applyCommand(game, playerId, command, random = Math.random) {
  requireRule(game && !game.gameEnded, '게임이 종료되었습니다.')
  requireRule(actorId(game) === playerId, '다른 플레이어의 차례입니다.')
  requireRule(command.type === 'original', '복원된 규칙의 행동을 선택하세요.')
  const { action, args = [] } = command
  requireRule(Object.hasOwn(RESTORED_ACTIONS, action) && Array.isArray(args) && RESTORED_ACTIONS[action](args), '올바른 행동과 대상을 선택하세요.')
  if (['swapPartyMembers', 'revealStoredTreasure'].includes(action)) requireRule(args[0] === game.currentPlayerIndex, '내 파티만 조작할 수 있습니다.')
  if (action === 'selectTargetPlayer') requireRule(args[0] < game.players.length && args[0] !== game.currentPlayerIndex, '다른 파티를 선택하세요.')
  const steps = { selectMySurvivor: ['select_my_survivor'], selectTargetPlayer: ['select_target_player'], selectTargetSurvivor: ['select_target_survivor'], selectSwapSurvivor: ['select_swap_a', 'select_swap_b'], selectGraveSurvivor: ['select_grave_survivor'], selectTradeResource: ['select_trade_resource'] }
  if (steps[action]) requireRule(steps[action].includes(game.interaction?.step), '현재 선택 단계에 맞는 행동을 해 주세요.')
  if (game.diceRollModal) requireRule(['rollDice', 'confirmDiceRoll'].includes(action), '주사위 판정을 먼저 마쳐 주세요.')
  if (game.interaction) requireRule([...Object.keys(steps), 'confirmEventAssignment', 'cancelInteraction', 'selectLeaderSearchCandidate', 'cancelRobotSearch', 'useZombieLeaderSkill', 'confirmTreasureCardEffect'].includes(action), '진행 중인 선택을 먼저 마쳐 주세요.')
  if (command.preselectedIds != null) requireRule(Array.isArray(command.preselectedIds) && command.preselectedIds.length <= 6 && command.preselectedIds.every(uid) && new Set(command.preselectedIds).size === command.preselectedIds.length, '선택한 동료를 확인해 주세요.')
  const store = restore(game)
  if (action === 'rollDice') {
    requireRule(game.diceRollModal && !game.serverDiceRolls, '이미 굴렸거나 진행 중인 판정이 없습니다.')
    const count = game.diceRollModal.event.resolution.diceCount ?? 1
    store.setState({ serverDiceRolls: Array.from({ length: count }, () => Math.floor(random() * 6) + 1) })
  } else if (action === 'confirmDiceRoll') {
    requireRule(game.diceRollModal && game.serverDiceRolls, '먼저 주사위를 굴려 주세요.')
    store.getState().confirmDiceRoll(game.serverDiceRolls)
    store.setState({ serverDiceRolls: null })
  } else store.getState()[action](...args)
  if (['startEventResolution', 'startUtopiaResolution'].includes(action) && ['assign_event_party', 'assign_utopia_party'].includes(store.getState().interaction?.kind)) {
    for (const id of command.preselectedIds ?? []) store.getState().selectMySurvivor(id)
  }
  return copy(store.getState())
}

export function runBot(game) {
  const store = restore(game)
  const before = store.getState().currentPlayerIndex
  if (store.getState().players[before].isBot) {
    store.getState().runBotTurn()
    if (!store.getState().gameEnded && store.getState().currentPlayerIndex === before) store.getState().endTurn()
  }
  return copy(store.getState())
}

export function publicGame(game, playerId) {
  if (!game) return null
  const view = copy(game)
  const hidden = cards => (cards ?? []).map(() => null)
  const sharedTier = Math.max(...game.players.map(p => p.unlockedExplorationTier ?? 1))
  view.eventSlots = view.eventSlots.map(e => e && (e.tier ?? 1) <= sharedTier ? e : null)
  view.revealedSlots = view.revealedSlots.map((revealed, i) => revealed && Boolean(view.eventSlots[i]))
  for (const tier of [1, 2, 3]) if (tier > sharedTier) view.explorationState.visibleByTier[tier] = hidden(view.explorationState.visibleByTier[tier])
  for (const name of ['eventDeck', 'survivorDeck', 'treasureDeck']) view[name] = hidden(view[name])
  for (const key of ['decksByTier', 'clueDecksByTier', 'disasterDecksByTier']) {
    if (view.explorationState[key]) view.explorationState[key] = Object.fromEntries(Object.entries(view.explorationState[key]).map(([tier, cards]) => [tier, hidden(cards)]))
  }
  view.searchState.decksByTier = Object.fromEntries(Object.entries(view.searchState.decksByTier).map(([tier, cards]) => [tier, hidden(cards)]))
  view.localPlayerIndex = view.players.findIndex(p => p.seatId === playerId)
  view.players.forEach(p => { if (p.seatId !== playerId) p.treasureCards = (p.treasureCards ?? []).map(c => c.revealed ? c : { uid: c.uid, name: '미공개 보물', revealed: false, score: c.score }) })
  if (actorId(game) !== playerId && view.interaction?.kind === 'leader_skill_robot_search') view.interaction.payload.candidates = []
  return view
}
