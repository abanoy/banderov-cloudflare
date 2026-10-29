import assert from 'node:assert/strict';
import fs from 'node:fs';
const rows=[];
for(const path of ['../dist/','../integration/dist/','../integration-rounded/dist/']){
 const p=await import(path+'src/physics.js'),{makeLayout}=await import(path+'src/layout.js'),world=makeLayout();
 for(const a of world.pads)for(const b of world.pads.filter(b=>b!==a)){
  const s=p.newState(world);s.checkpoint=a.id;p.recover(s,world);assert(p.launch(s,world,b.id));let peak=s.y,rise=false,fall=false;
  for(let i=0;i<1600&&s.travel;i++){const y=s.y;p.step(s,world,{},1/120);rise||=s.y>y;fall||=s.y<y;peak=Math.max(peak,s.y);}
  assert(rise&&fall&&peak>90);assert(s.grounded&&!s.travel&&p.nearPad(s,world)?.id===b.id);rows.push({path,from:a.id,to:b.id,peak,landed:s.destination});
 }
 const s=p.newState(world);p.launch(s,world,'dark');for(let i=0;i<1600&&s.travel;i++)p.step(s,world,{},1/120);assert.equal(s.homeCastle,'dark');p.launch(s,world,'island');for(let i=0;i<1600&&s.travel;i++)p.step(s,world,{},1/120);assert.equal(s.homeCastle,'dark');
 for(let i=0;i<1600&&s.falls===0;i++)p.step(s,world,{z:1},1/120);assert.equal(s.falls,1);assert.equal(s.destination,'dark');assert(s.grounded&&!s.travel);
}
fs.writeFileSync('review/packaged-arcs.json',JSON.stringify({routes:rows,lastVisitedCastleRecovery:true,scope:'All18 default destination arcs from actual three dist physics/layout modules at120Hz, then Dusk/island/walk-off recovery. Deterministic module evidence, not native controls, camera or physical-phone proof.'},null,2));console.log('All18 packaged arcs and three last-visited-castle recoveries pass');
