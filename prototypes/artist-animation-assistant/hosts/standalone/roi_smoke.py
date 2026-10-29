"""Own Tk controls, off-origin diagnostic HD assistance; no OS automation."""
from copy import deepcopy
import hashlib,json,shutil,time,tkinter as tk
from unittest.mock import patch
from engine.spatial_constraints import uniform
from engine.project import create,fingerprint
from engine.roi_assistance import accept_fill_roi,patch as patch_plane
from engine.jobs import read
from engine.packed_render import render
from engine.io.png_codec import read_png
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session


def diagnostic():
    w,h=1920,1080;edits={}
    for x0,x1 in [(650,690),(715,755)]:
        for y in range(350,395):
            for x in range(x0,x1):
                if x in {x0,x1-1} or y in {350,394}:edits[y*w+x]=[25,35,45,255]
    for x in range(650,750):
        for y in range(420+[0,1,0,-1][x%4],423+[0,1,0,-1][x%4]):edits[y*w+x]=[65,95,155,210]
    plane=uniform(w,h).with_edits(edits);p=create(plane,w,h,12)
    p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=4),dict(layer_id='ink',drawing_id='source',start=4,length=8)]
    return p


def run(output):
    output.mkdir(parents=True,exist_ok=False);root=tk.Tk();root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root);checks={};layouts=[]
    def wait():
        deadline=time.monotonic()+30;ticks=0
        while app.process and app.process.poll() is None and time.monotonic()<deadline:root.update();ticks+=1;time.sleep(.005)
        assert app.process and app.process.poll() is not None,'worker timeout'
        root.update();app.poll_job();root.update();assert app.process.returncode==0,app.status.get();assert app.preview is not None,app.status.get();return ticks
    def event(name,x,y):
        xx,yy=round(app.origin[0]+(x+.5)*app.zoom),round(app.origin[1]+(y+.5)*app.zoom)
        app.canvas.event_generate(name,x=xx,y=yy)
    def click(x,y):event('<Button-1>',x,y);event('<ButtonRelease-1>',x,y);root.update()
    def select(roi):
        app.fill_selection_button.invoke();root.update();event('<Button-1>',roi[0],roi[1]);event('<B1-Motion>',roi[2]-1,roi[3]-1);event('<ButtonRelease-1>',roi[2]-1,roi[3]-1);root.update()
    def image(name,project,overrides=None):
        path=output/name;app.photo.write(str(path),format='png');x0,y0,x1,y1,px,py,ow,oh=app.packed_transform
        assert read_png(path.read_bytes(),packed=True)[2].region_bytes()==render(project,app.session.slot,(ow,oh),(x0,y0,x1,y1),overrides or {})[2]
    def layout(label,page):
        data=[dict(text=w.cget('text') if 'text' in w.keys() else str(w),mapped=bool(w.winfo_ismapped()),bottom=w.winfo_y()+w.winfo_height(),height=w.winfo_height(),required=w.winfo_reqheight(),page_height=page.winfo_height()) for w in page.winfo_children()]
        layouts.append(dict(label=label,children=data));assert all(w['mapped'] and w['height']>=w['required'] and w['bottom']<=w['page_height'] for w in data),layouts
    def save_worker(label):
        destination=output/label;destination.mkdir()
        for name in ['job.json','input.json','result.json','worker.log']:shutil.copyfile(app.job/name,destination/name)
    try:
        root.update();app.credits_button.invoke();root.update()
        checks['new_primary_references_visible_before_roi_processing']={'REF-KRITA-SELECTIONS','REF-KRITA-FILL-SELECTION'}<={s['source_id'] for s,u in app.shown}
        app.close_credits()
        for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/name,output/name)
        for size in ['1100x760','900x680']:
            root.geometry(size);root.update()
            for tab,button in [(3,app.fill_accept_button),(5,app.cleanup_accept_button)]:app.tools.select(tab);root.update();layout(size+' tab'+str(tab),button.master)
        checks['fill_cleanup_controls_fit_both_window_sizes']=True
        with patch('hosts.standalone.app.messagebox.askyesno',return_value=True):
            source=diagnostic();app.replace_session(Session(source));root.geometry('1100x760');root.update();app.view_factor=4;app.view_pan=(150,100);app.render();root.update()
            roi=[640,340,705,405];select(roi)
            actual=[int(v.get()) for v in app.cleanup_roi]
            # Source-scale sampling can round a screen pixel; always record actual.
            checks['native_shared_rectangle_selects_off_origin_without_paint']=abs(actual[0]-roi[0])<=1 and abs(actual[3]-roi[3])<=1 and app.session.project==source
            app.canvas_action.set('Fill seed');app.color=[80,140,220,255];app.fill_palette.set('blue');click(670,370)
            app.fill_generate_button.invoke();ticks=wait();job=read(app.job/'job.json')
            checks['roi_fill_separate_worker_preview_only']=ticks>0 and app.session.project==source and job['roi']==actual and bool(app.fill_preview.get('adapter'))
            preview,_=accept_fill_roi(source,app.fill_preview,'ink',0,'expected-preview');image('tk-HD-fill-preview.png',preview)
            checks['actual_native_fill_preview_composites_editable_siblings_exactly']=True
            app.preview_on.set(False);app.render();root.update();image('tk-HD-source-comparison.png',source)
            checks['native_source_comparison_exact']=True
            app.preview_on.set(True);app.render();root.update();app.open_proposal_details();root.update()
            checks['review_discloses_context_edges_and_sources']='sampled context' in app.proposal_details_text.get('1.0','end') and 'REF-KRITA-FILL-SELECTION' in app.proposal_details_text.get('1.0','end')
            app.proposal_details_window.event_generate('<Escape>');root.update()
            old=app.cleanup_roi[0].get();app.cleanup_roi[0].set(str(int(old)+1));app.fill_accept_button.invoke();root.update()
            checks['changed_roi_refuses_old_result']=app.session.project==source and 'Selection changed' in app.status.get()
            app.cleanup_roi[0].set(old);save_worker('fill-worker');app.fill_accept_button.invoke();root.update();accepted=deepcopy(app.session.project)
            checks['accepted_fill_retains_sources_originals_other_holds']=accepted['originals']==source['originals'] and accepted['drawings']['source']==source['drawings']['source'] and render(accepted,4)[2]==render(source,4)[2]
            identity=next(iter(accepted['fill_regions']));region=accepted['fill_regions'][identity]
            path=output/'roi-fill.aaa';app.session.save(path);checks['typed_region_masks_reopen_exactly']=Session.load(path).project==accepted
            app.history(True);root.update();checks['fill_one_action_undo_restores_source']=app.session.project['drawings']==source['drawings'] and app.session.drawing_id()=='source'
            app.history(False);root.update();checks['fill_redo_restores_regions']=app.session.project['fill_regions']==accepted['fill_regions']
            # Explicit correction and revision through own controls.
            app.layer_tree.selection_set(region['fill_layer']);app.select_layer();root.update();app.canvas_action.set('Paint');app.erase.set(True);click(670,370);app.erase.set(False)
            assert app.session.project['drawings'][app.session.drawing_id()]['pixels'][370*1920+670][3]==0,app.status.get()
            corrected_id=app.session.drawing_id();corrected=deepcopy(app.session.project)
            app.layer_tree.selection_set(region['fill_layer']);app.edit_region_button.invoke();root.update();app.fill_generate_button.invoke();wait();save_worker('revision-worker');app.fill_accept_button.invoke();root.update()
            checks['native_revision_reuses_region_and_preserves_erase']=len(app.session.project['fill_regions'])==1 and app.session.drawing_id()!=corrected_id and app.session.project['drawings'][app.session.drawing_id()]['pixels'][370*1920+670][3]==0
            # Palette recolor uses the authoritative accepted mask and exact erase.
            app.tools.select(4);app.palette_choice.set('blue');app.palette_rgb=[230,50,90];app.palette_alpha.set('0');app.palette_recolor_button.invoke();wait()
            overrides={app.session.project['fill_regions'][i]['fill_layer']:v['pixels'] for i,v in app.palette_preview['updates'].items()};image('tk-HD-palette-transparent-preview.png',app.session.project,overrides)
            checks['native_packed_palette_preview_exact']=True
            save_worker('palette-worker');app.palette_accept_button.invoke();root.update();app.session.save(output/'roi-transparent.aaa')
            checks['native_transparent_palette_keeps_identity_masks']=app.session.project['palettes']['blue']['rgba'][3]==0 and app.session.project['fill_regions'][identity]['covered_mask']==accepted['fill_regions'][identity]['covered_mask']
            # Fresh original same synthetic source for local contour cleanup.
            app.replace_session(Session(source));root.update();app.view_factor=4;app.view_pan=(150,100);app.render();root.update();app.tools.select(5);root.update()
            for variable,value in zip(app.cleanup_roi,[640,408,765,438]):variable.set(str(value))
            app.cleanup_generate_button.invoke();wait();checks['native_packed_cleanup_has_actual_changes']=app.cleanup_preview['metrics']['changed_pixels']>0
            image('tk-HD-cleanup-preview.png',source,{'ink':app.cleanup_preview['pixels']});checks['native_cleanup_pixels_exact']=True
            app.cleanup_paths_on.set(True);app.render();root.update();checks['large_world_centerlines_overlay_visible']=any(app.canvas.type(i)=='line' for i in app.canvas.find_all())
            app.cleanup_paths_on.set(False);save_worker('cleanup-worker');app.cleanup_accept_button.invoke();root.update();app.session.save(output/'roi-cleanup.aaa')
            checks['native_cleanup_accepts_new_version_keeps_source']=app.session.drawing_id()!='source' and app.session.project['originals']==source['originals'] and app.session.project['drawings']['source']==source['drawings']['source']
            app.history(True);root.update();checks['cleanup_one_action_undo_restores_source']=app.session.drawing_id()=='source'
            app.cleanup_reset_button.invoke();root.update()
            for variable,value in zip(app.cleanup_roi,[640,408,765,438]):variable.set(str(value))
            old_job=app.job;app.cleanup_generate_button.invoke();cancelled=app.job;assert cancelled!=old_job,app.status.get();app.cancel()
            deadline=time.monotonic()+20
            while app.process.poll() is None and time.monotonic()<deadline:root.update();time.sleep(.005)
            root.update();checks['native_roi_cancel_has_no_result']=app.process.returncode==0 and read(cancelled/'job.json')['state']=='cancelled' and not(cancelled/'result.json').exists()
        assert all(checks.values()),checks
        report=dict(status='passed',checks=checks,count=len(checks),credits_snapshot_sha256=app.credits_data['snapshot_sha256'],layout=layouts,scope='Original synthetic HD raster; own Tk widgets/events/image writer and separate local worker. Controller-scoped initial data/view. No OS/tablet/external editor/artist task usefulness or semantics claim.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error),layout=layouts),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
