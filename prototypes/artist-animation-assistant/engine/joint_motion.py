"""Independent joint unapproved MLS pose-pool and event-preserving schedule search.

No dense artist approval. Candidate eligibility is explicit identity, never an
approval flag. Final review approves only generated assets actually exposed.
"""
from copy import deepcopy
import json
from engine import motion,schedules
from engine.project import fingerprint,validate
from engine.layers import validate_layers
from engine.packed_model import check_budget

SOURCES=sorted(set(motion.SOURCES+schedules.SOURCES+motion.trajectories.SOURCES))


def subject(project,settings):
    if not isinstance(settings,dict) or set(settings)!={'schedule','motion_samples'}:raise ValueError('Expected schedule and motion_samples')
    config=settings['schedule'];samples=settings['motion_samples']
    if not isinstance(samples,list) or not 1<=len(samples)<=16:raise ValueError('Choose1..16motion samples')
    scope,context,layers,nodes,exposures,regions,constraints,guides,reviews=schedules.subject(project,config)
    mandatory=schedules.required_samples(project,exposures,guides,constraints,config['start'],config['end'])
    spans=[];scopes=[]
    for request in samples:
        value,guide,entries,_,previous,_=motion.subject(project,request)
        if previous is not None or guide['actor_id']!=config['actor_id'] or set(entries)!=set(layers):raise ValueError('Pool samples must be new poses for the complete selected actor')
        a,b=request['target_start'],request['target_end']
        if not config['start']<=a<b<=config['end'] or any(max(a,x)<min(b,y) for x,y in spans):raise ValueError('Pool sample holds must be disjoint and inside selected schedule')
        if any(a<=slot<b for slot in mandatory):raise ValueError('A generated pool sample would overwrite a required source key, event or protected hold')
        spans.append((a,b));scopes.append(value)
    return fingerprint(dict(schedule=scope,motion=scopes,settings=settings))


def _budget(project):
    validate(project);validate_layers(project)
    if len(project['drawings'])>(512 if project['schema_version']=='0.2' else 64):raise ValueError('Joint pool exceeds drawing capacity; narrow samples')
    if project['schema_version']=='0.2':check_budget(project)
    elif len(json.dumps(project,indent=2,ensure_ascii=False,allow_nan=False).encode('utf-8'))>32*1024**2:raise ValueError('Joint pool exceeds legacy32MiB capacity')


def _build(project,settings,checkpoint=None):
    scope=subject(project,settings);stable=fingerprint(dict(context=schedules.subject(project,settings['schedule'])[1],samples=settings['motion_samples']));calls=checkpoint or (lambda:None);pool=deepcopy(project);owned=[];operations=[];sources=set(SOURCES)
    # Right-to-left insertion leaves each earlier original source hold available.
    # Every generated source remains an original approved anchor, never a candidate.
    for index in sorted(range(len(settings['motion_samples'])),key=lambda n:settings['motion_samples'][n]['target_start'],reverse=True):
        calls();request=settings['motion_samples'][index];identity='joint-pool-'+stable[:24]+'-'+str(index)
        if any(o['operation_id']==identity for o in pool.get('motion_operations',[])):raise ValueError('Pool already installed; create a new request/review')
        before=set(pool['drawings']);pool=motion.stage(pool,request,identity,calls);owned.extend(sorted(set(pool['drawings'])-before));operations.append(identity);sources.update(pool['motion_operations'][-1]['source_ids']);_budget(pool)
    eligibility={did:fingerprint(pool['drawings'][did]) for did in owned}
    schedule=schedules.propose(pool,settings['schedule'],calls,candidate_pool=eligibility)
    return scope,pool,owned,operations,schedule,sorted(sources)


def _result(settings,built):
    scope,pool,owned,operations,schedule,sources=built
    return dict(settings=deepcopy(settings),dependency_sha256=scope,schedule=schedule,generated_assets={did:fingerprint(pool['drawings'][did]) for did in owned},candidate_operations=operations,counts=dict(motion_samples_evaluated=len(settings['motion_samples']),new_raster_assets_computed=len(owned),available_actor_states=schedule['distinct_source_states'],schedule_hypotheses=len(schedule['candidates'])),source_ids=sources,method='joint-unapproved-motion-pool-event-schedule',version='0.1.0',warnings=schedule['warnings']+['Candidate eligibility does not approve a drawing. Preview keeps every generated drawing unapproved; joint acceptance approves only exposed generated assets.','Counts are per generation/search pass; preview/acceptance deterministically recompute and incur additional work. No internal computation saving is implied by a sparse selected result.','Inputs are explicit MLS/trajectory hypotheses. Point contacts are progress-space geometry; temporal contacts require saved shot event samples. No new anatomy/surface or artistic timing preference is inferred.'])


def propose(project,settings,checkpoint=None):return _result(settings,_build(project,settings,checkpoint))


def _verified(project,result,choice,checkpoint=None):
    if subject(project,result['settings'])!=result['dependency_sha256']:raise ValueError('Stale joint motion/schedule inputs')
    built=_build(project,result['settings'],checkpoint)
    if _result(result['settings'],built)!=result:raise ValueError('Joint result differs from deterministic candidate generation/search')
    selected=schedules.candidate(built[4],choice)
    return built,selected


def preview(project,result,choice,checkpoint=None):
    built,selected=_verified(project,result,choice,checkpoint);pool=built[1]
    # Full region metadata follows the selected timing in the preview too.
    q=schedules.apply_timing_candidate(pool,built[4],selected,'joint-preview-'+result['dependency_sha256'][:24],action='preview-unapproved-joint-schedule')
    _budget(q);return q


def accept(project,result,choice,identity,checkpoint=None):
    built,selected=_verified(project,result,choice,checkpoint)
    if selected['previously_rejected']:raise ValueError('This joint schedule was rejected; change evidence or settings before accepting')
    q=schedules.apply_timing_candidate(built[1],built[4],selected,identity,action='accept-joint-motion-schedule')
    exposed={e['drawing_id'] for e in selected['exposures']};reviewed=set(built[2])&exposed
    for did in reviewed:q['drawings'][did].update(approved=True,origin='reviewed_landmark_motion')
    for region in q.get('fill_regions',{}).values():
        if region.get('ink_drawing') in reviewed or region.get('fill_drawing') in reviewed:
            region['geometry_status']='transported_motion_joint_reviewed'
            region['warnings']=[warning.replace('transported by unapproved candidate','transported by jointly reviewed motion') for warning in region.get('warnings',[])]
    for operation in q.get('motion_operations',[]):
        if operation['operation_id'] in built[3]:operation['review_state']='selected_in_joint_review' if any(did in reviewed for did in operation['output_drawings'].values()) else 'unselected_candidate'
    q['history'].append(dict(action='joint-review-counts',operation_id=identity,computed_motion_samples=result['counts']['motion_samples_evaluated'],computed_raster_assets=len(built[2]),selected_generated_raster_assets=len(reviewed),selected_actor_states=selected['distinct_actor_states']))
    _budget(q);return q


def reject(project,result,choice,checkpoint=None):
    built,selected=_verified(project,result,choice,checkpoint);q=deepcopy(project);rows=q.setdefault('schedule_reviews',{}).setdefault(result['settings']['schedule']['actor_id'],[])
    record=dict(inputs=built[4]['inputs_sha256'],candidate=selected['candidate_sha256'],decision='reject')
    if record not in rows:rows.append(record)
    schedules.validate_metadata(q);return q
