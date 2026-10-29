// Battle music logic in Node with a fake AudioContext (no browser): import safety, ?test gating, lazy unlock, title/explore/
// off modes and crossfades, battle layers following match state (percussion, shield down, core exposed, evacuation),
// event and finish stingers, stop on stopped()/reset(), pause duck, setVolume/setEnabled, the timer-driven lookahead
// scheduler (no node creation per tick, nothing scheduled in the past, lookahead grows when timers stall) and the key.
// Usage: node test/battle-music.mjs   (exit 0 = pass). Audio itself is checked by offline renders in a browser.
import assert from 'node:assert/strict';
const globalsBefore=['window','document','AudioContext','webkitAudioContext'].filter(k=>k in globalThis);
const {createMusic,MUSIC_INFO}=await import('../floating-castle/battle-music.js');

const checks=[];const check=(name,fn)=>{fn();checks.push(name);};
const warnings=[];const warn0=console.warn;console.warn=(...a)=>{warnings.push(a.map(String).join(' '));};

// ---------- fake WebAudio: params record their automation, nodes record connections ----------
function makeAudio(){
 const log={contexts:[],created:0,oscillators:0,past:0,stops:0};
 class Param{constructor(ctx,v){this.ctx=ctx;this.v=v;this.goal=v;this.ev=0;}
  get value(){return this.v;}set value(v){this.v=this.goal=v;}
  at(t){this.ev++;if(t<this.ctx.currentTime-1e-6)log.past++;}
  setValueAtTime(v,t){this.at(t);this.value=v;return this;}
  setTargetAtTime(v,t,tau){this.at(t);assert.ok(tau>0,'setTargetAtTime needs tau>0');this.goal=v;return this;}
  linearRampToValueAtTime(v,t){this.at(t);this.goal=v;return this;}
  exponentialRampToValueAtTime(v,t){this.at(t);this.goal=v;return this;}
  cancelScheduledValues(){return this;}}
 class Node{constructor(ctx,kind){this.ctx=ctx;this.kind=kind;this.outs=new Set();ctx.nodes.push(this);log.created++;}
  connect(d){assert.ok(d,'connect target');this.outs.add(d);return d;}
  disconnect(d){if(d===undefined)this.outs.clear();else{assert.ok(this.outs.has(d),'disconnect from a node that is not connected');this.outs.delete(d);}}}
 class Ctx{constructor(){this.currentTime=0;this.sampleRate=48000;this.state='suspended';this.nodes=[];this.resumes=0;this.suspends=0;this.destination={kind:'destination',outs:new Set()};log.contexts.push(this);}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
  suspend(){this.suspends++;this.state='suspended';return Promise.resolve();}
  createGain(){const n=new Node(this,'gain');n.gain=new Param(this,1);return n;}
  createBiquadFilter(){const n=new Node(this,'filter');n.type='lowpass';n.frequency=new Param(this,350);n.Q=new Param(this,1);return n;}
  createOscillator(){const n=new Node(this,'osc');log.oscillators++;n.type='sine';n.frequency=new Param(this,440);n.detune=new Param(this,0);n.start=()=>{n.started=true;};n.stop=()=>{n.stopped=true;log.stops++;};return n;}
  createStereoPanner(){const n=new Node(this,'pan');n.pan=new Param(this,0);return n;}
  createDynamicsCompressor(){const n=new Node(this,'comp');for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param(this,0);return n;}
  createConvolver(){return new Node(this,'conv');}
  createDelay(){const n=new Node(this,'delay');n.delayTime=new Param(this,0);return n;}
  createBufferSource(){const n=new Node(this,'buffer');n.start=()=>{n.started=true;};n.stop=()=>{n.stopped=true;log.stops++;};return n;}
  createBuffer(ch,len,sr){const d=Array.from({length:ch},()=>new Float32Array(len));return {length:len,sampleRate:sr,numberOfChannels:ch,getChannelData:c=>d[c]};}}
 return {Ctx,log};
}
// Manual timers + clock so the test drives the scheduler exactly like setInterval would.
function makeTimers(){const T={wall:0,intervals:new Map(),timeouts:[],id:0,
  setInterval(fn,ms){const id=++T.id;T.intervals.set(id,{fn,ms});return id;},clearInterval(id){T.intervals.delete(id);},
  setTimeout(fn){T.timeouts.push(fn);return ++T.id;},flushTimeouts(){const q=T.timeouts.splice(0);for(const f of q)f();}};return T;}
