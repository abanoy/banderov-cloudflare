from pathlib import Path
import re,json,hashlib,zipfile
root=Path(__file__).resolve().parent
files={'index.html','style.css','main.js','loop.js'}
def visit(rel):
    src=(root/rel).read_text(encoding='utf-8-sig')
    for match in re.finditer(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]",src):
        target=match.group(1).split('?')[0]
        if not target.startswith('.'):continue
        path=(root/rel).parent/target
        dest=path.resolve().relative_to(root).as_posix()
        if dest not in files:
            files.add(dest);visit(dest)
visit('main.js')
runtime=set(files)
for name in ['README.md','server.cjs','package.json','vendor/THREE-LICENSE.txt','test/loop.mjs','test/camps.mjs','test/design-export.mjs','test/parent-physics.mjs','test/wave-compatibility.mjs','test/armory-biomes.mjs','package.py']:
    if (root/name).exists():files.add(name)
records=[{'path':f,'bytes':(root/f).stat().st_size,'sha256':hashlib.sha256((root/f).read_bytes()).hexdigest()} for f in sorted(files)]
report={'files':len(records),'runtimeFiles':len(runtime),'uncompressedRuntimeBytes':sum(r['bytes'] for r in records if r['path'] in runtime),'portableBytes':sum(r['bytes'] for r in records),'records':records}
with zipfile.ZipFile(root/'castle-trials-local.zip','w',zipfile.ZIP_DEFLATED) as z:
    for r in records:z.write(root/r['path'],r['path'])
report['zipBytes']=(root/'castle-trials-local.zip').stat().st_size
(root/'review/runtime-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='records'}))
