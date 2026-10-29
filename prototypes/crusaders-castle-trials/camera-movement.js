// Flatten camera forward/right onto the walking plane; diagonals keep unit speed.
export function cameraMovement(keys,yaw){
 const side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
 const back=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
 const length=Math.hypot(side,back);
 if(!length)return {x:0,z:0};
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:(side*c+back*s)/length,z:(back*c-side*s)/length};
}
