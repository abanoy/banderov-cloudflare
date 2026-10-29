// Battle HUD layout check: coverage, overlaps, on-screen buttons, touch controls and player visibility for the
// compact HUD (battle-hud.js) at desktop (1280, 1920, mid-width 800), touch tablet (1024x768), phone portrait (390, 360) and
// phone landscape sizes. Real Bot Battle start (2v2, AI castle level 10) in Chromium with SwiftShader; no simulation injection.
// Measurement waits for a deterministic HUD state (all roots laid out, chips computed, objective pill shown, no announcer
// banner up), never a fixed delay. Extension elements on the HUD layer are counted too: the guide's edge waypoint (a zero-size
// anchor, measured by its icon and label), capture meter and tip card (battle-guide.js, loaded by main.js; tips stay off under
// ?test) and any element marked [data-hud-root]. Guide overlaps with HUD roots are reported (guideOverlaps), not failed: the
// waypoint follows the world every frame and the guide owns its own placement test (test/battle-guide.mjs).
// Report goes to os.tmpdir() (HUD_OUT overrides; HUD_CASES=name,name runs a subset).
// Usage: node test/game-hud-layout.cjs [baseUrl]   (default http://127.0.0.1:8795; PLAYWRIGHT_PATH overrides playwright)
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/opt/node-tools/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const base=(process.argv[2]||process.env.AERIE_URL||'http://127.0.0.1:8795').replace(/\/$/,''),outDir=process.env.HUD_OUT||path.join(os.tmpdir(),'game-hud-layout');fs.mkdirSync(outDir,{recursive:true});
// Limits sit 2-3.5 points above the coverage measured on 2026-10-18 with the guide attached (1280 13.9%, 1920 6.2%, 800 23.7%,
// tablet 11.7%, 390 27.5%, 360 38.5%, 844 27.7%; the guide waypoint alone is ~5000 px2), so one more chip or a small extension
// element still passes but a bigger HUD fails.
// Mid-width desktop (800x640) carries the full desktop HUD on a small window (the corner stacks rise above the hotbar band).
// Phones carry the 120px pad and 88px FIRE; 360x640 is the smallest supported portrait screen.
const cases=[
 {name:'desktop-1280x720',viewport:{width:1280,height:720},limit:.16},
 {name:'desktop-1920x1080',viewport:{width:1920,height:1080},limit:.09},
 {name:'desktop-800x640',viewport:{width:800,height:640},limit:.27},
 {name:'tablet-1024x768',viewport:{width:1024,height:768},touch:true,limit:.15},
 {name:'portrait-390x844',viewport:{width:390,height:844},touch:true,limit:.30},
 {name:'portrait-360x640',viewport:{width:360,height:640},touch:true,limit:.41},
 {name:'landscape-844x390',viewport:{width:844,height:390},touch:true,limit:.30}];
