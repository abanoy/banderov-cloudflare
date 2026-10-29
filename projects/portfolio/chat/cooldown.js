// An ephemeral server-hint timer, never a retry scheduler or authorization rule.
export function createCooldown({now=()=>performance.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),onChange=()=>{}}={}){
 let deadline=0,timer=null,revision=0;
 const remainingSeconds=()=>Math.max(0,Math.ceil((deadline-now())/1000));
 function tick(token){
  if(token!==revision)return;timer=null;
  if(remainingSeconds()){timer=schedule(()=>tick(token),Math.max(1,Math.min(60000,deadline-now())));return}
  deadline=0;onChange();
 }
 return Object.freeze({
  active:()=>remainingSeconds()>0,remainingSeconds,
  start(seconds){
   if(!Number.isSafeInteger(seconds)||seconds<1||!Number.isSafeInteger(seconds*1000))return false;
   const next=now()+seconds*1000;if(!Number.isFinite(next)||next>Number.MAX_SAFE_INTEGER)return false;
   deadline=Math.max(deadline,next);cancel(timer);const token=++revision;tick(token);onChange();return true;
  },
  reset(){revision++;cancel(timer);timer=null;deadline=0;onChange()}
 });
}
