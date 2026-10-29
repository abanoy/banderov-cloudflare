// Seeded real player battle; native mouse buttons, original battle clock, BOT absent.
const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER}),c=await b.newContext({viewport:{width:390,height:844}});try{
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.__noBoot=true);
 if(process.env.SEVEN_EXPECT_BASELINE==='1')await p.route('**/src/all.js',r=>r.fulfill({contentType:'application/javascript',body:require('node:fs').readFileSync(path.join(__dirname,'../recovery/all-before-yap-pointer.js'),'utf8')}));
 await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);newRun();G.day=7;Engine.speed=8;argument('The Waitress','The Scientist');});
 await p.locator('.yap.go').waitFor();await p.evaluate(()=>Engine.speed=1);assert.equal(await p.evaluate(()=>BOT),null);
 const z=await p.locator('.yap-zone.l').boundingBox(),knob=p.locator('.knob'),xy={x:z.x+z.width/2,y:z.y+z.height*.8};
 for(const button of ['right','middle']){const old=await knob.evaluate(e=>e.style.transform);await p.mouse.click(xy.x,xy.y,{button});const now=await knob.evaluate(e=>e.style.transform);if(process.env.SEVEN_EXPECT_BASELINE==='1')assert.notEqual(now,old);else assert.equal(now,old);console.log(button+': '+(process.env.SEVEN_EXPECT_BASELINE==='1'?'unwanted battle tap reproduced':'battle unchanged'));}
 const old=await knob.evaluate(e=>e.style.transform);await p.mouse.click(xy.x,xy.y);assert.notEqual(await knob.evaluate(e=>e.style.transform),old);await p.keyboard.press('ArrowLeft');assert.deepEqual(errors,[]);console.log('Primary mouse and keyboard still active; no page errors.');
}finally{await c.close();await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
