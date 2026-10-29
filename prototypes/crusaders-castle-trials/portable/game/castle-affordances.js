import {inspectCastleFootprint} from './castle-footprint.js';
import {protectorReport} from './castle-protectors.js';
import * as T from '../vendor/three.module.js';
import {profile,cellPosition,containsCell,MAX_PARTS} from './castle-rules.js';
import {DEFENSE_RULES} from './castle-defense.js';

const walk=['spawn','floor','deck','terrace','roundTerrace','curvedWall','gate','stairs','garden','battlement','cannon','heavyCannon','trebuchet','beacon','protector','spawn'];
const cover={house:5.4,wall:7.4,curvedWall:7.4,gate:6.8,tower:8,embankment:3.7,battlement:2.3};
const types=['floor','deck','terrace','roundTerrace','curvedWall','embankment','wall','gate','tower','stairs','garden','roof','battlement','cannon','heavyCannon','trebuchet','beacon','core','protector','spawn','house'];
export const PART_AFFORDANCES=Object.freeze(Object.fromEntries(types.map(type=>[type,Object.freeze({
 type,walkable:walk.includes(type),deck:type==='deck',gate:type==='gate',stair:type==='stairs',coverHeight:cover[type]||0,
 round:type==='roundTerrace'||type==='curvedWall',structure:!['garden','cannon','heavyCannon','trebuchet','beacon'].includes(type),
 status:'active',defense:DEFENSE_RULES[type]?Object.freeze({status:'prototype',scope:'Local battle and practice',usable:true,matchCombat:'active',manual:true,range:DEFENSE_RULES[type].range,cooldown:DEFENSE_RULES[type].cooldown}):null
})])));
export const PLANNED_CAPABILITIES=Object.freeze([{id:'rank-unlocks',label:'Rank and performance unlocks',status:'planned',usable:false}].map(Object.freeze));
export function partAffordance(piece){const base=PART_AFFORDANCES[typeof piece==='string'?piece:piece?.type];return base?{...base,round:base.round||piece?.footprint==='round',solidTier:!!piece?.solid||piece?.type==='terrace'||base.round}:null;}
const key=p=>p.x+':'+p.z+':'+p.layer,column=p=>p.x+':'+p.z,dirs=[[0,-1],[-1,0],[0,1],[1,0]],sideNames=['north','west','south','east'];
const normal=r=>dirs[r%4];
function bounded(layout,options){const config=profile(options);if(!Array.isArray(layout)||layout.length>MAX_PARTS)throw new Error('Castle analysis needs a layout within the 720-part limit.');const seen=new Set();const pieces=layout.map(p=>{if(!p||!PART_AFFORDANCES[p.type]||!containsCell(p,config)||!Number.isInteger(p.layer)||p.layer<0||p.layer>9||!Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3||seen.has(key(p)))throw new Error('Castle analysis needs valid unique tile coordinates.');seen.add(key(p));return p;});return {config,pieces};}

