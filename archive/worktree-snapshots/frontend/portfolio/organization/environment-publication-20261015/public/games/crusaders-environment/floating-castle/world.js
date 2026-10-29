import * as T from '../vendor/three.module.js';
import {buildAerie} from './aerie-castle.js?v=foundation-visibility-1';
import {surface} from './surface-detail.js?v=normal-v2';
import {paletteLook} from './retro-look.js';
import {palettePair} from './palette-pair.js?v=relief-2';
import {chargeOrb} from './charge-orb.js?v=electric-1';
import {skyHarbor} from './sky-harbor.js';
import {arenaGarden} from './arena-garden.js';
export function makeWorld(scene){
 const siloNames=['T1 \u00b7 NORTHWEST','T2 \u00b7 NORTHEAST','T3 \u00b7 SOUTHEAST','T4 \u00b7 SOUTHWEST'];
 const colors={stone:'#dac9a3',edge:'#fff0c8',dark:'#677993',soil:'#8b8390',paving:'#c7bea5',roof:'#508f9b',roofB:'#80709a',leaves:'#80a67a',grass:'#829b78',bark:'#8b7967',sail:'#f2dfb9'};
 const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>{const m=new T.MeshStandardMaterial({color,roughness:1,flatShading:true});m.color.convertSRGBToLinear();return [key,m];}));
 mats.sail.side=T.DoubleSide;
 const tiles=[];for(const [key,type,scale] of [['stone','stone',.11],['edge','stone',.2],['soil','rock',.045],['paving','paving',.13],['roof','roof',.16],['roofB','roof',.16],['leaves','leaf',.3],['grass','leaf',.07],['bark','wood',.3],['sail','cloth',.15]])tiles.push(surface(mats[key],type,scale));
 const lighting=paletteLook(Object.values(mats)),pairs=Object.values(mats).map(m=>palettePair(m));for(const p of pairs)p.direction.value=lighting.direction.value;
 const original=buildAerie(mats),castles=[original.root,original.root.clone(true)],origins=[[-205,55,22],[205,55,-22]],solids=[];
 castles.forEach((castle,i)=>{castle.position.set(...origins[i]);castle.rotation.y=i?-Math.PI/2:Math.PI/2;castle.name=i?'Dusk castle':'Dawn castle';castle.traverse(o=>{if(i&&o.material===mats.roof)o.material=mats.roofB;if(o.userData.structure){o.userData.castleIndex=i;solids.push(o);}});scene.add(castle);});
 const harbors=castles.map((castle,i)=>skyHarbor(castle,mats,i));for(const harbor of harbors)solids.push(...harbor.solids);
 const castleHearts=castles.map((castle,i)=>chargeOrb(castle,mats,{x:-17,y:68,z:-55,radius:8.4,color:i?0xc5a2ee:0x6ee2e3,crown:true,phase:i*2}));
 castleHearts.forEach((heart,i)=>{heart.core.userData.coreTeam=i;for(const solid of [heart.core,heart.foot]){solid.userData.structure=true;solid.userData.castleIndex=i;solids.push(solid);}});
 scene.updateMatrixWorld(true);
 const transform=(i,p)=>new T.Vector3(...p).applyMatrix4(castles[i].matrixWorld).toArray(),routes=castles.map((_,i)=>original.route.map(p=>transform(i,p))),route=routes[0],arena=new T.Group();scene.add(arena);const boxG=new T.BoxGeometry(1,1,1);
 function mesh(g,m,x,y,z,solid=false){const o=new T.Mesh(g,m);o.position.set(x,y,z);arena.add(o);if(solid)solids.push(o);return o;}
 function box(x,y,z,w,h,d,m=mats.stone,solid=false){const o=mesh(boxG,m,x,y,z,solid);o.scale.set(w,h,d);return o;}
 function ring(x,y,z,r,m=mats.edge,t=.16){const o=mesh(new T.TorusGeometry(r,t,4,48),m,x,y,z);o.rotation.x=Math.PI/2;return o;}
 function annulus(outer,inner,depth,y,material,solid){const shape=new T.Shape(),hole=new T.Path();for(let i=0;i<64;i++){const a=i/64*Math.PI*2;i?shape.lineTo(Math.cos(a)*outer,Math.sin(a)*outer):shape.moveTo(outer,0);}shape.closePath();for(let i=0;i<64;i++){const a=-i/64*Math.PI*2;i?hole.lineTo(Math.cos(a)*inner,Math.sin(a)*inner):hole.moveTo(inner,0);}hole.closePath();shape.holes.push(hole);const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});g.rotateX(Math.PI/2);return mesh(g,material,0,y,0,solid);}
 // Visible and collision surfaces share the open centre, down through the rock.
 annulus(108,47,19,-.8,mats.soil,true);annulus(108,47,.8,0,mats.paving,true);
 annulus(107.8,104.8,.25,.12,mats.edge,false);annulus(50,47.2,.3,.14,mats.edge,false);
 for(const r of [59,88])ring(0,.07,0,r,mats.roof,.23);
 for(let i=0;i<48;i++){const a=i*Math.PI/24,r=i%2?102:54;const crag=mesh(new T.ConeGeometry(4,10+i%4*2,5),mats.soil,Math.cos(a)*r,-21,Math.sin(a)*r);crag.rotation.z=Math.PI;}
 const houses=[];
 for(let i=0;i<24;i++){const a=(i+.5)*Math.PI*2/24,r=96,x=Math.cos(a)*r,z=Math.sin(a)*r,h=5+i%3,home=new T.Group();home.position.set(x,0,z);home.rotation.y=-a+Math.PI/2;arena.add(home);
  function part(g,m,x,y,z,solid=false){const o=new T.Mesh(g,m);o.position.set(x,y,z);home.add(o);if(solid)solids.push(o);return o;}
  part(new T.BoxGeometry(6.8,h,8),i%3?mats.stone:mats.edge,0,h/2,0,true);const roof=part(new T.ConeGeometry(6.5,4.4,4),i%2?mats.roof:mats.roofB,0,h+2.1,0,true);roof.rotation.y=Math.PI/4;roof.scale.z=1.2;
  part(new T.BoxGeometry(7.8,.35,9),mats.edge,0,.18,0);part(new T.BoxGeometry(1.45,2.6,.12),mats.bark,0,1.3,4.08);
  for(const side of [-1,1]){part(new T.BoxGeometry(1.45,1.65,.12),mats.dark,side*2.2,h*.58,4.08);part(new T.BoxGeometry(.13,1.75,.15),mats.edge,side*2.2,h*.58,4.18);part(new T.BoxGeometry(1.6,.13,.15),mats.edge,side*2.2,h*.58,4.18);}part(new T.BoxGeometry(.9,3,.9),mats.stone,-1.5,h+3,-1.5);houses.push(home);
 }
 const bridges=[],outposts=[],orbTowers=[],orbColors=[0x8ce9ef,0xf5ca85,0xd3b1f6,0xa7e1a2];
 for(const [i,position] of [[-57,-57],[57,-57],[57,57],[-57,57]].entries()){
  const [x,z]=position,start=arena.children.length;mesh(new T.CylinderGeometry(7,8,1.2,8),mats.edge,x,.6,z,true);mesh(new T.CylinderGeometry(4.3,5,12,8),mats.stone,x,7,z,true);for(const y of [2,6,10,13])mesh(new T.CylinderGeometry(4.8,4.8,.5,8),mats.roof,x,y,z);mesh(new T.CylinderGeometry(6,4.8,1.3,8),mats.edge,x,14,z,true);
  for(let j=0;j<4;j++){const a=j*Math.PI/2,prong=box(x+Math.cos(a)*4.9,16.4,z+Math.sin(a)*4.9,.7,4,.7,mats.edge);prong.rotation.z=Math.cos(a)*-.2;}
  const orb=chargeOrb(arena,mats,{x,y:19.5,z,radius:2.7,color:orbColors[i],phase:i});orbTowers.push({...orb,x,z,index:i+1});ring(x,.08,z,11,mats.edge,.35);
  for(let j=0;j<8;j++){const a=j*Math.PI/4,mark=box(x+Math.cos(a)*9,.06,z+Math.sin(a)*9,.45,.08,1.5,mats.roof);mark.rotation.y=-a;}
  const group=new T.Group();group.name='Outer silo island '+(i+1);arena.add(group);
  const moved=arena.children.slice(start).filter(o=>o!==group);for(const o of moved)group.attach(o);
  const dx=Math.sign(x)*270-x,dz=Math.sign(z)*230-z;group.position.set(dx,0,dz);
  const nx=x+dx,nz=z+dz;orbTowers[i].structureRoot=group;orbTowers[i].x=nx;orbTowers[i].z=nz;orbTowers[i].y=0;orbTowers[i].damage=90;orbTowers[i].captureRadius=14;
  const land=mesh(new T.CylinderGeometry(36,36,2,48),mats.paving,nx,-1,nz,true);land.rotation.y=Math.PI/48;land.userData.place=siloNames[i]+' island';
  mesh(new T.CylinderGeometry(36,10,30,12),mats.soil,nx,-17,nz,true);
  ring(nx,.1,nz,34,mats.edge,.35);ring(nx,.1,nz,16,mats.roof,.2);
  for(let j=0;j<9;j++){const a=j*2.399;mesh(new T.IcosahedronGeometry(2,0),mats.leaves,nx+Math.cos(a)*29,1,nz+Math.sin(a)*29);}
  outposts.push({x:nx,y:0,z:nz,radius:36,label:siloNames[i]});

 }
 for(const o of outposts){
  const d=Math.hypot(o.x,o.z),ux=o.x/d,uz=o.z/d,a={x:ux*101,y:0,z:uz*101},b={x:o.x-ux*30,y:0,z:o.z-uz*30},length=Math.hypot(b.x-a.x,b.z-a.z),angle=Math.atan2(ux,uz);
  const deck=box((a.x+b.x)/2,-.7,(a.z+b.z)/2,12,1.4,length,mats.paving,true);deck.rotation.y=angle;deck.userData.place=o.label+' causeway';
  for(const side of [-1,1]){const rail=box((a.x+b.x)/2+uz*side*5.8,.7,(a.z+b.z)/2-ux*side*5.8,.6,1.4,length,mats.edge,true);rail.rotation.y=angle;}
  for(let t=8;t<length;t+=16){const x=a.x+ux*t,z=a.z+uz*t;const rib=box(x,-2,z,13,2,1.1,mats.stone);rib.rotation.y=angle;for(const side of [-1,1])mesh(new T.ConeGeometry(1.3,5,4),mats.soil,x+uz*side*4,-4,z-ux*side*4);}
  bridges.push({a,b,width:12});
 }
 for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/6,r=54,x=Math.cos(a)*r,z=Math.sin(a)*r;mesh(new T.CylinderGeometry(2.3,2.3,.25,8),mats.grass,x,.12,z);mesh(new T.CylinderGeometry(.24,.45,3,6),mats.bark,x,1.5,z,true);mesh(new T.IcosahedronGeometry(2.1,0),mats.leaves,x,4,z);}
 const castlePads=castles.map((_,i)=>{const [x,y,z]=transform(i,[22,.77,74]);return {name:i?'Dusk castle':'Dawn castle',x,y,z,r:6,home:true};});
 const pads=[...castlePads,{name:'Arena west',x:-76,y:0,z:0,r:6},{name:'Arena east',x:76,y:0,z:0,r:6},{name:'Arena south',x:0,y:0,z:76,r:6},{name:'Arena north',x:0,y:0,z:-76,r:6} ,...outposts.map((o,i)=>({name:o.label+' landing',x:o.x+22,y:0,z:o.z,r:5}))],glows=[];
 for(const [i,p] of pads.entries()){const emissive=new T.MeshBasicMaterial({color:i===1?0xd3b1f6:0x82f3ee});ring(p.x,p.y+.11,p.z,p.r,emissive);ring(p.x,p.y+.11,p.z,p.r-.65);for(let j=0;j<8;j++){const a=j*Math.PI/4,mark=box(p.x+Math.cos(a)*(p.r-1.6),p.y+.1,p.z+Math.sin(a)*(p.r-1.6),.35,.08,1.2,mats.roof);mark.rotation.y=-a;}glows.push(mesh(new T.OctahedronGeometry(.55,0),emissive,p.x,p.y+1.1,p.z));}
 const clouds=new T.Group();scene.add(clouds);const cloudMat=new T.MeshBasicMaterial({color:0xb9d6dc,transparent:true,opacity:.25,depthWrite:false});for(let i=0;i<24;i++){const a=i*2.4,r=300+i%4*36,c=new T.Mesh(new T.IcosahedronGeometry(1,0),cloudMat);c.position.set(Math.cos(a)*r,-52-i%3*10,Math.sin(a)*r);c.scale.set(26+i%3*9,3+i%3,10+i%4*4);clouds.add(c);}
 const garden=arenaGarden(arena,mats);solids.push(...garden.solids);orbTowers.push({...garden.core,structureRoot:[garden.core.root,garden.pedestal,garden.island,garden.rock],x:0,y:-12,z:0,index:5,damage:360,label:'CROWN',radius:15});
 function animate(time){for(const orb of [...orbTowers.slice(0,4),...castleHearts])orb.update(time);for(const castle of castles)castle.traverse(o=>{if(o.protectorRig)o.protectorRig.update(time);if(o.citadelRig)o.citadelRig.update(time);});for(const harbor of harbors)harbor.update(time);garden.update(time);}
 for(let team=0;team<2;team++){const p=pads[team],sign=team?-1:1;const bridge=box(p.x+sign*16,p.y-.65,p.z,32,1.3,8,mats.paving,true);bridge.userData.castleIndex=team;bridge.userData.place='Fleet boarding pier';}
 const occluders=[...solids,...harbors.flatMap(h=>h.occluders)];for(const castle of castles)castle.traverse(m=>{if(m.userData.visualOccluder)occluders.push(m);});
 scene.updateMatrixWorld(true);return {mats,tiles,lighting,pairs,castles,castle:castles[0],solids,occluders,route,routes,pads,glows,clouds,arena,houses,orbTowers,castleHearts,harbors,garden,outposts,bridges,animate,ring:{inner:47,outer:108,y:0},origins};
}
