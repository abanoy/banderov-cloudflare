const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__noBoot=true;window.slotKeys=new Set();
  const add=Document.prototype.addEventListener,remove=Document.prototype.removeEventListener;
  Document.prototype.addEventListener=function(t,f,...args){if(t==='keydown'&&String(f).includes('btns[n]'))slotKeys.add(f);return add.call(this,t,f,...args);};
  Document.prototype.removeEventListener=function(t,f,...args){if(t==='keydown')slotKeys.delete(f);return remove.call(this,t,f,...args);};
 });
 await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));
 await page.waitForFunction(()=>UI.snd);
 await page.evaluate(()=>{Engine.speed=8;Sound.setMusic(false);Sound.setSfx(false);SAVE.fast=true;main();});
 for(let i=0;i<6;i++){
  await page.locator('.blk:not(:disabled)').first().waitFor();
  assert.equal(await page.evaluate(()=>slotKeys.size),1);
  await (process.env.SEVEN_EXPECT_BASELINE==='1'?page.locator('.titlebar .end'):page.getByRole('button',{name:'Endings and sticker collection',exact:true})).click();await page.locator('.endings-card').waitFor();
  const keys=await page.evaluate(()=>slotKeys.size);
  if(process.env.SEVEN_EXPECT_BASELINE==='1'){assert.equal(keys,1);console.log('Baseline leaked pending cold-open reply handler after gallery navigation.');return;}
  assert.equal(keys,0,'leaving cold open must release its pending reply handler');
  await page.getByRole('button',{name:'Back',exact:true}).click();
 }
 await page.locator('.blk:not(:disabled)').first().waitFor();
 await page.keyboard.press('1');await page.waitForFunction(()=>G&&G.day===1);
 assert.equal(await page.locator('.titlebar').count(),0);
 assert.deepEqual(errors,[]);console.log('Six Endings/back cycles release old reply handlers; current opener still starts day 1.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
