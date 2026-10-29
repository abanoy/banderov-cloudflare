import * as T from '../vendor/three.module.js';
import {flightWorld} from './flight.js';

const STEP=1/120,SPACING=4,point=p=>({x:p.x,y:p.y,z:p.z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),key=(x,z)=>Math.round(x*1000)+':'+Math.round(z*1000);
class Heap{
 constructor(){this.q=[];}
 push(id,cost){const v={id,cost},q=this.q;let i=q.length;q.push(v);while(i){const p=(i-1)>>1;if(q[p].cost<=cost)break;q[i]=q[p];i=p;}q[i]=v;}
 pop(){const q=this.q,first=q[0],last=q.pop();if(q.length){let i=0;while(i*2+1<q.length){let c=i*2+1;if(c+1<q.length&&q[c+1].cost<q[c].cost)c++;if(q[c].cost>=last.cost)break;q[i]=q[c];i=c;}q[i]=last;}return first;}
 get size(){return this.q.length;}
}

/** Shared spatial index and an asynchronously prepared standing graph. Bounding
 * boxes only select original triangle meshes; they never replace collisions. */
export function createBattleNavigation(world){
 const neutral=new T.MeshBasicMaterial({side:T.DoubleSide}),ray=new T.Raycaster(),normal=new T.Vector3(),bins=new Map(),entries=[],proxiesByMesh=new Map(),nodes=[],columns=new Map(),edges=new Map(),podLinks=new Map(),pathCache=new Map();
 let revision=0,ready=false,disposed=false,queue=Promise.resolve();
 const metrics={ready:false,revision:0,nodes:0,edgesTested:0,edgesPassed:0,podLinks:0,physicalSteps:0,pathRequests:0,failedPaths:0,buildSeconds:0};
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
 function index(){bins.clear();proxiesByMesh.clear();entries.length=0;for(const original of world.solids){if(original.userData.vehicleId!==undefined)continue;original.updateWorldMatrix(true,false);const box=new T.Box3().setFromObject(original),proxy=new T.Mesh(original.geometry,neutral);proxy.matrixWorld.copy(original.matrixWorld);proxy.matrixAutoUpdate=false;proxiesByMesh.set(original,proxy);const e={original,proxy,box};entries.push(e);for(let x=Math.floor(box.min.x/12);x<=Math.floor(box.max.x/12);x++)for(let z=Math.floor(box.min.z/12);z<=Math.floor(box.max.z/12);z++){const k=x+':'+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(e);}}}
 async function rebuild({signal,onProgress}={}){
  const rev=++revision,start=performance.now();ready=false;metrics.ready=false;Object.assign(metrics,{revision:rev,nodes:0,edgesTested:0,edgesPassed:0,podLinks:0,physicalSteps:0,pathRequests:0,failedPaths:0});nodes.length=0;columns.clear();edges.clear();podLinks.clear();pathCache.clear();index();let last=performance.now();
  async function yieldIf(phase,completed,total){aborted(signal,rev);if(performance.now()-last>10){onProgress?.({phase,completed,total,message:phase==='sampling'?'Reading the battleground':phase==='pods'?'Checking pod journeys':'Linking walkable ground'});await new Promise(r=>setTimeout(r,0));last=performance.now();aborted(signal,rev);}}
  const zones=[{minX:-112,maxX:112,minZ:-112,maxZ:112,minY:-13,maxY:3}];
  for(const o of world.outposts||[])zones.push({minX:o.x-37,maxX:o.x+37,minZ:o.z-37,maxZ:o.z+37,minY:-2,maxY:35});
  for(let home=0;home<2;home++){const box=new T.Box3();for(const e of entries)if(e.original.userData.castleIndex===home)box.union(e.box);const pad=world.pads[home];if(box.isEmpty())box.set(new T.Vector3(pad.x-14,pad.y-2,pad.z-14),new T.Vector3(pad.x+14,pad.y+20,pad.z+14));box.expandByPoint(new T.Vector3(pad.x,pad.y,pad.z));zones.push({minX:box.min.x-1,maxX:box.max.x+1,minZ:box.min.z-1,maxZ:box.max.z+1,minY:pad.y-2,maxY:Math.min(240,box.max.y+2),home});}
  for(const bridge of world.bridges||[])zones.push({minX:Math.min(bridge.a.x,bridge.b.x)-7,maxX:Math.max(bridge.a.x,bridge.b.x)+7,minZ:Math.min(bridge.a.z,bridge.b.z)-7,maxZ:Math.max(bridge.a.z,bridge.b.z)+7,minY:-1,maxY:3,bridge});
  const samples=new Map();
  for(const zone of zones){const xs=new Set(),zs=new Set();for(let x=Math.ceil(zone.minX/SPACING)*SPACING;x<=zone.maxX;x+=SPACING)xs.add(x);for(let z=Math.ceil(zone.minZ/SPACING)*SPACING;z<=zone.maxZ;z+=SPACING)zs.add(z);if(zone.home!==undefined&&world.castles?.[zone.home]){const castle=world.castles[zone.home];for(let c=-20;c<=32;c++){const v=new T.Vector3((c-5.5)*8,.77,(c-5.5)*8-4).applyMatrix4(castle.matrixWorld);if(v.x>=zone.minX&&v.x<=zone.maxX)xs.add(Math.round(v.x*1000)/1000);if(v.z>=zone.minZ&&v.z<=zone.maxZ)zs.add(Math.round(v.z*1000)/1000);}}for(const p of world.pads)if(p.x>=zone.minX&&p.x<=zone.maxX&&p.z>=zone.minZ&&p.z<=zone.maxZ){xs.add(p.x);zs.add(p.z);}for(const x of xs)for(const z of zs){if(zone.bridge){const {a,b}=zone.bridge,dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)>7)continue;}const k=key(x,z);if(!samples.has(k))samples.set(k,[]);samples.get(k).push({...zone,x,z});}}
  let completed=0;for(const group of samples.values()){const {x,z}=group[0],low=Math.min(...group.map(g=>g.minY)),high=Math.max(...group.map(g=>g.maxY)),hits=cast(nearby({x,z},1),{x,y:high,z},{x:0,y:-1,z:0},high-low+.05);let previous=Infinity;for(const h of hits){if(ny(h)<=.5||Math.abs(h.point.y-previous)<.025||!group.some(g=>h.point.y>=g.minY-.02&&h.point.y<=g.maxY))continue;previous=h.point.y;const p=point(h.point);if(clearStanding(p))addNode(p);}await yieldIf('sampling',++completed,samples.size);}
  // Link adjacent sampled rows/columns. Gaps and collisions are verified lazily
  // by the same 120 Hz movement code, in both directions, before A* uses an edge.
  const rows=new Map(),cols=new Map();for(const [k,list] of columns){const [x,z]=k.split(':').map(Number);if(!rows.has(z))rows.set(z,[]);if(!cols.has(x))cols.set(x,[]);rows.get(z).push(list);cols.get(x).push(list);}
  for(const [sets,axis] of [[rows,'x'],[cols,'z']])for(const line of sets.values()){line.sort((a,b)=>a[0][axis]-b[0][axis]);for(let i=1;i<line.length;i++){const before=line[i-1],after=line[i];if(after[0][axis]-before[0][axis]>4.1)continue;for(const a of before)for(const b of after)if(Math.abs(a.y-b.y)<=4.1){a.neighbors.push({id:b.id});b.neighbors.push({id:a.id});}}await yieldIf('linking',nodes.length,nodes.length);}
  // Authored winding stairs need diagonal samples as well as the grid.
  // Re-sample current geometry so replaced castles never inherit phantom paths.
  for(const route of world.routes||[]){for(let j=1;j<route.length;j++){const a=route[j-1],b=route[j],count=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2);for(let k=0;k<=count;k++){const t=k/(count||1),p={x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t+1,z:a[2]+(b[2]-a[2])*t},h=floor(p,2);if(!h||!clearStanding(h.point)){continue;}addNode(h.point);const n=nearest(h.point,.03);if(!n)continue;for(const other of nodes)if(other!==n&&Math.hypot(other.x-n.x,other.z-n.z)<4.1&&Math.abs(other.y-n.y)<4.1&&!n.neighbors.some(l=>l.id===other.id)){n.neighbors.push({id:other.id});other.neighbors.push({id:n.id});}}await yieldIf('stairs',j,route.length);}}
  const padNodes=world.pads.map(p=>nearest(p,4.1));
  for(let a=0;a<world.pads.length;a++)for(let b=0;b<world.pads.length;b++){if(a===b||!padNodes[a]||!padNodes[b])continue;const active=[],sim=flightWorld(active,world.pads);sim.state.home=a;sim.recover();if(!sim.launch(b))continue;let ok=false;for(let i=0;i<1800;i++){active.splice(0,active.length,...nearby(sim.state,3));sim.step(STEP,{x:0,z:0});metrics.physicalSteps++;if(sim.state.falls)break;if(sim.state.grounded&&!sim.state.flight){ok=dist(sim.state,world.pads[b])<4;break;}if(i%120===0)await yieldIf('pods',a*world.pads.length+b,world.pads.length**2);}if(ok){const link={id:padNodes[b].id,launchTo:b,launchFrom:a,cost:100};padNodes[a].neighbors.push(link);podLinks.set(a+':'+b,link);metrics.podLinks++;}await yieldIf('pods',a*world.pads.length+b+1,world.pads.length**2);}
  aborted(signal,rev);ready=true;Object.assign(metrics,{ready:true,nodes:nodes.length,buildSeconds:(performance.now()-start)/1000});onProgress?.({phase:'ready',completed:nodes.length,total:nodes.length,message:'Battle routes ready'});return {...metrics};
 }
 async function findPath(from,to,{signal,maxVisited=12000,maxMs=Infinity,startNode}={}){
  const rev=revision,started=performance.now();metrics.pathRequests++;if(!ready)return {reachable:false,points:[],reason:'Routes are still being prepared',cost:Infinity,visited:0};const start=startNode||connectedStart(from),target=aroundObjective(to,from);if(!start||!target)return {reachable:false,points:[],reason:'No supported starting point or objective approach',cost:Infinity,visited:0};
  const heap=new Heap(),scores=new Map([[start.id,0]]),parents=new Map(),closed=new Set();heap.push(start.id,0);let last=performance.now();
  while(heap.size&&closed.size<maxVisited&&performance.now()-started<maxMs){aborted(signal,rev);const {id}=heap.pop();if(closed.has(id))continue;closed.add(id);const a=nodes[id];if(id===target.id){const reverse=[],ids=[id];let back=id;while(parents.has(back)){const entry=parents.get(back);reverse.push(entry);back=entry.from;ids.push(back);}const chain=ids.reverse(),points=[point(start)];for(let i=1;i<chain.length;i++){const link=parents.get(chain[i]);if(link.launchTo!==undefined)points.push({...point(world.pads[link.launchFrom]),launchTo:link.launchTo},point(world.pads[link.launchTo]));points.push(point(nodes[chain[i]]));}return {reachable:true,points,cost:scores.get(id),reason:'A supported route is available',visited:closed.size,revision:rev};}
   for(const link of a.neighbors){if(closed.has(link.id))continue;const b=nodes[link.id];if(link.launchTo===undefined&&!edge(a,b))continue;const score=scores.get(id)+(link.cost??dist(a,b));if(score>=(scores.get(b.id)??Infinity))continue;scores.set(b.id,score);parents.set(b.id,{from:id,...link});heap.push(b.id,score+Math.hypot(b.x-target.x,b.z-target.z)*.4);}
   if(performance.now()-last>8){await new Promise(r=>setTimeout(r,0));last=performance.now();}
  }
  metrics.failedPaths++;return {reachable:false,points:[],reason:performance.now()-started>=maxMs?'Route search time budget reached':closed.size>=maxVisited?'Route search reached its work limit':'No walkable or validated pod route reaches this objective',cost:Infinity,visited:closed.size,revision:rev};
 }
 function path(from,to,options){const requestedRevision=revision,origin=point(from),destination={...to},task=queue.then(async()=>{aborted(options?.signal,requestedRevision);const start=connectedStart(origin),target=aroundObjective(destination,origin),cacheKey=start?.id+':'+target?.id;if(start&&target&&pathCache.has(cacheKey))return pathCache.get(cacheKey);const result=await findPath(origin,destination,{...options,startNode:start});if(start&&target&&result.reason!=='Route search time budget reached'){if(pathCache.size>=384)pathCache.delete(pathCache.keys().next().value);pathCache.set(cacheKey,result);}return result;});queue=task.catch(()=>{});return task;}
 async function reachable(from,objectives,options){const results=[];for(const o of objectives){const route=await path(from,o,options);results.push({id:o.id,...route});}return results;}
 function invalidateSegment(from,to){const a=nearest(from),b=nearest(to);if(a&&b)edges.set(Math.min(a.id,b.id)+':'+Math.max(a.id,b.id),false);pathCache.clear();}
 function safeStep(from,dx,dz,distance=1){const p={x:from.x+dx*distance,y:from.y+.6,z:from.z+dz*distance},hit=floor(p,1.2);return !!hit&&Math.abs(hit.point.y-from.y)<.55&&clearStanding(point(hit.point));}
 function dispose(){disposed=true;revision++;ready=false;neutral.dispose();bins.clear();proxiesByMesh.clear();entries.length=0;nodes.length=0;}
 return {rebuild,path,nearest,reachable,nearby,lineOfSight,safeStep,invalidateSegment,dispose,get ready(){return ready;},get stats(){return {...metrics};},get nodes(){return nodes.map(point);}};
}
