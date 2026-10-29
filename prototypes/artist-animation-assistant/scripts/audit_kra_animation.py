"""Read-only audit of a GUI-saved native timing probe; never launches Krita."""
import argparse
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine.io.kra_timing_audit import audit_native
from scripts.credits import build
from scripts.provenance_gate import verify_ui

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path)
    parser.add_argument('--expect', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--credits', action='store_true')
    args = parser.parse_args()
    if args.credits:
        print((ROOT / 'generated/CREDITS.md').read_text(encoding='utf-8'))
    elif args.input and args.expect and args.report:
        credits = build(check=True)
        verify_ui(ROOT)
        if args.report.exists() or args.report.resolve() in [args.input.resolve(), args.expect.resolve()]:
            parser.error('Use a new report path; inputs/reports never overwritten')
        try:
            result = audit_native(args.input, json.loads(args.expect.read_text(encoding='utf-8')))
        except (ValueError, KeyError, OSError, TypeError, ET.ParseError, zipfile.BadZipFile) as error:
            result = {'status': 'failed', 'error': str(error), 'evidence_level': 'native metadata audit only'}
        result['credits_snapshot_sha256'] = credits['snapshot_sha256']
        with args.report.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, indent=2)
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if result['status'] == 'passed' else 1)
    else:
        parser.error('--input, --expect and --report, or --credits, required')
