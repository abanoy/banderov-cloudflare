import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import * as before from './fixtures/rounded-physics-before-support.mjs';
import * as after from '../integration-rounded/src/physics.js';
import {makeLayout,heightAt} from '../integration-rounded/src/layout.js';
const queries=[],world=makeLayout();
for(const scaled of [false,true]){
 const w=makeLayout(scaled);
 for(const f of w.surfaces)for(const dx of [0,-f.w/2,f.w/2,f.w/2+1e-5])for(const dz of [0,-f.l/2,f.l/2,f.l/2+1e-5])for(const offset of [-1,-1e-6,0,1e-6,1,100]){
  const q=[w,f.x+dx,f.z+dz,heightAt(f,f.z+dz)+offset];assert.equal(after.supportAt(...q),before.supportAt(...q),'Exact support object at floor/edge/height boundary');queries.push(q);
 }
}
const equal={...world,surfaces:[{id:'first',x:0,z:0,w:8,l:8,y:2,slope:0},{id:'second',x:0,z:0,w:8,l:8,y:2,slope:0}]};assert.equal(after.supportAt(equal,0,0,2),equal.surfaces[0]);assert.equal(after.supportAt(equal,100,100,2),undefined);
let steps=0;const routes=[];
function pairedStep(a,b,input){before.step(a,world,input,1/120);after.step(b,world,input,1/120);assert.deepEqual(b,a,'Complete physics state at fixed step '+steps++);}
for(const from of world.pads)for(const to of world.pads.filter(p=>p!==from)){
 const a=before.newState(world),b=after.newState(world);a.checkpoint=b.checkpoint=from.id;before.recover(a,world);after.recover(b,world);assert(before.launch(a,world,to.id)&&after.launch(b,world,to.id));let budget=2000;
 while(a.travel&&budget-->0)pairedStep(a,b,{});assert(budget>0&&b.grounded&&after.nearPad(b,world)?.id===to.id);routes.push({from:from.id,to:to.id});
}
const a=before.newState(world),b=after.newState(world);assert(before.launch(a,world,'dark')&&after.launch(b,world,'dark'));
for(let i=0;i<1600;i++){
 if(i===180){before.guide(a,world,'island');after.guide(b,world,'island');}
 if(i===240){before.pilot(a);after.pilot(b);}
 if(i===600){a.paused=b.paused=true;}if(i===650){a.paused=b.paused=false;}
 if(i===900){before.reset(a,world);after.reset(b,world);}
 pairedStep(a,b,i<180?{x:1,climb:i<120?1:0}:i<240?{}:i<600?{z:1,climb:i<360?-1:0}:i<900?{x:-1}:i<1150?{z:1}:{x:1});
}
function measure(fn){let found=0;const start=performance.now();for(let i=0;i<100000;i++)found+=!!fn(...queries[i%queries.length]);return {ms:performance.now()-start,found};}
measure(before.supportAt);measure(after.supportAt);const pairs=[];for(let i=0;i<5;i++){let old,current;if(i%2){current=measure(after.supportAt);old=measure(before.supportAt);}else{old=measure(before.supportAt);current=measure(after.supportAt);}assert.equal(current.found,old.found);pairs.push({beforeMs:old.ms,afterMs:current.ms});}
const median=k=>pairs.map(p=>p[k]).sort((a,b)=>a-b)[2],old=median('beforeMs'),current=median('afterMs');
const report={passed:true,scope:'Exact object identity at all authored floor boundaries in both layout scales, equal-height order, six full arc states and mixed guide/manual/ceiling/pause/reset/walking states. Timing is warmed100000 support queries in alternating5pairs, not browser FPS or whole-frame time.',queries:queries.length,steps,routes,pairs,beforeMedianMs:old,afterMedianMs:current,reductionPercent:100*(old-current)/old};fs.writeFileSync(new URL('../review/rounded-support-performance.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
