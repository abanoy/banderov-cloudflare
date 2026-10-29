from copy import deepcopy
from pathlib import Path
import tempfile,unittest
from engine.raster_parts import ownership,propose,accept,subject
from engine.project import fingerprint
from engine.layers import render
from engine.motion import propose as motion_propose,accept as motion_accept
from hosts.standalone.motion_fixtures import fixture
from hosts.standalone.session import Session


def settings(p,offset=(0,0)):
    ox,oy=offset;w=p['canvas']['width'];mask=ownership(p,[(y+oy)*w+x+ox for y in range(26,64) for x in range(98,122)])
    return dict(actor_id='actor',source_slot=0,content_slot=0,target_start=4,target_end=8,name='Right forearm and hand',part_id='hero.right_arm',source_mask=mask,content_mask=mask,depth='front',operation_id=None)


class RasterPartTests(unittest.TestCase):
    def test_saved_operation_snapshot_does_not_alias_current_part_definition(self):
        p=fixture();q=accept(p,propose(p,settings(p)),'snapshot');q['raster_parts']['snapshot']['settings']['name']='Changed current label'
        self.assertEqual(q['part_operations'][0]['settings']['name'],'Right forearm and hand')

    def test_worker_tamper_cancel_and_dependent_edit_undo(self):
        from engine.jobs import create_part_job,execute,read,atomic_write,apply_part_result,request_cancel
        p=fixture();request=settings(p)
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'part';create_part_job(p,request,job);self.assertEqual(execute(job)['state'],'completed');result=read(job/'result.json');tampered=deepcopy(result);tampered['part_result']['outputs']['paint']['base_pixels'][0]=[1,2,3,255];atomic_write(job/'result.json',tampered)
            with self.assertRaisesRegex(ValueError,'differs'):apply_part_result(p,job,'bad')
            atomic_write(job/'result.json',result);s=Session(p);s.layer_id='paint';s.slot=0;s.correct({0:[30,20,10,0]});s.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):apply_part_result(s.project,job,'stale')
            fresh=Session(p);fresh.apply(job);self.assertEqual(len(fresh.project['raster_parts']),1)
            with self.assertRaises(ValueError):fresh.apply(job)
            cancel=Path(td)/'cancel';create_part_job(p,request,cancel);self.assertEqual(execute(cancel,lambda n:request_cancel(cancel))['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_unrelated_layer_change_stays_applicable_and_packed_worker_roundtrip(self):
        from engine.jobs import create_part_job,execute,apply_part_result
        for packed in [False,True]:
            p=fixture(packed);request=settings(p)
            with tempfile.TemporaryDirectory() as td:
                job=Path(td)/'part';create_part_job(p,request,job);self.assertEqual(execute(job)['state'],'completed');q=deepcopy(p);q['layers']['unrelated']=dict(name='Other layer',visible=True,locked=False,order=20);q['exposures'].append(dict(layer_id='unrelated',drawing_id='ink-start',start=0,length=12));out=apply_part_result(q,job,'unrelated-part');self.assertEqual(out['layers']['unrelated'],q['layers']['unrelated']);self.assertEqual(out['originals'],p['originals']);Session(out)

    def test_depth_only_revisions_reuse_raw_drawings_and_keep_legacy_budget(self):
        p=fixture();request=settings(p);q=accept(p,propose(p,request),'first');count=len(q['drawings']);request['operation_id']='first'
        for number,depth in enumerate(['hidden','front','back','front']):
            request['depth']=depth;q=accept(q,propose(q,request),'depth-'+str(number));self.assertEqual(len(q['drawings']),count);self.assertEqual(q['raster_parts']['first']['new_distinct_drawings'],0);Session(q)
        self.assertEqual(q['originals'],p['originals'])

    def test_partition_exact_projection_preserves_keys_and_originals(self):
        p=fixture();s=settings(p);before=fingerprint(p);r=propose(p,s);q=accept(p,r,'arm');Session(q)
        self.assertEqual(fingerprint(p),before);self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['shot'],p['shot']);self.assertEqual(render(q,4),render(p,0));self.assertEqual(render(q,0),render(p,0));self.assertEqual(render(q,8),render(p,8));self.assertEqual(len(q['layers']),6)
        for layer in ['ink','paint']:self.assertEqual([(e['start'],e['length']) for e in q['exposures'] if e['layer_id']==layer],[(0,4),(4,4),(8,4)])
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'parts.aaa';Session(q).save(path);self.assertEqual(Session.load(path).project,q)

    def test_nested_group_opacity_and_antialias_samples_recompose(self):
        p=fixture();p['layers']['actor']['opacity']=173;p['layers']['paint']['opacity']=128;p['layers']['nested']=dict(name='Ink folder',parent_id='actor',nodetype='grouplayer',visible=True,locked=False,isolation='isolate',opacity=195,order=0);p['layers']['ink']['parent_id']='nested'
        q=accept(p,propose(p,settings(p)),'nested');self.assertEqual(render(q,4),render(p,0));self.assertEqual(render(q,8),render(p,8));Session(q)

    def test_hidden_part_is_retained_and_can_return_without_erasing_source(self):
        p=fixture();s=settings(p);s['depth']='hidden';q=accept(p,propose(p,s),'hidden');part=q['raster_parts']['hidden'];self.assertNotEqual(render(q,4),render(p,0));self.assertFalse(q['layers'][part['part_group']]['visible'])
        self.assertTrue(any(px[3] for px in q['drawings'][part['part_drawings']['paint']]['pixels']));q['layers'][part['part_group']]['visible']=True;self.assertEqual(render(q,4),render(p,0));self.assertEqual(q['originals'],p['originals'])

    def test_part_can_move_behind_other_content_and_depth_changes_visibility(self):
        p=fixture();q=accept(p,propose(p,settings(p)),'split');group=q['raster_parts']['split']['part_group'];q['motion_guides']['part-move']=dict(name='Move arm behind torso',actor_id=group,source_slot=4,guide_slot=None,roi=[90,15,125,70],handles=[dict(id='hand',source=[113.5,36.5],target=[64.5,80.5],enabled=True)])
        req=dict(guide_id='part-move',mode='rigid',progress=1,target_start=6,target_end=8,operation_id=None,allow_clip=False);r=motion_propose(q,req);self.assertFalse(r['unsafe_reasons']);moved=motion_accept(q,r,'moved');front=render(moved,6);moved['layers'][group]['order']=20;back=render(moved,6)
        self.assertNotEqual(front,back);self.assertEqual(back[80*128+64],render(p,0)[80*128+64]);self.assertEqual(front[80*128+64],[245,190,145,255]);self.assertEqual(render(moved,8),render(p,8));Session(moved)

    def test_donor_approved_key_supplies_new_content_without_claiming_invention(self):
        p=fixture();indices=[y*128+x for y in range(41,47) for x in range(86,92)]
        for i in indices:p['drawings']['paint-end']['pixels'][i]=[250,30,220,255]
        p['originals']['paint-end']=deepcopy(p['drawings']['paint-end']);p['originals_sha256']=fingerprint(p['originals']);s=settings(p);s.update(content_slot=8,source_mask=[],content_mask=indices);r=propose(p,s);q=accept(p,r,'visible');self.assertEqual(r['event'],'approved_key_content')
        expected=sum(px==[250,30,220,255] for px in render(p,8));actual=sum(px==[250,30,220,255] for px in render(q,4));self.assertEqual(actual,expected);self.assertGreater(actual,0);self.assertEqual(q['originals'],p['originals']);self.assertEqual(render(q,8),render(p,8))

    def test_source_and_target_paint_erase_constraints_survive_mask_revision(self):
        p=fixture();s=Session(p);s.layer_id='paint';s.slot=0;i=36*128+113;s.correct({i:[17,30,80,0]});p=s.project;r=propose(p,settings(p));self.assertEqual(r['protected_excluded'],1);q=accept(p,r,'protected');record=q['raster_parts']['protected'];self.assertEqual(q['drawings'][record['base_drawings']['paint']]['pixels'][i],[17,30,80,0]);self.assertEqual(q['drawings'][record['part_drawings']['paint']]['pixels'][i],[0,0,0,0])
        s=Session(q);s.layer_id=record['part_layers']['paint'];s.slot=4;j=40*128+110;s.correct({j:[4,5,6,0]});request=settings(p);request['operation_id']='protected';revision=accept(s.project,propose(s.project,request),'revised');new=revision['raster_parts']['protected'];self.assertEqual(revision['drawings'][new['part_drawings']['paint']]['pixels'][j],[4,5,6,0]);Session(revision)
        request['depth']='back';unsafe=propose(s.project,request);self.assertIn('depth_change_with_protected_target',unsafe['unsafe_reasons'])
        with self.assertRaisesRegex(ValueError,'Repair'):accept(s.project,unsafe,'unsafe')

    def test_packed_off_origin_partition_and_reopen(self):
        p=fixture(True,1920,1080,(700,300));s=settings(p,(700,300));q=accept(p,propose(p,s),'HDpart');Session(q)
        from engine.packed_render import render as packed_render
        roi=(690,300,830,465);self.assertEqual(packed_render(q,4,None,roi),packed_render(p,0,None,roi));self.assertEqual(q['originals'],p['originals'])
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'HDpart.aaa';Session(q).save(path);self.assertEqual(Session.load(path).project,q)

    def test_distinct_keys_and_missing_fill_geometry_path_are_not_silently_replaced(self):
        p=fixture();s=settings(p);s['target_end']=9
        with self.assertRaisesRegex(ValueError,'distinct keys'):propose(p,s)
        s=settings(p);p['fill_regions']={'existing':dict(ink_layer='ink',fill_layer='paint',start=0,length=8)};before=fingerprint(p)
        with self.assertRaisesRegex(ValueError,'geometry is discarded'):propose(p,s)
        self.assertEqual(fingerprint(p),before)


if __name__=='__main__':unittest.main()
