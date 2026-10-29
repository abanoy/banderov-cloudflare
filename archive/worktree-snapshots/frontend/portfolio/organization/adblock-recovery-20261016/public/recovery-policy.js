import {mapAccountSnapshot} from './api.js';
import {decideAds} from './policy.js';
// Pure display policy. No detector, network probes, cookies or production activation.
export function recoveryDecision({snapshot,signal='unknown',configured=false,consent='unknown',route='game'},now=Date.now()){
 if(['account','privacy','help'].includes(route))return {view:'essential',scripts:false};
 let state;try{state=decideAds(mapAccountSnapshot(snapshot),now)}catch{return{view:'unavailable',scripts:false}}
 if(snapshot.authenticated&&snapshot.account.status!=='active')return{view:'onboarding',scripts:false};
 if(state.kind==='paid')return{view:'paid',scripts:false};
 if(state.kind==='hold')return{view:'unavailable',scripts:false};
 if(!configured)return{view:'unconfigured',scripts:false};
 if(consent!=='granted')return{view:'consent',scripts:false};
 if(signal==='extension_blocking'||signal==='network_level_blocking')return{view:'recovery',scripts:true};
 if(signal==='clear')return{view:'content',scripts:true};
 return{view:'unknown',scripts:true};
}

// Accept only a recognized provider enum result; transport failures never map to blocking.
export function normalizeGoogleAdBlockerStatus(value,types){const keys=['UNKNOWN','EXTENSION_AD_BLOCKER','NETWORK_LEVEL_AD_BLOCKER','NO_AD_BLOCKER'];if(!types||!keys.every(k=>Number.isInteger(types[k]))||new Set(keys.map(k=>types[k])).size!==4||!Number.isInteger(value))return 'unknown';if(value===types.EXTENSION_AD_BLOCKER)return 'extension_blocking';if(value===types.NETWORK_LEVEL_AD_BLOCKER)return 'network_level_blocking';if(value===types.NO_AD_BLOCKER)return 'clear';return 'unknown'}
