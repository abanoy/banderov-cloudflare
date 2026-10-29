from pathlib import Path
from copy import deepcopy
import tempfile,unittest
from engine.project import create,fingerprint
from engine.schedules import defaults,propose,accept,reject,save_constraints,subject,validate_metadata
from engine.jobs import create_schedule_job,execute,read,atomic_write,apply_schedule_result,request_cancel
from engine.layers import render
from hosts.standalone.session import Session

def fixture(repeated=False,packed=False):
    pixels=[[0,0,0,0] for _ in range(64)]
    def image(n):
        p=deepcopy(pixels);p[8+n]=[40,120,210,255];p[16+n]=[20,30,40,200];return p
    p=create(image(0),8,8,12);p['project_id']='original-schedule-test';p['layers']={'actor':dict(name='One actor',nodetype='grouplayer',visible=True,locked=False,isolation='isolate'),'ink':dict(name='Ink',parent_id='actor',order=0,visible=True,locked=False),'color':dict(name='Color',parent_id='actor',order=1,visible=True,locked=False)};p['exposures']=[];p['drawings']={};p['originals']={}
    for i in range(6):
        n=[0,1,0,2,3,0][i] if repeated else i
        for layer in ('ink','color'):
            did=layer+str(i);values=image(n)
            if layer=='ink':values=[value if value[3]==200 else [0,0,0,0] for value in values]
            else:values=[value if value[3]==255 else [0,0,0,0] for value in values]
            if packed:
                from engine.io.project_archive import PixelPlane
                values=PixelPlane.from_pixels(8,8,values)
            d=dict(pixels=values,origin='artist' if i in (0,5) else 'reviewed_landmark_motion',approved=True,locked=i in (0,5));p['drawings'][did]=d
            if i in (0,5):p['originals'][did]=deepcopy(d)
            p['exposures'].append(dict(layer_id=layer,drawing_id=did,start=2*i,length=2))
    p['schema_version']='0.2' if packed else '0.1';p['originals_sha256']=fingerprint(p['originals']);return p