function fakeBattle(team=0){const state={phase:'running',shields:[8000,8000],cores:[16000,16000],time:0,evacuationEnds:null,doomedTeams:[]};
 const prot=[{team:0,hp:500},{team:0,hp:500},{team:1,hp:500},{team:1,hp:500}],P={paused:false};
 return {state,prot,P,ctx:{human:{team},combat:{state},protectors:()=>prot,get paused(){return P.paused;},get playing(){return state.phase==='running'||state.phase==='evacuation';},get phase(){return state.phase;}}};}
// Rig: music + fake audio + timers; run(seconds) advances audio time and wall clock in 50 ms timer ticks.
function rig(o={}){const A=makeAudio(),T=makeTimers(),B=fakeBattle(o.team);
 const m=createMusic({AudioContext:A.Ctx,timers:T,clock:o.realClock?()=>performance.now():()=>T.wall,search:o.search??''});m.attach(B.ctx);
 const ac=()=>A.log.contexts[0];
 const run=(sec,dt=.05)=>{for(let t=0;t<sec-1e-9;t+=dt){const c=ac();if(c&&c.state==='running')c.currentTime+=dt;T.wall+=dt*1000;B.state.time+=dt;for(const {fn} of [...T.intervals.values()])fn();}};
 return {m,A,T,B,ac,run,snap:()=>m.snapshot()};}
// The master gain: gain -> pause gain -> pause low-pass -> limiter -> destination.
function graph(c){const into=t=>c.nodes.filter(n=>n.outs.has(t));const comp=into(c.destination)[0],lp=into(comp)[0],pauseG=into(lp)[0],master=into(pauseG)[0];return {comp,lp,pauseG,master};}

check('import-safe: no window/document/AudioContext at import, MUSIC_INFO describes three loops and all stingers',()=>{
 assert.deepEqual(globalsBefore,[]);for(const k of ['window','document','AudioContext'])assert.ok(!(k in globalThis),k+' defined');
 assert.deepEqual(Object.keys(MUSIC_INFO.songs),['title','explore','battle']);
 for(const [id,s] of Object.entries(MUSIC_INFO.songs)){assert.equal(s.bars,16,id);assert.ok(s.loopSeconds>20&&s.loopSeconds<60,id+' loop '+s.loopSeconds);}
 assert.deepEqual([...MUSIC_INFO.stingers].sort(),['capture-lost','capture-own','capture-them','defeat','evac-enemy','evac-ours','exposed-enemy','exposed-ours','protector-enemy','protector-ours','shield-enemy','shield-ours','stalemate','victory']);
});

check('one key family: title/explore in C major, battle in A minor with the G# leading tone, finish fanfares in key',()=>{
 const CMAJ=[0,2,4,5,7,9,11],within=(pcs,set)=>pcs.every(p=>set.includes(p));
 assert.deepEqual(MUSIC_INFO.songs.title.pitchClasses,CMAJ);assert.deepEqual(MUSIC_INFO.songs.explore.pitchClasses,CMAJ);
 assert.deepEqual(MUSIC_INFO.songs.battle.pitchClasses,[0,2,4,5,7,8,9,11]);
 for(const [id,pcs] of Object.entries(MUSIC_INFO.stingerPitchClasses))assert.ok(within(pcs,CMAJ),id+' absolute notes leave the key: '+pcs);
 assert.ok(MUSIC_INFO.stingerPitchClasses.victory.length>=3&&MUSIC_INFO.stingerPitchClasses.defeat.length>=3);
});

check('Node without WebAudio: every hook is a safe no-op and unlock() reports false',()=>{
 const m=createMusic({search:''}),B=fakeBattle();
 m.attach(B.ctx);assert.equal(m.unlock(),false);m.setMode('title');m.started(B.ctx);m.event({type:'capture',team:0,from:1},B.ctx);m.render(.016,B.ctx);m.tick();
 m.finished({winner:0,viewerTeam:0,outcome:'victory'},B.ctx);m.stopped(B.ctx);m.reset(B.ctx);assert.equal(m.setVolume(.3),.3);assert.equal(m.setEnabled(false),false);assert.equal(m.setEnabled(true),true);
 assert.equal(m.snapshot().state,'locked');assert.equal(m.sting('victory'),false);
});

