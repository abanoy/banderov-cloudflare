"""Optional two-key learned motion proposal/review, EXP0035. No automatic approval."""
from copy import deepcopy
import math
import numpy as np
from engine.project import validate,fingerprint
from engine import motion,schedules
from engine.layers import validate_layers
from engine.spatial_constraints import drawing_mask,ENCODING,count
from engine.packed_model import check_budget


def defaults(project,actor,source_slot,guide_slot,target_start,target_end):
    w,h=project['canvas']['width'],project['canvas']['height'];scale=min(1,960/w,640/h)
    return dict(actor_id=actor,source_slot=source_slot,guide_slot=guide_slot,target_start=target_start,target_end=target_end,progress=.5,working_size=[max(32,round(w*scale)),max(32,round(h*scale))],matte=[0,0,0])


def validate_metadata(project):
    import re
    operations=project.get('learned_motion_operations',[]);reviews=project.get('learned_motion_reviews',[])
    if not isinstance(operations,list) or len(operations)>64 or not isinstance(reviews,list) or len(reviews)>128:raise ValueError('Invalid bounded learned motion history')
    digest=lambda value:isinstance(value,str) and re.fullmatch('[a-f0-9]{64}',value) is not None
    identities=set()
    for row in operations:
        if not isinstance(row,dict) or set(row)!={'id','settings','inputs','signature','model','drawings','approved','metrics'} or type(row['approved']) is not bool or not digest(row['inputs']) or not digest(row['signature']):raise ValueError('Malformed learned motion operation')
        if not isinstance(row['id'],str) or not re.fullmatch('[a-zA-Z0-9_-]{1,64}',row['id']) or row['id'] in identities:raise ValueError('Invalid/duplicate learned operation identity')
        identities.add(row['id'])
        if not isinstance(row['settings'],dict) or not isinstance(row['model'],dict) or not isinstance(row['metrics'],dict) or not isinstance(row['drawings'],dict) or not 1<=len(row['drawings'])<=32 or any(not isinstance(v,str) or not v or len(v)>80 for pair in row['drawings'].items() for v in pair):raise ValueError('Invalid learned operation metadata')
    for row in reviews:
        if not isinstance(row,dict) or set(row)!={'signature','inputs','reason'} or not digest(row['signature']) or not digest(row['inputs']) or not isinstance(row['reason'],str) or not row['reason'].strip() or len(row['reason'])>240:raise ValueError('Malformed learned rejection history')
    return project


def _base_subject(project,settings):
    validate(project);validate_layers(project);validate_metadata(project)
    if project['schema_version']!='0.2':raise ValueError('Learned motion uses an explicitly selected compact0.2project; no silent legacy migration')
    if set(settings)!=set(defaults(project,settings.get('actor_id'),0,1,0,1)):raise ValueError('Unexpected learned motion settings')
    s,g,a,b=[settings[k] for k in ['source_slot','guide_slot','target_start','target_end']];duration=project['shot']['duration_frames']
    if any(type(v) is not int for v in [s,g,a,b]) or not 0<=s<a<b<=g<duration:raise ValueError('Insert inside a source hold before the approved end key')
    t=settings['progress'];size=settings['working_size'];matte=settings['matte']
    if type(t) not in (int,float) or not math.isfinite(t) or not 0<t<1:raise ValueError('Choose an interior content phase; exposure timing is declared separately')
    if not isinstance(size,list) or len(size)!=2 or any(type(v) is not int or not 32<=v<=1024 for v in size) or size[0]*size[1]>1024*768:raise ValueError('Explicit model working size32..1024, area<=786432required')
    if not isinstance(matte,list) or len(matte)!=3 or any(type(v) is not int or not 0<=v<=255 for v in matte):raise ValueError('Explicit RGB matte0..255required')
    config=dict(schedules.defaults(project,settings['actor_id']),start=s,end=g+1)
    scope,context,layers,nodes,exposures,regions,constraints,guides,reviews=schedules.subject(project,config)
    mandatory=schedules.required_samples(project,exposures,guides,constraints,s,g+1)
    if any(a<=slot<b for slot in mandatory):raise ValueError('Learned sample would overwrite a source key, required event or protected hold')
    if regions:raise ValueError('Linked managed regions need explicit two-key region binding before learned motion; no metadata is discarded')
    for node in nodes.values():
        if node.get('nodetype')=='grouplayer' and float(node.get('opacity',255))!=255:raise ValueError('Partial-opacity isolated groups need a hierarchical learned compositor; preserve them before this route')
    entries={}
    for layer in layers:
        e0=motion._exposure(project,layer,s);e1=motion._exposure(project,layer,g)
        if e0 is None or e1 is None or not e0['start']<a<b<=e0['start']+e0['length']:raise ValueError('Both approved keys and a common source hold are required')
        entries[layer]=dict(source=e0,guide=e1)
    ranks={lid:i for i,lid in enumerate(project['layers'])};ordered=[]
    def visit(lid):
        if lid not in nodes:return
        node=nodes[lid]
        if node.get('nodetype','paintlayer')=='paintlayer':ordered.append(lid);return
        children=[i for i,n in nodes.items() if n.get('parent_id')==lid]
        for i in sorted(children,key=lambda k:(nodes[k].get('order',0),ranks[k])):visit(i)
    visit(settings['actor_id'])
    if set(ordered)!=set(layers):raise ValueError('Actor hierarchy does not match selected paint layers')
    return fingerprint(dict(schedule=scope,settings=settings,version='layered-rife-1')),ordered,nodes,entries


