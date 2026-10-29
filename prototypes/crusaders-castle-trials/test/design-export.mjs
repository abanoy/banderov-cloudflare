import assert from 'node:assert/strict';
import {exportDesign} from '../design-export.js';
import {COSTS} from '../loop.js';
const p=(x,z,type='floor',layer=0,rotation=0)=>({x,z,type,layer,rotation});
const layout=[p(4,6,'spawn'),p(5,6),p(6,6,'core'),p(7,6)],before=JSON.stringify(layout),a=exportDesign(layout);
assert.equal(JSON.stringify(layout),before);assert.deepEqual(a.design.layout,layout);assert.notEqual(a.design.layout,layout);assert.deepEqual(a.design.options,{level:20,material:'fortress'});assert.equal(a.bytes,new TextEncoder().encode(a.text).length);assert(a.bytes<200000);assert.deepEqual(Object.keys(a.design).sort(),['format','layout','options','source','version']);assert.equal(a.design.source,'crusaders-castle-trials');
for(const bad of [[],[p(0,0,'core'),p(1,0,'core')],[...layout,p(5,6)],layout.map((v,i)=>i===0?{...v,x:12}:v),layout.map((v,i)=>i===0?{...v,layer:3}:v),layout.map((v,i)=>i===0?{...v,rotation:4}:v),layout.map((v,i)=>i===0?{...v,type:'toString'}:v),layout.map((v,i)=>i===0?{...v,stock:20}:v),layout.map((v,i)=>i===0?{...v,solid:'yes'}:v)])assert.throws(()=>exportDesign(bad));
const all=Object.keys(COSTS).map((type,i)=>p(i%12,Math.floor(i/12),type));assert.deepEqual(exportDesign(all).design.layout,all);
const flags=[{...p(1,1,'core'),solid:true,footprint:'round'}];assert.deepEqual(exportDesign(flags).design.layout,flags);
console.log('PASS exact design-only envelope; immutable full-piece copy; options/bytes; all paid types; invalid/duplicate/unsupported data refused without dropping pieces');


const {assertTrialsPieces}=await import('../piece-support.js');
assert.doesNotThrow(()=>assertTrialsPieces([]));assert.doesNotThrow(()=>assertTrialsPieces(all));
const newer=[...layout,{x:2,z:3,layer:0,type:'unknownSiege',rotation:1}],exact=JSON.stringify(newer);
assert.throws(()=>exportDesign(newer),e=>e.message.includes('unknownSiege')&&e.message.includes('cell 2,3, layer 0')&&e.message.includes('No pieces were dropped or converted'));
assert.throws(()=>assertTrialsPieces(newer),/Unsupported Castle Trials pieces/);assert.equal(JSON.stringify(newer),exact);
for(const type of ['protector','sketchBow','toString'])assert.throws(()=>assertTrialsPieces([{x:1,z:1,layer:0,type}]),e=>e.message.includes(type));
console.log('PASS explicit unsupported-type rejection names type/cell; export/load shared guard; empty and all old paid types retained; immutable unsupported design');
