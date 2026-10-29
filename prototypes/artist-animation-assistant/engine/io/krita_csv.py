"""Independent limited adapter against REF-KRITA-CSV and REF-KRITA-CSV-CODE.

Diagnostic contract: one fully exposed RGBA8/sRGB layer, <=256px, <=600 slots,
integer fps. No groups/masks/native locks; full project metadata stays in sidecar.
PNG encoding is injected by the caller, not tied to GUI or model dependencies.
"""
import csv
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from engine.project import validate, fingerprint


def export_animation(project, destination, encode_png):
    validate(project)
    if len(project['layers']) != 1:
        raise ValueError('Diagnostic CSV adapter supports exactly one raster layer; no layers dropped')
    width, height = project['canvas']['width'], project['canvas']['height']
    count = project['shot']['duration_frames']
    if max(width, height) > 256 or count > 600:
        raise ValueError('Diagnostic CSV bounds: <=256 pixels and <=600 slots')
    fps = project['shot']['fps']
    if set(fps) != {'numerator', 'denominator'} or fps['numerator'] % fps['denominator'] or not 1 <= fps['numerator'] // fps['denominator'] <= 120:
        raise ValueError('Native CSV importer requires integer fps; no silent rounding')
    layer_id, layer = next(iter(project['layers'].items()))
    if set(layer) - {'name', 'visible'}:
        raise ValueError('Unsupported layer properties; CSV cannot preserve groups/masks/locks')
    if type(layer.get('visible', True)) is not bool:
        raise ValueError('Layer visibility must be boolean')
    for value in [project['project_id'], layer['name']]:
        if not isinstance(value, str) or not value or len(value.encode('utf-8')) > 180 or any(ord(c) < 32 for c in value):
            raise ValueError('CSV labels must be nonempty, <=180 UTF-8 bytes and contain no controls/newlines')
    slots = [None] * count
    for exposure in project['exposures']:
        if exposure['layer_id'] != layer_id:
            raise ValueError('Unexpected layer exposure')
        slots[exposure['start']:exposure['start'] + exposure['length']] = [exposure['drawing_id']] * exposure['length']
    if any(d is None for d in slots):
        raise ValueError('Diagnostic CSV requires explicit full exposure coverage; gaps are not silently filled')
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    frames = destination / 'timing.frames'
    frames.mkdir()
    assets = {}
    for index, drawing_id in enumerate(dict.fromkeys(slots)):
        drawing = project['drawings'][drawing_id]
        name = f'drawing-{index:02d}-{fingerprint(drawing["pixels"])[:12]}.png'
        encoded = encode_png(width, height, drawing['pixels'])
        (frames / name).write_bytes(encoded)
        assets[drawing_id] = {'file': name, 'sha256': hashlib.sha256(encoded).hexdigest(), 'pixel_sha256': fingerprint(drawing['pixels']), 'origin': drawing['origin'], 'approved': drawing['approved'], 'locked_in_project': drawing['locked']}
    with (destination / 'timing.csv').open('x', encoding='utf-8', newline='') as stream:
        stream.write('UTF-8, TVPaint, "CSV 1.0"\r\n')
        writer = csv.writer(stream, quoting=csv.QUOTE_ALL, lineterminator='\r\n')
        writer.writerow(['Project Name', 'Width', 'Height', 'Frame Count', 'Layer Count', 'Frame Rate', 'Pixel Aspect Ratio', 'Field Mode'])
        writer.writerow([project['project_id'], width, height, count, 1, fps['numerator'] // fps['denominator'], '1.000000', 'Progressive'])
        for key, value in [('#Layers', layer['name']), ('#Density', '1.000000'), ('#Blending', 'Color'), ('#Visible', int(layer.get('visible', True)))]:
            writer.writerow([key, value])
        for slot, drawing_id in enumerate(slots):
            writer.writerow([f'#{slot:05d}', assets[drawing_id]['file']])
    keys = [slot for slot in range(count) if slot == 0 or slots[slot] != slots[slot - 1]]
    manifest = {'schema_version': '0.1', 'adapter': 'krita-csv-diagnostic-0.1',
                'project_id': project['project_id'], 'project_revision': project['revision'], 'project_sha256': fingerprint(project),
                'canvas': deepcopy(project['canvas']), 'fps': deepcopy(fps), 'duration_frames': count,
                'layer_id': layer_id, 'native_layer_name': layer['name'], 'expected_key_times': keys,
                'exposure_lengths': [(keys[i + 1] if i + 1 < len(keys) else count) - start for i, start in enumerate(keys)],
                'assets': assets, 'slot_drawing_ids': slots,
                'source_ids': ['REF-PYTHON', 'REF-KRITA-CSV', 'REF-KRITA-CSV-CODE', 'REF-PNG'],
                'component_ids': ['COMP-PYTHON-3-13-1'],
                'fidelity': {'raster_pixels': 'Lossless PNG input; native conversion not yet measured', 'timing': 'Repeated filenames are holds in the inspected native importer', 'groups_masks': 'unsupported', 'native_locks_approvals_ids': 'Not carried by CSV; authoritative originals, locks and IDs retained in project.json', 'native_layer_selection': 'CSV has no selected-layer field; one visible layer used in this probe'},
                'capability_label': 'Research prototype — deterministic translation integration fixture, not character motion'}
    (destination / 'project.json').write_text(json.dumps(project, indent=2) + '\n', encoding='utf-8')
    (destination / 'interchange.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return manifest


def inspect_interchange(directory):
    """Check the produced wire format and all asset hashes without a native host."""
    directory = Path(directory)
    manifest = json.loads((directory / 'interchange.json').read_text(encoding='utf-8'))
    with (directory / 'timing.csv').open(encoding='utf-8', newline='') as stream:
        rows = list(csv.reader(stream))
    metadata = dict(zip(rows[1], rows[2]))
    frame_rows = [r for r in rows if r and r[0].startswith('#') and r[0][1:].isdigit()]
    if int(metadata['Frame Count']) != manifest['duration_frames'] or len(frame_rows) != manifest['duration_frames']:
        raise ValueError('CSV duration mismatch')
    if [r[0] for r in frame_rows] != [f'#{i:05d}' for i in range(len(frame_rows))]:
        raise ValueError('CSV row order/slot labels disagree')
    for index, row in enumerate(frame_rows):
        asset = manifest['assets'][manifest['slot_drawing_ids'][index]]
        if row[1] != asset['file'] or Path(asset['file']).name != asset['file']:
            raise ValueError('CSV references an unexpected asset')
        if hashlib.sha256((directory / 'timing.frames' / asset['file']).read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError('PNG asset identity changed')
    return {'status': 'passed', 'playback_slots': len(frame_rows), 'unique_image_files': len({r[1] for r in frame_rows}), 'expected_key_times': manifest['expected_key_times'], 'exposure_lengths': manifest['exposure_lengths'], 'native_execution': 'not established by this wire-format check'}
