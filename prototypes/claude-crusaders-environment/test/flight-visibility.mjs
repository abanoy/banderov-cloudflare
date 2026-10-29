import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {flightWorld as before} from './fixtures/flight-before-visibility.mjs';
import {flightWorld as after} from '../floating-castle/flight.js';
import {makeWorld} from '../floating-castle/world.js';
globalThis.document={createElement(){return {getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const world=makeWorld(new T.Scene());let compared=0;
function same(a,b,input){assert.equal(a.step(1/120,input),b.step(1/120,input));assert.deepEqual(a.state,b.state);compared++;}
for(let from=0;from<world.pads.length;from++)for(let to=0;to<world.pads.length;to++)if(from!==to){
 const a=before(world.solids,world.pads),b=after(world.solids,world.pads);
 for(const sim of [a,b]){sim.state.home=from<2?from:0;sim.recover();Object.assign(sim.state,{x:world.pads[from].x,y:world.pads[from].y,z:world.pads[from].z});assert(sim.launch(to));}
 assert.deepEqual(a.launchInfo,b.launchInfo);let remaining=2400;while(a.state.flight&&remaining-->0)same(a,b,{x:0,z:0});assert(remaining>0);assert.equal(b.nearPad(),to);
}
const a=before(world.solids,world.pads),b=after(world.solids,world.pads);
for(let i=0;i<5000;i++){
 if(i%1000===0){a.recover();b.recover();if(i%2000===0){a.launch(2);b.launch(2);}}
 const input={x:Math.sin(i*.023),z:Math.cos(i*.037)};same(a,b,input);
 if(i%100===0){assert.deepEqual(a.floor(a.state.x,a.state.y+4,a.state.z,200),b.floor(b.state.x,b.state.y+4,b.state.z,200));}
}
const group=new T.Group(),floor=new T.Mesh(new T.BoxGeometry(30,2,30),new T.MeshBasicMaterial());floor.position.y=-1;group.add(floor);group.updateMatrixWorld(true);const solids=[floor],pads=[{x:0,y:0,z:0,r:6}];const old=before(solids,pads),next=after(solids,pads);
for(const visible of [true,false,true,false,true]){group.visible=visible;assert.deepEqual(old.floor(0,2,0,10),next.floor(0,2,0,10));same(old,next,{x:.5,z:0});}
group.visible=true;solids.length=0;assert.equal(next.floor(0,2,0,10),null);solids.push(floor);assert(next.floor(0,2,0,10));
const raycast=floor.raycast;floor.raycast=()=>{throw Error('fixture ray failure');};next.recover();assert.throws(()=>next.step(1/120,{x:0,z:0}),/fixture ray failure/);floor.raycast=raycast;group.visible=false;assert.equal(next.floor(0,2,0,10),null,'Exception must not retain step visibility');
function run(factory,idle=false){const sim=factory(world.solids,world.pads),start=performance.now();for(let i=0;i<3000;i++){if(i%400===0)sim.recover();sim.step(1/120,idle?{x:0,z:0}:{x:Math.sin(i*.025),z:Math.cos(i*.035)});}return performance.now()-start;}
const timings={};for(const idle of [false,true]){run(before,idle);run(after,idle);const old=[],next=[];for(let i=0;i<5;i++){if(i%2){next.push(run(after,idle));old.push(run(before,idle));}else{old.push(run(before,idle));next.push(run(after,idle));}}const median=a=>a.slice().sort((x,y)=>x-y)[2],x=median(old),y=median(next);timings[idle?'idle':'moving']={beforeMs:x,afterMs:y,percentLower:100*(x-y)/x,old,next};}
const report={passed:true,exactStatesCompared:compared,directedRoutes:90,dynamicVisibilityAndSolids:true,exceptionCleanup:true,timings,scope:'Actual floating-castle triangles and complete120Hz physics states; Node3000-step workloads, not browserFPS/GPU or universal collision acceptance.'};fs.writeFileSync('review/flight-visibility-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
