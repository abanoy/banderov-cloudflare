from copy import deepcopy
from pathlib import Path
import math
import json
import tempfile
import unittest

from engine.cleanup import propose,defaults,topology,thin,paths,subject,accept_cleanup,drawing_constraints
from engine.project import create,fingerprint
from engine.layers import source_over,render
from engine.jobs import create_cleanup_job,execute,read,atomic_write,apply_cleanup_result,request_cancel
from engine.fill import defaults as fill_defaults,propose as propose_fill,accept_fill
from engine.fill_revision import propose_revision,accept_revision
from engine.io.openraster import write_ora,import_ora
from hosts.standalone.session import Session


def jitter(width=64,height=40,ycenter=16):
    pixels=[[0,0,0,0] for _ in range(width*height)]
    for x in range(6,width-6):
        y=ycenter+[0,1,0,-1][x%4]
        for yy in range(y-1,y+2):pixels[yy*width+x]=[65,95,155,210]
    return pixels


def rms(pixels,width,height,center):
    result=[]
    for x in range(12,width-12):
        total=sum(pixels[y*width+x][3] for y in range(height))
        mean=sum((y+.5)*pixels[y*width+x][3] for y in range(height))/max(1,total)
        result.append((mean-center)**2)
    return math.sqrt(sum(result)/len(result))


