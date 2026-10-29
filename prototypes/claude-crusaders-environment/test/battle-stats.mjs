// Session stats (battle-stats.js) and the online-services placeholders (online-services.js) in Node with a fake storage and a
// fake battle ctx (no DOM): import safety, aggregation from finish summaries (wins/losses/stalemates, K/D, captures, damage incl.
// structure damage, revives, tower strikes from tower-impact events, MVPs, best score, time played, favourite class, per-class
// table, last 10 matches), counting a match once, the battle's reset(ctx) hook not wiping stats, persistence/reload in the session
// key, ?test gating, throwing/corrupt storage, reset()/clear(), and the ServiceUnavailableError codes with no network use.
// The sheet UI itself is checked in a browser (Playwright run in the STATS report).
// Usage: node test/battle-stats.mjs   (exit 0 = pass)
import assert from 'node:assert/strict';

// ---------- import safety: no window/document/storage/network access at import or construction ----------
const touched=[],saved={};
for(const k of ['window','document','sessionStorage','localStorage','location','fetch','WebSocket','XMLHttpRequest']){saved[k]=Object.getOwnPropertyDescriptor(globalThis,k);
 Object.defineProperty(globalThis,k,{configurable:true,get(){touched.push(k);return undefined;}});}
const S=await import('../floating-castle/battle-stats.js');
const O=await import('../floating-castle/online-services.js');
const bare=S.createStats(),bareServices=O.createOnlineServices();
assert.deepEqual(touched,[],'import/createStats/createOnlineServices touched '+touched.join(','));
for(const k of Object.keys(saved)){if(saved[k])Object.defineProperty(globalThis,k,saved[k]);else delete globalThis[k];}
void bare;void bareServices;

const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);};
function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m};}
function fakeCtx({team=0,classId='ranger',per=2}={}){const actors=[];for(let t=0;t<2;t++)for(let i=0;i<per;i++)actors.push({id:actors.length,team:t,human:actors.length===0,classId:actors.length===0?classId:'ranger'});
 if(team===1){actors[0].team=1;actors[per].team=0;}return {human:actors[0],actors,dom:{},teamNames:['DAWN','DUSK']};}
function summary({outcome='victory',me={},per=2,team=0,mvp=true,duration=300,reason='core'}={}){
 const actors=[];for(let t=0;t<2;t++)for(let i=0;i<per;i++)actors.push({id:actors.length,name:'Bot',team:t,classId:'ranger',human:false,kills:1,deaths:1,captures:0,damage:10,revives:0,structureDamage:0,score:10,survivalBonus:0,total:10});
 const you=Object.assign(actors[0],{name:'You',human:true,team,classId:'ranger',kills:0,deaths:0,captures:0,damage:0,revives:0,structureDamage:0,score:0,survivalBonus:0},me);you.total=(you.score||0)+(you.survivalBonus||0);
 if(team===1)actors[per].team=0;
 const winner=outcome==='stalemate'?-1:outcome==='victory'?team:1-team;
 return {winner,viewerTeam:team,outcome,duration,reason,actors,mvp:[0,1].map(t=>t===team&&mvp?you.id:null),silos:[1,1],protectorsDestroyed:[0,0]};}
// Runs one match through the extension hooks in the battle.js order (stop/reset/start/started ... finish/finished ... stop/reset/stopped).
function play(ext,ctx,sum,{strikes=[0,0],stopAfter=true}={}){ext.event({type:'stop',time:0},ctx);ext.reset(ctx);ext.event({type:'start',time:0},ctx);ext.started(ctx);
 for(let t=0;t<2;t++)for(let i=0;i<strikes[t];i++)ext.event({type:'tower-impact',team:1-t,attackerTeam:t,objective:0,damage:400,time:10},ctx);
 ext.event({type:'shield-block',team:1,source:0,x:0,y:0,z:0,time:11},ctx);ext.event({type:'finish',winner:sum.winner,survivors:[],time:sum.duration},ctx);ext.finished(sum,ctx);
 if(stopAfter){ext.event({type:'stop',time:sum.duration},ctx);ext.reset(ctx);ext.stopped(ctx);}}
