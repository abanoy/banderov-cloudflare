import * as T from '../vendor/three.module.js';

// Owner sketch study: separate reusable models, metres, +Z is firing direction.
export function buildArmory(kind,m,{openSides=[],armed=true}={}){
 const root=new T.Group(),solids=[],mechanism=new T.Group(),ownedMaterials=[];root.name=kind;
 const mesh=(g,mat,x=0,y=0,z=0,parent=root)=>{const o=new T.Mesh(g,mat);o.position.set(x,y,z);parent.add(o);return o;};
 const box=(x,y,z,w,h,d,mat=m.stone,parent=root)=>{const o=mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,parent);return o;};
 const beam=(a,b,w,mat=m.wood,parent=root)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),o=mesh(new T.CylinderGeometry(w,w,start.distanceTo(end),6),mat,0,0,0,parent);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;};
 const cylinder=(x,y,z,r,h,mat,parent=root)=>mesh(new T.CylinderGeometry(r,r,h,12),mat,x,y,z,parent);
 const band=(x,y,z,r,parent=root)=>{const o=mesh(new T.TorusGeometry(r,.1,4,16),m.brass,x,y,z,parent);return o;};
 function cannon(parent,y=0){
  const swivel=new T.Group();swivel.position.y=y;parent.add(swivel);
  cylinder(0,.2,0,1.65,.4,m.iron,swivel);cylinder(0,.48,0,1.25,.2,m.brass,swivel);
  for(const s of [-1,1]){box(s*1.12,1.2,0,.32,1.5,1.2,m.iron,swivel);band(s*1.3,1.3,0,.35,swivel).rotation.y=Math.PI/2;for(const y of [.75,1.75])mesh(new T.SphereGeometry(.1,6,4),m.brass,s*1.31,y,.35,swivel);}
  const barrel=new T.Group();barrel.position.set(0,1.3,0);swivel.add(barrel);barrel.rotation.x=-.13;
  // Closed wall cross section, with an actual recessed open muzzle.
  const body=mesh(new T.LatheGeometry([new T.Vector2(.55,-1.6),new T.Vector2(.78,-1.4),new T.Vector2(.65,1.7),new T.Vector2(.72,2.3),new T.Vector2(.49,2.3),new T.Vector2(.44,1.5)],16),m.iron,0,0,0,barrel);body.rotation.x=Math.PI/2;
  for(const z of [-1.35,-.6,1.7,2.25])band(0,0,z,z>2?.72:.67,barrel);
  mesh(new T.SphereGeometry(.61,10,6),m.iron,0,0,-1.35,barrel);
  mesh(new T.CircleGeometry(.45,16),m.dark,0,0,1.45,barrel);
  for(const s of [-1,1])box(s*.83,.08,-.4,.34,.3,1.5,m.brass,barrel);
  box(0,.7,.4,.12,.22,.42,m.brass,barrel);
  swivel.name='sketch-swivel';barrel.name='sketch-barrel';return {swivel,barrel,muzzle:new T.Vector3(0,1.3,2.3)};
 }
 function archWall(parent,x,y,z,w,h,d){
  const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(-w/2,h);shape.lineTo(w/2,h);shape.lineTo(w/2,0);shape.closePath();
  const hole=new T.Path();hole.moveTo(-.5,.6);hole.lineTo(.5,.6);hole.lineTo(.5,1.6);hole.absarc(0,1.6,.5,0,Math.PI,false);hole.lineTo(-.5,.6);shape.holes.push(hole);
  const g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);return mesh(g,m.stone,x,y,z,parent);
 }
 let fireRig=null,arm=null,string=null,bolt=null;
 if(kind==='cannon'){
  box(0,.35,0,6,.7,5,m.stone);box(0,.77,0,5.5,.15,4.5,m.paving);
  for(const s of [-1,1]){box(s*1.7,1.13,-.3,.6,.65,3.4,m.wood);for(const z of [-1.5,1]){const wheel=cylinder(s*2.1,1.08,z,.72,.3,m.wood);wheel.rotation.z=Math.PI/2;band(s*2.26,1.08,z,.72).rotation.y=Math.PI/2;}}
  fireRig=cannon(root,1);box(0,1.2,-1.65,2.5,.3,1.1,m.wood);
  for(let i=0;i<4;i++)mesh(new T.IcosahedronGeometry(.3,1),m.iron,2.2+i%2*.6,.9,-1.7+Math.floor(i/2)*.6);
 }
 if(kind==='watchtower'){
  const outline=(size,y)=>[[-size,y,-size],[size,y,-size],[size,y,size],[-size,y,size]];
  // Broad foot, tapered waist and an overhanging solid fighting platform.
  const rings=[outline(3.9,0),outline(3.9,1),outline(2.05,3.1),outline(2.05,10.3),outline(3.7,12.1)],verts=[],indices=[];
  for(const ring of rings)for(const p of ring)verts.push(...p);
  for(let r=0;r<rings.length-1;r++)for(let s=0;s<4;s++){if(r===3&&openSides.includes([0,3,2,1][s]))continue;const a=r*4+s,b=r*4+(s+1)%4,c=a+4,d=b+4;indices.push(a,c,b,b,c,d);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();solids.push(mesh(g,m.stone));
  solids.push(box(0,12.15,0,8,.55,8,m.edge),box(0,12.48,0,8,.12,8,m.paving));
  for(const [side,x,z,rotation] of [[0,0,-3.6,0],[1,-3.6,0,Math.PI/2],[2,0,3.6,0],[3,3.6,0,Math.PI/2]])if(!openSides.includes(side)){const wall=archWall(root,x,12.5,z,7.5,1.65,.5);wall.rotation.y=rotation;solids.push(wall);for(let i=-3;i<=3;i+=1.5)box(rotation?x:i,14.35,rotation?i:z,rotation?.65:.85,.75,rotation?.85:.65,m.edge);}
  // Dark inset arched slits on the shaft, with stone jambs.
  for(const s of [-1,1]){box(s*2.06,7.6,0,.04,1.4,.55,m.dark);box(0,7.6,s*2.06,.55,1.4,.04,m.dark);}
  for(let y=3.1;y<10;y+=2.4){box(0,y,0,4.2,.18,4.2,m.edge);}
  // Stone crest and hanging cloth mark the armed lookout without changing its outline.
  const crest=mesh(new T.OctahedronGeometry(.45,0),m.brass,0,10.5,2.08);crest.scale.set(1,1,.18);
  const flag=new T.Group();flag.name='sketch-pennant';flag.position.set(.95,9.7,2.13);root.add(flag);box(0,-.95,0,.75,1.7,.04,m.iron,flag);box(.95,9.7,2.19,1,.12,.15,m.brass);
  mesh(new T.OctahedronGeometry(.19,0),m.brass,0,-.8,.07,flag).scale.z=.15;
  for(const x of [-.7,.7])beam([x,.7,-4.02],[x,12.6,-4.02],.09,m.wood);
  for(let y=1;y<12.6;y+=.5)beam([-.7,y,-4.02],[.7,y,-4.02],.075,m.brass);
  if(armed)fireRig=cannon(root,12.65);
  for(const s of [-1,1]){box(s*2.8,12.7,-2.6,.65,.35,.9,m.wood);for(let i=0;i<3;i++)mesh(new T.IcosahedronGeometry(.25,1),m.iron,s*2.8,13,-2.75+i*.25);}
 }
 if(kind==='trebuchet'){
  box(0,.25,0,7,.5,7,m.paving);
  for(const x of [-2.15,2.15]){
   box(x,.65,0,.65,.7,6,m.wood);
   beam([x,.9,-2.5],[x,5.7,0],.27);beam([x,.9,2.5],[x,5.7,0],.27);
   box(x,3.2,0,.5,.45,3.2,m.wood);
   for(const z of [-2.5,2.5]){box(x,.75,z,1,.18,.9,m.iron);beam([x,.9,z],[x,3.2,0],.04,m.rope);for(const sign of [-1,1])mesh(new T.SphereGeometry(.09,6,4),m.brass,x+sign*.3,.88,z);}
  }
  beam([-2.75,5.65,0],[2.75,5.65,0],.25,m.iron);
  arm=new T.Group();arm.name='sketch-arm';arm.position.y=5.65;root.add(arm);arm.rotation.x=.45;
  box(0,0,1.7,.5,.5,7.3,m.wood,arm);for(const x of [-.34,.34])box(x,.04,.05,.16,.8,1.2,m.iron,arm);
  const weight=new T.Group();weight.name='sketch-counterweight';weight.position.z=-1.75;arm.add(weight);beam([0,-.15,0],[0,-1.8,0],.08,m.rope,weight);box(0,-2.05,0,2.3,1.8,1.5,m.stone,weight);box(0,-1.17,0,2.5,.18,1.7,m.brass,weight);
  const slingPivot=new T.Group();slingPivot.name='sketch-sling';slingPivot.position.z=5.3;arm.add(slingPivot);beam([0,0,0],[-.3,-1.1,.45],.04,m.rope,slingPivot);beam([0,0,0],[.3,-1.1,.45],.04,m.rope,slingPivot);
  const sling=mesh(new T.SphereGeometry(.47,8,4),m.rope,0,-1.2,.45,slingPivot);sling.scale.set(1,.35,1.3);const rock=mesh(new T.IcosahedronGeometry(.38,0),m.stone,0,-.96,.45,slingPivot);rock.name='sketch-loaded-stone';
  for(const x of [-2.15,2.15])beam([x,3.2,-1.2],[-x,3.2,1.2],.065,m.rope);
  box(0,.9,-2.25,3,.4,.5,m.wood);cylinder(0,1,-2.3,.27,1,m.iron).rotation.z=Math.PI/2;
 }
 if(kind==='bow'){
  box(0,.2,0,5,.4,5,m.paving);cylinder(0,1.3,0,.65,2.2,m.stone);cylinder(0,2.5,0,1.05,.3,m.brass);
  mechanism.name='sketch-swivel';root.add(mechanism);mechanism.position.y=2.75;
  box(0,0,-.15,.65,.55,3.8,m.wood,mechanism);box(0,.38,-.7,.95,.55,1.7,m.iron,mechanism);
  for(const s of [-1,1]){
   const points=[[0,0,.8],[s*.8,0,.95],[s*1.7,0,1.15],[s*2.65,0,.95],[s*3.25,0,.5]];
   for(let i=1;i<points.length;i++)beam(points[i-1],points[i],.12,m.wood,mechanism);
   const string=beam([s*3.25,0,.5],[0,0,-1.3],.035,m.rope,mechanism);string.name=s<0?'sketch-string-left':'sketch-string-right';string.userData.baseLength=Math.hypot(3.25,1.8);
   for(const z of [-.4,.2])box(s*.5,.6,z,.12,.65,.12,m.brass,mechanism);
  }
  for(let i=0;i<5;i++)beam([-.35+i*.175,.75,-.6],[-.35+i*.175,.75,1],.035,m.brass,mechanism);
  box(0,.13,-1.3,1.6,.23,.23,m.iron,mechanism);const crank=new T.Group();crank.position.set(.9,.05,-1.3);crank.name='sketch-crank';mechanism.add(crank);cylinder(0,0,0,.3,.15,m.brass,crank).rotation.z=Math.PI/2;beam([.12,0,.2],[.12,0,.65],.045,m.brass,crank);mesh(new T.SphereGeometry(.1,6,4),m.wood,.12,0,.65,crank);
  bolt=beam([0,.23,-1.25],[0,.23,1.5],.04,m.brass,mechanism);bolt.name='sketch-feed';mesh(new T.ConeGeometry(.12,.35,4),m.iron,0,.23,1.6,mechanism).rotation.x=Math.PI/2;
 }
 const height=kind==='watchtower'?16:kind==='trebuchet'?11:4;
 const muzzleNode=new T.Object3D();muzzleNode.name='sketch-muzzle';if(fireRig){muzzleNode.position.set(0,0,2.3);fireRig.barrel.add(muzzleNode);}else if(kind==='bow'){muzzleNode.position.set(0,.23,1.7);mechanism.add(muzzleNode);}else if(arm){muzzleNode.position.set(0,-.96,.45);root.getObjectByName('sketch-sling').add(muzzleNode);}
 const fx=new T.Group();fx.name='sketch-shot-fx';fx.userData.visualEffect=true;fx.userData.kind=kind;root.add(fx);
 const glow=new T.MeshBasicMaterial({color:kind==='bow'?0x9cffe7:0xffd37c,transparent:true,opacity:kind==='bow'?.45:.65,depthWrite:false,blending:T.AdditiveBlending}),smoke=new T.MeshBasicMaterial({color:0xc7c3aa,transparent:true,opacity:.27,depthWrite:false});ownedMaterials.push(glow,smoke);
 const flash=mesh(new T.ConeGeometry(kind==='bow'?.12:.35,kind==='bow'?.85:1.3,6),glow,0,0,.65,fx);flash.name='sketch-flash';flash.rotation.x=Math.PI/2;
 const wave=mesh(new T.TorusGeometry(kind==='bow'?.18:.35,.035,4,16),glow,0,0,.15,fx);wave.name='sketch-shot-wave';
 for(let i=0;i<4;i++){const puff=mesh(new T.IcosahedronGeometry(kind==='bow'?.09:.28,0),kind==='bow'?glow:smoke,0,0,0,fx);puff.name='sketch-smoke-'+i;}
 const animator=createArmoryAnimator(root);let cycle=-1;
 return {root,height,solids,muzzleNode,ownedMaterials,update(time,{yaw=0,pitch=.15,firing=false}={}){
  if(fireRig){fireRig.swivel.rotation.y=yaw;fireRig.barrel.rotation.x=-pitch;}
  if(kind==='bow'){mechanism.rotation.y=yaw;mechanism.rotation.x=-pitch;}
  const next=Math.floor(time/1.4);if(firing){if(next!==cycle){animator.markShot(time-time%1.4);cycle=next;}}else{cycle=-1;animator.clearShot();}
  animator.update(time);
 },dispose(){const geo=new Set();root.traverse(o=>{if(o.geometry)geo.add(o.geometry);});for(const g of geo)g.dispose();for(const material of ownedMaterials)material.dispose();root.parent?.remove(root);}};
}

