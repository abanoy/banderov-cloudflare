function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key)))throw Error('Account capabilities unavailable')}
function check(ok){if(!ok)throw Error('Account capabilities unavailable')}
export function isFreshAccountStatus(snapshot,now=Date.now()){
 if(snapshot?.version!==3||typeof snapshot.authenticated!=='boolean'||typeof snapshot.entitlements?.siteGamesAdFree!=='boolean'||!Number.isFinite(now))return false;
 const checked=Date.parse(snapshot.checkedAt),until=Date.parse(snapshot.validUntil);
 if(!Number.isFinite(checked)||!Number.isFinite(until)||checked>now+30000||now-checked>120000||until<=now||until<checked||until-checked>120000)return false;
 if(!snapshot.authenticated)return snapshot.account===null;
 const a=snapshot.account;return !!a&&['pending','active','suspended'].includes(a.status)&&typeof a.identityVerified==='boolean'&&['unknown','pending','eligible_18plus','ineligible'].includes(a.ageEligibility);
}
export function readAccountCapabilities(snapshot,now=Date.now()){
 // Optional during the V3 transition. Absence grants no role exception.
 if(!snapshot||!Object.hasOwn(snapshot,'capabilities'))return null;
 check(isFreshAccountStatus(snapshot,now));
 const value=snapshot.capabilities;exact(value,['version','chat','onboarding','siteGames']);check(value.version===1);
 exact(value.chat,['allowed','role','nickname','moderate','freshAuthRequired']);exact(value.onboarding,['required','ownerExempt']);exact(value.siteGames,['adFreeByOwnerRole']);
 const c=value.chat,o=value.onboarding,s=value.siteGames;
 check([c.allowed,c.moderate,c.freshAuthRequired,o.required,o.ownerExempt,s.adFreeByOwnerRole].every(x=>typeof x==='boolean'));
 check(['guest','moderator'].includes(c.role)&&!(c.moderate&&c.freshAuthRequired));
 if(c.role==='moderator'){
  check(snapshot.authenticated&&snapshot.account&&['pending','active'].includes(snapshot.account.status));
  check(c.nickname==='Alexander Banderov'&&c.allowed&&!o.required&&o.ownerExempt&&s.adFreeByOwnerRole);
 }else check(c.nickname===null&&!c.moderate&&!c.freshAuthRequired&&!o.ownerExempt&&!s.adFreeByOwnerRole&&c.allowed===!o.required);
 return Object.freeze({version:1,chat:Object.freeze({...c}),onboarding:Object.freeze({...o}),siteGames:Object.freeze({...s})});
}
// Presentation policy only. Caller must fetch /api/account/current without cache;
// chat welcome, HTML markers, names and local flags are never inputs to this API.
export function hasFreshOwnerException(snapshot,now=Date.now()){
 try{const value=readAccountCapabilities(snapshot,now);return value?.onboarding.ownerExempt===true&&value.siteGames.adFreeByOwnerRole===true}catch{return false}
}
