// Controlled stale image delivery checks using the installed Chrome.
// Original product/assets remain untouched; no public hosting or backend.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const output=path.join(__dirname,'review',process.argv[2]||'pass-116');
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const rows=[];
 try{
 for(const width of [320,390,1280])for(const palette of ['day','night'])for(const outcome of ['late-success','late-abort']){
  const context=await browser.newContext({viewport:{width,height:900}});
  let release;
  try{
   const page=await context.newPage();const errors=[];const requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(p=>localStorage.setItem('banderov-portfolio.palette',p),palette);
   await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
   await page.getByRole('link',{name:'Games',exact:true}).press('Enter');
   await page.locator('#idols-visual').evaluate(i=>i.decode());
   const held=new Promise(resolve=>{release=resolve});
   let enteredResolve;const entered=new Promise(resolve=>{enteredResolve=resolve});
   const routes=[];
   await page.route(/\/assets\/don-bass-screen(?:-\d+)?\.webp$/,route=>{
    const job=(async()=>{
     requests.push(new URL(route.request().url()).pathname);enteredResolve();
     const response=outcome==='late-success'?await route.fetch():null;
     await held;
     if(response)await route.fulfill({response});else await route.abort();
    })();routes.push(job);return job;
   });
   await page.getByRole('button',{name:'Game screenshot',exact:true}).press('Enter');
   await Promise.race([entered,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No held screenshot request')),5000))]);
   assert.equal(await page.locator('#idols-visual').getAttribute('aria-busy'),'true');
   await page.getByRole('button',{name:'Cover art',exact:true}).press('Enter');
   await page.waitForFunction(()=>{const i=document.querySelector('#idols-visual');return i.currentSrc.includes('don-bass-cover')&&i.naturalWidth>0&&i.style.visibility===''&&i.getAttribute('aria-busy')==='false'});
   release();await Promise.all(routes);await page.waitForLoadState('networkidle');
   const final=await page.locator('#idols-visual').evaluate(i=>({src:new URL(i.currentSrc).pathname,busy:i.getAttribute('aria-busy'),visible:i.style.visibility,naturalWidth:i.naturalWidth,alt:i.alt,status:document.querySelector('.game-image-status').textContent,coverPressed:document.querySelector('[data-image=cover]').getAttribute('aria-pressed'),screenPressed:document.querySelector('[data-image=screen]').getAttribute('aria-pressed')}));
   assert(final.src.includes('don-bass-cover'));assert(final.naturalWidth>0);
   assert.equal(final.busy,'false');assert.equal(final.visible,'');assert.equal(final.status,'');
   assert.equal(final.coverPressed,'true');assert.equal(final.screenPressed,'false');assert(final.alt.includes('cover'));
   assert.equal(errors.length,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.unroute(/\/assets\/don-bass-screen(?:-\d+)?\.webp$/);
   await page.getByRole('button',{name:'Game screenshot',exact:true}).press('Enter');
   await page.waitForFunction(()=>{const i=document.querySelector('#idols-visual');return i.currentSrc.includes('don-bass-screen')&&i.naturalWidth>0&&i.style.visibility===''&&i.getAttribute('aria-busy')==='false'});
   assert.equal(await page.locator('.game-image-status').textContent(),'');
   rows.push({width,palette,outcome,heldRequests:requests,final,subsequentScreenshotRecovered:true,errors});
   console.log('PASS '+width+' '+palette+' '+outcome+': latest cover survives old completion; next screenshot decodes');
  }finally{release?.();await context.close()}
 }
 }finally{await browser.close()}
 await fs.writeFile(path.join(output,'image-races.json'),JSON.stringify({scope:'Controlled local delayed/aborted stale game-image requests, native keyboard selections. Not real-network timing or all race permutations.',rows},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
