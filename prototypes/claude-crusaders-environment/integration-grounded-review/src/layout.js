// All coordinates in world metres; foot Y is the top of a supporting surface.
// Runtime geometry and collision share these records. No decorative fake stairs.
export const SCALE={horizontal:2.2,vertical:1.35};
export const TUNE={speed:12,radius:.55,height:2.1,step:.22,gravity:24,flightSeconds:7.5,flightLift:100,flightSpeed:85,climbSpeed:45,padRadius:7.5};
export const DESTINATIONS=[
 {id:'bright',name:'Dawn castle',x:-250,z:0,y:0,kind:'castle',dark:false},
 {id:'island',name:'Silo island',x:0,z:-330,y:-3,kind:'island'},
 {id:'dark',name:'Dusk castle',x:250,z:0,y:0,kind:'castle',dark:true}
];
export function makeLayout(scaled=true){
 const surfaces=[],walls=[],decor=[],pads=[],roofs=[];
 for(const d of DESTINATIONS){
  const surface=(name,x,z,w,l,y,slope=0)=>{const s={id:d.id+':'+name,destination:d.id,name,x:x+d.x,z:z+d.z,w,l,y:y+d.y,slope};surfaces.push(s);return s;};
  const wall=(name,x,z,w,l,bottom,top)=>walls.push({id:d.id+':'+name,destination:d.id,x:x+d.x,z:z+d.z,w,l,bottom:bottom+d.y,top:top+d.y});
  if(d.kind==='castle'){
   surface('arrival court',0,-3,68,66,0);
   surface('main courtyard',0,-1,40,22,4);
   for(const x of [-16,16])surface('court ramp '+x,x,16,6,12,2,-4/12);
   surface('upper terrace',0,-21,44,14,10);
   for(const x of [-18,18])surface('terrace ramp '+x,x,-8,6,12,7,-6/12);
   for(const x of [-27,27]){
    surface('sky gallery '+x,x,-10,10,36,10);
    surface('tower ramp '+x,x,-14,5,12,13,-6/12);
    surface('tower crown '+x,x,-25,10,10,16);
    // North/side parapets leave the south ramp opening usable.
    wall('crown back '+x,x,-29.8,10,.6,16,17.3);
    wall('crown side '+x,x+(x<0?-4.8:4.8),-25,.6,10,16,17.3);
    wall('gallery outer '+x,x+(x<0?-4.8:4.8),-10,.55,36,10,11.2);
    for(const z of [-26,-4,7])wall('pier '+x+' '+z,x,z,1.5,1.5,0,9.5);
   }
   // Solid keep; visitors walk around it. Roof is intentionally inaccessible.
   wall('keep',0,-23,13,10,10,23);
+   roofs.push({id:d.id+':keep-roof',destination:d.id,x:d.x,z:d.z-23,bottom:d.y+23,top:d.y+31,radius:11,sides:4,rotation:Math.PI/4,scaleZ:.85});
   wall('upper rear parapet',0,-27.8,44,.5,10,11.2);
   wall('courtyard well',0,-1,3.4,3.4,4,5.5);
   wall('crate',7,4,3,3,4,6.5);
   wall('outer west',-33.7,-3,.6,66,0,2);
   wall('outer east',33.7,-3,.6,66,0,2);
   wall('outer north',0,-35.7,68,.6,0,2);
   // South cliff has an open centre so falls/recovery can be inspected.
   wall('south left',-23,29.7,22,.6,0,2);wall('south right',23,29.7,22,.6,0,2);
   // Thin floor volumes block walking through deck edges, but leave space below.
  }else{
   surface('silo field',0,0,80,64,0);
   surface('lookout',0,-21,22,14,5);
   surface('lookout ramp',0,-7,7,14,2.5,-5/14);
   for(const [i,x,z] of [[1,-24,-17],[2,24,-17],[3,-24,10],[4,24,10]]){
    roofs.push({id:d.id+':silo-roof-'+i,destination:d.id,x:x+d.x,z:z+d.z,bottom:d.y+8,top:d.y+11.4,radius:3.7,sides:8,rotation:0,scaleZ:1});
+    wall('silo '+i,x,z,5.5,5.5,0,8);decor.push({type:'silo',number:i,x:x+d.x,z:z+d.z,y:d.y,destination:d.id});
   }
   wall('lookout left',-10.8,-21,.5,14,5,6.2);wall('lookout right',10.8,-21,.5,14,5,6.2);
  }
  const p={id:d.id,destination:d.id,x:d.x,z:d.z+24,y:d.y,name:d.name};pads.push(p);
 }
 for(const s of surfaces)if(!s.slope&&s.name!=='arrival court'&&s.name!=='silo field')walls.push({id:s.id+':deck',destination:s.destination,x:s.x,z:s.z,w:s.w,l:s.l,bottom:s.y-.5,top:s.y,deck:true});
 if(scaled)for(const records of [surfaces,walls,decor,pads,roofs])for(const r of records){const d=DESTINATIONS.find(d=>d.id===r.destination),h=SCALE.horizontal,v=SCALE.vertical;r.x=d.x+(r.x-d.x)*h;r.z=d.z+(r.z-d.z)*h;if('y'in r)r.y=d.y+(r.y-d.y)*v;if('radius'in r)r.radius*=h;if('w'in r)r.w*=h;if('l'in r)r.l*=h;if('slope'in r)r.slope*=v/h;if('bottom'in r)r.bottom=d.y+(r.bottom-d.y)*v;if('top'in r)r.top=d.y+(r.top-d.y)*v;}
 return {destinations:DESTINATIONS,surfaces,walls,decor,pads,roofs};
}
export const contains=(s,x,z,margin=0)=>Math.abs(x-s.x)<=s.w/2+margin&&Math.abs(z-s.z)<=s.l/2+margin;
export const heightAt=(s,z)=>s.y+(z-s.z)*s.slope;

// The widest overlapping cone section determines upright body contact.
// Matches ConeGeometry vertices, including local Z scale before Y rotation.
export function roofBlocked(r,x,z,y,height=TUNE.height,radius=TUNE.radius){
 const low=Math.max(y,r.bottom);
 if(low>=Math.min(y+height,r.top)-1e-5)return false;
 const extent=r.radius*(r.top-low)/(r.top-r.bottom),c=Math.cos(r.rotation),s=Math.sin(r.rotation),points=[];
 for(let i=0;i<r.sides;i++){const a=i*2*Math.PI/r.sides,px=Math.sin(a)*extent,pz=Math.cos(a)*extent*r.scaleZ;points.push([r.x+c*px+s*pz,r.z-s*px+c*pz]);}
 let inside=true,nearest=Infinity;
 for(let i=0;i<points.length;i++){
  const [ax,az]=points[i],[bx,bz]=points[(i+1)%points.length],dx=bx-ax,dz=bz-az;
  if(dx*(z-az)-dz*(x-ax)>1e-8)inside=false;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  nearest=Math.min(nearest,Math.hypot(x-ax-t*dx,z-az-t*dz));
 }
 return inside||nearest<radius-1e-5;
}
