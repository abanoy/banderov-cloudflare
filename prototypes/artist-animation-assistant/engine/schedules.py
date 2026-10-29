"""Independent event-constrained schedule heuristics, EXP0024.

REF-KRITA-TIMELINE / REF-OPENTOONZ-LEVEL-EDIT inform holds/drawing references.
The removal objective/constraint policy is project design, not artistic optimality.
No image generation: existing exact editable layer-content bundles are reused.
"""
from copy import deepcopy
import bisect,math
import numpy as np
from engine.project import validate,fingerprint
from engine.layers import validate_layers
from engine.motion import _actor_layers,_exposure
from engine.packed_render import render

SOURCES=['REF-KRITA-TIMELINE','REF-OPENTOONZ-LEVEL-EDIT','REF-COMPOSITING','REF-NUMPY-2-4-1','REF-NUMPY-BUFFER','REF-PYTHON-COPY']
UNIT='distinct_editable_actor_content_state'
STRATEGIES={'sampled_change':'Low content change','early_poses':'Favor earlier poses','late_poses':'Favor later poses'}

def constraint_owners(project,layers):
    """All hierarchy owners of any consumed paint layer, including absent records."""
    owners=set()
    for layer in layers:
        parent=layer
        while parent is not None:
            owners.add(parent);parent=project['layers'][parent].get('parent_id')
    return owners

def defaults(project,actor):return dict(actor_id=actor,start=0,end=project['shot']['duration_frames'],budget_mode='maximum',budget_count=4,budget_unit=UNIT)
def _text(value):
    if not isinstance(value,str) or not value.strip() or len(value)>80 or any(ord(c)<32 for c in value):raise ValueError('Use a nonempty label/identity of at most80characters')
    return value
def checked_constraints(project,definition):
    if not isinstance(definition,dict) or set(definition)!={'required_slots','events'}:raise ValueError('Expected required slots and events')
    duration=project['shot']['duration_frames'];slots=definition['required_slots'];events=definition['events']
    if not isinstance(slots,list) or len(slots)>64 or any(type(v) is not int or not 0<=v<duration for v in slots) or len(set(slots))!=len(slots):raise ValueError('Use at most64distinct required key slots inside the shot')
    if not isinstance(events,list) or len(events)>32:raise ValueError('At most32required events per actor')
    ids=set()
    for ev in events:
        if not isinstance(ev,dict) or set(ev)!={'id','label','kind','slot','length'}:raise ValueError('Invalid required event')
        _text(ev['id']);_text(ev['label'])
        if ev['id'] in ids:raise ValueError('Required event identities must be distinct')
        ids.add(ev['id'])
        if ev['kind'] not in ('contact','impact','reversal','extension','settle','custom') or any(type(ev[k]) is not int for k in ('slot','length')) or ev['length']<1 or not 0<=ev['slot']<ev['slot']+ev['length']<=duration:raise ValueError('Required event must have a supported type and positive hold inside shot')
    return definition
def validate_metadata(project):
    for field in ('schedule_constraints','schedule_reviews'):
        if not isinstance(project.get(field,{}),dict) or len(project.get(field,{}))>32:raise ValueError('Invalid schedule metadata')
        if any(actor not in project['layers'] for actor in project.get(field,{})):raise ValueError('Schedule actor missing')
    for definition in project.get('schedule_constraints',{}).values():checked_constraints(project,definition)
    for rows in project.get('schedule_reviews',{}).values():
        if not isinstance(rows,list) or len(rows)>128:raise ValueError('Schedule rejection history capacity128; preserve it before new work')
        for row in rows:
            if not isinstance(row,dict) or set(row)!={'inputs','candidate','decision'} or row['decision']!='reject' or any(not isinstance(row[k],str) or len(row[k])!=64 or any(c not in '0123456789abcdef' for c in row[k]) for k in ('inputs','candidate')):raise ValueError('Invalid schedule review record')
    ops=project.get('schedule_operations',[])
    if not isinstance(ops,list) or len(ops)>64:raise ValueError('Schedule operation history capacity64')
    for op in ops:
        if not isinstance(op,dict) or set(op)!={'id','actor_id','request','candidate','inputs','source_ids','old_exposures','region_snapshot','binding_snapshot','region_parents'} or op['actor_id'] not in project['layers']:raise ValueError('Invalid schedule operation record')
        _text(op['id'])
    return project
