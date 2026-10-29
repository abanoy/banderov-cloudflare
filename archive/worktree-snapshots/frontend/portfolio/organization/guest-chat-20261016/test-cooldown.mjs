import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCooldown} from './public/cooldown.js';
import {createMessageSubmission} from './public/composer.js';
let time=0,nextId=0,changes=0;const tasks=new Map(),all=[];
const wait=createCooldown({now:()=>time,schedule:(fn,ms)=>{const id=++nextId;tasks.set(id,{fn,at:time+ms});all.push(fn);return id},cancel:id=>tasks.delete(id),onChange:()=>changes++});
function advance(ms){const end=time+ms;for(;;){const entry=[...tasks.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;time=entry[1].at;tasks.delete(entry[0]);entry[1].fn()}time=end}
assert(wait.start(3));assert.equal(wait.remainingSeconds(),3);for(const invalid of [0,-1,1.2,'3',NaN,Number.MAX_SAFE_INTEGER])assert(!wait.start(invalid));assert.equal(tasks.size,1);
advance(1000);assert.equal(wait.remainingSeconds(),2);const old=all[0];assert(wait.start(5));old();assert.equal(wait.remainingSeconds(),5);advance(4999);assert(wait.active());advance(1);assert(!wait.active());assert.equal(tasks.size,0);
wait.start(2);const stale=all.at(-1);wait.reset();wait.start(10);stale();assert.equal(wait.remainingSeconds(),10);advance(10000);assert(!wait.active());wait.start(120);const before=changes;advance(60000);assert(wait.active());assert.equal(changes,before);advance(60000);assert(!wait.active());assert.equal(tasks.size,0);
let draft='Keep draft',clears=0;const submission=createMessageSubmission({readDraft:()=>draft,readRevision:()=>0,clearDraft:()=>clears++,send:async()=>{throw {code:'rate_limited',retryAfterSeconds:10,raw:'never expose'}},onBusy:()=>{},onResult:()=>{}});
assert.deepEqual(await submission.submit(),{kind:'failed',uncertain:false,code:'rate_limited',retryAfterSeconds:10});assert.equal(clears,0);assert.equal(draft,'Keep draft');
fs.writeFileSync('portfolio/organization/guest-chat-20261016/cooldown-check.json',JSON.stringify({passed:true,cases:['strict finite duration','one timer','extend without stale callback','expiry without automatic action','reset invalidates old timer','long waits chunk without announcement loop','composer retains only safe rate metadata and draft'],networkRequests:0,scope:'Pure monotonic virtual-clock timer/controller tests.'},null,2));console.log('Cooldown/controller checks passed; no network or automatic action.');
