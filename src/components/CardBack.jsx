import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../tabletop/Visuals.jsx'

export default function CardBack({ tier = 1, kind = '주변 탐색', title = `${tier}단계`, subtitle, count, pile = false, message }) {
  const dialog = useRef(null)
  const guide = message ?? (tier > 1
    ? `${tier - 1}단계 단서를 처음 얻으면 ${tier}단계 카드가 모두에게 공개됩니다. 이곳에 진입하려면 내 파티도 ${tier - 1}단계 단서를 확보해야 합니다.`
    : '공개된 카드를 선택해 내용을 확인하세요. 탐색은 행동 단계에, 생존자 영입은 파티 정비 단계에 진행합니다.')
  return <>
    <button type="button" data-board-card="back" className={`card-stack card-back tier-${tier}${pile ? '' : ' single-card-back'}`} aria-label={`${kind} ${title} 안내`} onClick={event => { event.stopPropagation(); dialog.current.showModal() }}>
      <span className="stack-card"><span className="stack-corner">{kind}</span><span className="deck-emblem"><Icon name={kind === '생존자 수색' ? 'people' : kind === '유토피아' ? 'camp' : 'book'} size={40} /></span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span>
      {count != null && <span className="deck-count">{count}장</span>}
    </button>
    {createPortal(<dialog ref={dialog} className="paper-dialog card-back-dialog" aria-label={`${kind} 안내`} onClick={event => { if (event.target === event.currentTarget) dialog.current.close() }}>
      <header><h2>{kind} · {title}</h2><button type="button" className="icon-button" aria-label="닫기" onClick={() => dialog.current.close()}>×</button></header>
      <p>{guide}</p>
      <button type="button" className="primary-button" onClick={() => dialog.current.close()}>확인</button>
    </dialog>, document.body)}
  </>
}
