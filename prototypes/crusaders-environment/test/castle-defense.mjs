import * as T from '../vendor/three.module.js';
import {createCastleDefense,DEFENSE_RULES} from '../floating-castle/castle-defense.js';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {buildTemplate} from '../floating-castle/castle-templates.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const report={scope:'Synthetic Three.js scene and explicit simulation-time fixtures for local defense practice. Real mesh ray intersections, transforms and pooled resource ownership; not native-input or visual/performance acceptance.',checks:[],failures:[],sourceHash:crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/castle-defense.js',import.meta.url))).digest('hex')};
report.geometryHashes=Object.fromEntries(['castle-construction.js','castle-curves.js','castle-templates.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+file,import.meta.url))).digest('hex')]));
const check=(name,details={})=>report.checks.push({name,...details});
function fixture(){
 const scene=new T.Scene(),solids=[],castles=[],customs=[],originals=[],material=new T.MeshBasicMaterial(),geometry=new T.BoxGeometry(2,1,2);
 for(let home=0;home<2;home++){
  const castle=new T.Group();castle.position.set(home*500,home*40,home*-50);castle.rotation.y=home*Math.PI/2;scene.add(castle);castles.push(castle);
  const original=new T.Mesh(geometry,material);original.position.set(0,-10,0);castle.add(original);solids.push(original);originals.push(original);
  const custom=new T.Group();custom.userData.profile={level:20,size:12};castle.add(custom);customs.push(custom);
  for(const [i,type] of ['cannon','heavyCannon','beacon'].entries()){
   const group=new T.Group();group.position.set((i-1)*28,0,0);group.userData.cell={type,x:i*3,z:0,layer:0,rotation:0};group.userData.defense={muzzle:type==='beacon'?[0,5.6,0]:[0,2.5,4],direction:[0,0,1]};custom.add(group);
   const body=new T.Mesh(geometry,material);group.add(body);solids.push(body);
   // The solid terrace carrying a cannon tile retains that tile's cell metadata
   // for picking, but is masonry, not another emitter or self-ignored hardware.
   const mass=new T.Mesh(geometry,material);mass.position.set((i-1)*28,-4,0);mass.scale.set(4,8,4);mass.userData.cell={...group.userData.cell};mass.userData.solidTerrace=true;custom.add(mass);solids.push(mass);
  }
 }
 scene.updateMatrixWorld(true);return {scene,world:{castles,solids},customs,originals,material,geometry};
}
let defense;
try{
 const f=fixture(),before={solids:[...f.world.solids],children:f.world.castles.map(c=>c.children.slice()),geometry:f.geometry,material:f.material};defense=createCastleDefense(f.world,f.scene);
 const idle=defense.snapshot();assert.equal(idle.enabled,false);assert.equal(idle.shots,0);assert.equal(idle.weapons.length,6);assert(idle.homes.every(h=>h.custom&&h.weapons===3&&h.beacons===1));defense.update(0);defense.update(8);assert.equal(defense.snapshot().shots,0);assert(defense.snapshot().homes.every(h=>h.targets.every(t=>!t.visible)));
 assert.deepEqual(f.world.solids,before.solids);assert.deepEqual(f.world.castles.map(c=>c.children.slice()),before.children);
 check('Opt-in defaults off, copied solid-terrace metadata never duplicates weapons, world solids/original geometry unchanged',{weapons:idle.weapons.length,homes:idle.homes.length});

 defense.setEnabled(true);const histories=new Map(idle.weapons.map(w=>[w.id,[]]));let previous=new Map();
 for(let i=1;i<=1200;i++){defense.update(8+i/60);const s=defense.snapshot();for(const w of s.weapons){if(w.lastShot!==null&&w.lastShot!==previous.get(w.id)){histories.get(w.id).push(w.lastShot);previous.set(w.id,w.lastShot);}}assert(s.activeBolts<=48&&s.activeParticles<=192);}
 const active=defense.snapshot();assert(active.shots>15&&active.hits>5);assert(active.homes.every(h=>h.shots>0&&h.hits>0));
 for(const w of active.weapons){const times=histories.get(w.id);assert(times.length>=2,w.id+' must acquire again');for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=DEFENSE_RULES[w.type].cooldown-1e-8,'weapon cooldown cannot be bypassed');}
 assert(DEFENSE_RULES.cannon.cooldown<DEFENSE_RULES.heavyCannon.cooldown&&DEFENSE_RULES.heavyCannon.cooldown<DEFENSE_RULES.beacon.cooldown);assert(active.homes.some(h=>h.targets.some(t=>t.hits>=2)));
 check('Transformed homes acquire real targets, distinct cooldowns hold and hit targets respawn repeatedly',{shots:active.shots,hits:active.hits,byWeapon:active.weapons.map(w=>({type:w.type,shots:w.shots,hits:w.hits,cooldown:w.cooldown}))});

 const frozen=defense.snapshot(),matrices=defense.root.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array));for(let i=0;i<90;i++)defense.update(28);assert.deepEqual(defense.snapshot(),frozen);assert.deepEqual(defense.root.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array)),matrices);
 defense.setEnabled(false);assert.equal(defense.snapshot().activeBolts,0);assert.equal(defense.snapshot().activeParticles,0);assert(defense.snapshot().homes.every(h=>h.targets.every(t=>!t.visible)));defense.update(30);assert.equal(defense.snapshot().shots,frozen.shots);
 defense.setEnabled(true);assert.equal(defense.snapshot().shots,0);assert.equal(defense.snapshot().hits,0);check('Identical simulation time freezes effects/cooldowns; disabling clears effects and a new drill resets counters');

 const roofs=[];for(const castle of f.world.castles){const roof=new T.Mesh(new T.BoxGeometry(500,2,500),f.material);roof.position.set(0,8,0);castle.add(roof);f.world.solids.push(roof);roofs.push(roof);}f.scene.updateMatrixWorld(true);defense.sync();
 for(let i=1;i<=180;i++)defense.update(30+i/60);const blocked=defense.snapshot();assert.equal(blocked.shots,0);assert.equal(blocked.hits,0);assert(blocked.homes.every(h=>h.blocked===3));check('Actual overhead roof meshes prevent acquisition for cannons, heavy batteries and beacons',{blocked:blocked.homes.map(h=>h.blocked),losChecks:blocked.losChecks});

 for(const roof of roofs){f.world.solids.splice(f.world.solids.indexOf(roof),1);roof.parent.remove(roof);}defense.sync();defense.update(33.01);assert(defense.snapshot().activeBolts>0);
 for(const castle of f.world.castles){const wall=new T.Mesh(new T.BoxGeometry(500,100,2),f.material);wall.position.set(0,10,20);castle.add(wall);f.world.solids.push(wall);}f.scene.updateMatrixWorld(true);
 for(let i=1;i<=90;i++)defense.update(33.01+i/60);const stopped=defense.snapshot();assert(stopped.blockedBolts>0);assert.equal(stopped.hits,0);check('A real obstruction introduced after launch stops in-flight practice bolts',{blockedBolts:stopped.blockedBolts,hits:stopped.hits});

 const resourceCount=()=>{let nodes=0;const g=new Set(),m=new Set();defense.root.traverse(o=>{nodes++;if(o.geometry)g.add(o.geometry);if(o.material)m.add(o.material);});return {nodes,geometries:g.size,materials:m.size,pools:defense.root.children.filter(o=>o.isInstancedMesh).map(o=>o.count)};};const resourceStart=resourceCount();
 for(let iteration=0;iteration<20;iteration++){defense.sync();defense.setEnabled(iteration%2===0);defense.update(35+iteration*.05);assert.deepEqual(resourceCount(),resourceStart);}
 for(const custom of f.customs)custom.clear();defense.sync();defense.setEnabled(true);defense.update(36.1);const unarmed=defense.snapshot();assert.equal(unarmed.weapons.length,0);assert(unarmed.homes.every(h=>h.custom&&h.targets.length===3&&h.targets.every(t=>t.visible)));assert.equal(unarmed.shots,0);
 const last=defense.snapshot();for(let home=0;home<2;home++)f.world.castles[home].remove(f.customs[home]);defense.sync();const restored=defense.snapshot();assert.equal(restored.generation,last.generation+1);assert.equal(restored.weapons.length,0);assert(restored.homes.every(h=>!h.custom&&h.targets.length===0));assert.equal(restored.activeBolts,0);assert.equal(restored.shots,0);assert.deepEqual(resourceCount(),resourceStart);
 check('Repeated sync/toggles and restoration keep fixed pools and drop old castle references',{resources:resourceStart});

 const ownedGeometry=new Set(),ownedMaterial=new Set(),instances=[];defense.root.traverse(o=>{if(o.geometry)ownedGeometry.add(o.geometry);if(o.material)ownedMaterial.add(o.material);if(o.isInstancedMesh)instances.push(o);});let gd=0,md=0,id=0,sharedDisposed=0;for(const g of ownedGeometry)g.addEventListener('dispose',()=>gd++);for(const m of ownedMaterial)m.addEventListener('dispose',()=>md++);for(const o of instances)o.addEventListener('dispose',()=>id++);f.geometry.addEventListener('dispose',()=>sharedDisposed++);f.material.addEventListener('dispose',()=>sharedDisposed++);defense.dispose();defense.dispose();defense.update(100);assert.equal(defense.root.parent,null);assert.equal(gd,ownedGeometry.size);assert.equal(md,ownedMaterial.size);assert.equal(id,instances.length);assert.equal(sharedDisposed,0);assert(defense.snapshot().disposed);
 check('Dispose releases each owned geometry/material/instance once and retains original/shared resources',{geometries:gd,materials:md,instances:id,sharedDisposed});

 report.catalog=[];
 for(const family of ['rampart','sanctuary','skyharbor'])for(let level=10;level<=100;level+=10){const template=buildTemplate(family,{level,material:'fortress'}),weapons=template.layout.filter(p=>DEFENSE_RULES[p.type]).length;report.catalog.push({family,level,weapons});}
 assert(report.catalog.every(t=>t.weapons>0),'Every family/band needs at least one practice emitter: '+JSON.stringify(report.catalog.filter(t=>t.weapons===0)));
 check('All thirty family/band templates retain at least one practice emitter',{templates:report.catalog.length});

 const realScene=new T.Scene(),mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[],castleHearts=[],solids=[],occluders=[];
 for(let home=0;home<2;home++){const castle=new T.Group();castle.position.set(home?250:-250,55,0);castle.rotation.y=home?-Math.PI/2:Math.PI/2;castle.add(new T.Group(),new T.Group());realScene.add(castle);castles.push(castle);const heart=chargeOrb(castle,mats,{x:-17,y:68,z:-55,radius:8.4,crown:true});castleHearts.push(heart);solids.push(heart.core,heart.foot);}
 const world={mats,castles,castleHearts,solids,occluders},construction=createConstruction(world),realDefense=createCastleDefense(world,realScene),families=[];
 report.families=families;
 try{
  for(const family of ['rampart','sanctuary','skyharbor'])for(const level of [10,50,100]){
   const options={level,material:'fortress'},template=buildTemplate(family,options);construction.apply(0,template.layout,options);realScene.updateMatrixWorld(true);realDefense.sync();realDefense.setEnabled(true);realDefense.update(0);
   for(let i=1;i<=720;i++)realDefense.update(i/60);const sample=realDefense.snapshot();families.push({family,level,parts:template.layout.length,weapons:sample.weapons.length,shots:sample.shots,hits:sample.hits,blocked:sample.homes[0].blocked});assert(sample.shots>0&&sample.hits>0,family+' level'+level+' must practice through its actual geometry');realDefense.setEnabled(false);construction.restore(0);
  }
 }finally{realDefense.dispose();}
 check('All three real template families acquire and hit at low, middle and maximum bands',{families});
}catch(error){report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}finally{defense?.dispose();}
fs.writeFileSync(new URL('../review/castle-defense.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,failures:report.failures},null,2));
