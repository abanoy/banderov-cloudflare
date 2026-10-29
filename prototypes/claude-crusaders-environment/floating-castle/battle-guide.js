// Battle guide (a battle.use() extension; contract C3, loaded by main.js as ./battle-guide.js?v=aerie-20261018 with battle-guide.css?v=aerie-20261018):
// capture meter near the objective lane, one screen-edge waypoint to the next useful objective, a team-colour ground ring under
// your fighter, a pixel hit-marker on the reticle and one-at-a-time first-match tips (progress in localStorage TIP_KEY).
// Import-safe in Node: nothing touches window/document/localStorage until attach(). Timers run on effectDt, so the guide freezes
// while paused; the overlays hide while the pause menu, settings, scoreboard, spawn map, setup or results are open.
// Per frame it reads pooled state only; DOM is written when a shown value changes, and HUD boxes are re-measured at most every
// 0.4 s (sooner when the objective line, banner, toast or evacuation box changes) so the guide never sits on top of the HUD.
const TIP_KEY='crusaders-aerie-tips-v1',SHORT=['T1','T2','T3','T4','Crown'],REFRESH=400;
export const GUIDE_TIPS=Object.freeze(['move','fire','capture','strike','protectors','core','escape']);
const OBSTACLES='#hud-top,#hud-hotbar,#hud-player,#hud-actions,#battle-radar,.in-battle .compass,#pad,#battle-fire,#battle-objective,#announce-banner,#message,#battle-evacuation,#combat-feedback,#combat-score,#juice-respawn,#battle-board';
const STACK=new Set(['battle-objective','announce-banner','message','battle-evacuation']),WATCH=['battle-objective','announce-banner','message','battle-evacuation','juice-respawn'];
const CAP_STATES=['','capturing','neutralising','contested','held','arming','armed','hint','blocked'];
const nice=s=>{s=String(s||'');return s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();};
const P3={x:0,y:0,z:0};let labelsFor=null,LABELS=null;
// Target labels are built once per team-name table, so picking a target every frame allocates no strings.
function labels(ctx){const t=ctx?.teamNames||null;if(LABELS&&labelsFor===t)return LABELS;labelsFor=t;const n=[nice(t?.[0]||'Dawn'),nice(t?.[1]||'Dusk')];
 LABELS={team:n,shield:n.map(x=>x+' shield'),core:n.map(x=>x+' core'),defend:SHORT.map(x=>'Defend '+x)};return LABELS;}

