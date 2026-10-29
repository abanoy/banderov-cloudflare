"""Original image-correspondence/motion comparisons with exposed failure metrics."""
from pathlib import Path
from copy import deepcopy
import argparse,hashlib,json,shutil,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui
from engine.correspondence import defaults,propose,review
from engine.motion import propose as pose_propose
from engine.layers import render
from engine.project import fingerprint
from engine.io.png_codec import encode_png
from hosts.standalone.correspondence_fixtures import fixture as patch_fixture
from hosts.standalone.motion_fixtures import fixture as character_fixture


def run(output):
    verify_ui(ROOT);credits=build(check=True);output.mkdir(parents=True,exist_ok=False);rows=[]
    cases=[]
    for label,args in [('translated-texture',{}),('repeated-texture',dict(duplicate=True)),('missing-texture',dict(occluded=True))]:
        p=patch_fixture(**args);correct=deepcopy(p['motion_guides']['patch']);correct['handles'][0]['target']=[37.5,35.5];cases.append((label,p,'patch',correct,{'pattern'} if args.get('occluded') else set(),'source'))
    base=character_fixture();known=deepcopy(base['motion_guides']['arm-lift'])
    for variant in ['arm','occluded-hand','palette-change','new-visible-patch']:
        p=deepcopy(base)
        if variant!='arm':
            for layer in ['ink','paint']:
                pixels=p['drawings'][layer+'-end']['pixels']
                for y in range(160):
                    for x in range(128):
                        i=y*128+x
                        if variant=='occluded-hand' and 98<=x<=120 and 12<=y<=40:pixels[i]=[0,0,0,0]
                        if variant=='palette-change' and layer=='paint' and pixels[i][3]:pixels[i]=[pixels[i][2],pixels[i][0],pixels[i][1],pixels[i][3]]
                        if variant=='new-visible-patch' and layer=='paint' and 86<=x<92 and 41<=y<47:pixels[i]=[250,30,220,255]
                p['originals'][layer+'-end']=deepcopy(p['drawings'][layer+'-end'])
            p['originals_sha256']=fingerprint(p['originals'])
        for point in p['motion_guides']['arm-lift']['handles']:point['target']=point['source'][:]
        cases.append((variant,p,'arm-lift',deepcopy(known),{'hand'} if variant=='occluded-hand' else set(),'source'))
    rotated=character_fixture(False,180,180,(20,8));g=rotated['motion_guides']['arm-lift'];correct=deepcopy(g)
    for point in correct['handles']:point['target']=[180-point['source'][1],point['source'][0]]
    for layer in ['ink','paint']:
        a=np.asarray(rotated['drawings'][layer+'-start']['pixels'],np.uint8).reshape(180,180,4);rotated['drawings'][layer+'-end']['pixels']=np.rot90(a,-1).reshape(-1,4).tolist();rotated['originals'][layer+'-end']=deepcopy(rotated['drawings'][layer+'-end'])
    rotated['originals_sha256']=fingerprint(rotated['originals'])
    for point in g['handles']:point['target']=point['source'][:]
    cases.append(('quarter-turn',rotated,'arm-lift',correct,set(),'source'))
    hinted=deepcopy(rotated)
    for point,truth in zip(hinted['motion_guides']['arm-lift']['handles'],correct['handles']):point['target']=[truth['target'][0]+2,truth['target'][1]]
    cases.append(('quarter-turn-with-near-target-hints',hinted,'arm-lift',correct,set(),'current'))
    for name,p,gid,known,absent,around in cases:
        folder=output/name;folder.mkdir();w,h=p['canvas']['width'],p['canvas']['height'];source=render(p,0);expected=render(p,8)
        for label,pixels in [('source',source),('guide',expected)]:(folder/(label+'.png')).write_bytes(encode_png(w,h,pixels))
        settings=defaults(gid);settings['around']=around;r=propose(p,settings);truth={point['id']:point['target'] for point in known['handles']};items=[];decisions=[]
        for row in r['rows']:
            best=row['alternatives'][0] if row['alternatives'] else None;error=float(np.linalg.norm(np.asarray(best['target'])-truth[row['landmark_id']])) if best else None;correct=best is not None and row['landmark_id'] not in absent and error<=2;clear=row['status']=='clear_by_thresholds'
            items.append(dict(landmark_id=row['landmark_id'],expected_target=None if row['landmark_id'] in absent else truth[row['landmark_id']],actual_best=best,error_pixels=error,visible_correspondence_expected=row['landmark_id'] not in absent,within2px=correct,clear=clear,false_clear=clear and not correct,status=row['status'],gap=row.get('alternative_gap'),reverse_error=row.get('reverse_error'),warnings=row['warnings']))
            if clear:decisions.append(dict(landmark_id=row['landmark_id'],candidate_index=0,decision='accept'))
        simulated=review(p,r,decisions,'threshold-review') if decisions else deepcopy(p)
        manual=deepcopy(p);manual['motion_guides'][gid]=deepcopy(known)
        baselines=[]
        for label,project,mode in [('prior-guide',p,'rigid'),('manual-known-targets',manual,'rigid'),('manual-translation',manual,'translation'),('image-clear-only-review',simulated,'rigid')]:
            req=dict(guide_id=gid,mode=mode,progress=1,target_start=4,target_end=8,operation_id=None,allow_clip=False)
            try:
                result=pose_propose(project,req);pixels=render(project,0,{i:o['pixels'] for i,o in result['outputs'].items()});actual=np.asarray(pixels,np.uint8);gt=np.asarray(expected,np.uint8);a=actual[:,3]>0;b=gt[:,3]>0;union=np.count_nonzero(a|b)
                (folder/(label+'.png')).write_bytes(encode_png(w,h,pixels));entry=dict(name=label,status='previewed',silhouette_iou=float(np.count_nonzero(a&b)/union) if union else 1,rgba_different_pixels=int(np.count_nonzero(np.any(actual!=gt,axis=1))),unsafe_reasons=result['unsafe_reasons'])
                if name=='occluded-hand':entry['opaque_pixels_in_authored_absent_hand_box']=int(np.count_nonzero(actual.reshape(h,w,4)[12:41,98:121,3]))
                if name=='new-visible-patch':entry.update(new_unique_color_expected=int(np.count_nonzero(np.all(gt==[250,30,220,255],axis=1))),new_unique_color_actual=int(np.count_nonzero(np.all(actual==[250,30,220,255],axis=1))))
                baselines.append(entry)
            except ValueError as e:baselines.append(dict(name=label,status='refused',error=str(e)))
        row=dict(name=name,settings=settings,landmarks=len(items),source_points_supplied=len(known['handles']),target_hints_supplied=len(known['handles']) if around=='current' else 0,clear_candidates=sum(i['clear'] for i in items),correct_best=sum(i['within2px'] for i in items),false_clear=sum(i['false_clear'] for i in items),items=items,proposal=r,baselines=baselines);rows.append(row);(folder/'report.json').write_text(json.dumps(row,indent=2),encoding='utf-8')
    for fn in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/fn,output/fn)
    paths=['engine/correspondence.py','engine/motion.py','hosts/standalone/correspondence_fixtures.py','hosts/standalone/motion_fixtures.py','scripts/evaluate_correspondence.py']
    report=dict(status='completed',cases=len(rows),motion_comparisons=len(rows)*4,rows=rows,credits_snapshot_sha256=credits['snapshot_sha256'],source_hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths},scope='Original translated texture and geometric scarf-character pairs. Source points supplied; no automatic source-feature detection. Target hints counted separately. Known target landmarks are synthetic authorship, absent hand explicitly labelled. A clear-only review policy is simulated for evaluation, not automatic UI acceptance. Pixel/silhouette and identity errors separate. No external art, held-out generalization, learned-model execution/reproduction or artist time/effort claim.')
    (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps([dict(name=r['name'],clear=r['clear_candidates'],correct=r['correct_best'],false_clear=r['false_clear']) for r in rows]))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);args=parser.parse_args();run(args.output.resolve())
