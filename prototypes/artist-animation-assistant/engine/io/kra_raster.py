"""Source-informed independent restricted KRA reader. No upstream code copied.

REF-KRA-TILES / REF-KRA-LZF / REF-KRA-BGRA / REF-KRITA-ANIMATION-SOURCE.
Version2 BGRA8 tiles only; source archive retained. Not general native support.
"""
import base64
from copy import deepcopy
import hashlib
import io
from pathlib import Path, PurePosixPath
import re
import xml.etree.ElementTree as ET
import zipfile

from engine.project import fingerprint, validate

PROFILE = '5991c8d8fcb628dad5d052d9341df8a32bd3c7a794c913a8ede8eae4b34b4545'


def unlzf(encoded, expected=16384):
    """Interpret literal/back-reference tokens with fixed output and input bounds."""
    output, cursor = bytearray(), 0
    while cursor < len(encoded):
        token = encoded[cursor]
        cursor += 1
        if token < 32:
            count = token + 1
            if cursor + count > len(encoded) or len(output) + count > expected:
                raise ValueError('LZF literal exceeds input/output bounds')
            output.extend(encoded[cursor:cursor + count])
            cursor += count
        else:
            count = token >> 5
            if count == 7:
                if cursor >= len(encoded):
                    raise ValueError('Truncated LZF extended length')
                count += encoded[cursor]
                cursor += 1
            count += 2
            if cursor >= len(encoded):
                raise ValueError('Truncated LZF distance')
            distance = ((token & 31) << 8) + encoded[cursor] + 1
            cursor += 1
            if distance > len(output) or len(output) + count > expected:
                raise ValueError('LZF back-reference exceeds output bounds')
            for _ in range(count):
                output.append(output[-distance])
    if len(output) != expected:
        raise ValueError('LZF output size mismatch')
    return output


def decode_tiles(data, width, height, offset=(0, 0)):
    if any(type(n) is not int or not 1 <= n <= 256 for n in (width, height)):
        raise ValueError('Unsupported native raster bounds')
    if len(data) > 2 * 1024 * 1024:
        raise ValueError('Raster payload exceeds bound')
    stream = io.BytesIO(data)
    expected = [b'VERSION 2\n', b'TILEWIDTH 64\n', b'TILEHEIGHT 64\n', b'PIXELSIZE 4\n']
    if [stream.readline(80) for _ in range(4)] != expected:
        raise ValueError('Unsupported native tile version/dimensions/pixel depth')
    match = re.fullmatch(rb'DATA (\d+)\n', stream.readline(80))
    if not match or not 0 <= int(match[1]) <= 64:
        raise ValueError('Invalid native tile count')
    pixels, seen = [[0, 0, 0, 0] for _ in range(width * height)], set()
    for _ in range(int(match[1])):
        header = re.fullmatch(rb'(-?\d+),(-?\d+),LZF,(\d+)\n', stream.readline(80))
        if header is None:
            raise ValueError('Invalid native tile record')
        x, y, size = map(int, header.groups())
        if x % 64 or y % 64 or (x, y) in seen or not 1 <= size <= 16385:
            raise ValueError('Invalid or duplicate tile coordinates/size')
        seen.add((x, y))
        payload = stream.read(size)
        if len(payload) != size:
            raise ValueError('Truncated native tile')
        if payload[0] == 1:
            planes = unlzf(payload[1:])
            bgra = bytearray(16384)
            for channel in range(4):
                bgra[channel::4] = planes[channel * 4096:(channel + 1) * 4096]
        elif payload[0] == 0 and size == 16385:
            bgra = payload[1:]
        else:
            raise ValueError('Unsupported native tile compression flag/size')
        for index in range(4096):
            px, py = x + index % 64 + offset[0], y + index // 64 + offset[1]
            b, g, r, a = bgra[index * 4:index * 4 + 4]
            if 0 <= px < width and 0 <= py < height:
                pixels[py * width + px] = [r, g, b, a]
            elif a:
                raise ValueError('Nontransparent off-canvas native content requires broader bounds support')
    if stream.read():
        raise ValueError('Trailing native tile data')
    return pixels


def _tag(node):
    return node.tag.rsplit('}', 1)[-1]


