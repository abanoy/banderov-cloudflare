import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createBattleCombat,WEAPONS} from '../floating-castle/battle-combat.js';
import {canChannelRevive} from '../floating-castle/battle-medic.js';
import {createAimView,intercept} from '../floating-castle/battle-aim.js';
const baseline=process.argv.includes('--baseline');
const source=fs.readFileSync(new URL(baseline?'../history/before-revive-range-20261012/battle.js':'../floating-castle/battle.js',import.meta.url),'utf8');
const start=source.indexOf(' function targetPoint(){'),end=source.indexOf(' const predictionBuffer=',start);assert(start>=0&&end>start);
const choose=new Function('T','bots','fleet','WEAPONS','world','protectorNetwork','touchFire','pointer','camera','innerWidth','innerHeight','intercept','aimView','ray','plane','aim','let aimState;'+source.slice(start,end)+';return {point:targetPoint(),get aim(){return aimState}};');
const checks=[],failures=[];
const placements=[['horizontal inside',{x:13.999,y:0,z:0},true],['horizontal boundary',{x:14,y:0,z:0},false],['horizontal outside',{x:14.001,y:0,z:0},false],['vertical inside',{x:0,y:13.999,z:0},true],['vertical boundary',{x:0,y:14,z:0},false],['vertical outside',{x:0,y:14.001,z:0},false],['diagonal inside',{x:7.99,y:7.99,z:7.99},true],['diagonal outside',{x:8.1,y:8.1,z:8.1},false]];
for(const [name,position,eligible] of placements)for(const touch of [true,false]){
 try{
 const actors=[{id:0,team:0,weapon:5,state:{x:0,y:0,z:0,grounded:true}},{id:1,team:0,weapon:0,name:'Casualty',state:{...position,grounded:true}}];
 actors.push(...[2,3].map(id=>({id,team:1,weapon:0,state:{x:1000,y:0,z:1000,grounded:true}})));
 const combat=createBattleCombat({actors,objectives:[],solids:[]});combat.start();Object.assign(actors[1],{alive:false,hp:0,respawnAt:Infinity});
 const camera=new T.OrthographicCamera(-30,30,30,-30,.1,200);camera.position.set(0,61.05,60);camera.lookAt(0,1.05,0);camera.updateMatrixWorld(true);
 const targetPoint={x:position.x,y:position.y+1.05,z:position.z},screen=new T.Vector3(targetPoint.x,targetPoint.y,targetPoint.z).project(camera),pointer=touch?null:{x:(screen.x+1)*300,y:(1-screen.y)*300};
 const selection=choose(T,{actors},{weaponView:()=>null,ships:[]},WEAPONS,{solids:[],castleHearts:[{core:{visible:false}},{core:{visible:false}}]},{items:[]},touch,pointer,camera,600,600,intercept,createAimView(camera),new T.Raycaster(),new T.Plane(new T.Vector3(0,1,0)),new T.Vector3());
 const botReady=canChannelRevive(actors[0],actors[1],0,()=>true);
 for(let i=0;i<31;i++){combat.fire(actors[0],targetPoint);combat.step(.05);}
 const entry={name,mode:touch?'touch':'pointer',distance:Math.hypot(position.x,position.y,position.z),selected:selection.aim?.label,expected:eligible?'Casualty':'No fallen ally targeted',botReady,revived:actors[1].alive,ammo:combat.ammo(actors[0]).ammo,score:actors[0].score};checks.push(entry);
 assert.equal(entry.botReady,eligible);assert.equal(entry.revived,eligible);assert.equal(entry.ammo,eligible?2:3);assert.equal(entry.score,eligible?50:0);assert.equal(entry.selected,entry.expected);
 }catch(e){failures.push(name+'/'+(touch?'touch':'pointer')+': '+e.message);}
}
const report={passed:!failures.length,baseline,scope:'Actual private targetPoint under real45degree ortho, actual combat channels and bot readiness; declared casualties/empty space. Horizontal/vertical strict14m boundary and diagonal range. No native casualty/device/network proof.',checks,failures};
fs.writeFileSync(new URL(baseline?'../history/before-revive-range-20261012/failed-before.json':'../review/revive-range.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failures.length)process.exitCode=1;