// Derived fitting never edits a draft. The renderer and collider builder consume
// the same values; reports explain exactly which neighbouring tile caused a fit.
export function deriveTileFits(layout,options={}){
 const ordered=layout.slice().sort((a,b)=>a.layer-b.layer||a.z-b.z||a.x-b.x),config=profile(options),byCell=new Map(ordered.map(p=>[key(p),p])),columns=new Map(),fits=new Map(),adjustments=[];
 for(const p of ordered){const h=p.layer*8+(cover[p.type]||0),masonry=p.solid||['wall','tower','terrace','roundTerrace','curvedWall'].includes(p.type);if(masonry&&(!columns.has(column(p))||h>columns.get(column(p)).height))columns.set(column(p),{piece:p,height:h});}
 const report=(p,code,message,changes)=>adjustments.push({code,cell:{x:p.x,z:p.z,layer:p.layer,type:p.type},message,changes});
 for(const p of ordered){const fit={rotation:p.rotation,wallExtensions:[0,0],parapetGap:0};
  if(p.type==='embankment'){
   const candidates=dirs.map(([dx,dz],rotation)=>({rotation,neighbor:columns.get((p.x+dx)+':'+(p.z+dz))})).filter(o=>o.neighbor&&o.neighbor.height>p.layer*8+.5&&!['stairs','gate'].includes(o.neighbor.piece.type));
   candidates.sort((a,b)=>b.neighbor.height-a.neighbor.height||Number(b.rotation===p.rotation)-Number(a.rotation===p.rotation)||a.rotation-b.rotation);
   if(candidates.length&&candidates[0].rotation!==p.rotation){fit.rotation=candidates[0].rotation;report(p,'bank-facing','Turned the bank’s high edge toward the adjoining masonry.',{rotation:fit.rotation,neighbor:{...candidates[0].neighbor.piece}});}
  }
  if(p.type==='wall')for(const [i,sign] of [-1,1].entries()){
   const a=p.rotation*Math.PI/2,dx=Math.round(Math.cos(a))*sign,dz=-Math.round(Math.sin(a))*sign,n=byCell.get(key({x:p.x+dx,z:p.z+dz,layer:p.layer}));
   if(n?.type==='tower')fit.wallExtensions[i]=1.95;else if(n?.type==='wall'&&n.rotation%2!==p.rotation%2)fit.wallExtensions[i]=4-(config.material==='wood'?1.6:3.2)/2;
  }
  if(fit.wallExtensions.some(Boolean))report(p,'wall-join','Extended the curtain wall to meet a perpendicular neighbour.',{negative:fit.wallExtensions[0],positive:fit.wallExtensions[1]});
  if(p.type==='battlement'){
   const [dx,dz]=normal(p.rotation),n=byCell.get(key({x:p.x+dx,z:p.z+dz,layer:p.layer})),s=byCell.get(key({x:p.x+dx,z:p.z+dz,layer:p.layer-1}));
   if(s?.type==='stairs'&&normal(s.rotation)[0]===-dx&&normal(s.rotation)[1]===-dz)fit.parapetGap=7.6;
   else if(n?.type==='gate'&&n.rotation%2===p.rotation%2)fit.parapetGap=6;
   if(fit.parapetGap)report(p,'parapet-opening','Opened the parapet where a stair or gate joins this walk.',{width:fit.parapetGap});
  }
  fits.set(key(p),fit);
 }
 return {fits,adjustments};
}

/** Bounded spatial capability analysis. Without preview, coverage is a range
 * estimate. With preview, sampled rays use the actual constructed colliders.
 * Neither form proves walking access: only inspectCastle can establish that. */
