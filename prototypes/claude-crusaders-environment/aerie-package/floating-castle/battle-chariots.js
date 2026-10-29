import * as T from '../vendor/three.module.js';
// ---- Chariot model: a small sky-chariot in the ship vocabulary (lofted tub, gilt rail, spoked glowing
// wheels, swept sail wings, team pennant, painted heraldic crest, hanging charge crystal). Static parts are
// merged per material and shared by every chariot; collision uses the separate invisible parts above.
const COLLIDER=new T.MeshBasicMaterial({visible:false});COLLIDER.name='Chariot collision volume (not drawn)';
const DUSK={bark:0x4b3d55,edge:0x9a86b4,dark:0x2f2840,sail:0x5e4f78,roofB:0x5a3f6e},UNDER=[0xb49c78,0x3b3150],MODEL_MATS=new WeakMap(),FALLBACK={};let STATIC=null;const CREST=[];
function tinted(base,hex,side){const m=base.clone();if(hex!==undefined){m.color.set(hex);m.color.convertSRGBToLinear();}if(side!==undefined)m.side=side;if(base.onBeforeCompile)m.onBeforeCompile=base.onBeforeCompile;if(base.customProgramCacheKey)m.customProgramCacheKey=base.customProgramCacheKey;return m;}
function modelMaterials(world,team){const mats=world.mats||FALLBACK;if(!world.mats&&!FALLBACK.bark)for(const [k,c] of Object.entries({bark:0x8b7967,edge:0xfff0c8,dark:0x677993,sail:0xf2dfb9,roof:0x508f9b,roofB:0x80709a}))FALLBACK[k]=new T.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
 let byTeam=MODEL_MATS.get(mats);if(!byTeam){byTeam=[];MODEL_MATS.set(mats,byTeam);}if(byTeam[team])return byTeam[team];
 const dusk=team===1,pick=k=>dusk?tinted(mats[k],DUSK[k]):mats[k],glow=dusk?0xd88cff:0xa6fff0;
 return byTeam[team]={wood:pick('bark'),trim:pick('edge'),metal:pick('dark'),sail:dusk?tinted(mats.sail,DUSK.sail,T.DoubleSide):mats.sail.side===T.DoubleSide?mats.sail:tinted(mats.sail,undefined,T.DoubleSide),sailUnder:tinted(mats.sail,UNDER[dusk?1:0],T.FrontSide),pennant:tinted(dusk?mats.roofB:mats.roof,dusk?DUSK.roofB:undefined,T.DoubleSide),
  rim:new T.MeshStandardMaterial({color:dusk?0x8e598d:0xb4fff2,emissive:dusk?0x45254d:0x247b77,emissiveIntensity:.8,roughness:.6}),glow:new T.MeshBasicMaterial({color:glow}),crest:new T.MeshBasicMaterial({map:heraldry(team),alphaTest:.5})};}
function mergeGeometries(list){let n=0;const flat=list.map(g=>{const f=g.index?g.toNonIndexed():g;if(!f.attributes.normal)f.computeVertexNormals();n+=f.attributes.position.count;return f;});
 const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2);let o=0;for(const g of flat){const c=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,o*2);o+=c;}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(nor,3));out.setAttribute('uv',new T.BufferAttribute(uv,2));out.computeBoundingSphere();return out;}
