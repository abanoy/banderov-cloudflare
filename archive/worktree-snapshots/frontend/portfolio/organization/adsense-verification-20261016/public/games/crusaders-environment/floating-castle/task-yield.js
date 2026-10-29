// Yield CPU work without background-tab timer clamping. Each fallback task
// closes its ports; cancellation is checked by the caller on resumption.
export function yieldTask(){
 if(globalThis.scheduler?.yield)return globalThis.scheduler.yield();
 if(typeof MessageChannel==='function')return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve();};c.port2.postMessage(0);});
 return new Promise(resolve=>setTimeout(resolve,0));
}
