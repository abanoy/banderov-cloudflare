import {readSavedStudy} from './saved-study.js';
import {applyCourtyardBackground} from './courtyard-background.js';
import * as THREE from './vendor/three/package/build/three.module.js';
import {directionIndex, screenMotion, constrainMove, settleHeading} from './movement-math.js';

// Renderer authority is the same classic src/chibi8.js as the drawing workshop.
// Cached textures are browser rasterizations of its SVG; no AI/static art sheets.
const $=id=>document.getElementById(id),stage=$('stage');
const labels=['Front','Front-right','Right','Back-right','Back','Back-left','Left','Front-left'];
const scene=new THREE.Scene();scene.background=new THREE.Color('#bcc9c2');
const camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,100);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xfff8e8,0x556760,2));
const sunlight=new THREE.DirectionalLight(0xffecd0,2);sunlight.position.set(-8,14,6);scene.add(sunlight);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,28),new THREE.MeshLambertMaterial({color:'#c6ccb9'}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const grid=new THREE.GridHelper(28,28,0x8a9c90,0xaeb8a5);grid.position.y=.008;scene.add(grid);
$('sceneBackground').onchange=()=>{applyCourtyardBackground($('sceneBackground').value,scene,floor,grid);stage.dataset.background=$('sceneBackground').value;};
stage.dataset.background='courtyard';
// Pillars provide actual depth occlusion; walls/colour patches locate the arena.
const obstacles=[{x:-4,z:-3,r:.9},{x:4,z:2,r:.9}];
for(const p of obstacles){const column=new THREE.Mesh(new THREE.CylinderGeometry(.7,.9,2.7,6),new THREE.MeshLambertMaterial({color:'#9eaba2'}));column.position.set(p.x,1.35,p.z);scene.add(column);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,.2,6),new THREE.MeshLambertMaterial({color:'#dee0ce'}));cap.position.set(p.x,2.75,p.z);scene.add(cap);}
for(const [x,z,color] of [[-7,-7,'#728d85'],[7,-7,'#c3a276'],[-7,7,'#a699ac'],[7,7,'#809fa7']]){const tile=new THREE.Mesh(new THREE.BoxGeometry(2,.07,2),new THREE.MeshLambertMaterial({color}));tile.position.set(x,.04,z);scene.add(tile);}
const shadow=new THREE.Mesh(new THREE.CircleGeometry(.48,32),new THREE.MeshBasicMaterial({color:0x4f6258,transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;scene.add(shadow);
const material=new THREE.SpriteMaterial({transparent:true,alphaTest:.15,depthWrite:true,toneMapped:false});
const sprite=new THREE.Sprite(material);sprite.scale.set(2,2.71,1);sprite.center.set(.5,10/271);scene.add(sprite);
const keys=new Set();let padVector=null,cache=[],generation=0,worldHeading=0,step=0,moving=false,demo=false,demoTime=0,phase=0,last=performance.now(),lastFacing=-1;
let position={x:0,z:0},cameraAz=0;
let facingState={heading:0,active:false,candidate:null,age:0};

let importedStudy=null;
function character(){
 if(importedStudy)return {...importedStudy.character,expression:$('expression').value,pose:$('pose').value};
 const brown=$('character').value==='mariaBrown';
 $('bodyConstruction').disabled=!brown||!['sailor','whiteBlouse'].includes($('outfit').value);
 $('outfit').disabled=!brown;$('bodyWidth').disabled=!brown;
 $('bodyWidthValue').textContent=(brown?Math.round(Number($('bodyWidth').value)*100):100)+'%';
 $('pose').querySelector('option[value=alarmed]').disabled=!brown;
 if(!brown&&$('pose').value==='alarmed')$('pose').value='relaxed';
 $('eyeOpeningStudy').disabled=!brown||$('expression').value!=='neutral';
 const c={...STUDY_CHARS[$('character').value],expression:$('expression').value,paint:'flat',pose:$('pose').value,outfit:brown?$('outfit').value:undefined,bodyScaleX:brown?Number($('bodyWidth').value):1};
 return chibiBodyConstructionStudy(chibiEyeStudy(c,$('eyeOpeningStudy').value),$('bodyConstruction').value);
}
$('studyFile').onchange=async()=>{
 const file=$('studyFile').files[0];if(!file)return;
 try{
  const study=readSavedStudy(await file.text(),chibi8SVG);
  importedStudy=study;reset();$('character').value=study.characterKey;
  $('outfit').value=study.character.outfit||'sketch';$('expression').value=study.character.expression||'neutral';$('pose').value=study.character.pose||'relaxed';
  $('pose').querySelector('option[value=alarmed]').disabled=study.characterKey!=='mariaBrown';
  for(const id of ['character','outfit','bodyWidth','eyeOpeningStudy','bodyConstruction'])$(id).disabled=true;
  $('bodyWidthValue').textContent=Math.round((study.character.bodyScaleX??1)*100)+'%';
  $('clearStudy').disabled=false;$('studyStatus').textContent='Saved study: '+file.name+' · editable geometry · expression and pose remain adjustable.';
  stage.dataset.study='saved';await buildTextures();
 }catch(error){$('studyStatus').textContent='Could not open study: '+error.message;}
};
$('clearStudy').onclick=async()=>{importedStudy=null;for(const id of ['character','outfit','bodyWidth','eyeOpeningStudy','bodyConstruction'])$(id).disabled=false;$('studyFile').value='';$('clearStudy').disabled=true;$('studyStatus').textContent='Current renderer settings. Saved study cleared.';stage.dataset.study='current';reset();await buildTextures();};
stage.dataset.study='current';
function svgAt(yaw,walkPhase=0){return chibi8SVG({...character(),walkPhase},yaw/45);}
function updatePreview(index){const n=Number($('facing').value),yaw=index*360/n;
 $('facingPreview').innerHTML=svgAt(yaw);$('movementStatus').textContent=`${labels[Math.round(yaw/45)%8]} · ${yaw}° · ${moving?'walking':'idle'}`;
 for(const b of $('directions').children)b.setAttribute('aria-pressed',String(Number(b.dataset.direction)===index));
 stage.dataset.direction=String(yaw);stage.dataset.x=position.x.toFixed(3);stage.dataset.z=position.z.toFixed(3);
}
async function buildTextures(){const token=++generation;$('ready').textContent='Preparing editable character…';demo=false;$('demo').textContent='Walk all eight directions';
 $('outfitReference').src=$('character').value==='mariaBrown'&&$('outfit').value==='sailor'?'references/NewCanvas3.png':$('character').value==='mariaBrown'&&$('outfit').value==='whiteBlouse'?'references/Teaser.png':'references/TheTwoMarias.png';
 $('capture').disabled=true;
 const n=Number($('facing').value),created=[];
 try{for(let frame=0;frame<4;frame++)for(let i=0;i<n;i++){let svg=svgAt(i*360/n,frame/4);const bounds=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number),footY=Number(svg.match(/data-foot-y="([^"]+)"/)?.[1]??234);
  const textureWidth=Math.round(bounds[2]*2),textureHeight=Math.round(bounds[3]*2);
  svg=svg.replace('<svg ',`<svg width="${textureWidth}" height="${textureHeight}" `);
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),img=new Image();
  try{img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=textureWidth;canvas.height=textureHeight;canvas.getContext('2d').drawImage(img,0,0,textureWidth,textureHeight);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   texture.userData.bounds=bounds;texture.userData.footY=footY;created.push(texture);}finally{URL.revokeObjectURL(url);}
 }
 if(token!==generation){created.forEach(t=>t.dispose());return;}
 const old=cache;cache=created;lastFacing=-1;material.map=cache[0];material.needsUpdate=true;old.forEach(t=>t.dispose());
 const bounds=cache[0].userData.bounds;sprite.scale.set(bounds[2]/100,bounds[3]/100,1);sprite.center.set((100-bounds[0])/bounds[2],(bounds[1]+bounds[3]-cache[0].userData.footY)/bounds[3]);resize();
 $('ready').textContent=`Ready · ${n} editable views · four paper steps`;$('capture').disabled=false;
 $('directionsTitle').textContent=n===8?'All eight views':'Eight views and their intermediate turns';
 $('directions').innerHTML='';for(let i=0;i<n;i++){const yaw=i*360/n,label=i*8%n===0?labels[i*8/n]:`${yaw}°`;const b=document.createElement('button');b.dataset.direction=i;b.setAttribute('aria-label',`Face ${label}`);b.innerHTML=svgAt(yaw)+`<span>${label}</span>`;b.onclick=()=>{demo=false;$('demo').textContent='Walk all eight directions';worldHeading=cameraAz+i*Math.PI*2/n;};$('directions').append(b);}
 }catch(error){created.forEach(t=>t.dispose());$('ready').textContent='Character textures failed to load.';console.error(error);}
}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);const viewHeight=sprite.scale.y*h/Number($('size').value);camera.left=-viewHeight*w/h/2;camera.right=-camera.left;camera.top=viewHeight/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);
for(const id of ['character','expression','facing','outfit','pose','bodyWidth','eyeOpeningStudy','bodyConstruction'])$(id).addEventListener('change',buildTextures);
$('bodyWidth').oninput=()=>{$('bodyWidthValue').textContent=Math.round(Number($('bodyWidth').value)*100)+'%';};
$('size').oninput=()=>{$('sizeValue').textContent=$('size').value+' px';resize();};
// Frozen inspection uses the same cached geometry; live is the default.
$('walk').onchange=()=>{$('stepPreview').disabled=!$('walk').checked;};
$('orbit').oninput=()=>{cameraAz=Number($('orbit').value)*Math.PI/180;$('orbitValue').textContent=$('orbit').value+'°';};
// Draw synchronously before reading pixels; avoid persistent drawing-buffer overhead.
$('capture').onclick=()=>{
 renderer.render(scene,camera);
 const link=$('captureSave');link.href=renderer.domElement.toDataURL('image/png');
 link.download='maria-courtyard-'+$('outfit').value+'-'+$('expression').value+'-'+$('pose').value+'-'+(step*360/Number($('facing').value))+'deg-'+$('size').value+'px-body'+Math.round((character().bodyScaleX??1)*100)+'-eye'+($('eyeOpeningStudy').disabled?'current':$('eyeOpeningStudy').value)+'.png';
 link.download=link.download.replace('.png','-bg'+$('sceneBackground').value+'.png');
 if(importedStudy)link.download=link.download.replace('.png','-saved-study.png');
 $('captureImage').src=link.href;
 $('captureCaption').textContent=`${$('character').selectedOptions[0].textContent} · ${$('character').value==='mariaTeal'?'Teal costume study':$('outfit').selectedOptions[0].textContent} · ${$('expression').value} · ${$('pose').value} · ${importedStudy?'Saved face parameters':$('eyeOpeningStudy').disabled?'Current sleepy eyes':$('eyeOpeningStudy').selectedOptions[0].textContent} · ${step*360/Number($('facing').value)}° · ${$('walk').checked?$('stepPreview').selectedOptions[0].textContent:'Resting (paper steps off)'} · ${$('size').value} px padded sprite height · ${Math.round((character().bodyScaleX??1)*100)}% body width · scene zoom`;
 $('captureCaption').textContent+=' · '+$('sceneBackground').selectedOptions[0].textContent+(importedStudy?' · saved workshop geometry':'');
 $('sceneCapture').hidden=false;$('sceneCapture').open=true;
};
function reset(){position={x:0,z:0};phase=0;worldHeading=cameraAz;facingState={heading:worldHeading,active:false,candidate:null,age:0};keys.clear();padVector=null;demo=false;$('demo').textContent='Walk all eight directions';}
$('reset').onclick=reset;$('demo').onclick=()=>{demo=!demo;demoTime=0;keys.clear();padVector=null;$('demo').textContent=demo?'Stop walking demo':'Walk all eight directions';};
$('placement').onchange=()=>{const choice=$('placement').value;if(!choice)return;
 reset();position={x:-4,z:choice==='behind'?-4.6:.4};
 cameraAz=0;$('orbit').value='0';$('orbitValue').textContent='0°';
 $('follow').checked=false;worldHeading=0;
 $('placement').value='';
};
const pad=[['↖',-1,-1],['↑',0,-1],['↗',1,-1],['←',-1,0],['•',0,0],['→',1,0],['↙',-1,1],['↓',0,1],['↘',1,1]];
for(const [label,x,y] of pad){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',x||y?`Walk ${label}`:'Stop walking');
 b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);demo=false;keys.clear();padVector={x,y};$('demo').textContent='Walk all eight directions';};
 b.onpointerup=b.onpointercancel=()=>{padVector=null;};$('pad').append(b);}
