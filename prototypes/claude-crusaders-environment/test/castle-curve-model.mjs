import * as T from '../vendor/three.module.js';
import {createConstruction,PARTS} from '../floating-castle/castle-construction.js';
import {roundSlab,curvedWallGeometry,embankmentGeometry} from '../floating-castle/castle-curves.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const report={scope:'Explicit procedural geometry/model fixtures. Validation, retained circular base, single-material rendering and owned resource lifecycle; independent walking/triangle tests are castle-curves.mjs.',checks:[],failures:[]};
const check=(name,data={})=>report.checks.push({name,...data});
const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()]));
const castles=[new T.Group(),new T.Group()],castleHearts=[],solids=[],occluders=[];
for(const castle of castles){castle.add(new T.Group(),new T.Group());castleHearts.push(chargeOrb(castle,mats,{x:-17,y:68,z:-55,radius:8.4,crown:true}));}
const construction=createConstruction({mats,castles,castleHearts,solids,occluders}),options={level:100,material:'fortress'},piece=(type,extra={})=>({x:14,z:6,layer:3,rotation:0,type,...extra});
try{
 assert(['roundTerrace','curvedWall','embankment'].every(id=>PARTS.some(p=>p.id===id)));
 const original=Object.freeze([Object.freeze(piece('garden',{solid:true,footprint:'round'}))]),v=construction.preview(0,original,options),group=v.root.children.find(o=>o.userData.cell?.type==='garden'&&!o.userData.solidTerrace),columns=v.colliders.filter(o=>o.userData.solidTerrace);
 assert.deepEqual(group.userData.cell,original[0]);assert.equal(group.userData.footprint,'round');assert(columns.length);assert(columns.every(o=>o.userData.footprint==='round'&&o.geometry.type==='CylinderGeometry'));
 const slabs=[];group.traverse(o=>{if(o.userData.floorDepth)slabs.push(o);});assert.equal(slabs.length,1);assert.equal(slabs[0].userData.footprint,'round');assert(slabs[0].geometry.userData.footprintArea>50&&slabs[0].geometry.userData.footprintArea<50.27);
 const geometrySet=new Set(v.colliders.map(o=>o.geometry)),disposed=new Map([...geometrySet].map(g=>[g,0]));for(const g of geometrySet)g.addEventListener('dispose',()=>disposed.set(g,disposed.get(g)+1));v.dispose();v.dispose();assert([...disposed.values()].every(n=>n===1));
 check('Round decoration is pure, retains circular floor/columns, and disposes each owned collider geometry once',{slabArea:slabs[0].geometry.userData.footprintArea,ownedColliderGeometries:geometrySet.size});

 construction.apply(0,[piece('cannon',{solid:true,footprint:'round'})],options);const root=castles[0].children.find(o=>o.userData.profile),before=construction.counts,solidBefore=[...solids];
 for(const footprint of ['square','triangle',true,null,42])assert.throws(()=>construction.apply(0,[piece('floor',{footprint})],options),/footprint/);
 assert.equal(castles[0].children.find(o=>o.userData.profile),root);assert.deepEqual(construction.counts,before);assert.deepEqual(solids,solidBefore);
 check('Unsupported footprint values are rejected atomically without replacing the applied castle');

 const openingAreas=[];
 for(const rotation of [0,1,2,3]){
  const p=piece('roundTerrace',{layer:1}),view=construction.preview(0,[p,piece('stairs',{layer:0,rotation})],options),top=view.root.children.find(o=>o.userData.cell?.type==='roundTerrace'&&!o.userData.solidTerrace),slabs=[];top.traverse(o=>{if(o.userData.floorDepth)slabs.push(o);});
  assert.equal(top.userData.stairOpening.rotation,rotation);assert(slabs.every(o=>o.userData.stairOpening&&o.userData.footprint==='round'));const area=slabs.reduce((sum,o)=>sum+o.geometry.userData.footprintArea,0);assert(area>15&&area<24);openingAreas.push(area);view.dispose();
 }
 assert(Math.max(...openingAreas)-Math.min(...openingAreas)<1e-7);check('All four stair apertures clip the real circle instead of restoring square corners',{openingAreas});

 const view=construction.preview(1,[piece('curvedWall'),piece('embankment',{x:10,layer:0})],options),arc=view.colliders.find(o=>o.userData.curvedWall),bank=view.colliders.find(o=>o.userData.embankment);
 assert(arc&&bank);assert.equal(arc.geometry.type,'ExtrudeGeometry');assert.equal(arc.userData.curvedWall.height,7.4);assert.equal(bank.geometry.type,'BufferGeometry');assert(bank.material.vertexColors);assert(!Array.isArray(bank.material));assert(bank.geometry.getAttribute('color').count===bank.geometry.getAttribute('position').count);bank.geometry.computeBoundingBox();assert.equal(bank.geometry.boundingBox.min.x,-4);assert.equal(bank.geometry.boundingBox.max.z,4);assert(Math.abs(bank.geometry.boundingBox.max.y-3.7)<1e-6);assert(view.colliders.every(o=>{let node=o;while(node){if(node===view.root)return true;node=node.parent;}return false;}));view.dispose();
 check('Arc and bank collide using their displayed procedural mesh with a camera-fade-compatible single material',{arcHeight:7.4,bankHeight:3.7});

 for(const g of [roundSlab(1.2),curvedWallGeometry(),embankmentGeometry()]){
  const p=g.getAttribute('position'),indices=g.index?.array;let volume=0;
  for(let i=0;i<(indices?.length??p.count);i+=3){const a=new T.Vector3().fromBufferAttribute(p,indices?indices[i]:i),b=new T.Vector3().fromBufferAttribute(p,indices?indices[i+1]:i+1),c=new T.Vector3().fromBufferAttribute(p,indices?indices[i+2]:i+2);volume+=a.dot(b.cross(c))/6;}
  assert(volume>1,'closed surface must have outward winding and positive signed volume');g.dispose();
 }
 check('Procedural closed surfaces retain outward winding and nonzero enclosed volume');
 const baseBank=embankmentGeometry(0),palettes=new Set();for(let variant=0;variant<8;variant++){const g=embankmentGeometry(variant);assert.deepEqual(g.getAttribute('position').array,baseBank.getAttribute('position').array);assert.deepEqual(g.getAttribute('normal').array,baseBank.getAttribute('normal').array);assert.equal(g.index,baseBank.index);palettes.add(JSON.stringify(Array.from(g.getAttribute('color').array)));g.dispose();}baseBank.dispose();assert.equal(palettes.size,8);
 check('Eight deterministic bank palettes differ only in colors; collider vertices, indices and normals stay identical',{palettes:palettes.size});
 construction.restore(0);
}catch(error){report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}
fs.writeFileSync(new URL('../review/castle-curve-model.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,failures:report.failures},null,2));
