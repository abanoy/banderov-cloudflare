import {yieldTask} from './task-yield.js';
import * as T from '../vendor/three.module.js';
import {flightWorld} from './flight.js?v=aerie-20261018';

const STEP=1/120,SPACING=4,point=p=>({x:p.x,y:p.y,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),key=(x,z)=>Math.round(x*1000)+':'+Math.round(z*1000),pairKey=(a,b)=>Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);
// Ground distance from p to segment a-b, plus half the height difference there.
// ahead: the point on a-b up to `max` m past the projection of p (b once past it).
const ahead=(p,a,b,max)=>{const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;if(l2<.0025)return b;const t=Math.max(0,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2),u=t+max/Math.sqrt(l2);return u>=1?b:{x:a.x+dx*u,y:a.y+(b.y-a.y)*u,z:a.z+dz*u};};
const along=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=l2>1e-9?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2)):0;return Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z)+Math.abs(a.y+(b.y-a.y)*t-p.y)*.5;};
class Heap{
 constructor(){this.q=[];}
 push(id,cost){const v={id,cost},q=this.q;let i=q.length;q.push(v);while(i){const p=(i-1)>>1;if(q[p].cost<=cost)break;q[i]=q[p];i=p;}q[i]=v;}
 pop(){const q=this.q,first=q[0],last=q.pop();if(q.length){let i=0;while(i*2+1<q.length){let c=i*2+1;if(c+1<q.length&&q[c+1].cost<q[c].cost)c++;if(q[c].cost>=last.cost)break;q[i]=q[c];i=c;}q[i]=last;}return first;}
 get size(){return this.q.length;}
}

/** Shared spatial index and an asynchronously prepared standing graph. Bounding
 * boxes only select original triangle meshes; they never replace collisions. */
