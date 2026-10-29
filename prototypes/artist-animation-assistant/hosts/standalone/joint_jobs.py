"""Background joint review preparation; no Tk/network on worker threads."""
from copy import deepcopy
from pathlib import Path
import threading,queue,time,uuid
from engine import joint_motion as joint
from engine.project import fingerprint
from engine.jobs import atomic_write

ROOT=Path(__file__).resolve().parents[2]
MISSING=object()


def merge_prepared(base,after,current):
    """Three-way apply of a trusted prepared result, preserving independent edits.

    Caller MUST check session identity and current joint.subject scope first.
    Exposure lists merge by layer; append-only histories preserve both suffixes.
    A concurrent conflicting value refuses instead of replacing artist work.
    """
    def copy(value):return value if value is MISSING else deepcopy(value)
    def merge(a,b,c,path=()):
        if a==b:return copy(c)
        if a==c:return copy(b)
        if b==c:return copy(c)
        if a is MISSING and isinstance(b,dict) and isinstance(c,dict):a={}
        if all(isinstance(v,dict) for v in (a,b,c)):
            result={}
            keys=list(c)+[key for key in b if key not in c]+[key for key in a if key not in c and key not in b]
            for key in keys:
                value=merge(a.get(key,MISSING),b.get(key,MISSING),c.get(key,MISSING),path+(key,))
                if value is not MISSING:result[key]=value
            return result
        if path==('exposures',):
            def by_layer(rows):return {lid:[r for r in rows if r['layer_id']==lid] for lid in {r['layer_id'] for r in rows}}
            rows=merge(by_layer(a),by_layer(b),by_layer(c),('exposure_layers',))
            return sorted([r for values in rows.values() for r in values],key=lambda r:(r['layer_id'],r['start']))
        if path in [('history',),('motion_operations',),('schedule_operations',),('learned_motion_operations',),('learned_motion_reviews',)]:
            if a is MISSING:a=[]
            if all(isinstance(v,list) for v in (a,b,c)) and b[:len(a)]==a and c[:len(a)]==a:
                def identity(row):return row.get('operation_id',row.get('id')) if isinstance(row,dict) else None
                ids={identity(row) for row in c[len(a):]}-{None}
                if any(identity(row) in ids for row in b[len(a):]):raise ValueError('Concurrent operation identity conflict')
                return deepcopy(c+b[len(a):])
        if path==('revision',):return c
        raise ValueError('Concurrent review conflict at '+'.'.join(map(str,path)))
    return merge(base,after,current)


def comparison_frames(source,preview,settings,checkpoint):
    import numpy as np,math
    from fractions import Fraction
    from engine.packed_render import render,png_bytes,checker,over
    from engine.layers import visible
    w,h=source['canvas']['width'],source['canvas']['height'];scale=min(400/w,260/h);size=(max(1,int(w*scale)),max(1,int(h*scale)))
    start,end=settings['schedule']['start'],settings['schedule']['end'];cache={};bytes_used=0
    points=[]
    for request in settings['motion_samples']:
        guide=source['motion_guides'][request['guide_id']];x0,y0,x1,y1=guide['roi'];points.extend([(x0,y0),(x1,y1)])
        points.extend(h[k] for h in guide['handles'] for k in ('source','target') if h[k] is not None)
        for segments in guide.get('trajectories',{}).values():
            points.extend(segment[k] for segment in segments for k in ('control1','control2','end'))
    rectangle=None if not points else (max(0,math.floor(min(p[0] for p in points))-8),max(0,math.floor(min(p[1] for p in points))-8),min(w,math.ceil(max(p[0] for p in points))+8),min(h,math.ceil(max(p[1] for p in points))+8))
    if settings.get('detail_rectangle') is not None:
        box=settings['detail_rectangle']
        if not isinstance(box,(list,tuple)) or len(box)!=4 or any(type(v) is not int for v in box) or not 0<=box[0]<box[2]<=w or not 0<=box[1]<box[3]<=h:raise ValueError('Detail bounds must fit the canvas')
        rectangle=tuple(box)
    def frames(project,rect=None):
        nonlocal bytes_used
        rw,rh=(rect[2]-rect[0],rect[3]-rect[1]) if rect else (w,h);scale=min(400/rw,260/rh);size=(max(1,int(rw*scale)),max(1,int(rh*scale)))
        result=[]
        for slot in range(start,end):
            checkpoint()
            active={e['layer_id']:fingerprint(project['drawings'][e['drawing_id']]['pixels']) for e in project['exposures'] if e['start']<=slot<e['start']+e['length'] and visible(project,e['layer_id'])}
            key=fingerprint(dict(layers=project['layers'],active=active,rectangle=rect))
            if key not in cache:
                if len(cache)>=128:raise ValueError('Comparison exceeds128distinct context frames; narrow the interval')
                ow,oh,raw=render(project,slot,output_size=size,rectangle=rect);pixels=over(np.frombuffer(checker(ow,oh),np.uint8).reshape(oh,ow,4),np.frombuffer(raw,np.uint8).reshape(oh,ow,4),Fraction(255));data=png_bytes(ow,oh,pixels.tobytes());bytes_used+=len(data)
                if bytes_used>64*1024**2:raise ValueError('Comparison PNG cache exceeds64MiB; narrow the interval')
                cache[key]=data
            result.append(cache[key])
        return result
    return dict(source=frames(source),proposed=frames(preview),source_detail=frames(source,rectangle),proposed_detail=frames(preview,rectangle),detail_rectangle=rectangle,start=start,end=end,fps=deepcopy(source['shot']['fps']),size=size,unique_frames=len(cache),png_bytes=bytes_used)


