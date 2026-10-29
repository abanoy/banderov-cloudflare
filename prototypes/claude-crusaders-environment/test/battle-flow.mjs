// Battle flow contract checks that need no browser: battle.js stays importable in Node (no DOM at
// module top level), the setup/results markup keeps every id the game and tests rely on, and a
// finite match length always ends a match, including with charging tower strikes switched off.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBattleCombat,BATTLE_RULES} from '../floating-castle/battle-combat.js';
import {createBattleSpawns} from '../floating-castle/battle-spawns.js';
import {castWard,WARD} from '../floating-castle/battle-professions.js';

globalThis.document={createElement(){return {width:0,height:0,getContext(){return new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}};}};
const checks=[],check=(name,fn)=>{fn();checks.push(name);console.log('ok -',name);};
const source=fs.readFileSync(new URL('../floating-castle/battle.js',import.meta.url),'utf8');

const battle=await import('../floating-castle/battle.js');
check('battle.js imports in Node and keeps its exports',()=>{for(const name of ['createBattle','resetBotBillboardFacing','updateBotBillboardFacing','computeBattleBlastZones'])assert.equal(typeof battle[name],'function',name);});
check('Setup and results markup keep the ids used by start(), tests and other packages',()=>{
 for(const id of ['battle-panel','battle-title','battle-load-status','battle-load-details','battle-class','battle-team-size','battle-castle-source','battle-castle-level','battle-bot-skill','battle-match-length','battle-tower-drain','watch-recruitment-start','battle-plan-summary','battle-close','battle-leave','battle-start','battle-result','battle-winner','battle-result-text','battle-result-stats','battle-restart','battle-change-setup','battle-exit','battle-main-menu'])assert(source.includes('id="'+id+'"')||source.includes(".id='"+id+"'"),'missing #'+id);
 assert(/<option value="50" selected>/.test(source),'enemy castle defaults to level 50');assert(/<option value="20" selected>20 min/.test(source),'match length defaults to 20 min');assert(/<option value="soldier" selected>/.test(source),'bot skill defaults to soldier');assert(/<option value="8" selected>8v8/.test(source),'match size stays 8v8');
 for(const v of [1,2,4,8,16,32,64])assert(source.includes('<option value="'+v+'"'),'team size '+v);
 assert(!/No reachable castle proposal/.test(source),'no raw validator text in battle.js');});
check('Battle-return members exist and none sit between worldChanged and get active',()=>{
 const region=source.slice(source.indexOf('worldChanged(){'),source.indexOf('},get active()'));assert(!/leave|quickStart|resultOpen|setupStage|cancelSetup|closeOverlays/.test(region));
 for(const m of ['leave,','cancelSetup,','closeOverlays,','get resultOpen()','get setupStage()','quickStart,','use,','get lastSummary()'])assert(source.includes(m),m);});

