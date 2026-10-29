"""Dependency-free staging and strict TOTAL uncompressed release budget check."""
from pathlib import Path
import shutil, subprocess, json, zipfile, hashlib
ROOT=Path(__file__).resolve().parent
FILES=['index.html','src/style.css','src/logic.mjs','src/platform.mjs','src/service.mjs','src/app.mjs']
for name in FILES:
    if name.endswith('.mjs'): subprocess.run(['node','--check',str(ROOT/name)],check=True)
for target in ['portal','portfolio']:
    dest=ROOT/'dist'/target
    dest.mkdir(parents=True,exist_ok=True)
    for name in FILES:
        out=dest/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,out)
    actual=sorted(p for p in dest.rglob('*') if p.is_file())
    total=sum(p.stat().st_size for p in actual)
    assert total<20_000_000, f'Budget failed: {total} bytes'
    assert total<=15_000_000, f'Target failed: {total} bytes'
    report={'target':target,'total_uncompressed_bytes':total,'file_count':len(actual),'strict_limit_bytes':20_000_000,'target_bytes':15_000_000,'files':[{'path':p.relative_to(dest).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in actual],'external_game_assets':[],'external_platform_script':'CrazyGames SDK v3 only; core game has no remote asset dependency'}
    (ROOT/f'size-{target}.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(f'{target}: {len(actual)} files, {total:,} bytes TOTAL uncompressed')
with zipfile.ZipFile(ROOT/'cloud-courier-portal.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted((ROOT/'dist/portal').rglob('*')):
        if p.is_file(): z.write(p,p.relative_to(ROOT/'dist/portal'))
print('Staged cloud-courier-portal.zip (index.html at ZIP root); no deployment.')
