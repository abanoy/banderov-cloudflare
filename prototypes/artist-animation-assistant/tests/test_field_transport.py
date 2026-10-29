import unittest
from unittest.mock import patch
import numpy as np
from engine.field_transport import transport
from engine.io.project_archive import PixelPlane
from engine.spatial_constraints import uniform


def fields(w,h,dx0=0,dx1=0,m=.5):
    a=np.zeros((2,h,w),np.float32);b=a.copy();a[0]=dx0;b[0]=dx1
    return dict(flow0=a,flow1=b,weight=np.full((h,w),m,np.float32))


class FieldTransportTests(unittest.TestCase):
    def test_identity_preserves_hidden_rgb_underpaint_and_zero_opacity(self):
        w,h=17,13;rng=np.random.default_rng(42);raw=[rng.integers(0,256,(h,w,4),dtype=np.uint8) for _ in range(3)];raw[0][:,:,3]=255;raw[2][1,1]=[111,44,202,0];planes=[PixelPlane.from_rgba(w,h,a.tobytes()) for a in raw];masks=[uniform(w,h) for _ in raw]
        result=transport(planes,planes,masks,masks,[255,255,0],fields(w,h))
        for old,new in zip(planes,result['outputs']):self.assertEqual(new['pixels'],old);self.assertEqual(new['unsafe_reasons'],[])

    def test_shared_two_way_fields_keep_ink_fill_alignment_and_subpixel_alpha(self):
        w=h=32;first=[];second=[]
        for rgba in [[20,30,40,255],[60,160,220,128]]:
            a=np.zeros((h,w,4),np.uint8);a[10:20,8:16]=rgba;b=np.zeros_like(a);b[10:20,16:24]=rgba;first.append(PixelPlane.from_rgba(w,h,a.tobytes()));second.append(PixelPlane.from_rgba(w,h,b.tobytes()))
        masks=[uniform(w,h)]*2;r=transport(first,second,masks,masks,[255,255],fields(w,h,-4,4))
        for i,rgba in enumerate([[20,30,40,255],[60,160,220,128]]):self.assertEqual(r['outputs'][i]['pixels'][14*w+16],rgba)
        for out in r['outputs']:self.assertEqual(out['unsafe_reasons'],[])

    def test_composite_matches_independent_scalar_visible_mixture(self):
        w,h=7,5;rng=np.random.default_rng(97);aa=[rng.integers(0,256,(h,w,4),dtype=np.uint8) for _ in range(3)];bb=[rng.integers(0,256,(h,w,4),dtype=np.uint8) for _ in range(3)];op=[180,255,127];a=[PixelPlane.from_rgba(w,h,v.tobytes()) for v in aa];b=[PixelPlane.from_rgba(w,h,v.tobytes()) for v in bb];r=transport(a,b,[uniform(w,h)]*3,[uniform(w,h)]*3,op,fields(w,h,m=.37));actual=[np.frombuffer(v['pixels'].region_bytes(),np.uint8).reshape(h,w,4) for v in r['outputs']]
        def scalar(rows,y,x):
            colour=np.zeros(3);alpha=0.
            for row,opacity in reversed(list(zip(rows,op))):
                pixel=row[y,x].astype(float)/255.;a=pixel[3]*opacity/255.;colour=pixel[:3]*a+colour*(1-a);alpha=a+alpha*(1-a)
            return np.r_[colour,alpha]
        for y in range(h):
            for x in range(w):self.assertTrue(np.max(np.abs(scalar(actual,y,x)-(.37*scalar(aa,y,x)+.63*scalar(bb,y,x))))<3/255)

    def test_protected_erase_override_conflict_loss_and_source_immutability(self):
        w=h=32;a=uniform(w,h).with_edits({12*w+12:[99,22,44,0]});b=uniform(w,h).with_edits({12*w+12:[40,80,120,255]});mask=uniform(w,h).with_edits({12*w+12:[1,0,0,0]});empty=uniform(w,h);before=a.identity
        r=transport([a],[b],[mask],[empty],[255],fields(w,h));self.assertEqual(r['outputs'][0]['pixels'][12*w+12],[99,22,44,0]);self.assertEqual(r['outputs'][0]['protected_mask'][12*w+12],[1,0,0,0]);self.assertFalse(r['outputs'][0]['unsafe_reasons'])
        r=transport([a],[b],[mask],[mask],[255],fields(w,h));self.assertIn('source_target_protected_rgba_conflict',r['outputs'][0]['unsafe_reasons'])
        r=transport([a],[b],[mask],[empty],[255],fields(w,h,dx0=50));self.assertIn('protected_key_samples_not_represented',r['outputs'][0]['unsafe_reasons']);self.assertEqual(a.identity,before)

    def test_explicit_model_resolution_scales_flow_to_native_pixels(self):
        w,h=128,96;a=uniform(w,h).with_edits({40*w+40:[40,80,120,255]});b=uniform(w,h).with_edits({40*w+56:[40,80,120,255]});empty=uniform(w,h)
        r=transport([a],[b],[empty],[empty],[255],fields(32,24,-2,2));self.assertEqual(r['outputs'][0]['pixels'][40*w+48],[40,80,120,255]);self.assertEqual(r['metrics']['output_size'],[w,h]);self.assertEqual(r['metrics']['working_size'],[32,24])

    def test_nonfinite_budget_and_cancellation_refuse(self):
        a=uniform(80,80);f=fields(32,32);f['flow0'][0,0,0]=np.nan
        with self.assertRaises(ValueError):transport([a],[a],[a],[a],[255],f)
        with patch('engine.field_transport.OUTPUT_LIMIT',1):
            with self.assertRaisesRegex(ValueError,'256MiB'):transport([a],[a],[a],[a],[255],fields(32,32))
        def cancel():raise InterruptedError('cancel')
        with self.assertRaises(InterruptedError):transport([a],[a],[a],[a],[255],fields(32,32),cancel)


if __name__=='__main__':unittest.main()
