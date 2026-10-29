import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {buildTemplate} from '../floating-castle/castle-templates.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
import {flightWorld} from '../floating-castle/flight.js';
globalThis.document={createElement(){return {style:{},getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const {makeWorld}=await import('../floating-castle/world.js');
const scene=new T.Scene(),world=makeWorld(scene),construction=createConstruction(world);
for(const [home,family] of ['sanctuary','skyharbor'].entries())construction.apply(home,buildTemplate(family,{level:100}).layout,{level:100});
const nav=createBattleNavigation(world);const prepared=await nav.rebuild(),requests=[];
const audit=new Proxy(nav,{get(target,key){if(key==='path')return async(from,to,options)=>{const result=await nav.path(from,to,options);requests.push({from:{x:from.x,y:from.y,z:from.z},to:{x:to.x,y:to.y,z:to.z,id:to.id,home:to.home},walkingOnly:!!options?.walkingOnly,preferClimb:!!options?.preferClimb,reachable:result.reachable,reason:result.reason,visited:result.visited});return result;};return Reflect.get(target,key);}});
const roster=createBattleBots({world,navigation:audit,playerPhysics:flightWorld(world.solids,world.pads),objectives:[],fire(){}});
roster.configure(8);await roster.prepare();const preparation=requests.slice();fs.writeFileSync('review/upper-castle-patrol-preparation.json',JSON.stringify({prepared,preparation},null,2));console.log(JSON.stringify({preparation}));assert(preparation.length>=2&&preparation.every(r=>r.walkingOnly));
assert(preparation.filter(r=>r.reachable).length>=2,'Both castles need a checked patrol landing');
const results=[];
for(let home=0;home<2;home++){
 roster.reset({launchHuman:false});const guard=roster.bots.find(a=>a.team===home&&a.ordinal===4);assert(guard);
 for(const a of roster.actors)if(a!==guard){a.alive=false;a.hp=0;}
 let arrived=false,frames=0,highest=guard.state.y;const before=requests.length;
 for(;frames<12000;frames++){
  roster.update(1/60,frames/60,{objectives:[],projectiles:[],shields:[8000,8000]});highest=Math.max(highest,guard.state.y);
  assert.equal(guard.state.falls,0,'A patrol must not recover to its spawn');assert(!guard.state.flight,'A castle patrol must climb rather than launch a pod');
  if(frames%6===0)await new Promise(r=>setTimeout(r,0));
  if(guard.objectiveId==='patrol-'+home&&guard.path.length&&guard.pathIndex>=guard.path.length&&guard.state.y>world.pads[home].y+60){arrived=true;break;}
 }
 const record={home,arrived,frames,simulatedSeconds:frames/60,highest,role:guard.role,reason:guard.reason,objective:guard.objectiveId,position:{x:guard.state.x,y:guard.state.y,z:guard.state.z},falls:guard.state.falls,requests:requests.slice(before)};results.push(record);console.log(JSON.stringify(record));
 assert(arrived,'Guard must autonomously reach its high castle patrol point');assert(record.requests.length&&record.requests.every(r=>r.walkingOnly));
}
roster.dispose();nav.dispose();const report={passed:true,prepared,preparation,results,scope:'Actual applied level100 Sanctuary/Skyharbor, real battle roster decisions and shared 120Hz movement. Controlled reset and only one live guard to isolate patrol decisions; explicit simulated time. No intermediate position/path injection, fleet/combat threats, native input or general-layout proof.'};fs.writeFileSync('review/upper-castle-patrol.json',JSON.stringify(report,null,2));
