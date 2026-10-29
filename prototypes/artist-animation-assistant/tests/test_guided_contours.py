import unittest
import itertools
import numpy as np
from engine.guided_contours import trace,alternatives,raster_path


class GuidedContourTests(unittest.TestCase):
    def test_dp_matches_exhaustive_independent_small_straight_ribbon_cost(self):
        a=np.full((16,16,4),255,np.uint8)
        for y in range(5,12):
            for x in range(2,11):a[y,x,:3]=50+(x*31+y*19)%180
        r=trace(a,[[4,8],[8,8]],radius=2,continuity=.07,bend=.3)
        gray=a[:,:,:3].mean(axis=2);lo,hi=np.percentile(gray,[5,95]);ink=np.clip((hi-gray)/max(16,hi-lo),0,1)
        def cost(path):
            total=0
            for row in range(1,4):
                total-=sum(float(ink[8+path[row],4+row+shift]) for shift in (-2,-1,0,1,2))/5
                total+=.002*(path[row]/2)**2
            total+=sum(.07*(b-a)**2 for a,b in zip(path,path[1:]))
            total+=sum(.3*(a-2*b+c)**2 for a,b,c in zip(path,path[1:],path[2:]))
            return total
        feasible=[(0,)+p+(0,) for p in itertools.product(range(-2,3),repeat=3) if all(abs(x-y)<=2 for x,y in zip((0,)+p,p+(0,)))]
        best=min(map(cost,feasible))
        self.assertAlmostEqual(r['metrics']['cost'],best,places=11)
        self.assertAlmostEqual(cost(tuple(r['offsets'])),best,places=11)

    def scene(self):
        a=np.full((64,96,4),255,np.uint8)
        for x in range(6,90):
            a[29+(x%3==0),x,:3]=85;a[33+(x%4==0),x,:3]=90
        return a

    def test_pinned_bounded_source_unchanged_and_known_intent(self):
        a=self.scene();before=a.copy();guide=[[6,31],[89,31]]
        r=trace(a,guide,radius=6)
        np.testing.assert_array_equal(a,before)
        self.assertEqual(r['points'][0],guide[0]);self.assertEqual(r['points'][-1],guide[-1])
        self.assertLessEqual(max(map(abs,r['offsets'])),6)
        self.assertLessEqual(max(abs(x-y) for x,y in zip(r['offsets'],r['offsets'][1:])),2)
        # This constructed intent is a smooth horizontal stroke family. The
        # darkest member is not asserted to be the owner's intended contour.
        self.assertLess(np.mean(np.diff(np.array(r['points'])[8:-8,1],n=2)**2),.15)

    def test_bend_reduces_alternating_dark_distractions(self):
        a=np.full((60,96,4),255,np.uint8)
        for x in range(5,91):a[28 if x%2 else 32,x,:3]=0
        g=[[5,30],[90,30]]
        raw=trace(a,g,radius=5,continuity=0,bend=0)
        smooth=trace(a,g,radius=5,continuity=.1,bend=1.2)
        rough=lambda r:float(np.mean(np.diff(r['offsets'],n=2)**2))
        self.assertLess(rough(smooth),rough(raw))
        self.assertEqual(trace(a,g,radius=5,continuity=.1,bend=1.2),smooth)

    def test_family_scale_can_consolidate_declared_pair_but_can_merge_real_detail(self):
        a=np.full((64,96,4),255,np.uint8);a[29,5:91,:3]=50;a[33,5:91,:3]=50
        g=[[5,32],[90,32]]
        raw=trace(a,g,radius=8);bundle=trace(a,g,radius=8,bundle_width=2.5)
        error=lambda r:float(np.mean((np.array(r['points'])[10:-10,1]-31)**2))
        self.assertLess(error(bundle),error(raw))
        # The exact same pixels could be two intentional lines. This result then
        # falls between them: evidence against automatic semantic cleanup.
        self.assertTrue(all(29<y<33 for x,y in bundle['points'][10:-10]))
        self.assertTrue(any('merge distinct' in w for w in bundle['warnings']))

    def test_cancellation_propagates_and_source_survives(self):
        a=self.scene();before=a.copy()
        def cancel(row):raise InterruptedError('cancel')
        with self.assertRaises(InterruptedError):trace(a,[[6,31],[89,31]],checkpoint=cancel)
        np.testing.assert_array_equal(a,before)

    def test_uniform_paper_warns_and_equivalent_alternatives_are_labelled(self):
        a=np.full((40,80,4),255,np.uint8);r=alternatives(a,[[6,20],[70,20]])
        self.assertTrue(any('Low crop contrast' in warning for warning in r[0]['warnings']))
        self.assertEqual(r[1]['equivalent_to'],r[0]['name'])
        self.assertTrue(all(v==0 for v in r[0]['offsets']))

    def test_transparency_hidden_rgb_does_not_drive_path(self):
        a=np.full((40,80,4),255,np.uint8);a[14,5:72]=[0,0,0,0]
        r=trace(a,[[6,20],[70,20]],radius=8)
        self.assertTrue(all(v==0 for v in r['offsets']))

    def test_refuses_ambiguous_closed_oversize_or_invalid_inputs(self):
        a=self.scene()
        for g in [[],[[1,1],[1,1]],[[1,1],[2,2],[1,1]],[[0,0],[100,0]],[[1,1],[float('nan'),3]]]:
            with self.assertRaises(ValueError):trace(a,g)
        for kw in [dict(radius=True),dict(radius=17),dict(bend=float('nan')),dict(continuity=-1)]:
            with self.assertRaises(ValueError):trace(a,[[6,31],[89,31]],**kw)
        with self.assertRaises(ValueError):trace(np.zeros((513,64,4),np.uint8),[[1,1],[40,40]])

    def test_raster_is_separate_transparent_geometry_and_outside_refuses(self):
        a=raster_path([[5,5],[10,10]],20,20)
        self.assertEqual(a[5,5].tolist(),[25,100,220,200]);self.assertEqual(a[0,0].tolist(),[0,0,0,0])
        with self.assertRaises(ValueError):raster_path([[5,5],[25,25]],20,20)


if __name__=='__main__':unittest.main()
