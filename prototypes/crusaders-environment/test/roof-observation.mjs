import {makeLayout} from '../src/layout.js';
import {newState,launch,step} from '../src/physics.js';
const w=makeLayout(),s=newState(w);launch(s,w,'island');Object.assign(s,{x:-250,y:32,z:-23*2.2});Object.assign(s.travel,{vx:0,vz:0,vy:0});for(let i=0;i<180;i++)step(s,w,{},1/120);const before={x:s.x,y:s.y,vy:s.travel.vy};for(let i=0;i<120;i++)step(s,w,{x:1},1/120);console.log(JSON.stringify({before,after:{x:s.x,y:s.y,travel:!!s.travel,vy:s.travel?.vy}}));
