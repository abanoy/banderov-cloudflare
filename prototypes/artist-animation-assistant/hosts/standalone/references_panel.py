"""Own local reference panel; artist annotations remain separate from artwork."""
from pathlib import Path
import json,tempfile,tkinter as tk,uuid
from tkinter import ttk,filedialog
from tkinter.scrolledtext import ScrolledText
from engine.references import add_reference,edit_reference,correct_part,set_depth,plane
from engine.jobs import create_reference_job,read
from engine.packed_render import png_bytes
import numpy as np


class ReferencePanel:
    def __init__(self,app):
        self.app=app;self.window=w=tk.Toplevel(app.root);w.title('Character references and part identities');w.geometry('1000x740');w.minsize(900,700)
        self.window.protocol('WM_DELETE_WINDOW',self.close);w.bind('<Escape>',lambda e:self.close())
        top=ttk.Frame(w,padding=8);top.pack(fill='x');ttk.Label(top,text='Local project references • embedded source retained • training/upload permission separate').pack(side='left');ttk.Button(top,text='Close',command=self.close).pack(side='right')
        body=ttk.Frame(w,padding=8);body.pack(fill='both',expand=True);left=ttk.Frame(body);left.pack(side='left',fill='y',padx=(0,10));right=ttk.Frame(body);right.pack(side='left',fill='both',expand=True)
        def button(parent,label,action):
            b=ttk.Button(parent,text=label,command=lambda:app.guard(action));b.pack(fill='x',pady=2);return b
        self.import_button=button(left,'Import local reference PNG',self.import_image)
        self.list=tk.Listbox(left,height=3,exportselection=False,width=38);self.list.pack(fill='x');self.list.bind('<<ListboxSelect>>',lambda e:app.guard(self.load))
        self.character=tk.StringVar(value='character');self.view=tk.StringVar(value='front');self.crop=tk.StringVar(value='0 0 64 64');self.part=tk.StringVar(value='part');self.bbox=tk.StringVar(value='0 0 64 64');self.swatch=tk.StringVar(value='32 32')
        for label,var in [('Character ID',self.character),('Reference view',self.view),('Character crop x0 y0 x1 y1',self.crop),('Part ID (same across views)',self.part),('Part box x0 y0 x1 y1',self.bbox),('Color anchor x y',self.swatch)]:
            ttk.Label(left,text=label).pack(anchor='w')
            if var is self.part:
                self.part_combo=ttk.Combobox(left,textvariable=var,width=38);self.part_combo.pack(fill='x');self.part_combo.bind('<<ComboboxSelected>>',lambda e:app.guard(self.load))
            else:ttk.Entry(left,textvariable=var,width=38).pack(fill='x')
        self.enabled=tk.BooleanVar(value=True);ttk.Checkbutton(left,text='Use this reference',variable=self.enabled).pack(anchor='w')
        self.save_button=button(left,'Save crop / view / part anchor',self.save)
        self.remove_part_button=button(left,'Remove selected part annotation',self.remove_part)
        self.archive_button=button(left,'Remove active reference (retain source)',self.archive)
        ttk.Label(left,text='Click image to set anchor. Drag to set a part box; coordinates stay in reference pixels. A crop may contain one view from a larger sheet.',wraplength=280).pack(pady=4)
        self.canvas=tk.Canvas(right,bg='white',height=240,highlightthickness=1);self.canvas.pack(fill='both',expand=True)
        self.canvas.bind('<Configure>',lambda e:app.guard(self.draw))
        self.canvas.bind('<Button-1>',self.begin);self.canvas.bind('<B1-Motion>',self.drag);self.canvas.bind('<ButtonRelease-1>',self.end);self.drag_start=None
        self.region=tk.StringVar();self.target_character=tk.StringVar(value='character');self.target_view=tk.StringVar(value='any');self.override=tk.StringVar(value='');self.bounds=tk.StringVar(value='0 0 '+str(app.session.project['canvas']['width'])+' '+str(app.session.project['canvas']['height']))
        form=ttk.Frame(right);form.pack(fill='x')
        self.region_combo=None
        for index,(label,var) in enumerate([('Accepted region',self.region),('Character ID',self.target_character),('Target view / any',self.target_view),('Part override / blank',self.override),('Target character bounds x0 y0 x1 y1',self.bounds)]):
            ttk.Label(form,text=label).grid(row=index,column=0,sticky='w')
            if index==0:self.region_combo=ttk.Combobox(form,textvariable=var,state='readonly',width=42);self.region_combo.grid(row=index,column=1,sticky='ew')
            else:ttk.Entry(form,textvariable=var,width=42).grid(row=index,column=1,sticky='ew')
        form.columnconfigure(1,weight=1)
        self.use=tk.BooleanVar(value=True);self.propagate=tk.BooleanVar(value=False)
        ttk.Checkbutton(right,text='Condition proposal on enabled reference views',variable=self.use).pack(anchor='w')
        ttk.Checkbutton(right,text='Also update explicitly bound same-character parts',variable=self.propagate).pack(anchor='w')
        row=ttk.Frame(right);row.pack(fill='x');self.preview_button=button(row,'Preview assignment',self.preview);self.accept_button=button(row,'Accept reviewed assignment',self.accept)
        row=ttk.Frame(right);row.pack(fill='x');self.correct_button=ttk.Button(row,text='Keep corrected part ID',command=lambda:app.guard(self.correct));self.correct_button.pack(side='left',fill='x',expand=True)
        self.depth=tk.StringVar(value='1');ttk.Spinbox(row,from_=-1000,to=1000,textvariable=self.depth,width=5).pack(side='left');self.depth_button=ttk.Button(row,text='Set fill depth',command=lambda:app.guard(self.depth_apply));self.depth_button.pack(side='left')
        self.details=ScrolledText(right,height=5,wrap='word');self.details.pack(fill='x',pady=4)
        self.status=ttk.Label(w,text='Choose an accepted fill region. Reference-free operation keeps current colors. All changes require review.',wraplength=880,padding=6);self.status.pack(fill='x')
        self.refresh();self.window.after_idle(self.draw)

    @staticmethod
    def numbers(var,count):
        values=[int(v) for v in var.get().replace(',',' ').split()]
        if len(values)!=count:raise ValueError('Enter '+str(count)+' whole source-pixel coordinates')
        return values

    def identity(self):
        if not self.list.curselection():raise ValueError('Select an active reference')
        identity=self.ids[self.list.curselection()[0]]
        if identity not in self.app.session.project.get('references',{}):raise ValueError('Reference set changed; reopen the panel')
        return identity

    def refresh(self,selected=None):
        self.ids=list(self.app.session.project.get('references',{}));self.list.delete(0,'end')
        for i in self.ids:
            r=self.app.session.project['references'][i];self.list.insert('end',r['name']+' / '+r['view']+(' [off]' if not r['enabled'] else ''))
        previous=getattr(self,'region_choices',{}).get(self.region.get(),self.region.get())
        self.region_choices={str(index+1)+'. '+self.app.session.project['layers'][r['fill_layer']]['name']+' ['+i[-8:]+']':i for index,(i,r) in enumerate(self.app.session.project.get('fill_regions',{}).items())}
        self.region_combo.configure(values=list(self.region_choices))
        self.region.set(next((label for label,i in self.region_choices.items() if i==previous),next(iter(self.region_choices),'')))
        if self.ids:self.list.selection_set(self.ids.index(selected) if selected in self.ids else 0);self.load()
        else:self.canvas.delete('all')

    def commit(self,project,action):
        self.app.session.commit(project,action);self.app.refresh();self.app.status.set(action+'; source/previous versions retained. Undo is available.')

    def import_image(self):
        path=filedialog.askopenfilename(parent=self.window,filetypes=[('Reference RGB/RGBA8 PNG','*.png')])
        if not path:return
        identifier='reference-'+uuid.uuid4().hex
        p=add_reference(self.app.session.project,identifier,'Local reference '+str(len(self.ids)+1),self.character.get(),self.view.get(),Path(path).read_bytes());self.commit(p,'add-local-project-reference');self.refresh(identifier)

    def load(self):
        r=self.app.session.project['references'][self.identity()];self.character.set(r['character_id']);self.view.set(r['view']);self.crop.set(' '.join(map(str,r['crop'])));self.enabled.set(r['enabled']);self.bbox.set(self.crop.get())
        self.part_combo.configure(values=list(r['parts']))
        if r['parts']:
            pid=self.part.get() if self.part.get() in r['parts'] else next(iter(r['parts']));self.part.set(pid);self.bbox.set(' '.join(map(str,r['parts'][pid]['bbox'])));self.swatch.set(' '.join(map(str,r['parts'][pid]['swatch'])))
        self.draw()

    def save(self):
        identity=self.identity();p=edit_reference(self.app.session.project,identity,character=self.character.get(),view=self.view.get(),crop=self.numbers(self.crop,4),enabled=self.enabled.get(),part_id=self.part.get(),bbox=self.numbers(self.bbox,4),swatch=self.numbers(self.swatch,2));self.commit(p,'edit-reference-crop-part-anchor');self.refresh(identity)

    def remove_part(self):
        identity=self.identity();self.commit(edit_reference(self.app.session.project,identity,part_id=self.part.get(),remove_part=True),'remove-reference-part-annotation');self.refresh(identity)

    def archive(self):
        self.commit(edit_reference(self.app.session.project,self.identity(),archive=True),'remove-active-reference-retain-source');self.refresh()

    def draw(self):
        if not self.window.winfo_exists() or not self.ids:return
        r=self.app.session.project['references'][self.identity()];p=plane(r);cw,ch=max(1,self.canvas.winfo_width()),max(1,self.canvas.winfo_height());s=min((cw-10)/p.width,(ch-10)/p.height,1);ow,oh=max(1,round(p.width*s)),max(1,round(p.height*s))
        a=np.frombuffer(p.region_bytes(),np.uint8).reshape(p.height,p.width,4);raw=a[(np.arange(oh)*p.height//oh)[:,None],(np.arange(ow)*p.width//ow)[None,:]].tobytes();self.photo=tk.PhotoImage(master=self.window,data=png_bytes(ow,oh,raw));self.canvas.delete('all');self.canvas.create_image(5,5,image=self.photo,anchor='nw');self.transform=(p.width,p.height,ow,oh)
        crop=r['crop'];self.canvas.create_rectangle(5+crop[0]*ow/p.width,5+crop[1]*oh/p.height,5+crop[2]*ow/p.width,5+crop[3]*oh/p.height,outline='#b84972',width=2)
        for pid,part in r['parts'].items():
            b=part['bbox'];self.canvas.create_rectangle(5+b[0]*ow/p.width,5+b[1]*oh/p.height,5+b[2]*ow/p.width,5+b[3]*oh/p.height,outline='#cb7b27');self.canvas.create_text(5+b[0]*ow/p.width,5+b[1]*oh/p.height,text=pid,anchor='nw',fill='#a65312')

    def point(self,event):
        w,h,ow,oh=self.transform;return [min(w-1,max(0,int((event.x-5)*w/ow))),min(h-1,max(0,int((event.y-5)*h/oh)))]
    def begin(self,event):
        if not self.ids:return
        self.drag_start=self.point(event);self.swatch.set(' '.join(map(str,self.drag_start)))
    def drag(self,event):
        if self.drag_start is None:return
        x,y=self.point(event);sx,sy=self.drag_start;self.bbox.set(f'{min(x,sx)} {min(y,sy)} {max(x,sx)+1} {max(y,sy)+1}')
    def end(self,event):self.drag_start=None

    def region_id(self):return self.region_choices.get(self.region.get(),self.region.get())

    def request(self):return dict(region_id=self.region_id(),character_id=self.target_character.get(),view=self.target_view.get(),target_bounds=self.numbers(self.bounds,4),part_override=self.override.get() or None,use_references=self.use.get(),propagate_bound=self.propagate.get())

    def preview(self):
        app=self.app
        if app.process and app.process.poll() is None:raise ValueError('A job is already running')
        request=self.request();app.preview=None;app.reference_preview=None;app.fill_preview=None;app.cleanup_preview=None
        app.job=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex;create_reference_job(app.session.project,request,app.job);app.job_layer=app.session.layer_id;app.launch_job();self.status.configure(text='Local reference worker running. Review alternatives and affected regions before accepting.')

    def show_result(self,result):
        if not self.window.winfo_exists():return
        selected=result['selected'];lines=[]
        if selected:
            rgba=selected['rgba'];lines += ['Proposed part: '+selected['part_id']+' / view '+selected['view'],'Color: #'+''.join(f'{c:02x}' for c in rgba[:3])+' / alpha '+str(rgba[3]),'Affected fills:']
            for identity in result['updates']:
                region=self.app.session.project.get('fill_regions',{}).get(identity,{})
                lines.append('  '+self.app.session.project['layers'].get(region.get('fill_layer'),{}).get('name',identity))
            lines += ['', 'Matching alternatives (geometric distance, lower is closer):']
            lines += ['  '+r['part_id']+' / '+r['view']+' / '+format(r['score'],'.5g') for r in result['alternatives']]
        lines += ['', 'Review warnings:']+result['warnings']
        self.details.configure(state='normal');self.details.delete('1.0','end');self.details.insert('1.0','\n'.join(lines));self.details.configure(state='disabled')
        self.status.configure(text='Review the main drawing preview, alternatives and warnings. Scores are geometric distances, not probabilities.')

    def accept(self):
        app=self.app
        if app.preview is None or not app.job or read(app.job/'job.json')['operation']!='reference_role_assignment':raise ValueError('Preview a reference assignment first')
        if self.request()!=read(app.job/'job.json')['settings']:raise ValueError('Reference controls changed; regenerate before accepting')
        app.session.apply(app.job);app.preview=None;app.reference_preview=None;app.refresh();self.refresh();app.status.set('Accepted reference part/color assignment. Sources, geometry and artist overrides retained; Undo is available.')

    def correct(self):
        if not self.override.get():raise ValueError('Enter the corrected part ID first')
        self.commit(correct_part(self.app.session.project,self.region_id(),self.target_character.get(),self.override.get(),self.numbers(self.bounds,4)),'correct-region-part-identity')
    def depth_apply(self):self.commit(set_depth(self.app.session.project,self.region_id(),int(self.depth.get())),'set-artist-fill-part-depth')
    def close(self):self.window.destroy();self.app.references_button.focus_set()
