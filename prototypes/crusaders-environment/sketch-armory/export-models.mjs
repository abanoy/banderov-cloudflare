import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {buildArmory} from './models.js';
const destination=new URL('./exports/',import.meta.url);fs.mkdirSync(destination,{recursive:true});
const mats=Object.fromEntries(Object.entries({stone:0xd9c9a6,edge:0xefe0b8,paving:0xc9b998,wood:0x937653,iron:0x4b6777,brass:0xcdaa68,dark:0x14232d,rope:0xc8b28d}).map(([name,color])=>{const m=new T.MeshStandardMaterial({color});m.name=name;return [name,m];}));
const report=[];
for(const kind of ['cannon','trebuchet','bow','watchtower']){
 const model=buildArmory(kind,mats);model.update(0,{yaw:0,pitch:10*Math.PI/180});model.root.updateMatrixWorld(true);
 let offset=1,triangles=0,meshes=0,vertices=0;const obj=['# Crusaders owner sketch study; metres, +Y up, +Z firing','mtllib materials.mtl'];
 const p=new T.Vector3(),bounds=new T.Box3();
 model.root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p.userData.visualEffect)return;meshes++;const pos=o.geometry.getAttribute('position'),index=o.geometry.index;obj.push('o '+kind+'_'+meshes,'usemtl '+o.material.name);for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('Nonfinite model vertex');bounds.expandByPoint(p);obj.push('v '+p.toArray().map(n=>n.toFixed(6)).join(' '));vertices++;}const count=index?.count??pos.count;for(let i=0;i<count;i+=3){const ids=[0,1,2].map(d=>(index?index.getX(i+d):i+d)+offset);if(ids.some(id=>id>=offset+pos.count))throw Error('Invalid triangle');obj.push('f '+ids.join(' '));triangles++;}offset+=pos.count;});
 fs.writeFileSync(new URL(kind+'.obj',destination),obj.join('\n')+'\n');report.push({kind,meshes,vertices,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});model.dispose();
}
fs.writeFileSync(new URL('materials.mtl',destination),Object.values(mats).map(m=>'newmtl '+m.name+'\nKd '+m.color.clone().convertLinearToSRGB().toArray().map(n=>n.toFixed(6)).join(' ')+'\n').join('\n'));
fs.writeFileSync(new URL('model-report.json',destination),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));for(const m of Object.values(mats))m.dispose();
