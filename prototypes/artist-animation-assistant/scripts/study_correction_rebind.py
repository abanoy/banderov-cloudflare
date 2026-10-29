"""Private unapproved correction-rebind study; does not accept or edit input."""
from pathlib import Path
import argparse,hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda:stream.read(4*1024**2),b''):h.update(data)
    return h.hexdigest()

def study(source,settings,output,detail=None):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    from hosts.standalone.session import Session
    from hosts.standalone.rebind_jobs import RebindJobs,summary
    from engine.jobs import atomic_write
    from engine import correction_rebind as rebind
    credits=build(check=True);verify_ui(ROOT);source,settings,output=map(Path,(source,settings,output))
    if output.exists():raise ValueError('Choose a NEW private output directory')
    if settings.stat().st_size>65536:raise ValueError('Settings exceed64KiB')
    data=settings.read_bytes();config=json.loads(data.decode('utf-8'));before=sha(source);project=Session.load(source).project;rebind.working_copy(project,config);output.mkdir(parents=True);jobs=RebindJobs(output/'jobs')
    def complete():
        try:
            while jobs.busy:jobs.join(.5)
        except BaseException:jobs.shutdown();jobs.join(20);raise
        event=jobs.poll()
        if not event or event['state']!='ready':raise ValueError('Rebind study failed: '+str(event.get('error') if event else 'missing status'))
        return event
    jobs.start('generate',project,settings=config);generated=complete();result=generated['result'];atomic_write(output/'proposal.json',summary(result));jobs.start('preview',project,result=result,detail=detail);compared=complete()
    import shutil
    shutil.copyfile(compared['preview_path'],output/'rebound-unapproved.aaa');shutil.copyfile(compared['raw_preview_path'],output/'raw-unapproved.aaa');Session(project).save(output/'source.aaa');start=config['request'].get('source_slot',project.get('motion_guides',{}).get(config['request'].get('guide_id'),{}).get('source_slot',0));index=config['request']['target_start']-start
    for name,key in [('raw.png','source'),('rebound.png','proposed'),('raw-detail.png','source_detail'),('rebound-detail.png','proposed_detail')]:
        if compared['frames'].get(key):(output/name).write_bytes(compared['frames'][key][index])
    if sha(source)!=before or settings.read_bytes()!=data:raise ValueError('Study input changed; outputs are stale diagnostics')
    report=dict(status='unapproved-rebind-comparison',accepted=False,source_unchanged=True,source_sha256=before,config=config,signature=result['signature'],counts=result['counts'],inference_attempts=generated['inference_attempts']+compared['inference_attempts'],completed_inferences=generated['completed_inferences']+compared['completed_inferences'],credits_snapshot=credits['snapshot_sha256'],warnings=result['warnings']);atomic_write(output/'report.json',report);(output/'settings.json').write_bytes(data)
    for name in ['CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    (output/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Private unapproved rebind</title><h1>Unapproved correction-rebind diagnostic</h1><p>Explicit integer placement only. No artist acceptance or semantic correspondence. Input unchanged.</p><p><a href="source.aaa">Source and retained old correction</a> · <a href="raw-unapproved.aaa">Fresh raw pose</a> · <a href="rebound-unapproved.aaa">Proposed correction placement</a> · <a href="report.json">Evidence</a> · <a href="CREDITS.md">CREDITS</a> · <a href="THIRD_PARTY_NOTICES.txt">Full notices</a></p><img src="raw.png"><img src="rebound.png"><p>Raw / proposed correction placement. Generated artwork remains unapproved.</p><img src="raw-detail.png"><img src="rebound-detail.png">',encoding='utf-8');return report

def main():
    p=argparse.ArgumentParser();p.add_argument('source',nargs='?',type=Path);p.add_argument('settings',nargs='?',type=Path);p.add_argument('output',nargs='?',type=Path);p.add_argument('--detail',nargs=4,type=int);p.add_argument('--credits',action='store_true');args=p.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not all((args.source,args.settings,args.output)):p.error('Provide compact source, explicit rebind JSON and NEW private output directory')
    print(json.dumps(study(args.source,args.settings,args.output,args.detail)))
if __name__=='__main__':main()
