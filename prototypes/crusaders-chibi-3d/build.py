from pathlib import Path
import shutil,zipfile,json,hashlib,subprocess
root=Path(__file__).resolve().parent
files=['README.md','index.html','style.css','src/app.js','src/model.js','src/lighting.js','src/adapter.js','vendor/three.module.js','vendor/THREE-LICENSE.txt','references/NewCanvas3.png','references/Teaser.png']
for file in files:
 if file.endswith('.js'): subprocess.run(['node','--check',str(root/file)],check=True)
dist=root/'dist'
dist.mkdir(exist_ok=True)
records=[]
for file in files:
 p=root/file;dest=dist/file;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest);records.append({'path':file,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
total=sum(r['bytes'] for r in records)
assert total<20_000_000
with zipfile.ZipFile(root/'chibi-3d-review.zip','w',zipfile.ZIP_DEFLATED) as z:
 for file in files: z.write(dist/file,file)
adapterFiles=['src/model.js','src/lighting.js','src/adapter.js','vendor/three.module.js','vendor/THREE-LICENSE.txt']
(root/'review/package-size.json').write_text(json.dumps({'reviewRuntimeBytes':total,'reviewRuntimeFiles':records,'adapterRuntimeBytes':sum((root/f).stat().st_size for f in adapterFiles),'adapterFiles':adapterFiles,'referenceImagesAreInspectionOnly':True,'fullFutureGameBudgetBytes':20_000_000,'zipBytes':(root/'chibi-3d-review.zip').stat().st_size},indent=2),encoding='utf-8')
print(f'Review runtime: {len(files)} files, {total:,} uncompressed bytes. Adapter-only includes Three.js once; future combined game budget is separate.')
