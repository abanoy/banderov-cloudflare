import * as T from '../vendor/three.module.js';

// The supplied sheet is a visual reference. Every visible surface below is geometry;
// the reference image is not mapped onto the model. Forward +Z, feet Y=0.
export function createAzure({pose='rest'}={}){
 const root=new T.Group(); root.name='Azure reference construction';
 const meshes=[],textures=[],materials=[];
 const color=h=>new T.Color(h).convertSRGBToLinear();
 function mat(h,roughness=.55,metalness=0,extra={}){const m=new T.MeshStandardMaterial({color:color(h),roughness,metalness,...extra});materials.push(m);return m;}
 function knitTexture(){
  const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d');g.fillStyle='#818181';g.fillRect(0,0,128,256);
  for(let y=-16;y<272;y+=16)for(let x=-16;x<144;x+=16){g.lineCap='round';g.lineWidth=5;g.strokeStyle='#454545';g.beginPath();g.moveTo(x-5,y-5);g.quadraticCurveTo(x-3,y+3,x,y+6);g.quadraticCurveTo(x+3,y+3,x+5,y-5);g.stroke();g.lineWidth=2;g.strokeStyle='#b8b8b8';g.beginPath();g.moveTo(x-4,y-5);g.lineTo(x,y+4);g.lineTo(x+4,y-5);g.stroke();}
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(5,4);t.anisotropy=8;textures.push(t);return t;
 }
 const knit=knitTexture();
 const skin=mat('#f4d0b6',.58),earInner=mat('#d69787',.75),lip=mat('#a66259',.7);
 const hair=mat('#123d68',.40,.12),hairBright=mat('#147cb0',.40,.10),hairBlue=mat('#176597',.42,.10),hairDark=mat('#112c51',.45,.10),hairGlint=mat('#246c96',.48,.06),hairGroove=mat('#174b72',.46,.06);
 const sweater=mat('#078eba',.86,0,{bumpMap:knit,bumpScale:.003}),trim=mat('#dbe2df',.85,0,{bumpMap:knit,bumpScale:.002}),sock=mat('#17445b',.86,0,{bumpMap:knit,bumpScale:.003});
 function grainTexture(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),im=g.createImageData(256,256);let seed=749;for(let i=0;i<im.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=110+(seed>>>25);im.data.set([n,n,n,255],i);}g.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,3);textures.push(t);return t;}
 const grain=grainTexture();
 const leather=mat('#aa743b',.69,0,{bumpMap:grain,bumpScale:.003}),leatherEdge=mat('#795329',.65),toeMat=mat('#d6ba83',.79,0,{bumpMap:grain,bumpScale:.002}),soleMat=mat('#302820',.85),stitchMat=mat('#d3bd91',.8),laceMat=mat('#252a2b',.8),metal=mat('#443a2a',.35,.7),pink=mat('#e7417c',.3,.15),white=mat('#faf4e8',.36),eyeInk=mat('#273046',.5);
 function mesh(geo,m,name,parent=root){const o=new T.Mesh(geo,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);meshes.push(o);return o;}
 function ell(name,pos,scale,m,parent=root){const o=mesh(new T.SphereGeometry(1,40,28),m,name,parent);o.position.set(...pos);o.scale.set(...scale);return o;}
 function curve(points){return new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');}
 function tube(name,points,r,m,parent=root,segments=36){return mesh(new T.TubeGeometry(curve(points),segments,r,7,false),m,name,parent);}
 function surface(name,nu,nv,fn,m,parent=root,closed=false){const p=[],uv=[],idx=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const v=fn(i/nu,j/nv);p.push(...v);uv.push(i/nu,j/nv);}for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,b,d,a,d,c);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const o=mesh(geo,m,name,parent);o.material.side=T.DoubleSide;return o;}
 const mix=(a,b,t)=>a+(b-a)*t;
 function sample(rows,y){let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)],h=b[0]-a[0],t=T.MathUtils.clamp((y-a[0])/h,0,1);return a.map((v,k)=>{if(!k)return y;const m0=(b[k]-prev[k])/(b[0]-prev[0]),m1=(next[k]-a[k])/(next[0]-a[0]);return (2*t**3-3*t*t+1)*v+(t**3-2*t*t+t)*h*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*m1;});}
 function ringBody(name,rows,m,ribs=0,parent=root,n=160){const lo=rows[0][0],hi=rows.at(-1)[0];return surface(name,n,80,(u,v)=>{const y=mix(lo,hi,v),r=sample(rows,y),a=u*Math.PI*2,co=Math.cos(a),flute=ribs?Math.cos(a*ribs)*.006:0;return [(r[1]+flute)*Math.sin(a),y,(co>=0?r[2]:r[3]??r[2])*co+(r[4]||0)+flute*co];},m,parent);}
 // The skull tapers into a short chin; a broad front keeps the anime eye planes calm.
 const headRows=[[4.60,.025,.11,.10,.07],[4.66,.14,.235,.18,.015],[4.79,.285,.315,.27,0],[4.98,.40,.345,.34,0],[5.20,.445,.345,.37,0],[5.40,.405,.30,.33,0],[5.56,.23,.18,.22,0],[5.63,.002,.002,.002,0]];
 function faceZ(x,y){const r=sample(headRows,y),q=Math.max(0,1-(x/r[1])**2);return r[2]*Math.pow(q,.30)+(r[4]||0);}
 const skull=surface('Sculpted head',112,100,(u,v)=>{const y=mix(4.601,5.629,v),r=sample(headRows,y),a=u*Math.PI*2,co=Math.cos(a);return [r[1]*Math.sin(a),y,(co>=0?r[2]*Math.pow(co,.6):r[3]*co)+(r[4]||0)];},mat('#ffffff',.62,0,{vertexColors:true}));
 const blush=[];const hp=skull.geometry.attributes.position;for(let i=0;i<hp.count;i++){const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i),amount=Math.exp(-(((Math.abs(x)-.265)/.12)**2)-((y-4.957)/.066)**2)*T.MathUtils.smoothstep(z,.13,.26)*.35,c=color('#f4d0b6').lerp(color('#e29591'),amount);blush.push(c.r,c.g,c.b);}skull.geometry.setAttribute('color',new T.Float32BufferAttribute(blush,3));
 ringBody('Neck',[[4.35,.17,.145,.14],[4.58,.135,.13,.14],[4.79,.15,.13,.15]],skin,0,root,64);
 ringBody('Bare shoulders and collar',[[4.12,.39,.21,.22],[4.28,.57,.235,.22],[4.38,.55,.20,.19],[4.44,.36,.16,.16],[4.53,.16,.14,.14]],skin,0,root,96);
 for(const s of [-1,1]){
  const ear=ell(`Ear ${s}`,[s*.438,5.015,.015],[.095,.16,.078],skin);ear.rotation.z=s*-.13;
  ell(`Ear concha ${s}`,[s*.479,5.021,.058],[.033,.10,.025],earInner);
  tube('Collarbone '+s,[[s*.045,4.38,.235],[s*.16,4.355,.218],[s*.29,4.38,.179],[s*.40,4.37,.15]],.009,skin);
 }
 // A low projecting bridge and softened tip, rather than a spherical nose.
 ell('Nose bridge',[0,5.008,.343],[.027,.074,.031],skin);
 ell('Nose tip',[0,4.968,.374],[.027,.022,.023],skin);
 tube('Smile',[[-.093,4.793,faceZ(-.093,4.793)+.004],[-.042,4.776,faceZ(-.042,4.776)+.006],[.025,4.774,faceZ(.025,4.774)+.006],[.078,4.793,faceZ(.078,4.793)+.005]],.0055,lip);
 // Almond-shaped whites and matching curved eyelids follow the skull surface.
 function eye(s){
  const cx=s*.208,cy=5.095;
  const point=(u,v,offset=.014)=>{const x=cx+s*u;return [x,cy+v,faceZ(x,cy+v)+offset];};
  const eyeTop=q=>.056*Math.sqrt(Math.max(0,1-q*q))-.027*q,eyeBottom=q=>-.060*Math.sqrt(Math.max(0,1-q*q))-.018*q;
  surface('Almond eye '+s,64,22,(u,v)=>{const q=u*2-1;return point(q*.153,mix(eyeBottom(q),eyeTop(q),v));},white);
  // Iris is clipped at top and bottom to sit under the lids.
  function irisPoint(a,r,z){const x=Math.cos(a)*.071*r,y=T.MathUtils.clamp(Math.sin(a)*.083*r-.006,eyeBottom(x/.153)+.001,eyeTop(x/.153)-.001);return point(x,y,z);}
  const iris=surface('Turquoise iris '+s,64,48,(u,v)=>irisPoint(u*Math.PI*2,v,.020),mat('#ffffff',.4,0,{vertexColors:true}));
  const colors=[];for(let j=0;j<=48;j++)for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,r=j/48,y=Math.sin(a)*r,c=color('#109fce').lerp(color('#143d76'),Math.max(0,y)*.9);if(r>.84)c.lerp(color('#0b345b'),(r-.84)/.16*.85);const fiber=.06*Math.sin(a*43+r*12);c.multiplyScalar(1+fiber);colors.push(c.r,c.g,c.b);}iris.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  ell('Ruby pupil '+s,point(0,-.008,.026),[.020,.035,.007],mat('#a62d58',.4));
  ell('Upper eye glint '+s,point(-.024,.020,.037),[.013,.015,.006],white);
  ell('Lower eye glint '+s,point(.028,-.040,.033),[.006,.008,.005],white);
  const top=[],bottom=[];
  for(let i=0;i<=24;i++){const q=i/12-1;top.push(point(q*.155,eyeTop(q),.031));bottom.push(point(q*.153,eyeBottom(q),.021));}
  tube('Upper lash '+s,top,.010,eyeInk);tube('Lower lash '+s,bottom,.0035,lip);
  tube('Outer eyelash '+s,[point(.13,-.006,.034),point(.16,-.025,.03),point(.181,.002,.023)],.008,eyeInk,root,12);
  tube('Eyebrow '+s,[point(-.115,.157,.008),point(-.02,.164,.010),point(.105,.138,.010)],.012,hairDark,root,24);
 }
 eye(-1);eye(1);
 // Close-fitting back cap. Front fringe is built separately, with true volume.
 surface('Hair foundation',112,64,(u,v)=>{const a=u*Math.PI*2,front=Math.max(0,Math.cos(a)),bottom=4.88+front*.39,phi=mix(.001,Math.acos((bottom-5.20)/.51),v);return [.48*Math.sin(phi)*Math.sin(a),5.20+.51*Math.cos(phi),.407*Math.sin(phi)*Math.cos(a)-.025];},hair);
 function lock(name,points,width,thickness,m,strands=9){
  const c=curve(points);function frame(t){const tangent=c.getTangent(Math.max(.0001,Math.min(.9999,t))),normal=new T.Vector3(0,0,1),across=new T.Vector3().crossVectors(tangent,normal).normalize();if(across.lengthSq()<.1)across.set(1,0,0);normal.crossVectors(across,tangent).normalize();return {p:c.getPoint(t),across,normal};}
  function w(t){return width*(.42+.74*Math.sin(Math.PI*Math.pow(t,.8)))*Math.pow(1-t,.40)+.001;}
  surface(name,20,56,(u,t)=>{const f=frame(t),a=u*Math.PI*2,wide=w(t),deep=thickness*Math.pow(Math.max(.001,1-t),.52)*(.7+.3*Math.sin(Math.PI*t));return f.p.addScaledVector(f.across,Math.cos(a)*wide).addScaledVector(f.normal,Math.sin(a)*deep).toArray();},m);
  for(let k=0;k<strands;k++){
   const q=-.88+1.76*(k+.5)/strands,pts=[];
   for(let j=0;j<=44;j++){const t=.025+j/44*.955,f=frame(t),deep=thickness*Math.pow(Math.max(.001,1-t),.52)*(.7+.3*Math.sin(Math.PI*t));pts.push(f.p.addScaledVector(f.across,w(t)*q).addScaledVector(f.normal,deep*Math.sqrt(1-q*q)+.0015).toArray());}
   tube(name+' strand '+k,pts,k%3===0?.0018:.0012,k%3===0?hairGlint:hairGroove,root,64);
  }
 }
 // Back hair beneath the ponytail: staggered tapered locks keep a layered silhouette.
 for(let i=0;i<9;i++){
  const x=(i-4)*.105,tip=2.96+Math.abs(i-4)*.035,depth=Math.abs(i-4)*.016;
  lock('Back underlayer '+i,[[x*.75,5.27,-.28],[x,4.78,-.33+depth],[x*1.03,4.20,-.32+depth],[x*1.22,3.60,-.39],[x*1.28+(i%2?.08:-.08),tip,-.37]],.117,.135,i%3===0?hairBlue:hairDark,6);
 }
 // High ponytail arcs away from the head, then falls in a broad S-curve to the hips.
 for(let i=0;i<11;i++){
  const x=(i-5)*.046,d=.055*Math.sin(i*2.3);
  lock('Ponytail lock '+i,[[x*.35,5.60,-.18],[x*.80,5.87,-.37],[x*1.12,5.79,-.55],[x*1.40,5.19,-.55+d],[x*1.55,4.51,-.53+d],[x*1.90+.065,3.92,-.76+d],[x*1.55+.08,3.32,-.81+d],[x*1.05-.015,2.98+Math.abs(i-5)*.055,-.49+d]],.12,.165,i%3===0?hairBlue:hair,8);
 }
 for(let i=0;i<9;i++){const a=i/9*Math.PI*2;ell('Pink hair tie bead '+i,[Math.cos(a)*.178,5.64+Math.sin(a)*.10,-.225+Math.sin(a)*.074],[.062,.070,.065],pink);}
 lock('Left broad swept fringe',[[.055,5.605,.24],[-.16,5.51,.39],[-.35,5.31,.408],[-.53,5.22,.33],[-.60,5.245,.24]],.184,.069,hairBlue,16);
 lock('Left lower swept fringe',[[.018,5.565,.28],[-.15,5.39,.431],[-.35,5.18,.419],[-.54,5.13,.315]],.115,.054,hair,10);
 lock('Right broad swept fringe',[[.065,5.62,.22],[.31,5.49,.35],[.40,5.27,.34],[.53,5.08,.24],[.58,5.10,.18]],.187,.088,hairBright,16);
 lock('Right layered fringe',[[.07,5.64,.20],[.35,5.47,.22],[.48,5.23,.17],[.45,5.09,.12]],.114,.079,hairBlue,9);
 lock('Central pointed bang',[[.035,5.61,.35],[.056,5.39,.436],[.036,5.16,.451],[-.018,4.965,.414]],.071,.042,hairBlue,8);
 for(const s of [-1,1])lock('Temple lock '+s,[[s*.415,5.25,.18],[s*.414,4.99,.18],[s*.391,4.75,.177],[s*.32,4.54,.153]],.057,.042,hairBlue,6);
 // Curved side locks join the bangs to the gathered crown, breaking up the cap.
 for(const s of [-1,1])for(let j=0;j<4;j++){
  const d=j*.045;
  lock('Gathered side hair '+s+' '+j,[[s*.38,5.13+d,.03-d],[s*.465,5.28+d,-.07],[s*.37,5.49+d*.4,-.24],[s*.12,5.62,-.28]],.043,.039,j%2?hairBlue:hair,5);
 }
 if(pose==='reference'){
  const h=new T.Group();h.name='Tilted head';h.position.y=4.57;root.add(h);
  const excluded=/^(Neck|Bare shoulders|Collarbone)/;
  for(const o of [...root.children])if(o!==h&&!excluded.test(o.name)){root.remove(o);o.position.y-=4.57;h.add(o);}
  h.rotation.z=-.10;
 }
 // Sweater and its sculpted vertical ribs. A procedural yarn bump supplies small stitches.
 const torsoRows=[[2.94,.65,.355,.355],[3.08,.61,.35,.35],[3.33,.47,.27,.27],[3.60,.365,.215,.205],[3.83,.415,.26,.23],[4.03,.51,.335,.24],[4.18,.55,.31,.235],[4.30,.59,.23,.225]];
 ringBody('Ribbed sweater',torsoRows,sweater,56);
 function ellipseLine(name,y,rx,rz,r,m,offset=0){const pts=[];for(let i=0;i<=128;i++){const a=i/128*Math.PI*2;pts.push([rx*Math.sin(a),y+offset*Math.cos(a),rz*Math.cos(a)]);}return tube(name,pts,r,m,root,128);}
 ellipseLine('Ivory sweater hem',2.945,.658,.363,.018,trim,.012);
 ellipseLine('Rolled off-shoulder neckline',4.306,.593,.231,.036,sweater,-.023);
 ellipseLine('Ivory neckline piping',4.337,.594,.230,.014,trim,-.023);
 // Subtle vertical raised cables, following the bust and waist contour.
 for(let i=0;i<30;i++){
  const a=(i+.5)/30*Math.PI*2,pts=[];
  for(let j=0;j<=58;j++){const y=mix(2.97,4.27,j/58),r=sample(torsoRows,y),wave=Math.sin(y*42+i)*.003;pts.push([(r[1]+.007)*Math.sin(a+wave),y,(Math.cos(a)>0?r[2]:r[3])*Math.cos(a+wave)+.007*Math.cos(a)]);}
  tube('Sweater cable '+i,pts,.007,sweater,root,64);
 }
 // Sleeves follow angled upper arms; soft cuffs flare above articulated fingers.
 for(const s of [-1,1]){
  const bent=pose==='reference'&&s===-1,shoulder=new T.Vector3(s*.54,4.23,0),wrist=new T.Vector3(s*(bent?.55:1.00),bent?3.66:3.07,bent?.28:.025),elbow=bent?new T.Vector3(-.92,3.72,.055):shoulder.clone().lerp(wrist,.53),sleeveCurve=new T.CatmullRomCurve3([shoulder,elbow,wrist]);
  const axis=sleeveCurve.getTangent(1).normalize();
  const sleeveAt=(u,t)=>{const tangent=sleeveCurve.getTangent(t),across=new T.Vector3(tangent.y,-tangent.x,0).normalize(),front=new T.Vector3().crossVectors(across,tangent).normalize(),a=u*Math.PI*2,r=mix(.168,.21,t)-Math.sin(Math.PI*t)*.036+.005*Math.cos(a*28),p=sleeveCurve.getPoint(t);return p.addScaledVector(across,Math.cos(a)*r).addScaledVector(front,Math.sin(a)*r*.93).toArray();};
  surface('Bell sleeve '+s,112,70,sleeveAt,sweater);
  for(const [t,m,r]of [[1,trim,.013],[.96,sweater,.018]]){const pts=[];for(let j=0;j<=80;j++)pts.push(sleeveAt(j/80,t));tube('Sleeve cuff '+s+' '+t,pts,r,m,root,80);}
  const hand=new T.Group();hand.name='Hand '+s;hand.position.copy(wrist.clone().addScaledVector(axis,.10));hand.rotation.z=bent?1.4:s*.25;if(bent)hand.rotation.x=-.50;root.add(hand);
  ell('Palm '+s,[0,-.038,.018],[.082,.132,.042],skin,hand);
  for(let f=0;f<4;f++){
   const x=(f-1.5)*.040,len=[.145,.19,.18,.135][f];tube('Finger '+s+' '+f,bent?[[x,-.10,.023],[x,-.155,.055],[x,-.16,.105],[x,-.11,.105]]:[[x,-.104,.023],[x+s*.016,-.18,.025],[x+s*.035,-.12-len,.044],[x+s*.032,-.13-len,.076]],.019,skin,hand,20);
  }
  tube('Thumb '+s,[[s*-.071,-.035,.02],[s*-.108,-.105,.052],[s*-.10,-.16,.09]],.024,skin,hand,20);
 }
 // Shorts sit beneath the sweater hem, followed by exposed thighs and tall ribbed socks.
 ringBody('Dark shorts',[[2.84,.51,.235,.24],[3.10,.49,.26,.27]],hairDark);
 for(const s of [-1,1]){
  const leg=new T.Group();leg.position.x=s*.325;root.add(leg);
  ringBody('Upper thigh '+s,[[2.53,.216,.206,.205],[2.71,.249,.242,.247],[3.04,.25,.255,.27]],skin,0,leg,80);
  ringBody('Ribbed stocking '+s,[[.80,.155,.16,.16],[1.26,.169,.18,.18],[1.55,.195,.20,.20],[1.88,.185,.19,.185],[2.17,.205,.207,.21],[2.57,.232,.222,.222]],sock,40,leg,128);
  const cuff=ringBody('Stocking top band '+s,[[2.49,.239,.229,.229],[2.59,.239,.229,.229]],sock,40,leg,128);
  // A slight outward stance follows the reference's wider boots without widening the hips.
  for(const o of leg.children){const p=o.geometry?.attributes.position;if(p){for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+s*.10*(1-p.getY(i)/3));p.needsUpdate=true;o.geometry.computeVertexNormals();}}
  const bootGroup=new T.Group();bootGroup.position.x=s*.095;bootGroup.rotation.y=s*.095;bootGroup.scale.set(1.10,1,1.06);leg.add(bootGroup);boot(s,bootGroup);
 }
 function boot(s,parent){
  const shoeZ=.14;
  // Rounded footprint with a square heel and generous toe box.
  function outline(a,scale=1){const co=Math.cos(a);return [Math.sin(a)*(.252+(co>0?.042:0))*scale,shoeZ+co*(co>0?.45:.37)*scale];}
  surface('Stacked boot sole '+s,112,6,(u,v)=>{const a=u*Math.PI*2,[x,z]=outline(a,1+.035*Math.sin(Math.PI*v));return [x,.045+v*.16,z];},soleMat,parent);
  surface('Boot welt '+s,112,4,(u,v)=>{const [x,z]=outline(u*Math.PI*2,1.014);return [x,.206+v*.046,z];},leatherEdge,parent);
  ell('Rounded cream toe '+s,[0,.267,.285],[.278,.151,.342],toeMat,parent);
  ell('Leather instep '+s,[0,.39,.045],[.245,.29,.27],leather,parent);
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2,pts=[];for(let j=0;j<3;j++){const [x,z]=outline(a+(j-1)*.022,1.02);pts.push([x,.228,z]);}tube('Welt stitching '+s+' '+i,pts,.006,stitchMat,parent,6);}
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2,[x,z]=outline(a,.972);const tread=mesh(new T.BoxGeometry(.061,.045,.042),soleMat,'Sole lug '+s+' '+i,parent);tread.position.set(x,.023,z);tread.rotation.y=a;}
  // The shaft is open at the laces. Its raised outer edges curl away from the sock.
  const shaftAt=(u,v)=>{const a=mix(.60,Math.PI*2-.60,u),rx=mix(.21,.34,v),rz=mix(.205,.26,v),y=.35+v*(.86+.20*Math.abs(Math.sin(a)));return [Math.sin(a)*rx,y,Math.cos(a)*rz-.035];};
  surface('Open leather boot shaft '+s,100,48,shaftAt,leather,parent);
  surface('Leather shaft lining '+s,100,48,(u,v)=>{const p=shaftAt(u,v);return [p[0]*.973,p[1],(p[2]+.035)*.973-.035];},leatherEdge,parent);
  const lipPts=[];for(let i=0;i<=100;i++)lipPts.push(shaftAt(i/100,1));tube('Rolled leather shaft lip '+s,lipPts,.026,leatherEdge,parent,100);
  for(const side of [0,1]){const pts=[];for(let j=0;j<=40;j++)pts.push(shaftAt(side,j/40));tube('Lacing edge '+s+' '+side,pts,.019,leatherEdge,parent,48);}
  for(const side of [.24,.76]){
   const pts=[];for(let j=0;j<=30;j++)pts.push(shaftAt(side,j/30));tube('Shaft stitched seam '+s+' '+side,pts,.0045,stitchMat,parent,36);
  }
  const toeSeam=[];for(let j=0;j<=60;j++){const a=mix(-1.47,1.47,j/60);toeSeam.push([Math.sin(a)*.274,.29,.285+Math.cos(a)*.334]);}tube('Toe cap seam '+s,toeSeam,.006,leatherEdge,parent,64);
  surface('Cream leather tongue '+s,48,48,(u,v)=>{const x=(u*2-1)*(.15+.055*Math.sin(Math.PI*v)),y=.34+v*.70,z=.227+.058*Math.sin(Math.PI*v)-.045*v+.055*(1-(u*2-1)**2);return [x,y,z];},toeMat,parent);
  const tongueEdge=[];for(let j=0;j<=40;j++){const a=j/40*Math.PI;tongueEdge.push([Math.cos(a)*.157,1.02+Math.sin(a)*.052,.207+Math.sin(a)*.035]);}tube('Tongue rim '+s,tongueEdge,.014,leather,parent,40);
  for(let row=0;row<7;row++){
   const t=.10+row*.126;for(const side of [-1,1]){const p=shaftAt(side<0?1:0,t),o=mesh(new T.TorusGeometry(.023,.006,8,16),metal,'Boot eyelet '+s+' '+row+' '+side,parent);o.position.set(p[0],p[1],p[2]+.017);o.rotation.y=side*.40;}
   if(row<5){const y=.40+row*.079,x=.139+row*.008; tube('Crossed lace A '+s+' '+row,[[-x,y,.273],[0,y+.042,.333],[x+.007,y+.079,.28]],.010,laceMat,parent,16);tube('Crossed lace B '+s+' '+row,[[x,y,.281],[0,y+.042,.343],[-x-.007,y+.079,.28]],.010,laceMat,parent,16);}
  }
  tube('Bow left '+s,[[0,.76,.347],[-.16,.84,.365],[-.23,.80,.375],[-.17,.73,.377],[0,.76,.351]],.012,laceMat,parent,32);
  tube('Bow right '+s,[[0,.76,.349],[.15,.85,.36],[.23,.80,.375],[.16,.74,.377],[0,.76,.355]],.012,laceMat,parent,32);
  tube('Lace hanging left '+s,[[0,.76,.36],[-.18,.56,.38],[-.26,.33,.43],[-.31,.32,.44]],.012,laceMat,parent,32);
  tube('Lace hanging right '+s,[[0,.76,.36],[.18,.62,.38],[.26,.46,.40],[.31,.47,.39]],.012,laceMat,parent,32);
 }
 // Small facial and hair-detail surfaces do not cast harsh pixel-scale shadows over the eyes.
 meshes.forEach(o=>{if(/hair|fringe|lock|strand|lash|iris|pupil|Nose|glint|Ear/i.test(o.name))o.castShadow=false;});
 root.updateMatrixWorld(true);
 return {root,meshes,dispose(){if(root.parent)root.parent.remove(root);const geos=new Set(meshes.map(o=>o.geometry));geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},stats(){return {meshes:meshes.length,triangles:meshes.reduce((n,o)=>n+(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3,0),bounds:new T.Box3().setFromObject(root)};}};
}
