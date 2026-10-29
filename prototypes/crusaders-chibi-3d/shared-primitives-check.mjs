import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {createChibi} from './src/model.js';
const oldText=fs.readFileSync('research/model-before-shared-primitives.js','utf8').replace('../vendor/three.module.js',pathToFileURL(`${process.cwd()}/vendor/three.module.js`).href).replace('./lighting.js',pathToFileURL(`${process.cwd()}/src/lighting.js`).href);
const {createChibi:before}=await import(`data:text/javascript;base64,${Buffer.from(oldText).toString('base64')}`);
const buffers=m=>{const geometries=new Set();m.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});let bytes=0;for(const g of geometries){for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;if(g.index)bytes+=g.index.array.byteLength;}return {geometries:geometries.size,typedArrayBytes:bytes};};
const rows=[];let pairedSteps=0;
for(const geometryDetail of ['smooth','economical'])for(const options of [{},{bodyOutline:'defined',gestureReach:'forward',batchFaceInk:true,neutralEyeContour:'narrow'}]){
 const old=before({geometryDetail,...options}),off=createChibi({geometryDetail,...options,sharePrimitives:false}),shared=createChibi({geometryDetail,...options});
 try{
  assert.deepEqual(old.stats(),off.stats());assert.equal(shared.stats().geometries,off.stats().geometries-10);assert.equal(shared.stats().triangles,off.stats().triangles);
  for(const name of Object.keys(old.parts))for(const m of [off,shared]){
   const a=old.parts[name].geometry,b=m.parts[name].geometry;
   for(const key of Object.keys(a.attributes))assert.deepEqual(a.attributes[key].array,b.attributes[key].array);
   assert.deepEqual(a.index?.array,b.index?.array);
  }
  assert.equal(shared.parts['right-ear'].geometry,shared.parts['left-foot'].geometry);assert.equal(shared.parts['right-arm'].geometry,shared.parts['left-arm'].geometry);
  assert.notEqual(shared.parts['circular-head'].geometry,shared.parts['right-ear'].geometry);assert.notEqual(shared.parts['right-ear'].geometry,off.parts['right-ear'].geometry);
  rows.push({geometryDetail,options,before:buffers(off),shared:buffers(shared)});
  for(const expression of ['neutral','happy','surprised','alarmed'])for(const pose of ['neutral','idle','walk','wave','gasp']){
   for(const m of [old,off,shared]){m.setExpression(expression);m.setPose(pose);}
   for(let step=0;step<32;step++){
    for(const m of [old,off,shared]){m.update(.025);m.root.updateMatrixWorld(true);}
    for(const name of Object.keys(old.parts))for(const m of [off,shared])assert.deepEqual(old.parts[name].matrixWorld.elements,m.parts[name].matrixWorld.elements);pairedSteps++;
   }
  }
  const disposed=new Map();shared.root.traverse(o=>{if(o.geometry&&!disposed.has(o.geometry)){disposed.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>disposed.set(o.geometry,disposed.get(o.geometry)+1));}});
  shared.dispose();shared.dispose();assert([...disposed.values()].every(n=>n===1));
 }finally{old.dispose();off.dispose();shared.dispose();}
}
fs.writeFileSync('review/shared-primitives-geometry.json',JSON.stringify({pairedSteps,rows,scope:'Preserved-source/off/default exact named geometry attributes and pose matrices; actor-local sharing, unique typed-array counts and once-only disposal. No measured VRAM, construction-speed or phone FPS claim.'},null,2));
console.log(`PASS ${pairedSteps} preserved-source/off/shared pose steps; exact attributes, ten fewer geometry objects, disposal once`);