function staticGeometry(){if(STATIC)return STATIC;const wood=[],trim=[],metal=[],sail=[],under=[],spokes=[],rims=[],m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),up=new T.Vector3(0,1,0);
 const at=(g,x,y,z,rx=0,ry=0,rz=0)=>g.applyMatrix4(m.compose(new T.Vector3(x,y,z),q.setFromEuler(e.set(rx,ry,rz)),new T.Vector3(1,1,1)));
 const beam=(list,a,b,r)=>{const d=new T.Vector3().subVectors(b,a),g=new T.CylinderGeometry(r,r,d.length(),5);g.applyMatrix4(m.compose(new T.Vector3().addVectors(a,b).multiplyScalar(.5),q.setFromUnitVectors(up,d.normalize()),new T.Vector3(1,1,1)));list.push(g);};
 // Tub: ship-style outline lofted from a narrow keel to the deck line (prow at +z, open back rail).
 const outline=[[0,.5],[.3,.44],[.48,.22],[.5,-.2],[.42,-.46],[-.42,-.46],[-.5,-.2],[-.48,.22],[-.3,.44]],n=outline.length,W=3.8,L=4.8,vert=[],idx=[],uvs=[];
 for(const [y,f] of [[-.6,.58],[-.15,.92],[.45,1]])for(const [px,pz] of outline){vert.push(px*W*f,y,pz*L*(.8+.2*f));uvs.push(px+.5,y);}
 for(let k=0;k<2;k++)for(let j=0;j<n;j++){const a=k*n+j,b=k*n+(j+1)%n,c=(k+1)*n+(j+1)%n,d=(k+1)*n+j;idx.push(a,c,b,a,d,c);}
 const bottom=vert.length/3;vert.push(0,-.6,0);uvs.push(.5,0);const top=vert.length/3;vert.push(0,.45,0);uvs.push(.5,1);for(let j=0;j<n;j++){const next=(j+1)%n;idx.push(bottom,j,next,top,2*n+next,2*n+j);}
 const tub=new T.BufferGeometry();tub.setAttribute('position',new T.Float32BufferAttribute(vert,3));tub.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));tub.setIndex(idx);tub.computeVertexNormals();wood.push(tub);
 const P=(i,y)=>new T.Vector3(outline[i][0]*W,y,outline[i][1]*L),railY=i=>i===0?1.45:i===1||i===8?1.25:1.0;
 for(let i=0;i<n;i++){const j=(i+1)%n;beam(trim,P(i,.47),P(j,.47),.1);if(i!==4){beam(trim,P(i,railY(i)),P(j,railY(j)),.075);}beam(wood,P(i,.45),P(i,railY(i)),.06);}
 for(const [px,pz] of [[0,.62],[0,-.2]])trim.push(at(new T.BoxGeometry(.16,.14,L*.62),px,-.62,pz*.5));
 // Swept sail wings over the measured wing boxes (local +-2 x, +-1 z): a cambered cloth grid (arched chord, slight
 // tip droop) with three broad rounded feathers on the trailing edge, a pale top and a darker underside skin, raised
 // .3 so the near wing clears the wheel silhouette. Ribs follow the camber instead of cutting through the cloth.
 for(const side of [-1,1]){const wm=new T.Matrix4().compose(new T.Vector3(side*3,.8,-.5),new T.Quaternion().setFromEuler(new T.Euler(0,0,side*.18)),new T.Vector3(1,1,1));
  const S=12,C=4,point=(u,c,lift=0)=>{const le=.9+(.15-.9)*u,te=-.95+(.5)*u-.3*Math.pow(Math.sin(Math.PI*((u*3)%1)),.7);return new T.Vector3(side*(-2+4*u),.16*(1-.45*u)*Math.sin(Math.PI*c)-.12*u*u+lift,le+(te-le)*c).applyMatrix4(wm);};
  const skin=(lift,up)=>{const pos=[];for(let i=0;i<S;i++)for(let j=0;j<C;j++){const q=[point(i/S,j/C,lift),point((i+1)/S,j/C,lift),point((i+1)/S,(j+1)/C,lift),point(i/S,(j+1)/C,lift)];for(const t of [[0,1,2],[0,2,3]]){const A=q[t[0]],B=q[t[1]],D=q[t[2]],n=new T.Vector3().subVectors(B,A).cross(new T.Vector3().subVectors(D,A));const order=(n.y>0)===up?[A,B,D]:[A,D,B];for(const v of order)pos.push(v.x,v.y,v.z);}}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;};
  sail.push(skin(0,true));under.push(skin(-.05,false));
  const L0=point(0,0,.03),L1=point(1,0,.03);beam(trim,L0,L1,.09);
  for(const u of [.2,.5,.8]){beam(wood,point(u,0,.04),point(u,.5,.04),.04);beam(wood,point(u,.5,.04),point(u,.9,.04),.035);}
  beam(metal,new T.Vector3(side*1.75,.5,.3),L0.clone().lerp(L1,.15),.07);}
 // Wheels (spun as one group around the shared axle): glowing rims + spokes, hubs and axle.
 for(const side of [-1,1]){rims.push(at(new T.TorusGeometry(1.2,.12,4,18),side*2,0,0,0,Math.PI/2,0));for(let k=0;k<6;k++)spokes.push(at(new T.BoxGeometry(.08,2.3,.1),side*2,0,0,k*Math.PI/6,0,0));spokes.push(at(new T.CylinderGeometry(.26,.26,.34,8),side*2,0,0,0,0,Math.PI/2));}
 spokes.push(at(new T.CylinderGeometry(.08,.08,4,6),0,0,0,0,0,Math.PI/2));
 // Crystal strut, pennant pole.
 beam(metal,new T.Vector3(0,-.6,0),new T.Vector3(0,-.95,0),.08);beam(wood,new T.Vector3(1.4,.45,-2.05),new T.Vector3(1.4,3.3,-2.05),.06);
 const pen=new T.Shape();pen.moveTo(0,0);pen.lineTo(0,-.7);pen.lineTo(-1.7,-.75);pen.lineTo(-1.15,-.35);pen.lineTo(-1.7,.05);pen.closePath();const pennant=new T.ShapeGeometry(pen);pennant.rotateY(-Math.PI/2);
 const crystal=new T.OctahedronGeometry(.4,0);crystal.scale(1,1.6,1);
 return STATIC={wood:mergeGeometries(wood),trim:mergeGeometries(trim),metal:mergeGeometries(metal),sail:mergeGeometries(sail),under:mergeGeometries(under),spokes:mergeGeometries(spokes),rims:mergeGeometries(rims),pennant,crystal,ring:new T.TorusGeometry(.78,.055,3,20),crest:new T.PlaneGeometry(1,1.1),smoke:new T.IcosahedronGeometry(1,0)};}
