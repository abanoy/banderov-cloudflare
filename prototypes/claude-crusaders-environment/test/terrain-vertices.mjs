import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../integration-rounded/vendor/three.module.js';
import {createWorldCharacter} from '../integration-rounded/character-grounded/adapter.js';
import {liftPenetratingSoles} from '../integration-rounded/experiment/terrain-support.js';
import {makeLayout,contains,heightAt} from '../integration-rounded/src/layout.js';
const trace=JSON.parse(fs.readFileSync('integration-rounded/review/terrain-continuity.json')).frames;
const world=makeLayout(),actor=createWorldCharacter({worldHeight:2.1}),rows=[];
function points(side){actor.root.updateMatrixWorld(true);const a=[],v=new T.Vector3();actor.parts[side+'-foot'].traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);a.push(v.toArray());}});return a;}
for(const center of [928,1190,1590,1852]){
 actor.setPose('walk');for(let i=0;i<center-3;i++)actor.update(1/120);
 let previous=null;
 for(let step=center-2;step<=center+2;step++){
  const fixture=trace.find(r=>r.step===step&&r.side==='right');assert(fixture);
  actor.setPosition(fixture.rootX,fixture.rootY,fixture.rootZ);actor.setFacing(fixture.facing);actor.update(1/120);
  const before={right:points('right'),left:points('left')},surface=world.surfaces.find(s=>s.id===fixture.supportId);
  const correction=liftPenetratingSoles(actor,(x,z)=>contains(surface,x,z)?heightAt(surface,z):null,{maxLift:.08});
  const after={right:points('right'),left:points('left')};
  for(const side of ['right','left']){
   const lift=correction.find(r=>r.side===side);assert.equal(before[side].length,after[side].length);
   for(let i=0;i<before[side].length;i++){assert(Math.abs(after[side][i][0]-before[side][i][0])<1e-8);assert(Math.abs(after[side][i][2]-before[side][i][2])<1e-8);assert(Math.abs(after[side][i][1]-before[side][i][1]-lift.lift)<1e-8);}
   if(previous){
    const prior=previous.correction.find(r=>r.side===side),deltas=after[side].map((p,i)=>p.map((v,j)=>v-previous.after[side][i][j]));
    const uncorrected=before[side].map((p,i)=>p.map((v,j)=>v-previous.before[side][i][j]));
    for(let i=0;i<deltas.length;i++)assert(Math.abs(deltas[i][1]-uncorrected[i][1]-(lift.lift-prior.lift))<1e-8);
    const lowestIndex=previous.after[side].reduce((best,p,i,a)=>p[1]<a[best][1]?i:best,0);
    rows.push({center,step,side,vertexCount:deltas.length,rootDelta:fixture.rootY-previous.fixture.rootY,liftDelta:lift.lift-prior.lift,missing:lift.missing,worldYRange:[Math.min(...deltas.map(p=>p[1])),Math.max(...deltas.map(p=>p[1]))],uncorrectedYRange:[Math.min(...uncorrected.map(p=>p[1])),Math.max(...uncorrected.map(p=>p[1]))],worldDistanceRange:[Math.min(...deltas.map(p=>Math.hypot(...p))),Math.max(...deltas.map(p=>Math.hypot(...p)))],priorLowestVertexIndex:lowestIndex,priorLowestVertexDelta:deltas[lowestIndex]});
   }
  }
  previous={before,after,correction,fixture};
 }
}
actor.dispose();
fs.writeFileSync('integration-rounded/review/terrain-vertices.json',JSON.stringify({rows,scope:'Same mesh traversal/vertex indices across adjacent recorded physics frames at four correction boundaries; actual copied sole and ink vertices, geometry unchanged. Separates root/gait/lift motion; no visible-pop, pixel-motion, physical-device or material contact recognition claim.'},null,2));
console.log(JSON.stringify(rows.filter(r=>r.step===r.center&&Math.abs(r.liftDelta)>.01),null,2));
