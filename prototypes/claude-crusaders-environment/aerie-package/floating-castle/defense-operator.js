import * as T from '../vendor/three.module.js';
// Cosmetic battery staff are not extra fighters or capture occupants.
export function defenseOperator(parent,{sprite=null,team=0,entry=[3,0,0]}={}){
 const root=new T.Group();root.name='Automatic battery operator';root.position.fromArray(entry);parent.add(root);const owned=[];
 if(sprite){const figure=new T.Sprite(sprite.material.clone());figure.center.copy(sprite.center);figure.scale.copy(sprite.scale);figure.material.color.set(team?0x554165:0xd5fff5);owned.push(figure.material);root.add(figure);}
 else{for(const [geometry,color,y] of [[new T.SphereGeometry(.43,8,6),0xe9d4ba,1.52],[new T.ConeGeometry(.42,1.1,6),team?0x554165:0x7ed6cb,.65]]){const m=new T.MeshBasicMaterial({color}),o=new T.Mesh(geometry,m);o.position.y=y;root.add(o);owned.push(geometry,m);}}
 let offset=0;const base=new T.Vector3(...entry);
 return {root,update(dt,occupied,active=true){const target=occupied?2.4:0;offset+=(target-offset)*Math.min(1,Math.max(0,dt)*6);if(Math.abs(target-offset)<.005)offset=target;root.position.copy(base);root.position.x+=offset;root.position.y+=Math.abs(target-offset)>.05?Math.sin(offset*12)*.07:0;root.visible=active;root.userData.steppedAside=occupied;},dispose(){root.parent?.remove(root);for(const o of owned)o.dispose();}};
}

