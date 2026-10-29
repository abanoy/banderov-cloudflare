"""Independent bounded guided-ribbon path experiment; REF-INTELLIGENT-SCISSORS.

Not a reproduction of LiveWire or semantic sketch cleanup. Input pixels never
change. Guides/alternatives are explicit geometry; no pen history is inferred.
"""
import math
import numpy as np


def _sample(ink, xy):
    h,w=ink.shape
    x,y=xy[...,0],xy[...,1]
    valid=(x>=0)&(y>=0)&(x<=w-1)&(y<=h-1)
    x=np.clip(x,0,w-1);y=np.clip(y,0,h-1)
    ix=np.floor(x).astype(int);iy=np.floor(y).astype(int)
    fx=x-ix;fy=y-iy
    result=(ink[iy,ix]*(1-fx)*(1-fy)+ink[iy,np.minimum(ix+1,w-1)]*fx*(1-fy)+ink[np.minimum(iy+1,h-1),ix]*(1-fx)*fy+ink[np.minimum(iy+1,h-1),np.minimum(ix+1,w-1)]*fx*fy)
    return result,valid


def trace(rgba, guide, *, radius=8, continuity=.06, bend=.4, bundle_width=0, checkpoint=None):
    """Return pinned open-path alternatives in one <=512square crop.

    Cost = negative five-sample along-guide dark support + offset preference +
    first/second offset differences. Acyclic second-order DP; not full2Dsearch.
    Budgets cap1024samples,33offsets; checkpoints at each row. Endpoint offsets0.
    """
    a=np.asarray(rgba)
    if a.dtype!=np.uint8 or a.ndim!=3 or a.shape[2]!=4 or not all(2<=v<=512 for v in a.shape[:2]):raise ValueError('Expected2..512side RGBA8 crop')
    if type(radius) is not int or not 1<=radius<=16:raise ValueError('Radius must be integer1..16')
    if any(type(v) not in (int,float) or not math.isfinite(v) or not 0<=v<=4 for v in (continuity,bend,bundle_width)):raise ValueError('Finite continuity/bend/bundle weights0..4 required')
    g=np.asarray(guide,dtype=float)
    if g.ndim!=2 or g.shape[1]!=2 or not 2<=len(g)<=32 or not np.isfinite(g).all():raise ValueError('Expected2..32finite guide points')
    h,w=a.shape[:2]
    if np.any(g<0) or np.any(g[:,0]>w-1) or np.any(g[:,1]>h-1):raise ValueError('Guide outside crop')
    distances=np.linalg.norm(np.diff(g,axis=0),axis=1)
    if np.any(distances<.25) or np.linalg.norm(g[-1]-g[0])<1:raise ValueError('Open guide with distinct adjacent points/endpoints required')
    arc=np.r_[0,np.cumsum(distances)];n=math.ceil(float(arc[-1]))+1
    if not 3<=n<=1024:raise ValueError('Guide must span2..1023pixels')
    samples=np.linspace(0,arc[-1],n);base=np.column_stack([np.interp(samples,arc,g[:,i]) for i in range(2)])
    tang=np.gradient(base,axis=0);norm=np.linalg.norm(tang,axis=1)
    if np.any(norm<.05):raise ValueError('Guide has a cusp/fold; split into open contours')
    tang/=norm[:,None]
    normal=np.column_stack([-tang[:,1],tang[:,0]])
    offsets=np.arange(-radius,radius+1);k=len(offsets);center=radius
    positions=base[:,None,:]+normal[:,None,:]*offsets[None,:,None]
    # White compositing for transparent input is explicit analysis only.
    rgb=a[:,:,:3].astype(float);alpha=a[:,:,3:4]/255
    luma=(rgb*alpha+255*(1-alpha)).mean(axis=2)
    low,high=np.percentile(luma,[5,95]);contrast=float(high-low)
    ink=np.clip((high-luma)/max(16,contrast),0,1)
    support=np.zeros((n,k));valid=np.ones((n,k),dtype=bool)
    for shift in (-2,-1,0,1,2):
        values,ok=_sample(ink,positions+tang[:,None,:]*shift)
        support+=values/5
        if shift==0:valid=ok
    if bundle_width:
        # Explicit stroke-family scale assumption; can incorrectly merge nearby
        # legitimate contours. Alternative only, never erases source marks.
        kernel=np.exp(-.5*((offsets[:,None]-offsets[None,:])/bundle_width)**2)
        support=(support@kernel.T)/kernel.sum(axis=1)[None,:]
    emission=-support+.002*(offsets[None,:]/radius)**2
    emission[~valid]=np.inf
    emission[0,:]=np.inf;emission[0,center]=0
    emission[-1,:]=np.inf;emission[-1,center]=0
    delta=offsets[None,:]-offsets[:,None]
    transitions=float(continuity)*delta**2
    transitions[np.abs(delta)>2]=np.inf
    curve=bend*(offsets[:,None,None]-2*offsets[None,:,None]+offsets[None,None,:])**2
    cost=np.full((k,k),np.inf);cost[center,:]=emission[1,:]+transitions[center,:]
    parents=np.zeros((n,k,k),dtype=np.int8)
    for row in range(2,n):
        if checkpoint:checkpoint(row)
        total=cost[:,:,None]+curve
        prev=total.argmin(axis=0);parents[row]=prev
        cost=np.min(total,axis=0)+transitions+emission[row,None,:]
    flat=int(np.argmin(cost));j,last=divmod(flat,k)
    if not np.isfinite(cost[j,last]):raise ValueError('No bounded guide path; adjust crop/guide')
    chosen=np.zeros(n,dtype=int);chosen[-2:]=[j,last]
    for row in range(n-1,1,-1):chosen[row-2]=parents[row,chosen[row-1],chosen[row]]
    points=positions[np.arange(n),chosen]
    if checkpoint:checkpoint(n)
    return dict(points=points.tolist(),guide=g.tolist(),sampled_guide=base.tolist(),offsets=offsets[chosen].tolist(),radius=radius,continuity=float(continuity),bend=float(bend),bundle_width=float(bundle_width),metrics=dict(samples=n,mean_support=float(np.mean(support[np.arange(n),chosen])),mean_offset=float(np.mean(np.abs(offsets[chosen]))),cost=float(cost[j,last]),luma_contrast=contrast),warnings=['Guided centerline proposal only; intent, branch choice, line weight and medium are unverified.','Source unchanged. No automatic erasure, closure, junction/semantic inference or artist acceptance.']+(['Bundle scale can merge distinct legitimate strokes; support scores across scales are not comparable.'] if bundle_width else [])+(['Low crop contrast; path may follow paper/noise.'] if contrast<16 else []))


