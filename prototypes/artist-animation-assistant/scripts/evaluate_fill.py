from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import time

root=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(root),str(root/'tests')]
from engine.fill import propose,defaults
from engine.project import create,fingerprint
from engine.io.png_codec import encode_png
from engine.layers import source_over
from test_fill import fixture

import argparse
parser=argparse.ArgumentParser(description='Original synthetic fill comparisons; a NEW output directory is required')
parser.add_argument('output',type=Path)
args=parser.parse_args()
output=args.output.resolve()
output.mkdir(exist_ok=False)
records=[]
for name,options in [('closed',{}),('unintended-gap',dict(gap=True)),('intentional-opening',dict(gap=True)),('hole',dict(hole=True)),('scan-noise',{}),('antialias',{}),('white-paper',dict(paper=True)),('weak-ink',{})]:
    project=fixture(**options)
    pixels=deepcopy(project['drawings']['source']['pixels'])
    if name=='scan-noise': pixels[5*15+6]=[20,30,40,255]
    if name=='antialias': pixels[3*15+6]=[40,60,90,80]
    if name=='weak-ink': pixels[3*15+6]=[40,60,90,8]
    project=create(pixels,15,15,12)
    expected={y*15+x for y in range(4,11) for x in range(4,11)}
    if name=='intentional-opening': expected={i for i,p in enumerate(pixels) if p[3]<32}
    if name=='hole': expected-={y*15+x for y in range(6,9) for x in range(6,9)}
    if name=='scan-noise': expected.discard(5*15+6)
    before=fingerprint(project)
    (output/(name+'-source.png')).write_bytes(encode_png(15,15,pixels))
    methods=[('seed-only',{}),('closing-radius1',dict(gap_radius=1))]
    if name=='unintended-gap':methods.append(('manual-barrier',dict(add_barriers=[3*15+7])))
    if name=='intentional-opening':methods.append(('keep-open',dict(gap_radius=1,keep_open=[3*15+7])))
    if name=='weak-ink':methods.append(('lower-alpha-threshold',dict(threshold=1)))
    for method,changes in methods:
        settings=defaults([5,5],[70,130,220,255])
        settings.update(changes)
        if name=='white-paper':settings['paper']='white'
        start=time.perf_counter()
        try:
            result=propose(pixels,15,15,settings)
        except ValueError as error:
            records.append(dict(case=name,method=method,settings=settings,status='refused',reason=str(error),source_unchanged=fingerprint(project)==before,false_intentional_closure=False))
            continue
        elapsed=time.perf_counter()-start
        region=set(result['region'])
        record=dict(case=name,method=method,status='proposed',width=15,height=15,settings=settings,expected_area=len(expected),actual_area=len(region),intersection_over_union=len(region&expected)/len(region|expected),leak_pixels=len(region-expected),missed_pixels=len(expected-region),touches_edge=result['metrics']['touches_edge'],false_intentional_closure=name=='intentional-opening' and not result['metrics']['touches_edge'],source_unchanged=fingerprint(project)==before,source_ink_exact=result['ink']==pixels if name!='white-paper' else None,warnings=result['warnings'],elapsed_seconds=elapsed,timing_scope='Single tiny local method execution, not a performance benchmark',source_sha256=fingerprint(pixels))
        records.append(record)
        (output/(name+'-'+method+'.json')).write_text(json.dumps(result,indent=2),encoding='utf-8')
        (output/(name+'-'+method+'.png')).write_bytes(encode_png(15,15,source_over(result['fill'],result['ink'])))
assert all(r['source_unchanged'] for r in records)
assert next(r for r in records if r['case']=='closed' and r['method']=='seed-only')['intersection_over_union']==1
assert next(r for r in records if r['case']=='unintended-gap' and r['method']=='seed-only')['leak_pixels']>0
assert next(r for r in records if r['case']=='unintended-gap' and r['method']=='manual-barrier')['intersection_over_union']==1
assert next(r for r in records if r['case']=='intentional-opening' and r['method']=='closing-radius1')['false_intentional_closure']
assert next(r for r in records if r['case']=='intentional-opening' and r['method']=='keep-open')['intersection_over_union']==1
assert next(r for r in records if r['case']=='weak-ink' and r['method']=='lower-alpha-threshold')['intersection_over_union']==1
report=dict(status='completed_with_documented_failures',cases=8,method_trials=len(records),records=records,scope='Original synthetic deterministic geometric cases; same family as invariant tests, not a held-out artist set, no learning or representative effort claim',conclusions=['Seed-only leaks through a missing/weak barrier.','Geometric closing contains the simple accidental gap but falsely closes the identical intentional opening.','An explicit manual barrier or keep-open constraint resolves these chosen cases without changing source ink.','Weak-ink detection is threshold-sensitive; lower threshold fixes this fixture but is not a universal rule.','Invisible closure may leave a transparent gap pixel; edge-overlap is limited to actual ink, with no invented contour.'],code_sha256=hashlib.sha256((root/'engine/fill.py').read_bytes()).hexdigest())
(output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(dict(cases=8,method_trials=len(records),false_closures=[r['case'] for r in records if r['false_intentional_closure']])))
