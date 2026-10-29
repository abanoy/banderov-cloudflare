import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
function fixture(count=4){
 const floor=new T.Mesh(new T.BoxGeometry(400,2,400),new T.MeshBasicMaterial());floor.position.y=-1;floor.updateMatrixWorld(true);
 const pads=[{x:-1000,y:0,z:0,r:6,name:'Dawn'},{x:1000,y:0,z:0,r:6,name:'Dusk'}],objectives=[{id:0,x:100,z:0},{id:1,x:-100,z:0},{id:2,x:0,z:-100},{id:3,x:70,z:70},{id:4,x:0,z:100}].map(o=>({...o,y:0,radius:15,label:o.id===4?'CROWN':'T'+o.id,owner:-1})),requests=[];
 const nav={ready:true,stats:{},lineOfSight:()=>true,nearby:()=>[floor],safeStep:()=>true,invalidateSegment(){},nearest:p=>({...p}),path:(from,to,options)=>new Promise(resolve=>requests.push({from,to,options,resolve}))};
 const roster=createBattleBots({world:{pads,solids:[floor]},navigation:nav,playerPhysics:flightWorld([floor],pads),objectives});roster.reset({launchHuman:false});
 const active=roster.bots.filter(a=>a.team===0&&a.ordinal<count);
 for(const a of roster.actors){a.alive=active.includes(a);a.hp=a.alive?100:0;a.spawnPending=false;a.decisionAt=0;Object.assign(a.state,{x:0,y:0,z:0,grounded:true,flight:false});}
 roster.update(0,0,{shields:[8000,8000]});return {roster,active,requests,objectives};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();},checks=[];
{
 const f=fixture();assert.equal(f.requests.length,4);const goals=f.requests.map(r=>r.to.id);
 assert(new Set(goals).size>=2,'Concurrent plans must account for pending teammates; scout should check a less crowded tower');assert.notEqual(goals[2],4,'Scout avoids two pending Crown approaches');
 for(let i=0;i<4;i++)assert.equal(f.active[i].planningObjectiveId,goals[i]);
 for(const r of f.requests)r.resolve({reachable:true,points:[{x:0,y:0,z:0},r.to]});await flush();
 for(let i=0;i<4;i++){assert.equal(f.active[i].planningObjectiveId,null);assert.equal(f.active[i].objectiveId,goals[i]);}checks.push({name:'Four concurrent real bot decisions reserve goals; scout checks less crowded tower; completed routes release reservations',goals});f.roster.dispose();
}
{
 const f=fixture(1),a=f.active[0];assert.equal(a.planningObjectiveId,4);f.requests[0].resolve({reachable:false,points:[],reason:'Controlled blocked Crown'});await flush();assert.equal(f.requests.length,2);assert.notEqual(f.requests[1].to.id,4);assert.equal(a.planningObjectiveId,f.requests[1].to.id);
 const pending=f.requests[1];f.roster.respawn(a);assert.equal(a.planningObjectiveId,null);assert(pending.options.signal.aborted);pending.resolve({reachable:true,points:[pending.to]});await flush();assert.equal(a.path.length,0);assert.equal(a.planningObjectiveId,null);checks.push('Failed candidate changes reservation; respawn aborts and stale completion cannot restore it');f.roster.dispose();
}
{
 const f=fixture();f.roster.reset({launchHuman:false});assert(f.active.every(a=>a.planningObjectiveId===null));assert(f.requests.every(r=>r.options.signal.aborted));f.roster.dispose();checks.push('Match reset clears all pending assignments');
}
for(const cause of ['death','configure','dispose']){
 const f=fixture(1),a=f.active[0],r=f.requests[0];if(cause==='death'){a.alive=false;a.hp=0;f.roster.update(0,.1,{shields:[8000,8000]});}else if(cause==='configure')f.roster.configure(2);else f.roster.dispose();
 assert.equal(a.planningObjectiveId,null);assert(r.options.signal.aborted);r.resolve({reachable:true,points:[r.to]});await flush();assert.equal(a.planningObjectiveId,null);assert.equal(a.path.length,0);f.roster.dispose();checks.push(cause+' clears reservation and rejects late callback');
}
const report={passed:true,checks,scope:'Real concurrent bot decisions on supported floor, controlled deferred route outcomes; no actual contested match or arbitrary world route guarantee.'};fs.writeFileSync('review/bot-objective-reservations.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
