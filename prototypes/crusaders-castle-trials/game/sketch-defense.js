import * as T from '../vendor/three.module.js';
import {buildArmory,createArmoryAnimator} from '../sketch-armory/models.js';

// Existing castle material ownership and team recolouring remain authoritative.
export function sketchDefense(type,mats,{openSides=[],armed=true}={}){
 const kind=type==='tower'?'watchtower':type==='cannon'?'bow':type==='trebuchet'?'trebuchet':'cannon';
 const model=buildArmory(kind,{...mats,wood:mats.bark,iron:mats.dark,brass:mats.edge,dark:mats.dark,rope:mats.sail},{openSides,armed});
 if(type==='tower')model.root.scale.y=8/12.5;
 if(type==='trebuchet')model.root.scale.setScalar(.58);
 const weaponType=type==='tower'?'heavyCannon':type,inverse=new T.Matrix4();
 function muzzle(out){model.root.updateWorldMatrix(true,true);model.muzzleNode.getWorldPosition(out);return out;}
 const origin=muzzle(new T.Vector3());inverse.copy(model.root.matrixWorld).invert();origin.applyMatrix4(inverse);
 return {...model,...bindSketchDefense(model.root),weaponType,metadata:{type:weaponType,muzzle:origin.toArray(),direction:[0,0,1],sketch:true,model:kind},armed};
}

// Bind by named mechanism nodes so reserved ship clones own their own aiming rig.
export function bindSketchDefense(root){
 const node=root.getObjectByName('sketch-muzzle'),swivel=root.getObjectByName('sketch-swivel'),barrel=root.getObjectByName('sketch-barrel'),arm=root.getObjectByName('sketch-arm'),local=new T.Vector3();
 if(!node)return null;
 const animator=createArmoryAnimator(root);
 return {muzzle(out){root.updateWorldMatrix(true,true);return node.getWorldPosition(out);},aim(target,time=0,fire=false){root.updateWorldMatrix(true,false);local.copy(target);root.worldToLocal(local);const horizontal=Math.hypot(local.x,local.z),yaw=Math.atan2(local.x,local.z),origin=node.getWorldPosition(new T.Vector3());root.worldToLocal(origin);const pitch=Math.max(-.25,Math.min(.8,Math.atan2(local.y-origin.y,horizontal)));if(swivel)swivel.rotation.y=yaw;if(barrel)barrel.rotation.x=-pitch;else if(swivel)swivel.rotation.x=-pitch;if(arm){arm.rotation.order='YXZ';arm.rotation.y=yaw;}if(fire)animator.markShot(time);},markShot(time){animator.markShot(time);},update(time){animator.update(time);}};
}
