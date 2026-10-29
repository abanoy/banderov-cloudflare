export function mapAccountSnapshot(data){
 const m=data?.monetization,account=data?.account,paid=data?.entitlements?.siteGamesAdFree;
 if(account&&'verified18Plus' in account)throw Error('Legacy age contract is not identity evidence');
 if(data?.version!==3||typeof data.authenticated!=='boolean'||typeof paid!=='boolean'||!m||m.scope!=='all_site_games'||typeof m.adsEligible!=='boolean'||!['none','pending','active','unavailable'].includes(m.state))throw Error('Invalid account contract');
 if(!data.authenticated&&account!==null)throw Error('Invalid anonymous account');
 if(data.authenticated&&(!account||!['active','pending','suspended'].includes(account.status)||typeof account.identityVerified!=='boolean'))throw Error('Invalid account');
 if(data.authenticated&&!['unknown','pending','eligible_18plus','ineligible'].includes(account.ageEligibility))throw Error('Age eligibility unavailable');
 if(data.authenticated&&account.status==='active'&&(account.identityVerified!==true||account.ageEligibility!=='eligible_18plus'))throw Error('Account activation requirements not met');
 if(paid&&(!data.authenticated||account.status!=='active'||account.identityVerified!==true||account.ageEligibility!=='eligible_18plus'||m.state!=='active'||m.adsEligible))throw Error('Invalid entitlement');
 if(!paid&&m.state==='active')throw Error('Inconsistent entitlement');
 return{version:3,checkedAt:data.checkedAt,validUntil:data.validUntil,viewer:!data.authenticated?'anonymous':account.status==='active'?'account':'registration_pending',identityVerification:account?.identityVerified===true?'identity_verified':'pending',ageEligibility:account?.ageEligibility||'unknown',entitlement:{state:m.state,scope:m.scope},adsEligible:m.adsEligible===true};
}
export async function getServerMonetization({fetcher=(...args)=>globalThis.fetch(...args)}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetcher('/api/account/current',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});if(!response.ok)throw Error('Account unavailable');const text=await response.text();if(text.length>8192)throw Error('Account response oversized');return mapAccountSnapshot(JSON.parse(text));}finally{clearTimeout(timer)}
}
