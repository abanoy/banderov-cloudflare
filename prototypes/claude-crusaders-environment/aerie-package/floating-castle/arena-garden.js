import * as T from '../vendor/three.module.js';
import {chargeOrb} from './charge-orb.js?v=aerie-20261018';

// Shared, quantized falling-water material: every fall (ring rims, castle and island
// undersides) shares one program and one clock, advanced by arenaGarden().update(time).
// SA1-style water: azure body with bright white-cyan foam bands (was teal .28,.66,.73 / .78,.98,.88).
const sharedWaterTime={value:0};let sharedWaterMaterial=null;
export function sharedWater(){return sharedWaterMaterial||(sharedWaterMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:sharedWaterTime},
  vertexShader:'varying vec2 flowUV; void main(){flowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform float time; varying vec2 flowUV; void main(){float v=flowUV.y;float fade=pow(clamp(1.0-v,0.0,1.0),1.45);float edge=smoothstep(0.0,.13,flowUV.x)*smoothstep(0.0,.13,1.0-flowUV.x);float stripe=step(.68,fract(floor(flowUV.x*16.0)*.37+floor(v*48.0-time*8.0)*.13));float bands=step(.84,fract(v*10.0-time*.9));vec3 color=mix(vec3(.3,.7,.9),vec3(.9,1.,1.),max(stripe*.6,bands*.8));gl_FragColor=vec4(color,(.52+stripe*.17+bands*.15)*fade*edge);}'
 }));}
// A thin fading ribbon falling from (x,y,z) offset by radius along angle (sin,cos), drifting
// outward by drift*t^2. With x=z=0,y=.26 it reproduces the original ring-rim falls exactly.
export function makeWaterfall(parent,{x=0,y=.26,z=0,angle=0,radius=0,width=3,height=30,drift=2.4,segments=16,name='Fading waterfall',material=sharedWater()}={}){
 const positions=[],uv=[],indices=[];
 for(let j=0;j<=segments;j++){
  const t=j/segments,w=width*(1+t*.4),rad=radius+drift*t*t;
  for(const side of [-1,1]){positions.push(x+Math.sin(angle)*rad+Math.cos(angle)*side*w/2,y-height*t,z+Math.cos(angle)*rad-Math.sin(angle)*side*w/2);uv.push((side+1)/2,t);}
  if(j<segments){const q=j*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const fall=new T.Mesh(geometry,material);fall.name=name;parent.add(fall);
 // Per-mesh material clones (allegiance tint) copy uniforms by value; keep every clone on the shared clock.
 fall.onBeforeRender=()=>{const u=fall.material.uniforms?.time;if(u&&u!==sharedWaterTime)u.value=sharedWaterTime.value;};return fall;
}
// Particle detail for the quality preset (0.5..1). Scales visible instance counts only;
// buffers are allocated once at full size. 1 = original counts.
let detail=1;const detailTargets=new Set();
export function setDetail(level=1){detail=Math.min(1,Math.max(.5,Number(level)||1));for(const apply of detailTargets)apply(detail);return detail;}
// Instanced tree crowns: round, cypress, poplar, pine and blossom (owner pink). Visual only;
// callers keep any trunk colliders. Each batch sits at its items' centroid so position-based
// passes (allegiance tint by silo) treat it as local scenery.
const crownShapes={round:[['ico','leaves',0,3.7,0,2.1,1.75,2.1],['ico','leaves',.5,4.7,-.3,1.25,1.05,1.25]],
 cypress:[['cone','pine',0,2.5,0,1.25,3.2,1.25],['cone','pine',0,4.1,0,.95,2.7,.95],['cone','pine',0,5.6,0,.6,2.2,.6]],
 poplar:[['ico','leaves',0,3.3,0,1.05,2.4,1.05],['ico','leaves',0,5.4,0,.8,1.9,.8]],
 pine:[['cone','pine',0,2.3,0,2.3,2.6,2.3],['cone','pine',0,3.7,0,1.75,2.4,1.75],['cone','pine',0,5,0,1.1,2.1,1.1]],
 blossom:[['ico','blossom',0,3.6,0,2.05,1.55,2.05],['ico','blossom',.7,4.5,.4,1.3,1,1.3],['ico','leaves',-.6,3.1,-.5,1.1,.8,1.1]]};
const crownGeometry={ico:new T.IcosahedronGeometry(1,0),cone:(()=>{const g=new T.ConeGeometry(1,1,6);g.translate(0,.5,0);return g;})(),trunk:(()=>{const g=new T.CylinderGeometry(.2,.32,1,5);g.translate(0,.5,0);return g;})()};
export function treeCrowns(parent,mats,trees,{trunks=false,name='Tree crowns'}={}){
 const groups=new Map(),dummy=new T.Object3D(),out=[];
 for(const t of trees){const k=t.size||1,shape=crownShapes[t.kind]||crownShapes.round,c=Math.cos(t.ry||0),s=Math.sin(t.ry||0);
  for(const [g,m,dx,dy,dz,sx,sy,sz] of shape){const key=g+'|'+m;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x:t.x+(dx*c+dz*s)*k,y:t.y+dy*k,z:t.z+(dz*c-dx*s)*k,sx:sx*k,sy:sy*k,sz:sz*k,ry:t.ry||0});}
  if(trunks){if(!groups.has('trunk|bark'))groups.set('trunk|bark',[]);groups.get('trunk|bark').push({x:t.x,y:t.y,z:t.z,sx:k,sy:2.6*k,sz:k,ry:0});}}
 for(const [key,items] of groups){const [g,m]=key.split('|'),cx=items.reduce((a,p)=>a+p.x,0)/items.length,cz=items.reduce((a,p)=>a+p.z,0)/items.length,batch=new T.InstancedMesh(crownGeometry[g],mats[m]||mats.leaves,items.length);
  batch.name=name+' ('+key+')';batch.position.set(cx,0,cz);batch.frustumCulled=false;items.forEach((p,i)=>{dummy.position.set(p.x-cx,p.y,p.z-cz);dummy.rotation.set(0,p.ry,0);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});parent.add(batch);out.push(batch);}
 return out;
}

