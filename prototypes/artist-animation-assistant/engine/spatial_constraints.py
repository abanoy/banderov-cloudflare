"""Original spatial correction masks reusing immutable tiled RGBA storage.

Red byte0/1 is a boolean flag, other bytes0. Not displayed artwork, semantic
confidence or inferred intent. Bounded legacy index queries serve future ROI jobs.
"""
from functools import lru_cache
import hashlib
import numpy as np
from engine.io.project_archive import PixelPlane,MemoryTiles,OverlayTiles,TILE,TILE_BYTES

ENCODING='red-boolean-mask-1'


@lru_cache(maxsize=32)
def uniform(width,height,on=False):
    store=MemoryTiles();keys=[]
    for y in range(0,height,TILE):
        for x in range(0,width,TILE):
            data=np.zeros((TILE,TILE,4),dtype=np.uint8)
            if on:data[:min(TILE,height-y),:min(TILE,width-x),0]=1
            keys.append(store.put(data.tobytes()))
    return PixelPlane(width,height,keys,store)


@lru_cache(maxsize=512)
def _validated(identity,data):
    if len(data)!=TILE_BYTES or hashlib.sha256(data).hexdigest()!=identity:raise ValueError('Spatial mask tile identity changed')
    a=np.frombuffer(data,dtype=np.uint8).reshape(-1,4)
    if np.any(a[:,0]>1) or np.any(a[:,1:]):raise ValueError('Spatial mask requires red0/1 and other bytes0')
    return int(np.count_nonzero(a[:,0]))


def validate_mask(mask,width,height):
    if not isinstance(mask,PixelPlane) or (mask.width,mask.height)!=(width,height):raise ValueError('Invalid spatial mask bounds/type')
    for key in set(mask.keys):_validated(key,mask._store.get(key))
    return mask


def drawing_mask(drawing,legacy_locked=False):
    pixels=drawing['pixels'];w,h=pixels.width,pixels.height
    if 'protected_mask' in drawing:
        if drawing.get('protection_encoding')!=ENCODING or 'protected_pixels' in drawing:raise ValueError('Ambiguous spatial mask metadata')
        return validate_mask(drawing['protected_mask'],w,h)
    if 'protected_pixels' in drawing:
        indices=drawing['protected_pixels']
        if not isinstance(indices,list) or any(type(i) is not int or not 0<=i<w*h for i in indices) or len(set(indices))!=len(indices):raise ValueError('Invalid legacy protection indices')
        return uniform(w,h).with_edits({i:[1,0,0,0] for i in indices})
    whole=drawing.get('locked',False) and (legacy_locked or drawing.get('origin')=='artist_correction')
    return uniform(w,h,bool(whole))


def merge(left,right):
    validate_mask(left,left.width,left.height);validate_mask(right,left.width,left.height)
    store=OverlayTiles(left._store);keys=list(left.keys)
    for index,(a,b) in enumerate(zip(left.keys,right.keys)):
        if a==b or _validated(b,right._store.get(b))==0:continue
        x=np.frombuffer(left._store.get(a),np.uint8);y=np.frombuffer(right._store.get(b),np.uint8)
        data=np.bitwise_or(x,y).tobytes()
        if data!=left._store.get(a):keys[index]=store.put(data)
    return PixelPlane(left.width,left.height,keys,store)


def count(drawing):
    mask=drawing_mask(drawing);columns=(mask.width+TILE-1)//TILE;total=0
    for index,key in enumerate(mask.keys):
        ty,tx=divmod(index,columns);vw,vh=min(TILE,mask.width-tx*TILE),min(TILE,mask.height-ty*TILE)
        data=mask._store.get(key)
        total+=_validated(key,data) if vw==vh==TILE else int(np.count_nonzero(np.frombuffer(data,np.uint8).reshape(TILE,TILE,4)[:vh,:vw,0]))
    return total


def indices(drawing,rectangle=None,local=False,legacy_locked=False):
    mask=drawing_mask(drawing,legacy_locked);w,h=mask.width,mask.height
    x0,y0,x1,y1=rectangle or (0,0,w,h)
    if (x1-x0)*(y1-y0)>65536:raise ValueError('Choose a bounded region before expanding spatial constraints')
    data=np.frombuffer(mask.region_bytes((x0,y0,x1,y1)),np.uint8).reshape(y1-y0,x1-x0,4)
    yy,xx=np.nonzero(data[:,:,0]);stride=x1-x0 if local else w
    return ((yy if local else yy+y0)*stride+(xx if local else xx+x0)).tolist()


def validate_artist_delta(before,after,delta):
    if not isinstance(before,PixelPlane) or not isinstance(after,PixelPlane) or (before.width,before.height)!=(after.width,after.height):raise ValueError('Artist patch dimensions changed')
    validate_mask(delta,before.width,before.height)
    for i,(old,new) in enumerate(zip(before.keys,after.keys)):
        if old==new:continue
        a=np.frombuffer(before._store.get(old),np.uint8).reshape(-1,4)
        b=np.frombuffer(after._store.get(new),np.uint8).reshape(-1,4)
        touched=np.frombuffer(delta._store.get(delta.keys[i]),np.uint8).reshape(-1,4)[:,0].astype(bool)
        if np.any(a[~touched]!=b[~touched]):raise ValueError('Artist patch changed pixels outside its explicit touched mask')

