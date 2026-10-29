// Client display decision only; real entitlements must come from an authenticated server.
export const OFFER=Object.freeze({code:'site_games_no_ads_v1',amountMinor:500,currency:'USD',billing:'one_time_proposal',scope:'all_site_games'});
export function decideAds(snapshot,now=Date.now()){
  if(!snapshot||snapshot.version!==2)return{kind:'hold',reason:'Account status unavailable'};
  const checked=Date.parse(snapshot.checkedAt),expires=Date.parse(snapshot.validUntil);
  if(!Number.isFinite(checked)||!Number.isFinite(expires)||checked>now+30000||now-checked>120000||expires<=now)return{kind:'hold',reason:'Account status expired'};
  if(!['anonymous','account','registration_pending'].includes(snapshot.viewer))return{kind:'hold',reason:'Account status invalid'};
  if(snapshot.viewer==='registration_pending')return{kind:'hold',reason:'Complete identity verification first'};
  if(snapshot.viewer==='account'&&snapshot.identityVerification!=='identity_verified')return{kind:'hold',reason:'Account verification required'};
  const state=snapshot.entitlement?.state;
  if(state==='active'){
    if(snapshot.viewer!=='account'||snapshot.entitlement.scope!=='all_site_games')return{kind:'hold',reason:'Entitlement status invalid'};
    return{kind:'paid',reason:'Ad removal active for all games hosted on banderov.com'};
  }
  if(state==='pending')return{kind:'hold',reason:'Waiting for server payment confirmation'};
  if(state!=='none'||snapshot.adsEligible!==true)return{kind:'hold',reason:'Ads withheld until eligibility is confirmed'};
  return{kind:'unpaid',reason:snapshot.viewer==='anonymous'?'Anonymous ad-supported play':'Verified account without ad removal'};
}