class Cancelled(Exception):pass


class JointJobs:
    def __init__(self,root):
        self.root=Path(root);self.thread=None;self.done=queue.Queue(maxsize=1);self.cancel_event=threading.Event();self.lock=threading.Lock();self.progress={}
    @property
    def busy(self):return self.thread is not None and self.thread.is_alive()
    def status(self):
        with self.lock:return dict(self.progress)
    def cancel(self):self.cancel_event.set()
    def poll(self):
        try:return self.done.get_nowait()
        except queue.Empty:return None
    def join(self,timeout=None):
        if self.thread:self.thread.join(timeout)
    def start(self,operation,project,settings=None,result=None,choice=None,token=None):
        if self.busy:raise ValueError('Joint work is still running; wait for cancellation')
        if operation not in ('generate','preview','accept','reject'):raise ValueError('Unknown joint task')
        payload=deepcopy(dict(project=project,settings=settings,result=result,choice=choice));self.cancel_event=threading.Event();self.done=queue.Queue(maxsize=1);directory=self.root/uuid.uuid4().hex;directory.mkdir(parents=True)
        self.progress=dict(phase=operation,checkpoints=0);self.thread=threading.Thread(target=self._run,args=(operation,payload,token,directory,self.cancel_event),name='artist-joint-'+operation,daemon=True);self.thread.start();return directory
    def _run(self,operation,payload,token,directory,cancel):
        ticks=0;last=0
        def checkpoint():
            nonlocal ticks,last
            if cancel.is_set():raise Cancelled('Joint work cancelled')
            ticks+=1;now=time.monotonic()
            if now-last>.2:
                with self.lock:self.progress=dict(phase=operation,checkpoints=ticks)
                last=now
        outcome=dict(operation=operation,token=token,directory=str(directory));project=payload['project']
        try:
            from scripts.credits import build
            from scripts.provenance_gate import verify_ui
            credits=build(check=True);verify_ui(ROOT);checkpoint()
            if sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())>1536*1024**2:raise ValueError('Private joint storage budget reached; preserve results and choose another work root')
            settings=payload['settings'] if operation=='generate' else payload['result']['settings'];scope=joint.subject(project,settings)
            use=next(u for u in credits['uses'] if u['use_id']=='USE-JOINT-EDITOR-REVIEW')
            atomic_write(directory/'provenance/runs/joint-editor.json',dict(operation=operation,source_ids=use['source_ids'],component_ids=use['component_ids'],credits_snapshot=credits['snapshot_sha256'],input_fingerprint=fingerprint(project),dependency_sha256=scope,execution=dict(target='local',network_allowed=False),requires_review=True))
            if operation=='generate':
                result=joint.propose(project,settings,checkpoint);atomic_write(directory/'result.json',result);outcome['result']=result
            elif operation=='preview':
                preview=joint.preview(project,payload['result'],payload['choice'],checkpoint);frames=comparison_frames(project,preview,settings,checkpoint)
                from hosts.standalone.session import Session
                Session(preview).save(directory/'unapproved-preview.aaa');outcome.update(result=payload['result'],frames=frames,preview_path=str(directory/'unapproved-preview.aaa'),preview_project=preview)
            else:
                prepared=joint.reject(project,payload['result'],payload['choice'],checkpoint) if operation=='reject' else joint.accept(project,payload['result'],payload['choice'],'joint-'+uuid.uuid4().hex,checkpoint)
                outcome.update(base=project,prepared=prepared,result=payload['result'])
            checkpoint();outcome.update(state='ready',scope=scope)
        except Cancelled as error:outcome.update(state='cancelled',error=str(error))
        except Exception as error:outcome.update(state='failed',error=str(error))
        try:atomic_write(directory/'status.json',dict(state=outcome['state'],operation=operation,checkpoints=ticks,error=outcome.get('error')))
        except Exception as error:outcome.update(state='failed',error=outcome.get('error','')+'; Could not persist task status: '+str(error))
        self.done.put(outcome)

