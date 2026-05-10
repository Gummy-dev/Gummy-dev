import SURVIVORS_FROM_EXCEL from './survivors_from_excel.json' with { type: 'json' }

export const DEFAULT_TURN_START_RESOURCES = {
  bottleCap: 0,
}

export const DEFAULT_TURN_END_RESOURCES = {
  can: 0,
  bottleCap: 0,
}

export const AFFINITY_MATRIX = {}
export const LEADER_ADJACENCY_BONUS = {}

// Runtime survivor data is generated from `멸망했는데_바쁨_데이터_현재.xlsx`.
// Run `python3 scripts/import_from_excel.py` after changing the Excel sheet.
export const SURVIVORS = SURVIVORS_FROM_EXCEL
