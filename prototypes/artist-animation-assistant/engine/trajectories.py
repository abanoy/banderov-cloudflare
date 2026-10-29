"""Independent cubic landmark trajectories and separate clock progress.

REF-SVG-CUBIC-PATHS / REF-CSS-EASING. No SVG/CSS parser or conformance claim.
Contact constraints bind supplied landmark geometry, not inferred contact pixels.
"""
import math
from copy import deepcopy

SOURCES=['REF-SVG-CUBIC-PATHS','REF-CSS-EASING']
CONTROL_FIELDS=('trajectories','timing_map','contacts')


def number(value,low,high):
    if type(value) not in (int,float) or not math.isfinite(value) or not low<=value<=high:raise ValueError('Finite numeric control outside supported range')
    return value


def xy(value):
    if not isinstance(value,list) or len(value)!=2:raise ValueError('Expected2D coordinate list')
    for v in value:number(v,-16384,16384)
    return value


def cubic(a,b,c,d,u):
    # de Casteljau preserves convex-hull bounds and avoids expanded cancellation.
    if u==0:return a
    if u==1:return d
    if a==b==c==d:return a
    v=1-u;ab=v*a+u*b;bc=v*b+u*c;cd=v*c+u*d
    return v*(v*ab+u*bc)+u*(v*bc+u*cd)


def bezier(start,segment,u):
    return [float(cubic(start[i],segment['control1'][i],segment['control2'][i],segment['end'][i],u)) for i in range(2)]


def _path(handle,path,progress):
    if progress==0:return handle['source'][:]
    if progress==1:return handle['target'][:]
    if path is None:return [float(a+progress*(b-a)) for a,b in zip(handle['source'],handle['target'])]
    start=handle['source'];before=0
    for segment in path:
        end=segment['end_progress']
        if progress<=end:return bezier(start,segment,(progress-before)/(end-before))
        start=segment['end'];before=end
    raise ValueError('Trajectory does not reach progress1')


