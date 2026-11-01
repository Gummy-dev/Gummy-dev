import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:5173')
  await page.getByRole('button', { name: /먼저 혼자/ }).click()
  const viewport = page.locator('.table-viewport')
  await viewport.waitFor()
  await page.mouse.move(1200, 700)
  await page.mouse.down()
  await page.mouse.move(1200, 400, { steps: 6 })
  await page.mouse.up()
  assert.ok(await viewport.evaluate(node => node.scrollTop) > 100, 'empty table pans vertically')

  await page.locator('.event-table-row .expedition-card').filter({ hasText: '물자 탐색' }).first().click()
  await page.locator('.party-mat .survivor-face').first().click()
  await page.getByRole('button', { name: '파견하기', exact: true }).click()
  await page.locator('.party-mat .used-piece').waitFor()
  assert.match(await page.locator('.party-mat .used-piece .piece-status').first().innerText(), /사용됨/)
  await page.getByRole('button', { name: '결과 확정' }).click()
  await page.getByRole('button', { name: '파티 정비로' }).click()

  await page.locator('#market-tier-1 .survivor-piece').first().scrollIntoViewIfNeeded()
  const source = await page.locator('#market-tier-1 .survivor-piece').first().boundingBox()
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(750, 600, { steps: 8 })
  await page.mouse.move(750, 940, { steps: 8 })
  let target
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100)
    target = await page.locator('.party-slot').nth(2).boundingBox()
    if (target && target.y > 210 && target.y < 650) break
  }
  assert.ok(target && target.y > 210 && target.y < 650, 'edge auto-scroll reaches own party')
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.locator('.party-mat .survivor-card').nth(2).waitFor()
  assert.equal(await page.locator('.party-mat .survivor-card').count(), 3, 'market card lands in party')

  await page.locator('.resource-pile[data-drag-kind=food]').scrollIntoViewIfNeeded()
  const food = await page.locator('.resource-pile[data-drag-kind=food]').boundingBox()
  const used = await page.locator('.party-slot .used-piece').first().boundingBox()
  await page.mouse.move(food.x + food.width / 2, food.y + food.height / 2)
  await page.mouse.down()
  await page.mouse.move(used.x + used.width / 2, used.y + used.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.locator('.party-mat .used-piece').waitFor({ state: 'hidden' })

  const before = await page.locator('.party-slot .survivor-piece').evaluateAll(nodes => nodes.map(node => node.dataset.uid))
  const first = await page.locator('.party-slot .survivor-piece').first().boundingBox()
  const second = await page.locator('.party-slot').nth(1).boundingBox()
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const after = await page.locator('.party-slot .survivor-piece').evaluateAll(nodes => nodes.map(node => node.dataset.uid))
  assert.equal(after[1], before[0], 'dragging changes party order')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '전체 보기', exact: true }).click()
  const blank = await page.evaluate(() => {
    const rect = document.querySelector('.table-viewport').getBoundingClientRect()
    for (let y = rect.top + 25; y < rect.bottom - 25; y += 18) {
      for (let x = rect.left + 130; x < rect.right - 15; x += 18) {
        const node = document.elementFromPoint(x, y)
        if (node?.closest('.game-surface') && !node.closest('button,a,input,select,.card-stack,.party-slot,[data-drag-kind]')) return { x, y }
      }
    }
    return null
  })
  assert.ok(blank, 'phone viewport has grabbable table floor')
  await page.mouse.move(blank.x, blank.y)
  await page.mouse.down()
  await page.mouse.move(blank.x - 100, blank.y, { steps: 8 })
  await page.mouse.up()
  assert.ok(await viewport.evaluate(node => node.scrollLeft) > 50, 'phone can pan horizontally')
  assert.deepEqual(errors, [])
  console.log('PASS: desktop and phone pan, click-confirm-turn card, edge-scroll recruitment, token meal, party reorder')
} finally { await browser.close() }
