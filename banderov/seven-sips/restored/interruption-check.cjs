const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.__noBoot=true);
 await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await page.waitForFunction(()=>UI.snd);
 await page.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);newRun();showPanel(true);window.pickDone=false;chooseSlot([{text:'Hello',tag:'sweet'}],30,byKey('The Waitress')).then(()=>pickDone=true);});
 await page.waitForTimeout(350);await page.keyboard.down('Escape');await page.keyboard.down('Escape');
 const heldPause=await page.evaluate(()=>!UI.set.hidden&&Engine.paused);await page.keyboard.up('Escape');
 if(await page.evaluate(()=>!UI.set.hidden))await page.getByRole('button',{name:'Resume',exact:true}).click();
 // Explicit browser lifecycle fixture: hidden before blur, visible before Resume.
 // This verifies handler ordering, not a physical OS/device interruption.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));});
 const before=await page.locator('.t-fill').getAttribute('style');await page.waitForTimeout(450);
 assert.equal(await page.locator('.t-fill').getAttribute('style'),before,'timer freezes while hidden/paused');
 await page.keyboard.press('1');assert.equal(await page.evaluate(()=>pickDone),false);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
 assert.equal(await page.evaluate(()=>!UI.set.hidden&&Engine.paused),true,'focus alone retains pause');
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 const resumed=await page.evaluate(()=>!Engine.paused);
 console.log(JSON.stringify({heldPause,resumed,errors}));
 if(process.env.SEVEN_EXPECT_BASELINE==='1'){assert.equal(heldPause,false);assert.equal(resumed,false);console.log('Both interruption defects reproduced.');}
 else {assert.equal(heldPause,true);assert.equal(resumed,true);await page.waitForTimeout(250);assert.notEqual(await page.locator('.t-fill').getAttribute('style'),before);await page.keyboard.press('1');await page.waitForFunction(()=>pickDone);assert.deepEqual(errors,[]);console.log('Held Escape and hidden-before-blur resume/timer/input passed.');}
 await context.close();
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
