"""Private actual-ink color study; target fills excluded from proposal inputs."""
from pathlib import Path
from copy import deepcopy
import argparse,hashlib,json,sys,time
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))


def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(4*1024**2),b''):h.update(b)
    return h.hexdigest()


def ink_source(project,slot,identities,source_sha):
    from engine.project import create,fingerprint,validate
    from engine.spatial_constraints import uniform
    from engine.layers import validate_layers
    if type(slot) is not int or not 0<=slot<project['shot']['duration_frames'] or not isinstance(identities,list) or not 1<=len(identities)<=8 or len(set(identities))!=len(identities):raise ValueError('Declare1..8distinct supplied ink layers and valid slot')
    w,h=project['canvas']['width'],project['canvas']['height'];q=create(uniform(w,h),w,h);q['project_id']='supplied-native-ink';q['layers']={};q['drawings']={};q['exposures']=[]
    for index,lid in enumerate(identities):
        node=project['layers'].get(lid)
        if node is None or node.get('nodetype','paintlayer')!='paintlayer' or not node.get('visible',True) or node.get('opacity',255)!=255:raise ValueError('Explicit visible full-opacity paint ink layers required')
        parent=node.get('parent_id')
        while parent is not None:
            n=project['layers'][parent]
            if not n.get('visible',True) or n.get('opacity',255)!=255:raise ValueError('Ink ancestors must be visible and full opacity')
            parent=n.get('parent_id')
        exposure=next(e for e in project['exposures'] if e['layer_id']==lid and e['start']<=slot<e['start']+e['length']);drawing=project['drawings'][exposure['drawing_id']];p=drawing['pixels']
        for y in range(0,h,64):
            a=np.frombuffer(p.region_bytes([0,y,w,min(y+64,h)]),np.uint8).reshape(-1,4)
            if np.any((a[:,:3]!=0)&(a[:,3:4]>0)):raise ValueError('Selected native input is not black ink only; target fills are excluded')
        q['layers'][lid]=dict(name=node.get('name',lid),nodetype='paintlayer',visible=True,locked=node.get('locked',False),opacity=255,order=index);q['drawings'][lid]=deepcopy(drawing);q['exposures'].append(dict(layer_id=lid,drawing_id=lid,start=0,length=1))
    q['originals']=deepcopy(q['drawings']);q['originals_sha256']=fingerprint(q['originals']);q['history']=[dict(action='explicit_native_ink_input',source_sha256=source_sha,slot=slot,ink_layer_ids=identities[:],target_fill_layers_excluded=True)]
    validate(q);validate_layers(q);return q


