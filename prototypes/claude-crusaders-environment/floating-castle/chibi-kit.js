// Crusader chibi kit for the game: one ES module API over the owner's chibi creator kit (chibi/kit.js + chibi/fx.js,
// byte-identical copies that attach globalThis.ChibiKit). Cosmetic only: the kit's gear bonuses, enchantments and rarity
// are proposals and never reach combat. Builds are the creator's "Copy build" JSON; one saved build per game class.
import './chibi/kit.js?v=dbc-20261018';
import './chibi/fx.js?v=dbc-20261018';

export const Kit=globalThis.ChibiKit;
if(!Kit?.render)throw Error('Chibi kit did not load');
export const BUILD_KEY='crusaders-chibi-build-v1';
export const CLASS_IDS=Object.freeze(['fighter','ranger','mage','builder']);
export const VIEWS=Object.freeze(['front','q','side','qb','back','qbL','sideL','qL']);
// Eight facings in turntable order (index*45 deg from facing the camera toward screen right); the kit draws all eight,
// the far 3/4s (qbL, qL) included, so weapon hands and one-sided details stay on their own side.
export const DIRECTIONS=Object.freeze(VIEWS.map((view,i)=>Object.freeze({index:i,view,mirror:false})));
// Class gear defaults (the creator's DEFAULTS) and the default look.
export const CLASS_DEFAULTS=Object.freeze({
 fighter:Object.freeze({outfit:'plate',hat:'helm',weapon:'sword',offhand:'heater',back:'cape',col:Object.freeze({p:'#2f5fb3',a:'#f2c14e'})}),
 ranger:Object.freeze({outfit:'tunic',hat:'cap',weapon:'longbow',offhand:'none',back:'quiver',col:Object.freeze({p:'#3f8f4f',a:'#c8433f'})}),
 mage:Object.freeze({outfit:'robe',hat:'wizard',weapon:'reviver',offhand:'none',back:'tome',col:Object.freeze({p:'#5b3fa6',a:'#f2c14e'})}),
 builder:Object.freeze({outfit:'overalls',hat:'workcap',weapon:'hammer',offhand:'none',back:'pack',col:Object.freeze({p:'#2f5fb3',a:'#e0a83a'})})});
const BASE={name:'Crusader',cls:'fighter',skin:'#f6d0b4',hair:'short',hairColor:'#5a3a2a',extra:'none',face:{eyes:'sharp',mouth:'grin',blush:true,eyeColor:'#2a7fa8'},infuse:'none',infuseTier:'rare',aura:'none',auraTier:'rare'};
const SLOTS=[['outfit','outfits'],['hat','hats'],['weapon','weapons'],['offhand','offhands'],['back','backs']];
const HEX=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i,hex=(v,d)=>typeof v==='string'&&HEX.test(v.trim())?v.trim().toLowerCase():d,key=(v,o,d)=>typeof v==='string'&&Object.prototype.hasOwnProperty.call(o||{},v)?v:d;
const classOf=c=>CLASS_IDS.includes(c)?c:null;
const clone=b=>JSON.parse(JSON.stringify(b));

export function defaultBuild(classId='fighter'){const cls=classOf(classId)||'fighter',d=CLASS_DEFAULTS[cls];return {...clone(BASE),cls,outfit:d.outfit,hat:d.hat,weapon:d.weapon,offhand:d.offhand,back:d.back,col:{p:d.col.p,a:d.col.a}};}
// Sanitise any build-like object (pasted JSON, old storage): catalog keys, hex colours, a short plain name, legal class gear.
export function normalizeBuild(raw,classId){
 const r=raw&&typeof raw==='object'?raw:{},cls=classOf(classId)||classOf(r.cls)||'fighter',d=defaultBuild(cls),C=Kit.CLASSES[cls],f=r.face&&typeof r.face==='object'?r.face:{};
 const b={name:typeof r.name==='string'?r.name.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,24)||d.name:d.name,cls,skin:hex(r.skin,d.skin),hair:key(r.hair,Kit.HAIRS,d.hair),hairColor:hex(r.hairColor,d.hairColor),extra:key(r.extra,Kit.EXTRAS,d.extra),
  face:{eyes:key(f.eyes,Kit.EYES,d.face.eyes),mouth:key(f.mouth,Kit.MOUTHS,d.face.mouth),blush:typeof f.blush==='boolean'?f.blush:d.face.blush,eyeColor:hex(f.eyeColor,d.face.eyeColor)},
  col:{p:hex(r.col?.p,d.col.p),a:hex(r.col?.a,d.col.a)},
  infuse:key(r.infuse,Kit.INFUSIONS,'none'),infuseTier:key(r.infuseTier,Kit.TIERS,'rare'),aura:key(r.aura,Kit.AURAS,'none'),auraTier:key(r.auraTier,Kit.TIERS,'rare')};
 for(const [slot,list] of SLOTS)b[slot]=C[list].includes(r[slot])?r[slot]:d[slot];
 if(Kit.allowedAura&&b.aura!=='none'&&!Kit.allowedAura(cls,b.aura))b.aura='none';
 return b;}
