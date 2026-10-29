import {citadelBuilding,bevelSlab,corbelGeometry} from './citadel-models.js?v=aerie-20261018';
import {castleTerrainPlan,occupiedCliffGeometries,retainingLipGeometry,roundRetainingGeometry} from './castle-terrain.js';
import {chargeOrb} from './charge-orb.js?v=aerie-20261018';
import {tierFortifications,wallLadderTiles} from './castle-fortifications.js';
import {sketchDefense} from './sketch-defense.js';
import {protectorLimit,inspectProtectorLinks,addProtectorBeams} from './castle-protectors.js?v=aerie-20261018';
import * as T from '../vendor/three.module.js';
import {profile,cellPosition,containsCell,footprint,stairClearances,MAX_PARTS} from './castle-rules.js';
import {templateCatalog,buildTemplate} from './castle-templates.js';
import {roundFootprint,roundSlab,curvedWallGeometry,embankmentGeometry,CURVE_SEGMENTS,BANK_HEIGHT} from './castle-curves.js';
import {deriveTileFits} from './castle-affordances.js?v=aerie-20261018';
import {yieldTask} from './task-yield.js';

export const GRID=12,CELL=8,LAYERS=10;
export {MAX_PARTS};
export const PARTS=Object.freeze([
 {id:'terrace',label:'Stone terrace',symbol:'▰',color:'#b8c4ca',help:'A solid masonry tier up to this layer. Explicit lower stairs and landings keep their passage space.'},
 {id:'roundTerrace',label:'Round bastion',symbol:'●',color:'#b8c4ca',help:'An eight-metre circular stone tier with matching round collision. Its square corners remain empty.'},
 {id:'curvedWall',label:'Curved wall',symbol:'◔',color:'#cdbd9c',help:'A quarter-circle curtain wall on a round bastion. Rotate to choose the closed corner.'},
 {id:'embankment',label:'Earth & stone bank',symbol:'◢',color:'#a99b83',help:'A rough half-wall-height bank with a retaining toe that blocks walking. Rotate its high edge toward the wall; keep gates clear.'},
 {id:'armory',label:'Crown armory',symbol:'⚒',color:'#d2c9ae',help:'A walk-in forge for weapons, ammunition and builder supplies.'},
 {id:'barracks',label:'Recruitment hall',symbol:'⚑',color:'#a4c7d0',help:'Defenders assemble here and walk to their selected battery posts.'},
 {id:'wallBridge',label:'Vaulted wall bridge',symbol:'⌒',color:'#b8c4ca',help:'A bevel-ended stone bridge with curved arch ribs and real collision.'},
 {id:'floor',label:'Stone floor',symbol:'▧',color:'#b8b1a2',help:'A walkable floor with open vaulted supports. Use Stone terrace for solid tiers.'},
 {id:'wall',label:'Curtain wall',symbol:'▬',color:'#cdbd9c',help:'A 4.8-metre-thick curtain with a clear central wall walk and edge parapets. Clear courtyard bays receive leaning siege ladders.'},
 {id:'gate',label:'Gatehouse',symbol:'∩',color:'#ead9aa',help:'A six-metre passage with a 2,000 HP wooden gate in battle. B controls a nearby friendly gate.'},
 {id:'tower',label:'Watchtower',symbol:'♜',color:'#9faeba',help:'Sketch watchtower with an armed roof eight metres above this layer; adjacent landings open its parapets.'},
 {id:'stairs',label:'Stair ramp',symbol:'↗',color:'#c4b797',help:'Ascends one full layer toward the top of the grid; rotate to change direction.'},
 {id:'cannon',label:'Repeating bow',symbol:'⊙',color:'#78bec7',help:'Semi-automatic bolt battery; automatic defense and manual entry.'},
 {id:'heavyCannon',label:'Heavy battery',symbol:'✦',color:'#bba0d4',help:'Sketch cannon battery; heavy shots, magazine and reload.'},
 {id:'trebuchet',label:'Trebuchet',symbol:'⚒',color:'#cdaa68',help:'Counterweight siege engine firing arcing explosive stone shots.'},
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
  if(p.wallBattery!==undefined&&typeof p.wallBattery!=='boolean')throw new Error('Wall battery preference must be boolean.');
  if(p.fortified!==undefined&&typeof p.fortified!=='boolean')throw new Error('Fortified courts must be a boolean choice.');
  return {x:p.x,z:p.z,layer:p.layer,type:p.type,rotation:p.rotation,...(p.solid?{solid:true}:{}),...(p.fortified?{fortified:true}:{}),...(p.wallBattery?{wallBattery:true}:{}),...(p.footprint?{footprint:'round'}:{})};
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
 // build() runs the steps at once; buildAsync() yields to the page between
 // slices of about 8 ms (same result) so loading screens keep animating.
 function build(home,layout,config){const steps=buildSteps(home,layout,config);let r;while(!(r=steps.next()).done);return r.value;}
 async function buildAsync(home,layout,config){const steps=buildSteps(home,layout,config);let r;while(!(r=steps.next()).done)await yieldTask();return r.value;}
 function* buildSteps(home,layout,config){
  let mark=performance.now();
  const ladderTiles=new Set(wallLadderTiles(layout));
  const mats=materialsFor(config),bounds=footprint(config),clearances=stairClearances(layout),clearanceMap=new Map(clearances.map(c=>[c.x+':'+c.z+':'+c.layer,c])),pieceMap=new Map(layout.map(p=>[p.x+':'+p.z+':'+p.layer,p]));
  const root=new T.Group();root.name='Player-built '+(home?'Dusk':'Dawn')+' castle';root.userData.place=(home?'Dusk':'Dawn')+' custom castle';
  if(performance.now()-mark>8){yield;mark=performance.now();}const fitting=deriveTileFits(layout,config);root.userData.profile={...config};root.userData.stairClearances=clearances;root.userData.adjustments=fitting.adjustments;
  const colliders=[],visualOccluders=[],geometries=new Set(),ownedMaterials=new Set(),cache=new Map(),batches=new Map(),decorations=[],dummy=new T.Object3D(),roof=home?mats.roofB:mats.roof;
  const own=g=>{if(g)geometries.add(g);return g;},unit=own(new T.BoxGeometry(1,1,1));
  function geometry(key,make){if(!cache.has(key))cache.set(key,own(make()));return cache.get(key);}
  function mesh(group,g,material,x,y,z,solid=false){const o=new T.Mesh(g,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);if(solid){o.userData.structure=true;o.userData.construction=true;o.userData.castleIndex=home;o.userData.place=root.userData.place;colliders.push(o);}else decorations.push(o);return o;}
  function box(group,x,y,z,w,h,d,material=mats.stone,solid=false){const o=mesh(group,unit,material,x,y,z,solid);o.scale.set(w,h,d);return o;}
  function supportPiers(group,layer,arched=false){
   if(!layer)return;const core=layout.find(p=>p.type==='core'),target=core?cellPosition(core):null;if(target)target.y+=15.156;
   const beams=target?layout.filter(p=>p.type==='protector').map(p=>{const q=cellPosition(p),a=new T.Vector3(q.x,q.y+3.5,q.z),b=new T.Vector3(target.x,target.y,target.z);return {ray:new T.Ray(a,b.clone().sub(a).normalize()),length:a.distanceTo(b)-8.5};}):[];
   const height=arched?Math.min(5,layer*8+.3):layer*8+.3,y=-height/2;group.updateWorldMatrix(true,false);
   const clear=(x,cy,h)=>{const box=new T.Box3(new T.Vector3(x-.5,cy-h/2-.2,-2.6),new T.Vector3(x+.5,cy+h/2+.2,arched?3:-1.1)).applyMatrix4(group.matrixWorld);return beams.every(b=>{const hit=b.ray.intersectBox(box,new T.Vector3());return !hit||hit.distanceTo(b.ray.origin)>b.length;});};
   for(const side of [-1,1]){const x=[3.6].map(n=>side*n).find(x=>clear(x,y,height));if(x!==undefined){const pier=box(group,x,y,-1.85,.7,height,1.1,mats.stone,true);pier.userData.wallSupport=true;if(arched){const brace=mesh(group,geometry('tierCorbel',corbelGeometry),mats.stone,x,-.1,0,true);brace.scale.set(.65,.9,.6);brace.userData.wallSupport=true;}}else{const x=side*3.6;for(let low=y-height/2;low<y+height/2;low+=1){const h=Math.min(1,y+height/2-low);if(clear(x,low+h/2,h)){const pier=box(group,x,low+h/2,-1.85,.7,h,1.1,mats.stone,true);pier.userData.wallSupport=true;}}}}
  }
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
  function woodenGate(group,id){
   const door=box(group,0,3.05,0,6.15,6.1,.55,mats.bark,true);door.name='Wooden gate / 2000 HP';door.visible=false;
   Object.assign(door.userData,{gateLeaf:true,gateId:id,gateTeam:home,gateHp:2000,gateOpen:true});
   for(const x of [-.4,-.2,0,.2,.4]){const line=new T.Mesh(unit,mats.dark);line.position.set(x,0,.51);line.scale.set(.014,.96,.035);door.add(line);}
   for(const y of [-.3,.3]){const band=new T.Mesh(unit,mats.edge);band.position.set(0,y,.52);band.scale.set(.97,.045,.05);door.add(band);}
   return door;
  }
  function gateLandmark(parent,height=3){
   const group=new T.Group();group.position.y=height-3;parent.add(group);parent.userData.gateLandmark=true;
   const cloth=roof.clone();cloth.color.set(home?0x73547f:0x267e8a);ownedMaterials.add(cloth);group.userData.gateLandmark=true;
   for(const x of [-3.55,3.55]){box(group,x,4.9,0,.22,3.8,.22,mats.dark);for(const z of [-2.5,2.5]){box(group,x,4.5,z,.9,2.1,.1,cloth);box(group,x,4.5,z+(z<0?-.07:.07),.17,1.3,.04,mats.edge);}}
   for(const side of [-1,1]){const canopy=box(group,side*2.1,7.05,0,4.6,.28,6.4,cloth);canopy.rotation.z=-side*.25;}box(group,0,7.65,0,.4,.25,6.7,mats.edge);box(group,0,6.7,0,8,.22,.3,mats.dark);const banner=box(group,0,6.03,0,6.3,1.1,.12,cloth);banner.name='Gatehouse standard';for(const x of [-2.5,0,2.5])box(group,x,6.03,-.09,.18,.7,.04,mats.edge);
  }
  function wallLadder(group,height){
   const run=height,length=Math.hypot(height,run),angle=Math.atan2(height,run),z=2.2+run/2;
   const board=box(group,0,height/2+.03,z,2.4,.12,length,mats.bark,true);board.rotation.x=angle;board.userData.wallLadder=true;board.name='Climbable siege ladder';
   for(const x of [-1.12,1.12]){const rail=box(group,x,height/2+.12,z,.16,.22,length+.35,mats.edge);rail.rotation.x=angle;}
   const count=Math.ceil(height/.35);for(let i=0;i<=count;i++){const t=i/count,rung=box(group,0,height*t+.16,2.2+run*(1-t),2.55,.11,.18,mats.edge);rung.rotation.x=angle;}
  }
  function wallWalk(group,height,ladder=false,width=8,centre=0,cuts=[0,0],battery=false){
   const deck=mesh(group,geometry('bevelWalk:'+width,()=>bevelSlab(width,4.8,.07,.55)),mats.paving,centre,height+.07,0,true);deck.userData.wallWalk=true;deck.name='Wall walk / clear central lane';
   const lo=centre-width/2+cuts[0],hi=centre+width/2-cuts[1],rail=(a,b,z)=>{if(b-a>.02){const parapet=box(group,(a+b)/2,height+.5,z,b-a,1,.54,mats.stone,true);parapet.userData.parapet=true;}};if(battery){rail(lo,Math.min(hi,-1.5),-2.13);rail(Math.max(lo,1.5),hi,-2.13);}else rail(lo,hi,-2.13);
   if(ladder){rail(lo,Math.min(hi,-1.5),2.13);rail(Math.max(lo,1.5),hi,2.13);}
   else rail(lo,hi,2.13);
   for(const x of [-3,0,3])for(const z of [-2.13,2.13]){if(x<lo||x>hi||(ladder&&z>0||battery&&z<0)&&x===0)continue;trim(group,x,height+1.2,z,1.4,.45,.65,mats.edge);}
   if(ladder)wallLadder(group,height+.07);
  }
  function wall(group,gate=false,fit,ladder=false,walk=true){
   const depth=4.8,body=(x,y,w,h,role)=>{const o=box(group,x,y,0,w,h,depth,mats.stone,true);o.userData.wallDepth=depth;o.userData.wallRole=role;return o;};
   const [negative,positive]=gate?[0,0]:fit.wallExtensions,width=8+negative+positive,centre=(positive-negative)/2;
   if(gate){for(const x of [-3.5,3.5])body(x,3.4,1,6.8,'gate pier');body(0,6.8,8,1.2,'gate lintel');for(const z of [-1.73,1.73]){for(const side of [-1,1])trim(group,side*3,3.05,z,.2,6.1,.2,mats.edge);trim(group,0,6.15,z,6.3,.3,.2,mats.edge);}}
   else{const face=depth/2+.02;body(centre,3.7,width,7.4,'curtain wall');for(const z of [-face,face])for(const x of [-2.4,2.4]){trim(group,x,4.3,z,.32,2.2,.06,mats.dark);trim(group,x,3.15,z,.65,.16,.12);}}
   for(const y of (gate?[6.8]:[.2,6.8]))trim(group,centre,y,0,width,.35,depth+.3,mats.edge);
   if(walk){wallWalk(group,7.4,ladder,width,centre);const cell=group.userData.cell,angle=group.rotation.y,dx=Math.round(Math.cos(angle)),dz=-Math.round(Math.sin(angle));for(const sign of [-1,1])if(cell&&!layout.some(q=>q.layer===cell.layer&&q.x===cell.x+dx*sign&&q.z===cell.z+dz*sign&&['wall','gate','tower'].includes(q.type))){const cap=box(group,centre+sign*(width/2-.27),7.9,0,.54,1,4.8,mats.stone,true);cap.name='Finished curtain terminal';cap.userData.wallTerminal=true;cap.userData.parapet=true;trim(group,centre+sign*(width/2-.2),3.7,0,.4,7.4,5.05,mats.edge);}}
  }
  function armory(group,type,p){
   const dirs=[[0,-1],[-1,0],[0,1],[1,0]],openSides=dirs.flatMap(([dx,dz],side)=>layout.some(q=>q.x===p.x+dx&&q.z===p.z+dz&&((q.layer===p.layer+1&&!['wall','house','tower','roof'].includes(q.type))||(q.layer===p.layer&&['stairs','wall','gate'].includes(q.type))))?[side]:[]).map(side=>(side-group.userData.effectiveRotation+4)%4),armed=type!=='tower'||!pieceMap.has(p.x+':'+p.z+':'+(p.layer+1)),rig=sketchDefense(type,mats,{openSides,armed});
   group.add(rig.root);group.sketchRig=rig;group.userData.sketchType=type;
   rig.root.traverse(o=>{if(o.isMesh)own(o.geometry);if(o.material&&!Object.values(mats).includes(o.material))ownedMaterials.add(o.material);});
   for(const o of rig.solids){o.userData.structure=true;o.userData.construction=true;o.userData.castleIndex=home;o.userData.place=root.userData.place;colliders.push(o);}
   if(type!=='tower'){
    // Match the visible base/plinth; keep a clear perimeter for operator approach.
    const size=type==='trebuchet'?4.06:5;
    const base=box(group,0,.18,0,size,.36,size,mats.paving,true);base.userData.emplacementBase=true;
   }
   if(armed){group.userData.defense={...rig.metadata,entry:type==='tower'?[dirs[openSides[0]??0][0]*3,8,dirs[openSides[0]??0][1]*3]:[3,0,0]};}
  }
  function stairs(group){
   const g=geometry('stairs',()=>{const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-3.8,0,4,3.8,0,4,3.8,0,-4,-3.8,0,-4,-3.8,8,-4,3.8,8,-4],3));geo.setIndex([0,3,2,0,2,1,0,1,5,0,5,4,0,4,3,1,2,5,3,4,5,3,5,2]);geo.computeVertexNormals();return geo;});
   mesh(group,g,mats.paving,0,0,0,true);
   for(let i=0;i<16;i++)trim(group,0,(i+.5)*.5+.025,4-(i+.5)*.5,7.65,.05,.12,mats.edge);
   for(const side of [-1,1]){const rail=box(group,side*3.75,4.18,0,.24,.38,Math.hypot(8,8),mats.edge);rail.rotation.x=Math.PI/4;}
  }
  function garden(group,round=false){
   if(round){cylinder(group,0,.14,0,3.3,3.3,.28,mats.grass,false,CURVE_SEGMENTS);const rim=mesh(group,geometry('roundGardenRim',()=>new T.RingGeometry(3.15,3.5,CURVE_SEGMENTS)),mats.edge,0,.3,0);rim.rotation.x=-Math.PI/2;}
   else{box(group,0,.14,0,6.6,.28,6.6,mats.grass);for(const side of [-1,1]){trim(group,side*3.3,.35,0,.35,.7,6.8);trim(group,0,.35,side*3.3,6.8,.7,.35);}}
   cylinder(group,-1.3,1.6,-1,.18,.32,3.2,mats.bark,true,6);
   for(const [x,y,z,size] of [[-1.3,3.8,-1,1.9],[-2.15,3.2,-.5,1.25],[-.1,3.3,-1.1,1.4],[1.9,.85,1.8,.65],[1,.7,2,.6],[-1.8,.8,2,.65]]){const plant=mesh(group,geometry('leaf',()=>new T.IcosahedronGeometry(1,0)),mats.leaves,x,y,z);plant.scale.setScalar(size);}
  }
  // Only real occupied columns receive an underside; empty plots remain sky.
  root.userData.explicitFloors=true;root.userData.occupiedFoundation=true;
  if(performance.now()-mark>8){yield;mark=performance.now();}const terrain=castleTerrainPlan(layout);root.userData.terrainPlan=terrain;
  if(performance.now()-mark>8){yield;mark=performance.now();}const cliffMaterial=mats.soil.clone();cliffMaterial.flatShading=true;cliffMaterial.color.multiplyScalar(.77);ownedMaterials.add(cliffMaterial);
  for(const g of occupiedCliffGeometries(terrain.base)){const cliff=mesh(root,own(g),cliffMaterial,0,0,0,true);cliff.name='Connected occupied-tile rock cliff';cliff.userData.terrainCliff=true;}
  for(const lip of terrain.lips){if(performance.now()-mark>8){yield;mark=performance.now();}const p=lip.cell,x=(p.x-5.5)*8,y=BASE+p.layer*8,z=(p.z-5.5)*8-4;
   if(lip.round){const bank=mesh(root,geometry('roundRetaining:'+lip.sides.join(','),()=>roundRetainingGeometry(lip.sides)),mats.stone,x,y,z,true);bank.name='Circular edge retaining bank';bank.userData.terrainLip=true;}
   else for(const side of lip.sides){const [dx,dz]=[[0,-1],[-1,0],[0,1],[1,0]][side],group=new T.Group();group.position.set(x+dx*4,y,z+dz*4);group.rotation.y=side*Math.PI/2;root.add(group);const gap=lip.openings[side]||0,segments=gap?[[-(4+gap/2)/2,4-gap/2],[(4+gap/2)/2,4-gap/2]]:[[0,8]];for(const [cx,width]of segments){const bank=mesh(group,geometry('retainingBank',retainingLipGeometry),mats.stone,cx,0,0,true);bank.scale.x=width/8;bank.name='Exposed edge retaining bank';bank.userData.terrainLip=true;}}
  }
  if(performance.now()-mark>8){yield;mark=performance.now();}box(root,22,BASE-.8,62.5,18,1.6,37,mats.paving,true);
  for(const side of [-1,1]){box(root,22+side*9,BASE+.55,63,.5,1.1,35,mats.stone,true);for(let z=47;z<81;z+=4)trim(root,22+side*9,BASE+1.25,z,.9,.6,1.2);}
  for(const [x,z] of [[-12,53],[41,50]]){cylinder(root,x,BASE-.5,z,6.6,6.8,1,mats.paving,true);cylinder(root,x,-4.3,z,4.3,2.8,9,mats.stone,true);box(root,x,BASE-.45,(44+z)/2,7,.9,z-44,mats.paving,true);}
  // Elevated blocks form vaulted lower stories. Adjacent blocks share the body,
  // while stair/gate bays stay open instead of gaining thin individual stilts.
  const high=new Map();for(const p of layout){const key=p.x+':'+p.z;if(!high.has(key)||p.layer>high.get(key).layer)high.set(key,p);}
  const solidColumns=new Map();for(const p of layout)if(p.type==='terrace'||p.solid||roundFootprint(p)){const key=p.x+':'+p.z;if(!solidColumns.has(key)||p.layer>solidColumns.get(key).layer)solidColumns.set(key,p);}
  // Terrace cells are closed masonry volumes, not decorative screens hiding
  // beams. Deliberately placed lower rooms/stairs remove complete story bands;
  // the existing rotated floor aperture preserves the stair's upper headroom.
  for(const p of solidColumns.values()){if(performance.now()-mark>8){yield;mark=performance.now();}
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
  }

  function supportGeometry(stories,depth){return geometry('vault:'+stories+':'+depth,()=>{
   const top=stories*8-(config.material==='wood'?.65:1.2),shape=new T.Shape();shape.moveTo(-4,0);shape.lineTo(4,0);shape.lineTo(4,top);shape.lineTo(-4,top);shape.closePath();
   for(let story=0;story<stories;story++){const base=story*8,hole=new T.Path();hole.moveTo(-2.6,base);hole.lineTo(-2.6,base+3.1);if(config.material==='wood'){hole.lineTo(-2.6,base+6.2);hole.lineTo(2.6,base+6.2);}else hole.absarc(0,base+3.1,2.6,Math.PI,0,true);hole.lineTo(2.6,base);hole.closePath();shape.holes.push(hole);}
   return new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:6});
  });}
  const supportDepth=config.material==='wood'?1.4:2.6;
  for(const p of high.values())if(p.layer&&p.type!=='core'&&p.type!=='terrace'&&!p.solid&&!roundFootprint(p)){if(performance.now()-mark>8){yield;mark=performance.now();}
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
  for(const p of layout){if(performance.now()-mark>8){yield;mark=performance.now();}
   const fit=fitting.fits.get(p.x+':'+p.z+':'+p.layer),group=new T.Group();group.position.set((p.x-5.5)*CELL,BASE+p.layer*CELL,(p.z-5.5)*CELL-4);group.rotation.y=fit.rotation*Math.PI/2;group.name=PARTS.find(t=>t.id===p.type).label+' / layer '+(p.layer+1);group.userData.cell={...p};group.userData.fitting=fit;group.userData.effectiveRotation=fit.rotation;root.add(group);
   if(p.type==='core'){chosen={x:group.position.x,y:group.position.y,z:group.position.z};continue;}
   if(p.type!=='stairs'&&p.type!=='wallBridge')floor(group,p);
   if(p.type==='wall'||p.type==='gate')supportPiers(group,p.layer);
   if(p.type==='wall'||p.type==='gate'){wall(group,p.type==='gate',fit,ladderTiles.has(p));if(p.type==='gate'){woodenGate(group,home+':gate:'+p.x+':'+p.z+':'+p.layer);gateLandmark(group,7.4);}}
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
    const heart=chargeOrb(group,mats,{y:3.5,radius:1.35,color:home?0xb38bd7:0x8de8de,phase:p.x*.3+p.z*.1}),orb=heart.core,ring=heart.halo;group.protectorRig=heart;
    heart.root.traverse(o=>{if(o.geometry)own(o.geometry);if(o.material&&!Object.values(mats).includes(o.material))ownedMaterials.add(o.material);});orb.userData.structure=true;orb.userData.construction=true;orb.userData.castleIndex=home;colliders.push(orb);
    orb.userData.protectorId=home+':'+p.x+':'+p.z+':'+p.layer;orb.userData.protectorTeam=home;
    group.userData.protector={id:orb.userData.protectorId,team:home,orb,ring,visualRoot:heart.root,cell:{...p}};
   }
   else if(p.type==='armory'||p.type==='barracks'){const rig=citadelBuilding(p.type,mats,home);group.add(rig.root);group.userData.service=rig.root.userData.service;group.citadelRig=rig;rig.root.traverse(o=>{if(o.geometry)own(o.geometry);if(o.material&&!Object.values(mats).includes(o.material))ownedMaterials.add(o.material);});for(const o of rig.solids){o.userData.structure=o.userData.construction=true;o.userData.castleIndex=home;colliders.push(o);}}
   else if(p.type==='wallBridge'){const slab=mesh(group,geometry('vaultedBridgeDeck',()=>bevelSlab()),mats.paving,0,0,0,true);slab.userData.wallWalk=true;for(const x of [-2.7,2.7]){const rib=mesh(group,geometry('bridgeRib',corbelGeometry),mats.stone,x,-.35,0,true);rib.rotation.y=Math.PI/2;rib.scale.set(.6,.55,.5);}for(const z of [-2.13,2.13]){const rail=box(group,0,.5,z,6.5,1,.54,mats.stone,true);rail.userData.parapet=true;}}
   else if(p.type==='beacon'){cylinder(group,0,.28,0,1.6,1.9,.56,mats.stone,true);cylinder(group,0,2.5,0,.22,.4,4.5,mats.dark,true);cylinder(group,0,4.5,0,.8,.65,.35,mats.edge);const light=mesh(group,geometry('signal',()=>new T.IcosahedronGeometry(.7,1)),roof,0,5,0);for(let i=0;i<4;i++){const a=i*Math.PI/2;trim(group,Math.sin(a)*.6,4.95,Math.cos(a)*.6,.14,1.25,.14,mats.edge);}group.userData.defense={type:'beacon',muzzle:[0,5.6,0],direction:[0,0,1]};}
  }
  if(performance.now()-mark>8){yield;mark=performance.now();}const fortifications=tierFortifications(layout);root.userData.fortifications=fortifications;
  for(const e of fortifications.edges){if(performance.now()-mark>8){yield;mark=performance.now();}
   if(e.stairPassage&&!e.gate){const g=new T.Group();g.position.set((e.x-5.5)*8,BASE+e.layer*8,(e.z-5.5)*8-4);g.rotation.y=e.side*Math.PI/2;g.name='Finished stair portal';root.add(g);for(const x of [-3.75,3.75]){box(g,x,1.5,0,.5,3,4.8,mats.stone,true);trim(g,x,3.12,0,.7,.24,5,mats.edge);}continue;}
   const g=new T.Group();g.position.set((e.x-5.5)*8,BASE+e.layer*8,(e.z-5.5)*8-4);g.rotation.y=e.side*Math.PI/2;g.name=e.gate?'Stair gatehouse':'Raised tier curtain';root.add(g);supportPiers(g,e.layer,true);
   const tx=Math.round(Math.cos(e.side*Math.PI/2)),tz=-Math.round(Math.sin(e.side*Math.PI/2)),cuts=[-1,1].map(sign=>fortifications.towers.some(t=>t.layer===e.layer&&Math.abs(t.x-e.x-tx*.5*sign)<.001&&Math.abs(t.z-e.z-tz*.5*sign)<.001)?2.4:0);
   if(e.gate){const arch=new T.Group();arch.scale.y=3/7.4;g.add(arch);wall(arch,true,{wallExtensions:[0,0]},false,false);woodenGate(arch,home+':tier:'+e.x+':'+e.z+':'+e.layer);gateLandmark(g);wallWalk(g,3,false,8,0,cuts);}
   else{mesh(g,geometry('bevelCurtain',()=>bevelSlab(8,4.8,3,.55)),mats.stone,0,3,0,true);wallWalk(g,3,e.ladder,8,0,cuts,e.battery);}
  }
  for(const e of fortifications.batteries){if(performance.now()-mark>8){yield;mark=performance.now();}const bay=new T.Group();bay.name='Wall battery / exterior fighting bay';bay.userData.effectiveRotation=e.side;bay.position.set((e.x-5.5)*8,BASE+e.layer*8+3.07,(e.z-5.5)*8-4);bay.rotation.y=e.side*Math.PI/2;root.add(bay);const station=new T.Group();station.position.z=-4.8;station.rotation.y=Math.PI;station.userData.effectiveRotation=(e.side+2)%4;station.userData.cell={x:e.x,z:e.z,layer:e.layer,type:'cannon',rotation:(e.side+2)%4,wallMount:true};bay.add(station);mesh(station,geometry('bayBevel',()=>bevelSlab(6,5,.36,.8)),mats.paving,0,0,0,true);for(const x of [-1.8,1.8]){const rib=mesh(station,geometry('bayCorbel',corbelGeometry),mats.stone,x,-.36,0,true);rib.userData.batterySupport=true;}for(const x of [-2.73,2.73])box(station,x,.5,0,.54,1,5,mats.stone,true);box(station,0,.5,2.23,6,1,.54,mats.stone,true);armory(station,'cannon',{x:e.x,z:e.z,layer:e.layer});station.userData.defense.entry=[0,.36,-2.3];station.userData.wallBattery=true;}
  if(performance.now()-mark>8){yield;mark=performance.now();}const cornerPrototype=fortifications.towers.length?sketchDefense('tower',mats,{armed:false,openSides:[0,1,2,3]}):null,cornerNodes=[];cornerPrototype?.root.traverse(o=>cornerNodes.push(o));const cornerSolidIndices=new Set(cornerPrototype?.solids.map(o=>cornerNodes.indexOf(o))||[]);
  for(const t of fortifications.towers){if(performance.now()-mark>8){yield;mark=performance.now();}
   const rig={root:cornerPrototype.root.clone(true),solids:[]};let nodeIndex=0;rig.root.traverse(o=>{if(cornerSolidIndices.has(nodeIndex))rig.solids.push(o);else if(o.isMesh){let shown=true;for(let a=o;a;a=a.parent)if(!a.visible||a.userData.visualEffect)shown=false;if(shown)decorations.push(o);}nodeIndex++;});rig.root.position.set((t.x-5.5)*8,BASE+t.layer*8,(t.z-5.5)*8-4);rig.root.scale.set(.6,3/12.5,.6);rig.root.name='Tier '+t.role+' watchtower';root.add(rig.root);
   for(const [side,[dx,dz]]of [[0,[0,-1]],[1,[-1,0]],[2,[0,1]],[3,[1,0]]]){const connected=fortifications.edges.some(e=>e.layer===t.layer&&Math.abs(e.x-t.x-dx*.5)<.001&&Math.abs(e.z-t.z-dz*.5)<.001);if(!connected){const guard=box(root,rig.root.position.x+dx*2.13,BASE+t.layer*8+3.5,rig.root.position.z+dz*2.13,dx?.54:4.8,1,dz?.54:4.8,mats.stone,true);guard.userData.parapet=true;}}
   rig.root.traverse(o=>{if(o.geometry)own(o.geometry);if(o.material&&!Object.values(mats).includes(o.material))ownedMaterials.add(o.material);});
   for(const o of rig.solids){o.userData.structure=true;o.userData.construction=true;o.userData.castleIndex=home;colliders.push(o);}
  }
  // The original animated crown is preserved and securely reseated, never cloned.
  if(!chosen)chosen={x:-4,y:BASE+16,z:-16};
  const pedestalHeight=Math.max(.8,chosen.y-BASE+.8),pedestalTop=BASE+pedestalHeight;
  cylinder(root,chosen.x,BASE+pedestalHeight/2,chosen.z,10.6,12.4,pedestalHeight,mats.stone,true);
  cylinder(root,chosen.x,pedestalTop+.35,chosen.z,13.1,13.5,.7,mats.edge,true);
  cylinder(root,chosen.x,pedestalTop+.85,chosen.z,12.5,12.8,.3,mats.paving,true);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;trim(root,chosen.x+Math.sin(a)*11.15,BASE+pedestalHeight*.5,chosen.z+Math.cos(a)*11.15,1.2,pedestalHeight,1.2,mats.edge,a);}
  const heartPosition=new T.Vector3(chosen.x,pedestalTop+1+castleHearts[home].radius*1.59,chosen.z);
  for(const [material,matrices] of batches){const instance=new T.InstancedMesh(unit,material,matrices.length);matrices.forEach((matrix,i)=>instance.setMatrixAt(i,matrix));instance.castShadow=true;instance.receiveShadow=true;root.add(instance);}
  if(performance.now()-mark>8){yield;mark=performance.now();}
  // Batch repeated static, non-colliding fittings; keep solid and interactive pieces.
  root.updateMatrixWorld(true);
  const decorativeBatches=new Map();
  for(const o of decorations){let dynamic=false;for(let parent=o.parent;parent&&parent!==root;parent=parent.parent)if(parent.userData.defense||parent.userData.protector)dynamic=true;if(dynamic)continue;
   let materials=decorativeBatches.get(o.geometry);if(!materials)decorativeBatches.set(o.geometry,materials=new Map());let list=materials.get(o.material);if(!list)materials.set(o.material,list=[]);list.push(o);
  }
  let fittingCount=0,fittingDraws=0;
  for(const [g,materials] of decorativeBatches)for(const [material,list] of materials){if(list.length<2)continue;const instance=new T.InstancedMesh(g,material,list.length);instance.name='Static castle fittings';instance.userData.staticFittings=true;instance.castShadow=instance.receiveShadow=true;for(let i=0;i<list.length;i++){instance.setMatrixAt(i,list[i].matrixWorld);list[i].parent.remove(list[i]);}root.add(instance);fittingCount+=list.length;fittingDraws++;}
  root.userData.fittingBatchStats={fittings:fittingCount,draws:fittingDraws,savedDraws:fittingCount-fittingDraws};
  root.updateMatrixWorld(true);
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();for(const m of ownedMaterials)m.dispose();}
  if(performance.now()-mark>8){yield;mark=performance.now();}const links=inspectProtectorLinks(root,colliders,heartPosition),beams=addProtectorBeams(root,links);
  const originalDispose=dispose;return {root,colliders,occluders:[...colliders,...visualOccluders],geometries,heartPosition,links,adjustments:fitting.adjustments,dispose(){beams.dispose();originalDispose();}};
 }
 function preview(home,input,options){const state=at(home),config=profile(options);return dress(state,build(home,validated(input,config),config));}
 // Same preview, built in yielded slices.
 async function previewAsync(home,input,options){const state=at(home),config=profile(options),layout=validated(input,config);return dress(state,await buildAsync(home,layout,config));}
 function dress(state,built){
  const crown=state.heart.root.clone(true);
  let index=0;crown.traverse(o=>{const material=state.heartMaterials[index++];if(material)o.material=material;delete o.userData.fadeMaterial;});
  crown.position.copy(built.heartPosition);crown.name='Preview castle heart';built.root.add(crown);built.root.userData.preview=true;built.root.updateMatrixWorld(true);
  return {root:built.root,colliders:built.colliders,heartPosition:built.heartPosition,links:built.links,adjustments:built.adjustments,dispose:built.dispose};
 }
 function clearBuilt(state){if(!state.built)return;const old=state.built;removeSet(solids,new Set(old.colliders));removeSet(occluders,new Set(old.occluders??old.colliders));state.castle.remove(old.root);old.dispose();state.built=null;}
 function apply(home,input,options){
  const state=at(home),config=profile(options),layout=validated(input,config);if(!layout.some(p=>p.type==='core'))throw new Error('A built castle requires its main core.');const next=build(home,layout,config);const blocked=next.links.find(l=>!l.linked);if(blocked){next.dispose();throw new Error('Protector beam blocked by '+blocked.blocker+'. Clear its direct line before applying.');}
  clearBuilt(state);for(const original of state.originals)original.visible=false;
  removeSet(solids,new Set(state.originalSolids));removeSet(occluders,new Set(state.originalOccluders));
  state.castle.add(next.root);solids.push(...next.colliders);occluders.push(...next.occluders);state.heart.root.position.copy(next.heartPosition);if(state.harbor)state.harbor.position.x=state.harborX+(config.size-12)*4;state.built=next;state.layout=layout;state.config=config;state.castle.updateMatrixWorld(true);
  return {...counts()[home]};
 }
 function restore(home){const state=at(home);clearBuilt(state);state.originals.forEach((o,i)=>o.visible=state.visible[i]);for(const o of state.originalSolids)if(!solids.includes(o))solids.push(o);for(const o of state.originalOccluders)if(!occluders.includes(o))occluders.push(o);state.heart.root.position.copy(state.heartPosition);if(state.harbor)state.harbor.position.x=state.harborX;state.layout=null;state.config=null;state.castle.updateMatrixWorld(true);return {...counts()[home]};}
 function counts(){return states.map(state=>{const layout=state.layout||[];return {parts:layout.length,layers:layout.length?Math.max(...layout.map(p=>p.layer))+1:0,cannons:layout.filter(p=>p.type==='cannon').length,heavyCannons:layout.filter(p=>p.type==='heavyCannon').length,core:layout.some(p=>p.type==='core'),custom:!!state.built,profile:state.config?{...state.config}:null,config:state.config?{level:state.config.level,material:state.config.material}:null};});}
 return {apply,restore,preview,previewAsync,presets,templates:templateCatalog,template:buildTemplate,get counts(){return counts();}};
}
