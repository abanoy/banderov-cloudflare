from copy import deepcopy
from pathlib import Path
import tempfile,unittest
import numpy as np
from engine.correspondence import defaults,propose,review
from engine.project import fingerprint
from engine.jobs import create_correspondence_job,execute,read,atomic_write,apply_correspondence_result
from hosts.standalone.correspondence_fixtures import fixture

def rotated(duplicate=False,packed=False):
    p=fixture(duplicate=duplicate,packed=packed);d=p['drawings']['end'];a=np.asarray(d['pixels'].materialize() if packed else d['pixels'],np.uint8).reshape(80,80,4);pixels=np.rot90(a,-1).reshape(-1,4).tolist()
    if packed:
        from engine.io.project_archive import PixelPlane
        pixels=PixelPlane.from_pixels(80,80,pixels)
    d['pixels']=pixels;p['originals']['end']=deepcopy(d);p['originals_sha256']=fingerprint(p['originals']);return p

class QuarterTurnCorrespondenceTests(unittest.TestCase):
    def test_actual_rotated_image_evidence_and_explicit_review_preserve_art(self):
        for packed in (False,True):
            p=rotated(packed=packed);before=fingerprint(p);settings=dict(defaults('patch'),rotation_mode='quarter_turns');r=propose(p,settings);row=r['rows'][0]
            self.assertEqual(row['alternatives'][0]['target'],[44.5,37.5]);self.assertEqual(row['alternatives'][0]['error'],0);self.assertEqual(row['alternatives'][0]['patch_quarter_turns'],3);self.assertEqual(row['reverse_error'],0);self.assertEqual(row['status'],'clear_by_thresholds');self.assertEqual(fingerprint(p),before)
            q=review(p,r,[dict(landmark_id='pattern',candidate_index=0,decision='accept')],'rotated-review');self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['exposures'],p['exposures']);self.assertEqual(q['correspondence_operations'][0]['proposal']['version'],'0.2.0')
    def test_rotated_duplicate_remains_ambiguous(self):
        row=propose(rotated(duplicate=True),dict(defaults('patch'),rotation_mode='quarter_turns'))['rows'][0];self.assertEqual(row['alternative_gap'],0);self.assertEqual(row['status'],'needs_review')
    def test_old_fixed_settings_and_invalid_modes(self):
        p=fixture();settings=defaults('patch');result=propose(p,settings);self.assertNotIn('rotation_mode',settings);self.assertNotIn('patch_quarter_turns',result['rows'][0]['alternatives'][0]);self.assertEqual(result['version'],'0.1.0');self.assertEqual(result['rows'][0]['alternatives'][0]['target'],[37.5,35.5])
        for value in ('automatic','45degrees',None,[]):
            with self.assertRaises(ValueError):propose(p,dict(settings,rotation_mode=value))
    def test_rotated_worker_recomputes_orientation_metadata_and_keeps_originals(self):
        p=rotated();settings=dict(defaults('patch'),rotation_mode='quarter_turns');decisions=[dict(landmark_id='pattern',candidate_index=0,decision='accept')]
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'job';create_correspondence_job(p,settings,job);self.assertEqual(execute(job)['state'],'completed');result=read(job/'result.json');changed=deepcopy(result);changed['correspondence_result']['rows'][0]['alternatives'][0]['patch_quarter_turns']=0;atomic_write(job/'result.json',changed)
            with self.assertRaisesRegex(ValueError,'differs'):apply_correspondence_result(p,job,decisions,'tampered')
            atomic_write(job/'result.json',result);q=apply_correspondence_result(p,job,decisions,'review');self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['exposures'],p['exposures']);self.assertEqual(q['motion_guides']['patch']['handles'][0]['target'],[44.5,37.5])

if __name__=='__main__':unittest.main()
