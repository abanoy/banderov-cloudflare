"""Hidden explicit-contour/visibility fixture and editable new-part study."""
from pathlib import Path
import argparse,hashlib,json,sys,time
import numpy as np
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))


def fixture():
    return dict(id='analytic_aperture',source=dict(x=[12,36,60,84],upper=[32,16,16,32],lower=[32,48,48,32],detail=dict(center=[48,32],radii=[8,16])),guide=dict(x=[12,36,60,84],upper=[32,32,32,32],lower=[32,32,32,32],detail=dict(center=[48,32],radii=[8,16])),fill_rgba=[255,255,255,255],detail_rgba=[0,0,0,255],ink_rgba=[0,0,0,255],ink_width=2)


def oracle(phase,samples=8):
    """Independent analytic parabola/ellipse truth, not production Bezier code.

    Equally spaced x controls imply x=12+72u, and y=32±48(1-phase)u(1-u).
    Closest boundary points solve the scalar stationarity equation using bounded
    Newton iteration. For this fixed fixture the squared distance is strictly
    convex over0..1; endpoints included. This is not an arbitrary-curve solver.
    """
    xx=np.arange(96*samples)/samples-.5+.5/samples;yy=np.arange(64*samples)/samples-.5+.5/samples;yy,xx=np.meshgrid(yy,xx,indexing='ij');u=(xx-12)/72;B=48*(1-phase)
    inside=(xx>=12)&(xx<=84)&(yy>32-B*u*(1-u))&(yy<32+B*u*(1-u));detail=inside&(((xx-48)/8)**2+((yy-32)/16)**2<=1);ink=np.zeros(xx.shape,bool)
    for sign in (-1,1):
        t=np.clip(u,0,1)
        for _ in range(20):
            py=32+sign*B*t*(1-t);dy=sign*B*(1-2*t);gradient=(12+72*t-xx)*72+(py-yy)*dy;curvature=72**2+dy**2+(py-yy)*(-2*sign*B);t=np.clip(t-gradient/curvature,0,1)
        distance=(12+72*t-xx)**2+(32+sign*B*t*(1-t)-yy)**2;ink|=distance<=1
    alpha=inside|ink;white=inside&~detail&~ink
    a=alpha.reshape(64,samples,96,samples).mean(axis=(1,3));p=white.reshape(64,samples,96,samples).mean(axis=(1,3));rgb=np.divide(p,a,out=np.zeros_like(p),where=a>0)
    image=np.empty((64,96,4),np.uint8);image[:,:,:3]=np.rint(rgb[:,:,None]*255).astype(np.uint8);image[:,:,3]=np.rint(a*255).astype(np.uint8)
    return image


def over_layers(result):
    rgb=np.zeros((64,96,3));alpha=np.zeros((64,96))
    for name in ('fill','detail','ink'):
        a=result['layers'][name].astype(float)/255;rgb=a[:,:,:3]*a[:,:,3:4]+rgb*(1-a[:,:,3:4]);alpha=a[:,:,3]+alpha*(1-a[:,:,3])
    image=np.zeros((64,96,4),np.uint8);image[:,:,:3]=np.rint(np.divide(rgb,alpha[:,:,None],out=np.zeros_like(rgb),where=alpha[:,:,None]>0)*255).astype(np.uint8);image[:,:,3]=np.rint(alpha*255).astype(np.uint8);return image


