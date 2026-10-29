import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {inspectCastle} from '../floating-castle/castle-navigation.js';
import {verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{radius:8.4,crown:true});}),solids=[],build=createConstruction({mats,castles,castleHearts,solids,occluders:[]});
const p=(x,z,type,layer=0,rotation=0)=>({x,z,layer,type,rotation}),apron=Array.from({length:4},(_,i)=>p(8,8+i,'floor')),core=p(1,1,'core'),checks=[];
async function check(name,layout,options,expected,settings={}){const view=build.preview(0,layout,options);try{const result=await inspectCastle(view,layout,options,settings),guns=layout.filter(p=>['cannon','heavyCannon','beacon'].includes(p.type)),routes=result.routes.filter(r=>r.id.startsWith('defense-'));assert.equal(routes.length,guns.length,name+' checks every gun');assert.equal(result.ok,expected,name);if(expected)assert(routes.every(r=>r.ok&&r.forward.ok&&r.reverse.ok&&r.forward.falls===0&&r.reverse.falls===0));else assert(routes.some(r=>!r.ok));assert.equal(solids.length,0);assert(build.counts.every(c=>!c.custom));checks.push({name,parts:layout.length,defenses:guns.length,result});console.log(name+': '+result.summary);}finally{view.dispose();}}
try{
 for(const type of ['cannon','heavyCannon','beacon']){
  const isolated=[...apron,core,p(5,5,type)];
  await check(type+' disconnected ground tile',isolated,{level:20},false,{objectives:[{id:'safe',label:'Safe authored court',x:20,y:.77,z:28}]});
  for(let rotation=0;rotation<4;rotation++){
   const bridge=[p(8,7,'floor'),p(8,6,'floor'),p(8,5,'floor'),p(7,5,'floor'),p(6,5,'floor')];
   await check(type+' connected approach rotation '+rotation,[...apron,core,...bridge,p(5,5,type,0,rotation)],{level:20},true);
  }
 }
 await check('Upper cannon without stairs',[...apron,core,p(8,7,'cannon',1)],{level:20},false);
 await check('Upper cannon through stair landing',[...apron.filter(p=>p.z!==8),core,p(8,8,'stairs'),p(8,7,'cannon',1)],{level:20},true);
 if(process.argv.includes('--generated')){
  const plan=await verifiedBattleCastlePlan({construction:build,level:100,seed:685637696});
  await check('Generated level100 castle retains reachable defenses',plan.layout,plan.options,true);
 }
 fs.writeFileSync(new URL('../review/defense-access.json',import.meta.url),JSON.stringify({passed:true,scope:'Actual isolated preview colliders, 120Hz outward and return walks; no native input/combat effectiveness claim',checks},null,2));
}catch(error){fs.writeFileSync(new URL('../review/defense-access.json',import.meta.url),JSON.stringify({passed:false,error:error.stack,checks},null,2));throw error;}
