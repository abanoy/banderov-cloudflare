"""Package the isolated sketch candidate; do not touch existing game builds."""
from pathlib import Path
import hashlib, json, shutil, subprocess, zipfile
root=Path(__file__).resolve().parent
names=['index.html','style.css','main.js','owner-billboard-art.js','retro-look.js','surface-detail.js','sky.js','facade-detail.js','look-presets.js','walk-controls.js','palette-pair.js','palette-study.html','palette-study.js']
mapping={f'sketch-interpretation/{name}':f'sketch-interpretation/{name}' for name in names}
mapping.update({f'vendor/{name}':f'vendor/{name}' for name in ['three.module.js','THREE-LICENSE.txt']})
mapping.update({'index.html':'sketch-package-support/index.html','review/index.html':'sketch-package-support/review.html','serve.py':'sketch-package-support/serve.py','README.txt':'sketch-package-support/README.txt'})
dest=root/'sketch-package'
dest.mkdir(exist_ok=True)
existing={p.relative_to(dest).as_posix() for p in dest.rglob('*') if p.is_file()}
if existing-set(mapping):
    raise RuntimeError('Unexpected staging files; inspect before packaging: '+repr(existing-set(mapping)))
records=[]
for path,source in mapping.items():
    src=root/source
    if src.suffix=='.js': subprocess.run(['node','--check',str(src)],check=True)
    target=dest/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,target)
    data=src.read_bytes();assert data==target.read_bytes()
    records.append({'path':path,'source':source,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
total=sum(r['bytes'] for r in records);assert total<20_000_000
release=root/'crusaders-sketch-local.zip'
with zipfile.ZipFile(release,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for path in mapping: archive.write(dest/path,path)
with zipfile.ZipFile(release) as archive:
    assert set(archive.namelist())==set(mapping)
    for path,source in mapping.items(): assert archive.read(path)==(root/source).read_bytes()==(dest/path).read_bytes()
report={'files':records,'uncompressedBytes':total,'zipBytes':release.stat().st_size,'essentialRemoteAssets':0,'sourceStageZipExact':True}
(root/'review/sketch-package.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(f'{len(records)} files, {total} uncompressed bytes, {release.stat().st_size} ZIP bytes; exact source/stage/ZIP')
