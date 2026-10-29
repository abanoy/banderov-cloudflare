from pathlib import Path
import shutil
root=Path(__file__).resolve().parent.parent
for folder,label in [(root,'standalone'),(root/'integration','integration'),(root/'integration-rounded','integration-rounded')]:
    backup=root/'history/roof-volumes'/label
    for rel in ['src/layout.js','src/physics.js','src/main.js','README.md','review/size-report.json']:
        target=backup/rel; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(folder/rel,target)
    p=folder/'src/layout.js'; s=p.read_text(encoding='utf-8')
    s=s.replace('const surfaces=[],walls=[],decor=[],pads=[];','const surfaces=[],walls=[],decor=[],pads=[],roofs=[];')
    s=s.replace("wall('keep',0,-23,13,10,10,23);","wall('keep',0,-23,13,10,10,23);\n+   roofs.push({id:d.id+':keep-roof',destination:d.id,x:d.x,z:d.z-23,bottom:d.y+23,top:d.y+31,radius:11,sides:4,rotation:Math.PI/4,scaleZ:.85});")
    s=s.replace("wall('silo '+i,x,z,5.5,5.5,0,8);decor.push", "roofs.push({id:d.id+':silo-roof-'+i,destination:d.id,x:x+d.x,z:z+d.z,bottom:d.y+8,top:d.y+11.4,radius:3.7,sides:8,rotation:0,scaleZ:1});\n+    wall('silo '+i,x,z,5.5,5.5,0,8);decor.push")
    s=s.replace('[surfaces,walls,decor,pads]','[surfaces,walls,decor,pads,roofs]').replace("if('w'in r)r.w*=h;","if('radius'in r)r.radius*=h;if('w'in r)r.w*=h;")
    s=s.replace('surfaces,walls,decor,pads};','surfaces,walls,decor,pads,roofs};')
    s+='''
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
'''
    p.write_text(s,encoding='utf-8')
    p=folder/'src/physics.js';s=p.read_text(encoding='utf-8').replace('TUNE,contains,heightAt','TUNE,contains,heightAt,roofBlocked')
    s=s.replace('function blocked(world,x,z,y){return ', 'function blocked(world,x,z,y){return (world.roofs||[]).some(r=>roofBlocked(r,x,z,y))||')
    p.write_text(s,encoding='utf-8')
    p=folder/'src/main.js';s=p.read_text(encoding='utf-8')
    old='  const roof=mesh(new THREE.ConeGeometry(11,8,4),t.roof,d.x,d.y+27,d.z-23);roof.rotation.y=Math.PI/4;roof.scale.z=.85;'
    assert old in s;s=s.replace(old,'')
    old='mesh(new THREE.ConeGeometry(3.7,3.4,8),t.roof,silo.x,silo.y+9.7,silo.z);'
    assert old in s;s=s.replace(old,'')
    s=s.replace('const padMeshes=[];',"for(const r of artWorld.roofs){drawingDestination=r.destination;const roof=mesh(new THREE.ConeGeometry(r.radius,r.top-r.bottom,r.sides),themeMats[r.destination].roof,r.x,(r.bottom+r.top)/2,r.z);roof.rotation.y=r.rotation;roof.scale.z=r.scaleZ;roof.name='roof:'+r.id;}\nconst padMeshes=[];")
    p.write_text(s,encoding='utf-8')
for name in ['roof-contact.mjs','roof-contact-browser.cjs']:
    p=root/'test'/name;target=root/'history/roof-volumes/test'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
    s=p.read_text(encoding='utf-8').replace('y:32','y:46').replace('y:8.8','y:15');p.write_text(s,encoding='utf-8')
print('Shared non-walkable roof records, rendering and body collision updated; before sources preserved')
