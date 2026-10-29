"""Read-only, narrow native metadata audit, not a general KRA importer.

REF-KRITA-ANIMATION-SOURCE describes the exact inspected native fields. Does
not decode native raster tiles or claim alpha/pixel fidelity from metadata.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import xml.etree.ElementTree as ET
import zipfile


def _tag(node):
    return node.tag.rsplit('}', 1)[-1]


def audit_native(path, expected):
    path = Path(path)
    if path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Native diagnostic file exceeds 64 MiB bound')
    with zipfile.ZipFile(path) as archive:
        if sum(info.file_size for info in archive.infolist()) > 64 * 1024 * 1024:
            raise ValueError('Native diagnostic archive exceeds uncompressed size bound')
        if len(archive.namelist()) != len(set(archive.namelist())):
            raise ValueError('Duplicate native archive members')
        def xml(name):
            info = archive.getinfo(name)
            if info.file_size > 2 * 1024 * 1024:
                raise ValueError('Native XML exceeds diagnostic bound')
            content = archive.read(name)
            if b'<!ENTITY' in content.upper():
                raise ValueError('Entity declarations unsupported by diagnostic audit')
            return ET.fromstring(content)
        root = xml('maindoc.xml')
        image = next((n for n in root.iter() if _tag(n) == 'IMAGE'), None)
        if image is None:
            raise ValueError('Native image metadata missing')
        layers = [n for n in image.iter() if _tag(n) == 'layer' and n.get('name') == expected['native_layer_name']]
        if len(layers) != 1:
            raise ValueError('Expected exactly one named native probe layer')
        layer = layers[0]
        reference = layer.get('keyframes')
        if not reference or '/' in reference or '\\' in reference or reference in {'.', '..'}:
            raise ValueError('Animated layer keyframe reference missing or unsupported')
        matches = [name for name in archive.namelist() if name.endswith('/layers/' + reference)]
        if len(matches) != 1:
            raise ValueError('Native keyframe XML cannot be resolved uniquely')
        keyframes_path = matches[0]
        channels = [n for n in xml(keyframes_path).iter() if _tag(n) == 'channel' and n.get('name') == 'content']
        if len(channels) != 1:
            raise ValueError('Expected one native raster content channel')
        keyframes = [n for n in channels[0] if _tag(n) == 'keyframe']
        if not 1 <= len(keyframes) <= 600:
            raise ValueError('Native diagnostic key count outside supported bound')
        times = [int(n.get('time')) for n in keyframes]
        payloads, payload_hashes = [], {}
        for key in keyframes:
            frame = key.get('frame', '')
            if not frame or PurePosixPath(frame).name != frame or '\\' in frame:
                raise ValueError('Unsupported native frame payload path')
            name = str(PurePosixPath(keyframes_path).parent / frame)
            info = archive.getinfo(name)
            if info.file_size > 16 * 1024 * 1024:
                raise ValueError('Native tile payload exceeds diagnostic bound')
            if name not in payload_hashes:
                payload_hashes[name] = hashlib.sha256(archive.read(name)).hexdigest()
            payloads.append({'slot': int(key.get('time')), 'member': name, 'sha256': payload_hashes[name], 'offset_metadata': [dict(n.attrib) for n in key if _tag(n) == 'offset']})
        animation = next((n for n in image if _tag(n) == 'animation'), None)
        if animation is None:
            raise ValueError('Native animation metadata missing')
        values = {_tag(n): n for n in animation}
        reported_fps = float(values['framerate'].get('value'))
        start, end = int(values['range'].get('from')), int(values['range'].get('to'))
        desired_fps = expected['fps']['numerator'] // expected['fps']['denominator']
        checks = {'dimensions': int(image.get('width')) == expected['canvas']['width'] and int(image.get('height')) == expected['canvas']['height'],
                  'integer_fps': reported_fps.is_integer() and reported_fps == desired_fps,
                  'clip_range': (start, end) == (0, expected['duration_frames'] - 1),
                  'exact_key_times': times == expected['expected_key_times'],
                  'native_payload_records_resolved': len(payloads) == len(expected['expected_key_times']),
                  'editable_visible_paint_layer': layer.get('nodetype') == 'paintlayer' and layer.get('locked', '0') == '0' and layer.get('visible', '1') == '1',
                  'rgba_srgb_declared': image.get('colorspacename') == 'RGBA' and 'srgb' in image.get('profile', '').lower()}
    return {'status': 'passed' if all(checks.values()) else 'failed', 'evidence_level': 'native saved metadata and payload identity; raster pixels and interactive edit behavior require separate verification',
            'checks': checks, 'native_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'native_layer_uuid': layer.get('uuid'), 'project_id': expected['project_id'], 'project_revision': expected['project_revision'],
            'key_times': times, 'native_unique_payload_members': len({p['member'] for p in payloads}), 'input_unique_image_files': len(expected['assets']),
            'payloads': payloads, 'source_ids': ['REF-PYTHON', 'REF-KRITA-ANIMATION-SOURCE'], 'component_ids': ['COMP-PYTHON-3-13-1'],
            'remaining': ['Pixel/alpha equality requires a native export/API comparison', 'Metadata audit does not establish native editing or subjective motion quality']}
