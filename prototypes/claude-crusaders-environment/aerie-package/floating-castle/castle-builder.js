import {captureDesignSeed} from './castle-anchor-plan.js?v=dbc-20261018';
import {CELL,LAYERS,MAX_PARTS,PARTS,createConstruction} from './castle-construction.js?v=dbc-20261018';
import {profile,containsCell,minimumLevel} from './castle-rules.js';
import {assessCastle} from './castle-beauty.js?v=dbc-20261018';
import {castlePreview} from './castle-preview.js?v=dbc-20261018';
import {inspectCastle,structuralHints} from './castle-navigation.js?v=aerie-20261018';
import {createCastleArchitect,verifiedBattleCastlePlan} from './castle-architect.js?v=dbc-20261018';
import {protectorReport,protectorLimit} from './castle-protectors.js?v=aerie-20261018';
import {partAffordance} from './castle-affordances.js?v=aerie-20261018';
import {partIconCSS,MARKER_ICONS,drawPixelIcon} from './part-icons.js?v=aerie-20261018';

const STORAGE='crusaders-aerie-castles-v1';
const freshOptions=()=>({level:100,material:'fortress'});
const copyLayout=layout=>layout.map(p=>({...p}));
// Templates fill the whole part budget with evenly spaced filler earth banks. A draft seeded from a template, a restore
// or an AI proposal keeps ROOM parts free by leaving out banks with the same even spacing, so new pieces fit at once.
// Player-made and saved layouts are never trimmed.
const ROOM=40;
function roomy(layout){const over=layout.length-(MAX_PARTS-ROOM),banks=layout.filter(p=>p.type==='embankment');if(over<=0||!banks.length)return {layout:copyLayout(layout),trimmed:0};const cut=Math.min(over,banks.length),keep=banks.length-cut,kept=new Set();for(let i=0;i<keep;i++)kept.add(banks[Math.floor(i*banks.length/keep)]);return {layout:copyLayout(layout.filter(p=>p.type!=='embankment'||kept.has(p))),trimmed:cut};}
export function castleBuilder(world,{openView,closeView,onApply,report}){
 // Touch screens get touch wording in the preview hints (tap, pinch); mouse screens keep click and scroll.
 const touchUI=()=>{try{return matchMedia('(pointer:coarse)').matches;}catch{return false;}},pickHint=()=>'Pick a part, then '+(touchUI()?'tap':'click')+' a plot';
 const construction=createConstruction(world),panel=document.createElement('section');
 panel.id='builder-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','builder-title');
 panel.innerHTML=`<div class="builder-shell ui-frame"><header class="builder-header"><div><small>Don Bass Crusaders</small><h2 id="builder-title">Castle Workshop</h2><p id="build-dimensions"></p></div><button id="close-builder" aria-label="Close castle workshop">×</button></header>
 <div class="builder-toolbar"><label>Castle<select id="build-home"><option value="0">Dawn castle</option><option value="1">Dusk castle</option></select></label><label>Layer<select id="build-layer"></select></label><label class="build-level-control">Level / land <output id="build-level-value">100</output><input id="build-level" type="range" min="1" max="100" value="100"><span id="build-plot-size"></span></label><label>Material<select id="build-material"><option value="fortress">Fortress masonry</option><option value="auto">Follow level</option><option value="wood">Timber</option><option value="stone">Rough stone</option><option value="brick">Brick masonry</option></select></label><span class="unlock-badge">All parts unlocked · up to ten layers</span><div class="mobile-build-tools"><label>Part<select id="build-quick-part"></select></label><button id="build-quick-rotate">Rotate · 0°</button></div></div>
 <div class="builder-body"><aside class="builder-tools"><h3>Choose a part</h3><div id="build-parts"></div><button id="build-rotate">Rotate <span>0°</span></button><p id="build-help"></p><div class="builder-presets"><h3>Layouts</h3><button id="build-open-library">Template library · 30 plans</button><h3 class="legacy-starters">Classic starters</h3><button data-build-preset="courtyard">Courtyard castle</button><button data-build-preset="citadel">High citadel</button><button data-build-preset="twinkeeps">Twin keeps</button><button id="build-clear">Clear draft</button><button id="build-undo" disabled>Undo</button></div><p>Land grows with level. Clear a large draft before trying a smaller plot; your pieces are never silently deleted.</p></aside>
 <main class="builder-plan"><div class="builder-view-tabs" role="group" aria-label="Editor view"><button id="build-view-live" aria-pressed="true">3D workshop</button><button id="build-view-simple" aria-pressed="false">Simplified grid</button><button id="build-view-library" aria-expanded="false">Templates</button><span id="build-count"></span></div><section id="build-library" hidden aria-label="Castle template library"><div class="template-heading"><div><small>Castle atlas · 30 editable plans</small><h3>Choose Your Stronghold</h3></div><button id="build-close-library" aria-label="Close template library">×</button></div><p class="template-intro">Three fortress layouts for each level band. Broad walled courtyards sit at different heights, with turning gate routes, planted wards and a commanding upper keep. Loading a plan replaces this draft; Undo brings it back.</p><label class="template-level-label">Template level<select id="build-template-level"></select></label><div id="build-template-cards"></div><p class="template-legend">Schematic plans · gold: walls · pale stone: higher tiers · amber: stairs · green: gardens · violet: heart · arch: gate side. Strengths describe the layout, not combat ratings.</p></section><div class="build-visual-row"><div class="build-preview-wrap"><div class="preview-caption"><span id="build-preview-status">Live draft</span><span id="build-preview-layer">Layer 1</span></div><canvas id="build-preview" tabindex="0" aria-label="Live castle editor. ${touchUI()?'Tap a plot to aim, tap it again to place the selected part, drag to orbit, pinch to zoom':'Click a plot to place the selected part, drag to orbit'}, or use the simplified grid for keyboard editing."></canvas><div class="preview-camera"><button id="build-orbit-left" aria-label="Orbit castle preview left"><i class="orbit-icon" aria-hidden="true"></i></button><button id="build-fit">Fit castle</button><button id="build-orbit-right" aria-label="Orbit castle preview right"><i class="orbit-icon" aria-hidden="true"></i></button></div></div><div id="build-grid-wrap" hidden><div class="plan-caption"><span>Rear · expanding land</span></div><div class="build-grid-scroll"><div id="build-grid" role="grid" aria-label="Castle building grid"></div></div><div class="plan-caption"><span>Gate · battleground side</span><span>${touchUI()?'Swipe to scroll the plan':'Scroll large plans sideways'}</span></div></div></div><div class="preview-instructions"><span id="build-selected">${pickHint()}</span><span>${touchUI()?'Tap to aim, tap again to place · drag to orbit · pinch to zoom, two fingers to pan':'Drag to orbit · scroll or pinch to zoom · right-drag to pan'}</span></div><div class="build-auto"><b>Auto fit</b><span id="build-clearance">Stairs open the floor directly above. Removing stairs restores the slab.</span></div><section class="build-route-check"><div><b>Route inspector</b><button id="build-check-routes">Check walkable routes</button></div><p id="build-route-summary" role="status">Check the entrance, stairs and upper decks against the actual castle geometry.</p><div id="build-route-progress" hidden><i></i></div><ul id="build-route-issues"></ul><p class="build-route-scope">An automated walking check. It reports blockers and suggestions; your pieces stay under your control.</p></section><p class="build-note">Every edit appears here immediately. Apply to map when your draft is ready.</p><div id="build-status" role="status"></div></main>
 <aside class="builder-progress"><h3>Castle character</h3><div class="beauty-total"><output id="build-beauty-score">0</output><span>/ 100<br>Design score</span></div><strong id="build-beauty-title">A new beginning</strong><div id="build-beauty-bars"></div><ul id="build-beauty-tips"></ul><div id="build-beauty-bonuses"></div><p class="build-note">A design guide, not a verdict on your style. Asymmetric castles and separate wings can score well. Repeated cannons or gardens alone do not earn beauty.</p><details class="build-progression"><summary>Level &amp; rewards</summary><p id="build-material-progression"></p><div id="build-level-layers"></div><strong id="build-layer-rule"></strong><p>Land grows from 10 × 10 to 28 × 28 plots as the castle level rises. All ten layers are open in the workshop.</p><p>Beauty titles are cosmetic rewards and never change combat.</p></details></aside></div>
 <footer class="builder-footer"><div><strong id="build-draft-state">Draft layout</strong><span id="build-apply-hint" role="status">Saved on this browser when applied.</span></div><button id="build-restore">Restore original castle</button><button id="build-apply">Apply to map</button></footer></div>`;
 const iconStyles=document.createElement('style');iconStyles.id='part-icon-styles';iconStyles.textContent=partIconCSS();panel.prepend(iconStyles);
 document.body.append(panel);
 const $=id=>panel.querySelector('#'+id),partById=new Map(PARTS.map(p=>[p.id,p]));
 let home=0,layer=0,type=PARTS[0].id,rotation=0,opened=false,selected=0,gridKey='',autoLayer=true,columns=null,hovering=false;
 let routeController=null,lastRouteReport=null,diagnosticRevision=0,architectController=null,lastArchitect=null;const activeTemplates=[null,null];let draftNetwork=null;
 const architect=createCastleArchitect(construction),architectPanel=document.createElement('section');architectPanel.className='build-architect';architectPanel.innerHTML='<div><b>Castle architect</b><select id="build-ai-goal" aria-label="Castle AI priority"><option value="balanced">Balanced</option><option value="defense">Defense first</option><option value="beauty">Beauty first</option></select><button id="build-ai-generate">Design a castle</button></div><p id="build-ai-status" role="status">Compare six plans, scan their perimeters and walk their routes before proposing a draft.</p><ul id="build-ai-reasons"></ul><p class="build-ai-scope">The proposal stays editable. Apply updates your castle.</p>';panel.querySelector('.build-route-check').before(architectPanel);
 const protectorPanel=document.createElement('section');protectorPanel.className='build-route-check';protectorPanel.innerHTML='<b>Protector network</b><p id="build-protector-status"></p><ul id="build-protector-issues"></ul><p class="build-note">Destroy all protectors before weapon hits can damage the main core. Silo blasts bypass them after shields fall. Unlocks: 20 / 40 / 60 / 80 / 100 + one bonus at 100. Main core always required.</p>';panel.querySelector('.build-route-check').before(protectorPanel);
 // Sticky parts sidebar (builder.css, two- and three-column layouts): the sticky header and footer heights (also the
 // shell's scroll padding) and the room left between header and footer at the shell's full height, so the parts list
 // scrolls on its own and the preview never moves. Until the shell has scrolled far enough for the sidebar to stick
 // (stuckAt), it sits lower by the rest of that distance (--ws-tuck) and is that much shorter, so it never reaches under
 // the footer: every part is visible inside the list, and keyboard focus scrolls the list, not the shell.
 const shellEl=panel.querySelector('.builder-shell'),headEl=panel.querySelector('.builder-header'),footEl=panel.querySelector('.builder-footer'),toolsEl=panel.querySelector('.builder-tools'),bodyEl=panel.querySelector('.builder-body');
 let stuckAt=0,tuckPx=-1;
 function sidebarTuck(){const v=stuckAt>0?Math.max(0,Math.round(stuckAt-shellEl.scrollTop)):0;if(v!==tuckPx){tuckPx=v;panel.style.setProperty('--ws-tuck',v+'px');}}
 function sidebarRoom(){
  if(panel.hidden||!headEl.offsetHeight)return;const cs=getComputedStyle(shellEl),full=parseFloat(cs.maxHeight)||innerHeight,head=headEl.offsetHeight+'px',foot=footEl.offsetHeight+'px';
  const room=Math.max(160,Math.round(full-parseFloat(cs.borderTopWidth)-parseFloat(cs.borderBottomWidth)-headEl.offsetHeight-footEl.offsetHeight-24))+'px';
  if(panel.style.getPropertyValue('--ws-head')!==head)panel.style.setProperty('--ws-head',head);if(panel.style.getPropertyValue('--ws-foot')!==foot)panel.style.setProperty('--ws-foot',foot);if(panel.style.getPropertyValue('--ws-side')!==room)panel.style.setProperty('--ws-side',room);
  const ts=getComputedStyle(toolsEl);stuckAt=0;
  if(ts.position==='sticky'){const port=shellEl.getBoundingClientRect().top+parseFloat(cs.borderTopWidth),statik=bodyEl.getBoundingClientRect().top-port+shellEl.scrollTop+parseFloat(getComputedStyle(bodyEl).paddingTop)+parseFloat(ts.marginTop);stuckAt=Math.max(0,statik-(parseFloat(ts.top)||0));}
  sidebarTuck();
 }
 if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(sidebarRoom);for(const el of [shellEl,headEl,footEl,panel.querySelector('.builder-toolbar')])if(el)ro.observe(el);}addEventListener('resize',sidebarRoom,{passive:true});shellEl.addEventListener('scroll',sidebarTuck,{passive:true});
 const adjustments=document.createElement('details');adjustments.id='build-adjustments';adjustments.innerHTML='<summary>Neighbour fitting <span></span></summary><ul></ul>';panel.querySelector('.build-auto').after(adjustments);
 const applied=[null,null],appliedOptions=[null,null],drafts=[null,null],draftOptions=[freshOptions(),freshOptions()],undos=[[],[]],cells=[];
 const preset=(name,options=draftOptions[home])=>copyLayout(construction.presets(name,options));
 const currentProfile=()=>profile(draftOptions[home]);
 function applyReadiness(network=null){
  const hasCore=drafts[home]?.some(p=>p.type==='core');
  $('build-apply').disabled=!hasCore;
  $('build-preview-status').textContent=hasCore?'Live draft':'Heart not placed';
  const hint=$('build-apply-hint');hint.dataset.result=!hasCore||network?.blocked||(lastRouteReport&&!lastRouteReport.ok)?'fail':'pass';
  hint.textContent=!hasCore?'Choose Castle heart and place it before applying.':network?.blocked?'Clear '+network.blocked+' blocked protector beam'+(network.blocked===1?'':'s')+' before applying.':lastRouteReport&&!lastRouteReport.ok?'Walking access needs attention. Review the Route inspector before applying.':network?'Ready to apply. Check walking access with the Route inspector.':panel.dataset.editorView==='simple'?'Castle heart placed. Open 3D workshop to check protector beams.':'Castle heart placed. Checking protector beams…';
 }
 function status(text){$('build-status').textContent=text;}
 function options(value){const p=profile(value);return {level:p.level,material:value?.material||'fortress'};}
 function save(){try{localStorage.setItem(STORAGE,JSON.stringify({version:2,castles:applied.map((layout,i)=>layout===null?null:{layout,options:appliedOptions[i]})}));return true;}catch{return false;}}
 try{
  const raw=localStorage.getItem(STORAGE);
  if(raw){const value=JSON.parse(raw);if(![1,2].includes(value.version)||!Array.isArray(value.castles)||value.castles.length!==2)throw Error('Unsupported saved layout');
   for(let i=0;i<2;i++)if(value.castles[i]!==null){const entry=value.castles[i],layout=value.version===1?entry:entry.layout,config=value.version===1?{level:20,material:'fortress'}:options(entry.options);construction.apply(i,layout,config);applied[i]=copyLayout(layout);appliedOptions[i]={...config};draftOptions[i]={...config};}
  }
 }catch{report('A saved castle could not be loaded. The original layout is available.');for(let i=0;i<2;i++){construction.restore(i);applied[i]=appliedOptions[i]=null;draftOptions[i]=freshOptions();}}
 for(let i=0;i<2;i++){if(applied[i])drafts[i]=copyLayout(applied[i]);else{const design=construction.template('sanctuary',draftOptions[i]);drafts[i]=roomy(design.layout).layout;activeTemplates[i]=design;}}
 $('build-layer').add(new Option('Auto · top surface','auto'));for(let i=0;i<LAYERS;i++)$('build-layer').add(new Option('Layer '+(i+1)+' / '+i*CELL+' m',String(i)));
 const erase={id:'erase',label:'Erase',symbol:'×',color:'#db8984'};
 for(const p of [...PARTS,erase]){
  $('build-quick-part').add(new Option(p.label,p.id));const b=document.createElement('button');b.type='button';b.dataset.part=p.id;b.innerHTML='<span class="part-icon" aria-hidden="true"></span><b></b>';b.querySelector('span').dataset.icon=p.id;b.querySelector('b').textContent=p.label;b.title=p.help||p.label;b.style.setProperty('--part-color',p.color||'#b5d7d4');b.onclick=()=>{type=p.id;drawTools();};$('build-parts').append(b);
 }
 $('build-quick-part').onchange=()=>{type=$('build-quick-part').value;drawTools();};
 const rotate=()=>{rotation=(rotation+1)%4;drawTools();};$('build-quick-rotate').onclick=rotate;$('build-rotate').onclick=rotate;
 function makeGrid(){
  const p=currentProfile(),key=[p.size,p.minX,p.minZ].join(':');if(key===gridKey)return;gridKey=key;cells.length=0;selected=0;$('build-grid').replaceChildren();$('build-grid').style.setProperty('--grid-size',p.size);
  // Plot numbers along the top and left (builder.css shows them, pinned while scrolling, on touch screens only).
  const axis=text=>{const i=document.createElement('i');i.className='grid-axis';i.textContent=text;return i;},head=document.createElement('div');head.className='grid-axis-row';head.setAttribute('aria-hidden','true');head.append(axis(''));for(let i=1;i<=p.size;i++)head.append(axis(i));$('build-grid').append(head);
  for(let z=p.minZ;z<p.maxZ;z++){const row=document.createElement('div');row.setAttribute('role','row');const number=axis(z-p.minZ+1);number.setAttribute('aria-hidden','true');row.append(number);
   for(let x=p.minX;x<p.maxX;x++){const b=document.createElement('button'),index=cells.length;b.type='button';b.className='build-cell';b.setAttribute('role','gridcell');b.dataset.x=x;b.dataset.z=z;b.tabIndex=index===0?0:-1;b.onclick=()=>edit(x,z);
    b.onfocus=()=>{selected=index;$('build-selected').textContent='Plot '+(x-p.minX+1)+' / '+(z-p.minZ+1);};
    b.onkeydown=e=>{const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-p.size,ArrowDown:p.size}[e.key];if(offset){e.preventDefault();e.stopPropagation();const next=Math.min(cells.length-1,Math.max(0,selected+offset));cells.forEach((c,i)=>c.tabIndex=i===next?0:-1);cells[next].focus();}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();edit(x,z,true);}};
    row.append(b);cells.push(b);
   }$('build-grid').append(row);
  }
 }
 // Placement: one rule check feeds the hover tint, the simplified grid and every click. Auto layer (default) builds on the
 // column the player sees: a walkable top (terrace, floor, court...) takes the piece on its surface, keeping its body;
 // terrace / floor / deck / bridge pieces raise that column one layer; a structure top (tower, wall, roof...) gets the
 // piece on the layer above. A fixed layer from the Layer menu targets that layer as before.
 const GROUND=new Set(['terrace','roundTerrace','floor','deck','battlement','garden','spawn','embankment','wallBridge']),RAISE=new Set(['terrace','roundTerrace','floor','deck','wallBridge']);
 // Only floor-like pieces fit a stair's headroom (castle-rules stairClearances): their slab gets the automatic opening.
 // Templates and AI castles always keep that cell clear.
 const OPEN_ABOVE_STAIRS=new Set(['floor','deck','battlement','spawn','terrace','roundTerrace','wallBridge']);
 const label=id=>partById.get(id)?.label||'piece',openList=()=>{const names=[...OPEN_ABOVE_STAIRS].map(id=>label(id).toLowerCase());return names.slice(0,-1).join(', ')+' or '+names.at(-1);},layerCaption=()=>autoLayer?'Auto layer':'Layer '+(layer+1)+' · '+layer*CELL+' m',resetLayer=()=>{layer=0;$('build-layer').value=autoLayer?'auto':'0';};
 function top(x,z){if(!columns){columns=new Map();for(const p of drafts[home]){const k=p.x+':'+p.z,t=columns.get(k);if(!t||p.layer>t.layer)columns.set(k,p);}}return columns.get(x+':'+z)||null;}
 const surface=(x,z)=>{const t=top(x,z);return t?(GROUND.has(t.type)?t.layer:t.layer+1):null;};
 function targetLayer(x,z,remove=type==='erase'){if(!autoLayer)return layer;const t=top(x,z);return remove?(t?t.layer:0):!t?0:GROUND.has(t.type)&&!RAISE.has(type)?t.layer:t.layer+1;}
 function placementIssue(x,z,at,remove=type==='erase'){
  const p=currentProfile(),d=drafts[home],issue=(code,text,short)=>({code,text,short}),find=l=>d.find(q=>q.x===x&&q.z===z&&q.layer===l);
  if(!containsCell({x,z},p))return issue('outside',p.level<100?'Outside your plot. Raise the castle level for more land.':'Outside your plot.','outside your plot');
  if(remove)return find(at)?null:issue('empty','Nothing to erase here.','nothing to erase');
  if(at>=LAYERS)return issue('top','No room above: layer '+LAYERS+' is the top layer.','no layer above');
  const prior=find(at);
  if(prior?.type===type&&prior.rotation===rotation)return issue('same','This plot already has that '+label(type).toLowerCase()+'.','already here');
  if(!prior&&d.length>=MAX_PARTS)return issue('cap','Your castle already uses all '+MAX_PARTS+' pieces. Erase one to add a new piece.','piece limit reached');
  if(type==='protector'&&prior?.type!=='protector'){const limit=protectorLimit(p.level);if(d.filter(q=>q.type==='protector').length>=limit)return issue('protectors',!limit?'Protector cores unlock at castle level 20.':p.level>=100?'Level 100 allows '+limit+' protector cores, the most a castle can have. Erase one to move it.':'All '+limit+' protector cores for level '+p.level+' are placed. Erase one to move it; another unlocks every 20 levels.','protector limit');}
  if(type==='core'){const core=d.find(q=>q.type==='core');if(core&&core!==prior)return issue('core','There already is a castle heart (plot '+(core.x-p.minX+1)+' / '+(core.z-p.minZ+1)+', layer '+(core.layer+1)+'). Erase the old one to add a new one.','heart already placed');}
  if(type==='stairs'){if(at>=LAYERS-1)return issue('stairs-top','Stairs need a layer above them. Layer '+LAYERS+' is the top.','no layer above the stairs');const above=find(at+1);if(above&&!OPEN_ABOVE_STAIRS.has(above.type))return issue('stairs-blocked','Stairs need clear space above. Move the '+label(above.type).toLowerCase()+' on layer '+(at+2)+' first.','blocked above');}
  if(at>0&&find(at-1)?.type==='stairs'&&!OPEN_ABOVE_STAIRS.has(type))return issue('headroom','Stairs below need clear space above. Only a '+openList()+' fits here.','stairs below need headroom');
  return null;
 }
 // Refused edits: a red message over the preview (absolutely placed, so nothing shifts; it shakes unless reduced
 // motion is preferred), the same words in #build-status for screen readers, and a short generated error blip.
 const errorBox=document.createElement('p');errorBox.id='build-error';errorBox.setAttribute('aria-hidden','true');panel.querySelector('.build-preview-wrap').append(errorBox);
 const feedback={rejections:0,blips:0,played:0,confirms:0,chimes:0,last:null};let errorTimer=0;
 // Over the preview when its lower part is on screen (3D clicks, the level slider); otherwise (simplified grid scrolled
 // down, Apply in the footer) it floats just above the workshop footer so it is never off screen.
 function placeError(){
  const w=errorBox.parentElement.getBoundingClientRect(),foot=panel.querySelector('.builder-footer')?.getBoundingClientRect(),limit=Math.min(innerHeight,foot?.height?foot.top:innerHeight),inView=w.bottom-40<=limit&&w.bottom-110>=0;
  // A top left by a floated note (the slider or Apply refused with the preview scrolled away) would stretch the box between it
  // and the slot's bottom and spoil widen() and offTarget(): back in view, the note measures from its usual slot.
  // A floated note that would cover its target in the preview (a short phone's preview runs under the footer) also takes the
  // preview top when that is on screen above the floated place.
  errorBox.classList.toggle('float',!inView);if(inView&&errorBox.style.top&&!errorBox.classList.contains('top'))errorBox.style.top='';widen(w);
  const low=inView?null:limit-12-errorBox.offsetHeight,high=offTarget(w,low);errorBox.classList.toggle('top',high);if(high)errorBox.classList.remove('float');
  const top=high?NOTE_TOP+'px':!inView?Math.round(low-w.top)+'px':'';if(errorBox.style.top!==top)errorBox.style.top=top;
 }
 // Short screens clamp a red refusal to two lines (builder.css; the whole reason is always in #build-status). Where the preview is
 // too narrow for the whole reason in two lines and the parts column sits beside it, the note spans that column too (in view or
 // floated); a reason still longer than two lines (a narrow phone's one-column workshop) gets a third (.long), never cut off.
 const shortScreen=(()=>{try{return matchMedia('(max-height:500px)');}catch{return {matches:false};}})();
 function widen(w){
  let left='',max='',long=false;
  if(shortScreen.matches&&!errorBox.classList.contains('note')){
   if(errorBox.style.left){errorBox.style.left='';errorBox.style.maxWidth='';}errorBox.classList.remove('long');
   const tools=panel.querySelector('.builder-tools')?.getBoundingClientRect(),x0=w.left+errorBox.parentElement.clientLeft,over=()=>errorBox.scrollHeight>errorBox.clientHeight+1;
   if(over()&&tools?.width&&tools.right<=w.left){left=errorBox.style.left=Math.round(tools.left-x0)+'px';max=errorBox.style.maxWidth=Math.round(w.right-8-tools.left)+'px';}
   long=over();
  }
  if(errorBox.style.left!==left)errorBox.style.left=left;if(errorBox.style.maxWidth!==max)errorBox.style.maxWidth=max;errorBox.classList.toggle('long',long);
 }
 // A note keeps off its target in the preview (castle-preview targetRect: the aimed tile and pin, the edit's cue box and
 // spark, a refused plot's red tile and pin): where its usual place over the camera bar would cover it, the note moves to the
 // preview top, over the captions, when that covers less and is not under the workshop header. A refusal with no plot (open
 // sky, the level slider) stays put.
 const NOTE_TOP=6;let noteLow=46,refused=null;
 function offTarget(w,floated=null){
  const red=!errorBox.classList.contains('note'),kind=red||errorBox.classList.contains('aim')?'aim':errorBox.classList.contains('ok')?'ok':null,t=kind&&preview.targetRect(red?refused:kind==='aim'?preview.aimed:placed,kind);if(!t)return false;
  if(floated===null&&!errorBox.classList.contains('top'))noteLow=parseFloat(getComputedStyle(errorBox).bottom)||noteLow;
  const wrap=errorBox.parentElement,e=errorBox.getBoundingClientRect(),inner=w.top+wrap.clientTop,low=floated??inner+wrap.clientHeight-noteLow-e.height,high=inner+NOTE_TOP,head=panel.querySelector('.builder-header')?.getBoundingClientRect().bottom||0;
  const cover=y=>Math.max(0,Math.min(e.right,t.right+4)-Math.max(e.left,t.left-4))*Math.max(0,Math.min(y+e.height,t.bottom+4)-Math.max(y,t.top-4)),a=cover(low);
  return a>0&&high>=head&&high<=low&&cover(high)<a;
 }
 function clearError(){if(errorBox.classList.contains('show')){clearTimeout(errorTimer);errorBox.classList.remove('show','shake');}}
 function reject(issue,cell=null){
  const text=typeof issue==='string'?issue:issue.text;refused=cell;feedback.rejections++;feedback.last={code:issue.code||'error',text};status(text);
  if(errorBox.textContent!==text)errorBox.textContent=text;errorBox.classList.remove('shake','note','ok','aim');placeError();void errorBox.offsetWidth;errorBox.classList.add('show','shake');
  clearTimeout(errorTimer);errorTimer=setTimeout(()=>errorBox.classList.remove('show','shake'),2800);blip();
 }
 // Placed / erased (ok) and tap-to-aim (aim) notes use the same slot: gold, no shake, shorter. Placed in a frame callback
 // (the grid can place hundreds of pieces in one task, and layout is read once per frame).
 let noteFrame=0;
 function notice(text,kind,ms){
  if(errorBox.textContent!==text)errorBox.textContent=text;errorBox.classList.remove('shake','ok','aim');errorBox.classList.add('show','note',kind);
  placeNote();clearTimeout(errorTimer);errorTimer=setTimeout(()=>errorBox.classList.remove('show'),ms);
 }
 function placeNote(){if(!noteFrame)noteFrame=requestAnimationFrame(()=>{noteFrame=0;placeError();});}
 function clearNotice(kind){if(errorBox.classList.contains(kind)&&errorBox.classList.contains('show')){clearTimeout(errorTimer);errorBox.classList.remove('show');}}
 // Error blip and confirm chime: Master volume x Sound effects from the saved settings (live controls as fallback).
 // Silent under ?test unless &sfx=1; the AudioContext is created and resumed only from a gesture inside the workshop.
 const sfx={context:null,last:-1,allowed:(()=>{try{const q=new URLSearchParams(location.search);return !q.has('test')||q.get('sfx')==='1';}catch{return true;}})()};
 function sfxVolume(){
  let on,volume;try{const d=JSON.parse(localStorage.getItem('crusaders-aerie-settings-v1')||'null');on=d?.checks?.['setting-sfx'];volume=Number(d?.inputs?.['setting-volume']??NaN);}catch{}
  if(typeof on!=='boolean'){const box=document.getElementById('setting-sfx');on=box?box.checked:true;}
  if(!Number.isFinite(volume)){const range=document.getElementById('setting-volume');volume=range?Number(range.value):70;}
  return on&&Number.isFinite(volume)?Math.max(0,Math.min(1,volume/100)):0;
 }
 function unlockSound(){if(!sfx.allowed||sfx.context?.state==='running'||!sfxVolume())return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!sfx.context)sfx.context=new AC();void sfx.context.resume();}catch{}}
 for(const name of ['pointerdown','pointerup','keydown','touchend','click'])panel.addEventListener(name,unlockSound,{passive:true});
 // Notes: [start Hz, end Hz, delay s, length s, peak gain, wave]. The blip falls (two square notes over a low thud); the
 // chime is a soft rising fifth on triangle waves, about half as loud. One cue per 90 ms.
 const BLIP=[[330,220,0,.08,.13,'square'],[220,140,.085,.14,.12,'square'],[110,80,0,.2,.1,'triangle']],CHIME=[[784,790,0,.09,.07,'triangle'],[1175,1180,.075,.16,.06,'triangle']];
 function tones(notes,cutoff){
  const volume=sfx.allowed?sfxVolume():0;if(!volume)return false;unlockSound();const c=sfx.context;if(!c)return false;
  const now=c.currentTime;if(sfx.last>=0&&now-sfx.last<.09)return false;sfx.last=now;feedback.played++;
  try{const out=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=cutoff;out.gain.value=volume;lp.connect(out).connect(c.destination);
   for(const [f0,f1,t,dur,peak,kind] of notes){const o=c.createOscillator(),g=c.createGain(),at=now+t;o.type=kind;o.frequency.setValueAtTime(f0,at);o.frequency.exponentialRampToValueAtTime(f1,at+dur);g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(peak,at+.006);g.gain.exponentialRampToValueAtTime(.0001,at+dur);o.connect(g).connect(lp);o.start(at);o.stop(at+dur+.02);}
   setTimeout(()=>{try{lp.disconnect();out.disconnect();}catch{}},700);}catch{}
  return true;
 }
 function blip(){feedback.blips++;tones(BLIP,1800);}
 function chime(){feedback.confirms++;if(tones(CHIME,3600))feedback.chimes++;}
 function hoverText(x,z,l,issue){
  const p=currentProfile();let text=pickHint();hovering=x!==null;
  if(x!==null){const prior=drafts[home].find(q=>q.x===x&&q.z===z&&q.layer===l);text=issue?.code==='outside'?'Outside your plot':'Plot '+(x-p.minX+1)+' / '+(z-p.minZ+1)+' · layer '+(Math.min(l,LAYERS-1)+1)+(issue?' · '+issue.short:prior&&type==='erase'?' · erase '+label(prior.type).toLowerCase():prior&&prior.type!==type?' · replaces '+label(prior.type).toLowerCase():'');if(!issue&&aimed&&aimed.x===x&&aimed.z===z)text='Tap again to '+(type==='erase'?'erase':'place')+' · '+text;}
  if($('build-selected').textContent!==text)$('build-selected').textContent=text;
  const caption=autoLayer&&x!==null&&issue?.code!=='outside'?'Layer '+(Math.min(l,LAYERS-1)+1)+' · '+Math.min(l,LAYERS-1)*CELL+' m':layerCaption();if($('build-preview-layer').textContent!==caption)$('build-preview-layer').textContent=caption;
 }
 // A tap that picks no plot (open sky, off the model) is refused like any other edit: red message, shake and blip.
 const missText=()=>'Outside your plot. '+(touchUI()?'Tap':'Click')+' the castle or its grid to '+(type==='erase'?'erase.':'build.');
 // Touch aim (castle-preview.js): the first tap on a plot aims; the note and the hover line say to tap again (a part
 // changed while aimed is named anew). Re-aiming twice in a row (small plots) suggests zooming in or the simplified grid
 // instead. One line on a short landscape phone (builder.css), so the note stays a strip clear of the aimed tile.
 let aimed=null,reaims=0,placed=null;
 function onAim(cell){
  if(!cell){aimed=null;clearNotice('aim');return;}
  const moved=!aimed||aimed.x!==cell.x||aimed.z!==cell.z;if(moved)reaims=aimed?reaims+1:0;aimed=cell;hoverText(cell.x,cell.z,cell.layer,cell.issue);
  const prior=drafts[home].find(q=>q.x===cell.x&&q.z===cell.z&&q.layer===cell.layer);
  notice(moved&&reaims>=2?'Pinch to zoom in, or use the Simplified grid':'Tap again to '+(type==='erase'?'erase the '+label(prior?.type).toLowerCase():'place the '+label(type).toLowerCase()),'aim',2600);
 }
 // The preview's cue for the last edit: a placed piece whose top another column hides is named behind that column's top
 // piece (what the player sees in front).
 function onFlash(cue){
  if(errorBox.classList.contains('ok'))placeNote();
  if(!cue.hidden||cue.erase||!placed||placed.erase||cue.x!==placed.x||cue.z!==placed.z||cue.layer!==placed.layer)return;
  const t=top(cue.hidden.x,cue.hidden.z)||(cue.hidden.type?cue.hidden:null);if(!t)return;const behind='behind the layer-'+(t.layer+1)+' '+label(t.type).toLowerCase();
  status('Placed '+label(placed.type).toLowerCase()+' on layer '+(placed.layer+1)+', '+behind+'. Orbit to see it.');
  if(errorBox.classList.contains('ok')&&errorBox.textContent===placed.note)notice(placed.note+' · '+behind,'ok',2800);
 }
 // The camera bar over the preview bottom (CSS pixels from the canvas bottom and left edges): Fit keeps markers clear of it.
 function previewBands(){const c=$('build-preview').getBoundingClientRect(),bar=panel.querySelector('.preview-camera').getBoundingClientRect();return c.height>1&&bar.width?{bottom:Math.max(0,c.bottom-bar.top+4),left:bar.left-c.left-4,right:bar.right-c.left+4}:null;}
 const preview=castlePreview($('build-preview'),construction,{onPlace:(x,z,l)=>edit(x,z,false,l),onMiss:()=>reject({code:'outside',text:missText()}),onAim,onFlash,onView:()=>{if(errorBox.classList.contains('note')&&errorBox.classList.contains('show'))placeNote();},bands:previewBands,onHover:hoverText,height:surface,targetLayer:(x,z)=>targetLayer(x,z),check:(x,z,l)=>placementIssue(x,z,l),onBuilt(model){const report=protectorReport(model.links);draftNetwork=report;applyReadiness(report);$('build-protector-status').textContent=report.total+' / '+protectorLimit(currentProfile().level)+' protector cores · '+report.linked+' clear beams · '+report.blocked+' blocked · average spacing '+report.separation+' m.'; $('build-protector-status').dataset.result=report.blocked?'fail':'pass';$('build-protector-issues').replaceChildren(...report.issues.map(issue=>{const li=document.createElement('li');li.textContent='Plot '+issue.cell.x+', '+issue.cell.z+' / layer '+(issue.cell.layer+1)+': '+issue.message;return li;}));const list=model.adjustments||model.root.userData.adjustments||[];adjustments.querySelector('span').textContent='· '+list.length+' adjustments';adjustments.querySelector('ul').replaceChildren(...list.slice(0,8).map(a=>{const li=document.createElement('li');li.textContent=a.message+' Layer '+(a.cell.layer+1)+', plot '+a.cell.x+'/'+a.cell.z+'.';return li;}));if(!list.length){const li=document.createElement('li');li.textContent='No neighbouring pieces need additional fitting.';adjustments.querySelector('ul').append(li);}}});
 function editorView(value){panel.dataset.editorView=value;applyReadiness(draftNetwork);$('build-grid-wrap').hidden=value==='live';$('build-view-live').setAttribute('aria-pressed',String(value==='live'));$('build-view-simple').setAttribute('aria-pressed',String(value==='simple'));if(value==='simple'&&opened)centreGrid();}
 // A plan larger than its scroll box (touch screens) opens centred on the castle heart, or the plot centre.
 function centreGrid(){
  const box=panel.querySelector('.build-grid-scroll'),p=currentProfile();if(box.scrollWidth<=box.clientWidth+1&&box.scrollHeight<=box.clientHeight+1)return;
  const core=drafts[home].find(q=>q.type==='core'&&containsCell(q,p)),x=core?core.x:Math.floor((p.minX+p.maxX)/2),z=core?core.z:Math.floor((p.minZ+p.maxZ)/2),cell=cells[(z-p.minZ)*p.size+(x-p.minX)];if(!cell)return;
  const b=box.getBoundingClientRect(),c=cell.getBoundingClientRect();box.scrollLeft+=c.left+c.width/2-(b.left+b.width/2);box.scrollTop+=c.top+c.height/2-(b.top+b.height/2);
 }
 $('build-view-live').onclick=()=>editorView('live');$('build-view-simple').onclick=()=>editorView('simple');$('build-orbit-left').onclick=()=>preview.rotate(-Math.PI/8);$('build-orbit-right').onclick=()=>preview.rotate(Math.PI/8);$('build-fit').onclick=()=>preview.fit();editorView('live');

 function invalidateRoutes(){
  if(architectController){architectController.abort();architectController=null;$('build-ai-generate').textContent='Design a castle';$('build-ai-status').textContent='Search cancelled because the draft changed.';}lastArchitect=null;$('build-ai-reasons').replaceChildren();
  diagnosticRevision++;routeController?.abort();routeController=null;lastRouteReport=null;preview.setRoutes?.([]);
  $('build-check-routes').disabled=false;$('build-check-routes').textContent='Check walkable routes';$('build-route-progress').hidden=true;$('build-route-issues').replaceChildren();
  $('build-route-summary').textContent='Draft changed. Check entrance access, stair landings and upper-deck connections.';delete $('build-route-summary').dataset.result;
 }
 function schematic(layout,config){
  const size=164,canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d'),p=profile(config),unit=(size-16)/p.size;
  ctx.fillStyle='#16203b';ctx.fillRect(0,0,size,size);ctx.fillStyle='#223257';ctx.fillRect(8,8,size-16,size-16);
  const sorted=[...layout].sort((a,b)=>a.layer-b.layer);
  const terraces=['#536f79','#647f87','#739099','#86a3a7','#94b4b4','#a8c4be','#b8d1c8','#cbdcd1','#d9e5d8','#e6ecd9'];
  for(const item of sorted){
   ctx.fillStyle=item.type==='garden'?'#80b894':item.type==='core'?'#d5aee3':['wall','gate','tower','battlement','curvedWall'].includes(item.type)?'#d6bd80':['deck','embankment'].includes(item.type)?'#aa875f':terraces[item.layer];ctx.globalAlpha=1;
   const x=8+(item.x-p.minX)*unit,z=8+(item.z-p.minZ)*unit,round=item.footprint==='round'||['roundTerrace','curvedWall'].includes(item.type);
   if(round){ctx.beginPath();ctx.arc(x+unit/2,z+unit/2,unit/2-.18,0,Math.PI*2);ctx.fill();}else ctx.fillRect(x+.18,z+.18,unit-.36,unit-.36);
   if(item.type==='curvedWall'){ctx.save();ctx.translate(x+unit/2,z+unit/2);ctx.rotate(-item.rotation*Math.PI/2);ctx.strokeStyle='#ffedb7';ctx.lineWidth=unit*.24;ctx.beginPath();ctx.arc(0,0,unit*.36,0,Math.PI/2);ctx.stroke();ctx.restore();}
  }
  for(const item of layout.filter(p=>p.type==='stairs')){const x=8+(item.x-p.minX+.5)*unit,z=8+(item.z-p.minZ+.5)*unit;ctx.save();ctx.translate(x,z);ctx.rotate(-item.rotation*Math.PI/2);ctx.fillStyle='#ffcf6d';ctx.beginPath();ctx.moveTo(0,-unit*.48);ctx.lineTo(unit*.43,unit*.4);ctx.lineTo(-unit*.43,unit*.4);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.globalAlpha=1;drawPixelIcon(ctx,MARKER_ICONS.gate,size/2-8,size-16);return canvas;
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
   const use=document.createElement('button');use.dataset.loadTemplate=meta.id;use.textContent='Use this layout';use.onclick=()=>loadTemplate(meta.id,level);copy.append(use);card.append(copy);return card;
  }));
 }
 function loadTemplate(id,level){
  const config={...draftOptions[home],level},data=construction.template(id,config),room=roomy(data.layout);
  remember();draftOptions[home]=config;drafts[home]=room.layout;activeTemplates[home]=data;resetLayer();draw();showLibrary(false);preview.fit();status(data.name+' loaded at level '+level+'. Check its routes or start editing; Apply updates the map.'+(room.trimmed?' '+room.trimmed+' filler earth banks were left out so '+(MAX_PARTS-room.layout.length)+' parts stay free for your own pieces.':''));
 }
 for(let level=10;level<=100;level+=10)$('build-template-level').add(new Option('Level '+(level-9)+'–'+level+' · '+profile({level}).size+'×'+profile({level}).size,String(level)));
 function showLibrary(value){$('build-library').hidden=!value;$('build-view-library').setAttribute('aria-expanded',String(value));if(value){$('build-template-level').value=String(Math.ceil(draftOptions[home].level/10)*10);drawLibrary();$('build-library').scrollIntoView({block:'nearest'});}}
 $('build-open-library').onclick=()=>showLibrary(true);$('build-view-library').onclick=()=>showLibrary($('build-library').hidden);$('build-close-library').onclick=()=>showLibrary(false);$('build-template-level').onchange=drawLibrary;
 $('build-ai-generate').onclick=async()=>{
  if(architectController){architectController.abort();architectController=null;$('build-ai-generate').textContent='Design a castle';$('build-ai-status').textContent='Search cancelled. Your draft is unchanged.';return;}
  const controller=new AbortController();architectController=controller;const selectedHome=home,revision=diagnosticRevision;$('build-ai-generate').textContent='Cancel search';$('build-ai-reasons').replaceChildren();
  try{const captured=captureDesignSeed();const result=await architect.generate({home,timestamp:captured.timestamp,options:{...draftOptions[home]},goal:$('build-ai-goal').value,seed:captured.seed,signal:controller.signal,onProgress:p=>{if(!controller.signal.aborted)$('build-ai-status').textContent=p.message||'Checking castle routes…';}});
   if(controller.signal.aborted||revision!==diagnosticRevision||home!==selectedHome)return;architectController=null;
   if(result.ok){remember();drafts[home]=roomy(result.layout).layout;draftOptions[home]={...result.options};activeTemplates[home]={objectives:result.objectives};resetLayer();draw();preview.fit();lastArchitect=result;const m=result.metrics;$('build-ai-status').textContent=result.summary+' Seed '+result.seed+' · '+new Date(result.timestamp).toLocaleTimeString()+' · Beauty '+m.beauty+'/100 · sampled defense coverage '+m.coverage+'%.';$('build-ai-reasons').replaceChildren(...result.explanations.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));status('AI proposal ready. Edit it, Undo it, or Apply to map.');}
   else $('build-ai-status').textContent=result.summary;
  }catch(error){if(!controller.signal.aborted)$('build-ai-status').textContent='Design search could not finish: '+error.message;}
  finally{if(architectController===controller)architectController=null;if(!architectController)$('build-ai-generate').textContent='Design a castle';}
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
   $('build-route-summary').dataset.result=result.ok?'pass':'fail';applyReadiness(draftNetwork);preview.setRoutes?.(success);
   for(const issue of (result.issues||[]).slice(0,12)){const li=document.createElement('li'),button=document.createElement('button');button.textContent=(issue.message||issue.label||issue.code)+(issue.suggestion?' '+issue.suggestion:'');button.onclick=()=>{const cell=issue.cell;if(!cell)return;autoLayer=false;layer=Math.max(0,Math.min(9,cell.layer??0));$('build-layer').value=String(layer);drawGrid();drawTools();preview.focusCell?.(cell);$('build-selected').textContent='Inspect plot '+(cell.x-profile(config).minX+1)+' / '+(cell.z-profile(config).minZ+1)+' · layer '+(layer+1);};li.append(button);$('build-route-issues').append(li);}
  }catch(error){if(!controller.signal.aborted)$('build-route-summary').textContent='Route check could not finish: '+error.message;}
  finally{model?.dispose();if(routeController===controller){routeController=null;$('build-check-routes').disabled=false;$('build-check-routes').textContent='Check walkable routes';$('build-route-progress').hidden=true;}}
 };
 function remember(){undos[home].push({layout:copyLayout(drafts[home]),options:{...draftOptions[home]},template:activeTemplates[home]});if(undos[home].length>30)undos[home].shift();}
 function edit(x,z,eraseOnly=false,at=null){
  const remove=eraseOnly||type==='erase',l=Number.isInteger(at)?at:targetLayer(x,z,remove),issue=placementIssue(x,z,l,remove);
  if(issue){reject(issue,{x,z,layer:l});return false;}
  const d=drafts[home],index=d.findIndex(p=>p.x===x&&p.z===z&&p.layer===l),prior=d[index],shaped=['terrace','roundTerrace','curvedWall','embankment'].includes(type);
  const keepBody=prior&&(['terrace','roundTerrace','curvedWall'].includes(prior.type)||prior.solid===true);
  const keepRound=prior&&(prior.footprint==='round'||['roundTerrace','curvedWall'].includes(prior.type));
  // A structure built on a walkable piece (rampart walk, court, floor, terrace...) remembers that piece as its base, and
  // erasing the structure puts it back exactly. Older pieces standing on a kept terrace body (no base) leave the
  // terrace when erased. Erase again to remove the tier.
  let base=null;if(!remove&&prior&&!GROUND.has(type)){if(prior.base)base=prior.base;else if(GROUND.has(prior.type)){const {x:_x,z:_z,layer:_l,base:_b,...own}=prior;base=own;}}
  const back=remove&&prior.base&&partById.has(prior.base.type)?prior.base:null;
  const leaves=back?null:remove&&prior.solid===true&&!['terrace','roundTerrace','embankment'].includes(prior.type)?(keepRound?'roundTerrace':'terrace'):null;
  remember();activeTemplates[home]=null;if(index>=0)d.splice(index,1);
  if(back)d.push({x,z,layer:l,...back});
  if(leaves)d.push({x,z,layer:l,type:leaves,rotation:prior.rotation,...(prior.fortified?{fortified:true}:{})});
  if(!remove)d.push({x,z,layer:l,type,rotation,...(prior?.fortified?{fortified:true}:{}),...(prior?.wallBattery?{wallBattery:true}:{}),...(keepBody&&!shaped?{solid:true}:{}),...(keepRound&&!shaped?{footprint:'round'}:{}),...(base?{base}:{})});
  clearError();status(remove?(back?label(prior.type)+' removed; the '+label(back.type).toLowerCase()+' it stood on is back.':leaves?label(prior.type)+' removed; its '+label(leaves).toLowerCase()+' stays. Erase again to remove the tier.':'Part removed from draft.'):'Placed '+label(type).toLowerCase()+' on layer '+(l+1)+'.');draw();
  // Every successful edit: the preview cue over the piece, a gold note over the preview and a soft chime.
  const gone=remove&&label(prior.type).toLowerCase();placed={x,z,layer:l,type,erase:remove,note:remove?'Erased '+gone+(back?' · '+label(back.type).toLowerCase()+' is back':leaves?' · its '+label(leaves).toLowerCase()+' stays':''):'Placed '+label(type).toLowerCase()+' · layer '+(l+1)};
  preview.flash(placed);notice(placed.note,'ok',1900);chime();return true;
 }
 function drawTools(){
  for(const b of $('build-parts').children)b.setAttribute('aria-pressed',String(b.dataset.part===type));$('build-rotate').querySelector('span').textContent=rotation*90+'°';$('build-quick-part').value=type;$('build-quick-rotate').textContent='Rotate · '+rotation*90+'°';
  const help={protector:'Direct beam to the main core. A blocked beam gives no protection. Scatter reachable cores across wards; unlocks every 20 levels, starting at 20.',core:'One crown core per castle. Its large cradle extends across neighboring plots.',stairs:'Rises one layer. An overhead floor gets a matching opening automatically; add an upper floor beside the stair crest for a landing.',erase:'Erase the top part you point at (or the part on the chosen layer). A piece built on a walk, court, floor or terrace gives that surface back; erase again to remove it. Removing stairs also closes their automatic floor opening.',terrace:'A square masonry tier from the foundation to this layer. Explicit lower stairs and landings leave passage space.',roundTerrace:'A round stone bastion within one square plot. Its curved sides and empty corners match the collision. Decorations keep its round base.',curvedWall:'A thick quarter-circle wall on a round base. Rotate to face its protected corner; the other three quarters stay open.',embankment:'A rough earth-and-stone bank, half a wall high. Rotate its high back toward the wall. Its raised outer toe blocks walking; keep gates and stairs clear.'};
  $('build-help').textContent=help[type]||'Pick a part, then a plot. Replacing a terrace keeps its stone body and shape. Choose Stone terrace to make the base square again.';const capability=partAffordance(type);if(capability?.defense)$('build-help').textContent+=' AI capability: automatic match defense with manual entry nearby (F).';
  preview.setTool({layer:autoLayer?0:layer,auto:autoLayer,type,rotation});if(!hovering&&$('build-preview-layer').textContent!==layerCaption())$('build-preview-layer').textContent=layerCaption();
 }
 function drawBeauty(){
  const result=assessCastle(drafts[home],currentProfile());$('build-beauty-score').value=result.score;
  $('build-beauty-title').textContent=result.cosmeticRank+' castle';
  $('build-beauty-bars').replaceChildren(...result.categories.map(c=>{const el=document.createElement('div');el.className='beauty-category';el.innerHTML='<div><span></span><b></b></div><i><em></em></i>';el.querySelector('span').textContent=c.label;el.querySelector('b').textContent=c.score+' / '+c.max;el.querySelector('em').style.width=(c.score/c.max*100)+'%';el.title=c.detail;return el;}));
  $('build-beauty-tips').replaceChildren(...result.tips.slice(0,2).map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  $('build-beauty-bonuses').replaceChildren(...result.bonuses.map(b=>{const el=document.createElement('p');el.textContent=b.label+(b.value!==undefined?' · '+b.value:'');return el;}));
  return result;
 }
 // Simplified grid: the chosen layer, or in Auto layer the top piece of every column (a click builds on it).
 function drawGrid(){
  const d=drafts[home],p=currentProfile();makeGrid();const byCell=new Map(d.map(item=>[item.x+':'+item.z+':'+item.layer,item]));
  for(const b of cells){const x=Number(b.dataset.x),z=Number(b.dataset.z),item=autoLayer?top(x,z):byCell.get(x+':'+z+':'+layer),below=!autoLayer&&!item&&byCell.get(x+':'+z+':'+(layer-1)),part=partById.get((item||below)?.type);b.textContent=part?'':'·';b.dataset.icon=part?.id||'';b.classList.toggle('below',!!below);b.classList.toggle('occupied',!!item);b.style.setProperty('--part-color',part?.color||'#69848b');b.setAttribute('aria-label',`Plot ${x-p.minX+1}, ${z-p.minZ+1}, ${autoLayer?(item?'top layer '+(item.layer+1):'ground'):'layer '+(layer+1)}: ${item?part.label+'; rotation '+item.rotation*90+' degrees':'empty'}`);b.title=b.getAttribute('aria-label');b.dataset.rotation=item?.rotation??0;}
 }
 function draw(){
  invalidateRoutes();columns=null;
  const d=drafts[home],p=currentProfile();drawGrid();
  $('build-count').textContent=d.length+' / '+MAX_PARTS+' PARTS';$('build-count').classList.toggle('full',d.length>=MAX_PARTS);$('build-undo').disabled=!undos[home].length;
  $('build-draft-state').textContent=(home?'Dusk':'Dawn')+' castle · '+(JSON.stringify(d)===JSON.stringify(applied[home])&&JSON.stringify(draftOptions[home])===JSON.stringify(appliedOptions[home])?'Applied layout':'Unapplied draft');
  $('build-level').value=p.level;$('build-level-value').value=p.level;$('build-material').value=draftOptions[home].material;$('build-plot-size').textContent=p.size+' × '+p.size+' plots';$('build-dimensions').textContent=p.size+' × '+p.size+' plots · '+p.size*CELL+' m wide · 10 layers';
  $('build-material-progression').textContent='Timber at levels 1–10, rough stone 11–30, brick 31–60, fortress 61–100. Current finish: '+p.materialLabel+'. Every finish can be chosen at any level.';
  const count=Math.ceil(p.level/10);$('build-level-layers').replaceChildren(...Array.from({length:10},(_,i)=>{const bar=document.createElement('i');bar.classList.toggle('earned',i<count);return bar;}));$('build-layer-rule').textContent=count+' / 10 planned layers at level '+p.level;
  const cuts=d.filter(item=>!['stairs','core'].includes(item.type)&&d.some(s=>s.type==='stairs'&&s.x===item.x&&s.z===item.z&&s.layer===item.layer-1)).length;
  $('build-clearance').textContent=cuts?cuts+' stair opening'+(cuts===1?'':'s')+' carved automatically. Floors restore when their stairs are removed.':'Stairs open the floor directly above. Removing stairs restores the slab.';
  draftNetwork=null;applyReadiness();preview.setDraft(home,d,draftOptions[home]);drawTools();drawBeauty();
  const hints=structuralHints(d,draftOptions[home]);if(hints.length)$('build-route-summary').textContent='Before walking: '+hints[0].message+(hints[0].suggestion?' '+hints[0].suggestion:'');
 }
 // A refused level snaps the slider back on every input, but says why (red message, blip) once per drag or key press.
 let levelRefusal='';const refuseLevel=text=>{$('build-level').value=draftOptions[home].level;if(text!==levelRefusal){levelRefusal=text;reject({code:'level',text});}};
 for(const name of ['change','pointerup','pointercancel','touchend','keyup','blur'])$('build-level').addEventListener(name,()=>{levelRefusal='';});
 $('build-level').oninput=()=>{const next={...draftOptions[home],level:Number($('build-level').value)},p=profile(next);if(drafts[home].filter(item=>item.type==='protector').length>protectorLimit(p.level)){refuseLevel('Remove excess protector cores before lowering this castle level.');return;}if(drafts[home].some(item=>!containsCell(item,p))){refuseLevel('This draft needs at least the level '+minimumLevel(drafts[home])+' plot. Clear it or move its outer pieces before shrinking. Nothing was removed.');return;}remember();draftOptions[home]=next;status('Level '+p.level+' land: '+p.size+' × '+p.size+' plots. Ten layers and all parts remain unlocked.');draw();};
 $('build-material').onchange=()=>{remember();draftOptions[home]={...draftOptions[home],material:$('build-material').value};status('Material finish updated in your draft.');draw();};
 $('build-home').onchange=()=>{home=Number($('build-home').value);status('Editing '+(home?'Dusk':'Dawn')+'. Your other draft is kept.');draw();};
 $('build-layer').onchange=()=>{const value=$('build-layer').value;autoLayer=value==='auto';if(!autoLayer)layer=Number(value);draw();};
 panel.querySelectorAll('[data-build-preset]').forEach(b=>b.onclick=()=>{remember();drafts[home]=roomy(preset(b.dataset.buildPreset)).layout;activeTemplates[home]=null;resetLayer();status('Starter fitted to this plot. Apply when ready.');draw();});
 $('build-clear').onclick=()=>{remember();drafts[home]=[];activeTemplates[home]=null;status('Draft cleared. Place a Castle heart before applying. The map is unchanged.');draw();};
 $('build-undo').onclick=()=>{if(undos[home].length){const old=undos[home].pop();drafts[home]=old.layout;draftOptions[home]=old.options;activeTemplates[home]=old.template||null;status('Last draft change undone.');draw();}};
 function setBeauty(home){const value=assessCastle(applied[home]||[],profile(appliedOptions[home]||{level:20}));world.castles[home].userData.beauty=applied[home]?value:null;}
 for(let i=0;i<2;i++)setBeauty(i);
 // Focus goes back to Build castle. The explore header can stay hidden for a few frames while the camera glides back from
 // the Workshop vantage (body.shell-menu), and a hidden button cannot take focus: retry each frame until it shows, unless
 // focus has moved on to something other than the page or the world canvas.
 function returnFocus(){const button=document.getElementById('build');if(!button)return;let tries=0;const go=()=>{if(opened)return;const at=document.activeElement;if(at&&at!==document.body&&at!==button&&at.tagName!=='CANVAS')return;button.focus({preventScroll:true});if(document.activeElement!==button&&++tries<120)requestAnimationFrame(go);};go();}
 function close(){if(!opened)return;routeController?.abort();architectController?.abort();architectController=null;$('build-ai-generate').textContent='Design a castle';opened=false;preview.setActive(false);panel.hidden=true;closeView();returnFocus();}
 $('build-apply').onclick=()=>{try{construction.apply(home,drafts[home],draftOptions[home]);applied[home]=copyLayout(drafts[home]);appliedOptions[home]={...draftOptions[home]};setBeauty(home);const saved=save();onApply(home);close();report((home?'Dusk':'Dawn')+' castle updated. '+(saved?'Layout and plot saved in this browser.':'Storage unavailable; this layout lasts for this visit.'));}catch(error){reject(error.message);}};
 $('build-restore').onclick=()=>{construction.restore(home);applied[home]=appliedOptions[home]=null;draftOptions[home]=freshOptions();const design=construction.template('sanctuary',draftOptions[home]);drafts[home]=roomy(design.layout).layout;activeTemplates[home]=design;undos[home]=[];setBeauty(home);const saved=save();onApply(home);close();report((home?'Dusk':'Dawn')+' original castle restored.'+(saved?'':' Local storage is unavailable.'));};$('close-builder').onclick=close;
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}if(e.key==='Tab'){const focusable=[...panel.querySelectorAll('button:not(:disabled),select,input,summary,canvas[tabindex]')].filter(e=>e.tabIndex>=0&&e.getClientRects().length),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 let matchLayouts=false;
 function restoreMatch(){if(!matchLayouts)return;for(let i=0;i<2;i++){if(applied[i]!==null)construction.apply(i,applied[i],appliedOptions[i]);else construction.restore(i);setBeauty(i);}matchLayouts=false;}
 const lastMatchFamilies=[null,null];
 async function prepareMatch({friendly='saved',level=100,seed=0,timestamp=null,signal,onProgress}={}){
  restoreMatch();const plans=[null,null];matchLayouts=true;
  try{for(let i=0;i<2;i++){if(i===0&&friendly==='saved'){plans[i]={name:applied[0]!==null?'Your saved Dawn castle':'Your original Dawn castle',source:'saved',level:appliedOptions[0]?.level||20};continue;}const plan=await verifiedBattleCastlePlan({level,seed,timestamp,home:i,construction,signal,onProgress,avoidFamilies:[lastMatchFamilies[i],i===1?plans[0]?.family:null].filter(Boolean)});lastMatchFamilies[i]=plan.family;construction.apply(i,plan.layout,plan.options);world.castles[i].userData.beauty=assessCastle(plan.layout,plan.options);plans[i]={name:plan.name,source:'ai',family:plan.family,goal:plan.goal,seed:plan.seed,timestamp:plan.timestamp,anchors:plan.anchors,level,parts:plan.layout.length,protectors:plan.protectors,composition:plan.composition,network:plan.network,navigation:plan.navigation,rejected:plan.attempts.filter(a=>!a.ok)};}return plans;}catch(e){restoreMatch();throw e;}
 }
 draw();return {construction,preview,prepareMatch,restoreMatch,get savedBattleCastle(){return {custom:applied[0]!==null,level:appliedOptions[0]?.level||20};},open({templates=false,template=null}={}){if(opened)return;opened=true;openView();panel.hidden=false;draw();$('close-builder').focus();if(['rampart','sanctuary','skyharbor'].includes(template))loadTemplate(template,100);else if(templates)showLibrary(true);if(panel.dataset.editorView==='simple')centreGrid();preview.setActive(true);},close,get isOpen(){return opened;},get diagnostics(){return lastRouteReport;},get architectResult(){return lastArchitect;},get feedback(){return {...feedback,last:feedback.last&&{...feedback.last},autoLayer,audio:sfx.context?.state||null,aimed:aimed&&{...aimed},placed:placed&&{...placed}};},get draft(){return {home,layout:copyLayout(drafts[home]),options:{...draftOptions[home]},beauty:assessCastle(drafts[home],currentProfile())};}};
}
