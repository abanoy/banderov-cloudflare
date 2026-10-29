import * as T from '../vendor/three.module.js';
export function createShieldFX(root,colors){
 const shells=[0,1].map(team=>{
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
   uniforms:{clock:{value:0},flash:{value:0},tint:{value:new T.Color(colors[team])}},
   vertexShader:'varying vec2 shieldUv; varying vec3 shieldNormal; varying vec3 shieldView;void main(){shieldUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);shieldNormal=normalize(normalMatrix*normal);shieldView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
   fragmentShader:`varying vec2 shieldUv;varying vec3 shieldNormal;varying vec3 shieldView;uniform float clock;uniform float flash;uniform vec3 tint;
    void main(){float rim=pow(1.-abs(dot(normalize(shieldNormal),normalize(shieldView))),2.);
     vec2 grid=abs(fract(shieldUv*vec2(32.,16.))-.5);float line=step(.477,max(grid.x,grid.y));
     float arc=pow(max(0.,sin(shieldUv.x*180.+sin(shieldUv.y*77.+clock*2.3)*2.+clock*4.)),36.);
     float sweep=pow(max(0.,sin(shieldUv.y*25.-clock)),24.);
     gl_FragColor=vec4(tint+vec3(flash*.7),.025+rim*.26+line*.10+arc*.20+sweep*.08+flash*.25);}`});
  const geometry=new T.SphereGeometry(1,48,32),positions=geometry.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),f=(Math.abs(x)**8+Math.abs(y)**8+Math.abs(z)**8)**(-1/8);positions.setXYZ(i,x*f,y*f,z*f);}geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,material);mesh.name=(team?'Dusk':'Dawn')+' electric castle envelope';root.add(mesh);return mesh;
 });
 const bursts=Array.from({length:12},()=>{const group=new T.Group(),lines=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xd5fffa,transparent:true,opacity:0,depthWrite:false})),ring=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:0xcaffee,wireframe:true,transparent:true,opacity:0,depthWrite:false}));group.add(lines,ring);root.add(group);return {group,lines,ring,at:-99,kind:''};});let next=0;
 const flashes=[-99,-99];
 function event(e){if(!['shield-shock','shield-block','shield-collapse','tower-discharge','tower-armed','battery-off'].includes(e.type))return;
  if(e.team!==undefined)flashes[e.team]=e.time;
  const b=bursts[next++%bursts.length];b.at=e.time;b.kind=e.type;b.group.position.set(e.x||0,e.y||0,e.z||0);const points=[],size=e.type==='shield-collapse'?25:e.type==='shield-shock'?9:e.type==='tower-discharge'?8:3;
  for(let i=0;i<8;i++){const a=i*2.399;let previous=new T.Vector3();for(let j=1;j<=5;j++){const p=new T.Vector3(Math.cos(a)*size*j/5,Math.sin(i*3+j*7)*size*.22+(j/5)*size*.3,Math.sin(a)*size*j/5);points.push(previous,p);previous=p;}}
  b.lines.geometry.dispose();b.lines.geometry=new T.BufferGeometry().setFromPoints(points);b.ring.material.color.set(e.type==='battery-off'?0xffba77:0xcefff4);
 }
 function update(time,volumes,health){
  shells.forEach((m,i)=>{const v=volumes.find(v=>v.team===i);m.visible=!!v&&health[i]>0;if(!v)return;m.position.set(v.x,v.y,v.z);m.scale.set(v.rx,v.ry,v.rz);m.material.uniforms.clock.value=time;m.material.uniforms.flash.value=Math.max(0,1-(time-flashes[i])/.4);});
  for(const b of bursts){const age=time-b.at,life=b.kind==='shield-collapse'?2.5:.8,fade=Math.max(0,1-age/life);b.group.visible=age>=0&&age<life;b.lines.material.opacity=fade;b.ring.material.opacity=fade*.7;b.ring.scale.setScalar((b.kind==='shield-collapse'?20:1)+age*(b.kind==='shield-collapse'?35:9));b.lines.scale.setScalar(1+age*2);}
 }
 function reset(){flashes.fill(-99);bursts.forEach(b=>{b.at=-99;b.group.visible=false;});shells.forEach(m=>m.visible=false);}
 reset();return {event,update,reset,shells,snapshot:()=>({shells:shells.filter(s=>s.visible).length,bursts:bursts.filter(b=>b.group.visible).length})};
}
