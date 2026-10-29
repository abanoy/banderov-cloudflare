import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import * as T from '../vendor/three.module.js';
import {makeWorld} from '../floating-castle/world.js';
import {flightWorld} from '../floating-castle/flight.js';
// Canvas is only a texture fixture; collision uses the actual scene triangles.
globalThis.document={createElement(){return {width:0,height:0,getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}};}};
const world=makeWorld(new T.Scene()),report={scope:'Actual floating-castle meshes, fixed120Hz physics; no native input, textures, audio or browser FPS proof.',routes:[],checks:[],failures:[]};
function depart(from,to){const sim=flightWorld(world.solids,world.pads);sim.state.home=from<2?from:0;sim.recover();if(from>=2)Object.assign(sim.state,{x:world.pads[from].x,y:world.pads[from].y,z:world.pads[from].z});assert.equal(sim.nearPad(),from);const start=performance.now();assert(sim.launch(to));sim.launchMs=performance.now()-start;return sim;}
try{
 for(let from=0;from<world.pads.length;from++)for(let to=0;to<world.pads.length;to++)if(from!==to){
  const sim=depart(from,to),s=sim.state;let peak=s.y,rising=false,falling=false,steps=0;
  while(s.flight&&steps++<2400){const y=s.y;sim.step(1/120,{x:0,z:0});peak=Math.max(peak,s.y);rising||=s.y>y;falling||=s.y<y;}
  const row={from,to,peak,steps,rising,falling,landed:sim.nearPad(),falls:s.falls,launchInfo:sim.launchInfo,launchMs:sim.launchMs,final:{x:s.x,y:s.y,z:s.z}};report.routes.push(row);
  row.ok=rising&&falling&&s.grounded&&s.falls===0&&sim.nearPad()===to;if(!row.ok)console.log('Blocked arc',JSON.stringify(row));
 }
 assert(report.routes.every(r=>r.ok),'Some destination arcs are obstructed');report.checks.push('All directed launch-pad arcs land on their selected destination');
 const before=JSON.parse(fs.readFileSync(new URL('./fixtures/pod-arcs-before-clearance.json',import.meta.url),'utf8'));assert.equal(before.routes.filter(r=>!r.ok).length,2);for(const old of before.routes.filter(r=>r.ok)){const row=report.routes.find(r=>r.from===old.from&&r.to===old.to);for(const k of ['peak','steps','final'])assert.deepEqual(row[k],old[k],'Previously clear arc preserved: '+old.from+' -> '+old.to+' '+k);}report.checks.push('All88 previously clear arcs preserve exact peak, steps and landing coordinates');
 for(const phase of ['rising','falling']){
  const sim=depart(0,1),s=sim.state;let budget=1600;while(s.phase!==phase&&budget-->0)sim.step(1/120,{x:0,z:0});assert(budget>0);
  const baseline=depart(0,1);while(baseline.state.time<s.time-.001)baseline.step(1/120,{x:0,z:0});const old=s.z;
  for(let i=0;i<30;i++){sim.step(1/120,{x:0,z:1});baseline.step(1/120,{x:0,z:0});}
  assert(s.manual&&s.z>old,'Immediate steering during '+phase);assert.equal(s.y,baseline.state.y,'Steering preserves gravity during '+phase);
  report.checks.push('Manual '+phase+' steering preserves vertical arc');
 }
 const missed=depart(0,2);let budget=3000;while(!missed.state.falls&&budget-->0)missed.step(1/120,{x:0,z:1});assert(budget>0&&missed.state.falls===1&&missed.state.grounded&&missed.state.home===0&&missed.nearPad()===0);assert(!missed.state.flight&&!missed.state.manual);report.checks.push('Steering off the islands recovers to departure castle with clean flight state');
 const roof=new T.Mesh(new T.BoxGeometry(10000,10,10000),new T.MeshBasicMaterial());roof.position.y=12;roof.updateMatrixWorld(true);const solids=[roof],enclosed=flightWorld(solids,[{x:0,y:0,z:0,r:6},{x:80,y:0,z:0,r:6}]);assert(enclosed.launch(1));assert.deepEqual(enclosed.launchInfo,{clear:false,duration:7.2,attempts:7});enclosed.step(1/120,{x:0,z:1});assert(enclosed.state.manual&&enclosed.state.vz>0);enclosed.recover();roof.visible=false;assert(enclosed.launch(1));assert(enclosed.launchInfo.clear&&enclosed.launchInfo.attempts===1);enclosed.recover();roof.visible=true;assert(enclosed.launch(1));assert(!enclosed.launchInfo.clear);enclosed.recover();solids.length=0;assert(enclosed.launch(1));assert(enclosed.launchInfo.clear);roof.geometry.dispose();roof.material.dispose();report.checks.push('Enclosed pads keep manual launch; visibility and changed geometry are rechecked every launch');
 report.passed=true;
}catch(e){report.passed=false;report.failures.push({message:e.message,stack:e.stack});process.exitCode=1;console.error(e.message);}
fs.writeFileSync(new URL('../review/pod-arc-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,routes:report.routes.length,checks:report.checks}));
