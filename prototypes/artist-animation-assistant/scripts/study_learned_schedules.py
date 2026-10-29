"""Private learned-pool schedule study; owned hidden inference, never accepts."""
from pathlib import Path
import argparse,hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(4*1024**2),b''):h.update(block)
    return h.hexdigest()
def study(source,settings_file,output,choice='sampled_change'):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    from hosts.standalone.session import Session
    from hosts.standalone.learned_schedule_jobs import LearnedScheduleJobs
    from engine import learned_schedules as pools
    from engine.jobs import atomic_write
    credits=build(check=True);verify_ui(ROOT);source,settings_file,output=map(Path,(source,settings_file,output))
    if output.exists():raise ValueError('Choose a NEW private output directory')
    if settings_file.stat().st_size>65536:raise ValueError('Settings exceed64KiB')
    settings_bytes=settings_file.read_bytes();settings=json.loads(settings_bytes.decode('utf-8'));before=sha(source);project=Session.load(source).project;pools.subject(project,settings);output.mkdir(parents=True)
    jobs=LearnedScheduleJobs(output/'jobs')
    def complete():
        try:
            while jobs.busy:jobs.join(.5)
        except BaseException:jobs.shutdown();jobs.join(20);raise
        event=jobs.poll()
        if not event or event['state']!='ready':raise ValueError('Private learned pool failed: '+str(event.get('error') if event else 'no status'))
        return event
    jobs.start('generate',project,settings=settings);generated=complete();result=generated['result'];atomic_write(output/'result.json',result);preview=None
    if result['schedule']['candidates']:
        jobs.start('preview',project,result=result,choice=choice);preview=complete()
        # Controller stores a strictly reproduced, unapproved editable project.
        import shutil
        shutil.copyfile(preview['preview_path'],output/'unapproved.aaa')
    if sha(source)!=before or settings_file.read_bytes()!=settings_bytes:raise ValueError('Input changed; private output is stale diagnostic only')
    summary=dict(status='unapproved-learned-pool-review',source_unchanged=True,source_sha256=before,accepted=False,counts_per_pass=result['counts'],preview_recomputation_passes=int(preview is not None),backend_evaluations=result['counts']['motion_samples_evaluated']*(1+int(preview is not None)),conflicts=result['schedule']['conflicts'],preview='unapproved.aaa' if preview else None,choice=choice if preview else None,credits_snapshot=credits['snapshot_sha256'],warnings=result['warnings'])
    atomic_write(output/'report.json',summary);(output/'settings.json').write_bytes(settings_bytes)
    for name in ['CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    atomic_write(output/'provenance/runs/learned-pool-study.json',dict(summary,source_ids=result['source_ids'],network_allowed=False));return summary
def main():
    p=argparse.ArgumentParser();p.add_argument('source',nargs='?',type=Path);p.add_argument('settings',nargs='?',type=Path);p.add_argument('output',nargs='?',type=Path);p.add_argument('--choice',default='sampled_change');p.add_argument('--credits',action='store_true');args=p.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not all((args.source,args.settings,args.output)):p.error('Provide compact project, settings JSON and NEW private output directory')
    print(json.dumps(study(args.source,args.settings,args.output,args.choice)))
if __name__=='__main__':main()
