"""Hidden local joint review bundle. Generates unapproved previews, never accepts."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))


def sha(path):
    result=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(4*1024**2),b''):result.update(block)
    return result.hexdigest()


def study(source,settings_file,output):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT)
    from hosts.standalone.session import Session
    from engine.jobs import create_joint_motion_job,read
    from engine import joint_motion as joint
    source,settings_file,output=map(Path,(source,settings_file,output))
    if output.exists():raise ValueError('Choose NEW private output; retain earlier studies')
    if settings_file.stat().st_size>65536:raise ValueError('Joint settings exceed64KiB')
    settings_bytes=settings_file.read_bytes();settings=json.loads(settings_bytes.decode('utf-8'));identity=sha(source)
    project=Session.load(source).project;joint.subject(project,settings)
    output.mkdir(parents=True,exist_ok=False);job=output/'job';create_joint_motion_job(project,settings,job)
    completed=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/worker.py'),'--job',str(job)],capture_output=True,text=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    (output/'worker-stdout.txt').write_text(completed.stdout,encoding='utf-8');(output/'worker-stderr.txt').write_text(completed.stderr,encoding='utf-8')
    if completed.returncode or read(job/'job.json')['state']!='completed':raise ValueError('Joint worker failed/cancelled; inspect private logs')
    result=read(job/'result.json')['joint_result'];candidates=[]
    for candidate in result['schedule']['candidates']:
        preview=joint.preview(project,result,candidate['id']);path=output/('candidate-'+candidate['id']+'.aaa');Session(preview).save(path)
        assert Session.load(path).project==preview
        assert all(preview['drawings'][did]['approved'] is False for did in result['generated_assets'])
        exposed={e['drawing_id'] for e in candidate['exposures']};candidates.append(dict(id=candidate['id'],file=path.name,sha256=sha(path),selected_actor_states=candidate['distinct_actor_states'],generated_raster_assets_exposed=len(set(result['generated_assets'])&exposed),same_as=candidate['same_as'],previously_rejected=candidate['previously_rejected'],exact_reopen=True,all_generated_assets_unapproved=True))
    if sha(source)!=identity or settings_file.read_bytes()!=settings_bytes:raise ValueError('Input changed during study; keep output as stale diagnostic')
    summary=dict(status='unapproved-joint-review-bundle',source_sha256=identity,settings_sha256=hashlib.sha256(settings_bytes).hexdigest(),source_unchanged=True,accepted=False,counts_per_generation_pass=result['counts'],preview_recomputation_passes=len(candidates),backend_evaluations_in_this_bundle=result['counts']['motion_samples_evaluated']*(1+len(candidates)),candidates=candidates,conflicts=result['schedule']['conflicts'],credits_snapshot=credits['snapshot_sha256'],warnings=result['warnings'])
    (output/'report.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');(output/'settings.json').write_bytes(settings_bytes)
    for name in ['CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    runs=output/'provenance/runs';runs.mkdir(parents=True);(runs/'joint-review.json').write_text(json.dumps(dict(summary,source_ids=result['source_ids'],network_allowed=False),indent=2)+'\n',encoding='utf-8')
    return summary


def main():
    p=argparse.ArgumentParser();p.add_argument('source',nargs='?',type=Path);p.add_argument('settings',nargs='?',type=Path);p.add_argument('output',nargs='?',type=Path);p.add_argument('--credits',action='store_true');args=p.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not all((args.source,args.settings,args.output)):p.error('Provide assistant project, joint settings JSON and NEW private output')
    print(json.dumps(study(args.source,args.settings,args.output)))


if __name__=='__main__':main()