def validate(guide):
    handles={h['id']:h for h in guide['handles']}
    paths=guide.get('trajectories',{})
    if not isinstance(paths,dict) or len(paths)>16:raise ValueError('At most16spatial trajectory paths')
    for identity,path in paths.items():
        if identity not in handles or handles[identity]['source'] is None or handles[identity]['target'] is None:raise ValueError('Trajectory requires a matched landmark; unmatched content needs explicit visibility handling')
        if not isinstance(path,list) or not 1<=len(path)<=8:raise ValueError('Use1..8cubic segments per landmark')
        previous=0
        for segment in path:
            if not isinstance(segment,dict) or set(segment)!={'end_progress','control1','control2','end'}:raise ValueError('Unknown spatial path field')
            end=number(segment['end_progress'],0,1)
            if end<=previous:raise ValueError('Strictly increasing spatial segment progress required')
            for key in ('control1','control2','end'):xy(segment[key])
            previous=end
        if previous!=1 or path[-1]['end']!=handles[identity]['target']:raise ValueError('Spatial path must end exactly at matched target at progress1')
    timing=guide.get('timing_map')
    if timing is not None:
        if not isinstance(timing,list) or not 1<=len(timing)<=16:raise ValueError('Use1..16clock segments')
        time,progress=0,0
        for segment in timing:
            if not isinstance(segment,dict) or set(segment)!={'end_time','end_progress','easing'}:raise ValueError('Unknown clock field')
            end=number(segment['end_time'],0,1);p=number(segment['end_progress'],0,1)
            if end<=time or p<progress:raise ValueError('Clock time must increase and progress cannot reverse; use a spatial reversal path')
            curve=segment['easing']
            if not isinstance(curve,list) or len(curve)!=4:raise ValueError('Expected cubic easing x1,y1,x2,y2')
            for v in curve:number(v,0,1)
            if curve[1]>curve[3]:raise ValueError('Only monotone easing output supported; no silent overshoot clamping')
            time,progress=end,p
        if time!=1 or progress!=1:raise ValueError('Clock must end at time1/progress1')
    contacts=guide.get('contacts',[])
    if not isinstance(contacts,list) or len(contacts)>32:raise ValueError('At most32explicit landmark contact intervals')
    identities=set()
    for contact in contacts:
        if not isinstance(contact,dict) or set(contact)!={'id','landmark_id','start_progress','end_progress','position'}:raise ValueError('Unknown contact field')
        identity=contact['id']
        if not isinstance(identity,str) or not 1<=len(identity)<=80 or any(ord(c)<32 for c in identity) or identity in identities:raise ValueError('Distinct bounded contact identity required')
        identities.add(identity);hid=contact['landmark_id'];lo=number(contact['start_progress'],0,1);hi=number(contact['end_progress'],0,1);position=xy(contact['position'])
        if lo>hi or hid not in handles or not handles[hid]['enabled'] or handles[hid]['source'] is None or handles[hid]['target'] is None:raise ValueError('Contact must bind an active matched landmark and ordered interval')
        handle=handles[hid];path=paths.get(hid)
        if _path(handle,path,lo)!=position or _path(handle,path,hi)!=position:raise ValueError('Contact endpoints conflict with trajectory')
        if lo==hi:continue
        # A cubic is constant on an open interval only if every control is that
        # constant. This proves continuous point contact, not sampled coincidence.
        if path is None:
            if handle['source']!=position or handle['target']!=position:raise ValueError('Contact interval conflicts with moving linear landmark')
        else:
            start=handle['source'];before=0
            for segment in path:
                end=segment['end_progress']
                if max(before,lo)<min(end,hi) and any(p!=position for p in [start,segment['control1'],segment['control2'],segment['end']]):raise ValueError('Contact interval must remain constant throughout overlapping cubic segments')
                start=segment['end'];before=end
    history=guide.get('motion_control_history',[])
    if not isinstance(history,list) or len(history)>128:raise ValueError('Motion control history capacity128; preserve/export before creating another guide')
    from engine.project import fingerprint
    for record in history:
        if not isinstance(record,dict) or set(record)!={'previous','replacement','inputs','fingerprint','document_revision'}:raise ValueError('Invalid control history')
        payload={k:v for k,v in record.items() if k not in ('fingerprint','document_revision')}
        if fingerprint(payload)!=record['fingerprint'] or type(record['document_revision']) is not int or record['document_revision']<0:raise ValueError('Control history identity differs')
    return guide


def positions(guide,progress):
    validate(guide);number(progress,0,1)
    return {h['id']:_path(h,guide.get('trajectories',{}).get(h['id']),progress) for h in guide['handles'] if h['enabled'] and h['source'] is not None and h['target'] is not None}


def progress_at(guide,time):
    validate(guide);number(time,0,1)
    if time in (0,1):return time
    timing=guide.get('timing_map')
    if timing is None:return float(time)
    before_t,before_p=0,0
    for segment in timing:
        end=segment['end_time'];p=segment['end_progress']
        if time<=end:
            if time==end:return p
            x=(time-before_t)/(end-before_t);x1,y1,x2,y2=segment['easing'];low,high=0.,1.
            # Invert time x. Substituting x directly into y is incorrect for a
            # generic cubic-bezier timing curve.52bisections bound parameter error.
            for _ in range(52):
                u=(low+high)/2
                value=cubic(0,x1,x2,1,u)
                if value==x:
                    low=high=u;break
                if value<x:low=u
                else:high=u
            y=cubic(0,y1,y2,1,(low+high)/2)
            return float(before_p+y*(p-before_p))
        before_t,before_p=end,p
    raise ValueError('Incomplete clock')


def control_history(previous,definition,inputs,revision):
    from engine.project import fingerprint
    history=deepcopy(previous.get('motion_control_history',[]))
    old={k:deepcopy(previous.get(k)) for k in CONTROL_FIELDS};new={k:deepcopy(definition.get(k)) for k in CONTROL_FIELDS}
    if previous and old!=new:
        record=dict(previous=old,replacement=new,inputs=deepcopy(inputs));record['fingerprint']=fingerprint(record)
        if not any(row['fingerprint']==record['fingerprint'] for row in history):record['document_revision']=revision;history.append(record)
    return history
