// Reserve immutable protector-to-heart corridors before adding derived fittings.
// The physical mesh/beam inspector remains the final authority after placement.
function clearPinnedBeams(layout,e,battery=false){
 const core=layout.find(p=>p.type==='core');if(!core)return true;const [dx,dz]=[[0,-1],[-1,0],[0,1],[1,0]][e.side],offset=battery?4.8:-3.8,c=[e.x*8+dx*offset,e.layer*8+(battery?3.07:1.6),e.z*8+dz*offset],half=e.side%2?[battery?2.7:2,battery?5:1.8,battery?3.2:1.5]:[battery?3.2:1.5,battery?5:1.8,battery?2.7:2],target=[core.x*8,core.layer*8+15.156,core.z*8];
 for(const p of layout)if(p.type==='protector'){const from=[p.x*8,p.layer*8+3.5,p.z*8],delta=target.map((x,i)=>x-from[i]),distance=Math.hypot(...delta);let lo=.05/distance,hi=Math.max(lo,1-8.5/distance);for(let i=0;i<3&&lo<=hi;i++){if(Math.abs(delta[i])<1e-9){if(from[i]<c[i]-half[i]||from[i]>c[i]+half[i])hi=-1;}else{const a=(c[i]-half[i]-from[i])/delta[i],b=(c[i]+half[i]-from[i])/delta[i];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}}if(lo<=hi)return false;}
 return true;
}
// Access spacing follows connected wall runs, including corners and separate wards.
function distributedLadders(edges,candidates){
 const ends=e=>e.side%2===0?[[e.x-.5,e.z],[e.x+.5,e.z]]:[[e.x,e.z-.5],[e.x,e.z+.5]],adj=new Map(edges.map(e=>[e,[]])),vertices=new Map();
 for(const e of edges)for(const [x,z]of ends(e)){const k=x+':'+z,at=vertices.get(k)||[];for(const q of at){adj.get(e).push(q);adj.get(q).push(e);}at.push(e);vertices.set(k,at);}
 const remaining=new Set(edges),selected=[];
 while(remaining.size){const first=remaining.values().next().value,component=[first];remaining.delete(first);for(let i=0;i<component.length;i++)for(const q of adj.get(component[i]))if(remaining.delete(q))component.push(q);
  const cornerCost=e=>adj.get(e).filter(q=>q.side%2!==e.side%2||q.gate).length,allowed=component.filter(e=>candidates.includes(e)).sort((a,b)=>cornerCost(a)-cornerCost(b));if(!allowed.length)continue;const chosen=[];
  function distances(){const distance=new Map(chosen.map(e=>[e,0])),queue=[...chosen];for(let i=0;i<queue.length;i++){const e=queue[i];for(const q of adj.get(e))if(!distance.has(q)){distance.set(q,distance.get(e)+8);queue.push(q);}}return distance;}
  chosen.push(allowed[0]);while(chosen.length<allowed.length){const d=distances(),next=allowed.filter(e=>!chosen.includes(e)).sort((a,b)=>(d.get(b)??Infinity)-(d.get(a)??Infinity)||cornerCost(a)-cornerCost(b))[0];if(chosen.length>=2&&(d.get(next)??Infinity)<=24)break;chosen.push(next);}
  selected.push(...chosen);
 }
 return selected;
}
// Raised courts follow their occupied outline. Uphill stairs locate gate bays.
export function tierFortifications(layout){
 const dirs=[[0,-1],[-1,0],[0,1],[1,0]],key=(x,z,l)=>x+':'+z+':'+l;
 const courts=layout.filter(p=>p.fortified&&p.layer>0&&p.type!=='stairs'),edges=[],towers=new Map(),gates=[];
 const heights=new Map(),stairs=new Set();for(const p of layout){if(p.type==='stairs')stairs.add(key(p.x,p.z,p.layer)+':'+p.rotation);else if(p.solid||['terrace','wall','tower','curvedWall'].includes(p.type))heights.set(p.x+':'+p.z,Math.max(heights.get(p.x+':'+p.z)??-1,p.layer));}
 const tower=(x,z,layer,role)=>{const id=key(x,z,layer);if(!towers.has(id))towers.set(id,{x,z,layer,role});};
 for(const p of courts){
  const exposed=dirs.map(([dx,dz])=>!courts.some(q=>q.x===p.x+dx&&q.z===p.z+dz&&q.layer===p.layer)&&(heights.get((p.x+dx)+':'+(p.z+dz))??-1)<p.layer);
  for(let side=0;side<4;side++)if(exposed[side]){
   const [dx,dz]=dirs[side],stair=stairs.has(key(p.x+dx,p.z+dz,p.layer-1)+':'+((side+2)%4)),stairPassage=stairs.has(key(p.x+dx,p.z+dz,p.layer)+':'+side);
   const edge={x:p.x+dx*.5,z:p.z+dz*.5,layer:p.layer,side,gate:!!stair,stairPassage};edges.push(edge);
   if(stair){gates.push(edge);const tx=-dz,tz=dx;for(const sign of [-1,1])tower(edge.x+tx*.5*sign,edge.z+tz*.5*sign,p.layer,'gate flank');}
   const next=(side+1)%4;if(exposed[next])tower(p.x+(dx+dirs[next][0])*.5,p.z+(dz+dirs[next][1])*.5,p.layer,'corner');
  }
 }
 // Include inward turns as well as outward corners of irregular wards.
 const vertices=new Map();for(const e of edges){const horizontal=e.side%2===0;for(const sign of [-1,1]){const x=e.x+(horizontal?sign*.5:0),z=e.z+(horizontal?0:sign*.5),id=key(x,z,e.layer),v=vertices.get(id)||{x,z,layer:e.layer,axes:0};v.axes|=horizontal?1:2;vertices.set(id,v);}}
 for(const v of vertices.values())if(v.axes===3)tower(v.x,v.z,v.layer,'corner');
 const levels=[...new Set(courts.map(p=>p.layer))].sort((a,b)=>a-b),ladders=[];
 for(const layer of levels){
  const candidates=edges.filter(e=>e.layer===layer&&!e.gate&&!e.stairPassage&&clearPinnedBeams(layout,e)&&layout.some(p=>p.x===e.x-dirs[e.side][0]*.5&&p.z===e.z-dirs[e.side][1]*.5&&p.layer===layer&&['terrace','floor','battlement','spawn'].includes(p.type)&&layout.every(s=>s.type!=='stairs'||s.layer!==layer||Math.hypot(s.x-p.x,s.z-p.z)>=1.25)));
  for(const e of distributedLadders(edges.filter(e=>e.layer===layer&&!e.stairPassage),candidates)){e.ladder=true;ladders.push(e);}

 }
 const batteries=[];
 for(const layer of levels){const available=edges.filter(e=>e.layer===layer&&!e.gate&&!e.stairPassage&&!e.ladder&&clearPinnedBeams(layout,e,true)&&layout.some(p=>p.x===e.x-dirs[e.side][0]*.5&&p.z===e.z-dirs[e.side][1]*.5&&p.layer===layer&&p.wallBattery&&['terrace','floor','battlement','spawn'].includes(p.type)));for(const e of available)if(batteries.every(b=>b.layer!==layer||Math.hypot(b.x-e.x,b.z-e.z)>=4)){e.battery=true;batteries.push(e);}}
 return {edges,towers:[...towers.values()],gates,ladders,levels,batteries};
}

// Existing editable curtain tiles use the same access rule where a real court
// provides enough room for a full-height leaning ladder.
export function wallLadderTiles(layout){
 const result=[],dirs=[[0,1],[1,0],[0,-1],[-1,0]];
 for(const layer of new Set(layout.filter(p=>p.type==='wall').map(p=>p.layer))){
  const candidates=layout.filter(p=>p.type==='wall'&&p.layer===layer&&layout.some(q=>q.x===p.x+dirs[p.rotation][0]&&q.z===p.z+dirs[p.rotation][1]&&q.layer===layer&&['terrace','floor','battlement','spawn','deck'].includes(q.type)));
  const edges=layout.filter(p=>p.type==='wall'&&p.layer===layer).map(p=>({...p,side:p.rotation,source:p}));result.push(...distributedLadders(edges,edges.filter(e=>candidates.includes(e.source))).map(e=>e.source));
 }
 return result;
}
