import * as T from '../vendor/three.module.js';
import {rockBuilder,addRock,islandFringe} from './sky-rock.js?v=dbc-20261018';
import {makeWaterfall} from './arena-garden.js?v=dbc-20261018';
// Visual-only floating base under each castle: one strata underside (rock 0) plus 14 detached
// hanging crags (15 camera occluders per castle, as before), and a separate dressing group with a
// moss lip, dangling roots and two thin falls. Nothing here is ever a collider.
export function createFloatingFoundations(world){
 const roots=world.castles.map(c=>{const g=new T.Group();g.name='Detached floating foundation rocks';c.add(g);return g;});
 const dressing=world.castles.map(c=>{const g=new T.Group();g.name='Floating foundation dressing';c.add(g);return g;});
 const material=()=>world.mats.rock||world.mats.soil;
 function clear(team){const g=roots[team];for(const m of g.children.slice()){g.remove(m);const index=world.occluders.indexOf(m);if(index>=0)world.occluders.splice(index,1);const fade=m.userData.fadeMaterial;if(fade&&fade!==world.mats.soil&&fade!==world.mats.rock)fade.dispose();delete m.userData.fadeMaterial;m.geometry.dispose();}
  const d=dressing[team];for(const m of d.children.slice()){d.remove(m);if(m.userData.ownedGeometry)m.geometry.dispose();}}
 function rock(g,options){const b=rockBuilder();addRock(b,{...options,x:0,y:0,z:0});const mesh=new T.Mesh(b.geometry(),material());mesh.position.set(options.x,options.y,options.z);mesh.userData.visualOccluder=true;g.add(mesh);world.occluders.push(mesh);return mesh;}
 function sync(){for(const [team,g] of roots.entries()){clear(team);const c=world.castles[team],box=new T.Box3();c.updateWorldMatrix(true,true);const inverse=c.matrixWorld.clone().invert();for(const m of world.solids){let owned=false,excluded=false;for(let p=m;p;p=p.parent){if(!p.visible||p===world.harbors?.[team]?.root)excluded=true;if(p===c)owned=true;}if(owned&&!excluded&&m.geometry){m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld).applyMatrix4(inverse));}}if(box.isEmpty())continue;
  const centre=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),top=box.min.y+3.5,rx=Math.max(8,size.x*.34),rz=Math.max(8,size.z*.34),depth=Math.min(96,Math.max(40,Math.max(rx,rz)*1.55)),seed=team*101+Math.round(size.x+size.z);
  rock(g,{x:centre.x,y:top,z:centre.z,rx,rz,depth,seed,sides:20,rings:10,jitter:.13,stalactites:12,cap:true,lip:1.03,taper:.62}).name='Floating base underside';
  for(let i=1;i<15;i++){const angle=i*2.399+team,ring=1.08+(i%3)*.16,x=centre.x+Math.cos(angle)*rx*ring,z=centre.z+Math.sin(angle)*rz*ring,r=2.4+(i%4)*.9+(i%3)*.4,attached=i%3===0;
   rock(g,{x,y:attached?top-1.5-(i%2)*2:box.min.y-6-(i%4)*5.5,z,rx:r*1.15,rz:r,depth:r*(2.3+(i%3)*.5),seed:seed+i*17,sides:7,rings:4,jitter:.2,stalactites:i%2,cap:attached,dome:attached?0:r*.55,taper:.7}).name='Hanging crag '+i;}
  g.userData.rocks=15;
  const d=dressing[team];for(const o of islandFringe(d,world.mats,{x:centre.x,y:top+.05,z:centre.z,rx:rx*1.02,rz:rz*1.02,seed:seed+5,name:'Floating base'}))o.userData.ownedGeometry=o.isInstancedMesh?false:true;
  for(const k of [0,1]){const a=(k?2.3:-.9)+team*1.7,e=1/Math.sqrt((Math.sin(a)/rx)**2+(Math.cos(a)/rz)**2);makeWaterfall(d,{x:centre.x,y:top-.4,z:centre.z,angle:a,radius:e*1.04,width:2.2+k*.6,height:38+k*10,drift:1.3,name:'Floating base waterfall '+(k+1)}).userData.ownedGeometry=true;}
 }}
 sync();return {sync,roots,dressing};
}
