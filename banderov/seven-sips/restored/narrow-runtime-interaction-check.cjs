const {chromium}=require(process.env.SEVEN_PLAYWRIGHT),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const results=[];
 for(const [width,height] of [[480,240],[520,280]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.__noBoot=true);
  await page.goto('file:///'+path.join(__dirname,'index.html').replaceAll('\\','/'));await page.waitForFunction(()=>UI.blocks);
  
  const content=await page.evaluate(async()=>{
   Sound.setMusic(false);Sound.setSfx(false);newRun();setPlayMode('expanded');showPanel(true);SAVE.fast=true;Engine.speed=4;
   const candidates=GIRLS.flatMap(g=>Array.from({length:21},(_,i)=>({g,day:i+8,lines:SevenExpanded.story(g.key,i+8,g.likes).lines}))).flatMap(s=>s.lines.map(line=>({...s,line}))).sort((a,b)=>b.line[0].length-a.line[0].length);
   const sample=candidates[0];window.studyGirl=sample.g;window.studyOptions=sample.line[1].map(([text,tag])=>({text,tag}));
   const rig=addGirl(sample.g.key,{enter:0});UI.her.dataset.speaker=shortName(sample.g.key);await herSay(rig,sample.line[0],.1);
   paintSentence(studyOptions.slice(0,3));Engine.speed=1;window.finished=false;
   chooseSlot(studyOptions,120,studyGirl).then(r=>{window.choice=r;window.finished=true;});
   return{key:sample.g.key,day:sample.day,prompt:sample.line[0]};
  });await page.waitForTimeout(500);
  const client=await context.newCDPSession(page);
  async function read(selector){const before=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{scroll:e.scrollTop,total:e.scrollHeight,height:e.clientHeight,x:r.x+r.width/2,y:r.bottom-5};});
   assert.ok(before.total>before.height,'actual content requires reading '+selector);
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:before.x,y:before.y}]});
   for(let i=1;i<=15;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:before.x,y:before.y-i*4}]});await page.waitForTimeout(15);}
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(180);
   const scroll=await page.locator(selector).evaluate(e=>e.scrollTop);assert.ok(scroll>before.scroll,'finger scroll '+selector);assert.equal(await page.evaluate(()=>finished),false,'reading must not select');
   await page.locator(selector).focus();await page.keyboard.press('End');await page.waitForTimeout(200);
   assert.ok(await page.locator(selector).evaluate(e=>Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<2),'keyboard reads end '+selector);
   return{before,scroll};
  }
  const question=await read('.bubble.her'),reply=await read('.say');
  await page.getByRole('button',{name:'Settings and pause',exact:true}).tap();await page.getByRole('dialog',{name:'Paused',exact:true}).waitFor();
  const frozen=await page.evaluate(()=>UI.timer.firstElementChild.style.transform);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>UI.timer.firstElementChild.style.transform),frozen);
  await page.setViewportSize({width:320,height:568});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>UI.panel.parentElement.id),'game');assert.equal(await page.evaluate(()=>UI.panel.inert),true);
  await page.setViewportSize({width,height});await page.waitForFunction(()=>UI.panel.parentElement===document.body); console.log('rotation',await page.evaluate(()=>({width:innerWidth,height:innerHeight,parent:UI.panel.parentElement.id,body:UI.panel.parentElement===document.body,inert:UI.panel.inert,paused:Engine.paused}))); assert.equal(await page.evaluate(()=>UI.panel.parentElement===document.body),true);assert.equal(await page.evaluate(()=>UI.panel.inert),true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>UI.set.hidden);console.log('before tap',await page.evaluate(()=>({paused:Engine.paused,inert:UI.panel.inert,overlay:UI.ov.hidden,settings:UI.set.hidden,finished})));await page.locator('.blk').first().tap();await page.waitForFunction(()=>finished,null,{timeout:2000});assert.equal(await page.evaluate(()=>choice.text===studyOptions[0].text),true);
  await page.evaluate(()=>{window.timedDone=false;window.timerStart=Engine.time;chooseSlot(studyOptions,3.2,studyGirl).then(r=>{window.timedChoice=r;window.timerEnd=Engine.time;window.timedDone=true;});});
  await page.waitForFunction(()=>timedDone);const timeout=await page.evaluate(()=>({result:timedChoice,elapsed:timerEnd-timerStart}));assert.deepEqual(timeout.result,{text:'uh...',tag:'awkward',speed:0});assert.ok(timeout.elapsed>=3.2&&timeout.elapsed<=3.27);
  await page.screenshot({path:path.join(__dirname,`narrow-runtime-interaction-${width}-${height}.png`)});
  await page.evaluate(()=>{main('title');});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>UI.panel.classList.contains('up')),false);const hidden=await page.locator('.panel').boundingBox();assert.ok(hidden.y>=height,'panel hides outside viewport');assert.deepEqual(errors,[]);
  results.push({width,height,content,question,reply,pausedRotation:true,touchChoice:true,timeout,titlePanelHidden:true,errors});await context.close();console.log('PASS short split native reading, pause, rotation, selection, expiry and hide '+width+'x'+height);
 }
 fs.writeFileSync(path.join(__dirname,'narrow-runtime-interaction-results.json'),JSON.stringify(results,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
