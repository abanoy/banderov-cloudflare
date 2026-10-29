import assert from 'node:assert/strict';
import fs from 'node:fs';
const rows=[];
for(const sub of ['standalone','integration','integration-rounded']){
 const path=process.env.BEFORE?'../history/altitude-control/'+sub+'/':sub==='standalone'?'../src/':'../'+sub+'/src/';
 const p=await import(path+'physics.js'),{makeLayout}=await import(path+'layout.js'),world=makeLayout();
 const late=p.newState(world);assert(p.launch(late,world,'island'));
 for(let i=0;i<912;i++)p.step(late,world,{x:1},1/120);
 assert(late.travel&&late.travel.vy< -45,'Real steer-away arc reaches a late descent before recovery');
 const beforeY=late.y,beforeVelocity=late.travel.vy;
 for(let i=0;i<60;i++)p.step(late,world,{climb:1},1/120);
 const early=p.newState(world);p.launch(early,world,'island');const startY=early.y;p.step(early,world,{climb:-1},1/120);
 rows.push({scene:sub,late:{beforeY,beforeVelocity,afterY:late.y,velocity:late.travel?.vy,falls:late.falls},early:{beforeY:startY,afterY:early.y}});
 if(!process.env.BEFORE){
  assert(late.y>beforeY+20&&late.falls===0,'Fly up reverses a late descent');
  assert(early.y<startY,'Fly down reverses the launch ascent');
  const velocity=late.travel.vy,held=JSON.stringify(late);late.paused=true;const frozen=JSON.stringify(late);p.step(late,world,{climb:-1},1/30);assert.equal(JSON.stringify(late),frozen);late.paused=false;
  const y=late.y;p.step(late,world,{},1/120);assert(late.y>y&&late.travel.vy<velocity,'Release retains upward momentum while gravity resumes');
  for(let i=0;i<1200&&late.travel;i++)p.step(late,world,{},1/120);
  assert(late.falls===1&&!late.travel&&late.destination==='bright','Released arc eventually falls back to castle');
 }
}
fs.writeFileSync('review/altitude-control-'+(process.env.BEFORE?'before':'after')+'.json',JSON.stringify({rows,scope:'Production120Hz launch/steer-away late descent and immediate down, all3 modules; no position/velocity/time injection. Pause/release/gravity/recovery checks on corrected modules.'},null,2));
assert(rows.every(r=>r.late.afterY>r.late.beforeY+20&&r.early.afterY<r.early.beforeY),'Altitude controls reverse both early ascent and late descent');
console.log('Three actual-arc altitude reversal/release/pause/recovery checks pass');
