import * as T from '../vendor/three.module.js';
import {buildAerie} from '../floating-castle/aerie-castle.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {createConstruction,presets} from '../floating-castle/castle-construction.js';
import {flightWorld} from '../floating-castle/flight.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const report={scope:'Node geometry and explicit fixed-step fixtures against actual Aerie castle geometry. No browser/native-input, image, arbitrary-layout or GPU-memory claim.',checks:[],failures:[],sourceHashes:{}};
for(const name of ['castle-construction.js','castle.js','aerie-castle.js'])report.sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
function check(name,details={}){report.checks.push({name,...details});}
try{
 const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()]));
 const original=buildAerie(mats),castles=[original.root,original.root.clone(true)],solids=[],castleHearts=[];
 for(let home=0;home<2;home++){
  const castle=castles[home];castle.position.set(home?205:-205,55,home?-22:22);castle.rotation.y=home?-Math.PI/2:Math.PI/2;
  castle.traverse(o=>{if(o.userData.structure){o.userData.castleIndex=home;solids.push(o);}});
  const heart=chargeOrb(castle,mats,{x:-17,y:68,z:-55,radius:8.4,crown:true});castleHearts.push(heart);for(const o of [heart.core,heart.foot]){o.userData.castleIndex=home;solids.push(o);}castle.updateMatrixWorld(true);
 }
 const occluders=solids.slice(),world={mats,castles,solids,occluders,castleHearts},construction=createConstruction(world),initialSolids=solids.slice(),initialOccluders=occluders.slice();
 const worldPoint=(home,v)=>new T.Vector3(...v).applyMatrix4(castles[home].matrixWorld),pads=castles.map((_,home)=>{const p=worldPoint(home,[22,.77,74]);return {x:p.x,y:p.y,z:p.z,r:6};});
 const originalGeometry=new Set(),originalMaterials=new Set(),originalInstances=[];for(const castle of castles)castle.traverse(o=>{if(o.geometry)originalGeometry.add(o.geometry);if(o.material)originalMaterials.add(o.material);if(o.isInstancedMesh)originalInstances.push(o);});
 let originalGeometryDisposals=0,originalMaterialDisposals=0,originalInstanceDisposals=0;
 for(const g of originalGeometry)g.addEventListener('dispose',()=>originalGeometryDisposals++);for(const m of originalMaterials)m.addEventListener('dispose',()=>originalMaterialDisposals++);for(const i of originalInstances)i.addEventListener('dispose',()=>originalInstanceDisposals++);
 const previewResults=[];
 for(const home of [0,1]){
  const before={counts:construction.counts,solids:solids.map(o=>o.id),occluders:occluders.map(o=>o.id),children:castles.map(c=>c.children.map(o=>o.id)),visibility:castles.map(c=>c.children.map(o=>o.visible)),hearts:castleHearts.map(h=>h.root.position.toArray())},layout=presets(home?'citadel':'courtyard'),preview=construction.preview(home,layout);
  assert.equal(preview.root.parent,null);assert(preview.root.userData.preview);assert(preview.colliders.length>100);assert(preview.colliders.every(o=>!solids.includes(o)&&!occluders.includes(o)));assert.deepEqual(solids.map(o=>o.id),before.solids);assert.deepEqual(occluders.map(o=>o.id),before.occluders);assert.deepEqual(construction.counts,before.counts);assert.deepEqual(castles.map(c=>c.children.map(o=>o.id)),before.children);assert.deepEqual(castles.map(c=>c.children.map(o=>o.visible)),before.visibility);assert.deepEqual(castleHearts.map(h=>h.root.position.toArray()),before.hearts);
  const crown=preview.root.getObjectByName('Preview castle heart');assert(crown&&crown!==castleHearts[home].root);assert.equal(crown.children[0].geometry,castleHearts[home].core.geometry);assert.equal(crown.children[0].material,castleHearts[home].core.material);
  const owned=new Set(),instances=[];preview.root.traverse(o=>{if(o.geometry&&!originalGeometry.has(o.geometry))owned.add(o.geometry);if(o.isInstancedMesh)instances.push(o);});let disposed=0,instanceDisposals=0;for(const g of owned)g.addEventListener('dispose',()=>disposed++);for(const i of instances)i.addEventListener('dispose',()=>instanceDisposals++);
  const signature=preview.colliders.map(o=>[o.geometry.type,o.position.toArray(),o.scale.toArray(),o.userData.wallDepth??null]);
  construction.apply(home,layout);const actual=solids.filter(o=>o.userData.construction&&o.userData.castleIndex===home);assert.deepEqual(actual.map(o=>[o.geometry.type,o.position.toArray(),o.scale.toArray(),o.userData.wallDepth??null]),signature);assert.deepEqual(castleHearts[home].root.position.toArray(),crown.position.toArray());construction.restore(home);
  preview.dispose();preview.dispose();assert.equal(disposed,owned.size);assert.equal(instanceDisposals,instances.length);assert.equal(originalGeometryDisposals,0);assert.equal(originalMaterialDisposals,0);assert.equal(originalInstanceDisposals,0);
  previewResults.push({home,colliders:actual.length,crownIncluded:true,ownGeometryDisposedOnce:disposed,ownInstanceBuffersDisposedOnce:instanceDisposals});
 }
 check('Preview purity, exact apply geometry, shared crown ownership and idempotent owned-resource disposal',{previews:previewResults});
 const heartMaterial=castleHearts[0].core.material,temporaryFade=heartMaterial.clone();temporaryFade.transparent=true;temporaryFade.opacity=.18;castleHearts[0].core.material=temporaryFade;castleHearts[0].core.userData.fadeMaterial=temporaryFade;
 const unfaded=construction.preview(0,[]),previewCore=unfaded.root.getObjectByName('Preview castle heart').children[0];assert.equal(previewCore.material,heartMaterial);assert.equal(castleHearts[0].core.material,temporaryFade);assert(!previewCore.userData.fadeMaterial);unfaded.dispose();castleHearts[0].core.material=heartMaterial;delete castleHearts[0].core.userData.fadeMaterial;temporaryFade.dispose();
 check('Preview crown ignores transient gameplay camera fading without changing the live core');
 assert.throws(()=>construction.preview(0,[{x:1,z:2,layer:10,type:'wall',rotation:0}]));assert.deepEqual(solids.length,initialSolids.length);check('Preview rejects invalid input without modifying the map');

 const single=[{x:6,z:6,layer:0,type:'gate',rotation:0},{x:3,z:6,layer:0,type:'wall',rotation:0}],view=construction.preview(0,single),walls=view.colliders.filter(o=>o.userData.wallDepth),gate=walls.filter(o=>o.userData.wallRole.startsWith('gate'));
 assert.equal(walls.length,4);for(const wall of walls){assert.equal(wall.userData.wallDepth,3.2);assert(Math.abs(new T.Box3().setFromObject(wall).getSize(new T.Vector3()).z-3.2)<1e-9);}
 const ray=new T.Raycaster();function cast(x){ray.set(new T.Vector3(4+x,3.77,8),new T.Vector3(0,0,-1));ray.far=16;return ray.intersectObjects(gate,false);}
 assert.equal(cast(2.999).length,0);assert.equal(cast(-2.999).length,0);assert(cast(3.001).length);assert(cast(-3.001).length);
 const edgeBatch=view.root.children.find(o=>o.isInstancedMesh&&o.material.userData.castleRole==='edge'),matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();let wideCaps=0,wideCrenels=0;
 for(let i=0;i<edgeBatch.count;i++){edgeBatch.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);if(Math.abs(scale.z-3.5)<.001)wideCaps++;if(Math.abs(scale.z-3.45)<.001)wideCrenels++;}
 assert.equal(wideCaps,4);assert.equal(wideCrenels,6);check('Custom wall/gate bodies and trim grow together while real gate opening stays six metres',{bodyDepth:3.2,wideCaps,wideCrenels,clearGateWidth:6});view.dispose();

 const originalWalls=[];castles[0].traverse(o=>{if(o.userData.wallRole)originalWalls.push({role:o.userData.wallRole,localDepth:o.userData.wallDepth,scale:o.parent===castles[0].children[0]?2.2:1,solid:solids.includes(o)});});
 assert(originalWalls.every(o=>o.solid));assert.equal(originalWalls.filter(o=>o.role==='terrace wall').length,2);assert.equal(originalWalls.filter(o=>o.role==='entrance wall').length,2);assert.equal(originalWalls.filter(o=>o.role==='apron parapet').length,2);
 const innerEdges=[];castles[0].children[0].traverse(o=>{if(o.userData.wallRole==='terrace wall')innerEdges.push(o.position.z-o.scale.z/2);});assert(Math.abs(innerEdges[0]-(20.5-.325))<1e-9);assert(Math.abs(innerEdges[1]-(4-.325))<1e-9);
 const facade=castles[0].getObjectByName('Facade fittings');assert.equal(facade.position.z,.55);check('Original walls are thicker solid geometry with preserved terrace inside edges and facade alignment',{walls:originalWalls,innerEdges,facadeShift:.55});

 const junctions=[];
 for(const home of [0,1]){
  const route=original.route.map(p=>worldPoint(home,p).toArray());
  for(let i=1;i<route.length-1;i++){
   const previous=route[i-1],joint=route[i],next=route[i+1];if(!(previous[1]<joint[1]&&joint[1]===next[1]))continue;
   const dx=joint[0]-previous[0],dz=joint[2]-previous[2],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,ex=next[0]-joint[0],ez=next[2]-joint[2],outLength=Math.hypot(ex,ez),vx=ex/outLength,vz=ez/outLength;
   for(const offset of [-.4,0,.4]){
    const sim=flightWorld(solids,pads),s=sim.state,cx=joint[0]+uz*offset,cz=joint[2]-ux*offset,x=cx-ux*4,z=cz-uz*4,support=sim.floor(x,joint[1]+1,z,10);assert(support);Object.assign(s,{x,y:support.y,z,home,grounded:true});
    const walk=(x,z,steps)=>{for(let k=0;k<steps;k++)sim.step(1/120,{x,z});};walk(ux,uz,48);const arrivalError=Math.hypot(s.x-cx,s.z-cz);walk(vx,vz,60);const exitError=Math.hypot(s.x-cx-vx*5,s.z-cz-vz*5);walk(-vx,-vz,60);walk(-ux,-uz,48);const returnError=Math.hypot(s.x-x,s.z-z);
    assert(arrivalError<.15&&exitError<.15&&returnError<.15&&s.grounded&&Math.abs(s.y-support.y)<.15&&s.falls===0&&s.home===home,JSON.stringify({home,i,offset,arrivalError,exitError,returnError,state:s}));junctions.push({home,i,offset,arrivalError,exitError,returnError});
   }
  }
 }
 assert.equal(junctions.length,18);check('Original castle eighteen ramp-junction out-and-back fixed-step fixtures remain passable',{junctions});
 report.passed=true;
}catch(error){report.passed=false;report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}
fs.writeFileSync(new URL('../review/castle-live-geometry.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log((report.passed?'PASS':'FAIL')+': '+report.checks.length+' live-editor geometry groups');if(report.failures.length)console.error(report.failures[0].stack);
