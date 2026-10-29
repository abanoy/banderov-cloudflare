"""Explicit read-only retained/raw/mapped comparison, using existing clock viewer."""
import tkinter as tk
from tkinter import ttk
from hosts.standalone.joint_compare import JointComparison


class RebindComparison(JointComparison):
    MODES=('Retained placement on fresh pose','Fresh raw pose')
    def __init__(self,root,frames,opener,target_slot,on_review):
        self.original_frames=frames;self.seen=set();self.target_slot=target_slot;self.on_review=on_review;self.mode=tk.StringVar(master=root,value=self.MODES[0]);self.initializing=True
        current=dict(frames,source=frames['old'],source_detail=frames['old_detail'])
        super().__init__(root,current,opener,title='Unapproved correction rebinding review',description='UNAPPROVED — retained placement is a diagnostic overlay on the fresh pose, not a recovered old drawing. Compare both left views with the proposed placement. No artwork is approved.',labels=('Retained placement / fresh raw','Proposed correction placement'),detail_text='Supplied detail bounds')
        controls=ttk.Frame(self.window);controls.pack(fill='x',padx=12,pady=4);ttk.Label(controls,text='Left comparison').pack(side='left');self.mode_combo=ttk.Combobox(controls,textvariable=self.mode,values=self.MODES,state='readonly',width=35);self.mode_combo.pack(side='left',padx=6);self.mode_combo.bind('<<ComboboxSelected>>',lambda event:self.select_mode());self.initializing=False;self.show(max(0,min(len(frames['source'])-1,target_slot-frames['start'])))
    def select_mode(self):
        self.stop();key='old' if self.mode.get()==self.MODES[0] else 'source';self.frames=dict(self.original_frames,source=self.original_frames[key],source_detail=self.original_frames[key+'_detail']);self.show(self.slot)
    def show(self,index):
        super().show(index)
        if not self.closed and not self.initializing and self.frames['start']+self.slot==self.target_slot:
            self.seen.add(self.mode.get());self.on_review(self.seen==set(self.MODES))
