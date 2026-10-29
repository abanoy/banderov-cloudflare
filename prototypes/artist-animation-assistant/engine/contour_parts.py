"""Explicit cubic-strip shape/visibility proposals, EXP0043 (research subset).

REF-SVG-CUBIC-PATHS/PAINT-STROKE, REF-CSS-CLIPPING, REF-PBRT-SAMPLING,
REF-COMPOSITING. Independent implementation; not an SVG/CSS renderer, anatomical
detector or pencil-medium model. No source pixels, approvals or timeline are edited.
"""
from copy import deepcopy
import math
import numpy as np

SOURCES=['REF-SVG-CUBIC-PATHS','REF-SVG-PAINT-STROKE','REF-CSS-CLIPPING',
         'REF-PBRT-SAMPLING','REF-COMPOSITING','REF-NUMPY-2-4-1','REF-PYTHON-COPY']


def _finite(x):return type(x) in (int,float) and math.isfinite(x)


def validate(shape,width,height):
    if any(type(v) is not int or not 2<=v<=512 for v in (width,height)):
        raise ValueError('Use an explicit2..512pixel part ROI')
    fields={'id','source','guide','fill_rgba','detail_rgba','ink_rgba','ink_width'}
    if not isinstance(shape,dict) or set(shape)!=fields:
        raise ValueError('Declare part id, source/guide geometry and explicit materials/width')
    name=shape['id']
    if not isinstance(name,str) or not 1<=len(name)<=48 or not name.isascii() or not name.replace('_','').replace('-','').isalnum():
        raise ValueError('Use a short explicit part identity')
    if not _finite(shape['ink_width']) or not 0<=shape['ink_width']<=16:
        raise ValueError('Explicit ink width0..16required')
    for key in ('fill_rgba','detail_rgba','ink_rgba'):
        c=shape[key]
        if not isinstance(c,list) or len(c)!=4 or any(type(v) is not int or not 0<=v<=255 for v in c):
            raise ValueError('Explicit RGBA8 material required')
    margin=shape['ink_width']/2+.5
    for which in ('source','guide'):
        g=shape[which]
        if not isinstance(g,dict) or set(g)!={'x','upper','lower','detail'}:
            raise ValueError('Declare matched x, upper, lower controls and retained detail')
        for key,limit in [('x',width),('upper',height),('lower',height)]:
            v=g[key]
            if not isinstance(v,list) or len(v)!=4 or any(not _finite(n) or not margin<=n<=limit-1-margin for n in v):
                raise ValueError('Four finite cubic controls must fit ROI including stroke/sample margin')
        if any(b-a<.25 for a,b in zip(g['x'],g['x'][1:])):
            raise ValueError('Matched x controls must strictly increase by at least0.25pixel')
        if any(u>l for u,l in zip(g['upper'],g['lower'])) or any(g['upper'][i]!=g['lower'][i] for i in (0,3)):
            raise ValueError('Upper/lower controls cannot cross and must share both corners')
        d=g['detail']
        if d is not None:
            if not isinstance(d,dict) or set(d)!={'center','radii'} or any(not isinstance(d[k],list) or len(d[k])!=2 or any(not _finite(v) for v in d[k]) for k in d):
                raise ValueError('Explicit retained ellipse center/radii required')
            if any(not .25<=v<=256 for v in d['radii']) or any(not .5<=d['center'][i]-d['radii'][i] or d['center'][i]+d['radii'][i]>limit-1.5 for i,limit in enumerate((width,height))):
                raise ValueError('Retained ellipse must fit ROI, even while occluded')
    if (shape['source']['detail'] is None)!=(shape['guide']['detail'] is None):
        raise ValueError('Supply latent geometry at both keys; missing correspondence is not inferred')
    return deepcopy(shape)


def geometry(shape,width,height,progress):
    s=validate(shape,width,height)
    if not _finite(progress) or not 0<=progress<=1:raise ValueError('Explicit shape progress0..1required')
    if progress in (0,1):return deepcopy(s['source' if progress==0 else 'guide'])
    a,b=s['source'],s['guide'];blend=lambda x,y:[float((1-progress)*u+progress*v) for u,v in zip(x,y)]
    result={k:blend(a[k],b[k]) for k in ('x','upper','lower')}
    result['detail']=None if a['detail'] is None else {k:blend(a['detail'][k],b['detail'][k]) for k in ('center','radii')}
    return result


def cubic(values,t):
    # Independent de Casteljau evaluation; shared endpoint semantics with W3C.
    a,b,c,d=values;v=1-t
    return v*(v*(v*a+t*b)+t*(v*b+t*c))+t*(v*(v*b+t*c)+t*(v*c+t*d))


