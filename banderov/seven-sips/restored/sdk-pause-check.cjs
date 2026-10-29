const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const c=await browser.newContext(),p=await c.newPage();await p.addInitScript(()=>{window.__noBoot=true;window.calls=[];window.CrazyGames={SDK:{environment:'local',init:async()=>{},data:{getItem:()=>null,setItem:()=>{}},game:{settings:{},addSettingsChangeListener:()=>{},loadingStart:()=>{},loadingStop:()=>{},gameplayStart:()=>calls.push('start'),gameplayStop:()=>calls.push('stop')}}};});
 await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);newRun();showPanel(true);CG.gameplayStart();Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));UI.set.querySelector('[data-k="resume"]').click();});
 const hidden=await p.evaluate(()=>({paused:Engine.paused,menu:!UI.set.hidden,calls:[...calls]}));console.log({hidden});
 if(process.env.SEVEN_EXPECT_BASELINE==='1'){assert.deepEqual(hidden.calls,['start','stop','start']);assert.equal(hidden.paused,true);}
 else{assert.deepEqual(hidden.calls,['start','stop']);assert.equal(hidden.paused,true);assert.equal(hidden.menu,true);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await p.evaluate(()=>Engine.paused),true);await p.getByRole('button',{name:'Resume',exact:true}).click();assert.deepEqual(await p.evaluate(()=>calls),['start','stop','start']);assert.equal(await p.evaluate(()=>Engine.paused),false);}
 if(process.env.SEVEN_EXPECT_BASELINE!=='1'){
  await p.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('blur'));});
  assert.deepEqual(await p.evaluate(()=>calls),['start','stop','start','stop']);
  await p.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await p.evaluate(()=>Engine.paused),true);
  await p.getByRole('button',{name:'Resume',exact:true}).focus();await p.keyboard.press('Space');
  assert.deepEqual(await p.evaluate(()=>calls),['start','stop','start','stop','start']);
  await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  assert.deepEqual(await p.evaluate(()=>calls),['start','stop','start','stop','start','stop','start']);
  await p.evaluate(()=>{Engine.speed=5;SAVE.fast=true;G.day=7;endLonely();});await p.locator('.ending').waitFor();
  const stopped=await p.evaluate(()=>calls.length);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>calls.length),stopped,'ending settings must not restart gameplay');
 }
 await c.close();
 if(process.env.SEVEN_EXPECT_BASELINE!=='1'){
  const c2=await browser.newContext(),p2=await c2.newPage();await p2.addInitScript(()=>{window.calls=[];window.CrazyGames={SDK:{environment:'local',init:async()=>{},data:{getItem:()=>null,setItem:()=>{}},game:{settings:{},addSettingsChangeListener:()=>{},loadingStart:()=>{},loadingStop:()=>{},gameplayStart:()=>calls.push('start'),gameplayStop:()=>calls.push('stop')}}};});
  await p2.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p2.locator('.blk:not(:disabled)').first().waitFor();
  await p2.keyboard.press('Escape');await p2.keyboard.press('Escape');assert.deepEqual(await p2.evaluate(()=>calls),[],'cold-open settings are not an active week');await c2.close();
 }
 console.log('Hidden/visible-blur/repeated pause/native resume/ending/title SDK lifecycle fixtures passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
