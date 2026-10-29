import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';
const names=['castle-navigation.js','castle-architect.js','castle-anchor-plan.js','castle-construction.js','flight.js'],hashes=()=>Object.fromEntries(names.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+n,import.meta.url))).digest('hex')]));
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{radius:8.4,crown:true});}),solids=[],build=createConstruction({mats,castles,castleHearts,solids,occluders:[]}),report={scope:'Twenty deterministic match-planner searches across levels10–100 and both teams. Each accepted candidate uses real isolated preview geometry and the current outward/return walking inspector, including defense access. No native multiplayer/bot combat or exhaustive seeds claim.',startedAt:new Date().toISOString(),sourceHashes:hashes(),checks:[],failures:[]};
function save(){fs.writeFileSync(new URL('../review/defense-access-levels.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
for(let level=10;level<=100;level+=10)for(let home=0;home<2;home++){
 const seed=(685637696+Math.imul(level,104729)+home)>>>0,started=performance.now();
 try{
  const plan=await verifiedBattleCastlePlan({construction:build,home,level,seed}),defenses=plan.layout.filter(p=>['cannon','heavyCannon','beacon'].includes(p.type)).length,accepted=plan.attempts.findLast(a=>a.ok);
  assert(defenses>=1,'AI fortress needs a starter battery');assert(plan.navigation.ok);assert.equal(plan.navigation.routes,plan.navigation.total);assert(plan.navigation.total>=defenses+1);assert(accepted?.ok);assert.equal(solids.length,0);assert(build.counts.every(c=>!c.custom));
  const record={level,home,requestedSeed:seed,acceptedSeed:plan.seed,family:plan.family,parts:plan.layout.length,defenses,routes:plan.navigation.total,attempts:plan.attempts.length,rejections:plan.attempts.filter(a=>!a.ok).map(a=>({seed:a.seed,reason:a.reason||a.summary,issues:a.issues?.map(i=>({code:i.code,message:i.message,cell:i.cell}))})),seconds:(performance.now()-started)/1000};report.checks.push(record);console.log(JSON.stringify({...record,rejections:record.rejections.length}));
 }catch(error){report.failures.push({level,home,seed,error:error.stack,seconds:(performance.now()-started)/1000});console.error('FAIL level'+level+' team'+home+': '+error.message);process.exitCode=1;}
 save();
}
report.finishedAt=new Date().toISOString();report.finalSourceHashes=hashes();report.sourceStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.finalSourceHashes);report.passed=report.failures.length===0&&report.checks.length===20&&report.sourceStable;if(!report.passed)process.exitCode=1;save();console.log('FINAL '+JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.failures.length,sourceStable:report.sourceStable}));
