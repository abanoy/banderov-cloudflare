import * as T from './vendor/three.module.js';
export const WEAPON_RULES={cannon:{range:30,damage:24,interval:.9},heavyCannon:{range:42,damage:60,interval:3.8},tower:{range:42,damage:45,interval:4.8},trebuchet:{range:60,minRange:10,damage:85,interval:6,blast:6}};
export class TrialWeapons{
 constructor(root,colliders,onLine=()=>{}){this.root=root;this.colliders=colliders;this.onLine=onLine;this.time=0;this.shots=0;this.impacts=0;this.projectiles=[];this.weapons=[];root.traverse(o=>{if(o.sketchRig?.armed)this.weapons.push({group:o,rig:o.sketchRig,type:o.userData.cell.type,cooldown:0});});this.ray=new T.Raycaster();}
 solids(weapon){const cell=weapon.group.userData.cell;return this.colliders.filter(o=>{for(let a=o;a;a=a.parent){const p=a.userData.cell;if(p&&p.x===cell.x&&p.z===cell.z&&p.layer===cell.layer)return false;if(!a.visible)return false;}return true;});}
 clear(a,b,solids){const d=new T.Vector3().subVectors(b,a),length=d.length();if(length<.001)return true;this.ray.set(a,d.normalize());this.ray.far=Math.max(0,length-.05);return !this.ray.intersectObjects(solids,false).length;}
 arc(a,b){const d=Math.hypot(a.x-b.x,a.z-b.z),t=Math.max(.8,Math.min(3.5,d/18));return {duration:t,velocity:new T.Vector3((b.x-a.x)/t,(b.y-a.y+7*t*t)/t,(b.z-a.z)/t)};}
 point(p,t){return p.start.clone().addScaledVector(p.velocity,t).add(new T.Vector3(0,-7*t*t,0));}
 step(dt,enemies){this.time+=dt;const living=()=>enemies.filter(e=>e.hp>0&&e.sprite.visible);
  for(const w of this.weapons){w.rig.update(this.time);w.cooldown-=dt;if(w.cooldown>0)continue;const rules=WEAPON_RULES[w.type],origin=w.rig.muzzle(new T.Vector3()),solids=this.solids(w);if(!rules)continue;
   for(const e of living()){const s=e.physics.state,target=new T.Vector3(s.x,s.y+1,s.z),distance=origin.distanceTo(target);if(distance>rules.range||distance<(rules.minRange||0))continue;w.rig.aim(target,this.time);origin.copy(w.rig.muzzle(new T.Vector3()));
    if(w.type==='trebuchet'){const arc=this.arc(origin,target),p={start:origin.clone(),...arc,time:0,solids,rules};let prior=origin.clone(),valid=true;for(let i=1;i<=40;i++){const next=this.point(p,arc.duration*i/40);if(!this.clear(prior,next,solids)){valid=false;break;}prior=next;}if(!valid)continue;p.mesh=new T.Mesh(new T.IcosahedronGeometry(.35,0),new T.MeshBasicMaterial({color:0xe8c69d}));p.mesh.position.copy(origin);this.root.add(p.mesh);this.projectiles.push(p);}
    else{if(!this.clear(origin,target,solids))continue;e.hp-=rules.damage;this.onLine(origin,target);if(e.hp<=0)e.sprite.visible=false;this.impacts++;}
    w.rig.markShot(this.time);w.cooldown=rules.interval;this.shots++;break;
   }
  }
  for(let i=this.projectiles.length-1;i>=0;i--){const p=this.projectiles[i],old=this.point(p,p.time);p.time=Math.min(p.duration,p.time+dt);const next=this.point(p,p.time);this.ray.set(old,next.clone().sub(old).normalize());this.ray.far=old.distanceTo(next);const hit=this.ray.intersectObjects(p.solids,false)[0];p.mesh.position.copy(hit?.point||next);
   if(hit||p.time>=p.duration){const at=hit?.point||next;for(const e of living()){const s=e.physics.state,target=new T.Vector3(s.x,s.y+1,s.z);if(at.distanceTo(target)<=p.rules.blast&&this.clear(at.clone().add(new T.Vector3(0,.1,0)),target,p.solids)){e.hp-=p.rules.damage;if(e.hp<=0)e.sprite.visible=false;}}this.impacts++;this.root.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.projectiles.splice(i,1);}
  }
 }
 dispose(){for(const w of this.weapons)w.rig.update(this.time+2);for(const p of this.projectiles){this.root.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}this.projectiles=[];}
}
