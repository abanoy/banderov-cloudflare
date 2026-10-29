import * as T from '../vendor/three.module.js';
import {classBillboardMaps} from './retro-look.js?v=aerie-20261018';
import {professionProp} from './citadel-models.js?v=aerie-20261018';

// Battle presentation extension (battle.use(createBattleFx())): muzzle flashes, projectile dressing, impacts,
// SA1-style hit stars, blasts, death puffs, ward runes, revive beams, bot pods and per-class owner costumes
// (classic billboards only: an actor dressed in Crusader chibi art by chibi-actors.js keeps it).
// Presentation only: never touches combat state. Every effect lives in a fixed-size instanced pool with a
// preallocated instanceColor and a per-instance dithered fade (screen-door, no transparency sorting).
const CLASS_IDS=['fighter','ranger','mage','builder'];
const TEAM=[0x80eee2,0xf49bc7],SAND=[0xdac9a3,0xc7bea5,0xfff0c8,0xb9a57d],SPARK=0xffe9a8,EMBER=0xffa860,SOOT=0x4a3f4f,GOLD=0xffd27a;
const WEAPON_TINT={lance:0xfff3cd,fan:0xbff8ff,orbit:0xe8c8ff,longbow:0xffffff,firepot:0xffb15e,reviver:0xc8ffe6,'mounted-cannon':0x8a8296,'mounted-heavyCannon':0x6f6678,'mounted-trebuchet':0xc7bea5,'mounted-beacon':0xfff3cd};
const STAR=1,CUBE=0,PUFF=2,RING=3,RUNE=4,RIM=5,FIRE=6,GLOW=7;

// facing: the fade is also scaled by how squarely the (smooth) normal faces the camera (x.15 at the rim, x1.4 at the
// centre), so a puff is dense in the middle and dithers out toward its rim: a soft round ball, not a hexagon sticker.
function dither(material,key,facing=false){
 material.onBeforeCompile=s=>{
  s.vertexShader='attribute float fxFade;\nvarying float vFxFade;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vFxFade=fxFade;'+(facing?'\n vec3 fxNormal=normal;\n#ifdef USE_INSTANCING\n fxNormal=mat3(instanceMatrix)*fxNormal;\n#endif\n vFxFade*=.15+1.25*abs(normalize(normalMatrix*fxNormal).z);':''));
  s.fragmentShader='varying float vFxFade;\nfloat fxBayer2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}\n'+s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(vFxFade<=fxBayer2(gl_FragCoord.xy*.5)*.25+fxBayer2(gl_FragCoord.xy)+.03)discard;');
 };material.customProgramCacheKey=()=>'aerie-fx-dither-v'+(facing?'2f-':'1-')+key;return material;}
function merge(parts){let n=0;const list=[];for(const [g,color] of parts){const geo=g.index?g.toNonIndexed():g;list.push([geo,color]);n+=geo.attributes.position.count;}
 const pos=new Float32Array(n*3),col=new Float32Array(n*3),c=new T.Color();let o=0;
 for(const [geo,color] of list){c.set(color??0xffffff);const p=geo.attributes.position;for(let i=0;i<p.count;i++,o++){pos[o*3]=p.getX(i);pos[o*3+1]=p.getY(i);pos[o*3+2]=p.getZ(i);col[o*3]=c.r;col[o*3+1]=c.g;col[o*3+2]=c.b;}}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('color',new T.BufferAttribute(col,3));out.computeVertexNormals();return out;}
const placed=(g,x,y,z,rx=0,ry=0,rz=0)=>{g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);return g;};
function starGeometry(){const pos=[];for(let k=0;k<4;k++){const a=k*Math.PI/2,b=a+Math.PI/4,c=a-Math.PI/4;pos.push(0,0,0,Math.cos(c)*.26,Math.sin(c)*.26,0,Math.cos(a),Math.sin(a),0,0,0,0,Math.cos(a),Math.sin(a),0,Math.cos(b)*.26,Math.sin(b)*.26,0);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));return g;}
// Fireball: low-poly faceted ball with baked per-facet shade (white-hot top, warm sides, dim underside), so the
// instance colour reads as a lit PS1-style volume instead of a flat unlit hexagon.
function fireGeometry(){const g=new T.IcosahedronGeometry(1,1),p=g.attributes.position,col=new Float32Array(p.count*3),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);const ny=(a.y+b.y+c.y)/3,k=ny>.45?1:ny>-.1?.86-((i/3)%3)*.04:ny>-.55?.66:.5;for(let j=0;j<3;j++){col[(i+j)*3]=Math.min(1,k*1.04);col[(i+j)*3+1]=k;col[(i+j)*3+2]=k*.92;}}
 g.setAttribute('color',new T.BufferAttribute(col,3));return g;}
