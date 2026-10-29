import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../vendor/three.module.js';
const baseline=process.argv.includes('--baseline'),path=baseline?'../history/before-pod-rim-ceiling-20261012/flight.js':'../floating-castle/flight.js';let text=fs.readFileSync(new URL(path,import.meta.url),'utf8').replace('../vendor/three.module.js',new URL('../vendor/three.module.js',import.meta.url).href);const {flightWorld}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const checks=[],failures=[];
for(const [name,dx,dz] of [['east',1,0],['west',-1,0],['north',0,1],['south',0,-1]])for(const visible of [true,false]){
 try{
 const material=new T.MeshBasicMaterial(),floor=new T.Mesh(new T.BoxGeometry(40,1,40),material),roof=new T.Mesh(new T.BoxGeometry(dx?1:8,.3,dz?1:8),material);floor.position.y=-.5;roof.position.set(dx*.8,6.15,dz*.8);roof.visible=visible;floor.updateMatrixWorld(true);roof.updateMatrixWorld(true);
 const pads=[{x:0,y:0,z:0,r:2},{x:dx*50,y:0,z:dz*50,r:2}],sim=flightWorld([floor,roof],pads);assert(sim.launch(1));let penetration=false,stopped=false,maxHead=-Infinity;
 for(let i=0;i<12;i++){sim.step(1/120,{x:0,z:0});const p=sim.state,axis=dx?p.x*dx:p.z*dz,overlaps=axis+.48>.3&&axis-.48<1.3,head=p.y+2.1;maxHead=Math.max(maxHead,head);if(visible&&overlaps&&head>6+1e-6&&p.y<6.3)penetration=true;if(p.vy===0&&p.y<4)stopped=true;}
 const entry={name,visible,penetration,stopped,maxHead,launch:sim.launchInfo};checks.push(entry);assert.equal(penetration,false,'Capsule rim must not enter roof underside');assert.equal(stopped,visible,'Visible roof stops rise; hidden roof does not');
 if(visible){const oldX=sim.state.x,oldZ=sim.state.z;for(let i=0;i<12;i++)sim.step(1/120,{x:dx,z:dz});entry.steeringAfterContact=sim.state.manual&&Math.hypot(sim.state.x-oldX,sim.state.z-oldZ)>.1;assert(entry.steeringAfterContact);for(let i=0;i<240&&!sim.state.grounded;i++)sim.step(1/120,{x:0,z:0});entry.landed=sim.state.grounded;entry.falls=sim.state.falls;entry.landings=sim.state.landings;assert(entry.landed&&entry.falls===0&&entry.landings===1);}
material.dispose();floor.geometry.dispose();roof.geometry.dispose();
 }catch(e){failures.push(name+'/'+visible+': '+e.message);}
}
const report={passed:!failures.length,baseline,scope:'Real Three roof/base triangles, normal launch and120Hz steps; four cardinal edge-overlap roofs and hidden equivalents. No state/velocity injection. Controlled geometry, not native/all slanted corners/pod-wing volume/performance.',checks,failures};fs.writeFileSync(new URL(baseline?'../history/before-pod-rim-ceiling-20261012/failed-before.json':'../review/pod-rim-ceiling.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failures.length)process.exitCode=1;
