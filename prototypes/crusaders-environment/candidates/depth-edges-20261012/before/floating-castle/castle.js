import * as T from '../vendor/three.module.js';
import {facadeDetail} from './facade-detail.js';
export function buildCastle(materials){
const {stone,edge,dark,soil,paving,roof,leaves,bark}=materials;
const castle=new T.Group(),detail=new T.Group(),routeGroup=new T.Group(),solids=[];
castle.add(detail,routeGroup);routeGroup.visible=false;
const routeMat=new T.MeshBasicMaterial({color:0x87efff});
const boxG=new T.BoxGeometry(1,1,1),dummy=new T.Object3D(),batches=new Map();
function mesh(g,m,x=0,y=0,z=0,parent=castle){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);if(parent===castle)solids.push(o);return o;}
function box(x,y,z,w,h,d,m=stone,parent=castle){const o=mesh(boxG,m,x,y,z,parent);o.scale.set(w,h,d);return o;}
function block(x,y,z,w,h,d,m=edge,ry=0){let a=batches.get(m);if(!a)batches.set(m,a=[]);a.push({x,y,z,w,h,d,ry});}
function polygon(points,depth,y,m=soil){const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});g.rotateX(Math.PI/2);return mesh(g,m,0,y,0);}
// Authored irregular outline, with offset ledges rather than a symmetric castle base.
const outline=[[-23,21],[-25,10],[-22,-3],[-20,-13],[-12,-31],[4,-35],[18,-29],[22,-13],[19,2],[21,18],[22,29],[6,30],[-4,26],[-14,25]];
polygon(outline,4,0);polygon(outline.map(([x,z])=>[x*.96,z*.96]),.35,.3,paving);
const tiers=[{x:-7,z:12,w:28,d:17,y:4},{x:6,z:-7,w:31,d:22,y:10},{x:0,z:-25,w:27,d:15,y:16}];
// Grow defensive walls outward, preserving the existing inside edges and routes.
tiers.forEach((t,k)=>{const pts=[[-.5,-.5],[.28,-.5],[.5,-.38],[.5,.5],[-.5,.5],[-.53,.18]].map(([x,z])=>[t.x+x*t.w,t.z+z*t.d]);polygon(pts,t.y-.6,t.y-.6,soil);polygon(pts,.6,t.y,paving);const z=t.z+t.d/2;if(k===2){const rim=box(t.x,t.y+.12,z+.2,t.w,.24,.9,edge);rim.userData.wallDepth=.9;rim.userData.wallRole='summit rim';return;}const wall=box(t.x,t.y-1.8,z+.275,t.w,3.1,1.2,stone);wall.userData.wallDepth=1.2;wall.userData.wallRole='terrace wall';box(t.x,t.y-.2,z+.35,t.w+.8,.32,1.45,edge);box(t.x,t.y-3.35,z+.37,t.w+.5,.25,1.4,dark);for(let y=Math.max(.4,t.y-3.1);y<t.y-.4;y+=.55){block(t.x,y,z+.93,t.w,.045,.035,dark);for(let x=t.x-t.w/2+.3+(Math.round(y/.55)%2)*.6;x<t.x+t.w/2;x+=1.4)block(x,y+.25,z+.93,.04,.46,.035,dark);}for(let x=t.x-t.w/2+.5;x<t.x+t.w/2;x+=2.2){block(x,t.y+.45,z+.275,.65,.9,1.25);block(x,t.y+.05,z+.275,2.1,.18,1.25);}});
function arch(x,y,z,width,height,depth,m=stone,parent=castle){const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(width/2,height);s.lineTo(-width/2,height);s.closePath();const hole=new T.Path(),rad=width*.32,spring=height*.48;hole.moveTo(-rad,0);hole.lineTo(-rad,spring);hole.absarc(0,spring,rad,Math.PI,0,true);hole.lineTo(rad,0);hole.closePath();s.holes.push(hole);return mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:16}),m,x,y,z,parent);}
// Entrance frame is a genuine opening; split timber leaves indicate the drawn double door.
const gateArch=arch(10,.35,29,5.8,5,1.45);gateArch.userData.wallDepth=1.45;gateArch.userData.wallRole='entrance gate';for(const side of [-1,1]){const door=mesh(new T.BoxGeometry(1.4,2.8,.15),bark,10+side*1.5,1.75,29.6);door.rotation.y=side*.65;for(let y=.8;y<3;y+=.65)box(0,y-1.75,.11,1.3,.09,.05,dark,door);mesh(new T.TorusGeometry(.16,.045,6,16),dark,-side*.45,-.05,.15,door);}
for(const [x,width] of [[1.5,11],[17,8]]){const wall=box(x,1.5,29.3,width,3,1.3);wall.userData.wallDepth=1.3;wall.userData.wallRole='entrance wall';}for(let x=-4;x<21;x+=2)block(x,3.2,29.3,1.3,.45,1.5);
function tower(x,z,h,radius=1.1,spire=true){mesh(new T.CylinderGeometry(radius*.9,radius,h,12),stone,x,h/2,z);mesh(new T.CylinderGeometry(radius*1.12,radius*1.12,.35,12),edge,x,h-.2,z);if(spire){const pts=[[0,0],[radius*1.5,0],[radius,1.3],[radius*.55,2.9],[0,4.3]].map(([a,b])=>new T.Vector2(a,b));mesh(new T.LatheGeometry(pts,20),roof,x,h,z);}for(let y=1;y<h;y+=1.2)mesh(new T.TorusGeometry(radius*.96,.045,4,12),dark,x,y,z,detail).rotation.x=Math.PI/2;}
tower(20,27,16,1.05);tower(-19,9,12,1.25);tower(-12,-22,22,.9,false);tower(16,-27,25,1.8,false);mesh(new T.SphereGeometry(1.85,16,8,0,Math.PI*2,0,Math.PI/2),roof,16,25,-27);
// Tall narrow summit structures and pointed rear portal follow the upper silhouette.
for(const x of [-6,-2,3]){box(x,19,-29,.6,6,.7,stone);mesh(new T.ConeGeometry(.8,3,5),roof,x,23.5,-29);}
const shrine=new T.Shape();shrine.moveTo(-3,0);shrine.lineTo(3,0);shrine.lineTo(2.1,4);shrine.lineTo(0,6);shrine.lineTo(-2.1,4);shrine.closePath();const sh=new T.Path();sh.moveTo(-1,0);sh.lineTo(-1,2.8);sh.lineTo(0,4.4);sh.lineTo(1,2.8);sh.lineTo(1,0);sh.closePath();shrine.holes.push(sh);mesh(new T.ExtrudeGeometry(shrine,{depth:.75,bevelEnabled:false}),edge,7,16,-31);
// Route is defined once for rendered ramps, visible steps and corridor collision.
const angularRoute=[[10,.35,34],[10,.35,25],[10,4,17],[-15,4,17],[-15,4,5],[-15,10,-1],[14,10,-1],[14,10,-13],[16,16,-22],[8,16,-22],[0,16,-25]];
const route=[];angularRoute.forEach((p,i)=>{const a=angularRoute[i-1],b=angularRoute[i+1];if(!a||!b||a[1]!==p[1]||b[1]!==p[1]){route.push(p);return;}const l=Math.hypot(a[0]-p[0],a[2]-p[2]),n=Math.hypot(b[0]-p[0],b[2]-p[2]),rad=Math.min(2,l/3,n/3),start=[p[0]+(a[0]-p[0])*rad/l,p[1],p[2]+(a[2]-p[2])*rad/l],end=[p[0]+(b[0]-p[0])*rad/n,p[1],p[2]+(b[2]-p[2])*rad/n];for(let j=0;j<=8;j++){const t=j/8;route.push([start[0]*(1-t)**2+2*p[0]*t*(1-t)+end[0]*t*t,p[1],start[2]*(1-t)**2+2*p[2]*t*(1-t)+end[2]*t*t]);}});const segments=route.slice(1).map((b,i)=>({a:route[i],b,width:i===0?4:2.8}));
function beam(a,b,width,thickness,m,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b),len=av.distanceTo(bv),o=mesh(new T.BoxGeometry(width,thickness,len),m,...av.clone().add(bv).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),bv.sub(av).normalize());return o;}
// Keep the horizontal deck out of the rising ramp's approach. A short landing
// continues forward from the crest; a small seam overlap supports either turn.
function walkway(s,i){
 const a=s.a,b=s.b,prev=segments[i-1],start=a.slice();
 if(prev&&a[1]===b[1]&&prev.b[1]>prev.a[1]){
  const length=Math.hypot(b[0]-a[0],b[2]-a[2]),inset=Math.min(prev.width/2-.03,length/2);
  start[0]+=(b[0]-a[0])*inset/length;start[2]+=(b[2]-a[2])*inset/length;
  const dx=a[0]-prev.a[0],dz=a[2]-prev.a[2],run=Math.hypot(dx,dz);
  beam([a[0]-dx/run*.04,a[1]-.12,a[2]-dz/run*.04],[a[0]+dx/run*s.width/2,a[1]-.12,a[2]+dz/run*s.width/2],prev.width,.25,paving,castle);
 }
 beam([start[0],start[1]-.12,start[2]],[b[0],b[1]-.12,b[2]],s.width,.25,paving,castle);
}
segments.forEach((s,i)=>{const a=s.a,b=s.b;walkway(s,i);beam([a[0],a[1]+.045,a[2]],[b[0],b[1]+.045,b[2]],s.width*.78,.025,routeMat,routeGroup);if(b[1]>a[1]){const len=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.ceil((b[1]-a[1])/.25);for(let j=0;j<n;j++){const t=(j+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t,y=a[1]+(b[1]-a[1])*t;const o=box(x,y-.15,z,s.width,.2,len/n,paving,detail);o.rotation.y=Math.atan2(b[0]-a[0],b[2]-a[2]);}if(Math.abs(a[0]-10)<.1||Math.abs(a[0]+15)<.1){const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];const bridge=arch(mid[0],mid[1]-4.5,mid[2]-.7,4,2.6,1.4);bridge.rotation.y=Math.PI/2;for(const side of [-1,1])beam([a[0]+side*1.8,a[1]+.5,a[2]],[b[0]+side*1.8,b[1]+.5,b[2]],.25,.8,stone,detail);}}});
function tree(x,y,z,size=1,parent=castle){mesh(new T.CylinderGeometry(.15*size,.28*size,2*size,7),bark,x,y+size,z,parent);for(const [dx,dy,dz] of [[0,2.7,0],[-.7,2.1,0],[.6,2.2,.3]])mesh(new T.IcosahedronGeometry(size,1),leaves,x+dx*size,y+dy*size,z+dz*size,parent);}
tree(-10,4,10,1.1);tree(11,10,-8,1);tree(-18,.35,19,.9);tree(17,16,-21,.8);
// Jagged escarpment ribs and thin stratification follow the nonuniform perimeter.
outline.forEach(([x,z],i)=>{const [nx,nz]=outline[(i+1)%outline.length],len=Math.hypot(nx-x,nz-z),angle=Math.atan2(nx-x,nz-z);for(const y of [-.6,-1.5,-2.7])block((x+nx)/2,y,(z+nz)/2,.11,.12,len,dark,angle);mesh(new T.ConeGeometry(1.1,4+i%3,5),soil,x*.94,-3,z*.94,detail).rotation.z=Math.PI;});
// Shallow buttresses, cap stones and planted courts add detail without new routes.
for(const t of tiers.slice(0,2))for(let x=t.x-t.w/2+1;x<t.x+t.w/2;x+=5){block(x,t.y-1.7,t.z+t.d/2+1.02,.9,3,.8,stone);block(x,t.y-.08,t.z+t.d/2+1.05,1.15,.22,1.1,edge);}
for(const [x,y,z] of [[-5,4,10],[5,10,-8],[-3,16,-28]]){box(x,y+.12,z,3.2,.22,2,soil,detail);for(const side of [-1,1])box(x+side*1.65,y+.3,z,.18,.6,2.3,edge,detail);for(const side of [-1,1])box(x,y+.3,z+side*1.1,3.4,.6,.18,edge,detail);for(let i=0;i<12;i++){const px=x+Math.sin(i*2.4)*1.25,pz=z+Math.cos(i*1.9)*.7;mesh(new T.IcosahedronGeometry(.24+(i%3)*.08,0),leaves,px,y+.55,pz,detail);}}
for(let i=0;i<=12;i++){const a=i*Math.PI/12,o=box(10+Math.cos(a)*2.05,2.75+Math.sin(a)*2.05,30.53,.42,.34,.24,edge,detail);o.rotation.z=a;}
for(const [m,a] of batches){const batch=new T.InstancedMesh(boxG,m,a.length);a.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.ry,0);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.castShadow=true;batch.receiveShadow=true;detail.add(batch);}
const facade=facadeDetail(detail,{stone,edge,roof,dark});facade.group.position.z=.55;

castle.scale.setScalar(2.2);return {castle,solids,route:route.map(p=>p.map(v=>v*2.2))};
}
