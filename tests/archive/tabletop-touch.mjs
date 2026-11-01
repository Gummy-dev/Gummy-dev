// Historical browser scenario; fixtures and selectors require review against current rules before use.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await context.newPage()
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:5173')
  await page.getByRole('button', { name: /먼저 혼자/ }).tap()
  await page.locator('.table-action-tray').getByRole('button', { name: /안전한 식량 수집/ }).tap()
  await page.locator('.party-mat .survivor-face').first().tap()
  await page.getByRole('button', { name: '파견하기', exact: true }).tap()
  await page.getByRole('button', { name: '파티 정비로' }).tap()
  await page.locator('.resource-pile[data-drag-kind=food]').scrollIntoViewIfNeeded()
  const food = await page.locator('.resource-pile[data-drag-kind=food]').boundingBox()
  const start = { x: food.x + food.width / 2, y: food.y + food.height / 2 }
  const client = await context.newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] })
  for (let i = 1; i <= 10; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (25 - start.x) * i / 10, y: start.y + (540 - start.y) * i / 10, id: 1 }] })
  }
  await page.waitForTimeout(1300)
  const used = await page.locator('.party-slot .used-piece').first().boundingBox()
  assert.ok(used.x >= 0, 'edge auto-scroll reaches the used card')
  for (let i = 1; i <= 10; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 25 + (used.x + used.width / 2 - 25) * i / 10, y: 540 + (used.y + used.height / 2 - 540) * i / 10, id: 1 }] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.locator('.party-mat .used-piece').waitFor({ state: 'hidden' })
  console.log('PASS: touch drag auto-scrolls horizontally and feeds a used survivor')
} finally { await browser.close() }