// Smoke puff: same vocabulary as the chimney smoke in world.js: detail-1 icosahedron (smooth normals for the facing
// dither) with a baked light top / shaded underside per facet. Puffs only spin about Y so the light stays on top.
function puffGeometry(){const g=new T.IcosahedronGeometry(1,1),p=g.attributes.position,col=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i+=3){const ny=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,k=ny>.35?1:ny>-.25?.8:.62;col.fill(k,i*3,i*3+9);}
 g.setAttribute('color',new T.BufferAttribute(col,3));return g;}
// Additive glow card: 12-sided disc with a Gouraud fall-off from the centre to black (black adds nothing). Drawn
// without depth test (like a lens flare) so the card never shows a hard cut where it meets the ground.
function glowGeometry(){const g=new T.CircleGeometry(1,12),p=g.attributes.position,col=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const k=Math.hypot(p.getX(i),p.getY(i))<.01?1:0;col[i*3]=col[i*3+1]=col[i*3+2]=k;}g.setAttribute('color',new T.BufferAttribute(col,3));return g;}
function runeGeometry(){const parts=[];for(let i=0;i<12;i++)parts.push([new T.RingGeometry(.93,1,5,1,i*Math.PI/6+.05,Math.PI/6-.1)]);parts.push([new T.RingGeometry(.8,.825,48)]);
 for(let i=0;i<12;i++){const a=i*Math.PI/6+Math.PI/12,g=new T.CircleGeometry(.045,4);g.translate(Math.cos(a)*.865,Math.sin(a)*.865,0);parts.push([g]);const t=new T.PlaneGeometry(.012,.07);t.rotateZ(a);t.translate(Math.cos(a)*.74,Math.sin(a)*.74,0);parts.push([t]);}
 const g=merge(parts);g.rotateX(-Math.PI/2);return g;}
// Same pod vocabulary as the player's pod in main.js (bowl, band, wings, fins) for bots in a pod arc.
function podGeometry(){const pale=0xe5d6a9,blue=0x477e96,parts=[[placed(new T.SphereGeometry(1.65,12,6,0,Math.PI*2,Math.PI/2,Math.PI/2),0,.65,0),pale],[placed(new T.CylinderGeometry(1.72,1.45,.3,12),0,.65,0),blue]];
 for(const side of [-1,1]){parts.push([placed(new T.BoxGeometry(1.9,.12,.85),side*2,.38,.15,0,0,side*-.15),pale],[placed(new T.ConeGeometry(.32,1,6),side*2.8,.6,.15),blue]);}return merge(parts);}

