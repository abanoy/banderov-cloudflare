import assert from 'node:assert/strict';
import {CampNetwork,sectorPoint,homeReady,jumpTo} from '../camp-rules.js';
import {fieldGeometry} from '../resource-field.js';
import {flightWorld} from '../game/flight.js';
import * as T from '../vendor/three.module.js';
const n=new CampNetwork(),accounts=Array.from({length:8},()=>[0,0]),c=n.camps[0],p={id:0,...c,grounded:true,flight:false,action:null};
const income=(id,values)=>accounts[id]=accounts[id].map((v,i)=>v+values[i]);
function run(seconds,players){for(let i=0;i<seconds*4;i++)n.step(.25,players,income);}
assert.throws(()=>new CampNetwork(9));assert.equal(n.camps.length,12);for(let i=0;i<8;i++){const h=sectorPoint(i,220),next=sectorPoint((i+1)%8,220);assert(Math.abs(Math.hypot(h.x-next.x,h.z-next.z)-168.3807102)<1e-6);}
run(5,[{...p,action:'capture'}]);assert.equal(c.owner,null);run(1,[{...p,action:'capture'}]);assert.equal(c.owner,0);assert(!c.linked);run(8,[p]);assert.deepEqual(accounts[0],[0,0]);run(2,[{...p,action:'link'}]);assert(c.linked);run(5,[p]);assert.deepEqual(accounts[0],[10,5]);
const rival={...p,id:1,action:'capture'};run(4,[p,rival]);assert(c.contested);assert.deepEqual(accounts[0],[10,5]);assert.equal(c.owner,0);run(6,[rival]);assert.equal(c.owner,1);assert(!c.linked);const stopped=[...accounts[0]];run(5,[rival]);assert.deepEqual(accounts[0],stopped);assert.deepEqual(accounts[1],[0,0]);run(2,[{...rival,action:'link'}]);run(3,[rival]);assert.deepEqual(accounts[1],[6,3]);
run(6,[{...p,action:'capture'}]);assert.equal(c.owner,0);assert(!c.linked);run(2,[{...p,action:'link'}]);run(2,[p]);assert.deepEqual(accounts[0],stopped.map((v,i)=>v+[4,2][i]));
const airborne={...p,y:4,grounded:false,flight:true,action:'capture'};const neutral=n.camps[1];run(8,[{...airborne,x:neutral.x,z:neutral.z}]);assert.equal(neutral.owner,null);assert.throws(()=>n.step(.25,[p,{...p}],income));assert.throws(()=>n.step(1,[p],income));
console.log('PASS 8 evenly spaced slots; physical-presence capture/link; automatic income; contested pause; rival capture severs beam; no income inheritance; reclaim/relink; airborne and duplicate rejection');
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),world=fieldGeometry(new T.Scene(),mats),phys=flightWorld(world.solids,[{...world.homes[0].dock,r:7}]);assert(homeReady(phys.state));assert(jumpTo(phys,world.network.camps[0],3));assert(!homeReady(phys.state));assert(!jumpTo(phys,world.homes[0].dock,4));for(let i=0;i<440;i++)phys.step(1/120,{x:0,z:0});assert(phys.state.grounded);assert.equal(world.network.near(phys.state)?.id,0);assert(Math.abs(phys.state.y-world.network.camps[0].y)<.01);assert(jumpTo(phys,world.homes[0].dock,4));for(let i=0;i<560;i++)phys.step(1/120,{x:0,z:0});assert(homeReady(phys.state),JSON.stringify(phys.state));assert.equal(phys.state.falls,0);world.dispose();
console.log('PASS actual triangle physics: dock jump, camp landing, return ascent, supported home dock and blueprint gate (1000 fixed steps)');
