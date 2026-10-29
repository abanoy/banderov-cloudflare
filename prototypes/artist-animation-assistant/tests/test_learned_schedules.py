from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import json,shutil,tempfile,time,unittest
import numpy as np
from tests.test_joint_motion import fixture
from tests.test_learned_editor import wait
from engine import learned_motion as learned,learned_schedules as pools,schedules
from engine.project import fingerprint
from hosts.standalone.learned_jobs import LearnedJobs
from hosts.standalone.learned_schedule_jobs import LearnedScheduleJobs
from hosts.standalone.joint_jobs import merge_prepared
from hosts.standalone.session import Session
ROOT=Path(__file__).resolve().parents[1]

def fields(first,second,t,checkpoint):
    checkpoint();_,h,w=first.shape;a=np.zeros((2,h,w),np.float32);b=a.copy();a[0]=-8*t;b[0]=8*(1-t)
    return dict(flow0=a,flow1=b,weight=np.full((h,w),1-t,np.float32),metadata=dict(backend='authored-two-key-translation-fixture',working_size=[w,h],source_ids=[],component_ids=[]))
def config(p,budget=3):
    requests=[dict(learned.defaults(p,'actor',0,6,i,i+1),working_size=[64,48],progress=t) for i,t in [(1,.25),(2,.5)]]
    return dict(schedule=dict(schedules.defaults(p,'actor'),budget_count=budget),learned_samples=requests)
def authored(self,p,s,d,cancel,checkpoint):return learned._propose(p,s,checkpoint,fields)


