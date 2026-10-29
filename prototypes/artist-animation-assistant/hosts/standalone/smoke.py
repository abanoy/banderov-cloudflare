"""Real Tk widget/event-loop test of this application's own controls, not OS automation."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import socket
import shutil
import time
import tkinter as tk
from types import SimpleNamespace
from unittest.mock import patch

from hosts.standalone.app import App, ROOT
from hosts.standalone.session import Session
from engine.io.krita_csv import export_animation, inspect_interchange
from engine.project import fingerprint
from scripts.batch_roundtrip import png, decode_fixture_png


def run(output):
    output.mkdir(parents=True, exist_ok=False)
    checks = {}
    root = tk.Tk()
    root.report_callback_exception = lambda *error: (_ for _ in ()).throw(AssertionError(str(error)))
    app = App(root)
    try:
        with patch.object(socket, 'socket', side_effect=AssertionError('No network allowed in standalone UI smoke')):
            root.update()
            checks['credits_visible_without_project'] = app.credits_button.winfo_viewable() == 1 and app.credits_button.cget('text') == 'CREDITS'
            root.focus_force()
            app.credits_button.focus_set()
            root.update()
            app.credits_button.event_generate('<Return>')
            root.update()
            checks['keyboard_opens_credits'] = app.credits_window.winfo_viewable() == 1
            checks['offline_sources_and_full_notices'] = len(app.shown) >= 27 and 'Tcl' in app.notice_text.get('1.0', 'end') and 'REF-TKINTER' in [s['source_id'] for s, uses in app.shown]
            app.query.set('REQ-13')
            checks['search_matches_feature_usage'] = len(app.shown) > 0 and len(app.shown) < len(app.credits_data['sources'])
            app.category.set('Current runtime')
            app.query.set('')
            checks['runtime_filter_includes_tk'] = 'REF-TKINTER' in [s['source_id'] for s, uses in app.shown]
            app.category.set('Data and assets')
            checks['system_font_asset_credits_discoverable']={'REF-SEGOE-UI','REF-COURIER-NEW'}<={s['source_id'] for s,u in app.shown}
            app.category.set('Research and methods')
            checks['method_filter_distinguishes_runtime_fonts']='REF-KRA-TILES' in {s['source_id'] for s,u in app.shown} and 'REF-SEGOE-UI' not in {s['source_id'] for s,u in app.shown}
            app.category.set('License notices')
            checks['font_use_and_interpreter_notices_discoverable']={'REF-WINDOWS-FONT-USE','REF-PYTHON-LICENSE'}<={s['source_id'] for s,u in app.shown}
            app.category.set('All')
            app.copy_one()
            checks['copy_selected_apa'] = app.root.clipboard_get() == app.shown[0][0]['apa_reference']
            app.credits_window.focus_force()
            app.credits_window.event_generate('<Escape>')
            root.update()
            checks['escape_returns_focus'] = app.credits_window is None and root.focus_get() == app.credits_button
            # Exercise both tool pages at default and minimum window sizes.
            def descendants(widget):
                for child in widget.winfo_children():
                    yield child
                    yield from descendants(child)
            layout_ok = True
            for geometry in ['1100x760', '900x680']:
                root.geometry(geometry)
                for tab in app.tools.tabs():
                    app.tools.select(tab)
                    root.update()
                    for widget in descendants(root):
                        if widget.winfo_ismapped():
                            layout_ok &= widget.winfo_rootx() >= root.winfo_rootx() and widget.winfo_rooty() >= root.winfo_rooty() and widget.winfo_rootx() + widget.winfo_width() <= root.winfo_rootx() + root.winfo_width() and widget.winfo_rooty() + widget.winfo_height() <= root.winfo_rooty() + root.winfo_height()
            checks['default_and_minimum_window_layout_bounds'] = bool(layout_ok)
            root.geometry('1100x760')
            app.tools.select(0)
            root.update()
            assert all(checks.values()), checks
            credits_record = {'evidence_kind': 'automated_native_Tk_own_controls', 'checks': dict(checks), 'host_files': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in ['hosts/standalone/app.py', 'hosts/standalone/smoke.py']}, 'not_verified': ['Screen-reader compatibility', 'Human aesthetic/readability judgment', 'Physical mouse/device interaction']}
            (output / 'credits-ui.json').write_text(json.dumps(credits_record, indent=2), encoding='utf-8')
            for name in ['credits.json', 'CREDITS.md', 'THIRD_PARTY_NOTICES.txt']:
                shutil.copyfile(ROOT / 'generated' / name, output / name)
            # Gate above passed BEFORE running processing/edit experiments in new host.
            app.load_demo()
            root.update()
            originals = deepcopy(app.session.project['originals'])
            app.session.slot = 4
            app.refresh()
            root.update()
            x, y = app.origin[0] + app.zoom * 30, app.origin[1] + app.zoom * 24
            app.canvas.event_generate('<Button-1>', x=x, y=y)
            app.canvas.event_generate('<ButtonRelease-1>', x=x, y=y)
            root.update()
            corrected_id = app.session.drawing_id()
            checks['canvas_stroke_creates_locked_correction'] = app.session.project['drawings'][corrected_id]['origin'] == 'artist_correction' and app.session.project['drawings'][corrected_id]['locked']
            app.history(True)
            checks['undo_restores_exposed_drawing'] = app.session.drawing_id() == 'shifted'
            app.history(False)
            checks['redo_restores_correction'] = app.session.drawing_id() == corrected_id
            app.session.slot = 0
            app.hold_value.set('5')
            app.change_hold()
            checks['exposure_cut_edit'] = [e['length'] for e in app.session.project['exposures']] == [5, 7]
            before_slot = app.session.slot
            app.toggle_play()
            checks['playback_timer_advances_and_stops'] = app.playing and app.timer is not None and app.session.slot == (before_slot + 1) % app.session.project['shot']['duration_frames']
            root.update()
            app.toggle_play()
            checks['playback_timer_advances_and_stops'] &= not app.playing and app.timer is None
            app.session.slot = 0
            app.tools.select(1)
            root.update()
            app.generate_button.invoke()
            deadline = time.monotonic() + 15
            ticks = 0
            while app.preview is None and time.monotonic() < deadline:
                root.update()
                ticks += 1
                time.sleep(0.01)
            checks['separate_worker_completes_while_ui_pumps'] = app.preview is not None and ticks > 0 and app.process.returncode == 0
            assert checks['separate_worker_completes_while_ui_pumps'], app.status.get()
            app.apply()
            checks['accept_preserves_originals_and_corrected_anchor'] = app.session.project['originals'] == originals and app.session.project['drawings'][corrected_id]['locked'] and app.session.project['exposures'][1]['drawing_id'] == corrected_id
            path = output / 'roundtrip.aaa.json'
            app.session.save(path)
            reopened = Session.load(path)
            checks['native_project_roundtrip_exact'] = reopened.project == app.session.project
            export_animation(reopened.project, output / 'animation-export', png)
            checks['export_holds_after_reopen'] = inspect_interchange(output / 'animation-export')['exposure_lengths'] == [5, 7]
            width, height = reopened.project['canvas']['width'], reopened.project['canvas']['height']
            for i, exposure in enumerate(reopened.project['exposures']):
                pixels = reopened.project['drawings'][exposure['drawing_id']]['pixels']
                encoded = png(width, height, pixels)
                (output / f'drawing-{i}.png').write_bytes(encoded)
                assert decode_fixture_png(encoded)[2] == pixels
            checks['exported_png_pixels_alpha_exact'] = True
            checks['tk_photo_image_loaded'] = app.photo.width() > 0 and app.photo.height() > 0
            # Capture this application's own native Tk image, not another app or desktop.
            app.photo.subsample(app.zoom).write(str(output / 'tk-rendered-drawing.png'), format='png')
            checks['tk_image_roundtrip_pixels_alpha_exact'] = decode_fixture_png((output / 'tk-rendered-drawing.png').read_bytes())[2] == app.session.project['drawings'][app.session.drawing_id()]['pixels']
            checks['no_dropped_drawings'] = 'source' in reopened.project['drawings'] and corrected_id in reopened.project['drawings']
            assert all(checks.values()), checks
            worker_evidence = output / 'worker-evidence'
            worker_evidence.mkdir()
            for name in ['job.json', 'input.json', 'result.json', 'worker.log']:
                shutil.copyfile(app.job / name, worker_evidence / name)
        report = {'status': 'passed', 'checks': checks, 'count': len(checks), 'Tk': root.tk.call('info', 'patchlevel'), 'Tk_package': root.tk.call('package', 'provide', 'Tk'), 'project_sha256': fingerprint(reopened.project), 'credits_snapshot_sha256': app.credits_data['snapshot_sha256'], 'job_directory': str(app.job), 'scope': 'Real native Tk widgets/event loop and own controls; no OS input automation, screen-reader, external editor or artist-quality claim'}
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report, indent=2))
    except Exception as error:
        (output / 'failure.json').write_text(json.dumps({'status': 'failed', 'checks': checks, 'error': str(error)}, indent=2), encoding='utf-8')
        raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:
            app.process.wait(timeout=10)
        if app.job_log:
            app.job_log.close()
        root.destroy()
