import {weaponMagazine,reloadWeapon} from './battle-armory.js';
import {WEAPONS} from './battle-combat.js?v=dbc-20261018';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function prepareMedic(actor,time){const m=weaponMagazine(actor,WEAPONS[5],time);if(!m.ammo&&!m.until)reloadWeapon(actor,WEAPONS[5],time);}
export function medicWait(actor,time){const m=actor.magazines?.reviver;return Math.max(0,(actor.nextShot||0)-time,(m?.until||0)-time,m?.ammo===0&&!m.until?WEAPONS[5].reload:0);}
export function medicRescue(actor,actors,time){
 if(!(actor.medic||actor.weapon===5)||actor.hp<34||!actor.state.grounded||actor.mount)return null;
 let chosen=null,best=Infinity;
 for(const ally of actors){
  if(ally===actor||ally.alive||ally.team!==actor.team||!ally.state.grounded)continue;
  const rejected=actor.rescueRejected;if(rejected?.id===ally.id&&time<rejected.until&&distance(rejected.position,ally.state)<1.5)continue;
  const d=distance(actor.state,ally.state),remaining=ally.respawnAt-time;
  const progress=actor.reviving?.id===ally.id&&time-actor.reviving.last<.2?Math.min(1.4,time-actor.reviving.began):0;
  if(d>40||remaining+1e-8<Math.max(.1,(actor.rescueId===ally.id?1.4:1.6)-progress)+Math.max(Math.max(0,d-12)/10,medicWait(actor,time)))continue;
  const reserved=actors.some(a=>a!==actor&&a.alive&&a.team===actor.team&&a.rescueId===ally.id);
  const score=d+(reserved?40:0)+(ally.id===actor.rescueId?-8:0);
  if(score<best){best=score;chosen=ally;}
 }
 return chosen;
}
export function canChannelRevive(actor,ally,time,lineOfSight){
 const m=actor.magazines?.reviver,loaded=!m||m.until&&time>=m.until||m.ammo>0&&!m.until;
 return !!loaded&&!!ally&&!ally.alive&&distance(actor.state,ally.state)<WEAPONS[5].reviveRange&&time>=(actor.nextShot||0)&&lineOfSight({x:actor.state.x,y:actor.state.y+1.05,z:actor.state.z},{x:ally.state.x,y:ally.state.y+1.05,z:ally.state.z});
}

/** A support fighter keeps the scepter ready for viable rescue, but can defend
 * itself with its ordinary lance when no casualty can be reached in time. */
export function medicLoadout(actor,rescue,time){
 const threat=actor.observedEnemies?.some(e=>e.distance<=60);
 if(threat)actor.defendUntil=time+1.5;
 const weapon=rescue?5:threat||actor.weapon===0&&time<(actor.defendUntil||0)?0:5;
 if(actor.weapon===weapon)return false;
 actor.weapon=weapon;actor.reviving=null;actor.charge=0;actor.aimPoint=null;
 actor.targetId=null;actor.targetSince=time;actor.senseAt=time;
 return true;
}
