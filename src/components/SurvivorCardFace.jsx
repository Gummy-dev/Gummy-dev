import { Portrait, Token, TypeBadge } from '../tabletop/Visuals.jsx'
import { TYPES, TYPE_COLORS } from '../game/cards.js'
import './survivor-card.css'

// Printed information stays the same wherever this physical card is placed.
export default function SurvivorCardFace({ survivor }) {
  const meal = typeof survivor.reactivationCost === 'number' ? { can: survivor.reactivationCost } : survivor.reactivationCost ?? { can: 1 }
  return <div className="survivor-piece">
    <article data-board-card className="survivor-card survivor-card-face" style={{ '--survivor-color': TYPE_COLORS[TYPES.indexOf(survivor.type)] ?? '#7b7b70' }} data-survivor-id={survivor.id}>
      <div className="survivor-face">
        <div className="survivor-card-top">
          <span className="printed-cost" title="인쇄된 영입 비용"><Token kind="cap" value={survivor.recruitCost ?? 0} label={false} /><small>영입</small></span>
          <Token kind="score" value={survivor.score ?? 0} label={false} />
        </div>
        <div className="portrait-area"><Portrait card={{ art: survivor.id, name: survivor.name }} /></div>
        <div className="printed-type"><TypeBadge type={survivor.type} /></div>
        <h3>{survivor.name}</h3>
        <div className="printed-survivor-copy">
          <p className="printed-survivor-rule">{survivor.effect}</p>
          <p className="printed-survivor-flavor">{survivor.description}</p>
        </div>
        <div className="printed-card-footer"><span>{survivor.searchTier === 3 ? '베테랑' : survivor.searchTier === 2 ? '아마추어' : '생존자'}</span><span>식사 <Token kind="can" value={meal.can ?? 0} label={false} />{meal.bottleCap > 0 && <Token kind="cap" value={meal.bottleCap} label={false} />}</span></div>
      </div>
    </article>
  </div>
}
