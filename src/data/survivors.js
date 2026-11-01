import SURVIVORS_FROM_EXCEL from './survivors_from_excel.json' with { type: 'json' }
import { DESIGN_SURVIVORS } from './designDataAdapters.js'

export const DEFAULT_TURN_START_RESOURCES = {
  bottleCap: 0,
}

export const DEFAULT_TURN_END_RESOURCES = {
  can: 0,
  bottleCap: 0,
}

export const AFFINITY_MATRIX = {}
export const LEADER_ADJACENCY_BONUS = {}

// Runtime survivor data is read from design/Survivers.json first.
// Replace that JSON after editing the sheet to update the game without another import step.
export const SURVIVORS = DESIGN_SURVIVORS.length > 0 ? DESIGN_SURVIVORS : SURVIVORS_FROM_EXCEL
