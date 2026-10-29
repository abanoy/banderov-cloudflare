import * as T from '../vendor/three.module.js';
import {createAzure} from './model.js';
import {exportGLB} from './export.js';
const canvas=document.querySelector('#view');
const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color('#eeece8').convertSRGBToLinear();
const camera=new T.OrthographicCamera(-4,4,4,-4,.05,60);const target=new T.Vector3(0,3.00,0);
scene.add(new T.HemisphereLight(0xe1efff,0x9e8778,.65));
function light(color,intensity,pos,size){const l=new T.DirectionalLight(color,intensity);l.position.set(...pos);l.castShadow=true;l.shadow.mapSize.set(size,size);l.shadow.camera.left=-4;l.shadow.camera.right=4;l.shadow.camera.top=7;l.shadow.camera.bottom=-3;l.shadow.camera.near=.1;l.shadow.camera.far=25;l.shadow.bias=-.0003;l.shadow.normalBias=.015;l.shadow.radius=3;scene.add(l);return l;}
light(0xffecd9,1.7,[-3.8,8,5],2048);const fill=light(0xc2e7ff,.55,[4,6,2],1024);fill.castShadow=false;const rim=light(0xe7f5ff,1.1,[1,7,-4],1024);rim.castShadow=false;
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
// Broad translucent contact shadow prevents fine laces and hair from looking cut out.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const g=shadowCanvas.getContext('2d'),grad=g.createRadialGradient(64,64,5,64,64,64);grad.addColorStop(0,'rgba(53,46,41,.25)');grad.addColorStop(.4,'rgba(53,46,41,.12)');grad.addColorStop(1,'rgba(53,46,41,0)');g.fillStyle=grad;g.fillRect(0,0,128,128);const shadowTex=new T.CanvasTexture(shadowCanvas),contact=new T.Mesh(new T.PlaneGeometry(2.8,2),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.004;scene.add(contact);
let actor=createAzure({pose:'reference'});scene.add(actor.root);
let yaw=.36,pitch=.065,span=6.65,fitAspect=.40,drag=null,auto=false;
const presets={beauty:{yaw:.36,pitch:.065,span:6.65,y:3.00,label:'Three-quarter'},front:{yaw:0,pitch:0,span:6.65,y:3.00,label:'Front'},side:{yaw:Math.PI/2,pitch:0,span:6.65,y:3.00,label:'Profile'},back:{yaw:Math.PI,pitch:0,span:6.65,y:3.00,label:'Back'},face:{yaw:.15,pitch:.01,span:1.72,y:5.16,label:'Face & swept fringe'},boots:{yaw:.35,pitch:.22,span:1.85,y:.72,label:'Leather & lacing'}};
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight,fitSpan=span*Math.max(1,fitAspect/(w/h));renderer.setSize(w,h,false);camera.left=-fitSpan*w/h/2;camera.right=fitSpan*w/h/2;camera.top=fitSpan/2;camera.bottom=-fitSpan/2;camera.updateProjectionMatrix();}
function draw(){camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*13,target.y+Math.sin(pitch)*13,target.z+Math.cos(yaw)*Math.cos(pitch)*13);camera.lookAt(target);renderer.render(scene,camera);}
function setView(key){const p=presets[key];yaw=p.yaw;pitch=p.pitch;span=p.span;fitAspect=key==='face'?.9:key==='boots'?.96:.4;target.set(0,p.y,0);document.querySelector('#viewLabel').textContent=p.label;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===key));resize();draw();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelector('#turn').addEventListener('change',e=>auto=e.target.checked);
document.querySelector('#wire').addEventListener('change',e=>actor.meshes.forEach(o=>o.material.wireframe=e.target.checked));
document.querySelector('#pose').addEventListener('change',e=>{actor.dispose();actor=createAzure({pose:e.target.checked?'reference':'rest'});scene.add(actor.root);actor.meshes.forEach(o=>o.material.wireframe=document.querySelector('#wire').checked);window.azure.actor=actor;draw();});
document.querySelector('#save').addEventListener('click',()=>{draw();const a=document.createElement('a');a.download='azure-character-view.png';a.href=canvas.toDataURL('image/png');a.click();});
document.querySelector('#export').addEventListener('click',async()=>{const button=document.querySelector('#export');button.disabled=true;try{const bytes=await exportGLB(actor),url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'})),a=document.createElement('a');a.download='azure-'+(document.querySelector('#pose').checked?'reference-pose':'rest')+'.glb';a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}finally{button.disabled=false;}});
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.008;pitch=T.MathUtils.clamp(pitch+(e.clientY-drag.y)*.006,-.5,.75);drag={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();span=T.MathUtils.clamp(span*Math.exp(e.deltaY*.001),1.2,10);resize();},{passive:false});
window.addEventListener('resize',resize);resize();draw();
let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-previous)/1000,.05);previous=now;if(auto&&!drag)yaw+=dt*.25;draw();});
document.querySelector('#status').textContent='Live 3D · Sculpted surfaces';
window.azure={actor,renderer,scene,camera,setView,draw,stats:()=>({...actor.stats(),render:renderer.info.render}),setCamera:(a,p,s,y)=>{yaw=a;pitch=p;span=s;target.set(0,y,0);resize();draw();}};