def subject(project,settings):
    values=_base_subject(project,settings)
    from engine.candidate_corrections import scope
    return (scope(project,'learned',settings,values[0]),)+values[1:]


def _propose(project,settings,checkpoint=None,runner=None,*,blend_policy=None):
    from engine.blend_policies import validate_policy
    validate_policy(blend_policy)
    from engine.rife_fields import infer
    from engine.field_transport import transport
    from engine.packed_render import render
    checkpoint=checkpoint or (lambda:None);scope,layers,nodes,entries=subject(project,settings);checkpoint();selected=dict(project,layers=nodes,exposures=[e for e in project['exposures'] if e['layer_id'] in nodes]);images=[];size=settings['working_size'];matte=np.asarray(settings['matte'],np.float32)/255
    for slot in [settings['source_slot'],settings['guide_slot']]:
        checkpoint();w,h,data=render(selected,slot,output_size=tuple(size));a=np.frombuffer(data,np.uint8).reshape(h,w,4).astype(np.float32)/255.;rgb=a[:,:,:3]*a[:,:,3:4]+matte*(1-a[:,:,3:4]);images.append(np.ascontiguousarray(rgb.transpose(2,0,1)))
    fields=(runner or infer)(images[0],images[1],settings['progress'],checkpoint);first=[];second=[];masks0=[];masks1=[]
    for layer in layers:
        d0=project['drawings'][entries[layer]['source']['drawing_id']];d1=project['drawings'][entries[layer]['guide']['drawing_id']];first.append(d0['pixels']);second.append(d1['pixels']);masks0.append(drawing_mask(d0));masks1.append(drawing_mask(d1))
    transported=transport(first,second,masks0,masks1,[float(nodes[l].get('opacity',255)) for l in layers],fields,checkpoint,blend_policy=blend_policy);outputs=dict(zip(layers,transported['outputs']));from engine.candidate_corrections import overlay;corrected=overlay(project,'learned',settings,outputs,checkpoint);unsafe=sorted(layer+': '+reason for layer,out in outputs.items() for reason in out['unsafe_reasons']);signature=fingerprint(dict(inputs=scope,pixels={l:fingerprint(dict(pixels=r['pixels'],mask=r['protected_mask'])) for l,r in outputs.items()}));rejected=any(row['signature']==signature for row in project.get('learned_motion_reviews',[]));metadata=fields['metadata']
    if blend_policy is not None:metadata=dict(deepcopy(metadata),research_blend_policy=blend_policy)
    return dict(settings=deepcopy(settings),dependency_sha256=scope,outputs=outputs,metrics=transported['metrics'],model_metadata=metadata,unsafe_reasons=unsafe,signature=signature,previously_rejected=rejected,warnings=transported['warnings']+(['Retained explicit candidate paint/erase constraints applied; generated surroundings remain unapproved.'] if corrected else [])+['Appearance interpolation does not infer the intended action, semantic parts or all new surfaces.','Working-resolution learned fields are explicitly upsampled; editable RGBA outputs keep native canvas dimensions.'])


