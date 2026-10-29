"""Original synthetic cleanup task comparisons; no third-party art or models."""
import argparse
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import sys
import time

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from engine.cleanup import propose,defaults,topology
from engine.layers import source_over
from engine.io.png_codec import encode_png


def fixtures():
    width,height=64,40
    def blank():return [[0,0,0,0] for _ in range(width*height)]
    def line(shaky=True,pressure=False,texture=False,center=16):
        pixels=blank()
        for x in range(6,58):
            y=center+([0,1,0,-1][x%4] if shaky else 0)
            radius=3 if pressure and x>=32 else 1
            for yy in range(y-radius,y+radius+1):
                alpha=90+(x*17+yy*23)%121 if texture else 210
                pixels[yy*width+x]=[65,95,155,alpha]
        return pixels
    result={}
    result['shaky-colored']=(line(),{})
    result['pressure-change']=(line(pressure=True),{})
    result['intentional-texture']=(line(texture=True),dict(intent='Preserve pencil-like alpha grain; source is intentionally textured'))
    corner=blank()
    for x in range(10,34):
        for y in range(10,13):corner[y*width+x]=[175,85,45,255]
    for y in range(10,32):
        for x in range(31,34):corner[y*width+x]=[175,85,45,255]
    result['deliberate-corner']=(corner,dict(corner_pixels=[y*width+x for y in range(9,15) for x in range(29,36)]))
    branch=blank()
    for x in range(8,56):
        for y in range(9,12):branch[y*width+x]=[80,70,160,255]
    for y in range(10,34):
        for x in range(30,33):branch[y*width+x]=[80,70,160,255]
    result['junction']=(branch,{})
    loop=blank()
    for y in range(height):
        for x in range(width):
            radius=math.hypot((x-32)/18,(y-20)/11)
            if abs(radius-1)<=.105:loop[y*width+x]=[60,110,160,255]
    result['closed-loop']=(loop,{})
    overdraw=line(center=13);second=line(center=21)
    for i,p in enumerate(second):
        if p[3]:overdraw[i]=p
    result['parallel-overdraw']=(overdraw,dict(intended_component_count=1,intent='Two raw strokes were authored as one intended contour; procedural smoothing alone should not be counted as consolidation'))
    dots=line();dots[30*width+30]=[30,160,100,255];dots[30*width+45]=[90,90,100,255]
    result['tiny-detail-vs-noise']=(dots,dict(intentional_indices=[1950],noise_indices=[1965]))
    notch=line(shaky=False)
    for x in range(29,33):
        for y in range(height):notch[y*width+x]=[0,0,0,0]
        for y in range(18,21):notch[y*width+x]=[65,95,155,210]
    result['intentional-notch']=(notch,dict(keep_indices=[19*width+30],intent='Deliberate local notch, not random jitter'))
    result['selected-fragment']=(line(),dict(roi=[18,8,46,25]))
    result['white-paper']=(source_over([[255,255,255,255] for _ in range(width*height)],line()),dict(paper='white'))
    result['shaky-colored'][1]['known_horizontal_center']=16.5
    result['pressure-change'][1]['known_horizontal_center']=16.5
    result['intentional-texture'][1]['known_horizontal_center']=16.5
    result['selected-fragment'][1]['known_horizontal_center']=16.5
    result['white-paper'][1]['known_horizontal_center']=16.5
    return width,height,result


def opacity(pixels,paper):return [255-min(p[:3]) if paper=='white' else p[3] for p in pixels]


