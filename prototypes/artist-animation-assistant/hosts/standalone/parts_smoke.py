"""Own mask/edit/review/constraint controls; not OS automation or artist acceptance."""
from copy import deepcopy
import json,shutil,time,tkinter as tk
from types import SimpleNamespace
from engine.layers import render
from engine.jobs import read
from engine.raster_parts import accept
from engine.io.png_codec import read_png
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session
from hosts.standalone.motion_fixtures import fixture


def run(output,packed=True):
    output.mkdir(parents=True,exist_ok=False);root=tk.Tk();app=App(root);checks={};layouts=[]
    root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    def wait():
        deadline=time.monotonic()+50;ticks=0
        while app.process and app.process.poll() is None and time.monotonic()<deadline:root.update();ticks+=1;time.sleep(.005)
        assert app.process and app.process.poll() is not None,'worker timeout';root.update();app.poll_job();root.update();assert app.process.returncode==0,app.status.get();return ticks
    def evidence(name):
        folder=output/name;folder.mkdir()
        for fn in ['job.json','input.json','result.json','worker.log']:shutil.copyfile(app.job/fn,folder/fn)
    def capture(name):
        path=output/name;photo=app.photo if packed else app.photo.subsample(int(app.zoom));photo.write(str(path),format='png');return read_png(path.read_bytes())[2]
    def leaves(widget):
        for child in widget.winfo_children():
            if child.winfo_children():yield from leaves(child)
            else:yield child
    try:
        root.update();app.open_credits();root.update();checks['mask_group_primary_sources_visible_before_processing']={'REF-KRITA-TRANSPARENCY-MASK','REF-FRITE-GROUP-WORKFLOW','REF-TRANSIENT-EMBEDDINGS-ABSTRACT'}<={s['source_id'] for s,u in app.shown};app.close_credits()
        for fn in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/fn,output/fn)
        source=fixture(packed);app.replace_session(Session(source));root.update();app.tools.select(1);app.motion_button.invoke();root.update();app.motion_panel.parts_button.invoke();root.update();panel=app.part_panel
        for size in ['1100x840','1000x800']:
            panel.window.geometry(size);root.update();data=[]
            for b in leaves(panel.window):
                if b.winfo_class() not in {'TButton','TEntry','TCombobox','TCheckbutton'}:continue
                data.append(dict(type=b.winfo_class(),mapped=bool(b.winfo_ismapped()),left=b.winfo_rootx()-panel.window.winfo_rootx(),right=b.winfo_rootx()+b.winfo_width()-panel.window.winfo_rootx(),bottom=b.winfo_rooty()+b.winfo_height()-panel.window.winfo_rooty(),height=b.winfo_height(),required=b.winfo_reqheight()))
            layouts.append(dict(size=size,controls=data));assert all(d['mapped'] and d['left']>=0 and d['right']<=panel.window.winfo_width() and d['bottom']<=panel.window.winfo_height() and d['height']>=d['required'] for d in data),layouts[-1]
        checks['all_part_controls_fit_both_window_sizes']=True
        panel.radius.set('2');canvas=panel.canvases['source'];box,ow,oh=panel.transforms['source']
        def xy(x,y):return dict(x=round(5+(x+.5-box[0])*ow/(box[2]-box[0])),y=round(5+(y+.5-box[1])*oh/(box[3]-box[1])))
        canvas.event_generate('<Button-1>',**xy(110,30));canvas.event_generate('<B1-Motion>',**xy(114,36));canvas.event_generate('<ButtonRelease-1>',**xy(114,36));root.update();panel.copy_button.invoke();root.update()
        checks['native_continuous_mask_brush_and_copy_leave_artwork_unchanged']=len(panel.masks['source'])>20 and panel.masks['source']==panel.masks['content'] and app.session.project==source
        panel.erase.set(True);canvas.event_generate('<Button-1>',**xy(112,33));canvas.event_generate('<ButtonRelease-1>',**xy(112,33));root.update();panel.erase.set(False);checks['native_mask_erase_is_separate_from_drawing_erasure']=112+33*128 not in panel.masks['source'] and app.session.project['drawings']==source['drawings']
        panel.rectangle.set('98 26 122 64');panel.rect_button.invoke();panel.name.set('Right forearm and hand');panel.part_id.set('hero.right_arm');root.update();before=deepcopy(app.session.project);panel.preview_button.invoke();ticks=wait();assert app.part_preview is not None,app.status.get();evidence('part-worker')
        expected=accept(before,app.part_preview,'oracle');checks['native_worker_preview_does_not_commit_source']=ticks>0 and app.session.project==before
        checks['actual_structural_part_preview_rgba_matches_projection']=capture('tk-part-preview.png')==render(expected,4)
        app.preview_on.set(False);app.render();root.update();checks['part_source_comparison_exact']=capture('tk-part-source.png')==render(before,4);app.preview_on.set(True);app.render();root.update()
        panel.depth.set('back');panel.accept_button.invoke();root.update();checks['changed_part_controls_refuse_old_result']=app.session.project==before and 'controls changed' in app.status.get();panel.depth.set('front');panel.accept_button.invoke();root.update();q=deepcopy(app.session.project);identity=panel.operation_id;record=q['raster_parts'][identity]
        checks['accepted_editable_ink_color_part_retains_original_keys_duration']=record['part_group'] in app.session.project['layers'] and len(record['part_layers'])==2 and q['originals']==source['originals'] and q['shot']==source['shot'] and render(q,0)==render(source,0) and render(q,4)==render(source,0) and render(q,8)==render(source,8)
        path=output/'part.aaa';app.session.save(path);checks['ownership_masks_and_part_structure_roundtrip_exact']=Session.load(path).project==q
        app.history(True);root.update();checks['partition_one_action_undo_restores_original_hierarchy']=app.session.project['layers']==before['layers'] and app.session.project['exposures']==before['exposures'];app.history(False);root.update()
        panel.depth.set('hidden');panel.preview_button.invoke();wait();panel.accept_button.invoke();root.update();q=app.session.project;record=q['raster_parts'][identity];checks['hidden_part_retains_editable_underlying_content']=not q['layers'][record['part_group']]['visible'] and render(q,4)!=render(source,0) and any(p[3] for p in q['drawings'][record['part_drawings']['paint']]['pixels'])
        app.layer_tree.selection_set(record['part_group']);app.select_layer();app.layer_visible.set(False);app.visibility_button.invoke();root.update()
        # Checkbutton invoke toggles its bound variable; set false so invocation shows it.
        if not app.session.project['layers'][record['part_group']]['visible']:app.layer_visible.set(False);app.visibility_button.invoke();root.update()
        checks['actual_layer_visibility_control_recovers_retained_part']=app.session.project['layers'][record['part_group']]['visible'] and render(app.session.project,4)==render(source,0)
        panel.depth.set('front');panel.preview_button.invoke();wait();panel.accept_button.invoke();root.update();record=app.session.project['raster_parts'][identity]
        app.session.slot=4;app.layer_tree.selection_set(record['part_layers']['paint']);app.select_layer();app.canvas_action.set('Paint');app.erase.set(True);root.update();old_x=round(app.origin[0]+113.5*app.zoom);old_y=round(app.origin[1]+36.5*app.zoom);transform=app.packed_transform if packed else (0,0,128,160,app.origin[0],app.origin[1],128*app.zoom,160*app.zoom);x0,y0,x1,y1,px,py,ow,oh=transform;x=int(px+(113.5-x0)*ow/(x1-x0));y=int(py+(36.5-y0)*oh/(y1-y0));mapping=dict(old_origin_math=app.canvas_point(SimpleNamespace(x=old_x,y=old_y)),actual_photo_math=app.canvas_point(SimpleNamespace(x=x,y=y)),actual_transform=transform);(output/'native-pointer-mapping.json').write_text(json.dumps(mapping,indent=2),encoding='utf-8');assert mapping['actual_photo_math']==(113,36);app.canvas.event_generate('<Button-1>',x=x,y=y);app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y);root.update();app.erase.set(False)
        erased=app.session.project['drawings'][app.session.drawing_id()]['pixels'][36*128+113];assert erased[3]==0,app.status.get();before_revision=deepcopy(app.session.project);panel.preview_button.invoke();wait();evidence('revision-worker');old_version=app.session.project['raster_parts'][identity]['version'];panel.accept_button.invoke();root.update();q=app.session.project;record=q['raster_parts'][identity];assert record['version']==old_version+1,app.status.get()
        checks['part_mask_revision_retains_actual_native_artist_erase']=q['drawings'][record['part_drawings']['paint']]['pixels'][36*128+113]==erased and q['originals']==source['originals'] and render(q,8)==render(source,8)
        app.history(True);root.update();checks['revision_one_action_undo_keeps_prior_artist_edit']=app.session.project['drawings']==before_revision['drawings'];app.history(False);root.update();app.session.save(output/'corrected-part.aaa');checks['corrected_part_and_operation_history_reopen_exact']=Session.load(output/'corrected-part.aaa').project==app.session.project
        panel.depth.set('back');before=deepcopy(app.session.project);panel.preview_button.invoke();wait();checks['protected_depth_conflict_is_inspectable']=bool(app.part_preview['unsafe_reasons']) and 'depth_change' in panel.details.get('1.0','end');panel.accept_button.invoke();root.update();checks['protected_depth_conflict_refused_without_document_change']=app.session.project==before and 'Repair' in app.status.get()
        panel.depth.set('front');panel.preview_button.invoke();cancel=app.job;panel.reject_button.invoke();wait();checks['native_part_cancel_no_result_or_document_mutation']=read(cancel/'job.json')['state']=='cancelled' and not(cancel/'result.json').exists() and app.session.project==before
        panel.window.focus_force();root.update();panel.window.event_generate('<Escape>');root.update();checks['escape_closes_part_panel']=not panel.window.winfo_exists()
        assert all(checks.values()),checks
        report=dict(status='passed',schema=app.session.project['schema_version'],count=len(checks),checks=checks,layout=layouts,credits_snapshot_sha256=app.credits_data['snapshot_sha256'],scope='Original scarf-character fixture; own Tk controls/events/image writer, initial controller fixture and separate local worker. Not OS/tablet/external editor/screen-reader/artist-task acceptance or semantic occlusion inference.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        try:app.session.save(output/'failure-current.aaa')
        except Exception:pass
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,layout=layouts,error=str(error)),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
