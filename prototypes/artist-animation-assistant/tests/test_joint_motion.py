from pathlib import Path
from copy import deepcopy
import tempfile,unittest,subprocess,sys
import numpy as np
from engine.project import create,fingerprint
from engine.io.project_archive import PixelPlane
from engine import joint_motion as joint,schedules,motion
from hosts.standalone.session import Session
from engine.jobs import create_joint_motion_job,execute,read,atomic_write,request_cancel,apply_joint_motion_result


def fixture():
    def image(shift,ink):
        a=np.zeros((48,64,4),np.uint8)
        for y in range(16,25):
            for x in range(16,25):
                edge=x in (16,24) or y in (16,24)
                if edge==ink:a[y,x+shift]=[25,30,40,255] if ink else [60,150,210,200]
        return PixelPlane.from_rgba(64,48,a.tobytes())
    p=create(image(0,True),64,48,8);p['layers']={'actor':dict(name='Original two-layer diagnostic',nodetype='grouplayer',visible=True,locked=False)};p['drawings']={};p['originals']={};p['exposures']=[]
    for order,layer in enumerate(['ink','color']):
        p['layers'][layer]=dict(name=layer,parent_id='actor',visible=True,locked=False,order=order)
        for t,shift in [(0,0),(6,8)]:
            did=layer+str(t);p['drawings'][did]=dict(pixels=image(shift,layer=='ink'),origin='artist',approved=True,locked=True);p['originals'][did]=deepcopy(p['drawings'][did]);p['exposures'].append(dict(layer_id=layer,drawing_id=did,start=t,length=6 if t==0 else 2))
    p['originals_sha256']=fingerprint(p['originals']);p['motion_guides']={'move':dict(name='Known translation, not inferred anatomy',actor_id='actor',source_slot=0,guide_slot=6,roi=[8,8,38,36],handles=[dict(id='a',source=[18.5,18.5],target=[26.5,18.5],enabled=True),dict(id='b',source=[22.5,23.5],target=[30.5,23.5],enabled=True)])}
    settings=dict(schedule=dict(schedules.defaults(p,'actor'),budget_count=3),motion_samples=[motion.request_at_time(p,'move',t,a,b) for t,a,b in [(.25,1,3),(.5,3,5),(.75,5,6)]])
    return p,settings


