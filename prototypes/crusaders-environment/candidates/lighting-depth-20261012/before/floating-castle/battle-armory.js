// Each weapon retains its own magazine when switching. Reloads use match time.
export function weaponMagazine(actor,weapon,time){
 const key=weapon.id||'battery',store=actor.magazines||(actor.magazines={});
 const m=store[key]||(store[key]={ammo:weapon.magazine??8,until:0});
 if(m.until&&time>=m.until){m.ammo=weapon.magazine??8;m.until=0;}
 return m;
}
export function reloadWeapon(actor,weapon,time){
 const m=weaponMagazine(actor,weapon,time);if(m.until||m.ammo>=(weapon.magazine??8))return false;
 m.until=time+(weapon.reload??2.5);actor.charge=0;actor.reviving=null;return true;
}
export function consumeAmmo(actor,weapon,time){
 const m=weaponMagazine(actor,weapon,time);if(m.until)return false;
 if(!m.ammo){reloadWeapon(actor,weapon,time);return false;}m.ammo--;return true;
}