check('lazy unlock: no AudioContext until unlock(); ?test blocks audio unless ?music=1',()=>{
 const r=rig();r.m.setMode('title');r.m.setVolume(.4);r.m.started(r.B.ctx);r.m.stopped(r.B.ctx);r.run(.5);
 assert.equal(r.A.log.contexts.length,0,'context created before a gesture');assert.equal(r.snap().state,'locked');
 assert.equal(r.m.unlock(),true);assert.equal(r.A.log.contexts.length,1);assert.equal(r.ac().state,'running');assert.ok(r.snap().built);
 assert.equal(r.m.unlock(),true);assert.equal(r.A.log.contexts.length,1,'second unlock makes a second context');
 for(const search of ['?test=1','?battle=1&test=1','?test=1&music=0']){const t=rig({search});t.m.setMode('title');assert.equal(t.m.unlock(),false,search);assert.equal(t.m.setEnabled(false),false);assert.equal(t.m.setEnabled(true),true);t.run(.3);assert.equal(t.A.log.contexts.length,0,search);assert.equal(t.snap().blocked,true);}
 const ok=rig({search:'?test=1&music=1'});assert.equal(ok.m.unlock(),true);assert.equal(ok.A.log.contexts.length,1);assert.equal(ok.snap().blocked,false);
});

check('modes: title -> explore crossfades (old loop fades, new one starts on its bar 1), off goes quiet and suspends, invalid ignored',()=>{
 const r=rig();r.m.setMode('title');r.m.unlock();r.run(.3);let s=r.snap();assert.equal(s.song,'title');assert.ok(s.notes>0,'title plays notes');
 assert.equal(r.m.setMode('bogus'),'title');assert.equal(r.snap().target,'title');
 r.m.setMode('explore');s=r.snap();assert.equal(s.target,'explore');assert.equal(s.song,'title','switches at once');assert.equal(s.pending,'explore');
 r.run(1.2);assert.equal(r.snap().song,'title','old loop still fading');r.run(1.2);s=r.snap();assert.equal(s.song,'explore');assert.equal(s.pending,false);
 const n0=r.snap().notes;r.run(3);assert.ok(r.snap().notes>n0,'explore plays notes');
 r.m.setMode('off');r.run(2.5);s=r.snap();assert.equal(s.song,null);const n1=s.notes;r.run(3);assert.equal(r.snap().notes,n1,'notes while off');
 assert.equal(r.ac().state,'suspended','idle context suspended to save CPU');assert.equal(r.snap().idle,true);
 r.m.setMode('title');assert.equal(r.ac().state,'running','title resumes the context');r.run(2.5);assert.equal(r.snap().song,'title');
});

check('battle layers: base -> percussion after two bars while running -> lead/brass when a shield is down -> bells/crash when a core is exposed -> ticking clock in evacuation',()=>{
 const r=rig();r.m.setMode('title');r.m.unlock();r.run(.5);r.m.started(r.B.ctx);r.run(1.5);
 let s=r.snap();assert.equal(s.song,'battle');assert.equal(s.battle,'battle');assert.deepEqual(s.layers,[1,0,0,0,0],'intro: base only');
 r.run(4);assert.deepEqual(r.snap().layers,[1,1,0,0,0],'percussion once running');
 r.B.state.shields[1]=0;r.run(2);s=r.snap();assert.equal(s.intensity,1);assert.deepEqual(s.layers,[1,1,1,0,0],'shield down adds the lead layer');
 r.B.prot[2].hp=0;r.run(1);assert.equal(r.snap().intensity,1,'one protector still up');r.B.prot[3].hp=0;r.run(2);s=r.snap();assert.equal(s.intensity,2);assert.deepEqual(s.layers,[1,1,1,1,0],'core exposed');
 r.B.state.phase='evacuation';r.B.state.evacuationEnds=r.B.state.time+60;r.run(.6);s=r.snap();assert.equal(s.evacuation,true);assert.equal(s.layers[4],1,'tick layer starts on the next beat');r.run(2);assert.ok(Math.abs(r.snap().layers[2]-.7)<1e-6,'lead steps back under the clock');
 const late=rig();late.m.unlock();late.m.started(late.B.ctx);late.run(2);late.B.state.phase='evacuation';late.B.state.evacuationEnds=late.B.state.time+20;const a=late.snap().notes;late.run(4);const b=late.snap().notes;
 late.B.state.evacuationEnds=late.B.state.time+200;late.run(4);const c=late.snap().notes;assert.ok(b-a>c-b,'last 30 s ticks in 16ths: '+(b-a)+' vs '+(c-b));
 const own=rig();own.m.unlock();own.m.started(own.B.ctx);own.B.state.shields[0]=0;own.B.prot[0].hp=own.B.prot[1].hp=0;own.run(3);assert.equal(own.snap().intensity,2,'our exposed core raises intensity too');
});

