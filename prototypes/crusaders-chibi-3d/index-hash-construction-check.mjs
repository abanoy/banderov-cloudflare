import fs from 'node:fs';import {performance} from 'node:perf_hooks';import {pathToFileURL} from 'node:url';import {createChibi} from './src/model.js';
const text=fs.readFileSync('research/model-before-hashed-indexing.js','utf8').replace('../vendor/three.module.js',pathToFileURL(`${process.cwd()}/vendor/three.module.js`).href).replace('./lighting.js',pathToFileURL(`${process.cwd()}/src/lighting.js`).href);
const {createChibi:before}=await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
const quantile=(a,q)=>{const s=a.slice().sort((x,y)=>x-y),i=(s.length-1)*q;return s[Math.floor(i)]+(s[Math.ceil(i)]-s[Math.floor(i)])*(i%1);};const variants=[];
for(const options of [{},{geometryDetail:'economical'},{batchFaceInk:true,tuftVolume:'rounded'}]){
 const samples={strings:[],hash:[]};
 for(let i=0;i<38;i++)for(const name of (i%2?['hash','strings']:['strings','hash'])){const start=performance.now(),m=(name==='hash'?createChibi:before)(options),elapsed=performance.now()-start;m.dispose();if(i>=6)samples[name].push(elapsed);}
 variants.push({options,samples,summary:Object.fromEntries(Object.entries(samples).map(([name,a])=>[name,{medianMs:quantile(a,.5),q1Ms:quantile(a,.25),q3Ms:quantile(a,.75),minMs:Math.min(...a),maxMs:Math.max(...a)}]))});
}
fs.writeFileSync('review/index-hash-construction.json',JSON.stringify({node:process.version,platform:process.platform,variants,scope:'Same-process alternated string/hash Node construction wall time,6 warmup and32 measured pairs per option. Disposal excluded/natural GC/shared machine. Not browser/GPU/FPS/phone/heap measurement.'},null,2));console.log(JSON.stringify(variants.map(v=>({options:v.options,summary:v.summary}))));
