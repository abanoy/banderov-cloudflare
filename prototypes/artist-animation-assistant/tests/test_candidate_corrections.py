from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import json,shutil,tempfile,time,unittest
from tests.test_joint_motion import fixture
from tests.test_learned_schedules import fields,config,authored
from hosts.standalone.session import Session
from hosts.standalone.learned_jobs import LearnedJobs
from hosts.standalone.learned_schedule_jobs import LearnedScheduleJobs
from hosts.standalone.candidate_editor import CorrectionJobs
from engine import candidate_corrections as corrections,learned_motion as learned,learned_schedules as pools,joint_motion as joint,motion
from engine.project import fingerprint
from engine.spatial_constraints import uniform,drawing_mask
ROOT=Path(__file__).resolve().parents[1];INDEX=20*64+20

def wait(jobs):
    jobs.join(30)
    if jobs.busy:jobs.cancel();raise AssertionError('Correction task did not finish')
    event=jobs.poll()
    if event is None:raise AssertionError('Missing correction event')
    return event
def edit_case(family='learned',source=None):
    p,g=fixture() if source is None else (source,fixture()[1])
    result=pools.propose(p,config(p)) if family=='learned' else joint.propose(p,g)
    preview=pools.preview(p,result,'sampled_change') if family=='learned' else joint.preview(p,result,'sampled_change')
    before,rows=corrections.editable_copy(p,preview);editor=Session(before);editor.layer_id='ink';editor.slot=rows[0]['request']['target_start'];editor.correct({INDEX:[33,66,99,0],INDEX+1:[19,29,39,255]});return p,before,editor,rows