check('event stingers: silo captured by us / from us / between others, shield collapse, protector down vs last protector, evacuation; priority keeps bigger news',()=>{
 const r=rig();r.m.unlock();r.m.started(r.B.ctx);r.run(2);const C=r.B.ctx;
 const ev=(e,want)=>{r.m.event(e,C);assert.equal(r.snap().lastSting,want,JSON.stringify(e));r.run(4);};
 ev({type:'capture',team:0,from:-1},'capture-own');ev({type:'capture',team:1,from:0},'capture-lost');ev({type:'capture',team:1,from:-1},'capture-them');
 ev({type:'shield-collapse',team:1},'shield-enemy');ev({type:'shield-collapse',team:0},'shield-ours');
 r.B.prot[2].hp=0;ev({type:'protector-down',team:1,id:2},'protector-enemy');r.B.prot[3].hp=0;ev({type:'protector-down',team:1,id:3},'exposed-enemy');
 r.B.prot[0].hp=0;ev({type:'protector-down',team:0,id:0},'protector-ours');r.B.prot[1].hp=0;ev({type:'protector-down',team:0,id:1},'exposed-ours');
 ev({type:'evacuate',doomedTeams:[1]},'evac-enemy');ev({type:'evacuate',doomedTeams:[0]},'evac-ours');
 const n=r.snap().stings;r.m.event({type:'shot'},C);r.m.event({type:'protector-hit',team:1},C);r.m.event(null,C);assert.equal(r.snap().stings,n,'other events stay silent');
 r.m.event({type:'shield-collapse',team:1},C);r.run(.1);r.m.event({type:'capture',team:0,from:1},C);assert.equal(r.snap().lastSting,'shield-enemy','smaller sting cut into a bigger one');
 r.m.event({type:'evacuate',doomedTeams:[1]},C);assert.equal(r.snap().lastSting,'evac-enemy','bigger news interrupts');
 const t1=rig({team:1});t1.m.unlock();t1.m.started(t1.B.ctx);t1.run(1);t1.m.event({type:'capture',team:1,from:0},t1.B.ctx);assert.equal(t1.snap().lastSting,'capture-own','viewer on Dusk');
 const pre=rig();pre.m.unlock();pre.m.setMode('title');pre.run(1);pre.m.event({type:'capture',team:0,from:1},pre.B.ctx);assert.equal(pre.snap().stings,0,'no battle stingers outside a match');
});

check('finish: victory / defeat / stalemate stinger, the loop fades out; stopped() and reset() stop battle music and return to the shell mode',()=>{
 for(const [summary,want] of [[{winner:0,viewerTeam:0,outcome:'victory'},'victory'],[{winner:1,viewerTeam:0,outcome:'defeat'},'defeat'],[{winner:-1,viewerTeam:0,outcome:'stalemate'},'stalemate'],[{winner:1,viewerTeam:1},'victory'],[{winner:-1},'stalemate']]){
  const r=rig({team:summary.viewerTeam??0});r.m.setMode('title');r.m.unlock();r.m.started(r.B.ctx);r.run(3);r.B.state.phase='finished';r.m.finished(summary,r.B.ctx);
  let s=r.snap();assert.equal(s.lastSting,want,JSON.stringify(summary));assert.equal(s.battle,'finish');assert.equal(s.target,null);r.run(2.5);s=r.snap();assert.equal(s.song,null,'loop faded out');r.run(3);assert.equal(r.snap().sting,null,'stinger fully scheduled');
  r.m.finished(summary,r.B.ctx);assert.equal(r.snap().stings,1,'second finished() ignored');
  r.m.event({type:'capture',team:0,from:1},r.B.ctx);assert.equal(r.snap().stings,1,'no stingers after the finish');
  r.m.stopped(r.B.ctx);s=r.snap();assert.equal(s.battle,'idle');assert.equal(s.target,'title');r.run(1);assert.equal(r.snap().song,'title','back to the title loop');}
 const r=rig();r.m.setMode('explore');r.m.unlock();r.m.started(r.B.ctx);r.run(3);r.m.finished({winner:0,viewerTeam:0,outcome:'victory'},r.B.ctx);r.run(1);r.m.setMode('explore');assert.equal(r.snap().target,'explore','shell mode during results');
 r.m.reset(r.B.ctx);r.m.started(r.B.ctx);r.run(2);assert.equal(r.snap().song,'battle','rematch: reset + started plays battle again');
 r.m.reset(r.B.ctx);assert.equal(r.snap().battle,'idle');r.run(2.5);assert.equal(r.snap().song,'explore','reset mid-match stops battle music');
 r.m.stopped(r.B.ctx);r.m.stopped(r.B.ctx);assert.equal(r.snap().song,'explore');
});

