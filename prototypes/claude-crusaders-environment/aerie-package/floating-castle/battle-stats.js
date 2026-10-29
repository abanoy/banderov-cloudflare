// Session stats (a battle.use() extension; loaded by main.js as ./battle-stats.js?v=dbc-20261018 with battle-stats.css?v=dbc-20261018).
// Every finished match adds the local player's row of the finish summary (battle.js buildSummary: outcome, actors[] kills/deaths/
// captures/damage/structureDamage/revives/score/survivalBonus/total/classId, mvp[team], duration) plus the tower strikes their team
// landed (tower-impact events) to a session record kept in sessionStorage STATS_KEY: it survives reloads in the same tab and is gone
// when the browser session ends (memory fallback when storage is blocked; every access is guarded). Under ?test it stays in memory
// unless ?stats=1, so test runs start clean. Nothing is sent anywhere: online saving, accounts and leaderboards go through
// online-services.js, whose placeholders reject with ServiceUnavailableError until the Banderov SDK lands.
// Import-safe in Node: no window/document/storage access until a hook or method runs. The sheet (<dialog id="stats-sheet">) is
// mounted on the first open(); finished() adds a "Stats" button (#battle-stats) to the results screen's actions row.
// API: createStats({storage,search,services,now}) -> ext {name:'stats', attach, started, event, finished, stopped, reset, open(),
// close(), toggle(), isOpen, snapshot(), clear()}. NOTE: battle.js also calls ext.reset(ctx) on every start/stop (visual reset hook);
// reset() only clears the stats when called WITHOUT the battle ctx (reset() / reset({clear:true})), clear() always does.
import {createOnlineServices,isServiceUnavailable} from './online-services.js?v=dbc-20261018';
export const STATS_KEY='crusaders-stats-session-v1',STATS_VERSION=1,RECENT_LIMIT=10;
export const STATS_CLASSES=Object.freeze(['ranger','fighter','mage','builder']);
const OUTCOMES=['victory','defeat','stalemate'],RESULT={victory:'Victory',defeat:'Defeat',stalemate:'Stalemate'};
const TOTALS=['matches','wins','losses','stalemates','kills','deaths','captures','damage','revives','towerStrikes','mvps','escapes','score','bestScore','seconds'];
const CLASS_TOTALS=['matches','wins','losses','stalemates','kills','deaths','captures','damage','revives','score','bestScore','seconds','last'];
const SKILL={recruit:'Recruit',soldier:'Soldier',veteran:'Veteran'};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),num=v=>{v=Number(v);return Number.isFinite(v)&&v>0?v:0;},str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
const classOk=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,15}$/.test(id);
export const classLabel=id=>({ranger:'Ranger',fighter:'Fighter',mage:'Mage',builder:'Builder'})[id]||(classOk(id)?id.charAt(0).toUpperCase()+id.slice(1):'Fighter');
// K/D as text: '–' before any knockout or down (0 / 0), like the other unplayed cells.
export const kd=(k,d)=>k>0||d>0?(d>0?k/d:k).toFixed(2):'–';
export const winRate=(w,m)=>m>0?Math.round(100*w/m)+'%':'–';
export function playTime(sec){sec=Math.round(num(sec));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,s=sec%60;return h?h+'h '+String(m).padStart(2,'0')+'m':m+'m '+String(s).padStart(2,'0')+'s';}
const big=n=>{n=Math.round(num(n));return n<10000?String(n):n<1e6?(n/1000).toFixed(n<1e5?1:0).replace(/\.0$/,'')+'k':(n/1e6).toFixed(1).replace(/\.0$/,'')+'M';};
const emptyClass=()=>Object.fromEntries(CLASS_TOTALS.map(k=>[k,0]));
export function emptyStats(now=Date.now()){const s={v:STATS_VERSION,since:now,updated:0};for(const k of TOTALS)s[k]=0;s.classes={};s.recent=[];return s;}

