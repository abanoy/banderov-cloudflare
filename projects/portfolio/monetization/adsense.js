// The controller must resolve the account entitlement BEFORE invoking this loader or a CMP.
export function createAdsenseProvider(config,{document=globalThis.document,window=globalThis.window}={}){
  let ready=null;
  function valid(){return config?.enabled===true&&config.autoAds===false&&/^ca-pub-\d{16}$/.test(config.publisherId||'')&&/^\d+$/.test(config.unitIds?.afterGame||'');}
  return{
    async load({isCurrent}){
      if(!valid())throw Error('AdSense is not configured');if(!isCurrent())return;
      if(!ready)ready=new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(config.publisherId);script.onload=resolve;script.onerror=()=>reject(Error('AdSense unavailable'));if(isCurrent())document.head.append(script);else resolve();});
      await ready;
    },
    async mount(slot){if(!valid())throw Error('AdSense disabled');const unit=document.createElement('ins');unit.className='adsbygoogle';unit.style.display='block';unit.dataset.adClient=config.publisherId;unit.dataset.adSlot=config.unitIds.afterGame;unit.dataset.adFormat='auto';unit.dataset.fullWidthResponsive='true';slot.append(unit);(window.adsbygoogle=window.adsbygoogle||[]).push({});}
  };
}
