import * as T from './vendor/three.module.js';
import {inspectCastle,derivedObjectives} from './game/castle-navigation.js';
import {inspectCastleFootprint} from './game/castle-footprint.js';
import {cellPosition} from './game/castle-rules.js';
import {COSTS} from './loop.js';
export async function validateCastle(construction,layout,config){
 const core=layout.find(p=>p.type==='core'),spawn=layout.find(p=>p.type==='spawn'),issues=[];
 if(layout.filter(p=>p.type==='core').length!==1)issues.push({code:'main-core',message:'Exactly one main core is required.',cell:core});
 if(!spawn)issues.push({code:'spawn',message:'Place an arrival court on a supported route.'});
 if(layout.some(p=>!COSTS[p.type]||p.layer>2))issues.push({code:'parts',message:'Use the available compact-plot parts and three layers.'});
 if(issues.length)return {ok:false,issues,routes:[],summary:issues.map(p=>p.message).join(' ')};
 let built;try{
  built=construction.preview(0,layout,config);const c=cellPosition(core),objectives=[{id:'core',label:'Main core approach',x:c.x+3.3,y:c.y,z:c.z,cell:core},...layout.filter(p=>p.type==='gate').map((p,i)=>({...cellPosition(p),cell:p,id:'gate'+i,label:'Required gate '+(i+1)})),...derivedObjectives(layout).filter(p=>p.id!=='court'),...weaponObjectives(built.root)];
  const result=await inspectCastle(built,layout,config,{entrance:cellPosition(spawn),objectives}),structure=inspectCastleFootprint(layout);result.issues.push(...structure.issues);result.ok=result.ok&&structure.ok;if(!result.ok)result.summary=result.issues.length+' castle problems need repair.';return result;
 }catch(e){return {ok:false,issues:[{code:'definition',message:e.message}],routes:[],summary:e.message};}finally{built?.dispose();}
}

function weaponObjectives(root){const out=[];root.updateMatrixWorld(true);root.traverse(o=>{if(!o.sketchRig||!o.userData.defense)return;const p=o.userData.cell,entry=o.userData.defense.entry||[3,0,0],point=o.localToWorld(new T.Vector3(...entry));out.push({id:'weapon-'+p.x+':'+p.z+':'+p.layer,label:p.type==='tower'?'Armed watchtower roof':'Weapon operator approach',x:point.x,y:point.y,z:point.z,cell:{...p}});});return out;}
