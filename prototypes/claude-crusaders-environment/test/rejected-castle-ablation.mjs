import * as T from '../vendor/three.module.js';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createConstruction} from '../floating-castle/castle-construction.js';
import {chargeOrb} from '../floating-castle/charge-orb.js';
import {battleCastlePlan} from '../floating-castle/castle-architect.js';
import {inspectCastle} from '../floating-castle/castle-navigation.js';
const source=fs.readFileSync(new URL('../floating-castle/castle-construction.js',import.meta.url),'utf8');
assert.equal(source.split('if(!incoming){const rail=').length,2);
const variant=source.replace('if(!incoming){const rail=','if(false&&!incoming){const rail=').replace(/from '([^']+)'/g,(_,p)=>"from '"+new URL(p,new URL('../floating-castle/castle-construction.js',import.meta.url)).href+"'");
const noParapets=(await import('data:text/javascript;base64,'+Buffer.from(variant).toString('base64'))).createConstruction;
function construction(factory){const mats=Object.fromEntries(['stone','edge','dark','soil','paving','roof','roofB','leaves','grass','bark','sail'].map(k=>[k,new T.MeshStandardMaterial()])),castles=[new T.Group(),new T.Group()],castleHearts=castles.map(c=>{c.add(new T.Group(),new T.Group());return chargeOrb(c,mats,{radius:8.4,crown:true});});return factory({mats,castles,castleHearts,solids:[],occluders:[]});}
const seed=915809901,plan=battleCastlePlan({level:100,home:0,seed}),report={seed,scope:'Diagnostic ablations only, never promoted. Exact recorded rejected plan reconstructed. Same tile positions, core/protector pins, ports and spawns; optional decoration replacement or automatic terrace parapets removed. Actual successful baseline walk endpoints retained as extra fixed objectives; rejected destinations retain original objective coordinates. Real construction collisions and unchanged navigation/120Hz walking. Not native visuals, production proposal repair or broad AI guarantee.',cases:[]};
let baselineTargets=[];
for(const kind of ['baseline','no-decoration','no-parapets']){
 const layout=kind==='no-decoration'?plan.layout.map(p=>['house','garden','cannon','heavyCannon','beacon'].includes(p.type)?{...p,type:'terrace'}:{...p}):plan.layout.map(p=>({...p}));
 const built=construction(kind==='no-parapets'?noParapets:createConstruction),preview=built.preview(0,layout,plan.options);
 try{const result=await inspectCastle(preview,layout,plan.options,{objectives:baselineTargets});if(kind==='baseline')baselineTargets=result.routes.map(r=>({id:'baseline-'+r.id,label:r.label,...(r.ok?r.points.at(-1):r.objective)}));
 const matches=result.routes.filter(r=>kind==='baseline'||r.id.startsWith('baseline-'));const passed=matches.filter(r=>r.ok).length;
 report.cases.push({kind,baselineDestinations:matches.length,baselineDestinationsPassed:passed,colliders:preview.colliders.length,result});console.log(JSON.stringify({kind,baselineDestinations:matches.length,passed,summary:result.summary}));
 }finally{preview.dispose();}
}
assert(report.cases[0].result.issues.length===27,'Recorded rejection reproduced');
report.completedAt=new Date().toISOString();fs.writeFileSync(new URL('../review/rejected-castle-ablation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
