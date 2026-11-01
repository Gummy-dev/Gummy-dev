export function Token({ kind, value, label = true, small = false, trim = false }) {
  const names = { can: '통조림', cap: '병뚜껑', clue: '단서', survivor: '생존자', score: '점수', action: '행동' }
  const printedBounds = { can: '6 3 20 28', cap: '1 1 30 30', clue: '2 3 28 27', survivor: '4 2 24 29' }
  return <span className={`token token-${kind} ${small ? 'token-small' : ''}`} title={names[kind]}>
    <svg viewBox={(trim && printedBounds[kind]) || '0 0 32 32'} aria-hidden="true">
      {kind === 'can' ? <><path d="M7 8h18v18c0 5-18 5-18 0Z" fill="#d97855" stroke="#743c31" strokeWidth="1.7"/><ellipse cx="16" cy="8" rx="9" ry="4" fill="#f4eee0" stroke="#743c31" strokeWidth="1.7"/><path d="M11 17h10m-10 4h10" stroke="#fff3d9" strokeWidth="2"/><path d="M13 7h6l-3 3Z" fill="#8c9b8c"/></>
      : kind === 'cap' ? <><path d="m16 2 3 3 4-1 1 4 4 1-1 4 3 3-3 3 1 4-4 1-1 4-4-1-3 3-3-3-4 1-1-4-4-1 1-4-3-3 3-3-1-4 4-1 1-4 4 1Z" fill="#eab94c" stroke="#80612b" strokeWidth="1.5"/><circle cx="16" cy="16" r="7" fill="none" stroke="#fff0ba" strokeWidth="2"/><path d="m13 18 6-5m-6 0 6 5" stroke="#80612b" strokeWidth="1.5"/></>
      : kind === 'clue' ? <><path d="m3 7 8-3 10 3 8-3v22l-8 3-10-3-8 3Z" fill="#81b9b0" stroke="#2d6764" strokeWidth="1.5"/><path d="M11 4v22M21 7v22" stroke="#e7f2df"/><path d="m7 20 5-6 6 3 7-7m-3 0h3v3" fill="none" stroke="#2d6764" strokeWidth="2" strokeDasharray="2 1"/></>
      : kind === 'survivor' ? <><path d="m8 3 19 3-3 24-19-3Z" fill="#fff4d9" stroke="#786b52" strokeWidth="1.5"/><circle cx="16" cy="12" r="4" fill="#778875"/><path d="M8 24a8 8 0 0 1 16 0Z" fill="#778875"/></>
      : kind === 'score' ? <path d="m16 2 4 9 10 1-7 7 2 11-9-5-9 5 2-11-7-7 10-1Z" fill="#a798bb" stroke="#615073" strokeWidth="1.7"/>
      : <><circle cx="16" cy="16" r="13" fill="#e8e0c9" stroke="#586347" strokeWidth="2"/><path d="m18 5-9 13h7l-2 9 10-15h-8Z" fill="#647949"/></>}
    </svg><span className="token-number">{value}</span>{label && <span className="token-label">{names[kind]}</span>}
  </span>
}
