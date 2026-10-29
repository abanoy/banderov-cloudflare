// Bot skill profiles (battle-bots.js) and F-interaction preference (battle-fleet.js).
// Real world geometry and the real bot/fleet modules; navigation is a stub so the
// timing formulas can be measured exactly without route searches. Runs in a few seconds.
import * as T from '../vendor/three.module.js';
import assert from 'node:assert/strict';
import {makeWorld} from '../floating-castle/world.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createBattleBots,BOT_PROFILES} from '../floating-castle/battle-bots.js';
import {createBattleFleet} from '../floating-castle/battle-fleet.js';

globalThis.document={createElement(){return {width:0,height:0,getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}};}};
const began=Date.now(),scene=new T.Scene(),world=makeWorld(scene),checks=[];
const check=(name,fn)=>{fn();checks.push(name);console.log('ok -',name);};
const nav={ready:true,nodes:[],lineOfSight:()=>true,nearby:()=>[],safeStep:()=>true,canWalk:()=>true,nearest:()=>null,invalidateSegment(){},path:async()=>({reachable:false,reason:'stub'})};

// One ally (id 1) and two enemies (ids 8, 9) facing each other on open ground; decisions held.
function rig(profile,{enemyDistance=40}={}){
 const fired=[],bots=createBattleBots({world,navigation:nav,playerPhysics:flightWorld([],world.pads),objectives:[],fire:(a,p)=>{fired.push({id:a.id,p:{...p}});return true;}});
 bots.configure(2);if(profile!==undefined)bots.setDifficulty(profile);
 const place=(a,x,z)=>{Object.assign(a.state,{x,y:0,z,vx:0,vy:0,vz:0,grounded:true,flight:false});a.spawnPending=false;a.decisionAt=Infinity;a.weapon=0;a.medic=false;a.alive=true;a.hp=100;};
 const [human,ally,e1,e2]=bots.actors;place(human,-400,-400);place(ally,0,0);place(e1,enemyDistance,0);place(e2,enemyDistance,300);
 return {bots,fired,human,ally,e1,e2};
}
// Steps decisions/sensing/shooting without physics (dt=0) and records first shot time and aim offset.
function measure(profile,opts){
 const r=rig(profile,opts),first=new Map(),offset=new Map();
 for(let i=0;i<=400;i++){const t=10+i*.005;r.fired.length=0;r.bots.update(0,t,{objectives:[],projectiles:[]});
  for(const f of r.fired)if(!first.has(f.id)){first.set(f.id,t);const a=r.bots.actors.find(a=>a.id===f.id),target=r.bots.actors.find(b=>b.id===a.targetId);offset.set(f.id,{x:f.p.x-target.state.x,z:f.p.z-target.state.z,t});}}
 return {r,first,offset,since:new Map(r.bots.actors.map(a=>[a.id,a.targetSince]))};
}

const base=measure(undefined),soldier=measure('soldier'),recruit=measure('recruit'),veteran=measure('veteran');
check('Profiles are frozen and soldier is the identity profile',()=>{assert(Object.isFrozen(BOT_PROFILES)&&Object.isFrozen(BOT_PROFILES.recruit));for(const v of Object.values(BOT_PROFILES.soldier))assert.equal(v,1);});
check('Soldier reaction delay and aim error equal the untouched defaults exactly',()=>{
 for(const id of [1,8]){assert.equal(soldier.first.get(id),base.first.get(id),'reaction '+id);assert.deepEqual(soldier.offset.get(id),base.offset.get(id),'aim '+id);}
 for(const a of soldier.r.bots.actors)if(!a.human)assert.equal(a.senseAt,base.r.bots.actors.find(b=>b.id===a.id).senseAt,'sense cadence '+a.id);
 assert.equal(soldier.r.bots.difficulty,'soldier');});
check('Recruit enemies react later and aim wider; allies keep soldier timing',()=>{
 const reaction=(m,id)=>m.first.get(id)-m.since.get(id);
 assert(reaction(recruit,8)>reaction(base,8)*1.6,'enemy reaction '+reaction(recruit,8)+' vs '+reaction(base,8));
 assert.equal(recruit.first.get(1),base.first.get(1),'ally reaction unchanged');assert.deepEqual(recruit.offset.get(1),base.offset.get(1),'ally aim unchanged');
 const err=m=>{const o=m.offset.get(8),phase=Math.sin(o.t*2.3+8);return Math.abs(o.x/phase);};
 const d=recruit.r.e1.state.x-recruit.r.ally.state.x;assert(Math.abs(err(base)-(.1+d*.005))<1e-6,'default aim error formula');assert(Math.abs(err(recruit)-(.1+d*.005)*2.2)<1e-6,'recruit aim error x2.2');
 assert(reaction(veteran,8)<reaction(base,8),'veteran reacts faster');});
