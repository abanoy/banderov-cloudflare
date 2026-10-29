import * as T from '../vendor/three.module.js';
import {surface} from '../floating-castle/surface-detail.js?v=normal-v2';
import {paletteLook,billboard} from '../floating-castle/retro-look.js';
import {palettePair} from '../floating-castle/palette-pair.js?v=relief-2';
import {retroRenderer,sky} from '../floating-castle/atmosphere.js';
import {buildArmory} from './models.js';

const canvas=document.getElementById('view'),renderer=new T.WebGLRenderer({canvas,antialias:false});renderer.outputEncoding=T.sRGBEncoding;
const scene=new T.Scene();scene.background=sky();scene.add(new T.HemisphereLight(0xf8e7c3,0x637698,.8));
const colors={stone:'#d9c9a6',edge:'#efe0b8',paving:'#c9b998',wood:'#937653',iron:'#4b6777',brass:'#cdaa68',dark:'#14232d',rope:'#c8b28d'};
const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>{const m=new T.MeshStandardMaterial({color,flatShading:true,roughness:1});m.color.convertSRGBToLinear();return [key,m];}));
for(const [key,type,scale] of [['stone','stone',.18],['edge','stone',.25],['paving','paving',.2],['wood','wood',.35],['iron','rock',.3],['brass','rock',.5],['rope','cloth',.4]])surface(mats[key],type,scale);
const lighting=paletteLook(Object.values(mats));for(const m of Object.values(mats)){const pair=palettePair(m);pair.direction.value=lighting.direction.value;}
const camera=new T.OrthographicCamera(-1,1,1,-1,.1,1000),post=retroRenderer(renderer);
const kinds=['cannon','trebuchet','bow','watchtower'],models=kinds.map(kind=>buildArmory(kind,mats));
const descriptions={all:'Cannon battery / Trebuchet / Semi-automatic bow / Armed watchtower. Chibi height: 2 m.',cannon:'Cannon battery · open muzzle, bronze barrel hoops, swivelling trunnion cradle and timber carriage.',trebuchet:'Trebuchet · braced A-frame, pivoting long arm, suspended stone counterweight and rope sling.',bow:'Semi-automatic bow · curved limbs, drawn string, bolt rack, cocking lever and rotating pedestal.',watchtower:'Armed watchtower · flared stone foot, narrow shaft, broad crenellated platform and cannon. Ladder gives access to the roof.'};
const platforms=[];for(let i=0;i<models.length;i++){
 scene.add(models[i].root);
 const deck=new T.Mesh(new T.BoxGeometry(11,.35,11),mats.paving);scene.add(deck);platforms.push(deck);
}
const originalFigure=await billboard(),figures=[];
for(let i=0;i<4;i++){const figure=originalFigure.clone();figure.scale.set(2*260/266,2,1);scene.add(figure);figures.push(figure);}
const roofFigure=originalFigure.clone();roofFigure.scale.set(2*260/266,2,1);models[3].root.add(roofFigure);roofFigure.position.set(-2.5,12.65,2.5);
let selected='all',yaw=.55,firing=false,animation=null,started=0,manualPhase=null;
function configure(){selected=document.getElementById('model').value;for(let i=0;i<models.length;i++){const visible=selected==='all'||kinds[i]===selected,x=selected==='all'?(i-1.5)*17:0;models[i].root.visible=platforms[i].visible=figures[i].visible=visible;models[i].root.position.set(x,0,0);platforms[i].position.set(x,-.2,0);figures[i].position.set(x-3.6,0,3.8);}document.getElementById('caption').textContent=descriptions[selected];draw();}
function draw(time=0){
 const w=canvas.clientWidth,h=canvas.clientHeight,aspect=w/h,span=selected==='all'?Math.max(26,70/aspect):selected==='watchtower'?23:17,targetY=selected==='all'?6:selected==='watchtower'?7:2.8;
 // Independent display stands stay in a readable row while the view orbits them.
 if(selected==='all')for(let i=0;i<models.length;i++){const along=(i-1.5)*17,x=Math.cos(yaw)*along,z=-Math.sin(yaw)*along;models[i].root.position.set(x,0,z);platforms[i].position.set(x,-.2,z);figures[i].position.set(x-3.6,0,z+3.8);}
 camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.position.set(Math.sin(yaw)*120,targetY+120,Math.cos(yaw)*120);camera.lookAt(0,targetY,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 for(const model of models)model.update(manualPhase??time,{yaw:Number(document.getElementById('aim').value)*Math.PI/180,pitch:Number(document.getElementById('pitch').value)*Math.PI/180,firing:firing||manualPhase!==null});
 post.render(scene,camera,w,h,.5);
}
function tick(now){if(manualPhase===null)draw((now-started)/1000);animation=requestAnimationFrame(tick);}
document.getElementById('model').onchange=configure;
document.getElementById('left').onclick=()=>{yaw-=Math.PI/8;draw();};document.getElementById('right').onclick=()=>{yaw+=Math.PI/8;draw();};
for(const id of ['aim','pitch'])document.getElementById(id).oninput=()=>draw();
document.getElementById('demo').onclick=()=>{firing=!firing;manualPhase=null;started=performance.now();document.getElementById('demo').setAttribute('aria-pressed',String(firing));draw();};
document.getElementById('step').onclick=()=>{firing=false;document.getElementById('demo').setAttribute('aria-pressed','false');manualPhase=((manualPhase??0)+.25)%1;draw();};
window.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(e.key.toLowerCase()==='q'){yaw-=Math.PI/8;draw();}if(e.key.toLowerCase()==='e'){yaw+=Math.PI/8;draw();}});
window.addEventListener('resize',()=>draw());configure();requestAnimationFrame(tick);
