// Battle guide logic in Node with a fake battle ctx (no DOM): objective waypoint target selection, capture-meter states,
// the first-match tip state machine (action gating, timeouts, pause, persistence, skip, reset, ?test gating, per-match numbering) and hit markers.
// Usage: node test/battle-guide.mjs   (exit 0 = pass)
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {createGuide,createTips,pickTarget,readFacts,insideBlast,GUIDE_TIPS} from '../floating-castle/battle-guide.js';

const checks=[];const check=(name,fn)=>{fn();checks.push(name);};
function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m};}
function core(x,y,z){const o=new T.Object3D();o.position.set(x,y,z);o.updateMatrixWorld(true);return o;}
function fakeCtx(){
 const human={id:0,team:0,human:true,alive:true,hp:100,maxHp:100,captures:0,classId:'ranger',state:{x:-131,y:55,z:0,grounded:true,flight:false}};
 const foe={id:1,team:1,alive:true,hp:100,maxHp:100,state:{x:0,y:0,z:0}};
 const objectives=[[-270,0,-230],[270,0,-230],[270,0,230],[-270,0,230],[0,-12,0]].map(([x,y,z],i)=>({id:i,label:i===4?'CROWN':'T'+(i+1)+' · X',x,y,z,radius:i===4?15:14,owner:-1,progress:0,contested:false,occupants:[0,0],mode:'idle',charge:0}));
 const protectors=[];const state={phase:'running',time:0,shields:[8000,8000],cores:[16000,16000],doomedTeams:[],blastZones:[]};
 const camera=new T.OrthographicCamera(-62,62,35,-35,1,2000);camera.position.set(-231,155,100);camera.lookAt(-131,55,0);camera.updateMatrixWorld(true);
 const root=new T.Group();
 return {T,camera,root,human,foe,actors:[human,foe],objectives,protectors:()=>protectors,protectorList:protectors,teamNames:['DAWN','DUSK'],colors:[0x80eee2,0xf49bc7],BATTLE_RULES:{towerChargeSeconds:60,survivalBonus:100},
  world:{castleHearts:[{core:core(-200,70,20)},{core:core(180,70,-20)}],pads:[{name:'Dawn castle',x:-131,y:55,z:0,r:6,home:true},{name:'Dusk castle',x:131,y:55,z:0,r:6,home:true},{name:'Arena west',x:-76,y:0,z:0,r:6},{name:'T1 · X landing',x:-248,y:0,z:-230,r:5}]},
  combat:{state},get playing(){return state.phase==='running'||state.phase==='evacuation';},get phase(){return state.phase;},paused:false,dom:{},physics:{state:human.state,nearPad:()=>-1}};
}

check('pickTarget: nearest silo we do not hold (Crown from the castle pad), then a nearer outer silo',()=>{
 const c=fakeCtx(),t={};assert.equal(pickTarget(c,t).kind,'silo');assert.equal(t.id,4);assert.equal(t.label,'Crown');assert.ok(Math.abs(t.dist-Math.hypot(131,67,0))<1e-6);
 c.human.state.x=-250;c.human.state.y=0;c.human.state.z=-200;assert.equal(pickTarget(c,t).id,0);assert.equal(t.label,'T1');assert.equal(t.top,3);});
check('pickTarget: held silos are skipped; one of ours under attack becomes a Defend target',()=>{
 const c=fakeCtx(),t={};const [o0,,, ,o4]=c.objectives;o4.owner=0;o4.progress=1;assert.notEqual(pickTarget(c,t).id,4);
 o4.occupants=[0,1];assert.equal(pickTarget(c,t).kind,'defend');assert.equal(t.label,'Defend Crown');
 o4.occupants=[0,0];o4.progress=.6;assert.equal(pickTarget(c,t).kind,'defend');o4.progress=1;void o0;});
check('pickTarget: every silo ours -> enemy shield (at the enemy core); team 1 reads the mirrored progress',()=>{
 const c=fakeCtx(),t={};for(const o of c.objectives){o.owner=0;o.progress=1;}assert.equal(pickTarget(c,t).kind,'shield');assert.equal(t.label,'Dusk shield');assert.equal(t.x,180);
 c.human.team=1;for(const o of c.objectives){o.owner=1;o.progress=-1;}assert.equal(pickTarget(c,t).kind,'shield');assert.equal(t.label,'Dawn shield');assert.equal(t.x,-200);});
