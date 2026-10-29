import * as T from '../vendor/three.module.js';
// Selectable visual experiment, excluded from runtime packages. Call after update.
// The caller supplies the already-selected support surface; this never selects
// floors, moves the actor root, changes facing, or writes collision state.
export function liftPenetratingSoles(actor,sampleHeight,{maxLift=.08}={}){
 if(typeof sampleHeight!=='function')throw new TypeError('sampleHeight must be a function');
 if(!Number.isFinite(maxLift)||maxLift<0)throw new RangeError('maxLift must be finite and nonnegative');
 const root=actor.root,s=root.scale;
 if(s.y<=0||Math.abs(s.x-s.y)>1e-10||Math.abs(s.z-s.y)>1e-10||Math.abs(root.rotation.x)>1e-10||Math.abs(root.rotation.z)>1e-10)throw new RangeError('visual support requires upright uniform positive scale');
 const result=[];actor.root.updateMatrixWorld(true);
 for(const side of ['right','left']){
  const foot=actor.parts[side+'-foot'],rig=foot.parent,point=new T.Vector3();let gap=Infinity,missing=false;
  foot.traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);const y=sampleHeight(point.x,point.z);if(!Number.isFinite(y)){missing=true;continue;}gap=Math.min(gap,point.y-y);}});
  const lift=!missing&&Number.isFinite(gap)?Math.min(maxLift,Math.max(0,-gap)):0;
  // Uniform world scale and upright root are the existing adapter contract.
  const scale=actor.root.scale.y*rig.parent.scale.y;
  if(lift>0&&scale>0)rig.position.y+=lift/scale;
  result.push({side,gap,missing,lift,limited:!missing&&-gap>maxLift});
 }
 actor.root.updateMatrixWorld(true);return result;
}
