import assert from 'node:assert/strict';
import * as T from './vendor/three.module.js';
import {wavePlan,starterLayout,parseDesign} from './wave-rules.js';
import {makeWorld} from './runtime/world.js';
import {createConstruction} from './runtime/castle-construction.js';
import {chargeOrb} from './runtime/charge-orb.js';
import {createBattleNavigation} from './runtime/battle-navigation.js';
import {flightWorld} from './runtime/flight.js';
import fs from 'node:fs';
assert.deepEqual(wavePlan(3),wavePlan(3));assert.notDeepEqual(wavePlan(3),wavePlan(4));assert.equal(wavePlan(100).length,24);
assert.equal(starterLayout().filter(p=>p.type==='core').length,1);assert.equal(starterLayout().filter(p=>p.type==='gate').length,4);
assert.throws(()=>parseDesign('{"version":7}'));assert.equal(parseDesign(JSON.stringify({format:'crusaders-layout',version:1,options:{level:10,material:'fortress'},layout:starterLayout()})).layout.length,100);
console.log('PASS seeded escalation, bound, four gates, required core and version contract');
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()];castles[1].position.x=300;
const castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{x:0,y:12,z:0,radius:8.4,crown:true});});
const world={mats,castles,castleHearts,solids:[],occluders:[],pads:[{x:0,y:.77,z:40,r:2},{x:300,y:.77,z:40,r:2}],routes:[]},construction=createConstruction(world);construction.apply(0,starterLayout(),{level:10});castles.forEach(c=>c.updateMatrixWorld(true));const nav=createBattleNavigation(world);await nav.rebuild();
const core={x:20,y:.77,z:0,radius:2};const evidence=[];
for(const from of [{x:0,y:.77,z:36},{x:32,y:.77,z:0},{x:0,y:.77,z:-28},{x:-32,y:.77,z:0}]){const p=await nav.path(from,core);assert(p.reachable,p.reason);assert(!p.points.some(p=>p.launchTo!==undefined));const sim=flightWorld(world.solids,[{...p.points[0],r:2}]);for(const target of p.points.slice(1)){let count=0;while(Math.hypot(sim.state.x-target.x,sim.state.z-target.z)>.3&&count++<2000){const dx=target.x-sim.state.x,dz=target.z-sim.state.z,d=Math.hypot(dx,dz);sim.step(1/120,{x:dx/d*.5,z:dz/d*.5});assert.equal(sim.state.falls,0);}assert(count<2000);assert(Math.abs(sim.state.y-target.y)<.3);}evidence.push({from,points:p.points.length,final:{...sim.state}});}
fs.writeFileSync(new URL('./review/routes.json',import.meta.url),JSON.stringify({passed:true,stats:nav.stats,evidence},null,2));console.log('PASS four actual-geometry approach routes walked with collision physics');nav.dispose();