check('pickTarget: shield down -> nearest live enemy protector, then the enemy core',()=>{
 const c=fakeCtx(),t={};c.combat.state.shields[1]=0;c.protectorList.push({id:'p1',team:1,hp:600,point:new T.Vector3(150,60,0)},{id:'p2',team:1,hp:600,point:new T.Vector3(100,60,0)},{id:'p3',team:0,hp:600,point:new T.Vector3(-100,60,0)});
 assert.equal(pickTarget(c,t).kind,'protector');assert.equal(t.id,'p2');c.protectorList[1].hp=0;assert.equal(pickTarget(c,t).id,'p1');c.protectorList[0].hp=0;assert.equal(pickTarget(c,t).kind,'core');assert.equal(t.label,'Dusk core');});
check('pickTarget: evacuation -> nearest pad only while inside a doomed blast zone and not flying; finished/idle -> none',()=>{
 const c=fakeCtx(),t={},st=c.combat.state;st.phase='evacuation';st.doomedTeams=[0];st.blastZones=[{team:0,x:-150,z:0,radius:90},{team:1,x:150,z:0,radius:90}];
 assert.equal(insideBlast(st,-131,0),true);assert.equal(insideBlast(st,131,0),false);assert.equal(pickTarget(c,t).kind,'pad');assert.equal(t.label,'Launch pad');assert.equal(t.x,-131);
 c.human.state.flight=true;assert.equal(pickTarget(c,t),null);c.human.state.flight=false;c.human.state.x=0;assert.equal(pickTarget(c,t),null);
 st.phase='finished';assert.equal(pickTarget(c,t),null);assert.equal(t.kind,'');st.phase='idle';assert.equal(pickTarget({human:null,combat:{state:st}},t),null);});
check('readFacts: ring/near silo, held count, enemy protectors, blast safety',()=>{
 const c=fakeCtx(),f=readFacts(c,{});assert.equal(f.ring,-1);assert.equal(f.near,-1);assert.equal(f.running,true);
 const o=c.objectives[0];c.human.state.x=o.x+20;c.human.state.y=0;c.human.state.z=o.z;readFacts(c,f);assert.equal(f.near,0);assert.equal(f.ring,-1);
 c.human.state.x=o.x+3;readFacts(c,f);assert.equal(f.ring,0);o.owner=0;o.progress=1;c.human.state.x=o.x+20;readFacts(c,f);assert.equal(f.near,-1);assert.equal(f.held,1);
 c.protectorList.push({team:1,hp:10},{team:1,hp:0},{team:0,hp:5});readFacts(c,f);assert.equal(f.enemyProtectors,1);});

// Tip machine driven with plain facts.
const F=(o={})=>Object.assign({running:true,evacuating:false,playing:true,alive:true,human:0,team:0,enemy:1,x:0,y:0,z:0,flight:false,captures:0,enemyShield:8000,enemyProtectors:0,held:0,safe:true,ourDoomed:false,ring:-1,targetKind:'silo'},o);
function run(t,f,seconds,dt=.05){for(let s=0;s<seconds-1e-9;s+=dt)t.update(dt,f);return t.active;}
check('tips: first tip waits 2.5 s, then Move completes only on real movement (after the 1.5 s read time)',()=>{
 const t=createTips({storage:memoryStorage()}),f=F();t.begin();assert.equal(run(t,f,2.4),'');assert.equal(run(t,f,.2),'move');assert.equal(t.step,1);
 f.x=10;run(t,f,1);assert.equal(t.active,'move');assert.equal(t.finishing,false);run(t,f,.6);assert.equal(t.finishing,true);run(t,f,1);assert.equal(t.active,'');assert.ok(t.done.has('move'));});
check('tips: paused (dt 0) never advances a timeout; Fire completes on the human shot, not a bot shot',()=>{
 const t=createTips({storage:memoryStorage()}),f=F();t.done.add('move');t.begin();run(t,f,3);assert.equal(t.active,'fire');for(let i=0;i<5000;i++)t.update(0,f);assert.equal(t.active,'fire');assert.ok(t.age<3.1);
 t.event({type:'shot',actor:7},f);run(t,f,2);assert.equal(t.finishing,false);t.event({type:'shot',actor:0},f);run(t,f,.1);assert.equal(t.finishing,true);});
