"""Original part/depth/donor sequences with independent pixel-shift oracles."""
from pathlib import Path
from copy import deepcopy
import argparse,hashlib,json,shutil,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui
from engine.raster_parts import ownership,propose,accept
from engine.motion import propose as motion_propose,accept as motion_accept
from engine.layers import source_over
from engine.packed_render import render
from engine.project import fingerprint
from engine.jobs import atomic_write
from hosts.standalone.motion_fixtures import fixture
from hosts.standalone.session import Session


def image(project,slot):return np.frombuffer(render(project,slot)[2],np.uint8).reshape(project['canvas']['height'],project['canvas']['width'],4).copy()
def cut(a,indices,keep):
    out=np.zeros_like(a) if keep else a.copy();flat=out.reshape(-1,4)
    if keep:flat[indices]=a.reshape(-1,4)[indices]
    else:flat[indices]=0
    return out
def shift(a,dx,dy):
    out=np.zeros_like(a);h,w=a.shape[:2]
    for y in range(h):
        for x in range(w):
            if 0<=x+dx<w and 0<=y+dy<h:out[y+dy,x+dx]=a[y,x]
    return out
def over(bottom,top):return np.asarray(source_over(bottom.reshape(-1,4).tolist(),top.reshape(-1,4).tolist()),np.uint8).reshape(bottom.shape)


