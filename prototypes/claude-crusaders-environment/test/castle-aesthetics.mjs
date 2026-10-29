// AI castle composition: legal, clash-free, symmetric castles on one axis, and
// bot routes that walk straight runs. Pure planner checks over levels, seeds
// and families, then one applied world where raw lattice routes are compared
// with string-pulled ones and the smoothed route is walked at 120 Hz.
// usage: node test/castle-aesthetics.mjs [--quick]
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {composeCastle,buildAnchoredCastle} from '../floating-castle/castle-anchor-plan.js';
import {battleCastlePlan} from '../floating-castle/castle-architect.js';
import {auditComposition} from '../floating-castle/castle-beauty.js';
import {tierFortifications} from '../floating-castle/castle-fortifications.js';
import {profile,containsCell,MAX_PARTS} from '../floating-castle/castle-rules.js';
import {protectorLimit} from '../floating-castle/castle-protectors.js';

const quick=process.argv.includes('--quick'),levels=quick?[1,30,60,100]:[1,10,20,30,40,50,60,70,80,90,100],seeds=quick?[7,4242]:[7,4242,98765,1234567],families=['rampart','sanctuary','skyharbor'],goals=['balanced','defense','beauty'];
const TYPES=new Set(['floor','deck','terrace','roundTerrace','curvedWall','embankment','wall','battlement','gate','tower','stairs','cannon','heavyCannon','roof','garden','core','beacon','protector','house','spawn','armory','barracks','trebuchet','wallBridge']);
const totals={castles:0,clashes:0,excessCorners:0,coreTurns:0,zigzags:0,symmetry:0,paired:0,objects:0};let checks=0;
const check=(ok,message)=>{checks++;assert(ok,message);};

