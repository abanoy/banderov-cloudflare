import * as T from '../vendor/three.module.js';
// Where the segment from (x,y) along (dx,dy) first enters box b, as a fraction 0..1 (1 when it never does; Liang-Barsky).
function segmentEnter(x,y,dx,dy,b){let t0=0,t1=1;
 for(let k=0;k<4;k++){const p=k===0?-dx:k===1?dx:k===2?-dy:dy,q=k===0?x-b.left:k===1?b.right-x:k===2?y-b.top:b.bottom-y;
  if(p===0){if(q<0)return 1;continue;}const r=q/p;if(p<0){if(r>t1)return 1;if(r>t0)t0=r;}else{if(r<t0)return 1;if(r<t1)t1=r;}}
 return t0<=t1?t0:1;}
const inside=(x,y,b)=>x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;
// Bottom-centred labels stay near their projected silo, clear of the actual HUD. Among free spots, one whose leader (label bottom
// to the silo) would run over a box costs as much as a spot 160px further away, so leaders rarely cross a panel or a label; a
// box that holds the silo itself is unavoidable and not counted.
export function siloLabelPosition(x,y,w,h,viewport,obstacles){
 const gap=8,minX=viewport.left+w/2+4,maxX=viewport.right-w/2-4,minY=viewport.top+h+4,maxY=viewport.bottom-4;
 if(minX>maxX||minY>maxY)return null;
 const cx=v=>Math.max(minX,Math.min(maxX,v)),cy=v=>Math.max(minY,Math.min(maxY,v));
 function free(px,py){return !obstacles.some(b=>px-w/2<b.right+gap&&px+w/2>b.left-gap&&py-h<b.bottom+gap&&py>b.top-gap);}
 const ox=cx(x),oy=cy(y);if(free(ox,oy))return {x:ox,y:oy};
 const xs=[ox],ys=[oy];for(const b of obstacles){xs.push(cx(b.left-w/2-gap),cx(b.right+w/2+gap));ys.push(cy(b.top-gap),cy(b.bottom+h+gap));}
 function crosses(px,py){for(const b of obstacles)if(!inside(x,y,b)&&segmentEnter(px,py,x-px,y-py,b)<1)return true;return false;}
 let best=null,distance=Infinity;for(const px of new Set(xs))for(const py of new Set(ys)){if(!free(px,py))continue;const d=(px-x)**2+(py-y)**2+(crosses(px,py)?25600:0);if(d<distance){distance=d;best={x:px,y:py};}}
 return best;
}
// HUD and panel boxes that labels must avoid; their rects are cached (resize, match start, every 0.5 s), never read per frame. A
// box that is shown but faded out (a #message toast after its 4 s) does not count; the objective plate, a tip card or an
// announcer banner counts only while it is up.
export const LABEL_OBSTACLES='.brand,header nav,.compass,.telemetry,.move-zone,.travel,#message,#look-panel,#battle-hud,#battle-board,#battle-radar,#hud-top,#hud-hotbar,#hud-player,#hud-actions,#battle-fire,#pad,#battle-objective,#guide-tip,#announce-banner';
// A leader is drawn from the tip of the pennant's bottom notch, NOTCH px above the label's bottom edge (battle.css .silo-marker
// ::before clip-path and ::after top), and --silo-line-length is its whole drawn length from there.
const NOTCH=6;
// Every other silo on screen keeps a box of KEEP px around its island anchor clear of labels, plus the 8px placement gap: a pennant
// never sits on a neighbouring silo. On a narrow screen a label whose leader would run longer than LONG px is hidden instead.
const KEEP=16,LONG=90;
export function createSiloMarkers(world,camera,playerSprite=null){
 const layer=document.createElement('div');layer.id='silo-markers';layer.setAttribute('aria-label','Silo locations');document.body.append(layer);
 const names=['T1 · NORTHWEST','T2 · NORTHEAST','T3 · SOUTHEAST','T4 · SOUTHWEST','CROWN · CENTRAL'];
 const labels=world.orbTowers.map((orb,i)=>{const el=document.createElement('div');el.className='silo-marker';el.innerHTML='<b></b><span></span>';el.querySelector('b').textContent=names[i];el.hidden=true;el.dataset.visibility='offscreen';layer.append(el);return el;});
 // Per-label write cache: every DOM write below only happens when its value changes.
 const state=labels.map(el=>({el,span:el.querySelector('span'),hidden:true,visibility:'offscreen',owner:null,text:'',w:0,h:0,measure:true,left:null,top:null,anchor:'',line:'',keep:{left:0,right:0,top:0,bottom:0}}));
 const point=new T.Vector3(),up=new T.Vector3(),view={left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight},placed=[],avoid=[];let fixed=[],refreshedAt=-1,dirty=true,layerShown=true;
 const invalidate=()=>{dirty=true;for(const s of state)s.measure=true;};addEventListener('resize',invalidate);document.fonts?.addEventListener?.('loadingdone',invalidate);
 function refresh(now){
  refreshedAt=now;dirty=false;const r=document.getElementById('world')?.getBoundingClientRect();Object.assign(view,r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:{left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight});
  fixed=[];for(const el of document.querySelectorAll(LABEL_OBSTACLES)){if(!el.getClientRects().length)continue;const st=getComputedStyle(el);if(st.visibility==='hidden'||+st.opacity===0)continue;const b=el.getBoundingClientRect();if(b.width&&b.height)fixed.push({left:b.left,right:b.right,top:b.top,bottom:b.bottom});}
  const cs=getComputedStyle(layer);layerShown=!layer.hidden&&cs.display!=='none'&&cs.visibility!=='hidden';
 }
 function set(s,hidden,visibility){if(s.hidden!==hidden){s.hidden=hidden;s.el.hidden=hidden;}if(s.visibility!==visibility){s.visibility=visibility;s.el.dataset.visibility=visibility;}}
 return {invalidate,update(objectives=[],active=false){
  const now=performance.now();if(dirty||now-refreshedAt>500)refresh(now);
  // Outside a match with the layer hidden (for example behind the title screen) there is nothing to place.
  if(!active&&!layerShown){for(const s of state)set(s,true,'offscreen');return;}
  placed.length=0;for(const b of fixed)placed.push(b);
  if(playerSprite?.visible){playerSprite.getWorldPosition(point).addScaledVector(up.setFromMatrixColumn(camera.matrixWorld,1),playerSprite.scale.y*(.5-playerSprite.center.y)).project(camera);if(point.z>=-1&&point.z<=1&&Math.abs(point.x)<1&&Math.abs(point.y)<1){const h=Math.max(24,playerSprite.scale.y/(camera.top-camera.bottom)*camera.zoom*view.height)+16,w=h*playerSprite.scale.x/playerSprite.scale.y+16,x=view.left+(point.x+1)*view.width/2,y=view.top+(1-point.y)*view.height/2;placed.push({left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2});}}
  // Pass 1: projection and text (writes only on change), collecting labels whose box must be re-measured.
  let measure=false;
  world.orbTowers.forEach((orb,i)=>{
   const s=state[i];orb.core.getWorldPosition(point);point.y+=9;point.project(camera);const off=point.z<-1||point.z>1||Math.abs(point.x)>1.1||Math.abs(point.y)>1.1;s.x=view.left+(point.x+1)*view.width/2;s.y=view.top+(1-point.y)*view.height/2;s.off=off;if(off)return;
   const owner=active?(objectives[i]?.owner??-1):-1;if(s.owner!==owner){s.owner=owner;s.el.dataset.owner=owner;}const text=owner===0?'DAWN · ALLIED':owner===1?'DUSK · HOSTILE':'NEUTRAL';if(s.text!==text){s.text=text;s.span.textContent=text;s.measure=true;}
   if(s.hidden&&s.measure)set(s,false,s.visibility);if(s.measure)measure=true;
  });
  // Pass 2: one batched read for changed labels only.
  if(measure)for(const s of state)if(s.measure&&!s.off&&!s.hidden){s.w=s.el.offsetWidth;s.h=s.el.offsetHeight;s.measure=false;}
  // Pass 3: placement and position writes. A silo under a panel, the message plate or a HUD root (its anchor inside one) gets no
  // label: a label parked beside the panel would point at nothing the player can see. The other silos' KEEP boxes steer placement
  // only; they do not stop leaders.
  for(const s of state)if(!s.off){const k=s.keep,ax=Math.round(s.x),ay=Math.round(s.y+11);k.left=ax-KEEP;k.right=ax+KEEP;k.top=ay-KEEP;k.bottom=ay+KEEP;}
  for(const s of state){
   if(s.off){set(s,true,'offscreen');continue;}
   const ax=Math.round(s.x),ay=Math.round(s.y+11);let under=false;for(const b of fixed)if(inside(ax,ay,b)){under=true;break;}if(under){set(s,true,'covered');continue;}
   avoid.length=0;for(const b of placed)avoid.push(b);for(const o of state)if(o!==s&&!o.off)avoid.push(o.keep);
   const position=s.w&&s.h?siloLabelPosition(s.x,s.y,s.w,s.h,view,avoid):null;if(!position){set(s,true,'crowded');continue;}
   // On a narrow screen the only free spot can be on the far side of a full-width plate (the message plate), far from the silo
   // with a leader that would stop at the plate, or far across the map past other islands: no label then. A shown label keeps
   // its spot up to LONG+6 px so it does not blink at the limit.
   if(view.width<600){let across=Math.hypot(ax-position.x,ay-position.y+NOTCH)>(s.visibility==='visible'?LONG+6:LONG);for(const b of fixed){if(across)break;if(segmentEnter(position.x,position.y-NOTCH,ax-position.x,ay-position.y+NOTCH,b)<1)across=true;}if(across){set(s,true,'crowded');continue;}}
   set(s,false,'visible');const left=Math.round(position.x),top=Math.round(position.y);if(s.left!==left){s.left=left;s.el.style.left=left+'px';}if(s.top!==top){s.top=top;s.el.style.top=top+'px';}
   const anchor=ax+','+ay;if(s.anchor!==anchor){s.anchor=anchor;s.el.dataset.anchorX=ax;s.el.dataset.anchorY=ay;}
   s.ax=ax;s.ay=ay;s.box=placed.length;placed.push({left:position.x-s.w/2,right:position.x+s.w/2,top:position.y-s.h,bottom:position.y});
  }
  // Pass 4: leaders, once every label is placed. A leader runs from the notch tip and stops 2px short of the first box it would
  // run into (a HUD root, a panel, the message plate, the fighter or another label) instead of drawing across it.
  for(const s of state){
   if(s.visibility!=='visible')continue;const y0=s.top-NOTCH,dx=s.ax-s.left,dy=s.ay-y0,full=Math.hypot(dx,dy);let t=1;
   for(let k=0;k<placed.length;k++)if(k!==s.box){const e=segmentEnter(s.left,y0,dx,dy,placed[k]);if(e<t)t=e;}
   const line=Math.round(t<1?Math.max(0,t*full-2):full)+'px '+Math.atan2(-dx,dy).toFixed(3)+'rad';if(s.line!==line){s.line=line;const [length,angle]=line.split(' ');s.el.style.setProperty('--silo-line-length',length);s.el.style.setProperty('--silo-line-angle',angle);}
  }
 }};
}
