"""Original bounded tiled storage. REF-PYTHON-ZIP/BUFFERS/COPY.

This storage layer is independent of document semantics and the old list renderer.
No pickle, extraction, executable payloads, or borrowed implementation. Hashes are
integrity identities, not authentication. Lazy tiles are verified on first access.
"""
import base64
from collections import OrderedDict
from collections.abc import Sequence
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import struct
import uuid
import zipfile

TILE = 64
TILE_BYTES = TILE * TILE * 4
MAX_SIDE = 4096
MAX_METADATA = 8 * 1024 * 1024
MAX_ARCHIVE = 512 * 1024 * 1024
MAX_EXPANDED = 1024 * 1024 * 1024
MAX_MEMBERS = 60000
MAX_BLOB = 64 * 1024 * 1024
MIME = b'application/x-artist-assistant-packed-project'
TAG = '@artist-assistant'
HEX = re.compile(r'[a-f0-9]{64}')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def dimensions(width, height):
    if any(type(n) is not int or not 1 <= n <= MAX_SIDE for n in (width, height)):
        raise ValueError('Packed storage supports integer dimensions1..4096')
    return width, height


class SourceBlob:
    __slots__=('data','sha256')
    def __init__(self,data):
        if type(data) is not bytes or len(data)>MAX_BLOB:raise ValueError('Invalid retained binary source')
        self.data=data;self.sha256=digest(data)
    def __setattr__(self,key,value):
        if hasattr(self,key):raise AttributeError('SourceBlob is immutable')
        object.__setattr__(self,key,value)
    def __deepcopy__(self,memo):return self
    def __eq__(self,other):return isinstance(other,SourceBlob) and self.sha256==other.sha256 and self.data==other.data


class MemoryTiles:
    def __init__(self):
        self.assets = {}

    def put(self, data):
        if type(data) is not bytes or len(data) != TILE_BYTES:
            raise ValueError('Expected one packed RGBA8 tile')
        identity = digest(data)
        if identity not in self.assets and (len(self.assets) + 1) * TILE_BYTES > MAX_EXPANDED:
            raise ValueError('Packed memory tile pool budget exceeded')
        self.assets.setdefault(identity, data)
        return identity

    def get(self, identity):
        return self.assets[identity]


class OverlayTiles(MemoryTiles):
    def __init__(self, parent):
        super().__init__()
        self.parent = parent.parent if isinstance(parent,OverlayTiles) else parent
        if isinstance(parent,OverlayTiles):self.assets=dict(parent.assets)

    def get(self, identity):
        return self.assets[identity] if identity in self.assets else self.parent.get(identity)


