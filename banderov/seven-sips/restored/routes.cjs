const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
for(const mode of ['best','worst','both','walk']){
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(mode=>{window.TRACKS={};window.BOT={speed:50,think:.01,vfx:false,
  ready(){Sound.setMusic(false);Sound.setSfx(false);type=async(target,text)=>{target.textContent=text;};},
  pick(opts,girl){const ranked=opts.slice().sort((a,b)=>((girl.likes[b.tag]??-1)-(girl.likes[a.tag]??-1))*(mode==='worst'?-1:1));
   const parts=window.__routeParts||(window.__routeParts=[]);let selected=ranked[0];
   // A disliked tone can intentionally unlock a secret. Avoid that bonus on the loss route.
   if(mode==='worst'&&parts.length===2&&girl.secret)selected=ranked.find(o=>!COMBO[girl.secret[0]]([...parts,o]))||ranked[0];
   parts.push(selected);if(parts.length===3)window.__routeParts=[];return selected;},
  choose(values,html){if(values.includes('again'))return null;if(values.includes('both'))return mode==='both'?'both':mode==='walk'?'walk':'a';
   if(values.some(v=>typeof v==='string'&&v.startsWith('The '))){
    if(mode==='both'||mode==='walk'){const targets=values.filter(v=>['The Waitress','The Scientist'].includes(v)).sort((a,b)=>G.met[a]-G.met[b]);if(targets.length)return targets[0];}
    return values.includes('The Waitress')?'The Waitress':values[0];}return values[0];}};},mode);
 await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));
 await page.waitForFunction(()=>window.__lastEnding,null,{timeout:60000});
 const result=await page.evaluate(()=>({ending:window.__lastEnding,days:G.day,exchanges:G.stats.exchanges,asked:G.asked}));
 assert.deepEqual(errors,[]);if(mode==='best')assert.match(result.ending,/^win:/);if(mode==='worst')assert.equal(result.ending,'lonely');if(mode==='both')assert.equal(result.ending,'hares');if(mode==='walk')assert.equal(result.ending,'sigma');
 await page.locator('.ending .btn').first().waitFor();await page.screenshot({path:path.resolve(__dirname,`route-${mode}.png`)});
 if(mode==='best'){
  await page.locator('.ending .btn').first().click();await page.waitForFunction(()=>G&&!G.ending&&G.day===1,null,{timeout:15000});
  assert.equal(await page.evaluate(()=>UI.curtain.className),'curtain');
  console.log('Replay resets to day 1 and clears the ending curtain.');
 }
 console.log(mode,JSON.stringify(result));await context.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
