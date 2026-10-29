"""Original packed project/PNG exposure bundle; no native KRA/ORA claim."""
import hashlib,json,shutil
from pathlib import Path
from engine.project import validate,fingerprint
from engine.io.project_archive import save_archive
from engine.packed_render import render,png_bytes


def export_bundle(project,directory,credits):
    validate(project);directory=Path(directory);directory.mkdir(parents=True,exist_ok=False)
    save_archive(directory/'project.aaa',project)
    cuts=sorted({0,project['shot']['duration_frames']}|{e['start'] for e in project['exposures']}|{e['start']+e['length'] for e in project['exposures']})
    seen={};exposures=[]
    try:
        for start,end in zip(cuts,cuts[1:]):
            active=[e for e in project['exposures'] if e['start']<=start<e['start']+e['length']]
            key=fingerprint(dict(layers=project['layers'],drawings={e['layer_id']:project['drawings'][e['drawing_id']]['pixels'] for e in active}))
            if key not in seen:
                w,h,raw=render(project,start);data=png_bytes(w,h,raw);name=f'frame-{len(seen):04d}.png'
                (directory/name).write_bytes(data);seen[key]=dict(file=name,sha256=hashlib.sha256(data).hexdigest())
            exposures.append(dict(start=start,length=end-start,**seen[key]))
        for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(Path(credits)/name,directory/name)
        manifest=dict(format='packed-project-png-exposures-1',project_file='project.aaa',project_sha256=hashlib.sha256((directory/'project.aaa').read_bytes()).hexdigest(),project_fingerprint=fingerprint(project),fps=project['shot']['fps'],duration_frames=project['shot']['duration_frames'],exposures=exposures,scope='Editable complete assistant project plus flattened straight-alpha sRGB8 exposure PNGs; no native layered/animated-KRA or ORA serialization')
        (directory/'animation.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');return manifest
    except BaseException as error:
        (directory/'INCOMPLETE.json').write_text(json.dumps(dict(status='incomplete',error=str(error))),encoding='utf-8');raise
