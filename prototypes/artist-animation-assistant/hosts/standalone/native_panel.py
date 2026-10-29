"""Native layer/time import and editable effect controls; Tk main thread only."""
from copy import deepcopy
from pathlib import Path
import tkinter as tk
from tkinter import ttk,filedialog

MODES={'Refuse native styles':'strict','Keep raw style data':'raw','Experimental shadows / glows':'effects'}

class NativePanel:
    def __init__(self,app):
        self.app=app;self.page=outer=ttk.Frame(app.tools);app.tools.add(outer,text='Native');self.index=None;self.ready=None;self.params=None;self.layer_ids=[];self.source_token=None;self.progress_running=False
        self.scroll=tk.Canvas(outer,width=235,height=400,highlightthickness=0,takefocus=True,yscrollincrement=18);self.scroll.pack(side='left',fill='both',expand=True)
        scrollbar=ttk.Scrollbar(outer,orient='vertical',command=self.scroll.yview);scrollbar.pack(side='right',fill='y');self.scroll.configure(yscrollcommand=scrollbar.set)
        p=ttk.Frame(self.scroll,padding=6);self.content=p;window=self.scroll.create_window(0,0,window=p,anchor='nw')
        p.bind('<Configure>',lambda event:self.scroll.configure(scrollregion=self.scroll.bbox('all')))
        self.scroll.bind('<Configure>',lambda event:self.scroll.itemconfigure(window,width=max(215,event.width)))
        self.scroll.bind('<MouseWheel>',lambda event:self.scroll.yview_scroll(-1 if event.delta>0 else 1,'units'))
        self.scroll.bind('<Prior>',lambda event:self.scroll.yview_scroll(-1,'pages'));self.scroll.bind('<Next>',lambda event:self.scroll.yview_scroll(1,'pages'))
        self.pick=ttk.Button(p,text='Choose native animation',command=lambda:app.guard(self.choose));self.pick.pack(fill='x')
        self.source_label=ttk.Label(p,text='No file indexed',wraplength=215);self.source_label.pack(fill='x',pady=3)
        ttk.Label(p,text='Native frames: start / end exclusive').pack(anchor='w')
        row=ttk.Frame(p);row.pack(fill='x');self.start=tk.StringVar(value='0');self.end=tk.StringVar(value='7')
        for v in [self.start,self.end]:ttk.Entry(row,textvariable=v,width=8).pack(side='left',expand=True,fill='x')
        ttk.Label(p,text='Raster layers (Ctrl/Shift select)').pack(anchor='w')
        self.layers=tk.Listbox(p,height=6,width=28,selectmode='extended',exportselection=False);self.layers.pack(fill='x')
        self.mode=tk.StringVar(value='Refuse native styles');ttk.Combobox(p,textvariable=self.mode,values=list(MODES),state='readonly',width=26).pack(fill='x',pady=3)
        self.import_button=ttk.Button(p,text='Build selected editable window',command=lambda:app.guard(self.import_window));self.import_button.pack(fill='x')
        row=ttk.Frame(p);row.pack(fill='x',pady=3)
        self.use_button=ttk.Button(row,text='Open ready window',command=lambda:app.guard(self.use_window));self.use_button.pack(side='left',expand=True,fill='x')
        self.cancel_button=ttk.Button(row,text='Cancel native work',command=app.cancel_native);self.cancel_button.pack(side='left',expand=True,fill='x')
        self.progress=ttk.Progressbar(p,mode='indeterminate');self.progress.pack(fill='x')
        self.message=tk.StringVar(value='Original native files remain unchanged. Selected windows keep separate layers and source data.')
        ttk.Label(p,textvariable=self.message,wraplength=215).pack(fill='x',pady=4)
        self.show_effects=tk.BooleanVar(value=False);ttk.Checkbutton(p,text='Show experimental effects',variable=self.show_effects,command=app.native_mode_changed).pack(anchor='w')
        ttk.Button(p,text='Refresh styled frame',command=app.native_mode_changed).pack(fill='x')
        ttk.Label(p,text='Approximate native RGB; raw editing/playback is labelled. Effects refresh after editing.',wraplength=215).pack(fill='x')
        self.effect_layer=tk.StringVar();self.effect_choice=tk.StringVar();self.effect_layer_combo=ttk.Combobox(p,textvariable=self.effect_layer,state='readonly',width=26);self.effect_layer_combo.pack(fill='x');self.effect_layer_combo.bind('<<ComboboxSelected>>',lambda e:self.select_layer())
        self.effect_combo=ttk.Combobox(p,textvariable=self.effect_choice,state='readonly',width=26);self.effect_combo.pack(fill='x');self.effect_combo.bind('<<ComboboxSelected>>',lambda e:self.select_effect())
        self.enabled=tk.BooleanVar(value=True);ttk.Checkbutton(p,text='Effect enabled',variable=self.enabled).pack(anchor='w')
        self.size=tk.StringVar();self.opacity=tk.StringVar();self.rgb=tk.StringVar()
        row=ttk.Frame(p);row.pack(fill='x')
        for label,var in [('Size',self.size),('Opacity %',self.opacity)]:ttk.Label(row,text=label).pack(side='left');ttk.Entry(row,textvariable=var,width=4).pack(side='left')
        row=ttk.Frame(p);row.pack(fill='x');ttk.Label(row,text='RGB').pack(side='left');ttk.Entry(row,textvariable=self.rgb,width=18).pack(side='left',fill='x',expand=True)
        self.apply_button=ttk.Button(p,text='Apply effect settings / Undo available',command=lambda:app.guard(self.apply_effect));self.apply_button.pack(fill='x',pady=3)
        self.display=tk.StringVar(value='RAW canvas');ttk.Label(p,textvariable=self.display,wraplength=215).pack(fill='x');self.update_buttons()
        def follow(widget):
            widget.bind('<FocusIn>',lambda event:self.keep_visible(event.widget),add='+')
            for child in widget.winfo_children():follow(child)
        follow(p)
    def keep_visible(self,widget):
        y=0;current=widget
        while current is not self.content:
            y+=current.winfo_y();current=current.master
            if current is None:return
        top=self.scroll.canvasy(0);height=max(1,self.scroll.winfo_height());total=max(1,self.content.winfo_reqheight())
        if y<top:self.scroll.yview_moveto(max(0,y-4)/total)
        elif y+widget.winfo_height()>top+height:self.scroll.yview_moveto(max(0,y+widget.winfo_height()-height+4)/total)
    def choose(self):
        path=filedialog.askopenfilename(parent=self.app.root,filetypes=[('Krita native animation','*.kra')])
        if path:self.index_file(path)
    def index_file(self,path):
        self.index=None;self.ready=None;self.layers.delete(0,'end');self.source_token=self.app.document_token()
        self.app.io_jobs.start('index',dict(path=str(Path(path).resolve())),self.source_token);self.message.set('Reading metadata and source identity in background.');self.update_buttons()
    def indexed(self,index):
        self.index=index;self.ready=None;self.source_label.configure(text=Path(index['source']['path']).name+f' · {index["width"]}×{index["height"]}, {index["fps"]}fps')
        self.start.set(str(index['start']));self.end.set(str(min(index['end'],index['start']+600)));self.layers.delete(0,'end');self.layer_ids=[]
        for node in index['nodes']:
            if node['kind']!='paintlayer':continue
            self.layer_ids.append(node['id']);self.layers.insert('end',node['name']+(' [effects]' if node['styled'] else '')+(' [hidden]' if not node['visible'] else '')+(' [locked]' if node['locked'] else ''))
            if node['visible']:self.layers.selection_set(len(self.layer_ids)-1)
        self.message.set('Choose native interval and layers. Large selections may need a narrower window; styles require an explicit policy.');self.update_buttons()
    def import_window(self):
        if not self.index:raise ValueError('Index a native animation first')
        start,end=int(self.start.get()),int(self.end.get());layers=[self.layer_ids[i] for i in self.layers.curselection()]
        if not layers:raise ValueError('Select at least one raster layer')
        if not self.index['start']<=start<end<=self.index['end'] or end-start>600:raise ValueError('Choose native interval inside clip, at most600slots')
        self.ready=None;self.source_token=self.app.document_token();source=self.index['source']
        self.app.io_jobs.start('import',dict(path=source['path'],source_sha256=source['sha256'],start=start,end=end,layers=layers,mode=MODES[self.mode.get()]),self.source_token);self.message.set('Building a separate editable window; current document stays open.');self.update_buttons()
    def use_window(self):
        if not self.ready:raise ValueError('Build an editable window first')
        if self.ready['token']!=self.app.document_token():raise ValueError('Current document changed during import; use Open project to explicitly open the saved separate window')
        source=self.ready['result']['source'];stat=Path(source['path']).stat()
        if stat.st_size!=source['bytes'] or stat.st_mtime_ns!=source['mtime_ns']:raise ValueError('Native source changed; index again before using this window')
        if not self.app.confirm_discard():return
        result=self.ready;session=result['result']['session'];self.app.io_jobs.review(result,'loaded');self.ready=None
        self.app.replace_session(session);self.show_effects.set(result['result']['mode']=='effects');self.app.render();self.message.set('Opened separate editable native window. Original native archive retained; save this project to keep further edits.');self.update_buttons()
    def update_buttons(self):
        busy=self.app.io_jobs.busy
        self.pick.configure(state='disabled' if busy else 'normal');self.import_button.configure(state='normal' if self.index and not busy else 'disabled');self.use_button.configure(state='normal' if self.ready else 'disabled')
        active=busy or self.app.effect_jobs.busy
        if active and not self.progress_running:self.progress.start(30);self.progress_running=True
        elif not active and self.progress_running:self.progress.stop();self.progress_running=False
    def load_parameters(self,params):
        self.params=deepcopy(params);project=self.app.session.project
        self.effect_layers={project['layers'][i]['name']+' · '+str(n+1):i for n,i in enumerate(params['layers'])}
        old=self.effect_layer.get();self.effect_layer_combo.configure(values=list(self.effect_layers));self.effect_layer.set(old if old in self.effect_layers else next(iter(self.effect_layers),''));self.select_layer()
    def select_layer(self):
        if not self.params or self.effect_layer.get() not in self.effect_layers:return
        identity=self.effect_layers[self.effect_layer.get()];effects=self.params['layers'][identity];self.effect_combo.configure(values=[e['kind'] for e in effects]);self.effect_choice.set(effects[0]['kind'] if effects else '');self.select_effect()
    def select_effect(self):
        if not self.params or not self.effect_choice.get():return
        identity=self.effect_layers[self.effect_layer.get()];e=next(e for e in self.params['layers'][identity] if e['kind']==self.effect_choice.get());self.enabled.set(e['enabled']);self.size.set(str(e['size']));self.opacity.set(str(e['opacity']));self.rgb.set(' '.join(str(v) for v in e['color']))
    def apply_effect(self):
        if not self.params or not self.effect_choice.get():raise ValueError('Enable an effects preview or open an effect-enabled native window first')
        params=deepcopy(self.app.session.project.get('native_effects') or self.params);identity=self.effect_layers[self.effect_layer.get()];e=next(e for e in params['layers'][identity] if e['kind']==self.effect_choice.get())
        rgb=[float(v) for v in self.rgb.get().split()]
        e.update(enabled=self.enabled.get(),size=float(self.size.get()),opacity=float(self.opacity.get()),color=rgb);self.app.session.set_native_effects(params);self.load_parameters(params);self.show_effects.set(True);self.app.refresh();self.message.set('Effect settings applied as a separate editable revision. Undo/Redo restores earlier settings.')