export function createBattleNavigation(world){
 const neutral=new T.MeshBasicMaterial({side:T.DoubleSide}),ray=new T.Raycaster(),normal=new T.Vector3(),bins=new Map(),entries=[],proxiesByMesh=new Map(),nodes=[],columns=new Map(),edges=new Map(),podLinks=new Map(),pathCache=new Map(),shortcuts=new Map();
 let revision=0,ready=false,disposed=false,queue=Promise.resolve(),walkingComponents=new Int32Array(0),padNodeRefs=[];const blocked=[];
 const metrics={ready:false,revision:0,nodes:0,edgesTested:0,edgesPassed:0,podLinks:0,physicalSteps:0,pathRequests:0,failedPaths:0,buildSeconds:0,shortcutsTested:0,shortcutsPassed:0};
 function aborted(signal,rev){if(disposed||signal?.aborted||rev!==revision){const e=new Error('Battle route preparation cancelled.');e.name='AbortError';throw e;}}
 function nearby(p,r=3){const out=new Set();for(let x=Math.floor((p.x-r)/12);x<=Math.floor((p.x+r)/12);x++)for(let z=Math.floor((p.z-r)/12);z<=Math.floor((p.z+r)/12);z++)for(const e of bins.get(x+':'+z)||[])if(e.box.min.x<=p.x+r&&e.box.max.x>=p.x-r&&e.box.min.z<=p.z+r&&e.box.max.z>=p.z-r)out.add(e.original);return [...out];}
 function cast(meshes,p,d,far){ray.set(new T.Vector3(p.x,p.y,p.z),new T.Vector3(d.x,d.y,d.z).normalize());ray.far=far;return ray.intersectObjects(meshes,false);}
 function ny(h){return normal.copy(h.face.normal).transformDirection(h.object.matrixWorld).y;}
 function floor(p,range=1.4){return cast(nearby(p,1),p,{x:0,y:-1,z:0},range).find(h=>ny(h)>.5);}
 function clearStanding(p){
  const originals=nearby(p,1),proxies=originals.map(o=>proxiesByMesh.get(o)).filter(Boolean),seen=new Set();
  const below=cast(proxies,{...p,y:p.y+.08},{x:0,y:-1,z:0},300);
  for(const h of below)if(!seen.has(h.object)){seen.add(h.object);if(ny(h)<-.5&&!below.some(q=>q.object===h.object&&Math.abs(q.point.y-h.point.y)<.015&&ny(q)>.5))return false;}
  if(cast(proxies,{...p,y:p.y+.08},{x:0,y:1,z:0},2.07).length)return false;
  for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]])for(const h of [.65,1.3,1.95])if(cast(proxies,{...p,y:p.y+h},{x,y:0,z},.53).length)return false;
  return true;
 }
 function lineOfSight(a,b){const d=dist(a,b);if(d<.05)return true;const centre={x:(a.x+b.x)/2,z:(a.z+b.z)/2},meshes=nearby(centre,Math.hypot(a.x-b.x,a.z-b.z)/2+1);return !cast(meshes,a,{x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},Math.max(0,d-.25)).length;}
 function nearest(p,max=7){let found=null,best=Infinity;for(const n of nodes){const horizontal=Math.hypot(n.x-p.x,n.z-p.z);if(horizontal>max||Math.abs(n.y-p.y)>1.3)continue;const d=horizontal+Math.abs(n.y-p.y)*2;if(d<best){best=d;found=n;}}return found;}
 function connectedStart(p){const candidates=nodes.filter(n=>Math.abs(n.y-p.y)<1.3&&Math.hypot(n.x-p.x,n.z-p.z)<=7).sort((a,b)=>dist(a,p)-dist(b,p));for(const n of candidates.slice(0,16))if(dist(p,n)<.025||runWalk(p,n))return n;return null;}
 function aroundObjective(o,from){const radius=o.radius??2,candidates=nodes.filter(n=>Math.abs(n.y-o.y)<1.3&&Math.hypot(n.x-o.x,n.z-o.z)<radius-.75);candidates.sort((a,b)=>dist(a,from)-dist(b,from));return candidates[0]||nearest(o,Math.max(3,radius));}
 function runWalk(a,b){
  const active=[],sim=flightWorld(active,[{...a,r:2},{...a,r:2}]);let steps=0;
  function leg(target){let budget=Math.ceil(Math.hypot(sim.state.x-target.x,sim.state.z-target.z)*12)+8;while(Math.hypot(sim.state.x-target.x,sim.state.z-target.z)>.025&&budget-->0){const s=sim.state,dx=target.x-s.x,dz=target.z-s.z,d=Math.hypot(dx,dz),strength=Math.min(1,d/(10*STEP));active.splice(0,active.length,...nearby(s,1));sim.step(STEP,{x:dx/d*strength,z:dz/d*strength});steps++;if(!s.grounded||s.falls)return false;}return budget>0&&Math.abs(sim.state.y-target.y)<.15;}
  const ok=leg(b)&&leg(a);metrics.physicalSteps+=steps;return ok;
 }
 function edge(a,b){const k=Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);if(edges.has(k))return edges.get(k);metrics.edgesTested++;const ok=Math.abs(a.y-b.y)<=Math.hypot(a.x-b.x,a.z-b.z)+.05&&runWalk(a,b);edges.set(k,ok);if(ok)metrics.edgesPassed++;return ok;}
 function addNode(p){const k=key(p.x,p.z),existing=columns.get(k)||[];if(existing.some(n=>Math.abs(n.y-p.y)<.025))return;const n={...point(p),id:nodes.length,neighbors:[]};nodes.push(n);existing.push(n);columns.set(k,existing);}
 function index(){bins.clear();proxiesByMesh.clear();entries.length=0;for(const original of world.solids){if(original.userData.terrainCliff||original.userData.vehicleId!==undefined||original.userData.gateLeaf&&original.userData.gateOpen)continue;original.updateWorldMatrix(true,false);const box=new T.Box3().setFromObject(original),proxy=new T.Mesh(original.geometry,neutral);proxy.matrixWorld.copy(original.matrixWorld);proxy.matrixAutoUpdate=false;proxiesByMesh.set(original,proxy);const e={original,proxy,box};entries.push(e);for(let x=Math.floor(box.min.x/12);x<=Math.floor(box.max.x/12);x++)for(let z=Math.floor(box.min.z/12);z<=Math.floor(box.max.z/12);z++){const k=x+':'+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(e);}}}
 // Raw walking connectivity is deliberately optimistic: blocked candidate edges
 // may join rooms. It supplies a lower bound, never substitutes for real walking.
 function groupWalkingCandidates(){
  const parent=new Int32Array(nodes.length),size=new Int32Array(nodes.length).fill(1);
  for(let i=0;i<parent.length;i++)parent[i]=i;
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(const n of nodes)for(const link of n.neighbors){if(link.launchTo!==undefined)continue;let a=root(n.id),b=root(link.id);if(a===b)continue;if(size[a]<size[b])[a,b]=[b,a];parent[b]=a;size[a]+=size[b];}
  for(let i=0;i<parent.length;i++)parent[i]=root(i);walkingComponents=parent;
 }
 function portalEstimate(target){
  const component=walkingComponents[target.id],cost=padNodeRefs.map(n=>n&&walkingComponents[n.id]===component?dist(n,target):Infinity),done=new Set();
  // Reverse shortest paths over pod portals. Walking between pads in one raw
  // component uses straight-line distance; valid directed pod links keep cost100.
  for(let step=0;step<cost.length;step++){
   let best=-1;for(let i=0;i<cost.length;i++)if(!done.has(i)&&Number.isFinite(cost[i])&&(best<0||cost[i]<cost[best]))best=i;
   if(best<0)break;done.add(best);
   for(let i=0;i<cost.length;i++){
    if(!padNodeRefs[i]||!padNodeRefs[best])continue;
    const walking=walkingComponents[padNodeRefs[i].id]===walkingComponents[padNodeRefs[best].id]?dist(padNodeRefs[i],padNodeRefs[best]):Infinity,pod=podLinks.get(i+':'+best)?.cost??Infinity;
    cost[i]=Math.min(cost[i],cost[best]+Math.min(walking,pod));
   }
  }
  return n=>{const group=walkingComponents[n.id];let best=group===component?dist(n,target):Infinity;for(let i=0;i<cost.length;i++)if(padNodeRefs[i]&&walkingComponents[padNodeRefs[i].id]===group)best=Math.min(best,dist(n,padNodeRefs[i])+cost[i]);return Number.isFinite(best)?best:0;};
 }
 async function rebuild({signal,onProgress}={}){
  const rev=++revision,start=performance.now();ready=false;metrics.ready=false;Object.assign(metrics,{revision:rev,nodes:0,edgesTested:0,edgesPassed:0,podLinks:0,physicalSteps:0,pathRequests:0,failedPaths:0,shortcutsTested:0,shortcutsPassed:0});nodes.length=0;columns.clear();edges.clear();podLinks.clear();pathCache.clear();shortcuts.clear();blocked.length=0;index();let last=performance.now();
  async function yieldIf(phase,completed,total){aborted(signal,rev);if(performance.now()-last>10){onProgress?.({phase,completed,total,message:phase==='sampling'?'Reading the battleground':phase==='pods'?'Checking pod journeys':'Linking walkable ground'});await yieldTask();last=performance.now();aborted(signal,rev);}}
  const zones=[{minX:-112,maxX:112,minZ:-112,maxZ:112,minY:-13,maxY:3}];
  for(const o of world.outposts||[])zones.push({minX:o.x-37,maxX:o.x+37,minZ:o.z-37,maxZ:o.z+37,minY:-2,maxY:35});
  for(let home=0;home<2;home++){const box=new T.Box3();for(const e of entries)if(e.original.userData.castleIndex===home)box.union(e.box);const pad=world.pads[home];if(box.isEmpty())box.set(new T.Vector3(pad.x-14,pad.y-2,pad.z-14),new T.Vector3(pad.x+14,pad.y+20,pad.z+14));box.expandByPoint(new T.Vector3(pad.x,pad.y,pad.z));zones.push({minX:box.min.x-1,maxX:box.max.x+1,minZ:box.min.z-1,maxZ:box.max.z+1,minY:pad.y-2,maxY:Math.min(240,box.max.y+2),home});}
  for(const bridge of world.bridges||[])zones.push({minX:Math.min(bridge.a.x,bridge.b.x)-7,maxX:Math.max(bridge.a.x,bridge.b.x)+7,minZ:Math.min(bridge.a.z,bridge.b.z)-7,maxZ:Math.max(bridge.a.z,bridge.b.z)+7,minY:-1,maxY:3,bridge});
  const samples=new Map();
  function sampleAxes(zone){
   const xs=new Set(),zs=new Set(),castle=world.castles?.[zone.home];
   let custom=false;
   castle?.traverse(g=>{if(g.userData.explicitFloors&&g.visible)custom=true;});
   function addLocal(x,z){
    const v=new T.Vector3(x,.77,z).applyMatrix4(castle.matrixWorld);
    if(v.x>=zone.minX&&v.x<=zone.maxX)xs.add(Math.round(v.x*1000)/1000);
    if(v.z>=zone.minZ&&v.z<=zone.maxZ)zs.add(Math.round(v.z*1000)/1000);
   }
   // Use one interior lattice for generated castles, rather than combining
   // offset world and local rows into an unnecessarily dense cross-product.
   if(custom){for(let c=-128;c<=128;c++)addLocal(c*2+1,c*2+1);}
   else{
    for(let x=Math.ceil(zone.minX/SPACING)*SPACING;x<=zone.maxX;x+=SPACING)xs.add(x);
    for(let z=Math.ceil(zone.minZ/SPACING)*SPACING;z<=zone.maxZ;z+=SPACING)zs.add(z);
   }
   if(castle)for(let c=-20;c<=32;c++)addLocal((c-5.5)*8,(c-5.5)*8-4);
   for(const p of world.pads)if(p.x>=zone.minX&&p.x<=zone.maxX&&p.z>=zone.minZ&&p.z<=zone.maxZ){xs.add(p.x);zs.add(p.z);}
   return {xs,zs};
  }
  for(const zone of zones){
   const {xs,zs}=sampleAxes(zone);
   for(const x of xs)for(const z of zs){
    if(zone.bridge){
     const {a,b}=zone.bridge,dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
     if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)>7)continue;
    }
    const k=key(x,z);if(!samples.has(k))samples.set(k,[]);samples.get(k).push({...zone,x,z});
   }
  }
  let completed=0;for(const group of samples.values()){const {x,z}=group[0],low=Math.min(...group.map(g=>g.minY)),high=Math.max(...group.map(g=>g.maxY)),hits=cast(nearby({x,z},1),{x,y:high,z},{x:0,y:-1,z:0},high-low+.05);let previous=Infinity;for(const h of hits){if(ny(h)<=.5||Math.abs(h.point.y-previous)<.025||!group.some(g=>h.point.y>=g.minY-.02&&h.point.y<=g.maxY))continue;previous=h.point.y;const p=point(h.point);if(clearStanding(p))addNode(p);}await yieldIf('sampling',++completed,samples.size);}
  // Link adjacent sampled rows/columns. Gaps and collisions are verified lazily
  // by the same 120 Hz movement code, in both directions, before A* uses an edge.
  const rows=new Map(),cols=new Map();for(const [k,list] of columns){const [x,z]=k.split(':').map(Number);if(!rows.has(z))rows.set(z,[]);if(!cols.has(x))cols.set(x,[]);rows.get(z).push(list);cols.get(x).push(list);}
  for(const [sets,axis] of [[rows,'x'],[cols,'z']])for(const line of sets.values()){line.sort((a,b)=>a[0][axis]-b[0][axis]);for(let i=1;i<line.length;i++){const before=line[i-1],after=line[i];if(after[0][axis]-before[0][axis]>4.1)continue;for(const a of before)for(const b of after)if(Math.abs(a.y-b.y)<=4.1){a.neighbors.push({id:b.id});b.neighbors.push({id:a.id});}}await yieldIf('linking',nodes.length,nodes.length);}
  // Authored winding stairs need diagonal samples as well as the grid.
  // Re-sample current geometry so replaced castles never inherit phantom paths.
  for(const route of world.routes||[]){for(let j=1;j<route.length;j++){const a=route[j-1],b=route[j],count=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2);for(let k=0;k<=count;k++){const t=k/(count||1),p={x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t+1,z:a[2]+(b[2]-a[2])*t},h=floor(p,2);if(!h||!clearStanding(h.point)){continue;}addNode(h.point);const n=nearest(h.point,.03);if(!n)continue;for(const other of nodes)if(other!==n&&Math.hypot(other.x-n.x,other.z-n.z)<4.1&&Math.abs(other.y-n.y)<4.1&&!n.neighbors.some(l=>l.id===other.id)){n.neighbors.push({id:other.id});other.neighbors.push({id:n.id});}}await yieldIf('stairs',j,route.length);}}
  groupWalkingCandidates();const padNodes=padNodeRefs=world.pads.map(p=>nearest(p,4.1));
  for(let a=0;a<world.pads.length;a++)for(let b=0;b<world.pads.length;b++){if(a===b||!padNodes[a]||!padNodes[b])continue;const active=[],sim=flightWorld(active,world.pads);sim.state.home=a;sim.recover();if(!sim.launch(b))continue;let ok=false;for(let i=0;i<1800;i++){active.splice(0,active.length,...nearby(sim.state,3));sim.step(STEP,{x:0,z:0});metrics.physicalSteps++;if(sim.state.falls)break;if(sim.state.grounded&&!sim.state.flight){ok=dist(sim.state,world.pads[b])<4;break;}if(i%120===0)await yieldIf('pods',a*world.pads.length+b,world.pads.length**2);}if(ok){const link={id:padNodes[b].id,launchTo:b,launchFrom:a,cost:100};padNodes[a].neighbors.push(link);podLinks.set(a+':'+b,link);metrics.podLinks++;}await yieldIf('pods',a*world.pads.length+b+1,world.pads.length**2);}
  aborted(signal,rev);ready=true;Object.assign(metrics,{ready:true,nodes:nodes.length,buildSeconds:(performance.now()-start)/1000});onProgress?.({phase:'ready',completed:nodes.length,total:nodes.length,message:'Battle routes ready'});return {...metrics};
 }
 // String pulling on a found walking run: lattice corners are dropped only when
 // the same out-and-back 120 Hz walk that validates graph edges succeeds along
 // the direct line, inside the corridor the lattice route already proved. Bots
 // then walk straight runs and turn at landings instead of 4 m staircases.
 function direct(a,b,between){const k=Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);if(shortcuts.has(k))return shortcuts.get(k);if(edges.get(k)===false)return false;const run=Math.hypot(b.x-a.x,b.z-a.z);let ok=run>.05&&run<=28&&Math.abs(a.y-b.y)<=run+.05&&!blocked.some(p=>along(p,a,b)<1.4);
  if(ok)for(const n of between){const t=Math.max(0,Math.min(1,((n.x-a.x)*(b.x-a.x)+(n.z-a.z)*(b.z-a.z))/(run*run)));if(Math.hypot(a.x+(b.x-a.x)*t-n.x,a.z+(b.z-a.z)*t-n.z)>2.9||Math.abs(a.y+(b.y-a.y)*t-n.y)>1.2){ok=false;break;}}
  if(ok){metrics.shortcutsTested++;ok=runWalk(a,b);if(ok)metrics.shortcutsPassed++;}shortcuts.set(k,ok);return ok;}
 // Galloping search for the farthest checked corner, then bisection. New walks
 // per route are capped in simulated steps, not wall time, so the same graph
 // always yields the same route; checked shortcuts are cached until rebuild.
 // Smoothing therefore runs after A* and outside its maxMs, bounded by those caps.
 async function pull(chain,signal,rev){const out=[chain[0]],budget=metrics.physicalSteps+40000;let i=0,last=performance.now(),tests=0;
  const test=async k=>{const a=nodes[chain[i]],b=nodes[chain[k]];if(!shortcuts.has(Math.min(a.id,b.id)+':'+Math.max(a.id,b.id))){if(tests>=160||metrics.physicalSteps>budget)return false;tests++;}const ok=direct(a,b,chain.slice(i+1,k).map(id=>nodes[id]));if(performance.now()-last>8){await yieldTask();last=performance.now();aborted(signal,rev);}return ok;};
  while(i<chain.length-1){let lo=i+1,hi=0;for(let step=1;lo<chain.length-1;step*=2){const k=Math.min(chain.length-1,i+1+step);if(await test(k)){lo=k;}else{hi=k;break;}}
   while(hi-lo>1){const mid=(lo+hi)>>1;if(await test(mid))lo=mid;else hi=mid;}out.push(chain[lo]);i=lo;}
  return out;}
 // Walking dock searches skip pod links and use weighted A* (1.5).
 // Physical edge validation is unchanged; a shortest route is not guaranteed.
 // Edges are walked lazily, when a node is about to be closed through its best
 // parent; a failed walk re-derives that node from its closed neighbours, so
 // only checked edges ever join a route, with about half the walks. maxMs is the search's own working time: slices the page spends on
 // frames or other work while the search is yielded do not use it up.
 async function findPath(from,to,{signal,maxVisited=12000,maxMs=Infinity,startNode,walkingOnly=false,smooth=true}={}){
  const rev=revision,started=performance.now();metrics.pathRequests++;if(!ready)return {reachable:false,points:[],reason:'Routes are still being prepared',cost:Infinity,visited:0};const start=startNode||connectedStart(from),target=aroundObjective(to,from);if(!start||!target)return {reachable:false,points:[],reason:'No supported starting point or objective approach',cost:Infinity,visited:0};
  const estimate=walkingOnly?null:portalEstimate(target),heap=new Heap(),scores=new Map([[start.id,0]]),parents=new Map(),closed=new Set();heap.push(start.id,0);let last=performance.now(),idle=0;
  while(heap.size&&closed.size<maxVisited&&performance.now()-started-idle<maxMs){aborted(signal,rev);const {id}=heap.pop();if(closed.has(id)||!scores.has(id))continue;const via=parents.get(id);
   if(via&&via.launchTo===undefined&&!edge(nodes[via.from],nodes[id])){const b=nodes[id];scores.delete(id);parents.delete(id);for(const link of b.neighbors){if(link.launchTo!==undefined||!closed.has(link.id)||edges.get(Math.min(id,link.id)+':'+Math.max(id,link.id))===false)continue;const score=scores.get(link.id)+dist(nodes[link.id],b);if(score<(scores.get(id)??Infinity)){scores.set(id,score);parents.set(id,{from:link.id,id});}}
    if(!walkingOnly)for(const link of podLinks.values()){const from=padNodeRefs[link.launchFrom];if(link.id!==id||!from||!closed.has(from.id))continue;const score=scores.get(from.id)+link.cost;if(score<(scores.get(id)??Infinity)){scores.set(id,score);parents.set(id,{from:from.id,...link});}}
    if(scores.has(id))heap.push(id,scores.get(id)+(walkingOnly?dist(b,target)*1.5:estimate(b)));continue;}
   closed.add(id);const a=nodes[id];if(id===target.id){const reverse=[],ids=[id];let back=id;while(parents.has(back)){const entry=parents.get(back);reverse.push(entry);back=entry.from;ids.push(back);}const chain=ids.reverse(),runs=[[chain[0]]],launches=[];for(let i=1;i<chain.length;i++){const link=parents.get(chain[i]);if(link.launchTo!==undefined){launches.push(link);runs.push([chain[i]]);}else runs.at(-1).push(chain[i]);}
    const points=[],raw=chain.length;for(let r=0;r<runs.length;r++){if(r){const link=launches[r-1];points.push({...point(world.pads[link.launchFrom]),launchTo:link.launchTo},point(world.pads[link.launchTo]));}for(const n of smooth&&runs[r].length>2?await pull(runs[r],signal,rev):runs[r])points.push(point(nodes[n]));}
    return {reachable:true,points,cost:scores.get(id),reason:'A supported route is available',visited:closed.size,revision:rev,lattice:raw};}
   for(const link of a.neighbors){if((walkingOnly&&link.launchTo!==undefined)||closed.has(link.id))continue;const b=nodes[link.id],score=scores.get(id)+(link.cost??dist(a,b));if(score>=(scores.get(b.id)??Infinity)||edges.get(Math.min(id,b.id)+':'+Math.max(id,b.id))===false)continue;scores.set(b.id,score);parents.set(b.id,{from:id,...link});heap.push(b.id,score+(walkingOnly?dist(b,target)*1.5:estimate(b)));}
   if(performance.now()-last>8){const paused=performance.now();await yieldTask();last=performance.now();idle+=last-paused;}
  }
  metrics.failedPaths++;return {reachable:false,points:[],reason:performance.now()-started-idle>=maxMs?'Route search time budget reached':closed.size>=maxVisited?'Route search reached its work limit':'No walkable or validated pod route reaches this objective',cost:Infinity,visited:closed.size,revision:rev};
 }
 // Cached results are shared by every request with the same start node and
 // approach: callers treat route.points as read-only and copy before editing.
 function path(from,to,options){const requestedRevision=revision,origin=point(from),destination={...to},task=queue.then(async()=>{aborted(options?.signal,requestedRevision);const start=connectedStart(origin),target=aroundObjective(destination,origin),cacheKey=start?.id+':'+target?.id+':'+!!options?.walkingOnly+':'+(options?.smooth!==false);if(start&&target&&pathCache.has(cacheKey))return pathCache.get(cacheKey);const result=await findPath(origin,destination,{...options,startNode:start});if(start&&target&&result.reason!=='Route search time budget reached'&&result.reason!=='Route search reached its work limit'){if(pathCache.size>=384)pathCache.delete(pathCache.keys().next().value);pathCache.set(cacheKey,result);}return result;});queue=task.catch(()=>{});return task;}
 async function reachable(from,objectives,options){const results=[];for(const o of objectives){const route=await path(from,o,options);results.push({id:o.id,...route});}return results;}
 // A pulled run spans several lattice edges. With the stuck position the bot
 // reports, the lattice edges passing it close and later shortcuts through it
 // are refused; without one, every lattice edge along the blocked run closes.
 function invalidateSegment(from,to,at=null){const a=nearest(from),b=nearest(to);if(a&&b){const k=pairKey(a,b);edges.set(k,false);shortcuts.set(k,false);
   if(at||Math.hypot(a.x-b.x,a.z-b.z)>4.2){for(const n of nodes){if(along(n,a,b)>1.2)continue;for(const l of n.neighbors){const m=nodes[l.id];if(l.launchTo!==undefined||along(m,a,b)>1.2||at&&along(at,n,m)>1.2)continue;const e=pairKey(n,m);edges.set(e,false);shortcuts.set(e,false);}}
    if(at){const p=point(at);blocked.push(p);for(const [e,ok] of shortcuts)if(ok){const [i,j]=e.split(':').map(Number);if(along(p,nodes[i],nodes[j])<1.4)shortcuts.set(e,false);}}}}
  pathCache.clear();}
 // Adopt a route from where a walker stands. Routes start at a lattice node up
 // to 7 m away in any direction; when the walker is already past that node
 // along the first leg it rejoins the checked leg about 2 m ahead (or at its
 // end) after a short walk check instead of walking back. Never edits the shared
 // cached array; null when neither the rejoin nor the first point can be walked.
 // The rejoin point stands on the floor under it: a straight a-b height blend misses steps and ramps, the walk check then
 // failed and the bot walked back to a (BC-3). When it still cannot be walked, the next waypoint (up to 12 m) is tried, then the
 // closest point of the leg (a side step onto it, e.g. off-centre on a bridge), before a.
 function join(from,points){const s=point(from);let out=points,joined=false;
  for(let pass=0;pass<2&&out.length>1;pass++){const a=out[0],b=out[1];if(a.launchTo!==undefined||b.launchTo!==undefined||(s.x-a.x)*(b.x-a.x)+(s.z-a.z)*(b.z-a.z)<=0)break;const q=ahead(s,a,b,2);
   if(q!==b){const p=settle(q);if(runWalk(s,p)){out=[p,...out.slice(1)];joined=true;break;}}
   if(Math.hypot(b.x-s.x,b.z-s.z)>12||!runWalk(s,point(b))){const m=ahead(s,a,b,0);if(m!==b){const p=settle(m);if(runWalk(s,p)){out=[p,...out.slice(1)];joined=true;}}break;}out=out.slice(1);joined=true;}
  return joined||!out.length||runWalk(s,point(out[0]))?out:null;}
 // A point between two waypoints, moved onto the floor below or just above it (within 1.3 m of the blended height).
 function settle(q){const g=floor({x:q.x,y:q.y+.9,z:q.z},2.2);return g?{x:q.x,y:g.point.y,z:q.z}:point(q);}
 function safeStep(from,dx,dz,distance=1){const p={x:from.x+dx*distance,y:from.y+.6,z:from.z+dz*distance},hit=floor(p,1.2);return !!hit&&Math.abs(hit.point.y-from.y)<.55&&clearStanding(point(hit.point));}
 function dispose(){disposed=true;revision++;ready=false;neutral.dispose();bins.clear();proxiesByMesh.clear();entries.length=0;nodes.length=0;walkingComponents=new Int32Array(0);padNodeRefs=[];}
 return {rebuild,path,nearest,reachable,nearby,lineOfSight,safeStep,canWalk:(from,to)=>runWalk(point(from),point(to)),join,ahead:(p,a,b,max)=>{const q=ahead(p,a,b,max);return q===b?b:settle(q);},invalidateSegment,dispose,get ready(){return ready;},get stats(){return {...metrics};},get nodes(){return nodes.map(point);}};
}
