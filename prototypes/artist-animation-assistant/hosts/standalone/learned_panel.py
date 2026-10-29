"""Explicit optional learned-motion review controls; Tk only on caller thread."""
from pathlib import Path
import tkinter as tk
from tkinter import ttk
from engine import learned_motion as learned,learned_schedules as pools,schedules
from engine.jobs import atomic_write
from hosts.standalone.learned_schedule_jobs import LearnedScheduleJobs as LearnedJobs
from hosts.standalone.joint_jobs import merge_prepared
from hosts.standalone.joint_panel import JointPanel,MODES


class LearnedPanel:
    keep_visible=JointPanel.keep_visible
    token=JointPanel.token
    clear_comparison=JointPanel.clear_comparison
    invalidate=JointPanel.invalidate
    clear=JointPanel.clear
    def __init__(self,app,private_root):
        self.app=app;self.jobs=LearnedJobs(private_root);self.closed=False;self.serial=0;self.ready=None;self.preview_data=None;self.comparison=None;self.checked=None
        self.page=outer=ttk.Frame(app.tools);app.tools.add(outer,text='Learned motion')
        self.scroll=tk.Canvas(outer,width=235,height=400,highlightthickness=0,takefocus=True,yscrollincrement=18);self.scroll.pack(side='left',fill='both',expand=True)
        bar=ttk.Scrollbar(outer,orient='vertical',command=self.scroll.yview);bar.pack(side='right',fill='y');self.scroll.configure(yscrollcommand=bar.set)
        p=self.content=ttk.Frame(self.scroll,padding=6);window=self.scroll.create_window(0,0,window=p,anchor='nw');p.bind('<Configure>',lambda event:self.scroll.configure(scrollregion=self.scroll.bbox('all')));self.scroll.bind('<Configure>',lambda event:self.scroll.itemconfigure(window,width=max(215,event.width)))
        self.scroll.bind('<MouseWheel>',lambda event:self.scroll.yview_scroll(-1 if event.delta>0 else 1,'units'));self.scroll.bind('<Prior>',lambda event:self.scroll.yview_scroll(-1,'pages'));self.scroll.bind('<Next>',lambda event:self.scroll.yview_scroll(1,'pages'))
        ttk.Label(p,text='Optional local RIFE4.6 · CPU · two keys',wraplength=215).pack(fill='x')
        ttk.Label(p,text='May blur lines or miss expressions. No automatic approval. Geometry controls remain in Joint motion.',wraplength=215).pack(fill='x',pady=3)
        self.actor=tk.StringVar(master=app.root);self.source=tk.StringVar(master=app.root,value='0');self.end_key=tk.StringVar(master=app.root,value='6');self.insert_start=tk.StringVar(master=app.root,value='1');self.insert_end=tk.StringVar(master=app.root,value='2');self.phase=tk.StringVar(master=app.root,value='.5');self.width=tk.StringVar(master=app.root,value='640');self.height=tk.StringVar(master=app.root,value='360');self.matte=tk.StringVar(master=app.root,value='0 0 0');self.detail=tk.StringVar(master=app.root,value='');self.reason=tk.StringVar(master=app.root,value='Wrong shape or expression')
        self.actor_combo=ttk.Combobox(p,textvariable=self.actor,state='readonly',width=25);self.actor_combo.pack(fill='x');ttk.Button(p,text='Use selected layer / group',command=lambda:app.guard(self.use_selected)).pack(fill='x')
        def fields(label,variables):
            ttk.Label(p,text=label,wraplength=215).pack(anchor='w');row=ttk.Frame(p);row.pack(fill='x')
            for variable in variables:ttk.Entry(row,textvariable=variable,width=8).pack(side='left',fill='x',expand=True)
        fields('Input keys: source / end slot',[self.source,self.end_key]);fields('Insert hold: start / end exclusive',[self.insert_start,self.insert_end]);fields('Content phase (timing is separate)',[self.phase]);fields('Model width / height (outputs stay native)',[self.width,self.height]);fields('Transparent RGB matte: R G B',[self.matte]);fields('Optional detail x0 y0 x1 y1',[self.detail])
        self.pool_mode=tk.BooleanVar(master=app.root,value=False);self.samples=tk.StringVar(master=app.root,value='2');self.budget=tk.StringVar(master=app.root,value='4');self.budget_mode=tk.StringVar(master=app.root,value='Maximum')
        ttk.Checkbutton(p,text='Review a pose pool and drawing budget',variable=self.pool_mode).pack(fill='x');fields('Pool samples / actor-state budget',[self.samples,self.budget]);ttk.Combobox(p,textvariable=self.budget_mode,values=list(MODES),state='readonly',width=25).pack(fill='x');ttk.Label(p,text='Pool phases run up to Content phase. Source/end keys and declared events stay mandatory.',wraplength=215).pack(fill='x')
        self.generate_button=ttk.Button(p,text='Generate unapproved learned pose',command=lambda:app.guard(self.generate));self.generate_button.pack(fill='x',pady=3)
        self.choice_combo=ttk.Combobox(p,state='readonly',values=['Single pose'],width=25);self.choice_combo.current(0);self.choice_combo.pack(fill='x',pady=3);self.choice_combo.bind('<<ComboboxSelected>>',lambda event:self.choice_changed())
        self.compare_button=ttk.Button(p,text='Prepare original / proposal comparison',command=lambda:app.guard(self.compare));self.compare_button.pack(fill='x')
        self.edit_button=ttk.Button(p,text='Prepare editable candidate copy',command=lambda:app.guard(lambda:app.candidate_editor.prepare(self)));self.edit_button.pack(fill='x',pady=2)
        fields('Rejection reason',[self.reason]);row=ttk.Frame(p);row.pack(fill='x',pady=3);self.accept_button=ttk.Button(row,text='Accept pose',command=lambda:app.guard(lambda:self.review(False)));self.accept_button.pack(side='left',fill='x',expand=True);self.reject_button=ttk.Button(row,text='Reject',command=lambda:app.guard(lambda:self.review(True)));self.reject_button.pack(side='left',fill='x',expand=True)
        ttk.Button(p,text='Cancel work / clear comparison',command=self.clear).pack(fill='x')
        self.message=tk.StringVar(master=app.root,value='Uses an already configured, audited optional model. No automatic download.');ttk.Label(p,textvariable=self.message,wraplength=215).pack(fill='x',pady=4)
        for variable in [self.actor,self.source,self.end_key,self.insert_start,self.insert_end,self.phase,self.width,self.height,self.matte,self.detail,self.pool_mode,self.samples,self.budget,self.budget_mode]:variable.trace_add('write',lambda *args:self.invalidate())
        def follow(widget):
            widget.bind('<FocusIn>',lambda event:self.keep_visible(event.widget),add='+')
            for child in widget.winfo_children():follow(child)
        follow(p);self.refresh_actors();self.ticket=app.root.after(50,self.poll)
    def refresh_actors(self):
        p=self.app.session.project;ids=list(p['layers']) if p and p['schema_version']=='0.2' else [];self.actor_combo.configure(values=ids)
        if self.actor.get() not in ids:self.actor.set('')
        self.update_buttons()
    def use_selected(self):
        p=self.app.session.project
        if not p or p['schema_version']!='0.2':raise ValueError('Open an explicit compact0.2project first')
        self.actor.set(self.app.session.layer_id);self.source.set(str(self.app.session.slot));self.width.set(str(learned.defaults(p,self.actor.get(),0,1,0,1)['working_size'][0]));self.height.set(str(learned.defaults(p,self.actor.get(),0,1,0,1)['working_size'][1]))
        self.message.set('Selected actor/source loaded. Choose an approved end key and an interior hold.')
    def settings(self):
        p=self.app.session.project
        if not p:raise ValueError('Open a compact project first')
        s=dict(actor_id=self.actor.get(),source_slot=int(self.source.get()),guide_slot=int(self.end_key.get()),target_start=int(self.insert_start.get()),target_end=int(self.insert_end.get()),progress=float(self.phase.get()),working_size=[int(self.width.get()),int(self.height.get())],matte=[int(v) for v in self.matte.get().split()])
        # A pool's bounding interval is not a generated pose. Check corrections
        # against each declared sample below, preserving overlap guards there.
        (learned._base_subject if self.pool_mode.get() else learned.subject)(p,s)
        if not self.pool_mode.get():return s
        count=int(self.samples.get());length=s['target_end']-s['target_start']
        if not 1<=count<=min(16,length):raise ValueError('Choose1..16samples, each with at least one exposure slot')
        cuts=[s['target_start']+i*length//count for i in range(count+1)]
        requests=[dict(s,target_start=cuts[i],target_end=cuts[i+1],progress=s['progress']*(i+1)/count) for i in range(count)]
        config=dict(schedules.defaults(p,s['actor_id']),start=s['source_slot'],end=s['guide_slot']+1,budget_count=int(self.budget.get()),budget_mode=MODES[self.budget_mode.get()]);result=dict(schedule=config,learned_samples=requests);pools.subject(p,result);return result
    def rectangle(self):
        if not self.detail.get().strip():return None
        box=[int(v) for v in self.detail.get().split()];p=self.app.session.project
        if len(box)!=4 or not 0<=box[0]<box[2]<=p['canvas']['width'] or not 0<=box[1]<box[3]<=p['canvas']['height']:raise ValueError('Detail bounds must fit the canvas')
        return box
    def choice(self):
        if self.ready is None:raise ValueError('Generate a learned result first')
        if 'learned_samples' not in self.ready['settings']:return None
        index=self.choice_combo.current();choices=self.ready['schedule']['candidates']
        if not 0<=index<len(choices):raise ValueError('Choose a feasible learned schedule; repair budget conflicts first')
        return choices[index]['id']
    def rejected_choice(self):
        if self.ready is None:return False
        if 'learned_samples' not in self.ready['settings']:return self.ready['previously_rejected']
        try:return schedules.candidate(self.ready['schedule'],self.choice())['previously_rejected']
        except ValueError:return True
    def choice_changed(self):
        self.serial+=1;self.jobs.cancel();self.clear_comparison();self.update_buttons()
    def current(self,result):
        key=(self.token(),result['dependency_sha256'])
        if self.checked and self.checked[0]==key:return self.checked[1]
        try:valid=(pools.subject(self.app.session.project,result['settings']) if 'learned_samples' in result['settings'] else learned.subject(self.app.session.project,result['settings'])[0])==result['dependency_sha256']
        except (ValueError,KeyError,TypeError):valid=False
        self.checked=(key,valid);return valid
    def generate(self):
        settings=self.settings();self.rectangle();self.invalidate();self.jobs.start('generate',self.app.session.project,settings=settings,token=(id(self.app.session),self.serial));self.message.set('Generating in a hidden local CPU process. Artwork stays available.');self.update_buttons()
    def compare(self):
        if self.ready is None or not self.current(self.ready):raise ValueError('Generate a current learned pose first')
        if self.ready.get('unsafe_reasons'):raise ValueError('Repair protected conflicts/loss before preview: '+'; '.join(self.ready['unsafe_reasons']))
        self.choice()
        if self.preview_data and self.preview_data['token']==self.token():
            from hosts.standalone.joint_compare import JointComparison
            if self.comparison and not self.comparison.closed:return
            self.comparison=JointComparison(self.app.root,self.preview_data['frames'],self.compare_button,title='Unapproved learned pose comparison',description='UNAPPROVED — original / learned pose, including both input keys. Watch for blurred lines and expression changes.',labels=('Original animation','Learned pose in original timing'),detail_text='Supplied detail bounds');self.preview_data['opened']=True;self.update_buttons();return
        self.jobs.start('preview',self.app.session.project,result=self.ready,detail=self.rectangle(),choice=self.choice(),token=(id(self.app.session),self.serial,self.token()));self.message.set('Rechecking in an isolated process and rendering comparison.');self.update_buttons()
    def review(self,rejecting):
        if self.ready is None or not self.current(self.ready):raise ValueError('Generate a current learned pose first')
        if not rejecting and (not self.preview_data or not self.preview_data.get('opened') or self.preview_data['token']!=self.token()):raise ValueError('Prepare and explicitly open comparison before acceptance')
        reason=self.reason.get().strip()
        if rejecting and not 1<=len(reason)<=240:raise ValueError('Record a1..240character rejection reason')
        self.jobs.start('reject' if rejecting else 'accept',self.app.session.project,result=self.ready,reason=reason,choice=self.choice(),token=(id(self.app.session),self.serial));self.message.set('Verifying review in an isolated process. Painting stays available.');self.update_buttons()
    def update_buttons(self):
        if not hasattr(self,'generate_button'):return
        busy=self.jobs.busy;has=bool(self.actor.get());ready=self.ready is not None and ('learned_samples' not in self.ready['settings'] or bool(self.ready['schedule']['candidates']));safe=ready and not self.ready.get('unsafe_reasons',[])
        self.generate_button.configure(state='normal' if has and not busy else 'disabled');self.compare_button.configure(text='Open original / proposal comparison' if self.preview_data else 'Prepare original / proposal comparison',state='normal' if safe and not busy else 'disabled');self.reject_button.configure(state='normal' if ready and not busy else 'disabled');self.accept_button.configure(state='normal' if safe and self.preview_data and self.preview_data.get('opened') and not self.rejected_choice() and not busy else 'disabled')
        editor=getattr(self.app,'candidate_editor',None)
        self.edit_button.configure(text='Enter prepared candidate copy' if editor and editor.ready_for(self) else 'Prepare editable candidate copy',state='normal' if self.preview_data and editor and not editor.jobs.busy and editor.context is None and not busy else 'disabled')
    def poll(self):
        if self.closed:return
        try:self.poll_once()
        except Exception as error:self.jobs.cancel();self.message.set('Learned review refused: '+str(error));self.update_buttons()
        finally:
            if not self.closed:self.ticket=self.app.root.after(50,self.poll)
    def poll_once(self):
        if self.closed:return
        if self.ready and not self.current(self.ready):self.invalidate();self.message.set('Selected inputs changed. Generate again; artwork preserved.')
        if self.preview_data and self.preview_data['token']!=self.token():self.clear_comparison();self.message.set('Editing context changed; prepare comparison again.')
        event=self.jobs.poll()
        if event:
            token=event['token'];valid=token[0]==id(self.app.session) and token[1]==self.serial and not self.jobs.cancel_event.is_set()
            if not valid:self.message.set('Stale/cancelled result retained privately; current artwork unchanged.')
            elif event['state']!='ready':self.message.set('Learned '+event['state']+': '+event.get('error',''))
            elif self.current(event['result']):
                if event['operation']=='generate':
                    self.ready=event['result']
                    if 'learned_samples' in self.ready['settings']:
                        candidates=self.ready['schedule']['candidates'];self.choice_combo.configure(values=[c['label']+(' (same timing)' if c['same_as'] else '')+(' [rejected]' if c['previously_rejected'] else '') for c in candidates])
                        if candidates:self.choice_combo.current(0)
                        else:self.choice_combo.set('')
                        counts=self.ready['counts'];self.message.set('; '.join(self.ready['schedule']['conflicts']) or f"{counts['motion_samples_evaluated']} model evaluations / {counts['new_raster_assets_computed']} raster assets / {counts['available_actor_states']} available actor states. {counts['skipped_no_budget_capacity']} samples skipped: no budget capacity.")
                    else:
                        self.choice_combo.configure(values=['Single pose']);self.choice_combo.current(0);self.message.set('Repair: '+'; '.join(self.ready['unsafe_reasons']) if self.ready['unsafe_reasons'] else ('Previously rejected; change inputs/settings.' if self.ready['previously_rejected'] else f"One proposed pose / {len(self.ready['outputs'])} raster assets. Prepare comparison; nothing approved."))
                elif event['operation']=='preview':
                    if token[2]==self.token():self.preview_data=dict(frames=event['frames'],token=self.token(),path=event['preview_path'],project=event['preview_project']);self.message.set('Comparison ready. Open explicitly; no window opens automatically.')
                    else:self.message.set('Context changed during comparison; prepare again.')
                else:
                    merged=merge_prepared(event['base'],event['prepared'],self.app.session.project)
                    self.app.session.commit(merged,'reject-learned-motion' if event['operation']=='reject' else 'accept-learned-motion')
                    receipt_error=None
                    try:atomic_write(Path(event['directory'])/'review.json',dict(state='committed',revision=self.app.session.counter,decision=event['operation']))
                    except Exception as error:receipt_error=str(error)
                    self.invalidate();self.app.refresh()
                    message='Rejection recorded; artwork unchanged.' if event['operation']=='reject' else 'Chosen learned timing accepted; source keys preserved. Undo is one action.'
                    if receipt_error:message+=' Review committed, but receipt could not be saved: '+receipt_error
                    self.message.set(message)
        if self.jobs.busy:self.message.set('Background '+self.jobs.status().get('phase','work'))
        self.update_buttons()
    def close(self):
        if self.closed:return
        self.closed=True;self.jobs.shutdown();self.clear_comparison()
        if getattr(self,'ticket',None):self.app.root.after_cancel(self.ticket);self.ticket=None
