"""Own-control integration of layered ORA, complete project and edited artwork."""
import base64
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import socket
import struct
import tkinter as tk
from unittest.mock import patch
import zipfile
import zlib

from engine.project import fingerprint
from engine.io.png_codec import SIGNATURE,chunk,read_png,encode_png
from hosts.standalone.app import App,ROOT
from hosts.standalone.session import Session,demo


def run(output):
    output.mkdir(parents=True,exist_ok=False)
    checks={}
    root=tk.Tk()
    root.report_callback_exception=lambda *e:(_ for _ in ()).throw(AssertionError(str(e)))
    app=App(root)
    try:
        with patch.object(socket,'socket',side_effect=AssertionError('No network allowed')):
            root.update()
            app.credits_button.invoke(); root.update()
            checks['offline_ora_png_method_credits']=app.credits_window.winfo_viewable()==1 and {'REF-ORA-LAYOUT','REF-ORA-STACK','REF-ORA-SELECTION','REF-PNG','REF-COMPOSITING'}<={r['source_id'] for r,u in app.shown}
            assert all(checks.values()),checks
            app.close_credits()
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:
                shutil.copyfile(ROOT/'generated'/name,output/name)
            project=demo()
            project['layers']['originals']={'name':'Retained originals','nodetype':'grouplayer','visible':False,'order':1}
            project['layers']['source-copy']={'name':'Original source','parent_id':'originals','order':0}
            project['exposures'].append({'layer_id':'source-copy','drawing_id':'source','start':0,'length':12})
            app.replace_session(Session(project)); root.update()
            app.session.correct({0:[10,20,30,111]})
            app.session.hold(5)
            app.session.slot=5
            app.refresh(); root.update()
            app.session.save(output/'before-export.aaa.json')
            expected=deepcopy(app.session.project)
            with patch('hosts.standalone.app.filedialog.askdirectory',return_value=str(output)):
                app.layered_export_button.invoke()
            target=next(output.glob('layered-*'))
            manifest=json.loads((target/'animation.json').read_text())
            checks['layered_export_controls_preserve_nonuniform_schedule']=[(e['start'],e['length']) for e in manifest['exposures']]==[(0,5),(5,7)]
            app.replace_session(Session())
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(target/'project.ora')):
                app.ora_import_button.invoke()
            root.update()
            checks['ora_button_restores_exact_complete_project']=app.session.project==expected
            checks['active_drawing_and_slot_restored']=app.session.layer_id=='ink' and app.session.slot==5
            checks['hidden_group_and_locked_correction_preserved']=not app.session.project['layers']['originals']['visible'] and app.session.project['drawings'][app.session.project['exposures'][0]['drawing_id']]['locked']
            with zipfile.ZipFile(target/'project.ora') as archive:
                entries={n:archive.read(n) for n in archive.namelist()}
            filename=next(n for n in entries if n.startswith('data/'))
            w,h,pixels=read_png(entries[filename]); pixels[0]=[200,100,50,37]
            entries[filename]=encode_png(w,h,pixels)
            edited=output/'externally-edited.ora'
            with zipfile.ZipFile(edited,'w') as archive:
                for name,data in entries.items():
                    archive.writestr(name,data)
            before=fingerprint(app.session.project)
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(edited)),patch('hosts.standalone.app.messagebox.askyesno',return_value=False):
                app.ora_import_button.invoke()
            checks['declining_external_edit_conversion_preserves_document']=fingerprint(app.session.project)==before
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(edited)),patch('hosts.standalone.app.messagebox.askyesno',return_value=True):
                app.ora_import_button.invoke()
            root.update()
            current=app.session.project
            first=next(iter(current['drawings'].values()))
            checks['explicit_external_edit_import_keeps_changed_pixels']=first['pixels'][0]==[200,100,50,37]
            checks['stale_timing_history_not_silently_restored']=current['shot']['duration_frames']==1 and current['history']==[]
            checks['full_external_file_kept']=base64.b64decode(current['ora_source']['archive_base64'])==edited.read_bytes()
            app.session.save(output/'external-artwork.aaa.json')
            checks['artwork_only_project_reopens_exactly']=Session.load(output/'external-artwork.aaa.json').project==current
            app.replace_session(Session())
            rgb=SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',2,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes([0,10,20,30,40,50,60])))+chunk(b'IEND',b'')
            rgb_path=output/'rgb-input.png'; rgb_path.write_bytes(rgb)
            with patch('hosts.standalone.app.filedialog.askopenfilename',return_value=str(rgb_path)):
                app.import_png()
            root.update()
            checks['rgb_input_control_expands_samples_losslessly']=app.session.project['drawings']['source']['pixels']==[[10,20,30,255],[40,50,60,255]]
            checks['exact_original_png_bytes_kept']=base64.b64decode(app.session.project['png_source']['encoded_base64'])==rgb
            assert all(checks.values()),checks
            report={'status':'passed','checks':checks,'count':len(checks),'credits_snapshot_sha256':app.credits_data['snapshot_sha256'],'source_sha256':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['engine/io/openraster.py','engine/io/png_codec.py','engine/layers.py','hosts/standalone/app.py','hosts/standalone/session.py','hosts/standalone/ora_smoke.py']},'scope':'Own native Tk controls/events; file chooser and explicit decision responses stubbed; original synthetic artwork, no external editor or physical-device/artist-quality claim'}
            (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
            print(json.dumps(report,indent=2))
    except Exception as error:
        (output/'failure.json').write_text(json.dumps({'status':'failed','checks':checks,'error':str(error)},indent=2),encoding='utf-8')
        raise
    finally:
        root.destroy()
