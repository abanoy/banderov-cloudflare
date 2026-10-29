import assert from 'node:assert/strict';import fs from 'node:fs';
import {createLocalChatClient} from './public/transport.js';
class Clock{now=0;next=0;tasks=new Map();setTimeout=(fn,ms)=>{const id=++this.next;this.tasks.set(id,{fn,at:this.now+ms,repeat:0});return id};clearTimeout=id=>this.tasks.delete(id);setInterval=(fn,ms)=>{const id=++this.next;this.tasks.set(id,{fn,at:this.now+ms,repeat:ms});return id};clearInterval=id=>this.tasks.delete(id);tick(ms){const end=this.now+ms;for(;;){const next=[...this.tasks.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const [id,t]=next;this.now=t.at;if(t.repeat)t.at+=t.repeat;else this.tasks.delete(id);t.fn()}this.now=end}}
class MockSocket{static made=[];readyState=0;bufferedAmount=0;events=new Map();sent=[];constructor(url){this.url=url;MockSocket.made.push(this)}addEventListener(k,fn){const list=this.events.get(k)||[];list.push(fn);this.events.set(k,list)}emit(k,data={}){for(const fn of this.events.get(k)||[])fn(data)}open(){this.readyState=1;this.emit('open')}frame(x){this.emit('message',{data:JSON.stringify(x)})}send(raw){if(this.readyState!==1)throw Error('closed');this.sent.push(JSON.parse(raw))}close(code,reason){this.readyState=3;this.closed={code,reason};this.emit('close',{code,reason})}}
const author={participantId:'self-a',guestId:'12345',nickname:'Guest',role:'guest'},welcome={type:'welcome',version:1,roomEpoch:'log',self:author,capabilities:{moderate:false,freshAuthRequired:false},limits:{nicknameCodePoints:24,messageCodePoints:280,historyMessages:100,frameBytes:2048}},message=(seq,text='Hi')=>({type:'message',roomEpoch:'log',seq,messageId:'msg-'+seq,sentAt:seq,author,text}),history=(requestId)=>({type:'history',roomEpoch:'log',throughSeq:10,messages:[message(requestId?1:10)],olderBefore:requestId?null:10,complete:true,...(requestId?{requestId}:{})});
let counter=0;const results=[];const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(extra={}){const clock=new Clock(),requests=[],frames=[],errors=[];const client=createLocalChatClient({enabled:true,origin:'http://127.0.0.1:4198',timers:clock,Socket:MockSocket,makeRequestId:()=>String(++counter),fetcher:async(url,init)=>{requests.push({url,init});return new Response(null,{status:204})},onFrame:(frame,state)=>frames.push({frame,state}),onError:e=>errors.push(e.code),...extra});return{client,clock,requests,frames,errors}}
async function ready(extra={}){const env=setup(extra),connection=env.client.connect();await flush();const socket=MockSocket.made.at(-1);socket.open();socket.frame(welcome);assert.equal(env.client.state().phase,'handshaking');socket.frame(history());await connection;assert.equal(env.client.state().phase,'ready');return{...env,socket}}
async function leave(env){const leaving=env.client.disconnect();if(env.client.state().phase==='closing'){const request=env.socket.sent.at(-1);env.socket.frame({type:'ack',requestId:request.requestId})}await leaving;assert.equal(env.client.state().phase,'closed');assert.equal(env.clock.tasks.size,0)}
let calls=0;const disabled=createLocalChatClient({fetcher:()=>{calls++},Socket:MockSocket});await assert.rejects(disabled.connect(),e=>e.code==='disabled');assert.equal(calls,0);
for(const origin of ['https://banderov.com','https://localhost.evil','file:///tmp','http://user:pass@localhost/','http://localhost/?secret=foo'])await assert.rejects(createLocalChatClient({enabled:true,origin}).connect(),e=>e.code==='local_origin_required');
results.push('default OFF and loopback/origin validation before I/O');
{
 const e=await ready();assert.equal(e.requests.length,1);assert.equal(e.requests[0].init.credentials,'same-origin');assert.equal(e.requests[0].init.redirect,'error');assert.equal(e.socket.url,'ws://127.0.0.1:4198/api/chat/ws');let confirmed=false;const sending=e.client.say('<b>text</b>').then(a=>{confirmed=true;return a});await flush();assert.equal(confirmed,false);const request=e.socket.sent.at(-1);e.socket.frame(message(11,'<b>text</b>'));await flush();assert.equal(confirmed,false);e.socket.frame({type:'ack',requestId:request.requestId,messageId:'msg-11'});await sending;assert.equal(confirmed,true);
 const rename=e.client.nickname('Artist');const nick=e.socket.sent.at(-1);e.socket.frame({type:'ack',requestId:nick.requestId,self:{...author,nickname:'Artist'}});await rename;assert.equal(e.client.state().self.nickname,'Artist');
 const paging=e.client.loadOlder();const old=e.socket.sent.at(-1);e.socket.frame({type:'ack',requestId:old.requestId});await flush();assert.equal(e.client.state().pendingRequests,1);e.socket.frame(history(old.requestId));await paging;assert.equal(e.client.state().history.page.messages[0].seq,1);await leave(e);
}
results.push('welcome+history readiness, broadcast is not acknowledgement, nickname identity, page+ack correlation');
{
 const e=await ready();const sending=e.client.say('uncertain');const rejection=assert.rejects(sending,x=>x.code==='acknowledgement_unconfirmed'&&x.uncertain===true);const count=e.socket.sent.length;e.clock.tick(10000);await rejection;assert.equal(e.socket.sent.length,count);await leave(e);
}
results.push('timeout remains unconfirmed and never automatically retransmits');
{
 const e=await ready();const sending=e.client.say('denied');const request=e.socket.sent.at(-1);const rejected=assert.rejects(sending,x=>x.code==='rate_limited'&&x.retryAfterSeconds===2);e.socket.frame({type:'error',requestId:request.requestId,code:'rate_limited',retryAfterSeconds:2});await rejected;assert.equal(e.client.state().phase,'ready');await leave(e);
}
results.push('generic bounded server error and no automatic retry');
{
 const e=await ready();const sending=e.client.say('no ack');const rejected=assert.rejects(sending,e=>e.uncertain===true);e.socket.emit('error');await rejected;assert.equal(e.client.state().phase,'closed');assert.equal(e.clock.tasks.size,0);const count=e.socket.sent.length;e.clock.tick(100000);assert.equal(e.socket.sent.length,count);
}
results.push('connection failure cancels timers and rejects pending sends');
{
 const e=await ready();e.socket.bufferedAmount=16380;await assert.rejects(e.client.say('overflow'),x=>x.code==='output_unavailable');assert.equal(e.socket.sent.length,0);assert.equal(e.client.state().phase,'closed');
}
results.push('combined buffered+new frame bound before send');
{
 const e=await ready();const sending=e.client.nickname('Artist');const rejected=assert.rejects(sending);e.socket.frame({type:'ack',requestId:e.socket.sent.at(-1).requestId,self:{...author,participantId:'forged-new'}});await rejected;assert.equal(e.client.state().phase,'closed');assert(e.errors.includes('invalid_server_data'));
}
results.push('nickname acknowledgement cannot change incarnation or role');
{
 const e=await ready();e.socket.emit('message',{data:new Uint8Array([1])});assert.equal(e.client.state().phase,'closed');
}
results.push('binary or malformed frame closes client safely');
{
 const e=await ready();e.clock.tick(20000);const ping=e.socket.sent.at(-1);assert.equal(ping.type,'ping');e.socket.frame({type:'ack',requestId:ping.requestId});await flush();await leave(e);
}
results.push('bounded heartbeat and timer cleanup');
{
 const e=setup({fetcher:async()=>new Response(null,{status:503})});const before=MockSocket.made.length;await assert.rejects(e.client.connect(),x=>x.code==='admission_unavailable');assert.equal(MockSocket.made.length,before);assert.equal(e.client.state().phase,'closed');
 const h=setup();const connecting=h.client.connect();const rejected=assert.rejects(connecting,x=>x.code==='handshake_unavailable');await flush();MockSocket.made.at(-1).open();h.clock.tick(10000);await rejected;assert.equal(h.clock.tasks.size,0);
}
results.push('admission refusal and handshake deadline cannot produce joined state');
{
 const e=await ready();const pending=e.client.loadOlder();const rejected=assert.rejects(pending,x=>x.code==='acknowledgement_unconfirmed');e.clock.tick(10000);await rejected;assert.equal(e.client.state().history.pending,null);const retry=e.client.loadOlder();const request=e.socket.sent.at(-1);e.socket.frame(history(request.requestId));e.socket.frame({type:'ack',requestId:request.requestId});await retry;await leave(e);
}
results.push('history timeout unlocks explicit retry without resending itself');
{
 const e=await ready();const waits=[];for(let n=0;n<64;n++)waits.push(assert.rejects(e.client.say('pending '+n),x=>x.uncertain===true));await assert.rejects(e.client.say('overflow'),x=>x.code==='request_in_flight');assert.equal(e.client.state().pendingRequests,64);const leaving=e.client.disconnect();await Promise.all(waits);await leaving;assert.equal(e.client.state().pendingRequests,0);assert.equal(e.clock.tasks.size,0);
}
results.push('pending request count bounded64 and disconnect rejects all unconfirmed sends');
{
 const e=await ready(),old=e.socket;await leave(e);const connection=e.client.connect();await flush();const next=MockSocket.made.at(-1);next.open();old.frame(welcome);old.frame(history());assert.equal(e.client.state().phase,'handshaking');next.frame({...welcome,self:{...author,participantId:'self-b',guestId:'12346'}});next.frame(history());await connection;assert.equal(e.client.state().self.participantId,'self-b');e.socket=next;await leave(e);
}
results.push('late old socket events cannot join or mutate a new connection');
{
 let capturedSignal;const e=setup({fetcher:(url,init)=>{capturedSignal=init.signal;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))}});const connection=e.client.connect();const rejected=assert.rejects(connection);assert.equal(e.client.state().phase,'admitting');await e.client.disconnect();await rejected;assert.equal(capturedSignal.aborted,true);assert.equal(e.clock.tasks.size,0);assert.equal(e.client.state().phase,'closed');
}
results.push('cancelled admission aborts fetch and leaves no timers or automatic reconnect');
{
 let calls=0;const e=setup({Socket:null,fetcher:async()=>{calls++;return new Response(null,{status:204})}});await assert.rejects(e.client.connect(),x=>x.code==='socket_unavailable');assert.equal(calls,0);
}
results.push('missing browser socket support does not create an admission session');
{
 const e=await ready();const before=e.socket.sent.length;const result=await e.client.disconnect({graceful:false});assert.equal(e.client.state().phase,'closed');assert.equal(result.acknowledged,false);assert.equal(e.socket.sent.length,before);
}
results.push('immediate local disconnect without unsupported leave');
fs.writeFileSync('portfolio/organization/guest-chat-20261016/transport-check.json',JSON.stringify({passed:true,results,realSockets:0,networkRequests:0,testKind:'mock transport + virtual clock, not real two-client WS'},null,2));console.log(results.length+' local transport lifecycle groups passed; zero real sockets/network requests.');
