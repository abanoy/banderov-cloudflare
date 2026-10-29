import assert from 'node:assert/strict';
import {makeLayout} from '../src/layout.js';
import {newState,recover,launch,step,nearPad,reset} from '../src/physics.js';
const world=makeLayout(),rows=[];
for(const a of world.pads)for(const b of world.pads.filter(b=>b!==a)){
 const s=newState(world);s.checkpoint=a.id;recover(s,world);assert(launch(s,world,b.id));let peak=s.y,rising=false,descending=false;
 for(let i=0;i<1600&&s.travel;i++){const y=s.y;step(s,world,{},1/120);rising||=s.y>y;descending||=s.y<y;peak=Math.max(peak,s.y);}
 assert(rising&&descending&&peak>90);assert(!s.travel&&s.grounded&&nearPad(s,world)?.id===b.id,JSON.stringify(s));rows.push({from:a.id,to:b.id,peak,landed:s.destination});
}
const s=newState(world);launch(s,world,'island');for(let i=0;i<100;i++)step(s,world,{},1/120);let old=s.x;step(s,world,{x:1},1/120);assert(s.x>old);const frozen=JSON.stringify(s);s.paused=true;const held=JSON.stringify(s);for(let i=0;i<100;i++)step(s,world,{x:-1,climb:1},1/120);assert.equal(JSON.stringify(s),held);s.paused=false;for(let i=0;i<450;i++)step(s,world,{},1/120);assert(s.travel?.vy<0);old=s.x;step(s,world,{x:-1,climb:-1},1/120);assert(s.x<old);for(let i=0;i<2000&&s.travel;i++)step(s,world,{z:1},1/120);assert(!s.travel&&s.grounded&&s.homeCastle==='bright'&&s.falls===1);reset(s,world);assert.equal(s.travel,null);console.log(JSON.stringify({routes:rows,steeringBothDirections:true,pause:true,voidRecovery:true,reset:true},null,2));
