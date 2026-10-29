"""Selected standalone extension: background native windows and styled viewport.

The inherited CREDITS implementation and button are unchanged. No worker calls Tk.
"""
from pathlib import Path
import tempfile,tkinter as tk
from tkinter import filedialog
from hosts.standalone.app import App
from hosts.standalone.native_jobs import NativeJobs

class NativeApp(App):
    def __init__(self,root,private_root=None):
        self.rebind_panel=None;self.candidate_editor=None;self.learned_panel=None;self.joint_panel=None;self.native_panel=None;self.native_closed=False;self.native_ticket=None;self.native_requested=None;self.native_shown=None;self.native_pending=None;self.native_serial=0
        private=Path(private_root) if private_root else Path(tempfile.gettempdir())/'artist-animation-assistant-native-jobs'
        self.io_jobs=NativeJobs(private/'imports');self.effect_jobs=NativeJobs(private/'effects')
        super().__init__(root)
        from hosts.standalone.native_panel import NativePanel
        self.native_panel=NativePanel(self);self.native_poll_ticket=root.after(50,self.poll_native)
        from hosts.standalone.joint_panel import JointPanel
        self.joint_panel=JointPanel(self,private/'joint')
        from hosts.standalone.learned_panel import LearnedPanel
        self.learned_panel=LearnedPanel(self,private/'learned')
        from hosts.standalone.candidate_editor import CandidateEditor
        self.candidate_editor=CandidateEditor(self,private/'candidate-edits')
        from hosts.standalone.rebind_panel import RebindPanel
        self.rebind_panel=RebindPanel(self,private/'rebind')
        from tkinter import ttk
        # All pages stay reachable without a tab strip forcing the sidebar wide.
        self.tool_pages=list(self.tools.tabs());self.tool_choice=tk.StringVar(master=root);self.tool_picker=ttk.Combobox(self.tools.master,textvariable=self.tool_choice,values=[self.tools.tab(page,'text') for page in self.tool_pages],state='readonly');self.tool_picker.pack(fill='x',before=self.tools,pady=(0,4));self.tool_picker.current(self.tools.index(self.tools.select()));self.tool_picker.bind('<<ComboboxSelected>>',lambda event:self.tools.select(self.tool_pages[self.tool_picker.current()]));self.tools.bind('<<NotebookTabChanged>>',lambda event:self.tool_picker.current(self.tools.index(self.tools.select())),add='+');style=ttk.Style(root);style.layout('AssistantTools.TNotebook.Tab',[]);self.tools.configure(style='AssistantTools.TNotebook')
    def refresh(self):
        super().refresh()
        if self.joint_panel:self.joint_panel.refresh_guides()
        if self.learned_panel:self.learned_panel.refresh_actors()
        if self.candidate_editor:self.candidate_editor.refresh()
        if self.rebind_panel:self.rebind_panel.refresh()
    def document_token(self):return (id(self.session),self.session.counter,id(self.session.project))
    def import_native(self):
        self.tools.select(self.native_panel.page);self.native_panel.choose()
    def open_project(self):
        if not self.confirm_discard():return
        path=filedialog.askopenfilename(parent=self.root,filetypes=[('Assistant project','*.aaa *.aaa.json *.json')])
        if path:
            self.io_jobs.start('open',dict(path=str(Path(path).resolve())),self.document_token());self.native_panel.message.set('Opening project in background; current document stays available.');self.status.set(self.native_panel.message.get());self.native_panel.update_buttons()
    def save_project(self):
        if not self.session.project:raise ValueError('Open a project first')
        path=filedialog.asksaveasfilename(parent=self.root,defaultextension='.aaa',filetypes=[('Compact assistant project','*.aaa'),('Legacy JSON project','*.aaa.json')])
        if path:
            self.io_jobs.start('save',dict(path=str(Path(path).resolve()),project=self.session.project),self.document_token());self.native_panel.message.set('Saving a separate snapshot in background. Later edits remain unsaved.');self.status.set(self.native_panel.message.get());self.native_panel.update_buttons()
    def native_mode_changed(self):
        self.native_serial+=1;self.effect_jobs.cancel();self.native_pending=None;self.native_shown=None;self.native_requested=None;self.render()
    def cancel_native(self):
        self.io_jobs.cancel();self.effect_jobs.cancel();self.native_serial+=1;self.native_pending=None;self.native_shown=None;self.native_requested=None
        if self.native_ticket:self.root.after_cancel(self.native_ticket);self.native_ticket=None
        if self.native_panel:self.native_panel.show_effects.set(False);self.native_panel.ready=None;self.native_panel.message.set('Cancellation requested. Completed private files remain separate; current project is unchanged.');self.native_panel.update_buttons()
    def replace_session(self,session):
        if self.joint_panel:self.joint_panel.clear()
        if self.learned_panel:self.learned_panel.clear()
        self.cancel_native();self.effect_jobs.discard_cache();super().replace_session(session)
        if self.native_panel:
            self.native_panel.params=None
            self.native_panel.show_effects.set(bool(self.session.project and self.session.project.get('native_effects')))
            if self.session.project and self.session.project.get('native_effects'):self.native_panel.load_parameters(self.session.project['native_effects'])
    def render_packed_canvas(self):
        super().render_packed_canvas()
        panel=self.native_panel
        if panel is None:return
        project=self.session.project
        if not panel.show_effects.get() or not project.get('native_window_source') or not self.packed_transform:
            panel.display.set('RAW canvas — experimental effects off');return
        if self.stroke_active or self.playing or (self.preview_current() and self.preview_on.get()):
            self.effect_jobs.cancel();self.native_pending=None;self.native_requested=None;self.native_serial+=1;panel.display.set('RAW editing / playback / proposal. Styled frame refreshes when paused.');return
        x0,y0,x1,y1,px,py,ow,oh=self.packed_transform;view=(x0,y0,x1,y1,ow,oh)
        # Full fingerprint is checked when consuming a completed worker result;
        # per-mouse event comparison uses cheap revision/session/view identity.
        token=(self.document_token(),self.session.slot,view,self.native_serial)
        if self.native_shown and self.native_shown['token']==token:
            result=self.native_shown['result'];self.native_photo=tk.PhotoImage(master=self.root,data=result['png'])
            images=[i for i in self.canvas.find_all() if self.canvas.type(i)=='image']
            if images:self.canvas.itemconfigure(images[-1],image=self.native_photo)
            panel.display.set('EXPERIMENTAL STYLED frame — native RGB may differ');return
        panel.display.set('RAW canvas — styled frame processing in background')
        if token==self.native_requested:return
        self.native_requested=token;self.native_pending=(token,project,self.session.slot,view);self.effect_jobs.cancel()
        if self.native_ticket:self.root.after_cancel(self.native_ticket)
        self.native_ticket=self.root.after(180,self.start_native_preview)
    def start_native_preview(self):
        self.native_ticket=None
        if self.native_closed or self.native_pending is None:return
        if self.effect_jobs.busy:self.native_ticket=self.root.after(50,self.start_native_preview);return
        token,project,slot,view=self.native_pending;self.native_pending=None
        self.effect_jobs.start('effects',dict(project=project,slot=slot,view=view),token)
        if self.native_panel:self.native_panel.update_buttons()
    def poll_native(self):
        if self.native_closed:return
        panel=self.native_panel
        for controller in [self.io_jobs,self.effect_jobs]:
            event=controller.poll()
            if event:
                if event['state']!='ready' or (controller.cancel_event.is_set() and event['operation']!='save'):
                    if controller is self.io_jobs:panel.message.set('Native '+event['state']+': '+event.get('error','cancel requested'));self.status.set(panel.message.get())
                    else:panel.display.set('RAW canvas — '+event['state']+': '+event.get('error','cancel requested'))
                elif controller is self.io_jobs:
                    if event['operation']=='index':panel.indexed(event['result']['index'])
                    elif event['operation']=='save':
                        from engine.project import fingerprint
                        current=event['token']==self.document_token() and event['result']['input_fingerprint']==fingerprint(self.session.project)
                        if current:self.session.saved_hash=event['result']['input_fingerprint']
                        controller.review(event,'saved');panel.message.set('Saved editable snapshot.' if current else 'Earlier snapshot saved; current document has newer unsaved edits.');self.status.set(panel.message.get())
                    elif event['operation']=='open' and event['token']==self.document_token():
                        controller.review(event,'loaded');self.replace_session(event['result']['session']);panel.message.set('Opened editable project in background. Original sources retained.');self.status.set(panel.message.get())
                    else:panel.ready=event;panel.message.set('Editable window ready. Open it explicitly; current project has not been replaced.');panel.update_buttons()
                else:
                    from engine.project import fingerprint
                    token=event['token'];matches=(token==self.native_requested and token[0]==self.document_token() and token[1]==self.session.slot and token[3]==self.native_serial and event['result']['input_fingerprint']==fingerprint(self.session.project))
                    if matches:
                        self.native_shown=event;controller.review(event,'displayed');panel.load_parameters(event['result']['parameters']);self.render()
                    else:controller.review(event,'stale')
            if controller.busy:
                progress=controller.status();message=progress.get('phase','Working')+' · '+str(progress.get('checkpoints',0))+' checkpoints'
                (panel.message if controller is self.io_jobs else panel.display).set(message)
        panel.update_buttons();self.native_poll_ticket=self.root.after(50,self.poll_native)
    def close(self):
        if self.confirm_discard():
            if self.joint_panel:self.joint_panel.close()
            if self.learned_panel:self.learned_panel.close()
            if self.candidate_editor:self.candidate_editor.close()
            if self.rebind_panel:self.rebind_panel.close()
            self.native_closed=True;self.cancel_native()
            if getattr(self,'native_poll_ticket',None):self.root.after_cancel(self.native_poll_ticket)
            self.cancel();self.root.destroy()
