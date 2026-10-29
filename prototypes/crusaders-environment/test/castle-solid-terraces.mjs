import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {flightWorld} from '../floating-castle/flight.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const report={scope:'Node closed-masonry and fixed120Hz traversal fixtures using actual construction and flightWorld. Explicit starting actor fixture; not native browser walking or arbitrary-design proof.',rows:[],failures:[],sourceHashes:{}};
for(const name of ['castle-construction.js','castle-rules.js','castle-curves.js'])report.sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
try{
 const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{x:-24,y:12,z:-24,radius:8.4,crown:true});}),solids=[],occluders=[],construction=createConstruction({mats,castles,castleHearts,solids,occluders});
 const x=8,z=8,cx=20,cz=16;
 for(let rotation=0;rotation<4;rotation++)for(const reversed of [false,true]){
  const dx=[0,-1,0,1][rotation],dz=[-1,0,1,0][rotation],stairs={x,z,layer:0,type:'stairs',rotation},cover={x,z,layer:1,type:'terrace',rotation:(rotation+1)%4},landing={x:x+dx,z:z+dz,layer:1,type:'terrace',rotation:0},core={x:2,z:2,layer:0,type:'core',rotation:0},layout=[stairs,cover,landing,core];
  construction.apply(0,reversed?layout.slice().reverse():layout);
  const sim=flightWorld(solids,[{x:cx-dx*4.8,y:.77,z:cz-dz*4.8,r:6}]),s=sim.state;
  Object.assign(s,{x:cx-dx*4.8,y:.77,z:cz-dz*4.8,grounded:true,home:0});let steps=0;
  const ramp=sim.floor(cx+dx*2,12,cz+dz*2,15);assert(ramp&&Math.abs(ramp.y-6.77)<.02);
  while((s.x-cx)*dx+(s.z-cz)*dz<6.9&&steps++<200){sim.step(1/120,{x:dx,z:dz});assert(s.grounded);assert.equal(s.falls,0);}
  assert(steps<200);assert(Math.abs(s.y-8.77)<.02);
  for(let i=0;i<steps;i++){sim.step(1/120,{x:-dx,z:-dz});assert(s.grounded);assert.equal(s.falls,0);}
  assert(Math.abs(s.y-.77)<.02);assert(Math.hypot(s.x-(cx-dx*4.8),s.z-(cz-dz*4.8))<.01);
  const bodies=solids.filter(o=>o.userData.solidTerrace&&o.userData.tierHeight);assert(bodies.length>0);assert(bodies.every(o=>o.geometry.type==='BoxGeometry'));
  construction.apply(0,[cover,landing,core]);const restored=flightWorld(solids,[{x:cx,y:0,z:cz,r:6}]).floor(cx+dx*2,12,cz+dz*2,15);assert(restored&&Math.abs(restored.y-8.77)<.02);
  report.rows.push({rotation,reversed,stepsEachWay:steps,rampHeight:ramp.y,restoredHeight:restored.y,closedMasonryBoxes:bodies.length});
 }
 const terrace={x,z,layer:3,type:'terrace',rotation:0},garden={...terrace,type:'garden',solid:true};
 const first=construction.preview(0,[terrace]),second=construction.preview(0,[garden]);
 const bodyMatrices=v=>v.colliders.filter(o=>o.userData.solidTerrace&&o.userData.tierHeight).map(o=>o.matrixWorld.elements);
 assert.deepEqual(bodyMatrices(first),bodyMatrices(second),'Replacing a terrace with a solid garden preserves its physical body');
 for(const v of [first,second]){const body=v.colliders.find(o=>o.userData.tierHeight===24);assert(body);assert.equal(body.scale.y,22.8);v.dispose();v.dispose();}
 assert.throws(()=>construction.preview(0,[{...garden,solid:'yes'}]));construction.restore(0);assert.equal(solids.length,0);assert.equal(occluders.length,0);report.passed=true;
}catch(error){report.passed=false;report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}
fs.writeFileSync(new URL('../review/castle-solid-terraces.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log((report.passed?'PASS':'FAIL')+': '+report.rows.length+' rotated solid-tier round trips plus replacement/restore');if(report.failures.length)console.error(report.failures[0].stack);
