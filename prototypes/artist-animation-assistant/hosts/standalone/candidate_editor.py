"""Explicit candidate-copy editing and correction adoption; no automatic approval."""
from copy import deepcopy
from pathlib import Path
import json,queue,threading,uuid
import tkinter as tk
from tkinter import ttk,filedialog
from engine import candidate_corrections as corrections
from engine.project import fingerprint
from engine.jobs import atomic_write
from hosts.standalone.session import Session
from hosts.standalone.joint_jobs import merge_prepared

ROOT=Path(__file__).resolve().parents[2]
class Cancelled(Exception):pass


class CorrectionJobs:
    def __init__(self,root):self.root=Path(root);self.thread=None;self.done=queue.Queue(maxsize=1);self.cancel_event=threading.Event()
    @property
    def busy(self):return self.thread is not None and self.thread.is_alive()
    def cancel(self):self.cancel_event.set()
    def join(self,timeout=None):
        if self.thread:self.thread.join(timeout)
    def poll(self):
        try:return self.done.get_nowait()
        except queue.Empty:return None
    def start(self,operation,payload,token):
        if self.busy:raise ValueError('Correction work is still stopping')
        if operation not in ('prepare','adopt','resume'):raise ValueError('Unknown correction task')
        data=deepcopy(payload);self.done=queue.Queue(maxsize=1);self.cancel_event=threading.Event();directory=self.root/uuid.uuid4().hex;directory.mkdir(parents=True)
        self.thread=threading.Thread(target=self._run,args=(operation,data,token,directory,self.cancel_event),name='artist-correction-'+operation,daemon=True);self.thread.start();return directory
    def _run(self,operation,data,token,directory,cancel):
        def checkpoint():
            if cancel.is_set():raise Cancelled('Correction work cancelled; source unchanged')
        event=dict(operation=operation,token=token,directory=str(directory))
        try:
            from scripts.credits import build
            from scripts.provenance_gate import verify_ui
            credits=build(check=True);verify_ui(ROOT);checkpoint()
            if sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())>1536*1024**2:raise ValueError('Private correction storage threshold reached; preserve results before continuing')
            use=next(row for row in credits['uses'] if row['use_id']=='USE-CANDIDATE-CORRECTIONS');atomic_write(directory/'provenance/runs/candidate-correction.json',dict(operation=operation,source_ids=use['source_ids'],component_ids=use['component_ids'],credits_snapshot=credits['snapshot_sha256'],execution=dict(target='local CPU',network_allowed=False),automatic_approval=False))
            if operation=='prepare':
                source=data['source'];before,rows=corrections.editable_copy(source,data['preview']);checkpoint();Session(source).save(directory/'source.aaa');checkpoint();editor=Session(before);editor.save(directory/'before.aaa');editor.path=directory/'edited.aaa'
                manifest=dict(format='candidate-edit-context-1',source_sha256=fingerprint(source),before_sha256=fingerprint(before),rows=rows,controls=data.get('controls'),tool=data.get('tool'))
                atomic_write(directory/'context.json',manifest);event.update(source_project=source,before=before,rows=rows,editor=editor,context_directory=str(directory))
            elif operation=='resume':
                context=Path(data['path']).resolve();file=context/'context.json'
                if not file.resolve().is_relative_to(context) or file.stat().st_size>256*1024:raise ValueError('Invalid bounded correction context')
                manifest=json.loads(file.read_text(encoding='utf-8'))
                base={'format','source_sha256','before_sha256','rows'}
                if set(manifest) not in (base,base|{'controls','tool'}) or manifest['format']!='candidate-edit-context-1':raise ValueError('Unknown correction context format')
                controls=manifest.get('controls');tool=manifest.get('tool')
                if tool not in (None,'learned','geometric') or controls is not None and (not isinstance(controls,dict) or set(controls)!={'values','guide'} or not isinstance(controls['values'],dict) or not set(controls['values'])<=set(CONTROLS) or any(type(v) not in (str,int,float,bool) for v in controls['values'].values()) or controls['guide'] is not None and not isinstance(controls['guide'],str)):raise ValueError('Invalid saved correction controls')
                for name in ['source.aaa','before.aaa','edited.aaa']:
                    if not (context/name).resolve().is_relative_to(context):raise ValueError('Correction archive escapes selected folder')
                source=Session.load(context/'source.aaa');checkpoint();before=Session.load(context/'before.aaa').project
                if fingerprint(source.project)!=manifest['source_sha256'] or fingerprint(before)!=manifest['before_sha256']:raise ValueError('Correction context source/baseline changed')
                rows=manifest['rows']
                if not isinstance(rows,list) or not 1<=len(rows)<=16:raise ValueError('Invalid correction context rows')
                for row in rows:
                    if corrections.binding(source.project,row['family'],row['request'])!=row['binding'] or corrections.source_scope(source.project,row['family'],row['request'])!=row['source_scope']:raise ValueError('Saved correction source needs rebind')
                edited=context/'edited.aaa';editor=Session.load(edited if edited.exists() else context/'before.aaa');editor.path=edited;event.update(source_session=source,before=before,rows=rows,editor=editor,context_directory=str(context),controls=controls,tool=tool)
            else:
                # Retain all input versions even if extraction is refused. No
                # archive is overwritten, including a newer manual save.
                edited=data['edited'];Session(edited).save(directory/'edited-input.aaa');checkpoint();prepared=corrections.adopt(data['source'],data['before'],edited,data['rows'],checkpoint);Session(prepared).save(directory/'source-with-corrections.aaa');event.update(base=data['source'],prepared=prepared,edited_fingerprint=fingerprint(edited))
            checkpoint();event['state']='ready'
        except Cancelled as error:event.update(state='cancelled',error=str(error))
        except Exception as error:event.update(state='failed',error=str(error))
        try:atomic_write(directory/'status.json',dict(operation=operation,state=event['state'],error=event.get('error')))
        except Exception as error:event.update(state='failed',error=event.get('error','')+'; Could not persist correction status: '+str(error))
        self.done.put(event)


