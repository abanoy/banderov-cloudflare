import{dailySeed}from'./logic.mjs';
// Detachable challenge transport. No endpoint is configured in the release.
export class ChallengeService{
 constructor(base=null,fetcher=globalThis.fetch){this.base=base;this.fetcher=fetcher;}
 async daily(date=new Date()){const fallback={seed:dailySeed(date),contract:'tea',district:0,source:'offline'};if(!this.base)return fallback;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);try{const base=new URL(this.base);if(base.protocol!=='https:')return fallback;const r=await this.fetcher(new URL(`/api/cloud-courier/v1/challenges/${date.toISOString().slice(0,10)}`,base),{signal:controller.signal,credentials:'omit'});if(!r.ok)return fallback;const text=await r.text();if(text.length>1024)return fallback;const o=JSON.parse(text);if(o.generator!==1||o.date!==date.toISOString().slice(0,10)||!/^[a-z0-9:_-]{1,40}$/i.test(o.seed)||o.contract!=='tea'||o.district!==0)return fallback;return{seed:o.seed,contract:'tea',district:0,source:'shared'};}catch{return fallback;}finally{clearTimeout(timer);}}
}
