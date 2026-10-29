import {cellPosition,MAX_PARTS} from '../floating-castle/castle-rules.js';
import {inspectCastle} from '../floating-castle/castle-navigation.js';
import {protectorReport} from '../floating-castle/castle-protectors.js';
import {connectGroundPorts} from './ground-court-connectors.mjs';
const dirs=[[0,-1],[-1,0],[0,1],[1,0]],key=p=>p.x+':'+p.z+':'+p.layer,column=p=>p.x+':'+p.z;
const floors=new Set(['floor','terrace','deck','battlement']),landings=new Set(['floor','terrace','deck','spawn','garden','cannon','heavyCannon','beacon','protector']);
export function proposeCourtStairs(layout,failedRoutes){
 const cells=new Map(layout.map(p=>[key(p),p])),columns=new Map(),out=new Map();for(const p of layout){if(!columns.has(column(p)))columns.set(column(p),[]);columns.get(column(p)).push(p);}
 for(const route of failedRoutes.filter(r=>!r.ok&&r.id.startsWith('floor-'))){const q=route.objective,first=cells.get(key({x:Math.round(q.x/8+5.5),z:Math.round((q.z+4)/8+5.5),layer:Math.round((q.y-.77)/8)}));if(!first||!floors.has(first.type)||first.footprint==='round')continue;
  const component=[first],seen=new Set([key(first)]);for(let i=0;i<component.length;i++)for(const [dx,dz] of dirs){const p=cells.get(key({...component[i],x:component[i].x+dx,z:component[i].z+dz}));if(p&&floors.has(p.type)&&p.footprint!=='round'&&!seen.has(key(p))){seen.add(key(p));component.push(p);}}
  function propose(lower,stair,upper){const middle=columns.get(column(stair));if(cells.has(key(stair))||!middle||!upper||!landings.has(upper.type)||upper.footprint==='round'||stair.layer<0||stair.layer>=9)return;
   if(!middle.some(p=>p.layer>=stair.layer+1)||middle.some(p=>['core','protector'].includes(p.type))||['core','protector'].includes(upper.type))return;
   out.set(key(stair)+':'+stair.rotation,{stair,lower:{...lower},upper:{...upper},failedCourt:route.id});
  }
  for(const lower of component)for(const [rotation,[dx,dz]] of dirs.entries())propose(lower,{x:lower.x+dx,z:lower.z+dz,layer:lower.layer,type:'stairs',rotation},cells.get(key({x:lower.x+dx*2,z:lower.z+dz*2,layer:lower.layer+1})));
  for(const upper of component)for(const [direction,[dx,dz]] of dirs.entries()){const lower=cells.get(key({x:upper.x+dx*2,z:upper.z+dz*2,layer:upper.layer-1}));if(lower&&landings.has(lower.type)&&lower.footprint!=='round')propose(lower,{x:upper.x+dx,z:upper.z+dz,layer:upper.layer-1,type:'stairs',rotation:(direction+2)%4},upper);}

 }
 return [...out.values()].sort((a,b)=>a.stair.layer-b.stair.layer||a.stair.z-b.stair.z||a.stair.x-b.stair.x||a.stair.rotation-b.stair.rotation);
}
export async function repairCourtAccess(plan,construction,home=0,{maxStairChecks=8,maxStairs=3}={}){
 const checks=[],original=plan.layout.map(p=>({...p}));
 async function check(layout,label){const preview=construction.preview(home,layout,plan.options);try{const navigation=await inspectCastle(preview,layout,plan.options),network=protectorReport(preview.links);checks.push({label,parts:layout.length,routes:navigation.reachable,total:navigation.total,blockedBeams:network.blocked});return {layout,navigation,network};}finally{preview.dispose();}}
 let current=await check(original,'original');const baseline=current.navigation;if(current.navigation.ok&&current.network.blocked===0)return {...current,baseline,changes:[],checks,unchanged:true};
 let grounded,candidate;const changes=[];try{grounded=connectGroundPorts(original,plan.options);candidate=await check(grounded.layout,'ground-passages');}catch(error){checks.push({label:'ground-plan-rejected',reason:error.message});}
 function preserves(next,previous){return previous.routes.every(r=>next.routes.some(q=>q.id===r.id&&(!r.ok||q.ok)));}
 function recovers(next,previous){return previous.routes.some(r=>!r.ok&&next.routes.some(q=>q.id===r.id&&q.ok));}
 if(candidate&&candidate.network.blocked===0&&preserves(candidate.navigation,current.navigation)&&recovers(candidate.navigation,current.navigation)){current=candidate;changes.push(...grounded.changes);}
 let tried=0;
 for(let round=0;round<maxStairs&&!current.navigation.ok;round++){
  let improved=false;for(const proposal of proposeCourtStairs(current.layout,current.navigation.routes)){if(tried++>=maxStairChecks||current.layout.length>=MAX_PARTS)break;
   const next=await check([...current.layout,proposal.stair],'stair-'+key(proposal.stair)+':'+proposal.stair.rotation);
   if(next.network.blocked===0&&preserves(next.navigation,current.navigation)&&recovers(next.navigation,current.navigation)){current=next;changes.push(proposal.stair);improved=true;break;}
  }if(!improved||tried>=maxStairChecks)break;
 }
 return {...current,baseline,changes,checks,unchanged:changes.length===0};
}
