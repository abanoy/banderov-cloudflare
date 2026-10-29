const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const page=await browser.newPage();await page.addInitScript(()=>window.__noBoot=true);
 await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await page.waitForFunction(()=>UI.snd);
 const result=await page.evaluate(()=>{
  Sound.setMusic(false);Sound.setSfx(false);newRun();G.day=2;G.best={w:1,said:'Hello',who:'Waitress',reply:'Hi'};
  G.stats.battle={bar:10,taps:5};G.nextSeats=['The Waitress','The Scientist'];G.crossed={'The Waitress':1};snapshot();
  const before=JSON.stringify(SAVE.run);
  G.hearts['The Waitress']+=10;G.met['The Waitress']++;G.lineIx['The Waitress']++;
  G.stats.exchanges++;G.stats.battle.bar=40;G.best.said='Later';G.nextSeats.reverse();G.crossed['The Scientist']=1;
  // Settings/tips also persist SAVE during a day; the checkpoint must stay at day start.
  CG.save(SAVE);const after=JSON.stringify(cleanSave(CG.load()).run);
  const snapshotDetached=before===after;
  const sn=JSON.parse(before);restore(sn);
  G.hearts['The Waitress']+=20;G.stats.battle.bar=90;G.nextSeats.reverse();
  const restoreDetached=JSON.stringify(sn)===before;
  return {snapshotDetached,restoreDetached};
 });console.log(result);
 if(process.env.SEVEN_EXPECT_BASELINE==='1'){assert.equal(result.snapshotDetached,false);assert.equal(result.restoreDetached,false);console.log('Baseline mutable day-start checkpoint reproduced.');return;}
 assert.equal(result.snapshotDetached,true);assert.equal(result.restoreDetached,true);
 const saved=await page.evaluate(()=>CG.load().run);
 await page.reload();await page.waitForFunction(()=>UI.snd);
 await page.evaluate(()=>{Engine.speed=8;Sound.setMusic(false);Sound.setSfx(false);SAVE.fast=true;main();});
 await page.locator('.blk:not(:disabled)').first().waitFor();
 await page.locator('.titlebar .cont').click();
 await page.waitForFunction(()=>G&&G.day===2&&!document.querySelector('.titlebar'));
 assert.equal(await page.evaluate(()=>G.stats.exchanges),saved.stats.exchanges);
 assert.deepEqual(await page.evaluate(()=>G.hearts),saved.hearts);
 assert.equal(await page.evaluate(()=>SAVE.run.day),2);
 console.log('Day-start checkpoint remains detached across live play/settings save and resumed play.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
