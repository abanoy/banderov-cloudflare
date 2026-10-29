import * as T from '../vendor/three.module.js';

// An opt-in, local range exercise. It never reads or writes player combat,
// progression, storage or networking. All motion uses the supplied simulation time.
export const DEFENSE_RULES=Object.freeze({
 cannon:Object.freeze({cooldown:2.4,range:175,speed:115,color:0x80f7ec}),
 heavyCannon:Object.freeze({cooldown:4.8,range:225,speed:90,color:0xd9b0ff}),
 beacon:Object.freeze({cooldown:6,range:250,speed:135,color:0xffdf8a})
});
const LIMITS=Object.freeze({bolts:48,particles:192,targetsPerHome:3,ambientBeacons:32,acquisitionsPerFrame:4,weaponScansPerFrame:64});
const Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);

export function createCastleDefense(world,scene){
 const root=new T.Group();root.name='Local castle defense practice';root.userData.practiceOnly=true;scene.add(root);
 const geometry=[new T.BoxGeometry(1,1,1),new T.OctahedronGeometry(1,0),new T.IcosahedronGeometry(1.65,0),new T.TorusGeometry(2.45,.13,4,24)];
 const materials=[new T.MeshBasicMaterial({color:0xffffff}),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false}),new T.MeshBasicMaterial({color:0x244557}),new T.MeshBasicMaterial({color:0xffdc93})];
 function instances(g,m,count){const mesh=new T.InstancedMesh(g,m,count);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;root.add(mesh);return mesh;}
 const boltMesh=instances(geometry[0],materials[0],LIMITS.bolts),particleMesh=instances(geometry[1],materials[1],LIMITS.particles),ambientMesh=instances(geometry[1],materials[1],LIMITS.ambientBeacons*3);
 const dummy=new T.Object3D(),ray=new T.Raycaster(),delta=new T.Vector3(),origin=new T.Vector3(),forward=new T.Vector3(),side=new T.Vector3(),aim=new T.Vector3();
 const bolts=Array.from({length:LIMITS.bolts},()=>({active:false,position:new T.Vector3(),direction:new T.Vector3(),target:null,weapon:null,born:0}));
 const particles=Array.from({length:LIMITS.particles},()=>({active:false,position:new T.Vector3(),velocity:new T.Vector3(),born:0,life:0,color:new T.Color()}));
 const targets=[];
 for(let home=0;home<world.castles.length;home++)for(let slot=0;slot<LIMITS.targetsPerHome;slot++){
  const group=new T.Group(),material=new T.MeshBasicMaterial({color:home?0xd8b4ef:0x94efde});materials.push(material);
  const body=new T.Mesh(geometry[2],material),halo=new T.Mesh(geometry[3],materials[3]);halo.rotation.x=Math.PI/2;group.add(body,halo);
  for(const sign of [-1,1]){const wing=new T.Mesh(geometry[0],materials[2]);wing.position.x=sign*2.4;wing.scale.set(3,.28,1.1);group.add(wing);}
  group.name=(home?'Dusk':'Dawn')+' practice drone '+(slot+1);group.userData.practiceOnly=true;group.visible=false;root.add(group);
  targets.push({id:home+':'+slot,home,slot,group,body,halo,material,position:group.position,readyAt:0,flashUntil:0,cycle:0,hits:0,anchor:null});
 }
 let enabled=false,disposed=false,time=0,lastTime=null,weapons=[],homes=[],ambient=[],cursor=0,particleCursor=0,shots=0,hits=0,blockedBolts=0,generation=0,losChecks=0;
 function hideInstances(mesh){dummy.position.set(0,0,0);dummy.scale.set(0,0,0);dummy.quaternion.identity();dummy.updateMatrix();for(let i=0;i<mesh.count;i++)mesh.setMatrixAt(i,dummy.matrix);mesh.instanceMatrix.needsUpdate=true;}
 function clearEffects(){for(const b of bolts){b.active=false;b.target=b.weapon=null;}for(const p of particles)p.active=false;hideInstances(boltMesh);hideInstances(particleMesh);for(const t of targets)t.group.visible=false;}
 function muzzle(w,out){return out.fromArray(w.muzzle).applyMatrix4(w.group.matrixWorld);}
 function direction(w,out){return out.fromArray(w.direction).transformDirection(w.group.matrixWorld);}
 function reset(){shots=hits=blockedBolts=0;cursor=0;for(const h of homes){h.shots=h.hits=0;}for(const w of weapons){w.nextAt=time;w.shots=w.hits=0;w.status='ready';w.lastShot=null;}for(const t of targets){t.readyAt=time;t.flashUntil=0;t.cycle=t.hits=0;}clearEffects();}
 function sync(){
  if(disposed)return;clearEffects();weapons=[];ambient=[];homes=[];generation++;
  for(const [home,castle] of world.castles.entries()){
   castle.updateWorldMatrix(true,true);const custom=castle.children.find(o=>o.visible&&o.userData.profile&&!o.userData.preview),list=[];
   if(custom)custom.traverse(o=>{const p=o.userData.cell,rules=p&&DEFENSE_RULES[p.type];if(!rules||o.userData.solidTerrace)return;const scale=p.type==='heavyCannon'?.95:.7,metadata=o.userData.defense||{muzzle:p.type==='beacon'?[0,5.6,0]:[0,2.69*scale,3.9*scale],direction:[0,0,1]},self=new Set();o.traverse(child=>self.add(child));
    const w={id:home+':'+p.x+':'+p.z+':'+p.layer,home,group:o,type:p.type,cell:{...p},muzzle:[...metadata.muzzle],direction:[...metadata.direction],self,rules,color:new T.Color(rules.color),nextAt:time,shots:0,hits:0,status:'ready',lastShot:null};list.push(w);weapons.push(w);if(p.type==='beacon'&&ambient.length<LIMITS.ambientBeacons)ambient.push(w);
   });
   homes.push({home,custom:!!custom,weapons:list,shots:0,hits:0});
   // Open, high positions are useful patrol anchors; selection never bypasses
   // range or the actual solid-mesh visibility checks below.
   const anchors=[...list].sort((a,b)=>b.cell.layer-a.cell.layer||a.cell.z-b.cell.z||a.cell.x-b.cell.x);
   const unarmedApproach=custom?{group:custom,muzzle:[0,8,44],direction:[0,0,1]}:null;
   for(const t of targets.filter(t=>t.home===home))t.anchor=anchors.length?anchors[Math.floor(t.slot*anchors.length/LIMITS.targetsPerHome)%anchors.length]:unarmedApproach;
  }
  hideInstances(ambientMesh);reset();return snapshot();
 }
 function blocked(from,to,w){
  delta.subVectors(to,from);const distance=delta.length();if(distance<.08)return false;
  ray.set(from,delta.multiplyScalar(1/distance));ray.near=.04;ray.far=Math.max(.04,distance-.06);losChecks++;
  return ray.intersectObjects(world.solids,false).some(hit=>!w.self.has(hit.object));
 }
 function burst(position,color,count,speed=8){
  for(let i=0;i<count;i++){
   const p=particles[particleCursor++%particles.length],n=particleCursor,angle=n*2.399,height=((n*7)%13)/6-1;
   p.active=true;p.position.copy(position);p.velocity.set(Math.cos(angle),height,Math.sin(angle)).multiplyScalar(speed*(.4+(n%5)*.15));p.born=time;p.life=.35+(n%4)*.12;p.color.copy(color);
  }
 }
 function placeTargets(){
  for(const t of targets){
   if(!enabled||!t.anchor){t.group.visible=false;continue;}
   if(time<t.flashUntil){t.group.visible=true;t.material.color.set(0xffffff);t.body.scale.setScalar(1.35);continue;}
   if(time<t.readyAt){t.group.visible=false;continue;}
   const w=t.anchor,phase=time*.29+t.slot*2.1+t.cycle*.7;direction(w,forward);side.crossVectors(Y,forward).normalize();muzzle(w,origin);
   t.position.copy(origin).addScaledVector(forward,73+Math.cos(phase)*34).addScaledVector(side,Math.sin(phase)*28);t.position.y+=12+Math.sin(phase*1.3)*5;
   t.group.visible=true;t.group.rotation.y=-phase;t.body.rotation.set(phase*.6,phase,0);t.halo.rotation.z=phase*.4;t.body.scale.setScalar(1);t.material.color.set(t.home?0xd8b4ef:0x94efde);
  }
 }
 function hit(t,w){
  if(time<t.readyAt)return;t.hits++;w.hits++;homes[w.home].hits++;hits++;t.cycle++;t.flashUntil=time+.22;t.readyAt=time+2.2;burst(t.position,w.color,12,12);t.material.color.set(0xffffff);
 }
 function acquire(){
  let attempts=0,scans=0;
  while(weapons.length&&attempts<LIMITS.acquisitionsPerFrame&&scans<Math.min(weapons.length,LIMITS.weaponScansPerFrame)){
   const w=weapons[cursor++%weapons.length];scans++;if(time<w.nextAt)continue;attempts++;
   muzzle(w,origin);direction(w,forward);const candidates=targets.filter(t=>t.home===w.home&&t.anchor&&time>=t.readyAt).map(t=>({t,distance:origin.distanceTo(t.position)})).filter(o=>o.distance<=w.rules.range&&aim.subVectors(o.t.position,origin).normalize().dot(forward)>-.15).sort((a,b)=>a.distance-b.distance);
   if(!candidates.length){w.status='out of range';continue;}
   const target=candidates.find(o=>!blocked(origin,o.t.position,w))?.t;if(!target){w.status='blocked';continue;}
   const bolt=bolts.find(b=>!b.active);if(!bolt){w.status='pool busy';continue;}
   bolt.active=true;bolt.position.copy(origin);bolt.direction.subVectors(target.position,origin).normalize();bolt.target=target;bolt.weapon=w;bolt.born=time;w.nextAt=time+w.rules.cooldown;w.status='cooling';w.lastShot=time;w.shots++;homes[w.home].shots++;shots++;burst(origin,w.color,w.type==='heavyCannon'?9:5,7);
  }
 }
 function advanceBolts(dt){
  for(const b of bolts){
   if(!b.active)continue;const t=b.target,w=b.weapon;
   if(time-b.born>4||!t.anchor||time<t.readyAt){b.active=false;continue;}
   b.direction.subVectors(t.position,b.position).normalize();const travel=w.rules.speed*dt,distance=b.position.distanceTo(t.position);aim.copy(b.position).addScaledVector(b.direction,Math.min(travel,distance));
   if(blocked(b.position,aim,w)){b.active=false;blockedBolts++;burst(aim,w.color,3,3);continue;}
   if(distance<=travel+2.4){b.active=false;hit(t,w);}else b.position.copy(aim);
  }
 }
 function drawPools(dt){
  for(let i=0;i<bolts.length;i++){const b=bolts[i];dummy.position.copy(b.position);dummy.quaternion.setFromUnitVectors(Z,b.direction);dummy.scale.setScalar(0);if(b.active)dummy.scale.set(b.weapon.type==='heavyCannon'?.48:.28,b.weapon.type==='heavyCannon'?.48:.28,b.weapon.type==='beacon'?6:4);dummy.updateMatrix();boltMesh.setMatrixAt(i,dummy.matrix);boltMesh.setColorAt(i,b.weapon?.color||materials[0].color);}
  for(let i=0;i<particles.length;i++){const p=particles[i],age=time-p.born;p.active=p.active&&age<p.life;if(p.active){p.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*5;}dummy.position.copy(p.position);dummy.rotation.set(i+age,age*2,i);dummy.scale.setScalar(p.active?.36*(1-age/p.life):0);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);particleMesh.setColorAt(i,p.color);}
  for(let i=0;i<LIMITS.ambientBeacons*3;i++){const w=ambient[Math.floor(i/3)],phase=time*.8+i*2.399;dummy.scale.setScalar(w?.24:0);if(w){muzzle(w,dummy.position);dummy.position.x+=Math.cos(phase)*2.2;dummy.position.y+=Math.sin(phase*1.8)*.8;dummy.position.z+=Math.sin(phase)*2.2;}dummy.rotation.set(phase,phase,0);dummy.updateMatrix();ambientMesh.setMatrixAt(i,dummy.matrix);ambientMesh.setColorAt(i,w?.color||materials[0].color);}
  for(const mesh of [boltMesh,particleMesh,ambientMesh]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }
 function update(nextTime){
  if(disposed||!Number.isFinite(nextTime)||nextTime===lastTime)return;
  if(lastTime!==null&&nextTime<lastTime){time=nextTime;lastTime=nextTime;reset();drawPools(0);return;}
  const dt=lastTime===null?0:Math.min(.1,Math.max(0,nextTime-lastTime));time=nextTime;lastTime=nextTime;
  placeTargets();if(enabled){advanceBolts(dt);acquire();}drawPools(dt);
 }
 function setEnabled(value){if(disposed)return;const next=!!value;if(next===enabled)return;enabled=next;if(enabled)reset();else clearEffects();placeTargets();drawPools(0);}
 function snapshot(){
  return {enabled,disposed,time,generation,shots,hits,blockedBolts,activeBolts:bolts.filter(b=>b.active).length,activeParticles:particles.filter(p=>p.active).length,losChecks,limits:{...LIMITS},homes:homes.map(h=>({home:h.home,custom:h.custom,weapons:h.weapons.length,beacons:h.weapons.filter(w=>w.type==='beacon').length,ready:h.weapons.filter(w=>time>=w.nextAt&&w.status!=='blocked').length,cooling:h.weapons.filter(w=>time<w.nextAt).length,blocked:h.weapons.filter(w=>time>=w.nextAt&&w.status==='blocked').length,shots:h.shots,hits:h.hits,targets:targets.filter(t=>t.home===h.home&&t.anchor).map(t=>({id:t.id,visible:t.group.visible,position:t.position.toArray(),hits:t.hits,respawnIn:Math.max(0,t.readyAt-time)}))})),weapons:weapons.map(w=>({id:w.id,home:w.home,type:w.type,cell:{...w.cell},status:!enabled?'off':time<w.nextAt?'cooling':w.status==='cooling'?'ready':w.status,cooldown:w.rules.cooldown,cooldownRemaining:Math.max(0,w.nextAt-time),range:w.rules.range,shots:w.shots,hits:w.hits,lastShot:w.lastShot})),scope:'Non-damaging local practice. No player damage, online progress or rewards.'};
 }
 function dispose(){if(disposed)return;disposed=true;clearEffects();scene.remove(root);weapons=[];ambient=[];homes=[];for(const t of targets)t.anchor=null;for(const mesh of [boltMesh,particleMesh,ambientMesh])mesh.dispose();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();}
 sync();return {sync,update,setEnabled,snapshot,dispose,get root(){return root;}};
}
