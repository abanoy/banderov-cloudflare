import fs from 'node:fs';import assert from 'node:assert/strict';import {createChibi} from './src/model.js';
const expanded=g=>Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>{const count=g.index?.count||a.count,values=new Uint32Array(count*a.itemSize),bits=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length);for(let i=0;i<count;i++){const n=g.index?g.index.getX(i):i;values.set(bits.subarray(n*a.itemSize,(n+1)*a.itemSize),i*a.itemSize);}return [name,values];}));
const meshes=m=>{const out=[];m.root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
const bytes=m=>{const set=new Set();m.root.traverse(o=>{if(o.geometry)set.add(o.geometry);});return [...set].reduce((n,g)=>n+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength||0),0);};
let steps=0;const rows=[];
for(const options of [{},{geometryDetail:'economical'},{batchFaceInk:true,bodyOutline:'defined',gestureReach:'forward',tuftVolume:'rounded'},{hairContour:'angular'}]){
 const a=createChibi({...options,indexGeometry:false}),b=createChibi({...options,indexGeometry:true});
 try{
  const initial={options,beforeBytes:bytes(a),indexedBytes:bytes(b)};assert(initial.indexedBytes<initial.beforeBytes);
  for(const expression of ['neutral','happy','surprised','alarmed']){
   a.setExpression(expression);b.setExpression(expression);const x=meshes(a),y=meshes(b);assert.equal(x.length,y.length);
   for(let i=0;i<x.length;i++){assert.equal(x[i].name,y[i].name);assert.deepEqual(expanded(x[i].geometry),expanded(y[i].geometry));assert.deepEqual(x[i].geometry.groups,y[i].geometry.groups);assert.deepEqual(x[i].geometry.drawRange,y[i].geometry.drawRange);}
   for(const pose of ['neutral','idle','walk','wave','gasp']){a.setPose(pose);b.setPose(pose);for(let i=0;i<32;i++){a.update(.025);b.update(.025);a.bounds();b.bounds();for(let j=0;j<x.length;j++)assert.deepEqual(x[j].matrixWorld.elements,y[j].matrixWorld.elements);assert.deepEqual(a.bounds(),b.bounds());steps++;}}
   assert.deepEqual(a.stats(),b.stats());
  }
  rows.push(initial);
  const owned=new Map();b.root.traverse(o=>{if(o.geometry&&!owned.has(o.geometry)){owned.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>owned.set(o.geometry,owned.get(o.geometry)+1));}});b.dispose();b.dispose();assert([...owned.values()].every(n=>n===1));
 }finally{a.dispose();b.dispose();}
}
fs.writeFileSync('review/exact-index-geometry.json',JSON.stringify({steps,rows,scope:'Bit-exact expanded Float32 attributes and same triangle order/groups/draw ranges, four expressions/five poses/four options, named world matrices/bounds/resource counts/disposal. Geometry-array bytes only, not heap/VRAM/FPS.'},null,2));console.log(JSON.stringify({steps,rows}));
