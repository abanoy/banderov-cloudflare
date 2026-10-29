import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
function fixture(){
 const floor=new T.Mesh(new T.BoxGeometry(300,2,300),new T.MeshBasicMaterial());floor.position.y=-1;floor.updateMatrixWorld(true);
 const pads=[{x:0,y:0,z:0,r:6,name:'Dawn'},{x:1000,y:0,z:0,r:6,name:'Dusk'}],requests=[];
 const navigation={ready:true,stats:{},lineOfSight:()=>true,nearby:()=>[floor],safeStep:()=>true,nearest:p=>({x:p.x,y:p.y,z:p.z}),invalidateSegment(){},path:(from,to,options)=>new Promise(resolve=>requests.push({from:{x:from.x,y:from.y,z:from.z},to,options,resolve}))};
 const roster=createBattleBots({world:{pads,solids:[floor]},navigation,playerPhysics:flightWorld([floor],pads)});roster.configure(2);roster.reset({launchHuman:false});
 const guard=roster.bots.find(a=>a.team===0),enemy=roster.bots.find(a=>a.team===1);
 for(const a of roster.actors){a.alive=a===guard||a===enemy;a.hp=a.alive?100:0;a.spawnPending=false;a.decisionAt=Infinity;}
 Object.assign(guard.state,{x:0,y:0,z:0,grounded:true,flight:false});Object.assign(enemy.state,{x:30,y:0,z:0,grounded:true,flight:false});enemy.mount={fixture:true};guard.decisionAt=0;
 const tick=t=>roster.update(0,t,{shields:[8000,8000]});tick(0);assert.equal(requests.length,1);assert.equal(requests[0].to.id,'intruder-'+enemy.id);
 return {roster,guard,enemy,requests,tick};
}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();},checks=[];
for(const cause of ['died','left','moved']){
 const f=fixture();if(cause==='died')f.enemy.alive=false;if(cause==='left')f.enemy.state.x=180;if(cause==='moved')f.enemy.state.z=30;
 f.requests[0].resolve({reachable:true,points:[f.requests[0].from,f.requests[0].to]});await flush();
 assert.equal(f.guard.path.length,0,'Late route must not restore obsolete intruder position: '+cause);assert.notEqual(f.guard.routeStatus,'following');f.roster.dispose();checks.push('Pending route rejected when intruder '+cause);
}
{
 const f=fixture();f.requests[0].resolve({reachable:true,points:[f.requests[0].from,f.requests[0].to]});await flush();assert.equal(f.guard.routeStatus,'following');
 f.enemy.state.z=30;f.tick(4);assert.equal(f.requests.length,2,'Moving intruder requires fresh route rather than reusing same actor id');assert.equal(f.requests[1].to.z,30);
 f.requests[1].resolve({reachable:true,points:[f.requests[1].from,f.requests[1].to]});await flush();assert.equal(f.guard.path.at(-1).z,30);f.roster.dispose();checks.push('Unchanged target accepted; moved intruder replanned to current position');
}
const report={passed:true,checks,scope:'Real bot decision lifecycle on a real supported floor; deferred controlled navigation and enemy movement/death/departure. Not contested native encounter or full castle path coverage.'};fs.writeFileSync('review/bot-intruder-retarget.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
