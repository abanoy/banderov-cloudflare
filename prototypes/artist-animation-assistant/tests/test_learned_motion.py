from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import tempfile,unittest,sys,subprocess
import numpy as np
from tests.test_joint_motion import fixture
from engine import learned_motion as learned,schedules
from engine.project import fingerprint
from engine.spatial_constraints import uniform
from hosts.standalone.session import Session


def fake(first,second,t,checkpoint):
    checkpoint();_,h,w=first.shape;a=np.zeros((2,h,w),np.float32);b=a.copy();a[0]=-4;b[0]=4
    return dict(flow0=a,flow1=b,weight=np.full((h,w),.5,np.float32),metadata=dict(backend='authored-translation-field-fixture',working_size=[w,h],component_ids=[],source_ids=[]))


def settings(p):return dict(learned.defaults(p,'actor',0,6,1,3),working_size=[64,48])


class LearnedMotionTests(unittest.TestCase):
    def test_unapproved_complete_layers_reopen_correct_undo_and_source_keys_survive(self):
        p,_=fixture();s=settings(p);before=fingerprint(p);r=learned._propose(p,s,runner=fake);self.assertEqual(r['unsafe_reasons'],[]);q=learned._install_fresh(p,r,'fixture',False);new=set(q['drawings'])-set(p['drawings']);self.assertEqual(len(new),2);self.assertTrue(all(q['drawings'][i]['approved'] is False for i in new));self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['shot'],p['shot'])
        for layer in ('ink','color'):
            for t in (0,6,7):self.assertEqual(next(e['drawing_id'] for e in q['exposures'] if e['layer_id']==layer and e['start']<=t<e['start']+e['length']),next(e['drawing_id'] for e in p['exposures'] if e['layer_id']==layer and e['start']<=t<e['start']+e['length']))
        session=Session(q);session.layer_id='ink';session.slot=1;session.correct({0:[20,40,60,80]});session.travel();self.assertEqual(session.project['drawings'],q['drawings'])
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'learned.aaa';Session(q).save(path);self.assertEqual(Session.load(path).project,q)
        self.assertEqual(fingerprint(p),before)

    def test_strict_accept_tamper_one_commit_and_unrelated_edit_preservation(self):
        p,_=fixture();p['layers']['other']=dict(name='Independent');p['drawings']['other']=dict(pixels=uniform(64,48),origin='artist',approved=True,locked=False);p['exposures'].append(dict(layer_id='other',drawing_id='other',start=0,length=8));s=settings(p)
        with patch('engine.rife_fields.infer',fake):
            r=learned.propose(p,s);bad=deepcopy(r);bad['outputs']['ink']['pixels']=bad['outputs']['ink']['pixels'].with_edits({0:[1,2,3,4]})
            with self.assertRaisesRegex(ValueError,'differs'):learned.accept(p,bad,'bad')
            with self.assertRaisesRegex(ValueError,'differs'):learned.reject(p,bad,'Forged result')
            self.assertNotIn('learned_motion_reviews',p)
            session=Session(p);session.layer_id='other';session.correct({0:[30,60,90,120]});prior=deepcopy(session.project);session.commit(learned.accept(session.project,r,'chosen'),'learned-review');self.assertEqual(session.project['drawings']['chosen-0']['approved'],True);session.travel();self.assertEqual(session.project['drawings'],prior['drawings']);self.assertEqual(session.project['exposures'],prior['exposures'])

    def test_actor_edit_undo_stales_but_rejection_survives_regeneration(self):
        p,_=fixture();s=settings(p)
        with patch('engine.rife_fields.infer',fake):
            r=learned.propose(p,s);session=Session(p);session.layer_id='ink';session.correct({0:[1,2,3,4]});session.travel()
            with self.assertRaises(ValueError):learned.accept(session.project,r,'stale')
            rejected=learned.reject(p,r,'Wrong shape');again=learned.propose(rejected,s);self.assertTrue(again['previously_rejected'])
            with self.assertRaisesRegex(ValueError,'rejected'):learned.accept(rejected,again,'refused')
        self.assertEqual(rejected['drawings'],p['drawings'])

    def test_events_required_keys_and_group_geometry_are_not_silently_removed(self):
        p,_=fixture();s=settings(p);p=schedules.save_constraints(p,'actor',dict(required_slots=[2],events=[]))
        with self.assertRaisesRegex(ValueError,'event|source key'):learned.subject(p,s)
        p,_=fixture();p['layers']['actor']['opacity']=128
        with self.assertRaisesRegex(ValueError,'hierarchical'):learned.subject(p,s)
        p,_=fixture();p['learned_motion_reviews']=[dict(signature='bad',inputs='bad',reason='x')]
        with self.assertRaisesRegex(ValueError,'history'):Session(p)

    def test_cancellation_does_not_install_partial_outputs(self):
        p,_=fixture();before=fingerprint(p);calls=[]
        def cancel():
            calls.append(1)
            if len(calls)==5:raise InterruptedError('cancel')
        with self.assertRaises(InterruptedError):learned._propose(p,settings(p),cancel,fake)
        self.assertEqual(fingerprint(p),before)


class OptionalLearnedRuntimeTests(unittest.TestCase):
    @unittest.skipUnless((Path(__file__).resolve().parents[1]/'models/rife-ncnn-audit/execution-manifest.json').is_file(),'Optional audited local model/runtime not configured')
    def test_actual_worker_strict_review_tamper_replay_and_cancel(self):
        from engine.jobs import create_learned_motion_job,execute,read,atomic_write,apply_learned_motion_result,request_cancel
        p,_=fixture();s=settings(p)
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'worker';create_learned_motion_job(p,s,job);root=Path(__file__).resolve().parents[1];done=subprocess.run([sys.executable,'-X','utf8',str(root/'scripts/worker.py'),'--job',str(job)],capture_output=True,text=True,timeout=45);self.assertEqual(done.returncode,0,done.stderr);result=read(job/'result.json');bad=deepcopy(result);bad['learned_result']['settings']['progress']=.4;atomic_write(job/'result.json',bad)
            with self.assertRaisesRegex(ValueError,'inner settings'):apply_learned_motion_result(p,job,'bad')
            atomic_write(job/'result.json',result);session=Session(p);session.apply_learned_motion(job);self.assertEqual(session.project['originals'],p['originals'])
            with self.assertRaisesRegex(ValueError,'already reviewed'):session.apply_learned_motion(job)
            session.travel();self.assertEqual(session.project['drawings'],p['drawings'])
            cancelled=Path(td)/'cancelled';create_learned_motion_job(p,s,cancelled);status=execute(cancelled,lambda tick:request_cancel(cancelled) if tick==6 else None);self.assertEqual(status['state'],'cancelled');self.assertFalse((cancelled/'result.json').exists())


if __name__=='__main__':unittest.main()
