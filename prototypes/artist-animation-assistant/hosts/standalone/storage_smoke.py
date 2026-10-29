"""Own Tk save/open route for compact and legacy projects; chooser replies stubbed."""
from copy import deepcopy
import hashlib
import json
import shutil
import tkinter as tk
from unittest.mock import patch
from engine.io.project_archive import PackedArchive
from engine.io.png_codec import read_png
from engine.layers import render
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session


def run(output):
    output.mkdir(parents=True,exist_ok=False)
    root=tk.Tk();root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root);checks={}
    try:
        root.geometry('1100x760');root.update()
        app.open_credits();root.update()
        checks['credits_visible_before_storage_processing']=bool(app.credits_window.winfo_viewable()) and {'REF-PYTHON','REF-PYTHON-ZIP','REF-PYTHON-BUFFERS','REF-PYTHON-COLLECTIONS'}<={row['source_id'] for row in app.credits_data['sources']}
        app.close_credits();root.update()
        for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/name,output/name)
        with patch('hosts.standalone.app.messagebox.askyesno',return_value=True):
            app.load_demo();root.update();originals=deepcopy(app.session.project['originals'])
            x,y=app.origin[0]+app.zoom*30,app.origin[1]+app.zoom*24
            app.canvas.event_generate('<Button-1>',x=x,y=y);app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y);root.update()
            corrected=app.session.drawing_id()
            checks['native_canvas_correction_retains_locked_source']=app.session.project['drawings'][corrected]['locked'] and app.session.project['originals']==originals
            before=deepcopy(app.session.project)
            path=output/'edited.aaa'
            with patch('hosts.standalone.app.filedialog.asksaveasfilename',return_value=str(path)) as choose:
                app.save_project()
                checks['compact_is_default_save_format']=choose.call_args.kwargs['defaultextension']=='.aaa'
            checks['save_uses_packed_zip']=path.read_bytes().startswith(b'PK')
            checks['save_marks_current_state_clean']=not app.session.dirty
            checks['compact_roundtrip_exact_including_originals_locks_epochs']=Session.load(path).project==before
            with PackedArchive(path) as archive:
                checks['opening_metadata_does_not_decode_tiles']=archive.asset_reads==0
                checks['archive_contains_fewer_tiles_than_pixel_arrays']=len([n for n in archive.infos if n.startswith('tiles/')])<len(before['drawings'])+len(before['originals'])+len(before['proposals'])
            app.session.correct({0:[80,20,120,0]});app.refresh();root.update()
            checks['later_edit_is_dirty']=app.session.dirty
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(path)) as choose:
                app.open_project();root.update()
                checks['open_dialog_includes_both_formats']='*.aaa *.aaa.json' in choose.call_args.kwargs['filetypes'][0][1]
            checks['native_open_restores_exact_saved_document']=app.session.project==before
            checks['native_open_preserves_prior_source_and_corrected_drawing']=app.session.project['originals']==originals and corrected in app.session.project['drawings']
            app.photo.subsample(app.zoom).write(str(output/'tk-compact-reopened.png'),format='png')
            checks['actual_tk_projection_after_compact_reopen_is_exact']=read_png((output/'tk-compact-reopened.png').read_bytes())[2]==render(app.session.project,app.session.slot)
            legacy=output/'legacy.aaa.json'
            with patch('hosts.standalone.app.filedialog.asksaveasfilename',return_value=str(legacy)):app.save_project()
            checks['legacy_json_route_still_exact']=Session.load(legacy).project==before and legacy.read_bytes().startswith(b'{')
            app.session.correct({1:[200,100,0,50]});app.refresh();root.update();app.history(True)
            checks['editing_undo_after_compact_reopen_is_exact']=app.session.project['drawings'][app.session.drawing_id()]['pixels']==before['drawings'][corrected]['pixels']
            app.history(False);checks['redo_after_compact_reopen_keeps_source']=app.session.project['drawings'][app.session.drawing_id()]['pixels'][1]==[200,100,0,50] and app.session.project['originals']==originals
            assert all(checks.values()),checks
        names=['engine/io/project_archive.py','hosts/standalone/app.py','hosts/standalone/session.py','hosts/standalone/storage_smoke.py']
        report=dict(status='passed',count=len(checks),checks=checks,credits_snapshot_sha256=app.credits_data['snapshot_sha256'],source_sha256={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in names},scope='Own Tk controls/events and app save/open methods. File chooser/discard replies stubbed. Small integration canvas; large dimensions are separate storage-backend tests, not full-host editing or artist acceptance.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except BaseException as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error)),indent=2),encoding='utf-8');raise
    finally:
        app.cancel();root.destroy()