let clock=Date.UTC(2026,9,18,19,0,0);const now=()=>clock;

await check('formatters: K/D with zero deaths, win rate, play time, class labels',()=>{
 assert.equal(S.kd(3,0),'3.00');assert.equal(S.kd(3,2),'1.50');assert.equal(S.kd(0,0),'–','no combat reads as a dash');assert.equal(S.kd(0,3),'0.00');assert.equal(S.winRate(1,3),'33%');assert.equal(S.winRate(0,0),'–');
 assert.equal(S.playTime(75),'1m 15s');assert.equal(S.playTime(3720),'1h 02m');assert.equal(S.playTime(-5),'0m 00s');assert.equal(S.classLabel('mage'),'Mage');assert.equal(S.classLabel('<b>'),'Fighter');});

await check('aggregation: one victory with tower strikes, MVP, structure damage and the local survival bonus',()=>{
 const storage=memoryStorage(),ext=S.createStats({storage,search:'',now}),ctx=fakeCtx();ext.attach(ctx);
 assert.equal(ext.name,'stats');assert.equal(ext.isOpen,false);assert.equal(ext.snapshot().matches,0);
 play(ext,ctx,summary({me:{kills:4,deaths:2,captures:3,damage:500.4,structureDamage:1200,revives:1,score:120,survivalBonus:100},duration:312.5}),{strikes:[2,1]});
 const s=ext.snapshot();
 assert.equal(s.matches,1);assert.equal(s.wins,1);assert.equal(s.losses,0);assert.equal(s.stalemates,0);assert.equal(s.kills,4);assert.equal(s.deaths,2);assert.equal(s.kd,2);
 assert.equal(s.captures,3);assert.equal(s.damage,1700);assert.equal(s.revives,1);assert.equal(s.towerStrikes,2,'only strikes landed by your team');assert.equal(s.mvps,1);assert.equal(s.escapes,1);
 assert.equal(s.bestScore,220,'score includes the survival bonus (summary total)');assert.equal(s.seconds,312.5);assert.equal(s.favouriteClass,'ranger');assert.equal(s.winRate,1);
 assert.equal(s.temporary,true);assert.equal(s.storage,'session');assert.equal(s.key,'crusaders-stats-session-v1');
 const r=s.recent[0];assert.equal(s.recent.length,1);assert.equal(r.size,'2v2');assert.equal(r.mode,'Bot battle');assert.equal(r.outcome,'victory');assert.equal(r.kills,4);assert.equal(r.deaths,2);assert.equal(r.score,220);assert.equal(r.mvp,true);assert.equal(r.at,clock);assert.equal(r.classId,'ranger');
 assert.equal(s.classes.ranger.matches,1);assert.equal(s.classes.ranger.wins,1);assert.equal(s.classes.ranger.bestScore,220);
 assert.ok(storage.map.has(S.STATS_KEY),'saved to the session key');});

await check('aggregation: defeats, stalemates, Dusk seat, per-class table, favourite class and win rate across matches',()=>{
 const ext=S.createStats({storage:memoryStorage(),search:'',now});const a=fakeCtx(),b=fakeCtx({classId:'mage',team:1,per:1});ext.attach(a);
 play(ext,a,summary({me:{kills:2,deaths:1,score:50}}));clock+=60000;
 ext.attach(b);play(ext,b,summary({outcome:'defeat',team:1,per:1,mvp:false,me:{classId:'mage',kills:1,deaths:3,score:30}}),{strikes:[1,2]});clock+=60000;
 play(ext,b,summary({outcome:'stalemate',team:1,per:1,mvp:true,reason:'time',me:{classId:'mage',kills:0,deaths:0,score:5}}));
 const s=ext.snapshot();assert.equal(s.matches,3);assert.equal(s.wins,1);assert.equal(s.losses,1);assert.equal(s.stalemates,1);assert.equal(s.kills,3);assert.equal(s.deaths,4);assert.equal(s.kd,.75);
 assert.equal(s.towerStrikes,2,'Dusk seat counts Dusk strikes');assert.equal(s.mvps,2);assert.equal(s.bestScore,50);assert.equal(s.favouriteClass,'mage');assert.ok(Math.abs(s.winRate-1/3)<1e-9);
 assert.deepEqual([s.classes.mage.matches,s.classes.mage.wins,s.classes.mage.losses,s.classes.mage.stalemates,s.classes.mage.kills,s.classes.mage.deaths],[2,0,1,1,1,3]);
 assert.deepEqual(s.recent.map(r=>[r.outcome,r.size,r.classId,r.reason]),[['stalemate','1v1','mage','time'],['defeat','1v1','mage','core'],['victory','2v2','ranger','core']],'newest first');});

