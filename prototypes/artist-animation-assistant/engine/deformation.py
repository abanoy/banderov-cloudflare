"""Point MLS from REF-MLS-DEFORMATION, independently implemented from equations.

Weighted centroids/dot-cross similarity and rigid normalization: paper sections2.
Numerical inverse, sampling/constraint/collision guards below are project additions,
not the paper's uniform-quad renderer or performance reproduction. No author code.
"""
import numpy as np
from engine.io.project_archive import PixelPlane
from engine.roi_assistance import patch

SOURCES=['REF-NUMPY-NORM','REF-MLS-DEFORMATION','REF-KRITA-WARP','REF-NUMPY-2-4-1','REF-NUMPY-BUFFER','REF-PYTHON-COPY','REF-COMPOSITING']


def checked_points(source,target):
    p=np.asarray(source,dtype=np.float64);q=np.asarray(target,dtype=np.float64)
    if p.ndim!=2 or p.shape[1]!=2 or p.shape!=q.shape or not 1<=len(p)<=16 or not np.all(np.isfinite(p)) or not np.all(np.isfinite(q)) or np.max(np.abs(p))>16384 or np.max(np.abs(q))>16384:raise ValueError('Use1..16 finite matched2D landmarks within16384coordinate units')
    for a in [p,q]:
        distance=np.sum((a[:,None,:]-a[None,:,:])**2,axis=2);distance+=np.eye(len(a))*1e12
        if np.min(distance)<1e-12:raise ValueError('Duplicate/collapsed correspondences need explicit topology or visibility handling')
    return p,q


def points(query,source,target,mode='rigid',checkpoint=None):
    p,q=checked_points(source,target);v=np.asarray(query,dtype=np.float64)
    if v.ndim!=2 or v.shape[1]!=2 or not np.all(np.isfinite(v)):raise ValueError('Finite2D query points required')
    if mode not in {'rigid','similarity','translation'}:raise ValueError('Choose rigid, similarity or translation comparison')
    if np.array_equal(p,q):return v.copy()
    if mode=='translation' or len(p)==1:return v+np.mean(q-p,axis=0)
    result=np.empty_like(v)
    for start in range(0,len(v),4096):
        if checkpoint:checkpoint()
        vv=v[start:start+4096];dist=np.sum((vv[:,None,:]-p[None,:,:])**2,axis=2);w=1/np.maximum(dist,1e-12);w/=w.sum(axis=1)[:,None]
        pc=np.sum(w[:,:,None]*p,axis=1);qc=np.sum(w[:,:,None]*q,axis=1);pp=p-pc[:,None,:];qq=q-qc[:,None,:]
        a=np.sum(w*(pp[:,:,0]*qq[:,:,0]+pp[:,:,1]*qq[:,:,1]),axis=1);b=np.sum(w*(pp[:,:,0]*qq[:,:,1]-pp[:,:,1]*qq[:,:,0]),axis=1)
        den=np.hypot(a,b) if mode=='rigid' else np.sum(w*np.sum(pp*pp,axis=2),axis=1)
        exact=dist.min(axis=1)<1e-16;bad=(den<1e-14)&~exact
        if np.any(bad):raise ValueError('Locally singular deformation; move/correct the correspondences')
        den=np.maximum(den,1e-14);d=vv-pc
        mapped=np.column_stack((d[:,0]*a-d[:,1]*b,d[:,0]*b+d[:,1]*a))/den[:,None]+qc
        if np.any(exact):mapped[exact]=q[np.argmin(dist[exact],axis=1)]
        result[start:start+len(vv)]=mapped
    return result


def inverse(query,source,target,mode,checkpoint=None):
    """Bounded project Newton inverse; swapped MLS is INITIAL GUESS, not inverse."""
    v=np.asarray(query,dtype=np.float64);x=points(v,target,source,mode,checkpoint);eps=.01
    for _ in range(10):
        if checkpoint:checkpoint()
        f=points(x,source,target,mode,checkpoint);error=f-v
        if np.max(np.linalg.norm(error,axis=1),initial=0)<1e-5:break
        dx=(points(x+[eps,0],source,target,mode,checkpoint)-f)/eps;dy=(points(x+[0,eps],source,target,mode,checkpoint)-f)/eps
        determinant=dx[:,0]*dy[:,1]-dx[:,1]*dy[:,0];valid=np.abs(determinant)>1e-7;step=np.zeros_like(x)
        step[valid,0]=(dy[valid,1]*error[valid,0]-dy[valid,0]*error[valid,1])/determinant[valid]
        step[valid,1]=(-dx[valid,1]*error[valid,0]+dx[valid,0]*error[valid,1])/determinant[valid]
        length=np.linalg.norm(step,axis=1);step*=np.minimum(1,32/np.maximum(length,1e-12))[:,None];x-=step
    residual=np.linalg.norm(points(x,source,target,mode,checkpoint)-v,axis=1)
    return x,residual


