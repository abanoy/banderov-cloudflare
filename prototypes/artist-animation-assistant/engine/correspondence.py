"""Bounded image-patch correspondence proposals from REF-TEMPLATE-MATCH.

Independent normalized squared-difference implementation, no OpenCV runtime/code.
Search bounds and review policy are project choices, not semantic confidence.
"""
from copy import deepcopy
import math
import numpy as np
from engine.project import fingerprint,validate
from engine.layers import validate_layers
from engine.motion import validate_guides,_actor_layers,_exposure,save_guide

SOURCES=['REF-TEMPLATE-MATCH','REF-PYTHON-COPY','REF-NUMPY-2-4-1','REF-NUMPY-BUFFER','REF-COMPOSITING','REF-NUMPY-NORM']


def defaults(guide_id):return dict(guide_id=guide_id,patch_radius=4,search_radius=32,max_error=.2,min_gap=.015,reverse_tolerance=2.,around='source')


def validate_reviews(project):
    reviews=project.get('correspondence_reviews',{})
    if not isinstance(reviews,dict) or len(reviews)>64:raise ValueError('At most64 correspondence review groups')
    for guide,records in reviews.items():
        if guide not in project.get('motion_guides',{}) or not isinstance(records,list) or len(records)>128:raise ValueError('Correspondence review history capacity128 per guide')
        for record in records:
            if not isinstance(record,dict) or set(record)!={'landmark_id','target','decision','inputs','fingerprint'}:raise ValueError('Invalid correspondence review record')
            if record['decision'] not in {'accept','reject'} or fingerprint({k:v for k,v in record.items() if k!='fingerprint'})!=record['fingerprint']:raise ValueError('Invalid correspondence review identity')
    if not isinstance(project.get('correspondence_operations',[]),list) or len(project.get('correspondence_operations',[]))>64:raise ValueError('At most64 retained correspondence operations')
    return project


def subject(project,settings):
    validate(project);validate_layers(project);validate_guides(project);validate_reviews(project)
    if set(settings) not in (set(defaults('')),set(defaults(''))|{'rotation_mode'}):raise ValueError('Unexpected patch correspondence settings')
    if settings.get('rotation_mode','fixed') not in ('fixed','quarter_turns'):raise ValueError('Patch orientation must be fixed or quarter_turns')
    if type(settings['patch_radius']) is not int or not 2<=settings['patch_radius']<=8 or type(settings['search_radius']) is not int or not 4<=settings['search_radius']<=48:raise ValueError('Patch radius2..8 and search radius4..48 required')
    for name,limit in [('max_error',1),('min_gap',1),('reverse_tolerance',8)]:
        value=settings[name]
        if type(value) not in {int,float} or not math.isfinite(value) or not 0<=value<=limit:raise ValueError('Invalid finite patch review threshold')
    if settings['around'] not in {'source','current'}:raise ValueError('Search around source or current target hint')
    gid=settings['guide_id'];g=project.get('motion_guides',{}).get(gid)
    if g is None or g['guide_slot'] is None:raise ValueError('Save a guide with an approved target key before image matching')
    layers=_actor_layers(project,g['actor_id']);entries={};inputs={};nodes={}
    for layer in layers:
        for role in ['source','guide']:
            e=_exposure(project,layer,g[role+'_slot'])
            if e is None:raise ValueError('Both correspondence keys need an exposed drawing for each selected actor layer')
            drawing=project['drawings'][e['drawing_id']]
            if not drawing.get('approved'):raise ValueError('Correspondence images must be approved keys')
            entries[role+':'+layer]=dict(exposure=e,drawing=drawing);inputs[role+':'+layer]=dict(drawing_id=e['drawing_id'],drawing_sha256=fingerprint(drawing))
        identity=layer
        while identity is not None:nodes[identity]=project['layers'][identity];identity=nodes[identity].get('parent_id')
    keys={'guide:'+gid,'match_review:'+gid}|{'layer:'+i for i in nodes}
    reviews=project.get('correspondence_reviews',{}).get(gid,[])
    data=dict(project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],guide=g,entries=entries,nodes=nodes,reviews=reviews,settings=settings,epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in sorted(keys)})
    return fingerprint(data),g,inputs,nodes,reviews


