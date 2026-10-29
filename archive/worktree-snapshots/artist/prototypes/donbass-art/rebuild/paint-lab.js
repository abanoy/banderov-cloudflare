import {chibi8SVG,MARIA} from './chibi8.js';
export const MATERIALS=['hair','skin','cloth','collar','tie','legs','shoes','iris'];
const palette=(hair,skin,cloth,collar,tie,legs,shoes,iris,ink)=>({hair,skin,cloth,collar,tie,legs,shoes,iris,ink});
export const LOOKS={
 lacquer:{name:'Candy lacquer',tag:'Glossy hair · satin cloth',paper:'#e9ddec',light:'#fff3c3',shadow:'#753365',mode:'gloss',colors:palette('#b4536b','#f8d0bf','#eee6fc','#715d9e','#f59579','#675a8c','#814d76','#63a6b5','#422b4a')},
 velvet:{name:'Candlelit velvet',tag:'Amber light · wine shadows',paper:'#e4d6c7',light:'#ffdb87',shadow:'#392944',mode:'velvet',colors:palette('#6c392c','#eabd9f','#79384c','#b88753','#d6ad70','#453141','#513048','#b6985b','#30212b')},
 neon:{name:'Midnight arcade',tag:'Cyan edge · violet glow',paper:'#212039',light:'#82f5ef',shadow:'#cf48ba',mode:'neon',colors:palette('#373967','#bf9abc','#415881','#59e2d7','#ed6dab','#3c315d','#684273','#a3f1e6','#25213b')},
 porcelain:{name:'Gilded porcelain',tag:'Ivory glaze · blue & gold',paper:'#dce4e5',light:'#fffce0',shadow:'#6686ac',mode:'gloss',colors:palette('#c2b584','#f4dece','#e9f2f6','#47769c','#b69243','#426386','#b99b50','#719cab','#3c5666')},
 print:{name:'Printed pop',tag:'Two inks · halftone grain',paper:'#f0dfaa',light:'#ffe697',shadow:'#b04463',mode:'print',colors:palette('#b44d65','#f2c995','#f8e3ac','#416c7b','#c95065','#415b70','#a54b62','#4e8490','#433443')},
 gouache:{name:'Soft gouache',tag:'Matte paint · broken colour',paper:'#dae0d1',light:'#eee7c2',shadow:'#5c6f78',mode:'gouache',colors:palette('#966c52','#e8c5ae','#e1dac1','#668879','#c78364','#61716f','#726258','#72958b','#4d5148')}
};
export const mix=(hex,target,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-t)+parseInt(target.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
let serial=0;
// Unique temporary material colours identify regions even when a user assigns
// the same final colour to hair and clothes. Never infer regions from brightness.
export function paintLabSVG({look='lacquer',direction=0,outfit='whiteBlouse',expression='neutral',strength=.65,lightAngle=315,overrides={}}={}){
 const style=LOOKS[look]??LOOKS.lacquer,colors={...style.colors};
 for(const k of MATERIALS)if(/^#[0-9a-f]{6}$/i.test(overrides[k]??''))colors[k]=overrides[k];
 const power=Math.max(0,Math.min(1,Number.isFinite(strength)?strength:.65)),angle=(Number.isFinite(lightAngle)?lightAngle:315)*Math.PI/180;
 const x=.5+Math.cos(angle)*.5,y=.5+Math.sin(angle)*.5,id='lab'+(++serial);let defs='';
 const sentinels=Object.fromEntries(MATERIALS.map((key,i)=>[key,'#'+(0x010101+i*0x010101).toString(16).padStart(6,'0')]));
 let svg=chibi8SVG({...MARIA,...sentinels,ink:colors.ink,outfit,expression},direction);
 for(const key of MATERIALS){
  const base=colors[key],ref=id+'-'+key,skin=key==='skin',fabric=key==='cloth'||key==='collar';
  const shade=mix(base,skin&&style.mode!=='neon'?'#ad6674':style.shadow,power*(skin?.32:.7));
  const shine=mix(base,style.light,power*(key==='hair'?.85:.65));
  const stop=(offset,color)=>`<stop offset="${offset}" stop-color="${color}"/>`;
  // One hair paint space across scalp, fringe, tuft and side locks.
  const linear=stops=>`<linearGradient id="${ref}" ${key==='hair'?'gradientUnits="userSpaceOnUse"':''} x1="${key==='hair'?26+x*108:x}" y1="${key==='hair'?20+y*108:y}" x2="${key==='hair'?26+(1-x)*108:1-x}" y2="${key==='hair'?20+(1-y)*108:1-y}">${stops}</linearGradient>`;
  if(key==='iris'||power===0){svg=svg.replaceAll(sentinels[key],base);continue;}
  if(style.mode==='print'){
   defs+=`<pattern id="${ref}" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${base}"/><circle cx="1.4" cy="1.4" r="${power*.9}" fill="${shade}"/><path d="M3 5L5 3" stroke="${shine}" stroke-width=".7"/></pattern>`;
  }else if(style.mode==='gouache'){
   defs+=`<pattern id="${ref}" width="11" height="9" patternUnits="userSpaceOnUse"><rect width="11" height="9" fill="${base}"/><path d="M1 2L6 1M6 7L10 6" stroke="${shine}" stroke-width="1.3" stroke-linecap="round" opacity=".55"/><path d="M1 6L4 5M8 3L10 2" stroke="${shade}" stroke-width=".8" opacity=".3"/></pattern>`;
  }else if(style.mode==='neon'){
   defs+=linear(stop(0,shine)+stop(.13,shine)+stop(.28,base)+stop(.67,base)+stop(.88,shade)+stop(1,mix(base,'#ff76d2',power)));
  }else if(style.mode==='gloss'&&(key==='hair'||key==='shoes')){
   defs+=linear(stop(0,shade)+stop(.16,base)+stop(.29,shine)+stop(.37,shine)+stop(.45,base)+stop(.85,shade)+stop(1,base));
  }else if(fabric&&style.mode==='gloss'){
   defs+=linear(stop(0,shine)+stop(.45,base)+stop(.63,base)+stop(.64,shade)+stop(1,shade));
  }else{
   defs+=`<radialGradient id="${ref}" ${key==='hair'?'gradientUnits="userSpaceOnUse"':''} cx="${key==='hair'?26+(x*.65+.175)*108:x*.65+.175}" cy="${key==='hair'?20+(y*.65+.175)*108:y*.65+.175}" r="${key==='hair'?97.2:.9}">${stop(0,shine)+stop(.52,base)+stop(1,shade)}</radialGradient>`;
  }
  svg=svg.replaceAll(`fill="${sentinels[key]}"`,`fill="url(#${ref})"`);
  if(key==='hair')svg=svg.replaceAll(`stroke="${sentinels[key]}"`,`stroke="url(#${ref})"`);
  svg=svg.replaceAll(sentinels[key],base);
 }
 return svg.replace('<defs>','<defs>'+defs).replace('data-renderer="',`data-paint-look="${look in LOOKS?look:'lacquer'}" data-renderer="`);
}
// Coarse representative swatches, not semantic character/material recognition.
export function referenceSwatches(rgba,max=10){
 const bins=new Map();for(let i=0;i<rgba.length;i+=16){if(rgba[i+3]<180)continue;const rgb=[rgba[i],rgba[i+1],rgba[i+2]],hi=Math.max(...rgb),lo=Math.min(...rgb);if(hi-lo<18&&(hi>225||hi<48))continue;const key=rgb.map(v=>v>>4).join(',');const b=bins.get(key)??{n:0,sum:[0,0,0]};b.n++;rgb.forEach((v,j)=>b.sum[j]+=v);bins.set(key,b);}
 const out=[];for(const b of [...bins.values()].sort((a,b)=>b.n-a.n)){const rgb=b.sum.map(v=>Math.round(v/b.n));if(out.some(c=>Math.hypot(...rgb.map((v,i)=>v-c.rgb[i]))<45))continue;out.push({rgb,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),count:b.n});if(out.length===max)break;}return out;
}