def save_constraints(project,actor,definition):
    validate(project);checked_constraints(project,definition)
    if actor not in project['layers']:raise ValueError('Select an existing actor')
    updated=deepcopy(project);updated.setdefault('schedule_constraints',{})[actor]=deepcopy(definition)
    return validate_metadata(updated)
def subject(project,settings,candidate_pool=None):
    validate(project);validate_layers(project);validate_metadata(project)
    if set(settings)!=set(defaults(project,'')) or settings['budget_unit']!=UNIT:raise ValueError('Unexpected schedule settings or counting unit')
    if settings['actor_id'] not in project['layers']:raise ValueError('Select an actor/group')
    start,end=settings['start'],settings['end'];duration=project['shot']['duration_frames']
    if any(type(v) is not int for v in (start,end,settings['budget_count'])) or not 0<=start<end<=duration<=600 or not 1<=settings['budget_count']<=64 or settings['budget_mode'] not in ('maximum','target','preference'):raise ValueError('Choose a valid interval, budget1..64 and maximum/target/preference mode')
    if project['schema_version']=='0.1' and (max(project['canvas']['width'],project['canvas']['height'])>256 or len(project['drawings'])>64):raise ValueError('Large scheduling needs the supported packed schema; preserve the older project and use an explicit migration route')
    layers=_actor_layers(project,settings['actor_id']);nodes={}
    for layer in layers:
        i=layer
        while i is not None:
            node=project['layers'][i]
            if node.get('locked') or not node.get('visible',True):raise ValueError('Unlock/show selected actor and ancestors before scheduling')
            nodes[i]=node;i=node.get('parent_id')
    exposures=[e for e in project['exposures'] if e['layer_id'] in layers];drawings={e['drawing_id']:project['drawings'][e['drawing_id']] for e in exposures}
    eligible=candidate_pool or {}
    if not isinstance(eligible,dict) or len(eligible)>512:raise ValueError('Invalid candidate-pool eligibility')
    if any(did not in project['drawings'] or project['drawings'][did].get('origin')!='unreviewed_motion_candidate' or project['drawings'][did].get('approved') is not False or fingerprint(project['drawings'][did])!=sha for did,sha in eligible.items()):raise ValueError('Candidate pool identity or approval changed')
    if any(d.get('approved') is not True and did not in eligible for did,d in drawings.items()):raise ValueError('Review existing pose drawings before scheduling; pending proposals are not current approved assets')
    regions={i:r for i,r in project.get('fill_regions',{}).items() if r['ink_layer'] in layers or r['fill_layer'] in layers}
    for region in regions.values():
        if region['ink_layer'] not in layers or region['fill_layer'] not in layers:raise ValueError('Select the complete ink/fill actor to preserve region timing')
        for layer in (region['ink_layer'],region['fill_layer']):
            exposure=_exposure(project,layer,region['start'])
            if exposure is None or exposure['start']!=region['start'] or exposure['length']!=region['length']:raise ValueError('Region timing needs explicit rebind before scheduling')
    bindings={i:b for i,b in project.get('part_bindings',{}).items() if i in regions};palettes={r['palette_id']:project['palettes'][r['palette_id']] for r in regions.values()}
    guides={i:g for i,g in project.get('motion_guides',{}).items() if g['actor_id'] in nodes}
    constraints=project.get('schedule_constraints',{}).get(settings['actor_id'],dict(required_slots=[],events=[]));reviews=project.get('schedule_reviews',{}).get(settings['actor_id'],[])
    owners=constraint_owners(project,layers);inherited={i:project.get('schedule_constraints',{}).get(i) for i in sorted(owners)}
    data=dict(inherited_constraints=inherited,project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],settings=settings,nodes=nodes,exposures=exposures,drawings=drawings,regions=regions,bindings=bindings,palettes=palettes,guides=guides,constraints=constraints)
    if candidate_pool is not None:data['candidate_pool_eligibility']=eligible
    context=fingerprint(data);keys={'schedule_constraint:'+i for i in owners}|{'layer:'+i for i in nodes}|{'region:'+i for i in regions}|{'palette:'+i for i in palettes}|{'part:'+i for i in bindings}|{'guide:'+i for i in guides}|{'schedule_constraint:'+settings['actor_id'],'schedule_review:'+settings['actor_id']}
    scope=fingerprint(dict(data=data,reviews=reviews,epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in sorted(keys)}))
    return scope,context,layers,nodes,exposures,regions,constraints,guides,reviews
