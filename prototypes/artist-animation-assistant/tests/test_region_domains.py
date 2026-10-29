"""Original contract diagnostics, not an artist workflow/semantic acceptance."""
from copy import deepcopy
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys

from engine.fill import propose,defaults,accept_fill
from engine.project import create,fingerprint
from engine.region_domains import (component_seeds,domain_indices,fill_arguments,
    validate_metadata,checked_seeds,inherit_domain)
from engine.spatial_constraints import uniform,ENCODING
from engine.roi_assistance import fill_roi,accept_fill_roi,validate_regions,mask_indices
from engine.fill_revision import propose_revision,accept_revision,dependency
from engine.regions import propose_additional,accept_additional
from hosts.standalone.session import Session


def box(x0,y0,x1,y1,w):
    return [y*w+x for y in range(y0,y1) for x in range(x0,x1)]


def owned():
    w,h=12,8
    domain=sorted(box(1,1,4,7,w)+box(7,1,11,7,w))
    p=create([[0,0,0,0] for _ in range(w*h)],w,h,12)
    settings=defaults([2,2],[20,130,220,190],'coat')
    result=propose(p['drawings']['source']['pixels'],w,h,settings,domain=domain,extra_seeds=[[8,2]])
    q,_=accept_fill(p,result,'ink',0,'owned')
    q['fill_regions']['owned'].update(ownership_domain=domain,ownership_encoding=ENCODING,component_seeds=[[8,2]])
    Session(q)
    return q


