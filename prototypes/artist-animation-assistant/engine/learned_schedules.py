"""Budget-aware unapproved learned pose pool; exact existing schedule constraints."""
from copy import deepcopy
from engine import learned_motion as learned,schedules
from engine.project import fingerprint
from engine.joint_motion import _budget


def subject(project,settings):
    if not isinstance(settings,dict) or set(settings)!={'schedule','learned_samples'}:raise ValueError('Expected schedule and learned_samples')
    config=settings['schedule'];requests=settings['learned_samples']
    if not isinstance(requests,list) or not 1<=len(requests)<=16:raise ValueError('Choose1..16learned candidate samples')
    scope,context,layers,nodes,exposures,regions,constraints,guides,reviews=schedules.subject(project,config)
    mandatory=schedules.required_samples(project,exposures,guides,constraints,config['start'],config['end']);spans=[];inputs=[]
    for request in requests:
        value,ordered,_,_=learned.subject(project,request)
        if request['actor_id']!=config['actor_id'] or set(ordered)!=set(layers):raise ValueError('Learned pool requires the complete selected actor')
        a,b=request['target_start'],request['target_end']
        if not config['start']<=a<b<=config['end'] or any(max(a,x)<min(b,y) for x,y in spans):raise ValueError('Candidate holds must be disjoint and inside schedule')
        if any(a<=slot<b for slot in mandatory):raise ValueError('Candidate would overwrite a mandatory source key/event/protected hold')
        spans.append((a,b));inputs.append(value)
    return fingerprint(dict(schedule=scope,learned=inputs,settings=settings))


def preflight(project,settings):
    scope=subject(project,settings);config=settings['schedule'];_,context,layers,_,exposures,_,constraints,guides,_=schedules.subject(project,config)
    required=schedules.required_samples(project,exposures,guides,constraints,config['start'],config['end']);cache={}
    def content(slot):
        bundle=schedules._bundle(project,layers,slot)
        for did in bundle.values():
            if did not in cache:cache[did]=fingerprint(project['drawings'][did]['pixels'])
        return fingerprint({lid:cache[did] for lid,did in bundle.items()})
    minimum=len({content(slot) for slot in required})
    from engine.candidate_corrections import active
    capacity=config['budget_count']>minimum or any(active(project,'learned',r) is not None for r in settings['learned_samples'])
    return dict(dependency_sha256=scope,required_distinct_states=minimum,inference_needed=capacity,requested_samples=len(settings['learned_samples']),budget_leaves_no_optional_state=not capacity)


def _build(project,settings,checkpoint=None,runner=None):
    checkpoint=checkpoint or (lambda:None);plan=preflight(project,settings);checkpoint();pool=deepcopy(project);owned=[];operations=[];models=[];sources=set(schedules.SOURCES);requests=settings['learned_samples'];stable=fingerprint(dict(context=schedules.subject(project,settings['schedule'])[1],samples=requests))
    if plan['inference_needed']:
        for index in sorted(range(len(requests)),key=lambda i:requests[i]['target_start'],reverse=True):
            checkpoint();request=requests[index];result=(runner or learned.propose)(project,request,checkpoint)
            if result['settings']!=request or result['dependency_sha256']!=learned.subject(project,request)[0]:raise ValueError('Learned sample scope/settings differ from requested source')
            if result['previously_rejected']:raise ValueError('A learned sample was rejected; correct its inputs/settings before adding to a pool')
            identity='learned-pool-'+stable[:24]+'-'+str(index)
            # Each result is freshly computed against ORIGINAL approved anchors.
            # Install singly to validate it, then splice only this disjoint interval.
            single=learned._install_fresh(project,result,identity,False);operation=single['learned_motion_operations'][-1];new=operation['drawings']
            if identity in {row['id'] for row in pool.get('learned_motion_operations',[])}:raise ValueError('Learned pool already installed')
            for did in new.values():
                if did in pool['drawings']:raise ValueError('Learned pool drawing identity collision')
                pool['drawings'][did]=single['drawings'][did];owned.append(did)
            a,b=request['target_start'],request['target_end'];rows=[];found=set()
            for e in pool['exposures']:
                lid=e['layer_id']
                if lid not in new or not e['start']<=a<b<=e['start']+e['length']:rows.append(e);continue
                original=schedules._bundle(project,[lid],request['source_slot'])[lid]
                if e['drawing_id']!=original:raise ValueError('Pool insertion no longer points to original approved source hold')
                if e['start']<a:rows.append(dict(e,length=a-e['start']))
                rows.append(dict(layer_id=lid,drawing_id=new[lid],start=a,length=b-a))
                if b<e['start']+e['length']:rows.append(dict(e,start=b,length=e['start']+e['length']-b))
                found.add(lid)
            if found!=set(new):raise ValueError('Learned pool insertion does not fit every actor layer')
            pool['exposures']=rows;pool.setdefault('learned_motion_operations',[]).append(deepcopy(operation));operations.append(identity);models.append(result['model_metadata']);sources.update(result['model_metadata']['source_ids']);learned.validate_metadata(pool);_budget(pool)
    eligible={did:fingerprint(pool['drawings'][did]) for did in owned};schedule=schedules.propose(pool,settings['schedule'],checkpoint,candidate_pool=eligible)
    result=dict(settings=deepcopy(settings),dependency_sha256=plan['dependency_sha256'],schedule=schedule,generated_assets=eligible,candidate_operations=operations,sample_models=models,counts=dict(requested_samples=len(requests),motion_samples_evaluated=len(models),new_raster_assets_computed=len(owned),available_actor_states=schedule['distinct_source_states'],schedule_hypotheses=len(schedule['candidates']),skipped_no_budget_capacity=len(requests) if not plan['inference_needed'] else 0),source_ids=sorted(sources),method='budget-aware-unapproved-learned-pool-event-schedule',version='0.1.0',warnings=schedule['warnings']+['All previews stay unapproved; acceptance approves only exposed generated assets.','Required original states can exhaust the budget. In that case no model is loaded or evaluated.','Each generation/preview/review recomputes the pool. Counts report per pass; selected drawing budgets do not imply lower internal compute.','Learned appearance fields can blur contours/miss expression; no semantic contact/new-surface/artist-preference proof.'])
    return result,pool


