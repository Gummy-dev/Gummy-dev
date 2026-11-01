import { useId } from 'react'
import { Icon, Token, TypeBadge } from '../tabletop/Visuals.jsx'
import { explorationType, locationPrizes, hazardText, distributionText } from './cards.js'

const artwork = import.meta.glob('../assets/exploration/*.png', { eager: true, query: '?url', import: 'default' })

const resourceKind = kind => kind === 'bottleCap' ? 'cap' : kind === 'route' ? 'clue' : kind

function DistributionIcon({ mode }) {
  if (mode === '교환') return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/></svg>
  if (mode === '선착순') return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="16.5" cy="4" r="2.5" fill="currentColor" stroke="none"/><path d="m5 11 4-4 4 1-3 6 5 3-2 5m-3-8-4 6H2m11-12 3 5h5"/></svg>
  return <svg viewBox={mode === '나눔' ? '0 1 40 31' : mode === '독식' ? '9 -8 22 39' : '9 1 22 31'} aria-hidden="true" fill="currentColor"><circle cx="20" cy="8" r="6"/><path d="M10 31v-8a10 10 0 0 1 20 0v8Z"/>{mode === '독식' && <path d="m12-7 4 4 4-5 4 5 4-4-2 7H14Z"/>}{mode === '나눔' && <><circle cx="6" cy="12" r="4"/><circle cx="34" cy="12" r="4"/><path d="M0 31V22a6 6 0 0 1 10-4 14 14 0 0 0-2 7v6Zm40 0V22a6 6 0 0 0-10-4 14 14 0 0 1 2 7v6Z"/></>}</svg>
}
function HazardIcon({ fail, prize }) {
  return <span className="exp-hazard-effect" aria-hidden="true">
    {fail ? <Icon name="book" size={22}/> : <Token kind={resourceKind(prize.kind)} value={prize.amount} small label={false} trim/>}
    <svg className="exp-cancel-mark" viewBox="0 0 30 24" fill="none"><path d={fail ? 'M5 3 25 21M25 3 5 21' : 'M3 21 27 3'} stroke="#fffaf0" strokeWidth="5"/><path d={fail ? 'M5 3 25 21M25 3 5 21' : 'M3 21 27 3'} stroke="currentColor" strokeWidth="2.5"/></svg>
  </span>
}

export default function LocationCard({ card }) {
  const warmToneId = useId()
  const type = explorationType(card)
  const distribution = card.interaction ? '교환' : card.distribution === 'first' ? '선착순' : card.distribution === 'all' ? '독식' : '나눔'
  const prizes = locationPrizes(card)
  const hasSpecial = Boolean(card.hazard)
  const scene = artwork[`../assets/exploration/${type.icon}-scene.png`]
  return <article className={'exp-place-front tier-' + card.tier} data-exp-card="location" data-exploration-type={type.name} data-distribution={card.distribution ?? 'choice'} style={{ '--exploration-color': type.color, '--exploration-paper': type.palette[0] }}>
    <div className="exp-place-hero">
      <div className={'exp-location-art-frame' + (type.artHue ? ' has-type-hue' : '')} style={{ '--scene-mask': `url("${scene}")` }}>
        <img className="exp-location-art" src={scene} alt="" draggable="false"/>
        {type.icon === 'scout' && <>
          <svg width="0" height="0" aria-hidden="true" className="exp-art-filter-defs"><defs><filter id={warmToneId} colorInterpolationFilters="sRGB">
            {/* Preserve ochre and neutral ink; tint only the cool blue background. */}
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  16 0 -16 0 1.8" result="warmMask"/>
            <feComposite in="SourceGraphic" in2="warmMask" operator="in"/>
          </filter></defs></svg>
          <img className="exp-location-art exp-location-warm-tones" src={scene} alt="" draggable="false" style={{ filter: `url(#${warmToneId})` }}/>
        </>}
      </div>
      <header className="exp-place-heading"><h3>{card.name}</h3><p>{card.interaction === 'barter' ? '먹을 것과 쓸 것을\n서로 바꿔 가져가자.' : card.interaction ? '우리와 맞는 동료가\n저 파티에 있을지도.' : type.flavor}</p></header>
      <div className="exp-type-seal"><img src={artwork[`../assets/exploration/${type.icon}-mark.png`]} alt="" draggable="false"/><b>{type.name}</b></div>
      <span className="exp-place-tier" aria-label={card.tier + '단계'}>{['Ⅰ', 'Ⅱ', 'Ⅲ'][card.tier - 1]}</span>
    </div>
    <div className="exp-condition">
      <div className={'exp-departure-grid' + (hasSpecial ? ' has-special' : '')}>
        <div className="exp-people-condition" title={'파견 인원 ' + (card.people ?? card.roles.length) + (card.interaction ? '명' : '명 이상')}><small>파견<br/>인원</small><div><b>{card.people ?? card.roles.length}</b>{!card.interaction && <sup>+</sup>}</div></div>
        <div className="exp-required-types" role="group" aria-label="출발 조건"><small className="exp-required-label">필요한 조건</small><div className="exp-required-items">
          {card.roles.map((role, i) => <TypeBadge key={i} type={role === '*' ? '무관' : role} label={role === '*' ? '무관' : role === '분위기메이커' ? '분위기' : role}/>)}
          {!card.roles.length && <TypeBadge type="무관"/>}
        </div>
        </div>
        {hasSpecial && <div className="exp-special-condition">
          {card.hazard && <span className="exp-hazard-print" role="img" aria-label={hazardText(card)} title={hazardText(card)}><TypeBadge type={card.hazard.type} label=""/><svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="m2.5 1.5 3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg><HazardIcon fail={card.hazard.effect === 'fail'} prize={prizes.at(-1)}/></span>}
        </div>}
      </div>
    </div>
    <footer className="exp-prize-print">
      <b className="exp-prize-label">보상</b>
      <div className="exp-reward-content" role="group" aria-label="보상">
        <div className="exp-printed-rewards" data-bundles={card.interaction ? 3 : prizes.length}>{card.interaction ? <>
          <span className="exp-exchange-print" role="img" aria-label={card.interaction === 'barter' ? '통조림 2개와 병뚜껑 2개 교환' : '생존자 한 명씩 교환'}>
            <Token kind={card.interaction === 'barter' ? 'can' : 'survivor'} value={card.interaction === 'barter' ? 2 : 1} small label={false} trim/><span>⇄</span><Token kind={card.interaction === 'barter' ? 'cap' : 'survivor'} value={card.interaction === 'barter' ? 2 : 1} small label={false} trim/>
          </span><span className="exp-trade-bonus" role="img" aria-label={'교환 성사 시 양쪽 병뚜껑 +' + prizes[0].amount}>+<Token kind="cap" value={prizes[0].amount} small label={false} trim/></span>
        </> : prizes.map(prize => <Token key={prize.id} kind={resourceKind(prize.kind)} value={prize.amount} small label={false} trim/>)}</div>
      </div>
      <div className="exp-printed-distribution" role="img" aria-label={distributionText(card)} title={distributionText(card)}><span className="exp-distribution-mark" data-mode={distribution}><b>{distribution}</b><DistributionIcon mode={distribution}/></span></div>
    </footer>
  </article>
}
