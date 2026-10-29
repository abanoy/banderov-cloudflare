import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMessageSubmission} from './public/composer.js';
let draft='Preserve 😀',calls=0,seen;
const c=createMessageSubmission({readDraft:()=>draft,readRevision:()=>1,clearDraft:()=>{draft=''},send:async()=>{calls++;throw {code:'muted',retryAfterSeconds:900,privateReason:'never expose'}},onBusy:()=>{},onResult:r=>{seen=r}});
await c.submit();assert.deepEqual(seen,{kind:'failed',uncertain:false,code:'muted',retryAfterSeconds:900});assert.equal(draft,'Preserve 😀');assert.equal(calls,1);await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);assert(!c.isBusy());
const source=fs.readFileSync(new URL('./public/worker-ui.js',import.meta.url),'utf8');assert(source.includes("r.code==='muted')status("));assert(!source.includes("r.code==='muted')rateFeedback"));
console.log('Muted rejection: whitelisted metadata only, draft retained, no retry; source uses separate message rather than shared nickname cooldown. No browser or server enforcement claim.');