await check('a match counts once: duplicate finished(), finished() without started(), summaries without a local player',()=>{
 const ext=S.createStats({storage:memoryStorage(),search:'',now}),ctx=fakeCtx();ext.attach(ctx);const sum=summary();
 play(ext,ctx,sum,{stopAfter:false});ext.finished(sum,ctx);ext.finished(sum,ctx);assert.equal(ext.snapshot().matches,1,'same match finished twice');
 ext.stopped(ctx);ext.finished(summary({per:3}),ctx);const s=ext.snapshot();assert.equal(s.matches,2,'attached mid-match still counts');assert.equal(s.recent[0].size,'2v2','size from the live roster');
 const late=S.createStats({storage:memoryStorage(),search:'',now});late.finished(summary({per:4}),undefined);assert.equal(late.snapshot().recent[0].size,'4v4','size from the summary when no ctx');
 const none=summary();none.actors.forEach(a=>{a.human=false;a.id+=10;});ext.stopped(ctx);ext.started(ctx);ext.finished(none,ctx);ext.finished(null,ctx);ext.finished({},ctx);assert.equal(ext.snapshot().matches,2);
 assert.equal(ext.snapshot().inMatch,false);});

await check('reset(ctx) from battle.js keeps the stats; reset() and clear() wipe them and the stored key',()=>{
 const storage=memoryStorage(),ext=S.createStats({storage,search:'',now}),ctx=fakeCtx();ext.attach(ctx);play(ext,ctx,summary());
 ext.reset(ctx);ext.reset({combat:{},bots:{}});assert.equal(ext.snapshot().matches,1);
 assert.equal(ext.reset(),true);assert.equal(ext.snapshot().matches,0);assert.ok(!storage.map.has(S.STATS_KEY));
 play(ext,ctx,summary());assert.equal(ext.snapshot().matches,1);ext.reset({clear:true});assert.equal(ext.snapshot().matches,0);
 play(ext,ctx,summary());ext.clear();assert.equal(ext.snapshot().matches,0);assert.equal(ext.snapshot().recent.length,0);});

await check('last 10 matches only, newest first; totals keep every match',()=>{
 const ext=S.createStats({storage:memoryStorage(),search:'',now}),ctx=fakeCtx();ext.attach(ctx);
 for(let i=0;i<13;i++){clock+=1000;play(ext,ctx,summary({me:{kills:i,score:i}}));}
 const s=ext.snapshot();assert.equal(s.matches,13);assert.equal(s.recent.length,10);assert.deepEqual(s.recent.map(r=>r.kills),[12,11,10,9,8,7,6,5,4,3]);assert.equal(s.kills,78);});

await check('persistence: a reload in the same tab restores the record; snapshot() is a copy',()=>{
 const storage=memoryStorage(),a=S.createStats({storage,search:'',now}),ctx=fakeCtx();a.attach(ctx);play(a,ctx,summary({me:{kills:5,deaths:1,score:70}}));
 const before=a.snapshot();before.matches=99;before.recent.length=0;
 const b=S.createStats({storage,search:'',now});const after=b.snapshot();assert.equal(after.matches,1);assert.equal(after.kills,5);assert.equal(after.recent.length,1);assert.equal(after.bestScore,70);
 b.attach(ctx);play(b,ctx,summary({outcome:'defeat',mvp:false}));assert.equal(S.createStats({storage,search:'',now}).snapshot().matches,2);
 const raw=JSON.parse(storage.getItem(S.STATS_KEY));assert.equal(raw.v,1);assert.equal(raw.matches,2);});