function heart(ctx,team,out){const e=ctx.world?.castleHearts?.[team]?.core?.matrixWorld?.elements;if(!e)return false;out.x=e[12];out.y=e[13];out.z=e[14];return true;}
function actorById(list,id){if(list)for(let i=0;i<list.length;i++)if(list[i].id===id)return list[i];return null;}
function setTarget(out,kind,id,label,x,y,z,top,radius,s){out.kind=kind;out.id=id;out.label=label;out.x=x;out.y=y;out.z=z;out.top=top;out.radius=radius;out.dist=Math.hypot(x-s.x,y-s.y,z-s.z);return out;}
export function insideBlast(st,x,z){const zones=st?.blastZones,doomed=st?.doomedTeams;if(!zones||!doomed)return false;for(const zn of zones)if(doomed.includes(zn.team)&&Math.hypot(x-zn.x,z-zn.z)<=zn.radius)return true;return false;}
// Next useful objective for the local player: escape pad while evacuating inside a blast zone; with the enemy shield up the nearest
// silo we do not hold (or one of ours under attack), then the enemy shield once every silo is ours; with it down the nearest live
// enemy protector, then the enemy core. Returns `out` (kind/id/label/x/y/z/top/radius/dist) or null.
export function pickTarget(ctx,out={}){
 out.kind='';const h=ctx?.human,st=ctx?.combat?.state;if(!h||!st||!h.state)return null;const s=h.state,team=h.team?1:0,en=1-team,L=labels(ctx);
 if(st.phase==='evacuation'){if(s.flight||!insideBlast(st,s.x,s.z))return null;let best=null,bd=Infinity;for(const p of ctx.world?.pads||[]){const d=Math.hypot(p.x-s.x,(p.y||0)-s.y,p.z-s.z);if(d<bd){bd=d;best=p;}}
  return best?setTarget(out,'pad',-1,'Launch pad',best.x,best.y||0,best.z,(best.y||0)+3,best.r||6,s):null;}
 if(st.phase!=='running')return null;
 if((st.shields?.[en]??0)>0){let best=null,bd=Infinity,defend=false;
  for(const o of ctx.objectives||[]){const ours=o.owner===team,mine=team?-o.progress:o.progress,threat=ours&&((o.occupants?.[en]|0)>0||mine<.98);if(ours&&!threat)continue;const d=Math.hypot(o.x-s.x,o.z-s.z);if(d<bd){bd=d;best=o;defend=ours;}}
  if(best)return setTarget(out,defend?'defend':'silo',best.id,(defend?L.defend[best.id]:SHORT[best.id])||best.label,best.x,best.y||0,best.z,(best.y||0)+3,best.radius||14,s);
  return heart(ctx,en,P3)?setTarget(out,'shield',-1,L.shield[en],P3.x,P3.y,P3.z,P3.y+9,8,s):null;}
 let best=null,bd=Infinity;for(const p of ctx.protectors?.()||[]){if(p.team!==en||!(p.hp>0)||!p.point)continue;const d=Math.hypot(p.point.x-s.x,p.point.y-s.y,p.point.z-s.z);if(d<bd){bd=d;best=p;}}
 if(best)return setTarget(out,'protector',best.id,'Protector',best.point.x,best.point.y,best.point.z,best.point.y+3,3,s);
 return heart(ctx,en,P3)?setTarget(out,'core',-1,L.core[en],P3.x,P3.y,P3.z,P3.y+7,4,s):null;
}
// One pooled snapshot of the match per frame, shared by the meter, the waypoint and the tips. `ring`: silo whose capture ring the
// player stands in; `near`: silo within 12 m of its ring that we do not fully hold.
export function readFacts(ctx,f={}){
 const h=ctx?.human,st=ctx?.combat?.state,s=h?.state;f.phase=st?.phase||'idle';f.running=f.phase==='running';f.evacuating=f.phase==='evacuation';f.playing=f.running||f.evacuating;
 f.human=h?.id??0;f.team=h?.team?1:0;f.enemy=1-f.team;f.alive=!!(h?.alive&&h.hp>0);f.mounted=!!h?.mount;f.flight=!!s?.flight;f.grounded=!!s?.grounded;f.classId=h?.classId||'ranger';
 f.x=s?.x||0;f.y=s?.y||0;f.z=s?.z||0;f.captures=h?.captures|0;f.enemyShield=st?.shields?.[f.enemy]??0;
 let n=0;for(const p of ctx?.protectors?.()||[])if(p.team===f.enemy&&p.hp>0)n++;f.enemyProtectors=n;
 let held=0,ringD=Infinity,nearD=Infinity;f.ring=f.near=-1;
 for(const o of ctx?.objectives||[]){if(o.owner===f.team)held++;const d=Math.hypot(o.x-f.x,o.z-f.z),dy=Math.abs(f.y-(o.y||0)),r=o.radius||14;
  if(d<r&&dy<3){if(d<ringD){ringD=d;f.ring=o.id;}}else if(d<r+12&&dy<8&&d<nearD&&!(o.owner===f.team&&(f.team?-o.progress:o.progress)>=.9999)){nearD=d;f.near=o.id;}}
 f.held=held;f.towerDrain=st?.towerDrain!==false;f.safe=!insideBlast(st,f.x,f.z);f.ourDoomed=!!st?.doomedTeams?.includes(f.team);f.targetKind=f.targetKind||'';
 return f;
}
// First-match tips: the first pending tip (in GUIDE_TIPS order) whose condition holds is shown; it completes on the real action
// (after a short minimum read time, with a brief "done" state) or quietly after its timeout. Ages advance on effectDt only and
// freeze while the player is down or the card is held off screen (`hold`: no free slot, scoreboard). Completed ids persist in storage under TIP_KEY ({v:1,done:[...]}).
// plan(skip) drops the tips that cannot apply this match (no enemy protectors, tower strikes off) from the count, so 'Tip step/total'
// numbers the applicable tips in the order they are seen and never skips a number: a tip takes the next number when it first shows
// this match (after every applicable tip already done or shown) and keeps it if it comes back.
export function createTips({storage=null,allowed=true}={}){
 const done=new Set(),off=new Set(),num={},flags={fired:false,captured:false,strike:false,protector:false,core:false};let enabled=true,active='',age=0,gap=2.5,finish=0,sx=0,sz=0,caps=0,safeFor=0;
 try{const raw=storage?.getItem?.(TIP_KEY),d=raw?JSON.parse(raw):null;for(const id of d?.done||[])if(GUIDE_TIPS.includes(id))done.add(id);}catch{}
 function save(){try{storage?.setItem?.(TIP_KEY,JSON.stringify({v:1,done:GUIDE_TIPS.filter(id=>done.has(id))}));}catch{}}
 const RULES={
  move:{when:f=>f.running,done:f=>f.flight||Math.hypot(f.x-sx,f.z-sz)>4,timeout:15},
  fire:{when:f=>f.running,done:()=>flags.fired,timeout:15},
  capture:{when:f=>f.running&&f.enemyShield>0&&f.targetKind==='silo',done:f=>f.captures>caps||flags.captured,timeout:90},
  strike:{when:f=>f.running&&f.towerDrain!==false&&f.enemyShield>0&&f.held>0,done:()=>flags.strike,timeout:10,min:6},
  protectors:{when:f=>f.running&&f.enemyShield<=0&&f.enemyProtectors>0,done:()=>flags.protector,timeout:20},
  core:{when:f=>f.running&&f.enemyShield<=0&&f.enemyProtectors===0,done:()=>flags.core,timeout:15},
  escape:{when:f=>f.evacuating,done:()=>safeFor>=1.5,timeout:20,min:4}};
 function start(id,f){active=id;off.delete(id);if(!num[id]){let n=1;for(const k of GUIDE_TIPS)if(k!==id&&!off.has(k)&&(done.has(k)||num[k]))n++;num[id]=n;}age=finish=safeFor=0;sx=f.x;sz=f.z;caps=f.captures;for(const k in flags)flags[k]=false;}
 function complete(ok){done.add(active);save();if(ok)finish=.9;else{active='';gap=1.2;}}
 return {
  get active(){return active;},get finishing(){return finish>0;},get age(){return age;},get enabled(){return enabled;},get allowed(){return allowed;},get step(){return active?num[active]||1:0;},get total(){return GUIDE_TIPS.length-off.size;},done,
  plan(skip){off.clear();for(const id of skip||[])if(GUIDE_TIPS.includes(id))off.add(id);},
  begin(){active='';finish=0;gap=2.5;for(const k of GUIDE_TIPS)num[k]=0;},
  update(dt,f,hold=false){
   if(!allowed||!enabled){active='';finish=0;return '';}
   if(active){if(finish>0){finish-=dt;if(finish<=0){finish=0;active='';gap=1.2;}return active;}
    if(!f.alive||hold)return active;const r=RULES[active];age+=dt;if(active==='escape')safeFor=f.safe?safeFor+dt:0;
    if(age>=(r.min||1.5)&&r.done(f))complete(true);else if(age>=r.timeout)complete(false);else if(!r.when(f)){if(age>=5)complete(false);else{active='';gap=1.2;}}
    return active;}
   if(!f.alive||!f.playing)return '';if(gap>0){gap-=dt;return '';}
   for(const id of GUIDE_TIPS)if(!done.has(id)&&RULES[id].when(f)){start(id,f);break;}
   return active;},
  event(e,f){if(!active||finish>0||!e)return;const me=f.human;
   if((e.type==='shot'||e.type==='melee'||e.type==='cast')&&e.actor===me)flags.fired=true;
   else if(e.type==='capture'&&e.team===f.team&&e.objective===f.ring)flags.captured=true;
   else if(e.type==='tower-shot'&&e.strike?.team===f.team||e.type==='tower-armed'&&e.team===f.team)flags.strike=true;
   else if(e.type==='protector-down'&&e.team===f.enemy)flags.protector=true;
   else if(e.type==='core-hit'&&e.source===me&&e.coreDamage>0)flags.core=true;},
  drop(){active='';finish=0;gap=1.2;},
  skip(){if(active&&!finish){done.add(active);save();active='';gap=1.2;}},
  skipAll(){for(const id of GUIDE_TIPS)done.add(id);save();active='';finish=0;},
  reset(){done.clear();save();active='';finish=0;gap=1;for(const k of GUIDE_TIPS)num[k]=0;},
  setEnabled(on){enabled=!!on;if(!enabled){active='';finish=0;}return enabled;}};
}
// Ground ring for the local fighter: 16 pixel dashes in the team colour. The camera-facing half ignores depth (stays visible
// through walls, drawn after the through-wall cue) and carries a small chevron pointing at the feet; the far half keeps depth so
// it never paints over the opaque billboard. Rotated each frame to face the camera (Q/E). No per-frame allocation.
function buildRing(T){
 const DASH=12,IN=2.2,OUT=2.6,hw=Math.PI/DASH*.6,group=new T.Group();group.name='Guide: your-fighter ground ring';group.visible=false;group.matrixAutoUpdate=true;
 const front=[],back=[];for(let i=0;i<DASH;i++){const c=(i+.5)/DASH*Math.PI*2;(Math.cos(c)>0?front:back).push(c);}
 function arc(list,a,b){const pos=[],idx=[];for(const c of list){const base=pos.length/3;for(let k=0;k<=2;k++){const t=c-hw+hw*k;pos.push(Math.sin(t)*a,0,Math.cos(t)*a,Math.sin(t)*b,0,Math.cos(t)*b);}for(let k=0;k<2;k++){const p=base+k*2;idx.push(p,p+1,p+2,p+1,p+3,p+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);return g;}
 function chevron(k){const g=new T.BufferGeometry(),z=3.25;g.setAttribute('position',new T.Float32BufferAttribute([0,0,z-.45*k,-.6*k,0,z+.25*k,0,0,z,0,0,z-.45*k,0,0,z,.6*k,0,z+.25*k],3));return g;}
 const mat=(color,opacity,depth)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthTest:depth,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false});
 const tint=mat(0x80eee2,.9,false),far=mat(0x80eee2,.5,true),ink=mat(0x231a2e,.6,false);
 const parts=[[arc(front,IN-.12,OUT+.12),ink,26],[arc(front,IN,OUT),tint,27],[arc(back,IN,OUT),far,3],[chevron(1.45),ink,26],[chevron(1.05),tint,27]];
 for(const [geometry,material,order] of parts){const m=new T.Mesh(geometry,material);m.renderOrder=order;m.frustumCulled=false;if(geometry.attributes.position.count===6)m.position.y=.02;group.add(m);}
 return {group,tint,far,setColor(c){tint.color.setHex(c);far.color.setHex(c);}};
}
export function createGuide(options={}){
 const F={},TG={kind:'',id:-1,label:'',x:0,y:0,z:0,top:0,radius:0,dist:0},cache=new Map(),obs=new Float64Array(4*24),cap={state:0,id:-1,pct:-1,frac:0,flash:0,flashId:-1,last:new Float64Array(8),reverse:0},
  hit={age:-1,kind:'',x:0,y:0,z:0,ix:NaN,iy:NaN,scale:0},way={shown:false,ix:NaN,iy:NaN,lx:NaN,ly:NaN,lw:90,lh:20,sig:-1,label:'',bare:false,angle:NaN,measure:true},
  sg={id:-1,vis:false,on:false,l:0,t:0,r:0,b:0},SB={on:false,l:0,t:0,r:0,b:0},capBox={on:false,x:0,y:0,w:0,h:0,px:NaN,py:NaN},tipBox={on:false,x:0,y:0,w:0,h:0,px:NaN,py:NaN},player={l:0,t:0,r:0,b:0,on:false},landing=[];
 let ctx=null,dom=null,tips=null,ring=null,V=null,coarse=null,motion=null,W=1280,H=720,obsN=0,stackBottom=0,refreshedAt=-1e9,dirty=true,observer=null,watched=new Set(),pill=null,
  shown=null,tipSig=-1,tipId='',tipPod=0,tipSilo=0,tipName='',tipLand='',tipIn=false,signs=null,tipHeld=false,capSig=-1,capMeasured=-1,tipMeasured=-1,capW=0,capH=0,tipW=0,tipH=0,wantTips=true,allowTips=true,pendingReset=false,ringTeam=-1,started=false,clock=0;
 const setTipsAllowed=()=>{const q=options.search??globalThis.location?.search??'';const p=new URLSearchParams(q);allowTips=!p.has('test')||p.get('tips')==='1';};
 // Write-if-changed helpers keyed per element.
 function put(el,key,value){if(!el)return;let m=cache.get(el);if(!m){m={};cache.set(el,m);}if(m[key]===value)return;m[key]=value;
  if(key==='text')el.textContent=value;else if(key==='html')el.innerHTML=value;else if(key==='hidden')el.hidden=value;else if(key.startsWith('data-')){if(value==null)el.removeAttribute(key);else el.setAttribute(key,value);}else el.style.setProperty(key,value);}
 const show=(el,on)=>put(el,'hidden',!on);
 function project(x,y,z,out){V.set(x,y,z).project(ctx.camera);out.x=(V.x*.5+.5)*W;out.y=(-V.y*.5+.5)*H;return V.z>-1&&V.z<1;}
 const Q={x:0,y:0},Q2={x:0,y:0};
 // HUD boxes (cached): obstacles for every overlay of the guide.
 function visible(el){if(!el||el.hidden||!el.getClientRects().length)return false;if(el.id==='message'&&!el.classList.contains('fresh'))return false;const st=getComputedStyle(el);return st.visibility!=='hidden'&&st.display!=='none'&&+st.opacity>.05;}
 function refresh(now){refreshedAt=now;dirty=false;obsN=0;stackBottom=0;pill=null;W=innerWidth;H=innerHeight;
  for(const el of document.querySelectorAll(OBSTACLES)){if(obsN>=24||!visible(el))continue;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)continue;const o=obsN++*4;obs[o]=r.left;obs[o+1]=r.top;obs[o+2]=r.right;obs[o+3]=r.bottom;
   if(STACK.has(el.id))stackBottom=Math.max(stackBottom,r.bottom);if(el.id==='battle-objective')pill={left:r.left,top:r.top,right:r.right,bottom:r.bottom};if(el.id==='hud-top')stackBottom=Math.max(stackBottom,r.bottom);}
  const layer=document.getElementById('silo-markers');signs=layer&&visible(layer)?layer.children:null;
  // The target silo's own world sign: its box is read here (not per frame) as offsets from the projected target top, so the
  // waypoint can keep off it while the camera pans (both are anchored on the same silo; 4 px slack for the 0.4 s between reads).
  sg.id=TG.kind==='silo'?TG.id:-1;sg.vis=sg.on=false;const se=sg.id>=0&&signs?signs[sg.id]:null;
  if(se&&!se.hidden&&se.dataset.visibility==='visible'&&V&&ctx?.camera){sg.vis=true;const r=se.getBoundingClientRect();if(r.width>0&&r.height>0){project(TG.x,TG.top,TG.z,Q);sg.on=true;sg.l=r.left-Q.x-4;sg.t=r.top-Q.y-4;sg.r=r.right-Q.x+4;sg.b=r.bottom-Q.y+4;}}
  if(observer)for(const id of WATCH){const el=document.getElementById(id);if(el&&!watched.has(el)){watched.add(el);observer.observe(el,{attributes:true,attributeFilter:['class','hidden','style'],childList:true,characterData:true,subtree:true});}}
  capMeasured=tipMeasured=-1;}
 function hitObs(l,t,r,b){for(let i=0;i<obsN;i++){const o=i*4;if(l<obs[o+2]&&r>obs[o]&&t<obs[o+3]&&b>obs[o+1])return i;}return -1;}
 const overlaps=(box,l,t,r,b)=>box.on&&l<box.x+box.w&&r>box.x&&t<box.y+box.h&&b>box.y;
 function clear(l,t,r,b,self){if(l<6||t<2||r>W-6||b>H-4)return false;if(hitObs(l,t,r,b)>=0)return false;if(player.on&&l<player.r&&r>player.l&&t<player.b&&b>player.t)return false;if(self!==capBox&&overlaps(capBox,l,t,r,b))return false;if(self!==tipBox&&overlaps(tipBox,l,t,r,b))return false;return true;}
 // Slot search: keep the current spot while it stays clear, else try anchors in order ('drop' from under the top stack, 'rise' from
 // the bottom), sliding past any HUD box in the way.
 function slot(box,w,h,anchors){
  if(box.on&&box.w===w&&box.h===h&&clear(box.x,box.y,box.x+w,box.y+h,box))return true;
  for(const [ax,mode] of anchors){const x=Math.round(ax==='left'?12:ax==='right'?W-12-w:(W-w)/2);if(x<6||x+w>W-6)continue;
   if(mode==='drop'){let y=Math.round(Math.max(stackBottom,capBox.on&&box!==capBox?capBox.y+capBox.h:0)+8);for(let i=0;i<12&&y+h<H-4;i++){if(clear(x,y,x+w,y+h,box)){box.on=true;box.x=x;box.y=y;box.w=w;box.h=h;return true;}const o=hitObs(x,y,x+w,y+h);let next=o>=0?obs[o*4+3]+8:y+12;if(player.on&&x<player.r&&x+w>player.l&&y<player.b&&y+h>player.t)next=Math.max(next,player.b+8);if(box!==tipBox&&overlaps(tipBox,x,y,x+w,y+h))next=Math.max(next,tipBox.y+tipBox.h+8);if(box!==capBox&&overlaps(capBox,x,y,x+w,y+h))next=Math.max(next,capBox.y+capBox.h+8);y=Math.round(next);}}
   else{let y=Math.round(H-h-8);for(let i=0;i<12&&y>stackBottom;i++){if(clear(x,y,x+w,y+h,box)){box.on=true;box.x=x;box.y=y;box.w=w;box.h=h;return true;}const o=hitObs(x,y,x+w,y+h);let next=o>=0?obs[o*4+1]-h-8:y-12;if(player.on&&x<player.r&&x+w>player.l&&y<player.b&&y+h>player.t)next=Math.min(next,player.t-h-8);y=Math.round(next);}}}
  box.on=false;return false;}
 const CAP_ANCHORS=[['centre','drop']],TIP_ANCHORS=[['left','drop'],['centre','drop'],['left','rise'],['centre','rise'],['right','drop'],['right','rise']];
 function placeCap(w,h){capBox.on=false;
  // Desktop and landscape: the lane beside the objective pill; otherwise centred under the top stack (objective, banner, toast, evacuation).
  if(pill){const y=Math.round(pill.top+(pill.bottom-pill.top-h)/2);for(const x of [Math.round(pill.right+8),Math.round(pill.left-8-w)])if(clear(x,y,x+w,y+h,capBox)){capBox.on=true;capBox.x=x;capBox.y=y;capBox.w=w;capBox.h=h;return true;}}
  return slot(capBox,w,h,CAP_ANCHORS);}
 function blocked(){const b=document.body.classList;return !!(ctx.paused||b.contains('scoreboard-open')||b.contains('inspecting-bots')||b.contains('shell-title')||b.contains('shell-loading')||ctx.dom?.result&&!ctx.dom.result.hidden||ctx.dom?.panel&&!ctx.dom.panel.hidden||ctx.spawnMap?.open||dom.look&&!dom.look.hidden||dom.pause&&!dom.pause.hidden);}
 // ---- capture meter model. Bar and percent always show the same number (our capture or neutralising progress, or the
 // silo charge while it arms); a held silo that is not charging (tower strikes off, idle, discharging) reads plain 'held'.
 function captureModel(dt){
  const c=cap,os=ctx.objectives||[];c.flash=Math.max(0,c.flash-dt);let state=0,id=-1,pct=-1,frac=0;
  if(F.running&&F.alive){
   if(F.ring>=0&&!F.flight){const o=os[F.ring];id=o.id;const mine=F.team?-o.progress:o.progress,prev=c.last[id],last=prev===prev?prev:mine,ours=o.owner===F.team;
    if(dt>0){if(mine<last-1e-5&&!(ours&&mine>=.9999))c.reverse=.6;else c.reverse=Math.max(0,c.reverse-dt);c.last[id]=mine;}
    if(c.flash>0&&c.flashId===id)state=4;
    else if(F.mounted){state=8;}
    else if((o.occupants?.[F.enemy]|0)>0||o.contested||c.reverse>0){state=3;frac=mine>=0?mine:1+mine;pct=Math.round(mine>=0?mine*100:(1+mine)*100);}
    else if(ours&&mine>=.9999){if(!F.towerDrain||o.mode==='idle'||o.mode==='discharging'){state=4;frac=1;}else if(o.mode==='armed')state=6;else{state=5;frac=Math.max(0,Math.min(1,o.charge||0));pct=Math.floor(frac*100);}}
    else if(mine<0){state=2;frac=1+mine;pct=Math.round((1+mine)*100);}
    else{state=1;frac=mine;pct=Math.round(mine*100);}}
   else if(c.flash>0){state=4;id=c.flashId;}
   else if(F.near>=0&&!F.flight){state=7;id=F.near;}}
  else if(F.running&&c.flash>0){state=4;id=c.flashId;}
  c.state=state;c.id=id;c.pct=pct;c.frac=frac;
 }
 // ---- tip text (built only when its signature changes)
 const kbd=k=>'<kbd>'+k+'</kbd>',chip=k=>'<span class="gt-chip">'+k+'</span>';
 function landingFor(id){return landing[id]??-1;}
 // The pod destination as the HUD names it: the #destination option ('Arena west'; the touch tile word 'Arena W'), or the silo
 // name itself when its own landing carries it ('T1 · NORTHWEST landing' reads 'T1' on the tile).
 function landName(id,touch,name){const t=dom?.destination?.options?.[landingFor(id)]?.text||'';if(!t||t.startsWith(SHORT[id]))return name;const w=t.split(' ');return touch&&w[0]==='Arena'&&w[1]?'Arena '+w[1][0].toUpperCase():t;}
 function podState(){if(tips.active!=='capture'||TG.kind!=='silo'||F.flight||F.mounted)return 0;let near=-1;try{near=ctx.physics?.nearPad?.()??-1;}catch{}if(!(near>=0))return 0;const d=dom.destination,want=landingFor(TG.id);if(!d||want<0||want===near)return 0;return Number(d.value)===want?2:1;}
 function tipHtml(id,touch,pod,silo,inRing,land){
  const en=labels(ctx).team[F.enemy],R=ctx.BATTLE_RULES||{},name=silo||'a silo',sword=F.classId==='fighter',to=land&&land!==name?(touch?chip(land):land)+' (nearest '+name+')':name;
  switch(id){
   case 'move':return ['Move',touch?'Drag the '+chip('MOVE')+' pad to walk.':'Walk with '+kbd('W')+kbd('A')+kbd('S')+kbd('D')+'. Turn the camera with '+kbd('Q')+' / '+kbd('E')+'.'];
   case 'fire':return [sword?'Attack':'Fire',touch?'Hold '+chip('FIRE')+(sword?' to swing at the nearest foe.':' to shoot the nearest foe.'):(sword?'Click to swing your sword.':'Click to shoot where the reticle points. '+kbd('1')+'–'+kbd('6')+' switch weapons.')];
   case 'capture':return ['Capture '+name,pod===1?'Set the pod to '+to+', then '+(touch?'tap '+chip('Launch')+'.':'press '+kbd('Space')+'.'):pod===2?'Pod set for '+to+'. '+(touch?'Tap '+chip('Launch')+' to fly there.':'Press '+kbd('Space')+' to launch.'):inRing?'Stay in the ring until '+name+' is yours. A foe inside contests it.':'Follow the gold arrow to '+name+' and stand in its ring until it is yours.'];
   case 'strike':return ['Silos strike the shield','A held silo charges for '+(R.towerChargeSeconds||60)+' s, then hits the '+en+' shield. Hold more silos to break it sooner.'];
   case 'protectors':return ['Destroy the protectors','The '+en+' shield is down. Shoot the protector orbs that guard their core.'];
   case 'core':return ['Strike the core','Nothing guards the '+en+' core now. Every hit counts: break it to win.'];
   case 'escape':return ['Escape the blast',F.ourDoomed?'Our core fell. Leave the amber blast ring before the castle explodes'+(touch?': '+chip('Launch')+' on a pad is fastest.':': '+kbd('Space')+' on a pad is fastest.'):'Their castle explodes soon. Stay outside the amber blast ring and watch for falling debris to survive for +'+(R.survivalBonus||100)+'.'];}
  return ['',''];
 }
 // ---- DOM
 function build(){
  const el=(tag,id,cls,html)=>{const e=document.createElement(tag);if(id)e.id=id;if(cls)e.className=cls;if(html)e.innerHTML=html;return e;};
  const root=el('div','guide-root');root.setAttribute('aria-hidden','true');root.hidden=true;
  const way=el('div','guide-way','','<i class="gw-icon"></i><span class="gw-label"><b></b><small></small></span>');way.hidden=true;
  const hitEl=el('div','guide-hit');hitEl.hidden=true;root.append(way,hitEl);
  const capEl=el('div','guide-capture','','<i class="gc-icon"></i><b class="gc-label"></b><span class="gc-bar"><em></em></span><span class="gc-pct"></span>');capEl.hidden=true;capEl.setAttribute('aria-hidden','true');
  const tipEl=el('div','guide-tip','','<div class="gt-head"><small class="gt-step"></small><b class="gt-title"></b><span class="gt-actions"><button type="button" class="gt-skip">Skip</button><button type="button" class="gt-all">Skip all</button></span></div><p class="gt-body"></p><button type="button" class="gt-act" hidden></button>');tipEl.hidden=true;tipEl.setAttribute('role','status');tipEl.setAttribute('aria-live','polite');
  document.body.append(root,capEl,tipEl);
  const focusWorld=e=>{if(e.detail>0)document.getElementById('world')?.focus?.({preventScroll:true});};
  tipEl.querySelector('.gt-skip').onclick=e=>{e.preventDefault();tips?.skip();tipSig=-1;focusWorld(e);};
  tipEl.querySelector('.gt-all').onclick=e=>{e.preventDefault();tips?.skipAll();tipSig=-1;focusWorld(e);};
  const act=tipEl.querySelector('.gt-act');act.onclick=e=>{e.preventDefault();const d=dom.destination,want=landingFor(TG.id);if(d&&want>=0){d.value=String(want);d.dispatchEvent(new Event('change',{bubbles:true}));}tipSig=-1;focusWorld(e);};
  dom={root,way,wayIcon:way.querySelector('.gw-icon'),wayLabel:way.querySelector('.gw-label'),wayName:way.querySelector('.gw-label b'),wayDist:way.querySelector('.gw-label small'),hit:hitEl,
   cap:capEl,capLabel:capEl.querySelector('.gc-label'),capFill:capEl.querySelector('.gc-bar em'),capPct:capEl.querySelector('.gc-pct'),
   tip:tipEl,tipStep:tipEl.querySelector('.gt-step'),tipTitle:tipEl.querySelector('.gt-title'),tipBody:tipEl.querySelector('.gt-body'),tipAct:act,
   look:document.getElementById('look-panel'),pause:document.getElementById('pause-panel'),destination:document.getElementById('destination')};
  coarse=typeof matchMedia==='function'?matchMedia('(pointer:coarse)'):null;motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  if(typeof MutationObserver==='function')observer=new MutationObserver(()=>{dirty=true;});
  const remeasure=()=>{dirty=true;capW=tipW=0;};addEventListener('resize',remeasure);document.fonts?.addEventListener?.('loadingdone',remeasure);
 }
 function hideAll(){if(!dom)return;show(dom.root,false);show(dom.cap,false);show(dom.tip,false);show(dom.way,false);show(dom.hit,false);capBox.on=tipBox.on=false;way.shown=false;shown=false;}
 function clearMatch(){hit.age=-1;cap.flash=0;cap.reverse=0;cap.last.fill(NaN);capSig=tipSig=-1;tipId='';tipHeld=false;hideAll();if(ring)ring.group.visible=false;}
 // ---- per-frame views
 function viewCapture(on){
  const c=cap,s=on?c.state:0;if(!s){show(dom.cap,false);capBox.on=false;return;}
  const sig=s*1e6+(c.id+1)*1e4+(c.pct+2)*10+F.team;if(sig!==capSig){capSig=sig;const name=SHORT[c.id]||'silo',en=labels(ctx).team[F.enemy];
   put(dom.cap,'data-state',CAP_STATES[s]);put(dom.cap,'data-team',String(s===2?F.enemy:F.team));
   put(dom.capLabel,'text',s===1?'Capturing '+name:s===2?'Neutralising '+name:s===3?'Contested '+name:s===4?name+' held':s===5?name+' held · arming':s===6?name+' armed · striking '+en:s===7?'Stand in the ring to capture '+name:'Leave the vehicle to capture '+name);
   put(dom.capPct,'text',c.pct>=0&&s!==4&&s!==6&&s!==7&&s!==8?c.pct+'%':'');put(dom.capFill,'width',Math.round(Math.min(1,c.frac)*10)*6+'px');capMeasured=-1;capW=0;}
  // No free slot: stay hidden until the next refresh() (HUD change, resize or 0.4 s) or new content, never show/measure/hide per frame.
  // The size is measured once per content (and resize/font load); later refreshes re-place from it without unhiding.
  if(capMeasured===0){show(dom.cap,false);capBox.on=false;return;}
  if(capMeasured<0){capMeasured=1;if(!(capW>0)){show(dom.cap,true);capW=dom.cap.offsetWidth;capH=dom.cap.offsetHeight;}if(!placeCap(capW,capH)){show(dom.cap,false);capMeasured=0;return;}}
  show(dom.cap,true);
  if(capBox.x!==capBox.px||capBox.y!==capBox.py){capBox.px=capBox.x;capBox.py=capBox.y;put(dom.cap,'transform','translate('+capBox.x+'px,'+capBox.y+'px)');}
 }
 function viewTip(on){
  const id=on&&F.alive?tips.active:'';if(!id){show(dom.tip,false);tipBox.on=false;return;}
  const touch=!!coarse?.matches,fin=tips.finishing;
  // The "done" beat keeps the words of the step just completed (the target has usually moved on to the next silo by then).
  if(!fin||tipId!==id){tipId=id;tipPod=podState();tipSilo=TG.kind==='silo'?TG.id+1:0;tipName=tipSilo?TG.label:'';tipIn=tipSilo>0&&F.ring===TG.id;}
  const sig=GUIDE_TIPS.indexOf(id)*1e6+(touch?1e5:0)+tipPod*1e4+(fin?1e3:0)+(F.ourDoomed?500:0)+(F.classId==='fighter'?250:0)+(tipIn?100:0)+tipSilo;
  if(sig!==tipSig){tipSig=sig;tipLand=tipPod?landName(tipSilo-1,touch,tipName):'';const [title,body]=tipHtml(id,touch,tipPod,tipName,tipIn,tipLand);put(dom.tip,'data-state',fin?'done':'show');put(dom.tip,'data-tip',id);put(dom.tipStep,'text',fin?'Done':'Tip '+tips.step+'/'+tips.total);put(dom.tipTitle,'text',title);put(dom.tipBody,'html',body);
   show(dom.tipAct,tipPod===1&&!fin);if(tipPod===1)put(dom.tipAct,'text','Pod to '+(tipLand||tipName));tipMeasured=-1;tipW=0;}
  if(tipMeasured===0){show(dom.tip,false);tipBox.on=false;return;}
  if(tipMeasured<0){tipMeasured=1;if(!(tipW>0)){show(dom.tip,true);tipW=dom.tip.offsetWidth;tipH=dom.tip.offsetHeight;}if(!slot(tipBox,tipW,tipH,TIP_ANCHORS)){show(dom.tip,false);tipMeasured=0;return;}}
  show(dom.tip,true);
  if(tipBox.x!==tipBox.px||tipBox.y!==tipBox.py){tipBox.px=tipBox.x;tipBox.py=tipBox.y;put(dom.tip,'transform','translate('+tipBox.x+'px,'+tipBox.y+'px)');}
 }
 // Waypoint spot test (scratch WS, no allocation): the icon box must be clear (the 28 px chevron's rotated extent WS.hs), then the
 // first clear label spot (diamond: above, below, inward; chevron: inward along the ray, above, below). 2 = icon and label
 // (WS.lx/ly), 1 = icon only, 0 = blocked. With the target silo's sign on screen (SB) no icon (diamond or chevron) or plate may sit on it.
 const WS={dx:0,dy:0,k:0,lw:0,lh:0,lx:0,ly:0,hs:14},onSign=(l,t,r,b)=>SB.on&&l<SB.r&&r>SB.l&&t<SB.b&&b>SB.t;
 function fitWay(x,y,mark){const hs=mark?14:WS.hs;if(!clear(x-hs,y-hs,x+hs,y+hs,null)||onSign(x-hs,y-hs,x+hs,y+hs))return 0;const lw=WS.lw,lh=WS.lh,ix=x-WS.dx*WS.k,iy=y-WS.dy*WS.k,cx=Math.min(W-8-lw/2,Math.max(8+lw/2,x));
  for(let j=0;j<3;j++){const v=mark?(j+1)%3:j,lx=v===0?ix:cx,ly=v===0?iy:v===1?y-17-lh/2:y+17+lh/2;if(clear(lx-lw/2,ly-lh/2,lx+lw/2,ly+lh/2,null)&&!onSign(lx-lw/2,ly-lh/2,lx+lw/2,ly+lh/2)){WS.lx=lx;WS.ly=ly;return 2;}}
  return 1;}
 function viewWay(on){
  const kind=TG.kind,hideNear=(kind==='silo'||kind==='defend'||kind==='pad')&&Math.hypot(TG.x-F.x,TG.z-F.z)<TG.radius;
  if(!on||!kind||!F.alive||hideNear||!player.on){if(way.shown){way.shown=false;show(dom.way,false);}return;}
  const ox=(player.l+player.r)/2,oy=(player.t+player.b)/2;project(TG.x,TG.top,TG.z,Q2);let dx=Q2.x-ox,dy=Q2.y-oy;const L=Math.hypot(dx,dy);if(!(L>1)){if(way.shown){way.shown=false;show(dom.way,false);}return;}dx/=L;dy/=L;
  const d=TG.dist,meters=d<50?Math.round(d):d<200?Math.round(d/5)*5:Math.round(d/10)*10;
  // A silo whose own world sign is on screen (silo-markers.js) already shows its name: the plate then reads only the distance.
  const sign=kind==='silo'?signs?.[TG.id]:null,bare=!!sign&&!sign.hidden&&sign.dataset.visibility==='visible';
  if(meters!==way.sig||TG.label!==way.label||bare!==way.bare){way.sig=meters;way.label=TG.label;way.bare=bare;put(dom.way,'data-kind',kind);put(dom.wayName,'text',bare?'':TG.label);put(dom.wayDist,'text',meters+' m');way.measure=true;}
  // Sign on screen: its box comes from refresh() (re-run once when the target or the sign's visibility changed since).
  if(bare&&(sg.id!==TG.id||!sg.vis))refresh(performance.now());SB.on=bare&&sg.on&&sg.id===TG.id;if(SB.on){SB.l=Q2.x+sg.l;SB.t=Q2.y+sg.t;SB.r=Q2.x+sg.r;SB.b=Q2.y+sg.b;}
  if(way.measure&&!dom.way.hidden){const w=dom.wayLabel.offsetWidth,h=dom.wayLabel.offsetHeight;if(w>0){way.lw=w;way.lh=h;way.measure=false;}}
  WS.dx=dx;WS.dy=dy;WS.lw=way.lw;WS.lh=way.lh;WS.k=17+way.lw/2*Math.abs(dx)+way.lh/2*Math.abs(dy);WS.hs=Math.ceil(14*(Math.abs(dx)+Math.abs(dy)))+1;
  const M=Math.max(22,WS.hs+7);let tEdge=Infinity;if(dx>1e-6)tEdge=(W-M-ox)/dx;else if(dx<-1e-6)tEdge=(M-ox)/dx;if(dy>1e-6)tEdge=Math.min(tEdge,(H-M-oy)/dy);else if(dy<-1e-6)tEdge=Math.min(tEdge,(M-oy)/dy);
  let t=L<=tEdge?L:tEdge,mode=L<=tEdge?'mark':'edge',r=0,x=0,y=0,fx=NaN,fy=NaN,fm='';const st=Math.max(8,Math.round(t/48));
  // 1) Along the player->target ray: the diamond over an on-screen target, then chevrons stepping in from the screen edge. When the
  // silo's own sign covers the silo top (HUD above its orb pushes it down) the diamond hangs just below the sign, plate under it (no
  // spot there: chevrons as usual); with no plate spot clear of the sign the diamond stays alone (the sign already names the silo).
  for(let i=0;i<64&&(t>=48||i===0&&mode==='mark');i++){x=ox+dx*t;y=oy+dy*t;if(mode==='mark'&&onSign(x-14,y-14,x+14,y+14))y=SB.b+14;r=fitWay(x,y,mode==='mark');if(r===2)break;if(r===1&&fx!==fx){fx=x;fy=y;fm=mode;}if(r===1&&mode==='mark'&&SB.on)break;mode='edge';t-=st;}
  // 2) Target off screen and the ray blocked by HUD: slide the chevron along that screen edge (it keeps pointing at the target).
  if(r!==2&&L>tEdge){const ex=ox+dx*tEdge,ey=oy+dy*tEdge,vert=Math.abs(ex-M)<1||Math.abs(ex-(W-M))<1;
   for(let i=0;i<32;i++){const off=((i>>1)+1)*10*(i&1?-1:1);x=vert?ex:ex+off;y=vert?ey+off:ey;if(x<M||x>W-M||y<M||y>H-M)continue;r=fitWay(x,y,false);if(r===2){mode='edge';break;}if(r===1&&fx!==fx){fx=x;fy=y;fm='edge';}}}
  // 3) No label fits anywhere: the first clear icon spot alone.
  if(r!==2){if(fx!==fx){if(way.shown){way.shown=false;show(dom.way,false);}return;}x=fx;y=fy;mode=fm;}
  const lx=WS.lx,ly=WS.ly;way.shown=true;show(dom.way,true);show(dom.wayLabel,r===2);put(dom.way,'data-mode',mode);put(dom.way,'data-focus',tips?.active==='capture'&&kind==='silo'?'':null);
  const step=mode==='edge'?Math.round(Math.atan2(dy,dx)/(Math.PI/16))*(180/16):0,ix=Math.round(x),iy=Math.round(y),jx=Math.round(lx),jy=Math.round(ly);
  if(ix!==way.ix||iy!==way.iy||step!==way.angle){way.ix=ix;way.iy=iy;way.angle=step;put(dom.wayIcon,'transform','translate('+ix+'px,'+iy+'px) translate(-50%,-50%) rotate('+step+'deg)');}
  if(jx!==way.lx||jy!==way.ly){way.lx=jx;way.ly=jy;put(dom.wayLabel,'transform','translate('+jx+'px,'+jy+'px) translate(-50%,-50%)');}
 }
 function viewHit(on,dt){
  if(hit.age<0||!on){if(hit.age>=0&&!on)hit.age=-1;show(dom.hit,false);return;}
  hit.age+=dt;const kill=hit.kind==='kill',end=kill?.42:.24;if(hit.age>=end){hit.age=-1;show(dom.hit,false);return;}
  const r=ctx.dom?.reticle;let x=0,y=0;if(r&&!r.hidden&&document.body.classList.contains('reticle-on')){x=parseFloat(r.style.left)||0;y=parseFloat(r.style.top)||0;}else{project(hit.x,hit.y,hit.z,Q);x=Q.x;y=Q.y;}
  const a=hit.age,scale=kill?(a<.06?4:3):(a<.05?3:2),fade=a>(kill?.3:.16)?'.5':'1',ix=Math.round(x),iy=Math.round(y);
  show(dom.hit,true);put(dom.hit,'data-kind',hit.kind);put(dom.hit,'opacity',fade);if(ix!==hit.ix||iy!==hit.iy||scale!==hit.scale){hit.ix=ix;hit.iy=iy;hit.scale=scale;put(dom.hit,'transform','translate('+ix+'px,'+iy+'px) scale('+scale+')');}
 }
 function updatePlayerBox(){
  const h=ctx.human;if(!h?.alive||!V){player.on=false;return;}const s=h.state;project(s.x,s.y,s.z,Q);const fx=Q.x,fy=Q.y;project(s.x,s.y+2.2,s.z,Q2);const half=Math.max(18,Math.abs(fy-Q2.y)*.6);
  player.l=fx-half;player.r=fx+half;player.t=Math.min(fy,Q2.y)-8;player.b=Math.max(fy,Q2.y)+10;player.on=true;}
 function updateRing(){
  if(!ring)return;const h=ctx.human,on=!!(F.playing&&F.alive&&!F.flight&&!F.mounted&&h?.state);ring.group.visible=on;if(!on)return;
  if(F.team!==ringTeam){ringTeam=F.team;ring.setColor(ctx.colors?.[F.team]??(F.team?0xf49bc7:0x80eee2));}
  const s=h.state,e=ctx.camera.matrixWorld.elements;ring.group.position.set(s.x,s.y+.06,s.z);ring.group.rotation.y=Math.atan2(e[8],e[10]);
 }
 // Tips that cannot come up this match leave the count: protectors when the enemy castle has none, strike with tower strikes off.
 const SKIP=[];function planTips(){if(!tips||!ctx)return;SKIP.length=0;const en=ctx.human?.team?0:1;let n=0;for(const p of ctx.protectors?.()||[])if(p.team===en&&p.hp>0)n++;if(!n)SKIP.push('protectors');if(ctx.combat?.state?.towerDrain===false)SKIP.push('strike');tips.plan(SKIP);}
 const ext={name:'guide',
  attach(c){if(ctx)return;ctx=c;setTipsAllowed();let storage=options.storage;if(storage===undefined)try{storage=globalThis.localStorage??null;}catch{storage=null;}
   tips=createTips({storage,allowed:allowTips});tips.setEnabled(wantTips);if(pendingReset){tips.reset();pendingReset=false;}
   if(c.T&&c.root){try{V=new c.T.Vector3();ring=buildRing(c.T);c.root.add(ring.group);}catch(err){ring=null;}}
   if(typeof document!=='undefined'&&document.body)build();},
  started(c){ctx=c||ctx;started=true;clearMatch();tips?.begin();planTips();dirty=true;ringTeam=-1;landing.length=0;
   const pads=ctx.world?.pads||[];for(const o of ctx.objectives||[]){let best=-1,bd=Infinity;for(const [i,p] of pads.entries()){if(p.home)continue;const d=Math.hypot(p.x-o.x,p.z-o.z);if(d<bd){bd=d;best=i;}}landing[o.id]=best;}},
  event(e,c){if(!e||!ctx)return;if(e.type==='start'||e.type==='stop'){clearMatch();if(e.type==='start'){tips?.begin();planTips();}return;}const me=F.human??0,h=c?.human;
   if(e.type==='capture'&&e.team===F.team){const o=ctx.objectives?.[e.objective];if(o&&Math.hypot(o.x-F.x,o.z-F.z)<(o.radius||14)+4){cap.flash=2.2;cap.flashId=e.objective;}}
   if(e.source===me&&h){const enemyActor=e.type==='hit'||e.type==='down'?actorById(c?.actors,e.actor):null;if(e.type==='down'&&enemyActor&&enemyActor.team!==h.team||e.type==='protector-down'||e.type==='gate-down'){hit.kind='kill';hit.age=0;hit.x=e.x??enemyActor?.state.x??0;hit.y=(e.y??enemyActor?.state.y??0)+(e.type==='down'?1.2:0);hit.z=e.z??enemyActor?.state.z??0;}
    else if(hit.kind!=='kill'||hit.age<0||hit.age>.3){const dealt=e.type==='hit'?enemyActor&&enemyActor.team!==h.team&&e.damage>0:e.type==='core-hit'?(e.shieldDamage||0)+(e.coreDamage||0)>0:(e.type==='protector-hit'||e.type==='gate-hit'||e.type==='vehicle-hit')&&e.damage>0;
     if(dealt){hit.kind='hit';hit.age=0;hit.x=e.x||0;hit.y=e.y||0;hit.z=e.z||0;}}}
   tips?.event(e,F);},
  render(dt,c){
   if(c)ctx=c;if(!ctx||!tips)return;clock+=dt;readFacts(ctx,F);F.targetKind=pickTarget(ctx,TG)?TG.kind:'';captureModel(dt);tips.update(dt,F,tipHeld);
   if(ring&&ctx.camera)updateRing();if(!dom||!V)return;
   const on=F.playing&&!blocked();if(on!==shown){shown=on;show(dom.root,on);if(!on){show(dom.cap,false);show(dom.tip,false);capBox.on=tipBox.on=false;}else dirty=true;}
   if(!on){hit.age=-1;tipHeld=!!tips.active;return;}
   const now=performance.now();if(dirty||now-refreshedAt>REFRESH)refresh(now);updatePlayerBox();
   viewCapture(true);viewTip(true);viewWay(true);viewHit(true,dt);tipHeld=!!tips.active&&!tipBox.on;},
  finished(){tips?.drop();hideAll();},
  reset(){clearMatch();},
  stopped(){started=false;clearMatch();},
  setTips(on){wantTips=!!on;tips?.setEnabled(wantTips);tipSig=-1;return wantTips;},
  resetTips(){if(tips)tips.reset();else{pendingReset=true;try{globalThis.localStorage?.removeItem?.(TIP_KEY);}catch{}}tipSig=-1;},
  get tipsEnabled(){return wantTips;},get enabled(){return wantTips&&allowTips;},get active(){return tips?.active||'';},get step(){return tips?.step||0;},get total(){return tips?.total??GUIDE_TIPS.length;},
  snapshot:()=>({target:TG.kind?{kind:TG.kind,id:TG.id,label:TG.label,dist:Math.round(TG.dist)}:null,capture:{state:CAP_STATES[cap.state],id:cap.id,pct:cap.pct},
   tip:{active:tips?.active||'',step:tips?.step||0,total:tips?.total??GUIDE_TIPS.length,finishing:!!tips?.finishing,enabled:wantTips,allowed:allowTips,done:tips?GUIDE_TIPS.filter(id=>tips.done.has(id)):[]},
   way:{shown:way.shown,mode:dom?.way?.dataset?.mode||'',bare:way.bare},hit:{kind:hit.age>=0?hit.kind:'',age:hit.age},ring:{visible:!!ring?.group.visible},boxes:{cap:capBox.on?{...capBox}:null,tip:tipBox.on?{...tipBox}:null,player:player.on?{...player}:null}})};
 return ext;
}