def _bundle(project,layers,slot):return {layer:_exposure(project,layer,slot)['drawing_id'] for layer in layers}
def _exposures(project,layers,segments,start,end):
    result=[]
    for e in project['exposures']:
        stop=e['start']+e['length']
        if e['layer_id'] not in layers:continue
        if stop<=start or e['start']>=end:result.append(deepcopy(e));continue
        if e['start']<start:result.append(dict(e,length=start-e['start']))
        if stop>end:result.append(dict(e,start=end,length=stop-end))
    result.extend(dict(layer_id=layer,drawing_id=did,start=seg['start'],length=seg['length']) for seg in segments for layer,did in seg['drawings'].items())
    return sorted(result,key=lambda e:(e['layer_id'],e['start']))
def required_samples(project,exposures,guides,constraints,start,end):
    mandatory={start:['interval start'],end-1:['interval end']}
    def require(t,reason):
        if start<=t<end:mandatory.setdefault(t,[]).append(reason)
    for e in exposures:
        drawing=project['drawings'][e['drawing_id']]
        if drawing.get('origin') not in ('proposal','reviewed_landmark_motion','reviewed_learned_motion','artist_correction','unreviewed_motion_candidate'):require(e['start'],'artist/source key')
        if drawing.get('origin')!='artist' and (drawing.get('locked') or drawing.get('origin')=='artist_correction'):
            for t in range(max(start,e['start']),min(end,e['start']+e['length'])):require(t,'protected corrected hold')
    for gid,g in guides.items():
        for name in ('source_slot','guide_slot'):
            if g[name] is not None:require(g[name],'guide anchor '+gid)
    for t in constraints['required_slots']:require(t,'required key')
    for ev in constraints['events']:
        for t in range(ev['slot'],ev['slot']+ev['length']):require(t,'event '+ev['label'])
    owners=constraint_owners(project,{e['layer_id'] for e in exposures})
    for owner in sorted(owners):
        definition=project.get('schedule_constraints',{}).get(owner)
        if definition is None or definition is constraints:continue
        for t in definition['required_slots']:require(t,'required key '+owner)
        for ev in definition['events']:
            for t in range(ev['slot'],ev['slot']+ev['length']):require(t,'event '+ev['label'])
    return mandatory

