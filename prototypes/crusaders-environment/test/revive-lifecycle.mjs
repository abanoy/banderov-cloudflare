import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createBattleCombat,WEAPONS} from '../floating-castle/battle-combat.js';
import {prepareMedic,medicWait,medicRescue,canChannelRevive} from '../floating-castle/battle-medic.js';

const checks=[];
function fixture(){
 const wall=new T.Mesh(new T.BoxGeometry(1,5,10),new T.MeshBasicMaterial());wall.position.set(5,2,0);wall.visible=false;wall.updateMatrixWorld(true);
 const actors=Array.from({length:4},(_,id)=>({id,team:id<2?0:1,weapon:id===0?5:0,state:{x:id?1000:0,y:0,z:0,grounded:true,falls:0}}));
 const c=createBattleCombat({actors,objectives:[],solids:[wall]});c.start();const a=actors[0],ally=actors[1];Object.assign(ally,{alive:false,hp:0,respawnAt:99});ally.state.x=10;
 const target=()=>({x:ally.state.x,y:1.05,z:0});
 function channel(seconds){for(let i=0;i<Math.round(seconds*60);i++){c.fire(a,target());c.step(1/60);}}
 return {c,a,ally,wall,target,channel};
}
const blocked=fixture();blocked.channel(.5);assert(blocked.a.charge>.4);blocked.wall.visible=true;blocked.c.fire(blocked.a,blocked.target());assert.equal(blocked.a.reviving,null);assert.equal(blocked.a.charge,0);blocked.wall.visible=false;blocked.channel(1);assert(!blocked.ally.alive);blocked.channel(.45);assert(blocked.ally.alive&&blocked.ally.hp===65);checks.push('Real wall interrupts progress; clear beam must start a fresh1.4s channel');
const range=fixture();range.channel(.5);range.ally.state.x=30;range.c.fire(range.a,range.target());assert.equal(range.a.reviving,null);assert.equal(range.a.charge,0);checks.push('Leaving14m range clears both channel and displayed progress');
for(const reason of ['stale','weapon','dead','evacuation']){
 const f=fixture();f.channel(.4);if(reason==='weapon')f.a.weapon=0;if(reason==='dead')f.a.alive=false;if(reason==='evacuation')f.c.state.phase='evacuation';
 for(let i=0;i<16;i++)f.c.step(1/60);assert.equal(f.a.reviving,null);assert.equal(f.a.charge,0);
}checks.push('Release gap, weapon switch, death and evacuation clear stale channels in combat step');
const reload=fixture();reload.a.magazines={reviver:{ammo:2,until:0}};reload.channel(.4);assert(reload.c.reload(reload.a));assert.equal(reload.a.reviving,null);assert.equal(reload.a.charge,0);assert(reload.c.ammo(reload.a).reloadIn>2.3);reload.channel(1);assert.equal(reload.a.charge,0);assert(!reload.ally.alive);checks.push('Manual reload interrupts immediately and cannot accumulate channel progress during reload');
const empty=fixture();empty.a.magazines={reviver:{ammo:0,until:0}};empty.c.fire(empty.a,empty.target());assert.equal(empty.a.charge,0);assert.equal(empty.a.reviving,null);assert.equal(empty.c.ammo(empty.a).reloadIn,WEAPONS[5].reload);checks.push('Empty human scepter reloads immediately without wasting a full channel attempt');
const bot=fixture();bot.a.magazines={reviver:{ammo:0,until:0}};prepareMedic(bot.a,0);assert.equal(medicWait(bot.a,0),2.4);bot.ally.respawnAt=3;assert.equal(medicRescue(bot.a,bot.c.actors,0),null);assert(!canChannelRevive(bot.a,bot.ally,0,()=>true));prepareMedic(bot.a,2.4);assert.equal(bot.a.magazines.reviver.ammo,3);assert.equal(medicWait(bot.a,2.4),0);bot.ally.respawnAt=5;assert.equal(medicRescue(bot.a,bot.c.actors,2.4),bot.ally);bot.a.nextShot=4.4;assert.equal(medicRescue(bot.a,bot.c.actors,2.4),null);checks.push('Idle bot replenishes scepter, rejects missed reload/cooldown deadlines and becomes ready after reload');
const report={passed:true,checks,scope:'Actual local combat/weapon magazine with synthetic actors/time and real wall triangles; policy readiness fixtures. No native revival, multiplayer or balance acceptance claim.'};fs.writeFileSync('review/revive-lifecycle-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