check('Sense, dodge and decision cadence scale for enemies only',()=>{
 const r=rig('recruit'),d=rig(undefined),t=20;
 for(const x of [r,d]){x.bots.update(0,t,{objectives:[],projectiles:[]});}
 const e=x=>x.bots.actors.find(a=>a.id===8),al=x=>x.bots.actors.find(a=>a.id===1);
 assert(Math.abs((e(r).senseAt-t)-(.24+8*.002)*1.5)<1e-9);assert.equal(al(r).senseAt,al(d).senseAt);
 for(const x of [r,d]){for(const a of x.bots.bots)a.decisionAt=0;x.bots.update(0,t+1,{objectives:[],projectiles:[]});}
 assert(Math.abs((e(r).decisionAt-(t+1))-(2.5+8*.045)*1.3)<1e-9,'recruit decision cadence');assert(Math.abs((e(d).decisionAt-(t+1))-(2.5+8*.045))<1e-9,'default decision cadence');assert.equal(al(r).decisionAt,al(d).decisionAt);
 const r2=rig('recruit'),d2=rig(undefined);for(const x of [r2,d2])x.bots.update(1/120,t,{objectives:[],projectiles:[]});
 assert(Math.abs((r2.e1.dodgeAt-t)-.32)<1e-9,'recruit dodge cadence .16x2');assert(Math.abs((d2.e1.dodgeAt-t)-.16)<1e-9,'default dodge cadence');assert.equal(r2.ally.dodgeAt,d2.ally.dodgeAt);});
check('Recruit engagement range shrinks to 90%; soldiers still engage at 95m',()=>{
 const far=x=>{const r=rig(x,{enemyDistance:95});r.bots.update(0,30,{objectives:[],projectiles:[]});return r;};
 assert.equal(far('recruit').e1.targetId,null);assert.equal(far('soldier').e1.targetId,1);assert.equal(far(undefined).e1.targetId,1);});
check('releaseWorld empties every near[] array and per-match references',()=>{
 const r=rig('veteran');for(const a of r.bots.allActors)a.near?.push({id:'mesh'});r.bots.releaseWorld();
 for(const a of r.bots.allActors)if(a.near)assert.equal(a.near.length,0);assert.equal(r.bots.difficulty,'veteran');
 assert.equal(r.bots.setDifficulty('nonsense'),'soldier');});

// Fleet: an adjacent defense wins over a remembered boarding target.
check('F operates an adjacent defense first even with preferredShip set; nearestInteraction reports it',()=>{
 const messages=[],human={id:0,team:0,human:true,alive:true,state:{x:0,y:0,z:0,vx:0,vy:0,vz:0}};
 const fleet=createBattleFleet({world,scene,actors:[human],navigation:nav,onMessage:m=>messages.push(m)});
 fleet.setCombat({state:{time:0,phase:'running',cores:[16000,16000],shields:[8000,8000]},shieldVolumes:[]});
 const mount=fleet.mounts.find(w=>!w.ship&&w.team===0),ship=fleet.ships.find(s=>s.team===0);assert(mount&&ship);
 world.scene?.updateMatrixWorld?.(true);scene.updateMatrixWorld(true);
 const e=mount.root.userData.defense?.entry||[0,0,0],p=mount.root.localToWorld(new T.Vector3(...e));Object.assign(human.state,{x:p.x+3,y:p.y,z:p.z+4});
 const seen=fleet.nearestInteraction(human);assert.equal(seen?.kind,'mount');assert.equal(seen.id,mount.id);assert(/^F · Operate /.test(seen.label),seen.label);assert(seen.distance<=5.01);
 assert.equal(fleet.interact(human,ship.id),true);assert.equal(human.mount?.gun,mount.id,'defense entered instead of the remembered ship');assert.equal(mount.operator,human);
 assert.equal(fleet.nearestInteraction(human),null,'mounted actors get no prompt');assert(fleet.interact(human));assert.equal(human.mount,null);
 Object.assign(human.state,{x:p.x+500,y:p.y,z:p.z+500});assert.equal(fleet.nearestInteraction(human),null);assert.equal(fleet.interact(human,ship.id),false);assert(/approach within 11m/.test(messages.at(-1)),messages.at(-1));
 const c=ship.root.position;Object.assign(human.state,{x:c.x,y:c.y+2,z:c.z});const board=fleet.nearestInteraction(human);
 assert.equal(board?.kind,"ship",JSON.stringify(board));assert(/^F · Board (crew|scout) ship$/.test(board.label));
 assert.equal(fleet.setDifficulty('recruit'),'recruit');assert.equal(fleet.difficulty,'recruit');assert.equal(fleet.setDifficulty('x'),'soldier');});

console.log(JSON.stringify({passed:true,checks:checks.length,seconds:(Date.now()-began)/1000}));
