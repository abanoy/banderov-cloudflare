import * as T from '../vendor/three.module.js';
import {profile,footprint,LAYERS} from './castle-rules.js';
import {sky,retroRenderer,applySkyPreset,activeSky} from './atmosphere.js?v=dbc-20261018';
import {MARKER_ICONS,drawPixelIcon,northMarkerMap} from './part-icons.js?v=aerie-20261018';

// A separate, disposable workshop view. The construction service owns every
// preview model; this module owns only the camera, renderer and grid overlays.
// Auto layer: the pointer ray picks the plot column the player sees (the built model; before the first build, the
// builder's height(x,z) surface layers, null for an empty plot); targetLayer(x,z) names the layer a piece would go to
// and check(x,z,layer) returns null or {code,text,short} for a placement the rules refuse (red hover). Fixed layers keep
// the flat plane pick. onMiss() hears a tap that picked no plot (open sky, off the model), so the builder can say why.
// bands() names the camera bar over the canvas bottom ({bottom, left, right}: CSS px from the canvas bottom and left
// edges); Fit keeps the N and gate markers clear of it.
// Touch and pen have no hover, so their first tap on a plot aims (gold tile, onAim(cell)) and a second tap on the same
// column places; a refused plot or open sky answers at once. Mouse clicks place as before. flash(cell) shows where an
// edit landed once the next model is built and onFlash({x,z,layer,erase,hidden}) says which column, if any, hides it.
// targetRect(cell,kind) is where the aimed tile or an edit's cue shows (client px), and onView() hears the camera move
// while either shows, so the builder's note over the preview can keep off it.
export function castlePreview(canvas,construction,{onPlace=()=>{},onHover=()=>{},onBuilt=()=>{},onMiss=()=>{},onAim=()=>{},onFlash=()=>{},onView=()=>{},height=()=>null,targetLayer=null,check=()=>null,bands=()=>null}={}){
 let buildProfile=profile();
 function plotBounds(value=buildProfile){return footprint(value);}
 function gridVertices(value=buildProfile){const b=plotBounds(value),points=[];for(let i=0;i<=value.size;i++){const x=b.minX+i*8,z=b.minZ+i*8;points.push(x,0,b.minZ,x,0,b.maxZ,b.minX,0,z,b.maxX,0,z);}return points;}
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false});
 renderer.outputEncoding=T.sRGBEncoding;renderer.setPixelRatio(1);
 canvas.style.imageRendering='pixelated';canvas.style.touchAction='none';
 // Same dithered sky and retro post pass as the match, so the workshop shows what battle shows.
 const scene=new T.Scene(),post=retroRenderer(renderer,{measure:true});
 // Same light rig as the match (main.js: one hemisphere light at .7, palette pairs do the shading) plus the active
 // sky preset and the match fog shifted by the extra preview camera distance, so the preview is not cooler or greyer.
 // No preset is marked applied yet, so the first syncSky() sets the active preset's hemisphere and fog (Day included).
 const hemi=new T.HemisphereLight(0xe7eddf,0x68709a,.7);scene.add(hemi);
 const FOG_SHIFT=350*Math.SQRT2;scene.fog=new T.Fog(0xa8c8cb,600-380*.45+FOG_SHIFT,1200-350*.45+FOG_SHIFT);let skyName='';
 function syncSky(){const live=activeSky();if(live.name!==skyName){skyName=live.name;applySkyPreset(skyName,{scene,hemi});}const fog=live.fog;if(fog){scene.fog.color.copy(fog.color);scene.fog.near=fog.near+FOG_SHIFT;scene.fog.far=fog.far+FOG_SHIFT;}}
 const camera=new T.OrthographicCamera(-100,100,100,-100,.1,2400),target=new T.Vector3(0,24,8);
 // Pan: a world offset of the view from the fitted target (Fit and every recentring clear it). Zooming about the cursor
 // or a pinch midpoint and two-finger (or right-button) drags move it, clamped so the fitted content stays in view.
 const pan=new T.Vector3(),view=new T.Vector3(),axisX=new T.Vector3(),axisY=new T.Vector3();
 const ray=new T.Raycaster(),pointer=new T.Vector2(),hit=new T.Vector3(),plane=new T.Plane(new T.Vector3(0,1,0),-.8);
 const ownedGeometry=new Set(),ownedMaterial=new Set(),ownedTexture=new Set(),listeners=[];
 ownedTexture.add(scene.background=sky());ownedMaterial.add(post.material);
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
 // A refused target turns the tile red and crosses it out (the rotation arrow hides).
 const cross=new T.Group();cross.position.y=.08;cross.visible=false;hover.add(cross);
 const crossMaterial=material(new T.MeshBasicMaterial({color:0xffd6cf,depthTest:false,depthWrite:false}));
 for(const angle of [Math.PI/4,-Math.PI/4]){const bar=new T.Mesh(geometry(new T.BoxGeometry(.7,.035,7.4)),crossMaterial);bar.rotation.y=angle;bar.renderOrder=14;cross.add(bar);}
 // Pixel-icon markers keep a fixed on-screen size (one texel per render pixel), so pixelation never garbles them.
 function iconTexture(map){
  const c=document.createElement('canvas');c.width=map[0].length;c.height=map.length;drawPixelIcon(c.getContext('2d'),map);
  const texture=new T.CanvasTexture(c);texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;texture.encoding=T.sRGBEncoding;ownedTexture.add(texture);return texture;
 }
 function marker(texture,x,z,size,anchorY){
  const sprite=new T.Sprite(material(new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,transparent:true,alphaTest:.5})));sprite.position.set(x,.4,z);sprite.center.set(.5,anchorY);sprite.userData.pixels=size;sprite.renderOrder=15;overlay.add(sprite);return sprite;
 }
 const northTextures=Array.from({length:8},(_,octant)=>iconTexture(northMarkerMap(octant)));
 // Hover pin: a fixed-size pixel arrow over the target tile (cyan place, amber erase) or a red cross when refused, so
 // the target reads even when a whole level-100 plot fits the preview and one plot is only a few pixels wide.
 function pinTexture(rows,colors){
  const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d'),at=(x,y)=>rows[y]?.[x]&&rows[y][x]!=='.';
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(at(x,y))g.fillStyle=colors[rows[y][x]];else if(at(x+1,y)||at(x-1,y)||at(x,y+1)||at(x,y-1))g.fillStyle='#231a2e';else continue;g.fillRect(x,y,1,1);}
  const texture=new T.CanvasTexture(c);texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;texture.encoding=T.sRGBEncoding;ownedTexture.add(texture);return texture;
 }
 const ARROW=['................','.....aaaaaa.....','.....abbbba.....','.....abbbba.....','.....abbbba.....','..aaaabbbbaaaa..','..abbbbbbbbbba..','...abbbbbbbba...','....abbbbbba....','.....abbbba.....','......abba......','.......aa.......','................','................','................','................'];
 const CROSS=['................','................','..aa........aa..','..aba......aba..','...aba....aba...','....aba..aba....','.....abaaba.....','......abba......','......abba......','.....abaaba.....','....aba..aba....','...aba....aba...','..aba......aba..','..aa........aa..','................','................'];
 // A four-point spark (the placement cue): two-pixel arms round a small diamond.
 const SPARK=Array.from({length:16},(_,y)=>Array.from({length:16},(_,x)=>{const dx=Math.abs(x-7.5),dy=Math.abs(y-7.5);return dx+dy<=1.5?'c':dx+dy<=3.5||(dx<1&&dy<7)||(dy<1&&dx<7)?'b':'.';}).join(''));
 const pinTextures={place:pinTexture(ARROW,{a:'#267e8a',b:'#b8fff2'}),aim:pinTexture(ARROW,{a:'#8a5f2a',b:'#ffe08a'}),erase:pinTexture(ARROW,{a:'#b9683a',b:'#ffd9a0'}),refused:pinTexture(CROSS,{a:'#8f1d24',b:'#ff6b5e'}),spark:pinTexture(SPARK,{b:'#ffd27a',c:'#fffbe8'})};
 const northMarker=marker(northTextures[0],plotBounds().minX-6,plotBounds().minZ-8,24,.5),gateMarker=marker(iconTexture(MARKER_ICONS.gate),16,61,16,1/16);
 northMarker.name='North marker';gateMarker.name='Gate marker';
 const pin=marker(pinTextures.place,0,0,16,.25);overlay.remove(pin);pin.position.set(0,.6,0);pin.name='Placement pin';hover.add(pin);
 // Placement cue: a bright-edged gold box over the piece just placed (amber where one was erased), drawn through the model
 // so a piece behind a taller neighbour still shows where it went, and a fixed-size spark over its top. A hover tile on
 // the cued column steps aside while it shows (a pointer elsewhere keeps its tile); it fades over FLASH_MS and only then
 // do frames stop. No fog: full colour at the preview's long camera distance.
 const FLASH_MS=1000,flashGroup=new T.Group();flashGroup.name='Placement cue';flashGroup.visible=false;scene.add(flashGroup);
 const unitBox=geometry(new T.BoxGeometry(1,1,1));
 const flashFill=new T.Mesh(unitBox,material(new T.MeshBasicMaterial({color:0xffb000,transparent:true,opacity:0,fog:false,depthTest:false,depthWrite:false})));flashFill.renderOrder=16;flashGroup.add(flashFill);
 const flashEdges=new T.LineSegments(geometry(new T.EdgesGeometry(unitBox)),material(new T.LineBasicMaterial({color:0xfff8e0,transparent:true,opacity:0,fog:false,depthTest:false,depthWrite:false})));flashEdges.renderOrder=17;flashGroup.add(flashEdges);
 const spark=new T.Sprite(material(new T.SpriteMaterial({map:pinTextures.spark,fog:false,depthTest:false,depthWrite:false,transparent:true})));spark.center.set(.5,0);spark.userData.pixels=16;spark.renderOrder=18;spark.name='Placement spark';flashGroup.add(spark);
 const fixedSprites=[northMarker,gateMarker,pin,spark];
 function updateMarkers(){
  const unitsPerPixel=(camera.top-camera.bottom)/Math.max(1,canvas.height);
  for(const sprite of fixedSprites)sprite.scale.set(sprite.userData.pixels*unitsPerPixel,sprite.userData.pixels*unitsPerPixel,1);
  // Screen direction of world north (-Z) under the 45-degree elevation, snapped to eight pixel-drawn pointers.
  const octant=((Math.round(Math.atan2(Math.sin(yaw),Math.cos(yaw)*Math.SQRT1_2)/(Math.PI/4))%8)+8)%8;
  if(northMarker.material.map!==northTextures[octant])northMarker.material.map=northTextures[octant];
 }

 let active=false,visible=true,disposed=false,frame=0,frameCount=0,revision=0,requestedRevision=0,pending=null,current=null;
 let contentX=100,contentY=100,home=null,drawnParts=0,meshCount=0,layer=0,type='floor',rotation=0,yaw=.65,zoom=1,baseHalfHeight=100,lastError=null,fitAfterBuild=false;
 let cssWidth=0,cssHeight=0,aspect=1,hovered=null,bounds=null,fitBounds=null,modelPoints=[],calls=0,auto=false,hoverKey='',lastPointer=null,cleared=false,bandBottom=0,bandLeft=0,bandRight=0;
 const pointers=new Map();let pinch=null,aimed=null,flashing=false,flashAt=0,pendingFlash=null,flashCell=null,lastFlash=null,hoverDrawn=false;
 const coarse=(()=>{try{return matchMedia('(pointer:coarse)');}catch{return null;}})(),calm=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)');}catch{return null;}})();
 // Touch screens zoom two and a half times as far: a level-100 plot (under 4 px across at Fit in a short landscape
 // preview) reaches about 30 px, a fingertip.
 const maxZoom=()=>coarse?.matches?8:3.2;
 // A resize clears the WebGL drawing buffer (cleared=true): the caller draws in the same frame so no black frame shows.
 function measure(){
  const rect=canvas.getBoundingClientRect(),w=Math.max(0,rect.width),h=Math.max(0,rect.height),changed=Math.abs(w-cssWidth)>.1||Math.abs(h-cssHeight)>.1;
  cssWidth=w;cssHeight=h;if(w>1&&h>1){aspect=w/h;const rw=Math.max(1,Math.round(w*.5)),rh=Math.max(1,Math.round(h*.5));if(canvas.width!==rw||canvas.height!==rh){renderer.setSize(rw,rh,false);cleared=true;}if(changed)measureBands();}return changed;
 }
 function measureBands(){const b=bands()||{};bandBottom=Math.max(0,b.bottom||0);bandLeft=b.left||0;bandRight=b.right||0;}
 function cancelFrame(){if(frame){cancelAnimationFrame(frame);frame=0;}}
 function request(){if(disposed||!active||!visible||frame)return;measure();if(cssWidth>1&&cssHeight>1)frame=requestAnimationFrame(draw);}
 function positionCamera(withPan=true){
  const distance=700;view.copy(target);if(withPan)view.add(pan);camera.position.set(view.x+Math.sin(yaw)*distance,view.y+distance,view.z+Math.cos(yaw)*distance);camera.lookAt(view);camera.updateMatrixWorld(true);
 }
 function axes(){positionCamera();axisX.setFromMatrixColumn(camera.matrixWorld,0);axisY.setFromMatrixColumn(camera.matrixWorld,1);}
 // The pan keeps the middle of the view over the fitted content (its half extents from the last fit, contentX /
 // contentY): any edge plot can come to the middle, the castle never leaves the view. Its part along the view direction
 // changes nothing on screen and is dropped.
 function clampPan(){axes();const a=Math.max(-contentX,Math.min(contentX,pan.dot(axisX))),b=Math.max(-contentY,Math.min(contentY,pan.dot(axisY)));pan.copy(axisX).multiplyScalar(a).addScaledVector(axisY,b);}
 function frustum(){const half=baseHalfHeight/zoom;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
 function corners(box){const out=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])out.push(new T.Vector3(x,y,z));return out;}
 function layerBounds(){const b=plotBounds();return new T.Box3(new T.Vector3(b.minX-2,.8+layer*8,b.minZ-11),new T.Vector3(b.maxX+2,3+layer*8,Math.max(b.maxZ+2,66)));}
 function updateProfile(next){
  const changed=['minX','maxX','minZ','maxZ'].some(key=>buildProfile[key]!==next[key]);buildProfile=next;
  grid.material.opacity=.22*Math.min(1,12/buildProfile.size);
  if(!changed)return;
  const old=grid.geometry;grid.geometry=geometry(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(gridVertices(),3)));ownedGeometry.delete(old);old.dispose();
  const b=plotBounds();sheet.scale.set(buildProfile.size*8,buildProfile.size*8,1);sheet.position.set((b.minX+b.maxX)/2,-.015,(b.minZ+b.maxZ)/2);northMarker.position.set(b.minX-6,.4,b.minZ-8);
  if(hovered&&(hovered.x<buildProfile.minX||hovered.x>=buildProfile.maxX||hovered.z<buildProfile.minZ||hovered.z>=buildProfile.maxZ))setHover(null);
 }
 function desiredBounds(){
  const plot=plotBounds(),b=bounds?bounds.clone():new T.Box3(new T.Vector3(plot.minX,-35,plot.minZ),new T.Vector3(plot.maxX,74,81));
  b.union(layerBounds());return b;
 }
 // Fit: the content (real mesh bounds) fills the canvas as before, with a 10% margin. The N and gate markers (fixed pixel
 // sizes) should also fit whole, and a marker in line with the bottom camera bar (Fit / orbit buttons) should clear the
 // bar. A recentring fit first slides the framing up or down inside the content margin to make room, then zooms out by
 // at most a fifth (small phone previews keep a usable castle; clearing the bar beats a clipped N); a plain refit
 // (resize, orbit) keeps the target and only zooms.
 const fitPoint=new T.Vector3(),marks=[{},{}];
 function calculateFit(recenter=false){
  const b=desiredBounds();if(recenter){b.getCenter(target);pan.set(0,0,0);}positionCamera(false);
  // Project each real mesh's bounds, not the large empty corners formed by
  // combining a narrow crown with the distant entrance and hanging rock tip.
  const points=modelPoints.length?[...modelPoints,...corners(layerBounds())]:corners(b);
  const projected=fitPoint;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const point of points){projected.copy(point).applyMatrix4(camera.matrixWorldInverse);minX=Math.min(minX,projected.x);maxX=Math.max(maxX,projected.x);minY=Math.min(minY,projected.y);maxY=Math.max(maxY,projected.y);}
  let extentX=Math.max(Math.abs(minX),Math.abs(maxX)),extentY=Math.max(Math.abs(minY),Math.abs(maxY)),up=null;
  if(recenter){
   const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
   target.addScaledVector(right,(minX+maxX)/2).addScaledVector(up,(minY+maxY)/2);positionCamera(false);extentX=(maxX-minX)/2;extentY=(maxY-minY)/2;maxY=extentY;minY=-extentY;
  }
  const margin=Math.max(extentY,extentX/aspect)*.1+2,rh=Math.max(1,Math.round(Math.max(1,cssHeight)*.5)),bar=bandRight>bandLeft?Math.min(.2,bandBottom/Math.max(1,cssHeight)):0,barLeft=bandLeft/Math.max(1,cssWidth),barRight=bandRight/Math.max(1,cssWidth);
  let half=Math.max(35,Math.max(extentY,extentX/aspect)+margin);const limit=half*1.2;
  // Markers: anchor point and extents as fractions of the half height (above / below the anchor, half the width).
  [northMarker,gateMarker].forEach((sprite,i)=>{
   projected.copy(sprite.position);projected.y+=overlay.position.y;projected.applyMatrix4(camera.matrixWorldInverse);
   const m=marks[i],size=sprite.userData.pixels/rh;m.x=projected.x;m.y=projected.y;m.size=size;m.above=Math.min(.55,2*size*(1-sprite.center.y));m.below=2*size*sprite.center.y;
   half=Math.min(limit,Math.max(half,(Math.abs(m.x)+2)/Math.max(.45,aspect-size)));
  });
  // Vertical slide s (content moves down by s) allowed at a half height: the content keeps [clo, chi]; markers ask for
  // [lo, hi], where the bar applies to a marker in line with it.
  let clo=0,chi=0,lo=0,hi=0;
  const range=h=>{clo=maxY+margin-h;chi=minY-margin+h;lo=clo;hi=chi;for(const m of marks){const fx=.5+m.x/(2*h*aspect),w=m.size/(2*aspect),c=Math.min(.55,(bar>0&&fx+w>barLeft&&fx-w<barRight?2*bar:0)+m.below);lo=Math.max(lo,m.y+2-h*(1-m.above));hi=Math.min(hi,m.y-2+h*(1-c));}};
  range(half);
  if(recenter){for(let i=0;i<120&&lo>hi&&half<limit;i++)range(half=Math.min(limit,half*1.01));const slide=Math.min(Math.max(Math.min(Math.max(0,lo),hi),clo),chi);if(slide)target.addScaledVector(up,slide);}
  else for(let i=0;i<120&&(lo>0||hi<0)&&half<limit;i++)range(half=Math.min(limit,half*1.01));
  baseHalfHeight=half;fitBounds=b;contentX=extentX+margin;contentY=extentY+margin;if(!recenter)clampPan();frustum();
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
  frame=0;if(disposed||!active||!visible)return;const resized=measure();if(cssWidth<=1||cssHeight<=1)return;syncSky();
  // A cue still waiting after the preview was scrolled away or hidden for a while is stale: the edit is old news.
  if(pendingFlash&&performance.now()-pendingFlash.at>3000)pendingFlash=null;
  if(pending){
   const draft=pending;pending=null;
   try{
    const nextProfile=profile(draft.options),next=construction.preview(draft.home,draft.layout,draft.options),old=current,changedHome=home!==draft.home;
    const changedPlot=buildProfile.size!==nextProfile.size;updateProfile(nextProfile);
    scene.add(next.root);current=next;home=draft.home;drawnParts=draft.layout.length;bounds=modelBounds(next.root);
    // The cue measures a placed piece in the new model, an erased one in the old model before it goes.
    if(pendingFlash){flashCell=pendingFlash;pendingFlash=null;cellBounds(flashCell.erase&&old?old.root:next.root,flashCell);}
    if(old){scene.remove(old.root);old.dispose();}
    revision++;lastError=null;onBuilt(next);
    if(fitAfterBuild||changedHome||changedPlot||!fitBounds||!fitBounds.clone().expandByScalar(.1).containsBox(desiredBounds())){zoom=1;calculateFit(true);}fitAfterBuild=false;
   }catch(error){lastError=error.message||String(error);pendingFlash=null;}
  }
  if(pendingFlash&&!pending){flashCell=pendingFlash;pendingFlash=null;cellBounds(current?.root,flashCell);}
  if(resized||!fitBounds)calculateFit(!fitBounds);
  positionCamera();frustum();
  if(flashCell){startFlash(flashCell);flashCell=null;}
  if(flashing)fadeFlash();const hoverShown=hover.visible;if(flashing&&hovered&&hovered.x===lastFlash.x&&hovered.z===lastFlash.z)hover.visible=false;hoverDrawn=hover.visible;checkView();
  updateMarkers();post.render(scene,camera,canvas.width,canvas.height,1);hover.visible=hoverShown;cleared=false;calls=post.stats.worldCalls+post.stats.postCalls;frameCount++;
  // An event, a queued draft or a running placement cue requests the next draw; hidden canvases never poll.
  if(pending||flashing)request();
 }
 // The camera as drawn (yaw, zoom, fit, look point, canvas size): a change while a tile is aimed or a cue runs calls onView().
 const viewKey=new Float64Array(8);let viewMoved=false;
 function keyed(i,v){if(viewKey[i]!==v){viewKey[i]=v;viewMoved=true;}}
 function checkView(){viewMoved=false;keyed(0,yaw);keyed(1,zoom);keyed(2,baseHalfHeight);keyed(3,view.x);keyed(4,view.y);keyed(5,view.z);keyed(6,cssWidth);keyed(7,cssHeight);if(viewMoved&&(aimed||flashing))onView();}
 // Client rect (CSS px) of what a note over the preview should not cover: the aimed tile and its pin (kind 'aim'), or an
 // edit's cue box and spark (the plot column one layer high until the model is built). Reads layout: frame callbacks.
 const rectBox=new T.Box3(),rectPoint=new T.Vector3();
 function targetRect(cell,kind){
  if(!cell||!active||cssWidth<=1||cssHeight<=1)return null;positionCamera();frustum();
  const r=canvas.getBoundingClientRect(),aim=kind==='aim',x=-44+cell.x*8,z=-48+cell.z*8,floor=.8+cell.layer*8,cue=!aim&&lastFlash&&lastFlash.x===cell.x&&lastFlash.z===cell.z&&lastFlash.layer===cell.layer;
  if(cue){rectBox.min.fromArray(lastFlash.box.min);rectBox.max.fromArray(lastFlash.box.max);}
  else{rectBox.min.set(x-4,floor+(aim?.045:-.03),z-4);rectBox.max.set(x+4,floor+(aim?.045:8),z+4);}
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,ax=0,ay=0;
  for(let i=0;i<9;i++){
   if(i<8)rectPoint.set(i&1?rectBox.max.x:rectBox.min.x,i&2?rectBox.max.y:rectBox.min.y,i&4?rectBox.max.z:rectBox.min.z);
   else rectPoint.set((rectBox.min.x+rectBox.max.x)/2,aim?floor+.645:rectBox.max.y+.6,(rectBox.min.z+rectBox.max.z)/2);
   rectPoint.project(camera);ax=r.left+(rectPoint.x+1)*r.width/2;ay=r.top+(1-rectPoint.y)*r.height/2;
   if(i<8){left=Math.min(left,ax);right=Math.max(right,ax);top=Math.min(top,ay);bottom=Math.max(bottom,ay);}
  }
  // The pin (16 render px, anchored a quarter up) or the spark (16 render px, standing on the box top).
  const k=cssHeight/Math.max(1,canvas.height),half=8*k;
  return {left:Math.min(left,ax-half),right:Math.max(right,ax+half),top:Math.min(top,ay-(aim?12:16)*k),bottom:Math.max(bottom,ay+(aim?4*k:0))};
 }
 const flashBox=new T.Box3(),partBox=new T.Box3(),probe=new T.Vector3(),probeNdc=new T.Vector3(),probeHits=[],PROBES=[[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]];
 // The cue's box: the placed piece's groups in a model, from its own layer floor up (a terrace body reaching down to the
 // foundation shows only its top tier), or one layer-high column where nothing was found.
 function cellBounds(root,c){
  flashBox.makeEmpty();if(root)for(const g of root.children){const k=g.userData.cell;if(k&&k.x===c.x&&k.z===c.z&&k.layer===c.layer){partBox.setFromObject(g);if(!partBox.isEmpty())flashBox.union(partBox);}}
  const floor=.77+c.layer*8;if(flashBox.isEmpty()){const x=-44+c.x*8,z=-48+c.z*8;flashBox.min.set(x-4,floor,z-4);flashBox.max.set(x+4,floor+8,z+4);}
  flashBox.min.y=Math.max(flashBox.min.y,floor-.2);flashBox.max.y=Math.max(flashBox.max.y,flashBox.min.y+1.2);return flashBox;
 }
 const cellOf=object=>{for(let o=object;o;o=o.parent)if(o.userData.cell){const k=o.userData.cell;return {x:k.x,z:k.z,layer:k.layer,type:k.type};}return null;};
 // Is the placed piece's top hidden from this camera? Rays at its top centre and four inset top corners: hidden when every
 // one on screen meets another column first (that first column is named); one clear ray, or its own column, says seen.
 function hiddenBy(c,box){
  if(!current)return null;let first=null;
  for(const [fx,fz] of PROBES){
   probe.set(box.min.x+(box.max.x-box.min.x)*fx,box.max.y-.25,box.min.z+(box.max.z-box.min.z)*fz);probeNdc.copy(probe).project(camera);if(Math.abs(probeNdc.x)>1||Math.abs(probeNdc.y)>1)continue;
   pointer.set(probeNdc.x,probeNdc.y);ray.setFromCamera(pointer,camera);probeHits.length=0;ray.intersectObject(current.root,true,probeHits);
   const reach=probeNdc.subVectors(probe,ray.ray.origin).dot(ray.ray.direction);let h=null;for(const o of probeHits)if(o.object.isMesh&&shown(o.object)){h=o;break;}
   if(!h||h.distance>=reach-1.2){probeHits.length=0;return null;}
   let k=cellOf(h.object);if(!k){hit.copy(h.point).addScaledVector(ray.ray.direction,.05);k=cellAt(hit.x,hit.z);}
   if(k.x===c.x&&k.z===c.z){probeHits.length=0;return null;}first=first||k;
  }
  probeHits.length=0;return first;
 }
 function startFlash(c){
  flashBox.getCenter(flashFill.position);flashBox.getSize(flashFill.scale);flashEdges.position.copy(flashFill.position);flashEdges.scale.copy(flashFill.scale);spark.position.set(flashFill.position.x,flashBox.max.y+.6,flashFill.position.z);
  flashFill.material.color.set(c.erase?0xff7a1f:0xffb000);flashGroup.visible=true;flashing=true;flashAt=performance.now();
  lastFlash={x:c.x,z:c.z,layer:c.layer,erase:!!c.erase,hidden:c.erase?null:hiddenBy(c,flashBox),box:{min:flashBox.min.toArray(),max:flashBox.max.toArray()},frames:0};
  onFlash({x:c.x,z:c.z,layer:c.layer,erase:lastFlash.erase,hidden:lastFlash.hidden&&{...lastFlash.hidden}});
 }
 // Bright at once, then fading; the spark pops at twice its size for the first quarter (pixel steps, none under reduced motion).
 function fadeFlash(){
  const t=Math.min(1,(performance.now()-flashAt)/FLASH_MS),k=1-t;lastFlash.frames++;
  flashFill.material.opacity=.62*k;flashEdges.material.opacity=spark.material.opacity=Math.min(1,1.8*k);spark.userData.pixels=t<.25&&!calm?.matches?32:16;
  if(t>=1){flashing=false;flashGroup.visible=false;}
 }
 function stopFlash(){flashing=false;flashGroup.visible=false;pendingFlash=flashCell=null;}
 // Hover tile: red when refused, gold while aimed by a tap (the next tap there places), amber to erase, else cyan.
 function paint(){
  const bad=!!hovered?.issue,erase=type==='erase',armed=!bad&&!!aimed&&!!hovered&&hovered.x===aimed.x&&hovered.z===aimed.z,map=bad?pinTextures.refused:armed?pinTextures.aim:erase?pinTextures.erase:pinTextures.place;
  tileMaterial.color.set(bad?0xff4a3d:armed?0xffd27a:erase?0xffb35c:0xa7fff0);tileMaterial.opacity=bad?.5:armed?.55:.32;outlineMaterial.color.set(bad?0xff8a7a:armed?0xfff2c4:erase?0xffd9a0:0xe3fff0);arrow.visible=!bad&&!erase;cross.visible=bad;
  if(pin.material.map!==map){pin.material.map=map;pin.center.set(.5,bad?.5:.25);}
 }
 function setHover(cell){
  const l=cell?(Number.isInteger(cell.layer)?cell.layer:layer):0,key=cell?cell.x+':'+cell.z+':'+l+':'+(cell.issue?.code||''):'';
  if(cell){hover.position.set(-44+cell.x*8,(l-layer)*8+.045,-48+cell.z*8);hover.visible=true;}
  else hover.visible=false;
  if(key===hoverKey)return;hoverKey=key;
  hovered=cell?{x:cell.x,z:cell.z,layer:l,issue:cell.issue||null}:null;paint();onHover(hovered?.x??null,hovered?.z??null,hovered?.layer??null,hovered?.issue??null);request();
 }
 const MARGIN=3,cellAt=(x,z)=>({x:Math.floor((x+48)/8),z:Math.floor((z+52)/8)}),modelHits=[];
 const shown=object=>{for(let n=object;n;n=n.parent)if(!n.visible)return false;return true;};
 function resolve(x,z,l){return {x,z,layer:l,issue:check(x,z,l)||null};}
 const column=(x,z)=>resolve(x,z,auto&&targetLayer?targetLayer(x,z):layer);
 function pick(clientX,clientY){
  const rect=canvas.getBoundingClientRect();if(rect.width<=1||rect.height<=1||clientX<rect.left||clientX>=rect.right||clientY<rect.top||clientY>=rect.bottom)return null;
  pointer.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);positionCamera();frustum();ray.setFromCamera(pointer,camera);
  const b=plotBounds(),p=buildProfile,o=ray.ray.origin,d=ray.ray.direction,goal=(x,z)=>auto&&targetLayer?targetLayer(x,z):layer,inPlot=c=>c.x>=p.minX&&c.x<p.maxX&&c.z>=p.minZ&&c.z<p.maxZ;
  if(auto&&d.y<-1e-6){
   // Auto: the plot column the player sees. The first visible built surface along the ray (top, side or cliff face,
   // nudged just inside it) names the column, unless an empty plot's grid sheet at ground level comes first.
   let best=null,bestT=Infinity;
   if(current){modelHits.length=0;ray.intersectObject(current.root,true,modelHits);
    for(const h of modelHits){if(!h.object.isMesh||!shown(h.object))continue;hit.copy(h.point).addScaledVector(d,.05);const c=cellAt(hit.x,hit.z);if(inPlot(c)){best=c;bestT=h.distance;}break;}}
   else for(let k=LAYERS*8;k>=0;k--){const y=.8+k,t=(y-o.y)/d.y,c=cellAt(o.x+d.x*t,o.z+d.z*t),h=inPlot(c)?height(c.x,c.z):null;if(h!=null&&y<=.8+h*8+.01){best=c;bestT=t;break;}}
   const t=(.8-o.y)/d.y,ground=cellAt(o.x+d.x*t,o.z+d.z*t);if(t<bestT&&inPlot(ground)&&height(ground.x,ground.z)==null)best=ground;
   modelHits.length=0;if(best)return resolve(best.x,best.z,goal(best.x,best.z));
  }
  // Fixed layer (or a ray that misses the plot): the plane of the selected layer. Plots just outside the land
  // still resolve, so the builder can say why they are refused; the open sky further out picks nothing.
  if(!ray.ray.intersectPlane(plane,hit))return null;const c=cellAt(hit.x,hit.z);
  if(c.x<p.minX-MARGIN||c.x>=p.maxX+MARGIN||c.z<p.minZ-MARGIN||c.z>=p.maxZ+MARGIN)return null;
  return resolve(c.x,c.z,goal(c.x,c.z));
 }
 // Re-resolve the tile under a resting pointer after the draft or tool changes (a placed piece raises the target); an
 // aimed column keeps the tile and is re-checked for the current part (onAim again, so the note names it), and a part the
 // column now refuses ends the aim (red tile: the next tap there answers at once, as for any refused plot).
 function refresh(){if(pointers.size||!active||disposed)return;if(aimed){const c=column(aimed.x,aimed.z);if(c.issue){aim(null);setHover(c);return;}aimed.layer=c.layer;aimed.issue=null;setHover(c);paint();onAim({...aimed});return;}if(lastPointer)setHover(pick(lastPointer.x,lastPointer.y));}
 function aim(cell){if(!cell&&!aimed)return;aimed=cell?{x:cell.x,z:cell.z,layer:cell.layer,issue:cell.issue||null}:null;paint();onAim(aimed&&{...aimed});request();}
 function rotate(deltaRadians){if(!Number.isFinite(deltaRadians))return;yaw=((yaw+deltaRadians+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;calculateFit(false);request();}
 // Zoom about a client point (the cursor, a pinch midpoint): the world point under it stays put. Without one, the middle.
 function zoomAt(value,clientX,clientY){
  const next=Math.max(.55,Math.min(maxZoom(),value));if(!Number.isFinite(next))return;
  if(Number.isFinite(clientX)&&cssWidth>1&&cssHeight>1){const rect=canvas.getBoundingClientRect(),shift=baseHalfHeight/zoom-baseHalfHeight/next;axes();pan.addScaledVector(axisX,((clientX-rect.left)/rect.width*2-1)*shift*aspect).addScaledVector(axisY,(1-(clientY-rect.top)/rect.height*2)*shift);}
  zoom=next;clampPan();frustum();request();
 }
 function panBy(dx,dy){if(cssHeight<=1)return;const unit=2*baseHalfHeight/zoom/cssHeight;axes();pan.addScaledVector(axisX,-dx*unit).addScaledVector(axisY,dy*unit);clampPan();request();}
 function release(id){try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch{}}
 function clearPointers(){for(const id of pointers.keys())release(id);pointers.clear();pinch=null;}
 function listen(name,handler,options){canvas.addEventListener(name,handler,options);listeners.push([name,handler,options]);}
 // The first two pointers of a pinch, as pinch.a and pinch.b (no per-event arrays).
 function pair(){pinch.a=pinch.b=null;for(const p of pointers.values()){if(!pinch.a)pinch.a=p;else{pinch.b=p;break;}}}
 // One finger or the left button orbits; two fingers pinch-zoom about their midpoint and pan with it; the right or
 // middle button pans. A still press is a tap or click.
 listen('pointerdown',e=>{
  const mouse=e.pointerType==='mouse',drag=mouse&&(e.button===1||e.button===2);if(!active||disposed||(mouse&&e.button!==0&&!drag))return;e.preventDefault();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,multiple:false,pan:drag,slop:e.pointerType==='touch'?10:6});lastPointer={x:e.clientX,y:e.clientY};
  try{canvas.setPointerCapture(e.pointerId);}catch{}
  if(pointers.size>=2){for(const p of pointers.values())p.multiple=true;pinch={};pair();const {a,b}=pinch;pinch.distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));pinch.zoom=zoom;pinch.x=(a.x+b.x)/2;pinch.y=(a.y+b.y)/2;setHover(aimed);}
  else setHover(drag?aimed:pick(e.clientX,e.clientY));
 });
 listen('pointermove',e=>{
  if(!active||disposed)return;const p=pointers.get(e.pointerId);
  lastPointer={x:e.clientX,y:e.clientY};if(!p){setHover(pick(e.clientX,e.clientY));return;}e.preventDefault();
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(pointers.size>=2&&pinch){pair();const {a,b}=pinch,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;panBy(mx-pinch.x,my-pinch.y);pinch.x=mx;pinch.y=my;zoomAt(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,mx,my);return;}
  if(Math.hypot(p.x-p.startX,p.y-p.startY)>p.slop)p.moved=true;
  if(p.pan){panBy(dx,dy);return;}
  if(p.moved||p.multiple){rotate(-dx*.008);setHover(aimed);}else setHover(pick(e.clientX,e.clientY));
 });
 // Mouse (its hover already shows the target): a click places. Touch and pen: the first tap on a plot aims, a second
 // tap on the same column places, a tap on another plot aims there; a refused plot or open sky answers at once.
 listen('pointerup',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;e.preventDefault();pointers.delete(e.pointerId);release(e.pointerId);
  if(!pointers.size)pinch=null;
  if(!active||p.moved||p.multiple||p.pan||Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>p.slop)return;
  lastPointer={x:e.clientX,y:e.clientY};const cell=pick(e.clientX,e.clientY);
  if(e.pointerType==='mouse'||!cell||cell.issue||(aimed&&aimed.x===cell.x&&aimed.z===cell.z)){aim(null);setHover(cell);if(cell)onPlace(cell.x,cell.z,cell.layer);else onMiss();}
  else{aim(cell);setHover(cell);}
 });
 listen('pointercancel',e=>{pointers.delete(e.pointerId);release(e.pointerId);if(!pointers.size)pinch=null;setHover(aimed);});
 listen('lostpointercapture',e=>{pointers.delete(e.pointerId);if(!pointers.size)pinch=null;});
 listen('pointerleave',e=>{if(pointers.size||e.pointerType==='touch')return;lastPointer=null;setHover(aimed);});
 listen('wheel',e=>{if(!active)return;e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?400:1;zoomAt(zoom*Math.exp(-e.deltaY*unit*.0015),e.clientX,e.clientY);},{passive:false});
 listen('contextmenu',e=>e.preventDefault());
 // ResizeObserver runs after layout, before paint: a cleared buffer is redrawn here, not one frame later.
 const resizeObserver=new ResizeObserver(()=>{const changed=measure();if(changed&&cssWidth>1&&cssHeight>1)calculateFit(false);if((cleared||changed)&&cssWidth>1&&cssHeight>1)drawNow(true);else request();});resizeObserver.observe(canvas);
 const intersectionObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{const entry=entries.at(-1);visible=!!entry?.isIntersecting&&entry.intersectionRect.width>0&&entry.intersectionRect.height>0;if(visible)request();else cancelFrame();}):null;intersectionObserver?.observe(canvas);
 function fit(){zoom=1;if(pending)fitAfterBuild=true;else{measure();measureBands();calculateFit(true);}request();}
 // force: the canvas was just shown or resized, so draw even if the IntersectionObserver has not caught up yet (it still
 // says hidden from before); visibility itself stays the observer's call.
 function drawNow(force=false){if(disposed||!active||!(visible||force))return;cancelFrame();const seen=visible;visible=true;draw();visible=seen;}
 function setTool(tool){
  if(Number.isInteger(tool.layer))layer=Math.max(0,Math.min(9,tool.layer));
  if(typeof tool.type==='string')type=tool.type;
  if(Number.isInteger(tool.rotation))rotation=((tool.rotation%4)+4)%4;
  if(typeof tool.auto==='boolean')auto=tool.auto;
  overlay.position.y=.8+layer*8;plane.constant=-overlay.position.y;arrow.rotation.y=rotation*Math.PI/2;paint();
  if(fitBounds&&!fitBounds.clone().expandByScalar(.1).containsBox(desiredBounds())){zoom=1;calculateFit(true);}refresh();request();
 }
 setTool({layer:0,type:'floor',rotation:0});
 return {
  // A changed draft ends an aim (the next tap aims again).
  setDraft(nextHome,layout,options){if(disposed)return;pending={home:nextHome,layout:layout.map(p=>({...p})),options:options?{...options}:undefined};requestedRevision++;aim(null);refresh();request();},
  setTool,
  // Opening draws at once (the queued draft included), so the canvas never shows an undrawn black buffer.
  setActive(value){active=!!value;if(active)drawNow(true);else{cancelFrame();clearPointers();aim(null);stopFlash();}},
  rotate,fit,
  // The cue for an edit that just landed (placed or erased): drawn once the next model is built.
  flash(cell){if(disposed||!cell)return;pendingFlash={x:cell.x,z:cell.z,layer:cell.layer,erase:!!cell.erase,at:performance.now()};request();},
  get aimed(){return aimed&&{...aimed};},
  targetRect,
  get zoom(){return zoom;},
  setRoutes,
  focusCell(cell){target.set(-44+cell.x*8,3+(cell.layer||0)*8,-48+cell.z*8);pan.set(0,0,0);baseHalfHeight=26;zoom=1;setHover(cell);positionCamera();frustum();request();},
  get camera(){return camera;},
  get root(){return current?.root??null;},
  get scene(){return scene;},
  // Client position of a plot centre at a layer's floor height (tests and tooling; no state change).
  project(x,z,l=layer){positionCamera();frustum();const r=canvas.getBoundingClientRect(),v=new T.Vector3(-44+x*8,.8+l*8,-48+z*8).project(camera);return {clientX:r.left+(v.x+1)*r.width/2,clientY:r.top+(1-v.y)*r.height/2,visible:Math.abs(v.x)<=1&&Math.abs(v.y)<=1};},
  get metrics(){
   const rect=canvas.getBoundingClientRect(),cells=[];positionCamera();frustum();
   for(let z=buildProfile.minZ;z<buildProfile.maxZ;z++)for(let x=buildProfile.minX;x<buildProfile.maxX;x++){const point=new T.Vector3(-44+x*8,.8+layer*8,-48+z*8).project(camera);cells.push({x,z,clientX:rect.left+(point.x+1)*rect.width/2,clientY:rect.top+(1-point.y)*rect.height/2,visible:Math.abs(point.x)<=1&&Math.abs(point.y)<=1});}
   return {active,visible,disposed,home,layer,auto,type,rotation,yaw,zoom,pixelScale:.5,profile:{...buildProfile},plotBounds:plotBounds(),buildRevision:revision,requestedRevision,drawnParts,meshCount,frameCount,pending:!!pending,lastError,hovered:hovered?{...hovered}:null,hoverDrawn,aimed:aimed?{...aimed}:null,pan:pan.toArray(),maxZoom:maxZoom(),cue:lastFlash?{...lastFlash,hidden:lastFlash.hidden&&{...lastFlash.hidden},active:flashing}:null,cssSize:[cssWidth,cssHeight],renderSize:[canvas.width,canvas.height],bounds:bounds?{min:bounds.min.toArray(),max:bounds.max.toArray()}:null,cells,memory:{...renderer.info.memory},calls};
  },
  dispose(){if(disposed)return;disposed=true;active=false;cancelFrame();clearPointers();resizeObserver.disconnect();intersectionObserver?.disconnect();for(const [name,handler,options] of listeners)canvas.removeEventListener(name,handler,options);if(current){scene.remove(current.root);current.dispose();current=null;}for(const g of ownedGeometry)g.dispose();for(const m of ownedMaterial)m.dispose();for(const texture of ownedTexture)texture.dispose();renderer.dispose();pending=null;}
 };
}