// Painted heraldic crest (no text): golden sun on teal for Dawn, silver crescent on violet for Dusk.
function heraldry(team){if(CREST[team])return CREST[team];const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const g=canvas.getContext('2d');
 const shield=()=>{g.beginPath();g.moveTo(8,6);g.lineTo(56,6);g.lineTo(56,30);g.quadraticCurveTo(56,52,32,60);g.quadraticCurveTo(8,52,8,30);g.closePath();};
 shield();g.lineJoin='round';g.strokeStyle='#ffffff';g.lineWidth=7;g.stroke();g.fillStyle=team?'#3b2a4f':'#2f6f7a';g.fill();g.strokeStyle='#231a2e';g.lineWidth=3;g.stroke();
 g.beginPath();g.moveTo(14,11);g.lineTo(50,11);g.lineTo(50,30);g.quadraticCurveTo(50,47,32,54);g.quadraticCurveTo(14,47,14,30);g.closePath();g.strokeStyle='#e9c46a';g.lineWidth=1.5;g.stroke();
 if(team){g.fillStyle='#e8dcf5';g.beginPath();g.arc(30,29,12,0,Math.PI*2);g.fill();g.fillStyle='#3b2a4f';g.beginPath();g.arc(36,25,10,0,Math.PI*2);g.fill();g.fillStyle='#f49bc7';for(const [x,y] of [[42,40],[20,18],[44,16]])g.fillRect(x,y,2,2);}
 else{g.fillStyle='#ffd27a';for(let k=0;k<8;k++){const a=k*Math.PI/4;g.beginPath();g.moveTo(32+Math.cos(a)*17,29+Math.sin(a)*17);g.lineTo(32+Math.cos(a+.3)*9,29+Math.sin(a+.3)*9);g.lineTo(32+Math.cos(a-.3)*9,29+Math.sin(a-.3)*9);g.closePath();g.fill();}g.beginPath();g.arc(32,29,8,0,Math.PI*2);g.fill();g.strokeStyle='#231a2e';g.lineWidth=1;g.stroke();}
 const tex=new T.CanvasTexture(canvas);tex.magFilter=T.NearestFilter;tex.minFilter=T.NearestFilter;tex.encoding=T.sRGBEncoding;return CREST[team]=tex;}
