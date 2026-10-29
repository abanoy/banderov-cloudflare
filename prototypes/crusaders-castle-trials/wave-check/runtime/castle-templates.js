import {profile,containsCell,cellPosition,MAX_PARTS} from './castle-rules.js';

// These are editable local designs. Roles describe their geometry, not online
// balance or earned unlocks. Each ten-level band is a fresh composition.
const FAMILIES=[
 {id:'rampart',name:'Rampart',role:'Outer defense',strength:'A projecting artillery bastion and broad outer court screen offset inner wards.',weakness:'Outward batteries leave fewer close defenses around the inner keep.'},
 {id:'sanctuary',name:'Sanctuary',role:'Inner defense',strength:'Broad garden baileys, turning gates and a sheltered upper redoubt guard the crown.',weakness:'Its open planted forecourt carries fewer heavy batteries.'},
 {id:'skyharbor',name:'Skyharbor',role:'Movement and range',strength:'Dockside stone yards connect small timber quays, signal posts and a high keep.',weakness:'The exposed outer quays have less cover than the enclosed stone courts.'}
];
const NAMES={
 rampart:['Border Watch','Twin Gate Ward','March Bastion','Four Winds Wall','Crown Rampart','High Battery','Stone Meridian','Grand Curtain','Horizon Bastion','Tenfold Citadel'],
 sanctuary:['Garden Refuge','Cloister Court','Heart Ward','Three Courts','Quiet Redoubt','Crown Cloister','Terraced Sanctuary','High Reliquary','Seven Gardens','Sanctuary of the Crown'],
 skyharbor:['Signal Quay','Twin Moorings','Trade Winds','Lantern Docks','Sky Arcade','Admiral Terrace','Cloud Causeways','High Anchorage','Horizon Fleet','Crown Skyport']
};
const copy=o=>JSON.parse(JSON.stringify(o));
export function templateCatalog(options){const config=profile(options),band=Math.ceil(config.level/10);return FAMILIES.map(f=>({...f,family:f.name,name:NAMES[f.id][band-1],title:NAMES[f.id][band-1],band,levelMin:band*10-9,levelMax:band*10,layers:Math.max(2,band),size:config.size}));}

