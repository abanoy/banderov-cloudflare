// Focused player-path test. Seed Day 7 rather than replaying six café days;
// BOT stays absent. Inputs, battle clock/scoring and argument transitions are real.
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
const url='file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/');
async function start(browser,touch=false){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:touch,isMobile:touch});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>window.__noBoot=true);await page.goto(url);
 await page.waitForFunction(()=>UI.snd&&SAVE);
 await page.evaluate(()=>{
  Sound.setMusic(false);Sound.setSfx(false);SAVE.fast=true;
  newRun();G.day=7;G.hearts['The Waitress']=120;G.hearts['The Scientist']=120;
  // Accelerate only entry/exit presentation. Set speed back to 1 at GO.
  Engine.speed=8;window.argumentResult=null;
  argument('The Waitress','The Scientist').then(v=>window.argumentResult=v);
 });
 await page.locator('.yap.go').waitFor();await page.evaluate(()=>Engine.speed=1);
 assert.equal(await page.evaluate(()=>BOT),null);
 for(const side of ['l','r']){
  const box=await page.locator('.yap-zone.'+side).boundingBox();assert.ok(box.width>100&&box.height>100);
  assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=391&&box.y+box.height<=845,JSON.stringify({box,viewport:await page.evaluate(()=>({w:innerWidth,h:innerHeight}))}));
 }
 return {page,context,errors};
}
async function input(page,kind,side){
 if(kind==='keyboard')return page.keyboard.press(side==='l'?'ArrowLeft':'ArrowRight');
 const b=await page.locator('.yap-zone.'+side).boundingBox();
 // Tap the visible lower zone, away from flying word decorations.
 const x=b.x+b.width/2,y=b.y+b.height*.8;
 if(kind==='touch')await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
}
async function finish(page){
 await page.waitForFunction(()=>G.stats.battle,null,{timeout:18000});
 const stats=await page.evaluate(()=>G.stats.battle);
 await page.evaluate(()=>Engine.speed=8);
 await page.waitForFunction(()=>!document.querySelector('.yap'));
 assert.equal(await page.evaluate(()=>G.inBattle),false);
 return stats;
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});
 try{
  for(const [kind,side] of [['keyboard','l'],['mouse','r'],['touch','l']]){
   if(process.env.SEVEN_YAP_KIND&&kind!==process.env.SEVEN_YAP_KIND)continue;
   const {page,context,errors}=await start(browser,kind==='touch');
   await page.screenshot({path:path.join(__dirname,'yap-'+kind+'.png')});
   // Check a presented control changes the battle, then pause blocks all inputs and time.
   const before=await page.locator('.knob').evaluate(e=>e.style.transform);
   await input(page,kind,side);
   assert.notEqual(await page.locator('.knob').evaluate(e=>e.style.transform),before);
   const pause=page.getByRole('button',{name:'Settings and pause'});
   if(kind==='touch')await pause.tap();else await pause.click();
   const frozen=await page.locator('.yap').evaluate(e=>[e.querySelector('.knob').style.transform,e.querySelector('.yap-time i').style.transform,e.querySelector('.combo').textContent]);
   await page.keyboard.press('ArrowLeft');await page.keyboard.press('2');await page.waitForTimeout(700);
   assert.deepEqual(await page.locator('.yap').evaluate(e=>[e.querySelector('.knob').style.transform,e.querySelector('.yap-time i').style.transform,e.querySelector('.combo').textContent]),frozen);
   const resume=page.getByRole('button',{name:'Resume',exact:true});
   if(kind==='touch')await resume.tap();else await resume.click();
   // A held key/repeated keydown must not count as a second tap.
   await page.keyboard.down('a');const once=await page.locator('.knob').evaluate(e=>e.style.transform);
   await page.keyboard.down('a');assert.equal(await page.locator('.knob').evaluate(e=>e.style.transform),once);await page.keyboard.up('a');
   for(let i=0;i<60&&!await page.evaluate(()=>!!G.stats.battle);i++)await input(page,kind,side);
   const stats=await finish(page);assert.equal(stats.choice,side==='l'?'a':'b');assert.ok(stats.supers>=1);
   await page.waitForFunction(()=>UI.day.textContent==='Day 7 \u00b7 The date');
   assert.equal(await page.locator('.girl').count(),1);
   // Old battle handlers must not respond during the date.
   const saved=JSON.stringify(stats);await page.keyboard.press('ArrowRight');
   assert.equal(JSON.stringify(await page.evaluate(()=>G.stats.battle)),saved);
   assert.deepEqual(errors,[]);console.log(kind+': actual '+stats.choice+' battle win, pause/resume, held-key guard, combo and final-date transition passed');
   await context.close();
  }
  for(const choice of ['both','walk']){
   if(process.env.SEVEN_YAP_KIND)continue;
   const {page,context,errors}=await start(browser);
   if(choice==='both')for(let i=0;i<6;i++)await input(page,'keyboard',i%2?'r':'l');
   // Leave the actual 12-second battle clock unaccelerated through the outcome.
   const stats=await finish(page);assert.equal(stats.choice,choice);
   await page.waitForFunction(()=>G.ending);
   assert.equal(await page.evaluate(()=>G.ending),choice==='both'?'hares':'sigma');
   await page.screenshot({path:path.join(__dirname,'yap-'+choice+'.png')});
   await page.getByRole('button',{name:'Play again',exact:true}).click();
   // argument() returns a navigation instruction; production main() consumes it.
   await page.waitForFunction(()=>window.argumentResult==='again');
   await page.evaluate(()=>{main(window.argumentResult);});
   await page.waitForFunction(()=>G.day===1&&UI.panel.classList.contains('up'));
   assert.equal(await page.locator('.yap').count(),0);
   assert.equal(await page.evaluate(()=>G.inBattle),undefined);
   assert.deepEqual(errors,[]);console.log(choice+': real-clock outcome, ending and retry into day 1 passed');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
