from pathlib import Path
from copy import deepcopy
import sys,time,json,shutil,socket,tkinter as tk
from unittest.mock import patch
from hosts.standalone.app import App,ROOT as R
from hosts.standalone.session import Session
from hosts.standalone.schedule_fixtures import fixture
from engine.schedules import preview,save_constraints
from engine.packed_render import render
from engine.io.png_codec import read_png
from engine.jobs import read

def run(out):
    out.mkdir(exist_ok=False);root=tk.Tk();app=App(root);checks={};layouts=[]
    root.report_callback_exception=lambda *args:(_ for _ in ()).throw(AssertionError(str(args)))
    def wait():
        end=time.monotonic()+45;ticks=0
        while app.process and app.process.poll() is None and time.monotonic()<end:root.update();ticks+=1;time.sleep(.005)
        assert app.process and app.process.poll() is not None,'schedule worker timeout';root.update();app.poll_job();root.update();assert app.process.returncode==0,app.status.get();return ticks
    def leaves(widget):
        for child in widget.winfo_children():
            if child.winfo_children():yield from leaves(child)
            else:yield child
    def capture(panel,key,name):
        path=out/name;panel.photos[key].write(str(path),format='png');w,h,pixels=read_png(path.read_bytes());return w,h,bytes(v for px in pixels for v in px)
    try:
        with patch.object(socket,'socket',side_effect=AssertionError('Offline test')):
            root.update();app.credits_button.invoke();root.update();checks['new_primary_sources_visible_offline_before_processing']={'REF-KRITA-TIMELINE','REF-OPENTOONZ-LEVEL-EDIT'}<={s['source_id'] for s,u in app.shown};app.close_credits()
            for n in ('credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt'):shutil.copyfile(R/'generated'/n,out/n)
            source=fixture();app.replace_session(Session(source));root.update();app.schedule_button.invoke();root.update();panel=app.schedules_panel;checks['saved_event_identity_loads_without_an_extra_save']=panel.definition()==source['schedule_constraints']['actor']
            for geometry in ('960x820','900x760'):
                panel.window.geometry(geometry);root.update();items=[]
                for widget in leaves(panel.window):
                    if widget.winfo_class() not in ('TButton','TEntry','TCombobox','Text','TScale'):continue
                    items.append(dict(kind=widget.winfo_class(),mapped=bool(widget.winfo_ismapped()),left=widget.winfo_rootx()-panel.window.winfo_rootx(),right=widget.winfo_rootx()+widget.winfo_width()-panel.window.winfo_rootx(),bottom=widget.winfo_rooty()+widget.winfo_height()-panel.window.winfo_rooty(),height=widget.winfo_height(),required=widget.winfo_reqheight()))
                layouts.append(dict(size=geometry,controls=items));assert all(x['mapped'] and x['left']>=0 and x['right']<=panel.window.winfo_width() and x['bottom']<=panel.window.winfo_height() and (x['kind']=='Text' or x['height']>=x['required']) for x in items),layouts[-1]
            checks['all_schedule_controls_fit_both_sizes']=True
            panel.count.set('1');before=deepcopy(app.session.project);panel.generate_button.invoke();wait();checks['infeasible_budget_has_actionable_conflict_not_silent_key_loss']=not panel.result['candidates'] and 'required' in panel.details.get('1.0','end') and app.session.project==before
            panel.count.set('4');panel.generate_button.invoke();ticks=wait();r=panel.result;checks['separate_worker_returns_three_uncommitted_strategies']=ticks>0 and len(r['candidates'])==3 and app.session.project==before
            evidence=out/'worker';evidence.mkdir()
            for n in ('job.json','input.json','result.json','worker.log'):shutil.copyfile(app.job/n,evidence/n)
            checks['actor_states_assets_occurrences_and_zero_new_drawings_are_distinct']=all(c['distinct_actor_states']==4 and c['new_raster_assets']==0 and c['raster_assets_reused']>4 for c in r['candidates'])
            selected=panel.selected();q=preview(app.session.project,r,selected['id']);different=next(slot for slot in range(24) if render(q,slot,(128,160))[2]!=render(source,slot,(128,160))[2]);panel.cursor.set(different);panel.draw();root.update()
            checks['paired_native_images_show_actual_current_and_candidate_pixels']=capture(panel,'current','current.png')==render(source,different,(128,160)) and capture(panel,'proposed','proposed.png')==render(q,different,(128,160))
            panel.play_button.invoke();deadline=time.monotonic()+.58
            while time.monotonic()<deadline:root.update();time.sleep(.002)
            panel.play_button.invoke();frames=deepcopy(panel.frames);(out/'playback-clock.json').write_text(json.dumps(frames,indent=2),encoding='utf-8');checks['normal_speed_playback_uses_elapsed_time_and_keeps_document_readonly']=len(frames)>=5 and len({f['slot'] for f in frames})>=5 and all(f['slot']==(different+int(f['elapsed']*24))%24 for f in frames) and app.session.project==before and panel.timer is None
            panel.count.set('3');panel.accept_button.invoke();root.update();checks['changed_budget_refuses_old_candidate']=app.session.project==before and 'changed' in app.status.get();panel.count.set('4');panel.accept_button.invoke();root.update();accepted=deepcopy(app.session.project)
            checks['explicit_accept_changes_exposures_only_and_retains_keys_events_sources']=accepted['exposures']!=before['exposures'] and accepted['drawings']==before['drawings'] and accepted['originals']==before['originals'] and accepted['shot']==before['shot'] and accepted['schedule_constraints']==before['schedule_constraints'] and all(render(accepted,t,(128,160))==render(before,t,(128,160)) for t in (0,12,13,14,15,20,23))
            path=out/'scheduled.aaa';app.session.save(path);checks['editable_timing_constraints_and_history_reopen_exactly']=Session.load(path).project==accepted
            app.history(True);root.update();checks['one_undo_restores_all_exposures']=app.session.project['exposures']==before['exposures'];app.history(False);root.update();checks['redo_restores_schedule_and_constraints']=app.session.project['exposures']==accepted['exposures'] and app.session.project['schedule_constraints']==accepted['schedule_constraints']
            # A preview against this state becomes stale after an event edit+undo.
            panel.generate_button.invoke();wait();saved=deepcopy(app.session.project['schedule_constraints']['actor']);panel.events.insert('end','\n18 1 reversal Required reversal');panel.save_button.invoke();root.update();app.history(True);root.update();old=deepcopy(app.session.project);panel.events.delete('1.0','end');panel.events.insert('1.0','\n'.join(f"{e['slot']} {e['length']} {e['kind']} {e['label']}" for e in saved['events']));panel.event_ids=[e['id'] for e in saved['events']]
            panel.generate_button.invoke();wait();panel.reject_button.invoke();root.update();rejected=deepcopy(app.session.project);checks['explicit_rejection_keeps_timing_and_records_candidate']=bool(rejected.get('schedule_reviews')) and rejected['exposures']==old['exposures'];panel.generate_button.invoke();wait();checks['same_rejected_schedule_not_offered_as_new']=panel.result['candidates'][0]['previously_rejected']
            panel.generate_button.invoke();job=app.job;panel.cancel_button.invoke();wait();checks['native_cancel_finishes_without_result_or_document_edit']=read(job/'job.json')['state']=='cancelled' and not(job/'result.json').exists() and app.session.project==rejected
            panel.window.focus_force();root.update();panel.window.event_generate('<Escape>');root.update();checks['escape_closes_player_and_cancels_timer']=not panel.window.winfo_exists() and panel.timer is None
            assert all(checks.values()),checks
            report=dict(status='passed',count=len(checks),checks=checks,layout=layouts,playback_observations=len(frames),credits_snapshot_sha256=app.credits_data['snapshot_sha256'],scope='Original dense scarf diagnostic; controller input and own Tk widgets/events/images, actual local worker, elapsed-time playback clock/review/undo/save. No OS input/tablet/spoken screen-reader/artist quality or accepted timing claim.');(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (out/'failure.json').write_text(json.dumps(dict(checks=checks,layout=layouts,error=str(error)),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        if getattr(app,'schedules_panel',None) and app.schedules_panel.window.winfo_exists():app.schedules_panel.stop()
        root.destroy()
if __name__=='__main__':run(Path(sys.argv[1]).resolve())
