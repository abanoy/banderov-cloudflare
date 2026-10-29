const key=p=>p.x+':'+p.z+':'+p.layer,column=p=>p.x+':'+p.z;
const walk=new Set(['floor','terrace','deck','spawn','garden','cannon','heavyCannon','beacon']);
export function proposeGalleryBridges(layout,goal){
 if(!goal.cluster||!goal.id.includes('floor-'))return [];
 const cells=new Map(layout.map(p=>[key(p),p])),columns=new Map(),members=new Set(goal.cluster.map(key)),out=new Map();
 for(const p of layout){if(!columns.has(column(p)))columns.set(column(p),[]);columns.get(column(p)).push(p);}
 for(const from of goal.cluster)for(const to of layout){const distance=Math.abs(to.x-from.x)+Math.abs(to.z-from.z);if(to.layer!==from.layer||!walk.has(to.type)||members.has(key(to))||to.footprint==='round'||distance<2||distance>4)continue;
  for(const axis of ['x','z']){const path=[],at={x:from.x,z:from.z,layer:from.layer};for(const field of [axis,axis==='x'?'z':'x'])while(at[field]!==to[field]){at[field]+=Math.sign(to[field]-at[field]);if(at.x!==to.x||at.z!==to.z)path.push({...at,type:'floor',rotation:0});}
   const added=[];let valid=true;for(const p of path){const old=cells.get(key(p)),stack=columns.get(column(p));if(old){if(!walk.has(old.type)||old.footprint==='round'){valid=false;break;}continue;}if(!stack||stack.some(q=>['core','protector','stairs'].includes(q.type))){valid=false;break;}added.push(p);}
   if(valid&&added.length&&added.length<=3)out.set(added.map(key).sort().join('|'),{pieces:added,from:{...from},to:{...to}});
  }
 }
 return [...out.values()].sort((a,b)=>a.pieces.length-b.pieces.length||a.pieces.map(key).join('|').localeCompare(b.pieces.map(key).join('|')));
}
