const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const mode of ['mouse','touch','touch-cancel']){
  const c=await b.newContext({viewport:{width:390,height:844},hasTouch:mode!=='mouse',isMobile:mode!=='mouse'}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__noBoot=true);await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
  await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);SAVE.fast=true;Engine.speed=8;main('play');});
  await p.waitForFunction(()=>UI.blocks.querySelector('.blk:not(:disabled)')&&UI.say.querySelectorAll('.w.empty').length===3);await p.evaluate(()=>Engine.speed=1);
  await p.waitForFunction(()=>[...UI.blocks.children].every(e=>e._fx?.y===0&&e._fx?.s===1&&e._fx?.o===1)&&getComputedStyle(UI.panel).transform==='none');
  const box=await p.locator('.blk:not(:disabled)').first().boundingBox(),xy={x:box.x+box.width/2,y:box.y+box.height/2},cdp=mode!=='mouse'?await c.newCDPSession(p):null;
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...xy,id:1}]});else{await p.mouse.move(xy.x,xy.y);await p.mouse.down();}
  await p.waitForFunction(()=>UI.say.querySelectorAll('.w.empty').length===2&&UI.blocks.querySelector('.blk:not(:disabled)'));
  await p.keyboard.press('Escape');const frozen=await p.locator('.t-fill').evaluate(e=>e.style.transform);await p.waitForTimeout(150);assert.equal(await p.locator('.t-fill').evaluate(e=>e.style.transform),frozen);
  await p.getByRole('button',{name:'Resume',exact:true}).focus();await p.keyboard.press('Space');await p.waitForFunction(()=>UI.set.hidden);
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:mode==='touch-cancel'?'touchCancel':'touchEnd',touchPoints:[]});else await p.mouse.up();
  await p.waitForTimeout(150);assert.equal(await p.locator('.w.empty').count(),2,'Old release must not select the replacement slot');
  const next=p.locator('.blk:not(:disabled)').first();if(cdp)await next.tap();else await next.click();await p.waitForFunction(()=>UI.say.querySelectorAll('.w.empty').length===1);assert.equal(await p.evaluate(()=>G.stats.exchanges),0);assert.deepEqual(errors,[]);
  await c.close();console.log(mode+': press selects once; pause freezes timer; old release after Resume leaves next slot untouched; fresh press accepted.');
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