await check('?test keeps stats in memory unless ?stats=1; otherwise sessionStorage (accessor throws -> memory)',()=>{
 const fake=memoryStorage(),desc=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:fake});
 try{const ctx=fakeCtx();
  const t=S.createStats({search:'?test=1',now});t.attach(ctx);play(t,ctx,summary());assert.equal(t.snapshot().matches,1);assert.equal(t.snapshot().storage,'memory');assert.equal(fake.map.size,0);
  const t2=S.createStats({search:'?battle=1&test=1&stats=1',now});t2.attach(ctx);play(t2,ctx,summary());assert.ok(fake.map.has(S.STATS_KEY));
  const live=S.createStats({search:'',now});assert.equal(live.snapshot().matches,1,'plain page reads the session key');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('SecurityError');}});
  const blocked=S.createStats({search:'',now});blocked.attach(ctx);play(blocked,ctx,summary());assert.equal(blocked.snapshot().matches,1);assert.equal(blocked.snapshot().storage,'memory');}
 finally{if(desc)Object.defineProperty(globalThis,'sessionStorage',desc);else delete globalThis.sessionStorage;}});

await check('throwing and corrupt storage never throw: bad JSON, wrong version, hostile fields, quota errors',()=>{
 const ctx=fakeCtx();const thrower={getItem(){throw new Error('denied');},setItem(){throw new Error('QuotaExceededError');},removeItem(){throw new Error('denied');}};
 const t=S.createStats({storage:thrower,search:'',now});t.attach(ctx);play(t,ctx,summary());assert.equal(t.snapshot().matches,1);assert.equal(t.clear(),true);
 for(const bad of ['not json','null','[]','{"v":2,"matches":5}','{"v":1,"matches":"lots"}']){const st=memoryStorage();st.setItem(S.STATS_KEY,bad);assert.equal(S.createStats({storage:st,search:'',now}).snapshot().matches,0,bad);}
 const st=memoryStorage();st.setItem(S.STATS_KEY,JSON.stringify({v:1,since:5,matches:-3,wins:2,losses:1,stalemates:0,kills:1e400,deaths:'2',classes:{'__proto__':{matches:9},constructor:{matches:2,wins:1,last:1},'<img>':{matches:5},mage:{matches:1,kills:-4}},
  recent:[null,{outcome:'victory',mode:'x'.repeat(200),size:'2v2',kills:3,deaths:'1',classId:'<script>',at:1},{outcome:'won'},...Array(20).fill({outcome:'defeat',size:'1v1'})]}));
 const s=S.createStats({storage:st,search:'',now}).snapshot();
 assert.equal(s.matches,3,'matches never below wins+losses+stalemates');assert.equal(s.kills,0,'Infinity dropped');assert.equal(s.deaths,2);
 assert.deepEqual(Object.keys(s.classes).sort(),['constructor','mage']);assert.equal(s.classes.mage.kills,0);assert.equal(Object.getPrototypeOf(s.classes),Object.prototype);
 assert.equal(s.recent.length,10);assert.equal(s.recent[0].mode.length,40);assert.equal(s.recent[0].classId,'ranger');assert.equal(s.recent[0].deaths,1);
 const ext=S.createStats({storage:st,search:'',now});ext.attach(ctx);play(ext,ctx,summary({me:{classId:'constructor'}}));assert.equal(ext.snapshot().classes.constructor.matches,3);});

