import * as THREE from '../vendor/three.module.js';

// Surface ornament stays on existing solid walls/roofs or outside island edges.
// No decorative staircase, doorway, or invisible collision is added here.
export function addEnvironmentDetail(group,mats,castle,dark=false){
 const batches=new Map(),cube=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 const add=(mat,x,y,z,w,h,l,rz=0,ry=0)=>{let a=batches.get(mat);if(!a)batches.set(mat,a=[]);a.push({x,y,z,w,h,l,rz,ry});};
 const w=castle?68:80,l=castle?66:64,cz=castle?-3:0;
 // Layered exposed strata and narrow mineral seams on all floating foundations.
 for(let layer=0;layer<5;layer++)for(let i=0;i<8;i++){
  const y=-2-layer*1.45,radius=w*.58*(y+36.5)/35+.035;
  const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
  const ax=Math.sin(a)*radius,az=cz+Math.cos(a)*radius*l/w;
  const bx=Math.sin(b)*radius,bz=cz+Math.cos(b)*radius*l/w;
  add(layer%2?mats.edge:mats.ground,(ax+bx)/2,y,(az+bz)/2,.075,.16,Math.hypot(bx-ax,bz-az),0,Math.atan2(bx-ax,bz-az));
 }
 for(let i=0;i<20;i++){
  const x=-w/2+(i+.5)*w/20;
  // Hanging growth outside the north cliff, clear of traversable surfaces.
  if(i%3!==1)for(let leaf=0;leaf<4;leaf++)add(mats.ground,x+Math.sin(i+leaf)*.25,-1.2-leaf*.65,cz-l/2-.28,.32,.8,.15,(i%2?1:-1)*.15);
 }
 if(castle){
  // Shallow paving joints rest on existing courts, never form a new route.
  for(let z=-11;z<=9;z+=2)add(mats.edge,0,4.025,z,39,.006,.055);
  for(let x=-19;x<=19;x+=2)add(mats.edge,x,4.025,-1,.055,.006,21);
  for(let x=-30;x<=30;x+=3)add(mats.edge,x,.025,21,.055,.006,15);
  for(let z=14;z<=28;z+=3)add(mats.edge,0,.025,z,61,.006,.055);
  for(const side of [-1,1])for(let z=-26;z<=7;z+=2)add(mats.edge,side*27,10.025,z,9,.006,.055);
  // Keep masonry courses, alternating joints and corner pilasters.
  for(let course=0;course<18;course++){
   const y=10.4+course*.7;
   add(mats.edge,0,y,-17.94,12.9,.045,.09);
   for(let x=-5.8+(course%2)*.65;x<6.2;x+=1.3)add(mats.edge,x,y+.33,-17.93,.045,.63,.1);
  }
  for(const x of [-6.4,6.4])for(let y=10.3;y<23;y+=.8)add(mats.stone,x,y,-17.84,.38,.65,.28);
  // Recessed windows with sill, lintel and small segmented arch frames.
  for(const x of [-4,0,4])for(const y of [13,17,21]){
   add(mats.roof,x,y,-17.82,1,1.8,.12);
   add(mats.edge,x,y-.96,-17.68,1.55,.2,.44);
   for(const side of [-1,1])add(mats.stone,x+side*.61,y,-17.68,.18,1.9,.27);
   for(let i=0;i<7;i++){const a=i*Math.PI/6;add(mats.stone,x+Math.cos(a)*.62,y+.84+Math.sin(a)*.52,-17.69,.24,.24,.24,a);}
   add(mats.accent,x,y,-17.73,.06,1.7,.08);add(mats.edge,x,y-.1,-17.73,.94,.06,.08);
  }
  // Side and rear elevations carry the same masonry and inset windows.
  for(const side of [-1,1]){
   for(let course=0;course<18;course++){
    const y=10.4+course*.7;
    add(mats.stone,side*6.54,y,-23,.08,.045,9.8);
    for(let z=-27.5+(course%2)*.65;z<-18.3;z+=1.3)add(mats.stone,side*6.55,y+.33,z,.08,.63,.045);
   }
   for(const z of [-26,-23,-20])for(const y of [13,17,21]){
    add(mats.roof,side*6.57,y,z,.12,1.8,1);
    add(mats.stone,side*6.65,y-.96,z,.28,.2,1.5);
    add(mats.stone,side*6.65,y+.96,z,.28,.2,1.5);
    for(const edge of [-1,1])add(mats.stone,side*6.65,y,z+edge*.61,.27,1.9,.18);
    add(mats.accent,side*6.67,y,z,.06,1.7,.06);
   }
  }
  for(let y=10.4;y<23;y+=.7)add(mats.stone,0,y,-28.04,12.9,.045,.08);
  // Roof ridges and chimneys stay on the inaccessible keep roof.
  for(const x of [-5,5]){add(mats.edge,x,27.3,-23,.7,4,.8);add(mats.roof,x,29.4,-23,1,.3,1.1);}
  for(let i=0;i<11;i++)add(mats.roof,0,30.95-Math.abs(i-5)*8/(11/Math.SQRT2*.85),-28+i,.25,.24,.88);
  // Gallery corbels and tower masonry emphasise the height of the open routes.
  for(const side of [-1,1])for(let z=-26;z<=7;z+=3){add(mats.edge,side*31.75,9.5,z,.9,.6,1.1);add(mats.stone,side*31.4,9.1,z,.45,.55,.8);}
  for(const x of [-27,27])for(let y=2;y<16;y+=1.15){add(mats.edge,x,y,-29.74,9,.09,.08);for(let j=0;j<6;j++)add(mats.edge,x-4+j*1.5+(Math.round(y)%2)*.35,y+.5,-29.73,.065,.9,.09);}
  // Split heraldic colours use the established Dawn/Dusk material palette.
  for(const side of [-1,1]){add(mats.roof,side*5,18,-17.54,.8,2.3,.1);add(mats.accent,side*5,18,-17.46,.12,1.8,.06);}
 }else{
  // Field mineral patches and inset service strips retain the continuous floor.
  for(let z=12;z<=27;z+=3)add(mats.edge,0,.025,z,17,.006,.06);
  for(const side of [-1,1])for(let i=0;i<7;i++)add(mats.edge,side*(11+i*2.5),.025,10,1.6,.006,2.4);
  for(const [x,z]of [[-24,-17],[24,-17],[-24,10],[24,10]]){
   for(let y=.7;y<8;y+=1.4)for(let side=0;side<4;side++){
    const a=side*Math.PI/2;add(mats.edge,x+Math.sin(a)*3.25,y,z+Math.cos(a)*3.25,side%2?.1:2.3,.16,side%2?2.3:.1);
   }
   for(let y=1;y<7;y+=1.2)add(mats.accent,x,y,z+3.33,.6,.45,.08);
  }
 }
 const result=[];
 for(const[mat,records]of batches){const m=new THREE.InstancedMesh(cube,mat,records.length);for(const[r,i]of records.map((r,i)=>[r,i])){dummy.position.set(r.x,r.y,r.z);dummy.rotation.set(0,r.ry,r.rz);dummy.scale.set(r.w,r.h,r.l);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.instanceMatrix.needsUpdate=true;group.add(m);result.push(m);}
 return result;
}
