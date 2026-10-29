from pathlib import Path
import json,hashlib,zipfile
root=Path(__file__).resolve().parent.parent
rows=[]
for folder,release in [('', 'crusaders-environment-local.zip'),('integration','crusaders-integration-local.zip'),('integration-rounded','crusaders-rounded-integration-local.zip'),('integration-grounded-review','crusaders-grounded-review-local.zip')]:
    base=root/folder;report=json.loads((base/'review/size-report.json').read_text())
    with zipfile.ZipFile(base/release) as z:
        assert set(z.namelist())=={r['path'] for r in report['runtimeFiles']}
        for entry in report['runtimeFiles']:
            data=(base/entry['path']).read_bytes()
            assert data==(base/'dist'/entry['path']).read_bytes()==z.read(entry['path'])
            assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256']
    assert sum(e['bytes'] for e in report['runtimeFiles'])==report['uncompressedRuntimeBytes']<20_000_000
    assert report['packagedBytes']==(base/release).stat().st_size and report['essentialRemoteAssets']==0
    rows.append({'folder':folder or 'standalone','files':len(report['runtimeFiles']),'runtimeBytes':report['uncompressedRuntimeBytes'],'zipBytes':report['packagedBytes']})
base=root/'integration-grounded-review';pin=json.loads((base/'character/PIN.json').read_text())
for entry in pin['files']:
    data=(base/'character'/entry['file']).read_bytes()
    assert data==Path(entry['source']).read_bytes()
    assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256']
for entry in pin['sharedVendor']:
    data=(base/entry['path']).read_bytes()
    assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256']
for entry in json.loads((base/'review/size-report.json').read_text())['runtimeFiles']:
    if entry['path'] not in ['index.html','character/model.js','character/PIN.json']:
        assert (base/entry['path']).read_bytes()==(root/'integration-rounded'/entry['path']).read_bytes()
(base/'review/package-integrity.json').write_text(json.dumps({'rows':rows,'snapshotExact':True,'roundedSceneSharedRuntimeExact':True,'scope':'All44 runtime source/dist/ZIP/report files and immutable1550 character/sharedvendor pins; current rounded remains separate. Not gameplay/visual/device acceptance.'},indent=2),encoding='utf-8')
print('All44 runtime entries exact; immutable1550 pin and nine rounded shared files verified')