def _polyline(x,y):
    p=np.column_stack((x,y));second=6*np.diff(p,n=2,axis=0)
    bound=float(np.linalg.norm(second,axis=1).max());n=max(8,math.ceil(math.sqrt(bound/(8*.05))))
    if n>512:raise ValueError('Curve flattening exceeds512segment budget')
    t=np.linspace(0,1,n+1)
    return np.column_stack((cubic(x,t),cubic(y,t))),bound/(8*n*n)


def render(shape,width,height,progress,checkpoint=None,*,samples=4):
    """Separate fill/detail/ink RGBA8 arrays, each <=512square, unapproved.

    Convex control ordering keeps the two boundaries from crossing for all phases
    in this explicit monotone-strip subset. A completely closed aperture has zero
    interior, retaining the latent detail geometry for subsequent reopening.
    """
    s=validate(shape,width,height);g=geometry(s,width,height,progress)
    if type(samples) is not int or samples not in (1,2,4,8):raise ValueError('Coverage samples must be1,2,4or8per axis')
    checkpoint=checkpoint or (lambda:None);checkpoint()
    upper,error0=_polyline(g['x'],g['upper']);lower,error1=_polyline(g['x'],g['lower'])
    arrays={k:np.zeros((height,width,4),np.uint8) for k in ('fill','detail','ink')}
    totals=dict(aperture_samples=0,unclipped_detail_samples=0,visible_detail_samples=0)
    for y in range(0,height,8):
        checkpoint();rows=min(8,height-y);xx=np.arange(width*samples)/samples-.5+.5/samples
        yy=y+np.arange(rows*samples)/samples-.5+.5/samples;yy,xx=np.meshgrid(yy,xx,indexing='ij')
        lo=np.zeros(xx.shape);hi=np.ones(xx.shape)
        for _ in range(32):
            t=(lo+hi)/2;left=cubic(g['x'],t)<xx;lo=np.where(left,t,lo);hi=np.where(left,hi,t)
        t=(lo+hi)/2;top=cubic(g['upper'],t);bottom=cubic(g['lower'],t)
        inside=(xx>=g['x'][0])&(xx<=g['x'][-1])&(yy>top)&(yy<bottom)
        latent=np.zeros(xx.shape,bool)
        if g['detail'] is not None:
            center=g['detail']['center'];radii=g['detail']['radii'];latent=((xx-center[0])/radii[0])**2+((yy-center[1])/radii[1])**2<=1
        detail=latent&inside;ink=np.zeros(xx.shape,bool)
        if s['ink_width']:
            for points in (upper,lower):
                for index,(a,b) in enumerate(zip(points,points[1:])):
                    if index%16==0:checkpoint()
                    d=b-a;u=np.clip(((xx-a[0])*d[0]+(yy-a[1])*d[1])/float(d@d),0,1)
                    ink|=(xx-a[0]-u*d[0])**2+(yy-a[1]-u*d[1])**2<=(s['ink_width']/2)**2
        totals['aperture_samples']+=int(inside.sum());totals['unclipped_detail_samples']+=int(latent.sum());totals['visible_detail_samples']+=int(detail.sum())
        # Integrate visible contributions at common sample positions, then rebuild
        # separate layers using quantized remaining alpha. Averaging masks separately
        # and naively compositing would over-cover shared antialiased clip edges.
        trans=np.ones(xx.shape);remaining=np.ones((rows,width))
        for name,mask in [('ink',ink),('detail',detail),('fill',inside)]:
            colour=np.array(s[name+'_rgba'],float);alpha=mask*(colour[3]/255)
            contribution=(alpha*trans).reshape(rows,samples,width,samples).mean(axis=(1,3));trans*=1-alpha
            value=np.divide(contribution,remaining,out=np.zeros_like(remaining),where=remaining>1e-12)
            layer=arrays[name][y:y+rows];layer[:,:,3]=np.rint(np.clip(value,0,1)*255).astype(np.uint8)
            layer[:,:,:3]=np.where(layer[:,:,3:4]>0,colour[:3],0).astype(np.uint8);remaining*=1-layer[:,:,3]/255
    metrics=dict(totals,visible_detail_area=totals['visible_detail_samples']/samples**2,
        clipped_detail_area=(totals['unclipped_detail_samples']-totals['visible_detail_samples'])/samples**2,
        samples_per_pixel=samples**2,maximum_boundary_chord_error_native=max(error0,error1),
        subset='Explicit matched monotone cubic boundaries; not arbitrary anatomical/semantic correspondence')
    return dict(layers=arrays,geometry=g,metrics=metrics,approved=False,source_ids=SOURCES[:],
        warnings=['Flat solid RGBA materials and explicit latent detail only; no pencil texture or inferred anatomy.',
                  'Known controls constrain this shape subset; actual stylized eye graphs may require different topology.',
                  'Shape progress is separate from exposure timing. No source project is changed or approved.'])


