import * as T from '../vendor/three.module.js';
export function createBattleSpawns({world,navigation,actors,objectives,getCombat}){
 let selected='castle-0-0';
 function points(team=0){
  const c=getCombat(),pad=world.pads[team],out=[];
  if(c?.state.cores[team]>0&&world.castles[team].visible){
   out.push({id:'castle-'+team+'-0',label:'Castle · First landing',...pad});
   const planned=[];world.castles[team].updateWorldMatrix(true,true);world.castles[team].traverse(g=>{if(!g.userData.spawnPoint)return;for(let o=g;o;o=o.parent)if(!o.visible)return;const p=g.getWorldPosition(new T.Vector3()),n=navigation.nearest?.(p,3);if(n&&Math.abs(n.y-p.y)<1)planned.push(n);});
   const nodes=planned.length?planned:(navigation.nodes||[]).filter(n=>n.y>=pad.y-1&&Math.hypot(n.x-pad.x,n.z-pad.z)<100).sort((a,b)=>b.y-a.y);
   for(const n of nodes){if(out.length===4)break;if(out.every(p=>Math.hypot(p.x-n.x,p.z-n.z)>22))out.push({...n,id:'castle-'+team+'-'+out.length,label:'Castle · Terrace '+out.length});if(out.length===4)break;}
  }
  for(const o of objectives)if(o.owner===team&&!o.contested){for(let i=0;i<2;i++){const node=navigation.nearest?.({x:o.x+(i?7:-7),y:o.y,z:o.z+3},5);if(node)out.push({...node,id:'silo-'+o.id+'-'+i,label:o.label+(i?' · Approach':' · Landing')});}}
  return out.filter(p=>!actors.some(a=>a.alive&&a.team!==team&&Math.hypot(a.state.x-p.x,a.state.y-p.y,a.state.z-p.z)<12));
 }
 function select(id){if(!points(0).some(p=>p.id===id))return false;selected=id;return true;}
 function place(actor){
  const choices=points(actor.team),friendly=choices.filter(p=>p.id.startsWith('silo')),p=actor.human?choices.find(p=>p.id===selected)||choices[0]:friendly.length&&actor.ordinal%3===2?friendly[(actor.ordinal||0)%friendly.length]:choices.length>1&&actor.ordinal%3===1?choices[1+(actor.ordinal||0)%(choices.length-1)]:choices[0];
  if(!p)return false;Object.assign(actor.state,{x:p.x,y:p.y+.12,z:p.z,vx:0,vy:0,vz:0,grounded:true,flight:false,manual:false});actor.path=[];actor.pathIndex=0;actor.spawnPending=!actor.human&&p.id.endsWith('-0')&&p.id.startsWith('castle');return true;
 }
 return {points,select,place,reset(){selected='castle-0-0';},get selected(){return selected;}};
}
