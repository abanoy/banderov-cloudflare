// Procedural adaptive music for The Floating Aerie (battle.use(createMusic())). Original WebAudio synthesis only:
// no audio files, samples or network. Late-90s console sky-castle palette: string pad, harp/pluck arpeggios, flute and
// saw leads with a ping-pong echo, FM bells, brass, a small breakbeat kit and a hall reverb built from seeded noise.
// One pitch set for everything: C major / F Lydian (title, explore) and its relative A minor (battle). Battle stingers
// are built from the chord under them and the finish fanfares are C major / A minor / F-G suspended, so they sit in key
// with the loop and with battle-feedback.js's own capture/victory/defeat cues (C-E-G-C, E-C-A, G-F#-F-E, C-F-G).
// Battle layers follow match state: base (pad, bass, arp) -> percussion once running (after a two-bar intro) -> lead
// and brass stabs while any castle shield is down -> bell doubling, crash and tom fills while a core is exposed (shield
// down, no protectors left) -> ticking clock during evacuation (16ths in the last 30 s). finished(): stinger, then the
// loop fades. Engine: a fixed graph of persistent voices built once on unlock (39 oscillators + 1 noise loop); a note is
// AudioParam automation only (setTargetAtTime, so reusing a voice never clicks). A timer, not requestAnimationFrame,
// schedules 16th-note steps ahead of AudioContext.currentTime, and the lookahead grows when timers are throttled.
// Per tick: indexed loops over typed arrays, no node creation, no arrays or closures. Pause ducks (gain + low-pass).
// Import-safe in Node: no window/document/AudioContext access until attach()/unlock(). Silent under ?test unless ?music=1.
const BASE=0,PERC=1,INT1=2,INT2=3,TENS=4,LAYERS=5,AHEAD=.2,TICK_MS=50,STING_STEP=60/140/4,MASTER=.3/.7,STING_LV=.8;
const HZ=new Float32Array(128);for(let i=0;i<128;i++)HZ[i]=440*2**((i-69)/12);
const PCS={c:0,d:2,e:4,f:5,g:7,a:9,b:11},INST={pad:0,bass:1,arp:2,lead:3,bell:4,brass:5,kick:6,snare:7,hat:8,shaker:9,crash:10,tom:11,tick:12};
const VEL={g:.35,a:.6,x:.85,X:1,o:.8,r:.5,R:.85,O:.85,5:.8,L:.8};
// Instrument output levels (before velocity). MASTER, the battle song level and STING_LV are calibrated against
// battle-feedback.js at the default settings (Master 70 %, Music volume 50 %; main.js passes Master x Music volume to
// setVolume, so MASTER carries the 1/.7 that keeps the default mix where it was tuned): the battle loop sits level with a dense stream of
// shots/impacts (A-weighted 400 ms) so single shots still read, and kills, explosions and protector cues stand ~10 dB over it.
const LV={pad:.085,bass:.2,arp:.09,lead:.135,bell:.1,brass:.055,kick:.42,snare:.24,hat:.05,shaker:.07,crash:.04,tom:.16,tick:.3,sbrass:.075,sbell:.1,boom:.34,scrash:.06,sweep:.035};
const PADPAN=[-.4,.4,-.15,.15,-.3,.3,-.1,.1],PADDET=[-9,7,-4,10,8,-7,5,-10],SBELL={ratio:3.5,index:1.4,dec:.45};
function midi(s){const m=/^([a-g])(#?)(-?\d)$/.exec(s);if(!m)throw new Error('music: bad note '+s);return 12*(+m[3]+1)+PCS[m[1]]+(m[2]?1:0);}
function chord(s){const [b,p]=s.split(':'),pad=p.trim().split(/\s+/).map(midi).sort((x,y)=>x-y),list=[];for(const q of pad)if(!list.some(r=>(r-q)%12===0))list.push(q);return {bass:midi(b),pad:Int16Array.from(pad),list:Int16Array.from(list),n:list.length};}
const tone=(c,i)=>c.list[(i%c.n+c.n)%c.n]+12*Math.floor(i/c.n);
// Song source: chords (bass:pad voicing, one per bar) and tracks [instrument, layer, condition, 'kind:pattern', gain, options].
// Pattern kinds (one 16-step bar per '|' entry, cycled): drum (. g a x X o), bass (R root, O octave, 5 fifth, L fifth below,
// lowercase = ghost, - tie), arp (digit = chord tone, - tie), chord (pad voices), line (note:steps tokens over the whole loop).
// Conditions: 1 shield down, 2 core exposed, 3 not exposed, 4 last 30 s of evacuation, 5 otherwise.
const TITLE_LEAD='e5:4 g5:2 a5:2 c6:6 b5:2|a5:4 g5:4 d5:8|e5:4 g5:2 a5:2 b5:6 a5:2|g5:4 a5:2 e5:10|f5:4 e5:2 d5:2 e5:4 a5:4|g5:6 f5:2 e5:4 d5:4|e5:4 d5:2 c5:2 d5:4 g5:4|e5:12 r:4|e5:4 g5:2 a5:2 c6:6 b5:2|a5:4 g5:4 d5:8|e5:4 g5:2 a5:2 b5:6 a5:2|g5:4 a5:2 c6:10|f5:4 g5:2 a5:2 c6:4 d6:4|b5:6 a5:2 g5:4 d5:4|a5:4 b5:4 c6:4 e6:4|d6:8 c6:4 a5:4';
const TITLE_BELL='r:16|r:8 g6:4 e6:4|r:16|r:8 c7:4 a6:4|r:16|r:16|r:12 b6:4|c7:4 g6:4 e6:8|r:16|r:8 a6:4 g6:4|r:16|r:8 c7:4 a6:4|r:16|r:16|r:16|r:8 d7:4 g6:4';
const EXPLORE_BELL='e5:4 g5:2 a5:2 c6:8|r:16|d5:4 f5:2 a5:2 e5:8|r:16|e5:4 g5:2 a5:2 b5:8|r:8 a5:4 g5:4|e5:16|r:16|r:8 b5:4 c6:4|d6:8 r:8|r:16|r:8 e6:4 c6:4|r:16|g5:8 r:8|r:8 b5:4 a5:4|g5:16';
const BATTLE_LEAD='a4:3 c5:3 e5:2 a5:4 g5:2 e5:2|f5:3 e5:3 c5:2 a4:6 c5:2|d5:3 e5:3 g5:2 b5:4 a5:2 g5:2|e5:12 d5:2 e5:2|a4:3 c5:3 e5:2 a5:4 b5:2 c6:2|c6:3 b5:3 a5:2 f5:6 a5:2|d6:3 c6:3 a5:2 f5:4 d5:4|e5:4 g#5:4 b5:4 d6:4|a5:6 c6:2 a5:4 g5:4|g5:6 b5:2 d6:4 b5:4|e6:6 d6:2 b5:4 g5:4|a5:10 g5:2 a5:2 c6:2|c6:6 a5:2 f5:4 a5:4|d6:6 b5:2 g5:4 b5:4|e6:4 d6:4 c6:4 b5:4|b5:6 a5:2 g#5:4 e5:4';
const SONG_SRC={
 title:{bpm:88,swing:.12,bars:16,level:.9,fadeIn:.7,perc:.85,
  chords:['f2:a3 c4 e4 g4','g2:b3 d4 e4 a4','e2:b3 d4 e4 g4','a2:a3 c4 e4 g4','d2:a3 c4 e4 f4','g2:a3 c4 d4 f4','c3:b3 c4 e4 g4','c3:b3 d4 e4 g4','f2:a3 c4 e4 g4','g2:b3 d4 e4 a4','e2:b3 d4 e4 g4','a2:a3 c4 e4 g4','d2:a3 c4 e4 f4','g2:b3 d4 f4 g4','f2:a3 b3 e4 g4','g2:a3 c4 d4 g4'],
  tracks:[['pad',BASE,0,'chord:X---------------',.55,{alt:true}],['bass',BASE,0,'bass:R-----R---..5---|R-----R---..O---',.8],['arp',BASE,0,'arp:0-1-2-3-4-3-2-1-|0-1-2-3-5-4-3-2-',.55],
   ['lead',BASE,0,'line:'+TITLE_LEAD,.8],['bell',BASE,0,'line:'+TITLE_BELL,.5],['kick',PERC,0,'drum:x.........a.....|x.........a...g.',.7],['snare',PERC,0,'drum:........a.......|........a......g',.5],['shaker',PERC,0,'drum:g.a.g.a.g.a.g.a.',.8]],
  patch:{pad:{cut:1500,q:.6,lfo:260,att:.5,sus:.85,rel:.9},bass:{cut:380,env:520,q:1,fdec:.15,dec:.6,sus:.6,rel:.08},arp:{cut:900,env:1800,q:1,fdec:.1,dec:.5},lead:{saw:.1,tri:.9,breath:.05,cut:2600,att:.05,dec:.4,sus:.8,rel:.2,glide:.045,vib:12},
   bell:{ratio:3.5,index:1.5,dec:.9},brass:{cut:1200},wet:[.42,.14,.3,.3,.1],delay:{steps:3,fb:.32,send:.28},leadLayer:BASE,bellLayer:BASE}},
 explore:{bpm:76,swing:0,bars:16,level:.85,fadeIn:1.2,perc:.6,
  chords:['f2:a3 c4 e4 g4','e2:g3 c4 d4 g4','d2:a3 c4 e4 f4','g2:a3 c4 d4 g4','f2:a3 c4 e4 g4','e2:b3 d4 e4 g4','a2:a3 c4 e4 g4','g2:a3 c4 d4 g4','f2:a3 b3 e4 g4','g2:b3 d4 e4 a4','e2:b3 d4 e4 g4','a2:a3 c4 e4 g4','d2:a3 c4 e4 f4','e2:g3 c4 d4 g4','f2:a3 b3 e4 g4','g2:a3 c4 d4 g4'],
  tracks:[['pad',BASE,0,'chord:X---------------',.48,{alt:true}],['bass',BASE,0,'bass:R---------------|R-------5-------',.6],['arp',BASE,0,'arp:0---2---4---3---|1---3---5---2---',.6,{oct:12}],
   ['bell',BASE,0,'line:'+EXPLORE_BELL,.7],['shaker',PERC,0,'drum:....a.......a...|....a.....g.a...',.9]],
  patch:{pad:{cut:1150,q:.5,lfo:200,att:.9,sus:.9,rel:1.4},bass:{cut:300,env:200,q:.7,fdec:.3,dec:1.5,sus:.7,rel:.3},arp:{cut:1100,env:1400,q:.8,fdec:.2,dec:.9},lead:{saw:0,tri:0,breath:0,cut:2000,att:.05,dec:.4,sus:.8,rel:.2,glide:.04,vib:10},
   bell:{ratio:1,index:1.2,dec:1.2},brass:{cut:1000},wet:[.5,.2,.3,.3,.1],delay:{steps:3,fb:.25,send:0},leadLayer:BASE,bellLayer:BASE}},
 battle:{bpm:140,swing:0,bars:16,level:.7,fadeIn:.06,perc:1,
  chords:['a2:e3 a3 c4 e4','f2:f3 a3 c4 f4','g2:g3 b3 d4 g4','e2:e3 g3 b3 e4','a2:e3 a3 c4 e4','f2:f3 a3 c4 f4','d2:f3 a3 d4 f4','e2:e3 g#3 b3 e4','f2:f3 a3 c4 f4','g2:g3 b3 d4 g4','e2:e3 g3 b3 e4','a2:e3 a3 c4 e4','f2:f3 a3 c4 f4','g2:g3 b3 d4 g4','a2:e3 a3 c4 e4','e2:e3 g#3 b3 e4'],
  tracks:[['pad',BASE,0,'chord:X---------------',.42,{alt:true}],['bass',BASE,3,'bass:R-R-O-R-R-R-O-R-',.85],['bass',BASE,2,'bass:R-RrO-R-R-RrO-5-',.9],['arp',BASE,0,'arp:0123432101234321',.5,{oct:12}],
   ['lead',INT1,0,'line:'+BATTLE_LEAD,.8],['bell',INT2,0,'line:'+BATTLE_LEAD,.32,{tr:12}],['brass',INT1,0,'chord:......x-......x-',.6,{voices:[1,2,3],oct:12}],
   ['kick',PERC,3,'drum:x.....x...x.....',.95],['kick',PERC,2,'drum:x.....x...x...x.',1],['snare',PERC,0,'drum:....x.......x...|....x..g....x...|....x.......x...|....x..g....x.g.|....x.......x...|....x..g....x...|....x.......x...|....x..g....xaxx',.8],
   ['hat',PERC,3,'drum:x.a.x.a.x.a.x.o.',.7],['hat',PERC,2,'drum:xgagxgagxgagxgo.',.75],['crash',INT2,0,'drum:X|.|.|.|.|.|.|.',.8],['tom',INT2,0,'line:r:124 e3:1 d3:1 b2:1 a2:1 r:124 e3:1 d3:1 b2:1 a2:1',.8],
   ['tick',TENS,5,'drum:X.a.X.a.X.a.X.a.',.8],['tick',TENS,4,'drum:XaXaXaXaXaXaXaXa',.85]],
  patch:{pad:{cut:850,q:.7,lfo:180,att:.25,sus:.85,rel:.45},bass:{cut:240,env:1300,q:3.5,fdec:.08,dec:.25,sus:.55,rel:.04},arp:{cut:1400,env:3200,q:2,fdec:.045,dec:.1},lead:{saw:.8,tri:.3,breath:0,cut:3400,att:.008,dec:.3,sus:.85,rel:.07,glide:.022,vib:20},
   bell:{ratio:2,index:1.4,dec:.4},brass:{cut:1300},wet:[.2,.07,.24,.28,.06],delay:{steps:3,fb:.34,send:.22},leadLayer:INT1,bellLayer:INT2}}};
function compile(id,src){const bars=src.bars,N=bars*16,step=60/src.bpm/4,chords=src.chords.map(chord),tracks=[],hum=i=>1-.07*((i*7919)%13)/13;
 if(chords.length!==bars)throw new Error('music: '+id+' needs '+bars+' chords');
 const add=(inst,layer,when,voiced)=>{const t={inst:INST[inst],layer,when,vel:new Float32Array(N),note:new Int16Array(N),len:new Uint8Array(N),voice:voiced?new Int8Array(N):null};tracks.push(t);return t;};
 for(const [inst,layer,when,spec,gain=1,opt={}] of src.tracks){const k=spec.indexOf(':'),kind=spec.slice(0,k),body=spec.slice(k+1);
  if(kind==='line'){const t=add(inst,layer,when,false);let i=0;for(const bar of body.split('|')){let sum=0;for(const tok of bar.trim().split(/\s+/)){const [n,l]=tok.split(':'),len=+l;if(n!=='r'){t.vel[i]=gain*hum(i);t.note[i]=midi(n)+(opt.tr||0);t.len[i]=len;}i+=len;sum+=len;}if(sum!==16&&body.includes('|')&&bars*16!==sum)throw new Error('music: '+id+' '+inst+' bar of '+sum+' steps');}
   if(i!==N)throw new Error('music: '+id+' '+inst+' line spans '+i+' of '+N+' steps');continue;}
  const pats=body.split('|'),voices=kind==='chord'?opt.voices||[0,1,2,3]:[0];
  voices.forEach((vk,pos)=>{const t=add(inst,layer,when,kind==='chord');
   for(let b=0;b<bars;b++){const p=pats[b%pats.length],c=chords[b];for(let s=0;s<16;s++){const ch=p[s]||'.',i=b*16+s;if(ch==='.'||ch==='-')continue;let len=1,note=0,v=VEL[ch]??.8;while(s+len<16&&p[s+len]==='-')len++;
    if(kind==='drum')note=ch==='o'||ch==='X'?1:0;
    else if(kind==='bass'){const u=ch.toUpperCase();note=c.bass+(u==='O'?12:u==='5'?7:u==='L'?-5:0);}
    else if(kind==='arp'){note=tone(c,+ch)+(opt.oct||0);v=s%4?.72:.9;}
    else if(kind==='chord')note=c.pad[vk]+(opt.oct||0);
    t.vel[i]=v*gain*hum(i);t.note[i]=note;t.len[i]=len;if(t.voice)t.voice[i]=opt.alt?pos+((b&1)<<2):pos;}}});}
 const uses=new Uint8Array(13),pcs=new Set();for(const t of tracks){uses[t.inst]=1;if(t.inst<=5||t.inst===11)for(let i=0;i<N;i++)if(t.vel[i]>0)pcs.add(t.note[i]%12);}
 return {id,bpm:src.bpm,step,pcs:[...pcs].sort((a,b)=>a-b),swingT:(src.swing||0)*step,bars,N,chords,tracks,uses,patch:src.patch,level:src.level,fadeIn:src.fadeIn,perc:src.perc??1};}
const SONGS={};for(const id in SONG_SRC)SONGS[id]=compile(id,SONG_SRC[id]);
// Stingers: 'step instrument note length velocity [release]' at 140 bpm 16ths. B brass, H brass triad, L bell, M boom, T timpani,
// C crash, W noise sweep (1 up, 0 down). Notes: absolute (c5), chord tone of the bar under the stinger (i4, i-1), chord root (r-12).
const SI={B:0,L:1,M:2,T:3,C:4,W:5,H:6},code=n=>n[0]==='i'?1100+(+n.slice(1)):n[0]==='r'?2100+(+n.slice(1)||0):/^\d+$/.test(n)?+n:midi(n);
function sting(src,pri,o={}){const ev=src.split(';').map(e=>e.trim().split(/\s+/)).map(([s,i,n,l,v,r])=>[+s,SI[i],code(n),+l,+v,r?+r:0]).sort((a,b)=>a[0]-b[0]),f=new Float32Array(ev.length*6);let end=0,busy=0;
 ev.forEach((e,k)=>{if(e[1]===undefined||e.some(Number.isNaN))throw new Error('music: bad stinger event '+e);f.set(e,k*6);end=Math.max(end,(e[0]+e[3])*STING_STEP+(e[5]||.4)*5);busy=Math.max(busy,e[0]+2);});return {f,pri,gain:o.gain??1,duck:o.duck??.55,fin:!!o.fin,end,busy,pcs:[...new Set(ev.filter(e=>e[1]!==4&&e[1]!==5&&e[2]<1000).map(e=>e[2]%12))].sort((a,b)=>a-b)};}
const LOST='0 L i6 2 .5;1 L i5 2 .45;2 L i3 2 .45;3 L i1 8 .5;3 H i0 6 .42;3 M r-12 8 .45';
const STINGS={
 'capture-own':sting('0 W 1 3 .18;0 L i4 2 .55;1 L i5 2 .55;2 L i6 2 .6;3 L i8 8 .7;3 H i4 6 .45',1),
 'capture-lost':sting(LOST,1),'capture-them':sting(LOST,1,{gain:.7,duck:.7}),
 'shield-enemy':sting('0 M r-12 16 1;0 C 0 16 .7;0 H i4 3 .6;3 H i4 3 .6;6 H i5 10 .75 .6;6 L i8 2 .5;8 L i10 2 .5;10 L i12 8 .6',3),
 'shield-ours':sting('0 M r-12 20 1;0 W 0 12 .35;0 H i0 8 .55;8 H i-1 12 .5 .8;2 L i3 4 .35;6 L i1 10 .35',3),
 'protector-enemy':sting('0 W 1 3 .12;0 L i11 1 .45;1 L i10 1 .45;2 L i9 1 .45;3 L i8 6 .5',2,{duck:.7}),
 'protector-ours':sting('0 M r-12 8 .4;0 L i6 2 .4;2 L i4 2 .35;4 L i1 8 .35',2,{duck:.7}),
 'exposed-enemy':sting('0 M r-12 16 1;0 C 0 16 .65;0 L i8 1 .45;1 L i9 1 .45;2 L i10 1 .45;3 L i11 1 .45;0 H i4 2 .6;2 H i4 2 .55;4 H i5 2 .6;6 H i6 10 .75 .7;6 L i12 10 .55',3),
 'exposed-ours':sting('0 M r-12 16 1;0 W 0 14 .35;0 H i0 4 .6;4 H i-1 4 .55;8 H i-2 10 .5 .8;8 L i2 8 .3',3),
 'evac-enemy':sting('0 M r-12 24 1;0 C 0 24 .85;0 H i4 10 .75;0 L i8 2 .55;2 L i10 2 .55;4 L i12 10 .65;12 H i5 14 .65 1',4,{duck:.45}),
 'evac-ours':sting('0 M r-12 24 1;0 C 0 20 .6;0 W 0 16 .45;0 H i0 6 .65;6 H i-1 6 .6;12 H i0 14 .6 1;4 L i6 2 .45;6 L i5 2 .45;8 L i6 2 .45;10 L i5 2 .45',4,{duck:.45}),
 victory:sting('0 T g2 1 .25;1 T g2 1 .35;2 T g2 1 .45;3 T g2 1 .55;4 T g2 1 .65;5 B g4 1 .6;6 B g4 1 .6;7 B g4 1 .65;8 M c2 12 .9;8 C 0 12 .5;8 B c5 6 .75;8 B e4 6 .5;8 B g3 6 .5;14 B e5 3 .7;17 B g5 3 .72;20 M c2 24 1;20 C 0 24 .8;20 B c6 28 .8 1.4;20 B e5 28 .6 1.4;20 B g4 28 .6 1.4;20 B c4 28 .55 1.4;21 L c6 2 .45;22 L e6 2 .45;23 L g6 2 .45;24 L c7 14 .55 1;30 L g6 16 .35 1.2;36 L e6 20 .3 1.5',5,{fin:true}),
 defeat:sting('9 M a1 24 .85;9 B a4 4 .6;9 B c4 12 .45;9 B e3 12 .45;13 B g4 4 .55;17 B e4 4 .55;21 B f4 8 .6;21 B a3 8 .45;21 B d3 8 .4;21 M f1 8 .5;29 B e4 28 .55 1.6;29 B c4 28 .45 1.6;29 B a3 28 .45 1.6;29 M a1 20 .7;9 L e5 8 .3;21 L c5 8 .28;29 L a4 24 .3 1.6',5,{fin:true}),
 stalemate:sting('4 M f1 16 .55;4 B a4 12 .5;4 B e4 12 .45;4 B c4 12 .45;4 B f3 12 .45;4 L b5 4 .32;8 L c6 4 .32;12 L b5 4 .32;16 M g1 16 .5;16 B d5 24 .48 1.6;16 B c5 24 .45 1.6;16 B g4 24 .45 1.6;16 B g3 24 .4 1.6;16 L d6 20 .28 1.6',5,{fin:true})};
// Read-only facts for tools and tests (loop lengths in seconds, stinger names, pitch classes of melodic parts and of
// absolute stinger notes; chord-relative stinger notes follow the bar under them).
export const MUSIC_INFO=Object.freeze({songs:Object.fromEntries(Object.values(SONGS).map(s=>[s.id,{bpm:s.bpm,bars:s.bars,loopSeconds:s.N*s.step,tracks:s.tracks.length,pitchClasses:s.pcs}])),stingers:Object.keys(STINGS),stingerPitchClasses:Object.fromEntries(Object.entries(STINGS).map(([k,v])=>[k,v.pcs]))});
function lcg(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return (s>>>1)/1073741824-1;};}
function noiseBuffer(A){const n=Math.floor(A.sampleRate*2),b=A.createBuffer(1,n,A.sampleRate),d=b.getChannelData(0),r=lcg(91);for(let i=0;i<n;i++)d[i]=r();return b;}
// Hall impulse: seeded decaying noise, darkening over its 2.4 s tail (one-pole low-pass), 12 ms pre-delay.
function impulse(A,sec){const sr=A.sampleRate,n=Math.floor(sr*sec),b=A.createBuffer(2,n,sr),pre=Math.floor(sr*.012);
 for(let c=0;c<2;c++){const d=b.getChannelData(c),r=lcg(c?7:3);let y=0;for(let i=pre;i<n;i++){const k=(i-pre)/(n-pre);y+=(.8-.62*k)*(r()-y);d[i]=y*Math.exp(-6.9*k);}}return b;}
export function createMusic(opts={}){
 const G=globalThis,timers=opts.timers||G,clock=opts.clock||(()=>G.performance?.now?.()??Date.now()),manual=opts.timer===false,cur=new Float32Array(LAYERS).fill(-1),tgt=new Float32Array(LAYERS);
 let C=null,ac=null,owned=false,built=false,enabled=true,volume=.5,base='off',battle='idle',finishMode=false,target,song=null,pend=false,pendId=null,pendAt=0,nextT=0,stepCount=0,lvl=0,evac=false,evacLeft=1e9,running=false,paused=false,zeroFrames=0,idle=false,timer=null,lastWall=0,gapMax=0,ahead=opts.ahead||AHEAD,aheadFloor=0,gesture=null,gestured=false,visible=null,warned=false,retryAt=0;
 let ticks=0,tickMs=0,tickMax=0,notes=0,created=0,stingCount=0,lastSting=null,nodes=[],srcs=[],N=null;
 const st={def:null,id:null,i:0,t0:0,dt:STING_STEP,gain:1,pri:0,end:0,busy:0,bass:45,n:3,list:new Int16Array(8)};
 const warn=err=>{if(!warned){warned=true;console.warn('Battle music failed:',err);}};
 function blocked(){const s=opts.search!==undefined?opts.search:G.location?.search;if(!s)return false;try{const q=new URLSearchParams(s);return q.has('test')&&q.get('music')!=='1';}catch{return false;}}
 const viewer=()=>{try{return C?.human?.team??0;}catch{return 0;}};
 function aliveOf(team){let n=0;try{const ps=C?.protectors?.();if(ps)for(let i=0;i<ps.length;i++)if(ps[i].team===team&&ps[i].hp>0)n++;}catch{}return n;}
 // ---------- graph (built once per enable; torn down by setEnabled(false)) ----------
 // Instrument outputs are "units": plugged into their bus only while the current song uses them (a chain that is not
 // connected to the destination costs no CPU in the browser), stinger voices only while a stinger is ringing.
 function build(){const A=ac,t0=A.currentTime;nodes=[];srcs=[];
  const g=(v,to)=>{const n=A.createGain();n.gain.value=v;nodes.push(n);if(to)n.connect(to);return n;};
  const flt=(type,f,q,to)=>{const n=A.createBiquadFilter();n.type=type;n.frequency.value=f;n.Q.value=q;nodes.push(n);if(to)n.connect(to);return n;};
  const osc=(type,f,to,det)=>{const n=A.createOscillator();n.type=type;n.frequency.value=f;if(det)n.detune.value=det;nodes.push(n);srcs.push(n);if(to)n.connect(to);n.start(t0);return n;};
  const pan=(p,to)=>{if(typeof A.createStereoPanner!=='function')return to;const n=A.createStereoPanner();n.pan.value=p;nodes.push(n);n.connect(to);return n;};
  const units=[],stingUnits=[],unit=(list,name,out,...dests)=>{list.push({name,out,dests,on:false,muted:Array.isArray(opts.mute)&&opts.mute.includes(name)});return out;};
  const lim=A.createDynamicsCompressor();nodes.push(lim);lim.threshold.value=-9;lim.knee.value=4;lim.ratio.value=12;lim.attack.value=.002;lim.release.value=.2;lim.connect(A.destination);
  const pauseLP=flt('lowpass',18000,.5,lim),pauseG=g(1,pauseLP),masterG=g(0,pauseG),mix=g(1,masterG);masterG.gain.setTargetAtTime(volume*MASTER,t0,.08);
  const conv=A.createConvolver();nodes.push(conv);conv.buffer=impulse(A,2.4);conv.connect(g(.9,mix));
  const loopDuck=g(1,mix),songDry=g(0,loopDuck),songWet=g(0,conv),layer=[],wet=[];for(let l=0;l<LAYERS;l++){layer[l]=g(0,songDry);wet[l]=g(.2,songWet);layer[l].connect(wet[l]);}
  const stingBus=g(STING_LV,mix);stingBus.connect(g(.32,conv));
  const nsrc=A.createBufferSource();nodes.push(nsrc);srcs.push(nsrc);nsrc.buffer=noiseBuffer(A);nsrc.loop=true;nsrc.start(t0);
  const nvoice=(list,name,type,f,q,level,p,dest)=>{const out=g(level),a=g(0,out),fl=flt(type,f,q,a);nsrc.connect(fl);unit(list,name,out,pan(p,dest));return {f:fl,a};};
  const fmv=(dest,p)=>{const a=g(0,pan(p,dest)),c=osc('sine',440,a),mi=g(0),m=osc('sine',880,mi);mi.connect(c.frequency);return {c,m,mi,a,until:0};};
  const drum=(list,name,level,p,dest)=>{const out=g(level),a=g(0,out);unit(list,name,out,pan(p,dest));return {o:osc('sine',50,a),a};};
  // pad: 8 voices in two sets of four (chord changes crossfade between sets), even/odd voices share a left/right filter
  const padOut=g(LV.pad),padDepth=g(220),padF=[flt('lowpass',1200,.6,pan(-.35,padOut)),flt('lowpass',1200,.6,pan(.35,padOut))],pad=[];osc('sine',.13,padDepth);padF.forEach(f=>padDepth.connect(f.frequency));
  for(let k=0;k<8;k++){const a=g(0,padF[k&1]);pad.push({o:osc('sawtooth',220,a,PADDET[k]),a});}
  const bassOut=g(LV.bass),ba=g(0,bassOut),bf=flt('lowpass',300,1,ba),bass={o1:osc('sawtooth',55,g(.75,bf)),o2:osc('sine',27.5,g(.4,bf)),f:bf,a:ba};
  const arpOut=g(LV.arp),arp=[];arp.rr=0;for(let k=0;k<3;k++){const a=g(0,pan([-.45,.45,0][k],arpOut)),f=flt('lowpass',1000,1,a);arp.push({o:osc('square',220,f),f,a,until:0});}
  const leadOut=g(LV.lead),rLead=[g(0,layer[BASE]),g(0,layer[INT1])];
  const la=g(0,leadOut),lf=flt('lowpass',3000,.8,la),m1=g(.8,lf),m2=g(.3,lf),mb=g(0,lf);nsrc.connect(flt('bandpass',1700,.9,mb));
  const vibD=g(0),lo1=osc('sawtooth',440,m1),lo2=osc('triangle',440,m2);osc('sine',5.4,vibD);vibD.connect(lo1.detune);vibD.connect(lo2.detune);
  const dSend=g(.25),d1=A.createDelay(1.5),d2=A.createDelay(1.5),fb1=g(.3),fb2=g(.3);nodes.push(d1,d2);la.connect(dSend);dSend.connect(d1);d1.connect(pan(-.65,leadOut));d1.connect(fb1);fb1.connect(d2);d2.connect(pan(.65,leadOut));d2.connect(flt('lowpass',2600,.5,fb2));fb2.connect(d1);
  const bellOut=g(LV.bell),rBell=[g(0,layer[BASE]),g(0,layer[INT2])],bell=[fmv(bellOut,-.3),fmv(bellOut,.3)];bell.rr=0;
  const brassOut=g(LV.brass),brassF=flt('lowpass',1200,1.2,brassOut),brass=[];for(let k=0;k<3;k++){const a=g(0,brassF);brass.push({o:osc('sawtooth',220,a,[-7,7,0][k]),a});}
  const snOut=g(LV.snare),snA=g(0,snOut),snN=g(0,snOut);nsrc.connect(flt('bandpass',1900,.7,snN));
  unit(units,'pad',padOut,layer[BASE]);unit(units,'bass',bassOut,layer[BASE]);unit(units,'arp',arpOut,layer[BASE]);unit(units,'lead',leadOut,rLead[0],rLead[1]);unit(units,'bell',bellOut,rBell[0],rBell[1]);unit(units,'brass',brassOut,layer[INT1]);
  const kick=drum(units,'kick',LV.kick,0,layer[PERC]);unit(units,'snare',snOut,pan(.08,layer[PERC]));
  const hat=nvoice(units,'hat','highpass',7200,.6,LV.hat,-.25,layer[PERC]),shaker=nvoice(units,'shaker','bandpass',5200,1.2,LV.shaker,.3,layer[PERC]),crash=nvoice(units,'crash','highpass',3200,.5,LV.crash,.15,layer[INT2]);
  const tom=drum(units,'tom',LV.tom,-.1,layer[INT2]),tick=nvoice(units,'tick','bandpass',2400,9,LV.tick,.2,layer[TENS]);
  const sbOut=g(LV.sbrass),sbrass=[];sbrass.rr=0;for(let k=0;k<5;k++){const a=g(0,pan([-.35,.35,-.15,.15,0][k],sbOut)),f=flt('lowpass',1400,1,a);sbrass.push({o:osc('sawtooth',220,f,[-7,7,-3,3,0][k]),f,a,until:0});}
  const slOut=g(LV.sbell),sbell=[fmv(slOut,-.4),fmv(slOut,.4),fmv(slOut,0)];sbell.rr=0;unit(stingUnits,'sbrass',sbOut,stingBus);unit(stingUnits,'sbell',slOut,stingBus);
  const boom=drum(stingUnits,'boom',LV.boom,0,stingBus),scrash=nvoice(stingUnits,'scrash','highpass',2800,.5,LV.scrash,-.1,stingBus),sweep=nvoice(stingUnits,'sweep','bandpass',400,2.5,LV.sweep,0,stingBus);
  units.forEach((u,i)=>{if(INST[u.name]!==i)throw new Error('music: unit order '+u.name);});
  N={masterG,pauseG,pauseLP,loopDuck,songDry,songWet,layer,wet,stingBus,pad,padF,padDepth,bass,arp,lead:{o1:lo1,o2:lo2,m1,m2,mb,f:lf,a:la,vibD,end:-1},dSend,d1,d2,fb1,fb2,rLead,rBell,bell,brass,brassF,
   kick,snare:{o:osc('triangle',190,snA),at:snA,an:snN},hat,shaker,crash,tom,tick,sbrass,sbell,boom,scrash,sweep,units,stingUnits,stingOn:false,sleepAt:0};
  N.loopV=[...pad.map(x=>x.a.gain),ba.gain,...arp.map(x=>x.a.gain),la.gain,...bell.map(x=>x.a.gain),...brass.map(x=>x.a.gain),kick.a.gain,snA.gain,snN.gain,hat.a.gain,shaker.a.gain,crash.a.gain,tom.a.gain,tick.a.gain];
  built=true;created+=nodes.length;cur.fill(-1);song=null;pend=false;target=undefined;if(paused)setPaused(true);sync(.2);}
 function plug(u,on){if(on===u.on||on&&u.muted)return;u.on=on;for(let i=0;i<u.dests.length;i++){if(on)u.out.connect(u.dests[i]);else u.out.disconnect(u.dests[i]);}}
 function plugged(){let n=0;if(N){for(const u of N.units)n+=u.on;for(const u of N.stingUnits)n+=u.on;}return n;}
 function teardown(){stopTimer();if(!built)return;const A=ac,t=A.currentTime,old=nodes,os=srcs,m=N.masterG.gain;m.cancelScheduledValues(t);m.setTargetAtTime(0,t,.015);for(let i=0;i<os.length;i++){try{os[i].stop(t+.12);}catch{}}
  nodes=[];srcs=[];N=null;built=false;song=null;pend=false;target=undefined;st.def=null;st.busy=0;cur.fill(-1);
  const free=()=>{for(const n of old){try{n.disconnect();}catch{}}if(owned&&!enabled&&A.state==='running'){idle=true;A.suspend?.()?.catch?.(()=>{});}};
  if(manual||typeof timers.setTimeout!=='function')free();else timers.setTimeout(free,200);}
 // ---------- voices: every note is automation on a persistent voice ----------
 function env(p,t,peak,att,dec,sus,end,rel){p.cancelScheduledValues(t);p.setTargetAtTime(peak,t,att);const td=t+att*3;if(end>td){if(sus!==1)p.setTargetAtTime(peak*sus,td,dec);p.setTargetAtTime(0,end,rel);}else p.setTargetAtTime(0,td,rel);}
 function setF(p,f,t){p.cancelScheduledValues(t);p.setValueAtTime(f,t);}
 function pick(pool,t){const n=pool.length;let best=null;for(let k=0;k<n;k++){const x=pool[(pool.rr+k)%n];if(x.until<=t){best=x;break;}if(!best||x.until<best.until)best=x;}pool.rr=(pool.indexOf(best)+1)%n;return best;}
 function fm(x,t,note,d,v,B,dec){const f=HZ[note],q=x.mi.gain;setF(x.c.frequency,f,t);setF(x.m.frequency,f*B.ratio,t);q.cancelScheduledValues(t);q.setTargetAtTime(f*B.index*(.6+.4*v),t,.001);q.setTargetAtTime(f*B.index*.12,t+.004,dec*.4);const e=t+Math.max(d,.08)+dec*2.5;env(x.a.gain,t,v,.0015,dec,0,e,.12);x.until=e;}
 function trig(inst,vi,t,note,d,v){notes++;const P=song.patch;switch(inst){
  case 0:{const x=N.pad[vi<0?0:vi],p=P.pad;setF(x.o.frequency,HZ[note],t);env(x.a.gain,t,v,p.att,.8,p.sus,t+d,p.rel);break;}
  case 1:{const x=N.bass,p=P.bass,q=x.f.frequency;setF(x.o1.frequency,HZ[note],t);setF(x.o2.frequency,HZ[note]/2,t);q.cancelScheduledValues(t);q.setTargetAtTime(p.cut+p.env*v,t,.003);q.setTargetAtTime(p.cut,t+.01,p.fdec);env(x.a.gain,t,v,.003,p.dec,p.sus,t+d*.9,p.rel);break;}
  case 2:{const x=pick(N.arp,t),p=P.arp,q=x.f.frequency,e=t+Math.max(d,p.dec*4);setF(x.o.frequency,HZ[note],t);q.cancelScheduledValues(t);q.setTargetAtTime(p.cut+p.env*v,t,.002);q.setTargetAtTime(p.cut,t+.006,p.fdec);env(x.a.gain,t,v,.002,p.dec,0,e,.05);x.until=e+.15;break;}
  case 3:{const x=N.lead,p=P.lead,f=HZ[note],q1=x.o1.frequency,q2=x.o2.frequency,vd=x.vibD.gain;q1.cancelScheduledValues(t);q2.cancelScheduledValues(t);
   if(x.end>0&&t-x.end<.03){q1.setTargetAtTime(f,t,p.glide);q2.setTargetAtTime(f,t,p.glide);}else{q1.setValueAtTime(f,t);q2.setValueAtTime(f,t);}
   vd.cancelScheduledValues(t);vd.setTargetAtTime(0,t,.04);if(d>.28)vd.setTargetAtTime(p.vib,t+.2,.25);env(x.a.gain,t,v,p.att,p.dec,p.sus,t+d*.94,p.rel);x.end=t+d;break;}
  case 4:fm(pick(N.bell,t),t,note,d,v,P.bell,P.bell.dec);break;
  case 5:{const x=N.brass[vi<0?0:vi],q=N.brassF.frequency;setF(x.o.frequency,HZ[note],t);q.cancelScheduledValues(t);q.setTargetAtTime(P.brass.cut*2.2,t,.02);q.setTargetAtTime(P.brass.cut,t+.08,.12);env(x.a.gain,t,v,.008,.12,.6,t+d*.85,.06);break;}
  case 6:{const x=N.kick,q=x.o.frequency;q.cancelScheduledValues(t);q.setValueAtTime(155,t);q.setTargetAtTime(47,t+.001,.03);env(x.a.gain,t,v,.0012,.14,0,t+.5,.05);break;}
  case 7:{const x=N.snare,q=x.o.frequency;q.cancelScheduledValues(t);q.setValueAtTime(260,t);q.setTargetAtTime(180,t,.03);env(x.at.gain,t,v*.6,.001,.05,0,t+.25,.03);env(x.an.gain,t,v,.001,.1,0,t+.4,.03);break;}
  case 8:env(N.hat.a.gain,t,v,.0008,note?.16:.022,0,t+(note?.8:.15),.02);break;
  case 9:env(N.shaker.a.gain,t,v,.006,.04,0,t+.2,.02);break;
  case 10:env(N.crash.a.gain,t,v,.0015,.8,0,t+3.2,.2);break;
  case 11:{const x=N.tom,q=x.o.frequency;q.cancelScheduledValues(t);q.setValueAtTime(HZ[note]*1.6,t);q.setTargetAtTime(HZ[note],t,.03);env(x.a.gain,t,v,.001,.17,0,t+.7,.05);break;}
  case 12:{const x=N.tick,q=x.f.frequency;q.cancelScheduledValues(t);q.setValueAtTime(note?2900:2050,t);env(x.a.gain,t,v,.0005,.022,0,t+.12,.01);break;}}}
 const stone=c=>c>=2000?st.bass+c-2100:c>=1000?st.list[((c-1100)%st.n+st.n)%st.n]+12*Math.floor((c-1100)/st.n):c;
 function sbr(t,note,d,v,rel){const x=pick(N.sbrass,t),q=x.f.frequency,f=HZ[note],r=rel||.14;setF(x.o.frequency,f,t);q.cancelScheduledValues(t);q.setTargetAtTime(Math.min(6000,f*7),t,.03);q.setTargetAtTime(Math.min(4000,f*3.5),t+.12,.25);env(x.a.gain,t,v,.018,.3,.7,t+d,r);x.until=t+d+r*4;}
 function sfire(inst,t,c,d,v,rel){switch(inst){
  case 0:sbr(t,stone(c),d,v,rel);break;
  case 6:for(let k=0;k<3;k++)sbr(t,stone(c+k),d,k?v*.85:v,rel);break;
  case 1:fm(pick(N.sbell,t),t,stone(c),d,v,SBELL,rel||SBELL.dec);break;
  case 2:case 3:{const x=N.boom,f=HZ[stone(c)],q=x.o.frequency,timp=inst===3;q.cancelScheduledValues(t);q.setValueAtTime(f*(timp?1.25:1.8),t);q.setTargetAtTime(f,t,timp?.02:.05);env(x.a.gain,t,v,.002,timp?.22:Math.max(.3,d*.4),0,t+(timp?.7:d*1.5+.4),.12);break;}
  case 4:env(N.scrash.a.gain,t,v,.002,Math.max(.4,d*.45),0,t+d*2+.4,.25);break;
  case 5:{const x=N.sweep,q=x.f.frequency,p=x.a.gain;q.cancelScheduledValues(t);if(c){q.setValueAtTime(320,t);q.setTargetAtTime(5200,t,d/2.2);p.cancelScheduledValues(t);p.setTargetAtTime(v,t,d/2.5);p.setTargetAtTime(0,t+d,.03);}
   else{q.setValueAtTime(3600,t);q.setTargetAtTime(200,t,d/2.5);env(p,t,v,.01,d/2.5,0,t+d*1.6,.1);}break;}}}
 // ---------- scheduler ----------
 function cond(w){const late=evac&&evacLeft<30;switch(w){case 1:return lvl>=1;case 2:return lvl>=2;case 3:return lvl<2;case 4:return late;case 5:return !late;}return true;}
 function layers(t,beat){const L=tgt;if(song.id==='battle'){L[BASE]=1;L[PERC]=running&&stepCount>=32?1:0;L[INT1]=lvl>=1?evac?.7:1:0;L[INT2]=lvl>=2?1:0;L[TENS]=evac?1:0;}else{L[BASE]=1;L[PERC]=song.perc;L[INT1]=L[INT2]=L[TENS]=0;}
  for(let l=beat?TENS:0;l<LAYERS;l++)if(L[l]!==cur[l]){const p=N.layer[l].gain;p.cancelScheduledValues(t);p.setTargetAtTime(L[l],t,cur[l]<0?.01:L[l]>cur[l]?.12:.5);cur[l]=L[l];}}
 function step(i,t){const S=song,bi=i%S.N,tr=S.tracks,tt=bi&1?t+S.swingT:t;for(let k=0;k<tr.length;k++){const x=tr[k],v=x.vel[bi];if(v<=0||x.when&&!cond(x.when))continue;trig(x.inst,x.voice?x.voice[bi]:-1,tt,x.note[bi],x.len[bi]*S.step,v);}}
 function patch(S,T){const P=S.patch,set=(p,v)=>{p.cancelScheduledValues(T);p.setTargetAtTime(v,T,.03);};
  for(const f of N.padF){set(f.frequency,P.pad.cut);set(f.Q,P.pad.q);}set(N.padDepth.gain,P.pad.lfo);set(N.bass.f.Q,P.bass.q);for(const x of N.arp)set(x.f.Q,P.arp.q);
  const L=N.lead;set(L.m1.gain,P.lead.saw);set(L.m2.gain,P.lead.tri);set(L.mb.gain,P.lead.breath);set(L.f.frequency,P.lead.cut);
  set(N.rLead[0].gain,P.leadLayer===BASE?1:0);set(N.rLead[1].gain,P.leadLayer===INT1?1:0);set(N.rBell[0].gain,P.bellLayer===BASE?1:0);set(N.rBell[1].gain,P.bellLayer===INT2?1:0);
  for(let l=0;l<LAYERS;l++)set(N.wet[l].gain,P.wet[l]);const dt=P.delay.steps*S.step;set(N.d1.delayTime,dt);set(N.d2.delayTime,dt);set(N.fb1.gain,P.delay.fb);set(N.fb2.gain,P.delay.fb);set(N.dSend.gain,P.delay.send);}
 function doSwitch(id,T){const V=N.loopV;for(let i=0;i<V.length;i++){V[i].cancelScheduledValues(T);V[i].setTargetAtTime(0,T,.015);}N.lead.end=-1;song=id?SONGS[id]:null;N.sleepAt=T+.15;if(!song)return;for(let i=0;i<N.units.length;i++)if(song.uses[i])plug(N.units[i],true);
  patch(song,T);const sd=N.songDry.gain,sw=N.songWet.gain;sd.cancelScheduledValues(T);sw.cancelScheduledValues(T);sd.setTargetAtTime(song.level,T,song.fadeIn);sw.setTargetAtTime(song.level,T,song.fadeIn);cur.fill(-1);stepCount=0;nextT=T;}
 function wantId(){return battle==='battle'?'battle':battle==='finish'&&!finishMode?null:base==='title'||base==='explore'?base:null;}
 // Crossfade policy: the playing song fades out (tau), then the next one starts on its own bar 1 (no overlap, no voice clash).
 function sync(tau){const id=wantId();if(id===target)return;target=id;if(!built)return;wake();const now=ac.currentTime;
  if(!song){pend=true;pendId=id;if(pendAt<now+.05||pendAt>now+.5)pendAt=now+.05;return;}
  const sd=N.songDry.gain,sw=N.songWet.gain;sd.cancelScheduledValues(now);sw.cancelScheduledValues(now);sd.setTargetAtTime(0,now,tau);sw.setTargetAtTime(0,now,tau);pend=true;pendId=id;pendAt=now+tau*4;}
 function wake(){if(owned&&ac&&idle){idle=false;ac.resume?.()?.catch?.(()=>{});}}
 function setPaused(p){paused=p;if(!built)return;const t=ac.currentTime,gp=N.pauseG.gain,fp=N.pauseLP.frequency;gp.cancelScheduledValues(t);fp.cancelScheduledValues(t);gp.setTargetAtTime(p?.3:1,t,p?.12:.25);fp.setTargetAtTime(p?900:18000,t,p?.12:.3);}
 function poll(){const c=C;if(!c)return;let p=false;try{p=c.paused===true||zeroFrames>2&&c.playing===true;}catch{}if(p!==paused)setPaused(p);if(battle!=='battle')return;
  try{const s=c.combat?.state;if(!s)return;let L=0;for(let t=0;t<2;t++)if(s.shields[t]<=0)L=Math.max(L,aliveOf(t)?1:2);lvl=L;evac=s.phase==='evacuation';evacLeft=evac?(s.evacuationEnds??s.time)-s.time:1e9;running=evac||s.phase==='running';}catch{}}
 function playSting(id){const S=STINGS[id];if(!S||!built||!enabled)return false;const now=ac.currentTime;if(now<st.busy&&S.pri<=st.pri)return false;wake();
  let t0=now+.03;const sb=N.stingBus.gain;sb.cancelScheduledValues(now);sb.setTargetAtTime(STING_LV,now,.02);
  if(song){const g=2*song.step,o=nextT-stepCount*song.step;t0=o+Math.ceil((now+.03-o)/g)*g;const si=Math.round((t0-o)/song.step),c=song.chords[(si%song.N+song.N)%song.N>>4];st.list.set(c.list);st.n=c.n;st.bass=c.bass;}
  else{st.list[0]=57;st.list[1]=60;st.list[2]=64;st.n=3;st.bass=45;}
  if(!N.stingOn){N.stingOn=true;for(const u of N.stingUnits)plug(u,true);}st.def=S;st.id=id;st.i=0;st.t0=t0;st.dt=S.fin||!song?STING_STEP:song.step;st.gain=S.gain;st.pri=S.pri;st.end=t0+S.end;st.busy=t0+S.busy*st.dt;
  if(song&&!S.fin){const d=N.loopDuck.gain;d.cancelScheduledValues(t0);d.setTargetAtTime(S.duck,t0,.05);d.setTargetAtTime(1,st.busy+.3,.5);}stingCount++;lastSting=id;stings(now);return true;}
 function stings(now){const D=st.def.f,lim=now+ahead;while(st.i<D.length){const s=st.t0+D[st.i]*st.dt;if(s>=lim)break;sfire(D[st.i+1],s,D[st.i+2],D[st.i+3]*st.dt,D[st.i+4]*st.gain,D[st.i+5]);st.i+=6;}if(st.i>=D.length)st.def=null;}
 function stopSting(tau){st.def=null;st.busy=0;st.pri=0;if(!built)return;const t=ac.currentTime,p=N.stingBus.gain;st.end=Math.min(st.end,t+tau*6);p.cancelScheduledValues(t);p.setTargetAtTime(0,t,tau);}
 function tick(){if(!built||!enabled||!ac)return;const w0=clock();
  try{if(!manual){const gap=lastWall?(w0-lastWall)/1000:0;lastWall=w0;gapMax=Math.max(gap,gapMax*.97);ahead=Math.min(1.6,Math.max(AHEAD,gapMax*1.25+.05,aheadFloor));}
   poll();if(owned&&ac.state!=='running'){if(!idle&&ac.state!=='closed'&&w0>=retryAt){retryAt=w0+2000;ac.resume?.()?.catch?.(()=>{});}return;}const now=ac.currentTime;
   if(pend&&now+ahead>=pendAt){pend=false;doSwitch(pendId,Math.max(pendAt,now+.02));}
   if(song){if(nextT<now-.25)while(nextT<now+.03){nextT+=song.step;stepCount++;}
    const lim=pend?Math.min(now+ahead,pendAt):now+ahead;while(nextT<lim){const b=stepCount&15;if(!b||!(b&3))layers(nextT,!!b);step(stepCount,nextT);stepCount++;nextT+=song.step;}}
   if(st.def)stings(now);
   if(N.sleepAt&&now>=N.sleepAt){N.sleepAt=0;for(let i=0;i<N.units.length;i++)if(!song||!song.uses[i])plug(N.units[i],false);}
   if(N.stingOn&&!st.def&&now>st.end){N.stingOn=false;for(const u of N.stingUnits)plug(u,false);}
   if(owned&&!song&&!pend&&!st.def&&now>st.end+2&&battle!=='battle'&&ac.state==='running'){idle=true;ac.suspend?.()?.catch?.(()=>{});}}
  catch(err){warn(err);}finally{const ms=clock()-w0;ticks++;tickMs+=ms;if(ms>tickMax)tickMax=ms;}}
 function startTimer(){if(manual||timer||typeof timers.setInterval!=='function')return;timer=timers.setInterval(tick,TICK_MS);}
 function stopTimer(){if(timer!==null){timers.clearInterval?.(timer);timer=null;}}
 function listen(){const d=G.document;if(visible||!d?.addEventListener)return;visible=()=>{aheadFloor=d.hidden?1.6:0;if(d.hidden){gapMax=Math.max(gapMax,1.25);tick();}};d.addEventListener('visibilitychange',visible);}
 // Fallback unlock on user gestures (the shell also calls unlock()); listeners go away once audio runs. Gesture ends count
 // too: iPhone Safari only lets touchend / pointerup / click start audio.
 const GESTURES=['pointerdown','keydown','touchstart','pointerup','touchend','click'];
 function armGesture(){if(gesture||blocked()||typeof G.addEventListener!=='function')return;gesture=()=>{gestured=true;if(!enabled)return;if(!ac||ac.state!=='running'&&!idle)unlock();if(ac?.state==='running'){for(const k of GESTURES)G.removeEventListener(k,gesture,true);}};
  for(const k of GESTURES)G.addEventListener(k,gesture,true);}
 function unlock(){if(!enabled||blocked())return false;try{
   if(!ac){if(opts.context){ac=opts.context;owned=false;}else{const AC=opts.AudioContext||G.AudioContext||G.webkitAudioContext;if(typeof AC!=='function')return false;ac=new AC();owned=true;}}
   if(owned&&ac.state!=='running'&&ac.state!=='closed'){idle=false;ac.resume?.()?.catch?.(()=>{});}
   if(!built)build();startTimer();listen();return true;}catch(err){warn(err);return false;}}
 return {name:'music',
  attach(c){C=c||C;armGesture();},
  started(c){C=c||C;battle='battle';finishMode=false;lvl=0;evac=false;evacLeft=1e9;running=true;stopSting(.2);sync(.25);},
  event(e,c){if(!e||battle!=='battle')return;C=c||C;const v=viewer();
   if(e.type==='capture')playSting(e.team===v?'capture-own':e.from===v?'capture-lost':'capture-them');
   else if(e.type==='shield-collapse')playSting(e.team===v?'shield-ours':'shield-enemy');
   else if(e.type==='protector-down'){const left=aliveOf(e.team);playSting(e.team===v?left?'protector-ours':'exposed-ours':left?'protector-enemy':'exposed-enemy');}
   else if(e.type==='evacuate')playSting(Array.isArray(e.doomedTeams)&&e.doomedTeams.includes(v)?'evac-ours':'evac-enemy');},
  render(dt,c){zeroFrames=dt===0?zeroFrames+1:0;if(c)C=c;},
  finished(s,c){C=c||C;if(battle==='finish')return;const v=s?.viewerTeam??viewer(),o=s?.outcome||(s?.winner===-1?'stalemate':s?.winner===v?'victory':'defeat');battle='finish';finishMode=false;sync(.35);st.busy=0;playSting(o==='victory'||o==='stalemate'?o:'defeat');},
  reset(){if(battle==='idle')return;battle='idle';stopSting(.15);sync(.3);},
  stopped(){battle='idle';stopSting(.3);sync(.4);},
  unlock,tick,
  setMode(m){if(m!=='title'&&m!=='explore'&&m!=='off')return base;base=m;if(battle==='finish')finishMode=true;sync(.5);return base;},
  setEnabled(on){on=!!on;if(on===enabled)return enabled;enabled=on;if(!on)teardown();else if(ac||gestured||G.navigator?.userActivation?.hasBeenActive)unlock();return enabled;},
  setVolume(v){volume=Math.max(0,Math.min(1,Number(v)||0));if(built){const p=N.masterG.gain,t=ac.currentTime;p.cancelScheduledValues(t);p.setTargetAtTime(volume*MASTER,t,.06);}return volume;},
  sting:playSting,
  get enabled(){return enabled;},get volume(){return volume;},get mode(){return base;},get context(){return ac;},
  snapshot:()=>({enabled,blocked:blocked(),state:ac?ac.state:'locked',built,mode:base,battle,song:song?.id||null,target:target??null,pending:pend?pendId:false,layers:Array.from(cur),intensity:lvl,evacuation:evac,paused,
   sting:st.def?st.id:null,lastSting,stings:stingCount,notes,nodes:nodes.length,plugged:plugged(),created,ticks,tickMs:ticks?tickMs/ticks:0,tickMaxMs:tickMax,ahead,volume,idle})};
}
