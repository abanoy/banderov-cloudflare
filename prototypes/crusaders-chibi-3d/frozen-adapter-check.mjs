import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createWorldCharacter as live} from './src/adapter.js';
import {createWorldCharacter as frozen} from './snapshots/review-runtime-20261008-1550/src/adapter.js';
const directory='snapshots/review-runtime-20261008-1550',manifest=JSON.parse(fs.readFileSync(`${directory}/manifest.json`,'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const row of manifest.files){const data=fs.readFileSync(`${directory}/${row.path}`);assert.equal(data.length,row.bytes);assert.equal(hash(data),row.sha256);assert(data.equals(fs.readFileSync(row.path)));}
assert.equal(manifest.totalBytes,manifest.files.reduce((sum,row)=>sum+row.bytes,0));
let frames=0;
for(const parameters of [{},{bodyOutline:'defined',gestureReach:'forward',neutralEyeContour:'narrow',batchFaceInk:true}])for(const worldHeight of [1.2,2.1,4]){
 const a=live({worldHeight,parameters}),b=frozen({worldHeight,parameters});
 try{
  for(const m of [a,b]){m.setPosition(3,5,-7);m.setFacingVector(-1,1);assert.equal(m.forwardAxis,'+Z');assert.equal(m.anatomicalRightAxis,'-X');assert.equal(m.root.position.y,5);}
  assert.deepEqual(a.stats(),b.stats());
  for(const expression of ['neutral','happy','surprised','alarmed']){
   for(const m of [a,b])m.setExpression(expression);
   for(const pose of ['neutral','idle','walk','wave','gasp']){
    for(const m of [a,b])m.setPose(pose);
    for(let frame=0;frame<64;frame++){
     for(const m of [a,b]){m.update(.025);m.root.updateMatrixWorld(true);}
     for(const name of Object.keys(a.parts))assert.deepEqual(a.parts[name].matrixWorld.elements,b.parts[name].matrixWorld.elements);
     assert.deepEqual(a.root.position.toArray(),[3,5,-7]);assert.equal(a.root.rotation.y,Math.atan2(-1,1));
     assert.deepEqual(a.bounds().min.toArray(),b.bounds().min.toArray());assert.deepEqual(a.bounds().max.toArray(),b.bounds().max.toArray());frames++;
    }
   }
  }
  for(const m of [a,b]){m.reset();assert.equal(m.pose,'neutral');assert.equal(m.parts['right-hand'].parent.rotation.y,0);m.dispose();m.dispose();m.setExpression('alarmed');assert.equal(m.disposed,true);}
 }finally{a.dispose();b.dispose();}
}
for(const row of manifest.files)assert.equal(hash(fs.readFileSync(`${directory}/${row.path}`)),row.sha256);
fs.writeFileSync('review/frozen-adapter-report.json',JSON.stringify({snapshot:directory,files:manifest.files.length,totalBytes:manifest.totalBytes,pairedFrames:frames,scope:'Copied/live exact named world matrices/bounds/transform ownership across2appearance options/3heights/4expressions/5poses/64steps. Hashes/reset/disposal; no actual terrain, browser/GPU, physics, or human likeness proof.'},null,2));
console.log(`PASS ${frames} copied/live adapter frames, five file hashes, reset/disposal`);
