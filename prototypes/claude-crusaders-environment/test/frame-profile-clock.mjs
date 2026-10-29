import assert from 'node:assert/strict';
import {createFrameProfile} from '../floating-castle/frame-profile.js';
let ticks=0,created=0;
globalThis.performance={now:()=>++ticks*.1};
globalThis.document={visibilityState:'visible',body:{append(output){this.output=output;}},createElement(){created++;return {style:{},setAttribute(){},textContent:''};}};
const disabled=createFrameProfile(false);disabled.begin(1000,false,'World',.05);disabled.finish(1000);assert.equal(created,0);
function sample(profile,now,dt,context='World'){profile.begin(now,false,context,dt);for(const stage of ['Simulation','Camera','Effects','Draw','UI'])profile.mark(stage);profile.finish(now);}
let p=createFrameProfile(true);sample(p,1000,1/60);sample(p,1000+1000/60,1/60);sample(p,2100,1/60);
assert.match(document.body.output.textContent,/Frame time admitted 3.0%/); // one normal plus one delayed callback
p=createFrameProfile(true);for(let i=1;i<=4;i++)sample(p,i*1000,.05);
assert.match(document.body.output.textContent,/Callback gap 1000.0ms/);assert.match(document.body.output.textContent,/Frame time admitted 5.0%/);
p.begin(10000,true,'World',.05);p.finish(10000);sample(p,20000,.05);
assert.match(document.body.output.textContent,/Frame time admitted 5.0%/); // pause gap excluded
sample(p,21000,.05,'Battle / Follow');assert.doesNotMatch(document.body.output.textContent,/Frame time admitted/); // first context sample has no interval
sample(p,22000,.05,'Battle / Follow');assert.match(document.body.output.textContent,/Frame time admitted 5.0%/);
p=createFrameProfile(true);for(let i=1;i<=121;i++)sample(p,i*1000/60,1/60);
assert.match(document.body.output.textContent,/60 samples/);assert.match(document.body.output.textContent,/60.0 median draw Hz/);assert.match(document.body.output.textContent,/Frame time admitted 100.0%/);
p=createFrameProfile(true);sample(p,1000,null);sample(p,2000,null);assert.doesNotMatch(document.body.output.textContent,/Frame time admitted/);
console.log('Frame clock: disabled path, delayed callbacks, pause/context reset, rolling normal timing, omitted admission passed');
