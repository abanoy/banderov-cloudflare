import * as T from '../vendor/three.module.js';
// Fixed-step, locally simulated capsule and ballistic pod. The visible meshes
// supply support/obstruction surfaces, so there is no invisible connecting floor.
export function flightWorld(solids,pads){
 const s={x:pads[0].x,y:pads[0].y,z:pads[0].z,vx:0,vy:0,vz:0,grounded:true,flight:false,manual:false,home:0,time:0,falls:0,landings:0,pad:0,phase:'ground',place:null},gravity=14;
 const handling={speed:28,response:8,brake:3};
 const ray=new T.Raycaster(),normal=new T.Vector3(),origin=new T.Vector3(),direction=new T.Vector3(),radius=.48,normalMatrix=new T.Matrix3();
 let stepSolids=null;const castHits=[];
 function visibleSolids(){return solids.filter(m=>{for(let p=m;p;p=p.parent)if(!p.visible)return false;return true;});}
 function cast(x,y,z,dx,dy,dz,range){origin.set(x,y,z);direction.set(dx,dy,dz).normalize();ray.set(origin,direction);ray.far=range;castHits.length=0;return ray.intersectObjects(stepSolids??visibleSolids(),false,castHits);}
 function floor(x,y,z,range=1){for(const hit of cast(x,y,z,0,-1,0,range)){normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));if(normal.y>.5)return {y:hit.point.y,normal:normal.clone(),home:hit.object.userData.castleIndex??null,place:hit.object.userData.place??null};}return null;}
 function nearPad(){return pads.findIndex(p=>s.grounded&&Math.hypot(s.x-p.x,s.z-p.z)<p.r+1.5&&Math.abs(s.y-p.y)<1);}
 function recover(){const p=pads[s.home];Object.assign(s,{x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:0,grounded:true,flight:false,manual:false,pad:s.home,phase:'ground',place:null});}
 function launch(index){if(s.flight||!s.grounded||nearPad()<0||index===nearPad()||!pads[index])return false;const p=pads[index],duration=Math.max(7.2,Math.hypot(p.x-s.x,p.z-s.z)/45);s.y+=3;s.vx=(p.x-s.x)/duration;s.vz=(p.z-s.z)/duration;s.vy=(p.y-s.y+.5*gravity*duration*duration)/duration;s.grounded=false;s.flight=true;s.manual=false;s.phase='rising';s.place=null;s.pad=index;return true;}
 function sideMove(dx,dz){const length=Math.hypot(dx,dz);if(!length)return;let limit=length;for(const h of [.65,1.3,1.95]){const hit=cast(s.x,s.y+h,s.z,dx,0,dz,length+radius)[0];if(hit)limit=Math.min(limit,Math.max(0,hit.distance-radius));}s.x+=dx/length*limit;s.z+=dz/length*limit;}
 // Visibility is reused only within a synchronous moving step; public queries refresh it.
 function step(dt,input){if(s.grounded&&!s.flight&&input.x===0&&input.z===0)return stepBody(dt,input);stepSolids=visibleSolids();try{return stepBody(dt,input);}finally{stepSolids=null;}}
 function stepBody(dt,input){s.time+=dt;const moving=Math.hypot(input.x,input.z)>.01;if(s.flight){if(moving){s.manual=true;const dx=input.x*handling.speed-s.vx,dz=input.z*handling.speed-s.vz,n=Math.hypot(dx,dz),blend=Math.min(1-Math.exp(-handling.response*dt),110*dt/(n||1));s.vx+=dx*blend;s.vz+=dz*blend;}else if(s.manual){const drag=Math.exp(-handling.brake*dt);s.vx*=drag;s.vz*=drag;}}else{s.vx=input.x*10;s.vz=input.z*10;}
  sideMove(s.vx*dt,0);sideMove(0,s.vz*dt);
  if(s.grounded){const support=floor(s.x,s.y+.61,s.z,1.22);if(support){s.y=support.y;s.place=support.place;if(support.home!==null)s.home=support.home;}else{s.grounded=false;s.vy=0;}}
  if(!s.grounded){const before=s.y;s.vy-=gravity*dt;const next=s.y+s.vy*dt;
   if(s.vy<=0){const support=floor(s.x,before+.08,s.z,before-next+.1);if(support&&support.y>=next-.02){s.y=support.y;s.place=support.place;s.grounded=true;s.vy=0;s.vx=s.vz=0;if(s.flight)s.landings++;s.flight=false;s.phase='ground';if(support.home!==null)s.home=support.home;}else s.y=next;}
   else{const ceiling=cast(s.x,before+2.1,s.z,0,1,0,next-before+.1)[0];if(ceiling){s.vy=0;s.y=Math.min(next,ceiling.point.y-2.2);}else s.y=next;}
  }
  if(!s.grounded)s.phase=s.vy>3?'rising':s.vy< -3?'falling':'apex';
  if(s.y< -85||Math.abs(s.x)>650||Math.abs(s.z)>650){s.falls++;recover();return 'recovered';}return null;
 }
 return {state:s,gravity,handling,step,launch,recover,nearPad,floor};
}