function inputTarget(e){return /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);}
stage.onclick=()=>stage.focus();
window.addEventListener('keydown',e=>{if(inputTarget(e))return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){e.preventDefault();keys.add(key);demo=false;$('demo').textContent='Walk all eight directions';}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();padVector=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();padVector=null;demo=false;$('demo').textContent='Walk all eight directions';}last=performance.now();});
function tick(now){const dt=Math.min((now-last)/1000,.05);last=now;
 let v=padVector||{x:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y:Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))};
 if(demo){demoTime+=dt;const angle=Math.floor(demoTime/1.2)%8*Math.PI/4;v={x:Math.sin(angle),y:Math.cos(angle)};}
 const motion=screenMotion(v.x,v.y,cameraAz);moving=motion.length>0&&cache.length>0;
 facingState=settleHeading({...facingState,heading:worldHeading},motion.heading,moving,dt);worldHeading=facingState.heading;
 if(moving){const speed=keys.has('shift')?4.5:2.5;position=constrainMove(position,motion.x*speed*dt,motion.z*speed*dt,obstacles);phase+=dt*10;}
 sprite.position.set(position.x,$('bob').checked&&moving?Math.abs(Math.sin(phase))*.06:0,position.z);shadow.position.set(position.x,.015,position.z);
 const target=$('follow').checked?new THREE.Vector3(position.x,0,position.z):new THREE.Vector3(0,0,0);
 camera.position.set(target.x+Math.sin(cameraAz)*18,16,target.z+Math.cos(cameraAz)*18);camera.lookAt(target);
 step=directionIndex(worldHeading-cameraAz,Number($('facing').value));const previewStep=$('stepPreview').value;const walkFrame=$('walk').checked?(previewStep==='live'?(moving?Math.floor(phase/(Math.PI*2)*4)%4:0):Number(previewStep)):0;const textureIndex=walkFrame*Number($('facing').value)+step;if(cache[textureIndex]){material.map=cache[textureIndex];if(textureIndex!==lastFacing){updatePreview(step);$('facingPreview').innerHTML=svgAt(step*360/Number($('facing').value),walkFrame/4);lastFacing=textureIndex;}}stage.dataset.walkFrame=String(walkFrame);
 // Status positions remain observable for local movement checks.
 updatePreviewStatus();renderer.render(scene,camera);requestAnimationFrame(tick);
}
function updatePreviewStatus(){stage.dataset.x=position.x.toFixed(3);stage.dataset.z=position.z.toFixed(3);stage.dataset.moving=String(moving);$('movementStatus').textContent=`${labels[Math.round(step*8/Number($('facing').value))%8]} · ${step*360/Number($('facing').value)}° · ${moving?'walking':'idle'}`;}
resize();buildTextures();requestAnimationFrame(tick);
