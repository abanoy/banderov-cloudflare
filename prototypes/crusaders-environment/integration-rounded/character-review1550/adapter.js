import {createChibi} from './model.js';
// Future integration only. No collision, networking or environment source changes.
export function createWorldCharacter({worldHeight=2.1,parameters={}}={}){
 if(!Number.isFinite(worldHeight)||worldHeight<=0)throw new RangeError('worldHeight must be positive');
 const actor=createChibi(parameters),height=actor.bounds().max.y;actor.root.scale.setScalar(worldHeight/height);
 return Object.assign(actor,{worldHeight,forwardAxis:'+Z',anatomicalRightAxis:'-X',setPosition(x,feetY,z){if([x,feetY,z].every(Number.isFinite))actor.root.position.set(x,feetY,z);},setFacingVector(x,z){if(Number.isFinite(x)&&Number.isFinite(z)&&(x!==0||z!==0))actor.setFacing(Math.atan2(x,z));}});
}
