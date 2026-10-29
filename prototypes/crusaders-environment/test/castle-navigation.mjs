import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {buildTemplate} from '../floating-castle/castle-templates.js';
import {inspectCastle} from '../floating-castle/castle-navigation.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
const report={scope:'Actual construction preview collider geometry; independent interior/centre-line navigation sampling with maximum2m gap, followed by unchanged flightWorld at120Hz out and back. Synthetic original castle siblings; initial actor on pod apron. No authored route waypoints, browser/native-input, rendered screenshot or arbitrary-layout guarantee. Route.steps/stat.steps are totals; reverse.steps is a cumulative counter.',startedAt:new Date().toISOString(),sourceHashes:{},templates:[],fixtures:[],failures:[]};
const sourceNames=['castle-navigation.js','castle-construction.js','castle-curves.js','castle-templates.js','flight.js'],hash=name=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
for(const name of sourceNames)report.sourceHashes[name]=hash(name);
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=[],solids=[],occluders=[];
for(const castle of castles){castle.add(new T.Group(),new T.Group());castleHearts.push(chargeOrb(castle,mats,{x:-17,y:68,z:-55,radius:8.4,crown:true}));castle.updateMatrixWorld(true);}
const construction=createConstruction({mats,castles,castleHearts,solids,occluders});
const focused=process.argv.includes('--focus'),derivedOnly=process.argv.includes('--derived'),requested=process.argv[2]?.startsWith('--')?null:process.argv[2],levelArg=Number(process.argv[3]),reportName=focused?'castle-navigation-focused.json':derivedOnly?'castle-navigation-derived.json':requested?'castle-navigation-case.json':'castle-navigation.json';
function save(){fs.writeFileSync(new URL('../review/'+reportName,import.meta.url),JSON.stringify(report,null,2)+'\n');}
try{
 if(!derivedOnly)for(const id of requested?[requested]:['rampart','sanctuary','skyharbor'])for(const level of levelArg?[levelArg]:focused?[10,50,100]:[10,20,30,40,50,60,70,80,90,100]){
  const options={level,material:'auto'},template=buildTemplate(id,options),preview=construction.preview(0,template.layout,options);
  try{const result=await inspectCastle(preview,template.layout,options,{objectives:template.objectives});report.templates.push({id,level,parts:template.layout.length,...result});console.log(id+' '+level+': '+result.summary+' '+result.stats.seconds.toFixed(2)+'s; '+result.stats.nodes+' nodes');if(!result.ok){console.log(JSON.stringify(result.issues));report.failures.push({id,level,issues:result.issues});}save();}finally{preview.dispose();}
 }
 if((!requested||derivedOnly)&&!focused)for(const id of requested?[requested]:['rampart','sanctuary','skyharbor']){
  const level=derivedOnly&&levelArg?levelArg:100,options={level,material:'auto'},template=buildTemplate(id,options),preview=construction.preview(0,template.layout,options);
  try{const result=await inspectCastle(preview,template.layout,options);report.templates.push({id,level,derived:true,parts:template.layout.length,...result});console.log(id+' '+level+' DERIVED: '+result.summary+' '+result.stats.seconds.toFixed(2)+'s');if(!result.ok){console.log(JSON.stringify(result.issues));report.failures.push({id,level,derived:true,issues:result.issues});}save();}finally{preview.dispose();}
 }
 report.passed=report.failures.length===0;if(!report.passed)process.exitCode=1;
}catch(e){report.passed=false;report.failures.push({message:e.message,stack:e.stack});console.error(e);process.exitCode=1;}finally{
 report.finishedAt=new Date().toISOString();report.finalSourceHashes=Object.fromEntries(sourceNames.map(name=>[name,hash(name)]));report.sourceStable=sourceNames.every(name=>report.sourceHashes[name]===report.finalSourceHashes[name]);
 if(!report.sourceStable){report.passed=false;report.failures.push({message:'Source changed while this fixture process ran. Results describe the initial hashes; repeat after source freeze.'});process.exitCode=1;}
 const count=rows=>({cases:rows.length,passedCases:rows.filter(r=>r.ok).length,roundTrips:rows.reduce((n,r)=>n+r.reachable,0),objectives:rows.reduce((n,r)=>n+r.total,0),physicalSteps:rows.reduce((n,r)=>n+r.stats.steps,0),maxSeconds:Math.max(0,...rows.map(r=>r.stats.seconds)),maxNodes:Math.max(0,...rows.map(r=>r.stats.nodes))});
 report.totals={templates:count(report.templates.filter(r=>!r.derived)),derivedReloads:count(report.templates.filter(r=>r.derived))};save();
 if(!requested&&!focused&&!derivedOnly)fs.writeFileSync(new URL('../review/castle-navigation-summary.json',import.meta.url),JSON.stringify({passed:report.passed,sourceStable:report.sourceStable,scope:report.scope,sourceHashes:report.sourceHashes,totals:report.totals,failures:report.failures,report:reportName},null,2)+'\n');
}
