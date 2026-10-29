import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
import {createBattleCombat} from '../floating-castle/battle-combat.js';
import {medicRescue,canChannelRevive} from '../floating-castle/battle-medic.js';

const checks=[];
const medic={id:7,weapon:5,hp:100,team:0,state:{x:0,y:0,z:0,grounded:true}},ally={id:1,alive:false,team:0,state:{x:22,y:0,z:0,grounded:true},respawnAt:4};
assert.equal(medicRescue(medic,[medic,ally],0),ally);assert.equal(medicRescue(medic,[medic,ally],3),null);
assert.equal(medicRescue({...medic,hp:20},[ally],0),null);assert.equal(medicRescue(medic,[{...ally,team:1}],0),null);assert.equal(medicRescue(medic,[{...ally,state:{...ally.state,grounded:false}}],0),null);
const near={...ally,state:{...ally.state,x:5}};assert.equal(medicRescue({...medic,rescueId:1,reviving:{id:1,began:2.4,last:3.6}},[near],3.6),near,'Nearly complete channel retains target before deadline');
const another={...ally,id:2,state:{...ally.state,x:25}},otherMedic={...medic,id:3,alive:true,rescueId:1};assert.equal(medicRescue(medic,[ally,another,otherMedic],0).id,2);
assert(!canChannelRevive(medic,ally,0,()=>true));assert(!canChannelRevive(medic,{...ally,state:{...ally.state,x:5}},0,()=>false));
checks.push('Eligibility respects team, grounded casualty, health, distance, deadline, line of sight and another medic reservation');

async function run({blocked=false,evacuation=false,detour=false,empty=false}={}){
 const floor=new T.Mesh(new T.BoxGeometry(240,2,100),new T.MeshBasicMaterial());floor.position.y=-1;floor.updateMatrixWorld(true);
 const pads=[{x:0,y:0,z:0,r:6,name:'Dawn'},{x:1000,y:0,z:0,r:6,name:'Dusk'},{x:90,y:0,z:0,r:6,name:'Arena'}],world={pads,solids:[floor]},queries=[];
 const navigation={ready:true,stats:{},lineOfSight:()=>!blocked,nearby:()=>[floor],safeStep:()=>true,invalidateSegment(){},nearest:p=>({...p}),path:async(start,goal)=>{queries.push({...goal});return {reachable:!blocked,points:[{x:start.x,y:start.y,z:start.z},...(detour?[{x:90,y:0,z:40}]:[]),{x:goal.x,y:goal.y,z:goal.z}],reason:blocked?'blocked':'reachable'};}};
 let combat;const bots=createBattleBots({world,navigation,playerPhysics:flightWorld([floor],pads),fire:(a,p)=>combat.fire(a,p)});bots.configure(8);combat=createBattleCombat({actors:bots.actors,objectives:[],solids:[floor],respawn:a=>bots.respawn(a)});bots.reset({launchHuman:false});combat.start();
 const m=bots.actors.find(a=>a.id===7),victim=bots.actors.find(a=>a.id===1);
 for(const a of bots.actors){Object.assign(a.state,{x:400+a.id*10,y:0,z:0,grounded:true,flight:false});if(!a.human){a.spawnPending=false;a.decisionAt=Infinity;}if(a!==m&&a!==victim){a.alive=false;a.hp=0;a.respawnAt=Infinity;}}
 Object.assign(m.state,{x:0,y:0,z:0});if(empty)m.magazines={reviver:{ammo:0,until:0}};Object.assign(victim,{alive:false,hp:0,respawnAt:4});Object.assign(victim.state,{x:22,y:0,z:0});
 const positions=[],channels=[],routeReasons=[];
 for(let step=0;step<(empty?240:210);step++){
  bots.update(1/60,combat.state.time,{objectives:[],shields:[8000,8000],evacuation:evacuation?{zones:[{team:0,x:0,z:0,radius:100}],endsAt:120}:null});
  await Promise.resolve();combat.step(1/60);positions.push(m.state.x);routeReasons.push(...m.reachableObjectives.map(q=>q.reason));if(m.routeStatus==='reviving'&&m.reviving&& !victim.alive)channels.push(m.state.x);
 }
 const result={m,victim,queries,positions,channels,routeReasons,events:combat.events.slice()};bots.dispose();return result;
}
const success=await run();assert(success.queries.some(q=>q.id==='rescue-1'),'Rescue uses navigation path');assert(success.positions.some(x=>x>1),'Medic walks through real floor collision');assert(success.victim.alive&&success.victim.hp===65,'Actual combat revival completes before normal respawn');assert(success.events.some(e=>e.type==='revive'));assert.equal(success.m.score,50);assert(success.channels.length>60);assert(Math.max(...success.channels)-Math.min(...success.channels)<.01,'Medic stays still throughout channel');assert.equal(success.m.rescueId,null,'Completed casualty releases task');checks.push('Real bot update walks a checked straight route, holds for1.4s, actual combat revives65HP/+50, task clears');
const reloaded=await run({empty:true});assert(reloaded.victim.alive&&reloaded.victim.hp===65);assert.equal(reloaded.m.score,50);assert.equal(reloaded.m.magazines.reviver.ammo,2);checks.push('Actual bot reloads while approaching and completes revival before the four-second respawn');
const blocked=await run({blocked:true});assert(blocked.queries.some(q=>q.id==='rescue-1'));assert(!blocked.events.some(e=>e.type==='revive'));assert.equal(blocked.m.state.x,0);checks.push('Rejected route and blocked beam never revive through an obstacle');
const late=await run({detour:true});assert(!late.events.some(e=>e.type==='revive'));assert.equal(late.m.state.x,0);assert(late.routeReasons.includes('Rescue route exceeds the respawn deadline'));checks.push('Reachable but long detour rejected when it cannot finish before respawn');
const escape=await run({evacuation:true});assert(!escape.queries.some(q=>q.id==='rescue-1'));assert(!escape.events.some(e=>e.type==='revive'));checks.push('Evacuation takes priority over rescue');
const report={passed:true,checks,scope:'Synthetic casualty/deadline and controlled straight/blocked navigation; real bot update, actual floor triangles/flight solver and combat revive. Not native play or arbitrary castle navigation proof.'};fs.writeFileSync('review/medic-rescue-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