export function scanCastle(layout,options={},settings={}){
 const {config,pieces}=bounded(layout,options),columns=new Map(),counts={walkable:0,decks:0,gates:0,stairs:0,cover:0,active:0,prototype:0,planned:PLANNED_CAPABILITIES.length};
 for(const p of pieces){const a=partAffordance(p);if(a.walkable)counts.walkable++;if(a.deck)counts.decks++;if(a.gate)counts.gates++;if(a.stair)counts.stairs++;if(a.coverHeight)counts.cover++;counts.active++;if(a.defense)counts.prototype++;const old=columns.get(column(p));if(!old||p.layer>old.layer)columns.set(column(p),p);}
 const edges=[];for(const p of columns.values())for(let side=0;side<4;side++){
  const [dx,dz]=dirs[side],neighbor=columns.get((p.x+dx)+':'+(p.z+dz));if(neighbor&&neighbor.layer>=p.layer)continue;
  const c=cellPosition(p),protectedEdge=!!cover[p.type]||p.solid||['terrace','roundTerrace'].includes(p.type);
  edges.push({cell:{...p},side:sideNames[side],dx,dz,x:c.x+dx*4,z:c.z+dz*4,y:c.y,protected:protectedEdge});
 }
 edges.sort((a,b)=>a.side.localeCompare(b.side)||a.cell.layer-b.cell.layer||a.cell.z-b.cell.z||a.cell.x-b.cell.x);
 const sampled=[];for(let i=0;i<Math.min(64,edges.length);i++)sampled.push(edges[Math.floor(i*edges.length/Math.min(64,edges.length))]);
 const preview=settings.preview,emitters=[],ray=new T.Raycaster(),from=new T.Vector3(),to=new T.Vector3(),delta=new T.Vector3(),forward=new T.Vector3();
 const geometry=[];if(preview){preview.root.updateMatrixWorld(true);for(const mesh of preview.colliders){mesh.geometry.computeBoundingBox();geometry.push({mesh,box:mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)});}preview.root.traverse(group=>{
  if(!group.userData.defense||group.userData.solidTerrace)return;const p=group.userData.cell,rules=DEFENSE_RULES[p?.type];if(!rules)return;const self=new Set();group.traverse(o=>{if(!o.userData.floorDepth)self.add(o);});emitters.push({cell:{...p},group,self,muzzle:group.userData.defense.muzzle,direction:group.userData.defense.direction,rules});
 });}else for(const p of pieces)if(DEFENSE_RULES[p.type]){const c=cellPosition(p),a=p.rotation*Math.PI/2;emitters.push({cell:{...p},position:new T.Vector3(c.x+Math.sin(a)*3,c.y+3,c.z+Math.cos(a)*3),forward:new T.Vector3(Math.sin(a),0,Math.cos(a)),rules:DEFENSE_RULES[p.type]});}
 emitters.sort((a,b)=>b.cell.layer-a.cell.layer||a.cell.z-b.cell.z||a.cell.x-b.cell.x);const used=emitters.slice(0,24),sectors=Object.fromEntries(sideNames.map(side=>[side,{samples:0,covered:0,protected:0}]));let covered=0,rayTests=0;
 for(const edge of sampled){const sector=sectors[edge.side];sector.samples++;if(edge.protected)sector.protected++;edge.covered=false;
  for(const w of used){if(preview){from.fromArray(w.muzzle).applyMatrix4(w.group.matrixWorld);forward.fromArray(w.direction).transformDirection(w.group.matrixWorld);}else{from.copy(w.position);forward.copy(w.forward);}
   to.set(edge.x+edge.dx*24,edge.y+2.4,edge.z+edge.dz*24);delta.subVectors(to,from);const distance=delta.length();if(distance>w.rules.range||distance<.1||delta.clone().normalize().dot(forward)<=-.15)continue;
   let blocked=false;if(preview){ray.set(from,delta.multiplyScalar(1/distance));ray.near=.08;ray.far=distance-.1;rayTests++;const candidates=geometry.filter(e=>!w.self.has(e.mesh)&&ray.ray.intersectsBox(e.box)).map(e=>e.mesh);blocked=ray.intersectObjects(candidates,false).length>0;}
   if(!blocked){edge.covered=true;edge.weapon={...w.cell};covered++;sector.covered++;break;}
  }
 }
 for(const s of Object.values(sectors))s.coverage=s.samples?Math.round(s.covered/s.samples*100):0;
 const coverage=sampled.length?Math.round(covered/sampled.length*100):0,protection=edges.length?Math.round(edges.filter(e=>e.protected).length/edges.length*100):0;
 return {placement:inspectCastleFootprint(pieces),protectors:protectorReport(preview?.links||[]),scope:'Spatial planning evidence, not PvP balance or walking proof.',profile:{...config},counts,perimeter:{edges:edges.length,sampled:sampled.length,protectedPercent:protection,sectors,samples:sampled},defenses:{pieces:emitters.length,sampledEmitters:used.length,omittedEmitters:Math.max(0,emitters.length-used.length),coverage,verified:!!preview,method:preview?'Sampled real-mesh line of sight':'Range estimate without obstacle checks',status:'prototype',scope:'Automatic match fire and manual entry; local simulation',rayTests},mobility:{walkablePieces:counts.walkable,gates:counts.gates,decks:counts.decks,stairs:counts.stairs,physicallyChecked:false},planned:PLANNED_CAPABILITIES.map(p=>({...p})),fitting:deriveTileFits(pieces,options).adjustments};
}
