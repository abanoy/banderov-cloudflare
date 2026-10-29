// Local composition guidance, not an objective beauty verdict or a combat rule.
// Coordinates may be negative: the assessment follows the layout, not its origin.
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
