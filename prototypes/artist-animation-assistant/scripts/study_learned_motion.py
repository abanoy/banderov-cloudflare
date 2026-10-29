"""Create a hidden local unapproved learned-layer review bundle. Never accepts."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(4*1024**2),b''):h.update(block)
    return h.hexdigest()


def study(source,settings_file,output):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT)
    from hosts.standalone.session import Session
    from engine.jobs import create_learned_motion_job,read,atomic_write
    from engine import learned_motion
    source,settings_file,output=map(Path,(source,settings_file,output))
    if output.exists():raise ValueError('Choose a NEW private review directory')
    if settings_file.stat().st_size>65536:raise ValueError('Settings exceed64KiB')
    settings_bytes=settings_file.read_bytes();settings=json.loads(settings_bytes.decode('utf-8'));before=digest(source);project=Session.load(source).project;learned_motion.subject(project,settings)
    output.mkdir(parents=True,exist_ok=False);job=output/'job';create_learned_motion_job(project,settings,job)
    try:completed=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/worker.py'),'--job',str(job)],capture_output=True,text=True,timeout=240,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired:
        (output/'parent-timeout.json').write_text(json.dumps(dict(state='worker-timeout',source_preserved=True,seconds=240))+'\n');raise ValueError('Owned worker exceeded240s; partial private diagnostics retained')
    (output/'worker-stdout.txt').write_text(completed.stdout,encoding='utf-8');(output/'worker-stderr.txt').write_text(completed.stderr,encoding='utf-8')
    if completed.returncode or read(job/'job.json')['state']!='completed':raise ValueError('Learned worker failed/cancelled; inspect retained private logs')
    result=read(job/'result.json')['learned_result'];preview_path=None
    if not result['unsafe_reasons']:
        # Worker result is independently reproduced before installing a review copy.
        expected=learned_motion.propose(project,settings)
        if expected!=result:raise ValueError('Worker output differs from current pinned model/backend')
        preview=learned_motion._install_fresh(project,expected,'learned-preview',False);preview_path=output/'unapproved.aaa';Session(preview).save(preview_path)
        assert Session.load(preview_path).project==preview
        assert all(d['approved'] is False for identity,d in preview['drawings'].items() if identity not in project['drawings'])
    if digest(source)!=before or settings_file.read_bytes()!=settings_bytes:raise ValueError('Input changed; output is stale diagnostic only')
    summary=dict(status='unapproved-learned-layer-review',source_sha256=before,settings_sha256=hashlib.sha256(settings_bytes).hexdigest(),accepted=False,preview=preview_path.name if preview_path else None,all_generated_unapproved=preview_path is not None,unsafe_reasons=result['unsafe_reasons'],previously_rejected=result['previously_rejected'],model=result['model_metadata'],transport=result['metrics'],source_ids=result['model_metadata']['source_ids'],component_ids=result['model_metadata']['component_ids'],warnings=result['warnings'],backend_evaluations=2 if preview_path else 1,credits_snapshot=credits['snapshot_sha256'],source_unchanged=True)
    atomic_write(output/'report.json',summary);(output/'settings.json').write_bytes(settings_bytes)
    for name in ['CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    atomic_write(output/'provenance/runs/learned-motion.json',dict(summary,execution=dict(target='local',network_allowed=False)));return summary


def main():
    p=argparse.ArgumentParser();p.add_argument('source',nargs='?',type=Path);p.add_argument('settings',nargs='?',type=Path);p.add_argument('output',nargs='?',type=Path);p.add_argument('--credits',action='store_true');a=p.parse_args()
    if a.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not all([a.source,a.settings,a.output]):p.error('Provide project, settings JSON and NEW private output directory')
    print(json.dumps(study(a.source,a.settings,a.output)))
if __name__=='__main__':main()
