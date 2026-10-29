import assert from 'node:assert/strict';
import {BODIES as earlierBodies} from './review/before-shorter-legs/chibi8.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {chibi8SVG,MARIA,BODIES,PROPORTIONS,referenceY} from './chibi8.js';
const normal=s=>s.replace(/paper\d+/g,'paperID');
assert.equal(normal(chibi8SVG(MARIA,0)),normal(chibi8SVG(MARIA,8)),'Turn wrap');
assert.equal(normal(chibi8SVG(MARIA,-1)),normal(chibi8SVG(MARIA,7)),'Negative direction wrap');
let draws=0;
for(const pose of ['relaxed','raised'])for(const outfit of ['sailor','whiteBlouse'])for(const expression of ['neutral','happy','shocked'])for(let i=0;i<32;i++){
 const svg=chibi8SVG({...MARIA,outfit,expression,pose},i/4);assert(!/NaN|Infinity|undefined/.test(svg));assert(!/<image|Gradient/.test(svg));
 for(const [,d] of svg.matchAll(/\sd="([^"]*)"/g))assert(!/[CcQqSsTt]/.test(d),'Only line and arc drawing commands');draws++;
}
assert.notEqual(normal(chibi8SVG({...MARIA,walking:true,walkPhase:.25})),normal(chibi8SVG({...MARIA,walking:true,walkPhase:.75})),'Distinct walking steps');
const old=await readFile(new URL('../src/chibi8.js',import.meta.url));
assert.equal(createHash('sha256').update(old).digest('hex'),'dcc66d6731a4abf85c9d32860656f32bdbd868f9e25720edf3e2f0b6abe21745','Preserved old renderer');
let walkDraws=0;
for(const outfit of ['sailor','whiteBlouse'])for(const pose of ['relaxed','raised'])for(let direction=0;direction<8;direction++)for(let phase=0;phase<4;phase++){const svg=chibi8SVG({...MARIA,outfit,pose,walking:true,walkPhase:phase/4,construction:true},direction);assert(!/NaN|Infinity|undefined/.test(svg));assert(svg.includes('data-construction="true"'));walkDraws++;}
const front=BODIES[0],measured={waist:front.torso[5],hips:front.pelvis[1],crotch:front.pelvis[1]+16.364,knee:front.legs[0][1][1],sole:front.shoes[0][1]+front.shoes[0][3]};
for(let i=0;i<8;i++){const before=earlierBodies[i],after=BODIES[i];assert(after.torso[4]-after.torso[10]>before.torso[4]-before.torso[10],'Wider waist in every view');for(let j=0;j<2;j++)assert(after.legs[j][2][1]-after.legs[j][0][1]<before.legs[j][2][1]-before.legs[j][0][1],'Shorter legs in every view');}
assert(chibi8SVG().includes('data-head-basis="oval"'),'Shared oval head');
const report={draws,walkDraws,measured,wrapped:true,oldRendererPreserved:true,rasterBounds:[]};
if(process.env.ART_SHARP){const sharp=createRequire(import.meta.url)(process.env.ART_SHARP);
 for(const pose of ['relaxed','raised'])for(let i=0;i<32;i++){
  const {data,info}=await sharp(Buffer.from(chibi8SVG({...MARIA,pose},i/4))).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=info.width,y0=info.height,x1=0,y1=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>38){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  assert(x0>0&&y0>0&&x1<info.width-1&&y1<info.height-1,'No clipped white outline');report.rasterBounds.push({pose,direction:i/4,x0,y0,x1,y1});
 }
}
try{const downloaded=await readFile(new URL('./review/browser-download.svg',import.meta.url),'utf8');assert.equal(normal(downloaded),normal(chibi8SVG({...MARIA,outfit:'whiteBlouse',expression:'happy'},6)));report.browserDownloadExact=true;}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(new URL('./review/checks.json',import.meta.url),JSON.stringify(report,null,2));console.log({draws,walkDraws,rasterSamples:report.rasterBounds.length,browserDownloadExact:report.browserDownloadExact,oldRendererPreserved:report.oldRendererPreserved});