class JointMotionTests(unittest.TestCase):
    def test_legacy_joint_roundtrip_keeps_original_hashes_and_needs_no_silent_migration(self):
        p,s=fixture();p['schema_version']='0.1'
        for collection in ('drawings','originals'):
            for drawing in p[collection].values():drawing['pixels']=drawing['pixels'].materialize()
        p['originals_sha256']=fingerprint(p['originals']);r=joint.propose(p,s);q=joint.accept(p,r,'sampled_change','legacy-joint');self.assertEqual(q['schema_version'],'0.1');self.assertEqual(q['originals'],p['originals'])
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'joint.aaa.json';Session(q).save(path);self.assertEqual(Session.load(path).project,q)

    def test_separate_worker_tamper_replay_cancel_and_controller_review(self):
        p,s=fixture();root=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'worker';create_joint_motion_job(p,s,job)
            completed=subprocess.run([sys.executable,'-X','utf8',str(root/'scripts/worker.py'),'--job',str(job)],capture_output=True,text=True,timeout=60)
            self.assertEqual(completed.returncode,0,completed.stderr);result=read(job/'result.json');self.assertEqual(result['applicability'],'requires_review')
            altered=deepcopy(result);altered['joint_result']['counts']['new_raster_assets_computed']+=1;altered['output_sha256']=fingerprint(altered['joint_result']);atomic_write(job/'result.json',altered)
            with self.assertRaisesRegex(ValueError,'differs'):apply_joint_motion_result(p,job,'sampled_change','tampered')
            altered=deepcopy(result);different=deepcopy(s);different['schedule']['budget_count']=4;altered['joint_result']=joint.propose(p,different);altered['output_sha256']=fingerprint(altered['joint_result']);atomic_write(job/'result.json',altered)
            with self.assertRaisesRegex(ValueError,'inner settings'):apply_joint_motion_result(p,job,'sampled_change','wrong-settings')
            atomic_write(job/'result.json',result);session=Session(p);session.apply_joint_motion(job,'sampled_change')
            self.assertEqual(session.project['originals'],p['originals'])
            with self.assertRaisesRegex(ValueError,'already reviewed|Stale'):session.apply_joint_motion(job,'sampled_change')
            cancel=Path(td)/'cancel';create_joint_motion_job(p,s,cancel);self.assertEqual(execute(cancel,lambda row:request_cancel(cancel) if row==8 else None)['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_managed_regions_follow_selected_pool_timing_and_keep_palette_editing(self):
        from hosts.standalone.reference_fixtures import fixture as compartments,with_reference,request as color_request
        from engine.references import propose as color_propose,accept as color_accept
        from engine.regions import propose_palette,accept_palette
        p=with_reference(compartments());p=color_accept(p,color_propose(p,color_request()),'colored')
        p['motion_guides']={'shift':dict(name='Region translation',actor_id='cap',source_slot=0,guide_slot=4,roi=[0,0,64,64],handles=[dict(id='a',source=[20.5,20.5],target=[22.5,20.5],enabled=True),dict(id='b',source=[30.5,40.5],target=[32.5,40.5],enabled=True)])}
        s=dict(schedule=dict(schedules.defaults(p,'cap'),budget_count=3),motion_samples=[motion.request_at_time(p,'shift',.5,1,2),motion.request_at_time(p,'shift',1,2,4)])
        r=joint.propose(p,s);v=joint.preview(p,r,'sampled_change');self.assertTrue(any(region.get('geometry_status')=='transported_motion_candidate' for region in v['fill_regions'].values()))
        q=joint.accept(p,r,'sampled_change','joint-regions');Session(q)
        for region in q['fill_regions'].values():
            for layer in (region['ink_layer'],region['fill_layer']):
                e=motion._exposure(q,layer,region['start']);self.assertEqual((e['start'],e['length']),(region['start'],region['length']))
        palette=next(iter(q['palettes']));rgba=[33,150,75,160];changed=accept_palette(q,propose_palette(q,dict(action='recolor',palette_id=palette,rgba=rgba)),'joint-color');Session(changed);self.assertEqual(changed['palettes'][palette]['rgba'],rgba);self.assertEqual(q['originals'],p['originals'])

    def test_pool_and_preview_never_approve_dense_candidates_and_only_selection_is_approved(self):
        p,s=fixture();before=fingerprint(p);r=joint.propose(p,s);self.assertEqual(fingerprint(p),before)
        self.assertEqual(r['counts']['motion_samples_evaluated'],3);self.assertEqual(r['counts']['new_raster_assets_computed'],6);self.assertEqual(r['counts']['available_actor_states'],5)
        c=r['schedule']['candidates'][0];self.assertEqual(c['distinct_actor_states'],3)
        preview=joint.preview(p,r,c['id'])
        self.assertTrue(all(preview['drawings'][did]['approved'] is False for did in r['generated_assets']))
        with self.assertRaisesRegex(ValueError,'Review existing'):schedules.propose(preview,s['schedule'])
        q=joint.accept(p,r,c['id'],'joint-approved');exposed={e['drawing_id'] for e in q['exposures']}
        for did in r['generated_assets']:self.assertEqual(q['drawings'][did]['approved'],did in exposed)
        self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['shot'],p['shot'])
        for t in (0,6,7):self.assertEqual(schedules._bundle(q,['ink','color'],t),schedules._bundle(p,['ink','color'],t))

    def test_hard_conflict_and_required_event_never_become_optional(self):
        p,s=fixture();s['schedule']['budget_count']=1;r=joint.propose(p,s);self.assertTrue(r['schedule']['conflicts']);self.assertEqual(r['schedule']['candidates'],[])
        p=schedules.save_constraints(p,'actor',dict(required_slots=[],events=[dict(id='contact',label='Keep supplied contact sample',kind='contact',slot=3,length=1)]))
        with self.assertRaisesRegex(ValueError,'required source key'):joint.propose(p,s)

    def test_overlapping_holds_or_wrong_actor_and_tamper_refuse(self):
        p,s=fixture();bad=deepcopy(s);bad['motion_samples'][1]['target_start']=2
        with self.assertRaises(ValueError):joint.propose(p,bad)
        r=joint.propose(p,s);bad=deepcopy(r);bad['generated_assets'][next(iter(bad['generated_assets']))]='0'*64
        with self.assertRaisesRegex(ValueError,'differs'):joint.preview(p,bad,'sampled_change')

    def test_rejection_is_retained_across_pool_regeneration(self):
        p,s=fixture();r=joint.propose(p,s);q=joint.reject(p,r,'sampled_change');again=joint.propose(q,s)
        self.assertTrue(again['schedule']['candidates'][0]['previously_rejected'])
        with self.assertRaisesRegex(ValueError,'rejected'):joint.accept(q,again,'sampled_change','bad')
        self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['exposures'],p['exposures'])

    def test_one_commit_undo_reopen_and_unrelated_correction_survive(self):
        p,s=fixture();p['layers']['other']=dict(name='Unrelated');p['drawings']['other']=dict(pixels=PixelPlane.from_rgba(64,48,bytes(64*48*4)),origin='artist',approved=True,locked=True);p['exposures'].append(dict(layer_id='other',drawing_id='other',start=0,length=8))
        session=Session(p);r=joint.propose(p,s);session.layer_id='other';session.correct({0:[11,22,33,44]});other=deepcopy(session.project['drawings'][session.drawing_id()]);before=deepcopy(session.project)
        session.commit(joint.accept(session.project,r,'sampled_change','joint-one-action'),'review-joint')
        self.assertEqual(session.project['drawings'][session.drawing_id()],other)
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'joint.aaa';session.save(path);self.assertEqual(Session.load(path).project,session.project)
        session.travel();self.assertEqual(session.project['drawings'],before['drawings']);self.assertEqual(session.project['exposures'],before['exposures'])

    def test_dependent_edit_undo_is_stale_and_cancel_never_mutates_source(self):
        p,s=fixture();r=joint.propose(p,s);session=Session(p);g=deepcopy(p['motion_guides']['move']);g['name']='Changed';session.commit(motion.save_guide(session.project,'move',g),'guide');session.travel()
        with self.assertRaisesRegex(ValueError,'Stale'):joint.preview(session.project,r,'sampled_change')
        before=fingerprint(p)
        def cancel():raise InterruptedError('cancel')
        with self.assertRaises(InterruptedError):joint.propose(p,s,cancel)
        self.assertEqual(fingerprint(p),before)


if __name__=='__main__':unittest.main()
