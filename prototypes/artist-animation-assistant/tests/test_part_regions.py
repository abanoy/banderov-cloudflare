from copy import deepcopy
from pathlib import Path
import tempfile,unittest
from engine.raster_parts import ownership,propose,accept,subject
from engine.project import fingerprint,create
from engine.layers import render
from engine.fill_revision import propose_revision,accept_revision
from engine.regions import propose_palette,accept_palette
from engine.spatial_constraints import uniform,ENCODING
from engine.region_domains import domain_indices
from hosts.standalone.reference_fixtures import fixture
from hosts.standalone.session import Session


def request(p,donor=0,offset=(0,0)):
    ox,oy=offset;w=p['canvas']['width'];values=[(y+oy)*w+x+ox for y in range(64) for x in range(30,50)]
    mask=ownership(p,values)
    return dict(actor_id='cap',source_slot=0,content_slot=donor,target_start=2,target_end=4,name='Right raster fragment',part_id='hero.right_fragment',source_mask=mask,content_mask=mask,depth='front',operation_id=None)


def derived(p,role,parent='cap'):
    return next(i for i,b in p['raster_parts']['split']['region_parents'].items() if b==dict(parent=parent,role=role))


class PartRegionTests(unittest.TestCase):
    def test_pending_seed_and_unselected_region_points_survive_local_motion(self):
        from engine.region_domains import set_seed_hints
        from engine.motion import propose as move,accept as apply_move
        p=fixture();q=accept(p,propose(p,request(p)),'split');rid=derived(q,'part');q=set_seed_hints(q,rid,[[33,8],[35,20]])
        req=request(p);req['operation_id']='split';q=accept(q,propose(q,req),'pending-points');self.assertIn([35,20],q['fill_regions'][rid]['component_seeds'])
        q['motion_guides']={'local':dict(name='Cap fragment only',actor_id=q['raster_parts']['split']['part_group'],source_slot=2,guide_slot=None,roi=[28,3,51,20],handles=[dict(id='shift',source=[35,10],target=[27,10],enabled=True)])}
        result=move(q,dict(guide_id='local',mode='rigid',progress=1,target_start=3,target_end=4,operation_id=None,allow_clip=False));self.assertFalse(result['unsafe_reasons'])
        moved=apply_move(q,result,'local-moved');Session(moved)
        for identity,parent in moved['motion_operations'][-1]['region_parents'].items():
            r=moved['fill_regions'][identity]
            if parent==rid:self.assertIn([35,20],r['component_seeds'])
            else:self.assertTrue(all(t['source']==t['mapped'] for t in r['seed_transport_review']['trace']))

    def test_single_pixel_owned_fill_is_retained_as_a_region(self):
        p=fixture();req=request(p);i=10*64+35;mask=ownership(p,[i]);req.update(source_mask=mask,content_mask=mask)
        q=accept(p,propose(p,req),'split');r=q['fill_regions'][derived(q,'part')];self.assertEqual(r['region'],[i]);self.assertEqual(r['covered'],[i]);self.assertEqual(render(q,2),render(p,0))
        result=propose_revision(q,derived(q,'part'),r['settings']);self.assertEqual(result['covered'],[i]);self.assertEqual(result['fill'][i],[150,150,150,255])
        from engine.motion import propose as move,accept as apply_move
        q['motion_guides']={'tiny':dict(name='Tiny fragment',actor_id=q['raster_parts']['split']['part_group'],source_slot=2,guide_slot=None,roi=[28,0,51,64],handles=[dict(id='shift',source=[35,10],target=[27,10],enabled=True)])}
        req=dict(guide_id='tiny',mode='rigid',progress=1,target_start=3,target_end=4,operation_id=None,allow_clip=False)
        moved=apply_move(q,move(q,req),'tiny-moved');Session(moved);self.assertEqual(len(moved['motion_operations'][-1]['region_parents']),3)
        self.assertEqual(sum(not moved['fill_regions'][rid]['region'] for rid in moved['motion_operations'][-1]['region_ids']),2)

    def test_real_ink_hole_survives_disconnected_part_partition_and_regeneration(self):
        from engine.fill import defaults,propose as fill,accept_fill
        pixels=[[0,0,0,0] for _ in range(64*64)]
        for x0,y0,x1,y1 in [[8,8,56,56],[20,14,44,43]]:
            for y in range(y0,y1):
                for x in range(x0,x1):
                    if x in {x0,x1-1} or y in {y0,y1-1}:pixels[y*64+x]=[25,35,45,255]
        p=create(pixels,64,64,12);p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=8),dict(layer_id='ink',drawing_id='source',start=8,length=4)]
        p,_=accept_fill(p,fill(pixels,64,64,defaults([12,12],[150,150,150,255],'unassigned')),'ink',0,'cap')
        req=request(p);mask=ownership(p,[y*64+x for y in range(64) for x in range(25,38)]);req.update(source_mask=mask,content_mask=mask)
        q=accept(p,propose(p,req),'split');r=q['fill_regions'][derived(q,'part')];self.assertEqual(len(r['component_seeds']),1)
        self.assertEqual(render(q,2),render(p,0));self.assertNotIn(30*64+32,r['covered'])
        regenerated=propose_revision(q,derived(q,'part'),r['settings']);self.assertEqual(regenerated['covered'],r['covered']);self.assertEqual(regenerated['fill'][30*64+32],[0,0,0,0])

    def test_approved_donor_regions_keep_their_own_palette_and_source_evidence(self):
        p=fixture();colors={'cap':[240,30,190,255],'coat':[20,210,220,255],'shoes':[245,180,15,255]}
        donor_ink=next(e for e in p['exposures'] if e['layer_id']=='cap-ink' and e['start']==4)
        p['exposures']=[item for e in p['exposures'] for item in ([dict(e,length=4),dict(e,start=8,length=4)] if e==donor_ink else [e])]
        for role,color in colors.items():
            original=p['fill_regions'][role];did=role+'-donor-drawing';drawing=deepcopy(p['drawings'][original['fill_drawing']])
            drawing['pixels']=[color[:] if i in set(original['covered']) else pixel[:] for i,pixel in enumerate(drawing['pixels'])];p['drawings'][did]=drawing;p['originals'][did]=deepcopy(drawing)
            selected=next(e for e in p['exposures'] if e['layer_id']==original['fill_layer'] and e['start']==4)
            p['exposures']=[item for e in p['exposures'] for item in ([dict(e,length=4),dict(e,start=8,length=4,drawing_id=did)] if e==selected else [e])]
            palette=role+'-donor';p['palettes'][palette]=dict(rgba=color[:],color_profile='sRGB',origin='original_authored_key')
            r=deepcopy(original);r.update(start=8,length=4,fill_drawing=did,ink_drawing='source',palette_id=palette);r['settings'].update(palette_id=palette,color=color[:]);p['fill_regions'][role+'-donor-region']=r
        p['originals_sha256']=fingerprint(p['originals']);Session(p);req=request(p,donor=8);q=accept(p,propose(p,req),'split');Session(q)
        a,b=render(p,0),render(p,8);owned=set(req['source_mask']);expected=[b[i] if i in owned else a[i] for i in range(64*64)]
        self.assertEqual(render(q,2),expected);self.assertEqual(render(q,8),b);self.assertEqual(q['originals'],p['originals'])
        for role in colors:
            rid=derived(q,'part',role+'-donor-region');r=q['fill_regions'][rid];self.assertEqual(r['palette_id'],role+'-donor');self.assertEqual(r['partition_parent_region'],role+'-donor-region')
        self.assertEqual(q['raster_parts']['split']['event'],'approved_key_content')

    def test_source_erase_is_excluded_from_ownership_and_remains_a_domain_hole(self):
        p=fixture();s=Session(p);s.layer_id='cap-fill';s.slot=0;i=10*64+35;s.correct({i:[9,13,17,0]});p=s.project
        q=accept(p,propose(p,request(p)),'split');Session(q);part=q['fill_regions'][derived(q,'part')];base=q['fill_regions'][derived(q,'base')]
        self.assertNotIn(i,part['ownership_domain']);self.assertNotIn(i,part['covered']);self.assertIn(i,base['ownership_domain']);self.assertEqual(render(q,2),render(p,0))
        self.assertEqual(q['drawings'][base['fill_drawing']]['pixels'][i],[9,13,17,0])
        revised=propose_revision(q,derived(q,'part'),part['settings']);self.assertEqual(revised['fill'][i],[0,0,0,0])

    def test_seed_hint_repair_is_metadata_only_guarded_and_reversible(self):
        from engine.region_domains import set_seed_hints,seed_scope
        p=fixture();q=accept(p,propose(p,request(p)),'split');rid=derived(q,'part');before=fingerprint(q['drawings']);scope=seed_scope(q,rid)
        points=[[33,8],[36,10]];out=set_seed_hints(q,rid,points);self.assertEqual(fingerprint(out['drawings']),before);self.assertEqual(out['originals'],p['originals'])
        self.assertEqual(out['fill_regions'][rid]['component_seeds'],[[36,10]]);self.assertNotEqual(seed_scope(out,rid),scope)
        req=request(p);req['operation_id']='split';retained=accept(out,propose(out,req),'keep-seed-hints');self.assertEqual(retained['fill_regions'][rid]['component_seeds'],[[36,10]])
        s=Session(q);s.commit(out,'seed-repair');s.travel();self.assertEqual(s.project['fill_regions'],q['fill_regions']);self.assertNotEqual(seed_scope(s.project,rid),scope)
        with self.assertRaisesRegex(ValueError,'outside'):set_seed_hints(q,rid,[[2,2]])
        with self.assertRaisesRegex(ValueError,'at least'):set_seed_hints(q,rid,[])

    def test_disconnected_and_empty_regions_are_retained_without_guessing(self):
        p=fixture();req=request(p);w=64;cut=ownership(p,[y*w+x for y in range(64) for x in range(26,28)]);req.update(source_mask=cut,content_mask=cut)
        q=accept(p,propose(p,req),'split');base=q['fill_regions'][derived(q,'base')]
        self.assertEqual(len(base['component_seeds']),1)
        self.assertEqual(base['ownership_topology']['kind'],'known_interior_split')
        r=propose_revision(q,derived(q,'base'),base['settings']);self.assertEqual(r['covered'],base['covered'])
        req=request(p);tiny=ownership(p,[0]);req.update(source_mask=tiny,content_mask=tiny);empty=accept(p,propose(p,req),'split');Session(empty)
        part=empty['fill_regions'][derived(empty,'part')];self.assertEqual(part['region'],[]);self.assertEqual(part['component_seeds'],[]);self.assertIn('empty',part['geometry_status'])
        with self.assertRaisesRegex(ValueError,'outside'):propose_revision(empty,derived(empty,'part'),part['settings'])
        replacement=request(p);replacement['operation_id']='split';restored=accept(empty,propose(empty,replacement),'restore')
        self.assertEqual(derived(restored,'part'),derived(empty,'part'));self.assertEqual(restored['fill_regions'][derived(restored,'part')]['ownership_topology']['kind'],'region_reappeared_from_approved_geometry')
        self.assertEqual(restored['part_operations'][0]['region_topology_events'][3]['kind'],'region_emptied')

    def test_part_motion_transports_domain_and_later_boundary_revises_in_place(self):
        from engine.motion import propose as move,accept as apply_move
        p=fixture();q=accept(p,propose(p,request(p)),'split');group=q['raster_parts']['split']['part_group']
        q['motion_guides']={'part':dict(name='Fragment shift',actor_id=group,source_slot=2,guide_slot=None,roi=[28,0,51,64],handles=[dict(id='shift',source=[35,10],target=[27,10],enabled=True)])}
        req=dict(guide_id='part',mode='rigid',progress=1,target_start=3,target_end=4,operation_id=None,allow_clip=False)
        result=move(q,req);self.assertFalse(result['unsafe_reasons']);self.assertEqual(len(result['domain_masks']),3)
        out=apply_move(q,result,'moved');Session(out);self.assertEqual(out['originals'],p['originals'])
        parents=out['motion_operations'][-1]['region_parents'];rid=next(i for i,parent in parents.items() if parent==derived(q,'part'))
        region=out['fill_regions'][rid];self.assertTrue(region['ownership_domain']);self.assertIn('REF-COMPONENT-LABEL',result['source_ids'])
        revised=propose_revision(out,rid,region['settings']);self.assertEqual(revised['covered'],region['covered'])
        final,_=accept_revision(out,revised,rid,'moved-boundary');Session(final)

    def test_packed_off_origin_partition_has_global_domain_and_exact_projection(self):
        from engine.roi_assistance import fill_roi,accept_fill_roi,mask_indices
        from engine.fill import defaults
        from engine.packed_render import render as packed_render
        original=fixture();w,h=513,257;ox,oy=300,100
        raw=original['originals']['source']['pixels'];plane=uniform(w,h).with_edits({(i//64+oy)*w+i%64+ox:p for i,p in enumerate(raw)})
        p=create(plane,w,h,12);p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=4),dict(layer_id='ink',drawing_id='source',start=4,length=8)]
        for name,point in [('cap',[328,110]),('coat',[328,130]),('shoes',[328,155])]:
            layer='ink' if name=='cap' else 'cap-ink';settings=defaults(point,[150,150,150,255],'unassigned');roi=[300,100,364,164]
            p,_=accept_fill_roi(p,fill_roi(p,layer,0,settings,roi),layer,0,name)
        q=accept(p,propose(p,request(p,offset=(ox,oy))),'split');Session(q)
        self.assertEqual(packed_render(q,2,None,[295,95,370,170]),packed_render(p,0,None,[295,95,370,170]))
        base=q['fill_regions'][derived(q,'base')];self.assertEqual(base['ownership_domain'][0],[1,0,0,0]);self.assertEqual(base['ownership_domain'][110*w+335],[0,0,0,0])
        rid=derived(q,'part');r=q['fill_regions'][rid];preview=fill_roi(q,r['ink_layer'],2,r['settings'],r['roi'],rid)
        self.assertEqual(mask_indices(preview['covered_mask'],r['roi']),mask_indices(r['covered_mask'],r['roi']))
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'HD.aaa';Session(q).save(path);self.assertEqual(Session.load(path).project,q)

    def test_partition_composes_exact_and_keeps_source_interval_geometry(self):
        p=fixture();before=fingerprint(p);q=accept(p,propose(p,request(p)),'split');Session(q)
        self.assertEqual(fingerprint(p),before);self.assertEqual(q['originals'],p['originals'])
        self.assertEqual(render(q,2),render(p,0));self.assertEqual(render(q,0),render(p,0));self.assertEqual(render(q,4),render(p,4))
        self.assertEqual(q['shot'],p['shot']);self.assertEqual(q['fill_regions']['cap']['length'],2)
        for role in ['base','part']:
            r=q['fill_regions'][derived(q,role)];self.assertEqual((r['start'],r['length']),(2,2));self.assertEqual(r['partition_parent_region'],'cap');self.assertEqual(r['palette_id'],'unassigned')
        record=q['raster_parts']['split'];self.assertEqual(record['region_input_snapshots']['cap'],p['fill_regions']['cap']);self.assertEqual(q['part_operations'][0],record)

    def test_both_boundaries_regenerate_without_leaking_across_cut(self):
        p=fixture();q=accept(p,propose(p,request(p)),'split')
        for role in ['base','part']:
            rid=derived(q,role);region=q['fill_regions'][rid];settings=deepcopy(region['settings'])
            settings['keep_open']=[10*64+30];result=propose_revision(q,rid,settings)
            self.assertEqual(set(result['covered']),set(region['covered']))
            out,_=accept_revision(q,result,rid,'regenerate-'+role);Session(out)
            self.assertEqual(out['originals'],q['originals']);self.assertEqual(out['fill_regions'][rid]['ownership_domain'],region['ownership_domain'])

    def test_revision_keeps_current_palette_boundary_and_paint_overrides(self):
        p=fixture();q=accept(p,propose(p,request(p)),'split');rid=derived(q,'part');target=q['fill_regions'][rid]
        # Rebind only the extracted cap; the base/source keep their named role.
        q=accept_palette(q,propose_palette(q,dict(action='recolor',palette_id='red',rgba=[230,30,45,0])),'palette-new')
        q=accept_palette(q,propose_palette(q,dict(action='rebind',palette_id='red',region_id=rid)),'palette-bind')
        r=propose_revision(q,rid,q['fill_regions'][rid]['settings']);q,_=accept_revision(q,r,rid,'boundary-revision')
        s=Session(q);s.layer_id=q['fill_regions'][rid]['fill_layer'];s.slot=2;i=10*64+35;s.correct({i:[17,23,39,0]});q=s.project
        req=request(p);req['operation_id']='split';out=accept(q,propose(q,req),'revision');Session(out)
        new=out['fill_regions'][rid];self.assertEqual(new['palette_id'],'red');self.assertEqual(new['settings']['color'],[230,30,45,0])
        actual=out['drawings'][new['fill_drawing']]['pixels'];self.assertEqual(actual[i],[17,23,39,0]);self.assertEqual(actual[10*64+34],[230,30,45,0])
        self.assertEqual(out['originals'],p['originals']);self.assertEqual(out['fill_regions'][rid]['region'],q['fill_regions'][rid]['region'])

    def test_partial_layer_and_retimed_source_region_refuse_without_mutation(self):
        p=fixture();req=request(p);req['actor_id']='cap-fill';before=fingerprint(p)
        with self.assertRaisesRegex(ValueError,'common actor'):propose(p,req)
        self.assertEqual(fingerprint(p),before);req=request(p);p['fill_regions']['cap']['length']=3
        with self.assertRaisesRegex(ValueError,'timing'):propose(p,req)

    def test_binding_role_and_raster_owner_remain_distinct(self):
        p=fixture();p['part_bindings']={'cap':dict(character_id='hero',part_id='hat.color-role',target_bounds=[16,4,40,18],reference_id=None,origin='artist_correction',view='front')}
        q=accept(p,propose(p,request(p)),'split');Session(q);rid=derived(q,'part');binding=q['part_bindings'][rid]
        self.assertEqual(binding['part_id'],'hat.color-role');self.assertEqual(binding['raster_owner_id'],'hero.right_fragment');self.assertEqual(binding['view'],'front')
        self.assertEqual(q['part_bindings']['cap'],p['part_bindings']['cap'])

    def test_tail_region_and_source_keys_are_retained(self):
        p=fixture();p['exposures']=[dict(e,length=8 if e['start']==0 else 4,start=0 if e['start']==0 else 8) for e in p['exposures']]
        for r in p['fill_regions'].values():r['length']=8
        req=request(p);req['target_end']=6;q=accept(p,propose(p,req),'split');Session(q)
        tails=q['raster_parts']['split']['tail_region_ids'];self.assertEqual(len(tails),3)
        for i in tails:self.assertEqual((q['fill_regions'][i]['start'],q['fill_regions'][i]['length']),(6,2))
        self.assertEqual(render(q,6),render(p,6));self.assertEqual(render(q,8),render(p,8))

    def test_other_reviewed_region_added_after_split_requires_explicit_rebind(self):
        from engine.regions import propose_additional,accept_additional
        from engine.fill import defaults
        p=fixture();q=accept(p,propose(p,request(p)),'split');rid=derived(q,'base')
        q,_=accept_additional(q,propose_additional(q,rid,defaults([2,2],[150,150,150,255],'unassigned')),rid,'new-exterior')
        req=request(p);req['operation_id']='split'
        with self.assertRaisesRegex(ValueError,'Region set'):propose(q,req)

    def test_region_palette_changes_are_part_worker_dependencies(self):
        p=fixture();settings=request(p);scope=subject(p,settings)[0];q=deepcopy(p);q['part_bindings']={'cap':dict(character_id='hero',part_id='cap',target_bounds=[16,4,40,18],reference_id=None,origin='artist_correction')}
        self.assertNotEqual(subject(q,settings)[0],scope);q=deepcopy(p);q['palettes']['unassigned']['rgba']=[1,2,3,255];self.assertNotEqual(subject(q,settings)[0],scope)

    def test_compact_and_legacy_reopen_keep_domains_and_independent_history(self):
        p=fixture();q=accept(p,propose(p,request(p)),'split')
        with tempfile.TemporaryDirectory() as td:
            for ext in ['.aaa','.aaa.json']:
                path=Path(td)/('regions'+ext);Session(q).save(path);self.assertEqual(Session.load(path).project,q)


if __name__=='__main__':unittest.main()
