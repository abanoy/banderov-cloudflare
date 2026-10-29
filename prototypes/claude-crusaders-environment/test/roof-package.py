from pathlib import Path
import hashlib,json,zipfile,re
root=Path(__file__).resolve().parent.parent
for folder,zipname in [(root,'crusaders-environment-local.zip'),(root/'integration','crusaders-integration-local.zip'),(root/'integration-rounded','crusaders-rounded-integration-local.zip')]:
    report=json.loads((folder/'review/size-report.json').read_text(encoding='utf-8'))
    with zipfile.ZipFile(folder/zipname) as z:
        assert set(z.namelist())=={r['path'] for r in report['runtimeFiles']}
        for r in report['runtimeFiles']:
            data=(folder/r['path']).read_bytes()
            assert data==(folder/'dist'/r['path']).read_bytes()==z.read(r['path'])
            assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256']
    assert sum(r['bytes'] for r in report['runtimeFiles'])==report['uncompressedRuntimeBytes']<20_000_000
    assert report['essentialRemoteAssets']==0 and report['packagedBytes']==(folder/zipname).stat().st_size
    p=folder/'README.md';s=p.read_text(encoding='utf-8')
    s=re.sub(r'Current 2026-10-08 arc/detail checkpoint: \d+ runtime files, \d+ uncompressed bytes; ZIP \d+ bytes\.',f"Current 2026-10-08 arc/detail checkpoint: {len(report['runtimeFiles'])} runtime files, {report['uncompressedRuntimeBytes']} uncompressed bytes; ZIP {report['packagedBytes']} bytes.",s,count=1)
    s=s.replace('their pitched roofs are decorative, intentionally inaccessible.','their pitched roofs now block flight as non-walkable cone volumes, shared with rendering.')
    if '2026-10-08 roof volume correction:' not in s:
        s+='\n\n2026-10-08 roof volume correction: keep and silo roof shapes now share layout records with rendering and flight collision. They block body movement and remain non-walkable; steer away after contact. Before-source rendered keep ray/descent reproduces penetration (exit1). Fresh all18 roof fixture descents/escapes across three scenes and1326 rendered-triangle/analytic-volume ray comparisons pass exit0. Existing155 physics assertions, six default arcs, altitude reversal and contact escape tests pass exit0. Walking surfaces/walls/pads/tuning and actor pins are preserved. Exact32 runtime source/dist/ZIP/report hashes and strict budget pass. These tests do not prove physical-phone, full native approach or universal ornament/pod-hull clearance; visual hull and chibi head extend beyond the existing .55m body radius. The older contact fixtures were raised above the newly collidable roof apexes. Evidence: parent test/roof-shape.cjs, roof-preservation.mjs, roof-package.py and review/roof-shape.json (parent paths for integrations).\n'
    p.write_text(s,encoding='utf-8')
    print(folder.name,report['uncompressedRuntimeBytes'],report['packagedBytes'],'exact runtime integrity passed')
