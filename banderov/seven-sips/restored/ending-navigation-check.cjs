const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const route of ['Endings','Title']){
  const context=await browser.newContext({viewport:{width:320,height:568}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.__noBoot=true);
  await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await page.waitForFunction(()=>UI.snd);
  await page.evaluate(()=>{
   Sound.setMusic(false);Sound.setSfx(false);Engine.speed=5;SAVE.fast=true;
   newRun();G.day=7;snapshot();window.beforePlays=SAVE.plays||0;
   endLonely().then(next=>main(next));
  });
  await page.locator('.ending').waitFor();await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>!!SAVE.run),false);
  assert.equal(await page.evaluate(()=>SAVE.plays),await page.evaluate(()=>beforePlays+1));
  // Native button activation follows the same navigation result consumed by main.
  await page.getByRole('button',{name:route,exact:true}).focus();await page.keyboard.press('Enter');
  if(route==='Endings'){
   await page.locator('.endings-card').waitFor();
   assert.equal(await page.locator('.tile.got .tn').filter({hasText:'Alone'}).count(),1);
   await page.getByRole('button',{name:'Back',exact:true}).focus();await page.keyboard.press('Space');
  }
  await page.locator('.titlebar').waitFor({state:'attached'});await page.locator('.blk:not(:disabled)').first().waitFor();
  assert.equal(await page.locator('.ending').count(),0);assert.equal(await page.evaluate(()=>UI.curtain.className),'curtain');
  assert.equal(await page.locator('.titlebar .cont').count(),0);
  assert.equal(await page.evaluate(()=>SAVE.plays),await page.evaluate(()=>beforePlays+1));
  assert.equal(await page.evaluate(()=>!!CG.load().endings.lonely),true);
  await page.keyboard.press('1');await page.waitForFunction(()=>G&&G.day===1&&!document.querySelector('.titlebar'));
  assert.equal(await page.evaluate(()=>G.stats.exchanges),0);
  assert.deepEqual(errors,[]);console.log(route+': actual lonely ending → native navigation → cold open → clean new week; saved collection retained.');
  await context.close();
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
