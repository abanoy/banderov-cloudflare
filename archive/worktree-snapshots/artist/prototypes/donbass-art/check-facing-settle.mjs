import assert from 'node:assert/strict';
import {settleHeading,directionIndex} from './movement-math.js';
const idle=heading=>({heading,active:false,candidate:null,age:0});
let cases=0;
for(const diagonal of [1,3,5,7])for(const cardinal of [(diagonal+7)%8,(diagonal+1)%8]){
 let s=settleHeading(idle(0),diagonal*Math.PI/4,true,.016);
 assert.equal(directionIndex(s.heading),diagonal,'Fresh diagonal walks face immediately');
 s=settleHeading(s,cardinal*Math.PI/4,true,.016);
 s=settleHeading(s,cardinal*Math.PI/4,true,.016);
 s=settleHeading(s,0,false,.016);
 assert.equal(directionIndex(s.heading),diagonal,'Staggered release preserves diagonal');
 s=settleHeading(s,cardinal*Math.PI/4,true,.016);
 assert.equal(directionIndex(s.heading),cardinal,'New held cardinal walk starts immediately');cases++;
}
let s=settleHeading(idle(Math.PI/4),Math.PI/4,true,.016);
s=settleHeading(s,0,true,.02);assert.equal(directionIndex(s.heading),1);
s=settleHeading(s,0,true,.02);assert.equal(directionIndex(s.heading),1);
s=settleHeading(s,0,true,.02);assert.equal(directionIndex(s.heading),0,'Sustained turn commits after40ms');
s=settleHeading(s,Math.PI*2,true,.02);assert.equal(directionIndex(s.heading),0);assert.equal(s.candidate,null,'Wrapped equivalent heading is stable');
console.log(`PASS: ${cases} diagonal/release/new-walk sequences; sustained turn and angular wrap.`);
