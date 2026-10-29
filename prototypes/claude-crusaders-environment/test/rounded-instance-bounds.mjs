import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as T from '../integration-rounded/vendor/three.module.js';
import {addEnvironmentDetail} from '../integration-rounded/src/detail.js';
import {makeLayout,SCALE} from '../integration-rounded/src/layout.js';
import {installStaticInstanceBounds} from '../integration-rounded/src/instance-ray-bounds.js';
const layout=makeLayout(false);
function fixture(optimized){
 const scene=new T.Scene(),objects=[],groups=[];let detailedCalls=0;
 for(const destination of layout.destinations){
  const group=new T.Group();group.position.set(destination.x,destination.y,destination.z);group.scale.set(SCALE.horizontal,SCALE.vertical,SCALE.horizontal);scene.add(group);groups.push(group);
  const mats=Object.fromEntries(['stone','edge','roof','ground','rock','accent'].map(name=>[name,new T.MeshBasicMaterial()]));
  for(const mesh of addEnvironmentDetail(group,mats,destination.kind==='castle',destination.dark)){
   mesh.userData.batch=objects.length;const raycast=mesh.raycast;
   mesh.raycast=function(ray,hits){detailedCalls++;raycast.call(this,ray,hits);};objects.push(mesh);
  }
 }
 const installed=optimized?installStaticInstanceBounds(objects):0;scene.updateMatrixWorld(true);
 return {scene,objects,groups,installed,calls:()=>detailedCalls};
}
const baseline=fixture(false),current=fixture(true),ray=new T.Raycaster();
let seed=4217;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const rays=[];
for(let i=0;i<600;i++){
 const group=baseline.groups[i%baseline.groups.length],center=group.position;
 const origin=new T.Vector3(center.x+(random()-.5)*300,center.y+(random()-.3)*160,center.z+(random()-.5)*300);
 const target=new T.Vector3(center.x+(random()-.5)*100,center.y+(random()-.5)*70,center.z+(random()-.5)*100);
 rays.push({origin,direction:target.sub(origin).normalize(),near:i%7===0?2:0,far:i%5===0?12:300});
}
for(const group of baseline.groups)for(const direction of [new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)])rays.push({origin:group.position.clone(),direction,near:0,far:300});
// Aim through representative thin ornaments at the start, middle and end of
// every batch rather than relying only on randomly generated camera rays.
for(const object of baseline.objects)for(const index of [0,Math.floor(object.count/2),object.count-1]){
 const matrix=new T.Matrix4();object.getMatrixAt(index,matrix);
 const center=new T.Vector3().applyMatrix4(matrix).applyMatrix4(object.matrixWorld);
 const offset=new T.Vector3(11,17,13);rays.push({origin:center.clone().add(offset),direction:offset.negate().normalize(),near:0,far:100});
}
const describe=hits=>hits.map(hit=>({batch:hit.object.userData.batch,instance:hit.instanceId,distance:hit.distance}));
let hitCount=0;
function compare(){for(const test of rays){ray.set(test.origin,test.direction);ray.near=test.near;ray.far=test.far;const before=describe(ray.intersectObjects(baseline.objects,false)),after=describe(ray.intersectObjects(current.objects,false));assert.deepEqual(after,before);hitCount+=after.length;}}
compare();
// Parent transforms change after installation, exercising cache invalidation.
for(const fixture of [baseline,current]){fixture.groups[0].position.x+=31;fixture.groups[0].rotation.y=.37;fixture.groups[1].scale.x*=1.13;fixture.scene.updateMatrixWorld(true);}
compare();
assert(current.calls()<baseline.calls()/2);assert(hitCount>0);
const report={raysPerPass:rays.length,passes:2,exactIntersectionsCompared:hitCount,batches:current.objects.length,instances:current.objects.reduce((n,o)=>n+o.count,0),baselineDetailedBatchCalls:baseline.calls(),boundedDetailedBatchCalls:current.calls(),reductionPercent:100*(1-current.calls()/baseline.calls()),scope:'Real authored ornament batches and scales; exact full hit arrays, near/far, inside rays, moved/rotated/scaled parents. Not full camera avoidance/native FPS or dynamic instance transforms.'};
function timed(fixture){const start=performance.now();let hits=0;for(const test of rays){ray.set(test.origin,test.direction);ray.near=test.near;ray.far=test.far;hits+=ray.intersectObjects(fixture.objects,false).length;}return {milliseconds:performance.now()-start,hits};}
// Warm both implementations, then alternate order to reduce first-run bias.
timed(baseline);timed(current);const beforeTimes=[],afterTimes=[];
for(let i=0;i<8;i++)for(const fixture of i%2?[current,baseline]:[baseline,current]){
 const sample=timed(fixture);assert(sample.hits>0);(fixture===baseline?beforeTimes:afterTimes).push(sample.milliseconds);
}
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
report.cpuTiming={raysPerBatch:rays.length,alternatingBatches:8,beforeMilliseconds:beforeTimes,afterMilliseconds:afterTimes,beforeMedian:median(beforeTimes),afterMedian:median(afterTimes),medianReductionPercent:100*(1-median(afterTimes)/median(beforeTimes)),scope:'Warmed Node wall-time for identical static ornament ray queries only; not native camera frame time, GPU or browser FPS.'};
writeFileSync(new URL('../review/rounded-instance-bounds.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
