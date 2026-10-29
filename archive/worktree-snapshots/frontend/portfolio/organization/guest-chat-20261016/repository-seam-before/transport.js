import {decodeServerFrame,encodeGuestAction,createDurableHistory} from './protocol.js';
const defaultTimers={
  setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id),
  setInterval:(fn,ms)=>setInterval(fn,ms),clearInterval:id=>clearInterval(id)
};
function failure(code,extra={}){return Object.assign(new Error('Chat connection unavailable'),{code,...extra})}
// Default OFF, loopback-only. No admission request or socket before explicit connect().
export function createLocalChatClient({
  enabled=false,origin=globalThis.location?.origin,
  fetcher=(...args)=>globalThis.fetch(...args),Socket=globalThis.WebSocket,
  timers=defaultTimers,onState=()=>{},onFrame=()=>{},onError=()=>{},
  makeRequestId=()=>crypto.randomUUID().replaceAll('-','')
}={}){
  let phase='closed',generation=0,socket=null,abort=null,admissionTimer=null,handshakeTimer=null,heartbeat=null;
  let self=null,capabilities=null,history=createDurableHistory(),resolveReady=null,rejectReady=null;
  const pending=new Map();
  function state(){return {phase,self,capabilities,history:history.snapshot(),pendingRequests:pending.size}}
  function update(next){phase=next;onState(state())}
  function clearTimers(){
    timers.clearTimeout(admissionTimer);timers.clearTimeout(handshakeTimer);timers.clearInterval(heartbeat);
    admissionTimer=handshakeTimer=heartbeat=null;
  }
  function forget(id){const item=pending.get(id);if(item){timers.clearTimeout(item.timer);pending.delete(id)}return item}
  function shutdown(error=failure('connection_closed'),close=true){
    if(phase==='closed')return;
    generation++;clearTimers();abort?.abort();abort=null;
    for(const [id,item] of pending){timers.clearTimeout(item.timer);item.reject(failure(error.code,{uncertain:item.type==='say'}))}
    pending.clear();const historyRequest=history.snapshot().pending;if(historyRequest)history.accept({type:'error',requestId:historyRequest.requestId,code:'service_unavailable'});rejectReady?.(error);resolveReady=rejectReady=null;
    const previous=socket;socket=null;self=capabilities=null;update('closed');
    if(close&&previous&&previous.readyState<2)try{previous.close(1000,'Client stopped')}catch{}
  }
  function protocolFailure(){const error=failure('invalid_server_data');onError(error);shutdown(error)}
  function settle(item){
    if(!item.ack||(item.type==='history_before'&&!item.pageReceived))return;
    forget(item.id);item.resolve(item.ack);
  }
  function handleAck(frame){
    const item=pending.get(frame.requestId);if(!item)return;
    if(item.type==='say'){
      if(!frame.messageId||frame.self)throw failure('invalid_ack');
    }else if(item.type==='nick'){
      if(!frame.self||frame.messageId||!self||frame.self.participantId!==self.participantId||
        frame.self.guestId!==self.guestId||frame.self.role!==self.role)throw failure('invalid_ack');
      self=frame.self;
    }else if(frame.messageId||frame.self)throw failure('invalid_ack');
    item.ack=frame;settle(item);
  }
  function receive(raw,token){
    if(token!==generation)return;
    let frame;
    try{
      frame=decodeServerFrame(raw);
      if(frame.type==='welcome'){
        if(phase!=='handshaking'||self)throw failure('invalid_welcome');
        history.accept(frame);self=frame.self;capabilities=frame.capabilities;
      }else if(frame.type==='history'){
        if(!self||!['handshaking','ready'].includes(phase))throw failure('invalid_history');
        const item=frame.requestId?pending.get(frame.requestId):null;
        if(frame.requestId&&item?.type!=='history_before')throw failure('invalid_history');
        history.accept(frame);
        if(item){item.pageReceived=true;settle(item)}
        if(phase==='handshaking'){
          timers.clearTimeout(handshakeTimer);handshakeTimer=null;
          heartbeat=timers.setInterval(()=>{
            if(phase==='ready')submit('ping').catch(()=>{if(phase==='ready')shutdown(failure('connection_check_failed'))})
          },20000);
          update('ready');resolveReady?.(state());resolveReady=rejectReady=null;
        }
      }else if(frame.type==='ack'){
        handleAck(frame);
      }else if(frame.type==='error'){
        if(self)history.accept(frame);
        const item=frame.requestId?forget(frame.requestId):null;
        const error=failure(frame.code,{retryAfterSeconds:frame.retryAfterSeconds,uncertain:false});
        item?.reject(error);onError(error);
        if(phase==='handshaking')shutdown(error);
      }else{
        if(phase!=='ready')throw failure('not_ready');
        history.accept(frame);
      }
    }catch{protocolFailure();return}
    onFrame(frame,state());
  }
  function submit(type,payload={}){
    if(phase!=='ready'||socket?.readyState!==1)return Promise.reject(failure('not_connected'));
    if(pending.size>=64||(type==='history_before'&&[...pending.values()].some(p=>p.type===type)))
      return Promise.reject(failure('request_in_flight'));
    if(socket.bufferedAmount>16384){shutdown(failure('output_unavailable'));return Promise.reject(failure('output_unavailable'))}
    const id=makeRequestId();let raw;
    if(pending.has(id))return Promise.reject(failure('request_id_collision'));
    try{raw=type==='history_before'?history.requestOlder(id):encodeGuestAction({type,requestId:id,...payload})}
    catch{return Promise.reject(failure('invalid_request'))}
    if(socket.bufferedAmount+new TextEncoder().encode(raw).length>16384){shutdown(failure('output_unavailable'));return Promise.reject(failure('output_unavailable'))}
    return new Promise((resolve,reject)=>{
      const item={id,type,resolve,reject,ack:null,pageReceived:false,timer:null};
      item.timer=timers.setTimeout(()=>{
        if(!forget(id))return;
        if(type==='history_before')history.accept({type:'error',requestId:id,code:'service_unavailable'});
        reject(failure('acknowledgement_unconfirmed',{uncertain:type==='say'}));
      },10000);
      pending.set(id,item);
      try{socket.send(raw)}catch{
        forget(id);if(type==='history_before')history.accept({type:'error',requestId:id,code:'service_unavailable'});
        reject(failure('send_unconfirmed',{uncertain:type==='say'}));
      }
    });
  }
  async function connect(){
    if(!enabled)throw failure('disabled');
    let base;
    try{
      base=new URL(origin);
      if(!['http:','https:'].includes(base.protocol)||!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||
        base.username||base.password||base.pathname!=='/'||base.search||base.hash||
        (globalThis.location&&globalThis.location.origin!==base.origin))throw Error();
    }catch{throw failure('local_origin_required')}
    if(typeof Socket!=='function')throw failure('socket_unavailable');
    if(phase!=='closed')throw failure('already_connected');
    const token=++generation;history=createDurableHistory();self=capabilities=null;
    abort=new AbortController();update('admitting');
    admissionTimer=timers.setTimeout(()=>abort?.abort(),8000);
    let response;
    try{
      response=await fetcher(new URL('/api/chat/session',base).href,{
        method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{'Content-Type':'application/json',Accept:'application/json'},body:'{}',signal:abort.signal
      });
    }catch{
      if(token===generation)shutdown(failure('admission_unavailable'));
      throw failure('admission_unavailable');
    }
    if(token!==generation)throw failure('connection_cancelled');
    timers.clearTimeout(admissionTimer);admissionTimer=null;abort=null;
    response.body?.cancel().catch(()=>{});
    if(!response.ok){shutdown(failure('admission_unavailable'));throw failure('admission_unavailable')}
    const url=new URL('/api/chat/ws',base);url.protocol=base.protocol==='https:'?'wss:':'ws:';
    try{socket=new Socket(url.href)}catch{shutdown(failure('connection_unavailable'));throw failure('connection_unavailable')}
    update('handshaking');
    return new Promise((resolve,reject)=>{
      resolveReady=resolve;rejectReady=reject;
      handshakeTimer=timers.setTimeout(()=>{
        if(token===generation)shutdown(failure('handshake_unavailable'));
      },10000);
      socket.addEventListener('message',event=>receive(event.data,token));
      socket.addEventListener('error',()=>{if(token===generation)shutdown(failure('connection_unavailable'))});
      socket.addEventListener('close',()=>{if(token===generation)shutdown(failure('connection_closed'),false)});
    });
  }
  async function disconnect(){
    if(phase==='closed')return {acknowledged:false};
    if(phase!=='ready'){shutdown(failure('disconnected'));return {acknowledged:false}}
    const leaving=submit('leave');update('closing');
    try{await leaving;return {acknowledged:true}}
    catch{return {acknowledged:false}}
    finally{shutdown(failure('disconnected'))}
  }
  return Object.freeze({connect,disconnect,state,say:text=>submit('say',{text}),
    nickname:nickname=>submit('nick',{nickname}),loadOlder:()=>submit('history_before')});
}
