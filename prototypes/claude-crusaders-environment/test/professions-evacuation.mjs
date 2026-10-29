import * as T from '../vendor/three.module.js';
import {makeWorld} from '../floating-castle/world.js';
import {flightWorld} from '../floating-castle/flight.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleBots} from '../floating-castle/battle-bots.js';
import {computeBattleBlastZones} from '../floating-castle/battle.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

globalThis.document={createElement(){return {width:0,height:0,getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}};}};
const names=['battle-navigation.js','battle-bots.js','battle.js','flight.js','world.js'],hash=f=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/'+f,import.meta.url))).digest('hex');
const report={scope:'Fixed-step original-world fixture with real battle.js castle blast boundaries and original flight physics; no-op texture canvas. Explicit evacuation input begins at spawn, then a second doomed castle is added after five seconds. No actor/time/health injection into a live browser and no movement teleport.',startedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(names.map(n=>[n,hash(n)])),checks:[],failures:[]};
let navigation,roster;
try{
 const world=makeWorld(new T.Scene()),zones=computeBattleBlastZones(world);assert.equal(zones.length,2);assert(zones.every(z=>Math.hypot(z.x,z.z)>z.radius),'The lower arena centre remains outside the actual castle explosions');
 const independent=world.castles.map((castle,team)=>{const box=new T.Box3();for(const mesh of world.solids){let p=mesh,castleChild=false,harborChild=false;while(p){if(p===castle)castleChild=true;if(p===world.harbors[team].root)harborChild=true;p=p.parent;}if(castleChild&&!harborChild)box.union(new T.Box3().setFromObject(mesh));}return box;});
 for(let team=0;team<2;team++){const b=independent[team],c=b.getCenter(new T.Vector3()),s=b.getSize(new T.Vector3());assert(Math.abs(c.x-zones[team].x)<1e-6&&Math.abs(c.z-zones[team].z)<1e-6);assert(Math.abs(zones[team].radius-Math.hypot(s.x,s.z)/2-8)<1e-6);}
 navigation=createBattleNavigation(world);await navigation.rebuild();roster=createBattleBots({world,navigation,playerPhysics:flightWorld(world.solids,world.pads),fire(){throw Error('Evacuating bots must not fire');}});roster.reset({launchHuman:false});for(const a of roster.bots.filter(a=>a.ordinal===0)){a.serviceTask={kind:'post'};a.defender=true;}let lateZoneDecisions,maxDisplacement=0;const samples=[];
 for(let frame=1;frame<=7200;frame++){
  if(frame===301)lateZoneDecisions=roster.bots.filter(a=>a.team===1).map(a=>a.decisions);
  const before=roster.bots.map(a=>({...a.state}));roster.update(1/60,frame/60,{evacuation:{endsAt:120,zones:frame<=300?[zones[0]]:zones}});
  if(frame===301)assert(roster.bots.filter(a=>a.team===1).every((a,i)=>a.role==='Evacuate'&&!a.serviceTask&&(a.decisions>lateZoneDecisions[i]||a.decisionAt<=frame/60)),'Newly threatened bots decide or queue under the four-search concurrency limit');
  for(let i=0;i<roster.bots.length;i++)maxDisplacement=Math.max(maxDisplacement,Math.hypot(roster.bots[i].state.x-before[i].x,roster.bots[i].state.y-before[i].y,roster.bots[i].state.z-before[i].z));
  if(frame%6===0)await new Promise(r=>setTimeout(r,0));
  if(frame%300===0){const actors=roster.snapshot().actors.filter(a=>!a.human);samples.push({time:frame/60,actors});console.log('Escape',frame/60,'seconds, safe',actors.filter(a=>zones.every(z=>Math.hypot(a.x-z.x,a.z-z.z)>z.radius+15)).length);}
 }
 const actors=roster.snapshot().actors.filter(a=>!a.human);report.checks.push({name:'Actual castle footprint evacuation, with a later second core collapse',zones,maxDisplacement,samples,actors,navigation:navigation.stats});assert(actors.every(a=>a.role==='Evacuate'));assert(actors.every(a=>zones.every(z=>Math.hypot(a.x-z.x,a.z-z.z)>z.radius+15)),JSON.stringify(actors.map(a=>({id:a.id,x:a.x,y:a.y,z:a.z,reason:a.reason,status:a.routeStatus}))));assert(actors.every(a=>a.falls===0&&a.grounded));assert(maxDisplacement<5);report.passed=true;
}catch(e){report.passed=false;report.failures.push({message:e.message,stack:e.stack});console.error(e);process.exitCode=1;}finally{roster?.dispose();navigation?.dispose();report.finalSourceHashes=Object.fromEntries(names.map(n=>[n,hash(n)]));report.sourceStable=names.every(n=>report.sourceHashes[n]===report.finalSourceHashes[n]);if(!report.sourceStable){report.passed=false;report.failures.push({message:'Source changed during execution.'});process.exitCode=1;}report.finishedAt=new Date().toISOString();fs.writeFileSync(new URL('../review/professions-evacuation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
