// Game shell for Don Bass Crusaders: Build Castles & Battle! (map: The Floating Aerie): title screen, the BF1-style match
// intro card (loading overlay), seamless panel exits, controls panel, confirm dialog and persisted settings. main.js owns the camera, pause and settings panel; this module
// only drives the front-door UI. No DOM access at module top level. useCreator(creator) adds the title's Crusader entry
// (crusader-creator.js): it opens the creator sheet in place of the title and comes back to it on close.
const STORE='crusaders-aerie-settings-v1';
// One key map for the controls panel; `touch` is the phone/tablet variant (null = keyboard only). Touch labels are
// the words the battle HUD's touch chips show (battle-hud.js data-short: Operate / Board / Exit, Chariot, Rise / Lower...).
export const KEYMAP=[
 {group:'Move and camera',items:[
  {keys:['W','A','S','D'],touch:['Movement pad'],act:'Walk, or steer the pod in the air. Release to brake.'},
  {keys:['Q','E'],touch:['Twist two fingers'],act:'Rotate the camera'},
  {keys:['Wheel'],touch:['Pinch'],act:'Zoom in or out'},
  {keys:['Right drag'],touch:['Drag the view'],act:'Turn the camera (left drag while exploring)',tact:'Turn the camera'},
  {keys:['Space'],touch:['Launch'],act:'Launch the pod from a glowing pad'}]},
 {group:'Combat',items:[
  {keys:['Left click'],touch:['Tap the view','FIRE'],act:'Fire at the cursor; hold to keep firing',tact:'Tap to fire at a spot, or hold FIRE to aim at the nearest foe'},
  {keys:['1–6'],touch:['Weapon slots'],act:'Choose a weapon your class can use'},
  {keys:['T'],touch:['Reload'],act:'Reload. Empty pockets refill at a friendly armory'},
  {keys:['H'],touch:['Ward'],act:'Mage: cast a protective ward'},
  {keys:['J'],touch:['Build'],act:'Builder: place the chosen field plan'},
  {keys:['I'],touch:['Repair'],act:'Repair a nearby friendly battery'}]},
 {group:'Castle and vehicles',items:[
  {keys:['V'],touch:['Restock'],act:'Restock at a friendly armory or supply'},
  {keys:['F'],touch:['Operate','Board','Exit'],act:'Man a castle defense, board a ship, or leave a ship or chariot',tact:'Operate a castle defense, Board a ship, or Exit a ship or chariot'},
  {keys:['G'],touch:['Seat'],act:'Change seat aboard'},
  {keys:['R'],touch:['Chariot'],act:'Board a nearby chariot (F leaves it)',tact:'Board a nearby chariot (Exit leaves it)'},
  {keys:['R','C'],touch:['Rise','Lower'],act:'Climb or descend aboard a ship or chariot'},
  {keys:['B'],touch:['Gate'],act:'Open or close a nearby friendly gate'}]},
 {group:'Menus',items:[
  {keys:['M'],touch:['Map'],act:'Spawn map: choose where you respawn'},
  {keys:['K'],touch:['Score'],act:'Scoreboard: both teams, kills, captures and score'},
  {keys:['P','Esc'],touch:['Pause'],act:'Pause menu'}]}];
export const TIPS=[
 '<b>Silos</b> charge for 60 seconds once you hold them, then strike the enemy shield.',
 'The enemy core is safe until its <b>protectors</b> fall. Break them first.',
 'When a core falls, the castle <b>evacuates</b>. Get clear before the blast.',
 'Out of ammo? Press <b>V</b> at a friendly armory or supply to restock.',
 'Press <b>F</b> beside a cannon or trebuchet to man your castle defenses.',
 'Press <b>R</b> near a chariot to ride. It is the fastest way across the ring.',
 'Press <b>M</b> to open the spawn map and choose where you come back.',
 'Press <b>Space</b> on a glowing pad to launch your pod to another island.',
 'Press <b>K</b> for the scoreboard: kills, captures and score for both teams.',
 'The ward (H) and restock (V) need time to recharge: their chips fill back up and count down the seconds.'];
// Touch wording for the same tips (same order).
export const TOUCH_TIPS=[TIPS[0],TIPS[1],TIPS[2],
 'Out of ammo? Tap <b>Restock</b> at a friendly armory or supply.',
 'Tap <b>Operate</b> beside a cannon or trebuchet to man your castle defenses.',
 'Tap <b>Chariot</b> near a chariot to ride. It is the fastest way across the ring.',
 'Tap <b>Map</b> to open the spawn map and choose where you come back.',
 'Tap <b>Launch</b> on a glowing pad to fly your pod to another island.',
 'Tap <b>Score</b> for the scoreboard: kills, captures and score for both teams.',
 'The <b>Ward</b> and <b>Restock</b> chips need time to recharge: they fill back up and count down the seconds.'];
