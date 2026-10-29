import {MAX_PARTS,cellPosition} from '../floating-castle/castle-rules.js';
import {inspectCastle} from '../floating-castle/castle-navigation.js';
import {protectorReport} from '../floating-castle/castle-protectors.js';
import {captureOriginalGoals} from './navigation-goal-snapshot.mjs';
import {connectGroundPorts} from './ground-court-connectors.mjs';
import {proposeCourtStairs} from './court-access-repair.mjs';
import {proposeGalleryBridges} from './court-gallery-bridges.mjs';
import {proposeBeamGateways} from './beam-gateway-proposals.mjs';
import {proposeGatewayAccess} from './beam-gateway-access.mjs';
export async function repairCastlePrototype(plan,construction,{home=0,maxChecks=12,maxRepairs=4}={}){
 const original=plan.layout.map(p=>({...p})),goals=captureOriginalGoals(original),checks=[],witnesses=[],seen=new Set();let attempts=0;
 function remember(result){for(const r of result.navigation.routes.filter(r=>r.ok)){const p=r.points.at(-1),k=JSON.stringify(p);if(!p||seen.has(k))continue;seen.add(k);witnesses.push({id:'witness-'+witnesses.length,label:'Previously walked endpoint',...p});}}
 function additionGoals(pieces){return pieces.map(p=>({id:'new-'+[p.x,p.z,p.layer,p.type,p.rotation].join(':'),label:'New '+p.type+' access',...cellPosition(p),y:cellPosition(p).y+(p.type==='stairs'?4:0)}));}
 async function check(layout,changes,label){if(attempts>=maxChecks||layout.length>MAX_PARTS)return null;attempts++;let view;try{view=construction.preview(home,layout,plan.options);const network=protectorReport(view.links),gateways=network.blocked?proposeBeamGateways(view,layout):[];if(network.blocked&&label!=='original'){checks.push({label,parts:layout.length,blockedBeams:network.blocked,walkingSkipped:true});return {layout,changes,network,gateways,navigation:null};}
  const navigation=await inspectCastle(view,layout,plan.options,{objectives:[...goals,...witnesses,...additionGoals(changes)]}),routes=navigation.routes.filter(r=>r.id.startsWith('original-'));checks.push({label,parts:layout.length,blockedBeams:network.blocked,originalReached:routes.filter(r=>r.ok).length,originalTotal:routes.length,routes:navigation.reachable,total:navigation.total});return {layout,changes,network,gateways,navigation,routes};
 }catch(error){checks.push({label,rejected:error.message});return null;}finally{view?.dispose();}}
 let current=await check(original,[],'original');if(!current?.navigation)throw Error('Original proposal could not be inspected');const baseline=current;
 if(current.navigation.ok&&current.network.blocked===0)return {...current,baseline,checks,unchanged:true};remember(current);
 function acceptable(next){return next?.navigation&&next.network.blocked===0&&next.routes.length===goals.length&&current.routes.filter(r=>r.ok).every(r=>next.routes.some(q=>q.id===r.id&&q.ok))&&next.navigation.routes.filter(r=>r.id.startsWith('witness-')||r.id.startsWith('new-')).every(r=>r.ok)&&current.routes.some(r=>!r.ok&&next.routes.some(q=>q.id===r.id&&q.ok));}
 try{const p=connectGroundPorts(current.layout,plan.options),next=await check(p.layout,p.changes,'ground-passages');if(acceptable(next)){current=next;remember(current);}}catch(error){checks.push({label:'ground-plan',rejected:error.message});}
 for(let round=0;round<maxRepairs&&!current.navigation.ok&&attempts<maxChecks;round++){
  const failed=goals.filter(g=>!current.routes.find(r=>r.id===g.id).ok),routeFailures=current.routes.filter(r=>!r.ok).map(r=>({...r,id:r.id.replace(/^original-/, '')})),proposals=[...proposeCourtStairs(current.layout,routeFailures).map(p=>({pieces:[p.stair],label:'stair'})),...failed.flatMap(g=>proposeGalleryBridges(current.layout,g)).map(p=>({pieces:p.pieces,label:'gallery'}))];let improved=false;
  for(const p of proposals){if(attempts>=maxChecks)break;const additions=[...current.changes,...p.pieces],layout=[...current.layout,...p.pieces],next=await check(layout,additions,p.label);
   if(acceptable(next)){current=next;remember(current);improved=true;break;}
   if(next?.network.blocked)for(const gate of next.gateways){const gated=[...layout,gate.piece],accesses=proposeGatewayAccess(gated,gate.piece);for(const access of accesses.length?accesses.slice(0,4):[{pieces:[]}]){const pieces=[gate.piece,...access.pieces],complete=await check([...gated,...access.pieces],[...additions,...pieces],'gallery-gateway-access');if(acceptable(complete)){current=complete;remember(current);improved=true;break;}}if(improved||attempts>=maxChecks)break;}
   if(improved)break;
  }if(!improved)break;
 }
 return {...current,baseline,checks,unchanged:current.changes.length===0};
}
