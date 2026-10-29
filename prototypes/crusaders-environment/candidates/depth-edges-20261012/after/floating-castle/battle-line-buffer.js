import * as T from '../vendor/three.module.js';

// Keep GPU geometry alive between frames; draw only the current endpoints.
export function createLineBuffer(capacity=32){
 const geometry=new T.BufferGeometry(),sphere=new T.Sphere();
 let size=Math.max(1,capacity),positions=new Float32Array(size*3),count=0;
 function install(){geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));}
 install();geometry.boundingSphere=sphere;geometry.setDrawRange(0,0);
 return {geometry,begin(){count=0;},point(p,yOffset=null){
  if(count===size){size*=2;const next=new Float32Array(size*3);next.set(positions);geometry.dispose();positions=next;install();}
  const i=count++*3;positions[i]=p.x;positions[i+1]=yOffset===null?p.y:p.y+yOffset;positions[i+2]=p.z||0;
 },finish(){
  geometry.setDrawRange(0,count);
  if(!count){sphere.center.set(0,0,0);sphere.radius=0;return;}
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(let i=0;i<count*3;i+=3){const x=positions[i],y=positions[i+1],z=positions[i+2];minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);}
  sphere.center.set((minX+maxX)/2,(minY+maxY)/2,(minZ+maxZ)/2);let radiusSq=0;
  for(let i=0;i<count*3;i+=3)radiusSq=Math.max(radiusSq,(positions[i]-sphere.center.x)**2+(positions[i+1]-sphere.center.y)**2+(positions[i+2]-sphere.center.z)**2);
  sphere.radius=Math.sqrt(radiusSq);
  const attribute=geometry.attributes.position;attribute.updateRange.offset=0;attribute.updateRange.count=count*3;attribute.needsUpdate=true;
 }};
}
