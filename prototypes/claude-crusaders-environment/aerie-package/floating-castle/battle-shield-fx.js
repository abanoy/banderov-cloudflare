import * as T from '../vendor/three.module.js';
// Visual castle shield (collision lives in battle-shields.js). The shell follows the volume's real
// superellipsoid exponent; a world-space 10 m hex/rune lattice with screen-pixel-wide lines runs over each face,
// the fresnel rim carries the read, the bottom 20% fades into the foundation, and when the camera
// focus (the followed player) is inside a volume that shell drops to a faint silhouette rim (no far wall,
// faded around the screen centre) so follow views keep their colour instead of a cyan wash or wall edge.
const vertexShader=`varying vec3 shieldWorld;varying vec3 shieldLocal;varying vec3 shieldNormal;varying vec3 shieldView;varying vec2 shieldNdc;
void main(){shieldLocal=position;vec4 w=modelMatrix*vec4(position,1.);shieldWorld=w.xyz;vec4 p=viewMatrix*w;shieldNormal=normalize(normalMatrix*normal);shieldView=normalize(-p.xyz);gl_Position=projectionMatrix*p;shieldNdc=gl_Position.xy/gl_Position.w;}`;
const fragmentShader=`varying vec3 shieldWorld;varying vec3 shieldLocal;varying vec3 shieldNormal;varying vec3 shieldView;varying vec2 shieldNdc;uniform float clock;uniform float flash;uniform float inside;uniform vec3 tint;
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
void main(){
 vec3 a=abs(shieldLocal);bool top=a.y>=max(a.x,a.z);vec2 plane=top?shieldWorld.xz:a.x>=a.z?shieldWorld.zy:shieldWorld.xy;
 vec2 p=plane/10.,r=vec2(1.,1.732),h=r*.5,ga=mod(p,r)-h,gb=mod(p-h,r)-h,g=dot(ga,ga)<dot(gb,gb)?ga:gb,cell=p-g;
 // Lattice lines are sized in screen pixels (fwidth = cells per pixel): about one render pixel wide at any zoom,
 // and the whole lattice fades out where a 10 m cell would be smaller than ~15 px (no stair-step streak noise).
 vec2 q=abs(g);float edge=max(dot(q,vec2(.5,.866)),q.x),px=max(fwidth(p.x),fwidth(p.y)),detail=1.-smoothstep(.035,.07,px),line=step(.5-px*1.15,edge)*detail;
 float id=hash(cell),rune=top?step(.93,id)*step(edge,.28)*step(.5,hash(floor(g*4.)+cell))*(.6+.4*sin(clock*3.+id*40.))*detail:0.;
 float pulse=line*step(.82,fract(id*7.+clock*.35));
 // Inside your own shell (camera focus inside): no far wall, only a thin silhouette glow that fades out around the
 // screen centre and to zero at the exact silhouette, so the spawn view keeps its colours with no hard edge or band.
 float x=1.-abs(dot(normalize(shieldNormal),normalize(shieldView))),rim=mix(pow(x,1.6),.5*smoothstep(.35,.7,x)*(1.-smoothstep(.7,.98,x)),inside);
 float sweep=pow(max(0.,sin(shieldWorld.y*.22-clock*1.6)),28.);
 float base=smoothstep(-1.,-.6,shieldLocal.y),face=gl_FrontFacing?1.:.45*(1.-inside),near=mix(1.,.5*smoothstep(.2,.95,length(shieldNdc)),inside);
 float fill=(.015+line*.13+pulse*.16+rune*.2+sweep*.07)*(1.-inside*.95);
 float alpha=(fill+rim*mix(.42,.3,inside)+flash*mix(.28,.12,inside))*base*face*near;
 vec3 c=tint*(1.+rim*.35+pulse*.3)+vec3(flash*.7);
 gl_FragColor=vec4(min(c,vec3(1.)),alpha);}`;
