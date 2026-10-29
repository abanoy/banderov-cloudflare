import {createFrameProfile} from './frame-profile.js?v=draw-stats-1';
import {createRestingFrameGate} from './resting-frame.js';
import * as T from '../vendor/three.module.js';
import {makeWorld} from './world.js?v=relief-2';
import {billboard} from './retro-look.js';
import {sky,retroRenderer} from './atmosphere.js?v=relief-2';
import {flightWorld} from './flight.js?v=normal-matrix-1';
import {createPlayerCue} from './player-cue.js?v=2';
import {castleBuilder} from './castle-builder.js?v=static-fittings-1';
import {createCastleDefense} from './castle-defense.js';
import {createBattle} from './battle.js?v=revive-range-1';

const $=id=>document.getElementById(id),canvas=$('world'),r=new T.WebGLRenderer({canvas,antialias:false,alpha:false});r.outputEncoding=T.sRGBEncoding;
const scene=new T.Scene();scene.background=sky();scene.fog=new T.Fog(0xa8c8cb,600,1200);scene.add(new T.HemisphereLight(0xe7eddf,0x68709a,.7));
const camera=new T.OrthographicCamera(-100,100,100,-100,.2,1200),post=retroRenderer(r,{measure:new URLSearchParams(location.search).has('profile')}),world=makeWorld(scene),physics=flightWorld(world.solids,world.pads),s=physics.state;
const defense=createCastleDefense(world,scene);
const actor=await billboard();scene.add(actor);const playerCue=createPlayerCue(scene,actor,camera);const pod=new T.Group();scene.add(pod);
const pale=new T.MeshBasicMaterial({color:0xe5d6a9}),blue=new T.MeshBasicMaterial({color:0x477e96}),glow=new T.MeshBasicMaterial({color:0xa6fff0});
function part(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);pod.add(o);return o;}
part(new T.SphereGeometry(1.65,12,6,0,Math.PI*2,Math.PI/2,Math.PI/2),pale,0,.65,0);
part(new T.CylinderGeometry(1.72,1.45,.3,12),blue,0,.65,0);const rim=part(new T.TorusGeometry(1.72,.09,4,24),glow,0,.83,0);rim.rotation.x=Math.PI/2;
for(const side of [-1,1]){const wing=part(new T.BoxGeometry(1.9,.12,.85),pale,side*2,.38,.15);wing.rotation.z=side*-.15;part(new T.ConeGeometry(.32,1,6),blue,side*2.8,.6,.15);}
const shadow=new T.Mesh(new T.CircleGeometry(.8,16),new T.MeshBasicMaterial({color:0x17294d,transparent:true,opacity:.35,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
const landingFootprint=new T.Mesh(new T.RingGeometry(1.4,1.7,32),new T.MeshBasicMaterial({color:0xffe3a0,side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false})),footprintUp=new T.Vector3(0,0,1);landingFootprint.visible=false;scene.add(landingFootprint);
const trail=[];for(let i=0;i<18;i++){const o=new T.Mesh(new T.OctahedronGeometry(.14,0),new T.MeshBasicMaterial({color:0xa9ece9,transparent:true,opacity:0,depthWrite:false}));scene.add(o);trail.push(o);}let trailTime=0,trailIndex=0;
const frameGate=createRestingFrameGate(),frameProfile=createFrameProfile(new URLSearchParams(location.search).has('profile'));
let environmentTime=0;let yaw=-.12,viewSize=430,overview=true,paused=false,drag=null,previous=performance.now(),accumulator=0,facing={x:0,z:1},builder=null,battle=null,builderWasPaused=false;const target=new T.Vector3(0,25,0),keys=new Set(),motion={x:0,z:0},tmp=new T.Vector3();let padPointer=null;
let overviewBox=null;const overviewCenter=new T.Vector3(0,25,0),overviewCorners=[];
const distinction=document.createElement('p');distinction.id='castle-distinction';distinction.hidden=true;document.querySelector('.telemetry').append(distinction);
function refreshOverviewBounds(){
 overviewBox=null;overviewCorners.length=0;overviewCenter.set(0,25,0);
 
 overviewBox=new T.Box3(new T.Vector3(-315,-75,-275),new T.Vector3(315,70,275));
 for(const castle of world.castles)overviewBox.union(new T.Box3().setFromObject(castle));
 if(battle?.active)for(const v of battle.combat.shieldVolumes)overviewBox.union(new T.Box3(new T.Vector3(v.x-v.rx,v.y-v.ry,v.z-v.rz),new T.Vector3(v.x+v.rx,v.y+v.ry,v.z+v.rz)));
 overviewBox.getCenter(overviewCenter);
 for(const x of [overviewBox.min.x,overviewBox.max.x])for(const y of [overviewBox.min.y,overviewBox.max.y])for(const z of [overviewBox.min.z,overviewBox.max.z])overviewCorners.push(new T.Vector3(x,y,z).sub(overviewCenter));
}
function overviewSpan(aspect){
 if(!overviewBox)return Math.max(430,560/aspect);
 let extent=0;const c=Math.cos(yaw),s=Math.sin(yaw),k=Math.SQRT1_2;
 for(const p of overviewCorners)extent=Math.max(extent,Math.abs(c*p.x-s*p.z)/aspect,Math.abs(-s*k*p.x+k*p.y-c*k*p.z));
 return Math.max(430,extent*2.22);
}
const destination=$('destination');destination.replaceChildren(...world.pads.map((p,i)=>new Option(p.name,String(i))));destination.value='2';
function clear(){keys.clear();motion.x=motion.z=0;battle?.clearInput();const id=padPointer;padPointer=null;if(id!==null&&$('pad').hasPointerCapture(id))$('pad').releasePointerCapture(id);$('pad').querySelector('i').style.transform='';drag=null;}
function message(text){$('message').textContent=text;$('travel-message').textContent=text;}
function setPause(value){frameGate.invalidate();paused=value;clear();document.body.classList.remove('inspecting-bots');$('inspect-bots').hidden=!value||!battle?.active||!!builder?.isOpen;$('pause-panel').hidden=!value||!!builder?.isOpen;$('pause').textContent=value?'Paused':'Pause';if(builder?.isOpen)return;if(value)$('resume').focus();else canvas.focus();}
function follow(){overview=false;viewSize=62;$('overview').setAttribute('aria-pressed','false');$('overview').textContent='View: Follow';$('zoom').value=viewSize;readouts();}
function launch(){if(battle?.blocked||battle?.mounted||paused)return;if(physics.launch(Number($('destination').value))){clear();follow();viewSize=112;$('zoom').value=viewSize;readouts();message(physics.launchInfo?.clear===false?'Arc obstructed. Steer around the structures; gravity continues.':'Steer with WASD or the pad. Release steering to brake; gravity continues.');}else message('Launch from a glowing pad and choose another destination.');}
$('launch').onclick=launch;$('return').onclick=()=>{if(battle?.blocked)return;if(battle?.mounted){message('Leave your seat before returning.');return;}if(battle?.active)s.home=0;physics.recover();clear();follow();target.set(s.x,s.y+1,s.z);message('Back at '+world.pads[s.home].name+'.');};$('pause').onclick=()=>setPause(true);$('resume').onclick=()=>setPause(false);
$('inspect-bots').onclick=()=>{if(!paused||!battle?.active)return;document.body.classList.add('inspecting-bots');$('battle-board').open=true;frameGate.invalidate();$('battle-board').querySelector('summary').focus();};
$('overview').onclick=()=>{overview=!overview;viewSize=overview?430:62;$('overview').setAttribute('aria-pressed',String(overview));$('overview').textContent=overview?'View: Overview':'View: Follow';$('zoom').value=viewSize;readouts();clear();};
function showLook(value){const restore=!value&&$('look-panel').contains(document.activeElement);$('look-panel').hidden=!value;$('look').setAttribute('aria-expanded',String(value));clear();if(restore)$('look').focus();}
$('player-cue').onclick=()=>{const enabled=$('player-cue').getAttribute('aria-pressed')!=='true';$('player-cue').setAttribute('aria-pressed',String(enabled));$('player-cue').textContent='Player silhouette: '+(enabled?'On':'Off');};
$('look').onclick=()=>showLook($('look-panel').hidden);$('close-look').onclick=()=>showLook(false);
builder=castleBuilder(world,{openView(){builderWasPaused=paused;showLook(false);setPause(true);},closeView(){setPause(builderWasPaused);},onApply(home){battle?.worldChanged();defense.sync();s.home=home;physics.recover();clear();accumulator=0;overview=true;viewSize=430;refreshOverviewBounds();$('overview').setAttribute('aria-pressed','true');$('overview').textContent='View: Overview';$('zoom').value=viewSize;readouts();},report:message});$('build').onclick=()=>{battle?.stop();builder.open();};refreshOverviewBounds();defense.sync();
battle=createBattle({world,scene,camera,castleSetup:builder,playerPhysics:physics,playerSprite:actor,onMessage:message,isPaused:()=>paused,onBuilding(){refreshOverviewBounds();overview=true;viewSize=430;setPause(false);$('overview').textContent='View: Overview';$('overview').setAttribute('aria-pressed','true');},onStarted(){refreshOverviewBounds();defense.setEnabled(false);setPause(false);follow();viewSize=95;$('zoom').value=viewSize;readouts();accumulator=0;target.set(s.x,s.y+1,s.z);},onStopped(){actor.visible=true;refreshOverviewBounds();}});
let defenseUiTime=-1;
function defenseUI(){const d=defense.snapshot(),homes=d.homes||[],weapons=homes.reduce((n,h)=>n+(h.weapons||0),0);$('defense-toggle').setAttribute('aria-pressed',String(d.enabled));$('defense-toggle').textContent=d.enabled?'Stop defense drill':'Start defense drill';$('defense-state').textContent=d.enabled?'DRILL ACTIVE':'STANDBY';$('defense-status').textContent=weapons?(d.shots+' shots · '+d.hits+' hits · '+homes.reduce((n,h)=>n+(h.cooling||0),0)+' recharging · '+homes.reduce((n,h)=>n+(h.blocked||0),0)+' blocked'):d.enabled?'Practice drones are approaching. This castle has no responding weapons.':'Apply a castle with cannons or signal beacons.';}
$('defense-toggle').onclick=()=>{defense.setEnabled(!defense.snapshot().enabled);defenseUI();};defenseUI();
const travelSizing=new ResizeObserver(()=>document.body.style.setProperty('--travel-height',document.querySelector('.travel').getBoundingClientRect().height+'px'));travelSizing.observe(document.querySelector('.travel'));
function readouts(){for(const e of document.querySelectorAll('#look-panel input'))e.parentElement.querySelector('output').value=e.value+(['azimuth','sun-height'].includes(e.id)?'°':'');}
function adjust(){const v=id=>Number($(id).value),a=v('azimuth')*Math.PI/180,e=v('sun-height')*Math.PI/180,w=v('warmth')/100,c=v('shade')/100;world.lighting.direction.value.set(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));world.lighting.brightness.value=v('brightness')/100;for(const pair of world.pairs){pair.gain.value=v('brightness')/100;pair.contrast.value=v('surface-contrast')/100;pair.relief.value=v('surface-relief')/100;pair.update(new T.Color().setRGB(1,1-.05*w,1-.24*w).getStyle(),new T.Color().setRGB(.68-.3*c,.7-.26*c,.72+.02*c).getStyle(),'#211308');}post.material.uniforms.contact.value=v('contact-depth')/100;post.material.uniforms.sunShadow.value=v('sun-shadows')/100;post.material.uniforms.sunDirection.value.copy(world.lighting.direction.value);const haze=v('distance-haze')/100;scene.fog.near=600-380*haze;scene.fog.far=1200-350*haze;post.material.uniforms.dither.value=v('dither')/100;Object.assign(physics.handling,{speed:v('air-speed'),response:v('air-response'),brake:v('air-brake')/25});readouts();}
document.querySelectorAll('#look-panel input').forEach(e=>e.addEventListener('input',()=>{if(e.id==='zoom')viewSize=Number(e.value);adjust();}));
const presets={day:[110,-37,47,80,85,55],sunset:[112,-105,18,100,100,75],moon:[72,112,32,15,100,65]};
for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>{['brightness','azimuth','sun-height','warmth','shade','dither'].forEach((id,i)=>$(id).value=presets[b.dataset.preset][i]);adjust();message(b.textContent+' lighting applied.');};adjust();
const editing=e=>e.target instanceof HTMLElement&&e.target.matches('input,select,textarea,[contenteditable=true]');
addEventListener('focusin',e=>{if(editing(e))clear();});
addEventListener('keydown',e=>{if(builder?.isOpen)return;if(e.code==='Escape'&&!$('look-panel').hidden){showLook(false);e.preventDefault();return;}if(editing(e))return;if(e.code==='Escape'){if(!$('look-panel').hidden)showLook(false);else setPause(!paused);e.preventDefault();return;}if(e.code==='KeyP'&&!e.repeat){setPause(!paused);return;}if(paused)return;if(e.target instanceof HTMLElement&&e.target.closest('button')&&['Space','Enter'].includes(e.code)){if(e.repeat)e.preventDefault();return;}if(e.code==='Space'){if(!e.repeat)launch();e.preventDefault();return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','KeyR','KeyC'].includes(e.code)){if(!e.repeat||keys.has(e.code))keys.add(e.code);e.preventDefault();}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>setPause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);});
canvas.tabIndex=0;canvas.addEventListener('pointerdown',e=>{if(paused||drag||battle.blocked)return;if(battle.pointerDown(e)){canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});return;}if(e.button!==(battle.active?2:0))return;drag={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});canvas.addEventListener('pointermove',e=>{battle.pointerMove(e);if(drag?.id===e.pointerId){yaw-=(e.clientX-drag.x)*.007;drag.x=e.clientX;}});for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{battle.pointerUp();if(drag?.id===e.pointerId)drag=null;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{viewSize=T.MathUtils.clamp(viewSize+e.deltaY*.1,22,550);$('zoom').value=viewSize;readouts();e.preventDefault();},{passive:false});
function padUpdate(e){const b=$('pad').getBoundingClientRect(),dx=e.clientX-b.x-b.width/2,dz=e.clientY-b.y-b.height/2,len=Math.hypot(dx,dz),strength=Math.min(1,Math.max(0,(len-5)/25));motion.x=dx/(len||1)*strength;motion.z=dz/(len||1)*strength;$('pad').querySelector('i').style.transform=`translate(${motion.x*28}px,${motion.z*28}px)`;}
$('pad').addEventListener('pointerdown',e=>{if(paused||padPointer!==null||e.button!==0)return;padPointer=e.pointerId;$('pad').setPointerCapture(padPointer);padUpdate(e);e.preventDefault();});$('pad').addEventListener('pointermove',e=>{if(padPointer===e.pointerId)padUpdate(e);});for(const type of ['pointerup','pointercancel','lostpointercapture'])$('pad').addEventListener(type,e=>{if(padPointer===e.pointerId){padPointer=null;motion.x=motion.z=0;$('pad').querySelector('i').style.transform='';}});
$('orbit-left').onclick=()=>yaw-=Math.PI/8;$('orbit-right').onclick=()=>yaw+=Math.PI/8;
// A second touch does not always synthesize click. Preserve primary native clicks,
// and recognize only stationary, released secondary taps on actual action buttons.
for(const button of document.querySelectorAll('button')){const taps=new Map();let completed=null;button.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!e.isPrimary)taps.set(e.pointerId,{x:e.clientX,y:e.clientY});});button.addEventListener('pointermove',e=>{const p=taps.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>10)taps.delete(e.pointerId);});button.addEventListener('pointerup',e=>{const p=taps.get(e.pointerId);taps.delete(e.pointerId);if(p&&!button.disabled&&button.contains(document.elementFromPoint(e.clientX,e.clientY))&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=10){completed={id:e.pointerId,time:performance.now()};button.click();}});for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,e=>taps.delete(e.pointerId));button.addEventListener('click',e=>{if(e.isTrusted&&e.pointerType==='touch'&&e.pointerId===completed?.id&&performance.now()-completed.time<1000){e.preventDefault();e.stopImmediatePropagation();}},true);addEventListener('blur',()=>taps.clear());}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);message('Graphics interrupted. Reload this preview to restore it.');});
const ray=new T.Raycaster(),occluded=new Map();
function cameraClear(){for(const [mesh,material] of occluded){mesh.material=material;}occluded.clear();if(overview)return;const actorAim=new T.Vector3(s.x,s.y+1,s.z);ray.set(camera.position,actorAim.clone().sub(camera.position).normalize());ray.far=camera.position.distanceTo(actorAim)-.8;const hits=ray.intersectObjects(world.occluders.filter(m=>{for(let p=m;p;p=p.parent)if(!p.visible)return false;return true;}),false);for(const h of hits){if(occluded.has(h.object))continue;const old=h.object.material;if(!h.object.userData.fadeMaterial){const fade=old.clone();fade.onBeforeCompile=old.onBeforeCompile;fade.customProgramCacheKey=old.customProgramCacheKey;fade.transparent=true;fade.opacity=.18;fade.depthWrite=false;h.object.userData.fadeMaterial=fade;}occluded.set(h.object,old);h.object.material=h.object.userData.fadeMaterial;}}
const cueObstacles=[...document.querySelectorAll('.brand,header nav,.compass,.telemetry,.move-zone,.travel,#message,#look-panel')];
function placeCue(cue,px,py,width,height){
 // The arrow centre is 14px below the cue's top. Find the nearest free spot
 // using actual HUD bounds, including resized screens and an open settings panel.
 const half=cue.offsetWidth/2,h=cue.offsetHeight,gap=9,minX=half+12,maxX=width-half-12,minY=26,maxY=height-h+2;
 const clampX=x=>T.MathUtils.clamp(x,minX,Math.max(minX,maxX)),clampY=y=>T.MathUtils.clamp(y,minY,Math.max(minY,maxY));
 const obstacles=cueObstacles.filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect()),xs=[clampX(px)],ys=[clampY(py)];
 for(const b of obstacles){xs.push(clampX(b.left-half-gap),clampX(b.right+half+gap));ys.push(clampY(b.top-h+14-gap),clampY(b.bottom+14+gap));}
 let best=null;
 for(const x of new Set(xs))for(const y of new Set(ys)){
  let overlap=0;for(const b of obstacles)overlap+=Math.max(0,Math.min(x+half,b.right+gap)-Math.max(x-half,b.left-gap))*Math.max(0,Math.min(y-14+h,b.bottom+gap)-Math.max(y-14,b.top-gap));
  const distance=(x-px)**2+(y-py)**2;
  if(!best||overlap<best.overlap-.01||Math.abs(overlap-best.overlap)<.01&&distance<best.distance)best={x,y,overlap,distance};
 }
 cue.style.left=best.x+'px';cue.style.top=best.y+'px';const arrow=cue.querySelector('span'),clamped=Math.hypot(px-best.x,py-best.y)>1;
 arrow.textContent=clamped?'▲':'◇';arrow.style.transform=clamped?'rotate('+(Math.atan2(py-best.y,px-best.x)*180/Math.PI+90)+'deg)':'none';
}
for(const event of ['click','pointerdown','pointermove','pointerup','pointercancel','keydown','keyup','wheel','input','change','toggle','resize','visibilitychange'])window.addEventListener(event,frameGate.invalidate,{capture:true,passive:true});
let renderedWorld=false;
function frame(now){const dt=Math.min(.05,(now-previous)/1000),wasFlying=s.flight,previousFalls=s.falls;previous=now;
 // The paused world is fully covered by the workshop. Keep its last frame while
 // the independent editor and route inspector work, instead of redrawing it.
 if((builder?.isOpen||battle?.preparing&&!battle?.building)&&renderedWorld){requestAnimationFrame(frame);return;}
 if(!frameGate.draw(paused,now,paused&&target.distanceToSquared(overview?overviewCenter:tmp.set(s.x,s.y+1,s.z))>.0001)){requestAnimationFrame(frame);return;}
 frameProfile.begin(now,paused,(battle.active?'Battle':'World')+' / '+(overview?'Overview':'Follow'),dt);
 if(!paused){yaw+=(Number(keys.has('KeyE'))-Number(keys.has('KeyQ')))*dt*1.15;let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+motion.x,z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+motion.z;const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;const input={x:Math.cos(yaw)*x+Math.sin(yaw)*z,z:-Math.sin(yaw)*x+Math.cos(yaw)*z};if(Math.hypot(x,z)>.01&&!battle.blocked){if(overview)follow();facing={...input};}battle.setMotion(input,Number(keys.has('KeyR'))-Number(keys.has('KeyC')));if(!battle.blocked&&!battle.mounted)accumulator+=dt;else accumulator=0;while(accumulator>=1/120){if(physics.step(1/120,input)==='recovered'){clear();accumulator=0;message('Returned safely to '+world.pads[s.home].name+'.');break;}accumulator-=1/120;}const battleTime=battle.combat.state.time;battle.tick(dt);environmentTime+=battle.active?Math.max(0,battle.combat.state.time-battleTime):dt;
  for(const g of world.glows){g.rotation.y+=dt;g.position.y=world.pads[world.glows.indexOf(g)].y+1.1+Math.sin(s.time*2)*.18;}
  world.animate(environmentTime);defense.update(environmentTime);
  trailTime+=dt;if(s.flight&&s.flightKind!=='dismount'&&(!battle.active||battle.humanAlive)&&trailTime>.055){const t=trail[trailIndex++%trail.length];t.position.set(s.x,s.y-.3,s.z);t.material.opacity=.7;t.scale.setScalar(1);trailTime=0;}for(const t of trail){t.material.opacity=Math.max(0,t.material.opacity-dt*.7);t.scale.multiplyScalar(1+dt*.3);}
 }
 frameProfile.mark('Simulation');
 if(wasFlying&&!s.flight&&s.grounded&&s.falls===previousFalls)message(s.place?'On foot: '+s.place+'. Explore here, or Return to castle.':'On foot. Explore '+(Math.hypot(s.x,s.z)<120?'the ring':'the castle')+'; glowing pads launch the pod.');
 actor.position.set(s.x,s.y+(s.flight?.7:0),s.z);actor.material.map=actor.userData.maps[facing.x*Math.sin(yaw)+facing.z*Math.cos(yaw)>=0?0:1];pod.visible=s.flight&&s.flightKind!=='dismount'&&(!battle.active||battle.humanAlive);pod.position.set(s.x,s.y,s.z);pod.rotation.y=Math.atan2(s.vx,s.vz);pod.rotation.z=s.flight?Math.sin(s.time*3)*.035:0;
 const ground=physics.floor(s.x,s.y+.2,s.z,180);shadow.visible=!!ground&&(!battle.active||battle.humanAlive);if(ground){shadow.position.set(s.x,ground.y+.035,s.z);shadow.quaternion.setFromUnitVectors(footprintUp,ground.normal);shadow.material.opacity=.32*Math.max(.12,1-(s.y-ground.y)/60);shadow.scale.setScalar(s.flight?2:1);}
 landingFootprint.visible=pod.visible&&!!ground&&s.y-ground.y<40;if(landingFootprint.visible){landingFootprint.position.set(s.x,ground.y+.06,s.z);landingFootprint.quaternion.setFromUnitVectors(footprintUp,ground.normal);}
 const desired=overview?tmp.copy(overviewCenter):tmp.set(s.x,s.y+1,s.z);target.lerp(desired,1-Math.exp(-dt*10));
 const width=canvas.clientWidth,height=canvas.clientHeight,aspect=width/height,span=overview?overviewSpan(aspect)*viewSize/430:viewSize*(aspect<.8?1.3:1);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();camera.position.set(target.x+Math.sin(yaw)*350,target.y+350,target.z+Math.cos(yaw)*350);camera.lookAt(target);camera.updateMatrixWorld();cameraClear();
 frameProfile.mark('Camera');
 battle.render(yaw,dt);const beauty=world.castles[s.home].userData.beauty;distinction.hidden=!beauty||!s.grounded||!s.place?.includes('custom castle');if(beauty)distinction.textContent=beauty.cosmeticRank.toUpperCase()+' CASTLE · '+beauty.score+'/100';
 const cue=$('target-cue');cue.hidden=!s.flight||s.flightKind==='dismount'||battle.active&&!battle.humanAlive;if(!cue.hidden){const p=world.pads[s.pad],v=new T.Vector3(p.x,p.y+1,p.z).project(camera),px=(v.x+1)*width/2,py=(1-v.y)*height/2;cue.querySelector('b').textContent=p.name.toUpperCase()+' · '+Math.round(Math.hypot(p.x-s.x,p.y-s.y,p.z-s.z))+'m';cue.querySelector('small').textContent=ground?'FLOOR BELOW · '+Math.max(0,Math.round(s.y-ground.y))+'m':'NO NEARBY FLOOR BELOW';placeCue(cue,px,py,width,height);}
 if(now-defenseUiTime>200){defenseUI();defenseUiTime=now;}
 playerCue.update({occluded:occluded.size>0,enabled:!overview&&!battle.mounted&&$('player-cue').getAttribute('aria-pressed')==='true',time:environmentTime,viewportHeight:height});
 frameProfile.mark('Effects');
 post.render(scene,camera,width,height,1-Number($('pixels').value)/100);renderedWorld=true;frameProfile.mark('Draw');
 $('altitude').textContent=Math.round(s.y).toString().padStart(3,'0');$('phase').textContent=s.flightKind==='dismount'&&s.flight?'AIR / DISEMBARKING':s.flight?{rising:'POD / ASCENDING',apex:'POD / APEX',falling:'POD / DESCENDING'}[s.phase]:s.grounded?'ON FOOT':'FALLING / RETURN BELOW';$('location').textContent=s.flight&&s.flightKind!=='dismount'?'→ '+world.pads[s.pad].name:!s.grounded?'Between islands':(physics.nearPad()>=0?world.pads[physics.nearPad()].name:(s.place||(Math.hypot(s.x,s.z)<120?'Ring battleground':world.pads[s.home].name+' grounds')));$('bearing').textContent=String(Math.round(T.MathUtils.radToDeg(yaw)+360)%360).padStart(3,'0')+'°';$('arc-marker').style.transform=`translateX(${Math.min(105,Math.max(0,s.y/110*105))}px)`;const near=physics.nearPad();$('launch').disabled=paused||battle.blocked||battle.mounted||s.flight||near<0||near===Number($('destination').value);if(battle.active&&!battle.humanAlive)$('launch').innerHTML='DOWNED <span>WAITING TO RESPAWN</span>';else if(s.flight&&s.flightKind==='dismount')$('launch').innerHTML='AIRBORNE <span>STEER TO A LANDING</span>';else if(s.flight)$('launch').innerHTML='IN FLIGHT <span>STEER WITH WASD / PAD</span>';else $('launch').innerHTML='LAUNCH POD <span>SPACE ↗</span>';
 frameProfile.mark('UI');frameProfile.finish(now,post.stats);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('test'))window.__aerie={scene,camera,r,post,world,physics,state:s,actor,pod,keys,motion,builder,defense,battle,get yaw(){return yaw;},get paused(){return paused;}};
const workshopParams=new URLSearchParams(location.search);
if(workshopParams.has('build'))builder.open({templates:workshopParams.has('templates'),template:workshopParams.get('template')});
else if(workshopParams.has('battle'))battle.open();


