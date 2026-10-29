import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from './vendor/three.module.js';
import {createChibi} from './src/model.js';
import {createWorldCharacter} from './src/adapter.js';
const source=readFileSync(new URL('./research/model-before-forward-gesture.js',import.meta.url),'utf8')
 .replace('../vendor/three.module.js',new URL('./vendor/three.module.js',import.meta.url).href)
 .replace('./lighting.js',new URL('./src/lighting.js',import.meta.url).href);
const {createChibi:before}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let checks=0;const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const allowed=new Set(['right-arm','left-arm','right-hand','left-hand','right-sleeve','left-sleeve']);
for(const bodyOutline of ['current','defined']){
 const old=before({bodyOutline}),current=createChibi({bodyOutline}),forward=createChibi({bodyOutline,gestureReach:'forward'});
 equal(old.stats(),current.stats());equal(current.stats(),forward.stats());
 for(const name of Object.keys(current.parts))for(const key of Object.keys(current.parts[name].geometry.attributes)){
  equal(old.parts[name].geometry.attributes[key].array,current.parts[name].geometry.attributes[key].array);
  equal(current.parts[name].geometry.attributes[key].array,forward.parts[name].geometry.attributes[key].array);
 }
 for(const pose of ['neutral','idle','walk','wave','gasp']){
  for(const m of [old,current,forward])m.setPose(pose);
  for(let phase=0;phase<64;phase++){
   for(const m of [old,current,forward]){m.update(.025);m.root.updateMatrixWorld(true);}
   for(const name of Object.keys(current.parts)){
    equal(old.parts[name].matrixWorld.elements,current.parts[name].matrixWorld.elements);
    if(!allowed.has(name)||!['wave','gasp'].includes(pose))equal(current.parts[name].matrixWorld.elements,forward.parts[name].matrixWorld.elements);
   }
   equal(current.root.position.toArray(),forward.root.position.toArray());equal(current.root.rotation.toArray(),forward.root.rotation.toArray());
   if(['wave','gasp'].includes(pose))for(const side of pose==='wave'?['right']:['left','right']){
    const a=current.parts[side+'-hand'].getWorldPosition(new T.Vector3()),b=forward.parts[side+'-hand'].getWorldPosition(new T.Vector3());
    assert(b.z-a.z>.1);checks++;
   }
  }
 }
 for(const m of [old,current,forward])m.reset();equal(current.bounds(),forward.bounds());
 for(const m of [old,current,forward]){m.dispose();m.dispose();}
}
for(const height of [1.2,2.1,4]){
 const a=createWorldCharacter({worldHeight:height}),b=createWorldCharacter({worldHeight:height,gestureReach:'forward'});
 for(const m of [a,b]){m.setPosition(3,4,5);m.setFacingVector(1,0);m.setPose('gasp');m.update(.075);}
 equal(a.root.position.toArray(),b.root.position.toArray());equal(a.root.rotation.toArray(),b.root.rotation.toArray());equal(a.root.scale.toArray(),b.root.scale.toArray());
 for(const side of ['right','left'])equal(a.parts[side+'-foot'].getWorldPosition(new T.Vector3()).toArray(),b.parts[side+'-foot'].getWorldPosition(new T.Vector3()).toArray());
 a.dispose();b.dispose();
}
const report={checks,scope:'Default world matrices exactly match preserved before-source across five poses/64steps/two body-ink options. Forward option changes only arm assemblies in wave/gasp; named geometry/other parts/root/feet remain exact. Three adapter heights preserve transform ownership; no physics/terrain/IK/perception claim.'};
writeFileSync(new URL('./review/gesture-reach-geometry.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
