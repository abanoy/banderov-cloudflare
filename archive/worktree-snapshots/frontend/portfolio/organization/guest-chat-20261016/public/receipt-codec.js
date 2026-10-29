import {decodeServerFrame} from './protocol.js';
const opaque=/^[A-Za-z0-9_-]{1,64}$/;
// Explicit experiment only: never auto-detect or silently relax raw V1 validation.
export function decodeDeliveryEnvelope(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>12288)throw Error('Invalid delivery envelope');
 let value;try{value=JSON.parse(raw)}catch{throw Error('Invalid delivery envelope')}
 if(!value||typeof value!=='object'||Array.isArray(value)||
   Object.keys(value).sort().join(',')!=='deliveryId,frame,type'||value.type!=='delivery'||
   typeof value.deliveryId!=='string'||!opaque.test(value.deliveryId))throw Error('Invalid delivery envelope');
 return Object.freeze({deliveryId:value.deliveryId,frame:decodeServerFrame(JSON.stringify(value.frame))});
}
export function encodeDeliveryReceipt(deliveryId){
 if(typeof deliveryId!=='string'||!opaque.test(deliveryId))throw Error('Invalid delivery receipt');
 return JSON.stringify({type:'received',deliveryId});
}