export function createBattleFx(){
 let ctx=null,root=null,built=false,frame=0,clock=0;
 const pools=[],dummy=new T.Object3D(),color=new T.Color(),tint=new T.Color(),q=new T.Quaternion(),q2=new T.Quaternion(),v=new T.Vector3(),dir=new T.Vector3(),Z=new T.Vector3(0,0,1),Y=new T.Vector3(0,1,0),camQ=new T.Quaternion();
 const classMaps={},savedMaps=new Map(),byId=new Map(),viewById=new Map(),lastSound={};let viewerTeam=0;
 // Particle store: struct-of-arrays, fixed capacity, reused slots (oldest overwritten when full).
 const N=720,P={kind:new Uint8Array(N),x:new Float32Array(N),y:new Float32Array(N),z:new Float32Array(N),vx:new Float32Array(N),vy:new Float32Array(N),vz:new Float32Array(N),g:new Float32Array(N),drag:new Float32Array(N),age:new Float32Array(N),life:new Float32Array(N),s0:new Float32Array(N),s1:new Float32Array(N),r:new Float32Array(N),gg:new Float32Array(N),b:new Float32Array(N),spin:new Float32Array(N),rot:new Float32Array(N),peak:new Float32Array(N),aspect:new Float32Array(N)};let cursor=0;
 const flashEnds=new Float32Array(24);
 function pool(name,geometry,capacity,{side=T.FrontSide,vertexColors=false,fade=true,additive=false,facing=false}={}){
  const fadeAttr=new T.InstancedBufferAttribute(new Float32Array(capacity).fill(1),1).setUsage(T.DynamicDrawUsage);geometry.setAttribute('fxFade',fadeAttr);
  const material=new T.MeshBasicMaterial({color:0xffffff,side,vertexColors});if(additive){material.blending=T.AdditiveBlending;material.transparent=true;material.depthWrite=false;material.depthTest=false;material.fog=false;}if(fade)dither(material,name,facing);
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='FX '+name;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;mesh.visible=false;root.add(mesh);
  const p={mesh,fade:fadeAttr,capacity,n:0};pools.push(p);return p;}
 let cubes,stars,puffs,rings,runes,rims,fires,glows,streaks,halos,beams,podBody,podRim;
 function build(){if(built)return;built=true;
  const group=new T.Group();group.name='Battle FX';ctx.root.add(group);root=group;
  cubes=pool('cubes',new T.BoxGeometry(1,1,1),384);stars=pool('stars',starGeometry(),192,{side:T.DoubleSide});puffs=pool('puffs',puffGeometry(),192,{vertexColors:true,facing:true});
  const ring=new T.RingGeometry(.84,1,40);ring.rotateX(-Math.PI/2);rings=pool('rings',ring,24,{side:T.DoubleSide});runes=pool('runes',runeGeometry(),6,{side:T.DoubleSide});
  const rim=new T.RingGeometry(.955,1,48);rim.rotateX(-Math.PI/2);rims=pool('rims',rim,16,{side:T.DoubleSide});fires=pool('fires',fireGeometry(),96,{vertexColors:true});glows=pool('glows',glowGeometry(),32,{side:T.DoubleSide,vertexColors:true,additive:true});
  const streak=new T.ConeGeometry(1,1,4,1,true);streak.rotateX(-Math.PI/2);streak.translate(0,0,-.5);streaks=pool('streaks',streak,512,{side:T.DoubleSide});
  halos=pool('halos',new T.TorusGeometry(1,.14,3,12),256);
  const beam=new T.CylinderGeometry(1,1,1,6,1,true);beam.translate(0,.5,0);beams=pool('beams',beam,16,{side:T.DoubleSide});
  podBody=pool('pods',podGeometry(),128,{vertexColors:true,fade:false});const podRing=new T.TorusGeometry(1.72,.09,4,24);podRing.rotateX(Math.PI/2);podRing.translate(0,.83,0);podRim=pool('pod-rims',podRing,128,{fade:false});
  for(const id of CLASS_IDS)if(!classMaps[id])classBillboardMaps(id).then(m=>{classMaps[id]=m;}).catch(err=>console.warn('Class billboard failed:',id,err));}
 const human=()=>ctx.actors[0];
 function sound(kind,x,y,z,base=1,gap=.05){const play=ctx.audio?.play;if(typeof play!=='function')return;const now=performance.now()/1000;if(now-(lastSound[kind]||0)<gap)return;const h=human(),d=h?Math.hypot(x-h.state.x,y-h.state.y,z-h.state.z):0,volume=base*Math.max(.12,1-d/160);if(volume<=.12&&base<1)return;lastSound[kind]=now;try{play.call(ctx.audio,kind,{volume});}catch(_){}}
 // spawn one particle; returns slot
 function spawn(kind,x,y,z,vx,vy,vz,life,s0,s1,hex,{g=0,drag=0,spin=0,rot=0,delay=0,peak=1,aspect=1}={}){
  let i=-1;for(let k=0;k<N;k++){const j=(cursor+k)%N;if(P.age[j]>=P.life[j]){i=j;break;}}if(i<0)i=cursor;cursor=(i+1)%N;
  P.kind[i]=kind;P.x[i]=x;P.y[i]=y;P.z[i]=z;P.vx[i]=vx;P.vy[i]=vy;P.vz[i]=vz;P.life[i]=life;P.age[i]=-delay;P.s0[i]=s0;P.s1[i]=s1;P.g[i]=g;P.drag[i]=drag;P.spin[i]=spin;P.rot[i]=rot;P.peak[i]=peak;P.aspect[i]=aspect;
  color.set(hex);P.r[i]=color.r;P.gg[i]=color.g;P.b[i]=color.b;return i;}
 const OPTS={};function opts(g=0,drag=0,spin=0,rot=0,delay=0,peak=1,aspect=1){OPTS.g=g;OPTS.drag=drag;OPTS.spin=spin;OPTS.rot=rot;OPTS.delay=delay;OPTS.peak=peak;OPTS.aspect=aspect;return OPTS;}
 const hash=i=>{const s=Math.sin(i*127.1+frame*.013)*43758.5453;return s-Math.floor(s);};
 function put(p,matrix,r,g,b,fade){if(p.n>=p.capacity)return;p.mesh.setMatrixAt(p.n,matrix);p.mesh.instanceColor.setXYZ(p.n,r,g,b);p.fade.array[p.n]=fade;p.n++;}
 function finish(p){p.mesh.count=p.n;p.mesh.visible=p.n>0;if(p.n){p.mesh.instanceMatrix.needsUpdate=true;p.mesh.instanceColor.needsUpdate=true;p.fade.needsUpdate=true;}}
 // ---------- effect recipes ----------
 function shards(x,y,z,count,hex,speed,size,life,up=2){for(let k=0;k<count;k++){const a=k*2.399+hash(k)*.6,s=speed*(.6+.4*hash(k+7));spawn(CUBE,x,y,z,Math.cos(a)*s,up+s*.6*hash(k+3),Math.sin(a)*s,life*(.75+.25*hash(k+5)),size,size*.2,hex,opts(16,1.2,9+k));}}
 function muzzle(e){const now=clock;let slot=-1;for(let k=0;k<flashEnds.length;k++)if(flashEnds[k]<=now){slot=k;break;}if(slot<0)return;
  const list=ctx.combat?.projectiles,source=e.actor;let b=null;if(list)for(let k=list.length-1;k>=0&&k>=list.length-12;k--)if(list[k].source===source){b=list[k];break;}
  let x=e.x,y=e.y,z=e.z,team=byId.get(source)?.team;if(b){const sp=Math.hypot(b.vx,b.vy,b.vz)||1;x=b.x+b.vx/sp*.55;y=b.y+b.vy/sp*.55;z=b.z+b.vz/sp*.55;team=b.team;}
  const hex=WEAPON_TINT[e.weaponId]??SPARK,big=e.weaponId==='mounted-cannon'||e.weaponId==='mounted-heavyCannon'||e.weaponId==='mounted-trebuchet'||e.weaponId==='firepot';flashEnds[slot]=now+.12;
  spawn(STAR,x,y,z,0,0,0,.11,big?1.6:.95,big?2.1:1.25,team===undefined?hex:TEAM[team],opts(0,0,0,hash(1)*3));spawn(STAR,x,y,z,0,0,0,.08,big?.8:.45,big?.9:.55,0xffffff,opts(0,0,0,.78));
  if(big)for(let k=0;k<3;k++)spawn(PUFF,x,y,z,(hash(k)-.5)*2,1+hash(k+2),(hash(k+4)-.5)*2,.5,.35,.8,0xbcb3a8,opts(0,1.5,1,0,.04*k,.8));}
 function impact(p){const x=p.x,y=p.y,z=p.z;if(p.kind==='wall'){for(let k=0;k<5;k++){const a=k*1.257+hash(k)*.8,s=2+hash(k+9)*3;spawn(CUBE,x,y+.05,z,Math.cos(a)*s,2.5+hash(k+2)*3,Math.sin(a)*s,.45+hash(k+4)*.25,.18+hash(k+1)*.12,.05,SAND[k%4],opts(18,.8,8));}
   spawn(STAR,x,y,z,0,0,0,.13,.7,.35,SPARK,opts(0,0,0,hash(3)));spawn(PUFF,x,y,z,0,.8,0,.4,.25,.7,SAND[0],opts(0,0,0,0,0,.7));sound('impact',x,y,z,.45,.06);}
  else{spawn(STAR,x,y,z,0,.6,0,.25,.45,.05,p.team===0||p.team===1?TEAM[p.team]:SPARK,opts(0,0,0,.4));spawn(CUBE,x,y,z,0,.5,0,.3,.14,.02,0xffffff,opts(0,0,6));}}
 function hitStar(x,y,z,hex,scale,count){spawn(STAR,x,y,z,0,0,0,.24,1.5*scale,.7*scale,hex,opts(0,0,0,.2));spawn(STAR,x,y,z,0,0,0,.17,.75*scale,.25*scale,0xffffff,opts(0,0,0,.98));shards(x,y,z,count,hex,4.5*scale,.2*scale,.5,1.5);}
 // Blast: one-frame white star flash, a wide warm additive glow and a small white-hot additive core over a layered
 // dithered fireball (faceted warm shell plus a bright upper lick), ground shock rings, chunky debris and smoke.
 function blast(e){const r=Math.max(2,e.radius||10),x=e.x,y=e.y,z=e.z,m=e.meltdown,hot=m?0xe2a6ff:0xffe7a0,warm=m?0x9b63d9:0xff9a4a,yc=y+r*.12;
  spawn(STAR,x,yc,z,0,0,0,.07,r*.3,r*.38,0xffffff,opts(0,0,0,hash(2)*3));spawn(GLOW,x,yc,z,0,0,0,.42,r*.28,r*.5,m?0x8a5ab8:0xd8863e,opts(0,0,0,0,0,.9));
  spawn(GLOW,x,yc,z,0,.6,0,.24,r*.13,r*.2,m?0xf6e8ff:0xfff4d2,opts(0,0,0,0,0,1));spawn(FIRE,x,y+r*.12,z,0,1.5,0,.62,r*.15,r*.36,m?0x9b63d9:0xff8a3a,opts(0,0,1.1,.6,.02,.62));spawn(FIRE,x,y+r*.2,z,0,2.2,0,.46,r*.08,r*.22,m?0xe2a6ff:0xffc35a,opts(0,0,1.6,1.7,.06,.9));
  spawn(PUFF,x,y+r*.1,z,0,2.5,0,.8,r*.1,r*.3,m?0x5b3a7a:0x7a5a52,opts(0,0,0,1.1,.18,.8));
  spawn(RING,x,y+.12,z,0,0,0,.5,r*.15,r,hot,opts(0,0,0,0,0,.85));spawn(RING,x,y+.1,z,0,0,0,.75,r*.1,r*.8,warm,opts(0,0,0,0,.08,.7));
  for(let k=0;k<12;k++){const a=k*.5236+hash(k)*.4,s=r*(.6+hash(k+3)*.7);spawn(CUBE,x,y+.4,z,Math.cos(a)*s,6+hash(k+1)*8,Math.sin(a)*s,.8+hash(k+2)*.5,.5+hash(k+6)*.3,.12,k%3?SOOT:EMBER,opts(20,.6,7+k));}
  for(let k=0;k<6;k++){const a=k*1.047+.3;spawn(PUFF,x+Math.cos(a)*r*.3,y+.5,z+Math.sin(a)*r*.3,Math.cos(a)*1.2,2+hash(k)*1.5,Math.sin(a)*1.2,1.3,r*.1,r*.24,k%2?0x8c8291:0xb4aab0,opts(0,.5,.6,k,.1+k*.03,.75));}
  sound('blast',x,y,z,1,.08);}
 function death(e){const a=byId.get(e.actor);if(!a)return;const s=a.state,x=s.x,y=s.y+(s.flight?.7:0)+.9,z=s.z,hex=TEAM[a.team],enemy=a.team!==viewerTeam;
  for(let k=0;k<7;k++){const ang=k*.898,sp=1.6+hash(k)*1.2;spawn(PUFF,x+Math.cos(ang)*.3,y-.3+hash(k+1)*.6,z+Math.sin(ang)*.3,Math.cos(ang)*sp,.6+hash(k+3),Math.sin(ang)*sp,.65+hash(k+2)*.2,.32,.75,k%3===0?0xfff3cd:enemy?0x6b4a78:hex,opts(0,2.4,1.5,k,0,.9));}
  for(let k=0;k<3;k++){const ang=k*2.094+.5;spawn(STAR,x+Math.cos(ang)*.7,y+.2,z+Math.sin(ang)*.7,0,1.6,0,.6,.5,.1,k===1?0xffffff:hex,opts(0,0,3,k,.05+k*.07));}
  for(let k=0;k<4;k++)spawn(PUFF,x,y+.3,z,Math.sin(k*1.7)*.3,2.6,Math.cos(k*1.7)*.3,.8,.22-k*.03,.06,hex,opts(0,0,2,k,.12+k*.09,.8));}
 function ward(e){const a=byId.get(e.actor),hex=a?TEAM[a.team]:GOLD,x=e.x,y=e.y,z=e.z;
  // Thin rune circle plus two rim pulses (no dome fill), so the units inside the ward stay readable.
  spawn(RUNE,x,y+.1,z,0,0,0,.9,13.2,14,hex,opts(0,0,0,0,0,.8));spawn(RIM,x,y+.6,z,0,0,0,.45,8,14,hex,opts(0,0,0,0,0,.85));spawn(RIM,x,y+.08,z,0,0,0,.5,2,14,0xfff3cd,opts(0,0,0,0,.05,.8));
  for(let k=0;k<14;k++){const ang=k*.449;spawn(STAR,x+Math.cos(ang)*14,y+.3,z+Math.sin(ang)*14,0,3+hash(k)*2,0,.7,.45,.1,k%2?hex:0xfff3cd,opts(0,0,2,k,hash(k+4)*.4));}}
 function revived(e){const a=byId.get(e.actor),hex=a?TEAM[a.team]:0xc8ffe6,s=a?.state||e;spawn(RING,s.x,s.y+.1,s.z,0,0,0,.6,.4,2.4,hex,opts(0,0,0,0,0,1));for(let k=0;k<10;k++){const ang=k*.628;spawn(STAR,s.x+Math.cos(ang)*.8,s.y+.2,s.z+Math.sin(ang)*.8,0,2.5+hash(k)*1.5,0,.8,.38,.06,k%2?0xffffff:hex,opts(0,0,2,k,k*.03));}}
 function structureHit(e){const team=e.team===0||e.team===1?e.team:-1,down=e.type==='gate-down'||e.type==='protector-down';
  if(down){const hex=team<0?GOLD:TEAM[team];hitStar(e.x,e.y,e.z,hex,2.4,14);spawn(RING,e.x,e.y,e.z,0,0,0,.6,1,e.type==='protector-down'?7:5,hex,opts(0,0,0,0,0,1));spawn(PUFF,e.x,e.y,e.z,0,0,0,.35,1.2,3,0xfff3cd,opts(0,0,0,0,0,1));
   if(e.type==='gate-down')for(let k=0;k<10;k++){const a=k*.628;spawn(CUBE,e.x,e.y,e.z,Math.cos(a)*6,5+hash(k)*6,Math.sin(a)*6,1,.4+hash(k+2)*.3,.15,SAND[k%4],opts(20,.4,5));}
   sound(e.type==='protector-down'?'protector-down':'impact',e.x,e.y,e.z,1,.1);return;}
  hitStar(e.x,e.y,e.z,GOLD,1.6,9);sound('impact',e.x,e.y,e.z,.8,.07);}
 // ---------- per-frame ----------
 function drawParticles(dt){
  for(let i=0;i<N;i++){if(P.age[i]>=P.life[i])continue;P.age[i]+=dt;const age=P.age[i];if(age<0)continue;if(age>=P.life[i])continue;
   const t=age/P.life[i],d=Math.exp(-P.drag[i]*dt);P.vx[i]*=d;P.vz[i]*=d;P.vy[i]=P.vy[i]*d-P.g[i]*dt;P.x[i]+=P.vx[i]*dt;P.y[i]+=P.vy[i]*dt;P.z[i]+=P.vz[i]*dt;
   const kind=P.kind[i],size=P.s0[i]+(P.s1[i]-P.s0[i])*(kind===CUBE?t*t:1-(1-t)*(1-t)),fade=P.peak[i]*(kind===PUFF?(1-t)*(1+.6*t):Math.min(1,(1-t)*2.4));dummy.position.set(P.x[i],P.y[i],P.z[i]);
   if(kind===STAR||kind===GLOW){dummy.quaternion.copy(camQ);q.setFromAxisAngle(Z,P.rot[i]+Math.floor(age*12)*P.spin[i]*.08);dummy.quaternion.multiply(q);dummy.scale.set(size,size,size);}
   else if(kind===RING||kind===RUNE||kind===RIM){dummy.quaternion.setFromAxisAngle(Y,P.rot[i]+(kind===RUNE?Math.floor(age*8)*Math.PI/24:0));dummy.scale.set(size,1,size);}
   else if(kind===PUFF){dummy.rotation.set(0,P.spin[i]*age+P.rot[i],0);dummy.scale.set(size,size,size);}
   else{dummy.rotation.set(P.spin[i]*age+P.rot[i],P.spin[i]*age*.7,P.rot[i]);dummy.scale.set(size,size*(kind===CUBE?.8:1),size);}
   dummy.updateMatrix();const target=kind===STAR?stars:kind===CUBE?cubes:kind===PUFF?puffs:kind===RING?rings:kind===RUNE?runes:kind===FIRE?fires:kind===GLOW?glows:rims;
   const ramp=kind===RUNE?Math.min(1,age/.12,(P.life[i]-age)/.3):fade;put(target,dummy.matrix,P.r[i],P.gg[i],P.b[i],kind===RUNE?ramp:fade);}}
 function tail(len,width,fade,hex){dummy.quaternion.setFromUnitVectors(Z,dir);dummy.scale.set(width,width,len);dummy.updateMatrix();if(hex!==undefined)color.set(hex);put(streaks,dummy.matrix,color.r,color.g,color.b,fade);}
 function dressProjectiles(time){const list=ctx.combat?.projectiles;if(!list)return;
  for(let i=0;i<list.length;i++){const b=list[i];if(b.active===false)continue;const sp=Math.hypot(b.vx,b.vy,b.vz);if(sp<1e-3)continue;dir.set(b.vx/sp,b.vy/sp,b.vz/sp);
   const w=b.weapon,base=TEAM[b.team]??SPARK;tint.set(WEAPON_TINT[w]??0xffffff);color.set(base).lerp(tint,.35);dummy.position.set(b.x,b.y,b.z);
   if(w==='fan'){tail(2.6,.42,.75);dummy.quaternion.copy(camQ);dummy.scale.setScalar(.62);dummy.updateMatrix();put(stars,dummy.matrix,1,1,1,1);}
   else if(w==='orbit'){dummy.quaternion.copy(camQ);q.setFromAxisAngle(Y,Math.floor(time*12+b.id)*.42);dummy.quaternion.multiply(q);q.setFromAxisAngle(Z,.5);dummy.quaternion.multiply(q);dummy.scale.setScalar(.72);dummy.updateMatrix();put(halos,dummy.matrix,color.r,color.g,color.b,1);tail(.9,.18,.5);}
   else if(w==='longbow'){tail(Math.min(7,sp*.045),.09,.9,0xfff8e6);}
   else if(w==='firepot'){const flick=.5+.14*((Math.floor(time*14)+b.id)%3);dummy.quaternion.identity();dummy.rotation.set(0,Math.floor(time*10)*.7,0);dummy.scale.setScalar(flick);dummy.updateMatrix();color.set(0xffa040);put(puffs,dummy.matrix,color.r,color.g,color.b,1);dummy.scale.setScalar(flick*.55);dummy.position.y+=.18;dummy.updateMatrix();color.set(0xffe58a);put(puffs,dummy.matrix,color.r,color.g,color.b,1);
    if((frame+b.id)%4===0)spawn(PUFF,b.x,b.y,b.z,0,.6,0,.6,.22,.5,0x8c8291,opts(0,0,1,b.id,0,.7));}
   // Mounted defenses: soot trail plus a team-coloured hot streak so wall guns read as Dawn/Dusk fire.
   else if(w==='mounted-cannon'||w==='mounted-heavyCannon'){const heavy=w==='mounted-heavyCannon';tail(heavy?2.2:1.6,heavy?.3:.22,.6,SOOT);color.set(base).lerp(tint.set(0xffffff),.3);tail(heavy?1.2:.9,heavy?.13:.1,.95);
    if((frame+b.id)%5===0)spawn(PUFF,b.x,b.y,b.z,0,.4,0,.5,.2,heavy?.6:.45,0xb4aab0,opts(0,0,1,b.id,0,.6));if((frame+b.id)%(heavy?3:6)===0)spawn(CUBE,b.x,b.y,b.z,(hash(b.id)-.5)*2,1,(hash(b.id+3)-.5)*2,.3,heavy?.16:.12,.03,EMBER,opts(6,0,8));}
   else if(w==='mounted-trebuchet'){color.set(base).lerp(tint.set(0xfff3cd),.25);tail(1.1,.2,.7);if((frame+b.id)%5===0)spawn(CUBE,b.x,b.y,b.z,0,0,0,.35,.22,.05,SAND[b.id%4],opts(4,0,6));}
   else if(w==='mounted-beacon'){color.set(base).lerp(tint.set(0xffffff),.4);tail(Math.min(6,sp*.04),.08,.9);dummy.quaternion.copy(camQ);dummy.scale.setScalar(.34);dummy.updateMatrix();put(stars,dummy.matrix,color.r,color.g,color.b,1);}
   else if(w==='reviver'){dummy.quaternion.copy(camQ);dummy.scale.setScalar(.4);dummy.updateMatrix();put(stars,dummy.matrix,.8,1,.9,1);}
   else{tail(1.7,.22,.8);dummy.quaternion.copy(camQ);q.setFromAxisAngle(Z,Math.floor(time*12)*.4);dummy.quaternion.multiply(q);dummy.scale.setScalar(.5);dummy.updateMatrix();color.set(0xfff3cd);put(stars,dummy.matrix,color.r,color.g,color.b,1);}}}
 function reviveBeams(time){const list=ctx.actors;for(let i=0;i<list.length;i++){const a=list[i];if(!a.alive||!a.reviving||time-a.reviving.last>=.2)continue;const ally=byId.get(a.reviving.id);if(!ally||ally.alive)continue;
   v.set(ally.state.x-a.state.x,ally.state.y-a.state.y,ally.state.z-a.state.z);const len=v.length();if(len<.1)continue;dir.copy(v).multiplyScalar(1/len);dummy.position.set(a.state.x,a.state.y+1.2,a.state.z);dummy.quaternion.setFromUnitVectors(Y,dir);const w=.1+.05*(Math.floor(time*10)%2);dummy.scale.set(w,len,w);dummy.updateMatrix();color.set(TEAM[a.team]).lerp(tint.set(0xffffff),.45);put(beams,dummy.matrix,color.r,color.g,color.b,.85);
   if((frame+i)%5===0){const f=hash(i);spawn(STAR,a.state.x+v.x*f,a.state.y+1.2+v.y*f,a.state.z+v.z*f,0,1.8,0,.55,.3,.05,frame%2?0xffffff:TEAM[a.team],opts(0,0,2,f*6));}}}
 function podsAndViews(time){const views=ctx.views;
  for(let i=0;i<views.length;i++){const view=views[i],a=view.a;if(a.enabled===false||!a.alive)continue;
   const maps=view.sprite.userData.chibi?null:classMaps[a.classId];if(maps&&view.sprite.userData.maps!==maps){if(!savedMaps.has(view))savedMaps.set(view,view.sprite.userData.maps);const back=view.sprite.material.map===view.sprite.userData.maps?.[1];view.sprite.userData.maps=maps;view.sprite.material.map=maps[back?1:0];}
   if(view.prop&&view.propClass===a.classId&&view.prop.userData.team!==a.team){const old=view.prop,next=professionProp(a.classId||'ranger',ctx.world.mats,a.team);next.rotation.copy(old.rotation);next.position.copy(old.position);next.visible=old.visible;view.group.remove(old);view.group.add(next);view.prop=next;}
   const s=a.state,flying=s.flight&&s.flightKind!=='dismount'&&!a.mount;if(view.ring){if(flying&&view.ring.visible)view.ring.visible=false;else if(!flying&&!view.ring.visible)view.ring.visible=true;}
   if(!flying||a.human)continue;dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(0,Math.atan2(s.vx,s.vz),Math.sin(time*3+a.id)*.035);dummy.scale.setScalar(1);dummy.updateMatrix();
   if(a.team===viewerTeam){put(podBody,dummy.matrix,1,1,1,1);color.set(0xa6fff0);}else{put(podBody,dummy.matrix,.36,.27,.48,1);color.set(0xd88cff);}put(podRim,dummy.matrix,color.r,color.g,color.b,1);
   if((frame+a.id)%4===0)spawn(STAR,s.x-s.vx*.03,s.y+.2,s.z-s.vz*.03,0,-.3,0,.45,.3,.05,a.team===viewerTeam?0xa9ece9:0xb18ecf,opts(0,0,0,a.id));}}
 function restoreViews(){for(const [view,maps] of savedMaps){view.sprite.userData.maps=maps;view.sprite.material.map=maps[0];}savedMaps.clear();for(const view of ctx?.views||[])if(view.ring&&!view.ring.visible)view.ring.visible=true;}
 function clearAll(){P.age.fill(0);P.life.fill(0);flashEnds.fill(0);for(const p of pools){p.n=0;finish(p);}}
 const ext={name:'battle-fx',handles:['blast','hit'],
  attach(c){ctx=c;build();},
  reset(){clearAll();restoreViews();},
  started(c){ctx=c;build();byId.clear();viewById.clear();for(const a of c.bots.allActors)byId.set(a.id,a);for(const view of c.views)viewById.set(view.a.id,view);viewerTeam=c.human?.team??0;clearAll();},
  stopped(){clearAll();restoreViews();},
  event(e){switch(e.type){
   case 'shot':muzzle(e);break;
   case 'melee':{const a=byId.get(e.actor);if(a)spawn(STAR,e.x,e.y,e.z,0,0,0,.14,1.1,.6,TEAM[a.team],opts(0,0,0,.6));break;}
   case 'hit':{const a=byId.get(e.actor);hitStar(e.x,e.y,e.z,a?TEAM[a.team]:SPARK,e.damage>=60?1.4:1,6);break;}
   case 'vehicle-hit':case 'core-hit':case 'protector-hit':case 'gate-hit':case 'gate-down':case 'protector-down':structureHit(e);break;
   case 'blast':blast(e);break;
   case 'explosion':sound('explosion',e.x,0,e.z,1,.2);break;
   case 'down':death(e);break;
   case 'cast':ward(e);break;
   case 'revive':revived(e);break;}},
  impact(p){impact(p);},
  render(dt,c){ctx=c;if(!built)return;frame++;clock+=dt;const time=c.combat?.state.time??0;camQ.copy(c.camera.quaternion);for(const p of pools)p.n=0;
   podsAndViews(time);dressProjectiles(time);reviveBeams(time);drawParticles(dt);for(const p of pools)finish(p);},
  snapshot(){let live=0;for(let i=0;i<N;i++)if(P.age[i]<P.life[i])live++;return {particles:live,capacity:N,pools:Object.fromEntries(pools.map(p=>[p.mesh.name,p.n])),classMaps:Object.keys(classMaps),costumed:savedMaps.size};}};
 return ext;
}
