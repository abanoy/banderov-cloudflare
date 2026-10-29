"""Own native multi-region/palette workflow on original diagnostic geometry."""
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
from engine.layers import render
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session


def run(output):
    output.mkdir(parents=True,exist_ok=False)
    root=tk.Tk();root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root);checks={};layout=[]
    def click(x,y):
        x=app.origin[0]+x*app.zoom+app.zoom//2;y=app.origin[1]+y*app.zoom+app.zoom//2
        app.canvas.event_generate('<Button-1>',x=x,y=y);app.canvas.event_generate('<ButtonRelease-1>',x=x,y=y);root.update()
    def wait():
        deadline=time.monotonic()+15
        while app.preview is None and time.monotonic()<deadline:root.update();time.sleep(.01)
        root.update();assert app.preview is not None,app.status.get()
        assert app.process.returncode==0,app.status.get()
    def select_layer(identity):app.session.layer_id=identity;app.layer_tree.selection_set(identity);root.update()
    def pixels():
        path=output/'temporary-native-image.png'
        app.photo.subsample(app.zoom).write(str(path),format='png')
        return read_png(path.read_bytes())[2]
    def current(identity):
        region=app.session.project['fill_regions'][identity]
        e=next(e for e in app.session.project['exposures'] if e['layer_id']==region['fill_layer'] and e['start']==region['start'])
        return app.session.project['drawings'][e['drawing_id']]
    try:
        with patch.object(socket,'socket',side_effect=AssertionError('No network allowed')):
            root.update();app.credits_button.invoke();root.update()
            checks['offline_palette_primary_credits_before_processing']={'REF-PALETTE-DOCKER','REF-COLORIZE-MASK','REF-PYTHON-COPY','REF-COMPOSITING'}<={s['source_id'] for s,u in app.shown}
            assert all(checks.values()),checks
            app.close_credits()
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:shutil.copyfile(ROOT/'generated'/name,output/name)
            app.tools.select(4);root.update()
            for geometry in ['1100x760','900x680']:
                root.geometry(geometry);root.update();page=app.palette_accept_button.master
                children=[dict(text=w.cget('text') if 'text' in w.keys() else str(w),mapped=bool(w.winfo_ismapped()),bottom=w.winfo_y()+w.winfo_height(),height=w.winfo_height(),required_height=w.winfo_reqheight(),page_height=page.winfo_height()) for w in page.winfo_children()]
                layout.append(dict(geometry=geometry,children=children))
                assert all(w['mapped'] and w['bottom']<=w['page_height'] and w['height']>=w['required_height'] for w in children),layout
            checks['complete_palette_controls_fit_default_and_minimum_window']=True
            app.regions_demo_button.invoke();root.update()
            source=deepcopy(app.session.project['drawings']['source']);originals=deepcopy(app.session.project['originals'])
            click(5,5);app.fill_generate_button.invoke();wait();app.fill_accept_button.invoke();root.update()
            r1=next(iter(app.session.project['fill_regions']))
            ids=[r1]
            for seed,palette,color in [([15,5],'shared',[80,155,220,255]),([24,5],'independent',[210,120,40,255])]:
                app.tools.select(4);root.update();app.region_tree.selection_set(r1)
                app.add_region_button.invoke();root.update()
                assert app.fill_new_region and app.session.layer_id==app.session.project['fill_regions'][r1]['ink_layer']
                app.fill_palette.set(palette);app.color=color[:];click(*seed)
                app.fill_generate_button.invoke();wait()
                before_pixels=pixels();app.fill_accept_button.invoke();root.update()
                assert pixels()==before_pixels,'Shared-ink preview did not match accepted stacking'
                ids=[*app.session.project['fill_regions']]
            r1,r2,r3=ids
            checks['three_regions_share_one_ink_group']=len(app.session.project['layers'])==6 and len({r['ink_layer'] for r in app.session.project['fill_regions'].values()})==1 and sum(l.get('nodetype')=='grouplayer' for l in app.session.project['layers'].values())==1
            checks['additional_region_preview_matches_accepted_alpha_and_priority']=True
            checks['shared_ink_adjacency_proxy_recorded']=any(r['adjacent_proxy'] for r in app.session.project['region_relations'])
            checks['source_and_originals_unchanged_after_regions']=app.session.project['drawings']['source']==source and app.session.project['originals']==originals
            select_layer(app.session.project['fill_regions'][r1]['fill_layer'])
            app.canvas_action.set('Paint');app.color=[230,20,60,255];click(5,5)
            app.erase.set(True);click(6,5);app.erase.set(False)
            correction=deepcopy(current(r1));assert correction['protected_pixels']==[165,166]
            app.tools.select(4);root.update()
            app.palette_choice.set('shared');app.load_palette_color()
            with patch('hosts.standalone.app.colorchooser.askcolor',return_value=((5,200,120),'#05c878')):app.choose_palette_color()
            app.palette_alpha.set('128');before=deepcopy(app.session.project)
            app.palette_recolor_button.invoke()
            # Actual ink correction is independent of a mask-only palette edit.
            ink_layer=app.session.project['fill_regions'][r1]['ink_layer']
            select_layer(ink_layer);app.canvas_action.set('Paint');app.color=[140,70,10,255];click(0,0)
            ink_correction=app.session.drawing_id();wait()
            checks['palette_worker_scope_survives_independent_ink_edit']=app.preview_current() and app.palette_preview is not None
            image=pixels()
            checks['native_palette_preview_changes_both_bound_regions']=image[5*32+7]==[5,200,120,128] and image[5*32+15]==[5,200,120,128]
            checks['native_palette_preview_preserves_overrides_and_erasure']=image[165]==[230,20,60,255] and image[166]==[0,0,0,0]
            checks['native_palette_preview_preserves_independent_region']=image[5*32+24]==[210,120,40,255]
            checks['native_palette_preview_keeps_independent_ink_correction']=image[0]==[140,70,10,255]
            evidence=output/'palette-worker-evidence';evidence.mkdir()
            for name in ['job.json','input.json','result.json','worker.log']:shutil.copyfile(app.job/name,evidence/name)
            app.photo.subsample(app.zoom).write(str(output/'tk-palette-preview.png'),format='png')
            app.palette_details_button.focus_set();app.palette_details_button.invoke();root.update()
            details=app.proposal_details_text.get('1.0','end')
            checks['complete_offline_palette_review_details_available']='Palette-wide recolor' in details and 'artist-protected pixels' in details and 'RGBA: [5, 200, 120, 128]' in details
            app.proposal_details_window.event_generate('<Escape>');root.update()
            checks['review_escape_returns_focus']=root.focus_get()==app.palette_details_button
            before_accept=deepcopy(app.session.project)
            app.palette_alpha.set('127');app.palette_accept_button.invoke();root.update()
            checks['changed_palette_controls_cannot_accept_old_preview']=app.session.project==before_accept and 'regenerate' in app.status.get()
            app.palette_alpha.set('128');app.palette_accept_button.invoke();root.update()
            checks['palette_accept_keeps_layer_graph_source_and_correction_versions']=app.session.project['layers']==before_accept['layers'] and app.session.project['drawings']['source']==source and app.session.project['drawings'][ink_correction]==before_accept['drawings'][ink_correction]
            checks['palette_accept_updates_identity_value_and_both_regions']=app.session.project['palettes']['shared']['rgba']==[5,200,120,128] and current(r2)['pixels'][175]==[5,200,120,128]
            before_rebind=deepcopy(app.session.project)
            app.region_tree.selection_set(r2);app.palette_choice.set('independent');app.palette_rebind_button.invoke();wait();app.palette_accept_button.invoke();root.update()
            checks['selected_rebind_changes_only_selected_region']=app.session.project['fill_regions'][r2]['palette_id']=='independent' and current(r2)['pixels'][175]==[210,120,40,255] and current(r1)['pixels']==before_rebind['drawings'][before_rebind['fill_regions'][r1]['fill_drawing']]['pixels']
            checks['rebind_does_not_recolor_existing_palette_entries']=app.session.project['palettes']==before_rebind['palettes']
            app.palette_choice.set('shared');app.load_palette_color();app.palette_alpha.set('0')
            app.palette_recolor_button.invoke();wait();app.palette_accept_button.invoke();root.update()
            checks['transparent_assignment_retains_mask_and_artist_constraints']=current(r1)['pixels'][167][3]==0 and current(r1)['pixels'][165]==[230,20,60,255] and current(r1)['pixels'][166]==[0,0,0,0] and bool(app.session.project['fill_regions'][r1]['covered'])
            cleared=deepcopy(app.session.project)
            app.history(True);root.update();checks['palette_edit_is_one_action_undo']=current(r1)['pixels'][167][3]==128
            app.history(False);root.update();checks['palette_edit_redo_restores_transparent_assignment']=current(r1)['pixels'][167][3]==0
            select_layer(app.session.project['fill_regions'][r1]['fill_layer']);app.edit_region_button.invoke();root.update()
            app.fill_generate_button.invoke();wait()
            checks['transparent_palette_region_still_supports_boundary_revision']=app.fill_preview['settings']['color'][3]==0 and app.fill_preview['protected_pixels']==[165,166]
            app.reject()
            path=output/'palette-roundtrip.aaa.json';app.session.save(path)
            checks['palette_project_roundtrip_exact']=Session.load(path).project==app.session.project
            write_ora(app.session.project,output/'palette-roundtrip.ora',selected_layer=app.session.layer_id)
            checks['palette_masks_relations_and_constraints_roundtrip_ORA']=import_ora(output/'palette-roundtrip.ora')['project']==app.session.project
            assert all(checks.values()),checks
            names=['engine/regions.py','engine/fill.py','engine/fill_revision.py','engine/jobs.py','hosts/standalone/session.py','hosts/standalone/app.py','hosts/standalone/palette_smoke.py']
            report=dict(status='passed',checks=checks,count=len(checks),credits_snapshot_sha256=app.credits_data['snapshot_sha256'],source_sha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in names},layout=layout,scope='Original synthetic compartments; own Tk controls/events and separate local worker; color-picker response stubbed. No OS input, external editor, semantic segmentation, representative artist quality/effort or screen-reader claim')
            (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
            print(json.dumps(dict(status='passed',checks=len(checks))))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,error=str(error),layout=layout),indent=2),encoding='utf-8')
        raise
    finally:
        app.cancel()
        if app.process and app.process.poll() is None:app.process.wait(timeout=10)
        if app.job_log:app.job_log.close()
        root.destroy()
