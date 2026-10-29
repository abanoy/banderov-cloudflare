import * as T from '../vendor/three.module.js';
export function createBattleAllegiance({world,viewerTeam=()=>0}){
 let time=0;
 const records=new Map(),states=world.orbTowers.map(()=>({dark:0,glow:0}));
 // Opaque clones are shared per (state, original material, group): identical shader and uniforms, far fewer material
 // switches. Transparent materials keep per-mesh clones because their opacity is animated per object (orb masks, fades).
 // player-cutaway.js installs its cut per material, on meshes under the castles/arena and on world.occluders, so a clone
 // is only shared inside a group the cutaway treats alike: fleet ships (moved to the scene by battle-fleet.js, so only
 // their occluder meshes are cut; those keep their own clone), effect/beam subtrees (never cut) and everything else.
 const shared=new Map(),owners=new Map();let shipRoots=new Set(),occluders=new Set();
 function group(mesh){if(!mesh.isMesh)return 'other';for(let p=mesh;p;p=p.parent){const u=p.userData;if(u.visualEffect||u.protectorBeam||u.battleProtectorBeam)return 'effect';if(shipRoots.has(p))return occluders.has(mesh)?'':'ship';}return 'world';}
 function release(m){const e=owners.get(m);if(!e){m.dispose();return;}if(--e.refs>0)return;owners.delete(m);const byState=shared.get(e.state);const byMaterial=byState.get(e.key);byMaterial.delete(e.kind);if(!byMaterial.size)byState.delete(e.key);if(!byState.size)shared.delete(e.state);m.dispose();}
 function attach(mesh,state){
  if(!mesh.material)return;
  const old=records.get(mesh);if(old&&(mesh.material===old.clones||mesh.material===mesh.userData.fadeMaterial))return;
  if(old){for(const m of [].concat(old.clones))release(m);records.delete(mesh);}
  const original=mesh.material;
  // Enemy darkening keeps form: the dark tint scales with a contrast curve on the lit luminance (lit faces, tile
  // and course lines stay apart instead of collapsing into one mauve value after the 5-bit post pass), and lit
  // materials add a faint violet rim on faces seen edge-on, so steps, slits and gate leaves keep their edges.
  const make=m=>{const next=m.clone(),hook=m.onBeforeCompile;next.onBeforeCompile=function(shader){
   hook.call(m,shader);shader.uniforms.allegianceDark={get value(){return state.dark;}};
   shader.uniforms.allegianceGlow={get value(){return state.glow;}};
   shader.fragmentShader='uniform float allegianceDark; uniform float allegianceGlow;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
    float allegianceLum=dot(gl_FragColor.rgb,vec3(.3,.59,.11));vec3 allegianceShade=gl_FragColor.rgb*vec3(.16,.105,.24)*min(2.4,pow(max(allegianceLum,1e-4)/.35,.7))+vec3(.009,.003,.02);
    #ifdef STANDARD
    float allegianceRim=1.-clamp(dot(normal,isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition)),0.,1.);allegianceRim*=allegianceRim;allegianceShade+=vec3(.15,.07,.3)*allegianceRim*allegianceRim*.35;
    #endif
    gl_FragColor.rgb=mix(gl_FragColor.rgb,allegianceShade,allegianceDark);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*vec3(.72,1.08,1.06)+vec3(.025,.10,.075),allegianceGlow);
    #include <tonemapping_fragment>`);
  };next.customProgramCacheKey=()=>m.customProgramCacheKey()+'-allegiance-v2';return next;};
  const kind=group(mesh),clone=m=>{if(m.transparent||!kind)return make(m);let byState=shared.get(state);if(!byState)shared.set(state,byState=new Map());let byMaterial=byState.get(m);if(!byMaterial)byState.set(m,byMaterial=new Map());let e=byMaterial.get(kind);if(!e){e={state,key:m,kind,clone:make(m),refs:0};byMaterial.set(kind,e);owners.set(e.clone,e);}e.refs++;return e.clone;};
  mesh.material=Array.isArray(original)?original.map(clone):clone(original);records.set(mesh,{original,clones:mesh.material});
 }
 const castles=world.castles.map((_,team)=>({dark:team!==viewerTeam()?1:0,glow:team===viewerTeam()?.25:0}));
 const glitchRoot=new T.Group();glitchRoot.name='Silo ownership atmosphere';world.arena?.parent?.add(glitchRoot);
 const glitch=world.orbTowers.map(o=>{const material=new T.MeshBasicMaterial({color:0x9b63d9,transparent:true,opacity:0,depthWrite:false});const bits=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,48);bits.frustumCulled=false;glitchRoot.add(bits);const haze=new T.Mesh(new T.CylinderGeometry(35,35,.25,48),new T.MeshBasicMaterial({color:0x10051f,transparent:true,opacity:0,depthWrite:false}));haze.position.set(o.x,(o.y||0)+.18,o.z);glitchRoot.add(haze);return {bits,haze};});
 const dummy=new T.Object3D(),bounds=new T.Box3(),part=new T.Box3(),instance=new T.Matrix4(),centre=new T.Vector3(),size=new T.Vector3();
 // World box of a mesh into centre/size (instanced meshes: the union over their instances); false without geometry bounds.
 function within(mesh){const g=mesh.geometry;g.computeBoundingBox();if(!g.boundingBox||g.boundingBox.isEmpty())return false;if(mesh.isInstancedMesh){bounds.makeEmpty();for(let k=0;k<mesh.count;k++){mesh.getMatrixAt(k,instance);bounds.union(part.copy(g.boundingBox).applyMatrix4(instance.premultiply(mesh.matrixWorld)));}}else bounds.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld);bounds.getCenter(centre);bounds.getSize(size);return !bounds.isEmpty();}
 function sync(){
  const present=new Set();shipRoots=new Set((world.harbors||[]).flatMap(h=>(h.ships||[]).map(s=>s.root)));occluders=new Set(world.occluders||[]);
  const walk=(root,state)=>root?.traverse(mesh=>{if(mesh.material){present.add(mesh);attach(mesh,state);}});
  world.castles.forEach((root,i)=>walk(root,castles[i]));
  world.orbTowers.forEach((o,i)=>[].concat(o.structureRoot||o.root).forEach(root=>walk(root,states[i])));
  // Ground and vegetation are siblings of the authored tower structure. A mesh joins a silo only when its whole world
  // box (every instance, for instanced meshes) fits that silo's radius: the ring, its grass, trees and trim are single
  // meshes centred on the Crown, and must not take the Crown owner's look.
  world.arena?.updateWorldMatrix(true,true);
  world.arena?.traverse(mesh=>{if(!mesh.material||!mesh.geometry)return;if(!within(mesh))return;const i=world.orbTowers.findIndex((o,j)=>{const r=j===4?31:39;return Math.max(size.x,size.z)<=2*r&&Math.hypot(centre.x-o.x,centre.z-o.z)<r;});if(i>=0){present.add(mesh);attach(mesh,states[i]);}});
  for(const [mesh,r] of records)if(!present.has(mesh)){mesh.material=r.original;for(const m of [].concat(r.clones))release(m);records.delete(mesh);}
 }
 function update(dt,objectives=[]){
  time+=Math.max(0,Math.min(dt,.1));
  const viewer=viewerTeam();for(let i=0;i<castles.length;i++){const s=castles[i];s.dark=i!==viewer?1:0;s.glow=i===viewer?.25:0;}
  const rate=1-Math.exp(-Math.max(0,Math.min(dt,.1))*1.6);
  for(let i=0;i<states.length;i++){const s=states[i],owner=objectives[i]?.owner??-1,dark=owner>=0&&owner!==viewer?1:0,glow=owner===viewer?1:0;s.dark+=(dark-s.dark)*rate;s.glow+=(glow-s.glow)*rate;}
  for(let i=0;i<glitch.length;i++){const v=glitch[i],strength=states[i].dark,o=world.orbTowers[i];v.bits.visible=strength>.015;v.bits.material.opacity=strength*.8;v.haze.material.opacity=strength*.62;v.haze.visible=strength>.001;if(!v.bits.visible)continue;for(let j=0;j<48;j++){const phase=j*2.399+Math.floor(time*(3+j%4))*.05,r=12+(j%7)*3.5;dummy.position.set(o.x+Math.cos(phase)*r,(o.y||0)+2+((time*(2+j%3)+j*1.91)%25),o.z+Math.sin(phase)*r);dummy.rotation.set(0,j,0);const flicker=Math.sin(time*(18+j%9)+j)>-.25;dummy.scale.set(flicker?1.4+j%3*.5:.08,.12+j%4*.1,.4);dummy.updateMatrix();v.bits.setMatrixAt(j,dummy.matrix);}v.bits.instanceMatrix.needsUpdate=true;}
 }
 sync();
 return {sync,update,snapshot:()=>({castles:castles.map(s=>({...s})),silos:states.map(s=>({...s})),meshes:records.size,sharedMaterials:owners.size,glitchParticles:glitch.map((v,i)=>({visible:v.bits.visible,strength:states[i].dark,count:48}))})};
}