// Broad offset baileys carry the open yards. Intermediate storeys belong to
// turning stair lanes and a compact rear keep, never nine concentric rings.
export function buildTemplate(id,options){
 const config=profile(options),descriptor=templateCatalog(options).find(f=>f.id===id);if(!descriptor)throw new Error('Choose Rampart, Sanctuary or Skyharbor.');
 const {minX:L,maxX,minZ:B,maxZ}=config,R=maxX-1,F=maxZ-1,top=descriptor.layers-1;
 let compositionStep=0;const seed=Number(options?.seed)||0,random=()=>{const n=(Math.imul(seed+1,2654435761)^Math.imul(++compositionStep,2246822519))>>>0;return n/4294967296;};
 const cells=new Map(),extras=new Map(),reserved=new Set(),objectives=[],routes=[],tiers=[],key=(x,z)=>x+':'+z;
 const put=(x,z,layer,type='terrace',rotation=0)=>{if(containsCell({x,z},config)&&layer>=0&&layer<=top)cells.set(key(x,z),{x,z,layer,type,rotation,solid:true});};
 const rect=(left,right,back,front,layer,cut=1)=>{if(seed){left=Math.max(L+1,left+Math.floor(random()*3)-1);right=Math.min(R-1,right+Math.floor(random()*3)-1);back=Math.max(B+1,back+Math.floor(random()*3)-1);random();cut=random()>.4?1:0;}tiers.push({left,right,back,front,layer});for(let x=left;x<=right;x++)for(let z=back;z<=front;z++)if(!((x===left||x===right)&&(z===back||z===front)&&cut))put(x,z,layer);};
 const point=(x,z,layer)=>cellPosition({x,z,layer});
 const lane=(x,z,layer,type='terrace',rotation=0)=>{put(x,z,layer,type,rotation);reserved.add(key(x,z));return point(x,z,layer);};
 const line=(x0,z0,x1,z1,layer)=>{const points=[];if(seed&&random()>.5&&x0!==x1&&z0!==z1){for(let z=z0;;z+=Math.sign(z1-z0)){points.push(lane(x0,z,layer));if(z===z1)break;}for(let x=x0;x!==x1;){x+=Math.sign(x1-x0);points.push(lane(x,z1,layer));}return points;}for(let x=x0;;x+=Math.sign(x1-x0)){points.push(lane(x,z0,layer));if(x===x1)break;}for(let z=z0;z!==z1;){z+=Math.sign(z1-z0);points.push(lane(x1,z,layer));}return points;};
 const objective=(name,label,x,z,layer)=>{reserved.add(key(x,z));objectives.push({id:name,label,...point(x,z,layer)});};
 const ascent=[{x:22,y:.77,z:74},point(8,10,0)];let coreX,coreZ,crownLayer=top,arrivalX,arrivalZ;
 lane(8,F,0,'gate');lane(8,10,0);objective('entrance','Main gate approach',8,10,0);
 if(top<=2){
  rect(L+1,R-1,B+1,7,1);ascent.push(lane(8,8,0,'stairs'),lane(8,7,1));
  if(top===2){rect(L+2,R-2,B+2,5,2);ascent.push(lane(8,6,1,'stairs'),lane(8,5,2));}
  arrivalX=8;arrivalZ=top===2?5:7;coreX=top===2?4:5;coreZ=B+2;
  objective('outer-court','Lower entrance court',6,9,0);
 }else{
  const left=id==='skyharbor'?L+3:L+2,right=id==='skyharbor'?R-1:R-2;
  rect(left,right,Math.max(B+3,-1),8,1);
  if(id==='rampart')rect(L+1,L+5,6,10,1);
  else if(id==='sanctuary'&&config.size>=22)rect(L+1,L+6,2,7,1);
  rect(id==='skyharbor'?L+1:L+2,5,B+2,2,3);
  const upper=Math.min(5,top),upperFront=top===4?0:top===5?-2:-4;
  if(top>=4)rect(2,id==='skyharbor'?R-1:R-3,B+2,upperFront,upper);
  const turnX=seed?Math.floor(random()*3)-1:0;
  ascent.push(lane(8,9,0,'stairs'),lane(8,8,1),...line(8,7,turnX,7,1),lane(turnX,6,1),lane(turnX,5,1,'stairs'),lane(turnX,4,2),lane(turnX,3,2,'stairs'),lane(turnX,2,3));
  objective('outer-court','Great forecourt',4,4,1);
  objective('middle-bailey',id==='sanctuary'?'Western garden bailey':'Middle walled bailey',top===3?4:Math.max(L+3,-2),top===3?2:0,3);
  if(top===3){coreX=1;coreZ=B+3;arrivalX=turnX;arrivalZ=2;}
  else{
   ascent.push(...line(turnX,2,turnX,upperFront,3),...line(turnX,upperFront,1,upperFront,3));
   for(let l=3;l<upper;l++){const x=1+2*(l-3);ascent.push(lane(x,upperFront,l,'stairs',3),lane(x+1,upperFront,l+1));}
   arrivalX=2*(upper-3);arrivalZ=upperFront;
   objective('upper-court','Upper crown court',arrivalX,upperFront,upper);
   if(top===4||top===5){coreX=top===4?6:8;coreZ=B+4;}
   else{
    const side=R-2-(seed?Math.floor(random()*2):0),keepEnd=upperFront-2*(top-5);coreX=side-5;coreZ=keepEnd-1;
    rect(side-6,side,keepEnd-3,keepEnd+2,top);
    if(top>=8)rect(side-7,side-4,keepEnd-3,keepEnd+2,top-2);
    // The long court crossing and the stair's narrow side landings cut only
    // their own columns into the keep body, leaving the broad wards intact.
    ascent.push(...line(arrivalX,upperFront,side,upperFront,5));
    for(let l=5;l<top;l++){const z=upperFront-1-2*(l-5);ascent.push(lane(side,z,l,'stairs'),lane(side,z-1,l+1));}
    arrivalX=side;arrivalZ=keepEnd;
    if(top>=8){
     // The lower keep shoulder is an intentional usable walk, reached from
     // its matching side-stair landing rather than stranded behind the keep.
     const shoulder=top-2,row=upperFront-2*(shoulder-5);
     const prior=new Map(cells);
     line(side,row,side-7,row,shoulder);line(side-7,row,side-7,keepEnd-2,shoulder);
     for(const [k,p] of prior){const next=cells.get(k);if(p.layer===5&&next?.layer===shoulder&&next.layer>p.layer)extras.set(k+':5',{x:p.x,z:p.z,layer:5,type:'floor',rotation:0});}
    }
    if(id==='skyharbor')lane(R-1,upperFront,5);
   }
  }
 }
 put(coreX,coreZ,crownLayer,'core');reserved.add(key(coreX,coreZ));
 // All approaches stand beyond the real 13.5m cradle rather than under it.
 const approachX=top<=2?8:top===3?4:coreX+3,approachZ=top<=2?coreZ+2:top===3?coreZ+2:coreZ+2;
 ascent.push(...line(arrivalX,arrivalZ,approachX,arrivalZ,top),...line(approachX,arrivalZ,approachX,approachZ,top));
 objective('highest-gallery',top>5?'Keep roof landing':'Upper bailey landing',arrivalX,arrivalZ,top);
 objective('heart-approach','Secured crown approach',approachX,approachZ,top);
 routes.push({id:'highest-gallery',label:'Turning procession through offset courts to the crown',points:ascent});
 if(id==='skyharbor'){
  const row=top<=2?7:6;
  for(let x=R-2;x<=R;x++){lane(x,row,1,'deck');put(x,row-1,1,'deck');}
  objective('east-quay','Eastern timber quay',R,row,1);
  if(top>=3){for(let x=L;x<=L+3;x++){lane(x,6,1,'deck');put(x,7,1,'deck');}objective('west-quay','Western courier quay',L,6,1);}
 }else if(id==='rampart'&&top>=3){line(L+3,9,L+3,7,1);line(L+3,7,4,7,1);objective('outer-bastion','Forward artillery bastion',L+3,9,1);}
 const safe=(x,z)=>!reserved.has(key(x,z))&&Math.hypot(x-coreX,z-coreZ)>2.6;
 const decorate=(x,z,type,rotation=0)=>{const p=cells.get(key(x,z));if(p&&safe(x,z))put(x,z,p.layer,type,rotation);};
 for(const p of [...cells.values()])if(p.type==='terrace'&&safe(p.x,p.z)){
  const outward=[[0,1,2],[1,0,3],[0,-1,0],[-1,0,1]].find(([dx,dz])=>(cells.get(key(p.x+dx,p.z+dz))?.layer??0)<p.layer);
  if(outward)decorate(p.x,p.z,'battlement',outward[2]);
 }
 const roofed=(x,z,layer,type='tower',rotation=0)=>{if(!containsCell({x,z},config)||!safe(x,z)||layer>=top)return;put(x,z,layer,type,rotation);extras.set(x+':'+z+':'+(layer+1),{x,z,layer:layer+1,type:'roof',rotation});};
 // Contiguous blue-roofed halls and substantial gateway groups inhabit the
 // court edges. Their floors are ordinary editable parts, not fused scenery.
 for(const x of [6,10])roofed(x,F,0);
 for(const x of [7,9])put(x,F,0,'wall');
 extras.set('gate-roof',{x:8,z:F,layer:1,type:'roof',rotation:0});
 if(top<=2){put(L+1,9,0,'garden');put(R-1,9,0,'cannon');if(id==='skyharbor')put(R,8,0,'beacon');}
 for(const tier of tiers){
  const {left,right,back,front,layer}=tier;if(layer===top)continue;
  const hallX=id==='rampart'?right-1:left+1,midZ=Math.round((back+front)/2);
  for(let z=midZ-1;z<=midZ+1;z++){const p=cells.get(key(hallX,z));if(p?.layer===layer)roofed(hallX,z,layer,'wall',1);}
  for(const [x,z] of [[left+1,front-1],[right-1,back+1]])if(cells.get(key(x,z))?.layer===layer)roofed(x,z,layer);
  for(const x of [left+2,right-2])for(const z of [front-2,back+2]){
   if(cells.get(key(x,z))?.layer!==layer)continue;
   const ornamental=id==='sanctuary'||(x+z)%3===0;
   decorate(x,z,ornamental?'garden':id==='skyharbor'?'beacon':descriptor.band>=5?'heavyCannon':'cannon',x<5?3:1);
  }
 }
 if(top>=3){
  const p=cells.get(key(0,2));if(p)put(0,2,p.layer,'gate');
  if(top>=4){const x=2*(Math.min(5,top)-3),z=top===4?0:top===5?-2:-4,p=cells.get(key(x,z));put(x,z,p.layer,'gate',1);}
  for(const [x,z] of [[L+2,7],[R-2,7],[L+2,B+3]]){const p=cells.get(key(x,z));if(p)roofed(x,z,p.layer);}
 }
 if(top>5){
  const side=R-2,end=arrivalZ;
  for(const [x,z] of [[side,end-3],[side-6,end+2],[side-1,end+2]])roofed(x,z,top-1);
  // A larger roofed shoulder makes the upper keep a recognisable occupied
  // building around its open crown terrace, without roofing over the route.
  for(let x=side-6;x<=side-4;x++)roofed(x,end-4,top-1,'wall');
  for(let z=end-2;z<=end;z++)roofed(side-8,z,top-1,'wall',1);
 }
 // Garden-biased Sanctuary still has a deliberate battery covering its inner
 // yard. It replaces an existing edge ornament outside the reserved approach.
 if(id==='sanctuary'&&top>=3){
  const tx=top===3?5:R-3,tz=top===3?0:(top===4?0:top===5?-2:-4)-2;
  const battery=[...cells.values()].filter(p=>p.layer===Math.min(5,top)&&['terrace','garden','battlement'].includes(p.type)&&safe(p.x,p.z)).sort((a,b)=>(a.x-tx)**2+(a.z-tz)**2-((b.x-tx)**2+(b.z-tz)**2)||a.z-b.z||a.x-b.x)[0];
  if(battery)decorate(battery.x,battery.z,'cannon');
 }
 // Rounded corners are landmarks off the circulation lanes. Their circular
 // tops do not replace a required broad landing or the turning gate approach.
 const outer=tiers[0],corners=[[outer.left,outer.front,3],[outer.right,outer.front,0],[outer.left,outer.back,2],[outer.right,outer.back,1]];
 for(const [i,[x,z,rotation]] of corners.entries())if(!cells.has(key(x,z))&&safe(x,z))put(x,z,outer.layer,i%2?'roundTerrace':'curvedWall',rotation);
 if(![...cells.values()].some(p=>p.type==='curvedWall')){const corner=[...cells.values()].find(p=>p.layer===outer.layer&&p.type==='battlement'&&safe(p.x,p.z)&&(p.x===outer.left||p.x===outer.right));if(corner)put(corner.x,corner.z,corner.layer,'curvedWall',corner.x===outer.left?3:0);}
 const roundGun=[...cells.values()].find(p=>p.layer>0&&['cannon','heavyCannon','beacon'].includes(p.type)&&safe(p.x,p.z));
 if(roundGun)roundGun.footprint='round';
 // Rough retaining toes take one otherwise empty ground cell. The half-wall
 // wedge faces the adjacent raised masonry, leaving the gate/pod aisle clear.
 const groundAisle=new Set();for(let x=3;x<=8;x++)groundAisle.add(key(x,10));for(const z of [9,10,11]){groundAisle.add(key(8,z));if(id==='rampart')groundAisle.add(key(3,z));}
 const banks=new Map();
 for(const p of cells.values())if(p.layer>0)for(const [dx,dz,rotation] of [[-1,0,3],[1,0,1],[0,-1,2],[0,1,0]]){
  const x=p.x+dx,z=p.z+dz,k=key(x,z);
  if(!containsCell({x,z},config)||cells.has(k)||reserved.has(k)||groundAisle.has(k))continue;
  if(!banks.has(k)||banks.get(k).height<p.layer)banks.set(k,{x,z,rotation,height:p.layer});
 }
 const available=MAX_PARTS-cells.size-extras.size,bankList=[...banks.values()].sort((a,b)=>Math.atan2(a.z-(B+F)/2,a.x-5.5)-Math.atan2(b.z-(B+F)/2,b.x-5.5)||a.x-b.x||a.z-b.z),count=Math.min(available,bankList.length);
 for(let i=0;i<count;i++){const p=bankList[Math.floor(i*bankList.length/count)];put(p.x,p.z,0,'embankment',p.rotation);}
 let layout=[...cells.values(),...extras.values()];
 if(id==='rampart'){
  layout=layout.map(p=>p.z===F?p:({...p,x:11-p.x,rotation:((p.type==='curvedWall'?7:4)-p.rotation)%4}));
  // The broad outer curtain reverses its inner wards, while the familiar
  // ring-facing entrance and pod approach stay in their original position.
  for(const p of objectives)if(p.id!=='entrance')p.x=-p.x;
  for(const route of routes)for(let i=2;i<route.points.length;i++)route.points[i].x=-route.points[i].x;
 }
 // Library forecourts used to rely on the removed automatic plot slab.
 // Author their landing apron explicitly, including the reversed Rampart entrance.
 for(let x=L+1;x<R;x++)for(let z=9;z<=10;z++)if(!layout.some(p=>p.x===x&&p.z===z&&p.layer===0))layout.push({x,z,layer:0,type:'floor',rotation:0});
 if(layout.length>MAX_PARTS){let excess=layout.length-MAX_PARTS;layout=layout.filter(p=>{if(excess&&p.type==='embankment'){excess--;return false;}return true;});}
 // Every array/object is freshly authored for this call; applying or editing
 // one castle cannot alter the library or the other home's saved construction.
 if(layout.length>MAX_PARTS)throw new Error('Template exceeds the part budget.');
 return {...copy(descriptor),layout,objectives,routes,profile:{...config},tiers,parts:layout.length,architecture:'Offset walled baileys and a high keep'};
}

