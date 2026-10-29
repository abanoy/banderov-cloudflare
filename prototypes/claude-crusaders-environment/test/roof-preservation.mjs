import assert from 'node:assert/strict';
for(const [folder,label] of [['','standalone'],['integration/','integration'],['integration-rounded/','integration-rounded']]){
 const current=await import('../'+folder+'src/layout.js'),prior=await import('../history/roof-volumes/'+label+'/src/layout.js');
 for(const scaled of [false,true]){
  const a=current.makeLayout(scaled),b=prior.makeLayout(scaled);
  for(const key of ['destinations','surfaces','walls','decor','pads'])assert.deepEqual(a[key],b[key],label+' '+key);
  assert.equal(a.roofs.length,6);assert.deepEqual(current.TUNE,prior.TUNE);
 }
 const P=await import('../'+folder+'src/physics.js');if(folder)assert.equal(typeof P.landingAt,'function');
}
console.log('All three walking layouts, tuning and integration landing exports preserved');