def propose(project,settings,checkpoint=None,*,candidate_pool=None):
    scope,context,layers,nodes,exposures,regions,constraints,guides,reviews=subject(project,settings,candidate_pool);start,end=settings['start'],settings['end'];calls=checkpoint or (lambda:None);calls()
    cuts=sorted({start}|{e['start'] for e in exposures if start<e['start']<end});cuts_end=cuts+[end]
    if len(cuts)>64:raise ValueError('Current schedule prototype supports at most64 source state occurrences per selected interval; narrow interval')
    pool=[];pixel_hashes={did:fingerprint(project['drawings'][did]['pixels']) for did in {e['drawing_id'] for e in exposures}}
    selected_project=dict(project,layers={i:project['layers'][i] for i in nodes},exposures=exposures)
    for i,t in enumerate(cuts):
        calls();bundle=_bundle(project,layers,t);content=fingerprint({layer:pixel_hashes[did] for layer,did in bundle.items()});raw=render(selected_project,t,(64,64))[2];a=np.frombuffer(raw,np.uint8).astype(float).reshape(-1,4)/255.;a[:,:3]*=a[:,3:4]
        pool.append(dict(slot=t,length=cuts_end[i+1]-t,drawings=bundle,content=content));pool[-1]['feature']=a.reshape(-1)
    mandatory=required_samples(project,exposures,guides,constraints,start,end)
    def index(t):return bisect.bisect_right(cuts,t)-1
    protected_ids={pool[index(t)]['content'] for t in mandatory};all_ids={p['content'] for p in pool};requested=settings['budget_count'];mode=settings['budget_mode'];goal=max(len(protected_ids),min(len(all_ids),requested)) if mode=='preference' else min(len(all_ids),requested)
    conflicts=[]
    if requested<len(protected_ids) and mode!='preference':conflicts.append(f'{len(protected_ids)} distinct required actor states exceed the {requested} drawing budget; raise budget or explicitly revise keys/events/protection.')
    if mode=='target' and requested>len(all_ids):conflicts.append(f'Target {requested} requires new poses; only {len(all_ids)} distinct states exist. This scheduler reuses drawings and does not invent extra poses.')
    required=[dict(slot=t,reasons=why,drawings=pool[index(t)]['drawings']) for t,why in sorted(mandatory.items())]
    def schedule(keep):
        retained=[i for i,p in enumerate(pool) if p['content'] in keep];segments=[]
        for n,i in enumerate(retained):
            a=pool[i];stop=pool[retained[n+1]]['slot'] if n+1<len(retained) else end
            segments.append(dict(start=a['slot'],length=stop-a['slot'],source_slot=a['slot'],drawings=deepcopy(a['drawings'])))
        return segments
    def cost(keep,strategy):
        retained=[i for i,p in enumerate(pool) if p['content'] in keep];j=0;total=0.
        for i,p in enumerate(pool):
            while j+1<len(retained) and retained[j+1]<=i:j+=1
            position=(p['slot']-start)/max(1,end-start);weight=2-position if strategy=='early_poses' else 1+position if strategy=='late_poses' else 1
            total+=distances[i,retained[j]]*p['length']*weight
        return float(total/max(1,end-start))
    def sampled_cost(keep):
        retained=[i for i,p in enumerate(pool) if p['content'] in keep];j=0;total=0.
        for i,p in enumerate(pool):
            while j+1<len(retained) and retained[j+1]<=i:j+=1
            total+=float(np.mean((p['feature']-pool[retained[j]]['feature'])**2))*p['length']
        return float(total/max(1,end-start))
    distances=np.zeros((len(pool),len(pool)));plane_cache={};pair_cache={}
    if not conflicts:
        for i in range(len(pool)):
            calls()
            for j in range(i):distances[i,j]=distances[j,i]=layer_content_distance(project,pool[i]['drawings'],pool[j]['drawings'],plane_cache,pair_cache,calls)
    candidates=[]
    if not conflicts:
        for strategy,label in STRATEGIES.items():
            keep=set(all_ids);scored=0
            while len(keep)>goal:
                calls();optional=keep-protected_ids;scored+=len(optional)
                keep.remove(min(optional,key=lambda identity:(cost(keep-{identity},strategy),identity)))
            segments=schedule(keep);proposed_exposures=_exposures(project,layers,segments,start,end);digest=fingerprint(proposed_exposures)
            for anchor in required:
                actual=next(s['drawings'] for s in segments if s['start']<=anchor['slot']<s['start']+s['length'])
                if actual!=anchor['drawings']:raise ValueError('Internal schedule violates a required key or event')
            candidates.append(dict(id=strategy,label=label,segments=segments,exposures=proposed_exposures,candidate_sha256=digest,distinct_actor_states=len(keep),exposure_occurrences=len(segments),raster_assets_reused=len({did for seg in segments for did in seg['drawings'].values()}),new_raster_assets=0,new_poses_computed=0,removal_hypotheses_scored=scored,content_deviation=cost(keep,'sampled_change'),sampled_deviation=sampled_cost(keep),previously_rejected=any(row['inputs']==context and row['candidate']==digest for row in reviews),same_as=[old['id'] for old in candidates if old['candidate_sha256']==digest]))
    warnings=['Budget counts exact editable layer-content bundles: ink/color together, repeated states once. Not a perceptual or anatomical pose count.','Greedy removal uses all premultiplied per-layer RGBA samples via exact tile differences, including small details. It is not flattened compositing, perceptual importance, anatomy, optimality or artist preference;64square deviation is diagnostic only.','Events preserve current actor samples at their declared slots; no physical contact or action is inferred.','Drawings remain stored when unexposed; prior motion/part revision intervals may need explicit rebind after timing changes.']
    if mode=='preference' and requested!=goal:warnings.append(f'Preferred {requested} states, proposed {goal} to honor required content and available poses.')
    return dict(settings=deepcopy(settings),dependency_sha256=scope,inputs_sha256=context,layers=layers,source_pool=[{k:v for k,v in row.items() if k!='feature'} for row in pool],required=required,constraints=deepcopy(constraints),candidates=candidates,conflicts=conflicts,budget_unit=UNIT,distinct_source_states=len(all_ids),required_distinct_states=len(protected_ids),source_occurrences=len(pool),schedule_hypotheses_generated=len(candidates),new_image_poses_computed=0,duration_frames=project['shot']['duration_frames'],fps=deepcopy(project['shot']['fps']),method='event-preserving-greedy-tiled-layer-content-removal',version='0.2.0',source_ids=SOURCES[:],warnings=warnings)
