"""Original native hold editor; existing own paired shot-clock player reused."""
import uuid,tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText
from engine.timing import inspect,propose,accept
from hosts.standalone.schedules_panel import SchedulesPanel


class TimingPanel:
    draw=SchedulesPanel.draw
    stop=SchedulesPanel.stop
    toggle_play=SchedulesPanel.toggle_play
    tick=SchedulesPanel.tick

    def __init__(self,parent):
        self.parent=parent;self.app=app=parent.app;self.actor=parent.actor_id();self.result=None;self.timer=None;self.frames=[];self.photos={};self.preview_cache={};self.checked_counter=None
        self.window=w=tk.Toplevel(parent.window);w.title('Experimental actor hold correction');w.geometry('860x650');w.minsize(820,620);w.transient(parent.window);w.protocol('WM_DELETE_WINDOW',self.close);w.bind('<Escape>',lambda ev:self.close())
        ttk.Label(w,text='Move one boundary for the whole selected actor. Ink and color stay together. Duration and all other cuts stay fixed.',wraplength=790,padding=8).pack(fill='x')
        top=ttk.Frame(w,padding=8);top.pack(fill='x');ttk.Label(top,text='Current boundary').pack(side='left');self.cut=tk.StringVar();self.cuts=ttk.Combobox(top,textvariable=self.cut,state='readonly',width=7);self.cuts.pack(side='left',padx=4);self.cuts.bind('<<ComboboxSelected>>',lambda ev:app.guard(self.selection))
        ttk.Label(top,text='Move to slot').pack(side='left');self.target=tk.StringVar();self.target_entry=ttk.Spinbox(top,from_=1,to=599,textvariable=self.target,width=7);self.target_entry.pack(side='left',padx=4)
        self.preview_button=ttk.Button(top,text='Preview hold edit',command=lambda:app.guard(self.generate));self.preview_button.pack(side='left',padx=4);self.reload_button=ttk.Button(top,text='Reload timeline',command=lambda:app.guard(self.load));self.reload_button.pack(side='left',padx=4)
        eventrow=ttk.Frame(w,padding=(8,0));eventrow.pack(fill='x');ttk.Label(eventrow,text='Required event boundary').pack(side='left');self.event=tk.StringVar();self.event_combo=ttk.Combobox(eventrow,textvariable=self.event,state='readonly',width=40);self.event_combo.pack(side='left',padx=4);self.snap_button=ttk.Button(eventrow,text='Use slot',command=lambda:app.guard(self.snap));self.snap_button.pack(side='left')
        self.details=ScrolledText(w,height=7,wrap='word');self.details.pack(fill='x',padx=8,pady=6)
        images=ttk.Frame(w,padding=8);images.pack(fill='both',expand=True);self.canvases={}
        for key,label in [('current','Current timeline'),('proposed','Hold preview')]:
            pane=ttk.Frame(images);pane.pack(side='left',fill='both',expand=True);ttk.Label(pane,text=label).pack();canvas=tk.Canvas(pane,bg='#eceef2',height=160);canvas.pack(fill='both',expand=True);self.canvases[key]=canvas
        transport=ttk.Frame(w,padding=8);transport.pack(fill='x');self.play_button=ttk.Button(transport,text='Play comparison at shot fps',command=lambda:app.guard(self.toggle_play));self.play_button.pack(side='left');self.cursor=tk.IntVar(value=0);self.scrub=ttk.Scale(transport,from_=0,to=app.session.project['shot']['duration_frames']-1,variable=self.cursor,command=lambda v:app.guard(self.draw));self.scrub.pack(side='left',fill='x',expand=True,padx=4);self.time_label=ttk.Label(transport);self.time_label.pack(side='right')
        review=ttk.Frame(w,padding=8);review.pack(fill='x');self.accept_button=ttk.Button(review,text='Accept hold edit',command=lambda:app.guard(self.apply));self.accept_button.pack(side='left');self.discard_button=ttk.Button(review,text='Discard preview',command=lambda:app.guard(self.discard));self.discard_button.pack(side='left',padx=4);ttk.Button(review,text='Close',command=self.close).pack(side='right');self.load()

    def has_selection(self):return bool(self.result)
    def selected(self):
        if not self.result:raise ValueError('Preview a hold edit first')
        return self.result['candidates'][0]
    def valid(self):
        if not self.result:return
        if self.parent.actor_id()!=self.actor or self.result['request']!=dict(actor_id=self.actor,cut=int(self.cut.get()),new_cut=int(self.target.get())):raise ValueError('Hold controls changed; preview again')
        token=(id(self.app.session),self.app.session.counter)
        if self.checked_counter!=token:
            if inspect(self.app.session.project,self.actor)['dependency_sha256']!=self.result['dependency_sha256']:raise ValueError('Stale hold preview; reload and preview again')
            self.checked_counter=token;self.preview_cache.clear()
    def load(self):
        self.stop();self.result=None;self.preview_cache.clear();self.info=inspect(self.app.session.project,self.actor);values=[str(b['cut']) for b in self.info['boundaries']];self.cuts.configure(values=values);self.cut.set(values[0] if values else '')
        self.event_slots={}
        for event in self.info['events']:
            for slot,role in [(event['slot'],'start'),(event['slot']+event['length'],'end')]:self.event_slots[str(slot)+' '+event['label']+' '+role]=slot
        self.event_combo.configure(values=list(self.event_slots));self.event.set(next(iter(self.event_slots),''));self.selection()
    def selection(self):
        self.stop();self.result=None;self.preview_cache.clear();self.details.delete('1.0','end')
        if not self.cut.get():self.details.insert('1.0','No internal actor boundaries. Add or generate another drawing first.');self.draw();return
        b=next(b for b in self.info['boundaries'] if b['cut']==int(self.cut.get()));self.target.set(self.cut.get());self.cursor.set(int(self.cut.get()));text='Allowed slots: '+', '.join(map(str,b['legal_slots']))+'\nOther cuts and shot duration stay fixed; at least one slot remains in each adjacent hold.\n'
        text+='\n'.join('Required '+e['label']+': slots '+str(e['slot'])+'–'+str(e['slot']+e['length']-1) for e in self.info['events']);text+='\nEvents preserve supplied samples, not inferred physical contacts. Geometry and drawing count stay unchanged.';self.details.insert('1.0',text);self.draw()
    def snap(self):
        if self.event.get() not in self.event_slots:raise ValueError('No saved event boundary selected')
        self.stop();self.target.set(str(self.event_slots[self.event.get()]))
    def generate(self):
        self.stop();self.result=None;self.preview_cache.clear()
        if self.parent.actor_id()!=self.actor:raise ValueError('Actor changed; close and reopen this editor')
        try:self.result=propose(self.app.session.project,self.actor,int(self.cut.get()),int(self.target.get()))
        except ValueError:
            self.draw();raise
        self.checked_counter=None;self.cursor.set(min(int(self.cut.get()),int(self.target.get())));c=self.selected();self.details.insert('end','\nPreview: '+c['label']+'; '+str(c['distinct_actor_states'])+' distinct editable actor states, '+str(c['exposure_occurrences'])+' holds; zero new drawings.');self.draw()
    def discard(self):self.stop();self.result=None;self.preview_cache.clear();self.draw()
    def apply(self):
        self.stop();self.valid();self.selected();q=accept(self.app.session.project,self.result,'hold-'+uuid.uuid4().hex);self.app.session.commit(q,'accept-actor-hold');self.app.preview=None;self.app.refresh();self.parent.load();self.load();self.app.status.set('Actor hold accepted; duration/events/keys/corrections retained. Undo restores timing.')
    def close(self):
        self.stop();self.window.destroy();self.photos.clear();self.preview_cache.clear()
        if self.parent.window.winfo_exists():self.parent.window.focus_force();self.parent.holds_button.focus_set()
