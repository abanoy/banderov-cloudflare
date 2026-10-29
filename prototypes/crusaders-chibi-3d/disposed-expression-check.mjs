import assert from 'node:assert/strict';
import {createChibi} from './src/model.js';
for(const batchFaceInk of [false,true]){
 const model=createChibi({batchFaceInk}),ids=()=>{const a=[];model.root.traverse(o=>{if(o.geometry)a.push(o.geometry.uuid);});return a;};
 model.dispose();const before=ids();
 for(const expression of ['happy','surprised','alarmed','neutral'])model.setExpression(expression);
 assert.deepEqual(ids(),before,'disposed character must not allocate replacement face geometries');
 model.dispose();assert(model.disposed);
}
console.log('PASS disposed expression changes inert for separate/batched face ink');
