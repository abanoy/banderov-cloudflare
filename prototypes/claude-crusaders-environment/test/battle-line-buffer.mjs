import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createLineBuffer} from '../floating-castle/battle-line-buffer.js';
import {shotSolution,trajectory} from '../floating-castle/battle-aim.js';
import {WEAPONS} from '../floating-castle/battle-combat.js';

const buffer=createLineBuffer(4096),geometry=buffer.geometry,attribute=geometry.attributes.position;
let disposals=0,frames=0;geometry.addEventListener('dispose',()=>disposals++);
function check(points){
 const baseline=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(p.x,p.y,p.z)));
 baseline.computeBoundingSphere();buffer.begin();for(const p of points)buffer.point(p);buffer.finish();
 assert.equal(buffer.geometry,geometry);assert.equal(geometry.attributes.position,attribute);
 assert.equal(geometry.drawRange.count,points.length);
 assert.deepEqual(Array.from(attribute.array.subarray(0,points.length*3)),Array.from(baseline.attributes.position.array));
 if(points.length){assert.deepEqual(geometry.boundingSphere.center,baseline.boundingSphere.center);assert.equal(geometry.boundingSphere.radius,baseline.boundingSphere.radius);assert.equal(attribute.updateRange.count,points.length*3);}
 else assert.equal(geometry.boundingSphere.radius,0);
 baseline.dispose();frames++;
}
// Actual ballistic solutions, including a clipped preview then no solution.
for(const w of WEAPONS){
 const origin={x:-130.123,y:90.125,z:55.625},target={x:-80.125,y:120.5,z:70.75},solution=shotSolution(origin,target,w);
 if(solution){const points=trajectory(origin,solution);check(points);check(points.slice(0,7));check([]);}
}
// 128-player capacity: simultaneous bot aim segments, variable channels,
// clearing, reappearance and translated endpoints that leave old bounds.
for(let frame=0;frame<300;frame++){
 const segments=[];for(let actor=0;actor<127;actor++)if((actor+frame)%3===0){const origin={x:actor*4-frame,y:40+frame,z:frame-actor*2},sol=shotSolution(origin,{x:origin.x+40,y:origin.y+8,z:origin.z+12},WEAPONS[4]);if(sol){const points=trajectory(origin,sol,16);for(let i=1;i<points.length;i++)segments.push(points[i-1],points[i]);}}
 check(segments);check(Array.from({length:frame%129*2},(_,i)=>({x:frame+i*.3,y:i+1.2,z:-frame-i})));if(frame%8===0)check([]);
}
check(Array.from({length:127*32},(_,i)=>({x:i*.125,y:i%23,z:-i*.25})));
assert.equal(disposals,0,'No frame disposals');
const offset=createLineBuffer(2);offset.begin();offset.point({x:4,y:5,z:6},1.2);offset.finish();assert.equal(offset.geometry.attributes.position.array[1],Math.fround(6.2));
const growth=createLineBuffer(1),stable=growth.geometry;growth.begin();for(let i=0;i<33;i++)growth.point({x:i,y:0,z:0});growth.finish();assert.equal(growth.geometry,stable);assert.equal(stable.drawRange.count,33);assert(stable.attributes.position.count>=33);growth.begin();growth.point({x:-500,y:3,z:7});growth.finish();assert.equal(stable.drawRange.count,1);assert.equal(stable.boundingSphere.center.x,-500);assert.equal(stable.boundingSphere.radius,0);
const workload=Array.from({length:256},(_,i)=>new T.Vector3(i*.2,i%17,-i*.3));
function oldRun(){const start=performance.now();for(let i=0;i<4000;i++){const g=new T.BufferGeometry().setFromPoints(workload);g.computeBoundingSphere();g.dispose();}return performance.now()-start;}
function newRun(){const start=performance.now();for(let i=0;i<4000;i++){buffer.begin();for(const p of workload)buffer.point(p);buffer.finish();}return performance.now()-start;}
oldRun();newRun();const old=[],next=[];for(let i=0;i<5;i++){if(i%2){next.push(newRun());old.push(oldRun());}else{old.push(oldRun());next.push(newRun());}}
const median=a=>a.slice().sort((x,y)=>x-y)[2],before=median(old),after=median(next);
const report={passed:true,framesCompared:frames,steadyGeometryDisposals:disposals,steadyAttributeChanges:0,growthAndShrinkPassed:true,timing:{scope:'Node 4000 updates of 256 endpoints including bounds; not browser FPS or GPU performance',beforeMs:before,afterMs:after,percentLower:100*(before-after)/before,old,next}};
fs.writeFileSync('review/battle-line-buffer-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
