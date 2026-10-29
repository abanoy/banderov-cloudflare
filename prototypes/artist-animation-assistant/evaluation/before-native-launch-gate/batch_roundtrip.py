"""Narrow synthetic OpenRaster -> native KRA -> KRA -> OpenRaster probe.

Independent fixture codec against REF-PNG / REF-ORA-LAYOUT / REF-ORA-STACK.
REF-KRITA-CLI / REF-KRITA-MAIN define the installed native batch route.
This is not a general .kra parser or production PNG/OpenRaster importer.
"""
import argparse
import binascii
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui


def png(width, height, pixels):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', binascii.crc32(kind + payload) & 0xffffffff)
    rows = b''.join(b'\0' + bytes(c for p in pixels[y * width:(y + 1) * width] for c in p) for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'sRGB', b'\0') + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')


def decode_fixture_png(data):
    if len(data) > 2000000 or not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Expected a small native fixture PNG')
    offset, compressed, header = 8, b'', None
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack('>I', data[offset + 8 + length:offset + 12 + length])[0]
        if binascii.crc32(kind + payload) & 0xffffffff != crc:
            raise ValueError('PNG fixture CRC failed')
        if kind == b'IHDR':
            header = struct.unpack('>IIBBBBB', payload)
        if kind == b'IDAT':
            compressed += payload
        offset += 12 + length
        if kind == b'IEND':
            break
    width, height, depth, color, compression, filtering, interlace = header
    if not 1 <= width <= 256 or not 1 <= height <= 256 or (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
        raise ValueError('This diagnostic decoder accepts only small noninterlaced RGBA8')
    raw = zlib.decompress(compressed)
    stride = width * 4
    if len(raw) != height * (stride + 1):
        raise ValueError('Unexpected decoded length')
    previous, result = bytearray(stride), []
    for y in range(height):
        kind = raw[y * (stride + 1)]
        row = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        if kind > 4:
            raise ValueError('Unknown PNG filter')
        for i in range(stride):
            a, b, c = (row[i - 4] if i >= 4 else 0), previous[i], (previous[i - 4] if i >= 4 else 0)
            if kind == 1:
                prediction = a
            elif kind == 2:
                prediction = b
            elif kind == 3:
                prediction = (a + b) // 2
            elif kind == 4:
                p = a + b - c
                distances = (abs(p - a), abs(p - b), abs(p - c))
                prediction = (a, b, c)[distances.index(min(distances))]
            else:
                prediction = 0
            row[i] = (row[i] + prediction) & 255
        result.extend([list(row[i:i + 4]) for i in range(0, stride, 4)])
        previous = row
    return width, height, result


def write_ora(path, original, proposal):
    image = ET.Element('image', version='0.0.6', w='8', h='8', name='AAA native fixture', xres='72', yres='72')
    stack = ET.SubElement(image, 'stack')
    ET.SubElement(stack, 'layer', name='Integration proposal', src='data/proposal.png', x='0', y='0', opacity='1.0', visibility='visible', **{'composite-op': 'svg:src-over'})
    group = ET.SubElement(stack, 'stack', name='Originals', opacity='1.0', visibility='hidden', **{'composite-op': 'svg:src-over'})
    ET.SubElement(group, 'layer', name='Source ink', src='data/source.png', x='0', y='0', opacity='1.0', visibility='visible', **{'composite-op': 'svg:src-over'})
    with zipfile.ZipFile(path, 'x') as archive:
        archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
        archive.writestr('stack.xml', ET.tostring(image, encoding='utf-8', xml_declaration=True))
        archive.writestr('data/source.png', png(8, 8, original))
        archive.writestr('data/proposal.png', png(8, 8, proposal))
        archive.writestr('mergedimage.png', png(8, 8, proposal))
        archive.writestr('Thumbnails/thumbnail.png', png(8, 8, proposal))


def inspect_ora(path):
    result = {}
    with zipfile.ZipFile(path) as archive:
        image = ET.fromstring(archive.read('stack.xml'))
        def visit(element, parent):
            for child in element:
                if child.tag == 'layer':
                    w, h, pixels = decode_fixture_png(archive.read(child.attrib['src']))
                    canvas = [[0, 0, 0, 0] for _ in range(64)]
                    dx, dy = int(child.get('x', 0)), int(child.get('y', 0))
                    for y in range(h):
                        for x in range(w):
                            if 0 <= x + dx < 8 and 0 <= y + dy < 8:
                                canvas[(y + dy) * 8 + x + dx] = pixels[y * w + x]
                    result[child.get('name')] = {'pixels': canvas, 'parent': parent, 'offset': [dx, dy]}
                elif child.tag == 'stack':
                    visit(child, child.get('name', ''))
        visit(image.find('stack'), '')
    return result


def run(output):
    verify_ui(ROOT)
    credits = build(check=True)
    output.mkdir(parents=True, exist_ok=False)
    fixture = json.loads((ROOT / 'experiments/EXP-0003-worker-contract/outputs/accepted-project.json').read_text(encoding='utf-8'))
    source = fixture['drawings']['source']['pixels']
    proposal = fixture['drawings']['accepted-from-worker']['pixels']
    write_ora(output / 'input.ora', source, proposal)
    assert decode_fixture_png(png(8, 8, source)) == (8, 8, source)
    env = os.environ.copy()
    for key in ['APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'TEMP', 'TMP']:
        directory = output / 'isolated-runtime' / key.lower()
        directory.mkdir(parents=True, exist_ok=True)
        env[key] = str(directory)
    env['QT_QPA_PLATFORM'] = 'minimal'
    runner = Path('C:/Program Files/Krita (x64)/bin/krita.com')
    if hashlib.sha256(runner.read_bytes()).hexdigest() != '2756ba9300ec3c09679db02cc99fb0208c60601b39b63dd03bf70c9f9db6dc73':
        raise ValueError('Installed native launcher changed')
    report = {'status': 'running', 'evidence_level': 'native batch format conversion, not interactive editor', 'commands': [], 'checks': {}, 'credits_snapshot_sha256': credits['snapshot_sha256']}
    try:
        for index, (src, dst) in enumerate([('input.ora', 'native.kra'), ('native.kra', 'reopened.kra'), ('reopened.kra', 'reopened.ora')], 1):
            command = [str(runner), '--nosplash', '--export', '--export-filename', str(output / dst), str(output / src)]
            started = time.perf_counter()
            with (output / f'command-{index}.stdout.txt').open('wb') as stdout, (output / f'command-{index}.stderr.txt').open('wb') as stderr:
                process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=stdout, stderr=stderr, creationflags=subprocess.CREATE_NO_WINDOW)
                try:
                    code = process.wait(timeout=45)
                except subprocess.TimeoutExpired:
                    subprocess.run(['taskkill.exe', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
                    process.wait(timeout=10)
                    raise RuntimeError('Native batch conversion timed out')
            report['commands'].append({'command': command, 'exit_code': code, 'duration_seconds': time.perf_counter() - started, 'output_exists': (output / dst).is_file()})
            print('Batch conversion', index, 'exit', code, flush=True)
            if code or not (output / dst).is_file():
                raise RuntimeError('Native batch conversion failed at ' + src)
        reopened = inspect_ora(output / 'reopened.ora')
        report['checks'] = {'source_rgba_exact': reopened['Source ink']['pixels'] == source, 'proposal_rgba_exact': reopened['Integration proposal']['pixels'] == proposal, 'group_preserved': reopened['Source ink']['parent'] == 'Originals', 'two_separate_raster_layers': len(reopened) == 2}
        with zipfile.ZipFile(output / 'reopened.kra') as archive:
            report['native_archive_files'] = archive.namelist()
            (output / 'native-maindoc.xml').write_bytes(archive.read('maindoc.xml'))
        report['status'] = 'passed' if all(report['checks'].values()) else 'failed'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
    report['limitations'] = ['Still drawing only; no animation/exposure/annotation/locks claim', 'OpenRaster excludes unsupported native features', 'No interactive editing/undo/cancellation or artist-quality acceptance']
    (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    for name in ['CREDITS.md', 'credits.json', 'THIRD_PARTY_NOTICES.txt']:
        (output / name).write_bytes((ROOT / 'generated' / name).read_bytes())
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    raise SystemExit(run(parser.parse_args().output.resolve()))
