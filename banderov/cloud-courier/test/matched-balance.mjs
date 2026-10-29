import fs from'node:fs';import assert from'node:assert/strict';
import{drive}from'./balance.mjs';import{makeRoute,CONTRACTS}from'../src/logic.mjs';
const seeds=['first-flight','daily-2026-10-07',...Array.from({length:20},(_,i)=>'balance-'+i)],rows=[];
const range=a=>{if(!a.length)return null;const s=a.toSorted((a,b)=>a-b);return{min:s[0],median:s[Math.floor(s.length/2)],max:s.at(-1)};};
for(const cadence of[{hz:10,wobble:.06},{hz:5,wobble:.15}])for(const seed of seeds)for(const c of CONTRACTS)for(const district of[0,1])for(const path of['safe','shortcut'])for(const steady of['never','always','edge-correction']){
 const policy={id:`${path}:${steady}`,route:path,steady,reactive:true,lookahead:20};
 rows.push(drive(makeRoute(seed,c.id,district),policy,{sampleTicks:120/cadence.hz,wobble:cadence.wobble}));
}
const summaries=[];for(const hz of[10,5])for(const c of CONTRACTS)for(const district of[0,1])for(const path of['safe','shortcut'])for(const steady of['never','always','edge-correction']){
 const policy=`${path}:${steady}`,g=rows.filter(r=>r.sampleHz===hz&&r.contract===c.id&&r.district===district&&r.policy===policy),wins=g.filter(r=>r.status==='won');
 summaries.push({hz,contract:c.id,district,policy,runs:g.length,wins:wins.length,golds:g.filter(r=>r.medal===3).length,completionTime:range(wins.map(r=>r.time)),completionCondition:range(wins.map(r=>r.exactCondition)),allHits:range(g.map(r=>r.hits)),steadyFraction:range(g.map(r=>r.steadyFraction)),controlUpdates:range(g.map(r=>r.updates))});
}
// Pareto frontier is computed PER seed/contract/district/cadence from successful
// measured runs only. A policy dominates another when no slower and no more
// damaged, with at least one strict improvement. Never mix routes or cadences.
const frontiers=[];for(const hz of[10,5])for(const seed of seeds)for(const c of CONTRACTS)for(const district of[0,1]){
 const g=rows.filter(r=>r.sampleHz===hz&&r.seed===seed&&r.contract===c.id&&r.district===district&&r.status==='won');
 const frontier=g.filter(a=>!g.some(b=>b!==a&&b.time<=a.time&&b.exactCondition>=a.exactCondition&&(b.time<a.time||b.exactCondition>a.exactCondition)));
 frontiers.push({hz,seed,contract:c.id,district,points:frontier.map(r=>({policy:r.policy,time:r.time,condition:r.exactCondition,score:r.score,medal:r.medal}))});
}
const counts=[];for(const hz of[10,5])for(const c of CONTRACTS)for(const path of['safe','shortcut'])for(const steady of['never','always','edge-correction']){const policy=`${path}:${steady}`;counts.push({hz,contract:c.id,policy,frontierRuns:frontiers.filter(f=>f.hz===hz&&f.contract===c.id&&f.points.some(p=>p.policy===policy)).length,totalComparableRoutes:44});}
const report={additionalRuns:rows.length,baselineRuns:1716,totalSimulationsThisCommand:rows.length+1716,seedCount:22,stateAccess:['exact sampled x/y','elapsed time','rescue counter/checkpoint','preselected static bridge endpoints/color'],excludedState:['velocity','condition','instantaneous wind','wind phase','future forecast'],physicsHz:120,controlCadences:[{hz:10,wobble:.06},{hz:5,wobble:.15}],sameController:{lookahead:20,waypointRadius:12,edgeSteadyThreshold:2.5,endpointSteadyRadius:65,afterTurnSteadySeconds:.6},limitations:'Exact geometric observations, continuous analog output, preselected route and ideal sample schedule; not pixel perception, human trial, measured reaction time or 120Hz optimal control.',summaries,frontierCounts:counts,frontiers,runs:rows};
fs.writeFileSync(new URL('../matched-balance-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('MATCHED same 20-unit lookahead controller; completion medians exclude losses.');
console.table(summaries.map(s=>({hz:s.hz,contract:s.contract,district:s.district,policy:s.policy,wins:s.wins,golds:s.golds,time:s.completionTime?.median??null,condition:s.completionCondition?.median.toFixed(1)??null,steady:s.steadyFraction.median.toFixed(2)})));
console.log('PER-ROUTE FRONTIER membership');console.table(counts);
for(const r of rows){assert.ok(r.updates<=Math.ceil(r.time*r.sampleHz)+1);assert.equal(r.sampleHz===10||r.sampleHz===5,true);assert.ok(r.steadyFraction>=0&&r.steadyFraction<=1.0001);if(r.policy.endsWith(':always'))assert.ok(r.steadyFraction>.999);if(r.policy.endsWith(':never'))assert.equal(r.steadyFraction,0);}
assert.equal(rows.length,1584);assert.equal(frontiers.length,264);console.log('PASS 1584 matched input-driven runs, 264 per-route/cadence frontiers; no production changes.');
