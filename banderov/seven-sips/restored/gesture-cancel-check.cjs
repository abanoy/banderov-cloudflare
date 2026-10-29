const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});const c=await b.newContext();try{
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__noBoot=true);if(process.env.SEVEN_EXPECT_BASELINE==='1')await p.route('**/src/all.js',r=>r.fulfill({contentType:'application/javascript',body:require('node:fs').readFileSync(path.join(__dirname,'../recovery/all-before-gesture-fix.js'),'utf8')}));await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);Engine.speed=1;newRun();});
 for(const [key,name] of [['The Waitress','curtsy'],['The Scientist','ponder']]){
  const before=errors.length;
  await p.evaluate(async([key,name])=>{clearStage();const r=addGirl(key);r.gestureName=null;const done=r.gesture(name);await Engine.wait(.04);await r.emote('blush');await done;await Engine.wait(.1);if(r.gest!==null||r.busy)throw Error('Gesture/emote did not settle');},[key,name]);
  assert.equal(errors.length-before,process.env.SEVEN_EXPECT_BASELINE==='1'?1:0,key+' cancelled parallel gesture branch');
  console.log(key+': cancelled '+name+' settles; page errors='+String(errors.length-before));
 }
}finally{await c.close();await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
