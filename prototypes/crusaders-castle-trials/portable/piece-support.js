import {COSTS} from './loop.js';
export function assertTrialsPieces(layout){
 const unsupported=layout.flatMap((p,i)=>!p||!Object.hasOwn(COSTS,p.type)?[{p,i}]:[]);
 if(!unsupported.length)return;
 const details=unsupported.map(({p,i})=>`${typeof p?.type==='string'?p.type:'invalid type'} at piece ${i+1}${p&&['x','z','layer'].every(k=>Number.isInteger(p[k]))?` (cell ${p.x},${p.z}, layer ${p.layer})`:''}`).join('; ');
 throw Error('Unsupported Castle Trials pieces: '+details+'. Trials supports the new bow, cannon, armed watchtower and trebuchet; this type has no resource/combat definition. No pieces were dropped or converted. Keep the original design.');
}
