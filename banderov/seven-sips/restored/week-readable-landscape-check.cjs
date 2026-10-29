// A full production player flow: no BOT, injected hearts/met/day/score or route calls.
// Deterministic randomness and accelerated Engine time make this an ideal controller
// test, not a human reading, balance, phone or audible playtest.
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const url='file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/');
const trace=[],errors=[];let browser,context,page;
function checkpoint(){fs.writeFileSync(path.join(__dirname,'week-readable-landscape-progress.json'),JSON.stringify({status:'running; not a passing result',errors,trace},null,2));}
async function setup(){await page.waitForFunction(()=>UI.snd);await page.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);Engine.speed=4;SAVE.fast=true;main();});}
async function activate(locator){await locator.focus();await page.keyboard.press('Enter');}
async function state(){return page.evaluate(()=>({day:G?.day,hearts:G?.hearts,met:G?.met,stats:G?.stats,asked:G?.asked,ending:G?.ending,plays:SAVE.plays,checkpoint:SAVE.run,bot:BOT,thresh:THRESH}));}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});
 context=await browser.newContext({viewport:{width:568,height:320}});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__noBoot=true;let seed=731;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(url);await setup();assert.equal((await state()).bot,null);
 const summaries=[],seats=[];let resumed=false,battle=false,invited=false,choices=0;
 const deadline=Date.now()+600000;
 while(Date.now()<deadline){
  const view=await page.evaluate(()=>({paused:!UI.set.hidden,ending:!!document.querySelector('.ending'),summary:document.querySelector('.summary-card h2')?.textContent,seats:!!document.querySelector('.seats'),invite:!UI.ov.hidden&&!!UI.ov.querySelector('.phone'),yap:!!document.querySelector('.yap.go'),blocks:UI.ov.hidden&&UI.set.hidden&&!!UI.blocks.querySelector('.blk:not(:disabled)')}));
  assert.equal(view.paused,false,'Unexpected pause in continuous player flow');
  if(view.ending)break;
  if(view.summary){
   const s=await state();assert.equal(s.stats.exchanges,s.day*9);assert.equal(s.thresh,80);summaries.push(s.day);trace.push({event:'summary',...s});
   checkpoint();console.log('End of Day '+s.day+': '+s.stats.exchanges+' actual exchanges, checkpoint '+(s.checkpoint?.day||'none'));
   await activate(page.locator('.summary-card .primary'));await page.waitForFunction(()=>!document.querySelector('.summary-card'));
   if(s.day===2&&!resumed){
    await page.waitForFunction(()=>G.day===3&&UI.blocks.querySelector('.blk:not(:disabled)')&&UI.say.querySelectorAll('.w.empty').length===3);
    await page.keyboard.press('Escape');const checkpoint=await page.evaluate(()=>CG.load().run);
    assert.equal(checkpoint.day,3);assert.equal(checkpoint.stats.exchanges,18);assert.equal(checkpoint.thresh,80);
    await page.reload();await setup();await activate(page.getByRole('button',{name:'Continue from the start of Day 3',exact:true}));
    await page.waitForFunction(()=>G?.day===3&&!document.querySelector('.titlebar')&&UI.blocks.querySelector('.blk:not(:disabled)')&&UI.say.querySelectorAll('.w.empty').length===3);
    const loaded=await state();assert.equal(loaded.stats.exchanges,18);assert.deepEqual(loaded.hearts,checkpoint.hearts);assert.equal(loaded.checkpoint.day,3);assert.equal(loaded.bot,null);
    trace.push({event:'native-reload-continue',checkpoint});resumed=true;console.log('Actual Day 3 checkpoint reloaded; native Continue restored original progress.');
   }
   continue;
  }
  if(view.seats){
   const labels=await page.locator('.seats .seat').allTextContents(),s=await state();
   const targets=['The Waitress','The Scientist'].sort((a,b)=>s.met[a]-s.met[b]);let ix=-1;
   for(const key of targets){ix=labels.findIndex(t=>t.startsWith(key.replace(/^The /,'')));if(ix>=0)break;}
   if(ix<0)ix=0;
   seats.push(labels[ix]);await activate(page.locator('.seats .seat').nth(ix));await page.waitForFunction(()=>!document.querySelector('.seats'));continue;
  }
  if(view.invite){const s=await state();assert.ok(s.asked.length>=1);assert.equal(s.stats.exchanges,54);trace.push({event:'invitation',asked:s.asked});invited=true;await activate(page.locator('.overlay .primary'));await page.waitForFunction(()=>UI.ov.hidden);continue;}
  if(view.yap){
   battle=true;await page.evaluate(()=>Engine.speed=1);for(let i=0;i<80&&!await page.evaluate(()=>!!G.stats.battle);i++)await page.keyboard.press('ArrowLeft');
   await page.waitForFunction(()=>!!G.stats.battle);assert.equal((await state()).stats.battle.choice,'a');trace.push({event:'actual-yap',stats:(await state()).stats.battle});await page.evaluate(()=>Engine.speed=4);await page.waitForFunction(()=>!document.querySelector('.yap'));continue;
  }
  if(view.blocks){
   await page.evaluate(()=>Engine.speed=1);
   // Read displayed tags and the current girl's authored weights. This is ideal
   // source-based strategy; every choice is a fresh native number-key press.
   const index=await page.evaluate(()=>{const rig=UI.stage.querySelector('.girl')?._rig,g=byKey(rig.key);const bs=[...UI.blocks.querySelectorAll('.blk')];return bs.map((b,i)=>({i,w:Object.entries(TAGS).filter(([t,v])=>b.querySelector('.tag').textContent.includes(v.label)).map(([t])=>g.likes[t]??0)[0]??-9})).sort((a,b)=>b.w-a.w)[0].i;});
   const old=await page.locator('.blk:not(:disabled)').first().elementHandle();await page.keyboard.press(String(index+1));choices++;
   await page.waitForFunction(e=>!e.isConnected||e.disabled,old);await old.dispose();await page.evaluate(()=>Engine.speed=4);continue;
  }
  await page.waitForTimeout(25);
 }
 await page.locator('.ending').waitFor();const ended=await state();trace.push({event:'ending',...ended});
 assert.deepEqual(summaries,[1,2,3,4,5,6]);assert.equal(seats.length,6);assert.ok(resumed&&invited);assert.equal(ended.stats.exchanges,58);assert.ok(ended.ending.startsWith('win:'));assert.equal(ended.plays,1);assert.equal(ended.checkpoint,undefined);assert.equal(ended.bot,null);assert.ok(battle,'Expected real player Yap Battle in this deterministic week');
 const collection=await page.evaluate(()=>({endings:SAVE.endings,stickers:SAVE.stickers,secrets:SAVE.secrets}));assert.equal(collection.endings[ended.ending],1);assert.ok(collection.stickers.first);trace.push({event:'collection',collection});
 await page.screenshot({path:path.join(__dirname,'week-readable-landscape-ending.png')});await activate(page.getByRole('button',{name:'Play again',exact:true}));
 await page.waitForFunction(()=>G.day===1&&G.stats.exchanges===0&&UI.blocks.querySelector('.blk:not(:disabled)')&&UI.say.querySelectorAll('.w.empty').length===3);
 const replay=await state();assert.equal(replay.thresh,100);assert.equal(replay.plays,1);assert.equal(replay.ending,undefined);assert.equal(replay.checkpoint,undefined);assert.equal(await page.locator('.yap').count(),0);assert.equal(await page.locator('.ending').count(),0);assert.deepEqual(errors,[]);
 trace.push({event:'native-replay',...replay});console.log('PASS: full BOT-absent native week, six summaries, actual checkpoint Continue, invitation/Yap/date win/collection/replay; '+choices+' fragment presses.');
})().catch(async e=>{console.error(e);process.exitCode=1;if(page){try{trace.push({event:'failure',message:e.message,state:await state()});await page.screenshot({path:path.join(__dirname,'week-readable-landscape-failure.png')});}catch{}}}).finally(async()=>{fs.writeFileSync(path.join(__dirname,'week-readable-landscape-results.json'),JSON.stringify({scope:'Deterministic ideal-weight native keyboard controller; Engine.speed4 for presentation, speed1 while choosing and during actual Yap; seat strategy pursues least-met Waitress/Scientist; one real Day3 checkpoint reload; no injected progression/BOT',errors,trace},null,2));if(context)await context.close();if(browser)await browser.close();fs.writeFileSync(path.join(__dirname,'week-readable-landscape-progress.json'),JSON.stringify({status:process.exitCode?'Failed; see final result':'Completed assertions and browser cleanup',errors,trace},null,2));});