const geometries=new Map();
function shellGeometry(exponent){const e=Number(exponent)||8;if(geometries.has(e))return geometries.get(e);const geometry=new T.SphereGeometry(1,48,32),positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),f=(Math.abs(x)**e+Math.abs(y)**e+Math.abs(z)**e)**(-1/e);positions.setXYZ(i,x*f,y*f,z*f);}geometry.computeVertexNormals();geometries.set(e,geometry);return geometry;}
export function createShieldFX(root,colors){
 const forward=new T.Vector3(),focus=new T.Vector3();
 const shells=[0,1].map(team=>{
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,extensions:{derivatives:true},uniforms:{clock:{value:0},flash:{value:0},inside:{value:0},tint:{value:new T.Color(colors[team])}},vertexShader,fragmentShader});
  const mesh=new T.Mesh(shellGeometry(8),material);mesh.name=(team?'Dusk':'Dawn')+' electric castle envelope';mesh.userData.exponent=8;mesh.userData.insideTarget=0;
  // Camera focus = the point main.js orbits (350 up and 350 back along the view): inside test against this shell's volume.
  mesh.onBeforeRender=(renderer,scene,camera)=>{const v=mesh.userData.volume;if(!v)return;camera.getWorldDirection(forward);focus.copy(camera.position).addScaledVector(forward,camera.isOrthographicCamera?350*Math.SQRT2:0);const e=v.exponent||8,m=Math.abs((focus.x-v.x)/v.rx)**e+Math.abs((focus.y-v.y)/v.ry)**e+Math.abs((focus.z-v.z)/v.rz)**e,u=material.uniforms.inside;if(mesh.userData.fresh){u.value=m<1?1:0;mesh.userData.fresh=false;}else u.value+=((m<1?1:0)-u.value)*.2;};
  root.add(mesh);return mesh;
 });
 // Pooled bursts: preallocated lightning segments plus a flat shockwave ring (no wireframes, no per-event allocation).
 const ringGeometry=new T.RingGeometry(.82,1,32);ringGeometry.rotateX(-Math.PI/2);
 const bursts=Array.from({length:12},()=>{const group=new T.Group(),positions=new Float32Array(8*5*2*3),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const lines=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0xd5fffa,transparent:true,opacity:0,depthWrite:false})),ring=new T.Mesh(ringGeometry,new T.MeshBasicMaterial({color:0xcaffee,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));lines.frustumCulled=false;group.add(lines,ring);root.add(group);return {group,lines,ring,positions,at:-99,kind:''};});let next=0;
 const flashes=[-99,-99],kinds=['shield-shock','shield-block','shield-collapse','tower-discharge','tower-armed','battery-off','protector-down'];
 function event(e){if(!kinds.includes(e.type))return;
  if(e.team!==undefined)flashes[e.team]=e.time;
  const b=bursts[next++%bursts.length];b.at=e.time;b.kind=e.type;b.group.position.set(e.x||0,e.y||0,e.z||0);const size=e.type==='shield-collapse'?25:e.type==='shield-shock'?9:e.type==='tower-discharge'?8:e.type==='protector-down'?6:3;
  let o=0;for(let i=0;i<8;i++){const a=i*2.399;let px=0,py=0,pz=0;for(let j=1;j<=5;j++){const x=Math.cos(a)*size*j/5,y=Math.sin(i*3+j*7)*size*.22+(j/5)*size*.3,z=Math.sin(a)*size*j/5;const P=b.positions;P[o]=px;P[o+1]=py;P[o+2]=pz;P[o+3]=x;P[o+4]=y;P[o+5]=z;o+=6;px=x;py=y;pz=z;}}
  b.lines.geometry.attributes.position.needsUpdate=true;b.ring.material.color.set(e.type==='battery-off'?0xffba77:e.type==='protector-down'?0xfff0b0:0xcefff4);
 }
 function update(time,volumes,health){
  shells.forEach((m,i)=>{const v=volumes.find(v=>v.team===i);const was=m.visible;m.visible=!!v&&health[i]>0;m.userData.volume=m.visible?v:null;if(m.visible&&!was)m.userData.fresh=true;if(!v)return;
   const e=v.exponent||8;if(m.userData.exponent!==e){m.geometry=shellGeometry(e);m.userData.exponent=e;}
   m.position.set(v.x,v.y,v.z);m.scale.set(v.rx,v.ry,v.rz);m.material.uniforms.clock.value=time;m.material.uniforms.flash.value=Math.max(0,1-(time-flashes[i])/.4);});
  for(const b of bursts){const age=time-b.at,collapse=b.kind==='shield-collapse',life=collapse?2.5:.8,fade=Math.max(0,1-age/life);b.group.visible=age>=0&&age<life;b.lines.material.opacity=fade;b.ring.material.opacity=fade*.55;b.ring.scale.setScalar((collapse?20:1)+age*(collapse?35:9));b.lines.scale.setScalar(1+age*2);}
 }
 function reset(){flashes.fill(-99);bursts.forEach(b=>{b.at=-99;b.group.visible=false;});shells.forEach(m=>{m.visible=false;m.userData.volume=null;m.material.uniforms.inside.value=0;});}
 reset();return {event,update,reset,shells,snapshot:()=>({shells:shells.filter(s=>s.visible).length,bursts:bursts.filter(b=>b.group.visible).length})};
}
