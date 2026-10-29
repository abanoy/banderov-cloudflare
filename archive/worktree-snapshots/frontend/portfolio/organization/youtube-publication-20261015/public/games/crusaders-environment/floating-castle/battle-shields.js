import * as T from '../vendor/three.module.js';

// Axis-aligned ellipsoids fit the current visible castle, including its heart. Rounded keep envelopes avoid the oversized sphere corners.
// Harbors remain outside the protected keep so fleets have boarding space.
export function castleShieldVolumes(world){
 return world.castles.map((castle,team)=>{
  const bounds=new T.Box3(),boxes=[],harbor=world.harbors?.[team]?.root;
  for(const mesh of world.solids){let owned=false,hidden=false;for(let p=mesh;p;p=p.parent){if(p===castle)owned=true;if(!p.visible||p===harbor||p.userData.cell?.type==='deck')hidden=true;}if(!owned||hidden||!mesh.geometry||mesh.userData.cell?.type==='deck')continue;
   mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);boxes.push(box);bounds.union(box);
  }
  if(bounds.isEmpty())bounds.setFromObject(castle);
  const centre=bounds.getCenter(new T.Vector3()),half=bounds.getSize(new T.Vector3()).multiplyScalar(.5).addScalar(2);const exponent=8;let factor=1;
  for(const b of boxes)for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])factor=Math.max(factor,(Math.abs((x-centre.x)/half.x)**exponent+Math.abs((y-centre.y)/half.y)**exponent+Math.abs((z-centre.z)/half.z)**exponent)**(1/exponent));
  half.multiplyScalar(factor*1.01);
  return {team,exponent,x:centre.x,y:centre.y,z:centre.z,rx:half.x,ry:half.y,rz:half.z};
 });
}
export function shieldContact(from,to,team,volumes,health,padding=0){
 let first=null;
 for(const v of volumes){if(v.team===team||health[v.team]<=0)continue;
  const r=[v.rx+padding,v.ry+padding,v.rz+padding],a=[(from.x-v.x)/r[0],(from.y-v.y)/r[1],(from.z-v.z)/r[2]],d=[(to.x-from.x)/r[0],(to.y-from.y)/r[1],(to.z-from.z)/r[2]];
  if(a.some((x,i)=>x>1&&x+d[i]>1||x<-1&&x+d[i]<-1))continue;
  const power=v.exponent||2,metric=t=>a.reduce((sum,x,i)=>sum+Math.abs(x+d[i]*t)**power,0);
  let t=0;if(metric(0)>1){let low=0,high=1;for(let i=0;i<32;i++){const l=(2*low+high)/3,u=(low+2*high)/3;if(metric(l)<metric(u))high=u;else low=l;}const minimum=(low+high)/2;if(Math.min(metric(minimum),metric(1))>1)continue;low=0;high=metric(1)<=1?1:minimum;for(let i=0;i<32;i++){const mid=(low+high)/2;if(metric(mid)>1)low=mid;else high=mid;}t=high;}
  if(t<0||t>1||!Number.isFinite(t))continue;
  if(!first||t<first.t)first={team:v.team,t,point:{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t}};
 }
 return first;
}

export function shieldHullContact(from,to,half,team,volumes,health){
 let first=null;
 for(const v of volumes){if(v.team===team||health[v.team]<=0)continue;
  const axes=['x','y','z'],r=[v.rx,v.ry,v.rz],a=axes.map((k,i)=>(from[k]-v[k])/r[i]),d=axes.map((k,i)=>(to[k]-from[k])/r[i]),h=axes.map((k,i)=>half[k]/r[i]);
  const distance=t=>a.reduce((sum,x,i)=>sum+Math.max(0,Math.abs(x+d[i]*t)-h[i])**(v.exponent||2),0);
  let low=0,high=1;for(let i=0;i<28;i++){const l=(low*2+high)/3,u=(low+high*2)/3;if(distance(l)<distance(u))high=u;else low=l;}
  const minimum=(low+high)/2;if(Math.min(distance(minimum),distance(1))>1)continue;
  let t=0;if(distance(0)>1){low=0;high=distance(1)<=1?1:minimum;for(let i=0;i<24;i++){const mid=(low+high)/2;if(distance(mid)>1)low=mid;else high=mid;}t=high;}
  if(!first||t<first.t){const c=Object.fromEntries(axes.map((k,i)=>[k,from[k]+(to[k]-from[k])*t]));
   const point=Object.fromEntries(axes.map(k=>[k,Math.max(c[k]-half[k],Math.min(c[k]+half[k],v[k]))]));first={team:v.team,t,point};}
 }
 return first;
}