def candidate(result,identity):
    matches=[c for c in result['candidates'] if c['id']==identity]
    if len(matches)!=1:raise ValueError('Select an available schedule candidate')
    return matches[0]
def preview(project,result,identity):return dict(project,exposures=[deepcopy(e) for e in project['exposures'] if e['layer_id'] not in result['layers']]+deepcopy(candidate(result,identity)['exposures']))
def reject(project,result,identity):
    if result!=propose(project,result['settings']):raise ValueError('Stale or changed schedule')
    c=candidate(result,identity);q=deepcopy(project);rows=q.setdefault('schedule_reviews',{}).setdefault(result['settings']['actor_id'],[]);record=dict(inputs=result['inputs_sha256'],candidate=c['candidate_sha256'],decision='reject')
    if record not in rows:rows.append(record)
    return validate_metadata(q)
def accept(project,result,choice,identity):
    if result!=propose(project,result['settings']):raise ValueError('Stale or changed schedule result')
    selected=candidate(result,choice)
    if selected['previously_rejected']:raise ValueError('This exact schedule was rejected; change evidence or budget before accepting')
    _text(identity)
    if any(op['id']==identity for op in project.get('schedule_operations',[])):raise ValueError('Schedule operation identity reused')
    return apply_timing_candidate(project,result,selected,identity)


