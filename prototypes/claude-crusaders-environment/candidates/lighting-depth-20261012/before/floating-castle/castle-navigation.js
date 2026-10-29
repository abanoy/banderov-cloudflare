import {inspectCastleFootprint} from './castle-footprint.js';
import * as T from '../vendor/three.module.js';
import {profile,footprint,cellPosition} from './castle-rules.js';
import {flightWorld} from './flight.js';

const BASE=.77,SPACING=2,DT=1/120,DIRS=[[1,0],[-1,0],[0,1],[0,-1]],WALKABLE=new Set(['floor','terrace','roundTerrace','gate','garden','cannon','heavyCannon','deck','battlement','beacon','protector','spawn']);
const key=p=>p.x+':'+p.z+':'+p.layer;
const point=p=>({x:p.x,y:p.y,z:p.z});
const cellAt=p=>({x:Math.round(p.x/8+5.5),z:Math.round((p.z+4)/8+5.5),layer:Math.max(0,Math.min(9,Math.round((p.y-BASE)/8)))});
const ascent=r=>[[0,-1],[-1,0],[0,1],[1,0]][r||0];

// Fast authoring hints are deliberately separate from physical route results.
export function structuralHints(layout,options){
 profile(options);const cells=new Map(layout.map(p=>[key(p),p])),issues=[];
 for(const p of layout)if(p.type==='stairs'&&p.layer<9){
  const [dx,dz]=ascent(p.rotation),cell={x:p.x+dx,z:p.z+dz,layer:p.layer+1},landing=cells.get(key(cell));
  if(!landing||(!WALKABLE.has(landing.type)&&landing.type!=='stairs'))issues.push({code:'missing-landing',severity:'hint',cell,message:'Stairs on layer '+(p.layer+1)+' may have no clear upper landing.',suggestion:'Add a floor at the highlighted cell on layer '+(cell.layer+1)+', then check routes.'});
 }
 for(const p of layout)if(p.type==='stairs'&&p.layer===9)issues.push({code:'top-stairs',severity:'hint',cell:{...p},message:'These stairs rise above the ten available layers.',suggestion:'Move the stairs down one layer, or replace them with a top-floor piece.'});
 const levels=[...new Set(layout.filter(p=>WALKABLE.has(p.type)&&p.layer>0).map(p=>p.layer))];
 for(const layer of levels)if(!layout.some(p=>p.type==='stairs'&&p.layer===layer-1))issues.push({code:'missing-stairs',severity:'hint',cell:{...layout.find(p=>p.layer===layer&&WALKABLE.has(p.type)),layer},message:'Layer '+(layer+1)+' has a floor but no stairs arriving from the layer below.',suggestion:'Add a stair ramp on layer '+layer+' and a clear upper landing. Check routes to confirm connectivity.'});
 issues.push(...inspectCastleFootprint(layout).issues.map(p=>({...p,severity:'hint',suggestion:'Join the wall to a court, or clear the dock-facing channel before checking routes.'})));
 return issues;
}
export const inspectStructure=structuralHints;

