import * as T from '../vendor/three.module.js';
// Assemble actual planned pieces before navigation starts. Never alter saved layouts.
// Presentation only: cliff/terrain extras rise from their own base with progress instead of
// appearing as a full-height slab, and a small pooled dust/sparkle burst marks the active layer.
export function castleBuildSequence(castles,plans,hearts=[]){
 const entries=[],extras=[],box=new T.Box3();
 castles.forEach((castle,team)=>{
  if(plans?.[team]?.source!=='ai')return;
  const root=castle.children.find(g=>g.userData.profile);
  if(!root)return;
  for(const mesh of root.children.filter(g=>!g.userData.cell)){const start=mesh.isInstancedMesh?.86:mesh.position.y>5?.12:0,grow=!mesh.isInstancedMesh&&!!mesh.geometry;let base=0;if(grow){mesh.geometry.computeBoundingBox?.();base=mesh.geometry.boundingBox?mesh.geometry.boundingBox.min.y:0;}
   extras.push({mesh,visible:mesh.visible,start,grow,base,scale:mesh.scale.clone(),y:mesh.position.y});mesh.visible=false;}
  if(hearts[team]?.root){const mesh=hearts[team].root;extras.push({mesh,visible:mesh.visible,start:.94,grow:false});mesh.visible=false;}
  const parts=root.children.filter(g=>g.userData.cell);
  // Each storey rises symmetrically: the main axis first, then outward pairs, front to back.
  const xs=parts.map(g=>g.userData.cell.x).sort((a,b)=>a-b),axis=plans[team].design?.axis??plans[team].anchors?.main?.x??(xs.length?(xs[0]+xs.at(-1))/2:0),spread=g=>Math.abs(g.userData.cell.x-axis);
  parts.sort((a,b)=>a.userData.cell.layer-b.userData.cell.layer||priority(a)-priority(b)||spread(a)-spread(b)||b.userData.cell.z-a.userData.cell.z);
  parts.forEach((mesh,index)=>{entries.push({mesh,team,index,total:parts.length,scale:mesh.scale.clone(),visible:mesh.visible});mesh.visible=false;});
 });
 // Progress values where a castle's next storey begins (the first piece of each
 // layer half shown; stops closer than 2% merge), so a frame-paced raise can stop on every tier.
 const stops=[];{const first=new Map();for(const e of entries){const k=e.team+':'+e.mesh.userData.cell.layer;if(!first.has(k))first.set(k,e);}const all=[...first.values()].map(e=>(e.index+.5)/(e.total+5)).sort((a,b)=>a-b);for(const s of all)if(!stops.length||s-stops.at(-1)>.02)stops.push(s);}
 function priority(g){const type=g.userData.cell.type||'';return /terrace|floor|support/.test(type)?0:/stair|ramp/.test(type)?1:/wall|gate/.test(type)?2:3;}
 // Construction dust: one instanced pool, created only when something is being assembled.
 const POOL=48,dust=entries.length?new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,depthWrite:false}),POOL):null,motes=[],dummy=new T.Object3D(),tones=[new T.Color(0xfff1c4),new T.Color(0xd9ccb0),new T.Color(0xffe08a)];
 // The dust pool's first draw hands over the renderer: warm() then compiles the
 // castles' shader programs once, into the same render target (its encoding is part
 // of each program), while every piece is still hidden, instead of stalling the
 // frames in which new storeys first appear.
 let view=null,warmed=false;
 function warm(){if(warmed||!view)return false;warmed=true;const r=view.renderer,prev=r.getRenderTarget();try{r.setRenderTarget(view.target);r.compile(view.scene,view.camera);}catch(err){console.warn('Castle shader warm-up skipped:',err?.message||err);}finally{r.setRenderTarget(prev);}return true;}
 if(dust){dust.onBeforeRender=(renderer,scene,camera)=>{if(!view)view={renderer,scene,camera,target:renderer.getRenderTarget()};};dust.name='Castle assembly dust';dust.frustumCulled=false;dust.userData.visualEffect=true;dust.instanceMatrix.setUsage(T.DynamicDrawUsage);for(let i=0;i<POOL;i++){motes.push({born:-9,x:0,y:0,z:0,kind:i%3});dust.setColorAt(i,tones[i%3]);}(castles[0]?.parent)?.add(dust);}
 let spawnIndex=0,lastProgress=0;
 function emit(e,progress){const m=motes[spawnIndex++%POOL];if(!e.box){box.setFromObject(e.mesh);e.box={x:(box.min.x+box.max.x)/2,y:box.max.y,z:(box.min.z+box.max.z)/2,w:Math.max(1,box.max.x-box.min.x),d:Math.max(1,box.max.z-box.min.z)};}
  const r=Math.sin(spawnIndex*12.9898)*43758.5453,f=r-Math.floor(r),g=(f*7.31)%1;m.born=progress;m.x=e.box.x+(f-.5)*e.box.w*.8;m.z=e.box.z+(g-.5)*e.box.d*.8;m.y=e.box.y-1;}
 function animateDust(progress){if(!dust)return;for(let i=0;i<POOL;i++){const m=motes[i],age=(progress-m.born)*7,alive=age>=0&&age<1;dummy.position.set(m.x+(m.kind-1)*age*.8,m.y+age*(m.kind===1?2.2:4),m.z);dummy.rotation.set(age*3,i,age*2);dummy.scale.setScalar(alive?(m.kind===1?.9:.32)*(1-age*.7):0);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}dust.instanceMatrix.needsUpdate=true;}
 function advance(progress){
  progress=Math.max(0,Math.min(1,progress));let count=0,layer=0,emitted=0;const fresh=progress-lastProgress>.004;
  for(const e of entries){const local=progress*(e.total+5)-e.index;const shown=local>0;e.mesh.visible=shown&&e.visible;e.mesh.scale.copy(e.scale);if(shown){e.mesh.scale.y*=Math.min(1,Math.max(.03,local/5));count++;if(e.mesh.userData.cell.layer>layer)layer=e.mesh.userData.cell.layer;if(fresh&&local<5&&emitted<2&&(e.index+Math.floor(progress*400))%5===0){emit(e,progress);emitted++;}}}
  for(const e of extras){const shown=e.visible&&progress>=e.start;e.mesh.visible=shown;if(!e.grow)continue;const k=Math.min(1,Math.max(.03,(progress-e.start)/.3)),s=k*k*(3-2*k);e.mesh.scale.copy(e.scale);e.mesh.scale.y*=Math.max(.03,s);e.mesh.position.y=e.y+e.base*e.scale.y*(1-Math.max(.03,s));}
  if(fresh)lastProgress=progress;animateDust(progress);
  return {placed:count,total:entries.length,layer};
 }
 function finish(){view=null;for(const e of extras){e.mesh.visible=e.visible;if(e.grow){e.mesh.scale.copy(e.scale);e.mesh.position.y=e.y;}}for(const e of entries){e.mesh.visible=e.visible;e.mesh.scale.copy(e.scale);}
  if(dust){dust.parent?.remove(dust);dust.geometry.dispose();dust.material.dispose();dust.dispose?.();}}
 return {advance,finish,warm,stops,total:entries.length};
}
