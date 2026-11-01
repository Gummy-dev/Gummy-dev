import LEADERS_FROM_EXCEL from './leaders_from_excel.json' with { type: 'json' }
import { DESIGN_LEADERS } from './designDataAdapters.js'

// Runtime leader data is read from design/Leaders.json first.
// Replace that JSON after editing the sheet to update the game without another import step.
export const LEADERS = DESIGN_LEADERS.length > 0 ? DESIGN_LEADERS : LEADERS_FROM_EXCEL