def _image(project,slot,nodes,box):
    p=dict(project,layers={i:n for i,n in project['layers'].items() if i in nodes},exposures=[e for e in project['exposures'] if e['layer_id'] in nodes])
    if p['schema_version']=='0.2':
        from engine.packed_render import render
        raw=render(p,slot,None,box)[2];a=np.frombuffer(raw,np.uint8).reshape(box[3]-box[1],box[2]-box[0],4)
    else:
        from engine.layers import render
        a=np.asarray(render(p,slot),np.uint8).reshape(p['canvas']['height'],p['canvas']['width'],4)[box[1]:box[3],box[0]:box[2]]
    a=a.astype(np.float64)/255.;a[:,:,:3]*=a[:,:,3:4]
    return a


def _patch(image,box,point,radius):
    x,y=math.floor(point[0])-box[0],math.floor(point[1])-box[1]
    if not radius<=x<image.shape[1]-radius or not radius<=y<image.shape[0]-radius:return None
    return image[y-radius:y+radius+1,x-radius:x+radius+1]


def _search(template,image,box,center,settings,excluded,checkpoint):
    r=settings['patch_radius'];s=settings['search_radius'];cx,cy=map(math.floor,center);scores=[];te=float(np.sum(template*template))
    for y in range(max(box[1]+r,cy-s),min(box[3]-r,cy+s+1)):
        if checkpoint:checkpoint()
        xs=list(range(max(box[0]+r,cx-s),min(box[2]-r,cx+s+1)))
        if not xs:continue
        patches=np.stack([image[y-box[1]-r:y-box[1]+r+1,x-box[0]-r:x-box[0]+r+1] for x in xs])
        # REF-TEMPLATE-MATCH: same independent NSSD, with explicit discrete
        # template orientations. This is patch evidence, not a pose predictor.
        turns=range(4) if settings.get('rotation_mode')=='quarter_turns' else range(1)
        errors=np.stack([np.sum((patches-np.rot90(template,k))**2,axis=(1,2,3))/np.maximum(np.sqrt(te*np.sum(patches*patches,axis=(1,2,3))),1e-12) for k in turns],axis=1)
        selected=errors.argmin(axis=1);error=errors[np.arange(len(xs)),selected]
        for x,value,turn in zip(xs,error,selected):
            if any(abs(x+.5-q[0])<=1 and abs(y+.5-q[1])<=1 for q in excluded):continue
            scores.append((float(value),(x+.5-center[0])**2+(y+.5-center[1])**2,x+.5,y+.5,int(turn)))
    alternatives=[]
    for error,_,x,y,turn in sorted(scores):
        if any(max(abs(x-c['target'][0]),abs(y-c['target'][1]))<=2 for c in alternatives):continue
        candidate=dict(target=[x,y],error=error)
        if settings.get('rotation_mode')=='quarter_turns':candidate['patch_quarter_turns']=turn
        alternatives.append(candidate)
        if len(alternatives)==5:break
    return alternatives


