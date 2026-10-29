import assert from 'node:assert/strict';import fs from 'node:fs';import {createBattleFeedback} from '../floating-castle/battle-feedback.js';
const score={textContent:''},feed={replaceChildren(){}},root={querySelector(selector){return selector==='#combat-score'?score:feed;}};
globalThis.document={createElement(){return root;},body:{append(){}}};
const actors=[{id:0,name:'YOU',team:0,state:{x:0,y:0,z:0}},{id:8,name:'Dusk Raider',team:1}];
const fx=createBattleFeedback(actors);fx.event({type:'down',actor:8,source:0,time:10});fx.event({type:'hit',source:0,damage:8,time:10.2});fx.event({type:'capture',team:0,time:10.4});fx.tick(12.9,true,false);assert.equal(score.textContent,'KILLED Dusk Raider +100');fx.tick(13.1,true,false);assert.equal(score.textContent,'');fx.event({type:'hit',source:0,damage:8,time:14});fx.tick(14,true,false);assert.equal(score.textContent,'ENEMY HIT 8');
fs.writeFileSync('review/kill-feedback-test.json',JSON.stringify({passed:true,checks:['Kill survives later hit/capture notifications','Three-second expiry','Hit feedback resumes afterward']},null,2));console.log('PASS three kill-feedback priority and expiry checks');
