"""Actual retained KRA -> standalone own controls -> editable project round trip."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import socket
import tkinter as tk
from unittest.mock import patch
import zipfile

from hosts.standalone.app import App, ROOT
from hosts.standalone.session import Session
from engine.project import fingerprint
from scripts.batch_roundtrip import decode_fixture_png


def run(output):
    output.mkdir(parents=True, exist_ok=False)
    actual = ROOT/'experiments/EXP-0005-editable-selection/outputs/gui-roundtrip-selected-proposal.kra'
    original_hash = hashlib.sha256(actual.read_bytes()).hexdigest()
    checks = {}
    root = tk.Tk()
    root.report_callback_exception = lambda *error: (_ for _ in ()).throw(AssertionError(str(error)))
    app = App(root)
    try:
        with patch.object(socket, 'socket', side_effect=AssertionError('No network allowed')):
            root.update()
            app.credits_button.invoke()
            root.update()
            checks['credits_visible_and_native_decoder_sources_offline'] = app.credits_window.winfo_viewable() == 1 and {'REF-KRA-TILES','REF-KRA-LZF','REF-KRA-BGRA','REF-COMPOSITING'} <= {s['source_id'] for s, uses in app.shown}
            assert all(checks.values()), checks
            app.close_credits()
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:
                shutil.copyfile(ROOT/'generated'/name,output/name)
            with patch('hosts.standalone.app.filedialog.askopenfilename', return_value=str(actual)):
                app.native_import_button.invoke()
            root.update()
            assert app.session.project is not None, app.status.get()
            checks['actual_native_import_button_loads_three_layers'] = len(app.session.project['layers']) == 3
            group = next(i for i,l in app.session.project['layers'].items() if l.get('nodetype') == 'grouplayer')
            proposal = next(i for i,l in app.session.project['layers'].items() if l['name'] == 'Integration proposal')
            source = next(i for i,l in app.session.project['layers'].items() if l['name'] == 'Source ink')
            checks['native_hidden_group_and_parentage'] = not app.session.project['layers'][group]['visible'] and app.session.project['layers'][source]['parent_id'] == group
            checks['visible_raster_initial_selection'] = app.session.layer_id == proposal
            app.photo.subsample(app.zoom).write(str(output/'native-projection.png'),format='png')
            with zipfile.ZipFile(actual) as archive:
                checks['actual_Tk_projection_matches_Krita_saved_projection'] = decode_fixture_png((output/'native-projection.png').read_bytes())[2] == decode_fixture_png(archive.read('mergedimage.png'))[2]
            originals = deepcopy(app.session.project['originals'])
            proposal_schedule = [deepcopy(e) for e in app.session.project['exposures'] if e['layer_id'] == proposal]
            app.tools.select(2)
            app.layer_tree.selection_set(group)
            root.update()
            before = fingerprint(app.session.project)
            x,y = app.origin[0]+app.zoom+1, app.origin[1]+app.zoom+1
            app.canvas.event_generate('<Button-1>',x=x,y=y)
            app.canvas.event_generate('<B1-Motion>',x=x+app.zoom,y=y)
            app.canvas.event_generate('<ButtonRelease-1>',x=x+app.zoom,y=y)
            root.update()
            checks['group_selection_cannot_paint_previous_raster'] = fingerprint(app.session.project) == before
            app.visibility_button.invoke()
            root.update()
            checks['explicit_group_visibility_edit'] = app.session.project['layers'][group]['visible'] is True
            app.layer_tree.selection_set(source)
            app.tools.select(0)
            root.update()
            app.tools.select(2)
            app.lock_button.invoke()
            root.update()
            locked_before = fingerprint(app.session.project)
            app.canvas.event_generate('<Button-1>',x=x,y=y)
            app.canvas.event_generate('<B1-Motion>',x=x+app.zoom,y=y)
            app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y)
            root.update()
            checks['native_layer_lock_blocks_stroke'] = fingerprint(app.session.project) == locked_before
            app.lock_button.invoke()
            root.update()
            selection_before = fingerprint(app.session.project)
            app.canvas.event_generate('<Button-1>',x=x,y=y)
            app.layer_tree.selection_set(proposal)
            root.update()
            app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y)
            root.update()
            checks['mid_stroke_layer_switch_cannot_redirect_pixels'] = fingerprint(app.session.project) == selection_before
            app.layer_tree.selection_set(source)
            app.tools.select(0)
            root.update()
            app.color = [11,22,33,111]
            app.canvas.event_generate('<Button-1>',x=x,y=y)
            app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y)
            root.update()
            correction = app.session.drawing_id()
            checks['native_child_is_editable_as_locked_correction'] = app.session.project['drawings'][correction]['origin'] == 'artist_correction' and app.session.project['drawings'][correction]['locked']
            checks['editing_child_preserves_other_layer_schedule_and_originals'] = proposal_schedule == [e for e in app.session.project['exposures'] if e['layer_id'] == proposal] and app.session.project['originals'] == originals
            app.session.save(output/'native-import-edited.aaa.json')
            reopened = Session.load(output/'native-import-edited.aaa.json')
            checks['edited_native_import_project_reopens_exactly'] = reopened.project == app.session.project
            checks['retained_native_archive_sha_exact'] = reopened.project['native_source']['sha256'] == original_hash and hashlib.sha256(actual.read_bytes()).hexdigest() == original_hash
            app.history(True)
            checks['native_child_edit_undo_redo'] = app.session.drawing_id() != correction
            app.history(False)
            checks['native_child_edit_undo_redo'] &= app.session.drawing_id() == correction
            assert all(checks.values()), checks
            report = {'status':'passed','checks':checks,'count':len(checks),'source_native_sha256':original_hash,'credits_snapshot_sha256':app.credits_data['snapshot_sha256'],'host_sha256':{relative:hashlib.sha256((ROOT/relative).read_bytes()).hexdigest() for relative in ['engine/io/kra_raster.py','engine/layers.py','hosts/standalone/app.py','hosts/standalone/session.py','hosts/standalone/kra_smoke.py']},'scope':'Actual owner-saved synthetic native raster archive; own native Tk controls/events. File chooser selection stubbed; no OS input/native Krita run. Real animated-native import and broader feature/profile fidelity not established.'}
            (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
            print(json.dumps(report,indent=2))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps({'status':'failed','checks':checks,'error':str(error)},indent=2),encoding='utf-8')
        raise
    finally:
        root.destroy()
