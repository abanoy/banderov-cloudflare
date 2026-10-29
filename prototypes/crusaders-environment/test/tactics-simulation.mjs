import * as T from '../vendor/three.module.js';
import {makeWorld} from '../floating-castle/world.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
import {createBattleCombat} from '../floating-castle/battle-combat.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';
import assert from 'node:assert/strict';import fs from 'node:fs';
globalThis.document={createElement(){return {width:0,height:0,getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}};}};
const scene=new T.Scene(),world=makeWorld(scene),nav=createBattleNavigation(world),objectives=world.orbTowers.map((o,id)=>({id,label:o.label||'T'+id,x:o.x,y:o.y||0,z:o.z,radius:o.captureRadius||(id===4?15:14),damage:o.damage}));
let combat;const bots=createBattleBots({world,navigation:nav,playerPhysics:flightWorld(world.solids,world.pads),objectives,fire:(a,t)=>combat.fire(a,t)}),fleet=createBattleFleet({world,scene,actors:bots.actors,navigation:nav});
combat=createBattleCombat({actors:bots.actors,objectives,solids:world.solids,dynamicSolids:fleet.ships.flatMap(s=>s.parts),mounts:fleet.mounts,vehicles:fleet.ships,respawn:a=>bots.respawn(a)});fleet.setCombat(combat);
await nav.rebuild();await bots.prepare();console.log('Graph',nav.stats);bots.reset({launchHuman:false});fleet.reset();combat.start();
const samples=[];for(let i=0;i<6000;i++){fleet.step(1/60);bots.update(1/60,combat.state.time,{objectives,projectiles:combat.projectiles});combat.step(1/60);if(i%12===0)await new Promise(r=>setTimeout(r,0));if(i%600===599){const sample={time:combat.state.time,fleet:fleet.snapshot(),captures:combat.state.captures,actors:bots.snapshot().actors};samples.push(sample);console.log('t',sample.time,'ships',sample.fleet.ships.map(s=>[s.stage,s.x,s.y,s.z]),'captures',sample.captures);}}
fs.writeFileSync('review/tactics-simulation.json',JSON.stringify({scope:'Actual geometry and fixed-step simulation; no-op texture canvas, no native user input.',samples,combat:combat.snapshot()},null,2));
assert(samples.some(s=>s.fleet.ships.some(v=>Math.abs(v.z)>220&&v.y<12)),'AI must reach and descend to an outer island');
assert(samples.some(s=>s.actors.some(a=>!a.human&&!a.flight&&a.grounded&&Math.abs(a.z)>200)),'AI crew must land on real outpost ground');
assert(objectives.slice(0,4).some(o=>o.owner>=0),'A delivered crew must capture an outer silo');assert(combat.state.captures>0);assert.equal(objectives.length,5);assert.equal(objectives[4].damage,objectives[0].damage*4);
assert(samples.some(s=>s.actors.some(a=>a.role==='Castle guard'&&a.y>70)),'Guard must climb inside castle');assert(samples.some(s=>s.actors.some(a=>a.role==='Raider'&&a.grounded&&!a.flight&&a.y>70)),'Raider must reach elevated enemy castle');console.log('PASS transport arrival, actual crew landing, captures, five silos and 4:1 damage');
