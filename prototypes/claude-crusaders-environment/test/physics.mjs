import assert from 'node:assert/strict';
import {makeLayout,heightAt,TUNE,SCALE} from '../src/layout.js';
import {newState,step,launch as rawLaunch,reset,recover,cameraInput,nearPad,pilot,guide,castleRecovery} from '../src/physics.js';
const world=makeLayout();let checks=0;
function launch(s,w,id){const accepted=rawLaunch(s,w,id);if(accepted)guide(s,w,id);return accepted;}
function check(value,label){assert.ok(value,label);checks++;}
function walk(s,x,z,max=3000){let i=0;for(;i<max&&Math.hypot(x-s.x,z-s.z)>.07;i++){const dx=x-s.x,dz=z-s.z,n=Math.hypot(dx,dz);step(s,world,{x:dx/n,z:dz/n},1/120);}check(i<max,'route reached '+x+','+z+' at '+s.x+','+s.z+' y'+s.y);}
const s=newState(world);
for(const d of world.destinations.filter(d=>d.kind==='castle')){
 if(s.destination!==d.id){check(launch(s,world,d.id),'launch castle');for(let i=0;i<1200&&s.travel;i++)step(s,world,{},1/120);}
 for(const side of [-1,1]){
  const x=n=>d.x+n*side*SCALE.horizontal,z=n=>d.z+n*SCALE.horizontal;
  walk(s,x(16),z(24));walk(s,x(16),z(10));check(Math.abs(s.y-4*SCALE.vertical)<.04,'main court');
  walk(s,x(18),z(-2));walk(s,x(18),z(-14));check(Math.abs(s.y-10*SCALE.vertical)<.04,'upper terrace');
  walk(s,x(23),z(-15));walk(s,x(23),z(-7));walk(s,x(27),z(-7));walk(s,x(27),z(-20));walk(s,x(27),z(-25));check(Math.abs(s.y-16*SCALE.vertical)<.04,'tower crown');
  walk(s,x(27),z(-7));check(Math.abs(s.y-10*SCALE.vertical)<.04,'descend tower');walk(s,x(23),z(-7));walk(s,x(23),z(-15));walk(s,x(18),z(-15));walk(s,x(18),z(-2));check(Math.abs(s.y-4*SCALE.vertical)<.04,'descend terrace');walk(s,x(16),z(10));walk(s,x(16),z(24));check(Math.abs(s.y)<.04,'descend court');walk(s,d.x,d.z+24*SCALE.horizontal);
 }
}
check(launch(s,world,'island'),'island launch');for(let i=0;i<1200&&s.travel;i++)step(s,world,{x:0,z:0},1/120);
const island=world.destinations.find(d=>d.id==='island'),iz=n=>island.z+n*SCALE.horizontal;walk(s,0,iz(0));walk(s,0,iz(-21));check(Math.abs(s.y-(island.y+5*SCALE.vertical))<.04,'island lookout');walk(s,0,iz(0));walk(s,0,iz(24));
// Every directed route with input locked, mid-flight pause and clean landing.
for(const a of world.pads)for(const b of world.pads.filter(b=>b!==a)){
 s.checkpoint=a.id;recover(s,world);check(launch(s,world,b.id),'directed '+a.id+' '+b.id);check(!launch(s,world,b.id),'repeat launch refused');for(let i=0;i<330;i++)step(s,world,{},1/120);check(s.y>30,'visible airborne arc');const pos=[s.x,s.y,s.z];s.paused=true;for(let i=0;i<100;i++)step(s,world,{},1/120);check(JSON.stringify(pos)===JSON.stringify([s.x,s.y,s.z]),'pause freeze');s.paused=false;for(let i=0;i<1200&&s.travel;i++)step(s,world,{},1/120);check(s.checkpoint===b.id&&nearPad(s,world)?.id===b.id,'valid landing');
}
// Terrace overhead must neither lift the actor nor block open lower floor.
reset(s,world);walk(s,-250+10*SCALE.horizontal,20*SCALE.horizontal);walk(s,-250+10*SCALE.horizontal,-8*SCALE.horizontal);check(Math.abs(s.y)<.04,'under main deck');
reset(s,world);for(let i=0;i<800&&s.grounded;i++)step(s,world,{z:1},1/120);check(!s.grounded,'open edge fall');for(let i=0;i<500;i++)step(s,world,{},1/120);check(s.falls===1&&nearPad(s,world)?.id==='bright','fall recovery');
reset(s,world);check(launch(s,world,'dark'),'interrupted launch');for(let i=0;i<80;i++)step(s,world,{},1/120);reset(s,world);check(!s.travel&&s.landings===0&&s.y===0,'reset clears flight');
const a=cameraInput(1,0,0),b=cameraInput(1,1,0),c=cameraInput(0,1,Math.PI/2);check(Math.abs(Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))<1e-8,'diagonal normalized');check(c.x<-.99&&Math.abs(c.z)<1e-8,'camera-relative quarter turn');
console.log(checks+' physics / route assertions passed');