// Fixed-size effects and mechanism nodes; no per-shot scene objects or timers.
export function createArmoryAnimator(root){
 const find=name=>root.getObjectByName(name),barrel=find('sketch-barrel'),arm=find('sketch-arm'),weight=find('sketch-counterweight'),sling=find('sketch-sling'),rock=find('sketch-loaded-stone'),flag=find('sketch-pennant'),feed=find('sketch-feed'),crank=find('sketch-crank'),strings=[find('sketch-string-left'),find('sketch-string-right')],fx=find('sketch-shot-fx'),muzzle=find('sketch-muzzle'),flash=find('sketch-flash'),wave=find('sketch-shot-wave'),puffs=Array.from({length:4},(_,i)=>find('sketch-smoke-'+i));
 const point=new T.Vector3(),end=new T.Vector3(),direction=new T.Vector3(),up=new T.Vector3(0,1,0),q=new T.Quaternion(),parentQ=new T.Quaternion();const feedZ=feed?.position.z??0;let lastShot=-Infinity;
 if(fx)fx.visible=false;
 return {markShot(time){lastShot=time;if(fx&&muzzle?.parent){root.updateWorldMatrix(true,true);muzzle.getWorldPosition(point);fx.parent.worldToLocal(point);fx.position.copy(point);muzzle.getWorldQuaternion(q);fx.parent.getWorldQuaternion(parentQ);fx.quaternion.copy(parentQ.conjugate().multiply(q));}},clearShot(){lastShot=-Infinity;},update(time){
  const age=time-lastShot,pulse=age>=0&&age<1.2;
  if(barrel)barrel.position.z=age>=0?-.45*Math.max(0,1-age/.3):0;
  if(arm)arm.rotation.x=.45-(age>=0&&age<1.2?Math.sin(age/1.2*Math.PI)*1.35:0);
  if(weight)weight.rotation.x=-arm.rotation.x;
  if(sling)sling.rotation.x=-arm.rotation.x+(pulse?Math.sin(age*5)*Math.max(0,1-age/1.2)*.45:0);
  if(rock)rock.visible=!pulse||age<.2;
  if(flag){flag.rotation.z=Math.sin(time*1.9)*.075;flag.rotation.y=Math.sin(time*1.3)*.045;}
  const pull=pulse?Math.sin(Math.min(1,age/.8)*Math.PI)*.4:0;
  if(feed)feed.position.z=feedZ-pull;
  if(crank)crank.rotation.x=pulse?Math.min(1,age/.8)*Math.PI*2:0;
  strings.forEach((string,i)=>{if(!string)return;point.set(i?3.25:-3.25,0,.5);end.set(0,0,-1.3-pull);direction.subVectors(end,point);string.scale.y=direction.length()/string.userData.baseLength;string.position.copy(point).add(end).multiplyScalar(.5);string.quaternion.setFromUnitVectors(up,direction.normalize());});
  if(fx){fx.visible=pulse;if(pulse){flash.visible=fx.userData.kind!=='trebuchet'&&age<.3;flash.scale.setScalar(.5+age*3);wave.visible=age<.4;wave.scale.setScalar(.4+age*5);puffs.forEach((p,i)=>{p.position.set(Math.sin(i*2.4)*age*.6,age*(1.2+i*.2),age*(.7+i*.25));p.scale.setScalar((.6+age*1.8)*Math.max(0,1-age/1.2));});}}
 }};
}
