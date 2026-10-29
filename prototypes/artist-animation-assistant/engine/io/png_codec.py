"""Independent bounded PNG sample decoder/encoder against REF-PNG.

Noninterlaced RGB/gray/indexed/alpha <=8bits,256px,2MB. No ICC/HDR/APNG
conversion. Samples are expanded losslessly to straight-alpha sRGB RGBA8.
"""
import binascii
import struct
import zlib

SIGNATURE = b'\x89PNG\r\n\x1a\n'


def chunk(kind, payload):
    return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',binascii.crc32(kind+payload)&0xffffffff)


def encode_png(width,height,pixels):
    if any(type(n) is not int or not 1 <= n <= 256 for n in (width,height)) or len(pixels) != width*height:
        raise ValueError('PNG raster outside supported bounds')
    if any(len(p)!=4 or any(type(c) is not int or not 0 <= c <= 255 for c in p) for p in pixels):
        raise ValueError('Expected RGBA8 samples')
    raw = b''.join(b'\0'+bytes(c for p in pixels[y*width:(y+1)*width] for c in p) for y in range(height))
    return SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'sRGB',b'\0')+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')


def read_png(data, *, packed=False):
    limit=64*1024*1024 if packed else 2_000_000
    side=4096 if packed else 256
    if len(data)>limit or not data.startswith(SIGNATURE):
        raise ValueError('Expected PNG <=2MB')
    offset, header, palette, transparency = 8,None,None,None
    compressed = bytearray()
    seen, idat_closed, ended = set(),False,False
    while offset<len(data):
        if offset+12>len(data):
            raise ValueError('Truncated PNG chunk')
        length = struct.unpack('>I',data[offset:offset+4])[0]
        if offset+12+length>len(data):
            raise ValueError('PNG chunk exceeds input bounds')
        kind,payload = data[offset+4:offset+8],data[offset+8:offset+8+length]
        if len(kind)!=4 or not all(65<=c<=90 or 97<=c<=122 for c in kind) or kind[2]&32:
            raise ValueError('Invalid PNG chunk type')
        crc = struct.unpack('>I',data[offset+8+length:offset+12+length])[0]
        if binascii.crc32(kind+payload)&0xffffffff != crc:
            raise ValueError('PNG CRC mismatch')
        if header is None and kind!=b'IHDR':
            raise ValueError('PNG must begin with IHDR')
        if kind!=b'IDAT' and b'IDAT' in seen:
            idat_closed=True
        if kind in {b'IHDR',b'PLTE',b'tRNS',b'IEND',b'sRGB',b'gAMA',b'cHRM'} and kind in seen:
            raise ValueError('Duplicate PNG singleton chunk')
        if kind==b'IHDR':
            if length!=13:
                raise ValueError('Invalid PNG header length')
            header=struct.unpack('>IIBBBBB',payload)
            width,height,depth,color,compression,filtering,interlace=header
            if not 1<=width<=side or not 1<=height<=side or color not in {0,2,3,4,6} or depth not in ({1,2,4,8} if color in {0,3} else {8}) or (compression,filtering,interlace)!=(0,0,0):
                raise ValueError('Unsupported PNG depth/color/interlace/canvas; no silent conversion')
            if packed and (depth!=8 or color not in {2,6}):raise ValueError('Large PNG route requires8bitRGB/RGBA; smaller gray/indexed inputs retain legacy route')
        elif kind==b'PLTE':
            if b'IDAT' in seen or header[3] in {0,4} or not 3<=length<=768 or length%3 or (header[3]==3 and length//3>2**header[2]):
                raise ValueError('Invalid PNG palette')
            palette=[list(payload[i:i+3]) for i in range(0,length,3)]
        elif kind==b'tRNS':
            color=header[3]
            if b'IDAT' in seen or color in {4,6} or (color==0 and length!=2) or (color==2 and length!=6) or (color==3 and (palette is None or not 1<=length<=len(palette))):
                raise ValueError('Invalid PNG transparency table')
            transparency=payload
        elif kind==b'IDAT':
            if idat_closed or (header[3]==3 and palette is None):
                raise ValueError('PNG IDAT ordering/palette error')
            compressed.extend(payload)
        elif kind==b'IEND':
            if length or b'IDAT' not in seen or offset+12!=len(data):
                raise ValueError('Invalid PNG end/trailing data')
            ended=True
            break
        elif kind in {b'iCCP',b'cICP',b'cLLI',b'mDCV',b'acTL',b'fcTL',b'fdAT'}:
            raise ValueError('ICC/HDR/APNG conversion is not supported yet')
        elif kind==b'gAMA':
            if b'IDAT' in seen or payload!=struct.pack('>I',45455):
                raise ValueError('Only sRGB gamma supported')
        elif kind==b'cHRM':
            if b'IDAT' in seen or payload!=struct.pack('>8I',31270,32900,64000,33000,30000,60000,15000,6000):
                raise ValueError('Only sRGB primaries supported')
        elif kind==b'sRGB':
            if b'IDAT' in seen or length!=1 or payload[0]>3:
                raise ValueError('Invalid sRGB declaration')
        elif not kind[0]&32:
            raise ValueError('Unknown critical PNG chunk')
        seen.add(kind)
        offset+=length+12
    if not ended:
        raise ValueError('Incomplete PNG')
    width,height,depth,color,*_=header
    channels={0:1,2:3,3:1,4:2,6:4}[color]
    stride=(width*depth*channels+7)//8
    bpp=max(1,(depth*channels+7)//8)
    expected=height*(stride+1)
    inflater=zlib.decompressobj()
    raw=inflater.decompress(compressed,expected+1)
    if len(raw)!=expected or not inflater.eof or inflater.unconsumed_tail or inflater.unused_data:
        raise ValueError('PNG decompression size/bounds mismatch')
    if packed:
        from engine.packed_render import decode_rows
        transparent=tuple(v&255 for v in struct.unpack('>3H',transparency)) if transparency is not None else None
        return width,height,decode_rows(raw,width,height,channels,transparent)
    rows=[]
    previous=bytearray(stride)
    for y in range(height):
        mode=raw[y*(stride+1)]
        row=bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        if mode>4:
            raise ValueError('Unsupported PNG filter')
        for i in range(stride):
            left=row[i-bpp] if i>=bpp else 0
            above=previous[i]
            upper_left=previous[i-bpp] if i>=bpp else 0
            predictor=0
            if mode==1:
                predictor=left
            elif mode==2:
                predictor=above
            elif mode==3:
                predictor=(left+above)//2
            elif mode==4:
                estimate=left+above-upper_left
                distances=[abs(estimate-v) for v in (left,above,upper_left)]
                predictor=(left,above,upper_left)[distances.index(min(distances))]
            row[i]=(row[i]+predictor)&255
        rows.append(row)
        previous=row
    transparent=None
    if transparency is not None and color in {0,2}:
        transparent=tuple(v&((1<<depth)-1) for v in struct.unpack('>H' if color==0 else '>3H',transparency))
    pixels=[]
    for row in rows:
        for x in range(width):
            if depth<8:
                value=(row[x*depth//8]>>(8-depth-(x*depth)%8))&((1<<depth)-1)
                samples=[value]
            else:
                samples=list(row[x*channels:(x+1)*channels])
            if color==0:
                gray=samples[0]*255//((1<<depth)-1)
                pixel=[gray]*3+[0 if transparent==tuple(samples) else 255]
            elif color==2:
                pixel=samples+[0 if transparent==tuple(samples) else 255]
            elif color==3:
                index=samples[0]
                if index>=len(palette):
                    raise ValueError('PNG palette index out of range')
                pixel=palette[index]+[transparency[index] if transparency is not None and index<len(transparency) else 255]
            elif color==4:
                pixel=[samples[0]]*3+[samples[1]]
            else:
                pixel=samples
            pixels.append(pixel)
    return width,height,pixels
