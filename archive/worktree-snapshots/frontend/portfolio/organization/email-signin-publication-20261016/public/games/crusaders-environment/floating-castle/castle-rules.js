// Pure build rules. Legacy grid coordinates stay fixed as the plot expands.
export const LEGACY_GRID=12,CELL=8,LAYERS=10,MAX_PARTS=720;
export const MATERIALS=Object.freeze([
 {id:'auto',label:'By level'},
 {id:'wood',label:'Timber stronghold'},
 {id:'stone',label:'Stone castle'},
 {id:'brick',label:'Brick castle'},
 {id:'fortress',label:'Fortress masonry'}
]);
export function profile(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Choose a valid castle level and material.');
 const level=options.level??20,requested=options.material??'fortress';
 if(!Number.isInteger(level)||level<1||level>100)throw new Error('Castle level must be a whole number from 1 to 100.');
 if(!MATERIALS.some(m=>m.id===requested))throw new Error('Choose timber, stone, brick or fortress masonry.');
 const size=10+2*(Math.ceil(level/10)-1),minX=(12-size)/2,minZ=12-size,unlockedMaterial=level<=10?'wood':level<=30?'stone':level<=60?'brick':'fortress',material=requested==='auto'?unlockedMaterial:requested;
 return {level,size,minX,maxX:minX+size,minZ,maxZ:12,material,materialLabel:MATERIALS.find(m=>m.id===material).label,unlockedMaterial,maxParts:MAX_PARTS};
}
export function containsCell(piece,bounds){return !!piece&&Number.isInteger(piece.x)&&Number.isInteger(piece.z)&&piece.x>=bounds.minX&&piece.x<bounds.maxX&&piece.z>=bounds.minZ&&piece.z<bounds.maxZ;}
export function minimumLevel(layout){
 if(!Array.isArray(layout))throw new Error('A castle layout must be a list of pieces.');
 for(let level=10;level<=100;level+=10)if(layout.every(p=>containsCell(p,profile({level}))))return level;
 throw new Error('This layout extends beyond the maximum castle plot.');
}
export function footprint(bounds){return {minX:(bounds.minX-6)*CELL,maxX:(bounds.maxX-6)*CELL,minZ:(bounds.minZ-6)*CELL-4,maxZ:(bounds.maxZ-6)*CELL-4};}
export function cellPosition(piece){return {x:(piece.x-5.5)*CELL,y:.77+piece.layer*CELL,z:(piece.z-5.5)*CELL-4};}
export function stairClearances(layout){
 return layout.filter(p=>p.type==='stairs'&&p.layer<LAYERS-1).map(p=>({x:p.x,z:p.z,layer:p.layer+1,rotation:p.rotation,width:7.6,depth:5,sourceLayer:p.layer}));
}
