import { lazy } from 'react'
import ExpeditionBoard, { ExpeditionRules } from '../expedition/Board.jsx'
import { LEADERS, TYPES } from '../expedition/cards.js'
import { LEADERS as ORIGINAL_LEADERS } from '../data/leaders.js'
import { UTOPIA_CARDS } from '../data/utopias.js'
import { LEADERS as V1_LEADERS } from '../legacy/expedition-v1/cards.js'
import { CURRENT_EDITION } from './editions.js'

const current = {
  Board: ExpeditionBoard, Rules: ExpeditionRules, leaders: LEADERS,
  label: '낮 활동 · 밤 정비',
  intro: '지도자를 고른 뒤 야영지에서 첫 파티를 영입합니다. 낮에는 생존자를 파견하거나 능력을 사용하고, 밤에는 영입과 식사를 합니다. 정산된 동료는 비용 없이 피로 상태로 돌아옵니다.',
}
const art = { robot:'s_military_1', idol:'s_mood_1', zombie:'s_charge_1', duck:'s_weird_1', shy:'s_coward_1' }
// Archived editions are only loaded through their explicit URLs or saved invitations.
const archived = {
  'original-v2': {
    archived: true, label: '원본 보관판',
    Board: lazy(() => import('../legacy/RestoredBoard.jsx')),
    Rules: lazy(() => import('../legacy/OriginalRules.jsx')),
    leaders: ORIGINAL_LEADERS.map(l => ({ ...l, art:art[l.id], title:l.uniqueSkill.name, skill:l.uniqueSkill.description, utopia:UTOPIA_CARDS[l.id]?.name ?? '유토피아' })),
    intro: '과거 규칙을 사용하는 보관판입니다. 현재 규칙으로 시작하려면 현재 판으로 이동하세요.',
  },
  'expedition-v1': {
    archived: true, label: '공동 파견 보관판', starters:true, types:TYPES,
    Board: lazy(() => import('../legacy/expedition-v1/Board.jsx')),
    Rules: lazy(() => import('../legacy/expedition-v1/Board.jsx').then(module => ({ default:module.ExpeditionRules }))),
    leaders: V1_LEADERS,
    intro: '과거 공동 파견 규칙입니다. 기본 동료 두 명을 선택합니다. 현재 판의 규칙과 다릅니다.',
  },
}
export const editionConfig = version => version === CURRENT_EDITION ? current : archived[version] ?? current
