import * as T from '../vendor/three.module.js';
import {cellPosition} from '../floating-castle/castle-rules.js';
// Experimental proposals only. Each result still needs full beam and route checks.
export function proposeBeamGateways(view,layout){
 const occupied=new Set(layout.map(p=>p.x+':'+p.z+':'+p.layer)),out=new Map();
 for(const link of view.links.filter(l=>!l.linked)){
  const ray=new T.Raycaster(link.from,link.to.clone().sub(link.from).normalize(),.05,link.from.distanceTo(link.to)-8.5),hit=ray.intersectObjects(view.colliders,false).find(h=>h.point.distanceTo(link.point)<1e-5);
  if(!hit||hit.object.userData.supportStyle!=='vaulted masonry')continue;
  const point=view.root.worldToLocal(hit.point.clone()),layer=Math.floor((point.y-.77)/8);if(layer<0||layer>=9)continue;
  const owners=layout.filter(p=>p.type==='floor'&&!p.solid&&p.layer>layer&&Math.abs(cellPosition(p).x-point.x)<4.001&&Math.abs(cellPosition(p).z-point.z)<4.001).sort((a,b)=>a.layer-b.layer);
  for(const owner of owners){const id=owner.x+':'+owner.z+':'+layer;if(occupied.has(id)||layout.some(p=>p.x===owner.x&&p.z===owner.z&&['core','protector'].includes(p.type)))continue;
   const direction=view.root.worldToLocal(link.to.clone()).sub(view.root.worldToLocal(link.from.clone())),preferred=Math.abs(direction.x)>Math.abs(direction.z)?1:0;
   for(const rotation of [preferred,1-preferred])out.set(id+':'+rotation,{piece:{x:owner.x,z:owner.z,layer,type:'gate',rotation},owner:{...owner},beamCell:{...link.cell},hit:point.toArray(),supportStories:hit.object.userData.supportStories});
  }
 }
 return [...out.values()];
}
