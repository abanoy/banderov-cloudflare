export const CLASSES=Object.freeze({ranger:{label:'Ranger',hp:100,ammo:96},fighter:{label:'Fighter',hp:1000,ammo:0},mage:{label:'Mage',hp:100,ammo:48},builder:{label:'Builder',hp:125,ammo:60}});
export function equipClass(a,id='ranger'){if(!CLASSES[id])throw Error('Unknown class');const c=CLASSES[id];Object.assign(a,{classId:id,maxHp:c.hp,hp:c.hp,reserveAmmo:c.ammo,resources:id==='builder'?60:30,mana:id==='mage'?100:0,buffUntil:0,debuffUntil:0,spellUntil:0,magazines:{},weapon:0});}
export function allowedWeapon(a,i){return a.classId!=='fighter'&&(a.classId!=='builder'||i===0||i===4)&&(a.classId!=='mage'||i===0||i===5);}
// Mage ward: mana cost, cast lock / effect length (s) and mana regained per second (battle-logistics step).
export const WARD=Object.freeze({mana:35,seconds:10,regen:2});
export function castWard(a,actors,time){if(a.classId!=='mage'||!a.alive||a.mana<WARD.mana||time<(a.spellUntil||0))return false;a.mana-=WARD.mana;a.spellUntil=time+WARD.seconds;for(const b of actors)if(b.alive&&Math.hypot(b.state.x-a.state.x,b.state.y-a.state.y,b.state.z-a.state.z)<=14){if(b.team===a.team)b.buffUntil=time+WARD.seconds;else b.debuffUntil=time+WARD.seconds;}return true;}
export function classDamage(a,time){return (time<(a?.buffUntil||0)?1.25:1)*(time<(a?.debuffUntil||0)?.75:1);}