for(const level of levels)for(const [i,seed] of seeds.entries())for(const [f,family] of families.entries()){
 const goal=goals[(i+f)%3],tag=`L${level} s${seed} ${family}/${goal}`,plan=composeCastle({level,seed,family,goal}),layout=plan.layout,c=profile({level});
 // Legality under the build rules.
 const cells=new Set();for(const p of layout){check(TYPES.has(p.type),tag+' unknown piece '+p.type);check(containsCell(p,c),tag+' piece outside the plot');check(Number.isInteger(p.layer)&&p.layer>=0&&p.layer<10,tag+' bad layer');const k=p.x+':'+p.z+':'+p.layer;check(!cells.has(k),tag+' overlap at '+k);cells.add(k);}
 check(layout.length<=MAX_PARTS,tag+' exceeds the part budget');
 // Drafts leave the Workshop's 40 free pieces at every level.
 check(layout.length<=MAX_PARTS-40,tag+' leaves fewer than 40 free parts: '+layout.length+'/'+MAX_PARTS);
 check(layout.filter(p=>p.type==='core').length===1,tag+' needs one crown');
 check(layout.filter(p=>p.type==='protector').length===protectorLimit(level),tag+' guardian count');
 check(layout.some(p=>p.type==='gate'&&p.x===8&&p.z===10&&p.layer===0)&&layout.some(p=>p.x===8&&p.z===11&&p.layer===0),tag+' fixed entrance');
 check(layout.some(p=>p.type==='spawn')&&layout.some(p=>p.type==='deck')&&layout.some(p=>p.type==='armory')&&layout.some(p=>p.type==='barracks'),tag+' arrivals, quays and halls');
 // One axis: every stair climbs straight toward the keep on the main axis.
 const A=plan.composition.axis,stairs=layout.filter(p=>p.type==='stairs');
 check(stairs.length>=1&&stairs.every(s=>s.x===A&&s.rotation===0),tag+' stairs leave the main axis');
 check(stairs.some(s=>s.x===A&&s.z===8&&s.layer===0),tag+' forecourt stair is not on the axis');
 const core=layout.find(p=>p.type==='core');check(core.x===A,tag+' crown off the axis');
 const fort=tierFortifications(layout);check(fort.levels.every(l=>fort.gates.some(g=>g.layer===l)),tag+' a ward has no stair-facing gatehouse');check(fort.levels.every(l=>fort.ladders.filter(g=>g.layer===l).length>=2),tag+' a ward lacks two ladders');
 // Composition audit: no clashes, rectangles, mirror pairs, clean circulation.
 const a=auditComposition(layout,{level});
 check(a.overlaps===0,tag+' overlaps');
 check(a.clashes===0,tag+' clashes '+JSON.stringify(a.counts));
 check(a.blockedStairs===0&&a.walledStairs===0,tag+' blocked or walled stairs');
 check(a.isolatedWards===0,tag+' isolated ward');
 check(a.excessCorners===0,tag+' jagged ward outline: '+a.excessCorners+' extra corner towers');
 check(a.symmetry>=.99&&Math.abs(a.axis-A)<.01,tag+' raised mass is not mirrored about the axis');
 check(a.pairedObjects===a.objects,tag+' unpaired objects '+(a.objects-a.pairedObjects));
 check(a.coreRoute&&!a.coreRoute.unreachable&&a.coreRoute.turns<=1&&a.coreRoute.zigzags===0,tag+' crown procession '+JSON.stringify(a.coreRoute));
 check(a.routes.every(r=>!r.unreachable),tag+' unreachable target');
 check(a.routeZigzags<=4,tag+' jogging routes '+a.routeZigzags);
 // Deterministic for the same inputs.
 check(JSON.stringify(composeCastle({level,seed,family,goal}).layout)===JSON.stringify(layout),tag+' is not deterministic');
 totals.castles++;totals.clashes+=a.clashes;totals.excessCorners+=a.excessCorners;totals.coreTurns+=a.coreRoute.turns;totals.zigzags+=a.routeZigzags;totals.symmetry+=a.symmetry;totals.paired+=a.pairedObjects;totals.objects+=a.objects;
}
// Seeds give variety within the grammar, never scatter.
const variants=new Set(seeds.flatMap(seed=>families.map(family=>JSON.stringify(composeCastle({level:60,seed,family}).layout))));check(variants.size>=Math.min(5,seeds.length*3-1),'L60 designs are too alike: '+variants.size);
// Match planner uses the composer; the pin planner stays available for pinned anchors.
for(const [level,seed,home] of [[30,22,0],[30,22,1],[100,5611748,0]]){const p=battleCastlePlan({level,seed,home});check(!!p.design&&p.design.axis===p.layout.find(q=>q.type==='core').x,'battle plan L'+level+' is not composed');check(p.protectors===protectorLimit(level),'battle plan guardians');}
let legacy=null;for(let seed=0;seed<24&&!legacy;seed++){try{legacy=buildAnchoredCastle({level:20,seed,family:'sanctuary'});}catch{}}check(legacy?.layout.some(p=>p.type==='core'),'legacy pin planner still answers');
console.log('Composition checks',checks,JSON.stringify({castles:totals.castles,clashes:totals.clashes,excessCorners:totals.excessCorners,meanCoreTurns:Math.round(totals.coreTurns/totals.castles*100)/100,routeZigzags:totals.zigzags,meanSymmetry:Math.round(totals.symmetry/totals.castles*100)/100,paired:totals.paired+'/'+totals.objects,variantsL60:variants.size}));

