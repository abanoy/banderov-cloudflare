"""Original continuous hard round repair brush, not pressure/style synthesis.

Capsule distance rasterization of literal pointer segments, in source pixels.
Mutable live buffers freeze into immutable image and touched-mask tiles on review.
"""
import numpy as np
from engine.io.project_archive import PixelPlane,OverlayTiles,TILE,TILE_BYTES
from engine.spatial_constraints import uniform


class PackedStroke:
    def __init__(self,source,color,radius=0):
        if not isinstance(source,PixelPlane) or type(radius) is not int or not 0<=radius<=32 or len(color)!=4 or any(type(c) is not int or not 0<=c<=255 for c in color):raise ValueError('Invalid brush source/color/radius0..32')
        self.source=source;self.color=tuple(color);self.radius=radius;self.last=None
        self.image_buffers={};self.mask_buffers={};self.version=0;self.cached=None

    @property
    def touched(self):return bool(self.mask_buffers)

    def add(self,point):
        if len(point)!=2 or any(type(v) is not int or abs(v)>32768 for v in point):raise ValueError('Invalid brush coordinate')
        a=self.last if self.last is not None else tuple(point);b=tuple(point);self.last=b
        w,h=self.source.width,self.source.height;r=self.radius+.5
        x0=max(0,int(np.floor(min(a[0],b[0])-r)));y0=max(0,int(np.floor(min(a[1],b[1])-r)))
        x1=min(w,int(np.ceil(max(a[0],b[0])+r))+1);y1=min(h,int(np.ceil(max(a[1],b[1])+r))+1)
        if x0>=x1 or y0>=y1:return
        dx,dy=b[0]-a[0],b[1]-a[1];length=dx*dx+dy*dy;columns=(w+TILE-1)//TILE
        for ty in range(y0//TILE,(y1-1)//TILE+1):
            for tx in range(x0//TILE,(x1-1)//TILE+1):
                left,right=max(x0,tx*TILE),min(x1,(tx+1)*TILE);top,bottom=max(y0,ty*TILE),min(y1,(ty+1)*TILE)
                xx=np.arange(left,right,dtype=np.float64)[None,:];yy=np.arange(top,bottom,dtype=np.float64)[:,None]
                t=np.clip(((xx-a[0])*dx+(yy-a[1])*dy)/length,0,1) if length else 0
                covered=(xx-(a[0]+t*dx))**2+(yy-(a[1]+t*dy))**2<=r*r
                if not np.any(covered):continue
                index=ty*columns+tx
                if index not in self.image_buffers:
                    self.image_buffers[index]=bytearray(self.source._store.get(self.source.keys[index]));self.mask_buffers[index]=bytearray(TILE_BYTES)
                image=np.frombuffer(self.image_buffers[index],np.uint8).reshape(TILE,TILE,4)
                mask=np.frombuffer(self.mask_buffers[index],np.uint8).reshape(TILE,TILE,4)
                selection=np.s_[top-ty*TILE:bottom-ty*TILE,left-tx*TILE:right-tx*TILE]
                image[selection][covered]=self.color;mask[selection][covered]=[1,0,0,0]
        self.version+=1;self.cached=None

    def planes(self):
        if self.cached is not None:return self.cached
        blank=uniform(self.source.width,self.source.height);image_store=OverlayTiles(self.source._store);mask_store=OverlayTiles(blank._store)
        image_keys=list(self.source.keys);mask_keys=list(blank.keys)
        for i,data in self.image_buffers.items():image_keys[i]=image_store.put(bytes(data))
        for i,data in self.mask_buffers.items():mask_keys[i]=mask_store.put(bytes(data))
        self.cached=(PixelPlane(self.source.width,self.source.height,image_keys,image_store),PixelPlane(blank.width,blank.height,mask_keys,mask_store))
        return self.cached

    def edits(self):
        # Deliberately bounded bridge for old small documents only.
        from engine.spatial_constraints import indices,ENCODING
        pixels,mask=self.planes()
        drawing=dict(pixels=pixels,protected_mask=mask,protection_encoding=ENCODING)
        return {i:pixels[i] for i in indices(drawing)}
