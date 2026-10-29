import * as T from '../vendor/three.module.js';
import {buildAerie} from './aerie-castle.js?v=foundation-visibility-1';
import {surface} from './surface-detail.js?v=aerie-20261018';
import {paletteLook} from './retro-look.js?v=aerie-20261018';
import {palettePair,PAIR_LIGHT} from './palette-pair.js?v=dbc-20261018';
import {SKY_PRESETS} from './atmosphere.js?v=dbc-20261018';
import {chargeOrb} from './charge-orb.js?v=aerie-20261018';
import {skyHarbor} from './sky-harbor.js';
import {arenaGarden,treeCrowns,makeWaterfall} from './arena-garden.js?v=dbc-20261018';
import {createSkyLayers} from './sky-layers.js?v=dbc-20261018';
import {addRock,rockBuilder,ringKeel,islandFringe,mergeParts,rng} from './sky-rock.js?v=dbc-20261018';
export function makeWorld(scene){
 const siloNames=['T1 \u00b7 NORTHWEST','T2 \u00b7 NORTHEAST','T3 \u00b7 SOUTHEAST','T4 \u00b7 SOUTHWEST'];
 const colors={stone:'#dac9a3',edge:'#fff0c8',dark:'#677993',soil:'#8b8390',paving:'#c7bea5',roof:'#508f9b',roofB:'#80709a',leaves:'#80a67a',grass:'#829b78',bark:'#8b7967',sail:'#f2dfb9',rock:'#ffffff',pine:'#5f8769',blossom:'#ff8fa3',brass:'#d8aa5e',banner:'#ffffff'};
 const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>{const m=new T.MeshStandardMaterial({color,roughness:1,flatShading:true});m.color.convertSRGBToLinear();return [key,m];}));
 mats.sail.side=T.DoubleSide;mats.rock.vertexColors=true;mats.banner.vertexColors=true;mats.banner.side=T.DoubleSide;
 const tiles=[];for(const [key,type,scale] of [['stone','stone',.11],['edge','stone',.2],['soil','rock',.045],['paving','paving',.13],['roof','roof',.16],['roofB','roof',.16],['leaves','leaf',.3],['grass','leaf',.07],['bark','wood',.3],['sail','cloth',.15],['rock','rock',.05],['pine','leaf',.3],['blossom','leaf',.3],['brass','cloth',.2],['banner','cloth',.15]])tiles.push(surface(mats[key],type,scale));
 // SA1 / Dreamcast look per material, layered on the authored colours (material.color is untouched): vividness
 // (greens, roofs and brass saturate; sandstone warms to gold), gouraud sheen (brass, glazed roofs, stone tops) and a
 // small albedo tint (masonry toward peach instead of olive, the mauve soil toward warm earth). Castle variants and
 // allegiance clones inherit their source's values.
 const look={stone:[1.12,.1,[1.06,.99,.93]],edge:[1.08,.12,[1.02,1,.97]],dark:[1.15,.1],soil:[1.3,.03,[1.18,.95,.82]],paving:[1.12,.08,[1.09,.99,.92]],roof:[1.35,.3],roofB:[1.3,.3],leaves:[1.7,.06],grass:[1.65,.04],bark:[1.2,0],sail:[1,.04],rock:[1.3,.04],pine:[1.6,.06],blossom:[1.3,.08],brass:[1.3,.6],banner:[1.2,.05]};
 const lighting=paletteLook(Object.values(mats)),pairs=Object.entries(mats).map(([key,m])=>palettePair(m,{vivid:look[key]?.[0]??1,sheen:look[key]?.[1]??0,tint:look[key]?.[2]}));for(const p of pairs)p.direction.value=lighting.direction.value;
 // Shared SA1 light (sky ambient fill, hemisphere tints, exposure, rim) follows the sky preset; day sky fog/hemisphere at boot.
 const skyLight=preset=>{const l=preset?.light||SKY_PRESETS.day.light;PAIR_LIGHT.ambient.value.setRGB(...l.ambient);PAIR_LIGHT.side.value.setRGB(...l.side);PAIR_LIGHT.ground.value.setRGB(...l.ground);PAIR_LIGHT.exposure.value=l.exposure;PAIR_LIGHT.rim.value.setRGB(...l.rim);PAIR_LIGHT.wall.value=l.wall??.45;PAIR_LIGHT.top.value=l.top??.3;PAIR_LIGHT.view.value.set(...(l.view||[-.15,-.2]));PAIR_LIGHT.chroma.value=l.chroma??1;PAIR_LIGHT.bounce.value.setRGB(...(l.bounce||[0,0,0]));};skyLight(SKY_PRESETS.day);
 if(!scene.userData.skyPreset){scene.fog?.color.setHex(SKY_PRESETS.day.fog);const hemi=scene.children.find(o=>o.isHemisphereLight);if(hemi){hemi.color.setHex(SKY_PRESETS.day.hemi[0]);hemi.groundColor.setHex(SKY_PRESETS.day.hemi[1]);}}
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
 // Hanging strata keel under the ring (visual only), in four chunks so each keeps a local bound.
 for(let q=0;q<4;q++){const keel=new T.Mesh(ringKeel({from:q*Math.PI/2,to:(q+1)*Math.PI/2,seed:5+q,depth:24+q%2*5}),mats.rock);keel.name='Ring underside keel '+(q+1);arena.add(keel);}
 // Ring village: a three-type house kit (cottage, two-storey with jetty, round tower-house) in
 // eight clusters of three. Clusters leave the causeway heads (45deg+k90deg) and the axis pads open.
 // Walls/roofs stay individual colliders; all trim is merged per quadrant and material.
 const houses=[],chimneys=[],lanterns=[],detail=new Map(),place=new T.Object3D(),geo={box:new T.BoxGeometry(1,1,1),oct:new T.CylinderGeometry(1,1,1,8)};
 const lanternMaterial=new T.MeshBasicMaterial({color:0xc9a060});lanternMaterial.name='Village lanterns';const windowMaterial=new T.MeshBasicMaterial({color:0x56627e});windowMaterial.name='Village windows';
 function trim(quadrant,material,geometry,matrix,color){const key=quadrant+'|'+material.uuid;if(!detail.has(key))detail.set(key,{material,parts:[],quadrant});detail.get(key).parts.push({geometry,matrix,color});}
 function homeKit(home,quadrant,type,variant){
  home.updateMatrixWorld(true);const local=(g,m,x,y,z,sx,sy,sz,ry=0)=>{place.position.set(x,y,z);place.rotation.set(0,ry,0);place.scale.set(sx,sy,sz);place.updateMatrix();trim(quadrant,m,g,new T.Matrix4().multiplyMatrices(home.matrix,place.matrix));};
  function part(g,m,x,y,z,solid=false){const o=new T.Mesh(g,m);o.position.set(x,y,z);home.add(o);if(solid)solids.push(o);return o;}
  const roofMat=variant%2?mats.roof:mats.roofB,lamp=(x,y,z)=>{local(geo.box,lanternMaterial,x,y,z,.46,.56,.46);local(geo.box,mats.bark,x,y+.38,z-.14,.09,.09,.46);lanterns.push(home.localToWorld(new T.Vector3(x,y,z)));};
  if(type==='cottage'){const h=5+variant%3;
   part(new T.BoxGeometry(6.8,h,8),variant%3?mats.stone:mats.edge,0,h/2,0,true);const roof=part(new T.ConeGeometry(6.5,4.4,4),roofMat,0,h+2.1,0,true);roof.rotation.y=Math.PI/4;roof.scale.z=1.2;
   local(geo.box,mats.edge,0,.18,0,7.8,.35,9);local(geo.box,mats.bark,0,1.3,4.08,1.45,2.6,.12);
   for(const side of [-1,1]){local(geo.box,windowMaterial,side*2.2,h*.58,4.08,1.45,1.65,.12);local(geo.box,mats.edge,side*2.2,h*.58,4.18,.13,1.75,.15);local(geo.box,mats.edge,side*2.2,h*.58,4.18,1.6,.13,.15);}
   local(geo.box,mats.stone,-1.5,h+3,-1.5,.9,3,.9);local(geo.box,mats.edge,-1.5,h+4.55,-1.5,1.15,.22,1.15);chimneys.push(home.localToWorld(new T.Vector3(-1.5,h+4.7,-1.5)));lamp(1.25,2.55,4.32);return {eave:h};}
  if(type==='two'){
   part(new T.BoxGeometry(6,4.4,7),mats.stone,0,2.2,0,true);part(new T.BoxGeometry(7.2,3.4,8.4),mats.edge,0,6.1,0,true);const roof=part(new T.ConeGeometry(6.6,4.2,4),roofMat,0,9.9,0,true);roof.rotation.y=Math.PI/4;roof.scale.z=1.18;
   local(geo.box,mats.bark,0,4.42,0,7.5,.34,8.7);for(const sx of [-1,1])for(const sz of [-1,1])local(geo.box,mats.bark,sx*3.47,6.1,sz*4.07,.3,3.4,.3);
   for(const sx of [-1,1]){local(geo.box,mats.bark,sx*1.15,6.1,4.24,.24,3.4,.12);local(geo.box,windowMaterial,sx*2.3,6.25,4.24,1.05,1.25,.1);local(geo.box,mats.bark,sx*2.3,6.25,4.27,1.25,.14,.1);}
   local(geo.box,mats.bark,0,7.72,4.24,7.2,.26,.12);local(geo.box,mats.bark,0,1.3,3.56,1.45,2.6,.12);local(geo.box,windowMaterial,2,2.6,3.56,1.2,1.1,.1);
   local(geo.box,mats.stone,1.8,11,-1.9,.9,3.4,.9);local(geo.box,mats.edge,1.8,12.75,-1.9,1.15,.22,1.15);chimneys.push(home.localToWorld(new T.Vector3(1.8,12.9,-1.9)));lamp(-1.2,2.55,3.8);return {eave:7.8};}
  part(new T.CylinderGeometry(3.2,3.55,9,8),mats.stone,0,4.5,0,true).rotation.y=Math.PI/8;const roof=part(new T.ConeGeometry(4.25,5.2,8),roofMat,0,11.6,0,true);roof.rotation.y=Math.PI/8;
  local(geo.oct,mats.edge,0,6.3,0,3.42,.4,3.42,Math.PI/8);local(geo.oct,mats.edge,0,.2,0,3.85,.4,3.85,Math.PI/8);
  for(const a of [0,2.1,-2.1]){const c=Math.cos(a),sn=Math.sin(a);local(geo.box,windowMaterial,sn*3.24,7.6,c*3.24,.45,1.5,.12,a);local(geo.box,windowMaterial,sn*3.38,3.6,c*3.38,.45,1.2,.12,a);}
  local(geo.box,mats.bark,0,1.25,3.3,1.3,2.5,.14);local(geo.box,mats.edge,0,14.7,0,.24,1.3,.24);local(geo.box,mats.edge,0,15.1,0,.9,.18,.18);lamp(1.15,2.5,3.45);return {eave:9};
 }
 const kits=[['cottage','two','tower'],['two','cottage','cottage'],['cottage','tower','two'],['tower','two','cottage']],buntingLines=[];
 for(let c=0;c<8;c++){const centre=(Math.floor(c/2)*90+(c%2?23:-23))*Math.PI/180,quadrant=Math.floor((((centre%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI/2)),cluster=[];
  for(let j=0;j<3;j++){const a=centre+(j-1)*7.6*Math.PI/180+(c%3-1)*.012,r=[95.6,97.2,95.2][j]+(c%2)*.5,type=kits[(c+(c>3?1:0))%4][j],home=new T.Group();home.position.set(Math.cos(a)*r,0,Math.sin(a)*r);
   home.rotation.y=-a+Math.PI/2+(j===1&&c%2?Math.PI:0)+(j-1)*.07+(c%2?-.05:.06);home.name='Ring house '+(houses.length+1)+' ('+type+')';arena.add(home);
   const info=homeKit(home,quadrant,type,c*3+j);houses.push(home);cluster.push({home,eave:info.eave,a,r});}
  for(let j=0;j<2;j++)buntingLines.push({from:cluster[j],to:cluster[j+1],quadrant,seed:c*2+j});}
 // Bunting: catenary strings of owner-palette pennants between neighbouring houses (merged, vertex coloured).
 const flagColors=['#f4c67b','#ff8fa3','#80eee2','#fff3cd','#f49bc7'].map(c=>new T.Color(c).convertSRGBToLinear()),cord=new T.Color('#4b3b3a').convertSRGBToLinear(),flagShape=new T.BufferGeometry();
 flagShape.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,0,1,0,-1,.5,-.42,0,.5,.42,0,.5,0,-1,.5],3));// crossed pennant: readable from every Q/E angle