def alternatives(rgba,guide,*,radius=8,checkpoint=None):
    result=[]
    for name,continuity,bend in [('pixel-following',.01,0),('regularized',.06,.4),('smooth',.12,1.2)]:
        item=trace(rgba,guide,radius=radius,continuity=continuity,bend=bend,checkpoint=checkpoint);item['name']=name
        item['equivalent_to']=next((old['name'] for old in result if old['points']==item['points']),None);result.append(item)
    points=result[0]['sampled_guide']
    result.append(dict(name='direct-guide',points=points,guide=guide,metrics=dict(samples=len(points)),warnings=result[0]['warnings'],equivalent_to=next((old['name'] for old in result if old['points']==points),None)))
    item=trace(rgba,guide,radius=radius,bundle_width=2.5,checkpoint=checkpoint);item['name']='bundle-center';item['equivalent_to']=next((old['name'] for old in result if old['points']==item['points']),None);result.append(item)
    return result


def raster_path(points,width,height,color=(25,100,220,200)):
    """Separate one-pixel geometry ink. Does not reconstruct pencil medium."""
    if not all(type(v) is int and 2<=v<=4096 for v in (width,height)):raise ValueError('Invalid raster bounds')
    p=np.asarray(points,dtype=float)
    if p.ndim!=2 or p.shape[1]!=2 or not 2<=len(p)<=1024 or not np.isfinite(p).all():raise ValueError('Invalid path')
    if len(color)!=4 or any(type(v) is not int or not 0<=v<=255 for v in color):raise ValueError('Invalid RGBA8 color')
    out=np.zeros((height,width,4),dtype=np.uint8)
    for start,end in zip(p[:-1],p[1:]):
        count=max(1,math.ceil(float(np.max(np.abs(end-start)))*2))
        if count>4096:raise ValueError('Path segment too long')
        xy=np.rint(np.linspace(start,end,count+1)).astype(int)
        if np.any(xy<0) or np.any(xy[:,0]>=width) or np.any(xy[:,1]>=height):raise ValueError('Path outside raster')
        out[xy[:,1],xy[:,0]]=color
    return out
