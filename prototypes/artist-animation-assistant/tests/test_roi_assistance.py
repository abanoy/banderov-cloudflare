from copy import deepcopy
from pathlib import Path
import tempfile,unittest
import numpy as np
from engine.project import create,fingerprint
from engine.spatial_constraints import uniform,indices,ENCODING
from engine.cleanup import defaults
from engine.fill import defaults as fill_defaults
from engine.roi_assistance import cleanup_roi,fill_roi,accept_fill_roi,mask_indices,rectangle,patch
from engine.jobs import create_cleanup_job,create_roi_fill_job,execute,read,apply_cleanup_result,apply_fill_result,atomic_write,request_cancel
from engine.packed_render import render
from hosts.standalone.session import Session


def scene(w=513,h=257,white=False):
    plane=uniform(w,h)
    if white:plane=patch(plane,[280,80,400,160],bytes([255,255,255,255])*(120*80))
    edits={}
    for x0,x1 in [(295,325),(345,375)]:
        for y in range(95,130):
            for x in range(x0,x1):
                if x in {x0,x1-1} or y in {95,129}:edits[y*w+x]=[25,35,45,255]
    plane=plane.with_edits(edits)
    p=create(plane,w,h,12);p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=4),dict(layer_id='ink',drawing_id='source',start=4,length=8)]
    return p


def rough():
    p=scene();w=p['canvas']['width'];edits={}
    for x in range(290,390):
        for y in range(180+[0,1,0,-1][x%4],183+[0,1,0,-1][x%4]):edits[y*w+x]=[65,95,155,210]
    # Build original, never mutate retained original to manufacture a correction.
    plane=p['drawings']['source']['pixels'].with_edits(edits)
    return create(plane,w,257,12)


def outside_equal(case,a,b,roi):
    # Exact full pixel samples including hidden RGB on a manageable diagnostic.
    aa=np.frombuffer(a.region_bytes(),np.uint8).reshape(a.height,a.width,4);bb=np.frombuffer(b.region_bytes(),np.uint8).reshape(a.height,a.width,4)
    mask=np.ones(aa.shape[:2],bool);mask[roi[1]:roi[3],roi[0]:roi[2]]=False
    case.assertTrue(np.array_equal(aa[mask],bb[mask]))


