from copy import deepcopy
from pathlib import Path
import tempfile,unittest
from engine.motion import propose,accept,save_guide,subject
from engine.project import fingerprint
from engine.io.project_archive import PixelPlane
from engine.jobs import create_motion_job,execute,read,atomic_write,apply_motion_result,request_cancel
from engine.layers import render
from engine.regions import propose_palette,accept_palette,managed_pixels
from engine.spatial_constraints import uniform
from hosts.standalone.session import Session
from hosts.standalone.motion_fixtures import fixture,request


class MotionTests(unittest.TestCase):
    def test_rejected_corrected_matches_retain_source_hashes_and_roundtrip(self):
        p=fixture();g=deepcopy(p['motion_guides']['arm-lift']);old=deepcopy(g['handles'][-1]);g['handles'][-1]['target'][0]+=3
        q=save_guide(p,'arm-lift',g);history=q['motion_guides']['arm-lift']['rejected_matches'];self.assertEqual(len(history),1);self.assertEqual(history[0]['previous'],old)
        self.assertEqual(history[0]['inputs']['source:ink']['drawing_sha256'],fingerprint(p['drawings']['ink-start']))
        self.assertEqual(save_guide(q,'arm-lift',g),q)
        g=deepcopy(q['motion_guides']['arm-lift']);g['handles'].pop();q=save_guide(q,'arm-lift',g)
        self.assertEqual([r['reason'] for r in q['motion_guides']['arm-lift']['rejected_matches']],['corrected','removed'])
        with tempfile.TemporaryDirectory() as td:
            s=Session(q);path=Path(td)/'matches.aaa';s.save(path);self.assertEqual(Session.load(path).project,q)

    def test_grouped_pose_adds_editable_ink_color_key_and_preserves_both_original_keys(self):
        p=fixture();before=fingerprint(p);r=propose(p,request());self.assertEqual(r['unsafe_reasons'],[]);q=accept(p,r,'pose')
        self.assertEqual(fingerprint(p),before);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['shot'],p['shot']);self.assertEqual(len(q['drawings']),6)
        for layer in ['ink','paint']:
            self.assertEqual([(e['start'],e['length']) for e in q['exposures'] if e['layer_id']==layer],[(0,4),(4,4),(8,4)])
            self.assertEqual(next(e for e in q['exposures'] if e['layer_id']==layer and e['start']==0)['drawing_id'],layer+'-start');self.assertEqual(next(e for e in q['exposures'] if e['layer_id']==layer and e['start']==8)['drawing_id'],layer+'-end')
            self.assertEqual(q['drawings'][layer+'-start'],p['drawings'][layer+'-start']);self.assertEqual(q['drawings'][layer+'-end'],p['drawings'][layer+'-end'])
        self.assertNotEqual(render(q,4),render(p,0));self.assertEqual(render(q,0),render(p,0));self.assertEqual(render(q,8),render(p,8));Session(q)

    def test_correspondence_correction_is_persistent_and_interval_local(self):
        p=fixture();first=accept(p,propose(p,request()),'pose');guide=deepcopy(first['motion_guides']['arm-lift']);guide['handles'][-1]['target'][0]+=5
        corrected=save_guide(first,'arm-lift',guide);r=propose(corrected,request(operation_id='pose'));q=accept(corrected,r,'revision')
        self.assertEqual(q['motion_operations'][-1]['operation_id'],'pose');self.assertEqual(q['motion_operations'][-1]['revision_number'],1);self.assertNotEqual(render(q,4),render(first,4));self.assertEqual(render(q,0),render(first,0));self.assertEqual(render(q,8),render(first,8));self.assertEqual(q['drawings']['pose-drawing-0'],first['drawings']['pose-drawing-0'])

    def test_target_artist_paint_and_erase_survive_regeneration(self):
        p=fixture();s=Session(accept(p,propose(p,request()),'pose'));s.layer_id='paint';s.slot=4;s.correct({80*128+64:[230,40,100,255],40*128+70:[80,90,100,0]});current=s.drawing_id()
        q=accept(s.project,propose(s.project,request(progress=.65,operation_id='pose')),'revised');e=next(e for e in q['exposures'] if e['layer_id']=='paint' and e['start']==4);d=q['drawings'][e['drawing_id']]
        self.assertEqual(d['pixels'][80*128+64],[230,40,100,255]);self.assertEqual(d['pixels'][40*128+70],[80,90,100,0]);self.assertEqual(d['parent_drawing'],current);self.assertEqual(q['originals'],p['originals'])

    def test_existing_key_and_retimed_derived_interval_are_not_overwritten(self):
        p=fixture();bad=request();bad['target_end']=9
        with self.assertRaisesRegex(ValueError,'distinct keys'):propose(p,bad)
        q=accept(p,propose(p,request()),'pose');q['exposures'][1]['length']=3;q['exposures'][2].update(start=7,length=5)
        with self.assertRaisesRegex(ValueError,'different key/interval'):propose(q,request(operation_id='pose'))

    def test_unmatched_source_and_target_marks_preserve_visibility_uncertainty(self):
        p=fixture();p['motion_guides']['arm-lift']['handles'] += [dict(id='new_face_surface',source=None,target=[70.5,35.5],enabled=True),dict(id='hidden_hand_detail',source=[112.5,35.5],target=None,enabled=True)]
        r=propose(p,request());self.assertEqual({e['kind'] for e in r['visibility_events']},{'unmatched_source','unmatched_target'});self.assertTrue(any('no newly exposed' in w for w in r['warnings']));q=accept(p,r,'pose');self.assertEqual(q['motion_operations'][-1]['visibility_events'],r['visibility_events'])

    def test_worker_tamper_stale_edit_undo_and_cancel(self):
        p=fixture();s=Session(p)
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'motion';create_motion_job(p,request(),job);self.assertEqual(execute(job)['state'],'completed');r=read(job/'result.json');old=deepcopy(r);r['motion_result']['outputs']['ink']['pixels'][0]=[1,2,3,255];atomic_write(job/'result.json',r)
            with self.assertRaises(ValueError):apply_motion_result(p,job,'bad')
            atomic_write(job/'result.json',old);q=apply_motion_result(p,job,'valid');self.assertEqual(q['motion_operations'][-1]['target_start'],4)
            guide=deepcopy(s.project['motion_guides']['arm-lift']);guide['handles'][-1]['target'][0]+=2;s.commit(save_guide(s.project,'arm-lift',guide),'correct-match');s.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):apply_motion_result(s.project,job,'stale')
            cancel=Path(td)/'cancel';create_motion_job(p,request(),cancel);self.assertEqual(execute(cancel,lambda n:request_cancel(cancel))['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_packed_hd_world_coordinates_save_reopen_and_source_retention(self):
        p=fixture(True,1920,1080,(700,300));r=propose(p,request());self.assertEqual(r['unsafe_reasons'],[]);q=accept(p,r,'HDpose');s=Session(q);self.assertEqual(q['originals'],p['originals'])
        for layer in ['ink','paint']:self.assertIsInstance(r['outputs'][layer]['pixels'],PixelPlane)
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'motion.aaa';s.save(path);self.assertEqual(Session.load(path).project,q)

    def test_region_masks_palettes_and_part_ids_follow_the_same_field(self):
        from hosts.standalone.reference_fixtures import fixture as compartments,with_reference,request as reference_request
        from engine.references import accept as accept_reference,propose as propose_reference
        p=with_reference(compartments());p=accept_reference(p,propose_reference(p,reference_request()),'colored');p['motion_guides']={'shift':dict(name='Region transport check',actor_id='cap',source_slot=0,guide_slot=4,roi=[0,0,64,64],handles=[dict(id='first',source=[20.5,20.5],target=[22.5,20.5],enabled=True),dict(id='second',source=[30.5,40.5],target=[32.5,40.5],enabled=True)])}
        settings=dict(guide_id='shift',mode='rigid',progress=1,target_start=2,target_end=4,operation_id=None,allow_clip=False);r=propose(p,settings);self.assertEqual(r['unsafe_reasons'],[]);q=accept(p,r,'transport');Session(q)
        op=q['motion_operations'][-1];self.assertEqual(len(op['region_ids']),3);target=next(i for i,parent in op['region_parents'].items() if parent=='cap');self.assertEqual(q['part_bindings'][target]['part_id'],'cap');self.assertEqual(q['fill_regions'][target]['palette_id'],q['fill_regions']['cap']['palette_id'])
        old,_=managed_pixels(p,'cap');new,_=managed_pixels(q,target);self.assertEqual(set(new),{i+2 for i in old});self.assertEqual(q['fill_regions']['cap']['length'],2)
        palette=q['fill_regions']['cap']['palette_id'];change=dict(action='recolor',palette_id=palette,rgba=[45,180,80,255]);recolored=accept_palette(q,propose_palette(q,change),'palette-after-motion');self.assertEqual(recolored['palettes'][palette]['rgba'],change['rgba']);Session(recolored)



    def test_local_interval_resumes_source_and_preserves_total_duration(self):
        p=fixture();settings=request();settings['target_end']=6;r=propose(p,settings);self.assertTrue(any('source hold resumes' in w for w in r['warnings']));q=accept(p,r,'short-pose')
        self.assertEqual([(e['start'],e['length']) for e in q['exposures'] if e['layer_id']=='ink'],[(0,4),(4,2),(6,2),(8,4)]);self.assertEqual(render(q,6),render(p,0));self.assertEqual(q['shot']['duration_frames'],12)

    def test_unsafe_preview_is_inspectable_but_host_does_not_apply_it(self):
        p=fixture();p['motion_guides']['arm-lift']['roi'][1]=7;s=Session(p);before=fingerprint(p)
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'unsafe';create_motion_job(p,request(),job);self.assertEqual(execute(job)['state'],'completed');self.assertEqual(read(job/'result.json')['applicability'],'needs_repair')
            with self.assertRaisesRegex(ValueError,'Repair motion'):s.apply(job)
            self.assertEqual(fingerprint(s.project),before);self.assertEqual(s.past,[])

    def test_large_transported_region_has_palette_editable_typed_geometry(self):
        from engine.project import create
        from engine.roi_assistance import fill_roi,accept_fill_roi
        from engine.fill import defaults
        plane=uniform(512,512);edits={}
        for y in range(20,180):
            for x in range(20,210):
                if x in {20,209} or y in {20,179}:edits[y*512+x]=[20,30,40,255]
        p=create(plane.with_edits(edits),512,512,12);p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=4),dict(layer_id='ink',drawing_id='source',start=4,length=8)]
        settings=defaults([100,100],[45,125,210,255],'coat');p,_=accept_fill_roi(p,fill_roi(p,'ink',0,settings,[16,16,214,184]),'ink',0,'coat')
        p['motion_guides']={'grow':dict(name='Uniform scale diagnostic',actor_id='coat',source_slot=0,guide_slot=None,roi=[0,0,224,200],handles=[dict(id='first',source=[30.5,30.5],target=[61,61],enabled=True),dict(id='second',source=[190.5,160.5],target=[381,321],enabled=True)])}
        req=dict(guide_id='grow',mode='similarity',progress=1,target_start=2,target_end=4,operation_id=None,allow_clip=False);r=propose(p,req);self.assertEqual(r['unsafe_reasons'],[]);q=accept(p,r,'grown');Session(q);target=q['motion_operations'][-1]['region_ids'][0]
        self.assertEqual(q['fill_regions'][target]['region_format'],'motion_region_v1');self.assertGreater(len(managed_pixels(q,target)[0]),65536)
        change=dict(action='recolor',palette_id='coat',rgba=[200,40,90,255]);recolored=accept_palette(q,propose_palette(q,change),'grown-palette');Session(recolored);self.assertEqual(recolored['palettes']['coat']['rgba'],change['rgba']);self.assertEqual(recolored['fill_regions'][target]['covered_mask'],q['fill_regions'][target]['covered_mask'])


if __name__=='__main__':unittest.main()
