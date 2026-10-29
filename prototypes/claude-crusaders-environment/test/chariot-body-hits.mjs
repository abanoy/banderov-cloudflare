import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../vendor/three.module.js';import {createBattleChariots} from '../floating-castle/battle-chariots.js';import {createBattleCombat} from '../floating-castle/battle-combat.js';
globalThis.document={createElement(){return {getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{})});}};}};
const report={passed:false,scope:'Actual chariot controller and combat projectile/shield routines in explicit controlled poses; real physical mesh bounds/rotated wing/wheel hits, friendly-body immunity, reset bounds and label/flame exclusion. Not native or full contested match.',checks:[]};
try{
 for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI]){
  const scene=new T.Scene(),world={pads:[{x:0,y:27,z:0},{x:100,y:27,z:0}],orbTowers:[{y:0}],solids:[]},actors=[0,1].map(i=>({id:i,team:i,alive:true,role:'Player',human:i===0,planToken:0,state:{x:1000+i*20,y:0,z:1000,grounded:true}}));let combat;
  const carts=createBattleChariots({world,scene,actors,navigation:{},getCombat:()=>combat}),craft=carts.vehicles[0];craft.root.position.set(0,30,0);craft.root.rotation.y=yaw;
  const target=new T.Vector3(4.5,30.5+1.5*Math.tan(.18),-.5).applyAxisAngle(new T.Vector3(0,1,0),yaw),from=new T.Vector3(4.5,target.y,-20).applyAxisAngle(new T.Vector3(0,1,0),yaw),gun={id:'gun',team:1,hp:100,alive:true,state:{x:from.x,y:from.y-1.05,z:from.z},mountWeapon:{damage:24,interval:.85,speed:85,life:3.6,spread:[0],radius:.1},ignore:new Set()};
  scene.updateMatrixWorld(true);combat=createBattleCombat({actors,objectives:[],solids:world.solids,dynamicSolids:carts.parts,mounts:[gun],vehicles:carts.vehicles});combat.start();
  assert(combat.fire(gun,target));for(let i=0;i<30;i++)combat.step(1/60);report.checks.push({yaw,hpAfterWingShot:craft.hp});assert.equal(craft.hp,236,'A real projectile hitting an outer wing must damage the chariot');
  const wheelTarget=new T.Vector3(2,29.9,0).applyAxisAngle(new T.Vector3(0,1,0),yaw),wheelFrom=new T.Vector3(2,29.9,-20).applyAxisAngle(new T.Vector3(0,1,0),yaw);Object.assign(gun.state,{x:wheelFrom.x,y:wheelFrom.y-1.05,z:wheelFrom.z});gun.nextShot=0;assert(combat.fire(gun,wheelTarget));for(let i=0;i<30;i++)combat.step(1/60);assert.equal(craft.hp,212,'A real projectile hitting a wheel must damage the craft');report.checks.at(-1).hpAfterWheelShot=craft.hp;
  gun.team=0;gun.nextShot=0;assert(combat.fire(gun,wheelTarget));for(let i=0;i<30;i++)combat.step(1/60);assert.equal(craft.hp,212,'Friendly physical body hits must not damage the craft');
  Object.assign(actors[0].state,{x:0,y:30,z:0});assert(carts.interact());carts.setMotion({x:0,z:0},0);carts.step(1/60);
  const expected=new T.Box3();for(const mesh of craft.root.children.filter(m=>m.isMesh&&m.geometry.type!=='OctahedronGeometry'))expected.union(new T.Box3().setFromObject(mesh));
  assert(craft.collisionHalfSize.distanceTo(expected.getSize(new T.Vector3()).multiplyScalar(.5))<1e-6);assert(craft.collisionOffset.clone().add(craft.root.position).distanceTo(expected.getCenter(new T.Vector3()))<1e-6);
  craft.label.visible=true;craft.flame.scale.setScalar(20);carts.step(1/60);assert(craft.collisionHalfSize.y<2,'Boarding label and exhaust must not enlarge physical hit bounds');
  if(yaw===Math.PI/2){combat.setShieldVolumes([{team:1,x:0,y:30,z:5.5,rx:1,ry:1,rz:1,exponent:8}]);combat.step(1/60);assert.equal(craft.hp,0,'Rotated outer body touching an enemy shield must shock the craft');report.checks.push({rotatedShieldShock:true});}
  combat.setShieldVolumes([]);carts.reset();assert(craft.root.position.equals(craft.home));assert.equal(craft.root.rotation.y,0);const resetExpected=new T.Box3();for(const mesh of craft.root.children.filter(m=>m.isMesh&&m.geometry.type!=='OctahedronGeometry'))resetExpected.union(new T.Box3().setFromObject(mesh));assert(craft.collisionHalfSize.distanceTo(resetExpected.getSize(new T.Vector3()).multiplyScalar(.5))<1e-6);
 }
 report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}finally{fs.writeFileSync(new URL('../review/chariot-body-hits.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
