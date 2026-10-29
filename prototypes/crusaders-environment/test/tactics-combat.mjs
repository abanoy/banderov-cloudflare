import * as T from '../vendor/three.module.js';
import {createBattleCombat,createBattleCollision,WEAPONS,BATTLE_RULES as R} from '../floating-castle/battle-combat.js';
import {curvedWallGeometry} from '../floating-castle/castle-curves.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const report={scope:'Explicit local battle fixtures with synthetic actors/positions/time and real displayed triangle collision. This is not native play, remote multiplayer, human balance acceptance or performance evidence.',checks:[],failures:[],sourceHash:crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/battle-combat.js',import.meta.url))).digest('hex')};
const check=(name,details={})=>report.checks.push({name,...details}),near=(a,b,t=1e-6)=>assert(Math.abs(a-b)<=t,`${a} must equal ${b} within ${t}`);
function fixture({weapon=0,objectives=[],solids=[],towerDrain=false,respawn}={}){
 const actors=Array.from({length:16},(_,i)=>({id:'actor-'+i,team:i<8?0:1,human:i===0,weapon:i===0?weapon:0,radius:.65,state:{x:1000+i*20,y:.77,z:1000,grounded:true,flight:false,falls:0}})),events=[],resets=[];
 Object.assign(actors[0].state,{x:0,z:0});Object.assign(actors[8].state,{x:10,z:0});
 const combat=createBattleCombat({actors,objectives,solids,towerDrain,onEvent:e=>events.push({...e}),respawn:a=>{resets.push({id:a.id,time:combat.state.time});if(respawn)respawn(a);}});combat.start();
 const step=(seconds,action)=>{for(let i=0;i<Math.ceil(seconds/.01-1e-8);i++){action?.();combat.step(.01);}};
 const aim=actor=>({x:actor.state.x,y:actor.state.y+1.05,z:actor.state.z});return {actors,combat,events,resets,step,aim};
}
const origin={x:0,y:1.82,z:0};
const {shotSolution,trajectory,intercept}=await import('../floating-castle/battle-aim.js');
for(const weapon of WEAPONS){const target={x:30,y:18,z:5},solution=shotSolution(origin,target,weapon);assert(solution);const end=trajectory(origin,solution).at(-1);for(const axis of ['x','y','z'])near(end[axis],target[axis]);}
const lead=intercept(origin,{x:50,y:1.82,z:0},{x:0,y:0,z:8},58);assert(lead.z>6);
const bow=fixture({weapon:3}),a=bow.actors[0];bow.step(1.21);assert(!bow.combat.fire(a,bow.aim(bow.actors[8])));a.charge=WEAPONS[3].charge;assert(bow.combat.fire(a,bow.aim(bow.actors[8])));a.charge=WEAPONS[3].charge;assert(!bow.combat.fire(a,bow.aim(bow.actors[8])));a.weapon=0;assert(!bow.combat.fire(a,bow.aim(bow.actors[8])));bow.step(.2);near(bow.actors[8].hp,28);
const pot=fixture({weapon:4});pot.step(1.21);assert(pot.combat.fire(pot.actors[0],pot.aim(pot.actors[8])));pot.step(1);assert(pot.events.some(e=>e.type==='blast'));assert(pot.actors[8].hp<100);assert.equal(pot.actors[0].hp,100);assert(!pot.combat.fire(pot.actors[0],pot.aim(pot.actors[8])));
const core=new T.Mesh(new T.SphereGeometry(5),new T.MeshBasicMaterial());core.position.set(40,25,0);core.userData.coreTeam=1;core.updateMatrixWorld(true);const q=fixture({weapon:3,solids:[core]});q.step(1.21);q.actors[0].charge=1.15;assert(q.combat.fire(q.actors[0],core.position));q.step(.5);assert(q.events.some(e=>e.type==='core-hit'));near(q.combat.state.shields[1],R.shieldHp);near(q.combat.state.cores[1],R.coreHp);
const kill=fixture({weapon:3});kill.step(1.21);kill.actors[8].hp=20;kill.actors[0].charge=1.15;kill.combat.fire(kill.actors[0],kill.aim(kill.actors[8]));kill.step(.2);assert.equal(kill.actors[0].score,100);
fs.writeFileSync('review/tactics-combat.json',JSON.stringify({passed:true,checks:['Five shared trajectory endpoints','Moving target lead','Focus charge, cooldown and weapon-switch recovery','Ballistic blast, friendly safety and cooldown','Elevated orb cannot harm powered shield','Kill score'],sourceHash:report.sourceHash},null,2));console.log('PASS six aim, charge, explosive, orb and score groups');
