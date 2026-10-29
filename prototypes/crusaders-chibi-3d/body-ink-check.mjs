import assert from 'node:assert/strict';
import {createChibi} from './src/model.js';
import * as T from './vendor/three.module.js';
import {writeFileSync} from 'node:fs';
const affected=new Set(['sailor-shirt','right-arm','left-arm','right-hand','left-hand','right-sleeve','left-sleeve']);
const old=createChibi(),study=createChibi({bodyOutline:'defined'});let checks=0;
assert.deepEqual(old.stats(),study.stats());checks++;
for(const name of Object.keys(old.parts)){
 const a=old.parts[name],b=study.parts[name];assert(a.position.equals(b.position)&&a.rotation.equals(b.rotation)&&a.scale.equals(b.scale));checks++;
 for(const key of Object.keys(a.geometry.attributes)){assert.deepEqual(a.geometry.attributes[key].array,b.geometry.attributes[key].array);checks++;}
 const x=a.children.find(c=>c.userData.outline),y=b.children.find(c=>c.userData.outline);if(x){assert.equal(x.scale.equals(y.scale),!affected.has(name));checks++;}
}
function sole(m){m.root.updateMatrixWorld(true);let result=Infinity;for(const side of ['right','left'])m.parts[side+'-foot'].traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<a.count;i++)result=Math.min(result,v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).y);}});return result;}
for(const pose of ['neutral','idle','walk','wave','gasp']){
 old.setPose(pose);study.setPose(pose);
 for(let i=0;i<64;i++){old.update(.025);study.update(.025);assert.equal(sole(old),sole(study));assert(old.root.position.equals(study.root.position));assert(old.root.rotation.equals(study.root.rotation));checks+=3;}
}
old.reset();study.reset();assert.deepEqual(old.bounds(),study.bounds());checks++;old.dispose();study.dispose();
writeFileSync(new URL('./review/body-ink-geometry.json',import.meta.url),JSON.stringify({checks,affected:[...affected],scope:'Same named primary mesh data/transforms; only seven body ink-shell scales differ. Exact actual-foot/ink minima, root and facing across five poses/64steps. Not terrain IK, screen-width constancy or performance evidence.'},null,2));console.log(JSON.stringify({checks,unchangedSoles:true}));
