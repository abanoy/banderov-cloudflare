// Separate eight-view character study from the owner's lower-left pencil figure.
// Eyepatch belongs to ANATOMICAL RIGHT: screen-left front, visible right profile.
// Owner direction: brown hair, dark coat and patch. Exact shades/back details provisional; never mirror a finished view.
import {DIRECTIONS} from './chibi8.js';
export const COAT_LAD={name:'Eyepatch & long-coat study',hair:'#684339',skin:'#f0d2b8',iris:'#7c9c91',coat:'#354c48',lining:'#a98c61',shirt:'#e6d7b9',boots:'#36313a',patch:'#282b34',ink:'#2b2930',outline:2.3,whiteBorder:3.6};
// face ellipse, visible LEFT eye, RIGHT patch, mouth, fringe (12 points),
// two independently authored side locks, body centre/width, arms and boots.
export const COAT_VIEWS=[
 {face:[80,77,52,45],eye:[105,84,12,8],patch:[54,85,14,18],mouth:[81,106,5],front:1,back:0,cx:80,width:1,
 fringe:[25,69,39,64,50,48,62,42,75,60,67,91,86,70,98,40,109,57,122,65,137,53,133,83],
 locks:[[28,56,41,75,35,109,21,144,24,111,20,88],[122,56,132,75,128,111,145,138,119,125,119,100]],
 arms:[[[60,130],[53,157],[60,182]],[[101,130],[107,158],[100,182]]],boots:[[66,256,10,12],[95,256,10,12]]},
 {face:[94,79,40,43],eye:[120,84,8,7],patch:[82,85,13,18],mouth:[105,106,4],front:.85,back:.15,cx:86,width:.87,
 fringe:[27,71,46,63,67,48,74,40,91,59,88,93,103,72,110,45,121,61,130,65,139,57,135,85],
 locks:[[51,58,61,76,57,108,46,141,46,116,45,89],[126,58,134,75,130,107,145,133,128,125,126,99]],
 arms:[[[70,130],[64,157],[70,181]],[[102,132],[114,160],[106,185]]],boots:[[74,254,9,12],[104,256,11,12]]},
 {face:[125,82,27,40],eye:[135,85,0,0],patch:[124,86,10,15],mouth:[131,107,3],front:.34,back:.66,cx:88,width:.62,
 fringe:[26,74,47,64,83,49,102,42,118,65,116,95,128,76,126,53,136,65,139,71,140,67,137,88],
 locks:[[92,59,103,75,99,105,88,137,88,113,86,86],[134,68,136,82,137,98,144,122,137,114,133,90]],
 arms:[[[79,131],[75,155],[81,178]],[[97,131],[109,160],[103,185]]],boots:[[83,254,10,12],[107,256,12,12]]},
 {face:[134,82,0,0],eye:[135,85,0,0],patch:[137,86,0,0],mouth:[135,106,0],front:0,back:1,cx:85,width:.88,
 fringe:[27,94,39,98,49,100,61,103,73,105,80,108,88,106,99,103,112,100,123,97,132,93,134,90],
 locks:[[29,60,42,77,38,109,20,143,25,111,23,87],[125,58,135,77,132,105,148,135,125,126,123,102]],
 arms:[[[67,130],[56,158],[62,183]],[[102,130],[109,156],[102,180]]],boots:[[72,256,10,12],[102,254,9,12]]},
 {face:[80,79,0,0],eye:[56,85,0,0],patch:[82,86,0,0],mouth:[80,106,0],front:0,back:1,cx:80,width:1,
 fringe:[26,95,37,99,48,102,60,105,70,108,80,111,92,108,103,105,114,101,124,99,133,94,134,90],
 locks:[[27,57,38,74,35,107,17,138,29,129,28,98],[123,58,135,78,131,111,144,145,119,129,123,97]],
 arms:[[[60,130],[52,157],[59,181]],[[101,130],[108,157],[102,184]]],boots:[[65,256,10,12],[96,256,10,12]]},
 {face:[26,81,0,0],eye:[25,85,0,0],patch:[20,86,0,0],mouth:[25,106,0],front:0,back:1,cx:75,width:.88,
 fringe:[26,92,36,96,47,100,59,104,72,107,82,110,93,107,105,104,116,100,124,97,132,94,134,90],
 locks:[[28,57,39,73,37,104,18,135,30,126,29,99],[123,59,137,76,133,109,149,144,122,129,127,96]],
 arms:[[[59,130],[51,156],[58,180]],[[93,130],[104,159],[97,184]]],boots:[[59,254,9,12],[89,256,10,12]]},
 {face:[34,82,28,40],eye:[36,85,12,8],patch:[23,86,0,0],mouth:[30,107,3],front:.35,back:.65,cx:72,width:.62,
 fringe:[24,84,26,70,36,61,42,48,49,68,45,94,59,72,67,50,88,64,107,68,125,68,135,85],
 locks:[[26,60,36,77,32,106,18,133,30,123,29,97],[68,58,81,75,76,109,64,141,80,129,79,98]],
 arms:[[[63,131],[51,160],[58,185]],[[81,131],[85,155],[79,178]]],boots:[[52,256,12,12],[77,254,10,12]]},
 {face:[67,79,40,43],eye:[77,84,13,8],patch:[32,85,7,15],mouth:[60,106,4],front:.85,back:.15,cx:74,width:.87,
 fringe:[25,77,28,66,41,56,47,41,59,62,53,93,74,72,85,43,101,62,116,67,135,56,135,84],
 locks:[[29,58,37,75,33,108,18,136,29,124,28,101],[103,58,119,76,118,110,136,144,119,119,111,96]],
 arms:[[[58,132],[46,160],[53,185]],[[90,130],[96,157],[90,181]]],boots:[[56,256,11,12],[85,254,9,12]]}
];
const n=x=>Math.round(x*1000)/1000,clamp=x=>Math.max(0,Math.min(1,x));
function mix(a,b,t){if(Array.isArray(a))return a.map((v,i)=>mix(v,b[i],t));if(typeof a==='number')return a+(b-a)*t;return Object.fromEntries(Object.keys(a).map(k=>[k,mix(a[k],b[k],t)]));}
export function coatViewAt(angle){if(!Number.isFinite(angle))throw new TypeError('Direction must be finite');const yaw=(angle%8+8)%8,i=Math.floor(yaw);return mix(COAT_VIEWS[i],COAT_VIEWS[(i+1)%8],yaw-i);}
// Circular fillets rather than cubic or quadratic Bezier geometry.
function rounded(points,r=2){const a=Array.from({length:points.length/2},(_,i)=>points.slice(i*2,i*2+2));let d='';for(let i=0;i<a.length;i++){const q=a[i],p=a[(i+a.length-1)%a.length],t=a[(i+1)%a.length],u=[p[0]-q[0],p[1]-q[1]],v=[t[0]-q[0],t[1]-q[1]],ul=Math.hypot(...u),vl=Math.hypot(...v);if(ul<.001||vl<.001){d+=(i?'L':'M')+q.map(n).join(' ');continue;}const theta=Math.acos(Math.max(-.99999,Math.min(.99999,(u[0]*v[0]+u[1]*v[1])/(ul*vl)))),distance=Math.min(r/Math.tan(theta/2),ul*.35,vl*.35),radius=distance*Math.tan(theta/2),before=[q[0]+u[0]/ul*distance,q[1]+u[1]/ul*distance],after=[q[0]+v[0]/vl*distance,q[1]+v[1]/vl*distance];d+=(i?'L':'M')+before.map(n).join(' ')+`A${n(radius)} ${n(radius)} 0 0 ${u[0]*v[1]-u[1]*v[0]<0?1:0} `+after.map(n).join(' ');}return d+'Z';}
let serial=0;
export function coatChibiSVG(character={},angle=0){
 const c={...COAT_LAD,...character},v=coatViewAt(angle),id='coat'+(++serial),ink=c.ink,w=c.outline,f=clamp(v.front),back=clamp(v.back),cx=v.cx,bodyWidth=v.width;
 const stride=c.walking?Math.sin((c.walkPhase??0)*Math.PI*2):0,side=Math.sin(angle*Math.PI/4),bob=-Math.abs(stride);
 const path=(d,fill='none',width=w,stroke=ink,extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${n(width)}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
 const poly=(p,fill,r=2,width=w,extra='')=>path(rounded(p,r),fill,width,ink,extra);
 const oval=(a,fill,width=w,extra='')=>`<ellipse cx="${n(a[0])}" cy="${n(a[1])}" rx="${n(Math.max(0,a[2]))}" ry="${n(Math.max(0,a[3]))}" fill="${fill}" stroke="${ink}" stroke-width="${n(width)}" ${extra}/>`;
 const headBase=(fill,width=w)=>oval([80,69,53,51],fill,width),headClip='<ellipse cx="80" cy="69" rx="53" ry="51"/>';
 const outline=[];
 const boots=v.boots.map((a,i)=>{const dx=stride*(i?1:-1)*side*7,lift=Math.max(0,stride*(i?1:-1))*6,x=a[0]+dx,y=a[1]-lift;const boot=poly([x-7,y-35,x+7,y-35,x+7,y-8,x+a[2]+2,y+7,x+a[2]+2,y+12,x-a[2],y+12,x-7,y-5],c.boots,3);outline.push(boot);return boot+path(`M${n(x-6)} ${n(y-30)}H${n(x+6)}M${n(x-6)} ${n(y-25)}H${n(x+6)}`, 'none',1,c.lining);});
 const sway=stride*2.5,coat=poly([cx-20*bodyWidth,122,cx+20*bodyWidth,122,cx+18*bodyWidth,164,cx+29*bodyWidth+sway,216,cx+15*bodyWidth+sway,220,cx,205,cx-14*bodyWidth+sway,220,cx-29*bodyWidth+sway,216,cx-18*bodyWidth,164],c.coat,3);outline.push(coat);
 const arms=v.arms.map((points,i)=>{const [s,e,h]=points,dx=stride*(i?1:-1)*side*2;const arm=path(`M${s[0]} ${s[1]}L${n(e[0]+dx)} ${e[1]}L${n(h[0]+dx)} ${h[1]}`,'none',14,ink)+path(`M${s[0]} ${s[1]}L${n(e[0]+dx)} ${e[1]}L${n(h[0]+dx)} ${h[1]}`,'none',10,c.coat)+oval([h[0]+dx,h[1]+4,5,6],c.skin);outline.push(arm);return arm;});
 let body=boots.join('')+arms.join('')+coat;
 const frontWidth=bodyWidth*f;
 if(f>.001){
  body+=poly([cx-9*frontWidth,123,cx+9*frontWidth,123,cx+10*frontWidth,177,cx,196,cx-10*frontWidth,177],c.shirt,1,1.1);
  body+=poly([cx-19*frontWidth,123,cx-5*frontWidth,134,cx-11*frontWidth,147,cx,161,cx-19*frontWidth,148],c.lining,1,1.1);
  body+=poly([cx+19*frontWidth,123,cx+5*frontWidth,134,cx+11*frontWidth,147,cx,161,cx+19*frontWidth,148],c.lining,1,1.1);
  body+=path(`M${n(cx)} 161V204`,'none',1.1);
  for(const y of [155,169,182])body+=oval([cx+4*frontWidth,y,1.5*f,1.5],c.lining,.7);
  body+=path(`M${n(cx-20*frontWidth)} 184L${n(cx-12*frontWidth)} 181M${n(cx+12*frontWidth)} 181L${n(cx+20*frontWidth)} 184`,'none',1.2,c.lining);
 }
 if(back>.01)body+=`<g opacity="${n(back)}">`+path(`M${n(cx)} 130V204M${n(cx-17*bodyWidth)} 165H${n(cx+17*bodyWidth)}`,'none',1.2)+oval([cx,165,2,2],c.lining,1)+'</g>';
 // Hands rest in front of the coat; visibility belongs to each authored side.
 const handDepth=[[1,1],[.3,1],[0,1],[0,1],[0,0],[1,0],[1,0],[1,.3]],yaw=(angle%8+8)%8;
 const visibility=mix(handDepth[Math.floor(yaw)],handDepth[(Math.floor(yaw)+1)%8],yaw%1);
 v.arms.forEach((points,i)=>{const h=points[2],dx=stride*(i?1:-1)*side*2,t=visibility[i];if(t>.01)body+=oval([h[0]+dx,h[1]+3,5*t,6*t],c.skin,w*t);});
 const locks=v.locks.map(p=>poly(p,c.hair,1.6));const tuft=poly([65,22,58,7,67,14,77,6,76,18,91,15,79,27],c.hair,1.2);outline.push(...locks,headBase(c.hair),tuft);
 let head=locks.join('')+headBase(c.hair)+`<g clip-path="url(#${id}-head)">`;
 head+=oval(v.face,c.skin,0)+`<g clip-path="url(#${id}-face)">`;
 const [px,py,pw,ph]=v.patch;
 if(pw>.01&&ph>.01){
  head+=path(`M${n(px-pw*2.2)} ${n(py+ph*.9)}L${n(px+pw*3.5)} ${n(py-ph*.8)}`,'none',2.5,c.patch);
  head+=poly([px-pw,py-ph*.7,px+pw*.95,py-ph*.25,px+pw*.7,py+ph*.55,px-pw*.45,py+ph*.8,px-pw,py+ph*.2],c.patch,3,1.8,'data-anatomical="right-eye-patch"');
  head+=path(`M${n(px-pw*.52)} ${n(py-ph*.28)}L${n(px+pw*.45)} ${n(py)}L${n(px-pw*.22)} ${n(py+ph*.4)}`,'none',.9,c.lining);
 }
 const [ex,ey,ew,eh]=v.eye;
 if(ew>.01&&eh>.01){
  if(c.expression==='happy')head+=path(`M${n(ex-ew)} ${ey}A${n(ew)} ${n(eh)} 0 0 1 ${n(ex+ew)} ${ey}`,'none',2);
  else if(c.expression==='shocked')head+=oval([ex,ey,ew*.65,eh*1.2],'#fffdf2',1.4);
  else{const eye=`M${n(ex-ew)} ${n(ey-3)}L${n(ex+ew)} ${n(ey-6)}A${n(ew)} ${n(eh+4)} 0 0 1 ${n(ex-ew)} ${n(ey-3)}Z`;head+=`<clipPath id="${id}-eye"><path d="${eye}"/></clipPath>`+path(eye,'#fffdf2',1.4)+`<g clip-path="url(#${id}-eye)">`+oval([ex+1,ey,4.2,6],c.iris,1)+'</g>'+path(`M${n(ex-ew-1)} ${n(ey-3)}L${n(ex+ew+1)} ${n(ey-6)}`,'none',2);}
  head+=path(`M${n(ex-ew*.8)} ${n(ey-12)}L${n(ex+ew*.8)} ${n(ey-9)}`,'none',1.1);
 }
 const [mx,my,mw]=v.mouth;if(mw>.01)head+=c.expression==='happy'?path(`M${n(mx-mw)} ${my}A${n(mw)} 4 0 0 0 ${n(mx+mw)} ${my}`,'none',1.5):path(`M${n(mx-mw)} ${n(my+2)}L${mx} ${n(my-2)}L${n(mx+mw)} ${n(my+2)}`,'none',1.4);
 head+='</g>';
 const reverse=[];for(let i=v.fringe.length-2;i>=0;i-=2)reverse.push(v.fringe[i],v.fringe[i+1]);
 const cap='M0 -10H160V145L'+reverse.map(n).join(' ')+'L0 145Z';
 head+=path(cap,c.hair,0);
 // Open fringe path keeps only the lower hair edge, clipped to the skin.
 head+=`<g clip-path="url(#${id}-face)">`+path('M'+Array.from({length:v.fringe.length/2},(_,i)=>v.fringe.slice(i*2,i*2+2).map(n).join(' ')).join('L'),'none',w*Math.min(1,f*3))+'</g>';
 head+='</g>'+headBase('none')+tuft;
 const silhouette=outline.join('').replace(/fill="([^"]*)"/g,(_,fill)=>`fill="${fill==='none'?'none':'#fffdf8'}"`).replace(/stroke="[^"]*"/g,'stroke="#fffdf8"').replace(/stroke-width="([^"]*)"/g,(_,width)=>`stroke-width="${n(Number(width)+c.whiteBorder*2)}"`);
 let guides='';if(c.construction)guides=`<g opacity=".7">${oval([80,69,53,51],'none',1).replaceAll(ink,'#139ba9')}${path(`M80 18V120M27 84H133M${cx} 124V220`,'none',1,'#139ba9')}</g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 160 292" width="160" height="292" data-foot-y="268" data-renderer="coat-chibi-1" data-direction="${n((angle%8+8)%8)}" data-eye-patch-side="anatomical-right" role="img" aria-label="Eyepatch coat study ${DIRECTIONS[Math.round((angle%8+8)%8)%8]}"><defs><clipPath id="${id}-head">${headClip}</clipPath><clipPath id="${id}-face"><ellipse cx="${v.face[0]}" cy="${v.face[1]}" rx="${Math.max(0,v.face[2])}" ry="${Math.max(0,v.face[3])}"/></clipPath></defs><g transform="translate(0 ${n(bob)})">${silhouette}${body}${head}${guides}</g></svg>`;
}