def metrics(source,result,width,height,metadata,settings):
    output=result['pixels'];paper=settings['paper'];old=opacity(source,paper);new=opacity(output,paper)
    mask={(i%width,i//width) for i,a in enumerate(new) if a>=settings['threshold']}
    report=dict(changed_pixels=result['metrics']['changed_pixels'],smoothed_components=result['metrics']['smoothed_components'],removed_components=result['metrics']['removed_components'],refused_components=result['metrics']['refused_components'],opacity_mass_ratio=sum(new)/max(1,sum(old)),topology_after=topology(mask,width,height),pixel_rms=math.sqrt(sum((a-b)**2 for a,b in zip(old,new))/len(old)),outside_selection_exact=True)
    roi=settings['roi']
    report['outside_selection_exact']=all(source[i]==output[i] for i in range(len(source)) if not(roi[0]<=i%width<roi[2] and roi[1]<=i//width<roi[3]))
    if 'intended_component_count' in metadata:
        report['intended_component_count']=metadata['intended_component_count']
        report['intended_consolidation_achieved']=report['topology_after']['components']==metadata['intended_component_count']
    if 'intentional_indices' in metadata:report['intentional_details_erased']=sum(output[i][3]==0 for i in metadata['intentional_indices'])
    if 'noise_indices' in metadata:report['noise_remaining']=sum(output[i][3]>0 for i in metadata['noise_indices'])
    if 'corner_pixels' in metadata:report['corner_pixels_changed']=sum(source[i]!=output[i] for i in metadata['corner_pixels'])
    if 'known_horizontal_center' in metadata:
        squared=[]
        for x in range(max(12,roi[0]+4),min(width-12,roi[2]-4)):
            total=sum(new[y*width+x] for y in range(height))
            if total:
                mean=sum((y+.5)*new[y*width+x] for y in range(height))/total
                squared.append((mean-metadata['known_horizontal_center'])**2)
        report['known_horizontal_center_rms']=math.sqrt(sum(squared)/len(squared)) if squared else None
    return report


def run(output):
    output.mkdir(parents=True,exist_ok=False);width,height,cases=fixtures();records=[]
    for name,(pixels,metadata) in cases.items():
        original=deepcopy(pixels);(output/(name+'-source.png')).write_bytes(encode_png(width,height,pixels))
        methods=[('unchanged',dict(iterations=0)),('contour-smoothing',{})]
        if name=='deliberate-corner':methods.append(('without-corner-anchors',dict(corner_angle=180)))
        if name=='tiny-detail-vs-noise':methods += [('area-removal',dict(max_remove_area=1)),('area-removal-with-keep',dict(max_remove_area=1,keep_pixels=metadata['intentional_indices']))]
        if name=='intentional-notch':methods.append(('keep-deliberate-notch',dict(keep_pixels=metadata['keep_indices'])))
        for method,changes in methods:
            settings=defaults(width,height)
            settings.update({k:metadata[k] for k in ['roi','paper'] if k in metadata});settings.update(changes)
            started=time.perf_counter();result=propose(pixels,width,height,settings);elapsed=time.perf_counter()-started
            record=dict(case=name,method=method,settings=settings,source_sha256=hashlib.sha256(json.dumps(pixels).encode()).hexdigest(),source_unchanged=pixels==original,metadata=metadata,metrics=metrics(pixels,result,width,height,metadata,settings),warnings=result['warnings'],elapsed_seconds=elapsed,timing_scope='Single tiny local execution; not a performance benchmark',component_outcomes=[{k:v for k,v in c.items() if k!='paths'} for c in result['components']])
            records.append(record)
            (output/(name+'-'+method+'.png')).write_bytes(encode_png(width,height,result['pixels']))
            (output/(name+'-'+method+'.json')).write_text(json.dumps(result,indent=2),encoding='utf-8')
    assert all(r['source_unchanged'] and r['metrics']['outside_selection_exact'] for r in records)
    report=dict(status='evaluated_with_task_limits',cases=len(cases),trials=len(records),records=records,source_sha256=hashlib.sha256((ROOT/'engine/cleanup.py').read_bytes()).hexdigest(),scope='Original deterministic geometric/texture fixtures; same family as invariant checks, not a held-out artist test. No learning, external art or executed comparison model. Centerline/opacity metrics are task-specific, not aesthetic confidence.',remaining='Intended-contour consolidation, construction-line meaning, lossless medium/pressure style and representative artist usefulness remain unproven; keep procedural/pretrained/adapted/custom-neural research available.')
    (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(dict(cases=len(cases),trials=len(records),semantic_overdraw=[r['metrics'].get('intended_consolidation_achieved') for r in records if r['case']=='parallel-overdraw'],intentional_dot_errors=[(r['method'],r['metrics']['intentional_details_erased']) for r in records if r['case']=='tiny-detail-vs-noise'])))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path)
    run(parser.parse_args().output.resolve())
