from copy import deepcopy
from pathlib import Path
import json,tempfile,unittest
from engine.references import *
from engine.project import create
from engine.jobs import create_reference_job,execute,read,apply_reference_result,request_cancel,atomic_write
from engine.packed_render import render
from engine.io.project_archive import PixelPlane
from hosts.standalone.session import Session
from hosts.standalone.reference_fixtures import fixture,sheet,with_reference,request,COLORS


def packed(p):
    p=deepcopy(p);p['schema_version']='0.2'
    for table in ['drawings','originals']:
        for d in p[table].values():d['pixels']=PixelPlane.from_pixels(64,64,d['pixels'])
    p['originals_sha256']=fingerprint(p['originals']);return p


class ReferenceTests(unittest.TestCase):
    def test_absent_disabled_correct_wrong_and_multiple_view_outputs(self):
        p=fixture();free=propose(p,request());self.assertIsNone(free['selected']);self.assertEqual(free['updates'],{})
        p=with_reference(p);r=propose(p,request());self.assertEqual(r['selected']['part_id'],'cap');self.assertEqual(r['selected']['rgba'],COLORS['cap'])
        off=edit_reference(p,'front',enabled=False);self.assertEqual(propose(off,request())['updates'],{});self.assertEqual(propose(p,request(use=False))['updates'],{})
        wrong=propose(p,request(override='coat'));self.assertEqual(wrong['selected']['rgba'],COLORS['coat'])
        self.assertIsNone(propose(p,request(view='back'))['selected']);p=with_reference(p,'back','back',64)
        self.assertEqual(propose(p,request(view='back'))['selected']['rgba'],[240,210,60,255])
        mixed=propose(p,request(view='any'));self.assertTrue(any('disagree' in w for w in mixed['warnings']))

    def test_artist_identity_beats_geometric_candidate_and_only_role_bound_updates(self):
        p=with_reference(fixture());initial=accept(p,propose(p,request()),'one');corrected=correct_part(initial,'cap','hero','coat',[0,0,64,64]);r=propose(corrected,request())
        self.assertEqual(r['selected']['part_id'],'coat');self.assertEqual(r['selected']['identity_source'],'artist_override');self.assertEqual(set(r['updates']),{'cap'})
        accepted=accept(corrected,r,'two');self.assertEqual(accepted['part_bindings']['cap']['origin'],'artist_correction');self.assertEqual(accepted['drawings'][p['fill_regions']['coat']['fill_drawing']],p['drawings'][p['fill_regions']['coat']['fill_drawing']])

    def test_transparent_erased_and_exterior_constraints_geometry_source_other_holds(self):
        p=with_reference(fixture());s=Session(p);s.layer_id=p['fill_regions']['cap']['fill_layer'];s.correct({8*64+22:[9,8,7,0],0:[22,33,44,255]});before=deepcopy(s.project)
        result=propose(s.project,request());updated=accept(s.project,result,'ref');r=updated['fill_regions']['cap'];e=next(e for e in updated['exposures'] if e['layer_id']==r['fill_layer'] and e['start']==0);d=updated['drawings'][e['drawing_id']]
        self.assertEqual(d['pixels'][8*64+22],[9,8,7,0]);self.assertEqual(d['pixels'][0],[22,33,44,255]);self.assertEqual(updated['originals'],before['originals']);self.assertEqual(updated['drawings']['source'],before['drawings']['source']);self.assertEqual(r['covered'],before['fill_regions']['cap']['covered']);self.assertEqual(render(updated,4)[2],render(before,4)[2])

    def test_reference_different_dimensions_full_bytes_and_metadata_roundtrip(self):
        for p in [fixture(),packed(fixture())]:
            p=with_reference(p);source=image_bytes(p['references']['front']);self.assertEqual(source,sheet());self.assertEqual(plane(p['references']['front'])[0],[77,12,200,0]);self.assertEqual(p['canvas']['width'],64)
            s=Session(accept(p,propose(p,request()),'ref'))
            with tempfile.TemporaryDirectory() as td:
                path=Path(td)/'current.aaa';s.save(path);self.assertEqual(Session.load(path).project,s.project)
                if p['schema_version']=='0.1':s.save(Path(td)/'current.aaa.json');self.assertEqual(Session.load(Path(td)/'current.aaa.json').project,s.project)

    def test_reference_worker_tamper_replay_and_cancellation(self):
        p=with_reference(packed(fixture()))
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'ref';create_reference_job(p,request(),job);self.assertEqual(execute(job)['state'],'completed');result=read(job/'result.json');old=deepcopy(result);result['reference_result']['selected']['rgba']=[1,2,3,255];atomic_write(job/'result.json',result)
            with self.assertRaises(ValueError):apply_reference_result(p,job,'bad')
            atomic_write(job/'result.json',old);updated=apply_reference_result(p,job,'ok');self.assertEqual(updated['part_bindings']['cap']['part_id'],'cap')
            atomic_write(job/'applied-by-host.json',{})
            with self.assertRaisesRegex(ValueError,'reviewed'):apply_reference_result(p,job,'again')
            cancel=Path(td)/'cancel';create_reference_job(p,request(),cancel);self.assertEqual(execute(cancel,lambda n:request_cancel(cancel))['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_unrelated_edit_allowed_reference_edit_and_undo_stale(self):
        p=with_reference(fixture());s=Session(p)
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'ref';create_reference_job(p,request(),job);execute(job);s.layer_id=p['fill_regions']['shoes']['fill_layer'];s.correct({52*64+22:[1,2,3,255]});updated=apply_reference_result(s.project,job,'valid');self.assertEqual(updated['drawings'][s.drawing_id()],s.project['drawings'][s.drawing_id()])
            s.commit(edit_reference(s.project,'front',view='side'),'edit-reference-view');s.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):apply_reference_result(s.project,job,'stale')

    def test_permissions_crop_swatch_corruption_and_archiving(self):
        p=with_reference(fixture())
        for changes in [dict(crop=[0,0,12,12]),dict(part_id='bad',bbox=[0,0,10,10],swatch=[20,20])]:
            with self.assertRaises(ValueError):edit_reference(p,'front',**changes)
        bad=deepcopy(p);bad['references']['front']['permissions']['training']=True
        with self.assertRaises(ValueError):Session(bad)
        bad=deepcopy(p);bad['references']['front']['image']['sha256']='0'*64
        with self.assertRaises(ValueError):Session(bad)
        used=accept(p,propose(p,request()),'ref');archived=edit_reference(used,'front',archive=True);Session(archived);self.assertEqual(image_bytes(archived['reference_archive']['front']),sheet());self.assertIsNone(propose(archived,request())['selected'])

    def test_manual_depth_is_scoped_and_locked_targets_refused(self):
        p=with_reference(fixture());changed=set_depth(p,'cap',5);self.assertEqual(changed['layers'][p['fill_regions']['cap']['fill_layer']]['order'],5);self.assertEqual(changed['drawings'],p['drawings'])
        p['layers'][p['fill_regions']['cap']['fill_layer']]['locked']=True
        with self.assertRaisesRegex(ValueError,'locked'):propose(p,request())



    def test_bound_part_propagation_respects_character_identity(self):
        p=with_reference(fixture());p=correct_part(p,'coat','hero','cap',[0,0,64,64]);p=correct_part(p,'shoes','other-character','cap',[0,0,64,64])
        settings=request();settings['propagate_bound']=True;r=propose(p,settings)
        self.assertEqual(set(r['updates']),{'cap','coat'});updated=accept(p,r,'bound')
        self.assertEqual(updated['part_bindings']['coat']['character_id'],'hero');self.assertEqual(updated['part_bindings']['shoes']['character_id'],'other-character')
        self.assertEqual(updated['drawings'][p['fill_regions']['shoes']['fill_drawing']],p['drawings'][p['fill_regions']['shoes']['fill_drawing']])

    def test_actual_hd_roi_geometry_reference_with_independent_image_size(self):
        from engine.roi_assistance import fill_roi,accept_fill_roi
        from engine.fill import defaults
        from engine.spatial_constraints import uniform
        from hosts.standalone.reference_fixtures import BOXES
        w,h,ox,oy=1920,1080,700,300;edits={}
        for b in BOXES.values():
            for y in range(b[1],b[3]):
                for x in range(b[0],b[2]):
                    if x in {b[0],b[2]-1} or y in {b[1],b[3]-1}:edits[(oy+y)*w+ox+x]=[30,35,45,255]
        p=create(uniform(w,h).with_edits(edits),w,h,12)
        for index,(pid,b) in enumerate(BOXES.items()):
            settings=defaults([ox+(b[0]+b[2])//2,oy+(b[1]+b[3])//2],[150,150,150,255],'unassigned');roi=[ox+b[0]-2,oy+b[1]-2,ox+b[2]+2,oy+b[3]+2];layer='ink' if index==0 else 'cap-ink'
            p,_=accept_fill_roi(p,fill_roi(p,layer,0,settings,roi),layer,0,pid)
        p=with_reference(p);settings=request();settings['target_bounds']=[ox,oy,ox+64,oy+64];r=propose(p,settings);self.assertEqual(r['selected']['part_id'],'cap');updated=accept(p,r,'HDref')
        region=updated['fill_regions']['cap'];e=next(e for e in updated['exposures'] if e['layer_id']==region['fill_layer']);d=updated['drawings'][e['drawing_id']]
        self.assertEqual(d['pixels'][(oy+10)*w+ox+28],COLORS['cap']);self.assertEqual(d['pixels'][0],[0,0,0,0]);self.assertEqual(updated['originals'],p['originals']);self.assertEqual(updated['fill_regions']['cap']['covered_mask'],p['fill_regions']['cap']['covered_mask'])



    def test_accepted_matching_inputs_survive_later_reference_annotation_edits(self):
        p=with_reference(fixture());result=propose(p,request());accepted=accept(p,result,'ref')
        saved=deepcopy(accepted['reference_operations'][-1]);edited=edit_reference(accepted,'front',view='side',part_id='cap',bbox=[16,4,40,18],swatch=[20,8])
        self.assertEqual(edited['reference_operations'][-1],saved);self.assertEqual(saved['selected']['reference_crop'],[0,0,64,64]);self.assertEqual(saved['selected']['reference_sha256'],hashlib.sha256(sheet()).hexdigest());self.assertEqual(saved['matching_inputs']['target_bounds'],[0,0,64,64]);self.assertLess(saved['selected']['reference_revision'],edited['references']['front']['revision'])


    def test_front_back_color_roles_share_part_identity_without_cross_view_recolor(self):
        p=with_reference(with_reference(fixture()),'back','back',64)
        p=accept(p,propose(p,request()),'front-role');p=accept(p,propose(p,request('coat','back','cap')),'back-role')
        self.assertEqual(p['part_bindings']['cap']['part_id'],p['part_bindings']['coat']['part_id'])
        self.assertNotEqual(p['fill_regions']['cap']['palette_id'],p['fill_regions']['coat']['palette_id'])
        settings=request();settings['propagate_bound']=True;r=propose(p,settings);self.assertEqual(set(r['updates']),{'cap'})
        q=accept(p,r,'front-correction');self.assertEqual(q['drawings'][p['fill_regions']['coat']['fill_drawing']],p['drawings'][p['fill_regions']['coat']['fill_drawing']])

if __name__=='__main__':unittest.main()
