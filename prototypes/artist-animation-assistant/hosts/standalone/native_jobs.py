"""Bounded cooperative native work, no Tk or network calls in the worker.

REF-PYTHON-THREADING / REF-PYTHON-QUEUE / REF-TKINTER. Existing native/effect
method references are registered under USE-NATIVE-BACKGROUND-HOST.
"""
from copy import deepcopy
from pathlib import Path
import os
import threading,queue,time,uuid,hashlib,json,traceback
from engine.project import fingerprint
from engine.jobs import atomic_write

ROOT=Path(__file__).resolve().parents[2]

class Cancelled(Exception):pass

class NativeJobs:
    """One thread/task and at most one full rendered-frame cache per controller.

    No worker accesses widgets. Caller polls and explicitly validates review tokens.
    The cache is owned by the single worker; discard requests clear it on next use.
    """
    def __init__(self,private_root):
        self.root=Path(private_root);self.thread=None;self.done=queue.Queue(maxsize=1)
        self.cancel_event=threading.Event();self.lock=threading.Lock();self.progress={}
        self.directory=None;self.frame_cache=None;self.cache_generation=0;self.snapshot_cache={}
    @property
    def busy(self):return self.thread is not None and self.thread.is_alive()
    def start(self,operation,payload,token=None):
        if operation not in {'index','import','effects','open','save'}:raise ValueError('Unknown native work operation')
        if self.busy:raise ValueError('Native task is still running; wait for cancellation')
        # PixelPlane/SourceBlob deepcopy retains immutable bytes/tiles; no raster
        # expansion, archive read, decode or render runs on the caller thread.
        snapshot=deepcopy(payload);self.cancel_event=threading.Event();self.done=queue.Queue(maxsize=1)
        self.directory=self.root/uuid.uuid4().hex;self.directory.mkdir(parents=True)
        self.progress=dict(state='running',phase='queued',checkpoints=0)
        self.thread=threading.Thread(target=self._run,args=(operation,snapshot,token,self.directory,self.cancel_event,self.cache_generation),name='artist-native-'+operation,daemon=True)
        self.thread.start();return self.directory
    def cancel(self):self.cancel_event.set()
    def discard_cache(self):
        self.cache_generation+=1
        if not self.busy:self.frame_cache=None
    def status(self):
        with self.lock:return dict(self.progress)
    def poll(self):
        try:return self.done.get_nowait()
        except queue.Empty:return None
    def join(self,timeout=None):
        if self.thread:self.thread.join(timeout)
    def review(self,result,state):
        if state not in {'loaded','displayed','stale','discarded','saved'}:raise ValueError('Unknown native review decision')
        atomic_write(Path(result['directory'])/'review.json',dict(state=state,job_id=Path(result['directory']).name))
    def _run(self,operation,payload,token,directory,cancel,generation):
        started=time.perf_counter();count=0;last=0;phase='starting';result=None
        def checkpoint():
            nonlocal count,last
            if cancel.is_set():raise Cancelled('Native work cancelled')
            count+=1;now=time.monotonic()
            if now-last>.2:
                value=dict(state='running',phase=phase,checkpoints=count)
                with self.lock:self.progress=value
                atomic_write(directory/'progress.json',value);last=now
        def stage(value):
            nonlocal phase,last
            phase=value;last=0;checkpoint()
        try:
            from scripts.credits import build
            from scripts.provenance_gate import verify_ui
            credits=build(check=True);verify_ui(ROOT)
            # Retain results instead of silently deleting review history. Bound
            # derived storage per controller root; original archives are excluded.
            used=sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())
            if used>1536*1024**2:raise ValueError('Private native work storage budget reached; preserve/save results and choose a new private work root')
            use=next(u for u in credits['uses'] if u['use_id']=='USE-NATIVE-BACKGROUND-HOST')
            manifest=dict(schema_version='1.0',run_id=directory.name,operation=operation,execution=dict(target='local',network_allowed=False),credits_snapshot=credits['snapshot_sha256'],source_ids=use['source_ids'],component_ids=use['component_ids'],requires_review=True,state='running')
            project=payload.get('project')
            request={k:v for k,v in payload.items() if k!='project'}
            if project is not None:request.update(input_fingerprint=fingerprint(project),input_revision=project['revision'])
            atomic_write(directory/'request.json',request)
            atomic_write(directory/'provenance/runs'/('native-'+directory.name+'.json'),manifest)
            if generation!=getattr(self,'frame_generation',None):self.frame_cache=None;self.frame_generation=generation
            if operation=='open':
                from hosts.standalone.session import Session
                path=Path(payload['path']).resolve();before=path.stat()
                def file_digest():
                    h=hashlib.sha256()
                    with path.open('rb') as f:
                        for block in iter(lambda:f.read(4*1024**2),b''):checkpoint();h.update(block)
                    return h.hexdigest()
                stage('Opening editable project in background');digest=file_digest();session=Session.load(path);checkpoint();after=path.stat()
                if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns) or file_digest()!=digest:raise ValueError('Assistant project changed while opening')
                result=dict(session=session,source=dict(path=str(path),sha256=digest,bytes=before.st_size,mtime_ns=before.st_mtime_ns),project_path=str(path),project_sha256=digest,mode='effects' if session.project.get('native_effects') else 'raw')
            elif operation=='save':
                from hosts.standalone.session import Session
                path=Path(payload['path']).resolve()
                if path.suffix.lower() not in {'.aaa','.json'}:raise ValueError('Assistant projects save as .aaa or legacy .json')
                original=project.get('native_window_source',{}).get('archive_path')
                if original and Path(original).resolve()==path:raise ValueError('Original native archive cannot be a project save destination')
                before=None if not path.exists() else (path.stat().st_size,path.stat().st_mtime_ns)
                stage('Saving editable snapshot in background');temporary=path.with_name('.artist-save-'+uuid.uuid4().hex+path.suffix)
                try:
                    Session(project).save(temporary);checkpoint()
                    after=None if not path.exists() else (path.stat().st_size,path.stat().st_mtime_ns)
                    if before!=after:raise ValueError('Save destination changed while preparing snapshot; existing file preserved')
                    os.replace(temporary,path)
                finally:
                    if temporary.exists():temporary.unlink()
                result=dict(path=str(path),project_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),input_fingerprint=request['input_fingerprint'],saved_before_late_cancel=cancel.is_set())
            elif operation in {'index','import'}:
                from engine.io.kra_window import KraWindow
                stage('Reading native metadata and source identity')
                with KraWindow(payload['path'],checkpoint) as reader:
                    identity=dict(path=str(reader.path),sha256=reader.sha256,bytes=reader.stat.st_size,mtime_ns=reader.stat.st_mtime_ns)
                    if operation=='index':
                        nodes=[dict(id=i,name=reader.nodes[i]['attributes'].get('name',i),kind=reader.nodes[i]['kind'],parent=reader.nodes[i]['parent'],visible=reader.visible(i),locked=reader.nodes[i]['attributes'].get('locked','0')=='1',styled=reader.nodes[i]['attributes'].get('layerstyle') not in {None,'','0'}) for i in reader.order]
                        result=dict(index=dict(source=identity,width=reader.width,height=reader.height,fps=reader.fps,start=reader.clip_start,end=reader.clip_end,nodes=nodes))
                        atomic_write(directory/'index.json',result['index'])
                    else:
                        if identity['sha256']!=payload['source_sha256']:raise ValueError('Native source changed after indexing; index again')
                        mode=payload['mode']
                        if mode not in {'strict','raw','effects'}:raise ValueError('Choose a native style policy')
                        stage('Decoding selected native keys')
                        project=reader.import_window(payload['start'],payload['end'],payload.get('layers'),style_policy='reject' if mode=='strict' else 'retain_unrendered')
                        from hosts.standalone.session import Session
                        session=Session(project)
                        if mode=='effects':
                            from engine.native_effects import compile_styles
                            stage('Preparing editable experimental effects');session.set_native_effects(compile_styles(session.project))
                        stage('Saving separate editable window');session.save(directory/'window.aaa');checkpoint()
                        result=dict(session=session,source=identity,project_path=str(directory/'window.aaa'),project_sha256=hashlib.sha256((directory/'window.aaa').read_bytes()).hexdigest(),mode=mode)
            else:
                from engine.native_effects import render,compile_styles
                from engine.packed_render import png_bytes
                from hosts.standalone.session import Session
                import numpy as np
                stage('Preparing native effect inputs');slot=payload['slot'];key=(fingerprint(project),slot)
                params=project.get('native_effects') or compile_styles(project)
                cache=self.frame_cache
                if cache is not None and cache['key']==key:
                    w,h,raw=cache['width'],cache['height'],cache['rgba'];cache_hit=True
                else:
                    stage('Rendering shadows and glows');w,h,raw=render(project,slot,params,checkpoint);checkpoint();cache_hit=False
                    stage('Saving private render snapshot');prior=self.snapshot_cache.get(key[0])
                    if prior and Path(prior['path']).is_file():
                        if hashlib.sha256(Path(prior['path']).read_bytes()).hexdigest()!=prior['sha256']:raise ValueError('Cached input snapshot changed')
                    else:
                        Session(project).save(directory/'input.aaa');prior=dict(path=str(directory/'input.aaa'),sha256=hashlib.sha256((directory/'input.aaa').read_bytes()).hexdigest());self.snapshot_cache[key[0]]=prior
                        while len(self.snapshot_cache)>4:self.snapshot_cache.pop(next(iter(self.snapshot_cache)))
                    (directory/'frame.png').write_bytes(png_bytes(w,h,raw));checkpoint()
                    cache=dict(key=key,width=w,height=h,rgba=raw,directory=str(directory),parameters=params,input_project=prior)
                    self.frame_cache=cache
                view=payload['view']
                if type(view) not in (list,tuple) or len(view)!=6 or any(type(v) is not int for v in view):raise ValueError('Invalid native viewport')
                x0,y0,x1,y1,ow,oh=view
                if not 0<=x0<x1<=w or not 0<=y0<y1<=h or not 1<=ow<=2048 or not 1<=oh<=2048:raise ValueError('Native viewport exceeds bounds')
                stage('Preparing displayed viewport');a=np.frombuffer(raw,np.uint8).reshape(h,w,4);xs=x0+np.arange(ow)*(x1-x0)//ow;ys=y0+np.arange(oh)*(y1-y0)//oh
                png=png_bytes(ow,oh,a[ys[:,None],xs[None,:]].tobytes());(directory/'view.png').write_bytes(png)
                result=dict(png=png,width=ow,height=oh,view=list(view),slot=slot,input_fingerprint=key[0],parameters=params,cache_hit=cache_hit,frame_directory=cache['directory'],frame_sha256=hashlib.sha256(raw).hexdigest(),input_project=cache['input_project'])
            # Save commit has already completed atomically; do not report a
            # successful write as cancelled if cancellation arrived afterwards.
            if operation!='save':checkpoint()
            summary={k:v for k,v in result.items() if k not in {'session','png'}}
            summary.update(state='ready',operation=operation,seconds=time.perf_counter()-started)
            atomic_write(directory/'result.json',summary)
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:(directory/name).write_bytes((ROOT/'generated'/name).read_bytes())
            manifest.update(state='ready',seconds=summary['seconds'],request_sha256=hashlib.sha256((directory/'request.json').read_bytes()).hexdigest(),outputs_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.iterdir() if p.name in {'window.aaa','input.aaa','frame.png','view.png','index.json','result.json'}},frame_directory=result.get('frame_directory'))
            atomic_write(directory/'provenance/runs'/('native-'+directory.name+'.json'),manifest)
            outcome=dict(state='ready',operation=operation,token=token,directory=str(directory),result=result,seconds=summary['seconds'])
        except Exception as error:
            state='cancelled' if isinstance(error,Cancelled) else 'failed'
            outcome=dict(state=state,operation=operation,token=token,directory=str(directory),error=str(error),seconds=time.perf_counter()-started)
            try:
                atomic_write(directory/'result.json',{k:v for k,v in outcome.items() if k!='token'})
                if state=='failed':(directory/'error.txt').write_text(traceback.format_exc(),encoding='utf-8')
                path=directory/'provenance/runs'/('native-'+directory.name+'.json')
                if path.exists():
                    value=json.loads(path.read_text());value.update(state=state,error=str(error),seconds=outcome['seconds']);atomic_write(path,value)
            except Exception as logging_error:outcome['error']+='; private record write failed: '+str(logging_error)
        with self.lock:self.progress=dict(state=outcome['state'],phase=phase,checkpoints=count)
        self.done.put_nowait(outcome)
