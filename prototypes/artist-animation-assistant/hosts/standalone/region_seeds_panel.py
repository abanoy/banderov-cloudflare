"""Explicit component seed repair over saved accepted geometry and ownership."""
from pathlib import Path
import tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText
import numpy as np
from engine.region_domains import set_seed_hints,component_seeds,seed_scope
from engine.packed_render import png_bytes
from engine.layers import render


class RegionSeedsPanel:
    def __init__(self,app):
        self.app=app;self.window=w=tk.Toplevel(app.root);w.title('Accepted region seeds');w.geometry('700x640');w.minsize(600,580);w.protocol('WM_DELETE_WINDOW',self.close);w.bind('<Escape>',lambda e:self.close())
        # REF-TK-WM: this editor acts on behalf of its opening part window.
        panel=getattr(app,'part_panel',None)
        if panel and panel.window.winfo_exists():w.transient(panel.window)
        frame=ttk.Frame(w,padding=10);frame.pack(fill='both',expand=True)
        self.choice=tk.StringVar();self.combo=ttk.Combobox(frame,textvariable=self.choice,state='readonly');self.combo.pack(fill='x');self.combo.bind('<<ComboboxSelected>>',lambda e:app.guard(self.load))
        self.help=ttk.Label(frame,text='Click to add an interior seed. The first point is the main seed; each disconnected piece needs a point. Ownership is shaded; it cannot be opened by a seed.',wraplength=570);self.help.pack(fill='x',pady=6)
        self.canvas=tk.Canvas(frame,bg='#eef0f3',height=240,highlightthickness=1);self.canvas.pack(fill='both',expand=True);self.canvas.bind('<Button-1>',lambda e:app.guard(lambda:self.click(e)));self.canvas.bind('<Configure>',lambda e:app.guard(self.draw))
        ttk.Label(frame,text='Canvas x y, one point per line (up to128). Main seed first.').pack(anchor='w',pady=(6,2))
        self.points_text=ScrolledText(frame,height=4,wrap='none');self.points_text.pack(fill='x')
        row=ttk.Frame(frame);row.pack(fill='x',pady=6)
        self.restore_button=ttk.Button(row,text='Seeds from accepted mask',command=lambda:app.guard(self.restore));self.restore_button.pack(side='left',fill='x',expand=True)
        self.apply_button=ttk.Button(row,text='Apply seed hints',command=lambda:app.guard(self.apply));self.apply_button.pack(side='left',fill='x',expand=True,padx=4)
        self.close_button=ttk.Button(row,text='Close',command=self.close);self.close_button.pack(side='right')
        self.status=ttk.Label(frame,text='Hints change metadata only. Preview and accept boundary regeneration separately.',wraplength=570);self.status.pack(fill='x')
        self.refresh();w.after_idle(self.draw)

    def refresh(self):
        p=self.app.session.project;self.choices={}
        for i,r in p.get('fill_regions',{}).items():
            if r['start']<=self.app.session.slot<r['start']+r['length']:
                self.choices[str(len(self.choices)+1)+'. '+p['layers'][r['fill_layer']]['name']+' / '+str(r['start'])+'–'+str(r['start']+r['length'])+' / '+r.get('raster_owner_id','whole region')]=i
        if not self.choices:raise ValueError('No accepted region at the current playhead')
        self.combo.configure(values=list(self.choices));preferred=self.app.fill_region
        palette=self.app.region_tree.selection()
        if palette:preferred=palette[0]
        self.choice.set(next((label for label,i in self.choices.items() if i==preferred),next(iter(self.choices))));self.load()

    def region_id(self):return self.choices[self.choice.get()]
    def points(self):
        result=[]
        for row in self.points_text.get('1.0','end').splitlines():
            if not row.strip():continue
            values=[int(v) for v in row.replace(',',' ').split()]
            if len(values)!=2:raise ValueError('Enter one x y point per line')
            result.append(values)
        return result
    def put(self,points):self.points_text.delete('1.0','end');self.points_text.insert('1.0','\n'.join(str(x)+' '+str(y) for x,y in points))
    def load(self):
        r=self.app.session.project['fill_regions'][self.region_id()];self.loaded_scope=seed_scope(self.app.session.project,self.region_id());self.put([r['settings']['seed']]+r.get('component_seeds',[]));self.draw()
    def restore(self):
        p=self.app.session.project;r=p['fill_regions'][self.region_id()];w,h=p['canvas']['width'],p['canvas']['height']
        if r.get('region_format') in {'packed_roi_v1','motion_region_v1'}:
            from engine.roi_assistance import mask_indices
            known=mask_indices(r['region_mask'],r['roi'])
        else:known=r['region'][:]
        points=component_seeds(known,w,h,[r['settings']['seed']]+r.get('component_seeds',[]))
        if not points:raise ValueError('Accepted interior is empty. Repair ownership or choose an explicit interior after changing its ink.')
        self.loaded_scope=seed_scope(p,self.region_id());self.put(points);self.draw();self.status.configure(text='Points come from the accepted mask, not a new segmentation. Apply hints, then preview boundary regeneration.')
    def draw(self):
        if not self.window.winfo_exists() or not hasattr(self,'choices') or not self.choices:return
        p=self.app.session.project;r=p['fill_regions'][self.region_id()];w,h=p['canvas']['width'],p['canvas']['height'];roi=r.get('roi',[0,0,w,h]);rw,rh=roi[2]-roi[0],roi[3]-roi[1]
        scale=min(max(10,self.canvas.winfo_width()-10)/rw,max(10,self.canvas.winfo_height()-10)/rh,4);ow,oh=max(1,round(rw*scale)),max(1,round(rh*scale));xs=roi[0]+np.arange(ow)*rw//ow;ys=roi[1]+np.arange(oh)*rh//oh
        if p['schema_version']=='0.2':
            from engine.packed_render import render as packed_render
            raw=packed_render(p,r['start'],(ow,oh),roi)[2]
        else:
            a=np.asarray(render(p,r['start']),np.uint8).reshape(h,w,4);raw=a[ys[:,None],xs[None,:]].tobytes()
        self.photo=tk.PhotoImage(master=self.window,data=png_bytes(ow,oh,raw));self.canvas.delete('all');self.canvas.create_image(5,5,image=self.photo,anchor='nw');self.transform=(roi,ow,oh)
        domain=r.get('ownership_domain')
        if domain is not None:
            from engine.region_domains import domain_indices
            allowed=set(domain_indices(domain,w,h,roi));shade=np.zeros((oh,ow,4),np.uint8)
            forbidden=np.asarray([[int(y*w+x) not in allowed for x in xs] for y in ys]);shade[forbidden]=[170,70,160,60]
            self.shade=tk.PhotoImage(master=self.window,data=png_bytes(ow,oh,shade.tobytes()));self.canvas.create_image(5,5,image=self.shade,anchor='nw')
        try:points=self.points()
        except ValueError:return
        for n,(x,y) in enumerate(points):
            px,py=5+(x-roi[0]+.5)*ow/rw,5+(y-roi[1]+.5)*oh/rh
            self.canvas.create_oval(px-4,py-4,px+4,py+4,outline='#09552d',width=2);self.canvas.create_text(px+8,py,text=str(n+1),anchor='w',fill='#09552d')
    def click(self,event):
        roi,ow,oh=self.transform
        if not 5<=event.x<5+ow or not 5<=event.y<5+oh:return
        x=roi[0]+int((event.x-5)*(roi[2]-roi[0])/ow);y=roi[1]+int((event.y-5)*(roi[3]-roi[1])/oh)
        points=self.points()
        if [x,y] not in points:points.append([x,y])
        self.put(points);self.draw()
    def apply(self):
        app=self.app
        if seed_scope(app.session.project,self.region_id())!=self.loaded_scope:raise ValueError('Region or source changed; reload its accepted points before applying hints')
        updated=set_seed_hints(app.session.project,self.region_id(),self.points());app.session.commit(updated,'edit-region-component-seeds');self.loaded_scope=seed_scope(app.session.project,self.region_id());app.preview=None;app.fill_preview=None;app.part_preview=None;app.part_preview_cache=None;app.refresh();self.status.configure(text='Seed hints saved. Earlier dependent previews are stale; boundary pixels stay unchanged until a new preview is accepted. Undo restores the hints.')
    def close(self):
        if not self.window.winfo_exists():return
        focused=self.window.focus_displayof()
        return_focus=focused is not None and focused.winfo_toplevel()==self.window
        self.window.destroy()
        panel=getattr(self.app,'part_panel',None)
        if panel and panel.window.winfo_exists():
            # REF-TK-FOCUS: focus_set alone only remembers a child after the
            # focused top-level is destroyed on Windows. Restore the owning
            # window only for an active close; background closes never activate.
            if return_focus:
                panel.window.focus_force()
                panel.seed_button.focus_set()
