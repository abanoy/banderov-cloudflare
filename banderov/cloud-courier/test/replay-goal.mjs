import assert from 'node:assert/strict';
import {makeRoute,newRun,replayGoal,replayGoalText,replayGoalMet,replayGoalReport,parcelConditionText} from '../src/logic.mjs';
const run=newRun(makeRoute('practice'));Object.assign(run,{status:'won',time:44.73,condition:100});
const faster=replayGoal(run,'faster'),seal=replayGoal(run,'seal'),parcel=replayGoal(run,'parcel');
assert.equal(faster.time,44.73);assert.equal(replayGoalText(faster),'Finish faster than 44.73s');assert.equal(seal.medal,3);assert.equal(replayGoalMet(faster,run),false);
const next={...run,time:44.72};assert.equal(replayGoalMet(faster,next),true);assert.equal(replayGoalMet(seal,next),false);next.time=43;assert.equal(replayGoalMet(seal,next),true);assert.equal(replayGoal(next,'seal'),null);
assert.equal(replayGoalMet(parcel,next),true);next.condition=99.99;assert.equal(replayGoalMet(parcel,next),false);next.condition=100;next.hits=1;assert.equal(replayGoalMet(parcel,next),false);
assert.equal(replayGoalMet(faster,{...run,time:20,status:'lost'}),false);assert.equal(replayGoalMet(faster,{...run,time:20,route:makeRoute('other')}),false);assert.equal(replayGoal({...run,status:'lost'},'faster'),null);assert.equal(replayGoal(run,''),null);
assert.match(replayGoalReport(faster,run),/Save 0.01s to beat it/);assert.match(replayGoalReport(faster,{...run,time:45.73}),/Save 1.01s to beat it/);assert.match(replayGoalReport(faster,{...run,status:'lost'}),/Complete the delivery first/);assert.match(replayGoalReport(seal,{...run,time:45,condition:75}),/Preserve 10 more parcel points · Save 2.00s/);assert.match(replayGoalReport(parcel,{...run,condition:80,hits:2}),/Keep the parcel undamaged · Avoid 2 rescues/);assert.match(replayGoalReport(parcel,run),/^Retry target reached:/);
console.log('PASS optional route-bound retry goals, strict displayed time, next existing seal, actual pristine/no-rescue and failed-run exclusion.');

assert.equal(parcelConditionText(100),'100');assert.equal(parcelConditionText(99.9999),'99.99');assert.equal(parcelConditionText(84.9999),'84.99');assert.equal(parcelConditionText(0),'0');assert.equal(parcelConditionText(75),'75');

assert.equal(parcelConditionText(.29),'0.29');assert.equal(parcelConditionText(85.01),'85.01');assert.equal(parcelConditionText(99.99999999999999),'99.99');assert.equal(parcelConditionText(84.99999999999999),'84.99');assert.equal(parcelConditionText(1e-7),'0');

assert.equal(replayGoal({...run,time:80},"seal",2).medal,3);assert.equal(replayGoal({...run,time:80},"seal",3),null);assert.equal(replayGoal({...run,status:"lost"},"seal",2).medal,3);assert.equal(replayGoal({...run,status:"lost"},"seal",3),null);assert.equal(replayGoal({...run,time:43},"seal",1),null);