class CleanupTests(unittest.TestCase):
    def test_jitter_reduced_without_silent_line_weight_color_or_topology_loss(self):
        pixels=jitter();before=deepcopy(pixels);result=propose(pixels,64,40,defaults(64,40))
        self.assertGreater(result['metrics']['changed_pixels'],0)
        self.assertLess(rms(result['pixels'],64,40,16.5),rms(pixels,64,40,16.5)*.5)
        ratio=sum(p[3] for p in result['pixels'])/sum(p[3] for p in pixels)
        self.assertTrue(.8<=ratio<=1.25)
        self.assertTrue(all(p[:3]==[65,95,155] for p in result['pixels'] if p[3]))
        self.assertEqual(pixels,before)
        self.assertEqual(topology({(i%64,i//64) for i,p in enumerate(result['pixels']) if p[3]>=32},64,40),dict(components=1,holes=0))

    def test_zero_strength_and_no_noise_is_exact_passthrough(self):
        pixels=jitter();settings=dict(defaults(64,40),iterations=0)
        result=propose(pixels,64,40,settings)
        self.assertEqual(result['pixels'],pixels)
        self.assertEqual(result['changed_indices'],[])
        with self.assertRaises(ValueError):accept_cleanup(create(pixels,64,40),result,'ink',0,'no-change')

    def test_selection_preserves_every_outside_pixel_and_seam_band(self):
        pixels=jitter();roi=[18,8,46,25]
        result=propose(pixels,64,40,dict(defaults(64,40),roi=roi))
        for i,(old,new) in enumerate(zip(pixels,result['pixels'])):
            x,y=i%64,i//64
            if not(18<=x<46 and 8<=y<25) or min(x-18,45-x,y-8,24-y)<2:self.assertEqual(new,old)

    def test_corners_and_graph_anchors_retain_source_samples(self):
        pixels=jitter()
        for x in range(12,34):
            for y in range(28,31):pixels[y*64+x]=[170,70,30,255]
        for y in range(28,38):
            for x in range(31,34):pixels[y*64+x]=[170,70,30,255]
        result=propose(pixels,64,40,defaults(64,40))
        self.assertEqual(result['pixels'][29*64+32],pixels[29*64+32])
        self.assertGreater(result['metrics']['smoothed_components'],0)

    def test_keep_detail_and_legacy_correction_are_hard_constraints(self):
        pixels=jitter();pixels[30*64+30]=[30,160,100,255]
        settings=dict(defaults(64,40),keep_pixels=[30*64+30],max_remove_area=1)
        result=propose(pixels,64,40,settings)
        self.assertEqual(result['pixels'][1950],[30,160,100,255])
        self.assertIn(1950,result['protected_pixels'])
        legacy=dict(pixels=pixels,origin='artist_correction',locked=True)
        protected=drawing_constraints(legacy)
        self.assertEqual(len(protected),2560)
        self.assertEqual(propose(pixels,64,40,settings,protected)['pixels'],pixels)

    def test_tiny_intended_detail_failure_is_explicit_and_keep_hint_repairs_it(self):
        pixels=jitter();pixels[30*64+30]=[30,160,100,255];pixels[30*64+45]=[90,90,100,255]
        baseline=propose(pixels,64,40,defaults(64,40))
        aggressive=propose(pixels,64,40,dict(defaults(64,40),max_remove_area=1))
        corrected=propose(pixels,64,40,dict(defaults(64,40),max_remove_area=1,keep_pixels=[1950]))
        self.assertEqual(baseline['pixels'][1950],pixels[1950])
        self.assertEqual(aggressive['pixels'][1950][3],0)
        self.assertEqual(corrected['pixels'][1950],pixels[1950])
        self.assertEqual(corrected['pixels'][1965][3],0)
        self.assertTrue(any('Small area does not imply noise' in w for w in aggressive['warnings']))

    def test_closed_shape_and_branch_topology_guard(self):
        width=40;height=40;pixels=[[0,0,0,0] for _ in range(width*height)]
        for y in range(8,27):
            for x in range(8,27):
                if x in {8,9,25,26} or y in {8,9,25,26}:pixels[y*width+x]=[60,100,160,255]
        for x in range(26,36):pixels[17*width+x]=[60,100,160,255]
        result=propose(pixels,width,height,defaults(width,height))
        before={(i%width,i//width) for i,p in enumerate(pixels) if p[3]>=32}
        after={(i%width,i//width) for i,p in enumerate(result['pixels']) if p[3]>=32}
        self.assertEqual(topology(before,width,height),topology(after,width,height))

    def test_explicit_white_paper_zero_strength_recomposes_exactly(self):
        pixels=source_over([[255,255,255,255] for _ in range(2560)],jitter())
        result=propose(pixels,64,40,dict(defaults(64,40),paper='white',iterations=0))
        self.assertEqual(result['pixels'],pixels)
        with self.assertRaises(ValueError):propose(jitter(),64,40,dict(defaults(64,40),paper='white'))

    def test_thinning_and_graph_analysis_are_not_semantic_labels(self):
        core={(x,y) for y in range(3,6) for x in range(2,18)}
        skeleton=thin(core)
        self.assertLess(len(skeleton),len(core));self.assertEqual(len(paths(skeleton)),1)
        self.assertTrue(all(type(x) is int and type(y) is int for x,y in skeleton))

    def test_worker_apply_keeps_other_holds_source_constraints_and_roundtrip(self):
        project=create(jitter(),64,40,12)
        project['drawings']['other']=deepcopy(project['drawings']['source'])
        project['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=5),dict(layer_id='ink',drawing_id='other',start=5,length=7)]
        session=Session(project);settings=dict(defaults(64,40),keep_pixels=[0])
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'job';create_cleanup_job(session.project,'ink',0,settings,job);execute(job)
            session.apply(job)
            self.assertEqual(session.project['drawings']['source'],project['drawings']['source'])
            self.assertEqual(render(session.project,6),render(project,6))
            self.assertEqual(session.project['originals'],project['originals'])
            self.assertIn(0,session.project['drawings'][session.drawing_id()]['protected_pixels'])
            path=Path(directory)/'cleanup.ora';write_ora(session.project,path)
            self.assertEqual(import_ora(path)['project'],session.project)
            session.travel();self.assertEqual(session.project['drawings'],project['drawings'])

    def test_worker_tamper_stale_undo_cancel_and_unrelated_edit(self):
        project=create(jitter(),64,40)
        project['layers']['other']=dict(name='Other',visible=False)
        project['drawings']['other']=deepcopy(project['drawings']['source'])
        project['exposures'].append(dict(layer_id='other',drawing_id='other',start=0,length=1))
        session=Session(project)
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'job';create_cleanup_job(project,'ink',0,defaults(64,40),job);execute(job)
            result=read(job/'result.json');bad=deepcopy(result);bad['cleanup_result']['pixels'][0]=[1,2,3,255];bad['output_sha256']=fingerprint(bad['cleanup_result']);atomic_write(job/'result.json',bad)
            with self.assertRaises(ValueError):apply_cleanup_result(project,job,'bad')
            atomic_write(job/'result.json',result)
            session.layer_id='other';session.correct({0:[1,2,3,255]});other=session.drawing_id()
            session.layer_id='ink';session.apply(job)
            self.assertEqual(session.project['drawings'][other]['pixels'][0],[1,2,3,255])
            with self.assertRaises(ValueError):session.apply(job)
            pending=Path(directory)/'pending';create_cleanup_job(project,'ink',0,defaults(64,40),pending)
            self.assertEqual(execute(pending,row_hook=lambda n:request_cancel(pending) if n==3 else None)['state'],'cancelled')
            self.assertFalse((pending/'result.json').exists())

    def test_dependent_undo_stays_stale_and_affected_fill_requires_review(self):
        project=create(jitter(),64,40)
        filled,_=accept_fill(project,propose_fill(jitter(),64,40,fill_defaults([20,28],[80,120,180,255])),'ink',0,'flat')
        session=Session(filled);session.layer_id='flat-ink'
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'cleanup';create_cleanup_job(session.project,'flat-ink',0,defaults(64,40),job);execute(job)
            session.apply(job)
            self.assertEqual(session.project['fill_regions']['flat']['geometry_status'],'source_changed_cleanup_review')
            revised=propose_revision(session.project,'flat',session.project['fill_regions']['flat']['settings'])
            updated,_=accept_revision(session.project,revised,'flat','new-fill')
            self.assertNotIn('geometry_status',updated['fill_regions']['flat'])
            fresh=Session(project);path=Path(directory)/'stale';create_cleanup_job(project,'ink',0,defaults(64,40),path);execute(path)
            fresh.correct({0:[1,2,3,255]});fresh.travel()
            with self.assertRaises(ValueError):fresh.apply(path)

    def test_unsaveable_commit_is_rejected_before_undo_or_document_mutation(self):
        session=Session(create(jitter(),64,40));before=deepcopy(session.project)
        huge=deepcopy(before);huge['oversize_diagnostic']='x'*(32*1024*1024)
        with self.assertRaises(ValueError):session.commit(huge,'oversize')
        self.assertEqual(session.project,before);self.assertEqual(session.past,[])
        exact=deepcopy(before);exact['oversize_diagnostic']=''
        padding=32*1024*1024-len(json.dumps(exact,indent=2,ensure_ascii=False).encode('utf-8'))
        exact['oversize_diagnostic']='x'*padding
        self.assertEqual(len(json.dumps(exact,indent=2,ensure_ascii=False).encode('utf-8')),32*1024*1024)
        with self.assertRaises(ValueError):session.commit(exact,'final-metadata-needs-space')
        self.assertEqual(session.project,before);self.assertEqual(session.past,[])

    def test_invalid_settings_and_roi_are_rejected(self):
        for changes in [dict(roi=[20,20,10,10]),dict(max_shift=float('nan')),dict(iterations=4),dict(keep_pixels=[-1]),dict(threshold=0),dict(extra='unsupported')]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):propose(jitter(),64,40,dict(defaults(64,40),**changes))


if __name__=='__main__':unittest.main()
