"""Standalone source-bound correction rebind; explicit review, no auto window."""
from copy import deepcopy
from pathlib import Path
import tkinter as tk
from tkinter import ttk
from engine import correction_rebind as rebind,candidate_corrections as corrections,motion,trajectories
from engine.jobs import atomic_write
from hosts.standalone.rebind_jobs import RebindJobs
from hosts.standalone.rebind_compare import RebindComparison
from hosts.standalone.joint_jobs import merge_prepared


class RebindPanel:
    def __init__(self,app,private_root):
        self.app=app;self.jobs=RebindJobs(private_root);self.closed=False;self.ready=None;self.preview_data=None;self.comparison=None;self.reviewed=False;self.serial=0;self.context=None;self.pending=None;self.ids=[];self.checked=None
        self.page=outer=ttk.Frame(app.tools);app.tools.add(outer,text='Rebind corrections');outer.bind('<Destroy>',lambda e:self.close() if e.widget is outer else None)
        canvas=tk.Canvas(outer,highlightthickness=0,width=230);scroll=ttk.Scrollbar(outer,orient='vertical',command=canvas.yview);canvas.configure(yscrollcommand=scroll.set);scroll.pack(side='right',fill='y');canvas.pack(side='left',fill='both',expand=True);p=ttk.Frame(canvas,padding=6);window=canvas.create_window(0,0,window=p,anchor='nw');p.bind('<Configure>',lambda e:canvas.configure(scrollregion=canvas.bbox('all')));canvas.bind('<Configure>',lambda e:canvas.itemconfigure(window,width=e.width))
        ttk.Label(p,text='Rebind retained paint / erase constraints. Generated surroundings stay unapproved.',wraplength=215).pack(fill='x')
        self.correction=tk.StringVar(master=app.root);self.correction_combo=ttk.Combobox(p,textvariable=self.correction,state='readonly',width=24);self.correction_combo.pack(fill='x',pady=4)
        self.version=tk.StringVar(master=app.root,value='1');self.family=tk.StringVar(master=app.root,value='Learned motion');self.sample=tk.StringVar(master=app.root,value='1');self.dx=tk.StringVar(master=app.root,value='0');self.dy=tk.StringVar(master=app.root,value='0');self.detail=tk.StringVar(master=app.root,value='');self.reason=tk.StringVar(master=app.root)
        def entry(label,var):
            row=ttk.Frame(p);row.pack(fill='x',pady=2);ttk.Label(row,text=label).pack(side='left');widget=ttk.Entry(row,textvariable=var,width=13);widget.pack(side='right',fill='x',expand=True);return widget
        entry('Retained version (1…8)',self.version);ttk.Label(p,text='Target from existing controls').pack(anchor='w');ttk.Combobox(p,textvariable=self.family,values=['Learned motion','Joint motion'],state='readonly',width=24).pack(fill='x');entry('Declared sample (1…16)',self.sample);entry('Move edits X pixels',self.dx);entry('Move edits Y pixels',self.dy);entry('Detail x0 y0 x1 y1',self.detail)
        ttk.Label(p,text='Set target keys, phase and interval in Learned motion, or guide/deformation in Joint motion. Sample selects one declared pool pose. Live source constraints remain active.',wraplength=215).pack(fill='x',pady=4)
        self.target_info=tk.StringVar(master=app.root,value='Choose a retained correction and target controls.');ttk.Label(p,textvariable=self.target_info,wraplength=215).pack(fill='x')
        self.generate_button=ttk.Button(p,text='Generate unapproved rebind',command=lambda:app.guard(self.generate));self.generate_button.pack(fill='x',pady=3);self.compare_button=ttk.Button(p,text='Prepare visual comparison',command=lambda:app.guard(self.compare));self.compare_button.pack(fill='x');self.accept_button=ttk.Button(p,text='Accept correction constraints only',command=lambda:app.guard(lambda:self.review(False)));self.accept_button.pack(fill='x',pady=3);entry('Rejection reason',self.reason);self.reject_button=ttk.Button(p,text='Reject this placement',command=lambda:app.guard(lambda:self.review(True)));self.reject_button.pack(fill='x');ttk.Button(p,text='Cancel rebinding work',command=self.cancel).pack(fill='x',pady=3)
        self.message=tk.StringVar(master=app.root,value='No automatic placement, approval or window opening.');ttk.Label(p,textvariable=self.message,wraplength=215).pack(fill='x',pady=4);self.recovery=tk.StringVar(master=app.root);ttk.Label(p,text='Private result path').pack(anchor='w');ttk.Entry(p,textvariable=self.recovery,state='readonly').pack(fill='x')
        for var in [self.correction,self.version,self.family,self.sample,self.dx,self.dy,self.detail]:var.trace_add('write',lambda *args:self.invalidate())
        def descendants(widget):
            for child in widget.winfo_children():yield child;yield from descendants(child)
        for widget in descendants(p):
            widget.bind('<MouseWheel>',lambda e:canvas.yview_scroll(-int(e.delta/120),'units'),add='+')
            widget.bind('<FocusIn>',lambda e:self.focus_visible(canvas,p,e.widget),add='+')
        self.refresh();self.ticket=app.root.after(50,self.poll)
    def focus_visible(self,canvas,body,widget):
        if not self.app.root.winfo_ismapped():return
        top=widget.winfo_rooty()-body.winfo_rooty();height=max(1,body.winfo_height());a=canvas.canvasy(0);b=a+canvas.winfo_height()
        if top<a or top+widget.winfo_height()>b:canvas.yview_moveto(max(0,min(1,(top-12)/height)))
    def owner(self):return self.app.learned_panel if self.family.get()=='Learned motion' else self.app.joint_panel
    def control_values(self):
        owner=self.owner();names=['actor','source','end_key','insert_start','insert_end','phase','width','height','matte','pool_mode','samples','deformation','allow_clip'];values=tuple((n,getattr(owner,n).get()) for n in names if isinstance(getattr(owner,n,None),tk.Variable));guide=owner.guide_combo.current() if hasattr(owner,'guide_combo') else None
        return (self.correction.get(),self.version.get(),self.family.get(),self.sample.get(),self.dx.get(),self.dy.get(),self.detail.get(),values,guide)
    def config(self):
        p=self.app.session.project;index=self.correction_combo.current()
        if not p or not 0<=index<len(self.ids):raise ValueError('Select a retained correction')
        if self.app.candidate_editor.context is not None:raise ValueError('Return to source from candidate editing first')
        owner=self.owner();a,b=int(owner.insert_start.get()),int(owner.insert_end.get());sample=int(self.sample.get());n=int(owner.samples.get()) if self.family.get()=='Joint motion' or owner.pool_mode.get() else 1
        if not 1<=n<=16 or not 1<=sample<=n or n>b-a:raise ValueError('Select one of1..16declared sample holds')
        cuts=[a+(b-a)*i//n for i in range(n+1)];start,end=cuts[sample-1:sample+1]
        if self.family.get()=='Learned motion':
            request=dict(actor_id=owner.actor.get(),source_slot=int(owner.source.get()),guide_slot=int(owner.end_key.get()),target_start=start,target_end=end,progress=float(owner.phase.get())*sample/n,working_size=[int(owner.width.get()),int(owner.height.get())],matte=[int(v) for v in owner.matte.get().split()]);family='learned'
        else:
            guide_id,g=owner.guide();clock=(start-g['source_slot'])/(g['guide_slot']-g['source_slot']);request=dict(guide_id=guide_id,mode=owner.deformation.get(),progress=trajectories.progress_at(g,clock),clock_time=clock,target_start=start,target_end=end,operation_id=None,allow_clip=owner.allow_clip.get());family='geometric'
        value=dict(correction_id=self.ids[index],version=int(self.version.get())-1,family=family,request=request,offset=[int(self.dx.get()),int(self.dy.get())]);rebind.working_copy(p,value);self.target_info.set(f"{family} · slots {start}…{end-1} · phase {request['progress']:.4g} · offset {value['offset']}");return value
    def rectangle(self):
        if not self.detail.get().strip():return None
        box=[int(v) for v in self.detail.get().split()];p=self.app.session.project
        if len(box)!=4 or not 0<=box[0]<box[2]<=p['canvas']['width'] or not 0<=box[1]<box[3]<=p['canvas']['height']:raise ValueError('Detail bounds must fit the canvas')
        return box
    def invalidate(self):
        if not hasattr(self,'generate_button'):return
        self.serial+=1;self.jobs.cancel();self.ready=None;self.preview_data=None;self.reviewed=False;self.checked=None;self.context=None
        if self.comparison:self.comparison.close();self.comparison=None
        self.update_buttons()
    def current(self,result):
        token=(id(self.app.session),self.app.session.counter,id(self.app.session.project),result['dependency_sha256']);signature=self.control_values()
        if not self.context or self.context!=(id(self.app.session),signature):return False
        if self.checked and self.checked[0]==token:return self.checked[1]
        try:valid=rebind.working_copy(self.app.session.project,result['config'])[3]==result['dependency_sha256']
        except (ValueError,KeyError,TypeError):valid=False
        self.checked=(token,valid);return valid
    def generate(self):
        config=self.config();self.rectangle();self.invalidate();self.context=(id(self.app.session),self.control_values());self.jobs.start('generate',self.app.session.project,settings=config,token=(id(self.app.session),self.serial));self.message.set('Generating a separate unapproved placement; source constraints unchanged.');self.update_buttons()
    def compare(self):
        if self.ready is None or not self.current(self.ready):raise ValueError('Generate a current rebind first')
        if self.preview_data:
            if self.comparison and not self.comparison.closed:return
            self.reviewed=False;self.comparison=RebindComparison(self.app.root,self.preview_data['frames'],self.compare_button,self.ready['config']['request']['target_start'],self.mark_review);self.update_buttons();return
        self.jobs.start('preview',self.app.session.project,result=self.ready,detail=self.rectangle(),token=(id(self.app.session),self.serial));self.message.set('Preparing retained-placement/raw/mapped comparison in background.');self.update_buttons()
    def mark_review(self,complete):self.reviewed=complete;self.update_buttons()
    def review(self,rejecting):
        if self.ready is None or not self.current(self.ready):raise ValueError('Generate a current rebind first')
        if not rejecting and (not self.preview_data or not self.reviewed):raise ValueError('Open and view both comparison modes at the target pose before acceptance')
        reason=self.reason.get().strip()
        if rejecting and not 1<=len(reason)<=240:raise ValueError('Record a1..240character rejection reason')
        self.jobs.start('reject' if rejecting else 'accept',self.app.session.project,result=self.ready,reason=reason,token=(id(self.app.session),self.serial));self.message.set('Rechecking review in an owned hidden process.');self.update_buttons()
    def cancel(self):self.invalidate();self.message.set('Cancellation requested. Private results retained; current drawing unchanged.')
    def refresh(self):
        if not hasattr(self,'correction_combo'):return
        p=self.app.session.project;rows=p.get('candidate_corrections',{}) if p else {};chosen=self.ids[self.correction_combo.current()] if 0<=self.correction_combo.current()<len(self.ids) else None;ids=list(rows)
        if ids!=self.ids:
            self.ids=ids;self.correction_combo.configure(values=[rows[i]['family']+' · '+rows[i]['actor_id']+' · '+i[:8] for i in ids])
            if chosen in ids:self.correction_combo.current(ids.index(chosen))
            elif ids:self.correction_combo.current(0)
            else:self.correction_combo.set('')
        self.update_buttons()
    def update_buttons(self):
        if not hasattr(self,'generate_button'):return
        busy=self.jobs.busy;editing=self.app.candidate_editor and self.app.candidate_editor.context is not None;ready=self.ready is not None
        self.generate_button.configure(state='normal' if self.ids and not busy and not editing else 'disabled');self.compare_button.configure(text='Open visual comparison' if self.preview_data else 'Prepare visual comparison',state='normal' if ready and not busy else 'disabled');self.accept_button.configure(state='normal' if ready and self.reviewed and not self.ready['previously_rejected'] and not busy else 'disabled');self.reject_button.configure(state='normal' if ready and not busy else 'disabled')
    def poll(self):
        if self.closed:return
        try:self.poll_once()
        except Exception as error:self.jobs.cancel();self.message.set('Rebind refused; work retained: '+str(error));self.update_buttons()
        finally:
            if not self.closed:self.ticket=self.app.root.after(50,self.poll)
    def poll_once(self):
        if self.context and self.context!=(id(self.app.session),self.control_values()):self.invalidate();self.message.set('Target controls/document changed. Generate again; source preserved.')
        if self.ready and not self.current(self.ready):self.invalidate();self.message.set('Selected source/correction changed. Rebind review is stale.')
        event=self.jobs.poll()
        if event:
            if event['token']!=(id(self.app.session),self.serial) or self.jobs.cancel_event.is_set():self.message.set('Cancelled/stale result retained privately; current drawing unchanged.')
            elif event['state']!='ready':self.message.set('Rebind '+event['state']+': '+event.get('error',''))
            elif event['operation']=='generate':
                if self.current(event['result']):self.ready=event['result'];self.recovery.set(event['directory']);self.message.set('Unapproved rebind ready. Prepare visual comparison; source unchanged.')
            elif self.ready and self.current(self.ready):
                if event['operation']=='preview':self.preview_data=event;self.recovery.set(event['preview_path']);self.message.set('Comparison ready. Open explicitly and view retained placement and fresh raw at the target pose.')
                else:
                    merged=merge_prepared(event['base'],event['prepared'],self.app.session.project);self.app.session.commit(merged,'reject-correction-rebind' if event['operation']=='reject' else 'accept-correction-rebind');receipt_error=None
                    try:atomic_write(Path(event['directory'])/'review.json',dict(state='committed-constraints-only',decision=event['operation'],revision=self.app.session.counter,artwork_approved=False))
                    except Exception as error:receipt_error=str(error)
                    rejected=event['operation']=='reject';self.invalidate();self.app.refresh();self.recovery.set(str(Path(event['directory'])/'prepared-source.aaa'));self.message.set(('Rejection saved; retained versions unchanged.' if rejected else 'Correction constraints rebound; generated artwork still unapproved. Undo is one action.')+(' Receipt could not be saved: '+receipt_error if receipt_error else ''))
        if self.jobs.busy:self.message.set('Background '+self.jobs.status().get('phase','rebinding')+'; source stays editable.')
        self.update_buttons()
    def close(self):
        if self.closed:return
        self.closed=True;self.jobs.shutdown()
        if self.comparison:self.comparison.close();self.comparison=None
        if getattr(self,'ticket',None):self.app.root.after_cancel(self.ticket);self.ticket=None
