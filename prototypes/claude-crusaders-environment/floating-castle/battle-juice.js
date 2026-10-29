// Battle game feel (2D + camera + audio triggers): hit/kill reticle marks, pooled floating damage numbers, directional hurt arcs,
// low-HP pulse and heartbeat (frame layer under the HUD), downed overlay with respawn countdown and spawn-map button (a map opened
// while downed closes on respawn), trauma camera shake, and reload/dry/ui sounds (pod launch/land whooshes are main.js's, which
// knows the flight kind).
// 3D effects (muzzle flashes, impacts, shards) belong to battle-fx.js. Every DOM write happens only when its value changes.
const MARK=new Set(['hit','core-hit','protector-hit','gate-hit','vehicle-hit']),KILL=new Set(['down','protector-down','gate-down']),NUMBERS=16,ARCS=3;
export function createBattleJuice(){
 let ctx=null,P=null,S=null,trauma=0,noiseTime=0,clock=0,shake=true,motion=null,hitUntil=-1,killUntil=-1,mark='',reticleOn=null,lowhp=false,down=false,beat=0,respawnText='',killer='',flight=null,magKey='',magUntil=0,magDone=true,root=null,numbersEl=null,hurtEl=null,respawnEl=null,respawnMain=null,respawnSub=null,respawnButton=null,coarse=null,spawnText='',lowEl=null,mapWhileDown=false;
 const nums=[],arcs=[],out={x:0,y:0,z:0},body=()=>document.body;
 const reduced=()=>motion?.matches===true;
 function toggleBody(name,on){body().classList.toggle(name,on);}
 function play(kind,opts){ctx?.audio?.play?.(kind,opts);}
 function addTrauma(v){trauma=Math.min(1,trauma+v);}
 function project(x,y,z){P.set(x,y,z).project(ctx.camera);return P.z<1&&P.z>-1&&Math.abs(P.x)<1.15&&Math.abs(P.y)<1.15;}
 function screenX(){return (P.x*.5+.5)*innerWidth;}function screenY(){return (-P.y*.5+.5)*innerHeight;}
 function sourcePoint(id){if(id==null)return null;const a=ctx.actors.find(a=>a.id===id);if(a)return a.state;const m=ctx.fleet?.mounts?.find?.(m=>m.id===id);return m?.state||null;}
 function number(value,kind,key,x,y,z){if(!(value>=.5))return;let n=nums.find(n=>n.active&&n.key===key&&n.age<.3);
  if(n){n.value+=value;n.age=0;}else{n=nums.find(n=>!n.active)||nums.reduce((a,b)=>b.age>a.age?b:a);n.active=true;n.age=0;n.value=value;n.key=key;if(n.kind!==kind){n.kind=kind;n.el.className='juice-num '+kind;}n.x=x;n.y=y;n.z=z;}
  const text=(kind==='taken'?'-':'')+Math.round(n.value);if(text!==n.text){n.text=text;n.el.textContent=text;}if(n.el.hidden)n.el.hidden=false;}
 function hurt(source){const p=sourcePoint(source);if(!p)return;let a=arcs.find(a=>a.active&&a.source===source)||arcs.find(a=>!a.active)||arcs.reduce((a,b)=>b.age>a.age?b:a);a.active=true;a.age=0;a.source=source;a.x=p.x;a.y=p.y;a.z=p.z;if(a.el.hidden)a.el.hidden=false;}
 function checkDry(e){if(!ctx?.playing||ctx.paused||e.button>0)return;const t=e.target;if(!(t?.id==='world'||t?.closest?.('#battle-fire')))return;const a=ctx.human;if(!a?.alive||(!a.mountWeapon&&a.classId==='fighter'))return;const w=a.mountWeapon||ctx.WEAPONS[a.weapon]||ctx.WEAPONS[0],m=a.magazines?.[w.id||'battery'];if(m&&(m.until>ctx.combat.state.time||m.ammo<=0))play('dry');}
 function uiClick(e){if(body().classList.contains('in-battle')&&e.target?.closest?.('button'))play('ui',{volume:.6});}
 function clearAll(){trauma=0;hitUntil=killUntil=-1;beat=0;flight=null;magKey='';magUntil=0;magDone=true;killer='';
  for(const n of nums){n.active=false;n.key='';if(!n.el.hidden)n.el.hidden=true;}for(const a of arcs){a.active=false;a.source=null;if(!a.el.hidden)a.el.hidden=true;}
  if(ctx){const r=ctx.dom?.reticle;if(r&&mark){r.classList.remove('hit','kill');}}mark='';
  spawnText='';mapWhileDown=false;if(lowhp){lowhp=false;toggleBody('juice-lowhp',false);}if(down){down=false;toggleBody('player-down',false);}if(reticleOn){toggleBody('reticle-on',false);}reticleOn=null;if(respawnEl&&!respawnEl.hidden)respawnEl.hidden=true;respawnText='';}
 function attach(c){if(root)return;ctx=c;P=new c.T.Vector3();S=new c.T.Vector3();motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  root=document.createElement('div');root.id='juice-root';root.setAttribute('aria-hidden','true');
  numbersEl=document.createElement('div');numbersEl.id='juice-numbers';for(let i=0;i<NUMBERS;i++){const el=document.createElement('span');el.className='juice-num dealt';el.hidden=true;numbersEl.append(el);nums.push({el,active:false,age:0,value:0,key:'',kind:'dealt',text:'',x:0,y:0,z:0,style:''});}
  hurtEl=document.createElement('div');hurtEl.id='juice-hurt';for(let i=0;i<ARCS;i++){const el=document.createElement('i');el.hidden=true;hurtEl.append(el);arcs.push({el,active:false,age:0,source:null,x:0,y:0,z:0,style:''});}
  respawnEl=document.createElement('div');respawnEl.id='juice-respawn';respawnEl.setAttribute('role','status');respawnEl.hidden=true;respawnEl.innerHTML='<small></small><b></b><button type="button" class="juice-spawn" hidden></button>';respawnSub=respawnEl.querySelector('small');respawnMain=respawnEl.querySelector('b');respawnButton=respawnEl.querySelector('button');coarse=typeof matchMedia==='function'?matchMedia('(pointer:coarse)'):null;
  // The spawn hint is a real button (tap on touch, click or M on desktop) that opens the deployment map.
  respawnButton.onclick=e=>{e.preventDefault();try{ctx?.spawnMap?.toggle();}catch{}if(e.detail>0)document.getElementById('world')?.focus?.({preventScroll:true});};
  // The low-HP frame is its own layer under the HUD roots (z 9 < 10), so pips, labels and the player card stay readable.
  lowEl=document.createElement('div');lowEl.id='juice-lowhp';lowEl.setAttribute('aria-hidden','true');
  root.append(numbersEl,hurtEl);document.body.append(lowEl,root,respawnEl);
  addEventListener('pointerdown',checkDry,true);addEventListener('click',uiClick,true);c.audio?.listener?.(c.camera);}
 function event(e,c){const h=c.human,me=h?.id??0;
  if(e.type==='start'||e.type==='stop'){clearAll();return;}
  if(e.type==='hit'&&e.actor===me){addTrauma(.25*Math.min(1,Math.max(.35,3*(e.damage||0)/Math.max(1,h.maxHp||100))));number(e.damage,'taken','you',h.state.x,h.state.y+2.2,h.state.z);hurt(e.source);}
  if(e.type==='down'&&e.actor===me){addTrauma(.6);const k=e.source==null?null:c.actors.find(a=>a.id===e.source);killer=k?.name||((e.cause==='gun'||e.cause==='ship')&&e.killerTeam>=0?['DAWN','DUSK'][e.killerTeam]+' '+String(e.by||(e.cause==='ship'?'ship gun':'castle gun')).toUpperCase():e.electric&&e.killerTeam>=0?['DAWN','DUSK'][e.killerTeam]+' SHIELD':e.electric?'SHIELD SHOCK':e.fall?'A FALL':e.blast?'CORE BLAST':e.meltdown?'MELTDOWN':'DEFENSE');}
  if(e.type==='blast'&&h){const d=Math.hypot(e.x-h.state.x,e.y-h.state.y,e.z-h.state.z);if(d<60)addTrauma(.5*(1-d/60));}
  if(e.type==='shot'&&e.actor===me&&(e.weapon===3||e.weapon===4))addTrauma(.08);
  if(e.type==='tower-impact'&&e.team===h?.team)addTrauma(.35);
  if(e.type==='explosion'||e.type==='meltdown-impact')addTrauma(1);
  if(e.source===me&&(MARK.has(e.type)||KILL.has(e.type))){if(KILL.has(e.type))killUntil=clock+.3;else hitUntil=clock+.12;
   if(MARK.has(e.type)){const amount=e.type==='core-hit'?(e.shieldDamage||0)+(e.coreDamage||0):e.damage,key=e.type==='hit'?'a'+e.actor:e.type==='core-hit'?'c'+e.team:e.type==='gate-hit'?'g'+e.id:e.type==='protector-hit'?'p'+e.id:'v'+e.vehicle;number(amount,'dealt',key,e.x,e.y+.6,e.z);}}}
 function render(dt,c){const h=c.human;if(!h||!root)return;clock+=dt;noiseTime+=dt;trauma=Math.max(0,trauma-1.6*dt);const time=c.combat.state.time,live=c.playing;
  const r=c.dom.reticle,want=clock<killUntil?'kill':clock<hitUntil?'hit':'';if(want!==mark){r.classList.toggle('hit',want==='hit');r.classList.toggle('kill',want==='kill');mark=want;}
  const on=live&&!r.hidden;if(on!==reticleOn){reticleOn=on;toggleBody('reticle-on',on);}
  for(const n of nums){if(!n.active)continue;n.age+=dt;if(n.age>=.7){n.active=false;n.el.hidden=true;continue;}
   const f=n.age/.7,style=project(n.x,n.y,n.z)?'translate3d('+screenX().toFixed(1)+'px,'+(screenY()-38*(1-(1-f)*(1-f))).toFixed(1)+'px,0) translate(-50%,-50%) scale('+(n.age<.12?1.35-n.age*2.9:1).toFixed(2)+')':'translate3d(-999px,-999px,0)';
   if(style!==n.style){n.style=style;n.el.style.transform=style;}n.el.style.opacity=(f<.6?1:1-(f-.6)/.4).toFixed(2);}
  let center=false;for(const a of arcs){if(!a.active)continue;a.age+=dt;if(a.age>=.8){a.active=false;a.el.hidden=true;continue;}
   const p=sourcePoint(a.source);if(p){a.x=p.x;a.y=p.y;a.z=p.z;}if(!center){project(h.state.x,h.state.y+1.2,h.state.z);S.set(screenX(),screenY(),0);center=true;}project(a.x,a.y+1,a.z);
   const angle=Math.atan2(screenY()-S.y,screenX()-S.x),style='translate('+S.x.toFixed(0)+'px,'+S.y.toFixed(0)+'px) rotate('+angle.toFixed(2)+'rad)';if(style!==a.style){a.style=style;a.el.style.transform=style;}a.el.style.opacity=(1-a.age/.8).toFixed(2);}
  const alive=h.alive&&h.hp>0,low=live&&alive&&h.hp/Math.max(1,h.maxHp||100)<.3;if(low!==lowhp){lowhp=low;toggleBody('juice-lowhp',low);beat=0;}
  if(low&&dt>0){beat-=dt;if(beat<=0){beat=.9;play('heartbeat',{volume:.8});}}
  const isDown=live&&!h.alive;if(isDown!==down){down=isDown;toggleBody('player-down',isDown);respawnEl.hidden=!isDown;respawnText='';
   // A map opened while downed (card button or M) was for choosing this respawn: close it once the player is back in play.
   if(!isDown&&mapWhileDown){mapWhileDown=false;try{if(c.spawnMap?.open)c.spawnMap.close();}catch{}}}
  if(isDown&&!mapWhileDown){try{if(c.spawnMap?.open)mapWhileDown=true;}catch{}}
  if(isDown){const text=c.phase==='evacuation'||!Number.isFinite(h.respawnAt)?'NO RESPAWN':'RESPAWN '+Math.max(1,Math.ceil(h.respawnAt-time));if(text!==respawnText){const none=text==='NO RESPAWN';respawnText=text;respawnMain.textContent=text;respawnSub.textContent='DOWNED BY '+(killer||'DEFENSE');if(respawnButton.hidden!==none)respawnButton.hidden=none;}
   const hint=coarse?.matches?'<b>TAP</b> Choose spawn point':'<b>M</b> Choose spawn point';if(hint!==spawnText){spawnText=hint;respawnButton.innerHTML=hint;respawnButton.setAttribute('aria-label','Choose spawn point (opens the map)');}}
  if(dt>0){
   const w=h.mountWeapon||c.WEAPONS[h.weapon]||c.WEAPONS[0],key=(h.mountWeapon?'m:':'')+(w?.id||'battery'),u=h.magazines?.[w?.id||'battery']?.until||0;
   if(key!==magKey){magKey=key;magUntil=u;magDone=true;}else{if(u>0&&u!==magUntil){if(alive)play('reload');magUntil=u;magDone=false;}if(!magDone&&magUntil>0&&time>=magUntil){magDone=true;if(alive)play('reloaded');}if(u===0)magUntil=0;}}}
 return {name:'juice',attach,event,render,reset:clearAll,stopped:clearAll,
  // Camera-plane offset {x,y} in world units (right/up); null when shake is off, reduced motion is requested, paused, or calm.
  offset(dt){if(!shake||reduced()||!ctx||ctx.paused||trauma<=.001)return null;const k=trauma*trauma*.6,t=noiseTime;out.x=k*(Math.sin(t*37.1)*.55+Math.sin(t*23.3+1.7)*.3+Math.sin(t*61.7+.4)*.15);out.y=k*(Math.sin(t*41.3+2.1)*.55+Math.sin(t*19.9+.9)*.3+Math.sin(t*67.1+3.3)*.15);out.z=0;return out;},
  setShake(on){shake=!!on;if(!shake)trauma=0;return shake;},get shake(){return shake;},
  snapshot:()=>({trauma,shake,reducedMotion:reduced(),numbers:nums.filter(n=>n.active).map(n=>({kind:n.kind,text:n.text})),arcs:arcs.filter(a=>a.active).length,lowhp,down,respawn:respawnText,reticle:mark})};
}
