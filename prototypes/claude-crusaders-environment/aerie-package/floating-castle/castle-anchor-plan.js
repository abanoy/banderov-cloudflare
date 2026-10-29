import {profile,containsCell,cellPosition,MAX_PARTS} from './castle-rules.js';
import {protectorLimit} from './castle-protectors.js?v=aerie-20261018';
import {tierFortifications} from './castle-fortifications.js';
export function captureDesignSeed(timestamp=Date.now()){if(!Number.isSafeInteger(timestamp)||timestamp<0)throw Error('Invalid design timestamp.');return {timestamp,seed:((timestamp%2147483647)^Math.floor(timestamp/2147483647))>>>0};}
function generator(seed){let n=seed>>>0;return ()=>{n=(n+0x6d2b79f5)>>>0;let x=n;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};}
const key=p=>p.x+':'+p.z,dirs=[[0,-1],[-1,0],[0,1],[1,0]],copy=p=>({...p});
// Match stable Array.sort priority ordering, including insertion order for ties.
// This keeps seeded corridors identical while avoiding a full sort on every pop.
class StableFrontier{
 constructor(first){this.items=[];this.order=0;this.push(first);}
 get length(){return this.items.length;}
 less(a,b){return a.value.f<b.value.f||(a.value.f===b.value.f&&a.order<b.order);}
 push(value){const item={value,order:this.order++},q=this.items;let i=q.length;q.push(item);while(i){const parent=(i-1)>>1;if(!this.less(item,q[parent]))break;q[i]=q[parent];i=parent;}q[i]=item;}
 pop(){const q=this.items,first=q[0],last=q.pop();if(q.length){let i=0;while(i*2+1<q.length){let child=i*2+1;if(child+1<q.length&&this.less(q[child+1],q[child]))child++;if(!this.less(q[child],last))break;q[i]=q[child];i=child;}q[i]=last;}return first.value;}
}
/** Pinpoints are immutable inputs. Layout search may reject them, never move them. */
export function chooseCastleAnchors({level=100,seed=0}={}){
 const c=profile({level}),rand=generator(seed),top=Math.max(1,Math.ceil(level/10)-1),roll=(lo,hi)=>lo+Math.floor(rand()*(hi-lo+1));
 const main={type:'core',x:roll(c.minX+2,c.maxX-3),z:roll(c.minZ+2,Math.max(c.minZ+2,c.maxZ-5)),layer:roll(1,top),rotation:0},protectors=[];
 for(let i=0;i<protectorLimit(level);i++){let found=null;for(let t=0;t<400;t++){const p={type:'protector',x:roll(c.minX+1,c.maxX-2),z:roll(c.minZ+1,c.maxZ-3),layer:roll(0,main.layer),rotation:0},d=Math.hypot(p.x-main.x,p.z-main.z);if(d<4.5||Math.hypot(p.x-8,p.z-10)<2||protectors.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<3.5))continue;
   // The large crown cradle needs the beam to arrive above its solid shoulder.
   if((main.layer-p.layer)*8>Math.max(0,(d*8/14-1)*12))continue;found=p;break;}if(!found)throw Error('This anchor seed has insufficient separated beam space.');protectors.push(found);}
 return {main,protectors,entrance:{x:8,z:10,layer:0},seed};
}
export function buildAnchoredCastle({level=100,seed=0,family='sanctuary',anchors=chooseCastleAnchors({level,seed})}={}){
 const c=profile({level}),rand=generator(seed+991),cells=new Map(),reserved=new Set(),routes=[],main=copy(anchors.main),pins=anchors.protectors.map(copy),all=[main,...pins];
 const put=(p,type=p.type)=>{if(!containsCell(p,c))throw Error('Anchor route left the plot.');cells.set(key(p),{x:p.x,z:p.z,layer:p.layer,rotation:p.rotation||0,type,solid:true});};
 put({x:8,z:9,layer:0,type:'terrace'});reserved.add('8:9');
 const forbidden=(x,z)=>Math.hypot(x-main.x,z-main.z)<2.2;
 // Beam corridors impose a height ceiling on terrain BEFORE paths are solved.
 function ceiling(x,z){let max=Infinity;for(const p of pins){const ax=p.x,az=p.z,dx=main.x-ax,dz=main.z-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-ax-dx*t,z-az-dz*t)>.72||t>.98)continue;const y=p.layer*8+3.5+(main.layer*8+15.156-p.layer*8-3.5)*t;max=Math.min(max,y-.5);}return max;}
 function allowed(x,z,h){if(x<=c.minX||x>=c.maxX-1||z<=c.minZ||z>=c.maxZ-1||!containsCell({x,z},c)||forbidden(x,z)||h*8>ceiling(x,z))return false;const pin=pins.find(p=>p.x===x&&p.z===z);if(pin&&pin.layer!==h)return false;const old=cells.get(x+':'+z);return !old||(old.layer===h&&old.type!=='stairs');}
 function connect(target,label){
  const start={x:8,z:10,layer:0},id=p=>key(p)+':'+p.layer,open=new StableFrontier({...start,cost:0,f:0}),best=new Map([[id(start),0]]),prior=new Map();let end=null,visited=0;
  while(open.length&&visited++<16000){const a=open.pop();if(a.cost!==best.get(id(a)))continue;if(a.x===target.x&&a.z===target.z&&a.layer===target.layer){end=a;break;}
   for(const [rotation,[dx,dz]] of dirs.entries())for(const rise of [0,1]){if(rise&&a.layer>=target.layer)continue;const steps=rise?2:1,x=a.x+dx*steps,z=a.z+dz*steps,h=a.layer+rise;if(h>target.layer||!allowed(x,z,h))continue;const stair=rise?{x:a.x+dx,z:a.z+dz,layer:a.layer,type:'stairs',rotation}:null;if(stair&&(!allowed(stair.x,stair.z,stair.layer)||cells.has(key(stair))||pins.some(p=>p.x===stair.x&&p.z===stair.z)))continue;
    let repeated=false;for(let ancestor=a;ancestor;ancestor=prior.get(id(ancestor))?.from){if((ancestor.x===x&&ancestor.z===z&&ancestor.layer!==h)||(stair&&ancestor.x===stair.x&&ancestor.z===stair.z)){repeated=true;break;}const priorStair=prior.get(id(ancestor))?.stair;if(priorStair&&((priorStair.x===x&&priorStair.z===z)||(stair&&priorStair.x===stair.x&&priorStair.z===stair.z))){repeated=true;break;}}if(repeated)continue;
    const cost=a.cost+steps+(rise?.15:0)+((Math.imul(x+71,73856093)^Math.imul(z+71,19349663)^seed)>>>0)%19*.009, b={x,z,layer:h,cost};if(cost>=(best.get(id(b))??Infinity))continue;best.set(id(b),cost);prior.set(id(b),{from:a,stair});b.f=cost+Math.max(Math.abs(target.x-x)+Math.abs(target.z-z),2*(target.layer-h));open.push(b);}
  }
  if(!end)throw Error(label+' has no compatible stair corridor through these anchor positions.');const path=[];for(let p=end;id(p)!==id(start);){const step=prior.get(id(p));path.push({...p,type:'terrace'});if(step.stair)path.push(step.stair);p=step.from;}path.push({...start,type:'terrace'});path.reverse();for(const p of path){put(p);reserved.add(key(p));}routes.push({label,pin:copy(target),points:path.map(cellPosition)});
 }
 // An approach lies outside the crown's genuine 13.5m cradle.
 const sides=dirs.map(([dx,dz])=>({x:main.x+dx*3,z:main.z+dz*3,layer:main.layer})).filter(p=>containsCell(p,c));sides.sort((a,b)=>Math.hypot(a.x-8,a.z-10)-Math.hypot(b.x-8,b.z-10));connect(sides[0],'Main crown approach');
 for(const [i,p] of pins.entries()){const approaches=dirs.map(([dx,dz])=>({x:p.x+dx,z:p.z+dz,layer:p.layer})).filter(q=>containsCell(q,c)&&!forbidden(q.x,q.z));approaches.sort((a,b)=>Math.hypot(a.x-8,a.z-10)-Math.hypot(b.x-8,b.z-10));let success=false;for(const q of approaches){try{connect(q,'Protector '+(i+1));success=true;break;}catch{}}if(!success)throw Error('Protector '+(i+1)+' cannot be reached at its fixed height.');if(cells.has(key(p))&&cells.get(key(p)).layer!==p.layer)throw Error('A route would bury a fixed protector.');put(p);reserved.add(key(p));}
 // Broad solid wards grow from anchors and successful routes, respecting every
 // pinned height and beam corridor. No support-post tower-stack architecture.
 for(const pin of all){const radius=2;for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){const p={x:pin.x+dx,z:pin.z+dz,layer:pin.layer,type:'terrace'};if(!containsCell(p,c)||cells.has(key(p))||p.layer*8>ceiling(p.x,p.z))continue;if(all.some(a=>a!==pin&&Math.hypot(p.x-a.x,p.z-a.z)<2))continue;put(p);}}
 const spine=[...cells.values()];for(const p of spine)if(p.type==='terrace'&&rand()<.8)for(const [dx,dz] of dirs){const q={...p,x:p.x+dx,z:p.z+dz};if(allowed(q.x,q.z,q.layer)&&!cells.has(key(q))&&!all.some(a=>Math.hypot(q.x-a.x,q.z-a.z)<2))put(q);}
 // Explicit connected courtyard: no unused tile gains an invisible floor.
 // Leave an outer grid row for quays; solid upper wards remain pinned to routes.
 for(let x=c.minX+1;x<c.maxX-1;x++)for(let z=c.minZ+1;z<c.maxZ-1;z++)if(!cells.has(x+':'+z))put({x,z,layer:0,type:'terrace'});
 const portSides=[0,1,2,3].sort(()=>rand()-.5),ports=[];
 const desired=1+Math.floor(rand()*4);
 for(const side of portSides){if(ports.length===desired)break;const [dx,dz]=dirs[side],choices=[];
  for(const p of cells.values())if(p.layer===0&&p.type==='terrace'&&!reserved.has(key(p))&&!all.some(a=>Math.hypot(a.x-p.x,a.z-p.z)<3)){
   if(side===0&&p.z!==c.minZ+1||side===1&&p.x!==c.minX+1||side===2&&p.z!==c.maxZ-2||side===3&&p.x!==c.maxX-2)continue;
   if(side===2&&Math.abs(p.x-8)<4)continue;const tangent=[-dz,dx],length=rand()<.55?3:2,strip=[];
   for(let n=0;n<length;n++){const q={x:p.x+dx+tangent[0]*n,z:p.z+dz+tangent[1]*n,layer:0,type:'deck',rotation:side},inward=cells.get((q.x-dx)+':'+(q.z-dz));if(!containsCell(q,c)||!inward||inward.layer||reserved.has(key(inward))||all.some(a=>Math.hypot(a.x-inward.x,a.z-inward.z)<3)){strip.length=0;break;}strip.push(q);}
   if(strip.length)choices.push(strip);
  }
  if(!choices.length)continue;const strip=choices[Math.floor(rand()*choices.length)];for(const q of strip){put(q);const inward=cells.get((q.x-dx)+':'+(q.z-dz));reserved.add(key(inward));reserved.add(key(q));}ports.push({side,length:strip.length,cells:strip.map(copy)});
 }
 if(!ports.length)throw Error('No edge port has a clear connected boarding court.');
 // Curtain tiles follow the built court boundary; never form a detached wall ring.
 for(const p of cells.values())if(p.layer===0&&p.type==='terrace'&&!reserved.has(key(p))&&ceiling(p.x,p.z)>8){
  const side=p.z===c.minZ+1?0:p.x===c.minX+1?1:p.z===c.maxZ-2?2:p.x===c.maxX-2?3:-1;
  if(side>=0){p.type='wall';p.rotation=side%2;}
 }
 put({...anchors.entrance,type:'gate',rotation:0});put({x:8,z:11,layer:0,type:'terrace'});reserved.add('8:11');
 // Seeded arrival courts belong to checked routes, not arbitrary empty air.
 const spawnCells=[...cells.values()].filter(p=>p.type==='terrace'&&reserved.has(key(p))&&all.every(a=>Math.hypot(a.x-p.x,a.z-p.z)>2.5));
 for(let i=spawnCells.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[spawnCells[i],spawnCells[j]]=[spawnCells[j],spawnCells[i]];}
 const spawns=[];for(const p of spawnCells){if(spawns.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<3))continue;p.type='spawn';spawns.push(copy(p));if(spawns.length===3)break;}
 if(!spawns.length)throw Error('No separated arrival court is reachable.');
 // Trees/houses earn composition credit only beside usable courts. Keep ramps,
 // arrivals, protectors and the actual beam corridor free of decoration.
 for(const p of cells.values())if(p.type==='terrace'&&!reserved.has(key(p))&&!all.some(a=>Math.hypot(p.x-a.x,p.z-a.z)<3)&&routes.every(r=>r.points.every(q=>Math.hypot(q.x-cellPosition(p).x,q.z-cellPosition(p).z)>12))){
  const r=rand();if(p.layer*8+6>ceiling(p.x,p.z))continue;
  p.type=r<.06?'house':r<.15?'garden':r<.21?(family==='rampart'?'heavyCannon':'cannon'):r<.23?'beacon':'terrace';
  if(['cannon','heavyCannon'].includes(p.type)){const edges=[p.z-c.minZ,p.x-c.minX,c.maxZ-1-p.z,c.maxX-1-p.x];p.rotation=edges.indexOf(Math.min(...edges));}
 }
 // A seeded beginner fortress still needs an operable battery. Replace a free
 // curtain slot, not a route, tree, house, arrival court or boarding deck.
 if(![...cells.values()].some(p=>['cannon','heavyCannon','beacon'].includes(p.type))){
  const candidates=[...cells.values()].filter(p=>p.type==='wall'&&!reserved.has(key(p))&&p.layer*8+6<=ceiling(p.x,p.z)&&all.every(a=>Math.hypot(a.x-p.x,a.z-p.z)>=3));
  if(!candidates.length)throw Error('No free outward curtain slot can support a starter battery.');
  const p=candidates[Math.floor(rand()*candidates.length)];p.type='cannon';
  const edges=[c.maxZ-1-p.z,c.maxX-1-p.x,p.z-c.minZ,p.x-c.minX];p.rotation=edges.indexOf(Math.min(...edges));
 }
 for(const p of pins)put(p);put(main);
 const layout=[...cells.values()].map(p=>p.layer>0&&p.type!=='stairs'?{...p,fortified:true}:p);if(layout.length>MAX_PARTS)throw Error('Anchor castle exceeds the part budget.');
 let fortifications=tierFortifications(layout);
 // Reserve real clear ladder courts before rejecting a raised ward for access.
 // Decoration and spare floor batteries can yield to circulation; pinned cores cannot.
 for(const layer of fortifications.levels)if(fortifications.ladders.filter(e=>e.layer===layer).length<2){
  const edges=fortifications.edges.filter(e=>e.layer===layer&&!e.gate&&!e.stairPassage);
  for(const e of edges){const [dx,dz]=[[0,-1],[-1,0],[0,1],[1,0]][e.side],p=layout.find(p=>p.layer===layer&&p.x===e.x-dx*.5&&p.z===e.z-dz*.5);if(!p||!['garden','house','cannon','heavyCannon','beacon'].includes(p.type)||layout.some(q=>q.type==='stairs'&&q.layer===layer&&Math.hypot(q.x-p.x,q.z-p.z)<1.25))continue;p.type='terrace';p.accessCourt=true;fortifications=tierFortifications(layout);if(fortifications.ladders.filter(e=>e.layer===layer).length>=2)break;}
 }
