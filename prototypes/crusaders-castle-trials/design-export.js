import {COSTS} from './loop.js';
import {assertTrialsPieces} from './piece-support.js';
export const DESIGN_OPTIONS=Object.freeze({level:20,material:'fortress'});
export function exportDesign(layout){
 if(!Array.isArray(layout)||layout.length>432)throw Error('Export needs a compact Castle Trials layout (at most 432 pieces).');
 assertTrialsPieces(layout);
 const cells=new Set();let cores=0;
 const copy=layout.map((p,i)=>{
  if(!p||Object.keys(p).some(k=>!['x','z','layer','type','rotation','solid','footprint'].includes(k)))throw Error(`Piece ${i+1} has unsupported fields; nothing was dropped.`);
  if(!Object.hasOwn(COSTS,p.type)||!['x','z','layer','rotation'].every(k=>Number.isInteger(p[k]))||p.x<0||p.x>11||p.z<0||p.z>11||p.layer<0||p.layer>2||p.rotation<0||p.rotation>3)throw Error(`Piece ${i+1} is not an exportable Castle Trials piece.`);
  if(p.solid!==undefined&&typeof p.solid!=='boolean'||p.footprint!==undefined&&p.footprint!=='round')throw Error(`Piece ${i+1} has invalid geometry options.`);
  const key=`${p.x}:${p.z}:${p.layer}`;if(cells.has(key))throw Error('Duplicate plot cell; nothing was dropped.');cells.add(key);if(p.type==='core')cores++;
  return {...p};
 });
 if(cores!==1)throw Error('Export requires exactly one main core. Complete your design first.');
 const design={format:'crusaders-layout',version:1,layout:copy,options:{...DESIGN_OPTIONS},source:'crusaders-castle-trials'};
 const text=JSON.stringify(design,null,2),bytes=new TextEncoder().encode(text).length;
 if(bytes>=200000)throw Error('Export must be under 200,000 bytes.');
 return {design,text,bytes};
}