check('tips: an ignored tip times out quietly and still counts as seen; downed player freezes the tip',()=>{
 const t=createTips({storage:memoryStorage()}),f=F();t.done.add('move');t.begin();run(t,f,3);assert.equal(t.active,'fire');f.alive=false;run(t,f,30);assert.equal(t.active,'fire');f.alive=true;run(t,f,15);assert.equal(t.active,'');assert.ok(t.done.has('fire'));assert.equal(t.finishing,false);});
check('tips: a card held off screen (no free slot, scoreboard) keeps its read time and timeout frozen; the action still counts once shown',()=>{
 const t=createTips({storage:memoryStorage()}),f=F();t.done.add('move');t.begin();run(t,f,3);assert.equal(t.active,'fire');for(let i=0;i<600;i++)t.update(.05,f,true);assert.equal(t.active,'fire');assert.ok(t.age<.6);
 t.event({type:'shot',actor:0},f);for(let i=0;i<100;i++)t.update(.05,f,true);assert.equal(t.finishing,false);run(t,f,1.6);assert.equal(t.finishing,true);});
check('tips: Capture needs a silo target and completes when the player captures; Strike follows once a silo is held',()=>{
 const t=createTips({storage:memoryStorage()}),f=F();for(const id of ['move','fire'])t.done.add(id);t.begin();f.targetKind='shield';run(t,f,3);assert.equal(t.active,'');f.targetKind='silo';run(t,f,.1);assert.equal(t.active,'capture');
 f.captures=1;f.held=1;run(t,f,1.6);assert.equal(t.finishing,true);run(t,f,2.5);assert.equal(t.active,'strike');run(t,f,3);t.event({type:'tower-shot',strike:{team:0}},f);run(t,f,2);assert.equal(t.active,'strike');run(t,f,1.2);assert.equal(t.finishing,true);});
check('tips: Protectors only with live enemy protectors after the shield falls, then Core, then Escape in evacuation',()=>{
 const t=createTips({storage:memoryStorage()}),f=F({enemyShield:0,enemyProtectors:2,targetKind:'protector'});for(const id of ['move','fire','capture','strike'])t.done.add(id);t.begin();run(t,f,3);assert.equal(t.active,'protectors');
 t.event({type:'protector-down',team:0},f);run(t,f,2);assert.equal(t.finishing,false);t.event({type:'protector-down',team:1},f);run(t,f,.1);assert.equal(t.finishing,true);run(t,f,1);
 f.enemyProtectors=0;run(t,f,1.5);assert.equal(t.active,'core');t.event({type:'core-hit',source:0,coreDamage:0},f);run(t,f,2);assert.equal(t.finishing,false);t.event({type:'core-hit',source:0,coreDamage:12},f);run(t,f,.1);assert.equal(t.finishing,true);run(t,f,1);
 Object.assign(f,{running:false,evacuating:true,safe:false,ourDoomed:true});run(t,f,1.5);assert.equal(t.active,'escape');run(t,f,6);assert.equal(t.finishing,false);f.safe=true;run(t,f,1.6);assert.equal(t.finishing,true);});
check('tips: no protectors at all -> Protectors is skipped this match (stays pending), Core shows instead',()=>{
 const t=createTips({storage:memoryStorage()}),f=F({enemyShield:0,enemyProtectors:0});for(const id of ['move','fire','capture','strike'])t.done.add(id);t.begin();run(t,f,3);assert.equal(t.active,'core');assert.equal(t.done.has('protectors'),false);});
check('tips: a tip whose condition lapses early is dropped without being marked seen',()=>{
 const t=createTips({storage:memoryStorage()}),f=F();for(const id of ['move','fire'])t.done.add(id);t.begin();run(t,f,3);assert.equal(t.active,'capture');f.enemyShield=0;f.targetKind='core';run(t,f,.1);assert.equal(t.active,'');assert.equal(t.done.has('capture'),false);});
