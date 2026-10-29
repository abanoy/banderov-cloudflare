// Exact owner procedural SVG helpers from supplied Greybox, isolated copy.
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const INK="#231a2e";
  const ST=`stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
  const shape=(d,fill,extra="")=>`<path data-c d="${d}" fill="${fill}" ${ST} ${extra}/>`;
  const sw=w=>`stroke-width="${w}"`;
  const EYES={
    round:(x,c)=>`<ellipse cx="${x}" cy="99" rx="11.5" ry="15" fill="#fff" ${ST}/><ellipse cx="${x}" cy="101" rx="8.5" ry="12" fill="${c.iris}"/><ellipse cx="${x}" cy="103" rx="4.5" ry="7" fill="${INK}"/><circle cx="${x-4}" cy="94" r="4" fill="#fff"/><circle cx="${x+4}" cy="107" r="2" fill="#fff"/><path d="M${x-13} 91 Q${x} 79 ${x+13} 91" fill="none" ${ST} stroke-width="4.5"/>`,
    lidded:(x,c)=>{const s=x<100?1:-1;return `<path d="M${x-12} 93 L${x+12} 93 L${x+11} 106 Q${x} 113 ${x-11} 106 Z" fill="#fff" ${ST}/><path d="M${x-7+s*2} 94 L${x+7+s*2} 94 L${x+6+s*2} 105 Q${x+s*2} 110 ${x-6+s*2} 105 Z" fill="${c.iris}"/><ellipse cx="${x+s*2}" cy="101" rx="3.4" ry="5" fill="${INK}"/><circle cx="${x+s*2-3}" cy="97" r="2.2" fill="#fff"/><path d="M${x-s*15} 87 L${x+s*15} 93" fill="none" ${ST} stroke-width="5"/>`;},
  };
  const MOUTHS={pout:`<path d="M93 123 Q100 117 107 123" fill="none" ${ST}/>`,flat:`<path d="M92 121 L108 121" fill="none" ${ST}/>`};
  const arm=(side,sleeve,o={})=>{const x=side<0?70:130,len=o.short?16:34,w=o.wide?11:8;return `<g class="arm"><path data-c d="M${x-8} 144 q8 -6 16 0 l${w-8} ${len} q-${w} 6 -${w*2} 0 Z" fill="${sleeve}" ${ST}/><circle data-c cx="${x}" cy="181" r="9" fill="${o.skin}" ${ST}/></g>`;};
  const legs=(leg,shoe,o={})=>`<g><rect data-c x="80" y="186" width="15" height="32" rx="7" fill="${leg}" ${ST}/><rect data-c x="105" y="186" width="15" height="32" rx="7" fill="${leg}" ${ST}/><ellipse data-c cx="85" cy="222" rx="13" ry="8" fill="${shoe}" ${ST}/><ellipse data-c cx="115" cy="222" rx="13" ry="8" fill="${shoe}" ${ST}/></g>`;
  const blush=`<g><ellipse cx="62" cy="115" rx="9" ry="5" fill="#ff8fa3" opacity=".38"/><ellipse cx="138" cy="115" rx="9" ry="5" fill="#ff8fa3" opacity=".38"/></g>`;
  const TONES={
    csgloss:`<radialGradient id="csgloss"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
    csdrop:`<radialGradient id="csdrop"><stop offset="0" stop-color="#170d24" stop-opacity=".62"/><stop offset=".55" stop-color="#170d24" stop-opacity=".3"/><stop offset="1" stop-color="#170d24" stop-opacity="0"/></radialGradient>`,
  };
  const hslOf=hex=>{const h=hex.length<6?hex.slice(1).replace(/./g,"$&$&"):hex.slice(1),[r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;return d<.001?[0,0,l]:[60*(mx===r?((g-b)/d+6)%6:mx===g?(b-r)/d+2:(r-g)/d+4),d/(1-Math.abs(2*l-1)),l];};
  const hexOf=(h,s,l)=>{s=clamp(s,0,1);l=clamp(l,0,1);const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,"0");};return "#"+f(0)+f(8)+f(4);};
  function tones(col){let[h,s,l]=hslOf(col);const grey=s<.12,pale=clamp((l-.6)/.22,0,1);if(grey){h=250;s=.1;}return [hexOf(h,s*.9,l+(1-l)*.24),hexOf(h,s*(1.15-pale*.07)+.1-pale*.06,l*(.74+pale*(grey?.08:.13)))];}
  function tone(col,face){const id=(face?"ch":"cg")+col.slice(1).toLowerCase();if(!TONES[id]){const[hi,lo]=tones(col);TONES[id]=`<linearGradient id="${id}" x1=".38" y1="0" x2=".62" y2="1"><stop offset="0" stop-color="${face?col:hi}"/><stop offset="${face?.6:.42}" stop-color="${col}"/><stop offset="1" stop-color="${lo}"/></linearGradient>`;}return `url(#${id}) ${col}`;}
  function faceShade(skin){const id="cf"+skin.slice(1).toLowerCase();if(!TONES[id]){const[h,s,l]=hslOf(skin),c=hexOf(h,s*1.05+.06,l*.7);TONES[id]=`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".2" stop-color="${c}" stop-opacity=".42"/><stop offset=".57" stop-color="${c}" stop-opacity="0"/></linearGradient>`;}return `url(#${id})`;}
  const bare=s=>s.replace(/<(path|rect|circle|ellipse)( data-c)?([^>]*?)\/>/g,(m,tag,dc,at)=>dc?`<${tag}${at.replace(/ (fill|stroke[-\w]*)="[^"]*"/g,"")}/>`:"");
  const airbrush=(s,face)=>s.replace(/(<\w+ data-c [^>]*?fill=")(#[0-9a-f]{3,6})"/gi,(m,a,col)=>a+tone(col,face)+'"');
  const GLOSS=[[66,54,4.5,11,26],[84,46,6,12,10],[131,52,4.5,10,-22]];
  const streak=([x,y,rx,ry,r])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="url(#csgloss)"/>`;
  const CHIBIS={
    maria:{skin:"#f6dccb",hair:"#2a3048",iris:"#ff8a3c",main:"#6a4f9a",eyes:"lidded",mouth:"pout",
      back:c=>shape("M34 86 Q30 24 100 22 Q170 24 166 86 L171 116 L188 138 L160 131 Q150 139 138 133 L62 133 Q50 139 40 131 L12 138 L29 116 Z",c.hair),
      body:c=>legs("#3a2f55","#2a2238")+shape("M72 138 Q100 128 128 138 L136 192 Q100 202 64 192 Z",c.main)+shape("M90 136 L100 164 L110 136 Z","#fff",sw(2.4)),
      arms:c=>arm(-1,c.main,c)+arm(1,c.main,c),
      front:c=>shape("M40 90 Q38 30 100 28 Q162 30 160 90 L151 74 L142 98 L128 70 L114 88 L104 108 L97 84 L86 70 L74 98 L62 74 L49 96 Z",c.hair)+shape("M99 28 Q88 -4 114 -8 Q134 -9 131 10 Q121 0 112 9 Q106 16 109 29 Z",c.hair)},
    unimpressed:{gloss:[...GLOSS,[141,12,4,7,30]],skin:"#f0c9a8",hair:"#3b2c33",iris:"#7d8494",main:"#8d93a3",eyes:"lidded",mouth:"flat",
      back:c=>shape("M34 86 Q30 24 100 22 Q170 24 166 86 L170 126 Q152 138 136 128 L64 128 Q48 138 30 126 Z",c.hair)+`<circle data-c cx="148" cy="18" r="19" fill="${c.hair}" ${ST}/>`,
      body:c=>legs("#5a6070","#2a2a33")+shape("M74 136 Q100 126 126 136 L142 196 Q100 208 58 196 Z",c.main),
      arms:c=>arm(-1,c.main,c)+arm(1,c.main,c),
      front:c=>shape("M42 92 Q40 32 100 30 Q160 32 158 92 L150 70 Q132 52 110 60 L98 90 L90 62 Q62 58 50 78 Z",c.hair)},
  };
  function chibiBody(kind){const c=own(CHIBIS,kind)?CHIBIS[kind]:CHIBIS.maria,xs=[76,124];
    const eyes=xs.map(x=>EYES[c.eyes](x,c)).join(""),mouth=MOUTHS[c.mouth];
    const under=c.back(c)+c.body(c)+c.arms(c),skin=`<ellipse data-c cx="100" cy="90" rx="58" ry="52" fill="${c.skin}" ${ST}/>`,front=c.front(c);
    const rim=`<g fill="#fff" stroke="#fff" stroke-width="11.5" stroke-linejoin="round">${bare(under+skin+front)}</g>`;
    return rim+airbrush(under)+`<ellipse cx="100" cy="145" rx="37" ry="15" fill="url(#csdrop)"/>`+airbrush(skin,true)+`<ellipse cx="100" cy="90" rx="58" ry="52" fill="${faceShade(c.skin)}"/>`+blush+eyes+mouth+airbrush(front)+(c.gloss||GLOSS).map(streak).join("");}
  function chibiSVG(kind,costume){const inner=chibiBody(kind);
    return `<svg viewBox="-30 -34 260 274" xmlns="http://www.w3.org/2000/svg"><defs>${Object.values(TONES).join("")}</defs>${inner}${costume||""}</svg>`;}
  // a BACK view generated from the same engine: back-hair + body + arms + an all-hair head (no face)
  function chibiBackSVG(kind,costume){const c=own(CHIBIS,kind)?CHIBIS[kind]:CHIBIS.maria;
    const under=c.back(c)+c.body(c)+c.arms(c);
    const head=`<ellipse data-c cx="100" cy="86" rx="60" ry="55" fill="${c.hair}" ${ST}/>`;
    const rim=`<g fill="#fff" stroke="#fff" stroke-width="11.5" stroke-linejoin="round">${bare(under+head)}</g>`;
    const inner=rim+airbrush(under)+airbrush(head)+(c.gloss||GLOSS).map(streak).join("");
    return `<svg viewBox="-30 -34 260 274" xmlns="http://www.w3.org/2000/svg"><defs>${Object.values(TONES).join("")}</defs>${inner}${costume||""}</svg>`;}

export function ownerChibi(back=false){return (back?chibiBackSVG('maria',''):chibiSVG('maria','')).replace('-30 -34 260 274','-30 -34 260 266');}