const STAGES=['design','raise','route','deploy'];
const stageIndex=(stage,label)=>{const t=String(stage||'')+' '+String(label||'');if(/rais|assembl|build/i.test(t))return 1;if(/rout|chart|map|path/i.test(t))return 2;if(/deploy|arm|spawn|start/i.test(t))return 3;if(/design|plan|castle/i.test(t))return 0;return -1;};
const STAGE_LABELS=['Designing castles','Raising castles','Charting routes','Deploying armies'];
const CLASS_NAMES={ranger:'Ranger',fighter:'Fighter',mage:'Mage',builder:'Builder'};
const FOCUSABLE='button:not([disabled]):not([hidden]),select:not([disabled]),input:not([disabled]),summary,a[href],[tabindex]:not([tabindex="-1"])';
const visible=el=>!!el&&!el.hidden&&el.getClientRects().length>0;
// Keep Tab inside `root`. Returns true when it handled the key.
export function trapTab(e,root){if(e.key!=='Tab'||!root)return false;const items=[...root.querySelectorAll(FOCUSABLE)].filter(el=>visible(el)&&!el.closest('[hidden]')&&!el.closest('details:not([open])>:not(summary)'));if(!items.length)return false;const first=items[0],last=items[items.length-1],at=items.indexOf(document.activeElement);if(e.shiftKey&&(at<=0)){last.focus();e.preventDefault();return true;}if(!e.shiftKey&&(at===-1||at===items.length-1)){first.focus();e.preventDefault();return true;}return false;}