check('tips: progress persists in storage (crusaders-aerie-tips-v1); skip, skip all, reset, disable and ?test gating',()=>{
 const s=memoryStorage(),t=createTips({storage:s}),f=F();t.begin();run(t,f,3);t.skip();assert.deepEqual(JSON.parse(s.getItem('crusaders-aerie-tips-v1')).done,['move']);
 const t2=createTips({storage:s});t2.begin();run(t2,f,3);assert.equal(t2.active,'fire');t2.skipAll();assert.deepEqual(JSON.parse(s.getItem('crusaders-aerie-tips-v1')).done,[...GUIDE_TIPS]);run(t2,f,10);assert.equal(t2.active,'');
 t2.reset();assert.deepEqual(JSON.parse(s.getItem('crusaders-aerie-tips-v1')).done,[]);run(t2,f,1.1);assert.equal(t2.active,'move');t2.setEnabled(false);assert.equal(t2.active,'');run(t2,f,5);assert.equal(t2.active,'');t2.setEnabled(true);run(t2,f,1);assert.equal(t2.active,'move');
 const blocked=createTips({storage:memoryStorage(),allowed:false});blocked.begin();run(blocked,f,10);assert.equal(blocked.active,'');
 const broken={getItem(){throw Error('denied');},setItem(){throw Error('denied');}},t3=createTips({storage:broken});t3.begin();run(t3,f,3);assert.equal(t3.active,'move');t3.skip();assert.equal(t3.active,'');});
check('createGuide: import-safe and DOM-free in Node; ?test hides tips unless ?tips=1; capture states, hit markers and the ground ring',()=>{
 const c=fakeCtx(),g=createGuide({storage:memoryStorage(),search:'?battle=1&test=1'});assert.equal(typeof g.setTips,'function');assert.equal(typeof g.resetTips,'function');g.attach(c);g.started(c);
 const o=c.objectives[0];c.human.state.x=o.x+3;c.human.state.y=0;c.human.state.z=o.z;o.progress=.4;g.render(.05,c);let s=g.snapshot();assert.equal(s.capture.state,'capturing');assert.equal(s.capture.pct,40);assert.equal(s.ring.visible,true);
 for(let i=0;i<200;i++)g.render(.05,c);assert.equal(g.snapshot().tip.active,'');assert.equal(g.snapshot().tip.allowed,false);
 o.occupants=[1,1];o.contested=true;g.render(.05,c);assert.equal(g.snapshot().capture.state,'contested');o.occupants=[1,0];o.contested=false;g.render(.05,c);o.progress=.3;g.render(.05,c);assert.equal(g.snapshot().capture.state,'contested','progress reversing reads as contested');
 for(let i=0;i<20;i++)g.render(.05,c);o.progress=-.5;o.owner=1;g.render(.05,c);g.render(.05,c);for(let i=0;i<20;i++)g.render(.05,c);assert.equal(g.snapshot().capture.state,'neutralising');assert.equal(g.snapshot().capture.pct,50);
 o.owner=0;o.progress=1;g.event({type:'capture',objective:0,team:0,from:1},c);g.render(.05,c);assert.equal(g.snapshot().capture.state,'held');for(let i=0;i<50;i++)g.render(.05,c);o.mode='charging';o.charge=.25;g.render(.05,c);assert.equal(g.snapshot().capture.state,'arming');assert.equal(g.snapshot().capture.pct,25);
 c.human.state.x=o.x+22;o.owner=-1;o.progress=0;g.render(.05,c);assert.equal(g.snapshot().capture.state,'hint');c.human.mount={};c.human.state.x=o.x+2;g.render(.05,c);assert.equal(g.snapshot().capture.state,'blocked');assert.equal(g.snapshot().ring.visible,false);c.human.mount=null;
 g.event({type:'hit',actor:1,source:0,damage:9,x:1,y:2,z:3},c);assert.equal(g.snapshot().hit.kind,'hit');g.event({type:'down',actor:1,source:0},c);assert.equal(g.snapshot().hit.kind,'kill');
 const g2=createGuide({storage:memoryStorage(),search:'?test=1'}),c2=fakeCtx();g2.attach(c2);g2.started(c2);g2.event({type:'hit',actor:0,source:1,damage:9},c2);assert.equal(g2.snapshot().hit.kind,'',"being hit is not a hit-marker");g2.event({type:'hit',actor:1,source:0,damage:0},c2);assert.equal(g2.snapshot().hit.kind,'');
 c.combat.state.phase='finished';g.render(.05,c);assert.equal(g.snapshot().ring.visible,false);g.stopped(c);
 const g3=createGuide({storage:memoryStorage(),search:'?test=1&tips=1'}),c3=fakeCtx();g3.attach(c3);g3.started(c3);for(let i=0;i<60;i++)g3.render(.05,c3);assert.equal(g3.snapshot().tip.active,'move');g3.setTips(false);g3.render(.05,c3);assert.equal(g3.snapshot().tip.active,'');g3.setTips(true);g3.resetTips();for(let i=0;i<30;i++)g3.render(.05,c3);assert.equal(g3.snapshot().tip.active,'move');});
