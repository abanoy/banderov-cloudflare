import {yieldTask} from './task-yield.js';
import {captureDesignSeed,buildAnchoredCastle} from './castle-anchor-plan.js?v=starter-battery-1';
import * as T from '../vendor/three.module.js';
import {protectorLimit} from './castle-protectors.js';
import {profile,cellPosition} from './castle-rules.js';
import {templateCatalog,buildTemplate} from './castle-templates.js';
import {assessCastle} from './castle-beauty.js?v=courts1';
import {scanCastle} from './castle-affordances.js';
import {inspectCastle} from './castle-navigation.js?v=defense-access-1';

const goals=new Set(['balanced','defense','beauty']),clone=value=>JSON.parse(JSON.stringify(value));
const weapons=new Set(['cannon','heavyCannon','trebuchet','beacon']);
function abort(signal){if(signal?.aborted){const error=new Error('Castle architect cancelled.');error.name='AbortError';throw error;}}
function hash(p,seed){return (Math.imul(p.x+31,73856093)^Math.imul(p.z+61,19349663)^Math.imul(p.layer+1,83492791)^Math.imul(seed+1,2654435761))>>>0;}
function variation(template,goal,seed){
 const layout=template.layout.map(p=>({...p})),config=template.profile,changes=[];
 // Defensive directions point toward the nearest plot edge. Positions, passages,
 // structural bodies and every inherited circular footprint remain unchanged.
 for(const p of layout)if(weapons.has(p.type)){
  const choices=[{r:0,d:config.maxZ-1-p.z},{r:1,d:config.maxX-1-p.x},{r:2,d:p.z-config.minZ},{r:3,d:p.x-config.minX}];
  choices.sort((a,b)=>a.d-b.d||((a.r+seed)%4)-((b.r+seed)%4));
  if(p.rotation!==choices[0].r){p.rotation=choices[0].r;changes.push('Turned a defense toward an outer approach.');}
 }
 const stairs=layout.filter(p=>p.type==='stairs'),safe=p=>!p.footprint&&stairs.every(s=>Math.hypot(s.x-p.x,s.z-p.z)>2.5)&&template.objectives.every(o=>{const c=cellPosition(p);return Math.hypot(c.x-o.x,c.z-o.z)>20;});
 const candidates=layout.filter(p=>safe(p)&&(goal==='beauty'?weapons.has(p.type):p.type==='garden')).sort((a,b)=>hash(a,seed)-hash(b,seed));
 const retained=layout.filter(p=>weapons.has(p.type)).length,limit=goal==='beauty'?Math.min(2,retained-1):goal==='defense'?2:1;
 for(const p of candidates.slice(0,Math.max(0,limit))){p.type=goal==='beauty'?'garden':'cannon';changes.push(goal==='beauty'?'Exchanged a spare battery for a planted court.':'Equipped an existing garden tile as a practice battery.');}
 const siege=layout.find(p=>weapons.has(p.type)&&p.type!=='beacon'&&safe(p)&&hash(p,seed)%4===0);if(siege){siege.type='trebuchet';changes.push('Equipped a clear battery court with a counterweight siege engine.');}
 for(const p of layout)if(p.fortified&&['terrace','floor','cannon','heavyCannon'].includes(p.type)){if(weapons.has(p.type))p.type='terrace';p.wallBattery=true;}
 const heart=cellPosition(layout.find(p=>p.type==='core'));heart.y+=15.156;
 const clearService=p=>{const c=cellPosition(p),bounds=new T.Box3(new T.Vector3(c.x-3.8,c.y,c.z-3.8),new T.Vector3(c.x+3.8,c.y+7,c.z+3.8));return layout.filter(q=>q.type==='protector').every(q=>{const v=cellPosition(q),a=new T.Vector3(v.x,v.y+3.5,v.z),b=new T.Vector3(heart.x,heart.y,heart.z),hit=new T.Ray(a,b.clone().sub(a).normalize()).intersectBox(bounds,new T.Vector3());return !hit||a.distanceTo(hit)>a.distanceTo(b)-8.5;});};
 for(const type of ['armory','barracks']){const candidates=layout.filter(p=>['terrace','floor','garden','house'].includes(p.type)&&!p.footprint&&clearService(p)&&layout.filter(q=>['stairs','core','protector'].includes(q.type)).every(q=>q.layer!==p.layer||Math.hypot(q.x-p.x,q.z-p.z)>1.6)).sort((a,b)=>{const edges=p=>[[0,1],[0,-1],[1,0],[-1,0]].filter(([x,z])=>!layout.some(q=>q.layer===p.layer&&q.x===p.x+x&&q.z===p.z+z&&!['wall','tower','gate','core'].includes(q.type))).length;return a.layer-b.layer||edges(a)-edges(b)||b.z-a.z||Math.abs(a.x-8)-Math.abs(b.x-8);});if(!candidates.length)throw Error('No clear court for '+type);candidates[0].type=type;delete candidates[0].wallBattery;}
 return {layout,changes:[...new Set(changes),'Prioritised exterior wall battery bays while preserving the central patrol lane.']};
}
// Search actual beam corridors, then maximise separation across reachable wards.
export function placeProtectors(layout,options,construction,home=0,seed=0){
 const limit=protectorLimit(options.level),result=layout.map(p=>({...p}));if(!limit)return {layout:result,placed:0};
 const stairs=result.filter(p=>p.type==='stairs'),core=result.find(p=>p.type==='core'),candidates=result.filter(p=>['terrace','battlement','garden','cannon','beacon'].includes(p.type)&&!p.footprint&&Math.hypot(p.x-core.x,p.z-core.z)>3&&stairs.every(s=>Math.hypot(s.x-p.x,s.z-p.z)>1.6));
 let preview;const valid=[];try{preview=construction?.preview(home,result,options);const ray=new T.Raycaster(),target=preview?.heartPosition||new T.Vector3(...Object.values(cellPosition(core)));
  for(const p of candidates){const pos=cellPosition(p),from=new T.Vector3(pos.x,pos.y+3.5,pos.z),delta=target.clone().sub(from),distance=delta.length();let clear=true;
   if(preview){ray.set(from,delta.normalize());ray.near=.05;ray.far=distance-8.5;const meshes=preview.colliders.filter(mesh=>{for(let o=mesh;o;o=o.parent){const c=o.userData.cell;if(c&&c.x===p.x&&c.z===p.z&&c.layer===p.layer)return false;}return true;});clear=ray.intersectObjects(meshes,false).length===0;}
   if(clear)valid.push(p);
  }
 }finally{preview?.dispose();}
 const selected=[];while(selected.length<limit&&valid.length){valid.sort((a,b)=>{const score=p=>{const gap=selected.length?Math.min(...selected.map(q=>Math.hypot(p.x-q.x,p.z-q.z)*8)):Math.hypot(p.x-core.x,p.z-core.z)*5;return gap+new Set([...selected,p].map(q=>Math.floor((Math.atan2(q.z-core.z,q.x-core.x)+Math.PI)*2/Math.PI))).size*12+(hash(p,seed)%100)/100;};return score(b)-score(a);});const p=valid.shift();p.type='protector';selected.push(p);}
 return {layout:result,placed:selected.length};
}
function rate(beauty,scan,goal){
 const weights=goal==='beauty'?[.60,.20,.10,.10]:goal==='defense'?[.20,.50,.20,.10]:[.35,.35,.20,.10];
 const breadth=Object.values(scan.perimeter.sectors).filter(s=>s.covered>0).length*25;
 return Math.round((beauty.score*weights[0]+scan.defenses.coverage*weights[1]+scan.perimeter.protectedPercent*weights[2]+breadth*weights[3])*10)/10;
}

