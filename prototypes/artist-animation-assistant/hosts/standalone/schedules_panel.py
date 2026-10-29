"""Own event/budget controls and paired clock-driven schedule playback.

REF-KRITA-TIMELINE / REF-OPENTOONZ-LEVEL-EDIT: exposure/transport precedent.
No external UI implementation; proposals remain uncommitted until review.
"""
from pathlib import Path
import time,tempfile,uuid,tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText
from engine.schedules import defaults,save_constraints,subject,candidate,preview
from engine.jobs import create_schedule_job,read
from engine.packed_render import render,png_bytes

class SchedulesPanel:
    def __init__(self,app):
        self.app=app;self.result=None;self.job=None;self.timer=None;self.checked_counter=None;self.frames=[];self.photos={};self.preview_cache={}
        self.window=w=tk.Toplevel(app.root);w.title('Experimental drawing schedules and required events');w.geometry('960x820');w.minsize(900,760);w.transient(app.root);w.protocol('WM_DELETE_WINDOW',self.close);w.bind('<Escape>',lambda ev:self.close())
        top=ttk.Frame(w,padding=8);top.pack(fill='x');self.actor=tk.StringVar();self.actors={}
        for i,node in app.session.project['layers'].items():
            if node.get('visible',True):self.actors[str(len(self.actors)+1)+'. '+node['name']]=i
        current=app.session.layer_id
        while app.session.project['layers'][current].get('parent_id') is not None:current=app.session.project['layers'][current]['parent_id']
        self.actor_combo=ttk.Combobox(top,textvariable=self.actor,values=list(self.actors),state='readonly',width=32);self.actor_combo.pack(side='left');self.actor.set(next((label for label,i in self.actors.items() if i==current),next(iter(self.actors))));self.actor_combo.bind('<<ComboboxSelected>>',lambda ev:app.guard(self.load))
        self.holds_button=ttk.Button(top,text='Edit actor holds',command=lambda:app.guard(self.edit_holds));self.holds_button.pack(side='left',padx=4)
        self.demo_button=ttk.Button(top,text='Original timing diagnostic',command=lambda:app.guard(self.demo));self.demo_button.pack(side='left',padx=4);ttk.Button(top,text='Close',command=self.close).pack(side='right')
        row=ttk.Frame(w,padding=(8,0));row.pack(fill='x');self.start=tk.StringVar(value='0');self.end=tk.StringVar(value=str(app.session.project['shot']['duration_frames']));self.count=tk.StringVar(value='4');self.mode=tk.StringVar(value='maximum')
        for label,var in [('Start',self.start),('End (exclusive)',self.end),('Actor-state budget',self.count)]:ttk.Label(row,text=label).pack(side='left');ttk.Entry(row,textvariable=var,width=6).pack(side='left',padx=4)
        self.mode_combo=ttk.Combobox(row,textvariable=self.mode,values=['maximum','target','preference'],state='readonly',width=13);self.mode_combo.pack(side='left',padx=4)
        ttk.Label(w,text='Counts distinct editable actor states: ink + color together, repeated content once. Stored assets and playback slots are separate.',wraplength=860,padding=(8,4)).pack(fill='x')
        keys=ttk.Frame(w,padding=(8,0));keys.pack(fill='x');ttk.Label(keys,text='Additional required key slots').pack(side='left');self.keys=tk.StringVar();ttk.Entry(keys,textvariable=self.keys).pack(side='left',fill='x',expand=True,padx=5)
        ttk.Label(w,text='Required events: slot  length  type  label (one per line). Types: contact, impact, reversal, extension, settle, custom.',wraplength=860,padding=(8,4)).pack(fill='x')
        self.event_ids=[];self.events=ScrolledText(w,height=3,wrap='none');self.events.pack(fill='x',padx=8)
        controls=ttk.Frame(w,padding=8);controls.pack(fill='x');self.save_button=ttk.Button(controls,text='Save required keys / events',command=lambda:app.guard(self.save));self.save_button.pack(side='left');self.generate_button=ttk.Button(controls,text='Propose schedules',command=lambda:app.guard(self.generate));self.generate_button.pack(side='left',padx=4);self.cancel_button=ttk.Button(controls,text='Cancel job',command=app.cancel);self.cancel_button.pack(side='left')
        self.tree=ttk.Treeview(w,columns=('states','holds','deviation','review'),show='tree headings',height=3,selectmode='browse');self.tree.heading('#0',text='Timing strategy');self.tree.column('#0',width=250)
        for key,label,width in [('states','Actor states',95),('holds','Holds',70),('deviation','Content change',125),('review','Review / equivalence',230)]:self.tree.heading(key,text=label);self.tree.column(key,width=width)
        self.tree.pack(fill='x',padx=8);self.tree.bind('<<TreeviewSelect>>',lambda ev:app.guard(self.select))
        images=ttk.Frame(w,padding=8);images.pack(fill='both',expand=True);self.canvases={}
        for key,label in [('current','Current timeline'),('proposed','Proposed timeline')]:
            pane=ttk.Frame(images);pane.pack(side='left',fill='both',expand=True);ttk.Label(pane,text=label).pack();canvas=tk.Canvas(pane,height=160,bg='#eceef2',highlightthickness=1);canvas.pack(fill='both',expand=True);self.canvases[key]=canvas
        transport=ttk.Frame(w,padding=(8,0));transport.pack(fill='x');self.play_button=ttk.Button(transport,text='Play comparison at shot fps',command=lambda:app.guard(self.toggle_play));self.play_button.pack(side='left');self.cursor=tk.IntVar(value=0);self.scrub=ttk.Scale(transport,from_=0,to=app.session.project['shot']['duration_frames']-1,variable=self.cursor,command=lambda value:app.guard(self.draw));self.scrub.pack(side='left',fill='x',expand=True,padx=5);self.time_label=ttk.Label(transport,text='');self.time_label.pack(side='right')
        review=ttk.Frame(w,padding=8);review.pack(fill='x');self.accept_button=ttk.Button(review,text='Accept selected timing',command=lambda:app.guard(lambda:self.apply(False)));self.accept_button.pack(side='left');self.reject_button=ttk.Button(review,text='Reject selected timing',command=lambda:app.guard(lambda:self.apply(True)));self.reject_button.pack(side='left',padx=4)
        self.details=ScrolledText(w,height=5,wrap='word');self.details.pack(fill='x',padx=8,pady=(0,8));self.load()
    def edit_holds(self):
        from hosts.standalone.timing_panel import TimingPanel
        self.stop()
        if getattr(self,'timing_panel',None) and self.timing_panel.window.winfo_exists():self.timing_panel.window.lift();return
        self.timing_panel=TimingPanel(self)
    def actor_id(self):return self.actors[self.actor.get()]
    def definition(self):
        rows=[]
        for n,line in enumerate(self.events.get('1.0','end').splitlines()):
            if not line.strip():continue
            parts=line.split(maxsplit=3)
            if len(parts)!=4:raise ValueError('Each event needs slot length type label')
            slot,length,kind,label=parts
            while len(self.event_ids)<=n:self.event_ids.append('event-'+uuid.uuid4().hex)
            rows.append(dict(id=self.event_ids[n],slot=int(slot),length=int(length),kind=kind,label=label))
        return dict(required_slots=[int(v) for v in self.keys.get().replace(',',' ').split()],events=rows)
    def settings(self):return dict(defaults(self.app.session.project,self.actor_id()),start=int(self.start.get()),end=int(self.end.get()),budget_count=int(self.count.get()),budget_mode=self.mode.get())
    def load(self):
        self.stop();self.result=None;self.preview_cache.clear();self.tree.delete(*self.tree.get_children());definition=self.app.session.project.get('schedule_constraints',{}).get(self.actor_id(),dict(required_slots=[],events=[]));self.event_ids=[e['id'] for e in definition['events']];self.keys.set(' '.join(map(str,definition['required_slots'])));self.events.delete('1.0','end');self.events.insert('1.0','\n'.join(f"{e['slot']} {e['length']} {e['kind']} {e['label']}" for e in definition['events']));self.cursor.set(0);self.draw()
    def save(self):
        q=save_constraints(self.app.session.project,self.actor_id(),self.definition());self.app.session.commit(q,'save-required-timing-events');self.app.refresh();self.result=None;self.checked_counter=None;self.tree.delete(*self.tree.get_children());self.details.delete('1.0','end');self.details.insert('1.0','Required keys/events saved; dependent schedule proposals are stale. Drawing pixels and timeline unchanged.')
    def generate(self):
        if self.app.process and self.app.process.poll() is None:raise ValueError('A worker is already running')
        saved=self.app.session.project.get('schedule_constraints',{}).get(self.actor_id(),dict(required_slots=[],events=[]))
        if self.definition()!=saved:raise ValueError('Save changed required keys/events before scheduling')
        self.stop();job=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex;create_schedule_job(self.app.session.project,self.settings(),job);self.job=self.app.job=job;self.result=None;self.preview_cache.clear();self.app.preview=None;self.tree.delete(*self.tree.get_children());self.app.launch_job();self.details.delete('1.0','end');self.details.insert('1.0','Local schedule worker running; current exposures remain untouched.');self.draw()
    def show_result(self,result):
        if self.job!=self.app.job or (self.job/'applied-by-host.json').exists() or (self.job/'rejected-by-host.json').exists() or self.result==result:return
        self.stop();self.result=result;self.checked_counter=None;self.preview_cache.clear();self.tree.delete(*self.tree.get_children())
        for c in result['candidates']:
            note='Previously rejected' if c['previously_rejected'] else ('Same timing as '+', '.join(c['same_as']) if c['same_as'] else 'Unreviewed')
            self.tree.insert('','end',iid=c['id'],text=c['label'],values=(c['distinct_actor_states'],c['exposure_occurrences'],format(c['content_deviation'],'.4g'),note))
        if result['candidates']:self.tree.selection_set(result['candidates'][0]['id']);self.app.guard(self.select)
        else:self.details.delete('1.0','end');self.details.insert('1.0','\n'.join(result['conflicts']+['Required slot '+str(row['slot'])+': '+', '.join(row['reasons']) for row in result['required']]+result['warnings']))
    def valid(self):
        if self.result is None:return
        if self.settings()!=self.result['settings'] or self.definition()!=self.result['constraints']:raise ValueError('Schedule controls/events changed; regenerate before preview/review')
        token=(id(self.app.session),self.app.session.counter,self.app.session.project['project_id'])
        if self.checked_counter!=token:
            if subject(self.app.session.project,self.settings())[0]!=self.result['dependency_sha256']:raise ValueError('Stale schedule inputs; regenerate after dependent edits')
            self.checked_counter=token;self.preview_cache.clear()
    def has_selection(self):return bool(self.tree.selection())
    def selected(self):
        if self.result is None or not self.tree.selection():raise ValueError('Select a generated schedule first')
        return candidate(self.result,self.tree.selection()[0])
    def select(self):
        self.stop();self.valid();c=self.selected();self.cursor.set(self.result['settings']['start']);self.details.delete('1.0','end');lines=[c['label'],f"{c['distinct_actor_states']} editable actor states; {c['exposure_occurrences']} held occurrences; {c['raster_assets_reused']} raster assets reused; zero new drawings."]
        lines += [f"{s['start']}–{s['start']+s['length']}: source pose at {s['source_slot']}" for s in c['segments']]+self.result['warnings'];self.details.insert('1.0','\n'.join(lines));self.draw()
    def draw(self):
        if not self.window.winfo_exists():return
        self.valid();project=self.app.session.project;slot=int(self.cursor.get());slot=max(0,min(project['shot']['duration_frames']-1,slot));selected=self.selected() if self.result and self.has_selection() else None
        for key,canvas in self.canvases.items():
            cache_key=(self.app.session.counter,key,slot,selected['id'] if selected else None)
            if cache_key not in self.preview_cache:
                q=preview(project,self.result,selected['id']) if key=='proposed' and selected else project;w,h=project['canvas']['width'],project['canvas']['height'];scale=min(256/w,220/h,1);ow,oh=max(1,round(w*scale)),max(1,round(h*scale));raw=render(q,slot,(ow,oh))[2];encoded=png_bytes(ow,oh,raw)
                if len(self.preview_cache)>=128 or sum(len(v[2]) for v in self.preview_cache.values())+len(encoded)>8*1024*1024:self.preview_cache.clear()
                self.preview_cache[cache_key]=(ow,oh,encoded)
            ow,oh,data=self.preview_cache[cache_key];photo=tk.PhotoImage(master=self.window,data=data);self.photos[key]=photo;canvas.delete('all');canvas.create_image(5,5,image=photo,anchor='nw')
        fps=project['shot']['fps'];self.time_label.configure(text=f"Slot {slot} · {fps['numerator']}/{fps['denominator']} fps")
    def stop(self):
        if self.timer is not None:self.window.after_cancel(self.timer);self.timer=None
        if hasattr(self,'play_button'):self.play_button.configure(text='Play comparison at shot fps')
    def toggle_play(self):
        if self.timer is not None:self.stop();return
        self.valid();self.selected();self.started=time.monotonic();self.first_slot=int(self.cursor.get());self.frames=[];self.play_button.configure(text='Pause comparison');self.tick()
    def tick(self):
        self.timer=None
        try:
            self.valid();fps=self.app.session.project['shot']['fps'];rate=fps['numerator']/fps['denominator'];elapsed=time.monotonic()-self.started;slot=(self.first_slot+int(elapsed*rate))%self.app.session.project['shot']['duration_frames'];self.cursor.set(slot);self.frames.append(dict(elapsed=elapsed,slot=slot));self.draw();deadline=self.started+(math_floor(elapsed*rate)+1)/rate;self.timer=self.window.after(max(1,round((deadline-time.monotonic())*1000)),self.tick)
        except (ValueError,tk.TclError) as error:self.stop();self.app.status.set(str(error))
    def apply(self,rejecting):
        self.stop();self.valid();choice=self.selected()['id'];self.app.session.apply_schedule(self.job,choice,rejecting);self.app.refresh();self.result=None;self.checked_counter=None;self.tree.delete(*self.tree.get_children());self.details.delete('1.0','end');self.details.insert('1.0','Rejected timing retained in history.' if rejecting else 'Timing accepted; source drawings retained, required keys/events unchanged. Undo restores earlier timing.');self.draw()
    def demo(self):
        from hosts.standalone.schedule_fixtures import fixture
        if not self.app.may_discard():return
        self.stop();self.app.replace_session(__import__('hosts.standalone.session',fromlist=['Session']).Session(fixture()));self.actors={'Original scarf actor':'actor'};self.actor_combo.configure(values=list(self.actors));self.actor.set(next(iter(self.actors)));self.start.set('0');self.end.set('24');self.count.set('4');self.mode.set('maximum');self.scrub.configure(to=23);self.load()
    def close(self):
        if getattr(self,'timing_panel',None) and self.timing_panel.window.winfo_exists():self.timing_panel.close()
        self.stop();self.window.destroy();self.preview_cache.clear();self.photos.clear()
        self.app.root.focus_force();self.app.schedule_button.focus_set()

def math_floor(value):return int(value//1)
