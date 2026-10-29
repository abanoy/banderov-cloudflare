import {decideAds} from './policy.js';
export function createAdController({getAccount,getConsent,provider,slots,onState=()=>{},now=Date.now}){
  let epoch=0,loaded=false,requested=false,disposed=false;
  const clear=()=>slots.forEach(slot=>{slot.replaceChildren();slot.closest('.ad-zone').hidden=true;});
  const publish=(kind,message)=>onState({kind,message,sdkAlreadyLoaded:loaded,reloadRequired:requested&&kind!=='shown'});
  return{
    async start(){
      const run=++epoch;disposed=false;clear();publish('checking','Checking account entitlement…');
      try{
        const first=decideAds(await getAccount(),now());if(run!==epoch||disposed)return;
        if(first.kind!=='unpaid'){publish(first.kind,first.reason);return;}
        publish('consent','Checking advertising consent…');const consent=await getConsent();if(run!==epoch||disposed)return;
        if(consent?.adsAllowed!==true||consent?.source!=='cmp_adapter'){publish('consent_denied','Ads are off. Gameplay remains available.');return;}
        // Recheck after a potentially long consent dialog, before any ad SDK request.
        const second=decideAds(await getAccount(),now());if(run!==epoch||disposed)return;
        if(second.kind!=='unpaid'){publish(second.kind,second.reason);return;}
        if(requested){publish('reload','Reload to re-evaluate ads in a clean page.');return;}
        publish('loading','Preparing the advertising slot…');
        requested=true;
        await provider.load({isCurrent:()=>run===epoch&&!disposed});
        if(run!==epoch||disposed)return;loaded=true;
        for(const slot of slots){slot.closest('.ad-zone').hidden=false;await provider.mount(slot);if(run!==epoch||disposed){clear();return;}}
        publish('shown','Ad-supported play · game controls remain separate');
      }catch{if(run===epoch&&!disposed){clear();publish('error','Ads unavailable. Gameplay remains available.');}}
    },
    stop(){epoch++;disposed=true;clear();publish('stopped',requested?'Ads stopped here. Reload for a clean ad-free page.':'Ads are off.');}
  };
}
