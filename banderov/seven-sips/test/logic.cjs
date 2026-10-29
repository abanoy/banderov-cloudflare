const assert=require('node:assert/strict');
require('../src/dialogue.js');require('../src/logic.js');
const {GIRLS}=SevenDialogue,{score,create,submit,advance}=SevenLogic;
let checks=0;function check(fn){fn();checks++;}
for(const girl of GIRLS.slice(0,3)){
  for(const best of [true,false]){
    let s=create(girl.key);
    while(s.phase!=='ended'){
      const tags=Object.keys(girl.likes).sort((a,b)=>girl.likes[b]-girl.likes[a]);
      const tag=best?tags[0]:tags.at(-1),line=s.day===7?girl.final:girl.lines[s.day-1];
      const middle=line[1].slice().sort((a,b)=>girl.likes[b[1]]-girl.likes[a[1]])[best?0:line[1].length-1];
      s=submit(s,girl,[{tag},{tag:middle[1]},{tag}]);
      check(()=>assert.throws(()=>submit(s,girl,[{tag},{tag},{tag}])));
      s=advance(s);
    }
    check(()=>assert.equal(s.won,best,`${girl.key} ${best?'best':'worst'} route`));
    if(best)check(()=>assert.equal(s.history.length,7));
  }
}
const g=GIRLS[1],rude=Array.from({length:3},()=>({tag:'rude'}));
check(()=>assert.equal(submit(create(g.key),g,rude).hearts,22));
check(()=>assert.equal(submit({...create(g.key),day:2,hearts:1},g,rude).hearts,0));
check(()=>assert.equal(submit({...create(g.key),day:2,hearts:129},g,Array.from({length:3},()=>({tag:'sweet'}))).hearts,130));
check(()=>assert.throws(()=>advance(create(g.key))));
check(()=>assert.throws(()=>score(g,[],1)));
check(()=>assert.deepEqual(create(g.key).history,[]));
console.log(`${checks} checks passed`);
