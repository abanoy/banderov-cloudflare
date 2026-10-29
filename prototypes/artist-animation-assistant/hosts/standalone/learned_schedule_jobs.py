"""Learned candidate pools reuse per-sample owned hidden inference processes."""
from pathlib import Path
import uuid
from engine import learned_schedules as pools
from engine.jobs import atomic_write
from engine.project import fingerprint
from hosts.standalone.learned_jobs import LearnedJobs,Cancelled,ROOT
from hosts.standalone.joint_jobs import comparison_frames


class LearnedScheduleJobs(LearnedJobs):
    def _run(self,operation,payload,token,directory,cancel):
        settings=payload['settings'] if operation=='generate' else payload['result']['settings']
        if 'learned_samples' not in settings:return super()._run(operation,payload,token,directory,cancel)
        ticks=0;inferences=0
        def checkpoint():
            nonlocal ticks
            if cancel.is_set():raise Cancelled('Learned pool cancelled')
            ticks+=1
            with self.lock:self.progress=dict(phase=operation+' pool',checkpoints=ticks)
        def runner(project,request,check):
            nonlocal inferences
            checkpoint();sub=directory/('sample-'+str(inferences));sub.mkdir();inferences+=1
            return self._infer(project,request,sub,cancel,check)
        outcome=dict(operation=operation,token=token,directory=str(directory),choice=payload['choice']);project=payload['project']
        try:
            from scripts.credits import build
            from scripts.provenance_gate import verify_ui
            credits=build(check=True);verify_ui(ROOT);checkpoint()
            if sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())>1536*1024**2:raise ValueError('Private learned storage threshold reached')
            plan=pools.preflight(project,settings);use=next(u for u in credits['uses'] if u['use_id']=='USE-LEARNED-JOINT-SCHEDULES')
            atomic_write(directory/'provenance/runs/learned-pool.json',dict(operation=operation,source_ids=use['source_ids'],component_ids=use['component_ids'],credits_snapshot=credits['snapshot_sha256'],input_fingerprint=fingerprint(project),dependency_sha256=plan['dependency_sha256'],preflight=plan,execution=dict(target='owned local CPU processes per evaluated sample',network_allowed=False),requires_review=True))
            if operation=='generate':result,_=pools._build(project,settings,checkpoint,runner);atomic_write(directory/'result.json',result)
            else:
                prepared,result=pools._prepare(project,payload['result'],payload['choice'],'learned-pool-'+uuid.uuid4().hex,operation,checkpoint,runner,reason=payload['reason'])
                if operation=='preview':
                    context=dict(schedule=settings['schedule'],motion_samples=[],detail_rectangle=payload['detail']);frames=comparison_frames(project,prepared,context,checkpoint)
                    from hosts.standalone.session import Session
                    Session(prepared).save(directory/'unapproved-preview.aaa');outcome.update(frames=frames,preview_path=str(directory/'unapproved-preview.aaa'),preview_project=prepared)
                else:outcome.update(base=project,prepared=prepared)
            checkpoint();outcome.update(result=result,scope=plan['dependency_sha256'],state='ready')
        except Cancelled as error:outcome.update(state='cancelled',error=str(error))
        except Exception as error:outcome.update(state='failed',error=str(error))
        try:atomic_write(directory/'status.json',dict(state=outcome['state'],operation=operation,checkpoints=ticks,sample_inference_attempts=inferences,completed_pool_samples=outcome.get('result',{}).get('counts',{}).get('motion_samples_evaluated'),error=outcome.get('error')))
        except Exception as error:outcome.update(state='failed',error=outcome.get('error','')+'; Could not persist task status: '+str(error))
        self.done.put(outcome)
