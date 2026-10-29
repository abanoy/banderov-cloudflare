// Parchment sky-chart radar and deployment map ("Illuminated Aerie"): ink on parchment, a shade wash for the open
// sky, and the real ring annulus, silo islands, causeways and castle footprints taken from world data.
const INK='#231a2e',PARCH='#fff3cd',SHADE='#5966a1',STONE='#dac9a3',GOLD='#f4c67b',YOU='#ffe29c',BAD='#ff8a7a',TEAM=['#80eee2','#f49bc7'],TEAM_DEEP=['#267e8a','#73547f'];
const FONT="'Silkscreen','Pixelify Sans',monospace";
export function createSpawnMap({combat,actors,objectives,world,spawns,onOpen=()=>{}}){
 const radar=document.createElement('button');radar.id='battle-radar';radar.type='button';radar.title='Tactical map · M';radar.setAttribute('aria-label','Tactical map (M): choose your respawn point');radar.innerHTML='<canvas width="160" height="113"></canvas><b class="radar-key" aria-hidden="true">M</b><b class="radar-caption" aria-hidden="true">Map</b>';radar.hidden=true;
 const panel=document.createElement('section');panel.id='spawn-map';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','spawn-map-title');panel.innerHTML='<div class="spawn-map-dialog"><div class="spawn-map-head"><small>SKY CHART · DEPLOYMENT</small><h2 id="spawn-map-title">Area Map</h2><button id="spawn-map-close" type="button"><b>M</b> Close</button></div><div class="spawn-map-body"><canvas width="720" height="440" aria-label="Select a friendly spawn marker"></canvas><div class="spawn-map-side"><p id="spawn-map-status"></p><div id="spawn-map-options"></div><p class="spawn-map-legend"><i class="dawn"></i>Dawn <i class="dusk"></i>Dusk <i class="you"></i>You <i class="spawn"></i>Respawn</p></div></div></div>';document.body.append(radar,panel);
 const radarCanvas=radar.querySelector('canvas'),mapCanvas=panel.querySelector('canvas'),statusEl=panel.querySelector('#spawn-map-status'),optionsEl=panel.querySelector('#spawn-map-options');
 let projected=[],lastOptions='',clock=-1,radarSize=null,lastTime=0,lastPhase='idle',castleBoxes=null;const statics=new Map();
 function toggle(){panel.hidden=!panel.hidden;if(!panel.hidden)onOpen();update(true);}
 // Keep the radar canvas at its displayed size so the pixel chart stays crisp (no layout reads in the frame loop).
 if(typeof ResizeObserver==='function')new ResizeObserver(e=>{const r=e[e.length-1].contentRect,w=Math.round(r.width),h=Math.round(r.height);if(w>=40&&h>=28)radarSize=[w,h];}).observe(radarCanvas);
 radar.onclick=toggle;panel.querySelector('#spawn-map-close').onclick=toggle;
 // Castle footprints change with each match's applied designs: measure them once per match, never per frame.
 function measureCastles(){castleBoxes=(world.castles||[]).map((castle,team)=>{if(!castle?.visible)return null;let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;try{castle.updateWorldMatrix?.(true,true);castle.traverse(o=>{if(!o.isMesh||!o.geometry||o.userData?.spawnPoint)return;const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox,e=o.matrixWorld.elements;for(let i=0;i<8;i++){const x=i&1?b.max.x:b.min.x,y=i&2?b.max.y:b.min.y,z=i&4?b.max.z:b.min.z,wx=e[0]*x+e[4]*y+e[8]*z+e[12],wz=e[2]*x+e[6]*y+e[10]*z+e[14];if(wx<minX)minX=wx;if(wx>maxX)maxX=wx;if(wz<minZ)minZ=wz;if(wz>maxZ)maxZ=wz;}});}catch{}const o=world.origins?.[team]||[0,0,0];if(!(maxX-minX<400&&maxZ-minZ<400))return {x0:o[0]-75,x1:o[0]+75,z0:o[2]-85,z1:o[2]+85};return {x0:minX,x1:maxX,z0:minZ,z1:maxZ};});statics.clear();}
 function view(w,h){const s=Math.min(w/700,h/600);return {s,x:p=>w/2+p.x*s,z:p=>h/2+p.z*s};}
 function paintStatic(w,h,large,k=1){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),v=view(w,h),s=v.s,cx=w/2,cy=h/2,ring=world.ring||{inner:47,outer:108},outposts=world.outposts||[],ink=Math.max(1,Math.round(s*2.2));
  g.fillStyle=PARCH;g.fillRect(0,0,w,h);g.globalAlpha=.62;g.fillStyle=SHADE;g.fillRect(0,0,w,h);g.globalAlpha=.3;g.fillStyle=INK;for(let y=2;y<h;y+=4)for(let x=(y/4%2)*2;x<w;x+=4)g.fillRect(x,y,1,1);g.globalAlpha=.18;g.fillStyle=PARCH;const step=large?18:9;for(let y=step/2,k=0;y<h;y+=step,k++)for(let x=(k%2)*step;x<w;x+=step*2)g.fillRect(x,y,large?6:3,1);g.globalAlpha=1;
  // Land masses: parchment with an ink edge.
  const land=()=>{g.fillStyle=PARCH;g.fill();g.lineWidth=ink;g.strokeStyle=INK;g.stroke();};
  for(const o of outposts){const d=Math.hypot(o.x,o.z)||1,ux=o.x/d,uz=o.z/d,a=101,b=d-30,hw=6;g.beginPath();g.moveTo(cx+(ux*a-uz*hw)*s,cy+(uz*a+ux*hw)*s);g.lineTo(cx+(ux*b-uz*hw)*s,cy+(uz*b+ux*hw)*s);g.lineTo(cx+(ux*b+uz*hw)*s,cy+(uz*b-ux*hw)*s);g.lineTo(cx+(ux*a+uz*hw)*s,cy+(uz*a-ux*hw)*s);g.closePath();land();}
  g.beginPath();g.arc(cx,cy,ring.outer*s,0,Math.PI*2);g.arc(cx,cy,ring.inner*s,0,Math.PI*2,true);land();
  for(const o of outposts){g.beginPath();g.arc(v.x(o),v.z(o),(o.radius||36)*s,0,Math.PI*2);land();}
  g.beginPath();g.arc(cx,cy,16*s,0,Math.PI*2);land();
  for(const o of outposts){const d=Math.hypot(o.x,o.z)||1,ux=o.x/d,uz=o.z/d;g.fillStyle=PARCH;g.fillRect(cx+ux*(d-33)*s-5*s,cy+uz*(d-33)*s-5*s,10*s,10*s);}
  // Causeway planks, terrace rings and silo pads as fine ink detail.
  g.strokeStyle=INK;g.globalAlpha=.35;g.lineWidth=1;g.setLineDash([2,3]);for(const r of [59,88]){g.beginPath();g.arc(cx,cy,r*s,0,Math.PI*2);g.stroke();}for(const o of outposts){g.beginPath();g.arc(v.x(o),v.z(o),14*s,0,Math.PI*2);g.stroke();}g.setLineDash([]);
  for(const o of outposts){const d=Math.hypot(o.x,o.z)||1,ux=o.x/d,uz=o.z/d;for(let t=109;t<d-32;t+=Math.max(8,10/s)){g.beginPath();g.moveTo(cx+(ux*t-uz*5)*s,cy+(uz*t+ux*5)*s);g.lineTo(cx+(ux*t+uz*5)*s,cy+(uz*t-ux*5)*s);g.stroke();}}g.globalAlpha=1;
  // Castle footprints: team wash, crenellated ink edge and the keep (core) position.
  (castleBoxes||[]).forEach((b,team)=>{if(!b)return;const x=v.x({x:b.x0}),y=v.z({z:b.z0}),bw=(b.x1-b.x0)*s,bh=(b.z1-b.z0)*s;g.fillStyle=PARCH;g.fillRect(x,y,bw,bh);g.globalAlpha=.55;g.fillStyle=TEAM[team];g.fillRect(x,y,bw,bh);g.globalAlpha=1;g.lineWidth=ink;g.strokeStyle=INK;g.strokeRect(x+.5,y+.5,bw,bh);const step=Math.max(4,Math.round(8*s*3)),m=Math.max(2,ink+1);g.fillStyle=INK;for(let t=step/2;t<bw-2;t+=step){g.fillRect(x+t,y-m+1,m,m);g.fillRect(x+t,y+bh,m,m);}for(let t=step/2;t<bh-2;t+=step){g.fillRect(x-m+1,y+t,m,m);g.fillRect(x+bw,y+t,m,m);}
   const heart=world.castleHearts?.[team]?.core;let hx=(b.x0+b.x1)/2,hz=(b.z0+b.z1)/2;if(heart?.matrixWorld){const e=heart.matrixWorld.elements;hx=e[12];hz=e[14];}const kx=v.x({x:hx}),ky=v.z({z:hz}),hk=Math.max(3,Math.round(5*s*2.2));g.fillStyle=TEAM_DEEP[team];g.fillRect(kx-hk,ky-hk,hk*2,hk*2);g.strokeStyle=INK;g.lineWidth=1;g.strokeRect(kx-hk+.5,ky-hk+.5,hk*2-1,hk*2-1);
   if(large){const fs=Math.round(16*k),ly=Math.min(h-8,Math.max(fs+8,y-6));g.font=fs+'px '+FONT;g.textAlign='center';g.textBaseline='bottom';const label=team?'DUSK':'DAWN';g.lineWidth=Math.max(3,Math.round(fs/4));g.lineJoin='round';g.strokeStyle=PARCH;g.strokeText(label,x+bw/2,ly);g.fillStyle=INK;g.fillText(label,x+bw/2,ly);}});
  // Compass rose, north up (world -Z).
  const r=large?Math.round(22*k):Math.max(7,Math.round(h*.085)),rx=w-r-(large?14:5),ry=r+(large?14:5);g.fillStyle=INK;g.strokeStyle=INK;g.lineWidth=1;for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const len=dy<0?r:r*.72,px=-dy,py=dx;g.beginPath();g.moveTo(rx+dx*len,ry+dy*len);g.lineTo(rx+px*r*.22,ry+py*r*.22);g.lineTo(rx-px*r*.22,ry-py*r*.22);g.closePath();dy<0?g.fill():(g.fillStyle=PARCH,g.fill(),g.stroke(),g.fillStyle=INK);}g.beginPath();g.arc(rx,ry,r*.18,0,Math.PI*2);g.fillStyle=GOLD;g.fill();g.stroke();
  if(large||h>=90){g.font=(large?Math.round(16*k):8)+'px '+FONT;g.textAlign='center';g.textBaseline='top';g.fillStyle=INK;g.fillText('N',rx,ry+r+2);}
  g.strokeStyle=INK;g.lineWidth=2;g.strokeRect(1,1,w-2,h-2);g.strokeStyle=GOLD;g.lineWidth=1;g.strokeRect(3.5,3.5,w-7,h-7);
  return c;
 }
 function draw(canvas,large){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,k=large?Math.min(2.5,Math.max(1,w/(canvas.clientWidth||w)*.75)):1,key=w+'x'+h+(large?'L'+k.toFixed(2):'');if(!castleBoxes)measureCastles();let base=statics.get(key);if(!base){if(statics.size>6)statics.clear();base=paintStatic(w,h,large,k);statics.set(key,base);}ctx.drawImage(base,0,0);
  const v=view(w,h),s=v.s,st=combat.state,dot=large?Math.round(6*k):Math.max(2.5,w/56);
  if(st.phase==='evacuation')for(const z of st.blastZones||[]){if(!st.doomedTeams?.includes(z.team))continue;const x=v.x(z),y=v.z(z),rad=z.radius*s;ctx.save();ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.clip();ctx.strokeStyle=BAD;ctx.lineWidth=large?3:1.5;for(let t=-rad*2;t<rad*2;t+=large?10:5){ctx.beginPath();ctx.moveTo(x+t-rad,y-rad);ctx.lineTo(x+t+rad,y+rad);ctx.stroke();}ctx.restore();ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.strokeStyle=INK;ctx.lineWidth=large?2:1;ctx.stroke();}
  const fs=large?Math.round(16*k):0;
  for(const o of objectives){const x=v.x(o),y=v.z(o),crown=o.id===4,r=(crown?1.5:1.15)*dot;
   if(o.progress){ctx.beginPath();ctx.arc(x,y,r+(large?5:2.5),-Math.PI/2,-Math.PI/2+Math.abs(o.progress)*Math.PI*2);ctx.strokeStyle=o.progress<0?TEAM[1]:TEAM[0];ctx.lineWidth=large?4:2;ctx.stroke();}
   ctx.beginPath();if(crown){ctx.moveTo(x,y-r*1.25);ctx.lineTo(x+r*1.25,y);ctx.lineTo(x,y+r*1.25);ctx.lineTo(x-r*1.25,y);ctx.closePath();}else ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=o.owner<0?STONE:TEAM[o.owner];ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=large?2:1;ctx.stroke();
   if(o.mode==='armed'){ctx.beginPath();ctx.arc(x,y,r*.45,0,Math.PI*2);ctx.fillStyle=GOLD;ctx.fill();}
   if(large){const label=crown?'CROWN':String(o.label||'').split(' · ')[0];ctx.font=fs+'px '+FONT;ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=Math.max(3,fs/4);ctx.strokeStyle=PARCH;ctx.strokeText(label,x+r+7,y);ctx.fillStyle=INK;ctx.fillText(label,x+r+7,y);}}
  let human=null;for(const a of actors){if(!a.alive||a.enabled===false)continue;if(a.human){human=a;continue;}const x=v.x(a.state),y=v.z(a.state),r=dot*.85;ctx.beginPath();if(a.team){ctx.moveTo(x-r,y-r*.8);ctx.lineTo(x+r,y-r*.8);ctx.lineTo(x,y+r);}else{ctx.moveTo(x,y-r);ctx.lineTo(x+r,y+r*.8);ctx.lineTo(x-r,y+r*.8);}ctx.closePath();ctx.fillStyle=TEAM[a.team];ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.stroke();}
  projected=[];if(large)for(const p of spawns.points()){const x=v.x(p),y=v.z(p),sel=p.id===spawns.selected;projected.push({...p,sx:x,sy:y});ctx.beginPath();ctx.arc(x,y,(sel?11:8)*k,0,Math.PI*2);ctx.lineWidth=(sel?4:2)*k;ctx.strokeStyle=INK;ctx.stroke();ctx.lineWidth=(sel?2:1)*k;ctx.strokeStyle=sel?GOLD:TEAM[0];ctx.stroke();if(sel){ctx.beginPath();ctx.arc(x,y,3*k,0,Math.PI*2);ctx.fillStyle=GOLD;ctx.fill();}}
  if(human){const x=v.x(human.state),y=v.z(human.state),r=dot*1.25;ctx.beginPath();ctx.arc(x,y,r+2,0,Math.PI*2);ctx.fillStyle=INK;ctx.fill();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=YOU;ctx.fill();ctx.beginPath();ctx.arc(x,y,r*.45,0,Math.PI*2);ctx.fillStyle=TEAM[human.team];ctx.fill();}
 }
 panel.querySelector('canvas').onclick=e=>{const rect=e.currentTarget.getBoundingClientRect(),x=(e.clientX-rect.left)*720/rect.width,y=(e.clientY-rect.top)*440/rect.height;let p=null,best=Infinity;for(const q of projected){const d=Math.hypot(q.sx-x,q.sy-y);if(d<best){best=d;p=q;}}if(p&&best<Math.max(20,28*720/rect.width)){spawns.select(p.id);update(true);}};
 function setText(el,v){if(el.textContent!==v)el.textContent=v;}
 function update(force=false){
  const st=combat.state,idle=st.phase==='idle';if(radar.hidden!==idle)radar.hidden=idle;
  if(st.phase!==lastPhase&&lastPhase==='idle'||st.time<lastTime-.5)castleBoxes=null;lastPhase=st.phase;lastTime=st.time;
  if(idle&&panel.hidden)return;if(!force&&st.time>=clock&&st.time-clock<.15)return;clock=st.time;
  if(!radar.hidden){if(radarSize&&(radarCanvas.width!==radarSize[0]||radarCanvas.height!==radarSize[1])){radarCanvas.width=radarSize[0];radarCanvas.height=radarSize[1];}draw(radarCanvas,false);}if(panel.hidden)return;draw(mapCanvas,true);
  const points=projected,key=points.map(p=>p.id).join('|')+'#'+spawns.selected+'#'+st.phase;if(key!==lastOptions){lastOptions=key;optionsEl.replaceChildren(...points.map(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.label;b.dataset.spawn=p.id;b.setAttribute('aria-pressed',String(p.id===spawns.selected));b.disabled=st.phase!=='running';b.onclick=()=>{spawns.select(p.id);update(true);};return b;}));}
  const selected=points.find(p=>p.id===spawns.selected)||points[0],down=actors[0]&&!actors[0].alive;setText(statusEl,st.phase==='evacuation'?'EVACUATION · No respawns. Escape on foot, pod or chariot.':(down?'RESPAWN AT: '+(selected?.label||'No safe point')+' · Applies to this respawn.':'NEXT RESPAWN: '+(selected?.label||'No safe point')+' · Applies the next time you are downed.')+' Hostile or contested points are unavailable.');
 }
 return {toggle,update,close(){if(!panel.hidden)panel.hidden=true;},get open(){return !panel.hidden;},radar,panel};
}
