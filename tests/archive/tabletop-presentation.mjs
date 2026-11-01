// Historical browser scenario; fixtures and selectors require review against current rules before use.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:5173')
  // Render the real board with the original store; no running room is modified.
  await page.evaluate(async () => {
    const React = await import('/node_modules/.vite/deps/react.js')
    const DOM = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { useGameStore } = await import('/src/store/gameStore.js')
    const { default: GameBoard } = await import('/src/components/GameBoard.jsx')
    useGameStore.setState({ playerCount: 2, playerConfigs: [{ leaderId: 'shy', isBot: false }, { leaderId: 'robot', isBot: false }] })
    useGameStore.getState().startGame()
    const node = document.createElement('div'); document.body.replaceChildren(node)
    DOM.default.createRoot(node).render(React.default.createElement(GameBoard, { myIndex: 0 }))
  })
  await page.locator('.restored-event-tier').last().waitFor()
  assert.equal(await page.locator('.restored-event-tier').nth(0).locator('.single-card-back').count(), 4) // 3 events + Utopia
  assert.equal(await page.locator('.restored-event-tier').nth(1).locator('.single-card-back').count(), 4)
  assert.equal(await page.locator('.restored-search-tier .single-card-back').count(), 2)
  assert.equal(await page.locator('.restored-event-tier .printed-empty-slot').count(), 0)
  assert.equal(await page.locator('.restored-board-surface').getByText(/이전 단계 단서 확보시/).count(), 0)
  await page.locator('.restored-event-tier').nth(1).locator('.single-card-back').first().click()
  await page.locator('dialog[open]').waitFor()
  assert.match(await page.locator('dialog[open]').innerText(), /1단계 단서.*2단계 카드/s)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('dialog[open]').count(), 0)
  await page.locator('.restored-search-tier .single-card-back').first().click()
  await page.locator('dialog[open] button').filter({ hasText: '확인' }).click()
  const rows = await page.evaluate(() => [...document.querySelectorAll('.restored-event-tier')].map((e, i) => {
    const s = document.querySelectorAll('.restored-search-tier')[i]
    return { height: e.offsetHeight, dy: Math.abs(e.getBoundingClientRect().top - s.getBoundingClientRect().top), background: getComputedStyle(s).backgroundColor, border: getComputedStyle(s).borderTopWidth }
  }))
  assert.ok(rows.every(r => r.height < 350 && r.dy < 2 && r.background === 'rgba(0, 0, 0, 0)' && r.border === '0px'))
  assert.ok(await page.locator('.restored-resource-pouch .token-cap svg').count() > 0)
  // Shared reveal changes backs to fronts, even for a party without access.
  await page.evaluate(async () => {
    const { useGameStore } = await import('/src/store/gameStore.js')
    const s = useGameStore.getState()
    useGameStore.setState({ players: s.players.map((p, i) => i === 1 ? { ...p, unlockedExplorationTier: 2 } : p) })
  })
  await page.waitForFunction(() => document.querySelectorAll('.restored-event-tier')[1].querySelectorAll('[data-board-card="event"]').length === 4)
  assert.equal(await page.locator('.restored-event-tier').nth(1).locator('.single-card-back').count(), 0)
  assert.equal(await page.locator('.restored-event-tier').nth(1).locator('[data-board-card="event"][role="button"]').count(), 0)
  await page.getByRole('button', { name: '가로 맞춤', exact: true }).click()
  await page.locator('.restored-shared-board').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/tabletop-presentation.png' })
  await page.evaluate(async () => {
    const React = await import('/node_modules/.vite/deps/react.js'), DOM = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { SURVIVORS } = await import('/src/data/survivors.js'), { default: Face } = await import('/src/components/SurvivorCardFace.jsx')
    const node = document.createElement('div'); node.style.cssText = 'display:flex;flex-wrap:wrap;gap:20px;padding:20px;background:#ddcead'
    document.body.replaceChildren(node)
    DOM.default.createRoot(node).render(React.default.createElement(React.default.Fragment, null, ...SURVIVORS.map(s => React.default.createElement(Face, { key: s.id, survivor: s }))))
  })
  await page.locator('.survivor-card-face').last().waitFor()
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 1100 })
    const cards = await page.locator('.survivor-card-face').evaluateAll(cards => cards.map(c => ({
      name: c.querySelector('h3').textContent,
      font: parseFloat(getComputedStyle(c.querySelector('.printed-survivor-rule')).fontSize),
      overlap: c.querySelector('.printed-survivor-flavor').getBoundingClientRect().bottom > c.querySelector('.printed-card-footer').getBoundingClientRect().top + 1,
    })))
    assert.equal(cards.length, 36)
    assert.deepEqual(cards.filter(c => c.overlap || c.font < 10), [])
  }
  console.log('PASS: card backs, click guides, shared reveal, compact transparent rows, cap tokens, 36 readable card faces on desktop/mobile')
} finally { await browser.close() }