def preview_project(project,shape,progress,placement,start,end,identity,checkpoint=None):
    """Add a NEW unapproved three-layer part/domain; never replace an existing one.

    This is explicit new-part guidance, not repair of an inferred eye or hidden
    overwrite of approved art. Existing IDs refuse, preserving later corrections.
    """
    from engine.project import validate as validate_project,fingerprint
    from engine.layers import validate_layers
    from engine.packed_model import check_budget
    from engine.spatial_constraints import uniform
    from engine.io.project_archive import PixelPlane,OverlayTiles,TILE
    validate_project(project);validate_layers(project);checkpoint=checkpoint or (lambda:None)
    if project['schema_version']!='0.2':raise ValueError('Explicit compact project required')
    w,h=project['canvas']['width'],project['canvas']['height'];duration=project['shot']['duration_frames']
    if not isinstance(placement,list) or len(placement)!=4 or any(type(n) is not int for n in placement) or not 0<=placement[0]<placement[2]<=w or not 0<=placement[1]<placement[3]<=h:
        raise ValueError('Explicit native placement rectangle must fit canvas')
    if any(type(v) is not int for v in (start,end)) or not 0<=start<end<=duration:
        raise ValueError('New-part exposure interval must fit shot')
    if not isinstance(identity,str) or not 1<=len(identity)<=40 or not identity.isascii() or not identity.replace('_','').replace('-','').isalnum():
        raise ValueError('Safe unique new-part operation identity required')
    ids=[identity]+[identity+'-'+n for n in ('fill','detail','ink','blank')]
    if any(i in project['layers'] or i in project['drawings'] for i in ids):
        raise ValueError('New-part identity already exists; preserve its edits and choose a new version')
    if len(project['layers'])+4>32 or len(project['drawings'])+4>512:
        raise ValueError('New part exceeds retained layer/drawing capacity')
    x0,y0,x1,y1=placement;result=render(shape,x1-x0,y1-y0,progress,checkpoint)
    q=deepcopy(project);blank=uniform(w,h);q['drawings'][identity+'-blank']=dict(pixels=blank,approved=False,locked=False,origin='unreviewed_contour_part_blank')
    order=min((n.get('order',0) for n in q['layers'].values() if n.get('parent_id') is None),default=0)-1
    q['layers'][identity]=dict(name='Unapproved contour part: '+shape['id'],nodetype='grouplayer',order=order,opacity=255,isolation='isolate',visible=True,locked=False)
    columns=(w+TILE-1)//TILE
    for z,name in enumerate(('fill','detail','ink')):
        checkpoint();store=OverlayTiles(blank._store);keys=list(blank.keys);array=result['layers'][name]
        for ty in range(y0//TILE,(y1-1)//TILE+1):
            for tx in range(x0//TILE,(x1-1)//TILE+1):
                checkpoint();left,right=max(x0,tx*TILE),min(x1,(tx+1)*TILE);top,bottom=max(y0,ty*TILE),min(y1,(ty+1)*TILE)
                tile=np.zeros((TILE,TILE,4),np.uint8);tile[top-ty*TILE:bottom-ty*TILE,left-tx*TILE:right-tx*TILE]=array[top-y0:bottom-y0,left-x0:right-x0]
                keys[ty*columns+tx]=store.put(tile.tobytes())
        lid=identity+'-'+name;q['layers'][lid]=dict(name=name.title(),nodetype='paintlayer',parent_id=identity,order=2-z,opacity=255,visible=True,locked=False)
        q['drawings'][lid]=dict(pixels=PixelPlane(w,h,keys,store),approved=False,locked=False,origin='unreviewed_contour_part')
        if start:q['exposures'].append(dict(layer_id=lid,drawing_id=identity+'-blank',start=0,length=start))
        q['exposures'].append(dict(layer_id=lid,drawing_id=lid,start=start,length=end-start))
        if end<duration:q['exposures'].append(dict(layer_id=lid,drawing_id=identity+'-blank',start=end,length=duration-end))
    q['history'].append(dict(action='unapproved_new_contour_part',identity=identity,shape=deepcopy(shape),progress=progress,placement=placement[:],start=start,end=end,source=fingerprint(project),source_ids=SOURCES[:],new_pose_states=1,new_raster_assets=3,blank_assets=1,approved=False))
    validate_project(q);validate_layers(q);check_budget(q)
    return q,result
