from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import tempfile,unittest
from tests.test_candidate_corrections import edit_case,INDEX
from tests.test_learned_schedules import fields,authored
from hosts.standalone.session import Session
from engine import correction_rebind as rebind,candidate_corrections as corrections,learned_motion as learned,motion
from engine.project import fingerprint
from engine.spatial_constraints import uniform,ENCODING,count

def fixture():
    p,before,editor,rows=edit_case();q=corrections.adopt(p,before,editor.project,rows);identity=next(iter(q['candidate_corrections']));request=dict(rows[0]['request'],progress=.4);config=dict(correction_id=identity,version=0,family='learned',request=request,offset=[2,-1]);return q,config

class CorrectionRebindTests(unittest.TestCase):
    def test_hidden_jobs_preview_strict_commit_and_invalid_payload_delivery(self):
        from hosts.standalone.rebind_jobs import RebindJobs
        from hosts.standalone.learned_jobs import LearnedJobs
        from tests.test_candidate_corrections import wait
        with tempfile.TemporaryDirectory() as td,patch('engine.rife_fields.infer',fields),patch.object(LearnedJobs,'_infer',authored):
            p,c=fixture();jobs=RebindJobs(td);jobs.start('generate',p,settings=c);generated=wait(jobs);self.assertEqual(generated['state'],'ready');self.assertEqual(generated['completed_inferences'],1);r=generated['result'];jobs.start('preview',p,result=r,detail=[8,8,40,36]);event=wait(jobs);self.assertEqual(event['state'],'ready');self.assertEqual(len(event['frames']['source']),7);self.assertTrue(Path(event['preview_path']).is_file());self.assertEqual(Session.load(event['preview_path']).project,event['preview_project']);jobs.start('accept',p,result=r);accepted=wait(jobs);self.assertEqual(accepted['state'],'ready');self.assertEqual(accepted['prepared']['drawings'],p['drawings']);jobs.start('preview',p);bad=wait(jobs);self.assertEqual(bad['state'],'failed')

    def test_private_study_cli_path_keeps_input_and_approvals_and_lists_credits(self):
        import json
        from hosts.standalone.learned_jobs import LearnedJobs
        from scripts.study_correction_rebind import study
        with tempfile.TemporaryDirectory() as td,patch('engine.rife_fields.infer',fields),patch.object(LearnedJobs,'_infer',authored):
            folder=Path(td);p,c=fixture();source=folder/'source.aaa';Session(p).save(source);initial=source.read_bytes();settings=folder/'settings.json';settings.write_text(json.dumps(c));output=folder/'review';report=study(source,settings,output,[8,8,40,36]);self.assertFalse(report['accepted']);self.assertEqual(report['completed_inferences'],2);self.assertEqual(source.read_bytes(),initial);self.assertTrue((output/'THIRD_PARTY_NOTICES.txt').is_file());view=Session.load(output/'rebound-unapproved.aaa').project;self.assertEqual(view['originals'],p['originals']);self.assertTrue(all(view['drawings'][i]['approved'] is False for i in set(view['drawings'])-set(p['drawings'])))
            with self.assertRaisesRegex(ValueError,'NEW'):study(source,settings,output)

    def test_exact_translation_matches_independent_sparse_oracle_across_partial_tiles(self):
        w,h=97,81;marks={w+1:[33,66,99,0],64*w+63:[5,6,7,255],70*w+90:[10,20,30,44]};pixels=uniform(w,h).with_edits(marks);mask=uniform(w,h).with_edits({i:[1,0,0,0] for i in marks});old=dict(pixels=pixels,touched=mask,lineage=['a'*64]);moved=rebind.translate_patch(old,[2,3],lambda:None)
        expected={i+3*w+2:rgba for i,rgba in marks.items()};self.assertEqual(moved['pixels'],uniform(w,h).with_edits(expected));self.assertEqual(moved['touched'],uniform(w,h).with_edits({i:[1,0,0,0] for i in expected}));self.assertEqual(old['pixels'],pixels)
        with self.assertRaisesRegex(ValueError,'clip'):rebind.translate_patch(old,[-2,0],lambda:None)

    def test_rebind_phase_retains_old_version_source_drawings_and_unapproved_preview(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();initial=fingerprint(p);r=rebind.propose(p,c);q=rebind.accept(p,r);old=c['correction_id'];target=corrections.key(c['family'],c['request']);self.assertIsNone(q['candidate_corrections'][old]['active']);self.assertEqual(q['candidate_corrections'][old]['versions'],p['candidate_corrections'][old]['versions']);self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['exposures'],p['exposures']);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['candidate_corrections'][target]['active'],0);self.assertEqual(fingerprint(p),initial)
            raw=learned.propose(q,c['request']);index=INDEX-64+2;self.assertEqual(raw['outputs']['ink']['pixels'][index],[33,66,99,0]);self.assertEqual(raw['outputs']['ink']['protected_mask'][index][0],1);self.assertEqual(r['counts']['marked_pixels'],2)
            new=set(r['preview']['drawings'])-set(p['drawings']);self.assertTrue(new);self.assertTrue(all(r['preview']['drawings'][i]['approved'] is False for i in new));self.assertNotEqual(r['raw_view_sha256'],r['preview_sha256'])
            with tempfile.TemporaryDirectory() as td:
                file=Path(td)/'rebound.aaa';Session(q).save(file);self.assertEqual(Session.load(file).project,q)

    def test_same_request_source_change_appends_instead_of_overwriting_old_version(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();identity=c['correction_id'];c['request']=deepcopy(p['candidate_corrections'][identity]['request']);session=Session(p);session.layer_id='ink';session.slot=6;session.correct({INDEX+10:[4,5,6,255]});changed=session.project
            r=rebind.propose(changed,c);q=rebind.accept(changed,r);self.assertEqual(len(q['candidate_corrections'][identity]['versions']),2);self.assertEqual(q['candidate_corrections'][identity]['versions'][0],p['candidate_corrections'][identity]['versions'][0]);self.assertEqual(q['candidate_corrections'][identity]['active'],1);self.assertEqual(q['drawings'],changed['drawings'])

    def test_cross_generator_review_keeps_same_actor_complete_layers(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();c.update(family='geometric',request=motion.request_at_time(p,'move',.4,1,2));r=rebind.propose(p,c);q=rebind.accept(p,r);fresh=motion.propose(q,c['request']);self.assertEqual(fresh['outputs']['ink']['pixels'][INDEX-64+2],[33,66,99,0]);self.assertTrue(all(d['approved'] is False for i,d in r['preview']['drawings'].items() if i not in p['drawings']))

    def test_source_edit_undo_or_correction_epoch_invalidates_prior_review(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();r=rebind.propose(p,c);s=Session(p);s.layer_id='ink';s.correct({0:[1,2,3,4]});s.travel()
            with self.assertRaisesRegex(ValueError,'differs'):rebind.accept(s.project,r)
            s=Session(p);s.commit(corrections.deactivate(p,c['correction_id']),'deactivate');s.travel()
            with self.assertRaisesRegex(ValueError,'differs'):rebind.accept(s.project,r)

    def test_independent_paint_survives_recomputed_constraints_only_commit_and_one_undo(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();p['layers']['Other']=dict(name='Other',visible=True,locked=False);p['drawings']['other']=dict(pixels=uniform(64,48),origin='artist',approved=True,locked=False);p['exposures'].append(dict(layer_id='Other',drawing_id='other',start=0,length=8));r=rebind.propose(p,c);s=Session(p);s.layer_id='Other';s.correct({1:[2,3,4,255]});new=s.project;q=rebind.accept(new,r);s.commit(q,'explicit-rebind');self.assertEqual(s.project['drawings'],new['drawings']);self.assertEqual(s.project['exposures'],new['exposures']);s.travel();self.assertEqual(s.project['candidate_corrections'],new['candidate_corrections']);self.assertEqual(s.project['drawings'],new['drawings'])

    def test_other_active_target_or_parent_child_cannot_be_silently_replaced(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();r=rebind.propose(p,c);q=rebind.accept(p,r)
            with self.assertRaisesRegex(ValueError,'active corrections'):rebind.propose(q,c)
            p,c=fixture();c['request']['actor_id']='ink'
            with self.assertRaisesRegex(ValueError,'same actor'):rebind.propose(p,c)

    def test_preview_config_backend_and_prepared_constraint_tamper_refuse(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();r=rebind.propose(p,c);bad=deepcopy(r);did=next(i for i in bad['preview']['drawings'] if i not in p['drawings']);bad['preview']['drawings'][did]['pixels']=bad['preview']['drawings'][did]['pixels'].with_edits({0:[1,2,3,4]})
            with self.assertRaisesRegex(ValueError,'comparison'):rebind.accept(p,bad)
            bad=deepcopy(r);target=corrections.key(c['family'],c['request']);bad['prepared']['candidate_corrections'][target]['active']=None
            with self.assertRaisesRegex(ValueError,'constraints'):rebind.accept(p,bad)
            bad=deepcopy(r);bad['config']['offset'][0]+=1
            with self.assertRaisesRegex(ValueError,'differs'):rebind.accept(p,bad)
            def changed(a,b,t,checkpoint):
                out=fields(a,b,t,checkpoint);out['flow0'][0]+=.5;return out
            with patch('engine.rife_fields.infer',changed):
                with self.assertRaisesRegex(ValueError,'differs'):rebind.accept(p,r)

    def test_rejection_preserves_constraint_versions_and_prevents_same_review_acceptance(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();r=rebind.propose(p,c);q=rebind.reject(p,r,'Wrong placement');self.assertEqual(q['candidate_corrections'],p['candidate_corrections']);fresh=rebind.propose(q,c);self.assertTrue(fresh['previously_rejected'])
            with self.assertRaisesRegex(ValueError,'rejected'):rebind.accept(q,fresh)
            c['offset']=[3,-1];self.assertFalse(rebind.propose(q,c)['previously_rejected'])

    def test_new_protected_pixels_cannot_be_overwritten_and_cancel_preserves_source(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();initial=fingerprint(p);calls=[]
            def cancel():
                calls.append(1)
                if len(calls)>4:raise RuntimeError('cancelled')
            with self.assertRaisesRegex(RuntimeError,'cancelled'):rebind.propose(p,c,cancel)
            self.assertEqual(fingerprint(p),initial);s=Session(p);s.layer_id='ink';s.correct({INDEX-64+2:[99,88,77,255]})
            with self.assertRaisesRegex(ValueError,'protected|override|conflict'):rebind.propose(s.project,c)

    def test_capacity_and_invalid_mapping_are_explicit_without_deleting_history(self):
        with patch('engine.rife_fields.infer',fields):
            p,c=fixture();bad=deepcopy(c);bad['offset']=[True,0]
            with self.assertRaisesRegex(ValueError,'integer'):rebind.propose(p,bad)
            c['request']=deepcopy(p['candidate_corrections'][c['correction_id']]['request']);p['candidate_corrections'][c['correction_id']]['versions']*=8
            with self.assertRaisesRegex(ValueError,'capacity8'):rebind.propose(p,c)

if __name__=='__main__':unittest.main()
