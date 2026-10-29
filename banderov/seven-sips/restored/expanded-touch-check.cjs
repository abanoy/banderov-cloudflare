const {chromium}=require(process.env.SEVEN_PLAYWRIGHT),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>window.__noBoot=true);await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 await p.evaluate(async()=>{Sound.setMusic(false);Sound.setSfx(false);SAVE.fast=true;Engine.speed=12;newRun();G.day=7;G.hearts['The Scientist']=127;const r=addGirl('The Scientist');await enter(r);endWin(r).then(next=>{main(next);});});
 async function tap(name){const loc=p.getByRole('button',{name,exact:true});await loc.waitFor();await p.waitForTimeout(400);const box=await loc.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844);await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
 await p.locator('.ending.win').waitFor();await tap('Expanded Mode');await tap('Save a winning relationship');await tap('Scientist');await tap('Save 1 · Scientist · Day 8');await tap('Continue day 8');
 await p.waitForFunction(()=>UI.ov.hidden&&[...UI.blocks.children].some(e=>!e.disabled));assert.equal(await p.evaluate(()=>G.hearts['The Scientist']),127);
 await p.keyboard.press('Escape');await tap('Resume');
 for(let n=0;n<9;n++){await p.waitForFunction(()=>UI.ov.hidden&&[...UI.blocks.children].some(e=>!e.disabled));await p.waitForTimeout(80);const box=await p.locator('.blk:not(:disabled)').first().boundingBox();await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await p.waitForTimeout(50);}
 await p.getByRole('heading',{name:'Day 8 complete',exact:true}).waitFor();assert.equal(await p.evaluate(()=>SAVE.expanded.slots[0].day),9);assert.equal(await p.evaluate(()=>SAVE.expanded.slots[0].exchanges),3);
 await p.screenshot({path:path.join(__dirname,'expanded-touch-390.png')});assert.deepEqual(errors,[]);console.log('PASS actual seeded Quick Match win card → native touch save/day 8, pause/resume, three exchanges, carried127 hearts, no errors');
 }finally{await c.close();await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
