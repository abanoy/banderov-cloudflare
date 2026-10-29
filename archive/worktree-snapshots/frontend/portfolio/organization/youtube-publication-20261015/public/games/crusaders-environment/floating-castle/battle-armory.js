// Finite pocket ammunition is transferred to magazines, never created by reload.
export function weaponMagazine(actor,weapon,time){
 const key=weapon.id||'battery',store=actor.magazines||(actor.magazines={}),capacity=weapon.magazine??8;
 let m=store[key];if(!m){const ammo=Number.isFinite(actor.reserveAmmo)?Math.min(capacity,actor.reserveAmmo):capacity;if(Number.isFinite(actor.reserveAmmo))actor.reserveAmmo-=ammo;m=store[key]={ammo,until:0,pending:0};}
 if(m.until&&time>=m.until){m.ammo=m.pending??capacity;m.pending=0;m.until=0;}return m;
}
export function reloadWeapon(actor,weapon,time){const m=weaponMagazine(actor,weapon,time),capacity=weapon.magazine??8;if(m.until||m.ammo>=capacity)return false;const take=Number.isFinite(actor.reserveAmmo)?Math.min(capacity-m.ammo,actor.reserveAmmo):capacity-m.ammo;if(take<=0)return false;if(Number.isFinite(actor.reserveAmmo))actor.reserveAmmo-=take;m.pending=m.ammo+take;m.until=time+(weapon.reload??2.5);actor.charge=0;actor.reviving=null;return true;}
export function consumeAmmo(actor,weapon,time){const m=weaponMagazine(actor,weapon,time);if(m.until)return false;if(!m.ammo){reloadWeapon(actor,weapon,time);return false;}m.ammo--;return true;}
