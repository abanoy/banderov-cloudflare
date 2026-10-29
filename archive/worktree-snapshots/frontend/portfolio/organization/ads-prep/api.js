// Adapter for the agreed local Backend contract. A return URL/local flag is never evidence.
export async function getServerMonetization({fetcher=(...args)=>globalThis.fetch(...args)}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher('/api/account/current',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
    if(!response.ok)throw Error('Account unavailable');
    const text=await response.text();if(text.length>8192)throw Error('Account response oversized');
    const data=JSON.parse(text),m=data.monetization,account=data.account;
    if(data.version!==1||typeof data.authenticated!=='boolean'||typeof data.entitlements?.siteGamesAdFree!=='boolean'||!m||m.scope!=='all_site_games')throw Error('Invalid account contract');
    if(data.authenticated&&(!account||!['active','pending','suspended'].includes(account.status)))throw Error('Invalid account');
    const paid=data.entitlements.siteGamesAdFree;
    if(paid&&(!data.authenticated||account.status!=='active'||account.verified18Plus!==true||m.state!=='active'))throw Error('Invalid entitlement');
    if(!paid&&m.state==='active')throw Error('Inconsistent entitlement');
    return{version:1,checkedAt:data.checkedAt,validUntil:data.validUntil,viewer:!data.authenticated?'anonymous':account.status==='active'?'account':'registration_pending',ageVerification:account?.verified18Plus===true?'yoti_verified_18plus':'pending',entitlement:{state:m.state,scope:m.scope},adsEligible:m.adsEligible===true};
  }finally{clearTimeout(timer)}
}
