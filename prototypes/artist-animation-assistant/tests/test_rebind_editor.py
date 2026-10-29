from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import tkinter as tk
import tempfile,time,json,shutil,unittest
from tests.test_correction_rebind import fixture
from tests.test_learned_schedules import fields,authored
from hosts.standalone.native_app import NativeApp
from hosts.standalone.session import Session
from hosts.standalone.learned_jobs import LearnedJobs
from engine.spatial_constraints import uniform
from engine import candidate_corrections as corrections
ROOT=Path(__file__).resolve().parents[1]
REAL_INFER=LearnedJobs._infer

class RebindEditorTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.p1=patch('engine.rife_fields.infer',fields);self.p1.start();self.p2=patch.object(LearnedJobs,'_infer',authored);self.p2.start();self.root=tk.Tk();self.root.withdraw();self.errors=[];self.root.report_callback_exception=lambda *args:self.errors.append(str(args));self.app=NativeApp(self.root,private_root=self.temp.name);p,c=fixture();p['layers']['Other']=dict(name='Other',visible=True,locked=False);p['drawings']['other']=dict(pixels=uniform(64,48),origin='artist',approved=True,locked=False);p['exposures'].append(dict(layer_id='Other',drawing_id='other',start=0,length=8));self.app.replace_session(Session(p));self.app.cancel_native();self.original=deepcopy(p);self.panel=self.app.rebind_panel;owner=self.app.learned_panel
        owner.actor.set('actor');owner.source.set('0');owner.end_key.set('6');owner.insert_start.set('1');owner.insert_end.set('2');owner.phase.set('.4');owner.width.set('64');owner.height.set('48');owner.pool_mode.set(False);self.panel.dx.set('2');self.panel.dy.set('-1');self.panel.detail.set('8 8 40 36');self.panel.correction_combo.current(0)
    def tearDown(self):
        self.app.rebind_panel.close();self.app.rebind_panel.jobs.join(10);self.app.candidate_editor.close();self.app.learned_panel.close();self.app.joint_panel.close();self.app.native_closed=True;self.app.cancel_native()
        if self.app.native_poll_ticket:self.root.after_cancel(self.app.native_poll_ticket)
        if self.app.packed_ticket is not None:self.root.after_cancel(self.app.packed_ticket);self.app.packed_ticket=None
        self.root.destroy();self.p2.stop();self.p1.stop();self.temp.cleanup()
    def pump(self,condition):
        end=time.monotonic()+30
        while not condition():
            self.root.update();time.sleep(.005)
            if self.errors:raise AssertionError(self.errors)
            if time.monotonic()>end:raise AssertionError(self.panel.message.get())
        self.root.update();self.assertFalse(self.errors)
    def prepare(self):
        self.panel.generate();self.pump(lambda:self.panel.ready is not None and not self.panel.jobs.busy);self.assertIsNone(self.panel.comparison);self.panel.compare();self.pump(lambda:self.panel.preview_data is not None and not self.panel.jobs.busy);self.assertIsNone(self.panel.comparison)
    def view_both(self):
        self.panel.compare();window=self.panel.comparison;self.assertFalse(window.window.winfo_ismapped());self.assertFalse(self.panel.reviewed);window.mode.set(window.MODES[1]);window.select_mode();self.assertTrue(self.panel.reviewed);return window
    def test_controls_review_gate_independent_paint_constraints_only_commit_and_one_undo(self):
        self.prepare()
        with self.assertRaisesRegex(ValueError,'both comparison'):self.panel.review(False)
        self.panel.compare()
        with self.assertRaisesRegex(ValueError,'both comparison'):self.panel.review(False)
        window=self.panel.comparison;window.detail.set(True);window.show(window.slot);window.mode.set(window.MODES[1]);window.select_mode();self.assertTrue(self.panel.reviewed);source=self.app.session;source.layer_id='Other';source.correct({3:[9,8,7,255]});independent=deepcopy(source.project);self.panel.review(False);self.pump(lambda:not self.panel.jobs.busy and self.panel.ready is None);self.assertEqual(source.project['drawings'],independent['drawings']);self.assertEqual(source.project['exposures'],independent['exposures']);self.assertEqual(source.project['originals'],independent['originals']);self.assertTrue(any(row['active'] is None for row in source.project['candidate_corrections'].values()));self.assertIn('still unapproved',self.panel.message.get());source.travel();self.assertEqual(source.project['candidate_corrections'],independent['candidate_corrections']);self.assertEqual(source.project['drawings'],independent['drawings']);self.assertFalse(self.root.winfo_ismapped())
    def test_changed_target_or_offset_invalidates_comparison_and_inflight_result(self):
        self.prepare();self.view_both();self.app.learned_panel.phase.set('.42');self.root.update();self.pump(lambda:self.panel.ready is None);self.assertIsNone(self.panel.comparison);self.assertFalse(self.panel.reviewed);self.panel.generate();self.panel.dx.set('3');self.panel.jobs.join(10);self.root.update();self.assertIsNone(self.panel.ready);self.assertEqual(self.app.session.project['drawings'],self.original['drawings'])
    def test_source_edit_and_undo_make_prior_review_stale(self):
        self.prepare();self.view_both();source=self.app.session;source.layer_id='ink';source.correct({0:[2,3,4,255]});source.travel();self.pump(lambda:self.panel.ready is None);self.assertFalse(self.panel.reviewed)
        with self.assertRaisesRegex(ValueError,'current rebind'):self.panel.review(False)
    def test_pool_sample_and_joint_target_use_actual_declared_request(self):
        owner=self.app.learned_panel;owner.pool_mode.set(True);owner.samples.set('2');owner.insert_end.set('3');owner.phase.set('.8');self.panel.sample.set('2');c=self.panel.config();self.assertEqual((c['request']['target_start'],c['request']['target_end'],c['request']['progress']),(2,3,.8));owner.samples.set('1');self.panel.sample.set('2')
        with self.assertRaisesRegex(ValueError,'sample'):self.panel.config()
        joint=self.app.joint_panel;joint.insert_start.set('1');joint.insert_end.set('6');joint.samples.set('3');self.panel.family.set('Joint motion');self.panel.sample.set('2');c=self.panel.config();self.assertEqual(c['family'],'geometric');self.assertEqual((c['request']['target_start'],c['request']['target_end']),(2,4));self.assertAlmostEqual(c['request']['clock_time'],2/6)
    def test_geometric_controls_generate_compare_and_commit_without_model(self):
        joint=self.app.joint_panel;joint.insert_start.set('1');joint.insert_end.set('3');joint.samples.set('2');self.panel.family.set('Joint motion');self.panel.sample.set('1')
        with patch.object(LearnedJobs,'_infer',side_effect=AssertionError('Geometric route cannot use a model')):
            self.prepare();self.view_both();self.panel.review(False);self.pump(lambda:self.panel.ready is None and not self.panel.jobs.busy)
        self.assertEqual(self.app.session.project['drawings'],self.original['drawings']);self.app.session.travel();self.assertEqual(self.app.session.project['candidate_corrections'],self.original['candidate_corrections'])
    @unittest.skipUnless((ROOT/'models/rife-ncnn-audit/execution-manifest.json').is_file(),'Optional audited runtime absent')
    def test_close_stops_only_its_real_owned_process_and_preserves_source(self):
        self.app.learned_panel.width.set('512');self.app.learned_panel.height.set('384')
        with patch.object(LearnedJobs,'_infer',REAL_INFER):
            self.panel.generate();self.pump(lambda:self.panel.jobs.process is not None and self.panel.jobs.process.poll() is None);owned=self.panel.jobs.process;self.panel.close();self.panel.jobs.join(20);self.assertFalse(self.panel.jobs.busy);self.assertIsNotNone(owned.poll());self.assertEqual(self.app.session.project,self.original);self.assertFalse(self.root.winfo_ismapped())
    def test_rejection_reason_and_rejected_history_guard(self):
        self.panel.generate();self.pump(lambda:self.panel.ready is not None and not self.panel.jobs.busy)
        with self.assertRaisesRegex(ValueError,'reason'):self.panel.review(True)
        self.panel.reason.set('Wrong correction placement');self.panel.review(True);self.pump(lambda:self.panel.ready is None and not self.panel.jobs.busy);self.assertEqual(self.app.session.project['candidate_corrections'],self.original['candidate_corrections']);self.panel.generate();self.pump(lambda:self.panel.ready is not None and not self.panel.jobs.busy);self.assertTrue(self.panel.ready['previously_rejected']);self.assertEqual(str(self.panel.accept_button.cget('state')),'disabled')
    def test_receipt_failure_does_not_misreport_completed_commit(self):
        self.prepare();self.view_both()
        with patch('hosts.standalone.rebind_panel.atomic_write',side_effect=OSError('receipt blocked')):
            self.panel.review(False);self.pump(lambda:self.panel.ready is None and not self.panel.jobs.busy)
        self.assertIn('Receipt could not be saved',self.panel.message.get());self.assertIn('rebound',self.panel.message.get());self.app.session.travel();self.assertEqual(self.app.session.project['candidate_corrections'],self.original['candidate_corrections'])
    def test_tool_chooser_reaches_all_pages_without_changing_indices(self):
        i=self.app.tool_pages.index(str(self.panel.page));self.app.tool_picker.current(i);self.app.tool_picker.event_generate('<<ComboboxSelected>>');self.root.update();self.assertEqual(self.app.tools.select(),str(self.panel.page));self.app.tools.select(0);self.root.update();self.assertEqual(self.app.tool_picker.current(),0);self.assertEqual(self.app.tools.tab(0,'text'),'Drawing');self.assertEqual(self.app.tools.tab(3,'text'),'Fill')
    def test_cancel_and_close_leave_source_and_no_window(self):
        self.panel.generate();self.panel.cancel();self.panel.jobs.join(10);self.root.update();self.assertIsNone(self.panel.ready);self.assertEqual(self.app.session.project,self.original);self.assertFalse(self.root.winfo_ismapped());self.panel.close();self.assertTrue(self.panel.closed);self.assertIsNone(self.panel.ticket)
    def test_old_placement_is_diagnostic_and_never_replaces_source(self):
        self.prepare();event=self.panel.preview_data;old=Session.load(event['old_placement_path']).project;raw=Session.load(event['raw_preview_path']).project;request=self.panel.ready['config']['request'];lid='ink';slot=request['target_start']
        def drawing(p):return p['drawings'][next(e['drawing_id'] for e in p['exposures'] if e['layer_id']==lid and e['start']<=slot<e['start']+e['length'])]
        index=20*64+20;self.assertEqual(drawing(old)['pixels'][index],[33,66,99,0]);self.assertIs(drawing(old)['approved'],False);self.assertNotEqual(drawing(raw)['pixels'][index],drawing(old)['pixels'][index]);self.assertEqual(self.app.session.project,self.original)
    def test_new_selected_helper_proof_is_required_and_hash_bound(self):
        from scripts.provenance_gate import verify_ui
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);proof=json.loads((ROOT/'evaluation/standalone-credits-lineage.json').read_text());items=list(proof['files'].values())+list(proof['extension']['files'].values())
            for item in items:
                out=root/item['path'];out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],out)
            file=root/'evaluation/standalone-credits-lineage.json';file.parent.mkdir(exist_ok=True);file.write_text(json.dumps(proof));verify_ui(root);helper=root/proof['extension']['files']['rebind_compare']['path'];data=helper.read_bytes();helper.write_bytes(data+b'\n# changed\n')
            with self.assertRaisesRegex(ValueError,'rebind_compare'):verify_ui(root)
            helper.write_bytes(data)
            for key in ['rebind_panel','rebind_jobs','rebind_compare']:proof['extension']['files'].pop(key)
            file.write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError,'Rebind editor evidence'):verify_ui(root)

if __name__=='__main__':unittest.main()
