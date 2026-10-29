import {profile,containsCell} from './runtime/castle-rules.js';
import {PARTS} from './runtime/castle-construction.js';
import {DesignRejection} from './runtime/import-feedback.js';
export const MAX_ENEMIES=24;
export function wavePlan(wave,seed=1404){
 let n=(seed+wave*7919)>>>0;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 return Array.from({length:Math.min(MAX_ENEMIES,4+wave*2)},()=>({sector:Math.floor(random()*4),hp:2+Math.floor(wave/4),speed:Math.min(1, .42+wave*.035),damage:4+wave}));
}
export function starterLayout(){const layout=[];for(let x=1;x<11;x++)for(let z=2;z<12;z++){let type='floor',rotation=0;if(x===2&&z>=3&&z<=10||x===9&&z>=3&&z<=10||z===3&&x>=2&&x<=9||z===10&&x>=2&&x<=9){type='wall';rotation=(x===2||x===9)?1:0;if((x===5&&(z===3||z===10))||(z===6&&(x===2||x===9)))type='gate';}if(x===6&&z===6)type='core';layout.push({x,z,layer:0,type,rotation});}return layout;}
export function parseDesign(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>=200000)throw Error('Design JSON must be under 200,000 bytes.');
 const d=JSON.parse(text);if(!d||d.format!=='crusaders-layout'||d.version!==1||!Array.isArray(d.layout))throw Error('Expected crusaders-layout version 1.');
 if(!d.options||!Number.isInteger(d.options.level)||typeof d.options.material!=='string')throw Error('Design options require level 1–100 and a supported material.');
 const config=profile(d.options),cells=new Set(),types=new Set(PARTS.map(p=>p.id)),issues=[];
 if(d.layout.length>720)throw Error('Design exceeds the 720-piece limit.');
 d.layout.forEach((p,index)=>{const cell=p&&{x:p.x,z:p.z,layer:p.layer};if(p&&typeof p.type==='string'&&!types.has(p.type)){issues.push({code:'unsupported-piece',cell,pieceType:p.type,message:`Piece ${index+1}: "${p.type}" is not supported by this Wave geometry pin.`,suggestion:p.type==='trebuchet'?'The newer Environment trebuchet is not integrated with Wave collision, weapons or resource rules. Keep the original design; use a separately edited Wave-compatible copy or wait for a tested armory update. This piece was not discarded.':'Keep the original design and check its source schema; this piece was not discarded or replaced.'});return;}if(!p||Object.keys(p).some(k=>!['x','z','layer','rotation','type','solid','footprint'].includes(k))||!['x','z','layer','rotation'].every(k=>Number.isInteger(p[k]))||!containsCell(p,config)||p.layer<0||p.layer>9||p.rotation<0||p.rotation>3||!types.has(p.type)||p.solid!==undefined&&typeof p.solid!=='boolean'||p.footprint!==undefined&&p.footprint!=='round'){issues.push({code:'piece-definition',cell,message:`Piece ${index+1} has an unsupported field, type, coordinate or geometry option.`,suggestion:'Keep the original file; correct this record to fit the selected plot and supported piece schema. Nothing was discarded.'});return;}const key=`${p.x}:${p.z}:${p.layer}`;if(cells.has(key))issues.push({code:'duplicate-cell',cell,message:'Two pieces occupy the same cell.',suggestion:'Keep one piece on this layer.'});cells.add(key);});
 if(d.layout.filter(p=>p?.type==='core').length!==1)issues.push({code:'main-core',message:'Exactly one MAIN core is required.',suggestion:'Add one core or remove additional cores.'});
 if(issues.length)throw new DesignRejection(issues,'schema');return d;
}

