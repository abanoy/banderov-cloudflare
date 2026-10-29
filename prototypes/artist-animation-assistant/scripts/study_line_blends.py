"""Hidden/private shared-field line blending ablation; no automatic adoption."""
from pathlib import Path
import argparse,hashlib,json,sys,time,html
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(4*1024**2),b''):h.update(block)
    return h.hexdigest()

def study(source,settings_file,output):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    from hosts.standalone.session import Session
    from engine import learned_motion as learned,rife_fields
    from engine.blend_policies import POLICIES
    from engine.line_quality import measure
    from engine.packed_render import render,png_bytes
    from engine.jobs import atomic_write
    from engine.project import fingerprint
    credits=build(check=True);verify_ui(ROOT);source,settings_file,output=map(Path,(source,settings_file,output))
    if output.exists():raise ValueError('Choose a NEW private study directory')
    if settings_file.stat().st_size>65536:raise ValueError('Study settings exceed64KiB')
    data=settings_file.read_bytes();settings=json.loads(data.decode('utf-8'))
    if not isinstance(settings,dict) or set(settings)!={'request','reference_slot','crops'}:raise ValueError('Declare request, held-out reference_slot and diagnostic crops')
    before=sha(source);session=Session.load(source);project=session.project;request=settings['request'];learned.subject(project,request);slot=settings['reference_slot'];w,h=project['canvas']['width'],project['canvas']['height'];crops=settings['crops']
    if type(slot) is not int or not request['source_slot']<slot<request['guide_slot']:raise ValueError('Choose an interior held-out reference slot, excluded from the two model inputs')
    if not isinstance(crops,dict) or not 1<=len(crops)<=8 or any(not isinstance(name,str) or name=='full' or not name.isascii() or not name.replace('_','').isalnum() or len(name)>32 for name in crops):raise ValueError('Declare1..8short diagnostic crop names; full is reserved')
    for box in crops.values():
        if not isinstance(box,list) or len(box)!=4 or any(type(v) is not int for v in box) or not 0<=box[0]<box[2]<=w or not 0<=box[1]<box[3]<=h or max(box[2]-box[0],box[3]-box[1])>1024:raise ValueError('Diagnostic crops must fit the canvas and1024square bound')
    output.mkdir(parents=True);Session(project).save(output/'source.aaa');cached=None;inputs=None;evaluations=0;inference_seconds=0.;rows=[];reference=None
    def runner(a,b,t,checkpoint):
        nonlocal cached,inputs,evaluations,inference_seconds
        identity=hashlib.sha256(a.tobytes()+b.tobytes()+repr(t).encode()).hexdigest()
        if cached is None:
            started=time.monotonic();cached=rife_fields.infer(a,b,t,checkpoint);inference_seconds=time.monotonic()-started;inputs=identity;evaluations+=1;np.savez(output/'shared-fields.npz',flow0=cached['flow0'],flow1=cached['flow1'],weight=cached['weight']);atomic_write(output/'shared-fields-metadata.json',cached['metadata'])
        elif identity!=inputs:raise ValueError('Attempt to reuse fields for different input pixels/phase')
        return cached
    def rgba(p,at):
        rw,rh,raw=render(p,at);return np.frombuffer(raw,np.uint8).reshape(rh,rw,4)
    def metrics(image):
        return dict(full=measure(image,reference),**{name:measure(image[box[1]:box[3],box[0]:box[2]],reference[box[1]:box[3],box[0]:box[2]]) for name,box in crops.items()})
    def previews(p,at,name):
        for crop,box in dict(full=None,**crops).items():
            cw,ch=(box[2]-box[0],box[3]-box[1]) if box else (w,h);scale=min(400/cw,260/ch);size=(max(1,int(cw*scale)),max(1,int(ch*scale)));pw,ph,raw=render(p,at,output_size=size,rectangle=box);(output/(name+'-'+crop+'.png')).write_bytes(png_bytes(pw,ph,raw))
    field_hashes=None
    for index,policy in enumerate((None,)+POLICIES):
        name=policy or 'learned';started=time.monotonic();result=learned._propose(project,request,runner=runner,blend_policy=policy)
        current={key:hashlib.sha256(cached[key].tobytes()).hexdigest() for key in ['flow0','flow1','weight']}
        if field_hashes is None:field_hashes=current
        elif current!=field_hashes:raise ValueError('A blend variant changed shared fields')
        # Held-out pixels are first rendered only AFTER model inference has
        # consumed its explicitly identified two input keys.
        if reference is None:reference=rgba(project,slot);previews(project,slot,'reference')
        row=dict(policy=name,unsafe_reasons=result['unsafe_reasons'],seconds=time.monotonic()-started,model_evaluations=1 if index==0 else 0,model_fields_sha256=current,adaptation=result['model_metadata'].get('research_blend_policy'),warnings=result['warnings'])
        if not result['unsafe_reasons']:
            view=learned._install_fresh(project,result,'blend-'+name,False);new=set(view['drawings'])-set(project['drawings']);assert all(view['drawings'][did]['approved'] is False for did in new);assert all(view['drawings'][did]==drawing for did,drawing in project['drawings'].items());assert view['originals']==project['originals'];file=output/(name+'-unapproved.aaa');Session(view).save(file);assert Session.load(file).project==view;image=rgba(view,request['target_start']);row.update(metrics=metrics(image),new_unapproved_assets=len(new),exact_reopen=True,source_drawings_and_originals_retained=True,project=file.name);previews(view,request['target_start'],name)
        rows.append(row);atomic_write(output/'partial-results.json',dict(rows=rows,model_evaluations=evaluations,accepted=False))
    baselines=[]
    for label,at in [('hold_source',request['source_slot']),('hold_guide',request['guide_slot'])]:
        image=rgba(project,at);baselines.append(dict(policy=label,metrics=metrics(image),model_evaluations=0));previews(project,at,label)
    assert sha(source)==before and settings_file.read_bytes()==data
    report=dict(status='private-quality-ablation',accepted=False,artist_acceptance=False,default_changed=False,source_sha256=before,source_unchanged=True,input_slots=[request['source_slot'],request['guide_slot']],reference_slot=slot,reference_excluded_from_inference=True,request=request,crops=crops,model_evaluations=evaluations,inference_seconds=inference_seconds,shared_fields_sha256=field_hashes,rows=rows,baselines=baselines,credits_snapshot=credits['snapshot_sha256'],interpretation='All policies share exactly one model-field evaluation. Dark-pixel/color metrics and one held-out drawing do not prove anatomy, intentional contours, perceived quality or artist usefulness. Sharpening weights cannot correct wrong geometry. No policy is automatically adopted.')
    atomic_write(output/'report.json',report);(output/'settings.json').write_bytes(data)
    for name in ['CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    labels=['reference','hold_source','hold_guide']+[row['policy'] for row in rows if 'metrics' in row];parts=['<!doctype html><meta charset="utf-8"><title>Private line blending study</title><h1>Unapproved line-quality ablation</h1><p>Shared fields, changed synthesis only. No artist acceptance or automatic policy adoption.</p><p><a href="report.json">Exact diagnostics</a> · <a href="CREDITS.md">CREDITS</a> · <a href="THIRD_PARTY_NOTICES.txt">Full notices</a></p>']
    for crop in ['full']+list(crops):
        parts.append('<h2>'+html.escape(crop)+'</h2>')
        for label in labels:parts.append('<figure style="display:inline-block"><img src="'+label+'-'+crop+'.png"><figcaption>'+label+'</figcaption></figure>')
    (output/'index.html').write_text('\n'.join(parts),encoding='utf-8');return report

def main():
    p=argparse.ArgumentParser();p.add_argument('source',nargs='?',type=Path);p.add_argument('settings',nargs='?',type=Path);p.add_argument('output',nargs='?',type=Path);p.add_argument('--credits',action='store_true');args=p.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not all((args.source,args.settings,args.output)):p.error('Provide source, settings JSON and NEW private output directory')
    report=study(args.source,args.settings,args.output);print(json.dumps(dict(status=report['status'],model_evaluations=report['model_evaluations'],accepted=False,rows=len(report['rows']))))
if __name__=='__main__':main()
