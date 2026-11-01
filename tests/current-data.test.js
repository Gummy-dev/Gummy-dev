import test from 'node:test'
import assert from 'node:assert/strict'
import { TYPES, TYPE_COLORS, TYPE_PAPER_COLORS } from '../src/game/types.js'
import { TYPES as expeditionTypes, SURVIVOR_CARDS } from '../src/expedition/cards.js'
import { TYPES as archivedTypes } from '../src/game/cards.js'
import { EVENT_CARDS } from '../src/expedition/events.js'

test('current cards and shared badges use the same type vocabulary and complete colors', () => {
  assert.equal(expeditionTypes, TYPES)
  assert.equal(archivedTypes, TYPES)
  assert.equal(new Set(TYPES).size, 5)
  for (const colors of [TYPE_COLORS, TYPE_PAPER_COLORS]) {
    assert.equal(colors.length, TYPES.length)
    assert.ok(colors.every(color => /^#[0-9a-f]{6}$/i.test(color)))
  }
  assert.ok(SURVIVOR_CARDS.every(card => TYPES.includes(card.type)))
  assert.ok(EVENT_CARDS.every(card => card.types.every(type => TYPES.includes(type))))
})