// Class change: keep every cosmetic (name, skin, hair, face, colours, extra), keep gear the new class allows, else its default gear.
export function buildForClass(build,classId){const cls=classOf(classId)||'fighter',src=normalizeBuild(build),out=normalizeBuild({...src,cls},cls);return out;}

// ---------- saved builds: localStorage with try/catch on every access, in-memory fallback ----------
let memory=null;
const emptyStore=()=>({version:1,builds:{},last:null});
function readStore(){let d=null;try{const raw=globalThis.localStorage?.getItem(BUILD_KEY);if(raw)d=JSON.parse(raw);}catch(_){d=null;}if(!d||typeof d!=='object'||d.version!==1||!d.builds||typeof d.builds!=='object')d=memory?clone(memory):emptyStore();return d;}
function writeStore(d){memory=clone(d);try{globalThis.localStorage?.setItem(BUILD_KEY,JSON.stringify(d));return true;}catch(_){return false;}}
export function loadBuilds(){const d=readStore(),out=emptyStore();for(const cls of CLASS_IDS)if(d.builds[cls])out.builds[cls]=normalizeBuild(d.builds[cls],cls);out.last=classOf(d.last)&&out.builds[d.last]?d.last:CLASS_IDS.find(c=>out.builds[c])||null;return out;}
// saveBuild(build[,classId]): stores it as that class's build and the last edited one. Returns true when it reached
// localStorage (false still keeps it for this page in memory). Fires window 'crusader-build' {classId,build}.
export function saveBuild(build,classId){const b=normalizeBuild(build,classId),d=loadBuilds();d.builds[b.cls]=b;d.last=b.cls;const stored=writeStore(d);changed(b.cls,b);return stored;}
export function clearBuilds(){memory=null;try{globalThis.localStorage?.removeItem(BUILD_KEY);}catch(_){}changed(null,null);}
// The player's look for a class: its saved build, else the last saved build's cosmetics with this class's gear, else the default.
export function playerBuild(classId){const cls=classOf(classId)||'fighter',d=loadBuilds();if(d.builds[cls])return d.builds[cls];if(d.last&&d.builds[d.last])return buildForClass(d.builds[d.last],cls);return defaultBuild(cls);}
export function exportBuild(build){return JSON.stringify(normalizeBuild(build));}
export function importBuild(text,classId){try{const raw=typeof text==='string'?JSON.parse(text):text;return raw&&typeof raw==='object'&&!Array.isArray(raw)?normalizeBuild(raw,classId):null;}catch(_){return null;}}
let revision=0;const listeners=new Set();
function changed(classId,build){revision++;for(const fn of listeners)try{fn({classId,build,revision});}catch(err){console.warn('Chibi build listener failed:',err);}try{globalThis.dispatchEvent?.(new CustomEvent('crusader-build',{detail:{classId,build,source:'chibi-kit'}}));}catch(_){}}
// onBuildsChanged(fn): saves from this module or another 'crusader-build' window event (another tab writes 'storage').
export function onBuildsChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
export function buildsRevision(){return revision;}
try{globalThis.addEventListener?.('crusader-build',e=>{if(e?.detail?.source!=='chibi-kit'){revision++;for(const fn of listeners)try{fn({classId:e?.detail?.classId??null,build:e?.detail?.build??null,revision});}catch(_){}}});globalThis.addEventListener?.('storage',e=>{if(e.key===BUILD_KEY){memory=null;revision++;for(const fn of listeners)try{fn({classId:null,build:null,revision});}catch(_){}}});}catch(_){}