class RegionDomainTests(unittest.TestCase):
    def test_legacy_domain_revision_does_not_import_numpy(self):
        # -S hides site packages. This checks the actual stdlib-only code path,
        # not a stubbed NumPy implementation or an uninstalled local runtime.
        code='''
import sys
from engine.project import create
from engine.fill import defaults,propose,accept_fill
from engine.fill_revision import propose_revision,accept_revision
from engine.region_domains import OWNERSHIP_ENCODING
from hosts.standalone.session import Session
p=create([[0,0,0,0] for _ in range(16)],4,4,12)
domain=[0,1,4,5,10,11,14,15];settings=defaults([0,0],[1,2,3,255])
r=propose(p['drawings']['source']['pixels'],4,4,settings,domain=domain,extra_seeds=[[2,2]])
q,_=accept_fill(p,r,'ink',0,'owned')
q['fill_regions']['owned'].update(ownership_domain=domain,ownership_encoding=OWNERSHIP_ENCODING,component_seeds=[[2,2]])
Session(q)
out,_=accept_revision(q,propose_revision(q,'owned',settings),'owned','next')
Session(out)
assert 'numpy' not in sys.modules
assert out['fill_regions']['owned']['covered']==domain
print('stdlib legacy domain revision exact')
'''
        done=subprocess.run([sys.executable,'-S','-c',code],capture_output=True,text=True)
        self.assertEqual(done.returncode,0,done.stderr)
        self.assertIn('stdlib legacy domain revision exact',done.stdout)

    def test_four_neighbors_keep_diagonal_pieces_separate(self):
        self.assertEqual(component_seeds([0,5,10,15],4,4),[[0,0],[1,1],[2,2],[3,3]])
        self.assertEqual(component_seeds([1,2,5,6,15],4,4,[[2,1],[3,3]]),[[2,1],[3,3]])

    def test_thin_hole_and_disconnected_parts_all_get_seeds(self):
        ring=sorted(set(box(1,1,6,6,9))-set(box(2,2,5,5,9)))
        values=ring+[7,16,25,34]
        self.assertEqual(component_seeds(values,9,9),[[7,0],[1,1]])
        result=propose([[0,0,0,0] for _ in range(81)],9,9,defaults([1,1],[10,20,30,255]),domain=values,extra_seeds=[[7,0]])
        self.assertEqual(result['covered'],sorted(values));self.assertNotIn(3*9+3,result['region'])

    def test_fragmentation_is_refused_instead_of_dropping_small_pieces(self):
        self.assertEqual(len(component_seeds(list(range(0,32*32,2)),32,32)),16)
        # Rows above connect vertically. A checkerboard has truly isolated cells.
        values=[y*32+x for y in range(32) for x in range(32) if (x+y)%2==0]
        with self.assertRaisesRegex(ValueError,'128'):component_seeds(values,32,32)

    def test_domain_cannot_be_opened_by_keep_open_or_overlap(self):
        w,h=7,5;ink=[[0,0,0,0] for _ in range(w*h)]
        # Actual ink just across the ownership cut must not gain under-ink fill.
        for y in range(h):ink[y*w+3]=[30,40,50,128]
        settings=defaults([1,2],[220,30,20,255]);settings['keep_open']=[y*w+3 for y in range(h)]
        domain=box(0,0,3,h,w)
        r=propose(ink,w,h,settings,domain=domain)
        self.assertEqual(r['region'],domain);self.assertEqual(r['covered'],domain)
        self.assertTrue(all(r['fill'][y*w+3]==[0,0,0,0] for y in range(h)))
        self.assertEqual(r['ink'],ink);self.assertEqual(r['version'],'0.2.0')

    def test_exterior_is_not_all_reported_as_a_fake_boundary(self):
        r=propose([[0,0,0,0] for _ in range(100)],10,10,defaults([4,4],[1,2,3,255]),domain=[44])
        self.assertEqual(r['boundary'],[34,43,45,54]);self.assertEqual(r['covered'],[44])
        self.assertIn('REF-COMPONENT-LABEL',r['source_ids'])

    def test_all_explicit_seeds_are_checked_and_no_component_is_silently_skipped(self):
        pixels=[[0,0,0,0] for _ in range(36)];pixels[28]=[0,0,0,255]
        settings=defaults([1,1],[1,2,3,255]);domain=[7,8,27,28]
        with self.assertRaisesRegex(ValueError,'boundary'):propose(pixels,6,6,settings,domain=domain,extra_seeds=[[4,4]])
        with self.assertRaisesRegex(ValueError,'outside'):propose(pixels,6,6,settings,domain=domain,extra_seeds=[[5,5]])
        with self.assertRaisesRegex(ValueError,'outside'):propose(pixels,6,6,settings,domain=[])

    def test_invalid_domains_and_seeds_fail_closed(self):
        for domain in [[True],[0,0],[-1],[16]]:
            with self.subTest(domain=domain),self.assertRaises(ValueError):
                propose([[0,0,0,0] for _ in range(16)],4,4,defaults([1,1],[0,0,0,255]),domain=domain)
        for seeds in [[[True,1]],[[1.5,1]],[[1,1],[1,1]],[[4,1]],[[1]],{}]:
            with self.subTest(seeds=seeds),self.assertRaises(ValueError):checked_seeds(seeds,4,4)

    def test_unconstrained_behavior_and_provenance_stay_byte_identical(self):
        from engine.fill import SOURCES
        pixels=[[0,0,0,0] for _ in range(20)];settings=defaults([1,1],[10,20,30,0])
        a=propose(pixels,5,4,settings);b=propose(pixels,5,4,settings,domain=None,extra_seeds=[])
        self.assertEqual(a,b);self.assertEqual(a['version'],'0.1.0');self.assertEqual(a['source_ids'],SOURCES)
        self.assertNotIn('component_seeds',a);self.assertEqual(a['covered'],list(range(20)))

    def test_component_cancellation_propagates_without_result(self):
        class Stop(Exception):pass
        calls=[]
        def cancel():calls.append(True);raise Stop()
        with self.assertRaises(Stop):component_seeds(list(range(32*32)),32,32,checkpoint=cancel)
        self.assertEqual(len(calls),1)

    def test_off_origin_hd_query_and_seed_mapping_are_bounded_and_exact(self):
        w,h=1920,1080;values=box(705,307,711,313,w)
        mask=uniform(w,h).with_edits({i:[1,0,0,0] for i in values})
        region=dict(ownership_domain=mask,ownership_encoding=ENCODING,component_seeds=[[707,309]])
        result=fill_arguments(region,w,h,[700,300,720,320])
        self.assertEqual(result['extra_seeds'],[[7,9]]);self.assertEqual(result['domain'],box(5,7,11,13,20))
        self.assertEqual(domain_indices(mask,w,h,[700,300,720,320]),values)
        with self.assertRaisesRegex(ValueError,'512'):domain_indices(mask,w,h)
        with self.assertRaisesRegex(ValueError,'selection'):fill_arguments(region,w,h,[0,0,200,200])

    def test_domain_encoding_and_geometric_escape_are_rejected_on_load(self):
        q=owned();bad=deepcopy(q);bad['fill_regions']['owned']['covered'].append(0)
        with self.assertRaisesRegex(ValueError,'escapes'):Session(bad)
        bad=deepcopy(q);bad['fill_regions']['owned']['ownership_encoding']='rgba-visual-mask'
        with self.assertRaisesRegex(ValueError,'encoding'):Session(bad)
        bad=deepcopy(q);bad['fill_regions']['owned']['component_seeds']=[[0,0]]
        with self.assertRaisesRegex(ValueError,'outside'):Session(bad)

    def test_domain_revision_preserves_painted_and_transparent_overrides(self):
        p=owned();s=Session(p);s.layer_id='owned-fill';s.slot=0
        s.correct({2*12+2:[31,42,53,0],0:[1,2,3,255]});q=s.project;before=fingerprint(q)
        settings=deepcopy(q['fill_regions']['owned']['settings']);r=propose_revision(q,'owned',settings)
        self.assertEqual(r['covered'],q['fill_regions']['owned']['covered'])
        self.assertEqual(r['fill'][26],[31,42,53,0]);self.assertEqual(r['fill'][0],[1,2,3,255])
        out,_=accept_revision(q,r,'owned','revision');Session(out)
        self.assertEqual(fingerprint(q),before);self.assertEqual(out['originals'],q['originals'])
        self.assertEqual(out['fill_regions']['owned']['component_seeds'],[[8,2]])

    def test_domain_hint_change_invalidates_local_worker_even_after_undo(self):
        from engine.jobs import create_fill_revision_job,execute,apply_fill_result
        p=owned();settings=p['fill_regions']['owned']['settings']
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'job';create_fill_revision_job(p,'owned',settings,job)
            self.assertEqual(execute(job)['state'],'completed')
            s=Session(p);q=deepcopy(p);q['fill_regions']['owned']['component_seeds']=[[9,3]];s.commit(q,'edit-seed-hints');s.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):apply_fill_result(s.project,job,'stale')

    def test_legacy_domain_and_hints_roundtrip_both_formats_without_source_change(self):
        p=owned()
        with tempfile.TemporaryDirectory() as td:
            for ext in ['.aaa','.aaa.json']:
                path=Path(td)/('owned'+ext);Session(p).save(path)
                self.assertEqual(Session.load(path).project,p)

    def test_additional_region_inherits_domain_but_not_other_component_seeds(self):
        p=owned();r=p['fill_regions']['owned'];chosen=box(1,1,4,7,12)
        # Diagnostic authoring: retain the second allowed component as unassigned.
        r.update(region=chosen,covered=chosen,component_seeds=[])
        did=r['fill_drawing'];p['drawings'][did]['pixels']=[pixel if i in chosen else [0,0,0,0] for i,pixel in enumerate(p['drawings'][did]['pixels'])]
        Session(p);settings=defaults([8,2],[220,30,50,0],'second');result=propose_additional(p,'owned',settings)
        self.assertEqual(result['covered'],box(7,1,11,7,12))
        out,_=accept_additional(p,result,'owned','second');Session(out)
        self.assertEqual(inherit_domain(out['fill_regions']['second']),inherit_domain(r))
        self.assertNotIn('component_seeds',out['fill_regions']['second'])

    def test_packed_boundary_revision_honors_global_domain_without_expanding_it(self):
        w,h=513,257;roi=[280,80,400,150]
        edge=set(box(295,95,325,130,w))-set(box(296,96,324,129,w))
        plane=uniform(w,h).with_edits({i:[25,35,45,255] for i in edge})
        p=create(plane,w,h,12)
        settings=defaults([310,110],[20,130,220,255],'coat')
        q,_=accept_fill_roi(p,fill_roi(p,'ink',0,settings,roi),'ink',0,'packed')
        r=q['fill_regions']['packed'];r.update(ownership_domain=uniform(w,h,True),ownership_encoding=ENCODING,component_seeds=[[315,115]])
        validate_regions(q);source=fingerprint(q['originals'])
        result=fill_roi(q,'packed-ink',0,settings,roi,'packed')
        self.assertEqual(mask_indices(result['covered_mask'],roi),mask_indices(r['covered_mask'],roi))
        out,_=accept_fill_roi(q,result,'packed-ink',0,'next','packed');Session(out)
        self.assertEqual(out['fill_regions']['packed']['component_seeds'],[[315,115]])
        self.assertEqual(fingerprint(out['originals']),source)
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'packed.aaa';Session(out).save(path);self.assertEqual(Session.load(path).project,out)


if __name__=='__main__':unittest.main()
