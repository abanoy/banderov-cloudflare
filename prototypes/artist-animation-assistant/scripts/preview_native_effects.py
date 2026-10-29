"""Explicit headless native-effect study on a NEW private copy; no host UI."""
from pathlib import Path
import argparse,json,sys,time,hashlib
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))

def main():
    p=argparse.ArgumentParser();p.add_argument('project',nargs='?',type=Path);p.add_argument('output',nargs='?',type=Path);p.add_argument('--slot',type=int,default=0);p.add_argument('--credits',action='store_true');a=p.parse_args()
    if a.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if a.project is None or a.output is None:p.error('Supply packed native window and NEW private output folder')
    if a.output.exists():raise ValueError('Output exists; preserve earlier results')
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT)
    import numpy as np
    from hosts.standalone.session import Session
    from engine.native_effects import compile_styles,render
    from engine.packed_render import render as raw_render,png_bytes
    from engine.io.png_codec import read_png
    from engine.project import fingerprint
    started=time.perf_counter();s=Session.load(a.project);before=fingerprint(s.project);params=s.project.get('native_effects') or compile_styles(s.project)
    w,h,rgba=render(s.project,a.slot,params);styled=np.frombuffer(rgba,np.uint8).reshape(h,w,4);assert fingerprint(s.project)==before
    raw=np.frombuffer(raw_render(s.project,a.slot)[2],np.uint8).reshape(h,w,4)
    report=dict(status='experimental-native-effects-preview',seconds=time.perf_counter()-started,window_slot=a.slot,native_time=s.project['native_window_source']['native_start']+a.slot,effect_layer_count=len(params['layers']),effect_count=sum(len(x) for x in params['layers'].values()),originals_unchanged=True,host_renderer='Default host renderer remains RAW; use this explicit preview command for attached editable effect parameters',credits_snapshot=credits['snapshot_sha256'],warnings=['Independent experimental native rendering; cached parity not presumed. No masks/gradients/nonlinear contours/noise/spread/style scale support.'])
    cached=s.project['native_window_source'].get('cached_projection');native_time=report['native_time']
    def metrics(x,y):
        xi=x.astype(np.int32);yi=y.astype(np.int32);premul_x=xi[:,:,:3]*xi[:,:,3:4];premul_y=yi[:,:,:3]*yi[:,:,3:4]
        return dict(exact_rgba_different_pixels=int(np.any(x!=y,axis=2).sum()),visible_different_pixels=int((np.any(premul_x!=premul_y,axis=2)|(xi[:,:,3]!=yi[:,:,3])).sum()),mean_absolute_rgb_error=float(np.abs(xi[:,:,:3]-yi[:,:,:3]).mean()),max_channel_error=int(np.abs(xi-yi).max()),mean_absolute_premultiplied_rgb_error=float(np.abs(premul_x-premul_y).mean()/255))
    reference=None
    if cached and s.project['native_window_source']['cached_projection_native_time']==native_time:
        cw,ch,plane=read_png(cached.data,packed=True)
        if (cw,ch)!=(w,h):raise ValueError('Native cached reference dimensions differ')
        reference=np.frombuffer(plane.region_bytes(),np.uint8).reshape(h,w,4);report['raw_vs_cached']=metrics(raw,reference);report['effects_vs_cached']=metrics(styled,reference)
    a.output.mkdir(parents=True,exist_ok=False);(a.output/'effects.png').write_bytes(png_bytes(w,h,rgba));(a.output/'raw.png').write_bytes(png_bytes(w,h,raw.tobytes()))
    for name,pixels in [('effects',styled),('raw',raw),('native-cached',reference)]:
        if pixels is not None:
            thumb=pixels[np.arange(360)*h//360][:,np.arange(640)*w//640];(a.output/(name+'-preview.png')).write_bytes(png_bytes(640,360,thumb.tobytes()))
    s.set_native_effects(params);s.save(a.output/'editable-effects.aaa');reopened=Session.load(a.output/'editable-effects.aaa');assert reopened.project==s.project
    report['parameters_roundtrip_exact']=True;report['source_manifest_unchanged']=s.project['native_window_source']['manifest_sha256']==reopened.project['native_window_source']['manifest_sha256']
    (a.output/'parameters.json').write_text(json.dumps(params,indent=2)+'\n',encoding='utf-8')
    for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:(a.output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    manifest=dict(schema_version='1.0',run_id=a.output.name,operation='explicit-experimental-native-effects-preview',input_project_revision=s.project['revision']-1,input_project_fingerprint=before,source_native_manifest=s.project['native_window_source']['manifest_sha256'],native_time=report['native_time'],parameters_sha256=fingerprint(params),credits_snapshot=credits['snapshot_sha256'],source_ids=next(u['source_ids'] for u in credits['uses'] if u['use_id']=='USE-NATIVE-EFFECTS'),component_ids=['COMP-PYTHON-3-13-1','COMP-NUMPY-2-4-1'],outputs_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in a.output.iterdir() if p.suffix in {'.png','.aaa','.json'}},execution=dict(target='local',network_allowed=False),status='experimental-review-only',requires_artist_review=True)
    runpath=a.output/'provenance/runs';runpath.mkdir(parents=True);(runpath/'effects-preview.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    (a.output/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))

if __name__=='__main__':main()
