"""Own native controls and event invariants on an original authored scarf."""
from pathlib import Path
from copy import deepcopy
import json,time,socket,shutil,tkinter as tk
from unittest.mock import patch
from engine.packed_render import render
from engine.io.png_codec import read_png
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session
from hosts.standalone.schedule_fixtures import fixture


def run(out):
    out.mkdir(exist_ok=False);root=tk.Tk();app=App(root);checks={};layouts=[]
    root.report_callback_exception=lambda *args:(_ for _ in ()).throw(AssertionError(str(args)))
    def leaves(w):
        for child in w.winfo_children():
            if child.winfo_children():yield from leaves(child)
            else:yield child
    def capture(panel,key):
        path=out/(key+'.png');panel.photos[key].write(str(path),format='png');w,h,pixels=read_png(path.read_bytes());return w,h,bytes(v for px in pixels for v in px)
    try:
        with patch.object(socket,'socket',side_effect=AssertionError('Offline check')):
            root.update();app.credits_button.invoke();root.update();checks['offline_credits_before_processing']=bool(app.shown) and any(s['source_id']=='REF-KRITA-TIMELINE' for s,u in app.shown);app.close_credits()
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/name,out/name)
            p=fixture();app.replace_session(Session(p));root.update();app.schedule_button.invoke();root.update();parent=app.schedules_panel;parent.holds_button.invoke();root.update();panel=parent.timing_panel;checks['actor_hold_editor_opens']=panel.actor=='actor' and bool(panel.info['boundaries'])
            for size in ['860x650','820x620']:
                panel.window.geometry(size);root.update();rows=[]
                for widget in leaves(panel.window):
                    if widget.winfo_class() not in ['TButton','TCombobox','TSpinbox','Text','TScale']:continue
                    rows.append(dict(kind=widget.winfo_class(),left=widget.winfo_rootx()-panel.window.winfo_rootx(),right=widget.winfo_rootx()+widget.winfo_width()-panel.window.winfo_rootx(),bottom=widget.winfo_rooty()+widget.winfo_height()-panel.window.winfo_rooty(),mapped=bool(widget.winfo_ismapped())))
                layouts.append(dict(size=size,controls=rows));assert all(row['mapped'] and row['left']>=0 and row['right']<=panel.window.winfo_width() and row['bottom']<=panel.window.winfo_height() for row in rows),layouts[-1]
            checks['controls_fit_both_sizes']=True;before=deepcopy(app.session.project)
            panel.cut.set('12');panel.selection();panel.target.set('13');panel.preview_button.invoke();root.update();checks['event_conflict_explains_and_preserves_document']='Required extension hold' in app.status.get() and app.session.project==before and panel.result is None
            panel.cut.set('6');panel.selection();panel.target.set('7');panel.preview_button.invoke();root.update();r=panel.result
            checks['preview_is_uncommitted_and_synchronized']=r is not None and app.session.project==before and r['layers']==['ink','paint']
            from engine.schedules import preview
            q=preview(p,r,'manual_hold');checks['actual_paired_tk_pixels_match_current_and_preview']=capture(panel,'current')==render(p,6,(128,160)) and capture(panel,'proposed')==render(q,6,(128,160))
            panel.play_button.invoke();deadline=time.monotonic()+1.1
            while time.monotonic()<deadline:root.update();time.sleep(.002)
            panel.play_button.invoke();frames=deepcopy(panel.frames);checks['readonly_normal_speed_full_cycle_playback']=len(frames)>=5 and {0,12,20}<=set(f['slot'] for f in frames) and all(f['slot']==(6+int(f['elapsed']*24))%24 for f in frames) and app.session.project==before
            panel.target.set('5');panel.accept_button.invoke();root.update();checks['changed_control_refuses_old_preview']=app.session.project==before and 'changed' in app.status.get();panel.target.set('7');panel.accept_button.invoke();root.update();accepted=deepcopy(app.session.project)
            checks['explicit_accept_preserves_keys_events_duration_all_drawings']=accepted['revision']>before['revision'] and accepted['exposures']!=before['exposures'] and accepted['drawings']==before['drawings'] and accepted['originals']==before['originals'] and accepted['shot']==before['shot'] and all(render(accepted,t,(128,160))==render(before,t,(128,160)) for t in [0,12,13,14,15,20,23])
            app.history(True);root.update();checks['one_undo_restores_exposures']=app.session.project['exposures']==before['exposures'];app.history(False);root.update();checks['redo_restores_edit']=app.session.project['exposures']==accepted['exposures']
            path=out/'edited-holds.aaa';app.session.save(path);checks['editable_project_reopens_exactly']=Session.load(path).project==app.session.project
            panel.reload_button.invoke();panel.cut.set('8');panel.selection();panel.event.set(next(label for label,slot in panel.event_slots.items() if slot==12));panel.snap_button.invoke();checks['explicit_event_boundary_snap_copies_slot_only']=panel.target.get()=='12' and app.session.project['exposures']==accepted['exposures']
            panel.target.set('9');panel.preview_button.invoke();root.update();panel.discard_button.invoke();root.update();checks['discard_keeps_document']=panel.result is None and app.session.project['exposures']==accepted['exposures']
            panel.window.focus_force();root.update();panel.window.event_generate('<Escape>');root.update();checks['escape_stops_player_and_returns_focus']=not panel.window.winfo_exists() and panel.timer is None and root.focus_get()==parent.holds_button
            assert all(checks.values()),checks
            (out/'playback-clock.json').write_text(json.dumps(frames,indent=2),encoding='utf-8');(out/'report.json').write_text(json.dumps(dict(status='passed',count=len(checks),checks=checks,layout=layouts,credits_snapshot=app.credits_data['snapshot_sha256'],scope='Own Tk/controller/events/images and original synthetic scarf; no OS/tablet/screen-reader or artist timing usefulness claim.'),indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (out/'failure.json').write_text(json.dumps(dict(checks=checks,layout=layouts,error=str(error)),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        if getattr(app,'schedules_panel',None) and app.schedules_panel.window.winfo_exists():app.schedules_panel.close()
        root.destroy()
