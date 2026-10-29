"""Own native selected-cleanup workflow; original synthetic data only."""
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
    root=tk.Tk();root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root);checks={};layouts=[]
    def event(name,x,y):
        app.canvas.event_generate(name,x=app.origin[0]+x*app.zoom+app.zoom//2,y=app.origin[1]+y*app.zoom+app.zoom//2)
    def click(x,y):event('<Button-1>',x,y);event('<ButtonRelease-1>',x,y);root.update()
    def wait():
        deadline=time.monotonic()+20
        while app.preview is None and time.monotonic()<deadline:root.update();time.sleep(.01)
        root.update();assert app.preview is not None,app.status.get();assert app.process.returncode==0
    def capture(name):
        path=output/name;app.photo.subsample(app.zoom).write(str(path),format='png')
        return read_png(path.read_bytes())[2]
    def layout(label):
        page=app.cleanup_accept_button.master
        children=[dict(text=w.cget('text') if 'text' in w.keys() else str(w),mapped=bool(w.winfo_ismapped()),bottom=w.winfo_y()+w.winfo_height(),height=w.winfo_height(),required=w.winfo_reqheight(),page_height=page.winfo_height()) for w in page.winfo_children()]
        layouts.append(dict(label=label,children=children));assert all(w['mapped'] and w['height']>=w['required'] and w['bottom']<=w['page_height'] for w in children),layouts
    try:
        with patch.object(socket,'socket',side_effect=AssertionError('No network allowed')):
            root.update();app.credits_button.invoke();root.update()
            checks['cleanup_primary_credits_available_offline_before_processing']={'REF-THINNING-OPENCV','REF-CHAIKIN-NOTES','REF-QGIS-SMOOTH','REF-SKETCHSIMPLIFY-LICENSE'}<={s['source_id'] for s,u in app.shown}
            assert all(checks.values()),checks
            app.close_credits()
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/name,output/name)
            app.tools.select(5);root.update()
            for geometry in ['1100x760','900x680']:root.geometry(geometry);root.update();layout(geometry)
            app.cleanup_demo_button.invoke();root.update()
            source=deepcopy(app.session.project);pixels=source['drawings']['source']['pixels'];width=96
            event('<Button-1>',3,8);event('<B1-Motion>',78,24);event('<ButtonRelease-1>',78,24);root.update()
            checks['native_rectangle_selection_does_not_paint_source']=[int(v.get()) for v in app.cleanup_roi]==[3,8,79,25] and app.session.project==source
            app.cleanup_generate_button.invoke();wait();layout('minimum-with-cleanup-preview')
            result=app.cleanup_preview
            checks['cleanup_runs_as_separate_worker_preview_only']=result is not None and app.session.project==source and result['metrics']['changed_pixels']>0
            proposed=capture('tk-selected-cleanup-preview.png')
            checks['native_cleanup_image_matches_result_pixels_alpha']=proposed==result['pixels']
            checks['native_selection_preserves_unselected_corner_and_dots']=all(proposed[i]==pixels[i] for i in range(len(pixels)) if not(3<=i%96<79 and 8<=i//96<25))
            app.cleanup_paths_on.set(True);app.render();root.update()
            checks['inferred_centerline_analysis_overlay_visible']=any(app.canvas.type(i)=='line' for i in app.canvas.find_all())
            app.cleanup_paths_on.set(False);app.preview_on.set(False);app.render();root.update()
            checks['source_comparison_is_exact_native_image']=capture('tk-original-comparison.png')==pixels
            app.preview_on.set(True);app.render()
            app.open_proposal_details();root.update()
            details=app.proposal_details_text.get('1.0','end')
            checks['cleanup_review_discloses_method_limits_and_metrics']='SELECTED LINE CLEANUP' in details and 'Metrics:' in details and 'Parallel overdraw is not consolidated' in details
            app.proposal_details_window.event_generate('<Escape>');root.update()
            before=deepcopy(app.session.project)
            app.cleanup_passes.set('3');app.cleanup_accept_button.invoke();root.update()
            checks['changed_cleanup_controls_cannot_accept_old_result']=app.session.project==before and 'regenerate' in app.status.get()
            app.cleanup_passes.set('2')
            worker=output/'worker-evidence';worker.mkdir()
            for name in ['job.json','input.json','result.json','worker.log']:shutil.copyfile(app.job/name,worker/name)
            app.cleanup_accept_button.invoke();root.update()
            accepted=deepcopy(app.session.project)
            checks['cleanup_accept_retains_source_originals_and_analysis']=accepted['drawings']['source']==source['drawings']['source'] and accepted['originals']==source['originals'] and bool(accepted['cleanup_operations'][-1]['components'])
            checks['cleanup_accept_is_new_editable_drawing_version']=app.session.drawing_id()!='source' and accepted['drawings'][app.session.drawing_id()]['pixels']==proposed
            path=output/'selected-cleanup.aaa.json';app.session.save(path)
            checks['cleanup_project_reopens_exactly']=Session.load(path).project==accepted
            write_ora(accepted,output/'selected-cleanup.ora',selected_layer=app.session.layer_id)
            checks['cleanup_analysis_and_pixels_roundtrip_ORA']=import_ora(output/'selected-cleanup.ora')['project']==accepted
            app.history(True);root.update();checks['cleanup_one_action_undo_restores_source_exposure']=app.session.drawing_id()=='source' and app.session.project['drawings']==source['drawings']
            app.history(False);root.update();checks['cleanup_redo_restores_reviewed_result']=app.session.project['drawings'][app.session.drawing_id()]['pixels']==proposed
            app.session.save(output/'after-redo.aaa.json')
            app.cleanup_demo_button.invoke();root.update()
            app.canvas_action.set('Keep cleanup detail');click(82,15)
            app.cleanup_remove.set('1');app.cleanup_generate_button.invoke();wait()
            checks['native_keep_detail_preserves_intended_dot_while_noise_removes_other']=app.cleanup_preview['pixels'][15*96+82]==[30,160,100,255] and app.cleanup_preview['pixels'][42*96+82]==[0,0,0,0]
            app.cleanup_accept_button.invoke();root.update()
            drawing=app.session.project['drawings'][app.session.drawing_id()]
            checks['accepted_keep_detail_becomes_persistent_constraint']=15*96+82 in drawing['protected_pixels'] and drawing['locked']
            app.canvas_action.set('Paint');app.color=[220,30,60,255];click(30,16)
            corrected=deepcopy(app.session.project)
            app.cleanup_reset_button.invoke();app.cleanup_generate_button.invoke();wait()
            checks['later_cleanup_preserves_artist_corrected_component_and_detail']=app.cleanup_preview['pixels'][16*96+30]==[220,30,60,255] and app.cleanup_preview['pixels'][15*96+82]==[30,160,100,255]
            app.reject();checks['reject_cleanup_keeps_project_exact']=app.session.project==corrected
            app.cleanup_generate_button.invoke();cancelled_job=app.job
            # Invoke our own visible reject/cancel control; no OS input.
            page=app.cleanup_accept_button.master
            next(w for w in page.winfo_children() if 'text' in w.keys() and w.cget('text')=='Reject / cancel').invoke()
            deadline=time.monotonic()+10
            while app.process.poll() is None and time.monotonic()<deadline:root.update();time.sleep(.01)
            root.update()
            checks['native_cleanup_cancel_has_no_result']=app.process.returncode==0 and read(cancelled_job/'job.json')['state']=='cancelled' and not(cancelled_job/'result.json').exists()
            assert all(checks.values()),checks
            names=['engine/cleanup.py','engine/jobs.py','hosts/standalone/session.py','hosts/standalone/app.py','hosts/standalone/cleanup_smoke.py']
            report=dict(status='passed',checks=checks,count=len(checks),credits_snapshot_sha256=app.credits_data['snapshot_sha256'],source_sha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in names},layout=layouts,scope='Original synthetic data; own Tk controls/events/image writer and local worker. No OS input/external editor/screen reader, inferred semantic parts, lossless pencil restoration or representative artist effort claim')
            (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error),layout=layouts),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
