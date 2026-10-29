import * as T from '../vendor/three.module.js';
// Shallow decorative fittings on existing solid façades; no new passages or collision.
export function facadeDetail(parent,{stone,edge,roof,dark}){
 const group=new T.Group();group.name='Facade fittings';parent.add(group);
 const outer=new T.Shape();outer.moveTo(-.65,0);outer.lineTo(.65,0);outer.lineTo(.65,1.28);outer.lineTo(0,2.02);outer.lineTo(-.65,1.28);outer.closePath();
 const inner=new T.Path();inner.moveTo(-.38,.22);inner.lineTo(-.38,1.18);inner.lineTo(0,1.64);inner.lineTo(.38,1.18);inner.lineTo(.38,.22);inner.closePath();outer.holes.push(inner);
 const frame=new T.ExtrudeGeometry(outer,{depth:.17,bevelEnabled:false}),pane=new T.Shape();pane.moveTo(-.39,.21);pane.lineTo(.39,.21);pane.lineTo(.39,1.19);pane.lineTo(0,1.66);pane.lineTo(-.39,1.19);pane.closePath();
 const glass=new T.ShapeGeometry(pane),recess=new T.MeshBasicMaterial({color:'#263949'}),unit=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();recess.color.convertSRGBToLinear();
 const windows=[];for(const x of [-17.5,-12.5,-7.5,-2.5,2.5])windows.push([x,1.1,20.92]);for(const x of [-6,-1,4,9,14,19])windows.push([x,7.1,4.42]);
 const instance=(geometry,material,records)=>{const mesh=new T.InstancedMesh(geometry,material,records.length);records.forEach((p,i)=>{dummy.position.set(...p.slice(0,3));dummy.scale.set(...(p.slice(3).length?p.slice(3):[1,1,1]));dummy.rotation.set(0,0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 instance(frame,edge,windows);instance(glass,recess,windows.map(([x,y,z])=>[x,y,z+.012]));
 instance(unit,dark,windows.map(([x,y,z])=>[x,y+.86,z+.035,.075,1.15,.055]));instance(unit,stone,windows.map(([x,y,z])=>[x,y+.02,z+.2,1.5,.2,.45]));
 // Narrow notched banners flank the entrance; muted roof colour keeps the same palette.
 const cloth=new T.Shape();cloth.moveTo(-.55,1.2);cloth.lineTo(.55,1.2);cloth.lineTo(.55,-.7);cloth.lineTo(0,-.45);cloth.lineTo(-.55,-.7);cloth.closePath();const clothG=new T.ExtrudeGeometry(cloth,{depth:.035,bevelEnabled:false});
 const bannerPositions=[[3.2,1.35,29.55],[16.5,1.35,29.55]];instance(clothG,roof,bannerPositions);instance(unit,edge,bannerPositions.map(([x,y,z])=>[x,y+.3,z+.065,.07,1.5,.04]));instance(unit,dark,bannerPositions.map(([x,y,z])=>[x,y+1.2,z+.04,1.4,.1,.12]));
 return {group,windows:windows.length,banners:bannerPositions.length};
}
