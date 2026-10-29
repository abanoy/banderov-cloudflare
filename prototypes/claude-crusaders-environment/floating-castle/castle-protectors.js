import * as T from '../vendor/three.module.js';
export const PROTECTOR_HP=600;
// Five twenty-level milestones, plus the second crown-capacity unlock at 100.
export const protectorLimit=level=>Math.max(0,Math.floor(Math.min(100,level)/20))+(level>=100?1:0);
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
export function inspectProtectorLinks(root,solids,target){
 root.updateWorldMatrix(true,true);const links=[],ray=new T.Raycaster();
 root.traverse(group=>{const data=group.userData.protector;if(!data)return;
  const from=data.orb.getWorldPosition(new T.Vector3()),to=target.clone(),direction=to.clone().sub(from),length=direction.length(),self=new Set();group.traverse(o=>self.add(o));
  ray.set(from,direction.normalize());ray.near=.05;ray.far=Math.max(.05,length-8.5);
  const hit=ray.intersectObjects(solids.filter(o=>!self.has(o)&&visible(o)),false)[0],point=hit?hit.point:to;
  links.push({...data,from,to,point,linked:!hit,blocker:hit?.object.userData.wallRole||hit?.object.parent?.name||hit?.object.userData.place||null});
 });return links;
}
export function addProtectorBeams(root,links){
 for(const old of root.children.filter(o=>o.userData.protectorBeam)){root.remove(old);old.geometry.dispose();old.material.dispose();}
 const beams=[];for(const l of links){const material=new T.LineBasicMaterial({color:l.linked?0xb8fff2:0xff715c,transparent:true,opacity:.72}),geometry=new T.BufferGeometry().setFromPoints([root.worldToLocal(l.from.clone()),root.worldToLocal(l.point.clone())]),line=new T.Line(geometry,material);line.userData.protectorBeam=true;line.name=l.linked?'Protector beam':'BLOCKED protector beam';root.add(line);beams.push({line,link:l});}
 return {beams,dispose(){for(const b of beams){root.remove(b.line);b.line.geometry.dispose();b.line.material.dispose();}}};
}
export function protectorReport(links=[]){
 let separation=0,pairs=0;const sectors=new Set();for(let i=0;i<links.length;i++){const a=links[i];sectors.add(Math.floor((Math.atan2(a.from.z-a.to.z,a.from.x-a.to.x)+Math.PI)*2/Math.PI)%4);for(let j=0;j<i;j++){separation+=a.from.distanceTo(links[j].from);pairs++;}}
 return {total:links.length,linked:links.filter(l=>l.linked).length,blocked:links.filter(l=>!l.linked).length,sectors:sectors.size,separation:pairs?Math.round(separation/pairs):0,issues:links.filter(l=>!l.linked).map(l=>({cell:l.cell,message:'Protector beam blocked by '+l.blocker+'. Move the core or clear this direct line.'}))};
}
// Battle beams: the data line (exact endpoints, reused buffer) carries a thin camera-independent ribbon
// cylinder with a stepped travelling pulse in team colour; the 1px line itself is no longer drawn.
const BEAM_GEOMETRY=new T.CylinderGeometry(1,1,1,6,1,true).translate(0,.5,0),BEAM_TIME={value:0},BEAM_UP=new T.Vector3(0,1,0),BEAM_DIR=new T.Vector3();
function beamRibbon(team){return new T.Mesh(BEAM_GEOMETRY,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{beamTime:BEAM_TIME,beamColor:{value:new T.Color(team?0xce82ef:0xb8fff2)},beamLength:{value:1},beamFlow:{value:team?-1:1}},
 vertexShader:'varying float vAlong;void main(){vAlong=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform float beamTime;uniform vec3 beamColor;uniform float beamLength;uniform float beamFlow;varying float vAlong;void main(){float t=floor(beamTime*8.)/8.;float phase=fract(vAlong*beamLength/5.-t*1.6);float band=step(.72,phase);vec3 c=mix(beamColor*.82,mix(beamColor,vec3(1.),.6),band);gl_FragColor=vec4(c,.62+.33*band);}'}));}
export function createBattleProtectors(world,scene){
 let items=[],clock=-1,beams=[];const targetPoint=new T.Vector3();
 function clear(){for(const old of scene.children.filter(o=>o.userData.battleProtectorBeam)){scene.remove(old);old.geometry.dispose();old.material.dispose();for(const ribbon of old.children)ribbon.material.dispose();}for(const b of beams){b.line.parent?.remove(b.line);}beams=[];}
 function reset(){clear();items=[];for(const [team,castle] of world.castles.entries()){castle.updateWorldMatrix(true,true);castle.traverse(o=>{if(o.name==='Protector beam'||o.name==='BLOCKED protector beam')o.visible=false;});castle.traverse(group=>{const data=group.userData.protector;if(!data)return;data.orb.visible=true;if(data.visualRoot)data.visualRoot.visible=true;const point=data.orb.getWorldPosition(new T.Vector3()),item={...data,team,hp:PROTECTOR_HP,maxHp:PROTECTOR_HP,linked:false,point};items.push(item);const line=new T.Line(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(6,3).setUsage(T.DynamicDrawUsage)),new T.LineBasicMaterial({color:team?0xce82ef:0xb8fff2,transparent:true,opacity:.75}));line.userData.battleProtectorBeam=true;line.material.visible=false;const ribbon=beamRibbon(team);ribbon.name='Protector beam ribbon';ribbon.frustumCulled=false;line.add(ribbon);scene.add(line);beams.push({line,item,ribbon});});}clock=-1;update(0);}
 function update(time){BEAM_TIME.value=time;if(time-clock<.2)return;clock=time;for(const [team,castle] of world.castles.entries()){const target=world.castleHearts[team].core.getWorldPosition(new T.Vector3()),links=inspectProtectorLinks(castle,world.solids,target);for(const l of links){const item=items.find(p=>p.id===l.id);if(item){item.point.copy(l.from);item.linked=l.linked;item.blocker=l.blocker;}}}
  for(const {line,item,ribbon} of beams){item.orb.visible=item.hp>0;if(item.visualRoot)item.visualRoot.visible=item.hp>0;line.visible=item.hp>0;const target=world.castleHearts[item.team].core.getWorldPosition(targetPoint),position=line.geometry.attributes.position;position.setXYZ(0,item.point.x,item.point.y,item.point.z);position.setXYZ(1,target.x,target.y,target.z);position.needsUpdate=true;line.geometry.computeBoundingSphere();line.material.color.set(item.linked?(item.team?0xb18ecf:0xb8fff2):0xff715c);line.material.opacity=.55+.2*Math.sin(time*4);BEAM_DIR.set(target.x-item.point.x,target.y-item.point.y,target.z-item.point.z);const length=BEAM_DIR.length()||1e-3;ribbon.position.copy(item.point);ribbon.quaternion.setFromUnitVectors(BEAM_UP,BEAM_DIR.multiplyScalar(1/length));const radius=item.linked?.2:.12;ribbon.scale.set(radius,length,radius);ribbon.material.uniforms.beamLength.value=length;ribbon.material.uniforms.beamColor.value.set(item.linked?(item.team?0xce82ef:0xb8fff2):0xff715c);}}
 return {reset,update,clear(){clear();items=[];},get items(){return items;},snapshot(){return items.map(p=>({id:p.id,team:p.team,hp:p.hp,maxHp:p.maxHp,linked:p.linked,blocker:p.blocker,x:p.point.x,y:p.point.y,z:p.point.z}));}};
}
