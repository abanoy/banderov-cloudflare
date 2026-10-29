from copy import deepcopy
from unittest.mock import patch as mock
import unittest
import numpy as np
from engine.deformation import warp as dense,points
from engine.deformation_stream import warp as streamed
from engine.io.project_archive import PixelPlane
from engine.spatial_constraints import uniform
from engine.roi_assistance import patch
from hosts.standalone.session import Session
from engine import motion
from engine.project import create


class StreamedMotionTests(unittest.TestCase):
    def test_small_part_can_travel_beyond_former_output_union_limit(self):
        w,h=1600,900;a=uniform(w,h).with_edits({120*w+120:[10,30,50,180],121*w+121:[3,4,5,0]});mask=uniform(w,h).with_edits({121*w+121:[1,0,0,0]});cache={}
        r=dense(a,mask,[100,100,132,132],[[110.5,110.5]],[[1110.5,110.5]],'translation',cache=cache)
        self.assertEqual(r['pixels'][120*w+1120],[10,30,50,180]);self.assertEqual(r['pixels'][121*w+1121],[3,4,5,0]);self.assertEqual(r['protected_mask'][121*w+1121],[1,0,0,0]);self.assertEqual(r['unsafe_reasons'],[])
        with mock('engine.deformation_stream._field',side_effect=AssertionError('Repeated geometry')):self.assertEqual(dense(a,mask,[100,100,132,132],[[110.5,110.5]],[[1110.5,110.5]],'translation',cache=cache)['pixels'],r['pixels'])

    def test_small_solver_parity_for_nonlinear_translation_rotation_and_constraints(self):
        rng=np.random.default_rng(153);raw=rng.integers(0,256,(35,38,4),dtype=np.uint8);a=patch(uniform(100,90),[20,16,58,51],raw.tobytes());mask=uniform(100,90).with_edits({25*100+30:[1,0,0,0]});p=np.array([[22.5,18.5],[54.5,19.5],[35.5,47.5]])
        for mode,q in [('rigid',p+[8,5]),('similarity',p+[[0,0],[4,2],[-2,1]]),('translation',p+[4,-3]),('rigid',np.column_stack((70-p[:,1],p[:,0])))]:
            with self.subTest(mode=mode,q=q.tolist()):
                old=dense(a,mask,[20,16,58,51],p,q,mode);new=streamed(a,mask,[20,16,58,51],p,q,mode)
                self.assertEqual(new['pixels'],old['pixels']);self.assertEqual(new['protected_mask'],old['protected_mask']);self.assertEqual(new['output_roi'],old['output_roi']);self.assertEqual(new['unsafe_reasons'],old['unsafe_reasons'])
                for key in ['fold_samples','near_singular_samples','protected_lost','clipped_ink','inverse_unresolved','unselected_ink','unselected_constraints']:self.assertEqual(new['metrics'][key],old['metrics'][key])

    def test_hd_large_actor_exact_integer_translation_hidden_rgb_alpha_and_erase(self):
        w,h=1920,1080;roi=[200,100,1500,1000];rgba=np.zeros((h,w,4),np.uint8);rgba[100:1000,200:1500]=[81,17,193,0];rgba[140:960,300:1100]=[11,90,170,123];rgba[450,550]=[99,120,7,0];plane=PixelPlane.from_rgba(w,h,rgba.tobytes());mask=uniform(w,h).with_edits({450*w+550:[1,0,0,0]});before=plane.identity;cache={}
        result=dense(plane,mask,roi,[[400.5,200.5]],[[407.5,205.5]],'translation',cache=cache)
        expected=rgba.copy();expected[100:1005,200:1507]=0;expected[105:1005,207:1507]=rgba[100:1000,200:1500]
        self.assertEqual(result['pixels'].region_bytes(),expected.tobytes());self.assertEqual(result['protected_mask'][(450+5)*w+550+7],[1,0,0,0]);self.assertEqual(result['unsafe_reasons'],[]);self.assertEqual(plane.identity,before);self.assertLessEqual(result['metrics']['field_bytes'],96*1024**2)
        # The exact same cached geometry must be reused across ink/fill/masks.
        with mock('engine.deformation_stream._field',side_effect=AssertionError('Geometry recomputed')):
            other=dense(uniform(w,h),mask,roi,[[400.5,200.5]],[[407.5,205.5]],'translation',cache=cache)
        self.assertEqual(other['protected_mask'],result['protected_mask'])

    def test_4k_world_coordinates_preserve_raw_pixels_without_downscale(self):
        w,h=4096,4096;plane=uniform(w,h).with_edits({1900*w+2020:[45,90,135,210],1901*w+2021:[76,54,32,0]});mask=uniform(w,h).with_edits({1901*w+2021:[1,0,0,0]})
        result=dense(plane,mask,[1700,1300,2500,2500],[[2000.5,1700.5]],[[2003.5,1704.5]],'translation')
        self.assertEqual(result['pixels'][(1900+4)*w+2020+3],[45,90,135,210]);self.assertEqual(result['pixels'][(1901+4)*w+2021+3],[76,54,32,0]);self.assertEqual(result['protected_mask'][(1901+4)*w+2021+3],[1,0,0,0]);self.assertEqual(result['metrics']['source_samples'],800*1200);self.assertEqual(result['unsafe_reasons'],[])

    def test_clipping_collision_sampling_loss_and_fold_guards_remain(self):
        plane=uniform(600,400).with_edits({20*600+20:[1,2,3,255],25*600+330:[4,5,6,255]});mask=uniform(600,400).with_edits({25*600+330:[1,0,0,0]})
        r=dense(plane,mask,[10,10,320,200],[[20,20]],[[40,20]],'translation');self.assertIn('unselected_source_ink_in_output',r['unsafe_reasons']);self.assertIn('unselected_artist_constraints_in_output',r['unsafe_reasons'])
        r=dense(plane,mask,[0,0,400,300],[[20,20]],[[-1,-1]],'translation');self.assertIn('clipped_ink_requires_explicit_clip_choice',r['unsafe_reasons'])
        fixed=uniform(600,400).with_edits({20*600+20:[1,0,0,0]});r=dense(plane,fixed,[0,0,400,300],[[20,20]],[[-1,-1]],'translation',allow_clip=True);self.assertIn('artist_constraint_lost_by_sampling_or_clipping',r['unsafe_reasons']);self.assertNotIn('clipped_ink_requires_explicit_clip_choice',r['unsafe_reasons'])
        protected=uniform(600,400).with_edits({21*600+21:[1,0,0,0]});r=dense(plane,protected,[0,0,400,300],[[0.5,.5],[399.5,.5],[.5,299.5]],[[.5,.5],[200,.5],[.5,150]],'similarity');self.assertIn('artist_constraint_lost_by_sampling_or_clipping',r['unsafe_reasons'])
        r=dense(plane,mask,[0,0,400,300],[[20.5,20.5],[300.5,20.5],[20.5,250.5]],[[300.5,20.5],[20.5,20.5],[300.5,250.5]],'similarity');self.assertIn('sampled_fold_or_singularity',r['unsafe_reasons'])

    def test_budget_cache_identity_and_mid_geometry_cancel_are_explicit(self):
        a=uniform(600,400);p=[[20,20]];q=[[25,22]]
        with mock('engine.deformation_stream.FIELD_LIMIT',1):
            with self.assertRaisesRegex(ValueError,'96MiB'):dense(a,a,[0,0,400,300],p,q,'translation')
        with mock('engine.deformation_stream.OUTPUT_LIMIT',1):
            with self.assertRaisesRegex(ValueError,'output tile pool'):dense(a,a,[0,0,400,300],p,q,'translation')
        calls=[]
        def stop():
            calls.append(1)
            if len(calls)==8:raise InterruptedError('cancelled')
        with self.assertRaises(InterruptedError):dense(a,a,[0,0,400,300],p,q,'translation',checkpoint=stop)
        cache={};dense(a,a,[0,0,400,300],p,q,'translation',cache=cache)
        with self.assertRaisesRegex(ValueError,'one field'):dense(a,a,[0,0,400,300],p,[[21,21]],'translation',cache=cache)

    def test_full_4k_selection_uses_exactly_bounded_field_and_tile_reads(self):
        w=h=4096;a=uniform(w,h).with_edits({2000*w+1900:[12,40,90,180],2001*w+1901:[7,11,15,0]});mask=uniform(w,h).with_edits({2001*w+1901:[1,0,0,0]});reader=PixelPlane.region_bytes
        def bounded(plane,rectangle=None):
            self.assertIsNotNone(rectangle);self.assertLessEqual((rectangle[2]-rectangle[0])*(rectangle[3]-rectangle[1]),4096)
            return reader(plane,rectangle)
        with mock.object(PixelPlane,'region_bytes',bounded):r=dense(a,mask,[0,0,w,h],[[1900.5,2000.5]],[[1903.5,2004.5]],'translation')
        self.assertEqual(r['metrics']['field_bytes'],96*1024**2);self.assertEqual(r['metrics']['source_samples'],w*h);self.assertEqual(r['metrics']['output_samples'],w*h);self.assertEqual(r['pixels'][2004*w+1903],[12,40,90,180]);self.assertEqual(r['pixels'][2005*w+1904],[7,11,15,0]);self.assertEqual(r['protected_mask'][2005*w+1904],[1,0,0,0]);self.assertEqual(r['unsafe_reasons'],[])

    def test_large_group_motion_install_preserves_keys_originals_and_editable_reopen(self):
        import tempfile
        from pathlib import Path
        w,h=800,600;a=uniform(w,h).with_edits({y*w+x:[10,30,80,180] for y in range(100,500) for x in range(200,300)});p=create(a,w,h,8);layer=next(iter(p['layers']));p['motion_guides']={'large':dict(name='Supplied whole actor',actor_id=layer,source_slot=0,guide_slot=None,roi=[100,50,650,550],handles=[dict(id='center',source=[250.5,300.5],target=[260.5,305.5],enabled=True)])}
        request=dict(guide_id='large',mode='rigid',progress=1,target_start=1,target_end=4,operation_id=None,allow_clip=False);r=motion.propose(p,request);self.assertFalse(r['unsafe_reasons']);q=motion.accept(p,r,'large-test');self.assertEqual(q['originals'],p['originals']);self.assertEqual(motion._exposure(q,layer,0)['drawing_id'],motion._exposure(p,layer,0)['drawing_id'])
        session=Session(q);session.layer_id=layer;session.slot=1;session.correct({100*w+100:[1,2,3,4]})
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'large.aaa';session.save(path);self.assertEqual(Session.load(path).project,session.project)


if __name__=='__main__':unittest.main()
