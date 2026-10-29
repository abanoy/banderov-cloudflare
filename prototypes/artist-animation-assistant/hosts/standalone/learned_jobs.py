"""Learned editor work: owned hidden inference processes; no Tk in workers."""
from copy import deepcopy
from pathlib import Path
import queue,threading,time,subprocess,sys,uuid
from engine import learned_motion as learned
from engine.jobs import atomic_write,read,create_learned_motion_job,request_cancel
from engine.project import fingerprint
from hosts.standalone.joint_jobs import comparison_frames

ROOT=Path(__file__).resolve().parents[2]
class Cancelled(Exception):pass


class LearnedJobs:
    def __init__(self,root):
        self.root=Path(root);self.thread=None;self.done=queue.Queue(maxsize=1);self.cancel_event=threading.Event();self.lock=threading.Lock();self.progress={};self.process=None
    @property
    def busy(self):return self.thread is not None and self.thread.is_alive()
    def status(self):
        with self.lock:return dict(self.progress)
    def cancel(self):self.cancel_event.set()
    def shutdown(self):
        self.cancel()
        with self.lock:
            if self.process is not None and self.process.poll() is None:self.process.kill()
    def poll(self):
        try:return self.done.get_nowait()
        except queue.Empty:return None
    def join(self,timeout=None):
        if self.thread:self.thread.join(timeout)
    def start(self,operation,project,settings=None,result=None,detail=None,reason='',token=None,choice=None):
        if self.busy:raise ValueError('Learned work is still running; wait for cancellation')
        if operation not in ('generate','preview','accept','reject'):raise ValueError('Unknown learned task')
        payload=deepcopy(dict(project=project,settings=settings,result=result,detail=detail,reason=reason,choice=choice));directory=self.root/uuid.uuid4().hex;directory.mkdir(parents=True)
        self.cancel_event=threading.Event();self.done=queue.Queue(maxsize=1);self.progress=dict(phase=operation,checkpoints=0)
        self.thread=threading.Thread(target=self._run,args=(operation,payload,token,directory,self.cancel_event),name='artist-learned-'+operation,daemon=True);self.thread.start();return directory
    def _infer(self,project,settings,directory,cancel,checkpoint):
        job=directory/'inference';checkpoint();create_learned_motion_job(project,settings,job);checkpoint();process=None;deadline=time.monotonic()+240;stop_started=None;timed_out=False
        try:
            with (directory/'worker-stdout.txt').open('wb') as out,(directory/'worker-stderr.txt').open('wb') as err:
                process=subprocess.Popen([sys.executable,'-X','utf8',str(ROOT/'scripts/worker.py'),'--job',str(job)],cwd=ROOT,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                with self.lock:
                    self.process=process
                    if cancel.is_set():process.kill()
                atomic_write(directory/'owned-process.json',dict(pid=process.pid,command='scripts/worker.py --job inference',hidden_windows=True))
                while process.poll() is None:
                    now=time.monotonic();timed_out=timed_out or now>deadline
                    if cancel.is_set() or timed_out:
                        if stop_started is None:request_cancel(job);stop_started=now
                        if now-stop_started>10:process.kill()
                    with self.lock:self.progress=dict(phase='isolated CPU inference'+(' / stopping' if stop_started else ''),checkpoints=0)
                    time.sleep(.05)
                process.wait()
            if cancel.is_set():raise Cancelled('Learned work cancelled; source preserved')
            if timed_out:raise ValueError('Owned learned process exceeded240s; diagnostics retained')
            state=read(job/'job.json')
            if process.returncode or state['state']!='completed':raise ValueError('Learned inference '+state['state']+': '+str(state.get('error','inspect private logs')))
            checkpoint();return read(job/'result.json')['learned_result']
        finally:
            if process is not None and process.poll() is None:process.kill();process.wait()
            with self.lock:
                if self.process is process:self.process=None
    def _run(self,operation,payload,token,directory,cancel):
        ticks=0
        def checkpoint():
            nonlocal ticks
            if cancel.is_set():raise Cancelled('Learned work cancelled')
            ticks+=1
            with self.lock:self.progress=dict(phase=operation,checkpoints=ticks)
        outcome=dict(operation=operation,token=token,directory=str(directory));project=payload['project']
        try:
            from scripts.credits import build
            from scripts.provenance_gate import verify_ui
            credits=build(check=True);verify_ui(ROOT);checkpoint()
            if sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())>1536*1024**2:raise ValueError('Private learned storage budget reached; preserve results before continuing')
            settings=payload['settings'] if operation=='generate' else payload['result']['settings'];scope=learned.subject(project,settings)[0]
            use=next(u for u in credits['uses'] if u['use_id']=='USE-LEARNED-EDITOR-REVIEW')
            atomic_write(directory/'provenance/runs/learned-editor.json',dict(operation=operation,source_ids=use['source_ids'],component_ids=use['component_ids'],credits_snapshot=credits['snapshot_sha256'],input_fingerprint=fingerprint(project),dependency_sha256=scope,backend_evaluations=1,execution=dict(target='owned local CPU process',network_allowed=False),requires_review=True))
            result=self._infer(project,settings,directory,cancel,checkpoint)
            if operation!='generate' and result!=payload['result']:raise ValueError('Learned result differs from current source/model/backend; regenerate')
            outcome.update(result=result,scope=scope)
            if operation=='generate':atomic_write(directory/'result.json',result)
            elif operation=='preview':
                preview=learned._install_fresh(project,result,'learned-preview-'+uuid.uuid4().hex,False)
                context=dict(schedule=dict(start=settings['source_slot'],end=settings['guide_slot']+1),motion_samples=[],detail_rectangle=payload['detail'])
                frames=comparison_frames(project,preview,context,checkpoint)
                from hosts.standalone.session import Session
                Session(preview).save(directory/'unapproved-preview.aaa');outcome.update(frames=frames,preview_path=str(directory/'unapproved-preview.aaa'),preview_project=preview)
            else:
                prepared=learned._reject_fresh(project,result,payload['reason']) if operation=='reject' else learned._install_fresh(project,result,'learned-'+uuid.uuid4().hex,True)
                outcome.update(base=project,prepared=prepared)
            checkpoint();outcome['state']='ready'
        except Cancelled as error:outcome.update(state='cancelled',error=str(error))
        except Exception as error:outcome.update(state='failed',error=str(error))
        try:atomic_write(directory/'status.json',dict(state=outcome['state'],operation=operation,checkpoints=ticks,error=outcome.get('error')))
        except Exception as error:outcome.update(state='failed',error=outcome.get('error','')+'; Could not persist task status: '+str(error))
        self.done.put(outcome)
