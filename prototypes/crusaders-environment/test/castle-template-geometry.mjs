import * as T from '../vendor/three.module.js';
import {profile,containsCell} from '../floating-castle/castle-rules.js';
import {createConstruction,PARTS} from '../floating-castle/castle-construction.js';
import {templateCatalog,buildTemplate} from '../floating-castle/castle-templates.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {flightWorld} from '../floating-castle/flight.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const report={scope:'Node geometry fixtures for thirty authored template variants. Actual construction meshes with synthetic original scene and real crown; objective floor-ray checks do not establish path reachability. Separate navigation suite supplies fixed-step route evidence.',checks:[],failures:[],sourceHashes:{}};
for(const name of ['castle-construction.js','castle-templates.js','castle-curves.js'])report.sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
try{
 const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{x:0,y:20,z:0,radius:8.4,crown:true});}),solids=[],occluders=[],construction=createConstruction({mats,castles,castleHearts,solids,occluders}),names=new Set(),signatures=new Set();
 for(let level=10;level<=100;level+=10)for(const item of templateCatalog({level})){
  const data=buildTemplate(item.id,{level}),config=profile({level}),signature=JSON.stringify(data.layout),types=new Set(data.layout.map(p=>p.type));names.add(data.name);signatures.add(signature);
  assert(data.layout.length<=720);assert(data.layout.every(p=>containsCell(p,config)));assert.equal(new Set(data.layout.map(p=>p.x+':'+p.z+':'+p.layer)).size,data.layout.length);assert.equal(data.layout.filter(p=>p.type==='core').length,1);assert.equal(Math.max(...data.layout.map(p=>p.layer))+1,data.layers);assert.equal(data.layers,Math.max(2,level/10));
  const midX=(config.minX+config.maxX-1)/2,midZ=(config.minZ+config.maxZ-1)/2;for(const sx of [-1,1])for(const sz of [-1,1])assert(data.layout.some(p=>(p.x-midX)*sx>0&&(p.z-midZ)*sz>0));
  const built=construction.preview(0,data.layout,{level}),sim=flightWorld(built.colliders,[{x:22,y:.77,z:74,r:6}]);let disposed=0;const owned=new Set();built.root.traverse(o=>{if(o.geometry&&!o.name.startsWith('Preview'))owned.add(o.geometry);});
  for(const p of data.objectives){const support=sim.floor(p.x,p.y+.15,p.z,.3);assert(support&&Math.abs(support.y-p.y)<.02,'Objective needs a real matching floor: '+item.id+' '+level+' '+p.id);}
  const emitters=[];built.root.traverse(o=>{if(o.userData.defense&&!o.userData.solidTerrace)emitters.push(o.userData.defense.type);});assert(emitters.length>0,'Every template has a real local-practice emitter: '+item.id+' '+level);
  const stats={id:item.id,level,name:data.name,parts:data.layout.length,layers:data.layers,colliders:built.colliders.length,objectives:data.objectives.length,emitters,types:[...types]};report.checks.push(stats);built.dispose();built.dispose();assert.equal(JSON.stringify(data.layout),signature);
 }
 assert.equal(names.size,30);assert.equal(signatures.size,30);assert(PARTS.some(p=>p.id==='beacon'));assert(PARTS.some(p=>p.id==='battlement'));assert(PARTS.some(p=>p.id==='deck'));assert.throws(()=>buildTemplate('unknown'));const a=buildTemplate('rampart',{level:10});a.layout[0].x=999;assert.notEqual(buildTemplate('rampart',{level:10}).layout[0].x,999);report.passed=true;
}catch(error){report.passed=false;report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}
fs.writeFileSync(new URL('../review/castle-template-geometry.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log((report.passed?'PASS':'FAIL')+': '+report.checks.length+' template variants');if(report.failures.length)console.error(report.failures[0].stack);
