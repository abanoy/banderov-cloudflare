"""Stage a standalone local runtime without touching the Cloudflare Worker."""
from pathlib import Path
import hashlib,json,shutil,subprocess,zipfile
root=Path(__file__).resolve().parent
runtime=['index.html','src/detail.js','src/main.js','src/layout.js','src/physics.js','src/style.css','vendor/three.module.js','vendor/THREE-LICENSE.txt','character/adapter.js','character/model.js','character/lighting.js','character/PIN.json']
for name in ['src/detail.js','src/main.js','src/layout.js','src/physics.js','character/adapter.js','character/model.js','character/lighting.js']:
    subprocess.run(['node','--check',str(root/name)],check=True)
pin=json.loads((root/'character/PIN.json').read_text(encoding='utf-8'))
for entry in pin['files']:
    data=(root/'character'/entry['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest().upper()==entry['sha256'].upper() and len(data)==entry['bytes']
dest=root/'dist'
dest.mkdir(exist_ok=True)
records=[]
for name in runtime:
    source=root/name
    target=dest/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,target)
    data=target.read_bytes()
    records.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
total=sum(r['bytes'] for r in records)
assert total<20_000_000
release=root/'crusaders-grounded-review-local.zip'
with zipfile.ZipFile(release,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name in runtime:z.write(dest/name,name)
report={'runtimeFiles':records,'uncompressedRuntimeBytes':total,'packagedBytes':release.stat().st_size,'limitBytes':20_000_000,'essentialRemoteAssets':0}
(root/'review'/'size-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(f'{len(records)} runtime files · {total:,} uncompressed bytes · {release.stat().st_size:,} ZIP bytes')