def import_kra(path):
    path = Path(path)
    if path.stat().st_size > 4 * 1024 * 1024:
        raise ValueError('Initial KRA importer requires files <=4MiB')
    with path.open('rb') as stream:
        data = stream.read(4 * 1024 * 1024 + 1)
    if len(data) > 4 * 1024 * 1024:
        raise ValueError('Initial KRA importer requires files <=4MiB')
    digest = hashlib.sha256(data).hexdigest()
    project = {'schema_version': '0.1', 'project_id': path.stem, 'revision': 0,
               'layers': {}, 'drawings': {}, 'exposures': [], 'proposals': {}, 'history': []}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or len(names) > 512 or sum(i.file_size for i in archive.infolist()) > 64 * 1024 * 1024:
            raise ValueError('Duplicate/excessive native archive members')
        for name in names:
            if '\\' in name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts:
                raise ValueError('Unsupported native archive member path')
        def bounded(name, limit=2 * 1024 * 1024):
            if archive.getinfo(name).file_size > limit:
                raise ValueError('Native member exceeds its size bound')
            return archive.read(name)
        def xml(name):
            content = bounded(name)
            if b'<!ENTITY' in content.upper():
                raise ValueError('Native XML entity declarations unsupported')
            return ET.fromstring(content)
        if bounded('mimetype') != b'application/x-krita':
            raise ValueError('Expected native Krita archive mimetype')
        document = xml('maindoc.xml')
        image = next((n for n in document if _tag(n) == 'IMAGE'), None)
        if image is None:
            raise ValueError('Native image metadata missing')
        width, height = int(image.get('width', '0')), int(image.get('height', '0'))
        if not 1 <= width <= 256 or not 1 <= height <= 256 or image.get('colorspacename') != 'RGBA':
            raise ValueError('Initial KRA importer supports RGBA8 canvas <=256px')
        location = image.get('name', '')
        if not location or '/' in location or '\\' in location or location in {'.', '..'}:
            raise ValueError('Unsupported native image path')
        prefix = location + '/layers/'
        if hashlib.sha256(bounded(location + '/annotations/icc')).hexdigest() != PROFILE:
            raise ValueError('Native color profile is not the tested sRGB profile; no conversion is implied')
        project['canvas'] = dict(width=width, height=height, color_profile='sRGB', alpha_mode='straight')
        resolution={key:float(image.get(attribute,'72')) for key,attribute in [('x','x-res'),('y','y-res')]}
        if any(not 0<value<=100000 for value in resolution.values()):
            raise ValueError('Unsupported native document resolution')
        project['canvas']['resolution']=resolution
        animation = next((n for n in image if _tag(n) == 'animation'), None)
        fields = {} if animation is None else {_tag(n): n for n in animation}
        rate = float(fields['framerate'].get('value')) if 'framerate' in fields else 24.0
        start = int(fields['range'].get('from')) if 'range' in fields else 0
        end = int(fields['range'].get('to')) if 'range' in fields else start
        if not rate.is_integer() or not 1 <= rate <= 120 or start < 0 or not 1 <= end - start + 1 <= 600:
            raise ValueError('Unsupported native clip timing')
        project['shot'] = {'id': 'native-shot', 'fps': {'numerator': int(rate), 'denominator': 1}, 'duration_frames': end - start + 1}
        native_frames = []
        def walk(container, parent=None, depth=0):
            if depth > 12:
                raise ValueError('Native layer hierarchy too deep')
            for order, node in enumerate(container):
                if _tag(node) != 'layer' or len(project['layers']) >= 32:
                    raise ValueError('Unsupported or excessive native layer structure')
                kind = node.get('nodetype')
                allowed = {'name','y','filename','channelflags','x','uuid','colorspacename','onionskin','locked','colorlabel','visible','channellockflags','opacity','collapsed','compositeop','nodetype','intimeline','selected','profile','passthrough','keyframes','layerstyle','selection','channel','inheritalpha'}
                if set(node.attrib) - allowed or node.get('colorspacename', 'RGBA') != 'RGBA':
                    raise ValueError('Unsupported native layer attributes/color space')
                if kind not in {'paintlayer', 'grouplayer'} or node.get('compositeop', 'normal') != 'normal' or node.get('passthrough', '0') != '0':
                    raise ValueError('Masks/non-raster layers/blends/pass-through groups are not yet supported')
                unsupported = ['channelflags', 'channellockflags', 'layerstyle', 'selection', 'channel', 'inheritalpha']
                if any(node.get(key) not in {None, '', '0'} for key in unsupported):
                    raise ValueError('Unsupported native channel/style/inherit-alpha feature')
                if any(_tag(child) != 'layers' for child in node):
                    raise ValueError('Unsupported native layer child metadata')
                identity = node.get('uuid') or node.get('filename')
                if not identity or identity in project['layers']:
                    raise ValueError('Missing or duplicate native layer identity')
                opacity = int(node.get('opacity', '255'))
                if not 0 <= opacity <= 255 or node.get('visible', '1') not in {'0', '1'} or node.get('locked', '0') not in {'0', '1'}:
                    raise ValueError('Invalid native layer flags/opacity')
                project['layers'][identity] = dict(name=node.get('name', identity), nodetype=kind, parent_id=parent, order=order, visible=node.get('visible', '1') == '1', locked=node.get('locked', '0') == '1', opacity=opacity, native_attributes=dict(node.attrib))
                if kind == 'grouplayer':
                    if int(node.get('x', '0')) or int(node.get('y', '0')):
                        raise ValueError('Translated native groups are not yet supported')
                    for child in node:
                        walk(child, identity, depth + 1)
                    continue
                filename = node.get('filename', '')
                def safe(value):
                    if not value or '/' in value or '\\' in value or value in {'.', '..'}:
                        raise ValueError('Unsupported native frame filename')
                    return value
                safe(filename)
                if hashlib.sha256(bounded(prefix + filename + '.icc')).hexdigest() != PROFILE:
                    raise ValueError('Layer profile differs from tested sRGB profile')
                if 'keyframes' in node.attrib:
                    key_root = xml(prefix + safe(node.get('keyframes')))
                    channels = [n for n in key_root if _tag(n) == 'channel']
                    if len(channels) != 1 or channels[0].get('name') != 'content':
                        raise ValueError('Only native raster-content animation is supported')
                    keys = []
                    for key in channels[0]:
                        if _tag(key) != 'keyframe':
                            raise ValueError('Unsupported native keyframe metadata')
                        offset = next((n for n in key if _tag(n) == 'offset'), None)
                        position = (int(offset.get('x', '0')), int(offset.get('y', '0'))) if offset is not None else (0, 0)
                        keys.append((int(key.get('time')), safe(key.get('frame')), position))
                    keys.sort()
                    if not keys or len(keys) > 64 or len({k[0] for k in keys}) != len(keys) or keys[0][0] < 0:
                        raise ValueError('Invalid native raster key schedule')
                else:
                    keys = [(0, filename, (int(node.get('x', '0')), int(node.get('y', '0'))))]
                # Decode every supplied key, including outside clip, so none is discarded.
                records = []
                cache = {}
                for time, frame, position in keys:
                    record_key = (frame, position)
                    if record_key not in cache:
                        if len(project['drawings']) >= 64:
                            raise ValueError('Native drawing limit exceeded')
                        member = prefix + frame
                        default = member + '.defaultpixel'
                        if default not in names or bounded(default) != b'\0\0\0\0':
                            raise ValueError('Nonzero native default pixel unsupported')
                        pixels = decode_tiles(bounded(member), width, height, position)
                        drawing_id = identity + ':' + str(len(cache))
                        project['drawings'][drawing_id] = {'pixels': pixels, 'origin': 'artist', 'approved': True, 'locked': True}
                        cache[record_key] = drawing_id
                        native_frames.append(dict(layer_id=identity, drawing_id=drawing_id, member=member, sha256=hashlib.sha256(bounded(member)).hexdigest(), native_time=time, offset=list(position)))
                    records.append((time, cache[record_key]))
                relevant = [(max(start, t), d) for i, (t, d) in enumerate(records) if t <= end and (i + 1 == len(records) or records[i + 1][0] > start)]
                if not relevant or relevant[0][0] > start:
                    blank = identity + ':blank'
                    project['drawings'][blank] = {'pixels': [[0, 0, 0, 0] for _ in range(width * height)], 'origin': 'native_blank', 'approved': True, 'locked': True}
                    relevant.insert(0, (start, blank))
                for i, (time, drawing_id) in enumerate(relevant):
                    following = relevant[i + 1][0] if i + 1 < len(relevant) else end + 1
                    project['exposures'].append(dict(layer_id=identity, drawing_id=drawing_id, start=time - start, length=following - time))
        layer_root = next((n for n in image if _tag(n) == 'layers'), None)
        if layer_root is None:
            raise ValueError('Native layer tree missing')
        walk(layer_root)
        if not project['drawings'] or len(project['drawings']) > 64:
            raise ValueError('No supported native raster drawings or drawing bound exceeded')
    project['originals'] = deepcopy(project['drawings'])
    project['originals_sha256'] = fingerprint(project['originals'])
    project['native_source'] = dict(filename=path.name, sha256=digest, archive_base64=base64.b64encode(data).decode('ascii'), native_clip_start=start, image_attributes=dict(image.attrib), frame_records=native_frames, source_ids=['REF-KRA-TILES', 'REF-KRA-LZF', 'REF-KRA-BGRA', 'REF-KRITA-ANIMATION-SOURCE'])
    return validate(project)