const only=process.env.HUD_CASES?process.env.HUD_CASES.split(','):null;
const report={scope:'Compact battle HUD layout at seven viewports: union coverage of HUD roots (hotbar and action stack by their visible children; incl. objective pill, announcer banner and guide/extension roots; guide overlaps reported, not failed), pairwise root overlap, player-card health text not clipped, touch chip words not clipped, no keyboard badges on touch, spawn-map castle label size, visible buttons in viewport, touch FIRE/pad, desktop FIRE/pad hidden, player hit-test reaches canvas#world, DOM mutations per frame.',base,cases:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(outDir,'game-hud-layout.json'),JSON.stringify(report,null,2));
const ROOTS=['#hud-top','#hud-hotbar','#hud-player','#hud-actions','#battle-radar','.in-battle .compass','#pad','#battle-fire','#battle-objective','#announce-banner','#guide-way','#guide-capture','#guide-tip'];
// Runs in the page: true once every HUD root is laid out, the chips were computed and the objective pill is up.
function hudReady(){const v=sel=>{const e=document.querySelector(sel);if(!e||!e.getClientRects().length)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden';};
 return ['#hud-top','#hud-hotbar','#hud-player','#battle-radar','#battle-objective'].every(v)&&!!document.getElementById('hud-actions')?.hasAttribute('data-count')&&!!document.getElementById('battle-cadence')?.textContent;}
// Runs in the page: measures the HUD after the match is running.
function measure(roots){
 const vis=el=>{if(!el||!el.getClientRects().length)return false;const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0;};
 const W=innerWidth,H=innerHeight,rects=[],els=[];
 for(const sel of roots){const el=document.querySelector(sel);if(el)els.push([sel,el]);}
 for(const el of document.querySelectorAll('[data-hud-root]'))if(!els.some(([,o])=>o===el||o.contains(el)||el.contains(o)))els.push(['#'+(el.id||el.className),el]);
 // A zero-size anchor (the guide waypoint) is measured by the union of its visible children.
 const box=el=>{const r=el.getBoundingClientRect();if(r.width>=1&&r.height>=1)return r;let l=Infinity,t=Infinity,R=-Infinity,B=-Infinity;for(const k of el.children){if(!vis(k))continue;const q=k.getBoundingClientRect();if(q.width<1||q.height<1)continue;l=Math.min(l,q.left);t=Math.min(t,q.top);R=Math.max(R,q.right);B=Math.max(B,q.bottom);}return R>l?{left:l,top:t,right:R,bottom:B,width:R-l,height:B-t}:r;};
 // The hotbar and action stack are transparent flex containers: they count by their visible children (cadence plate, slot row,
 // each chip), so the empty world beside a short cadence line or a narrow second chip is not counted as covered.
 const SPLIT=new Set(['#hud-hotbar','#hud-actions']),add=(sel,r)=>{if(r.width<1||r.height<1)return;rects.push({sel,x:Math.max(0,r.left),y:Math.max(0,r.top),r:Math.min(W,r.right),b:Math.min(H,r.bottom),w:r.width,h:r.height});};
 for(const [sel,el] of els){if(!vis(el))continue;if(SPLIT.has(sel)){for(const k of el.children)if(vis(k))add(sel+'>'+(k.dataset.chip||k.id||k.className),k.getBoundingClientRect());continue;}add(sel,box(el));}
 // Union area by coordinate compression.
 const xs=[...new Set(rects.flatMap(r=>[r.x,r.r]))].sort((a,b)=>a-b),ys=[...new Set(rects.flatMap(r=>[r.y,r.b]))].sort((a,b)=>a-b);let area=0;
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const cx=(xs[i]+xs[i+1])/2,cy=(ys[j]+ys[j+1])/2;if(rects.some(r=>cx>r.x&&cx<r.r&&cy>r.y&&cy<r.b))area+=(xs[i+1]-xs[i])*(ys[j+1]-ys[j]);}
 const overlaps=[];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j],ox=Math.min(a.r,b.r)-Math.max(a.x,b.x),oy=Math.min(a.b,b.b)-Math.max(a.y,b.y);if(ox>.5&&oy>.5)overlaps.push({a:a.sel,b:b.sel,ox,oy});}
 const offscreen=[];for(const b of document.querySelectorAll('button')){if(!vis(b))continue;let hidden=false;for(let p=b;p;p=p.parentElement)if(p.hidden){hidden=true;break;}if(hidden)continue;const r=b.getBoundingClientRect();if(r.width<1||r.height<1)continue;if(b.closest('#battle-panel,#battle-result,#spawn-map,#pause-panel,#look-panel,#battle-board,.travel,header'))continue;if(r.left<-.5||r.top<-.5||r.right>W+.5||r.bottom>H+.5)offscreen.push({id:b.id||b.className||b.textContent.slice(0,20),x:r.left,y:r.top,w:r.width,h:r.height});}
 const fire=document.getElementById('battle-fire'),pad=document.getElementById('pad'),fr=fire.getBoundingClientRect();
 // Projected player (sprite centre) and what is on top of it.
 const a=window.__aerie,s=a.physics.state,T=a.camera.position.constructor,v=new T(s.x,s.y+1.2,s.z).project(a.camera),px=(v.x+1)*W/2,py=(1-v.y)*H/2,hit=document.elementFromPoint(px,py);
 const hudRoots=Object.fromEntries(['hud-top','hud-hotbar','hud-player','hud-actions'].map(id=>{const r=document.getElementById(id)?.getBoundingClientRect();return [id,r?{x:r.left,y:r.top,w:r.width,h:r.height}:null];}));
 const chips=[...document.querySelectorAll('#hud-actions .hud-chip')].filter(c=>!c.hidden).map(c=>c.dataset.chip);
 // Clipped text: the player-card health line, and (touch) the short word under each chip icon.
 const health=document.getElementById('battle-health'),healthClip=vis(health)&&health.scrollWidth>health.clientWidth+1?health.textContent:null;
 const chipClip=[];for(const b of document.querySelectorAll('#hud-actions button'))if(vis(b)&&!b.closest('[hidden]')&&b.scrollWidth>b.clientWidth+1)chipClip.push(b.id+':'+(b.dataset.short||b.textContent.trim()).slice(0,20));
 const keyBadges=[...document.querySelectorAll('.slot-key,.radar-key,kbd')].filter(e=>vis(e)&&!e.closest('[hidden]')).map(e=>(e.closest('[id]')?.id||'')+':'+e.textContent);
 const weapons=[...document.querySelectorAll('#battle-weapons button')].map(b=>({id:b.id,hidden:b.hidden,pressed:b.getAttribute('aria-pressed')}));
 return {viewport:{W,H},coverage:area/(W*H),rects,overlaps,offscreen,fire:{visible:vis(fire),w:fr.width,h:fr.height},padVisible:vis(pad),player:{x:px,y:py,hit:hit?.id||hit?.tagName||null},hudRoots,chips,healthClip,chipClip,keyBadges,weapons,hudVars:{top:getComputedStyle(document.body).getPropertyValue('--hud-top-h').trim(),bottom:getComputedStyle(document.body).getPropertyValue('--hud-bottom-h').trim()},combatScore:(()=>{const e=document.getElementById('combat-score'),r=e.getBoundingClientRect(),st=getComputedStyle(e);return {x:r.left,y:r.top,w:r.width,h:r.height,display:st.display,visibility:st.visibility,fontSize:st.fontSize};})()};
}
function mutations(seconds){return new Promise(r=>{let n=0,f=0;const o=new MutationObserver(l=>n+=l.length);o.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});const t0=performance.now();(function fr(){f++;if(performance.now()-t0<seconds*1000)requestAnimationFrame(fr);else{o.disconnect();r({records:n,frames:f,perFrame:n/Math.max(1,f)});}})();});}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});let failed=false;
 try{for(const c of cases){if(only&&!only.includes(c.name))continue;const row={name:c.name,viewport:c.viewport,touch:!!c.touch,limit:c.limit,failures:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:c.viewport,hasTouch:!!c.touch,isMobile:!!c.touch,deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>report.errors.push({case:c.name,message:e.message}));
  try{
   await page.goto(base+'/floating-castle/index.html?battle=1&test=1');await page.waitForFunction(()=>window.__aerie?.battle,null,{timeout:120000});
   // Load the HUD the way the shell does, unless main.js already registered it (main.js registers its extensions before
   // window.__aerie exists, so #hud-top is there by now when it does).
   row.injected=await page.evaluate(async()=>{const b=__aerie.battle,exts=document.getElementById('hud-top');if(exts)return false;const m=await import('/floating-castle/battle-hud.js?v=aerie-20261018');window.__hud=b.use(m.createBattleHud());return true;});
   await page.evaluate(()=>{for(const [id,v] of [['battle-team-size','2'],['battle-castle-level','10']]){const e=document.getElementById(id);if(!e)continue;e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}});
   await page.waitForFunction(()=>{const b=document.getElementById('battle-start');return b&&!b.disabled&&b.offsetParent;},null,{timeout:120000,polling:500});
   await page.locator('#battle-start').click({timeout:60000}).catch(()=>page.evaluate(()=>document.getElementById('battle-start').click()));await page.waitForFunction(()=>__aerie.battle.context?.phase==='running'||__aerie.battle.combat.state.phase==='running',null,{timeout:240000,polling:500});
   // Deterministic state: every root laid out and populated, then no announcer banner (bots capture silos early; a banner
   // that is still up after 45 s is measured as a root rather than waited for), then two frames for layout to settle.
   await page.waitForFunction(hudReady,null,{timeout:90000,polling:200});
   // With the guide attached, give it the chance to place its waypoint (it can legitimately have no target, so this is bounded).
   row.guide=await page.evaluate(()=>document.getElementById('guide-way')?'attached':'absent');
   if(row.guide==='attached')row.guideWay=await page.waitForFunction(()=>!document.getElementById('guide-way').hidden&&!document.getElementById('guide-root')?.hidden,null,{timeout:8000,polling:200}).then(()=>true,()=>false);
   row.bannerUp=await page.waitForFunction(()=>document.getElementById('announce-banner')?.hidden!==false,null,{timeout:45000,polling:200}).then(()=>false,()=>true);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const m=await page.evaluate(measure,ROOTS);Object.assign(row,m);row.mutations=await page.evaluate(mutations,4);
   // Spawn map: the DAWN/DUSK castle labels must use the label scale (regression: a shadowed `k` drew them ~100-200px tall);
   // on touch its Close button shows no keyboard badge.
   row.mapLabels=await page.evaluate(async()=>{const seen=[],P=CanvasRenderingContext2D.prototype,orig=P.fillText;P.fillText=function(t,...r){if(t==='DAWN'||t==='DUSK')seen.push({t,font:this.font,w:Math.round(this.measureText(t).width)});return orig.call(this,t,...r);};try{const map=__aerie.battle.context.spawnMap;map.toggle();await new Promise(r=>setTimeout(r,600));const b=document.querySelector('#spawn-map-close b');seen.closeBadge=!!(b&&b.getClientRects().length&&getComputedStyle(b).display!=='none');map.close();}finally{P.fillText=orig;}return {labels:seen,closeBadge:seen.closeBadge};});
   const labels=row.mapLabels.labels,bigLabel=labels.find(l=>parseFloat(l.font)>48||l.w>220);if(!labels.length)row.failures.push('spawn map drew no castle labels');else if(bigLabel)row.failures.push('spawn map label too big: '+bigLabel.t+' '+bigLabel.font);
   await page.screenshot({path:path.join(outDir,'hud-'+c.name+'.png')});row.screenshot=path.join(outDir,'hud-'+c.name+'.png');
   row.headroom=c.limit-m.coverage;
   if(m.coverage>c.limit)row.failures.push('coverage '+(m.coverage*100).toFixed(1)+'% > '+c.limit*100+'%');
   const guide=o=>o.a.startsWith('#guide')||o.b.startsWith('#guide');row.guideOverlaps=m.overlaps.filter(guide);const hudOverlaps=m.overlaps.filter(o=>!guide(o));
   if(hudOverlaps.length)row.failures.push('root overlap '+hudOverlaps.map(o=>o.a+'/'+o.b).join(', '));
   if(m.offscreen.length)row.failures.push('off-screen buttons '+m.offscreen.map(o=>o.id).join(', '));
   if(m.healthClip)row.failures.push('player card health text clipped: '+m.healthClip);
   if(c.touch){if(!m.fire.visible||!m.padVisible)row.failures.push('touch FIRE/pad not visible');if(m.fire.w<80||m.fire.h<80)row.failures.push('FIRE smaller than 80px');
    if(m.chipClip.length)row.failures.push('touch chip words clipped: '+m.chipClip.join(', '));
    if(m.keyBadges.length||row.mapLabels.closeBadge)row.failures.push('keyboard badges on touch: '+m.keyBadges.concat(row.mapLabels.closeBadge?['spawn-map-close']:[]).join(', '));}
   else if(m.fire.visible||m.padVisible)row.failures.push('desktop shows FIRE or pad');
   if(m.player.hit!=='world')row.failures.push('player covered by '+m.player.hit);
   if(!m.rects.some(r=>r.sel==='#hud-top'))row.failures.push('#hud-top not visible');if(!m.rects.some(r=>r.sel.startsWith('#hud-hotbar>')))row.failures.push('#hud-hotbar not visible');
   if(m.combatScore.display==='none'||m.combatScore.visibility==='hidden')row.failures.push('#combat-score hidden');
   row.passed=!row.failures.length;if(!row.passed)failed=true;save();
  }catch(e){row.failure=e.message;row.passed=false;failed=true;save();await page.screenshot({path:path.join(outDir,'hud-'+c.name+'-failure.png')}).catch(()=>{});}
  finally{await context.close();}
  console.log(c.name,row.passed?'PASS':'FAIL',row.coverage!==undefined?'coverage '+(row.coverage*100).toFixed(1)+'% (limit '+(c.limit*100).toFixed(0)+'%, headroom '+((c.limit-row.coverage)*100).toFixed(1)+')':'',row.bannerUp?'banner up':'',row.guideOverlaps?.length?'(info: guide overlaps '+row.guideOverlaps.map(o=>o.a+'/'+o.b).join(', ')+')':'',row.mutations?'mutations/frame '+row.mutations.perFrame.toFixed(1):'',(row.failures||[]).join('; ')||row.failure||'');
 }}finally{await browser.close();}
 if(report.errors.length)failed=true;report.passed=!failed;save();console.log(JSON.stringify({passed:report.passed,errors:report.errors,report:path.join(outDir,'game-hud-layout.json')}));process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
