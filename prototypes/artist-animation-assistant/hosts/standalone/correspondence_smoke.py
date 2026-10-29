"""Own native image-candidate review and motion handoff; no OS automation."""
from copy import deepcopy
import json,shutil,time,tkinter as tk
from engine.jobs import read
from engine.layers import render
from engine.io.png_codec import read_png
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session
from hosts.standalone.correspondence_fixtures import fixture


def run(output):
    output.mkdir(parents=True,exist_ok=False);root=tk.Tk();app=App(root);checks={};layouts=[]
    root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    def wait():
        deadline=time.monotonic()+40;ticks=0
        while app.process and app.process.poll() is None and time.monotonic()<deadline:root.update();ticks+=1;time.sleep(.005)
        assert app.process and app.process.poll() is not None,'worker timeout';root.update();app.poll_job();root.update();assert app.process.returncode==0,app.status.get();return ticks
    def evidence(name):
        folder=output/name;folder.mkdir()
        for fn in ['job.json','input.json','result.json','worker.log']:shutil.copyfile(app.job/fn,folder/fn)
    def leaves(widget):
        for child in widget.winfo_children():
            if child.winfo_children():yield from leaves(child)
            else:yield child
    try:
        root.update();app.open_credits();root.update();checks['primary_template_and_candidate_sources_visible_before_processing']={'REF-TEMPLATE-MATCH','REF-LAYERINBETWEEN-README','REF-LAYERINBETWEEN-LICENSE'}<={s['source_id'] for s,u in app.shown};app.close_credits()
        for fn in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/fn,output/fn)
        source=fixture();app.replace_session(Session(source));root.update();app.tools.select(1);app.motion_button.invoke();root.update();motion=app.motion_panel;motion.match_button.invoke();root.update();panel=app.matching_panel
        for size in ['1000x620','900x600']:
            panel.window.geometry(size);root.update();data=[]
            for b in leaves(panel.window):
                if b.winfo_class() not in {'TButton','TEntry','TCombobox','TCheckbutton'}:continue
                data.append(dict(type=b.winfo_class(),mapped=bool(b.winfo_ismapped()),left=b.winfo_rootx()-panel.window.winfo_rootx(),right=b.winfo_rootx()+b.winfo_width()-panel.window.winfo_rootx(),bottom=b.winfo_rooty()+b.winfo_height()-panel.window.winfo_rooty(),height=b.winfo_height(),required=b.winfo_reqheight()))
            layouts.append(dict(size=size,controls=data));assert all(d['mapped'] and d['left']>=0 and d['right']<=panel.window.winfo_width() and d['bottom']<=panel.window.winfo_height() and d['height']>=d['required'] for d in data),layouts[-1]
        checks['candidate_controls_fit_both_window_sizes']=True
        before=deepcopy(app.session.project);panel.generate_button.invoke();ticks=wait();assert panel.result is not None,app.status.get();evidence('image-worker')
        checks['separate_image_worker_leaves_guide_pixels_keys_unchanged']=ticks>0 and app.session.project==before and panel.result['rows'][0]['alternatives'][0]['target']==[37.5,35.5] and app.preview is None
        panel.tree.selection_set('pattern');panel.tree.event_generate('<<TreeviewSelect>>');root.update();checks['actual_selected_candidate_overlay_and_review_details']='pattern' in panel.details.get('1.0','end') and any(motion.canvases['target'].itemcget(i,'text')=='candidate' for i in motion.canvases['target'].find_all() if motion.canvases['target'].type(i)=='text')
        panel.clear_button.invoke();root.update();checks['queue_does_not_silently_adopt_targets']=app.session.project==before and panel.decisions['pattern']['decision']=='accept'
        panel.max_error.set('.3');panel.apply_button.invoke();root.update();checks['changed_match_controls_refuse_old_review']=app.session.project==before and 'controls' in app.status.get();panel.max_error.set('.2')
        panel.apply_button.invoke();root.update();accepted=deepcopy(app.session.project)
        checks['explicit_review_updates_guide_only_and_keeps_provenance']=accepted['motion_guides']['patch']['handles'][0]['target']==[37.5,35.5] and accepted['drawings']==source['drawings'] and accepted['exposures']==source['exposures'] and accepted['originals']==source['originals'] and bool(accepted['correspondence_operations'][0]['proposal']['inputs'])
        path=output/'image-matches.aaa';app.session.save(path);checks['match_candidates_decisions_hashes_roundtrip_exactly']=Session.load(path).project==accepted
        app.history(True);root.update();checks['review_one_action_undo_restores_prior_guide']=app.session.project['motion_guides']==before['motion_guides'];app.history(False);root.update();motion.load_guide()
        panel.generate_button.invoke();wait();panel.tree.selection_set('pattern');panel.select();panel.reject_button.invoke();app.poll_job();root.update();assert panel.decisions.get('pattern',{}).get('decision')=='reject','Repeated completed-job polling erased pending review';prior=deepcopy(app.session.project);panel.apply_button.invoke();root.update();rejected=deepcopy(app.session.project)
        checks['rejected_candidate_retained_without_drawing_or_positive_guide_changes']=rejected['drawings']==prior['drawings'] and rejected['motion_guides']==prior['motion_guides'] and rejected['correspondence_reviews']['patch'][-1]['decision']=='reject'
        panel.generate_button.invoke();wait();evidence('rejected-worker');checks['rejected_image_match_not_reproposed_for_same_inputs']=[37.5,35.5] in panel.result['rows'][0]['excluded_targets'] and panel.result['rows'][0]['alternatives'][0]['target']!=[37.5,35.5]
        panel.window.focus_force();root.update();panel.window.event_generate('<Escape>');root.update();checks['candidate_escape_closes_and_returns_to_motion']=not panel.window.winfo_exists()
        motion.start.set('4');motion.end.set('8');motion.preview_button.invoke();wait();assert app.motion_preview is not None,app.status.get()
        # Transition from a real unaccepted motion image into metadata-only matching.
        image=output/'unaccepted-pose.png';app.photo.subsample(app.zoom).write(str(image),format='png');assert read_png(image.read_bytes())[2]!=render(app.session.project,app.session.slot)
        motion.match_button.invoke();root.update();extra=app.matching_panel;extra.generate_button.invoke();root.update();image=output/'matching-transition.png';app.photo.subsample(app.zoom).write(str(image),format='png')
        checks['opening_image_search_clears_unaccepted_motion_ghost']=read_png(image.read_bytes())[2]==render(app.session.project,app.session.slot)
        extra.cancel_button.invoke();wait();extra.close();motion.preview_button.invoke();wait();evidence('motion-worker');motion.accept_button.invoke();root.update();q=app.session.project
        checks['image_corrected_guide_produces_editable_motion_interval']=len(q.get('motion_operations',[]))==1 and render(q,4)!=render(source,0) and render(q,0)==render(source,0) and render(q,8)==render(source,8) and q['originals']==source['originals']
        app.session.save(output/'matched-motion.aaa');checks['motion_handoff_with_image_reviews_reopens_exactly']=Session.load(output/'matched-motion.aaa').project==q
        motion.match_button.invoke();root.update();panel=app.matching_panel;before=deepcopy(app.session.project);panel.generate_button.invoke();cancel=app.job;panel.cancel_button.invoke();wait()
        checks['native_image_worker_cancel_no_result_or_document_change']=app.process.returncode==0 and read(cancel/'job.json')['state']=='cancelled' and not(cancel/'result.json').exists() and app.session.project==before
        assert all(checks.values()),checks
        report=dict(status='passed',count=len(checks),checks=checks,layout=layouts,credits_snapshot_sha256=app.credits_data['snapshot_sha256'],scope='Own Tk widgets/events and original asymmetric texture diagnostic; controller initial fixture, separate local worker, no OS/tablet/external editor/artist usefulness or learned-model execution.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,layout=layouts,error=str(error)),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
