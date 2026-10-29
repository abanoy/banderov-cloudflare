import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';
import {createBattleCombat} from '../floating-castle/battle-combat.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createConstruction,PARTS} from '../floating-castle/castle-construction.js';
globalThis.document={createElement(){return {style:{},getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const {makeWorld}=await import('../floating-castle/world.js');
const scene=new T.Scene(),world=makeWorld(scene),nav=createBattleNavigation(world),active=[];
const observed=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):null;if(observed){const layout=observed.cells.map(c=>({x:c.x,z:c.z,layer:c.layer,rotation:c.rotation,type:PARTS.find(p=>c.label.includes(': '+p.label+';')).id}));createConstruction(world).apply(0,layout,observed);}
const physics=flightWorld(active,world.pads),actors=[0,1].map(team=>({id:team,team,human:true,weapon:0,state:team?{...world.pads[team]}:physics.state,path:[],planToken:0}));
const fleet=createBattleFleet({world,scene,actors,navigation:nav}),combat=createBattleCombat({actors,objectives:[]});
fleet.setCombat(combat);combat.start();const prepared=await nav.rebuild(),results=[];
for(const ship of fleet.ships){
 const team=ship.team,a=actors[team];physics.state.home=team;physics.recover();a.state=physics.state;
 assert.equal(fleet.boardingStatus(ship.id,a).reason,'distance');assert.equal(fleet.interact(a,ship.id),false,'Spawn is outside boarding reach');
 const route=await nav.path(a.state,{...ship.port.approach,radius:3},{maxMs:5000,maxVisited:12000});
 assert(route.reachable,ship.id+': '+route.reason);let steps=0;
 for(const target of route.points){let budget=1200;while(Math.hypot(a.state.x-target.x,a.state.z-target.z)>.025&&budget-->0){
  const dx=target.x-a.state.x,dz=target.z-a.state.z,d=Math.hypot(dx,dz),strength=Math.min(1,d/(10/120));
  active.splice(0,active.length,...nav.nearby(a.state,1));physics.step(1/120,{x:dx/d*strength,z:dz/d*strength});steps++;
  assert(a.state.grounded,ship.id+' lost floor');assert.equal(a.state.falls,0,ship.id+' recovered instead of walking');
 }assert(budget>0,ship.id+' stalled');assert(Math.abs(a.state.y-target.y)<.15);}
 const arrival={x:a.state.x,y:a.state.y,z:a.state.z};
 assert.equal(fleet.boardingStatus(ship.id,a).reason,'ready');assert.equal(fleet.boardingStatus('missing-vessel',a).reason,'unavailable');assert.equal(fleet.interact(a,'missing-vessel'),false);assert(!a.mount);
 const enemy=fleet.ships.find(s=>s.team!==team);assert.equal(fleet.interact(a,enemy.id),false);
 const occupants=ship.seats.map(s=>s.actor);ship.seats.forEach(s=>s.actor=actors[1-team]);assert.equal(fleet.boardingStatus(ship.id,a).reason,'full');assert.equal(fleet.interact(a,ship.id),false,'Full ship must not redirect to scout');ship.seats.forEach((s,i)=>s.actor=occupants[i]);
 const hp=ship.hp;ship.hp=0;assert.equal(fleet.boardingStatus(ship.id,a).reason,'unavailable');assert.equal(fleet.interact(a,ship.id),false);ship.hp=hp;
 assert(fleet.interact(a,ship.id),ship.id+' not boardable from walked endpoint');assert.equal(a.mount.ship,ship.id);
 const roles=[ship.seats[a.mount.seat].role];if(ship.big)for(let i=0;i<5;i++){fleet.cycle(a);roles.push(ship.seats[a.mount.seat].role);assert.equal(ship.seats[a.mount.seat].actor,a);}
 assert(fleet.interact(a));assert.equal(a.mount,null);assert(a.state.flight&&a.state.flightKind==='dismount');

 results.push({team,ship:ship.id,port:ship.port.id,routePoints:route.points.length,physicalSteps:steps,arrival,roles});
}
nav.dispose();const report={passed:true,prepared,results,scope:'Both default castle spawn pads to four legacy crew/scout ports; real graph and 120Hz walking collision/support, actual boarding/seat cycling/exit; initial home recovery is a controlled fixture; specific-hull selection tested with all other ships healthy, unknown/enemy/full/dead/far targets rejected. Not saved edited castles, native controls, autonomous bot walking or general generated-port acceptance.'};
if(observed){report.observedDawnParts=observed.cells.length;report.scope='Observed applied 586-cell Dawn workshop layout plus default Dusk: actual graph, 120Hz walking, physical boarding, all crew seat changes and exit; specific vessel selection with other ships healthy; far/unknown/enemy/full/dead targets rejected. Initial home recovery controlled. No native-control, autonomous-bot or general edited/generated-port proof.';}
fs.writeFileSync(observed?'review/ship-walking-saved-review.json':'review/ship-walking-approach-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
