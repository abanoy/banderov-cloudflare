import {captureDesignSeed,chooseCastleAnchors,buildAnchoredCastle} from '../floating-castle/castle-anchor-plan.js';
import {curvedWallGeometry} from '../floating-castle/castle-curves.js';
import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../vendor/three.module.js';
import {createConstruction} from '../floating-castle/castle-construction.js';import {chargeOrb} from '../floating-castle/charge-orb.js';import {battleCastlePlan,verifiedBattleCastlePlan} from '../floating-castle/castle-architect.js';import {protectorLimit,protectorReport,createBattleProtectors,inspectProtectorLinks,addProtectorBeams} from '../floating-castle/castle-protectors.js';import {createBattleCombat} from '../floating-castle/battle-combat.js';import {inspectCastle} from '../floating-castle/castle-navigation.js';
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{x:-24,y:12,z:-24,radius:8.4,crown:true});}),solids=[],occluders=[],world={mats,castles,castleHearts,solids,occluders},construction=createConstruction(world),report={checks:[],routes:[],failures:[]},check=(name,data={})=>report.checks.push({name,...data});
try{
const seed=captureDesignSeed(1791687000000);assert.deepEqual(seed,captureDesignSeed(1791687000000));const unique=new Set();let composed=0,clear=0;for(let i=0;i<20;i++){try{const a=chooseCastleAnchors({level:100,seed:seed.seed+i}),p=buildAnchoredCastle({level:100,seed:seed.seed+i,anchors:a});assert.deepEqual(p.layout.find(p=>p.type==='core'),{...a.main,solid:true});assert.deepEqual(p.layout.filter(p=>p.type==='protector').map(p=>[p.x,p.z,p.layer]).sort(),a.protectors.map(p=>[p.x,p.z,p.layer]).sort());const v=construction.preview(0,p.layout,{level:100}),n=protectorReport(v.links);composed++;if(!n.blocked)clear++;unique.add(JSON.stringify(a));v.dispose();console.log('Seed',i,'pieces',p.layout.length,'clear',n.linked);}catch(e){console.log('Rejected seed',i,e.message);}}
assert(composed>0);assert(clear>0);assert(unique.size>1);check('Twenty fixed-anchor seed samples',{composed,clear,unique:unique.size});console.log({composed,clear,unique:unique.size});
for(const level of [20,60,100]){const p=await verifiedBattleCastlePlan({construction,level,seed:seed.seed});assert(p.navigation.ok);check('Physical out/back routes and clear beam network',{level,seed:p.seed,anchors:p.anchors,navigation:p.navigation});console.log('WALKED',level,p.navigation,p.anchors);}

const scene=new T.Scene();scene.add(...castles);const network=createBattleProtectors(world,scene);
for(const [x,z] of [[1,3],[2,5],[3,7]]){
 const layout=[{type:'core',x:9,z:3,layer:0,rotation:0},{type:'protector',x,z,layer:0,rotation:0}];
 network.clear();assert.equal(scene.children.filter(o=>o.userData.battleProtectorBeam).length,0);construction.apply(0,layout,{level:20});network.reset();assert.equal(network.items.length,1);assert.equal(scene.children.filter(o=>o.userData.battleProtectorBeam).length,1);
}
const orphan=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial());orphan.userData.battleProtectorBeam=true;scene.add(orphan);network.clear();assert.equal(scene.children.filter(o=>o.userData.battleProtectorBeam).length,0);
const root=new T.Group(),links=[{linked:true,from:new T.Vector3(0,0,0),point:new T.Vector3(2,3,4)}],old=addProtectorBeams(root,links),fresh=addProtectorBeams(root,links);assert.equal(root.children.length,1);old.dispose();assert.equal(root.children.length,1);fresh.dispose();assert.equal(root.children.length,0);
check('Repeated castle replacement and orphan cleanup leave exactly current beams; static beam refresh is idempotent');report.passed=true;
}catch(e){report.passed=false;report.failures.push({message:e.message,stack:e.stack});console.error(e);process.exitCode=1;}
fs.writeFileSync(new URL('../review/anchor-first-test.json',import.meta.url),JSON.stringify(report,null,2));

