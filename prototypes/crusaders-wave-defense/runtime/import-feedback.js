import {cellPosition} from './castle-rules.js';
export function cellText(cell){return cell?`cell (${cell.x}, ${cell.z}), layer ${cell.layer}`:'design';}
export class DesignRejection extends Error{
 constructor(issues,stage='design'){super(issues.map(i=>`${i.message} ${cellText(i.cell)}. ${i.suggestion||''}`).join('\n'));this.issues=issues;this.stage=stage;}
}
export function approachIssues(layout){
 const walls=layout.filter(p=>['wall','gate','curvedWall'].includes(p.type)),core=layout.find(p=>p.type==='core'),issues=[];
 if(!core)return [{code:'main-core',message:'Exactly one MAIN core is required.',suggestion:'Place MAIN on a supported floor.'}];
 if(!walls.length)return [{code:'perimeter',message:'No castle perimeter is defined.',cell:core,suggestion:'Place outer walls and one supported outward gate in each cardinal sector.'}];
 const directions=[[0,-1],[1,0],[0,1],[-1,0]],names=['NORTH','EAST','SOUTH','WEST'],limits=[Math.min(...walls.map(p=>p.z)),Math.max(...walls.map(p=>p.x)),Math.max(...walls.map(p=>p.z)),Math.min(...walls.map(p=>p.x))];
 for(let sector=0;sector<4;sector++){const [dx,dz]=directions[sector],axis=dx?'x':'z',edge=walls.filter(p=>p[axis]===limits[sector]),gates=edge.filter(p=>p.type==='gate'&&p.layer===0&&p.rotation%2===(dx?1:0));
  if(!gates.length){const cell=edge.find(p=>p.layer===0)||edge[0];issues.push({code:'missing-gate',sector:names[sector],cell,message:`${names[sector]} has no correctly oriented outer ground gate.`,suggestion:`Choose an edge ground cell at ${axis}=${limits[sector]}; place Gate with rotation ${dx?'1 or 3':'0 or 2'}. Keep its opening clear.`});continue;}
  if(!gates.some(g=>layout.some(p=>p.x===g.x+dx&&p.z===g.z+dz&&p.layer===0&&['floor','terrace','spawn','deck','battlement'].includes(p.type)))){const g=gates[0];issues.push({code:'missing-exterior-floor',sector:names[sector],cell:{x:g.x+dx,z:g.z+dz,layer:0},message:`${names[sector]} gate has no supported exterior arrival tile.`,suggestion:'Place a real ground floor here, connected through this gate to MAIN; expand the plot if this coordinate is outside its bounds.'});}
 }return issues;
}
export function physicalIssues(result){return result.issues.map(i=>({...i,message:i.message,suggestion:i.suggestion||'Use the castle walking check to connect this objective with continuous floors/stairs and clear headroom.'}));}
