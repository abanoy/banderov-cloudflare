import * as T from '../vendor/three.module.js';
export function createBattleSpawns({world,navigation,actors,objectives,getCombat}){
 // lastPlaced describes the human's latest placement; fallback is true when the chosen point was gone (lost/contested silo or foes on it).
 let selected='castle-0-0',selectedLabel='Castle · First landing';const lastPlaced={id:'',label:'',fallback:false,wanted:'',wantedLabel:'',reason:''};
 // Without planned spawn pieces, castle terraces come only from the pad's walking component: nodes near the pad (closest first,
 // not highest) each get one walking route back to the pad per route graph. Until that check is done the castle offers its pad
 // alone; a terrace that only looked close (a cut-off top court) kept a bot idle with no route for a whole match (D4-1).
 const terraces=[{rev:-1,nodes:[],busy:false},{rev:-1,nodes:[],busy:false}];
 function walkingTerraces(team,pad){const t=terraces[team],rev=navigation.stats?.revision??0;if(t.rev===rev)return t.nodes;if(!t.busy&&navigation.ready&&navigation.path){t.busy=true;void verifyTerraces(t,pad,rev).catch(()=>{}).finally(()=>{t.busy=false;});}return [];}
 async function verifyTerraces(t,pad,rev){
  const near=(navigation.nodes||[]).filter(n=>n.y>=pad.y-1&&Math.hypot(n.x-pad.x,n.z-pad.z)<100).sort((a,b)=>Math.hypot(a.x-pad.x,a.y-pad.y,a.z-pad.z)-Math.hypot(b.x-pad.x,b.y-pad.y,b.z-pad.z)),picked=[],ok=[];
  for(const n of near){if(Math.hypot(n.x-pad.x,n.z-pad.z)>22&&picked.every(p=>Math.hypot(p.x-n.x,p.z-n.z)>22))picked.push(n);if(picked.length===6)break;}
  for(const n of picked){if(ok.length===3)break;const route=await navigation.path(n,{x:pad.x,y:pad.y,z:pad.z,radius:4},{walkingOnly:true,maxMs:250,maxVisited:4000,smooth:false});if((navigation.stats?.revision??0)!==rev)return;if(route.reachable)ok.push(n);}
  t.rev=rev;t.nodes=ok;}
 function points(team=0){
  const c=getCombat(),pad=world.pads[team],out=[];
  if(c?.state.cores[team]>0&&world.castles[team].visible){
   out.push({id:'castle-'+team+'-0',label:'Castle · First landing',...pad});
   const planned=[];world.castles[team].updateWorldMatrix(true,true);world.castles[team].traverse(g=>{if(!g.userData.spawnPoint)return;for(let o=g;o;o=o.parent)if(!o.visible)return;const p=g.getWorldPosition(new T.Vector3()),n=navigation.nearest?.(p,3);if(n&&Math.abs(n.y-p.y)<1)planned.push(n);});
   const nodes=planned.length?planned:walkingTerraces(team,pad);
   for(const n of nodes){if(out.length===4)break;if(out.every(p=>Math.hypot(p.x-n.x,p.z-n.z)>22))out.push({...n,id:'castle-'+team+'-'+out.length,label:'Castle · Terrace '+out.length});if(out.length===4)break;}
  }
  for(const o of objectives)if(o.owner===team&&!o.contested){for(let i=0;i<2;i++){const node=navigation.nearest?.({x:o.x+(i?7:-7),y:o.y,z:o.z+3},5);if(node)out.push({...node,id:'silo-'+o.id+'-'+i,label:o.label+(i?' · Approach':' · Landing')});}}
  return out.filter(p=>!actors.some(a=>a.alive&&a.team!==team&&Math.hypot(a.state.x-p.x,a.state.y-p.y,a.state.z-p.z)<12));
 }
 function select(id){const p=points(0).find(p=>p.id===id);if(!p)return false;selected=id;selectedLabel=p.label;return true;}
 // Why a selected point is missing: its silo changed hands, is contested, or foes stand on it.
 function lostReason(id,team){if(!id.startsWith('silo-'))return 'unsafe';const o=objectives.find(o=>o.id===Number(id.split('-')[1]));return !o||o.owner!==team?'lost':o.contested?'contested':'unsafe';}
 // Terrace bots (ordinal%3===1) walk out from the pad when no checked terrace is open, as from a terrace: no pod launch, so a
 // 4v4 ordinal 1 is never seated as a lone crew-ship pilot waiting at port for crew that cannot come.
 function place(actor){
  const choices=points(actor.team),friendly=choices.filter(p=>p.id.startsWith('silo')),p=actor.human?choices.find(p=>p.id===selected)||choices[0]:friendly.length&&actor.ordinal%3===2?friendly[(actor.ordinal||0)%friendly.length]:choices.length>1&&actor.ordinal%3===1?choices[1+(actor.ordinal||0)%(choices.length-1)]:choices[0];
  if(!p)return false;if(actor.human){const fell=p.id!==selected;lastPlaced.id=p.id;lastPlaced.label=p.label;lastPlaced.fallback=fell;lastPlaced.wanted=selected;lastPlaced.wantedLabel=selected.startsWith('silo-')?(objectives.find(o=>o.id===Number(selected.split('-')[1]))?.label||selectedLabel):selectedLabel;lastPlaced.reason=fell?lostReason(selected,actor.team):'';if(fell){selected=p.id;selectedLabel=p.label;}}Object.assign(actor.state,{x:p.x,y:p.y+.12,z:p.z,vx:0,vy:0,vz:0,grounded:true,flight:false,manual:false});actor.path=[];actor.pathIndex=0;actor.spawnPending=!actor.human&&p.id.endsWith('-0')&&p.id.startsWith('castle')&&actor.ordinal%3!==1;return true;
 }
 return {points,select,place,reset(){selected='castle-0-0';selectedLabel='Castle · First landing';lastPlaced.id=lastPlaced.label=lastPlaced.wanted=lastPlaced.wantedLabel=lastPlaced.reason='';lastPlaced.fallback=false;},get selected(){return selected;},get lastPlaced(){return lastPlaced;}};
}
