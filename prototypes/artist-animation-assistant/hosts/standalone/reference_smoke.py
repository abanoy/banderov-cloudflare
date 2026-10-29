"""Own reference panel controls, separate worker and exact preview/source checks."""
from copy import deepcopy
import json,shutil,time,tkinter as tk
from unittest.mock import patch
from engine.references import image_bytes
from engine.jobs import read
from engine.layers import render
from engine.io.png_codec import read_png
from hosts.standalone.reference_fixtures import fixture,sheet,BOXES,COLORS
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session

def run(output):
    output.mkdir(parents=True,exist_ok=False);root=tk.Tk();root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)));app=App(root);checks={};layouts=[]
    def wait():
        deadline=time.monotonic()+30;ticks=0
        while app.process and app.process.poll() is None and time.monotonic()<deadline:root.update();ticks+=1;time.sleep(.005)
        assert app.process and app.process.poll() is not None,'worker timeout';root.update();app.poll_job();root.update();assert app.process.returncode==0,app.status.get();assert app.preview is not None,app.status.get();return ticks
    def capture(name):
        path=output/name;app.photo.subsample(app.zoom).write(str(path),format='png');return read_png(path.read_bytes())[2]
    def evidence(name):
        folder=output/name;folder.mkdir()
        for fn in ['job.json','input.json','result.json','worker.log']:shutil.copyfile(app.job/fn,folder/fn)
    try:
        root.update();app.open_credits();root.update();checks['reference_primary_sources_visible_before_processing']={'REF-KRITA-REFERENCE-IMAGES','REF-PAINTBUCKET','REF-BASICPBC-LICENSE'}<={s['source_id'] for s,u in app.shown};app.close_credits()
        for fn in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/fn,output/fn)
        source=fixture();app.replace_session(Session(source));root.update();app.tools.select(0);app.references_button.invoke();root.update();panel=app.reference_panel
        input_path=output/'original-diagnostic-sheet.png';input_path.write_bytes(sheet());panel.character.set('hero');panel.view.set('front')
        with patch('hosts.standalone.references_panel.filedialog.askopenfilename',return_value=str(input_path)):panel.import_button.invoke()
        root.update();identity=panel.identity();checks['native_import_embeds_different_sized_reference_exact_source']=image_bytes(app.session.project['references'][identity])==sheet() and app.session.project['references'][identity]['image']['width']==128 and app.session.project['canvas']['width']==64
        panel.crop.set('0 0 64 64')
        for pid,b in BOXES.items():panel.part.set(pid);panel.bbox.set(' '.join(map(str,b)));panel.swatch.set(f'{(b[0]+b[2])//2} {(b[1]+b[3])//2}');panel.save_button.invoke();root.update()
        checks['editable_crop_view_parts_and_project_only_consent']=len(app.session.project['references'][identity]['parts'])==3 and app.session.project['references'][identity]['permissions']==dict(project_use=True,training=False,upload=False)
        panel.part_combo.set('cap');panel.part_combo.event_generate('<<ComboboxSelected>>');root.update()
        checks['existing_part_selection_loads_correct_annotation']=panel.numbers(panel.bbox,4)==BOXES['cap']
        panel.photo.write(str(output/'tk-reference-image.png'),format='png');ref_pixels=read_png((output/'tk-reference-image.png').read_bytes())[2]
        checks['actual_reference_thumbnail_has_sampled_color']=ref_pixels[10*128+28]==COLORS['cap']
        for size in ['1000x740','900x700']:
            panel.window.geometry(size);root.update();data=[]
            for b in [panel.import_button,panel.save_button,panel.archive_button,panel.preview_button,panel.accept_button,panel.correct_button,panel.depth_button]:
                data.append(dict(text=b.cget('text'),mapped=bool(b.winfo_ismapped()),bottom=b.winfo_rooty()+b.winfo_height(),window_bottom=panel.window.winfo_rooty()+panel.window.winfo_height(),height=b.winfo_height(),required=b.winfo_reqheight()))
            assert all(d['mapped'] and d['bottom']<=d['window_bottom'] and d['height']>=d['required'] for d in data),data;layouts.append(dict(size=size,controls=data))
        checks['reference_panel_controls_fit_both_sizes']=True
        panel.region.set(next(label for label,i in panel.region_choices.items() if i=='cap'));checks['artist_region_chooser_uses_layer_names_and_stable_id']=panel.region_id()=='cap' and 'Flat:' in panel.region.get();panel.target_character.set('hero');panel.target_view.set('front');panel.bounds.set('0 0 64 64');panel.override.set('');before=deepcopy(app.session.project);panel.preview_button.invoke();ticks=wait()
        checks['reference_review_uses_artist_facing_labels']='Proposed part: cap' in panel.details.get('1.0','end') and 'Affected fills:' in panel.details.get('1.0','end')
        result=app.reference_preview;updates={app.session.project['fill_regions'][i]['fill_layer']:u['pixels'] for i,u in result['updates'].items()}
        checks['reference_worker_is_separate_and_preview_preserves_document']=ticks>0 and app.session.project==before and result['selected']['part_id']=='cap'
        checks['native_reference_proposal_exact_pixels_alpha']=capture('tk-reference-assignment-preview.png')==render(before,0,updates)
        app.preview_on.set(False);app.render();root.update();checks['reference_source_comparison_exact']=capture('tk-source-comparison.png')==render(before,0);app.preview_on.set(True);app.render();root.update()
        panel.target_view.set('back');panel.accept_button.invoke();root.update();checks['changed_reference_controls_refuse_old_result']=app.session.project==before and 'controls changed' in app.status.get();panel.target_view.set('front')
        evidence('worker');panel.accept_button.invoke();root.update();accepted=deepcopy(app.session.project)
        checks['accepted_part_palette_identity_preserves_source_geometry']=accepted['part_bindings']['cap']['part_id']=='cap' and accepted['originals']==source['originals'] and accepted['fill_regions']['cap']['covered']==source['fill_regions']['cap']['covered']
        path=output/'references.aaa';app.session.save(path);checks['reference_metadata_and_bytes_reopen_exactly']=Session.load(path).project==accepted
        app.history(True);root.update();checks['reference_assignment_one_action_undo_restores_prior_pixels']=app.session.project['drawings']==before['drawings'];app.history(False);root.update()
        # Native artist erase followed by corrected part conditioning.
        target=app.session.project['fill_regions']['cap']['fill_layer'];app.layer_tree.selection_set(target);app.select_layer();root.update();app.canvas_action.set('Paint');app.erase.set(True)
        x=round(app.origin[0]+22.5*app.zoom);y=round(app.origin[1]+8.5*app.zoom);app.canvas.event_generate('<Button-1>',x=x,y=y);app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y);root.update();app.erase.set(False)
        assert app.session.project['drawings'][app.session.drawing_id()]['pixels'][8*64+22][3]==0,app.status.get()
        panel.override.set('coat');panel.correct_button.invoke();root.update();panel.override.set('');panel.preview_button.invoke();wait();evidence('corrected-worker');panel.accept_button.invoke();root.update()
        current=app.session.project;r=current['fill_regions']['cap'];e=next(e for e in current['exposures'] if e['layer_id']==r['fill_layer'] and e['start']==0)
        checks['artist_part_correction_overrides_geometry_and_keeps_erasure']=current['part_bindings']['cap']['part_id']=='coat' and current['part_bindings']['cap']['origin']=='artist_correction' and current['drawings'][e['drawing_id']]['pixels'][8*64+22][3]==0
        checks['corrected_role_leaves_unbound_regions_and_other_holds']=current['drawings'][source['fill_regions']['coat']['fill_drawing']]==source['drawings'][source['fill_regions']['coat']['fill_drawing']] and render(current,4)==render(source,4)
        panel.depth.set('6');panel.depth_button.invoke();root.update();checks['manual_part_depth_updates_explicit_fill_sibling']=app.session.project['layers'][r['fill_layer']]['order']==6
        app.session.save(output/'corrected-references.aaa')
        panel.use.set(False);panel.preview_button.invoke();wait();checks['reference_free_preview_keeps_current_artwork']=not app.reference_preview['updates'] and app.reference_preview['selected'] is None
        panel.accept_button.invoke();root.update();checks['empty_reference_assignment_is_not_silently_accepted']='No reference assignment' in app.status.get()
        panel.use.set(True);panel.preview_button.invoke();cancel=app.job;app.cancel();deadline=time.monotonic()+20
        while app.process.poll() is None and time.monotonic()<deadline:root.update();time.sleep(.005)
        root.update();checks['reference_native_cancel_has_no_result']=app.process.returncode==0 and read(cancel/'job.json')['state']=='cancelled' and not(cancel/'result.json').exists()
        panel.window.focus_force();root.update();panel.window.event_generate('<Escape>');root.update();checks['reference_escape_closes_panel']=not panel.window.winfo_exists()
        assert all(checks.values()),checks
        report=dict(status='passed',checks=checks,count=len(checks),layout=layouts,credits_snapshot_sha256=app.credits_data['snapshot_sha256'],scope='Original abstract three-part diagnostic; own Tk widgets/events/image writer, controller fixture and chooser stub, separate worker. No OS/tablet/external editor or artist task usefulness/model reproduction claim.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error),layout=layouts),indent=2),encoding='utf-8');raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