// Restores a stored record; anything malformed is dropped (a bad record gives fresh stats, never an exception).
export function sanitizeStats(raw,now=Date.now()){
 if(!raw||typeof raw!=='object'||raw.v!==STATS_VERSION)return null;
 const s=emptyStats(num(raw.since)||now);s.updated=num(raw.updated);for(const k of TOTALS)s[k]=Math.round(num(raw[k]));s.seconds=num(raw.seconds);
 s.matches=Math.max(s.matches,s.wins+s.losses+s.stalemates);
 if(raw.classes&&typeof raw.classes==='object')for(const id of Object.keys(raw.classes).slice(0,12)){const c=raw.classes[id];if(!classOk(id)||!c||typeof c!=='object')continue;const o=s.classes[id]=emptyClass();for(const k of CLASS_TOTALS)o[k]=num(c[k]);}
 if(Array.isArray(raw.recent))for(const r of raw.recent){if(s.recent.length>=RECENT_LIMIT)break;if(!r||typeof r!=='object'||!OUTCOMES.includes(r.outcome))continue;
  s.recent.push({at:num(r.at),mode:str(r.mode,40)||'Bot battle',detail:str(r.detail,40),size:str(r.size,8),outcome:r.outcome,reason:r.reason==='time'?'time':'core',classId:classOk(r.classId)?r.classId:'ranger',kills:num(r.kills),deaths:num(r.deaths),captures:num(r.captures),damage:num(r.damage),revives:num(r.revives),towerStrikes:num(r.towerStrikes),score:num(r.score),mvp:r.mvp===true,escaped:r.escaped===true,duration:num(r.duration)});}
 return s;}

// Adds one finish summary to `s` (mutates it) and returns the recent-match entry, or null when the summary has no local player.
// meta: {at, mode, detail, size, towerStrikes, classId}.
export function recordMatch(s,summary,meta={}){
 const list=Array.isArray(summary?.actors)?summary.actors:null;if(!list)return null;const me=list.find(a=>a&&a.human)||list.find(a=>a&&a.id===0);if(!me)return null;
 const team=me.team===1?1:0,outcome=OUTCOMES.includes(summary.outcome)?summary.outcome:summary.winner<0?'stalemate':summary.winner===team?'victory':'defeat';
 const classId=classOk(me.classId)?me.classId:classOk(meta.classId)?meta.classId:'ranger',score=Math.round(me.total!==undefined?num(me.total):num(me.score)+num(me.survivalBonus));
 const per=Math.max(1,Math.round(list.length/2)),e={at:num(meta.at)||Date.now(),mode:str(meta.mode,40)||'Bot battle',detail:str(meta.detail,40),size:str(meta.size,8)||(list.length===1?'Solo':per+'v'+per),outcome,reason:summary.reason==='time'?'time':'core',classId,
  kills:Math.round(num(me.kills)),deaths:Math.round(num(me.deaths)),captures:Math.round(num(me.captures)),damage:Math.round(num(me.damage)+num(me.structureDamage)),revives:Math.round(num(me.revives)),towerStrikes:Math.round(num(meta.towerStrikes)),
  score,mvp:Array.isArray(summary.mvp)&&summary.mvp[team]!=null&&summary.mvp[team]===me.id,escaped:num(me.survivalBonus)>0,duration:num(summary.duration)};
 const key=outcome==='victory'?'wins':outcome==='defeat'?'losses':'stalemates';
 s.matches++;s[key]++;s.kills+=e.kills;s.deaths+=e.deaths;s.captures+=e.captures;s.damage+=e.damage;s.revives+=e.revives;s.towerStrikes+=e.towerStrikes;s.mvps+=e.mvp?1:0;s.escapes+=e.escaped?1:0;s.score+=score;s.bestScore=Math.max(s.bestScore,score);s.seconds+=e.duration;s.updated=e.at;
 const c=own(s.classes,classId)?s.classes[classId]:s.classes[classId]=emptyClass();
 c.matches++;c[key]++;c.kills+=e.kills;c.deaths+=e.deaths;c.captures+=e.captures;c.damage+=e.damage;c.revives+=e.revives;c.score+=score;c.bestScore=Math.max(c.bestScore,score);c.seconds+=e.duration;c.last=e.at;
 s.recent.unshift(e);if(s.recent.length>RECENT_LIMIT)s.recent.length=RECENT_LIMIT;return e;}

