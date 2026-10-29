import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {createBattleNavigation} from '../floating-castle/battle-navigation.js';
import {createBattleNavigation as zeroSearch} from './fixtures/navigation-zero-heuristic.mjs';
const pads=[{x:0,y:0,z:0,r:5},{x:16,y:0,z:0,r:5},{x:60,y:-12,z:0,r:5},{x:100,y:0,z:0,r:5},{x:60,y:0,z:40,r:5}],solids=pads.map((p,i)=>{const m=new T.Mesh(new T.BoxGeometry(i===0?24:12,1,12),new T.MeshBasicMaterial());m.position.set(p.x,p.y-.5,p.z);m.updateMatrixWorld(true);return m;});
const wall=new T.Mesh(new T.BoxGeometry(2,100,24),new T.MeshBasicMaterial());wall.position.set(45,40,0);wall.updateMatrixWorld(true);solids.push(wall);
const world={pads,solids},guided=createBattleNavigation(world),oracle=zeroSearch(world),report={passed:false,results:[],scope:'Real five-platform meshes with a tall wall blocking some direct pod arcs, one connected walking pair, separate lower platform, physically validated directed pod arcs. Guided search compared with zero-heuristic Dijkstra over identical candidate nodes/physical edge checks for all ordered distinct pad pairs. Not arbitrary-map/native performance proof.'};
try{
 report.guided=await guided.rebuild();report.oracle=await oracle.rebuild();assert.equal(report.guided.nodes,report.oracle.nodes);assert.equal(report.guided.podLinks,report.oracle.podLinks);assert(report.guided.podLinks<20,'Obstacle must reject some directed arcs');
 for(let from=0;from<pads.length;from++)for(let to=0;to<pads.length;to++)if(from!==to){const goal={...pads[to],radius:1.5},a=await guided.path(pads[from],goal),b=await oracle.path(pads[from],goal);assert.equal(a.reachable,b.reachable);assert.equal(a.cost,b.cost,'Portal estimate must preserve optimal graph cost');report.results.push({from,to,reachable:a.reachable,cost:Number.isFinite(a.cost)?a.cost:null,guidedVisited:a.visited,oracleVisited:b.visited});}
 report.passed=true;
}finally{guided.dispose();oracle.dispose();fs.writeFileSync('review/portal-guidance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
