import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {buildAnchoredCastle} from '../floating-castle/castle-anchor-plan.js';
import {verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';
import {scanCastle} from '../floating-castle/castle-affordances.js';
let oldSource=fs.readFileSync(new URL('../history/before-minimum-battery-20261011/castle-anchor-plan.js',import.meta.url),'utf8');
for(const n of ['castle-rules.js','castle-protectors.js'])oldSource=oldSource.replace('./'+n,new URL('../floating-castle/'+n,import.meta.url).href);
const {buildAnchoredCastle:before}=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
const prior=JSON.parse(fs.readFileSync(new URL('../history/before-minimum-battery-20261011/defense-access-levels-before.json',import.meta.url),'utf8')).checks.filter(c=>c.defenses===0);assert.equal(prior.length,3);
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{radius:8.4,crown:true});}),solids=[],construction=createConstruction({mats,castles,castleHearts,solids,occluders:[]}),checks=[];
for(const c of prior){
 const settings={level:c.level,family:c.family,seed:(c.acceptedSeed+c.home*977)>>>0},old=before(settings),next=buildAnchoredCastle(settings),changed=next.layout.filter((p,i)=>JSON.stringify(p)!==JSON.stringify(old.layout[i]));
 assert.equal(old.layout.filter(p=>['cannon','heavyCannon','beacon'].includes(p.type)).length,0);assert.equal(changed.length,1);assert.equal(changed[0].type,'cannon');const original=old.layout.find(p=>p.x===changed[0].x&&p.z===changed[0].z);assert.equal(original.type,'wall');assert.deepEqual(next.anchors,old.anchors);assert.deepEqual(next.routes,old.routes);assert.deepEqual(next.ports,old.ports);assert.deepEqual(next.spawns,old.spawns);assert.equal(next.layout.length,old.layout.length);
 const plan=await verifiedBattleCastlePlan({construction,home:c.home,level:c.level,seed:c.requestedSeed}),view=construction.preview(c.home,plan.layout,plan.options);
 try{const scan=scanCastle(plan.layout,plan.options,{preview:view});assert(plan.navigation.ok);assert(scan.defenses.pieces>=1);assert(scan.defenses.coverage>0);assert(scan.placement.ok);assert.equal(scan.protectors.blocked,0);assert.equal(solids.length,0);checks.push({level:c.level,home:c.home,oldSeed:c.acceptedSeed,acceptedSeed:plan.seed,family:plan.family,changedCell:changed[0],routes:plan.navigation.total,defenses:scan.defenses});console.log(JSON.stringify(checks.at(-1)));}finally{view.dispose();}
}
fs.writeFileSync(new URL('../review/starter-battery.json',import.meta.url),JSON.stringify({passed:true,scope:'Three previously gunless low-level designs: exactly one free curtain slot changed; anchors/routes/ports/spawns/decor preserved; actual final planner walking and sampled real-mesh coverage, not combat balance',checks},null,2));