/** Deterministic local design search, not a remote language model. Six bounded
 * candidates solve masonry wards around immutable core anchors. Actual collision routes are
 * walked before returning a proposal. This module never applies or saves it. */
export function createCastleArchitect(construction){
 if(typeof construction?.preview!=='function')throw new Error('The architect needs the castle preview factory.');
 return {async generate({home=0,options={},goal='balanced',seed=captureDesignSeed().seed,timestamp=null,signal,onProgress}={}){
  const started=performance.now(),config=profile(options);if(!goals.has(goal))throw new Error('Choose balanced, defense or beauty.');
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw new Error('Choose a seed from 0 to 4294967295.');
  if(home!==0&&home!==1)throw new Error('Choose Dawn or Dusk castle.');
  const cleanOptions={level:config.level,material:options.material??'fortress'},candidates=[];
  async function breathe(progress){abort(signal);onProgress?.(progress);await new Promise(resolve=>setTimeout(resolve,0));abort(signal);}
  await breathe({phase:'planning',completed:0,total:6,message:'Composing six castle proposals'});
  for(const descriptor of templateCatalog(cleanOptions)){
   for(const variant of ['original','tuned']){
    let template,layout,lastError,prechecked,acceptedScan;const changes=['Timestamp-seeded main and protector coordinates fixed before solving stairs, wards and batteries.','Raised tiers include wide wall walks, stair gatehouses and at least two clear leaning siege ladders per level.'];
    for(let retry=0;retry<12;retry++){
     abort(signal);let probe;try{
      template=buildAnchoredCastle({level:config.level,seed:(seed+(variant==='tuned'?7919:1)+descriptor.id.length*977+retry*104729)>>>0,family:descriptor.id});layout=variation(template,goal,seed).layout;
      probe=construction.preview(home,layout,cleanOptions);const scan=scanCastle(layout,cleanOptions,{preview:probe}),network=scan.protectors;
      if(!scan.placement.ok)throw new Error('A wall or harbor is detached or its outward channel is blocked.');
      if(network.blocked||network.total!==protectorLimit(config.level))throw new Error('Pinned beam corridor obstructed.');
      prechecked=await inspectCastle(probe,layout,cleanOptions,{signal,onProgress});if(!prechecked.ok)throw new Error(prechecked.summary);acceptedScan=scan;
      break;
     }catch(error){lastError=error;layout=null;}finally{probe?.dispose();}
     await breathe({phase:'planning',message:'Solving new pinpoints for '+descriptor.name+' · '+(retry+1)});
    }
    if(!layout){candidates.push({id:descriptor.id+'-'+variant,name:descriptor.name,sourceTemplate:descriptor.id,variant,score:-1000,beauty:{score:0},scan:{protectors:{blocked:1,total:0},defenses:{coverage:0}},changes:[lastError?.message||'No legal pinpoint arrangement.']});continue;}
    await breathe({phase:'scoring',completed:candidates.length,total:6,message:'Scanning '+template.name+' · '+variant});
    // Preflight and scoring consume the same unchanged layout. The scan contains
    // plain derived data and stays valid after disposing the isolated preview.
    abort(signal);const beauty=assessCastle(layout,cleanOptions),scan=acceptedScan,score=rate(beauty,scan,goal)+scan.protectors.linked*2+Math.min(10,scan.protectors.separation/10)-scan.protectors.blocked*30;
    candidates.push({id:descriptor.id+'-'+variant,name:template.name,sourceTemplate:descriptor.id,variant,layout:clone(layout),objectives:clone(template.objectives),changes,beauty,scan,score,anchors:template.anchors,prechecked});
   }
  }
  candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const attempts=[];
  // Three at most, normally only one. A rejected path is never relabelled as
  // accessible merely because its cheaper composition/coverage scores are high.
  for(const candidate of candidates.filter(c=>c.scan.protectors.blocked===0&&c.scan.protectors.total===protectorLimit(config.level)).slice(0,3)){
   await breathe({phase:'verifying',completed:attempts.length,total:3,message:'Walking the routes of '+candidate.name});
   let preview,navigation;try{
    navigation=candidate.prechecked;
    if(!navigation){preview=construction.preview(home,candidate.layout,cleanOptions);navigation=await inspectCastle(preview,candidate.layout,cleanOptions,{signal,onProgress:p=>onProgress?.({...p,candidate:candidate.name,message:candidate.name+' · '+p.message})});}
   }finally{preview?.dispose();}
   abort(signal);attempts.push({id:candidate.id,ok:navigation.ok,summary:navigation.summary});
   if(!navigation.ok)continue;
   const metrics={score:candidate.score,beauty:candidate.beauty.score,coverage:candidate.scan.defenses.coverage,protectedPerimeter:candidate.scan.perimeter.protectedPercent,sectors:candidate.scan.perimeter.sectors,routes:navigation.reachable,routeTargets:navigation.total,parts:candidate.layout.length,adjustments:candidate.scan.fitting.length,capabilities:candidate.scan.counts,seconds:(performance.now()-started)/1000};
   const explanations=[...candidate.changes,candidate.scan.placement.occupiedColumns+' explicit floor columns; '+candidate.scan.placement.ports.length+' connected outward ports and '+candidate.scan.placement.spawns.length+' arrival courts included in physical walks.',candidate.scan.protectors.linked+' protector beams clear; average spacing '+candidate.scan.protectors.separation+' m across '+candidate.scan.protectors.sectors+' sectors. All protector approaches are included in walking checks.','Compared six plans using composition cues, perimeter cover and sampled real-mesh sight lines.',navigation.summary+' Checks cover floor areas, stair landings, ports, arrival courts and defense access.',candidate.scan.defenses.coverage+'% of sampled outer approaches can be reached by a prototype defense. Automatic fire and manual defense entry are active in local matches.',candidate.scan.fitting.length+' neighbouring-tile adjustments keep the visible and physical pieces aligned.'];
   return {ok:true,layout:clone(candidate.layout),options:cleanOptions,objectives:clone(candidate.objectives),sourceTemplate:candidate.sourceTemplate,name:candidate.name,goal,seed,timestamp,anchors:candidate.anchors,summary:'Proposed '+candidate.name+' · '+navigation.reachable+' routes walked out and back.',explanations,metrics,affordances:candidate.scan,beauty:candidate.beauty,candidates:candidates.map(c=>({id:c.id,name:c.name,variant:c.variant,score:c.score,beauty:c.beauty.score,coverage:c.scan.defenses.coverage,changes:c.changes,verified:attempts.find(a=>a.id===c.id)?.ok??false})),attempts,navigation,scope:'Local draft proposal. Apply is a separate action; composition and coverage are estimates, not online rank or PvP balance.'};
  }
  return {ok:false,summary:'No checked proposal passed every route. Your current draft is unchanged.',goal,seed,candidates:candidates.map(c=>({id:c.id,name:c.name,score:c.score})),attempts,metrics:{seconds:(performance.now()-started)/1000}};
 }};
}

