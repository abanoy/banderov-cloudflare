import * as T from '../vendor/three.module.js';
import {profile,footprint} from './castle-rules.js';

// A separate, disposable workshop view. The construction service owns every
// preview model; this module owns only the camera, renderer and grid overlays.
export function castlePreview(canvas,construction,{onPlace=()=>{},onHover=()=>{},onBuilt=()=>{}}={}){
 let buildProfile=profile();
 function plotBounds(value=buildProfile){return footprint(value);}
 function gridVertices(value=buildProfile){const b=plotBounds(value),points=[];for(let i=0;i<=value.size;i++){const x=b.minX+i*8,z=b.minZ+i*8;points.push(x,0,b.minZ,x,0,b.maxZ,b.minX,0,z,b.maxX,0,z);}return points;}
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false});
 renderer.outputEncoding=T.sRGBEncoding;renderer.setPixelRatio(1);
 canvas.style.imageRendering='pixelated';canvas.style.touchAction='none';
 const scene=new T.Scene();scene.background=new T.Color(0x769dac);
 scene.add(new T.HemisphereLight(0xe7eddf,0x68709a,.8));
 const light=new T.DirectionalLight(0xffedcf,.7);light.position.set(-80,150,100);scene.add(light);
 const camera=new T.OrthographicCamera(-100,100,100,-100,.1,2400),target=new T.Vector3(0,24,8);
 const ray=new T.Raycaster(),pointer=new T.Vector2(),hit=new T.Vector3(),plane=new T.Plane(new T.Vector3(0,1,0),-.8);
 const ownedGeometry=new Set(),ownedMaterial=new Set(),ownedTexture=new Set(),listeners=[];
 const geometry=g=>(ownedGeometry.add(g),g),material=m=>(ownedMaterial.add(m),m);
 const overlay=new T.Group();overlay.name='Selected building layer';scene.add(overlay);
 const routeOverlay=new T.Group();routeOverlay.name='Checked walking routes';scene.add(routeOverlay);
 const routeMaterial=material(new T.LineBasicMaterial({color:0xa9ffe0,transparent:true,opacity:.9,depthWrite:false}));
 function setRoutes(paths=[]){
  for(const child of [...routeOverlay.children]){routeOverlay.remove(child);ownedGeometry.delete(child.geometry);child.geometry.dispose();}
  for(const path of paths){const values=path.points||path.route||[];if(values.length<2)continue;const points=values.map(p=>new T.Vector3(p.x??p[0],(p.y??p[1])+.19,p.z??p[2]));const line=new T.Line(geometry(new T.BufferGeometry().setFromPoints(points)),routeMaterial);line.renderOrder=5;routeOverlay.add(line);}request();
 }
 const grid=new T.LineSegments(geometry(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(gridVertices(),3))),material(new T.LineBasicMaterial({color:0xc7eee8,transparent:true,opacity:.22,depthTest:false,depthWrite:false})));
 grid.renderOrder=10;overlay.add(grid);
 const sheet=new T.Mesh(geometry(new T.PlaneGeometry(1,1)),material(new T.MeshBasicMaterial({color:0x68d8d6,transparent:true,opacity:.025,side:T.DoubleSide,depthTest:false,depthWrite:false})));
 sheet.rotation.x=-Math.PI/2;sheet.scale.set(buildProfile.size*8,buildProfile.size*8,1);sheet.position.set(0,-.015,-4);sheet.renderOrder=9;overlay.add(sheet);
 const hover=new T.Group();hover.visible=false;hover.renderOrder=12;overlay.add(hover);
 const tileMaterial=material(new T.MeshBasicMaterial({color:0xa7fff0,transparent:true,opacity:.25,depthTest:false,depthWrite:false}));
 const tile=new T.Mesh(geometry(new T.PlaneGeometry(7.9,7.9)),tileMaterial);tile.rotation.x=-Math.PI/2;tile.renderOrder=12;hover.add(tile);
 const outlineMaterial=material(new T.LineBasicMaterial({color:0xe3fff0,depthTest:false,depthWrite:false}));
 const outline=new T.LineLoop(geometry(new T.BufferGeometry().setFromPoints([new T.Vector3(-4,.02,-4),new T.Vector3(4,.02,-4),new T.Vector3(4,.02,4),new T.Vector3(-4,.02,4)])),outlineMaterial);outline.renderOrder=13;hover.add(outline);
 const arrow=new T.Group();arrow.position.y=.07;hover.add(arrow);
 const arrowMaterial=material(new T.MeshBasicMaterial({color:0xf6ffdc,side:T.DoubleSide,depthTest:false,depthWrite:false}));
 const arrowHead=new T.Mesh(geometry(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,-2.8,-1.15,0,-.8,1.15,0,-.8],3))),arrowMaterial);arrowHead.renderOrder=14;arrow.add(arrowHead);
 const arrowStem=new T.Mesh(geometry(new T.BoxGeometry(.3,.035,2.7)),arrowMaterial);arrowStem.position.z=.45;arrowStem.renderOrder=14;arrow.add(arrowStem);
 function marker(text,x,z,width){
  const c=document.createElement('canvas');c.width=Math.max(40,text.length*15+20);c.height=40;const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(23,48,67,.86)';ctx.fillRect(0,0,c.width,40);ctx.strokeStyle='#a8d4ce';ctx.strokeRect(1,1,c.width-2,38);
  ctx.fillStyle='#fff3cf';ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,21);
  const texture=new T.CanvasTexture(c);texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;texture.encoding=T.sRGBEncoding;ownedTexture.add(texture);
  const sprite=new T.Sprite(material(new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false})));sprite.position.set(x,.4,z);sprite.scale.set(width,width*40/c.width,1);sprite.renderOrder=15;overlay.add(sprite);return sprite;
 }
 const northMarker=marker('N',0,plotBounds().minZ-7,8);marker('GATE',16,61,20);

 let active=false,visible=true,disposed=false,frame=0,frameCount=0,revision=0,requestedRevision=0,pending=null,current=null;
 let home=null,drawnParts=0,meshCount=0,layer=0,type='floor',rotation=0,yaw=.65,zoom=1,baseHalfHeight=100,lastError=null,fitAfterBuild=false;
 let cssWidth=0,cssHeight=0,aspect=1,hovered=null,bounds=null,fitBounds=null,modelPoints=[];
 const pointers=new Map();let pinch=null;
 function measure(){
  const rect=canvas.getBoundingClientRect(),w=Math.max(0,rect.width),h=Math.max(0,rect.height),changed=Math.abs(w-cssWidth)>.1||Math.abs(h-cssHeight)>.1;
  cssWidth=w;cssHeight=h;if(w>1&&h>1){aspect=w/h;const rw=Math.max(1,Math.round(w*.5)),rh=Math.max(1,Math.round(h*.5));if(canvas.width!==rw||canvas.height!==rh)renderer.setSize(rw,rh,false);}return changed;
 }
 function cancelFrame(){if(frame){cancelAnimationFrame(frame);frame=0;}}
 function request(){if(disposed||!active||!visible||frame)return;measure();if(cssWidth>1&&cssHeight>1)frame=requestAnimationFrame(draw);}
 function positionCamera(){
  const distance=700;camera.position.set(target.x+Math.sin(yaw)*distance,target.y+distance,target.z+Math.cos(yaw)*distance);camera.lookAt(target);camera.updateMatrixWorld(true);
 }
 function frustum(){const half=baseHalfHeight/zoom;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
 function corners(box){const out=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])out.push(new T.Vector3(x,y,z));return out;}
 function layerBounds(){const b=plotBounds();return new T.Box3(new T.Vector3(b.minX-2,.8+layer*8,b.minZ-11),new T.Vector3(b.maxX+2,3+layer*8,Math.max(b.maxZ+2,66)));}
 function updateProfile(next){
  const changed=['minX','maxX','minZ','maxZ'].some(key=>buildProfile[key]!==next[key]);buildProfile=next;
  grid.material.opacity=.22*Math.min(1,12/buildProfile.size);
  if(!changed)return;
  const old=grid.geometry;grid.geometry=geometry(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(gridVertices(),3)));ownedGeometry.delete(old);old.dispose();
  const b=plotBounds();sheet.scale.set(buildProfile.size*8,buildProfile.size*8,1);sheet.position.set((b.minX+b.maxX)/2,-.015,(b.minZ+b.maxZ)/2);northMarker.position.set((b.minX+b.maxX)/2,.4,b.minZ-7);
  if(hovered&&(hovered.x<buildProfile.minX||hovered.x>=buildProfile.maxX||hovered.z<buildProfile.minZ||hovered.z>=buildProfile.maxZ))setHover(null);
 }
 function desiredBounds(){
  const plot=plotBounds(),b=bounds?bounds.clone():new T.Box3(new T.Vector3(plot.minX,-35,plot.minZ),new T.Vector3(plot.maxX,74,81));
  b.union(layerBounds());return b;
 }
 function calculateFit(recenter=false){
  const b=desiredBounds();if(recenter)b.getCenter(target);positionCamera();
  // Project each real mesh's bounds, not the large empty corners formed by
  // combining a narrow crown with the distant entrance and hanging rock tip.
  const points=modelPoints.length?[...modelPoints,...corners(layerBounds())]:corners(b);
  const projected=new T.Vector3();let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const point of points){projected.copy(point).applyMatrix4(camera.matrixWorldInverse);minX=Math.min(minX,projected.x);maxX=Math.max(maxX,projected.x);minY=Math.min(minY,projected.y);maxY=Math.max(maxY,projected.y);}
  let extentX=Math.max(Math.abs(minX),Math.abs(maxX)),extentY=Math.max(Math.abs(minY),Math.abs(maxY));
  if(recenter){
   const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
   target.addScaledVector(right,(minX+maxX)/2).addScaledVector(up,(minY+maxY)/2);positionCamera();extentX=(maxX-minX)/2;extentY=(maxY-minY)/2;
  }
  baseHalfHeight=Math.max(35,Math.max(extentY,extentX/aspect)*1.1+2);fitBounds=b;frustum();
 }
 function modelBounds(root){
  const result=new T.Box3(),matrix=new T.Matrix4(),instance=new T.Matrix4(),box=new T.Box3();root.updateMatrixWorld(true);meshCount=0;modelPoints=[];
  function include(g,matrix){box.copy(g.boundingBox).applyMatrix4(matrix);result.union(box);for(const point of corners(g.boundingBox))modelPoints.push(point.applyMatrix4(matrix));}
  root.traverse(o=>{if(!o.isMesh||!o.geometry)return;meshCount++;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();if(!o.geometry.boundingBox)return;
   if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);matrix.multiplyMatrices(o.matrixWorld,instance);include(o.geometry,matrix);}}
   else include(o.geometry,o.matrixWorld);
  });return result;
 }
 function draw(){
  frame=0;if(disposed||!active||!visible)return;const resized=measure();if(cssWidth<=1||cssHeight<=1)return;
  if(pending){
   const draft=pending;pending=null;
   try{
    const nextProfile=profile(draft.options),next=construction.preview(draft.home,draft.layout,draft.options),old=current,changedHome=home!==draft.home;
    const changedPlot=buildProfile.size!==nextProfile.size;updateProfile(nextProfile);
    scene.add(next.root);current=next;home=draft.home;drawnParts=draft.layout.length;bounds=modelBounds(next.root);
    if(old){scene.remove(old.root);old.dispose();}
    revision++;lastError=null;onBuilt(next);
    if(fitAfterBuild||changedHome||changedPlot||!fitBounds||!fitBounds.clone().expandByScalar(.1).containsBox(desiredBounds())){zoom=1;calculateFit(true);}fitAfterBuild=false;
   }catch(error){lastError=error.message||String(error);}
  }
  if(resized||!fitBounds)calculateFit(!fitBounds);
  positionCamera();frustum();renderer.render(scene,camera);frameCount++;
  // An event or queued draft requests the next draw; hidden canvases never poll.
  if(pending)request();
 }
 function setHover(cell){
  if(cell){hover.position.set(-44+cell.x*8,.045,-48+cell.z*8);hover.visible=true;}
  else hover.visible=false;
  if(hovered?.x===cell?.x&&hovered?.z===cell?.z)return;
  hovered=cell?{x:cell.x,z:cell.z}:null;onHover(cell?.x??null,cell?.z??null);request();
 }
 function pick(clientX,clientY){
  const rect=canvas.getBoundingClientRect();if(rect.width<=1||rect.height<=1||clientX<rect.left||clientX>=rect.right||clientY<rect.top||clientY>=rect.bottom)return null;
  pointer.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);positionCamera();frustum();ray.setFromCamera(pointer,camera);
  const b=plotBounds();if(!ray.ray.intersectPlane(plane,hit)||hit.x<b.minX||hit.x>=b.maxX||hit.z<b.minZ||hit.z>=b.maxZ)return null;
  return {x:Math.floor((hit.x+48)/8),z:Math.floor((hit.z+52)/8)};
 }
 function rotate(deltaRadians){if(!Number.isFinite(deltaRadians))return;yaw=((yaw+deltaRadians+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;calculateFit(false);request();}
 function setZoom(value){zoom=Math.max(.55,Math.min(3.2,value));frustum();request();}
 function release(id){try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch{}}
 function clearPointers(){for(const id of pointers.keys())release(id);pointers.clear();pinch=null;}
 function listen(name,handler,options){canvas.addEventListener(name,handler,options);listeners.push([name,handler,options]);}
 listen('pointerdown',e=>{
  if(!active||disposed||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,multiple:false});
  try{canvas.setPointerCapture(e.pointerId);}catch{}
  if(pointers.size>=2){const pair=[...pointers.values()].slice(0,2);for(const p of pointers.values())p.multiple=true;pinch={distance:Math.max(1,Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)),zoom};setHover(null);}
  else setHover(pick(e.clientX,e.clientY));
 });
 listen('pointermove',e=>{
  if(!active||disposed)return;const p=pointers.get(e.pointerId);
  if(!p){setHover(pick(e.clientX,e.clientY));return;}e.preventDefault();
  const dx=e.clientX-p.x;p.x=e.clientX;p.y=e.clientY;
  if(pointers.size>=2&&pinch){const pair=[...pointers.values()].slice(0,2);setZoom(pinch.zoom*Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)/pinch.distance);return;}
  if(Math.hypot(p.x-p.startX,p.y-p.startY)>6)p.moved=true;
  if(p.moved||p.multiple){rotate(-dx*.008);setHover(null);}else setHover(pick(e.clientX,e.clientY));
 });
 listen('pointerup',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;e.preventDefault();pointers.delete(e.pointerId);release(e.pointerId);
  if(!pointers.size)pinch=null;
  if(active&&!p.moved&&!p.multiple&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<=6){const cell=pick(e.clientX,e.clientY);setHover(cell);if(cell)onPlace(cell.x,cell.z);}
 });
 listen('pointercancel',e=>{pointers.delete(e.pointerId);release(e.pointerId);if(!pointers.size)pinch=null;setHover(null);});
 listen('lostpointercapture',e=>{pointers.delete(e.pointerId);if(!pointers.size)pinch=null;});
 listen('pointerleave',()=>{if(!pointers.size)setHover(null);});
 listen('wheel',e=>{if(!active)return;e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?400:1;setZoom(zoom*Math.exp(-e.deltaY*unit*.0015));},{passive:false});
 listen('contextmenu',e=>e.preventDefault());
 const resizeObserver=new ResizeObserver(()=>{const changed=measure();if(changed&&cssWidth>1&&cssHeight>1)calculateFit(false);request();});resizeObserver.observe(canvas);
 const intersectionObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{const entry=entries.at(-1);visible=!!entry?.isIntersecting&&entry.intersectionRect.width>0&&entry.intersectionRect.height>0;if(visible)request();else cancelFrame();}):null;intersectionObserver?.observe(canvas);
 function fit(){zoom=1;if(pending)fitAfterBuild=true;else{measure();calculateFit(true);}request();}
 function setTool(tool){
  if(Number.isInteger(tool.layer))layer=Math.max(0,Math.min(9,tool.layer));
  if(typeof tool.type==='string')type=tool.type;
  if(Number.isInteger(tool.rotation))rotation=((tool.rotation%4)+4)%4;
  overlay.position.y=.8+layer*8;plane.constant=-overlay.position.y;arrow.rotation.y=rotation*Math.PI/2;
  tileMaterial.color.set(type==='erase'?0xffa7a2:0xa7fff0);outlineMaterial.color.set(type==='erase'?0xffd1b7:0xe3fff0);
  if(fitBounds&&!fitBounds.clone().expandByScalar(.1).containsBox(desiredBounds())){zoom=1;calculateFit(true);}request();
 }
 setTool({layer:0,type:'floor',rotation:0});
 return {
  setDraft(nextHome,layout,options){if(disposed)return;pending={home:nextHome,layout:layout.map(p=>({...p})),options:options?{...options}:undefined};requestedRevision++;request();},
  setTool,
  setActive(value){active=!!value;if(active)request();else{cancelFrame();clearPointers();}},
  rotate,fit,
  setRoutes,
  focusCell(cell){target.set(-44+cell.x*8,3+(cell.layer||0)*8,-48+cell.z*8);baseHalfHeight=26;zoom=1;setHover(cell);positionCamera();frustum();request();},
  get camera(){return camera;},
  get root(){return current?.root??null;},
  get scene(){return scene;},
  get metrics(){
   const rect=canvas.getBoundingClientRect(),cells=[];positionCamera();frustum();
   for(let z=buildProfile.minZ;z<buildProfile.maxZ;z++)for(let x=buildProfile.minX;x<buildProfile.maxX;x++){const point=new T.Vector3(-44+x*8,.8+layer*8,-48+z*8).project(camera);cells.push({x,z,clientX:rect.left+(point.x+1)*rect.width/2,clientY:rect.top+(1-point.y)*rect.height/2,visible:Math.abs(point.x)<=1&&Math.abs(point.y)<=1});}
   return {active,visible,disposed,home,layer,type,rotation,yaw,zoom,pixelScale:.5,profile:{...buildProfile},plotBounds:plotBounds(),buildRevision:revision,requestedRevision,drawnParts,meshCount,frameCount,pending:!!pending,lastError,hovered:hovered?{...hovered}:null,cssSize:[cssWidth,cssHeight],renderSize:[canvas.width,canvas.height],bounds:bounds?{min:bounds.min.toArray(),max:bounds.max.toArray()}:null,cells,memory:{...renderer.info.memory},calls:renderer.info.render.calls};
  },
  dispose(){if(disposed)return;disposed=true;active=false;cancelFrame();clearPointers();resizeObserver.disconnect();intersectionObserver?.disconnect();for(const [name,handler,options] of listeners)canvas.removeEventListener(name,handler,options);if(current){scene.remove(current.root);current.dispose();current=null;}for(const g of ownedGeometry)g.dispose();for(const m of ownedMaterial)m.dispose();for(const texture of ownedTexture)texture.dispose();renderer.dispose();pending=null;}
 };
}
