// Assemble actual planned pieces before navigation starts. Never alter saved layouts.
export function castleBuildSequence(castles,plans,hearts=[]){
 const entries=[],extras=[];
 castles.forEach((castle,team)=>{
  if(plans?.[team]?.source!=='ai')return;
  const root=castle.children.find(g=>g.userData.profile);
  if(!root)return;
  for(const mesh of root.children.filter(g=>!g.userData.cell)){extras.push({mesh,visible:mesh.visible,start:mesh.isInstancedMesh?.86:mesh.position.y>5?.12:0});mesh.visible=false;}
  if(hearts[team]?.root){const mesh=hearts[team].root;extras.push({mesh,visible:mesh.visible,start:.94});mesh.visible=false;}
  const parts=root.children.filter(g=>g.userData.cell);
  parts.sort((a,b)=>a.userData.cell.layer-b.userData.cell.layer||priority(a)-priority(b));
  parts.forEach((mesh,index)=>{entries.push({mesh,team,index,total:parts.length,scale:mesh.scale.clone(),visible:mesh.visible});mesh.visible=false;});
 });
 function priority(g){const type=g.userData.cell.type||'';return /terrace|floor|support/.test(type)?0:/stair|ramp/.test(type)?1:/wall|gate/.test(type)?2:3;}
 function advance(progress){
  progress=Math.max(0,Math.min(1,progress));let count=0,last=null;
  for(const e of entries){const local=progress*(e.total+5)-e.index;const shown=local>0;e.mesh.visible=shown&&e.visible;e.mesh.scale.copy(e.scale);if(shown){e.mesh.scale.y*=Math.min(1,Math.max(.03,local/5));count++;last=e;}}
  for(const e of extras)e.mesh.visible=e.visible&&progress>=e.start;
  return {placed:count,total:entries.length,layer:last?.mesh.userData.cell.layer??0};
 }
 function finish(){for(const e of extras)e.mesh.visible=e.visible;for(const e of entries){e.mesh.visible=e.visible;e.mesh.scale.copy(e.scale);}}
 return {advance,finish,total:entries.length};
}
