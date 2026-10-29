const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(()=>window.__noBoot=true);
 await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await page.waitForFunction(()=>UI.snd);
 const r=await page.evaluate(()=>{
  Sound.setMusic(false);Sound.setSfx(false);newRun();G.day=2;G.nextSeats=GIRLS.slice(0,2).map(g=>g.key);snapshot();const good=JSON.parse(JSON.stringify(SAVE));
  const cleanPatch=p=>{const s=JSON.parse(JSON.stringify(good));Object.assign(s.run,p);return cleanSave(s).run;};
  const badSeats=[[],[GIRLS[0].key],[GIRLS[0].key,GIRLS[0].key],GIRLS.slice(0,3).map(g=>g.key)].map(nextSeats=>cleanPatch({nextSeats}).nextSeats);
  const badThresholds=[-5,0,100000,'100'].map(thresh=>cleanPatch({thresh}).thresh);
  const blocked=GIRLS.slice(1).map(g=>g.key),one=cleanPatch({blocked,nextSeats:[GIRLS[0].key]}).nextSeats;
  const empty=cleanPatch({blocked:GIRLS.map(g=>g.key),nextSeats:[]}).nextSeats;
  const valid=[THRESH_FIRST,100].map(thresh=>cleanPatch({thresh}).thresh);
  return {badSeats,badThresholds,one,empty,valid,original:good.run.nextSeats,roundtrip:cleanSave(JSON.parse(JSON.stringify(good))).run.nextSeats};
 });console.log(r);
 if(process.env.SEVEN_EXPECT_BASELINE==='1'){assert.ok(r.badSeats.every(x=>x!==null));assert.equal(r.badThresholds[2],100000);console.log('Malformed seat plans and impossible threshold accepted in baseline.');}
 else {assert.ok(r.badSeats.every(x=>x===null));assert.ok(r.badThresholds.every(x=>x===100));assert.deepEqual(r.roundtrip,r.original);assert.equal(r.one.length,1);assert.deepEqual(r.empty,[]);assert.deepEqual(r.valid,[80,100]);}
 // Actual boot continues even when storage is unavailable or the JSON is broken.
 for(const mode of ['blocked','broken']){
  const c=await browser.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(mode=>{const nativeGet=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k==='sevensips_recovered_v1'){if(mode==='blocked')throw new DOMException('Unavailable','SecurityError');return '{broken';}return nativeGet.call(this,k);};if(mode==='blocked')Storage.prototype.setItem=()=>{throw new DOMException('Unavailable','QuotaExceededError');};},mode);
  await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));if(mode==='broken')await p.getByRole('button',{name:'Start a new week',exact:true}).click();await p.locator('.blk:not(:disabled)').first().waitFor();await p.keyboard.press('1');await p.waitForFunction(()=>G&&G.day===1&&!document.querySelector('.titlebar'));assert.deepEqual(errors,[]);await c.close();
 }
 await context.close();console.log('Unavailable/broken storage cold open starts a fresh week without page errors.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
