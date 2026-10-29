"""Original character deformation comparisons; no held-out artwork or artist study."""
from pathlib import Path
from copy import deepcopy
import argparse,hashlib,json,shutil,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui
from engine.motion import propose
from engine.deformation import points
from engine.layers import render
from engine.io.png_codec import encode_png
from hosts.standalone.motion_fixtures import fixture,pose,request


def run(output):
    verify_ui(ROOT);credits=build(check=True);output.mkdir(parents=True,exist_ok=False);rows=[]
    def trial(name,project,expected,settings,intended):
        folder=output/name;folder.mkdir();w,h=project['canvas']['width'],project['canvas']['height']
        source=np.asarray(render(project,0),np.uint8).reshape(h,w,4);expected=np.asarray(expected,np.uint8).reshape(h,w,4)
        (folder/'source.png').write_bytes(encode_png(w,h,source.reshape(-1,4).tolist()));(folder/'expected.png').write_bytes(encode_png(w,h,expected.reshape(-1,4).tolist()))
        row=dict(name=name,settings=settings,guide=project['motion_guides']['arm-lift'],source_sha256=hashlib.sha256(source.tobytes()).hexdigest(),expected_sha256=hashlib.sha256(expected.tobytes()).hexdigest())
        try:
            r=propose(project,settings);actual=np.asarray(render(project,0,{i:o['pixels'] for i,o in r['outputs'].items()}),np.uint8).reshape(h,w,4)
            (folder/'proposal.png').write_bytes(encode_png(w,h,actual.reshape(-1,4).tolist()))
            sa=actual[:,:,3]>0;ea=expected[:,:,3]>0;union=np.count_nonzero(sa|ea)
            g=project['motion_guides']['arm-lift'];active=[p for p in g['handles'] if p['enabled'] and p['source'] is not None and p['target'] is not None];p=np.array([r['source'] for r in active]);q=p+settings['progress']*(np.array([r['target'] for r in active])-p)
            predicted=points([x[0] for x in intended],p,q,settings['mode']);errors=np.linalg.norm(predicted-np.array([x[1] for x in intended]),axis=1)
            row.update(status='previewed',unsafe_reasons=r['unsafe_reasons'],silhouette_iou=float(np.count_nonzero(sa&ea)/union) if union else 1,rgba_different_pixels=int(np.count_nonzero(np.any(actual!=expected,axis=2))),intended_landmark_max_error=float(errors.max()),intended_landmark_mean_error=float(errors.mean()),metrics={i:o['metrics'] for i,o in r['outputs'].items()},visibility_events=r['visibility_events'],warnings=r['warnings'])
            if 'new-visible' in name:row['newly_visible_unique_color_recovered_pixels']=int(np.count_nonzero(np.all(actual==[250,30,220,255],axis=2)))
        except ValueError as e:row.update(status='refused',error=str(e))
        (folder/'report.json').write_text(json.dumps(row,indent=2),encoding='utf-8');rows.append(row)
    base=fixture();correct=deepcopy(base['motion_guides']['arm-lift']['handles'])
    for progress in [.25,.5,.75,1]:
        intended=[(r['source'],(np.array(r['source'])+progress*(np.array(r['target'])-r['source'])).tolist()) for r in correct]
        for mode in ['translation','rigid','similarity']:trial('arm-'+str(progress)+'-'+mode,deepcopy(base),pose(progress),request(mode,progress),intended)
    intended=[(r['source'],r['target']) for r in correct]
    for variant in ['missing-head-pins','wrong-hand','swapped-head','new-visible']:
        p=deepcopy(base);g=p['motion_guides']['arm-lift'];expected=pose(1)
        if variant=='missing-head-pins':
            for h in g['handles']:
                if h['id'].startswith('head'):h['enabled']=False
        elif variant=='wrong-hand':g['handles'][-1]['target']=[85.5,80.5]
        elif variant=='swapped-head':g['handles'][3]['target'],g['handles'][4]['target']=g['handles'][4]['target'],g['handles'][3]['target']
        else:
            g['handles'].append(dict(id='new-visible-patch',source=None,target=[88.5,44.5],enabled=True))
            for y in range(41,47):
                for x in range(86,92):expected[y*128+x]=[250,30,220,255]
        trial(variant,p,expected,request('rigid',1),intended)
    # Independent analytic pixel-center oracles, separate from MLS code.
    for variant in ['quarter-turn','uniform-scale','translation']:
        p=fixture(False,180,180,(20,8));g=p['motion_guides']['arm-lift'];g['guide_slot']=None;source=np.asarray(render(p,0),np.uint8).reshape(180,180,4)
        original=np.array([r['source'] for r in g['handles']]);center=np.array([90.,90.])
        if variant=='quarter-turn':target=np.column_stack((180-original[:,1],original[:,0]));expected=np.rot90(source,-1)
        elif variant=='uniform-scale':
            target=center+1.1*(original-center);yy,xx=np.mgrid[.5:180,.5:180];sx=np.floor(90+(xx-90)/1.1).astype(int);sy=np.floor(90+(yy-90)/1.1).astype(int);expected=source[sy,sx]
        else:target=original+[8,0];expected=np.zeros_like(source);expected[:,8:]=source[:,:-8]
        for r,q in zip(g['handles'],target):r['target']=q.tolist()
        for mode in ['translation','rigid','similarity']:trial(variant+'-'+mode,p,expected.reshape(-1,4).tolist(),request(mode,1),list(zip(original.tolist(),target.tolist())))
    for fn in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/fn,output/fn)
    paths=['engine/deformation.py','engine/motion.py','hosts/standalone/motion_fixtures.py','scripts/evaluate_motion.py']
    result=dict(status='completed',trials=len(rows),rows=rows,source_hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths},credits_snapshot_sha256=credits['snapshot_sha256'],scope='Original asymmetric scarf character, independent capsule/ellipse arm-pose renderer and analytic pixel-center global-transform oracles. Requested-pin residual is distinct from intended-landmark error. Sampled guards are not proof of injectivity, pin contacts not whole-foot contact, no missing-surface prediction. Nearest samples, no AA. No external artwork, model/study reproduction, held-out generalization, artist time/effort or style acceptance.')
    (output/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps([dict(name=r['name'],status=r['status'],iou=r.get('silhouette_iou'),unsafe=r.get('unsafe_reasons')) for r in rows]))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);args=parser.parse_args();run(args.output.resolve())
