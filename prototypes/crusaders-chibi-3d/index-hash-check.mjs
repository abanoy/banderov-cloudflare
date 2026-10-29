import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {createChibi} from './src/model.js';
const text=fs.readFileSync('research/model-before-hashed-indexing.js','utf8').replace('../vendor/three.module.js',pathToFileURL(`${process.cwd()}/vendor/three.module.js`).href).replace('./lighting.js',pathToFileURL(`${process.cwd()}/src/lighting.js`).href);
const {createChibi:before}=await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`),meshes=m=>{const a=[];m.root.traverse(o=>{if(o.isMesh)a.push(o);});return a;};let comparisons=0;
for(const options of [{},{geometryDetail:'economical'},{batchFaceInk:true,tuftVolume:'rounded'},{hairContour:'angular'}]){
 const a=before(options),b=createChibi(options);
 try{for(const expression of ['neutral','happy','surprised','alarmed']){a.setExpression(expression);b.setExpression(expression);const x=meshes(a),y=meshes(b);assert.equal(x.length,y.length);for(let i=0;i<x.length;i++){assert.equal(x[i].name,y[i].name);assert.deepEqual(x[i].geometry.index?.array,y[i].geometry.index?.array);for(const name of Object.keys(x[i].geometry.attributes))assert.deepEqual(x[i].geometry.attributes[name].array,y[i].geometry.attributes[name].array);}comparisons++;}}finally{a.dispose();b.dispose();}
}
// Force every hash into256 buckets to exercise collisions with actual geometry.
const original=Math.imul,a=before({geometryDetail:'economical'});let b,calls=0;
try{Math.imul=(x,y)=>{calls++;return original(x,y)&255;};b=createChibi({geometryDetail:'economical'});}finally{Math.imul=original;}
try{const x=meshes(a),y=meshes(b);for(let i=0;i<x.length;i++){assert.deepEqual(x[i].geometry.index?.array,y[i].geometry.index?.array);for(const name of Object.keys(x[i].geometry.attributes))assert.deepEqual(x[i].geometry.attributes[name].array,y[i].geometry.attributes[name].array);}}finally{a.dispose();b.dispose();}
assert(calls>256);fs.writeFileSync('review/index-hash-equivalence.json',JSON.stringify({comparisons,forcedCollisionHashCalls:calls,scope:'Four appearance/mesh variants and four expressions: hashed/string methods produce identical storage attributes and indices; forced256-bucket hash collisions preserve all records. No performance/device claim.'},null,2));console.log(JSON.stringify({comparisons,forcedCollisionHashCalls:calls}));
