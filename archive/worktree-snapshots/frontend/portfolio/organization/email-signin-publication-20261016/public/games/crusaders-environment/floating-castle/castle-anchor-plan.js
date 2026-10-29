import {profile,containsCell,cellPosition,MAX_PARTS} from './castle-rules.js';
import {protectorLimit} from './castle-protectors.js';
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
