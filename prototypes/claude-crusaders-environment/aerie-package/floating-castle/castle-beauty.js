// Local composition guidance, not an objective beauty verdict or a combat rule.
// Coordinates may be negative: the assessment follows the layout, not its origin.
import {tierFortifications} from './castle-fortifications.js';
const TYPES=new Set(['floor','deck','terrace','roundTerrace','curvedWall','embankment','wall','battlement','gate','tower','stairs','cannon','heavyCannon','roof','garden','core','beacon','protector','house','spawn']);
const ARCH=new Set(['floor','deck','terrace','roundTerrace','curvedWall','embankment','wall','battlement','gate','tower','stairs','roof','core','beacon','protector','house','spawn']);
const WALK=new Set(['floor','deck','terrace','roundTerrace','battlement','gate','stairs','garden','spawn']);
const BLOCKED=new Set(['house','protector','wall','curvedWall','embankment','battlement','tower','roof','core','beacon','cannon','heavyCannon']);
const DIRECTIONS=[[0,1],[1,0],[0,-1],[-1,0]],ADJACENT=[[1,0],[-1,0],[0,1],[0,-1]];
const FAMILY={house:'form',spawn:'route',protector:'focus',floor:'space',deck:'space',terrace:'space',roundTerrace:'space',curvedWall:'edge',embankment:'edge',wall:'edge',battlement:'edge',gate:'edge',tower:'form',stairs:'route',roof:'form',core:'focus',beacon:'focus'};
const HEIGHT={house:.7,spawn:.1,protector:.5,floor:.1,deck:.1,terrace:.1,roundTerrace:.1,curvedWall:1,embankment:.5,wall:1,battlement:.65,gate:1,tower:1,stairs:1,roof:.6,core:1.6,beacon:.7};
const floor=p=>p.type==='floor'||p.type==='deck'||p.type==='terrace'||p.type==='roundTerrace';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const key=(x,z,layer)=>x+':'+z+':'+layer;

