// Compact contextual battle HUD for desktop and touch (a battle.use() extension).
// It re-parents the controls battle.js and main.js already create (by id, never re-created or removed) into five
// fixed roots: #hud-top strip, #hud-hotbar, #hud-player, #hud-actions and the touch FIRE button. Context chips are
// shown or hidden with the `hidden` attribute; every DOM write is write-if-changed. Layout lives in battle.css.
import {allowedWeapon as professionAllowed,CLASSES as PROFESSION_CLASSES,WARD} from './battle-professions.js?v=aerie-20261018';
const OBSTACLES='#hud-top,#hud-hotbar,#hud-player,#hud-actions,#battle-radar,#battle-fire,#pad,#battle-evacuation,#battle-board,#combat-feedback,.in-battle .compass,#battle-objective,#announce-banner';
const SHORT=['T1','T2','T3','T4','C'],CHIPS=['vehicle','pod','restock','gate','fleet','chariot','repair','ward','build'];
export function createBattleHud(){
 const $=id=>document.getElementById(id),moved=[],cache=new Map(),labelBoxes=new WeakMap(),near=new Set();
 let ctx=null,built=false,roots=null,lastChips=-1,lastTitles=-1,lastObstacles=-1,obstacleRects=[],messageText=null,freshUntil=0,boardOpen=null,borrowed=false,compact=null,coarse=null,msgSeq=0,seenSeq=0,lastWrite=-1e9,weaponKey='',flashUntil=0,scoreOpen=null,lastScore=-1,rosterKey='',orderKey='';const kept=[],rows=new Map(),cds={},fallback={ward:0,wardSec:0,restock:0,restockSec:0,reload:0,reloadSec:0,hammer:-1};
 const tmp={x:0,y:0,z:0};
 // Write-if-changed helpers keyed per element/attribute.
 function prop(el,key,value){if(!el)return;const map=cache.get(el)||(cache.set(el,{}),cache.get(el));if(map[key]===value)return;map[key]=value;if(key==='text')el.textContent=value;else if(key==='hidden')el.hidden=value;else if(key==='title')el.title=value;else if(key.startsWith('data-'))el.setAttribute(key,value);else if(key.startsWith('class:'))el.classList.toggle(key.slice(6),!!value);else el.style.setProperty(key,value);}
 const show=(el,on)=>prop(el,'hidden',!on);
 function make(tag,id,cls,html=''){const el=document.createElement(tag);if(id)el.id=id;if(cls)el.className=cls;if(html)el.innerHTML=html;return el;}
 // Re-parenting that can be undone: remember the original parent and next sibling.
 function move(el,parent,before=null,list=moved){if(!el||!parent||el.parentNode===parent&&(!before||el.nextSibling===before))return;list.push({el,parent:el.parentNode,next:el.nextSibling});parent.insertBefore(el,before);}
 const keep=(el,parent,before=null)=>move(el,parent,before,kept),place=(el,parent)=>{if(el&&parent&&el.parentNode!==parent)parent.append(el);};
 function restore(){for(let i=moved.length-1;i>=0;i--){const {el,parent,next}=moved[i];if(!parent)continue;try{parent.insertBefore(el,next&&next.parentNode===parent?next:null);}catch{parent.appendChild(el);}}moved.length=0;}
 function relabel(button,key,name){if(!button||button.dataset.hudSlot)return;button.dataset.hudSlot='1';button.innerHTML='<b class="slot-key"></b><span class="slot-sep"> </span><span class="slot-name"></span>';button.querySelector('.slot-key').textContent=key;button.querySelector('.slot-name').textContent=name;button.title=name+' · '+key;button.setAttribute('aria-label',name+' (key '+key+')');}
 function build(){
  if(built)return;built=true;
  const top=make('div','hud-top','hud-root','<div class="hud-slot hud-left"></div><div class="hud-slot hud-centre"></div><div class="hud-slot hud-right"></div>');
  const hotbar=make('div','hud-hotbar','hud-root','<div class="hud-hotbar-caption"><span id="hud-weapon-name"></span></div><div class="hud-hotbar-row"><div id="hud-sword" class="hud-slot-static" hidden><b class="slot-key">LMB</b><span class="slot-name">Sword</span></div><div id="hud-mount" class="hud-slot-static hud-mount" hidden><b class="slot-key">F</b><span class="slot-name"></span></div></div>');
  const player=make('div','hud-player','hud-root','<div class="hud-player-head"><b id="hud-class" class="hud-class"></b></div>');
  const actions=make('div','hud-actions','hud-root');
  const chip=(name,label)=>{const c=make('div','','hud-chip');c.dataset.chip=name;c.hidden=true;if(label)c.setAttribute('aria-label',label);actions.append(c);return c;};
  const chips={vehicle:chip('vehicle','Vehicle controls'),pod:chip('pod','Pod launch'),restock:chip('restock'),gate:chip('gate'),fleet:chip('fleet'),chariot:chip('chariot'),repair:chip('repair'),ward:chip('ward'),build:chip('build','Field building')};
  const mapButton=make('button','hud-map','hud-icon','<b class="slot-key">M</b><span>Map</span>');mapButton.type='button';mapButton.title='Tactical map · M';mapButton.onclick=()=>{try{ctx?.spawnMap?.toggle();}catch{}};
  const destCycle=make('button','hud-dest-cycle','hud-cycle');destCycle.type='button';destCycle.title='Change pod destination';
  const planCycle=make('button','hud-plan-cycle','hud-cycle');planCycle.type='button';planCycle.title='Change field plan';
  const cycle=(select,skip)=>{if(!select||!select.options.length)return;let i=select.selectedIndex;for(let n=0;n<select.options.length;n++){i=(i+1)%select.options.length;if(!skip||!skip(select.options[i].value))break;}select.selectedIndex=i;select.dispatchEvent(new Event('change',{bubbles:true}));lastChips=-1;};
  destCycle.onclick=()=>cycle($('destination'),v=>{const n=ctx?.physics?.nearPad?.();return n>=0&&Number(v)===n;});planCycle.onclick=()=>cycle($('field-plan'));
  for(const b of [mapButton,destCycle,planCycle])b.addEventListener('click',e=>{if(e.detail>0)$('world')?.focus?.({preventScroll:true});});
  // Scoreboard overlay (body.scoreboard-open: K, or the Score button in the strip). Rows are built once per roster.
  const board=make('div','hud-scoreboard','hud-root','<div class="sb-frame"><div class="sb-head"><h2>Scoreboard</h2><button type="button" class="sb-close"><b class="slot-key">K</b> Close</button></div><div class="sb-teams"></div></div>');board.setAttribute('role','dialog');board.setAttribute('aria-label','Scoreboard');
  const scoreButton=make('button','hud-score','hud-icon','<b class="slot-key">K</b><span>Score</span>');scoreButton.type='button';scoreButton.title='Scoreboard · K';scoreButton.setAttribute('aria-label','Scoreboard (K)');
  const toggleScore=e=>{document.body.classList.toggle('scoreboard-open');if(e?.detail>0)$('world')?.focus?.({preventScroll:true});};scoreButton.onclick=toggleScore;board.querySelector('.sb-close').onclick=toggleScore;
  document.body.append(top,hotbar,player,actions,board);
  roots={top,hotbar,player,actions,chips,mapButton,board,scoreButton,teams:board.querySelector('.sb-teams'),status:null,destCycle,planCycle,left:top.querySelector('.hud-left'),centre:top.querySelector('.hud-centre'),right:top.querySelector('.hud-right'),row:hotbar.querySelector('.hud-hotbar-row'),caption:hotbar.querySelector('#hud-weapon-name'),sword:hotbar.querySelector('#hud-sword'),mount:hotbar.querySelector('#hud-mount'),mountName:hotbar.querySelector('#hud-mount .slot-name'),cls:player.querySelector('#hud-class'),ammo:null};
  // Battle-only nodes move once; they live only in battle UI.
  const hud=ctx.dom?.hud||$('battle-hud');keep(hud,roots.centre);
  keep($('battle-evacuation'),document.body);
  keep(hud?.querySelector('.battle-player'),player);keep($('profession-status'),player);roots.status=make('div','hud-status','hud-status');player.append(roots.status);
  keep($('battle-cadence'),hotbar,hotbar.firstChild);keep($('battle-weapons'),roots.row,roots.sword);keep($('battle-reload'),roots.row);
  const fire=$('battle-fire');if(fire){keep(fire,document.body);roots.ammo=make('span','hud-fire-ammo','hud-fire-ammo');fire.append(roots.ammo);let held=null;fire.addEventListener('pointerdown',e=>{held=e.pointerId;fire.dataset.held='';});for(const t of ['pointerup','pointercancel','lostpointercapture'])fire.addEventListener(t,e=>{if(held===e.pointerId||t==='lostpointercapture'){held=null;delete fire.dataset.held;}});}
  for(const [i,b] of [...($('battle-weapons')?.children||[])].entries()){const w=ctx.WEAPONS?.[i];relabel(b,String(i+1),w?.name||b.textContent.replace(/^\d+\s*/,''));}
  relabel($('battle-reload'),'T','Reload');
  // Static chip labels get a key badge; touch tiles show an icon plus a short word (data-short).
  for(const [id,key,name,short] of [['battle-restock','V',null,'Restock'],['battle-ward','H',null,'Ward'],['battle-build','J',null,'Build'],['chariot-enter','R',null,'Chariot'],['fleet-enter','F',null,'Board'],['fleet-seat','G',null,'Seat'],['battle-gate',null,null,'Gate'],['battle-repair',null,null,'Repair'],['fleet-up','R','Rise','Rise'],['fleet-down','C','Lower','Lower'],['launch',null,null,'Launch']]){const b=$(id);if(!b)continue;b.dataset.short=short;if(key){const text=b.textContent,i=text.indexOf(' · ');if(text.startsWith(key)&&i>0)relabel(b,key,name||text.slice(i+3));}}
  // Cooldown overlay (contract 2): a stepped shade for what is left plus the seconds, on the ward/restock/hammer chips and the
  // reload slot. One <i> per button, created once; the touch tile rules leave it visible next to the icon and the short word.
  for(const id of ['battle-ward','battle-restock','battle-build','battle-reload']){const b=$(id);if(!b)continue;let i=b.querySelector('.hud-cd');if(!i){i=make('i','','hud-cd');i.hidden=true;i.setAttribute('aria-hidden','true');b.append(i);}cds[id]=i;}
  keep($('battle-sound'),roots.right);roots.right.append(scoreButton,mapButton);
  keep($('battle-restock'),chips.restock);keep($('battle-gate'),chips.gate);keep($('fleet-enter'),chips.fleet);keep($('chariot-enter'),chips.chariot);keep($('battle-repair'),chips.repair);keep($('battle-ward'),chips.ward);chips.build.append(planCycle);keep($('battle-build'),chips.build);
  // Pip ids for the five silo cards; full status goes to the title attribute.
  for(const [i,el] of [...($('battle-towers')?.children||[])].entries())if(!el.querySelector('.pip-id')){const id=make('i','','pip-id');id.textContent=SHORT[i]||String(i+1);id.setAttribute('aria-hidden','true');el.prepend(id);}
  // Every write to #message re-arms the toast, including a repeat of the same text (a burst of per-frame writes does not).
  const m=$('message');if(m&&typeof MutationObserver==='function')new MutationObserver(()=>{msgSeq++;}).observe(m,{childList:true,characterData:true,subtree:true});
  // A wrapped phone hotbar (Reload on a second row) frees the left of its top row: the weapon-name flash goes there, not over the chips.
  if(typeof ResizeObserver==='function')new ResizeObserver(e=>{const h=e[e.length-1].contentRect.height;prop(roots.hotbar,'data-wrapped',h>60?'1':'0');}).observe(roots.row);
  compact=matchMedia('(max-width:560px),(max-height:500px)');coarse=matchMedia('(pointer:coarse)');addEventListener('resize',()=>{lastObstacles=-1;});
 }
 // main.js/header nodes are shared with exploration: borrow them only while a match is shown.
 function borrow(){
  if(!roots)return;document.body.classList.add('hud-on');move($('battle-toggle'),roots.left);const ov=$('overview');if(ov)move(ov,roots.right,roots.right.firstChild);move($('pause'),roots.right);
  move($('launch'),roots.chips.pod);roots.chips.pod.prepend(roots.destCycle);move($('destination'),roots.chips.pod);
  const v=roots.chips.vehicle;for(const id of ['fleet-status','fleet-seat','fleet-up','fleet-down'])move($(id),v);
 }
 function now(){return performance.now();}
 function human(){try{return ctx?.human||ctx?.actors?.[0]||null;}catch{return null;}}
 function allowed(a,i){try{return (ctx?.allowedWeapon||professionAllowed)(a,i);}catch{return true;}}
 function dist(a,p){return Math.hypot(p.x-a.state.x,p.y-a.state.y,p.z-a.state.z);}
 function worldPos(o){const e=o?.matrixWorld?.elements;if(e){tmp.x=e[12];tmp.y=e[13];tmp.z=e[14];}else if(o?.position){tmp.x=o.position.x;tmp.y=o.position.y;tmp.z=o.position.z;}else return null;return tmp;}
 // Fallbacks keep the chips working before the FX/flow packages add their helpers.
 function chariotNear(a){const c=ctx.chariots;if(!c)return false;if(typeof c.nearestBoardable==='function')return !!c.nearestBoardable(a,14);if(!a.alive||a.mount)return false;for(const v of c.vehicles||[])if(v.team===a.team&&v.hp>0&&v.root?.visible!==false&&!v.seats?.[0]?.actor&&v.root&&dist(a,v.root.position)<14)return true;return false;}
 function fleetNear(a){const f=ctx.fleet;if(!f)return false;if(a.mount)return true;if(typeof f.nearestInteraction==='function')return !!f.nearestInteraction(a);if(!a.alive)return false;for(const s of f.ships||[])if(s.team===a.team&&s.hp>0&&s.root&&dist(a,s.root.position)<16)return true;for(const w of f.mounts||[]){if(w.ship||w.team!==a.team||w.hp<=0||w.operator?.human)continue;const p=worldPos(w.root);if(p&&dist(a,p)<8)return true;}return false;}
 function repairNear(a){const f=ctx.fleet;for(const w of f?.mounts||[]){if(w.ship||w.team!==a.team||!(w.hp<w.maxHp))continue;const p=worldPos(w.root);if(p&&dist(a,p)<4)return true;}return false;}
 function nearPad(){try{const n=ctx.physics?.nearPad?.();return typeof n==='number'?n:-1;}catch{return -1;}}
 function chips(a){
  const c=roots.chips,alive=!!a?.alive,live=alive&&ctx.playing!==false&&ctx.phase!=='finished',mounted=!!a?.mount;
  near.clear();
  if(live&&mounted){near.add('vehicle');}
  else if(live){
   const flight=!!ctx.physics?.state?.flight,cls=a.classId==='mage'?'ward':a.classId==='builder'?'build':null,list=[];
   if(nearPad()>=0||flight)list.push('pod');
   try{if(ctx.logistics?.nearSupply?.(a))list.push('restock');}catch{}
   try{if(ctx.gates?.nearest?.(a))list.push('gate');}catch{}
   try{if(fleetNear(a))list.push('fleet');}catch{}
   try{if(chariotNear(a))list.push('chariot');}catch{}
   try{if(/stop/i.test($('battle-repair')?.textContent||'')||repairNear(a))list.push('repair');}catch{}
   // The class chip takes a place, but never the one beside the pod pair: on the spawn pad Chariot (or Restock) stays in reach.
   const cap=Math.max((compact?.matches?2:3)-(cls?1:0),list[0]==='pod'?2:1);for(const k of list.slice(0,cap))near.add(k);if(cls)near.add(cls);
  }
  for(const k of CHIPS)show(c[k],near.has(k));
  if(near.has('vehicle')){const ship=!!a.mount?.ship,chariot=!!a.mount?.chariot;show($('fleet-seat'),ship);show($('fleet-up'),ship||chariot);show($('fleet-down'),ship||chariot);place($('fleet-enter'),c.vehicle);}
  else place($('fleet-enter'),c.fleet);
  let fleetLabel=mounted?'Leave':'Enter / Exit',fleetShort=mounted?'Exit':'Board';if(!mounted&&near.has('fleet')){let n=null;try{n=ctx.fleet?.nearestInteraction?.(a);}catch{}const l=n?.label?String(n.label).replace(/^F\s*·\s*/,''):'';if(l){fleetLabel=l;fleetShort=n.kind==='mount'?'Operate':'Board';}}
  const fe=$('fleet-enter'),fn=fe?.querySelector('.slot-name');if(fn){prop(fn,'text',fleetLabel);prop(fe,'title',fleetLabel+' · F');}
  if(near.has('pod')){const d=$('destination'),o=d?.options[d.selectedIndex];prop(roots.destCycle,'text',o?'To '+destLabel(o.text):'Destination');prop(roots.destCycle,'title',o?'Change pod destination · '+o.text:'Change pod destination');prop(roots.destCycle,'data-short',o?destShort(o.text):'Pad');prop($('launch'),'data-short',ctx.physics?.state?.flight?'Flying':'Launch');}
  if(near.has('build')){const p=$('field-plan'),o=p?.options[p.selectedIndex];prop(roots.planCycle,'text',o?o.text.split(' · ')[0].replace(/^(Small|Temporary) /,''):'Plan');prop(roots.planCycle,'data-short',o?.value==='trebuchet'?'Treb':'Supply');}
  // Repair mode is lit (gold) while it runs; it ends on its own when nothing is left to repair (battle.js repairStep).
  {const on=/stop/i.test($('battle-repair')?.textContent||'');prop($('battle-repair'),'class:active',on);if(near.has('repair'))prop($('battle-repair'),'data-short',on?'Stop':'Repair');}
  prop($('fleet-enter'),'data-short',fleetShort);
  prop(roots.actions,'data-count',String(near.size));
 }
 function weaponsVisible(w){if(!w)return false;for(const b of w.children)if(!b.hidden)return true;return false;}
 function hotbar(a,dt){
  const weapons=$('battle-weapons'),mounted=!!a.mount,gun=mounted&&!a.mount.chariot,fighter=a.classId==='fighter';
  if(weapons)for(const b of weapons.children)show(b,!gun&&allowed(a,Number(b.dataset.weapon)));
  show(roots.sword,fighter&&!gun);
  show($('battle-reload'),!(fighter&&!gun&&!(weaponsVisible(weapons))));
  let mountName='';if(mounted){if(a.mount.chariot)mountName='Flying chariot';else{let v=null;try{v=ctx.fleet?.weaponView?.(a);}catch{}mountName=v?.weapon?.name||(a.mount.ship?'Ship gun':'Mounted battery');}}
  show(roots.mount,mounted);prop(roots.mountName,'text',mountName);prop(roots.hotbar,'data-mount',mounted?(a.mount.chariot?'chariot':'gun'):'none');
  const w=gun?null:ctx.WEAPONS?.[a.weapon];prop(roots.caption,'text',gun?mountName:fighter?'Sword':w?.name||'');
  let text='',full=true;try{if(fighter&&!gun)text='SWORD';else{const view=gun?ctx.fleet?.weaponView?.(a):null,ammo=ctx.combat?.ammo?.(view?.actor||a);if(ammo){text=ammo.reloadIn>0?'RELOAD':ammo.ammo+'/'+ammo.capacity;full=!(ammo.reloadIn>0)&&ammo.ammo>=ammo.capacity;}}}catch{}
  const key=(gun?'m:'+mountName:fighter?'sword':String(a.weapon));if(key!==weaponKey){if(weaponKey&&a.alive)flashUntil=now()+1200;weaponKey=key;}prop(roots.hotbar,'class:flash',now()<flashUntil);
  if(roots.ammo)prop(roots.ammo,'text',text);if(full!==roots.full){roots.full=full;roots.hotbar.toggleAttribute('data-full',full);}
 }
 // Ammo you carry in all: the pocket plus every loaded magazine (a magazine being reloaded counts its refill). Choosing a weapon the
 // first time loads its magazine from the pocket, so the pocket alone read as lost ammo; this total only falls when you fire. The
 // pocket is read live (the status text can lag a frame behind a magazine that was just filled).
 function carried(a,pocket){let n=pocket;const mags=a.magazines;if(mags)for(const k in mags){const m=mags[k];n+=Math.max(0,Math.floor(m?.until?(m.pending||0):(m?.ammo||0)));}return n;}
 function player(a){const cls=(ctx.CLASSES||PROFESSION_CLASSES)?.[a.classId]?.label||'Ranger';prop(roots.cls,'text',cls);prop(roots.player,'data-class',a.classId||'ranger');prop(roots.player,'data-team',String(a.team??0));prop(roots.player,'class:down',!a.alive);
  if(roots.status){const src=$('profession-status')?.textContent||'',parts=[];for(const part of src.split(' · ')){const p=part.trim();if(!p||/^HP\s/i.test(p)||p.toLowerCase()===cls.toLowerCase())continue;
   // Builder jobs read as the build in progress ('Building hub 45%'), never as a second 'Supply' beside the Supplies stock.
   const pk=/^POCKET (\d+)$/i.exec(p),job=/^(SUPPLY|TREBUCHET) (\d+%)$/i.exec(p);if(pk){parts.push('Ammo carried '+carried(a,Number.isFinite(a.reserveAmmo)?Math.floor(a.reserveAmmo):+pk[1]));continue;}if(job){parts.push((/^S/i.test(job[1])?'Building hub ':'Building trebuchet ')+job[2]);continue;}
   parts.push(p.charAt(0)+p.slice(1).toLowerCase());}prop(roots.status,'text',parts.join(' · '));}}
 // Touch tile word for a pod destination: 'T2', 'Arena W', 'Dawn' / 'Dusk' (never the ambiguous last word).
 // Desktop chip words: 'T1 · NW' for a silo landing (the full name is in the title), otherwise the option text ('Arena west').
 function destLabel(t){const m=/^(T\d) · ([A-Z]+)/.exec(t);return m?m[1]+' · '+m[2].replace(/NORTH|SOUTH|EAST|WEST/g,w=>w[0]):t;}
 function destShort(t){const m=/^(T\d|C)\b/.exec(t);if(m)return m[1];const w=t.split(' ');return w[0]==='Arena'&&w[1]?'Arena '+w[1][0].toUpperCase():w[0];}
 // Cooldowns from battle.js (ctx.cooldowns(), one reused object); the same shape from actor fields when it is missing. The ward
 // fraction is the larger of ward time and missing mana, so it only falls and reaches 0 together with wardSec.
 function cooldowns(a){let c=null;try{c=ctx.cooldowns?.();}catch{}if(c)return c;const f=fallback,t=ctx.combat?.state?.time||0;f.ward=f.wardSec=f.restock=f.restockSec=f.reload=f.reloadSec=0;f.hammer=-1;
  if(a.classId==='mage'){const spell=Math.max(0,(a.spellUntil||0)-t),low=Math.max(0,WARD.mana-(a.mana||0));f.wardSec=Math.max(spell,low/WARD.regen);f.ward=Math.min(1,Math.max(spell/WARD.seconds,low/WARD.mana));}
  f.restockSec=Math.max(0,(a.restockAt||0)-t);f.restock=Math.min(1,f.restockSec/3);
  if(!a.mount){const w=ctx.WEAPONS?.[a.weapon],m=w&&a.magazines?.[w.id];if(m&&m.until>t){f.reloadSec=m.until-t;f.reload=Math.min(1,f.reloadSec/(w.reload||2.5));}}
  if(a.classId==='builder')for(const j of ctx.logistics?.jobs||[])if(j.actor===a){f.hammer=Math.min(1,(j.progress||0)/9);break;}return f;}
 // Shade fraction in 16 steps (pixel look; the custom property is rewritten at most 16 times per cooldown), seconds as text.
 function cdPaint(id,on,f,text,kind){const i=cds[id];if(!i)return;show(i,on);prop(i.parentNode,'class:cooling',on);if(!on)return;prop(i,'--cd',String(Math.ceil(Math.max(0,Math.min(1,f))*16)/16));prop(i,'data-cd',text);prop(i,'data-kind',kind);}
 const secs=s=>s>0?Math.ceil(s)+'s':'';
 // The ward badge takes the mana colour whenever mana is the longer wait, so it keeps one colour through a cooldown.
 function cooling(a){const c=cooldowns(a),mage=a.classId==='mage',t=ctx.combat?.state?.time||0,low=Math.max(0,WARD.mana-(a.mana||0));
  cdPaint('battle-ward',mage&&c.wardSec>0,c.ward,secs(c.wardSec),mage&&low>0&&low/WARD.regen>=(a.spellUntil||0)-t?'mana':'wait');
  cdPaint('battle-restock',c.restockSec>0,c.restock,secs(c.restockSec),'wait');
  cdPaint('battle-reload',c.reloadSec>0,c.reload,secs(c.reloadSec),'wait');
  cdPaint('battle-build',c.hammer>=0,1-c.hammer,coarse?.matches?Math.floor(c.hammer*100)+'%':'','build');}
 function titles(){
  for(const el of $('battle-towers')?.children||[]){const name=el.querySelector('b')?.textContent||'',owner=el.querySelector('span')?.textContent||'',charge=el.querySelector('.tower-charge-label small')?.textContent||'';prop(el,'title',name+' · '+owner+' · CHARGE '+charge);}
 }
 // Scoreboard: one table per team (name, class, K/D, captures, score), sorted by score; the viewer's row is highlighted.
 function scoreboard(){
  const list=ctx.actors||[],me=human(),key=list.map(a=>a.id+':'+a.team).join(',');
  if(key!==rosterKey){rosterKey=key;orderKey='';rows.clear();roots.teams.replaceChildren();
   for(const team of [0,1]){const sec=make('section','','sb-team');sec.dataset.team=String(team);const name=(ctx.teamNames?.[team]||(team?'DUSK':'DAWN'));sec.innerHTML='<h3><span></span><small></small></h3><table><thead><tr><th scope="col">Name</th><th scope="col">Class</th><th scope="col">K / D</th><th scope="col">Caps</th><th scope="col">Score</th></tr></thead><tbody></tbody></table>';sec.querySelector('h3 span').textContent=name.charAt(0)+name.slice(1).toLowerCase();roots.teams.append(sec);
    for(const a of list){if(a.team!==team)continue;const tr=document.createElement('tr');tr.innerHTML='<td></td><td></td><td></td><td></td><td></td>';rows.set(a.id,{tr,cells:[...tr.children],body:sec.querySelector('tbody'),a});}}}
  const v=me?.team??0;for(const sec of roots.teams.children){const t=Number(sec.dataset.team);prop(sec.querySelector('small'),'text',t===v?'Allies':'Enemies');prop(sec,'class:mine',t===v);}
  for(const r of rows.values()){const a=r.a,c=r.cells;const nm=a.name||'Bot '+a.id;prop(c[0],'text',a.human&&!/^you$/i.test(nm)?'You · '+nm:nm);prop(c[1],'text',(ctx.CLASSES||PROFESSION_CLASSES)?.[a.classId]?.label||'Ranger');prop(c[2],'text',(a.kills|0)+' / '+(a.deaths|0));prop(c[3],'text',String(a.captures|0));prop(c[4],'text',String(Math.round(a.score||0)));prop(r.tr,'class:you',!!a.human);prop(r.tr,'class:down',!a.alive);}
  const sorted=[...rows.values()].sort((p,q)=>(q.a.score||0)-(p.a.score||0)||p.a.id-q.a.id),order=sorted.map(r=>r.a.id).join(',');if(order!==orderKey){orderKey=order;for(const r of sorted)r.body.append(r.tr);}
 }
 function refreshObstacles(){
  lastObstacles=now();obstacleRects=[];for(const el of document.querySelectorAll(OBSTACLES)){if(el.hidden||!el.getClientRects().length)continue;const r=el.getBoundingClientRect();if(r.width>0&&r.height>0)obstacleRects.push(r);}
 }
 function toast(t){
  const m=$('message');if(!m)return;const text=m.textContent;
  if(msgSeq!==seenSeq||text!==messageText){const again=text===messageText&&msgSeq!==seenSeq&&t-lastWrite>400;seenSeq=msgSeq;if(msgSeq)lastWrite=t;if(text!==messageText||again){messageText=text;if(text){freshUntil=t+4000;prop(m,'class:fresh',true);}else prop(m,'class:fresh',false);}}
  if(freshUntil&&t>freshUntil){freshUntil=0;prop(m,'class:fresh',false);}
 }
 return {
  name:'battle-hud',
  attach(c){ctx=c;build();},
  started(c){ctx=c||ctx;build();borrow();borrowed=true;lastChips=lastTitles=-1;messageText=null;freshUntil=0;prop($('message'),'class:fresh',false);document.body.classList.add('hud-on');refreshObstacles();},
  reset(){lastChips=lastTitles=-1;freshUntil=0;},
  stopped(){borrowed=false;restore();rosterKey='';document.body.classList.remove('scoreboard-open');lastObstacles=-1;obstacleRects=[];document.body.classList.remove('hud-on','hud-evacuating');const m=$('message');if(m)m.classList.remove('fresh');cache.delete(m);cache.delete(document.body);if(roots)for(const el of Object.values(roots.chips))prop(el,'hidden',true);const rl=$('battle-reload');if(rl){rl.hidden=false;cache.delete(rl);}for(const i of Object.values(cds)){prop(i,'hidden',true);prop(i.parentNode,'class:cooling',false);}},
  render(dt,c){
   if(c)ctx=c;if(!roots)return;const a=human();if(!a)return;const t=now();
   if(!borrowed&&ctx.phase!=='idle'){borrow();borrowed=true;}
   toast(t);prop(document.body,'class:hud-evacuating',ctx.phase==='evacuation');
   // board.open (Shift+K, Inspect bot decisions, the summary) is the single source of truth; body.board-open only mirrors it.
   const boardWanted=document.body.classList.contains('board-open');if(boardWanted!==boardOpen){boardOpen=boardWanted;lastObstacles=-1;}
   if(t-lastObstacles>500)refreshObstacles();
   if(t-lastChips>=100){lastChips=t;chips(a);hotbar(a,dt);player(a);cooling(a);}
   if(t-lastTitles>=250){lastTitles=t;titles();}
   const open=document.body.classList.contains('scoreboard-open');if(open!==scoreOpen){scoreOpen=open;prop(roots.scoreButton,'data-on',String(open));roots.scoreButton.setAttribute('aria-pressed',String(open));lastScore=-1;}
   if(open&&t-lastScore>=250){lastScore=t;scoreboard();}
  },
  // A torn-down match always emits 'stop' (also on a cancelled restart or rematch): hand the borrowed header/pod nodes back.
  event(e){if(e?.type==='stop'&&borrowed){borrowed=false;restore();if(roots)for(const el of Object.values(roots.chips))prop(el,'hidden',true);}},
  // Service-marker placement hook (battle.js calls exts.find(x=>x.layoutLabel)). The span is bottom-centred.
  layoutLabel(el,x,y){
   if(!el||!Number.isFinite(x)||!Number.isFinite(y))return false;const text=el.textContent;let box=labelBoxes.get(el);
   if(!box||box.text!==text||!box.real&&now()-box.at>500){const w=el.offsetWidth,h=el.offsetHeight;box=w&&h?{text,w,h,real:true,at:0}:{text,w:text.length*6+16,h:18,real:false,at:now()};labelBoxes.set(el,box);}
   const left=x-box.w/2,right=x+box.w/2,top=y-box.h,bottom=y;if(left<0||top<0||right>innerWidth||bottom>innerHeight)return false;
   for(const r of obstacleRects)if(left<r.right&&right>r.left&&top<r.bottom&&bottom>r.top)return false;
   prop(el,'left',Math.round(x)+'px');prop(el,'top',Math.round(y)+'px');return true;
  },
  obstacles(){if(lastObstacles<0)refreshObstacles();return obstacleRects;}
 };
}
