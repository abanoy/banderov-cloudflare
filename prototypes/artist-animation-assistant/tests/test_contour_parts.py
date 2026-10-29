import unittest,tempfile
from pathlib import Path
from copy import deepcopy
import numpy as np
from engine import contour_parts as parts


def fixture():
    return dict(id='analytic_aperture',source=dict(x=[12,36,60,84],upper=[32,16,16,32],lower=[32,48,48,32],detail=dict(center=[48,32],radii=[8,16])),guide=dict(x=[12,36,60,84],upper=[32,32,32,32],lower=[32,32,32,32],detail=dict(center=[48,32],radii=[8,16])),fill_rgba=[255,255,255,255],detail_rgba=[0,0,0,255],ink_rgba=[0,0,0,255],ink_width=2)


class ContourPartTests(unittest.TestCase):
    def test_cubic_matches_independent_expanded_polynomial(self):
        p=[2,13,-7,9];t=np.linspace(0,1,33);expected=p[0]*(1-t)**3+3*p[1]*t*(1-t)**2+3*p[2]*t*t*(1-t)+p[3]*t**3
        np.testing.assert_allclose(parts.cubic(p,t),expected,atol=1e-12)

    def test_known_intermediate_geometry_not_nearest_key_or_crossfade(self):
        s=fixture();g=parts.geometry(s,96,64,.5);self.assertEqual(g['upper'],[32,24,24,32]);self.assertEqual(g['lower'],[32,40,40,32]);self.assertEqual(g['detail'],s['source']['detail'])
        for t in np.linspace(0,1,11):
            g=parts.geometry(s,96,64,float(t));u=np.linspace(0,1,101);self.assertTrue(np.all(np.diff(parts.cubic(g['x'],u))>0));self.assertTrue(np.all(parts.cubic(g['upper'],u)<=parts.cubic(g['lower'],u)))

    def test_exact_clipping_counts_against_independent_analytic_oracle(self):
        s=fixture();s['ink_width']=0;r=parts.render(s,96,64,.5);xx=np.arange(384)/4-.375;yy=np.arange(256)/4-.375;yy,xx=np.meshgrid(yy,xx,indexing='ij');t=(xx-12)/72;half=24*t*(1-t);inside=(xx>=12)&(xx<=84)&(yy>32-half)&(yy<32+half);ellipse=((xx-48)/8)**2+((yy-32)/16)**2<=1
        self.assertEqual(r['metrics']['aperture_samples'],int(inside.sum()));self.assertEqual(r['metrics']['visible_detail_samples'],int((inside&ellipse).sum()));self.assertGreater(r['metrics']['clipped_detail_area'],0)
        # Independent per-sample composition compared with reconstructed layers.
        expected_a=inside.reshape(64,4,96,4).mean(axis=(1,3));expected_rgb=(inside&~ellipse).reshape(64,4,96,4).mean(axis=(1,3))
        rgb=np.zeros((64,96,3));alpha=np.zeros((64,96))
        for name in ('fill','detail','ink'):
            a=r['layers'][name].astype(float)/255;rgb=a[:,:,:3]*a[:,:,3:4]+rgb*(1-a[:,:,3:4]);alpha=a[:,:,3]+alpha*(1-a[:,:,3])
        self.assertLess(float(np.max(np.abs(alpha-expected_a))),2/255);self.assertLess(float(np.max(np.abs(rgb-expected_rgb[:,:,None]))),2/255)

    def test_closed_aperture_preserves_detail_and_union_stroke_not_double_alpha(self):
        s=fixture();s['ink_rgba'][3]=128;before=deepcopy(s);r=parts.render(s,96,64,1)
        self.assertEqual(r['metrics']['aperture_samples'],0);self.assertEqual(r['metrics']['visible_detail_samples'],0);self.assertGreater(r['metrics']['unclipped_detail_samples'],0)
        self.assertFalse(r['layers']['fill'].any());self.assertFalse(r['layers']['detail'].any());self.assertEqual(int(r['layers']['ink'][32,48,3]),128);self.assertEqual(s,before)
        reopened=parts.render(s,96,64,0);self.assertGreater(reopened['metrics']['visible_detail_area'],r['metrics']['visible_detail_area'])

    def test_preview_separate_editable_layers_source_and_holds_preserved(self):
        from engine.project import create,fingerprint
        from engine.spatial_constraints import uniform
        from hosts.standalone.session import Session
        from engine.packed_render import render
        p=create(uniform(160,96),160,96,8);before=fingerprint(p);s=fixture();q,r=parts.preview_project(p,s,.5,[32,16,128,80],2,4,'part')
        self.assertEqual(fingerprint(p),before);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['drawings']['source'],p['drawings']['source']);self.assertTrue(all(q['drawings'][i]['approved'] is False for i in set(q['drawings'])-set(p['drawings'])))
        self.assertEqual(len(q['layers'])-len(p['layers']),4)
        for slot in (0,1,4,7):self.assertEqual(render(q,slot),render(p,slot))
        _,_,raw=render(q,2,rectangle=[32,16,128,80]);a=np.frombuffer(raw,np.uint8).reshape(64,96,4);self.assertEqual(a[32,48].tolist(),[0,0,0,255]);self.assertEqual(q['history'][-1]['shape'],s)
        with tempfile.TemporaryDirectory() as td:
            file=Path(td)/'part.aaa';Session(q).save(file);self.assertEqual(Session.load(file).project,q)
        session=Session(q);session.layer_id='part-ink';session.slot=2;session.correct({(16+32)*160+32+48:[33,66,99,0]});self.assertNotEqual(session.project['drawings'],q['drawings']);session.travel();self.assertEqual(session.project['drawings'],q['drawings'])
        with self.assertRaisesRegex(ValueError,'already exists'):parts.preview_project(q,s,.6,[32,16,128,80],2,4,'part')

    def test_validation_refuses_crossing_clipping_missing_correspondence_and_cancel(self):
        for change in ('crossing','xorder','missing','bounds'):
            s=fixture()
            if change=='crossing':s['guide']['upper'][1]=48
            if change=='xorder':s['guide']['x'][2]=35
            if change=='missing':s['guide']['detail']=None
            if change=='bounds':s['source']['x'][0]=0
            with self.assertRaises(ValueError):parts.render(s,96,64,.5)
        for phase in (-.1,float('nan'),True):
            with self.assertRaises(ValueError):parts.render(fixture(),96,64,phase)
        def cancel():raise InterruptedError('cancel')
        with self.assertRaises(InterruptedError):parts.render(fixture(),96,64,.5,cancel)

    def test_study_analytic_truth_and_editable_sequence_not_self_reference(self):
        from scripts.study_contour_parts import study,oracle
        from engine.packed_render import render
        from hosts.standalone.session import Session
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)/'study';r=study(folder);self.assertEqual(r['model_evaluations'],0);self.assertFalse(r['accepted']);self.assertIsNone(r['actual_new_part']);self.assertEqual(len(r['rows']),5)
            mid=r['rows'][2];self.assertGreater(mid['contour']['dark_f1'],mid['crossfade']['dark_f1']);self.assertGreater(mid['contour']['dark_f1'],mid['hold_source']['dark_f1']);self.assertGreater(mid['contour']['dark_f1'],mid['hold_guide']['dark_f1'])
            q=Session.load(folder/'editable-contour-sequence.aaa').project;self.assertEqual(len(q['layers']),5);self.assertEqual(len(q['drawings']),16);self.assertEqual(set(q['drawings']),{e['drawing_id'] for e in q['exposures']})
            self.assertTrue(all(q['drawings'][i]['approved'] is False for i in set(q['drawings'])-{'source'}));self.assertEqual(q['history'][-1]['phases'],[0,.25,.5,.75,1])
            self.assertFalse(np.array_equal(oracle(.5),oracle(0)));self.assertFalse(np.array_equal(oracle(.5),oracle(1)))
            with self.assertRaisesRegex(ValueError,'NEW'):study(folder)


if __name__=='__main__':unittest.main()
