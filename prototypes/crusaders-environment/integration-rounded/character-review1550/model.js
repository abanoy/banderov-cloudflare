import * as T from '../vendor/three.module.js';
import {createLightingBank} from './lighting.js';
export const DEFAULTS={headRadius:.66,headDepth:.58,headY:1.40,cheekFullness:.22,chinTaper:.22,faceProjection:.055,earY:-.30,ink:.006,bodyWidth:.23725,eyeSpacing:.255,hair:'#805011',skin:'#f1ddcc',iris:'#428cad',shirt:'#faf9ed',trim:'#08495c',legs:'#293848'};
// World +Z is anatomical forward; -X is anatomical right. Feet rest on Y=0.
// Front circular head is owner direction. Depth/back anatomy are interpretations.
export function createChibi(options={}){
 const economical=options.geometryDetail==='economical';
 const roundedHair=options.hairContour!=='angular';
 const bank=createLightingBank(),p={...DEFAULTS,...options},root=new T.Group(),head=new T.Group(),torso=new T.Group(),face=new T.Group(),outlines=[],materials=[],geometries=[],parts={};let expression='neutral',pose='neutral',time=0,disposed=false,lightingMode='flat';
 head.position.y=p.headY;torso.scale.x=p.bodyWidth/.235;torso.scale.y=1.34;root.add(head,torso);head.add(face);
 const mat=(color)=>{const m=new T.MeshBasicMaterial({color});m.userData.color=color; m.userData.variants=bank.variants(m);materials.push(m);return m;};
 const skin=mat(p.skin),hair=mat(p.hair),shirt=mat(p.shirt),trim=mat(p.trim),legs=mat(p.legs),ink=mat('#211e18'),white=mat('#f8f8f4'),iris=mat(p.iris),tie=mat('#e94c37');
 const mesh=(geo,m,parent=root,name='',outline=true)=>{geometries.push(geo);let o=new T.Mesh(geo,m);o.name=name;parent.add(o);if(name)parts[name]=o;if(outline){let om=new T.MeshBasicMaterial({color:'#211e18',side:T.BackSide});materials.push(om);let shell=new T.Mesh(geo,om);shell.scale.setScalar(1.018);shell.userData.outline=true;o.add(shell);outlines.push(shell);}return o;};
 const ell=(x,y,z,sx,sy,sz,m,parent,name)=>{let o=mesh(new T.SphereGeometry(1,economical?16:32,economical?12:20),m,parent,name);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o;};
 // Circular cranium is the construction base; cheek/chin shaping is an authored
 // lower-face adaptation. Sphere depth is independent of the frontal circle.
 const widthAt=y=>{const t=y/p.headRadius;return 1+p.cheekFullness*Math.exp(-1*((t+.57)/.25)**2)-p.chinTaper*Math.max(0,(-t-.67)/.33);};
 const faceDepthAt=(x,y)=>{const w=widthAt(y);return p.headDepth*Math.sqrt(Math.max(.015,1-(x/(p.headRadius*w))**2-(y/p.headRadius)**2))+p.faceProjection*Math.exp(-1*((y/p.headRadius+.45)/.35)**2);};
 const skull=new T.SphereGeometry(1,economical?40:64,economical?32:48),sp=skull.attributes.position;
 for(let i=0;i<sp.count;i++){const x=sp.getX(i)*p.headRadius,y=sp.getY(i)*p.headRadius,z=sp.getZ(i)*p.headDepth;sp.setXYZ(i,x*widthAt(y),y,z+(z>0?p.faceProjection*Math.exp(-1*((y/p.headRadius+.45)/.35)**2)*(z/p.headDepth):0));}skull.computeVertexNormals();
 mesh(skull,skin,head,'circular-head');
 // Inferred ears meet the lower cheek instead of protruding as isolated spots
 // through the dome. earY:-.06 preserves the earlier placement for comparison.
 ell(-.635,p.earY,-.005,.065,.11,.075,skin,head,'right-ear');ell(.635,p.earY,-.008,.062,.105,.072,skin,head,'left-ear');
 // Hair dome: authored varying lower rim, genuine curved vertex surface.
 const v=[],idx=[],N=economical?40:64,M=economical?14:18;
 const rim=(a)=>{const c=Math.cos(a);return c>.35?1.29:1.29+(1.08)*(1-c)/2;};
 for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){let a=i/N*Math.PI*2,t=j/M*rim(a);v.push(.681*Math.sin(t)*Math.sin(a)*widthAt(.681*Math.cos(t)),.681*Math.cos(t),(p.headDepth+.045)*Math.sin(t)*Math.cos(a));}
 for(let j=0;j<M;j++)for(let i=0;i<N;i++){let a=j*(N+1)+i,b=a+N+1;idx.push(a,b,a+1,b,b+1,a+1);}
 const dome=new T.BufferGeometry();dome.setAttribute('position',new T.Float32BufferAttribute(v,3));dome.setIndex(idx);dome.computeVertexNormals();mesh(dome,hair,head,'hair-dome');
 const surface=(x,y,offset=0)=>faceDepthAt(x,y)+offset;
 // Small polygon patches are tessellated, then wrapped onto head depth.
 function patch(points,m,parent,name,offset=.012,outline=false){let shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));let geo=new T.ShapeGeometry(shape,16);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,surface(pos.getX(i),pos.getY(i),offset));geo.computeVertexNormals();return mesh(geo,m,parent,name,outline);}
 function stroke(points,parent=face,r=p.ink,m=ink,offset=.023,maxSegments=Infinity){let curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(x,y,surface(x,y,offset))));return mesh(new T.TubeGeometry(curve,Math.min(maxSegments,Math.max(12,points.length*(economical?3:6))),r,5,false),m,parent,'',false);}
 function hairShape(points){if(!roundedHair)return new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));const shape=new T.Shape(),fraction=.20;for(let i=0;i<points.length;i++){const before=points[(i+points.length-1)%points.length],at=points[i],after=points[(i+1)%points.length],a=[at[0]+(before[0]-at[0])*fraction,at[1]+(before[1]-at[1])*fraction],b=[at[0]+(after[0]-at[0])*fraction,at[1]+(after[1]-at[1])*fraction];if(i===0)shape.moveTo(...a);else shape.lineTo(...a);shape.quadraticCurveTo(...at,...b);}shape.closePath();return shape;}
 // Extruded caps need interior samples before spherical wrapping; otherwise
 // a broad triangle's straight chord can pass beneath the curved skull.
 function fittedHairGeometry(original){const source=original.index?original.toNonIndexed():original,positions=source.attributes.position,uvs=source.attributes.uv,out=[],uv=[];const vertex=i=>[positions.getX(i),positions.getY(i),positions.getZ(i),uvs.getX(i),uvs.getY(i)];const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);function triangle(a,b,c,depth=0){const edge=(v,w)=>Math.hypot(v[0]-w[0],v[1]-w[1]);if(depth<5&&Math.max(edge(a,b),edge(b,c),edge(c,a))>.10){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);}else for(const v of[a,b,c]){out.push(...v.slice(0,3));uv.push(...v.slice(3));}}for(let i=0;i<positions.count;i+=3)triangle(vertex(i),vertex(i+1),vertex(i+2));const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(out,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(source!==original)source.dispose();original.dispose();return geometry;}
 // Solid locks have front and rear authored layers; never mirrored finished views.
 function lock(points,name,offset=.025,thickness=.045){let shape=hairShape(points);let geo=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.008,curveSegments:roundedHair?4:12});if(roundedHair)geo=fittedHairGeometry(geo);let a=geo.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,surface(a.getX(i),a.getY(i),offset)+a.getZ(i));geo.computeVertexNormals();let o=mesh(geo,hair,head,name,!(roundedHair&&name==='fringe'));const boundary=roundedHair?shape.getPoints(4).map(v=>[v.x,v.y]):[...points,points[0]];const rim=roundedHair&&name==='fringe'?points.slice(6).concat([points[0]]):boundary;stroke(rim,head,.005,ink,offset+thickness+.012,roundedHair?(economical?96:160):Infinity);return o;}
 lock([[-.65,.09],[-.59,.36],[-.39,.52],[-.12,.61],[.2,.61],[.43,.48],[.56,.24],[.61,.05],[.48,.13],[.39,.38],[.3,.16],[.03,.16],[-.11,.42],[-.16,.19],[-.42,.13]],'fringe');
 lock([[-.1,.49],[-.02,.38],[.005,.16],[.09,-.025],[.17,-.09],[.07,-.055],[-.04,.035],[-.11,.18],[-.15,.34]],'central-sweep',.041,.055);
 lock([[-.62,.15],[-.55,.06],[-.55,-.18],[-.5,-.37],[-.59,-.3],[-.65,-.12]],'right-short-lock',.018,.065);
 lock([[.53,.33],[.63,.13],[.64,-.1],[.6,-.32],[.5,-.46],[.52,-.2],[.51,.09]],'left-long-lock',.023,.07);
 // Leaf tuft is volumetric, attached to a fixed anatomical side.
 let tuft=mesh(new T.ExtrudeGeometry(hairShape([[-.32,.66],[-.11,.77],[.06,.77],[.095,.73],[-.07,.735]]),{depth:roundedHair?.095:.055,bevelEnabled:true,bevelSize:.008,bevelThickness:.009,bevelSegments:2,curveSegments:roundedHair?4:12}),hair,head,'leaf-tuft');tuft.position.z=-.03;
 stroke([[-.44,.27],[-.445,.21],[-.42,.14]],head,.004,ink,.04);stroke([[.1,.32],[.13,.24],[.14,.17]],head,.004,ink,.04);stroke([[.22,.34],[.25,.25],[.26,.17]],head,.004,ink,.04);
 function clearFace(){while(face.children.length){const o=face.children.pop();o.traverse(a=>{if(a.geometry){a.geometry.dispose();let i=geometries.indexOf(a.geometry);if(i>=0)geometries.splice(i,1);}});o.parent=null;}}
 function drawFace(){clearFace();let happy=expression==='happy',alarmed=expression==='alarmed',shock=expression==='surprised'||alarmed;
  const opening=expression==='neutral'&&p.neutralEyeContour==='narrow'?.78:1;
  for(const [x,w,h] of [[-p.eyeSpacing,.205,.108],[p.eyeSpacing,.184,.096]]){
   if(happy){stroke([[x-w,-.14],[x,-.08],[x+w,-.14]]);continue;}
   let pts=[];for(let i=0;i<=20;i++){let t=i/20*Math.PI;pts.push([x+w*Math.cos(t),-.13-(shock?.13:h*opening)*Math.sin(t)]);}for(let i=1;i<=12;i++){let t=i/12;pts.push([x-w+2*w*t,-.13-.012*Math.sin(t*Math.PI)]);}
   if(shock){pts=[];for(let i=0;i<32;i++){let a=i/32*Math.PI*2;pts.push([x+(alarmed?(x<0?.15:.135):.095)*Math.cos(a),-.15+(alarmed?.145:.115)*Math.sin(a)]);}}
   patch(pts,white,face,'eye-white',.018);stroke([...pts,pts[0]],face,p.ink,ink,.027);
   if(!shock){let ip=[];const irisWidth=Number.isFinite(p.irisWidth)?Math.max(.03,Math.min(.08,p.irisWidth)):.048;for(let i=0;i<=16;i++){let a=Math.PI*i/16;ip.push([x+irisWidth*Math.cos(a),-.144-.073*opening*Math.sin(a)]);}patch(ip,iris,face,'iris',.031);stroke([...ip,ip[0]],face,.0035,ink,.04);stroke([[x-w-.01,-.119],[x,-.137],[x+w+.016,-.115]],face,.008,ink,.041);}
   stroke(alarmed?[[x-w,-.05],[x,.005],[x+w,-.04]]:[[x-w,-.065],[x,-.06],[x+w,-.05]],face,.003,ink,.029);
  }
  if(alarmed){patch([[-.15,-.29],[-.08,-.275],[.015,-.32],[.16,-.33],[.14,-.435],[.045,-.455],[-.10,-.42]],ink,face,'mouth',.024);}else if(shock){let pts=[];for(let i=0;i<28;i++){let a=i/28*Math.PI*2;pts.push([.038*Math.cos(a),-.315+.058*Math.sin(a)]);}patch(pts,ink,face,'mouth',.024);}else if(happy)stroke([[-.04,-.32],[0,-.35],[.044,-.315]],face,.005);else stroke([[-.036,-.34],[0,-.273],[.045,-.337]],face,.005);
  if(options.batchFaceInk===true)batchFaceInk();
 }
 function batchFaceInk(){
  const strokes=face.children.filter(o=>o.isMesh&&o.material===ink&&!o.name);
  if(strokes.length<2)return;
  const merged=new T.BufferGeometry();
  for(const attribute of ['position','normal','uv']){const values=[];let size;for(const o of strokes){const a=o.geometry.getAttribute(attribute);size=a.itemSize;const index=o.geometry.index;for(let i=0;i<(index?index.count:a.count);i++){const n=index?index.getX(i):i;for(let k=0;k<size;k++)values.push(a.array[n*size+k]);}}merged.setAttribute(attribute,new T.Float32BufferAttribute(values,size));}
  for(const o of strokes){face.remove(o);o.geometry.dispose();geometries.splice(geometries.indexOf(o.geometry),1);}
  mesh(merged,ink,face,'face-ink-batch',false);
 }
 drawFace();
 // Optional batching changes only static hair ink submission, retaining its
 // exact vertices, material and parent transform. Face stays independently editable.
 if(options.batchStaticInk!==false){
  const strokes=head.children.filter(o=>o.isMesh&&o.material===ink&&!o.name);
  if(strokes.length){const merged=new T.BufferGeometry();for(const attribute of ['position','normal','uv']){const values=[];let size;for(const o of strokes){const a=o.geometry.getAttribute(attribute);size=a.itemSize;const index=o.geometry.index;for(let i=0;i<(index?index.count:a.count);i++){const n=index?index.getX(i):i;for(let k=0;k<size;k++)values.push(a.array[n*size+k]);}}merged.setAttribute(attribute,new T.Float32BufferAttribute(values,size));}for(const o of strokes){head.remove(o);o.geometry.dispose();geometries.splice(geometries.indexOf(o.geometry),1);}mesh(merged,ink,head,'hair-ink-batch',false);}
 }
 const hairPieces=head.children.filter(o=>o!==face&&!['circular-head','right-ear','left-ear'].includes(o.name));
 const guides=new T.Group();guides.name='head-construction-guides';guides.visible=false;head.add(guides);
 const guideMaterial=new T.LineBasicMaterial({color:'#b24363',depthTest:false});materials.push(guideMaterial);
 function guide(points){const g=new T.BufferGeometry().setFromPoints(points);geometries.push(g);const line=new T.Line(g,guideMaterial);line.renderOrder=5;guides.add(line);}
 guide(Array.from({length:65},(_,i)=>{let a=i/64*Math.PI*2;return new T.Vector3(p.headRadius*Math.sin(a),p.headRadius*Math.cos(a),.01);}));
 guide(Array.from({length:41},(_,i)=>{const x=-.62+i/40*1.24;return new T.Vector3(x,-.13,surface(x,-.13,.02));}));
 guide(Array.from({length:41},(_,i)=>{const y=-.62+i/40*1.24;return new T.Vector3(0,y,surface(0,y,.022));}));
 // Compact shirt body and sleeves from the frontal drawing; back is inferred.
 let body=mesh(new T.LatheGeometry([new T.Vector2(0,-.17),new T.Vector2(.16,-.17),new T.Vector2(.205,-.15),new T.Vector2(.22,-.10),new T.Vector2(.208,0),new T.Vector2(.19,.10),new T.Vector2(.145,.16),new T.Vector2(0,.17)],32),shirt,torso,'sailor-shirt');body.position.y=.405;body.scale.z=.65;
 ell(0,.63,0,.10,.12,.09,skin,torso,'neck');
 const collarGeo=new T.ConeGeometry(.225,.14,4);let collar=mesh(collarGeo,trim,torso,'collar');collar.rotation.y=Math.PI/4;collar.scale.z=.69;collar.position.set(0,.58,0);
 function bodyPatch(points,m,name,z=.17){let shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));let o=mesh(new T.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false}),m,torso,name);o.position.z=z;return o;}
 bodyPatch([[-.17,.585],[0,.34],[.17,.585],[.095,.60],[0,.435],[-.095,.60]],trim,'front-collar');
 bodyPatch([[-.032,.41],[0,.38],[.032,.41],[.04,.3],[0,.32],[-.04,.3]],tie,'red-tie',.195);
 let arms=[];for(const [side,x]of [['right',-.255],['left',.255]]){let g=new T.Group();g.name=side+'-arm-rig';g.position.set(x,.535,0);torso.add(g);arms.push(g);let o=mesh(new T.SphereGeometry(1,24,16),skin,g,side+'-arm');o.rotation.z=x<0?-.45:.45;o.position.set(x<0?-.035:.035,-.075,0);o.scale.set(.075,.105,.07);let sleeve=mesh(new T.CylinderGeometry(.08,.095,.07,20),trim,g,side+'-sleeve');sleeve.position.set(x<0?-.018:.018,-.035,0);sleeve.rotation.z=x<0?-.45:.45;sleeve.scale.z=.74;ell(x<0?-.07:.07,-.205,.012,.063,.045,.05,skin,g,side+'-hand');}
 let feet=[];for(const [side,x]of [['right',-.093],['left',.09]]){let g=new T.Group();g.position.set(x,.23725,0);torso.add(g);feet.push(g);ell(0,-.10,0,.065,.12,.066,legs,g,side+'-leg');ell(0,-.195,.042,.078,.04,.115,legs,g,side+'-foot');}
 // Cache the actual sampled sole, including ink, so the stance foot can stay
 // on its neutral plane while the torso bobs. No world collision is changed.
 function soleHull(points){const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const half=list=>{const result=[];for(const point of list){while(result.length>1&&cross(result[result.length-2],result[result.length-1],point)<=0)result.pop();result.push(point);}result.pop();return result;};return half(sorted).concat(half(sorted.slice().reverse()));}
 const footSupports=feet.map((_,i)=>{const foot=parts[(i===0?'right':'left')+'-foot'],a=foot.geometry.attributes.position,points=[];let minimum=Infinity;for(let j=0;j<a.count;j++){const y=foot.position.y+a.getY(j)*foot.scale.y*1.018,z=foot.position.z+a.getZ(j)*foot.scale.z*1.018;points.push([y,z]);minimum=Math.min(minimum,y);}return {points:p.supportCache==='vertices'?points:soleHull(points),plane:(.23725+minimum)*torso.scale.y};});
 root.updateMatrixWorld(true);
 // Optional body ink study: expand only shirt/arm/hand shells along their
 // geometry axes. Head and sole shells retain the owner's existing contour.
 // This is rest-pose native-space expansion, not a screen-pixel outline.
 if(p.bodyOutline==='defined')for(const name of ['sailor-shirt','right-arm','left-arm','right-hand','left-hand','right-sleeve','left-sleeve']){
  const o=parts[name],shell=o.children.find(c=>c.userData.outline);o.geometry.computeBoundingBox();const box=o.geometry.boundingBox,scale=o.getWorldScale(new T.Vector3());
  for(const axis of ['x','y','z']){const extent=Math.max(Math.abs(box.min[axis]),Math.abs(box.max[axis]));if(extent>0&&scale[axis]>0)shell.scale[axis]=Math.max(1.018,1+.012/(extent*scale[axis]));}
 }
 function applyLighting(mode){lightingMode=mode;root.traverse(o=>{if(!o.isMesh||o.userData.outline)return;const base=materials.find(m=>m.userData.variants&&Object.values(m.userData.variants).includes(o.material));if(base)o.material=base.userData.variants[mode]||base;});}
 function reset(){time=0;pose='neutral';head.position.y=p.headY;head.rotation.set(0,0,0);tuft.rotation.set(0,0,0);torso.position.y=0;arms.forEach(a=>a.rotation.set(0,0,0));feet.forEach(f=>{f.rotation.set(0,0,0);f.position.y=.23725;});}
 function update(dt){if(disposed)return;time+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));let walking=pose==='walk',idle=pose==='idle',waving=pose==='wave',gasping=pose==='gasp';let s=Math.sin(time*7);torso.position.y=walking?.008*(1-Math.cos(time*14)):0;head.position.y=p.headY+(idle?.007*Math.sin(time*2):torso.position.y);head.rotation.z=walking?.018*s:waving?.035*Math.sin(time*3):0;tuft.rotation.z=walking?.025*s:0;arms.forEach((a,i)=>{a.rotation.x=walking?s*.24*(i?1:-1):0;a.rotation.y=p.gestureReach==='forward'&&(gasping||waving&&i===0)?(i?-1:1)*.75:0;a.rotation.z=gasping?(i?1:-1)*1.05:waving&&i===0?-1.45+.10*Math.sin(time*8):0;});feet.forEach((f,i)=>{let phase=s*(i?1:-1);f.rotation.x=walking?phase*.28:0;f.position.y=.23725+(walking?Math.max(0,phase)*.035:0);if(walking&&p.gaitContact!=='legacy'){const support=footSupports[i],c=Math.cos(f.rotation.x),sn=Math.sin(f.rotation.x);let min=Infinity;for(const [y,z]of support.points)min=Math.min(min,y*c-z*sn);f.position.y=(support.plane-torso.position.y)/torso.scale.y-min+Math.max(0,phase)*.035;}});}
 return {root,parts,parameters:p,height:new T.Box3().setFromObject(root).max.y,feetAnchor:new T.Vector3(0,0,0),update,reset,setPose(value){reset();pose=['neutral','idle','walk','wave','gasp'].includes(value)?value:'neutral';update(0);},setFacing(radians){if(Number.isFinite(radians))root.rotation.y=radians;},setExpression(value){if(disposed)return;const next=['neutral','happy','surprised','alarmed'].includes(value)?value:'neutral';if(next!==expression){expression=next;drawFace();applyLighting(lightingMode);}},setHeadStudy(enabled){guides.visible=enabled;hairPieces.forEach(o=>o.visible=!enabled);},setConstruction(enabled){materials.forEach(m=>{if(m.side===T.BackSide)return;Object.values(m.userData.variants||{flat:m}).forEach(v=>v.wireframe=enabled);});outlines.forEach(o=>o.visible=!enabled);},setOutline(enabled){outlines.forEach(o=>o.visible=enabled);},setLighting:applyLighting,setLight(direction){bank.setLight(direction);},bounds(){root.updateMatrixWorld(true);return new T.Box3().setFromObject(root);},stats(){let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});return {triangles,geometries:geometries.length,materials:materials.length,textureBytes:bank.textureBytes};},dispose(){if(disposed)return;disposed=true;if(root.parent)root.parent.remove(root);new Set(geometries).forEach(g=>g.dispose());new Set(materials).forEach(m=>m.dispose());bank.dispose();},get disposed(){return disposed;},get pose(){return pose;}};
}