check('Fix round: lifecycle, scoreboard key, notifications policy, cadence and quickStart aliases',()=>{
 const startFn=source.slice(source.indexOf('async function start(){'),source.indexOf('function stop(){'));
 assert(/^async function start\(\)\{if\(preparing\)return;onMessage\(''\);spawnMap\?\.close\(\);/.test(startFn),'start() closes the spawn map before a new setup');
 assert(/setVisible\(false\);fan\('stopped',ctx\);onStopped\(\);\}preparing=false/.test(startFn),'cancelled/failed setup fans stopped before onStopped');
 assert(/opts\.castleSource\?\?opts\.friendly\?\?opts\.source/.test(source),'quickStart reads the shell key source');
 for(const k of ['opts.classId??opts.class','opts.teamSize??opts.size','opts.castleLevel??opts.level','opts.botSkill??opts.skill','opts.matchLength??opts.length'])assert(source.includes(k),k);
 assert(/KeyK'&&!e\.repeat\)\{if\(e\.shiftKey&&devMode\)board\.open=!board\.open;else document\.body\.classList\.toggle\('scoreboard-open'\)/.test(source),'K toggles the scoreboard, Shift+K the dev board');
 for(const t of ['protector-down','gate-down','battery-off','shield-collapse','capture'])assert(source.includes("if(e.type==='"+t+"'&&!handled('announce'))onMessage("),'announcer covers '+t);
 assert(source.includes("if(!handled('announce'))onMessage(ours&&theirs?"),'announcer covers evacuate');
 const cadence=source.slice(source.indexOf('setText(cadence,'),source.indexOf('function approachOutcome'));
 assert(!cadence.includes("' | SCORE '"),'no score on the cadence line');assert(/\(aimDebug&&aimState\?' \| '\+aimState\.label/.test(cadence),'aim readout only with ?dev');
 assert(/matchup:\{class:classId0,size,level:level0/.test(source),'setup progress reports a structured matchup');
 assert(source.includes("<button id=\"fleet-up\">R · Rise</button><button id=\"fleet-down\">C · Lower</button>"),'chariot chips carry their real keys');});

check('MVP never goes to a player whose only score is the survival bonus',()=>{
 const rank=source.slice(source.indexOf('const rankSummaryActors='),source.indexOf(';',source.indexOf('const rankSummaryActors='))+1),mvp=source.slice(source.indexOf('mvp:[0,1].map(')+4,source.indexOf(',silos:[0,1]'));
 const pick=new Function('actors',rank+'return '+mvp+';'),row=(id,team,o={})=>({id,team,kills:0,deaths:0,captures:0,damage:0,revives:0,structureDamage:0,score:0,survivalBonus:0,total:0,...o});
 assert.deepEqual(pick([row(0,0,{survivalBonus:100,total:100}),row(1,1,{survivalBonus:100,total:100})]),[null,null],'all-zero survivors get no MVP');
 assert.deepEqual(pick([row(0,0,{survivalBonus:100,total:100}),row(2,0,{kills:1,score:20,total:20}),row(1,1,{captures:1,score:25,total:25})]),[2,1],'the teammate who fought is MVP even below a survivor');});

check('Fix round 2: setup teardown parity/once, cooldowns contract, cadence and copy',()=>{
 const startFn=source.slice(source.indexOf('async function start(){'),source.indexOf('function stop(){')),stopFn=source.slice(source.indexOf('function stop(){'),source.indexOf('function open(){'));
 assert(/if\(combat\.state\.phase==='idle'&&!controller\.torndown\)\{gates\.clear\(\);logistics\.clear\(\);chariots\.reset\(\);fleet\.reset\(\);castleSetup\?\.restoreMatch\(\);/.test(startFn),'cancelled/failed setup clears logistics rigs and skips a teardown stop() already did');
 assert(stopFn.includes('if(prepareController){prepareController.torndown=true;prepareController.abort();}'),'stop() marks the setup it tears down');
 assert(source.includes('hooks:flowHooks,cooldowns}')&&source.includes('quickStart,use,cooldowns,'),'cooldowns() on ctx and on the battle return');
 const cool=source.slice(source.indexOf('function cooldowns(){'),source.indexOf('return cool;}',source.indexOf('function cooldowns(){')));for(const k of ['cool.ward=','cool.wardSec=','cool.restock=','cool.restockSec=','cool.reload=','cool.reloadSec=','cool.hammer='])assert(cool.includes(k),k);assert(!/\{[a-z]+:|\[\]|new |\.map\(|\.filter\(/.test(cool),'cooldowns() allocates nothing');
 assert(source.includes("if(e.code==='KeyH'&&!e.repeat){castHuman();")&&/Ward recharging · ready in '\+wait\+'s\./.test(source),'H explains a failed ward');
 const cadence=source.slice(source.indexOf('setText(cadence,'),source.indexOf('function approachOutcome'));assert(!cadence.includes("ammo.reloadIn>0?'RELOADING':")&&!cadence.includes('% - HOLD FIRE'),'RELOADING shown once, dot separators');
 assert(source.includes("!me.mount&&me.alive&&chariots.nearestBoardable?.(me)?hint(' · R chariot','')"),'R chariot hint only on foot next to a chariot');
 assert(source.includes("plural(combat.state.kills,'knockout','knockouts')")&&source.includes("plural(aliveProtectors.length,'GUARD','GUARDS')"),'plural copy');
 assert(!source.includes('F / R buttons'),'touch help names the HUD labels');});
check('Spawns: a lost silo selection falls back to the castle, says why, and resets the selection',()=>{
 const castle={visible:true,updateWorldMatrix(){},traverse(){}},world={pads:[{x:-130,y:55,z:0},{x:130,y:55,z:0}],castles:[castle,castle]},navigation={nodes:[],nearest:p=>({x:p.x,y:p.y,z:p.z})},objectives=[{id:0,label:'T1 · NORTHWEST',owner:0,contested:false,x:50,y:0,z:0}];
 const human={id:0,team:0,human:true,alive:true,ordinal:0,state:{x:0,y:0,z:0}},spawns=createBattleSpawns({world,navigation,actors:[human],objectives,getCombat:()=>({state:{cores:[100,100]}})});
 assert(spawns.select('silo-0-0'));assert(spawns.place(human));assert.equal(spawns.lastPlaced.fallback,false);assert.equal(spawns.lastPlaced.label,'T1 · NORTHWEST · Landing');
 objectives[0].owner=1;assert(spawns.place(human));const r=spawns.lastPlaced;assert.equal(r.fallback,true);assert.equal(r.reason,'lost');assert.equal(r.wantedLabel,'T1 · NORTHWEST');assert.equal(r.label,'Castle · First landing');assert.equal(spawns.selected,'castle-0-0');assert.equal(human.state.x,-130);
 objectives[0].owner=0;objectives[0].contested=false;assert(spawns.select('silo-0-0'));objectives[0].contested=true;spawns.place(human);assert.equal(spawns.lastPlaced.reason,'contested');});
check('Ward constants keep the 35 mana / 10 s rule',()=>{
 assert.deepEqual({...WARD},{mana:35,seconds:10,regen:2});assert(Object.isFrozen(WARD));const a={classId:'mage',alive:true,mana:40,spellUntil:0,team:0,state:{x:0,y:0,z:0}};assert(castWard(a,[a],5));assert.equal(a.mana,5);assert.equal(a.spellUntil,15);assert.equal(castWard(a,[a],6),false);});

// Two lone fighters far apart: no damage happens, so only the clock can end the match.
function lonely({towerDrain}){const actors=[0,1].map(i=>({id:i,team:i,human:i===0,weapon:0,radius:.65,state:{x:i?400:-400,y:.77,z:0,grounded:true,flight:false,falls:0}})),events=[];
 const combat=createBattleCombat({actors,objectives:[],towerDrain,onEvent:e=>events.push(e)});return {combat,events};}
check('A finite match length ends a no-damage match by the shield + core tiebreak',()=>{
 const {combat,events}=lonely({towerDrain:true});assert.equal(combat.setMatchSeconds(60),60);combat.start();for(let i=0;i<61*20&&combat.state.phase==='running';i++)combat.step(.05);
 assert.equal(combat.state.phase,'finished');assert.equal(combat.state.winner,-1,'equal totals are a stalemate');assert(Math.abs(combat.state.time-60)<.06);assert.equal(events.at(-1).type,'finish');assert.equal(BATTLE_RULES.matchSeconds,Infinity);});
check('Tower strikes off plus a time limit can still be won on time',()=>{
 const {combat}=lonely({towerDrain:false});combat.setMatchSeconds(30);combat.start();combat.state.cores[1]-=500;for(let i=0;i<31*20&&combat.state.phase==='running';i++)combat.step(.05);
 assert.equal(combat.state.phase,'finished');assert.equal(combat.state.winner,0);});
check('Unlimited length (0) never ends by time; setMatchSeconds keeps BATTLE_RULES frozen',()=>{
 const {combat}=lonely({towerDrain:false});assert.equal(combat.setMatchSeconds(0),Infinity);combat.start();for(let i=0;i<120*20;i++)combat.step(.05);assert.equal(combat.state.phase,'running');assert(Object.isFrozen(BATTLE_RULES));});
console.log(JSON.stringify({passed:true,checks:checks.length}));
