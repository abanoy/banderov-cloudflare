import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {scanCastle,deriveTileFits,partAffordance} from '../floating-castle/castle-affordances.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {flightWorld} from '../floating-castle/flight.js';
import {buildTemplate} from '../floating-castle/castle-templates.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const report={scope:'Actual Three.js conditional geometry and collision fixtures; isolated previews, finite spatial coverage scan, fixed120Hz actor starts explicitly placed at each stair. No native browser/online-balance claim.',checks:[],failures:[],hashes:{}};
for(const name of ['castle-construction.js','castle-affordances.js'])report.hashes[name]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
const check=(name,details={})=>report.checks.push({name,...details});
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{x:-24,y:12,z:-24,radius:8.4,crown:true});}),solids=[],occluders=[],construction=createConstruction({mats,castles,castleHearts,solids,occluders});
const core={x:1,z:1,layer:0,type:'core',rotation:0},k=p=>p.x+':'+p.z+':'+p.layer;
try{
 for(const material of ['wood','fortress'])for(let r=0;r<4;r++){
  const a=r*Math.PI/2,wall={x:6,z:7,layer:0,type:'wall',rotation:r},neighbor={...wall,x:6+Math.round(Math.cos(a)),z:7-Math.round(Math.sin(a)),rotation:(r+1)%4},layout=[wall,neighbor,core],options={material},before=JSON.stringify(layout),preview=construction.preview(0,layout,options),reverse=construction.preview(0,layout.slice().reverse(),options);
  assert.equal(JSON.stringify(layout),before);assert.deepEqual(preview.adjustments,reverse.adjustments);const fitted=preview.colliders.find(o=>o.userData.wallRole==='curtain wall'&&o.parent.userData.cell.rotation===r),extension=material==='wood'?3.2:2.4;assert(Math.abs(fitted.scale.x-8-extension)<1e-8);assert.equal(fitted.parent.userData.fitting.wallExtensions[1],extension);
  const ray=new T.Raycaster(),point=new T.Vector3(4+extension/2,3,0).applyMatrix4(fitted.parent.matrixWorld),direction=new T.Vector3(0,0,-1).transformDirection(fitted.parent.matrixWorld);ray.set(point.clone().addScaledVector(direction,-6),direction);ray.far=12;assert(ray.intersectObject(fitted).length,'Visible extended wall has an actual triangle collider');preview.dispose();reverse.dispose();
 }
 check('Eight wood/stone rotated corners join physically and ignore draft insertion order');
 for(let r=0;r<4;r++){
  const [dx,dz]=[[0,-1],[-1,0],[0,1],[1,0]][r],stairs={x:8,z:8,layer:0,type:'stairs',rotation:r},landing={x:8+dx,z:8+dz,layer:1,type:'battlement',rotation:(r+2)%4},layout=[stairs,landing,core];construction.apply(0,layout);const fit=deriveTileFits(layout).fits.get(k(landing));assert.equal(fit.parapetGap,7.6);
  const sim=flightWorld(solids,[{x:20-dx*4.8,y:.77,z:16-dz*4.8,r:6}]),s=sim.state;Object.assign(s,{x:20-dx*4.8,y:.77,z:16-dz*4.8,grounded:true,home:0});let steps=0;
  while((s.x-20)*dx+(s.z-16)*dz<6.9&&steps++<200){sim.step(1/120,{x:dx,z:dz});assert(s.grounded);assert.equal(s.falls,0);}assert(steps<200);assert(Math.abs(s.y-8.77)<.02);
  for(let i=0;i<steps;i++){sim.step(1/120,{x:-dx,z:-dz});assert(s.grounded);}assert(Math.abs(s.y-.77)<.02);
  const closed=construction.preview(0,[landing,core]);assert.equal(closed.adjustments.filter(a=>a.code==='parapet-opening').length,0);const group=closed.root.children.find(g=>g.userData.cell?.type==='battlement'&&!g.userData.solidTerrace);assert(closed.colliders.some(o=>o.parent===group&&o.scale.x===8&&o.scale.y===2.3));closed.dispose();
 }
 check('Four stair-facing parapets open, permit actual up/down walks, and close again when stairs are removed');
 const gate={x:6,z:6,layer:0,type:'gate',rotation:0},walk={x:6,z:7,layer:0,type:'battlement',rotation:0};assert.equal(deriveTileFits([gate,walk]).fits.get(k(walk)).parapetGap,6);
 const bank={x:6,z:7,layer:0,type:'embankment',rotation:0},masonry={x:7,z:7,layer:0,type:'wall',rotation:1};const bankDraft=[bank,masonry,core],bankBefore=JSON.stringify(bankDraft),b=construction.preview(0,bankDraft);const bg=b.root.children.find(g=>g.userData.cell?.type==='embankment'&&!g.userData.solidTerrace);assert.equal(bg.userData.effectiveRotation,3);assert.equal(bg.userData.cell.rotation,0);assert.equal(JSON.stringify(bankDraft),bankBefore);assert.equal(b.adjustments[0].code,'bank-facing');assert.equal(deriveTileFits([bank,core]).fits.get(k(bank)).rotation,0);b.dispose();construction.restore(0);
 check('Gate gap uses its six-metre opening and banks face real adjacent masonry without altering saved rotation');
 assert.equal(partAffordance('cannon').defense.status,'prototype');assert.equal(partAffordance('cannon').defense.matchCombat,'active');assert.equal(partAffordance('gate').gate,true);assert.equal(partAffordance({type:'garden',footprint:'round',solid:true}).round,true);
 const options={level:100,material:'fortress'},template=buildTemplate('skyharbor',options),before=JSON.stringify(template),preview=construction.preview(0,template.layout,options),scan=scanCastle(template.layout,options,{preview});assert(scan.defenses.verified);assert.equal(scan.defenses.pieces,template.layout.filter(p=>['cannon','heavyCannon','beacon'].includes(p.type)).length);assert(scan.defenses.rayTests<=64*24);assert(scan.perimeter.sampled<=64);assert(scan.defenses.sampledEmitters<=24);assert.equal(JSON.stringify(template),before);assert.equal(solids.length,0);assert.equal(occluders.length,0);assert(construction.counts.every(c=>!c.custom));preview.dispose();preview.dispose();
 assert.throws(()=>scanCastle(Array(721).fill(core)));assert.throws(()=>scanCastle([{...core,x:100}]));assert.throws(()=>scanCastle([core,core]));
 check('A720-part plan uses bounded actual-mesh coverage, explicit capability stages and unchanged live state',{parts:template.layout.length,coverage:scan.defenses.coverage,samples:scan.perimeter.sampled,rayTests:scan.defenses.rayTests,adjustments:scan.fitting.length});
 const targetLayout=[core,{x:8,z:9,layer:0,type:'cannon',rotation:0},{x:8,z:10,layer:0,type:'wall',rotation:0}],targetView=construction.preview(0,targetLayout),blocked=scanCastle(targetLayout,{}, {preview:targetView}),unblocked=scanCastle(targetLayout,{}, {preview:{root:targetView.root,colliders:targetView.colliders.filter(o=>o.userData.wallRole!=='curtain wall')}});assert(blocked.defenses.coverage<unblocked.defenses.coverage,'The real curtain wall must reduce coverage for identical sample targets');targetView.dispose();
 check('Actual wall triangles reduce the identical perimeter samples’ sight-line coverage',{withWall:blocked.defenses.coverage,wallExcludedFixture:unblocked.defenses.coverage});report.passed=true;
}catch(e){report.passed=false;report.failures.push({message:e.message,stack:e.stack});process.exitCode=1;console.error(e);}
fs.writeFileSync(new URL('../review/castle-affordances.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log((report.passed?'PASS':'FAIL')+': '+report.checks.length+' fitting/capability groups');
