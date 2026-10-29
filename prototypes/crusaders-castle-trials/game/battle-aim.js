// Shared by the actual projectile emitter and the visible prediction.
export function intercept(origin,target,velocity,speed){
 const r={x:target.x-origin.x,y:target.y-origin.y,z:target.z-origin.z},v=velocity||{x:0,y:0,z:0};
 const a=v.x*v.x+v.y*v.y+v.z*v.z-speed*speed,b=2*(r.x*v.x+r.y*v.y+r.z*v.z),c=r.x*r.x+r.y*r.y+r.z*r.z,disc=b*b-4*a*c;
 let t=0;if(Math.abs(a)<1e-8)t=b<0?-c/b:0;else if(disc>=0){const roots=[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)].filter(n=>n>0);t=roots.length?Math.min(...roots):0;}
 t=Math.min(3,Math.max(0,t));return {x:target.x+v.x*t,y:target.y+v.y*t,z:target.z+v.z*t};
}
export function shotSolution(origin,target,weapon){
 if(!origin||!target||![origin.x,origin.y,origin.z,target.x,target.y,target.z].every(Number.isFinite))return null;
 const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,d=Math.hypot(dx,dy,dz),g=weapon.gravity||0;
 if(d<.1)return null;
 const time=g?Math.max(.45,Math.hypot(dx,dz)/weapon.speed):d/weapon.speed;
 if(time>weapon.life)return null;
 const velocity={x:dx/time,y:dy/time+g*time/2,z:dz/time};
 if(g&&Math.hypot(velocity.x,velocity.y,velocity.z)>weapon.speed*1.6)return null;
 return {time,gravity:g,velocity};
}
export function trajectory(origin,solution,steps=32){
 return Array.from({length:steps+1},(_,i)=>{const t=solution.time*i/steps;return {x:origin.x+solution.velocity.x*t,y:origin.y+solution.velocity.y*t-solution.gravity*t*t/2,z:origin.z+solution.velocity.z*t};});
}
