// UI lifecycle guard only. This grants no account or moderation permission.
export function createActionScope(){
 let epoch=0;const active=new Map(),names=new Set(['nickname','delete','older','slowmode','target']);
 function isCurrent(token){return !!token&&token.epoch===epoch&&active.get(token.name)===token}
 return Object.freeze({
  reset(){epoch++;active.clear()},
  begin(name){if(!names.has(name))throw Error('Unknown UI action');const token=Object.freeze({epoch,name});active.set(name,token);return token},
  isCurrent,
  finish(token){if(!isCurrent(token))return false;active.delete(token.name);return true}
 });
}
