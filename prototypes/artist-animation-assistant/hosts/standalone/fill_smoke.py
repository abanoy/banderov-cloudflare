"""Own native controls for source-preserving fill; not external-editor/artist QA."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import socket
import time
import tkinter as tk
from unittest.mock import patch

from engine.io.png_codec import read_png
from engine.io.openraster import write_ora,import_ora
from engine.layers import render
from engine.project import fingerprint
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session


def run(output):
    output.mkdir(parents=True,exist_ok=False)
    checks={}
    root=tk.Tk()
    root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root)
    def click(x,y):
        app.canvas.event_generate('<Button-1>',x=app.origin[0]+x*app.zoom+app.zoom//2,y=app.origin[1]+y*app.zoom+app.zoom//2)
        app.canvas.event_generate('<ButtonRelease-1>',x=app.origin[0]+x*app.zoom+app.zoom//2,y=app.origin[1]+y*app.zoom+app.zoom//2)
        root.update()
    def wait():
        deadline=time.monotonic()+15
        ticks=0
        while app.preview is None and time.monotonic()<deadline:
            root.update()
            ticks+=1
            time.sleep(.01)
        assert app.preview is not None,app.status.get()
        return ticks
    try:
        with patch.object(socket,'socket',side_effect=AssertionError('No network allowed')):
            root.update()
            app.credits_button.invoke();root.update()
            checks['offline_method_and_interaction_credits_before_processing']=app.credits_window.winfo_viewable()==1 and {'REF-SEED-FILL','REF-MORPHOLOGY','REF-COLORIZE-MASK','REF-FLATMAGIC','REF-COMPOSITING'}<={s['source_id'] for s,u in app.shown}
            assert all(checks.values()),checks
            app.close_credits()
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:
                shutil.copyfile(ROOT/'generated'/name,output/name)
            app.load_fill_demo();app.tools.select(3);root.update()
            original=deepcopy(app.session.project)
            for geometry in ['1100x760','900x680']:
                root.geometry(geometry);root.update()
                assert app.fill_generate_button.winfo_rooty()+app.fill_generate_button.winfo_height()<=root.winfo_rooty()+root.winfo_height()
                assert app.fill_accept_button.winfo_rootx()+app.fill_accept_button.winfo_width()<=root.winfo_rootx()+root.winfo_width()
            checks['fill_controls_fit_default_and_minimum_window']=True
            click(10,10)
            checks['native_seed_click_does_not_modify_ink']=app.fill_seed==[10,10] and app.session.project==original
            app.fill_generate_button.invoke()
            ticks=wait()
            checks['fill_separate_worker_runs_with_live_event_loop']=ticks>0 and app.process.returncode==0
            checks['proposal_preview_only_preserves_document']=app.session.project==original and app.fill_preview['metrics']['region_area']==400
            app.photo.subsample(app.zoom).write(str(output/'tk-fill-preview.png'),format='png')
            pixels=read_png((output/'tk-fill-preview.png').read_bytes())[2]
            checks['actual_Tk_fill_preview_preserves_ink_and_colors_region']=pixels[10*32+10]==[80,155,220,255] and pixels[5*32+10]==[35,45,65,255]
            evidence=output/'worker-evidence';evidence.mkdir()
            for name in ['job.json','input.json','result.json','worker.log']:
                shutil.copyfile(app.job/name,evidence/name)
            app.fill_radius.set('1')
            app.fill_accept_button.invoke();root.update()
            checks['changed_controls_cannot_accept_old_fill']=app.session.project==original and 'regenerate' in app.status.get()
            app.fill_radius.set('0')
            app.fill_accept_button.invoke();root.update()
            accepted=deepcopy(app.session.project)
            checks['accept_adds_editable_ink_fill_layers_with_retained_original']=len(accepted['layers'])==4 and not accepted['layers']['ink']['visible'] and accepted['drawings']['source']==original['drawings']['source'] and accepted['originals']==original['originals']
            checks['accepted_fill_is_current_raster_selection']=app.layer_tree.selection()==(app.session.layer_id,) and app.session.layer_id.endswith('-fill')
            checks['boundary_region_palette_persist_as_editable_state']=bool(accepted['fill_regions']) and accepted['palettes']['fill_main']['rgba']==[80,155,220,255]
            app.session.save(output/'accepted.aaa.json')
            reopened=Session.load(output/'accepted.aaa.json')
            checks['accepted_project_reopens_exactly']=reopened.project==accepted
            write_ora(accepted,output/'accepted.ora',selected_layer=app.session.layer_id)
            checks['fill_structure_roundtrips_layered_interchange']=import_ora(output/'accepted.ora')['project']==accepted
            app.history(True);root.update()
            checks['undo_restores_source_structure_and_valid_selection']=app.session.project['layers']==original['layers'] and app.session.layer_id=='ink'
            app.history(False);root.update()
            checks['redo_restores_fill_structure']=app.session.project['layers']==accepted['layers'] and render(app.session.project,0)==render(accepted,0)
            app.canvas_action.set('Paint')
            app.session.layer_id=next(iter(accepted['fill_regions'].values()))['fill_layer']
            app.layer_tree.selection_set(app.session.layer_id);root.update()
            click(10,10)
            checks['accepted_fill_accepts_locked_artist_correction']=app.session.project['drawings'][app.session.drawing_id()]['origin']=='artist_correction' and app.session.project['drawings'][app.session.drawing_id()]['locked']
            app.session.saved_hash=fingerprint(app.session.project)
            app.load_fill_demo();root.update()
            # Create an explicit one-pixel opening in the otherwise closed source.
            app.session.correct({5*32+15:[0,0,0,0]});app.refresh();root.update()
            before=deepcopy(app.session.project)
            app.canvas_action.set('Fill seed');click(10,10)
            app.fill_generate_button.invoke();wait()
            checks['gap_leak_is_flagged_for_review']=app.fill_preview['metrics']['touches_edge'] and 'possible leak' in app.status.get()
            app.reject()
            checks['reject_leaves_document_and_duration_exact']=app.session.project==before
            app.canvas_action.set('Add barrier');click(15,5)
            app.fill_generate_button.invoke();wait()
            checks['native_manual_barrier_contains_fill_without_drawing_ink']=not app.fill_preview['metrics']['touches_edge'] and app.fill_preview['ink'][5*32+15]==[0,0,0,0]
            app.reject()
            app.canvas_action.set('Keep open');click(15,5)
            app.fill_radius.set('1')
            app.fill_generate_button.invoke();wait()
            checks['native_keep_open_overrides_automatic_gap_closing']=app.fill_preview['metrics']['touches_edge'] and 5*32+15 not in app.fill_preview['boundary']
            app.reject()
            assert all(checks.values()),checks
            report=dict(status='passed',checks=checks,count=len(checks),credits_snapshot_sha256=app.credits_data['snapshot_sha256'],source_sha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['engine/fill.py','engine/jobs.py','hosts/standalone/app.py','hosts/standalone/session.py','hosts/standalone/fill_smoke.py']},scope='Own native Tk widgets/events and local subprocess; no OS input, external editor, representative artist quality, screen-reader or physical-device claim')
            (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
            print(json.dumps(report,indent=2))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error)),indent=2),encoding='utf-8')
        raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:
            app.process.wait(timeout=10)
        if app.job_log:
            app.job_log.close()
        root.destroy()
