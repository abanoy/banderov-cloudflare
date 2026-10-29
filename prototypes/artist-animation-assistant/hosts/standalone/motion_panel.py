"""Native correspondence controls; separate source/guide evidence and timing."""
from copy import deepcopy
from pathlib import Path
import tempfile,tkinter as tk,uuid
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText
import numpy as np
from engine.motion import save_guide
from engine.jobs import create_motion_job,read
from engine.packed_render import png_bytes


class MotionPanel:
    def __init__(self,app):
        self.app=app;self.window=w=tk.Toplevel(app.root);w.title('Pose motion and correspondences');w.geometry('1080x820');w.minsize(960,760)
        w.protocol('WM_DELETE_WINDOW',self.close);w.bind('<Escape>',lambda e:self.close());self.guide_id='guide-'+uuid.uuid4().hex;self.handles=[];self.rejected_matches=[];self.pending_source=None;self.transforms={}
        top=ttk.Frame(w,padding=8);top.pack(fill='x');self.demo_button=ttk.Button(top,text='Original pose diagnostic',command=lambda:app.guard(self.demo));self.demo_button.pack(side='left')
        self.guide_choice=tk.StringVar();self.guide_combo=ttk.Combobox(top,textvariable=self.guide_choice,state='readonly',width=36);self.guide_combo.pack(side='left',padx=4);self.guide_combo.bind('<<ComboboxSelected>>',lambda e:app.guard(self.load_guide))
        self.operation_choice=tk.StringVar(value='New pose interval');self.operation_combo=ttk.Combobox(top,textvariable=self.operation_choice,state='readonly',width=36);self.operation_combo.pack(side='left');self.operation_combo.bind('<<ComboboxSelected>>',lambda e:app.guard(self.load_operation));ttk.Button(top,text='Close',command=self.close).pack(side='right')
        form=ttk.Frame(w,padding=(8,0));form.pack(fill='x');self.name=tk.StringVar(value='Motion guide');self.actor=tk.StringVar();self.source_slot=tk.StringVar(value=str(app.session.slot));self.guide_slot=tk.StringVar(value='');c=app.session.project['canvas'];self.roi=tk.StringVar(value=f'0 0 {min(256,c["width"])} {min(256,c["height"])}')
        for column,(label,var,width) in enumerate([('Guide name',self.name,26),('Actor / group',self.actor,30),('Source slot',self.source_slot,6),('Guide slot / blank',self.guide_slot,8),('Source rectangle x0 y0 x1 y1',self.roi,26)]):
            ttk.Label(form,text=label).grid(row=0,column=column,sticky='w')
            if var is self.actor:self.actor_combo=ttk.Combobox(form,textvariable=var,state='readonly',width=width);self.actor_combo.grid(row=1,column=column,sticky='ew')
            else:ttk.Entry(form,textvariable=var,width=width).grid(row=1,column=column,sticky='ew')
        images=ttk.Frame(w,padding=8);images.pack(fill='both',expand=True);self.canvases={};self.image_labels={}
        for role,label in [('source','Source drawing'),('target','Guide drawing / target coordinates')]:
            frame=ttk.Frame(images);frame.pack(side='left',fill='both',expand=True,padx=3);self.image_labels[role]=ttk.Label(frame,text=label);self.image_labels[role].pack();canvas=tk.Canvas(frame,bg='#e8ebef',height=210,highlightthickness=1);canvas.pack(fill='both',expand=True);canvas.bind('<Button-1>',lambda e,r=role:app.guard(lambda:self.click(e,r)));self.canvases[role]=canvas;canvas.bind('<Configure>',lambda e:app.guard(self.draw))
        self.refresh_images_button=ttk.Button(w,text='Refresh source / guide views',command=lambda:app.guard(self.draw));self.refresh_images_button.pack(fill='x',padx=8)
        area=ttk.Frame(w,padding=8);area.pack(fill='x');self.pair_tree=ttk.Treeview(area,columns=('source','target','state'),show='tree headings',height=4,selectmode='browse');self.pair_tree.heading('#0',text='Named landmark');self.pair_tree.heading('source',text='Source x y');self.pair_tree.heading('target',text='Target x y');self.pair_tree.heading('state',text='Correspondence');self.pair_tree.column('#0',width=190);self.pair_tree.column('source',width=160);self.pair_tree.column('target',width=160);self.pair_tree.column('state',width=160);self.pair_tree.pack(side='left',fill='x',expand=True);scroll=ttk.Scrollbar(area,command=self.pair_tree.yview);scroll.pack(side='right',fill='y');self.pair_tree.configure(yscrollcommand=scroll.set);self.pair_tree.bind('<<TreeviewSelect>>',lambda e:app.guard(self.select_pair))
        edit=ttk.Frame(w,padding=(8,0));edit.pack(fill='x');self.point_id=tk.StringVar(value='point-1');self.source_xy=tk.StringVar(value='');self.target_xy=tk.StringVar(value='');self.enabled=tk.BooleanVar(value=True);self.contact=tk.BooleanVar(value=False)
        for label,var,width in [('Landmark ID',self.point_id,22),('Source x y / -',self.source_xy,18),('Target x y / -',self.target_xy,18)]:ttk.Label(edit,text=label).pack(side='left');ttk.Entry(edit,textvariable=var,width=width).pack(side='left',padx=2)
        ttk.Checkbutton(edit,text='Enabled',variable=self.enabled).pack(side='left');ttk.Checkbutton(edit,text='Pin at source',variable=self.contact).pack(side='left')
        controls=ttk.Frame(w,padding=(8,4));controls.pack(fill='x');self.pair_button=ttk.Button(controls,text='Add / update correspondence',command=lambda:app.guard(self.update_pair));self.pair_button.pack(side='left');ttk.Button(controls,text='Remove correspondence',command=lambda:app.guard(self.remove_pair)).pack(side='left',padx=3);self.save_button=ttk.Button(controls,text='Save guide',command=lambda:app.guard(self.save));self.save_button.pack(side='left')
        self.match_button=ttk.Button(controls,text='Suggest targets from images',command=lambda:app.guard(self.open_matching));self.match_button.pack(side='left',padx=3)
        self.parts_button=ttk.Button(controls,text='Edit part ownership',command=lambda:app.guard(app.open_parts));self.parts_button.pack(side='left',padx=3)
        settings=ttk.Frame(w,padding=(8,0));settings.pack(fill='x');self.mode=tk.StringVar(value='Preserve local scale');self.modes={'Preserve local scale':'rigid','Allow local uniform scale':'similarity','Translation comparison':'translation'};ttk.Combobox(settings,textvariable=self.mode,values=list(self.modes),state='readonly',width=25).pack(side='left')
        self.progress=tk.StringVar(value='.5');self.start=tk.StringVar(value=str(min(app.session.slot+1,app.session.project['shot']['duration_frames']-1))) ;self.end=tk.StringVar(value=str(app.session.project['shot']['duration_frames']))
        for label,var in [('Spatial progress0..1',self.progress),('Target start slot',self.start),('End slot',self.end)]:ttk.Label(settings,text=label).pack(side='left',padx=(5,1));ttk.Entry(settings,textvariable=var,width=5).pack(side='left')
        self.allow_clip=tk.BooleanVar(value=False);ttk.Checkbutton(settings,text='Allow ordinary ink clipping',variable=self.allow_clip).pack(side='left',padx=3)
        actions=ttk.Frame(w,padding=8);actions.pack(fill='x');self.preview_button=ttk.Button(actions,text='Preview pose',command=lambda:app.guard(self.preview));self.preview_button.pack(side='left',expand=True,fill='x');self.accept_button=ttk.Button(actions,text='Accept key in interval',command=lambda:app.guard(self.accept));self.accept_button.pack(side='left',expand=True,fill='x');self.reject_button=ttk.Button(actions,text='Reject / cancel',command=app.reject);self.reject_button.pack(side='left',expand=True,fill='x')
        self.details=ScrolledText(w,height=4,wrap='word');self.details.pack(fill='x',padx=8);self.status=ttk.Label(w,text='Click source and guide views, then Add/update. A dash marks unmatched evidence; no hidden surface is invented. Select a group to move ink and colors together. Spatial progress is separate from hold timing.',wraplength=1000,padding=8);self.status.pack(fill='x')
        self.refresh()
        if self.guide_ids:self.guide_choice.set(next(iter(self.guide_ids)));self.load_guide()
        self.window.after_idle(self.draw)

    @staticmethod
    def numbers(value,n,integer=False):
        values=[int(v) if integer else float(v) for v in value.replace(',',' ').split()]
        if len(values)!=n:raise ValueError('Enter '+str(n)+' coordinates')
        return values
    def point(self,var):return None if var.get().strip() in {'','-'} else self.numbers(var.get(),2)

    def refresh(self):
        p=self.app.session.project;selected=self.app.layer_tree.selection();existing=self.actors.get(self.actor.get()) if hasattr(self,'actors') else None;actor=existing or (selected[0] if selected else self.app.session.layer_id)
        self.actors={n['name']+' ['+i[-8:]+']':i for i,n in p['layers'].items() if n.get('visible',True)};self.actor_combo.configure(values=list(self.actors));self.actor.set(next((label for label,i in self.actors.items() if i==actor),next(iter(self.actors),'')))
        self.guide_ids={g['name']+' ['+i[-8:]+']':i for i,g in p.get('motion_guides',{}).items()};self.guide_combo.configure(values=list(self.guide_ids))
        latest={o['operation_id']:o for o in p.get('motion_operations',[])};self.operations={'New pose interval':None}
        for identity,o in latest.items():self.operations[o['guide_snapshot']['name']+' / '+str(o['target_start'])+'–'+str(o['target_end'])+' ['+identity[-8:]+']']=identity
        self.operation_combo.configure(values=list(self.operations))
        if self.operation_choice.get() not in self.operations:self.operation_choice.set('New pose interval')

    def actor_id(self):return self.actors.get(self.actor.get(),self.actor.get())
    def definition(self):
        g=dict(name=self.name.get(),actor_id=self.actor_id(),source_slot=int(self.source_slot.get()),guide_slot=None if not self.guide_slot.get().strip() else int(self.guide_slot.get()),roi=self.numbers(self.roi.get(),4,True),handles=deepcopy(self.handles))
        if self.rejected_matches:g['rejected_matches']=deepcopy(self.rejected_matches)
        return g
    def request(self):return dict(guide_id=self.guide_id,mode=self.modes[self.mode.get()],progress=float(self.progress.get()),target_start=int(self.start.get()),target_end=int(self.end.get()),operation_id=self.operations.get(self.operation_choice.get()),allow_clip=self.allow_clip.get())

    def load_guide(self):
        self.guide_id=self.guide_ids[self.guide_choice.get()];g=self.app.session.project['motion_guides'][self.guide_id];self.name.set(g['name']);self.actor.set(next((label for label,i in self.actors.items() if i==g['actor_id']),g['actor_id']));self.source_slot.set(str(g['source_slot']));self.guide_slot.set('' if g['guide_slot'] is None else str(g['guide_slot']));self.roi.set(' '.join(map(str,g['roi'])));self.handles=deepcopy(g['handles']);self.rejected_matches=deepcopy(g.get('rejected_matches',[]));self.show_pairs();self.draw()
        from engine.motion import _actor_layers,_exposure
        exposures=[_exposure(self.app.session.project,i,g['source_slot']) for i in _actor_layers(self.app.session.project,g['actor_id'])];exposures=[e for e in exposures if e]
        if exposures:
            end=min(e['start']+e['length'] for e in exposures);self.start.set(str(min(end-1,max(g['source_slot']+1,(g['source_slot']+end)//2))));self.end.set(str(end))

    def load_operation(self):
        identity=self.operations.get(self.operation_choice.get())
        if identity is None:return
        op=next(o for o in reversed(self.app.session.project['motion_operations']) if o['operation_id']==identity);label=next(label for label,i in self.guide_ids.items() if i==op['guide_id']);self.guide_choice.set(label);self.load_guide();self.start.set(str(op['target_start']));self.end.set(str(op['target_end']));self.progress.set(str(op['request']['progress']));self.mode.set(next(label for label,mode in self.modes.items() if mode==op['request']['mode']))

    def show_pairs(self):
        self.pair_tree.delete(*self.pair_tree.get_children())
        for r in self.handles:self.pair_tree.insert('','end',iid=r['id'],text=r['id'],values=(r['source'] if r['source'] is not None else '-',r['target'] if r['target'] is not None else '-','matched' if r['source'] is not None and r['target'] is not None else 'unmatched'))
    def select_pair(self):
        if not self.pair_tree.selection():return
        identity=self.pair_tree.selection()[0];r=next(r for r in self.handles if r['id']==identity);self.point_id.set(identity);self.source_xy.set('-' if r['source'] is None else ' '.join(map(str,r['source'])));self.target_xy.set('-' if r['target'] is None else ' '.join(map(str,r['target'])));self.enabled.set(r['enabled']);self.contact.set(r['source'] is not None and r['source']==r['target'])
    def update_pair(self):
        source=self.point(self.source_xy);target=source[:] if self.contact.get() and source is not None else self.point(self.target_xy);r=dict(id=self.point_id.get(),source=source,target=target,enabled=self.enabled.get());current=next((i for i,p in enumerate(self.handles) if p['id']==r['id']),None)
        candidate=self.definition()
        if current is None:candidate['handles'].append(r)
        else:candidate['handles'][current]=r
        save_guide(self.app.session.project,self.guide_id,candidate)
        self.handles=candidate['handles'];self.show_pairs();self.draw()
    def remove_pair(self):self.handles=[r for r in self.handles if r['id']!=self.point_id.get()];self.show_pairs();self.draw()

    def save(self):
        definition=self.definition()
        if self.app.session.project.get('motion_guides',{}).get(self.guide_id)!=definition:self.app.session.commit(save_guide(self.app.session.project,self.guide_id,definition),'edit-motion-correspondences');self.app.refresh()
        self.rejected_matches=deepcopy(self.app.session.project['motion_guides'][self.guide_id].get('rejected_matches',[]))
        self.status.configure(text='Guide saved locally. Matched/unmatched points persist without training or upload; original key drawings remain unchanged.')

    def draw(self):
        if not self.window.winfo_exists():return
        p=self.app.session.project;w,h=p['canvas']['width'],p['canvas']['height'];roi=self.numbers(self.roi.get(),4,True);allpoints=[xy for r in self.handles for xy in [r['source'],r['target']]] if self.handles else []
        allpoints=[xy for xy in allpoints if xy is not None];xs=[roi[0],roi[2]]+[v[0] for v in allpoints];ys=[roi[1],roi[3]]+[v[1] for v in allpoints];view=[max(0,int(min(xs))-8),max(0,int(min(ys))-8),min(w,int(max(xs))+9),min(h,int(max(ys))+9)]
        if view[2]<=view[0] or view[3]<=view[1]:raise ValueError('Choose a source view inside the canvas')
        self.photos={}
        for role,canvas in self.canvases.items():
            slot=int(self.source_slot.get()) if role=='source' or not self.guide_slot.get().strip() else int(self.guide_slot.get());vw,vh=view[2]-view[0],view[3]-view[1];scale=max(.01,min((max(10,canvas.winfo_width())-10)/vw,(max(10,canvas.winfo_height())-10)/vh,3));ow,oh=max(1,round(vw*scale)),max(1,round(vh*scale))
            if p['schema_version']=='0.2':
                from engine.packed_render import render
                raw=render(p,slot,(ow,oh),view)[2]
            else:
                from engine.layers import render
                a=np.asarray(render(p,slot),np.uint8).reshape(h,w,4);raw=a[(view[1]+np.arange(oh)*vh//oh)[:,None],(view[0]+np.arange(ow)*vw//ow)[None,:]].tobytes()
            self.photos[role]=tk.PhotoImage(master=self.window,data=png_bytes(ow,oh,raw));canvas.delete('all');canvas.create_image(5,5,image=self.photos[role],anchor='nw');self.transforms[role]=(view,ow,oh);self.image_labels[role].configure(text=('Source' if role=='source' else 'Guide')+' key / slot '+str(slot))
            for r in self.handles:
                xy=r[role]
                if xy is None:continue
                x,y=5+(xy[0]-view[0])*ow/vw,5+(xy[1]-view[1])*oh/vh;canvas.create_oval(x-3,y-3,x+3,y+3,outline='#dd762d' if r['enabled'] else '#8e959e',width=2);canvas.create_text(x+4,y,text=r['id'],anchor='w',fill='#93411a')
    def click(self,event,role):
        view,ow,oh=self.transforms[role]
        if not 5<=event.x<5+ow or not 5<=event.y<5+oh:return
        x=(event.x-5)*(view[2]-view[0])/ow+view[0];y=(event.y-5)*(view[3]-view[1])/oh+view[1];value=f'{int(x)+.5:g} {int(y)+.5:g}';(self.source_xy if role=='source' else self.target_xy).set(value)

    def open_matching(self):
        self.save()
        from hosts.standalone.matching_panel import MatchingPanel
        if getattr(self.app,'matching_panel',None) and self.app.matching_panel.window.winfo_exists():self.app.matching_panel.window.lift();return
        self.app.matching_panel=MatchingPanel(self)

    def preview(self):
        app=self.app
        if app.process and app.process.poll() is None:raise ValueError('A job is already running')
        self.save();directory=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex;create_motion_job(app.session.project,self.request(),directory);app.preview=None;app.motion_preview=None;app.fill_preview=None;app.cleanup_preview=None;app.reference_preview=None;app.job=directory;app.job_layer=app.session.layer_id;app.launch_job();self.status.configure(text='Local pose worker running. Compare against the source and inspect warnings before accepting.')
    def show_result(self,result):
        if not self.window.winfo_exists():return
        lines=['Proposed pose at slots '+str(result['request']['target_start'])+'–'+str(result['request']['target_end']), 'Backend: '+result['method']]
        for layer,r in result['outputs'].items():
            m=r['metrics'];name=self.app.session.project['layers'].get(layer,{}).get('name',layer);lines.append(name+': pin error '+format(m.get('max_landmark_error',0),'.4g')+'px; sampled folds '+str(m['fold_samples'])+'; lost protected samples '+str(m['protected_lost']))
        lines += ['','Visibility evidence: '+str(len(result['visibility_events']))+' unmatched marks.']+result['warnings'];self.details.configure(state='normal');self.details.delete('1.0','end');self.details.insert('1.0','\n'.join(lines));self.details.configure(state='disabled')
    def accept(self):
        app=self.app
        if app.preview is None or not app.job or read(app.job/'job.json')['operation']!='landmark_motion':raise ValueError('Preview the pose first')
        if self.request()!=read(app.job/'job.json')['settings'] or self.definition()!=app.session.project['motion_guides'][self.guide_id]:raise ValueError('Motion controls/correspondences changed; regenerate before acceptance')
        app.session.apply(app.job);app.preview=None;app.motion_preview=None;app.refresh();identity=app.session.project['motion_operations'][-1]['operation_id'];self.refresh();self.operation_choice.set(next(label for label,i in self.operations.items() if i==identity));self.status.configure(text='Accepted editable ink/color key in the chosen interval. Original keys retained; Undo reverses this one acceptance.');app.status.set('Accepted reviewed pose; source/guide keys and duration retained. Undo is available.')
    def demo(self):
        if not self.app.confirm_discard():return
        from hosts.standalone.motion_fixtures import fixture
        from hosts.standalone.session import Session
        self.window.destroy();self.app.motion_panel=None;self.app.replace_session(Session(fixture()));self.app.layer_tree.selection_set('actor');self.app.open_motion();panel=self.app.motion_panel;panel.start.set('4');panel.end.set('8')
    def close(self):self.window.destroy();self.app.motion_button.focus_set()
