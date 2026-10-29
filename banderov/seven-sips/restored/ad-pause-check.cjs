const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const mode of ['finishPaused','resumePending','lateStart']){
  const c=await browser.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__noBoot=true;window.calls=[];window.CrazyGames={SDK:{environment:'local',init:async()=>{},data:{getItem:()=>null,setItem:()=>{}},ad:{requestAd:(_,cb)=>window.adCallbacks=cb},game:{settings:{},addSettingsChangeListener:()=>{},loadingStart:()=>{},loadingStop:()=>{},gameplayStart:()=>calls.push('start'),gameplayStop:()=>calls.push('stop')}}};});
  await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
  await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);window.muted=false;Sound.adMute=v=>window.muted=v;newRun();CG.gameplayStart();window.adDone=false;CG.midgame().then(()=>adDone=true);});
  if(mode==='lateStart'){
   await p.evaluate(()=>{adCallbacks.adError();adCallbacks.adStarted();});await p.waitForFunction(()=>adDone);
   const muted=await p.evaluate(()=>window.muted);console.log({mode,muted});assert.equal(muted,process.env.SEVEN_EXPECT_BASELINE==='1');
  }else{
   await p.evaluate(()=>{adCallbacks.adStarted();openSettings();});
   if(mode==='resumePending')await p.getByRole('button',{name:'Resume',exact:true}).click();
   if(mode==='finishPaused')await p.evaluate(()=>adCallbacks.adFinished());
   const calls=await p.evaluate(()=>window.calls);console.log({mode,calls});
   assert.deepEqual(calls,process.env.SEVEN_EXPECT_BASELINE==='1'?['start','stop','start']:['start','stop']);
   if(process.env.SEVEN_EXPECT_BASELINE!=='1'){
    if(mode==='finishPaused'){assert.equal(await p.evaluate(()=>Engine.paused),true);await p.getByRole('button',{name:'Resume',exact:true}).focus();await p.keyboard.press('Space');}
    else await p.evaluate(()=>adCallbacks.adFinished());
    await p.waitForFunction(()=>adDone);assert.deepEqual(await p.evaluate(()=>window.calls),['start','stop','start']);
    await p.evaluate(()=>{adCallbacks.adFinished();adCallbacks.adError();adCallbacks.adStarted();});assert.equal(await p.evaluate(()=>window.muted),false);assert.deepEqual(await p.evaluate(()=>window.calls),['start','stop','start']);
   }
  }
  assert.deepEqual(errors,[]);await c.close();
 }
 console.log('Ad/pause/resume/duplicate and late callback fixtures passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