reset(s,world);launch(s,world,'island');for(let i=0;i<120;i++)step(s,world,{},1/120);const bx=s.x,by=s.y;step(s,world,{x:1,climb:1},1/30);check(s.travel.mode==='free'&&s.x>bx&&s.y>by,'horizontal/altitude overrides guide');const hover=[s.x,s.y,s.z];for(let i=0;i<120;i++)step(s,world,{},1/120);check(s.x>hover[0]&&s.y!==hover[1],'released steering keeps momentum and arc');
guide(s,world,'island');for(let i=0;i<2400&&s.travel;i++)step(s,world,{},1/120);check(s.destination==='island'&&s.homeCastle==='bright','island arrival preserves castle recovery');
for(let i=0;i<1800&&s.grounded;i++)step(s,world,{z:1},1/120);for(let i=0;i<1000&&!s.grounded;i++)step(s,world,{},1/120);check(s.destination==='bright'&&s.falls===1,'island fall returns castle');
launch(s,world,'dark');while(s.travel)step(s,world,{},1/120);launch(s,world,'island');while(s.travel)step(s,world,{},1/120);castleRecovery(s,world);check(s.destination==='dark','last visited Dusk is home');
reset(s,world);launch(s,world,'island');pilot(s);Object.assign(s,{x:-250,y:40,z:-23*SCALE.horizontal});Object.assign(s.travel,{vx:0,vz:0,vy:0});for(let i=0;i<200;i++)step(s,world,{climb:-1},1/120);check(!!s.travel&&s.y>=23*SCALE.vertical,'descent cannot land inside keep');
Object.assign(s,{x:-250+12*SCALE.horizontal,y:40,z:-15*SCALE.horizontal});Object.assign(s.travel,{vx:0,vz:0,vy:0});for(let i=0;i<200&&s.travel;i++)step(s,world,{climb:-1},1/120);check(!s.travel&&s.grounded&&Math.abs(s.y-10*SCALE.vertical)<.01,'descent lands open terrace');
launch(s,world,'island');check(!s.travel,'launch only from pad');castleRecovery(s,world);launch(s,world,'island');pilot(s);Object.assign(s,{x:0,y:181,z:0});step(s,world,{climb:1},1/120);check(s.y===180,'altitude ceiling');Object.assign(s,{x:1499,y:100,z:0});step(s,world,{x:1},1/30);check(!s.travel&&s.destination==='bright','flight escape recovery');
console.log(checks+' total physics / route / free-flight assertions passed');
reset(s,world);launch(s,world,'island');pilot(s);Object.assign(s,{x:-250,y:13.7,z:-23*2.2});Object.assign(s.travel,{vx:0,vz:0,vy:0});step(s,world,{climb:-1},1/120);check(!!s.travel&&s.y===13.7,'inside-keep descent refuses intersecting floor');
Object.assign(s,{x:-24*2.2,y:-2.8,z:-330-17*2.2});Object.assign(s.travel,{vx:0,vz:0,vy:0});step(s,world,{climb:-1},1/120);check(!!s.travel&&s.y===-2.8,'inside-silo descent refuses intersecting floor');
Object.assign(s,{x:-250+30*2.2,y:1,z:0});Object.assign(s.travel,{vx:0,vz:0,vy:0});for(let i=0;i<120;i++)step(s,world,{x:1},1/120);check(s.x<-176&&s.x>-178,'manual low flight stopped by castle wall');
castleRecovery(s,world);rawLaunch(s,world,'island');Object.assign(s,{x:-250,y:40,z:24*2.2});Object.assign(s.travel,{vx:0,vz:0,vy:0});for(let i=0;i<300&&s.travel;i++)step(s,world,{climb:-1},1/120);check(!s.travel&&nearPad(s,world)?.id==='bright','manual pod landing on arrival pad');
console.log(checks+' final physics assertions passed');

reset(s,world);check(rawLaunch(s,world,"island"),"manual native launch accepted");check(s.travel.mode==="free"&&s.y===4,"immediate steerable arc lift");const manualStart=JSON.stringify([s.x,s.y,s.z]);for(let i=0;i<100;i++)step(s,world,{},1/120);check(manualStart!==JSON.stringify([s.x,s.y,s.z])&&s.y>30,"manual launch rises on a steerable trajectory");console.log(checks+" current physics assertions passed");
