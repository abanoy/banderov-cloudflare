import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';
import {createBattleCombat,createBattleCollision} from '../floating-castle/battle-combat.js';
import {castleShieldVolumes} from '../floating-castle/battle-shields.js';
import {flightWorld} from '../floating-castle/flight.js';
globalThis.document={createElement(){return {style:{},getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const numberOption=(name,fallback)=>{const arg=process.argv.find(a=>a.startsWith('--'+name+'='));return arg===undefined?fallback:Number(arg.slice(name.length+3));};
const level=numberOption('level',20),seed=numberOption('seed',685637696),customSeed=process.argv.some(a=>a.startsWith('--level=')||a.startsWith('--seed='));
assert(Number.isInteger(level)&&level>=1&&level<=100);assert(Number.isInteger(seed)&&seed>=0&&seed<=4294967294);
const generated=process.argv.includes('--generated'),landing=process.argv.includes('--landing'),leave=process.argv.includes('--leave'),report={passed:false,generated,landing,level,seed,plans:[],results:[],failures:[],scope:'Actual roster/fleet defense recruitment, routes, shared walking, battery mount and firing. Controlled breach starts one stationary enemy at a supported battery-visible point (or first landing in the fallback case) with that shield depleted and 10000HP; inactive actors have respawns disabled; only guard and a stationary intruder target live; target excluded from bot movement so projectile knockback does not relocate the fixture. No manual guard path/mount or position changes after reset. Bot handheld firing callback no-op, chariots omitted, explicit simulated time. Not native/full contested battle proof.'};let nav,roster,fixtureGuard;const requests=[];
try{
 const {makeWorld}=await import('../floating-castle/world.js'),scene=new T.Scene(),world=makeWorld(scene),construction=createConstruction(world);
 if(generated)for(let home=0;home<2;home++){const p=await verifiedBattleCastlePlan({construction,home,level,seed:seed+home});construction.apply(home,p.layout,p.options);report.plans.push({home,level,requestedSeed:seed+home,acceptedSeed:p.seed,family:p.family,defenses:p.layout.filter(p=>['cannon','heavyCannon','beacon'].includes(p.type)).length,navigation:p.navigation});}
 nav=createBattleNavigation(world);const audit=new Proxy(nav,{get(target,key){if(key==='path')return async(from,to,options)=>{const task=fixtureGuard?.defenseTask,result=await nav.path(from,to,options);requests.push({task,walkingOnly:!!options?.walkingOnly,reachable:result.reachable,reason:result.reason,visited:result.visited});return result;};return Reflect.get(target,key);}});roster=createBattleBots({world,navigation:audit,playerPhysics:flightWorld(world.solids,world.pads),objectives:[],fire(){}});roster.configure(8);
 const fleet=createBattleFleet({world,scene,actors:roster.actors,navigation:audit}),combat=createBattleCombat({actors:roster.actors,objectives:[],mounts:fleet.mounts,solids:world.solids,dynamicSolids:fleet.dynamicSolids,shieldVolumes:castleShieldVolumes(world)});fleet.setCombat(combat);report.prepared=await nav.rebuild();
 for(let home=0;home<2;home++){
  fleet.reset();roster.reset({launchHuman:false});combat.start();combat.state.shields[home]=0;
  const guard=roster.bots.find(a=>a.team===home&&a.ordinal===4),intruder=roster.bots.find(a=>a.team!==home&&a.ordinal===4);
  for(const a of roster.actors)if(a!==guard&&a!==intruder){a.alive=false;a.hp=0;a.respawnAt=Infinity;}
  fixtureGuard=guard;roster.bots.splice(roster.bots.indexOf(intruder),1);intruder.physics.state.home=home;intruder.physics.recover();
  if(!landing){const collision=createBattleCollision(world.solids,fleet.dynamicSolids);let breach=null;
   for(const w of fleet.mounts.filter(w=>w.team===home&&!w.ship&&(!generated||w.id.startsWith('custom-')))){const muzzle=w.swivel?w.swivel.localToWorld(new T.Vector3(0,.95,5.5)):w.root.localToWorld(w.local.clone()),root=w.root.getWorldPosition(new T.Vector3());breach=nav.nodes.filter(n=>Math.hypot(n.x-world.pads[home].x,n.z-world.pads[home].z)<105&&Math.abs(n.y-world.pads[home].y)<.3&&Math.hypot(n.x-root.x,n.z-root.z)>8&&Math.hypot(n.x-root.x,n.z-root.z)<24).find(n=>!collision.firstHit(muzzle,new T.Vector3(n.x,n.y+1,n.z),w.ignore));if(breach){report.breaches??=[];report.breaches.push({home,gun:w.id,point:breach});break;}}
   assert(breach,'Fixture needs a supported breach with a battery sight line');Object.assign(intruder.state,{x:breach.x,y:breach.y,z:breach.z});
  }intruder.hp=10000;intruder.maxHp=10000;intruder.spawnPending=false;intruder.decisionAt=Infinity;
  let frames=0;
  for(;frames<3600;frames++){const beforeGuard={x:guard.state.x,y:guard.state.y,z:guard.state.z,grounded:guard.state.grounded,flight:guard.state.flight,pathIndex:guard.pathIndex,previous:guard.path[guard.pathIndex-1],target:guard.path[guard.pathIndex],task:guard.defenseTask};fleet.step(1/60);roster.update(1/60,combat.state.time,{objectives:[],projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);if(process.argv.includes('--trace')&&beforeGuard.grounded&&!guard.state.grounded){report.supportLoss??=[];report.supportLoss.push({home,frame:frames,before:beforeGuard,after:{x:guard.state.x,y:guard.state.y,z:guard.state.z,flight:guard.state.flight},path:guard.path.slice(Math.max(0,guard.pathIndex-2),guard.pathIndex+3)});}if(frames%6===0)await new Promise(r=>setTimeout(r,0));if(guard.mount?.gun&&guard.shots>0)break;}
  const w=fleet.mounts.find(w=>w.id===guard.mount?.gun),record={home,frames,seconds:combat.state.time,guard:guard.name,role:guard.role,reason:guard.reason,gun:w?.id,operator:w?.operator?.name,shots:guard.shots,guardFalls:guard.state.falls,intruderFalls:intruder.state.falls,intruderHp:intruder.hp,position:{x:guard.state.x,y:guard.state.y,z:guard.state.z},defenseTask:guard.defenseTask,requests:requests.slice()};report.results.push(record);console.log(JSON.stringify(record));
  if(landing){assert(!w||guard.shots>0,'Guard must not occupy a blind battery');assert.equal(guard.state.falls,0);assert.equal(intruder.state.falls,0);roster.bots.push(intruder);continue;}assert(w&&w.operator===guard&&guard.shots>0,'Guard must autonomously enter and fire a battery');assert.equal(guard.state.falls,0);assert.equal(intruder.state.falls,0);
  let cover=null;if(leave){intruder.alive=false;intruder.hp=0;intruder.respawnAt=Infinity;}else{
   const collision=createBattleCollision(world.solids,fleet.dynamicSolids),muzzle=w.swivel?w.swivel.localToWorld(new T.Vector3(0,.95,5.5)):w.root.localToWorld(w.local.clone());
   cover=nav.nodes.find(n=>Math.abs(n.y-world.pads[home].y)<.3&&Math.hypot(n.x-world.pads[home].x,n.z-world.pads[home].z)<100&&collision.firstHit(muzzle,new T.Vector3(n.x,n.y+1,n.z),w.ignore));assert(cover,'Fixture needs a supported point behind real cover');Object.assign(intruder.state,{x:cover.x,y:cover.y,z:cover.z});
  }
  for(let i=0;i<300;i++){fleet.step(1/60);roster.update(1/60,combat.state.time,{objectives:[],projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);if(i%6===0)await new Promise(r=>setTimeout(r,0));}
  record.blindRelease={cause:leave?'intruder departed':'intruder behind cover',released:w.operator!==guard,seconds:combat.state.time,cover,role:guard.role};assert(record.blindRelease.released,'Guard must release a battery with no shot at the covered intruder');roster.bots.push(intruder);
  fleet.reset();assert(fleet.mounts.every(m=>m.recruitAt===0&&m.alertUntil===0&&m.blindSince===null),'Defense retry state must reset');
 }
 report.passed=true;
}catch(e){report.failures.push({message:e.message,stack:e.stack});process.exitCode=1;}
finally{roster?.dispose();nav?.dispose();fs.writeFileSync(`review/autonomous-castle-defense-${generated?'generated':'default'}${landing?'-landing':leave?'-leave':''}${customSeed?'-level'+level+'-seed'+seed:''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,generated,results:report.results,failures:report.failures}));}
