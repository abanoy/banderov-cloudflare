"""Own editable ownership masks and explicit part/donor review controls."""
from copy import deepcopy
from pathlib import Path
import tempfile,uuid,tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText
import numpy as np
from engine.raster_parts import ownership,mask_indices
from engine.motion import _box
from engine.spatial_constraints import uniform
from engine.paint_stroke import PackedStroke
from engine.jobs import create_part_job,read
from engine.packed_render import png_bytes


class PartsPanel:
    def __init__(self,app,actor):
        self.app=app;self.actor_id=actor;self.operation_id=None;self.masks={'source':set(),'content':set()};self.transforms={};self.stroke=None
        self.window=w=tk.Toplevel(app.root);w.title('Editable part ownership and approved content');w.geometry('1100x840');w.minsize(1000,800);w.protocol('WM_DELETE_WINDOW',self.close);w.bind('<Escape>',lambda e:self.close())
        top=ttk.Frame(w,padding=8);top.pack(fill='x');self.demo_button=ttk.Button(top,text='Original scarf diagnostic',command=lambda:app.guard(self.demo));self.demo_button.pack(side='left')
        self.operation=tk.StringVar(value='New part');self.combo=ttk.Combobox(top,textvariable=self.operation,state='readonly',width=45);self.combo.pack(side='left',padx=5);self.combo.bind('<<ComboboxSelected>>',lambda e:app.guard(self.load))
        self.seed_button=ttk.Button(top,text='Edit region seeds',command=lambda:app.guard(app.open_region_seeds));self.seed_button.pack(side='left',padx=4)
        self.name=tk.StringVar(value='Editable part');self.part_id=tk.StringVar(value='character.part');self.source=tk.StringVar(value=str(app.session.slot));self.content=tk.StringVar(value=str(app.session.slot));self.start=tk.StringVar(value=str(app.session.slot+1));self.end=tk.StringVar(value=str(app.session.project['shot']['duration_frames']));self.depth=tk.StringVar(value='front');self.radius=tk.StringVar(value='3')
        form=ttk.Frame(w,padding=(8,0));form.pack(fill='x')
        for label,var,width in [('Part name',self.name,25),('Stable part ID',self.part_id,25),('Source slot',self.source,5),('Content slot',self.content,5),('Start',self.start,5),('End',self.end,5)]:ttk.Label(form,text=label).pack(side='left');ttk.Entry(form,textvariable=var,width=width).pack(side='left',padx=2)
        controls=ttk.Frame(w,padding=8);controls.pack(fill='x');ttk.Label(controls,text='Part depth').pack(side='left');ttk.Combobox(controls,textvariable=self.depth,values=['front','back','hidden'],state='readonly',width=10).pack(side='left');ttk.Label(controls,text='Mask brush radius').pack(side='left',padx=4);ttk.Entry(controls,textvariable=self.radius,width=4).pack(side='left')
        self.erase=tk.BooleanVar(value=False);ttk.Checkbutton(controls,text='Remove ownership',variable=self.erase).pack(side='left',padx=4)
        self.copy_button=ttk.Button(controls,text='Copy source mask to content',command=lambda:app.guard(self.copy_mask));self.copy_button.pack(side='left');self.clear_button=ttk.Button(controls,text='Clear masks',command=lambda:app.guard(self.clear_masks));self.clear_button.pack(side='left',padx=3)
        c=app.session.project['canvas'];self.view=tk.StringVar(value=f'0 0 {min(256,c["width"])} {min(256,c["height"])}');self.rectangle=tk.StringVar(value='0 0 1 1')
        row=ttk.Frame(w,padding=(8,0));row.pack(fill='x');ttk.Label(row,text='View x0 y0 x1 y1').pack(side='left');ttk.Entry(row,textvariable=self.view,width=24).pack(side='left');self.refresh_button=ttk.Button(row,text='Refresh key views',command=lambda:app.guard(self.draw));self.refresh_button.pack(side='left',padx=4);ttk.Label(row,text='Ownership rectangle').pack(side='left');ttk.Entry(row,textvariable=self.rectangle,width=23).pack(side='left');self.rect_button=ttk.Button(row,text='Set both masks from rectangle',command=lambda:app.guard(self.set_rectangle));self.rect_button.pack(side='left',padx=4)
        images=ttk.Frame(w,padding=8);images.pack(fill='both',expand=True);self.canvases={}
        for role,label in [('source','Remove these samples from the held source'),('content','Part content from approved key / retained when hidden')]:
            f=ttk.Frame(images);f.pack(side='left',fill='both',expand=True,padx=3);ttk.Label(f,text=label).pack();canvas=tk.Canvas(f,bg='#e8ebef',height=250,highlightthickness=1);canvas.pack(fill='both',expand=True);self.canvases[role]=canvas
            canvas.bind('<Button-1>',lambda e,r=role:app.guard(lambda:self.begin(e,r)));canvas.bind('<B1-Motion>',lambda e,r=role:app.guard(lambda:self.drag(e,r)));canvas.bind('<ButtonRelease-1>',lambda e,r=role:app.guard(lambda:self.finish(e,r)));canvas.bind('<Configure>',lambda e:app.guard(self.draw))
        actions=ttk.Frame(w,padding=8);actions.pack(fill='x');self.preview_button=ttk.Button(actions,text='Preview part layers',command=lambda:app.guard(self.preview));self.preview_button.pack(side='left',fill='x',expand=True);self.accept_button=ttk.Button(actions,text='Accept editable part / revision',command=lambda:app.guard(self.accept));self.accept_button.pack(side='left',fill='x',expand=True);self.reject_button=ttk.Button(actions,text='Reject / cancel',command=app.reject);self.reject_button.pack(side='left',fill='x',expand=True);ttk.Button(actions,text='Close',command=self.close).pack(side='right')
        self.details=ScrolledText(w,height=5,wrap='word');self.details.pack(fill='x',padx=8);self.status=ttk.Label(w,text='Magenta is pixel ownership, not new ink. Source mask removes samples; content mask assigns approved key samples to the new part. No semantic boundary or unseen anatomy is inferred. Binary masks preserve original antialias samples.',wraplength=970,padding=8);self.status.pack(fill='x')
        self.refresh_operations();self.default_interval();w.after_idle(self.draw)

    @staticmethod
    def numbers(value):
        values=[int(v) for v in value.replace(',',' ').split()]
        if len(values)!=4:raise ValueError('Enter x0 y0 x1 y1')
        return values
    def default_interval(self):
        from engine.raster_parts import _actor_layers,_exposure
        p=self.app.session.project;exps=[_exposure(p,i,int(self.source.get())) for i in _actor_layers(p,self.actor_id)];end=min(e['start']+e['length'] for e in exps if e);self.start.set(str(min(end-1,max(int(self.source.get())+1,(int(self.source.get())+end)//2))));self.end.set(str(end))
    def refresh_operations(self):
        self.operations={'New part':None}
        for identity,record in self.app.session.project.get('raster_parts',{}).items():self.operations[record['settings']['name']+' ['+identity[-8:]+']']=identity
        self.combo.configure(values=list(self.operations))
    def settings(self):return dict(actor_id=self.actor_id,source_slot=int(self.source.get()),content_slot=int(self.content.get()),target_start=int(self.start.get()),target_end=int(self.end.get()),name=self.name.get(),part_id=self.part_id.get(),source_mask=ownership(self.app.session.project,self.masks['source']),content_mask=ownership(self.app.session.project,self.masks['content']),depth=self.depth.get(),operation_id=self.operation_id)
    def load(self):
        self.operation_id=self.operations[self.operation.get()]
        if self.operation_id is None:return
        p=self.app.session.project;s=p['raster_parts'][self.operation_id]['settings'];self.actor_id=s['actor_id'];self.name.set(s['name']);self.part_id.set(s['part_id']);self.source.set(str(s['source_slot']));self.content.set(str(s['content_slot']));self.start.set(str(s['target_start']));self.end.set(str(s['target_end']));self.depth.set(s['depth'])
        self.masks={role:set(mask_indices(p,s[role+'_mask'])) for role in ['source','content']};boxes=[_box(list(values),p['canvas']['width'],p['canvas']['height']) for values in self.masks.values() if values]
        if boxes:self.view.set(' '.join(map(str,[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)])))
        self.draw()
    def clear_masks(self):self.masks={'source':set(),'content':set()};self.draw()
    def copy_mask(self):self.masks['content']=set(self.masks['source']);self.draw()
    def set_rectangle(self):
        x0,y0,x1,y1=self.numbers(self.rectangle.get());p=self.app.session.project;w,h=p['canvas']['width'],p['canvas']['height']
        if not 0<=x0<x1<=w or not 0<=y0<y1<=h or max(x1-x0,y1-y0)>256:raise ValueError('Choose an ownership rectangle<=256square inside the canvas')
        values={y*w+x for y in range(y0,y1) for x in range(x0,x1)};self.masks={'source':values,'content':set(values)};self.draw()
    def point(self,event,role):
        box,ow,oh=self.transforms[role]
        if not 5<=event.x<5+ow or not 5<=event.y<5+oh:return None
        return (box[0]+int((event.x-5)*(box[2]-box[0])/ow),box[1]+int((event.y-5)*(box[3]-box[1])/oh))
    def begin(self,event,role):
        point=self.point(event,role)
        if point is None:return
        radius=int(self.radius.get())
        if not 0<=radius<=16:raise ValueError('Choose a mask brush radius0..16')
        p=self.app.session.project;w,h=p['canvas']['width'],p['canvas']['height'];self.stroke=(role,PackedStroke(uniform(w,h),[1,0,0,0],radius),self.erase.get());self.drag(event,role)
    def drag(self,event,role):
        if self.stroke is None or self.stroke[0]!=role:return
        point=self.point(event,role)
        if point is not None:self.stroke[1].add(point)
    def finish(self,event,role):
        if self.stroke is None or self.stroke[0]!=role:return
        self.drag(event,role);_,stroke,erase=self.stroke;self.stroke=None;p=self.app.session.project;mask=stroke.planes()[0];box=_box(mask,p['canvas']['width'],p['canvas']['height'])
        if box is None:return
        if max(box[2]-box[0],box[3]-box[1])>256:raise ValueError('Keep each mask within256square')
        from engine.motion import _flags
        indices=set(_flags(mask,box));candidate=self.masks[role]-indices if erase else self.masks[role]|indices;mask_indices(p,ownership(p,candidate));self.masks[role]=candidate;self.draw()
    def draw(self):
        if not self.window.winfo_exists():return
        p=self.app.session.project;w,h=p['canvas']['width'],p['canvas']['height'];box=self.numbers(self.view.get());x0,y0,x1,y1=box
        if not 0<=x0<x1<=w or not 0<=y0<y1<=h or max(x1-x0,y1-y0)>512:raise ValueError('Choose a key view<=512square inside the canvas')
        self.photos={};self.overlays={}
        for role,canvas in self.canvases.items():
            slot=int(self.source.get() if role=='source' else self.content.get());vw,vh=x1-x0,y1-y0;scale=max(.01,min((max(10,canvas.winfo_width())-10)/vw,(max(10,canvas.winfo_height())-10)/vh,3));ow,oh=max(1,round(vw*scale)),max(1,round(vh*scale));xs=x0+np.arange(ow)*vw//ow;ys=y0+np.arange(oh)*vh//oh
            if p['schema_version']=='0.2':
                from engine.packed_render import render
                raw=render(p,slot,(ow,oh),box)[2]
            else:
                from engine.layers import render
                a=np.asarray(render(p,slot),np.uint8).reshape(h,w,4);raw=a[ys[:,None],xs[None,:]].tobytes()
            overlay=np.zeros((oh,ow,4),np.uint8);flags=np.array([[int(y*w+x) in self.masks[role] for x in xs] for y in ys]);overlay[flags]=[190,50,170,90]
            self.photos[role]=tk.PhotoImage(master=self.window,data=png_bytes(ow,oh,raw));self.overlays[role]=tk.PhotoImage(master=self.window,data=png_bytes(ow,oh,overlay.tobytes()));canvas.delete('all');canvas.create_image(5,5,image=self.photos[role],anchor='nw');canvas.create_image(5,5,image=self.overlays[role],anchor='nw');self.transforms[role]=(box,ow,oh)
    def preview(self):
        app=self.app
        if app.process and app.process.poll() is None:raise ValueError('A job is already running')
        job=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex;settings=self.settings();create_part_job(app.session.project,settings,job);app.preview=None;app.part_preview=None;app.part_preview_cache=None;app.job=job;app.session.slot=settings['target_start'];app.render();app.launch_job();self.status.configure(text='Local part worker running. Source and content keys stay unchanged; inspect the resulting layers before acceptance.')
    def show_result(self,result):
        text=['Region ownership: '+str([p['topology_event'] for p in result.get('region_plans',[])]),'Owned source pixels: '+str(result['ownership_pixels']),'Assigned content pixels: '+str(result['content_pixels']),'Protected samples excluded: '+str(result['protected_excluded']),'Event: '+result['event'],'Unsafe reasons: '+str(result['unsafe_reasons'])]+result['warnings'];self.details.delete('1.0','end');self.details.insert('1.0','\n'.join(text))
    def accept(self):
        app=self.app
        if app.preview is None or app.part_preview is None or not app.job or read(app.job/'job.json')['operation']!='raster_part_partition':raise ValueError('Preview the ownership proposal first')
        if self.settings()!=read(app.job/'job.json')['settings']:raise ValueError('Part masks or controls changed; regenerate before accepting')
        app.session.apply(app.job);app.preview=None;app.part_preview=None;app.part_preview_cache=None;app.refresh();self.refresh_operations();identity=app.session.project['part_operations'][-1]['operation_id'];self.operation_id=identity;self.operation.set(next(label for label,i in self.operations.items() if i==identity));self.status.configure(text='Accepted separate editable part layers and retained mask/source history. Original keys and duration unchanged. Undo reverses this acceptance.')
    def demo(self):
        if not self.app.confirm_discard():return
        from hosts.standalone.motion_fixtures import fixture
        from hosts.standalone.session import Session
        app=self.app;app.replace_session(Session(fixture(True)));app.open_motion();app.motion_panel.parts_button.invoke();panel=app.part_panel;panel.rectangle.set('98 26 122 64');panel.name.set('Right forearm and hand');panel.part_id.set('hero.right_arm');panel.set_rectangle()
    def close(self):
        self.window.destroy()
        if getattr(self.app,'motion_panel',None) and self.app.motion_panel.window.winfo_exists():self.app.motion_panel.parts_button.focus_set()
