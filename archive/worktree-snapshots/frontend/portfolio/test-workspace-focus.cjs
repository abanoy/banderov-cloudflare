// Native Tab traversal of the compact layout, including breakpoint/text-size cases.
// Uses the loopback portfolio only. Native audio internals are recorded as hosts.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const output=path.join(__dirname,'review',process.argv[2]||'pass-146');
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.PORTFOLIO_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const rows=[];
 try{
  for(const width of [320,1099,1100,1101,1280])for(const palette of ['day','night'])for(const doubled of [false,true]){
   const context=await browser.newContext({viewport:{width,height:900}});
   try{
    await context.addInitScript(p=>localStorage.setItem('banderov-portfolio.palette',p),palette);
    const page=await context.newPage();const errors=[],audio=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/\.(mp3|ogg)(\?|$)/.test(r.url()))audio.push(r.url())});
    await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
    await page.addStyleTag({url:'/review/workspace.css'});
    await page.evaluate(()=>document.fonts.ready);
    if(doubled)await page.evaluate(()=>{
     const pairs=[...document.querySelectorAll('body,body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);
     pairs.forEach(([e,size])=>e.style.fontSize=size*2+'px');
    });
    const expected=await page.evaluate(()=>[...document.querySelectorAll('a[href],button,audio[controls],[tabindex]')].filter(e=>e.tabIndex>=0&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').length);
    const stops=[];const reached=new Set();
    for(let step=0;step<100&&reached.size<expected;step++){
     await page.keyboard.press('Tab');
     const stop=await page.evaluate(async()=>{
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const e=document.activeElement,r=e.getBoundingClientRect(),h=document.querySelector('.header'),hr=h.getBoundingClientRect();
      const targets=[...document.querySelectorAll('a[href],button,audio[controls],[tabindex]')].filter(e=>e.tabIndex>=0&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
      return {index:targets.indexOf(e),tag:e.tagName,label:(e.getAttribute('aria-label')||e.textContent).trim().slice(0,100),visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight,covered:getComputedStyle(h).position==='sticky'&&!h.contains(e)&&!e.classList.contains('skip-link')&&r.bottom<=hr.bottom,top:r.top,bottom:r.bottom,current:document.querySelector('.header nav [aria-current]')?.getAttribute('href')||null,section:e.closest('#art,#music')?.id||null,documentWidth:document.documentElement.scrollWidth};
     });
     if(stop.index<0)continue;
     assert(stop.visible&&!stop.covered,JSON.stringify({width,palette,doubled,stop}));
     assert(stop.documentWidth<=width,JSON.stringify({width,palette,doubled,stop}));
     if(width>=1100&&stop.section)assert.equal(stop.current,'#'+stop.section,JSON.stringify({width,palette,doubled,stop}));
     stops.push(stop);reached.add(stop.index);
    }
    assert.equal(reached.size,expected,JSON.stringify({width,palette,doubled,expected,stops}));
    assert.deepEqual(errors,[]);assert.deepEqual(audio,[]);
    rows.push({width,palette,doubled,expected,reached:reached.size,stops,errors,audio});
    console.log('PASS '+width+' '+palette+' '+(doubled?'double':'normal')+': '+reached.size+' hosts');
   }finally{await context.close()}
  }
  await fs.writeFile(path.join(output,'workspace-focus.json'),JSON.stringify({scope:'Native Tab host coverage, partial viewport visibility and no full sticky-header occlusion. Large images and native audio internal controls are not fully visibility-certified. Doubled computed text is a simulation, not OS zoom.',rows},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
