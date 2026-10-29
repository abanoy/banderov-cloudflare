"""Independent bounded native raster-window import, never a general KRA loader.

REF-KRA-LOADER-FLAGS / REF-KRITA-CHANNEL-LOCKS / REF-KRA-FRAME-STORAGE
and existing tile/LZF/BGRA sources describe the format. No upstream code copied.
The original archive remains external; exact consumed key bytes are embedded.
"""
from pathlib import Path,PurePosixPath
from copy import deepcopy
import base64,bisect,hashlib,io,math,re,struct,zipfile
import xml.etree.ElementTree as ET
import numpy as np
from engine.io.kra_raster import PROFILE,unlzf
from engine.io.project_archive import PixelPlane,MemoryTiles,SourceBlob,TILE_BYTES
from engine.project import create,fingerprint,validate
from engine.layers import validate_layers
from engine.packed_model import check_budget,LIVE_ASSETS

SOURCES=['REF-KRA-LOADER-FLAGS','REF-KRITA-CHANNEL-LOCKS','REF-KRA-FRAME-STORAGE','REF-KRA-TILES','REF-KRA-LZF','REF-KRA-BGRA','REF-KRITA-ANIMATION-SOURCE','REF-KRITA-KRA','REF-PYTHON-COPY','REF-NUMPY-2-4-1','REF-NUMPY-BUFFER','REF-ADOBE-DESCRIPTORS','REF-KRITA-ASL-READER']
MAX_ARCHIVE=4*1024**3
MAX_MEMBER=16*1024**2
MAX_PAYLOADS=256*1024**2


def _tag(n):return n.tag.rsplit('}',1)[-1]


def _safe(name,single=False):
    if not isinstance(name,str) or not name or '\\' in name or ':' in name or '\0' in name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or (single and (name in {'.','..'} or '/' in name)):
        raise ValueError('Unsafe native archive reference')
    return name


def _digest(path,checkpoint):
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(4*1024**2),b''):checkpoint();digest.update(block)
    return digest.hexdigest()


def _zip_index_bound(path):
    """Bound the central directory before zipfile allocates its index."""
    size=path.stat().st_size
    if not 22<=size<=MAX_ARCHIVE:raise ValueError('Native window archive must be22bytes..4GiB')
    with path.open('rb') as f:
        f.seek(max(0,size-65557));tail=f.read(65557);position=len(tail)
        while True:
            position=tail.rfind(b'PK\x05\x06',0,position)
            if position<0:raise ValueError('Native ZIP end record missing')
            if len(tail)-position>=22:
                values=struct.unpack('<4s4H2LH',tail[position:position+22])
                if position+22+values[-1]==len(tail):break
        _,disk,cd_disk,n_disk,n,size_cd,offset,_=values
        if disk or cd_disk or n_disk!=n:raise ValueError('Multidisk native archives unsupported')
        if n==65535 or size_cd==offset==0xffffffff or size_cd==0xffffffff or offset==0xffffffff:
            eocd=size-len(tail)+position
            if eocd<20:raise ValueError('ZIP64 locator missing')
            f.seek(eocd-20);locator=f.read(20)
            if locator[:4]!=b'PK\x06\x07':raise ValueError('ZIP64 locator missing')
            _,disk,where,disks=struct.unpack('<4sLQL',locator)
            if disk or disks!=1 or where>size-56:raise ValueError('Unsupported ZIP64 layout')
            f.seek(where);record=f.read(56)
            sig,length,_,_,disk,cd_disk,n_disk,n,size_cd,offset=struct.unpack('<4sQ2H2L4Q',record)
            if sig!=b'PK\x06\x06' or not 44<=length<=1024 or disk or cd_disk or n_disk!=n:raise ValueError('Unsupported ZIP64 end record')
        if not 1<=n<=32768 or size_cd>16*1024**2 or offset+size_cd>size:raise ValueError('Native archive directory exceeds window index bounds')


