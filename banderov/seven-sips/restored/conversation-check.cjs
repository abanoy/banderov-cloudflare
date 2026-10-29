const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.__noBoot=true);
 await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));
 await page.waitForFunction(()=>UI.snd);
 await page.evaluate(()=>{
  Sound.setMusic(false);Sound.setSfx(false);newRun();showPanel(true);
  window.parts=[];window.makeSlots=()=>{window.parts=[];(async()=>{
   for(let i=0;i<3;i++)parts.push(await chooseSlot([{text:'Yes',tag:'sweet'},{text:'No',tag:'rude'}],30,byKey('The Waitress')));
  })();};makeSlots();
 });
 await page.waitForTimeout(350);await page.keyboard.down('1');
 await page.waitForFunction(()=>parts.length===1);await page.waitForTimeout(350);
 await page.keyboard.down('1');await page.waitForTimeout(100);
 const held=await page.evaluate(()=>parts.length);await page.keyboard.up('1');
 // Baseline's repeated key could select a second fragment. Complete remaining slots cleanly.
 while(await page.evaluate(()=>parts.length)<3){await page.keyboard.press('2');await page.waitForTimeout(50);}
 await page.evaluate(()=>makeSlots());await page.waitForTimeout(350);
 await page.getByRole('button',{name:'Settings and pause'}).click();
 await page.evaluate(()=>document.querySelector('.blk').click());await page.waitForTimeout(100);
 const paused=await page.evaluate(()=>parts.length);
 console.log(JSON.stringify({heldKeyParts:held,pausedActivationParts:paused,errors}));
 if(process.env.SEVEN_EXPECT_BASELINE==='1'){
  assert.equal(held,2);assert.equal(paused,1);console.log('Both baseline input defects reproduced.');return;
 }
 assert.equal(held,1,'holding a key must not choose the next fragment');
 assert.equal(paused,0,'paused background controls must not select a fragment');
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.keyboard.press('2');await page.waitForFunction(()=>parts.length===1);
 assert.equal(await page.evaluate(()=>parts[0].tag),'rude');
 // A new deliberate press remains usable, including native keyboard button activation.
 await page.locator('.blk').first().focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>parts.length===2);
 assert.equal(await page.evaluate(()=>parts[1].tag),'sweet');
 await page.getByRole('button',{name:'Settings and pause'}).click();
 await page.getByText('How to play',{exact:true}).click();
 for(const size of [{width:320,height:568},{width:390,height:844}]){
  await page.setViewportSize(size);
  const resume=page.getByRole('button',{name:'Resume',exact:true});await resume.focus();
  const b=await resume.boundingBox();assert.ok(b.y>=0&&b.y+b.height<=size.height+1);
  await page.screenshot({path:path.join(__dirname,'instructions-'+size.width+'.png')});
 }
 assert.deepEqual(errors,[]);console.log('Conversation held-key, pause guard, resume and native button activation passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
