// Match announcer: a priority queue of banners for the big moments, phrased for the viewer's team, plus the live objective line.
// Single voice for big events (handles:['announce']): battle.js skips its #message toast for them while this is attached, so no
// event may be lost here. An event of the same kind as the banner on screen (or one already waiting) merges into it ("Dusk Took
// 2 Silos", the latest count wins and the banner stays up a little longer); other kinds wait their turn in priority order (a
// higher priority pre-empts, and an interrupted banner resumes afterwards). A backlog shows each banner a little faster. An event
// that makes older news stale drops it from the queue (and does not resume it): a shield collapse drops the armed-silo banners
// striking that team, a core collapse drops every lower-priority banner (the match is now decided by the escape).
// Titles are words only; in-match banners use Silkscreen caps with an ink edge (read at a glance), the finish banner blackletter.
// Sub-lines say what the title does not (which silo, who holds how many, what is left). While evacuating, the evacuation box
// carries the clock, so the objective line steps aside. DOM is written only when content changes; polling every 0.25 s. A banner
// that would sit over your own fighter (a short landscape screen, a rising chariot) fades to a ghost until it moves off or ends.
const SHOW=2.2,BRISK=1.4,HOLD=1.4,MAX_HOLD=4.4,POLL=.25;
const titleCase=s=>String(s||'').toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
const clockText=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const list=l=>l.length>3?l.slice(0,3).join(' + ')+' +'+(l.length-3):l.join(' + ');
export function createBattleAnnouncer(){
 let ctx=null,banner=null,titleEl=null,subEl=null,objective=null,current=null,poll=0,V=null,faded=false,objText='',objState='',objShown=false,lastLeft=Infinity,cores=[1,1];const queue=[],shieldDown=[false,false],coreDown=[false,false];
 const viewer=()=>ctx.human?.team??0,name=t=>titleCase(ctx.teamNames?.[t]||(t?'Dusk':'Dawn')),NAME=t=>name(t).toUpperCase();
 const short=id=>{const o=ctx.objectives?.[id];return id===4?'THE CROWN':o?String(o.label).split(' · ')[0]:'SILO';};
 const alive=team=>{let n=0,total=0;for(const p of ctx.protectors?.()||[])if(p.team===team){total++;if(p.hp>0)n++;}return [n,total];};
 const held=team=>{let n=0;for(const o of ctx.objectives||[])if(o.owner===team)n++;return n;},total=()=>ctx.objectives?.length||5;
 // Text builders for kinds that merge: they read the merged labels/count and the live state each time they are painted.
 const count=it=>it.labels.length||it.n,crown=it=>count(it)===1&&it.labels[0]==='THE CROWN',noun=it=>crown(it)?'Crown':'Silo';
 const MAKE={
  capOwn(it){const k=count(it);it.title=k>1?k+' Silos Captured':noun(it)+' Captured';it.sub=(crown(it)?'CENTRAL SILO':list(it.labels))+' · '+held(it.team)+'/'+total()+' HELD';},
  capLost(it){const k=count(it);it.title=k>1?k+' Silos Lost':noun(it)+' Lost';it.sub=NAME(it.team)+' TOOK '+(crown(it)?'THE CENTRE':list(it.labels));},
  capOther(it){const k=count(it);it.title=name(it.team)+(k>1?' Took '+k+' Silos':crown(it)?' Took The Crown':' Took A Silo');it.sub=(crown(it)?'CENTRAL SILO':list(it.labels))+' · '+NAME(it.team)+' HOLDS '+held(it.team)+'/'+total();},
  armedOwn(it){const k=count(it);it.title=k>1?k+' Silos Armed':'Silo Armed';it.sub=list(it.labels)+' · STRIKING '+NAME(1-it.team);},
  armedFoe(it){const k=count(it);it.title=name(it.team)+(k>1?' Armed '+k+' Silos':' Silo Armed');it.sub='RETAKE '+list(it.labels);},
  protFoe(it){const [k]=alive(it.team);it.title=it.n>1?it.n+' Protectors Destroyed':'Protector Destroyed';it.sub=k?k+' LEFT':'CORE EXPOSED';},
  protOwn(it){const [k]=alive(it.team);it.title=it.n>1?it.n+' Protectors Lost':'Protector Lost';it.sub=k?k+' LEFT · DEFEND THEM':'OUR CORE IS EXPOSED';},
  gateFoe(it){it.title=it.n>1?it.n+' Gates Breached':'Gate Breached';it.sub='PUSH INTO '+NAME(it.team)+' CASTLE';},
  gateOwn(it){it.title=it.n>1?it.n+' Gates Lost':'Gate Lost';it.sub='HOLD THE BREACH';}};
 function paint(it){if(titleEl.textContent!==it.title){titleEl.textContent=it.title;titleEl.dataset.face=it.priority>=5&&!/[0-9%]/.test(it.title)?'display':'plain';}const sub=it.sub||'';if(subEl.textContent!==sub)subEl.textContent=sub;}
 function pop(){banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');}
 function show(item){current=item;if(!item.resume){item.left=item.duration||(queue.length>=2?BRISK:SHOW);item.age=0;}item.resume=false;if(item.make)item.make(item);paint(item);banner.dataset.team=item.team>=0?String(item.team):'none';banner.dataset.tone=item.tone||'neutral';banner.hidden=false;pop();document.body.classList.add('announcing');guard();}
 function hide(){current=null;if(banner&&!banner.hidden){banner.hidden=true;banner.classList.remove('show');document.body.classList.remove('announcing');}if(faded){faded=false;banner.classList.remove('over-player');}}
 // Your fighter's screen box (feet to head, as the guide measures it) against the banner, read at most every 0.25 s while one shows.
 function guard(){let over=false;const h=ctx?.human;if(current&&V&&ctx.camera&&h?.alive&&h.state){const s=h.state,b=banner.getBoundingClientRect();V.set(s.x,s.y,s.z).project(ctx.camera);const fx=(V.x*.5+.5)*innerWidth,fy=(-V.y*.5+.5)*innerHeight;V.set(s.x,s.y+2.2,s.z).project(ctx.camera);const hy=(-V.y*.5+.5)*innerHeight,half=Math.max(18,Math.abs(fy-hy)*.6);
  over=V.z>-1&&V.z<1&&b.width>0&&fx+half>b.left&&fx-half<b.right&&Math.max(fy,hy)+10>b.top&&Math.min(fy,hy)-8<b.bottom;}
  if(over!==faded){faded=over;banner.classList.toggle('over-player',over);}}
 // Waiting items are ordered by priority, first come first served within one priority; a resumed banner goes first in its band.
 function enqueue(item,front){let i=queue.findIndex(q=>front?q.priority<=item.priority:q.priority<item.priority);if(i<0)i=queue.length;queue.splice(i,0,item);}
 // item: {title,sub,team,tone,priority,kind?,label?,make?,duration?,topic?,target?,drops?}. Same kind merges (count, labels, latest
 // text); only what a later event's drops(q) marks stale is dropped, never a banner that is still true.
 function announce(item){if(!banner)return;item.priority??=1;item.kind??=item.title;item.n=1;item.labels=item.label?[item.label]:[];
  const dup=current?.kind===item.kind?current:queue.find(q=>q.kind===item.kind);
  if(dup){dup.n++;if(item.label&&!dup.labels.includes(item.label))dup.labels.push(item.label);dup.team=item.team;if(dup.make)dup.make(dup);else{dup.title=item.title;dup.sub=item.sub;}
   if(dup===current){paint(dup);dup.left=Math.max(dup.left,Math.min(HOLD,Math.max(.8,MAX_HOLD-dup.age)));pop();}return;}
  if(item.make)item.make(item);
  if(item.drops)for(let i=queue.length-1;i>=0;i--)if(item.drops(queue[i]))queue.splice(i,1);
  if(!current||item.drops?.(current)){show(item);return;}
  if(item.priority>current.priority){const was=current;if(was.left>.6){was.left=Math.max(was.left,1);was.resume=true;enqueue(was,true);}show(item);return;}
  enqueue(item,false);}
 function clear(){queue.length=0;hide();poll=0;lastLeft=Infinity;cores=[1,1];shieldDown[0]=shieldDown[1]=coreDown[0]=coreDown[1]=false;setObjective('','');}
 function shieldAnnounce(team){if(shieldDown[team])return;shieldDown[team]=true;const v=viewer(),[n]=alive(team);
  const drops=q=>q.topic==='armed'&&q.target===team;
  if(team!==v)announce({kind:'shield'+team,title:name(team)+' Shield Down',sub:n?'DESTROY PROTECTORS · '+n+' LEFT':'STRIKE THE CORE',team,tone:'good',priority:3,drops});
  else announce({kind:'shield'+team,title:'Our Shield Is Down',sub:n?'DEFEND THE PROTECTORS · '+n+' LEFT':'DEFEND THE CORE',team,tone:'bad',priority:3,drops});}
 // The evacuation box (battle.js) already shows the clock and what to do; the banner names the outcome instead.
 function coreAnnounce(team){if(coreDown[team])return;coreDown[team]=true;const v=viewer(),ours=coreDown[v]||(ctx.combat?.state?.cores?.[v]??1)<=0;
  const drops=q=>q.priority<4;
  announce(team!==v?{kind:'core'+team,title:name(team)+' Core Destroyed',sub:ours?'BOTH CORES ARE FALLING':'VICTORY SECURED',team,tone:'good',priority:4,drops}:{kind:'core'+team,title:'Our Core Is Failing',sub:'THE CASTLE WILL EXPLODE',team,tone:'bad',priority:4,drops});}
 function setObjective(text,state){const shown=!!text;if(shown!==objShown){objShown=shown;objective.hidden=!shown;}if(text!==objText){objText=text;objective.textContent=text;}if(state!==objState){objState=state;objective.dataset.state=state;}}
 function update(c){const st=c.combat.state,v=viewer(),en=1-v,R=c.BATTLE_RULES,time=st.time;
  for(let t=0;t<2;t++){if(st.shields[t]<=0&&!shieldDown[t]&&st.phase==='running')shieldAnnounce(t);
   const f=st.cores[t]/(R.coreHp||1);for(const mark of [.5,.25])if(cores[t]>mark&&f<=mark&&f>0)announce(t!==v?{kind:'mark'+t,title:name(t)+(mark<.5?' Core Failing':' Core Cracked'),sub:'CORE '+mark*100+'% · KEEP STRIKING',team:t,tone:'good',priority:2}:{kind:'mark'+t,title:mark<.5?'Our Core Is Breaking':'Our Core Is Cracked',sub:'CORE '+mark*100+'% · DEFEND IT',team:t,tone:'bad',priority:2});cores[t]=f;}
  if(st.phase==='running'&&Number.isFinite(st.matchSeconds)){const left=st.matchSeconds-time;if(lastLeft>300&&left<=300&&left>60)announce({kind:'clock',title:'Five Minutes Left',sub:'HIGHEST SHIELD + CORE WINS',team:-1,priority:2});if(lastLeft>60&&left<=60&&left>0)announce({kind:'clock',title:'One Minute Left',sub:'HIGHEST SHIELD + CORE WINS',team:-1,priority:2});lastLeft=left;}
  if(st.phase==='evacuation')setObjective('','');
  else if(st.phase==='running'){const shield=st.shields[en]/(R.shieldHp||1),[n,total]=alive(en);
   if(shield>0)setObjective('Hold silos · '+held(v)+'/'+(c.objectives?.length||5)+' · '+name(en)+' shield '+Math.ceil(shield*100)+'%','silos');
   else if(n>0)setObjective('Destroy protectors · '+n+'/'+total+' left','protectors');
   else setObjective('Strike the '+name(en)+' core · '+Math.ceil(st.cores[en]/(R.coreHp||1)*100)+'%','core');}
  else setObjective('','');}
 return {name:'announcer',handles:['announce'],clear,announce,
  attach(c){if(banner)return;ctx=c;banner=document.createElement('div');banner.id='announce-banner';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.innerHTML='<div class="announce-title"></div><div class="announce-sub"></div>';titleEl=banner.querySelector('.announce-title');subEl=banner.querySelector('.announce-sub');
   try{if(c.T)V=new c.T.Vector3();}catch{V=null;}
   objective=document.createElement('div');objective.id='battle-objective';objective.hidden=true;document.body.append(objective,banner);},
  event(e,c){const v=viewer(),en=1-v;
   if(e.type==='start'||e.type==='stop'){clear();return;}
   if(e.type==='capture'){const label=short(e.objective);
    if(e.team===v)announce({kind:'capOwn',make:MAKE.capOwn,label,team:v,tone:'good',priority:2});
    else if(e.from===v)announce({kind:'capLost',make:MAKE.capLost,label,team:e.team,tone:'bad',priority:2});
    else announce({kind:'capOther'+e.team,make:MAKE.capOther,label,team:e.team,tone:'bad',priority:1});}
   if(e.type==='tower-armed'){const label=short(e.objective);announce(e.team===v?{kind:'armedOwn',make:MAKE.armedOwn,label,team:v,tone:'good',priority:2,topic:'armed',target:1-v}:{kind:'armedFoe'+e.team,make:MAKE.armedFoe,label,team:e.team,tone:'bad',priority:2,topic:'armed',target:1-e.team});}
   if(e.type==='shield-collapse')shieldAnnounce(e.team);
   if(e.type==='protector-down')announce(e.team!==v?{kind:'protFoe'+e.team,make:MAKE.protFoe,team:e.team,tone:'good',priority:2}:{kind:'protOwn',make:MAKE.protOwn,team:e.team,tone:'bad',priority:2});
   if(e.type==='gate-down')announce(e.team!==v?{kind:'gateFoe'+e.team,make:MAKE.gateFoe,team:e.team,tone:'good',priority:1}:{kind:'gateOwn',make:MAKE.gateOwn,team:e.team,tone:'bad',priority:1});
   if(e.type==='battery-off')coreAnnounce(e.team);
   if(e.type==='evacuate')for(const t of e.doomedTeams||[])coreAnnounce(t);
   if(e.type==='finish'){queue.length=0;const w=e.winner;show(w===v?{title:'Victory',sub:NAME(v)+' HOLDS THE AERIE',team:v,tone:'good',priority:5,duration:1.6}:w===-1?{title:'Stalemate',sub:'NEITHER SIDE PREVAILED',team:-1,priority:5,duration:1.6}:{title:'Defeat',sub:NAME(w)+' TAKES THE AERIE',team:w,tone:'bad',priority:5,duration:1.6});}},
  render(dt,c){if(!banner)return;if(current&&c.phase==='finished'&&c.dom?.result&&!c.dom.result.hidden){queue.length=0;hide();}if(current){current.left-=dt;current.age+=dt;if(current.left<=0){const next=queue.shift();if(next)show(next);else hide();}}
   poll-=dt;if(poll<=0||!objShown&&c.playing&&c.phase!=='evacuation'){poll=POLL;update(c);if(current)guard();}},
  reset(){clear();},stopped(){clear();},
  snapshot:()=>({banner:current?{title:current.title,sub:current.sub,team:current.team,count:current.n}:null,queued:queue.map(q=>q.title),objective:objText,state:objState})};
}
