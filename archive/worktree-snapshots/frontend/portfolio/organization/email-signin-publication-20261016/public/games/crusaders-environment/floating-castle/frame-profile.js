// Opt-in local review timings. Ordinary play installs no output.
export function createFrameProfile(enabled=false){
 if(!enabled)return {begin(){},mark(){},finish(){}};
 const output=document.createElement('output');
 output.id='frame-profile';output.setAttribute('aria-label','Frame timing review');
 output.style.cssText='position:fixed;left:16px;bottom:105px;z-index:40;max-width:calc(100vw - 32px);padding:8px;background:#102936ed;border:1px solid #80eee2;color:#eff1c8;font:11px monospace;pointer-events:none;white-space:pre-wrap';
 document.body.append(output);
 const samples=[];
 let current=null,last=0,lastPublish=0,context='';
 const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]||0;};
 return {
  begin(now,paused,nextContext='World',admittedSeconds=null){
   if(paused){current=null;last=0;return;}
   if(context!==nextContext){samples.length=0;last=0;lastPublish=0;context=nextContext;}
   const time=performance.now();
   current={start:time,stamp:time,interval:last?now-last:0,admittedMs:Number.isFinite(admittedSeconds)?Math.max(0,admittedSeconds*1000):null,stages:{}};
   last=now;
  },
  mark(name){
   if(!current)return;
   const now=performance.now();current.stages[name]=now-current.stamp;current.stamp=now;
  },
  finish(now,drawStats=null){
   if(!current)return;
   if(drawStats)current.drawStats={...drawStats};current.total=performance.now()-current.start;samples.push(current);
   if(samples.length>60)samples.shift();current=null;
   if(now-lastPublish<1000)return;lastPublish=now;
   const interval=median(samples.map(sample=>sample.interval).filter(value=>value>0));
   const stages=['Simulation','Camera','Effects','Draw','UI'];
   const timed=samples.filter(sample=>sample.interval>0&&sample.admittedMs!==null),elapsed=timed.reduce((sum,sample)=>sum+sample.interval,0),admitted=timed.reduce((sum,sample)=>sum+sample.admittedMs,0);
   const clock=elapsed?'\nCallback gap '+interval.toFixed(1)+'ms · Frame time admitted '+(100*admitted/elapsed).toFixed(1)+'% · 50ms safety cap':'';
   output.textContent='LOCAL FRAME REVIEW · '+context+' · '+document.visibilityState+' · '+samples.length+' samples · '+(interval?(1000/interval).toFixed(1):'—')+' median draw Hz\n'
    +stages.map(name=>name+' '+median(samples.map(sample=>sample.stages[name]||0)).toFixed(2)+'ms').join(' · ')
    +(samples.at(-1).drawStats?'\nWorld draws '+samples.at(-1).drawStats.worldCalls+' · triangles '+samples.at(-1).drawStats.worldTriangles+' · post draws '+samples.at(-1).drawStats.postCalls+' · buffer '+samples.at(-1).drawStats.width+'×'+samples.at(-1).drawStats.height:'')
    +'\nFrame work '+median(samples.map(sample=>sample.total)).toFixed(2)+'ms · JS wall time, includes driver submission; not GPU timing'+clock;
  }
 };
}