class RoiAssistanceTests(unittest.TestCase):
    def test_off_origin_cleanup_preserves_outside_source_and_maps_paths(self):
        p=rough();before=fingerprint(p);settings=dict(defaults(513,257),roi=[280,165,400,200])
        r=cleanup_roi(p,'ink',0,settings)
        self.assertGreater(len(r['changed_indices']),0);self.assertEqual(fingerprint(p),before)
        outside_equal(self,p['drawings']['source']['pixels'],r['pixels'],settings['roi'])
        self.assertTrue(all(280<=i%513<400 and 165<=i//513<200 for i in r['changed_indices']))
        for c in r['components']:
            for path in c.get('paths',[]):self.assertTrue(all(264<=v[0]<416 and 149<=v[1]<216 for v in path['curve']))

    def test_cleanup_protected_component_and_world_keep_hints(self):
        p=rough();s=Session(p);s.correct({181*513+310:[65,95,155,210],9:[80,70,60,0]})
        settings=dict(defaults(513,257),roi=[280,165,400,200],keep_pixels=[2,181*513+350])
        source=s.project['drawings'][s.drawing_id()];r=cleanup_roi(s.project,'ink',0,settings)
        self.assertEqual(r['pixels'][181*513+310],source['pixels'][181*513+310]);self.assertEqual(r['pixels'][9],[80,70,60,0])
        self.assertEqual(set(indices(dict(pixels=r['pixels'],protected_mask=r['protected_mask'],protection_encoding=ENCODING),[0,0,20,1])),{2,9})

    def test_worker_cleanup_accept_tamper_stale_and_cancel(self):
        p=rough();settings=dict(defaults(513,257),roi=[280,165,400,200]);s=Session(p)
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'cleanup';create_cleanup_job(p,'ink',0,settings,job);self.assertEqual(execute(job)['state'],'completed')
            result=read(job/'result.json');self.assertEqual(result['cleanup_result']['adapter'],'packed-context-roi-1')
            result['pixels']=result['pixels'].with_edits({0:[1,2,3,255]});atomic_write(job/'result.json',result)
            with self.assertRaises(ValueError):apply_cleanup_result(p,job,'bad')
            result['pixels']=result['cleanup_result']['pixels'];atomic_write(job/'result.json',result)
            accepted=apply_cleanup_result(p,job,'clean');self.assertEqual(accepted['originals'],p['originals']);self.assertEqual(accepted['drawings']['source'],p['drawings']['source'])
            s.correct({0:[4,5,6,255]});s.travel()
            with self.assertRaises(ValueError):apply_cleanup_result(s.project,job,'stale')
            cancel=Path(td)/'cancel';create_cleanup_job(p,'ink',0,settings,cancel)
            self.assertEqual(execute(cancel,lambda tick:request_cancel(cancel))['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_fill_exact_source_outside_and_held_schedules(self):
        p=scene();settings=fill_defaults([310,110],[80,140,220,255],'blue');roi=[285,85,335,140]
        r=fill_roi(p,'ink',0,settings,roi);updated,layer=accept_fill_roi(p,r,'ink',0,'first')
        self.assertEqual(updated['drawings']['source'],p['drawings']['source']);self.assertEqual(updated['originals'],p['originals'])
        outside_equal(self,p['drawings']['source']['pixels'],r['ink'],roi)
        self.assertEqual(r['fill'][110*513+310],[80,140,220,255]);self.assertEqual(r['fill'][0],[0,0,0,0])
        self.assertEqual(render(updated,4)[2],render(p,4)[2]);self.assertEqual(updated['fill_regions']['first']['region_format'],'packed_roi_v1')
        self.assertNotIn('covered',updated['fill_regions']['first']);self.assertGreater(len(mask_indices(updated['fill_regions']['first']['covered_mask'],roi)),0)

    def test_crop_context_is_not_implicit_selection_boundary(self):
        p=scene();settings=fill_defaults([280,75],[80,140,220,255],'blue');roi=[270,65,290,85]
        r=fill_roi(p,'ink',0,settings,roi)
        self.assertTrue(r['metrics']['touches_edge']);self.assertTrue(any('possible leak' in x for x in r['warnings']))
        self.assertEqual(r['fill'][74*513+279],[80,140,220,255]);self.assertEqual(r['fill'][64*513+279],[0,0,0,0])

    def test_white_paper_and_artist_erasure_preserved(self):
        p=scene(white=True);s=Session(p);index=110*513+310;s.correct({index:[80,90,100,0]})
        settings=fill_defaults([312,110],[80,140,220,255],'blue');settings['paper']='white';roi=[285,85,335,140]
        # Mixed transparent samples inside opaque paper require explicit transparent mode.
        with self.assertRaisesRegex(ValueError,'must be opaque'):fill_roi(s.project,'ink',0,settings,roi)
        r=fill_roi(p,'ink',0,settings,roi);outside_equal(self,p['drawings']['source']['pixels'],r['ink'],roi)
        s=Session(scene());s.correct({index:[80,90,100,0]})
        settings['paper']='transparent';r=fill_roi(s.project,'ink',0,settings,roi)
        self.assertEqual(r['ink'][index],[80,90,100,0]);self.assertEqual(r['fill'][index],[0,0,0,0])

    def test_fill_worker_additional_revision_override_and_replay(self):
        p=scene();settings=fill_defaults([310,110],[80,140,220,255],'blue');roi=[285,85,335,140]
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'fill';create_roi_fill_job(p,'ink',0,settings,roi,job);self.assertEqual(execute(job)['state'],'completed')
            updated,layer=apply_fill_result(p,job,'first');s=Session(updated);s.layer_id=layer;s.slot=0;s.correct({110*513+310:[8,9,10,0]})
            s.layer_id='first-ink';settings['seed']=[312,110]
            revision=Path(td)/'revision';create_roi_fill_job(s.project,'first-ink',0,settings,roi,revision,region_id='first');self.assertEqual(execute(revision)['state'],'completed')
            revised,target=apply_fill_result(s.project,revision,'version2');ex=next(x for x in revised['exposures'] if x['layer_id']==target and x['start']==0)
            self.assertEqual(revised['drawings'][ex['drawing_id']]['pixels'][110*513+310],[8,9,10,0]);self.assertEqual(revised['fill_regions']['first']['version'],1)
            atomic_write(revision/'applied-by-host.json',{})
            with self.assertRaisesRegex(ValueError,'reviewed'):apply_fill_result(s.project,revision,'replay')
            settings['seed']=[360,110];extra=Path(td)/'extra';create_roi_fill_job(updated,'first-ink',0,settings,[335,85,385,140],extra,region_id='first',adding=True);self.assertEqual(execute(extra)['state'],'completed')
            second,_=apply_fill_result(updated,extra,'second');self.assertEqual(second['fill_regions']['second']['ink_layer'],'first-ink')
            settings['seed']=[310,110]
            with self.assertRaisesRegex(ValueError,'overlaps'):fill_roi(updated,'first-ink',0,settings,roi)

    def test_four_k_and_limits_cancellation_and_invalid_adapter(self):
        p=scene(3840,2160);settings=fill_defaults([310,110],[80,140,220,255],'blue');roi=[285,85,335,140]
        r=fill_roi(p,'ink',0,settings,roi);self.assertEqual(r['fill'].width,3840);self.assertEqual(r['fill'][110*3840+310],[80,140,220,255])
        with self.assertRaises(ValueError):rectangle(p,[0,0,225,20])
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'cancel';create_roi_fill_job(p,'ink',0,settings,roi,job);request_cancel(job)
            self.assertEqual(execute(job)['state'],'cancelled');self.assertFalse((job/'result.json').exists())



    def test_large_palette_transparent_then_color_preserves_geometry_and_erasure(self):
        from engine.regions import propose_palette,accept_palette
        p=scene();settings=fill_defaults([310,110],[80,140,220,255],'blue');roi=[285,85,335,140]
        p,layer=accept_fill_roi(p,fill_roi(p,'ink',0,settings,roi),'ink',0,'one');s=Session(p);s.layer_id=layer;s.correct({110*513+310:[8,9,10,0],0:[77,88,99,0]})
        original=deepcopy(s.project);request=dict(action='recolor',palette_id='blue',rgba=[230,50,90,0]);result=propose_palette(s.project,request);updated=accept_palette(s.project,result,'transparent')
        request['rgba']=[30,180,90,255];updated=accept_palette(updated,propose_palette(updated,request),'colored')
        e=next(x for x in updated['exposures'] if x['layer_id']==layer and x['start']==0);d=updated['drawings'][e['drawing_id']]
        self.assertEqual(d['pixels'][110*513+310],[8,9,10,0]);self.assertEqual(d['pixels'][0],[77,88,99,0]);self.assertEqual(d['pixels'][111*513+310],request['rgba'])
        self.assertEqual(updated['fill_regions']['one']['covered_mask'],original['fill_regions']['one']['covered_mask']);self.assertNotIn('covered',updated['fill_regions']['one']);self.assertIn(0,indices(d,[0,0,20,1]))

    def test_additional_white_paper_separates_only_its_selected_area(self):
        p=scene(white=True);settings=fill_defaults([310,110],[80,140,220,255],'blue');settings['paper']='white';roi=[285,85,335,140]
        p,_=accept_fill_roi(p,fill_roi(p,'ink',0,settings,roi),'ink',0,'one');source=p['drawings']['one-ink-drawing']['pixels'];settings['seed']=[360,110];second=[335,85,385,140]
        r=fill_roi(p,'one-ink',0,settings,second);updated,_=accept_fill_roi(p,r,'one-ink',0,'two')
        e=next(x for x in updated['exposures'] if x['layer_id']=='one-ink' and x['start']==0)
        self.assertEqual(e['drawing_id'],'two-ink-drawing');outside_equal(self,source,updated['drawings'][e['drawing_id']]['pixels'],second)
        self.assertEqual(updated['fill_regions']['one']['covered_mask'],p['fill_regions']['one']['covered_mask']);self.assertEqual(updated['drawings']['one-fill-drawing'],p['drawings']['one-fill-drawing'])

    def test_unrelated_layer_edit_allowed_dependent_undo_refused(self):
        p=scene();p['drawings']['other']=dict(pixels=uniform(513,257),origin='synthetic',approved=True,locked=False);p['layers']['other']=dict(name='Independent',parent_id=None,visible=True,locked=False,order=5);p['exposures'].append(dict(layer_id='other',drawing_id='other',start=0,length=12))
        s=Session(p);settings=fill_defaults([310,110],[80,140,220,255],'blue');roi=[285,85,335,140]
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'fill';create_roi_fill_job(p,'ink',0,settings,roi,job);execute(job)
            s.layer_id='other';s.correct({0:[1,2,3,255]});updated,_=apply_fill_result(s.project,job,'fresh')
            self.assertEqual(next(e for e in updated['exposures'] if e['layer_id']=='other')['drawing_id'],s.drawing_id())
            s.layer_id='ink';s.correct({0:[4,5,6,0]});s.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):apply_fill_result(s.project,job,'stale')

    def test_persisted_bad_masks_and_off_selection_flags_refused(self):
        p=scene();settings=fill_defaults([310,110],[80,140,220,255],'blue');roi=[285,85,335,140]
        p,_=accept_fill_roi(p,fill_roi(p,'ink',0,settings,roi),'ink',0,'one');r=p['fill_regions']['one'];old=r['covered_mask']
        r['covered_mask']=old.with_edits({0:[1,0,0,0]})
        with self.assertRaisesRegex(ValueError,'outside'):Session(p)
        r['covered_mask']=old.with_edits({110*513+310:[2,0,0,0]})
        with self.assertRaisesRegex(ValueError,'red0/1'):Session(p)

    def test_fill_manifest_and_output_tampering_refused(self):
        p=scene();settings=fill_defaults([310,110],[80,140,220,255],'blue');roi=[285,85,335,140]
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'fill';create_roi_fill_job(p,'ink',0,settings,roi,job);execute(job);r=read(job/'result.json');old=deepcopy(r)
            r['fill_result']['fill']=r['fill_result']['fill'].with_edits({0:[7,8,9,0]});atomic_write(job/'result.json',r)
            with self.assertRaisesRegex(ValueError,'output'):apply_fill_result(p,job,'bad')
            atomic_write(job/'result.json',old);manifest=read(job/'job.json');manifest['roi_adapter']='other';atomic_write(job/'job.json',manifest)
            with self.assertRaisesRegex(ValueError,'adapter'):apply_fill_result(p,job,'bad2')


if __name__=='__main__':unittest.main()
