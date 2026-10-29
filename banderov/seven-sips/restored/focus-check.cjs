const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.__noBoot=true);
 await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await page.waitForFunction(()=>UI.snd);
 await page.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);newRun();showPanel(true);chooseSlot([{text:'Hello',tag:'sweet'}],Infinity,byKey('The Waitress'));});
 await page.locator('.blk').focus();await page.keyboard.press('Escape');
 for(let i=0;i<5;i++)await page.keyboard.press('Tab');
 const tabInside=await page.evaluate(()=>UI.set.contains(document.activeElement));
 await page.keyboard.press('Escape');
 // The ending card's delayed initial focus must not steal pause-menu focus.
 await page.evaluate(()=>{G.day=7;record('lonely');window.nav=null;endScreen('Alone','Try another week','🌙','lonely').then(v=>window.nav=v);});
 await page.locator('.ending').waitFor();await page.keyboard.press('Escape');await page.waitForTimeout(500);
 const delayedInside=await page.evaluate(()=>UI.set.contains(document.activeElement));
 console.log({tabInside,delayedInside});
 if(process.env.SEVEN_EXPECT_BASELINE==='1'){assert.equal(tabInside,false);assert.equal(delayedInside,false);console.log('Baseline Tab escape and delayed ending-focus theft reproduced.');return;}
 assert.equal(tabInside,true);assert.equal(delayedInside,true);
 assert.equal(await page.getByRole('dialog',{name:'Paused',exact:true}).count(),1);
 for(const key of ['Tab','Shift+Tab'])for(let i=0;i<12;i++){await page.keyboard.press(key);assert.equal(await page.evaluate(()=>UI.set.contains(document.activeElement)),true);}
 await page.locator('[data-k="fast"]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.k),'fast');
 await page.locator('[data-k="resume"]').focus();await page.keyboard.press('Space');
 assert.equal(await page.evaluate(()=>UI.set.hidden&&!Engine.paused),true);
 await page.getByRole('button',{name:'Play again',exact:true}).focus();await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Play again');
 // Ending has an independent Tab loop including optional quote Copy and its navigation buttons.
 for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>UI.ov.contains(document.activeElement)),true);}
 await page.getByRole('button',{name:'Play again',exact:true}).focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.nav==='again');
 await page.evaluate(()=>{main(window.nav);});await page.waitForFunction(()=>G.day===1&&UI.panel.classList.contains('up'));
 // Mouse pause is available in gameplay; the ending modal intentionally covers the HUD button.
 await page.getByRole('button',{name:'Settings and pause'}).click();
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.k),'resume');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>UI.set.contains(document.activeElement)),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.ending').count(),0);assert.deepEqual(errors,[]);
 console.log('Pause focus containment/delayed focus guard/native resume/focus restoration and ending keyboard replay passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
