import assert from 'node:assert/strict';import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {createChibi} from './src/model.js';
const source=fs.readFileSync('research/model-before-eye-aliases.js','utf8').replace('../vendor/three.module.js',pathToFileURL(`${process.cwd()}/vendor/three.module.js`).href).replace('./lighting.js',pathToFileURL(`${process.cwd()}/src/lighting.js`).href),{createChibi:old}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const meshes=m=>{const out=[];m.root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};let expressions=0;
for(const options of [{},{geometryDetail:'economical'},{batchFaceInk:true,neutralEyeContour:'narrow',tuftVolume:'rounded'}]){
 const a=old(options),b=createChibi(options);
 try{
  for(let cycle=0;cycle<3;cycle++)for(const expression of ['neutral','happy','surprised','alarmed']){
   a.setExpression(expression);b.setExpression(expression);const x=meshes(a),y=meshes(b);assert.equal(x.length,y.length);assert.deepEqual(a.stats(),b.stats());assert.deepEqual(a.bounds(),b.bounds());
   for(let i=0;i<x.length;i++){assert.equal(x[i].name,y[i].name);assert.deepEqual(x[i].geometry.index?.array,y[i].geometry.index?.array);for(const attr of Object.keys(x[i].geometry.attributes))assert.deepEqual(x[i].geometry.attributes[attr].array,y[i].geometry.attributes[attr].array);assert.deepEqual(x[i].matrixWorld.elements,y[i].matrixWorld.elements);}
   for(const side of ['right','left'])for(const feature of ['eye-white','iris']){
    const name=side+'-'+feature,active=expression!=='happy'&&(feature!=='iris'||expression==='neutral');assert.equal(Boolean(b.parts[name]),active);
    if(active){assert.equal(b.parts[name].parent.name,'');assert(b.root.getObjectById(b.parts[name].id));b.parts[name].geometry.computeBoundingBox();assert.equal(b.parts[name].geometry.boundingBox.min.x<0,side==='right');}
    else assert.throws(()=>b.makePartGeometryIndependent(name),RangeError);
   }
   if(expression==='neutral'){assert.equal(b.parts['iris'],b.parts['left-iris']);assert.equal(b.parts['eye-white'],b.parts['left-eye-white']);assert.notEqual(b.parts['right-iris'],b.parts['left-iris']);}
   expressions++;
  }
  b.setExpression('neutral');const other=b.parts['left-iris'].geometry.attributes.position.array.slice(),g=b.makePartGeometryIndependent('right-iris');g.attributes.position.setX(0,g.attributes.position.getX(0)+.01);assert.deepEqual(b.parts['left-iris'].geometry.attributes.position.array,other);
  b.setExpression('happy');assert(!b.parts['right-iris']);b.setExpression('neutral');assert(b.parts['right-iris']);
 }finally{a.dispose();b.dispose();}
}
fs.writeFileSync('review/eye-alias-report.json',JSON.stringify({expressions,scope:'Three option sets/36 expression transitions; preserved raw geometry/index/transforms/bounds/resource/mesh names exact. Four active-only side aliases, anatomical right-X/left+X, legacy left aliases, independent iris edit and expression guards. Deliberate edit not saved; no new render or owner likeness claim.'},null,2));console.log('PASS36 expression checks and independent anatomical eye aliases');
