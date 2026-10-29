/* Geometric Bunnywoman. Browser classic script + Node side-effect import.
 * All visible parts are native ellipses, rounded rectangles, polygons or
 * elliptical-arc lenses. No contour samples, Bezier curves or raster media.
 * The two ears have independent parameters; this is one front reference pose.
 */
(()=>{
 const BASE=Object.freeze({headWidth:1,bodyLength:1,earFold:1});
 const PARTS=Object.freeze({
   scalp:{x:133,y:159,rx:91,ry:80},face:{x:127,y:166,rx:63,ry:61},
   bang:{x1:72,y1:151,x2:187,y2:105,upper:49,lower:15},
   ears:[{x:80,y:106,length:59,width:22,angle:-18,fold:43,bend:58},
         {x:174,y:85,length:78,width:24,angle:35,fold:32,bend:-53}],
   eyes:[{x:96,y:160,rx:9,ry:10,tilt:17},{x:155,y:154,rx:9,ry:11,tilt:26}],
   arms:[{x:94,y:257,rx:8,ry:19,angle:48},{x:165,y:246,rx:7,ry:18,angle:-46}],
   legs:[{x:120,y:317,rx:13,ry:25,angle:-13},{x:142,y:317,rx:13,ry:25,angle:13}]
 });
 const n=x=>Number(x.toFixed(3));
 const attrs=o=>Object.entries(o).map(([k,v])=>`${k}="${v}"`).join(' ');
 const el=(type,o)=>`<${type} ${attrs(o)}/>`;
 const ellipse=(p,fill,stroke='#372a36',sw=1.8)=>el('ellipse',{cx:p.x,cy:p.y,rx:p.rx,ry:p.ry,fill,stroke,'stroke-width':sw,...(p.angle?{transform:`rotate(${p.angle} ${p.x} ${p.y})`}:{})});
 // Two half-ellipse arcs sharing a chord make a tapered lens.
 function lens(x1,y1,x2,y2,upper,lower){const d=Math.hypot(x2-x1,y2-y1),a=Math.atan2(y2-y1,x2-x1)*180/Math.PI;return `M${x1} ${y1}A${n(d/2)} ${upper} ${n(a)} 0 1 ${x2} ${y2}A${n(d/2)} ${lower} ${n(a)} 0 1 ${x1} ${y1}Z`;}
 function geometricBunnySVG(options={}){
   const c={...BASE,...options};
   for(const [key,lo,hi] of [['headWidth',.9,1.1],['bodyLength',.85,1.1],['earFold',.65,1.25]]){
     if(!Number.isFinite(c[key]))throw new TypeError(`${key} must be finite`);
     c[key]=Math.max(lo,Math.min(hi,c[key]));
   }
   const colour=c.finish!=='ink',ink='#372a36',p={hair:'#82503f',skin:'#f4c8b1',ear:'#fff0d5',inside:'#dda0a2',cloth:'#68466e',legs:'#59455d',tongue:'#e995a3'};
   const paint=k=>colour?`url(#geo-${k})`:'white';
   const path=(d,fill='none',sw=1.8,stroke=ink)=>el('path',{d,fill,stroke,'stroke-width':sw});
   let defs='';
   if(colour){for(const [id,x1,y1,x2,y2,stops] of [
     ['hair',60,80,205,230,['#b57b57',p.hair,'#503640']],['skin',85,120,180,230,['#ffe7cd',p.skin,'#e7a69e']],
     ['ear',0,-75,0,0,['#fffaf0',p.ear,'#dbbdb0']],['cloth',107,224,154,313,['#966a94',p.cloth,'#3e2d49']],
     ['legs',120,291,140,345,['#806780',p.legs,'#392c42']]])defs+=`<linearGradient id="geo-${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop stop-color="${stops[0]}"/><stop offset=".55" stop-color="${stops[1]}"/><stop offset="1" stop-color="${stops[2]}"/></linearGradient>`;}
   let parts=[],guides=[];
   const add=(name,markup,guide=markup)=>{parts.push(`<g data-part="${name}">${markup}</g>`);guides.push(guide);};
   // Ears: an upright rounded shaft and a separately rotated oval fold.
   PARTS.ears.forEach((e,i)=>{
     const bend=e.bend*c.earFold,w=e.width,L=e.length,fold=e.fold;
     const earFill=colour?p.ear:'white';
     const shaft=el('rect',{x:-w/2,y:-L,width:w,height:L+9,rx:w/2,fill:earFill,stroke:ink,'stroke-width':1.8});
     const tip=el('rect',{x:-w/2,y:-w/2,width:w,height:fold+w/2,rx:w/2,fill:earFill,stroke:ink,'stroke-width':1.8,transform:`translate(0 ${-L+w/2}) rotate(${bend})`});
     const join=ellipse({x:0,y:-L+w/2,rx:w/2-.7,ry:w/2-.7},earFill,'none',0);
     const inner=colour?el('rect',{x:-w*.2,y:-L+w*.9,width:w*.4,height:L-w*.7,rx:w*.2,fill:p.inside,stroke:'none'}):path(`M${-w*.2} -8V${-L+w}A${w*.2} ${w*.2} 0 0 1 ${w*.2} ${-L+w}V-8`,'none',.9);
     add('ear-'+i,`<g transform="translate(${e.x} ${e.y}) rotate(${e.angle})">${shaft}${tip}${join}${inner}</g>`);
   });
   const scalpD='M51 194A91 80 0 1 1 215 194L224 215L240 226A65 24 0 0 1 175 233L96 233A64 26 0 0 1 31 226L49 210Z';
   add('back-hair',path(scalpD,paint('hair')),ellipse(PARTS.scalp,'none')+path('M51 194L31 226L96 233M215 194L240 226L175 233'));
   // Body transforms share a neck pivot. Head and ears remain unchanged.
   let body='';
   PARTS.legs.forEach(l=>body+=ellipse(l,paint('legs')));
   PARTS.arms.forEach(a=>body+=ellipse(a,paint('skin')));
   // Six anchors and two semicircular sides define the tapered outfit.
   const torsoD='M108 224H151L150 252A41 41 0 0 0 148 278L163 298A46 25 0 0 1 101 298L112 278A45 45 0 0 0 106 252Z';
   body+=path(torsoD,paint('cloth'));
   if(colour){defs+=`<clipPath id="geo-body"><path d="${torsoD}"/></clipPath>`;body+=`<g clip-path="url(#geo-body)" opacity=".25">${ellipse({x:150,y:273,rx:19,ry:45,angle:18},'#2e203b','none',0)}${ellipse({x:115,y:258,rx:5,ry:25,angle:-10},'#e2b3ce','none',0)}</g>`;}
   body+=path('M119 230L126 245A5 5 0 0 0 131 243L136 230','none',1.8,colour?'#f4d9af':ink)+path('M127 232V239','none',1.3,colour?'#f4d9af':ink);
   add('body',`<g transform="translate(0 224) scale(1 ${c.bodyLength}) translate(0 -224)">${body}</g>`);
   let face=ellipse(PARTS.face,paint('skin'));
   defs+=`<clipPath id="geo-face">${ellipse(PARTS.face,'white','none',0)}</clipPath>`;
   if(colour)face+=`<g clip-path="url(#geo-face)">${ellipse({x:137,y:122,rx:64,ry:25,angle:-24},'#c28784','none',0).replace('/>',' opacity=".3"/>')}${ellipse({x:90,y:178,rx:10,ry:5},'#e89099','none',0).replace('/>',' opacity=".24"/>')}${ellipse({x:163,y:173,rx:10,ry:5},'#e89099','none',0).replace('/>',' opacity=".24"/>')}</g>`;
   // Eyes are rotated ellipses with round iris/pupil, clipped by their own white.
   PARTS.eyes.forEach((e,i)=>{
     const transform=`translate(${e.x} ${e.y}) rotate(${e.tilt})`;
     defs+=`<clipPath id="geo-eye-${i}"><ellipse rx="${e.rx}" ry="${e.ry}"/></clipPath>`;
     defs+=`<clipPath id="geo-lid-${i}"><path d="M-20 -6L20 -1V20H-20Z"/></clipPath>`;
     face+=`<g transform="${transform}"><g clip-path="url(#geo-lid-${i})">${ellipse({x:0,y:0,rx:e.rx,ry:e.ry},colour?'#fffbf0':'white',ink,1.3)}<g clip-path="url(#geo-eye-${i})">${ellipse({x:2,y:4,rx:5,ry:7},colour?'#719d88':ink,'none',0)}${ellipse({x:3,y:5,rx:2,ry:4},ink,'none',0)}${ellipse({x:1,y:0,rx:1.4,ry:2},'white','none',0)}</g></g>${path(`M${-e.rx-3} -5L${e.rx+3} -2`,'none',2)}${path(`M${e.rx+1} -2L${e.rx+5} 5`,'none',1.35)}</g>`;
   });
   face+=path('M105 145L112 149M143 140L150 136','none',1.6);
   face+=path('M128 170L132 175L131 178','none',1.3,colour?'#a66b6b':ink);
   face+=el('rect',{x:125,y:199,width:12,height:18,rx:5,fill:colour?p.tongue:'white',stroke:ink,'stroke-width':1.7});
   face+=path('M130 203V210','none',1,colour?'#ac5f77':ink);
   face+=path('M110 192A20 12 0 0 0 146 192','none',2.1);
   // Right temple is an ellipse arc band, left strand a tapered lens.
   const rightLock=path('M176 104A65 72 0 0 1 170 221A45 77 0 0 0 176 104Z',paint('hair'));
   const leftLock=path(lens(69,121,15,184,12,4),paint('hair'),1.7);
   const b=PARTS.bang,bangD=lens(b.x1,b.y1,b.x2,b.y2,b.upper,b.lower);
   let hair=rightLock+leftLock+path(bangD,paint('hair'));
   if(colour){defs+=`<clipPath id="geo-bang"><path d="${bangD}"/></clipPath>`;hair+=`<g clip-path="url(#geo-bang)" opacity=".3">${ellipse({x:126,y:112,rx:43,ry:7,angle:-22},'#f3c591','none',0)}</g>`;}
   hair+=path('M97 138A108 70 0 0 1 135 101','none',1,colour?'#65404a':ink);
   add('head',`<g transform="translate(127 0) scale(${c.headWidth} 1) translate(-127 0)">${face}${hair}</g>`);
   let art=parts.join('');
   if(c.guides){
     const wire=guides.join('').replace(/fill="[^"]*"/g,'fill="none"').replace(/stroke="[^"]*"/g,'stroke="#009a9a"').replace(/stroke-width="[^"]*"/g,'stroke-width=".65"');
     art+=`<g data-construction="true" opacity=".8" stroke-dasharray="3 2">${wire}${path('M127 80V343M40 166H218M93 224H170','none',.65,'#009a9a')}</g>`;
   }
   return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="370" viewBox="0 -10 256 370" data-renderer="bunny-geometric-1" role="img" aria-label="Bunnywoman geometric construction"><defs>${defs}</defs><g stroke-linejoin="round" stroke-linecap="round">${art}</g></svg>`;
 }
 globalThis.BunnyGeometry=Object.freeze({BASE,PARTS,geometricBunnySVG,lens});
})();