// ---------- seeded bot builds with team-tinted colours ----------
// Dawn: cool blues, cyan and gold. Dusk: violets, magentas and dark ink. Hair/skin/face stay free for variety.
const PALETTES=[Object.freeze({team:0,name:'Dawn',primary:Object.freeze(['#2f5fb3','#2f86a6','#3a9ec2','#1f7a8c','#4a7fd4']),accent:Object.freeze(['#f2c14e','#5fe0ff','#80eee2','#e8eef6'])}),
 Object.freeze({team:1,name:'Dusk',primary:Object.freeze(['#5b3fa6','#7a3a9a','#a8327a','#3a2a5a','#2b2a45']),accent:Object.freeze(['#ff6fae','#f49bc7','#b58ad6','#e8578f'])})];
export function teamPalette(team){return PALETTES[team===1?1:0];}
function rng(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function hashSeed(...parts){let h=2166136261;for(const p of parts)for(const c of String(p)+'|')h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
// randomBuild(seed,classId,team): a legal build for the class (same seed, class and team give the same build), no enchantments.
export function randomBuild(seed,classId,team=0){
 const cls=classOf(classId)||'ranger',C=Kit.CLASSES[cls],pal=teamPalette(team),r=rng(hashSeed(seed>>>0,cls,team===1?1:0)),pick=a=>a[Math.floor(r()*a.length)%a.length];
 const b={name:pal.name+' '+C.name,cls,skin:pick(Kit.SKINS.slice(0,6)),hair:pick(Object.keys(Kit.HAIRS)),hairColor:pick(Kit.HAIR_COLORS),extra:r()<.65?'none':pick(Object.keys(Kit.EXTRAS)),
  face:{eyes:pick(Object.keys(Kit.EYES)),mouth:pick(Object.keys(Kit.MOUTHS)),blush:r()<.85,eyeColor:pick(Kit.EYE_COLORS)},
  outfit:pick(C.outfits),hat:pick(C.hats),weapon:pick(C.weapons),offhand:pick(C.offhands),back:pick(C.backs),col:{p:pick(pal.primary),a:pick(pal.accent)},
  infuse:'none',infuseTier:'rare',aura:'none',auraTier:'rare'};
 return normalizeBuild(b,cls);}
// Stable cache key of the look (name and the proposal-only enchant fields are not part of the battle art).
export function buildKey(build){const b=normalizeBuild(build);return [b.cls,b.skin,b.hair,b.hairColor,b.extra,b.face.eyes,b.face.mouth,b.face.blush?1:0,b.face.eyeColor,b.outfit,b.hat,b.weapon,b.offhand,b.back,b.col.p,b.col.a].join('|');}
// render(build,view,opts): the kit's SVG string (viewBox 0 0 400 520, feet at y~495). opts.fx:false skips the enchant effects.
export function render(build,view='front',opts){return Kit.render(normalizeBuild(build),VIEWS.includes(view)?view:'front',opts);}

// ---------- facing ----------
const TAU=Math.PI*2,STEP=Math.PI/4;
// Signed heading of a mover relative to the camera: 0 faces the camera, +PI/2 faces screen right, PI faces away.
// Same convention as the classic billboards (front when fx*sin(yaw)+fz*cos(yaw)>=0); the camera sits at +(sin yaw,cos yaw).
export function facingAngle(fx,fz,camYaw){const s=Math.sin(camYaw),c=Math.cos(camYaw);return Math.atan2(fx*c-fz*s,fx*s+fz*c);}
// viewForYaw(angle[,prev[,margin]]): DIRECTIONS index for a relative heading. With prev (the shown index) it keeps
// that facing until the heading leaves its 45 deg sector by more than margin radians, so boundaries never flicker.
export function viewForYaw(angle,prev=-1,margin=.16){
 const a=((angle%TAU)+TAU)%TAU,i=Math.round(a/STEP)%8;
 if(prev>=0&&prev<8&&prev!==i){let d=a-prev*STEP;d-=Math.round(d/TAU)*TAU;if(Math.abs(d)<=STEP/2+margin)return prev;}
 return i;}
