import * as T from '../vendor/three.module.js';
// Bottom-centred labels stay near their projected silo, clear of the actual HUD.
export function siloLabelPosition(x,y,w,h,viewport,obstacles){
 const gap=8,minX=viewport.left+w/2+4,maxX=viewport.right-w/2-4,minY=viewport.top+h+4,maxY=viewport.bottom-4;
 if(minX>maxX||minY>maxY)return null;
 const cx=v=>Math.max(minX,Math.min(maxX,v)),cy=v=>Math.max(minY,Math.min(maxY,v));
 function free(px,py){return !obstacles.some(b=>px-w/2<b.right+gap&&px+w/2>b.left-gap&&py-h<b.bottom+gap&&py>b.top-gap);}
 const ox=cx(x),oy=cy(y);if(free(ox,oy))return {x:ox,y:oy};
 const xs=[ox],ys=[oy];for(const b of obstacles){xs.push(cx(b.left-w/2-gap),cx(b.right+w/2+gap));ys.push(cy(b.top-gap),cy(b.bottom+h+gap));}
 let best=null,distance=Infinity;for(const px of new Set(xs))for(const py of new Set(ys)){if(!free(px,py))continue;const d=(px-x)**2+(py-y)**2;if(d<distance){distance=d;best={x:px,y:py};}}
 return best;
}
export function createSiloMarkers(world,camera,playerSprite=null){
 const layer=document.createElement('div');layer.id='silo-markers';layer.setAttribute('aria-label','Silo locations');document.body.append(layer);
 const names=['T1 · NORTHWEST','T2 · NORTHEAST','T3 · SOUTHEAST','T4 · SOUTHWEST','CROWN · CENTRAL'];
 const labels=world.orbTowers.map((orb,i)=>{const el=document.createElement('div');el.className='silo-marker';el.innerHTML='<b></b><span></span>';el.querySelector('b').textContent=names[i];layer.append(el);return el;});
 const point=new T.Vector3(),up=new T.Vector3();
 return {update(objectives=[],active=false){
  const rect=document.getElementById('world').getBoundingClientRect(),obstacles=[...document.querySelectorAll('.brand,header nav,.compass,.telemetry,.move-zone,.travel,#message,#look-panel,#battle-hud,#battle-board,#battle-radar')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
  if(playerSprite?.visible){playerSprite.getWorldPosition(point).addScaledVector(up.setFromMatrixColumn(camera.matrixWorld,1),playerSprite.scale.y*(.5-playerSprite.center.y)).project(camera);if(point.z>=-1&&point.z<=1&&Math.abs(point.x)<1&&Math.abs(point.y)<1){const h=Math.max(24,playerSprite.scale.y/(camera.top-camera.bottom)*camera.zoom*rect.height)+16,w=h*playerSprite.scale.x/playerSprite.scale.y+16,x=rect.left+(point.x+1)*rect.width/2,y=rect.top+(1-point.y)*rect.height/2;obstacles.push({left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2});}}
  world.orbTowers.forEach((orb,i)=>{
   const el=labels[i];orb.core.getWorldPosition(point);point.y+=9;point.project(camera);el.hidden=point.z<-1||point.z>1||Math.abs(point.x)>1.1||Math.abs(point.y)>1.1;el.dataset.visibility=el.hidden?'offscreen':'visible';if(el.hidden)return;
   const x=rect.left+(point.x+1)*rect.width/2,y=rect.top+(1-point.y)*rect.height/2,owner=active?objectives[i]?.owner:-1;el.dataset.owner=owner??-1;el.querySelector('span').textContent=owner===0?'DAWN · ALLIED':owner===1?'DUSK · HOSTILE':'NEUTRAL';el.style.left=x+'px';el.style.top=y+'px';const box=el.getBoundingClientRect(),position=siloLabelPosition(x,y,box.width,box.height,rect,obstacles);if(!position){el.hidden=true;el.dataset.visibility='crowded';return;}
   el.style.left=position.x+'px';el.style.top=position.y+'px';el.dataset.anchorX=x;el.dataset.anchorY=y+11;const dx=x-position.x,dy=y+11-position.y;el.style.setProperty('--silo-line-length',Math.hypot(dx,dy)+'px');el.style.setProperty('--silo-line-angle',Math.atan2(-dx,dy)+'rad');obstacles.push({left:position.x-box.width/2,right:position.x+box.width/2,top:position.y-box.height,bottom:position.y});
  });
 }};
}
