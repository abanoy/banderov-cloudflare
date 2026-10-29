"""Owned hidden inference and cooperative rebind review preparation; no Tk calls."""
from pathlib import Path
from copy import deepcopy
from engine import correction_rebind as rebind,motion
from engine import candidate_corrections as corrections
from engine.spatial_constraints import drawing_mask,count,ENCODING
from engine.jobs import atomic_write
from hosts.standalone.learned_jobs import LearnedJobs,Cancelled,ROOT
from hosts.standalone.session import Session
from hosts.standalone.joint_jobs import comparison_frames


def summary(result):return {k:v for k,v in result.items() if k not in {'raw_preview','preview','prepared'}}


def old_placement_preview(source,result,checkpoint):
    """Diagnostic old-mark placement on FRESH pose; never a recovered old pose."""
    config=result['config'];target=corrections.key(config['family'],config['request']);prepared=deepcopy(result['prepared']);entry=prepared['candidate_corrections'][target];old=source['candidate_corrections'][config['correction_id']]['versions'][config['version']];entry['versions'][entry['active']]['patches']=deepcopy(old['patches']);preview=deepcopy(result['raw_preview']);outputs={};exposures={}
    for lid in entry['versions'][entry['active']]['base_hashes']:
        e=corrections._exposure(preview,lid,config['request']['target_start']);exposures[lid]=e;drawing=preview['drawings'][e['drawing_id']];outputs[lid]=dict(pixels=drawing['pixels'],protected_mask=drawing_mask(drawing))
    corrections.overlay(prepared,config['family'],config['request'],outputs,checkpoint)
    for i,lid in enumerate(old['patches']):
        e=exposures[lid];drawing=deepcopy(preview['drawings'][e['drawing_id']]);drawing.update(pixels=outputs[lid]['pixels'],protected_mask=outputs[lid]['protected_mask'],protection_encoding=ENCODING,origin='unreviewed_motion_candidate',approved=False);drawing['locked']=bool(count(drawing));did='old-placement-'+result['signature'][:24]+'-'+str(i);preview['drawings'][did]=drawing;e['drawing_id']=did
    return preview


class RebindJobs(LearnedJobs):
    def _run(self,operation,payload,token,directory,cancel):
        ticks=0;attempts=0;completed=0
        def checkpoint():
            nonlocal ticks
            if cancel.is_set():raise Cancelled('Rebind work cancelled; source unchanged')
            ticks+=1
        def generate(project,request,check):
            nonlocal attempts,completed
            check();family=config['family']
            if family=='geometric':return motion.propose(project,request,check)
            attempts+=1;folder=directory/('sample-'+str(attempts));folder.mkdir();result=self._infer(project,request,folder,cancel,check);completed+=1;return result
        config=None;project=payload['project'];event=dict(operation=operation,token=token,directory=str(directory))
        try:
            from scripts.credits import build
            from scripts.provenance_gate import verify_ui
            credits=build(check=True);verify_ui(ROOT);checkpoint();config=payload['settings'] if operation=='generate' else payload['result']['config']
            if sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())>1536*1024**2:raise ValueError('Private rebind storage threshold reached; preserve results before continuing')
            use=next(row for row in credits['uses'] if row['use_id']=='USE-CORRECTION-REBIND');atomic_write(directory/'provenance/runs/rebind.json',dict(operation=operation,source_ids=use['source_ids'],component_ids=use['component_ids'],credits_snapshot=credits['snapshot_sha256'],network_allowed=False,automatic_approval=False));Session(project).save(directory/'source.aaa');checkpoint()
            if operation=='generate':
                result=rebind.propose(project,config,checkpoint,generator=generate);atomic_write(directory/'proposal.json',summary(result));event['result']=result
            elif operation=='preview':
                result=rebind._verified(project,payload['result'],checkpoint,generator=generate);Session(result['raw_preview']).save(directory/'raw-unapproved.aaa');checkpoint();Session(result['preview']).save(directory/'rebound-unapproved.aaa');checkpoint();request=config['request'];guide=project['motion_guides'][request['guide_id']] if config['family']=='geometric' else None
                start=guide['source_slot'] if guide else request['source_slot'];end=guide.get('guide_slot',start+1) if guide else request['guide_slot'];settings=dict(schedule=dict(start=start,end=end+1),motion_samples=[request] if guide else [],detail_rectangle=payload['detail']);frames=comparison_frames(result['raw_preview'],result['preview'],settings,checkpoint);old_view=old_placement_preview(project,result,checkpoint);Session(old_view).save(directory/'old-placement-diagnostic.aaa');old_frames=comparison_frames(old_view,result['preview'],settings,checkpoint);frames.update(old=old_frames['source'],old_detail=old_frames['source_detail']);atomic_write(directory/'proposal.json',summary(result));event.update(result=result,frames=frames,preview_path=str(directory/'rebound-unapproved.aaa'),preview_project=result['preview'],raw_preview_path=str(directory/'raw-unapproved.aaa'),old_placement_path=str(directory/'old-placement-diagnostic.aaa'))
            elif operation in ('accept','reject'):
                prepared=rebind.reject(project,payload['result'],payload['reason'],checkpoint,generator=generate) if operation=='reject' else rebind.accept(project,payload['result'],checkpoint,generator=generate);Session(prepared).save(directory/'prepared-source.aaa');checkpoint();event.update(base=project,prepared=prepared)
            else:raise ValueError('Unknown rebind operation')
            checkpoint();event['state']='ready'
        except Cancelled as error:event.update(state='cancelled',error=str(error))
        except Exception as error:event.update(state='failed',error=str(error))
        event.update(inference_attempts=attempts,completed_inferences=completed)
        try:atomic_write(directory/'status.json',dict(state=event['state'],operation=operation,checkpoints=ticks,inference_attempts=attempts,completed_inferences=completed,error=event.get('error')))
        except Exception as error:event.update(state='failed',error=event.get('error','')+'; Cannot save rebind status: '+str(error))
        self.done.put(event)
