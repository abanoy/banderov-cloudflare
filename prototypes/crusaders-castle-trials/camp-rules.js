import {campHeight} from './terrain.js';
export const MAX_PLAYERS=8,CAPTURE_SECONDS=6,LINK_SECONDS=2;
export const HOME_RADIUS=220,DOCK_RADIUS=164,HOME_Y=40,CAMP_RADIUS=88;
export const sectorPoint=(slot,radius,y=0)=>({x:Math.cos(slot*Math.PI/4)*radius,y,z:Math.sin(slot*Math.PI/4)*radius});
export function campLocations(){return [...Array.from({length:8},(_,i)=>({...sectorPoint(i,CAMP_RADIUS),name:`Camp ${i+1}`})),...Array.from({length:4},(_,i)=>({x:Math.cos(i*Math.PI/2+Math.PI/4)*42,y:0,z:Math.sin(i*Math.PI/2+Math.PI/4)*42,name:`Inner camp ${i+1}`}))].map((c,i)=>({...c,y:campHeight(i)}));}
export function homeReady(s,slot=0){const d=sectorPoint(slot,DOCK_RADIUS,HOME_Y);return !!s&&s.grounded&&!s.flight&&Math.abs(s.y-HOME_Y)<1.2&&Math.hypot(s.x-d.x,s.z-d.z)<7;}
export function jumpTo(physics,target,seconds){const s=physics.state;if(!s.grounded||s.flight)return false;const y=s.y+2.3;Object.assign(s,{y,vx:(target.x-s.x)/seconds,vz:(target.z-s.z)/seconds,vy:(target.y-y+.5*physics.gravity*seconds*seconds)/seconds,grounded:false,flight:true,manual:false,phase:'rising'});return true;}
export class CampNetwork {
 constructor(slots=MAX_PLAYERS){if(!Number.isInteger(slots)||slots<1||slots>MAX_PLAYERS)throw Error('Battleground supports at most eight players.');this.slots=slots;this.time=0;this.events=[];this.camps=campLocations().map((p,id)=>({...p,id,owner:null,linked:false,claimant:null,progress:0,linkProgress:0,contested:false,credit:[0,0],revision:0}));}
 near(player){if(!player?.grounded||player.flight)return null;return this.camps.find(c=>Math.abs(player.y-c.y)<=.8&&Math.hypot(player.x-c.x,player.z-c.z)<=7)||null;}
 step(dt,players,onIncome=()=>{},units=[]){if(!Number.isFinite(dt)||dt<0||dt>.25)throw Error('Use bounded camp simulation steps.');if(players.length>this.slots||new Set(players.map(p=>p.id)).size!==players.length||players.some(p=>!Number.isInteger(p.id)||p.id<0||p.id>=this.slots))throw Error('Only the configured eight unique player slots may act.');if(units.length>32||new Set(units.map(u=>u.unitId)).size!==units.length||units.some(u=>!Number.isInteger(u.id)||u.id<0||u.id>=this.slots||!Number.isInteger(u.unitId)))throw Error('Invalid recruit roster.');this.time+=dt;
  for(const c of this.camps){const present=[...players,...units].filter(p=>this.near(p)?.id===c.id);c.contested=new Set(present.map(p=>p.id)).size>1;
   const actor=!c.contested?(present.find(p=>p.action==='capture'&&p.id!==c.owner)||present.find(p=>p.action==='link'&&p.id===c.owner)||present[0]):null;
   if(actor?.action==='capture'&&actor.id!==c.owner){if(c.claimant!==actor.id){c.claimant=actor.id;c.progress=0;}c.progress+=dt;if(c.progress>=CAPTURE_SECONDS){const previous=c.owner;c.owner=actor.id;c.linked=false;c.credit=[0,0];c.linkProgress=0;c.progress=0;c.claimant=null;c.revision++;this.events.push({kind:'capture',camp:c.id,owner:c.owner,previous,time:this.time});}}
   else c.progress=Math.max(0,c.progress-dt);
   if(actor?.action==='link'&&actor.id===c.owner&&!c.linked){c.linkProgress+=dt;if(c.linkProgress>=LINK_SECONDS){c.linked=true;c.linkProgress=0;c.credit=[0,0];c.revision++;this.events.push({kind:'link',camp:c.id,owner:c.owner,time:this.time});}}else c.linkProgress=0;
   if(c.linked&&!c.contested){const rates=[2,1],income=rates.map((r,i)=>{c.credit[i]+=dt*r;const amount=Math.floor(c.credit[i]+1e-9);c.credit[i]-=amount;return amount;});if(income.some(Boolean))onIncome(c.owner,income,c.id);}
  }if(this.events.length>32)this.events.splice(0,this.events.length-32);
 }
 incomeRate(slot){const count=this.camps.filter(c=>c.owner===slot&&c.linked&&!c.contested).length;return [count*2,count];}
}
