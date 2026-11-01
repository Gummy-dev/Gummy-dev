import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } }), errors = []
page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(10000)

async function mount(scenario) {
  await page.goto((process.env.TEST_URL || 'http://localhost:5173') + '/expedition')
  await page.evaluate(async scenario => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { default: Board } = await import('/src/expedition/Board.jsx')
    const { default: LocationCard } = await import('/src/expedition/LocationCard.jsx')
    const { createGame, applyCommand } = await import('/src/expedition/engine.js')
    const { LOCATIONS, SURVIVOR_CARDS, EXPLORATION_TYPES } = await import('/src/expedition/cards.js')
    const root = document.createElement('div'); document.body.replaceChildren(root)
    if (scenario === 'gallery') {
      root.className = 'exp-inspection'
      root.style.cssText = 'display:block;background:#eee6d4;padding:36px;color:#30382c;width:max-content;--exp-card-width:206px;--exp-card-height:365px'
      createRoot(root).render(React.createElement(React.Fragment, null,
        React.createElement('h1', { style: { fontSize:24, margin:'0 0 10px' } }, '탐색 카드 · 6가지 타입'),
        React.createElement('p', { style: { fontSize:14, margin:'0 0 26px' } }, '실제 프로토타입 카드 · 첨부 시안 기반 그림·마크 · 기존 재화 아이콘'),
        React.createElement('div', { id:'six-types', style:{display:'grid',gridTemplateColumns:'repeat(3,340px)',gap:'28px 30px'} }, Object.keys(EXPLORATION_TYPES).map(type => {
          const examples = { supply:'place-1-0', scout:'place-2-4', large:'place-3-0', contest:'place-2-1', first:'place-1-3', rescue:'place-2-5' }
          const card = LOCATIONS.find(card => card.id === examples[type])
          return React.createElement(LocationCard, { card, key:type })
        })),
        React.createElement('div', { id:'all-cards', style:{display:'flex',gap:20,marginTop:40} }, LOCATIONS.map(card => React.createElement(LocationCard, { card, key:card.id }))),
      ))
      return
    }
    const crew = (uid,slot) => ({ ...SURVIVOR_CARDS.find(card => card.ability === 'doctor'),uid,slot,ready:true })
    let game = createGame([{id:'a',name:'나',leaderId:'shy'},{id:'b',name:'상대',leaderId:'robot'}],()=>.4)
    game.players.forEach(player => { player.resources={can:15,bottleCap:15};player.party=[] })
    game.players[0].party=[crew('a-1',0),crew('a-2',1),crew('a-3',2)]
    if (scenario === 'first') {
      game.phase='dispatch';game.players[1].passed=true
      const card=LOCATIONS.find(card=>card.distribution==='first')
      game.sites=[{id:'first',card:{...card,hazard:null},crew:[],food:0,caps:0}]
      game=applyCommand(game,'a',{type:'dispatch',uids:['a-1','a-2'],siteId:'first'})
      game=applyCommand(game,'a',{type:'dispatch',uid:'a-3',siteId:'first'})
    } else {
      game.phase='resolution'
      const card=LOCATIONS.find(card=>card.rewardSurvivors===2)
      game.sites=[{id:'rescue',card:{...card,rewards:card.rewards.filter(r=>r.kind==='survivor'),roles:[]},crew:game.players[0].party.map(card=>({...card,owner:'a',ready:false})),food:1,caps:0}]
      game.players[0].party=[]
      game.market[0]=crew('public-1',undefined);game.market[1]=crew('public-2',undefined)
      game.pending={stage:'roll',siteId:'rescue',trigger:'a',order:[],index:0}
    }
    window.testGame=()=>game
    function Harness() {
      const [current,setGame]=React.useState(game)
      return React.createElement(Board,{api:{room:{game:current,me:'a'},connected:true,busy:false,exit(){},setError(message){if(message)throw new Error(message)},async command(command){game=applyCommand(game,'a',command,()=>.9);setGame(game);return true}}})
    }
    createRoot(root).render(React.createElement(Harness))
  }, scenario)
}

try {
  await mount('first')
  const firstName=await page.evaluate(()=>window.testGame().sites[0].card.name)
  await page.getByRole('button',{name:firstName+' 탐색지 선택',exact:true}).click()
  await page.locator('.exp-card-menu .exp-prize-actions').waitFor()
  while (await page.evaluate(()=>window.testGame().pending?.stage==='reward')) await page.locator('.exp-card-menu .exp-prize-actions .secondary-button').first().click()
  assert.equal(await page.getByRole('button',{name:'탐색 주사위 굴리기',exact:true}).count(),0)
  assert.deepEqual(await page.evaluate(()=>window.testGame().lastResult.choices.map(r=>r.amount)),[4,2,1])
  assert.equal(await page.evaluate(()=>window.testGame().phase),'dispatch')
  assert.equal(await page.evaluate(()=>window.testGame().sites[0].resolved),true)

  await mount('rescue')
  await page.getByRole('button',{name:'탐색 주사위 굴리기',exact:true}).click()
  await page.locator('.exp-recruit-row [data-uid="public-1"] > .exp-card-button').click()
  await page.getByRole('button',{name:'선택한 동료 데려오기',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party[0].uid),'public-1')
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party[0].ready),false)
  await page.locator('.exp-recruit-row [data-uid="public-2"] > .exp-card-button').click()
  await page.getByRole('button',{name:'선택한 동료 데려오기',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testGame().lastResult.choices.length),2)
  assert.deepEqual(await page.evaluate(()=>window.testGame().players[0].resources),{can:18,bottleCap:15})

  await mount('gallery')
  await page.locator('#all-cards .exp-place-front').last().waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('.exp-location-art, .exp-type-seal>img')].every(img => img.complete && img.naturalWidth > 0))
  const printed = await page.locator('#all-cards .exp-place-front').evaluateAll(cards => cards.map(card => {
    const footer = card.querySelector('footer'), condition = card.querySelector('.exp-condition'), heading = card.querySelector('.exp-place-heading h3')
    const seal = card.querySelector('.exp-type-seal').getBoundingClientRect()
    return { name:heading.textContent, oval:Math.abs(seal.width-seal.height)>0.5, missingDescription:!card.querySelector('.exp-place-heading p')?.textContent, background:getComputedStyle(footer).backgroundColor, overflow:card.scrollHeight>card.clientHeight+1||card.scrollWidth>card.clientWidth+1,
      overlaps:[...condition.children].some(child=>child.getBoundingClientRect().bottom>footer.getBoundingClientRect().top+1), clippedTitle:heading.scrollWidth>heading.clientWidth+1 }
  }))
  await page.locator('#all-cards').evaluate(node=>node.style.display='none')
  await page.locator('body > .exp-inspection').screenshot({path:'design/exploration-six-types-applied.png'})
  assert.equal(new Set(printed.map(card=>card.background)).size,1)
  assert.equal(printed[0].background,'rgba(0, 0, 0, 0)')
  assert.deepEqual(printed.filter(card=>card.overflow||card.overlaps||card.clippedTitle||card.oval||card.missingDescription),[],'every card condition, title and reward fits')
  assert.equal(await page.locator('#six-types [data-exploration-type]').count(),6)
  assert.deepEqual(errors,[])
  console.log('PASS first-come, public survivor rescue, six type faces and 20 card fit checks')
} finally { await browser.close() }
