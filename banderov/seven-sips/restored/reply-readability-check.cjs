const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 for(const [width,height] of [[320,568],[390,844],[844,390],[1280,720]]){
  const c=await b.newContext({viewport:{width,height}}),p=await c.newPage();await p.addInitScript(()=>window.__noBoot=true);
  await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);await p.addStyleTag({content:'*{animation:none!important;transition:none!important}'});
  await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);Engine.speed=20;newRun();showPanel(true);paintSentence([null,null,null]);chooseSlot(Array.from({length:4},()=>({text:'Hello',tag:'polite'})),Infinity,GIRLS[0]);});await p.waitForFunction(()=>[...UI.blocks.children].every(e=>e._fx?.y===0&&e._fx?.s===1&&e._fx?.o===1));
  const result=await p.evaluate(()=>{
   const texts=[...Object.values(OPENERS).flat(),...Object.values(CLOSERS).flat(),...GIRLS.flatMap(g=>g.lines.flatMap(l=>l[1].map(a=>a[0]))),...Object.values(COLD_OPENS).flatMap(l=>l[1].map(a=>a[0])),...Object.values(COLD_OPENS_2).flatMap(l=>l[1].map(a=>a[0]))];
   const failures=[],bs=[...UI.blocks.querySelectorAll('.blk')];
   for(const text of texts){for(const b of bs)b.querySelector('.bt').textContent=text;
    for(const b of bs){const r=b.getBoundingClientRect(),tag=b.querySelector('.tag').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(b.querySelector('.bt'));
     const lines=[...range.getClientRects()];if(r.x<-.5||r.right>innerWidth+.5||r.y<0||r.bottom>innerHeight+.5||lines.some(l=>l.bottom>tag.top+1||l.left<r.left-1||l.right>r.right+1))failures.push({text,button:r.toJSON(),tag:tag.toJSON(),lines:lines.map(l=>l.toJSON())});
    }
   }
   const longest=texts.slice().sort((a,b)=>b.length-a.length)[0];for(const b of bs)b.querySelector('.bt').textContent=longest;
   const stage=document.querySelector('#game').getBoundingClientRect(),font=parseFloat(getComputedStyle(bs[0]).fontSize)*stage.width/540;
   return {count:texts.length,failures,font,longest};
  });
  console.log(width+'x'+height,{count:result.count,font:result.font,failures:result.failures.length,longest:result.longest});
  require('node:fs').writeFileSync(path.join(__dirname,'review','reply-readability-'+width+'.json'),JSON.stringify(result,null,2));console.log('First layout finding',result.failures[0]);await p.screenshot({path:path.join(__dirname,'review','reply-readability-'+width+'.png')});await c.close();assert.equal(result.failures.length,0);if(width===320)assert.ok(result.font>=11);
  
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
