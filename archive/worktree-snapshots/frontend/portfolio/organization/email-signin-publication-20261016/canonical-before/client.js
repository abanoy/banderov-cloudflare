export function createEmailAccountClient({fetcher=(...args)=>globalThis.fetch(...args)}={}){
 async function request(path,{body,csrf}={}){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
  try{const headers={Accept:'application/json'};if(body!==undefined){headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;}
   const response=await fetcher('/api/account/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers,body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal});
   if(!response.ok){const error=Error('Account service unavailable');error.status=[400,401,403,409,429,503].includes(response.status)?response.status:503;throw error;}
   const text=await response.text();if(text.length>8192)throw Error('Account response invalid');let data;try{data=JSON.parse(text)}catch{throw Error('Account response invalid')}return data;
  }finally{clearTimeout(timer)}
 }
 async function current(){const data=await request('current');if(data?.version!==3||typeof data.authenticated!=='boolean'||typeof data.entitlements?.siteGamesAdFree!=='boolean')throw Error('Account status unavailable');const checked=Date.parse(data.checkedAt),until=Date.parse(data.validUntil),now=Date.now();if(!Number.isFinite(checked)||!Number.isFinite(until)||checked>now+30000||now-checked>120000||until<=now)throw Error('Account status expired');if(data.authenticated&&(!data.account||!['pending','active','suspended'].includes(data.account.status)||typeof data.account.identityVerified!=='boolean'||!['unknown','pending','eligible_18plus','ineligible'].includes(data.account.ageEligibility)||typeof data.csrfToken!=='string'||!data.csrfToken))throw Error('Account status invalid');return data;}
 return{current,start:async email=>{const data=await request('auth/start',{body:{email}});if(data.status!=='check_email')throw Error('Sign-in unavailable');return data;},complete:async token=>{if(!/^[a-f0-9]{64}$/.test(token))throw Object.assign(Error('Invalid link'),{status:401});return request('auth/complete',{body:{token}});},logout:async()=>{const data=await current();if(!data.authenticated) return;await request('logout',{body:{},csrf:data.csrfToken});}};
}
