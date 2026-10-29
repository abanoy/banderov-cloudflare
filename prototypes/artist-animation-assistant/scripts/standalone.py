"""Start the local standalone desktop prototype; --credits works headlessly."""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--credits', action='store_true')
    parser.add_argument('--self-test', type=Path, help='NEW diagnostic output directory; tests own app controls, no OS UI automation')
    parser.add_argument('--kra-self-test', type=Path, help='NEW output directory; actual retained KRA import and own-control verification')
    parser.add_argument('--ora-self-test', type=Path, help='NEW output directory; layered interchange and original file preservation checks')
    parser.add_argument('--fill-self-test',type=Path,help='NEW output directory; source-preserving fill and own native boundary controls')
    parser.add_argument('--fill-revision-self-test',type=Path,help='NEW output directory; accepted-region revision and correction preservation')
    parser.add_argument('--palette-self-test',type=Path,help='NEW output directory; shared-ink regions and explicit palette edits')
    parser.add_argument('--cleanup-self-test',type=Path,help='NEW output directory; selected cleanup and detail/undo preservation')
    parser.add_argument('--storage-self-test',type=Path,help='NEW output directory; compact project save/open and source preservation')
    parser.add_argument('--live-packed-self-test',type=Path,help='NEW output directory; actual HD/4K live editing, hundred strokes, packed workers and source preservation')
    parser.add_argument('--spatial-self-test',type=Path,help='NEW output directory; dense continuous strokes and compact artist constraints')
    parser.add_argument('--roi-self-test',type=Path,help='NEW output directory; selected-area large fill/cleanup and correction preservation')
    parser.add_argument('--references-self-test',type=Path,help='NEW output directory; reference panel, identity correction and conditioning')
    parser.add_argument("--motion-self-test",type=Path,help="NEW output directory; editable pose correspondence controls and interval preservation")
    parser.add_argument("--correspondence-self-test",type=Path,help="NEW output directory; own image-match review controls and motion handoff")
    parser.add_argument("--parts-self-test",type=Path,help="NEW output directory; native ownership masks, part layers and protected revision")
    parser.add_argument("--parts-legacy-self-test",type=Path,help="NEW output directory; legacy part review capacity and source preservation")
    parser.add_argument('--schedules-self-test',type=Path,help='NEW output directory; event/budget schedule controls, clock playback and review persistence')
    parser.add_argument('--timing-self-test',type=Path,help='NEW output directory; paired actor hold preview and required event preservation')
    args = parser.parse_args()
    if args.credits:
        print((ROOT / 'generated/CREDITS.md').read_text(encoding='utf-8'))
    else:
        from scripts.credits import build
        build(check=True)
        if args.timing_self_test:
            from hosts.standalone.timing_smoke import run
            run(args.timing_self_test.resolve())
        elif args.schedules_self_test:
            from hosts.standalone.schedule_smoke import run
            run(args.schedules_self_test.resolve())
        elif args.parts_legacy_self_test:
            from hosts.standalone.parts_smoke import run
            run(args.parts_legacy_self_test.resolve(),packed=False)
        elif args.parts_self_test:
            from hosts.standalone.parts_smoke import run
            run(args.parts_self_test.resolve())
        elif args.correspondence_self_test:
            from hosts.standalone.correspondence_smoke import run
            run(args.correspondence_self_test.resolve())
        elif args.motion_self_test:
            from hosts.standalone.motion_smoke import run
            run(args.motion_self_test.resolve())
        elif args.references_self_test:
            from hosts.standalone.reference_smoke import run
            run(args.references_self_test.resolve())
        elif args.roi_self_test:
            from hosts.standalone.roi_smoke import run
            run(args.roi_self_test.resolve())
        elif args.spatial_self_test:
            from hosts.standalone.spatial_smoke import run
            run(args.spatial_self_test.resolve())
        elif args.live_packed_self_test:
            from hosts.standalone.live_packed_smoke import run
            run(args.live_packed_self_test.resolve())
        elif args.storage_self_test:
            from hosts.standalone.storage_smoke import run
            run(args.storage_self_test.resolve())
        elif args.cleanup_self_test:
            from hosts.standalone.cleanup_smoke import run
            run(args.cleanup_self_test.resolve())
        elif args.palette_self_test:
            from hosts.standalone.palette_smoke import run
            run(args.palette_self_test.resolve())
        elif args.fill_revision_self_test:
            from hosts.standalone.fill_revision_smoke import run
            run(args.fill_revision_self_test.resolve())
        elif args.fill_self_test:
            from hosts.standalone.fill_smoke import run
            run(args.fill_self_test.resolve())
        elif args.ora_self_test:
            from hosts.standalone.ora_smoke import run
            run(args.ora_self_test.resolve())
        elif args.kra_self_test:
            from hosts.standalone.kra_smoke import run
            run(args.kra_self_test.resolve())
        elif args.self_test:
            from hosts.standalone.smoke import run
            run(args.self_test.resolve())
        else:
            import tkinter as tk
            from hosts.standalone.native_app import NativeApp as App
            root = tk.Tk()
            App(root)
            root.mainloop()
