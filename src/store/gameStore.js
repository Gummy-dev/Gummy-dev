import { create } from 'zustand'
import { DEFAULT_TURN_END_RESOURCES, DEFAULT_TURN_START_RESOURCES, SURVIVORS } from '../data/survivors.js'
import { EVENTS } from '../data/events.js'
import { LEADERS } from '../data/leaders.js'
import { RULES } from '../data/rules.js'
import { calcPartyScore } from '../logic/scoring.js'
import { decideBotAction } from '../logic/bot.js'

// ── 유틸 ──────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildSurvivorDeck() {
  const deck = []
  SURVIVORS.forEach((s) => {
    const copies = s.count ?? 1
    for (let i = 0; i < copies; i++) deck.push({ ...s, uid: `${s.id}_${i}` })
  })
  return shuffle(deck)
}

function buildEventDeck() {
  return shuffle([...EVENTS])
}

function createPlayer(id, leaderId, isBot = false) {
  const leader = LEADERS.find((l) => l.id === leaderId)
  return {
    id,
    name: isBot ? `봇 (${leader.name})` : `플레이어 ${id}`,
    isBot,
    turnsTaken: 0,
    leaderId,
    leaderName: leader.name,
    leaderEmoji: leader.emoji,
    leaderColor: leader.color,
    resources: { ...leader.initialResources },
    party: [],
    eventDiscard: [],
    scoreTokens: 0,
    abandonedEvents: [],
    maxPartySize: RULES.maxPartySize,
    score: 0,
  }
}

// ── 전역 이벤트 효과 적용 ─────────────────────────────────────────────
function applyGlobalEffectToState(state, effect) {
  if (!effect) return state
  if (effect.type === 'compound') {
    return effect.effects.reduce((s, e) => applyGlobalEffectToState(s, e), state)
  }

  const players = state.players.map((p) => {
    const u = { ...p, resources: { ...p.resources }, party: [...p.party] }
    switch (effect.type) {
      case 'remove_all_n':
        u.party = u.party.slice(0, Math.max(0, u.party.length - effect.amount))
        break
      case 'add_survivors_all': {
        const deck = state._tmpDeck ?? state.survivorDeck
        const added = deck.slice(0, Math.min(effect.amount, u.maxPartySize - u.party.length))
        u.party = [...u.party, ...added]
        break
      }
      case 'shuffle_all_parties':
        u.party = shuffle(u.party)
        break
      case 'lose_can_all':
        u.resources.can = Math.max(0, u.resources.can - effect.amount)
        break
      case 'lose_cap_all':
        u.resources.bottleCap = Math.max(0, u.resources.bottleCap - effect.amount)
        break
      case 'gain_can_all':
        u.resources.can += effect.amount
        break
      case 'halve_can_all':
        u.resources.can = Math.floor(u.resources.can / 2)
        break
      default:
        break
    }
    return u
  })

  // add_survivors_all 인 경우 덱에서 사용한 만큼 제거
  let survivorDeck = state.survivorDeck
  if (effect.type === 'add_survivors_all') {
    const used = state.players.reduce((acc) => acc + Math.min(effect.amount, 5), 0)
    survivorDeck = survivorDeck.slice(used)
  }

  return {
    ...state,
    players: players.map((player) => ({ ...player, score: calcPlayerScore(player) })),
    survivorDeck,
  }
}