function chariotModel(world,team){const G=staticGeometry(),M=modelMaterials(world,team),decor=new T.Group();decor.name='Chariot model';const mesh=(g,m,parent=decor)=>{const o=new T.Mesh(g,m);parent.add(o);return o;};
 mesh(G.wood,M.wood);mesh(G.trim,M.trim);mesh(G.metal,M.metal);mesh(G.sail,M.sail);mesh(G.under,M.sailUnder);const wheels=new T.Group();wheels.position.y=-.1;decor.add(wheels);mesh(G.spokes,M.trim,wheels);mesh(G.rims,M.rim,wheels);
 const pennant=mesh(G.pennant,M.pennant);pennant.position.set(1.4,3.25,-2.05);const crystal=mesh(G.crystal,M.glow);crystal.position.y=-1.3;const ring=mesh(G.ring,M.glow);ring.position.y=-1.3;ring.rotation.x=Math.PI/2;
 for(const [x,z,ry] of [[0,2.43,0],[0,-2.25,Math.PI]]){const c=mesh(G.crest,M.crest);c.position.set(x,.95,z);c.rotation.set(-.12,ry,0);}
 return {decor,wheels,pennant,crystal,ring};}
// Touch players see tap wording (pad / Rise / Lower / Chariot buttons); desktop keeps key names.
const touch=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches,say=(keys,tap)=>touch()?tap:keys;
const SMOKE=new T.MeshBasicMaterial({color:0x3d3446,transparent:true,opacity:.6,depthWrite:false});
function animate(v,time,c){const dt=Math.min(.1,Math.max(0,time-v.lastTime));v.lastTime=time;const m=v.model;if(!m)return;
 if(v.root.visible){const speed=v.velocity.length();m.wheels.rotation.x+=(speed>1?speed/1.2:.8)*dt;m.crystal.position.y=-1.3+Math.sin(time*2.4)*.07;m.ring.rotation.z=Math.floor(time*10)*.3;m.ring.rotation.x=Math.PI/2+Math.sin(time*1.7)*.25;m.pennant.rotation.y=Math.sin(Math.floor(time*8)/8*5+v.team)*.28;}
 if(v.hp>0){if(v.wreckAt>=0){v.wreckAt=-1;v.wreck.visible=false;}return;}
 if(v.wreckAt<0){if(!c||c.state?.phase==='idle')return;v.wreckAt=time;const w=v.wreck;w.position.copy(v.root.position);w.rotation.copy(v.root.rotation);w.userData.y0=v.root.position.y;w.visible=true;
  if(!w.userData.smoke){w.userData.smoke=[];for(let i=0;i<5;i++){const p=new T.Mesh(STATIC.smoke,SMOKE);w.add(p);w.userData.smoke.push(p);}}}
 const t=time-v.wreckAt,w=v.wreck;if(t>1.8){w.visible=false;return;}
 w.position.y=w.userData.y0-3.5*t*t;w.rotation.x=t*1.4;w.rotation.z=t*.9*(v.team?-1:1);
 w.userData.smoke.forEach((p,i)=>{const k=Math.min(1,t*1.6+i*.08);p.position.set(Math.sin(i*2.4)*1.6*k,.5+k*(1.5+i*.4)+3.5*t*t*.6,Math.cos(i*2.4)*1.6*k);p.scale.setScalar(.5+k*1.3);});SMOKE.opacity=.6*(1-t/1.8);}
