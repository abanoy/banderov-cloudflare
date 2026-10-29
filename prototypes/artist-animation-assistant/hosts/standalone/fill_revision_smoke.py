"""Own native accepted-region revision; synthetic data, no OS UI automation."""
from copy import deepcopy
import hashlib
import json
import shutil
import socket
import time
import tkinter as tk
from unittest.mock import patch

from engine.io.png_codec import read_png
from engine.io.openraster import write_ora,import_ora
from engine.project import fingerprint
from engine.jobs import read
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session


def run(output):
    output.mkdir(parents=True,exist_ok=False)
    root=tk.Tk()
    root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root)
    checks={}
    def click(x,y):
        x=app.origin[0]+x*app.zoom+app.zoom//2
        y=app.origin[1]+y*app.zoom+app.zoom//2
        app.canvas.event_generate('<Button-1>',x=x,y=y)
        app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y)
        root.update()
    def select(identity):
        app.session.layer_id=identity
        app.layer_tree.selection_set(identity)
        root.update()
    def wait():
        deadline=time.monotonic()+15
        count=0
        while app.preview is None and time.monotonic()<deadline:
            root.update();time.sleep(.01);count+=1
        assert app.preview is not None,app.status.get()
        return count
    try:
        with patch.object(socket,'socket',side_effect=AssertionError('No network permitted')):
            root.update();app.credits_button.invoke();root.update()
            checks['offline_revision_credits_before_processing']={'REF-COLORIZE-MASK','REF-PYTHON-COPY','REF-SEED-FILL','REF-MORPHOLOGY'}<={s['source_id'] for s,u in app.shown}
            assert all(checks.values()),checks
            app.close_credits()
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:
                shutil.copyfile(ROOT/'generated'/name,output/name)
            app.load_fill_demo();app.tools.select(3);root.update()
            layout=[]
            for geometry in ['1100x760','900x680']:
                root.geometry(geometry);root.update()
                page=app.edit_region_button.master
                children=[dict(text=w.cget('text') if 'text' in w.keys() else str(w),bottom=w.winfo_y()+w.winfo_height(),height=page.winfo_height()) for w in page.winfo_children() if w.winfo_ismapped()]
                layout.append(dict(geometry=geometry,children=children))
                assert len(children)==len(page.winfo_children()),layout
                assert all(w['bottom']<=w['height'] for w in children),layout
            checks['complete_fill_page_fits_default_and_minimum_window']=True
            app.canvas_action.set('Paint');app.erase.set(True);click(15,5);app.erase.set(False)
            source_id=app.session.drawing_id()
            original_source=deepcopy(app.session.project['drawings'][source_id])
            app.canvas_action.set('Fill seed');click(10,10)
            app.fill_generate_button.invoke();wait();app.fill_accept_button.invoke();root.update()
            region_id=next(iter(app.session.project['fill_regions']))
            region=app.session.project['fill_regions'][region_id]
            checks['initial_leaked_fill_is_explicitly_reviewed_and_accepted']=app.session.project['drawings'][app.session.drawing_id()]['pixels'][0][3]==255
            app.canvas_action.set('Paint');app.color=[220,40,60,255];click(1,1)
            app.erase.set(True);click(10,10);app.erase.set(False)
            correction_id=app.session.drawing_id()
            correction=deepcopy(app.session.project['drawings'][correction_id])
            checks['native_paint_and_erase_create_pixel_constraints']=correction['protected_pixels']==[33,330] and correction['pixels'][330]==[0,0,0,0]
            project=deepcopy(app.session.project)
            project['layers']['unrelated']=dict(name='Independent paint',order=8)
            project['drawings']['unrelated']=dict(pixels=[[0,0,0,0] for _ in range(1024)],origin='synthetic',approved=True,locked=False)
            project['exposures'].append(dict(layer_id='unrelated',drawing_id='unrelated',start=0,length=1))
            app.session.commit(project,'synthetic-unrelated-layer-setup');app.refresh();root.update()
            app.edit_region_button.invoke();root.update()
            checks['accepted_boundary_button_restores_seed_settings_and_ink_selection']=app.fill_region==region_id and app.fill_seed==[10,10] and app.session.layer_id==region['ink_layer'] and app.fill_paper.get()=='transparent'
            app.canvas_action.set('Add barrier');click(15,5)
            app.fill_generate_button.invoke()
            checks['revision_worker_declares_subject_and_dependency_scope']=read(app.job/'job.json')['operation']=='revise_accepted_fill' and len(read(app.job/'job.json')['dependency_sha256'])==64
            select('unrelated');app.canvas_action.set('Paint');app.color=[230,180,50,255];click(30,30)
            unrelated_id=app.session.drawing_id()
            # Restore loaded fill controls after choosing an unrelated brush color.
            app.color=[80,155,220,255]
            select(region['ink_layer'])
            ticks=wait()
            checks['unrelated_edit_keeps_local_preview_applicable']=ticks>0 and app.preview_current()
            app.photo.subsample(app.zoom).write(str(output/'tk-revised-fill-preview.png'),format='png')
            pixels=read_png((output/'tk-revised-fill-preview.png').read_bytes())[2]
            checks['preview_replaces_old_fill_instead_of_stacking']=pixels[2*32+2]==[0,0,0,0]
            checks['preview_preserves_paint_and_transparent_erasure']=pixels[33]==[220,40,60,255] and pixels[330]==[0,0,0,0]
            checks['preview_keeps_unrelated_artist_pixel']=pixels[30*32+30]==[230,180,50,255]
            checks['protected_pixel_warning_visible']='2 artist-protected pixels' in app.status.get()
            worker=output/'worker-evidence';worker.mkdir()
            for name in ['job.json','input.json','result.json','worker.log']:
                shutil.copyfile(app.job/name,worker/name)
            before=deepcopy(app.session.project)
            app.fill_accept_button.invoke();root.update()
            current=app.session.project
            checks['accepted_revision_reuses_layers_and_region_identity']=current['layers']==before['layers'] and set(current['fill_regions'])=={region_id} and current['fill_regions'][region_id]['version']==1
            new=current['drawings'][app.session.drawing_id()]
            checks['accepted_revision_keeps_correction_and_original_versions']=new['protected_pixels']==[33,330] and current['drawings'][correction_id]==correction and current['drawings'][source_id]==original_source
            checks['accepted_revision_preserves_unrelated_edit_and_originals']=current['drawings'][unrelated_id]==before['drawings'][unrelated_id] and current['originals']==before['originals']
            path=output/'revised.aaa.json';app.session.save(path)
            checks['revised_project_reopens_exactly']=Session.load(path).project==current
            write_ora(current,output/'revised.ora',selected_layer=app.session.layer_id)
            checks['region_masks_constraints_and_epochs_survive_ORA']=import_ora(output/'revised.ora')['project']==current
            revised=deepcopy(current)
            app.history(True);root.update()
            checks['one_undo_restores_previous_fill_without_losing_unrelated_edit']=app.session.project['exposures']==before['exposures'] and app.session.project['drawings'][unrelated_id]==before['drawings'][unrelated_id]
            app.history(False);root.update()
            checks['redo_restores_revised_fill']=app.session.project['exposures']==revised['exposures']
            select(region['fill_layer']);app.edit_region_button.invoke();root.update()
            app.canvas_action.set('Keep open');click(15,5)
            app.fill_generate_button.invoke();wait()
            job=app.job
            select(region['ink_layer']);app.canvas_action.set('Paint');app.color=[35,45,65,255];click(7,7)
            checks['dependent_ink_edit_hides_old_preview']=not app.preview_current()
            app.history(True);root.update();select(region['ink_layer'])
            checks['undo_does_not_resurrect_old_dependency_result']=not app.preview_current()
            before_attempt=deepcopy(app.session.project)
            app.fill_accept_button.invoke();root.update()
            checks['stale_revision_acceptance_leaves_document_unchanged']=app.session.project==before_attempt
            assert all(checks.values()),checks
            names=['engine/fill_revision.py','engine/jobs.py','hosts/standalone/session.py','hosts/standalone/app.py','hosts/standalone/fill_revision_smoke.py']
            report=dict(status='passed',checks=checks,count=len(checks),credits_snapshot_sha256=app.credits_data['snapshot_sha256'],source_sha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in names},scope='Original synthetic data, own Tk widgets/events, own worker; unrelated-layer setup uses controller API, not a missing add-layer UI. No OS input, external editor, artist-effort or screen-reader claim',layout=layout)
            (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
            print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error)),indent=2),encoding='utf-8')
        raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
