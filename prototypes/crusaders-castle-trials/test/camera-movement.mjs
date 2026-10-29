import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {cameraMovement} from '../camera-movement.js';
for(const yaw of [0,.65,Math.PI/2,Math.PI,-Math.PI/2,7.2]){
 const camera=new T.PerspectiveCamera();camera.position.set(Math.sin(yaw)*100,100,Math.cos(yaw)*100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),forward=camera.getWorldDirection(new T.Vector3());forward.y=0;forward.normalize();
 for(const [key,direction] of [['KeyW',forward],['ArrowUp',forward],['KeyS',forward.clone().negate()],['KeyD',right],['KeyA',right.clone().negate()]]){const v=cameraMovement(new Set([key]),yaw);assert(Math.abs(v.x-direction.x)<1e-10&&Math.abs(v.z-direction.z)<1e-10);}
 const diagonal=cameraMovement(new Set(['KeyW','KeyD']),yaw);assert(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-10);assert.deepEqual(cameraMovement(new Set(['KeyW','KeyS','KeyA','KeyD']),yaw),{x:0,z:0});
 const recovered=Math.atan2(-forward.x,-forward.z);assert(Math.abs(cameraMovement(new Set(['KeyW']),recovered).x-forward.x)<1e-10);
}
console.log('PASS camera-relative WASD/arrows against actual rotated camera axes; normalized diagonals, opposite cancellation and castle camera yaw');
