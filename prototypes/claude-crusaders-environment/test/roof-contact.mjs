import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeLayout,contains,TUNE} from '../src/layout.js';
const P=await import(process.env.BEFORE?'../history/roof-contact/standalone/physics.js':'../src/physics.js');
const world=makeLayout(),rows=[];
for(const f of [{name:'keep',x:-250,y:46,z:-23*2.2},{name:'silo',x:-24*2.2,y:15,z:-330-17*2.2}]){
 const s=P.newState(world);P.launch(s,world,'island');Object.assign(s,{x:f.x,y:f.y,z:f.z});Object.assign(s.travel,{vx:0,vz:0,vy:0});
 for(let i=0;i<180;i++)P.step(s,world,{},1/120);
 const before={x:s.x,y:s.y,vy:s.travel.vy};
 for(let i=0;i<120;i++){
  P.step(s,world,{x:1},1/120);
  assert(!world.walls.some(w=>s.y<w.top-1e-5&&s.y+TUNE.height>w.bottom+1e-5&&contains(w,s.x,s.z,w.deck?0:TUNE.radius)),'No solid penetration '+f.name);
 }
 const after={x:s.x,y:s.y,travel:!!s.travel,vy:s.travel?.vy};rows.push({fixture:f.name,before,after});
}
fs.writeFileSync(new URL('../review/roof-contact-'+(process.env.BEFORE?'before':'after')+'.json',import.meta.url),JSON.stringify({rows,scope:'Valid above-keep/silo fixtures, actual120Hz physics; settle vertically then steer horizontally. No solid penetration. Not native full approach/all geometry/device proof.'},null,2));
for(const r of rows){assert(r.after.x>r.before.x+10,'Sideways steering escapes '+r.fixture);assert(Math.abs(r.before.vy)<1,'Contact does not accumulate falling speed '+r.fixture);}
console.log('Keep/silo vertical contact, sideways escape and solid rejection pass');
