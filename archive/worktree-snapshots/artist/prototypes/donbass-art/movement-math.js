// World +z faces the initial camera (renderer yaw0); world +x is screen-right.
export function directionIndex(angle,count=8){return ((Math.round(angle/(Math.PI*2)*count)%count)+count)%count;}
export function screenMotion(x,y,cameraAz=0){const length=Math.hypot(x,y);if(!length)return {x:0,z:0,length:0,heading:0};x/=length;y/=length;const dx=x*Math.cos(cameraAz)+y*Math.sin(cameraAz),dz=-x*Math.sin(cameraAz)+y*Math.cos(cameraAz);return {x:dx,z:dz,length:1,heading:Math.atan2(dx,dz)};}
export function constrainMove(position,dx,dz,obstacles){const candidate={x:Math.max(-12,Math.min(12,position.x+dx)),z:Math.max(-12,Math.min(12,position.z+dz))};if(obstacles.some(p=>Math.hypot(candidate.x-p.x,candidate.z-p.z)<p.r+.35))return position;return candidate;}

// Preserve the last diagonal when a chord releases one key a frame before the
// other. Position changes immediately; only a turn during an existing walk
// waits40ms. A fresh walk adopts its heading immediately, idle keeps its facing.
export function settleHeading(state,target,active,dt){
 const same=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<1e-8;
 if(!active)return {heading:state.heading,active:false,candidate:null,age:0};
 if(!state.active||same(target,state.heading))return {heading:target,active:true,candidate:null,age:0};
 if(state.candidate===null||!same(target,state.candidate))return {...state,active:true,candidate:target,age:0};
 const age=state.age+Math.max(0,dt);
 return age>=.04?{heading:target,active:true,candidate:null,age:0}:{...state,active:true,age};
}
