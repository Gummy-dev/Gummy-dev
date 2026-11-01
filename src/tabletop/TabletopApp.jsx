import { Suspense, useEffect, useRef, useState } from 'react'
import { editionConfig } from './editionConfig.jsx'
import './expedition-base.css'
import { useRoom } from './useRoom.js'
import { CURRENT_EDITION, editionPath } from './editions.js'
import { Die, Icon, Portrait, Scene, Token, TypeBadge } from './Visuals.jsx'

function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close() }, [])
  return <dialog className={`paper-dialog ${wide ? 'dialog-wide' : ''}`} ref={ref} onCancel={e => { e.preventDefault(); onClose?.() }} aria-labelledby="dialog-title">
    <header><h2 id="dialog-title">{title}</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="close"/></button>}</header>{children}
  </dialog>
}

function Rules({ onClose, config }) {
  const Content = config.Rules
  return <Modal title="떠나기 전에, 딱 이것만" onClose={onClose}><Content/></Modal>
}

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'brand-small' : ''}`}><span className="brand-mark"><Icon name="camp" size={compact ? 24 : 28}/></span><span>멸망했는데 <em>바쁨!</em></span></div>
}

function Entry({ api, config }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') ?? '')
  const [joining, setJoining] = useState(Boolean(code))
  return <main className="entry-page">
    <nav className="entry-nav"><Brand compact/><div className="exp-edition-switch"><span>{config.label}</span>{config.archived && <a href="/expedition">현재 판 보기</a>}</div></nav>
    <div className="entry-layout">
      <section className="entry-copy">
        <span className="sticker sticker-yellow">세상은 끝났고, 할 일은 쌓였다.</span>
        <h1>멸망했는데<br/><span>바쁨!</span><i aria-hidden="true">*</i></h1>
        <p className="hero-description">먹을 것 챙기랴, 이상한 동료 돌보랴.<br/>우리, 유토피아에는 언제 가요?</p>
        <div className="entry-facts"><span><Icon name="people"/>2–4명</span><span><Icon name="dice"/>탐색 · 수집 · 생존</span><span>단서를 따라 유토피아로</span></div>
        <form className="entry-form" onSubmit={e => { e.preventDefault(); api.enter(name, joining ? code : null) }}>
          <div className="entry-tabs"><button type="button" aria-pressed={!joining} onClick={() => setJoining(false)}>새 테이블 열기</button><button type="button" aria-pressed={joining} onClick={() => setJoining(true)}>친구의 방에 합류</button></div>
          <label>생존자 이름<input value={name} maxLength={16} required placeholder="어떻게 불러 드릴까요?" onChange={e => setName(e.target.value)} autoComplete="nickname"/></label>
          {joining && <label>초대 코드<input className="code-input" value={code} maxLength={6} minLength={6} required placeholder="ABC123" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}/></label>}
          <button className="primary-button" disabled={api.busy}>{api.busy ? '테이블 준비 중…' : joining ? '빈자리에 앉기' : '친구들과 시작하기'}<Icon name="arrow"/></button>
          {!joining && <button type="button" className="text-button practice-button" disabled={api.busy} onClick={() => api.enter(name.trim() || '나', null, true)}>먼저 혼자 연습해 볼래요 <span>봇 2명과 바로 시작</span></button>}
          {api.error && <p className="error-note" role="alert">{api.error}</p>}
        </form>
      </section>
      <section className="entry-art" aria-label="탐험 지도와 생존자 카드">
        <div className="hero-map"><div className="map-grid"/><span className="map-caption">유토피아로 가는 길<br/><small>아마 이쪽인 것 같다.</small></span><Scene tier={2} variant={0}/><svg className="hero-trail" viewBox="0 0 400 200" aria-hidden="true"><path d="M35 166C60 100 155 185 157 98S299 133 350 30"/></svg><span className="map-x">×</span></div>
        <div className="hero-survivor hero-cat"><span className="card-overline">SURVIVOR NO. 006</span><Portrait card={{ art: 's_coward_1', name: '고양이' }}/><TypeBadge type="겁쟁이"/><strong>고양이</strong><p>밥은 먹고 출발하자.</p></div>
        <div className="hero-survivor hero-duck"><span className="card-overline">SURVIVOR NO. 004</span><Portrait card={{ art: 's_weird_1', name: '오리교도' }}/><TypeBadge type="4차원"/><strong>오리교도</strong><p>일단 꽥 하고 보자.</p></div>
        <div className="hero-tokens"><Token kind="can" value="4" label={false}/><Token kind="cap" value="3" label={false}/><Die value={5}/></div>
        <div className="scribble-note">이 멤버로…<br/>살아남을 수 있을까?</div>
      </section>
    </div>
    <footer className="entry-footer"><span>귀여운 동료들. 수상한 계획. 제법 바쁜 멸망.</span><span>종말 이후의 작은 보드게임</span></footer>
  </main>
}

function Lobby({ api, copyInvite, config }) {
  const { room, command, busy, connected } = api
  const leaders = config.leaders
  const me = room.seats.find(s => s.id === room.me)
  const mine = leaders.find(l => l.id === me.leaderId)
  const configure = change => command({ type: 'configure', leaderId: me.leaderId, starters: me.starters, ready: false, ...change })
  return <main className="lobby-page">
    <div className="lobby-heading"><div><span className="eyebrow">SURVIVORS WANTED</span><h1>같이 갈 사람?</h1><p>{config.intro}</p></div><button className="invite-ticket" onClick={copyInvite}><span>친구 초대 코드</span><strong>{room.code}</strong><small><Icon name="link" size={16}/> 눌러서 초대 링크 복사</small></button></div>
    <div className="seats-row">{Array.from({ length: 4 }, (_, i) => {
      const s = room.seats[i], l = leaders.find(l => l.id === s?.leaderId)
      return <div key={i} className={`seat-ticket ${s?.id === me.id ? 'seat-me' : ''}`}>{s ? <><Portrait card={{ ...l, name: s.name }}/><div><strong>{s.name}{s.id === me.id && ' · 나'}</strong><small>{s.bot ? '연습 상대' : s.connected ? s.ready ? '출발 준비 완료' : '짐 챙기는 중' : '연결 대기'}</small></div>{s.ready && <Icon name="check"/>}{room.host === me.id && s.id !== me.id && <button className="icon-button" onClick={() => command({ type: 'removeSeat', id: s.id })} aria-label={`${s.name} 자리 비우기`} disabled={busy}><Icon name="close" size={17}/></button>}</> : <><Icon name="people"/><span>친구를 기다리는 자리</span></>}</div>
    })}</div>
    <div className="section-heading"><h2>누가 앞장설까요?</h2><span>지도자마다 다른 생존 방식</span></div>
    <div className="leader-grid">{leaders.map(l => {
      const occupied = room.seats.some(s => s.id !== me.id && s.leaderId === l.id)
      return <button key={l.id} className={`leader-card ${me.leaderId === l.id ? 'chosen' : ''}`} disabled={busy || occupied || !connected} aria-pressed={me.leaderId === l.id} onClick={() => configure({ leaderId: l.id })}><div className="leader-picture"><Portrait card={l}/>{occupied && <span className="occupied-stamp">합류 완료</span>}</div><TypeBadge type={l.type}/><h3>{l.name}</h3><span className="leader-title">{l.title}</span><p>{l.skill}</p><span className="leader-goal">꿈꾸는 곳 · {l.utopia}</span></button>
    })}</div>

    {config.starters && <div className="exp-starter-picks"><b>함께 출발할 기본 동료 · 2명 선택</b>{config.types.map((type, i) => <button key={type} aria-pressed={me.starters.includes(i)} disabled={busy || !connected} onClick={() => configure({ starters: me.starters.includes(i) ? me.starters : [me.starters[1], i] })}><TypeBadge type={type}/></button>)}</div>}
    <div className="lobby-controls">{room.host === me.id && room.seats.length < 4 && <button className="secondary-button" onClick={() => command({ type: 'addBot' })} disabled={busy || !connected}>빈자리에 연습 봇 초대</button>}<button className={me.ready ? 'secondary-button' : 'primary-button'} onClick={() => configure({ ready: !me.ready })} disabled={busy || !connected}>{me.ready ? '준비 취소' : '짐 다 챙겼어요'}<Icon name="check"/></button>{room.host === me.id && <button className="primary-button" disabled={busy || !connected || room.seats.length < 2 || !room.seats.every(s => s.ready && (s.connected || s.bot))} onClick={() => command({ type: 'start' })}>탐험 시작<Icon name="arrow"/></button>}</div>
  </main>
}

export default function TabletopApp({ edition = CURRENT_EDITION }) {
  const api = useRoom(edition)
  const selectedVersion = api.room?.rulesVersion ?? edition
  const config = editionConfig(selectedVersion), Board = config.Board
  const [rules, setRules] = useState(false)
  const [copied, setCopied] = useState(false)
  async function copyInvite() {
    const url = `${location.origin}${editionPath(selectedVersion)}?room=${api.room.code}`
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500) }
    catch { api.setError(`친구에게 이 주소를 보내 주세요: ${url}`) }
  }
  return <Suspense fallback={<div className="connecting-screen">테이블을 준비하는 중입니다…</div>}><div className="tabletop-app"><a className="skip-link" href="#main-content">본문으로 이동</a>{api.room && <header className="app-header"><Brand compact/><div className="header-actions">{api.room.seats.find(s => s.id === api.room.host)?.connected === false && api.room.host !== api.room.me && <button className="text-button" disabled={api.busy} onClick={() => api.command({ type: 'claimHost' })}>방장 이어받기</button>}<span className={`connection-label ${api.connected ? 'online' : ''}`}><i/>{api.connected ? '테이블 연결됨' : '다시 연결 중…'}</span><button className="room-code" onClick={copyInvite}><Icon name="link" size={15}/>{copied ? '복사했어요!' : api.room.code}</button><button className="icon-button" onClick={() => setRules(true)} aria-label="게임 방법"><Icon name="book"/></button></div></header>}{api.room && !api.connected && <div className="connection-warning" role="status">연결을 복구하는 중입니다. 내 자리와 게임 진행은 유지됩니다.</div>}<div id="main-content">{api.room ? api.room.game ? <Board api={api}/> : <Lobby api={api} copyInvite={copyInvite} config={config}/> : api.credentials ? <div className="connecting-screen"><Brand/><p>내 자리를 찾는 중입니다…</p><button className="secondary-button" onClick={api.exit}>처음 화면으로</button></div> : <Entry api={api} config={config}/>}</div>{api.room && api.error && <div className="error-toast" role="alert"><span>{api.error}</span><button className="icon-button" aria-label="알림 닫기" onClick={() => api.setError('')}><Icon name="close" size={18}/></button></div>}{!api.room && <button className="entry-rules-button" onClick={() => setRules(true)}><Icon name="book" size={18}/>게임 방법</button>}{rules && <Rules onClose={() => setRules(false)} config={config}/>}</div></Suspense>
}
