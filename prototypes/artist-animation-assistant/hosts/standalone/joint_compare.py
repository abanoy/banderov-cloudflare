"""Read-only paired actual-clock comparison; Tk is used only on caller thread."""
import time,tkinter as tk
from tkinter import ttk
from collections import OrderedDict


class JointComparison:
    def __init__(self,root,frames,opener=None,*,title='Unapproved joint timing comparison',description='UNAPPROVED — original and proposed timing. Editing stays in the main editor.',labels=('Current source','Proposed schedule'),detail_text='Guide detail (supplied region and path bounds)'):
        self.root=root;self.frames=frames;self.opener=opener;self.window=tk.Toplevel(root)
        # Own hidden verification never maps a new window. Normal opening is an
        # explicit artist action, never triggered by worker completion.
        if not root.winfo_ismapped():self.window.withdraw()
        self.window.title(title);self.window.geometry('900x500');self.window.minsize(850,440)
        self.playing=False;self.ticket=None;self.closed=False;self.slot=0;self.cache=OrderedDict();self.photos=[];self.samples=[]
        ttk.Label(self.window,text=description,wraplength=860).pack(pady=6)
        row=ttk.Frame(self.window);row.pack(fill='both',expand=True);self.canvases=[]
        for label in labels:
            column=ttk.Frame(row);column.pack(side='left',fill='both',expand=True);ttk.Label(column,text=label).pack();canvas=tk.Canvas(column,width=400,height=260,bg='#e5e8ed',highlightthickness=0);canvas.pack(expand=True);self.canvases.append(canvas)
        self.caption=tk.StringVar(master=root);ttk.Label(self.window,textvariable=self.caption).pack()
        self.detail=tk.BooleanVar(master=root,value=False);ttk.Checkbutton(self.window,text=detail_text,variable=self.detail,command=lambda:self.show(self.slot)).pack()
        self.slider=ttk.Scale(self.window,from_=0,to=len(frames['source'])-1,command=self.scrub);self.slider.pack(fill='x',padx=12,pady=4)
        controls=ttk.Frame(self.window);controls.pack(pady=8);self.play_button=ttk.Button(controls,text='Play at shot fps',command=self.toggle);self.play_button.pack(side='left',padx=4);ttk.Button(controls,text='Close comparison',command=self.close).pack(side='left',padx=4)
        self.window.protocol('WM_DELETE_WINDOW',self.close);self.window.bind('<Escape>',lambda event:self.close());self.show(0)
    def photo(self,data):
        if data not in self.cache:
            self.cache[data]=tk.PhotoImage(master=self.root,data=data)
            while len(self.cache)>16:self.cache.popitem(last=False)
        self.cache.move_to_end(data);return self.cache[data]
    def show(self,index):
        if self.closed:return
        self.slot=int(index);suffix='_detail' if self.detail.get() else '';self.photos=[self.photo(self.frames[k+suffix][self.slot]) for k in ('source','proposed')]
        for canvas,photo in zip(self.canvases,self.photos):
            canvas.delete('all');canvas.create_image(200,130,image=photo,anchor='center')
        self.caption.set(f"Slot {self.frames['start']+self.slot} / {self.frames['end']-1} · {self.frames['fps']['numerator']}/{self.frames['fps']['denominator']} fps · unapproved"+(' · region '+str(self.frames['detail_rectangle']) if self.detail.get() else ' · full context'))
        if int(round(self.slider.get()))!=self.slot:self.slider.set(self.slot)
    def scrub(self,value):
        index=max(0,min(len(self.frames['source'])-1,int(round(float(value)))))
        if index==self.slot:return
        self.stop();self.show(index)
    def toggle(self):
        if self.playing:self.stop();return
        self.playing=True;self.started=time.monotonic();self.origin=self.slot;self.play_button.configure(text='Pause');self.tick()
    def tick(self):
        self.ticket=None
        if not self.playing or self.closed:return
        fps=self.frames['fps']['numerator']/self.frames['fps']['denominator'];elapsed=time.monotonic()-self.started;index=(self.origin+int(elapsed*fps))%len(self.frames['source']);self.show(index);self.samples.append((elapsed,index));self.samples=self.samples[-600:];self.ticket=self.root.after(max(1,int(500/fps)),self.tick)
    def stop(self):
        self.playing=False
        if self.ticket:self.root.after_cancel(self.ticket);self.ticket=None
        if not self.closed:self.play_button.configure(text='Play at shot fps')
    def close(self):
        if self.closed:return
        self.stop();self.closed=True;self.window.destroy();self.cache.clear();self.photos=[]
        if self.opener and self.root.winfo_ismapped():self.opener.focus_set()
