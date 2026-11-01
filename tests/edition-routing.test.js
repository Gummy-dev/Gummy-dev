import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { CURRENT_EDITION, editionForPath, editionPath, seatStorageKey } from '../src/tabletop/editions.js'
import { useRoom } from '../src/tabletop/useRoom.js'

test('root opens the current prototype; archived games and invite paths stay distinct', () => {
  assert.equal(editionForPath('/'), CURRENT_EDITION)
  assert.equal(editionForPath('/expedition'), CURRENT_EDITION)
  for (const edition of [CURRENT_EDITION, 'original-v2', 'expedition-v1']) {
    assert.equal(editionForPath(editionPath(edition)), edition)
  }
  assert.notEqual(editionPath('original-v2'), '/')
  assert.notEqual(seatStorageKey(CURRENT_EDITION), seatStorageKey('original-v2'))
})

test('current multiplayer ignores archived seats and another saved room cannot override an invitation', t => {
  const previousStorage = globalThis.localStorage, previousLocation = globalThis.location
  t.after(() => {
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage
    if (previousLocation === undefined) delete globalThis.location; else globalThis.location = previousLocation
  })
  const archive = { code: 'OLDABC', token: 'archive-seat' }, current = { code: 'NEWABC', token: 'current-seat' }
  const entries = new Map([[seatStorageKey('original-v2'), JSON.stringify(archive)]])
  globalThis.localStorage = { getItem: key => entries.get(key) ?? null }
  globalThis.location = { search: '' }
  let credentials
  function Probe({ edition }) { credentials = useRoom(edition).credentials; return null }
  renderToString(createElement(Probe))
  assert.equal(credentials, null)
  renderToString(createElement(Probe, { edition: 'original-v2' }))
  assert.deepEqual(credentials, archive)
  entries.set(seatStorageKey(CURRENT_EDITION), JSON.stringify(current))
  globalThis.location.search = '?room=FRIEND'
  renderToString(createElement(Probe))
  assert.equal(credentials, null)
  globalThis.location.search = '?room=NEWABC'
  renderToString(createElement(Probe))
  assert.deepEqual(credentials, current)
})