check('ext members (enabled, active, step, total) follow the tips state; total counts the tips that apply this match',()=>{
 const g2=createGuide({storage:memoryStorage(),search:'?test=1'});for(const k of ['tipsEnabled','enabled','active','step','total'])assert.ok(k in g2,k);
 const c2=fakeCtx();g2.attach(c2);g2.started(c2);for(let i=0;i<60;i++)g2.render(.05,c2);assert.equal(g2.enabled,false);assert.equal(g2.active,'');assert.equal(g2.step,0);assert.equal(g2.total,GUIDE_TIPS.length-1,'fake enemy castle has no protectors');
 const g3=createGuide({storage:memoryStorage(),search:'?test=1&tips=1'}),c3=fakeCtx();g3.attach(c3);g3.started(c3);for(let i=0;i<60;i++)g3.render(.05,c3);
 assert.equal(g3.active,'move');assert.equal(g3.step,1);assert.equal(g3.total,GUIDE_TIPS.length-1);assert.equal(g3.snapshot().tip.total,g3.total);assert.equal(g3.enabled,true);g3.setTips(false);assert.equal(g3.enabled,false);
 const c4=fakeCtx();c4.protectorList.push({id:'p1',team:1,hp:600,point:new T.Vector3(150,60,0)},{id:'p0',team:0,hp:600,point:new T.Vector3(-150,60,0)});g3.started(c4);assert.equal(g3.total,GUIDE_TIPS.length,'enemy protectors: all 7 apply');
 const c5=fakeCtx();c5.combat.state.towerDrain=false;c5.protectorList.push({id:'p0',team:0,hp:600,point:new T.Vector3(-150,60,0)});g3.started(c5);assert.equal(g3.total,GUIDE_TIPS.length-2,'strikes off and only our own protectors');
 c5.human.team=1;g3.started(c5);assert.equal(g3.total,GUIDE_TIPS.length-1,'team 1: the Dawn protector is the enemy one');});