def study(source,cache,config_file,output):
    from hosts.standalone.session import Session
    from engine import ink_region_color as color,rife_fields
    from engine.io.project_archive import PixelPlane
    from engine.packed_render import render,png_bytes
    from engine.project import fingerprint
    from engine.line_quality import measure
    from engine.jobs import atomic_write
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT);source,cache,config_file,output=map(Path,(source,cache,config_file,output));started=time.monotonic()
    if output.exists():raise ValueError('Choose a NEW private output directory')
    if config_file.stat().st_size>65536 or (cache/'report.json').stat().st_size>8*1024**2:raise ValueError('Study JSON exceeds bound')
    config_raw=config_file.read_bytes();config=json.loads(config_raw);required={'input_slot','reference_slots','ink_layer_ids','parameters','crops'}
    if not isinstance(config,dict) or not required<=set(config) or set(config)-required-{'hint_mode'}:raise ValueError('Declare native ink slot/layers, earlier-key references, parameters and crops')
    mode=config.get('hint_mode','cached_learned')
    if mode not in ('cached_learned','hold_source','hold_guide'):raise ValueError('Choose a declared earlier-key color hint mode')
    before=sha(source);old=json.loads((cache/'report.json').read_text());project=Session.load(source).project
    if old.get('status')!='private-quality-ablation' or old.get('source_sha256')!=before or config['reference_slots']!=old['input_slots'] or not old['request']['source_slot']<config['input_slot']<old['request']['guide_slot']:raise ValueError('Exact source and original two-key reference binding required')
    color.settings_checked(config['parameters']);w,h=project['canvas']['width'],project['canvas']['height'];crops=config['crops']
    if not isinstance(crops,dict) or not 1<=len(crops)<=8:raise ValueError('Declare1..8diagnostic crops')
    for name,box in crops.items():
        if not isinstance(name,str) or name=='full' or not name.isascii() or not name.replace('_','').isalnum() or len(name)>32 or not isinstance(box,list) or len(box)!=4 or any(type(v) is not int for v in box) or not 0<=box[0]<box[2]<=w or not 0<=box[1]<box[3]<=h:raise ValueError('Named crops must fit native canvas; full is reserved')
    input_project=ink_source(project,config['input_slot'],config['ink_layer_ids'],before)
    base=next(row for row in old['rows'] if row['policy']=='learned');name=base['project']
    if Path(name).name!=name or not name.endswith('.aaa'):raise ValueError('Expected local cached default project basename')
    baseline_file=cache/name;baseline=Session.load(baseline_file).project;operation=baseline['learned_motion_operations'][-1];metadata=json.loads((cache/'shared-fields-metadata.json').read_text())
    if operation['settings']!=old['request'] or operation['model']!=metadata or baseline['originals']!=project['originals'] or any(baseline['drawings'][i]!=d for i,d in project['drawings'].items()):raise ValueError('Cached hint differs from original source/default model request')
    manifest=rife_fields.installation()
    if metadata.get('artifact_sha256')!={r['path']:r['sha256'] for r in manifest['model_files']}:raise ValueError('Cached model artifacts differ')
    def rgba(p,slot):
        rw,rh,raw=render(p,slot);return np.frombuffer(raw,np.uint8).reshape(rh,rw,4)
    reference_planes=[PixelPlane.from_rgba(w,h,rgba(project,slot).tobytes()) for slot in config['reference_slots']];palette=color.palette_from_planes(reference_planes)
    if mode=='cached_learned':hints=rgba(baseline,old['request']['target_start'])
    else:
        p=reference_planes[0 if mode=='hold_source' else 1];hints=np.frombuffer(p.region_bytes(),np.uint8).reshape(h,w,4)
    hint=PixelPlane.from_rgba(w,h,hints.tobytes())
    input_identity=fingerprint(input_project);proposal,result=color.preview(input_project,hint,palette,config['parameters'],'region-color')
    # Target fill/white/color layers are first rendered only AFTER proposal inputs
    # and outputs have been fixed. Supplied target ink is explicitly allowed input.
    reference=rgba(project,config['input_slot']);image=rgba(proposal,0);ink=rgba(input_project,0)
    output.mkdir(parents=True);Session(input_project).save(output/'supplied-ink.aaa');Session(proposal).save(output/'region-color-unapproved.aaa');assert Session.load(output/'region-color-unapproved.aaa').project==proposal
    assert fingerprint(input_project)==input_identity and proposal['originals']==input_project['originals'] and all(proposal['drawings'][i]==d for i,d in input_project['drawings'].items())
    assert all(proposal['drawings'][i]['approved'] is False for i in set(proposal['drawings'])-set(input_project['drawings']))
    session=Session(input_project);session.commit(proposal,'Unapproved color study');session.travel();assert all(session.project[k]==input_project[k] for k in input_project if k not in ('revision','dependency_epochs'))
    metrics={};filled=np.zeros((h,w),bool)
    for p in result['outputs']:filled|=np.frombuffer(p.region_bytes(),np.uint8).reshape(h,w,4)[:,:,3]>0
    for name,box in dict(full=[0,0,w,h],**crops).items():
        x0,y0,x1,y1=box;view=(slice(y0,y1),slice(x0,x1));mask=filled[view]&(reference[view][:,:,3]>=128)
        metrics[name]=dict(proposal=measure(image[view],reference[view]),earlier_key_hint=measure(hints[view],reference[view]),filled_pixels=int(mask.sum()),reference_visible_pixels=int((reference[view][:,:,3]>=128).sum()),filled_rgb_mae=float(np.abs(image[view][:,:,:3].astype(float)-reference[view][:,:,:3])[mask].mean()) if mask.any() else None)
        step=max(1,int(np.ceil(max(x1-x0,y1-y0)/600)))
        for label,pixels in [('supplied-ink',ink),('proposal',image),('earlier-key-hint',hints),('reference',reference)]:
            small=pixels[y0:y1:step,x0:x1:step];(output/(label+'-'+name+'.png')).write_bytes(png_bytes(small.shape[1],small.shape[0],small.tobytes()))
    assert sha(source)==before and config_file.read_bytes()==config_raw
    report=dict(status='supplied-native-ink-reference-color-study',accepted=False,artist_acceptance=False,default_changed=False,model_evaluations=0,seconds=time.monotonic()-started,source_sha256=before,source_unchanged=True,cached_default_project_sha256=sha(baseline_file),hint_mode=mode,hint_rgba_sha256=hashlib.sha256(hints.tobytes()).hexdigest(),config=config,palette=palette,metrics=metrics,region_metrics=result['metrics'],regions=result['regions'],source_ink_assets_exact=True,source_hidden_rgb_and_approvals_retained=True,exact_reopen=True,one_undo_artwork_structure_exact=True,target_ink_is_explicit_input=True,target_fills_rendered_only_after_proposal=True,credits_snapshot=credits['snapshot_sha256'],limitations='This uses supplied native target ink, not held-out target motion prediction. Explicit selected ink layers omit some mixed-layer line details. Color hints and palette use only the original two-key reference slots. Majority region labels/votes are not semantic roles or calibrated confidence. Unclosed/ambiguous areas and under-ink antialias seams may remain. No general/artist quality acceptance.')
    atomic_write(output/'report.json',report);(output/'settings.json').write_bytes(config_raw)
    for name in ('CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt'):(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    return report


def main():
    p=argparse.ArgumentParser();p.add_argument('source',type=Path,nargs='?');p.add_argument('cache',type=Path,nargs='?');p.add_argument('settings',type=Path,nargs='?');p.add_argument('output',type=Path,nargs='?');p.add_argument('--credits',action='store_true');a=p.parse_args()
    if a.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not all((a.source,a.cache,a.settings,a.output)):p.error('Provide source, cached prior study, settings and NEW private output directory')
    r=study(a.source,a.cache,a.settings,a.output);print(json.dumps(dict(status=r['status'],regions=r['region_metrics'],accepted=False,model_evaluations=0)))
if __name__=='__main__':main()
