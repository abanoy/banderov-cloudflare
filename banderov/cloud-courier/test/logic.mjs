import assert from 'node:assert/strict';
import{makeRoute,surface,newRun,step,result,CONTRACTS,cleanSave,record,dailySeed}from'../src/logic.mjs';
let samples=0,runs=0;
for(let seed=0;seed<300;seed++)for(const c of CONTRACTS)for(let district=0;district<2;district++){
 const route=makeRoute('qa-'+seed,c.id,district);assert.deepEqual(route,makeRoute('qa-'+seed,c.id,district));
 for(const e of route.edges)for(let j=0;j<=100;j++){assert.ok(surface(route,{x:e.a.x+(e.b.x-e.a.x)*j/100,y:e.a.y+(e.b.y-e.a.y)*j/100}));samples++;}
 if(seed<10){const run=newRun(route);const points=route.edges.filter(e=>e.type==='safe').flatMap(e=>[e.a,e.b]).filter((p,i,a)=>i===0||p.x!==a[i-1].x||p.y!==a[i-1].y);let goal=1;for(let i=0;i<16000&&run.status==='playing';i++){const p=points[goal],dx=p.x-run.x,dy=p.y-run.y,d=Math.hypot(dx,dy);if(d<5&&goal<points.length-1){goal++;continue;}step(run,{x:dx/Math.max(d,1),y:dy/Math.max(d,1),steady:true},1/120);}assert.equal(run.status,'won',`safe route ${seed}/${c.id}/${district}`);assert.equal(run.hits,0);assert.ok(run.condition>99);runs++;}
}
const run=newRun(makeRoute('loss'));run.x=-100;step(run,{},1/120);assert.equal(run.hits,1);assert.equal(run.checkpoint,0);assert.ok(run.condition<100);run.condition=1;run.x=-100;step(run,{},1/120);assert.equal(run.status,'lost');assert.equal(result(run).medal,0);
const timed=newRun(makeRoute('timer'));timed.time=90;step(timed,{},.01);assert.equal(timed.status,'lost');
const win=newRun(makeRoute('save'));win.status='won';win.time=30;const save=cleanSave('{broken');assert.equal(record(save,win,2).medal,3);assert.equal(save.bestStreak,2);assert.deepEqual(cleanSave(JSON.stringify(save)),save);assert.equal(cleanSave('{"version":99}').deliveries,0);assert.equal(cleanSave({version:1,deliveries:Infinity}).deliveries,100000);assert.equal(dailySeed(new Date('2026-10-07T04:01:00Z')),'daily-2026-10-07');
console.log(`PASS: ${samples} centerline reachability samples across 1,800 routes; ${runs} full safe-path physics deliveries; reproducibility, damage/loss/deadline, scoring, save restoration, UTC daily.`);
