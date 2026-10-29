const {chromium}=require(process.env.SEVEN_PLAYWRIGHT), path=require('node:path'), assert=require('node:assert/strict'),fs=require('node:fs');
const url='file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});
 const context=await browser.newContext({viewport:{width:320,height:568}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.__noBoot=true);
 async function load(){await page.goto(url);await page.waitForFunction(()=>UI.snd);await page.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);SAVE.fast=true;Engine.speed=12;});}
 async function click(name){const b=page.getByRole('button',{name,exact:true});await b.waitFor();await page.waitForTimeout(350);await b.click();}
 async function reply(){await page.waitForFunction(()=>UI.ov.hidden&&[...UI.blocks.querySelectorAll('button')].some(b=>!b.disabled));const n=await page.evaluate(()=>{const bs=[...UI.blocks.querySelectorAll('button')],g=byKey('The Waitress');let best=0,w=-Infinity;bs.forEach((b,i)=>{const tag=b.querySelector('.tag').textContent;const key=Object.keys(TAGS).find(k=>tag.includes(TAGS[k].label));const score=g.likes[key]??0;if(score>w){w=score;best=i;}});return best+1;});await page.keyboard.press(String(n));await page.waitForTimeout(50);}
 try{
  await load();await page.evaluate(()=>{main('title');});await click('Open game menu');assert.equal(await page.getByRole('button',{name:'Expanded Mode',exact:true}).count(),0);assert.match(await page.locator('.title-menu-card').textContent(),/Win a heart/);
  await page.screenshot({path:path.join(__dirname,'expanded-locked-320.png')});
  // Seed a historical win and a valid independent Quick Match day checkpoint.
  await load();const quick=await page.evaluate(()=>{SAVE.endings={'win:The Waitress':1};SAVE.expanded={v:1,slots:[],latest:{key:'The Waitress',hearts:123}};newRun();G.day=2;snapshot();return JSON.stringify(SAVE.run);});
  await load();await page.evaluate(()=>{main('title');});await click('Open game menu');await click('Expanded Mode');await click('Save a winning relationship');await click('Waitress');await click('Save 1 · Waitress · Day 8');await click('Continue day 8');await click('Café date · 20 coins');
  await page.waitForFunction(()=>UI.ov.hidden&&document.querySelector('.blk')&&!document.querySelector('.blk').disabled);
  assert.equal(await page.evaluate(()=>UI.timer.style.visibility),'hidden');
  for(let n=0;n<3;n++)await reply();await page.waitForFunction(()=>G.stats.exchanges===1);
  assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].day),8);
  assert.equal(await page.evaluate(()=>JSON.stringify(SAVE.run)),quick);
  // Reload during a conversation: the unfinished day restarts, not partial progress.
  await load();assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].day),8);assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].hearts),123);
  await page.evaluate(()=>{main('expanded');});await click('Save 1 · Waitress · Day 8');await click('Continue day 8');await click('Café date · 20 coins');
  const dates=new Set([8,11,14,17,20,24,28]);let shifts=0;
  async function plan(day){
    if(dates.has(day)&&await page.evaluate(()=>SAVE.expanded.slots[0].coins)<20){
      await click('Work a shift');await click('Start work shift');
      const answers=await page.evaluate(()=>{const s=SAVE.expanded.slots[0],labels={work:'Handle routine task',verify:'Verify through known contact',report:'Report suspicious message'};return SevenExpanded.officeShift(s.day,s.hour).map(m=>labels[m.best]);});
      for(let i=0;i<6;i++){await click(answers[i]);await click(i===5?'Finish shift':'Next message');}
      await click('Collect earnings');await click('Continue');shifts++;
    }
    await click(dates.has(day)?'Café date · 20 coins':'Hang out · free');
  }
  let fragments=0;
  for(let day=8;day<=28;day++){console.log("Playing day "+day);
   for(let n=0;n<9;n++){await reply();fragments++;}
   await page.getByRole('heading',{name:day===28?'A month together':`Day ${day} complete`,exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].day),day+1);
   assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].exchanges),(day-7)*3);
   assert.equal(await page.evaluate(()=>JSON.stringify(SAVE.run)),quick);
   assert.ok(await page.evaluate(()=>Number.isFinite(SAVE.expanded.slots[0].hearts)));
   if(day===8)await page.screenshot({path:path.join(__dirname,'expanded-day8-320.png')});
   if(day<28){await click('Next day');await plan(day+1);}
  }
  assert.equal(shifts,5);assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].dates),7);assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].hangouts),14);assert.equal(await page.evaluate(()=>SAVE.expanded.slots[0].coins),0);
  await page.screenshot({path:path.join(__dirname,'expanded-month-320.png')});await click('Relationship saves');
  await load();await page.evaluate(()=>{main('expanded');});await click('Save 1 · Waitress · Month complete');assert.equal(await page.getByRole('button',{name:/Continue day/}).count(),0);await click('Back');
  for(let i=1;i<5;i++){await click('Save a winning relationship');await click('Waitress');await page.getByRole('heading',{name:'Three more weeks',exact:true}).waitFor();}
  assert.equal(await page.getByRole('button',{name:'Save a winning relationship',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>SAVE.expanded.slots.length),5);
  await page.screenshot({path:path.join(__dirname,'expanded-five-320.png')});
  await page.getByRole('button',{name:/Save [2-5] · Waitress · Day 8/,exact:true}).first().click();await click('Remove save');await click('Keep save');assert.equal(await page.evaluate(()=>SAVE.expanded.slots.length),5);
  await page.getByRole('button',{name:/Save [2-5] · Waitress · Day 8/,exact:true}).first().click();await click('Remove save');await click('Remove this save');await page.getByRole('heading',{name:'Three more weeks',exact:true}).waitFor();assert.equal(await page.evaluate(()=>SAVE.expanded.slots.length),4);
  assert.equal(await page.evaluate(()=>JSON.stringify(SAVE.run)),quick);
  await click('Title');await page.getByRole('button',{name:'Continue from the start of Day 2',exact:true}).waitFor();
  // Recorded win uses its actual meter and persists the unlock before presentation.
  await load();await page.evaluate(()=>{newRun();G.day=7;G.hearts['The Scientist']=127;record('win:The Scientist');});
  await load();assert.equal(await page.evaluate(()=>SAVE.expanded.latest.hearts),127);assert.ok(await page.evaluate(()=>expandedWinners().includes('The Scientist')));
  assert.deepEqual(errors,[]);const result={paidDates:7,freeHangouts:14,workShifts:shifts,days:21,exchanges:63,fragments,unfinishedReload:true,completedReload:true,fiveSlots:true,quickCheckpointPreserved:true,errors};fs.writeFileSync(path.join(__dirname,'expanded-month-browser-results.json'),JSON.stringify(result,null,2));console.log('PASS '+JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(__dirname,"expanded-month-failure.png")});console.error(await page.evaluate(()=>({text:UI.ov.textContent,slots:SAVE.expanded,day:G?.day,errors:window.__lastEnding})));throw e;}finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
