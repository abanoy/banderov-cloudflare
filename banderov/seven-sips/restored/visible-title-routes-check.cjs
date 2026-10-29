const{chromium}=require(process.env.SEVEN_PLAYWRIGHT),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{const rows=[];
for(const mode of ['source','portal'])for(const[width,height]of[[320,568],[568,320],[568,240]])for(const route of ['new','continue','library','expanded','early']){
 const c=await browser.newContext({viewport:{width,height},hasTouch:true}),p=await c.newPage(),errors=[];p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__noBoot=true);await p.goto('file:///'+path.join(__dirname,mode==='source'?'':'dist/portal','index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 const saved=await p.evaluate(route=>{Sound.setMusic(false);Sound.setSfx(false);Engine.speed=route==='early'?1:8;SAVE.fast=true;if(['continue','library','expanded'].includes(route)){SAVE.plays=1;SAVE.endings={'win:The Waitress':1};newRun();G.day=3;G.stats.exchanges=18;snapshot();}main('title');return JSON.stringify(SAVE.run);},route);
 const end=p.getByRole('button',{name:'Endings and sticker collection',exact:true});await end.waitFor();assert.equal(await p.locator('.phone-menu').count(),0);if(route!=='early')await p.locator('.blk:not(:disabled)').first().waitFor();
 if(route==='new'){
  assert.equal(await p.getByRole('button',{name:'Expanded Mode',exact:true}).isDisabled(),true);assert.equal(await p.locator('.cont').count(),0);
  await p.setViewportSize({width:1280,height:720});await p.waitForFunction(()=>UI.titleBar.parentElement.id==='game');await p.setViewportSize({width,height});await p.waitForFunction(()=>UI.titleBar.parentElement===document.body);
  await p.getByRole('button',{name:'Settings and pause',exact:true}).tap();await p.getByRole('dialog',{name:'Paused',exact:true}).waitFor();assert.equal(await p.evaluate(()=>UI.titleBar.inert),true);assert.equal(await p.evaluate(()=>UI.panel.inert),true);
  await p.keyboard.press('Escape');await p.waitForFunction(()=>UI.set.hidden);assert.equal(await p.evaluate(()=>UI.titleBar.inert),false);await p.keyboard.press('1');await p.waitForFunction(()=>G?.day===1&&!document.querySelector('.titlebar'));assert.equal(await p.evaluate(()=>document.body.classList.contains('phone-title-controls')),false);
 }else if(route==='continue'){
  await p.getByRole('button',{name:'Continue from the start of Day 3',exact:true}).tap();await p.waitForFunction(()=>G?.day===3&&!document.querySelector('.titlebar'));assert.equal(await p.evaluate(()=>G.stats.exchanges),18);
 }else if(route==='expanded'){
  await p.getByRole('button',{name:'Expanded Mode',exact:true}).tap();await p.getByRole('heading',{name:'Three more weeks',exact:true}).waitFor();assert.equal(await p.evaluate(()=>JSON.stringify(SAVE.run)),saved);
 }else{
  await end.tap();await p.locator('.endings-card').waitFor();assert.equal(await p.locator('.titlebar').count(),0);
  if(route==='library'){await p.getByRole('button',{name:'Back',exact:true}).focus();await p.keyboard.press('Enter');await end.waitFor();await p.locator('.blk:not(:disabled)').first().waitFor();assert.equal(await p.locator('.titlebar').count(),1);assert.equal(await p.evaluate(()=>document.activeElement===UI.titleBar.querySelector('.end')),true,'collection Back focus returns to Endings');assert.equal(await p.evaluate(()=>JSON.stringify(SAVE.run)),saved);}
 }
 assert.deepEqual(errors,[]);rows.push({mode,width,height,route,errors});fs.writeFileSync(path.join(__dirname,'visible-title-routes-results.json'),JSON.stringify(rows,null,2));await c.close();console.log('PASS '+mode+' '+width+'x'+height+' '+route);
} }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
