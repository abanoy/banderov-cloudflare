// Crusader chibi actors: the owner's chibi kit as the in-world character art for the player and every bot.
// Each build is rasterized once (render(build,view,{fx:false}), the sticker filter included) into eight small canvases,
// one per facing (the kit's own qbL/qL far 3/4s, so weapon hands stay put). Work runs one
// view at a time with a yield between views, during match loading (castle design and raising run meanwhile).
// Presentation only: hitboxes, aim, combat numbers and the classic owner billboards are untouched. Classic mode, a kit
// or rasterization failure, or a loading budget overrun all leave (or put back) the classic billboards.
import * as T from '../vendor/three.module.js';
import {yieldTask} from './task-yield.js';
import {Kit,VIEWS,CLASS_IDS,buildKey,randomBuild,playerBuild,facingAngle,viewForYaw,hashSeed,onBuildsChanged,buildsRevision} from './chibi-kit.js?v=dbc-20261018';

// Art crop: the kit draws in a 400x520 box with the shoe soles at y~495; hats reach y~17 and the sticker border adds 9.
const CROP_Y=6,CROP_H=500,SOLE=495,UNIT=.005;// world metres per kit unit: hatless head-to-sole ~1.75 m, like the classic figure
export const CHIBI_SPRITE=Object.freeze({width:400*UNIT,height:CROP_H*UNIT,centerY:(CROP_Y+CROP_H-SOLE)/CROP_H});
// Texture sizes per quality tier, sized for pixelation 50: at battle zoom a crusader is ~11-16 render pixels tall, so the
// mip chain (160/80/40/20 or 120/60/30/15) always has a level near screen size; variants = bot looks per team x class.
export const CHIBI_TIERS=Object.freeze({balanced:Object.freeze({width:128,height:160,variants:3}),performance:Object.freeze({width:96,height:120,variants:2})});
const DIR_VIEW=[0,1,2,3,4,5,6,7],DIR_MIRROR=[0,0,0,0,0,0,0,0];// DIRECTIONS -> VIEWS index (no mirroring since the kit's qbL/qL views)
// Sharper mip choice for the chibi art (battle-identity.js gives every character sprite a spriteLod uniform): at play zoom a
// crusader is ~13 render pixels tall, where plain trilinear blends in the 8x10 mip and smears face, blush and outline.
const LOD_BIAS=-1,REVERSE_HOLD_MS=90;
const MAX_SETS=48,FAIL_LIMIT=4,SHADOW=/(<\/defs>)<ellipse [^>]*opacity="\.22"\/>/;
// Play-zoom silhouette edge: at battle zoom a crusader samples the 40/20 (Balanced) or 60/30/15 (Performance) texel-tall mip
// levels, where the kit's white sticker border melts into pale sand and stone. Those levels get an ink edge about one render
// pixel wide (2 texels on levels 30+ texels tall, 1 below) around the alpha silhouette. The full-size levels (close-ups such
// as the Crusader creator vantage) keep the kit's sticker art as drawn and the tiny overview levels stay clean. The chain is
// box-downsampled here (WebGL2 needs every level once one is given); enemy identity shading still darkens the whole figure.
const EDGE_INK=[38,30,52],EDGE_MIN=15,EDGE_MAX=60,ALPHA_CUT=102;// ink ~ the game's #231a2e; 102/255 = the sprites' alphaTest .4
function edged(c,r){const w=c.width,h=c.height,src=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,out=document.createElement('canvas');out.width=w;out.height=h;const g=out.getContext('2d',{willReadFrequently:true}),img=g.createImageData(w,h),d=img.data;d.set(src);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(src[i+3]>=ALPHA_CUT)continue;
  near:for(let dy=-r;dy<=r;dy++){const Y=y+dy;if(Y<0||Y>=h)continue;for(let dx=-r;dx<=r;dx++){const X=x+dx;if(X<0||X>=w||src[(Y*w+X)*4+3]<ALPHA_CUT)continue;d[i]=EDGE_INK[0];d[i+1]=EDGE_INK[1];d[i+2]=EDGE_INK[2];d[i+3]=255;break near;}}}
 g.putImageData(img,0,0);return out;}
