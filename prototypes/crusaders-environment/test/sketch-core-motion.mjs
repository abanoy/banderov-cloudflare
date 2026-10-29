import * as T from '../vendor/three.module.js';import assert from 'node:assert/strict';import fs from 'node:fs';
import {chargeOrb} from '../floating-castle/charge-orb.js';import {deriveTileFits} from '../floating-castle/castle-affordances.js';
const mats=Object.fromEntries(['stone','edge','dark','roof'].map(k=>[k,new T.MeshStandardMaterial()])),orb=chargeOrb(new T.Group(),mats,{radius:2,crown:true}),before=orb.axes.map(a=>a.rotation.clone());orb.update(.1);
assert.equal(orb.rings.length,3);assert.equal(new Set(orb.rings.map(r=>r.parent)).size,3);assert(orb.axes[0].rotation.y-before[0].y>0);assert(orb.axes[1].rotation.x-before[1].x<0);assert(orb.axes[2].rotation.z-before[2].z>0);orb.setShieldActive(false);assert.equal(orb.vortex.visible,false);orb.setShieldActive(true);assert(orb.vortex.visible);
const joins=[];for(let rotation=0;rotation<4;rotation++){const dx=Math.round(Math.cos(rotation*Math.PI/2)),dz=-Math.round(Math.sin(rotation*Math.PI/2)),wall={x:5,z:5,layer:0,type:'wall',rotation},tower={x:5+dx,z:5+dz,layer:0,type:'tower',rotation:0},fit=deriveTileFits([wall,tower],{level:100}).fits.get('5:5:0');assert.equal(fit.wallExtensions[1],1.95);joins.push({rotation,extension:fit.wallExtensions[1]});}
for(const crown of [true,false]){
 const core=chargeOrb(new T.Group(),mats,{radius:crown?4.7:1.35,crown});
 for(const ring of [...core.rings,...core.vortex.children]){
  const g=ring.geometry;assert.equal(g.parameters.arc,Math.PI*2);const p=g.attributes.position,n=g.parameters.tubularSegments;
  for(let j=0;j<=g.parameters.radialSegments;j++)for(let k=0;k<3;k++)assert(Math.abs(p.array[(j*(n+1))*3+k]-p.array[(j*(n+1)+n)*3+k])<1e-5,'Ring seam closes');
 }
 const initial=core.axes.map(a=>a.rotation.clone());for(let i=1;i<=10;i++)core.update(i/10);
 const speeds=[core.axes[0].rotation.y-initial[0].y,core.axes[1].rotation.x-initial[1].x,core.axes[2].rotation.z-initial[2].z];
 assert.deepEqual(speeds.map(v=>Math.sign(v)),[1,-1,1]);assert(speeds.every(v=>Math.abs(v)>1.5));assert.equal(new Set(speeds.map(v=>Math.abs(v).toFixed(2))).size,3);
}
fs.writeFileSync(new URL('../review/sketch-core-motion.json',import.meta.url),JSON.stringify({passed:true,rings:3,independentParents:true,opposingMotion:true,closedRingSeamsBothSizes:true,baseAngularSpeeds:[1.6,-2.25,3.05],shieldVortexToggle:true,wallJoins:joins},null,2));console.log('PASS independent core rings, shield vortex, all four wall-to-tower orientations');
