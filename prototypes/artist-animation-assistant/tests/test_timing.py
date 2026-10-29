from copy import deepcopy
from pathlib import Path
import tempfile,unittest
from engine.timing import inspect,propose,accept
from engine.schedules import save_constraints,preview
from engine.project import fingerprint
from engine.layers import render
from hosts.standalone.session import Session
from test_schedules import fixture


class TimingTests(unittest.TestCase):
    def test_adjacent_paired_holds_only_pixels_duration_and_count_unchanged(self):
        p=fixture(packed=True);before=fingerprint(p);r=propose(p,'actor',4,5);q=accept(p,r,'cut')
        self.assertEqual(fingerprint(p),before);self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['shot'],p['shot']);self.assertEqual(r['candidates'][0]['distinct_actor_states'],6)
        self.assertEqual([t for t in range(12) if render(q,t)!=render(p,t)],[4])
        for layer in ['ink','color']:
            self.assertEqual([(e['start'],e['length']) for e in q['exposures'] if e['layer_id']==layer],[(0,2),(2,3),(5,1),(6,2),(8,2),(10,2)])
        self.assertEqual(q['schedule_operations'][-1]['candidate']['old_cut'],4);self.assertEqual(q['schedule_operations'][-1]['candidate']['new_cut'],5)
    def test_event_edges_keys_and_protected_hold_conflicts_explained(self):
        p=save_constraints(fixture(),'actor',dict(required_slots=[4],events=[dict(id='touch',label='Foot contact',kind='contact',slot=6,length=2)]))
        for cut,to,reason in [(4,5,'required key'),(6,7,'Foot contact'),(8,7,'Foot contact'),(10,11,'artist/source key')]:
            with self.assertRaisesRegex(ValueError,reason):propose(p,'actor',cut,to)
        p=fixture();p['drawings']['color2'].update(origin='artist_correction',locked=True)
        for cut,to in [(4,5),(6,5)]:
            with self.assertRaisesRegex(ValueError,'protected corrected'):propose(p,'actor',cut,to)
    def test_parent_and_child_constraints_cannot_be_bypassed(self):
        p=save_constraints(fixture(),'actor',dict(required_slots=[4],events=[]))
        with self.assertRaisesRegex(ValueError,'required key'):propose(p,'ink',4,5)
        p=save_constraints(fixture(),'ink',dict(required_slots=[],events=[dict(id='child',label='Child event',kind='impact',slot=4,length=1)]))
        with self.assertRaisesRegex(ValueError,'Child event'):propose(p,'actor',4,5)
    def test_bounds_types_noop_and_gap_refuse_without_mutation(self):
        p=fixture();before=deepcopy(p)
        for cut,to in [(0,1),(12,11),(4,2),(4,6),(4,4),(True,3),(4,4.5)]:
            with self.assertRaises(ValueError):propose(p,'actor',cut,to)
        p['exposures'][0]['length']=1
        with self.assertRaisesRegex(ValueError,'cover'):inspect(p,'actor')
        p['exposures'][0]['length']=2;self.assertEqual(p,before)
    def test_stale_tamper_edit_undo_and_unrelated_edit_preservation(self):
        p=fixture(packed=True);r=propose(p,'actor',4,5);bad=deepcopy(r);bad['candidates'][0]['segments'][0]['length']+=1
        with self.assertRaisesRegex(ValueError,'changed'):accept(p,bad,'bad')
        s=Session(p);s.commit(save_constraints(p,'actor',dict(required_slots=[8],events=[])),'constraint');s.travel()
        with self.assertRaisesRegex(ValueError,'Stale'):accept(s.project,r,'stale')
        other=deepcopy(p);other['layers']['other']=dict(name='Other',visible=True,locked=False);other['exposures'].append(dict(layer_id='other',drawing_id='color0',start=0,length=12));s=Session(other);r=propose(s.project,'actor',4,5);s.layer_id='other';s.correct({0:[22,33,44,0]});q=accept(s.project,r,'keep-other');self.assertEqual(q['drawings'],s.project['drawings']);self.assertEqual([e for e in q['exposures'] if e['layer_id']=='other'],[e for e in s.project['exposures'] if e['layer_id']=='other'])
    def test_parent_constraint_edit_undo_stays_stale_for_child(self):
        s=Session(fixture());r=propose(s.project,'ink',4,5);s.commit(save_constraints(s.project,'actor',dict(required_slots=[8],events=[])),'parent');s.travel()
        with self.assertRaisesRegex(ValueError,'Stale'):accept(s.project,r,'stale')
    def test_undo_redo_and_both_archive_formats(self):
        for packed in (False,True):
            p=fixture(packed=packed);s=Session(p);s.commit(accept(p,propose(p,'actor',4,5),'saved'),'hold');accepted=deepcopy(s.project);s.travel();self.assertEqual(s.project['exposures'],p['exposures']);s.travel(False);self.assertEqual(s.project['exposures'],accepted['exposures'])
            with tempfile.TemporaryDirectory() as td:
                path=Path(td)/'holds.aaa';s.save(path);self.assertEqual(Session.load(path).project,s.project)
    def test_paired_region_geometry_palette_and_regeneration_after_move(self):
        from hosts.standalone.reference_fixtures import fixture as regions
        from engine.motion import propose as move,accept as accept_move
        from engine.fill_revision import propose_revision
        p=regions();p['motion_guides']={'shift':dict(name='Shift',actor_id='cap',source_slot=0,guide_slot=None,roi=[0,0,64,64],handles=[dict(id='shift',source=[30,30],target=[32,30],enabled=True)])}
        p=accept_move(p,move(p,dict(guide_id='shift',mode='rigid',progress=1,target_start=2,target_end=4,operation_id=None,allow_clip=False)),'move');r=propose(p,'cap',2,1);q=accept(p,r,'hold');Session(q)
        for rid,region in q['fill_regions'].items():
            result=propose_revision(q,rid,region['settings']);self.assertEqual(result['fill'],q['drawings'][region['fill_drawing']]['pixels'])
        self.assertEqual(q['palettes'],p['palettes']);self.assertEqual(q['motion_operations'],p['motion_operations']);self.assertTrue(q['schedule_operations'][-1]['region_snapshot'])

    def test_scheduler_cannot_bypass_hierarchical_event_or_edit_undo(self):
        from engine.schedules import propose as schedule,defaults as schedule_defaults,subject as schedule_subject
        p=save_constraints(fixture(),'ink',dict(required_slots=[],events=[dict(id='contact',label='Child contact',kind='contact',slot=4,length=1)]))
        r=schedule(p,dict(schedule_defaults(p,'actor'),budget_count=2));self.assertFalse(r['candidates']);self.assertIn('3 distinct required',r['conflicts'][0])
        s=Session(fixture());settings=schedule_defaults(s.project,'ink');before=schedule_subject(s.project,settings)[0]
        s.commit(save_constraints(s.project,'actor',dict(required_slots=[4],events=[])),'parent');s.travel();self.assertNotEqual(schedule_subject(s.project,settings)[0],before)

if __name__=='__main__':unittest.main()
