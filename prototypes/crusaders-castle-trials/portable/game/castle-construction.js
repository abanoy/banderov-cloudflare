import {sketchDefense} from './sketch-defense.js';
import {chargeOrb} from './charge-orb.js';
import {protectorLimit,inspectProtectorLinks,addProtectorBeams} from './castle-protectors.js';
import * as T from '../vendor/three.module.js';
import {profile,containsCell,footprint,stairClearances,MAX_PARTS} from './castle-rules.js';
import {templateCatalog,buildTemplate} from './castle-templates.js';
import {roundFootprint,roundSlab,curvedWallGeometry,embankmentGeometry,CURVE_SEGMENTS,BANK_HEIGHT} from './castle-curves.js';
import {deriveTileFits} from './castle-affordances.js';

export const GRID=12,CELL=8,LAYERS=10;
export {MAX_PARTS};
export const PARTS=Object.freeze([
 {id:'terrace',label:'Stone terrace',symbol:'▰',color:'#b8c4ca',help:'A solid masonry tier up to this layer. Explicit lower stairs and landings keep their passage space.'},
 {id:'roundTerrace',label:'Round bastion',symbol:'●',color:'#b8c4ca',help:'An eight-metre circular stone tier with matching round collision. Its square corners remain empty.'},
 {id:'curvedWall',label:'Curved wall',symbol:'◔',color:'#cdbd9c',help:'A quarter-circle curtain wall on a round bastion. Rotate to choose the closed corner.'},
 {id:'embankment',label:'Earth & stone bank',symbol:'◢',color:'#a99b83',help:'A rough half-wall-height bank with a retaining toe that blocks walking. Rotate its high edge toward the wall; keep gates clear.'},
 {id:'floor',label:'Stone floor',symbol:'▧',color:'#b8b1a2',help:'A walkable floor with open vaulted supports. Use Stone terrace for solid tiers.'},
 {id:'wall',label:'Curtain wall',symbol:'▬',color:'#cdbd9c',help:'A high wall with crenellations. Rotate to run across or along the grid.'},
 {id:'gate',label:'Open gate',symbol:'∩',color:'#ead9aa',help:'A genuine six-metre opening through the wall.'},
 {id:'tower',label:'Armed watchtower',symbol:'♜',color:'#9faeba',help:'Owner sketch watchtower: an armed roof eight metres above this layer. Connect real stairs and a landing.'},
 {id:'stairs',label:'Stair ramp',symbol:'↗',color:'#c4b797',help:'Ascends one full layer toward the top of the grid; rotate to change direction.'},
 {id:'cannon',label:'Repeating bow',symbol:'⊙',color:'#78bec7',help:'A charged twin-barrel defense for the local practice drill.'},
 {id:'trebuchet',label:'Trebuchet',symbol:'T',color:'#cdaa68',help:'A paid counterweight siege engine with collision-checked explosive stone arcs.'},
 {id:'heavyCannon',label:'Heavy cannon',symbol:'✦',color:'#bba0d4',help:'A larger twin-barrel defense. All defenses are unlocked in this local test.'},
 {id:'roof',label:'Pitched roof',symbol:'⌂',color:'#598f9a',help:'A faceted tiled roof for the top of a room or tower.'},
 {id:'house',label:'Castle house',symbol:'⌂',color:'#c4b690',help:'A small stone dwelling with a tiled roof. Leave its surrounding court and stairs open.'},
 {id:'spawn',label:'Arrival court',symbol:'✥',color:'#b8fff2',help:'A walkable arrival tile. AI uses checked, separated courts as alternate spawn points.'},
 {id:'garden',label:'Garden court',symbol:'♣',color:'#83a478',help:'A planted court with a low stone planter and a small tree.'},
 {id:'battlement',label:'Rampart walk',symbol:'▥',color:'#bcc8ca',help:'A walkable terrace with a low stone parapet along its rear edge. Rotate toward the outside.'},
 {id:'deck',label:'Harbor deck',symbol:'▤',color:'#ab865f',help:'A timber-planked walkable deck with small docking bollards.'},
 {id:'beacon',label:'Signal beacon',symbol:'✧',color:'#8edace',help:'A tall signal lantern. Its pulse is a local visual defense preview.'},
 {id:'protector',label:'Protector core',symbol:'✺',color:'#d9fcef',help:'A small shield heart beaming directly to the main crown. One unlock every 20 levels; walls and curved pieces can interrupt its beam.'},
 {id:'core',label:'Castle heart',symbol:'◉',color:'#b3e6de',help:'One secured heart per castle. Its large crown extends over neighbouring tiles.'}
]);
const TYPES=new Set(PARTS.map(p=>p.id)),BASE=.77;

function validated(layout,config=profile()){
 if(!Array.isArray(layout)||layout.length>MAX_PARTS)throw new Error('Use at most '+MAX_PARTS+' castle pieces.');
 const cells=new Set();let cores=0,protectors=0;
 return layout.map(p=>{
  if(!p||!['x','z','layer','rotation'].every(k=>Number.isFinite(p[k])&&Number.isInteger(p[k]))||!containsCell(p,config)||p.layer<0||p.layer>=LAYERS||p.rotation<0||p.rotation>3||!TYPES.has(p.type))throw new Error('A castle piece is outside the build grid or has an unknown type.');
  const key=p.x+':'+p.z+':'+p.layer;if(cells.has(key))throw new Error('Only one piece fits each cell on each layer.');cells.add(key);
  if(p.type==='protector'&&++protectors>protectorLimit(config.level))throw new Error('Protector cores unlock at levels 20, 40, 60, 80, and twice at 100. This level allows '+protectorLimit(config.level)+'.');
  if(p.type==='core'&&++cores>1)throw new Error('Each castle has one secured heart.');
  if(p.solid!==undefined&&typeof p.solid!=='boolean')throw new Error('Solid masonry must be a boolean choice.');
  if(p.footprint!==undefined&&p.footprint!=='round')throw new Error('The optional castle footprint must be round.');
  return {x:p.x,z:p.z,layer:p.layer,type:p.type,rotation:p.rotation,...(p.solid?{solid:true}:{}),...(p.footprint?{footprint:'round'}:{})};
 });
}
function removeSet(array,set){let write=0;for(const item of array)if(!set.has(item))array[write++]=item;array.length=write;}
function descendants(roots){const found=new Set();for(const root of roots)root.traverse(o=>found.add(o));return found;}

