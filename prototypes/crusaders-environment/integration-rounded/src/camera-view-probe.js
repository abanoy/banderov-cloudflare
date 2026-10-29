import * as T from '../vendor/three.module.js';
// Inspect actual torso and head sight lines to a candidate camera position.
// Project the head obstruction onto the torso's camera direction so the caller
// can shorten the same camera arm. Character geometry and physics stay intact.
export function createCharacterViewProbe(obstacles,{headHalfWidth=0,headSideDrop=0}={}){
 // Enable Three's local-box rejection before triangle work. Existing bounds
 // remain intact; new bounds are slightly padded and never change triangles.
 // Vertex edits require recomputing bounds, as with ordinary Three geometry.
 const seen=new Set();
 for(const mesh of obstacles){const geometry=mesh.geometry;if(!geometry||seen.has(geometry))continue;seen.add(geometry);if(geometry.boundingBox===null){geometry.computeBoundingBox();geometry.boundingBox?.expandByScalar(.000001);}}

 const intersections=[];
 const headSamples=headHalfWidth>0?[0,-1,1]:[0];
 const ray=new T.Raycaster(),goal=new T.Vector3(),direction=new T.Vector3(),offset=new T.Vector3(),origin=new T.Vector3(),right=new T.Vector3();
 return function(aim,head,cameraDirection,range){
  ray.set(aim,cameraDirection);ray.far=range;intersections.length=0;const body=ray.intersectObjects(obstacles,false,intersections)[0];
  goal.copy(aim).addScaledVector(cameraDirection,range);let best=body;
  if(headHalfWidth>0){right.set(cameraDirection.z,0,-cameraDirection.x);if(right.lengthSq()<.000001)right.set(1,0,0);else right.normalize();}
  for(const side of headSamples){
   origin.copy(head);if(side){origin.addScaledVector(right,side*headHalfWidth);origin.y-=headSideDrop;}
   direction.subVectors(goal,origin);const length=direction.length();if(length<.000001)continue;
   ray.set(origin,direction.multiplyScalar(1/length));ray.far=length;intersections.length=0;const top=ray.intersectObjects(obstacles,false,intersections)[0];if(!top)continue;
   const projected=offset.subVectors(top.point,aim).dot(cameraDirection);
   if(projected>.05&&projected<range&&(!best||projected<best.distance))best={...top,distance:projected};
  }
  return best;
 };
}
