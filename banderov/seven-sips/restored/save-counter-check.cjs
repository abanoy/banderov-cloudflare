const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const c=await b.newContext({viewport:{width:320,height:568}}),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__noBoot=true);
 await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 const r=await p.evaluate(()=>{
  Sound.setMusic(false);Sound.setSfx(false);Engine.speed=5;
  SAVE=cleanSave({v:2,plays:.5,sigmaIx:.5,endings:{lonely:'2',futureEnding:'keep'},stickers:{first:1}});
  newRun();const threshold=THRESH;record('lonely');
  const malformed={threshold,plays:SAVE.plays,ending:SAVE.endings.lonely,sigmaIx:SAVE.sigmaIx,future:SAVE.endings.futureEnding,sticker:SAVE.stickers.first};
  const valid=cleanSave({v:2,plays:3,sigmaIx:2,endings:{lonely:4}});SAVE=valid;newRun();const validThreshold=THRESH;record('lonely');
  const retained={threshold:validThreshold,plays:SAVE.plays,ending:SAVE.endings.lonely,sigmaIx:SAVE.sigmaIx};
  const invalid=[-1,1.2,Number.MAX_SAFE_INTEGER+1,Infinity,'2'].map(value=>{const s=cleanSave({v:2,plays:value,sigmaIx:value});return {plays:s.plays??null,sigmaIx:s.sigmaIx??null};});
  SAVE=cleanSave({v:2,sigmaIx:.5});newRun();SAVE.fast=true;
  const rig={emote(){},destroy(){}};herSay=async()=>{};
  endSigma(rig,rig);
  return {malformed,retained,invalid,firstLine:ENDINGS.sigma.subs[0]};
 });
 await p.locator('.ending').waitFor();const text=await p.locator('.ending').innerText();
 const baseline=process.env.SEVEN_EXPECT_BASELINE==='1';
 assert.equal(r.malformed.threshold,baseline?100:80);assert.equal(r.malformed.plays,baseline?1.5:1);
 assert.equal(r.malformed.ending,baseline?'21':1);assert.equal(r.malformed.sigmaIx,baseline?.5:undefined);
 assert.equal(r.malformed.future,'keep');assert.equal(r.malformed.sticker,1);
 assert.deepEqual(r.retained,{threshold:100,plays:4,ending:5,sigmaIx:2});
 if(baseline)assert.ok(text.includes('undefined'));else{assert.ok(text.includes(r.firstLine));assert.ok(!text.includes('undefined'));for(const s of r.invalid)assert.deepEqual(s,{plays:null,sigmaIx:null});}
 assert.deepEqual(errors,[]);await c.close();console.log(baseline?'Baseline reproduced fractional replay counters, string count concatenation and undefined ending subtitle.':'Save counters and actual walk-away ending passed; valid progress/future entries retained.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