class PixelPlane(Sequence):
    """Read-only tiled RGBA8 view; editing creates another immutable tile tuple.

    A small bounded cache belongs to the archive, not every drawing. A plane backed
    by a closed archive fails explicitly. Call detached() when independent lifetime
    is needed. No pixel-array expansion occurs in deepcopy or with_edits.
    """
    __slots__ = ('width', 'height', 'keys', '_store', '_identity')

    def __init__(self, width, height, keys, store):
        dimensions(width, height)
        expected = ((width + TILE - 1) // TILE) * ((height + TILE - 1) // TILE)
        if len(keys) != expected or any(type(k) is not str or not HEX.fullmatch(k) for k in keys):
            raise ValueError('Invalid tile grid references')
        self.width, self.height, self.keys, self._store = width, height, tuple(keys), store
        self._identity=digest(json.dumps([width,height,self.keys],separators=(',',':')).encode())

    def __setattr__(self, key, value):
        if hasattr(self, key):
            raise AttributeError('PixelPlane is immutable; use with_edits')
        object.__setattr__(self, key, value)

    def __len__(self):
        return self.width * self.height

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self[i] for i in range(*index.indices(len(self)))]
        if type(index) is not int:
            raise TypeError('Expected integer pixel index')
        if index < 0:
            index += len(self)
        if not 0 <= index < len(self):
            raise IndexError(index)
        y, x = divmod(index, self.width)
        columns = (self.width + TILE - 1) // TILE
        data = self._store.get(self.keys[(y // TILE) * columns + x // TILE])
        offset = ((y % TILE) * TILE + x % TILE) * 4
        return list(data[offset:offset + 4])

    def __eq__(self,other):
        return isinstance(other,PixelPlane) and (self.width,self.height,self.keys)==(other.width,other.height,other.keys)

    def __deepcopy__(self, memo):
        return self

    @property
    def identity(self):
        return self._identity

    @classmethod
    def from_rgba(cls, width, height, data, store=None):
        dimensions(width, height)
        if type(data) is not bytes or len(data) != width * height * 4:
            raise ValueError('Expected tightly packed RGBA8 bytes')
        store = store if store is not None else MemoryTiles()
        keys = []
        for y in range(0, height, TILE):
            for x in range(0, width, TILE):
                tile = bytearray(TILE_BYTES)
                size = min(TILE, width - x) * 4
                for row in range(min(TILE, height - y)):
                    offset = ((y + row) * width + x) * 4
                    tile[row * TILE * 4:row * TILE * 4 + size] = data[offset:offset + size]
                keys.append(store.put(bytes(tile)))
        return cls(width, height, keys, store)

    @classmethod
    def from_pixels(cls, width, height, pixels):
        dimensions(width, height)
        if len(pixels) != width * height:
            raise ValueError('Wrong raster bounds')
        store, keys = MemoryTiles(), []
        for y in range(0, height, TILE):
            for x in range(0, width, TILE):
                tile = bytearray(TILE_BYTES)
                for dy in range(min(TILE, height - y)):
                    for dx in range(min(TILE, width - x)):
                        p = pixels[(y + dy) * width + x + dx]
                        if len(p) != 4 or any(type(c) is not int or not 0 <= c <= 255 for c in p):
                            raise ValueError('Expected RGBA8 integer samples')
                        offset = (dy * TILE + dx) * 4
                        tile[offset:offset + 4] = bytes(p)
                keys.append(store.put(bytes(tile)))
        return cls(width, height, keys, store)

    def region_bytes(self, rectangle=None):
        x0, y0, x1, y1 = rectangle if rectangle is not None else (0, 0, self.width, self.height)
        if any(type(n) is not int for n in (x0, y0, x1, y1)) or not (0 <= x0 < x1 <= self.width and 0 <= y0 < y1 <= self.height):
            raise ValueError('Region must lie within raster')
        stride = (x1 - x0) * 4
        result = bytearray(stride * (y1 - y0))
        columns = (self.width + TILE - 1) // TILE
        for ty in range(y0 // TILE, (y1 - 1) // TILE + 1):
            for tx in range(x0 // TILE, (x1 - 1) // TILE + 1):
                data = self._store.get(self.keys[ty * columns + tx])
                left, right = max(x0, tx * TILE), min(x1, (tx + 1) * TILE)
                size = (right - left) * 4
                for y in range(max(y0, ty * TILE), min(y1, (ty + 1) * TILE)):
                    source = ((y % TILE) * TILE + left % TILE) * 4
                    destination = (y - y0) * stride + (left - x0) * 4
                    result[destination:destination + size] = data[source:source + size]
        return bytes(result)

    def with_edits(self, edits):
        changed = {}
        columns = (self.width + TILE - 1) // TILE
        for index, color in edits.items():
            if type(index) is not int or not 0 <= index < len(self) or len(color) != 4 or any(type(c) is not int or not 0 <= c <= 255 for c in color):
                raise ValueError('Invalid packed raster edit')
            y, x = divmod(index, self.width)
            key = (y // TILE) * columns + x // TILE
            if key not in changed:
                changed[key] = bytearray(self._store.get(self.keys[key]))
            offset = ((y % TILE) * TILE + x % TILE) * 4
            changed[key][offset:offset + 4] = bytes(color)
        # Append-only shared pool: previous keys/bytes stay immutable, avoiding a
        # parent chain per stroke and copying whole grids into every undo state.
        store = OverlayTiles(self._store)
        keys = list(self.keys)
        for index, data in changed.items():
            keys[index] = store.put(bytes(data))
        return PixelPlane(self.width, self.height, keys, store)

    def detached(self):
        store = MemoryTiles()
        for key in set(self.keys):
            assert store.put(self._store.get(key)) == key
        return PixelPlane(self.width, self.height, self.keys, store)

    def materialize(self, max_pixels=256 * 256):
        if len(self) > max_pixels:
            raise ValueError('Legacy pixel expansion refused; packed editing/rendering migration required')
        raw = self.region_bytes()
        return [list(raw[i:i + 4]) for i in range(0, len(raw), 4)]


def _json(data):
    return json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf-8')


def save_archive(path, project):
    """Atomic archive save, preserving input object/old file on any failure."""
    width, height = dimensions(project['canvas']['width'], project['canvas']['height'])
    path = Path(path)
    temporary = path.with_name('.' + path.name + '.' + uuid.uuid4().hex + '.tmp')
    assets, total = set(), 0
    tile_indices = {}
    try:
        with temporary.open('xb') as stream, zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            archive.writestr('mimetype', MIME, compress_type=zipfile.ZIP_STORED)
            def asset(name, data):
                nonlocal total
                if name not in assets:
                    total += len(data)
                    if total > MAX_EXPANDED or len(assets) + 3 > MAX_MEMBERS:
                        raise ValueError('Packed asset budget exceeded')
                    archive.writestr(name, data)
                    assets.add(name)
            def encode(value, key=None, depth=0):
                if depth > 64:
                    raise ValueError('Project metadata too deeply nested')
                if isinstance(value,SourceBlob):
                    asset('blobs/'+value.sha256+'.bin',value.data)
                    return {TAG:'source-bytes-1','sha256':value.sha256,'size':len(value.data)}
                if isinstance(value, PixelPlane) or key == 'pixels' and isinstance(value, list):
                    plane = value if isinstance(value, PixelPlane) else PixelPlane.from_pixels(width, height, value)
                    if (plane.width, plane.height) != (width, height):
                        raise ValueError('Raster must match project canvas')
                    for identity in dict.fromkeys(plane.keys):
                        data = plane._store.get(identity)
                        if len(data) != TILE_BYTES or digest(data) != identity:
                            raise ValueError('Tile identity changed')
                        asset('tiles/' + identity + '.rgba', data)
                    indices = []
                    for identity in plane.keys:
                        if identity not in tile_indices: tile_indices[identity] = len(tile_indices)
                        indices.append(tile_indices[identity])
                    return {TAG: 'rgba8-tile-indices-1', 'width': width, 'height': height, 'tiles': indices}
                if key in {'archive_base64', 'encoded_base64'} and isinstance(value, str):
                    data = base64.b64decode(value, validate=True)
                    if len(data) > MAX_BLOB:
                        raise ValueError('Retained source exceeds packed blob budget')
                    identity = digest(data)
                    asset('blobs/' + identity + '.bin', data)
                    return {TAG: 'base64-blob-1', 'sha256': identity, 'size': len(data)}
                if isinstance(value, dict):
                    if TAG in value or any(type(k) is not str for k in value):
                        raise ValueError('Reserved archive metadata key or non-string key')
                    return {k: encode(v, k, depth + 1) for k, v in value.items()}
                if isinstance(value, (list, tuple)):
                    return [encode(v, None, depth + 1) for v in value]
                if value is not None and type(value) not in {str, int, float, bool}:
                    raise ValueError('Unsupported project metadata type')
                return value
            document = encode(project)
            manifest = _json(dict(format='artist-assistant-packed-2', tile_size=TILE, tile_keys=list(tile_indices), document=document))
            if len(manifest) > MAX_METADATA:
                raise ValueError('Packed metadata exceeds8MiB')
            archive.writestr('project.json', manifest)
            archive.writestr('project.sha256', digest(manifest).encode('ascii'))
        if temporary.stat().st_size > MAX_ARCHIVE:
            raise ValueError('Packed file exceeds512MiB')
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    return dict(file_bytes=path.stat().st_size, metadata_bytes=len(manifest), unique_assets=len(assets), asset_bytes=total, manifest_sha256=digest(manifest))


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate metadata key')
        result[key] = value
    return result


class PackedArchive:
    def __init__(self, path, cache_bytes=1024 * 1024):
        if type(cache_bytes) is not int or not TILE_BYTES <= cache_bytes <= 16 * 1024 * 1024:
            raise ValueError('Expected16KiB..16MiB tile cache')
        path = Path(path)
        if path.stat().st_size > MAX_ARCHIVE:
            raise ValueError('Packed file exceeds512MiB')
        # Bound the central directory BEFORE ZipFile allocates its member list.
        # This format never needs ZIP64/multidisk under its own explicit limits.
        with path.open('rb') as stream:
            size = stream.seek(0, 2)
            stream.seek(max(0, size - 65557))
            tail = stream.read(65557)
        end = tail.rfind(b'PK\x05\x06')
        if end < 0 or end + 22 > len(tail):
            raise ValueError('Missing packed ZIP end record')
        disk, directory_disk, local_count, count, directory_size, directory_offset, comment = struct.unpack_from('<4H2IH', tail, end + 4)
        if disk or directory_disk or count != local_count or count > MAX_MEMBERS or directory_size > 16 * 1024 * 1024 or end + 22 + comment != len(tail) or directory_offset + directory_size != size - 22 - comment:
            raise ValueError('Packed ZIP directory budget/layout exceeded; ZIP64/multidisk unsupported')
        self.archive = zipfile.ZipFile(path, 'r')
        self.cache, self.cache_bytes, self.bytes_cached = OrderedDict(), cache_bytes, 0
        self.asset_reads, self.verified = 0, set()
        self.closed = False
        try:
            infos = self.archive.infolist()
            if len(infos) > MAX_MEMBERS or len({i.filename for i in infos}) != len(infos) or sum(i.file_size for i in infos) > MAX_EXPANDED + MAX_METADATA + 256:
                raise ValueError('Archive member count/size/uniqueness budget exceeded')
            self.infos = {i.filename: i for i in infos}
            for name, info in self.infos.items():
                tile = re.fullmatch(r'tiles/([a-f0-9]{64})\.rgba', name)
                blob = re.fullmatch(r'blobs/([a-f0-9]{64})\.bin', name)
                limit = TILE_BYTES if tile else MAX_BLOB if blob else MAX_METADATA if name == 'project.json' else 128
                if not tile and not blob and name not in {'mimetype', 'project.json', 'project.sha256'}:
                    raise ValueError('Unexpected or unsafe archive member')
                if info.flag_bits & 1 or info.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED} or info.file_size > limit or tile and info.file_size != TILE_BYTES:
                    raise ValueError('Unsupported member encoding/size')
                if stat.S_IFMT(info.external_attr >> 16) not in {0, stat.S_IFREG}:
                    raise ValueError('Archive links/special entries unsupported')
            if self._read('mimetype', 128) != MIME:
                raise ValueError('Wrong packed project MIME')
            manifest = self._read('project.json', MAX_METADATA)
            if self._read('project.sha256', 64) != digest(manifest).encode('ascii'):
                raise ValueError('Packed metadata digest changed')
            parsed = json.loads(manifest, object_pairs_hook=_pairs, parse_constant=lambda v: (_ for _ in ()).throw(ValueError('Non-finite metadata')))
            indexed = parsed.get('format') == 'artist-assistant-packed-2'
            fields = {'format', 'tile_size', 'document'} | ({'tile_keys'} if indexed else set())
            if set(parsed) != fields or parsed['format'] not in {'artist-assistant-packed-1','artist-assistant-packed-2'} or type(parsed['tile_size']) is not int or parsed['tile_size'] != TILE:
                raise ValueError('Unknown packed project format')
            tile_keys = parsed.get('tile_keys', [])
            if not isinstance(tile_keys, list) or any(type(k) is not str or not HEX.fullmatch(k) for k in tile_keys) or len(set(tile_keys)) != len(tile_keys):
                raise ValueError('Invalid shared tile identity table')
            used_indices = set()
            source_cache={}
            expected = {'mimetype', 'project.json', 'project.sha256'}
            def decode(value, depth=0):
                if depth > 64:
                    raise ValueError('Project metadata too deeply nested')
                if isinstance(value, dict):
                    if TAG in value:
                        if indexed and value[TAG] == 'rgba8-tile-indices-1' and set(value) == {TAG, 'width', 'height', 'tiles'}:
                            if not isinstance(value['tiles'], list) or any(type(i) is not int or not 0 <= i < len(tile_keys) for i in value['tiles']):
                                raise ValueError('Invalid shared tile index')
                            used_indices.update(value['tiles'])
                            value = {TAG:'rgba8-tiles-1', 'width':value['width'], 'height':value['height'], 'keys':[tile_keys[i] for i in value['tiles']]}
                        if value[TAG] == 'rgba8-tiles-1' and set(value) == {TAG, 'width', 'height', 'keys'}:
                            plane = PixelPlane(value['width'], value['height'], value['keys'], self)
                            for key in plane.keys:
                                name = 'tiles/' + key + '.rgba'
                                if name not in self.infos:
                                    raise ValueError('Missing tile')
                                expected.add(name)
                            return plane
                        if value[TAG] in {'base64-blob-1','source-bytes-1'} and set(value) == {TAG, 'sha256', 'size'} and type(value['sha256']) is str and HEX.fullmatch(value['sha256']) and type(value['size']) is int and 0 <= value['size'] <= MAX_BLOB:
                            name = 'blobs/' + value['sha256'] + '.bin'
                            cache_key=(value[TAG],value['sha256'])
                            if cache_key in source_cache:
                                expected.add(name)
                                cached,size=source_cache[cache_key]
                                if size!=value['size']:raise ValueError('Repeated source size changed')
                                return cached
                            data = self._read(name, MAX_BLOB)
                            if len(data) != value['size'] or digest(data) != value['sha256']:
                                raise ValueError('Retained source digest changed')
                            expected.add(name)
                            cached=SourceBlob(data) if value[TAG]=='source-bytes-1' else base64.b64encode(data).decode('ascii')
                            source_cache[cache_key]=(cached,len(data))
                            return cached
                        raise ValueError('Invalid packed reference')
                    return {k: decode(v, depth + 1) for k, v in value.items()}
                if isinstance(value, list):
                    return [decode(v, depth + 1) for v in value]
                return value
            self.project = decode(parsed['document'])
            if indexed and used_indices != set(range(len(tile_keys))):
                raise ValueError('Unreferenced tile identity')
            width, height = dimensions(self.project['canvas']['width'], self.project['canvas']['height'])
            def bounds(value):
                if isinstance(value, PixelPlane):
                    if (value.width, value.height) != (width, height):
                        raise ValueError('Packed raster/document bounds mismatch')
                elif isinstance(value, dict):
                    for item in value.values(): bounds(item)
                elif isinstance(value, list):
                    for item in value: bounds(item)
            bounds(self.project)
            if expected != set(self.infos):
                raise ValueError('Unreferenced archive payload')
        except BaseException:
            self.close()
            raise

    def _read(self, name, maximum):
        if self.closed:
            raise ValueError('Packed archive is closed')
        if name not in self.infos or self.infos[name].file_size > maximum:
            raise ValueError('Missing or oversized archive member')
        with self.archive.open(name) as stream:
            data = stream.read(maximum + 1)
        if len(data) > maximum or len(data) != self.infos[name].file_size:
            raise ValueError('Archive member size mismatch')
        return data

    def get(self, identity):
        if self.closed:
            raise ValueError('Packed archive is closed')
        if identity in self.cache:
            self.cache.move_to_end(identity)
            return self.cache[identity]
        data = self._read('tiles/' + identity + '.rgba', TILE_BYTES)
        if digest(data) != identity:
            raise ValueError('Packed tile digest changed')
        self.asset_reads += 1
        self.verified.add(identity)
        while self.bytes_cached + len(data) > self.cache_bytes:
            _, old = self.cache.popitem(last=False)
            self.bytes_cached -= len(old)
        self.cache[identity] = data
        self.bytes_cached += len(data)
        return data

    def verify_all(self):
        for name in self.infos:
            if name.startswith('tiles/'):
                self.get(name[6:-5])
        return len(self.verified)

    def materialize_legacy(self):
        width, height = self.project['canvas']['width'], self.project['canvas']['height']
        if max(width, height) > 256 or len(self.project.get('drawings', {})) > 64:
            raise ValueError('Large packed project retained; host memory/render migration is unfinished')
        count = 0
        def budget(value):
            nonlocal count
            if isinstance(value, PixelPlane): count += len(value)
            elif isinstance(value, dict):
                for item in value.values(): budget(item)
            elif isinstance(value, list):
                for item in value: budget(item)
        budget(self.project)
        if count > 1_000_000:
            raise ValueError('Legacy materialization exceeds one million sample objects; packed editing migration required')
        def convert(value):
            if isinstance(value, PixelPlane): return value.materialize()
            if isinstance(value, dict): return {k: convert(v) for k, v in value.items()}
            if isinstance(value, list): return [convert(v) for v in value]
            return value
        result = convert(self.project)
        if len(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False).encode('utf-8')) > 32 * 1024 * 1024:
            raise ValueError('Legacy project expansion exceeds32MiB; source archive preserved')
        return result

    def close(self):
        self.closed = True
        self.cache.clear()
        self.bytes_cached = 0
        self.archive.close()

    def __enter__(self): return self

    def __exit__(self, *args): self.close()
