import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome' })
const base = process.env.TEST_URL || 'http://localhost:5173'
const a = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), b = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
for (const page of [a, b]) { await page.emulateMedia({ reducedMotion: 'reduce' }); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message)) }
async function room(page) { return page.evaluate(async () => { const s = JSON.parse(localStorage.getItem('apocalypse-expedition-v2-seat')); return (await (await fetch('/api/rooms/' + s.code, { headers: { Authorization: 'Bearer ' + s.token } })).json()).room }) }
async function waitState(page, check) { for (let i = 0; i < 80; i++) { const r = await room(page); if (check(r)) return r; await page.waitForTimeout(100) } throw new Error('state timeout: ' + JSON.stringify((await room(page)).game)) }
async function sameCardSize(page) {
  const sizes = await page.locator('.exp-table .exp-card-front, .exp-table .exp-place-front, .exp-table .exp-deck-face, .exp-table .exp-small-deck').evaluateAll(cards => cards.map(card => { const r = card.getBoundingClientRect(); return [r.width, r.height].sort((a, b) => a - b) }))
  assert.ok(sizes.length > 6 && sizes.every(size => size.every((n, i) => Math.abs(n - sizes[0][i]) < 1)), 'every physical card uses the same size, including rotated resting cards')
}
async function horizontalSeats(page) {
  const rows = await page.locator('.exp-party-slots').evaluateAll(rows => rows.map(row => [...row.children].map(slot => slot.getBoundingClientRect().y)))
  assert.ok(rows.every(row => row.length === 5 && row.every(y => Math.abs(y - row[0]) < 1)), 'every party keeps five seats in one row, including away and resting crew')
}
async function dispatch(page, card, site) {
  await page.getByRole('button', { name: '내 파티', exact: true }).click()
  await page.locator('.exp-camp-own [data-uid="' + card.uid + '"] > .exp-card-button').click()
  await page.getByRole('button', { name: '공동 탐색', exact: true }).click()
  await page.getByRole('button', { name: site.card.name + ' 탐색지 선택', exact: true }).click()
  await page.getByRole('button', { name: '파견 확인', exact: true }).click()
}
try {
  await a.goto(base + '/expedition'); await a.getByLabel('생존자 이름').fill('첫째')
  await a.getByRole('button', { name: /친구들과 시작하기/ }).click(); await a.locator('.invite-ticket strong').waitFor()
  const code = await a.locator('.invite-ticket strong').innerText()
  await b.goto(base + '/expedition?room=' + code); await b.getByLabel('생존자 이름').fill('둘째'); await b.getByRole('button', { name: /빈자리에 앉기/ }).click()
  await a.locator('.seat-ticket').nth(1).getByText('짐 챙기는 중', { exact: true }).waitFor()
  await a.getByRole('button', { name: /짐 다 챙겼어요/ }).click()
  await b.locator('.seat-ticket').first().getByText('출발 준비 완료', { exact: true }).waitFor()
  await b.getByRole('button', { name: /짐 다 챙겼어요/ }).click()
  await a.getByRole('button', { name: '탐험 시작', exact: true }).click()
  for (const p of [a, b]) await p.locator('.exp-game').waitFor()
  assert.equal((await room(a)).rulesVersion, 'expedition-v2')
  assert.equal((await room(a)).game.locationRevision,5,'live server uses the new balance')
  assert.equal((await room(a)).game.abilityRevision,2)
  assert.equal((await room(a)).game.payoutRevision,3)
  for (const [i, page] of [a, b].entries()) {
    const r = await waitState(page, r => r.game.currentPlayerIndex === i), card = r.game.market.filter(Boolean).sort((a,b) => a.cost-b.cost)[0]
    assert.equal(r.game.phase, 'setup'); assert.equal(r.game.players[i].party.length, 0)
    await page.locator('.exp-recruit-section [data-uid="' + card.uid + '"] > .exp-card-button').click()
    await page.getByRole('button', { name: /영입 확인/ }).click()
    await waitState(page, r => r.game.players[i].party.length === 1)
    assert.equal((await room(page)).game.players[i].party[0].ready, false)
    await page.getByRole('button', { name: '내 파티', exact: true }).click()
    await page.locator('.exp-camp-own [data-uid="' + card.uid + '"] > .exp-card-button').click()
    await page.getByRole('button', { name: /식사/ }).click()
    await page.getByRole('button', { name: '출발 준비 완료', exact: true }).click()
  }
  let r = await waitState(a, r => r.game.phase === 'dispatch'), g = r.game
  for (const p of [a, b]) {
    await p.getByRole('button', { name: '전체 판', exact: true }).click()
    const far = await p.locator('.exp-far-side').boundingBox(), common = await p.locator('.exp-sites-section').boundingBox(), own = await p.locator('.exp-camp-own').boundingBox()
    assert.ok(far.y + far.height <= common.y && common.y + common.height <= own.y, 'opponent above shared locations above local party')
  }
  const anchor = await a.locator('.exp-camp-own').boundingBox()
  for (const selector of ['.exp-opponent', '.exp-camp-own']) assert.ok(Math.abs((await a.locator(selector).first().boundingBox()).x - anchor.x) < 1)
  assert.equal(await a.locator('[data-exp-card] button').count(), 0)
  await sameCardSize(a); await horizontalSeats(a)
  const row = await a.locator('.exp-recruit-section > div:first-child .exp-recruit-row').evaluate(row => [...row.children].map(c => c.getBoundingClientRect().y))
  assert.equal(row.length, 4); assert.ok(row.every(y => Math.abs(y-row[0]) < 1))
  assert.equal(await a.locator('.exp-journey').count(), 1)
  assert.equal(await a.locator('.exp-deck-face').count(), 1)
  assert.equal(await a.locator('.exp-day-tile').count(),0,'no calendar tiles')
  assert.equal(await a.locator('.exp-route-stops>.exp-route-stop').count(),25)
  await a.screenshot({ path: '/tmp/expedition-management-board.png' })
  const site = g.sites.find(s => !s.card.interaction && !(s.card.hazard?.effect === 'fail' && g.players.some(p => p.party.some(c => c.type === s.card.hazard.type))) && s.card.roles.every(role => g.players.some(p => p.party.some(c => c.type===role)))) ?? g.sites.find(s => !s.card.interaction && s.card.hazard?.effect !== 'fail')
  const ca=g.players[0].party[0], cb=g.players[1].party[0]
  assert.ok(ca.ready && cb.ready)
  await a.locator('.exp-camp-own [data-uid="' + ca.uid + '"] > .exp-card-button').dragTo(a.getByRole('button', { name: site.card.name + ' 탐색지 선택', exact: true }))
  await waitState(b, r => r.game.currentPlayerIndex === 1)
  await dispatch(b, cb, site)
  await waitState(a, r => r.game.currentPlayerIndex === 0)
  assert.equal((await room(a)).game.pending,null,'filling a site waits for all parties to pass')
  await a.mouse.move(0,0)
  const tucked = await a.locator('[data-site="' + site.id + '"]').evaluate(site => { const f=site.querySelector('.exp-place-button').getBoundingClientRect(); return [...site.querySelectorAll('.exp-assignee .exp-card-front')].map(c=>{const r=c.getBoundingClientRect();return r.y>f.y && r.y<f.bottom && r.bottom>f.bottom && Math.abs(r.x-f.x)<1}) })
  assert.equal(tucked.length,2); assert.ok(tucked.every(Boolean),'survivors physically tuck beneath their location')
  await a.screenshot({ path: '/tmp/expedition-management-dispatched.png' })
  await a.getByRole('button',{name:'낮 종료',exact:true}).click(); await b.getByRole('button',{name:'낮 종료',exact:true}).click()
  const pages={ [g.players[0].seatId]:a, [g.players[1].seatId]:b }
  for (let step=0;step<12;step++) {
    r=await room(a); const q=r.game.pending; if(!q || r.game.phase==='maintenance') break
    const id=q.stage==='roll'?q.trigger:q.order[q.index], page=pages[id]
    if(q.stage==='roll') await page.getByRole('button',{name:'탐색 주사위 굴리기',exact:true}).click()
    else if(q.stage==='reward') {
      const resource = page.locator('.exp-card-menu .exp-prize-actions .secondary-button').first()
      if (await resource.count()) await resource.click()
      else await page.getByRole('button',{name:'영입하지 않고 이 보상 넘기기',exact:true}).click()
    }

    await waitState(a,x=>JSON.stringify(x.game.pending)!==JSON.stringify(q))
  }
  r=await waitState(a,r=>r.game.phase==='maintenance')
  const lost=r.game.lastResult?.results.flatMap(result=>result.lost)??[]
  assert.equal(r.game.sites.find(s=>s.id===site.id)?.crew.length??0,2-lost.length,'surviving cards stay dispatched until each management turn')
  await b.reload();await b.locator('.exp-game').waitFor();assert.equal((await room(b)).me,g.players[1].seatId)
  for(const [i,page] of [a,b].entries()) {
    await waitState(page,r=>r.game.currentPlayerIndex===i && r.game.phase==='maintenance')
    assert.equal(await page.locator('.exp-action-status h2').innerText(),'밤 · 야영지 정비')
    const before={...(await room(page)).game.players[i].resources}
    const survivor=(await room(page)).game.sites.flatMap(s=>s?.crew??[]).find(c=>c.owner===g.players[i].seatId)
    if(survivor){
      await page.locator('[data-uid="'+survivor.uid+'"] > .exp-card-button footer').click()
      await page.getByRole('button',{name:/^귀환 ·/}).click()
      r=await waitState(page,r=>!r.game.pending)
      assert.equal(r.game.players[i].party[0].ready,false)
      assert.equal(r.game.players[i].resources.can,before.can)
      assert.equal(r.game.players[i].resources.bottleCap,before.bottleCap-survivor.returnCost)
      await page.getByRole('button',{name:'내 파티',exact:true}).click()
      await page.locator('.exp-camp-own [data-uid="'+survivor.uid+'"] > .exp-card-button').click()
      await page.getByRole('button',{name:/^식사/}).click()
      await waitState(page,r=>r.game.players[i].party.find(c=>c.uid===survivor.uid).ready)
    }
    assert.equal(await page.locator('.exp-meals input').count(),0,'feeding is a card action, not a sidebar confirmation')
    await sameCardSize(page);await horizontalSeats(page)
    await page.getByRole('button',{name:'밤 종료',exact:true}).click()
  }
  r=await waitState(a,r=>r.game.day===2);assert.ok(r.game.players.every(p=>p.party.every(c=>c.ready)))
  assert.equal(await a.getByRole('dialog').count(),0,'disaster does not open at day 2 start')
  for(let i=0;i<10;i++) await a.getByRole('button',{name:'확대',exact:true}).click()
  const before=await a.locator('.exp-viewport').evaluate(e=>[e.scrollLeft,e.scrollTop]), area=await a.locator('.exp-viewport').boundingBox()
  await a.mouse.move(area.x+20,area.y+20); await a.mouse.down(); await a.mouse.move(area.x+5,area.y+5,{steps:10}); await a.mouse.up()
  assert.notDeepEqual(await a.locator('.exp-viewport').evaluate(e=>[e.scrollLeft,e.scrollTop]),before)
  assert.deepEqual(errors,[])
  console.log('PASS two online seats: preserved layout, mixed market, initial recruitment/meal, drag and click dispatch, tucked cards, shared resolution, night cap return, exhausted arrival and card meal, day progression, reconnect and pan')
} catch(e) { console.error('browser errors',errors); await a.screenshot({path:'/tmp/expedition-failure.png'}).catch(()=>{}); throw e }
finally { await browser.close() }
