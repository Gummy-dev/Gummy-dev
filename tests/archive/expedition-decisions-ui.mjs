// Historical browser scenario; fixtures and selectors require review against current rules before use.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = []
await page.emulateMedia({ reducedMotion: 'reduce' }); page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message))
async function mount(scenario) {
  await page.goto((process.env.TEST_URL || 'http://localhost:5173') + '/expedition')
  await page.evaluate(async scenario => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { default: Board, SurvivorFace } = await import('/src/expedition/Board.jsx')
    const { createGame, applyCommand, actorId } = await import('/src/expedition/engine.js')
    const { LOCATIONS, PLAIN, SURVIVOR_CARDS, RULES } = await import('/src/expedition/cards.js')
    let game=createGame([{id:'a',name:'첫째',leaderId:'shy'},{id:'b',name:'둘째',leaderId:'robot'}],()=>.4), me='a'
    const crew=(ability,uid,slot,ready=true)=>({...(ability==='plain'?PLAIN[0]:SURVIVOR_CARDS.find(c=>c.ability===ability)),uid,slot,ready})
    game.phase='maintenance'; game.players.forEach(p=>{p.resources={can:15,bottleCap:15};p.party=[crew('captain',p.seatId+'-captain',0),crew('plain',p.seatId+'-plain',1),crew('doctor',p.seatId+'-doctor',2)]})
    if(scenario==='management') game.players[0].party[1].ready=false
    if(scenario==='forage') game.phase='dispatch'
    if(scenario==='dispatch-ability') {game.phase='dispatch';game.players[0].party[0]=crew('jam','jam',0)}
    if(scenario==='chaos') {game.phase='dispatch';game.sites=[{id:'chaos',card:LOCATIONS[0],crew:[{...crew('chaos','gambler',3,false),owner:'a'}],food:0,caps:0}]}
    if(scenario==='counter') {
      game.phase='dispatch';game.sites=[{id:'taboo',card:LOCATIONS.find(c=>c.name==='방치된 군수창고'),crew:[],food:0,caps:0}]
      game.players[0].party[0]=crew('counter','hero',0);game.players[1].party[0].type='4차원'
      game=applyCommand(game,'a',{type:'dispatch',uids:['hero','a-plain'],siteId:'taboo'})
      game=applyCommand(game,'b',{type:'dispatch',uid:'b-captain',siteId:'taboo'})
    }

    if(scenario==='prepare') {const omen=game.omens[0];Object.assign(omen,{revealed:true,resolved:false});Object.assign(omen.tile,{kind:'disaster',name:'시험 재난',resource:'bottleCap',cost:2,crew:2,types:['반장'],allTypes:false,loss:{},peopleLoss:0});game.players[1].prepared=[omen.tile.id];game=applyCommand(game,'a',{type:'endManagement',uids:[]});game=applyCommand(game,'b',{type:'endManagement',uids:[]})}
    if(scenario==='return') {
      game.phase='dispatch';game.sites=[{id:'unfinished',card:{...LOCATIONS[0],people:4},crew:[],food:0,caps:0}]
      game=applyCommand(game,'a',{type:'dispatch',uid:'a-plain',siteId:'unfinished'});game=applyCommand(game,'b',{type:'pass'});game=applyCommand(game,'a',{type:'pass'})
    }
    if(scenario==='disaster'||scenario==='disaster-pay') {game.day=2;const omen=game.omens[0];Object.assign(omen,{revealed:true,resolved:false});Object.assign(omen.tile,{kind:'disaster',name:'시험 재난',resource:'bottleCap',cost:2,crew:2,types:['반장'],allTypes:false,loss:{},peopleLoss:0});game.players[0].prepared=[omen.tile.id];game=applyCommand(game,'a',{type:'endManagement',uids:[]});me='b'}
    if(scenario==='success'||scenario==='failure'||scenario==='final-day') {game.phase='dispatch';game.players[0].route=RULES.route+2;game.players[0].party[2].type='분위기메이커'}
    if(scenario==='final-day'){game.phase='maintenance';game.day=8}
    if(scenario==='supplies') {game.phase='dispatch';game.sites=[{id:'supplies',card:{...LOCATIONS[7],people:2,roles:[]},crew:[{...crew('plain','b-away',3),owner:'b',ready:false}],food:0,caps:0}];game.players[1].passed=true}
    if(['barter','survivor-swap'].includes(scenario)) {
      game.phase='dispatch';const card=LOCATIONS.find(c=>c.interaction===(scenario==='barter'?'barter':'survivorTrade'))
      const envoy=game.players[0].party.pop();envoy.type=card.roles[0]
      const helper=crew('plain','b-helper',4,false)
      game.sites=[{id:card.id,card,crew:[{...envoy,owner:'a',ready:false},{...helper,owner:'b'}],food:0,caps:0}]
    }
    if(scenario==='cards') game.sites=LOCATIONS.map(card=>({id:card.id,card,crew:[],food:0,caps:0}))
    if(scenario==='dice'||scenario==='priority') {
      game.phase='resolution';game.sites[0].card={...LOCATIONS[0],distribution:'choice'}
      if(scenario==='priority') Object.assign(game.sites[0].card,{rewards:[{id:"first",kind:"can",amount:3,label:"통조림"},{id:"second",kind:"can",amount:1,label:"통조림"}]})
      game.sites[0].crew=game.players.flatMap((p,i)=>p.party.slice(0,scenario==='priority'?2-i:3).map(c=>({...c,owner:p.seatId,ready:false})))
      game.players.forEach(p=>{p.party=p.party.filter(c=>!game.sites[0].crew.some(away=>away.uid===c.uid))})
      game.pending={stage:'roll',siteId:game.sites[0].id,trigger:'a',order:[],index:0}
    }
    let nextDie=0
    window.testGame=()=>game
    document.getElementById('root').style.display='none'
    const root=document.createElement('div');document.body.append(root)
    function Harness(){const [current,setGame]=React.useState(game);window.repeatSnapshot=()=>setGame(JSON.parse(JSON.stringify(game)));return React.createElement(Board,{api:{room:{game:current,me:['barter','survivor-swap'].includes(scenario)?actorId(current):me},connected:true,busy:false,exit(){},setError(message){if(message)throw new Error(message)},async command(command){if(window.commandGate)await window.commandGate;game=applyCommand(game,['barter','survivor-swap'].includes(scenario)?actorId(game):me,command,()=>scenario==='dice'?(5-nextDie++)/6:scenario==='priority'?[5/6,3/6,1/6][nextDie++]:scenario==='failure'?0:.9);setGame(game);return true}}})}
    createRoot(root).render(React.createElement(Harness))
    if(scenario==='cards') {const gallery=document.createElement('div');gallery.id='survivor-gallery';gallery.style.cssText='--exp-card-width:206px;--exp-card-height:365px;display:grid;grid-template-columns:repeat(7,206px);gap:24px;padding:30px;background:#eee6d4;width:max-content';document.body.append(gallery);createRoot(gallery).render(React.createElement(React.Fragment,null,SURVIVOR_CARDS.map(card=>React.createElement(SurvivorFace,{card,key:card.id}))))}
  },scenario)
  await page.locator('.exp-game').waitFor()
}
async function visiblePips(selector) {
  const dice=await page.locator(selector).evaluateAll(dice=>dice.map(d=>({
    value:Number(d.getAttribute('aria-label').replace('주사위 ','')),
    pips:[...d.querySelectorAll('.pip')].map(p=>{const r=p.getBoundingClientRect();return [r.width,r.height]})
  })))
  assert.ok(dice.length>0 && dice.every(d=>d.pips.length===d.value && d.pips.every(s=>s.every(n=>n>=3))), 'dice eyes stay visible at the displayed size: '+JSON.stringify(dice))
  return dice.map(d=>d.value)
}
async function chooseResourceRewards() {
  while (await page.evaluate(() => window.testGame().pending?.stage === 'reward')) {
    await page.locator('.exp-card-menu .exp-prize-actions .secondary-button').first().click()
  }
}
try {
  await mount('forage')
  const forage=page.getByRole('button',{name:'안전 탐색 · 통조림 +1 · 병뚜껑 +1',exact:true})
  assert.equal(await forage.count(),0,'safe forage lives beside a selected card, not in the sidebar')
  await page.locator('.exp-camp-own [data-uid="a-plain"] > .exp-card-button').click()
  assert.equal(await forage.isEnabled(),true)
  await page.locator('.exp-safe-forage').screenshot({path:'/tmp/expedition-safe-forage.png'})
  await forage.click()
  assert.deepEqual(await page.evaluate(()=>window.testGame().players[0].resources),{can:16,bottleCap:16})
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party.find(c=>c.uid==='a-plain').ready),false)
  assert.equal(await page.locator('.exp-game').getAttribute('data-exp-actor'),'b')
  assert.equal(await forage.count(),0)
  await page.locator('.exp-gain-toast').filter({hasText:'안전 탐색'}).waitFor()
  assert.match(await page.locator('.exp-gain-toast').innerText(),/\+1/)
  const noticeCount=await page.locator('.exp-gain-toast').count();await page.evaluate(()=>window.repeatSnapshot());await page.waitForTimeout(150)
  assert.equal(await page.locator('.exp-gain-toast').count(),noticeCount,'repeated server snapshots never duplicate gain toasts')
  await mount('dispatch-ability')
  await page.locator('[data-uid="jam"] > .exp-card-button').click()
  await page.getByLabel('상대 파티 선택',{exact:true}).selectOption('b');await page.getByLabel('능력 대상',{exact:true}).selectOption('b-plain')
  await page.getByRole('button',{name:'생존자 능력 사용',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testGame().players[1].party[1].ready),false)
  assert.equal(await page.locator('.exp-game').getAttribute('data-exp-actor'),'b')
  await mount('chaos')
  await page.locator('[data-uid="gambler"] > .exp-card-button footer').click()
  await page.getByRole('button',{name:'탐색 도박 · 주사위 굴리기',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testGame().sites[0].chaosRoll),6)
  assert.match(await page.locator('.exp-chaos-result').innerText(),/×2/)
  await mount('counter')
  const reaction=page.getByRole('dialog',{name:'탐색 실패 · 반격 결정',exact:true});await reaction.waitFor()
  await reaction.screenshot({path:'/tmp/expedition-counter-response.png'})
  await reaction.getByRole('button',{name:/반격 · 자신 낙오/}).click();await reaction.waitFor({state:'hidden'})
  assert.equal(await page.evaluate(()=>window.testGame().sites[0].failed),undefined)
  assert.equal(await page.evaluate(()=>window.testGame().stranded[0].uid),'hero')
  assert.equal(await page.locator('.exp-game').getAttribute('data-exp-actor'),'a')
  await mount('dice')
  await page.getByRole('button',{name:'탐색 주사위 굴리기',exact:true}).click()
  await page.locator('.exp-dice-results .die').first().waitFor()
  await page.locator('.exp-dice-results').screenshot({path:'/tmp/expedition-dice-results.png'})
  assert.deepEqual((await visiblePips('.exp-dice-results .die')).sort((a,b)=>a-b),[1,2,3,4,5,6])
  await chooseResourceRewards()
  await mount('priority')
  await page.getByRole('button',{name:'탐색 주사위 굴리기',exact:true}).click()
  await chooseResourceRewards()
  await page.locator('.exp-actions').screenshot({path:'/tmp/expedition-reward-priority.png'})
  assert.deepEqual(await page.evaluate(()=>window.testGame().lastResult.choices.map(r=>r.amount)),[3,1])
  assert.deepEqual(await page.evaluate(()=>window.testGame().lastResult.choices.map(c=>c.owner)),['a','a'])
  assert.equal(await page.evaluate(()=>window.testGame().pending.stage),'return')
  assert.equal(await page.locator('.exp-reward-order').count(),0)
  await mount('management')
  assert.equal(await page.locator('.exp-actions .exp-preparation').count(),0)
  assert.equal(await page.locator('.exp-actions').getByRole('heading',{name:'추가 수색',exact:true}).count(),0)
  assert.equal(await page.locator('.exp-action-status h2').innerText(),'밤 · 야영지 정비')
  const oldMarket=await page.evaluate(()=>window.testGame().market[0].uid)
  await page.getByRole('button',{name:'생존자 수색',exact:true}).click()
  const search=page.getByRole('dialog',{name:'생존자 수색',exact:true});await search.waitFor()
  await search.screenshot({path:'/tmp/expedition-search-popup.png'})
  await search.getByRole('button',{name:/선택한 후보 교체/}).click();await search.waitFor({state:'hidden'})
  assert.notEqual(await page.evaluate(()=>window.testGame().market[0].uid),oldMarket)
  assert.equal(await page.evaluate(()=>window.testGame().players[0].searched),true)
  await page.locator('.exp-camp-own [data-uid="a-plain"] > .exp-card-button').click()
  assert.equal(await page.getByRole('button',{name:'생존자 능력 사용',exact:true}).count(),0,'camp active abilities are daytime actions')
  await page.getByRole('button',{name:/^식사/}).click()
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party.find(c=>c.uid==='a-plain').ready),true)
  assert.equal(await page.locator('.exp-actions .exp-crew-choices, .exp-actions .exp-ability-actions, .exp-actions .exp-rescue-choice, .exp-actions .exp-escape').count(),0,'sidebar contains no card action lists')
  await page.getByRole('button',{name:'밤 종료',exact:true}).click()
  assert.ok(await page.evaluate(()=>window.testGame().players[0].party.every(c=>c.ready)))
  assert.equal(await page.getByRole('button',{name:'밤 종료',exact:true}).count(),0)
  await mount('return')
  await page.locator('.exp-actions').screenshot({path:'/tmp/expedition-return-actions.png'})
  assert.equal(await page.locator('.exp-actions').getByRole('button',{name:/귀환 확정/}).count(),0)
  await page.locator('[data-site="unfinished"] [data-uid="a-plain"] .exp-card-button footer').click()
  const beforeReturn=await page.evaluate(()=>({...window.testGame().players[0].resources}))
  await page.getByRole('button',{name:/^귀환 ·/}).click()
  await page.locator('[data-exp-stage="maintenance"]').waitFor()
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party.find(c=>c.uid==='a-plain').ready),false)
  assert.equal(await page.locator('.exp-meals input').count(),0)
  assert.deepEqual(await page.evaluate(()=>window.testGame().players[0].resources),{can:beforeReturn.can,bottleCap:beforeReturn.bottleCap-1})
  await page.locator('.exp-camp-own [data-uid="a-plain"] > .exp-card-button').click()
  await page.getByRole('button',{name:/^식사/}).click()
  assert.equal(await page.evaluate(()=>window.testGame().players[0].resources.can),beforeReturn.can-2)
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party.find(c=>c.uid==='a-plain').ready),true)
  await mount('disaster')
  await page.getByRole('button',{name:'밤 종료',exact:true}).click()
  await page.locator('[data-exp-stage="disaster"]').waitFor()
  await page.getByRole('dialog',{name:/재난 대응/}).waitFor()
  assert.equal(await page.locator('.exp-action-status h2').innerText(),'④ 재난 대응')
  await page.getByRole('dialog',{name:/재난 대응/}).screenshot({path:'/tmp/expedition-disaster-popup.png'})
  assert.equal(await page.locator('.exp-disaster-loss input:enabled').count(),0)
  await page.getByRole('button',{name:/피해 확정/}).click();await page.locator('[data-exp-day="3"]').waitFor()
  assert.equal(await page.evaluate(()=>window.testGame().players[1].party.length),3)
  await mount('prepare')
  await page.locator('.exp-disaster-decision .exp-selection input').nth(0).check();await page.locator('.exp-disaster-decision .exp-selection input').nth(1).check()
  await page.getByRole('button',{name:'동료 2명 사용 · 재난 대비',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party.filter(c=>!c.ready).length),2)
  await mount('disaster-pay')
  await page.getByRole('button',{name:'밤 종료',exact:true}).click()
  await page.getByRole('dialog',{name:/재난 대응/}).waitFor()
  const resources=await page.evaluate(()=>window.testGame().players[1].resources)
  await page.getByRole('button',{name:'병뚜껑 2 지불',exact:true}).click()
  assert.equal(await page.getByRole('dialog').count(),0)
  assert.deepEqual(await page.evaluate(()=>window.testGame().players[1].resources),{can:resources.can,bottleCap:resources.bottleCap-2})
  for(const scenario of ['failure','success']) {
    await mount(scenario);assert.equal(await page.locator('.exp-actions .exp-escape').count(),0);await page.getByRole('button',{name:'유토피아 도전 준비',exact:true}).click();await page.getByRole('button',{name:/유토피아 도전 · 식량 3/}).click();await page.locator('.exp-utopia-result').waitFor()
    const result=await page.evaluate(()=>({result:window.testGame().lastUtopia,party:window.testGame().players[0]}))
    await visiblePips('.exp-utopia-result .die')
    assert.equal(result.result.success,scenario==='success');assert.equal(result.party.resources.can,12);assert.equal(result.party.route,22)
    await page.getByRole('button',{name:'판으로 돌아가기',exact:true}).click()
  }
  await mount('final-day')
  assert.equal(await page.locator('.exp-route-stops>.exp-route-stop').count(),25)
  await page.locator('.exp-actions').screenshot({path:'/tmp/expedition-final-day.png'})
  await page.getByRole('button',{name:'유토피아 도전 준비',exact:true}).click()
  await page.getByRole('button',{name:/유토피아 도전 · 식량 3/}).click()
  await page.getByRole('button',{name:'판으로 돌아가기',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testGame().players[0].escaped),true)
  assert.equal(await page.getByRole('button',{name:'밤 종료',exact:true}).isEnabled(),true)
  await mount('supplies')
  await page.locator('.exp-camp-own [data-uid="a-plain"] > .exp-card-button').click()
  await page.getByRole('button',{name:'침수된 연구소 탐색지 선택',exact:true}).click()
  assert.equal(await page.getByLabel('함께 보낼 통조림').count(),0);assert.equal(await page.getByLabel('함께 보낼 병뚜껑').count(),0)
  await page.getByRole('button',{name:'파견 확인',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.testGame().pending),null)
  await page.getByRole('button',{name:'낮 종료',exact:true}).click();await page.locator('[data-exp-stage="roll"]').waitFor()
  // First contributor controls the roll; fixture switches only the local observer seat.
  assert.equal(await page.evaluate(()=>window.testGame().sites[0].food),0)
  assert.equal(await page.evaluate(()=>window.testGame().players[0].resources.bottleCap),15)
  for(const scenario of ['barter','survivor-swap']) {
    await mount(scenario)
    await page.getByRole('button',{name:(scenario==='barter'?'고철 교환소':'생존자 만남터')+' 탐색지 선택',exact:true}).click()
    await page.getByLabel('교환할 파티',{exact:true}).selectOption('b')
    if(scenario==='survivor-swap') {
      await page.getByLabel('교환할 내 동료',{exact:true}).selectOption('a-plain')
      await page.getByLabel('교환할 상대 동료',{exact:true}).selectOption('b-plain')
    }
    await page.getByRole('button',{name:'교환 제안 · 상대 수락 필요',exact:true}).click()
    assert.equal(await page.locator('.exp-game').getAttribute('data-exp-actor'),'b')
    assert.equal(await page.getByRole('button',{name:'교환 수락',exact:true}).isEnabled(),true)
    await page.getByRole('button',{name:'교환 수락',exact:true}).click()
    assert.equal(await page.evaluate(()=>window.testGame().sites[0].resolved),true)
    assert.equal(await page.evaluate(()=>window.testGame().lastResult.choices.length),2)
    if(scenario==='barter') assert.deepEqual(await page.evaluate(()=>window.testGame().players.map(p=>p.resources)),[{can:13,bottleCap:18},{can:17,bottleCap:14}])
    else assert.equal(await page.evaluate(()=>window.testGame().players[0].party.find(c=>c.uid==='b-plain').ready),false)
    assert.equal(await page.locator('[data-exp-card] button').count(),0)
  }
  await mount('management')
  const moving=page.locator('.exp-camp-own [data-uid="a-plain"] > .exp-card-button')
  await moving.dragTo(page.locator('.exp-camp-own [data-party-slot="5"]'))
  assert.equal(await page.evaluate(()=>window.testGame().players[0].party.find(c=>c.uid==='a-plain').slot),4,'a tired card can be reordered by dropping onto a party seat')
  assert.equal(await page.evaluate(()=>window.testGame().players[0].resources.bottleCap),14,'drag reorder charges the existing front-row captain discount')
  await moving.click()
  const menu=page.locator('.exp-card-menu')
  const bounds=await page.locator('.exp-viewport').boundingBox(), box=await menu.boundingBox()
  assert.ok(box.x>=bounds.x && box.x+box.width<=bounds.x+bounds.width+1 && box.y>=bounds.y,'card menu stays in the play area')
  await page.keyboard.press('Escape');assert.equal(await menu.count(),0)
  await moving.focus();await page.keyboard.press('Enter');await menu.waitFor()
  assert.equal(await menu.getByRole('button',{name:/식사/}).evaluate(e=>e===document.activeElement),true,'keyboard selection focuses the nearby action')
  await page.keyboard.press('Escape');assert.equal(await moving.evaluate(e=>e===document.activeElement),true)
  assert.equal(await page.locator('.exp-actions').getByRole('button',{name:/안전 탐색|영입 확인|유토피아 도전/}).count(),0)
  assert.match(await page.locator('.exp-my-supplies').innerText(),/15/)
  assert.equal(await page.getByRole('button',{name:'유토피아 도전 준비',exact:true}).count(),0,'unavailable utopia challenge adds no action UI')
  await page.getByRole('button',{name:'확대',exact:true}).click();await moving.click()
  await page.locator('.exp-card-menu').screenshot({path:'/tmp/expedition-card-actions.png'})
  await page.screenshot({path:'/tmp/expedition-context-board.png'})
  await mount('cards')
  assert.equal(await page.locator('.exp-place-front').count(),20)
  assert.equal(await page.locator('#survivor-gallery .exp-card-front').count(),32)
  assert.deepEqual(await page.locator('.exp-place-front, .exp-day-tile, #survivor-gallery .exp-card-front').evaluateAll(cards=>cards.filter(c=>c.scrollHeight>c.clientHeight+1||c.scrollWidth>c.clientWidth+1).map(c=>c.textContent)),[],'all printed card content fits')
  const positions=await page.locator('#survivor-gallery .exp-card-front').evaluateAll(cards=>cards.map(card=>{const r=card.getBoundingClientRect(),effect=card.querySelector('.exp-ability>p').getBoundingClientRect(),footer=card.querySelector('footer').getBoundingClientRect();return {effect:effect.y-r.y,overlap:effect.bottom>footer.y+1,color:card.style.getPropertyValue('--card-color')===card.querySelector('.type-badge').style.getPropertyValue('--type-color')}}))
  assert.ok(positions.every(p=>Math.abs(p.effect-positions[0].effect)<1&&!p.overlap&&p.color),'same text baseline and type color, no footer overlap')
  const printedConditions=await page.locator('.exp-place-front').evaluateAll(cards=>cards.filter(c=>[...c.querySelector('.exp-condition').children].some(child=>child.getBoundingClientRect().bottom>c.querySelector('footer').getBoundingClientRect().top+1)).map(c=>c.textContent))
  assert.deepEqual(printedConditions,[],'departure conditions and taboos do not overlap rewards')
  await page.locator('.exp-place-front').evaluateAll(cards=>{const gallery=document.createElement('div');gallery.id='location-gallery';gallery.style.cssText='--exp-card-width:206px;--exp-card-height:365px;display:grid;grid-template-columns:repeat(6,206px);gap:24px;padding:30px;background:#eee6d4;width:max-content';cards.forEach(card=>gallery.append(card.cloneNode(true)));document.body.append(gallery)})
  await page.locator('#location-gallery .exp-place-front').nth(15).screenshot({path:'/tmp/expedition-difficult-location.png'})
  await page.locator('#location-gallery').screenshot({path:'/tmp/expedition-location-gallery.png'})
  await page.locator('#survivor-gallery').screenshot({path:'/tmp/expedition-management-card-gallery.png'})
  assert.deepEqual(errors,[])
  console.log('PASS dispatch abilities, chaos, off-turn counter, management/meal/return, disaster, utopia, supplies and 32 survivor/20 location print checks')
} catch(e) {await page.screenshot({path:'/tmp/expedition-decisions-failure.png'}).catch(()=>{});throw e}
finally{await browser.close()}
