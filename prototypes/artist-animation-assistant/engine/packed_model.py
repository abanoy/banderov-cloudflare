"""Original packed live-model helpers; old schema/hash semantics stay unchanged."""
from copy import deepcopy
import json
from engine.io.project_archive import PixelPlane,SourceBlob,MemoryTiles,TILE_BYTES,PackedArchive

LIVE_ASSETS=256*1024*1024


def json_default(value):
    if isinstance(value,SourceBlob):return {'$source-blob':value.sha256,'size':len(value.data)}
    if isinstance(value,PixelPlane):
        return {'$packed-rgba8':value.identity,'width':value.width,'height':value.height}
    raise TypeError('Not a JSON metadata value')


def check_budget(project):
    keys=set();blobs={}
    def walk(value):
        if isinstance(value,SourceBlob):blobs[value.sha256]=len(value.data)
        elif isinstance(value,PixelPlane):keys.update(value.keys)
        elif isinstance(value,dict):
            for item in value.values():walk(item)
        elif isinstance(value,list):
            for item in value:walk(item)
    walk(project)
    if len(keys)*TILE_BYTES+sum(blobs.values())>512*1024*1024:raise ValueError('Live tiles/source bytes exceed512MiB')
    if len(keys)*TILE_BYTES>LIVE_ASSETS:raise ValueError('Live unique packed assets exceed256MiB')
    if len(json.dumps(project,default=json_default,ensure_ascii=False,allow_nan=False).encode())>8*1024*1024:
        raise ValueError('Live packed metadata exceeds8MiB')


def resident(project):
    """Verify/copy unique tiles once; no archive handle/temp cache survives load.

    This first live route eagerly owns bounded unique packed bytes, not pixel
    objects per drawing. Backend lazy APIs remain available separately.
    """
    keys=set()
    def collect(value):
        if isinstance(value,PixelPlane):
            for key in value.keys:keys.add((key,value._store))
        elif isinstance(value,dict):
            for item in value.values():collect(item)
        elif isinstance(value,list):
            for item in value:collect(item)
    collect(project)
    if len({k for k,_ in keys})*TILE_BYTES>LIVE_ASSETS:raise ValueError('Live unique packed assets exceed256MiB')
    store=MemoryTiles()
    for key,source in keys:
        if key not in store.assets:
            if store.put(source.get(key))!=key:raise ValueError('Packed source tile identity changed')
    def convert(value):
        if isinstance(value,PixelPlane):return PixelPlane(value.width,value.height,value.keys,store)
        if isinstance(value,dict):return {k:convert(v) for k,v in value.items()}
        if isinstance(value,list):return [convert(v) for v in value]
        return value
    result=convert(project);check_budget(result);return result


def load_packed(path):
    with PackedArchive(path) as archive:return resident(archive.project)


def first_plane(value):
    if isinstance(value,PixelPlane):return value
    if isinstance(value,dict):
        for item in value.values():
            found=first_plane(item)
            if found is not None:return found
    if isinstance(value,list):
        for item in value:
            found=first_plane(item)
            if found is not None:return found
    return None


class PackedCancelled(Exception):pass


def translate(plane,dx,dy,checkpoint=None):
    import numpy as np
    if type(dx) is not int or type(dy) is not int:raise ValueError('Integer translation required')
    w,h=plane.width,plane.height
    out=np.zeros((h,w,4),dtype=np.uint8);clipped=0
    left,right=max(0,-dx),min(w,w-dx)
    for y in range(0,h,64):
        if checkpoint:checkpoint(y)
        end=min(h,y+64);raw=plane.region_bytes((0,y,w,end));rows=np.frombuffer(raw,dtype=np.uint8).reshape(end-y,w,4)
        clipped+=int(np.count_nonzero(rows[:,:,3]))
        top,bottom=max(y,-dy),min(end,h-dy)
        if left<right and top<bottom:
            chosen=rows[top-y:bottom-y,left:right]
            out[top+dy:bottom+dy,left+dx:right+dx]=chosen
            clipped-=int(np.count_nonzero(chosen[:,:,3]))
    if checkpoint:checkpoint(h)
    return PixelPlane.from_rgba(w,h,out.tobytes()),clipped

def translated_constraints(drawing,width,height,dx,dy,checkpoint=None):
    """Known integer geometry moves constraints too; clipping them is refused."""
    if isinstance(drawing['pixels'],PixelPlane):
        from engine.spatial_constraints import drawing_mask,count,ENCODING
        source=drawing_mask(drawing)
        metadata=dict(pixels=drawing['pixels'],protected_mask=source,protection_encoding=ENCODING)
        before=count(metadata)
        if not before:return {}
        from engine.packed_model import translate
        moved,_=translate(source,dx,dy,checkpoint)
        clipped=before-count(dict(pixels=drawing['pixels'],protected_mask=moved,protection_encoding=ENCODING))
        return dict(protected_mask=moved,protection_encoding=ENCODING,constraint_clip_count=clipped)
    protected=drawing.get('protected_pixels')
    if protected is None:
        if not (drawing.get('locked') and drawing.get('origin')=='artist_correction'):return {}
        if width*height>65536:raise ValueError('Legacy full correction protection needs bounded migration')
        protected=list(range(width*height))
    if not isinstance(protected,list) or len(set(protected))!=len(protected) or any(type(i) is not int or not 0<=i<width*height for i in protected):raise ValueError('Invalid artist protection metadata')
    moved=[];clipped=0
    for index in protected:
        y,x=divmod(index,width);nx,ny=x+dx,y+dy
        if not 0<=nx<width or not 0<=ny<height:
            clipped+=1;continue
        moved.append(ny*width+nx)
    return dict(protected_pixels=sorted(moved),constraint_clip_count=clipped) if protected else {}
