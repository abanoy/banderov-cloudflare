import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {inspectCastle,structuralHints} from '../floating-castle/castle-navigation.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const report={scope:'Independent diagnostic failure fixtures against actual preview colliders, including an intentionally injected solid overhead slab. No map/actor mutation, native-input or arbitrary-layout guarantee.',startedAt:new Date().toISOString(),checks:[],failures:[],sourceHashes:{}};
const sourceNames=['castle-navigation.js','castle-construction.js','castle-curves.js','flight.js'],hash=name=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
for(const name of sourceNames)report.sourceHashes[name]=hash(name);
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=[];
for(const c of castles){c.add(new T.Group(),new T.Group());castleHearts.push(chargeOrb(c,mats,{radius:8.4,crown:true}));}
const solids=[],construction=createConstruction({mats,castles,castleHearts,solids,occluders:[]}),options={level:20},p=(x,z,layer,type,rotation=0)=>({x,z,layer,type,rotation}),baseline=[p(8,8,0,'stairs'),p(8,8,1,'floor'),p(8,7,1,'floor'),p(1,1,0,'core')],objectives=[{id:'upper',label:'Upper landing',x:20,y:8.77,z:8}];
async function check(name,layout,expected,mutate,settings={}){const view=construction.preview(0,layout,options);let extra;try{extra=mutate?.(view);const result=await inspectCastle(view,layout,options,{objectives,...settings});assert.equal(result.ok,expected,name);assert.equal(solids.length,0);assert(!construction.counts.some(c=>c.custom));if(!expected){assert(result.issues.length);assert(result.issues.every(i=>i.cell&&i.message&&i.suggestion));}report.checks.push({name,...result});console.log(name+': '+result.summary);}finally{view.dispose();extra?.geometry.dispose();extra?.material.dispose();}}
try{
 await check('Valid single stair and upper landing',baseline,true);
 const terraced=[p(8,9,0,'stairs'),p(8,8,1,'terrace'),p(8,7,1,'stairs'),p(8,6,2,'terrace'),p(1,1,0,'core')];
 await check('Two solid terraces connect through their stair landings',terraced,true,undefined,{objectives:undefined});
 const underpass=[p(8,8,0,'stairs'),p(8,7,1,'floor'),p(8,6,1,'floor'),p(8,7,3,'terrace'),p(1,1,0,'core')];
 await check('An explicit lower passage crosses beneath a taller solid terrace',underpass,true,undefined,{objectives:[{id:'underpass',label:'Far end of the lower passage',x:20,y:8.77,z:0}]});
 assert(report.checks.at(-1).routes[0].points.some(p=>Math.abs(p.x-20)<3&&p.z>4&&p.z<12&&Math.abs(p.y-8.77)<.01),'The independently found route must cross the actual lower passage.');
 await check('Isolated solid terrace is checked after reload',[p(8,7,2,'terrace'),p(1,1,0,'core')],false,undefined,{objectives:undefined});
 await check('A buried ground objective inside solid masonry is rejected',[p(8,7,2,'terrace'),p(1,1,0,'core')],false,undefined,{objectives:[{id:'buried',label:'Buried ground position',x:20,y:.77,z:8}]});
 assert.equal(report.checks.at(-1).issues[0].code,'objective-blocked','An interior point must not be admitted as a standing floor.');
 assert.equal(report.checks.at(-1).issues[0].cell.layer,2,'An occupied point must identify the solid terrace piece, not the buried target layer.');
 await check('Removed stairs disconnect the upper floor',baseline.filter(p=>p.type!=='stairs'),false);
 await check('Missing upper landing is diagnosed',[p(8,8,0,'stairs'),p(1,1,0,'core')],false,undefined,{objectives:undefined});
 const closed=baseline.concat(Array.from({length:12},(_,x)=>p(x,11,0,'wall')));await check('Solid front wall blocks the entrance',closed,false);
 await check('A real low overhead slab blocks stair headroom',baseline,false,view=>{const slab=new T.Mesh(new T.BoxGeometry(8,1.2,8),new T.MeshStandardMaterial());slab.position.set(20,6.3,16);slab.userData.cell={x:8,z:8,layer:1,type:'floor'};slab.name='Deliberately obstructing slab';view.root.add(slab);view.colliders.push(slab);view.root.updateMatrixWorld(true);return slab;});
 const slabIssue=report.checks.at(-1).issues[0];assert.equal(slabIssue.code,'blocked-stair-headroom');assert.deepEqual(slabIssue.cell,{x:8,z:8,layer:1,type:'floor'});assert.equal(slabIssue.blocker.name,'Deliberately obstructing slab');
 const hints=structuralHints([p(8,8,0,'stairs')],options);assert(hints.some(h=>h.code==='missing-landing'));report.checks.push({name:'Cheap structural hints are separately labelled as hints',hints});
 const controller=new AbortController(),view=construction.preview(0,baseline,options);let progress=0,disposed=0;view.colliders[0].geometry.addEventListener('dispose',()=>disposed++);try{await assert.rejects(inspectCastle(view,baseline,options,{signal:controller.signal,onProgress(){progress++;controller.abort();}}),e=>e.name==='AbortError');assert(progress>0);assert.equal(disposed,0);assert.equal(solids.length,0);report.checks.push({name:'Async progress permits cancellation and leaves preview ownership with caller',progress,disposedBeforeCaller:disposed});}finally{view.dispose();}
 report.passed=true;
}catch(e){report.passed=false;report.failures.push({message:e.message,stack:e.stack});console.error(e);process.exitCode=1;}finally{
 report.finishedAt=new Date().toISOString();report.finalSourceHashes=Object.fromEntries(sourceNames.map(name=>[name,hash(name)]));report.sourceStable=sourceNames.every(name=>report.sourceHashes[name]===report.finalSourceHashes[name]);
 if(!report.sourceStable){report.passed=false;report.failures.push({message:'Source changed while fixtures ran; repeat after source freeze.'});process.exitCode=1;}
 fs.writeFileSync(new URL('../review/castle-navigation-failures.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
}