check('tips: Tip n/total numbers only the tips that apply this match, in the order seen, without gaps',()=>{
 const t=createTips({storage:memoryStorage()});t.plan(['protectors']);assert.equal(t.total,6);assert.equal(t.step,0);const f=F();t.begin();run(t,f,3);assert.equal(t.active,'move');assert.equal(t.step,1);
 for(const id of ['move','fire','capture','strike'])t.done.add(id);t.drop();Object.assign(f,{enemyShield:0,enemyProtectors:0,targetKind:'core'});run(t,f,1.3);assert.equal(t.active,'core');assert.equal(t.step,5,'core follows strike (4/6) as 5/6');
 t.event({type:'core-hit',source:0,coreDamage:5},f);run(t,f,1.6);assert.equal(t.finishing,true);assert.equal(t.step,5,'the done beat keeps its number');run(t,f,1);
 Object.assign(f,{running:false,evacuating:true,safe:false,ourDoomed:false});run(t,f,1.5);assert.equal(t.active,'escape');assert.equal(t.step,6);assert.equal(t.total,6);
 const t2=createTips({storage:memoryStorage()});t2.plan(['strike','protectors']);assert.equal(t2.total,5);for(const id of ['move','fire','capture'])t2.done.add(id);t2.begin();run(t2,F({enemyShield:0,targetKind:'core'}),3);assert.equal(t2.active,'core');assert.equal(t2.step,4);
 const t3=createTips({storage:memoryStorage()});t3.plan([]);for(const id of ['move','fire','strike'])t3.done.add(id);t3.begin();run(t3,F(),3);assert.equal(t3.active,'capture');assert.equal(t3.step,4,'seen in an earlier match out of order: still the next number');assert.equal(t3.total,7);
 // A tip dropped early (the core broke within 5 s) still holds its number this match: Escape takes the next one, and the dropped
 // tip comes back in a later match as the last number; a tip shown again in the same match keeps its first number.
 const t5=createTips({storage:memoryStorage()});t5.plan(['protectors']);for(const id of ['move','fire','capture','strike'])t5.done.add(id);t5.begin();const f5=F({enemyShield:0,targetKind:'core'});run(t5,f5,3);assert.equal(t5.active,'core');assert.equal(t5.step,5);
 Object.assign(f5,{running:false,evacuating:true,safe:false});run(t5,f5,.1);assert.equal(t5.active,'');assert.equal(t5.done.has('core'),false);run(t5,f5,1.3);assert.equal(t5.active,'escape');assert.equal(t5.step,6,'no repeated 5');
 f5.safe=true;run(t5,f5,5);assert.ok(t5.done.has('escape'));t5.begin();Object.assign(f5,{running:true,evacuating:false});run(t5,f5,3);assert.equal(t5.active,'core');assert.equal(t5.step,6,'next match: the last applicable number');
 const t6=createTips({storage:memoryStorage()});t6.plan([]);t6.done.add('move');t6.done.add('fire');t6.begin();const f6=F();run(t6,f6,3);assert.equal(t6.active,'capture');assert.equal(t6.step,3);f6.targetKind='defend';f6.held=1;run(t6,f6,.1);assert.equal(t6.active,'');
 run(t6,f6,1.3);assert.equal(t6.active,'strike');assert.equal(t6.step,4);t6.skip();f6.targetKind='silo';run(t6,f6,1.3);assert.equal(t6.active,'capture');assert.equal(t6.step,3,'shown again: same number');
 t6.reset();run(t6,f6,1.1);assert.equal(t6.active,'move');assert.equal(t6.step,1,'Replay tips restarts the count');
 const t4=createTips({storage:memoryStorage()});t4.plan(['protectors','bogus']);assert.equal(t4.total,6);for(const id of ['move','fire','capture','strike'])t4.done.add(id);t4.begin();run(t4,F({enemyShield:0,enemyProtectors:1,targetKind:'protector'}),3);assert.equal(t4.active,'protectors');assert.equal(t4.total,7,'a tip shown anyway rejoins the count');assert.equal(t4.step,5);});
check('capture meter: held with tower strikes off or discharging, arming only while strikes charge; neutralising percent',()=>{
 const c=fakeCtx(),g=createGuide({storage:memoryStorage(),search:'?test=1'});g.attach(c);g.started(c);const o=c.objectives[0];c.human.state.x=o.x+3;c.human.state.y=0;c.human.state.z=o.z;
 o.owner=0;o.progress=1;for(let i=0;i<60;i++)g.render(.05,c);assert.equal(g.snapshot().capture.state,'held');
 c.combat.state.towerDrain=false;o.mode='charging';o.charge=0;g.render(.05,c);assert.equal(g.snapshot().capture.state,'held','tower strikes off');
 c.combat.state.towerDrain=true;g.render(.05,c);assert.equal(g.snapshot().capture.state,'arming');o.mode='discharging';o.charge=.4;g.render(.05,c);assert.equal(g.snapshot().capture.state,'held','discharging');o.mode='armed';g.render(.05,c);assert.equal(g.snapshot().capture.state,'armed');
 o.owner=1;o.progress=-.85;o.mode='idle';for(let i=0;i<20;i++)g.render(.05,c);assert.equal(g.snapshot().capture.state,'neutralising');assert.equal(g.snapshot().capture.pct,15);});
check('strike tip waits for tower strikes and is not used up while they are off',()=>{
 const F=(x={})=>Object.assign({running:true,evacuating:false,playing:true,alive:true,human:0,team:0,enemy:1,x:0,y:0,z:0,flight:false,captures:0,enemyShield:8000,enemyProtectors:0,held:1,safe:true,ourDoomed:false,ring:-1,targetKind:'shield'},x);
 const t=createTips({storage:memoryStorage()});for(const id of ['move','fire','capture'])t.done.add(id);t.begin();const f=F({towerDrain:false});for(let i=0;i<400;i++)t.update(.05,f);assert.equal(t.active,'');assert.equal(t.done.has('strike'),false);
 f.towerDrain=true;for(let i=0;i<10;i++)t.update(.05,f);assert.equal(t.active,'strike');});
console.log('PASS '+checks.length+' battle-guide checks: '+checks.join(' | '));
