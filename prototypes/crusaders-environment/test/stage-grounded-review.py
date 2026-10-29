from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parent.parent
base=root/'integration-rounded';target=root/'integration-grounded-review'
assert not target.exists(),'Review directory already exists; do not overwrite it'
pin=json.loads((base/'character-review1550/PIN.json').read_text())
snapshot=Path(pin['snapshot'])
for entry in pin['files']+pin['sharedVendor']:
    data=(snapshot/entry['path']).read_bytes()
    assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256']
for entry in pin['sharedVendor']:
    assert (base/entry['path']).read_bytes()==(snapshot/entry['path']).read_bytes()
report=json.loads((base/'review/size-report.json').read_text())
for entry in report['runtimeFiles']:
    data=(base/entry['path']).read_bytes()
    assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256']
    dest=target/entry['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(base/entry['path'],dest)
for entry in pin['files']:shutil.copyfile(snapshot/entry['path'],target/'character'/entry['file'])
newpin={'snapshot':'Frozen review-runtime-20261008-1550; separate optional grounded character scene','files':[dict(file=e['file'],bytes=e['bytes'],sha256=e['sha256'],source=str(snapshot/e['path'])) for e in pin['files']],'sharedVendor':pin['sharedVendor'],'worldHeight':2.1,'scope':'Separate optional playable copy; default model options, no terrain foot-lift helper, live imports or promotion of the current rounded actor.'}
(target/'character/PIN.json').write_text(json.dumps(newpin,indent=2),encoding='utf-8')
html=(target/'index.html').read_text(encoding='utf-8').replace('Crusaders  -  Pinned character integration','Crusaders - Optional grounded character study').replace('DON BASS CRUSADERS  -  ENVIRONMENT STUDY','CRUSADERS - OPTIONAL CHARACTER STUDY').replace('<h1>Sky routes</h1>','<h1>Grounded study</h1>').replace('Pinned 3D sailor study','Copied 1550 character study')
(target/'index.html').write_text(html,encoding='utf-8',newline='\r\n')
(target/'review').mkdir()
build=(base/'build.py').read_text(encoding='utf-8').replace('crusaders-rounded-integration-local.zip','crusaders-grounded-review-local.zip')
(target/'build.py').write_text(build,encoding='utf-8',newline='\r\n')
(target/'README.md').write_text('''# Optional grounded character castle study

Open http://127.0.0.1:8795/integration-grounded-review/index.html while the parent local preview is running.

This separate scene uses the immutable review-runtime-20261008-1550 character: lower ear attachment and grounded walking animation, with default options. All five snapshot source hashes and the existing shared vendor/license were checked before copying. The current rounded scene retains its0028 pin. No live source imports, character promotion or terrain foot-lift helper.

The scene starts from current rounded architecture/physics/camera/controls, including rear windows, lower rock layers, ceiling release/cue and held native keyboard button activation guard. Those six source files are exact copies; only scene labeling and the character model/PIN differ. Existing flat character lighting remains the default. Playable prototypes contain no original-image replacement or production/backend changes.

Run python build.py from this directory for Node syntax, character PIN validation and12-file local dist/ZIP staging under20,000,000 runtime bytes. Review/QA files remain excluded. Native gameplay and physical-device acceptance require separate evidence; earlier static1550 camera pairs do not prove this scene's live walking, flight, terrain contact or performance.
''',encoding='utf-8')
print('Created separate immutable1550 scene; previous scenes preserved')
