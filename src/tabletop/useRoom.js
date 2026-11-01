import { useCallback, useEffect, useRef, useState } from 'react'
import { CURRENT_EDITION, seatStorageKey } from './editions.js'

function savedSeat(storageKey) {
  try {
    const seat = JSON.parse(localStorage.getItem(storageKey)), invited = new URLSearchParams(location.search).get('room')?.toUpperCase()
    return invited && seat?.code !== invited ? null : seat
  } catch { return null }
}
export function useRoom(rulesVersion = CURRENT_EDITION) {
  const storageKey = seatStorageKey(rulesVersion)
  const [credentials, setCredentials] = useState(() => savedSeat(storageKey))
  const [room, setRoom] = useState(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const current = useRef(null); current.current = room
  const receive = useCallback(next => {
    if (next.rulesVersion !== rulesVersion) {
      const saved = localStorage.getItem(storageKey)
      if (saved) localStorage.setItem(seatStorageKey(next.rulesVersion), saved)
      localStorage.removeItem(storageKey); setCredentials(null); setRoom(null)
      setError('저장된 방은 다른 버전입니다. 현재 판에서 새 테이블을 열거나 현재 판의 방 코드를 입력하세요.')
      return
    }
    setRoom(previous => !previous || previous.code !== next.code || next.revision >= previous.revision ? next : previous)
  }, [rulesVersion, storageKey])
  useEffect(() => {
    if (!credentials) return
    let disposed = false
    const base = `/api/rooms/${credentials.code}`
    fetch(base, { headers: { Authorization: `Bearer ${credentials.token}` } }).then(async res => {
      const data = await res.json()
      if (disposed) return
      if (!res.ok) { setError(data.error); if ([401, 404].includes(res.status)) { setCredentials(null); localStorage.removeItem(storageKey); setRoom(null) } }
      else receive(data.room)
    }).catch(() => { if (!disposed) setError('서버에 연결하지 못했습니다. 연결되면 자동으로 돌아옵니다.') })
    const stream = new EventSource(`${base}/stream?token=${encodeURIComponent(credentials.token)}`)
    stream.onopen = () => { setConnected(true); setError('') }
    stream.onmessage = event => { if (!disposed) receive(JSON.parse(event.data)) }
    stream.addEventListener('removed', () => { stream.close(); setCredentials(null); setRoom(null); localStorage.removeItem(storageKey); setError('방장이 자리를 정리했습니다. 다른 테이블에 합류할 수 있어요.') })
    stream.onerror = () => { if (!disposed) setConnected(false) }
    return () => { disposed = true; stream.close(); setConnected(false) }
  }, [credentials, receive, storageKey])

  async function enter(name, code, practice = false) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try {
      const res = await fetch(code ? `/api/rooms/${code.trim().toUpperCase()}/join` : '/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, practice, rulesVersion }) })
      const data = await res.json(); if (!res.ok) throw new Error(data.error)
      const seat = { code: data.room.code, token: data.token }
      localStorage.setItem(storageKey, JSON.stringify(seat)); setCredentials(seat); receive(data.room)
      history.replaceState({}, '', `${location.pathname}?room=${data.room.code}`)
    } catch (e) { setError(e.message || '방에 연결하지 못했습니다.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  async function command(action) {
    if (inFlight.current || !credentials || !current.current) return false
    inFlight.current = true; setBusy(true); setError('')
    try {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const res = await fetch(`/api/rooms/${credentials.code}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.token}` }, body: JSON.stringify({ revision: current.current.revision, requestId, command: action }) })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          const fresh = await fetch(`/api/rooms/${credentials.code}`, { headers: { Authorization: `Bearer ${credentials.token}` } }); const value = await fresh.json(); if (value.room) receive(value.room)
        }
        throw new Error(data.error)
      }
      receive(data.room); return true
    } catch (e) { setError(e.message || '행동을 보내지 못했습니다. 연결을 확인하세요.'); return false }
    finally { inFlight.current = false; setBusy(false) }
  }
  function exit() { localStorage.removeItem(storageKey); setCredentials(null); setRoom(null); setError(''); history.replaceState({}, '', location.pathname) }
  return { room, credentials, connected, busy, error, setError, enter, command, exit }
}