def study(output,source=None):
    from engine import contour_parts as parts
    from engine.project import create,validate,fingerprint
    from engine.layers import validate_layers
    from engine.spatial_constraints import uniform
    from engine.io.project_archive import PixelPlane
    from engine.line_quality import measure
    from engine.packed_render import render,png_bytes
    from hosts.standalone.session import Session
    from engine.jobs import atomic_write
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT);output=Path(output)
    if output.exists():raise ValueError('Choose a NEW private output directory')
    s=fixture();phases=[0,.25,.5,.75,1];results=[parts.render(s,96,64,t) for t in phases];images=[over_layers(r) for r in results]
    truths=[oracle(t) for t in phases];rows=[]
    output.mkdir(parents=True)
    for index,(phase,image,truth) in enumerate(zip(phases,images,truths)):
        # Premultiplied endpoint crossfade baseline, rather than hidden-RGB mixing.
        a,b=[v.astype(float)/255 for v in (images[0],images[-1])];alpha=(1-phase)*a[:,:,3]+phase*b[:,:,3];rgb=(1-phase)*a[:,:,:3]*a[:,:,3:4]+phase*b[:,:,:3]*b[:,:,3:4];mix=np.zeros_like(image);mix[:,:,:3]=np.rint(np.divide(rgb,alpha[:,:,None],out=np.zeros_like(rgb),where=alpha[:,:,None]>0)*255).astype(np.uint8);mix[:,:,3]=np.rint(alpha*255).astype(np.uint8)
        rows.append(dict(phase=phase,contour=measure(image,truth),hold_source=measure(images[0],truth),hold_guide=measure(images[-1],truth),crossfade=measure(mix,truth),geometry=results[index]['geometry'],visibility=results[index]['metrics']))
        for name,value in [('contour',image),('truth',truth),('crossfade',mix)]:
            (output/(name+'-'+str(index)+'.png')).write_bytes(png_bytes(96,64,value.tobytes()))
    # Organized editable fixture: one part group, three raster layers, five poses.
    base=create(uniform(96,64),96,64,len(phases));q,_=parts.preview_project(base,s,0,[0,0,96,64],0,1,'fixture-part')
    q['exposures']=[e for e in q['exposures'] if e['layer_id'] not in {'fixture-part-'+n for n in ('fill','detail','ink')}]
    # The sequence fully replaces only the newly created fixture exposures.
    # Its initial preview rasters/blank are unreferenced, not retained versions.
    for name in ('fill','detail','ink','blank'):del q['drawings']['fixture-part-'+name]
    for index,result in enumerate(results):
        for name in ('fill','detail','ink'):
            did='fixture-pose-'+str(index)+'-'+name;q['drawings'][did]=dict(pixels=PixelPlane.from_rgba(96,64,result['layers'][name].tobytes()),approved=False,locked=False,origin='unreviewed_contour_part');q['exposures'].append(dict(layer_id='fixture-part-'+name,drawing_id=did,start=index,length=1))
    q['history'].append(dict(action='explicit_contour_fixture_sequence',phases=phases,shape=s,approved=False,new_pose_states=5,source_ids=parts.SOURCES))
    validate(q);validate_layers(q);file=output/'editable-contour-sequence.aaa';Session(q).save(file);assert Session.load(file).project==q
    for index,image in enumerate(images):
        _,_,raw=render(q,index);assert np.max(np.abs(np.frombuffer(raw,np.uint8).astype(int)-image.ravel().astype(int)))<=1
    actual=None
    if source is not None:
        source=Path(source);before=hashlib.sha256(source.read_bytes()).hexdigest();project=Session.load(source).project;old=fingerprint(project)
        view,_=parts.preview_project(project,s,.5,[64,64,160,128],77,78,'exp43-new-part')
        assert fingerprint(project)==old and view['originals']==project['originals'] and all(view['drawings'][k]==v for k,v in project['drawings'].items()) and view['exposures'][:len(project['exposures'])]==project['exposures']
        assert all(view['drawings'][k]['approved'] is False for k in set(view['drawings'])-set(project['drawings']))
        path=output/'actual-animation-new-part-unapproved.aaa';Session(view).save(path);assert Session.load(path).project==view
        session=Session(project);session.commit(view,'Explicit new part');session.travel()
        assert all(session.project[k]==project[k] for k in project if k not in ('revision','dependency_epochs'))
        assert session.project['revision']>project['revision']
        pw,ph,raw=render(view,77,rectangle=[56,56,168,136]);(output/'actual-new-part.png').write_bytes(png_bytes(pw,ph,raw));assert hashlib.sha256(source.read_bytes()).hexdigest()==before
        actual=dict(source_sha256=before,source_unchanged=True,source_drawings_and_approvals_exact=True,existing_exposures_exact=True,exact_reopen=True,one_undo_artwork_and_structure_exact=True,undo_revision_monotonic=True,new_raster_assets=3,new_blank_assets=1,new_pose_states=1,placement=[64,64,160,128],interval=[77,78],scope='Explicit isolated synthetic new part, not repair or quality acceptance of an actual face. Actual closed-eye chevron may need a different contour graph; this strip subset is not asserted to model it.')
    report=dict(status='explicit-contour-visibility-fixture',accepted=False,artist_acceptance=False,default_changed=False,model_evaluations=0,rows=rows,actual_new_part=actual,credits_snapshot=credits['snapshot_sha256'],limitations='Known synthetic identities/control correspondence, flat materials and monotone paired cubic boundary subset. Oracle is independent analytic fixture geometry, not an artist-quality/generalization or rough-medium benchmark. No automatic landmark extraction, semantic eye model or surface inference.')
    atomic_write(output/'report.json',report);atomic_write(output/'shape.json',s)
    for name in ('CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt'):(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    return report


def main():
    p=argparse.ArgumentParser();p.add_argument('output',type=Path,nargs='?');p.add_argument('--source',type=Path);p.add_argument('--credits',action='store_true');a=p.parse_args()
    if a.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if a.output is None:p.error('Choose NEW private output directory')
    r=study(a.output,a.source);print(json.dumps(dict(status=r['status'],accepted=False,model_evaluations=0,phases=len(r['rows']),actual_new_part=r['actual_new_part'] is not None)))
if __name__=='__main__':main()
