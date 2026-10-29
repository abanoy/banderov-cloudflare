// Workspace-only integration: directly reads the separate copied Wave runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exportDesign} from '../design-export.js';
import {COSTS} from '../loop.js';
import * as T from '../../crusaders-wave-defense/vendor/three.module.js';
import {parseDesign,starterLayout} from '../../crusaders-wave-defense/wave-rules.js';
import {createConstruction,PARTS} from '../../crusaders-wave-defense/runtime/castle-construction.js';
import {createBattleNavigation} from '../../crusaders-wave-defense/runtime/battle-navigation.js';
import {flightWorld} from '../../crusaders-wave-defense/runtime/flight.js';
import {chargeOrb} from '../../crusaders-wave-defense/runtime/charge-orb.js';
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()];castles[1].position.x=300;
const castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{x:0,y:12,z:0,radius:8.4,crown:true});});
const world={mats,castles,castleHearts,solids:[],occluders:[],pads:[{x:0,y:.77,z:40,r:2},{x:300,y:.77,z:40,r:2}],routes:[]},construction=createConstruction(world);
const unsupported=Object.keys(COSTS).filter(id=>!PARTS.some(p=>p.id===id));assert.deepEqual(unsupported,['trebuchet']);
const all=Object.keys(COSTS).filter(type=>!unsupported.includes(type)).map((type,i)=>({x:i%12,z:Math.floor(i/12),layer:0,rotation:0,type}));const typed=parseDesign(exportDesign(all).text);const preview=construction.preview(0,typed.layout,typed.options);preview.dispose();
for(const bad of [typed.layout.map((p,i)=>i===0?{...p,type:'invalid'}:p),[...typed.layout,typed.layout[0]],typed.layout.map((p,i)=>i===0?{...p,x:12}:p)])assert.throws(()=>construction.apply(0,bad,typed.options));
assert.throws(()=>parseDesign(JSON.stringify({layout:all,stock:[40,25]})));
const layout=starterLayout();layout.find(p=>p.x===4&&p.z===6).type='spawn';const d=parseDesign(exportDesign(layout).text);construction.apply(0,d.layout,d.options);assert.equal(construction.counts[0].parts,layout.length);castles.forEach(c=>c.updateMatrixWorld(true));
const nav=createBattleNavigation(world);await nav.rebuild();const core={x:20,y:.77,z:0,radius:2},evidence=[];
for(const from of [{x:0,y:.77,z:36},{x:32,y:.77,z:0},{x:0,y:.77,z:-28},{x:-32,y:.77,z:0}]){const path=await nav.path(from,core);assert(path.reachable,path.reason);assert(!path.points.some(p=>p.launchTo!==undefined));const sim=flightWorld(world.solids,[{...path.points[0],r:2}]);let steps=0;for(const target of path.points.slice(1)){let count=0;while(Math.hypot(sim.state.x-target.x,sim.state.z-target.z)>.3&&count++<2000){const dx=target.x-sim.state.x,dz=target.z-sim.state.z,n=Math.hypot(dx,dz);sim.step(1/120,{x:dx/n*.5,z:dz/n*.5});steps++;assert.equal(sim.state.falls,0);}assert(count<2000);assert(Math.abs(sim.state.y-target.y)<.3);}evidence.push({from,points:path.points.length,steps});}
nav.dispose();fs.writeFileSync(new URL('../review/design-export-compatibility.json',import.meta.url),JSON.stringify({passed:true,scope:'Actual copied Wave parser/construction and four selected synthetic-world routes; no browser wave preparation or playable siege claim',parts:Object.keys(COSTS),exportBytes:exportDesign(layout).bytes,evidence},null,2));
console.log('PASS Wave actual parser/construction accepts shared paid types; trebuchet remains unsupported and exported100-piece fixture; rejects malformed geometry; four selected collision-physics routes walked');
