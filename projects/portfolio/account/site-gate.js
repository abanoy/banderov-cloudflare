(()=>{
 if(location.hostname!=='banderov.com'||location.pathname.startsWith('/account'))return;
 let checking=false,knownPending=false,knownAuthenticated=false,overlay=null,saved=null,revision=0,queued=false;
 function block(text){
  if(!overlay){
   saved={inert:document.body.inert,focus:document.activeElement,x:scrollX,y:scrollY};
   document.documentElement.classList.add('account-gate-locked');document.body.inert=true;
   overlay=document.createElement('section');overlay.setAttribute('role','region');overlay.setAttribute('aria-label','Account verification required');overlay.tabIndex=-1;overlay.className='account-site-gate';
   const h=document.createElement('h1');h.textContent='One more step…';const p=document.createElement('p');p.id='gate-state';
   const a=document.createElement('a');a.href='/account/';a.textContent='Open verification / sign out';overlay.append(h,p,a);
   overlay.addEventListener('keydown',event=>event.stopPropagation());document.documentElement.append(overlay);overlay.focus();
  }
  overlay.querySelector('#gate-state').textContent=text;
 }
 function restore(){
  if(!overlay)return;overlay.remove();overlay=null;document.documentElement.classList.remove('account-gate-locked');document.body.inert=saved.inert;
  window.scrollTo(saved.x,saved.y);if(saved.focus?.isConnected)saved.focus.focus({preventScroll:true});saved=null;
 }
 async function check(hint=false,sessionChanged=false){
  if(hint){knownPending=true;block('Checking your account. Public content stays hidden while this check completes.')}
  else if(sessionChanged&&knownAuthenticated)block('Checking your account. Public content stays hidden while this check completes.');
  const generation=++revision;
  if(checking){queued=true;return}checking=true;const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),7000);
  try{
   const r=await fetch('/api/account/current',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:abort.signal});
   const text=await r.text();if(generation!==revision)return;if(text.length>8192)throw Error();const data=JSON.parse(text);
   if(r.status===503&&data.sessionPresent===true){knownAuthenticated=true;knownPending=true;block('Account status is unavailable. You can open onboarding to sign out.');location.replace('/account/');return}
   if(!r.ok)throw Error();const policy=await import('./capabilities.js');if(generation!==revision)return;
   if(!policy.isFreshAccountStatus(data))throw Error();policy.readAccountCapabilities(data);
   knownAuthenticated=data.authenticated;
   if(data.authenticated&&!policy.hasFreshOwnerException(data)&&!(data.account.status==='active'&&data.account.identityVerified===true&&data.account.ageEligibility==='eligible_18plus')){
    knownPending=true;block('Verification is required before using your signed-in account.');location.replace('/account/');return;
   }
   knownPending=false;restore();
  }catch{
   if(generation!==revision)return;
   if(knownAuthenticated||knownPending||hint)block('Unable to confirm your account. Open onboarding to retry or sign out.');else restore();
  }finally{clearTimeout(timer);checking=false;if(queued){queued=false;check()}}
 }
 try{const c=new BroadcastChannel('banderov-session');c.addEventListener('message',e=>{if(e.data==='signed-in')check(true,true);else if(e.data==='signed-out')check(false,true)})}catch{}
 window.addEventListener('storage',e=>{if(e.key==='banderov-session-event'){const value=String(e.newValue);if(value.startsWith('signed-in:')||value.startsWith('signed-out:'))check(value.startsWith('signed-in:'),true)}});
 window.addEventListener('focus',()=>check());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});check();
})();
