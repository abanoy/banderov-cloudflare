const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const mode of ['resume','suspend']){
  const c=await browser.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__noBoot=true;const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...a){super(...a);window.audioCtx=this;}};});
  await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);await p.evaluate(()=>{window.TRACKS={};Sound.setSfx(false);Sound.music('date');});await p.keyboard.press('x');await p.waitForFunction(()=>Sound.ready);
  await p.evaluate(async mode=>{const a=audioCtx;window.original=a[mode].bind(a);if(mode==='resume')await a.suspend();a[mode]=()=>Promise.reject(new DOMException('fixture transition rejected','InvalidStateError'));Sound.hideMute(mode==='suspend');Sound.adMute(mode==='suspend');},mode);
  await p.waitForTimeout(200);console.log({mode,rejections:errors.length});assert.equal(errors.length,process.env.SEVEN_EXPECT_BASELINE==='1'?2:0);
  if(process.env.SEVEN_EXPECT_BASELINE!=='1')await p.evaluate(mode=>{audioCtx[mode]=()=>{throw new DOMException('fixture synchronous transition failure','InvalidStateError');};Sound.hideMute(mode==='suspend');Sound.adMute(mode==='suspend');},mode);
  // Restore native transition methods and recover through a fresh trusted key.
  await p.evaluate(mode=>{audioCtx[mode]=original;Sound.hideMute(false);Sound.adMute(false);},mode);await p.keyboard.press('x');await p.waitForFunction(()=>audioCtx.state==='running');const before=await p.evaluate(()=>audioCtx.currentTime);await p.waitForTimeout(250);assert.ok(await p.evaluate(()=>audioCtx.currentTime)>before);
  await c.close();
 }
 console.log('Rejected hide/ad transitions and native context recovery fixture passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