def sampled_jacobian(roi,source,target,mode,checkpoint=None):
    x0,y0,x1,y1=roi;yy,xx=np.mgrid[y0+.5:y1:2,x0+.5:x1:2];v=np.column_stack((xx.ravel(),yy.ravel()));eps=.02
    f=points(v,source,target,mode,checkpoint);dx=(points(v+[eps,0],source,target,mode,checkpoint)-f)/eps;dy=(points(v+[0,eps],source,target,mode,checkpoint)-f)/eps
    det=dx[:,0]*dy[:,1]-dx[:,1]*dy[:,0]
    return dict(samples=len(det),fold_samples=int(np.count_nonzero(det<=0)),minimum_jacobian=float(np.min(det)),near_singular_samples=int(np.count_nonzero(np.abs(det)<.01)))


def warp(plane,protection,roi,source,target,mode='rigid',allow_clip=False,checkpoint=None,cache=None):
    """Bounded full-coordinate raster proposal; NEVER changes input tile stores."""
    if not isinstance(plane,PixelPlane) or not isinstance(protection,PixelPlane) or (plane.width,plane.height)!=(protection.width,protection.height):raise ValueError('Packed source and spatial constraint planes required')
    w,h=plane.width,plane.height;x0,y0,x1,y1=roi
    if all(type(i) is int for i in roi) and max(x1-x0,y1-y0)>256:
        from engine.deformation_stream import warp as streamed_warp
        return streamed_warp(plane,protection,roi,source,target,mode,allow_clip,checkpoint,cache)
    if any(type(i) is not int for i in roi) or not 0<=x0<x1<=w or not 0<=y0<y1<=h or max(x1-x0,y1-y0)>256:raise ValueError('Select a source rectangle<=256x256 inside the canvas')
    p,q=checked_points(source,target)
    if not np.all((p[:,0]>=x0)&(p[:,0]<x1)&(p[:,1]>=y0)&(p[:,1]<y1)):raise ValueError('Source selection must contain the correspondence landmarks')
    if np.array_equal(p,q):return dict(pixels=plane,protected_mask=protection,output_roi=roi[:],unsafe_reasons=[],metrics=dict(identity=True,fold_samples=0,near_singular_samples=0,protected_lost=0,clipped_ink=0,max_inverse_residual=0))
    cache_key=(w,h,tuple(roi),p.tobytes(),q.tobytes(),mode)
    if cache is not None and ('streamed-world-mls-v1',)+cache_key in cache:
        from engine.deformation_stream import warp as streamed_warp
        return streamed_warp(plane,protection,roi,p,q,mode,allow_clip,checkpoint,cache)
    if cache is not None and cache_key in cache:return _cached_warp(plane,protection,roi,cache[cache_key],allow_clip)
    jac=sampled_jacobian(roi,p,q,mode,checkpoint);yy,xx=np.mgrid[y0+.5:y1,x0+.5:x1];original=np.column_stack((xx.ravel(),yy.ravel()));forward=points(original,p,q,mode,checkpoint)
    raw=np.frombuffer(plane.region_bytes(roi),np.uint8).reshape(-1,4);flags=np.frombuffer(protection.region_bytes(roi),np.uint8).reshape(-1,4)[:,0].astype(bool)
    inside=(forward[:,0]>=0)&(forward[:,0]<w)&(forward[:,1]>=0)&(forward[:,1]<h);clipped_ink=int(np.count_nonzero(~inside&(raw[:,3]>0)));clipped_protection=int(np.count_nonzero(~inside&flags))
    left=max(0,min(x0,int(np.floor(np.min(forward[:,0])))));top=max(0,min(y0,int(np.floor(np.min(forward[:,1])))))
    right=min(w,max(x1,int(np.ceil(np.max(forward[:,0])+.5))));bottom=min(h,max(y1,int(np.ceil(np.max(forward[:,1])+.5))))
    output_roi=[left,top,right,bottom]
    if right<=left or bottom<=top:raise ValueError('Deformed output/source union is outside the canvas')
    if max(right-left,bottom-top)>512:
        from engine.deformation_stream import warp as streamed_warp
        return streamed_warp(plane,protection,roi,p,q,mode,allow_clip,checkpoint,cache)
    ow,oh=right-left,bottom-top;result=np.zeros((oh,ow,4),np.uint8);mask=np.zeros_like(result);seen=np.zeros(len(raw),bool);residuals=[];failed=0
    index_map=np.full((oh,ow),-1,dtype=np.int32)
    old=np.frombuffer(plane.region_bytes(output_roi),np.uint8).reshape(oh,ow,4);oldmask=np.frombuffer(protection.region_bytes(output_roi),np.uint8).reshape(oh,ow,4)
    oy,ox=np.mgrid[top:bottom,left:right];outside=~((ox>=x0)&(ox<x1)&(oy>=y0)&(oy<y1));collision=int(np.count_nonzero(outside&(old[:,:,3]>0)));outside_constraints=int(np.count_nonzero(outside&(oldmask[:,:,0]>0)))
    for start in range(0,oh,16):
        if checkpoint:checkpoint()
        by,bx=np.mgrid[top+start+.5:min(top+start+16,bottom),left+.5:right];grid=np.column_stack((bx.ravel(),by.ravel()));mapped,residual=inverse(grid,p,q,mode,checkpoint)
        valid=(mapped[:,0]>=x0)&(mapped[:,0]<x1)&(mapped[:,1]>=y0)&(mapped[:,1]<y1);good=valid&(residual<=.05);failed+=int(np.count_nonzero(valid&~good));residuals.extend(residual[valid].tolist())
        index=((np.floor(mapped[good,1]).astype(int)-y0)*(x1-x0)+np.floor(mapped[good,0]).astype(int)-x0);seen[index]=True
        index_map[start:start+by.shape[0]].reshape(-1)[good]=index
        band=result[start:start+by.shape[0]].reshape(-1,4);band[good]=raw[index];m=mask[start:start+by.shape[0]].reshape(-1,4);m[good,0]=flags[index].astype(np.uint8)
    unsafe=[]
    if jac['fold_samples'] or jac['near_singular_samples']:unsafe.append('sampled_fold_or_singularity')
    if failed:unsafe.append('inverse_residual_unresolved')
    if collision:unsafe.append('unselected_source_ink_in_output')
    if outside_constraints:unsafe.append('unselected_artist_constraints_in_output')
    lost=int(np.count_nonzero(flags&~seen))
    if lost or clipped_protection:unsafe.append('artist_constraint_lost_by_sampling_or_clipping')
    if clipped_ink and not allow_clip:unsafe.append('clipped_ink_requires_explicit_clip_choice')
    landmark_error=np.linalg.norm(points(p,p,q,mode)-q,axis=1)
    metrics=dict(jac,identity=False,protected_lost=lost,clipped_protected=clipped_protection,clipped_ink=clipped_ink,unselected_ink=collision,unselected_constraints=outside_constraints,inverse_unresolved=failed,max_inverse_residual=max(residuals,default=0),max_landmark_error=float(np.max(landmark_error)),sampling='nearest source sample after bounded numerical inverse; no antialiasing or hidden-surface reconstruction')
    if cache is not None:cache[cache_key]=dict(index_map=index_map,seen=seen,forward=forward,output_roi=output_roi,metrics=metrics,jac=jac)
    return dict(pixels=patch(plane,output_roi,result.tobytes()),protected_mask=patch(protection,output_roi,mask.tobytes()),output_roi=output_roi,unsafe_reasons=unsafe,metrics=metrics)


