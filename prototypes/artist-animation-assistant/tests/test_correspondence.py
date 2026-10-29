from copy import deepcopy
from pathlib import Path
import tempfile,unittest
from engine.correspondence import defaults,propose,review,subject
from engine.motion import save_guide,propose as motion_propose,accept as motion_accept
from engine.jobs import create_correspondence_job,execute,read,atomic_write,apply_correspondence_result,request_cancel
from engine.layers import render
from engine.project import fingerprint
from hosts.standalone.session import Session
from hosts.standalone.correspondence_fixtures import fixture


class CorrespondenceTests(unittest.TestCase):
    def test_image_target_is_found_without_manual_target_coordinates(self):
        p=fixture();before=fingerprint(p);r=propose(p,defaults('patch'));row=r['rows'][0]
        self.assertEqual(row['alternatives'][0]['target'],[37.5,35.5]);self.assertEqual(row['alternatives'][0]['error'],0);self.assertEqual(row['status'],'clear_by_thresholds');self.assertEqual(row['reverse_error'],0);self.assertEqual(fingerprint(p),before)
        q=review(p,r,[dict(landmark_id='pattern',candidate_index=0,decision='accept')],'match');self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['exposures'],p['exposures']);self.assertEqual(q['motion_guides']['patch']['handles'][0]['target'],[37.5,35.5])
        settings=dict(guide_id='patch',mode='rigid',progress=.5,target_start=4,target_end=8,operation_id=None,allow_clip=False);pose=motion_propose(q,settings);self.assertFalse(pose['unsafe_reasons']);out=motion_accept(q,pose,'pose');self.assertEqual(render(out,8),render(p,8));self.assertNotEqual(render(out,4),render(p,0))

    def test_duplicate_patterns_are_ambiguous_and_occluded_patch_is_not_invented(self):
        repeated=propose(fixture(duplicate=True),defaults('patch'))['rows'][0];self.assertEqual(repeated['alternative_gap'],0);self.assertEqual(repeated['status'],'needs_review');self.assertIn('ambiguous_repeated_appearance',repeated['warnings'])
        missing=propose(fixture(occluded=True),defaults('patch'))['rows'][0];self.assertEqual(missing['status'],'needs_review');self.assertIn('poor_patch_match',missing['warnings'])

    def test_flat_source_and_explicit_unmatched_or_disabled_marks_not_silently_matched(self):
        p=fixture();g=p['motion_guides']['patch'];g['handles'] += [dict(id='flat',source=[15.5,15.5],target=[15.5,15.5],enabled=True),dict(id='unmatched',source=[20.5,20.5],target=None,enabled=True),dict(id='disabled',source=[21.5,21.5],target=[21.5,21.5],enabled=False)]
        r=propose(p,defaults('patch'));self.assertEqual(len(r['rows']),2);self.assertEqual(r['rows'][1]['status'],'source_patch_uninformative');self.assertEqual(r['rows'][1]['alternatives'],[])

    def test_rejection_excludes_only_exact_input_scoped_candidate_and_survives_save(self):
        p=fixture();settings=defaults('patch');r=propose(p,settings);q=review(p,r,[dict(landmark_id='pattern',candidate_index=0,decision='reject')],'reject');next_result=propose(q,settings)
        self.assertIn([37.5,35.5],next_result['rows'][0]['excluded_targets']);self.assertNotEqual(next_result['rows'][0]['alternatives'][0]['target'],[37.5,35.5])
        s=Session(q);s.slot=8;s.correct({0:[10,20,30,0]});self.assertEqual(propose(s.project,settings)['rows'][0]['excluded_targets'],[])
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'review.aaa';Session(q).save(path);self.assertEqual(Session.load(path).project,q)

    def test_corrected_manual_bad_match_is_not_reproposed_for_same_source_hashes(self):
        p=fixture();g=deepcopy(p['motion_guides']['patch']);g['handles'][0]['target']=[37.5,35.5];p=save_guide(p,'patch',g);g=deepcopy(g);g['handles'][0]['target']=[38.5,35.5];p=save_guide(p,'patch',g)
        r=propose(p,defaults('patch'));self.assertIn([37.5,35.5],r['rows'][0]['excluded_targets'])

    def test_worker_recompute_tamper_replay_dependent_undo_and_cancel(self):
        p=fixture();settings=defaults('patch');decisions=[dict(landmark_id='pattern',candidate_index=0,decision='accept')]
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'match';create_correspondence_job(p,settings,job);self.assertEqual(execute(job)['state'],'completed');result=read(job/'result.json');tampered=deepcopy(result);tampered['correspondence_result']['rows'][0]['alternatives'][0]['target'][0]+=1;atomic_write(job/'result.json',tampered)
            with self.assertRaisesRegex(ValueError,'differs'):apply_correspondence_result(p,job,decisions,'bad')
            atomic_write(job/'result.json',result);s=Session(p);s.review_matches(job,decisions);self.assertEqual(len(s.project['correspondence_operations']),1)
            with self.assertRaises(ValueError):s.review_matches(job,decisions)
            s.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):apply_correspondence_result(s.project,job,decisions,'undo')
            cancel=Path(td)/'cancel';create_correspondence_job(p,settings,cancel);self.assertEqual(execute(cancel,lambda n:request_cancel(cancel))['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_packed_off_origin_image_search_and_unrelated_layer_edit(self):
        p=fixture(True,1920,1080,(700,300));r=propose(p,defaults('patch'));self.assertEqual(r['rows'][0]['alternatives'][0]['target'],[737.5,335.5]);q=review(p,r,[dict(landmark_id='pattern',candidate_index=0,decision='accept')],'HDmatch');Session(q);self.assertEqual(q['originals'],p['originals'])
        scope=subject(p,defaults('patch'))[0];p['layers']['other']=dict(name='Unrelated',visible=True,locked=False);p['exposures'] += [dict(layer_id='other',drawing_id='source',start=0,length=12)]
        self.assertEqual(subject(p,defaults('patch'))[0],scope)

    def test_invalid_controls_and_missing_guide_are_refused_without_mutation(self):
        p=fixture();before=fingerprint(p)
        for name,value in [('patch_radius',0),('search_radius',100),('max_error',float('nan')),('around','automatic')]:
            settings=defaults('patch');settings[name]=value
            with self.assertRaises(ValueError):propose(p,settings)
        self.assertEqual(fingerprint(p),before);p['motion_guides']['patch']['guide_slot']=None
        with self.assertRaisesRegex(ValueError,'approved target'):propose(p,defaults('patch'))


if __name__=='__main__':unittest.main()