// ────────────────────────────────────────────────────────────────────
export const useGameStore = create((set, get) => ({
  // ── 화면 ──────────────────────────────────────
  screen: 'setup',

  // ── 설정 ──────────────────────────────────────
  playerCount: 2,
  playerConfigs: [],

  // ── 게임 상태 ─────────────────────────────────
  players: [],
  currentPlayerIndex: 0,
  round: 1,

  // 턴 페이즈
  // 'action'   : 이벤트 확인 및 해결
  // 'purchase' : 용병 영입, 자원 교환
  phase: 'action',

  // 이벤트 슬롯
  eventDeck: [],
  eventSlots: Array(RULES.eventSlotCount).fill(null),
  revealedSlots: Array(RULES.eventSlotCount).fill(false),   // 공개 여부 — 턴이 바뀌어도 유지

  // 인터랙션 상태 (이벤트 해결 중 플레이어 선택이 필요할 때)
  interaction: null,
  /*
    interaction = {
      slotIndex: number,
      event: { ...eventData },
      step: 'select_my_survivor'
            | 'select_target_player'
            | 'select_target_survivor'
            | 'select_swap_a'
            | 'select_swap_b',
      payload: {
        selectedMyUids: [],      // 내 파티에서 고른 uid 목록
        targetPlayerIndex: null,
        targetSurvivorUid: null,
        swapA: null,
        swapB: null,
      },
      resolvedSlots: [],         // 이미 해결 완료된 슬롯 (리필 대기)
    }
  */

  // 구매 단계
  survivorDeck: [],
  mercenaryPool: [],
  revealedUids: [],
  discardPile: [],
  actionEffects: [],

  globalLog: [],

  // ── 설정 화면 ─────────────────────────────────
  setPlayerConfig(index, config) {
    set((state) => {
      const configs = [...state.playerConfigs]
      configs[index] = { ...configs[index], ...config }
      return { playerConfigs: configs }
    })
  },

  initConfigs(count) {
    const configs = Array.from({ length: count }, (_, i) => ({
      leaderId: LEADERS[i % LEADERS.length].id,
      isBot: i > 0,
    }))
    set({ playerCount: count, playerConfigs: configs })
  },

  // ── 게임 시작 ─────────────────────────────────
  startGame() {
    const { playerConfigs } = get()
    const survivorDeck = buildSurvivorDeck()
    const rawEventDeck = buildEventDeck()
    const players = playerConfigs.map((cfg, i) =>
      createPlayer(i + 1, cfg.leaderId, cfg.isBot)
    )
    const mercenaryPool = survivorDeck.splice(0, RULES.mercenaryDrawCount)
    const eventSlots = rawEventDeck.splice(0, RULES.eventSlotCount)
    const eventDeck = rawEventDeck

    set({
      screen: 'game',
      players, currentPlayerIndex: 0, round: 1, phase: 'purchase',
      survivorDeck, mercenaryPool, revealedUids: [],
      discardPile: [],
      actionEffects: [],
      eventDeck,
      eventSlots,
      revealedSlots: Array(RULES.eventSlotCount).fill(false),
      interaction: null,
      globalLog: ['게임 시작! 각 플레이어의 첫 턴은 구매 단계만 진행합니다.'],
    })

    get().settleCurrentPlayerTurnStart()

    if (players[0].isBot) setTimeout(() => get().runBotTurn(), RULES.botThinkDelay)
  },

  // ── 이벤트 슬롯 공개 (통조림 소모) ───────────
  revealEventSlot(slotIndex) {
    const state = get()
    const player = state.players[state.currentPlayerIndex]
    const event = state.eventSlots[slotIndex]
    if (!event || state.revealedSlots[slotIndex]) return
    if (player.resources.can < RULES.eventRevealCost) return

    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex] }
      p.resources = { ...p.resources, can: p.resources.can - RULES.eventRevealCost }
      players[s.currentPlayerIndex] = p
      const revealedSlots = [...s.revealedSlots]
      revealedSlots[slotIndex] = true
      return { players, revealedSlots }
    })

    get().addLog(`${player.name} — 이벤트 ${slotIndex + 1} 공개: ${event.emoji} ${event.name} (🥫-${RULES.eventRevealCost})`)

    // 전체/재난 이벤트 즉시 발동
    if (event.scope !== 'personal') {
      set((s) => {
        const next = applyGlobalEffectToState(s, event.globalEffect)
        // 슬롯 보충은 행동 단계 종료 시 처리 → 여기선 빈 슬롯만 null로
        const eventSlots = [...next.eventSlots]
        eventSlots[slotIndex] = null
        const revealedSlots = [...next.revealedSlots]
        revealedSlots[slotIndex] = false

        // 해결 플레이어 discard
        const players = [...next.players]
        const p = { ...players[s.currentPlayerIndex] }
        p.eventDiscard = [...p.eventDiscard, event]
        p.score = calcPlayerScore(p)
        players[s.currentPlayerIndex] = p

        return { ...next, players, eventSlots, revealedSlots }
      })
      get().addLog(`⚡ ${event.emoji} ${event.name} 전체 발동 완료`)
      get().pushActionEffect(createGlobalActionEffect(event))
      return
    }

    if (event.autoStartOnReveal) {
      get().startEventResolution(slotIndex)
    }
  },

  replaceEventSlot(slotIndex) {
    const state = get()
    const player = state.players[state.currentPlayerIndex]
    const event = state.eventSlots[slotIndex]
    if (!event || !state.revealedSlots[slotIndex] || state.phase !== 'action' || state.interaction) return

    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex] }
      p.abandonedEvents = [...p.abandonedEvents, event]
      p.score = calcPlayerScore(p)
      players[s.currentPlayerIndex] = p

      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      eventSlots[slotIndex] = s.eventDeck.length > 0 ? s.eventDeck[0] : null
      revealedSlots[slotIndex] = false

      return {
        players,
        eventSlots,
        revealedSlots,
        eventDeck: s.eventDeck.length > 0 ? s.eventDeck.slice(1) : s.eventDeck,
      }
    })

    get().addLog(`${player.name} — ${event.emoji} ${event.name} 넘기기 (벌점 -1)`)
  },

  // ── 개인 이벤트 해결 시작 ─────────────────────
  startEventResolution(slotIndex) {
    const { eventSlots, players, currentPlayerIndex } = get()
    const event = eventSlots[slotIndex]
    if (!event || event.scope !== 'personal') return

    const resolution = event.resolution
    const player = players[currentPlayerIndex]

    if (resolution.type === 'pay_can' || resolution.type === 'pay_cap') {
      const resourceKey = resolution.type === 'pay_can' ? 'can' : 'bottleCap'
      const label = resolution.type === 'pay_can' ? '통조림' : '병뚜껑'
      if (player.resources[resourceKey] < resolution.amount) {
        if (event.penalizeOnFail) {
          get()._markEventAsPenalty(slotIndex, event, `${label} 부족`)
          return
        }
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 실패 (${label} 부족)`)
        return
      }

      if (resolution.then) {
        set((s) => {
          const players = [...s.players]
          const p = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
          p.resources[resourceKey] -= resolution.amount
          players[s.currentPlayerIndex] = p

          return {
            players,
            interaction: {
              slotIndex,
              event: {
                ...event,
                resolution: {
                  type: resolution.then,
                  amount: resolution.amount,
                  survivorType: resolution.survivorType,
                },
              },
              step: getFirstStep({ type: resolution.then }),
              payload: {
                selectedMyUids: [],
                targetPlayerIndex: null,
                targetSurvivorUid: null,
                swapA: null,
                swapB: null,
                paidCost: { resourceKey, amount: resolution.amount },
              },
            },
          }
        })
        get().addLog(`${player.name} — ${event.emoji} ${event.name} 준비 완료 (${label} ${resolution.amount} 지불)`)
        return
      }
    }

    // 즉시 해결 가능한 타입
    const autoTypes = ['pay_can', 'pay_cap', 'check_survivor_type', 'check_survivors_n', 'remove_random']

    if (autoTypes.includes(resolution.type)) {
      get()._resolveAuto(slotIndex, event, player)
    } else {
      // 인터랙션 필요
      const firstStep = getFirstStep(resolution)
      set({
        interaction: {
          slotIndex, event,
          step: firstStep,
          payload: { selectedMyUids: [], targetPlayerIndex: null, targetSurvivorUid: null, swapA: null, swapB: null },
        },
      })
    }
  },

  // ── 자동 해결 ─────────────────────────────────
  _resolveAuto(slotIndex, event, player) {
    const resolution = event.resolution
    let success = false
    let penaltyApplied = false
    let rewardLogs = []

    set((s) => {
      const players = [...s.players]
      const idx = s.currentPlayerIndex
      let survivorDeck = [...s.survivorDeck]
      let p = { ...players[idx], resources: { ...players[idx].resources }, party: [...players[idx].party] }

      switch (resolution.type) {
        case 'pay_can':
          if (p.resources.can >= resolution.amount) {
            p.resources.can -= resolution.amount
            success = true
          }
          break
        case 'pay_cap':
          if (p.resources.bottleCap >= resolution.amount) {
            p.resources.bottleCap -= resolution.amount
            success = true
          }
          break
        case 'check_survivor_type':
          success = p.party.some((sv) => sv.type === resolution.survivorType)
          if (!success && event.failPenalty) {
            p = applyPenaltyToPlayer(p, event.failPenalty, s.survivorDeck)
            penaltyApplied = true
          }
          break
        case 'check_survivors_n':
          success = p.party.length >= resolution.amount
          if (!success && event.failPenalty) {
            p = applyPenaltyToPlayer(p, event.failPenalty, s.survivorDeck)
            penaltyApplied = true
          }
          break
        case 'remove_random':
          if (p.party.length > 0) {
            const ri = Math.floor(Math.random() * p.party.length)
            p.party = p.party.filter((_, i) => i !== ri)
            success = true
          }
          break
        case 'reorder_my_party':
          // UI에서 드래그로 처리 — 이 경우 그냥 성공으로 처리
          success = true
          break
        default:
          success = false
      }

      // 보상 지급
      if (success && event.reward && !penaltyApplied) {
        const applied = applyRewardToPlayer(p, event.reward, survivorDeck)
        p = applied.player
        survivorDeck = applied.survivorDeck
        rewardLogs = applied.logs
      }

      if (success || !event.penalizeOnFail) {
        p.eventDiscard = [...p.eventDiscard, event]
      } else {
        p.abandonedEvents = [...p.abandonedEvents, event]
      }
      p.score = calcPlayerScore(p)
      players[idx] = p

      // 슬롯 null 처리 (리필은 행동 단계 종료 시)
      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      eventSlots[slotIndex] = null
      revealedSlots[slotIndex] = false

      return { players, eventSlots, revealedSlots, interaction: null, survivorDeck }
    })

    const result = success ? '해결!' : event.penalizeOnFail ? '실패, 벌점 추가' : '조건 미충족'
    get().addLog(`${player.name} — ${event.emoji} ${event.name} ${result}`)
    rewardLogs.forEach((message) => get().addLog(message))
  },

  // ── 인터랙션: 내 생존자 선택 ─────────────────
  selectMySurvivor(uid) {
    const { interaction } = get()
    if (!interaction) return
    if (interaction.kind === 'upkeep_discard') {
      const selected = interaction.payload.selectedMyUids.includes(uid)
        ? interaction.payload.selectedMyUids.filter((u) => u !== uid)
        : [...interaction.payload.selectedMyUids, uid]

      if (selected.length <= interaction.requiredCount) {
        set({ interaction: { ...interaction, payload: { ...interaction.payload, selectedMyUids: selected } } })
      }

      if (selected.length === interaction.requiredCount) {
        get()._finalizeUpkeepDiscard(selected)
      }
      return
    }

    const { event, slotIndex, payload } = interaction
    const resolution = event.resolution
    const currentPlayer = get().players[get().currentPlayerIndex]
    const survivor = currentPlayer?.party.find((sv) => sv.uid === uid)
    if (!survivor) return

    if (resolution.type === 'send_survivor_type' && survivor.type !== resolution.survivorType) {
      return
    }

    // 단일 선택
    const amount = resolution.amount ?? 1
    const newSelected = payload.selectedMyUids.includes(uid)
      ? payload.selectedMyUids.filter((u) => u !== uid)
      : [...payload.selectedMyUids, uid]

    if (newSelected.length <= amount) {
      set({ interaction: { ...interaction, payload: { ...payload, selectedMyUids: newSelected } } })
    }

    // 선택 완료 시 다음 스텝으로
    if (newSelected.length === amount) {
      const nextStep = getNextStep(resolution, interaction.step)
      if (!nextStep) {
        get()._finalizeInteraction()
      } else {
        set({ interaction: { ...interaction, step: nextStep, payload: { ...payload, selectedMyUids: newSelected } } })
      }
    }
  },

  // ── 인터랙션: 타 플레이어 선택 ───────────────
  selectTargetPlayer(playerIndex) {
    const { interaction } = get()
    if (!interaction) return
    const nextStep = getNextStep(interaction.event.resolution, interaction.step)
    set({
      interaction: {
        ...interaction,
        step: nextStep ?? interaction.step,
        payload: { ...interaction.payload, targetPlayerIndex: playerIndex },
      },
    })
    if (!nextStep) get()._finalizeInteraction()
  },

  // ── 인터랙션: 타 파티 생존자 선택 ────────────
  selectTargetSurvivor(uid) {
    const { interaction } = get()
    if (!interaction) return
    set({ interaction: { ...interaction, payload: { ...interaction.payload, targetSurvivorUid: uid } } })
    get()._finalizeInteraction()
  },

  // ── 인터랙션: 순서 변경 스왑 ─────────────────
  selectSwapSurvivor(uid) {
    const { interaction } = get()
    if (!interaction) return
    const { payload } = interaction
    if (!payload.swapA) {
      const nextStep = getNextStep(interaction.event.resolution, interaction.step)
      set({
        interaction: {
          ...interaction,
          step: nextStep ?? interaction.step,
          payload: { ...payload, swapA: uid },
        },
      })
    } else if (!payload.swapB && uid !== payload.swapA) {
      set({ interaction: { ...interaction, payload: { ...payload, swapB: uid } } })
      get()._finalizeInteraction()
    }
  },

  // ── 인터랙션 최종 처리 ────────────────────────
  _finalizeInteraction() {
    const state = get()
    const { interaction, players, currentPlayerIndex, survivorDeck } = state
    if (!interaction) return
    const { slotIndex, event, payload } = interaction
    const resolution = event.resolution

    let rewardLogs = []
    let actionEffects = []
    set((s) => {
      const players = [...s.players]
      let survivorDeck = [...s.survivorDeck]
      let p = { ...players[currentPlayerIndex], resources: { ...players[currentPlayerIndex].resources }, party: [...players[currentPlayerIndex].party] }
      let success = false

      switch (resolution.type) {
        case 'remove_choice': {
          const uids = payload.selectedMyUids
          p.party = p.party.filter((sv) => !uids.includes(sv.uid))
          success = uids.length > 0
          break
        }
        case 'send_survivor_type':
        case 'send_survivors_n': {
          const uids = payload.selectedMyUids
          const targets = uids.map((uid) => p.party.find((sv) => sv.uid === uid)).filter(Boolean)
          p.party = p.party.filter((sv) => !uids.includes(sv.uid))
          const ti = payload.targetPlayerIndex
          if (ti !== null && ti !== undefined && players[ti]) {
            const tp = { ...players[ti], party: [...players[ti].party] }
            targets.forEach((sv) => {
              if (tp.party.length < tp.maxPartySize) tp.party.push(sv)
            })
            players[ti] = tp
            success = targets.length > 0
            if (targets.length > 0) {
              actionEffects.push(createActionEffect({
                type: 'transfer',
                title: `${event.name}`,
                icon: event.emoji,
                targetName: tp.name,
                detail: `${targets.map((sv) => `${sv.emoji} ${sv.name}`).join(', ')} 전가`,
              }))
            }
          } else {
            p.party = [...players[currentPlayerIndex].party]
          }
          break
        }
        case 'take_from_party': {
          const ti = payload.targetPlayerIndex
          const uid = payload.targetSurvivorUid
          if (ti !== null && players[ti] && uid) {
            const tp = { ...players[ti], party: [...players[ti].party] }
            const sv = tp.party.find((s) => s.uid === uid)
            if (sv && p.party.length < p.maxPartySize) {
              tp.party = tp.party.filter((s) => s.uid !== uid)
              p.party = [...p.party, sv]
              players[ti] = tp
              success = true
              actionEffects.push(createActionEffect({
                type: 'steal',
                title: `${event.name}`,
                icon: event.emoji,
                targetName: tp.name,
                detail: `${sv.emoji} ${sv.name} 탈취`,
              }))
            }
          }
          break
        }
        case 'remove_from_party': {
          const ti = payload.targetPlayerIndex
          const uid = payload.targetSurvivorUid
          if (ti !== null && players[ti] && uid) {
            const removed = players[ti].party.find((s) => s.uid === uid)
            const tp = { ...players[ti], party: players[ti].party.filter((s) => s.uid !== uid) }
            players[ti] = tp
            success = true
            if (removed) {
              actionEffects.push(createActionEffect({
                type: 'destroy',
                title: `${event.name}`,
                icon: event.emoji,
                targetName: tp.name,
                detail: `${removed.emoji} ${removed.name} 제거`,
              }))
            }
          }
          break
        }
        case 'reorder_other_party': {
          const ti = payload.targetPlayerIndex
          if (ti !== null && players[ti] && payload.swapA && payload.swapB) {
            const tp = { ...players[ti], party: [...players[ti].party] }
            const ai = tp.party.findIndex((s) => s.uid === payload.swapA)
            const bi = tp.party.findIndex((s) => s.uid === payload.swapB)
            if (ai >= 0 && bi >= 0) {
              ;[tp.party[ai], tp.party[bi]] = [tp.party[bi], tp.party[ai]]
              players[ti] = tp
              success = true
            }
          }
          break
        }
        case 'reorder_my_party': {
          if (payload.swapA && payload.swapB) {
            const ai = p.party.findIndex((s) => s.uid === payload.swapA)
            const bi = p.party.findIndex((s) => s.uid === payload.swapB)
            if (ai >= 0 && bi >= 0) {
              ;[p.party[ai], p.party[bi]] = [p.party[bi], p.party[ai]]
              success = true
            }
          }
          break
        }
        default:
          break
      }

      if (success && event.reward) {
        const applied = applyRewardToPlayer(p, event.reward, survivorDeck)
        p = applied.player
        survivorDeck = applied.survivorDeck
        rewardLogs = applied.logs
      }
      if (success || !event.penalizeOnFail) {
        p.eventDiscard = [...p.eventDiscard, event]
      } else {
        p.abandonedEvents = [...p.abandonedEvents, event]
      }
      p.score = calcPlayerScore(p)
      players[currentPlayerIndex] = p

      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      eventSlots[slotIndex] = null
      revealedSlots[slotIndex] = false

      return { players, eventSlots, revealedSlots, interaction: null, survivorDeck }
    })

    get().addLog(`${players[currentPlayerIndex].name} — ${event.emoji} ${event.name} 판정 완료`)
    rewardLogs.forEach((message) => get().addLog(message))
    actionEffects.forEach((effect) => get().pushActionEffect(effect))
  },

  _markEventAsPenalty(slotIndex, event, reason = '조건 미충족') {
    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex] }
      p.abandonedEvents = [...p.abandonedEvents, event]
      p.score = calcPlayerScore(p)
      players[s.currentPlayerIndex] = p

      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      eventSlots[slotIndex] = null
      revealedSlots[slotIndex] = false

      return { players, eventSlots, revealedSlots, interaction: null }
    })

    const { players, currentPlayerIndex } = get()
    get().addLog(`${players[currentPlayerIndex].name} — ${event.emoji} ${event.name} 실패 (${reason}), 벌점 추가`)
  },

  cancelInteraction() {
    set((s) => {
      if (s.interaction?.kind === 'upkeep_discard') return {}
      if (!s.interaction?.payload?.paidCost) return { interaction: null }

      const { resourceKey, amount } = s.interaction.payload.paidCost
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
      p.resources[resourceKey] += amount
      players[s.currentPlayerIndex] = p

      return { players, interaction: null }
    })
  },

  // ── 행동 단계 → 구매 단계 (슬롯 리필) ────────
  endActionPhase() {
    set((s) => {
      const eventSlots = [...s.eventSlots]
      const revealedSlots = [...s.revealedSlots]
      let eventDeck = [...s.eventDeck]

      for (let i = 0; i < eventSlots.length; i++) {
        if (eventSlots[i] === null) {
          eventSlots[i] = eventDeck.length > 0 ? eventDeck.shift() : null
          revealedSlots[i] = false
        }
      }

      return { phase: 'purchase', eventSlots, revealedSlots, eventDeck }
    })
    get().addLog('▶ 구매 단계 시작')
  },

  // ── 자원 교환 ─────────────────────────────────
  exchangeCapToCan() {
    set((s) => {
      const idx = s.currentPlayerIndex
      const p = { ...s.players[idx], resources: { ...s.players[idx].resources } }
      if (p.resources.bottleCap < 1) return {}
      p.resources.bottleCap -= 1
      p.resources.can += RULES.capToCanRate
      const players = [...s.players]
      players[idx] = p
      return { players }
    })
    get().addLog(`🪙→🥫 병뚜껑 1 → 통조림 ${RULES.capToCanRate}`)
  },

  exchangeCanToCap() {
    set((s) => {
      const idx = s.currentPlayerIndex
      const p = { ...s.players[idx], resources: { ...s.players[idx].resources } }
      if (p.resources.can < RULES.canToCapRate) return {}
      p.resources.can -= RULES.canToCapRate
      p.resources.bottleCap += 1
      const players = [...s.players]
      players[idx] = p
      return { players }
    })
    get().addLog(`🥫→🪙 통조림 ${RULES.canToCapRate} → 병뚜껑 1`)
  },

  // ── 카드 공개 (용병소) ────────────────────────
  revealCard(uid) {
    const { players, currentPlayerIndex, revealedUids } = get()
    const player = players[currentPlayerIndex]
    if (player.resources.bottleCap < RULES.revealCost || revealedUids.includes(uid)) return
    set((s) => {
      const players = [...s.players]
      const p = { ...players[currentPlayerIndex] }
      p.resources = { ...p.resources, bottleCap: p.resources.bottleCap - RULES.revealCost }
      players[currentPlayerIndex] = p
      return { players, revealedUids: [...s.revealedUids, uid] }
    })
    get().addLog(`${player.name} — 용병소 카드 확인 (🪙-${RULES.revealCost})`)
  },

  // ── 생존자 영입 ───────────────────────────────
  recruitSurvivor(survivorUid) {
    const { players, currentPlayerIndex, mercenaryPool, survivorDeck, revealedUids } = get()
    const player = players[currentPlayerIndex]
    const slotIndex = mercenaryPool.findIndex((s) => s?.uid === survivorUid)
    const survivor = slotIndex >= 0 ? mercenaryPool[slotIndex] : null
    if (!survivor) return
    if (player.party.length >= player.maxPartySize) return
    const cost = survivor.recruitCost ?? 0
    if (player.resources.bottleCap < cost) return

    const newPool = [...mercenaryPool]
    newPool[slotIndex] = null

    set((s) => {
      const players = [...s.players]
      const p = { ...players[currentPlayerIndex] }
      p.resources = { ...p.resources, bottleCap: p.resources.bottleCap - cost }
      p.party = [...p.party, survivor]
      p.score = calcPlayerScore(p)
      players[currentPlayerIndex] = p
      return {
        players, mercenaryPool: newPool, survivorDeck,
        revealedUids: revealedUids.filter((uid) => uid !== survivorUid),
      }
    })
    get().addLog(`${player.name} → ${survivor.emoji} ${survivor.name} 영입 (🪙-${cost})`)
  },

  discardMercenary(uid) {
    const { players, currentPlayerIndex, mercenaryPool, survivorDeck, revealedUids } = get()
    const player = players[currentPlayerIndex]
    if (get().phase !== 'purchase') return
    if (player.resources.can < RULES.mercenaryDiscardCanCost) return
    const index = mercenaryPool.findIndex((s) => s.uid === uid)
    if (index < 0 || !revealedUids.includes(uid)) return

    const newDeck = [...survivorDeck]
    const replacement = newDeck.length > 0 ? newDeck.shift() : null

    set((s) => {
      const players = [...s.players]
      const p = { ...players[s.currentPlayerIndex], resources: { ...players[s.currentPlayerIndex].resources } }
      p.resources.can -= RULES.mercenaryDiscardCanCost
      players[s.currentPlayerIndex] = p

      const newPool = [...s.mercenaryPool]
      newPool.splice(index, 1, ...(replacement ? [replacement] : []))

      return {
        players,
        mercenaryPool: newPool,
        survivorDeck: newDeck,
        revealedUids: [
          ...s.revealedUids.filter((revealedUid) => revealedUid !== uid),
          ...(replacement ? [replacement.uid] : []),
        ],
      }
    })

    const discarded = mercenaryPool[index]
    if (replacement) {
      get().addLog(`${player.name} — ${discarded.emoji} ${discarded.name} 교체 (🥫-${RULES.mercenaryDiscardCanCost})`)
    } else {
      get().addLog(`${player.name} — ${discarded.emoji} ${discarded.name} 버림, 새 카드 없음 (🥫-${RULES.mercenaryDiscardCanCost})`)
    }
  },

  // ── 파티 순서 변경 ────────────────────────────
  swapPartyMembers(playerIndex, fromIdx, toIdx) {
    const { players } = get()
    const player = players[playerIndex]
    if (player.resources.bottleCap < RULES.partyReorderCost) return
    set((s) => {
      const players = [...s.players]
      const p = { ...players[playerIndex] }
      p.resources = { ...p.resources, bottleCap: p.resources.bottleCap - RULES.partyReorderCost }
      const party = [...p.party]
      ;[party[fromIdx], party[toIdx]] = [party[toIdx], party[fromIdx]]
      p.party = party
      p.score = calcPlayerScore(p)
      players[playerIndex] = p
      return { players }
    })
    get().addLog(`${player.name} — 파티 순서 변경 (🪙-${RULES.partyReorderCost})`)
  },

  // ── 턴 시작 정산 ──────────────────────────────
  settleCurrentPlayerTurnStart() {
    const logMessages = []
    let turnStartDeltas = { can: 0, bottleCap: 0 }

    set((s) => {
      const players = s.players.map((player) => ({
        ...player,
        resources: { ...player.resources },
        party: [...player.party],
      }))

      const currentPlayer = players[s.currentPlayerIndex]
      const startCan = currentPlayer.resources.can
      const startCap = currentPlayer.resources.bottleCap

      currentPlayer.party.forEach((survivor, survivorIndex) => {
        const turnStartResources = getTurnStartResourcesForSurvivor(survivor, survivorIndex)
        currentPlayer.resources.can += turnStartResources.can
        currentPlayer.resources.bottleCap = Math.max(0, currentPlayer.resources.bottleCap + turnStartResources.bottleCap)
      })

      turnStartDeltas = {
        can: currentPlayer.resources.can - startCan,
        bottleCap: currentPlayer.resources.bottleCap - startCap,
      }

      players.forEach((player) => {
        player.score = calcPlayerScore(player)
      })

      return { players }
    })

    logMessages.forEach((message) => get().addLog(message))
    if (turnStartDeltas.bottleCap > 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_gain',
        title: '턴 시작 정산',
        icon: '🪙',
        targetName: '병뚜껑 획득',
        detail: `병뚜껑 +${turnStartDeltas.bottleCap}`,
      }))
    }
    if (turnStartDeltas.can > 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_gain',
        title: '턴 시작 정산',
        icon: '🥫',
        targetName: '통조림 획득',
        detail: `통조림 +${turnStartDeltas.can}`,
      }))
    }
  },

  // ── 턴 종료 정산 ──────────────────────────────
  settleCurrentPlayerTurnEnd() {
    const logMessages = []
    let turnEndDeltas = { can: 0, bottleCap: 0 }
    let shortage = 0
    set((s) => {
      const players = s.players.map((player) => ({
        ...player,
        resources: { ...player.resources },
        party: [...player.party],
      }))

      const currentPlayer = players[s.currentPlayerIndex]
      const startCan = currentPlayer.resources.can
      const startCap = currentPlayer.resources.bottleCap

      currentPlayer.party.forEach((survivor, survivorIndex) => {
        const turnEndResources = getTurnEndResourcesForSurvivor(survivor, survivorIndex)
        currentPlayer.resources.can += turnEndResources.can
        currentPlayer.resources.bottleCap = Math.max(0, currentPlayer.resources.bottleCap + turnEndResources.bottleCap)

        if (survivor.turnEndRandomGift?.resource === 'bottleCap' && survivor.turnEndRandomGift.amount > 0) {
          const targetIndexes = players
            .map((_, index) => index)
            .filter((index) => index !== s.currentPlayerIndex)

          if (targetIndexes.length > 0 && currentPlayer.resources.bottleCap >= survivor.turnEndRandomGift.amount) {
            const targetIndex = targetIndexes[Math.floor(Math.random() * targetIndexes.length)]
            const targetPlayer = players[targetIndex]
            currentPlayer.resources.bottleCap -= survivor.turnEndRandomGift.amount
            targetPlayer.resources.bottleCap += survivor.turnEndRandomGift.amount
            logMessages.push(`${survivor.name} 효과: ${targetPlayer.name}에게 병뚜껑 ${survivor.turnEndRandomGift.amount}개 증여`)
          }
        }
      })

      shortage = Math.max(0, -currentPlayer.resources.can)
      currentPlayer.resources.can = Math.max(0, currentPlayer.resources.can)
      turnEndDeltas = {
        can: currentPlayer.resources.can - startCan,
        bottleCap: currentPlayer.resources.bottleCap - startCap,
      }

      players.forEach((player) => {
        player.score = calcPlayerScore(player)
      })

      return { players }
    })

    logMessages.forEach((message) => get().addLog(message))
    if (turnEndDeltas.bottleCap > 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_gain',
        title: '턴 종료 정산',
        icon: '🪙',
        targetName: '병뚜껑 획득',
        detail: `병뚜껑 +${turnEndDeltas.bottleCap}`,
      }))
    }
    if (turnEndDeltas.can < 0) {
      get().pushActionEffect(createActionEffect({
        type: 'resource_loss',
        title: '턴 종료 정산',
        icon: '🥫',
        targetName: '유지비 소모',
        detail: `통조림 ${turnEndDeltas.can}`,
      }))
    }
    return { shortage }
  },

  _finalizeUpkeepDiscard(selectedUids) {
    const { currentPlayerIndex, players } = get()
    const player = players[currentPlayerIndex]

    set((s) => {
      const players = [...s.players]
      const current = { ...players[s.currentPlayerIndex], party: [...players[s.currentPlayerIndex].party] }
      const discarded = current.party.filter((survivor) => selectedUids.includes(survivor.uid))
      current.party = current.party.filter((survivor) => !selectedUids.includes(survivor.uid))
      current.score = calcPlayerScore(current)
      players[s.currentPlayerIndex] = current
      return {
        players,
        discardPile: [...s.discardPile, ...discarded],
        interaction: null,
      }
    })

    get().addLog(`${player.name} — 통조림 부족으로 생존자 ${selectedUids.length}명 버림`)
    get()._advanceTurn()
  },

  // ── 턴 종료 ───────────────────────────────────
  endTurn() {
    const { shortage } = get().settleCurrentPlayerTurnEnd()
    const { players, currentPlayerIndex } = get()
    const player = players[currentPlayerIndex]

    if (shortage > 0 && player.party.length > 0) {
      if (player.isBot) {
        const selected = chooseSurvivorsToDiscard(player.party, shortage)
        get()._finalizeUpkeepDiscard(selected)
      } else {
        set({
          interaction: {
            kind: 'upkeep_discard',
            step: 'select_my_survivor',
            requiredCount: Math.min(shortage, player.party.length),
            payload: { selectedMyUids: [] },
          },
        })
        get().addLog(`${player.name} — 통조림 부족! 버릴 생존자 ${Math.min(shortage, player.party.length)}명을 선택하세요`)
      }
      return
    }
    if (shortage > 0 && player.party.length === 0) {
      get().addLog(`${player.name} — 통조림 부족이지만 버릴 생존자가 없음`)
    }

    get()._advanceTurn()
  },

  _advanceTurn() {
    set((s) => {
      const mercenaryPool = [...s.mercenaryPool]
      const revealedUids = [...s.revealedUids]
      let survivorDeck = [...s.survivorDeck]
      const players = [...s.players]

      const current = { ...players[s.currentPlayerIndex] }
      current.turnsTaken = (current.turnsTaken ?? 0) + 1
      players[s.currentPlayerIndex] = current

      for (let i = 0; i < mercenaryPool.length; i++) {
        if (mercenaryPool[i] === null && survivorDeck.length > 0) {
          mercenaryPool[i] = survivorDeck.shift()
        }
      }

      const next = (s.currentPlayerIndex + 1) % s.players.length
      const round = next === 0 ? s.round + 1 : s.round
      const nextPhase = (players[next]?.turnsTaken ?? 0) === 0 ? 'purchase' : 'action'
      return {
        players,
        currentPlayerIndex: next, round,
        phase: nextPhase,
        interaction: null,
        mercenaryPool,
        survivorDeck,
        revealedUids: revealedUids.filter((uid) => mercenaryPool.some((survivor) => survivor?.uid === uid)),
      }
    })

    const { players, currentPlayerIndex } = get()
    get().addLog(`--- ${players[currentPlayerIndex].name} 턴 (라운드 ${get().round}) ---`)
    get().settleCurrentPlayerTurnStart()

    if (players[currentPlayerIndex].isBot) {
      setTimeout(() => get().runBotTurn(), RULES.botThinkDelay)
    }
  },

  // ── 봇 턴 ────────────────────────────────────
  runBotTurn() {
    const { players, currentPlayerIndex, eventSlots, phase } = get()
    const player = players[currentPlayerIndex]
    if (!player.isBot) return

    if (phase === 'action') {
      // 이벤트 확인 및 해결
      eventSlots.forEach((event, i) => {
        if (!event) return
        const fresh = get()
        if (!fresh.revealedSlots[i] && fresh.players[currentPlayerIndex].resources.can >= RULES.eventRevealCost) {
          fresh.revealEventSlot(i)
        }
        const event2 = get().eventSlots[i]
        if (event2?.scope === 'personal' && get().revealedSlots[i]) {
          get().startEventResolution(i)
        }
      })

      get().endActionPhase()
    }

    // 용병소 전체 공개
    const { mercenaryPool } = get()
    set((s) => ({ revealedUids: Array.from(new Set([...s.revealedUids, ...mercenaryPool.map((sv) => sv.uid)])) }))

    const freshPlayer = get().players[currentPlayerIndex]
    const actions = decideBotAction(freshPlayer, get(), get().mercenaryPool)
    actions.forEach((action) => {
      if (action.type === 'RECRUIT') get().recruitSurvivor(action.survivorUid)
      if (action.type === 'REORDER') get().swapPartyMembers(currentPlayerIndex, action.from, action.to)
    })

    setTimeout(() => get().endTurn(), RULES.botThinkDelay)
  },

  addLog(msg) {
    set((s) => ({ globalLog: [msg, ...s.globalLog].slice(0, 50) }))
  },

  pushActionEffect(effect) {
    set((s) => ({
      actionEffects: [...s.actionEffects, { id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...effect }],
    }))
  },

  dismissActionEffect(id) {
    set((s) => ({ actionEffects: s.actionEffects.filter((effect) => effect.id !== id) }))
  },

  resetGame() {
    set({ screen: 'setup', players: [], playerConfigs: [], globalLog: [] })
  },
}))

// ── 헬퍼 ──────────────────────────────────────────────────────────────
function getFirstStep(resolution) {
  switch (resolution.type) {
    case 'remove_choice':
    case 'send_survivor_type':
    case 'send_survivors_n':
      return 'select_my_survivor'
    case 'reorder_my_party':
      return 'select_swap_a'
    case 'take_from_party':
    case 'remove_from_party':
      return 'select_target_player'
    case 'reorder_other_party':
      return 'select_target_player'
    default:
      return null
  }
}

function getNextStep(resolution, currentStep) {
  const flow = {
    send_survivor_type:  { select_my_survivor: 'select_target_player' },
    send_survivors_n:    { select_my_survivor: 'select_target_player' },
    reorder_my_party:    { select_swap_a: 'select_swap_b' },
    take_from_party:     { select_target_player: 'select_target_survivor' },
    remove_from_party:   { select_target_player: 'select_target_survivor' },
    reorder_other_party: { select_target_player: 'select_swap_a', select_swap_a: 'select_swap_b' },
  }
  return flow[resolution.type]?.[currentStep] ?? null
}

function applyPenaltyToPlayer(p, penalty) {
  if (penalty.type === 'remove_random' && p.party.length > 0) {
    const ri = Math.floor(Math.random() * p.party.length)
    p = { ...p, party: p.party.filter((_, i) => i !== ri) }
  }
  if (penalty.type === 'lose_can') {
    p = { ...p, resources: { ...p.resources, can: Math.max(0, p.resources.can - penalty.amount) } }
  }
  return p
}

function applyRewardToPlayer(player, reward, sourceDeck = []) {
  const rewards = Array.isArray(reward) ? reward : [reward]
  const nextPlayer = {
    ...player,
    resources: { ...player.resources },
    party: [...player.party],
  }
  let survivorDeck = [...sourceDeck]
  const logs = []

  rewards.forEach((entry) => {
    if (!entry) return

    if (entry.type === 'cap') nextPlayer.resources.bottleCap += entry.amount
    if (entry.type === 'can') nextPlayer.resources.can += entry.amount
    if (entry.type === 'score') nextPlayer.scoreTokens = (nextPlayer.scoreTokens ?? 0) + entry.amount
    if (entry.type === 'survivor') {
      let remaining = entry.amount ?? 1
      while (remaining > 0 && nextPlayer.party.length < nextPlayer.maxPartySize && survivorDeck.length > 0) {
        const survivor = survivorDeck.shift()
        nextPlayer.party.push(survivor)
        logs.push(`🤝 조우 보상: ${survivor.emoji} ${survivor.name} 합류`)
        remaining -= 1
      }
    }

    if (entry.bonus) {
      const bonusApplied = applyRewardToPlayer(nextPlayer, entry.bonus, survivorDeck)
      nextPlayer.resources = bonusApplied.player.resources
      nextPlayer.party = bonusApplied.player.party
      nextPlayer.scoreTokens = bonusApplied.player.scoreTokens
      survivorDeck = bonusApplied.survivorDeck
      logs.push(...bonusApplied.logs)
    }
  })

  return { player: nextPlayer, survivorDeck, logs }
}

function calcPlayerScore(player) {
  return (
    calcPartyScore(player.party, player.leaderId).total +
    (player.scoreTokens ?? 0) -
    (player.abandonedEvents?.length ?? 0)
  )
}

function getTurnEndResourcesForSurvivor(survivor, survivorIndex) {
  const base = {
    can: survivor.turnEndResources?.can ?? DEFAULT_TURN_END_RESOURCES.can,
    bottleCap: survivor.turnEndResources?.bottleCap ?? DEFAULT_TURN_END_RESOURCES.bottleCap,
  }

  return base
}

function getTurnStartResourcesForSurvivor(survivor, survivorIndex) {
  const base = {
    can: survivor.turnStartResources?.can ?? DEFAULT_TURN_START_RESOURCES.can ?? 0,
    bottleCap: survivor.turnStartResources?.bottleCap ?? DEFAULT_TURN_START_RESOURCES.bottleCap,
  }

  if (survivorIndex === 0 && survivor.turnStartBonusIfFirst) {
    base.can += survivor.turnStartBonusIfFirst.can ?? 0
    base.bottleCap += survivor.turnStartBonusIfFirst.bottleCap ?? 0
  }

  return base
}

function chooseSurvivorsToDiscard(party, count) {
  return [...party]
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, count)
    .map((survivor) => survivor.uid)
}

function createActionEffect({ type, title, icon, targetName, detail }) {
  return { type, title, icon, targetName, detail }
}

function createGlobalActionEffect(event) {
  return createActionEffect({
    type: event.scope === 'disaster' ? 'disaster' : 'global',
    title: event.name,
    icon: event.emoji,
    targetName: event.scope === 'disaster' ? '모든 플레이어' : '전체 적용',
    detail: summarizeGlobalEffect(event.globalEffect),
  })
}

function summarizeGlobalEffect(effect) {
  if (!effect) return '효과 발생'
  if (effect.type === 'compound') {
    return effect.effects.map((entry) => summarizeGlobalEffect(entry)).join(' · ')
  }

  switch (effect.type) {
    case 'remove_all_n':
      return `전원 생존자 ${effect.amount}명 제거`
    case 'add_survivors_all':
      return `전원 생존자 ${effect.amount}명 합류`
    case 'shuffle_all_parties':
      return '전원 파티 순서 섞임'
    case 'lose_can_all':
      return `전원 통조림 ${effect.amount}개 감소`
    case 'lose_cap_all':
      return `전원 병뚜껑 ${effect.amount}개 감소`
    case 'gain_can_all':
      return `전원 통조림 ${effect.amount}개 획득`
    case 'halve_can_all':
      return '전원 통조림 절반 감소'
    default:
      return '전체 효과 발생'
  }
}
