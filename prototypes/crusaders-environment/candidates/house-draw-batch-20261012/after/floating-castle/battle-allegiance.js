import * as T from '../vendor/three.module.js';
export function createBattleAllegiance({world,viewerTeam=()=>0}){
 let time=0;
 const records=new Map(),states=world.orbTowers.map(()=>({dark:0,glow:0}));
 function attach(mesh,state){
  if(!mesh.material)return;
  const old=records.get(mesh);if(old&&(mesh.material===old.clones||mesh.material===mesh.userData.fadeMaterial))return;
  if(old){for(const m of [].concat(old.clones))m.dispose();records.delete(mesh);}
  const original=mesh.material;
  const clone=m=>{const next=m.clone(),hook=m.onBeforeCompile;next.onBeforeCompile=function(shader){
   hook.call(m,shader);shader.uniforms.allegianceDark={get value(){return state.dark;}};
   shader.uniforms.allegianceGlow={get value(){return state.glow;}};
   shader.fragmentShader='uniform float allegianceDark; uniform float allegianceGlow;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
    gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*vec3(.16,.105,.24)+vec3(.009,.003,.02),allegianceDark);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*vec3(.72,1.08,1.06)+vec3(.025,.10,.075),allegianceGlow);
    #include <tonemapping_fragment>`);
  };next.customProgramCacheKey=()=>m.customProgramCacheKey()+'-allegiance-v1';return next;};
  mesh.material=Array.isArray(original)?original.map(clone):clone(original);records.set(mesh,{original,clones:mesh.material});
 }
 const castles=world.castles.map((_,team)=>({dark:team!==viewerTeam()?1:0,glow:team===viewerTeam()?.25:0}));
 const glitchRoot=new T.Group();glitchRoot.name='Silo ownership atmosphere';world.arena?.parent?.add(glitchRoot);
 const glitch=world.orbTowers.map(o=>{const material=new T.MeshBasicMaterial({color:0x9b63d9,transparent:true,opacity:0,depthWrite:false});const bits=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,48);bits.frustumCulled=false;glitchRoot.add(bits);const haze=new T.Mesh(new T.CylinderGeometry(35,35,.25,48),new T.MeshBasicMaterial({color:0x10051f,transparent:true,opacity:0,depthWrite:false}));haze.position.set(o.x,(o.y||0)+.18,o.z);glitchRoot.add(haze);return {bits,haze};});
 const dummy=new T.Object3D();
 function sync(){
  const present=new Set();
  const walk=(root,state)=>root?.traverse(mesh=>{if(mesh.material){present.add(mesh);attach(mesh,state);}});
  world.castles.forEach((root,i)=>walk(root,castles[i]));
  world.orbTowers.forEach((o,i)=>[].concat(o.structureRoot||o.root).forEach(root=>walk(root,states[i])));
  // Ground and vegetation are siblings of the authored tower structure.
  world.arena?.updateWorldMatrix(true,true);
  world.arena?.traverse(mesh=>{if(!mesh.material||!mesh.geometry)return;mesh.geometry.computeBoundingBox();const centre=mesh.geometry.boundingBox?.getCenter(new T.Vector3()).applyMatrix4(mesh.matrixWorld);if(!centre)return;const i=world.orbTowers.findIndex((o,j)=>Math.hypot(centre.x-o.x,centre.z-o.z)<(j===4?31:39));if(i>=0){present.add(mesh);attach(mesh,states[i]);}});
  for(const [mesh,r] of records)if(!present.has(mesh)){mesh.material=r.original;for(const m of [].concat(r.clones))m.dispose();records.delete(mesh);}
 }
 function update(dt,objectives=[]){
  time+=Math.max(0,Math.min(dt,.1));
  castles.forEach((s,i)=>{s.dark=i!==viewerTeam()?1:0;s.glow=i===viewerTeam()?.25:0;});
  const rate=1-Math.exp(-Math.max(0,Math.min(dt,.1))*1.6);
  states.forEach((s,i)=>{const owner=objectives[i]?.owner??-1,dark=owner>=0&&owner!==viewerTeam()?1:0,glow=owner===viewerTeam()?1:0;s.dark+=(dark-s.dark)*rate;s.glow+=(glow-s.glow)*rate;});
  glitch.forEach((v,i)=>{const strength=states[i].dark,o=world.orbTowers[i];v.bits.visible=strength>.015;v.bits.material.opacity=strength*.8;v.haze.material.opacity=strength*.62;for(let j=0;j<48;j++){const phase=j*2.399+Math.floor(time*(3+j%4))*.05,r=12+(j%7)*3.5;dummy.position.set(o.x+Math.cos(phase)*r,(o.y||0)+2+((time*(2+j%3)+j*1.91)%25),o.z+Math.sin(phase)*r);dummy.rotation.set(0,j,0);const flicker=Math.sin(time*(18+j%9)+j)>-.25;dummy.scale.set(flicker?1.4+j%3*.5:.08,.12+j%4*.1,.4);dummy.updateMatrix();v.bits.setMatrixAt(j,dummy.matrix);}v.bits.instanceMatrix.needsUpdate=true;});
 }
 sync();
 return {sync,update,snapshot:()=>({castles:castles.map(s=>({...s})),silos:states.map(s=>({...s})),meshes:records.size,glitchParticles:glitch.map((v,i)=>({visible:v.bits.visible,strength:states[i].dark,count:48}))})};
}
