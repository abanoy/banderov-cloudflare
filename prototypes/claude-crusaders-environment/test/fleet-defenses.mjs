import * as T from '../vendor/three.module.js';import assert from 'node:assert/strict';import fs from 'node:fs';
import {makeWorld} from '../floating-castle/world.js';import {createConstruction} from '../floating-castle/castle-construction.js';import {createBattleFleet} from '../floating-castle/battle-fleet.js';import {createBattleCombat} from '../floating-castle/battle-combat.js';import {DEFENSE_RULES} from '../floating-castle/castle-defense.js';
globalThis.document={createElement(){return {width:0,height:0,getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}};}};
const scene=new T.Scene(),world=makeWorld(scene),construction=createConstruction(world);
construction.apply(0,[{x:0,z:0,layer:0,type:'core',rotation:0},...['cannon','heavyCannon','beacon'].map((type,i)=>({x:3+i*2,z:4,layer:0,type,rotation:0}))]);
const actors=Array.from({length:16},(_,i)=>({id:i,team:i<8?0:1,human:i===0,state:{x:1000+i*10,y:0,z:1000},hp:100,alive:true})),fleet=createBattleFleet({world,scene,actors,navigation:{path:async()=>({reachable:false})}}),combat=createBattleCombat({actors,objectives:[],solids:world.solids,dynamicSolids:fleet.ships.flatMap(s=>s.parts),mounts:fleet.mounts,vehicles:fleet.ships});fleet.setCombat(combat);combat.start();
const guns=fleet.mounts.filter(w=>w.id.startsWith('custom-'));assert.equal(guns.length,3);
const checks=[];for(const w of guns){
const type=w.root.userData.cell.type;assert.equal(w.range,DEFENSE_RULES[type].range);assert.equal(w.mountWeapon.interval,DEFENSE_RULES[type].cooldown);
const p=w.root.getWorldPosition(new T.Vector3());Object.assign(actors[0].state,{x:p.x+3,y:p.y,z:p.z});assert(fleet.interact());assert.equal(actors[0].mount.gun,w.id);
assert(fleet.fire(actors[0],{x:p.x+40,y:p.y+4,z:p.z+40}));assert(combat.projectiles.some(b=>b.source===0));fleet.interact();checks.push(type+' is registered, manually enterable and fires with advertised range/cooldown');
}
const gun=guns[0],p=gun.root.localToWorld(gun.local.clone());gun.nextShot=0;
let target;for(let i=0;i<16;i++){const t={x:p.x+Math.cos(i*Math.PI/8)*50,y:p.y,z:p.z+Math.sin(i*Math.PI/8)*50};if(!Number.isFinite(combat.collision.distance(p,t,gun.ignore))){target=t;break;}}assert(target);Object.assign(actors[8].state,{...target,y:target.y-1});fleet.step(1/60);assert(combat.projectiles.some(b=>b.source===gun.id));checks.push('An installed custom cannon automatically acquires a visible enemy and emits a real projectile');
gun.hp=0;fleet.step(1/60);assert(gun.respawnAt>0);combat.state.time=gun.respawnAt+.01;fleet.step(1/60);assert.equal(gun.hp,240);checks.push('Disabled fixed gun repairs after its simulation cooldown');
combat.state.cores[0]=0;gun.nextShot=0;gun.scanAt=0;const stoppedCount=combat.projectiles.length;assert.equal(combat.fire(gun,target),false);fleet.step(1/60);assert.equal(combat.projectiles.length,stoppedCount);assert(fleet.snapshot().defenses.filter(w=>w.team===0).every(w=>w.lowBattery));checks.push('Core loss disables all actual automatic and manual team batteries');
construction.restore(0);fleet.sync();assert.equal(fleet.mounts.filter(w=>w.id.startsWith('custom-')).length,0);checks.push('Restore removes obsolete custom weapon registrations');
fs.writeFileSync('review/fleet-defenses.json',JSON.stringify({scope:'Explicit real-world construction/manual-entry and automatic-fire fixtures; not native traversal.',checks,passed:true},null,2));console.log(checks);
