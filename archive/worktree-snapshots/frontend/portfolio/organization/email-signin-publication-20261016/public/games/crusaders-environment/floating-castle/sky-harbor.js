import {sketchDefense} from './sketch-defense.js';
import * as T from '../vendor/three.module.js';

// Authored interpretation of Alternate 1404's sail-and-cog flying vessels,
// charged naval batteries and smaller escorts. No imported book/game artwork.
export function skyHarbor(parent,mats,home){
 const root=new T.Group();root.name='Broken bridge skyport';root.userData.place=(home?'Dusk':'Dawn')+' skyport';root.position.z=43;parent.add(root);
 const solids=[],occluders=[],ships=[],turrets=[],cogs=[],smoke=[],wood=mats.bark,trim=mats.edge;
 const sail=mats.sail,metal=mats.dark,charge=new T.MeshBasicMaterial({color:home?0xc7a7ef:0x8ce3e8}),boxG=new T.BoxGeometry(1,1,1);
 function mesh(group,g,m,x,y,z,solid=false){const o=new T.Mesh(g,m);o.position.set(x,y,z);group.add(o);if(solid){o.userData.structure=true;o.userData.castleIndex=home;for(let p=group;p;p=p.parent)if(p.userData.place){o.userData.place=p.userData.place;break;}solids.push(o);}return o;}
 function box(group,x,y,z,w,h,d,m=wood,solid=false){const o=mesh(group,boxG,m,x,y,z,solid);o.scale.set(w,h,d);return o;}
 function beam(group,a,b,r,m=wood){const av=new T.Vector3(...a),bv=new T.Vector3(...b),o=mesh(group,new T.CylinderGeometry(r,r,av.distanceTo(bv),5),m,...av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return o;}
 function gear(group,x,y,z,r){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=Math.PI/2;group.add(g);mesh(g,new T.TorusGeometry(r,.28,4,16),trim,0,0,0);for(let i=0;i<12;i++){const a=i*Math.PI/6,o=box(g,Math.cos(a)*r,Math.sin(a)*r,0,.85,.7,.5,metal);o.rotation.z=a;}for(let j=0;j<4;j++){const b=box(g,0,0,0,r*1.85,.25,.3,trim);b.rotation.z=j*Math.PI/4;}cogs.push(g);return g;}
 // A connected stone approach, a timber span, then a visible six-metre break.
 box(root,47,.02,-8,22,1.3,13,mats.paving,true);box(root,67,.1,-8,18,1.45,11,wood,true);box(root,87,.1,-8,10,1.45,11,wood,true);
 for(const x of [44,54,62,70,88])for(const side of [-1,1]){box(root,x,-3.2,-8+side*5,.7,8,.8,wood);box(root,x,1.15,-8+side*5,1.1,.8,1.1,metal);beam(root,[x,-5,-8+side*5],[x+4,-.5,-8+side*5],.24);}
 for(let x=59;x<92;x+=1.2){if(x>76&&x<82)continue;box(root,x,.86,-8,.14,.12,10.8,trim);}
 for(const [x,z,angle] of [[76,-12,.15],[77,-9,-.25],[76,-5,.28],[82,-11,-.22],[83,-6,.16]]){const plank=box(root,x,.5,z,4,.35,1.05,wood);plank.rotation.y=angle;plank.rotation.z=angle*.7;}
 for(const x of [77.5,80,81.5]){const rubble=mesh(root,new T.IcosahedronGeometry(.75,0),mats.stone,x,-4-(x%3),-7-(x%2));rubble.scale.y=.6;}
 // Harbor crane, warehouse, cargo and short mooring posts.
 box(root,49,3.7,-17,10,6,7,mats.stone,true);const roof=mesh(root,new T.ConeGeometry(7.5,4,4),home?mats.roofB:mats.roof,49,8.3,-17);roof.rotation.y=Math.PI/4;roof.scale.z=.8;
 box(root,49,3,-13.45,3.4,4.4,.18,wood);for(const side of [-1,1])box(root,49+side*3.2,4.1,-13.35,1.4,1.8,.1,metal);
 beam(root,[57,1,-14],[57,15,-14],.5);beam(root,[57,14,-14],[74,11,-14],.45);beam(root,[57,7,-14],[68,12,-14],.25,trim);beam(root,[72,11.4,-14],[72,3.2,-14],.08,metal);mesh(root,new T.TorusGeometry(.7,.13,4,12),metal,72,2.6,-14);
 for(let i=0;i<7;i++){const x=42+i%3*3,z=-3+Math.floor(i/3)*2.5;box(root,x,1.65,z,2.2,2,2.1,wood);box(root,x,1.65,z+.02,.16,2.15,2.2,trim);}
 for(const x of [65,72,87])mesh(root,new T.CylinderGeometry(.4,.55,1.4,7),metal,x,1.4,-3);
 function cannon(group,x,y,z,scale=1,angle=0,castle=false){
  const rig=sketchDefense('cannon',mats),base=rig.root;base.position.set(x,y,z);base.scale.setScalar(scale);base.rotation.y=angle;group.add(base);base.userData.defense=rig.metadata;base.userData.sketchType='cannon';
  if(castle){const plinth=base.children.find(o=>o.isMesh);if(plinth){plinth.userData.structure=true;solids.push(plinth);}}
  const swivel=base.getObjectByName('sketch-swivel');turrets.push({base,swivel,phase:turrets.length*.8,castle});return base;
 }
 function vessel(x,y,z,length,width,mechanical,index){
  const ship=new T.Group();ship.position.set(x,y,z);ship.name=length>30?'Great skyship':'Courier sloop';ship.userData.place=(home?'Dusk':'Dawn')+' '+(length>30?(mechanical?'cogship':'galley'):'courier')+' deck';root.add(ship);
  const outline=[[0,.52],[.32,.41],[.5,.18],[.48,-.3],[.3,-.48],[-.3,-.48],[-.48,-.3],[-.5,.18],[-.32,.41]],vertices=[],indices=[],n=outline.length;
  for(const [height,factor] of [[-3.7,.32],[-1.5,.75],[2.4,1],[3.2,1.03]])for(const [px,pz] of outline)vertices.push(px*width*factor,height,pz*length*(.78+.22*factor));
  for(let k=0;k<3;k++)for(let j=0;j<n;j++){const a=k*n+j,b=k*n+(j+1)%n,c=(k+1)*n+(j+1)%n,d=(k+1)*n+j;indices.push(a,b,c,a,c,d);}
  // Outward winding and closed caps make the visible keel a real flight obstacle.
  const bottom=vertices.length/3;vertices.push(0,-3.7,0);const top=vertices.length/3;vertices.push(0,3.2,0);
  for(let j=0;j<n;j++){const next=(j+1)%n;indices.push(bottom,next,j,top,3*n+j,3*n+next);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();mesh(ship,g,wood,0,0,0,true);
  const shape=new T.Shape();outline.forEach(([px,pz],i)=>i?shape.lineTo(px*width,pz*length):shape.moveTo(px*width,pz*length));shape.closePath();const deck=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false});deck.rotateX(Math.PI/2);mesh(ship,deck,wood,0,3.19,0,true);
  for(let i=0;i<n;i++){const a=outline[i],b=outline[(i+1)%n];for(const level of [1.9,4.1])beam(ship,[a[0]*width,level,a[1]*length],[b[0]*width,level,b[1]*length],level>3?.12:.24,trim);beam(ship,[a[0]*width,3.1,a[1]*length],[a[0]*width,4.2,a[1]*length],.14,metal);}
  for(let j=0;j<Math.floor(length/3);j++)box(ship,0,3.22,-length*.38+j*2.3,width*.82,.07,.08,wood);
  box(ship,0,5,-length*.29,width*.69,3.8,length*.2,wood,true);box(ship,0,7,-length*.29,width*.83,.4,length*.23,home?mats.roofB:mats.roof);
  for(const side of [-1,1])for(let j=0;j<3;j++)box(ship,side*width*.351,5.2,-length*.35+j*1.5,.08,1.2,.75,charge);
  const masts=length>30?[-.2,.08,.3]:[0];
  for(const [j,t] of masts.entries()){
   const height=(length>30?22:13)-(j===2?5:0),mz=t*length,trimAngle=.7;beam(ship,[0,3.2,mz],[0,height,mz],.23,wood);beam(ship,[-width*.68*Math.cos(trimAngle),height-2,mz+width*.68*Math.sin(trimAngle)],[width*.68*Math.cos(trimAngle),height-2,mz-width*.68*Math.sin(trimAngle)],.16,wood);
   const geo=new T.PlaneGeometry(width*1.3,height*.46,5,3),pos=geo.attributes.position;
   for(let k=0;k<pos.count;k++){const px=pos.getX(k),py=pos.getY(k);pos.setZ(k,Math.sin((px/(width*1.3)+.5)*Math.PI)*1.3+Math.cos(py*.2)*.4);}geo.computeVertexNormals();const canvas=mesh(ship,geo,sail,0,height-2-height*.23,mz+.3);canvas.rotation.y=trimAngle;occluders.push(canvas);
   box(ship,0,height-2-height*.23,mz+1.8,.36,height*.4,.08,home?mats.roofB:mats.roof);beam(ship,[-width*.45,3.6,mz-4],[0,height-1,mz],.045,metal);beam(ship,[width*.45,3.6,mz-4],[0,height-1,mz],.045,metal);
   const pennant=new T.Shape();pennant.moveTo(0,0);pennant.lineTo(3,-.4);pennant.lineTo(0,-1.2);mesh(ship,new T.ShapeGeometry(pennant),home?mats.roofB:mats.roof,0,height,mz);
  }
  if(length>30&&!mechanical){for(const side of [-1,1])for(let j=0;j<24;j++){const mz=-length*.33+j*length*.027;beam(ship,[side*width*.4,1,mz],[side*(width*.5+5),-.6,mz+2],.09,wood);const blade=box(ship,side*(width*.5+5),-.6,mz+2,.9,.14,2.3,trim);blade.rotation.y=side*.2;}}
  if(mechanical){for(const side of [-1,1]){for(const t of [-.21,.18])gear(ship,side*width*.5,0,t*length,length>30?2.3:1.3);for(const mz of [-length*.2,length*.15]){mesh(ship,new T.CylinderGeometry(.8,1,3,7),metal,side*width*.3,-4,mz);mesh(ship,new T.IcosahedronGeometry(.8,0),charge,side*width*.3,-5.5,mz);}}}
  else{for(const mz of [-length*.2,length*.2]){mesh(ship,new T.IcosahedronGeometry(1.2,1),charge,0,-4,mz);mesh(ship,new T.TorusGeometry(1.6,.12,4,16),trim,0,-4,mz).rotation.x=Math.PI/2;}}
  for(const side of [-1,1])cannon(ship,side*width*.33,3.5,length*.19,.45,side*Math.PI/2);
  if(mechanical)for(let j=0;j<6;j++){const puff=mesh(root,new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({color:0x8997a2,transparent:true,opacity:.24,depthWrite:false}),x,y-6,z);smoke.push({puff,x,y:y-6,z,phase:j/6,index});}
  ships.push({root:ship,x,y,z,index});return ship;
 }
 vessel(108,1.8,-19,44,13,home===1,0);vessel(78,2.8,23,23,7,true,1);
 cannon(parent,-12,.7,53,1.25,0,true);cannon(parent,41,.7,50,1.25,0,true);
 function update(time){
  for(const ship of ships){if(ship.root.userData.fleetControlled)continue;ship.root.position.y=ship.y+Math.sin(time*.65+ship.index*2)*.23;ship.root.rotation.z=Math.sin(time*.4+ship.index)*.015;}
  for(const g of cogs)g.rotation.z=time*.35;
  for(const gun of turrets)if(!gun.swivel.userData.controlled)gun.swivel.rotation.y=Math.sin(time*.32+gun.phase)*.16;
  for(const s of smoke){const t=(time*.13+s.phase)%1;s.puff.position.set(s.x+Math.sin(t*5+s.index)*1.3,s.y-t*10,s.z+t*3);s.puff.scale.setScalar(.7+t*2.2);s.puff.material.opacity=(1-t)*.2;}
  root.updateMatrixWorld(true);
 }
 update(0);return {root,solids,occluders,ships,turrets,cogs,smoke,update};
}
