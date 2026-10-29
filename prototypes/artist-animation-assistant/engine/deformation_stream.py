"""Independent bounded raster evaluation of credited point MLS (EXP0034).

No downscale or coarser inverse: every source center and output sample is checked.
One field (<=96MiB) is shared across layers/masks; RGBA is read/written by64px tile.
This is not a proof of continuous injectivity or semantic/artist-quality motion.
"""
import math,hashlib
import numpy as np
from engine.io.project_archive import PixelPlane,OverlayTiles,TILE

FIELD_LIMIT=96*1024**2
OUTPUT_LIMIT=256*1024**2
BAND=16


def _bands(rect,step=1):
    x0,y0,x1,y1=rect
    for y in range(y0,y1,BAND):
        yy,xx=np.mgrid[y+.5:min(y+BAND,y1):step,x0+.5:x1:step]
        yield y,np.column_stack((xx.ravel(),yy.ravel()))


def _field(w,h,roi,p,q,mode,checkpoint):
    from engine.deformation import points,inverse
    x0,y0,x1,y1=roi;rw,rh=x1-x0,y1-y0
    clipped=np.empty((rh,rw),bool);left,top,right,bottom=x0,y0,x1,y1
    for y,v in _bands(roi):
        checkpoint();forward=points(v,p,q,mode,checkpoint)
        clipped[y-y0:y-y0+min(BAND,y1-y)]=(~((forward[:,0]>=0)&(forward[:,0]<w)&(forward[:,1]>=0)&(forward[:,1]<h))).reshape(-1,rw)
        left=min(left,math.floor(float(forward[:,0].min())));top=min(top,math.floor(float(forward[:,1].min())))
        right=max(right,math.ceil(float(forward[:,0].max())+.5));bottom=max(bottom,math.ceil(float(forward[:,1].max())+.5))
    bounds=[max(0,left),max(0,top),min(w,right),min(h,bottom)];ow,oh=bounds[2]-bounds[0],bounds[3]-bounds[1]
    resident=2*rw*rh+4*ow*oh
    if resident>FIELD_LIMIT:raise ValueError('Shared motion field exceeds96MiB; current drawing is preserved')
    jac=dict(samples=0,fold_samples=0,minimum_jacobian=float('inf'),near_singular_samples=0)
    for _,v in _bands(roi,2):
        checkpoint();f=points(v,p,q,mode,checkpoint);dx=(points(v+[.02,0],p,q,mode,checkpoint)-f)/.02;dy=(points(v+[0,.02],p,q,mode,checkpoint)-f)/.02;det=dx[:,0]*dy[:,1]-dx[:,1]*dy[:,0]
        jac['samples']+=len(det);jac['fold_samples']+=int(np.count_nonzero(det<=0));jac['minimum_jacobian']=min(jac['minimum_jacobian'],float(det.min()));jac['near_singular_samples']+=int(np.count_nonzero(np.abs(det)<.01))
    mapping=np.full((oh,ow),-1,np.int32);seen=np.zeros(rw*rh,bool);failed=0;maximum=0.
    for y,grid in _bands(bounds):
        checkpoint();mapped,residual=inverse(grid,p,q,mode,checkpoint);valid=(mapped[:,0]>=x0)&(mapped[:,0]<x1)&(mapped[:,1]>=y0)&(mapped[:,1]<y1);good=valid&(residual<=.05)
        failed+=int(np.count_nonzero(valid&~good));maximum=max(maximum,float(residual[valid].max(initial=0)))
        index=((np.floor(mapped[good,1]).astype(np.int64)-y0)*rw+np.floor(mapped[good,0]).astype(np.int64)-x0);seen[index]=True
        mapping[y-bounds[1]:y-bounds[1]+min(BAND,bounds[3]-y)].reshape(-1)[good]=index
    for array in [mapping,seen,clipped]:array.setflags(write=False)
    return dict(index_map=mapping,seen=seen.reshape(rh,rw),clipped=clipped,output_roi=bounds,jac=jac,inverse_unresolved=failed,max_inverse_residual=maximum,field_bytes=resident,source_samples=rw*rh,output_samples=ow*oh,max_query_band_samples=BAND*max(rw,ow),output_pool={})


