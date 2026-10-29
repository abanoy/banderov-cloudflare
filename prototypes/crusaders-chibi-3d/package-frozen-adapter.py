from pathlib import Path
import sys,json,hashlib,zipfile
root=Path(__file__).resolve().parent
directory=(root/sys.argv[1]).resolve()
assert directory.parent==root/'snapshots','Expected an existing direct snapshot child'
manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
files=[row['path'] for row in manifest['files']]
assert files==['src/model.js','src/lighting.js','src/adapter.js','vendor/three.module.js','vendor/THREE-LICENSE.txt']
assert manifest['totalBytes']==sum(row['bytes'] for row in manifest['files'])
for row in manifest['files']:
 data=(directory/row['path']).read_bytes()
 assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
target=root/'review'/f"chibi-adapter-{directory.name.removeprefix('review-runtime-')}.zip"
assert not target.exists(),'Preserve an existing archive'
with zipfile.ZipFile(target,'x',zipfile.ZIP_DEFLATED) as archive:
 for name in files+['manifest.json']:archive.write(directory/name,name)
with zipfile.ZipFile(target) as archive:
 assert archive.namelist()==files+['manifest.json']
 for name in archive.namelist():assert archive.read(name)==(directory/name).read_bytes()
report={'snapshot':directory.relative_to(root).as_posix(),'archive':target.relative_to(root).as_posix(),'archiveBytes':target.stat().st_size,'runtimeBytes':manifest['totalBytes'],'entries':6,'scope':'Five immutable runtime files plus manifest; exact archive/source/hash comparison. Not a playable scene or deployment.'}
(root/'review'/'frozen-current-package.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