// A lower garden court, four honest walking connections and deliberately local
// scenery. This does not add launch pads, rank rules or combat objectives.
export function arenaGarden(arena,mats){
 const root=new T.Group();root.name='Lower core and hanging gardens';arena.add(root);
 const solids=[],occluders=[],stairs=[],waterfalls=[],gardens=[],vines=[];
 const boxGeometry=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
 function mesh(geometry,material,x=0,y=0,z=0,solid=false,parent=root){
  const object=new T.Mesh(geometry,material);object.position.set(x,y,z);parent.add(object);
  if(solid){object.userData.place='Lower core court';solids.push(object);}return object;
 }
 function box(x,y,z,w,h,d,material=mats.stone,solid=false,parent=root){const o=mesh(boxGeometry,material,x,y,z,solid,parent);o.scale.set(w,h,d);return o;}
 function beam(a,b,w,h,material,parent=root){const start=new T.Vector3(...a),end=new T.Vector3(...b),o=mesh(new T.BoxGeometry(w,h,start.distanceTo(end)),material,...start.clone().add(end).multiplyScalar(.5).toArray(),false,parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),end.sub(start).normalize());return o;}
 function hoop(radius,y,material,tube=.16){const o=mesh(new T.TorusGeometry(radius,tube,4,64),material,0,y,0);o.rotation.x=Math.PI/2;return o;}

 // The entry is level until the ring's exact inner edge. Starting a sloped
 // bridge inside its tall inner wall would block the return ascent.
 for(let i=0;i<4;i++){
  const group=new T.Group(),angle=i*Math.PI/2;group.rotation.y=angle;root.add(group);group.name=['South','East','North','West'][i]+' core stair';
  const width=7,start=47,end=15,top=0,bottom=-12,depth=1.25;
  // A closed wedge carries a smooth top beneath visible shallow stair treads.
  const p=[-width/2,top,start,width/2,top,start,width/2,bottom,end,-width/2,bottom,end,
   -width/2,top-depth,start,width/2,top-depth,start,width/2,bottom-depth,end,-width/2,bottom-depth,end];
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
  geometry.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2]);geometry.computeVertexNormals();
  const ramp=mesh(geometry,mats.paving,0,0,0,true,group);ramp.name=group.name+' continuous support';ramp.userData.place=group.name;
  const entry=box(0,-.6,48,7,1.2,2.04,mats.paving,true,group);entry.userData.place=group.name;
  // A very short forward overlap avoids an unsupported crest seam without
  // making the flat entry project far enough to obstruct the rising slope.
  const steps=32,treadDepth=(start-end)/steps;
  for(let j=0;j<steps;j++){
   const z=start-(j+.5)*treadDepth,y=top+(bottom-top)*(j+.5)/steps;
   box(0,y-.13,z,width,.21,treadDepth-.035,j%4===0?mats.edge:mats.paving,false,group);
  }
  for(const side of [-1,1]){
   beam([side*4,top+.4,start],[side*4,bottom+.4,end],.55,.7,mats.edge,group);
   beam([side*4,top-.65,start],[side*4,bottom-.65,end],.7,.55,mats.dark,group);
   for(const t of [0,.5,1]){const z=start+(end-start)*t,y=top+(bottom-top)*t;box(side*4,y+.55,z,.85,1.6,.85,mats.stone,false,group);box(side*4,y+1.43,z,1,.2,1,mats.edge,false,group);}
  }
  stairs.push({root:group,ramp,entry,width,angle,start:[Math.sin(angle)*49,0,Math.cos(angle)*49],end:[Math.sin(angle)*15,-12,Math.cos(angle)*15]});
 }

 const island=mesh(new T.CylinderGeometry(16,16,1.6,32),mats.paving,0,-12.8,0,true);island.name='Lower core island';
 // Put the four incoming centre lines inside cap triangles, away from the
 // cylinder's duplicated radial cap seams (west-axis rays can round apart).
 island.rotation.y=Math.PI/32;
 const rock=mesh(new T.CylinderGeometry(15.8,4,13,10,2),mats.soil,0,-20.1,0,true);rock.name='Core island hanging rock';
 hoop(15.65,-11.9,mats.edge,.22);hoop(8.2,-11.96,mats.roof,.12);
 for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4;const crag=mesh(new T.ConeGeometry(1.4+i%2,7+i%3*2,5),mats.soil,Math.sin(a)*11,-23,Math.cos(a)*11);crag.rotation.z=Math.PI;}
 const pedestal=mesh(new T.CylinderGeometry(6.3,7,1,12),mats.edge,0,-11.5,0,true);pedestal.name='Core securing foundation';
 const core=chargeOrb(root,mats,{x:0,y:-5.82,z:0,radius:3.5,color:0x9af2d9,crown:true,phase:1.7});core.root.name='Battleground central core';
 for(const o of [core.core,core.foot]){o.userData.place='Central core cradle';solids.push(o);}
 // Small recessed radial markings keep the core's lower level readable.
 for(let i=0;i<12;i++){const a=i*Math.PI/6,o=box(Math.sin(a)*11.5,-11.94,Math.cos(a)*11.5,.35,.08,2.4,mats.roof);o.rotation.y=a;}

 const foliage=[],grass=[],flowers=[],moss=[],vineLeaves=[],stems=[];
 function plant(x,y,z,size,phase){
  for(let j=0;j<4;j++){const a=j*2.4+phase;foliage.push({x:x+Math.cos(a)*size*.65,y:y+size*(.45+j%2*.24),z:z+Math.sin(a)*size*.65,sx:size,sy:size*.55,sz:size*.82,ry:a});}
  for(let j=0;j<6;j++){const a=j*2.399+phase;grass.push({x:x+Math.cos(a)*size*1.45,y:y+.3,z:z+Math.sin(a)*size*1.45,sx:.22,sy:.7+j%3*.16,sz:.22,ry:a});}
 }
 // Gardens stay near the edges; the r59/r88 circular lanes and r76 pod pads
 // remain clear. All foliage is decorative and has no invisible collider.
 for(let i=0;i<16;i++){
  const a=(i+.5)*Math.PI/8,r=52.4,x=Math.sin(a)*r,z=Math.cos(a)*r;
  const bed=mesh(new T.CylinderGeometry(2.65,2.85,.22,8),mats.grass,x,.09,z);bed.scale.z=.77;bed.rotation.y=a;gardens.push(bed);
  plant(x,.12,z,.92+i%3*.12,a);
  for(let j=0;j<3;j++){const b=a+j*2.2;flowers.push({x:x+Math.cos(b)*1.7,y:.52,z:z+Math.sin(b)*1.7,sx:.18,sy:.22,sz:.18,ry:b});}
 }
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,r=104.1,x=Math.sin(a)*r,z=Math.cos(a)*r;
  plant(x,.04,z,.9+i%3*.09,a);
  moss.push({x:Math.sin(a)*107.1,y:-.25,z:Math.cos(a)*107.1,sx:2.8,sy:.42,sz:1.2,ry:a});
  if(i%3===0)continue;
  const outer=108.35,length=5+i%5*1.7,start=new T.Vector3(Math.sin(a)*outer,-.5,Math.cos(a)*outer),end=new T.Vector3(Math.sin(a)*(outer+.5),-length,Math.cos(a)*(outer+.5));
  const stem=new T.Mesh(new T.CylinderGeometry(.07,.11,start.distanceTo(end),4),mats.bark);stem.position.copy(start).add(end).multiplyScalar(.5);stem.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize());root.add(stem);stems.push(stem);
  for(let j=0;j<6;j++){const t=j/6,radius=outer+t*.5;vineLeaves.push({x:Math.sin(a)*radius+Math.cos(a)*Math.sin(j*2.7)*.4,y:-.65-t*length,z:Math.cos(a)*radius-Math.sin(a)*Math.sin(j*2.7)*.4,sx:.62-t*.22,sy:.38,sz:.5,ry:a+j});}
  vines.push({stem,length});
 }
 for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4;plant(Math.sin(a)*13.1,-11.94,Math.cos(a)*13.1,.62,a);}
 function batch(items,geometry,material,name){
  const instances=new T.InstancedMesh(geometry,material,items.length);instances.name=name;
  items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.ry||0,0);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);});
  // Instances span the whole ring: cull against the ring volume, not the unit base shape at the origin.
  geometry.boundingSphere=new T.Sphere(new T.Vector3(0,-12,0),126);root.add(instances);return instances;
 }
 const leafGeometry=new T.IcosahedronGeometry(1,0),plantBatches=[batch(foliage,leafGeometry,mats.leaves,'Garden shrubs'),batch(grass,new T.ConeGeometry(1,1,4),mats.grass,'Grass tufts'),batch(moss,leafGeometry,mats.grass,'Outer moss shelf'),batch(vineLeaves,leafGeometry,mats.leaves,'Trailing vine leaves')];
 const blossomMaterial=new T.MeshBasicMaterial({color:0xffd7a5});plantBatches.push(batch(flowers,new T.OctahedronGeometry(1,0),blossomMaterial,'Small garden blossoms'));

 // Each fall has its own actual vertical alpha ramp: visible at the lip and
 // completely transparent at its lower edge. Moving foam is quantized to the
 // same painted, low-resolution character as the scene's nearest-filter tiles.
 const waterTime=sharedWaterTime,waterMaterial=sharedWater();
 for(let i=0;i<8;i++){
  const inner=i>=4,a=Math.PI/4+(i%4)*Math.PI/2,r=inner?46.7:108.4,width=inner?3.3:5.1,height=inner?48:67;
  const fall=makeWaterfall(root,{angle:a,radius:r,width,height,drift:inner?-2.4:2.4,name:(inner?'Inner':'Outer')+' fading waterfall '+(i%4+1),material:waterMaterial});
  const pool=mesh(new T.CircleGeometry(width*.7,12),new T.MeshBasicMaterial({color:0x6cd6ee,transparent:true,opacity:.78,depthWrite:false}),Math.sin(a)*(inner?49:106.5),.24,Math.cos(a)*(inner?49:106.5));pool.rotation.x=-Math.PI/2;pool.scale.y=.65;
  const lip=box(Math.sin(a)*(inner?47.2:107.8),.05,Math.cos(a)*(inner?47.2:107.8),width+.8,.3,1.2,mats.edge);lip.rotation.y=a;
  waterfalls.push({mesh:fall,angle:a,radius:r,width,height,inner,pool});
 }
 const moteMaterial=new T.MeshBasicMaterial({color:0xd4f5ce,transparent:true,opacity:.75,depthWrite:false}),motes=new T.InstancedMesh(new T.OctahedronGeometry(.13,0),moteMaterial,112);
 motes.name='Battleground drifting motes';motes.instanceMatrix.setUsage(T.DynamicDrawUsage);motes.frustumCulled=false;root.add(motes);
 const sprayMaterial=new T.MeshBasicMaterial({color:0xbbf0e8,transparent:true,opacity:.4,depthWrite:false}),spray=new T.InstancedMesh(new T.IcosahedronGeometry(.28,0),sprayMaterial,96);
 spray.name='Fading waterfall spray';spray.instanceMatrix.setUsage(T.DynamicDrawUsage);spray.frustumCulled=false;root.add(spray);
 function update(time){
  waterTime.value=time;core.update(time);
  for(let i=0;i<motes.count;i++){
   const a=i*2.399+time*(.017+i%3*.004),r=58+(i*17%37),rise=(time*.13+i*.173)%1;
   dummy.position.set(Math.sin(a)*r,.7+rise*5,Math.cos(a)*r);dummy.rotation.set(a,time*.15+i,0);dummy.scale.setScalar(.55+Math.sin(rise*Math.PI)*.65);dummy.updateMatrix();motes.setMatrixAt(i,dummy.matrix);
  }motes.instanceMatrix.needsUpdate=true;
  for(let i=0;i<spray.count;i++){
   const k=spray.count===96?i:Math.floor(i*96/spray.count),fall=waterfalls[Math.floor(k/12)],phase=(time*.19+(k%12)/12)%1,spread=Math.sin(k*2.4)*fall.width*(.3+phase*.35),r=fall.radius+(fall.inner?-1:1)*phase*3;
   dummy.position.set(Math.sin(fall.angle)*r+Math.cos(fall.angle)*spread,-phase*fall.height*.9,Math.cos(fall.angle)*r-Math.sin(fall.angle)*spread);
   dummy.rotation.set(k+time*.2,k*.6,0);dummy.scale.setScalar(Math.sin(phase*Math.PI)*(.7+phase));dummy.updateMatrix();spray.setMatrixAt(i,dummy.matrix);
  }spray.instanceMatrix.needsUpdate=true;
 }
 const applyDetail=level=>{motes.count=Math.round(112*level);spray.count=Math.round(96*level);};detailTargets.add(applyDetail);applyDetail(detail);
 update(0);occluders.push(...solids);root.updateMatrixWorld(true);
 return {root,solids,occluders,stairs,island,rock,pedestal,core,gardens,vines,plantBatches,waterfalls,waterMaterial,waterTime,motes,spray,update};
}