// Core-first match planner: immutable pinpoints and solved wards; runtime navigation
// checks their current collision after placement. Workshop search remains deeper.
export function battleCastlePlan({level=100,seed=0,home=1,construction=null}={}){
 const options={level,material:'fortress'},families=['rampart','sanctuary','skyharbor'],family=families[hash({x:home,z:17,layer:0},seed)%3],goal=['defense','balanced','beauty'][hash({x:home,z:31,layer:1},seed)%3],template=buildAnchoredCastle({level,seed:(seed+home*977)>>>0,family}),changed=variation(template,goal,seed);
 return {layout:changed.layout,anchors:template.anchors,options,name:template.name,family,goal,seed,protectors:template.anchors.protectors.length,composition:'Pinned main/protector coordinates first; solved stair corridors and solid wards'};
}

// A match never applies an unwalked seeded candidate. Failed corridors and
// protector approaches become rejection evidence; the next seed changes massing.
export async function verifiedBattleCastlePlan({construction,home=0,level=100,seed=captureDesignSeed().seed,timestamp=null,avoidFamilies=[],signal,onProgress}={}){
 const attempts=[];for(let i=0;i<48;i++){abort(signal);await yieldTask();abort(signal);let plan;try{plan=battleCastlePlan({construction,home,level,seed:(seed+Math.imul(i,104729))>>>0});}catch(error){attempts.push({seed:(seed+Math.imul(i,104729))>>>0,reason:error.message});continue;}if(i<12&&avoidFamilies.includes(plan.family))continue;onProgress?.({message:'Designing '+(home?'Dusk':'Dawn')+' · checking ward '+(i+1)});let preview,navigation,network;
  try{preview=construction.preview(home,plan.layout,plan.options);const scan=scanCastle(plan.layout,plan.options,{preview});network=scan.protectors;if(!scan.placement.ok){attempts.push({seed:plan.seed,reason:scan.placement.issues[0].message});continue;}if(network.total!==protectorLimit(level)||network.blocked){attempts.push({seed:plan.seed,reason:'Incomplete or obstructed protector network'});continue;}navigation=await inspectCastle(preview,plan.layout,plan.options,{signal,stopOnFailure:true,onProgress:p=>onProgress?.({...p,message:'Designing '+(home?'Dusk':'Dawn')+' · candidate '+(i+1)+'/48 · '+p.message})});}finally{preview?.dispose();}
  attempts.push({seed:plan.seed,ok:navigation.ok,issues:navigation.issues,summary:navigation.summary});if(navigation.ok)return {...plan,timestamp,navigation:{ok:true,routes:navigation.reachable,total:navigation.total},network,attempts};
 }throw new Error('No reachable castle proposal passed the seeded search. '+(attempts.at(-1)?.summary||attempts.at(-1)?.reason||'Search exhausted.')+' '+attempts.filter(a=>a.summary).map(a=>a.summary).join('; '));
}
