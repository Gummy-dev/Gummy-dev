import { Token } from '../../tabletop/Token.jsx'
import bottleCap from './bottle-cap.png'
import can from './can.png'
import clue from './clue.png'
import negotiate from './negotiate.png'
import score from './score.png'
import survivorFace from './survivor-face.png'
import sword from './sword.png'

const survivorIconModules = import.meta.glob('./survivors/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})

export const personalIcons = {
  bottleCap,
  can,
  clue,
  negotiate,
  score,
  survivor: survivorFace,
  sword,
}

export const survivorIconsById = Object.fromEntries(
  Object.entries(survivorIconModules).map(([path, src]) => {
    const id = path.split('/').pop()?.replace(/\.png$/, '')
    return [id, src]
  }).filter(([id]) => Boolean(id))
)

export function getSurvivorImageSrc(survivor) {
  return survivorIconsById[survivor?.id] ?? survivor?.image ?? personalIcons.survivor
}

export function PersonalIcon({ name, alt = '', className = '', title }) {
  if (name === 'bottleCap') return <span className={`legacy-token-icon ${className}`} role="img" aria-label={alt || '병뚜껑'} title={title}><Token kind="cap" label={false} /></span>
  const src = personalIcons[name]
  if (!src) return null

  return (
    <img
      src={src}
      alt={alt}
      title={title}
      className={['inline-block object-contain align-middle leading-none', className].filter(Boolean).join(' ')}
      draggable="false"
    />
  )
}

// EventZone TYPE_TAG_META / PartySlot TYPE_HINT_BADGE_COLOR 와 동일한 스타일
const INLINE_TYPE_BADGE = {
  반: 'border-blue-500/70 bg-blue-900/70 text-blue-100',
  용: 'border-green-500/70 bg-green-900/70 text-green-100',
  분: 'border-pink-500/70 bg-pink-900/70 text-pink-100',
  겁: 'border-purple-500/70 bg-purple-900/70 text-purple-100',
  '4': 'border-yellow-500/70 bg-yellow-900/70 text-yellow-100',
}

function SurvivorSilhouette({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-label="생존자">
      <circle cx="10" cy="6" r="5" />
      <path d="M1 20c0-4.97 4.03-9 9-9s9 4.03 9 9H1z" />
    </svg>
  )
}

export function RichText({ text }) {
  const segments = String(text ?? '').split(/(\{[^}]+\})/g)
  let dim = false
  return (
    <>
      {segments.map((seg, i) => {
        if (seg === '{dim}') { dim = true; return null }
        if (seg === '{/dim}') { dim = false; return null }
        if (!seg.startsWith('{') || !seg.endsWith('}')) {
          return dim ? <span key={i} className="text-gray-500">{seg}</span> : seg
        }
        const token = seg.slice(1, -1)
        if (INLINE_TYPE_BADGE[token]) {
          return (
            <span key={i} className={`inline-flex items-center justify-center rounded-full border w-[14px] h-[14px] text-[7px] font-black leading-none mx-px align-middle ${INLINE_TYPE_BADGE[token]}`}>
              {token}
            </span>
          )
        }
        if (token === 'sv') {
          return <SurvivorSilhouette key={i} className="inline h-[11px] w-[11px] align-middle mx-px text-gray-300" />
        }
        return seg
      })}
    </>
  )
}

export function SurvivorImage({ survivor, className = '', title }) {
  return (
    <img
      src={getSurvivorImageSrc(survivor)}
      alt={survivor?.name ?? '생존자'}
      title={title ?? survivor?.name}
      className={['inline-block object-contain align-middle leading-none', className].filter(Boolean).join(' ')}
      draggable="false"
    />
  )
}
