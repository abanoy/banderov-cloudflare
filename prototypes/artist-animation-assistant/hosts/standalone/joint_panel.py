"""Joint schedules and independent trajectory controls; Tk caller thread only."""
from copy import deepcopy
from pathlib import Path
import hashlib,tkinter as tk
from tkinter import ttk
from engine import motion,joint_motion as joint
from engine.jobs import atomic_write
from hosts.standalone.joint_jobs import JointJobs,merge_prepared

EASING={'Linear':[0,0,1,1],'Slow start':[.42,0,1,1],'Slow finish':[0,0,.58,1],'Ease in/out':[.42,0,.58,1],'Hold then ease':[.42,0,.58,1]}
MODES={'Maximum':'maximum','Exact target':'target','Preference':'preference'}


class JointPanel:
    def __init__(self,app,private_root):
        self.app=app;self.jobs=JointJobs(private_root);self.closed=False;self.serial=0;self.ready=None;self.preview_data=None;self.comparison=None;self.ids=[];self.landmarks=[];self.choices=[];self.checked=None;self.loaded_session=None
        self.page=outer=ttk.Frame(app.tools);app.tools.add(outer,text='Joint motion')
        self.scroll=tk.Canvas(outer,width=235,height=400,highlightthickness=0,takefocus=True,yscrollincrement=18);self.scroll.pack(side='left',fill='both',expand=True)
        bar=ttk.Scrollbar(outer,orient='vertical',command=self.scroll.yview);bar.pack(side='right',fill='y');self.scroll.configure(yscrollcommand=bar.set)
        p=self.content=ttk.Frame(self.scroll,padding=6);window=self.scroll.create_window(0,0,window=p,anchor='nw');p.bind('<Configure>',lambda event:self.scroll.configure(scrollregion=self.scroll.bbox('all')));self.scroll.bind('<Configure>',lambda event:self.scroll.itemconfigure(window,width=max(215,event.width)))
        self.scroll.bind('<MouseWheel>',lambda event:self.scroll.yview_scroll(-1 if event.delta>0 else 1,'units'));self.scroll.bind('<Prior>',lambda event:self.scroll.yview_scroll(-1,'pages'));self.scroll.bind('<Next>',lambda event:self.scroll.yview_scroll(1,'pages'))
        ttk.Button(p,text='Create / edit correspondences',command=lambda:app.guard(app.open_motion)).pack(fill='x')
        self.guide_combo=ttk.Combobox(p,state='readonly',width=25);self.guide_combo.pack(fill='x',pady=3);self.guide_combo.bind('<<ComboboxSelected>>',lambda event:app.guard(self.load_guide))
        self.guide_info=tk.StringVar(master=app.root,value='Save a source/end motion guide first.');ttk.Label(p,textvariable=self.guide_info,wraplength=215).pack(fill='x')
        self.start=tk.StringVar(master=app.root,value='0');self.end=tk.StringVar(master=app.root,value='1');self.insert_start=tk.StringVar(master=app.root,value='1');self.insert_end=tk.StringVar(master=app.root,value='2');self.samples=tk.StringVar(master=app.root,value='2');self.budget=tk.StringVar(master=app.root,value='4');self.budget_mode=tk.StringVar(master=app.root,value='Maximum')
        self.deformation=tk.StringVar(master=app.root,value='similarity');ttk.Label(p,text='Deformation model').pack(anchor='w');self.deformation_combo=ttk.Combobox(p,textvariable=self.deformation,values=['rigid','similarity','translation'],state='readonly',width=25);self.deformation_combo.pack(fill='x')
        self.allow_clip=tk.BooleanVar(master=app.root,value=False);ttk.Checkbutton(p,text='Allow canvas-edge ink clipping',variable=self.allow_clip).pack(anchor='w');ttk.Label(p,text='Protected marks still block clipping.',wraplength=215).pack(fill='x')
        def fields(label,variables):
            ttk.Label(p,text=label).pack(anchor='w');row=ttk.Frame(p);row.pack(fill='x')
            for var in variables:ttk.Entry(row,textvariable=var,width=7).pack(side='left',fill='x',expand=True)
        fields('Compare shot slots: start / end exclusive',[self.start,self.end]);fields('Insert within source hold: start / end',[self.insert_start,self.insert_end]);fields('Candidate poses / drawing budget',[self.samples,self.budget])
        ttk.Combobox(p,textvariable=self.budget_mode,values=list(MODES),state='readonly',width=25).pack(fill='x',pady=3)
        self.generate_button=ttk.Button(p,text='Generate poses + sparse schedules',command=lambda:app.guard(self.generate));self.generate_button.pack(fill='x')
        self.choice_combo=ttk.Combobox(p,state='readonly',width=25);self.choice_combo.pack(fill='x',pady=3);self.choice_combo.bind('<<ComboboxSelected>>',lambda event:self.choice_changed())
        self.compare_button=ttk.Button(p,text='Prepare paired comparison',command=lambda:app.guard(self.compare));self.compare_button.pack(fill='x')
        self.edit_button=ttk.Button(p,text='Prepare editable candidate copy',command=lambda:app.guard(lambda:app.candidate_editor.prepare(self)));self.edit_button.pack(fill='x',pady=2)
        row=ttk.Frame(p);row.pack(fill='x',pady=3);self.accept_button=ttk.Button(row,text='Accept chosen timing',command=lambda:app.guard(lambda:self.review(False)));self.accept_button.pack(side='left',fill='x',expand=True);self.reject_button=ttk.Button(row,text='Reject',command=lambda:app.guard(lambda:self.review(True)));self.reject_button.pack(side='left',fill='x',expand=True)
        ttk.Button(p,text='Cancel work / clear comparison',command=self.clear).pack(fill='x')
        self.message=tk.StringVar(master=app.root,value='Generated poses remain unapproved until joint review.');ttk.Label(p,textvariable=self.message,wraplength=215).pack(fill='x',pady=3)
        ttk.Separator(p).pack(fill='x',pady=5);ttk.Label(p,text='Spatial path / point contact').pack(anchor='w')
        self.landmark_combo=ttk.Combobox(p,state='readonly',width=25);self.landmark_combo.pack(fill='x');self.arc=tk.StringVar(master=app.root,value='0');self.release=tk.StringVar(master=app.root,value='.25');fields('Arc lift pixels / contact release phase',[self.arc,self.release])
        for label,callback in [('Save arc for selected landmark',self.save_arc),('Pin point, then release',self.save_contact),('Remove point-contact constraint',self.remove_contact)]:ttk.Button(p,text=label,command=lambda f=callback:app.guard(f)).pack(fill='x',pady=1)
        ttk.Label(p,text='Timing changes progress, not the path.').pack(anchor='w');self.easing=tk.StringVar(master=app.root,value='Linear');ttk.Combobox(p,textvariable=self.easing,values=list(EASING),state='readonly',width=25).pack(fill='x');self.hold=tk.StringVar(master=app.root,value='.25');fields('Start hold fraction (Hold then ease)',[self.hold]);ttk.Button(p,text='Save independent timing curve',command=lambda:app.guard(self.save_timing)).pack(fill='x',pady=2)
        ttk.Label(p,text='Point contacts constrain supplied geometry, not inferred surfaces or exact resampled pixels. No new anatomy or artist-quality guarantee.',wraplength=215).pack(fill='x',pady=3)
        for variable in [self.start,self.end,self.insert_start,self.insert_end,self.samples,self.budget,self.budget_mode,self.deformation,self.allow_clip]:variable.trace_add('write',lambda *args:self.invalidate())
        def follow(widget):
            widget.bind('<FocusIn>',lambda event:self.keep_visible(event.widget),add='+')
            for child in widget.winfo_children():follow(child)
        follow(p);self.refresh_guides();self.ticket=app.root.after(50,self.poll)
    def keep_visible(self,widget):
        y=0;current=widget
        while current is not self.content:
            y+=current.winfo_y();current=current.master
            if current is None:return
        top=self.scroll.canvasy(0);height=max(1,self.scroll.winfo_height());total=max(1,self.content.winfo_reqheight())
        if y<top:self.scroll.yview_moveto(max(0,y-4)/total)
        elif y+widget.winfo_height()>top+height:self.scroll.yview_moveto(max(0,y+widget.winfo_height()-height+4)/total)
    def token(self):return (id(self.app.session),self.app.session.counter,id(self.app.session.project))
    def clear_comparison(self):
        self.preview_data=None
        if self.comparison:self.comparison.close();self.comparison=None
    def invalidate(self):
        self.serial+=1;self.jobs.cancel();self.ready=None;self.checked=None;self.clear_comparison()
        editor=getattr(self.app,'candidate_editor',None)
        if editor:editor.invalidate_owner(self)
        self.update_buttons()
    def clear(self):
        self.invalidate();self.message.set('Cancelled / cleared. Current artwork is unchanged.')
    def refresh_guides(self):
        project=self.app.session.project;guides=project.get('motion_guides',{}) if project else {};selected=self.guide_combo.current();old=self.ids[selected] if 0<=selected<len(self.ids) else None;self.ids=list(guides)
        self.guide_combo.configure(values=[guides[k]['name'] for k in self.ids])
        if old in self.ids and self.loaded_session==id(self.app.session):self.guide_combo.current(self.ids.index(old));self.sync_landmarks(guides[old])
        elif self.ids:self.guide_combo.current(0);self.load_guide()
        else:self.guide_combo.set('');self.landmarks=[];self.landmark_combo.configure(values=[]);self.landmark_combo.set('');self.guide_info.set('Save a source/end motion guide first.')
        self.update_buttons()
    def guide(self):
        index=self.guide_combo.current()
        if not self.app.session.project or not 0<=index<len(self.ids):raise ValueError('Save/select a motion guide first')
        identity=self.ids[index];return identity,self.app.session.project['motion_guides'][identity]
    def sync_landmarks(self,g):
        selected=self.landmark_combo.get();self.guide_info.set(f"Source slot {g['source_slot']} → guide slot {g['guide_slot']}. Explicit matches, not inferred anatomy.")
        self.landmarks=[h['id'] for h in g['handles'] if h['enabled'] and h['source'] is not None and h['target'] is not None];self.landmark_combo.configure(values=self.landmarks)
        if self.landmarks:self.landmark_combo.current(self.landmarks.index(selected) if selected in self.landmarks else 0)
        else:self.landmark_combo.set('')
    def load_guide(self):
        identity,g=self.guide();self.invalidate();self.loaded_session=id(self.app.session);self.sync_landmarks(g)
        project=self.app.session.project;start=g['source_slot'];self.start.set(str(start));self.end.set(str((g['guide_slot']+1) if g['guide_slot'] is not None and g['guide_slot']>start else project['shot']['duration_frames']))
        try:stop=min(motion._exposure(project,lid,start)['start']+motion._exposure(project,lid,start)['length'] for lid in motion._actor_layers(project,g['actor_id']))
        except ValueError:stop=start+1
        self.insert_start.set(str(start+1));self.insert_end.set(str(stop));self.samples.set(str(max(1,min(2,stop-start-1))))
    def settings(self):
        identity,g=self.guide();a,b=int(self.insert_start.get()),int(self.insert_end.get());count=int(self.samples.get())
        if g['guide_slot'] is None or g['guide_slot']<=g['source_slot']:raise ValueError('Choose a later end key in the correspondence editor')
        if not 1<=count<=16 or not 0<a<b or count>b-a:raise ValueError('Use1..16candidate poses, with at least one slot each inside the source hold')
        cuts=[a+(b-a)*i//count for i in range(count+1)];samples=[]
        for start,end in zip(cuts,cuts[1:]):
            phase=(start-g['source_slot'])/(g['guide_slot']-g['source_slot']);samples.append(motion.request_at_time(self.app.session.project,identity,phase,start,end,mode=self.deformation.get(),allow_clip=self.allow_clip.get()))
        from engine.schedules import UNIT
        value=dict(schedule=dict(actor_id=g['actor_id'],start=int(self.start.get()),end=int(self.end.get()),budget_mode=MODES[self.budget_mode.get()],budget_count=int(self.budget.get()),budget_unit=UNIT),motion_samples=samples);joint.subject(self.app.session.project,value);return value
    def generate(self):
        settings=self.settings();self.invalidate();self.jobs.start('generate',self.app.session.project,settings=settings,token=(id(self.app.session),self.serial,None));self.message.set('Generating unapproved pose pool and schedules in background.');self.update_buttons()
    def choice(self):
        index=self.choice_combo.current()
        if self.ready is None or not 0<=index<len(self.choices):raise ValueError('Generate/select a feasible schedule first')
        return self.choices[index]
    def choice_changed(self):
        self.jobs.cancel();self.clear_comparison();self.update_buttons()
    def current(self,result):
        key=(self.token(),result['dependency_sha256'])
        if self.checked and self.checked[0]==key:return self.checked[1]
        try:valid=joint.subject(self.app.session.project,result['settings'])==result['dependency_sha256']
        except (ValueError,KeyError,TypeError):valid=False
        self.checked=(key,valid);return valid
    def compare(self):
        c=self.choice()
        if not self.current(self.ready):raise ValueError('Source or guide changed; generate again')
        if self.preview_data and self.preview_data['choice']==c['id'] and self.preview_data['token']==self.token():
            from hosts.standalone.joint_compare import JointComparison
            if self.comparison and not self.comparison.closed:return
            self.comparison=JointComparison(self.app.root,self.preview_data['frames'],self.compare_button);self.preview_data['opened']=True;self.update_buttons();return
        self.jobs.start('preview',self.app.session.project,result=self.ready,choice=c['id'],token=(id(self.app.session),self.serial,c['id'],self.token()));self.message.set('Rendering read-only paired comparison in background.');self.update_buttons()
    def review(self,rejecting):
        c=self.choice()
        if not self.current(self.ready):raise ValueError('Source or guide changed; generate again')
        if not rejecting and (not self.preview_data or not self.preview_data.get('opened') or self.preview_data['choice']!=c['id'] or self.preview_data['token']!=self.token()):raise ValueError('Prepare and open the chosen comparison before acceptance')
        self.jobs.start('reject' if rejecting else 'accept',self.app.session.project,result=self.ready,choice=c['id'],token=(id(self.app.session),self.serial,c['id']));self.message.set('Verifying review in background; drawing remains available.');self.update_buttons()
    def poll(self):
        if self.closed:return
        try:self.poll_once()
        except Exception as error:
            self.jobs.cancel();self.message.set('Joint review refused: '+str(error));self.update_buttons()
        finally:
            if not self.closed:self.ticket=self.app.root.after(50,self.poll)
    def poll_once(self):
        if self.closed:return
        if self.ready and not self.current(self.ready):self.invalidate();self.message.set('Source/guide changed. Generate again; artwork was not replaced.')
        if self.preview_data and self.preview_data['token']!=self.token():self.clear_comparison();self.message.set('Context changed; prepare comparison again. Joint proposals remain available.')
        event=self.jobs.poll()
        if event:
            token=event['token'];valid=(token[0]==id(self.app.session) and token[1]==self.serial and not self.jobs.cancel_event.is_set())
            if not valid:self.message.set('Stale or cancelled joint result retained privately; current artwork is unchanged.')
            elif event['state']!='ready':self.message.set('Joint '+event['state']+': '+event.get('error',''))
            elif event['operation']=='generate':
                result=event['result']
                if self.current(result):
                    self.ready=result;self.choices=result['schedule']['candidates'];self.choice_combo.configure(values=[c['label']+(' (same timing)' if c['same_as'] else '')+(' [rejected]' if c['previously_rejected'] else '') for c in self.choices])
                    if self.choices:self.choice_combo.current(0)
                    counts=result['counts'];self.message.set('; '.join(result['schedule']['conflicts']) if result['schedule']['conflicts'] else f"{counts['motion_samples_evaluated']} generated pose samples / {counts['new_raster_assets_computed']} raster assets. Choose timing; previews stay unapproved.")
            elif self.current(event['result']):
                if event['operation']=='preview':
                    if token[2]==self.choice()['id'] and token[3]==self.token():self.preview_data=dict(choice=token[2],frames=event['frames'],token=self.token(),path=event['preview_path'],project=event['preview_project']);self.message.set('Comparison ready. Open it explicitly; generated poses are still unapproved.')
                    else:self.message.set('Context/choice changed during comparison; prepare again.')
                elif token[2]==self.choice()['id']:
                    merged=merge_prepared(event['base'],event['prepared'],self.app.session.project);self.app.session.commit(merged,'reject-joint-schedule' if event['operation']=='reject' else 'accept-joint-schedule');atomic_write(Path(event['directory'])/'review.json',dict(state='committed',revision=self.app.session.counter,decision=event['operation']));self.invalidate();self.app.refresh();self.message.set('Rejected timing saved.' if event['operation']=='reject' else 'Chosen timing accepted; only exposed generated assets approved. Undo is one action.')
        if self.jobs.busy:self.message.set('Background '+self.jobs.status().get('phase','work')+' · '+str(self.jobs.status().get('checkpoints',0))+' checkpoints')
        self.update_buttons()
    def update_buttons(self):
        if not hasattr(self,'generate_button'):return
        busy=self.jobs.busy;has=bool(self.ids);self.generate_button.configure(state='normal' if has and not busy else 'disabled');ready=self.ready is not None and bool(self.choices)
        self.compare_button.configure(text='Open paired comparison' if self.preview_data else 'Prepare paired comparison',state='normal' if ready and not busy else 'disabled');self.reject_button.configure(state='normal' if ready and not busy else 'disabled');self.accept_button.configure(state='normal' if ready and self.preview_data and self.preview_data.get('opened') and not busy else 'disabled')
        editor=getattr(self.app,'candidate_editor',None)
        self.edit_button.configure(text='Enter prepared candidate copy' if editor and editor.ready_for(self) else 'Prepare editable candidate copy',state='normal' if self.preview_data and editor and not editor.jobs.busy and editor.context is None and not busy else 'disabled')
    def edit(self,change):
        identity,g=self.guide();project=self.app.session.project;motion._actor_layers(project,g['actor_id']);node=g['actor_id']
        while node is not None:
            if project['layers'][node].get('locked') or not project['layers'][node].get('visible',True):raise ValueError('Unlock/show actor and ancestors before changing its guide')
            node=project['layers'][node].get('parent_id')
        definition=deepcopy(g);change(definition);updated=motion.save_guide(project,identity,definition);self.invalidate();self.app.session.commit(updated,'edit-joint-motion-controls');self.app.refresh();self.message.set('Independent motion controls saved. Undo is available.')
    def landmark(self,g):
        index=self.landmark_combo.current()
        if not 0<=index<len(self.landmarks):raise ValueError('Select a matched landmark')
        return next(h for h in g['handles'] if h['id']==self.landmarks[index])
    def segment(self,h,height,start=0):
        source,target=h['source'],h['target'];return dict(end_progress=1,control1=[source[0]+(target[0]-source[0])/3,source[1]+(target[1]-source[1])/3-height],control2=[source[0]+2*(target[0]-source[0])/3,source[1]+2*(target[1]-source[1])/3-height],end=target[:])
    def save_arc(self):
        height=float(self.arc.get());motion.trajectories.number(height,-256,256)
        def change(g):
            h=self.landmark(g);g.setdefault('trajectories',{})[h['id']]=[self.segment(h,height)]
        self.edit(change)
    def save_contact(self):
        release=float(self.release.get());motion.trajectories.number(release,.001,1);height=float(self.arc.get());motion.trajectories.number(height,-256,256)
        def change(g):
            h=self.landmark(g);source=h['source'];static=dict(end_progress=release,control1=source[:],control2=source[:],end=source[:])
            if release==1 and source!=h['target']:raise ValueError('A full-path contact requires matching source/end positions')
            g.setdefault('trajectories',{})[h['id']]=[static]+([self.segment(h,height)] if release<1 else [])
            g['contacts']=[c for c in g.get('contacts',[]) if c['landmark_id']!=h['id']]+[dict(id='contact-'+hashlib.sha256(h['id'].encode()).hexdigest()[:16],landmark_id=h['id'],start_progress=0,end_progress=release,position=source[:])]
        self.edit(change)
    def remove_contact(self):
        def change(g):
            h=self.landmark(g);g['contacts']=[c for c in g.get('contacts',[]) if c['landmark_id']!=h['id']]
        self.edit(change)
    def save_timing(self):
        mode=self.easing.get();curve=EASING[mode]
        def change(g):
            g['timing_map']=[dict(end_time=1,end_progress=1,easing=curve[:])]
            if mode=='Hold then ease':
                hold=float(self.hold.get());motion.trajectories.number(hold,.001,.95);g['timing_map'].insert(0,dict(end_time=hold,end_progress=0,easing=[0,0,1,1]))
        self.edit(change)
    def close(self):
        if self.closed:return
        self.closed=True;self.jobs.cancel();self.clear_comparison()
        if getattr(self,'ticket',None):self.app.root.after_cancel(self.ticket);self.ticket=None
