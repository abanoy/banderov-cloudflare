"""Real own-Tk large editing/worker controls; synthetic input, no OS automation."""
from copy import deepcopy
import hashlib,json,shutil,time,tkinter as tk
from types import SimpleNamespace
from unittest.mock import patch
from engine.spatial_constraints import count as protection_count
from engine.project import create,fingerprint
from engine.io.project_archive import PixelPlane,SourceBlob
from engine.io.png_codec import read_png
from engine.jobs import read
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session


def run(output):
    output.mkdir(parents=True,exist_ok=False);root=tk.Tk();root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root);checks={};times={};layouts=[]
    def wait():
        deadline=time.monotonic()+30;ticks=0
        while app.process and app.process.poll() is None and time.monotonic()<deadline:
            root.update();ticks+=1;time.sleep(.005)
        assert app.process and app.process.poll() is not None,'worker timeout'
        root.update();app.poll_job();root.update();return ticks
    def event_paint(x,y):
        point=app.canvas_point(SimpleNamespace(x=x,y=y))
        app.canvas.event_generate('<Button-1>',x=x,y=y);app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y);root.update();return point
    def own_image(name):
        from engine.packed_render import render
        path=output/name;app.photo.write(str(path),format='png')
        x0,y0,x1,y1,ox,oy,ow,oh=app.packed_transform
        expected=render(app.session.project,app.session.slot,(ow,oh),(x0,y0,x1,y1))[2]
        assert read_png(path.read_bytes(),packed=True)[2].region_bytes()==expected
        return path
    try:
        root.geometry('1100x760');root.update();app.open_credits();root.update()
        checks['credits_and_exact_numpy_component_visible_before_processing']=app.credits_window.winfo_viewable() and any(c['component_id']=='COMP-NUMPY-2-4-1' and c['execution_allowed'] for c in app.credits_data['components'])
        notices=app.notice_text.get('1.0','end-1c')
        checks['full_numpy_and_bundled_notices_available_offline']='COMP-NUMPY-2-4-1' in notices and 'GCC RUNTIME LIBRARY EXCEPTION' in notices and 'Highway' in notices and len(notices)==len(app.credits_data['notices'])
        app.close_credits();root.update()
        for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/name,output/name)
        assert all(checks.values()),checks
        from engine.packed_render import png_bytes,render
        with patch('hosts.standalone.app.messagebox.askyesno',return_value=True):
            app.new_hd_button.invoke();root.update()
            checks['new_hd_canvas_control_creates_live_packed_document']=app.session.project['schema_version']=='0.2' and app.session.project['canvas']['width']==1920 and isinstance(app.session.project['drawings']['source']['pixels'],PixelPlane)
            w,h=1920,1080;raw=bytearray(w*h*4)
            for y in range(180,790):raw[(y*w+350)*4:(y*w+1250)*4]=bytes([30,110,210,160])*900
            # Hidden RGB at alpha0 tests source retention, distinct from projection.
            raw[:4]=bytes([77,12,200,0]);data=png_bytes(w,h,bytes(raw));input_path=output/'original-HD-input.png';input_path.write_bytes(data)
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(input_path)):app.import_png()
            root.update();source=app.session.project['originals']['source']['pixels'];source_hash=app.session.project['originals_sha256']
            checks['large_png_import_preserves_exact_source_blob_and_rgba']=source.region_bytes()==bytes(raw) and app.session.project['png_source']['blob'].data==data and source[0]==[77,12,200,0]
            checks['large_fit_view_uses_bounded_canvas_items']=app.photo.width()<=app.canvas.winfo_width() and len(app.canvas.find_all())<=3 and app.zoom<1
            own_image('tk-HD-fit.png');checks['actual_native_fit_projection_alpha_exact']=True
            before=app.view_factor;cx,cy=app.canvas.winfo_width()//2,app.canvas.winfo_height()//2
            app.canvas.event_generate('<MouseWheel>',delta=120,x=cx,y=cy);root.update()
            checks['actual_wheel_zooms_and_crops_viewport']=app.view_factor>before and app.packed_transform[2]-app.packed_transform[0]<w
            pan=app.view_pan;app.canvas.event_generate('<Button-2>',x=cx,y=cy);app.canvas.event_generate('<B2-Motion>',x=cx+20,y=cy+10);root.update()
            checks['actual_middle_drag_pans']=app.view_pan!=pan
            app.packed_fit();root.update();checks['fit_controller_restores_whole_image']=app.view_factor==1 and app.view_pan==(0,0)
            app.color=[230,40,120,255];points=[];latencies=[]
            for i in range(100):
                x=35+i*(app.canvas.winfo_width()-70)//100;y=app.canvas.winfo_height()//2
                started=time.perf_counter();point=event_paint(x,y);latencies.append(time.perf_counter()-started);points.append(point)
            drawing=app.session.project['drawings'][app.session.drawing_id()]
            checks['hundred_native_strokes_surpass_old64drawing_limit']=len(app.session.project['drawings'])==101 and protection_count(drawing)==len(set(points))==100
            checks['native_paint_maps_to_correct_source_pixels']=all(drawing['pixels'][y*w+x]==app.color for x,y in points)
            checks['hundred_native_edits_retain_sources_and_prior_locked_versions']=app.session.project['originals_sha256']==source_hash and source.region_bytes()==bytes(raw) and all(d['locked'] for d in app.session.project['drawings'].values())
            times['HD100native_strokes_seconds']=sum(latencies);times['HD_stroke_max_seconds']=max(latencies)
            first_id=app.session.drawing_id();app.history(True);app.history(False)
            checks['large_undo_redo_restores_correction_and_advances_revision']=app.session.drawing_id()==first_id and app.session.counter>100
            current=deepcopy(app.session.project);path=output/'HD-current.aaa'
            with patch('hosts.standalone.app.filedialog.asksaveasfilename',return_value=str(path)):app.save_project()
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(path)):app.open_project()
            checks['native_large_save_open_exact_without_live_file_handle']=app.session.project==current
            app.session.correct({1:[10,20,30,0]});app.refresh()
            with patch('hosts.standalone.app.filedialog.asksaveasfilename',return_value=str(path)):app.save_project()
            checks['same_path_native_save_reopens_after_edit']=Session.load(path).project==app.session.project
            app.tools.select(1);root.update();app.dx.set('3');app.dy.set('0');app.generate_button.invoke();ticks=wait()
            checks['large_worker_runs_separately_while_event_loop_pumps']=ticks>0 and app.process.returncode==0 and isinstance(app.preview,PixelPlane) and read(app.job/'job.json')['state']=='completed'
            checks['large_worker_snapshot_and_result_are_packed']=(app.job/'input.json').read_bytes().startswith(b'PK') and (app.job/'result.json').read_bytes().startswith(b'PK')
            corrected_id=app.session.drawing_id();app.apply();root.update()
            checks['large_worker_review_accept_preserves_corrected_anchor_and_originals']=app.session.drawing_id()!=corrected_id and app.session.project['drawings'][corrected_id]['locked'] and app.session.project['originals_sha256']==source_hash
            app.generate_button.invoke();app.session.correct({3:[1,2,3,4]});app.refresh();wait();before=fingerprint(app.session.project)
            try:app.apply();stale=False
            except ValueError:stale=True
            checks['editing_during_worker_blocks_stale_acceptance']=stale and fingerprint(app.session.project)==before
            app.session.travel();app.refresh()
            checks['undo_does_not_resurrect_old_worker']=not app.preview_current()
            app.generate_button.invoke()
            def children(widget):
                yield widget
                for child in widget.winfo_children():yield from children(child)
            cancel=next(c for c in children(root) if isinstance(c,tk.ttk.Button) and c.cget('text')=='Cancel job')
            cancel.invoke();wait();checks['actual_cancel_control_produces_no_result']=read(app.job/'job.json')['state']=='cancelled' and not (app.job/'result.json').exists()
            # Separate4K live view/import/paint/save test; no full-array Python copy.
            w4=h4=4096;raw4=bytes([70,120,190,128])*(w4*h4);data4=png_bytes(w4,h4,raw4);input4=output/'original-4K-input.png';input4.write_bytes(data4)
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(input4)):app.import_png()
            root.update();started=time.perf_counter();x4,y4=event_paint(app.canvas.winfo_width()//2,app.canvas.winfo_height()//2);times['4K_native_stroke_seconds']=time.perf_counter()-started
            checks['native4k_import_and_paint_are_live_packed']=app.session.project['canvas']['width']==4096 and app.session.project['drawings'][app.session.drawing_id()]['pixels'][y4*4096+x4]==app.color and app.session.project['originals']['source']['pixels'].region_bytes()==raw4
            own_image('tk-4K-fit-corrected.png');checks['actual4k_fit_photo_samples_alpha_exact']=True
            path4=output/'4K-current.aaa'
            with patch('hosts.standalone.app.filedialog.asksaveasfilename',return_value=str(path4)):app.save_project()
            checks['4k_save_reopen_preserves_live_schema_and_source']=Session.load(path4).project==app.session.project
            for geometry in ['1100x760','900x680']:
                root.geometry(geometry);root.update();app.render();root.update()
                page=app.tools.nametowidget(app.tools.tabs()[0]);app.tools.select(0);root.update()
                rows=[]
                for child in page.winfo_children():
                    rows.append(dict(widget=str(child),mapped=bool(child.winfo_ismapped()),height=child.winfo_height(),required=child.winfo_reqheight(),bottom=child.winfo_y()+child.winfo_height(),parent_height=page.winfo_height()))
                layouts.append(dict(geometry=geometry,children=rows))
                assert all(r['mapped'] and r['height']>=r['required'] and r['bottom']<=r['parent_height'] for r in rows),layouts[-1]
            checks['HD_control_and_drawing_page_fit_default_and_minimum_layout']=True
            assert all(checks.values()),checks
        names=['engine/project.py','engine/packed_model.py','engine/packed_render.py','engine/io/project_archive.py','engine/io/png_codec.py','engine/jobs.py','hosts/standalone/session.py','hosts/standalone/app.py','hosts/standalone/live_packed_smoke.py']
        report=dict(status='passed',count=len(checks),checks=checks,times=times,layouts=layouts,credits_snapshot_sha256=app.credits_data['snapshot_sha256'],source_sha256={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in names},scope='Own real Tk widgets/events/image writer, synthetic HD/4K RGBA inputs; chooser/discard replies stubbed.100 native HD strokes and1native4Kstroke, real separate worker and actual Cancel control. Fit reset/controller and setup explicitly scoped. No OS input/external editor/artist effort or hardware-device acceptance. Timings from this run only, not calibrated benchmarks.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks),times=times)))
    except BaseException as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,times=times,layouts=layouts,error=str(error)),indent=2),encoding='utf-8');raise
    finally:
        app.cancel();root.destroy()