class LearnedScheduleTests(unittest.TestCase):
    def test_mandatory_budget_floor_skips_all_inference_and_reports_conflict(self):
        p,_=fixture();before=fingerprint(p)
        with patch('engine.rife_fields.infer',side_effect=AssertionError('Must not infer')):
            conflict=pools.propose(p,config(p,1));self.assertTrue(conflict['schedule']['conflicts']);self.assertEqual(conflict['counts']['motion_samples_evaluated'],0)
            r=pools.propose(p,config(p,2));self.assertFalse(r['schedule']['conflicts']);self.assertEqual(r['counts']['skipped_no_budget_capacity'],2);self.assertEqual(r['generated_assets'],{});q=pools.accept(p,r,'sampled_change','original-only');self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['originals'],p['originals'])
        self.assertEqual(fingerprint(p),before)

    def test_preview_never_approves_and_accept_selects_only_exposed_assets(self):
        p,_=fixture();before=fingerprint(p)
        with patch('engine.rife_fields.infer',fields):
            r=pools.propose(p,config(p));self.assertEqual(r['counts']['motion_samples_evaluated'],2);self.assertEqual(r['counts']['new_raster_assets_computed'],4);self.assertEqual(r['counts']['available_actor_states'],4)
            preview=pools.preview(p,r,'sampled_change');self.assertTrue(all(preview['drawings'][i]['approved'] is False for i in r['generated_assets']))
            with self.assertRaisesRegex(ValueError,'Review existing'):schedules.propose(preview,r['settings']['schedule'])
            q=pools.accept(p,r,'sampled_change','selected');exposed={e['drawing_id'] for e in q['exposures']};self.assertEqual(len(set(r['generated_assets'])&exposed),2)
            for did in r['generated_assets']:self.assertEqual(q['drawings'][did]['approved'],did in exposed)
            self.assertEqual(sum(row['approved'] for row in q['learned_motion_operations']),1)
            for t in (0,6,7):self.assertEqual(schedules._bundle(q,['ink','color'],t),schedules._bundle(p,['ink','color'],t))
            session=Session(p);session.commit(q,'pool-review');session.travel();self.assertEqual(session.project['drawings'],p['drawings'])
            with tempfile.TemporaryDirectory() as td:
                path=Path(td)/'unapproved.aaa';Session(preview).save(path);self.assertEqual(Session.load(path).project,preview)
            dense=pools.propose(p,config(p,4));all_chosen=pools.accept(p,dense,'sampled_change','all-chosen');self.assertTrue(all(all_chosen['drawings'][i]['approved'] is True for i in dense['generated_assets']))
        self.assertEqual(fingerprint(p),before)

    def test_events_source_keys_overlap_and_protected_holds_refuse_before_model(self):
        p,_=fixture();s=config(p);overlap=deepcopy(s);overlap['learned_samples'][1]['target_start']=1
        with self.assertRaisesRegex(ValueError,'disjoint'):pools.subject(p,overlap)
        protected=schedules.save_constraints(p,'actor',dict(required_slots=[2],events=[]))
        with self.assertRaisesRegex(ValueError,'event|source key'):pools.preflight(protected,s)
        event=schedules.save_constraints(p,'actor',dict(required_slots=[],events=[dict(id='contact',label='Supplied contact',kind='contact',slot=1,length=1)]))
        with self.assertRaisesRegex(ValueError,'event|source key'):pools.subject(event,s)
        wrong=deepcopy(s);wrong['learned_samples'][0]['actor_id']='ink'
        with self.assertRaisesRegex(ValueError,'complete'):pools.subject(p,wrong)

    def test_rejections_tamper_and_source_edit_undo_remain_strict(self):
        p,_=fixture();s=config(p)
        with patch('engine.rife_fields.infer',fields):
            r=pools.propose(p,s);bad=deepcopy(r);bad['counts']['new_raster_assets_computed']+=2
            with self.assertRaisesRegex(ValueError,'differs'):pools.accept(p,bad,'sampled_change','forged')
            with self.assertRaisesRegex(ValueError,'differs'):pools.reject(p,bad,'sampled_change')
            rejected=pools.reject(p,r,'sampled_change');again=pools.propose(rejected,s);self.assertTrue(again['schedule']['candidates'][0]['previously_rejected'])
            with self.assertRaisesRegex(ValueError,'rejected'):pools.accept(rejected,again,'sampled_change','refused')
            self.assertEqual(rejected['drawings'],p['drawings']);session=Session(p);session.layer_id='ink';session.correct({0:[1,2,3,4]});session.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):pools.accept(session.project,r,'sampled_change','stale')

    def test_cancel_unsafe_and_rejected_sample_do_not_install_partial_pool(self):
        p,_=fixture();before=fingerprint(p);ticks=[]
        def cancel():
            ticks.append(1)
            if len(ticks)==8:raise InterruptedError('cancel')
        with patch('engine.rife_fields.infer',fields):
            with self.assertRaises(InterruptedError):pools.propose(p,config(p),cancel)
            def unsafe(project,request,checkpoint):
                r=learned.propose(project,request,checkpoint);r['unsafe_reasons']=['protected sample loss'];return r
            with self.assertRaisesRegex(ValueError,'Repair learned'):pools._build(p,config(p),runner=unsafe)
            request=config(p)['learned_samples'][0];r=learned.propose(p,request);rejected=learned.reject(p,r,'Incorrect expression')
            with self.assertRaisesRegex(ValueError,'sample was rejected'):pools.propose(rejected,config(rejected))
        self.assertEqual(fingerprint(p),before)

    def test_background_pool_review_reason_and_zero_compute_route(self):
        p,_=fixture()
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored):
            jobs=LearnedScheduleJobs(td);jobs.start('generate',p,config(p));event=wait(jobs);self.assertEqual(event['state'],'ready',event.get('error'));status=json.loads((Path(event['directory'])/'status.json').read_text());self.assertEqual(status['sample_inference_attempts'],2);self.assertEqual(status['completed_pool_samples'],2);r=event['result'];jobs.start('preview',p,result=r,choice='sampled_change');preview=wait(jobs);self.assertEqual(preview['state'],'ready',preview.get('error'));self.assertTrue(Path(preview['preview_path']).is_file())
            jobs.start('reject',p,result=r,choice='sampled_change',reason='Timing feels early');rejected=wait(jobs);self.assertEqual(rejected['state'],'ready',rejected.get('error'));self.assertEqual(rejected['prepared']['history'][-1]['reason'],'Timing feels early')
            jobs.start('accept',p,result=r,choice='sampled_change');accepted=wait(jobs);self.assertEqual(accepted['state'],'ready',accepted.get('error'));session=Session(p);session.commit(merge_prepared(accepted['base'],accepted['prepared'],session.project),'review');session.travel();self.assertEqual(session.project['drawings'],p['drawings'])
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',side_effect=AssertionError('No budget for inference')):
            jobs=LearnedScheduleJobs(td);jobs.start('generate',p,config(p,2));event=wait(jobs);self.assertEqual(event['state'],'ready',event.get('error'));self.assertEqual(event['result']['counts']['motion_samples_evaluated'],0)
        def slow(self,p,s,d,cancel,checkpoint):
            for i in range(100):time.sleep(.005);checkpoint()
            return authored(self,p,s,d,cancel,checkpoint)
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',slow):
            jobs=LearnedScheduleJobs(td);jobs.start('generate',p,config(p));time.sleep(.03);jobs.cancel();event=wait(jobs);self.assertEqual(event['state'],'cancelled');status=json.loads((Path(event['directory'])/'status.json').read_text());self.assertIsNone(status['completed_pool_samples']);self.assertNotIn('prepared',event)

    def test_pool_proof_missing_or_changed_controller_refuses(self):
        from scripts.provenance_gate import verify_ui
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);proof=json.loads((ROOT/'evaluation/standalone-credits-lineage.json').read_text())
            for item in list(proof['files'].values())+list(proof['extension']['files'].values()):
                dst=root/item['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],dst)
            path=root/'evaluation/standalone-credits-lineage.json';path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(proof));verify_ui(root);addon=root/proof['extension']['files']['learned_schedule_jobs']['path'];before=addon.read_bytes();addon.write_bytes(before+b'\n# changed pool controller\n')
            with self.assertRaisesRegex(ValueError,'evidence changed: learned_schedule_jobs'):verify_ui(root)
            addon.write_bytes(before);proof['extension']['files'].pop('learned_schedule_jobs');proof['extension']['files'].pop('candidate_editor');[proof['extension']['files'].pop(k) for k in ['rebind_panel','rebind_jobs','rebind_compare']];path.write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError,'Learned pool evidence is missing'):verify_ui(root)

    def test_withdrawn_pool_controls_choice_epoch_and_selected_only_undo(self):
        import tkinter as tk
        from hosts.standalone.native_app import NativeApp
        root=tk.Tk();root.withdraw()
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored):
            app=NativeApp(root,private_root=td);p,_=fixture();app.replace_session(Session(p));panel=app.learned_panel
            def pump(condition):
                end=time.monotonic()+15
                while not condition():
                    root.update();time.sleep(.005)
                    if time.monotonic()>end:raise AssertionError(panel.message.get())
                root.update()
            try:
                panel.actor.set('actor');panel.width.set('64');panel.height.set('48');panel.insert_end.set('3');panel.pool_mode.set(True);panel.budget.set('3');panel.generate();pump(lambda:panel.ready is not None and not panel.jobs.busy);self.assertEqual(panel.ready['counts']['new_raster_assets_computed'],4);self.assertEqual(len(panel.choice_combo.cget('values')),3)
                panel.compare();pump(lambda:panel.preview_data is not None and not panel.jobs.busy);self.assertIsNone(panel.comparison);panel.compare();self.assertFalse(panel.comparison.window.winfo_ismapped());panel.choice_combo.current(1);panel.choice_changed();self.assertIsNone(panel.preview_data)
                with self.assertRaisesRegex(ValueError,'explicitly open'):panel.review(False)
                panel.compare();pump(lambda:panel.preview_data is not None and not panel.jobs.busy);panel.compare();panel.review(False);pump(lambda:panel.ready is None and not panel.jobs.busy);self.assertEqual(sum(row['approved'] for row in app.session.project['learned_motion_operations']),1);app.session.travel();self.assertEqual(app.session.project['drawings'],p['drawings']);self.assertFalse(root.winfo_ismapped())
            finally:
                panel.close();app.joint_panel.close();app.native_closed=True;app.cancel_native();root.after_cancel(app.native_poll_ticket)
                if app.packed_ticket is not None:root.after_cancel(app.packed_ticket);app.packed_ticket=None
                root.destroy()

    def test_receipt_failure_after_commit_reports_applied_state_and_keeps_undo(self):
        import tkinter as tk
        from hosts.standalone.native_app import NativeApp
        root=tk.Tk();root.withdraw()
        with tempfile.TemporaryDirectory() as td,patch('engine.rife_fields.infer',fields):
            app=NativeApp(root,private_root=td);p,_=fixture();app.replace_session(Session(p));panel=app.learned_panel;r=pools.propose(app.session.project,config(p));q=pools.accept(app.session.project,r,'sampled_change','receipt-test');panel.ready=r;panel.jobs.cancel_event.clear();root.after_cancel(panel.ticket);panel.ticket=None
            panel.jobs.done.put(dict(state='ready',operation='accept',token=(id(app.session),panel.serial),result=r,base=app.session.project,prepared=q,directory=td))
            try:
                with patch('hosts.standalone.learned_panel.atomic_write',side_effect=OSError('Synthetic receipt disk failure')):panel.poll()
                self.assertIn('accepted',panel.message.get().lower());self.assertIn('receipt',panel.message.get().lower());self.assertNotIn('refused',panel.message.get().lower());self.assertIsNone(panel.ready);self.assertEqual(app.session.counter,1);self.assertTrue(app.session.project.get('learned_motion_operations'));app.session.travel();self.assertEqual(app.session.project['drawings'],p['drawings']);self.assertFalse(root.winfo_ismapped())
            finally:
                panel.close();app.joint_panel.close();app.native_closed=True;app.cancel_native();root.after_cancel(app.native_poll_ticket)
                if app.packed_ticket is not None:root.after_cancel(app.packed_ticket);app.packed_ticket=None
                root.destroy()

    @unittest.skipUnless((ROOT/'models/rife-ncnn-audit/execution-manifest.json').is_file(),'Optional audited CPU runtime not configured')
    def test_real_per_sample_process_pool_and_strict_review(self):
        p,_=fixture();before=fingerprint(p)
        with tempfile.TemporaryDirectory() as td:
            jobs=LearnedScheduleJobs(td);directory=jobs.start('generate',p,config(p));event=wait(jobs);self.assertEqual(event['state'],'ready',event.get('error'));self.assertEqual(len(list(directory.rglob('owned-process.json'))),2);r=event['result'];jobs.start('accept',p,result=r,choice='sampled_change');review=wait(jobs);self.assertEqual(review['state'],'ready',review.get('error'));exposed={e['drawing_id'] for e in review['prepared']['exposures']}
            for did in r['generated_assets']:self.assertEqual(review['prepared']['drawings'][did]['approved'],did in exposed)
        self.assertEqual(fingerprint(p),before)

if __name__=='__main__':unittest.main()
