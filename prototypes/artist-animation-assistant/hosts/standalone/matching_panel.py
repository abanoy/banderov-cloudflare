"""Own candidate review UI; no silent match adoption or artwork mutation."""
from copy import deepcopy
from pathlib import Path
import tempfile,uuid,tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText
from engine.correspondence import defaults
from engine.jobs import create_correspondence_job,read


class MatchingPanel:
    def __init__(self,motion):
        self.motion=motion;self.app=motion.app;self.result=None;self.decisions={};self.candidates={};self.job=None
        self.window=w=tk.Toplevel(motion.window);w.title('Image correspondence candidates');w.geometry('1000x620');w.minsize(900,600);w.protocol('WM_DELETE_WINDOW',self.close);w.bind('<Escape>',lambda e:self.close())
        top=ttk.Frame(w,padding=8);top.pack(fill='x');self.radius=tk.StringVar(value='4');self.search=tk.StringVar(value='32');self.max_error=tk.StringVar(value='.2');self.gap=tk.StringVar(value='.015');self.reverse=tk.StringVar(value='2');self.around=tk.StringVar(value='source')
        for label,var in [('Patch radius',self.radius),('Search radius',self.search),('Max error',self.max_error),('Min gap',self.gap),('Reverse tolerance',self.reverse)]:ttk.Label(top,text=label).pack(side='left');ttk.Entry(top,textvariable=var,width=5).pack(side='left',padx=3)
        ttk.Label(top,text='Around').pack(side='left');ttk.Combobox(top,textvariable=self.around,values=['source','current'],state='readonly',width=8).pack(side='left')
        orientation=ttk.Frame(w,padding=(8,0));orientation.pack(fill='x');self.orientation=tk.StringVar(value='Fixed')
        ttk.Label(orientation,text='Patch orientation').pack(side='left')
        self.orientation_combo=ttk.Combobox(orientation,textvariable=self.orientation,values=['Fixed','Quarter turns (0/90/180/270)'],state='readonly',width=29);self.orientation_combo.pack(side='left',padx=5)
        ttk.Label(orientation,text='Experimental; large moves may need current-target hints.').pack(side='left')
        self.generate_button=ttk.Button(w,text='Find candidate targets in approved guide image',command=lambda:self.app.guard(self.generate));self.generate_button.pack(fill='x',padx=8,pady=4)
        self.tree=ttk.Treeview(w,columns=('target','error','state','decision'),show='tree headings',height=8,selectmode='browse');self.tree.heading('#0',text='Source landmark')
        for column,label in [('target','Best target'),('error','Patch error'),('state','Evidence'),('decision','Pending review')]:self.tree.heading(column,text=label);self.tree.column(column,width=160)
        self.tree.column('#0',width=170);self.tree.pack(fill='both',expand=True,padx=8);self.tree.bind('<<TreeviewSelect>>',lambda e:self.select())
        choices=ttk.Frame(w,padding=8);choices.pack(fill='x');self.choice=tk.StringVar();self.combo=ttk.Combobox(choices,textvariable=self.choice,state='readonly',width=54);self.combo.pack(side='left',fill='x',expand=True);self.combo.bind('<<ComboboxSelected>>',lambda e:self.draw_candidate())
        self.use_button=ttk.Button(choices,text='Use selected candidate',command=lambda:self.app.guard(lambda:self.mark('accept')));self.use_button.pack(side='left',padx=3)
        self.reject_button=ttk.Button(choices,text='Reject selected candidate',command=lambda:self.app.guard(lambda:self.mark('reject')));self.reject_button.pack(side='left')
        controls=ttk.Frame(w,padding=8);controls.pack(fill='x');self.clear_button=ttk.Button(controls,text='Queue clear suggestions',command=lambda:self.app.guard(self.queue_clear));self.clear_button.pack(side='left')
        self.apply_button=ttk.Button(controls,text='Apply reviewed matches / rejections',command=lambda:self.app.guard(self.apply));self.apply_button.pack(side='left',padx=4)
        self.cancel_button=ttk.Button(controls,text='Reject / cancel job',command=self.app.reject);self.cancel_button.pack(side='left');ttk.Button(controls,text='Close',command=self.close).pack(side='right')
        self.details=ScrolledText(w,height=6,wrap='word');self.details.pack(fill='x',padx=8);self.status=ttk.Label(w,text='Find targets from image evidence, inspect alternatives, queue decisions, then Apply. Explicit unmatched points are untouched. Drawing pixels and hold timing never change here.',wraplength=870,padding=8);self.status.pack(fill='x')

    def settings(self):
        settings=dict(guide_id=self.motion.guide_id,patch_radius=int(self.radius.get()),search_radius=int(self.search.get()),max_error=float(self.max_error.get()),min_gap=float(self.gap.get()),reverse_tolerance=float(self.reverse.get()),around=self.around.get())
        if self.orientation.get()=='Quarter turns (0/90/180/270)':settings['rotation_mode']='quarter_turns'
        elif self.orientation.get()!='Fixed':raise ValueError('Select a supported patch orientation')
        return settings
    def generate(self):
        app=self.app
        if app.process and app.process.poll() is None:raise ValueError('A job is already running')
        self.motion.save();job=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex;create_correspondence_job(app.session.project,self.settings(),job)
        self.job=app.job=job;app.preview=None;self.result=None;self.decisions={};self.tree.delete(*self.tree.get_children());app.render();app.launch_job();self.status.configure(text='Local image matcher running. No guide point or drawing is changed until explicit review.')
    def show_result(self,result):
        if self.app.job!=self.job or (self.job/'applied-by-host.json').exists() or (self.job/'rejected-by-host.json').exists():return
        if self.result==result:return
        self.result=result;self.decisions={};self.show_rows();self.status.configure(text='Candidates ready. Clear means thresholds passed, not semantic certainty. Inspect the guide images and alternatives before applying.')
    def show_rows(self):
        selected=self.tree.selection();self.tree.delete(*self.tree.get_children())
        for row in self.result['rows']:
            best=row['alternatives'][0] if row['alternatives'] else None;decision=self.decisions.get(row['landmark_id'])
            self.tree.insert('','end',iid=row['landmark_id'],text=row['landmark_id'],values=(best['target'] if best else 'unknown',format(best['error'],'.4g') if best else '-',row['status'],(decision['decision']+' #'+str(decision['candidate_index']+1)) if decision else 'unreviewed'))
        if selected and self.tree.exists(selected[0]):self.tree.selection_set(selected[0]);self.select()
    def select(self):
        if not self.tree.selection() or self.result is None:return
        row=next(r for r in self.result['rows'] if r['landmark_id']==self.tree.selection()[0]);self.candidates={f"#{i+1}: {c['target']} / error {c['error']:.4g}"+(f" / patch turns {c['patch_quarter_turns']}" if 'patch_quarter_turns' in c else ''):i for i,c in enumerate(row['alternatives'])};self.combo.configure(values=list(self.candidates));self.choice.set(next(iter(self.candidates),''))
        text=['Landmark: '+row['landmark_id'],'Evidence: '+row['status'],'Alternative gap: '+str(row.get('alternative_gap')),'Reverse error: '+str(row.get('reverse_error')),'Excluded targets for these exact input drawings: '+str(row.get('excluded_targets',[]))]+row['warnings']+self.result['warnings'];self.details.delete('1.0','end');self.details.insert('1.0','\n'.join(text));self.draw_candidate()
    def draw_candidate(self):
        if self.result is None or not self.tree.selection() or self.choice.get() not in self.candidates:return
        row=next(r for r in self.result['rows'] if r['landmark_id']==self.tree.selection()[0]);target=row['alternatives'][self.candidates[self.choice.get()]]['target'];self.motion.draw()
        for role,xy in [('source',row['source']),('target',target)]:
            view,ow,oh=self.motion.transforms[role];sx=ow/(view[2]-view[0]);sy=oh/(view[3]-view[1]);x=5+(xy[0]-view[0])*sx;y=5+(xy[1]-view[1])*sy;r=self.settings()['patch_radius'];canvas=self.motion.canvases[role]
            canvas.create_rectangle(x-r*sx,y-r*sy,x+(r+1)*sx,y+(r+1)*sy,outline='#8a3eb5',width=2);canvas.create_text(x,y-10,text='candidate' if role=='target' else 'patch source',fill='#8a3eb5')

    def mark(self,decision):
        if not self.tree.selection() or self.choice.get() not in self.candidates:raise ValueError('Select a landmark and candidate to review')
        identity=self.tree.selection()[0];self.decisions[identity]=dict(landmark_id=identity,candidate_index=self.candidates[self.choice.get()],decision=decision);self.show_rows()
    def queue_clear(self):
        if self.result is None:raise ValueError('Generate and inspect candidates first')
        for row in self.result['rows']:
            if row['status']=='clear_by_thresholds':self.decisions[row['landmark_id']]=dict(landmark_id=row['landmark_id'],candidate_index=0,decision='accept')
        self.show_rows();self.status.configure(text='Clear candidates queued only. Apply is a separate explicit action; ambiguous/uninformative points remain unchanged.')
    def apply(self):
        if self.result is None or self.job is None:raise ValueError('Find and review image candidates first')
        if self.settings()!=read(self.job/'job.json')['settings'] or self.motion.definition()!=self.app.session.project['motion_guides'][self.motion.guide_id]:raise ValueError('Matching controls or pending guide edits changed; regenerate before review')
        self.app.session.review_matches(self.job,list(self.decisions.values()));self.app.preview=None;self.app.refresh();self.motion.load_guide();self.result=None;self.decisions={};self.status.configure(text='Reviewed matches and rejected alternatives saved with exact source hashes. Pixels/keys/holds unchanged; Undo reverses this one review. Regenerate to use the corrected guide.')
    def close(self):self.window.destroy();self.motion.draw();self.motion.match_button.focus_set()
