import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {flightWorld} from '../floating-castle/flight.js';
import {inspectCastle,structuralHints} from '../floating-castle/castle-navigation.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE=.77,DT=1/120,options={level:20,material:'fortress'};
const sourceNames=['castle-construction.js','castle-curves.js','castle-navigation.js','flight.js'];
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
const report={scope:'Independent Node fixtures against actual displayed construction collider triangles and unchanged flightWorld at 120 Hz. Explicit initial actor positions; no native browser input, screenshots, jumping, box collision proxies or arbitrary-layout guarantee. Preview/apply parity compares every transformed collider vertex and index.',startedAt:new Date().toISOString(),sourceHashes:{},checks:[],failures:[]};
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()]));
const castles=[new T.Group(),new T.Group()],castleHearts=[],solids=[],occluders=[];
for(let home=0;home<2;home++){const c=castles[home];c.add(new T.Group(),new T.Group());c.position.set(home?205:-205,55,home?-22:22);c.rotation.y=home?-Math.PI/2:Math.PI/2;castleHearts.push(chargeOrb(c,mats,{radius:8.4,crown:true}));c.updateMatrixWorld(true);}
const construction=createConstruction({mats,castles,castleHearts,solids,occluders});
const p=(x,z,layer,type,rotation=0,extra={})=>({x,z,layer,type,rotation,...extra});
const core=p(1,1,0,'core'),cell={x:6,z:6},cx=4,cz=0;
const ray=new T.Raycaster(),normal=new T.Vector3();
function cast(view,x,y,z,dx,dy,dz,range){ray.set(new T.Vector3(x,y,z),new T.Vector3(dx,dy,dz).normalize());ray.far=range;return ray.intersectObjects(view.colliders,false);}
function floor(view,x,y,z,range=40){return cast(view,x,y,z,0,-1,0,range).find(h=>normal.copy(h.face.normal).transformDirection(h.object.matrixWorld).y>.5);}
function rotated(x,z,r,ox=cx,oz=cz){const a=r*Math.PI/2;return {x:ox+x*Math.cos(a)+z*Math.sin(a),z:oz-x*Math.sin(a)+z*Math.cos(a)};}
function localPoint(x,y,z,r=0,ox=cx,oz=cz){return {...rotated(x,z,r,ox,oz),y};}
function actor(view,start){const sim=flightWorld(view.colliders,[{...start,r:2},{...start,r:2}]);return {sim,steps:0,airborne:0,maxY:start.y,minY:start.y};}
function step(a,input){a.sim.step(DT,input);a.steps++;a.airborne+=!a.sim.state.grounded;a.maxY=Math.max(a.maxY,a.sim.state.y);a.minY=Math.min(a.minY,a.sim.state.y);}
function drive(a,dx,dz,count){for(let i=0;i<count;i++)step(a,{x:dx,z:dz});return a.sim.state;}
function walk(a,target){let budget=1600;while(Math.hypot(target.x-a.sim.state.x,target.z-a.sim.state.z)>.035&&budget-->0){const s=a.sim.state,dx=target.x-s.x,dz=target.z-s.z,d=Math.hypot(dx,dz),strength=Math.min(1,d/(10*DT));step(a,{x:dx/d*strength,z:dz/d*strength});}assert(budget>0,'Walking fixture stalled before '+JSON.stringify(target));assert(a.sim.state.grounded,'Walking fixture lost actual support');if(target.y!==undefined)assert(Math.abs(a.sim.state.y-target.y)<.08,'Walking fixture reached wrong height');}
function evidence(a){const s=a.sim.state;return {steps:a.steps,airborneSteps:a.airborne,falls:s.falls,grounded:s.grounded,final:{x:s.x,y:s.y,z:s.z},minY:a.minY,maxY:a.maxY};}
async function check(name,fn){try{const details=await fn();report.checks.push({name,...details});console.log('PASS '+name);}catch(e){report.failures.push({name,message:e.message,stack:e.stack});console.error('FAIL '+name+': '+e.message);}}
function view(layout){return construction.preview(0,[...layout,core],options);}
function close(v){v.dispose();}
function signatures(meshes,inverse=new T.Matrix4()){
 return meshes.map(o=>{const m=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld),attr=o.geometry.attributes.position,vertices=[],v=new T.Vector3();for(let i=0;i<attr.count;i++){v.fromBufferAttribute(attr,i).applyMatrix4(m);vertices.push(...v.toArray().map(n=>Math.round(n*1e5)/1e5));}return {vertices,index:o.geometry.index?Array.from(o.geometry.index.array):null};});
}
try{
 for(const name of sourceNames)report.sourceHashes[name]=hash(name);
 await check('Circular terrace has real radial support and empty square corners',()=>{
  const v=view([p(6,6,2,'roundTerrace')]),top=BASE+16,inside=[],outside=[];
  try{assert(Math.abs(floor(v,cx,top+.15,cz).point.y-top)<.001);for(let i=0;i<24;i++){const angle=(i+.37)*Math.PI/12;for(const [radius,dest] of [[3.8,inside],[4.1,outside]]){const x=cx+Math.sin(angle)*radius,z=cz+Math.cos(angle)*radius,h=floor(v,x,top+.15,z);dest.push({radius,angle,x,z,y:h?.point.y??null});if(radius<4)assert(h&&Math.abs(h.point.y-top)<.001);else assert(!h||h.point.y<top-4);}}
   const corners=[];for(const x of [-3.5,3.5])for(const z of [-3.5,3.5]){const h=floor(v,cx+x,top+.15,cz+z);assert(!h||h.point.y<top-4,'A square support must not fill a circular corner');corners.push({x,z,y:h?.point.y??null});}return {top,centre:true,inside,outside,corners};
  }finally{close(v);}
 });
 await check('Circle top circuit is supported and walking beyond its curved edge falls',()=>{
  const v=view([p(6,6,2,'roundTerrace')]),top=BASE+16;
  try{const a=actor(v,{x:cx,y:top,z:cz});for(let i=0;i<=24;i++){const angle=i*Math.PI/12;walk(a,{x:cx+Math.sin(angle)*3.1,y:top,z:cz+Math.cos(angle)*3.1});}walk(a,{x:cx,y:top,z:cz});assert.equal(a.airborne,0);assert.equal(a.sim.state.falls,0);
   const b=actor(v,{x:cx+2,y:top,z:cz+2});drive(b,Math.SQRT1_2,Math.SQRT1_2,32);assert(b.airborne>0&&b.sim.state.y<top-.05,'The nonexistent corner must not support the player');return {circuit:evidence(a),cornerDrop:evidence(b)};
  }finally{close(v);}
 });
 await check('The actual circular masonry side blocks approach from every quadrant',()=>{
  const v=view([p(6,6,2,'roundTerrace')]);try{const attempts=[];for(let r=0;r<4;r++){const start=localPoint(7,BASE,1,r),direction=rotated(-1,0,r,0,0),a=actor(v,start);drive(a,direction.x,direction.z,120);const s=a.sim.state;assert(Math.hypot(s.x-cx,s.z-cz)>4.35);assert(Math.hypot(s.x-start.x,s.z-start.z)>1);assert.equal(a.airborne,0);assert(Math.abs(s.y-BASE)<.01);attempts.push(evidence(a));}return {attempts};}finally{close(v);}
 });
 await check('Four rotated stairs climb and descend a truly circular landing',()=>{
  const results=[];for(let r=0;r<4;r++){const [dx,dz]=[[0,-1],[-1,0],[0,1],[1,0]][r],layout=[p(6,6,0,'stairs',r),p(6+dx,6+dz,1,'roundTerrace')],v=view(layout);try{assert(!structuralHints(layout,options).some(i=>i.code==='missing-landing'));const start=localPoint(0,BASE,5,r),target=localPoint(0,BASE+8,-8,r),a=actor(v,start);walk(a,target);walk(a,start);assert.equal(a.airborne,0);assert.equal(a.sim.state.falls,0);results.push({rotation:r,...evidence(a)});}finally{close(v);}}return {results};
 });
 await check('Four rotated stair apertures cut the real circular upper slab and body',()=>{
  const results=[];for(let r=0;r<4;r++){const [dx,dz]=[[0,-1],[-1,0],[0,1],[1,0]][r],v=view([p(6,6,0,'stairs',r),p(6,6,1,'roundTerrace'),p(6+dx,6+dz,1,'floor')]);try{const start=localPoint(0,BASE,5,r),target=localPoint(0,BASE+8,-8,r),a=actor(v,start);walk(a,target);walk(a,start);assert.equal(a.airborne,0);assert.equal(a.sim.state.falls,0);results.push({rotation:r,...evidence(a)});}finally{close(v);}}return {results};
 });
 await check('Each rotated curved wall blocks its quarter arc and preserves the open half',()=>{
  const results=[];for(let r=0;r<4;r++){const v=view([p(6,6,0,'curvedWall',r)]);try{const start=localPoint(6,BASE,6,r),direction=rotated(-Math.SQRT1_2,-Math.SQRT1_2,r,0,0),blocked=actor(v,start);drive(blocked,direction.x,direction.z,120);const s=blocked.sim.state;assert(Math.hypot(s.x-cx,s.z-cz)>4.25);assert(blocked.maxY<BASE+.05);const clear=actor(v,localPoint(-6,BASE,-1,r));walk(clear,localPoint(6,BASE,-1,r));assert.equal(clear.airborne,0);assert.equal(clear.sim.state.falls,0);results.push({rotation:r,blocked:evidence(blocked),clear:evidence(clear)});}finally{close(v);}}return {results};
 });
 await check('Rotated rough banks have retaining toes and cannot be walked over',()=>{
  const results=[];for(let r=0;r<4;r++){const v=view([p(6,6,0,'embankment',r)]);try{const start=localPoint(0,BASE,7,r),direction=rotated(0,-1,r,0,0),a=actor(v,start);drive(a,direction.x,direction.z,180);const s=a.sim.state;assert(Math.hypot(s.x-start.x,s.z-start.z)>1);assert(Math.hypot(s.x-cx,s.z-cz)>4.3,'The raised toe must block entry');assert(a.maxY<BASE+.05,'Player may not climb the bank from the ground');assert.equal(a.airborne,0);const hit=cast(v,start.x,BASE+.65,start.z,direction.x,0,direction.z,6)[0];assert(hit,'Real toe triangles must block the same body-height ray as movement');const bank=v.root.children.find(o=>o.userData.cell?.type==='embankment'),bounds=new T.Box3().setFromObject(bank);assert(Math.abs(bounds.max.y-BASE-3.7)<.02,'The bank must remain half the 7.4 m wall height');results.push({rotation:r,...evidence(a),height:bounds.max.y-BASE,toeHit:{x:hit.point.x,y:hit.point.y,z:hit.point.z}});}finally{close(v);}}return {results};
 });
 await check('Outer bank plus full wall blocks entry while a gate-sized interruption stays open',()=>{
  const blockedView=view([p(6,6,0,'embankment'),p(6,5,0,'wall')]);let blocked;
  try{const a=actor(blockedView,{x:cx,y:BASE,z:7});drive(a,0,-1,240);assert(a.sim.state.z>4.3&&a.maxY<BASE+.05);blocked=evidence(a);}finally{close(blockedView);}
  const gateView=view([p(5,6,0,'embankment'),p(7,6,0,'embankment'),p(5,5,0,'wall'),p(6,5,0,'gate'),p(7,5,0,'wall')]);
  try{const a=actor(gateView,{x:cx,y:BASE,z:7});walk(a,{x:cx,y:BASE,z:-13});walk(a,{x:cx,y:BASE,z:7});assert.equal(a.airborne,0);assert.equal(a.sim.state.falls,0);return {blocked,gate:evidence(a)};}finally{close(gateView);}
 });
 await check('Round decoration retains its circular foundation without filling corners',()=>{
  const v=view([p(6,6,2,'cannon',1,{solid:true,footprint:'round'})]),top=BASE+16;try{const group=v.root.children.find(o=>o.userData.cell?.type==='cannon');assert.equal(group.userData.cell.footprint,'round');for(const [x,z] of [[3.2,0],[-3.2,0],[0,3.2],[0,-3.2]])assert(Math.abs(floor(v,cx+x,top+.15,cz+z).point.y-top)<.01);const corners=[];for(const x of [-3.5,3.5])for(const z of [-3.5,3.5]){const h=floor(v,cx+x,top+.15,cz+z);assert(!h||h.point.y<top-4);corners.push({x,z,y:h?.point.y??null});}return {footprint:group.userData.cell.footprint,corners};}finally{close(v);}
 });
 await check('Preview and both transformed homes apply exactly the same collider triangles',()=>{
  const layout=[p(6,6,2,'roundTerrace'),p(8,6,0,'curvedWall',1),p(6,9,0,'embankment',2),p(9,8,1,'cannon',3,{solid:true,footprint:'round'}),core],results=[];
  for(const home of [0,1]){const before=solids.slice(),v=construction.preview(home,layout,options);try{assert.deepEqual(solids,before,'Preview must not alter the live colliders');const expected=signatures(v.colliders);construction.apply(home,layout,options);const actual=solids.filter(o=>o.userData.construction&&o.userData.castleIndex===home),observed=signatures(actual,castles[home].matrixWorld.clone().invert());assert.deepEqual(observed,expected);results.push({home,colliders:actual.length,triangles:expected.reduce((n,o)=>n+(o.index?.length??o.vertices.length/3)/3,0),signature:crypto.createHash('sha256').update(JSON.stringify(expected)).digest('hex')});}finally{construction.restore(home);close(v);}assert.deepEqual(solids,before);}return {results};
 });
 await check('Route inspector walks round landings and diagnoses isolated rounded floors',async()=>{
  const layout=[p(8,8,0,'stairs'),p(8,7,1,'roundTerrace'),core],v=construction.preview(0,layout,options);let reachable;try{reachable=await inspectCastle(v,layout,options);assert(reachable.ok,JSON.stringify(reachable.issues));const roundRoute=reachable.routes.find(r=>r.id.startsWith('floor-')&&Math.abs(r.objective.y-BASE-8)<.01);assert(roundRoute?.ok,'The only elevated floor, a round terrace, must be a tested derived destination');assert(roundRoute.points.some(p=>Math.abs(p.x-20)<.01&&Math.abs(p.z-12)<1.01),'The route must find the physically continuous centre of the circular landing');}finally{close(v);}
  const isolated=[p(8,7,2,'roundTerrace'),core],bad=construction.preview(0,isolated,options);let disconnected;try{disconnected=await inspectCastle(bad,isolated,options);assert(!disconnected.ok);assert(disconnected.issues.some(i=>i.cell?.layer===2));}finally{close(bad);}return {reachable,disconnected};
 });
 report.passed=report.failures.length===0;
}catch(e){report.passed=false;report.failures.push({message:e.message,stack:e.stack});console.error(e);}
finally{report.finishedAt=new Date().toISOString();report.finalSourceHashes=Object.fromEntries(Object.keys(report.sourceHashes).map(name=>[name,hash(name)]));report.sourceStable=Object.keys(report.sourceHashes).length===sourceNames.length&&sourceNames.every(name=>report.sourceHashes[name]===report.finalSourceHashes[name]);if(!report.sourceStable){report.passed=false;report.failures.push({message:'Source changed during fixtures, or a required source was unavailable. Repeat after source freeze.'});}if(!report.passed)process.exitCode=1;fs.writeFileSync(new URL('../review/castle-curves.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log((report.passed?'PASS':'FAIL')+': '+report.checks.length+' curved collision groups');}
