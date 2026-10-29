"""Explicit hidden local guided-contour study; source never overwritten."""
from pathlib import Path
import argparse,hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))


def study(source,guide_file,output):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT)
    import numpy as np
    from engine.guided_contours import alternatives,raster_path
    from engine.io.png_codec import read_png,encode_png
    from engine.io.project_archive import PixelPlane,SourceBlob
    from engine.project import create,fingerprint
    from hosts.standalone.session import Session
    source,guide_file,output=map(Path,(source,guide_file,output))
    if output.exists():raise ValueError('Study output must be NEW')
    if source.stat().st_size>64*1024**2 or guide_file.stat().st_size>32768:raise ValueError('Input budget exceeded')
    raw=source.read_bytes();source_hash=hashlib.sha256(raw).hexdigest()
    if len(raw)>64*1024**2:raise ValueError('Input grew beyond budget')
    w,h,plane=read_png(raw,packed=True)
    config=json.loads(guide_file.read_text(encoding='utf-8'))
    if set(config)-{'roi','guide','radius','guide_author','note'}:raise ValueError('Unknown guide field')
    roi=config['roi']
    if not isinstance(roi,list) or len(roi)!=4 or any(type(v) is not int for v in roi):raise ValueError('Integer ROI required')
    x0,y0,x1,y1=roi;cw,ch=x1-x0,y1-y0
    if not 0<=x0<x1<=w or not 0<=y0<y1<=h or not all(2<=v<=256 for v in (cw,ch)):raise ValueError('Explicit2..256side ROI required')
    if config.get('guide_author') not in {'developer-hint','artist-supplied'}:raise ValueError('Declare guide authorship')
    crop=np.frombuffer(plane.region_bytes(roi),np.uint8).reshape(ch,cw,4)
    result=alternatives(crop,config['guide'],radius=config.get('radius',8))
    project=create(plane,w,h);project['project_id']='private-guided-contour-study'
    project['layers']['ink'].update(name='Unchanged source preview',order=10,locked=True)
    project['guided_contour_study']=dict(config=config,source_png=SourceBlob(raw),source_sha256=source_hash,alternatives=result,credits_snapshot=credits['snapshot_sha256'],accepted=False,method='independent-guided-ribbon-second-order-dp',source_ids=['REF-INTELLIGENT-SCISSORS','REF-NUMPY-2-4-1','REF-PNG','REF-OWNER-PRIVATE-SAMPLES'])
    original_fingerprint=project['originals_sha256']
    output.mkdir(parents=True,exist_ok=False)
    (output/'source-crop.png').write_bytes(encode_png(cw,ch,crop.reshape(-1,4).tolist()))
    for rank,item in enumerate(result):
        name=item['name'];points=[[x+x0,y+y0] for x,y in item['points']]
        drawing=PixelPlane.from_rgba(w,h,raster_path(points,w,h).tobytes())
        project['layers'][name]=dict(name='UNAPPROVED geometry: '+name,order=rank,visible=name=='regularized',locked=False)
        project['drawings'][name]=dict(pixels=drawing,origin='guided_geometry_proposal',approved=False,locked=False)
        project['exposures'].append(dict(layer_id=name,drawing_id=name,start=0,length=1))
        ink=raster_path(item['points'],cw,ch)
        overlay=crop.copy();mask=ink[:,:,3]>0;overlay[mask,:3]=ink[mask,:3];overlay[mask,3]=255
        (output/(name+'-overlay.png')).write_bytes(encode_png(cw,ch,overlay.reshape(-1,4).tolist()))
        (output/(name+'-geometry.png')).write_bytes(encode_png(cw,ch,ink.reshape(-1,4).tolist()))
    # Preparation artifacts are private exact originals; embed when this is a
    # decoder output, with integrity checks rather than a name-only assumption.
    if (source.parent/'report.json').is_file() and (source.parent/'original.jpg').is_file():
        if (source.parent/'report.json').stat().st_size>131072 or (source.parent/'original.jpg').stat().st_size>32*1024**2:raise ValueError('Preparation artifact budget exceeded')
        report=json.loads((source.parent/'report.json').read_text(encoding='utf-8'))
        if report.get('preview_png_sha256')!=source_hash:raise ValueError('Photo preview differs from preparation record')
        original=(source.parent/'original.jpg').read_bytes()
        if hashlib.sha256(original).hexdigest()!=report['source_sha256']:raise ValueError('Original JPEG identity differs')
        retained=dict(report=report,jpeg=SourceBlob(original))
        for name,key in [('source-profile.icc','source_profile_sha256'),('preview-profile.icc','preview_profile_sha256')]:
            if report.get(key):
                if (source.parent/name).stat().st_size>1024**2:raise ValueError('Profile budget exceeded')
                data=(source.parent/name).read_bytes()
                if hashlib.sha256(data).hexdigest()!=report[key]:raise ValueError('Retained ICC identity differs')
                retained[name]=SourceBlob(data)
        project['guided_contour_study']['photo_preparation']=retained
    session=Session(project);session.save(output/'study.aaa')
    reopened=Session.load(output/'study.aaa')
    assert reopened.project==session.project
    assert reopened.project['originals_sha256']==original_fingerprint
    assert source.read_bytes()==raw
    # An actual paint correction on proposal ink, one-action undo, exact reopen.
    reopened.layer_id='regularized';before=fingerprint(reopened.project['drawings']);reopened.correct({y0*w+x0:[210,30,60,180]});assert fingerprint(reopened.project['drawings'])!=before;reopened.travel();assert fingerprint(reopened.project['drawings'])==before
    summary=dict(status='unapproved-guided-geometry-study',source_sha256=source_hash,canvas=[w,h],roi=roi,guide_author=config['guide_author'],alternatives=[dict(name=r['name'],metrics=r['metrics'],equivalent_to=r['equivalent_to']) for r in result],source_unchanged=True,originals_unchanged=True,editable_proposal_paint_undo=True,exact_reopen=True,credits_snapshot=credits['snapshot_sha256'],limitations=list(dict.fromkeys(w for r in result for w in r['warnings'])))
    (output/'report.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    (output/'paths.json').write_text(json.dumps(dict(config=config,alternatives=result),indent=2)+'\n',encoding='utf-8')
    for name in ['CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    runs=output/'provenance/runs';runs.mkdir(parents=True)
    (runs/'guided-contour.json').write_text(json.dumps(dict(summary,guide_sha256=hashlib.sha256(guide_file.read_bytes()).hexdigest(),output_sha256=hashlib.sha256((output/'study.aaa').read_bytes()).hexdigest(),source_ids=project['guided_contour_study']['source_ids'],network_allowed=False),indent=2)+'\n',encoding='utf-8')
    return summary


def main():
    parser=argparse.ArgumentParser();parser.add_argument('source',nargs='?',type=Path);parser.add_argument('guide',nargs='?',type=Path);parser.add_argument('output',nargs='?',type=Path);parser.add_argument('--credits',action='store_true');args=parser.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not all((args.source,args.guide,args.output)):parser.error('Provide PNG, guide JSON and NEW private output')
    print(json.dumps(study(args.source,args.guide,args.output)))


if __name__=='__main__':main()
