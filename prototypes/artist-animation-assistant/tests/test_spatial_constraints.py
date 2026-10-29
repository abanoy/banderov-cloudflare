from copy import deepcopy
import hashlib,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from engine.project import create,fingerprint
from engine.io.project_archive import PixelPlane
from engine.paint_stroke import PackedStroke
from engine.spatial_constraints import uniform,count,indices,drawing_mask,ENCODING,validate_mask
from engine.packed_model import json_default
from hosts.standalone.session import Session,supported


def session(w=512,h=512,color=(10,30,80,128)):
    return Session(create(PixelPlane.from_rgba(w,h,bytes(color)*(w*h)),w,h))


class SpatialConstraintTests(unittest.TestCase):
    def test_discontinuous_pointer_samples_make_one_connected_literal_segment(self):
        s=session();source=s.project['drawings']['source']['pixels'];stroke=PackedStroke(source,[220,40,10,255],0)
        stroke.add((10,20));stroke.add((400,20));s.correct_stroke(stroke)
        d=s.project['drawings'][s.drawing_id()]
        self.assertEqual(count(d),391)
        self.assertTrue(all(d['pixels'][20*512+x]==[220,40,10,255] for x in range(10,401)))
        self.assertEqual(d['pixels'][19*512+200],[10,30,80,128]);self.assertEqual(source[20*512+200],[10,30,80,128])
        self.assertNotIn('protected_pixels',d)

    def test_round_width_diagonal_boundary_clip_and_corners(self):
        s=session(257,193);source=s.project['drawings']['source']['pixels'];stroke=PackedStroke(source,[200,0,90,255],7)
        stroke.add((-20,50));stroke.add((250,50));stroke.add((250,180));s.correct_stroke(stroke)
        d=s.project['drawings'][s.drawing_id()]
        self.assertEqual(d['pixels'][50*257],[200,0,90,255]);self.assertEqual(d['pixels'][50*257+100],[200,0,90,255])
        self.assertEqual(d['pixels'][42*257+100],[10,30,80,128]);self.assertEqual(d['pixels'][150*257+250],[200,0,90,255])
        self.assertEqual(d['pixels'][150*257+240],[10,30,80,128])
        self.assertEqual(d['pixels'][190*257+250],[10,30,80,128])
        validate_mask(d['protected_mask'],257,193)

    def test_dense_hundred_strokes_avoid_repeated_index_lists(self):
        s=session();source=s.project['originals']['source']['pixels'];identity=s.project['originals_sha256']
        for i in range(100):
            stroke=PackedStroke(s.project['drawings'][s.drawing_id()]['pixels'],[i,120,200,255],12)
            stroke.add((5,(i*5)%512));stroke.add((506,(i*5)%512));s.correct_stroke(stroke)
        d=s.project['drawings'][s.drawing_id()]
        self.assertGreater(count(d),240000);self.assertEqual(len(s.project['drawings']),101)
        self.assertTrue(all('protected_pixels' not in v for k,v in s.project['drawings'].items() if k!='source'))
        self.assertLess(len(json.dumps(s.project,default=json_default).encode()),250000)
        self.assertEqual(s.project['originals_sha256'],identity);self.assertEqual(source[0],[10,30,80,128])
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'dense.aaa';s.save(p);self.assertEqual(Session.load(p).project,s.project)

    def test_same_color_and_already_transparent_touches_stay_protected(self):
        s=session(1920,1080,(0,0,0,0));source=s.project['drawings']['source']['pixels']
        stroke=PackedStroke(source,[0,0,0,0],10);stroke.add((20,30));stroke.add((1000,30));s.correct_stroke(stroke)
        d=s.project['drawings'][s.drawing_id()]
        self.assertEqual(d['pixels'],source);self.assertGreater(count(d),20000)
        self.assertEqual(indices(d,(20,25,30,35),local=True),list(range(100)))
        before=count(d);stroke=PackedStroke(d['pixels'],[90,40,120,128],0);stroke.add((100,100));s.correct_stroke(stroke)
        self.assertEqual(count(s.project['drawings'][s.drawing_id()]),before+1)
        s.travel();self.assertEqual(count(s.project['drawings'][s.drawing_id()]),before)
        s.travel(False);self.assertEqual(count(s.project['drawings'][s.drawing_id()]),before+1)

    def test_legacy_constraints_and_unknown_locked_corrections_are_conservative(self):
        d=dict(pixels=PixelPlane.from_rgba(4096,4096,bytes(4096*4096*4)),origin='artist_correction',locked=True)
        self.assertEqual(count(d),4096*4096)
        self.assertEqual(len(indices(d,(4000,4000,4020,4030),local=True)),600)
        with self.assertRaisesRegex(ValueError,'bounded region'):indices(d)
        d.update(protected_pixels=[0,123,456]);self.assertEqual(count(d),3)
        d['protected_pixels']=[0,0]
        with self.assertRaises(ValueError):drawing_mask(d)

    def test_mask_validation_and_outside_patch_tamper_leave_session_unchanged(self):
        s=session();before=fingerprint(s.project);counter=s.counter;plane=s.project['drawings']['source']['pixels']
        changed=plane.with_edits({33:[1,2,3,4]})
        with self.assertRaisesRegex(ValueError,'outside'):s.commit_packed_correction(changed,uniform(512,512))
        self.assertEqual(fingerprint(s.project),before);self.assertFalse(s.past);self.assertEqual(s.counter,counter)
        invalid=uniform(512,512).with_edits({4:[1,0,0,255]})
        with self.assertRaises(ValueError):validate_mask(invalid,512,512)
        bad=deepcopy(s.project);bad['drawings']['source'].update(protected_mask=uniform(512,512),protection_encoding='unknown')
        with self.assertRaises(ValueError):supported(bad)

    def test_failure_during_dense_commit_does_not_grow_source_or_history(self):
        s=session();plane=s.project['drawings']['source']['pixels'];pool=dict(plane._store.assets);before=fingerprint(s.project)
        stroke=PackedStroke(plane,[10,20,30,255],32);stroke.add((0,0));stroke.add((511,511))
        with patch('engine.packed_model.LIVE_ASSETS',0):
            with self.assertRaises(ValueError):s.correct_stroke(stroke)
        self.assertEqual(fingerprint(s.project),before);self.assertEqual(plane._store.assets,pool);self.assertFalse(s.past)

    def test_old_small_controller_keeps_legacy_hashes_and_touch_masks(self):
        old=create([[0,0,0,0] for _ in range(64*64)],64,64);s=Session(old);source=PixelPlane.from_pixels(64,64,old['drawings']['source']['pixels'])
        stroke=PackedStroke(source,[20,30,40,255],2);stroke.add((2,5));stroke.add((60,5));s.correct_stroke(stroke)
        self.assertEqual(s.project['schema_version'],'0.1');self.assertEqual(s.project['originals'],old['originals'])
        self.assertGreater(len(s.project['drawings'][s.drawing_id()]['protected_pixels']),250)
        self.assertTrue(all(s.project['drawings'][s.drawing_id()]['pixels'][5*64+x]==[20,30,40,255] for x in range(2,61)))

    def test_translation_accept_moves_spatial_constraints_and_rejects_clipping(self):
        from engine.project import propose_translation,accept
        s=session(513,257);s.correct({10:[90,20,10,0],200:[10,30,80,128]})
        source_id=s.drawing_id();source=s.project['drawings'][source_id]
        accepted=accept(propose_translation(s.project,'move',source_id,3,2),'move','moved')
        d=accepted['drawings']['moved'];self.assertEqual(count(d),2);self.assertTrue(d['locked'])
        self.assertEqual(indices(d,(0,0,220,10)),[2*513+13,2*513+203])
        self.assertEqual(accepted['drawings'][source_id],source)
        preview=propose_translation(s.project,'clip',source_id,-11,0)
        self.assertGreater(preview['proposals']['clip']['constraint_clip_count'],0)
        with self.assertRaisesRegex(ValueError,'clip protected'):accept(preview,'clip','bad')

    def test_worker_preserves_masks_through_review_and_reports_protected_clip(self):
        from engine.jobs import create_job,execute,read
        s=session(513,257);s.correct({10:[0,0,0,0]})
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'move';create_job(s.project,s.drawing_id(),3,0,p);execute(p);s.apply(p)
            self.assertEqual(indices(s.project['drawings'][s.drawing_id()],(0,0,30,1)),[13])
            bad=Path(td)/'clip';create_job(s.project,s.drawing_id(),-14,0,bad)
            with self.assertRaisesRegex(ValueError,'clip protected'):execute(bad)
            self.assertEqual(read(bad/'job.json')['state'],'failed');self.assertFalse((bad/'result.json').exists())

    def test_credits_retrieval_dates_follow_each_source_not_process_date(self):
        from scripts.credits import load
        data=load();byid={r['source_id']:r for r in data['sources']}
        self.assertIn('Retrieved October 21, 2026',byid['REF-KRITA-FREEHAND']['apa_reference'])
        self.assertIn('Retrieved October 20, 2026',byid['REF-PYTHON-ZIP']['apa_reference'])


if __name__=='__main__':unittest.main()
