// Tile ownership and outward dock clearance; no hidden floor is assumed.
const dirs=[[0,-1],[-1,0],[0,1],[1,0]],key=p=>p.x+':'+p.z+':'+p.layer;
export function inspectCastleFootprint(layout){
 const cells=new Map(layout.map(p=>[key(p),p])),remaining=new Set(layout.filter(p=>p.type==='deck')),ports=[],issues=[];
 while(remaining.size){const first=remaining.values().next().value,group=[first];remaining.delete(first);for(let i=0;i<group.length;i++)for(const p of remaining)if(p.layer===first.layer&&Math.abs(p.x-group[i].x)+Math.abs(p.z-group[i].z)===1){remaining.delete(p);group.push(p);}
  const [dx,dz]=dirs[first.rotation],owned=new Set(group.map(key));let attached=false,blocked=false;
  for(const p of group){const back=cells.get(key({...p,x:p.x-dx,z:p.z-dz}));if(back&&!owned.has(key(back))&&!['wall','house','tower','roof','embankment','core','protector'].includes(back.type))attached=true;
   for(let n=1;n<=4;n++){const x=p.x+dx*n,z=p.z+dz*n;if(layout.some(q=>q.x===x&&q.z===z&&q.layer>=p.layer&&!owned.has(key(q))))blocked=true;}}
  const port={cells:group.map(p=>({...p})),rotation:first.rotation,attached,clear:!blocked,big:group.length>=3};ports.push(port);
  if(!attached)issues.push({code:'detached-port',cell:{...first},message:'Harbor deck needs a connected boarding court behind its facing edge.'});if(blocked)issues.push({code:'blocked-port',cell:{...first},message:'Harbor facing channel is blocked. Move it to an edge or leave four clear tiles ahead.'});
 }
 const wallCells=layout.filter(p=>['wall','curvedWall'].includes(p.type)),unseen=new Set(wallCells);
 while(unseen.size){const first=unseen.values().next().value,queue=[first];unseen.delete(first);let attached=false;for(let i=0;i<queue.length;i++)for(const [dx,dz] of dirs){const p=queue[i],n=cells.get(key({...p,x:p.x+dx,z:p.z+dz}));if(!n){if(layout.some(q=>q.x===p.x+dx&&q.z===p.z+dz&&q.layer>=p.layer&&!['wall','curvedWall','roof'].includes(q.type)))attached=true;continue;}if(unseen.has(n)){unseen.delete(n);queue.push(n);}else if(!['wall','curvedWall','roof'].includes(n.type))attached=true;}if(!attached)issues.push({code:'detached-wall',cell:{...first},message:'Curtain wall group has no adjoining castle floor or court.'});}
 return {occupiedColumns:new Set(layout.map(p=>p.x+':'+p.z)).size,ports,spawns:layout.filter(p=>p.type==='spawn').map(p=>({...p})),issues,ok:issues.length===0};
}