// Bot routes on applied composed castles: string pulling must cut lattice
// corners, keep every route walkable and never leave the ground.
globalThis.document={createElement(){return {width:0,height:0,getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}};}};
const {makeWorld}=await import('../floating-castle/world.js'),{createConstruction}=await import('../floating-castle/castle-construction.js'),{createBattleNavigation}=await import('../floating-castle/battle-navigation.js'),{flightWorld}=await import('../floating-castle/flight.js');
const world=makeWorld(new T.Scene()),construction=createConstruction(world);
for(let home=0;home<2;home++){const p=battleCastlePlan({level:30,seed:22,home});construction.apply(home,p.layout,p.options);}
const nav=createBattleNavigation(world);await nav.rebuild();assert(nav.ready);
function shape(points){let turning=0,length=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(a.launchTo!==undefined||b.launchTo!==undefined)continue;length+=Math.hypot(b.x-a.x,b.z-a.z);const p=points[i-2];if(!p||p.launchTo!==undefined)continue;const u=[a.x-p.x,a.z-p.z],v=[b.x-a.x,b.z-a.z],nu=Math.hypot(...u),nv=Math.hypot(...v);if(nu>.05&&nv>.05)turning+=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(nu*nv))))*180/Math.PI;}return {points:points.length,turning:Math.round(turning),length:Math.round(length*10)/10};}
function walk(route,start){const near=[],sim=flightWorld(near,[{...start,r:6},...world.pads.slice(1)]);let airborne=0;for(const target of route.points){if(target.launchTo!==undefined)break;let budget=2400;while(Math.hypot(target.x-sim.state.x,target.z-sim.state.z)>.08&&budget-->0){const s=sim.state,dx=target.x-s.x,dz=target.z-s.z,d=Math.hypot(dx,dz),strength=Math.min(1,d/(10/120));near.splice(0,near.length,...nav.nearby(s,3));sim.step(1/120,{x:dx/d*strength,z:dz/d*strength});if(!s.grounded)airborne++;}assert(budget>0,'smoothed route stalled');}return {airborne,falls:sim.state.falls,final:{x:sim.state.x,y:sim.state.y,z:sim.state.z}};}
const raw={points:0,turning:0,length:0},smooth={points:0,turning:0,length:0},walks=[];
for(let home=0;home<2;home++){const heart=world.castleHearts[home].core.getWorldPosition(new T.Vector3()),floorY=heart.y-15.156,goal=nav.nodes.filter(n=>Math.abs(n.y-floorY)<1.3&&Math.hypot(n.x-heart.x,n.z-heart.z)>14).sort((a,b)=>Math.hypot(a.x-heart.x,a.z-heart.z)-Math.hypot(b.x-heart.x,b.z-heart.z))[0];assert(goal,'crown court node');
 const target={id:'crown'+home,x:goal.x,y:goal.y,z:goal.z,radius:3},start=world.pads[home],r0=await nav.path(start,target,{walkingOnly:true,smooth:false}),r1=await nav.path(start,target,{walkingOnly:true});assert(r0.reachable&&r1.reachable,'crown court route');
 const s0=shape(r0.points),s1=shape(r1.points);for(const k of Object.keys(raw)){raw[k]+=s0[k];smooth[k]+=s1[k];}
 const w=walk(r1,start);assert.equal(w.airborne,0,'smoothed route left the ground');assert.equal(w.falls,0,'smoothed route fell');assert(Math.hypot(w.final.x-target.x,w.final.z-target.z)<target.radius+.1,'smoothed route missed the crown court');walks.push(w);}
for(const [i,o] of world.orbTowers.entries()){const start=world.pads[i%2],target={id:'orb'+i,x:o.x,y:o.y??0,z:o.z,radius:o.captureRadius||14},r0=await nav.path(start,target,{smooth:false}),r1=await nav.path(start,target);assert(r0.reachable&&r1.reachable);const s0=shape(r0.points),s1=shape(r1.points);for(const k of Object.keys(raw)){raw[k]+=s0[k];smooth[k]+=s1[k];}}
check(smooth.points<raw.points*.75,'string pulling removed too few lattice corners '+JSON.stringify({raw,smooth}));
check(smooth.turning<raw.turning*.6,'routes still turn too much '+JSON.stringify({raw,smooth}));
check(smooth.length<=raw.length+.5,'smoothed routes are longer');
const stats=nav.stats;check(stats.shortcutsPassed>0&&stats.shortcutsTested>=stats.shortcutsPassed,'shortcut walks were not checked');
console.log('Route shape raw',JSON.stringify(raw),'smooth',JSON.stringify(smooth),'shortcut walks',stats.shortcutsPassed+'/'+stats.shortcutsTested);
nav.dispose();
console.log('PASS castle aesthetics:',checks,'checks');
