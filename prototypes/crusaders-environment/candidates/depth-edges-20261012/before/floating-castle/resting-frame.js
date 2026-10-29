/** Keep a quiet paused view without repeating full scene work every RAF.
 * Inputs and camera settling redraw immediately; a one-second refresh also
 * picks up asynchronous asset changes. The caller still updates its RAF clock. */
export function createRestingFrameGate(){
 let dirty=true,last=-Infinity;
 return {invalidate(){dirty=true;},draw(paused,now,settling=false){
  if(!paused||settling||dirty||now-last>=1000){dirty=false;last=now;return true;}
  return false;
 }};
}
