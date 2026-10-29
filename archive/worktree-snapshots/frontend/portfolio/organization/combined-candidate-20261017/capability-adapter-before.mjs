// Local integration adapter. Existing account v3 facts/routes remain authoritative.
import {createAccountRuntime as baseRuntime} from '../account/account-runtime.js';
import {AccountStore} from '../account/account-store.js';
import {OwnerRole} from './owner-role.mjs';
import {AccountChatPolicy} from './account-policy.mjs';
export function createAccountRuntime(options={}){
 const base=baseRuntime(options);
 return async(request,env)=>{
  const response=await base(request,env);
  if(new URL(request.url).pathname!=='/api/account/current'||request.method!=='GET'||!response?.ok)return response;
  const data=await response.json();if(data.version!==3)return Response.json(data,{status:response.status,headers:response.headers});
  let capabilities,status=response.status;
  try{
   const ownerRole=env.ACCOUNT_OWNER_EMAIL?new OwnerRole(env.ACCOUNT_DB,{verifiedOwnerEmail:env.ACCOUNT_OWNER_EMAIL}):{resolve:async()=>null};
   capabilities=await new AccountChatPolicy({store:new AccountStore(env.ACCOUNT_DB),ownerRole,clock:options.clock||Date.now}).capabilities(request);
   // Capability exceptions require the account API's same authenticated session.
   if(capabilities.onboarding.ownerExempt&&!data.authenticated)throw Error('Inconsistent principal');
  }catch{
   status=503;capabilities={version:1,chat:{allowed:false,role:'guest',nickname:null,moderate:false,freshAuthRequired:false},
    onboarding:{required:true,ownerExempt:false},siteGames:{adFreeByOwnerRole:false}};
  }
  const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('Vary','Cookie, Origin');
  return new Response(JSON.stringify({...data,capabilities}),{status,headers});
 };
}
