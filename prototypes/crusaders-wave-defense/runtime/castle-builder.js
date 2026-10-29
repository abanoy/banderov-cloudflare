import {captureDesignSeed} from './castle-anchor-plan.js';
import {CELL,LAYERS,MAX_PARTS,PARTS,createConstruction} from './castle-construction.js';
import {profile,containsCell,minimumLevel} from './castle-rules.js';
import {assessCastle} from './castle-beauty.js?v=courts1';
import {castlePreview} from './castle-preview.js';
import {inspectCastle,structuralHints} from './castle-navigation.js';
import {createCastleArchitect,verifiedBattleCastlePlan} from './castle-architect.js?v=courts-1';
import {protectorReport,protectorLimit} from './castle-protectors.js';
import {partAffordance} from './castle-affordances.js';

const STORAGE='crusaders-wave-defense-castles-v1';
const freshOptions=()=>({level:100,material:'fortress'});
const copyLayout=layout=>layout.map(p=>({...p}));
export function castleBuilder(world,{openView,closeView,onApply,report}){
 const construction=createConstruction(world),panel=document.createElement('section');
 panel.id='builder-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','builder-title');
 panel.innerHTML=`<div class="builder-shell"><header class="builder-header"><div><small>CRUSADERS / CASTLE WORKSHOP</small><h2 id="builder-title">BUILD YOUR AERIE</h2><p id="build-dimensions"></p></div><button id="close-builder" aria-label="Close castle workshop">✕</button></header>
 <div class="builder-toolbar"><label>CASTLE<select id="build-home"><option value="0">Dawn castle</option><option value="1">Dusk castle</option></select></label><label>LAYER<select id="build-layer"></select></label><label class="build-level-control">LEVEL / LAND <output id="build-level-value">100</output><input id="build-level" type="range" min="1" max="100" value="100"><span id="build-plot-size"></span></label><label>MATERIAL<select id="build-material"><option value="fortress">Fortress stone · test</option><option value="auto">Follow level</option><option value="wood">Timber</option><option value="stone">Rough stone</option><option value="brick">Brick masonry</option></select></label><span class="unlock-badge">ALL PARTS UNLOCKED<br><small>TEN LAYERS / LOCAL TEST</small></span><div class="mobile-build-tools"><label>PART<select id="build-quick-part"></select></label><button id="build-quick-rotate">Rotate ↻ 0°</button></div></div>
 <div class="builder-body"><aside class="builder-tools"><h3>CHOOSE A PART</h3><div id="build-parts"></div><button id="build-rotate">Rotate ↻ <span>0°</span></button><p id="build-help"></p><div class="builder-presets"><h3>LAYOUTS</h3><button id="build-open-library">Template library · 30 plans ↗</button><h3 class="legacy-starters">Classic starters</h3><button data-build-preset="courtyard">Courtyard castle</button><button data-build-preset="citadel">High citadel</button><button data-build-preset="twinkeeps">Twin keeps</button><button id="build-clear">Clear draft</button><button id="build-undo" disabled>Undo</button></div><p>Land grows with level. Clear a large draft before trying a smaller plot; your pieces are never silently deleted.</p></aside>
 <main class="builder-plan"><div class="builder-view-tabs" role="group" aria-label="Editor view"><button id="build-view-live" aria-pressed="true">3D workshop</button><button id="build-view-simple" aria-pressed="false">Simplified grid</button><button id="build-view-library" aria-expanded="false">Templates</button><span id="build-count"></span></div><section id="build-library" hidden aria-label="Castle template library"><div class="template-heading"><div><small>CASTLE ATLAS / 30 EDITABLE PLANS</small><h3>Choose your stronghold</h3></div><button id="build-close-library" aria-label="Close template library">×</button></div><p class="template-intro">Three fortress layouts for each level band. Broad walled courtyards sit at different heights, with turning gate routes, planted wards and a commanding upper keep. Loading a plan replaces this draft; Undo brings it back.</p><label class="template-level-label">TEMPLATE LEVEL<select id="build-template-level"></select></label><div id="build-template-cards"></div><p class="template-legend">Schematic plans · gold: walls / pale stone: higher tiers / amber: stairs / green: gardens / violet: heart. Defense strengths describe the layout, not ranked combat statistics.</p></section><div class="build-visual-row"><div class="build-preview-wrap"><div class="preview-caption"><span>LIVE DRAFT</span><span id="build-preview-layer">LAYER 1</span></div><canvas id="build-preview" tabindex="0" aria-label="Live castle editor. Click a plot to place the selected part, drag to orbit, or use the simplified grid for keyboard editing."></canvas><div class="preview-camera"><button id="build-orbit-left" aria-label="Orbit castle preview left">↶</button><button id="build-fit">Fit castle</button><button id="build-orbit-right" aria-label="Orbit castle preview right">↷</button></div></div><div id="build-grid-wrap" hidden><div class="plan-caption"><span>REAR / EXPANDING LAND</span></div><div class="build-grid-scroll"><div id="build-grid" role="grid" aria-label="Castle building grid"></div></div><div class="plan-caption"><span>GATE / BATTLEGROUND ↓</span><span>Scroll large plans sideways</span></div></div></div><div class="preview-instructions"><span id="build-selected">Pick a part, then click a plot</span><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div><div class="build-auto"><b>AUTO FIT</b><span id="build-clearance">Stairs open the floor directly above. Removing stairs restores the slab.</span></div><section class="build-route-check"><div><b>ROUTE INSPECTOR</b><button id="build-check-routes">Check walkable routes</button></div><p id="build-route-summary" role="status">Check the entrance, stairs and upper decks against the actual castle geometry.</p><div id="build-route-progress" hidden><i></i></div><ul id="build-route-issues"></ul><p class="build-route-scope">An automated walking check. It reports blockers and suggestions; your pieces stay under your control.</p></section><p class="build-note">Every edit appears here immediately. Apply to map when your draft is ready.</p><div id="build-status" role="status"></div></main>
 <aside class="builder-progress"><h3>CASTLE CHARACTER</h3><div class="beauty-total"><output id="build-beauty-score">0</output><span>/ 100<br>DESIGN SCORE</span></div><strong id="build-beauty-title">A new beginning</strong><div id="build-beauty-bars"></div><ul id="build-beauty-tips"></ul><div id="build-beauty-bonuses"></div><p class="build-note">A design guide, not a verdict on your style. Asymmetric castles and separate wings can score well. Repeated cannons or gardens alone do not earn beauty.</p><details class="build-progression"><summary>LEVEL & REWARDS</summary><p id="build-material-progression"></p><div id="build-level-layers"></div><strong id="build-layer-rule"></strong><p>Land grows from 10 × 10 to 28 × 28 plots. Ten layers are available here; online level, rank and defense statistics are not connected.</p><p>Beauty titles are local cosmetic rewards. Renown bonuses are a proposed online reward, with no combat boost.</p></details></aside></div>
 <footer class="builder-footer"><div><strong id="build-draft-state">Draft layout</strong><span>Saved on this browser when applied.</span></div><button id="build-restore">Restore original castle</button><button id="build-apply">APPLY TO MAP ↗</button></footer></div>`;
 document.body.append(panel);
 const $=id=>panel.querySelector('#'+id),partById=new Map(PARTS.map(p=>[p.id,p]));
 let home=0,layer=0,type=PARTS[0].id,rotation=0,opened=false,selected=0,gridKey='';
 let routeController=null,lastRouteReport=null,diagnosticRevision=0,architectController=null,lastArchitect=null;const activeTemplates=[null,null];
 const architect=createCastleArchitect(construction),architectPanel=document.createElement('section');architectPanel.className='build-architect';architectPanel.innerHTML='<div><b>CASTLE ARCHITECT</b><select id="build-ai-goal" aria-label="Castle AI priority"><option value="balanced">Balanced</option><option value="defense">Defense first</option><option value="beauty">Beauty first</option></select><button id="build-ai-generate">Design a castle ↗</button></div><p id="build-ai-status" role="status">Compare six plans, scan their perimeters and walk their routes before proposing a draft.</p><ul id="build-ai-reasons"></ul><p class="build-ai-scope">Local design search · editable proposal · Apply updates your castle.</p>';panel.querySelector('.build-route-check').before(architectPanel);
 const protectorPanel=document.createElement('section');protectorPanel.className='build-route-check';protectorPanel.innerHTML='<b>PROTECTOR NETWORK</b><p id="build-protector-status"></p><ul id="build-protector-issues"></ul><p class="build-note">Destroy all protectors before weapon hits can damage the main core. Silo blasts bypass them after shields fall. Unlocks: 20 / 40 / 60 / 80 / 100 + one bonus at 100. Main core always required.</p>';panel.querySelector('.build-route-check').before(protectorPanel);
 const adjustments=document.createElement('details');adjustments.id='build-adjustments';adjustments.innerHTML='<summary>Neighbour fitting <span></span></summary><ul></ul>';panel.querySelector('.build-auto').after(adjustments);
 const applied=[null,null],appliedOptions=[null,null],drafts=[null,null],draftOptions=[freshOptions(),freshOptions()],undos=[[],[]],cells=[];
 const preset=(name,options=draftOptions[home])=>copyLayout(construction.presets(name,options));
 const currentProfile=()=>profile(draftOptions[home]);
 function status(text){$('build-status').textContent=text;}
 function options(value){const p=profile(value);return {level:p.level,material:value?.material||'fortress'};}
 function save(){try{localStorage.setItem(STORAGE,JSON.stringify({version:2,castles:applied.map((layout,i)=>layout===null?null:{layout,options:appliedOptions[i]})}));return true;}catch{return false;}}
 try{
  const raw=localStorage.getItem(STORAGE);
  if(raw){const value=JSON.parse(raw);if(![1,2].includes(value.version)||!Array.isArray(value.castles)||value.castles.length!==2)throw Error('Unsupported saved layout');
   for(let i=0;i<2;i++)if(value.castles[i]!==null){const entry=value.castles[i],layout=value.version===1?entry:entry.layout,config=value.version===1?{level:20,material:'fortress'}:options(entry.options);construction.apply(i,layout,config);applied[i]=copyLayout(layout);appliedOptions[i]={...config};draftOptions[i]={...config};}
  }
 }catch{report('A saved castle could not be loaded. The original layout is available.');for(let i=0;i<2;i++){construction.restore(i);applied[i]=appliedOptions[i]=null;draftOptions[i]=freshOptions();}}
 for(let i=0;i<2;i++){if(applied[i])drafts[i]=copyLayout(applied[i]);else{const design=construction.template('sanctuary',draftOptions[i]);drafts[i]=copyLayout(design.layout);activeTemplates[i]=design;}}
 for(let i=0;i<LAYERS;i++)$('build-layer').add(new Option('Layer '+(i+1)+' / '+i*CELL+' m',String(i)));
 const erase={id:'erase',label:'Erase',symbol:'×',color:'#db8984'};
 for(const p of [...PARTS,erase]){
  $('build-quick-part').add(new Option(p.label,p.id));const b=document.createElement('button');b.type='button';b.dataset.part=p.id;b.innerHTML='<span></span><b></b>';b.querySelector('span').textContent=p.symbol;b.querySelector('b').textContent=p.label;b.style.setProperty('--part-color',p.color||'#b5d7d4');b.onclick=()=>{type=p.id;drawTools();};$('build-parts').append(b);
 }
 $('build-quick-part').onchange=()=>{type=$('build-quick-part').value;drawTools();};
 const rotate=()=>{rotation=(rotation+1)%4;drawTools();};$('build-quick-rotate').onclick=rotate;$('build-rotate').onclick=rotate;
 function makeGrid(){
  const p=currentProfile(),key=[p.size,p.minX,p.minZ].join(':');if(key===gridKey)return;gridKey=key;cells.length=0;selected=0;$('build-grid').replaceChildren();$('build-grid').style.setProperty('--grid-size',p.size);
  for(let z=p.minZ;z<p.maxZ;z++){const row=document.createElement('div');row.setAttribute('role','row');
   for(let x=p.minX;x<p.maxX;x++){const b=document.createElement('button'),index=cells.length;b.type='button';b.className='build-cell';b.setAttribute('role','gridcell');b.dataset.x=x;b.dataset.z=z;b.tabIndex=index===0?0:-1;b.onclick=()=>edit(x,z);
    b.onfocus=()=>{selected=index;$('build-selected').textContent='Plot '+(x-p.minX+1)+' / '+(z-p.minZ+1);};
    b.onkeydown=e=>{const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-p.size,ArrowDown:p.size}[e.key];if(offset){e.preventDefault();e.stopPropagation();const next=Math.min(cells.length-1,Math.max(0,selected+offset));cells.forEach((c,i)=>c.tabIndex=i===next?0:-1);cells[next].focus();}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();edit(x,z,true);}};
    row.append(b);cells.push(b);
   }$('build-grid').append(row);
  }
 }
 const preview=castlePreview($('build-preview'),construction,{onPlace:edit,onHover(x,z){const p=currentProfile();$('build-selected').textContent=x===null?'Pick a part, then click a plot':'Plot '+(x-p.minX+1)+' / '+(z-p.minZ+1);},onBuilt(model){const report=protectorReport(model.links);$('build-protector-status').textContent=report.total+' / '+protectorLimit(currentProfile().level)+' protector cores · '+report.linked+' clear beams · '+report.blocked+' blocked · average spacing '+report.separation+' m.'; $('build-protector-status').dataset.result=report.blocked?'fail':'pass';$('build-protector-issues').replaceChildren(...report.issues.map(issue=>{const li=document.createElement('li');li.textContent='Plot '+issue.cell.x+', '+issue.cell.z+' / layer '+(issue.cell.layer+1)+': '+issue.message;return li;}));const list=model.adjustments||model.root.userData.adjustments||[];adjustments.querySelector('span').textContent='· '+list.length+' adjustments';adjustments.querySelector('ul').replaceChildren(...list.slice(0,8).map(a=>{const li=document.createElement('li');li.textContent=a.message+' Layer '+(a.cell.layer+1)+', plot '+a.cell.x+'/'+a.cell.z+'.';return li;}));if(!list.length){const li=document.createElement('li');li.textContent='No neighbouring pieces need additional fitting.';adjustments.querySelector('ul').append(li);}}});
 function editorView(value){panel.dataset.editorView=value;$('build-grid-wrap').hidden=value==='live';$('build-view-live').setAttribute('aria-pressed',String(value==='live'));$('build-view-simple').setAttribute('aria-pressed',String(value==='simple'));}
 $('build-view-live').onclick=()=>editorView('live');$('build-view-simple').onclick=()=>editorView('simple');$('build-orbit-left').onclick=()=>preview.rotate(-Math.PI/8);$('build-orbit-right').onclick=()=>preview.rotate(Math.PI/8);$('build-fit').onclick=()=>preview.fit();editorView('live');

 function invalidateRoutes(){
  if(architectController){architectController.abort();architectController=null;$('build-ai-generate').textContent='Design a castle ↗';$('build-ai-status').textContent='Search cancelled because the draft changed.';}lastArchitect=null;$('build-ai-reasons').replaceChildren();
  diagnosticRevision++;routeController?.abort();routeController=null;lastRouteReport=null;preview.setRoutes?.([]);
  $('build-check-routes').disabled=false;$('build-check-routes').textContent='Check walkable routes';$('build-route-progress').hidden=true;$('build-route-issues').replaceChildren();
  $('build-route-summary').textContent='Draft changed. Check entrance access, stair landings and upper-deck connections.';delete $('build-route-summary').dataset.result;
 }
 function schematic(layout,config){
  const size=164,canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d'),p=profile(config),unit=(size-16)/p.size;
  ctx.fillStyle='#102b3c';ctx.fillRect(0,0,size,size);ctx.fillStyle='#244554';ctx.fillRect(8,8,size-16,size-16);
  const sorted=[...layout].sort((a,b)=>a.layer-b.layer);
  const terraces=['#536f79','#647f87','#739099','#86a3a7','#94b4b4','#a8c4be','#b8d1c8','#cbdcd1','#d9e5d8','#e6ecd9'];
  for(const item of sorted){
   ctx.fillStyle=item.type==='garden'?'#80b894':item.type==='core'?'#d5aee3':['wall','gate','tower','battlement','curvedWall'].includes(item.type)?'#d6bd80':['deck','embankment'].includes(item.type)?'#aa875f':terraces[item.layer];ctx.globalAlpha=1;
   const x=8+(item.x-p.minX)*unit,z=8+(item.z-p.minZ)*unit,round=item.footprint==='round'||['roundTerrace','curvedWall'].includes(item.type);
   if(round){ctx.beginPath();ctx.arc(x+unit/2,z+unit/2,unit/2-.18,0,Math.PI*2);ctx.fill();}else ctx.fillRect(x+.18,z+.18,unit-.36,unit-.36);
   if(item.type==='curvedWall'){ctx.save();ctx.translate(x+unit/2,z+unit/2);ctx.rotate(-item.rotation*Math.PI/2);ctx.strokeStyle='#ffedb7';ctx.lineWidth=unit*.24;ctx.beginPath();ctx.arc(0,0,unit*.36,0,Math.PI/2);ctx.stroke();ctx.restore();}
  }
  for(const item of layout.filter(p=>p.type==='stairs')){const x=8+(item.x-p.minX+.5)*unit,z=8+(item.z-p.minZ+.5)*unit;ctx.save();ctx.translate(x,z);ctx.rotate(-item.rotation*Math.PI/2);ctx.fillStyle='#ffcf6d';ctx.beginPath();ctx.moveTo(0,-unit*.48);ctx.lineTo(unit*.43,unit*.4);ctx.lineTo(-unit*.43,unit*.4);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.globalAlpha=1;ctx.fillStyle='#fff0bd';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('GATE ↓',size/2,size-1);return canvas;
 }
 function drawLibrary(){
  const level=Number($('build-template-level').value),config={...draftOptions[home],level},cards=construction.templates(config);
  $('build-template-cards').replaceChildren(...cards.map(meta=>{
   const data=construction.template(meta.id,config),card=document.createElement('article');card.className='template-card';card.dataset.template=meta.id;
   const visual=schematic(data.layout,config);card.append(visual);const copy=document.createElement('div');copy.className='template-card-copy';
   const heading=document.createElement('h4');heading.textContent=data.name||meta.name;copy.append(heading);
   const role=document.createElement('p');role.className='template-role';role.textContent=data.role||meta.role;copy.append(role);
   const stats=document.createElement('p');stats.className='template-stats';stats.textContent=profile(config).size+' × '+profile(config).size+' · '+(Math.max(...data.layout.map(p=>p.layer))+1)+' layers · '+data.layout.length+' pieces';copy.append(stats);
   for(const [label,value] of [['STRENGTH',data.strength||meta.strength],['TRADEOFF',data.weakness||meta.weakness]]){const p=document.createElement('p');p.className='template-tradeoff';const b=document.createElement('b');b.textContent=label+' ';p.append(b,document.createTextNode(Array.isArray(value)?value.join(' · '):value||''));copy.append(p);}
   const use=document.createElement('button');use.dataset.loadTemplate=meta.id;use.textContent='Use this layout ↗';use.onclick=()=>loadTemplate(meta.id,level);copy.append(use);card.append(copy);return card;
  }));
 }
 function loadTemplate(id,level){
  const config={...draftOptions[home],level},data=construction.template(id,config);
  remember();draftOptions[home]=config;drafts[home]=copyLayout(data.layout);activeTemplates[home]=data;layer=0;$('build-layer').value='0';draw();showLibrary(false);preview.fit();status(data.name+' loaded at level '+level+'. Check its routes or start editing; Apply updates the map.');
 }
 for(let level=10;level<=100;level+=10)$('build-template-level').add(new Option('Level '+(level-9)+'–'+level+' · '+profile({level}).size+'×'+profile({level}).size,String(level)));
 function showLibrary(value){$('build-library').hidden=!value;$('build-view-library').setAttribute('aria-expanded',String(value));if(value){$('build-template-level').value=String(Math.ceil(draftOptions[home].level/10)*10);drawLibrary();$('build-library').scrollIntoView({block:'nearest'});}}
 $('build-open-library').onclick=()=>showLibrary(true);$('build-view-library').onclick=()=>showLibrary($('build-library').hidden);$('build-close-library').onclick=()=>showLibrary(false);$('build-template-level').onchange=drawLibrary;
 $('build-ai-generate').onclick=async()=>{
  if(architectController){architectController.abort();architectController=null;$('build-ai-generate').textContent='Design a castle ↗';$('build-ai-status').textContent='Search cancelled. Your draft is unchanged.';return;}
  const controller=new AbortController();architectController=controller;const selectedHome=home,revision=diagnosticRevision;$('build-ai-generate').textContent='Cancel search';$('build-ai-reasons').replaceChildren();
  try{const captured=captureDesignSeed();const result=await architect.generate({home,timestamp:captured.timestamp,options:{...draftOptions[home]},goal:$('build-ai-goal').value,seed:captured.seed,signal:controller.signal,onProgress:p=>{if(!controller.signal.aborted)$('build-ai-status').textContent=p.message||'Checking castle routes…';}});
   if(controller.signal.aborted||revision!==diagnosticRevision||home!==selectedHome)return;architectController=null;
   if(result.ok){remember();drafts[home]=copyLayout(result.layout);draftOptions[home]={...result.options};activeTemplates[home]={objectives:result.objectives};layer=0;$('build-layer').value='0';draw();preview.fit();lastArchitect=result;const m=result.metrics;$('build-ai-status').textContent=result.summary+' Seed '+result.seed+' · '+new Date(result.timestamp).toLocaleTimeString()+' · Beauty '+m.beauty+'/100 · sampled defense coverage '+m.coverage+'%.';$('build-ai-reasons').replaceChildren(...result.explanations.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));status('AI proposal ready. Edit it, Undo it, or Apply to map.');}
   else $('build-ai-status').textContent=result.summary;
  }catch(error){if(!controller.signal.aborted)$('build-ai-status').textContent='Design search could not finish: '+error.message;}
  finally{if(architectController===controller)architectController=null;if(!architectController)$('build-ai-generate').textContent='Design a castle ↗';}
 };
 $('build-check-routes').onclick=async()=>{
  routeController?.abort();const controller=new AbortController();routeController=controller;const revision=diagnosticRevision;
  const layout=copyLayout(drafts[home]),config={...draftOptions[home]},objectives=activeTemplates[home]?.objectives;
  let model=null;$('build-check-routes').disabled=true;$('build-check-routes').textContent='Walking the castle…';$('build-route-summary').textContent='Sampling solid floors and searching for routes…';$('build-route-progress').hidden=false;$('build-route-issues').replaceChildren();
  try{
   await new Promise(resolve=>requestAnimationFrame(resolve));if(controller.signal.aborted)return;
   model=construction.preview(home,layout,config);
   const result=await inspectCastle(model,layout,config,{objectives,signal:controller.signal,onProgress(value){if(controller.signal.aborted)return;const text=typeof value==='string'?value:(value.message||value.phase||'Checking routes…')+(value.total?' · '+value.completed+' / '+value.total:'');$('build-route-summary').textContent=text;}});
   if(controller.signal.aborted||revision!==diagnosticRevision)return;lastRouteReport=result;
   const paths=result.routes||[],success=paths.filter(p=>p.ok),stats=result.stats||{};
   $('build-route-summary').textContent=result.summary||(result.ok?'Routes checked: '+(result.tested??paths.length)+' destinations. Outward and return walking checks passed.':'Some routes need attention. Review the marked plots below.');
   $('build-route-summary').dataset.result=result.ok?'pass':'fail';preview.setRoutes?.(success);
   for(const issue of (result.issues||[]).slice(0,12)){const li=document.createElement('li'),button=document.createElement('button');button.textContent=(issue.message||issue.label||issue.code)+(issue.suggestion?' '+issue.suggestion:'');button.onclick=()=>{const cell=issue.cell;if(!cell)return;layer=Math.max(0,Math.min(9,cell.layer??0));$('build-layer').value=String(layer);drawTools();preview.focusCell?.(cell);$('build-selected').textContent='Inspect plot '+(cell.x-profile(config).minX+1)+' / '+(cell.z-profile(config).minZ+1)+' · layer '+(layer+1);};li.append(button);$('build-route-issues').append(li);}
  }catch(error){if(!controller.signal.aborted)$('build-route-summary').textContent='Route check could not finish: '+error.message;}
  finally{model?.dispose();if(routeController===controller){routeController=null;$('build-check-routes').disabled=false;$('build-check-routes').textContent='Check walkable routes';$('build-route-progress').hidden=true;}}
 };
 function remember(){undos[home].push({layout:copyLayout(drafts[home]),options:{...draftOptions[home]},template:activeTemplates[home]});if(undos[home].length>30)undos[home].shift();}
 function edit(x,z,eraseOnly=false){
  if(!containsCell({x,z},currentProfile()))return;
  const d=drafts[home],index=d.findIndex(p=>p.x===x&&p.z===z&&p.layer===layer),remove=eraseOnly||type==='erase';
  if(index<0&&remove)return;if(!remove&&index<0&&d.length>=MAX_PARTS){status('The test limit is '+MAX_PARTS+' parts per castle. Erase a part before adding another.');return;}
  if(!remove&&type==='protector'&&d.filter(p=>p.type==='protector').length-(d[index]?.type==='protector'?1:0)>=protectorLimit(currentProfile().level)){status('This level permits '+protectorLimit(currentProfile().level)+' protector cores. Another unlocks every 20 levels, starting at 20.');return;}
  const prior=d[index],shaped=['terrace','roundTerrace','curvedWall','embankment'].includes(type);
  const keepBody=prior&&(['terrace','roundTerrace','curvedWall'].includes(prior.type)||prior.solid===true);
  const keepRound=prior&&(prior.footprint==='round'||['roundTerrace','curvedWall'].includes(prior.type));
  remember();activeTemplates[home]=null;if(index>=0)d.splice(index,1);if(!remove){if(type==='core')for(let i=d.length-1;i>=0;i--)if(d[i].type==='core')d.splice(i,1);d.push({x,z,layer,type,rotation,...(keepBody&&!shaped?{solid:true}:{}),...(keepRound&&!shaped?{footprint:'round'}:{})});}
  status(remove?'Part removed from draft.':'Placed '+partById.get(type).label.toLowerCase()+' on layer '+(layer+1)+'.');draw();
 }
 function drawTools(){
  for(const b of $('build-parts').children)b.setAttribute('aria-pressed',String(b.dataset.part===type));$('build-rotate').querySelector('span').textContent=rotation*90+'°';$('build-quick-part').value=type;$('build-quick-rotate').textContent='Rotate ↻ '+rotation*90+'°';
  const help={protector:'Direct beam to the main core. A blocked beam gives no protection. Scatter reachable cores across wards; unlocks every 20 levels, starting at 20.',core:'One crown core per castle. Its large cradle extends across neighboring plots.',stairs:'Rises one layer. An overhead floor gets a matching opening automatically; add an upper floor beside the stair crest for a landing.',erase:'Erase a part and its solid body on this layer. Removing stairs also closes their automatic floor opening.',terrace:'A square masonry tier from the foundation to this layer. Explicit lower stairs and landings leave passage space.',roundTerrace:'A round stone bastion within one square plot. Its curved sides and empty corners match the collision. Decorations keep its round base.',curvedWall:'A thick quarter-circle wall on a round base. Rotate to face its protected corner; the other three quarters stay open.',embankment:'A rough earth-and-stone bank, half a wall high. Rotate its high back toward the wall. Its raised outer toe blocks walking; keep gates and stairs clear.'};
  $('build-help').textContent=help[type]||'Pick a part, then a plot. Replacing a terrace keeps its stone body and shape. Choose Stone terrace to make the base square again.';const capability=partAffordance(type);if(capability?.defense)$('build-help').textContent+=' AI capability: automatic match defense with manual entry nearby (F).';
  preview.setTool({layer,type,rotation});$('build-preview-layer').textContent='LAYER '+(layer+1)+' / '+layer*CELL+' m';
 }
 function drawBeauty(){
  const result=assessCastle(drafts[home],currentProfile());$('build-beauty-score').value=result.score;
  $('build-beauty-title').textContent=result.cosmeticRank+' castle';
  $('build-beauty-bars').replaceChildren(...result.categories.map(c=>{const el=document.createElement('div');el.className='beauty-category';el.innerHTML='<div><span></span><b></b></div><i><em></em></i>';el.querySelector('span').textContent=c.label;el.querySelector('b').textContent=c.score+' / '+c.max;el.querySelector('em').style.width=(c.score/c.max*100)+'%';el.title=c.detail;return el;}));
  $('build-beauty-tips').replaceChildren(...result.tips.slice(0,2).map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  $('build-beauty-bonuses').replaceChildren(...result.bonuses.map(b=>{const el=document.createElement('p');el.textContent=b.label+(b.value!==undefined?' · '+b.value:'');return el;}));
  return result;
 }
 function draw(){
  invalidateRoutes();
  const d=drafts[home],p=currentProfile();makeGrid();const byCell=new Map(d.map(item=>[item.x+':'+item.z+':'+item.layer,item]));
  for(const b of cells){const x=Number(b.dataset.x),z=Number(b.dataset.z),item=byCell.get(x+':'+z+':'+layer),below=!item&&byCell.get(x+':'+z+':'+(layer-1)),part=partById.get((item||below)?.type);b.textContent=part?.symbol||'·';b.classList.toggle('below',!!below);b.classList.toggle('occupied',!!item);b.style.setProperty('--part-color',part?.color||'#69848b');b.setAttribute('aria-label',`Plot ${x-p.minX+1}, ${z-p.minZ+1}, layer ${layer+1}: ${item?part.label+'; rotation '+item.rotation*90+' degrees':'empty'}`);b.title=b.getAttribute('aria-label');b.dataset.rotation=item?.rotation??0;}
  $('build-count').textContent=d.length+' / '+MAX_PARTS+' PARTS';$('build-undo').disabled=!undos[home].length;
  $('build-draft-state').textContent=(home?'Dusk':'Dawn')+' castle · '+(JSON.stringify(d)===JSON.stringify(applied[home])&&JSON.stringify(draftOptions[home])===JSON.stringify(appliedOptions[home])?'Applied layout':'Unapplied draft');
  $('build-level').value=p.level;$('build-level-value').value=p.level;$('build-material').value=draftOptions[home].material;$('build-plot-size').textContent=p.size+' × '+p.size+' plots';$('build-dimensions').textContent=p.size+' × '+p.size+' plots · '+p.size*CELL+' m wide · 10 layers';
  $('build-material-progression').textContent='Timber 1–10 → rough stone 11–30 → brick 31–60 → fortress 61–100. Current finish: '+p.materialLabel+'. All finishes are unlocked for testing.';
  const count=Math.ceil(p.level/10);$('build-level-layers').replaceChildren(...Array.from({length:10},(_,i)=>{const bar=document.createElement('i');bar.classList.toggle('earned',i<count);return bar;}));$('build-layer-rule').textContent=count+' / 10 planned layers at level '+p.level;
  const cuts=d.filter(item=>!['stairs','core'].includes(item.type)&&d.some(s=>s.type==='stairs'&&s.x===item.x&&s.z===item.z&&s.layer===item.layer-1)).length;
  $('build-clearance').textContent=cuts?cuts+' stair opening'+(cuts===1?'':'s')+' carved automatically. Floors restore when their stairs are removed.':'Stairs open the floor directly above. Removing stairs restores the slab.';
  preview.setDraft(home,d,draftOptions[home]);drawTools();drawBeauty();
  const hints=structuralHints(d,draftOptions[home]);if(hints.length)$('build-route-summary').textContent='Before walking: '+hints[0].message+(hints[0].suggestion?' '+hints[0].suggestion:'');
 }
 $('build-level').oninput=()=>{const next={...draftOptions[home],level:Number($('build-level').value)},p=profile(next);if(drafts[home].filter(item=>item.type==='protector').length>protectorLimit(p.level)){status('Remove excess protector cores before lowering this castle level.');$('build-level').value=draftOptions[home].level;return;}if(drafts[home].some(item=>!containsCell(item,p))){$('build-level').value=draftOptions[home].level;status('This draft needs at least the level '+minimumLevel(drafts[home])+' plot. Clear it or move its outer pieces before shrinking. Nothing was removed.');return;}remember();draftOptions[home]=next;status('Level '+p.level+' land: '+p.size+' × '+p.size+' plots. Ten layers and all parts remain unlocked.');draw();};
 $('build-material').onchange=()=>{remember();draftOptions[home]={...draftOptions[home],material:$('build-material').value};status('Material finish updated in your draft.');draw();};
 $('build-home').onchange=()=>{home=Number($('build-home').value);status('Editing '+(home?'Dusk':'Dawn')+'. Your other draft is kept.');draw();};
 $('build-layer').onchange=()=>{layer=Number($('build-layer').value);draw();};
 panel.querySelectorAll('[data-build-preset]').forEach(b=>b.onclick=()=>{remember();drafts[home]=preset(b.dataset.buildPreset);activeTemplates[home]=null;layer=0;$('build-layer').value='0';status('Starter fitted to this plot. Apply when ready.');draw();});
 $('build-clear').onclick=()=>{remember();drafts[home]=[];activeTemplates[home]=null;status('Draft cleared. You can now choose a smaller level plot. The foundation and default heart remain.');draw();};
 $('build-undo').onclick=()=>{if(undos[home].length){const old=undos[home].pop();drafts[home]=old.layout;draftOptions[home]=old.options;activeTemplates[home]=old.template||null;status('Last draft change undone.');draw();}};
 function setBeauty(home){const value=assessCastle(applied[home]||[],profile(appliedOptions[home]||{level:20}));world.castles[home].userData.beauty=applied[home]?value:null;}
 for(let i=0;i<2;i++)setBeauty(i);
 function close(){if(!opened)return;routeController?.abort();architectController?.abort();architectController=null;$('build-ai-generate').textContent='Design a castle ↗';opened=false;preview.setActive(false);panel.hidden=true;closeView();document.getElementById('build').focus();}
 $('build-apply').onclick=()=>{try{construction.apply(home,drafts[home],draftOptions[home]);applied[home]=copyLayout(drafts[home]);appliedOptions[home]={...draftOptions[home]};setBeauty(home);const saved=save();onApply(home);close();report((home?'Dusk':'Dawn')+' castle updated. '+(saved?'Layout and plot saved in this browser.':'Storage unavailable; this layout lasts for this visit.'));}catch(error){status(error.message);}};
 $('build-restore').onclick=()=>{construction.restore(home);applied[home]=appliedOptions[home]=null;draftOptions[home]=freshOptions();const design=construction.template('sanctuary',draftOptions[home]);drafts[home]=copyLayout(design.layout);activeTemplates[home]=design;undos[home]=[];setBeauty(home);const saved=save();onApply(home);close();report((home?'Dusk':'Dawn')+' original castle restored.'+(saved?'':' Local storage is unavailable.'));};$('close-builder').onclick=close;
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}if(e.key==='Tab'){const focusable=[...panel.querySelectorAll('button:not(:disabled),select,input,summary,canvas[tabindex]')].filter(e=>e.tabIndex>=0&&e.getClientRects().length),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 let matchLayouts=false;
 function restoreMatch(){if(!matchLayouts)return;for(let i=0;i<2;i++){if(applied[i]!==null)construction.apply(i,applied[i],appliedOptions[i]);else construction.restore(i);setBeauty(i);}matchLayouts=false;}
 const lastMatchFamilies=[null,null];
 async function prepareMatch({friendly='saved',level=100,seed=0,timestamp=null,signal,onProgress}={}){
  restoreMatch();const plans=[null,null];matchLayouts=true;
  try{for(let i=0;i<2;i++){if(i===0&&friendly==='saved'){plans[i]={name:applied[0]!==null?'Your saved Dawn castle':'Your original Dawn castle',source:'saved',level:appliedOptions[0]?.level||20};continue;}const plan=await verifiedBattleCastlePlan({level,seed,timestamp,home:i,construction,signal,onProgress,avoidFamilies:[lastMatchFamilies[i],i===1?plans[0]?.family:null].filter(Boolean)});lastMatchFamilies[i]=plan.family;construction.apply(i,plan.layout,plan.options);world.castles[i].userData.beauty=assessCastle(plan.layout,plan.options);plans[i]={name:plan.name,source:'ai',family:plan.family,goal:plan.goal,seed:plan.seed,timestamp:plan.timestamp,anchors:plan.anchors,level,parts:plan.layout.length,protectors:plan.protectors,composition:plan.composition,network:plan.network,navigation:plan.navigation,rejected:plan.attempts.filter(a=>!a.ok)};}return plans;}catch(e){restoreMatch();throw e;}
 }
 draw();return {construction,preview,prepareMatch,restoreMatch,get savedBattleCastle(){return {custom:applied[0]!==null,level:appliedOptions[0]?.level||20};},open({templates=false,template=null}={}){if(opened)return;opened=true;openView();panel.hidden=false;preview.setActive(true);draw();$('close-builder').focus();if(['rampart','sanctuary','skyharbor'].includes(template))loadTemplate(template,100);else if(templates)showLibrary(true);},close,get isOpen(){return opened;},get diagnostics(){return lastRouteReport;},get architectResult(){return lastArchitect;},get draft(){return {home,layout:copyLayout(drafts[home]),options:{...draftOptions[home]},beauty:assessCastle(drafts[home],currentProfile())};}};
}