export function createBattleChariots({world,scene,actors,navigation,getCombat,onMessage=()=>{}}){
 const flightBottom=Math.min(4,...(world.orbTowers||[]).map(o=>Number.isFinite(o.y)?o.y+4:4));
 const vehicles=[],parts=[];let motion={x:0,z:0},rise=0;
 // Trace the visible hull corners, outer wing tips and wheel bottoms as well as
 // the centre. This is sampled clearance, not an inflated invisible collider.
 const clearancePoints=[new T.Vector3(),new T.Vector3(4.95,.85,-.5),new T.Vector3(-4.95,.85,-.5),new T.Vector3(2,-1.52,0),new T.Vector3(-2,-1.52,0)];
 for(const x of [-1.9,1.9])for(const y of [-.6,.6])for(const z of [-2.4,2.4])clearancePoints.push(new T.Vector3(x,y,z));
 const clearanceFrom=new T.Vector3(),clearanceTo=new T.Vector3(),turnAxis=new T.Vector3(0,1,0);let clearanceIgnore;const physicalBounds=new T.Box3(),partBounds=new T.Box3();
 for(let team=0;team<2;team++)for(let i=0;i<2;i++){const root=new T.Group(),pad=world.pads[team],home=new T.Vector3(pad.x+(i?9:-9),pad.y+3,pad.z+8),id='chariot-'+team+'-'+i,mat=COLLIDER;
  const physicalParts=[],register=mesh=>{mesh.userData.vehicleId=id;mesh.geometry.computeBoundingBox();physicalParts.push(mesh);parts.push(mesh);world.solids.push(mesh);};
  const hull=new T.Mesh(new T.BoxGeometry(3.8,1.2,4.8),mat);root.add(hull);register(hull);
 for(const side of [-1,1]){const wheel=new T.Mesh(new T.TorusGeometry(1.2,.22,4,12),COLLIDER);wheel.position.set(side*2,-.1,0);wheel.rotation.y=Math.PI/2;root.add(wheel);register(wheel);const wing=new T.Mesh(new T.BoxGeometry(4,.12,2),mat);wing.position.set(side*3,.5,-.5);wing.rotation.z=side*.18;root.add(wing);register(wing);}
  // Collision keeps the original measured hull/wheel/wing volumes (invisible material, still raycast);
  // the visible chariot below is built inside those same extents from the shared world palette.
  const model=chariotModel(world,team);root.add(model.decor);const flame=model.crystal;root.position.copy(home);scene.add(root);root.visible=true;const wreck=model.decor.clone();wreck.visible=false;wreck.name='Chariot wreck';scene.add(wreck);
  const label=new T.Sprite(new T.SpriteMaterial({map:heraldry(team),depthTest:false,transparent:true}));label.name='Boarding crest';label.position.y=6.5;label.scale.set(2.6,2.6,1);label.visible=false;label.renderOrder=16;root.add(label);vehicles.push({id,team,root,home,hp:260,maxHp:260,seats:[{actor:null}],velocity:new T.Vector3(),physicalParts,collisionHalfSize:new T.Vector3(),collisionOffset:new T.Vector3(),respawnAt:0,flame,label,model,wreck,wreckAt:-1,spin:0,lastTime:0,objectiveApproach:null});}
 function updateBounds(v){v.root.updateWorldMatrix(true,true);physicalBounds.makeEmpty();for(const mesh of v.physicalParts)physicalBounds.union(partBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));physicalBounds.getSize(v.collisionHalfSize).multiplyScalar(.5);physicalBounds.getCenter(v.collisionOffset).sub(v.root.position);}
 for(const v of vehicles)updateBounds(v);
 clearanceIgnore=new Set(parts);
 function nearestVehicle(a,maxDistance=14){
  if(!a?.alive||a.mount)return null;let nearest=null,best=maxDistance;
  for(const v of vehicles){if(v.team!==a.team||v.hp<=0||!v.root.visible||v.seats[0].actor)continue;const p=v.root.position,d=Math.hypot(p.x-a.state.x,p.y-a.state.y,p.z-a.state.z);if(d<best){nearest=v;best=d;}}
  return nearest;
 }
 // HUD query: {id,distance}|null for the nearest free friendly chariot. The returned object is reused (no allocation).
 const boardable={id:null,distance:0};
 function nearestBoardable(a,maxDistance=14){const v=nearestVehicle(a,maxDistance);if(!v)return null;boardable.id=v.id;boardable.distance=Math.hypot(v.root.position.x-a.state.x,v.root.position.y-a.state.y,v.root.position.z-a.state.z);return boardable;}
 let labelsOn=true;
 function render(){const nearest=nearestVehicle(actors[0]),c=getCombat?.(),time=c?.state?.time??0;for(const v of vehicles){v.label.visible=labelsOn&&v===nearest;animate(v,time,c);}}
 function exit(a=actors[0]){const v=vehicles.find(v=>v.id===a.mount?.chariot);if(!v)return false;v.seats[0].actor=null;a.mount=null;a.role=a.chariotPriorRole||(a.human?'Player':'Scout');delete a.chariotPriorRole;Object.assign(a.state,{x:v.root.position.x+5,y:v.root.position.y+2,z:v.root.position.z,flight:true,flightKind:'dismount',manual:true,grounded:false,phase:'falling',vy:0});a.path=[];a.pathIndex=0;a.decisionAt=getCombat().state.time;if(!a.human)a.chariotReboardAt=getCombat().state.time+12;if(a.human)onMessage(say('Airborne · WASD steer to a landing · gravity continues.','Airborne · steer with the pad to a landing · gravity continues.'));return true;}
 function interact(a=actors[0]){if(a.mount?.chariot)return exit(a);if(a.mount||!a.alive)return false;const v=nearestVehicle(a);if(!v){const nearest=nearestVehicle(a,Infinity),distance=nearest?Math.ceil(nearest.root.position.distanceTo(new T.Vector3(a.state.x,a.state.y,a.state.z))):null;onMessage(distance===null?'No unoccupied friendly chariot nearby.':('Friendly chariot '+distance+'m away · approach within 14m and '+say('press R.','tap Chariot.')));return false;}a.planController?.abort();a.planToken++;a.planning=false;a.spawnPending=false;a.path=[];a.pathIndex=0;a.mount={chariot:v.id};v.seats[0].actor=a;a.chariotPriorRole=a.role;a.role='Charioteer';a.reason='Fast solo flight to an objective';if(a.human)onMessage(say('FLYING CHARIOT · WASD steer · R/C rise/lower · F exit · personal weapons','FLYING CHARIOT · pad to steer · Rise/Lower · tap Exit to leave · personal weapons'));return true;}
 function reset(){for(const v of vehicles){if(v.seats[0].actor)exit(v.seats[0].actor);v.root.position.copy(v.home);v.velocity.set(0,0,0);v.hp=v.maxHp;v.respawnAt=0;v.seats[0].actor=null;v.root.visible=true;v.root.rotation.set(0,0,0);updateBounds(v);v.objectiveApproach=null;v.wreckAt=-1;v.wreck.visible=false;}for(const a of actors)a.chariotReboardAt=0;}
 function sync(){for(const v of vehicles){const pad=world.pads[v.team];v.home.set(pad.x+(v.id.endsWith('1')?9:-9),pad.y+3,pad.z+8);}reset();}
 function step(dt){const c=getCombat();for(const v of vehicles){v.root.visible=v.hp>0;if(v.hp<=0){if(v.seats[0].actor)exit(v.seats[0].actor);v.respawnAt||=c.state.time+20;if(c.state.phase==='running'&&c.state.time>=v.respawnAt){v.hp=v.maxHp;v.respawnAt=0;v.root.position.copy(v.home);updateBounds(v);}continue;}let a=v.seats[0].actor;if(a&&(!a.alive||a.mount?.chariot!==v.id)){exit(a);v.seats[0].actor=null;a=null;}if(!a&&c.state.phase==='running'&&actors.filter(a=>a.team===v.team).length>=4){const bot=actors.find(a=>!a.human&&a.alive&&a.state.grounded&&!a.state.flight&&c.state.time>=(a.chariotReboardAt||0)&&!a.mount&&!a.fleetTask&&!a.defenseTask&&a.team===v.team&&a.ordinal%8===2&&v.root.position.distanceTo(new T.Vector3(a.state.x,a.state.y,a.state.z))<14);if(bot)interact(bot);a=v.seats[0].actor;}
   if(!a){v.velocity.multiplyScalar(Math.exp(-dt*4));continue;}let input;if(a.human)input=new T.Vector3(motion.x,rise,motion.z);else{const o=c.objectives.filter(o=>o.owner!==a.team).sort((a,b)=>v.root.position.distanceTo(new T.Vector3(a.x,a.y,a.z))-v.root.position.distanceTo(new T.Vector3(b.x,b.y,b.z)))[0]||c.objectives[0];if(!o)continue;if(v.objectiveApproach?.id!==o.id){const dx=v.home.x-o.x,dz=v.home.z-o.z,length=Math.hypot(dx,dz)||1,radius=Math.min(8,(o.radius||14)*.6),preferred={x:o.x+dx/length*radius,y:o.y,z:o.z+dz/length*radius},supported=navigation.nearest?.(preferred,4);const point=supported||preferred;v.objectiveApproach={id:o.id,x:point.x,y:point.y,z:point.z};}
   const approach=v.objectiveApproach,target=new T.Vector3(approach.x,T.MathUtils.clamp(approach.y+9,flightBottom,220),approach.z),distance=Math.hypot(v.root.position.x-approach.x,v.root.position.z-approach.z);a.objectiveId=o.id;a.objectiveLabel=o.label||('Orb '+(o.id+1));a.reason='Flying to '+a.objectiveLabel+'; approaching a supported landing';if(distance>20){target.y=150;if(v.root.position.y<149){target.x=v.root.position.x;target.z=v.root.position.z;}}else if(v.root.position.distanceTo(target)<4){exit(a);continue;}input=target.sub(v.root.position).normalize();}
   if(input.length()>1)input.normalize();v.velocity.lerp(input.multiplyScalar(88),1-Math.exp(-dt*5));const before=v.root.position.clone(),after=before.clone().addScaledVector(v.velocity,dt);after.y=T.MathUtils.clamp(after.y,flightBottom,220);after.x=T.MathUtils.clamp(after.x,-560,560);after.z=T.MathUtils.clamp(after.z,-560,560);const previousYaw=v.root.rotation.y,nextYaw=v.velocity.lengthSq()>1?Math.atan2(v.velocity.x,v.velocity.z):previousYaw;
   const turn=Math.atan2(Math.sin(nextYaw-previousYaw),Math.cos(nextYaw-previousYaw)),turnSteps=Math.max(1,Math.ceil(Math.abs(turn)/(Math.PI/12)));
   const hit=clearancePoints.some(offset=>{for(let step=0;step<turnSteps;step++){const t0=step/turnSteps,t1=(step+1)/turnSteps;clearanceFrom.copy(offset).applyAxisAngle(turnAxis,previousYaw+turn*t0);clearanceTo.copy(offset).applyAxisAngle(turnAxis,previousYaw+turn*t1);
    clearanceFrom.x+=before.x+(after.x-before.x)*t0;clearanceFrom.y+=before.y+(after.y-before.y)*t0;clearanceFrom.z+=before.z+(after.z-before.z)*t0;
    clearanceTo.x+=before.x+(after.x-before.x)*t1;clearanceTo.y+=before.y+(after.y-before.y)*t1;clearanceTo.z+=before.z+(after.z-before.z)*t1;
    if(c.collision.firstHit(clearanceFrom,clearanceTo,clearanceIgnore))return true;}return false;});
   if(!hit){v.root.position.copy(after);v.root.rotation.y=nextYaw;}else v.velocity.set(0,0,0);updateBounds(v);Object.assign(a.state,{x:v.root.position.x,y:v.root.position.y+1,z:v.root.position.z,vx:v.velocity.x,vy:v.velocity.y,vz:v.velocity.z,flight:false,flightKind:null,grounded:false});v.flame.scale.setScalar(1+.25*Math.sin(c.state.time*30));
  }}
 return {vehicles,parts,interact,exit,step,reset,sync,render,nearestBoardable,setLabelsVisible(on){labelsOn=!!on;if(!labelsOn)for(const v of vehicles)v.label.visible=false;},setMotion(input,vertical){motion=input;rise=vertical;},status(){const id=actors[0].mount?.chariot,v=id&&vehicles.find(v=>v.id===id);return v?'FLYING CHARIOT · '+Math.round(v.velocity.length())+'m/s'+say(' · F exit',''):say('R · Enter flying chariot','Tap Chariot to board');},snapshot:()=>vehicles.map(v=>({id:v.id,hp:v.hp,pilot:v.seats[0].actor?.id??null,x:v.root.position.x,y:v.root.position.y,z:v.root.position.z}))};
}
