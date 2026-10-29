import assert from 'node:assert/strict';import fs from 'node:fs';
import {createLocalChatClient} from './public/transport.js';
import {decodeDeliveryEnvelope,encodeDeliveryReceipt} from './public/receipt-codec.js';
class Clock{now=0;id=0;tasks=new Map();setTimeout=(fn,ms)=>{const id=++this.id;this.tasks.set(id,{fn,at:this.now+ms,repeat:0});return id};clearTimeout=id=>this.tasks.delete(id);setInterval=(fn,ms)=>{const id=++this.id;this.tasks.set(id,{fn,at:this.now+ms,repeat:ms});return id};clearInterval=id=>this.tasks.delete(id);tick(ms){const end=this.now+ms;for(;;){const item=[...this.tasks.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;const [id,t]=item;this.now=t.at;if(t.repeat)t.at+=t.repeat;else this.tasks.delete(id);t.fn()}this.now=end}}
class Socket{static last;readyState=0;bufferedAmount=0;events=new Map();sent=[];constructor(url){this.url=url;Socket.last=this}addEventListener(k,fn){const list=this.events.get(k)||[];list.push(fn);this.events.set(k,list)}emit(type,data){for(const fn of this.events.get(type)||[])fn(data)}open(){this.readyState=1}frame(frame){this.emit('message',{data:JSON.stringify(frame)})}send(raw){assert.equal(this.readyState,1);this.sent.push(JSON.parse(raw))}close(){this.readyState=3;this.emit('close',{})}}
const author={participantId:'self-a',guestId:'12345',nickname:'Guest',role:'guest'},welcome={type:'welcome',version:1,roomEpoch:'log',self:author,capabilities:{moderate:false,freshAuthRequired:false},limits:{nicknameCodePoints:24,messageCodePoints:280,historyMessages:100,frameBytes:2048}},message=seq=>({type:'message',roomEpoch:'log',seq,messageId:'msg-'+seq,sentAt:seq,author,text:'Hello'}),history={type:'history',roomEpoch:'log',throughSeq:10,messages:[message(10)],olderBefore:null,complete:true};
const wrap=(deliveryId,frame)=>({type:'delivery',deliveryId,frame}),flush=()=>new Promise(resolve=>setImmediate(resolve));let id=0;
function setup(mode='receipt-v1-experiment'){const clock=new Clock(),errors=[];const client=createLocalChatClient({enabled:true,origin:'http://127.0.0.1:4198',deliveryMode:mode,timers:clock,Socket,fetcher:async()=>new Response(null,{status:204}),makeRequestId:()=>String(++id),onError:e=>errors.push(e.code)});return{clock,client,errors}}
async function ready(){const e=setup(),promise=e.client.connect();await flush();e.socket=Socket.last;e.socket.open();e.socket.frame(wrap('welcome-credit',welcome));assert.equal(e.client.state().phase,'handshaking');assert.deepEqual(e.socket.sent,[{type:'received',deliveryId:'welcome-credit'}]);assert.equal(e.client.state().pendingRequests,0);e.socket.frame(wrap('history-credit',history));await promise;assert.equal(e.client.state().phase,'ready');assert.deepEqual(e.socket.sent[1],{type:'received',deliveryId:'history-credit'});return e}
function stop(e){e.socket.emit('error',{});assert.equal(e.client.state().phase,'closed');assert.equal(e.clock.tasks.size,0)}
assert.equal(decodeDeliveryEnvelope(JSON.stringify(wrap('credit-1',welcome))).frame.type,'welcome');assert.equal(encodeDeliveryReceipt('credit-1'),'{"type":"received","deliveryId":"credit-1"}');
for(const frame of [welcome,wrap(null,welcome),{...wrap('id',welcome),extra:1},wrap('id',{type:'untrusted'}),{type:'delivery',deliveryId:'x'}])assert.throws(()=>decodeDeliveryEnvelope(JSON.stringify(frame)));
assert.throws(()=>decodeDeliveryEnvelope('x'.repeat(12289)));assert.throws(()=>encodeDeliveryReceipt(null));
const results=['exact outer keys/id/UTF8 budget and strict inner validation'];
{
 const e=await ready();let acknowledged=false;const sent=e.client.say('Hi').then(a=>{acknowledged=true;return a});const action=e.socket.sent.at(-1);
 e.socket.frame(wrap('message-credit',message(11)));await flush();assert.equal(acknowledged,false);assert.deepEqual(e.socket.sent.at(-1),{type:'received',deliveryId:'message-credit'});assert.equal(e.client.state().pendingRequests,1);
 e.socket.frame(wrap('ack-credit',{type:'ack',requestId:action.requestId,messageId:'msg-11'}));await sent;assert.equal(acknowledged,true);assert.deepEqual(e.socket.sent.at(-1),{type:'received',deliveryId:'ack-credit'});stop(e);
}
results.push('welcome/history receipts during handshake; credit never acts as SEND acknowledgement');
{
 const e=await ready(),waits=[];for(let i=0;i<64;i++)waits.push(assert.rejects(e.client.say('pending'),x=>x.uncertain===true));e.socket.frame(wrap('message-64',message(11)));assert.deepEqual(e.socket.sent.at(-1),{type:'received',deliveryId:'message-64'});assert.equal(e.client.state().pendingRequests,64);stop(e);await Promise.all(waits);
}
results.push('receipts bypass64request admission without taking request slots');
{
 const e=await ready(),receipts=e.socket.sent.length;e.socket.frame(wrap('welcome-credit',message(11)));assert.equal(e.client.state().phase,'closed');assert.equal(e.socket.sent.length,receipts);assert.equal(e.client.state().history.latestMessages.at(-1).seq,10);
}
results.push('recent replay is rejected before side effects or duplicate credit');
{
 const e=await ready(),count=e.socket.sent.length;e.socket.frame(wrap('bad-credit',{...message(11),author:{...author,role:'moderator'}}));assert.equal(e.client.state().phase,'closed');assert.equal(e.socket.sent.length,count);
}
results.push('invalid inner identity gets no credit');
{
 const e=await ready();e.socket.bufferedAmount=16384;e.socket.frame(wrap('full-credit',message(11)));assert.equal(e.client.state().phase,'closed');assert.equal(e.clock.tasks.size,0);
}
results.push('receipt outbound budget failure closes instead of growing queue');
{
 const e=setup('raw-v1'),connection=e.client.connect(),rejected=assert.rejects(connection,x=>x.code==='invalid_server_data');await flush();const socket=Socket.last;socket.open();socket.frame(wrap('wrong-mode',welcome));await rejected;assert.equal(socket.sent.length,0);
 const f=setup(),pending=f.client.connect(),invalid=assert.rejects(pending,x=>x.code==='invalid_server_data');await flush();Socket.last.open();Socket.last.frame(welcome);await invalid;assert.equal(Socket.last.sent.length,0);
}
results.push('no automatic raw/wrapped fallback');
fs.writeFileSync('portfolio/organization/guest-chat-20261016/receipt-check.json',JSON.stringify({passed:true,results,mode:'receipt-v1-experiment',networkRequests:0,realSockets:0,scope:'mock transport/virtual clock; backend actual Workers tests separate'},null,2));console.log(results.length+' receipt codec/transport groups passed; no real sockets.');
