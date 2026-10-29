// Pointer ownership keeps walking and camera drags independent on touch screens.
export function installWalkControls(onLeave){
 const panel=document.querySelector('#walk-controls'),pad=document.querySelector('#walk-pad'),thumb=pad.querySelector('i');
 const motion={x:0,z:0};let pointer=null,active=false;
 function clear(){const id=pointer;pointer=null;motion.x=motion.z=0;thumb.style.transform='';if(id!==null&&pad.hasPointerCapture(id))pad.releasePointerCapture(id);}
 function update(e){const b=pad.getBoundingClientRect(),dx=e.clientX-b.x-b.width/2,dz=e.clientY-b.y-b.height/2,len=Math.hypot(dx,dz),radius=30;
  const strength=Math.min(1,Math.max(0,(len-5)/(radius-5))),n=len||1;motion.x=dx/n*strength;motion.z=dz/n*strength;thumb.style.transform=`translate(${motion.x*radius}px,${motion.z*radius}px)`;
 }
 pad.addEventListener('pointerdown',e=>{if(!active||pointer!==null||e.button!==0)return;pointer=e.pointerId;pad.setPointerCapture(pointer);update(e);e.preventDefault();});
 pad.addEventListener('pointermove',e=>{if(e.pointerId===pointer)update(e);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,e=>{if(e.pointerId===pointer)clear();});
 const leave=document.querySelector('#leave-walk'),taps=new Map();let completed=null;
 leave.onclick=onLeave;
 leave.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!e.isPrimary)taps.set(e.pointerId,{x:e.clientX,y:e.clientY});});
 leave.addEventListener('pointermove',e=>{const start=taps.get(e.pointerId);if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)taps.delete(e.pointerId);});
 leave.addEventListener('pointerup',e=>{const start=taps.get(e.pointerId);taps.delete(e.pointerId);const hit=document.elementFromPoint(e.clientX,e.clientY);if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<=10&&hit&&leave.contains(hit)&&active){completed={id:e.pointerId,time:performance.now()};leave.click();}});
 for(const type of ['pointercancel','lostpointercapture'])leave.addEventListener(type,e=>taps.delete(e.pointerId));
 leave.addEventListener('click',e=>{if(e.isTrusted&&e.pointerType==='touch'&&e.pointerId===completed?.id&&performance.now()-completed.time<1000){e.preventDefault();e.stopImmediatePropagation();}},true);
 addEventListener('blur',()=>taps.clear());
 addEventListener('blur',clear);addEventListener('resize',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 return {motion,clear,setActive(value){active=value;clear();panel.hidden=!value;}};
}
