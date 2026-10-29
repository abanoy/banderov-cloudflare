import * as T from './vendor/three.module.js';
export const BIOMES=[{name:'Mosswood',color:0x739366},{name:'Amber dunes',color:0xc6a06c},{name:'Frostland',color:0xb9cdd3},{name:'Cinder hills',color:0x766175}];
export function biomeAt(x,z){return (Math.floor((Math.atan2(z,x)+Math.PI*2+Math.PI/4)%(Math.PI*2)/(Math.PI/2)))%4;}
export function campHeight(id){return [2,5,-2,7][id%4];}
export function terrainHeight(x,z,camps){let height=2+3.2*Math.sin(x*.035)*Math.cos(z*.038)+1.4*Math.sin((x+z)*.061);for(const c of camps){const d=Math.hypot(x-c.x,z-c.z);if(d<14)return c.y;if(d<25){const t=(d-14)/11,w=t*t*(3-2*t);height=c.y+(height-c.y)*w;}}return height;}
export function createTerrain(scene,mats,camps){
 const rings=48,sides=160,positions=[],colors=[],indices=[];
 for(let j=0;j<=rings;j++)for(let i=0;i<sides;i++){const a=(i+.37)/sides*Math.PI*2,r=j/rings*135,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z,camps);positions.push(x,y,z);const color=new T.Color(BIOMES[biomeAt(x,z)].color);color.multiplyScalar(.91+.09*Math.sin(x*.15+z*.12));colors.push(color.r,color.g,color.b);}
 for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides,c=(j+1)*sides+i,d=(j+1)*sides+(i+1)%sides;indices.push(a,d,c,a,b,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:T.DoubleSide}),ground=new T.Mesh(g,material);ground.receiveShadow=true;ground.userData.place='Four-biome battleground';scene.add(ground);
 // Collision regions have their own tight bounds, sharing the exact drawn triangles.
 const colliders=[];for(let r0=0;r0<rings;r0+=6)for(let a0=0;a0<sides;a0+=20){const points=[];for(let j=r0;j<Math.min(r0+6,rings);j++)for(let i=a0;i<Math.min(a0+20,sides);i++){const offset=(j*sides+i)*6;for(const index of indices.slice(offset,offset+6))points.push(...positions.slice(index*3,index*3+3));}const collision=new T.BufferGeometry();collision.setAttribute('position',new T.Float32BufferAttribute(points,3));collision.computeVertexNormals();collision.computeBoundingSphere();const region=new T.Mesh(collision,material);region.userData.place='Four-biome battleground';region.updateMatrixWorld(true);colliders.push(region);}
 const decor=[];function add(geo,mat,x,y,z){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;scene.add(o);decor.push(o);return o;}
 add(new T.CylinderGeometry(135,78,25,24),mats.soil,0,-19,0);
 for(let i=0;i<64;i++){const a=i/64*Math.PI*2,r=118+(i%3)*4,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z,camps),kind=biomeAt(x,z),m=new T.MeshStandardMaterial({color:BIOMES[kind].color,roughness:1,flatShading:true});if(kind===0||kind===2){add(new T.CylinderGeometry(.35,.5,3,6),mats.bark,x,y+1.5,z);add(new T.ConeGeometry(2.5,5,6),kind===2?m:mats.leaves,x,y+4,z);}else{const rock=add(new T.IcosahedronGeometry(2+i%3,0),m,x,y+1.2,z);rock.scale.set(1.5,kind===1?.5:1.2,1);}}
 // Colour borders share one physical surface; there are no invisible biome walls.
 scene.updateMatrixWorld(true);return {ground,colliders,dispose(){for(const o of colliders)o.geometry.dispose();ground.geometry.dispose();material.dispose();scene.remove(ground);for(const o of decor){o.geometry.dispose();if(!Object.values(mats).includes(o.material))o.material.dispose();scene.remove(o);}}};
}
