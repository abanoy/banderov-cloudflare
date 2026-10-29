import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {captureDesignSeed} from '../floating-castle/castle-anchor-plan.js';
import {verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';
import {inspectCastleFootprint} from '../floating-castle/castle-footprint.js';
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()]));
const castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{radius:8.4,crown:true});});
const solids=[],occluders=[],construction=createConstruction({mats,castles,castleHearts,solids,occluders});
const timestamp=Date.now(),report={timestamp,scope:'Three current timestamp-derived level100 AI proposals. Actual isolated construction and inspectCastle physics route walks; port ownership/channel scan and variation checks. No native bot match, render, multiplayer, broad seed guarantee or performance acceptance.',cases:[],failures:[]};
const signatures=new Set(),before=JSON.stringify(construction.counts);
try{
 for(let i=0;i<3;i++){
  const stamp=timestamp+i*137,captured=captureDesignSeed(stamp),plan=await verifiedBattleCastlePlan({construction,home:i%2,level:100,seed:captured.seed,timestamp:stamp}),scan=inspectCastleFootprint(plan.layout);
  assert(plan.navigation.ok);assert.equal(plan.navigation.routes,plan.navigation.total);assert(scan.ok);assert(scan.ports.length>=1&&scan.ports.length<=4);assert(scan.ports.every(p=>p.attached&&p.clear));assert(scan.spawns.length>0);assert.equal(plan.layout.filter(p=>p.type==='core').length,1);assert.equal(plan.layout.filter(p=>p.type==='protector').length,6);assert(plan.layout.some(p=>p.type==='house'));assert(plan.layout.some(p=>p.type==='garden'));assert.equal(plan.network.blocked,0);
  const signature=crypto.createHash('sha256').update(JSON.stringify(plan.layout)).digest('hex');signatures.add(signature);
  const entry={timestamp:stamp,inputSeed:captured.seed,acceptedSeed:plan.seed,home:i%2,family:plan.family,parts:plan.layout.length,signature,navigation:plan.navigation,ports:scan.ports.map(p=>({rotation:p.rotation,cells:p.cells.length,attached:p.attached,clear:p.clear,big:p.big})),spawnPoints:scan.spawns,attempts:plan.attempts};report.cases.push(entry);console.log(JSON.stringify({case:i+1,family:entry.family,parts:entry.parts,routes:entry.navigation.routes,ports:entry.ports.length,attempts:entry.attempts.length}));
  assert.equal(JSON.stringify(construction.counts),before);assert.equal(solids.length,0);assert.equal(occluders.length,0);
 }
 assert.equal(signatures.size,3);report.passed=true;report.uniqueLayouts=signatures.size;
}catch(error){report.passed=false;report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;console.error(error);}
fs.writeFileSync(new URL('../review/seeded-port-route-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