function derivedObjectives(layout){
 const floors=new Map(layout.filter(p=>p.layer>0&&['floor','terrace','roundTerrace','deck','battlement'].includes(p.type)).map(p=>[key(p),p])),visited=new Set(),out=[],round=p=>p.type==='roundTerrace'||p.footprint==='round';
 for(const p of floors.values())if(!visited.has(key(p))){
  const cluster=[],queue=[p];visited.add(key(p));
  // A rounded tile may only touch its neighbour at a point. Check that actual
  // destination independently instead of assuming a cell adjacency is a path.
  for(let i=0;i<queue.length;i++){const q=queue[i];cluster.push(q);for(const [dx,dz] of DIRS){const n=floors.get(key({x:q.x+dx,z:q.z+dz,layer:q.layer}));if(n&&!round(q)&&!round(n)&&!visited.has(key(n))){visited.add(key(n));queue.push(n);}}}
  out.push({id:'floor-'+out.length,label:'Layer '+(p.layer+1)+' floor area '+(out.length+1),...cellPosition(p),cell:{...p},cluster});
 }
 for(const p of layout)if(p.type==='stairs'){
  const [dx,dz]=ascent(p.rotation),c=cellPosition(p);out.push({id:'stairs-'+key(p),label:'Stair landing on layer '+(p.layer+2),x:c.x+dx*5,y:c.y+8,z:c.z+dz*5,stairLanding:true,cell:{x:p.x+dx,z:p.z+dz,layer:Math.min(9,p.layer+1)}});
 }
 for(const p of layout)if(['spawn','deck'].includes(p.type)){const c=cellPosition(p);out.push({id:p.type+'-'+key(p),label:p.type==='spawn'?'Arrival court':'Harbor boarding deck',...c,cell:{...p},cluster:[p]});}
 for(const [i,port] of inspectCastleFootprint(layout).ports.entries()){const [dx,dz]=ascent(port.rotation),cell=port.cells.reduce((a,b)=>b.x*dx+b.z*dz>a.x*dx+a.z*dz?b:a),c=cellPosition(cell);out.push({id:'port-approach-'+i,label:'Port '+(i+1)+' boarding approach',x:c.x+dx*2.5,y:c.y,z:c.z+dz*2.5,cell:{...cell}});}
 for(const p of layout)if(['cannon','heavyCannon','beacon'].includes(p.type)){const c=cellPosition(p);out.push({id:'defense-'+key(p),label:(p.type==='heavyCannon'?'Heavy battery':p.type==='beacon'?'Signal battery':'Cannon')+' access',...c,cell:{...p},cluster:[p]});}
 for(const p of layout)if(p.type==='protector'){const c=cellPosition(p);out.push({id:'protector-'+key(p),label:'Protector core access',x:c.x+3,y:c.y,z:c.z,cell:{...p},cluster:[p]});}
 out.unshift({id:'court',label:'Entrance court',x:20,y:BASE,z:28});
 return out;
}

class MinHeap{
 constructor(){this.items=[];}
 push(id,cost){const q=this.items,item={id,cost};q.push(item);let n=q.length-1;while(n){const parent=(n-1)>>1;if(q[parent].cost<=cost)break;q[n]=q[parent];n=parent;}q[n]=item;}
 pop(){const q=this.items,first=q[0],last=q.pop();if(q.length){let n=0;while(n*2+1<q.length){let child=n*2+1;if(child+1<q.length&&q[child+1].cost<q[child].cost)child++;if(q[child].cost>=last.cost)break;q[n]=q[child];n=child;}q[n]=last;}return first;}
 get size(){return this.items.length;}
}

/** Inspect isolated, castle-local preview geometry. Never mutates the map or draft.
 * The caller owns preview.dispose(), including when this promise is aborted.
 * Navigation is conservatively sampled at 2 m. Successful routes are subsequently
 * walked out and back using the unchanged game physics at 120 Hz, without jumps.
 */