export function createGameShell({battle,builder,setPause,showLook,message,canvas,getPaused,urlParams=new URLSearchParams(location.search),onShowTitle=()=>{},onHideTitle=()=>{},onExplore=()=>{},onWorkshop=()=>{},onPreset=()=>{},getStats=()=>null}={}){
 const $=id=>document.getElementById(id),body=document.body;
 const persist=!['test','build','battle'].some(k=>urlParams.has(k));
 const flow=typeof battle?.quickStart==='function';
 let titleOpen=false,loadingOpen=false,controlsOpen=false,confirmState=null,cameFromTitle=false,titleReturn=null,controlsReturn=null,matchOrigin='';

 // ---------- seamless panels (Battlefield 1 style menus over the live world) ----------
 // A closing panel keeps showing for a moment while it slides and fades away: its `hidden` state is already true (ids, focus
 // traps and tests see the new state at once), and the ghost (.shell-out) is inert and lets every pointer through. Re-showing it
 // ends the ghost synchronously, so a panel that is shown and focused in the same task (pause -> Settings -> back) takes focus.
 const motionOK=()=>{try{return !matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return true;}};
 const ghostTimers=new Map(),HIDDEN=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');
 function ghostEnd(el){clearTimeout(ghostTimers.get(el));ghostTimers.delete(el);if(!el.classList.contains('shell-out'))return;el.classList.remove('shell-out','intro-out','intro-fresh');el.inert=false;}
 function ghostOut(el,ms=320,cls=''){if(!el)return;ghostEnd(el);if(!motionOK()||!ms)return;el.classList.add('shell-out');if(cls)el.classList.add(cls);el.inert=true;ghostTimers.set(el,setTimeout(()=>ghostEnd(el),ms));}
 function ghostPanel(el,ms=320){if(!el||el.dataset.shellGhost)return;el.dataset.shellGhost=String(ms);if(!HIDDEN?.set)return;let shown=!el.hidden;
  const sync=()=>{const now=!HIDDEN.get.call(el);if(now===shown)return;shown=now;if(now)ghostEnd(el);else ghostOut(el,ms);};
  try{Object.defineProperty(el,'hidden',{configurable:true,get(){return HIDDEN.get.call(this);},set(v){HIDDEN.set.call(this,v);sync();}});}catch{}
  // setAttribute/removeAttribute('hidden') reach the same state through the observer.
  new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['hidden']});}
 for(const [id,ms] of [['game-title',380],['look-panel',260],['pause-panel',260],['battle-panel',320],['battle-result',320],['builder-panel',340]])ghostPanel($(id),ms);
 // Match intro: the card holds over the camera fly-in, then the HUD fades in (main.js runs the camera). hideLoading({intro}) only
 // arms it; main.js steps it from every drawn frame (introFrame(dt), dt 0 while paused), so the hold, the HUD fade and the card's
 // slide follow rendered frames: a long first frame (shader compile) or the pause menu delays the sequence instead of skipping it.
 // The card's CSS animations are paused and seeked to the same clock (seconds).
 let intro=null,introSafety=0;const INTRO_HOLD=1.35,INTRO_TOTAL=2.1,HUD_IN=.9;
 function endIntro(){clearTimeout(introSafety);const was=intro;intro=null;body.classList.remove('shell-intro','shell-hud-in');if(was&&loading?.classList.contains('intro-out'))ghostEnd(loading);}
 function introFrame(dt){if(!intro)return false;if(!battle?.active){endIntro();return false;}intro.t+=dt>0?Math.min(dt,.05):0;const t=intro.t,ms=Math.round(Math.min(t,INTRO_TOTAL)*1000);
  if(ms!==intro.ms){intro.ms=ms;for(const a of intro.anims)try{a.currentTime=ms;}catch{}}
  if(!intro.hud&&t>=INTRO_HOLD){intro.hud=true;body.classList.remove('shell-intro');body.classList.add('shell-hud-in');}
  if(t>=INTRO_TOTAL&&loading.classList.contains('intro-out'))ghostEnd(loading);
  if(t>=INTRO_HOLD+HUD_IN)endIntro();return !!intro;}
 function openStats(){const st=getStats();if(typeof st?.open!=='function')return false;try{st.open();return true;}catch(e){console.warn('Stats failed to open:',e);return false;}}

 // ---------- settings ----------
 const settings={data:{inputs:{},checks:{},quality:'balanced',preset:null,playerCue:true,lastMatch:{}},persist,
  load(){if(!persist)return null;try{const raw=localStorage.getItem(STORE);if(!raw)return null;const d=JSON.parse(raw);if(!d||typeof d!=='object')return null;for(const k of ['inputs','checks','lastMatch'])if(d[k]&&typeof d[k]==='object')settings.data[k]=d[k];if(typeof d.quality==='string')settings.data.quality=d.quality;if(typeof d.preset==='string')settings.data.preset=d.preset;if(typeof d.playerCue==='boolean')settings.data.playerCue=d.playerCue;return settings.data;}catch{return null;}},
  save(){if(!persist)return false;try{localStorage.setItem(STORE,JSON.stringify({version:1,...settings.data}));return true;}catch{return false;}},
  capture(){const panel=$('look-panel');if(!panel)return;for(const el of panel.querySelectorAll('input'))if(el.id&&el.id!=='zoom'){if(el.type==='checkbox')settings.data.checks[el.id]=el.checked;else settings.data.inputs[el.id]=Number(el.value);}if($('quality'))settings.data.quality=$('quality').value;const cue=$('player-cue');if(cue)settings.data.playerCue=cue.getAttribute('aria-pressed')==='true';},
  // Apply saved values through the real controls so main.js listeners do the work.
  restore(){const d=settings.load();if(!d)return false;for(const [id,v] of Object.entries(d.inputs||{})){const el=$(id);if(!el||el.id==='zoom'||el.type==='checkbox'||!Number.isFinite(Number(v)))continue;el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));}for(const [id,v] of Object.entries(d.checks||{})){const el=$(id);if(!el||el.type!=='checkbox'||el.checked===!!v)continue;el.checked=!!v;el.dispatchEvent(new Event('change',{bubbles:true}));}const q=$('quality');if(q&&[...q.options].some(o=>o.value===d.quality)&&q.value!==d.quality){q.value=d.quality;q.dispatchEvent(new Event('change',{bubbles:true}));}const cue=$('player-cue');if(cue&&(cue.getAttribute('aria-pressed')==='true')!==d.playerCue)cue.click();if(d.preset)onPreset(d.preset,{restoring:true});return true;},
  setPreset(name){settings.data.preset=name;settings.queue();},
  setLastMatch(m){settings.data.lastMatch={...settings.data.lastMatch,...m};settings.queue();updateQuickSub();},
  queue(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{settings.capture();settings.save();},250);}};
 let saveTimer=0;
 const lookPanel=$('look-panel');
 if(lookPanel){lookPanel.addEventListener('input',()=>settings.queue());lookPanel.addEventListener('change',()=>settings.queue());$('player-cue')?.addEventListener('click',()=>settings.queue());}
 if(!persist||!settings.load()){const shake=$('setting-shake');try{if(shake&&matchMedia('(prefers-reduced-motion: reduce)').matches)shake.checked=false;}catch{}}

 // ---------- title ----------
 const title=$('game-title');
 const titleButtons=()=>[...title.querySelectorAll('.title-actions button')].filter(b=>!b.disabled&&!b.hidden);
 function updateQuickSub(){const sub=$('title-quick-sub'),c=settings.data.lastMatch?.class;if(sub)sub.textContent=(CLASS_NAMES[c]||'Ranger')+' · '+(document.getElementById('battle-play-bots')?.checked===false?'Solo practice · bots off':'4v4')+' · 20 min';}
 function showTitle(){if(!title)return;hideLoading();endIntro();if(loading?.classList.contains('intro-out'))ghostEnd(loading);hideControls(true);if(lookPanel&&!lookPanel.hidden)showLook(false);if(getPaused?.())setPause(false);$('pause-panel').hidden=true;titleOpen=true;cameFromTitle=true;title.hidden=false;body.classList.add('shell-title');body.classList.remove('mode-explore','booting');updateQuickSub();onShowTitle();const first=titleReturn&&title.contains(titleReturn)&&!titleReturn.disabled?titleReturn:titleButtons()[0];first?.focus({preventScroll:true});}
 function hideTitle(){if(!title)return;if(afterSettle)waitQuick(null);titleNotice('');titleReturn=title.contains(document.activeElement)?document.activeElement:titleReturn;if(lookPanel&&!lookPanel.hidden)showLook(false);titleOpen=false;title.hidden=true;body.classList.remove('shell-title','booting');onHideTitle();}
 // One-line confirmation under the menu (e.g. a castle applied from the Workshop), cleared when the title closes; tone 'busy'
 // (a Quick Battle waiting for a cancelled setup to stop) draws it in gold.
 let notice=null;function titleNotice(text,tone){if(!title)return;if(!notice){notice=document.createElement('p');notice.id='title-notice';notice.setAttribute('role','status');notice.hidden=true;const st=$('title-status');if(st)st.before(notice);else title.querySelector('.title-sheet')?.append(notice);}const t=String(text||'');if(notice.textContent!==t)notice.textContent=t;notice.classList.toggle('busy',tone==='busy'&&!!t);notice.hidden=!t;}
 function lastMatch(){return settings.data.lastMatch||{};}
 function startQuick(){if(settling()){waitQuick(startQuick);return;}freshLaunch();body.dataset.matchOrigin=matchOrigin='quick';const opts={class:lastMatch().class||'ranger',size:4,level:30,source:'saved',castleSource:'saved',skill:'soldier',length:20,towerDrain:true,watchRecruitment:false};hideTitle();titleReturn=$('title-quick');cameFromTitle=true;showLoading({label:STAGE_LABELS[0],progress:0,matchup:matchupText(opts)});if(flow){try{battle.quickStart(opts);return;}catch(e){console.warn('quickStart failed',e);}}
  // Fallback until the battle-flow package lands: set the setup selects and start.
  const set=(id,v)=>{const el=$(id);if(el&&v!=null&&[...el.options].some(o=>o.value===String(v)))el.value=String(v);};set('battle-class',opts.class);set('battle-team-size',opts.size);set('battle-castle-source',opts.source);set('battle-castle-level',opts.level);set('battle-bot-skill',opts.skill);set('battle-match-length',opts.length);const panel=$('battle-panel'),run=battle.start();if(panel&&battle.preparing)panel.hidden=true;Promise.resolve(run).finally(()=>{if(!battle.active&&!titleOpen&&panel&&cameFromTitle&&!cancelled){hideLoading();panel.hidden=false;}cancelled=false;});}
 const actions={'title-quick':startQuick,
  'title-custom'(){hideTitle();titleReturn=$('title-custom');cameFromTitle=true;battle.open();},
  'title-workshop'(){hideTitle();titleReturn=$('title-workshop');cameFromTitle=true;onWorkshop();},
  'title-explore'(){hideTitle();cameFromTitle=false;body.classList.add('mode-explore');onExplore();message(coarse()?'Explore the Aerie. Tap Pause for the menu.':'Explore the Aerie. Esc for menu.');},
  'title-settings'(){showLook(true,$('title-settings'));},
  'title-howto'(){showControls($('title-howto'));},
  'title-stats'(){openStats();}};
 if(title){for(const [id,fn] of Object.entries(actions)){const b=$(id);if(b){b.addEventListener('click',()=>{if(titleOpen&&!confirmState)fn();});b.disabled=false;}}if($('title-stats')&&typeof getStats()?.open!=='function')$('title-stats').hidden=true;const st=$('title-status');if(st)st.textContent=matchMedia('(pointer:coarse)').matches?'Tap a choice to begin.':'↑ ↓ to choose · Enter to select';}

 // ---------- loading overlay ----------
 let loading=null,loadStart=0,loadTimer=0,tipIndex=Math.floor(Math.random()*TIPS.length),tipAt=0,lastProgress=null,seenEvents=false;
 function buildLoading(){if(loading)return loading;loading=document.createElement('div');loading.id='game-loading';loading.hidden=true;loading.innerHTML='<div class="loading-card shell-frame" role="status" aria-live="polite"><div class="intro-head"><small class="loading-eyebrow" id="intro-origin">CUSTOM BATTLE</small><h2 class="intro-mode">Skyward Skirmish</h2><p class="intro-map">The Floating Aerie</p></div><div class="intro-factions"><span class="intro-faction" data-team="0"><i></i><b>Dawn</b><small></small></span><span class="intro-vs">vs</span><span class="intro-faction" data-team="1"><i></i><b>Dusk</b><small></small></span></div><p class="intro-flavour" id="intro-flavour"></p><p id="loading-matchup"></p><p id="loading-stage"></p><div class="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="Battle preparation"><i id="loading-fill"></i></div><p class="loading-meta"><span id="loading-attempt"></span><span id="loading-elapsed">0s</span></p><p id="loading-tip"></p><button id="loading-cancel" class="shell-btn">Cancel</button></div>';body.append(loading);ghostPanel(loading,0);loading.querySelector('#loading-cancel').addEventListener('click',cancelLoading);return loading;}
 function matchupText(o={}){const v=id=>document.getElementById(id)?.value,c=o.class||v('battle-class')||'ranger',n=Number(o.size||v('battle-team-size')||8),lvl=o.level||v('battle-castle-level');return (CLASS_NAMES[c]||c)+' · '+(document.getElementById('battle-play-bots')?.checked===false?'Solo practice · bots off':n+'v'+n)+(lvl?' · Enemy castle level '+lvl:'');}
 // A bare '4v4' from battle progress must not replace the richer 'Ranger · 4v4 · Enemy castle level 30'.
 const matchupOf=m=>!m?'':typeof m==='string'?(/^\s*\d+\s*v\s*\d+\s*$/i.test(m)?'':m):matchupText(m);
 const setText=(el,t)=>{if(el&&el.textContent!==t)el.textContent=t;};
 function renderLoading(p={}){const L=buildLoading(),i=stageIndex(p.stage,p.label),label=p.label||(i>=0?STAGE_LABELS[i]:'Preparing the battle');let frac=Number.isFinite(p.progress)?Math.max(0,Math.min(1,p.progress)):null;const overall=i>=0?(i+(frac??0))/STAGES.length:(frac??0);setText(L.querySelector('#loading-stage'),label);const fill=L.querySelector('#loading-fill'),w=Math.round(Math.max(.03,overall)*100)+'%';if(fill.style.width!==w)fill.style.width=w;L.querySelector('.loading-bar').setAttribute('aria-valuenow',String(Math.round(overall*100)));const m=matchupOf(p.matchup);if(m)setText(L.querySelector('#loading-matchup'),m);setText(L.querySelector('#loading-attempt'),p.attempt>1?'Attempt '+p.attempt+' · redesigning the enemy castle':'');
  // The bottom banner (castles rising in view) holds from the raising stage to the end of the load: the centred card does not
  // flick back for the short routing/deploying stages; the match intro brings it back as its own beat.
  if(i===1||battle?.building)L.classList.add('banner');}
 function tick(){if(!loadingOpen)return;const now=performance.now();const el=loading.querySelector('#loading-elapsed'),secs=Math.floor(elapsedAt?elapsedBase+(now-elapsedAt)/1000:(now-loadStart)/1000);setText(el,secs+'s');if(now-tipAt>6000){tipAt=now;tipIndex=(tipIndex+1)%TIPS.length;loading.querySelector('#loading-tip').innerHTML=tipText(tipIndex);}
  // Without setup progress events (battle-flow not merged), derive the stage from the battle state.
  if(!seenEvents){if(battle?.building)renderLoading({label:STAGE_LABELS[1],progress:Math.min(1,(now-(buildBegan||(buildBegan=now)))/7000)});else if(buildBegan&&battle?.preparing)renderLoading({label:STAGE_LABELS[2],progress:.5});else if(battle?.preparing)renderLoading({label:STAGE_LABELS[0],progress:Math.min(.9,(now-loadStart)/20000)});else if(battle?.active)hideLoading();}}
 let buildBegan=0,elapsedBase=0,elapsedAt=0;
 const noteElapsed=p=>{if(Number.isFinite(p?.elapsed)){elapsedBase=p.elapsed>1000?p.elapsed/1000:p.elapsed;elapsedAt=performance.now();}};
 // BF1-style intro card: mode, map, the two factions in their colours (yours marked) and one line of flavour.
 function introText(){const you=battle?.context?.human?.team===1?1:0,names=['Dawn','Dusk'];setText(loading.querySelector('#intro-origin'),matchOrigin==='quick'?'QUICK BATTLE':'CUSTOM BATTLE');for(const f of loading.querySelectorAll('.intro-faction')){const mine=Number(f.dataset.team)===you;f.classList.toggle('you',mine);setText(f.querySelector('small'),mine?'You':'Enemy');}setText(loading.querySelector('#intro-flavour'),'Seize the silos, break the '+names[1-you]+' shield and shatter their core, then outrun the blast.');}
 function showLoading(p={}){buildLoading();if(!loadingOpen){endIntro();ghostEnd(loading);introText();loadingOpen=true;loadStart=performance.now();buildBegan=0;tipAt=performance.now();loading.querySelector('#loading-tip').innerHTML=tipText(tipIndex);loading.hidden=false;body.classList.add('shell-loading');clearInterval(loadTimer);loadTimer=setInterval(tick,250);elapsedAt=0;if(!matchupOf(p.matchup))p={...p,matchup:matchupText()};}lastProgress=p;noteElapsed(p);renderLoading(p);if(!loading.contains(document.activeElement))loading.querySelector('#loading-cancel').focus({preventScroll:true});}
 // Keyboard focus belongs to Cancel while the card is up: put it back when the game (setPause, a canvas click) took it.
 function focusCancel(){const a=document.activeElement;if(loadingOpen&&!confirmState&&(!a||a===body||a===canvas||a===document.documentElement))loading.querySelector('#loading-cancel')?.focus({preventScroll:true});}
 function updateLoading(p={}){if(settling())return;seenEvents=true;if(!loadingOpen)showLoading(p);else{lastProgress=p;noteElapsed(p);renderLoading(p);focusCancel();}}
 // {intro:true} (the match started): the card holds over main.js's camera fly-in and slides away, then the HUD fades in. A load
 // that ended on the bottom banner brings the title card back fading in (.intro-fresh). Timing: introFrame().
 function hideLoading(o){if(!loadingOpen)return;loadingOpen=false;clearInterval(loadTimer);const withIntro=!!o?.intro&&motionOK();loading.hidden=true;
  if(withIntro){const fresh=loading.classList.contains('banner');loading.classList.remove('banner');ghostEnd(loading);endIntro();loading.classList.add('shell-out','intro-out');if(fresh)loading.classList.add('intro-fresh');loading.inert=true;
   let anims=[];try{anims=loading.getAnimations?.({subtree:true})||[];for(const a of anims){a.pause();a.currentTime=0;}}catch{anims=[];}
   intro={t:0,ms:0,hud:false,anims};body.classList.add('shell-intro');
   // A host that never steps the intro (no introFrame calls) still gets its HUD back.
   introSafety=setTimeout(()=>{if(intro&&!intro.t)endIntro();},15000);}
  else ghostOut(loading,o?.instant?0:260);loading.classList.remove('banner');body.classList.remove('shell-loading');lastProgress=null;seenEvents=false;if(loading.contains(document.activeElement))canvas?.focus({preventScroll:true});}
 let cancelled=false,settleTimer=0,afterSettle=null;
 // A cancelled setup settles a moment later (its abort lands at its next await, and its progress timer still ticks until then): its
 // late progress must not reopen the card over the title, a Quick Battle pick waits for it, and when it has settled focus goes back
 // to the title button that launched the load if the teardown left it on the canvas.
 const settling=()=>cancelled&&!!battle?.preparing;
 function settle(){clearTimeout(settleTimer);settleTimer=0;if(battle?.preparing){settleTimer=setTimeout(settle,100);return;}cancelled=false;const run=afterSettle;waitQuick(null);if(run){if(titleOpen)run();return;}refocusTitle();}
 // A Quick Battle picked while the cancel settles: the title says so and the button is busy until it starts (or the title closes).
 const STOPPING='Stopping the last battle setup…';
 function waitQuick(run){afterSettle=run;const q=$('title-quick');if(q){if(run)q.setAttribute('aria-busy','true');else q.removeAttribute('aria-busy');}if(run)titleNotice(STOPPING,'busy');else if(notice&&notice.textContent===STOPPING)titleNotice('');}
 // A new launch (START, Rematch, a Quick Battle that did not wait) once the aborted setup has ended: the cancel is over now, not at
 // settle's next poll, so the new setup's progress opens the card (Cancel, then the intro) instead of being dropped as late progress.
 function freshLaunch(){if(battle?.preparing||!cancelled&&!settleTimer&&!afterSettle)return;cancelled=false;clearTimeout(settleTimer);settleTimer=0;waitQuick(null);}
 function refocusTitle(){if(!titleOpen||confirmState||controlsOpen||lookPanel&&!lookPanel.hidden)return;const a=document.activeElement;if(a&&a!==body&&a!==canvas&&a!==document.documentElement&&visible(a))return;const b=titleReturn&&title.contains(titleReturn)&&!titleReturn.disabled?titleReturn:titleButtons()[0];b?.focus({preventScroll:true});}
 function cancelLoading(){cancelled=true;hideLoading();if(typeof battle?.cancelSetup==='function')battle.cancelSetup();else battle?.stop();$('battle-panel')&&($('battle-panel').hidden=true);if(cameFromTitle)showTitle();settle();}

 // ---------- controls panel ----------
 let controls=null,controlsMode=null;
 const coarse=()=>{try{return matchMedia('(pointer:coarse)').matches;}catch{return false;}};
 const tipText=i=>(coarse()?TOUCH_TIPS[i]:null)||TIPS[i];
 function renderControls(){const list=controls.querySelector('.controls-list'),touch=controlsMode==='touch';const kb=k=>k.map(x=>'<kbd>'+x+'</kbd>').join('');list.innerHTML=KEYMAP.map(g=>{const rows=g.items.filter(it=>touch?it.touch:it.keys).map(it=>'<dt>'+kb(touch?it.touch:it.keys)+'</dt><dd>'+(touch&&it.tact||it.act)+'</dd>').join('');return rows?'<section class="controls-group"><h3>'+g.group.toUpperCase()+'</h3><dl>'+rows+'</dl></section>':'';}).join('');for(const b of controls.querySelectorAll('.controls-tabs button'))b.setAttribute('aria-pressed',String(b.dataset.mode===controlsMode));moreBelow();}
 // A fade and 'more' arrow at the bottom edge while rows are scrolled out of view.
 function moreBelow(){if(!controls||controls.hidden)return;controls.classList.toggle('more-below',controls.scrollTop+controls.clientHeight<controls.scrollHeight-2);}
 function buildControls(){if(controls)return controls;controls=document.createElement('aside');controls.id='controls-panel';controls.hidden=true;controls.className='shell-frame';controls.setAttribute('role','dialog');controls.setAttribute('aria-modal','true');controls.setAttribute('aria-labelledby','controls-h');controls.innerHTML='<div class="controls-head"><h2 id="controls-h">How to Play</h2><button id="controls-close" aria-label="Close controls">×</button></div><p class="controls-note">Don Bass Crusaders: build castles, then battle. Capture silos to break the enemy shield, destroy its protectors, then shatter the core. When a core falls, escape before the castle explodes.</p><div class="controls-tabs" role="group" aria-label="Control scheme"><button data-mode="keys">Keyboard and mouse</button><button data-mode="touch">Touch</button></div><div class="controls-list"></div>';body.append(controls);ghostPanel(controls,260);controls.querySelector('#controls-close').addEventListener('click',()=>hideControls());for(const b of controls.querySelectorAll('.controls-tabs button'))b.addEventListener('click',()=>{controlsMode=b.dataset.mode;renderControls();});controls.addEventListener('scroll',moreBelow,{passive:true});addEventListener('resize',moreBelow);controlsMode=coarse()?'touch':'keys';renderControls();return controls;}
 function showControls(from=null){buildControls();controlsReturn=from||document.activeElement;controls.hidden=false;controlsOpen=true;controls.querySelector('#controls-h').textContent=battle?.active?'Controls':'How to Play';controls.scrollTop=0;moreBelow();controls.querySelector('#controls-close').focus({preventScroll:true});}
 function hideControls(silent=false){if(!controlsOpen)return;controlsOpen=false;controls.hidden=true;const back=controlsReturn;controlsReturn=null;if(!silent&&back&&document.contains(back)&&visible(back))back.focus({preventScroll:true});}

 // ---------- confirm ----------
 let confirmEl=null;
 function confirm(text,{ok='Leave',cancel='Stay'}={}){if(!confirmEl){confirmEl=document.createElement('div');confirmEl.id='shell-confirm';confirmEl.hidden=true;confirmEl.innerHTML='<section class="shell-frame" role="alertdialog" aria-modal="true" aria-labelledby="shell-confirm-text"><p id="shell-confirm-text"></p><div class="confirm-actions"><button id="shell-confirm-cancel"></button><button id="shell-confirm-ok"></button></div></section>';body.append(confirmEl);ghostPanel(confirmEl,200);confirmEl.querySelector('#shell-confirm-ok').addEventListener('click',()=>closeConfirm(true));confirmEl.querySelector('#shell-confirm-cancel').addEventListener('click',()=>closeConfirm(false));}
  if(confirmState)closeConfirm(false);const back=document.activeElement;confirmEl.querySelector('#shell-confirm-text').textContent=text;confirmEl.querySelector('#shell-confirm-ok').textContent=ok;confirmEl.querySelector('#shell-confirm-cancel').textContent=cancel;confirmEl.hidden=false;confirmEl.querySelector('#shell-confirm-cancel').focus({preventScroll:true});return new Promise(resolve=>{confirmState={resolve,back};});}
 function closeConfirm(value){if(!confirmState)return;const {resolve,back}=confirmState;confirmState=null;confirmEl.hidden=true;if(back&&document.contains(back)&&visible(back))back.focus({preventScroll:true});resolve(value);}

 // ---------- Crusader creator (crusader-creator.js): the title entry ----------
 // The sheet replaces the title (main.js glides the camera to the 'crusader' vantage, your chibi beside the sheet); closing it
 // returns to the title with focus on the entry.
 let creator=null;
 function useCreator(c){if(!c||typeof c.open!=='function'||creator)return false;creator=c;if(!title)return true;let b=$('title-crusader');
  if(!b){b=document.createElement('button');b.id='title-crusader';b.type='button';b.setAttribute('aria-haspopup','dialog');b.innerHTML='<span>Crusader</span><img alt="" hidden>';const at=$('title-explore');if(at)at.before(b);else title.querySelector('.title-actions')?.append(b);title.querySelector('.title-actions')?.classList.add('has-crusader');}
  b.addEventListener('click',()=>{if(titleOpen&&!confirmState)openCreator();});b.disabled=false;
  // Its portrait (your last saved crusader) renders when the browser is idle, never during boot work.
  const paint=()=>{try{creator.refreshPortraits?.();}catch(e){console.warn('Crusader portrait failed:',e);}};if(globalThis.requestIdleCallback)requestIdleCallback(paint,{timeout:1500});else setTimeout(paint,500);return true;}
 function openCreator(){if(!creator||battle?.active||battle?.preparing)return false;hideTitle();titleReturn=$('title-crusader');cameFromTitle=true;
  const ok=creator.open({from:'title',onClose(){if(!battle?.active&&!battle?.preparing&&!loadingOpen)showTitle();}});if(!ok)showTitle();return !!ok;}

 // ---------- keyboard (capture phase, before main.js and battle.js) ----------
 addEventListener('keydown',e=>{
  // The stats sheet (battle-stats.js) and the Crusader creator (crusader-creator.js) are modal dialogs that handle their own keys;
  // the title/pause menus must not react under them.
  if(getStats()?.isOpen||creator?.isOpen)return;
  const stop=()=>{e.preventDefault();e.stopImmediatePropagation();};
  if(confirmState){if(e.key==='Escape'){closeConfirm(false);stop();return;}if(trapTab(e,confirmEl))e.stopImmediatePropagation();if(e.key==='Tab')return;if(!confirmEl.contains(e.target))stop();return;}
  if(controlsOpen){if(e.key==='Escape'){hideControls();stop();return;}if(trapTab(e,controls)){e.stopImmediatePropagation();return;}if(!controls.contains(e.target)&&e.key!=='Tab')stop();return;}
  if(titleOpen){if(lookPanel&&!lookPanel.hidden){if(e.key==='Escape'){showLook(false);$('title-settings')?.focus({preventScroll:true});stop();return;}if(lookPanel.contains(e.target)){trapTab(e,lookPanel);return;}}
   if(trapTab(e,title)){e.stopImmediatePropagation();return;}
   const list=titleButtons(),at=list.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&!(e.target instanceof HTMLElement&&e.target.matches('input,select,textarea'))){const n=list.length;if(!n)return;const next=e.key==='Home'?0:e.key==='End'?n-1:at<0?0:(at+(e.key==='ArrowDown'?1:-1)+n)%n;list[next].focus({preventScroll:true});stop();return;}
   if((e.key==='Enter'||e.key===' ')&&at<0&&!(lookPanel&&lookPanel.contains(e.target))){list[0]?.focus({preventScroll:true});stop();return;}
   if(e.key==='Escape')stop();
   return;}
  // Loading: Tab stays on the card, Esc is the Cancel button.
  if(loadingOpen){if(trapTab(e,loading)){e.stopImmediatePropagation();return;}if(e.key==='Escape'){stop();if(!e.repeat)cancelLoading();}}
 },true);

 // Return to the title when the custom setup dialog is closed without a match (until battle-flow's onMenuClosed lands).
 const panel=$('battle-panel');
 if(panel&&!flow){new MutationObserver(records=>{for(const r of records)if(r.oldValue===null&&panel.hidden&&cameFromTitle&&!battle.active&&!battle.preparing&&!titleOpen&&!loadingOpen){showTitle();break;}}).observe(panel,{attributes:true,attributeFilter:['hidden'],attributeOldValue:true});}
 document.addEventListener('click',e=>{if(!(e.target instanceof Element))return;if(e.target.closest('#battle-exit')){cameFromTitle=false;body.classList.add('mode-explore');}if(e.target.closest('#battle-start'))body.dataset.matchOrigin=matchOrigin='custom';if(e.target.closest('#battle-start,#battle-restart'))freshLaunch();},true);
 if(urlParams.has('dev'))body.classList.add('dev');
 updateQuickSub();

 return {showTitle,hideTitle,get titleOpen(){return titleOpen;},showLoading,updateLoading,hideLoading,get loadingOpen(){return loadingOpen;},showControls,hideControls,get controlsOpen(){return controlsOpen;},
  isBlocking(){return titleOpen||loadingOpen||controlsOpen||!!confirmState||!!getStats()?.isOpen||!!creator?.isOpen;},confirm,settings,titleNotice,openStats,motionOK,
  useCreator,openCreator,get creatorOpen(){return !!creator?.isOpen;},
  get introPlaying(){return body.classList.contains('shell-intro');},get introActive(){return !!intro;},introFrame,
  get cameFromTitle(){return cameFromTitle;},set cameFromTitle(v){cameFromTitle=!!v;},
  menuClosed({active}={}){if(!active&&cameFromTitle&&!battle?.preparing&&!loadingOpen){showTitle();
   // battle.js refocuses the canvas after this hook; put focus back on the button that opened the setup.
   setTimeout(()=>{if(!titleOpen||confirmState||lookPanel&&!lookPanel.hidden||title.contains(document.activeElement))return;const b=titleReturn&&title.contains(titleReturn)&&!titleReturn.disabled?titleReturn:titleButtons()[0];b?.focus({preventScroll:true});},0);}}};
}