// Presets are fresh editable data, never shared mutable scene state.
export function presets(name='courtyard',options){
 if(!['courtyard','citadel','twinkeeps'].includes(name))throw new Error('Unknown castle preset.');
 const config=profile(options),left=config.minX,right=config.maxX-1,back=config.minZ,front=config.maxZ-1;
 const records=new Map(),put=(x,z,layer,type,rotation=0)=>records.set(x+':'+z+':'+layer,{x,z,layer,type,rotation});
 for(let x=left;x<=right;x++){put(x,back,0,'wall');put(x,front,0,x===8?'gate':'wall');}
 for(let z=back;z<=front;z++){put(left,z,0,'wall',1);put(right,z,0,'wall',1);}
 for(const x of [left,right])for(const z of [back,front]){put(x,z,0,'tower');put(x,z,1,'cannon',z===front?0:2);}
 for(const [x,z] of [[left+2,back+3],[right-2,back+3],[left+2,8],[right-2,8]])put(x,z,0,'garden');
 for(const [x,z,rotation] of [[left+3,back+1,2],[right-3,back+1,2],[left+1,6,3],[right-1,6,1]])put(x,z,0,'cannon',rotation);
 // The front aisle remains open from the pod apron through the east-of-centre gate.
 // A two-cell stair flight reaches the keep terrace at layer two.
 for(let x=3;x<=8;x++)for(let z=2;z<=6;z++)put(x,z,2,'floor');
 put(8,8,0,'stairs');put(8,7,1,'stairs');
 for(const [x,z] of [[3,2],[8,2],[3,6],[8,5]]){put(x,z,2,'tower');put(x,z,3,'roof');}
 put(5,3,3,'core');
 if(name==='citadel'||name==='twinkeeps'){
  for(const x of [left,right])for(const z of [back,front]){put(x,z,1,'tower');put(x,z,2,'heavyCannon',z===front?0:2);}
  for(let x=4;x<=7;x++)for(let z=2;z<=5;z++)put(x,z,4,'floor');
  for(const [x,z] of [[8,7],[8,8],[7,8]])put(x,z,2,'floor');
  put(7,7,2,'stairs');put(7,6,3,'stairs');
  records.delete('5:3:3');put(5,3,5,'core');
  for(const [x,z] of [[4,2],[7,2],[4,5],[6,5]]){put(x,z,4,'tower');put(x,z,5,'heavyCannon',z===2?2:0);}
 }
 if(config.size>12&&(name==='citadel'||name==='twinkeeps')){
  const wingWidth=config.size>=20?5:3,wingBack=back+3;
  for(const [startX,height] of [[left+2,3],[right-wingWidth-1,name==='twinkeeps'?6:4]]){
   for(let level=1;level<=height;level++)for(let x=startX;x<startX+wingWidth;x++)for(let z=wingBack;z<wingBack+wingWidth;z++)put(x,z,level,'floor');
   for(let layer=0;layer<height;layer++)put(startX+wingWidth-1,wingBack+wingWidth+height-1-layer,layer,'stairs');
   for(const x of [startX,startX+wingWidth-1])for(const z of [wingBack,wingBack+wingWidth-1])if(!(x===startX+wingWidth-1&&z===wingBack+wingWidth-1)){put(x,z,height,'tower');put(x,z,height+1,'roof');}
   put(startX+Math.floor(wingWidth/2),wingBack,height,'heavyCannon',2);
  }
 }
 return validated([...records.values()].filter(p=>containsCell(p,config)),config);
}

