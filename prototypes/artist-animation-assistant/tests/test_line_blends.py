from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import unittest,tempfile,json,importlib.util
import numpy as np
from engine import blend_policies as policies,field_transport as transport,learned_motion as learned
from engine.line_quality import dilate,measure
from engine.io.project_archive import PixelPlane
from engine.spatial_constraints import uniform
from engine.project import fingerprint
from tests.test_joint_motion import fixture
from tests.test_learned_motion import fake,settings
from hosts.standalone.session import Session
ROOT=Path(__file__).resolve().parents[1]

class LineBlendTests(unittest.TestCase):
    def test_default_transport_matches_frozen_preincrement_implementation_exactly(self):
        name='frozen_pre_blend_transport';spec=importlib.util.spec_from_file_location(name,ROOT/'experiments/EXP-0041-line-blending-quality/before/engine/field_transport.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old);p,_=fixture();first=[p['drawings'][l+'0']['pixels'] for l in ['ink','color']];second=[p['drawings'][l+'6']['pixels'] for l in ['ink','color']];masks=[uniform(64,48)]*2;f=fake(np.zeros((3,48,64),np.float32),np.zeros((3,48,64),np.float32),.5,lambda:None);f['weight']=np.linspace(0,1,48*64,dtype=np.float32).reshape(48,64)
        for opacity in ([255,255],[127,0]):self.assertEqual(transport.transport(first,second,masks,masks,opacity,f),old.transport(first,second,masks,masks,opacity,f))
    def test_explicit_weight_policies_match_scalar_oracle_and_do_not_mutate_input(self):
        w=np.linspace(0,1,64,dtype=np.float32).reshape(1,64);before=w.copy();out=policies.apply_weight(w,'sharpen4');expected=np.array([[float(x)**4/(float(x)**4+(1-float(x))**4) for x in w[0]]],np.float32);np.testing.assert_allclose(out,expected,rtol=2e-6,atol=1e-7);self.assertTrue(np.all(np.diff(out[0])>=0));self.assertEqual(float(out[0,0]),0);self.assertEqual(float(out[0,-1]),1);np.testing.assert_array_equal(w,before);self.assertIs(policies.apply_weight(w,None),w);self.assertEqual(float(policies.apply_weight(np.array([[.5]],np.float32),'hard')[0,0]),1)
        for invalid in ['unknown',[],True]:
            with self.assertRaises(ValueError):policies.apply_weight(w,invalid)
        for invalid in [w.astype(float),np.full((1,1),np.nan,np.float32),np.zeros((65,1),np.float32)]:
            with self.assertRaises(ValueError):policies.apply_weight(invalid,'hard')
    def test_shared_hard_policy_selects_coherent_complete_layer_stack(self):
        p,_=fixture();first=[p['drawings'][l+'0']['pixels'] for l in ['ink','color']];second=[p['drawings'][l+'6']['pixels'] for l in ['ink','color']];f=dict(flow0=np.zeros((2,48,64),np.float32),flow1=np.zeros((2,48,64),np.float32),weight=np.full((48,64),.6,np.float32));m=[uniform(64,48)]*2
        for policy,expected in [('hard',first),('source0',first),('source1',second)]:
            r=transport.transport(first,second,m,m,[255,255],f,blend_policy=policy);self.assertEqual([o['pixels'] for o in r['outputs']],expected);self.assertEqual(r['metrics']['blend_policy'],policy)
    def test_protected_erase_and_conflict_loss_guards_are_retained_for_all_policies(self):
        pixels=uniform(32,32).with_edits({500:[33,66,99,0]});other=uniform(32,32);mask=uniform(32,32).with_edits({500:[1,0,0,0]});zero=uniform(32,32);f=dict(flow0=np.zeros((2,32,32),np.float32),flow1=np.zeros((2,32,32),np.float32),weight=np.full((32,32),.25,np.float32))
        for policy in policies.POLICIES:
            r=transport.transport([pixels],[other],[mask],[zero],[255],f,blend_policy=policy);out=r['outputs'][0];self.assertEqual(out['pixels'][500],[33,66,99,0]);self.assertEqual(out['protected_mask'][500][0],1);self.assertFalse(out['unsafe_reasons']);conflict=transport.transport([pixels],[other],[mask],[mask],[255],f,blend_policy=policy);self.assertIn('source_target_protected_rgba_conflict',conflict['outputs'][0]['unsafe_reasons'])
    def test_sharper_selection_does_not_fix_wrong_line_geometry_counterexample(self):
        a=uniform(32,32).with_edits({y*32+10:[0,0,0,255] for y in range(32)});b=uniform(32,32).with_edits({y*32+14:[0,0,0,255] for y in range(32)});target=np.zeros((32,32,4),np.uint8);target[:,12]=[0,0,0,255];m=uniform(32,32);f=dict(flow0=np.zeros((2,32,32),np.float32),flow1=np.zeros((2,32,32),np.float32),weight=np.full((32,32),.5,np.float32))
        for policy in [None,'hard','sharpen4','source0','source1']:
            r=transport.transport([a],[b],[m],[m],[255],f,blend_policy=policy);pred=np.frombuffer(r['outputs'][0]['pixels'].region_bytes(),np.uint8).reshape(32,32,4);self.assertEqual(measure(pred,target,tolerance=0)['dark_f1'],0)
    def test_variants_are_unapproved_editable_and_public_default_accept_refuses_them(self):
        p,_=fixture();s=settings(p);before=fingerprint(p)
        with patch('engine.rife_fields.infer',fake):
            for policy in policies.POLICIES:
                r=learned._propose(p,s,runner=fake,blend_policy=policy);self.assertEqual(r['model_metadata']['research_blend_policy'],policy);q=learned._install_fresh(p,r,'study-'+policy,False);self.assertTrue(all(q['drawings'][i]['approved'] is False for i in set(q['drawings'])-set(p['drawings'])))
                with self.assertRaisesRegex(ValueError,'differs'):learned.accept(p,r,'cannot-accept-implicit-policy')
        self.assertEqual(fingerprint(p),before)
    def test_dilation_and_tolerant_counts_match_independent_coordinate_oracle(self):
        mask=np.zeros((7,8),bool);mask[0,0]=True;mask[3,4]=True
        for radius in range(3):
            expected=np.array([[any(mask[yy,xx] and max(abs(yy-y),abs(xx-x))<=radius for yy in range(7) for xx in range(8)) for x in range(8)] for y in range(7)],bool);np.testing.assert_array_equal(dilate(mask,radius),expected)
        a=np.zeros((7,8,4),np.uint8);b=a.copy();a[3,3]=[0,0,0,255];b[3,4]=[0,0,0,255];self.assertEqual(measure(a,b,tolerance=0)['dark_f1'],0);self.assertEqual(measure(a,b,tolerance=1)['dark_f1'],1);self.assertEqual(measure(a,b,tolerance=1)['dark_iou'],0)
    def test_metric_hidden_rgb_alpha_white_composite_and_blank_cases(self):
        a=np.zeros((2,2,4),np.uint8);b=a.copy();a[0,0,:3]=[33,66,99];self.assertEqual(measure(a,b)['white_rgb_mae'],0);self.assertEqual(measure(a,b)['dark_f1'],1);a[0,0]=[0,0,0,128];b[0,0]=[255,255,255,255];r=measure(a,b,tolerance=0);self.assertAlmostEqual(r['white_rgb_mae'],128/4);self.assertEqual(r['dark_f1'],0);self.assertEqual(r['predicted_dark_pixels'],1)
    def test_private_cli_reuses_one_field_evaluation_and_preserves_originals(self):
        from scripts.study_line_blends import study
        p,_=fixture();s=dict(request=settings(p),reference_slot=3,crops=dict(detail=[8,8,40,36]));calls=[]
        def infer(a,b,t,checkpoint):calls.append(1);return fake(a,b,t,checkpoint)
        with tempfile.TemporaryDirectory() as td,patch('engine.rife_fields.infer',infer):
            folder=Path(td);source=folder/'source.aaa';Session(p).save(source);before=source.read_bytes();config=folder/'settings.json';config.write_text(json.dumps(s));out=folder/'review';report=study(source,config,out);self.assertEqual(len(calls),1);self.assertEqual(report['model_evaluations'],1);self.assertEqual(len(report['rows']),5);self.assertFalse(report['accepted']);self.assertFalse(report['default_changed']);self.assertEqual(source.read_bytes(),before);self.assertEqual(len({tuple(sorted(row['model_fields_sha256'].items())) for row in report['rows']}),1)
            for row in report['rows']:
                self.assertTrue(row['exact_reopen']);view=Session.load(out/row['project']).project;self.assertEqual(view['originals'],p['originals']);self.assertTrue(all(view['drawings'][i]['approved'] is False for i in set(view['drawings'])-set(p['drawings'])))
            with np.load(out/'shared-fields.npz',allow_pickle=False) as fields:self.assertEqual(set(fields.files),{'flow0','flow1','weight'})
            with self.assertRaisesRegex(ValueError,'NEW'):study(source,config,out)
    def test_cancellation_and_invalid_policy_leave_sources_unchanged(self):
        p,_=fixture();s=settings(p);initial=fingerprint(p)
        def cancel():raise RuntimeError('cancelled')
        with self.assertRaisesRegex(RuntimeError,'cancelled'):learned._propose(p,s,checkpoint=cancel,runner=fake,blend_policy='hard')
        with patch('engine.rife_fields.infer',side_effect=AssertionError('Invalid policy must not infer')):
            with self.assertRaises(ValueError):learned._propose(p,s,blend_policy='unknown')
        self.assertEqual(fingerprint(p),initial)
    def test_reserved_crop_name_refuses_before_model_work_or_output_creation(self):
        from scripts.study_line_blends import study
        p,_=fixture()
        with tempfile.TemporaryDirectory() as td,patch('engine.rife_fields.infer',side_effect=AssertionError('Invalid crop must not infer')):
            folder=Path(td);source=folder/'source.aaa';Session(p).save(source);config=folder/'settings.json';config.write_text(json.dumps(dict(request=settings(p),reference_slot=3,crops={'full':[0,0,32,32]})));output=folder/'invalid'
            with self.assertRaisesRegex(ValueError,'reserved'):study(source,config,output)
            self.assertFalse(output.exists())

if __name__=='__main__':unittest.main()
