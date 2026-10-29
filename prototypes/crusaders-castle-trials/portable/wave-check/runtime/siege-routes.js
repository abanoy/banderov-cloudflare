import * as T from '../vendor/three.module.js';
import {cellPosition} from './castle-rules.js';
import {DesignRejection} from './import-feedback.js';
export const SECTORS=['NORTH','EAST','SOUTH','WEST'];
export async function siegeRoutes(world,nav,layout){
 const castle=world.castles[0],core=layout.find(p=>p.type==='core');if(!core)throw Error('A MAIN core is required.');
 const walls=layout.filter(p=>['wall','gate','curvedWall'].includes(p.type));if(!walls.length)throw Error('Define the castle perimeter with walls and outward gates.');
 const limits=[Math.min(...walls.map(p=>p.z)),Math.max(...walls.map(p=>p.x)),Math.max(...walls.map(p=>p.z)),Math.min(...walls.map(p=>p.x))],directions=[[0,-1],[1,0],[0,1],[-1,0]],routes=[];
 const c=cellPosition(core),inverse=castle.matrixWorld.clone().invert();
 const destinations=nav.nodes.filter(n=>{const p=new T.Vector3(n.x,n.y,n.z).applyMatrix4(inverse);const d=Math.hypot(p.x-c.x,p.z-c.z);return d>=13.8&&d<=18&&Math.abs(p.y-c.y)<.3;});
 if(!destinations.length)throw new DesignRejection([{code:'core-approach',cell:{...core},message:'MAIN has no clear supported approach beside the Wave pedestal on its own layer.',suggestion:`Connect floors around core cell (${core.x}, ${core.z}) at layer ${core.layer}; leave the 14–18 metre pedestal approach ring clear. Trials uses a smaller core, so its neighbouring pieces may obstruct the Wave pedestal.`}],'approach');
 for(let sector=0;sector<4;sector++){
  const [dx,dz]=directions[sector],axis=dx?'x':'z',gates=layout.filter(p=>p.type==='gate'&&p[axis]===limits[sector]&&p.layer===0&&(p.rotation%2===(dx?1:0)));let found;
  for(const gate of gates){const local=cellPosition(gate),start=new T.Vector3(local.x+dx*8,local.y,local.z+dz*8).applyMatrix4(castle.matrixWorld),from=nav.nearest(start,1);
   if(!from)continue;
   for(const target of destinations){const path=await nav.path(from,{...target,radius:1.5},{maxMs:1000});if(path.reachable&&!path.points.some(p=>p.launchTo!==undefined)&&path.points.length>2){found={sector,points:path.points,gate:{...gate},start:from};break;}}if(found)break;
  }
  if(!found)throw new DesignRejection([{code:'raid-route',sector:SECTORS[sector],cell:gates[0]||core,message:SECTORS[sector]+': no collision-walked route connects this exterior gate to the MAIN approach.',suggestion:'Connect this ground gate to the core layer with continuous floors and stairs, clear gate/headroom blockers, and run the editor walking check. No shadows were spawned.'}],'raid-route');routes.push(found);
 }return routes;
}