export function assessCastle(layout,options={}){
 const limit=Number.isInteger(options?.layers)?clamp(options.layers,1,10):10;
 const raw=Array.isArray(layout)?layout:[],byCell=new Map();let ignored=0,duplicates=0;
 // Rendering validates ownership and plot bounds. This pure reader independently
 // bounds its work and ignores malformed data, without changing the input.
 const candidates=[];
 for(const p of raw.slice(0,10000)){
  if(!p||!['x','z','layer','rotation'].every(k=>Number.isSafeInteger(p[k]))||p.layer<0||p.layer>=limit||p.rotation<0||p.rotation>3||!TYPES.has(p.type)){ignored++;continue;}
  candidates.push({x:p.x,z:p.z,layer:p.layer,rotation:p.rotation,type:p.type});
 }
 ignored+=Math.max(0,raw.length-10000);
 candidates.sort((a,b)=>a.layer-b.layer||a.z-b.z||a.x-b.x||a.type.localeCompare(b.type)||a.rotation-b.rotation);
 for(const p of candidates){const k=key(p.x,p.z,p.layer);if(byCell.has(k)){duplicates++;continue;}byCell.set(k,p);}
 const pieces=[...byCell.values()],architecture=pieces.filter(p=>ARCH.has(p.type)),gardens=pieces.filter(p=>p.type==='garden');
 const archMap=new Map(architecture.map(p=>[key(p.x,p.z,p.layer),p])),links=new Map([...archMap.keys()].map(k=>[k,new Set()]));
 const get=(x,z,layer)=>byCell.get(key(x,z,layer));
 const planar=p=>ADJACENT.map(([dx,dz])=>get(p.x+dx,p.z+dz,p.layer)).filter(Boolean);
 function join(a,b){if(!a||!b)return;const ak=key(a.x,a.z,a.layer),bk=key(b.x,b.z,b.layer);if(links.has(ak)&&links.has(bk)){links.get(ak).add(bk);links.get(bk).add(ak);}}
 for(const p of architecture){for(const q of planar(p))join(p,q);join(p,get(p.x,p.z,p.layer-1));}
 let connectedStairs=0;
 for(const p of architecture.filter(p=>p.type==='stairs')){
  // The authored stair rises opposite its gate-facing direction; accept only an
  // explicit landing above, and a lower approach (or the shared ground island).
  const [dx,dz]=DIRECTIONS[p.rotation],upper=get(p.x-dx,p.z-dz,p.layer+1),lower=get(p.x+dx,p.z+dz,p.layer);
  if(upper&&WALK.has(upper.type)&&(p.layer===0||lower&&WALK.has(lower.type))){connectedStairs++;join(p,upper);join(p,lower);}
 }
 const visited=new Set(),components=[];
 for(const start of archMap.keys()){
  if(visited.has(start))continue;const queue=[start],members=[];visited.add(start);
  for(let i=0;i<queue.length;i++){const k=queue[i];members.push(archMap.get(k));for(const next of links.get(k)){if(!visited.has(next)){visited.add(next);queue.push(next);}}}
  const families=new Set(members.map(p=>FAMILY[p.type])),floors=members.filter(floor).length;
  components.push({members,coherent:members.length>=4&&(families.size>=2||floors>=4)});
 }
 // Several independently composed wings count equally. There is deliberately no
 // largest-component, mirror-symmetry, central-axis or single-mass requirement.
 const wings=components.filter(c=>c.coherent),integrated=new Set(wings.flatMap(c=>c.members.map(p=>key(p.x,p.z,p.layer))));
 const integratedParts=architecture.filter(p=>integrated.has(key(p.x,p.z,p.layer)));
 const integratedGardens=gardens.filter(p=>planar(p).some(q=>integrated.has(key(q.x,q.z,q.layer))));
 const terraces=wings.filter(c=>c.members.filter(floor).length>=4).length;
 const coherence=25*(integratedParts.length/(architecture.length||1))*clamp(integratedParts.length/10);
 const houses=pieces.filter(p=>p.type==='house'),integratedHouses=houses.filter(p=>planar(p).filter(q=>WALK.has(q.type)).length>=2&&planar(p).some(q=>integrated.has(key(q.x,q.z,q.layer))));
 const planting=10*clamp(integratedGardens.length/3)*(integratedGardens.length/(gardens.length||1))+6*clamp(integratedHouses.length/3)*(integratedHouses.length/(houses.length||1))+4*clamp(terraces);

 const columns=new Map();for(const p of integratedParts){const k=p.x+':'+p.z;columns.set(k,Math.max(columns.get(k)??-Infinity,p.layer+HEIGHT[p.type]));}
 const bands=new Set([...columns.values()].map(h=>Math.round(h*2))),stepped=new Set();
 for(const p of integratedParts){const h=columns.get(p.x+':'+p.z);for(const [dx,dz] of ADJACENT){const q=columns.get((p.x+dx)+':'+(p.z+dz));if(q!==undefined&&Math.abs(h-q)>=.4&&Math.abs(h-q)<=3)stepped.add(p.x+':'+p.z);}}
 const connectedIntegratedStairs=architecture.filter(p=>p.type==='stairs'&&integrated.has(key(p.x,p.z,p.layer))).filter(p=>{const [dx,dz]=DIRECTIONS[p.rotation],upper=get(p.x-dx,p.z-dz,p.layer+1),lower=get(p.x+dx,p.z+dz,p.layer);return upper&&WALK.has(upper.type)&&(p.layer===0||lower&&WALK.has(lower.type));}).length;
 const rhythm=10*clamp((bands.size-1)/3)+6*clamp(connectedIntegratedStairs/2)+4*clamp(stepped.size/Math.max(2,columns.size*.25));
 let entry=0,welcomingGates=0;
 for(const p of architecture.filter(p=>p.type==='gate'&&integrated.has(key(p.x,p.z,p.layer)))){
  const [dx,dz]=DIRECTIONS[p.rotation],front=get(p.x+dx,p.z+dz,p.layer),back=get(p.x-dx,p.z-dz,p.layer);
  if(front&&BLOCKED.has(front.type)||back&&BLOCKED.has(back.type))continue;
  let approach=0;for(const d of [-2,-1,1,2]){const q=get(p.x+dx*d,p.z+dz*d,p.layer);if(q&&WALK.has(q.type))approach++;}
  welcomingGates++;entry=Math.max(entry,12+8*clamp(approach/2));
 }
 let landmark=0;const focal=integratedParts.filter(p=>['core','tower','roof','beacon'].includes(p.type));
 for(const p of focal){const context=links.get(key(p.x,p.z,p.layer)).size,base=p.type==='core'?9:p.type==='beacon'?7:p.type==='tower'?5:4,max=p.type==='core'?15:p.type==='beacon'?12:p.type==='tower'?10:9;landmark=Math.max(landmark,base+(max-base)*clamp(context/3));}
 const counts={pieces:pieces.length,architecture:architecture.length,houses:houses.length,integratedHouses:integratedHouses.length,gardens:gardens.length,integratedGardens:integratedGardens.length,weapons:pieces.filter(p=>p.type==='cannon'||p.type==='heavyCannon').length,wings:wings.length,detachedArchitecture:architecture.length-integratedParts.length,terraces,levels:new Set(architecture.map(p=>p.layer)).size,heightBands:bands.size,connectedStairs,welcomingGates,landmarks:focal.length,ignored,duplicates};
 const categories=[
  {id:'wings',label:'Coherent wings',score:Math.round(clamp(coherence,0,25)),max:25,detail:wings.length?`${wings.length} composed wing${wings.length===1?'':'s'}; ${integratedParts.length} architectural pieces form related spaces.`:'Join a few different architectural pieces into deliberate rooms or terraces.'},
  {id:'gardens',label:'Courts, trees and homes',score:Math.round(clamp(planting,0,20)),max:20,detail:`${integratedGardens.length} of ${gardens.length} gardens border composed architecture; ${terraces} terrace group${terraces===1?'':'s'}. ${integratedHouses.length} integrated houses frame walkable courts. Detached decoration adds no benefit.`},
  {id:'heights',label:'Height and rhythm',score:Math.round(clamp(rhythm,0,20)),max:20,detail:`${bands.size} related height bands and ${connectedIntegratedStairs} stair connection${connectedIntegratedStairs===1?'':'s'} suggest varied, linked levels.`},
  {id:'entry',label:'Welcoming approach',score:Math.round(clamp(entry,0,20)),max:20,detail:welcomingGates?`${welcomingGates} integrated gate${welcomingGates===1?' has':'s have'} clear adjacent approaches. Nearby paths strengthen the entrance.`:'Give a gate a clear approach and connect it to the courts or terraces.'},
  {id:'landmark',label:'Landmark and focus',score:Math.round(clamp(landmark,0,15)),max:15,detail:focal.length?'A heart, tower, roof or beacon gains emphasis from the architecture around it. More copies do not multiply this benefit.':'Frame a heart, tower, roof or beacon with surrounding architecture as a focal point.'}
 ];
 const score=categories.reduce((sum,c)=>sum+c.score,0),cosmeticRank=score>=85?'Showcase':score>=70?'Signature':score>=50?'Composed':score>=25?'Study':'Sketch',cosmeticRenownPercent=Math.round(score*.15);
 const guidance={wings:'Build a small family of rooms or terraces. Separate coherent wings are welcome; symmetry is optional.',gardens:'Place a few gardens beside the courts or buildings. Repeating detached plants does not improve the study.',heights:'Vary neighboring roof or terrace heights, and give upper levels a stair landing.',entry:'Leave both sides of a gate clear and lead a short path into your castle.',landmark:'Give one heart, tower, roof or beacon a clear architectural setting instead of scattering landmarks.'};
 const tips=[...categories].sort((a,b)=>a.score/a.max-b.score/b.max||a.id.localeCompare(b.id)).filter(c=>c.score<c.max).slice(0,2).map(c=>guidance[c.id]);
 if(!tips.length)tips.push('This layout has varied composition cues. Your own taste remains the final guide.');
 return {score,categories,bonuses:[{label:'Cosmetic rank · local preview',value:cosmeticRank},{label:'Cosmetic renown · proposed only',value:'+'+cosmeticRenownPercent+'%'}],tips,counts,cosmeticRank,cosmeticRenownPercent,proposedOnly:true,scope:'Local design preview: spatial composition cues, not an absolute beauty verdict, traversal proof, earned online reward or combat advantage.'};
}
// Composition audit: measurable clutter, clashes and circulation quality of a
// castle layout. Pure and import-safe; derived walls/towers come from the same
// tierFortifications() the renderer uses. It reports, it never edits.
const AUDIT_OBJECTS=new Set(['house','garden','armory','barracks','cannon','heavyCannon','trebuchet','beacon','tower']);
const AUDIT_WALK=new Set(['terrace','floor','roundTerrace','battlement','spawn','deck','gate','wallBridge']);
export function auditComposition(layout,options={}){
 const dirs=[[0,-1],[-1,0],[0,1],[1,0]],k3=(x,z,l)=>x+':'+z+':'+l,cells=new Map(),issues=[],seen=new Set();let overlaps=0;
 for(const p of layout){const k=k3(p.x,p.z,p.layer);if(cells.has(k))overlaps++;else cells.set(k,p);}
 const at=(x,z,l)=>cells.get(k3(x,z,l)),fort=tierFortifications(layout),core=layout.find(p=>p.type==='core');
 const issue=(code,p,detail)=>{const id=code+':'+k3(p.x,p.z,p.layer);if(seen.has(id))return;seen.add(id);issues.push({code,cell:{x:p.x,z:p.z,layer:p.layer,type:p.type},detail});};
 // Footprints that physically reach into a court cell: derived curtains (2.4 m
 // into each side), their outer support piers, tower vertices and gate bays.
 const edgeCells=new Set(),towerCells=new Set(),gateCells=new Set();
 for(const e of fort.edges){const [dx,dz]=dirs[e.side];edgeCells.add(k3(e.x-dx*.5,e.z-dz*.5,e.layer));for(let l=Math.max(0,e.layer-1);l<e.layer;l++)edgeCells.add(k3(e.x+dx*.5,e.z+dz*.5,l));if(e.gate){gateCells.add(k3(e.x-dx*.5,e.z-dz*.5,e.layer));gateCells.add(k3(e.x+dx*.5,e.z+dz*.5,e.layer-1));}}
 for(const t of fort.towers)for(const sx of [-.5,.5])for(const sz of [-.5,.5]){towerCells.add(k3(t.x+sx,t.z+sz,t.layer));}
 const stairs=layout.filter(p=>p.type==='stairs'),stairZone=new Set();
 for(const s of stairs){const [dx,dz]=dirs[s.rotation];for(const [x,z,l] of [[s.x,s.z,s.layer],[s.x-dx,s.z-dz,s.layer],[s.x+dx,s.z+dz,s.layer+1]])for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)stairZone.add(k3(x+a,z+b,l));
  const entry=at(s.x-dx,s.z-dz,s.layer),landing=at(s.x+dx,s.z+dz,s.layer+1);
  if(!entry||!(AUDIT_WALK.has(entry.type)||entry.type==='stairs'&&entry.rotation===s.rotation))issue('stair-entry-blocked',s,entry?entry.type:'empty');
  if(!landing||!(AUDIT_WALK.has(landing.type)||landing.type==='stairs'&&landing.rotation===s.rotation))issue('stair-landing-blocked',s,landing?landing.type:'empty');
  if(at(s.x,s.z,s.layer+1))issue('stair-headroom',s,at(s.x,s.z,s.layer+1).type);
  for(const [a,b] of [[-dz,dx],[dz,-dx]])if(fort.edges.some(e=>e.layer===s.layer&&Math.abs(e.x-(s.x+a*.5))<.01&&Math.abs(e.z-(s.z+b*.5))<.01))issue('stair-walled',s,'a derived curtain runs along the ramp side');
 }
 for(const p of layout){const k=k3(p.x,p.z,p.layer);
  if(AUDIT_OBJECTS.has(p.type)){
   if(edgeCells.has(k))issue('object-wall',p,'shares its cell with a curtain wall or its support piers');
   if(towerCells.has(k))issue('object-tower',p,'touches a derived corner or gate tower');
   if(stairZone.has(k))issue('object-stair',p,'crowds a stair, its approach or its landing');
   if(gateCells.has(k))issue('object-gate',p,'stands in a gate passage');
  }
  if(p.type==='protector'&&(stairZone.has(k)||gateCells.has(k)))issue('protector-route',p,'sits in a stair or gate passage');
 }
 if(core){const cx=core.x,cz=core.z;for(const e of fort.edges)if(Math.hypot(e.x-cx,e.z-cz)*8<12.4+2.4&&e.layer>=core.layer-1)issue('core-wall',{...core},'the crown pedestal intersects a curtain at '+e.x+','+e.z);
  for(const p of layout)if(p!==core&&p.layer===core.layer&&!['terrace','floor'].includes(p.type)&&Math.hypot(p.x-cx,p.z-cz)<1.6)issue('core-crowded',p,'inside the crown cradle');}
 // Raised mass: connected same-layer components (courts, landings, stair tops).
 const raised=layout.filter(p=>p.layer>0&&p.type!=='stairs'&&(p.solid||p.type==='terrace'||p.fortified)),rk=new Map(raised.map(p=>[k3(p.x,p.z,p.layer),p])),done=new Set(),components=[];
 for(const p of raised){const k=k3(p.x,p.z,p.layer);if(done.has(k))continue;const q=[p];done.add(k);for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){const n=rk.get(k3(q[i].x+dx,q[i].z+dz,q[i].layer));if(n&&!done.has(k3(n.x,n.z,n.layer))){done.add(k3(n.x,n.z,n.layer));q.push(n);}}components.push(q);}
 const fortifiedComponents=components.filter(c=>c.some(p=>p.fortified));
 for(const c of fortifiedComponents)if(c.length<4)issue('isolated-ward',c[0],c.length+' cell raised ward');
 // Outline regularity: corner towers per fortified layer beyond a rectangle's four.
 const corners=fort.towers.filter(t=>t.role==='corner').length,levels=fort.levels.length,excessCorners=Math.max(0,corners-4*Math.max(1,fortifiedComponents.length));
 // Mirror symmetry of the raised mass about the best vertical axis.
 let symmetry=0,axis=null;for(let a2=-20;a2<=40;a2++){const ax=a2/2;let match=0;for(const p of raised)if(rk.has(k3(2*ax-p.x,p.z,p.layer)))match++;const s=raised.length?match/raised.length:1;if(s>symmetry){symmetry=s;axis=ax;}}
 // Mirror pairing also covers guardians and arrival courts.
 const role=t=>t==='armory'||t==='barracks'?'hall':t,objects=layout.filter(p=>AUDIT_OBJECTS.has(p.type)||p.type==='protector'||p.type==='spawn'),paired=objects.filter(p=>axis!==null&&(Math.abs(p.x-axis)<.01||layout.some(q=>role(q.type)===role(p.type)&&q.layer===p.layer&&q.z===p.z&&Math.abs(q.x-(2*axis-p.x))<.01))).length;
 // Circulation on the cell graph: shortest walk with the fewest turns.
 const walkable=p=>p&&(AUDIT_WALK.has(p.type)||p.type==='stairs'),node=new Map();
 for(const p of layout)if(walkable(p))node.set(k3(p.x,p.z,p.layer),p);
 function neighbours(p){const out=[];if(p.type==='stairs'){const [dx,dz]=dirs[p.rotation];for(const [n,d] of [[node.get(k3(p.x+dx,p.z+dz,p.layer+1)),p.rotation],[node.get(k3(p.x-dx,p.z-dz,p.layer)),(p.rotation+2)%4]])if(n)out.push([n,d]);return out;}
  for(const [d,[dx,dz]] of dirs.entries()){for(const l of [p.layer,p.layer-1]){const n=node.get(k3(p.x+dx,p.z+dz,l));if(!n)continue;if(n.type==='stairs'){const [sx,sz]=dirs[n.rotation];if(l===p.layer&&n.x-sx===p.x&&n.z-sz===p.z)out.push([n,d]);else if(l===p.layer-1&&n.x+sx===p.x&&n.z+sz===p.z)out.push([n,d]);}else if(l===p.layer&&!(p.type==='wall'||n.type==='wall'))out.push([n,d]);}}
  return out;}
 function route(from,goal){const start=node.get(k3(from.x,from.z,from.layer));if(!start)return null;const best=new Map(),prev=new Map(),open=[[0,start,-1]];best.set(k3(start.x,start.z,start.layer)+'|-1',0);
  while(open.length){let bi=0;for(let i=1;i<open.length;i++)if(open[i][0]<open[bi][0])bi=i;const [cost,p,d]=open.splice(bi,1)[0],id=k3(p.x,p.z,p.layer)+'|'+d;if(cost>best.get(id))continue;
   if(goal(p)){const path=[p];let cur=id;while(prev.has(cur)){const [q,qid]=prev.get(cur);path.push(q);cur=qid;}path.reverse();let turns=0,zigzags=0,last=-1,lastTurn=-9;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dd=Math.abs(b.x-a.x)>Math.abs(b.z-a.z)?(b.x>a.x?3:1):(b.z>a.z?2:0);if(last>=0&&dd!==last){turns++;
    // A jog is two turns within two cells on one level; a short stair between two turns is a landing.
    if(i-lastTurn<=2&&path[Math.max(0,lastTurn-1)].layer===a.layer)zigzags++;lastTurn=i;}last=dd;}return {cells:path.length,turns,zigzags,path:path.map(q=>[q.x,q.z,q.layer])};}
   for(const [n,dn] of neighbours(p)){const c=cost+1000+(d>=0&&dn!==d?1:0),nid=k3(n.x,n.z,n.layer)+'|'+dn;if(c<(best.get(nid)??Infinity)){best.set(nid,c);prev.set(nid,[p,id]);open.push([c,n,dn]);}}}
  return null;}
 const entrance={x:8,z:9,layer:0},routes=[];
 if(core){const r=route(entrance,p=>p.layer===core.layer&&Math.hypot(p.x-core.x,p.z-core.z)<=3.01&&p.type!=='stairs');routes.push({id:'core',...(r||{unreachable:true})});if(!r)issue('core-unreachable',core,'no cell route to the crown court');}
 for(const t of layout.filter(p=>['protector','spawn','armory','barracks'].includes(p.type))){const r=route(entrance,p=>p.layer===t.layer&&Math.abs(p.x-t.x)+Math.abs(p.z-t.z)===1&&p.type!=='stairs');routes.push({id:t.type+':'+t.x+':'+t.z+':'+t.layer,...(r||{unreachable:true})});}
 const reached=routes.filter(r=>!r.unreachable),turns=reached.reduce((s,r)=>s+r.turns,0),zigzags=reached.reduce((s,r)=>s+r.zigzags,0);
 const counts={};for(const i of issues)counts[i.code]=(counts[i.code]||0)+1;
 return {parts:layout.length,overlaps,issues,counts,clashes:issues.filter(i=>/^(object|core|protector|stair-headroom)/.test(i.code)).length,blockedStairs:issues.filter(i=>/stair-(entry|landing)/.test(i.code)).length,walledStairs:counts['stair-walled']||0,isolatedWards:counts['isolated-ward']||0,fortifiedLayers:levels,wards:fortifiedComponents.length,cornerTowers:corners,excessCorners,towers:fort.towers.length,gates:fort.gates.length,ladders:fort.ladders.length,batteries:fort.batteries.length,symmetry:Math.round(symmetry*100)/100,axis,objects:objects.length,pairedObjects:paired,routes:routes.map(r=>({id:r.id,unreachable:!!r.unreachable,cells:r.cells,turns:r.turns,zigzags:r.zigzags})),coreRoute:routes.find(r=>r.id==='core')||null,routeTurns:turns,routeZigzags:zigzags,meanTurns:reached.length?Math.round(turns/reached.length*10)/10:0};
}
