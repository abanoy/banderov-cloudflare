"""Independent coherent layer reconstruction from two backward fields, EXP0035.

REF-COMPOSITING premultiplied source-over. Model flow/mask is shared across layers;
visible contributions are mixed then reconstructed in retained top-to-bottom order.
No original is changed; no artist intent/confidence or new-surface proof is inferred.
"""
import numpy as np
from engine.io.project_archive import PixelPlane,OverlayTiles,TILE

OUTPUT_LIMIT=256*1024**2


def _fetch(plane,x,y):
    valid=(x>=0)&(x<plane.width)&(y>=0)&(y<plane.height);out=np.zeros(x.shape+(4,),np.uint8)
    if not valid.any():return out
    xx=x[valid];yy=y[valid];columns=(plane.width+TILE-1)//TILE;tiles=yy//TILE*columns+xx//TILE;values=np.empty((len(xx),4),np.uint8)
    for tile in np.unique(tiles):
        rows=tiles==tile;rgba=np.frombuffer(plane._store.get(plane.keys[int(tile)]),np.uint8).reshape(TILE,TILE,4);values[rows]=rgba[yy[rows]%TILE,xx[rows]%TILE]
    out[valid]=values;return out


def _field_at(field,xx,yy,w,h):
    fh,fw=field.shape[-2:];x=np.clip((xx+.5)*fw/w-.5,0,fw-1);y=np.clip((yy+.5)*fh/h-.5,0,fh-1);x0=np.floor(x).astype(np.int64);y0=np.floor(y).astype(np.int64);x1=np.minimum(x0+1,fw-1);y1=np.minimum(y0+1,fh-1);a=x-x0;b=y-y0
    return (field[...,y0,x0]*(1-a)+field[...,y0,x1]*a)*(1-b)+(field[...,y1,x0]*(1-a)+field[...,y1,x1]*a)*b


def _sample(plane,x,y):
    x0=np.floor(x).astype(np.int64);y0=np.floor(y).astype(np.int64);a=x-x0;b=y-y0;premul=np.zeros(x.shape+(3,),np.float32);alpha=np.zeros(x.shape,np.float32);hidden=np.zeros_like(premul)
    for dx,dy,weight in [(0,0,(1-a)*(1-b)),(1,0,a*(1-b)),(0,1,(1-a)*b),(1,1,a*b)]:
        rgba=_fetch(plane,x0+dx,y0+dy).astype(np.float32)/255.;aw=weight*rgba[:,:,3];premul+=rgba[:,:,:3]*aw[:,:,None];alpha+=aw;hidden+=rgba[:,:,:3]*weight[:,:,None]
    nx=np.floor(x+.5).astype(np.int64);ny=np.floor(y+.5).astype(np.int64);nearest=_fetch(plane,nx,ny);return premul,alpha,hidden,nearest,nx,ny


