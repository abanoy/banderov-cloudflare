// Run from any directory: node /absolute/path/to/test/castle-construction.mjs
// Explicit Node geometry/state fixtures, not browser or native-input evidence.
import * as T from '../vendor/three.module.js';
import {createConstruction,presets,GRID,CELL,LAYERS,MAX_PARTS} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {flightWorld} from '../floating-castle/flight.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const report={
 scope:'Standalone Node construction/physics fixtures using bundled Three.js. Synthetic preserved architecture and harbor siblings, actual castle transforms, crown module and flightWorld. Positions and movement inputs are explicitly assigned. No browser rendering, native input, online rules, complete original-world integration or physical-device claim.',
 generatedAt:new Date().toISOString(),
 sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/castle-construction.js',import.meta.url))).digest('hex'),
 checks:[],failures:[]
};
const output=new URL('../review/castle-construction.json',import.meta.url);
function check(name,details={}){report.checks.push({name,...details});}

try{
 const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()]));
 let sharedMaterialDisposals=0;for(const material of Object.values(mats))material.addEventListener('dispose',()=>sharedMaterialDisposals++);
 const solids=[],occluders=[],castles=[],castleHearts=[],architecture=[],harbors=[],sails=[];
 for(let home=0;home<2;home++){
  const castle=new T.Group();castle.position.set(home?205:-205,55,home?-22:22);castle.rotation.y=home?-Math.PI/2:Math.PI/2;castles.push(castle);
  for(let i=0;i<2;i++){
   const group=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(1,1,1),mats.stone);mesh.position.set(i*6,-2,-6);mesh.userData.castleIndex=home;group.add(mesh);castle.add(group);architecture.push(mesh);solids.push(mesh);occluders.push(mesh);
  }
  // A third child represents a preserved port and its separate decorative sail.
  const harbor=new T.Group(),port=new T.Mesh(new T.BoxGeometry(18,1.45,11),mats.bark),sail=new T.Mesh(new T.PlaneGeometry(4,8),mats.sail);
  port.position.set(67,.1,35);port.userData.castleIndex=home;sail.position.set(67,12,35);harbor.add(port,sail);castle.add(harbor);harbors.push(port);sails.push(sail);solids.push(port);occluders.push(port,sail);
  const heart=chargeOrb(castle,mats,{x:-17,y:68,z:-55,radius:8.4,crown:true});castleHearts.push(heart);for(const part of [heart.core,heart.foot]){part.userData.castleIndex=home;solids.push(part);occluders.push(part);}castle.updateMatrixWorld(true);
 }
 const world={mats,castles,solids,occluders,castleHearts},originalSolids=solids.slice(),originalOccluders=occluders.slice(),arrays=[solids,occluders],construction=createConstruction(world);
 const point=(home,x,y,z)=>castles[home].localToWorld(new T.Vector3(x,y,z));
 const pads=castles.map((_,home)=>{const p=point(home,22,.77,74);return {x:p.x,y:p.y,z:p.z,r:6};});
 const physics=flightWorld(solids,pads);

 assert.deepEqual([GRID,CELL,LAYERS,MAX_PARTS],[12,8,10,720]);
 assert.notEqual(construction.presets('courtyard'),construction.presets('courtyard'));
 const fresh=construction.presets('courtyard');fresh[0].x=999;assert.notEqual(construction.presets('courtyard')[0].x,999);
 assert.throws(()=>presets('unknown'));
 check('Bounded API and fresh preset data',{grid:GRID,cell:CELL,layers:LAYERS,maxParts:MAX_PARTS,presetParts:{courtyard:presets('courtyard').length,citadel:presets('citadel').length}});

 const firstStats=construction.apply(0,construction.presets('courtyard'));
 assert.equal(firstStats.custom,true);assert.equal(firstStats.core,true);assert.equal(firstStats.layers,4);
 assert.equal(world.solids,arrays[0]);assert.equal(world.occluders,arrays[1]);assert(!solids.includes(architecture[0]));assert(!occluders.includes(architecture[1]));
 assert(solids.includes(architecture[2]));assert(solids.includes(architecture[3]));
 assert(harbors.every(o=>solids.includes(o)));assert(sails.every(o=>occluders.includes(o)&&!solids.includes(o)));assert(castleHearts.every(h=>solids.includes(h.core)&&solids.includes(h.foot)));
 check('Applying one castle preserves other castle, port, decorative sails and original hearts; captured array identities remain stable',{stats:firstStats,solidCount:solids.length,occluderCount:occluders.length});

 const baseProbes=[];
 for(const [x,z] of [[22,74],[22,60],[22,40],[40,35],[-12,53],[41,50]]){
  const p=point(0,x,4,z),f=physics.floor(p.x,p.y,p.z,5);assert(f&&Math.abs(f.y-55.77)<.02,'base continuity '+x+','+z);assert.equal(f.home,0);baseProbes.push({local:[x,z],height:f.y,home:f.home});
 }
 const portPoint=point(0,67,3,35),portFloor=physics.floor(portPoint.x,portPoint.y,portPoint.z,4);assert(portFloor&&Math.abs(portFloor.y-55.825)<.001);assert.equal(portFloor.home,0);
 check('Foundation, gate aisle, pad approach, port join and fixed turret bastion floor rays',{baseProbes,preservedPortFloor:portFloor.y});

 const part={x:0,z:0,layer:0,type:'floor',rotation:0},badCases=[
  ['non-array',{}],['NaN rotation',[{...part,rotation:NaN}]],['infinite coordinate',[{...part,x:Infinity}]],['fractional layer',[{...part,layer:.5}]],
  ['outside X',[{...part,x:GRID}]],['outside Z',[{...part,z:-1}]],['layer 11',[{...part,layer:LAYERS}]],['invalid rotation',[{...part,rotation:4}]],
  ['unknown type',[{...part,type:'unknown'}]],['duplicate cell',[part,{...part,type:'wall'}]],['multiple hearts',[{...part,type:'core'},{...part,x:1,type:'core'}]],
  ['over 720 parts',Array.from({length:MAX_PARTS+1},()=>({...part}))]
 ];
 for(const [label,layout] of badCases){const before=solids.slice(),visible=castles[0].children.map(o=>o.visible),heart=castleHearts[0].root.position.clone();assert.throws(()=>construction.apply(0,layout),label);assert.deepEqual(solids,before,label+' must be atomic');assert.deepEqual(castles[0].children.map(o=>o.visible),visible);assert(castleHearts[0].root.position.equals(heart));}
 assert.throws(()=>construction.apply(2,[]));assert.throws(()=>construction.restore(-1));
 check('Invalid layouts reject before scene mutation',{cases:badCases.map(([label])=>label),invalidHome:true});

 const walks=[];
 for(let home=0;home<2;home++){
  if(home)construction.apply(home,presets('courtyard'));
  const s=physics.state,start=point(home,20,.77,22);Object.assign(s,{x:start.x,y:start.y,z:start.z,vx:0,vy:0,vz:0,home,grounded:true,flight:false,falls:0});
  for(const [x,y,z] of [[20,16.77,3.6],[20,16.77,0],[14,16.77,0]]){
   const target=point(home,x,y,z);let steps=0;
   while(Math.hypot(s.x-target.x,s.z-target.z)>.09&&steps++<1000){const dx=target.x-s.x,dz=target.z-s.z,n=Math.hypot(dx,dz);physics.step(1/120,{x:dx/n,z:dz/n});}
   assert(steps<1000,'stairs stalled at '+[home,x,y,z]);assert(s.grounded);assert(Math.abs(s.y-target.y)<.2);assert.equal(s.home,home);assert.equal(s.falls,0);
   walks.push({home,localTarget:[x,y,z],position:[s.x,s.y,s.z],steps,grounded:s.grounded});
  }
 }
 check('Explicit fixed-step ascent of both rotated castle stair flights and turn onto keep terrace',{walks});

 let disposed=0;const custom=castles[0].children.find(o=>o.name.startsWith('Player-built')),geometries=new Set();custom.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const g of geometries)g.addEventListener('dispose',()=>disposed++);
 construction.apply(0,presets('citadel'));assert.equal(disposed,geometries.size);assert.equal(construction.counts[0].layers,6);assert.equal(sharedMaterialDisposals,0);
 check('Replacing a castle disposes every old custom geometry once and retains shared materials',{disposedGeometryCount:disposed,expectedGeometryCount:geometries.size,sharedMaterialDisposals});

 const maxLayout=Array.from({length:MAX_PARTS},(_,i)=>({x:i%GRID,z:Math.floor(i/GRID)%GRID,layer:Math.floor(i/(GRID*GRID)),type:'floor',rotation:0}));
 assert.equal(construction.apply(1,maxLayout).parts,MAX_PARTS);
 assert.equal(construction.apply(1,[{x:4,z:4,layer:9,type:'floor',rotation:3}]).layers,10);
 const empty=construction.apply(1,[]);assert.equal(empty.parts,0);assert.equal(empty.custom,true);assert(Number.isFinite(castleHearts[1].root.position.y));
 check('Maximum part count, top build layer and empty foundation are accepted',{maxParts:MAX_PARTS,highestLayer:10,emptyFoundationHasPreservedHeart:true});

 construction.restore(0);construction.restore(1);construction.restore(0);
 assert.equal(solids.length,originalSolids.length);assert.equal(occluders.length,originalOccluders.length);assert(originalSolids.every(o=>solids.includes(o)));assert(originalOccluders.every(o=>occluders.includes(o)));
 assert(castleHearts.every(h=>h.root.position.equals(new T.Vector3(-17,68,-55))));assert(castles.every(c=>c.children.slice(0,2).every(o=>o.visible)));assert.equal(sharedMaterialDisposals,0);
 check('Restore is repeatable and returns original architecture, arrays and crown positions',{solids:solids.length,occluders:occluders.length,sharedMaterialDisposals});
 report.passed=true;
}catch(error){report.passed=false;report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log((report.passed?'PASS':'FAIL')+': '+report.checks.length+' construction fixture groups; '+output.pathname);
if(report.failures.length)console.error(report.failures[0].stack);
