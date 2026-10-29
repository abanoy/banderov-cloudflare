import {createAdController} from './controller.js';
const $=id=>document.getElementById(id),slot=document.querySelector('.ad-slot');
let scenario='unpaid',controller,loads=0,mounts=0,tries=0,clicks=0,paidInPreviousPage=false;
const snapshot=()=>{
  if(scenario==='error')throw Error('Mock account service offline');const now=Date.now();
  return{version:1,viewer:scenario==='anonymous'?'anonymous':scenario==='registration'?'registration_pending':'account',ageVerification:scenario==='registration'?'pending':'yoti_verified_18plus',checkedAt:new Date(now-(scenario==='expired'?180000:0)).toISOString(),validUntil:new Date(now+(scenario==='expired'?-1000:60000)).toISOString(),entitlement:{state:scenario==='paid'?'active':scenario==='pending'?'pending':'none',scope:'all_site_games'},adsEligible:true};
};
const audit=()=>{$('audit').textContent='Mock ad-loader calls: '+loads+' · Mock slot renders: '+mounts+' · Real ad/payment requests: 0';};
function mount(){
  controller?.stop();loads=0;mounts=0;paidInPreviousPage=false;
  controller=createAdController({slots:[slot],getAccount:async()=>{tries++;return snapshot()},getConsent:async()=>({source:'cmp_adapter',adsAllowed:$('consent').value==='yes'}),provider:{async load({isCurrent}){if(isCurrent())loads++;},async mount(target){mounts++;const div=document.createElement('div');div.className='mock-ad';const p=document.createElement('p');p.textContent='Responsive display placement';const small=document.createElement('p');small.textContent='Local placeholder · no advertising network loaded';div.append(p,small);target.append(div);}},onState(state){$('account-state').textContent=state.message;if(state.reloadRequired&&scenario==='paid'){$('purchase-state').textContent='Server confirmation simulated. A previously ad-supported page needs a clean reload; already loaded scripts cannot be undone.';$('clean-reload').hidden=false;}audit();}});
  $('purchase').disabled=scenario!=='unpaid';$('confirm').hidden=scenario!=='pending';$('clean-reload').hidden=true;$('purchase-state').textContent=scenario==='paid'?'Mock server entitlement active. Applies to all games hosted on banderov.com.':scenario==='registration'?'A registered account cannot be completed until Yoti verifies 18+.':'Not for sale in this preview. Stripe is proposed, not connected.';
  controller.start();audit();
}
$('apply').addEventListener('click',()=>{scenario=$('scenario').value;mount();});
$('purchase').addEventListener('click',()=>{scenario='pending';$('scenario').value='pending';$('purchase').disabled=true;$('confirm').hidden=false;$('purchase-state').textContent='Mock checkout returned. No entitlement granted; waiting for server confirmation.';controller.start();});
$('confirm').addEventListener('click',()=>{scenario='paid';$('scenario').value='paid';$('confirm').hidden=true;$('purchase').disabled=true;controller.start();});
$('clean-reload').addEventListener('click',()=>mount());
$('play').addEventListener('click',()=>{$('play-state').textContent='Control pressed '+(++clicks)+' times. Gameplay remains available.';});
mount();