def propose(project,settings,checkpoint=None):
    scope,g,inputs,nodes,reviews=subject(project,settings);w,h=project['canvas']['width'],project['canvas']['height'];r=settings['patch_radius'];s=settings['search_radius']
    points=[p for p in g['handles'] if p['enabled'] and p['source'] is not None and p['target'] is not None]
    if not points:raise ValueError('Add named source points with provisional targets; explicit unmatched visibility marks are left untouched')
    if len(points)>16:raise ValueError('Match at most16 source landmarks per guide')
    centers=[p['source'] if settings['around']=='source' else p['target'] for p in points];allxy=[p['source'] for p in points]+centers;roi=g['roi']
    box=[max(0,min(roi[0],math.floor(min(v[0] for v in allxy))-s-r)),max(0,min(roi[1],math.floor(min(v[1] for v in allxy))-s-r)),min(w,max(roi[2],math.floor(max(v[0] for v in allxy))+s+r+1)),min(h,max(roi[3],math.floor(max(v[1] for v in allxy))+s+r+1))]
    if max(box[2]-box[0],box[3]-box[1])>512:raise ValueError('Matching context exceeds512square; use a local guide/target search')
    source=_image(project,g['source_slot'],nodes,box);target=_image(project,g['guide_slot'],nodes,box);rows=[]
    for landmark,center in zip(points,centers):
        if checkpoint:checkpoint()
        row=dict(landmark_id=landmark['id'],source=deepcopy(landmark['source']),alternatives=[],status='unknown',warnings=[])
        template=_patch(source,box,landmark['source'],r)
        if template is None:row.update(status='source_patch_outside_image');rows.append(row);continue
        if float(np.sum(np.var(template,axis=(0,1))))<1e-5:row.update(status='source_patch_uninformative');rows.append(row);continue
        excluded=[a['target'] for a in reviews if a['decision']=='reject' and a['inputs']==inputs and a['landmark_id']==landmark['id']]
        for old in g.get('rejected_matches',[]):
            previous=old['previous']
            if old['inputs']==inputs and previous['id']==landmark['id'] and previous['source']==landmark['source'] and previous['target'] is not None:excluded.append(previous['target'])
        choices=_search(template,target,box,center,settings,excluded,checkpoint);row.update(alternatives=choices,excluded_targets=excluded)
        if not choices:row.update(status='no_candidate');rows.append(row);continue
        best=choices[0];reverse_template=_patch(target,box,best['target'],r);back=_search(reverse_template,source,box,landmark['source'],settings,[],checkpoint)
        reverse=float(np.linalg.norm(np.asarray(back[0]['target'])-landmark['source'])) if back else None
        gap=choices[1]['error']-best['error'] if len(choices)>1 else None
        row.update(reverse_error=reverse,alternative_gap=gap)
        if best['error']>settings['max_error']:row['warnings'].append('poor_patch_match')
        if gap is None or gap<settings['min_gap']:row['warnings'].append('ambiguous_repeated_appearance')
        if reverse is None or reverse>settings['reverse_tolerance']:row['warnings'].append('reverse_match_inconsistent')
        row['status']='clear_by_thresholds' if not row['warnings'] else 'needs_review';rows.append(row)
    result=dict(settings=deepcopy(settings),guide_id=settings['guide_id'],dependency_sha256=scope,inputs=inputs,rows=rows,context=box,method='bounded-premultiplied-rgba-normalized-squared-difference',version='0.1.0',source_ids=SOURCES[:],warnings=['Source points and search radius are supplied; target coordinates are image-based proposals, not automatic anatomical identities.','Clear/ambiguous thresholds are explicit engineering heuristics, not calibrated probabilities or occlusion labels.','No rotation/scale invariance, new-surface synthesis, automatic source-point detection or learned candidate reproduction.'])
    if settings.get('rotation_mode')=='quarter_turns':
        result.update(method='bounded-quarter-turn-premultiplied-rgba-nssd',version='0.2.0')
        result['warnings'][-1]='Only four discrete patch rotations are compared. Large movement may need current-target hints; no arbitrary rotation/scale invariance, pose interpretation or new-surface synthesis.'
    return result



def review(project,result,decisions,operation_id):
    if result!=propose(project,result['settings']):raise ValueError('Correspondence result changed or is stale')
    if not isinstance(decisions,list) or not decisions or len(decisions)>16 or len({d['landmark_id'] for d in decisions})!=len(decisions):raise ValueError('Review1..16 distinct landmark candidates')
    if any(o['operation_id']==operation_id for o in project.get('correspondence_operations',[])):raise ValueError('Correspondence operation identity already used')
    g=deepcopy(project['motion_guides'][result['guide_id']]);history=deepcopy(project.get('correspondence_reviews',{}).get(result['guide_id'],[]));rows={r['landmark_id']:r for r in result['rows']};handles={p['id']:p for p in g['handles']}
    for decision in decisions:
        if set(decision)!={'landmark_id','candidate_index','decision'} or decision['decision'] not in {'accept','reject'}:raise ValueError('Explicit accept/reject candidate decision required')
        row=rows[decision['landmark_id']];index=decision['candidate_index']
        if type(index) is not int or not 0<=index<len(row['alternatives']):raise ValueError('Candidate no longer exists')
        target=row['alternatives'][index]['target'];record=dict(landmark_id=decision['landmark_id'],target=target[:],decision=decision['decision'],inputs=deepcopy(result['inputs']));record['fingerprint']=fingerprint(record)
        if not any(r['fingerprint']==record['fingerprint'] for r in history):history.append(record)
        if decision['decision']=='accept':handles[decision['landmark_id']]['target']=target[:]
    updated=save_guide(project,result['guide_id'],g);updated.setdefault('correspondence_reviews',{})[result['guide_id']]=history
    updated.setdefault('correspondence_operations',[]).append(dict(operation_id=operation_id,guide_id=result['guide_id'],proposal=deepcopy(result),decisions=deepcopy(decisions)))
    return validate_reviews(updated)
