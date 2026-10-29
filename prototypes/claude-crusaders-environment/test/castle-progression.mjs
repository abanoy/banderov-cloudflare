import * as T from '../vendor/three.module.js';
import {profile,containsCell,minimumLevel,footprint} from '../floating-castle/castle-rules.js';
import {createConstruction,presets,MAX_PARTS} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {flightWorld} from '../floating-castle/flight.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const report={scope:'Pure progression rules and Node Three.js geometry/fixed-step fixtures. Synthetic original castle/harbor siblings with actual construction, chargeOrb and flightWorld. Explicit actor positions and inputs; no browser/native-input or visual-performance claims.',checks:[],failures:[],sourceHashes:{}};
for(const name of ['castle-rules.js','castle-construction.js'])report.sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+name,import.meta.url))).digest('hex');
const check=(name,details={})=>report.checks.push({name,...details});
try{
 const bands=[];for(let level=10;level<=100;level+=10){const p=profile({level,material:'auto'});assert.equal(p.size,8+level/5);assert.equal(p.maxZ,12);assert.equal(footprint(p).maxZ,44);assert.equal(minimumLevel([{x:p.minX,z:p.minZ}]),level);bands.push(p);}
 assert.equal(profile().size,12);assert.equal(profile().level,20);assert.equal(profile().material,'fortress');assert.equal(MAX_PARTS,720);assert.deepEqual(footprint(profile({level:100})),{minX:-112,maxX:112,minZ:-180,maxZ:44});
 for(const options of [{level:0},{level:101},{level:1.5},{level:Infinity},{material:'plastic'},null,[]])assert.throws(()=>profile(options));
 check('Ten plot bands preserve legacy coordinates/front edge; material progression and strict options',{bands});

 const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()]));
 // Small diagnostic shader hooks represent the existing shared tile/lighting chain.
 for(const [name,m] of Object.entries(mats)){m.onBeforeCompile=shader=>{shader.uniforms.tileScale={value:.11};shader.uniforms.tileSource={value:name};shader.uniforms.existingLighting={value:1};};m.customProgramCacheKey=()=>name+'-original';}
 const castles=[new T.Group(),new T.Group()],castleHearts=[],harbors=[],solids=[],occluders=[];
 for(const [home,castle] of castles.entries()){
  for(let i=0;i<2;i++){const group=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(1,1,1),mats.stone);mesh.position.set(40,-2,0);group.add(mesh);castle.add(group);solids.push(mesh);occluders.push(mesh);}
  const port=new T.Group();port.position.x=home?3:2;castle.add(port);harbors.push({root:port});castleHearts.push(chargeOrb(castle,mats,{x:-17,y:68,z:-55,radius:8.4,crown:true}));castle.updateMatrixWorld(true);
 }
 const world={mats,castles,castleHearts,harbors,solids,occluders},construction=createConstruction(world),initialSolids=solids.slice(),initialPorts=harbors.map(h=>h.root.position.x);
 const preview=construction.preview(0,presets('courtyard',{level:100}),{level:100});assert.deepEqual(harbors.map(h=>h.root.position.x),initialPorts);assert.equal(preview.root.userData.profile.size,28);preview.dispose();
 const stats=construction.apply(0,presets('courtyard',{level:100}),{level:100});assert.equal(stats.profile.size,28);assert.equal(harbors[0].root.position.x,initialPorts[0]+64);assert.equal(harbors[1].root.position.x,initialPorts[1]);assert.equal(world.solids,solids);assert.equal(world.occluders,occluders);
 const currentSolids=solids.map(o=>o.id),portX=harbors[0].root.position.x;assert.throws(()=>construction.apply(0,[{x:-8,z:-16,layer:0,type:'floor',rotation:0}],{level:20}));assert.deepEqual(solids.map(o=>o.id),currentSolids);assert.equal(harbors[0].root.position.x,portX);construction.restore(0);assert.deepEqual(harbors.map(h=>h.root.position.x),initialPorts);assert(initialSolids.every(o=>solids.includes(o)));
 check('Large-plot apply shifts only its existing port; preview is pure, invalid shrink atomic, Restore restores the port',{largeProfile:stats.profile,portOffsets:initialPorts});

 const x=7,z=7,cx=(x-5.5)*8,cz=(z-5.5)*8-4,rows=[];
 for(let rotation=0;rotation<4;rotation++){
  const dx=[0,-1,0,1][rotation],dz=[-1,0,1,0][rotation],stairs={x,z,layer:0,type:'stairs',rotation},cover={x,z,layer:1,type:'floor',rotation:(rotation+1)%4},landing={x:x+dx,z:z+dz,layer:1,type:'floor',rotation:0},layout=[stairs,cover,landing],draft=JSON.stringify(layout);
  for(const reversed of [false,true]){
   construction.apply(0,reversed?layout.slice().reverse():layout);assert.equal(JSON.stringify(layout),draft);
   const sim=flightWorld(solids,[{x:cx-dx*4.8,y:.77,z:cz-dz*4.8,r:6}]),s=sim.state;
   const highProbe=sim.floor(cx+dx*2,12,cz+dz*2,15),uncutProbe=sim.floor(cx-dx*3,12,cz-dz*3,15);assert(highProbe&&Math.abs(highProbe.y-6.77)<.02,'hole must expose ramp');assert(uncutProbe&&Math.abs(uncutProbe.y-8.77)<.02,'uncut slab must remain');
   Object.assign(s,{x:cx-dx*4.8,y:.77,z:cz-dz*4.8,grounded:true,home:0});
   let steps=0;while((s.x-cx)*dx+(s.z-cz)*dz<6.9&&steps++<200){sim.step(1/120,{x:dx,z:dz});assert.equal(s.falls,0);}
   assert(steps<200);assert(s.grounded);assert(Math.abs(s.y-8.77)<.02);const up={x:s.x,y:s.y,z:s.z};
   for(let i=0;i<steps;i++)sim.step(1/120,{x:-dx,z:-dz});assert(s.grounded);assert(Math.abs(s.y-.77)<.02);assert(Math.hypot(s.x-(cx-dx*4.8),s.z-(cz-dz*4.8))<.01);
   const built=castles[0].children.find(o=>o.userData.profile);assert.equal(built.userData.stairClearances.length,1);assert.equal(built.children.find(o=>o.userData.cell?.type==='floor'&&o.userData.cell.x===x&&o.userData.cell.z===z).userData.stairOpening.rotation,rotation);
   rows.push({rotation,reversed,steps,holeRampHeight:highProbe.y,uncutFloorHeight:uncutProbe.y,up,returned:{x:s.x,y:s.y,z:s.z}});
  }
  construction.apply(0,[cover,landing]);const restored=flightWorld(solids,[{x:cx,y:0,z:cz,r:6}]).floor(cx+dx*2,12,cz+dz*2,15);assert(restored&&Math.abs(restored.y-8.77)<.02,'removed stairs restore solid floor');
 }
 check('Automatic upper-floor openings: four rotations × both placement orders, mismatched floor rotation, physical up/down traversal and restored slab',{rows});

 const strong=construction.preview(0,[{x:2,z:8,layer:3,type:'floor',rotation:0}]),supports=strong.colliders.filter(o=>o.userData.supportStyle),slab=strong.colliders.find(o=>o.userData.floorDepth===1.2);
 assert.equal(supports.length,4);assert(supports.every(o=>o.userData.supportDepth===2.6&&o.userData.supportStories===3));assert(slab);const qx=(2-5.5)*8,qz=(8-5.5)*8-4,ray=new T.Raycaster();ray.set(new T.Vector3(qx,.77+1.5,qz+9),new T.Vector3(0,0,-1));ray.far=9;assert.equal(ray.intersectObjects(supports,false).length,0,'vault opening remains walkable');ray.set(new T.Vector3(qx+3.3,.77+1.5,qz+9),new T.Vector3(0,0,-1));assert(ray.intersectObjects(supports,false).length,'wide masonry pier must collide');
 check('Upper floor rests on broad multi-storey masonry vaults with real passages',{walls:supports.length,stories:3,depth:2.6,slabDepth:1.2});strong.dispose();

 const materialRows=[],refs=new Map();for(const material of ['wood','stone','brick','fortress']){
  const v=construction.preview(0,[{x:3,z:8,layer:0,type:'wall',rotation:0}],{level:20,material}),wall=v.colliders.find(o=>o.userData.wallRole==='curtain wall'),shader={uniforms:{}};wall.material.onBeforeCompile(shader);assert.equal(shader.uniforms.existingLighting.value,1);assert.equal(shader.uniforms.tileSource.value,material==='wood'?'bark':'stone');materialRows.push({material,color:wall.material.color.getHexString(),tileScale:shader.uniforms.tileScale.value,tileSource:shader.uniforms.tileSource.value,wallDepth:wall.userData.wallDepth});refs.set(material,wall.material);v.dispose();
  const again=construction.preview(0,[],{level:20,material});let found=false;again.root.traverse(o=>{if(o.material===refs.get(material))found=true;});assert(found,'materials are cached per construction');again.dispose();
 }
 assert.equal(new Set(materialRows.map(m=>m.color)).size,4);assert.equal(materialRows.find(m=>m.material==='brick').tileScale,.28);check('Four distinguishable cached material stages retain shared texture and lighting hooks',{materials:materialRows});
 const large=presets('twinkeeps',{level:100}),largeView=construction.preview(0,large,{level:100});assert(large.every(p=>containsCell(p,profile({level:100}))));assert(large.length<=720);assert(large.some(p=>p.x<0&&p.layer===3));assert(large.some(p=>p.x>11&&p.layer===6));check('Max-level Twin Keeps demonstrates separate three- and six-storey wings',{parts:large.length,colliders:largeView.colliders.length});largeView.dispose();
 construction.restore(0);report.passed=true;
}catch(error){report.passed=false;report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}
fs.writeFileSync(new URL('../review/castle-progression.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log((report.passed?'PASS':'FAIL')+': '+report.checks.length+' progression groups');if(report.failures.length)console.error(report.failures[0].stack);
