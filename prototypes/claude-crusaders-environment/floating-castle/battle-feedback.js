// Original synthesized foley; no borrowed game audio or external assets.
// Mix: voice envelope -> optional StereoPanner -> master gain (setVolume, default .7) -> DynamicsCompressor -> destination.
const SHOT_IDS=['lance','fan','orbit','longbow','firepot','reviver'],POWER=new Set(['shield-shock','shield-collapse','tower-discharge','tower-armed','battery-off']),PRIORITY=new Set(['down','respawn','victory','defeat','draw','capture-own','capture-lost','explosion']);
const GAP={shot:.045,'own-shot':.045,impact:.035,hit:.03,hurt:.07,melee:.05,heartbeat:.3,blast:.06,explosion:.4,'tower-impact':.15,'tower-shot':.1,'protector-down':.25,'gate-down':.25,reload:.15,reloaded:.15,dry:.12,ui:.04,land:.25,launch:.3,ward:.2,revive:.2,electric:.02,kill:.05,down:.3,respawn:.3,victory:1,defeat:1,draw:1};
const CAUSE={electric:'Shield',fall:'Fall',blast:'Core blast',meltdown:'Meltdown'},CAUSE_POPUP={electric:'SHIELD SHOCK',fall:'A FALL',blast:'CORE BLAST',meltdown:'MELTDOWN'},TEAM=['Dawn','Dusk'];
// A down no fighter made names the team's shield or unmanned gun ('Dusk shield', 'Dawn ship gun'; combat's cause/killerTeam/by), else its cause.
const causeName=(e,flag)=>{const team=TEAM[e.killerTeam],what=e.cause==='shield'||flag==='electric'?'shield':e.cause==='gun'||e.cause==='ship'?e.by||(e.cause==='ship'?'ship gun':'castle gun'):null;return what?(team?team+' '+what:what[0].toUpperCase()+what.slice(1)):flag?CAUSE[flag]:'Defense';};
const esc=t=>String(t).replace(/[&<>"]/g,c=>c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':'&quot;');
export function createBattleFeedback(actors){
 const root=document.createElement('div');root.id='combat-feedback';root.innerHTML='<div id="combat-score" role="status"></div><div id="combat-feed"></div>';document.body.append(root);const scoreEl=root.querySelector('#combat-score'),feedEl=root.querySelector('#combat-feed');
 let context=null,master=null,noiseBuffer=null,enabled=true,volume=.7,lines=[],popup=null,tones=0,played=0,lastElectric=-99,camera=null,feedDirty=false,lineId=0,scoreText='',shown=null,ambient=null,ambientOn=false,finished=false,V=null;const voices=new Set(),last=Object.create(null),kinds=Object.create(null);
 function unlock(){if(!enabled)return;try{if(!context){context=new (window.AudioContext||window.webkitAudioContext)();master=context.createGain();master.gain.value=volume;const comp=context.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.22;master.connect(comp).connect(context.destination);}void context.resume();}catch{}}
 function noise(){if(!noiseBuffer){const n=context.sampleRate|0;noiseBuffer=context.createBuffer(1,n,context.sampleRate);const d=noiseBuffer.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}return noiseBuffer;}
 // One voice = one envelope chain; its longest source cleans every node up when it ends.
 function begin(gain,pan){const out=context.createGain();out.gain.value=gain;V={now:context.currentTime,srcs:[],nodes:[out],tail:null,end:0};if(pan&&context.createStereoPanner){const p=context.createStereoPanner();p.pan.value=Math.max(-.85,Math.min(.85,pan));out.connect(p).connect(master);V.nodes.push(p);}else out.connect(master);return out;}
 function track(src,gain,stop){V.srcs.push(src);V.nodes.push(gain);if(stop>=V.end){V.end=stop;V.tail=src;}}
 function envelope(g,s,dur,peak,attack){g.gain.setValueAtTime(.0001,s);g.gain.linearRampToValueAtTime(peak,s+attack);g.gain.exponentialRampToValueAtTime(.0001,s+dur);}
 function osc(type,f0,f1,t,dur,peak,dest,attack=.006){const o=context.createOscillator(),g=context.createGain(),s=V.now+t;o.type=type;o.frequency.setValueAtTime(f0,s);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),s+dur);envelope(g,s,dur,peak,attack);o.connect(g).connect(dest);o.start(s);o.stop(s+dur+.02);track(o,g,s+dur+.02);return o;}
 function hiss(type,f0,f1,q,t,dur,peak,dest,attack=.004){const b=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain(),s=V.now+t;b.buffer=noise();b.loop=true;f.type=type;f.frequency.setValueAtTime(f0,s);if(f1!==f0)f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),s+dur);f.Q.value=q;envelope(g,s,dur,peak,attack);b.connect(f).connect(g).connect(dest);b.start(s,Math.random()*.9);b.stop(s+dur+.02);V.nodes.push(f);track(b,g,s+dur+.02);}
 function wobble(target,hz,depth,dur){const l=context.createOscillator(),d=context.createGain();l.frequency.value=hz;d.gain.value=depth;l.connect(d).connect(target);l.start(V.now);l.stop(V.now+dur);V.srcs.push(l);V.nodes.push(d);}
 function notes(type,list,peak,o){for(const [hz,t,dur] of list)osc(type,hz,hz,t,dur,peak,o,.012);}
 function synth(kind,o,opts){switch(kind){
  case 'shot':{const w=opts?.weaponId&&!SHOT_IDS.includes(opts.weaponId)?opts.weaponId:SHOT_IDS[opts?.weapon]||opts?.weaponId||'lance';
   if(w==='lance'){osc('square',920,430,0,.07,.045,o);osc('sine',1840,900,0,.04,.025,o);}
   else if(w==='fan'){for(let i=0;i<3;i++)osc('triangle',640+i*37,330+i*20,i*.022,.08,.065,o);}
   else if(w==='orbit'){wobble(osc('sine',210,120,0,.26,.11,o).frequency,26,34,.28);osc('triangle',105,70,0,.2,.04,o);}
   else if(w==='longbow'){osc('triangle',196,98,0,.32,.12,o,.002);osc('sawtooth',392,180,0,.06,.022,o,.002);hiss('highpass',3200,1500,.7,0,.05,.05,o);}
   else if(w==='firepot'){hiss('bandpass',380,1700,1.2,0,.34,.13,o,.05);osc('sine',140,60,0,.25,.06,o);}
   else if(w==='reviver'){osc('sine',660,660,0,.32,.055,o,.01);osc('sine',990,990,.06,.3,.045,o,.01);}
   else if(w==='mounted-cannon'){hiss('lowpass',1400,160,.8,0,.45,.2,o,.002);osc('sine',95,38,0,.4,.16,o,.003);}
   else if(w==='mounted-trebuchet'){hiss('bandpass',260,110,2,0,.5,.12,o,.03);osc('triangle',70,48,0,.35,.08,o);}
   else osc('triangle',240,90,0,.11,.08,o);break;}
  case 'melee':hiss('bandpass',2600,520,1.6,0,.16,.16,o,.02);osc('triangle',300,120,0,.08,.03,o);break;
  case 'hit':osc('sine',950,332,0,.11,.065,o);hiss('highpass',4000,4000,.7,0,.03,.025,o);break;
  case 'kill':osc('sine',620,1100,0,.3,.14,o);osc('triangle',930,1650,.04,.2,.04,o);break;
  case 'hurt':osc('square',220,110,0,.12,.045,o);osc('sine',130,60,0,.18,.14,o);hiss('lowpass',900,200,.7,0,.1,.08,o);break;
  case 'down':osc('triangle',523,262,0,.5,.09,o);osc('triangle',392,196,.08,.5,.07,o);osc('sine',110,55,0,.7,.1,o);break;
  case 'respawn':notes('sine',[[392,0,.35],[523,.07,.35],[784,.14,.45]],.05,o);osc('sine',1568,1568,.2,.5,.015,o,.05);break;
  case 'reload':hiss('highpass',4000,4000,.7,0,.02,.07,o);osc('square',1200,800,0,.015,.022,o,.002);hiss('bandpass',2500,2500,1.5,.12,.03,.06,o);break;
  case 'reloaded':osc('square',900,900,0,.02,.03,o,.002);osc('square',1350,1350,.05,.02,.03,o,.002);break;
  case 'dry':osc('square',1500,1400,0,.015,.03,o,.002);hiss('highpass',5000,5000,.7,0,.01,.03,o,.002);break;
  case 'tower-shot':osc('sine',300,1200,0,.45,.05,o,.2);hiss('bandpass',600,2400,1,0,.5,.05,o,.2);break;
  case 'tower-impact':hiss('lowpass',1000,100,.8,0,.8,.2,o,.004);osc('sine',70,30,0,.7,.2,o);break;
  case 'capture-own':notes('triangle',[[523,0,.28],[659,.09,.3],[784,.18,.3],[1047,.27,.5]],.07,o);osc('sine',262,262,0,.6,.04,o,.02);break;
  case 'capture-lost':notes('triangle',[[659,0,.3],[523,.12,.3],[440,.24,.55]],.07,o);osc('sine',220,220,.18,.7,.04,o,.02);break;
  case 'capture':osc('sine',440,154,0,.11,.07,o);break;
  case 'victory':notes('triangle',[[523,0,.16],[659,.16,.16],[784,.32,.16],[1047,.48,.8]],.08,o);notes('sine',[[523,.48,1.2],[659,.48,1.2],[784,.48,1.2]],.03,o);break;
  case 'defeat':notes('triangle',[[392,0,.3],[370,.3,.3],[349,.6,.3],[330,.9,1]],.07,o);osc('sine',165,165,0,1.6,.05,o,.05);break;
  case 'draw':notes('triangle',[[523,0,1],[698,0,1],[784,.05,1]],.04,o);break;
  case 'launch':hiss('bandpass',300,2200,.9,0,.6,.1,o,.15);osc('sine',160,480,0,.5,.04,o,.1);break;
  case 'land':hiss('lowpass',600,120,.7,0,.18,.1,o);osc('sine',110,55,0,.15,.1,o);break;
  case 'ui':osc('sine',1200,1200,0,.04,.035,o,.003);osc('sine',1800,1800,0,.03,.015,o,.003);break;
  case 'impact':hiss('bandpass',1800,700,1.2,0,.06,.06,o);osc('square',180,90,0,.03,.02,o,.002);break;
  case 'blast':hiss('lowpass',1600,140,.7,0,.55,.22,o,.003);osc('sine',75,32,0,.5,.2,o,.003);break;
  case 'explosion':hiss('lowpass',900,60,.7,0,1.6,.35,o,.004);osc('sine',55,25,0,1.4,.3,o,.004);hiss('bandpass',300,80,1,.05,.9,.15,o);break;
  case 'protector-down':hiss('highpass',3000,6000,.7,0,.5,.07,o);osc('sine',1568,784,0,.6,.04,o);osc('sine',1175,587,.05,.6,.04,o);osc('triangle',160,60,0,.5,.1,o);break;
  case 'gate-down':hiss('lowpass',700,90,.7,0,.9,.22,o);osc('square',80,40,0,.5,.05,o);hiss('bandpass',1500,400,2,.1,.3,.06,o);break;
  case 'ward':notes('sine',[[523,0,.7],[784,.03,.7],[1047,.06,.7]],.035,o);hiss('highpass',6000,6000,.7,0,.4,.015,o,.05);break;
  case 'revive':osc('sine',660,660,0,.35,.06,o,.01);osc('sine',990,990,.08,.4,.05,o,.01);osc('sine',1320,1320,.16,.4,.03,o,.01);break;
  case 'heartbeat':osc('sine',62,48,0,.14,.16,o,.01);osc('sine',58,44,.18,.16,.12,o,.01);break;
  case 'electric':osc('sawtooth',1300,455,0,.18,.12,o,.008);break;
  case 'power':osc('triangle',160,56,0,.65,.12,o,.008);break;
  case 'charge':osc('sine',320,112,0,.45,.12,o,.008);break;
  default:osc('triangle',240,90,0,.11,.08,o);}}
 // play(kind,{volume,pan,weapon,weaponId}) → true when a voice started. 24-voice cap; per-kind gaps throttle bursts and de-duplicate sounds that two modules request for the same event.
 function play(kind,opts){if(!enabled||!context||context.state!=='running')return false;const now=context.currentTime,key=opts?.key||kind,gap=GAP[key]??.03;if(now-(last[key]??-9)<gap)return false;
  const vol=Math.max(0,Math.min(2,opts?.volume??1));if(vol<.003)return false;
  if(voices.size>=24){if(!PRIORITY.has(kind))return false;const oldest=voices.values().next().value;voices.delete(oldest);for(const s of oldest.srcs){try{s.stop();}catch{}}}
  last[key]=now;try{synth(kind,begin(vol,opts?.pan),opts);}catch{V=null;return false;}const v=V;V=null;if(!v.tail)return false;
  v.tail.onended=()=>{voices.delete(v);for(const n of v.srcs)n.disconnect();for(const n of v.nodes)n.disconnect();};voices.add(v);played++;tones++;kinds[kind]=(kinds[kind]||0)+1;if(kind==='shot'){const w=opts?.weaponId||SHOT_IDS[opts?.weapon]||'lance',k='shot:'+w;kinds[k]=(kinds[k]||0)+1;}return true;}
 function stopAll(){for(const v of voices)for(const s of v.srcs){try{s.stop();}catch{}}}
 // Very quiet low wind bed while a match is live (not once it has finished); follows SFX, pause and match state.
 function setAmbient(on){if(!context)return;const t=context.currentTime;
  if(on&&!ambient){const src=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain(),fade=context.createGain(),l1=context.createOscillator(),d1=context.createGain(),l2=context.createOscillator(),d2=context.createGain();src.buffer=noise();src.loop=true;src.playbackRate.value=.5;f.type='lowpass';f.frequency.value=380;f.Q.value=.8;l1.frequency.value=.06;d1.gain.value=150;l1.connect(d1).connect(f.frequency);g.gain.value=.022;l2.frequency.value=.11;d2.gain.value=.009;l2.connect(d2).connect(g.gain);fade.gain.setValueAtTime(0,t);fade.gain.setTargetAtTime(1,t,1.4);src.connect(f).connect(g).connect(fade).connect(master);src.start(t,Math.random()*.9);l1.start(t);l2.start(t);ambient={nodes:[src,f,g,fade,l1,d1,l2,d2],srcs:[src,l1,l2],fade};}
  else if(!on&&ambient){const a=ambient;ambient=null;a.fade.gain.cancelScheduledValues(t);a.fade.gain.setTargetAtTime(0,t,.25);for(const s of a.srcs)s.stop(t+1.2);a.srcs[0].onended=()=>{for(const n of a.nodes)n.disconnect();};}}
 function panFor(x,z){const p=actors[0]?.state;if(!camera||!p)return 0;const e=camera.matrixWorld.elements,d=(x-p.x)*e[0]+(z-p.z)*e[2];return Math.max(-.8,Math.min(.8,d/45));}
 function clear(){lines=[];popup=null;feedDirty=false;feedEl.replaceChildren();scoreText='';scoreEl.textContent='';stopAll();}
 function find(id){return id==null?null:actors.find(a=>a.id===id);}
 // Single channel per event: with the announcer (#announce-banner) or the juice respawn card (#juice-respawn) on the page,
 // their banner/card carries captures, protector/gate kills and 'downed by', so no duplicate popup here (a live kill popup stays).
 const owned=id=>typeof document.getElementById==='function'&&!!document.getElementById(id);
 function event(e){
  const player=actors[0],viewer=player?.team??0;
  if(POWER.has(e.type)){if(e.type!=='shield-shock'||e.time-lastElectric>.08){lastElectric=e.time;play(e.type==='shield-shock'?'electric':e.type==='tower-armed'?'charge':'power');}}
  if(e.type==='shield-block'&&e.time-lastElectric>.2){lastElectric=e.time;play('electric',{volume:.3});if(e.source===0&&!(popup?.priority==='kill'&&popup.until>e.time))popup={text:'SHIELD IMMUNE · CAPTURE SILOS',until:e.time+1.3};}
  if(e.type==='start'||e.type==='stop'){finished=false;clear();return;}
  if(e.type==='finish'){finished=true;if(ambientOn){ambientOn=false;setAmbient(false);}}
  if(e.type==='shot'&&e.time===undefined)return;// battle.js also forwards melee as a weaponless shot; the melee event plays the swish.
  const own=e.actor===0||e.source===0,located=e.x!==undefined&&!!player?.state,distance=located?Math.hypot(e.x-player.state.x,e.y-player.state.y,e.z-player.state.z):0,pan=located?panFor(e.x,e.z):0,quiet=!(popup?.priority==='kill'&&popup.until>e.time)&&player?.alive!==false;
  if(e.type==='shot'&&(own||distance<150))play('shot',{weapon:e.weapon,weaponId:e.weaponId,key:own?'own-shot':'shot',volume:own?1:.25*Math.max(.1,1-distance/150),pan:own?0:pan});
  if(e.type==='melee'&&(own||distance<60))play('melee',{volume:own?1:.3*(1-distance/60),pan});
  if(e.type==='meltdown-launch'&&e.time-lastElectric>.25){lastElectric=e.time;play('electric',{volume:.5});}
  if(e.type==='explosion')play('explosion');
  if(e.type==='blast'&&distance<230)play('blast',{volume:Math.max(.15,1-distance/230),pan});
  if(e.type==='hit'&&e.actor===0)play('hurt',{volume:Math.min(1.3,.6+3*(e.damage||0)/Math.max(1,player?.maxHp||100))});
  if((e.type==='hit'||e.type==='core-hit')&&e.source===0&&quiet){play('hit');popup={text:e.protected?'MAIN CORE LOCKED · DESTROY PROTECTORS':(e.type==='core-hit'?'CASTLE HIT ':'ENEMY HIT ')+Math.round(e.damage),until:e.time+1.5};}
  if(e.type==='down'){const victim=find(e.actor),killer=find(e.source),flag=e.electric?'electric':e.fall?'fall':e.blast?'blast':e.meltdown?'meltdown':null,name=killer?.name||causeName(e,flag),vt=victim?.team??-1,kt=killer?.team??(TEAM[e.killerTeam]?e.killerTeam:flag||vt<0?-1:1-vt);
   lines.unshift({id:++lineId,text:name+' > '+(victim?.name||'Enemy'),killer:name,victim:victim?.name||'Enemy',kt,vt,cause:!killer,you:e.actor===0||e.source===0,until:e.time+5});if(lines.length>4)lines.length=4;feedDirty=true;
   if(e.source===0){play('kill');popup={priority:'kill',text:'KILLED '+(victim?.name||'ENEMY')+' +100',until:e.time+3};}
   if(e.actor===0){play('down');if(!owned('juice-respawn'))popup={priority:'kill',text:'DOWNED BY '+(killer?.name||(TEAM[e.killerTeam]&&e.cause!=='fighter'?name.toUpperCase():flag?CAUSE_POPUP[flag]:'DEFENSE')),until:e.time+3};else if(popup&&popup.priority!=='kill')popup=null;}}
  if(e.type==='respawn'&&e.actor===0)play('respawn');
  if(e.type==='protector-hit'&&own){play('hit',{volume:1.1});if(e.source===0)popup={text:'PROTECTOR HIT '+Math.round(e.damage),until:e.time+1.5};}
  if(e.type==='protector-down'){play('protector-down',{volume:own?1:.7,pan});if(e.source===0){if(!owned('announce-banner'))popup={text:'PROTECTOR DESTROYED',until:e.time+3};else if(popup&&popup.priority!=='kill')popup=null;}}
  if((e.type==='gate-hit'||e.type==='gate-down')&&e.source===0){play('hit',{volume:1.1});if(e.type==='gate-down'&&owned('announce-banner')){if(popup&&popup.priority!=='kill')popup=null;}else if(!(popup?.priority==='kill'&&popup.until>e.time))popup={text:e.type==='gate-down'?'GATE DESTROYED':'GATE '+Math.ceil(e.hp)+' / 2000 HP',until:e.time+2};}
  if(e.type==='gate-down')play('gate-down',{volume:own?1:Math.max(.25,1-distance/220),pan});
  if(e.type==='revive'){play('revive',{volume:own||e.actor===0?1:Math.max(.2,1-distance/120)});if(e.source===0)popup={text:'REVIVED ALLY +50',until:e.time+3};}
  if(e.type==='cast'&&(own||distance<70))play('ward',{volume:own?1:.45,pan});
  if(e.type==='capture'){play(e.team===viewer?'capture-own':e.from===viewer?'capture-lost':'capture');if(player?.team===e.team&&!(popup?.priority==='kill'&&popup.until>e.time)&&!owned('announce-banner'))popup={text:'SILO CAPTURED',until:e.time+3};}
  if(e.type==='tower-shot')play('tower-shot',{volume:e.strike?.team===viewer?.8:.5});
  if(e.type==='tower-impact')play('tower-impact',{volume:e.team===viewer?1:.45});
  if(e.type==='finish'){play(e.winner===viewer?'victory':e.winner===-1?'draw':'defeat');}
 }
 function lineNode(l){const d=document.createElement('div'),tk=l.kt>=0?l.kt:l.vt;d.className='feed-line team-'+(tk>=0?tk:'env')+(l.cause?' cause':'')+(l.you?' you':'');d.innerHTML='<b class="killer team-'+(l.kt>=0?l.kt:'env')+'">'+esc(l.killer)+'</b> <i aria-hidden="true">›</i> <span class="victim team-'+(l.vt>=0?l.vt:'env')+'">'+esc(l.victim)+'</span>';return d;}
 // DOM writes happen only when the visible lines, popup text or visibility change.
 function tick(time,active,paused){if(shown!==active){shown=active;root.hidden=!active;}
  while(lines.length&&lines[lines.length-1].until<=time){lines.pop();feedDirty=true;}
  if(feedDirty){feedDirty=false;feedEl.replaceChildren(...lines.map(lineNode));}
  const text=popup&&popup.until>time?popup.text:'';if(text!==scoreText){scoreText=text;scoreEl.textContent=text;}
  if(paused)stopAll();const want=enabled&&active&&!finished&&!paused&&context?.state==='running';if(want!==ambientOn){ambientOn=want;setAmbient(want);}}
 return {unlock,event,tick,clear,play,setVolume(v){volume=Math.max(0,Math.min(1,Number(v)||0));if(master)master.gain.setTargetAtTime(volume,context.currentTime,.03);return volume;},get volume(){return volume;},listener(c){camera=c||null;},
  toggle(){enabled=!enabled;if(enabled)unlock();else{stopAll();ambientOn=false;setAmbient(false);}return enabled;},get enabled(){return enabled;},snapshot:()=>({enabled,state:context?.state||'locked',played,activeVoices:voices.size,volume,ambient:!!ambient,finished,kinds:{...kinds},score:actors[0].score||0,lines:lines.map(l=>l.text)})};
}
