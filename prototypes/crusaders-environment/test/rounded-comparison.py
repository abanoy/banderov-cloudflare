from pathlib import Path
import hashlib,json,difflib,zipfile
root=Path(__file__).resolve().parent.parent
folders=['integration','integration-rounded']
reports={f:json.loads((root/f/'review/size-report.json').read_text()) for f in folders}
names=[r['path'] for r in reports[folders[0]]['runtimeFiles']]
assert names==[r['path'] for r in reports[folders[1]]['runtimeFiles']]
rows=[];patch=[]
for name in names:
    pair=[]
    for folder in folders:
        data=(root/folder/name).read_bytes()
        item=next(r for r in reports[folder]['runtimeFiles'] if r['path']==name)
        assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256']
        assert data==(root/folder/'dist'/name).read_bytes()
        with zipfile.ZipFile(root/folder/('crusaders-rounded-integration-local.zip' if folder.endswith('rounded') else 'crusaders-integration-local.zip')) as z:
            assert data==z.read(name)
        pair.append(data)
    same=pair[0]==pair[1]
    rows.append({'path':name,'identical':same,'earlierBytes':len(pair[0]),'roundedBytes':len(pair[1]),'earlierSha256':hashlib.sha256(pair[0]).hexdigest(),'roundedSha256':hashlib.sha256(pair[1]).hexdigest()})
    if not same:
        patch.extend(difflib.unified_diff([line+'\n' for line in pair[0].decode('utf-8').splitlines()],[line+'\n' for line in pair[1].decode('utf-8').splitlines()],fromfile='earlier/'+name,tofile='rounded/'+name))
for folder in folders:
    pin=json.loads((root/folder/'character/PIN.json').read_text())
    for entry in pin['files']:
        data=(root/folder/'character'/entry['file']).read_bytes()
        assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest().lower()==entry['sha256'].lower()
changed=[r['path'] for r in rows if not r['identical']]
result={'scope':'Current preserved earlier chibi versus current rounded playable runtime, exact source/dist/ZIP/report and character pins. Differences are review evidence, not a promotion instruction or visual/phone acceptance.','changed':changed,'rows':rows,'runtimeBytes':{f:reports[f]['uncompressedRuntimeBytes'] for f in folders}}
(root/'review/rounded-vs-earlier.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
(root/'review/rounded-vs-earlier.patch').write_text(''.join(patch),encoding='utf-8',newline='')
print(json.dumps({'changed':changed,'exactRuntimeFiles':len(rows)*2,'pinsVerified':True,'runtimeBytes':result['runtimeBytes']}))
