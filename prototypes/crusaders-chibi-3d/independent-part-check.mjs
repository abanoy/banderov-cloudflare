import assert from 'node:assert/strict';import fs from 'node:fs';import {createChibi} from './src/model.js';
let variants=0;
for(const options of [{},{geometryDetail:'economical'},{bodyOutline:'defined',gestureReach:'forward'}, {sharePrimitives:false,batchFaceInk:true}]){
 const m=createChibi(options);
 try{
  const start=m.stats(),ear=m.parts['right-ear'],other=m.parts['left-ear'],original=ear.geometry,otherPositions=other.geometry.attributes.position.array.slice(),before=ear.geometry.attributes.position.array.slice(),outline=ear.children.find(o=>o.userData.outline);
  const copy=m.makePartGeometryIndependent('right-ear');
  assert.equal(ear.geometry,copy);assert.equal(outline.geometry,copy);assert.deepEqual(copy.attributes.position.array,before);
  assert.equal(m.makePartGeometryIndependent('right-ear'),copy);assert.equal(m.stats().triangles,start.triangles);
  assert.equal(m.stats().geometries,start.geometries+(options.sharePrimitives===false?0:1));
  copy.attributes.position.setX(0,copy.attributes.position.getX(0)+.2);copy.attributes.position.needsUpdate=true;
  assert.deepEqual(other.geometry.attributes.position.array,otherPositions);assert.equal(outline.geometry.attributes.position.getX(0),copy.attributes.position.getX(0));
  if(options.sharePrimitives!==false)assert.notEqual(copy,original);
  const unique=m.parts['circular-head'].geometry,count=m.stats().geometries;
  assert.equal(m.makePartGeometryIndependent('circular-head'),unique);assert.equal(m.stats().geometries,count);
  assert.throws(()=>m.makePartGeometryIndependent('missing'),RangeError);assert.equal(m.stats().geometries,count);
  m.setExpression('alarmed');assert.throws(()=>m.makePartGeometryIndependent('iris'),RangeError);
  m.setExpression('neutral');assert(m.makePartGeometryIndependent('iris').isBufferGeometry);
  const owned=new Map();m.root.traverse(o=>{if(o.geometry&&!owned.has(o.geometry)){owned.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>owned.set(o.geometry,owned.get(o.geometry)+1));}});
  m.dispose();m.dispose();assert([...owned.values()].every(v=>v===1));assert.throws(()=>m.makePartGeometryIndependent('right-ear'),/disposed/);variants++;
 }finally{m.dispose();}
}
fs.writeFileSync('review/independent-part-report.json',JSON.stringify({variants,scope:'Four allocation/mesh/ink variants: cloned ear attributes independent from sibling, primary and outline share clone, repeated call/unique geometry no extra allocations, inactive/disposed guards, once-only disposal. Deliberate test edit is not saved to model/default appearance; cached foot support/height not recomputed for arbitrary vertex edits.'},null,2));
console.log('PASS four variants: independent part+outline edits, guards, repeated calls and disposal');
