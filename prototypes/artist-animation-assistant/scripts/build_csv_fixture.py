"""Phase 1 synthetic animation probe through Krita's documented CSV route."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine.project import create, propose_translation, accept, validate
from engine.io.krita_csv import export_animation, inspect_interchange
from scripts.batch_roundtrip import png
from scripts.credits import build
from scripts.provenance_gate import verify_ui


def run(output):
    verify_ui(ROOT)
    credits = build(check=True)
    started = time.perf_counter()
    pixels = [[0, 0, 0, 0] for _ in range(64 * 64)]
    for y in range(20, 36):
        for x in range(12, 28):
            pixels[y * 64 + x] = [30, 110, 210, 180]
    project = create(pixels, 64, 64, 12)
    project['project_id'] = 'AAA-timing-probe-001'
    project['layers']['ink']['name'] = 'Integration proposals'
    project = accept(propose_translation(project, 'translate', 'source', 16, 0), 'translate', 'translated')
    project['exposures'] = [{'layer_id': 'ink', 'drawing_id': 'source', 'start': 0, 'length': 4}, {'layer_id': 'ink', 'drawing_id': 'translated', 'start': 4, 'length': 8}]
    project['revision'] += 1
    validate(project)
    manifest = export_animation(project, output, png)
    manifest['credits_snapshot_sha256'] = credits['snapshot_sha256']
    manifest['source_code_sha256'] = {relative: hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() for relative in ['engine/io/krita_csv.py', 'scripts/build_csv_fixture.py', 'scripts/batch_roundtrip.py']}
    manifest['input_provenance'] = 'Original synthetic semitransparent blue square, authored here; second pose is exact integer translation, not character inference'
    (output / 'interchange.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    report = inspect_interchange(output)
    report.update(duration_seconds=time.perf_counter() - started, native_gui_roundtrip='pending user verification', source_ids=manifest['source_ids'], credits_snapshot_sha256=credits['snapshot_sha256'])
    (output / 'wire-format-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    for name in ['credits.json', 'CREDITS.md', 'THIRD_PARTY_NOTICES.txt']:
        (output / name).write_bytes((ROOT / 'generated' / name).read_bytes())
    (output / 'OPEN-IN-KRITA.txt').write_text('Open timing.csv with File > Open in Krita. Keep timing.frames beside it. Do not use Import Animation Frames.\nExpected: one editable layer, keys at slots 0 and 4, holds 4 and 8 slots, clip 0..11, 24 fps.\nSave a NEW animation-roundtrip.kra beside this CSV, close it, reopen it, and check both keys.\nThe source files and project.json preserve originals/approvals; CSV cannot carry native locks, groups or project IDs.\nThis is a geometric integration probe, not a character-animation feature.\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    parser.add_argument('--credits', action='store_true')
    args = parser.parse_args()
    if args.credits:
        print((ROOT / 'generated/CREDITS.md').read_text(encoding='utf-8'))
    elif args.output:
        run(args.output.resolve())
    else:
        parser.error('--output or --credits required')
