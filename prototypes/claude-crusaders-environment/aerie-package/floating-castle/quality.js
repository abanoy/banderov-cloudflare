// Quality presets for the settings UI. Balanced is the owner's look exactly (Pixelation 50, Contact depth 20, full
// particle detail, the post grade); Performance trades render scale, contact shading, ambient particles and the post
// grade (saturation / S-curve / toning, the costliest post step left once contact is off) for speed. Lighting, sky
// haze, dither and palette are never touched. Auto starts Balanced and drops to Performance once when frames stay slow.
// Module specifiers match world.js so the same module instances (and particle pools, post uniforms) are adjusted.
import * as garden from './arena-garden.js?v=dbc-20261018';
import * as orbs from './charge-orb.js?v=aerie-20261018';
import {POST_LOOK} from './atmosphere.js?v=dbc-20261018';
export const QUALITY_PRESETS=Object.freeze({balanced:Object.freeze({pixels:50,contact:20,detail:1,grade:1}),performance:Object.freeze({pixels:65,contact:0,detail:.5,grade:0})});
export const QUALITY_NAMES=Object.freeze(['auto','balanced','performance']);
const WINDOW=4,LIMIT=.036,EVERY=.5,CAP=1024,ring=new Float64Array(CAP),sorted=new Float64Array(CAP);
let preset='balanced',effective='balanced',dropped=false,setter=null,head=0,size=0,sum=0,sinceCheck=0;
function clearSamples(){head=size=0;sum=sinceCheck=0;}
function input(setInput,id,value){if(typeof setInput==='function'){setInput(id,value);return;}if(typeof document==='undefined')return;const el=document.getElementById(id);if(!el||Number(el.value)===value)return;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));}
function setDetail(level){for(const m of [garden,orbs])if(typeof m.setDetail==='function')m.setDetail(level);}
function use(name,setInput){const p=QUALITY_PRESETS[name];input(setInput,'pixels',p.pixels);input(setInput,'contact-depth',p.contact);setDetail(p.detail);POST_LOOK.grade.value=p.grade;effective=name;}
// applyQuality(name,{setInput}): name is 'auto', 'balanced' or 'performance' (anything else means balanced).
// setInput(id,value) should set the slider and run the game's input handling; without it the #pixels and
// #contact-depth inputs get their value and an 'input' event directly.
export function applyQuality(name,{setInput}={}){
 preset=QUALITY_NAMES.includes(name)?name:'balanced';if(setInput!==undefined)setter=setInput;
 dropped=false;clearSamples();use(preset==='performance'?'performance':'balanced',setter);
 return snapshot();
}
// autoSample(dt,{onDrop,paused}): call once per rendered frame with the frame gap in seconds. Only acts while the
// preset is 'auto'. Paused frames, zero gaps and stalls over 0.5 s are not sampled. When the median gap of the last
// 4 s is above 36 ms it applies Performance once, calls onDrop(snapshot) and stops sampling. It never raises quality.
export function autoSample(dt,{onDrop,paused=false}={}){
 if(preset!=='auto'||dropped)return false;
 if(paused){clearSamples();return false;}
 if(!(dt>0)||dt>.5)return false;
 if(size===CAP){sum-=ring[head];size--;}
 ring[(head+size)%CAP]=dt;size++;sum+=dt;sinceCheck+=dt;
 while(size>1&&sum-ring[head]>=WINDOW){sum-=ring[head];head=(head+1)%CAP;size--;}
 if(sum<WINDOW&&size<CAP||sinceCheck<EVERY)return false;
 sinceCheck=0;for(let i=0;i<size;i++)sorted[i]=ring[(head+i)%CAP];const view=sorted.subarray(0,size).sort(),median=size%2?view[size>>1]:(view[size/2-1]+view[size/2])/2;
 if(median<=LIMIT)return false;
 dropped=true;clearSamples();use('performance',setter);
 try{onDrop?.({...snapshot(),median});}catch(error){console.warn('Quality onDrop failed:',error);}
 return true;
}
export function current(){return preset;}
export function snapshot(){return {preset,effective,dropped,...QUALITY_PRESETS[effective]};}
export const quality={get current(){return preset;},get effective(){return effective;},get dropped(){return dropped;}};
