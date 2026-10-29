import * as T from './vendor/three.module.js';
import {createConstruction,PARTS} from './wave-check/runtime/castle-construction.js';
import {chargeOrb} from './wave-check/runtime/charge-orb.js';
import {inspectCastle} from './wave-check/runtime/castle-navigation.js';
import {inspectCastleFootprint} from './wave-check/runtime/castle-footprint.js';
import {createBattleNavigation} from './wave-check/runtime/battle-navigation.js';
import {approachIssues} from './wave-check/runtime/import-feedback.js';
import {siegeRoutes,SECTORS} from './wave-check/runtime/siege-routes.js';
export async function checkWaveCompatibility(design){
 const warnings=[],layout=design.layout,issues=[],routes=[];
 const unsupported=layout.filter(p=>!PARTS.some(t=>t.id===p.type));if(unsupported.length)return {ok:false,physical:false,routes:[],issues:unsupported.map(p=>`Pinned Wave checker does not support ${p.type} at cell ${p.x},${p.z}, layer ${p.layer}. Keep the complete design; no pieces were dropped.`),scope:'Wave must independently integrate this weapon before import.'};
 warnings.push(...approachIssues(layout).map(i=>i.message+' '+(i.suggestion||'')));
 const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castle=new T.Group();castle.add(new T.Group(),new T.Group());const heart=chargeOrb(castle,mats,{x:0,y:12,z:0,radius:8.4,crown:true});const construction=createConstruction({mats,castles:[castle],castleHearts:[heart],solids:[],occluders:[]});let built,nav,physical=false;
 try{
  if(layout.filter(p=>p.type==='core').length!==1)throw Error('Exactly one MAIN core required.');
  built=construction.preview(0,layout,design.options);
  const footprint=inspectCastleFootprint(layout);if(!footprint.ok)issues.push(...footprint.issues.map(p=>p.message));
  if(built.links.some(p=>!p.linked))issues.push('Protector beam blocked.');
  const result=await inspectCastle(built,layout,design.options);if(!result.ok)issues.push(...result.issues.map(p=>p.message));
  if(!issues.length&&!warnings.length){nav=createBattleNavigation({solids:built.colliders,castles:[built.root,new T.Group()],pads:[{x:22,y:.77,z:74,r:2},{x:500,y:.77,z:74,r:2}],routes:[]});await nav.rebuild();const checked=await siegeRoutes({castles:[built.root]},nav,layout);routes.push(...checked.map(r=>({sector:SECTORS[r.sector],points:r.points.length})));physical=true;}
 }catch(e){issues.push(e.message);}finally{nav?.dispose();built?.dispose();for(const mat of Object.values(mats))mat.dispose();}
 return {ok:physical&&issues.length===0&&warnings.length===0,physical,issues:[...new Set([...warnings,...issues])],routes,scope:'Snapshot of Wave import preflight on isolated actual geometry; Wave must recheck the live imported castle. No siege/cannon gameplay certification.'};
}
export function waveCompatibilityText(result){return (result.ok?'Wave snapshot preflight passed: four exterior gate-to-MAIN routes checked.':'Wave compatibility warning: '+result.issues.slice(0,8).join(' '))+' This does not change Castle Trials validity or scoring. Design export remains available. Wave keeps its older core/weapon models and does not transfer the new Trials weapon behavior.';}