class ScheduleTests(unittest.TestCase):
    def test_event_key_duration_fps_and_art_preserved(self):
        p=fixture();p=save_constraints(p,'actor',dict(required_slots=[4],events=[dict(id='touch',label='Contact',kind='contact',slot=6,length=2)]));before=fingerprint(p);settings=dict(defaults(p,'actor'),budget_count=4);r=propose(p,settings)
        self.assertEqual(r['required_distinct_states'],4);self.assertFalse(r['conflicts']);self.assertEqual(fingerprint(p),before)
        for c in r['candidates']:
            q=accept(p,r,c['id'],'timed-'+c['id']);self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['shot'],p['shot']);self.assertEqual(c['new_raster_assets'],0);self.assertEqual(c['distinct_actor_states'],4)
            for slot in (0,4,6,7,10,11):self.assertEqual(render(q,slot),render(p,slot))
    def test_hard_infeasible_and_soft_preference(self):
        p=fixture();p=save_constraints(p,'actor',dict(required_slots=[4],events=[]));r=propose(p,dict(defaults(p,'actor'),budget_count=2));self.assertFalse(r['candidates']);self.assertIn('3 distinct required',r['conflicts'][0])
        soft=propose(p,dict(defaults(p,'actor'),budget_mode='preference',budget_count=1));self.assertFalse(soft['conflicts']);self.assertTrue(all(c['distinct_actor_states']==3 for c in soft['candidates']));self.assertIn('Preferred 1',soft['warnings'][-1])
        target=propose(p,dict(defaults(p,'actor'),budget_mode='target',budget_count=7));self.assertFalse(target['candidates']);self.assertIn('requires new poses',target['conflicts'][0])
    def test_repeated_actor_states_count_once_line_color_together(self):
        p=fixture(repeated=True);r=propose(p,dict(defaults(p,'actor'),budget_count=2));self.assertEqual(r['distinct_source_states'],4);self.assertTrue(all(c['distinct_actor_states']==2 for c in r['candidates']));self.assertTrue(all(c['raster_assets_reused']>2 for c in r['candidates']))
        for c in r['candidates']:self.assertEqual(c['segments'][0]['drawings'],dict(ink='ink0',color='color0'));self.assertEqual(c['segments'][-1]['drawings'],dict(ink='ink5',color='color5'))
    def test_protected_corrected_hold_cannot_be_dropped(self):
        p=fixture();p['drawings']['color2'].update(origin='artist_correction',locked=True);r=propose(p,dict(defaults(p,'actor'),budget_count=3));q=accept(p,r,'sampled_change','protected');self.assertEqual(render(q,4),render(p,4));self.assertEqual(render(q,5),render(p,5));self.assertTrue(any('protected' in reason for a in r['required'] for reason in a['reasons']))
    def test_selected_interval_and_other_layer_are_exact(self):
        p=fixture();p['layers']['other']=dict(name='Other',visible=True,locked=False);p['exposures'].append(dict(layer_id='other',drawing_id='color0',start=0,length=12));r=propose(p,dict(defaults(p,'actor'),start=2,end=10,budget_count=2));q=accept(p,r,'sampled_change','local');self.assertEqual([e for e in p['exposures'] if e['layer_id']=='other'],[e for e in q['exposures'] if e['layer_id']=='other'])
        for t in (0,1,10,11):self.assertEqual(render(q,t),render(p,t))
    def test_worker_tamper_replay_cancel_and_undo_staleness(self):
        p=fixture(packed=True);s=defaults(p,'actor');s['budget_count']=3
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'schedule';create_schedule_job(p,s,job);self.assertEqual(execute(job)['state'],'completed');raw=read(job/'result.json');bad=deepcopy(raw);bad['schedule_result']['candidates'][0]['segments'][0]['length']+=1;atomic_write(job/'result.json',bad)
            with self.assertRaisesRegex(ValueError,'differs'):apply_schedule_result(p,job,'sampled_change','bad')
            atomic_write(job/'result.json',raw);session=Session(p);session.apply_schedule(job,'sampled_change');session.travel()
            with self.assertRaisesRegex(ValueError,'Stale|reviewed'):apply_schedule_result(session.project,job,'sampled_change','replay')
            cancelled=Path(td)/'cancel';create_schedule_job(p,s,cancelled);self.assertEqual(execute(cancelled,lambda n:request_cancel(cancelled))['state'],'cancelled');self.assertFalse((cancelled/'result.json').exists())
    def test_dependent_constraint_edit_undo_stays_stale_and_unrelated_edit_survives(self):
        p=fixture();s=defaults(p,'actor');before=subject(p,s)[0];session=Session(p);session.commit(save_constraints(p,'actor',dict(required_slots=[4],events=[])),'event');session.travel();self.assertNotEqual(subject(session.project,s)[0],before)
        p['layers']['other']=dict(name='Unrelated',visible=True,locked=False);p['exposures'].append(dict(layer_id='other',drawing_id='ink0',start=0,length=12));self.assertEqual(subject(p,s)[0],before)
    def test_rejection_suppression_persistence_and_no_drawing_loss(self):
        p=fixture(packed=True);s=dict(defaults(p,'actor'),budget_count=3);r=propose(p,s);q=reject(p,r,'sampled_change');self.assertEqual(q['drawings'],p['drawings']);r2=propose(q,s);self.assertTrue(r2['candidates'][0]['previously_rejected'])
        with self.assertRaisesRegex(ValueError,'rejected'):accept(q,r2,'sampled_change','bad')
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'timing.aaa';Session(q).save(path);self.assertEqual(Session.load(path).project,q)
    def test_invalid_events_controls_and_partial_actor_fail_safely(self):
        p=fixture();before=fingerprint(p)
        for key,value in [('budget_count',0),('budget_count',True),('end',13),('budget_unit','asset_count'),('budget_mode','automatic')]:
            with self.assertRaises(ValueError):propose(p,dict(defaults(p,'actor'),**{key:value}))
        for event in [dict(id='x',label='Bad',kind='contact',slot=11,length=2),dict(id='x',label='Bad',kind='wrong',slot=2,length=1)]:
            with self.assertRaises(ValueError):save_constraints(p,'actor',dict(required_slots=[],events=[event]))
        self.assertEqual(fingerprint(p),before)


    def test_actual_unrelated_correction_survives_pending_schedule_worker(self):
        p=fixture(packed=True);p['layers']['other']=dict(name='Other',visible=True,locked=False);p['exposures'].append(dict(layer_id='other',drawing_id='color0',start=0,length=12));settings=dict(defaults(p,'actor'),budget_count=3)
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'job';create_schedule_job(p,settings,job);execute(job);session=Session(p);session.layer_id='other';session.correct({0:[10,20,30,0]});changed=deepcopy(session.project);session.apply_schedule(job,'sampled_change');self.assertEqual([e for e in session.project['exposures'] if e['layer_id']=='other'],[e for e in changed['exposures'] if e['layer_id']=='other']);self.assertEqual(session.project['drawings'],changed['drawings'])

    def test_region_geometry_domain_palette_binding_survive_retiming_and_revision(self):
        from hosts.standalone.reference_fixtures import fixture as region_fixture
        from engine.motion import propose as move,accept as move_accept
        from engine.fill_revision import propose_revision
        p=region_fixture()
        from engine.region_domains import OWNERSHIP_ENCODING
        p['fill_regions']['cap'].update(ownership_domain=list(range(4096)),ownership_encoding=OWNERSHIP_ENCODING,component_seeds=[])
        p['part_bindings']={'cap':dict(character_id='hero',part_id='cap',target_bounds=[16,4,40,18],reference_id=None,origin='artist_correction')}
        p['motion_guides']={'shift':dict(name='Approved shift',actor_id='cap',source_slot=0,guide_slot=None,roi=[0,0,64,64],handles=[dict(id='shift',source=[30,30],target=[32,30],enabled=True)])}
        p=move_accept(p,move(p,dict(guide_id='shift',mode='rigid',progress=1,target_start=2,target_end=4,operation_id=None,allow_clip=False)),'moved')
        # The initial source/blank artist keys are retained; shifted proposal can go.
        request=dict(defaults(p,'cap'),budget_count=2);r=propose(p,request);self.assertFalse(r['conflicts']);q=accept(p,r,'sampled_change','retimed');self.assertEqual(q['drawings'],p['drawings']);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['motion_operations'],p['motion_operations']);Session(q)
        active=[(rid,reg) for rid,reg in q['fill_regions'].items() if reg['start']==0]
        self.assertTrue(active)
        for rid,region in active:
            self.assertEqual(region['length'],4);result=propose_revision(q,rid,region['settings']);self.assertEqual(result['fill'],q['drawings'][region['fill_drawing']]['pixels'])
        self.assertEqual(q['fill_regions']['cap']['ownership_domain'],p['fill_regions']['cap']['ownership_domain']);self.assertEqual(q['part_bindings']['cap'],p['part_bindings']['cap'])
        from engine.regions import propose_palette,accept_palette
        colored=accept_palette(q,propose_palette(q,dict(action='recolor',palette_id='unassigned',rgba=[100,80,240,128])),'new-palette')
        Session(colored)
        self.assertTrue(q['schedule_operations'][-1]['region_snapshot']);self.assertTrue(q['schedule_operations'][-1]['region_parents'])

    def test_invalid_saved_schedule_events_are_rejected_on_load(self):
        p=fixture();p['schedule_constraints']={'actor':dict(required_slots=[100],events=[])}
        with self.assertRaises(ValueError):Session(p)


    def test_accepted_metadata_uses_plain_scalars_and_compact_roundtrip(self):
        for packed in (False,True):
            p=fixture(packed=packed);settings=dict(defaults(p,'actor'),budget_count=3);r=propose(p,settings);self.assertTrue(all(type(c['sampled_deviation']) is float for c in r['candidates']));q=accept(p,r,'sampled_change','saved');Session(q)
            with tempfile.TemporaryDirectory() as td:
                path=Path(td)/'accepted.aaa';Session(q).save(path);self.assertEqual(Session.load(path).project,q)


    def test_manual_hold_cannot_silently_move_a_saved_contact(self):
        p=save_constraints(fixture(),'actor',dict(required_slots=[],events=[dict(id='contact',label='Contact',kind='contact',slot=2,length=2)]));session=Session(p);session.layer_id='ink';before=deepcopy(session.project)
        with self.assertRaisesRegex(ValueError,'required event'):session.hold(3)
        self.assertEqual(session.project,before);self.assertFalse(session.past);session.hold(1)
        for slot in (2,3):self.assertEqual(render(session.project,slot),render(p,slot))


    def test_hd_subsample_detail_is_not_reported_as_zero_layer_content_change(self):
        from engine.spatial_constraints import uniform
        from engine.schedules import layer_content_distance
        a=uniform(1920,1080).with_edits({101*1920+101:[210,40,90,255]});b=uniform(1920,1080).with_edits({101*1920+102:[210,40,90,255]});p=create(a,1920,1080,2);p['drawings']['b']=dict(pixels=b,origin='proposal',approved=True,locked=False);p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=1),dict(layer_id='ink',drawing_id='b',start=1,length=1)];plane_cache={};pair_cache={};distance=layer_content_distance(p,dict(ink='source'),dict(ink='b'),plane_cache,pair_cache,lambda:None);self.assertGreater(distance,0);self.assertEqual(layer_content_distance(p,dict(ink='b'),dict(ink='source'),plane_cache,pair_cache,lambda:None),distance)
        expected=2*sum((channel*255)**2 for channel in [210,40,90,255])/(1920*1080*4*255**4);self.assertAlmostEqual(distance,expected,places=20)

if __name__=='__main__':unittest.main()
