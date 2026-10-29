from copy import deepcopy
from pathlib import Path
import tempfile
import unittest

from engine.fill import propose,defaults,accept_fill
from engine.fill_revision import propose_revision
from engine.regions import propose_additional,accept_additional,propose_palette,accept_palette,managed_pixels,palette_dependency
from engine.jobs import create_palette_job,create_additional_region_job,execute,read,atomic_write,apply_palette_result,apply_fill_result,request_cancel
from engine.layers import render
from engine.project import create,fingerprint
from engine.io.openraster import write_ora,import_ora
from hosts.standalone.session import Session

BLUE=[80,155,220,255]


def compartments():
    pixels=[[0,0,0,0] for _ in range(32*16)]
    for y in range(3,13):
        for x in range(3,29):
            if x in {3,11,20,28} or y in {3,12}:pixels[y*32+x]=[35,45,65,255]
    pixels[7*32+11]=[35,45,65,80]
    project=create(pixels,32,16,12)
    project['drawings']['other']=deepcopy(project['drawings']['source'])
    project['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=5),dict(layer_id='ink',drawing_id='other',start=5,length=7)]
    return project


def three_regions():
    project=compartments()
    first=propose(project['drawings']['source']['pixels'],32,16,defaults([5,5],BLUE,'shared'))
    project,layer=accept_fill(project,first,'ink',0,'r1')
    for identity,seed,palette in [('r2',[15,5],'shared'),('r3',[24,5],'independent')]:
        result=propose_additional(project,'r1',defaults(seed,BLUE,palette))
        project,layer=accept_additional(project,result,'r1',identity)
    return project


def current_fill(project,identity):
    region=project['fill_regions'][identity]
    exposure=next(e for e in project['exposures'] if e['layer_id']==region['fill_layer'] and e['start']==region['start'])
    return project['drawings'][exposure['drawing_id']]


class RegionPaletteTests(unittest.TestCase):
    def test_three_regions_share_single_ink_group_and_keep_other_hold(self):
        source=compartments();project=three_regions()
        self.assertEqual(len(project['layers']),6)
        self.assertEqual(sum(l.get('nodetype')=='grouplayer' for l in project['layers'].values()),1)
        self.assertEqual({r['ink_layer'] for r in project['fill_regions'].values()},{'r1-ink'})
        self.assertEqual(project['drawings']['source'],source['drawings']['source'])
        self.assertEqual(project['originals'],source['originals'])
        self.assertEqual(render(project,6),render(source,6))
        relations={tuple(r['regions']):r for r in project['region_relations']}
        self.assertTrue(relations['r1','r2']['adjacent_proxy'])
        self.assertFalse(relations['r1','r3']['adjacent_proxy'])

    def test_overlap_and_revision_merge_rejected_without_input_mutation(self):
        project=three_regions();before=deepcopy(project)
        with self.assertRaises(ValueError):propose_additional(project,'r1',defaults([5,5],BLUE,'another'))
        settings=deepcopy(project['fill_regions']['r1']['settings']);settings['keep_open']=[7*32+11]
        with self.assertRaises(ValueError):propose_revision(project,'r1',settings)
        self.assertEqual(project,before)

    def test_palette_recolor_follows_identity_not_matching_rgb(self):
        project=three_regions();before=deepcopy(project)
        request=dict(action='recolor',palette_id='shared',rgba=[10,200,100,128])
        result=propose_palette(project,request)
        updated=accept_palette(project,result,'palette-v1')
        self.assertEqual(set(result['updates']),{'r1','r2'})
        self.assertEqual(current_fill(updated,'r1')['pixels'][5*32+5],[10,200,100,128])
        self.assertEqual(current_fill(updated,'r2')['pixels'][5*32+15],[10,200,100,128])
        self.assertEqual(current_fill(updated,'r3'),current_fill(project,'r3'))
        self.assertEqual(updated['fill_regions']['r3'],project['fill_regions']['r3'])
        self.assertEqual(render(updated,6),render(project,6))
        self.assertEqual(project,before)

    def test_paint_erase_and_nonmanaged_equal_color_are_preserved(self):
        session=Session(three_regions());session.layer_id='r1-fill'
        session.correct({5*32+5:[210,30,40,255],5*32+6:[0,0,0,0]})
        project=session.project
        # Same RGB outside the authoritative mask must not be color-matched.
        current_fill(project,'r2')['pixels'][0]=BLUE[:]
        updated=accept_palette(project,propose_palette(project,dict(action='recolor',palette_id='shared',rgba=[1,2,3,100])),'color-v2')
        self.assertEqual(current_fill(updated,'r1')['pixels'][165],[210,30,40,255])
        self.assertEqual(current_fill(updated,'r1')['pixels'][166],[0,0,0,0])
        self.assertEqual(current_fill(updated,'r2')['pixels'][0],BLUE)

    def test_transparency_roundtrip_keeps_managed_mask_for_later_recolor(self):
        project=three_regions()
        clear=accept_palette(project,propose_palette(project,dict(action='recolor',palette_id='shared',rgba=[10,20,30,0])),'clear')
        self.assertEqual(current_fill(clear,'r1')['pixels'][165],[10,20,30,0])
        self.assertTrue(clear['fill_regions']['r1']['covered'])
        restored=accept_palette(clear,propose_palette(clear,dict(action='recolor',palette_id='shared',rgba=BLUE)),'restore')
        self.assertEqual(current_fill(restored,'r1')['pixels'][165],BLUE)
        self.assertEqual(restored['fill_regions']['r1']['region'],project['fill_regions']['r1']['region'])

    def test_selected_rebind_is_distinct_from_palette_wide_recolor(self):
        project=three_regions()
        orange=[220,130,20,255]
        project=accept_palette(project,propose_palette(project,dict(action='recolor',palette_id='independent',rgba=orange)),'orange')
        rebound=accept_palette(project,propose_palette(project,dict(action='rebind',palette_id='independent',region_id='r2')),'rebind')
        self.assertEqual(rebound['fill_regions']['r2']['palette_id'],'independent')
        self.assertEqual(current_fill(rebound,'r2')['pixels'][5*32+15],orange)
        self.assertEqual(current_fill(rebound,'r1'),current_fill(project,'r1'))
        self.assertEqual(rebound['palettes'],project['palettes'])
        next_result=propose_palette(rebound,dict(action='recolor',palette_id='shared',rgba=[1,2,3,255]))
        self.assertEqual(set(next_result['updates']),{'r1'})

    def test_hidden_region_recolors_but_locked_target_aborts_atomically(self):
        project=three_regions();project['layers']['r2-fill']['visible']=False
        result=propose_palette(project,dict(action='recolor',palette_id='shared',rgba=[1,2,3,255]))
        updated=accept_palette(project,result,'hidden')
        self.assertFalse(updated['layers']['r2-fill']['visible'])
        project['layers']['r2-fill']['locked']=True;before=deepcopy(project)
        with self.assertRaises(ValueError):propose_palette(project,dict(action='recolor',palette_id='shared',rgba=[1,2,3,255]))
        self.assertEqual(project,before)

    def test_current_ink_edit_is_independent_of_mask_only_palette_edit(self):
        session=Session(three_regions());request=dict(action='recolor',palette_id='shared',rgba=[1,2,3,255])
        scope=palette_dependency(session.project,request)[0]
        session.layer_id='r1-ink';session.correct({0:[20,40,60,255]})
        self.assertEqual(palette_dependency(session.project,request)[0],scope)

    def test_legacy_mask_uses_retained_geometry_and_legacy_lock_is_full(self):
        project=three_regions();expected=project['fill_regions']['r1'].pop('covered')
        recovered,legacy=managed_pixels(project,'r1')
        self.assertEqual(recovered,expected);self.assertTrue(legacy)
        current_fill(project,'r1')['locked']=True
        result=propose_palette(project,dict(action='recolor',palette_id='shared',rgba=[1,2,3,255]))
        self.assertEqual(result['updates']['r1']['pixels'],current_fill(project,'r1')['pixels'])

    def test_worker_local_scope_tamper_cancel_and_replay(self):
        session=Session(three_regions());request=dict(action='recolor',palette_id='shared',rgba=[1,2,3,255])
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'palette'
            create_palette_job(session.project,request,path);execute(path)
            result=read(path/'result.json');bad=deepcopy(result)
            bad['palette_result']['updates']['r1']['pixels'][165]=[3,2,1,255]
            bad['output_sha256']=fingerprint(bad['palette_result']);atomic_write(path/'result.json',bad)
            with self.assertRaises(ValueError):apply_palette_result(session.project,path,'bad')
            atomic_write(path/'result.json',result)
            session.layer_id='r1-ink';session.correct({0:[20,40,60,255]})
            source_ink=session.drawing_id();session.apply(path)
            self.assertEqual(session.project['drawings'][source_ink]['pixels'][0],[20,40,60,255])
            with self.assertRaises(ValueError):session.apply(path)
            cancel=Path(directory)/'cancel';create_palette_job(session.project,request,cancel);request_cancel(cancel)
            self.assertEqual(execute(cancel)['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_dependent_fill_undo_cannot_revive_palette_job(self):
        session=Session(three_regions());request=dict(action='recolor',palette_id='shared',rgba=[1,2,3,255])
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'palette';create_palette_job(session.project,request,path);execute(path)
            session.layer_id='r1-fill';session.correct({165:[1,2,3,0]});session.travel()
            with self.assertRaises(ValueError):session.apply(path)

    def test_additional_region_worker_preserves_existing_ink_and_region_versions(self):
        source=compartments();first=propose(source['drawings']['source']['pixels'],32,16,defaults([5,5],BLUE,'shared'))
        project,_=accept_fill(source,first,'ink',0,'r1')
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'add';create_additional_region_job(project,'r1',defaults([15,5],BLUE,'shared'),path);execute(path)
            updated,layer=apply_fill_result(project,path,'r2')
            self.assertEqual(updated['layers']['r1-ink'],project['layers']['r1-ink'])
            self.assertEqual(updated['fill_regions']['r1'],project['fill_regions']['r1'])
            self.assertEqual(layer,'r2-fill')

    def test_roundtrip_retains_region_palette_masks_relations_and_epochs(self):
        session=Session(three_regions())
        request=dict(action='recolor',palette_id='shared',rgba=[30,100,200,140])
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'job';create_palette_job(session.project,request,job);execute(job);session.apply(job)
            path=Path(directory)/'palette.ora';write_ora(session.project,path)
            self.assertEqual(import_ora(path)['project'],session.project)


if __name__=='__main__':unittest.main()