def decode_plane(data,width,height,offset=(0,0),store=None,checkpoint=None):
    """Decode native64-square BGRA tiles directly into bounded immutable RGBA tiles.

    Native off-canvas/hidden-RGB bytes remain in the retained source payload.
    This plane is explicitly the canvas intersection, not an infinite device.
    """
    call=checkpoint or (lambda:None)
    if not isinstance(offset,(tuple,list)) or len(offset)!=2:raise ValueError('Native offset must have exactly two integer coordinates')
    if any(type(v) is not int for v in (width,height,*offset)) or not 1<=width<=4096 or not 1<=height<=4096 or any(abs(v)>16384 for v in offset):raise ValueError('Unsupported native raster placement')
    if len(data)>MAX_MEMBER:raise ValueError('Native key payload exceeds16MiB')
    stream=io.BytesIO(data)
    if [stream.readline(80) for _ in range(4)]!=[b'VERSION 2\n',b'TILEWIDTH 64\n',b'TILEHEIGHT 64\n',b'PIXELSIZE 4\n']:raise ValueError('Native window requires version2 BGRA8 tiles')
    match=re.fullmatch(rb'DATA (\d+)\n',stream.readline(80))
    if not match or not 0<=int(match[1])<=4096:raise ValueError('Native key tile count exceeds4096')
    store=store if store is not None else MemoryTiles();zero=store.put(bytes(TILE_BYTES));columns=(width+63)//64;keys=[zero]*(columns*((height+63)//64));seen=set();outside=0
    for _ in range(int(match[1])):
        call();header=re.fullmatch(rb'(-?\d+),(-?\d+),LZF,(\d+)\n',stream.readline(80))
        if not header:raise ValueError('Invalid native tile header')
        x,y,size=map(int,header.groups())
        if x%64 or y%64 or (x,y) in seen or abs(x)>32768 or abs(y)>32768 or not 1<=size<=16385:raise ValueError('Invalid native tile coordinates/count')
        seen.add((x,y));payload=stream.read(size)
        if len(payload)!=size:raise ValueError('Truncated native tile payload')
        if payload[0]==1:
            planes=unlzf(payload[1:]);bgra=np.frombuffer(planes,np.uint8).reshape(4,64,64).transpose(1,2,0)
        elif payload[0]==0 and size==16385:bgra=np.frombuffer(payload[1:],np.uint8).reshape(64,64,4)
        else:raise ValueError('Unsupported native tile compression')
        rgba=bgra[:,:,[2,1,0,3]];wx,wy=x+offset[0],y+offset[1];left,top=max(0,wx),max(0,wy);right,bottom=min(width,wx+64),min(height,wy+64)
        outside+=int(np.count_nonzero(rgba[:,:,3]))
        if left>=right or top>=bottom:continue
        outside-=int(np.count_nonzero(rgba[top-wy:bottom-wy,left-wx:right-wx,3]))
        for ty in range(top//64,(bottom-1)//64+1):
            for tx in range(left//64,(right-1)//64+1):
                index=ty*columns+tx;tile=np.frombuffer(store.get(keys[index]),np.uint8).reshape(64,64,4).copy();a,b=max(left,tx*64),max(top,ty*64);c,d=min(right,(tx+1)*64),min(bottom,(ty+1)*64)
                tile[b-ty*64:d-ty*64,a-tx*64:c-tx*64]=rgba[b-wy:d-wy,a-wx:c-wx];keys[index]=store.put(tile.tobytes())
        if len(store.assets)*TILE_BYTES>LIVE_ASSETS:raise ValueError('Native window decoded tiles exceed unchanged256MiB live bound')
    if stream.read(1):raise ValueError('Trailing native tile bytes')
    return PixelPlane(width,height,keys,store),dict(native_tiles=len(seen),outside_canvas_nontransparent_samples=outside,offset=list(offset))


class KraWindow:
    def __init__(self,path,checkpoint=None):
        self.path=Path(path).resolve();self.call=checkpoint or (lambda:None);self.archive=None;self.bytes_read=0;self.read_members=[]
        _zip_index_bound(self.path);self.stat=self.path.stat();self.sha256=_digest(self.path,self.call)
        try:
            self.archive=zipfile.ZipFile(self.path);infos=self.archive.infolist();names=[i.filename for i in infos]
            if len(names)!=len(set(names)) or any(i.flag_bits&1 or i.compress_type not in {0,8} for i in infos):raise ValueError('Duplicate/encrypted/unsupported native archive member')
            for name in names:_safe(name)
            self.names=set(names)
            if self.read('mimetype',64)!=b'application/x-krita':raise ValueError('Expected Krita native mimetype')
            self.document_bytes=self.read('maindoc.xml',4*1024**2);root=self.xml(self.document_bytes);self.image=next((n for n in root if _tag(n)=='IMAGE'),None)
            if self.image is None:raise ValueError('Native image metadata missing')
            self.width,self.height=int(self.image.get('width','0')),int(self.image.get('height','0'))
            if not 1<=self.width<=4096 or not 1<=self.height<=4096 or self.image.get('colorspacename')!='RGBA':raise ValueError('Window route requires RGBA8 canvas<=4096')
            self.location=_safe(self.image.get('name',''),True);self.prefix=self.location+'/layers/'
            self.resolution={key:float(self.image.get(attribute,'72')) for key,attribute in [('x','x-res'),('y','y-res')]}
            if any(not math.isfinite(v) or not 0<v<=100000 for v in self.resolution.values()):raise ValueError('Invalid native document resolution')
            self.profile=self.read(self.location+'/annotations/icc',1024**2)
            if hashlib.sha256(self.profile).hexdigest()!=PROFILE:raise ValueError('Untested native image ICC profile; no silent conversion')
            background=next((n for n in self.image if _tag(n)=='ProjectionBackgroundColor'),None)
            if background is not None and base64.b64decode(background.get('ColorData',''),validate=True)!=b'\0\0\0\0':raise ValueError('Nontransparent native projection background unsupported')
            animation=next((n for n in self.image if _tag(n)=='animation'),None);fields={} if animation is None else {_tag(n):n for n in animation}
            rate=float(fields['framerate'].get('value')) if 'framerate' in fields else 24.
            self.clip_start=int(fields['range'].get('from')) if 'range' in fields else 0;self.clip_end=int(fields['range'].get('to'))+1 if 'range' in fields else 1
            self.current_time=int(fields['currentTime'].get('value')) if 'currentTime' in fields else self.clip_start
            if not rate.is_integer() or not 1<=rate<=120 or not 0<=self.clip_start<self.clip_end<=1000000:raise ValueError('Unsupported native clip timing')
            self.fps=int(rate);self.nodes={};self.order=[];self.schedules={};self.key_xml={}
            container=next((n for n in self.image if _tag(n)=='layers'),None)
            if container is None:raise ValueError('Native layer tree missing')
            self.walk(container)
            self.verify_source()
        except Exception:self.close();raise

    @staticmethod
    def xml(data):
        if b'<!ENTITY' in data.upper():raise ValueError('Native XML entities unsupported')
        return ET.fromstring(data)

    def read(self,name,limit=MAX_MEMBER):
        _safe(name);info=self.archive.getinfo(name)
        if info.file_size>limit:raise ValueError('Native member exceeds selected read budget')
        self.call()
        with self.archive.open(info) as stream:data=stream.read(limit+1)
        if len(data)!=info.file_size or len(data)>limit:raise ValueError('Native member size mismatch')
        self.bytes_read+=len(data);self.read_members.append(name);return data

    def walk(self,container,parent=None,depth=0):
        if depth>12:raise ValueError('Native layer hierarchy too deep')
        for order,node in enumerate(container):
            if _tag(node)!='layer' or len(self.nodes)>=1024:raise ValueError('Invalid/excessive native layer index')
            attrs=dict(node.attrib);identity=attrs.get('uuid') or attrs.get('filename');kind=attrs.get('nodetype')
            if not identity or len(identity)>128 or identity in self.nodes:raise ValueError('Native layer identity missing/duplicate')
            filename=_safe(attrs.get('filename',''),True);opacity=int(attrs.get('opacity','255'))
            if not 0<=opacity<=255 or any(attrs.get(k,'1' if k=='visible' else '0') not in {'0','1'} for k in ['visible','locked']):raise ValueError('Invalid native layer flags')
            self.nodes[identity]=dict(attributes=attrs,parent=parent,order=order,children=[_tag(n) for n in node],kind=kind,filename=filename,child_kinds=[c.get('nodetype') for n in node if _tag(n)=='layers' for c in n]);self.order.append(identity)
            if kind=='grouplayer':
                for child in node:
                    if _tag(child)=='layers':self.walk(child,identity,depth+1)

    def visible(self,identity):
        while identity is not None:
            node=self.nodes[identity]
            if node['attributes'].get('visible','1')!='1':return False
            identity=node['parent']
        return True

    def supported_node(self,identity,style_policy='reject'):
        node=self.nodes[identity];a=node['attributes'];kind=node['kind']
        allowed={'name','y','filename','channelflags','x','uuid','colorspacename','onionskin','locked','colorlabel','visible','channellockflags','opacity','collapsed','compositeop','nodetype','intimeline','selected','profile','passthrough','keyframes','layerstyle','selection','channel','inheritalpha'}
        if set(a)-allowed or kind not in {'paintlayer','grouplayer'} or a.get('compositeop','normal')!='normal' or a.get('colorspacename','RGBA')!='RGBA' or a.get('passthrough','0')!='0':raise ValueError('Selected native node has unsupported kind/blend/profile/pass-through')
        if any(a.get(k) not in {None,'','0'} for k in ['selection','channel','inheritalpha']) or any(a.get(k) not in {None,'','1111'} for k in ['channelflags','channellockflags']):raise ValueError('Selected native channel/alpha locks or style unsupported')
        if a.get('layerstyle') not in {None,'','0'} and style_policy=='reject':raise ValueError('Native layer styles need rendering support; explicit retain_unrendered mode preserves them for raw studies only')
        if any(child!='layers' for child in node['children']):raise ValueError('Selected native masks/child metadata unsupported')
        if (kind=='paintlayer' and node['child_kinds']) or any(k not in {'paintlayer','grouplayer'} for k in node['child_kinds']):raise ValueError('Selected native masks/child layers unsupported')
        if kind=='grouplayer' and (int(a.get('x','0')) or int(a.get('y','0'))):raise ValueError('Translated native group unsupported')

    def keys(self,identity):
        if identity in self.schedules:return self.schedules[identity]
        node=self.nodes[identity];a=node['attributes']
        if 'keyframes' in a:
            name=self.prefix+_safe(a['keyframes'],True);raw=self.read(name,2*1024**2);self.key_xml[name]=SourceBlob(raw);root=self.xml(raw);channels=list(root)
            if len(channels)!=1 or _tag(channels[0])!='channel' or channels[0].get('name')!='content':raise ValueError('Only native raster content keyframes supported')
            keys=[]
            for key in channels[0]:
                if _tag(key)!='keyframe' or set(key.attrib)-{'time','frame','color-label'}:raise ValueError('Unsupported native raster key metadata')
                children=list(key)
                if len(children)>1 or any(_tag(c)!='offset' for c in children):raise ValueError('Unsupported native key child metadata')
                offset=children[0] if children else None
                if offset is not None and (set(offset.attrib)-{'x','y','type'} or offset.get('type','point')!='point'):raise ValueError('Unsupported native key offset metadata')
                position=(int(offset.get('x','0')),int(offset.get('y','0'))) if offset is not None else (0,0)
                keys.append(dict(time=int(key.get('time')),member=self.prefix+_safe(key.get('frame',''),True),offset=list(position),attributes=dict(key.attrib)))
            keys.sort(key=lambda k:k['time'])
            if not keys or len(keys)>4096 or len({k['time'] for k in keys})!=len(keys) or keys[0]['time']<0:raise ValueError('Invalid native content-key schedule')
        else:keys=[dict(time=0,member=self.prefix+node['filename'],offset=[int(a.get('x','0')),int(a.get('y','0'))],attributes={})]
        self.schedules[identity]=keys;return keys

    def verify_source(self):
        stat=self.path.stat()
        if stat.st_size!=self.stat.st_size or stat.st_mtime_ns!=self.stat.st_mtime_ns or _digest(self.path,self.call)!=self.sha256:raise ValueError('Native archive changed while reading; discard this window')
        return True

    def import_window(self,start,end,layer_ids=None,style_policy='reject'):
        if not isinstance(style_policy,str) or style_policy not in {'reject','retain_unrendered'}:raise ValueError('Unknown native style policy')
        if any(type(v) is not int for v in (start,end)) or not self.clip_start<=start<end<=self.clip_end or end-start>600:raise ValueError('Choose an inclusive start/exclusive end within native clip, at most600slots')
        if layer_ids is None:
            for identity in self.order:
                if self.visible(identity):self.supported_node(identity,style_policy)
            selected=[i for i in self.order if self.nodes[i]['kind']=='paintlayer' and self.visible(i)]
        else:
            if not isinstance(layer_ids,list) or not layer_ids or any(not isinstance(i,str) for i in layer_ids) or len(layer_ids)!=len(set(layer_ids)):raise ValueError('Select distinct native raster layer IDs')
            if any(i not in self.nodes or self.nodes[i]['kind']!='paintlayer' for i in layer_ids):raise ValueError('Select indexed native raster layers')
            selected=[i for i in self.order if i in layer_ids]
        if not selected:raise ValueError('No raster layers selected')
        included=set(selected)
        for identity in selected:
            parent=self.nodes[identity]['parent']
            while parent is not None:included.add(parent);parent=self.nodes[parent]['parent']
        if len(included)>32:raise ValueError('Selected native hierarchy exceeds unchanged32layer bound')
        for identity in included:self.supported_node(identity,style_policy)
        style_layers={i:self.nodes[i]['attributes'].get('layerstyle') for i in included if self.nodes[i]['attributes'].get('layerstyle') not in {None,'','0'}}
        style_bytes=None;style_metadata=None
        if style_layers:
            from engine.io.asl_metadata import parse
            style_bytes=SourceBlob(self.read(self.location+'/annotations/layerstyles.asl'))
            style_metadata=parse(style_bytes.data)
            identities=[]
            for row in style_metadata['styles']:
                value=row['identification']['items'].get('Idnt',{}).get('value')
                if not isinstance(value,str):raise ValueError('Invalid native style identification')
                identities.append(value.strip('{}').lower())
            if any(value.strip('{}').lower() not in identities for value in style_layers.values()):raise ValueError('Selected native layer style identity not resolved')
        cached=None
        if start<=self.current_time<end and 'mergedimage.png' in self.names:cached=SourceBlob(self.read('mergedimage.png',64*1024**2))
        store=MemoryTiles();zero=store.put(bytes(TILE_BYTES));blank=PixelPlane(self.width,self.height,[zero]*(((self.width+63)//64)*((self.height+63)//64)),store);project=create(blank,self.width,self.height,end-start);project.update(project_id='native-window-'+self.sha256[:16]+'-'+str(start)+'-'+str(end),layers={},drawings={},originals={},exposures=[]);frames=[];payloads={};profile_blobs={};cache={};drawing_details={};total_payload=0
        for identity in self.order:
            if identity not in included:continue
            node=self.nodes[identity];a=node['attributes'];project['layers'][identity]=dict(name=a.get('name',identity),nodetype=node['kind'],parent_id=node['parent'],order=node['order'],visible=a.get('visible','1')=='1',locked=a.get('locked','0')=='1',opacity=int(a.get('opacity','255')),native_attributes=deepcopy(a))
            if node['kind']=='grouplayer':continue
            profile_name=self.prefix+node['filename']+'.icc';profile=self.read(profile_name,1024**2)
            if hashlib.sha256(profile).hexdigest()!=PROFILE:raise ValueError('Selected layer ICC differs from exact tested profile')
            profile_blobs[profile_name]=SourceBlob(profile);keys=self.keys(identity);times=[k['time'] for k in keys];cuts=sorted({start}|{t for t in times if start<t<end});stops=cuts[1:]+[end]
            for t,stop in zip(cuts,stops):
                self.call();index=bisect.bisect_right(times,t)-1;record=keys[index] if index>=0 else None
                cache_key=None if record is None else (record['member'],tuple(record['offset']))
                if cache_key not in cache:
                    if len(project['drawings'])>=512:raise ValueError('Native window exceeds unchanged512drawing bound; narrow interval/layers')
                    did='native-'+str(len(cache));plane=blank;details={}
                    if record is not None:
                        member=record['member']
                        if member not in payloads:
                            info=self.archive.getinfo(member)
                            if total_payload+info.file_size>MAX_PAYLOADS:raise ValueError('Selected native source payloads exceed256MiB; narrow window')
                            payloads[member]=SourceBlob(self.read(member));total_payload+=info.file_size
                            default=self.read(member+'.defaultpixel',4)
                            if default!=bytes(4):raise ValueError('Nontransparent native default pixel unsupported')
                        plane,details=decode_plane(payloads[member].data,self.width,self.height,tuple(record['offset']),store,self.call)
                    cache[cache_key]=did;drawing_details[did]=details;project['drawings'][did]=dict(pixels=plane,origin='artist' if record else 'native_blank',approved=True,locked=True)
                did=cache[cache_key];project['exposures'].append(dict(layer_id=identity,drawing_id=did,start=t-start,length=stop-t));frames.append(dict(layer_id=identity,drawing_id=did,native_time=t if record is None else record['time'],native_exposure_start=t,native_exposure_end=stop,record=deepcopy(record),decoded_details=deepcopy(drawing_details[did])))
        project['canvas']['resolution']=deepcopy(self.resolution)
        project['originals']=deepcopy(project['drawings']);project['originals_sha256']=fingerprint(project['originals']);project['shot']['fps']['numerator']=self.fps
        project['native_window_source']=dict(version='native-window-1',archive_path=str(self.path),archive_sha256=self.sha256,archive_bytes=self.stat.st_size,original_required_for_full_native_document=True,source_document=SourceBlob(self.document_bytes),image_profile=SourceBlob(self.profile),layer_profiles=profile_blobs,keyframe_xml=deepcopy(self.key_xml),native_payloads=payloads,selected_layers=selected,excluded_layer_ids=[i for i in self.order if i not in included],native_start=start,native_end_exclusive=end,source_clip=[self.clip_start,self.clip_end],native_current_time=self.current_time,frame_records=frames,source_ids=SOURCES[:],payload_bytes_consumed=total_payload,archive_decoded_member_bytes=self.bytes_read,decoded_tile_bytes=len(store.assets)*TILE_BYTES,canvas_intersection_explicit=True,offcanvas_bytes_retained_in_payloads=True,window_is_not_full_native_import=True)
        project['native_window_source'].update(style_policy=style_policy,unrendered_style_layers=style_layers,style_library=style_bytes,style_metadata=style_metadata,cached_projection=cached,cached_projection_native_time=self.current_time if cached else None)
        project['native_window_source']['original_planes']={did:d['pixels'].identity for did,d in project['originals'].items()}
        project['native_window_source']['manifest_sha256']=fingerprint(project['native_window_source'])
        validate_source(project)
        project['import_note']='Experimental native layer/time window. Exact supported ICC profile, original XML stacking, source locks and selected native payloads retained including off-canvas paint; displayed rasters intersect canvas. Full native document remains the external hashed archive. Unselected/outside-window content is not imported. Unsupported selected features refuse; no broad native or color-conversion claim.'
        if style_layers:project['import_note']+=' NATIVE STYLES RETAINED BUT NOT RENDERED: this is an explicit raw-layer study, not the original styled appearance.'
        validate(project);validate_layers(project);check_budget(project);self.verify_source();return project

    def close(self):
        if self.archive is not None:self.archive.close();self.archive=None
    def __enter__(self):return self
    def __exit__(self,*args):self.close()


def validate_source(project):
    """Validate retained-source identity without auto-opening an external path."""
    source=project.get('native_window_source')
    if not isinstance(source,dict) or source.get('version')!='native-window-1':raise ValueError('Invalid retained native window source')
    payload={k:v for k,v in source.items() if k!='manifest_sha256'}
    if fingerprint(payload)!=source.get('manifest_sha256'):raise ValueError('Retained native window manifest changed')
    if not isinstance(source.get('archive_path'),str) or len(source['archive_path'])>32768 or not re.fullmatch('[a-f0-9]{64}',source.get('archive_sha256','')):raise ValueError('Invalid retained native archive identity')
    for item in [source.get('source_document'),source.get('image_profile'),*source.get('native_payloads',{}).values(),*source.get('keyframe_xml',{}).values(),*source.get('layer_profiles',{}).values()]:
        if not isinstance(item,SourceBlob):raise ValueError('Native window source bytes missing')
    for item in [source.get('style_library'),source.get('cached_projection')]:
        if item is not None and not isinstance(item,SourceBlob):raise ValueError('Native style/reference source bytes missing')
    if source['image_profile'].sha256!=PROFILE or any(b.sha256!=PROFILE for b in source['layer_profiles'].values()):raise ValueError('Native window ICC identity changed')
    for did,identity in source.get('original_planes',{}).items():
        if did not in project['originals'] or project['originals'][did]['pixels'].identity!=identity:raise ValueError('Retained native original plane changed')
    for record in source['frame_records']:
        if record['drawing_id'] not in source['original_planes'] or record['record'] is not None and record['record']['member'] not in source['native_payloads']:raise ValueError('Native frame source binding missing')
    return source


def verify_external_source(project,path=None,checkpoint=None):
    """Explicit check for a caller-authorized original or relocated archive."""
    source=validate_source(project);candidate=Path(path if path is not None else source['archive_path'])
    if candidate.stat().st_size!=source['archive_bytes'] or _digest(candidate,checkpoint or (lambda:None))!=source['archive_sha256']:raise ValueError('External native source identity changed')
    return candidate