if(fortifications.levels.some(layer=>fortifications.ladders.filter(g=>g.layer===layer).length<2))throw Error('A raised ward needs two clear ladder courts. Choose another anchor arrangement.');if(fortifications.levels.some(layer=>!fortifications.gates.some(g=>g.layer===layer)))throw Error('A raised ward has no stair-aligned gatehouse. Choose another anchor arrangement.');
 return {layout,anchors:JSON.parse(JSON.stringify(anchors)),routes,ports,spawns,profile:c,name:'Pinpoint '+family+' '+(seed%997),objectives:[],architecture:'Filled masonry courts, fitted curtain walls, edge quays and checked arrival courts'};
}
// ---- Composed castles: one deliberate axis instead of random pins ----
// The plot is mirror-symmetric about x=5.5 and grows two rows deeper per layer,
// so every tier steps up by its own axial flight. Seeds choose among grammar
// options (axis column, tier heights, widths, massing, dressing); they never
// scatter pieces. Clearances keep objects out of curtain-wall strips and their
// piers, tower corners, stair/landing/gate zones and the crown cradle.
const COMPOSED_NAMES={rampart:[['Iron','Border','Storm','March','High'],['Bastion','Rampart','Bulwark','Battery','Citadel']],sanctuary:[['Cloister','Garden','Crown','Quiet','White'],['Sanctuary','Terraces','Refuge','Courts','Reliquary']],skyharbor:[['Cloud','Signal','Lantern','Trade','Sky'],['Harbor','Moorings','Quays','Anchorage','Port']]};
const OBJECT_HEIGHT={house:5.8,garden:5.4,armory:7,barracks:7,trebuchet:9.5,heavyCannon:4.5,cannon:4,beacon:6.6,spawn:.5,protector:5,core:0};
const STEP_ROWS=j=>2*j;
function tierLadders(T){
 // Compositions of T-1 into jumps of one to three layers, few tiers for big castles.
 const out=[];(function walk(rest,parts){if(!rest){out.push(parts);return;}for(const j of [1,2,3])if(j<=rest)walk(rest-j,[...parts,j]);})(T-1,[]);
 const ideal=T<=2?T-1:T<=4?2:T<=6?2:T<=8?3:4;return out.filter(p=>Math.abs(p.length-ideal)<=1&&p.filter(j=>j===1).length<=Math.max(1,Math.floor(p.length/2))).sort((a,b)=>Math.abs(a.length-ideal)-Math.abs(b.length-ideal));
}
// Drafts from the composer leave ROOM of the MAX_PARTS budget free for the
// player (the Workshop's 40 free pieces): the widest plots start the castle one
// row in from the back edge, and any composition still over budget moves in again.
const ROOM=40;
function composedPlan({level,seed,family,goal,inset=0}){
 const c=profile({level}),rand=generator((Math.imul((seed>>>0)+1,2654435761)^0x6a09e667)>>>0),pick=list=>list[Math.floor(rand()*list.length)];
 const X0=c.minX,X1=c.maxX-1,Z0=c.minZ+inset,band=Math.ceil(level/10),T=Math.max(1,band-1),A=c.size===10?6:rand()<.5?5:6,w1=Math.min(A-X0,X1-A)-1;
 // Height is a grammar choice too: big plots climb about half their allowed
 // layers so every tier keeps a real court instead of a stack of ramparts.
 const H=T<=2?T:Math.max(2,Math.min(T,Math.round(1.5+T*.45)+pick([-1,0,0,1]))),style=H<2?'keep':pick(['nested','nested','terraced','citadel']),protectors=protectorLimit(level),odd=protectors%2;
 // ---- massing: tiers as mirror-symmetric rectangles sharing the main axis ----
 let ladders=H>1?tierLadders(H):[[]];ladders=ladders.length?ladders:[[...Array(H-1)].map(()=>1)];
 // Guardians must see the crown: with several of them the keep sits one short
 // flight above its forecourt, so the tier below can hold pylons too.
 const keepMinW=protectors>=4?4:3,order=ladders.map((p,i)=>({p,r:rand()+i*.08+(protectors>=3&&p.length&&p.at(-1)>1?(p.at(-1)-1)*.6:0)})).sort((a,b)=>a.r-b.r).map(o=>o.p);
 let tiers=null;
 for(const jumps of order){
  const K=jumps.length+1,layers=[1];for(const j of jumps)layers.push(layers.at(-1)+j);
  const widths=[w1];let ok=true;
  for(let i=0;i<jumps.length;i++){const left=K-1-i,minNext=keepMinW,room=widths[i]-keepMinW;
   const preferred=style==='terraced'?pick([0,1,1]):style==='citadel'?pick([2,3]):pick([2,2,3]),share=Math.floor(room/Math.max(1,left));
   let s=Math.max(0,Math.min(preferred,share,widths[i]-minNext));if(widths[i]<keepMinW){ok=false;break;}widths.push(widths[i]-s);}
  if(!ok||widths.at(-1)<keepMinW)continue;
  const keepNeed=6+(odd||protectors>=6?2:0),fixed=jumps.reduce((s,j)=>s+STEP_ROWS(j),0),nest=[...jumps.map((_,i)=>style==='citadel'||style==='nested'&&i===0&&rand()<.5?1:0)];
  while(nest.some(Boolean)&&8-Z0-nest.reduce((a,b)=>a+b,0)-keepNeed-fixed<0)nest[nest.lastIndexOf(1)]=0;
  const backs=[Z0];for(let i=0;i<jumps.length;i++)backs.push(backs[i]+nest[i]);const spare=8-backs.at(-1)-keepNeed-fixed;if(spare<0)continue;
  // Extra rows deepen the bailey forecourt first, then one keep row, then middle courts.
  const extra=jumps.map(()=>0);let left=spare;
  if(jumps.length){const bailey=Math.min(left,Math.max(1,Math.ceil(spare*.45)));extra[0]+=bailey;left-=bailey;}
  if(left>0&&!odd)left--;
  for(let i=0;left>0&&jumps.length>1;i++,left--)extra[1+i%(jumps.length-1)]++;
  if(jumps.length===1)extra[0]+=left;
  const fronts=[7];for(let i=0;i<jumps.length;i++)fronts.push(fronts[i]-STEP_ROWS(jumps[i])-extra[i]);
  tiers=layers.map((layer,i)=>({i,layer,w:widths[i],front:fronts[i],back:backs[i],jump:jumps[i]||0}));break;
 }
 if(!tiers)throw Error('No tier composition fits this plot.');
 const K=tiers.length,keep=tiers[K-1],cells=new Map(),k3=(x,z,l)=>x+':'+z+':'+l,col=(x,z)=>x+':'+z;
 const at=(x,z,l)=>cells.get(k3(x,z,l)),inTier=(t,x,z)=>t&&x>=A-t.w&&x<=A+t.w&&z>=t.back&&z<=t.front;
 const put=(x,z,layer,type,extra={})=>{if(!containsCell({x,z},c))throw Error('Composed piece left the plot.');const k=k3(x,z,layer);if(cells.has(k))throw Error('Composed pieces overlap at '+k+'.');const p={x,z,layer,type,rotation:extra.rotation||0,solid:true};if(extra.fortified)p.fortified=true;cells.set(k,p);return p;};
 // Step blocks: every climb is one straight flight on the axis. A climb of
 // several layers gets a landing per layer, with the lower stairs cut into a
 // solid three-wide stair bastion; the top stair always enters a gatehouse.
 const stepCells=new Map(),stairCells=[],landings=new Set(),approaches=new Set();
 for(let i=0;i<K-1;i++){const lo=tiers[i],hi=tiers[i+1],j=lo.jump,F=hi.front;
  for(let m=0;m<j;m++){const layer=lo.layer+j-1-m,row=F+1+2*m;stepCells.set(col(A,row),{type:'stairs',layer,rotation:0});
   if(m===0){if(j>1)for(const s of [-1,1])stepCells.set(col(A+s,row),{type:'terrace',layer,landing:true});}
   else for(const s of [-1,1])stepCells.set(col(A+s,row),{type:'terrace',layer:layer+1,landing:true});
   if(m<j-1)for(let x=-1;x<=1;x++)stepCells.set(col(A+x,row+1),{type:'terrace',layer,landing:true});}
  approaches.add(col(A,F+2*j));}
 // Forecourt, front curtain with the fixed gate, apron and quays.
 const quayRows=family==='skyharbor'?[8,9,10]:[8,9],ports=[];
 // The forecourt runs between quays on the two plot edges, clear of the fixed skyport islets.
 for(let x=X0+1;x<=X1-1;x++)for(const z of [8,9])if(!(x===A&&z===8))put(x,z,0,'terrace');
 put(A,8,0,'stairs',{rotation:0});approaches.add(col(A,9));
 for(let x=X0+1;x<=X1-1;x++)if(x!==8)put(x,10,0,'wall',{rotation:2});
 put(8,10,0,'gate');put(8,11,0,'terrace');
 // On small plots the east quay ends at row 8: the fixed skyport kiosk stands at x 11-12.3, z 8.8-9.7.
 for(const s of [-1,1]){const x=s<0?X0:X1,strip=quayRows.map(z=>put(x,s>0&&X1<=13?z-quayRows.length+1:z,0,'deck',{rotation:s<0?1:3}));ports.push({side:s<0?1:3,length:strip.length,cells:strip.map(p=>({...p}))});}
 // Courts: each tier fills its rectangle minus the tier above it and the step blocks.
 for(const t of tiers){const up=tiers[t.i+1];for(let x=A-t.w;x<=A+t.w;x++)for(let z=t.back;z<=t.front;z++){if(inTier(up,x,z))continue;const s=stepCells.get(col(x,z));
  if(s){const p=put(x,z,s.layer,s.type,{rotation:s.rotation||0});if(s.type==='stairs')stairCells.push(p);else landings.add(k3(x,z,s.layer));continue;}
  put(x,z,t.layer,'terrace',{fortified:true});}}
 stairCells.push(at(A,8,0));
 // A stair's side neighbours stay plain retaining terrace: a derived curtain
 // there would wall in the ramp. Its own lower entry keeps the stair portal.
 for(const s of stairCells){const [dx,dz]=dirs[s.rotation];for(const [nx,nz] of [[s.x+1,s.z],[s.x-1,s.z],[s.x,s.z+1],[s.x,s.z-1]]){if(nx===s.x-dx&&nz===s.z-dz)continue;for(const p of cells.values())if(p.x===nx&&p.z===nz&&p.layer<=s.layer&&p.fortified)delete p.fortified;}}
 const core=at(A,keep.front-3,keep.layer);core.type='core';
 // Derived walls decide where objects may stand.
 const structure=()=>[...cells.values()];let fort=tierFortifications(structure());
 const dirsXZ=dirs,edgeCell=new Set(),pierCell=new Set(),towerCell=new Set(),gateZone=new Set(),stairZone=new Set(),reserved=new Set();
 function zones(){edgeCell.clear();pierCell.clear();towerCell.clear();gateZone.clear();
  for(const e of fort.edges){const [dx,dz]=dirsXZ[e.side];edgeCell.add(k3(e.x-dx*.5,e.z-dz*.5,e.layer));pierCell.add(col(e.x+dx*.5,e.z+dz*.5));if(e.gate)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)gateZone.add(col(e.x-dx*.5+a,e.z-dz*.5+b));}
  for(const t of fort.towers)for(const sx of [-.5,.5])for(const sz of [-.5,.5])towerCell.add(col(t.x+sx,t.z+sz));}
 zones();
 for(const s of stairCells){const [dx,dz]=dirs[s.rotation];for(const [x,z] of [[s.x,s.z],[s.x-dx,s.z-dz],[s.x+dx,s.z+dz]])for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)stairZone.add(col(x+a,z+b));}
 for(const k of landings){const [x,z]=k.split(':').map(Number);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)stairZone.add(col(x+a,z+b));}
 // The procession: forecourt bend from the gate to the axis, then every gate
 // landing straight up the axis to its next step block or to the crown court.
 for(let x=Math.min(A,8);x<=Math.max(A,8);x++)reserved.add(col(x,9));for(const k of approaches)reserved.add(k);
 for(const t of tiers){const up=tiers[t.i+1],stop=up?up.front+STEP_ROWS(t.jump)+1:core.z+2;for(let z=t.front;z>=stop;z--)reserved.add(col(A,z));}
 const free=(x,z,layer,{edge=false}={})=>{const p=at(x,z,layer);if(!p||p.type!=='terrace'||landings.has(k3(x,z,layer)))return false;if(at(x,z,layer+1))return false;const k=col(x,z);
  if(reserved.has(k)||stairZone.has(k)||gateZone.has(k)||towerCell.has(k)||(!edge&&(edgeCell.has(k3(x,z,layer))||pierCell.has(k))))return false;
  if(Math.hypot(x-core.x,z-core.z)<2||Math.abs(x-core.x)<=1&&z>core.z&&z<=keep.front)return false;return true;};
 const pairs=(t,filter=()=>true)=>{const out=[];for(let z=t.front;z>=t.back;z--)for(let d=1;d<=t.w;d++)if(free(A-d,z,t.layer)&&free(A+d,z,t.layer)&&filter(A-d,z))out.push({z,d,t});return out;};
 const claim=(x,z,layer,type,rotation=0)=>{const p=at(x,z,layer);p.type=type;p.rotation=rotation;reserved.add(col(x,z));return p;};
 // ---- protectors: mirror pairs (and one on the axis behind the crown) with
 // analytic beam clearance over the derived walls, towers and courts ----
 const heart=[core.x*8,core.layer*8+15.156,core.z*8],NONE=[];
 // Beam samples read a column-top index and walls/towers binned by cell, built
 // once per claim; each candidate cell's verdict is remembered until the next claim.
 let beamIndex=null;const beamMemo=new Map();
 function indexBeams(){const tops=new Map(),walls=new Map(),towers=new Map(),bin=(m,x,z,v)=>{const k=Math.floor(x)+':'+Math.floor(z);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(v);};
  for(const q of cells.values())if(q.solid){const k=col(q.x,q.z),h=q.layer+(q.type==='stairs'?1:0),o=tops.get(k);if(!o)tops.set(k,{top:h,own:null});else if(h>o.top)o.top=h;}
  for(const q of cells.values()){const o=tops.get(col(q.x,q.z));if(o&&!o.own&&q.layer===o.top)o.own=q;}
  for(const e of fort.edges)bin(walls,e.x,e.z,e);for(const t of fort.towers)bin(towers,t.x,t.z,t);beamIndex={tops,walls,towers};}
 function beamClear(p){if(!beamIndex)indexBeams();const {tops,walls,towers}=beamIndex,from=[p.x*8,p.layer*8+3.5,p.z*8],d=heart.map((v,i)=>v-from[i]),len=Math.hypot(...d),far=len-8.5;
  for(let s=1.2;s<far;s+=.5){const t=s/len,x=from[0]+d[0]*t,y=from[1]+d[1]*t,z=from[2]+d[2]*t,cx=Math.round(x/8),cz=Math.round(z/8),column=tops.get(col(cx,cz)),top=column?column.top:-1;
   if(y<top*8+.9)return false;const own=column?.own;if(own&&OBJECT_HEIGHT[own.type]!==undefined&&!(own.x===p.x&&own.z===p.z)&&own.type!=='core'&&Math.hypot(x-cx*8,z-cz*8)<3.6&&y<top*8+OBJECT_HEIGHT[own.type]+.6)return false;
   const gx=x/8,gz=z/8,fx=Math.floor(gx),fz=Math.floor(gz);
   for(let a=fx-1;a<=fx+1;a++)for(let b=fz-1;b<=fz+1;b++){const k=a+':'+b;for(const e of walls.get(k)||NONE){const u=e.side%2===0?gx-e.x:gz-e.z,v=e.side%2===0?gz-e.z:gx-e.x;if(Math.abs(u)<=.62&&Math.abs(v)<=.36&&y<e.layer*8+(e.gate?9:5.6))return false;}
    for(const tw of towers.get(k)||NONE)if(Math.hypot(gx-tw.x,gz-tw.z)<.42&&y<tw.layer*8+7.5)return false;}}
  return true;}
 const chosen=[];
 if(protectors){const candidates=[];
  for(const t of tiers)for(const pr of pairs(t)){const a={x:A-pr.d,z:pr.z,layer:t.layer},b={x:A+pr.d,z:pr.z,layer:t.layer};if(Math.hypot(a.x-core.x,a.z-core.z)<2.5||!free(a.x,a.z,a.layer)||pr.d<2)continue;candidates.push({cells:[a,b],tier:t.i,spread:Math.hypot(a.x-core.x,a.z-core.z)});}
  const axial=[];for(let z=core.z-3;z>=keep.back+1;z--)if(free(A,z,keep.layer))axial.push({cells:[{x:A,z,layer:keep.layer}],tier:K-1,spread:core.z-z});
  const ok=cand=>cand.cells.every(q=>{const k=k3(q.x,q.z,q.layer);let v=beamMemo.get(k);if(v===undefined)beamMemo.set(k,v=beamClear(q));return v;});
  // A claimed guardian keeps its court's outline, so the derived walls, towers
  // and gates (all that the beam test and clearances read) stay as they are.
  const wantPairs=Math.floor(protectors/2);let guard=0;
  while(chosen.length<wantPairs*2&&guard++<40){const taken=chosen.map(p=>p),usedTiers=new Set(chosen.map(p=>tiers.findIndex(t=>t.layer===p.layer)));
   const options=candidates.filter(cand=>cand.cells.every(q=>taken.every(p=>Math.hypot(p.x-q.x,p.z-q.z)>=2))).map(cand=>({cand,score:(usedTiers.has(cand.tier)?0:6)+Math.min(8,cand.spread)+(taken.length?Math.min(...cand.cells.flatMap(q=>taken.map(p=>Math.hypot(p.x-q.x,p.z-q.z))))*.6:0)+rand()*2.5})).sort((a,b)=>b.score-a.score);
   const hit=options.find(o=>ok(o.cand));if(!hit)break;for(const q of hit.cand.cells){chosen.push(q);claim(q.x,q.z,q.layer,'protector');}beamIndex=null;beamMemo.clear();}
  if(odd){const single=[...axial,...candidates.flatMap(cand=>cand.cells.map(q=>({cells:[q],tier:cand.tier,spread:cand.spread})))].filter(cand=>cand.cells.every(q=>free(q.x,q.z,q.layer)&&chosen.every(p=>Math.hypot(p.x-q.x,p.z-q.z)>=2))).find(ok);if(single){const q=single.cells[0];chosen.push(q);claim(q.x,q.z,q.layer,'protector');}}
  if(chosen.length!==protectors)throw Error('No clear mirrored protector arrangement for this composition.');
  let sum=0,n=0;for(let i=0;i<chosen.length;i++)for(let j=0;j<i;j++){sum+=Math.hypot(chosen[i].x-chosen[j].x,chosen[i].layer-chosen[j].layer,chosen[i].z-chosen[j].z)*8;n++;}if(protectors>=3&&sum/n<27)throw Error('Composed guardians stand too close together.');}
 // Objects may not stand in the beam corridors either.
 const beamCells=new Set();for(const p of chosen){const from=[p.x,p.z],to=[core.x,core.z];for(let s=0;s<=1;s+=.02)beamCells.add(col(Math.round(from[0]+(to[0]-from[0])*s),Math.round(from[1]+(to[1]-from[1])*s)));}
 const placeable=(x,z,layer)=>free(x,z,layer)&&!beamCells.has(col(x,z));
 // ---- service halls, arrival courts, dwellings, gardens and engines ----
 const bailey=tiers[0],objects=[];
 const pairOn=(t,want,{door=false,minD=2,maxD=99,prefer='front'}={})=>{const list=[];for(let z=t.front;z>=t.back;z--)for(let d=minD;d<=Math.min(maxD,t.w);d++){if(!placeable(A-d,z,t.layer)||!placeable(A+d,z,t.layer))continue;if(door&&!(at(A-d,z+1,t.layer)?.type==='terrace'&&at(A+d,z+1,t.layer)?.type==='terrace'&&!stairZone.has(col(A-d,z+1))))continue;list.push({z,d});}
  list.sort((a,b)=>prefer==='front'?b.z-a.z||a.d-b.d:prefer==='wide'?b.d-a.d||b.z-a.z:a.z-b.z||a.d-b.d);return list.slice(0,want);};
 // Halls belong to the lowest court with room, close to the procession.
 let service=null,svcTier=null;for(const t of tiers){service=pairOn(t,1,{door:true,minD:2,maxD:t===keep?99:4})[0];if(service){svcTier=t;break;}}if(!service)throw Error('No mirrored court for the armory and recruitment hall.');
 const armorySide=rand()<.5?-1:1;
 objects.push(claim(A+armorySide*service.d,service.z,svcTier.layer,'armory'),claim(A-armorySide*service.d,service.z,svcTier.layer,'barracks'));for(const s of [-1,1])reserved.add(col(A+s*service.d,service.z+1));
 // Arrival courts: a mirrored pair in the outer ward and a mirrored pair at the
 // two ends of the forecourt when both ends are clear (never a lone pad).
 const spawnPair=pairOn(bailey,4,{minD:2,prefer:'wide'}).find(o=>chosen.every(p=>Math.hypot(p.x-(A-o.d),p.z-o.z)>2.5));
 const spawns=[];if(spawnPair)for(const s of [-1,1])spawns.push(claim(A+s*spawnPair.d,spawnPair.z,bailey.layer,'spawn'));
 if([A-w1,A+w1].every(x=>at(x,8,0)?.type==='terrace'&&spawns.every(p=>Math.hypot(p.x-x,p.z-8)>=3)))for(const x of [A-w1,A+w1]){const p=at(x,8,0);p.type='spawn';spawns.push(p);}
 if(!spawns.length)throw Error('No arrival court.');
 // Dwellings line the middle of wide side arms in a regular rhythm.
 const dressing={rampart:{house:.35,garden:.2,engine:true},sanctuary:{house:.5,garden:.7,engine:false},skyharbor:{house:.5,garden:.35,engine:false}}[family]||{house:.4,garden:.4,engine:false};
 const gardenBias=goal==='beauty'?.3:goal==='defense'?-.25:0,engines=dressing.engine||goal==='defense';
 for(const t of tiers.slice(0,K-1)){const up=tiers[t.i+1],arm=t.w-up.w;if(arm<3||rand()>dressing.house+.35)continue;const d=up.w+Math.ceil(arm/2),rhythm=rand()<.5?2:3;
  for(let z=up.front-1;z>=t.back+1;z-=rhythm)if(placeable(A-d,z,t.layer)&&placeable(A+d,z,t.layer))for(const s of [-1,1])objects.push(claim(A+s*d,z,t.layer,'house',s<0?1:3));}
 // Lived-in courts: a larger castle always has at least one mirrored pair of dwellings, doors toward the axis.
 if(level>=30&&!objects.some(p=>p.type==='house'))for(const t of tiers.slice(0,Math.max(1,K-1))){const h=pairOn(t,1,{minD:3,prefer:'wide'})[0];if(h){for(const s of [-1,1])objects.push(claim(A+s*h.d,h.z,t.layer,'house',s<0?1:3));break;}}
 // Formal gardens flank the procession; engines take the broad outer corners.
 if(engines){const e=pairOn(bailey,1,{minD:Math.max(3,bailey.w-2),prefer:'front'})[0];if(e)for(const s of [-1,1])objects.push(claim(A+s*e.d,e.z,bailey.layer,'trebuchet',0));}
 for(const t of tiers){if(rand()>dressing.garden+gardenBias+.25)continue;const g=pairOn(t,2,{minD:2,maxD:3,prefer:t===keep?'back':'front'});for(const o of g.slice(0,t===keep?1:2))for(const s of [-1,1])objects.push(claim(A+s*o.d,o.z,t.layer,'garden'));}
 // Every castle mans a starter battery: a mirrored pair facing the arena, on the keep when it has room.
 const battery=family==='skyharbor'?'beacon':family==='rampart'||goal==='defense'?'heavyCannon':'cannon';
 for(const t of [keep,...tiers.slice(0,K-1).reverse()]){const b=pairOn(t,1,{minD:Math.max(2,t.w-1),prefer:'front'})[0]||pairOn(t,1,{minD:2,prefer:'front'})[0];if(b){for(const s of [-1,1])objects.push(claim(A+s*b.d,b.z,t.layer,battery,0));break;}}
 // Wall batteries in a regular rhythm along each tier's straight curtain runs.
 const every=family==='rampart'||goal==='defense'?3:4,edgeByCell=new Map();for(const e of fort.edges){const [dx,dz]=dirsXZ[e.side],k=k3(e.x-dx*.5,e.z-dz*.5,e.layer);edgeByCell.set(k,(edgeByCell.get(k)||0)+1);}
 for(const e of fort.edges){if(e.gate||e.stairPassage)continue;const [dx,dz]=dirsXZ[e.side],x=e.x-dx*.5,z=e.z-dz*.5,p=at(x,z,e.layer);if(!p||p.type!=='terrace'||edgeByCell.get(k3(x,z,e.layer))!==1)continue;
  const t=tiers.find(t=>t.layer===e.layer),along=e.side%2===0?Math.abs(x-A):t?t.front-z:z;if(along%every===every-1||(e.side%2===0&&along===0&&e.side===0))p.wallBattery=true;}
 // Clean-up: unflag fortified on non-walls, keep plain pieces explicit.
 const layout=[...cells.values()].map(p=>{const q={x:p.x,z:p.z,layer:p.layer,type:p.type,rotation:p.rotation||0};if(p.solid)q.solid=true;if(p.fortified&&p.layer>0)q.fortified=true;if(p.wallBattery)q.wallBattery=true;return q;});
 if(layout.length>MAX_PARTS-ROOM){if(inset<3)return composedPlan({level,seed,family,goal,inset:inset+1});throw Error('Composed castle exceeds the part budget.');}
 fort=tierFortifications(layout);
 if(fort.levels.some(layer=>fort.ladders.filter(g=>g.layer===layer).length<2))throw Error('A composed ward lacks two clear ladder courts.');
 if(fort.levels.some(layer=>!fort.gates.some(g=>g.layer===layer)))throw Error('A composed ward has no stair-facing gatehouse.');
 const names=COMPOSED_NAMES[family]||COMPOSED_NAMES.sanctuary,name=pick(names[0])+' '+pick(names[1]);
 const routePoints=[{x:8,z:11,layer:0},{x:8,z:9,layer:0},{x:A,z:9,layer:0}];for(const t of tiers){routePoints.push({x:A,z:t.front,layer:t.layer});}routePoints.push({x:A,z:core.z+2,layer:keep.layer});
 return {layout,anchors:{main:{type:'core',x:core.x,z:core.z,layer:core.layer,rotation:0},protectors:chosen.map(p=>({type:'protector',...p,rotation:0})),entrance:{x:8,z:10,layer:0},seed},routes:[{label:'Main procession',points:routePoints.map(cellPosition)}],ports,spawns:spawns.map(p=>({x:p.x,z:p.z,layer:p.layer,type:'spawn',rotation:p.rotation||0,solid:true})),profile:c,name,objectives:[],composed:true,composition:{axis:A,style,tiers:tiers.map(t=>({layer:t.layer,halfWidth:t.w,front:t.front,back:t.back,jump:t.jump})),family,goal},architecture:'One processional axis: forecourt gate, straight axial stairs with landings, stepped walled tiers and the keep with the crown'};
}
export function composeCastle({level=100,seed=0,family='sanctuary',goal='balanced'}={}){
 const inset=profile({level}).size>=28?1:0;let error;for(let i=0;i<6;i++){try{return composedPlan({level,seed:(seed+Math.imul(i,40503))>>>0,family,goal,inset});}catch(e){error=e;}}throw error;
}
