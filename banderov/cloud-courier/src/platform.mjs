const KEY='cloud-courier:v1';
const bounded=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('SDK timeout')),ms);Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
export class Platform{
 constructor(){this.sdk=null;this.active=false;this.mode='standalone';this.status='Local save';this.muted=true;this.onSettings=()=>{};}
 async init(){const portal=/(^|\.)crazygames\.com$/.test(location.hostname)||new URLSearchParams(location.search).get('platform')==='crazygames';try{if(portal&&!window.CrazyGames){await bounded(new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://sdk.crazygames.com/crazygames-sdk-v3.js';s.onload=resolve;s.onerror=reject;document.head.append(s);}),6000);}if(window.CrazyGames){const sdk=window.CrazyGames.SDK;await bounded(sdk.init(),6000);if(sdk.environment==='crazygames'||sdk.environment==='local'){this.sdk=sdk;this.mode='crazygames';this.status='CrazyGames Data';this.muted=!!sdk.game.settings?.muteAudio;sdk.game.addSettingsChangeListener?.(s=>{this.muted=!!s.muteAudio;this.onSettings(s);});this.call('loadingStart');this.call('loadingStop');}else if(portal)throw new Error('SDK disabled');}}catch{if(portal){this.mode='portal-unavailable';this.status='SDK unavailable · session progress only';}}return this;}
 call(name){try{this.sdk?.game?.[name]?.();}catch{}}
 playing(value){if(this.active===value)return;this.active=value;this.call(value?'gameplayStart':'gameplayStop');}
 load(){try{return this.mode==='crazygames'?this.sdk.data.getItem(KEY):this.mode==='standalone'?localStorage.getItem(KEY):null;}catch{this.status='Save unavailable · session progress only';return null;}}
 save(value){try{if(this.mode==='crazygames')this.sdk.data.setItem(KEY,value);else if(this.mode==='standalone')localStorage.setItem(KEY,value);else return false;this.status=this.mode==='crazygames'?'CrazyGames Data':'Local save';return true;}catch{this.status='Save unavailable · session progress only';return false;}}
 celebrate(){this.call('happytime');}
 // Hook for a later explicitly enabled Full Launch. No UI or ad request in this Basic slice.
 adCallbacks(pause){return{adStarted:()=>pause('ad'),adFinished:()=>pause('ad-finished'),adError:()=>pause('ad-error')};}
}