def _rectangles(rect):
    x0,y0,x1,y1=rect
    for ty in range(y0//TILE,(y1-1)//TILE+1):
        for tx in range(x0//TILE,(x1-1)//TILE+1):yield [max(x0,tx*TILE),max(y0,ty*TILE),min(x1,(tx+1)*TILE),min(y1,(ty+1)*TILE)],tx,ty


def _gather(plane,indices,roi):
    """At most4096 arbitrary source samples; no full source RGBA expansion."""
    x0,y0,x1,_=roi;rw=x1-x0;xx=indices%rw+x0;yy=indices//rw+y0;columns=(plane.width+TILE-1)//TILE;tiles=yy//TILE*columns+xx//TILE;out=np.empty((len(indices),4),np.uint8)
    for tile in np.unique(tiles):
        selected=tiles==tile;data=np.frombuffer(plane._store.get(plane.keys[int(tile)]),np.uint8).reshape(TILE,TILE,4);out[selected]=data[yy[selected]%TILE,xx[selected]%TILE]
    return out


def _apply(plane,protection,roi,field,allow_clip,checkpoint):
    w,h=plane.width,plane.height;x0,y0,x1,y1=roi;left,top,right,bottom=field['output_roi'];lost=clipped_ink=clipped_protection=0
    for rect,_,_ in _rectangles(roi):
        checkpoint();a,b,c,d=rect;rgba=np.frombuffer(plane.region_bytes(rect),np.uint8).reshape(d-b,c-a,4);flags=np.frombuffer(protection.region_bytes(rect),np.uint8).reshape(d-b,c-a,4)[:,:,0].astype(bool);sl=(slice(b-y0,d-y0),slice(a-x0,c-x0))
        lost+=int(np.count_nonzero(flags&~field['seen'][sl]));clipped_ink+=int(np.count_nonzero((rgba[:,:,3]>0)&field['clipped'][sl]));clipped_protection+=int(np.count_nonzero(flags&field['clipped'][sl]))
    stores=[OverlayTiles(plane._store),OverlayTiles(protection._store)];keys=[list(plane.keys),list(protection.keys)];columns=(w+TILE-1)//TILE;collision=outside_constraints=0
    for rect,tx,ty in _rectangles(field['output_roi']):
        checkpoint();a,b,c,d=rect;old=np.frombuffer(plane.region_bytes(rect),np.uint8).reshape(d-b,c-a,4);oldmask=np.frombuffer(protection.region_bytes(rect),np.uint8).reshape(d-b,c-a,4);yy,xx=np.mgrid[b:d,a:c];outside=~((xx>=x0)&(xx<x1)&(yy>=y0)&(yy<y1))
        collision+=int(np.count_nonzero(outside&(old[:,:,3]>0)));outside_constraints+=int(np.count_nonzero(outside&(oldmask[:,:,0]>0)))
        indices=field['index_map'][b-top:d-top,a-left:c-left];good=indices>=0;result=np.zeros_like(old);mask=np.zeros_like(oldmask)
        result[good]=_gather(plane,indices[good],roi);mask[:,:,0][good]=(_gather(protection,indices[good],roi)[:,0]!=0).astype(np.uint8)
        for i,(base,data) in enumerate([(plane,result),(protection,mask)]):
            index=ty*columns+tx;tile=np.frombuffer(base._store.get(base.keys[index]),np.uint8).reshape(TILE,TILE,4).copy();tile[b-ty*TILE:d-ty*TILE,a-tx*TILE:c-tx*TILE]=data;raw=tile.tobytes();identity=hashlib.sha256(raw).hexdigest();pool=field['output_pool']
            if identity not in pool:
                if (len(pool)+1)*TILE*TILE*4>OUTPUT_LIMIT:raise ValueError('Streamed output tile pool exceeds256MiB; current project is preserved')
                pool[identity]=raw
            keys[i][index]=stores[i].put(pool[identity])
    metrics=dict(field['jac'],identity=False,protected_lost=lost,clipped_protected=clipped_protection,clipped_ink=clipped_ink,unselected_ink=collision,unselected_constraints=outside_constraints,inverse_unresolved=field['inverse_unresolved'],max_inverse_residual=field['max_inverse_residual'],sampling='nearest source sample after bounded numerical inverse; no antialiasing or hidden-surface reconstruction',backend='streamed-world-mls-v1',field_bytes=field['field_bytes'],source_samples=field['source_samples'],output_samples=field['output_samples'],max_query_band_samples=field['max_query_band_samples'])
    unsafe=[]
    if metrics['fold_samples'] or metrics['near_singular_samples']:unsafe.append('sampled_fold_or_singularity')
    if metrics['inverse_unresolved']:unsafe.append('inverse_residual_unresolved')
    if collision:unsafe.append('unselected_source_ink_in_output')
    if outside_constraints:unsafe.append('unselected_artist_constraints_in_output')
    if lost or clipped_protection:unsafe.append('artist_constraint_lost_by_sampling_or_clipping')
    if clipped_ink and not allow_clip:unsafe.append('clipped_ink_requires_explicit_clip_choice')
    return dict(pixels=PixelPlane(w,h,keys[0],stores[0]),protected_mask=PixelPlane(w,h,keys[1],stores[1]),output_roi=field['output_roi'][:],unsafe_reasons=unsafe,metrics=metrics)


def warp(plane,protection,roi,source,target,mode='rigid',allow_clip=False,checkpoint=None,cache=None):
    from engine.deformation import checked_points,points
    checkpoint=checkpoint or (lambda:None)
    if not isinstance(plane,PixelPlane) or not isinstance(protection,PixelPlane) or (plane.width,plane.height)!=(protection.width,protection.height):raise ValueError('Packed source and spatial constraint planes required')
    w,h=plane.width,plane.height
    if len(roi)!=4 or any(type(v) is not int for v in roi) or not 0<=roi[0]<roi[2]<=w or not 0<=roi[1]<roi[3]<=h:raise ValueError('Source rectangle must be inside the packed canvas')
    if mode not in {'rigid','similarity','translation'}:raise ValueError('Choose rigid, similarity or translation comparison')
    p,q=checked_points(source,target)
    if not np.all((p[:,0]>=roi[0])&(p[:,0]<roi[2])&(p[:,1]>=roi[1])&(p[:,1]<roi[3])):raise ValueError('Source selection must contain the correspondence landmarks')
    checkpoint()
    if np.array_equal(p,q):return dict(pixels=plane,protected_mask=protection,output_roi=roi[:],unsafe_reasons=[],metrics=dict(identity=True,fold_samples=0,near_singular_samples=0,protected_lost=0,clipped_ink=0,max_inverse_residual=0))
    key=('streamed-world-mls-v1',w,h,tuple(roi),p.tobytes(),q.tobytes(),mode)
    if cache is not None and key in cache:field=cache[key]
    else:
        if cache:raise ValueError('A streamed geometry cache holds one field only; use a fresh cache for different geometry')
        field=_field(w,h,roi,p,q,mode,checkpoint)
        if cache is not None:cache[key]=field
    result=_apply(plane,protection,roi,field,allow_clip,checkpoint);result['metrics']['max_landmark_error']=float(np.linalg.norm(points(p,p,q,mode)-q,axis=1).max());return result
