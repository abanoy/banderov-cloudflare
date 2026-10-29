"""Headless explicit native window import to NEW editable .aaa; no UI launch."""
from pathlib import Path
import argparse,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui

def main():
    parser=argparse.ArgumentParser();parser.add_argument('source',nargs='?',type=Path);parser.add_argument('output',nargs='?',type=Path);parser.add_argument('--start',type=int);parser.add_argument('--end',type=int);parser.add_argument('--layer',action='append');parser.add_argument('--retain-unrendered-styles',action='store_true',help='Explicit RAW study: preserve native effects but do not render them; default refuses styles');parser.add_argument('--credits',action='store_true');args=parser.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if args.source is None or args.output is None or args.start is None or args.end is None:parser.error('Provide source, NEW output folder, --start and --end (exclusive); optional repeated --layer UUID')
    if args.output.exists():raise ValueError('Output folder already exists; preserve earlier work')
    verify_ui(ROOT);credits=build(check=True)
    from engine.io.kra_window import KraWindow
    from hosts.standalone.session import Session
    with KraWindow(args.source) as source:project=source.import_window(args.start,args.end,args.layer,style_policy='retain_unrendered' if args.retain_unrendered_styles else 'reject')
    args.output.mkdir(parents=True,exist_ok=False);session=Session(project);session.save(args.output/'window.aaa');assert Session.load(args.output/'window.aaa').project==session.project
    for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:(args.output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    metadata=project['native_window_source']
    if metadata.get('cached_projection'):(args.output/'cached-native-reference.png').write_bytes(metadata['cached_projection'].data)
    report=dict(status='imported-experimental-native-window',window=[args.start,args.end],layer_count=len(project['layers']),drawing_count=len(project['drawings']),exposures=len(project['exposures']),payload_bytes=metadata['payload_bytes_consumed'],decoded_tile_bytes=metadata['decoded_tile_bytes'],source_archive_sha256=metadata['archive_sha256'],credits_snapshot=credits['snapshot_sha256'],unrendered_native_style_layers=len(metadata['unrendered_style_layers']),cached_reference_native_time=metadata['cached_projection_native_time'],limits=project['import_note']);(args.output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))

if __name__=='__main__':main()
