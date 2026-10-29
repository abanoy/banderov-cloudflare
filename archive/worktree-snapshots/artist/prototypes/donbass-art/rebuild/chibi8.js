// Flat paper chibi rebuild. Native circles/ellipses, lines and circular fillets.
// Angle index: 0 front, 1 front-right, 2 right, 3 back-right, 4 back,
// 5 back-left, 6 left, 7 front-left. No reflected finished drawings.
// Coordinates use one 160 x 294 canvas, y=-6..288; soles rest at y=272.732.
export const DIRECTIONS=['Front','Front-right','Right','Back-right','Back','Back-left','Left','Front-left'];
export const MARIA={name:'Brown Maria',hair:'#815022',skin:'#f3dfc5',iris:'#3889bd',ink:'#282324',cloth:'#fffdf4',collar:'#195e73',tie:'#d95947',legs:'#303d4d',shoes:'#302a3c',whiteBorder:4,outline:2.6,outfit:'sailor',expression:'neutral',pose:'relaxed'};
export const PROPORTIONS={source:'proportion-target.png / figure 2',crown:39,chin:204,waist:258,hips:305,crotch:330,knee:398,ankle:480,sole:499,headHeight:165,headWidth:162,waistWidth:56,hipWidth:98,kneeWidth:44,ankleWidth:34};
// Body height is compressed about the neckline; head and hair keep their own scale.
export const BODY_SCALE=.85;
export const referenceY=y=>20+(y-PROPORTIONS.crown)*108/PROPORTIONS.headHeight;
const p=(...xy)=>xy;
// Equal-length semantic contours permit optional continuous interpolation.
// Locks are anatomical, not screen-side. Anatomical left is long, right short.
// face=[cx,cy,rx,ry]; eyes=[cx,cy,halfwidth,depth]; mouth=[cx,cy,width].
// Rear skin/eyes collapse behind the opaque head; rear collar is separately drawn.
export const VIEWS=[
 {face:[80,80,54,54],eyes:[[57,91,18,10],[104,92,17,9]],mouth:[81,112,6],
  fringe:p(26,85, 36,91, 46,69, 57,87, 63,61, 77,78, 88,96, 98,76, 106,61, 114,77, 121,86, 125,65, 132,81, 134,103),
  long:p(122,68,134,80,136,111,149,135,117,129,121,106),short:p(28,72,36,77,34,99,42,122,12,136,24,107),
  tuft:p(64,26,51,18,42,17,53,9,68,4,87,5,75,11,69,18),
  neck:[80,132,12,9],front:1,back:0,longFront:1},
 {face:[93,83,43,51],eyes:[[77,91,17,10],[117,91,11,8]],mouth:[105,110,5],
  fringe:p(30,87, 40,74, 60,71, 70,52, 79,69, 93,82, 103,87, 98,73, 96,52, 106,67, 121,72, 123,63, 133,85, 134,105),
  long:p(129,70,136,80,137,103,149,130,129,127,132,110),short:p(40,74,48,79,48,97,54,119,26,132,36,103),
  tuft:p(67,24,54,19,50,15,60,8,76,5,92,9,79,13,73,20),
  neck:[87,132,11,9],front:.85,back:.15,longFront:0},
 {face:[126,86,30,45],eyes:[[122,91,12,9],[131,91,0,0]],mouth:[129,109,3.7],
  fringe:p(28,94, 36,81, 73,74, 95,53, 104,62, 115,70, 121,82, 119,72, 116,56, 125,69, 130,74, 130,71, 135,84, 136,103),
  long:p(134,103,134,103,134,103,134,103,134,103,134,103),short:p(102,73,111,78,109,94,107,103,101,94,99,84),
  tuft:p(73,24,64,18,62,12,71,7,86,7,96,12,86,16,79,21),
  neck:[97,132,6,8],front:.36,back:.64,longFront:0},
 {face:[132,88,0,0],eyes:[[130,92,0,0],[135,92,0,0]],mouth:[136,111,0],
  fringe:p(26,103,34,100,48,107,56,109,63,110,74,112,84,114,94,112,105,108,114,107,123,103,129,101,133,102,134,106),
  long:p(38,85,49,93,47,110,55,126,19,136,32,110),short:p(121,76,129,79,132,102,143,127,118,119,120,87),
  tuft:p(75,24,64,19,61,14,72,7,85,9,94,15,85,18,80,23),
  neck:[86,132,10,7],front:0,back:1,longFront:0},
 {face:[80,86,0,0],eyes:[[65,91,0,0],[102,91,0,0]],mouth:[80,111,0],
  fringe:p(26,103,34,106,46,110,57,114,65,116,74,117,83,119,95,116,105,113,115,110,124,106,129,103,133,102,134,104),
  long:p(28,77,37,84,39,106,44,129,11,138,24,108),short:p(124,75,134,79,136,103,148,132,116,125,122,87),
  tuft:p(76,24,68,18,60,15,71,9,87,5,96,10,84,15,80,21),
  neck:[80,132,12,7],front:0,back:1,longFront:0},
 {face:[29,89,0,0],eyes:[[27,92,0,0],[32,92,0,0]],mouth:[24,111,0],
  fringe:p(26,105,34,103,47,106,59,109,69,114,78,115,86,117,97,114,108,110,117,109,125,105,129,103,132,101,134,104),
  long:p(38,80,48,89,50,111,52,132,23,139,35,109),short:p(118,77,128,83,132,103,142,129,114,121,120,89),
  tuft:p(78,24,72,18,66,13,78,7,92,5,100,10,91,16,83,21),
  neck:[72,132,10,7],front:0,back:1,longFront:0},
 {face:[33,87,31,45],eyes:[[29,92,0,0],[39,92,12,9]],mouth:[31,110,3.6],
  fringe:p(25,96,29,76,34,72,37,57,42,71,46,79,52,84,50,73,52,54,69,71,98,80,113,84,130,94,134,107),
  long:p(66,72,77,82,78,106,71,126,63,133,66,110),short:p(30,76,34,80,35,87,37,92,30,87,28,81),
  tuft:p(80,24,79,17,71,13,81,8,95,6,106,11,94,16,85,21),
  neck:[63,132,6,8],front:.35,back:.65,longFront:0},
 {face:[67,83,44,51],eyes:[[43,92,11,8],[82,92,17,10]],mouth:[57,111,5],
  fringe:p(26,96,30,75,42,72,48,54,53,70,64,83,74,90,70,75,72,52,88,70,107,74,118,63,131,88,134,107),
  long:p(105,69,121,79,126,105,143,137,109,128,110,108),short:p(28,74,36,78,36,94,43,117,16,130,26,101),
  tuft:p(74,25,66,18,58,15,69,7,88,4,99,9,85,13,79,20),
  neck:[73,132,11,9],front:.85,back:.15,longFront:1}
];
// Teaser-informed torso: broad waist close to hem width, softly rounded sides.
// Earlier leg shortening and rounded-square head retained.
// Joint landmarks: anatomical right then left. All eight rows are authored.
// shoulder/elbow/wrist define each arm; hip/knee/ankle define each leg.
// No reflection of a finished view. Clothes wrap these same landmarks.
const arm=(sx,sy,ex,ey,wx,wy)=>[[sx,sy],[ex,ey],[wx,wy]];
const leg=(hx,hy,kx,ky,ax,ay)=>[[hx,hy],[kx,ky],[ax,ay]];
export const BODIES=[
 // Front
 {torso:[57.05,133,102.95,133,110,163.345,112,188,48,188,50,163.345], pelvis:[80,194.109,32,19.636],
  legs:[[[65.72,200],[63.34,243.986],[64.088,286.924]],[[94.28,200],[96.66,243.986],[96.906,286.924]]],
  shoes:[[62.099,291.273,7.6499999999999995,7],[98.895,291.273,7.6499999999999995,7]], order:[0,1],
  relaxed:[[[60,141],[43,164],[36,186]],[[100,141],[116,164],[124,185]]],
  raised:[[[60,141],[37,132],[28,110]],[[100,141],[122,128],[132,104]]]},
 // Front-right
 {torso:[65.025,133,104.975,135,110.063,165.345,113.5,188,56.5,190,57.063,163.345], pelvis:[85,196.109,28,19.636],
  legs:[[[74.29,200],[69.53,242.386],[71.077,286.124]],[[94.52,202],[99.28,244.386],[98.923,287.324]]],
  shoes:[[72.072,290.473,7.6499999999999995,7],[102.901,291.273,8.5,7]], order:[0,1],
  relaxed:[[[67,141],[54,162],[51,181]],[[101,143],[119,165],[121,187]]],
  raised:[[[67,141],[49,132],[44,114]],[[101,143],[124,129],[135,107]]]},
 // Right
 {torso:[75.125,134,100.625,135,106.001,163.345,108.4,189,66.4,190,64.001,162.345], pelvis:[85,196.109,21.333,19.636],
  legs:[[[80.24,202],[74.29,241.186],[78.038,286.524]],[[90.95,202],[99.28,244.386],[94.945,287.324]]],
  shoes:[[83.011,290.473,7.6499999999999995,7],[101.906,291.273,8.5,7]], order:[0,1],
  relaxed:[[[78,142],[68.5,164],[70.5,184]],[[91,143],[104.5,166],[101.5,190]]],
  raised:[[[78,142],[67.5,132],[67.5,115]],[[91,143],[115.5,132],[129.5,110]]]},
 // Back-right
 {torso:[66.45,134,105.55,133,113,163.345,115.6,189,57.6,191,59,165.345], pelvis:[86,196.109,29.333,19.636],
  legs:[[[74.1,203],[70.53,244.586],[74.066,287.524]],[[99.09,201],[103.85,243.386],[101.912,286.324]]],
  shoes:[[74.066,291.273,7.6499999999999995,7],[104.895,290.473,7.6499999999999995,7]], order:[0,1],
  relaxed:[[[70,143],[53,166],[50,188]],[[101,141],[117,162],[121,182]]],
  raised:[[[70,143],[46,133],[39,110]],[[101,141],[121,131],[127,113]]]},
 // Back
 {torso:[57.05,133,102.95,133,110,163.345,112,188,48,188,50,163.345], pelvis:[80,194.109,32,19.636],
  legs:[[[65.72,200],[62.15,243.986],[63.093,286.924]],[[94.28,200],[97.85,243.986],[96.906,286.924]]],
  shoes:[[61.105,291.273,7.6499999999999995,7],[98.895,291.273,7.6499999999999995,7]], order:[0,1],
  relaxed:[[[60,141],[43,164],[36,185]],[[100,141],[117,164],[124,186]]],
  raised:[[[60,141],[38,128],[28,104]],[[100,141],[123,132],[132,110]]]},
 // Back-left
 {torso:[55.75,134,95.7,134,103.156,165.345,104.6,191,44.6,189,49.156,163.345], pelvis:[74,196.109,29.333,19.636],
  legs:[[[60.91,201],[56.15,243.386],[58.088,286.324]],[[87.09,203],[91.85,244.586],[86.928,287.524]]],
  shoes:[[55.105,290.473,7.6499999999999995,7],[86.928,291.273,7.6499999999999995,7]], order:[1,0],
  relaxed:[[[60,141],[44,162],[40,183]],[[92,143],[109,166],[113,188]]],
  raised:[[[60,141],[41,132],[34,113]],[[92,143],[114,133],[123,110]]]},
 // Left
 {torso:[59.525,135,85.025,134,96.438,162.345,93.8,190,51.8,189,54.438,163.345], pelvis:[74,196.109,21.333,19.636],
  legs:[[[68.05,202],[60.91,244.386],[64.055,287.324]],[[78.76,202],[85.9,241.186],[81.956,286.524]]],
  shoes:[[57.093,291.273,8.5,7],[76.984,290.473,7.6499999999999995,7]], order:[1,0],
  relaxed:[[[69,143],[55.5,166],[58.5,190]],[[82,142],[91.5,164],[89.5,184]]],
  raised:[[[69,143],[44.5,132],[30.5,110]],[[82,142],[92.5,132],[92.5,115]]]},
 // Front-left
 {torso:[55.6,135,95.55,133,102.938,163.345,105.6,190,45.6,188,49.938,165.345], pelvis:[75,196.109,28,19.636],
  legs:[[[65.48,202],[60.72,244.386],[62.072,287.324]],[[85.71,200],[90.47,242.386],[88.923,286.124]]],
  shoes:[[57.099,291.273,8.5,7],[87.928,290.473,7.6499999999999995,7]], order:[1,0],
  relaxed:[[[59,143],[41,165],[39,187]],[[93,141],[106,162],[109,181]]],
  raised:[[[59,143],[36,129],[25,107]],[[93,141],[111,132],[116,114]]]}
];
function bodyAt(index){const yaw=((index%8)+8)%8,i=Math.floor(yaw),v=mix(BODIES[i],BODIES[(i+1)%8],yaw-i);v.order=BODIES[Math.round(yaw)%8].order;return v;}
const num=x=>Math.round(x*1000)/1000;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function mix(a,b,t){if(Array.isArray(a))return a.map((v,i)=>mix(v,b[i],t));if(typeof a==='number')return a+(b-a)*t;const o={};for(const k of Object.keys(a))o[k]=mix(a[k],b[k],t);return o;}
export function viewAt(index){if(!Number.isFinite(index))throw new TypeError('Direction must be finite');const yaw=((index%8)+8)%8,i=Math.floor(yaw);return mix(VIEWS[i],VIEWS[(i+1)%8],yaw-i);}
// Circular corner fillets, not Bezier curves. Duplicated landmarks collapse cleanly.
function contour(xy,r=2,closed=true){
 const a=Array.from({length:xy.length/2},(_,i)=>[xy[i*2],xy[i*2+1]]),len=a.length;
 if(!len)return '';let out='';
 for(let i=0;i<len;i++){
  const q=a[i],prev=a[(i+len-1)%len],next=a[(i+1)%len],u=[prev[0]-q[0],prev[1]-q[1]],v=[next[0]-q[0],next[1]-q[1]],ul=Math.hypot(...u),vl=Math.hypot(...v);
  if(!closed&&(i===0||i===len-1)){out+=(i?'L':'M')+q.map(num).join(' ');continue;}
  if(ul<.001||vl<.001){out+=(i?'L':'M')+q.map(num).join(' ');continue;}
  const dot=clamp((u[0]*v[0]+u[1]*v[1])/(ul*vl),-.99999,.99999),theta=Math.acos(dot),d=Math.min(r/Math.tan(theta/2),ul*.35,vl*.35),rr=d*Math.tan(theta/2);
  const start=[q[0]+u[0]/ul*d,q[1]+u[1]/ul*d],end=[q[0]+v[0]/vl*d,q[1]+v[1]/vl*d];
  out+=(i?'L':'M')+start.map(num).join(' ')+'A'+num(rr)+' '+num(rr)+' 0 0 '+(u[0]*v[1]-u[1]*v[0]<0?1:0)+' '+end.map(num).join(' ');
 }
 return out+(closed?'Z':'');
}
let sequence=0;
export function chibi8SVG(character={},yawIndex=0){
 const c={...MARIA,...character},v=viewAt(yawIndex),id='paper'+(++sequence),ink=c.ink,lw=c.outline,white=c.whiteBorder;
 const bodyView=bodyAt(yawIndex),raised=c.pose==='raised',arms=bodyView[raised?'raised':'relaxed'];
 const outfit=['sailor','whiteBlouse','scarf'].includes(c.outfit)?c.outfit:'sailor';
 const f=clamp(v.front,0,1),b=clamp(v.back,0,1),phase=Number.isFinite(c.walkPhase)?c.walkPhase:0;
 const stride=c.walking?Math.sin(phase*Math.PI*2):0,bob=c.walking?-Math.abs(stride)*1.1:0;
 const path=(d,fill,stroke=ink,width=lw,extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${num(width)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
 const poly=(xy,fill,r=2,width=lw,extra='')=>{let area=0;for(let i=0;i<xy.length;i+=2){const j=(i+2)%xy.length;area+=xy[i]*xy[j+1]-xy[j]*xy[i+1];}return Math.abs(area)<.02?'':path(contour(xy,r),fill,ink,width,extra);};
 const oval=(a,fill,width=lw,extra='')=>`<ellipse cx="${num(a[0])}" cy="${num(a[1])}" rx="${num(Math.max(0,a[2]))}" ry="${num(Math.max(0,a[3]))}" fill="${fill}" stroke="${ink}" stroke-width="${num(width)}" ${extra}/>`;
 const headBasis=(fill,width=lw)=>oval([80,74,54,54],fill,width,'data-head-basis="oval"');
 const faceBasis=`<ellipse cx="${num(v.face[0])}" cy="${num(v.face[1])}" rx="${num(v.face[2])}" ry="${num(v.face[3])}"/>`;
 const line=(d,w=lw)=>path(d,'none',ink,w);
 const fringe=contour(v.fringe,1.2,false);
 // Reverse point order explicitly for the upper hair fill; never reverse a character.
 const reverse=[];for(let i=v.fringe.length-2;i>=0;i-=2)reverse.push(v.fringe[i],v.fringe[i+1]);
 const upperHair='M0 -10H160V145L'+reverse.slice(0,2).map(num).join(' ')+contour(reverse,1.2,false).replace(/^M[-\d.]+ [-\d.]+/,'')+'L0 145Z';
 // Walking bends the same hip/knee/ankle and shoulder/elbow/wrist chains.
 const sideStride=Math.sin(yawIndex*Math.PI/4);
 const gait=bodyView.legs.map((points,i)=>points.map((a,j)=>[a[0]+stride*(i?1:-1)*sideStride*(j===1?5:j===2?10:0),a[1]-Math.max(0,stride*(i?1:-1))*(j===1?3:j===2?9:0)]));
 const feet=bodyView.shoes.map((a,i)=>[a[0]+gait[i][2][0]-bodyView.legs[i][2][0],a[1]+gait[i][2][1]-bodyView.legs[i][2][1],a[2],a[3]]);
 const jointPath=points=>'M'+points.map(a=>a.map(num).join(' ')).join('L');
 const limb=(points,fill,width)=>path(jointPath(points),'none',ink,width+lw*2)+path(jointPath(points),'none',fill,width);
 const legWidth=.75;
 const taperedLeg=points=>{const [h,k,a]=points;const midY=h[1]+(k[1]-h[1])*.3,calfY=k[1]+(a[1]-k[1])*.45,midX=h[0]+(k[0]-h[0])*.3,calfX=k[0]+(a[0]-k[0])*.45;return [h[0]-14*legWidth,h[1],h[0]+14*legWidth,h[1],midX+16*legWidth,midY,k[0]+13.1*legWidth,k[1],calfX+13*legWidth,calfY,a[0]+9.8*legWidth,a[1],a[0]-9.8*legWidth,a[1],calfX-13*legWidth,calfY,k[0]-13.1*legWidth,k[1],midX-16*legWidth,midY];};
 const legShapes=gait.map(points=>poly(taperedLeg(points),outfit==='whiteBlouse'?c.skin:c.legs,6)+(outfit==='whiteBlouse'?poly([points[1][0]-13.1*legWidth,points[1][1]-8,points[1][0]+13.1*legWidth,points[1][1]-8,(points[1][0]+points[2][0])/2+13*legWidth,(points[1][1]+points[2][1])/2,points[2][0]+9.8*legWidth,points[2][1],points[2][0]-9.8*legWidth,points[2][1],(points[1][0]+points[2][0])/2-13*legWidth,(points[1][1]+points[2][1])/2],c.legs,3):''));
 const shoes=feet.map(a=>oval(a,c.shoes));
 const torso=poly(bodyView.torso,outfit==='scarf'?'#3d53b1':c.cloth,9);
 const [hipX,hipY,hipWidth]=bodyView.pelvis;
 const pelvis=poly([hipX-hipWidth,hipY-10,hipX+hipWidth,hipY-10,hipX+hipWidth-9,hipY+20,hipX+12,hipY+24,hipX,hipY+16.364,hipX-12,hipY+24,hipX-hipWidth+9,hipY+20],c.legs,5);
 const armJoints=arms.map((points,i)=>points.map((a,j)=>[a[0]+(!raised?stride*(i?1:-1)*j*2*sideStride:0),a[1]+(!raised?stride*(i?1:-1)*j*1.5:0)]));
 const sleevePoints=armJoints.map(a=>{const [s,e]=a,dx=e[0]-s[0],dy=e[1]-s[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;const end=[s[0]+dx*.77,s[1]+dy*.77];return [s[0]+nx*9,s[1]+ny*9,s[0]-nx*9,s[1]-ny*9,end[0]-nx*7,end[1]-ny*7,end[0]+nx*7,end[1]+ny*7];});
 const sleeves=sleevePoints.map(a=>poly(a,outfit==='scarf'?c.collar:c.cloth,3));
 const hands=armJoints.map(a=>oval([a[2][0],a[2][1]+3,6,7],c.skin));
 const armShapes=armJoints.map((a,i)=>limb(a,c.skin,10)+sleeves[i]+hands[i]);
 const legs=bodyView.order.map(i=>legShapes[i]+shoes[i]);
 const headTransform=`translate(80 0) scale(1.035 1) translate(-80 0)`;
 const bodyTransform=`translate(0 128) scale(1 ${BODY_SCALE}) translate(0 -128)`;
 const parts=[`<g transform="${bodyTransform}">${[...legs,pelvis,...armShapes,torso].join('')}</g>`];
 const lockLong=poly(v.long,c.hair,1.7,lw,'data-anatomical="left-long-lock"'),lockShort=poly(v.short,c.hair,1.5,lw,'data-anatomical="right-short-lock"');
 parts.push(`<g transform="${headTransform}">${headBasis(c.hair)}${poly(v.tuft,c.hair,1.2)}${lockLong}${lockShort}</g>`);
 // Outline silhouette is a paint union beneath the entire opaque drawing.
 const silhouette=parts.join('').replace(/fill="([^"]*)"/g,(_,fill)=>`fill="${fill==='none'?'none':'#fffdf8'}"`).replace(/stroke="[^"]*"/g,'stroke="#fffdf8"').replace(/stroke-width="([^"]*)"/g,(_,width)=>`stroke-width="${num(Number(width)+white*2)}"`);
 // Repaint overlapping pants fills to remove internal capsule seams.
 const cleanFill=svg=>svg.replace(/stroke-width="[^"]*"/g,'stroke-width="0"');
 let body=legs.join('')+pelvis+legShapes.map(cleanFill).join('')+cleanFill(pelvis)+shoes.join('')+bodyView.order.map(i=>armShapes[i]).join('')+torso;
 const [nx,ny,nw,nh]=v.neck;
 if(outfit==='sailor'){
  body+=poly([nx-nw-6,128,nx+nw+6,128,nx+nw+5,147,nx-nw-5,147],c.collar,1.5,1.2,`data-piece="back-collar" transform="translate(${num(nx)} 0) scale(${num(b)} 1) translate(${num(-nx)} 0)"`);
  body+=poly([nx-nw,128,nx+nw,128,nx,149],c.skin,1.2,1.3,`transform="translate(${num(nx)} 0) scale(${num(f)} 1) translate(${num(-nx)} 0)"`);
  body+=poly([nx-nw-7,127,nx-nw,130,nx,148,nx+nw,130,nx+nw+7,127,nx+10,151,nx,154,nx-11,150],c.collar,1.2,1.1,`data-piece="front-collar" transform="translate(${num(nx)} 0) scale(${num(f)} 1) translate(${num(-nx)} 0)"`);
  body+=poly([nx-6,149,nx,153,nx+6,149,nx+5,160,nx,157,nx-5,160],c.tie,1,1.2,`transform="translate(${num(nx)} 0) scale(${num(f)} 1) translate(${num(-nx)} 0)"`);
  for(const s of sleevePoints)body+=path('M'+[s[4],s[5]].map(num).join(' ')+'L'+[s[6],s[7]].map(num).join(' '),'none',c.collar,3);
 }else if(outfit==='whiteBlouse'){
  body+=poly([nx-nw,128,nx,142,nx+nw,128,nx+nw-1,137,nx,146,nx-nw+1,137],c.skin,1.8,1.1,`transform="translate(${num(nx)} 0) scale(${num(f)} 1) translate(${num(-nx)} 0)"`);
  if(f>.01)body+=line('M'+num(nx-8*f)+' 151A'+num(8*f)+' 4 0 0 0 '+num(nx+8*f)+' 151',.9);
 }else body+=poly([57,127,102,127,105,141,96,147,59,141],c.collar,2,1.6);
 let head=lockLong+lockShort+headBasis(c.hair);
 head+=`<g clip-path="url(#${id}-head)">`;
 if(v.face[2]>.01){head+=faceBasis.replace('/>',` fill="${c.skin}"/>`);head+=`<g clip-path="url(#${id}-face)">`;
  v.eyes.forEach((eye,i)=>{
   const [x,y,w,h]=eye;if(w<.05||h<.05)return;
   const expression=c.expression;
   if(expression==='happy'){head+=line(`M${num(x-w)} ${num(y+2)}A${num(w)} ${num(h)} 0 0 1 ${num(x+w)} ${num(y+2)}`,2.3);return;}
   if(expression==='shocked'){head+=oval([x,y,w*.68,h*1.2],'#fffefa',1.5);return;}
   const eyeD=`M${num(x-w)} ${num(y)}A${num(w)} ${num(h)} 0 0 0 ${num(x+w)} ${num(y)}A${num(w*3)} ${num(h*.95)} 0 0 1 ${num(x-w)} ${num(y)}Z`;
   head+=`<clipPath id="${id}-eye${i}"><path d="${eyeD}"/></clipPath>`+path(eyeD,'#fffefa',ink,1.1);
   head+=`<g clip-path="url(#${id}-eye${i})">`+oval([x+(i?-.6:.8),y+.8,Math.min(5.8,w*.38),h*.82],c.iris,1.15)+'</g>';
   head+=path(`M${num(x-w-1)} ${num(y-.6)}A${num(w*3)} ${num(h*.95)} 0 0 0 ${num(x+w+1)} ${num(y-.6)}`,'none',ink,2.3);
   head+=path(`M${num(x-w*.85)} ${num(y-8)}L${num(x+w*.8)} ${num(y-7.2)}`,'none',ink,.95);
  });
  const [mx,my,mw]=v.mouth;
  if(mw>.1){if(c.expression==='happy')head+=line(`M${num(mx-mw*1.3)} ${num(my-2)}A${num(mw*.65)} 4 0 0 0 ${num(mx)} ${num(my-2)}A${num(mw*.65)} 4 0 0 0 ${num(mx+mw*1.3)} ${num(my-2)}`,2.2);
  else if(c.expression==='shocked')head+=oval([mx,my,mw*1.1,6],'#893f43',1.3);
  else head+=line(`M${num(mx-mw)} ${num(my+2)}L${num(mx)} ${num(my-5)}L${num(mx+mw*.95)} ${num(my+2)}`,1.5);}
  head+='</g>';
 }
 head+=path(upperHair,c.hair,ink,0)+`<g clip-path="url(#${id}-face)">`+(f>.001?line(fringe,lw*Math.min(1,f*3)):'')+'</g>';
 head+='</g>'+headBasis('none',lw);
 head+=`<g clip-path="url(#${id}-lock)">${poly(v.long,c.hair,1.7,lw*clamp((f-.18)/.17,0,1))}</g>`;
 // Erase only the attachment edge within the owning hair, avoiding a strapped-on root.
 if(f>.9)head+=path(`M${v.long[0]} ${v.long[1]}L${v.long[2]} ${v.long[3]}`,'none',c.hair,lw+1);
 // Head overlay owns hair-line continuity; back contour has no fake face features.
 head+=poly(v.tuft,c.hair,1.2);
 head=`<g transform="${headTransform}">${head}</g>`;
 // Cover pose: near hand overlaps the head; far hand stays behind in profiles.
 const handDepth=[[1,1],[0,1],[0,1],[0,0],[0,0],[0,0],[1,0],[1,0]],yaw=((yawIndex%8)+8)%8;
 const handVisibility=mix(handDepth[Math.floor(yaw)],handDepth[(Math.floor(yaw)+1)%8],yaw%1);
 const frontHands=raised?armJoints.map((a,i)=>handVisibility[i]>.01?oval([a[2][0],a[2][1]+3,6*handVisibility[i],7*handVisibility[i]],c.skin,lw*handVisibility[i]):'').join(''):'';
 const leftLockRoom=yaw>4?Math.min(v.face[2]*.65,20)*(1-f):0;
 let guides='';
 if(c.construction){
  const blue='#138ca6',guideLine=points=>path(jointPath(points),'none',blue,1.15);
  const [px,py,pr]=bodyView.pelvis;
  const meridians=[80,108,133,108,80,52,27,52],gx=meridians[Math.floor(yaw)]+(meridians[(Math.floor(yaw)+1)%8]-meridians[Math.floor(yaw)])*(yaw%1);
  guides=`<g data-construction="true" opacity=".85"><g transform="${headTransform}">`+headBasis('none',1).replaceAll(ink,blue);
  guides+=`<g clip-path="url(#${id}-head)">`+guideLine([[80,20],[gx,47],[gx,107],[80,128]])+path('M26 88A65 13 0 0 0 134 88','none',blue,1)+'</g></g>';
  guides+=`<g transform="${bodyTransform}">`+oval([px,151,(bodyView.torso[4]-bodyView.torso[10])*.46,21],'none',1).replaceAll(ink,blue)+oval(bodyView.pelvis,'none',1).replaceAll(ink,blue);
  guides+=guideLine([[80,128],[px,163.345],[px,py]])+guideLine([armJoints[0][0],armJoints[1][0]]);
  for(const points of [...armJoints,...gait]){guides+=guideLine(points);for(const point of points)guides+=oval([...point,3,3],'#e3f7f6',1).replaceAll(ink,blue);}
  guides+='</g></g>';
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 160 294" width="160" height="294" data-foot-y="272.732" data-renderer="paper-compact-oval-6" data-direction="${num(((yawIndex%8)+8)%8)}" data-pose="${raised?'raised':'relaxed'}" role="img" aria-label="Brown Maria ${DIRECTIONS[Math.round(((yawIndex%8)+8)%8)%8]}"><defs><clipPath id="${id}-head"><ellipse cx="80" cy="74" rx="54" ry="54"/></clipPath><clipPath id="${id}-face">${faceBasis}</clipPath><clipPath id="${id}-lock"><ellipse cx="${num(v.face[0]+leftLockRoom)}" cy="${num(v.face[1])}" rx="${num(v.face[2]+leftLockRoom)}" ry="${num(v.face[3])}"/></clipPath></defs><g transform="translate(0 ${num(bob)})">${silhouette}<g transform="${bodyTransform}">${body}</g>${head}<g transform="${bodyTransform}">${frontHands}</g>${guides}</g></svg>`;
 return svg;
}