CONTROLS=['actor','source','end_key','insert_start','insert_end','phase','width','height','matte','detail','pool_mode','samples','budget','budget_mode','start','end','deformation','allow_clip','arc','release','easing','hold']


class CandidateEditor:
    def __init__(self,app,private_root):
        self.app=app;self.jobs=CorrectionJobs(private_root);self.closed=False;self.pending=None;self.prepared=None;self.context=None;self.identities=[]
        self.page=p=ttk.Frame(app.tools,padding=6);app.tools.add(p,text='Candidate edits');p.bind('<Destroy>',lambda event:self.close() if event.widget is self.page else None)
        ttk.Label(p,text='Edit generated candidates as a separate copy. Painting does not approve the remaining generated pixels.',wraplength=220).pack(fill='x')
        ttk.Label(p,text='Use Edit candidate copy after preparing a comparison in Joint motion or Learned motion. Source work is privately saved first; then enter explicitly.',wraplength=220).pack(fill='x',pady=4)
        self.enter_button=ttk.Button(p,text='Enter prepared candidate copy',command=lambda:app.guard(self.enter));self.enter_button.pack(fill='x')
        self.adopt_button=ttk.Button(p,text='Adopt paint / erase constraints',command=lambda:app.guard(self.adopt));self.adopt_button.pack(fill='x',pady=3)
        self.return_button=ttk.Button(p,text='Return to source without adoption',command=lambda:app.guard(self.return_to_source));self.return_button.pack(fill='x')
        ttk.Button(p,text='Resume saved correction folder',command=lambda:app.guard(self.choose_resume)).pack(fill='x',pady=3)
        self.message=tk.StringVar(master=app.root,value='No candidate copy is open. Preparation never switches your document automatically.');ttk.Label(p,textvariable=self.message,wraplength=220).pack(fill='x',pady=4)
        self.recovery=tk.StringVar(master=app.root);ttk.Label(p,text='Private recovery path (select to copy)').pack(anchor='w');ttk.Entry(p,textvariable=self.recovery,state='readonly').pack(fill='x')
        ttk.Separator(p).pack(fill='x',pady=4);ttk.Label(p,text='Retained corrections in current source').pack(anchor='w');self.listbox=tk.Listbox(p,height=4,exportselection=False);self.listbox.pack(fill='x');self.version=tk.StringVar(master=app.root,value='1');ttk.Entry(p,textvariable=self.version,width=5).pack(anchor='w');self.activate_button=ttk.Button(p,text='Activate retained version (number above)',command=lambda:app.guard(self.activate));self.activate_button.pack(fill='x');self.deactivate_button=ttk.Button(p,text='Deactivate selected; keep every version',command=lambda:app.guard(self.deactivate));self.deactivate_button.pack(fill='x')
        ttk.Label(p,text='Changed source, method or pose needs explicit rebind; corrections are retained, never silently dropped. Edit only generated drawings in this copy.',wraplength=220).pack(fill='x',pady=4)
        self.refresh();self.ticket=app.root.after(50,self.poll)
    def token(self):return (id(self.app.session),self.app.session.counter,id(self.app.session.project))
    def capture(self,owner):
        controls={name:getattr(owner,name).get() for name in CONTROLS if isinstance(getattr(owner,name,None),tk.Variable)};guide=None
        if hasattr(owner,'ids') and 0<=owner.guide_combo.current()<len(owner.ids):guide=owner.ids[owner.guide_combo.current()]
        return dict(values=controls,guide=guide)
    def restore(self,context):
        owner=context.get('owner');saved=context.get('controls')
        if owner is None or saved is None:return
        if saved['guide'] is not None and saved['guide'] in owner.ids:owner.guide_combo.current(owner.ids.index(saved['guide']));owner.load_guide()
        for name,value in saved['values'].items():getattr(owner,name).set(value)
    def prepared_current(self):
        c=self.prepared;return c is not None and c['token']==self.token() and (c.get('owner') is None or c['owner'].serial==c['owner_serial'])
    def ready_for(self,owner):return self.prepared_current() and self.prepared.get('owner') is owner
    def invalidate_owner(self,owner):
        if self.context is not None:return
        if self.prepared is not None and self.prepared.get('owner') is owner:self.prepared=None;self.message.set('Parameters changed; prepare the candidate context again. Private snapshots retained.')
        if self.pending is not None and self.pending.get('owner') is owner:self.pending['stale']=True
        self.refresh()
    def prepare(self,owner):
        if self.context is not None:raise ValueError('Return to the current source before opening another candidate copy')
        if self.ready_for(owner):return self.enter()
        if owner.preview_data is None or owner.preview_data.get('token')!=owner.token() or not owner.current(owner.ready):raise ValueError('Prepare a current comparison first')
        if 'project' not in owner.preview_data:raise ValueError('Prepare the comparison again to create an editable copy')
        self.prepared=None;controls=self.capture(owner);self.pending=dict(owner=owner,owner_serial=owner.serial,source_session=self.app.session,controls=controls,token=self.token());self.jobs.start('prepare',dict(source=self.app.session.project,preview=owner.preview_data['project'],controls=controls,tool='learned' if owner is self.app.learned_panel else 'geometric'),self.token());self.message.set('Saving source and candidate context in background. Your current drawing stays available.');self.refresh()
    def enter(self):
        if not self.prepared_current():raise ValueError('Prepared context changed; prepare the candidate copy again')
        context=self.prepared;self.prepared=None;self.pending=None;self.context=context;editor=context['editor'];row=context['rows'][0];editor.layer_id=next(iter(row['drawings']));editor.slot=row['request']['target_start'];self.app.replace_session(editor);self.app.tools.select(self.page);self.message.set('Editing UNAPPROVED candidates. Paint/erase in Drawing, then adopt constraints. Source snapshot: '+context['context_directory']);self.refresh()
    def adopt(self):
        c=self.context
        if c is None or self.app.session is not c['editor']:raise ValueError('Enter the prepared candidate editor first')
        self.jobs.start('adopt',dict(source=c['source_session'].project,before=c['before'],edited=self.app.session.project,rows=c['rows']),self.token());self.message.set('Saving edits and checking source-bound correction chains. No artwork is approved.');self.refresh()
    def return_to_source(self):
        c=self.context
        if c is None:raise ValueError('No candidate copy to return from')
        if not self.app.confirm_discard():return
        self.jobs.cancel();self.context=None;self.app.replace_session(c['source_session']);self.restore(c);self.message.set('Returned to source. Private snapshots and any saved edited copy remain; no corrections were adopted.');self.refresh()
    def choose_resume(self):
        if self.context is not None:raise ValueError('Return to source before resuming another correction folder')
        path=filedialog.askdirectory(parent=self.app.root,title='Choose a private candidate correction context folder')
        if path:self.resume(path)
    def resume(self,path):
        if self.context is not None:raise ValueError('Return to source before resuming another context')
        if not self.app.confirm_discard():return
        self.prepared=None;self.pending=dict(owner=None,controls=None,token=self.token());self.jobs.start('resume',dict(path=str(Path(path).resolve())),self.token());self.message.set('Reading private context. Enter explicitly when ready; current document stays available.');self.refresh()
    def selected(self):
        indexes=self.listbox.curselection()
        if not indexes:raise ValueError('Choose a retained correction')
        return self.identities[indexes[0]]
    def deactivate(self):
        if self.context is not None:raise ValueError('Return to source to change retained corrections')
        self.app.session.commit(corrections.deactivate(self.app.session.project,self.selected()),'deactivate-candidate-correction');self.app.refresh();self.message.set('Correction deactivated; all versions retained. Undo is available.')
    def activate(self):
        if self.context is not None:raise ValueError('Return to source to activate a retained correction')
        self.app.session.commit(corrections.activate(self.app.session.project,self.selected(),int(self.version.get())-1),'activate-candidate-correction');self.app.refresh();self.message.set('Retained version activated. Regenerate to review; generated surroundings remain unapproved.')
    def refresh(self):
        if not hasattr(self,'enter_button'):return
        p=self.app.session.project;rows=p.get('candidate_corrections',{}) if p else {};old=self.listbox.curselection();chosen=self.identities[old[0]] if old and old[0]<len(self.identities) else None;self.identities=list(rows);self.listbox.delete(0,'end')
        for row in rows.values():self.listbox.insert('end',row['family']+' · '+row['actor_id']+' · '+('inactive' if row['active'] is None else 'v'+str(row['active']+1))+' / '+str(len(row['versions'])))
        if chosen in self.identities:self.listbox.selection_set(self.identities.index(chosen))
        busy=self.jobs.busy;editing=self.context is not None and self.app.session is self.context['editor'];self.enter_button.configure(state='normal' if self.prepared_current() and not busy else 'disabled');self.adopt_button.configure(state='normal' if editing and not busy else 'disabled');self.return_button.configure(state='normal' if self.context and not busy else 'disabled');enabled='normal' if rows and self.context is None and not busy else 'disabled';self.activate_button.configure(state=enabled);self.deactivate_button.configure(state=enabled)
    def poll(self):
        if self.closed:return
        try:self.poll_once()
        except Exception as error:self.jobs.cancel();self.message.set('Correction operation refused; work retained: '+str(error));self.refresh()
        finally:
            if not self.closed:self.ticket=self.app.root.after(50,self.poll)
    def poll_once(self):
        event=self.jobs.poll()
        if event is None:return
        if event['state']!='ready':self.message.set('Correction '+event['state']+': '+event.get('error',''));self.refresh();return
        if event['token']!=self.token() or self.jobs.cancel_event.is_set():self.message.set('Context changed during work; private snapshots retained. Prepare/adopt again.');self.refresh();return
        if event['operation'] in ('prepare','resume'):
            pending=self.pending
            if pending is None:raise ValueError('Correction preparation context is unavailable')
            if pending.get('stale'):self.pending=None;self.message.set('Parameters changed during preparation. Private snapshots retained; prepare again.');self.refresh();return
            if event['operation']=='resume':
                owner=self.app.learned_panel if event['tool']=='learned' else self.app.joint_panel if event['tool']=='geometric' else None;pending.update(owner=owner,owner_serial=owner.serial if owner else None,controls=event['controls'])
            source=pending['source_session'] if event['operation']=='prepare' else event['source_session'];self.prepared=dict(pending,source_session=source,before=event['before'],rows=event['rows'],editor=event['editor'],context_directory=event['context_directory']);self.pending=None;self.recovery.set(event['context_directory']);self.message.set('Source and candidate saved privately. Enter the prepared copy explicitly.');self.refresh()
        else:
            c=self.context
            if c is None or self.app.session is not c['editor']:raise ValueError('Correction editor no longer current')
            # Revalidate against the current stashed source and preserve independent
            # edits; a conflicting source/correction epoch refuses application.
            for row in c['rows']:
                if corrections.binding(c['source_session'].project,row['family'],row['request'])!=row['binding'] or corrections.source_scope(c['source_session'].project,row['family'],row['request'])!=row['source_scope']:raise ValueError('Source changed before correction commit; edited snapshot retained')
            merged=merge_prepared(event['base'],event['prepared'],c['source_session'].project);c['source_session'].commit(merged,'adopt-candidate-corrections');receipt_error=None
            try:atomic_write(Path(event['directory'])/'review.json',dict(state='committed-corrections-only',source_revision=c['source_session'].counter,automatic_artwork_approval=False))
            except Exception as error:receipt_error=str(error)
            self.context=None;self.app.replace_session(c['source_session']);self.restore(c);self.recovery.set(str(Path(event['directory'])/'source-with-corrections.aaa'));self.message.set('Corrections adopted as constraints. Regenerate and review; surrounding generated art is still unapproved. Undo is one action.'+(' Receipt could not be saved: '+receipt_error if receipt_error else ''));self.refresh()
    def close(self):
        if self.closed:return
        self.closed=True;self.jobs.cancel()
        if getattr(self,'ticket',None):self.app.root.after_cancel(self.ticket);self.ticket=None
