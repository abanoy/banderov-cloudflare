// Scoped wordmark reflow and native home-link checks; text scaling is CSS simulation.
const {chromium}=require('playwright');const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{const out=path.join(__dirname,'review',process.argv[2]||'pass-117');await fs.mkdir(out,{recursive:true});const baseline=process.argv[3]==='baseline';const rows=[];const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [320,390,768,1280])for(const palette of ['day','night'])for(const scale of [1,1.5,2]){
const page=await browser.newPage({viewport:{width,height:900}});await page.addInitScript(p=>localStorage.setItem('banderov-portfolio.palette',p),palette);await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
if(scale!==1)await page.evaluate(multiplier=>{const sizes=[...document.querySelectorAll('body,body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const[e,size]of sizes)e.style.fontSize=size*multiplier+'px'},scale);
const marks=await page.locator('.wordmark').evaluateAll(items=>items.map(e=>{const suffix=e.querySelector('.brand-dot');const range=document.createRange();range.selectNodeContents(suffix);return{text:e.textContent,suffix:suffix.textContent,lines:[...range.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),display:getComputedStyle(suffix).display}}));
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);for(const mark of marks){assert.equal(mark.text,'Banderov.com');if(!baseline)assert.equal(new Set(mark.lines.map(r=>Math.round(r.y))).size,1)}
assert.equal(await page.locator('h1').textContent(),'Banderov.com');
await page.getByRole('link',{name:'Music',exact:true}).press('Enter');await page.locator('.header .wordmark').press('Enter');assert.equal(new URL(page.url()).hash,'#top');
if(width===320&&scale===2&&palette==='night'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'night-320-double-opening.png')})}
rows.push({width,palette,scale,marks,homeKeyboard:true});await page.close();
}}finally{await browser.close()}
await fs.writeFile(path.join(out,'brand-wrap.json'),JSON.stringify({scope:'Installed Chrome normal/1.5x/2x computed text. Not actual OS zoom or all clipping/overlap states.',baseline,rows},null,2));console.log('PASS '+rows.length+' wordmark layout/home-keyboard cases'+(baseline?' (baseline suffix wrapping recorded)':' (suffix on one line)'));
})().catch(e=>{console.error(e);process.exitCode=1});
