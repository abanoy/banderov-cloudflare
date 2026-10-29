import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {assessCastle} from '../floating-castle/castle-beauty.js';

const report={scope:'Pure local composition guidance fixtures. Relative design cues are tested, not an absolute beauty judgment, physical walkability or earned rewards.',checks:[],examples:{},failures:[],sourceHash:crypto.createHash('sha256').update(fs.readFileSync(new URL('../floating-castle/castle-beauty.js',import.meta.url))).digest('hex')};
const part=(type,x,z,layer=0,rotation=0)=>({type,x,z,layer,rotation});
const translate=(layout,x,z)=>layout.map(p=>({...p,x:p.x+x,z:p.z+z}));
const scoreVector=a=>a.categories.map(c=>({id:c.id,score:c.score,max:c.max}));
function check(name,details={}){report.checks.push({name,...details});}
function courtyard(){
 const cells=new Map(),put=p=>cells.set([p.x,p.z,p.layer].join(':'),p);
 for(let z=0;z<5;z++)for(let x=0;x<5;x++)put(part('floor',x,z));
 for(let x=0;x<5;x++){put(part('wall',x,0));put(part('wall',x,4));}
 for(const x of [0,4])for(let z=1;z<4;z++)put(part('wall',x,z));
 for(const p of [part('gate',2,4),part('floor',2,5),part('core',2,1),part('tower',0,0),part('tower',4,0),part('garden',0,2),part('garden',4,2),part('garden',3,1),part('stairs',1,2)])put(p);
 for(let z=0;z<2;z++)for(let x=0;x<3;x++)put(part('floor',x,z,1));
 put(part('roof',0,0,1));put(part('stairs',1,0,1));
 for(const p of [part('wall',0,-1,2),part('floor',1,-1,2),part('floor',2,-1,2),part('roof',3,-1,2)])put(p);
 return [...cells.values()];
}
function smallWing(){
 const result=[];for(let z=2;z<6;z++)for(let x=18;x<21;x++)result.push(part(x===18?'wall':'floor',x,z));
 return [...result,part('tower',19,1),part('garden',21,3),part('garden',21,4),part('garden',21,5),part('roof',20,4,1)];
}
try{
 const empty=assessCastle([]),cannons=Array.from({length:720},(_,i)=>part(i%2?'cannon':'heavyCannon',i%28,Math.floor(i/28))),isolatedGardens=Array.from({length:720},(_,i)=>part('garden',i%28,Math.floor(i/28))),flat=Array.from({length:400},(_,i)=>part('floor',i%20,Math.floor(i/20))),spam=assessCastle(cannons),gardenFlood=assessCastle(isolatedGardens),flatResult=assessCastle(flat),scattered=assessCastle(Array.from({length:720},(_,i)=>part(['floor','wall','tower','roof'][i%4],(i%28)*3,Math.floor(i/28)*3,i%10)));
 assert.equal(empty.score,0);assert.equal(spam.score,0);assert.equal(gardenFlood.score,0);assert.equal(scattered.score,0);assert(flatResult.score<=35);assert.equal(spam.cosmeticRenownPercent,0);
 check('Empty layouts, cannons, detached plants and scattered architecture earn no reward; a repeated flat carpet stays low',{empty:empty.score,cannons:spam.score,gardens:gardenFlood.score,scatteredArchitecture:scattered.score,flatCarpet:flatResult.score});

 const design=courtyard(),good=assessCastle(design);report.examples.courtyard=good;
 assert(good.score>=75);assert.equal(good.counts.wings,1);assert.equal(good.counts.connectedStairs,2);assert.equal(good.counts.integratedGardens,3);assert(good.counts.welcomingGates>=1);assert.equal(good.categories.find(c=>c.id==='gardens').score,14);
 check('Composed courtyard, framed heart, clear gate, gardens and two stair-linked levels score substantially above repetition',{score:good.score,parts:design.length});

 const split=[...design,...smallWing()],splitResult=assessCastle(split);report.examples.asymmetricWings=splitResult;
 assert.equal(splitResult.counts.wings,2);assert.equal(splitResult.counts.detachedArchitecture,0);assert.equal(splitResult.categories.find(c=>c.id==='wings').score,25);assert(splitResult.score>=75);
 check('Two differently shaped separated wings receive full coherence credit without a symmetry requirement',{score:splitResult.score,wings:splitResult.counts.wings});

 const flooded=assessCastle([...design,...translate(isolatedGardens,60,70)]),armed=assessCastle([...design,...translate(cannons,60,70)]),copied=assessCastle([...design,...design,...design]);
 assert(flooded.score<=good.score);assert.deepEqual(scoreVector(armed),scoreVector(good));assert.deepEqual(scoreVector(copied),scoreVector(good));assert.equal(copied.counts.duplicates,design.length*2);assert.equal(copied.cosmeticRenownPercent,good.cosmeticRenownPercent);
 check('Detached garden floods, remote weapon spam and duplicate records cannot multiply rewards',{courtyard:good.score,flooded:flooded.score,armed:armed.score,duplicated:copied.score});

 const turned=design.map(p=>({...p,x:-p.z,z:p.x,rotation:(p.rotation+3)%4})),negative=translate(design,-40,-75);
 assert.deepEqual(assessCastle([...split].reverse()),splitResult);assert.deepEqual(assessCastle(negative),good);assert.deepEqual(scoreVector(assessCastle(turned)),scoreVector(good));
 const options={level:100,size:28,minX:-8,maxX:20,minZ:-16,maxZ:12,material:'fortress'};
 assert.deepEqual(assessCastle(design,options),assessCastle(design,{...options,level:10,material:'wood'}));
 check('Input order, negative translation, quarter-turn orientation, castle level and material do not bias the assessment');

 const noConnections=assessCastle(design.map(p=>p.type==='stairs'?{...p,rotation:2}:p));
 assert(noConnections.counts.connectedStairs<good.counts.connectedStairs);assert(noConnections.categories.find(c=>c.id==='heights').score<good.categories.find(c=>c.id==='heights').score);
 const blockedGate=assessCastle(design.map(p=>p.x===2&&p.z===3&&p.layer===0?{...p,type:'wall'}:p));
 assert.equal(blockedGate.categories.find(c=>c.id==='entry').score,0);
 check('Stairs require aligned landings and gate approaches lose their welcome cue when blocked',{stairsBefore:good.counts.connectedStairs,stairsAfter:noConnections.counts.connectedStairs,blockedEntry:blockedGate.categories.find(c=>c.id==='entry').score});

 const deckDesign=design.map(p=>p.type==='floor'?{...p,type:'deck'}:p),deckResult=assessCastle(deckDesign);assert.deepEqual(deckResult,good);
 const expanded=assessCastle(deckDesign.map(p=>({...p,type:p.type==='wall'?'battlement':p.type==='core'?'beacon':p.type})));assert.equal(expanded.counts.ignored,0);assert.equal(expanded.counts.connectedStairs,good.counts.connectedStairs);assert(expanded.score>=75);assert(expanded.categories.find(c=>c.id==='landmark').score>0);
 const parapetLanding=assessCastle(design.map(p=>p.x===1&&p.z===-1&&p.layer===2?{...p,type:'battlement'}:p));assert.equal(parapetLanding.counts.connectedStairs,good.counts.connectedStairs);
 const beaconSpam=assessCastle(Array.from({length:720},(_,i)=>part('beacon',i%28,Math.floor(i/28))));assert.equal(beaconSpam.score,0);
 check('Decks and battlements can be stair landings; framed beacons contribute without a beacon-spam reward',{deckScore:deckResult.score,newPartScore:expanded.score,parapetStairConnections:parapetLanding.counts.connectedStairs,beaconSpam:beaconSpam.score});

 const terraceDesign=design.map(p=>({...p,type:p.type==='floor'?'terrace':p.type,solid:true})),terraceResult=assessCastle(terraceDesign),flatTerraces=assessCastle(flat.map(p=>({...p,type:'terrace',solid:true})));
 assert.deepEqual(terraceResult,good);assert.equal(terraceResult.counts.connectedStairs,2);assert.equal(flatTerraces.score,flatResult.score);assert.deepEqual(assessCastle(translate(terraceDesign,-30,-50)),terraceResult);
 check('Solid terraces retain selected-layer space and stair-landing semantics without rewarding raw masonry volume',{composed:terraceResult.score,flatTerraces:flatTerraces.score,connectedStairs:terraceResult.counts.connectedStairs});

 const curvedDesign=design.map(p=>({...p,type:p.type==='floor'?'roundTerrace':p.type==='wall'?'curvedWall':p.type})),curvedResult=assessCastle(curvedDesign);
 assert.deepEqual(scoreVector(curvedResult),scoreVector(good));assert.equal(curvedResult.counts.ignored,0);
 const banks=assessCastle(Array.from({length:720},(_,i)=>part('embankment',i%28,Math.floor(i/28))));assert.equal(banks.score,0);
 const bankGate=assessCastle(design.map(p=>p.x===2&&p.z===3&&p.layer===0?{...p,type:'embankment'}:p));assert.equal(bankGate.categories.find(c=>c.id==='entry').score,0);
 assert.deepEqual(assessCastle(design.map(p=>({...p,footprint:'round'}))),good);
 check('Round spaces and curved boundaries use existing composition cues; raw banks and round metadata earn no extra rewards',{curved:curvedResult.score,bankFlood:banks.score,bankBlockedGate:bankGate.categories.find(c=>c.id==='entry').score});

 const frozen=Object.freeze(design.map(p=>Object.freeze({...p}))),snapshot=JSON.stringify(frozen);assessCastle(frozen,Object.freeze(options));assert.equal(JSON.stringify(frozen),snapshot);
 const malformed=[null,{},part('unknown',0,0),part('wall',0,0,-1),part('wall',0,0,10),part('wall',1.5,0),part('wall',0,Infinity),part('wall',0,0,0,4),part('wall',0,0,0,NaN)];
 const validated=assessCastle([...design,...malformed]);assert.equal(validated.counts.ignored,malformed.length);assert.deepEqual(scoreVector(validated),scoreVector(good));assert.equal(assessCastle(null).score,0);assert.equal(assessCastle(design,null).score,good.score);
 const conflicting=[part('floor',0,0),part('wall',0,0),part('garden',0,0)];assert.deepEqual(assessCastle(conflicting),assessCastle([...conflicting].reverse()));
 const bounded=assessCastle(Array.from({length:10050},(_,i)=>part('garden',i,0)));assert.equal(bounded.counts.ignored,50);assert.equal(bounded.counts.pieces,10000);
 check('Assessment is pure, duplicate resolution deterministic, malformed input ignored and reader work bounded');

 const examples=[empty,spam,gardenFlood,scattered,flatResult,good,splitResult,flooded,armed,copied,noConnections,blockedGate,validated,bounded];
 for(const a of examples){
  assert(Number.isInteger(a.score)&&a.score>=0&&a.score<=100);assert.equal(a.categories.length,5);assert.equal(a.categories.reduce((sum,c)=>sum+c.max,0),100);assert.equal(a.categories.reduce((sum,c)=>sum+c.score,0),a.score);
  assert(a.categories.every(c=>c.score>=0&&c.score<=c.max&&c.label&&c.detail));assert(a.tips.length>=1&&a.tips.length<=2);assert(a.tips.every(t=>typeof t==='string'&&t));
  assert(a.cosmeticRenownPercent>=0&&a.cosmeticRenownPercent<=15);assert(a.proposedOnly);assert(a.bonuses.every(b=>/cosmetic/i.test(b.label)));assert(a.bonuses.some(b=>/proposed only/i.test(b.label)));assert(/not an absolute beauty verdict/.test(a.scope));assert(/combat advantage/.test(a.scope));
 }
 check('Five categories total at most 100, feedback stays concise and all renown is explicitly proposed cosmetic preview',{samples:examples.length,maxRenown:Math.max(...examples.map(a=>a.cosmeticRenownPercent))});
}catch(error){report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;}
fs.mkdirSync(new URL('../review/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../review/castle-beauty.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:report.checks.length,scores:Object.fromEntries(Object.entries(report.examples).map(([k,v])=>[k,v.score])),failures:report.failures},null,2));
