import assert from 'node:assert/strict';
import {directionIndex,screenMotion,constrainMove} from './movement-math.js';
const cases=[[0,1,0],[1,1,1],[1,0,2],[1,-1,3],[0,-1,4],[-1,-1,5],[-1,0,6],[-1,1,7]];
for(const orbit of [0,Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI])for(const [x,y,index] of cases){const v=screenMotion(x,y,orbit);assert.equal(directionIndex(v.heading-orbit),index);assert.ok(Math.abs(Math.hypot(v.x,v.z)-1)<1e-12);}
assert.equal(directionIndex(-Math.PI/4),7);assert.equal(directionIndex(Math.PI*2),0);assert.equal(directionIndex(Math.PI/8,16),1);
assert.equal(screenMotion(0,0).length,0);
assert.deepEqual(constrainMove({x:11.9,z:0},1,0,[]),{x:12,z:0});
assert.deepEqual(constrainMove({x:0,z:0},1,0,[{x:1,z:0,r:.9}]),{x:0,z:0});
console.log('PASS: 40 camera-relative eight-direction cases; equal diagonal speed, signed wrap, idle, arena and pillar collision.');
