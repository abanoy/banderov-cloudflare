// Team economy and field combat. No rendering, saved layout or hidden income.
export const FACILITY_COSTS={armory:[12,10],barracks:[16,12]};
export const RECRUIT_COST=[6,4],AMMO_COST=[0,3],MAX_RECRUITS=4;
export const FIELD_WEAPONS={fists:{range:3.4,damage:25,cooldown:.65},bow:{range:32,damage:35,cooldown:.9,capacity:6}};
export function spend(stock,cost){if(!cost||cost.some((n,i)=>stock[i]<n))return false;cost.forEach((n,i)=>stock[i]-=n);return true;}
export class FieldCommand {
 constructor(network,stock){this.network=network;this.stock=stock;this.facilities=new Map();this.units=[];this.nextId=1;}
 build(team,campId,type,atHome){const camp=this.network.camps[campId],cost=FACILITY_COSTS[type];if(!atHome||!camp||camp.owner!==team||!camp.linked||!cost)return false;let buildings=this.facilities.get(campId);if(buildings?.has(type)||!spend(this.stock(team),cost))return false;if(!buildings)this.facilities.set(campId,buildings=new Set());buildings.add(type);return true;}
 has(team,campId,type){return this.network.camps[campId]?.owner===team&&this.network.camps[campId]?.linked&&this.facilities.get(campId)?.has(type);}
 equip(actor,campId){if(actor.hp<=0||!this.has(actor.team,campId,'armory')||!spend(this.stock(actor.team),AMMO_COST))return false;actor.weapon='bow';actor.ammo=FIELD_WEAPONS.bow.capacity;return true;}
 recruit(team,campId){if(!this.has(team,campId,'barracks')||this.units.filter(u=>u.team===team&&u.hp>0).length>=MAX_RECRUITS||!spend(this.stock(team),RECRUIT_COST))return null;const u={id:this.nextId++,team,hp:100,weapon:'fists',ammo:0,cooldown:0,order:'auto',target:campId};this.units.push(u);return u;}
 order(team,id,order,target){const u=this.units.find(u=>u.id===id&&u.team===team&&u.hp>0);if(!u||!['auto','capture','follow','defend','hold'].includes(order)||order==='capture'&&!this.network.camps[target])return false;Object.assign(u,{order,target,hold:null});return true;}
 target(unit,state,commander,home){if(unit.order==='follow')return commander;if(unit.order==='defend')return home;if(unit.order==='hold')return unit.hold??=({...state});if(unit.order==='capture')return this.network.camps[unit.target];const camps=this.network.camps.filter(c=>c.owner!==unit.team||!c.linked);camps.sort((a,b)=>Math.hypot(a.x-state.x,a.z-state.z)-Math.hypot(b.x-state.x,b.z-state.z));return camps[0]||this.network.camps[unit.target];}
 attack(actor,targets,clear=()=>true,forceFists=false){const weapon=forceFists?'fists':actor.weapon||'fists',rule=FIELD_WEAPONS[weapon],a=actor.physics.state;if(actor.hp<=0||actor.cooldown>0||!a.grounded||a.flight||weapon==='bow'&&actor.ammo<=0)return null;const candidates=targets.filter(t=>t!==actor&&t.hp>0&&t.team!==actor.team&&t.physics.state.grounded&&!t.physics.state.flight).map(t=>({t,d:Math.hypot(t.physics.state.x-a.x,t.physics.state.y-a.y,t.physics.state.z-a.z)})).filter(v=>v.d<=rule.range&&clear(a,v.t.physics.state)).sort((a,b)=>a.d-b.d);if(!candidates.length)return null;const target=candidates[0].t;actor.cooldown=rule.cooldown;if(weapon==='bow')actor.ammo--;target.hp=Math.max(0,target.hp-rule.damage);return {actor,target,weapon};}
 reset(){this.facilities.clear();this.units=[];this.nextId=1;}
}
