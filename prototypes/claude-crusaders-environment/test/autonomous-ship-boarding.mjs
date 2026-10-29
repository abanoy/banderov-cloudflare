import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';
import {createBattleCombat} from '../floating-castle/battle-combat.js';
import {flightWorld} from '../floating-castle/flight.js';
globalThis.document={createElement(){return {style:{},getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const generated=process.argv.includes('--generated'),delivery=process.argv.includes('--delivery'),uncontested=process.argv.includes('--uncontested'),roundtrip=process.argv.includes('--roundtrip'),report={passed:false,generated,delivery,uncontested,roundtrip,boarded:[],failures:[],scope:'Actual 8v8 roster, fleet recruitment, route planning, shared walking solver and combat clock. Explicit simulated time, no manual boarding/path/position injection. No-op texture canvas and bot firing callback; chariots omitted to isolate fleet handoff. Not native-input/full multiplayer tactics proof.'};
let nav,roster;
try{
 const {makeWorld}=await import('../floating-castle/world.js'),scene=new T.Scene(),world=makeWorld(scene),construction=createConstruction(world);
 if(generated){report.plans=[];for(let home=0;home<2;home++){const p=await verifiedBattleCastlePlan({construction,home,level:20,seed:685637696+home});construction.apply(home,p.layout,p.options);report.plans.push({home,seed:p.seed,family:p.family,parts:p.layout.length});}}
 nav=createBattleNavigation(world);const objectives=world.orbTowers.map((o,id)=>({id,label:'Tower '+id,x:o.x,y:o.y??0,z:o.z,radius:id===4?15:14,owner:-1,progress:0}));
 roster=createBattleBots({world,navigation:nav,playerPhysics:flightWorld(world.solids,world.pads),objectives,fire(){}});roster.configure(8);
 const fleet=createBattleFleet({world,scene,actors:roster.actors,navigation:nav}),combat=createBattleCombat({actors:roster.actors,objectives});fleet.setCombat(combat);
 report.prepared=await nav.rebuild();await roster.prepare();fleet.reset();roster.reset({launchHuman:false});combat.start();
 const seen=new Set();let frames=0;
 for(;frames<7200;frames++){
  fleet.step(1/60);roster.update(1/60,combat.state.time,{objectives,projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);
  for(const a of roster.bots)if(a.mount?.ship&&!seen.has(a.id)){seen.add(a.id);const s=fleet.ships.find(s=>s.id===a.mount.ship);report.boarded.push({actor:a.id,name:a.name,team:a.team,ship:s.id,big:s.big,role:s.seats[a.mount.seat].role,time:combat.state.time,falls:a.state.falls});}
  if(frames%6===0)await new Promise(r=>setTimeout(r,0));
  if([0,1].every(team=>report.boarded.some(a=>a.team===team))&&report.boarded.some(a=>a.team===0&&a.big&&a.role==='Pilot'))break;
 }
 const pilotRecord=report.boarded.find(a=>a.team===0&&a.big&&a.role==='Pilot'),piloted=fleet.ships.find(s=>s.id===pilotRecord?.ship);
 if(piloted){const initialY=piloted.root.position.y;let extra=0;
  for(;extra<1200;extra++){fleet.step(1/60);roster.update(1/60,combat.state.time,{objectives,projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);if(extra%6===0)await new Promise(r=>setTimeout(r,0));if(piloted.stage!=='moored'&&piloted.root.position.y>=initialY+10)break;}
  report.departure={ship:piloted.id,departed:extra<1200,stage:piloted.stage,initialY,y:piloted.root.position.y,seconds:combat.state.time,pilot:piloted.seats[0].actor?.name,destination:piloted.destination?.id};assert(report.departure.departed,'AI crew helm must lift off after boarding');
 }
 if(delivery){
  if(uncontested){for(const a of roster.actors)if(a.team===1){a.alive=false;a.hp=0;a.respawnAt=Infinity;}report.scope+=' Opposing actors disabled after ordinary boarding/takeoff solely for uncontested destination capture; no capture state injection.';}
  const initialBoarded=report.boarded.filter(a=>a.ship===piloted.id&&a.role!=='Pilot'),seenExit=new Set();report.delivery=[];report.shipSamples=[];report.passengerSamples=[];
  for(let n=0;n<9000;n++){
   fleet.step(1/60);roster.update(1/60,combat.state.time,{objectives,projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);
   for(const record of initialBoarded){const a=roster.actors.find(a=>a.id===record.actor);if(!a.mount&&!seenExit.has(a.id)){seenExit.add(a.id);report.delivery.push({actor:a.id,time:combat.state.time,destination:piloted.destination?.id,shipPosition:piloted.root.position.toArray(),actorPosition:[a.state.x,a.state.y,a.state.z],falls:a.state.falls});}}
   if(n%600===0)report.passengerSamples.push({time:combat.state.time,actors:initialBoarded.map(r=>{const a=roster.actors.find(a=>a.id===r.actor);return {id:a.id,hp:a.hp,position:[a.state.x,a.state.y,a.state.z],grounded:a.state.grounded,flight:a.state.flight,falls:a.state.falls,objectiveId:a.objectiveId,role:a.role,reason:a.reason};})});if(n%600===0)report.shipSamples.push({time:combat.state.time,stage:piloted.stage,position:piloted.root.position.toArray(),destination:piloted.destination?.id,occupants:piloted.seats.map(s=>s.actor?.id??null)});
   if(n%6===0)await new Promise(r=>setTimeout(r,0));
   if(report.delivery.length){const o=objectives.find(o=>o.id===report.delivery[0].destination);if(uncontested?o.owner===0:initialBoarded.some(r=>{const a=roster.actors.find(a=>a.id===r.actor);return a.alive&&a.state.grounded&&!a.state.falls&&a.objectiveId===o.id&&Math.abs(a.state.y-o.y)<2&&Math.hypot(a.state.x-o.x,a.state.z-o.z)<o.radius;}))break;}
  }
  report.deliveryActors=roster.snapshot().actors;report.captureCrew=initialBoarded.map(r=>{const a=roster.actors.find(a=>a.id===r.actor);return {id:a.id,captures:a.captures,score:a.score,grounded:a.state.grounded,falls:a.state.falls,objectiveId:a.objectiveId};});report.deliveryObjectives=objectives.map(o=>({id:o.id,owner:o.owner,progress:o.progress}));
  assert(initialBoarded.length,'Crew delivery needs an autonomously boarded passenger/gunner');assert(report.delivery.length,'Crew ship must reach an island and disembark its AI passenger');if(uncontested){assert(objectives.some(o=>o.owner===0&&o.id===report.delivery[0].destination),'Delivered crew must complete uncontested island capture');assert(report.captureCrew.some(a=>a.captures>0&&a.grounded&&!a.falls&&a.objectiveId===report.delivery[0].destination),'Delivered actor must personally receive ordinary capture credit without falling');}else assert(report.deliveryActors.some(a=>initialBoarded.some(r=>r.actor===a.id)&&a.objectiveId===report.delivery[0].destination&&a.grounded&&!a.falls&&objectives.some(o=>o.id===a.objectiveId&&Math.abs(a.y-o.y)<2&&Math.hypot(a.x-o.x,a.z-o.z)<o.radius)),'Delivered crew must reach the capture approach');
 }
 if(roundtrip){
  assert(delivery,'Roundtrip extends the complete delivery case');let n=0;report.returnSamples=[];
  for(;n<7200&&!(piloted.stage==='moored'&&piloted.root.position.distanceTo(piloted.home)<1);n++){
   fleet.step(1/60);roster.update(1/60,combat.state.time,{objectives,projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);
   if(n%600===0)report.returnSamples.push({time:combat.state.time,stage:piloted.stage,position:piloted.root.position.toArray(),seats:piloted.seats.map(s=>s.actor?.id??null)});if(n%6===0)await new Promise(r=>setTimeout(r,0));
  }
  report.returned={stage:piloted.stage,time:combat.state.time,error:piloted.root.position.distanceTo(piloted.home),pilot:piloted.seats[0].actor?.id};assert.equal(piloted.stage,'moored','Empty AI crew ship returns to its actual home port');assert(report.returned.error<1);assert.equal(piloted.seats[0].actor?.id,pilotRecord.actor);
  for(let i=0;i<360;i++){fleet.step(1/60);roster.update(1/60,combat.state.time,{objectives,projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);if(i%6===0)await new Promise(r=>setTimeout(r,0));}assert.equal(piloted.stage,'moored','Pilot waits at port rather than beginning another empty flight');report.waitedUntil=combat.state.time;
 }
 report.frames=frames;report.simulatedSeconds=combat.state.time;report.fleet=fleet.snapshot();report.actors=roster.snapshot().actors;
 assert([0,1].every(team=>report.boarded.some(a=>a.team===team)),'Each team must autonomously board a ship');assert(report.boarded.some(a=>a.team===0&&a.big&&a.role==='Pilot'),'Dawn must autonomously take a crew helm');assert(report.boarded.every(a=>a.falls===0),'Transport boarding must not depend on fall recovery');report.passed=true;
}catch(e){report.failures.push({message:e.message,stack:e.stack});process.exitCode=1;}
finally{roster?.dispose();nav?.dispose();fs.writeFileSync(delivery?('review/autonomous-ship-delivery-'+(generated?'generated':'default')+(uncontested?'-uncontested':'')+(roundtrip?'-roundtrip':'')+'.json'):(generated?'review/autonomous-ship-boarding-generated.json':'review/autonomous-ship-boarding-default.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,generated,delivery,uncontested,roundtrip,boarded:report.boarded,departure:report.departure,delivered:report.delivery,captureCrew:report.captureCrew,deliveryObjectives:report.deliveryObjectives,returned:report.returned,returnSamples:report.returnSamples,waitedUntil:report.waitedUntil,frames:report.frames,simulatedSeconds:report.simulatedSeconds,failures:report.failures}));}
