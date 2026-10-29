import * as T from '../vendor/three.module.js';
import {roundFootprint} from './castle-curves.js';
import {tierFortifications} from './castle-fortifications.js';
const dirs=[[0,-1],[-1,0],[0,1],[1,0]],key=p=>p.x+':'+p.z;
export function castleTerrainPlan(layout){
 const base=new Map(),cells=new Map(layout.map(p=>[key(p)+':'+p.layer,p]));
 for(const p of layout)if(p.layer===0||p.solid&&p.type!=='stairs'){
  const old=base.get(key(p));if(!old||p.layer===0)base.set(key(p),p);
 }
 const protectedEdges=new Set(tierFortifications(layout).edges.filter(e=>!e.stairPassage||e.gate).map(e=>e.x+':'+e.z+':'+e.layer));
 const lips=[];
 for(const p of layout){
  if(['wall','tower','gate','curvedWall','embankment','core','roof','stairs'].includes(p.type))continue;
  const sides=[],openings={};
  for(let side=0;side<4;side++){
   const [dx,dz]=dirs[side],q=cells.get((p.x+dx)+':'+(p.z+dz)+':'+p.layer);
   if(q&&q.type!=='stairs'){if(!roundFootprint(p)&&roundFootprint(q)){sides.push(side);openings[side]=2.2;}continue;}
   if(q?.type==='stairs'&&q.rotation===side)continue;
   if(layout.some(s=>s.type==='stairs'&&s.layer===p.layer-1&&s.x===p.x+dx&&s.z===p.z+dz&&s.rotation===(side+2)%4))continue;
   if(layout.some(q=>q.x===p.x+dx&&q.z===p.z+dz&&q.layer>p.layer&&(q.solid||q.type==='terrace'||q.type==='wall')))continue;
   if(protectedEdges.has((p.x+dx*.5)+':'+(p.z+dz*.5)+':'+p.layer))continue;
   if(p.type==='deck'&&side===p.rotation)continue;
   // These are real fixed approach slabs, outside editable tile records.
   const x=(p.x-5.5)*8;if(p.layer===0&&p.z===11&&side===2&&(x>=13&&x<=31||Math.abs(x+12)<4||Math.abs(x-41)<4))continue;
   sides.push(side);
  }
  if(sides.length||roundFootprint(p))lips.push({cell:{...p},sides,openings,round:roundFootprint(p)});
 }
 return {base:[...base.values()],lips};
}

// A real steep retaining wedge: below half a chibi's height, with a face too
// steep for the normal floor solver to turn it into an accidental exit ramp.
export function retainingLipGeometry(){
 const s=new T.Shape();s.moveTo(-.85,0);s.lineTo(-.22,1);s.lineTo(0,1);s.lineTo(0,0);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:8,bevelEnabled:false});g.rotateY(Math.PI/2);g.translate(-4,0,0);return g;
}
export function roundRetainingGeometry(sides){
 const pos=[],indices=[],allowed=new Set(sides),n=48;
 for(let i=0;i<n;i++){
  const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,mid=(a+b)/2,side=Math.abs(Math.cos(mid))>Math.abs(Math.sin(mid))?(Math.cos(mid)>0?3:1):(Math.sin(mid)>0?2:0);if(!allowed.has(side)){const axis=[-Math.PI/2,Math.PI,Math.PI/2,0][side],angle=Math.atan2(Math.sin(mid-axis),Math.cos(mid-axis));if(Math.abs(angle)<Math.PI/15)continue;}
  const start=pos.length/3;
  for(const angle of [a,b])for(const [r,y]of [[3.15,0],[3.78,1],[4,1],[4,0]])pos.push(Math.cos(angle)*r,y,Math.sin(angle)*r);
  for(let j=0;j<4;j++){const k=(j+1)%4;indices.push(start+j,start+4+j,start+4+k,start+j,start+4+k,start+k);}
  indices.push(start,start+1,start+2,start,start+2,start+3,start+4,start+6,start+5,start+4,start+7,start+6);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

// Connected square tiles share vertices and have no internal cliff faces.
// Scaling each lower contour about the component center preserves real holes.
export function occupiedCliffGeometries(base){
 const square=new Map(base.filter(p=>!roundFootprint(p)).map(p=>[key(p),p])),remaining=new Set(square.keys()),result=[];
 while(remaining.size){const first=remaining.values().next().value,group=[square.get(first)];remaining.delete(first);for(let i=0;i<group.length;i++)for(const [dx,dz]of dirs){const k=(group[i].x+dx)+':'+(group[i].z+dz);if(remaining.delete(k))group.push(square.get(k));}
  const cx=group.reduce((s,p)=>s+(p.x-5.5)*8,0)/group.length,cz=group.reduce((s,p)=>s+(p.z-5.5)*8-4,0)/group.length,pos=[],indices=[],vertices=new Map(),rows=[[.22,1],[-6,1],[-17,.86],[-33,.56]];
  function v(x,z,row){const id=x+':'+z+':'+row;if(vertices.has(id))return vertices.get(id);const [y,f]=rows[row],jitter=row?Math.sin(x*7.31+z*3.19)*.32:0,index=pos.length/3;pos.push(cx+(x-cx)*f+jitter,y,cz+(z-cz)*f+jitter*.6);vertices.set(id,index);return index;}
  for(const p of group){const x=(p.x-5.5)*8,z=(p.z-5.5)*8-4,corners=[[x-4,z-4],[x+4,z-4],[x+4,z+4],[x-4,z+4]],top=corners.map(([x,z])=>v(x,z,0)),bottom=corners.map(([x,z])=>v(x,z,3));indices.push(top[0],top[2],top[1],top[0],top[3],top[2],bottom[0],bottom[1],bottom[2],bottom[0],bottom[2],bottom[3]);
   for(let side=0;side<4;side++){const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][side];if(square.has((p.x+dx)+':'+(p.z+dz)))continue;for(let row=0;row<3;row++){const a=corners[side],b=corners[(side+1)%4],a0=v(...a,row),b0=v(...b,row),a1=v(...a,row+1),b1=v(...b,row+1);indices.push(a0,b0,b1,a0,b1,a1);}}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();result.push(g);
 }
 for(const p of base.filter(roundFootprint)){const g=new T.CylinderGeometry(4,2.2,33.22,48,3);g.translate((p.x-5.5)*8,-16.39,(p.z-5.5)*8-4);result.push(g);}
 return result;
}
