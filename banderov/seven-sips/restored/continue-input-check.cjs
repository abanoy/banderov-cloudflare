const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const key of ['Enter','Space']){
  const c=await b.newContext({viewport:{width:320,height:568}}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__noBoot=true);
  await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
  await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);newRun();G.day=2;G.stats.exchanges=12;snapshot();});
  await p.reload();await p.waitForFunction(()=>UI.snd);await p.evaluate(()=>{Engine.speed=8;Sound.setMusic(false);Sound.setSfx(false);main();});
  const cont=p.locator('.titlebar .cont');await cont.waitFor();await cont.focus();
  await p.keyboard.press(key);
  await p.waitForFunction(()=>G?.day===2&&!document.querySelector('.titlebar')&&UI.say.querySelectorAll('.w.empty').length===3&&UI.blocks.querySelector('.blk:not(:disabled)'));
  await p.evaluate(()=>Engine.speed=1);
  assert.equal(await p.evaluate(()=>G.stats.exchanges),12);
  await p.keyboard.down(key);await p.keyboard.up(key);
  assert.equal(await p.locator('.w.empty').count(),3);
  // Pause freezes this resumed reply; returning focus alone does not consume it.
  await p.keyboard.press('Escape');await p.waitForFunction(()=>!UI.set.hidden);
  const timer=await p.locator('.t-fill').evaluate(e=>e.style.transform);
  await p.keyboard.press('1');await p.waitForTimeout(200);
  assert.equal(await p.locator('.w.empty').count(),3);
  assert.equal(await p.locator('.t-fill').evaluate(e=>e.style.transform),timer);
  await p.getByRole('button',{name:'Resume',exact:true}).focus();await p.keyboard.press('Space');
  await p.waitForFunction(()=>UI.set.hidden);
  await p.keyboard.down('1');await p.waitForFunction(()=>UI.say.querySelectorAll('.w.empty').length===2);
  await p.waitForFunction(()=>UI.blocks.querySelector('.blk:not(:disabled)'));
  await p.keyboard.down('1');await p.waitForTimeout(100);
  assert.equal(await p.locator('.w.empty').count(),2);
  await p.keyboard.up('1');await p.keyboard.press('1');await p.waitForFunction(()=>UI.say.querySelectorAll('.w.empty').length===1);
  assert.equal(await p.evaluate(()=>SAVE.run.day),2);assert.equal(await p.evaluate(()=>SAVE.run.stats.exchanges),12);
  assert.deepEqual(errors,[]);await c.close();console.log(key+': native saved-week Continue, pause timer/input, fresh/repeated fragment keys and unchanged checkpoint passed.');
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
