import fs from 'node:fs';import {performance} from 'node:perf_hooks';import {createChibi} from './src/model.js';
const sorted=a=>a.slice().sort((x,y)=>x-y),quantile=(a,q)=>{const s=sorted(a),i=(s.length-1)*q;return s[Math.floor(i)]+(s[Math.ceil(i)]-s[Math.floor(i)])*(i%1);};
const variants=[];
for(const options of [{},{geometryDetail:'economical'},{batchFaceInk:true,tuftVolume:'rounded'}]){
 const samples={off:[],on:[]};
 for(let i=0;i<38;i++)for(const enabled of (i%2?[true,false]:[false,true])){const start=performance.now(),m=createChibi({...options,indexGeometry:enabled}),elapsed=performance.now()-start;m.dispose();if(i>=6)samples[enabled?'on':'off'].push(elapsed);}
 variants.push({options,samples,summary:Object.fromEntries(Object.entries(samples).map(([name,a])=>[name,{medianMs:quantile(a,.5),q1Ms:quantile(a,.25),q3Ms:quantile(a,.75),minMs:Math.min(...a),maxMs:Math.max(...a)}]))});
}
const report={node:process.version,platform:process.platform,variants,scope:'Same-process Node construction wall time only; alternated off/on order, six warmup pairs and32 measured pairs per option; includes geometry/material/index construction, disposal excluded, natural GC/no forced collection. Not browser startup, GPU, FPS, phone or memory measurement.'};
const target=process.argv[2]||'review/index-construction.json';fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(JSON.stringify(variants.map(v=>({options:v.options,summary:v.summary}))));
