"""Own Tk motion controls and source-safe interval revisions, not OS automation."""
from copy import deepcopy
import json,shutil,time,tkinter as tk
from engine.jobs import read
from engine.layers import render
from engine.io.png_codec import read_png
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session
from hosts.standalone.motion_fixtures import fixture


def run(output):
    output.mkdir(parents=True,exist_ok=False);root=tk.Tk();app=App(root);checks={};layouts=[]
    root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    def wait():
        deadline=time.monotonic()+60;ticks=0
        while app.process and app.process.poll() is None and time.monotonic()<deadline:root.update();ticks+=1;time.sleep(.005)
        assert app.process and app.process.poll() is not None,'worker timeout'
        root.update();app.poll_job();root.update();assert app.process.returncode==0,app.status.get();assert app.motion_preview is not None,app.status.get();return ticks
    def evidence(name):
        folder=output/name;folder.mkdir()
        for fn in ['job.json','input.json','result.json','worker.log']:shutil.copyfile(app.job/fn,folder/fn)
    def capture(name):
        path=output/name;app.photo.subsample(app.zoom).write(str(path),format='png');return read_png(path.read_bytes())[2]
    def leaves(widget):
        for child in widget.winfo_children():
            if child.winfo_children():yield from leaves(child)
            else:yield child
    try:
        root.update();app.open_credits();root.update();checks['credited_primary_methods_visible_before_motion']={'REF-MLS-DEFORMATION','REF-KRITA-WARP','REF-NUMPY-NORM'}<={s['source_id'] for s,u in app.shown};app.close_credits()
        for fn in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/fn,output/fn)
        source=fixture();app.replace_session(Session(source));root.update();app.tools.select(1);app.motion_button.invoke();root.update();panel=app.motion_panel
        checks['named_source_and_independent_guide_views']=panel.photos['source'].get(100,100)!=() and panel.image_labels['source'].cget('text').endswith('0') and panel.image_labels['target'].cget('text').endswith('8')
        for size in ['1080x820','960x760']:
            panel.window.geometry(size);root.update();data=[]
            for b in leaves(panel.window):
                if b.winfo_class() not in {'TButton','TEntry','TCombobox','TCheckbutton'}:continue
                data.append(dict(type=b.winfo_class(),mapped=bool(b.winfo_ismapped()),left=b.winfo_rootx()-panel.window.winfo_rootx(),right=b.winfo_rootx()+b.winfo_width()-panel.window.winfo_rootx(),bottom=b.winfo_rooty()+b.winfo_height()-panel.window.winfo_rooty(),height=b.winfo_height(),required=b.winfo_reqheight()))
            layouts.append(dict(size=size,controls=data));assert all(d['mapped'] and d['left']>=0 and d['right']<=panel.window.winfo_width() and d['bottom']<=panel.window.winfo_height() and d['height']>=d['required'] for d in data),layouts[-1]
        checks['all_motion_input_controls_fit_both_sizes']=True
        # Invalid pending point must not poison the unsaved correspondence list.
        before=deepcopy(panel.handles);panel.point_id.set('invalid');panel.source_xy.set('-');panel.target_xy.set('-');panel.pair_button.invoke();root.update();checks['invalid_point_does_not_mutate_pending_guide']=panel.handles==before
        panel.point_id.set('new-visible-detail');panel.source_xy.set('-');panel.target_xy.set('70.5 35.5');panel.pair_button.invoke();panel.save_button.invoke();root.update()
        checks['unmatched_visibility_evidence_is_saved_without_source_edits']=len(app.session.project['motion_guides']['arm-lift']['handles'])==9 and app.session.project['drawings']==source['drawings']
        before=deepcopy(app.session.project);panel.preview_button.invoke();ticks=wait();result=app.motion_preview;evidence('worker')
        checks['worker_separate_document_unchanged_and_visibility_explicit']=ticks>0 and app.session.project==before and len(result['visibility_events'])==1 and not result['unsafe_reasons']
        checks['own_tk_motion_preview_exact_ink_color_alpha']=capture('tk-motion-preview.png')==render(before,0,{layer:r['pixels'] for layer,r in result['outputs'].items()})
        app.preview_on.set(False);app.render();root.update();checks['own_tk_source_comparison_exact']=capture('tk-source.png')==render(before,0);app.preview_on.set(True)
        app.session.slot=8;app.render();root.update();checks['guide_key_never_replaced_by_preview']=capture('tk-guide-key.png')==render(before,8);app.session.slot=0;app.render()
        panel.progress.set('.6');panel.accept_button.invoke();root.update();checks['changed_spatial_controls_refuse_old_result']=app.session.project==before and 'controls' in app.status.get();panel.progress.set('.5')
        t=time.monotonic();panel.accept_button.invoke();root.update();accept_seconds=time.monotonic()-t;accepted=deepcopy(app.session.project)
        checks['editable_two_layer_pose_preserves_original_keys_and_duration']=len(accepted.get('motion_operations',[]))==1 and len(accepted['drawings'])==6 and accepted['originals']==source['originals'] and render(accepted,0)==render(source,0) and render(accepted,8)==render(source,8) and render(accepted,4)!=render(source,0) and accepted['shot']==source['shot']
        path=output/'motion.aaa';app.session.save(path);checks['compact_motion_and_visibility_roundtrip_exact']=Session.load(path).project==accepted
        app.history(True);root.update();checks['acceptance_one_action_undo']=app.session.project['drawings']==before['drawings'] and app.session.project['exposures']==before['exposures'];app.history(False);root.update()
        # Actual native canvas erase on the derived color layer.
        app.session.slot=4;app.layer_tree.selection_set('paint');app.select_layer();app.canvas_action.set('Paint');app.erase.set(True);root.update()
        x=round(app.origin[0]+64.5*app.zoom);y=round(app.origin[1]+80.5*app.zoom)
        app.canvas.event_generate('<Button-1>',x=x,y=y);app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y);root.update();app.erase.set(False)
        erased=app.session.project['drawings'][app.session.drawing_id()]['pixels'][80*128+64];assert erased[3]==0,app.status.get()
        panel.pair_tree.selection_set('hand');panel.select_pair();root.update();old=panel.source_xy.get();view,ow,oh=panel.transforms['target'];cx=5+(108.5-view[0])*ow/(view[2]-view[0]);cy=5+(22.5-view[1])*oh/(view[3]-view[1]);panel.canvases['target'].event_generate('<Button-1>',x=round(cx),y=round(cy));panel.contact.set(False);panel.pair_button.invoke();panel.save_button.invoke();root.update()
        checks['native_corrected_correspondence_retains_rejected_source_hashes']=panel.source_xy.get()==old and len(app.session.project['motion_guides']['arm-lift']['rejected_matches'])==1
        old_job=app.job;panel.preview_button.invoke();assert app.job and app.job!=old_job and app.job.exists(),app.status.get();wait();evidence('corrected-worker');panel.accept_button.invoke();root.update();q=app.session.project;e=next(e for e in q['exposures'] if e['layer_id']=='paint' and e['start']==4)
        checks['regeneration_preserves_artist_erase_and_other_keys']=q['drawings'][e['drawing_id']]['pixels'][80*128+64]==erased and render(q,0)==render(source,0) and render(q,8)==render(source,8) and q['motion_operations'][-1]['revision_number']==1
        app.session.save(output/'corrected-motion.aaa');checks['corrected_matches_and_constraints_reopen_exact']=Session.load(output/'corrected-motion.aaa').project==q
        before=deepcopy(q);panel.preview_button.invoke();cancel=app.job;panel.reject_button.invoke();deadline=time.monotonic()+30
        while app.process.poll() is None and time.monotonic()<deadline:root.update();time.sleep(.005)
        root.update();checks['actual_reject_cancel_retains_document_and_no_result']=app.session.project==before and app.process.returncode==0 and read(cancel/'job.json')['state']=='cancelled' and not(cancel/'result.json').exists()
        panel.window.focus_force();root.update();panel.window.event_generate('<Escape>');root.update();checks['escape_closes_motion_window']=not panel.window.winfo_exists()
        assert all(checks.values()),checks
        report=dict(status='passed',checks=checks,count=len(checks),layout=layouts,accept_seconds=accept_seconds,credits_snapshot_sha256=app.credits_data['snapshot_sha256'],scope='Original scarf-character diagnostic; own Tk widgets/events/image writer, controller initial fixture, separate local worker. No OS/tablet/external editor, learned motion or representative artist usefulness claim.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error),layout=layouts),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