class CandidateCorrectionTests(unittest.TestCase):
    def test_painting_candidate_never_approves_generated_surroundings(self):
        p,_=fixture()
        with patch('engine.rife_fields.infer',fields):
            _,before,editor,rows=edit_case();drawing=editor.project['drawings'][editor.drawing_id()];self.assertIs(drawing['approved'],False);self.assertTrue(drawing['candidate_correction']);self.assertEqual(drawing['candidate_touched_mask'][INDEX][0],1);self.assertEqual(drawing['candidate_touched_mask'][0][0],0)
            artist=Session(p);artist.layer_id='ink';artist.correct({INDEX:[1,2,3,4]});self.assertIs(artist.project['drawings'][artist.drawing_id()]['approved'],True)
            editor.travel();self.assertEqual(editor.project['drawings'],before['drawings'])

    def test_learned_adoption_preserves_erase_exact_other_pixels_and_reopen(self):
        with patch('engine.rife_fields.infer',fields):
            p,before,editor,rows=edit_case();source_hash=fingerprint(p);q=corrections.adopt(p,before,editor.project,rows);self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['exposures'],p['exposures']);self.assertEqual(q['originals'],p['originals']);r=learned.propose(q,rows[0]['request']);out=r['outputs']['ink'];self.assertEqual(out['pixels'][INDEX],[33,66,99,0]);self.assertEqual(out['pixels'][INDEX+1],[19,29,39,255]);self.assertEqual(out['protected_mask'][INDEX][0],1)
            expected=editor.project['drawings'][editor.drawing_id()]['pixels'];self.assertEqual(out['pixels'],expected)
            with tempfile.TemporaryDirectory() as td:
                path=Path(td)/'source.aaa';Session(q).save(path);loaded=Session.load(path).project;self.assertEqual(loaded,q);self.assertEqual(learned.propose(loaded,rows[0]['request'])['outputs']['ink']['pixels'],expected)
            self.assertEqual(fingerprint(p),source_hash)

    def test_geometric_reused_layer_forks_and_pool_regeneration_keeps_patch(self):
        p,g=fixture()
        for did in ['color0','color6']:
            p['drawings'][did]['pixels']=uniform(64,48);p['originals'][did]=deepcopy(p['drawings'][did])
        p['originals_sha256']=fingerprint(p['originals']);g['schedule']['budget_count']=5;r=joint.propose(p,g);preview=joint.preview(p,r,'sampled_change');before,rows=corrections.editable_copy(p,preview);row=rows[0];self.assertNotEqual(row['drawings']['color'],'color0');self.assertIs(before['drawings'][row['drawings']['color']]['approved'],False)
        editor=Session(before);editor.layer_id='color';editor.slot=row['request']['target_start'];index=45*64+60;editor.correct({index:[7,17,27,200]});q=corrections.adopt(p,before,editor.project,rows);fresh=motion.propose(q,row['request']);self.assertEqual(fresh['outputs']['color']['pixels'][index],[7,17,27,200]);self.assertGreaterEqual(fresh['output_roi'][2],61);self.assertGreaterEqual(fresh['output_roi'][3],46)
        combined=joint.propose(q,g);view=joint.preview(q,combined,'sampled_change');self.assertTrue(any(d['pixels'][index]==[7,17,27,200] for did,d in view['drawings'].items() if did in combined['generated_assets']));self.assertTrue(all(view['drawings'][did]['approved'] is False for did in combined['generated_assets']))

    def test_protected_corrected_pose_cannot_be_skipped_by_exhausted_budget(self):
        with patch('engine.rife_fields.infer',fields):
            p,before,editor,rows=edit_case();q=corrections.adopt(p,before,editor.project,rows);s=config(q,2);r=pools.propose(q,s);self.assertEqual(r['counts']['motion_samples_evaluated'],2);self.assertTrue(r['schedule']['conflicts']);self.assertEqual(r['schedule']['required_distinct_states'],3)
            good=pools.propose(q,config(q,3));view=pools.preview(q,good,'sampled_change');slot=rows[0]['request']['target_start'];did=next(e['drawing_id'] for e in view['exposures'] if e['layer_id']=='ink' and e['start']<=slot<e['start']+e['length']);self.assertEqual(view['drawings'][did]['pixels'][INDEX],[33,66,99,0]);self.assertIs(view['drawings'][did]['approved'],False)

    def test_versions_activation_and_undo_keep_old_proposals_stale(self):
        with patch('engine.rife_fields.infer',fields):
            p,before,editor,rows=edit_case();old=learned.propose(p,rows[0]['request']);q=corrections.adopt(p,before,editor.project,rows);session=Session(p);session.commit(q,'adopt');identity=next(iter(q['candidate_corrections']));session.travel()
            with self.assertRaisesRegex(ValueError,'differs'):learned.accept(session.project,old,'stale-before-adopt-undo')
            session.travel(undo=False);active=session.project;deactivated=corrections.deactivate(active,identity);self.assertEqual(len(deactivated['candidate_corrections'][identity]['versions']),1);self.assertIsNone(deactivated['candidate_corrections'][identity]['active']);restored=corrections.activate(deactivated,identity,0);self.assertEqual(learned.propose(restored,rows[0]['request'])['outputs']['ink']['pixels'][INDEX],[33,66,99,0])
            _,before2,edit2,rows2=edit_case(source=restored);edit2.correct({INDEX+2:[90,80,70,255]});new=corrections.adopt(restored,before2,edit2.project,rows2);self.assertEqual(len(new['candidate_corrections'][identity]['versions']),2);fresh=learned.propose(new,rows[0]['request']);self.assertEqual(fresh['outputs']['ink']['pixels'][INDEX],[33,66,99,0]);self.assertEqual(fresh['outputs']['ink']['pixels'][INDEX+2],[90,80,70,255])

    def test_tampered_masks_approval_source_and_structure_refuse(self):
        with patch('engine.rife_fields.infer',fields):
            p,before,editor,rows=edit_case();bad=deepcopy(editor.project);bad['drawings'][editor.drawing_id()]['approved']=True
            with self.assertRaisesRegex(ValueError,'unapproved'):corrections.adopt(p,before,bad,rows)
            bad=deepcopy(editor.project);bad['drawings'][editor.drawing_id()]['candidate_touched_mask']=uniform(64,48)
            with self.assertRaisesRegex(ValueError,'outside'):corrections.adopt(p,before,bad,rows)
            bad=deepcopy(editor.project);bad['layers']['ink']['name']='Unexpected layer edit'
            with self.assertRaisesRegex(ValueError,'cannot discard'):corrections.adopt(p,before,bad,rows)
            bad=deepcopy(editor.project);bad['drawings']['ink0']['pixels']=bad['drawings']['ink0']['pixels'].with_edits({0:[1,2,3,4]})
            with self.assertRaisesRegex(ValueError,'overwritten'):corrections.adopt(p,before,bad,rows)
            q=corrections.adopt(p,before,editor.project,rows);identity=next(iter(q['candidate_corrections']));q['candidate_corrections'][identity]['active']=99
            with self.assertRaisesRegex(ValueError,'version'):Session(q)

    def test_independent_source_paint_survives_but_same_source_epoch_refuses(self):
        p,_=fixture();p['layers']['other']=dict(name='Independent');p['drawings']['other']=dict(pixels=uniform(64,48),approved=True,locked=False,origin='artist');p['exposures'].append(dict(layer_id='other',drawing_id='other',start=0,length=8))
        with patch('engine.rife_fields.infer',fields):
            _,before,editor,rows=edit_case(source=p);source=Session(p);source.layer_id='other';source.correct({0:[1,2,3,4]});prior=deepcopy(source.project);q=corrections.adopt(source.project,before,editor.project,rows);self.assertEqual(q['drawings'],prior['drawings']);source.commit(q,'adopt');source.travel();self.assertEqual(source.project['drawings'],prior['drawings'])
            source=Session(p);source.layer_id='ink';source.correct({0:[1,2,3,4]});source.travel()
            with self.assertRaisesRegex(ValueError,'source/correction state|source changed'):corrections.adopt(source.project,before,editor.project,rows)

    def test_changed_pose_method_and_parent_child_selection_cannot_drop_patch(self):
        with patch('engine.rife_fields.infer',fields):
            p,before,editor,rows=edit_case();q=corrections.adopt(p,before,editor.project,rows);request=deepcopy(rows[0]['request']);request['progress']+=.1
            with self.assertRaisesRegex(ValueError,'overlaps changed'):learned.propose(q,request)
            child=deepcopy(rows[0]['request']);child['actor_id']='ink'
            with self.assertRaisesRegex(ValueError,'overlaps changed'):learned.propose(q,child)
            geo=motion.request_at_time(p,'move',.5,rows[0]['request']['target_start'],rows[0]['request']['target_end'])
            with self.assertRaisesRegex(ValueError,'overlaps changed'):motion.propose(q,geo)

    def test_changed_model_pixels_and_cancel_preserve_retained_constraints(self):
        with patch('engine.rife_fields.infer',fields):p,before,editor,rows=edit_case();q=corrections.adopt(p,before,editor.project,rows)
        original=fingerprint(q)
        def changed(a,b,t,check):
            result=fields(a,b,t,check);result['flow0'][1]=.4;return result
        with patch('engine.rife_fields.infer',changed):
            with self.assertRaisesRegex(ValueError,'Regenerated candidate pixels'):learned.propose(q,rows[0]['request'])
        with self.assertRaises(InterruptedError):corrections.adopt(p,before,editor.project,rows,lambda:(_ for _ in ()).throw(InterruptedError('cancel')))
        self.assertEqual(fingerprint(q),original)

    def test_private_context_resume_checks_hashes_and_retains_controls(self):
        with patch('engine.rife_fields.infer',fields),tempfile.TemporaryDirectory() as td:
            p,_=fixture();r=pools.propose(p,config(p));preview=pools.preview(p,r,'sampled_change');jobs=CorrectionJobs(td);directory=jobs.start('prepare',dict(source=p,preview=preview,controls=dict(values=dict(phase='.5',budget='3'),guide=None),tool='learned'),'first');ready=wait(jobs);self.assertEqual(ready['state'],'ready',ready.get('error'));editor=ready['editor'];row=ready['rows'][0];editor.layer_id='ink';editor.slot=row['request']['target_start'];editor.correct({INDEX:[33,66,99,0]});editor.save(directory/'edited.aaa');jobs.start('resume',dict(path=str(directory)),'resume');resumed=wait(jobs);self.assertEqual(resumed['state'],'ready',resumed.get('error'));self.assertEqual(resumed['editor'].project,editor.project);self.assertEqual(resumed['controls']['values']['budget'],'3');manifest=json.loads((directory/'context.json').read_text());manifest['source_sha256']='0'*64;(directory/'context.json').write_text(json.dumps(manifest));jobs.start('resume',dict(path=str(directory)),'bad');bad=wait(jobs);self.assertEqual(bad['state'],'failed');self.assertIn('source/baseline changed',bad['error'])

    def test_withdrawn_editor_prepare_enter_adopt_restore_and_one_undo(self):
        import tkinter as tk
        from hosts.standalone.native_app import NativeApp
        root=tk.Tk();root.withdraw()
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored),patch('engine.rife_fields.infer',fields):
            app=NativeApp(root,private_root=td);p,_=fixture();app.replace_session(Session(p));source=app.session;panel=app.learned_panel;editor=app.candidate_editor
            def pump(condition):
                deadline=time.monotonic()+20
                while not condition():
                    root.update();time.sleep(.005)
                    if time.monotonic()>deadline:raise AssertionError(panel.message.get()+' / '+editor.message.get())
                root.update()
            try:
                panel.actor.set('actor');panel.width.set('64');panel.height.set('48');panel.insert_end.set('3');panel.pool_mode.set(True);panel.budget.set('3');settings=panel.settings();panel.generate();pump(lambda:panel.ready is not None and not panel.jobs.busy);panel.compare();pump(lambda:panel.preview_data is not None and not panel.jobs.busy);editor.prepare(panel);pump(lambda:editor.prepared is not None and not editor.jobs.busy);self.assertIs(app.session,source);self.assertTrue((Path(editor.prepared['context_directory'])/'source.aaa').is_file());editor.enter();self.assertIsNot(app.session,source);app.session.correct({INDEX:[33,66,99,0]});self.assertIs(app.session.project['drawings'][app.session.drawing_id()]['approved'],False);editor.adopt();pump(lambda:editor.context is None and not editor.jobs.busy);self.assertIs(app.session,source);self.assertEqual(source.project['drawings'],p['drawings']);self.assertEqual(panel.budget.get(),'3');self.assertTrue(panel.pool_mode.get());self.assertTrue(source.project['candidate_corrections']);self.assertEqual(panel.settings(),settings);panel.generate();pump(lambda:panel.ready is not None and not panel.jobs.busy);self.assertFalse(panel.ready['schedule']['conflicts']);panel.compare();pump(lambda:panel.preview_data is not None and not panel.jobs.busy);regenerated=panel.preview_data['project'];slot=next(iter(source.project['candidate_corrections'].values()))['request']['target_start'];did=next(e['drawing_id'] for e in regenerated['exposures'] if e['layer_id']=='ink' and e['start']<=slot<e['start']+e['length']);self.assertEqual(regenerated['drawings'][did]['pixels'][INDEX],[33,66,99,0]);self.assertIs(regenerated['drawings'][did]['approved'],False);source.travel();self.assertFalse(source.project.get('candidate_corrections'));self.assertFalse(root.winfo_ismapped())
            finally:
                editor.close();editor.jobs.join(10);panel.close();app.joint_panel.close();app.native_closed=True;app.cancel_native();root.after_cancel(app.native_poll_ticket)
                if app.packed_ticket is not None:root.after_cancel(app.packed_ticket);app.packed_ticket=None
                root.destroy()

    def test_editor_parameters_changed_after_prepare_require_new_context(self):
        import tkinter as tk
        from hosts.standalone.native_app import NativeApp
        root=tk.Tk();root.withdraw()
        with tempfile.TemporaryDirectory() as td,patch.object(LearnedJobs,'_infer',authored):
            app=NativeApp(root,private_root=td);p,_=fixture();app.replace_session(Session(p));panel=app.learned_panel;editor=app.candidate_editor
            def pump(condition):
                end=time.monotonic()+20
                while not condition():
                    root.update();time.sleep(.005)
                    if time.monotonic()>end:raise AssertionError(editor.message.get())
                root.update()
            try:
                panel.actor.set('actor');panel.width.set('64');panel.height.set('48');panel.insert_end.set('3');panel.generate();pump(lambda:panel.ready is not None and not panel.jobs.busy);panel.compare();pump(lambda:panel.preview_data is not None and not panel.jobs.busy);editor.prepare(panel);pump(lambda:editor.prepared is not None and not editor.jobs.busy);source=app.session;panel.phase.set('.4');self.assertIsNone(editor.prepared)
                with self.assertRaisesRegex(ValueError,'context changed|Context changed'):editor.enter()
                self.assertIs(app.session,source);self.assertFalse(root.winfo_ismapped())
            finally:
                editor.close();editor.jobs.join(10);panel.close();app.joint_panel.close();app.native_closed=True;app.cancel_native();root.after_cancel(app.native_poll_ticket)
                if app.packed_ticket is not None:root.after_cancel(app.packed_ticket);app.packed_ticket=None
                root.destroy()

    def test_candidate_editor_source_binding_fails_closed(self):
        from scripts.provenance_gate import verify_ui
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);proof=json.loads((ROOT/'evaluation/standalone-credits-lineage.json').read_text())
            for item in list(proof['files'].values())+list(proof['extension']['files'].values()):
                target=root/item['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],target)
            file=root/'evaluation/standalone-credits-lineage.json';file.parent.mkdir(exist_ok=True);file.write_text(json.dumps(proof));verify_ui(root);editor=root/proof['extension']['files']['candidate_editor']['path'];old=editor.read_bytes();editor.write_bytes(old+b'\n# changed candidate editor\n')
            with self.assertRaisesRegex(ValueError,'evidence changed: candidate_editor'):verify_ui(root)
            editor.write_bytes(old);proof['extension']['files'].pop('candidate_editor');[proof['extension']['files'].pop(k) for k in ['rebind_panel','rebind_jobs','rebind_compare']];file.write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError,'Candidate correction evidence is missing'):verify_ui(root)

    @unittest.skipUnless((ROOT/'models/rife-ncnn-audit/execution-manifest.json').is_file(),'Optional audited CPU runtime not configured')
    def test_real_owned_worker_reapplies_explicit_erase_without_approval(self):
        p,_=fixture();s=config(p);jobs=None
        with tempfile.TemporaryDirectory() as td:
            jobs=LearnedScheduleJobs(td);jobs.start('generate',p,s);r=wait(jobs);self.assertEqual(r['state'],'ready',r.get('error'));jobs.start('preview',p,result=r['result'],choice='sampled_change');view=wait(jobs);self.assertEqual(view['state'],'ready',view.get('error'));before,rows=corrections.editable_copy(p,view['preview_project']);editor=Session(before);editor.layer_id='ink';editor.slot=rows[0]['request']['target_start'];editor.correct({INDEX:[33,66,99,0]});q=corrections.adopt(p,before,editor.project,rows);jobs.start('generate',q,s);fresh=wait(jobs);self.assertEqual(fresh['state'],'ready',fresh.get('error'));jobs.start('preview',q,result=fresh['result'],choice='sampled_change');shown=wait(jobs);self.assertEqual(shown['state'],'ready',shown.get('error'));slot=rows[0]['request']['target_start'];project=shown['preview_project'];did=next(e['drawing_id'] for e in project['exposures'] if e['layer_id']=='ink' and e['start']<=slot<e['start']+e['length']);self.assertEqual(project['drawings'][did]['pixels'][INDEX],[33,66,99,0]);self.assertEqual(drawing_mask(project['drawings'][did])[INDEX][0],1);self.assertIs(project['drawings'][did]['approved'],False)

if __name__=='__main__':unittest.main()
