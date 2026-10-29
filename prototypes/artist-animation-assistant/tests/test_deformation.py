from copy import deepcopy
import unittest
import numpy as np
from engine.deformation import points,inverse,warp
from engine.spatial_constraints import uniform
from engine.roi_assistance import patch


class DeformationTests(unittest.TestCase):
    def test_exact_identity_translation_similarity_and_rigid_rotation(self):
        p=np.array([[10.5,10.5],[40.5,11.5],[15.5,45.5]]);v=np.array([[16.5,17.5],[20.5,21.5],[44.5,50.5]])
        self.assertTrue(np.array_equal(points(v,p,p),v));self.assertTrue(np.allclose(points(v,p,p+[4,-3]),v+[4,-3]))
        rotation=np.array([[0,1],[-1,0]])
        q=(p-[32,32])@rotation+[32,32];expected=(v-[32,32])@rotation+[32,32]
        for mode in ['rigid','similarity']:self.assertTrue(np.allclose(points(v,p,q,mode),expected,atol=1e-10))
        self.assertTrue(np.allclose(points(v,p,2*p+[5,7],'similarity'),2*v+[5,7],atol=1e-10))

    def test_landmarks_interpolate_and_corrected_match_changes_shape(self):
        p=np.array([[10.5,12.5],[40.5,12.5],[25.5,45.5]]);q=p+[[0,0],[7,5],[-4,0]]
        for mode in ['rigid','similarity']:
            self.assertTrue(np.allclose(points(p,p,q,mode),q));a=points([[32,20]],p,q,mode);fixed=q.copy();fixed[1]=p[1];self.assertFalse(np.allclose(a,points([[32,20]],p,fixed,mode)))
        translated=points(p,p,q,'translation');self.assertGreater(float(np.max(np.linalg.norm(translated-q,axis=1))),1)

    def test_numeric_inverse_checks_actual_forward_residual(self):
        p=np.array([[10.5,12.5],[40.5,12.5],[25.5,45.5]]);q=p+[[0,0],[7,5],[-4,0]];v=np.array([[20.5,20.5],[30.5,30.5]])
        for mode in ['rigid','similarity']:
            target=points(v,p,q,mode);back,residual=inverse(target,p,q,mode);self.assertTrue(np.all(residual<.001));self.assertTrue(np.allclose(back,v,atol=.001))

    def test_identity_and_quarter_turn_preserve_raw_alpha_hidden_rgb_and_constraints(self):
        a=np.zeros((32,32,4),np.uint8);a[:]=[77,12,200,0];a[4:26,10:22]=[30,110,210,128];a[8,14]=[80,90,100,0]
        plane=patch(uniform(64,64),[16,16,48,48],a.tobytes());mask=uniform(64,64).with_edits({(16+8)*64+16+14:[1,0,0,0]});before=plane.region_bytes();p=np.array([[20.5,20.5],[43.5,20.5],[20.5,43.5]])
        same=warp(plane,mask,[16,16,48,48],p,p);self.assertIs(same['pixels'],plane);self.assertIs(same['protected_mask'],mask)
        q=np.column_stack((64-p[:,1],p[:,0]));result=warp(plane,mask,[16,16,48,48],p,q)
        self.assertEqual(result['unsafe_reasons'],[]);self.assertEqual(result['pixels'].region_bytes([16,16,48,48]),np.rot90(a,-1).tobytes());self.assertEqual(plane.region_bytes(),before);self.assertEqual(result['protected_mask'][30*64+39],[1,0,0,0])

    def test_unselected_ink_and_artist_erase_are_reported_unsafe(self):
        a=uniform(64,64).with_edits({20*64+20:[20,30,40,255],20*64+39:[200,20,30,255]});mask=uniform(64,64).with_edits({20*64+39:[1,0,0,0]})
        result=warp(a,mask,[10,10,32,32],[[15.5,15.5],[25.5,25.5]],[[31.5,15.5],[41.5,25.5]],'similarity')
        self.assertIn('unselected_source_ink_in_output',result['unsafe_reasons']);self.assertIn('unselected_artist_constraints_in_output',result['unsafe_reasons'])

    def test_collapse_and_invalid_mode_are_explicit_not_silent(self):
        for p,q in [([[1,1],[1,1]],[[2,2],[3,3]]),([[1,1],[2,2]],[[3,3],[3,3]])]:
            with self.assertRaisesRegex(ValueError,'collapsed'):points([[1,2]],p,q)
        with self.assertRaises(ValueError):points([[1,2]],[[1,1]],[[2,2]],'unknown')


if __name__=='__main__':unittest.main()
