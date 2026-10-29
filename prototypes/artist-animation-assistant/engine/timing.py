"""Original adjacent actor-hold correction; REF-KRITA-TIMELINE/OPENTOONZ-LEVEL-EDIT.

Changes exposure time, never image geometry. Constraints preserve supplied samples,
not inferred contact physics. No metric, image generator or preference model runs.
"""
from copy import deepcopy
import bisect
from engine.project import fingerprint
from engine.motion import _exposure
from engine.schedules import (defaults,subject,_bundle,_exposures,required_samples,
                              apply_timing_candidate,SOURCES)


def _layers_under(project,actor):
    result=set()
    for layer,node in project['layers'].items():
        if node.get('nodetype','paintlayer')!='paintlayer':continue
        parent=layer
        while parent is not None:
            if parent==actor:result.add(layer);break
            parent=project['layers'][parent].get('parent_id')
    return result


def inspect(project,actor):
    settings=dict(defaults(project,actor),budget_count=64)
    scope,context,layers,nodes,exposures,regions,constraints,guides,reviews=subject(project,settings)
    end=project['shot']['duration_frames'];cuts=sorted({0}|{e['start'] for e in exposures})
    if len(cuts)>64:raise ValueError('Narrow the actor: hold editor supports at most64 occurrences')
    if any(_exposure(project,layer,t) is None for layer in layers for t in range(end)):
        raise ValueError('Actor holds must cover the whole shot; repair missing exposures first')
    stops=cuts[1:]+[end]
    segments=[dict(start=t,length=stop-t,source_slot=t,drawings=_bundle(project,layers,t)) for t,stop in zip(cuts,stops)]
    required=required_samples(project,exposures,guides,constraints,0,end)
    events=[];relevant={}
    # Parent and child constraints apply even when the artist chose another level
    # of the layer hierarchy. Layer-local edits must never bypass an actor event.
    for owner,definition in project.get('schedule_constraints',{}).items():
        if not set(layers)&_layers_under(project,owner):continue
        relevant[owner]=definition
        for t in definition['required_slots']:required.setdefault(t,[]).append('required key '+owner)
        for event in definition['events']:
            events.append(dict(event,actor_id=owner))
            for t in range(event['slot'],event['slot']+event['length']):required.setdefault(t,[]).append('event '+event['label'])
    keys=['schedule_constraint:'+owner for owner in project['layers'] if set(layers)&_layers_under(project,owner)]
    dependency=fingerprint(dict(scope=scope,constraints=relevant,epochs={key:project.get('dependency_epochs',{}).get(key,0) for key in keys}))
    def bundle_at(t):return segments[bisect.bisect_right(cuts,t)-1]['drawings']
    samples=[dict(slot=t,reasons=sorted(set(reasons)),drawings=bundle_at(t)) for t,reasons in sorted(required.items())]
    boundaries=[]
    for index in range(1,len(cuts)):
        cut=cuts[index];left,right=segments[index-1:index+1];legal=[];conflicts={}
        for target in range(left['start']+1,right['start']+right['length']):
            bad=[s for s in samples if min(cut,target)<=s['slot']<max(cut,target) and s['drawings']!=(right['drawings'] if target<cut else left['drawings'])]
            if bad:conflicts[str(target)]=[dict(slot=s['slot'],reasons=s['reasons']) for s in bad]
            else:legal.append(target)
        boundaries.append(dict(cut=cut,minimum=left['start']+1,maximum=right['start']+right['length']-1,legal_slots=legal,conflicts=conflicts))
    return dict(actor_id=actor,settings=settings,dependency_sha256=dependency,inputs_sha256=context,layers=layers,segments=segments,required=samples,events=events,boundaries=boundaries,source_ids=SOURCES[:])


def propose(project,actor,cut,new_cut):
    if any(type(v) is not int for v in (cut,new_cut)):raise ValueError('Boundary positions must be integer slots')
    info=inspect(project,actor);matches=[b for b in info['boundaries'] if b['cut']==cut]
    if not matches:raise ValueError('Choose an internal actor boundary; shot endpoints stay fixed')
    boundary=matches[0]
    if cut==new_cut:raise ValueError('Choose a different boundary slot to preview a timing edit')
    if not boundary['minimum']<=new_cut<=boundary['maximum']:raise ValueError('Keep at least one slot in both adjacent holds; other cuts stay fixed')
    if new_cut not in boundary['legal_slots']:
        reasons=boundary['conflicts'][str(new_cut)]
        raise ValueError('Required samples prevent this hold: '+'; '.join('slot '+str(r['slot'])+' '+', '.join(r['reasons']) for r in reasons))
    segments=deepcopy(info['segments']);index=next(i for i,s in enumerate(segments) if s['start']==cut)
    delta=new_cut-cut;segments[index-1]['length']+=delta;segments[index]['start']=new_cut;segments[index]['length']-=delta
    exposures=_exposures(project,info['layers'],segments,0,project['shot']['duration_frames'])
    states={fingerprint({layer:fingerprint(project['drawings'][did]['pixels']) for layer,did in s['drawings'].items()}) for s in segments}
    selected=dict(id='manual_hold',label='Move boundary '+str(cut)+' to '+str(new_cut),segments=segments,exposures=exposures,candidate_sha256=fingerprint(exposures),distinct_actor_states=len(states),exposure_occurrences=len(segments),raster_assets_reused=len({did for s in segments for did in s['drawings'].values()}),new_raster_assets=0,new_poses_computed=0,old_cut=cut,new_cut=new_cut)
    return dict(info,request=dict(actor_id=actor,cut=cut,new_cut=new_cut),candidates=[selected],method='adjacent-actor-boundary',version='0.1.0')


def accept(project,result,identity):
    if result!=propose(project,result['request']['actor_id'],result['request']['cut'],result['request']['new_cut']):raise ValueError('Stale or changed hold preview; preview again after dependent edits')
    return apply_timing_candidate(project,result,result['candidates'][0],identity,'accept-event-aware-hold')
