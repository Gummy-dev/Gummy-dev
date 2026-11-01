import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Die, Icon, Token } from '../tabletop/Visuals.jsx'

export function CardMenu({ anchor, viewport, title, close, children, zoom, keyboard }) {
  const ref = useRef(null), dismissMenu = useRef(close)
  dismissMenu.current = close
  useLayoutEffect(() => {
    const menu = ref.current, view = viewport.current
    if (!anchor?.isConnected || !menu || !view) return
    function position() {
      const card = anchor.getBoundingClientRect(), bounds = view.getBoundingClientRect()
      const w = menu.offsetWidth, h = menu.offsetHeight, gap = 12
      const right = card.right + gap
      const x = right + w <= bounds.right - gap ? right : card.left - w - gap
      menu.style.left = Math.max(bounds.left + gap, Math.min(x, bounds.right - w - gap)) + 'px'
      menu.style.top = Math.max(bounds.top + gap, Math.min(card.top, bounds.bottom - h - gap)) + 'px'
      menu.style.visibility = card.bottom < bounds.top || card.top > bounds.bottom || card.right < bounds.left || card.left > bounds.right ? 'hidden' : 'visible'
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(menu); observer.observe(anchor); observer.observe(view)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [anchor, viewport, zoom, children])
  useEffect(() => {
    function dismiss(e) {
      if (e.type === 'keydown') {
        if (e.key !== 'Escape') return
        e.preventDefault(); dismissMenu.current(); anchor?.focus({ preventScroll: true })
      } else if (!ref.current?.contains(e.target) && !e.target.closest('.exp-card-button,.exp-place-button,[data-context-trigger]')) dismissMenu.current()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    if (keyboard) ref.current?.querySelector('.exp-card-menu-content button:not([disabled])')?.focus({ preventScroll: true })
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [anchor, keyboard])
  return createPortal(<section ref={ref} className="exp-card-menu" role="dialog" aria-label={title}>
    <header><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="카드 행동 닫기"><Icon name="close" size={18}/></button></header>
    <div className="exp-card-menu-content">{children}</div>
  </section>, document.body)
}

export function GainToasts({ game, roomCode }) {
  const seen = useRef({ room: roomCode, id: game.noticeSeq ?? 0 }), [toasts, setToasts] = useState([])
  useEffect(() => {
    if (seen.current.room !== roomCode) { seen.current = { room: roomCode, id: game.noticeSeq ?? 0 }; setToasts([]); return }
    const fresh = (game.notices ?? []).filter(n => n.id > seen.current.id)
    seen.current.id = game.noticeSeq ?? seen.current.id
    if (!fresh.length) return
    const grouped = []
    for (const notice of fresh) {
      const previous = grouped.find(n => n.owner === notice.owner)
      if (previous) { previous.items.push(...notice.items); if (!previous.sources.includes(notice.source)) previous.sources.push(notice.source) }
      else grouped.push({ ...notice, sources: [notice.source], items: [...notice.items], expires: Date.now() + 5000 })
    }
    setToasts(old => [...old, ...grouped].slice(-4))
  }, [game.notices, game.noticeSeq, roomCode])
  useEffect(() => {
    if (!toasts.length) return
    const timer = setTimeout(() => setToasts(old => old.filter(n => n.expires > Date.now())), Math.max(0, Math.min(...toasts.map(n => n.expires)) - Date.now()))
    return () => clearTimeout(timer)
  }, [toasts])
  return createPortal(<div className="exp-gain-toasts" role="status" aria-live="polite" aria-atomic="false">{toasts.map(n => {
    const p = game.players.find(p => p.seatId === n.owner)
    return <div className="exp-gain-toast" key={n.id} style={{ '--pawn': p.color }} data-gain-id={n.id}>
      <div><b>{p.name} · {n.sources.join(' / ')}</b><div className="exp-gain-items">{n.items.map((item, i) => item.kind === 'utopiaDie' ? <span key={i}><Die value={item.value}/>유토피아 +{item.value}</span> : item.kind === 'survivor' ? <span key={i}><Icon name="people" size={20}/>{item.name} {item.amount > 1 ? '+' + item.amount : '합류'}</span> : <Token key={i} kind={item.kind === 'bottleCap' ? 'cap' : item.kind === 'route' ? 'clue' : item.kind} value={'+' + item.amount} small/>)}</div></div>
      <button className="icon-button" aria-label="획득 알림 닫기" onClick={() => setToasts(old => old.filter(x => x.id !== n.id))}><Icon name="close" size={16}/></button>
    </div>
  })}</div>, document.body)
}
