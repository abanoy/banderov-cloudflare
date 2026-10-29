import assert from'node:assert/strict';import{ChallengeService}from'../src/service.mjs';
const date=new Date('2026-10-07T12:00:00Z'),offline={seed:'daily-2026-10-07',contract:'tea',district:0,source:'offline'};
assert.deepEqual(await new ChallengeService().daily(date),offline);
for(const payload of ['not json',JSON.stringify({generator:9,date:'2026-10-07',seed:'wrong',contract:'tea',district:0}),'x'.repeat(1025)])assert.deepEqual(await new ChallengeService('https://example.com',async()=>({ok:true,text:async()=>payload})).daily(date),offline);
assert.deepEqual(await new ChallengeService('https://example.com',async()=>{throw Error('offline');}).daily(date),offline);
assert.deepEqual(await new ChallengeService('http://example.com',()=>{throw Error('must not call');}).daily(date),offline);
const good=await new ChallengeService('https://example.com',async(url,options)=>{assert.equal(url.pathname,'/api/cloud-courier/v1/challenges/2026-10-07');assert.equal(options.credentials,'omit');return{ok:true,text:async()=>JSON.stringify({generator:1,date:'2026-10-07',seed:'shared-test',contract:'tea',district:0})};}).daily(date);assert.equal(good.seed,'shared-test');assert.equal(good.source,'shared');
console.log('PASS: optional challenge transport, offline/no endpoint, invalid JSON/schema/size, failed fetch, HTTPS requirement, validated shared seed.');
