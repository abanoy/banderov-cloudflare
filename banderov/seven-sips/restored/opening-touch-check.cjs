// Normal-speed opening day: no BOT or injected progression.
// Seeded randomness and ideal read-only preference weights; default text speed.
// Browser touch evidence, not human reading, balance, phone or audible playtest.
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const url='file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/');
const trace=[],errors=[];let browser,context,page;
function checkpoint(){fs.writeFileSync(path.join(__dirname,'opening-touch-progress.json'),JSON.stringify({status:'running; not a passing result',errors,trace},null,2));}
async function setup(){await page.waitForFunction(()=>UI.snd);await page.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);Engine.speed=1;main();});}
async function activate(locator){await locator.waitFor({state:'visible'});assert.ok(await locator.isEnabled());const b=await locator.boundingBox();assert.ok(b);const x=b.x+b.width/2,y=b.y+b.height/2;assert.ok(x>=0&&x<=390&&y>=0&&y<=844);assert.ok(await locator.evaluate((e,p)=>e.contains(document.elementFromPoint(p.x,p.y)),{x,y}),'Touch point must hit the intended visible control');await page.touchscreen.tap(x,y);}
async function state(){return page.evaluate(()=>({day:G?.day,hearts:G?.hearts,met:G?.met,stats:G?.stats,asked:G?.asked,ending:G?.ending,plays:SAVE.plays,checkpoint:SAVE.run,bot:BOT,thresh:THRESH}));}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});
 context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__noBoot=true;let seed=731;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(url);await setup();assert.equal((await state()).bot,null);
 let choices=0;const started=Date.now(),deadline=started+360000;
 while(Date.now()<deadline){
 const view=await page.evaluate(()=>({blocks:UI.ov.hidden&&UI.set.hidden&&!!UI.blocks.querySelector('.blk:not(:disabled)'),seats:!!document.querySelector('.seats'),summary:!!document.querySelector('.summary-card')}));
 if(view.summary)break;
 if(view.seats){await activate(page.locator('.seats .seat').first());await page.waitForFunction(()=>!document.querySelector('.seats'));continue;}
  if(view.blocks){
   await page.evaluate(()=>Engine.speed=1);
   await page.waitForFunction(()=>getComputedStyle(UI.panel).transform==='none'&&[...UI.blocks.querySelectorAll('.blk:not(:disabled)')].every(b=>b._fx&&b._fx.y===0&&b._fx.s===1&&b._fx.o===1));
   // Read displayed tags and the current girl's authored weights. This is ideal
   // source-based strategy; every choice is a fresh native touchscreen tap.
   const index=await page.evaluate(()=>{const rig=UI.stage.querySelector('.girl')?._rig,g=byKey(rig.key);const bs=[...UI.blocks.querySelectorAll('.blk')];return bs.map((b,i)=>({i,w:Object.entries(TAGS).filter(([t,v])=>b.querySelector('.tag').textContent.includes(v.label)).map(([t])=>g.likes[t]??0)[0]??-9})).sort((a,b)=>b.w-a.w)[0].i;});
   const old=await page.locator('.blk:not(:disabled)').first().elementHandle();await activate(page.locator('.blk').nth(index));choices++;
   await page.waitForFunction(e=>!e.isConnected||e.disabled,old);await old.dispose();continue;
  }
 await page.waitForTimeout(25);
 }
 await page.locator('.summary-card').waitFor();const summary=await state();
 assert.equal(summary.day,1);assert.equal(summary.stats.exchanges,9);assert.equal(summary.stats.dates,3);assert.equal(summary.bot,null);assert.equal(summary.thresh,80);assert.equal(await page.evaluate(()=>Engine.speed),1);assert.equal(await page.evaluate(()=>!!SAVE.fast),false);assert.deepEqual(errors,[]);
 trace.push({event:'normal-speed-day1-summary',wallSeconds:(Date.now()-started)/1000,choices,...summary});await page.screenshot({path:path.join(__dirname,'opening-touch-summary.png')});console.log('PASS normal-speed opening day: '+choices+' touch fragments, nine exchanges, three meetings');
})().catch(e=>{console.error(e);process.exitCode=1;trace.push({event:'failure',message:e.message});}).finally(async()=>{if(context)await context.close();if(browser)await browser.close();fs.writeFileSync(path.join(__dirname,'opening-touch-results.json'),JSON.stringify({status:process.exitCode?'Failed':'Completed with normal cleanup',scope:'Native emulated touch, Engine1, default typewriter, ideal read-only weights, no progression injection/BOT',errors,trace},null,2));});