def _cached_warp(plane,protection,roi,mapping,allow_clip):
    """Share one geometry/inverse evaluation across editable ink/fills/masks."""
    x0,y0,x1,y1=roi;left,top,right,bottom=mapping['output_roi'];oh,ow=bottom-top,right-left
    raw=np.frombuffer(plane.region_bytes(roi),np.uint8).reshape(-1,4);flags=np.frombuffer(protection.region_bytes(roi),np.uint8).reshape(-1,4)[:,0].astype(bool)
    grid=mapping['index_map'];good=grid>=0;index=grid[good];result=np.zeros((oh,ow,4),np.uint8);result[good]=raw[index];mask=np.zeros_like(result);mask[:,:,0][good]=flags[index].astype(np.uint8)
    old=np.frombuffer(plane.region_bytes(mapping['output_roi']),np.uint8).reshape(oh,ow,4);oldmask=np.frombuffer(protection.region_bytes(mapping['output_roi']),np.uint8).reshape(oh,ow,4)
    yy,xx=np.mgrid[top:bottom,left:right];outside=~((xx>=x0)&(xx<x1)&(yy>=y0)&(yy<y1));collision=int(np.count_nonzero(outside&(old[:,:,3]>0)));outside_constraints=int(np.count_nonzero(outside&(oldmask[:,:,0]>0)))
    f=mapping['forward'];inside=(f[:,0]>=0)&(f[:,0]<plane.width)&(f[:,1]>=0)&(f[:,1]<plane.height);clipped_ink=int(np.count_nonzero(~inside&(raw[:,3]>0)));clipped_protection=int(np.count_nonzero(~inside&flags));lost=int(np.count_nonzero(flags&~mapping['seen']))
    metrics=dict(mapping['metrics'],protected_lost=lost,clipped_protected=clipped_protection,clipped_ink=clipped_ink,unselected_ink=collision,unselected_constraints=outside_constraints)
    unsafe=[]
    if metrics['fold_samples'] or metrics['near_singular_samples']:unsafe.append('sampled_fold_or_singularity')
    if metrics['inverse_unresolved']:unsafe.append('inverse_residual_unresolved')
    if collision:unsafe.append('unselected_source_ink_in_output')
    if outside_constraints:unsafe.append('unselected_artist_constraints_in_output')
    if lost or clipped_protection:unsafe.append('artist_constraint_lost_by_sampling_or_clipping')
    if clipped_ink and not allow_clip:unsafe.append('clipped_ink_requires_explicit_clip_choice')
    return dict(pixels=patch(plane,mapping['output_roi'],result.tobytes()),protected_mask=patch(protection,mapping['output_roi'],mask.tobytes()),output_roi=mapping['output_roi'][:],unsafe_reasons=unsafe,metrics=metrics)
