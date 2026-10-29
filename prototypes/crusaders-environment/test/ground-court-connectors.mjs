import {profile,MAX_PARTS} from '../floating-castle/castle-rules.js';
// Experimental planning helper: caller must validate actual geometry afterward.
export function connectGroundPorts(input,options){
 const layout=input.map(p=>({...p})),bounds=profile(options),columns=new Map(),ground=new Map(),key=p=>p.x+':'+p.z;
 for(const p of layout){if(!columns.has(key(p)))columns.set(key(p),[]);columns.get(key(p)).push(p);if(p.layer===0)ground.set(key(p),p);}
 const core=layout.find(p=>p.type==='core'),changes=[],routes=[];
 const targets=layout.filter(p=>p.type==='deck'&&p.layer===0);
 for(const target of targets){
  const start={x:8,z:11},startKey=key(start),endKey=key(target),scores=new Map([[startKey,0]]),prior=new Map(),open=[{...start,cost:0}];let found=false;
  while(open.length){open.sort((a,b)=>a.cost-b.cost);const at=open.shift(),id=key(at);if(at.cost!==scores.get(id))continue;if(id===endKey){found=true;break;}
   for(const [dx,dz] of [[0,-1],[-1,0],[0,1],[1,0]]){const p={x:at.x+dx,z:at.z+dz},k=key(p),pieces=columns.get(k),floor=ground.get(k);if(!pieces||p.x<bounds.minX||p.x>=bounds.maxX||p.z<bounds.minZ||p.z>=bounds.maxZ||Math.hypot(p.x-core.x,p.z-core.z)<2.2)continue;
    if(pieces.some(q=>['core','protector'].includes(q.type)))continue;
    if(floor&&!['terrace','floor','deck','spawn','gate','garden','cannon','heavyCannon','beacon'].includes(floor.type))continue;
    if(!floor&&pieces.some(q=>q.layer===0))continue;
    const cost=at.cost+1+(!floor?6:0)+(floor&&['cannon','heavyCannon','beacon','garden'].includes(floor.type)&&k!==endKey?3:0);if(cost>=(scores.get(k)??Infinity))continue;scores.set(k,cost);prior.set(k,id);open.push({...p,cost});
   }
  }
  if(!found)throw Error('No ground connector candidate for port '+endKey);
  const path=[];for(let k=endKey;;k=prior.get(k)){const [x,z]=k.split(':').map(Number);path.push({x,z});if(k===startKey)break;}path.reverse();routes.push({target:{...target},path});
  for(const p of path)if(!ground.has(key(p))){if(layout.length===MAX_PARTS)throw Error('Ground connectors exceed the part budget');const floor={...p,layer:0,type:'floor',rotation:0};layout.push(floor);ground.set(key(p),floor);columns.get(key(p)).push(floor);changes.push(floor);}
 }
 return {layout,changes,routes};
}
