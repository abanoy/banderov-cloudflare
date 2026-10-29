import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../vendor/three.module.js';import {createBattleChariots} from '../floating-castle/battle-chariots.js';import {createBattleCollision} from '../floating-castle/battle-combat.js';
globalThis.document={createElement(){return {getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const checks=[];
for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 const scene=new T.Scene(),world={pads:[{x:0,y:47,z:0},{x:100,y:47,z:0}],orbTowers:[{y:0}],solids:[]},a={id:0,human:true,team:0,alive:true,state:{},planToken:0,role:'Player'};let combat;
 const carts=createBattleChariots({world,scene,actors:[a],navigation:{},getCombat:()=>combat}),craft=carts.vehicles[0];
 craft.root.position.set(0,50,0);craft.root.rotation.y=yaw;Object.assign(a.state,{x:0,y:50,z:0});assert(carts.interact());
 const wall=new T.Mesh(new T.BoxGeometry(.24,1,.2),new T.MeshBasicMaterial());wall.position.set(4.95,50.85,2);wall.position.applyAxisAngle(new T.Vector3(0,1,0),yaw);wall.rotation.y=yaw;scene.add(wall);world.solids.push(wall);scene.updateMatrixWorld(true);
 const collision=createBattleCollision(world.solids,carts.parts);combat={state:{phase:'running',time:0},objectives:[],collision};const end=new T.Vector3(0,50,5).applyAxisAngle(new T.Vector3(0,1,0),yaw);assert.equal(collision.firstHit({x:0,y:50,z:0},end,new Set(carts.parts)),null,'Centre ray misses an off-centre wing obstacle');
 carts.setMotion({x:Math.sin(yaw),z:Math.cos(yaw)},0);
 for(let i=0;i<120;i++){combat.state.time+=1/60;scene.updateMatrixWorld(true);carts.step(1/60);}
 const local=craft.root.position.clone().applyAxisAngle(new T.Vector3(0,1,0),-yaw);checks.push({yaw,forward:local.z,centreRayMissed:true});assert(local.z<2.42,'Wing clearance must stop before the obstacle, despite clear centre ray');
 wall.visible=false;
 for(let i=0;i<60;i++){combat.state.time+=1/60;scene.updateMatrixWorld(true);carts.step(1/60);}assert(craft.root.position.clone().applyAxisAngle(new T.Vector3(0,1,0),-yaw).z>20,'Hidden obstacle must not block clearance probes');
}
{
 const scene=new T.Scene(),world={pads:[{x:0,y:47,z:0},{x:100,y:47,z:0}],orbTowers:[{y:0}],solids:[]},a={id:0,human:true,team:0,alive:true,state:{x:0,y:50,z:0},planToken:0,role:'Player'};let combat;
 const carts=createBattleChariots({world,scene,actors:[a],navigation:{},getCombat:()=>combat}),craft=carts.vehicles[0];craft.root.position.set(0,50,0);assert(carts.interact());
 const wing=new T.Vector3(4.95,.85,-.5).applyAxisAngle(new T.Vector3(0,1,0),Math.PI/4),wall=new T.Mesh(new T.BoxGeometry(.4,.4,.4),new T.MeshBasicMaterial());wall.position.copy(wing).add(new T.Vector3(.06,50,0));scene.add(wall);world.solids.push(wall);scene.updateMatrixWorld(true);
 combat={state:{phase:'running',time:0},objectives:[],collision:createBattleCollision(world.solids,carts.parts)};carts.setMotion({x:1,z:0},0);carts.step(1/60);
 assert.equal(craft.root.rotation.y,0,'A blocked turning wing keeps the previous bearing');assert.equal(craft.root.position.x,0,'A blocked turn also cancels translation');checks.push({turningWing:true,blockedBearingRestored:true});
}
fs.writeFileSync(new URL('../review/chariot-clearance.json',import.meta.url),JSON.stringify({passed:true,scope:'Actual controller and visible triangle collision; four rotated off-centre wing obstacles, turning wing arc and hidden-obstacle release. Sampled hull clearance, not continuous full-volume collision or every narrow obstacle.',checks},null,2));console.log(checks);