function mipChain(c0){const levels=[c0],W0=c0.width,H0=c0.height;let prev=c0;
 for(let l=1;;l++){const w=Math.max(1,W0>>l),h=Math.max(1,H0>>l),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(prev,0,0,w,h);prev=c;
  levels.push(h>=EDGE_MIN&&h<=EDGE_MAX?edged(c,h>=30?2:1):c);if(w===1&&h===1)return levels;}}
const CLASS_ORDER=['ranger','fighter','mage','builder'];// most common bot class first

function createChibiActors(){
 let mode='chibi',renderer=null,tierName='balanced',qualityMod=null,failures=0,disabled=Kit?.render?null:'kit missing',working=false,match=null,playerKey='',playerSetCache=null,playerRev=-1,playerTier=null,previewBuild=null,previewSet=null,playerSprite=null;
 const cache=new Map(),queue=[],current=new WeakMap(),original=new WeakMap(),dirOf=new WeakMap(),reverseTo=new WeakMap(),reverseAt=new WeakMap(),stats={sets:0,rasters:0,rasterMs:0,uploadMs:0,edgeMs:0,failed:0,evicted:0,maxRasterMs:0};
 const tier=()=>CHIBI_TIERS[tierName]||CHIBI_TIERS.balanced;
 async function readQuality(){try{qualityMod??=await import('./quality.js?v=dbc-20261018');const t=qualityMod.quality?.effective;if(CHIBI_TIERS[t])tierName=t;}catch(_){}return tierName;}
 // ---------- rasterization ----------
 async function rasterView(svg,w,h){
  svg=svg.replace(SHADOW,'$1').replace('viewBox="0 0 400 520"','viewBox="0 '+CROP_Y+' 400 '+CROP_H+'" width="'+w+'" height="'+h+'"');
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),img=new Image();img.decoding='async';img.src=url;
  try{await img.decode();}finally{URL.revokeObjectURL(url);}
  // willReadFrequently keeps these small canvases in CPU memory: no GPU-process canvas work competing with the game's own
  // WebGL frames while a match loads, and texImage2D uploads straight from that memory.
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,w,h);return canvas;}
 function texture(canvas,mirror,chain){const t=new T.CanvasTexture(canvas);t.encoding=T.sRGBEncoding;t.magFilter=T.NearestFilter;t.name='chibi';if(mirror){t.repeat.x=-1;t.offset.x=1;}if(chain){t.mipmaps=chain;t.generateMipmaps=false;}return t;}
 // Edged mip chain (see EDGE_INK) on WebGL2 only (WebGL1 resizes non-power-of-two art and keeps the GPU's own chain); null
 // keeps the GPU chain, as does any failure.
 function edgeChain(canvas){if(!renderer?.capabilities?.isWebGL2)return null;const t0=performance.now();try{return mipChain(canvas);}catch(err){console.warn('Chibi silhouette edge skipped:',err);return null;}finally{stats.edgeMs+=performance.now()-t0;}}
 async function rasterize(set){
  const {width:w,height:h}=set.size,canvases=[],chains=[];
  for(let i=0;i<VIEWS.length;i++){if(set.cancelled)throw Object.assign(Error('cancelled'),{name:'AbortError'});const t0=performance.now();canvases.push(await rasterView(Kit.render(set.build,VIEWS[i],{fx:false}),w,h));const ms=performance.now()-t0;stats.rasters++;stats.rasterMs+=ms;if(ms>stats.maxRasterMs)stats.maxRasterMs=ms;chains.push(edgeChain(canvases[i]));await yieldTask();}
  set.dirs=DIR_VIEW.map((v,d)=>texture(canvases[v],DIR_MIRROR[d],chains[v]));set.maps=[set.dirs[0],set.dirs[4]];
  // Upload now (loading time) rather than on the first frame each facing shows up.
  if(renderer?.initTexture){const t0=performance.now();for(const t of set.dirs)renderer.initTexture(t);stats.uploadMs+=performance.now()-t0;}
  set.ready=true;stats.sets++;}
 function settle(set,ok){set.done=true;set.doneAt=performance.now();set.resolve(ok);}
 async function pump(){if(working)return;working=true;try{while(queue.length){let k=0;for(let i=1;i<queue.length;i++)if(queue[i].priority<queue[k].priority)k=i;const set=queue.splice(k,1)[0];if(set.cancelled){cache.delete(set.key);settle(set,false);continue;}
   try{await rasterize(set);settle(set,true);}catch(err){cache.delete(set.key);if(err?.name!=='AbortError'){set.failed=true;failures++;stats.failed++;console.warn('Chibi rasterization failed; that crusader keeps the classic billboard:',err);if(failures>=FAIL_LIMIT)disable('rasterization failures');}settle(set,false);}}}
  finally{working=false;}}
 // request(build,priority): the set for a build at the current tier, queued when new (lower priority runs first).
 function request(build,priority=2){if(disabled)return null;const size=tier(),key=size.width+'x'+size.height+'|'+buildKey(build);let set=cache.get(key);
  if(set){set.used=performance.now();if(!set.done){if(set.cancelled)set.cancelled=false;if(priority<set.priority)set.priority=priority;}return set;}
  let resolve;const done=new Promise(r=>resolve=r);set={key,build,size,priority,ready:false,done:false,failed:false,cancelled:false,dirs:null,maps:null,promise:done,resolve,used:performance.now(),face};
  cache.set(key,set);queue.push(set);evict();pump();return set;}
 function evict(){if(cache.size<=MAX_SETS)return;const keep=new Set(match?match.sets:[]);if(playerSetCache)keep.add(playerSetCache);if(previewSet)keep.add(previewSet);const old=[...cache.values()].filter(s=>s.done&&!keep.has(s)).sort((a,b)=>a.used-b.used);
  while(cache.size>MAX_SETS&&old.length){const s=old.shift();cache.delete(s.key);if(s.dirs)for(const t of s.dirs)t.dispose();stats.evicted++;}}
 function disable(reason){disabled=reason;for(const s of queue)s.cancelled=true;}
 // ---------- dressing ----------
 const hide=(o,k,v)=>Object.defineProperty(o,k,{value:v,writable:true,configurable:true,enumerable:false});// kept out of Object3D.clone's JSON copy
 const lod=(sprite,v)=>{const u=sprite.material.userData.spriteLod;if(u&&typeof u==='object')u.value=v;};
 function apply(sprite,set){
  const cur=current.get(sprite);
  if(set){if(cur===set){if(sprite.userData.maps!==set.maps){original.get(sprite).maps=sprite.userData.maps;sprite.userData.maps=set.maps;}return;}// someone swapped the classic maps meanwhile
   if(!cur)original.set(sprite,{maps:sprite.userData.maps,sx:sprite.scale.x,sy:sprite.scale.y,cx:sprite.center.x,cy:sprite.center.y});
   sprite.scale.set(CHIBI_SPRITE.width,CHIBI_SPRITE.height,1);sprite.center.set(.5,CHIBI_SPRITE.centerY);lod(sprite,LOD_BIAS);sprite.userData.maps=set.maps;hide(sprite.userData,'chibi',set);current.set(sprite,set);
   const i=dirOf.get(sprite)??(sprite.material.map===original.get(sprite).maps?.[1]?4:0);dirOf.set(sprite,i);sprite.material.map=set.dirs[i];return;}
  if(!cur)return;const o=original.get(sprite),i=dirOf.get(sprite)??0;current.delete(sprite);original.delete(sprite);delete sprite.userData.chibi;sprite.material.rotation=0;lod(sprite,0);
  sprite.scale.set(o.sx,o.sy,1);sprite.center.set(o.cx,o.cy);sprite.userData.maps=o.maps;if(o.maps)sprite.material.map=o.maps[i>=3&&i<=5?1:0];}
 // face(sprite,fx,fz,yaw): eight facings with hysteresis for dressed sprites, the classic front/back choice otherwise.
 function face(sprite,fx,fz,yaw){const set=current.get(sprite);if(!set){const maps=sprite.userData.maps;if(maps)sprite.material.map=maps[fx*Math.sin(yaw)+fz*Math.cos(yaw)>=0?0:1];return -1;}
  const prev=dirOf.get(sprite)??-1;let i=viewForYaw(facingAngle(fx,fz,yaw),prev);
  // Bots: a turn of 135 degrees or more must hold REVERSE_HOLD_MS (a one-frame velocity reversal, e.g. a bump, flashed the
  // back view for a frame); the player's own turns stay instant.
  if(i!==prev&&prev>=0&&sprite!==playerSprite&&Math.abs(((i-prev+8)%8)-4)<=1){const now=performance.now();if(reverseTo.get(sprite)!==i){reverseTo.set(sprite,i);reverseAt.set(sprite,now);i=prev;}else if(now-reverseAt.get(sprite)<REVERSE_HOLD_MS)i=prev;}
  else if(reverseTo.get(sprite)>=0)reverseTo.set(sprite,-1);
  if(i!==prev)dirOf.set(sprite,i);const map=set.dirs[i];if(sprite.material.map!==map)sprite.material.map=map;return i;}
 // ---------- the local player (explore and battle) ----------
 function playerSet(classId){const cls=CLASS_IDS.includes(classId)?classId:'ranger',rev=buildsRevision(),size=tier();if(cls!==playerKey||rev!==playerRev||size!==playerTier||!playerSetCache){playerKey=cls;playerRev=rev;playerTier=size;playerSetCache=request(playerBuild(cls),0);}return playerSetCache;}// no per-frame allocation
 // Live preview (the Crusader creator's unsaved draft): rasterized like any build; a newer draft cancels the unfinished older one.
 function draftSet(build){if(build!==previewBuild){previewBuild=build;const s=request(build,0),old=previewSet;previewSet=s;if(old&&old!==s&&!old.done&&old!==playerSetCache&&!match?.sets.includes(old))old.cancelled=true;}return previewSet;}
 // player(sprite,classId,fx,fz,yaw[,preview]): dress the player's sprite in its saved build for the class (or the preview build)
 // and face it (per frame). A pending look keeps the one on screen; a failed preview shows the saved build.
 function player(sprite,classId,fx,fz,yaw,preview=null){let set=null;playerSprite=sprite;if(mode==='chibi'&&!disabled&&!(match?.fallback&&match.active)){if(!preview&&previewBuild){previewBuild=null;previewSet=null;}
   const s=preview?draftSet(preview):playerSet(classId);if(s?.ready)set=s;else if(s&&!s.failed)set=current.get(sprite)||null;else if(preview){const p=playerSet(classId);set=p?.ready?p:null;}}
  apply(sprite,set);return face(sprite,fx,fz,yaw);}
 // ---------- matches ----------
 const variantsFor=(teamSize,t)=>Math.max(1,Math.min(t.variants,teamSize>=16?3:teamSize>=4?2:1));
 // beginMatch({teamSize,humanClass,seed}): new bot pools (team x class x variants, team-tinted, seeded per match) and the
 // player's build queue up at once; returns the match handle. Nothing is rasterized in Classic mode.
 function beginMatch({teamSize=1,humanClass='ranger',seed=Date.now()}={}){
  endMatch();const t=tier(),V=variantsFor(teamSize,t);match={seed:seed>>>0,V,pools:[{},{}],sets:[],byActor:new Map(),active:false,fallback:false,started:performance.now(),readyAt:0,waitedMs:0,size:teamSize,tier:tierName};
  if(mode!=='chibi'||disabled)return match;
  const human=playerSet(humanClass);if(human)match.sets.push(human);
  for(const cls of CLASS_ORDER)for(let v=0;v<V;v++)for(const team of [0,1])pool(team,cls,v);
  return match;}
 function pool(team,cls,v){const list=match.pools[team][cls]??=[];if(!list[v]){const set=request(randomBuild(hashSeed(match.seed,v),cls,team),1);if(!set)return null;list[v]=set;match.sets.push(set);}return list[v];}
 // waitMatch({budgetMs,signal,onProgress}): resolves true when every queued set is done, false when the budget runs out
 // (the match then shows classic billboards) or the setup is cancelled.
 async function waitMatch({budgetMs=6000,signal,onProgress}={}){
  if(!match)return false;const m=match,began=performance.now();if(mode!=='chibi'||disabled){m.fallback=mode==='chibi';return false;}
  const total=m.sets.length;let timer=0;const budget=new Promise(r=>{timer=setTimeout(()=>r('budget'),budgetMs);}),abort=new Promise(r=>signal?.addEventListener('abort',()=>r('abort'),{once:true}));
  try{let done=0;for(const s of m.sets){if(!s.done){const why=await Promise.race([s.promise,budget,abort]);if(why==='budget'||why==='abort'||signal?.aborted){if(why==='budget'){m.fallback=true;for(const x of m.sets)if(!x.done&&x!==playerSetCache)x.cancelled=true;console.warn('Crusader chibi art took longer than the loading budget; this match uses the classic billboards.');}return false;}}done++;try{onProgress?.(done/total);}catch(_){}}}
  finally{clearTimeout(timer);m.waitedMs=performance.now()-began;}
  m.readyAt=Math.max(m.started,...m.sets.map(s=>s.doneAt||0));return true;}
 // startMatch(views): the match is on; every bot view is dressed at once, so a bot downed before its first drawn frame
 // still leaves a chibi ghost and no classic billboard flashes on the first frame.
 function startMatch(views){if(!match)return;match.active=true;if(views)for(const v of views)dress(v);}
 function endMatch(){if(!match)return;for(const s of match.sets)if(!s.done&&s!==playerSetCache)s.cancelled=true;match.active=false;match=null;}
 // dress(view): bot views each frame. Picks the actor's pooled set (team, class, variant); a class with no pool yet is
 // queued lazily and the actor keeps its current look until it is ready.
 function dress(view){const a=view.a,sprite=view.sprite;if(!sprite||a.human)return;let set=null;
  if(mode==='chibi'&&!disabled&&match&&!match.fallback&&a.enabled!==false){let e=match.byActor.get(a.id);if(!e||e.cls!==a.classId||e.team!==a.team){const cls=CLASS_IDS.includes(a.classId)?a.classId:'ranger',v=(a.ordinal??a.id)%match.V;e={cls:a.classId,team:a.team,set:pool(a.team?1:0,cls,v)};match.byActor.set(a.id,e);}
   if(e.set?.ready)set=e.set;else if(e.set&&!e.set.failed)set=current.get(sprite)||null;}
  apply(sprite,set);}
 function undress(sprite){apply(sprite,null);}
 function setMode(next){mode=next==='classic'?'classic':'chibi';return mode;}
 onBuildsChanged(()=>{playerKey='';});
 function snapshot(){let ready=0,pending=0,textures=0;for(const s of cache.values()){if(s.ready){ready++;textures+=s.dirs.length;}else if(!s.done)pending++;}
  return {mode,disabled,tier:tierName,sprite:CHIBI_SPRITE,cached:cache.size,ready,pending,textures,queue:queue.length,...stats,avgRasterMs:stats.rasters?stats.rasterMs/stats.rasters:0,
   match:match?{seed:match.seed,variants:match.V,sets:match.sets.length,ready:match.sets.filter(s=>s.ready).length,fallback:match.fallback,active:match.active,tier:match.tier,waitedMs:Math.round(match.waitedMs),readyMs:match.readyAt?Math.round(match.readyAt-match.started):null,dressed:match.byActor.size}:null};}
 return {get mode(){return mode;},get disabled(){return disabled;},get match(){return match;},setMode,setRenderer(r){renderer=r||null;},readQuality,request,player,dress,undress,face,apply,beginMatch,waitMatch,startMatch,endMatch,snapshot,isDressed:sprite=>current.has(sprite),setOf:sprite=>current.get(sprite)||null,facingOf:sprite=>current.has(sprite)?dirOf.get(sprite)??0:-1,
  // whenIdle(): resolves once the queue is empty (tests and the creator can await the art).
  async whenIdle(){while(queue.length||working)await new Promise(r=>setTimeout(r,50));}};
}
export const chibiActors=createChibiActors();
