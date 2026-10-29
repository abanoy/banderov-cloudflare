/** Preserve stable nearest-eight sensing without sorting every opponent. */
export function nearestObserved(actors,actor,time){
 const visible=[],limit=actor.weapon===3?260:140;
 for(const other of actors){
  if(other.team===actor.team||!other.alive||other.hp<=0)continue;
  const d=Math.hypot(actor.state.x-other.state.x,actor.state.y-other.state.y,actor.state.z-other.state.z);
  if(d>limit||visible.length===8&&d>=visible[7].distance)continue;
  let i=visible.length;while(i>0&&d<visible[i-1].distance)i--;
  visible.splice(i,0,{id:other.id,x:other.state.x,y:other.state.y,z:other.state.z,distance:d,seenAt:time});
  if(visible.length>8)visible.pop();
 }
 return visible;
}

/** Preserve player-before-ship ties while excluding unusable distant targets. */
export function fleetTargetsInRange(actors,ships,team,origin,range){
 const candidates=[];
 function consider(point){const dx=origin.x-point.x,dy=origin.y-point.y,dz=origin.z-point.z,distance=Math.sqrt(dx*dx+dy*dy+dz*dz);if(distance>range)return;candidates.push({point,distance});}
 for(const a of actors)if(a.alive&&a.team!==team)consider({x:a.state.x,y:a.state.y+1,z:a.state.z});
 for(const ship of ships)if(ship.hp>0&&ship.team!==team)consider({x:ship.root.position.x,y:ship.root.position.y+1,z:ship.root.position.z,ship});
 candidates.sort((a,b)=>a.distance-b.distance);return candidates.map(c=>c.point);
}
