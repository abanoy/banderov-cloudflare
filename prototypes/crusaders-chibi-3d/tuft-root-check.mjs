import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import * as T from './vendor/three.module.js';import {createChibi} from './src/model.js';
const text=fs.readFileSync('research/model-before-tuft-root.js','utf8').replace('../vendor/three.module.js',pathToFileURL(`${process.cwd()}/vendor/three.module.js`).href).replace('./lighting.js',pathToFileURL(`${process.cwd()}/src/lighting.js`).href),{createChibi:old}=await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);let frames=0;
for(const options of [{},{geometryDetail:'economical'},{tuftVolume:'rounded'},{hairContour:'angular'}]){
 const a=old(options),floating=createChibi({...options,tuftAttachment:'floating'}),b=createChibi(options);
 try{
  assert.equal(Boolean(b.parts['leaf-tuft-root']),options.hairContour!=='angular');assert.deepEqual(a.stats(),floating.stats());assert.equal(a.height,b.height);
  for(const pose of ['neutral','idle','walk','wave','gasp']){a.setPose(pose);floating.setPose(pose);b.setPose(pose);for(let i=0;i<64;i++){
   for(const m of[a,floating,b]){m.update(.025);m.bounds();}
   for(const name of Object.keys(a.parts)){assert.deepEqual(a.parts[name].matrixWorld.elements,floating.parts[name].matrixWorld.elements);assert.deepEqual(a.parts[name].matrixWorld.elements,b.parts[name].matrixWorld.elements);for(const attr of Object.keys(a.parts[name].geometry.attributes)){assert.deepEqual(a.parts[name].geometry.attributes[attr].array,b.parts[name].geometry.attributes[attr].array);assert.deepEqual(a.parts[name].geometry.attributes[attr].array,floating.parts[name].geometry.attributes[attr].array);}}
   assert.deepEqual(a.bounds(),b.bounds());
   if(b.parts['leaf-tuft-root']){const r=b.parts['leaf-tuft-root'],point=r.geometry.parameters.path.getPoint(1).applyMatrix4(r.matrixWorld).applyMatrix4(new T.Matrix4().copy(b.parts['circular-head'].parent.matrixWorld).invert());assert((point.x/.681)**2+(point.y/.681)**2+(point.z/(b.parameters.headDepth+.045))**2<1,'Root base inside crown');}
   frames++;
  }}
  if(b.parts['leaf-tuft-root']){
   assert.equal(b.stats().triangles,a.stats().triangles+144);assert.equal(b.stats().geometries,a.stats().geometries+1);assert.equal(b.stats().materials,a.stats().materials+1);
   const mat=new T.MeshBasicMaterial({side:T.DoubleSide}),probe=new T.Mesh(b.parts['leaf-tuft'].geometry,mat),point=b.parts['leaf-tuft-root'].geometry.parameters.path.getPoint(0);probe.updateMatrixWorld();
   try{const hits=new T.Raycaster(new T.Vector3(point.x,point.y,1),new T.Vector3(0,0,-1)).intersectObject(probe);assert(hits.length>=2);assert(Math.min(...hits.map(h=>h.point.z))<point.z&&Math.max(...hits.map(h=>h.point.z))>point.z,'Root top inside tuft');}finally{mat.dispose();}
  }
 }finally{a.dispose();floating.dispose();b.dispose();}
}
fs.writeFileSync('review/tuft-root-geometry.json',JSON.stringify({frames,scope:'1280 old/floating/rooted pose steps: old named geometry/matrices/global bounds unchanged,144 added triangles/one geometry/material, angular inert. Root base center inside analytic dome and root top between actual tuft cap ray hits. Not full mesh intersection, collision or all-phase/device proof.'},null,2));console.log('PASS1280 tuft attachment pose steps and bounded top/base contact');