check('pause ducks the mix (gain + low-pass) from ctx.paused or frozen render frames, and lifts on resume',()=>{
 const r=rig();r.m.unlock();r.m.started(r.B.ctx);r.run(1);const {pauseG,lp,master}=graph(r.ac());assert.ok(master&&pauseG&&lp,'graph found');
 assert.equal(pauseG.gain.goal,1);r.B.P.paused=true;r.run(.1);assert.equal(r.snap().paused,true);assert.ok(pauseG.gain.goal<.5);assert.ok(lp.frequency.goal<=1000);
 const n=r.snap().notes;r.run(1);assert.ok(r.snap().notes>n,'music keeps playing (ducked) while paused');
 r.B.P.paused=false;r.run(.1);assert.equal(r.snap().paused,false);assert.equal(pauseG.gain.goal,1);assert.ok(lp.frequency.goal>=16000);
 for(let i=0;i<4;i++)r.m.render(0,r.B.ctx);r.run(.05);assert.equal(r.snap().paused,true,'frozen frames while playing = paused');
 r.m.render(.016,r.B.ctx);r.run(.05);assert.equal(r.snap().paused,false);
});

check('setVolume clamps and drives the master gain; setEnabled(false) tears the graph down and suspends, true rebuilds',()=>{
 const r=rig();r.m.setMode('title');r.m.unlock();r.run(1);let g=graph(r.ac());
 assert.equal(r.m.setVolume(2),1);assert.equal(r.m.setVolume(-1),0);assert.equal(r.m.setVolume('abc'),0);assert.equal(g.master.gain.goal,0);
 r.m.setVolume(.4);const a=g.master.gain.goal;r.m.setVolume(.8);const b=g.master.gain.goal;assert.ok(a>0&&Math.abs(b-2*a)<1e-9,'linear master '+a+' '+b);assert.ok(b<=.8,'master under unity');assert.equal(r.m.volume,.8);
 const created=r.A.log.created,stops=r.A.log.stops;assert.equal(r.m.setEnabled(false),false);assert.equal(g.master.gain.goal,0,'fades out');assert.ok(r.A.log.stops-stops>=30,'sources stopped');
 r.T.flushTimeouts();assert.ok(r.ac().nodes.slice(0,created).every(n=>n.outs.size===0),'old graph disconnected');assert.equal(r.ac().state,'suspended');assert.equal(r.T.intervals.size,0,'scheduler timer cleared');
 assert.equal(r.m.unlock(),false);assert.equal(r.m.sting('capture-own'),false);assert.equal(r.snap().built,false);
 assert.equal(r.m.setEnabled(true),true);assert.equal(r.ac().state,'running');assert.equal(r.T.intervals.size,1);assert.ok(r.A.log.created>created,'rebuilt');r.run(1);assert.equal(r.snap().song,'title');
 g=graph(r.ac());assert.ok(Math.abs(g.master.gain.goal-b)<1e-9,'volume kept across disable/enable');
 const late=rig();late.m.setEnabled(false);late.m.unlock();assert.equal(late.A.log.contexts.length,0,'disabled before the first gesture: no context');
 late.m.setEnabled(true);assert.equal(late.A.log.contexts.length,0,'enabling without any gesture yet waits for one');
});

