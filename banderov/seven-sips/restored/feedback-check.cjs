const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const [hearts,best] of [[128,true],[130,true],[2,false]]){
  const page=await browser.newPage({viewport:{width:320,height:568}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.__noBoot=true);
  await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await page.waitForFunction(()=>UI.snd);
  await page.evaluate(async hearts=>{
   Sound.setMusic(false);Sound.setSfx(false);SAVE.fast=true;Engine.speed=5;newRun();G.stats.exchanges=1;
   G.hearts['The Waitress']=hearts;window.chosen=[];
   const r=addGirl('The Waitress');await enter(r);window.exchangeResult=null;
   exchange(r,byKey(r.key).lines[0],30).then(v=>window.exchangeResult=v);
  },hearts);
  for(let slot=0;slot<3;slot++){
   await page.locator('.blk:not(:disabled)').first().waitFor();
   if(!process.env.SEVEN_EXPECT_BASELINE)assert.deepEqual(await page.locator('.say .w.empty').allTextContents(),['Opener','Answer','Closer'].slice(slot));
   if(!process.env.SEVEN_EXPECT_BASELINE&&hearts===128&&slot===0)await page.screenshot({path:path.join(__dirname,'reply-slots-320.png')});
   const choice=await page.evaluate(({best,slot})=>{
    const g=byKey('The Waitress'),bs=[...UI.blocks.querySelectorAll('.blk')];
    const opts=bs.map((b,i)=>({i,tag:Object.keys(TAGS).find(t=>b.querySelector('.tag').textContent.trim().endsWith(TAGS[t].label)),text:b.querySelector('.bt').textContent}));
    opts.sort((a,b)=>((g.likes[b.tag]??-1)-(g.likes[a.tag]??-1))*(best?1:-1));
    let pick=opts[0];if(!best&&slot===2&&g.secret)pick=opts.find(o=>!COMBO[g.secret[0]]([...chosen,o]))||pick;
    chosen.push(pick);return pick.i+1;
   },{best,slot});
   await page.keyboard.press(String(choice));
  }
  await page.waitForFunction(()=>G.stats.exchanges===2);
  const result=await page.evaluate(()=>({hearts:G.hearts['The Waitress'],label:UI.fx.querySelector('.floater')?.textContent}));
  const actual=result.hearts-hearts;
  const expected=hearts===130&&actual===0?'♥ Full':`${actual>=0?'+':''}${actual} ♥`;
  console.log({start:hearts,...result,actual,expected});
  if(process.env.SEVEN_EXPECT_BASELINE==='1'){assert.notEqual(result.label,expected);}else assert.equal(result.label,expected);
  if(!process.env.SEVEN_EXPECT_BASELINE&&hearts===128){await page.evaluate(()=>Engine.speed=1);await page.waitForTimeout(200);await page.screenshot({path:path.join(__dirname,'feedback-320.png')});}
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(process.env.SEVEN_EXPECT_BASELINE==='1'?'Baseline capped-heart feedback mismatch reproduced.':'Displayed hearts match actual capped gains/losses; full meter clearly identified.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
