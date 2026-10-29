from pathlib import Path
from copy import deepcopy
import tempfile,unittest,math
import numpy as np
from engine.native_effects import gaussian,effect_mask,blend,compile_styles,render,validate_parameters
from engine.io.kra_window import KraWindow
from engine.packed_render import render as raw_render
from engine.project import fingerprint
from tests.test_kra_window import fixture,native_tiles
from hosts.standalone.session import Session

def e(kind='shadow',size=0,**kw):
    out=dict(kind=kind,enabled=True,color=[0,0,0],blend='multiply',opacity=100,size=size,anti_alias=True,range=100,offset=[0,0],knockout=False);out.update(kw);return out

def source_with_style(p):
    def typed(v):
        if isinstance(v,bool):return dict(type='bool',value=v)
        if isinstance(v,str):return dict(type='TEXT',value=v)
        if isinstance(v,(float,int)):return dict(type='doub',value=v)
        if isinstance(v,list):return dict(type='VlLs',value=[typed(i) for i in v])
        if set(v)=={'unit','value'}:return dict(type='UntF',value=v)
        if set(v)=={'enum','value'}:return dict(type='enum',value=v)
        return dict(type='Objc',value=dict(name='',class_id='test',items={k:typed(x) for k,x in v.items()}))
    effect={'enab':True,'Md  ':{'enum':'BlnM','value':'Mltp'},'Clr ':{'Rd  ':0.,'Grn ':0.,'Bl  ':0.},'Opct':{'unit':'#Prc','value':100.},'Ckmt':{'unit':'#Pxl','value':0.},'blur':{'unit':'#Pxl','value':4.},'Nose':{'unit':'#Prc','value':0.},'AntA':True,'TrnS':{'Nm  ':'Linear','Crv ':[{'Hrzn':0.,'Vrtc':0.},{'Hrzn':255.,'Vrtc':255.}]},'uglg':True,'lagl':{'unit':'#Ang','value':120.},'Dstn':{'unit':'#Pxl','value':0.},'layerConceals':False}
    source=p['native_window_source'];source['unrendered_style_layers']={'top':'test'}
    source['style_metadata']={'patterns_bytes':0,'styles':[{'identification':typed({'Idnt':'test'})['value'],'style':typed({'Lefx':{'Scl ':{'unit':'#Prc','value':100.},'masterFXSwitch':True,'DrSh':effect}})['value']}]}
    source['manifest_sha256']=fingerprint({k:v for k,v in source.items() if k!='manifest_sha256'})
    return p

