from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import json,shutil,tempfile,time,unittest
from tests.test_joint_motion import fixture
from tests.test_learned_motion import fake,settings
from engine import learned_motion as learned
from engine.project import fingerprint
from engine.spatial_constraints import uniform
from hosts.standalone.session import Session
from hosts.standalone.learned_jobs import LearnedJobs,Cancelled
from hosts.standalone.joint_jobs import merge_prepared,comparison_frames
ROOT=Path(__file__).resolve().parents[1]

def wait(jobs):
    jobs.join(30)
    if jobs.busy:jobs.cancel();raise AssertionError('Learned worker did not finish')
    result=jobs.poll()
    if result is None:raise AssertionError('Missing learned event')
    return result

def authored(self,p,s,directory,cancel,checkpoint):return learned._propose(p,s,checkpoint,fake)


class LearnedEditorTests(unittest.TestCase):
    def test_background_strict_review_preview_and_independent_history_merge(self):
        p,_=fixture();p['layers']['other']=dict(name='Independent');p['drawings']['other']=dict(pixels=uniform(64,48),origin='artist',approved=True,locked=False);p['exposures'].append(dict(layer_id='other',drawing_id='other',start=0,length=8));before=fingerprint(p)
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored):
            jobs=LearnedJobs(td);jobs.start('generate',p,settings(p));event=wait(jobs);self.assertEqual(event['state'],'ready',event.get('error'));r=event['result']
            jobs.start('preview',p,result=r,detail=[4,4,32,32]);preview=wait(jobs);self.assertEqual(preview['state'],'ready',preview.get('error'));q=Session.load(preview['preview_path']).project;self.assertTrue(all(d['approved'] is False for i,d in q['drawings'].items() if i not in p['drawings']));self.assertEqual(preview['frames']['detail_rectangle'],(4,4,32,32));self.assertEqual(len(preview['frames']['source']),7)
            jobs.start('accept',p,result=r);event=wait(jobs);self.assertEqual(event['state'],'ready',event.get('error'))
            current=deepcopy(p);current['learned_motion_reviews']=[dict(signature='a'*64,inputs='b'*64,reason='Independent earlier review')];session=Session(current);session.layer_id='other';session.correct({0:[10,20,30,40]});prior=deepcopy(session.project);session.commit(merge_prepared(event['base'],event['prepared'],session.project),'learned-review');self.assertEqual(session.project['learned_motion_reviews'],prior['learned_motion_reviews']);self.assertEqual(session.project['drawings']['other'],prior['drawings']['other']);session.travel();self.assertEqual(session.project['drawings'],prior['drawings'])
            jobs.start('reject',p,result=r,reason='Incorrect expression');event=wait(jobs);self.assertEqual(event['state'],'ready');self.assertEqual(event['prepared']['drawings'],p['drawings']);self.assertEqual(event['prepared']['learned_motion_reviews'][0]['reason'],'Incorrect expression');self.assertEqual(fingerprint(p),before)

    def test_tampered_result_and_detail_bounds_refuse_without_installing(self):
        p,_=fixture();r=learned._propose(p,settings(p),runner=fake);r['signature']='0'*64
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored):
            jobs=LearnedJobs(td);jobs.start('reject',p,result=r,reason='Forged');event=wait(jobs);self.assertEqual(event['state'],'failed');self.assertIn('differs',event['error']);self.assertNotIn('prepared',event)
        context=dict(schedule=dict(start=0,end=7),motion_samples=[],detail_rectangle=[0,0,65,48])
        with self.assertRaisesRegex(ValueError,'Detail bounds'):comparison_frames(p,p,context,lambda:None)

    def test_cancellation_and_status_failure_are_delivered(self):
        p,_=fixture();before=fingerprint(p)
        def slow(self,p,s,d,cancel,checkpoint):
            for i in range(100):time.sleep(.01);checkpoint()
            raise AssertionError('Not cancelled')
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',slow):
            jobs=LearnedJobs(td);jobs.start('generate',p,settings(p));jobs.cancel();event=wait(jobs);self.assertEqual(event['state'],'cancelled');self.assertNotIn('prepared',event)
        import hosts.standalone.learned_jobs as module
        write=module.atomic_write
        def fail(path,value):
            if Path(path).name=='status.json':raise OSError('Synthetic disk failure')
            return write(path,value)
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored),patch.object(module,'atomic_write',fail):
            jobs=LearnedJobs(td);jobs.start('generate',p,settings(p));event=wait(jobs);self.assertEqual(event['state'],'failed');self.assertIn('persist task status',event['error'])
        self.assertEqual(fingerprint(p),before)

    def test_learned_credits_sources_are_bound_and_missing_proof_refuses(self):
        from scripts.provenance_gate import verify_ui
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);proof=json.loads((ROOT/'evaluation/standalone-credits-lineage.json').read_text())
            for item in list(proof['files'].values())+list(proof['extension']['files'].values()):
                dst=root/item['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],dst)
            file=root/'evaluation/standalone-credits-lineage.json';file.parent.mkdir(parents=True,exist_ok=True);file.write_text(json.dumps(proof));verify_ui(root)
            panel=root/proof['extension']['files']['learned_panel']['path'];before=panel.read_bytes();panel.write_bytes(before+b'\n# changed learned panel\n')
            with self.assertRaisesRegex(ValueError,'evidence changed: learned_panel'):verify_ui(root)
            panel.write_bytes(before)
            for role in ['learned_panel','learned_jobs','learned_schedule_jobs','candidate_editor','rebind_panel','rebind_jobs','rebind_compare']:proof['extension']['files'].pop(role)
            file.write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError,'Learned extension evidence is missing'):verify_ui(root)

    def test_withdrawn_controls_stale_context_acceptance_gate_and_one_undo(self):
        import tkinter as tk
        from hosts.standalone.native_app import NativeApp
        root=tk.Tk();root.withdraw()
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored):
            app=NativeApp(root,private_root=td);p,_=fixture();app.replace_session(Session(p));panel=app.learned_panel
            def pump(condition):
                deadline=time.monotonic()+15
                while not condition():
                    root.update();time.sleep(.005)
                    if time.monotonic()>deadline:raise AssertionError(panel.message.get())
                root.update()
            try:
                panel.actor.set('actor');panel.width.set('64');panel.height.set('48');panel.insert_end.set('3');panel.generate();pump(lambda:panel.ready is not None and not panel.jobs.busy)
                with self.assertRaisesRegex(ValueError,'explicitly open'):panel.review(False)
                before_children=root.winfo_children();panel.compare();pump(lambda:panel.preview_data is not None and not panel.jobs.busy);self.assertEqual(root.winfo_children(),before_children);self.assertNotIn('opened',panel.preview_data)
                panel.compare();self.assertTrue(panel.preview_data['opened']);self.assertFalse(panel.comparison.window.winfo_ismapped());panel.review(False);pump(lambda:panel.ready is None and not panel.jobs.busy);self.assertEqual(len(app.session.project['learned_motion_operations']),1);app.session.travel();self.assertEqual(app.session.project['drawings'],p['drawings'])
                panel.generate();pump(lambda:panel.ready is not None and not panel.jobs.busy);app.session.layer_id='ink';app.session.correct({0:[1,2,3,4]});app.session.travel();root.update();panel.poll_once();self.assertIsNone(panel.ready)
                panel.generate();pump(lambda:panel.ready is not None and not panel.jobs.busy);panel.phase.set('.4');self.assertIsNone(panel.ready);self.assertIsNone(panel.preview_data);self.assertFalse(root.winfo_ismapped())
            finally:
                panel.close();app.joint_panel.close();app.native_closed=True;app.cancel_native();root.after_cancel(app.native_poll_ticket);root.destroy()

    @unittest.skipUnless((ROOT/'models/rife-ncnn-audit/execution-manifest.json').is_file(),'Optional audited CPU runtime not configured')
    def test_real_owned_process_preview_review_and_cancellation(self):
        p,_=fixture();before=fingerprint(p)
        with tempfile.TemporaryDirectory() as td:
            jobs=LearnedJobs(td);directory=jobs.start('generate',p,settings(p));generated=wait(jobs);self.assertEqual(generated['state'],'ready',generated.get('error'));self.assertTrue((directory/'owned-process.json').is_file())
            jobs.start('preview',p,result=generated['result']);preview=wait(jobs);self.assertEqual(preview['state'],'ready',preview.get('error'));self.assertTrue(Path(preview['preview_path']).is_file())
            jobs.start('accept',p,result=generated['result']);review=wait(jobs);self.assertEqual(review['state'],'ready',review.get('error'));self.assertTrue(review['prepared']['learned_motion_operations'][0]['approved']);self.assertEqual(fingerprint(p),before)
            directory=jobs.start('generate',p,settings(p));deadline=time.monotonic()+15
            while not (directory/'owned-process.json').exists() and jobs.busy:
                time.sleep(.001)
                if time.monotonic()>deadline:raise AssertionError('Owned process did not start')
            jobs.cancel();cancelled=wait(jobs);self.assertEqual(cancelled['state'],'cancelled');self.assertNotIn('prepared',cancelled);self.assertEqual(fingerprint(p),before)
            directory=jobs.start('generate',p,settings(p));deadline=time.monotonic()+15
            while jobs.process is None and jobs.busy:
                time.sleep(.001)
                if time.monotonic()>deadline:raise AssertionError('Owned shutdown process did not start')
            process=jobs.process;jobs.shutdown();stopped=wait(jobs);self.assertEqual(stopped['state'],'cancelled');self.assertIsNotNone(process.returncode);self.assertIsNone(jobs.process)

if __name__=='__main__':unittest.main()
