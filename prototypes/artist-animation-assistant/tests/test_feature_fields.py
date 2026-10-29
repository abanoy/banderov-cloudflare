import unittest
from copy import deepcopy
import numpy as np
from engine.feature_fields import adapt, validate, kernel
from engine.field_transport import _field_at


class FeatureFieldTests(unittest.TestCase):
    def fields(self, size=32):
        return dict(flow0=np.zeros((2,size,size),np.float32), flow1=np.zeros((2,size,size),np.float32), weight=np.full((size,size),.5,np.float32), metadata={'original':True}, rgb=np.ones((3,size,size),np.float32))

    def controls(self):
        return dict(radius=20, max_delta=8, anchors=[dict(id='tip', source=[33.,31.],guide=[31.,33.],target=[31.,31.],visibility='model')])

    def test_independent_kernel_scalar_oracle(self):
        for r in (0,.1,.25,.5,.75,1,1.5):
            expected=(1-r)**4*(1+4*r) if r<1 else 0
            self.assertAlmostEqual(float(kernel(r*13,13)),expected)

    def test_bilinear_feature_fit_and_compact_support(self):
        f=self.fields();c=self.controls();original=deepcopy(f);out,d=adapt(f,[64,64],c)
        # Independent scalar bilinear interpolation at native coordinate31,31:
        # working coordinate15.25,15.25, native flow uses factor2.
        for key,target in [('flow0',[2,0]),('flow1',[0,2])]:
            value=(out[key][:,15,15]*.75*.75+out[key][:,15,16]*.25*.75+out[key][:,16,15]*.75*.25+out[key][:,16,16]*.25*.25)*2
            np.testing.assert_allclose(value,target,atol=1e-5)
            self.assertTrue(np.array_equal(out[key][:,:3,:],original[key][:,:3,:]))
            self.assertEqual(d['maps'][key]['new_nonpositive_jacobian'],0)
        for key in ('flow0','flow1','weight','rgb'):np.testing.assert_array_equal(f[key],original[key])
        self.assertNotIn('rgb',out);self.assertFalse(out['metadata']['raw_model_rgb_matches'])

    def test_zero_residual_exact_identity(self):
        f=self.fields();c=self.controls();c['anchors'][0].update(source=[31.,31.],guide=[31.,31.]);out,d=adapt(f,[64,64],c)
        for k in ('flow0','flow1','weight'):self.assertEqual(out[k].tobytes(),f[k].tobytes())
        self.assertEqual(d['unsafe_reasons'],[])

    def test_visibility_pins_one_known_side_and_support(self):
        f=self.fields();c=self.controls();c['anchors'][0].update(source=[31.,31.],guide=None,visibility='source');out,d=adapt(f,[64,64],c)
        self.assertEqual(float(_field_at(out['weight'],np.array(31.),np.array(31.),64,64)),1)
        np.testing.assert_array_equal(out['flow1'],f['flow1']);self.assertEqual(float(out['weight'][0,0]),.5)

    def test_opposite_unresolved_visibility_refuses(self):
        c=self.controls();a=c['anchors'][0];a['visibility']='source';b=deepcopy(a);b.update(id='other',target=[31.1,31.1],visibility='guide');c['anchors'].append(b)
        with self.assertRaisesRegex(ValueError,'Opposite visibility'):adapt(self.fields(),[64,64],c)

    def test_singular_nearby_geometry_and_budget_refuse(self):
        c=self.controls();b=deepcopy(c['anchors'][0]);b.update(id='other',target=[31.00000000001,31.00000000001]);c['anchors'].append(b)
        with self.assertRaisesRegex(ValueError,'resolved safely'):adapt(self.fields(),[64,64],c)
        c=self.controls();c['max_delta']=.5
        with self.assertRaisesRegex(ValueError,'displacement'):adapt(self.fields(),[64,64],c)

    def test_new_fold_flagged_not_silently_accepted(self):
        c=self.controls();c.update(radius=4,max_delta=64);c['anchors'][0].update(source=[53.,31.],guide=[31.,31.]);out,d=adapt(self.fields(),[64,64],c)
        self.assertGreater(d['maps']['flow0']['new_nonpositive_jacobian'],0)
        self.assertTrue(d['unsafe_reasons']);self.assertFalse(d['continuous_topology_guarantee'])

    def test_preexisting_fold_distinguished(self):
        f=self.fields();f['flow1'][0]=-2*np.arange(32)[None,:];c=self.controls();c['anchors'][0].update(source=[31.,31.],guide=None,visibility='source');_,d=adapt(f,[64,64],c)
        self.assertEqual(d['maps']['flow1']['preexisting_nonpositive_jacobian'],1024)
        self.assertEqual(d['maps']['flow1']['new_nonpositive_jacobian'],0)

    def test_validation_and_cancellation_no_input_mutation(self):
        c=self.controls()
        for patch in ({'radius':True},{'max_delta':float('nan')},{'anchors':[]}):
            with self.assertRaises(ValueError):validate([64,64],dict(c,**patch))
        for change in ({'target':[64,31]},{'source':None,'visibility':'model'},{'id':'../bad'}):
            bad=deepcopy(c);bad['anchors'][0].update(change)
            with self.assertRaises(ValueError):validate([64,64],bad)
        f=self.fields();f['weight'][0,0]=float('nan')
        with self.assertRaises(ValueError):adapt(f,[64,64],c)
        def stop():raise InterruptedError('owned cancel')
        f=self.fields();before=f['flow0'].tobytes()
        with self.assertRaises(InterruptedError):adapt(f,[64,64],c,stop)
        self.assertEqual(before,f['flow0'].tobytes())

    def test_declared_geometry_moves_both_key_marks_to_same_target(self):
        from engine.field_transport import transport
        from engine.spatial_constraints import uniform
        f=self.fields();c=dict(radius=16,max_delta=4,anchors=[dict(id='mark',source=[10,16],guide=[14,16],target=[12,16],visibility='model')])
        out,d=adapt(f,[32,32],c);blank=uniform(32,32)
        a=blank.with_edits({16*32+10:[0,0,0,255]});b=blank.with_edits({16*32+14:[0,0,0,255]})
        raw=transport([a],[b],[blank],[blank],[255],f)['outputs'][0]['pixels']
        mapped=transport([a],[b],[blank],[blank],[255],out)['outputs'][0]['pixels']
        self.assertEqual(raw[16*32+12][3],0);self.assertEqual(mapped[16*32+12],[0,0,0,255]);self.assertFalse(d['unsafe_reasons'])

    def test_private_cli_read_only_cache_binding_and_no_inference(self):
        from pathlib import Path
        import tempfile,json,hashlib
        from unittest.mock import patch
        from tests.test_joint_motion import fixture
        from tests.test_learned_motion import settings,fake
        from hosts.standalone.session import Session
        from scripts.study_feature_fields import study
        p,_=fixture();request=settings(p);f=fake(np.zeros((3,48,64),np.float32),np.zeros((3,48,64),np.float32),.5,lambda:None)
        f['metadata'].update(artifact_sha256={},progress=.5)
        with tempfile.TemporaryDirectory() as td,patch('engine.rife_fields.infer',side_effect=AssertionError('No new model evaluation')),patch('engine.rife_fields.installation',return_value={'model_files':[]}):
            root=Path(td);source=root/'source.aaa';Session(p).save(source);before=source.read_bytes();cache=root/'cache';cache.mkdir();config=root/'controls.json'
            np.savez(cache/'shared-fields.npz',**{k:f[k] for k in ('flow0','flow1','weight')});(cache/'shared-fields-metadata.json').write_text(json.dumps(f['metadata']))
            report=dict(status='private-quality-ablation',source_sha256=hashlib.sha256(before).hexdigest(),model_evaluations=1,source_unchanged=True,request=request,shared_fields_sha256={k:hashlib.sha256(f[k].tobytes()).hexdigest() for k in ('flow0','flow1','weight')},reference_slot=3,crops={'detail':[8,8,40,36]})
            (cache/'report.json').write_text(json.dumps(report));config.write_text(json.dumps(dict(radius=16,max_delta=1,anchors=[dict(id='mark',source=[16,20],guide=[24,20],target=[20,20],visibility='model')])))
            r=study(source,cache,config,root/'review');self.assertFalse(r['accepted']);self.assertFalse(r['editable_project_created']);self.assertEqual(r['model_evaluations'],0);self.assertEqual(source.read_bytes(),before);self.assertTrue((root/'review/detail.png').is_file());self.assertEqual(list((root/'review').glob('*.aaa')),[])
            with self.assertRaisesRegex(ValueError,'NEW'):study(source,cache,config,root/'review')
            config.write_text(json.dumps(dict(radius=4,max_delta=64,anchors=[dict(id='fold',source=[42,20],guide=[24,20],target=[20,20],visibility='model')])))
            unsafe=study(source,cache,config,root/'unsafe');self.assertTrue(unsafe['unsafe_reasons']);self.assertFalse(unsafe['installable']);self.assertFalse(unsafe['editable_project_created']);self.assertEqual(list((root/'unsafe').glob('*.aaa')),[])
            report['shared_fields_sha256']['weight']='0'*64;(cache/'report.json').write_text(json.dumps(report))
            with self.assertRaisesRegex(ValueError,'hashes'):study(source,cache,config,root/'invalid')
            self.assertFalse((root/'invalid').exists())


if __name__=='__main__':unittest.main()
