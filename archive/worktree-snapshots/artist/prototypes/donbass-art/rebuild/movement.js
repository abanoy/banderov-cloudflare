import * as THREE from '../vendor/three/package/build/three.module.js';
import {draw} from './app.js';
import {DIRECTIONS} from './chibi8.js';
const $=id=>document.getElementById(id),stage=$('stage');
const scene=new THREE.Scene();scene.background=new THREE.Color('#d2dcca');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.append(renderer.domElement);
const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,100);camera.position.set(0,10,14);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x667961,2));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(32,24),new THREE.MeshLambertMaterial({color:'#c4d0b7'}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const grid=new THREE.GridHelper(32,32,0x95a88b,0xb2c1a5);grid.position.y=.005;scene.add(grid);
for(const [x,z] of [[-4,-2],[4,2]]){const box=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.5,1.2),new THREE.MeshLambertMaterial({color:'#9dac97'}));box.position.set(x,.75,z);scene.add(box);}
const shadow=new THREE.Mesh(new THREE.CircleGeometry(.28,24),new THREE.MeshBasicMaterial({color:0x52674a,transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;scene.add(shadow);
const material=new THREE.SpriteMaterial({transparent:true,alphaTest:.08,depthWrite:true,toneMapped:false});const sprite=new THREE.Sprite(material);sprite.center.set(.5,10/192);sprite.scale.set(160/192,1,1);sprite.position.set(0,.015,0);scene.add(sprite);
let textures=[],build=0,keys=new Set(),pad=null,x=0,z=0,direction=0,phase=0,last=performance.now(),current=-1;
let candidate=0,settle=0,previousStatus='';
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);const visibleHeight=h/Number($('gameSize').value);camera.top=visibleHeight/2;camera.bottom=-camera.top;camera.right=visibleHeight*w/h/2;camera.left=-camera.right;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);$('gameSize').onchange=resize;
async function bake(){const token=++build,made=[];stage.dataset.ready='false';$('movementStatus').textContent='Preparing eight directions…';try{
 for(let frame=0;frame<5;frame++)for(let i=0;i<8;i++){
  let svg=draw(i,frame===0?0:(frame-1)/4,frame!==0);const bounds=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number),foot=Number(svg.match(/data-foot-y="([^"]+)"/)?.[1]??182);
  svg=svg.replace(/^<svg\b[^>]*>/,root=>root.replace(/\swidth="[\d.]+"|\sheight="[\d.]+"/g,'').replace('<svg ',`<svg width="${Math.round(bounds[2]*2)}" height="${Math.round(bounds[3]*2)}" `));
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const image=new Image();image.src=url;await image.decode();const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.userData={bounds,foot};made.push(texture);}finally{URL.revokeObjectURL(url);}
 }
 if(token!==build){made.forEach(t=>t.dispose());return;}const old=textures;textures=made;current=-1;previousStatus='';old.forEach(t=>t.dispose());$('movementStatus').textContent='Ready · focus the courtyard to walk';stage.dataset.ready='true';
 }catch(error){made.forEach(t=>t.dispose());$('movementStatus').textContent='Could not prepare character';console.error(error);}}
window.addEventListener('character-rebuilt',bake);
const vectors=[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
$('pad').innerHTML=DIRECTIONS.map((name,i)=>`<button data-dir="${i}" aria-label="Walk ${name}">${['↓','↘','→','↗','↑','↖','←','↙'][i]}</button>`).join('');
for(const button of $('pad').children){button.onpointerdown=e=>{e.preventDefault();pad=vectors[Number(button.dataset.dir)];button.setPointerCapture(e.pointerId);};button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>{pad=null;};}
const allowed=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright']);
stage.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(allowed.has(k)){e.preventDefault();keys.add(k);}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));stage.addEventListener('blur',()=>keys.clear());window.addEventListener('blur',()=>{keys.clear();pad=null;});
$('reset').onclick=()=>{x=z=0;direction=0;keys.clear();pad=null;stage.focus();};
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;
 const dx=pad?.[0]??((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0));
 const dz=pad?.[1]??((keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0));
 const moving=dx!==0||dz!==0;
 if(moving){const length=Math.hypot(dx,dz),next=(Math.round(Math.atan2(dx,dz)/(Math.PI/4))+8)%8;if(next!==candidate){candidate=next;settle=0;}else settle+=dt;if(settle>.035)direction=next;
 const nx=Math.max(-6,Math.min(6,x+dx/length*dt*2)),nz=Math.max(-4,Math.min(4,z+dz/length*dt*2));
 if(![[-4,-2],[4,2]].some(([bx,bz])=>Math.abs(nx-bx)<.85&&Math.abs(nz-bz)<.85)){x=nx;z=nz;}phase=(phase+dt*2.6)%1;
 }
 const frame=moving?1+Math.floor(phase*4):0,index=frame*8+direction;
 if(textures.length&&index!==current){const texture=textures[index],{bounds,foot}=texture.userData;material.map=texture;material.needsUpdate=true;sprite.scale.set(bounds[2]/bounds[3],1,1);sprite.center.set(.5,(bounds[1]+bounds[3]-foot)/bounds[3]);current=index;}
 sprite.position.set(x,.015,z);shadow.position.set(x,.012,z);
 stage.dataset.direction=String(direction);stage.dataset.x=x.toFixed(3);stage.dataset.z=z.toFixed(3);stage.dataset.walking=String(moving);
 if(textures.length){const status=DIRECTIONS[direction]+' · '+(moving?'walking':'standing')+' · '+$('gameSize').value+' px frame';if(status!==previousStatus){$('movementStatus').textContent=status;previousStatus=status;}}
 renderer.render(scene,camera);requestAnimationFrame(tick);
}
resize();bake();requestAnimationFrame(tick);