export function createConstruction(world){
 const {mats,castles,solids,occluders,castleHearts}=world,materialCache=new Map();
 function materialsFor(config){
  if(materialCache.has(config.material))return materialCache.get(config.material);
  function variant(source,color,scale){const m=source.clone();m.color.set(color).convertSRGBToLinear();const previous=source.onBeforeCompile,key=source.customProgramCacheKey();m.onBeforeCompile=shader=>{previous(shader);if(scale&&shader.uniforms.tileScale)shader.uniforms.tileScale={value:scale};};m.customProgramCacheKey=()=>key+'-castle-'+config.material+'-'+scale;return m;}
  const kind=config.material,wood=kind==='wood',stone=kind==='stone',brick=kind==='brick',result={...mats,
   stone:variant(wood?mats.bark:mats.stone,wood?'#9b7453':stone?'#aab2ac':brick?'#bf8068':'#b8c4ca',brick?.28:stone?.09:wood?.22:.105),
   paving:variant(wood?mats.bark:mats.paving,wood?'#b99266':brick?'#b69379':stone?'#aab2ad':'#adb9bd',wood?.2:.12),
   edge:variant(wood?mats.bark:mats.edge,wood?'#6b5143':brick?'#e1c19b':stone?'#c6c8b5':'#dfdcc3',wood?.22:.18),bank:variant(mats.soil,'#c2b6a1',.1)};
  result.bank.vertexColors=true;
  for(const role of ['stone','paving','edge','bank']){result[role].name='castle-'+kind+'-'+role;result[role].userData.castleMaterial=kind;result[role].userData.castleRole=role;}materialCache.set(kind,result);return result;
 }
 const states=castles.map((castle,home)=>{
  const originals=castle.children.slice(0,2),owned=descendants(originals),heart=castleHearts[home],heartMaterials=[];heart.root.traverse(o=>heartMaterials.push(o.material||null));
  const harbor=world.harbors?.[home]?.root;
  return {castle,home,originals,visible:originals.map(o=>o.visible),originalSolids:solids.filter(o=>owned.has(o)),originalOccluders:occluders.filter(o=>owned.has(o)),heart,heartMaterials,heartPosition:heart.root.position.clone(),harbor,harborX:harbor?.position.x??0,built:null,layout:null,config:null};
 });
 function at(home){if(!Number.isInteger(home)||!states[home])throw new Error('Choose Dawn or Dusk castle.');return states[home];}
 function build(home,layout,config){
  const mats=materialsFor(config),bounds=footprint(config),clearances=stairClearances(layout),clearanceMap=new Map(clearances.map(c=>[c.x+':'+c.z+':'+c.layer,c])),pieceMap=new Map(layout.map(p=>[p.x+':'+p.z+':'+p.layer,p]));
  const root=new T.Group();root.name='Player-built '+(home?'Dusk':'Dawn')+' castle';root.userData.place=(home?'Dusk':'Dawn')+' custom castle';
  const fitting=deriveTileFits(layout,config);root.userData.profile={...config};root.userData.stairClearances=clearances;root.userData.adjustments=fitting.adjustments;
  const ownedMaterials=new Set();
  const colliders=[],geometries=new Set(),cache=new Map(),batches=new Map(),dummy=new T.Object3D(),roof=home?mats.roofB:mats.roof;
  const own=g=>{if(g)geometries.add(g);return g;},unit=own(new T.BoxGeometry(1,1,1));
  function geometry(key,make){if(!cache.has(key))cache.set(key,own(make()));return cache.get(key);}
  function mesh(group,g,material,x,y,z,solid=false){const o=new T.Mesh(g,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);if(solid){o.userData.structure=true;o.userData.construction=true;o.userData.castleIndex=home;o.userData.place=root.userData.place;colliders.push(o);}return o;}
  function box(group,x,y,z,w,h,d,material=mats.stone,solid=false){const o=mesh(group,unit,material,x,y,z,solid);o.scale.set(w,h,d);return o;}
  // The many small seams, crenels and window frames share instanced draws.
  function trim(group,x,y,z,w,h,d,material=mats.edge,ry=0,rz=0){
   group.updateWorldMatrix(true,false);dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz);dummy.scale.set(w,h,d);dummy.updateMatrix();
   const matrix=new T.Matrix4().multiplyMatrices(group.matrixWorld,dummy.matrix);let batch=batches.get(material);if(!batch)batches.set(material,batch=[]);batch.push(matrix);
  }
  function cylinder(group,x,y,z,top,bottom,height,material=mats.stone,solid=false,n=8){return mesh(group,geometry('c'+[top,bottom,height,n].join(','),()=>new T.CylinderGeometry(top,bottom,height,n)),material,x,y,z,solid);}
  function floor(group,p){
   const depth=p.layer?(config.material==='wood'?.65:1.2):.56,opening=clearanceMap.get(p.x+':'+p.z+':'+p.layer),parts=[];
   const deck=new T.Group();deck.rotation.y=-group.rotation.y;group.add(deck);
   if(opening){const holes=[[-3.8,3.8,-4,1],[-4,1,-3.8,3.8],[-3.8,3.8,-1,4],[-1,4,-3.8,3.8]],a=holes[opening.rotation];parts.push([-4,4,-4,a[2]],[-4,4,a[3],4],[-4,a[0],a[2],a[3]],[a[1],4,a[2],a[3]]);group.userData.stairOpening={...opening};}
   else parts.push([-4,4,-4,4]);
   const round=roundFootprint(p);group.userData.footprint=round?'round':'square';
   for(const [x0,x1,z0,z1] of parts)if(x1-x0>.001&&z1-z0>.001){
    let slab;if(round){const g=geometry('roundSlab:'+depth+':'+[x0,x1,z0,z1].join(','),()=>roundSlab(depth,[x0,x1,z0,z1]));if(!g)continue;slab=mesh(deck,g,p.type==='deck'?mats.bark:mats.paving,0,0,0,true);}
    else slab=box(deck,(x0+x1)/2,-depth/2,(z0+z1)/2,x1-x0,depth,z1-z0,p.type==='deck'?mats.bark:mats.paving,true);
    slab.userData.floorDepth=depth;slab.userData.stairOpening=!!opening;slab.userData.footprint=round?'round':'square';
   }
   if(!opening&&round){const rim=mesh(deck,geometry('roundRim',()=>new T.RingGeometry(3.82,4,CURVE_SEGMENTS)),mats.edge,0,.018,0);rim.rotation.x=-Math.PI/2;}
   else if(!opening){for(const side of [-1,1])trim(deck,side*3.88,.018,0,.12,.04,7.8,mats.edge);trim(deck,0,.018,0,7.8,.04,.1,mats.edge);}
  }
  function crenels(group,y){for(const x of [-3.2,0,3.2])trim(group,x,y,0,1.5,1.1,3.45);}
  function wall(group,gate=false,fit){
   const depth=config.material==='wood'?1.6:3.2,body=(x,y,w,h,role)=>{const o=box(group,x,y,0,w,h,depth,mats.stone,true);o.userData.wallDepth=depth;o.userData.wallRole=role;return o;};
   const [negative,positive]=gate?[0,0]:fit.wallExtensions,width=8+negative+positive,centre=(positive-negative)/2;
   if(gate){for(const x of [-3.5,3.5])body(x,3.4,1,6.8,'gate pier');body(0,6.8,8,1.2,'gate lintel');for(const z of [-1.73,1.73]){for(const side of [-1,1])trim(group,side*3,3.05,z,.2,6.1,.2,mats.edge);trim(group,0,6.15,z,6.3,.3,.2,mats.edge);}}
   else{const face=depth/2+.02;body(centre,3.7,width,7.4,'curtain wall');for(const z of [-face,face])for(const x of [-2.4,2.4]){trim(group,x,4.3,z,.32,2.2,.06,mats.dark);trim(group,x,3.15,z,.65,.16,.12);}}
   for(const y of [.2,6.8])trim(group,centre,y,0,width,.35,depth+.3,mats.edge);crenels(group,7.7);
   if(negative)trim(group,-4-negative+.75,7.7,0,1.5,1.1,depth+.25);if(positive)trim(group,4+positive-.75,7.7,0,1.5,1.1,depth+.25);
  }
  function armory(group,type,p){
   const dirs=[[0,-1],[-1,0],[0,1],[1,0]],openSides=dirs.flatMap(([dx,dz],side)=>layout.some(q=>q.x===p.x+dx&&q.z===p.z+dz&&((q.layer===p.layer+1&&!['wall','house','tower','roof'].includes(q.type))||(q.layer===p.layer&&q.type==='stairs')))?[side]:[]).map(side=>(side-group.userData.effectiveRotation+4)%4),armed=type!=='tower'||!pieceMap.has(p.x+':'+p.z+':'+(p.layer+1)),rig=sketchDefense(type,mats,{openSides,armed});
   group.add(rig.root);for(const m of rig.ownedMaterials||[])ownedMaterials.add(m);group.sketchRig=rig;group.userData.sketchType=type;
   rig.root.traverse(o=>{if(o.isMesh)own(o.geometry);});
   for(const o of rig.solids){o.userData.structure=true;o.userData.construction=true;o.userData.castleIndex=home;o.userData.place=root.userData.place;colliders.push(o);}
   if(type!=='tower'){
    // Match the visible base/plinth; keep a clear perimeter for operator approach.
    const size=type==='trebuchet'?4.06:5;
    const base=box(group,0,.18,0,size,.36,size,mats.paving,true);base.userData.emplacementBase=true;
   }
   if(armed){group.userData.defense={...rig.metadata,entry:type==='tower'?[dirs[openSides[0]??0][0]*3,8,dirs[openSides[0]??0][1]*3]:[3,0,0]};}
  }
  function tower(group){
   cylinder(group,0,3.8,0,3.15,3.5,7.6,mats.stone,true);cylinder(group,0,7.8,0,3.85,3.65,.4,mats.paving,true);
   for(const y of [.2,3.8,7.45])cylinder(group,0,y,0,3.58,3.58,.28,mats.edge);
   for(let i=0;i<8;i++){const a=i*Math.PI/4;trim(group,Math.sin(a)*3.45,8.5,Math.cos(a)*3.45,1.2,1,1.1,mats.edge,a);trim(group,Math.sin(a)*3.22,4.8,Math.cos(a)*3.22,.35,2,.08,mats.dark,a);}
  }
  function stairs(group){
   const g=geometry('stairs',()=>{const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-3.8,0,4,3.8,0,4,3.8,0,-4,-3.8,0,-4,-3.8,8,-4,3.8,8,-4],3));geo.setIndex([0,3,2,0,2,1,0,1,5,0,5,4,0,4,3,1,2,5,3,4,5,3,5,2]);geo.computeVertexNormals();return geo;});
   mesh(group,g,mats.paving,0,0,0,true);
   for(let i=0;i<16;i++)trim(group,0,(i+.5)*.5+.025,4-(i+.5)*.5,7.65,.05,.12,mats.edge);
   for(const side of [-1,1]){const rail=box(group,side*3.75,4.18,0,.24,.38,Math.hypot(8,8),mats.edge);rail.rotation.x=Math.PI/4;}
  }
  function cannon(group,heavy){
   const scale=heavy?.95:.7,gun=new T.Group();gun.scale.setScalar(scale);group.add(gun);
   group.userData.defense={type:heavy?'heavyCannon':'cannon',muzzle:[0,2.69*scale,3.9*scale],direction:[0,0,1]};
   cylinder(gun,0,.65,0,2.1,2.6,1.3,mats.stone,true);cylinder(gun,0,1.5,0,1.8,2.1,.45,mats.edge);
   box(gun,0,2,0,2.6,1.3,2.7,mats.bark);for(const side of [-1,1]){
    const barrel=cylinder(gun,side*.69,2.5,1.4,.38,.58,4.7,mats.dark);barrel.rotation.x=Math.PI/2-.08;
    const ring=mesh(gun,geometry('muzzle',()=>new T.TorusGeometry(.41,.13,5,12)),mats.edge,side*.69,2.69,3.75);
    const mouth=mesh(gun,geometry('mouth',()=>new T.CircleGeometry(.32,12)),mats.dark,side*.69,2.69,3.79);mouth.rotation.x=-.08;ring.rotation.x=-.08;
    trim(gun,side*1.45,2.2,-.3,.45,1.5,1.9,mats.edge);
   }
   mesh(gun,geometry('battery',()=>new T.IcosahedronGeometry(.78,1)),roof,0,2.7,-1.1);
   if(heavy){for(const side of [-1,1])box(gun,side*2,1.75,-1,1,1.5,2,mats.dark);cylinder(gun,0,.1,0,3.2,3.2,.2,mats.edge);}
  }
  function garden(group,round=false){
   if(round){cylinder(group,0,.14,0,3.3,3.3,.28,mats.grass,false,CURVE_SEGMENTS);const rim=mesh(group,geometry('roundGardenRim',()=>new T.RingGeometry(3.15,3.5,CURVE_SEGMENTS)),mats.edge,0,.3,0);rim.rotation.x=-Math.PI/2;}
   else{box(group,0,.14,0,6.6,.28,6.6,mats.grass);for(const side of [-1,1]){trim(group,side*3.3,.35,0,.35,.7,6.8);trim(group,0,.35,side*3.3,6.8,.7,.35);}}
   cylinder(group,-1.3,1.6,-1,.18,.32,3.2,mats.bark,true,6);
   for(const [x,y,z,size] of [[-1.3,3.8,-1,1.9],[-2.15,3.2,-.5,1.25],[-.1,3.3,-1.1,1.4],[1.9,.85,1.8,.65],[1,.7,2,.6],[-1.8,.8,2,.65]]){const plant=mesh(group,geometry('leaf',()=>new T.IcosahedronGeometry(1,0)),mats.leaves,x,y,z);plant.scale.setScalar(size);}
  }
  // The front edge stays fixed; the larger plot grows sideways and behind it.
  const {minX,maxX,minZ,maxZ}=bounds,centreZ=(minZ+maxZ)/2,outline=[[minX,minZ+8],[minX+8,minZ],[maxX-8,minZ],[maxX,minZ+8],[maxX,maxZ-8],[maxX-8,maxZ],[minX+8,maxZ],[minX,maxZ-8]],shape=new T.Shape();
  outline.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  // No automatic plot floor: only explicit tile slabs support walking.
  root.userData.explicitFloors=true;
  const rockPositions=[],indices=[],n=outline.length;
  for(const [height,factor] of [[BASE-3.2,1],[-8,.97],[-28,.58],[-39,.13]])for(const [x,z] of outline)rockPositions.push(x*factor,height,(z-centreZ)*factor+centreZ);
  for(let row=0;row<3;row++)for(let j=0;j<n;j++){const a=row*n+j,b=row*n+(j+1)%n,c=(row+1)*n+(j+1)%n,d=(row+1)*n+j;indices.push(a,b,c,a,c,d);}
  const top=rockPositions.length/3;rockPositions.push(0,BASE-3.2,centreZ);const bottom=rockPositions.length/3;rockPositions.push(0,-39,centreZ);
  for(let j=0;j<n;j++){indices.push(top,(j+1)%n,j,bottom,3*n+j,3*n+(j+1)%n);}
  const rock=own(new T.BufferGeometry());rock.setAttribute('position',new T.Float32BufferAttribute(rockPositions,3));rock.setIndex(indices);const rp=rock.attributes.position,ri=rock.index;for(let j=0;j<ri.count;j+=3){const a=new T.Vector3().fromBufferAttribute(rp,ri.getX(j)),b=new T.Vector3().fromBufferAttribute(rp,ri.getX(j+1)),c=new T.Vector3().fromBufferAttribute(rp,ri.getX(j+2)),normal=b.clone().sub(a).cross(c.clone().sub(a)),radial=a.clone().add(b).add(c).multiplyScalar(1/3).sub(new T.Vector3(0,-15,centreZ));if(normal.dot(radial)<0){const k=ri.getX(j+1);ri.setX(j+1,ri.getX(j+2));ri.setX(j+2,k);}}rock.computeVertexNormals();mesh(root,rock,mats.soil,0,-8,0,false);
  for(let i=0;i<n;i++){const a=new T.Vector3(outline[i][0],BASE-1,outline[i][1]),b=new T.Vector3(outline[(i+1)%n][0],BASE-1,outline[(i+1)%n][1]),edge=box(root,(a.x+b.x)/2,a.y,(a.z+b.z)/2,.4,.45,a.distanceTo(b),mats.edge);edge.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);}
  // Elevated blocks form vaulted lower stories. Adjacent blocks share the body,
  // while stair/gate bays stay open instead of gaining thin individual stilts.
  const high=new Map();for(const p of layout){const key=p.x+':'+p.z;if(!high.has(key)||p.layer>high.get(key).layer)high.set(key,p);}
  const solidColumns=new Map();for(const p of layout)if(p.type==='terrace'||p.solid||roundFootprint(p)){const key=p.x+':'+p.z;if(!solidColumns.has(key)||p.layer>solidColumns.get(key).layer)solidColumns.set(key,p);}
  // Terrace cells are closed masonry volumes, not decorative screens hiding
  // beams. Deliberately placed lower rooms/stairs remove complete story bands;
  // the existing rotated floor aperture preserves the stair's upper headroom.
  for(const p of solidColumns.values()){
   const group=new T.Group();group.name='Solid masonry tier';group.position.set((p.x-5.5)*CELL,BASE,(p.z-5.5)*CELL-4);group.userData.solidTerrace=true;group.userData.cell={...p};root.add(group);
   const allowed=[];for(let level=0;level<p.layer;level++){
    const lower=pieceMap.get(p.x+':'+p.z+':'+level);
    if(lower&&lower!==p&&['stairs','floor','deck','roundTerrace','curvedWall','gate','garden','battlement','cannon','heavyCannon','beacon'].includes(lower.type)||clearanceMap.has(p.x+':'+p.z+':'+level))continue;
    allowed.push(level);
   }
   for(let k=0;k<allowed.length;){const first=allowed[k];let last=first;while(k+1<allowed.length&&allowed[k+1]===last+1){last=allowed[++k];}k++;
    const depth=last===p.layer-1&&p.type!=='stairs'?(config.material==='wood'?.65:1.2):0,height=(last-first+1)*8-depth;
    if(height>0){const body=roundFootprint(p)?cylinder(group,0,first*8+height/2,0,4,4,height,mats.stone,true,CURVE_SEGMENTS):box(group,0,first*8+height/2,0,8,height,8,mats.stone,true);body.userData.solidTerrace=true;body.userData.cell={...p};body.userData.tierHeight=p.layer*8;body.userData.footprint=roundFootprint(p)?'round':'square';}
   }
   if(p.type==='stairs'||roundFootprint(p))continue;
   for(const [dx,dz,angle] of [[0,1,0],[1,0,Math.PI/2],[0,-1,Math.PI],[-1,0,-Math.PI/2]]){
    const neighbor=high.get((p.x+dx)+':'+(p.z+dz));if((neighbor?.layer??0)>=p.layer)continue;
    const incoming=layout.some(s=>s.type==='stairs'&&s.layer===p.layer-1&&s.x===p.x+dx&&s.z===p.z+dz&&[[0,-1],[-1,0],[0,1],[1,0]][s.rotation][0]===-dx&&[[0,-1],[-1,0],[0,1],[1,0]][s.rotation][1]===-dz);
    trim(group,dx*3.98,p.layer*8-.3,dz*3.98,8,.55,.22,mats.edge,angle);
    if(!incoming){const rail=box(group,dx*3.7,p.layer*8+.5,dz*3.7,8,1,.6,mats.stone,true);rail.rotation.y=angle;rail.userData.solidTerrace=true;rail.userData.cell={...p};for(const offset of [-3,0,3])trim(group,dx*3.7+Math.cos(angle)*offset,p.layer*8+1.18,dz*3.7-Math.sin(angle)*offset,1.25,.45,.7,mats.edge,angle);}
   }
  }
  function supportGeometry(stories,depth){return geometry('vault:'+stories+':'+depth,()=>{
   const top=stories*8-(config.material==='wood'?.65:1.2),shape=new T.Shape();shape.moveTo(-4,0);shape.lineTo(4,0);shape.lineTo(4,top);shape.lineTo(-4,top);shape.closePath();
   for(let story=0;story<stories;story++){const base=story*8,hole=new T.Path();hole.moveTo(-2.6,base);hole.lineTo(-2.6,base+3.1);if(config.material==='wood'){hole.lineTo(-2.6,base+6.2);hole.lineTo(2.6,base+6.2);}else hole.absarc(0,base+3.1,2.6,Math.PI,0,true);hole.lineTo(2.6,base);hole.closePath();shape.holes.push(hole);}
   return new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:6});
  });}
  const supportDepth=config.material==='wood'?1.4:2.6;
  for(const p of high.values())if(p.layer&&p.type!=='core'&&p.type!=='terrace'&&!p.solid&&!roundFootprint(p)){
   const x=(p.x-5.5)*CELL,z=(p.z-5.5)*CELL-4;
   for(const [dx,dz,angle] of [[0,1,0],[1,0,Math.PI/2],[0,-1,Math.PI],[-1,0,-Math.PI/2]]){
    const neighbor=high.get((p.x+dx)+':'+(p.z+dz)),start=Math.max(solidColumns.get(p.x+':'+p.z)?.layer??0,neighbor?.type==='core'?0:neighbor?.layer??0);if(start>=p.layer)continue;
    const allowed=[];for(let level=start;level<p.layer;level++){const explicit=pieceMap.get(p.x+':'+p.z+':'+level);if(['stairs','gate','tower','wall','core'].includes(explicit?.type)||clearanceMap.has(p.x+':'+p.z+':'+level))continue;allowed.push(level);}
    for(let k=0;k<allowed.length;){const first=allowed[k];let last=first;while(k+1<allowed.length&&allowed[k+1]===last+1){last=allowed[++k];}k++;
     const group=new T.Group();group.position.set(x+dx*(4-supportDepth),BASE+first*8,z+dz*(4-supportDepth));group.rotation.y=angle;root.add(group);
     const wall=mesh(group,supportGeometry(last-first+1,supportDepth),mats.stone,0,0,0,true);wall.userData.supportStyle=config.material==='wood'?'timber hall':'vaulted masonry';wall.userData.supportStories=last-first+1;wall.userData.supportDepth=supportDepth;
     for(let level=0;level<=last-first+1;level++)trim(group,0,level*8-.22,supportDepth+.04,8,.42,.22,mats.edge);
    }
   }
  }
  let chosen=null;
  for(const p of layout){
   const fit=fitting.fits.get(p.x+':'+p.z+':'+p.layer),group=new T.Group();group.position.set((p.x-5.5)*CELL,BASE+p.layer*CELL,(p.z-5.5)*CELL-4);group.rotation.y=fit.rotation*Math.PI/2;group.name=PARTS.find(t=>t.id===p.type).label+' / layer '+(p.layer+1);group.userData.cell={...p};group.userData.fitting=fit;group.userData.effectiveRotation=fit.rotation;root.add(group);
   if(p.type==='core'){floor(group,p);chosen={x:group.position.x,y:group.position.y,z:group.position.z};continue;}
   if(p.type!=='stairs')floor(group,p);
   if(p.type==='wall'||p.type==='gate')wall(group,p.type==='gate',fit);
   else if(p.type==='curvedWall'){
    const body=mesh(group,geometry('curvedWall',()=>curvedWallGeometry()),mats.stone,0,0,0,true);body.userData.wallRole='curved curtain wall';body.userData.wallDepth=3;body.userData.curvedWall={outerRadius:4,innerRadius:1,height:7.4};
    for(const y of [.1,6.9])mesh(group,geometry('curvedCap',()=>curvedWallGeometry(.28)),mats.edge,0,y,0);
    for(const angle of [Math.PI/12,Math.PI/4,5*Math.PI/12])trim(group,Math.cos(angle)*2.5,7.72,Math.sin(angle)*2.5,1.1,.65,2.6,mats.edge,-angle);
   }
   else if(p.type==='embankment'){const variant=((Math.imul(p.x,73856093)^Math.imul(p.z,19349663)^Math.imul(p.layer,83492791))>>>0)%8,bank=mesh(group,geometry('embankment:'+variant,()=>embankmentGeometry(variant)),mats.bank,0,0,0,true);bank.userData.embankment={height:BANK_HEIGHT,toeMinimum:.9,highSide:'-z',footprint:8,colorVariant:variant};}
   else if(p.type==='tower')armory(group,'tower',p);
   else if(p.type==='stairs')stairs(group);
   else if(['cannon','heavyCannon','trebuchet'].includes(p.type))armory(group,p.type,p);
   else if(p.type==='roof'){const cap=mesh(group,geometry('roof',()=>new T.ConeGeometry(5.66,4.7,4)),roof,0,2.35,0,true);cap.rotation.y=Math.PI/4;box(group,0,.12,0,8.15,.25,8.15,mats.edge);}
   else if(p.type==='house'){
    box(group,0,1.6,0,4.1,3.2,4.1,mats.stone,true);for(const x of [-1.5,1.5])trim(group,x,1.7,-2.1,.25,3.1,.18,mats.bark);
    const cap=mesh(group,geometry('houseRoof',()=>new T.ConeGeometry(3.6,2.2,4)),roof,0,4.3,0,true);cap.rotation.y=Math.PI/4;
    box(group,0,1.05,2.09,1.15,2.1,.13,mats.dark);for(const x of [-1.25,1.25])box(group,x,2.1,2.12,.55,.7,.14,mats.sail);
    box(group,1.1,4.5,-.8,.55,2.5,.55,mats.stone);trim(group,0,.2,0,4.5,.4,4.5,mats.edge);
   }
   else if(p.type==='spawn'){
    const ring=mesh(group,geometry('arrivalRing',()=>new T.RingGeometry(1.45,1.7,16)),mats.sail,0,.04,0);ring.rotation.x=-Math.PI/2;group.userData.spawnPoint=true;
    for(const [x,z] of [[-2,-2],[2,-2],[-2,2],[2,2]])cylinder(group,x,.17,z,.15,.2,.34,mats.edge);
   }
   else if(p.type==='garden')garden(group,roundFootprint(p));
   else if(p.type==='battlement'){
    if(fit.parapetGap){const width=(8-fit.parapetGap)/2;for(const side of [-1,1]){const x=side*(4-width/2);box(group,x,1.15,-3.65,width,2.3,.8,mats.stone,true);trim(group,x,2.6,-3.65,width,.7,1);}}
    else{box(group,0,1.15,-3.65,8,2.3,.8,mats.stone,true);for(const x of [-3,0,3])trim(group,x,2.6,-3.65,1.35,.7,1);}
   }
   else if(p.type==='deck'){const round=roundFootprint(p);for(let x=-3;x<=3;x++)trim(group,x,.025,0,.075,.045,round?Math.sqrt(16-x*x)*2-.2:7.8,mats.edge);for(const x of (round?[-2.4,2.4]:[-3.5,3.5])){const z=round?-2.4:-3.5;cylinder(group,x,.45,z,.23,.36,.9,mats.dark);cylinder(group,x,.92,z,.42,.42,.18,mats.edge);}}
   else if(p.type==='protector'){
    cylinder(group,0,.35,0,1.7,2.2,.7,mats.stone,true);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;cylinder(group,Math.sin(a)*1.6,1.5,Math.cos(a)*1.6,.17,.3,2.6,mats.edge,true);}
    const orb=mesh(group,geometry('protectorOrb',()=>new T.IcosahedronGeometry(1.35,1)),mats.sail,0,3.5,0,true);orb.userData.protectorId=home+':'+p.x+':'+p.z+':'+p.layer;orb.userData.protectorTeam=home;
    const ring=mesh(group,geometry('protectorRing',()=>new T.TorusGeometry(2,.15,4,24)),roof,0,3.5,0);ring.rotation.x=1.1;group.userData.protector={id:orb.userData.protectorId,team:home,orb,ring,cell:{...p}};
   }
   else if(p.type==='beacon'){cylinder(group,0,.28,0,1.6,1.9,.56,mats.stone,true);cylinder(group,0,2.5,0,.22,.4,4.5,mats.dark,true);cylinder(group,0,4.5,0,.8,.65,.35,mats.edge);const light=mesh(group,geometry('signal',()=>new T.IcosahedronGeometry(.7,1)),roof,0,5,0);for(let i=0;i<4;i++){const a=i*Math.PI/2;trim(group,Math.sin(a)*.6,4.95,Math.cos(a)*.6,.14,1.25,.14,mats.edge);}group.userData.defense={type:'beacon',muzzle:[0,5.6,0],direction:[0,0,1]};}
  }
  // The original animated crown is preserved and securely reseated, never cloned.
  const hasCore=!!chosen; if(!chosen)chosen={x:0,y:BASE,z:0};
  let heartPosition=new T.Vector3();
  if(hasCore){
  const pedestalHeight=Math.max(.8,chosen.y-BASE+.8),pedestalTop=BASE+pedestalHeight;
  cylinder(root,chosen.x,BASE+pedestalHeight/2,chosen.z,1.7,2.1,pedestalHeight,mats.stone,true);
  cylinder(root,chosen.x,pedestalTop+.35,chosen.z,2.2,2.3,.7,mats.edge,true);
  cylinder(root,chosen.x,pedestalTop+.85,chosen.z,2.1,2.2,.3,mats.paving,true);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;trim(root,chosen.x+Math.sin(a)*1.95,BASE+pedestalHeight*.5,chosen.z+Math.cos(a)*1.95, .2,pedestalHeight,.2,mats.edge,a);}
  heartPosition=new T.Vector3(chosen.x,pedestalTop+1+castleHearts[home].radius*1.59,chosen.z);
  const rig=chargeOrb(root,mats,{x:chosen.x,y:pedestalTop+3.3,z:chosen.z,radius:1.5,crown:true});root.coreRig=rig;rig.root.traverse(o=>{if(o.geometry)own(o.geometry);if(o.material&&!Object.values(mats).includes(o.material))ownedMaterials.add(o.material);});rig.core.userData.structure=true;colliders.push(rig.core);
  }
  for(const [material,matrices] of batches){const instance=new T.InstancedMesh(unit,material,matrices.length);matrices.forEach((matrix,i)=>instance.setMatrixAt(i,matrix));instance.castShadow=true;instance.receiveShadow=true;root.add(instance);}
  root.updateMatrixWorld(true);
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();for(const m of ownedMaterials)m.dispose();}
  const links=inspectProtectorLinks(root,colliders,heartPosition),beams=addProtectorBeams(root,links);
  const originalDispose=dispose;return {root,colliders,geometries,heartPosition,links,adjustments:fitting.adjustments,dispose(){beams.dispose();originalDispose();}};
 }
 function preview(home,input,options){
  const state=at(home),config=profile(options),layout=validated(input,config),built=build(home,layout,config),crown=state.heart.root.clone(true);
  let index=0;crown.traverse(o=>{const material=state.heartMaterials[index++];if(material)o.material=material;delete o.userData.fadeMaterial;});
  crown.visible=!built.root.coreRig&&layout.some(p=>p.type==='core');crown.position.copy(built.heartPosition);crown.name='Preview castle heart';if(!built.root.coreRig&&crown.visible)built.root.add(crown);built.root.userData.preview=true;built.root.updateMatrixWorld(true);
  return {root:built.root,colliders:built.colliders,heartPosition:built.heartPosition,links:built.links,adjustments:built.adjustments,dispose:built.dispose};
 }
 function clearBuilt(state){if(!state.built)return;const old=state.built;removeSet(solids,new Set(old.colliders));removeSet(occluders,new Set(old.colliders));state.castle.remove(old.root);old.dispose();state.built=null;}
 function apply(home,input,options){
  const state=at(home),config=profile(options),layout=validated(input,config);if(!layout.some(p=>p.type==='core'))throw new Error('A built castle requires its main core.');const next=build(home,layout,config);const blocked=next.links.find(l=>!l.linked);if(blocked){next.dispose();throw new Error('Protector beam blocked by '+blocked.blocker+'. Clear its direct line before applying.');}
  clearBuilt(state);for(const original of state.originals)original.visible=false;
  removeSet(solids,new Set(state.originalSolids));removeSet(occluders,new Set(state.originalOccluders));
  state.castle.add(next.root);solids.push(...next.colliders);occluders.push(...next.colliders);state.heart.root.position.copy(next.heartPosition);if(state.harbor)state.harbor.position.x=state.harborX+(config.size-12)*4;state.built=next;state.layout=layout;state.config=config;state.castle.updateMatrixWorld(true);
  return {...counts()[home]};
 }
 function restore(home){const state=at(home);clearBuilt(state);state.originals.forEach((o,i)=>o.visible=state.visible[i]);for(const o of state.originalSolids)if(!solids.includes(o))solids.push(o);for(const o of state.originalOccluders)if(!occluders.includes(o))occluders.push(o);state.heart.root.position.copy(state.heartPosition);if(state.harbor)state.harbor.position.x=state.harborX;state.layout=null;state.config=null;state.castle.updateMatrixWorld(true);return {...counts()[home]};}
 function counts(){return states.map(state=>{const layout=state.layout||[];return {parts:layout.length,layers:layout.length?Math.max(...layout.map(p=>p.layer))+1:0,cannons:layout.filter(p=>p.type==='cannon').length,heavyCannons:layout.filter(p=>p.type==='heavyCannon').length,core:layout.some(p=>p.type==='core'),custom:!!state.built,profile:state.config?{...state.config}:null,config:state.config?{level:state.config.level,material:state.config.material}:null};});}
 return {apply,restore,preview,presets,templates:templateCatalog,template:buildTemplate,get counts(){return counts();}};
}
