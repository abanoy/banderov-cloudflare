export function createExplosionFlash(getPlayer){
 const element=document.createElement('div');element.id='battle-explosion-white';document.body.append(element);let glow=0;
 function event(e){if(!['blast','explosion','tower-impact','meltdown-impact'].includes(e.type))return;const a=getPlayer(),d=e.x===undefined?0:Math.hypot(e.x-a.state.x,e.z-a.state.z);glow=Math.max(glow,e.type==='explosion'?.92:e.type==='blast'?.32*Math.max(0,1-d/220):e.type==='tower-impact'&&e.team!==a.team?.05:.2);element.style.opacity=glow.toFixed(3);}
 return {event,update(dt){glow=Math.max(0,glow-dt*2.4);element.style.opacity=glow.toFixed(3);},reset(){glow=0;element.style.opacity=0;},snapshot:()=>({opacity:glow})};
}