def propose(project,settings,checkpoint=None):return _build(project,settings,checkpoint)[0]


def _prepare(project,result,choice,identity,operation,checkpoint=None,runner=None,reason='Rejected learned timing'):
    if operation not in ('preview','accept','reject'):raise ValueError('Unknown learned pool review')
    if subject(project,result['settings'])!=result['dependency_sha256']:raise ValueError('Stale learned pool inputs')
    expected,pool=_build(project,result['settings'],checkpoint,runner)
    if expected!=result:raise ValueError('Learned pool differs from regenerated source/model/search')
    chosen=schedules.candidate(expected['schedule'],choice)
    if operation=='reject':
        if not isinstance(reason,str) or not reason.strip() or len(reason)>240:raise ValueError('Record a1..240character learned schedule rejection reason')
        q=deepcopy(project);rows=q.setdefault('schedule_reviews',{}).setdefault(result['settings']['schedule']['actor_id'],[]);row=dict(inputs=expected['schedule']['inputs_sha256'],candidate=chosen['candidate_sha256'],decision='reject')
        if row not in rows:rows.append(row)
        q['history'].append(dict(action='reject-learned-pool-reason',reason=reason,candidate=chosen['candidate_sha256']));schedules.validate_metadata(q);_budget(q);return q,expected
    if operation=='accept' and chosen['previously_rejected']:raise ValueError('This learned schedule was rejected; change evidence/settings')
    q=schedules.apply_timing_candidate(pool,expected['schedule'],chosen,identity,action='preview-learned-pool' if operation=='preview' else 'accept-learned-pool')
    reviewed=set(expected['generated_assets'])&{e['drawing_id'] for e in chosen['exposures']} if operation=='accept' else set()
    for did in reviewed:q['drawings'][did].update(approved=True,origin='reviewed_learned_motion')
    for row in q.get('learned_motion_operations',[]):
        if row['id'] in expected['candidate_operations']:row['approved']=bool(row['drawings']) and set(row['drawings'].values())<=reviewed
    q['history'].append(dict(action='learned-pool-counts',operation_id=identity,computed_motion_samples=expected['counts']['motion_samples_evaluated'],computed_raster_assets=len(expected['generated_assets']),selected_generated_raster_assets=len(reviewed),selected_actor_states=chosen['distinct_actor_states'],preview=operation=='preview'))
    learned.validate_metadata(q);_budget(q);return q,expected


def preview(project,result,choice,checkpoint=None):return _prepare(project,result,choice,'learned-preview-'+result['dependency_sha256'][:24],'preview',checkpoint)[0]
def accept(project,result,choice,identity,checkpoint=None):return _prepare(project,result,choice,identity,'accept',checkpoint)[0]
def reject(project,result,choice,checkpoint=None):return _prepare(project,result,choice,'reject','reject',checkpoint)[0]
