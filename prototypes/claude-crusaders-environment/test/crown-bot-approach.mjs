import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createConstruction,PARTS} from '../floating-castle/castle-construction.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';
import {createBattleSpawns} from '../floating-castle/battle-spawns.js';
import {createBattleCombat} from '../floating-castle/battle-combat.js';
import {flightWorld} from '../floating-castle/flight.js';
globalThis.document={createElement(){return {style:{},getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const saved=process.argv.includes('--saved'),team=process.argv.includes('--dawn')?0:1,useSpawns=process.argv.includes('--spawn'),report={passed:false,saved,team,useSpawns,results:[],scope:'Actual roster chooses its private Crown approach from its initial castle pad; only the selected team ordinal1 bot active and Crown objective offered. Ordinary reset/start; optional actual spawn service, otherwise spawnPending cleared to isolate planning. No path/position injection after reset; asynchronous search with existing800ms/6000-node limits. Continued actual roster movement and combat capture after planning; stationary other actors inactive, explicit simulated time. Not native/full match.'};let nav,roster;
try{
 const {makeWorld}=await import('../floating-castle/world.js'),scene=new T.Scene(),world=makeWorld(scene);
 if(saved){const observed=JSON.parse(fs.readFileSync('review/observed-dawn-layout-20261011.json','utf8')),layout=observed.cells.map(c=>({x:c.x,z:c.z,layer:c.layer,rotation:c.rotation,type:PARTS.find(p=>c.label.includes(': '+p.label+';')).id}));createConstruction(world).apply(0,layout,observed);}
 nav=createBattleNavigation(world);const requests=[],audit=new Proxy(nav,{get(target,key){if(key==='path')return async(from,to,options)=>{const route=await nav.path(from,to,options);requests.push({from:{x:from.x,y:from.y,z:from.z},goal:to,reachable:route.reachable,reason:route.reason,visited:route.visited,points:route.points.length,pods:route.points.filter(p=>p.launchTo!==undefined).length});return route;};return Reflect.get(target,key);}});
 const o=world.orbTowers[4],crown={id:4,label:'CROWN',x:o.x,y:o.y??0,z:o.z,radius:15,owner:-1,progress:0};
 roster=createBattleBots({world,navigation:audit,playerPhysics:flightWorld(world.solids,world.pads),objectives:[crown],fire(){}});roster.configure(8);createBattleFleet({world,scene,actors:roster.actors,navigation:audit});report.prepared=await nav.rebuild();roster.reset({launchHuman:false});const combat=createBattleCombat({actors:roster.actors,objectives:[crown]});combat.start();const actor=roster.bots.find(a=>a.team===team&&a.ordinal===1);for(const a of roster.actors)if(a!==actor){a.alive=false;a.hp=0;a.respawnAt=Infinity;}if(useSpawns){const spawns=createBattleSpawns({world,navigation:audit,actors:roster.actors,objectives:[crown],getCombat:()=>combat});assert(spawns.place(actor));report.spawn={x:actor.state.x,y:actor.state.y,z:actor.state.z};}else actor.spawnPending=false;actor.decisionAt=0;
 roster.update(1/60,0,{objectives:[crown],projectiles:[],shields:[8000,8000]});const deadline=performance.now()+10000;while(actor.planning&&performance.now()<deadline)await new Promise(r=>setTimeout(r,0));
 report.results=requests;report.initialActor={name:actor.name,objective:actor.objectiveId,role:actor.role,reason:actor.reason};assert(!actor.planning,'Planning must settle');if(!useSpawns){assert.equal(actor.objectiveId,4,'Bot must find its Crown approach');assert(requests.some(r=>r.reachable&&r.goal.id===4));}
 let frames=0;for(;frames<7200&&crown.owner!==team;frames++){roster.update(1/60,combat.state.time,{objectives:[crown],projectiles:combat.projectiles,shields:combat.state.shields});combat.step(1/60);assert.equal(actor.state.falls,0,'Crown capture must not use fall recovery');if(frames%6===0)await new Promise(r=>setTimeout(r,0));}
 report.actor={name:actor.name,objective:actor.objectiveId,role:actor.role,reason:actor.reason};report.capture={owner:crown.owner,frames,seconds:combat.state.time,position:{x:actor.state.x,y:actor.state.y,z:actor.state.z},grounded:actor.state.grounded,falls:actor.state.falls};assert.equal(crown.owner,team,'Bot must physically capture Crown');assert(actor.state.grounded&&Math.abs(actor.state.y+12)<.15);report.passed=true;
}catch(e){report.failure=e.message;process.exitCode=1;}
finally{roster?.dispose();nav?.dispose();fs.writeFileSync(`review/crown-bot-approach-${saved?'saved':'default'}-${team?'dusk':'dawn'}${useSpawns?'-spawn':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