class NativeEffectsTests(unittest.TestCase):
    def test_fft_matches_independent_direct_kernel_without_circular_wrap(self):
        rng=np.random.default_rng(1);a=rng.integers(0,256,(7,9),dtype=np.uint8);r=2;s=.3*r+.3;half=3*math.ceil(s);x=np.arange(-half,half+1);k=np.exp(-x*x/(2*s*s));k/=sum(k)
        padded=np.pad(a.astype(float),((half,half),(half,half)));expected=np.empty(a.shape)
        for y in range(a.shape[0]):
            for xx in range(a.shape[1]):expected[y,xx]=np.sum(padded[y:y+len(k),xx:xx+len(k)]*k[:,None]*k[None,:])
        np.testing.assert_array_equal(gaussian(a,r),np.floor(expected+.5))
        a=np.zeros((40,40),np.uint8);a[0,0]=255;b=gaussian(a,4);self.assertGreater(b[0,0],0);self.assertEqual(b[-1,-1],0);self.assertLess(b.sum(),255)
    def test_inner_glow_and_knockout_keep_original_alpha_geometry(self):
        a=np.zeros((21,21),np.uint8);a[7:14,7:14]=255
        inner=effect_mask(a,e('inner_glow',4));self.assertGreater(inner[7,7],inner[10,10])
        outer=effect_mask(a,e('outer_glow',4,knockout=True));self.assertFalse(np.any(outer[a==255]));self.assertGreater(outer[6,10],0)
        shifted=effect_mask(a,e('shadow',0,offset=[3,-2]));self.assertEqual(shifted[5,10],254);self.assertEqual(shifted[13,13],0)
    def test_blend_handles_transparent_color_and_partial_alpha(self):
        b=np.array([[[100,50,20,255],[123,234,9,0]]],np.uint8);s=np.array([[[0,0,0,128],[40,80,120,128]]],np.uint8)
        out=blend(b,s,'multiply');self.assertEqual(out[0,0].tolist(),[50,25,10,255]);self.assertEqual(out[0,1].tolist(),[40,80,120,128]);s[0,0]=[255,255,255,128];out=blend(b,s,'add');self.assertEqual(out[0,0].tolist(),[178,153,138,255])
    def project(self):
        t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);path=Path(t.name)/'source.kra';fixture(path)
        with KraWindow(path) as r:return source_with_style(r.import_window(0,7))
    def test_compile_edit_roundtrip_preserves_source_and_original_pixels(self):
        p=self.project();original=deepcopy(p);params=compile_styles(p);self.assertEqual(params['layers']['top'][0]['size'],4)
        before=render(p,0,params);self.assertEqual(p,original)
        params['layers']['top'][0]['size']=0;changed=render(p,0,params);self.assertNotEqual(changed,before)
        session=Session(p);session.set_native_effects(params);p=session.project
        self.assertTrue(session.travel());self.assertNotIn('native_effects',session.project)
        self.assertTrue(session.travel(False));self.assertEqual(session.project['native_effects'],params)
        p=session.project
        with tempfile.TemporaryDirectory() as t:
            s=Session(p);s.save(Path(t)/'effects.aaa');q=Session.load(Path(t)/'effects.aaa').project;self.assertEqual(q,p);self.assertEqual(render(q,0),changed);self.assertEqual(q['originals'],original['originals']);self.assertEqual(q['native_window_source'],original['native_window_source'])
    def test_no_effects_is_exact_raw_and_offcanvas_native_alpha_contributes(self):
        p=self.project();params=compile_styles(p);params['layers']['top'][0]['enabled']=False;self.assertEqual(render(p,0,params),raw_render(p,0))
        params['layers']['top'][0].update(enabled=True,size=4);a=np.frombuffer(render(p,0,params)[2],np.uint8).reshape(90,130,4);self.assertGreater(a[2,0,3],0)
    def test_unknown_semantics_and_stale_or_invalid_parameters_refuse(self):
        p=self.project();params=compile_styles(p)
        for change in [lambda q:q['layers']['top'][0].update(size=float('nan')),lambda q:q['layers']['top'][0].update(offset=[0]),lambda q:q.update(source_manifest='changed'),lambda q:q['layers']['top'][0].update(blend='screen'),lambda q:q['layers']['top'][0].update(range=50)]:
            q=deepcopy(params);change(q)
            with self.assertRaises(ValueError):validate_parameters(p,q)
        cfg=p['native_window_source']['style_metadata']['styles'][0]['style']['items']['Lefx']['value']['items']['DrSh']['value']['items'];cfg['Nose']['value']['value']=1
        source=p['native_window_source'];source['manifest_sha256']=fingerprint({k:v for k,v in source.items() if k!='manifest_sha256'})
        with self.assertRaises(ValueError):compile_styles(p)
    def test_locked_style_edits_and_bad_saved_metadata_refuse(self):
        p=self.project();p['layers']['top']['locked']=True;s=Session(p);params=compile_styles(p);s.set_native_effects(params)
        changed=deepcopy(params);changed['layers']['top'][0]['opacity']=50
        with self.assertRaisesRegex(ValueError,'locked'):s.set_native_effects(changed)
        p['layers']['top']['locked']=False;p['layers']['group']['locked']=True;s=Session(p);s.set_native_effects(params)
        with self.assertRaisesRegex(ValueError,'locked'):s.set_native_effects(changed)
        p['native_effects']=deepcopy(params);p['native_effects']['version']='unknown'
        with self.assertRaises(ValueError):Session(p)
    def test_parameter_changes_recompute_effects_after_paint_without_source_loss(self):
        p=self.project();s=Session(p);s.set_native_effects(compile_styles(p));before=render(s.project,0);source=deepcopy(s.project['native_window_source']);s.layer_id='top';s.correct({10*130+10:[0,255,0,255]});self.assertNotEqual(render(s.project,0),before);self.assertEqual(s.project['native_window_source'],source);self.assertTrue(s.travel());self.assertEqual(render(s.project,0),before)
    def test_retime_uses_exposed_drawing_offcanvas_and_correction_ancestry(self):
        with tempfile.TemporaryDirectory() as t:
            def mutate(items):items['fixture/layers/top1']=native_tiles({(11,10):[255,0,0,128]})
            path=fixture(Path(t)/'retime.kra',mutate=mutate)
            with KraWindow(path) as reader:p=source_with_style(reader.import_window(0,7))
        p['layers']['bottom']['visible']=False;s=Session(p);s.set_native_effects(compile_styles(p));before=render(s.project,3);s.layer_id='top';s.slot=0;s.hold(5)
        self.assertEqual(render(s.project,4),before)
        s.slot=4;s.correct({10*130+10:[0,255,0,128]});actual=np.frombuffer(render(s.project,4)[2],np.uint8).reshape(90,130,4);old=np.frombuffer(before[2],np.uint8).reshape(90,130,4)
        np.testing.assert_array_equal(actual[2,0],old[2,0]);self.assertGreater(actual[2,0,3],0)
        s.project['drawings'][s.drawing_id()]['parent_drawing']=s.drawing_id()
        with self.assertRaisesRegex(ValueError,'ancestry'):render(s.project,4)
    def test_cancel_during_blur_and_preview_does_not_mutate_project(self):
        p=self.project();original=deepcopy(p)
        def cancel():raise RuntimeError('cancelled')
        with self.assertRaisesRegex(RuntimeError,'cancelled'):render(p,0,checkpoint=cancel)
        with self.assertRaisesRegex(RuntimeError,'cancelled'):gaussian(np.zeros((20,20),np.uint8),4,cancel)
        self.assertEqual(p,original)

if __name__=='__main__':unittest.main()