// The most played class (ties: more wins, then the most recently played), or null before the first match.
export function favouriteClass(s){let best=null,b=null;for(const id of Object.keys(s?.classes||{})){const c=s.classes[id];if(!c.matches)continue;if(!b||c.matches>b.matches||c.matches===b.matches&&(c.wins>b.wins||c.wins===b.wins&&c.last>b.last)){best=id;b=c;}}return best;}

export function createStats(options={}){
 let ctx=null,store,data=null,match=null,seq=0,services=options.services||null,dom=null,shown=false,returnTo=null,clearArmed=0,clearTimer=0,busy=false,keyBound=false,hidResult=null;
 const now=()=>typeof options.now==='function'?options.now():Date.now();
 const doc=()=>globalThis.document||null;
 const svc=()=>services||(services=createOnlineServices());
 function search(){try{return String(options.search??globalThis.location?.search??'');}catch{return '';}}
 function storage(){if(store!==undefined)return store;store=null;try{if(options.storage!==undefined)store=options.storage||null;else{const q=new URLSearchParams(search());if(!q.has('test')||q.get('stats')==='1')store=globalThis.sessionStorage||null;}}catch{store=null;}return store;}
 function load(){if(data)return data;let raw=null;try{raw=storage()?.getItem?.(STATS_KEY)??null;}catch{raw=null;}
  try{data=raw?sanitizeStats(JSON.parse(raw),now()):null;}catch{data=null;}return data||(data=emptyStats(now()));}
 function persist(){const st=storage();if(!st)return false;try{st.setItem(STATS_KEY,JSON.stringify(data));return true;}catch{return false;}}
 function clear(){data=emptyStats(now());const st=storage();if(st)try{st.removeItem(STATS_KEY);}catch{}if(shown)render();return true;}
 function readSetup(){const d=doc(),o={detail:'',mode:''};try{o.mode={quick:'Quick Battle',custom:'Custom Battle'}[d?.body?.dataset?.matchOrigin]||'';}catch{}try{const skill=d?.getElementById?.('battle-bot-skill')?.value,level=d?.getElementById?.('battle-castle-level')?.value,solo=d?.getElementById?.('battle-play-bots')?.checked===false;o.detail=[solo?'':SKILL[skill]||'',level?'Lv '+String(level).slice(0,4):''].filter(Boolean).join(' · ');}catch{}return o;}
 function beginMatch(c){const h=c?.human,list=c?.actors,per=Math.max(1,Math.round((list?.length||0)/2)),setup=readSetup();
  match={token:++seq,team:h?.team===1?1:0,classId:h?.classId||'',size:list?.length===1?'Solo':list?.length?per+'v'+per:'',mode:setup.mode||'Bot battle',detail:setup.detail,strikes:0,counted:false};}

 // ---------- sheet ----------
 const FOCUS='a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
 function el(tag,cls,text){const n=doc().createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function mount(){if(dom)return dom;const d=doc();if(!d?.body)return null;
  const dlg=d.createElement('dialog');dlg.id='stats-sheet';dlg.tabIndex=-1;dlg.setAttribute('aria-labelledby','stats-title');dlg.setAttribute('aria-describedby','stats-notice-text');
  dlg.innerHTML='<div class="stats-frame"><div class="stats-head"><div class="stats-heading"><small class="stats-eyebrow">This session</small><h2 id="stats-title">Stats</h2></div><button type="button" id="stats-close-x" class="stats-x" aria-label="Close stats">×</button></div>'
   +'<div class="stats-body"><section class="stats-notice" aria-label="Save your stats"><p id="stats-notice-text" class="stats-notice-title">Stats are temporary. Create a Banderov account to save your stats!</p>'
   +'<p class="stats-notice-sub">They last until this browser tab closes. Online saving, leaderboards and matchmaking come with Banderov accounts.</p>'
   +'<div class="stats-notice-actions"><a id="stats-account" class="stats-btn stats-primary" target="_blank" rel="noopener noreferrer">Create Banderov account</a><button type="button" id="stats-save" class="stats-btn">Save online</button><button type="button" id="stats-leaderboards" class="stats-btn stats-soon">Leaderboards <small>(coming soon)</small></button></div>'
   +'<p id="stats-status" class="stats-status" role="status" aria-live="polite"></p></section>'
   +'<section class="stats-section" aria-labelledby="stats-overview-h"><h3 id="stats-overview-h">Overview</h3><div id="stats-overview"></div></section>'
   +'<section class="stats-section" id="stats-classes-section" aria-labelledby="stats-classes-h"><h3 id="stats-classes-h">Classes</h3><div class="stats-table-wrap"><table id="stats-classes" class="stats-table"><thead><tr><th scope="col">Class</th><th scope="col">Played</th><th scope="col">Won</th><th scope="col" class="stats-wide">K</th><th scope="col" class="stats-wide">D</th><th scope="col">K/D</th><th scope="col">Best</th></tr></thead><tbody></tbody></table></div></section>'
   +'<section class="stats-section" id="stats-recent-section" aria-labelledby="stats-recent-h"><h3 id="stats-recent-h">Recent matches</h3><div class="stats-table-wrap"><table id="stats-recent" class="stats-table"><thead><tr><th scope="col">Match</th><th scope="col">Result</th><th scope="col">K/D</th><th scope="col">Score</th></tr></thead><tbody></tbody></table></div></section></div>'
   +'<div class="stats-foot"><button type="button" id="stats-clear" class="stats-btn">Clear stats</button><button type="button" id="stats-close" class="stats-btn stats-primary">Close</button></div></div>';
  d.body.append(dlg);const q=s=>dlg.querySelector(s);
  dom={dlg,status:q('#stats-status'),overview:q('#stats-overview'),classes:q('#stats-classes tbody'),recent:q('#stats-recent tbody'),classSec:q('#stats-classes-section'),recentSec:q('#stats-recent-section'),
   account:q('#stats-account'),save:q('#stats-save'),boards:q('#stats-leaderboards'),clearBtn:q('#stats-clear'),body:q('.stats-body')};
  q('#stats-close-x').addEventListener('click',()=>close());q('#stats-close').addEventListener('click',()=>close());
  dom.account.addEventListener('click',e=>{let url='';try{url=svc().accountUrl();}catch{}if(!url){e.preventDefault();say("Banderov accounts aren't available yet.");return;}dom.account.href=url;say('Opening the Banderov account page in a new tab.');});
  dom.save.addEventListener('click',saveOnline);dom.boards.addEventListener('click',boards);dom.clearBtn.addEventListener('click',clearClick);
  // Head and foot are divs: style.css positions every <header>/<footer> fixed (the game HUD) and the shell hides them on the title.
  // Keys stop at the sheet: main.js / battle.js never see them (Esc would pause, Enter would start a rematch).
  dlg.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key==='Tab')trap(e);});
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});dlg.addEventListener('close',()=>{if(shown&&!dlg.open)close(true);});// a late 'close' task from an earlier close() must not shut a reopened sheet
  if(!keyBound){keyBound=true;addEventListener('keydown',e=>{if(!shown||!dom||dom.dlg.contains(e.target))return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){e.preventDefault();focusables()[0]?.focus({preventScroll:true});}},true);}
  return dom;}
 const focusables=()=>dom?[...dom.dlg.querySelectorAll(FOCUS)].filter(n=>n.getClientRects().length>0):[];
 function trap(e){const list=focusables();if(!list.length)return;const first=list[0],last=list[list.length-1],at=list.indexOf(doc().activeElement);
  if(e.shiftKey&&at<=0){last.focus({preventScroll:true});e.preventDefault();}else if(!e.shiftKey&&(at<0||at===list.length-1)){first.focus({preventScroll:true});e.preventDefault();}}
 function say(text,tone=''){if(!dom)return;if(dom.status.textContent!==text)dom.status.textContent=text;dom.status.dataset.tone=tone;}
 async function saveOnline(){if(busy)return;busy=true;dom.save.setAttribute('aria-busy','true');say('Saving…');
  try{await svc().saveStats(snapshot());say('Saved to your Banderov account.','good');}
  catch(err){say(isServiceUnavailable(err)?"Online saving isn't available yet. Your stats stay in this tab until it closes.":"Couldn't save online right now. Your stats stay in this tab.",'warn');}
  finally{busy=false;dom?.save.removeAttribute('aria-busy');}}
 async function boards(){try{await svc().fetchLeaderboard('score');say('Leaderboards are on the way.');}catch(err){say(isServiceUnavailable(err)?'Leaderboards are coming soon.':"Leaderboards couldn't load right now.",'warn');}}
 function clearClick(){const b=dom.clearBtn;clearTimeout(clearTimer);if(!clearArmed){clearArmed=1;b.textContent='Confirm clear';b.dataset.armed='true';say('Press Confirm clear to wipe this session\'s stats.','warn');clearTimer=setTimeout(disarm,4000);return;}
  // Focus moves to Close first: the clear button is disabled by the clear and would drop focus to the page.
  disarm();dom.dlg.querySelector('#stats-close')?.focus({preventScroll:true});clear();say('Session stats cleared.');}
 function disarm(){clearArmed=0;clearTimeout(clearTimer);if(dom){dom.clearBtn.textContent='Clear stats';delete dom.clearBtn.dataset.armed;}}
 function when(at){if(!at)return '–';try{const d=new Date(at),t=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return d.toDateString()===new Date(now()).toDateString()?t:d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+t;}catch{return '–';}}
 function tile(label,value,cls=''){const t=el('div','stats-tile'+(cls?' '+cls:''));t.append(el('b','',value),el('small','',label));return t;}
 function render(){if(!dom)return;const s=load();
  dom.account.href=(()=>{try{return svc().accountUrl();}catch{return 'https://banderov.com/account/';}})();dom.clearBtn.disabled=!s.matches;
  if(!s.matches){const empty=el('div','stats-empty');empty.append(el('b','','No matches yet this session'),el('p','','Finish a Quick or Custom Battle and your wins, knockouts, captures and best scores land here.'));dom.overview.replaceChildren(empty);dom.classSec.hidden=dom.recentSec.hidden=true;dom.classes.replaceChildren();dom.recent.replaceChildren();return;}
  dom.classSec.hidden=dom.recentSec.hidden=false;const fav=favouriteClass(s);
  const head=el('div','stats-headline');head.append(tile('Matches',String(s.matches)),tile('Win rate',winRate(s.wins,s.matches)),tile('K/D',kd(s.kills,s.deaths)),tile('Best score',big(s.bestScore)));
  const grid=el('div','stats-grid');grid.append(tile('Wins',String(s.wins),'is-win'),tile('Losses',String(s.losses),'is-loss'),tile('Stalemates',String(s.stalemates)),tile('Kills',big(s.kills)),tile('Deaths',big(s.deaths)),tile('Captures',big(s.captures)),tile('Damage',big(s.damage)),tile('Revives',big(s.revives)),tile('Tower strikes',big(s.towerStrikes)),tile('MVPs',String(s.mvps)),tile('Time played',playTime(s.seconds)),tile('Favourite class',fav?classLabel(fav):'–'));
  dom.overview.replaceChildren(head,grid);
  const ids=[...STATS_CLASSES,...Object.keys(s.classes).filter(id=>!STATS_CLASSES.includes(id))],rows=[];
  for(const id of ids){const c=own(s.classes,id)?s.classes[id]:null,tr=el('tr',c?.matches?'':'is-unplayed');if(id===fav)tr.dataset.fav='true';const name=el('td','stats-name',classLabel(id));if(id===fav)name.append(el('span','stats-badge','Fav'));
   tr.append(name,el('td','',String(c?.matches||0)),el('td','',String(c?.wins||0)),el('td','stats-wide',big(c?.kills)),el('td','stats-wide',big(c?.deaths)),el('td','',c?.matches?kd(c.kills,c.deaths):'–'),el('td','',c?.matches?big(c.bestScore):'–'));rows.push(tr);}
  dom.classes.replaceChildren(...rows);
  dom.recent.replaceChildren(...s.recent.map(r=>{const tr=el('tr','is-'+r.outcome),m=el('td','stats-match');m.append(el('b','',when(r.at)),el('small','',[r.size,r.mode,classLabel(r.classId),r.detail].filter(Boolean).join(' · ')));
   const res=el('td','stats-result',RESULT[r.outcome]);if(r.mvp)res.append(el('span','stats-badge','MVP'));tr.append(m,res,el('td','',r.kills+' / '+r.deaths),el('td','',big(r.score)));return tr;}));}
 function open(){const m=mount();if(!m)return false;if(shown)return true;load();disarm();say('');render();const d=doc();returnTo=d.activeElement&&d.activeElement!==d.body?d.activeElement:null;
  // battle.js's results-screen keys (window capture: Esc swallowed, Enter = Rematch, Tab cycles its buttons) stand down while
  // #battle-result is hidden, so the results dialog steps aside under the sheet and comes back on close.
  const res=resultEl();if(res&&!res.hidden){res.hidden=true;hidResult=res;}
  shown=true;try{if(typeof m.dlg.showModal==='function')m.dlg.showModal();else m.dlg.setAttribute('open','');}catch{m.dlg.setAttribute('open','');}
  d.documentElement.classList.add('stats-open');m.body.scrollTop=0;(m.dlg.querySelector('#stats-close-x'))?.focus({preventScroll:true});return true;}
 function close(fromEvent=false){if(!shown)return false;shown=false;disarm();const m=dom,d=doc();try{if(!fromEvent&&m.dlg.open)m.dlg.close();}catch{}m.dlg.removeAttribute('open');d.documentElement.classList.remove('stats-open');
  if(hidResult){if(hidResult.isConnected&&(!ctx||ctx.phase==='finished'))hidResult.hidden=false;hidResult=null;}
  const back=returnTo;returnTo=null;if(back&&back.isConnected&&back.getClientRects().length&&!back.closest?.('[hidden],[inert]'))try{back.focus({preventScroll:true});}catch{}return true;}
 function resultEl(){return ctx?.dom?.result||doc()?.getElementById?.('battle-result')||null;}
 function addResultButton(){const d=doc();if(!d)return null;const row=resultEl()?.querySelector?.('.battle-dialog-actions');if(!row)return null;
  let b=d.getElementById('battle-stats');if(!b){b=d.createElement('button');b.type='button';b.id='battle-stats';b.textContent='Stats';b.setAttribute('aria-haspopup','dialog');b.addEventListener('click',()=>api.open());}
  if(b.parentElement!==row){const rematch=row.querySelector('#battle-restart');row.insertBefore(b,rematch||null);}return b;}
 function snapshot(){const s=load(),fav=favouriteClass(s);const copy=JSON.parse(JSON.stringify(s));
  return Object.assign(copy,{key:STATS_KEY,temporary:true,storage:storage()?'session':'memory',kd:Number((s.deaths>0?s.kills/s.deaths:s.kills).toFixed(2)),winRate:s.matches?s.wins/s.matches:0,favouriteClass:fav,inMatch:!!match&&!match.counted});}

 const api={name:'stats',
  attach(c){ctx=c;},
  started(c){ctx=c||ctx;beginMatch(ctx);},
  event(e){if(e.type!=='tower-impact'||!match)return;const t=e.attackerTeam??(e.team===0?1:e.team===1?0:-1);if(t===match.team)match.strikes++;},
  finished(summary,c){ctx=c||ctx;if(!match)beginMatch(ctx);if(match.counted)return;match.counted=true;
   const e=recordMatch(load(),summary,{at:now(),mode:match.mode,detail:match.detail,size:match.size,towerStrikes:match.strikes,classId:match.classId});if(e)persist();addResultButton();if(shown)render();},
  stopped(){match=null;},
  // battle.js calls reset(ctx) at every start/stop (visual reset): ignore that; reset() / reset({clear:true}) clears the stats.
  reset(arg){if(arg&&typeof arg==='object'&&arg.clear!==true)return false;return clear();},
  clear,open,close:()=>close(),toggle(){return shown?(close(),false):api.open();},snapshot,
  get isOpen(){return shown;},get services(){return svc();},get storageKey(){return STATS_KEY;}};
 return api;
}
