import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const index=JSON.parse(fs.readFileSync('portfolio/review/current-preview-index.json'));
const manifestPath=path.join(path.dirname(index.reviewDesk.server),'canonical-route-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath));
const routes=['/','/review/','/stories/alternate-1404/','/stories/alternate-1404/reader.js','/stories/alternate-1404/reader.css','/stories/alternate-1404/desk.css','/hero-sketch.css','/review/gallery-baseline/gallery.js','/review/gallery-baseline/gallery.css'];
const targets=routes.map(route=>({route,url:new URL(route,index.currentReader.url)}));
for(const {url} of targets)if(url.origin!=='http://127.0.0.1:4228')throw Error('Unexpected preview origin');
const results=await Promise.all(targets.map(async({route,url})=>{
 const pinned=manifest.files.find(f=>f.route===route);
 if(!pinned)return{route,error:'Route absent from current manifest'};
 const localExact=sha(fs.readFileSync(pinned.path))===pinned.sha256;
 try{const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(5000)});const body=Buffer.from(await response.arrayBuffer());return{route,status:response.status,localExact,servedExact:sha(body)===pinned.sha256};}
 catch(error){return{route,localExact,unreachable:error.cause?.code||error.name};}
}));
const report={checkedAt:new Date().toISOString(),manifest:manifestPath,passed:results.every(r=>r.status===200&&r.localExact&&r.servedExact),scope:'Nine current fixed loopback GETs and matching pinned file hashes, including the frozen gallery comparison script and stylesheet. Historical individual study URLs intentionally excluded. No restart, public request, API action, full behavior test or future uptime guarantee.',results};
const out='portfolio/review/current-review-check-'+Date.now()+'.json';
fs.writeFileSync(out,JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({report:out,...report}));
if(!report.passed)process.exitCode=1;
