import * as T from '../vendor/three.module.js';
import {buildCastle} from './castle.js';
export function buildAerie(mats){
 const {castle,solids,route}=buildCastle(mats);const root=new T.Group();root.add(castle);
 const features=new T.Group();root.add(features);const boxG=new T.BoxGeometry(1,1,1);
 function mesh(g,m,x,y,z,solid=false){const o=new T.Mesh(g,m);o.position.set(x,y,z);features.add(o);if(solid)solids.push(o);return o;}
 function box(x,y,z,w,h,d,m=mats.stone,solid=false){const o=mesh(boxG,m,x,y,z,solid);o.scale.set(w,h,d);return o;}
 function ring(x,y,z,r,m=mats.edge){const o=mesh(new T.TorusGeometry(r,.2,4,40),m,x,y,z);o.rotation.x=Math.PI/2;return o;}
 // Give the steep upper bridge a real turning landing. The old sketch's two
 // thin corridor beams meet at a single end edge, too fragile for free walking.
 box(35.2,34.9,-49.8,7,.6,3,mats.paving,true);
 // A new inhabited keep crowns the borrowed terraces. Buttresses, deep windows
 // and blue hipped roofs preserve the narrow-spire language of the drawing.
 const summit=35.2;
 box(-17,summit+9,-55,22,18,18,mats.stone,true);
 box(-17,summit+.45,-55,24,.9,20,mats.edge,true);box(-17,summit+17.6,-55,24,.8,20,mats.edge);
 // The crown's large charge is visibly anchored to the keep, above its walkways.
 mesh(new T.CylinderGeometry(12.6,13.7,1.2,8),mats.paving,-17,summit+18.6,-55,true);
 mesh(new T.CylinderGeometry(10.5,11.5,1.5,8),mats.edge,-17,54.85,-55,true);
 for(let j=0;j<12;j++){const a=j*Math.PI/6;box(-17+Math.cos(a)*12.2,summit+19.7,-55+Math.sin(a)*12.2,1.9,1.7,1.9,mats.edge);}
 for(const x of [-27,-7]){box(x,summit+8.6,-45.5,1.25,17.2,1.7,mats.edge,true);box(x,summit+17,-45.5,2,.5,2.3,mats.edge);}
 const windowMat=new T.MeshBasicMaterial({color:0x253c59});windowMat.color.convertSRGBToLinear();
 for(const y of [summit+5,summit+12])for(const x of [-23,-17,-11]){box(x,y,-45.8,2.5,3.9,.2,mats.edge);box(x,y,-45.63,1.65,3.1,.1,windowMat);box(x,y,-45.54,.13,3.2,.12,mats.edge);box(x,y-.35,-45.54,1.7,.14,.12,mats.edge);box(x,y-2,-45.6,2.8,.3,.7,mats.edge);}
 for(const [x,z,h] of [[-29,-62,20],[-5,-63,24]]){mesh(new T.CylinderGeometry(2.1,2.4,h,10),mats.stone,x,summit+h/2,z,true);mesh(new T.CylinderGeometry(2.7,2.7,.7,10),mats.edge,x,summit+h,z);mesh(new T.ConeGeometry(3.3,10,10),mats.roof,x,summit+h+5,z,true);for(let j=4;j<h;j+=4)ring(x,summit+j,z,2.25);}
 const cloth=new T.Shape();cloth.moveTo(-1.2,0);cloth.lineTo(1.2,0);cloth.lineTo(1.2,-7);cloth.lineTo(0,-6);cloth.lineTo(-1.2,-7);cloth.closePath();
 for(const x of [-27,-7]){mesh(new T.ShapeGeometry(cloth),new T.MeshBasicMaterial({color:0x42778b,side:T.DoubleSide}),x,summit+14,-44.45);box(x,summit+14.2,-44.4,3.3,.18,.25,mats.edge);box(x,summit+11.7,-44.4,.15,3.4,.12,mats.edge);}
 mesh(new T.CylinderGeometry(4.2,4.5,.5,12),mats.edge,-9,9.05,24,true);ring(-9,9.5,24,3.9);
 const pool=mesh(new T.CircleGeometry(3.65,24),new T.MeshBasicMaterial({color:0x6ab9b8}),-9,9.33,24);pool.rotation.x=-Math.PI/2;
 mesh(new T.CylinderGeometry(.45,.8,2.4,8),mats.stone,-9,10.5,24);mesh(new T.SphereGeometry(1.15,8,5),mats.roof,-9,12.2,24);
 // Broad angular rock shelf and taper, with irregular hanging crags.
 const rock=mesh(new T.CylinderGeometry(55,13,42,11,3),mats.soil,0,-24,-4);rock.scale.z=1.26;rock.userData.visualOccluder=true;
 const positions=rock.geometry.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);positions.setXYZ(i,x*(1+.08*Math.sin(z*.7+y)),y,z*(1+.08*Math.cos(x*.4+y)));}positions.needsUpdate=true;rock.geometry.computeVertexNormals();
 for(let i=0;i<14;i++){const a=i*2.399,r=23+i%4*7;const crag=mesh(new T.ConeGeometry(4+i%4,14+i%5*3,5),mats.soil,Math.cos(a)*r,-36-i%3*4,Math.sin(a)*r-4);crag.rotation.z=Math.PI;crag.userData.visualOccluder=true;}
 // The entrance has a real landing apron continuous with the original ramp.
 box(22,-.35,70,18,2.24,22,mats.paving,true);box(22,-1.3,70,20,.45,24,mats.edge);
 for(const side of [-1,1]){const wall=box(22+side*9.5,1.25,73,1.35,2.5,15,mats.stone,true);wall.userData.wallDepth=1.35;wall.userData.wallRole='apron parapet';for(let z=66;z<81;z+=3)box(22+side*9.5,2.8,z,1.65,.65,1.3,mats.edge);}
 // Thin waterfalls have a stepped, painted appearance and dissolve into the clouds.
 const water=new T.MeshBasicMaterial({color:0x8cd8de,transparent:true,opacity:.48,side:T.DoubleSide,depthWrite:false});
 for(const [x,z,w] of [[-47,25,2.6],[41,-37,1.4]]){mesh(new T.PlaneGeometry(w,42,1,6),water,x,-22,z);for(let j=0;j<5;j++)box(x+(j%2)*.25,-5-j*7,z+.05,w*.7,.6,.04,new T.MeshBasicMaterial({color:0xd1f4e4,transparent:true,opacity:.65}));}

for(const solid of solids)solid.userData.structure=true;return {root,solids,route};
}
