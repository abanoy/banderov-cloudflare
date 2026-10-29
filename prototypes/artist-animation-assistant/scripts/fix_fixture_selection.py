"""Narrow diagnostic metadata repair, not a general KRA importer.

REF-KRITA-KRA-LOADER / REF-ORA-SELECTION. Change only layer selection in a
NEW copy of the known synthetic fixture. Preserve original and all image bytes.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile


def layers(xml):
    return [n for n in ET.fromstring(xml).iter() if n.tag.rsplit('}', 1)[-1] == 'layer']


def select_fixture_proposal(source, destination):
    source, destination = Path(source), Path(destination)
    if source.resolve() == destination.resolve() or destination.exists():
        raise ValueError('Use a NEW diagnostic copy; original files are never replaced')
    original_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    with zipfile.ZipFile(source) as archive:
        xml = archive.read('maindoc.xml')
        before_layers = layers(xml)
        target = [n for n in before_layers if n.get('name') == 'Integration proposal']
        if len(target) != 1 or target[0].get('nodetype') != 'paintlayer' or target[0].get('visible') != '1' or target[0].get('locked') != '0':
            raise ValueError('Known visible unlocked synthetic proposal layer not found')
        replacements = []
        def replace_tag(match):
            tag = re.sub(rb'\sselected="(?:true|false)"', b'', match.group())
            if b'name="Integration proposal"' in tag:
                if not tag.endswith(b'/>'):
                    raise ValueError('Unexpected fixture paint-layer XML')
                tag = tag[:-2] + b' selected="true"/>'
                replacements.append(True)
            return tag
        patched = re.sub(rb'<layer\b[^>]*>', replace_tag, xml)
        if len(replacements) != 1:
            raise ValueError('Expected one exact fixture selection edit')
        after_layers = layers(patched)
        for before, after in zip(before_layers, after_layers):
            assert {k: v for k, v in before.attrib.items() if k != 'selected'} == {k: v for k, v in after.attrib.items() if k != 'selected'}
        assert [n.get('name') for n in after_layers if n.get('selected') == 'true'] == ['Integration proposal']
        with zipfile.ZipFile(destination, 'x') as output:
            output.comment = archive.comment
            for info in archive.infolist():
                output.writestr(copy.copy(info), patched if info.filename == 'maindoc.xml' else archive.read(info.filename))
    with zipfile.ZipFile(source) as before, zipfile.ZipFile(destination) as after:
        assert before.namelist() == after.namelist()
        unchanged = []
        for name in before.namelist():
            if name != 'maindoc.xml':
                assert before.read(name) == after.read(name)
                unchanged.append(name)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == original_sha
    return {'source_sha256': original_sha, 'destination_sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
            'source_ids': ['REF-PYTHON', 'REF-ORA-SELECTION', 'REF-KRITA-KRA-LOADER'],
            'changed_archive_members': ['maindoc.xml'], 'unchanged_archive_members': unchanged,
            'selected_before': [n.get('name') for n in before_layers if n.get('selected') == 'true'],
            'selected_after': ['Integration proposal'], 'image_bytes_preserved': True,
            'native_reopen_and_direct_paint': 'pending user verification'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path, nargs='?')
    parser.add_argument('destination', type=Path, nargs='?')
    parser.add_argument('--credits', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.credits:
        print((root / 'generated/CREDITS.md').read_text(encoding='utf-8'))
    elif args.source and args.destination:
        import sys
        sys.path.insert(0, str(root))
        from scripts.credits import build
        from scripts.provenance_gate import verify_ui
        build(check=True)
        verify_ui(root)
        print(json.dumps(select_fixture_proposal(args.source, args.destination), indent=2))
    else:
        parser.error('source and destination, or --credits, required')