def propose(project,settings,checkpoint=None):return _propose(project,settings,checkpoint)


def _install_fresh(project,result,identity,approved=False):
    scope,layers,nodes,entries=subject(project,result['settings'])
    if scope!=result['dependency_sha256']:raise ValueError('Learned proposal is stale')
    if result['unsafe_reasons']:raise ValueError('Repair learned motion before installation: '+'; '.join(result['unsafe_reasons']))
    if result['previously_rejected'] and approved:raise ValueError('This learned result was rejected; correct inputs/settings before approval')
    if not isinstance(identity,str) or not identity or len(identity)>64 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in identity):raise ValueError('Use a safe1..64character operation identity')
    q=deepcopy(project);owned={};a,b=result['settings']['target_start'],result['settings']['target_end']
    for index,layer in enumerate(layers):
        did=identity+'-'+str(index)
        if did in q['drawings']:raise ValueError('Learned operation identity already exists')
        out=result['outputs'][layer];drawing=dict(pixels=out['pixels'],protected_mask=out['protected_mask'],protection_encoding=ENCODING,approved=bool(approved),locked=False,origin='reviewed_learned_motion' if approved else 'unreviewed_motion_candidate',parent_drawing=entries[layer]['source']['drawing_id'],learned_guide_drawing=entries[layer]['guide']['drawing_id']);drawing['locked']=bool(count(drawing));q['drawings'][did]=drawing;owned[layer]=did
    rows=[]
    for e in q['exposures']:
        if e['layer_id'] not in entries or e!=entries[e['layer_id']]['source']:rows.append(e);continue
        rows.append(dict(e,length=a-e['start']));rows.append(dict(layer_id=e['layer_id'],drawing_id=owned[e['layer_id']],start=a,length=b-a))
        if b<e['start']+e['length']:rows.append(dict(e,start=b,length=e['start']+e['length']-b))
    q['exposures']=rows;q.setdefault('learned_motion_operations',[]).append(dict(id=identity,settings=deepcopy(result['settings']),inputs=scope,signature=result['signature'],model=deepcopy(result['model_metadata']),drawings=owned,approved=bool(approved),metrics=deepcopy(result['metrics'])))
    if len(q['learned_motion_operations'])>64:raise ValueError('Learned operation history capacity64; preserve before continuing')
    if len(q['drawings'])>512:raise ValueError('Learned proposal exceeds drawing capacity')
    validate(q);validate_layers(q);validate_metadata(q);check_budget(q);return q


def preview(project,settings,identity,checkpoint=None):
    result=propose(project,settings,checkpoint);return _install_fresh(project,result,identity,False),result


def accept(project,result,identity,checkpoint=None):
    current=propose(project,result['settings'],checkpoint)
    if current!=result:raise ValueError('Learned result differs from current source/model/backend; regenerate')
    return _install_fresh(project,current,identity,True)


def _reject_fresh(project,result,reason):
    if subject(project,result['settings'])[0]!=result['dependency_sha256']:raise ValueError('Learned result is stale')
    if not isinstance(reason,str) or not reason.strip() or len(reason)>240:raise ValueError('Record a1..240character rejection reason')
    q=deepcopy(project);rows=q.setdefault('learned_motion_reviews',[])
    if len(rows)>=128:raise ValueError('Learned rejection history capacity128')
    rows.append(dict(signature=result['signature'],inputs=result['dependency_sha256'],reason=reason));return q


def reject(project,result,reason):
    expected=propose(project,result['settings'])
    if expected!=result:raise ValueError('Rejected learned output differs from current backend')
    return _reject_fresh(project,expected,reason)