def run(output):
    verify_ui(ROOT);credits=build(check=True);output.mkdir(parents=True,exist_ok=False);rows=[];base=fixture(True);w,h=128,160;correct_mask=[y*w+x for y in range(26,64) for x in range(98,122)];wrong_mask=[y*w+x for y in range(25,55) for x in range(53,85)];donor_mask=[y*w+x for y in range(41,47) for x in range(86,92)]
    source=image(base,0);base_cut=cut(source,correct_mask,False);piece=cut(source,correct_mask,True);moved=shift(piece,-49,44)
    front=over(base_cut,moved);back=over(moved,base_cut);cases=[]
    for name,depth,move,mask,expected in [('partition','front',False,correct_mask,source),('part-front','front',True,correct_mask,front),('part-back','back',True,correct_mask,back),('hidden','hidden',False,correct_mask,base_cut),('wrong-face-mask','back',True,wrong_mask,back)]:cases.append((name,deepcopy(base),depth,move,mask,mask,0,expected))
    donor=deepcopy(base);donor['drawings']['paint-end']['pixels']=donor['drawings']['paint-end']['pixels'].with_edits({i:[250,30,220,255] for i in donor_mask});donor['originals']['paint-end']=deepcopy(donor['drawings']['paint-end']);donor['originals_sha256']=fingerprint(donor['originals']);expected=over(source,cut(image(donor,8),donor_mask,True))
    cases += [('approved-new-content',donor,'front',False,[],donor_mask,8,expected),('source-only-missing-content',deepcopy(base),'front',False,[],donor_mask,0,expected)]
    for name,p,depth,move,source_indices,content_indices,content_slot,expected in cases:
        folder=output/name;folder.mkdir();settings=dict(actor_id='actor',source_slot=0,content_slot=content_slot,target_start=4,target_end=8,name='Diagnostic right forearm',part_id='hero.right_arm',source_mask=ownership(p,source_indices),content_mask=ownership(p,content_indices),depth=depth,operation_id=None)
        q=accept(p,propose(p,settings),'part');time=4
        if move:
            point=[65.5,40.5] if name=='wrong-face-mask' else [113.5,36.5];bounds=[min(i%w for i in source_indices),min(i//w for i in source_indices),max(i%w for i in source_indices)+1,max(i//w for i in source_indices)+1];group=q['raster_parts']['part']['part_group'];q['motion_guides']['part-move']=dict(name='Known part translation',actor_id=group,source_slot=4,guide_slot=None,roi=bounds,handles=[dict(id='part-point',source=point,target=[point[0]-49,point[1]+44],enabled=True)])
            req=dict(guide_id='part-move',mode='rigid',progress=1,target_start=6,target_end=8,operation_id=None,allow_clip=False);proposal=motion_propose(q,req);q=motion_accept(q,proposal,'moved');time=6
        actual=image(q,time);aa=actual[:,:,3]>0;ea=expected[:,:,3]>0;union=np.count_nonzero(aa|ea);allowed=np.zeros((h,w),bool);allowed.reshape(-1)[correct_mask]=True;allowed|=shift(cut(np.full_like(source,255),correct_mask,True),-49,44)[:,:,3]>0
        if 'content' in name:allowed[:]=False;allowed.reshape(-1)[donor_mask]=True
        row=dict(name=name,time=time,mode=depth,source_ownership_pixels=len(source_indices),content_pixels=len(content_indices),content_slot=content_slot,rgba_different_pixels=int(np.count_nonzero(np.any(actual!=expected,axis=2))),silhouette_iou=float(np.count_nonzero(aa&ea)/union) if union else 1,changes_outside_declared_task_area=int(np.count_nonzero(np.any(actual!=source,axis=2)&~allowed)),new_unique_color_expected=int(np.count_nonzero(np.all(expected==[250,30,220,255],axis=2))),new_unique_color_actual=int(np.count_nonzero(np.all(actual==[250,30,220,255],axis=2))),keys_0_8_exact=np.array_equal(image(q,0),image(p,0)) and np.array_equal(image(q,8),image(p,8)),originals_exact=q['originals']==p['originals'],duration=q['shot']['duration_frames'],layers=len(q['layers']),drawings=len(q['drawings']))
        for label,a in [('source',source),('expected',expected),('actual',actual)]:
            from engine.packed_render import png_bytes
            (folder/(label+'.png')).write_bytes(png_bytes(w,h,a.tobytes()))
        for slot in [0,4,6,8]:(folder/f'slot-{slot}.png').write_bytes(png_bytes(w,h,image(q,slot).tobytes()))
        Session(q).save(folder/'sequence.aaa');atomic_write(folder/'input.json',p);(folder/'report.json').write_text(json.dumps(row,indent=2),encoding='utf-8');rows.append(row)
    # Whole-actor baseline applies the same known translation to all artwork.
    p=deepcopy(base);p['motion_guides']['whole']=dict(name='Whole-actor translation comparison',actor_id='actor',source_slot=0,guide_slot=None,roi=[7,5,122,152],handles=[dict(id='hand',source=[113.5,36.5],target=[64.5,80.5],enabled=True)])
    req=dict(guide_id='whole',mode='rigid',progress=1,target_start=6,target_end=8,operation_id=None,allow_clip=True);proposal=motion_propose(p,req);actual=np.frombuffer(render(p,0,overrides={i:o['pixels'] for i,o in proposal['outputs'].items()})[2],np.uint8).reshape(h,w,4);rows.append(dict(name='whole-actor-comparison',rgba_different_pixels=int(np.count_nonzero(np.any(actual!=back,axis=2))),unsafe_reasons=proposal['unsafe_reasons'],metrics={i:o['metrics'] for i,o in proposal['outputs'].items()},scope='Pure preview; explicit ordinary clip enabled to expose loss. This baseline is not accepted into artwork.'))
    (output/'whole-actor-comparison.png').write_bytes(png_bytes(w,h,actual.tobytes()))
    for fn in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/fn,output/fn)
    paths=['engine/raster_parts.py','engine/motion.py','hosts/standalone/motion_fixtures.py','scripts/evaluate_parts.py'];report=dict(status='completed',cases=len(rows),rows=rows,credits_snapshot_sha256=credits['snapshot_sha256'],source_hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths},scope='Original geometric scarf character; explicit hard ownership and part-point hints, analytic integer shift/source-over oracles. Front/back is supplied depth, not automatic occlusion. Wrong mask and absent donor retained. Frames0/4/6/8 show local operations and original endpoint, not inferred smooth action or economical schedule. No external artwork, learned/paper reproduction, artist correction effort or animation quality claim.')
    (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(rows))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);args=parser.parse_args();run(args.output.resolve())
