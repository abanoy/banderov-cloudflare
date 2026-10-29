"""Research-only cached-field explicit feature study; never installs a drawing."""
from pathlib import Path
import argparse, hashlib, json, sys, zipfile
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def sha(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda:f.read(4*1024**2),b''):digest.update(block)
    return digest.hexdigest()


def study(source, cached_study, controls_file, output):
    from engine.feature_fields import adapt,validate
    from engine import learned_motion as learned,rife_fields
    from engine.line_quality import measure
    from engine.packed_render import render,png_bytes
    from engine.jobs import atomic_write
    from hosts.standalone.session import Session
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT)
    source,cached_study,controls_file,output=map(Path,(source,cached_study,controls_file,output))
    if output.exists():raise ValueError('Choose a NEW private output directory')
    for file,limit in [(cached_study/'report.json',8*1024**2),(cached_study/'shared-fields-metadata.json',128*1024),(controls_file,65536)]:
        if file.stat().st_size>limit:raise ValueError('Bounded JSON input exceeded')
    report=json.loads((cached_study/'report.json').read_text());metadata=json.loads((cached_study/'shared-fields-metadata.json').read_text());data=controls_file.read_bytes();controls=json.loads(data)
    before=sha(source)
    if report.get('status')!='private-quality-ablation' or report.get('source_sha256')!=before or report.get('model_evaluations')!=1 or not report.get('source_unchanged'):
        raise ValueError('Cache must bind the exact unchanged source and one original evaluation')
    project=Session.load(source).project;request=report['request'];learned.subject(project,request)
    canvas=[project['canvas']['width'],project['canvas']['height']];validate(canvas,controls)
    manifest=rife_fields.installation()
    artifacts={r['path']:r['sha256'] for r in manifest['model_files']}
    if metadata.get('artifact_sha256')!=artifacts or metadata.get('working_size')!=request['working_size'] or metadata.get('progress')!=request['progress']:
        raise ValueError('Cached model artifacts or request differ')
    file=cached_study/'shared-fields.npz'
    with zipfile.ZipFile(file) as z:
        if sorted(z.namelist())!=['flow0.npy','flow1.npy','weight.npy'] or sum(i.file_size for i in z.infolist())>32*1024**2:
            raise ValueError('Invalid bounded numeric field archive')
    with np.load(file,allow_pickle=False) as archive:
        fields={key:archive[key] for key in ('flow0','flow1','weight')}
    hashes={k:hashlib.sha256(v.tobytes()).hexdigest() for k,v in fields.items()}
    if hashes!=report['shared_fields_sha256'] or list(fields['weight'].shape[::-1])!=request['working_size']:
        raise ValueError('Cached field hashes or dimensions differ')
    fields['metadata']=metadata;adapted,diagnostics=adapt(fields,canvas,controls)
    output.mkdir(parents=True)
    np.savez(output/'adapted-fields.npz',**{k:adapted[k] for k in ('flow0','flow1','weight')})
    atomic_write(output/'diagnostics.json',diagnostics)
    # Re-render the exact declared source keys through the unchanged compositor.
    # No inferred field is reused for a different source, request or model identity.
    result=learned._propose(project,request,runner=lambda a,b,t,checkpoint:adapted)
    unsafe=result['unsafe_reasons']+diagnostics['unsafe_reasons']
    overrides={layer:row['pixels'] for layer,row in result['outputs'].items()}
    rw,rh,raw=render(project,request['target_start'],overrides=overrides)
    image=np.frombuffer(raw,np.uint8).reshape(rh,rw,4)
    # Reference is evaluation only, read after declared controls have been applied.
    _,_,reference_raw=render(project,report['reference_slot']);reference=np.frombuffer(reference_raw,np.uint8).reshape(rh,rw,4)
    metrics={'full':measure(image,reference)}
    for name,box in dict(full=None,**report['crops']).items():
        if box:
            metrics[name]=measure(image[box[1]:box[3],box[0]:box[2]],reference[box[1]:box[3],box[0]:box[2]])
        cw,ch=(box[2]-box[0],box[3]-box[1]) if box else canvas;scale=min(600/cw,400/ch)
        pw,ph,raw=render(project,request['target_start'],output_size=(max(1,int(cw*scale)),max(1,int(ch*scale))),rectangle=box,overrides=overrides)
        (output/(name+'.png')).write_bytes(png_bytes(pw,ph,raw))
    assert sha(source)==before and controls_file.read_bytes()==data
    analysis=dict(status='research-read-only-feature-field-study',accepted=False,artist_acceptance=False,default_changed=False,
        model_evaluations=0,source_sha256=before,source_unchanged=True,request=request,controls=controls,
        cached_fields_sha256=hashes,cache_binding='Exact source SHA256, original report request/phase/dimensions and field hashes; current pinned model artifact hashes. Historical report attests original input keys, not an independently signed cache.',
        diagnostics=diagnostics,unsafe_reasons=unsafe,installable=not bool(unsafe),editable_project_created=False,
        outputs='Read-only diagnostic images only, including unsafe results; no drawing installation or approval API.',
        metrics=metrics,credits_snapshot=credits['snapshot_sha256'],warnings=result['warnings']+['Explicit feature positions and key visibility are additional guidance, not inferred anatomy or artist approval. Sampled Jacobians do not certify continuous topology.'])
    atomic_write(output/'report.json',analysis);(output/'controls.json').write_bytes(data)
    for name in ('CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt'):(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    return analysis


def main():
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('cache',type=Path);p.add_argument('controls',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
    r=study(a.source,a.cache,a.controls,a.output);print(json.dumps(dict(status=r['status'],model_evaluations=0,unsafe_reasons=r['unsafe_reasons'],accepted=False)))

if __name__=='__main__':main()
