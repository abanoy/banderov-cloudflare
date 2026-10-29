import {messageText} from './model.js';
// send() must resolve only after its transport's acknowledgement. This controller
// neither invents acknowledgements nor retries uncertain sends.
export function createMessageSubmission({readDraft,readRevision,clearDraft,send,onBusy,onResult}){
  let busy=false,generation=0;
  function invalidate(){generation++;if(busy){busy=false;onBusy(false)}}
  async function submit(){
    if(busy)return {kind:'busy'};
    const raw=readDraft(),text=messageText(raw),revision=readRevision();
    if(!text){const result={kind:'invalid'};onResult(result);return result}
    const token=++generation;busy=true;onBusy(true);
    try{
      const acknowledgement=await send(text);
      if(token!==generation)return {kind:'stale'};
      const cleared=readRevision()===revision&&readDraft()===raw;
      if(cleared)clearDraft();
      const result={kind:'confirmed',cleared,acknowledgement};onResult(result);return result;
    }catch(error){
      if(token!==generation)return {kind:'stale'};
      const result={kind:'failed',uncertain:error?.uncertain===true};if(['rate_limited','muted'].includes(error?.code)){result.code=error.code;if(Number.isSafeInteger(error.retryAfterSeconds)&&error.retryAfterSeconds>0)result.retryAfterSeconds=error.retryAfterSeconds}onResult(result);return result;
    }finally{if(token===generation){busy=false;onBusy(false)}}
  }
  return Object.freeze({submit,invalidate,isBusy:()=>busy});
}
