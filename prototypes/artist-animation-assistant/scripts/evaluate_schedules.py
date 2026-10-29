"""Original event/budget/hold comparisons; no asserted aesthetic ground truth."""
from pathlib import Path
from copy import deepcopy
import argparse,json,hashlib,shutil,sys,time
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from engine.schedules import defaults,propose,accept,save_constraints
from engine.project import fingerprint
from engine.packed_render import render,png_bytes
from hosts.standalone.session import Session
from hosts.standalone.schedule_fixtures import fixture
from scripts.credits import build
from scripts.provenance_gate import verify_ui

def run(output):
    verify_ui(ROOT);credits=build(check=True);output.mkdir(parents=True,exist_ok=False);base=fixture();rows=[]
    cases=[('maximum-four',base,'maximum',4),('maximum-six',base,'maximum',6),('exact-target-five',base,'target',5),('soft-preference-one',base,'preference',1),('infeasible-maximum-one',base,'maximum',1),('unavailable-target-thirty',base,'target',30)]
    corrected=Session(base);corrected.layer_id='paint';corrected.slot=4;corrected.correct({40*128+50:[90,40,120,0]});cases.append(('protected-corrected-hold',corrected.project,'maximum',4))
    contact=save_constraints(base,'actor',dict(required_slots=[8],events=[dict(id='touch',label='Supplied contact samples',kind='contact',slot=12,length=4),dict(id='settle',label='Settling key',kind='settle',slot=20,length=2)]));cases.append(('keys-and-two-events',contact,'maximum',5))
    for name,p,mode,budget in cases:
        folder=output/name;folder.mkdir();before=fingerprint(p);settings=dict(defaults(p,'actor'),budget_mode=mode,budget_count=budget);started=time.monotonic();result=propose(p,settings);items=[];Session(p).save(folder/'input.aaa');(folder/'proposal.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        for candidate in result['candidates']:
            identity=candidate['id'];q=accept(p,result,identity,'evaluation-'+identity);dst=folder/identity;dst.mkdir();Session(q).save(dst/'editable.aaa')
            # Exact temporal sample invariants, not the64pixel ranking thumbnail.
            preserved=all(render(q,anchor['slot'],(128,160))[2]==render(p,anchor['slot'],(128,160))[2] for anchor in result['required']);different=sum(render(q,t,(128,160))[2]!=render(p,t,(128,160))[2] for t in range(24))
            assert preserved and q['originals']==p['originals'] and q['drawings']==p['drawings'] and q['shot']==p['shot'] and fingerprint(p)==before
            if mode=='maximum':assert candidate['distinct_actor_states']<=budget
            if mode=='target':assert candidate['distinct_actor_states']==budget
            for t in (0,4,8,12,16,20,23):
                w,h,raw=render(q,t,(128,160));(dst/('slot-'+str(t)+'.png')).write_bytes(png_bytes(w,h,raw))
            items.append(dict(strategy=identity,states=candidate['distinct_actor_states'],holds=candidate['exposure_occurrences'],assets_reused=candidate['raster_assets_reused'],new_assets=candidate['new_raster_assets'],new_image_poses=candidate['new_poses_computed'],removal_hypotheses_scored=candidate['removal_hypotheses_scored'],content_deviation=candidate['content_deviation'],sampled_deviation=candidate['sampled_deviation'],changed_playback_slots=different,required_samples_exact=preserved,unique_timing=candidate['candidate_sha256'],same_as=candidate['same_as']))
        row=dict(name=name,mode=mode,budget=budget,source_distinct_states=result['distinct_source_states'],source_occurrences=result['source_occurrences'],required_states=result['required_distinct_states'],conflicts=result['conflicts'],candidates=items,seconds=time.monotonic()-started,input_unchanged=fingerprint(p)==before);rows.append(row);print(json.dumps(dict(name=name,states=[x['states'] for x in items],distinct_schedules=len({x['unique_timing'] for x in items}),conflicts=result['conflicts'])),flush=True)
    for name in ('credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt'):shutil.copyfile(ROOT/'generated'/name,output/name)
    report=dict(status='completed',cases=len(rows),accepted_comparisons=sum(len(x['candidates']) for x in rows),rows=rows,credits_snapshot_sha256=credits['snapshot_sha256'],source_sha256={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['engine/schedules.py','hosts/standalone/schedule_fixtures.py','scripts/evaluate_schedules.py']},scope='Eight original authored timing/constraint diagnostics; fixed existing actor-state pool.Exact per-layer tile difference drives ranking;64square projection change is only a diagnostic. Both are engineering proxies, not intended action, artistic readability, optimality, generalization or measured artist correction benefit. No generated new poses, neural inference or real artist footage.')
    (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');return report
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',nargs='?',type=Path);parser.add_argument('--credits',action='store_true');args=parser.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'))
    elif args.output:run(args.output.resolve())
    else:parser.error('Provide a NEW output directory or --credits')
