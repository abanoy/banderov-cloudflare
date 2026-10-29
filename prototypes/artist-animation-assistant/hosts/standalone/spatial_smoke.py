"""Own native dense continuous repairs and spatial masks; no OS input automation."""
from copy import deepcopy
import hashlib,json,time,tkinter as tk
from types import SimpleNamespace
from unittest.mock import patch
from engine.io.project_archive import PixelPlane
from engine.project import create,fingerprint
from engine.spatial_constraints import count,indices
from engine.packed_model import json_default
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session


def run(output):
    output.mkdir(parents=True,exist_ok=False);root=tk.Tk();root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root);checks={};timings={};layout=[]
    def event(kind,x,y):app.canvas.event_generate(kind,x=x,y=y)
    def drag(a,b,mid=None):
        event('<Button-1>',*a)
        if mid is not None:event('<B1-Motion>',*mid)
        event('<B1-Motion>',*b);event('<ButtonRelease-1>',*b);root.update()
    try:
        root.geometry('1100x760');root.update();app.open_credits();root.update()
        ids={s['source_id'] for s in app.credits_data['sources']}
        checks['current_brush_runtime_references_visible_before_processing']=app.credits_window.winfo_viewable() and {'REF-KRITA-FREEHAND','REF-NUMPY-2-4-1','REF-PYTHON-DATE'}<=ids
        app.close_credits();root.update()
        with patch('hosts.standalone.app.messagebox.askyesno',return_value=True):
            app.new_hd_button.invoke();root.update();source=app.session.project['originals']['source']['pixels'];source_id=app.session.project['originals_sha256']
            app.brush_radius_control.delete(0,'end');app.brush_radius_control.insert(0,'12');app.color=[30,100,190,255]
            checks['actual_radius_control_changes_brush_setting']=app.brush_radius.get()=='12'
            cx,cy=app.canvas.winfo_width(),app.canvas.winfo_height();started=time.perf_counter()
            first_a=(cx//5,cy//2);first_b=(cx*4//5,cy//2)
            ax,ay=app.canvas_point(SimpleNamespace(x=first_a[0],y=first_a[1]));bx,by=app.canvas_point(SimpleNamespace(x=first_b[0],y=first_b[1]))
            drag(first_a,first_b)
            d=app.session.project['drawings'][app.session.drawing_id()]
            checks['native_sparse_motion_samples_form_continuous_wide_stroke']=all(d['pixels'][ay*1920+x]==app.color for x in range(ax,bx+1)) and d['pixels'][(ay+10)*1920+(ax+bx)//2]==app.color
            checks['wide_stroke_does_not_overpaint_outside_footprint']=d['pixels'][(ay+20)*1920+(ax+bx)//2]==[0,0,0,0]
            checks['spatial_mask_records_dense_touch_without_index_list']=count(d)>20000 and 'protected_mask' in d and 'protected_pixels' not in d
            for i in range(99):
                _,_,_,_,px,py,pw,ph=app.packed_transform
                y=py+10+(i*7)%max(1,ph-20)
                versions=len(app.session.project['drawings'])
                drag((px+pw//5,y),(px+pw*4//5,y))
                assert len(app.session.project['drawings'])==versions+1,dict(gesture=i,transform=app.packed_transform)
            timings['HD100wide_native_strokes_seconds']=time.perf_counter()-started
            d=app.session.project['drawings'][app.session.drawing_id()];dense_count=count(d)
            timings['HD_versions_after_dense_strokes']=len(app.session.project['drawings']);timings['HD_protected_pixels_after_dense_strokes']=dense_count
            timings['HD_metadata_bytes_after_dense_strokes']=len(json.dumps(app.session.project,default=json_default).encode())
            checks['hundred_dense_native_strokes_keep_bounded_metadata']=len(app.session.project['drawings'])==101 and dense_count>700000 and len(json.dumps(app.session.project,default=json_default).encode())<500000
            checks['all_dense_versions_and_originals_remain_exact']=app.session.project['originals_sha256']==source_id and source[0]==[0,0,0,0] and all('protected_mask' in v for k,v in app.session.project['drawings'].items() if k!='source')
            # Touch an already transparent location outside the dense bands.
            app.brush_radius.set('0');app.erase.set(True);x0,y0,x1,y1,ox,oy,ow,oh=app.packed_transform
            point=(ox+4,oy+4);sx,sy=app.canvas_point(SimpleNamespace(x=point[0],y=point[1]));before=count(d)
            drag(point,point);new=app.session.project['drawings'][app.session.drawing_id()]
            checks['already_transparent_native_erase_still_protects_intent']=count(new)==before+1 and new['pixels'][sy*1920+sx]==[0,0,0,0]
            app.history(True);checks['undo_restores_previous_spatial_mask']=count(app.session.project['drawings'][app.session.drawing_id()])==before
            app.history(False);checks['redo_restores_same_color_and_erase_touch_mask']=count(app.session.project['drawings'][app.session.drawing_id()])==before+1
            p=output/'dense-HD.aaa'
            with patch('hosts.standalone.app.filedialog.asksaveasfilename',return_value=str(p)):app.save_project()
            expected=deepcopy(app.session.project)
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(p)):app.open_project()
            checks['native_dense_save_open_preserves_masks_and_versions']=app.session.project==expected
            before=fingerprint(app.session.project);app.brush_radius.set('invalid');drag(point,point)
            checks['invalid_radius_is_visible_and_does_not_edit']=fingerprint(app.session.project)==before and 'brush radius' in app.status.get().lower()
            # Explicitly scoped controller setup; live legacy mode separately tests4KPNG import.
            plane=PixelPlane.from_rgba(4096,4096,bytes([70,120,190,128])*(4096*4096));app.replace_session(Session(create(plane,4096,4096)));root.update()
            app.erase.set(False);app.brush_radius.set('24');app.color=[210,30,110,255];cw,ch=app.canvas.winfo_width(),app.canvas.winfo_height()
            started=time.perf_counter();drag((cw//5,ch//5),(cw*4//5,ch*4//5));timings['4K_wide_diagonal_native_stroke_seconds']=time.perf_counter()-started
            d=app.session.project['drawings'][app.session.drawing_id()]
            checks['native4k_wide_diagonal_has_compact_spatial_constraints']=count(d)>100000 and 'protected_pixels' not in d and plane[0]==[70,120,190,128]
            checks['bounded_region_queries_map_spatial_masks_locally']=len(indices(d,(0,0,32,32),local=True))==0
            app.photo.write(str(output/'tk-4K-dense-stroke.png'),format='png')
            from engine.io.png_codec import read_png
            from engine.packed_render import render
            a,b,c,e,ox,oy,ow,oh=app.packed_transform
            checks['actual_native_dense_preview_alpha_exact']=read_png((output/'tk-4K-dense-stroke.png').read_bytes(),packed=True)[2].region_bytes()==render(app.session.project,0,(ow,oh),(a,b,c,e))[2]
            p4=output/'dense-4K.aaa';app.session.save(p4);checks['4k_dense_masks_reopen_exact']=Session.load(p4).project==app.session.project
            for geometry in ['1100x760','900x680']:
                root.geometry(geometry);app.tools.select(0);root.update();page=app.tools.nametowidget(app.tools.tabs()[0]);rows=[]
                for child in page.winfo_children():rows.append(dict(widget=str(child),mapped=bool(child.winfo_ismapped()),height=child.winfo_height(),required=child.winfo_reqheight(),bottom=child.winfo_y()+child.winfo_height(),parent_height=page.winfo_height()))
                layout.append(dict(geometry=geometry,children=rows));assert all(r['mapped'] and r['height']>=r['required'] and r['bottom']<=r['parent_height'] for r in rows),layout[-1]
            checks['radius_and_drawing_controls_fit_minimum_layout']=True
            assert all(checks.values()),checks
        names=['engine/spatial_constraints.py','engine/paint_stroke.py','hosts/standalone/session.py','hosts/standalone/app.py','hosts/standalone/spatial_smoke.py']
        report=dict(status='passed',count=len(checks),checks=checks,timings=timings,layout=layout,credits_snapshot_sha256=app.credits_data['snapshot_sha256'],source_sha256={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in names},scope='Own Tk actual pointer/brush field/save-open events.100dense HD strokes and1wide4Kdiagonal;4Ksetup uses controller, prior live mode tests actual PNG import. File chooser/discard replies stubbed. No OS input, tablet pressure/artist effort/semantic intent claim; timings from this machine/input only.')
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(dict(status='passed',checks=len(checks),timings=timings)))
    except BaseException as error:
        (output/'failure.json').write_text(json.dumps(dict(status='failed',checks=checks,timings=timings,layout=layout,error=str(error)),indent=2),encoding='utf-8');raise
    finally:app.cancel();root.destroy()