def transport(first,second,masks0,masks1,opacities,fields,checkpoint=None,*,blend_policy=None):
    """Maps ordered paint layers to ordered editable outputs, all full canvas size."""
    checkpoint=checkpoint or (lambda:None)
    from engine.blend_policies import validate_policy,apply_weight
    validate_policy(blend_policy)
    if not first or not len(first)==len(second)==len(masks0)==len(masks1)==len(opacities)<=32:raise ValueError('Use1..32corresponding ordered paint layers')
    w,h=first[0].width,first[0].height
    if any(not isinstance(p,PixelPlane) or (p.width,p.height)!=(w,h) for p in first+second+masks0+masks1):raise ValueError('All field inputs need matching packed dimensions')
    f0,f1,weight=fields['flow0'],fields['flow1'],fields['weight'];fh,fw=weight.shape
    if f0.shape!=(2,fh,fw) or f1.shape!=f0.shape or max(fh,fw)>1024 or fh*fw>1024*768 or any(v.dtype!=np.float32 or not np.isfinite(v).all() for v in [f0,f1,weight]) or weight.min()<0 or weight.max()>1:raise ValueError('Invalid bounded learned fields')
    if np.max(np.abs(f0))>2*max(fw,fh) or np.max(np.abs(f1))>2*max(fw,fh):raise ValueError('Learned field displacement exceeds bound')
    if any(type(o) not in (int,float) or not 0<=o<=255 for o in opacities):raise ValueError('Finite layer opacity0..255required')
    stores=[OverlayTiles(p._store) for p in first];keys=[list(p.keys) for p in first];maskstores=[OverlayTiles(p._store) for p in masks0];maskkeys=[list(p.keys) for p in masks0];columns=(w+TILE-1)//TILE;seen=[np.zeros((h,w),bool),np.zeros((h,w),bool)];pool={};conflicts=[0]*len(first)
    def put(store,data):
        import hashlib
        identity=hashlib.sha256(data).hexdigest()
        if identity not in pool:
            if (len(pool)+1)*TILE*TILE*4>OUTPUT_LIMIT:raise ValueError('Learned editable output tiles exceed256MiB')
            pool[identity]=data
        return store.put(pool[identity])
    for y in range(0,h,TILE):
        for x in range(0,w,TILE):
            checkpoint();hh,ww=min(TILE,h-y),min(TILE,w-x);yy,xx=np.mgrid[y:y+hh,x:x+ww];flow0=_field_at(f0,xx,yy,w,h);flow1=_field_at(f1,xx,yy,w,h);m=_field_at(weight,xx,yy,w,h).astype(np.float32);coords=[(xx+flow0[0]*w/fw,yy+flow0[1]*h/fh),(xx+flow1[0]*w/fw,yy+flow1[1]*h/fh)];transmission=[np.ones((hh,ww),np.float32),np.ones((hh,ww),np.float32)];remaining=np.ones((hh,ww),np.float32)
            for which,(cx,cy) in enumerate(coords):
                nx=np.floor(cx+.5).astype(np.int64);ny=np.floor(cy+.5).astype(np.int64);valid=(nx>=0)&(nx<w)&(ny>=0)&(ny<h);seen[which][ny[valid],nx[valid]]=True
            if blend_policy is not None:m=apply_weight(m,blend_policy)
            for index,(p0,p1,mask0,mask1,opacity) in enumerate(zip(first,second,masks0,masks1,opacities)):
                a=_sample(p0,*coords[0]);b=_sample(p1,*coords[1]);o=float(opacity)/255.;contribution_a=m*a[1]*o*transmission[0]+(1-m)*b[1]*o*transmission[1];contribution_rgb=m[:,:,None]*a[0]*o*transmission[0][:,:,None]+(1-m)[:,:,None]*b[0]*o*transmission[1][:,:,None]
                hidden_alpha=m*a[1]+(1-m)*b[1];hidden_colour=np.divide(m[:,:,None]*a[0]+(1-m)[:,:,None]*b[0],hidden_alpha[:,:,None],out=m[:,:,None]*a[2]+(1-m)[:,:,None]*b[2],where=hidden_alpha[:,:,None]>1e-9)
                raw_alpha=np.divide(contribution_a,remaining*o,out=hidden_alpha.copy(),where=(remaining*o)>1e-9);colour=np.divide(contribution_rgb,contribution_a[:,:,None],out=hidden_colour,where=contribution_a[:,:,None]>1e-9);rgba=np.empty((hh,ww,4),np.uint8);rgba[:,:,:3]=np.rint(np.clip(colour,0,1)*255).astype(np.uint8);rgba[:,:,3]=np.rint(np.clip(raw_alpha,0,1)*255).astype(np.uint8)
                flags0=_fetch(mask0,a[4],a[5])[:,:,0]!=0;flags1=_fetch(mask1,b[4],b[5])[:,:,0]!=0;both=flags0&flags1;conflicts[index]+=int(np.count_nonzero(both&np.any(a[3]!=b[3],axis=2)));rgba[flags0]=a[3][flags0];rgba[flags1&~flags0]=b[3][flags1&~flags0];flag=flags0|flags1
                transmission[0]*=1-a[1]*o;transmission[1]*=1-b[1]*o;remaining*=1-rgba[:,:,3].astype(np.float32)/255*o
                tile=np.zeros((TILE,TILE,4),np.uint8);tile[:hh,:ww]=rgba;position=y//TILE*columns+x//TILE;keys[index][position]=put(stores[index],tile.tobytes());tile[:]=0;tile[:hh,:ww,0]=flag.astype(np.uint8);maskkeys[index][position]=put(maskstores[index],tile.tobytes())
    outputs=[]
    for index,(mask0,mask1) in enumerate(zip(masks0,masks1)):
        lost=[]
        for which,mask in enumerate([mask0,mask1]):
            n=0
            for y in range(0,h,TILE):
                for x in range(0,w,TILE):
                    checkpoint();hh,ww=min(TILE,h-y),min(TILE,w-x);flags=np.frombuffer(mask.region_bytes([x,y,x+ww,y+hh]),np.uint8).reshape(hh,ww,4)[:,:,0]!=0;n+=int(np.count_nonzero(flags&~seen[which][y:y+hh,x:x+ww]))
            lost.append(n)
        unsafe=[]
        if any(lost):unsafe.append('protected_key_samples_not_represented')
        if conflicts[index]:unsafe.append('source_target_protected_rgba_conflict')
        outputs.append(dict(pixels=PixelPlane(w,h,keys[index],stores[index]),protected_mask=PixelPlane(w,h,maskkeys[index],maskstores[index]),unsafe_reasons=unsafe,metrics=dict(source_protected_lost=lost[0],target_protected_lost=lost[1],protected_conflicts=conflicts[index],working_size=[fw,fh],output_size=[w,h],outside_policy='transparent',method='shared_bidirectional_flow_visible_contribution_reconstruction')))
    result=dict(outputs=outputs,metrics=dict(output_pool_bytes=len(pool)*TILE*TILE*4,shared_coverage_bytes=2*w*h,working_size=[fw,fh],output_size=[w,h]),warnings=['Learned blend weight is not calibrated confidence or semantic visibility.','Nearest protected samples override interpolation; conflicts/loss refuse approval.','New raw RGBA uses bilinear premultiplied sampling and contribution reconstruction; original pixels remain in both keys.'])
    if blend_policy is not None:
        result['metrics']['blend_policy']=blend_policy;result['warnings'].append('Explicit research blend ablation '+blend_policy+' changes synthesis, not correspondence; may introduce seams, lose detail or choose the wrong expression. Not model RGB reconstruction or confidence.')
        for out in outputs:out['metrics']['blend_policy']=blend_policy;out['metrics']['method']+=':'+blend_policy
    return result
