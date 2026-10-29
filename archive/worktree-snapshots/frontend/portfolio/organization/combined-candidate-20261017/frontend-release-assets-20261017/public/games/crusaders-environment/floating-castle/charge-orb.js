import * as T from '../vendor/three.module.js';

// Original game-world construction: a faceted charge held inside a metal cradle.
// Motion is visual; this module does not invent a charge meter or combat rules.
export function chargeOrb(parent,mats,{x=0,y=0,z=0,radius=2.7,color=0x8ce9ef,crown=false,phase=0}={}){
 const root=new T.Group();root.position.set(x,y,z);root.name=crown?'Secured castle heart':'Charging orb';parent.add(root);
 const geometry=new T.DodecahedronGeometry(radius,0),colors=[],tint=new T.Color(color);
 for(let i=0;i<geometry.attributes.position.count;i++){const shade=.64+.36*((Math.floor(i/3)*17%29)/28);colors.push(tint.r*shade,tint.g*shade,tint.b*shade);}
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 const core=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true}));root.add(core);
 const beltMaterial=new T.MeshBasicMaterial({color}),innerMaterial=new T.MeshBasicMaterial({color:0xe8efcc});
 const orbit=new T.Group();orbit.rotation.set(.42,0,.37);root.add(orbit);
 const halo=new T.Mesh(new T.TorusGeometry(radius*1.53,radius*.045,6,96),beltMaterial);halo.rotation.x=Math.PI/2;orbit.add(halo);
 const axes=[orbit,new T.Group(),new T.Group()];root.add(axes[1],axes[2]);
 const outer=new T.Mesh(new T.TorusGeometry(radius*1.66,radius*.04,6,96),innerMaterial);axes[1].add(outer);
 const third=new T.Mesh(new T.TorusGeometry(radius*1.78,radius*.04,6,96),beltMaterial);axes[2].add(third);
 const rings=[halo,outer,third];
 const facets=new T.LineSegments(new T.EdgesGeometry(geometry,12),new T.LineBasicMaterial({color:0x365e71,transparent:true,opacity:.6}));core.add(facets);
 for(let i=0;i<3;i++){const bead=new T.Mesh(new T.OctahedronGeometry(radius*.1,0),innerMaterial);bead.position.set(radius*(1.53+i*.125),0,0);axes[i].add(bead);}
 // Closed energy loops keep the outer vortex continuous at every viewing angle.
 const vortex=new T.Group();root.add(vortex);const veilMaterial=new T.MeshBasicMaterial({color,transparent:true,opacity:.15,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
 for(let i=0;i<3;i++){const ribbon=new T.Mesh(new T.TorusGeometry(radius*(1.95+i*.08),radius*.025,4,96),veilMaterial);ribbon.rotation.set(i*.83,.4+i*.8,i*.65);vortex.add(ribbon);}
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
 for(let i=1;i<3;i++){const mask=new T.Mesh(rings[i].geometry,ringMask.material);mask.scale.setScalar(1.07);axes[i].add(mask);}
 let drive=0,spin=0,ringTime=0,previousTime=null;
 function setCharge(value){drive=Math.max(0,Math.min(1,value||0));}
 function update(time){
  const dt=previousTime===null?0:Math.max(0,Math.min(.1,time-previousTime));previousTime=time;
  spin+=dt*(1+drive*drive*15);ringTime+=dt*(1+drive*drive*2.5);const spinTime=spin;

  const glow=warning*(.65+.35*Math.sin(time*24));coreMask.material.color.set(0xffffff);ringMask.material.color.set(0xffffff);coreMask.material.opacity=glow*.8+(1-warning)*(.018+.018*Math.sin(time*2.2+phase));ringMask.material.opacity=glow;coreMask.rotation.copy(core.rotation);
  core.rotation.set(spinTime*.14+phase,spinTime*.33+phase,spinTime*.09);
  halo.scale.setScalar(1+drive*.045*Math.sin(spinTime*.6));orbit.rotation.set(.42+.12*Math.sin(ringTime*.53),ringTime*1.6+phase,.37);axes[1].rotation.set(ringTime*-2.25+phase,.65+.15*Math.sin(ringTime*.37),.2);axes[2].rotation.set(.8,.25+.1*Math.sin(ringTime*.71),ringTime*3.05-phase);vortex.rotation.y=-ringTime*.7;vortex.children.forEach((r,i)=>r.scale.setScalar(1+.025*Math.sin(time*1.7+phase+i)));
  for(let i=0;i<count;i++){
   const angle=spinTime*(i%3===0?.7:.44)+i*2.399+phase,r=radius*(1.38+(i%7)/18),h=Math.sin(angle*2+i)*radius*.035;
   dummy.position.set(Math.cos(angle)*r,h,Math.sin(angle)*r);dummy.rotation.set(angle,angle*.6,0);dummy.scale.setScalar((.48+(i%5)*.18)*(1+drive*.5));dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);
  }particles.instanceMatrix.needsUpdate=true;
 }
 update(0);return {root,core,orb:core,halo,orbit,rings,axes,vortex,particles,cradle,foot,radius,crown,update,setCharge,setWarning(value){warning=Math.max(0,Math.min(1,value||0));},setShieldActive(value){vortex.visible=!!value;},get warning(){return warning;}};
}
