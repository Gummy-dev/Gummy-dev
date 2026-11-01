import { TYPES, TYPE_COLORS } from '../game/cards.js'
import { survivorIconsById } from '../assets/personal-icons/index.jsx'

export function Icon({ name, size = 22, ...props }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    people: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v3"/></>,
    link: <><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    camp: <><path d="m3 20 9-17 9 17H3Zm5 0 4-8 4 8M9 3l3 5 3-5"/></>,
    dice: <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01" strokeWidth="3"/></>,
    cards: <><rect x="8" y="5" width="12" height="16" rx="2"/><path d="M15 2H6a2 2 0 0 0-2 2v12"/></>,
    book: <><path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16"/></>,
    refresh: <><path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5"/></>,
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.camp}</svg>
}
export { Token } from './Token.jsx'
export function TypeBadge({ type, iconOnly = false, label = type }) {
  return <span className={'type-badge' + (iconOnly ? ' type-badge-symbol' : '')} data-type={type} title={iconOnly ? type : undefined} aria-label={iconOnly ? type : undefined} style={{ '--type-color': TYPE_COLORS[TYPES.indexOf(type)] ?? '#7b7b70' }}><span aria-hidden="true">{(iconOnly ? { 무관: '무관', 겁쟁이: '겁', 분위기메이커: '분', 반장: '반', 용감이: '용', '4차원': '4' } : { 무관: '—', 겁쟁이: '●', 분위기메이커: '✿', 반장: '■', 용감이: '▲', '4차원': '◆' })[type]}</span>{!iconOnly && label}</span>
}
export function Portrait({ card, className = '' }) {
  return <img className={`portrait ${className}`} src={survivorIconsById[card.art] ?? survivorIconsById.s_normal_1} alt={card.name} draggable="false" />
}
export function Scene({ tier = 1, variant = 0, utopia = false, palette: suppliedPalette, fill = false }) {
  const palette = suppliedPalette ?? (utopia ? ['#f2dca5', '#bdc685', '#667d51'] : tier === 1 ? ['#dce5bb', '#a9b888', '#657f62'] : tier === 2 ? ['#bed9d4', '#8ead9c', '#4e7975'] : ['#dbd0dd', '#b7a7bc', '#776981'])
  return <svg className="scene" viewBox="0 0 320 170" preserveAspectRatio={fill ? 'xMidYMax slice' : undefined} aria-hidden="true">
    <rect width="320" height="170" fill={palette[0]}/><circle cx={utopia ? 160 : 258} cy="45" r={utopia ? 35 : 24} fill="#f5cf77"/>
    <path d="M0 92Q50 38 100 90T210 71T320 91V170H0Z" fill={palette[1]}/>
    {utopia ? <><path d="M117 154V69h86v85M130 68V45h60v23" fill="#f3ecd1" stroke={palette[2]} strokeWidth="4"/><path d="M142 154V91a18 18 0 0 1 36 0v63" fill={palette[2]}/><path d="m157 48 6-11 6 11-6 10Z" fill="#db9657"/><path d="m72 145 18-63 20 63m105 0 21-64 20 64" fill={palette[2]}/></>
    : variant % 3 === 0 ? <><path d="M43 142V82l42-29 44 29v60" fill="#f0e4c6" stroke={palette[2]} strokeWidth="3"/><path d="m33 86 51-40 55 40" fill="none" stroke={palette[2]} strokeWidth="7"/><path d="M62 104h17v20H62m25-20h17v38H87" fill={palette[2]}/><path d="M184 140V66h66v74m-57-51h12m17 0h12m-41 21h12m17 0h12" fill="#e9dec3" stroke={palette[2]} strokeWidth="5"/><path d="m174 66 42-21 42 21Z" fill={palette[2]}/></>
    : variant % 3 === 1 ? <><path d="M45 142V77h72v65m36 0V43h42v99m21 0V69h58v73" fill={palette[2]}/><path d="M54 90h18m16 0h18m-52 21h18m16 0h18m53-53h12m-12 18h12m-12 18h12m43-13h14m-14 19h14m-14 19h14" stroke="#e7dfbd" strokeWidth="8"/><path d="m175 39 5-22m-6 11h13" stroke={palette[2]} strokeWidth="3"/></>
    : <><path d="M72 144V91l48-40 47 40v53M72 92h95m-95 25h95m-66-45v72m32-77v77" fill="#e6e9bc" stroke={palette[2]} strokeWidth="4"/><path d="M200 140v-36m0 13q-30-37-25-11 9 18 25 20m0-11q28-39 26-11-7 20-26 26" fill={palette[2]} stroke={palette[2]} strokeWidth="3"/><path d="m250 145 17-46 17 46Z" fill={palette[2]}/></>}
    <path d="M0 145q65-19 143-1t177-3v29H0Z" fill={palette[2]}/><path d="m134 170 20-30h17l26 30" fill="#e8dab5"/><path d="M21 28h22m-13 6h21M236 19h33" stroke="#fff5db" strokeWidth="4" strokeLinecap="round"/>
  </svg>
}
export function Die({ value }) {
  const spots = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  return <span className="die" aria-label={`주사위 ${value}`}><span className="die-grid">{Array.from({ length: 9 }, (_, i) => <i key={i} className={spots[value]?.includes(i) ? 'pip' : ''}/>)}</span></span>
}
