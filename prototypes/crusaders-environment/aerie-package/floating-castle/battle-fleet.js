import {bindSketchDefense} from './sketch-defense.js';
import {defenseOperator} from './defense-operator.js';
import {fleetTargetsInRange} from './battle-sensing.js?v=fleet-target-range-1';
import {castlePorts} from './fleet-ports.js';
import * as T from '../vendor/three.module.js';
import {shieldContact} from './battle-shields.js';
import {DEFENSE_RULES} from './castle-defense.js';
import {createBattleCollision} from './battle-combat.js';

// Fleet seats own actor movement while occupied. All other walking and falling
// continues through the same player solver; boarding requires physical proximity.
export function createBattleFleet({world,scene,actors,navigation,onMessage=()=>{},operatorSprite=null}){
 const ships=[],mounts=[],V=()=>new T.Vector3();let crewRequired=false;let combat=null,motion={x:0,z:0},vertical=0,generation=0,nextDefenseScan=0;
 const belongs=(m,root)=>{for(let p=m;p;p=p.parent)if(p===root)return true;return false;};
 for(const [team,h] of world.harbors.entries())for(const vessel of h.ships){
  const root=vessel.root,big=vessel.index===0,p=world.pads[team],sign=team?-1:1;
  scene.attach(root);root.userData.fleetControlled=true;root.rotation.set(0,0,0);
  const home=new T.Vector3(p.x+sign*32,p.y-3.2,big?-27:20),id='ship-'+team+'-'+vessel.index;
  const parts=world.solids.filter(m=>belongs(m,root));for(const m of parts)m.userData.vehicleId=id;
  const ship={id,team,root,parts,big,home,hp:big?900:350,maxHp:big?900:350,velocity:V(),seats:(big?['Pilot','Port gunner','Starboard gunner','Passenger','Passenger']:['Pilot']).map((role,i)=>({role,actor:null,position:new T.Vector3(i===1?-4:i===2?4:i===3?-2:i===4?2:0,3.3,i===0?10:i<3?8:0)})),destination:null,stage:'moored',departAt:0,respawnAt:0};
  root.position.copy(home);const hullBounds=new T.Box3().setFromObject(root);ship.collisionHalfSize=hullBounds.getSize(V()).multiplyScalar(.5);ship.collisionOffset=hullBounds.getCenter(V()).sub(root.position);ships.push(ship);
 }
 const cloneGuns=[];
 const originalShips=ships.slice();
 for(const original of originalShips)for(let n=1;n<4;n++){const root=original.root.clone(true),oldNodes=[],newNodes=[];original.root.traverse(o=>oldNodes.push(o));root.traverse(o=>newNodes.push(o));const id=original.id+'-reserve-'+n,parts=original.parts.map(m=>newNodes[oldNodes.indexOf(m)]);parts.forEach(m=>m.userData.vehicleId=id);root.visible=false;scene.add(root);const ship={...original,id,root,parts,home:original.home.clone(),velocity:V(),seats:original.seats.map(seat=>({...seat,actor:null,position:seat.position.clone()})),enabled:false,hp:0};ships.push(ship);for(const t of world.harbors[original.team].turrets)if(belongs(t.base,original.root))cloneGuns.push({ship,base:newNodes[oldNodes.indexOf(t.base)],swivel:newNodes[oldNodes.indexOf(t.swivel)]});}
 const allShips=ships.slice();let ports=[];
 const dynamic=ships.flatMap(s=>s.parts),collision=createBattleCollision(world.solids,dynamic);
 function addMount(root,team,id,local,ship=null,swivel=null,type='cannon'){
  const existing=mounts.find(w=>w.root===root);if(existing)return existing;
  const ignore=new Set();root.traverse(o=>ignore.add(o));if(ship)ship.root.traverse(o=>ignore.add(o));
  const w={id,team,root,ship,swivel,local:new T.Vector3(...local),ignore,hp:240,maxHp:240,alive:true,operator:null,state:{x:0,y:0,z:0},nextShot:0,range:ship?220:DEFENSE_RULES[type].range,rig:bindSketchDefense(root),mountWeapon:{id:'mounted-'+type,magazine:type==='cannon'?12:4,reload:type==='cannon'?2:3.5,gravity:type==='trebuchet'?14:0,blast:type==='trebuchet'?10:0,damage:type==='trebuchet'?90:type==='heavyCannon'?45:24,interval:ship?.85:DEFENSE_RULES[type].cooldown,speed:ship?85:DEFENSE_RULES[type].speed,life:3.6,spread:type==='beacon'?[-.08,0,.08]:[0],radius:.5}};
  w.staff=defenseOperator(root,{sprite:operatorSprite,team,entry:root.userData.defense?.entry||[3,0,0]});
  if(!ship)for(const m of world.solids)if(belongs(m,root))m.userData.emplacementId=id;
  if(swivel)swivel.userData.controlled=true;mounts.push(w);return w;
 }
 function sync(){
  ports=[];for(const s of allShips){s.enabled=false;s.root.visible=false;}
  for(let team=0;team<2;team++)for(const port of castlePorts(world,team)){const s=allShips.find(s=>s.team===team&&s.big===port.big&&!s.enabled);if(!s)continue;s.enabled=true;s.root.visible=true;s.port=port;s.home.copy(port.home);s.homeAngle=port.angle;s.root.position.copy(s.home);s.root.rotation.set(0,s.homeAngle,0);s.hp=s.maxHp;const box=new T.Box3().setFromObject(s.root);s.collisionHalfSize=box.getSize(V()).multiplyScalar(.5);s.collisionOffset=box.getCenter(V()).sub(s.root.position);ports.push({...port,ship:s.id});}
  ships.splice(0,ships.length,...allShips.filter(s=>s.enabled));const partSet=new Set(allShips.flatMap(s=>s.parts));for(let i=world.solids.length-1;i>=0;i--)if(partSet.has(world.solids[i]))world.solids.splice(i,1);world.solids.push(...ships.flatMap(s=>s.parts));
  for(const w of mounts){if(w.operator)exit(w.operator);w.staff?.dispose();}mounts.length=0;
  for(const [team,h] of world.harbors.entries())for(const [i,t] of h.turrets.entries()){
   const ship=allShips.find(s=>belongs(t.base,s.root));if(ship&&!ship.enabled)continue;addMount(t.base,team,'gun-'+team+'-'+i,[0,2.7,5],ship,t.swivel);
  }
  for(const t of cloneGuns)if(t.ship.enabled)addMount(t.base,t.ship.team,'gun-'+t.ship.id+'-'+mounts.length,[0,2.7,5],t.ship,t.swivel);
  for(const [team,castle] of world.castles.entries())castle.traverse(o=>{
   const type=o.userData.defense?.type;if(!type||!DEFENSE_RULES[type]||o.userData.solidTerrace)return;
   let visible=true;for(let p=o;p;p=p.parent)if(!p.visible||p.userData.preview)visible=false;if(!visible)return;
   addMount(o,team,(o.userData.cell?'custom-':'original-')+team+'-'+mounts.length,o.userData.defense?.muzzle||[0,3,4],null,null,type);
  });collision.rebuild();
 }
 sync();
 const bars=allShips.map(s=>{const g=new T.Group(),back=new T.Mesh(new T.PlaneGeometry(12,1),new T.MeshBasicMaterial({color:0x172b39,depthTest:false})),fill=new T.Mesh(new T.PlaneGeometry(11.6,.6),new T.MeshBasicMaterial({color:s.team?0xf49bc7:0x80eee2,depthTest:false}));fill.position.z=.02;g.add(back,fill);scene.add(g);g.visible=false;g.renderOrder=15;return {s,g,fill};});
 function render(camera){for(const {s,g,fill} of bars){g.visible=s.enabled&&combat.state.phase!=='idle'&&s.hp>0;g.position.copy(s.root.position);g.position.y+=s.big?28:19;g.quaternion.copy(camera.quaternion);fill.scale.x=s.hp/s.maxHp;}}
 function setCombat(c){combat=c;}
 function approach(w){return w.root.localToWorld(new T.Vector3(...(w.root.userData.defense?.entry||[0,0,0])));}
 function pos(w){if(w.rig)return w.rig.muzzle(new T.Vector3());const root=w.swivel||w.root;root.updateWorldMatrix(true,false);return root.localToWorld(w.swivel?new T.Vector3(0,.95,5.5):w.local.clone());}
 function canEngageActor(w,a){const from=pos(w),to=new T.Vector3(a.state.x,a.state.y+1,a.state.z);return from.distanceTo(to)<=w.range&&!shieldContact(from,to,w.team,combat.shieldVolumes,combat.state.shields,.5)&&!collision.firstHit(from,to,w.ignore);}
 function boardingCheck(a,s,seatIndex=-1){
  const result={ready:false,reason:'unavailable',distance:null,seatIndex:-1,openSeats:0};
  if(!s||!a.alive||a.mount||a.team!==s.team||s.hp<=0)return result;
  const box=new T.Box3();for(const m of s.parts){m.updateWorldMatrix(true,false);m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));}
  const eye=new T.Vector3(a.state.x,a.state.y+1.05,a.state.z);result.distance=box.distanceToPoint(eye);result.openSeats=s.seats.filter(t=>!t.actor).length;
  if(result.distance>11){result.reason='distance';return result;}
  const edge=box.clampPoint(eye,V());if(Number.isFinite(collision.distance(eye,edge,new Set(s.parts)))){result.reason='blocked';return result;}
  const i=seatIndex>=0?seatIndex:s.seats.findIndex(t=>!t.actor);if(i<0||s.seats[i]?.actor){result.reason='full';return result;}
  result.ready=true;result.reason='ready';result.seatIndex=i;return result;
 }
 function boardingStatus(shipId,a=actors[0]){
  const ship=ships.find(s=>s.id===shipId&&s.team===a.team),result=boardingCheck(a,ship);
  const label=ship?.big?'Crew ship':'Scout ship';
  result.message=result.reason==='distance'?label+' · '+Math.ceil(result.distance)+'m from hull · approach within 11m.':result.reason==='blocked'?label+' · boarding path blocked. Move around the obstacle.':result.reason==='full'?label+' · all seats occupied.':result.ready?label+' · IN REACH · F to board · '+result.openSeats+' seats open.':'Selected ship unavailable. Choose another boarding target.';
  return result;
 }
 function board(a,s,seatIndex=-1){
  const check=boardingCheck(a,s,seatIndex);if(!check.ready)return false;const i=check.seatIndex;
  a.planController?.abort();a.planToken=(a.planToken||0)+1;a.planning=false;a.backtracking=false;a.path=[];a.pathIndex=0;a.fleetTask=null;a.spawnPending=false;
  s.seats[i].actor=a;a.mount={ship:s.id,seat:i};a.role=s.seats[i].role;a.reason='Aboard '+(s.big?'crew ship':'scout ship');s.departAt=combat.state.time+6;place(s);return true;
 }
 function place(s){s.root.updateMatrixWorld(true);for(const seat of s.seats)if(seat.actor){const p=s.root.localToWorld(seat.position.clone());Object.assign(seat.actor.state,{x:p.x,y:p.y,z:p.z,vx:s.velocity.x,vy:s.velocity.y,vz:s.velocity.z,grounded:false,flight:false,flightKind:null});}}
 function exit(a){
  if(!a.mount)return false;const s=ships.find(s=>s.id===a.mount.ship),w=mounts.find(w=>w.id===a.mount.gun);
  if(s){s.seats[a.mount.seat].actor=null;if(s.stage!=='moored'&&(a.mount.seat===0||s.stage==='manual'&&!s.seats.some(t=>t.actor))){s.stage='holding';s.departAt=combat.state.time;}const dir=s.destination?new T.Vector3(s.destination.x-s.root.position.x,0,s.destination.z-s.root.position.z).normalize():new T.Vector3(s.team?1:-1,0,0);Object.assign(a.state,{x:a.state.x+dir.x*12,z:a.state.z+dir.z*12,flight:true,flightKind:'dismount',manual:true,grounded:false,phase:'falling',vy:0});}
  if(w){w.operator=null;a.state.vx=0;a.state.vz=0;}
  a.mount=null;a.path=[];a.pathIndex=0;a.decisionAt=0;a.fleetTask=null;a.defenseTask=null;a.reason='Disembarking onto a supported approach';if(a.human)onMessage(s?'Airborne · WASD steer to a landing · gravity continues.':'Defense released · movement restored.');return true;
 }
 function interact(a=actors[0],preferredShip=""){
  if(a.mount)return exit(a);if(!a.alive)return false;
  const candidates=ships.filter(s=>s.team===a.team&&s.hp>0&&(!preferredShip||s.id===preferredShip)).sort((s,t)=>s.root.position.distanceTo(new T.Vector3(a.state.x,a.state.y,a.state.z))-t.root.position.distanceTo(new T.Vector3(a.state.x,a.state.y,a.state.z)));
  for(const s of candidates)if(board(a,s)){onMessage('Boarded '+s.seats[a.mount.seat].role+'. F exit · G change seat · R/C rise/lower.');return true;}
  if(preferredShip){onMessage(boardingStatus(preferredShip,a).message);return false;}
  const w=mounts.find(w=>!w.ship&&w.team===a.team&&w.hp>0&&(!w.operator||a.human&&!w.operator.human)&&approach(w).distanceTo(new T.Vector3(a.state.x,a.state.y,a.state.z))<8);
  if(w){if(w.operator&&w.operator!==a){const crew=w.operator,p=approach(w);crew.mount=null;Object.assign(crew.state,{x:p.x,y:p.y,z:p.z,grounded:true});crew.assignedPost=null;crew.serviceTask=null;crew.serviceRetryAt=combat.state.time+3;}w.operator=a;a.mount={gun:w.id};onMessage('Manual defense control. Aim and fire; F to leave.');return true;}
  onMessage('Approach a friendly ship hull or defense to enter.');return false;
 }
 function cycle(a=actors[0]){const s=ships.find(s=>s.id===a.mount?.ship);if(!s||s.seats.length<2)return;const old=a.mount.seat,i=(old+1)%s.seats.length,other=s.seats[i].actor;s.seats[old].actor=other;if(other)other.mount.seat=old;s.seats[i].actor=a;a.mount.seat=i;onMessage(s.seats[i].role+' · F exit · G next seat');}
 function shoot(w,target,operator){if(!w||w.hp<=0||w.ship?.hp<=0||combat.state.cores[w.team]<=0)return false;w.sourceActor=operator?.id;w.rig?.aim(new T.Vector3(target.x,target.y,target.z),combat.state.time,false);if(w.swivel&&!w.rig){const local=w.root.worldToLocal(new T.Vector3(target.x,target.y,target.z));w.swivel.rotation.y=Math.atan2(local.x,local.z);}const p=pos(w);Object.assign(w.state,{x:p.x,y:p.y-1.05,z:p.z});w.alive=true;const ok=combat.fire(w,target);if(ok)w.rig?.markShot(combat.state.time);if(ok&&operator)operator.shots=(operator.shots||0)+1;return ok;}
 function weaponView(a,target){const ship=ships.find(s=>s.id===a.mount?.ship),guns=mounts.filter(w=>w.ship===ship),w=mounts.find(w=>w.id===a.mount?.gun)||(ship&&a.mount.seat<3?guns[a.mount.seat===2?1:0]:null);if(!w)return null;if(target&&w.rig)w.rig.aim(new T.Vector3(target.x,target.y,target.z),combat.state.time);if(target&&w.swivel&&!w.rig){const local=w.root.worldToLocal(new T.Vector3(target.x,target.y,target.z));w.swivel.rotation.y=Math.atan2(local.x,local.z);}return {actor:w,disabled:combat.state.cores[w.team]<=0,weapon:w.mountWeapon,origin:pos(w),nextShot:w.nextShot,ignore:w.ignore};}
 function fire(a,target){if(!a.mount||a.mount.chariot){a.ignore=undefined;return combat.fire(a,target);}const s=ships.find(s=>s.id===a.mount.ship),w=mounts.find(w=>w.id===a.mount.gun);if(w)return shoot(w,target,a);a.ignore=new Set(s.parts);const guns=mounts.filter(w=>w.ship===s);return a.mount.seat<3?shoot(guns[a.mount.seat===2?1:0],target,a):combat.fire(a,target);}
 function choose(s){
  const options=combat.objectives.filter(o=>o.id<4).map(o=>({o,score:(o.owner===s.team?-250:200)-s.root.position.distanceTo(new T.Vector3(o.x,100,o.z))*.1-ships.filter(t=>t!==s&&t.team===s.team&&t.destination?.id===o.id).length*150})).sort((a,b)=>b.score-a.score);
  if(!options.length){s.destination=null;s.detour=null;s.stage='holding';s.departAt=combat.state.time;return;}
  s.destination=options[0].o;s.detour=null;s.stage='climb';
 }
 function safeTarget(s,target){
  if(s.detour&&s.root.position.distanceTo(s.detour)<5)s.detour=null;
  if(s.detour)return s.detour.clone();
  const contact=shieldContact(s.root.position,target,s.team,combat.shieldVolumes,combat.state.shields,s.big?27:16);
  if(contact){const v=combat.shieldVolumes.find(v=>v.team===contact.team),side=target.z>=v.z?1:-1;s.detour=new T.Vector3(v.x,target.y,v.z+side*(v.rz+(s.big?55:40)));return s.detour.clone();}
  return target;
 }
 function move(s,dt,input){
  const speed=s.big?38:58,v=new T.Vector3(input.x,input.y,input.z);if(v.length()>1)v.normalize();v.multiplyScalar(speed);const previousYaw=s.root.rotation.y;
  if(!Number.isFinite(input.heading)&&!s.seats[0].actor?.human&&combat.state.time<(s.avoidUntil||0)){const x=v.x,z=v.z;v.set(-z,.12*speed,x).normalize().multiplyScalar(speed*.8);}
  // A commanded direction turns the bow first; thrust follows the hull rather than strafing.
  const horizontal=Math.hypot(v.x,v.z);if(Number.isFinite(input.heading)){const error=Math.atan2(Math.sin(input.heading-previousYaw),Math.cos(input.heading-previousYaw)),turn=T.MathUtils.clamp(error,-dt*(s.big?.72:1.25),dt*(s.big?.72:1.25));s.root.rotation.y+=turn;if(Math.abs(error-turn)>.03)v.set(0,0,0);}else if(horizontal>.01){const target=Math.atan2(v.x,v.z),error=Math.atan2(Math.sin(target-previousYaw),Math.cos(target-previousYaw)),turn=T.MathUtils.clamp(error,-dt*(s.big?.72:1.25),dt*(s.big?.72:1.25));s.root.rotation.y+=turn;const remaining=error-turn,thrust=horizontal*Math.max(0,Math.cos(remaining));v.x=Math.sin(s.root.rotation.y)*thrust;v.z=Math.cos(s.root.rotation.y)*thrust;}
  s.velocity.lerp(v,1-Math.exp(-dt*(s.big?.85:1.35)));
  const before=s.root.position.clone(),after=before.clone().addScaledVector(s.velocity,dt);after.x=T.MathUtils.clamp(after.x,-570,570);after.z=T.MathUtils.clamp(after.z,-570,570);after.y=T.MathUtils.clamp(after.y,5,210);
  const ignore=new Set(s.parts),offsets=[[0,-5,0],[-(s.big?7:4),0,0],[s.big?7:4,0,0],[0,0,s.big?23:12],[0,0,s.big?-23:-12]];
  const blocked=offsets.some(o=>{const a=before.clone().add(new T.Vector3(...o).applyAxisAngle(new T.Vector3(0,1,0),previousYaw)),b=after.clone().add(new T.Vector3(...o).applyAxisAngle(new T.Vector3(0,1,0),s.root.rotation.y));return Number.isFinite(collision.distance(a,b,ignore));});
  if(!blocked)s.root.position.copy(after);else{s.root.rotation.y=previousYaw;s.velocity.set(0,0,0);if(!s.seats[0].actor?.human)s.avoidUntil=combat.state.time+1.2;s.stage=s.stage==='cruise'?'climb':s.stage;}
  s.root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(s.root);bounds.getSize(s.collisionHalfSize).multiplyScalar(.5);bounds.getCenter(s.collisionOffset).sub(s.root.position);
  place(s);
 }
 function reset(){generation++;nextDefenseScan=0;for(const a of actors){if(a.fleetTask)releaseCrew(a,combat?.state.time||0,'Battle reset');a.crewAttempts=0;if(a.defenseTask)releaseDefense(a,combat?.state.time||0,'Battle reset');exit(a);a.fleetTask=null;a.defenseTask=null;a.defenseRetryAt=0;a.defenseAttempts=0;}for(const s of ships){s.root.visible=true;s.hp=s.maxHp;s.respawnAt=0;s.root.position.copy(s.home);s.root.rotation.set(0,s.homeAngle||0,0);s.velocity.set(0,0,0);s.destination=null;s.detour=null;s.avoidUntil=0;s.stage='moored';s.seats.forEach(t=>t.actor=null);}for(const w of mounts){w.hp=w.maxHp;w.alive=true;w.nextShot=0;w.scanAt=0;w.recruitAt=0;w.alertUntil=0;w.blindSince=null;w.operator=null;w.magazines={};w.respawnAt=0;}motion={x:0,z:0};vertical=0;scene.updateMatrixWorld(true);for(const b of bars)b.g.visible=false;collision.rebuild();}
 function releaseCrew(a,time,reason){a.fleetTask=null;a.planController?.abort();a.planToken=(a.planToken||0)+1;a.planning=false;a.backtracking=false;a.path=[];a.pathIndex=0;a.stuck=0;a.decisionAt=time;a.reason=reason;}
 function routeCrew(a,s,time){
  const p=world.pads[s.team],goal={...(s.port?.approach||{x:p.x+(s.team?-1:1)*26,y:p.y,z:0}),radius:3};
  a.planController?.abort();a.planController=new AbortController();a.planToken=(a.planToken||0)+1;const token=a.planToken,gen=generation;a.planning=true;a.crewAttempts=(a.crewAttempts||0)+1;
  const current=()=>gen===generation&&a.planToken===token&&a.fleetTask===s.id;
  navigation.path(a.state,goal,{signal:a.planController.signal,maxMs:800,maxVisited:6000,walkingOnly:true}).then(route=>{
   if(!current())return;a.planning=false;
   if(combat.state.phase!=='running'||!a.alive||s.hp<=0||s.stage!=='moored'||!s.seats.some(t=>!t.actor)){releaseCrew(a,combat.state.time,'Transport unavailable; returning to team duties');return;}
   if(route.reachable){a.path=route.points;a.pathIndex=0;a.backtracking=false;a.stuck=0;a.progressAt=combat.state.time;a.progressPosition={x:a.state.x,y:a.state.y,z:a.state.z};a.routeStatus='following';a.role='Crew';a.reason=a.crewAttempts>1?'Taking a checked detour to the transport':'Walking to a transport for an outer silo';}
   else releaseCrew(a,combat.state.time,'No supported port approach; returning to team duties');
  }).catch(()=>{if(current())releaseCrew(a,combat.state.time,'Transport route cancelled; returning to team duties');});
 }
 function recruit(time){
  for(const s of ships)if(s.hp>0&&s.stage==='moored'&&s.seats.some(t=>!t.actor)&&(s.big||s.team===1||time>30)){
   if(actors.filter(a=>a.team===s.team).length<4)continue;const available=s.seats.filter(t=>!t.actor).length-actors.filter(a=>a.fleetTask===s.id).length;if(available<=0)continue;
   const eligible=actors.filter(a=>!a.human&&a.team===s.team&&a.alive&&!a.mount&&!a.fleetTask&&!a.serviceTask&&!a.defenseTask&&a.spawnPending&&a.ordinal%8<(s.big?2:4)&&a.ordinal%8>=(s.big?0:3));
   for(const a of eligible.slice(0,available)){a.spawnPending=false;a.fleetTask=s.id;a.crewAttempts=0;routeCrew(a,s,time);}
  }
 }
 function releaseDefense(a,time,reason,cooldown=0){
  a.defenseTask=null;a.planController?.abort();a.planToken=(a.planToken||0)+1;a.planning=false;a.backtracking=false;a.path=[];a.pathIndex=0;a.stuck=0;a.decisionAt=time;a.defenseRetryAt=time+cooldown;a.reason=reason;
 }
 function routeDefense(a,w,time){
  const p=approach(w),distance=n=>Math.hypot(n.x-p.x,n.y-p.y,n.z-p.z);
  const candidates=[],nodes=(navigation.nodes||[]).filter(n=>distance(n)<8.5&&Math.abs(n.y-p.y)<2).sort((n,m)=>Math.hypot(n.x-a.state.x,n.y-a.state.y,n.z-a.state.z)-Math.hypot(m.x-a.state.x,m.y-a.state.y,m.z-a.state.z));
  for(const n of nodes){if(candidates.every(c=>Math.hypot(c.x-n.x,c.y-n.y,c.z-n.z)>2))candidates.push(n);if(candidates.length===4)break;}
  if(!candidates.length){const n=navigation.nearest?.(p,8);if(n&&distance(n)<8.5)candidates.push(n);}
  if(!candidates.length){w.recruitAt=Math.max(w.recruitAt||0,time+12);releaseDefense(a,time,'No supported battery approach',6);return;}
  a.planController?.abort();a.planController=new AbortController();a.planToken=(a.planToken||0)+1;const token=a.planToken,gen=generation;a.planning=true;a.defenseAttempts=(a.defenseAttempts||0)+1;a.reason=a.defenseAttempts>1?'Checking another supported route to the castle battery':'Responding to a castle incursion; taking a battery';
  const current=()=>gen===generation&&a.planToken===token&&a.defenseTask===w.id;
  const search=async()=>{const deadline=performance.now()+800;let route=null,work=6000;for(const goal of candidates){const remaining=deadline-performance.now();if(remaining<=0||work<=0)break;route=await navigation.path(a.state,{...goal,radius:1},{signal:a.planController.signal,maxMs:remaining,maxVisited:work,walkingOnly:true});work-=route.visited||0;if(!current())return null;if(route.reachable)return route;}return route;};
  search().then(route=>{
   if(!current())return;a.planning=false;
   if(combat.state.phase!=='running'||!a.alive||w.hp<=0||combat.state.cores[w.team]<=0||w.operator){releaseDefense(a,combat.state.time,'Battery assignment is no longer available');return;}
   if(route?.reachable){a.path=route.points;a.pathIndex=0;a.backtracking=false;a.stuck=0;a.progressAt=combat.state.time;a.progressPosition={x:a.state.x,y:a.state.y,z:a.state.z};a.routeStatus='following';}
   else{w.recruitAt=Math.max(w.recruitAt||0,combat.state.time+12);releaseDefense(a,combat.state.time,'No supported battery detour; returning to team duties',6);}
  }).catch(()=>{if(current())releaseDefense(a,combat.state.time,'Battery route cancelled; returning to team duties',6);});
 }
 function defend(time){
  if(time<nextDefenseScan)return;nextDefenseScan=time+.25;for(const a of actors)if(a.defenseTask){const w=mounts.find(w=>w.id===a.defenseTask);if(!a.alive||!w||w.hp<=0||combat.state.cores[w.team]<=0||w.operator)releaseDefense(a,time,'Battery assignment is no longer available');}
  const nearbyGuardDistance=w=>{const p=approach(w);return Math.min(Infinity,...actors.filter(a=>!a.human&&a.alive&&a.team===w.team&&!a.mount&&!a.fleetTask&&!a.serviceTask).map(a=>p.distanceTo(new T.Vector3(a.state.x,a.state.y,a.state.z))));};
  for(const w of mounts.filter(w=>!w.ship&&w.hp>0&&combat.state.cores[w.team]>0).sort((a,b)=>nearbyGuardDistance(a)-nearbyGuardDistance(b))){
   const p=approach(w),home=world.pads[w.team],intruders=actors.filter(a=>a.alive&&a.team!==w.team&&Math.hypot(a.state.x-home.x,a.state.z-home.z)<110&&a.state.y>home.y-12);
   let engaged;const hasShot=()=>engaged??=(intruders.some(a=>canEngageActor(w,a)));if(w.operator&&!w.operator.human){if(!intruders.length){w.blindSince=null;if(time>(w.alertUntil||0))exit(w.operator);}else if(!hasShot()){w.blindSince??=time;if(time-w.blindSince>2){const a=w.operator;exit(a);a.reason='Battery sight line blocked; finding another defense';w.recruitAt=time+12;w.blindSince=null;}}else{w.blindSince=null;w.alertUntil=time+4;w.operator.role='Battery defender';w.operator.reason='Operating a castle battery against an intruder';}}const waiting=actors.find(a=>a.defenseTask===w.id);if(!intruders.length){if(waiting)releaseDefense(waiting,time,'Castle approach clear; returning to team duties');continue;}if(w.operator)continue;
   if(waiting){if(!hasShot()){releaseDefense(waiting,time,'Battery sight line blocked; finding another defense');continue;}if(waiting.backtracking)continue;if(p.distanceTo(new T.Vector3(waiting.state.x,waiting.state.y,waiting.state.z))<9){releaseDefense(waiting,time,'Operating a castle battery against an intruder');w.operator=waiting;waiting.mount={gun:w.id};w.alertUntil=time+4;}else if(!waiting.planning&&waiting.pathIndex>=waiting.path.length){if(waiting.defenseAttempts>=3)releaseDefense(waiting,time,'Battery approach remains blocked; another guard can respond',6);else routeDefense(waiting,w,time);}continue;}
   if(actors.filter(a=>a.team===w.team&&a.defenseTask).length>=2||time<(w.recruitAt||0))continue;w.recruitAt=time+3;
   const guard=actors.filter(a=>!a.human&&!a.medic&&a.weapon!==5&&a.rescueId==null&&a.alive&&a.team===w.team&&!a.mount&&!a.fleetTask&&!a.serviceTask&&!a.defenseTask&&!a.planning&&time>=(a.defenseRetryAt||0)&&a.state.grounded&&Math.hypot(a.state.x-home.x,a.state.z-home.z)<140).sort((a,b)=>p.distanceTo(new T.Vector3(a.state.x,a.state.y,a.state.z))-p.distanceTo(new T.Vector3(b.state.x,b.state.y,b.state.z)))[0];
   if(!guard||!hasShot())continue;guard.planController?.abort();guard.planToken=(guard.planToken||0)+1;guard.defenseTask=w.id;guard.spawnPending=false;guard.defenseAttempts=0;guard.role='Battery defender';routeDefense(guard,w,time);
  }
 }
 function step(dt){
  const time=combat.state.time;if(combat.state.phase==='evacuation'){for(const a of actors)if(a.defenseTask){a.defenseTask=null;a.planController?.abort();a.planToken++;a.planning=false;a.path=[];a.pathIndex=0;}for(const w of mounts)if(w.operator&&!w.operator.human)exit(w.operator);}if(combat.state.phase==='running'){if(!crewRequired)defend(time);recruit(time);}
  for(const a of actors)if(a.fleetTask){const s=ships.find(s=>s.id===a.fleetTask);if(combat.state.phase!=='running'||!a.alive||!s||s.hp<=0||s.stage!=='moored'||!s.seats.some(t=>!t.actor)){releaseCrew(a,time,'Transport unavailable; returning to team duties');continue;}if(a.backtracking)continue;if(board(a,s))continue;if(!a.planning&&a.pathIndex>=a.path.length){if(a.crewAttempts>=3)releaseCrew(a,time,'Port approach remains blocked; continuing on foot');else routeCrew(a,s,time);}}
  for(const s of ships){
   for(const seat of s.seats)if(seat.actor&&!seat.actor.alive)exit(seat.actor);
   if(s.hp<=0){if(!s.respawnAt){for(const seat of s.seats)if(seat.actor)exit(seat.actor);s.root.visible=false;s.respawnAt=time+22;onMessage('A '+(s.big?'crew ship':'scout ship')+' was destroyed. Replacement in 22 seconds.');}if(time>=s.respawnAt&&combat.state.phase==='running'){s.hp=s.maxHp;s.root.visible=true;s.root.position.copy(s.home);s.root.rotation.set(0,s.homeAngle||0,0);s.velocity.set(0,0,0);s.stage='moored';s.destination=null;s.respawnAt=0;}continue;}
   const pilot=s.seats[0].actor;if(pilot&&!pilot.human&&combat.state.phase==='evacuation'&&s.stage.startsWith('return-'))choose(s);if(!pilot&&s.stage==='holding'&&time>s.departAt+15){s.stage='return-climb';}if(s.stage.startsWith('return-')&&(!pilot||!pilot.human)){
    let target;if(s.stage==='return-climb'){target=new T.Vector3(s.root.position.x,175,s.root.position.z);if(s.root.position.y>173)s.stage='return-cruise';}
    else if(s.stage==='return-cruise'){target=new T.Vector3(s.home.x,175,s.home.z);if(Math.hypot(s.root.position.x-s.home.x,s.root.position.z-s.home.z)<(s.big?38:20))s.stage='return-descend';}
    else{target=s.home.clone();if(Math.hypot(s.home.x-s.root.position.x,s.home.z-s.root.position.z)>.2)target.y=s.root.position.y;}
    const d=(s.stage.includes('cruise')?safeTarget(s,target):target).sub(s.root.position),n=d.length();const command=n?{x:d.x/n*Math.min(1,n/8),y:d.y/n*Math.min(1,n/8),z:d.z/n*Math.min(1,n/8)}:{x:0,y:0,z:0};if(s.stage==='return-descend')command.heading=s.homeAngle||0;move(s,dt,command);if(s.root.position.distanceTo(s.home)<1){s.stage='moored';s.destination=null;s.departAt=time+6;s.velocity.set(0,0,0);if(pilot)pilot.reason='Waiting at port for a new crew';}continue;
   }if(!pilot){s.velocity.multiplyScalar(Math.exp(-dt*4));place(s);continue;}
   if(pilot.human){if(s.stage==='moored'&&Math.hypot(motion.x,motion.z,vertical)>.01)s.stage='manual';move(s,dt,{x:motion.x,z:motion.z,y:vertical});}
   else{
    if(s.stage==='moored'&&s.big&&combat.state.phase==='running'&&!s.seats.slice(1).some(t=>t.actor)){pilot.reason='Waiting at port for a new crew';place(s);continue;}
    if(s.stage==='manual'||s.stage==='moored'&&time>=s.departAt||!s.destination&&s.stage!=='moored')choose(s);
    if(s.stage==='moored'||!s.destination){place(s);continue;}
    const o=s.destination,island=world.outposts?.find(p=>Math.hypot(p.x-o.x,p.z-o.z)<1),shore=(island?.radius||36)+(s.big?8:5),outward=new T.Vector3(s.home.x-o.x,0,s.home.z-o.z);if(!outward.lengthSq())outward.set(1,0,0);outward.normalize();
    // Hover beyond the island rim; crew exits toward supported shore instead of the tower hull.
    const target=new T.Vector3(o.x,s.stage==='climb'||s.stage==='cruise'?175:o.y+7,o.z).addScaledVector(outward,shore);
    if(s.stage==='climb'){target.x=s.root.position.x;target.z=s.root.position.z;if(s.root.position.y>173)s.stage='cruise';}
    else if(s.stage==='cruise'&&Math.hypot(target.x-s.root.position.x,target.z-s.root.position.z)<2)s.stage='descend';
    else if(s.stage==='descend'&&s.root.position.distanceTo(target)<2){s.stage='holding';s.departAt=time+20;for(const seat of s.seats.slice(s.big?1:0))if(seat.actor&&!seat.actor.human)exit(seat.actor);}
    if(s.stage==='holding'){if(time>=s.departAt){if(s.big&&combat.state.phase==='running'&&!s.seats.slice(1).some(t=>t.actor)){s.stage='return-climb';s.destination=null;s.detour=null;pilot.reason='Returning empty transport to its castle port';}else choose(s);}place(s);}
    else{const d=(s.stage.includes('cruise')?safeTarget(s,target):target).sub(s.root.position),n=d.length(),command=n?{x:d.x/n*Math.min(1,n/8),y:d.y/n*Math.min(1,n/8),z:d.z/n*Math.min(1,n/8)}:{x:0,y:0,z:0};if(s.stage==='descend')command.heading=Math.atan2(-outward.x,-outward.z);move(s,dt,command);}
   }
  }
  for(const w of mounts){
   w.rig?.update(time);w.root.userData.wrecked=w.hp<=0;const brokenMechanism=w.root.getObjectByName('sketch-swivel');if(brokenMechanism)brokenMechanism.rotation.z=w.hp<=0?.6:0;w.lowBattery=combat.state.cores[w.team]<=0;if(w.lowBattery)continue;
   const crewSeat=w.ship?.seats[mounts.filter(m=>m.ship===w.ship).indexOf(w)+1];w.staff?.update(dt,!!(w.operator?.human||crewSeat?.actor),w.hp>0&&(!w.ship||w.ship.hp>0)&&(!crewRequired||w.ship||!!w.operator?.human));
   if(w.ship?.hp<=0)continue;if(w.operator&&!w.operator.alive)exit(w.operator);
   if(w.hp<=0){if(crewRequired&&!w.ship)continue;if(!w.respawnAt)w.respawnAt=time+25;if(time>=w.respawnAt&&combat.state.phase==='running'){w.hp=w.maxHp;w.respawnAt=0;}continue;}
   const seat=w.ship?.seats[mounts.filter(m=>m.ship===w.ship).indexOf(w)+1],manual=w.operator?.human||seat?.actor?.human||(w.ship?.seats[0].actor?.human&&actors[0].mount?.seat===0);
   if(crewRequired&&!w.ship&&!w.operator)continue;if(manual||time<w.nextShot||time<(w.scanAt||0))continue;w.scanAt=time+.2;
   const p=pos(w),targets=fleetTargetsInRange(actors,ships,w.team,p,w.range);
   const target=targets.find(t=>{if(shieldContact(p,t,w.team,combat.shieldVolumes,combat.state.shields,.5))return false;const hit=collision.firstHit(p,t,w.ignore);return !hit||t.ship?.parts.includes(hit.object);});
   if(target)shoot(w,target,seat?.actor||w.operator);
  }
 }
 function status(a=actors[0]){const s=ships.find(s=>s.id===a.mount?.ship),w=mounts.find(w=>w.id===a.mount?.gun);return s?(s.big?'CREW SHIP':'SCOUT')+' · '+s.seats[a.mount.seat].role+' · HULL '+Math.ceil(s.hp)+'/'+s.maxHp+' · '+s.seats.filter(t=>t.actor).length+'/'+s.seats.length+' seats':w?(combat.state.cores[w.team]<=0?'LOW BATTERY · ':'DEFENSE · ')+Math.ceil(w.hp)+' HP':'F · Board ship / enter defense';}
 return {setCrewRequired(value){crewRequired=!!value;},addFieldMount(root,team,id){const w=addMount(root,team,id,root.userData.defense.muzzle,null,null,'trebuchet');collision.rebuild();return w;},refreshCollision(){collision.rebuild();},ships,mounts,dynamicSolids:dynamic,boardingStatus,ports:()=>ports,weaponView,render,setCombat,step,reset,sync,interact,cycle,fire,status,setMotion(input,rise){motion=input||{x:0,z:0};vertical=rise||0;},snapshot:()=>({ports:ports.map(p=>({id:p.id,length:p.length,big:p.big,ship:p.ship,home:p.home.toArray()})),ships:ships.map(s=>({id:s.id,team:s.team,hp:s.hp,maxHp:s.maxHp,x:s.root.position.x,y:s.root.position.y,z:s.root.position.z,stage:s.stage,heading:s.root.rotation.y,speed:s.velocity.length(),destination:s.destination?.id,respawnIn:Math.max(0,s.respawnAt-(combat?.state.time||0)),seats:s.seats.map(t=>({role:t.role,actor:t.actor?.id??null}))})),defenses:mounts.map(w=>({id:w.id,team:w.team,hp:w.hp,operator:w.operator?.id??null,nextShot:w.nextShot,lowBattery:combat?.state.cores[w.team]<=0}))})};
}
