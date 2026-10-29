import * as THREE from '../vendor/three.module.js';
// Only authored static instance transforms belong here. Moving a parent remains
// supported; changing instance matrices requires rebuilding these bounds.
export function installStaticInstanceBounds(objects){
 const matrix=new THREE.Matrix4(),part=new THREE.Box3();
 let installed=0;
 for(const object of objects){
  if(!object.isInstancedMesh)continue;
  const geometry=object.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
  const local=new THREE.Box3();
  for(let i=0;i<object.count;i++){
   object.getMatrixAt(i,matrix);part.copy(geometry.boundingBox).applyMatrix4(matrix);local.union(part);
  }
  const world=new THREE.Box3(),lastMatrix=new THREE.Matrix4();let cached=false;
  const detailed=object.raycast;
  object.raycast=function(raycaster,hits){
   if(!cached||!lastMatrix.equals(this.matrixWorld)){
    lastMatrix.copy(this.matrixWorld);world.copy(local).applyMatrix4(this.matrixWorld).expandByScalar(.00001);cached=true;
   }
   if(raycaster.ray.intersectsBox(world))detailed.call(this,raycaster,hits);
  };
  installed++;
 }
 return installed;
}