export async function inspectCastle(preview,layout,options,settings={}){
 const started=performance.now(),config=profile(options),bounds=footprint(config),issues=[],routes=[],stats={nodes:0,seconds:0,steps:0,tested:0,passed:0,total:0,spacing:SPACING,fixedStep:DT};
 const {signal,onProgress}=settings;let lastYield=started;
 function abort(){if(signal?.aborted){const error=new Error('Route check cancelled.');error.name='AbortError';throw error;}}
 async function breathe(phase,completed,total){abort();if(performance.now()-lastYield>14){onProgress?.({phase,completed,total,message:phase==='sampling'?'Reading walkable surfaces':phase==='pathfinding'?'Finding castle routes':'Walking routes in both directions'});await new Promise(resolve=>setTimeout(resolve,0));lastYield=performance.now();abort();}}
 abort();preview.root.updateMatrixWorld(true);
 // The broad phase only selects nearby members of the original collider array.
 // Double-sided proxies are used solely to reject points inside solids; the final
 // walk always uses the original meshes, materials, and flightWorld implementation.
 const neutral=new T.MeshBasicMaterial({side:T.DoubleSide}),bins=new Map(),entries=[],normal=new T.Vector3(),ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3();
 function binKey(x,z){return Math.floor(x/8)+':'+Math.floor(z/8);}
 for(const original of preview.colliders){
  original.geometry.computeBoundingBox();const box=original.geometry.boundingBox.clone().applyMatrix4(original.matrixWorld),proxy=new T.Mesh(original.geometry,neutral);proxy.matrixWorld.copy(original.matrixWorld);proxy.matrixAutoUpdate=false;
  const entry={original,proxy,box};entries.push(entry);
  for(let x=Math.floor(box.min.x/8);x<=Math.floor(box.max.x/8);x++)for(let z=Math.floor(box.min.z/8);z<=Math.floor(box.max.z/8);z++){const k=x+':'+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(entry);}
 }
 function local(x,z,r=0){const found=new Set();for(let a=Math.floor((x-r)/8);a<=Math.floor((x+r)/8);a++)for(let b=Math.floor((z-r)/8);b<=Math.floor((z+r)/8);b++)for(const e of bins.get(a+':'+b)||[])if(e.box.min.x<=x+r&&e.box.max.x>=x-r&&e.box.min.z<=z+r&&e.box.max.z>=z-r)found.add(e);return [...found];}
 function cast(meshes,x,y,z,dx,dy,dz,far){origin.set(x,y,z);direction.set(dx,dy,dz).normalize();ray.set(origin,direction);ray.far=far;return ray.intersectObjects(meshes,false);}
 function faceY(hit){return normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).y;}
 function floor(x,y,z,range){return cast(local(x,z).map(e=>e.original),x,y,z,0,-1,0,range).find(h=>faceY(h)>.5);}
 function interior(p,proxies){
  const inside=cast(proxies,p.x,p.y+.08,p.z,0,-1,0,200),seen=new Set();
  for(const h of inside)if(!seen.has(h.object)){
   seen.add(h.object);
   // A downward-facing first hit means the feet are inside this closed solid.
   // At a ramp's exact zero-height edge its top and bottom can coincide: only
   // that actual matching upward face is a boundary, not a solid's bottom cap.
   if(faceY(h)<-.5&&!inside.some(other=>other.object===h.object&&Math.abs(other.point.y-h.point.y)<.015&&faceY(other)>.5))return entries.find(e=>e.proxy===h.object).original;
  }
  return null;
 }
 function headroom(p,near){
  const proxies=near.map(e=>e.proxy);if(interior(p,proxies))return false;
  if(cast(proxies,p.x,p.y+.08,p.z,0,1,0,2.06).length)return false;
  for(const [dx,dz] of DIRS)for(const h of [.65,1.3,1.95])if(cast(proxies,p.x,p.y+h,p.z,dx,0,dz,.53).length)return false;
  return true;
 }
 function cellFor(mesh,p){for(let o=mesh;o;o=o.parent)if(o.userData.cell)return {...o.userData.cell};return cellAt(p);}
 function blocker(p,to){const near=local(p.x,p.z,3),dx=to.x-p.x,dz=to.z-p.z;let hit;for(const h of [.65,1.3,1.95]){hit=cast(near.map(e=>e.original),p.x,p.y+h,p.z,dx,0,dz,Math.hypot(dx,dz)+.55)[0];if(hit)break;}
  if(!hit)hit=cast(local(to.x,to.z,.6).map(e=>e.proxy),to.x,to.y+.08,to.z,0,1,0,2.1)[0];
  if(hit){const actual=entries.find(e=>e.proxy===hit.object)?.original||hit.object;return {cell:cellFor(actual,to),name:actual.userData.wallRole||actual.userData.supportStyle||actual.parent?.name||'solid castle piece',point:point(hit.point)};}
  return {cell:cellAt(to),name:'missing support or insufficient headroom'};
 }
 function stairCeiling(){
  for(const cell of layout)if(cell.type==='stairs'){
   const c=cellPosition(cell),[dx,dz]=ascent(cell.rotation);
   for(let i=1;i<8;i++){
    const p={x:c.x+dx*(i-4),y:c.y+i,z:c.z+dz*(i-4)},support=floor(p.x,p.y+.15,p.z,.3);if(!support||Math.abs(support.point.y-p.y)>.05)continue;
    const hit=cast(local(p.x,p.z).map(e=>e.proxy),p.x,p.y+.08,p.z,0,1,0,2.06)[0];if(!hit)continue;
    const actual=entries.find(e=>e.proxy===hit.object).original;return {cell:cellFor(actual,p),name:actual.name||actual.parent?.name||'overhead floor',point:point(hit.point)};
   }
  }
  return null;
 }
 const columns=new Map(),nodes=[];
 try{
  // Interior samples avoid tile seams; sparse centre lines additionally capture
  // real narrow arched passages that an offset-only lattice can miss.
  const x0=Math.ceil((bounds.minX-1)/SPACING)*SPACING+1,x1=Math.floor((bounds.maxX-1)/SPACING)*SPACING+1,z0=Math.ceil((bounds.minZ-1)/SPACING)*SPACING+1,z1=79,xs=[],zs=[];
  for(let x=x0;x<=x1;x+=SPACING)xs.push(x);for(let z=z0;z<=z1;z+=SPACING)zs.push(z);
  for(let cell=config.minX;cell<config.maxX;cell++)xs.push((cell-5.5)*8);for(let cell=config.minZ;cell<config.maxZ;cell++)zs.push((cell-5.5)*8-4);
  xs.sort((a,b)=>a-b);zs.sort((a,b)=>a-b);const xIndex=new Map(xs.map((x,i)=>[x,i])),zIndex=new Map(zs.map((z,i)=>[z,i])),columnsTotal=xs.length*zs.length;let sampled=0;
  for(const x of xs)for(const z of zs){
   const near=local(x,z,.6),hits=cast(near.map(e=>e.original),x,88,z,0,-1,0,88-BASE+.1),ids=[];let previous=Infinity;
   for(const hit of hits){const y=hit.point.y;if(y<BASE-.02||y>BASE+80||faceY(hit)<=.5||Math.abs(previous-y)<.015)continue;previous=y;const p={x,y,z};if(!headroom(p,near))continue;const id=nodes.length;nodes.push({...p,id,object:hit.object});ids.push(id);}
   if(ids.length)columns.set(x+':'+z,ids);sampled++;await breathe('sampling',sampled,columnsTotal);
  }
  stats.nodes=nodes.length;
  const entrance={x:22,y:BASE,z:74};
  function nearest(p,max=3.1){let best=null,distance=Infinity;for(const x of xs.filter(x=>Math.abs(x-p.x)<=max))for(const z of zs.filter(z=>Math.abs(z-p.z)<=max))for(const id of columns.get(x+':'+z)||[]){const n=nodes[id],d=Math.hypot(n.x-p.x,n.z-p.z);if(d<=max&&Math.abs(n.y-p.y)<.32&&d<distance){distance=d;best=n;}}return best;}
  const start=nearest(entrance,2),targets=[...derivedObjectives(layout),...(settings.objectives||[])].filter((o,i,a)=>a.findIndex(p=>p.id===o.id)===i).map(o=>({...o}));stats.total=targets.length;
  if(!start){issues.push({code:'entrance-blocked',message:'The pod apron has no clear standing point.',suggestion:'Clear the entrance and its approach before checking again.',cell:cellAt(entrance)});return result();}
  const edgeCache=new Map();
  function edge(a,b){
   const id=Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);if(edgeCache.has(id))return edgeCache.get(id);
   let valid=Math.abs(a.y-b.y)<=SPACING+.03;
   if(valid){
    // Half-metre support/clearance probes prevent a graph edge from crossing a
    // gap, wall or low ceiling that happens to lie between lattice nodes.
    const count=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.4);let p=a,surface=a.object;
    for(let i=1;i<=count&&valid;i++){
     const t=i/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,hit=floor(x,p.y+.6,z,1.2);if(!hit){valid=false;break;}
     const next={x,y:hit.point.y,z};
     // At a square-to-circle or stair-to-circle seam a short unsupported gap
     // can sit between the ordinary probes. Refine only the changing-surface
     // interval below a walking step, still raycasting the actual triangles.
     if(hit.object!==surface){let fine=p;const subdivisions=Math.ceil(Math.hypot(next.x-p.x,next.z-p.z)/.04);for(let j=1;j<=subdivisions&&valid;j++){const t=j/subdivisions,fx=p.x+(next.x-p.x)*t,fz=p.z+(next.z-p.z)*t,support=floor(fx,fine.y+.6,fz,1.2);if(!support){valid=false;break;}fine={x:fx,y:support.point.y,z:fz};}if(Math.abs(fine.y-next.y)>.12)valid=false;}
     if(valid&&!headroom(next,local(x,z,.6)))valid=false;p=next;
     surface=hit.object;
    }
    if(Math.abs(p.y-b.y)>.12)valid=false;
   }
   edgeCache.set(id,valid);return valid;
  }
  async function pathfind(target,index){
   const heap=new MinHeap(),scores=new Map([[start.id,0]]),parents=new Map(),closed=new Set();heap.push(start.id,0);let nearestNode=start,barrier=null,barrierScore=Infinity;
   function frontier(a,b){const before=Math.hypot(a.x-target.x,a.z-target.z)+Math.abs(a.y-target.y)*4,after=Math.hypot(b.x-target.x,b.z-target.z)+Math.abs(b.y-target.y)*4;if(after>=before||after>=barrierScore)return;const obstruction=blocker(a,b);if(obstruction.point){barrier=obstruction;barrierScore=after;}}
   while(heap.size){const {id}=heap.pop();if(closed.has(id))continue;closed.add(id);const a=nodes[id];if(Math.hypot(a.x-target.x,a.y-target.y,a.z-target.z)<Math.hypot(nearestNode.x-target.x,nearestNode.y-target.y,nearestNode.z-target.z))nearestNode=a;
    if(id===target.id){const ids=[id];let back=id;while(parents.has(back)){back=parents.get(back);ids.push(back);}return {points:ids.reverse().map(n=>point(nodes[n])),explored:closed.size};}
    for(const [dx,dz] of DIRS){const nx=dx?xs[xIndex.get(a.x)+dx]:a.x,nz=dz?zs[zIndex.get(a.z)+dz]:a.z;if(nx===undefined||nz===undefined)continue;const nearby=columns.get(nx+':'+nz)||[];if(!nearby.some(id=>Math.abs(nodes[id].y-a.y)<2.1))frontier(a,{x:nx,y:a.y,z:nz});
     for(const nid of nearby){if(closed.has(nid))continue;const b=nodes[nid];if(!edge(a,b)){if(Math.abs(a.y-b.y)<2.1)frontier(a,b);continue;}const next=scores.get(id)+Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(next>=(scores.get(nid)??Infinity))continue;scores.set(nid,next);parents.set(nid,id);heap.push(nid,next+Math.hypot(b.x-target.x,b.y-target.y,b.z-target.z));}}
    await breathe('pathfinding',index,targets.length);
   }
   return {points:null,explored:closed.size,nearest:point(nearestNode),barrier};
  }
  async function walk(points,index){
   const active=[],sim=flightWorld(active,[{...entrance,r:6},{...entrance,r:6}]),state=sim.state;let steps=0,maxHeight=BASE;
   function candidates(){active.length=0;for(const e of local(state.x,state.z,1))active.push(e.original);}
   async function leg(list){let last=point(state);for(const target of list){let budget=Math.ceil(Math.hypot(target.x-state.x,target.z-state.z)*24)+120,stall=0;
     while(Math.hypot(target.x-state.x,target.z-state.z)>.035&&budget-->0){const dx=target.x-state.x,dz=target.z-state.z,d=Math.hypot(dx,dz),strength=Math.min(1,d/(10*DT));candidates();const old=point(state);sim.step(DT,{x:dx/d*strength,z:dz/d*strength});steps++;stats.steps++;maxHeight=Math.max(maxHeight,state.y);
      if(Math.hypot(state.x-old.x,state.z-old.z)<.0001)stall++;else stall=0;
      if(stall>30||state.falls||state.y<Math.min(old.y,target.y)-1.3||!state.grounded)return {ok:false,reason:!state.grounded?'lost-support':'blocked',at:point(state),target:point(target),blocker:blocker(state,target),steps};
      await breathe('walking',index,targets.length);
     }
     if(budget<=0||Math.abs(state.y-target.y)>.2)return {ok:false,reason:'height-or-progress',at:point(state),target:point(target),blocker:blocker(state,target),steps};last=point(state);
    }return {ok:true,end:last,steps,grounded:state.grounded,falls:state.falls};}
   const forward=await leg(points.slice(1));if(!forward.ok)return {forward,reverse:{ok:false,skipped:true},maxHeight,steps};
   const reverse=await leg(points.slice().reverse().slice(1));return {forward,reverse,maxHeight,steps};
  }
  for(let index=0;index<targets.length;index++){
   abort();const objective=targets[index];if(objective.stairLanding){const landing=floor(objective.x,objective.y+1.3,objective.z,2.6);if(landing&&Math.abs(landing.point.y-objective.y)<1.1)objective.y=landing.point.y;}let target=nearest(objective);
   if(objective.cluster){
    const members=new Set(objective.cluster.map(p=>p.x+':'+p.z));const candidates=nodes.filter(n=>Math.abs(n.y-objective.y)<.1&&members.has(cellAt(n).x+':'+cellAt(n).z));
    candidates.sort((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z));target=candidates[0]||target;
   }
   const route={id:objective.id||'objective-'+index,label:objective.label||'Castle area '+(index+1),points:[],ok:false,objective:point(objective)};routes.push(route);
   if(!target){const occupied=interior(objective,local(objective.x,objective.z).map(e=>e.proxy));issues.push({code:'objective-blocked',message:route.label+(occupied?' lies inside solid masonry.':' has no clear standing surface.'),suggestion:occupied?'Open a passage in the highlighted solid tier, or place the destination on its upper terrace.':'Clear a floor and at least 2.15 metres of headroom at this location.',cell:occupied?cellFor(occupied,objective):objective.cell||cellAt(objective)});continue;}
   const found=await pathfind(target,index);route.explored=found.explored;
   if(!found.points){const missing=structuralHints(layout,options).find(h=>h.cell.layer<=cellAt(target).layer),ceiling=stairCeiling(),barrier=ceiling||found.barrier;issues.push({code:missing?.code||(ceiling?'blocked-stair-headroom':'disconnected-floor'),message:route.label+' is disconnected from the entrance.'+(barrier&&!missing?' A '+barrier.name+(ceiling?' obstructs stair headroom.':' blocks a sampled approach.'):''),suggestion:missing?.suggestion||(ceiling?'Move the highlighted overhead piece or open the stairwell, leaving at least 2.15 metres above the ramp.':barrier?'Inspect the highlighted blocking piece; open a gate or clear the route and headroom.':'Add a continuous stair and landing route to this floor.'),cell:missing?.cell||barrier?.cell||objective.cell||cellAt(target),nearest:found.nearest,blocker:barrier});continue;}
   route.points=[point(entrance),...found.points];if(!objective.cluster)route.points.push(point(objective));
   const tested=await walk(route.points,index);route.forward=tested.forward;route.reverse=tested.reverse;route.steps=tested.steps;route.maxHeight=tested.maxHeight;route.ok=tested.forward.ok&&tested.reverse.ok;stats.tested++;if(route.ok)stats.passed++;
   if(!route.ok){const fail=!tested.forward.ok?tested.forward:tested.reverse;issues.push({code:'walk-blocked',message:route.label+' failed the '+(!tested.forward.ok?'outward':'return')+' walk: '+fail.blocker.name+'.',suggestion:'Clear the highlighted piece, preserve stair landings, and leave enough headroom; then check again.',cell:fail.blocker.cell,at:fail.at});}
   await breathe('walking',index+1,targets.length);
  }
  return result();
 }finally{neutral.dispose();}
 function result(){stats.seconds=(performance.now()-started)/1000;const ok=issues.length===0&&stats.passed===stats.total;return {ok,summary:ok?stats.passed+' routes walked out and back.':stats.passed+' of '+stats.total+' routes passed; '+issues.length+' areas need attention.',issues,routes,tested:stats.tested,reachable:stats.passed,total:stats.total,stats};}
}