check('scheduler: one timer, lookahead ahead of currentTime, no nodes created per tick, nothing scheduled in the past, stalls widen the lookahead',()=>{
 const r=rig();r.m.unlock();assert.equal(r.T.intervals.size,1);assert.equal([...r.T.intervals.values()][0].ms,50);
 const built=r.A.log.created;assert.ok(r.A.log.oscillators<=40,'small voice count: '+r.A.log.oscillators+' oscillators');
 r.m.started(r.B.ctx);r.B.state.shields[1]=0;r.B.prot[2].hp=r.B.prot[3].hp=0;r.B.state.phase='evacuation';r.B.state.evacuationEnds=1e4;r.run(1);
 const before=r.A.log.created;r.m.event({type:'shield-collapse',team:0},r.B.ctx);r.run(20);
 assert.equal(r.A.log.created,before,'nodes created after build: '+(r.A.log.created-built));assert.equal(r.A.log.past,0,'automation scheduled in the past');
 const s=r.snap();assert.ok(s.ticks>=400);assert.ok(s.ahead>=.2&&s.ahead<.3,'steady lookahead '+s.ahead);assert.ok(s.notes>300);
 const t0=r.T.wall;r.T.wall+=1000;r.ac().currentTime+=1;for(const {fn} of r.T.intervals.values())fn();assert.ok(r.snap().ahead>=1.25,'stall widens lookahead: '+r.snap().ahead);assert.ok(r.T.wall>t0);
 r.run(15);assert.ok(r.snap().ahead<.6,'lookahead recovers: '+r.snap().ahead);
 const m=createMusic({AudioContext:makeAudio().Ctx,timers:{},search:''});assert.equal(m.unlock(),true,'works without timers (manual tick)');
});

check('hidden tab: lookahead covers throttled timers; visible again shrinks it',()=>{
 const listeners={},doc={hidden:false,addEventListener:(k,f)=>{listeners[k]=f;}};globalThis.document=doc;
 try{const r=rig();r.m.unlock();r.m.started(r.B.ctx);r.run(1);assert.ok(listeners.visibilitychange,'listens for visibility');
  doc.hidden=true;listeners.visibilitychange();r.run(.1);assert.ok(r.snap().ahead>=1.6,'hidden lookahead '+r.snap().ahead);
  doc.hidden=false;listeners.visibilitychange();r.run(20);assert.ok(r.snap().ahead<.6,'visible lookahead '+r.snap().ahead);}
 finally{delete globalThis.document;}
});

check('a context suspended by the platform is resumed (throttled retries) while music should play',()=>{
 const r=rig();r.m.setMode('title');r.m.unlock();r.run(1);const c=r.ac(),n=c.resumes,beat=()=>{r.T.wall+=50;for(const {fn} of r.T.intervals.values())fn();};c.resume=()=>{c.resumes++;return Promise.resolve();};c.state='interrupted';
 for(let i=0;i<10;i++)beat();assert.equal(c.resumes,n+1,'one retry per 2 s');for(let i=0;i<32;i++)beat();assert.equal(c.resumes,n+2,'second retry 2 s later');
 delete c.resume;c.state='suspended';r.run(2.1);assert.equal(c.state,'running');const k=r.snap().notes;r.run(1);assert.ok(r.snap().notes>k,'plays again');
});

check('tick cost with the fake context stays small (battle at full intensity)',()=>{
 const r=rig({realClock:true});r.m.unlock();r.m.started(r.B.ctx);r.B.state.shields[1]=0;r.B.prot[2].hp=r.B.prot[3].hp=0;r.B.state.phase='evacuation';r.B.state.evacuationEnds=1e4;r.run(60);
 const s=r.snap();assert.ok(s.tickMs<.5,'avg tick '+s.tickMs.toFixed(3)+' ms');console.log('  tick avg '+s.tickMs.toFixed(4)+' ms, max '+s.tickMaxMs.toFixed(3)+' ms over '+s.ticks+' ticks, '+s.notes+' notes');
});

console.warn=warn0;
assert.deepEqual(warnings,[],'unexpected warnings: '+warnings.join(' | '));
console.log('battle-music: '+checks.length+' checks passed');for(const c of checks)console.log('  ok - '+c);
