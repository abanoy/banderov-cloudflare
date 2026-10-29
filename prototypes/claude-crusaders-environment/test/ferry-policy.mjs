import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../vendor/three.module.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';import {createBattleCombat} from '../floating-castle/battle-combat.js';
globalThis.document={createElement(){return {getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const {makeWorld}=await import('../floating-castle/world.js');
function fixture(){const scene=new T.Scene(),world=makeWorld(scene),actors=Array.from({length:8},(_,id)=>({id,human:id===0,team:id<4?0:1,state:{x:1000,y:0,z:1000}})),objective={id:0,x:world.outposts[0].x,y:0,z:world.outposts[0].z,owner:-1},fleet=createBattleFleet({world,scene,actors,navigation:{path:async()=>({reachable:false})}}),combat=createBattleCombat({actors,objectives:[objective]});combat.start();fleet.setCombat(combat);const ship=fleet.ships.find(s=>s.team===0&&s.big),pilot=actors[1];for(const a of actors)a.alive=a===pilot;ship.seats[0].actor=pilot;pilot.mount={ship:ship.id,seat:0};ship.stage='moored';ship.departAt=0;const tick=seconds=>{for(let i=0;i<seconds*60;i++){combat.state.time+=1/60;fleet.step(1/60);}};return {world,actors,fleet,combat,ship,pilot,tick};}
const checks=[];
{
 const f=fixture();f.tick(8);assert.equal(f.ship.stage,'moored');assert(f.ship.root.position.distanceTo(f.ship.home)<.001);assert(f.pilot.reason.includes('Waiting at port'));const crew=f.actors[2];crew.alive=true;f.ship.seats[3].actor=crew;crew.mount={ship:f.ship.id,seat:3};f.ship.departAt=f.combat.state.time+6;f.tick(5);assert.equal(f.ship.stage,'moored');f.tick(3);assert.equal(f.ship.stage,'climb');assert(f.ship.root.position.y>f.ship.home.y+10);checks.push('Empty AI crew ship waits; installed crew enables departure after ordinary loading allowance');
}
{
 const f=fixture();f.combat.state.phase='evacuation';f.tick(1);assert.equal(f.ship.stage,'climb');assert(f.ship.destination);checks.push('Evacuation permits departure without additional crew');
}
{
 const f=fixture();f.ship.root.position.set(-210,170,-90);f.ship.stage='return-cruise';f.combat.state.phase='evacuation';f.tick(1/60);assert(!f.ship.stage.startsWith('return-'));assert(f.ship.destination);checks.push('Evacuation cancels an AI home return and selects an island approach');
}
const report={passed:true,checks,scope:'Actual fleet/hull/world and clock with controlled seated actors and evacuation state; boarding proof belongs to autonomous roundtrip test. Not native emergency or arbitrary shield-route proof.'};fs.writeFileSync('review/ferry-policy.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
