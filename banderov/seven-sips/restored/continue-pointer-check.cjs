const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const mode of ['mouse','touch']){
  const c=await b.newContext({viewport:{width:mode==='touch'?320:390,height:mode==='touch'?568:844},hasTouch:mode==='touch',isMobile:mode==='touch'}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__noBoot=true);
  await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
  await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);newRun();G.day=2;G.stats.exchanges=12;snapshot();});
  await p.reload();await p.waitForFunction(()=>UI.snd);await p.evaluate(()=>{Engine.speed=8;Sound.setMusic(false);Sound.setSfx(false);main();});
  const cont=p.locator('.titlebar .cont');await cont.waitFor();
  if(mode==='touch')await cont.tap();else await cont.click();
  await p.waitForFunction(()=>G?.day===2&&!document.querySelector('.titlebar')&&UI.say.querySelectorAll('.w.empty').length===3&&UI.blocks.querySelector('.blk:not(:disabled)'));
  await p.waitForFunction(()=>[...UI.blocks.children].every(e=>e._fx?.y===0&&e._fx?.s===1&&e._fx?.o===1));await p.evaluate(()=>Engine.speed=1);await p.waitForFunction(()=>getComputedStyle(UI.panel).transform==='none');
  const bounds=await p.locator('.blk:not(:disabled)').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
  const viewport=p.viewportSize();for(const r of bounds){assert.ok(r.x>=-1&&r.y>=-1&&r.right<=viewport.width+1&&r.bottom<=viewport.height+1);}
  await p.screenshot({path:path.join(__dirname,'review','continue-'+mode+'.png')});
  const first=p.locator('.blk:not(:disabled)').first();if(mode==='touch')await first.tap();else await first.click();
  await p.waitForFunction(()=>UI.say.querySelectorAll('.w.empty').length===2);
  await p.waitForFunction(()=>UI.blocks.querySelector('.blk:not(:disabled)'));
  await p.waitForTimeout(140);assert.equal(await p.locator('.w.empty').count(),2);
  assert.equal(await p.evaluate(()=>SAVE.run.stats.exchanges),12);assert.equal(await p.evaluate(()=>SAVE.run.day),2);
  assert.deepEqual(errors,[]);await c.close();console.log(mode+': native Continue/reply press-release, phone bounds and preserved checkpoint passed.');
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
