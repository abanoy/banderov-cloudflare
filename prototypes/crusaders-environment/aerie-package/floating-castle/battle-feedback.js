// Original synthesized foley; no borrowed game audio or external assets.
export function createBattleFeedback(actors){
 const root=document.createElement('div');root.id='combat-feedback';root.innerHTML='<div id="combat-score" role="status"></div><div id="combat-feed"></div>';document.body.append(root);
 let context=null,enabled=true,lines=[],popup=null,lastShot=-1,tones=0,played=0,lastElectric=-99;const voices=new Set();
 function unlock(){if(!enabled)return;try{context||=new (window.AudioContext||window.webkitAudioContext)();void context.resume();}catch{}}
 function tone(kind,volume=.12){
  if(!enabled||!context||context.state!=='running'||voices.size>=24)return;const now=context.currentTime;
  if(kind==='shot'&&now-lastShot<.045)return;if(kind==='shot')lastShot=now;
  const osc=context.createOscillator(),gain=context.createGain(),dur=kind==='blast'?.48:kind==='power'?.65:kind==='charge'?.45:kind==='electric'?.18:kind==='kill'?.3:.11;
  osc.type=kind==='blast'||kind==='electric'?'sawtooth':kind==='shot'||kind==='power'?'triangle':'sine';
  const hz=kind==='blast'?90:kind==='kill'?620:kind==='hit'?950:kind==='capture'?440:kind==='electric'?1300:kind==='charge'?320:kind==='power'?160:240;
  osc.frequency.setValueAtTime(hz,now);osc.frequency.exponentialRampToValueAtTime(kind==='kill'?1100:Math.max(35,hz*.35),now+dur);
  gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(volume,now+.008);gain.gain.exponentialRampToValueAtTime(.001,now+dur);osc.connect(gain).connect(context.destination);voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start();osc.stop(now+dur+.01);played++;tones++;
 }
 function clear(){lines=[];popup=null;root.querySelector('#combat-feed').replaceChildren();root.querySelector('#combat-score').textContent='';for(const v of voices){try{v.stop();}catch{}}}
 function event(e){
  if(['shield-shock','shield-collapse','tower-discharge','tower-armed','battery-off'].includes(e.type)){if(e.type!=='shield-shock'||e.time-lastElectric>.08){lastElectric=e.time;tone(e.type==='shield-shock'?'electric':e.type==='tower-armed'?'charge':'power',.12);}}
  if(e.type==='shield-block'&&e.time-lastElectric>.2){lastElectric=e.time;tone('electric',.035);if(e.source===0&&!(popup?.priority==='kill'&&popup.until>e.time))popup={text:'SHIELD IMMUNE · CAPTURE SILOS',until:e.time+1.3};}
  const own=e.actor===0||e.source===0,player=actors[0],distance=e.x===undefined?0:Math.hypot(e.x-player.state.x,e.y-player.state.y,e.z-player.state.z);
  if(e.type==='start'||e.type==='stop'){clear();return;}
  if(e.type==='shot'&&(own||distance<150))tone('shot',own?.10:.025*Math.max(.1,1-distance/150));
  if(e.type==='meltdown-launch'&&e.time-lastElectric>.25){lastElectric=e.time;tone('electric',.06);}
  if(e.type==='explosion')tone('blast',.3);
  if(e.type==='blast'&&distance<230)tone('blast',.13*Math.max(.15,1-distance/230));
  if((e.type==='hit'||e.type==='core-hit')&&e.source===0&&!(popup?.priority==='kill'&&popup.until>e.time)){tone('hit',.065);popup={text:e.protected?'MAIN CORE LOCKED · DESTROY PROTECTORS':(e.type==='core-hit'?'CASTLE HIT ':'ENEMY HIT ')+Math.round(e.damage),until:e.time+1.5};}
  if(e.type==='down'&&e.source!==null){const victim=actors.find(a=>a.id===e.actor),killer=actors.find(a=>a.id===e.source);lines.unshift({text:(killer?.name||'Defense')+' > '+(victim?.name||'Enemy'),until:e.time+5});lines=lines.slice(0,4);if(e.source===0){tone('kill',.14);popup={priority:'kill',text:'KILLED '+(victim?.name||'ENEMY')+' +100',until:e.time+3};}}
  if(e.type==='protector-hit'&&own){tone('hit',.07);if(e.source===0)popup={text:'PROTECTOR HIT '+Math.round(e.damage),until:e.time+1.5};}
  if(e.type==='protector-down'){tone('power',.15);if(e.source===0)popup={text:'PROTECTOR DESTROYED',until:e.time+3};}
  if((e.type==='gate-hit'||e.type==='gate-down')&&e.source===0){tone('hit',.07);popup={text:e.type==='gate-down'?'GATE DESTROYED':'GATE '+Math.ceil(e.hp)+' / 2000 HP',until:e.time+2};}
  if(e.type==='revive'){tone('capture',.12);if(e.source===0)popup={text:'REVIVED ALLY +50',until:e.time+3};}
  if(e.type==='capture'){tone('capture',.07);if(actors[0].team===e.team&&!(popup?.priority==='kill'&&popup.until>e.time))popup={text:'SILO CAPTURED',until:e.time+3};}
 }
 function tick(time,active,paused){root.hidden=!active;lines=lines.filter(l=>l.until>time);const feed=root.querySelector('#combat-feed');feed.replaceChildren(...lines.map(l=>{const d=document.createElement('div');d.textContent=l.text;return d;}));root.querySelector('#combat-score').textContent=popup&&popup.until>time?popup.text:'';if(paused)for(const v of voices){try{v.stop();}catch{}}}
 return {unlock,event,tick,clear,toggle(){enabled=!enabled;if(enabled)unlock();else clear();return enabled;},get enabled(){return enabled;},snapshot:()=>({enabled,state:context?.state||'locked',played,activeVoices:voices.size,score:actors[0].score||0,lines:lines.map(l=>l.text)})};
}
