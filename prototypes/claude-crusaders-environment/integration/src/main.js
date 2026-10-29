import {addEnvironmentDetail} from './detail.js';
import {createWorldCharacter} from '../character/adapter.js';
import * as THREE from '../vendor/three.module.js';
import {makeLayout,SCALE,TUNE,heightAt} from './layout.js';
import {pilot,guide,castleRecovery,newState,step,reset,recover,nearPad,launch,cameraInput,supportAt,landingAt} from './physics.js';
const $=id=>document.getElementById(id),world=makeLayout(),artWorld=makeLayout(false),state=newState(world);
const scene=new THREE.Scene(),canvas=$('world'),renderer=new THREE.WebGLRenderer({canvas,antialias:false});
renderer.outputEncoding=THREE.sRGBEncoding;renderer.setPixelRatio(1);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,2,1600);
scene.fog=new THREE.Fog(0x75839b,400,1100);scene.background=new THREE.Color(0x75839b);
const ambient=new THREE.AmbientLight(0xc5c4e1,.12),hemi=new THREE.HemisphereLight(0xb6d7ff,0x6d3958,.25),key=new THREE.DirectionalLight(0xffdeb0,.65),rim=new THREE.DirectionalLight(0x8a9dff,.25);
key.position.set(-60,100,40);rim.position.set(50,30,-90);scene.add(ambient,hemi,key,rim);
let yaw=.28,elevation=.67,distance=80,pixel=false,snap=false,lighting='toon',captureCamera=false;
const snapUniform={value:0},gridUniform={value:new THREE.Vector2(320,240)},materials=[],meshes=[];
const gradient=new THREE.DataTexture(new Uint8Array([65,120,185,255]),4,1,THREE.LuminanceFormat);gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.needsUpdate=true;
const PALETTES={bright:['#ffecd3','#b6bfe0','#5d678f','#323349'],dark:['#d8e5fa','#9a89c3','#685582','#39324f'],island:['#e7e6bf','#92b3b9','#647c96','#374255']};
function paletteTexture(stops){const colors=stops.map(c=>new THREE.Color(c).convertSRGBToLinear()),a=new Uint8Array(256*3);for(let i=0;i<256;i++){const t=i/255*3,k=Math.min(2,Math.floor(t)),c=colors[k].clone().lerp(colors[k+1],t-k);a[i*3]=c.r*255;a[i*3+1]=c.g*255;a[i*3+2]=c.b*255;}const tex=new THREE.DataTexture(a,256,1,THREE.RGBFormat);tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;return tex;}
const paletteMaps=Object.fromEntries(Object.entries(PALETTES).map(([k,v])=>[k,paletteTexture(v)]));
const snapCode='if(snapOn>0.5){vec2 p=gl_Position.xy/gl_Position.w;gl_Position.xy=floor(p*snapGrid+0.5)/snapGrid*gl_Position.w;}';
function material(hex,theme='bright'){
 const base=new THREE.Color(hex).convertSRGBToLinear();
 const toon=new THREE.MeshToonMaterial({color:base,gradientMap:gradient});
 toon.onBeforeCompile=shader=>{shader.uniforms.snapOn=snapUniform;shader.uniforms.snapGrid=gridUniform;shader.vertexShader='uniform float snapOn;uniform vec2 snapGrid;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+snapCode);};
 const palette=new THREE.ShaderMaterial({uniforms:{base:{value:base},palette:{value:paletteMaps[theme]},lightDir:{value:new THREE.Vector3(-.5,1,.35).normalize()},snapOn:snapUniform,snapGrid:gridUniform,fogColor:{value:scene.fog.color},fogNear:{value:400},fogFar:{value:1100}},vertexShader:`uniform sampler2D palette;uniform vec3 lightDir;uniform float snapOn;uniform vec2 snapGrid;varying vec3 shade;varying float fogDepth;
 void main(){vec3 localNormal=normal;vec4 localPosition=vec4(position,1.);
#ifdef USE_INSTANCING
localPosition=instanceMatrix*localPosition;mat3 im=mat3(instanceMatrix);localNormal/=vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));localNormal=im*localNormal;
#endif
vec3 n=normalize(normalMatrix*localNormal);vec3 l=normalize((viewMatrix*vec4(lightDir,0.)).xyz);float u=1.-(dot(n,l)+1.)*.5;shade=texture2D(palette,vec2((floor(u*255.)+.5)/256.,.5)).rgb;vec4 mv=modelViewMatrix*localPosition;fogDepth=-mv.z;gl_Position=projectionMatrix*mv;${snapCode}}`,fragmentShader:`uniform vec3 base;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;varying vec3 shade;varying float fogDepth;
 #include <common>
 void main(){vec3 additive=pow(max(shade-.55,vec3(0.)),vec3(2.))*.12;gl_FragColor=vec4(mix(base*shade+additive,fogColor,smoothstep(fogNear,fogFar,fogDepth)),1.);
 #include <encodings_fragment>
 }`});
 materials.push({toon,palette});return toon;
}
const THEMES={bright:{stone:0xdbc69e,edge:0xb09976,roof:0xa64d3c,ground:0xa8b9ac,rock:0x746e81,accent:0x78d8ed},dark:{stone:0x776b92,edge:0x534960,roof:0x382a56,ground:0x798197,rock:0x393749,accent:0xed8ca7},island:{stone:0x95ada5,edge:0x647c86,roof:0x655b77,ground:0x7eaaa1,rock:0x546d7f,accent:0xe6d991}};
const themeMats={};for(const [theme,c]of Object.entries(THEMES))themeMats[theme]=Object.fromEntries(Object.entries(c).map(([k,v])=>[k,material(v,theme)]));
const architectureGroups={};for(const d of artWorld.destinations){const g=new THREE.Group();g.position.set(d.x,d.y,d.z);g.scale.set(SCALE.horizontal,SCALE.vertical,SCALE.horizontal);scene.add(g);architectureGroups[d.id]=g;}let drawingDestination=null;
for(const d of artWorld.destinations)meshes.push(...addEnvironmentDetail(architectureGroups[d.id],themeMats[d.id],d.kind==='castle',d.dark));
function attach(m,x,y,z){const d=artWorld.destinations.find(d=>d.id===drawingDestination);if(d){m.position.set(x-d.x,y-d.y,z-d.z);architectureGroups[d.id].add(m);}else{m.position.set(x,y,z);scene.add(m);}}
function mesh(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);attach(m,x,y,z);meshes.push(m);return m;}
const cube=new THREE.BoxGeometry(1,1,1),cyl=new THREE.CylinderGeometry(1,1,1,12);
function box(x,y,z,w,h,l,mat){const m=mesh(cube,mat,x,y,z);m.scale.set(w,h,l);return m;}
function cylinder(x,y,z,r,h,mat){const m=mesh(cyl,mat,x,y,z);m.scale.set(r,h,r);return m;}
function label(text,x,y,z,color='#f5eccf'){
 const cv=document.createElement('canvas');cv.width=512;cv.height=96;const ctx=cv.getContext('2d');ctx.fillStyle='#1b2437e8';ctx.fillRect(3,3,506,90);ctx.strokeStyle=color;ctx.strokeRect(3,3,506,90);ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 27px Georgia';ctx.fillText(text,256,58);
 const texture=new THREE.CanvasTexture(cv);texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.encoding=THREE.sRGBEncoding;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false}));s.scale.set(13,drawingDestination?2.44*SCALE.horizontal/SCALE.vertical:2.44,1);attach(s,x,y,z);return s;
}
// Ramps are genuine sloped meshes, with the identical height equation as physics.
function rampGeometry(s){const x=s.w/2,z=s.l/2,y0=heightAt(s,s.z-z),y1=heightAt(s,s.z+z),v=[-x,y0,-z,x,y0,-z,x,y1,z,-x,y1,z,-x,y0-.45,-z,x,y0-.45,-z,x,y1-.45,z,-x,y1-.45,z];const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);geo.computeVertexNormals();return geo;}
for(const d of artWorld.destinations){drawingDestination=d.id;
 const t=themeMats[d.id],castle=d.kind==='castle',w=castle?68:80,l=castle?66:64,cz=d.z+(castle?-3:0);
 box(d.x,d.y-1.28,cz,w,2.4,l,t.edge);
 const rock=mesh(new THREE.ConeGeometry(w*.58,35,8),t.rock,d.x,d.y-19,cz);rock.rotation.z=Math.PI;rock.scale.z=l/w;
 for(let i=0;i<9;i++){const a=i*2.399,r=w*.33;const tooth=mesh(new THREE.ConeGeometry(4+i%3,13+i%4,5),t.rock,d.x+Math.sin(a)*r,d.y-9,cz+Math.cos(a)*r*.8);tooth.rotation.z=Math.PI;}
 if(castle){

  for(const x of [-27,27]){
   // Pier-supported open towers; wide staircase gallery enters the crown.
   for(const dx of [-4.6,4.6])box(d.x+x+dx,d.y+8,d.z-25,.7,16,8,t.edge);
   box(d.x+x,d.y+8,d.z-29.3,9,.0+16,.7,t.stone);
   for(let i=0;i<5;i++)box(d.x+x-4+i*2,d.y+18,d.z-29.3,1,2,1,t.stone);
   if(d.dark){const spire=mesh(new THREE.ConeGeometry(1.2,5,4),t.roof,d.x+x,d.y+21,d.z-29.3);spire.rotation.y=Math.PI/4;}
  }
  for(let x=-30;x<=30;x+=4)box(d.x+x,d.y+2.6,d.z-35.7,1.5,1.5,1,t.stone);
  // Slit-window insets and stone courses are procedural geometry, not textures.
  for(const x of [-4,0,4]){box(d.x+x,d.y+17,d.z-17.96,.65,2.7,.08,t.roof);box(d.x+x,d.y+13,d.z-17.9,.9,.18,.25,t.edge);}
  for(const x of [-27,27])for(const y of [4,8,12])box(d.x+x,d.y+y,d.z-29.71,1.1,1.9,.05,t.roof);
  for(const side of [-1,1]){
   for(let z=-26;z<9;z+=4)box(d.x+side*31.8,d.y+11.6,d.z+z,.75,.9,1.5,t.stone);
   // Outer foundation escarpment courses; none masquerades as a staircase.
   for(let z=-30;z<28;z+=8)box(d.x+side*34,d.y-1.1,d.z+z,.3,.45,7.6,t.rock);
   for(const z of [3,22]){const post=mesh(new THREE.CylinderGeometry(.15,.15,5,6),t.edge,d.x+side*30,d.y+2.5,d.z+z);const pennant=mesh(new THREE.PlaneGeometry(2.4,1.6),new THREE.MeshBasicMaterial({color:THEMES[d.id].accent,side:THREE.DoubleSide}),d.x+side*30+1.2,d.y+4,d.z+z);}
  }
  const glow=new THREE.PointLight(d.dark?0xb9638b:0xffcf83,d.dark?.6:.28,65*SCALE.horizontal,2);glow.position.set(d.x,d.y+17*SCALE.vertical,d.z-8*SCALE.horizontal);scene.add(glow);
  label(d.name,d.x,d.y+29,d.z-23,d.dark?'#edbad4':'#f6dfaa');
 }else label('Silo field  -  capture / firing placeholder',d.x,d.y+12,d.z-21);
}
for(const s of artWorld.surfaces){drawingDestination=s.destination;const t=themeMats[s.destination];if(s.slope)mesh(rampGeometry(s),t.stone,s.x,0,s.z);else box(s.x,s.y-.25,s.z,s.w,.5,s.l,s.name.includes('field')?t.ground:t.stone);
 // Small gold centreline tiles make real ascent entrances easy to find.
 if(s.slope)for(let i=0;i<7;i++){const z=s.z-s.l/2+(i+.5)*s.l/7;const m=box(s.x,heightAt(s,z)+.02,z,.25,.025,.7,t.accent);m.rotation.x=-Math.atan(s.slope);}
}
for(const w of artWorld.walls){drawingDestination=w.destination;if(w.deck)continue;const t=themeMats[w.destination];box(w.x,(w.bottom+w.top)/2,w.z,w.w,w.top-w.bottom,w.l,t[w.id.includes('crate')?'roof':'edge']);}
for(const silo of artWorld.decor){drawingDestination='island';const t=themeMats.island;cylinder(silo.x,silo.y+4,silo.z,3.3,8,t.stone);cylinder(silo.x,silo.y+.08,silo.z,7,.1,t.edge);label('SILO '+silo.number+'  -  PLACEHOLDER',silo.x,silo.y+13,silo.z);}
for(const r of artWorld.roofs){drawingDestination=r.destination;const roof=mesh(new THREE.ConeGeometry(r.radius,r.top-r.bottom,r.sides),themeMats[r.destination].roof,r.x,(r.bottom+r.top)/2,r.z);roof.rotation.y=r.rotation;roof.scale.z=r.scaleZ;roof.name='roof:'+r.id;}
const padMeshes=[];
for(const p of artWorld.pads){drawingDestination=p.id;const t=themeMats[p.id];cylinder(p.x,p.y+.035,p.z,3.2,.07,t.edge);const ring=mesh(new THREE.RingGeometry(2.7,3.1,32),new THREE.MeshBasicMaterial({color:THEMES[p.id].accent,side:THREE.DoubleSide}),p.x,p.y+.085,p.z);ring.rotation.x=-Math.PI/2;padMeshes.push(ring);
 // Pod launch rails outside collision-safe landing centre.
 for(const x of [-2.1,2.1]){box(p.x+x,p.y+.55,p.z, .35,1.1,3,t.stone);box(p.x+x,p.y+1.8,p.z-1.4,.35,2.5,.35,t.accent);}
 label('POD  -  '+p.name,p.x+13,p.y+5,p.z+2);
}
const cameraObstacles=meshes.slice();drawingDestination=null;
// Temporary non-character explorer marker: no inference about owner cast/art.
const character=createWorldCharacter({worldHeight:2.1});const converted=new Set();character.root.traverse(o=>{if(!o.material)return;for(const m of Object.values(o.material.userData.variants||{flat:o.material})){if(converted.has(m))continue;converted.add(m);if(m.color)m.color.convertSRGBToLinear();if(m.uniforms?.baseColor)m.uniforms.baseColor.value.convertSRGBToLinear();}});let characterPose='idle',previousX=state.x,previousZ=state.z,previousGrounded=state.grounded;character.setPose(characterPose);
const marker=new THREE.Group();marker.visible=false;const actor=new THREE.Group();actor.add(character.root,marker);scene.add(actor);const markerM=new THREE.MeshBasicMaterial({color:0xffeaca});
const body=new THREE.Mesh(new THREE.CylinderGeometry(.36,.5,1.05,6),markerM);body.position.y=.85;marker.add(body);const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,0),markerM);head.position.y=1.65;marker.add(head);const arrow=new THREE.Mesh(new THREE.ConeGeometry(.18,.5,4),new THREE.MeshBasicMaterial({color:0x6cdeef}));arrow.rotation.x=Math.PI/2;arrow.position.set(0,1.1,.52);marker.add(arrow);
const shadow=mesh(new THREE.CircleGeometry(.65,20),new THREE.MeshBasicMaterial({color:0x182337,transparent:true,opacity:.45,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),state.x,.04,state.z);shadow.rotation.x=-Math.PI/2;
const pod=new THREE.Group();scene.add(pod);const hull=new THREE.Mesh(new THREE.SphereGeometry(1.5,10,6),themeMats.bright.edge);hull.scale.set(1,.45,1.4);hull.position.y=-.4;pod.add(hull);const flame=new THREE.Mesh(new THREE.ConeGeometry(.65,3,6),new THREE.MeshBasicMaterial({color:0x8ce8ff}));flame.position.y=-2.3;pod.add(flame);pod.visible=false;
const trailGeo=new THREE.BufferGeometry(),trailArray=new Float32Array(90*3);trailGeo.setAttribute('position',new THREE.BufferAttribute(trailArray,3));const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0x9fe9ff,transparent:true,opacity:.7}));scene.add(trail);trail.visible=false;let flightToken=null;
// Celestial atmosphere uses authored geometry; no generated final images.
const moon=mesh(new THREE.SphereGeometry(23,16,10),new THREE.MeshBasicMaterial({color:0xecc7bc}),-155,85,-270);
const keys=new Set(),stick={x:0,y:0,pointer:null},orbit={pointer:null,x:0,y:0},held={},heldPointers={};
function clearInput(){keys.clear();stick.x=stick.y=0;stick.pointer=null;orbit.pointer=null;for(const k of Object.keys(held)){held[k]=false;heldPointers[k]=null;}$('stick').querySelector('i').style.transform='';}
let pauseFocus=null;function setPause(value,reason='Journey held safely.'){const wasPaused=state.paused;if(value&&!wasPaused)pauseFocus=document.activeElement;state.paused=value;clearInput();$('pausePanel').hidden=!value;$('pauseReason').textContent=reason;$('pause').textContent=value?'Resume':'Pause';for(const node of document.body.children)if(node instanceof HTMLElement&&node!==$('pausePanel')&&node.tagName!=='SCRIPT')node.inert=value;if(value)$('resume').focus();else if(wasPaused){const previous=pauseFocus;pauseFocus=null;(previous?.isConnected&&previous.matches('button,a[href],input,select,textarea,[tabindex]')&&previous.getClientRects().length?previous:$('pause')).focus();}}
function doReset(){setPause(false);reset(state,world);wideView=false;$('viewToggle').textContent='Walk view';resize();character.reset();characterPose='idle';character.setPose(characterPose);previousX=state.x;previousZ=state.z;previousGrounded=state.grounded;previousGrounded=true;clearInput();yaw=.28;elevation=.67;distance=80;captureCamera=false;scene.fog.near=400;scene.fog.far=1100;target.set(state.x,state.y+(wideView?6:2.5),state.z-(wideView?6:0));flightToken=null;trail.visible=pod.visible=false;$('pausePanel').hidden=true;$('pause').textContent='Pause';}
function press(e){if(state.paused&&e.key==='Tab'){e.preventDefault();const buttons=[$('resume'),$('rescue')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.shiftKey?-1:1)+2)%2].focus();return;}if(e.target.matches('input,select,textarea,[contenteditable="true"]'))return;const k=e.key.toLowerCase();if(e.target.matches('button')&&(k===' '||k==='enter'))return;if(['w','a','s','d','q','e','p','r','arrowup','arrowdown','arrowleft','arrowright',' ','c','z','control','+','=','-','_'].includes(k))e.preventDefault();if(e.repeat&&!keys.has(k))return;if(!e.repeat){if(k==='p'){setPause(!state.paused);return;}if(k==='r'){doReset();return;}}if(!state.paused)keys.add(k);}
addEventListener('keydown',press);addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>setPause(true,'Focus lost  -  movement and pod flight are paused.'));document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true,'Tab hidden  -  resume when ready.');});
$('pause').onclick=()=>setPause(!state.paused);$('resume').onclick=()=>setPause(false);$('rescue').onclick=()=>{castleRecovery(state,world);setPause(false);recenterRecoveryCamera();};$('reset').onclick=doReset;
for(const [id,panel]of [['mapToggle','map'],['optionsToggle','options']])$(id).onclick=()=>{const show=$(panel).hidden;for(const p of ['map','options'])$(p).hidden=true;$(panel).hidden=!show;};
$('pixel').onchange=e=>{pixel=e.target.checked;resize();};$('snap').onchange=e=>{snap=e.target.checked;snapUniform.value=+snap;};$('lighting').onchange=e=>{lighting=e.target.value;for(const m of meshes){const pair=materials.find(p=>p.toon===m.material||p.palette===m.material);if(pair)m.material=pair[lighting];}for(const m of [hull]){const pair=materials.find(p=>p.toon===m.material||p.palette===m.material);if(pair)m.material=pair[lighting];}};
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||state.paused||orbit.pointer!==null)return;orbit.pointer=e.pointerId;orbit.x=e.clientX;orbit.y=e.clientY;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(orbit.pointer!==e.pointerId)return;yaw-=(e.clientX-orbit.x)*.007;elevation=THREE.MathUtils.clamp(elevation+(e.clientY-orbit.y)*.005,.35,1.22);orbit.x=e.clientX;orbit.y=e.clientY;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(orbit.pointer===e.pointerId)orbit.pointer=null;});
canvas.addEventListener('wheel',e=>{distance=THREE.MathUtils.clamp(distance+e.deltaY*.04,40,240);e.preventDefault();},{passive:false});
const stickEl=$('stick');function stickMove(e){const b=stickEl.getBoundingClientRect(),dx=e.clientX-b.x-b.width/2,dy=e.clientY-b.y-b.height/2,n=Math.max(36,Math.hypot(dx,dy));stick.x=dx/n;stick.y=dy/n;stickEl.querySelector('i').style.transform=`translate(${stick.x*32}px,${stick.y*32}px)`;}
stickEl.onpointerdown=e=>{if(e.button!==0||stick.pointer!==null||state.paused)return;stick.pointer=e.pointerId;stickEl.setPointerCapture(e.pointerId);stickMove(e);};stickEl.onpointermove=e=>{if(stick.pointer===e.pointerId)stickMove(e);};for(const type of ['pointerup','pointercancel','lostpointercapture'])stickEl.addEventListener(type,e=>{if(stick.pointer!==e.pointerId)return;stick.pointer=null;stick.x=stick.y=0;stickEl.querySelector('i').style.transform='';});
for(const id of ['left','right','zoomIn','zoomOut','rise','descend']){const b=$(id);b.onpointerdown=e=>{if(e.button!==0||state.paused||heldPointers[id]!=null)return;heldPointers[id]=e.pointerId;held[id]=true;b.setPointerCapture(e.pointerId);};for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{if(heldPointers[id]!==e.pointerId)return;heldPointers[id]=null;held[id]=false;});}
$('freePilot').onclick=()=>{clearInput();pilot(state);};$('guidePod').onclick=()=>{clearInput();guide(state,world);};$('returnCastle').onclick=()=>{castleRecovery(state,world);clearInput();recenterRecoveryCamera();};
let wideView=false,cameraObstructed=false;const cameraRay=new THREE.Raycaster(),cameraDirection=new THREE.Vector3(),cameraGoal=new THREE.Vector3(),closeAim=new THREE.Vector3();$('viewToggle').onclick=()=>{wideView=!wideView;distance=wideView?150:80;$('viewToggle').textContent=wideView?'Wide view':'Walk view';resize();};
$('actor').onchange=e=>{const model=e.target.value==='chibi';character.root.visible=model;marker.visible=!model;};
const landingRing=mesh(new THREE.RingGeometry(1.3,1.6,32),new THREE.MeshBasicMaterial({color:0x87efb6,side:THREE.DoubleSide,depthWrite:false}),0,0,0);landingRing.rotation.x=-Math.PI/2;landingRing.visible=false;
let currentPad=null;
function hud(){const p=nearPad(state,world);if(p?.id!==currentPad){currentPad=p?.id;$('routes').replaceChildren();if(p)for(const dest of world.pads.filter(d=>d.id!==p.id)){const b=document.createElement('button');b.textContent=dest.name;b.dataset.destination=dest.id;b.onclick=()=>{if(launch(state,world,dest.id)){clearInput();$('travelPanel').hidden=true;}};$('routes').append(b);}}
 $('travelPanel').hidden=!p||state.paused||!$('map').hidden||!$('options').hidden;
 const d=world.destinations.find(d=>d.id===state.destination);$('place').textContent=state.travel?'Pod  ->  '+state.travel.end.name:d.name;
 const floor=world.surfaces.find(s=>s.id===state.support);$('level').textContent=state.travel?(state.travel.mode==='free'?'Arc flight':'Guided flight')+'  -  altitude '+Math.round(state.y)+' m':state.grounded?(floor?.name||'Ground'):'Falling  -  automatic recovery below';
 $('status').textContent=state.travel?(state.travel.mode==='guided'?'Guided trip  -  steer to take over.':(()=>{const f=landingAt(world,state.x,state.z,state.y);return f?((f.valid?'Open landing: ':'Blocked landing: ')+f.floor.name+'  -  '+Math.round(state.y-f.y)+' m below'):'Open sky  -  steer toward a floor, then descend.';})()):p?'You are on the launch pad. Choose a destination.':'Follow gold ramp tiles to climb. Fall recovery: '+world.pads.find(p=>p.id===state.homeCastle).name;
 $('flightPanel').hidden=!state.travel||state.paused||!$('map').hidden||!$('options').hidden;$('flightMode').textContent=state.travel?.mode==='free'?'Free pilot  -  release keeps momentum':'Guided flight  -  steer to take over';
 const destination=state.travel?.end||world.pads.find(p=>p.id===state.homeCastle);const bearing=Math.atan2(destination.x-state.x,-(destination.z-state.z)),degrees=((bearing*180/Math.PI+360)%360).toFixed(0);$('navigation').textContent=(state.travel?'Target: ':'Castle: ')+destination.name+'  -  '+Math.round(Math.hypot(destination.x-state.x,destination.z-state.z))+' m  -  bearing '+degrees+' degrees';
 document.body.dataset.flight=String(!!state.travel);
}
const target=new THREE.Vector3(state.x,state.y+2.5,state.z),desired=new THREE.Vector3();
function resize(){const factor=pixel?.5:1;renderer.setSize(Math.max(1,Math.floor(innerWidth*factor)),Math.max(1,Math.floor(innerHeight*factor)),false);camera.aspect=innerWidth/innerHeight;if(innerWidth<600&&!wideView)camera.setViewOffset(innerWidth,innerHeight,0,-innerHeight*.16,innerWidth,innerHeight);else camera.clearViewOffset();camera.updateProjectionMatrix();gridUniform.value.set(innerWidth*.25,innerHeight*.25);}
addEventListener('resize',()=>{clearInput();resize();});resize();
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true,'Graphics interrupted  -  waiting for restoration. Reset or return to the last pad after recovery.');});
canvas.addEventListener('webglcontextrestored',()=>setPause(true,'Graphics restored  -  resume your held journey or return to the last pad.'));
let cameraFalls=state.falls;
function recenterRecoveryCamera(){target.set(state.x,state.y+(wideView?6:2.5),state.z-(wideView?6:0));render(0);}
function render(dt){
 if(cameraFalls!==state.falls){cameraFalls=state.falls;target.set(state.x,state.y+(wideView?6:2.5),state.z-(wideView?6:0));}
 actor.position.set(state.x,state.y,state.z);actor.rotation.y=state.facing;
 const moving=previousGrounded&&Math.hypot(state.x-previousX,state.z-previousZ)>.001;
 const pose=state.travel||!state.grounded?'neutral':moving?'walk':'idle';
 if(!state.paused){if(pose!==characterPose){character.setPose(pose);characterPose=pose;}character.update(dt);}previousX=state.x;previousZ=state.z;previousGrounded=state.grounded;
 const landing=state.travel?.mode==='free'?landingAt(world,state.x,state.z,state.y):null;landingRing.visible=!!landing&&state.y-landing.y<40;
 if(landing){landingRing.position.set(state.x,landing.y+.07,state.z);landingRing.rotation.x=-Math.PI/2-Math.atan(landing.floor.slope);landingRing.material.color.setHex(landing.valid?0x87efb6:0xf09c91);}

 const floor=supportAt(world,state.x,state.z,state.y+.01);shadow.visible=!!floor&&!state.travel;shadow.position.set(state.x,floor?heightAt(floor,state.z)+.045:state.y,state.z);shadow.material.opacity=state.grounded?.45:.16;
 if(floor){shadow.rotation.set(-Math.PI/2-Math.atan(floor.slope),0,0);}
 pod.visible=!!state.travel;trail.visible=!!state.travel;
 if(state.travel){const t=state.travel;pod.position.copy(actor.position);pod.rotation.y=state.facing;flame.scale.y=.85+Math.sin(state.time*26)*.15;if(flightToken!==t){flightToken=t;for(let i=0;i<90;i++)trailArray.set([state.x,state.y-1,state.z],i*3);}if(t.mode==='free'){if(!state.paused){trailArray.copyWithin(3,0,267);trailArray.set([state.x,state.y-1,state.z],0);}}else{const u=t.elapsed/t.duration;for(let i=0;i<90;i++){const v=Math.max(0,u-i*.0035);trailArray[i*3]=t.start.x+(t.end.x-t.start.x)*v;trailArray[i*3+1]=t.start.y+(t.end.y-t.start.y)*v+4*TUNE.flightLift*v*(1-v)-1;trailArray[i*3+2]=t.start.z+(t.end.z-t.start.z)*v;}}trailGeo.attributes.position.needsUpdate=true;trailGeo.computeBoundingSphere();}else flightToken=null;
 desired.set(state.x,state.y+(wideView?6:2.5),state.z-(wideView?6:0));target.lerp(desired,1-Math.exp(-7*dt));const r=(state.travel?Math.max(distance,68):distance)*(innerWidth<600?1.15:1);
 if(!captureCamera){cameraGoal.set(target.x+Math.sin(yaw)*Math.cos(elevation)*r,target.y+Math.sin(elevation)*r,target.z+Math.cos(yaw)*Math.cos(elevation)*r);closeAim.set(state.x,state.y+1.05,state.z);cameraDirection.copy(cameraGoal).sub(closeAim).normalize();scene.updateMatrixWorld(true);cameraRay.set(closeAim,cameraDirection);cameraRay.far=cameraGoal.distanceTo(closeAim);const hit=!wideView&&!state.travel?cameraRay.intersectObjects(cameraObstacles,false)[0]:null;cameraObstructed=!!hit;if(hit){camera.position.copy(closeAim).addScaledVector(cameraDirection,Math.max(.4,hit.distance-.3));closeAim.set(state.x,state.y+1.05,state.z);camera.lookAt(closeAim);camera.clearViewOffset();camera.near=hit.distance<4?.2:2;}else{camera.position.copy(cameraGoal);camera.lookAt(target);camera.near=2;if(innerWidth<600&&!wideView)camera.setViewOffset(innerWidth,innerHeight,0,-innerHeight*.16,innerWidth,innerHeight);else camera.clearViewOffset();}camera.updateProjectionMatrix();}renderer.render(scene,camera);hud();
}
let last=performance.now(),acc=0;function loop(now){const dt=Math.min(.1,(now-last)/1000);last=now;acc+=dt;while(acc>=1/120){if(!state.paused){yaw+=((keys.has('e')||held.right?1:0)-(keys.has('q')||held.left?1:0))*1.6/120;distance=THREE.MathUtils.clamp(distance+(((held.zoomOut||keys.has('-')||keys.has('_'))?1:0)-((held.zoomIn||keys.has('+')||keys.has('='))?1:0))*.15,40,240);}const right=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x,forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)-stick.y;const wasFlying=!!state.travel;const intent=cameraInput(right,forward,yaw);intent.climb=(keys.has(' ')||keys.has('c')||held.rise?1:0)-(keys.has('z')||keys.has('control')||held.descend?1:0);step(state,world,intent,1/120);if(wasFlying&&!state.travel)clearInput();acc-=1/120;}render(dt);requestAnimationFrame(loop);}requestAnimationFrame(loop);
// Scoped acceptance hook exists only on an explicitly requested local test URL.
if(new URLSearchParams(location.search).has('test'))window.__demo={world,state,step:input=>step(state,world,input,1/120),launch:id=>launch(state,world,id),pilot:()=>pilot(state),guide:id=>guide(state,world,id),castleRecovery:()=>castleRecovery(state,world),reset:doReset,recover:()=>recover(state,world),pause:setPause,render:()=>render(1),setCamera:(y,e,d)=>{yaw=y;elevation=e;distance=d;target.set(state.x,state.y+(wideView?6:2.5),state.z-(wideView?6:0));render(1);},setLook:(mode)=>{$('lighting').value=mode;$('lighting').dispatchEvent(new Event('change'));},overview:()=>{camera.near=2;camera.clearViewOffset();camera.updateProjectionMatrix();captureCamera=true;scene.fog.near=700;scene.fog.far=1600;camera.position.set(0,450,610);camera.lookAt(0,0,-155);render(1);},cameraStatus:()=>({obstructed:cameraObstructed,wideView}),camera,renderer,scene,actor,character,marker,landingRing,landingAt:(x,z,y)=>landingAt(world,x,z,y),shadow,pod,trail,input:{keys,stick,held},zoomDistance:()=>distance,resources:()=>({...renderer.info.memory,programs:renderer.info.programs.length,calls:renderer.info.render.calls})};
addEventListener('pagehide',()=>character.dispose());
addEventListener('error',e=>{$('error').hidden=false;$('error').textContent='Environment could not continue: '+e.message+'. Reload this local preview or inspect the console.';});






// Keep portrait panels below the reflowed heading/status and above controls.
const hudObserver=new ResizeObserver(()=>{document.documentElement.style.setProperty('--hud-bottom',$('location').getBoundingClientRect().bottom+'px');document.documentElement.style.setProperty('--footer-height',document.querySelector('footer').getBoundingClientRect().height+'px');document.documentElement.style.setProperty('--touch-top',$('touch').getBoundingClientRect().top+'px');});for(const node of [document.querySelector('header'),$('location'),document.querySelector('footer'),$('touch')])hudObserver.observe(node);