await check('online-services: every call rejects with ServiceUnavailableError (code BANDEROV_SDK_NOT_INTEGRATED) and never touches the network',async()=>{
 const net=[];const desc={};for(const k of ['fetch','WebSocket','XMLHttpRequest','EventSource']){desc[k]=Object.getOwnPropertyDescriptor(globalThis,k);Object.defineProperty(globalThis,k,{configurable:true,get(){net.push(k);return ()=>{throw new Error('network');};}});}
 try{const svc=O.createOnlineServices();assert.equal(svc.available,false);
  const calls={getAccount:[],saveStats:[{matches:1}],loadStats:[],fetchLeaderboard:['wins'],findMatch:[{teamSize:2}],reportMatch:[summary()]},features={getAccount:'account',saveStats:'save-stats',loadStats:'load-stats',fetchLeaderboard:'leaderboard',findMatch:'matchmaking',reportMatch:'report-match'};
  for(const [m,args] of Object.entries(calls)){const p=svc[m](...args);assert.ok(p instanceof Promise,m+' returns a promise');
   await assert.rejects(p,e=>e instanceof O.ServiceUnavailableError&&e instanceof Error&&e.name==='ServiceUnavailableError'&&e.code==='BANDEROV_SDK_NOT_INTEGRATED'&&e.code===O.SERVICE_CODE&&e.feature===features[m]&&O.isServiceUnavailable(e)&&/isn't available yet\.$/.test(e.message),m);}
  assert.ok(O.SERVICE_FEATURES.includes('matchmaking'));assert.equal(O.isServiceUnavailable(new Error('x')),false);assert.equal(O.isServiceUnavailable({code:'BANDEROV_SDK_NOT_INTEGRATED'}),true);
  const e=new O.ServiceUnavailableError('save-stats');assert.equal(e.message,"Online saving isn't available yet.");assert.ok(String(e.stack).includes('ServiceUnavailableError'));
  assert.deepEqual(net,[],'no network API was even looked up');}
 finally{for(const k of Object.keys(desc)){if(desc[k])Object.defineProperty(globalThis,k,desc[k]);else delete globalThis[k];}}});

await check('online-services: accountUrl is same-origin on banderov.com (and subdomains), the public site elsewhere',()=>{
 const url=h=>O.createOnlineServices({location:{hostname:h}}).accountUrl();
 assert.equal(url('banderov.com'),'/account/');assert.equal(url('www.banderov.com'),'/account/');assert.equal(url('games.Banderov.com'),'/account/');
 for(const h of ['notbanderov.com','banderov.com.evil.test','localhost','127.0.0.1','',undefined])assert.equal(url(h),'https://banderov.com/account/',String(h));
 assert.equal(O.createOnlineServices({location:null}).accountUrl(),'https://banderov.com/account/');
 assert.equal(O.createOnlineServices({get location(){throw new Error('x');}}).accountUrl(),'https://banderov.com/account/');});

await check('a match with no knockouts and no downs: K/D text is a dash, snapshot K/D stays a number; the mode follows the shell origin',()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis,'document');globalThis.document={body:{dataset:{matchOrigin:'quick'}},getElementById:()=>null};
 try{const ext=S.createStats({storage:memoryStorage(),search:'',now}),ctx=fakeCtx();ext.attach(ctx);play(ext,ctx,summary({me:{kills:0,deaths:0,score:0}}));
  const s=ext.snapshot();assert.equal(s.kd,0);assert.equal(S.kd(s.kills,s.deaths),'–');assert.equal(s.recent[0].mode,'Quick Battle');}
 finally{if(saved)Object.defineProperty(globalThis,'document',saved);else delete globalThis.document;}});

await check('battle-stats uses the injected services; open() without a DOM is a safe no-op',()=>{
 let used=0;const ext=S.createStats({storage:memoryStorage(),search:'',now,services:{accountUrl(){used++;return '/account/';}}});
 assert.equal(ext.services.accountUrl(),'/account/');assert.equal(used,1);assert.equal(ext.open(),false);assert.equal(ext.isOpen,false);assert.equal(ext.close(),false);assert.equal(ext.toggle(),false);
 const lazy=S.createStats({storage:memoryStorage(),search:''});assert.equal(typeof lazy.services.saveStats,'function','default services are created lazily');});

console.log(checks.map(c=>'ok - '+c).join('\n'));console.log(checks.length+' checks passed');
