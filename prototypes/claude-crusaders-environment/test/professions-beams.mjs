import fs from 'node:fs';import assert from 'node:assert/strict';import {tierFortifications} from '../floating-castle/castle-fortifications.js';
import * as T from '../vendor/three.module.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {verifiedBattleCastlePlan,battleCastlePlan} from '../floating-castle/castle-architect.js';
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],hearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{radius:8.4,crown:true});}),construction=createConstruction({mats,castles,castleHearts:hearts,solids:[],occluders:[]});
const plan=battleCastlePlan({level:100,seed:5611748,home:0,construction});const v=construction.preview(0,plan.layout,plan.options);for(const l of v.links.filter(l=>!l.linked)){const ray=new T.Raycaster(l.from,l.to.clone().sub(l.from).normalize(),.05,l.from.distanceTo(l.to)-8.5);const hits=ray.intersectObjects(v.colliders,false);console.log(l.cell,l.blocker,hits.slice(0,3).map(h=>({point:h.point,user:h.object.userData,parent:h.object.parent.userData})));}const {inspectCastle}=await import('../floating-castle/castle-navigation.js');const r=await inspectCastle(v,plan.layout,plan.options);console.log(JSON.stringify({issues:r.issues,routes:r.routes.filter(x=>!x.forward?.ok||!x.reverse?.ok)},null,2));v.dispose();

