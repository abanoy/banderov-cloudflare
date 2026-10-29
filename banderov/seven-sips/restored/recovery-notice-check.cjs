const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const mode of ['week','json','future']){
  const c=await browser.newContext({viewport:{width:320,height:568}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(mode=>{localStorage.setItem('sevensips_recovered_v1',mode==='json'?'{unreadable':JSON.stringify({v:mode==='future'?999:2,endings:{lonely:1},run:{day:2}}));window.__noBoot=true;},mode);
  await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
  if(mode==='future') await p.evaluate(()=>{newRun();G.day=2;snapshot();const s=CG.load();s.v=999;SAVE=cleanSave(s);});
  await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);Engine.speed=5;SAVE.fast=true;main();});await p.locator('.recovery-card').waitFor();
  const b=await p.getByRole('button',{name:'Start a new week',exact:true}).boundingBox();assert.ok(b.y>=0&&b.y+b.height<=568);
  if(mode==='week'){
   await p.screenshot({path:path.join(__dirname,'checkpoint-recovery-320.png')});await p.getByRole('button',{name:'Endings',exact:true}).focus();await p.keyboard.press('Enter');await p.locator('.endings-card').waitFor();assert.equal(await p.locator('.tile.got .tn').filter({hasText:'Alone'}).count(),1);await p.getByRole('button',{name:'Back',exact:true}).focus();await p.keyboard.press('Space');
  }else {await p.getByRole('button',{name:'Start a new week',exact:true}).focus();await p.keyboard.press('Enter');}
  await p.locator('.blk:not(:disabled)').first().waitFor();assert.equal(await p.locator('.recovery-card').count(),0);assert.equal(await p.locator('.titlebar .cont').count(),0);await p.keyboard.press('1');await p.waitForFunction(()=>G&&G.day===1&&!document.querySelector('.titlebar'));assert.deepEqual(errors,[]);await c.close();console.log(mode+': notice/native navigation/clean new week passed');
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
