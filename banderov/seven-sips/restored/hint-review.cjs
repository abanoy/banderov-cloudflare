const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const c=await browser.newContext({viewport:{width:320,height:568}}),p=await c.newPage();await p.addInitScript(()=>window.__noBoot=true);await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);newRun();UI.blocks.innerHTML='';});
 for(const id of ['build','meter']){
  await p.evaluate(id=>tip(id,id==='build'?590:70),id);await p.waitForTimeout(350);
  const tip=p.locator('.tip').filter({hasText:id==='build'?'opener':'Meet her'});const b=await tip.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=320&&b.y>=0&&b.y+b.height<=568);await p.screenshot({path:path.join(__dirname,'hint-'+id+'-320.png')});await p.evaluate(()=>document.querySelectorAll('.tip').forEach(e=>e.remove()));
 }
 await c.close();console.log('Both clarified contextual hints contained at320x568.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
