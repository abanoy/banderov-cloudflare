import * as T from '../vendor/three.module.js';
// Visual-only floating-island rock: jittered lathe body with strata vertex colours
// (stone lip -> soil -> dark tip), hanging stalactite sub-cones and an optional top cap.
// Geometry is non-indexed with per-face colours (PS1-style flat strata). Never a collider.
// SA1-style earth (2026-10-18): sunlit sand lip, ochre band, warm terracotta soil, then mauve and deep violet toward the
// tip, so every hanging rock reads as a warm-to-cool vertex-colour gradient (was lip #d8caa6 band #b7a789 soil #8b7f8c
// deep #6b5f78 tip #4a3f55 moss #86a36f).
export const ROCK_PALETTE={lip:'#e2cc9c',band:'#c79f74',soil:'#a27a66',deep:'#785a72',tip:'#4a3a5c',cap:'#6f6676',moss:'#7cae5e'};
export function rng(seed=1){let s=(Math.floor(seed*2654435761)^0x9e3779b9)>>>0;return ()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const linear=hex=>new T.Color(hex).convertSRGBToLinear();
function strata(palette){const p={...ROCK_PALETTE,...palette};return {lip:linear(p.lip),band:linear(p.band),soil:linear(p.soil),deep:linear(p.deep),tip:linear(p.tip),cap:linear(p.cap),moss:linear(p.moss)};}
function bandColor(c,t,k){return t<.1?c.lip:t<.16?c.band:t<.34?c.soil:(t<.38&&k%2)?c.band:t<.62?c.deep:c.tip;}
// Accumulates flat triangles; one geometry per call keeps dressing to a single draw.
export function rockBuilder(){
 const pos=[],col=[],tmp=new T.Color();
 function tri(a,b,c,color,shade=1){pos.push(...a,...b,...c);tmp.copy(color).multiplyScalar(shade);for(let i=0;i<3;i++)col.push(tmp.r,tmp.g,tmp.b);}
 function quad(a,b,c,d,color,shade){tri(a,b,c,color,shade);tri(a,c,d,color,shade);}
 function geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
 return {tri,quad,geometry,get count(){return pos.length/9;}};
}
// Adds one lathe rock to builder b. Centre (x,y,z) is the top lip centre; rx/rz allow oval tops.
export function addRock(b,{x=0,y=0,z=0,rx=10,rz=rx,depth=20,seed=1,sides=12,rings=7,jitter=.16,stalactites=4,cap=true,dome=0,palette,lip=1.04,taper=.78}={}){
 const random=rng(seed),c=strata(palette),grid=[],twist=random()*Math.PI*2;
 for(let k=0;k<=rings;k++){
  const t=k/rings,row=[];
  if(k===rings){const tipX=(random()-.5)*rx*.18,tipZ=(random()-.5)*rz*.18;row.push([x+tipX,y-depth*(1+(random()-.5)*.12),z+tipZ]);grid.push(row);break;}
  const shape=k===0?1:k===1?lip:Math.pow(1-t,taper)*(1-.08*t),drop=k===0?0:k===1?depth*.035:depth*Math.pow(t,1.12);
  for(let i=0;i<sides;i++){const a=twist+i/sides*Math.PI*2+(k>1?(random()-.5)*.22:0),n=k===0?1:k===1?1+(random()-.5)*.04:1+(random()-.5)*2*jitter;row.push([x+Math.cos(a)*rx*shape*n,y-drop+(k>1?(random()-.5)*depth*.05:0),z+Math.sin(a)*rz*shape*n]);}
  grid.push(row);
 }
 for(let k=0;k<rings;k++){const t=(k+.5)/rings,a=grid[k],bRow=grid[k+1];for(let i=0;i<sides;i++){const j=(i+1)%sides,shade=.92+random()*.14,color=bandColor(c,t,k);if(bRow.length===1)b.tri(a[i],a[j],bRow[0],color,shade);else b.quad(a[i],a[j],bRow[j],bRow[i],color,shade);}}
 if(dome>0){const top=grid[0],mid=top.map(p=>[x+(p[0]-x)*.62,y+dome*(.55+random()*.25),z+(p[2]-z)*.62]),peak=[x+(random()-.5)*rx*.2,y+dome,z+(random()-.5)*rz*.2];for(let i=0;i<sides;i++){const j=(i+1)%sides,shade=.92+random()*.14;b.quad(top[i],mid[i],mid[j],top[j],c.lip,shade);b.tri(mid[i],peak,mid[j],c.moss,shade);}}
 else if(cap){const top=grid[0],centre=[x,y,z];for(let i=0;i<sides;i++)b.tri(centre,top[(i+1)%sides],top[i],c.cap,.9);}
 // Stalactites hang from the lower half of the body, pointing straight down.
 for(let s=0;s<stalactites;s++){const t=.3+random()*.4,k=Math.min(rings-1,Math.floor(t*rings)),i=Math.floor(random()*sides),p=grid[k][i],q=grid[k+1].length>1?grid[k+1][i]:grid[k+1][0],m=[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2],inward=.82,cx=x+(m[0]-x)*inward,cz=z+(m[2]-z)*inward,base=Math.max(rx,rz)*(.07+random()*.07),len=depth*(.22+random()*.3),cy=m[1]+base*.4;
  cone(b,cx,cy,cz,base,len,5,random()*6,c,random);}
 return b;
}
export function cone(b,x,y,z,base,len,sides,turn,c,random=Math.random){const ring=[];for(let i=0;i<sides;i++){const a=turn+i/sides*Math.PI*2;ring.push([x+Math.cos(a)*base*(.85+random()*.3),y,z+Math.sin(a)*base*(.85+random()*.3)]);}const mid=ring.map(p=>[x+(p[0]-x)*.55,y-len*.45,z+(p[2]-z)*.55]),tip=[x+(random()-.5)*base*.3,y-len,z+(random()-.5)*base*.3];
 for(let i=0;i<sides;i++){const j=(i+1)%sides,shade=.9+random()*.15;b.quad(ring[i],ring[j],mid[j],mid[i],c.deep,shade);b.tri(mid[i],mid[j],tip,c.tip,shade);}}
export function skyRock(options={}){const b=rockBuilder();addRock(b,options);return b.geometry();}
// Hanging keel under a flat annulus (the ring battleground). One chunk per angular range so
// each chunk keeps its own bounding volume (culling, and position-based passes stay local).
export function ringKeel({inner=47.5,outer=107.5,y=-19.6,depth=26,from=0,to=Math.PI/2,segments=24,radial=6,seed=3,stalactites=10,palette}={}){
 const b=rockBuilder(),random=rng(seed),c=strata(palette),grid=[];
 for(let i=0;i<=segments;i++){const a=from+(to-from)*i/segments,row=[],wobble=.75+.25*Math.sin(a*5+seed)+.12*Math.sin(a*13);for(let k=0;k<=radial;k++){const s=k/radial,r=inner+(outer-inner)*s,edge=k===0||k===radial,d=edge?0:depth*Math.pow(Math.sin(s*Math.PI),.7)*wobble*(.82+random()*.36);row.push([Math.cos(a)*r,y-d,Math.sin(a)*r,d/depth]);}grid.push(row);}
 for(let i=0;i<segments;i++)for(let k=0;k<radial;k++){const p=grid[i][k],q=grid[i+1][k],r=grid[i+1][k+1],s=grid[i][k+1],t=(p[3]+q[3]+r[3]+s[3])/4,color=bandColor(c,t*.95,k+i),shade=.9+random()*.16;b.quad(p.slice(0,3),s.slice(0,3),r.slice(0,3),q.slice(0,3),color,shade);}
 for(let n=0;n<stalactites;n++){const i=Math.floor(random()*segments),k=1+Math.floor(random()*(radial-1)),p=grid[i][k];if(p[3]<.35)continue;cone(b,p[0],p[1]+1,p[2],1.6+random()*2.2,6+random()*12,5,random()*6,c,random);}
 return b.geometry();
}
// Merges [{geometry,matrix}] into one non-indexed geometry (position, normal, optional colour)
// relative to `origin`, so repeated dressing costs one draw per material.
export function mergeParts(parts,origin=new T.Vector3(),{colors=false}={}){
 let count=0;const flat=parts.map(p=>{const g=p.geometry.index?p.geometry.toNonIndexed():p.geometry;count+=g.attributes.position.count;return {g,matrix:p.matrix,owned:g!==p.geometry,color:p.color};});
 const position=new Float32Array(count*3),normal=new Float32Array(count*3),color=colors?new Float32Array(count*3):null,v=new T.Vector3(),n=new T.Matrix3();let o=0;
 for(const {g,matrix,owned,color:tint} of flat){n.getNormalMatrix(matrix);const P=g.attributes.position,N=g.attributes.normal,C=g.attributes.color;
  for(let i=0;i<P.count;i++,o++){v.fromBufferAttribute(P,i).applyMatrix4(matrix).sub(origin);position.set([v.x,v.y,v.z],o*3);if(N){v.fromBufferAttribute(N,i).applyMatrix3(n).normalize();normal.set([v.x,v.y,v.z],o*3);}if(color){if(C)color.set([C.getX(i),C.getY(i),C.getZ(i)],o*3);else if(tint)color.set([tint.r,tint.g,tint.b],o*3);else color.set([1,1,1],o*3);}}
  if(owned)g.dispose();}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(position,3));out.setAttribute('normal',new T.BufferAttribute(normal,3));if(color)out.setAttribute('color',new T.BufferAttribute(color,3));out.computeBoundingBox();out.computeBoundingSphere();return out;
}
// Moss overhang ring and dangling roots around an island lip (centre x,y,z, radii rx/rz).
// Returns visual meshes positioned at the island centre; never colliders.
const leaf=new T.IcosahedronGeometry(1,0),rootShape=(()=>{const g=new T.CylinderGeometry(.07,.16,1,4);g.translate(0,-.5,0);return g;})();
export function islandFringe(parent,mats,{x=0,y=0,z=0,rx=10,rz=rx,seed=1,moss=Math.round((rx+rz)*.55),roots=Math.round((rx+rz)*.3),name='Island fringe'}={}){
 const random=rng(seed),dummy=new T.Object3D(),out=[];
 if(moss>0){const m=new T.InstancedMesh(leaf,mats.grass,moss);m.name=name+' moss overhang';for(let i=0;i<moss;i++){const a=i/moss*Math.PI*2+(random()-.5)*.1,r=1+(random()-.3)*.04;dummy.position.set(Math.cos(a)*rx*r,-.35-random()*.5,Math.sin(a)*rz*r);dummy.rotation.set((random()-.5)*.3,-a,(random()-.5)*.3);dummy.scale.set(.9+random()*.8,.35+random()*.35,(rx+rz)*Math.PI/moss*.62+random()*.5);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}
  m.position.set(x,y,z);m.frustumCulled=false;parent.add(m);out.push(m);}
 if(roots>0){const parts=[];for(let i=0;i<roots;i++){const a=random()*Math.PI*2,r=.97-random()*.05,len=2+random()*6.5;dummy.position.set(Math.cos(a)*rx*r,-.6-random()*.8,Math.sin(a)*rz*r);dummy.rotation.set((random()-.5)*.35,a,(random()-.5)*.35);dummy.scale.set(1,len,1);dummy.updateMatrix();parts.push({geometry:rootShape,matrix:dummy.matrix.clone()});}
  const mesh=new T.Mesh(mergeParts(parts),mats.bark);mesh.name=name+' dangling roots';mesh.position.set(x,y,z);parent.add(mesh);out.push(mesh);}
 return out;
}
