import * as T from '../vendor/three.module.js';

// Original game-world construction: a faceted charge held inside a metal cradle.
// Motion is visual; this module does not invent a charge meter or combat rules.
export function chargeOrb(parent,mats,{x=0,y=0,z=0,radius=2.7,color=0x8ce9ef,crown=false,phase=0}={}){
 const root=new T.Group();root.position.set(x,y,z);root.name=crown?'Secured castle heart':'Charging orb';parent.add(root);
 const geometry=new T.IcosahedronGeometry(radius,2),colors=[],tint=new T.Color(color);
 for(let i=0;i<geometry.attributes.position.count;i++){const shade=.64+.36*((Math.floor(i/3)*17%29)/28);colors.push(tint.r*shade,tint.g*shade,tint.b*shade);}
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 const core=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true}));root.add(core);
 const beltMaterial=new T.MeshBasicMaterial({color}),innerMaterial=new T.MeshBasicMaterial({color:0xe8efcc});
 const orbit=new T.Group();orbit.rotation.set(.42,0,.37);root.add(orbit);
 const halo=new T.Mesh(new T.TorusGeometry(radius*1.53,radius*.038,4,64),beltMaterial);halo.rotation.x=Math.PI/2;orbit.add(halo);
 const outer=new T.Mesh(new T.TorusGeometry(radius*1.72,radius*.016,3,64),innerMaterial);outer.rotation.x=Math.PI/2;orbit.add(outer);
 const count=crown?72:40,particles=new T.InstancedMesh(new T.OctahedronGeometry(radius*.075,0),innerMaterial,count),dummy=new T.Object3D();orbit.add(particles);particles.instanceMatrix.setUsage(T.DynamicDrawUsage);particles.frustumCulled=false;
 const cradle=new T.Group();root.add(cradle);const radiusBase=radius*1.16;
 function part(g,m,px,py,pz){const o=new T.Mesh(g,m);o.position.set(px,py,pz);cradle.add(o);return o;}
 function bar(a,b,width,material=mats.edge){const start=new T.Vector3(...a),end=new T.Vector3(...b),o=part(new T.CylinderGeometry(width,width,start.distanceTo(end),6),material,...start.clone().add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;}
 const foot=part(new T.CylinderGeometry(radiusBase*1.08,radiusBase*1.22,radius*.22,8),mats.dark,0,-radius*1.48,0);
 for(let j=0;j<4;j++){
  const a=j*Math.PI/2+Math.PI/4,ux=Math.cos(a),uz=Math.sin(a),levels=crown?[[1.3,-1.4],[1.42,-.25],[1.05,.78],[.52,1.06]]:[[1.3,-1.4],[1.35,-.5],[.95,-.15]];
  for(let k=1;k<levels.length;k++){const p=levels[k-1],q=levels[k];bar([ux*p[0]*radius,p[1]*radius,uz*p[0]*radius],[ux*q[0]*radius,q[1]*radius,uz*q[0]*radius],radius*(crown?.065:.055));}
  part(new T.BoxGeometry(radius*.23,radius*.25,radius*.23),mats.roof,ux*radiusBase,-radius*1.38,uz*radiusBase);
 }
 if(crown){const band=part(new T.TorusGeometry(radius*1.43,radius*.07,6,48),mats.edge,0,-radius*.25,0);band.rotation.x=Math.PI/2;}
 const maskMaterial=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}),coreMask=new T.Mesh(geometry,maskMaterial);coreMask.scale.setScalar(1.025);root.add(coreMask);const ringMask=new T.Mesh(halo.geometry,maskMaterial.clone());ringMask.rotation.copy(halo.rotation);ringMask.scale.setScalar(1.07);orbit.add(ringMask);let warning=0;
 let drive=0,spin=0,previousTime=null;
 function setCharge(value){drive=Math.max(0,Math.min(1,value||0));}
 function update(time){
  const dt=previousTime===null?0:Math.max(0,Math.min(.1,time-previousTime));previousTime=time;
  spin+=dt*(1+drive*drive*15);const spinTime=spin;

  const glow=warning*(.65+.35*Math.sin(time*24));coreMask.material.color.set(0xffffff);ringMask.material.color.set(0xffffff);coreMask.material.opacity=glow*.8;ringMask.material.opacity=glow;coreMask.rotation.copy(core.rotation);
  core.rotation.set(spinTime*.14+phase,spinTime*.33+phase,spinTime*.09);
  halo.scale.setScalar(1+drive*.045*Math.sin(spinTime*.6));orbit.rotation.y=spinTime*.2;orbit.rotation.x=.42+Math.sin(time*.22+phase)*.09;orbit.rotation.z=.37+Math.cos(time*.17+phase)*.1;
  for(let i=0;i<count;i++){
   const angle=spinTime*(i%3===0?.7:.44)+i*2.399+phase,r=radius*(1.38+(i%7)/18),h=Math.sin(angle*2+i)*radius*.035;
   dummy.position.set(Math.cos(angle)*r,h,Math.sin(angle)*r);dummy.rotation.set(angle,angle*.6,0);dummy.scale.setScalar((.48+(i%5)*.18)*(1+drive*.5));dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);
  }particles.instanceMatrix.needsUpdate=true;
 }
 update(0);return {root,core,orb:core,halo,orbit,particles,cradle,foot,radius,crown,update,setCharge,setWarning(value){warning=Math.max(0,Math.min(1,value||0));},get warning(){return warning;}};
}