flagShape.computeVertexNormals();
 const cordShape=new T.BoxGeometry(1,1,1);
 for(const line of buntingLines){const A=line.from.home.position,B=line.to.home.position,ya=Math.min(line.from.eave,line.to.eave)+2.3,dx=B.x-A.x,dz=B.z-A.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,start=new T.Vector3(A.x+ux*2.2,ya,A.z+uz*2.2),end=new T.Vector3(B.x-ux*2.2,ya,B.z-uz*2.2),span=start.distanceTo(end),n=Math.max(3,Math.floor(span/1.05)),angle=Math.atan2(ux,uz);
  const at=t=>new T.Vector3().lerpVectors(start,end,t).add(new T.Vector3(0,-.9*4*t*(1-t),0));let prev=at(0);
  for(let k=1;k<=n;k++){const p=at(k/n),mid=prev.clone().add(p).multiplyScalar(.5),seg=prev.distanceTo(p);place.position.copy(mid);place.lookAt(p);place.scale.set(.06,.06,seg);place.updateMatrix();trim(line.quadrant,mats.banner,cordShape,place.matrix.clone(),cord);
   if(k<n){place.position.copy(p);place.rotation.set(0,angle,0);place.scale.set(1,.85,.75);place.updateMatrix();trim(line.quadrant,mats.banner,flagShape,place.matrix.clone(),flagColors[(k+line.seed)%flagColors.length]);}prev=p;}}
 for(const [key,batch] of detail){const origin=new T.Vector3();for(const p of batch.parts)origin.add(new T.Vector3().setFromMatrixPosition(p.matrix));origin.multiplyScalar(1/batch.parts.length);
  const merged=new T.Mesh(mergeParts(batch.parts,origin,{colors:!!batch.material.vertexColors}),batch.material);merged.position.copy(origin);merged.name='Village trim q'+batch.quadrant+' '+(batch.material.name||key.split('|')[0]);arena.add(merged);}
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
  // Visual underside around the collider cone: strata rock, stalactites, moss lip, roots, a thin fall.
  const under=rockBuilder();addRock(under,{x:0,y:-1.55,z:0,rx:37.2,rz:37.2,depth:58+i%2*8,seed:11+i*7,sides:16,rings:8,jitter:.1,stalactites:7,cap:false,lip:1.025});const underside=mesh(under.geometry(),mats.rock,nx,0,nz);underside.name=siloNames[i]+' hanging rock';
  islandFringe(arena,mats,{x:nx,y:-.95,z:nz,rx:36.4,seed:31+i,name:siloNames[i]});
  {const fa=Math.atan2(nx,nz)+(i%2?.7:-.7);makeWaterfall(arena,{x:nx,y:-1.2,z:nz,angle:fa,radius:36.6,width:2.6,height:44,drift:1.6,name:siloNames[i]+' island waterfall'});}
  ring(nx,.1,nz,34,mats.edge,.35);ring(nx,.1,nz,16,mats.roof,.2);
  // Tree groves on the island rim (decorative, no colliders), clear of the landing pad (+x) and the causeway head.
  {const random=rng(70+i),inward=Math.atan2(-nz,-nx),kinds=['round','cypress','blossom','pine','poplar'],grove=[];for(const base of [inward+1.25,inward+2.45,inward-1.55,inward-2.55]){for(let k=0;k<3;k++){const a=base+(k-1)*.13+(random()-.5)*.05,r=25+k%2*3.5+random()*2,gx=Math.cos(a)*r,gz=Math.sin(a)*r;if(gx>12&&Math.abs(gz)<9)continue;grove.push({x:nx+gx,y:0,z:nz+gz,kind:kinds[Math.floor(random()*kinds.length)],size:.72+random()*.38,ry:random()*6});}}treeCrowns(arena,mats,grove,{trunks:true,name:siloNames[i]+' grove'});}
  outposts.push({x:nx,y:0,z:nz,radius:36,label:siloNames[i]});

 }
 for(const o of outposts){
  const d=Math.hypot(o.x,o.z),ux=o.x/d,uz=o.z/d,a={x:ux*101,y:0,z:uz*101},b={x:o.x-ux*30,y:0,z:o.z-uz*30},length=Math.hypot(b.x-a.x,b.z-a.z),angle=Math.atan2(ux,uz);
  const deck=box((a.x+b.x)/2,-.7,(a.z+b.z)/2,12,1.4,length,mats.paving,true);deck.rotation.y=angle;deck.userData.place=o.label+' causeway';
  for(const side of [-1,1]){const rail=box((a.x+b.x)/2+uz*side*5.8,.7,(a.z+b.z)/2-ux*side*5.8,.6,1.4,length,mats.edge,true);rail.rotation.y=angle;}
  for(let t=8;t<length;t+=16){const x=a.x+ux*t,z=a.z+uz*t;const rib=box(x,-2,z,13,2,1.1,mats.stone);rib.rotation.y=angle;for(const side of [-1,1])mesh(new T.ConeGeometry(1.3,5,4),mats.soil,x+uz*side*4,-4,z-ux*side*4);}
  bridges.push({a,b,width:12});
 }
 const ringTrees=[];for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/6,r=54,x=Math.cos(a)*r,z=Math.sin(a)*r;mesh(new T.CylinderGeometry(2.3,2.3,.25,8),mats.grass,x,.12,z);mesh(new T.CylinderGeometry(.24,.45,3,6),mats.bark,x,1.5,z,true);ringTrees.push({x,y:0,z,kind:['round','cypress','blossom','pine','poplar','blossom'][i%6],size:i%6===3?.95:1,ry:a});}
 treeCrowns(arena,mats,ringTrees,{name:'Ring garden trees'});
 const castlePads=castles.map((_,i)=>{const [x,y,z]=transform(i,[22,.77,74]);return {name:i?'Dusk castle':'Dawn castle',x,y,z,r:6,home:true};});
 const pads=[...castlePads,{name:'Arena west',x:-76,y:0,z:0,r:6},{name:'Arena east',x:76,y:0,z:0,r:6},{name:'Arena south',x:0,y:0,z:76,r:6},{name:'Arena north',x:0,y:0,z:-76,r:6} ,...outposts.map((o,i)=>({name:o.label+' landing',x:o.x+22,y:0,z:o.z,r:5}))],glows=[];
 // Launch pads: stone dais, brass ring, pixel rune disc and the original cyan glow ring for readability.
 const runeTexture=(()=>{if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');if(!g?.fillRect)return null;g.clearRect(0,0,64,64);const dot=(x,y,col)=>{g.fillStyle=col;g.fillRect(x,y,1,1);};
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const r=Math.hypot(x-31.5,y-31.5),a=Math.atan2(y-31.5,x-31.5);if(r>29&&r<31)dot(x,y,'#e7b766');else if(r>24&&r<27&&((Math.floor((a+Math.PI)/(Math.PI/12))%2)||r<25))dot(x,y,'#9ff7ec');else if(r<9&&(Math.abs(x-31.5)<1.5||Math.abs(y-31.5)<1.5))dot(x,y,'#e7b766');else if(r>13&&r<15)dot(x,y,'#e7b766');}
  for(let k=0;k<8;k++){const a=k*Math.PI/4,cx=Math.round(31.5+Math.cos(a)*19.5),cy=Math.round(31.5+Math.sin(a)*19.5);for(const [dx,dy] of [[0,-2],[0,-1],[0,0],[0,1],[0,2],[-1,k%2?-2:2],[1,k%2?0:-1]])dot(cx+dx,cy+dy,'#9ff7ec');}
  const t=new T.CanvasTexture(c);t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;t.encoding=T.sRGBEncoding;return t;})();
 const daisGeometry=new T.CylinderGeometry(1,1.06,1,24),runeMaterial=runeTexture?new T.MeshBasicMaterial({map:runeTexture,transparent:true,alphaTest:.5,depthWrite:false}):null;
 for(const [i,p] of pads.entries()){const emissive=new T.MeshBasicMaterial({color:i===1?0xd3b1f6:0x82f3ee});const dais=mesh(daisGeometry,mats.edge,p.x,p.y+.03,p.z);dais.scale.set(p.r+.7,.12,p.r+.7);dais.rotation.y=i*.4;ring(p.x,p.y+.11,p.z,p.r,emissive,.12);ring(p.x,p.y+.12,p.z,p.r-.55,mats.brass,.2);
  if(runeMaterial){const rune=mesh(new T.CircleGeometry(p.r-.8,32),runeMaterial,p.x,p.y+.1,p.z);rune.rotation.x=-Math.PI/2;rune.rotation.z=i*.7;}glows.push(mesh(new T.OctahedronGeometry(.55,0),emissive,p.x,p.y+1.1,p.z));}
 const skyLayers=createSkyLayers(scene),clouds=skyLayers.group;
 const garden=arenaGarden(arena,mats);solids.push(...garden.solids);orbTowers.push({...garden.core,structureRoot:[garden.core.root,garden.pedestal,garden.island,garden.rock],x:0,y:-12,z:0,index:5,damage:360,label:'CROWN',radius:15});
 // Chimney smoke: one pooled instanced mesh, 3 puffs per chimney, outside world.arena (no allegiance/cutaway passes).
 // Same look as the battle FX puffs: opaque faceted puffs with a baked light top / grey underside, thinned by a
 // per-instance screen-door dither fade (no alpha blending, no flat hexagon stickers).
 const smokeRoot=new T.Group();smokeRoot.name='Village chimney smoke';smokeRoot.userData.visualEffect=true;scene.add(smokeRoot);
 const smokeGeometry=new T.IcosahedronGeometry(1,1),smokeShade=new Float32Array(smokeGeometry.attributes.position.count*3),smokeFade=new T.InstancedBufferAttribute(new Float32Array(chimneys.length*3).fill(1),1).setUsage(T.DynamicDrawUsage);
 for(let i=0,P=smokeGeometry.attributes.position;i<P.count;i+=3){const ny=(P.getY(i)+P.getY(i+1)+P.getY(i+2))/3,k=ny>.35?1:ny>-.25?.84:.66;smokeShade.fill(k,i*3,i*3+9);}
 smokeGeometry.setAttribute('color',new T.BufferAttribute(smokeShade,3));smokeGeometry.setAttribute('smokeFade',smokeFade);
 const smokeMaterial=new T.MeshBasicMaterial({color:0xece6da,vertexColors:true});smokeMaterial.onBeforeCompile=s=>{s.vertexShader='attribute float smokeFade;\nvarying float vSmokeFade;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vSmokeFade=smokeFade;');s.fragmentShader='varying float vSmokeFade;\nfloat smokeBayer(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}\n'+s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(vSmokeFade<=smokeBayer(gl_FragCoord.xy*.5)*.25+smokeBayer(gl_FragCoord.xy)+.03)discard;');};smokeMaterial.customProgramCacheKey=()=>'aerie-chimney-smoke-dither-v1';
 const smoke=new T.InstancedMesh(smokeGeometry,smokeMaterial,chimneys.length*3);smoke.name='Chimney smoke puffs';smoke.frustumCulled=false;smoke.instanceMatrix.setUsage(T.DynamicDrawUsage);smokeRoot.add(smoke);
 const puff=new T.Object3D(),lanternDay=new T.Color(0xc9a060),lanternNight=new T.Color(0xffde85),windowDay=new T.Color(0x56627e),windowNight=new T.Color(0xffc96a);
 (scene.userData.skyTint||(scene.userData.skyTint=[])).push(skyLight,preset=>{const glow=Math.max(0,Math.min(1,((preset?.lanterns??.35)-.35)/.65));lanternMaterial.color.copy(lanternDay).lerp(lanternNight,glow);windowMaterial.color.copy(windowDay).lerp(windowNight,glow*glow);smoke.material.color.setHex(preset?.smoke??0xece6da);});
 // Protector/citadel rigs are cached instead of traversing both castles every frame; the cache
 // rebuilds when a castle's child count changes, a cached rig is detached, or every 2 s.
 const rigs=[],rigCounts=castles.map(()=>-1);let rigStamp=-Infinity;
 function rigList(time){let stale=time-rigStamp>2||time<rigStamp;for(let i=0;i<castles.length;i++)if(castles[i].children.length!==rigCounts[i])stale=true;for(let i=0;i<rigs.length&&!stale;i++)if(!rigs[i].object.parent)stale=true;
  if(stale){rigs.length=0;for(const castle of castles)castle.traverse(o=>{if(o.protectorRig)rigs.push({object:o,rig:o.protectorRig});if(o.citadelRig)rigs.push({object:o,rig:o.citadelRig});});castles.forEach((c,i)=>rigCounts[i]=c.children.length);rigStamp=time;}return rigs;}
 const animatedOrbs=[...orbTowers.slice(0,4),...castleHearts];
 function animate(time){for(const orb of animatedOrbs)orb.update(time);for(const r of rigList(time))r.rig.update(time);for(const harbor of harbors)harbor.update(time);garden.update(time);skyLayers.update(time);
  for(let c=0,n=0;c<chimneys.length;c++)for(let j=0;j<3;j++,n++){const s=chimneys[c],phase=(time*.16+j/3+c*.37)%1,grow=.35+phase*.9;puff.position.set(s.x+phase*2.6+Math.sin(time*.7+c+j)*.25,s.y+phase*7,s.z+phase*1.1);puff.rotation.set(phase*2+c,j,0);puff.scale.setScalar(grow*(phase>.85?(1-phase)/.15:1));puff.updateMatrix();smoke.setMatrixAt(n,puff.matrix);smokeFade.array[n]=Math.min(1,phase*7)*(.95-phase*.55);}
  smoke.instanceMatrix.needsUpdate=true;smokeFade.needsUpdate=true;}
 for(let team=0;team<2;team++){const p=pads[team],sign=team?-1:1;const bridge=box(p.x+sign*16,p.y-.65,p.z,32,1.3,8,mats.paving,true);bridge.userData.castleIndex=team;bridge.userData.place='Fleet boarding pier';}
 const occluders=[...solids,...harbors.flatMap(h=>h.occluders)];for(const castle of castles)castle.traverse(m=>{if(m.userData.visualOccluder)occluders.push(m);});
 scene.updateMatrixWorld(true);return {mats,tiles,lighting,pairs,castles,castle:castles[0],solids,occluders,route,routes,pads,glows,clouds,skyLayers,smoke,lanterns,arena,houses,orbTowers,castleHearts,harbors,garden,outposts,bridges,animate,ring:{inner:47,outer:108,y:0},origins};
}
