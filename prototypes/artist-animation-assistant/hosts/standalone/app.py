"""Local desktop host. REF-TKINTER / REF-TKINTER-TTK; no browser/server/GPU."""
from copy import deepcopy
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, colorchooser
from tkinter.scrolledtext import ScrolledText
import uuid
import webbrowser

from engine.project import create
from engine.cleanup import defaults as cleanup_defaults, subject as cleanup_subject
from engine.jobs import create_job, create_fill_job, create_fill_revision_job, create_additional_region_job, create_palette_job, create_cleanup_job, request_cancel, read
from engine.fill import defaults as fill_defaults
from engine.fill_revision import inputs as region_inputs, dependency as region_dependency
from engine.regions import additional_dependency, accept_additional, palette_dependency
from hosts.standalone.session import Session, demo
from engine.io.png_codec import read_png, encode_png as png
from scripts.credits import build
from engine.io.krita_csv import export_animation
from engine.io.kra_raster import import_kra
from engine.io.openraster import import_ora,export_bundle,StaleEmbeddedProject
from engine.layers import render as render_layers, visible as layer_visible

ROOT = Path(__file__).resolve().parents[2]


class App:
    def __init__(self, root):
        self.root = root
        root.title('Artist Animation Assistant — standalone research prototype')
        root.geometry('1100x760')
        root.minsize(900, 680)
        self.session = Session()
        self.view_factor=1;self.view_pan=(0,0);self.packed_transform=None;self.pan_anchor=None;self.packed_ticket=None
        self.job = self.process = self.job_log = None
        self.preview = None
        self.playing = False
        self.timer = None
        self.preview_input = None
        self.preview_revision = None
        self.stroke = {}
        self.packed_stroke=None
        self.fill_add,self.fill_open=set(),set()
        self.fill_seed=None
        self.fill_region=None
        self.fill_new_region=False
        self.fill_context=None
        self.fill_preview=None
        self.palette_preview=None
        self.cleanup_preview=None
        self.motion_preview=None
        self.part_preview=None
        self.part_preview_cache=None
        self.stroke_active = False
        self.color = [35, 35, 45, 255]
        self.status = tk.StringVar(value='Open a project or the integration demo. Originals stay recoverable.')
        top = ttk.Frame(root, padding=10)
        top.pack(fill='x')
        ttk.Label(top, text='Artist Animation Assistant', font=('Segoe UI', 17, 'bold')).pack(side='left')
        self.credits_button = ttk.Button(top, text='CREDITS', command=self.open_credits, takefocus=True)
        self.credits_button.pack(side='right')
        self.credits_button.bind('<Return>', lambda event: self.open_credits())
        for label,action in [('Integration demo',self.load_demo),('Undo',lambda:self.history(True)),('Redo',lambda:self.history(False))]:
            ttk.Button(top,text=label,command=lambda fn=action:self.guard(fn)).pack(side='left',padx=4)
        bar = ttk.Frame(root, padding=(10, 0, 10, 8))
        bar.pack(fill='x')
        for label, action in [('Open project', self.open_project), ('Import PNG', self.import_png), ('Save project', self.save_project), ('Export CSV/PNG', self.export)]:
            ttk.Button(bar, text=label, command=lambda fn=action: self.guard(fn)).pack(side='left', padx=2)
        self.native_import_button = ttk.Button(bar, text='Import KRA', command=lambda: self.guard(self.import_native))
        self.native_import_button.pack(side='left', padx=2)
        self.ora_import_button=ttk.Button(bar,text='Import ORA',command=lambda:self.guard(self.import_openraster))
        self.ora_import_button.pack(side='left',padx=2)
        self.layered_export_button=ttk.Button(bar,text='Export layers',command=lambda:self.guard(self.export_layers))
        self.layered_export_button.pack(side='left',padx=2)
        ttk.Label(root, text='Research prototype • editable raster drawings and holds • translation is an integration baseline', padding=(12, 0, 0, 8)).pack(anchor='w')
        body = ttk.Frame(root, padding=10)
        body.pack(fill='both', expand=True)
        left = ttk.Frame(body, width=225)
        left.pack(side='left', fill='y', padx=(0, 12))
        self.tools = ttk.Notebook(left)
        self.tools.pack(fill='both', expand=True)
        editing, proposals = ttk.Frame(self.tools, padding=6), ttk.Frame(self.tools, padding=6)
        self.tools.add(editing, text='Drawing')
        self.tools.add(proposals, text='Proposal')
        layers_page = ttk.Frame(self.tools, padding=6)
        self.tools.add(layers_page, text='Layers')
        fill_page=ttk.Frame(self.tools,padding=6)
        self.tools.add(fill_page,text='Fill')
        row=ttk.Frame(fill_page);row.pack(fill='x')
        ttk.Button(row,text='Line-art demo',command=lambda:self.guard(self.load_fill_demo)).pack(side='left',expand=True,fill='x')
        self.fill_selection_button=ttk.Button(row,text='Select area',command=self.select_fill_area)
        self.fill_selection_button.pack(side='left',expand=True,fill='x')
        self.edit_region_button=ttk.Button(fill_page,text='Edit accepted boundary',command=lambda:self.guard(self.load_fill_region))
        self.edit_region_button.pack(fill='x',pady=2)
        ttk.Label(fill_page,text='Canvas action').pack(anchor='w',pady=(6,0))
        self.canvas_action=tk.StringVar(value='Paint')
        ttk.Combobox(fill_page,textvariable=self.canvas_action,values=['Paint','Fill seed','Add barrier','Keep open'],state='readonly',width=20).pack(fill='x')
        self.fill_seed_label=ttk.Label(fill_page,text='Choose Fill seed, then click inside.',wraplength=205)
        self.fill_seed_label.pack(fill='x',pady=4)
        ttk.Button(fill_page,text='Fill / brush color',command=self.choose_color).pack(fill='x')
        self.fill_paper=tk.StringVar(value='transparent')
        ttk.Label(fill_page,text='Source paper').pack(anchor='w')
        ttk.Combobox(fill_page,textvariable=self.fill_paper,values=['transparent','white'],state='readonly',width=20).pack(fill='x')
        values=ttk.Frame(fill_page)
        values.pack(fill='x',pady=4)
        self.fill_radius=tk.StringVar(value='0')
        self.fill_threshold=tk.StringVar(value='32')
        for label,variable,maximum in [('Gap px',self.fill_radius,2),('Ink alpha',self.fill_threshold,255)]:
            ttk.Label(values,text=label).pack(side='left')
            ttk.Spinbox(values,from_=0 if maximum==2 else 1,to=maximum,textvariable=variable,width=3).pack(side='left',padx=2)
        self.fill_overlap=tk.IntVar(value=1)
        ttk.Checkbutton(fill_page,text='Overlap only beneath ink',variable=self.fill_overlap).pack(anchor='w')
        self.fill_palette=tk.StringVar(value='fill_main')
        ttk.Label(fill_page,text='Palette identity').pack(anchor='w')
        ttk.Entry(fill_page,textvariable=self.fill_palette,width=20).pack(fill='x')
        self.fill_generate_button=ttk.Button(fill_page,text='Preview flat fill',command=lambda:self.guard(self.generate_fill))
        self.fill_generate_button.pack(fill='x',pady=(6,2))
        self.fill_accept_button=ttk.Button(fill_page,text='Accept editable fill layers',command=lambda:self.guard(self.apply))
        self.fill_accept_button.pack(fill='x',pady=2)
        ttk.Button(fill_page,text='Reject / cancel',command=self.reject).pack(fill='x',pady=2)
        ttk.Button(fill_page,text='New fill / clear hints',command=self.clear_fill_hints).pack(fill='x',pady=2)
        self.boundary_on=tk.BooleanVar(value=True)
        ttk.Checkbutton(fill_page,text='Inspect invisible barriers',variable=self.boundary_on,command=self.render).pack(anchor='w')
        ttk.Label(fill_page,text='Yellow: barriers; magenta: additions; green: keep open; blue: protection. Review warnings.',wraplength=205).pack(pady=5)
        ttk.Label(layers_page, text='Native/project layers', font=('Segoe UI', 10, 'bold')).pack(anchor='w')
        self.layer_tree = ttk.Treeview(layers_page, show='tree', height=8, selectmode='browse')
        self.layer_tree.column('#0', width=205)
        self.layer_tree.pack(fill='both', expand=True, pady=6)
        self.layer_tree.bind('<<TreeviewSelect>>', self.select_layer)
        self.layer_visible = tk.BooleanVar(value=True)
        self.layer_locked = tk.BooleanVar(value=False)
        self.visibility_button = ttk.Checkbutton(layers_page, text='Layer/group visible', variable=self.layer_visible, command=lambda: self.guard(lambda: self.layer_flag('visible', self.layer_visible.get())))
        self.visibility_button.pack(anchor='w')
        self.lock_button = ttk.Checkbutton(layers_page, text='Layer/group locked', variable=self.layer_locked, command=lambda: self.guard(lambda: self.layer_flag('locked', self.layer_locked.get())))
        self.lock_button.pack(anchor='w')
        ttk.Label(layers_page, text='Select a raster layer to edit. Hidden ancestors and native layer locks are respected. Original archive is retained.', wraplength=205).pack(pady=8)
        row=ttk.Frame(editing);row.pack(fill='x',pady=2)
        self.new_hd_button=ttk.Button(row,text='New HD canvas',command=lambda:self.guard(self.new_hd_canvas));self.new_hd_button.pack(side='left',fill='x',expand=True)
        self.references_button=ttk.Button(row,text='References',command=lambda:self.guard(self.open_references));self.references_button.pack(side='left',fill='x',expand=True)
        ttk.Label(editing, text='Drawing at playhead', font=('Segoe UI', 11, 'bold')).pack(anchor='w')
        self.drawing_label = ttk.Label(editing, text='No project', wraplength=210)
        self.drawing_label.pack(fill='x', pady=8)
        ttk.Button(editing, text='Brush color', command=self.choose_color).pack(fill='x')
        brush_row=ttk.Frame(editing);brush_row.pack(fill='x',pady=3)
        ttk.Label(brush_row,text='Brush radius (px)').pack(side='left')
        self.brush_radius=tk.StringVar(value='0')
        self.brush_radius_control=ttk.Spinbox(brush_row,from_=0,to=32,width=4,textvariable=self.brush_radius)
        self.brush_radius_control.pack(side='right')
        self.erase = tk.BooleanVar(value=False)
        ttk.Checkbutton(editing, text='Erase to transparent', variable=self.erase).pack(anchor='w', pady=5)
        ttk.Label(editing, text='Drag to paint continuously; radius0 is one pixel. Each stroke protects touched pixels; originals and earlier versions survive.', wraplength=215).pack(pady=8)
        ttk.Separator(editing).pack(fill='x', pady=8)
        ttk.Label(editing, text='Move next cut (hold slots)').pack(anchor='w')
        self.hold_value = tk.StringVar(value='4')
        ttk.Spinbox(editing, from_=1, to=600, textvariable=self.hold_value, width=8).pack(anchor='w', pady=4)
        ttk.Button(editing, text='Set hold', command=lambda: self.guard(self.change_hold)).pack(fill='x')
        self.schedule_button=ttk.Button(proposals,text='Drawing schedules / required events',command=lambda:self.guard(self.open_schedules));self.schedule_button.pack(fill='x',pady=3)
        self.motion_button=ttk.Button(proposals,text='Pose motion / correspondences',command=lambda:self.guard(self.open_motion));self.motion_button.pack(fill='x',pady=3)
        ttk.Label(proposals, text='Comparison: integer shift', font=('Segoe UI', 10, 'bold')).pack(anchor='w', pady=(8, 4))
        shifts = ttk.Frame(proposals)
        shifts.pack(fill='x')
        self.dx, self.dy = tk.StringVar(value='8'), tk.StringVar(value='0')
        for label, variable in [('X', self.dx), ('Y', self.dy)]:
            ttk.Label(shifts, text=label).pack(side='left')
            ttk.Entry(shifts, textvariable=variable, width=6).pack(side='left', padx=5)
        self.generate_button = ttk.Button(proposals, text='Generate proposal', command=lambda: self.guard(self.generate))
        self.generate_button.pack(fill='x', pady=(8, 2))
        ttk.Button(proposals, text='Cancel job', command=lambda: self.guard(self.cancel)).pack(fill='x', pady=2)
        ttk.Button(proposals, text='Accept into selected drawing', command=lambda: self.guard(self.apply)).pack(fill='x', pady=2)
        ttk.Button(proposals, text='Reject proposal', command=self.reject).pack(fill='x', pady=2)
        ttk.Button(proposals,text='Review details / warnings',command=lambda:self.guard(self.open_proposal_details)).pack(fill='x',pady=2)
        self.preview_on = tk.BooleanVar(value=True)
        ttk.Checkbutton(proposals, text='Show proposal preview', variable=self.preview_on, command=self.render).pack(anchor='w')
        ttk.Label(proposals, text='Review alternatives here. Accept creates a new drawing; the previous version survives. Motion inference is not implemented yet.', wraplength=215).pack(pady=12)
        palette_page=ttk.Frame(self.tools,padding=6)
        self.tools.add(palette_page,text='Palette')
        self.regions_demo_button=ttk.Button(palette_page,text='Three-region diagnostic',command=lambda:self.guard(self.load_regions_demo))
        self.regions_demo_button.pack(fill='x',pady=2)
        ttk.Label(palette_page,text='Regions / palette identities').pack(anchor='w')
        self.region_tree=ttk.Treeview(palette_page,columns=('palette',),show='tree headings',height=4,selectmode='browse')
        self.region_tree.heading('#0',text='Region');self.region_tree.heading('palette',text='Palette ID')
        self.region_tree.column('#0',width=115);self.region_tree.column('palette',width=100)
        self.region_tree.pack(fill='x',pady=4)
        self.add_region_button=ttk.Button(palette_page,text='Add region on shared ink',command=lambda:self.guard(self.start_additional_region))
        self.add_region_button.pack(fill='x',pady=2)
        ttk.Label(palette_page,text='Palette ID (existing or new)').pack(anchor='w')
        self.palette_choice=tk.StringVar(value='fill_main')
        self.palette_combo=ttk.Combobox(palette_page,textvariable=self.palette_choice,width=21)
        self.palette_combo.pack(fill='x')
        self.palette_combo.bind('<<ComboboxSelected>>',lambda e:self.guard(self.load_palette_color))
        self.palette_rgb=[80,155,220]
        self.palette_alpha=tk.StringVar(value='255')
        self.palette_value_label=ttk.Label(palette_page,text='#509bdc / alpha255')
        self.palette_value_label.pack(anchor='w',pady=3)
        row=ttk.Frame(palette_page);row.pack(fill='x')
        ttk.Button(row,text='Choose color',command=self.choose_palette_color).pack(side='left')
        ttk.Label(row,text='Alpha').pack(side='left',padx=3)
        ttk.Spinbox(row,from_=0,to=255,textvariable=self.palette_alpha,width=4).pack(side='left')
        self.palette_recolor_button=ttk.Button(palette_page,text='Preview palette-wide recolor',command=lambda:self.guard(lambda:self.generate_palette('recolor')))
        self.palette_recolor_button.pack(fill='x',pady=(6,2))
        self.palette_rebind_button=ttk.Button(palette_page,text='Preview selected region rebind',command=lambda:self.guard(lambda:self.generate_palette('rebind')))
        self.palette_rebind_button.pack(fill='x',pady=2)
        self.palette_accept_button=ttk.Button(palette_page,text='Accept reviewed palette edit',command=lambda:self.guard(self.apply_palette))
        self.palette_accept_button.pack(fill='x',pady=2)
        ttk.Button(palette_page,text='Reject / cancel',command=self.reject).pack(fill='x',pady=2)
        ttk.Checkbutton(palette_page,text='Show proposal preview',variable=self.preview_on,command=self.render).pack(anchor='w')
        self.palette_details_button=ttk.Button(palette_page,text='Review details / warnings',command=lambda:self.guard(self.open_proposal_details))
        self.palette_details_button.pack(fill='x',pady=5)
        cleanup_page=ttk.Frame(self.tools,padding=6);self.tools.add(cleanup_page,text='Cleanup')
        self.cleanup_demo_button=ttk.Button(cleanup_page,text='Original rough-contour diagnostic',command=lambda:self.guard(self.load_cleanup_demo))
        self.cleanup_demo_button.pack(fill='x',pady=2)
        ttk.Label(cleanup_page,text='Canvas action').pack(anchor='w')
        ttk.Combobox(cleanup_page,textvariable=self.canvas_action,values=['Paint','Cleanup selection','Keep cleanup detail'],state='readonly',width=23).pack(fill='x')
        ttk.Label(cleanup_page,text='Selected rectangle: x0 y0 / x1 y1').pack(anchor='w',pady=(5,0))
        self.cleanup_roi=[tk.StringVar(value=str(n)) for n in [0,0,64,64]]
        for pair in [self.cleanup_roi[:2],self.cleanup_roi[2:]]:
            row=ttk.Frame(cleanup_page);row.pack(fill='x')
            for variable in pair:ttk.Entry(row,textvariable=variable,width=9).pack(side='left',padx=2,pady=1)
        self.cleanup_passes=tk.StringVar(value='2');self.cleanup_corner=tk.StringVar(value='55')
        self.cleanup_shift=tk.StringVar(value='1.5');self.cleanup_threshold=tk.StringVar(value='32')
        self.cleanup_remove=tk.StringVar(value='0');self.cleanup_paper=tk.StringVar(value='transparent')
        for controls in [[('Passes',self.cleanup_passes,0,3),('Corner deg',self.cleanup_corner,0,180)],[('Max shift',self.cleanup_shift,0,4),('Core alpha',self.cleanup_threshold,1,255)]]:
            row=ttk.Frame(cleanup_page);row.pack(fill='x',pady=3)
            for label,variable,lo,hi in controls:
                ttk.Label(row,text=label).pack(side='left')
                ttk.Spinbox(row,from_=lo,to=hi,textvariable=variable,width=4,increment=.5 if variable is self.cleanup_shift else 1).pack(side='left',padx=2)
        row=ttk.Frame(cleanup_page);row.pack(fill='x',pady=3)
        ttk.Label(row,text='Remove area <= (0 off)').pack(side='left')
        ttk.Spinbox(row,from_=0,to=32,textvariable=self.cleanup_remove,width=4).pack(side='left',padx=2)
        ttk.Combobox(cleanup_page,textvariable=self.cleanup_paper,values=['transparent','white'],state='readonly',width=20).pack(fill='x')
        self.cleanup_reset_button=ttk.Button(cleanup_page,text='Reset selection / local keep hints',command=lambda:self.guard(self.reset_cleanup))
        self.cleanup_reset_button.pack(fill='x',pady=4)
        self.cleanup_generate_button=ttk.Button(cleanup_page,text='Preview selected cleanup',command=lambda:self.guard(self.generate_cleanup))
        self.cleanup_generate_button.pack(fill='x',pady=2)
        self.cleanup_accept_button=ttk.Button(cleanup_page,text='Accept cleanup version',command=lambda:self.guard(self.apply_cleanup))
        self.cleanup_accept_button.pack(fill='x',pady=2)
        ttk.Button(cleanup_page,text='Reject / cancel',command=self.reject).pack(fill='x',pady=2)
        ttk.Checkbutton(cleanup_page,text='Show proposal preview',variable=self.preview_on,command=self.render).pack(anchor='w')
        self.cleanup_paths_on=tk.BooleanVar(value=False)
        ttk.Checkbutton(cleanup_page,text='Inspect inferred centerlines',variable=self.cleanup_paths_on,command=self.render).pack(anchor='w')
        ttk.Button(cleanup_page,text='Review details / warnings',command=lambda:self.guard(self.open_proposal_details)).pack(fill='x',pady=3)
        ttk.Label(cleanup_page,text='Local raster suggestion. Corner degrees180 disables turn anchors. Keep-detail protects its selected component. Overdraw/anatomy are not inferred.',wraplength=230).pack(pady=4)
        self.cleanup_keep=set();self.cleanup_context=None;self.cleanup_drag=None
        self.canvas = tk.Canvas(body, background='#d3d8df', highlightthickness=0)
        self.canvas.pack(side='left', fill='both', expand=True)
        self.canvas.bind('<Configure>', lambda event: self.render())
        self.canvas.bind('<Button-1>', self.begin_stroke)
        self.canvas.bind('<MouseWheel>',self.packed_wheel)
        self.canvas.bind('<Button-2>',self.packed_pan_start)
        self.canvas.bind('<B2-Motion>',self.packed_pan_move)
        self.canvas.bind('<Double-Button-2>',self.packed_fit)
        self.canvas.bind('<B1-Motion>', self.extend_stroke)
        self.canvas.bind('<ButtonRelease-1>', self.end_stroke)
        timeline = ttk.Frame(root, padding=(10, 0, 10, 10))
        timeline.pack(fill='x')
        self.play_button = ttk.Button(timeline, text='Play', command=self.toggle_play)
        self.play_button.pack(side='left')
        self.playhead = tk.Scale(timeline, from_=0, to=0, orient='horizontal', showvalue=True, command=self.seek, highlightthickness=0)
        self.playhead.pack(side='left', fill='x', expand=True)
        self.time_label = ttk.Label(timeline, text='0 slots')
        self.time_label.pack(side='right', padx=10)
        self.exposure_label = ttk.Label(root, text='', padding=(12, 0, 12, 4))
        self.exposure_label.pack(fill='x')
        ttk.Label(root, textvariable=self.status, relief='sunken', padding=6, wraplength=1050).pack(fill='x')
        root.protocol('WM_DELETE_WINDOW', self.close)
        root.bind('<Control-z>', lambda e: self.history(True))
        root.bind('<Control-y>', lambda e: self.history(False))
        self.photo = None
        self.refresh()

    def guard(self, action):
        try:
            return action()
        except Exception as error:
            self.status.set(str(error))
            return None

    def new_hd_canvas(self):
        if self.confirm_discard():
            from engine.io.project_archive import PixelPlane
            self.replace_session(Session(create(PixelPlane.from_rgba(1920,1080,bytes(1920*1080*4)),1920,1080)))
            self.status.set('New 1920x1080 transparent canvas. Wheel zooms, middle drag pans, double middle click fits. Paint creates a protected version.')

    def canvas_point(self,event,clamp=False):
        if self.session.project and self.session.project['schema_version']=='0.2' and self.packed_transform:
            x0,y0,x1,y1,ox,oy,ow,oh=self.packed_transform
            x=x0+int((event.x-ox)*(x1-x0)//ow);y=y0+int((event.y-oy)*(y1-y0)//oh)
        else:x,y=int((event.x-self.origin[0])//self.zoom),int((event.y-self.origin[1])//self.zoom)
        if clamp:
            w,h=self.session.project['canvas']['width'],self.session.project['canvas']['height']
            x,y=max(0,min(w-1,x)),max(0,min(h-1,y))
        return x,y

    def packed_wheel(self,event):
        if not self.session.project or self.session.project['schema_version']!='0.2':return
        old=self.view_factor;self.view_factor=max(1,min(32,old*(2 if event.delta>0 else .5)));ratio=self.view_factor/old
        cx,cy=self.canvas.winfo_width()/2,self.canvas.winfo_height()/2
        self.view_pan=((event.x-cx)*(1-ratio)+self.view_pan[0]*ratio,(event.y-cy)*(1-ratio)+self.view_pan[1]*ratio)
        self.render()

    def packed_pan_start(self,event):self.pan_anchor=(event.x,event.y,self.view_pan)

    def packed_pan_move(self,event):
        if self.session.project and self.session.project['schema_version']=='0.2' and self.pan_anchor:
            x,y,old=self.pan_anchor;self.view_pan=(old[0]+event.x-x,old[1]+event.y-y);self.render()

    def packed_fit(self,event=None):self.view_factor=1;self.view_pan=(0,0);self.render()

    def render_packed_idle(self):
        self.packed_ticket=None
        if self.session.project and self.session.project['schema_version']=='0.2':
            self.canvas.delete('all');self.render_packed_canvas()
        else:self.render()

    def render_packed_canvas(self):
        import math
        from engine.io.project_archive import PixelPlane
        from engine.packed_render import render,png_bytes,checker
        project=self.part_display_project();w,h=project['canvas']['width'],project['canvas']['height']
        cw,ch=max(1,self.canvas.winfo_width()),max(1,self.canvas.winfo_height())
        scale=min(max(1,cw-32)/w,max(1,ch-32)/h,1)*self.view_factor
        self.zoom=scale;self.origin=((cw-w*scale)/2+self.view_pan[0],(ch-h*scale)/2+self.view_pan[1]);ox,oy=self.origin
        x0,y0=max(0,math.floor(-ox/scale)),max(0,math.floor(-oy/scale))
        x1,y1=min(w,math.ceil((cw-ox)/scale)),min(h,math.ceil((ch-oy)/scale))
        drawing=project['drawings'][self.session.drawing_id()];overrides={}
        current=self.preview_current()
        if current and self.preview_on.get() and self.motion_preview is not None:
            for layer,output in self.motion_preview['outputs'].items():overrides[layer]=output['pixels']
        elif current and self.preview_on.get() and getattr(self,'reference_preview',None) is not None:
            for identity,update in self.reference_preview['updates'].items():
                region=project['fill_regions'][identity]
                if region['start']<=self.session.slot<region['start']+region['length']:overrides[region['fill_layer']]=update['pixels']
        elif current and self.preview_on.get() and self.palette_preview is not None:
            for identity,update in self.palette_preview['updates'].items():
                region=project['fill_regions'][identity]
                if region['start']<=self.session.slot<region['start']+region['length']:overrides[region['fill_layer']]=update['pixels']
        elif current and self.preview_on.get() and self.fill_preview is not None and self.fill_preview.get('adapter'):
            from engine.roi_assistance import accept_fill_roi
            job=read(self.job/'job.json')
            project,_=accept_fill_roi(project,self.fill_preview,self.session.layer_id,self.session.slot,'preview-'+job['job_id'],job.get('region_id') if job['operation']=='revise_accepted_fill' else None)
        elif current and self.preview_on.get() and isinstance(self.preview,PixelPlane):overrides[self.session.layer_id]=self.preview
        if self.packed_stroke is not None and self.stroke_active:
            overrides[self.session.layer_id]=self.packed_stroke.planes()[0]
        if x0>=x1 or y0>=y1:
            self.packed_transform=None;self.render_labels(drawing);return
        ow,oh=max(1,min(cw,round((x1-x0)*scale))),max(1,min(ch,round((y1-y0)*scale)))
        px,py=round(ox+x0*scale),round(oy+y0*scale);self.packed_transform=(x0,y0,x1,y1,px,py,ow,oh)
        _,_,raw=render(project,self.session.slot,(ow,oh),(x0,y0,x1,y1),overrides)
        self.checker_photo=tk.PhotoImage(master=self.root,data=png_bytes(ow,oh,checker(ow,oh)))
        self.canvas.create_image(px,py,image=self.checker_photo,anchor='nw')
        self.photo=tk.PhotoImage(master=self.root,data=png_bytes(ow,oh,raw));self.canvas.create_image(px,py,image=self.photo,anchor='nw')
        if self.tools.index(self.tools.select())==5 or self.canvas_action.get()=='Cleanup selection':
            try:roi=[int(v.get()) for v in self.cleanup_roi]
            except ValueError:roi=None
            if roi:self.canvas.create_rectangle(ox+roi[0]*scale,oy+roi[1]*scale,ox+roi[2]*scale,oy+roi[3]*scale,outline='#c48221',width=2)
        if current and self.cleanup_preview is not None and self.cleanup_paths_on.get():
            for component in self.cleanup_preview['components']:
                for path in component.get('paths',[]):
                    points=[v for p in path['curve'] for v in (ox+p[0]*scale,oy+p[1]*scale)]
                    if len(points)>=4:self.canvas.create_line(*points,fill='#df5c26',width=1)
        if self.tools.index(self.tools.select())==3 and self.boundary_on.get():
            from engine.roi_assistance import mask_indices
            marks=[(self.fill_add,'#d738af'),(self.fill_open,'#27b85c')]
            if current and self.fill_preview is not None and self.fill_preview.get('adapter'):
                r=self.fill_preview;marks += [(mask_indices(r['boundary_mask'],r['roi']),'#c7a72a'),(mask_indices(r['added_barriers_mask'],r['roi']),'#d738af'),(r['protected_pixels'],'#327ed0')]
            for values,color in marks:
                for i in values:
                    x,y=i%w,i//w
                    if x0<=x<x1 and y0<=y<y1:self.canvas.create_rectangle(ox+x*scale,oy+y*scale,ox+(x+1)*scale,oy+(y+1)*scale,outline=color)
        self.render_labels(drawing)


    def open_schedules(self):
        if not self.session.project:raise ValueError('Open a project first')
        if getattr(self,'schedules_panel',None) and self.schedules_panel.window.winfo_exists():self.schedules_panel.window.lift();return
        from hosts.standalone.schedules_panel import SchedulesPanel
        self.schedules_panel=SchedulesPanel(self)

    def open_region_seeds(self):
        if not self.session.project:raise ValueError('Open a project first')
        if not any(r['start']<=self.session.slot<r['start']+r['length'] for r in self.session.project.get('fill_regions',{}).values()):raise ValueError('No accepted region at this playhead')
        if getattr(self,'seed_panel',None) and self.seed_panel.window.winfo_exists():self.seed_panel.window.lift();return
        from hosts.standalone.region_seeds_panel import RegionSeedsPanel
        self.seed_panel=RegionSeedsPanel(self)

    def open_parts(self):
        if not self.session.project:raise ValueError('Open a project first')
        if getattr(self,'part_panel',None) and self.part_panel.window.winfo_exists():self.part_panel.window.lift();return
        from hosts.standalone.parts_panel import PartsPanel
        actor=self.motion_panel.actor_id() if getattr(self,'motion_panel',None) else self.session.layer_id
        self.part_panel=PartsPanel(self,actor)

    def part_display_project(self):
        if self.part_preview is None or self.part_preview.get('unsafe_reasons') or not self.preview_on.get() or not self.preview_current():return self.session.project
        from engine.raster_parts import accept
        job=read(self.job/'job.json');key=(self.session.project['revision'],job['job_id'])
        if self.part_preview_cache is None or self.part_preview_cache[0]!=key:self.part_preview_cache=(key,accept(self.session.project,self.part_preview,'preview-'+job['job_id']))
        return self.part_preview_cache[1]

    def open_motion(self):
        from hosts.standalone.motion_panel import MotionPanel
        if not self.session.project:raise ValueError('Open a drawing/project first')
        if getattr(self,'motion_panel',None) and self.motion_panel.window.winfo_exists():self.motion_panel.window.lift();return
        self.motion_panel=MotionPanel(self)

    def open_references(self):
        from hosts.standalone.references_panel import ReferencePanel
        if not self.session.project:raise ValueError('Open a drawing/project first')
        if getattr(self,'reference_panel',None) and self.reference_panel.window.winfo_exists():self.reference_panel.window.lift();return
        self.reference_panel=ReferencePanel(self)

    def confirm_discard(self):
        return not self.session.dirty or messagebox.askyesno('Unsaved edits', 'Discard unsaved edits?', parent=self.root)

    def replace_session(self, session):
        if getattr(self,'part_panel',None) and self.part_panel.window.winfo_exists():self.part_panel.close()
        self.part_panel=None
        if getattr(self,'motion_panel',None) and self.motion_panel.window.winfo_exists():self.motion_panel.close()
        self.motion_panel=None
        if getattr(self,'reference_panel',None) and self.reference_panel.window.winfo_exists():self.reference_panel.close()
        self.reference_panel=None
        self.cancel()
        self.preview = None
        self.job = None
        self.playing = False
        if self.timer is not None:
            self.root.after_cancel(self.timer)
            self.timer = None
        self.play_button.configure(text='Play')
        self.palette_preview=None
        self.session = session
        self.packed_stroke=None;self.stroke={};self.stroke_active=False
        self.view_factor=1;self.view_pan=(0,0);self.packed_transform=None
        self.clear_fill_hints(render_now=False)
        self.reset_cleanup(render_now=False)
        self.refresh()

    def load_demo(self):
        if self.confirm_discard():
            self.replace_session(Session(demo()))
            self.status.set('Integration demo: 2 drawings / 12 slots / holds 4 and 8. Paint, retime, save, or generate a shift.')

    def open_project(self):
        if not self.confirm_discard():
            return
        path = filedialog.askopenfilename(parent=self.root, filetypes=[('Assistant project', '*.aaa *.aaa.json *.json')])
        if path:
            self.replace_session(Session.load(path))
            self.status.set('Opened ' + Path(path).name)

    def import_native(self):
        if not self.confirm_discard():
            return
        path = filedialog.askopenfilename(parent=self.root, filetypes=[('Restricted native KRA raster import', '*.kra')])
        if path:
            self.replace_session(Session(import_kra(path)))
            self.status.set('Imported native raster layers/groups; original archive retained. Restricted RGBA8/normal-group support; see compatibility matrix.')

    def import_openraster(self):
        if not self.confirm_discard():
            return
        path=filedialog.askopenfilename(parent=self.root,filetypes=[('OpenRaster layered artwork','*.ora')])
        if path:
            try:
                document=import_ora(path)
            except StaleEmbeddedProject:
                if not messagebox.askyesno('Externally edited layers','Layers were edited outside the assistant. Import them as a new still project? The original file will be kept.',parent=self.root):
                    self.status.set('Import cancelled; current project preserved.')
                    return
                document=import_ora(path,prefer_project=False)
            session=Session(document['project'])
            session.layer_id=document['selected_layer_id']
            session.slot=document['slot']
            self.replace_session(session)
            message='Restored complete project and timing.' if document['metadata_state']=='restored_verified' else 'Imported editable layered still.'
            self.status.set(message+' '+' '.join(document['warnings']))

    def export_layers(self):
        if not self.session.project:
            raise ValueError('Open a project first')
        parent=filedialog.askdirectory(parent=self.root,title='Choose parent folder for a NEW layered project export')
        if parent:
            target=Path(parent)/('layered-'+uuid.uuid4().hex[:8])
            export_bundle(self.session.project,target,self.session.layer_id,self.session.slot)
            for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:
                (target/name).write_bytes((ROOT/'generated'/name).read_bytes())
            self.status.set('Exported editable project.ora, project sidecar and layered frame schedule: '+str(target))

    def import_png(self):
        if not self.confirm_discard():
            return
        path = filedialog.askopenfilename(parent=self.root, filetypes=[('sRGB PNG (large inputs:8bit RGB/RGBA)', '*.png')])
        if path:
            if Path(path).stat().st_size>64*1024*1024:raise ValueError('PNG exceeds64MiB encoded bound')
            with Path(path).open('rb') as stream:data=stream.read(64*1024*1024+1)
            large=len(data)>2_000_000 or len(data)>=24 and max(int.from_bytes(data[16:20],'big'),int.from_bytes(data[20:24],'big'))>256
            width,height,pixels=read_png(data,packed=large)
            project = create(pixels, width, height)
            project['project_id'] = Path(path).stem
            project['import_note'] = 'Noninterlaced PNG samples <=8bits expanded to RGBA8; sRGB input required, no ICC/HDR conversion; exact original bytes retained'
            if large:
                from engine.io.project_archive import SourceBlob
                project['png_source']={'filename':Path(path).name,'sha256':hashlib.sha256(data).hexdigest(),'blob':SourceBlob(data)}
            else:
                project['png_source']={'filename':Path(path).name,'sha256':hashlib.sha256(data).hexdigest(),'encoded_base64':base64.b64encode(data).decode('ascii')}
            self.replace_session(Session(project))
            self.status.set('Imported PNG as editable RGBA8. Exact original file and pixel snapshot retained; sRGB input required.')

    def save_project(self):
        if not self.session.project:
            raise ValueError('Open a project first')
        path = filedialog.asksaveasfilename(parent=self.root, defaultextension='.aaa', filetypes=[('Compact assistant project', '*.aaa'),('Legacy JSON project','*.aaa.json')])
        if path:
            self.session.save(path)
            self.status.set('Saved editable project with originals, corrections, approvals and exposures.')

    def export(self):
        if not self.session.project:
            raise ValueError('Open a project first')
        parent = filedialog.askdirectory(parent=self.root, title='Choose parent folder for a NEW animation export')
        if parent:
            target = Path(parent) / ('animation-' + uuid.uuid4().hex[:8])
            if self.session.project['schema_version']=='0.2':
                from engine.io.packed_export import export_bundle as packed_export
                packed_export(self.session.project,target,ROOT/'generated')
                self.status.set('Exported editable packed project, flattened exposure PNGs and rational timing: '+str(target));return
            export_animation(self.session.project, target, png)
            for name in ['credits.json', 'CREDITS.md', 'THIRD_PARTY_NOTICES.txt']:
                (target / name).write_bytes((ROOT / 'generated' / name).read_bytes())
            self.status.set('Exported lossless input PNGs, exposure CSV and project sidecar: ' + str(target))

    def choose_color(self):
        value = colorchooser.askcolor(parent=self.root)
        if value[0]:
            self.color = [int(c) for c in value[0]] + [255]

    def history(self, undo):
        if self.session.project and self.session.travel(undo):
            self.preview = None
            self.refresh()
            self.status.set('Undone.' if undo else 'Redone.')

    def change_hold(self):
        self.require_paint()
        self.session.hold(int(self.hold_value.get()))
        self.refresh()
        self.status.set('Moved the cut; clip duration and following drawings retained.')

    def seek(self, value):
        if self.session.project:
            self.session.slot = int(float(value))
            self.render()

    def refresh(self):
        project = self.session.project
        previous = self.layer_tree.selection()
        self.layer_tree.delete(*self.layer_tree.get_children())
        if project:
            def insert(parent):
                for identity, layer in project['layers'].items():
                    if layer.get('parent_id') == parent:
                        self.layer_tree.insert(parent or '', 'end', iid=identity, text=layer['name'], open=True)
                        insert(identity)
            insert(None)
            selected = previous[0] if previous and previous[0] in project['layers'] else self.session.layer_id
            self.layer_tree.selection_set(selected)
        self.refresh_palette()
        self.playhead.configure(to=project['shot']['duration_frames'] - 1 if project else 0)
        self.playhead.set(self.session.slot)
        self.render()

    def select_layer(self, event=None):
        if not self.session.project or not self.layer_tree.selection():
            return
        identity = self.layer_tree.selection()[0]
        layer = self.session.project['layers'][identity]
        self.layer_visible.set(layer.get('visible', True))
        self.layer_locked.set(layer.get('locked', False))
        if layer.get('nodetype', 'paintlayer') == 'paintlayer':
            self.session.layer_id = identity
        self.render()

    def layer_flag(self, flag, value):
        if not self.layer_tree.selection() or not self.session.project:
            raise ValueError('Select a layer first')
        identity = self.layer_tree.selection()[0]
        result = deepcopy(self.session.project)
        result['layers'][identity][flag] = bool(value)
        self.session.commit(result, 'set-layer-' + flag)
        self.refresh()

    def require_paint(self):
        if not self.session.project or not self.layer_tree.selection():
            raise ValueError('Select a raster layer first')
        identity = self.layer_tree.selection()[0]
        if self.session.project['layers'][identity].get('nodetype', 'paintlayer') != 'paintlayer':
            raise ValueError('Group selected; choose a raster child to edit')
        if not layer_visible(self.session.project, identity):
            raise ValueError('Make this layer and its ancestor groups visible before editing')
        parent = identity
        while parent is not None:
            if self.session.project['layers'][parent].get('locked', False):
                raise ValueError('Layer or ancestor is locked; explicitly unlock it to edit a new revision')
            parent = self.session.project['layers'][parent].get('parent_id')
        self.session.layer_id = identity
        return identity

    def render(self):
        project = self.session.project
        if project and project['schema_version']=='0.2':
            if self.packed_ticket is None:self.packed_ticket=self.root.after_idle(self.render_packed_idle)
            return
        self.canvas.delete('all')
        if not project:
            self.canvas.create_text(300, 180, text='Open a project or start the integration demo.', fill='#354057')
            return
        width, height = project['canvas']['width'], project['canvas']['height']
        self.zoom = max(1, min(8, (max(100, self.canvas.winfo_width()) - 32) // width, (max(100, self.canvas.winfo_height()) - 32) // height))
        self.origin = ((self.canvas.winfo_width() - width * self.zoom) // 2, (self.canvas.winfo_height() - height * self.zoom) // 2)
        ox, oy = self.origin
        for y in range(0, height, 8):
            for x in range(0, width, 8):
                self.canvas.create_rectangle(ox + x * self.zoom, oy + y * self.zoom, ox + min(width, x + 8) * self.zoom, oy + min(height, y + 8) * self.zoom, fill='#ffffff' if (x // 8 + y // 8) % 2 else '#e5e8ed', outline='')
        try:
            identifier = self.session.drawing_id()
        except StopIteration:
            self.status.set('No drawing exposed at this slot.')
            return
        drawing = project['drawings'][identifier]
        pixels = deepcopy(drawing['pixels'])
        overrides={}
        preview_project=project
        preview_current=self.preview_current()
        if preview_current and self.preview_on.get():
            job=read(self.job/'job.json')
            if job['operation']=='raster_part_partition':
                preview_project=self.part_display_project()
                e=next(e for e in preview_project['exposures'] if e['layer_id']==self.session.layer_id and e['start']<=self.session.slot<e['start']+e['length'])
                pixels=deepcopy(preview_project['drawings'][e['drawing_id']]['pixels'])
            elif job['operation']=='landmark_motion':
                for layer,output in self.motion_preview['outputs'].items():overrides[layer]=output['pixels']
            elif job['operation']=='reference_role_assignment':
                for identity,update in self.reference_preview['updates'].items():
                    region=project['fill_regions'][identity]
                    if region['start']<=self.session.slot<region['start']+region['length']:overrides[region['fill_layer']]=update['pixels']
            elif job['operation']=='palette_identity_edit':
                for identity,update in self.palette_preview['updates'].items():
                    region=project['fill_regions'][identity]
                    if region['start']<=self.session.slot<region['start']+region['length']:
                        overrides[region['fill_layer']]=update['pixels']
            elif job['operation']=='add_shared_ink_region':
                preview_project,_=accept_additional(project,self.fill_preview,job['region_id'],'preview-'+uuid.uuid4().hex)
            elif job['operation']=='revise_accepted_fill':
                region=project['fill_regions'][job['region_id']]
                overrides[region['fill_layer']]=self.fill_preview['fill']
            else:
                pixels=deepcopy(self.preview)
        for index, value in self.stroke.items():
            pixels[index] = value
        overrides.setdefault(self.session.layer_id,pixels)
        pixels = render_layers(preview_project, self.session.slot, overrides)
        self.photo = tk.PhotoImage(master=self.root, data=png(width, height, pixels)).zoom(self.zoom)
        self.canvas.create_image(ox, oy, image=self.photo, anchor='nw')
        if self.boundary_on.get():
            colors={}
            if self.fill_preview is not None and preview_current:
                colors.update({i:'#e6ab22' for i in self.fill_preview['added_barriers']})
                colors.update({i:'#5b70e8' for i in self.fill_preview.get('protected_pixels',[])})
            if self.fill_context==self.fill_key():
                colors.update({i:'#e934bc' for i in self.fill_add})
                colors.update({i:'#159a63' for i in self.fill_open})
            for index,color in colors.items():
                x,y=index%width,index//width
                self.canvas.create_rectangle(ox+x*self.zoom,oy+y*self.zoom,ox+(x+1)*self.zoom,oy+(y+1)*self.zoom,outline=color,width=2)

        if hasattr(self,'cleanup_roi'):
            try:roi=[int(v.get()) for v in self.cleanup_roi]
            except ValueError:roi=None
            if roi and self.tools.index(self.tools.select())==5:
                self.canvas.create_rectangle(ox+roi[0]*self.zoom,oy+roi[1]*self.zoom,ox+roi[2]*self.zoom,oy+roi[3]*self.zoom,outline='#c48221',dash=(4,3),width=2)
                for index in self.cleanup_keep:
                    x,y=index%width,index//width
                    self.canvas.create_rectangle(ox+x*self.zoom,oy+y*self.zoom,ox+(x+1)*self.zoom,oy+(y+1)*self.zoom,outline='#2b9a68',width=2)
            if self.cleanup_preview is not None and preview_current and self.cleanup_paths_on.get():
                for component in self.cleanup_preview['components']:
                    for path in component.get('paths',[]):
                        coordinates=[v for p in path['curve'] for v in (ox+p[0]*self.zoom,oy+p[1]*self.zoom)]
                        if len(coordinates)>=4:self.canvas.create_line(*coordinates,fill='#d98126',width=1)
        self.render_labels(drawing)

    def render_labels(self,drawing):
        project=self.session.project
        self.drawing_label.configure(text=f'{project["layers"][self.session.layer_id]["name"][:32]}\n{drawing["origin"]}\nApproved: {drawing["approved"]} · Locked: {drawing["locked"]}')
        if self.layer_tree.selection() and project['layers'][self.layer_tree.selection()[0]].get('nodetype', 'paintlayer') == 'grouplayer':
            self.drawing_label.configure(text='Group selected. Choose a raster child in Layers to edit.')
        fps = project['shot']['fps']
        self.time_label.configure(text=f'{self.session.slot + 1} / {project["shot"]["duration_frames"]} slots · {fps["numerator"] / fps["denominator"]:g} fps')
        self.exposure_label.configure(text='Selected layer holds: ' + ' | '.join(f'{e["start"]}–{e["start"] + e["length"] - 1}: {e["length"]} slots' for e in project['exposures'] if e['layer_id'] == self.session.layer_id))

    def preview_current(self):
        if self.preview is None or not self.job or not self.session.project:
            return False
        job=read(self.job/'job.json')
        if job['operation']=='raster_part_partition':
            from engine.raster_parts import subject
            try:return (job['settings']['source_slot']==self.session.slot or job['settings']['target_start']<=self.session.slot<job['settings']['target_end']) and subject(self.session.project,job['settings'])[0]==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):return False
        if job['operation']=='landmark_motion':
            from engine.motion import subject
            try:
                guide=self.session.project['motion_guides'][job['settings']['guide_id']]
                return (self.session.slot==guide['source_slot'] or job['settings']['target_start']<=self.session.slot<job['settings']['target_end']) and subject(self.session.project,job['settings'])[0]==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):return False
        if job['operation']=='reference_role_assignment':
            from engine.references import dependency
            try:return dependency(self.session.project,job['settings'])[0]==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):return False
        if job['operation']=='selected_contour_cleanup':
            if self.session.layer_id!=self.job_layer or self.session.drawing_id()!=self.preview_input or self.session.slot!=job['slot']:return False
            try:return cleanup_subject(self.session.project,job['layer_id'],job['slot'],job['settings'])[0]==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):return False
        if job['operation']=='palette_identity_edit':
            try:return palette_dependency(self.session.project,job['settings'])[0]==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):return False
        if self.session.drawing_id()!=self.preview_input or self.session.layer_id!=self.job_layer:
            return False
        if self.fill_preview is not None and self.session.slot!=job['slot']:
            return False
        if job.get('roi_adapter') and self.fill_preview is not None:
            from engine.roi_assistance import fill_scope
            try:return fill_scope(self.session.project,job['layer_id'],job['slot'],job['settings'],job['roi'],job.get('region_id') if job['operation']=='revise_accepted_fill' else None)[0]==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):return False
        if job['operation']=='add_shared_ink_region':
            try:return additional_dependency(self.session.project,job['region_id'],job['settings'])==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):return False
        if job['operation']=='revise_accepted_fill':
            try:
                return region_dependency(self.session.project,job['region_id'],job['settings'])==job['dependency_sha256']
            except (ValueError,KeyError,StopIteration):
                return False
        return self.session.project['revision']==self.preview_revision

    def cleanup_key(self):
        if not self.session.project:return None
        project=self.session.project
        return (self.session.layer_id,self.session.drawing_id(),cleanup_subject(project,self.session.layer_id,self.session.slot,cleanup_defaults(project['canvas']['width'],project['canvas']['height']))[0])

    def reset_cleanup(self,render_now=True):
        project=self.session.project
        width,height=(project['canvas']['width'],project['canvas']['height']) if project else (64,64)
        roi=[0,0,min(width,224),min(height,224)] if project and project['schema_version']=='0.2' else [0,0,width,height]
        for variable,value in zip(self.cleanup_roi,roi):variable.set(str(value))
        self.cleanup_keep=set();self.cleanup_drag=None;self.cleanup_preview=None
        try:self.cleanup_context=self.cleanup_key()
        except ValueError:self.cleanup_context=None
        if render_now:self.render()

    def load_cleanup_demo(self):
        if not self.confirm_discard():return
        width,height=96,64;pixels=[[0,0,0,0] for _ in range(width*height)]
        for x in range(6,74):
            y=16+[0,1,0,-1][x%4]
            for yy in range(y-1,y+2):pixels[yy*width+x]=[65,95,155,210]
        for x in range(10,36):
            for yy in range(39,42):pixels[yy*width+x]=[175,85,45,255]
        for y in range(40,58):
            for xx in range(33,36):pixels[y*width+xx]=[175,85,45,255]
        pixels[15*width+82]=[30,160,100,255]
        pixels[42*width+82]=[90,90,100,255]
        project=create(pixels,width,height);project['project_id']='original-cleanup-diagnostic'
        self.replace_session(Session(project));self.cleanup_passes.set('2');self.cleanup_remove.set('0');self.cleanup_paper.set('transparent')
        self.canvas_action.set('Cleanup selection');self.tools.select(5)
        self.status.set('Original diagnostic: shaky contour, deliberate corner, deliberate green dot and gray speck. Selection/keep-detail is explicit; tiny area alone does not identify noise.')

    def cleanup_click(self,event,begin=False):
        self.require_paint()
        width,height=self.session.project['canvas']['width'],self.session.project['canvas']['height']
        x,y=self.canvas_point(event,clamp=True)
        if self.cleanup_context!=self.cleanup_key():self.reset_cleanup(render_now=False)
        self.preview=None;self.cleanup_preview=None;self.cancel()
        if self.canvas_action.get()=='Keep cleanup detail':self.cleanup_keep.add(y*width+x)
        else:
            if begin:self.cleanup_drag=(x,y)
            if self.cleanup_drag is None:return
            sx,sy=self.cleanup_drag
            for variable,value in zip(self.cleanup_roi,[min(sx,x),min(sy,y),max(sx,x)+1,max(sy,y)+1]):variable.set(str(value))
            if self.tools.index(self.tools.select())==3:self.fill_seed_label.configure(text='Selected area '+str([int(v.get()) for v in self.cleanup_roi])+'. Choose Fill seed and click inside.')
        self.render()

    def current_cleanup_settings(self):
        self.require_paint()
        if self.cleanup_context!=self.cleanup_key():raise ValueError('Drawing input changed; reset cleanup selection/hints for the current source')
        project=self.session.project;settings=cleanup_defaults(project['canvas']['width'],project['canvas']['height'])
        settings.update(roi=[int(v.get()) for v in self.cleanup_roi],iterations=int(self.cleanup_passes.get()),corner_angle=int(self.cleanup_corner.get()),max_shift=float(self.cleanup_shift.get()),max_remove_area=int(self.cleanup_remove.get()),threshold=int(self.cleanup_threshold.get()),paper=self.cleanup_paper.get(),keep_pixels=sorted(self.cleanup_keep))
        return settings

    def generate_cleanup(self):
        self.require_paint()
        if self.process and self.process.poll() is None:raise ValueError('A job is already running')
        if self.cleanup_context is None:self.reset_cleanup(render_now=False)
        settings=self.current_cleanup_settings()
        self.preview=None;self.fill_preview=None;self.palette_preview=None;self.cleanup_preview=None
        self.job=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex
        create_cleanup_job(self.session.project,self.session.layer_id,self.session.slot,settings,self.job)
        self.job_layer=self.session.layer_id;self.launch_job()

    def apply_cleanup(self):
        if self.cleanup_preview is None or not self.job:raise ValueError('Preview a cleanup candidate first')
        job=read(self.job/'job.json')
        if job['operation']!='selected_contour_cleanup' or self.current_cleanup_settings()!=job['settings']:raise ValueError('Cleanup controls changed; regenerate before accepting')
        self.session.apply(self.job);self.preview=None;self.cleanup_preview=None
        self.cleanup_context=self.cleanup_key();self.refresh()
        self.status.set('Accepted a new cleanup drawing version for this hold. Source, protected details and other holds/layers remain; Undo is available.')

    def fill_key(self):
        if not self.session.project:
            return None
        if self.fill_region:
            region=self.session.project.get('fill_regions',{}).get(self.fill_region)
            if region and self.session.layer_id==region['ink_layer']:
                settings=dict(region['settings'],paper='transparent')
                if region.get('region_format')=='packed_roi_v1':
                    from engine.roi_assistance import fill_scope
                    return (self.session.layer_id,self.session.drawing_id(),fill_scope(self.session.project,region['ink_layer'],self.session.slot,settings,region['roi'],self.fill_region)[0])
                return (self.session.layer_id,self.session.drawing_id(),region_dependency(self.session.project,self.fill_region,settings))
        return (self.session.layer_id,self.session.drawing_id(),self.session.project['revision'])

    def load_regions_demo(self):
        if not self.confirm_discard():return
        pixels=[[0,0,0,0] for _ in range(32*16)]
        for y in range(3,13):
            for x in range(3,29):
                if x in {3,11,20,28} or y in {3,12}:pixels[y*32+x]=[35,45,65,255]
        pixels[7*32+11]=[35,45,65,80]
        pixels[7*32+20]=[35,45,65,80]
        project=create(pixels,32,16)
        project['project_id']='original-three-region-palette-diagnostic'
        self.replace_session(Session(project))
        self.fill_paper.set('transparent');self.fill_radius.set('0')
        self.fill_palette.set('shared');self.color=[80,155,220,255]
        self.canvas_action.set('Fill seed');self.tools.select(3)
        self.status.set('Original three-compartment diagnostic. Fill one interior; then Palette > select region > Add region on shared ink for the others.')

    def refresh_palette(self):
        previous=self.region_tree.selection()
        self.region_tree.delete(*self.region_tree.get_children())
        project=self.session.project
        self.palette_combo.configure(values=sorted(project.get('palettes',{})) if project else [])
        if project:
            for identity,region in project.get('fill_regions',{}).items():
                name=project['layers'][region['fill_layer']]['name']
                self.region_tree.insert('','end',iid=identity,text=name,values=(region['palette_id'],))
            if previous and previous[0] in project.get('fill_regions',{}):self.region_tree.selection_set(previous[0])

    def selected_palette_region(self):
        selection=self.region_tree.selection()
        if not selection:raise ValueError('Select a region in the Palette list')
        return selection[0]

    def start_additional_region(self):
        identity=self.selected_palette_region()
        region=self.session.project['fill_regions'][identity]
        self.session.slot=region['start']
        self.layer_tree.selection_set(region['fill_layer'])
        self.load_fill_region()
        self.fill_new_region=True
        self.fill_seed=None
        self.canvas_action.set('Fill seed')
        self.fill_seed_label.configure(text='New region on shared ink: click another interior seed.')
        self.status.set('Choose another region seed. The existing ink/group will be reused; overlapping interiors require explicit repair.')

    def load_palette_color(self):
        if not self.session.project:raise ValueError('Open a project first')
        entry=self.session.project.get('palettes',{}).get(self.palette_choice.get())
        if entry is None:raise ValueError('New identity: choose color/alpha, then preview palette-wide edit to create it')
        self.palette_rgb=entry['rgba'][:3]
        self.palette_alpha.set(str(entry['rgba'][3]))
        self.palette_value_label.configure(text='#'+''.join(f'{c:02x}' for c in self.palette_rgb)+' / alpha'+self.palette_alpha.get())

    def choose_palette_color(self):
        value=colorchooser.askcolor(parent=self.root)
        if value[0]:
            self.palette_rgb=[int(c) for c in value[0]]
            self.palette_value_label.configure(text='#'+''.join(f'{c:02x}' for c in self.palette_rgb)+' / alpha'+self.palette_alpha.get())

    def current_palette_request(self,action):
        result=dict(action=action,palette_id=self.palette_choice.get())
        if action=='recolor':result['rgba']=self.palette_rgb[:]+[int(self.palette_alpha.get())]
        else:result['region_id']=self.selected_palette_region()
        return result

    def generate_palette(self,action):
        if not self.session.project:raise ValueError('Open a project first')
        if self.process and self.process.poll() is None:raise ValueError('A job is already running')
        request=self.current_palette_request(action)
        if action=='rebind':
            self.session.slot=self.session.project['fill_regions'][request['region_id']]['start']
            self.playhead.set(self.session.slot)
        self.preview=None;self.fill_preview=None;self.palette_preview=None
        self.job=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex
        create_palette_job(self.session.project,request,self.job)
        self.job_layer=None
        self.launch_job()

    def apply_palette(self):
        if self.palette_preview is None or not self.job:raise ValueError('Preview a palette edit first')
        job=read(self.job/'job.json')
        if job['operation']!='palette_identity_edit' or self.current_palette_request(job['settings']['action'])!=job['settings']:raise ValueError('Palette controls changed; regenerate before accepting')
        self.session.apply(self.job)
        self.preview=None;self.palette_preview=None
        self.refresh()
        self.status.set('Accepted explicit palette edit. Region identity, artist overrides, source and old versions retained; Undo is available.')

    def load_fill_region(self):
        if not self.session.project or not self.layer_tree.selection():
            raise ValueError('Select an accepted fill, ink or region group in Layers')
        selected=self.layer_tree.selection()[0]
        choices=[(i,r) for i,r in self.session.project.get('fill_regions',{}).items() if selected in {i,r['ink_layer'],r['fill_layer']} and r['start']<=self.session.slot<r['start']+r['length']]
        if len(choices)!=1:
            raise ValueError('Select one accepted region layer at its held exposure')
        identity,region=choices[0]
        if region.get('region_format')=='motion_region_v1':raise ValueError('This transported region exceeds the224pixel local fill limit. Painting and palette/reference edits remain available; boundary regeneration needs explicit rebind.')
        region_inputs(self.session.project,identity)
        self.cancel()
        self.preview=None
        self.clear_fill_hints(render_now=False)
        self.fill_region=identity
        self.session.layer_id=region['ink_layer']
        self.session.slot=region['start']
        settings=region['settings']
        if region.get('region_format')=='packed_roi_v1':
            for variable,value in zip(self.cleanup_roi,region['roi']):variable.set(str(value))
            self.cleanup_context=self.cleanup_key()
        self.fill_seed=settings['seed'][:]
        self.fill_add=set(settings['add_barriers'])
        self.fill_open=set(settings['keep_open'])
        self.fill_radius.set(str(settings['gap_radius']))
        self.fill_threshold.set(str(settings['threshold']))
        self.fill_overlap.set(settings['overlap'])
        self.fill_paper.set('transparent')
        self.fill_palette.set(settings['palette_id'])
        self.color=settings['color'][:]
        self.fill_context=self.fill_key()
        self.fill_seed_label.configure(text=f'Accepted region v{region.get("version",0)}; seed {self.fill_seed}; edit boundary and preview again.')
        self.canvas_action.set('Add barrier')
        self.tools.select(3)
        self.refresh()
        self.layer_tree.selection_set(self.session.layer_id)
        self.render()
        self.status.set('Loaded accepted boundary. Revision updates this fill only; painted and erased corrections remain protected.')

    def clear_fill_hints(self,render_now=True):
        self.fill_add,self.fill_open=set(),set()
        self.fill_seed=None
        self.fill_region=None
        self.fill_new_region=False
        self.fill_context=None
        self.fill_preview=None
        if hasattr(self,'fill_seed_label'):
            self.fill_seed_label.configure(text='Choose Fill seed, then click inside.')
        if render_now and hasattr(self,'canvas'):
            self.render()

    def load_fill_demo(self):
        if not self.confirm_discard():
            return
        pixels=[[0,0,0,0] for _ in range(32*32)]
        for y in range(5,27):
            for x in range(5,27):
                if x in {5,26} or y in {5,26}:
                    pixels[y*32+x]=[35,45,65,255]
        project=create(pixels,32,32)
        project['project_id']='original-line-fill-diagnostic'
        self.replace_session(Session(project))
        self.canvas_action.set('Fill seed')
        self.fill_paper.set('transparent')
        self.fill_radius.set('0')
        self.color=[80,155,220,255]
        self.status.set('Original synthetic line-art diagnostic. Click an interior seed, preview, then accept editable fill layers.')

    def boundary_click(self,event):
        self.require_paint()
        x,y=self.canvas_point(event)
        width,height=self.session.project['canvas']['width'],self.session.project['canvas']['height']
        if not (0<=x<width and 0<=y<height):
            return
        if self.fill_context!=self.fill_key():
            if self.fill_region:
                raise ValueError('Accepted-region inputs changed; reload its boundary before editing')
            self.clear_fill_hints()
            self.fill_context=self.fill_key()
        self.preview=None
        self.fill_preview=None
        self.cancel()
        if self.canvas_action.get()=='Fill seed':
            self.fill_seed=[x,y]
        else:
            index=y*width+x
            add=self.canvas_action.get()=='Add barrier'
            (self.fill_add if add else self.fill_open).add(index)
            (self.fill_open if add else self.fill_add).discard(index)
        self.fill_seed_label.configure(text=f'Seed: {self.fill_seed}; added {len(self.fill_add)}, keep open {len(self.fill_open)}')
        self.render()

    def begin_stroke(self, event):
        self.stroke_active=False;self.packed_stroke=None;self.stroke={}
        if self.canvas_action.get() in {'Cleanup selection','Keep cleanup detail'}:
            self.guard(lambda:self.cleanup_click(event,begin=True));return
        if self.canvas_action.get()!='Paint':
            self.guard(lambda:self.boundary_click(event))
            return
        self.stroke_active = False
        if self.session.project:
            try:
                self.require_paint()
            except ValueError as error:
                self.status.set(str(error))
                return
            self.stroke_active = True
            self.stroke_context = (self.session.layer_id, self.session.drawing_id(), self.session.project['revision'])
            self.playing = False
            if self.timer is not None:
                self.root.after_cancel(self.timer)
                self.timer = None
            self.play_button.configure(text='Play')
            self.preview = None
            self.stroke = {}
            from engine.io.project_archive import PixelPlane
            from engine.paint_stroke import PackedStroke
            source=self.session.project['drawings'][self.session.drawing_id()]['pixels'];c=self.session.project['canvas']
            if not isinstance(source,PixelPlane):source=PixelPlane.from_pixels(c['width'],c['height'],source)
            try:self.packed_stroke=PackedStroke(source,[0,0,0,0] if self.erase.get() else self.color[:],int(self.brush_radius.get()))
            except ValueError:
                self.stroke_active=False;self.status.set('Choose a whole brush radius from0 to32 source pixels.');return
            self.extend_stroke(event)

    def extend_stroke(self, event):
        if self.canvas_action.get() in {'Cleanup selection','Keep cleanup detail'}:
            self.guard(lambda:self.cleanup_click(event));return
        if self.canvas_action.get() in {'Add barrier','Keep open'}:
            self.guard(lambda:self.boundary_click(event))
            return
        if self.session.project and self.stroke_active:
            x,y=self.canvas_point(event)
            width, height = self.session.project['canvas']['width'], self.session.project['canvas']['height']
            if self.packed_stroke is not None:
                try:self.packed_stroke.add((x,y))
                except ValueError as error:
                    self.packed_stroke=None;self.stroke={};self.stroke_active=False;self.status.set(str(error));return
                if self.session.project['schema_version']=='0.1':self.stroke=self.packed_stroke.edits()
                self.render()

    def end_stroke(self, event=None):
        if self.canvas_action.get() in {'Cleanup selection','Keep cleanup detail'}:
            self.cleanup_drag=None;self.packed_stroke=None;self.stroke={};self.stroke_active=False;self.render();return
        if self.packed_stroke is not None and self.packed_stroke.touched and self.stroke_active:
            try:
                if self.stroke_context != (self.session.layer_id, self.session.drawing_id(), self.session.project['revision']):
                    raise ValueError('Drawing/layer changed during stroke; no pixels applied')
                if event is not None:self.packed_stroke.add(self.canvas_point(event))
                self.session.correct_stroke(self.packed_stroke)
                self.status.set('Correction locked. Original and previous drawing retained; Undo reverses the stroke.')
            except ValueError as error:
                self.status.set(str(error))
        self.stroke = {}
        self.packed_stroke=None
        self.stroke_active = False
        self.refresh()

    def toggle_play(self):
        if self.timer is not None:
            self.root.after_cancel(self.timer)
            self.timer = None
        self.playing = not self.playing
        if self.playing:
            self.tick()
        self.play_button.configure(text='Pause' if self.playing else 'Play')

    def tick(self):
        self.timer = None
        if self.playing and self.session.project:
            self.session.slot = (self.session.slot + 1) % self.session.project['shot']['duration_frames']
            self.playhead.set(self.session.slot)
            fps = self.session.project['shot']['fps']
            self.timer = self.root.after(max(1, round(1000 * fps['denominator'] / fps['numerator'])), self.tick)

    def select_fill_area(self):
        if not self.session.project:return
        self.canvas_action.set('Cleanup selection');self.tools.select(3)
        self.status.set('Drag a rectangle on the drawing: at most224x224 source pixels plus16pixel sampled context. Then choose Fill seed. Shared selection coordinates are editable in Cleanup.')
        self.render()

    def current_fill_settings(self):
        if self.fill_context!=self.fill_key() or self.fill_seed is None:
            raise ValueError('Choose Fill seed and click the current drawing first')
        settings=fill_defaults(self.fill_seed,self.color,self.fill_palette.get())
        settings.update(paper=self.fill_paper.get(),gap_radius=int(self.fill_radius.get()),threshold=int(self.fill_threshold.get()),add_barriers=sorted(self.fill_add),keep_open=sorted(self.fill_open),overlap=self.fill_overlap.get())
        return settings

    def generate_fill(self):
        self.require_paint()
        if self.process and self.process.poll() is None:
            raise ValueError('A job is already running')
        settings=self.current_fill_settings()
        if self.fill_region is None:
            candidates=[i for i,r in self.session.project.get('fill_regions',{}).items() if r['ink_layer']==self.session.layer_id and r['start']<=self.session.slot<r['start']+r['length']]
            if candidates:
                self.fill_region=candidates[0];self.fill_new_region=True
                self.fill_context=self.fill_key()
        self.preview=None
        self.fill_preview=None
        self.job=Path(tempfile.gettempdir())/'artist-animation-assistant-jobs'/uuid.uuid4().hex
        if self.session.project['schema_version']=='0.2':
            from engine.jobs import create_roi_fill_job
            create_roi_fill_job(self.session.project,self.session.layer_id,self.session.slot,settings,[int(v.get()) for v in self.cleanup_roi],self.job,self.fill_region,self.fill_new_region)
        elif self.fill_region and self.fill_new_region:
            create_additional_region_job(self.session.project,self.fill_region,settings,self.job,slot=self.session.slot)
        elif self.fill_region:
            create_fill_revision_job(self.session.project,self.fill_region,settings,self.job,slot=self.session.slot)
        else:
            create_fill_job(self.session.project,self.session.drawing_id(),self.session.layer_id,self.session.slot,settings,self.job)
        self.job_layer=self.session.layer_id
        self.launch_job()

    def launch_job(self):
        self.palette_preview=None
        self.job_log=(self.job/'worker.log').open('w',encoding='utf-8')
        self.process=subprocess.Popen([sys.executable,str(ROOT/'scripts/worker.py'),'--job',str(self.job)],cwd=ROOT,stdin=subprocess.DEVNULL,stdout=self.job_log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        self.status.set('Local worker running. You can keep editing; changed input makes acceptance stale.')
        self.root.after(50,self.poll_job)

    def generate(self):
        if not self.session.project:
            raise ValueError('Open a project first')
        self.require_paint()
        if self.process and self.process.poll() is None:
            raise ValueError('A job is already running')
        self.preview = None
        self.job = Path(tempfile.gettempdir()) / 'artist-animation-assistant-jobs' / uuid.uuid4().hex
        create_job(self.session.project, self.session.drawing_id(), int(self.dx.get()), int(self.dy.get()), self.job)
        self.job_layer = self.session.layer_id
        self.fill_preview=None
        self.launch_job()

    def poll_job(self):
        if self.process and self.process.poll() is None:
            self.root.after(50, self.poll_job)
            return
        if self.job_log:
            self.job_log.close()
            self.job_log = None
        if self.job:
            state = read(self.job / 'job.json')['state']
            if state == 'completed':
                result = read(self.job / 'result.json')
                if 'schedule_result' in result:
                    self.preview=None
                    if getattr(self,'schedules_panel',None) and self.schedules_panel.window.winfo_exists():self.schedules_panel.show_result(result['schedule_result'])
                    self.status.set('Schedule candidates ready; compare timing and required events before explicit acceptance.')
                    return
                if 'correspondence_result' in result:
                    self.preview=None
                    if getattr(self,'matching_panel',None) and self.matching_panel.window.winfo_exists():self.matching_panel.show_result(result['correspondence_result'])
                    self.status.set('Image match candidates ready; review them in the correspondence window. Drawing pixels unchanged.')
                    return
                self.part_preview=result.get('part_result');self.part_preview_cache=None
                if self.part_preview is not None and getattr(self,'part_panel',None) and self.part_panel.window.winfo_exists():self.part_panel.show_result(self.part_preview)
                self.motion_preview=result.get('motion_result')
                if self.motion_preview is not None and getattr(self,'motion_panel',None):self.motion_panel.show_result(self.motion_preview)
                self.reference_preview=result.get('reference_result')
                if self.reference_preview is not None and getattr(self,'reference_panel',None):self.reference_panel.show_result(self.reference_preview)
                self.cleanup_preview=result.get('cleanup_result')
                self.palette_preview=result.get('palette_result')
                self.preview = result.get('pixels',[])
                self.fill_preview=result.get('fill_result')
                self.preview_input, self.preview_revision = result['drawing_id'], result['base_revision']
                warnings=result.get('warnings',[])
                if self.motion_preview is not None:
                    summary='Pose preview ready: '+str(len(self.motion_preview['outputs']))+' editable layers. '
                    if self.motion_preview['unsafe_reasons']:summary+='Needs correspondence/selection repair before acceptance. '
                elif self.palette_preview is not None:
                    summary=f'Palette preview ready: {len(self.palette_preview["updates"])} affected regions. '
                else:
                    summary='Proposal ready; review before accepting. '
                    protected=(self.fill_preview or {}).get('metrics',{}).get('protected_pixels',0)
                    if self.cleanup_preview is not None:protected=len(self.cleanup_preview['protected_pixels'])
                    if protected:summary+=f'{protected} artist-protected pixels preserved. '
                if warnings:summary+=warnings[0]+' '
                self.status.set(summary+'Review details / warnings shows the complete result.')
                self.render()
            else:
                self.status.set('Worker ' + state + '. Job retained at ' + str(self.job))

    def cancel(self):
        if self.job and (self.job / 'job.json').exists():
            request_cancel(self.job)

    def apply(self):
        if self.job and read(self.job/'job.json')['operation']=='event_preserving_schedule':raise ValueError('Review schedule candidates in Drawing schedules / required events')
        if self.job and read(self.job/'job.json')['operation']=='raster_part_partition':
            if not getattr(self,'part_panel',None) or not self.part_panel.window.winfo_exists():raise ValueError('Open part ownership to review this proposal')
            return self.part_panel.accept()
        if self.job and read(self.job/'job.json')['operation']=='patch_correspondence':raise ValueError('Review and apply image matches in the correspondence candidate window')
        if self.job and read(self.job/'job.json')['operation']=='landmark_motion':
            if not getattr(self,'motion_panel',None) or not self.motion_panel.window.winfo_exists():raise ValueError('Open Pose motion to review this result')
            return self.motion_panel.accept()
        if self.job and read(self.job/'job.json')['operation']=='reference_role_assignment':
            if not getattr(self,'reference_panel',None):raise ValueError('Open References to review this assignment')
            return self.reference_panel.accept()
        if self.job and read(self.job/'job.json')['operation']=='selected_contour_cleanup':return self.apply_cleanup()
        if self.job and read(self.job/'job.json')['operation']=='palette_identity_edit':return self.apply_palette()
        self.require_paint()
        if self.preview is None or not self.job:
            raise ValueError('Generate and review a completed proposal first')
        # Selection changes must not redirect a completed job to another drawing.
        if read(self.job / 'job.json')['drawing_id'] != self.session.drawing_id():
            raise ValueError('Selected drawing changed; return to the job input drawing')
        if self.session.layer_id != self.job_layer:
            raise ValueError('Selected layer changed; return to the job input layer')
        is_fill=read(self.job/'job.json')['operation'] in {'seed_fill_boundary_baseline','revise_accepted_fill','add_shared_ink_region'}
        if is_fill and self.current_fill_settings()!=read(self.job/'job.json')['settings']:
            raise ValueError('Fill settings or boundary hints changed; regenerate before accepting')
        job=read(self.job/'job.json')
        if is_fill and job.get('roi_adapter') and [int(v.get()) for v in self.cleanup_roi]!=job['roi']:raise ValueError('Selection changed; regenerate before accepting')
        is_revision=read(self.job/'job.json')['operation']=='revise_accepted_fill'
        self.session.apply(self.job)
        self.preview = None
        self.fill_preview=None
        self.refresh()
        if is_fill:
            self.layer_tree.selection_set(self.session.layer_id)
            self.render()
        self.status.set('Revised existing fill; prior pixels retained and artist corrections protected. Undo is available.' if is_revision else 'Accepted editable ink/fill layers and saved boundary/palette identity. Original layer retained hidden; Undo is available.' if is_fill else 'Accepted as a new editable drawing. Prior drawing and original are retained; Undo is available.')

    def reject(self):
        self.cancel()
        self.preview = None
        if self.job:
            (self.job / 'rejected-by-host.json').write_text(json.dumps({'action': 'reject', 'duration_preserved': True}), encoding='utf-8')
        self.job = None
        self.render()
        self.status.set('Rejected. Drawings and clip duration unchanged.')

    def open_proposal_details(self):
        if not self.job or not (self.job/'result.json').is_file():raise ValueError('Complete a proposal preview first')
        result=read(self.job/'result.json')
        opener=self.root.focus_get()
        window=tk.Toplevel(self.root);window.title('Proposal review details');window.geometry('740x480');window.minsize(480,320)
        self.proposal_details_window=window
        def close():
            window.destroy();self.root.focus_force()
            if opener is not None and opener.winfo_exists():opener.focus_set()
        window.protocol('WM_DELETE_WINDOW',close);window.bind('<Escape>',lambda e:close())
        text=ScrolledText(window,wrap='word');text.pack(fill='both',expand=True,padx=10,pady=10)
        self.proposal_details_text=text
        lines=['CURRENT PREVIEW' if self.preview_current() else 'INPUT CHANGED / PREVIEW NO LONGER APPLICABLE','']
        motion=result.get('motion_result')
        reference=result.get('reference_result')
        palette=result.get('palette_result')
        if motion is not None:
            lines += ['POSE MOTION / CORRESPONDENCES',f'Interval: {motion["request"]["target_start"]} to {motion["request"]["target_end"]}',f'Landmarks: {motion["guide_snapshot"]["handles"]}',f'Visibility evidence: {motion["visibility_events"]}']
            for layer,output in motion['outputs'].items():lines.append(self.session.project['layers'].get(layer,{}).get('name',layer)+': '+str(output['metrics']))
        elif reference is not None:
            lines += ['REFERENCE PART / COLOR ASSIGNMENT',f'Selected: {reference["selected"]}',f'Affected regions: {list(reference["updates"])}',f'Alternatives: {reference["alternatives"]}','Reference images are local project inputs. Training and uploads are not authorized by this selection.']
        elif palette is not None:
            request=palette['request']
            lines += [('Palette-wide recolor' if request['action']=='recolor' else 'Selected-region rebind')+': '+request['palette_id'],f'RGBA: {palette["rgba"]}',f'Affected regions: {len(palette["updates"])}']
            for identity,update in palette['updates'].items():
                region=self.session.project.get('fill_regions',{}).get(identity,{})
                name=self.session.project['layers'].get(region.get('fill_layer'),{}).get('name',identity)
                lines.append(f'{name}: {len(update["managed"])} managed pixels, {len(update["protected_pixels"])} artist-protected pixels')
            if palette['rgba'][3]==0:lines.append('This is an explicit transparent assignment. Region identity and managed masks remain available for later recolor.')
        elif result.get('cleanup_result') is not None:
            cleanup=result['cleanup_result']
            lines += ['SELECTED LINE CLEANUP',f'Selection: {cleanup["settings"]["roi"]}',f'Metrics: {cleanup["metrics"]}',f'Artist-protected samples: {len(cleanup["protected_pixels"])}','Inferred centerlines are analysis, not recovered drawing history or semantic character parts.']
            lines += [f'Component {c["component_id"]}: {c["status"]}' for c in cleanup['components']]
        else:
            lines += ['Region / drawing proposal',f'Settings: {result["settings"]}']
        lines += ['', 'WARNINGS']+result.get('warnings',[])+['','Preserved source and prior drawing versions remain recoverable. Accept is explicit.','','Method: '+result['method']+' '+result['version'],'Sources: '+', '.join(result['source_ids']),'Full APA references and notices are available in CREDITS.']
        text.insert('1.0','\n'.join(lines));text.configure(state='disabled');window.focus_force()

    def open_credits(self):
        if getattr(self, 'credits_window', None) is not None and self.credits_window.winfo_exists():
            self.credits_window.lift()
            return
        self.credits_window = window = tk.Toplevel(self.root)
        window.title('CREDITS — references, usage and full license notices')
        window.geometry('950x620')
        self.credits_data = json.loads((ROOT / 'generated/credits.json').read_text(encoding='utf-8'))
        toolbar = ttk.Frame(window, padding=8)
        toolbar.pack(fill='x')
        ttk.Label(toolbar, text='Search author, title, feature, license or component').pack(side='left')
        self.query = tk.StringVar()
        entry = ttk.Entry(toolbar, textvariable=self.query, width=28)
        entry.pack(side='left', padx=6)
        self.category = tk.StringVar(value='All')
        categories = ['All', 'Current runtime', 'Research and methods', 'Experiments', 'Data and assets', 'License notices']
        ttk.Combobox(toolbar, textvariable=self.category, values=categories, state='readonly', width=22).pack(side='left')
        self.query.trace_add('write', lambda *_: self.filter_credits())
        self.category.trace_add('write', lambda *_: self.filter_credits())
        notebook = ttk.Notebook(window)
        notebook.pack(fill='both', expand=True, padx=8)
        references, notices = ttk.Frame(notebook), ttk.Frame(notebook)
        notebook.add(references, text='References and usage')
        notebook.add(notices, text='Full license notices (always available)')
        self.credit_list = tk.Listbox(references, width=42, exportselection=False)
        self.credit_list.pack(side='left', fill='y')
        self.credit_list.bind('<<ListboxSelect>>', lambda event: self.credit_detail())
        self.credit_text = ScrolledText(references, wrap='word', width=70, state='disabled')
        self.credit_text.pack(side='left', fill='both', expand=True)
        self.notice_text = ScrolledText(notices, wrap='word')
        self.notice_text.insert('1.0', self.credits_data['notices'])
        self.notice_text.configure(state='disabled')
        self.notice_text.pack(fill='both', expand=True)
        actions = ttk.Frame(window, padding=8)
        actions.pack(fill='x')
        for label, action in [('Copy selected APA', self.copy_one), ('Copy displayed bibliography', self.copy_shown), ('Open selected source', self.open_source), ('Export all Markdown', lambda: self.export_credits('CREDITS.md')), ('Export manifest', lambda: self.export_credits('credits.json'))]:
            ttk.Button(actions, text=label, command=lambda fn=action: self.guard(fn)).pack(side='left', padx=2)
        ttk.Button(actions, text='Close', command=self.close_credits).pack(side='right')
        window.protocol('WM_DELETE_WINDOW', self.close_credits)
        window.bind('<Escape>', lambda event: self.close_credits())
        self.filter_credits()
        entry.focus_set()

    def filter_credits(self):
        query, category = self.query.get().casefold(), self.category.get()
        self.shown = []
        for source in self.credits_data['sources']:
            uses = [row for group in ['components', 'uses', 'experiments'] for row in self.credits_data[group] if source['source_id'] in row.get('source_ids', [])]
            text = json.dumps([source, uses], ensure_ascii=False).casefold()
            kind = source.get('category', '')
            if query not in text:
                continue
            runtime=any(row.get('component_id') and row.get('use_state') in {'implemented','shipped'} for row in uses) or (kind=='runtime' and source.get('use_state') in {'implemented','shipped'})
            if category == 'Current runtime' and not runtime:
                continue
            if category == 'Experiments' and not any('experiment_id' in row for row in uses):
                continue
            if category == 'Data and assets' and kind not in {'data', 'assets'}:
                continue
            if category == 'License notices' and kind!='notices' and 'licen' not in source['title'].casefold():
                continue
            if category == 'Research and methods' and kind not in {'research','methods'} and not any(row.get('category') in {'research','methods'} for row in uses):
                continue
            self.shown.append((source, uses))
        self.credit_list.delete(0, 'end')
        for source, uses in self.shown:
            self.credit_list.insert('end', source['source_id'] + ' · ' + source['title'])
        if self.shown:
            self.credit_list.selection_set(0)
        self.credit_detail()

    def credit_detail(self):
        selection = self.credit_list.curselection()
        text = 'No matching sources. Full notices remain available in their tab.'
        if selection:
            source, uses = self.shown[selection[0]]
            text = source['apa_reference'] + '\n\n' + source['role'] + '\nUse: ' + source['use_state'] + '\nPermission: ' + source['permission_state'] + '\n\n' + source['inspection_scope'] + '\n\nDetails / related features, components and experiments:\n' + json.dumps({'source': source, 'uses': uses}, indent=2, ensure_ascii=False)
        self.credit_text.configure(state='normal')
        self.credit_text.delete('1.0', 'end')
        self.credit_text.insert('1.0', text)
        self.credit_text.configure(state='disabled')

    def clipboard(self, text):
        self.root.clipboard_clear()
        self.root.clipboard_append(text)

    def copy_one(self):
        if self.credit_list.curselection():
            self.clipboard(self.shown[self.credit_list.curselection()[0]][0]['apa_reference'])

    def copy_shown(self):
        self.clipboard('\n\n'.join(source['apa_reference'] for source, uses in self.shown))

    def open_source(self):
        if self.credit_list.curselection():
            url=self.shown[self.credit_list.curselection()[0]][0]['canonical_url']
            if url:webbrowser.open(url)
            else:self.status.set('Private local source; no public link. Artwork is not included in credits.')

    def export_credits(self, name):
        path = filedialog.asksaveasfilename(parent=self.credits_window, initialfile=name)
        if path:
            Path(path).write_bytes((ROOT / 'generated' / name).read_bytes())

    def close_credits(self):
        self.credits_window.destroy()
        self.credits_window = None
        self.root.focus_force()
        self.credits_button.focus_set()

    def close(self):
        if self.confirm_discard():
            self.cancel()
            self.root.destroy()
