import {TUNE,contains,heightAt,roofBlocked} from './layout.js';
export function newState(world){const p=world.pads[0];return {x:p.x,y:p.y,z:p.z,vY:0,facing:0,grounded:true,support:world.surfaces[0].id,destination:p.id,checkpoint:p.id,homeCastle:p.id,paused:false,travel:null,landings:0,falls:0,run:0,time:0};}
export function reset(s,world){const run=s.run+1;Object.assign(s,newState(world),{run});}
export function recover(s,world){const p=world.pads.find(p=>p.id===s.checkpoint)||world.pads[0];Object.assign(s,{x:p.x,y:p.y,z:p.z,vY:0,grounded:true,travel:null,destination:p.id,support:world.surfaces.find(f=>f.destination===p.id&&contains(f,p.x,p.z)&&Math.abs(heightAt(f,p.z)-p.y)<.01)?.id});}
export function supportAt(world,x,z,maxY){return world.surfaces.filter(f=>contains(f,x,z)&&heightAt(f,z)<=maxY+1e-6).sort((a,b)=>heightAt(b,z)-heightAt(a,z))[0];}
function blocked(world,x,z,y){return (world.roofs||[]).some(r=>roofBlocked(r,x,z,y))||world.walls.some(w=>y<w.top-1e-5&&y+TUNE.height>w.bottom+1e-5&&contains(w,x,z,w.deck?0:TUNE.radius))||world.surfaces.some(f=>f.slope&&contains(f,x,z,TUNE.radius)&&y<heightAt(f,z)-.45&&y+TUNE.height>heightAt(f,z)-.45);}
function moveAxis(s,world,axis,delta){const next=s[axis]+delta,x=axis==='x'?next:s.x,z=axis==='z'?next:s.z;
 const ground=s.grounded?supportAt(world,x,z,s.y+TUNE.step):null;
 const h=ground?heightAt(ground,z):s.y;
 // Descending ramps stay grounded; stepping off an upper deck starts a real fall.
 const y=ground&&h>=s.y-.28?h:s.y;
 if(!blocked(world,x,z,y)){s[axis]=next;if(ground&&h>=s.y-.28){s.y=h;s.support=ground.id;}}
}
export function nearPad(s,world){return s.grounded&&!s.travel?world.pads.find(p=>Math.hypot(p.x-s.x,p.z-s.z)<TUNE.padRadius&&Math.abs(p.y-s.y)<.3):null;}
export function launch(s,world,target){
 const start=nearPad(s,world),end=world.pads.find(p=>p.id===target);
 if(s.paused||s.travel||!start||!end||start.id===end.id)return false;
 const f=supportAt(world,end.x,end.z,end.y+.01);
 if(!f||Math.abs(heightAt(f,end.z)-end.y)>.01||blocked(world,end.x,end.z,end.y))return false;
 const duration=TUNE.flightSeconds;
 s.travel={start:{...start},end:{...end},elapsed:0,duration,run:s.run,mode:'free',vx:(end.x-start.x)/duration,vz:(end.z-start.z)/duration,vy:4*TUNE.flightLift/duration+(end.y-start.y-4)/duration};s.facing=Math.atan2(s.travel.vx,s.travel.vz);s.grounded=false;s.vY=0;s.x=start.x;s.z=start.z;s.y=start.y+4;return true;
}
export function castleRecovery(s,world){s.checkpoint=s.homeCastle||'bright';recover(s,world);}
export function pilot(s){if(!s.travel)return false;const t=s.travel;if(t.mode!=='free'){const u=Math.min(1,t.elapsed/t.duration);t.vx=(t.end.x-t.start.x)/t.duration;t.vz=(t.end.z-t.start.z)/t.duration;t.vy=(t.end.y-t.start.y)/t.duration+4*TUNE.flightLift/t.duration*(1-2*u);}t.mode='free';return true;}
export function guide(s,world,target=s.travel?.end.id){if(!s.travel)return false;const end=world.pads.find(p=>p.id===target);if(!end)return false;s.travel={start:{x:s.x,y:s.y,z:s.z},end:{...end},elapsed:0,duration:Math.max(2,Math.hypot(end.x-s.x,end.z-s.z)/70),run:s.run,mode:'guided'};return true;}
export function flightPosition(t){const u=Math.min(1,t.elapsed/t.duration),a=t.start,b=t.end;return {x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,y:a.y+(b.y-a.y)*u+4*TUNE.flightLift*u*(1-u)};}
export function step(s,world,input,dt){
 if(s.paused)return;dt=Math.min(Math.max(dt,0),1/30);s.time+=dt;
 if(s.travel){const t=s.travel;if(t.run!==s.run){castleRecovery(s,world);return;}
  const movement=Math.hypot(input.x||0,input.z||0),climb=input.climb||0;
  if(movement>.02||climb!==0)pilot(s);
  if(t.mode==='free'){
   let {x=0,z=0}=input;const n=Math.max(1,Math.hypot(x,z));x/=n;z/=n;
   // Steering changes the launch momentum; releasing continues the current arc.
   if(movement>.02){t.vx=x*TUNE.flightSpeed;t.vz=z*TUNE.flightSpeed;}
   const gravity=8*TUNE.flightLift/(TUNE.flightSeconds*TUNE.flightSeconds);
   t.elapsed+=dt;if(climb!==0)t.vy=Math.max(-1,Math.min(1,climb))*TUNE.climbSpeed;const vertical=t.vy||0;
   let nx=s.x+(t.vx||0)*dt,nz=s.z+(t.vz||0)*dt,ny=Math.min(180,s.y+vertical*dt-.5*gravity*dt*dt);t.vy=(t.vy||0)-gravity*dt;
   if(blocked(world,nx,s.z,s.y))nx=s.x;
   if(blocked(world,nx,nz,s.y))nz=s.z;
   const floor=supportAt(world,nx,nz,Math.max(s.y,ny)+.01);
   if(ny<s.y&&floor&&s.y>=heightAt(floor,nz)&&ny<=heightAt(floor,nz)&&!blocked(world,nx,nz,heightAt(floor,nz))){
    s.x=nx;s.z=nz;s.y=heightAt(floor,nz);s.grounded=true;s.vY=0;s.support=floor.id;s.destination=floor.destination;s.travel=null;s.landings++;
    if(floor.destination!=='island')s.homeCastle=floor.destination;
    s.checkpoint=floor.destination;return;
   }
   // A blocked vertical step must not cancel valid sideways steering.
   if(!blocked(world,nx,nz,s.y)){s.x=nx;s.z=nz;}
   if(!blocked(world,s.x,s.z,ny))s.y=ny;
   else t.vy=0;
   if(movement>.02)s.facing=Math.atan2(x,z);
   if(s.y<-70||Math.abs(s.x)>1500||Math.abs(s.z)>1500){s.falls++;castleRecovery(s,world);}return;
  }
  t.elapsed+=dt;Object.assign(s,flightPosition(t));s.facing=Math.atan2(t.end.x-t.start.x,t.end.z-t.start.z);
  if(t.elapsed>=t.duration){s.checkpoint=t.end.id;if(t.end.id!=='island')s.homeCastle=t.end.id;s.landings++;recover(s,world);}return;
 }
 let {x=0,z=0}=input;const n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}
 if(n>.01&&s.grounded){s.facing=Math.atan2(x,z);moveAxis(s,world,'x',x*TUNE.speed*dt);moveAxis(s,world,'z',z*TUNE.speed*dt);}
 const under=supportAt(world,s.x,s.z,s.y+.02);
 if(s.grounded&&under&&Math.abs(heightAt(under,s.z)-s.y)<.04){s.support=under.id;return;}
 s.grounded=false;const oldY=s.y;s.vY-=TUNE.gravity*dt;s.y+=s.vY*dt;
 const floor=supportAt(world,s.x,s.z,oldY+.01);
 if(floor&&s.y<=heightAt(floor,s.z)){s.y=heightAt(floor,s.z);s.grounded=true;s.vY=0;s.support=floor.id;}
 if(s.y<-70){s.falls++;castleRecovery(s,world);}
}
export function cameraInput(right,forward,yaw){const n=Math.max(1,Math.hypot(right,forward));return {x:(Math.cos(yaw)*right-Math.sin(yaw)*forward)/n,z:(-Math.sin(yaw)*right-Math.cos(yaw)*forward)/n};}

export function landingAt(world,x,z,y){const floor=supportAt(world,x,z,y+.01);if(!floor)return null;const top=heightAt(floor,z);return {floor,y:top,valid:!blocked(world,x,z,top)};}
