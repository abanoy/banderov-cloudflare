"""Independent nearest-sample/source-over renderer. REF-COMPOSITING, NumPy APIs.

    No resampling of stored artwork. Viewport nearest sampling before pointwise
    source-over gives the same selected samples as full-canvas compositing.
"""
from fractions import Fraction
import struct,zlib,hashlib
import numpy as np
from engine.io.project_archive import PixelPlane,TILE
from engine.io.png_codec import SIGNATURE,chunk


def png_bytes(width,height,raw):
    if type(width) is not int or type(height) is not int or not 1<=width<=4096 or not 1<=height<=4096 or len(raw)!=width*height*4:raise ValueError('Packed PNG bounds mismatch')
    encoded=b''.join(b'\0'+raw[y*width*4:(y+1)*width*4] for y in range(height))
    return SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'sRGB',b'\0')+chunk(b'IDAT',zlib.compress(encoded))+chunk(b'IEND',b'')


def over(bottom,top,opacity=255):
    factor=Fraction(str(opacity));n,d=factor.numerator,factor.denominator
    if not 0<=factor<=255 or bottom.shape!=top.shape or bottom.shape[-1]!=4:raise ValueError('Invalid packed compositing inputs')
    if d>2**30:
        from engine.layers import source_over
        result=source_over(bottom.reshape(-1,4).tolist(),top.reshape(-1,4).tolist(),factor)
        return np.array(result,dtype=np.uint8).reshape(bottom.shape)
    if not np.any(bottom[:,:,3]):
        out=top.copy();sa=top[:,:,3].astype(np.uint64)*n
        out[:,:,:3][sa==0]=0
        out[:,:,3]=((sa*255+(65025*d)//2)//(65025*d)).astype(np.uint8)
        return out
    if factor==255 and np.all(top[:,:,3]==255):return top.copy()
    if d==1:
        # Integer opacity has an exact uint32 bound: a<=255*65025 and
        # color numerator<=255*a. Even numerator+a//2 is below2**32.
        # Work only on nonzero source alpha; outside pixels retain the canonical
        # backdrop. Sparse native layers avoid whole-viewport64bit temporaries.
        out=bottom.copy();out[:,:,:3][bottom[:,:,3]==0]=0
        active=top[:,:,3]!=0
        if not n or not np.any(active):return out
        b,s=bottom[active].astype(np.uint32),top[active].astype(np.uint32)
        sa=s[:,3]*n;remaining=65025-sa;a=sa*255+b[:,3]*remaining;divisor=np.maximum(a,1)
        result=np.empty((len(a),4),dtype=np.uint8)
        for c in range(3):
            numerator=s[:,c]*sa*255+b[:,c]*b[:,3]*remaining
            result[:,c]=((numerator+a//2)//divisor).astype(np.uint8)
        result[:,3]=((a+32512)//65025).astype(np.uint8);out[active]=result
        return out
    b,s=bottom.astype(np.uint64),top.astype(np.uint64)
    sa=s[:,:,3]*n;remaining=65025*d-sa;a=sa*255+b[:,:,3]*remaining
    divisor=np.maximum(a,1);out=np.zeros_like(bottom)
    for c in range(3):
        numerator=s[:,:,c]*sa*255+b[:,:,c]*b[:,:,3]*remaining
        out[:,:,c]=np.where(a,(numerator+a//2)//divisor,0).astype(np.uint8)
    out[:,:,3]=((a+(65025*d)//2)//(65025*d)).astype(np.uint8)
    return out


ZERO_BYTES=bytes(TILE*TILE*4)
ZERO_TILE=hashlib.sha256(ZERO_BYTES).hexdigest()

def sample_layout(xs,ys):
    rows=[];columns=[]
    for ty in np.unique(ys//TILE):
        iy=np.flatnonzero(ys//TILE==ty);rows.append((int(ty),iy[:,None],(ys[iy]%TILE)[:,None]))
    for tx in np.unique(xs//TILE):
        ix=np.flatnonzero(xs//TILE==tx);columns.append((int(tx),ix,xs[ix]%TILE))
    return rows,columns


def sample(plane,xs,ys,layout=None):
    if not isinstance(plane,PixelPlane):raise ValueError('Expected packed sample source')
    result=np.zeros((len(ys),len(xs),4),dtype=np.uint8);columns=(plane.width+TILE-1)//TILE
    rows,cols=layout if layout is not None else sample_layout(xs,ys)
    for ty,iy,ly in rows:
        for tx,ix,lx in cols:
            key=plane.keys[ty*columns+tx]
            data=plane._store.get(key)
            if key==ZERO_TILE:
                if data!=ZERO_BYTES:raise ValueError('Packed zero tile identity changed')
                continue
            tile=np.frombuffer(data,dtype=np.uint8).reshape(TILE,TILE,4)
            result[iy,ix]=tile[ly,lx]
    return result


def render(project,slot,output_size=None,rectangle=None,overrides=None):
    from engine.layers import validate_layers
    validate_layers(project)
    w,h=project['canvas']['width'],project['canvas']['height']
    x0,y0,x1,y1=rectangle if rectangle is not None else (0,0,w,h)
    if any(type(v) is not int for v in [x0,y0,x1,y1]) or not 0<=x0<x1<=w or not 0<=y0<y1<=h:raise ValueError('Viewport rectangle outside canvas')
    ow,oh=output_size or (x1-x0,y1-y0)
    if any(type(v) is not int or not 1<=v<=4096 for v in [ow,oh]):raise ValueError('Invalid render size')
    xs=x0+np.arange(ow,dtype=np.int64)*(x1-x0)//ow;ys=y0+np.arange(oh,dtype=np.int64)*(y1-y0)//oh
    ranks={identity:i for i,identity in enumerate(project['layers'])}
    def children(parent,backdrop=None,inherited=Fraction(1)):
        out=np.zeros((len(ys),ow,4),dtype=np.uint8) if backdrop is None else backdrop
        siblings=[(i,l) for i,l in project['layers'].items() if l.get('parent_id')==parent]
        for identity,layer in sorted(siblings,key=lambda p:(p[1].get('order',0),ranks[p[0]]),reverse=True):
            if not layer.get('visible',True):continue
            if layer.get('nodetype','paintlayer')=='grouplayer':
                if layer.get('isolation','isolate')=='auto':
                    out=children(identity,out,inherited*Fraction(str(layer.get('opacity',255)))/255);continue
                pixels=children(identity)
            else:
                e=next(e for e in project['exposures'] if e['layer_id']==identity and e['start']<=slot<e['start']+e['length'])
                plane=(overrides or {}).get(identity,project['drawings'][e['drawing_id']]['pixels'])
                if not isinstance(plane,PixelPlane):plane=PixelPlane.from_pixels(w,h,plane)
                pixels=sample(plane,xs,ys,layout)
            out=over(out,pixels,Fraction(str(layer.get('opacity',255)))*inherited)
        return out
    all_ys=ys;output=np.empty((oh,ow,4),dtype=np.uint8)
    for start in range(0,oh,128):
        ys=all_ys[start:start+128];layout=sample_layout(xs,ys);output[start:start+len(ys)]=children(None)
    return ow,oh,output.tobytes()


def checker(width,height):
    yy,xx=np.indices((height,width));flag=((xx//8+yy//8)%2).astype(bool)
    data=np.empty((height,width,4),dtype=np.uint8);data[:]=[229,232,237,255];data[flag]=[255,255,255,255]
    return data.tobytes()


def decode_rows(raw,width,height,channels,transparent=None):
    stride=width*channels;encoded=np.frombuffer(raw,dtype=np.uint8).reshape(height,stride+1)
    rows=np.empty((height,stride),dtype=np.uint8);previous=np.zeros(stride,dtype=np.uint8)
    for y in range(height):
        mode=int(encoded[y,0]);source=encoded[y,1:]
        if mode==0:row=source.copy()
        elif mode==1:row=(np.cumsum(source.reshape(width,channels),axis=0,dtype=np.uint64)%256).astype(np.uint8).reshape(-1)
        elif mode==2:row=np.add(source,previous,dtype=np.uint8)
        elif mode==4 and not np.any(source):row=previous.copy()
        elif mode in {3,4}:
            row=bytearray(source.tobytes());above=previous.tobytes()
            for i in range(stride):
                left=row[i-channels] if i>=channels else 0;up=above[i];corner=above[i-channels] if i>=channels else 0
                if mode==3:predictor=(left+up)//2
                else:
                    estimate=left+up-corner;da,db,dc=abs(estimate-left),abs(estimate-up),abs(estimate-corner)
                    predictor=left if da<=db and da<=dc else up if db<=dc else corner
                row[i]=(row[i]+predictor)&255
            row=np.frombuffer(bytes(row),dtype=np.uint8)
        else:raise ValueError('Unsupported PNG filter')
        rows[y]=row;previous=rows[y]
    rgba=np.empty((height,width,4),dtype=np.uint8)
    if channels==4:rgba[:]=rows.reshape(height,width,4)
    else:
        rgba[:,:,:3]=rows.reshape(height,width,3);rgba[:,:,3]=255
        if transparent is not None:rgba[:,:,3][np.all(rgba[:,:,:3]==np.array(transparent,dtype=np.uint8),axis=2)]=0
    return PixelPlane.from_rgba(width,height,rgba.tobytes())
