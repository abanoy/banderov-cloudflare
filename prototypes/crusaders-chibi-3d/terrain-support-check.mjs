import assert from 'node:assert/strict';
import * as T from './vendor/three.module.js';
import {createWorldCharacter} from './src/adapter.js';
import {liftPenetratingSoles} from './research/terrain-support.js';
const actor=createWorldCharacter(),point=new T.Vector3();let checks=0,maxLift=0;
for(const slope of [-.3,-.1,0,.1,.3])for(const facing of [0,Math.PI/4,Math.PI/2,Math.PI])for(let phase=0;phase<32;phase++){
 actor.setPosition(3,4.5,5);actor.setFacing(facing);actor.setPose('walk');for(let i=0;i<phase;i++)actor.update(.025);const root=actor.root.position.clone(),height=(x,z)=>4.5+slope*(z-5);
 const report=liftPenetratingSoles(actor,height);maxLift=Math.max(maxLift,...report.map(r=>r.lift));assert(actor.root.position.equals(root));assert.equal(actor.root.rotation.y,facing);
 for(const side of ['right','left']){let min=Infinity;actor.parts[side+'-foot'].traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);min=Math.min(min,point.y-height(point.x,point.z));}});assert(min>=-1e-8);checks++;}
}
actor.setPose('walk');const before=actor.parts['right-foot'].parent.position.y;const missing=liftPenetratingSoles(actor,()=>null);assert(missing.every(r=>r.missing&&r.lift===0));assert.equal(actor.parts['right-foot'].parent.position.y,before);
for(const value of [-1,NaN,Infinity])assert.throws(()=>liftPenetratingSoles(actor,()=>4.5,{maxLift:value}),RangeError);
assert.throws(()=>liftPenetratingSoles(actor,null),TypeError);
actor.root.rotation.z=.1;assert.throws(()=>liftPenetratingSoles(actor,()=>4.5),RangeError);actor.root.rotation.z=0;
actor.root.scale.x*=2;assert.throws(()=>liftPenetratingSoles(actor,()=>4.5),RangeError);actor.root.scale.x=actor.root.scale.y;
actor.setPose('walk');const steep=liftPenetratingSoles(actor,(x,z)=>4.5+3*(z-5));assert(steep.some(r=>r.limited));assert(steep.every(r=>r.lift<=.08));
actor.update(0);assert.equal(actor.parts['right-foot'].parent.position.y,before,'update clears provisional lift');
const edge=liftPenetratingSoles(actor,(x,z)=>z>5.04?null:4.55);assert(edge.every(r=>r.missing&&r.lift===0),'partially unsupported sole is skipped');
const zero=liftPenetratingSoles(actor,()=>4.55,{maxLift:0});assert(zero.every(r=>r.lift===0&&r.limited),'zero cap reports unresolved penetration');
actor.dispose();console.log(JSON.stringify({checks,maxLift,boundaries:'missing/partial support, steep cap, zero cap, invalid arguments/transforms, next-update restoration passed',scope:'Synthetic infinite planes, actual foot/ink vertices; visual lift only, no terrain selection/physics/horizontal planting/sole orientation/performance proof'}));
