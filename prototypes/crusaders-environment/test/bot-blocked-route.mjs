import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
const floor=new T.Mesh(new T.BoxGeometry(32,2,32),new T.MeshBasicMaterial());floor.position.y=-1;floor.updateMatrixWorld(true);
const pads=[{x:-1000,y:0,z:0,r:3,name:'Dawn'},{x:1000,y:0,z:0,r:3,name:'Dusk'}];const world={solids:[floor],pads};
const nav=createBattleNavigation(world);await nav.rebuild();const start={x:0,y:0,z:0},goal={x:12,y:0,z:0,radius:3.2,id:0,label:'Test orb',owner:-1};
const first=await nav.path(start,{...goal,radius:1});assert(first.reachable);assert.deepEqual(first.points.slice(0,2),[start,{x:4,y:0,z:0}]);
const wall=new T.Mesh(new T.BoxGeometry(.3,4,3),new T.MeshBasicMaterial());wall.position.set(2.8,2,0);wall.updateMatrixWorld(true);
const rejected=[],requested=[],navigation={get ready(){return nav.ready},get stats(){return nav.stats},nearest:(...a)=>nav.nearest(...a),nearby:(...a)=>[...nav.nearby(...a),wall],lineOfSight:(...a)=>nav.lineOfSight(...a),safeStep:(...a)=>nav.safeStep(...a),invalidateSegment:(a,b)=>{rejected.push({from:{x:a.x,y:a.y,z:a.z},to:{...b}});nav.invalidateSegment(a,b)},path:(a,b,o)=>{requested.push({from:{x:a.x,y:a.y,z:a.z},to:{...b}});return nav.path(a,b,o)}};
const bots=createBattleBots({world,navigation,playerPhysics:flightWorld([floor],pads),objectives:[goal]});bots.reset({launchHuman:false});const actor=bots.actors.find(a=>a.id===4);
for(const a of bots.actors){a.alive=a===actor;a.hp=a===actor?100:0;if(!a.human){a.spawnPending=false;a.decisionAt=Infinity;}}
Object.assign(actor.state,{...start,grounded:true,flight:false,vx:0,vy:0,vz:0});actor.path=first.points;actor.pathIndex=0;actor.objectiveId=0;actor.objectiveLabel='Test orb';actor.progressPosition={...start};actor.progressAt=0;
const samples=[];for(let step=0;step<900;step++){bots.update(1/60,step/60,{shields:[8000,8000]});await new Promise(resolve=>setImmediate(resolve));samples.push({time:step/60,x:actor.state.x,z:actor.state.z,status:actor.routeStatus});if(rejected.length&&Math.hypot(actor.state.x-goal.x,actor.state.z-goal.z)<1)break;}
assert(rejected.length,'Actual wall triggers bot stuck detection');assert.deepEqual(rejected[0].from,start,'Blocked segment must begin at last reached graph waypoint, not a wall-adjacent position snapping to its destination');assert.deepEqual(rejected[0].to,{x:4,y:0,z:0});
assert(samples.some(p=>p.status==='backtracking'&&p.x<1),'Bot retreats along visited segment before replan');assert(requested.some(q=>Math.hypot(q.from.x,q.from.z)<.025),'Replan begins from reached safe waypoint');assert(Math.hypot(actor.state.x-goal.x,actor.state.z-goal.z)<1,'Bot physically takes detour to objective');assert.equal(actor.state.falls,0);assert(samples.some(p=>Math.abs(p.z)>2));
const report={passed:true,rejected,requested:requested.length,steps:samples.length,falls:actor.state.falls,final:{x:actor.state.x,y:actor.state.y,z:actor.state.z},scope:'Actual81-node navigation graph and bot update/120Hz solver, real floor plus a real wall supplied as local dynamic obstruction after route computation; native browser encounter not observed.'};bots.dispose();nav.dispose();fs.writeFileSync('review/bot-blocked-route-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
