import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';
import {createBattleCombat} from '../floating-castle/battle-combat.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';
globalThis.document={createElement(){return {style:{},getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const {makeWorld}=await import('../floating-castle/world.js');
const level=Number(process.argv[3]||20);assert(Number.isInteger(level)&&level>=10&&level<=100);
const scene=new T.Scene(),world=makeWorld(scene),construction=createConstruction(world),plans=[];
for(let home=0;home<2;home++){
 const plan=await verifiedBattleCastlePlan({construction,home,level,seed:685637696+home});
 construction.apply(home,plan.layout,plan.options);plans.push({home,level,seed:plan.seed,family:plan.family,parts:plan.layout.length});
}
const active=[],physics=flightWorld(active,world.pads),actors=[0,1].map(team=>({id:team,team,human:true,weapon:0,state:team?{...world.pads[team]}:physics.state,path:[],planToken:0}));
const nav=createBattleNavigation(world),fleet=createBattleFleet({world,scene,actors,navigation:nav}),combat=createBattleCombat({actors,objectives:[]});fleet.setCombat(combat);combat.start();
const prepared=await nav.rebuild(),results=[],searchMs=Number(process.argv[2]||20000);assert(searchMs>0&&Number.isFinite(searchMs));
for(const ship of fleet.ships){
 const a=actors[ship.team];physics.state.home=ship.team;physics.recover();a.state=physics.state;
 const route=await nav.path(a.state,{...ship.port.approach,radius:3},{maxMs:searchMs,maxVisited:6000,walkingOnly:true});
 const result={ship:ship.id,team:ship.team,big:ship.big,port:ship.port.id,approach:ship.port.approach.toArray(),route:route.reachable,reason:route.reason,points:route.points?.length,visited:route.visited};results.push(result);
 if(!route.reachable){
  const courts=[];world.castles[ship.team].traverse(g=>{if(g.userData.spawnPoint&&g.visible){const pos=g.getWorldPosition(new T.Vector3()),n=nav.nearest(pos,3);if(n)courts.push(n);}});
  result.start={x:a.state.x,y:a.state.y,z:a.state.z};result.visited=route.visited;
  if(courts.length){const alternate=await nav.path(courts[0],{...ship.port.approach,radius:3},{maxMs:searchMs,maxVisited:6000,walkingOnly:true});result.interiorCourt={...courts[0]};result.interiorRoute={reachable:alternate.reachable,reason:alternate.reason,visited:alternate.visited,points:alternate.points.length};}
  continue;
 }
 assert(route.points.every(p=>p.launchTo===undefined),'Dock walkers must not take a pod shortcut');
 let steps=0,problem=null;
 for(const target of route.points){let budget=1200;while(Math.hypot(a.state.x-target.x,a.state.z-target.z)>.025&&budget-->0){
  const dx=target.x-a.state.x,dz=target.z-a.state.z,d=Math.hypot(dx,dz),strength=Math.min(1,d/(10/120));active.splice(0,active.length,...nav.nearby(a.state,1));physics.step(1/120,{x:dx/d*strength,z:dz/d*strength});steps++;
  if(!a.state.grounded||a.state.falls){problem='Lost supported walking floor';break;}
 }if(problem)break;if(budget<=0){problem='Walking stalled';break;}}
 result.steps=steps;result.problem=problem;result.arrival={x:a.state.x,y:a.state.y,z:a.state.z};result.boarding=fleet.boardingStatus(ship.id,a);
 if(!problem){result.boarded=fleet.interact(a,ship.id);if(result.boarded)fleet.interact(a);}
}
nav.dispose();const report={plans,prepared,searchMs,results,passed:results.length>0&&results.every(r=>r.route&&!r.problem&&r.boarded),scope:`Two seeded level${level} AI castles applied to real world; actual sampled graph, 120Hz walking solver and hull boarding. Controlled home recovery; no native input or general generated-layout guarantee.`};
fs.writeFileSync(level===20?'review/ship-generated-ports.json':`review/ship-generated-ports-level${level}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(report.passed,'Generated ports must be physically walkable and boardable');