def apply_timing_candidate(project,result,selected,identity,action='accept-event-preserving-schedule'):
    """Internal installer; callers must validate/recompute their immutable candidate."""
    _text(identity)
    if any(op['id']==identity for op in project.get('schedule_operations',[])):raise ValueError('Schedule operation identity reused')
    q=deepcopy(project);layers=result['layers'];start,end=result['settings']['start'],result['settings']['end'];q['exposures']=[deepcopy(e) for e in project['exposures'] if e['layer_id'] not in layers]+deepcopy(selected['exposures']);regions={i:r for i,r in project.get('fill_regions',{}).items() if r['ink_layer'] in layers or r['fill_layer'] in layers};bindings={i:b for i,b in project.get('part_bindings',{}).items() if i in regions};parents={};used=set()
    for rid in regions:q['fill_regions'].pop(rid);q.get('part_bindings',{}).pop(rid,None)
    def install(parent,region,a,b,drawings=None):
        rid=parent if parent not in used else identity+'-region-'+str(len(parents));used.add(parent)
        if rid in q.get('fill_regions',{}):raise ValueError('Schedule region identity reused')
        value=deepcopy(region);value.update(start=a,length=b-a)
        if drawings:value.update(ink_drawing=drawings[region['ink_layer']],fill_drawing=drawings[region['fill_layer']])
        if value!=region:value.update(timing_parent_region=parent,timing_operation_id=identity,version=region.get('version',0)+1)
        q.setdefault('fill_regions',{})[rid]=value;parents[rid]=parent
        if parent in bindings:q.setdefault('part_bindings',{})[rid]=deepcopy(bindings[parent])
    for rid,region in regions.items():
        a=region['start'];b=a+region['length']
        if b<=start or a>=end:install(rid,region,a,b)
        elif a<start:install(rid,region,a,start)
    for seg in selected['segments']:
        for rid,region in regions.items():
            if region['start']<=seg['source_slot']<region['start']+region['length']:install(rid,region,seg['start'],seg['start']+seg['length'],seg['drawings'])
    for rid,region in regions.items():
        b=region['start']+region['length']
        if region['start']<end<b:install(rid,region,end,b)
    q.setdefault('schedule_operations',[]).append(dict(id=identity,actor_id=result['settings']['actor_id'],request=deepcopy(result['settings']),candidate=deepcopy(selected),inputs=result['inputs_sha256'],source_ids=SOURCES[:],old_exposures=deepcopy([e for e in project['exposures'] if e['layer_id'] in layers]),region_snapshot=deepcopy(regions),binding_snapshot=deepcopy(bindings),region_parents=parents))
    from engine.regions import refresh_relations
    from engine.roi_assistance import validate_regions
    refresh_relations(q);validate_regions(q)
    q['revision']+=1;q['history'].append(dict(action=action,operation_id=identity));validate(q);validate_layers(q);validate_metadata(q)
    return q


def check_manual_timing_edit(before,after,changed_layer):
    """A hold edit cannot silently change samples at an explicit saved event/key.

    This protects declared timing evidence, not inferred foot-contact physics.
    Artist painting/color corrections remain separate operations.
    """
    for actor,definition in before.get('schedule_constraints',{}).items():
        layers=[]
        for identity,node in before['layers'].items():
            if node.get('nodetype','paintlayer')!='paintlayer':continue
            parent=identity
            while parent is not None and parent!=actor:parent=before['layers'][parent].get('parent_id')
            if parent==actor:layers.append(identity)
        if changed_layer not in layers:continue
        slots=set(definition['required_slots'])
        for ev in definition['events']:slots.update(range(ev['slot'],ev['slot']+ev['length']))
        if any(_bundle(before,layers,t)!=_bundle(after,layers,t) for t in slots):raise ValueError('Hold would change a required event/key pose. Revise the saved timing constraint explicitly or choose a different hold.')
    return after


def layer_content_distance(project,left,right,planes,cache,checkpoint):
    from engine.io.project_archive import PixelPlane,TILE
    width,height=project['canvas']['width'],project['canvas']['height'];columns=(width+TILE-1)//TILE;total=0
    for layer in left:
        a,b=left[layer],right[layer]
        for did in (a,b):
            if did not in planes:
                raw=project['drawings'][did]['pixels'];planes[did]=raw if isinstance(raw,PixelPlane) else PixelPlane.from_pixels(width,height,raw)
        pa,pb=planes[a],planes[b]
        if pa==pb:continue
        key=tuple(sorted((pa.identity,pb.identity)))
        if key not in cache:
            difference=0
            for index,(ka,kb) in enumerate(zip(pa.keys,pb.keys)):
                if ka==kb:continue
                checkpoint();x=(index%columns)*TILE;y=(index//columns)*TILE;box=[x,y,min(width,x+TILE),min(height,y+TILE)]
                aa=np.frombuffer(pa.region_bytes(box),np.uint8).astype(np.int64).reshape(-1,4);bb=np.frombuffer(pb.region_bytes(box),np.uint8).astype(np.int64).reshape(-1,4)
                # Exact integer premultiplication before squared difference;
                # transparent hidden RGB remains stored but does not affect loss.
                aa[:,:3]*=aa[:,3:4];bb[:,:3]*=bb[:,3:4];aa[:,3]*=255;bb[:,3]*=255
                delta=aa-bb;difference+=int(np.sum(delta*delta,dtype=np.int64))
            cache[key]=difference
        total+=cache[key]
    return float(total/(max(1,len(left))*width*height*4*255**4))
