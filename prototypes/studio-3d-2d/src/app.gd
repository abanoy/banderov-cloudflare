extends Control
const Timeline = preload("res://src/timeline.gd")
const Drawing = preload("res://src/drawing.gd")
const SceneIO = preload("res://src/scene3d.gd")
const Renderer = preload("res://src/renderer.gd")
const Storage = preload("res://src/storage.gd")
const Encoder = preload("res://src/encoder.gd")
const CanvasView = preload("res://src/canvas_view.gd")
const TimelineView = preload("res://src/timeline_view.gd")
const AudioTrack = preload("res://src/audio_track.gd")
const StudioTheme = preload("res://src/studio_theme.gd")
const Recovery = preload("res://src/recovery.gd")
const PoseEditor = preload("res://src/pose_editor.gd")
const SourceImport = preload("res://src/source_import.gd")
const SourceBrowser = preload("res://src/source_browser.gd")
var video := {"width": 1920, "height": 1080, "fps_num": 24, "fps_den": 1, "duration_frames": 48}
var keys: Array = []
var layers: Array = []
var source := ""
var project_folder := ""
var frame := 0
var active_layer := 1
var playing := false
var play_origin := 0
var play_start := 0
var drawing := false
var navigating := false
var camera_buttons := 0
var camera_free := false
var previous_point := Vector2.ZERO
var stroke_image: Image
var before_tiles := {}
var history: Array = []
var redo_history: Array = []
var history_bytes := 0
var dirty := false
var overlay_dirty := true
var exporting := false
var cancel_export := false
var encoder: RefCounted
var renderer: Node
var canvas: Control
var timeline: Control
var mode: OptionButton
var tool: OptionButton
var color: ColorPickerButton
var radius: SpinBox
var fov: SpinBox
var interpolation: OptionButton
var layer_choice: OptionButton
var layer_visibility: CheckButton
var exposure: SpinBox
var frame_box: SpinBox
var status: Label
var debug_label: Label
var transport_info: Label
var encoder_path: LineEdit
var cancel_button: Button
var controls: VBoxContainer
var elapsed_overlay_ms := 0.0
var last_export_folder := ""
var audio_clip := {}
var audio_mix := {}
var audio_player: AudioStreamPlayer
var audio_clock := false
var last_audio_time := 0.0
var audio_latency := 0.0
var audio_info: Label
var audio_start: SpinBox
var audio_trim: SpinBox
var audio_gain: SpinBox
var audio_mute: CheckButton
var advanced_mode := false
var advanced_toggle: Button
var advanced_controls: Array[Control] = []
var drawing_section: VBoxContainer
var camera_section: VBoxContainer
var audio_section: VBoxContainer
var workspace_label: Label
var scene_name: Label
var play_button: Button
var inspector_scroll: ScrollContainer
var recovery_root := ""
var recovery_session := ""
var recovery_revision := 0
var checkpoint_revision := -1
var autosave_due := 0
var autosave_enabled: CheckButton
var autosave_interval: SpinBox
var recovery_status: Label
var last_recovery_ms := 0.0
var recovered_from := ""
var pose_editor: Node
var source_import: Node
var source_browser: Node

func _ready() -> void:
	get_window().title = "Hybrid Animation Studio"
	DisplayServer.set_icon(StudioTheme.icon("scene").get_image())
	get_tree().auto_accept_quit = false
	keys = [Timeline.key(0, Vector3(-1.5, 2, 5), Quaternion.IDENTITY, 60), Timeline.key(48, Vector3(1.5, 1.6, 3), Quaternion(Vector3.UP, -0.15), 52)]
	for title in ["Rough", "Ink"]:
		layers.append({"id": str(ResourceUID.create_id()), "name": title, "visible": true, "cels": []})
	renderer = Renderer.new()
	add_child(renderer)
	renderer.setup()
	audio_player = AudioStreamPlayer.new()
	add_child(audio_player)
	audio_player.finished.connect(audio_finished)
	pose_editor = PoseEditor.new()
	add_child(pose_editor)
	source_import = SourceImport.new()
	source_import.app = self
	add_child(source_import)
	source_browser = SourceBrowser.new()
	source_browser.app = self
	add_child(source_browser)
	build_ui()
	var fixture := ProjectSettings.globalize_path("res://examples/room.glb")
	if not FileAccess.file_exists(fixture):
		var error := SceneIO.make_fixture(fixture)
		if error != OK:
			message("Cannot create sample room: " + error_string(error))
			return
	load_scene(fixture)
	set_frame(0)
	dirty = false
	begin_recovery_session()
	var recovery_timer := Timer.new()
	recovery_timer.wait_time = 1
	recovery_timer.timeout.connect(autosave_tick)
	add_child(recovery_timer)
	recovery_timer.start()
	message("Draw on Ink, or choose Scene / camera to set your shot. Space previews your movie. Advanced reveals detailed controls.")
	if "--smoke" in OS.get_cmdline_user_args():
		call_deferred("smoke")
	if "--ui-smoke" in OS.get_cmdline_user_args():
		get_tree().create_timer(40).timeout.connect(func(): push_error("UI smoke watchdog expired"); get_tree().quit(2))
		call_deferred("ui_smoke")
	if "--audio-smoke" in OS.get_cmdline_user_args():
		get_tree().create_timer(45).timeout.connect(func(): push_error("Audio smoke watchdog expired"); get_tree().quit(2))
		call_deferred("audio_smoke")
	if "--recovery-smoke" in OS.get_cmdline_user_args():
		get_tree().create_timer(40).timeout.connect(func(): push_error("Recovery watchdog expired"); get_tree().quit(2))
		call_deferred("recovery_smoke")
	if "--pose-smoke" in OS.get_cmdline_user_args():
		get_tree().create_timer(90).timeout.connect(func(): push_error("Pose watchdog expired"); get_tree().quit(2))
		call_deferred("pose_smoke")
	var testing := "--script" in OS.get_cmdline_args()
	for argument in OS.get_cmdline_user_args():
		if argument.contains("smoke"): testing = true
	if not testing and not Recovery.candidates(recovery_root, recovery_session).is_empty(): call_deferred("show_recovery")

func button(parent: Node, text: String, action: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.pressed.connect(action)
	b.focus_mode = Control.FOCUS_NONE
	parent.add_child(b)
	return b

func label(parent: Node, text: String) -> Label:
	var l := Label.new()
	l.text = text
	parent.add_child(l)
	return l

func spin(parent: Node, text: String, low: float, high: float, value: float) -> SpinBox:
	label(parent, text)
	var s := SpinBox.new()
	s.min_value = low
	s.max_value = high
	s.value = value
	parent.add_child(s)
	return s

func icon_button(parent: Node, text: String, kind: String, action: Callable, hint := "") -> Button:
	var control := button(parent, text, action)
	control.icon = StudioTheme.icon(kind)
	control.expand_icon = false
	control.add_theme_constant_override("icon_max_width", 22)
	control.tooltip_text = hint if not hint.is_empty() else text
	return control

func nav_button(parent: Node, text: String, kind: String, action: Callable, hint := "") -> Button:
	var control := icon_button(parent, text, kind, action, hint)
	control.custom_minimum_size = Vector2(86, 66)
	control.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	control.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	control.add_theme_constant_override("icon_max_width", 32)
	control.add_theme_font_size_override("font_size", 13)
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color.TRANSPARENT
	normal.set_content_margin_all(6)
	normal.set_corner_radius_all(6)
	var hover: StyleBoxFlat = normal.duplicate()
	hover.bg_color = Color(1, 1, 1, 0.2)
	hover.set_border_width_all(1)
	hover.border_color = Color(1, 1, 1, 0.35)
	var pressed: StyleBoxFlat = hover.duplicate()
	pressed.bg_color = Color(0.08, 0.25, 0.44, 0.25)
	control.add_theme_stylebox_override("normal", normal)
	control.add_theme_stylebox_override("disabled", normal)
	control.add_theme_stylebox_override("hover", hover)
	control.add_theme_stylebox_override("pressed", pressed)
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		control.add_theme_color_override(state, Color("ffffff"))
	control.add_theme_color_override("font_shadow_color", Color(0.08, 0.2, 0.34, 0.7))
	control.add_theme_constant_override("shadow_offset_y", 1)
	return control

func advanced(control: Control) -> Control:
	advanced_controls.append(control)
	return control

func advanced_spin(parent: Node, text: String, low: float, high: float, value: float) -> SpinBox:
	var row := VBoxContainer.new()
	parent.add_child(row)
	advanced(row)
	return spin(row, text, low, high, value)

func section(parent: Node, title: String, kind: String) -> VBoxContainer:
	var panel := PanelContainer.new()
	parent.add_child(panel)
	var box := VBoxContainer.new()
	panel.add_child(box)
	var heading := HBoxContainer.new()
	box.add_child(heading)
	var image := TextureRect.new()
	image.texture = StudioTheme.icon(kind)
	image.custom_minimum_size = Vector2(24, 24)
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	heading.add_child(image)
	label(heading, title).add_theme_font_size_override("font_size", 16)
	return box

func set_advanced(enabled: bool) -> void:
	# Presentation only: never reset project values, shot/navigation, transport or undo.
	advanced_mode = enabled
	advanced_toggle.set_pressed_no_signal(enabled)
	refresh_workspace()

func refresh_workspace() -> void:
	canvas.scene_navigation = mode.selected == 1
	canvas.tooltip_text = "Ctrl + left: free fly • Left: move • Right: POV • Middle: dolly • Left + right: roll • Esc: release" if mode.selected == 1 else "Wheel: zoom • Middle drag: pan • Space: play/pause"
	if mode.selected == 2: canvas.tooltip_text = "Click a joint; drag RGB handles • Middle: pan • Wheel: zoom • Esc: cancel drag • Record pose keys explicitly"
	for control in advanced_controls: control.visible = advanced_mode
	drawing_section.get_parent().visible = advanced_mode or mode.selected == 0
	camera_section.get_parent().visible = advanced_mode or mode.selected == 1
	pose_editor.panel.get_parent().visible = advanced_mode or mode.selected == 2
	audio_section.get_parent().visible = advanced_mode or not audio_clip.is_empty()
	workspace_label.text = "Advanced workspace" if advanced_mode else "Simple workspace"
	inspector_scroll.scroll_vertical = 0

func build_ui() -> void:
	theme = StudioTheme.make_theme()
	var back := TextureRect.new()
	back.texture = StudioTheme.svg_texture('<defs><linearGradient id="back" x2="0" y2="1"><stop stop-color="#f4f7fb"/><stop offset="1" stop-color="#dce5ee"/></linearGradient></defs><rect width="64" height="64" fill="url(#back)"/>', 64, 64)
	back.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(back)
	var shell := VBoxContainer.new()
	shell.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shell.add_theme_constant_override("separation", 0)
	add_child(shell)
	var title_panel := PanelContainer.new()
	var header_style := StyleBoxTexture.new()
	header_style.texture = StudioTheme.svg_texture('<defs><linearGradient id="header" x2="0" y2="1"><stop stop-color="#b6e1ff"/><stop offset="0.35" stop-color="#78b5e3"/><stop offset="1" stop-color="#3979b1"/></linearGradient></defs><rect width="64" height="64" fill="url(#header)"/>', 64, 64)
	header_style.content_margin_left = 14
	header_style.content_margin_right = 14
	header_style.content_margin_top = 10
	header_style.content_margin_bottom = 6
	title_panel.add_theme_stylebox_override("panel", header_style)
	shell.add_child(title_panel)
	var header_column := VBoxContainer.new()
	header_column.add_theme_constant_override("separation", 4)
	title_panel.add_child(header_column)
	var title_row := HBoxContainer.new()
	header_column.add_child(title_row)
	var title := label(title_row, "Hybrid Animation Studio")
	title.add_theme_color_override("font_color", Color("102e4d"))
	title.add_theme_font_size_override("font_size", 20)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	workspace_label = label(title_row, "Simple workspace")
	workspace_label.add_theme_color_override("font_color", Color("102e4d"))
	advanced_toggle = button(title_row, "Advanced", func(): set_advanced(advanced_toggle.button_pressed))
	advanced_toggle.toggle_mode = true
	advanced_toggle.tooltip_text = "Show detailed controls. Your scene, drawings, audio and settings keep working in either mode."
	var toolbar := HBoxContainer.new()
	header_column.add_child(toolbar)
	nav_button(toolbar, "Open", "folder", open_dialog, "Open an editable project")
	nav_button(toolbar, "Save", "save", save, "Save project • Ctrl+S")
	nav_button(toolbar, "Recover", "undo", show_recovery, "Review retained recovery checkpoints")
	advanced(nav_button(toolbar, "Save as…", "save", save_as))
	nav_button(toolbar, "Add scene", "scene", func(): choose_file("Import GLB or installed Source map", ["*.glb", "*.bsp", "*.gma", "*.bin"], load_scene, source_import.default_browse_dir()), "Import GLB or a GMod map from your installed game / Workshop")
	nav_button(toolbar, "Add model", "scene", pose_editor.import_dialog, "Add a poseable standard GLB model beside the environment")
	nav_button(toolbar, "Installed", "folder", func(): source_browser.open(), "Browse installed GMod models/maps, Workshop addons and dependency mounts")
	nav_button(toolbar, "Add audio", "audio", func(): choose_file("Import PCM 16-bit WAV (one clip)", ["*.wav"], import_audio_dialog), "Import one synchronized PCM16 WAV clip")
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	toolbar.add_child(spacer)
	nav_button(toolbar, "Export movie", "export", export_dialog, "Export MP4 and a recoverable PNG frame sequence")
	nav_button(toolbar, "About", "help", show_notices, "Credits and open source notices")
	var margin := MarginContainer.new()
	margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 10)
	shell.add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	margin.add_child(column)
	var middle := HBoxContainer.new()
	middle.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(middle)
	var center := VBoxContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	middle.add_child(center)
	var view_toolbar := HBoxContainer.new()
	center.add_child(view_toolbar)
	mode = OptionButton.new()
	mode.add_icon_item(StudioTheme.icon("draw"), "Draw")
	mode.add_icon_item(StudioTheme.icon("camera"), "Scene / camera")
	mode.add_icon_item(StudioTheme.icon("scene"), "Pose model")
	mode.add_theme_constant_override("icon_max_width", 22)
	mode.item_selected.connect(change_mode)
	mode.tooltip_text = "Draw on independent layers, or move the temporary 3D camera."
	view_toolbar.add_child(mode)
	button(view_toolbar, "Fit view", func(): canvas.zoom = 1; canvas.pan = Vector2.ZERO; canvas.queue_redraw())
	button(view_toolbar, "Frame scene", frame_3d_scene).tooltip_text = "Fit the 3D asset in the temporary editor camera; shot keys stay unchanged."
	icon_button(view_toolbar, "Undo", "undo", undo, "Undo • Ctrl+Z")
	icon_button(view_toolbar, "Redo", "redo", redo, "Redo • Ctrl+Y")
	canvas = CanvasView.new()
	canvas.custom_minimum_size = Vector2(600, 280)
	canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	canvas.background = renderer.viewport.get_texture()
	canvas.pointer.connect(canvas_input)
	canvas.tooltip_text = "Wheel: zoom • Middle drag: pan • Space: play/pause"
	center.add_child(canvas)
	scene_name = label(center, "")
	scene_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	var scroll := ScrollContainer.new()
	inspector_scroll = scroll
	scroll.custom_minimum_size.x = 276
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	middle.add_child(scroll)
	controls = VBoxContainer.new()
	controls.custom_minimum_size.x = 256
	controls.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(controls)
	drawing_section = section(controls, "Drawing", "draw")
	layer_choice = OptionButton.new()
	for layer in layers: layer_choice.add_item(layer.name)
	layer_choice.select(active_layer)
	layer_choice.item_selected.connect(func(index): finish_stroke(); active_layer = index; refresh_layer())
	drawing_section.add_child(layer_choice)
	layer_visibility = CheckButton.new()
	layer_visibility.text = "Show this layer"
	layer_visibility.button_pressed = true
	layer_visibility.toggled.connect(func(visible): layers[active_layer].visible = visible; changed())
	drawing_section.add_child(layer_visibility)
	tool = OptionButton.new()
	tool.add_item("Pen [B]")
	tool.add_item("Eraser [E]")
	drawing_section.add_child(tool)
	color = ColorPickerButton.new()
	color.color = Color("f4dfbd")
	color.custom_minimum_size.y = 32
	color.tooltip_text = "Drawing color"
	drawing_section.add_child(color)
	radius = spin(drawing_section, "Brush size (radius in pixels)", 1, 64, 6)
	icon_button(drawing_section, "New drawing", "cel", func(): create_cel(false), "Start a blank cel at this frame; it holds until the next drawing.")
	button(drawing_section, "Copy drawing here", func(): create_cel(true)).tooltip_text = "Make an independent copy of the held drawing at this frame."
	exposure = advanced_spin(drawing_section, "Exposure length (frames)", 1, 240, 48)
	advanced(button(drawing_section, "Set held cel exposure", set_exposure))
	advanced(button(drawing_section, "Delete held cel", delete_cel))
	camera_section = section(controls, "Camera", "camera")
	label(camera_section, "Ctrl + left: free camera / WASD
Left drag: move sideways / up
Right drag: adjust view direction
Middle drag: move forward / back
Left + right drag: roll camera
WASD / Q,E: fly while dragging
Shift: faster • Esc: release mouse")
	fov = advanced_spin(camera_section, "Editor camera FOV", 15, 120, 60)
	fov.value_changed.connect(func(value):
		if mode.selected == 1: renderer.camera.fov = value)
	interpolation = OptionButton.new()
	for item in ["ease", "linear", "hold"]: interpolation.add_item(item)
	advanced(label(camera_section, "Camera interpolation"))
	camera_section.add_child(interpolation)
	advanced(interpolation)
	icon_button(camera_section, "Save camera key [K]", "key", key_dialog, "Store this view at the current frame. Replacing an existing key asks first.")
	advanced(button(camera_section, "Delete key at this frame", delete_key))
	label(camera_section, "Move freely, then save a key.
Draw returns to the animated shot.")
	pose_editor.setup(self, controls)
	audio_section = section(controls, "Audio", "audio")
	audio_info = label(audio_section, "No audio clip")
	audio_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	audio_start = spin(audio_section, "Start at frame", 0, video.duration_frames - 1, 0)
	audio_trim = advanced_spin(audio_section, "Source trim in (milliseconds)", 0, 60000, 0)
	audio_trim.step = 0.001
	audio_gain = advanced_spin(audio_section, "Clip gain (dB)", -60, 12, 0)
	audio_gain.step = 0.1
	button(audio_section, "Apply audio settings", apply_audio_settings)
	audio_mute = CheckButton.new()
	audio_mute.text = "Mute audio"
	audio_mute.toggled.connect(func(value):
		if not audio_clip.is_empty():
			var before := audio_clip.duplicate(true)
			audio_clip.muted = value
			commit_audio(before))
	audio_section.add_child(audio_mute)
	advanced(button(audio_section, "Remove audio clip", remove_audio))
	var encoder_section := section(controls, "Movie encoder", "export")
	advanced(encoder_section.get_parent())
	encoder_path = LineEdit.new()
	encoder_path.text = default_ffmpeg()
	encoder_path.placeholder_text = "Full path to ffmpeg.exe"
	encoder_section.add_child(encoder_path)
	button(encoder_section, "Locate FFmpeg", func(): choose_file("Locate ffmpeg.exe", ["*.exe"], func(path): encoder_path.text = path))
	var recovery_section := section(controls, "Recovery", "save")
	advanced(recovery_section.get_parent())
	autosave_enabled = CheckButton.new()
	autosave_enabled.text = "Automatic recovery copies"
	autosave_enabled.button_pressed = true
	recovery_section.add_child(autosave_enabled)
	autosave_enabled.toggled.connect(func(value): recovery_status.text = "Recovery enabled" if value else "Recovery off — save manually")
	autosave_interval = spin(recovery_section, "Recovery interval (seconds)", 30, 600, 60)
	autosave_interval.value_changed.connect(func(value):
		autosave_due = Time.get_ticks_msec() + int(value * 1000)
		recovery_status.text = "Recovery every %ds" % value if autosave_enabled.button_pressed else "Recovery off — save manually")
	button(recovery_section, "Checkpoint now", func(): autosave_tick(true))
	button(recovery_section, "Open recovery folder", func():
		if DirAccess.dir_exists_absolute(recovery_root): OS.shell_open(recovery_root)
		else: message("No recovery folder yet. Create a checkpoint first."))
	button(recovery_section, "Open saved backup…", func(): choose_directory("Choose project whose previous save you want to restore", func(folder): request_recovery({"folder": folder, "manifest": "project.backup.json", "recovery": false})))
	var transport := HBoxContainer.new()
	column.add_child(transport)
	button(transport, "|◀", func(): stop(); set_frame(0)).tooltip_text = "First frame • Home"
	button(transport, "◀", func(): step(-1)).tooltip_text = "Previous frame • Left arrow"
	play_button = icon_button(transport, "Play", "play", toggle_play, "Play / pause • Space")
	button(transport, "▶|", func(): step(1)).tooltip_text = "Next frame • Right arrow"
	frame_box = spin(transport, "Frame", 0, video.duration_frames, 0)
	frame_box.value_changed.connect(func(value): stop(); set_frame(int(value)))
	transport_info = label(transport, "")
	timeline = TimelineView.new()
	timeline.custom_minimum_size.y = 160
	timeline.seek.connect(func(value): stop(); set_frame(value))
	column.add_child(timeline)
	debug_label = label(column, "")
	advanced(debug_label)
	var footer := HBoxContainer.new()
	column.add_child(footer)
	status = label(footer, "")
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.custom_minimum_size.y = 36
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	recovery_status = label(footer, "Recovery on • every 60s")
	recovery_status.tooltip_text = "Separate from manual Save. Waits until gestures, playback, export and dialogs finish."
	cancel_button = button(footer, "Cancel export", func(): cancel_export = true; if encoder: encoder.cancel())
	cancel_button.visible = false
	set_advanced(false)

func default_ffmpeg() -> String:
	var setting := OS.get_environment("HYBRID_FFMPEG")
	if not setting.is_empty(): return setting
	var common := "C:/Program Files/ffmpeg/bin/ffmpeg.exe"
	return common if FileAccess.file_exists(common) else "ffmpeg"

func message(text: String) -> void:
	status.text = text

func changed() -> void:
	recovery_revision += 1
	dirty = true
	overlay_dirty = true
	refresh_timeline()

func refresh_timeline() -> void:
	timeline.keys = keys
	timeline.layers = layers
	timeline.frame = frame
	timeline.duration = video.duration_frames
	timeline.audio_clip = audio_clip.duplicate()
	if not audio_clip.is_empty(): timeline.audio_clip["fps"] = float(video.fps_num) / video.fps_den
	timeline.waveform = audio_mix.get("peaks", PackedFloat32Array())
	timeline.pose_keys = renderer.model.data.pose_keys if renderer.model else []
	timeline.has_model = renderer.model != null
	timeline.custom_minimum_size.y = 184 if renderer.model else 160
	timeline.queue_redraw()

func refresh_layer() -> void:
	layer_visibility.set_pressed_no_signal(layers[active_layer].visible)
	var cel := Drawing.cel_at(layers[active_layer], frame)
	if not cel.is_empty(): exposure.value = cel.duration

func set_frame(value: int) -> void:
	if exporting: return
	pose_editor.finish_drag()
	finish_stroke()
	frame = clampi(value, 0, video.duration_frames)
	frame_box.set_value_no_signal(frame)
	transport_info.text = "%d fps  •  %.2f seconds  •  Frames 0–%d; key %d is the end boundary" % [video.fps_num / video.fps_den, Timeline.seconds(video.duration_frames, video), video.duration_frames - 1, video.duration_frames]
	if mode.selected != 1: renderer.evaluate(keys, frame)
	pose_editor.apply_frame()
	pose_editor.refresh_values()
	overlay_dirty = true
	refresh_layer()
	refresh_timeline()

func stop() -> void:
	playing = false
	if audio_player: audio_player.stop()
	audio_clock = false

func step(amount: int) -> void:
	if exporting: return
	stop()
	set_frame(clampi(frame + amount, 0, video.duration_frames - 1))

func toggle_play() -> void:
	if exporting: return
	finish_stroke()
	if playing:
		stop()
	else:
		mode.select(0)
		change_mode(0)
		if frame >= video.duration_frames: set_frame(0)
		playing = true
		play_start = frame
		play_origin = Time.get_ticks_usec()
		if not audio_mix.is_empty():
			audio_player.stream = audio_mix.stream
			audio_latency = AudioServer.get_output_latency()
			last_audio_time = Timeline.seconds(frame, video)
			audio_player.play(last_audio_time)
			audio_clock = AudioServer.get_driver_name() != "Dummy"
			if not audio_clock: message("Audio device unavailable (Dummy driver). Preview uses silent wall-clock fallback; export is unaffected.")

func change_mode(index: int) -> void:
	if exporting: return
	pose_editor.finish_drag()
	refresh_workspace()
	finish_stroke()
	stop()
	release_mouse()
	renderer.evaluate(keys, frame)
	fov.set_value_no_signal(renderer.camera.fov)
	pose_editor.apply_frame()
	pose_editor.refresh_values()
	if index == 1: message("Editor camera is temporary. Insert a key explicitly; switching to Draw restores the shot.")
	elif index == 2: message("Pose model: click a joint, then drag colored handles. Record pose keys explicitly. Camera and drawing remain separate.")
	else: message("Drawing edits only the active cel. Held frames share this drawing; duplicate to make a variation.")

func _process(delta: float) -> void:
	pose_editor.update_gizmo()
	play_button.text = "Pause" if playing else "Play"
	if playing:
		var seconds := preview_seconds()
		var next := floori(seconds * video.fps_num / video.fps_den)
		if next >= video.duration_frames:
			stop()
			set_frame(video.duration_frames - 1)
		elif next != frame: set_frame(next)
	if navigating and not exporting:
		var motion := Vector3(float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_E)) - float(Input.is_physical_key_pressed(KEY_Q)), float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W)))
		renderer.camera.position += renderer.camera.basis * motion.limit_length() * delta * (8 if Input.is_key_pressed(KEY_SHIFT) else 3)
	if overlay_dirty:
		var start := Time.get_ticks_usec()
		var overlay := Drawing.composite(layers, frame, video.width, video.height)
		if canvas.overlay == null: canvas.overlay = ImageTexture.create_from_image(overlay)
		else: canvas.overlay.update(overlay)
		elapsed_overlay_ms = (Time.get_ticks_usec() - start) / 1000.0
		canvas.queue_redraw()
		overlay_dirty = false
	var cel_count := 0
	for layer in layers: cel_count += layer.cels.size()
	debug_label.text = "Frame %03d / [0,%d) | %.3f s | %d/%d fps | GLB %s | %d cels | overlay %.2f ms | %s | %s" % [frame, video.duration_frames, Timeline.seconds(frame, video), video.fps_num, video.fps_den, source.get_file().left(12), cel_count, elapsed_overlay_ms, "audio clock %.3fs" % last_audio_time if audio_clock else ("silent/device fallback" if not audio_clip.is_empty() and playing else "audio ready" if not audio_clip.is_empty() else "no audio"), "unsaved" if dirty else "saved"]

func canvas_input(event: InputEvent, point: Vector2) -> void:
	if exporting or playing: return
	if mode.selected == 2:
		pose_editor.input(event, point)
		return
	if mode.selected == 1:
		if event is InputEventMouseButton: camera_button(event.button_index, event.pressed, event.ctrl_pressed)
		if event is InputEventMouseMotion and navigating: camera_motion(event.relative)
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if not Rect2(0, 0, video.width, video.height).has_point(point) or frame >= video.duration_frames: return
			if not layers[active_layer].visible:
				message("Show the active layer before drawing.")
				return
			var cel := Drawing.cel_at(layers[active_layer], frame)
			if cel.is_empty():
				create_cel(false)
				cel = Drawing.cel_at(layers[active_layer], frame)
			if cel.is_empty(): return
			stroke_image = cel.image
			drawing = true
			before_tiles = {}
			previous_point = point
			paint_segment(point)
		else: finish_stroke()
	if event is InputEventMouseMotion and drawing: paint_segment(point)

func paint_segment(point: Vector2) -> void:
	point = point.clamp(Vector2.ZERO, Vector2(video.width - 1, video.height - 1))
	var r := float(radius.value)
	var bounds := Rect2i(Vector2i((point.min(previous_point) - Vector2.ONE * (r + 2)).floor()), Vector2i((point.max(previous_point) - point.min(previous_point) + Vector2.ONE * (r * 2 + 4)).ceil())).intersection(Rect2i(0, 0, video.width, video.height))
	for ty in range(bounds.position.y / 64, (bounds.end.y + 63) / 64):
		for tx in range(bounds.position.x / 64, (bounds.end.x + 63) / 64):
			var pos := Vector2i(tx * 64, ty * 64)
			if not before_tiles.has(pos): before_tiles[pos] = stroke_image.get_region(Rect2i(pos, Vector2i(64, 64)).intersection(Rect2i(0, 0, video.width, video.height)))
	Drawing.stroke(stroke_image, previous_point, point, r, color.color, tool.selected == 1)
	previous_point = point
	changed()

func finish_stroke() -> void:
	if not drawing: return
	drawing = false
	var after := {}
	var cost := 0
	for pos in before_tiles:
		after[pos] = stroke_image.get_region(Rect2i(pos, before_tiles[pos].get_size()))
		cost += before_tiles[pos].get_data_size() * 2
	push_history({"type": "pixels", "image": stroke_image, "before": before_tiles, "after": after, "bytes": cost})
	stroke_image = null

func push_history(command: Dictionary) -> void:
	if command.type == "model":
		# Charge serialized snapshots conservatively; native metadata is copied too.
		command["bytes"] = 2 * (JSON.stringify(command.before).to_utf8_buffer().size() + JSON.stringify(command.after).to_utf8_buffer().size())
	if command.type == "cels":
		# Conservatively charge referenced rasters, including deleted cels retained by undo.
		command["bytes"] = (command.before.size() + command.after.size()) * video.width * video.height * 4
	history.append(command)
	redo_history.clear()
	history_bytes += command.get("bytes", 0)
	while (history_bytes > 64 * 1024 * 1024 or history.size() > 128) and history.size() > 1:
		history_bytes -= history.pop_front().get("bytes", 0)

func apply_command(command: Dictionary, side: String) -> void:
	if command.type == "pixels":
		for pos in command[side]:
			var image: Image = command[side][pos]
			command.image.blit_rect(image, Rect2i(Vector2i.ZERO, image.get_size()), pos)
	elif command.type == "cels": command.layer.cels = command[side].duplicate(true)
	elif command.type == "keys": keys = command[side].duplicate(true)
	elif command.type == "model": pose_editor.restore_state(command[side], false)
	elif command.type == "audio":
		audio_clip = command[side].duplicate(true)
		rebuild_audio()
	changed()
	set_frame(frame)

func undo() -> void:
	if exporting: return
	pose_editor.finish_drag()
	finish_stroke()
	if history.is_empty(): return
	var command: Dictionary = history.pop_back()
	history_bytes -= command.get("bytes", 0)
	apply_command(command, "before")
	redo_history.append(command)

func redo() -> void:
	if exporting or redo_history.is_empty(): return
	pose_editor.finish_drag()
	finish_stroke()
	var command: Dictionary = redo_history.pop_back()
	apply_command(command, "after")
	history.append(command)
	history_bytes += command.get("bytes", 0)

func create_cel(duplicate: bool) -> void:
	if exporting or frame >= video.duration_frames: return
	finish_stroke()
	var count := 0
	for layer in layers: count += layer.cels.size()
	if count >= 32: message("Prototype memory limit: 32 full-HD cels."); return
	var layer: Dictionary = layers[active_layer]
	for existing in layer.cels:
		if existing.start == frame:
			message("A cel already starts here. Move to another frame or delete this cel first.")
			return
	var before: Array = layer.cels.duplicate(true)
	var current := Drawing.cel_at(layer, frame)
	var image: Image = current.image.duplicate() if duplicate and not current.is_empty() else Drawing.blank(video.width, video.height)
	Drawing.insert(layer, frame, video.duration_frames, image)
	push_history({"type": "cels", "layer": layer, "before": before, "after": layer.cels.duplicate(true)})
	changed()
	refresh_layer()

func set_exposure() -> void:
	if exporting: return
	var layer: Dictionary = layers[active_layer]
	var cel := Drawing.cel_at(layer, frame)
	if cel.is_empty(): message("No cel at this frame."); return
	var before: Array = layer.cels.duplicate(true)
	var end: int = mini(video.duration_frames, cel.start + int(exposure.value))
	for other in layer.cels:
		if other.start > cel.start: end = mini(end, other.start)
	cel.duration = end - cel.start
	push_history({"type": "cels", "layer": layer, "before": before, "after": layer.cels.duplicate(true)})
	changed()

func delete_cel() -> void:
	if exporting: return
	finish_stroke()
	var layer: Dictionary = layers[active_layer]
	var cel := Drawing.cel_at(layer, frame)
	if cel.is_empty(): return
	var before: Array = layer.cels.duplicate(true)
	layer.cels.erase(cel)
	push_history({"type": "cels", "layer": layer, "before": before, "after": layer.cels.duplicate(true)})
	changed()

func key_dialog() -> void:
	if exporting: return
	if mode.selected not in [1, 2]: message("Switch to Scene or Pose mode and position the editor camera first."); return
	for key in keys:
		if key.frame == frame:
			confirm_action("Replace camera key at frame %d? Undo restores the previous key." % frame, insert_key)
			return
	insert_key()

func insert_key() -> void:
	var before := keys.duplicate(true)
	Timeline.put_key(keys, Timeline.key(frame, renderer.camera.position, renderer.camera.quaternion, renderer.camera.fov, interpolation.get_item_text(interpolation.selected)))
	push_history({"type": "keys", "before": before, "after": keys.duplicate(true)})
	changed()
	message("Camera key saved at frame %d." % frame)

func delete_key() -> void:
	if exporting or keys.size() <= 1: return
	var before := keys.duplicate(true)
	keys = keys.filter(func(key): return key.frame != frame)
	push_history({"type": "keys", "before": before, "after": keys.duplicate(true)})
	changed()
	set_frame(frame)

func camera_button(index: int, pressed: bool, ctrl := false) -> void:
	if index not in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]: return
	if index == MOUSE_BUTTON_LEFT: camera_free = pressed and ctrl
	var flag := 1 << (index - 1)
	if pressed: camera_buttons |= flag
	else: camera_buttons &= ~flag
	navigating = camera_buttons != 0
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if navigating else Input.MOUSE_MODE_VISIBLE

func camera_motion(relative: Vector2) -> void:
	var camera: Camera3D = renderer.camera
	var speed := 0.02 if Input.is_key_pressed(KEY_SHIFT) else 0.008
	if (camera_buttons & 3) == 3:
		# Both primary buttons roll about the viewing axis without changing position.
		camera.rotate_object_local(Vector3.FORWARD, -relative.x * 0.003)
	elif camera_buttons & MOUSE_BUTTON_MASK_MIDDLE:
		camera.position += camera.basis.z * relative.y * speed
	elif camera_buttons & MOUSE_BUTTON_MASK_RIGHT or camera_free:
		# World-up yaw plus local pitch preserves existing camera roll.
		camera.global_rotate(Vector3.UP, -relative.x * 0.003)
		camera.rotate_object_local(Vector3.RIGHT, -relative.y * 0.003)
		camera.quaternion = camera.quaternion.normalized()
	elif camera_buttons & MOUSE_BUTTON_MASK_LEFT:
		camera.position += (-camera.basis.x * relative.x + camera.basis.y * relative.y) * speed

func release_mouse() -> void:
	camera_free = false
	camera_buttons = 0
	navigating = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func frame_3d_scene() -> void:
	if exporting: return
	mode.select(1)
	change_mode(1)
	if renderer.frame_scene(): message("Editor camera framed the imported scene. Insert a key to use this view in the shot.")
	else: message("No renderable mesh to frame.")

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.keycode == KEY_CTRL and not event.pressed:
		camera_free = false
	if event is InputEventMouseMotion and pose_editor.dragging and not exporting:
		var rect: Rect2 = canvas.image_rect()
		var point: Vector2 = (event.position - canvas.global_position - rect.position) / rect.size * Vector2(1920, 1080)
		pose_editor.input(event, point)
		get_viewport().set_input_as_handled()
		return
	# Captured motion must continue even if the pointer leaves the canvas area.
	if event is InputEventMouseMotion and navigating and not exporting and not playing:
		camera_motion(event.relative)
		get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseButton and not event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			pose_editor.finish_drag()
			finish_stroke()
			if timeline: timeline.dragging = false
		if camera_buttons != 0: camera_button(event.button_index, false)
		if event.button_index == MOUSE_BUTTON_MIDDLE and canvas: canvas.panning = false
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		pose_editor.finish_drag(true)
		release_mouse()
	if event is InputEventKey:
		_unhandled_key_input(event)

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo or exporting: return
	var focus := get_viewport().gui_get_focus_owner()
	if focus is LineEdit or focus is TextEdit: return
	for child in get_children():
		if child is Window and child.visible: return
	if event.ctrl_pressed:
		match event.keycode:
			KEY_S: save()
			KEY_Z: redo() if event.shift_pressed else undo()
			KEY_Y: redo()
			_: return
	else:
		match event.keycode:
			KEY_SPACE: toggle_play()
			KEY_LEFT: step(-1)
			KEY_RIGHT: step(1)
			KEY_HOME: stop(); set_frame(0)
			KEY_END: stop(); set_frame(video.duration_frames - 1)
			KEY_B: tool.select(0)
			KEY_E: if mode.selected == 0: tool.select(1)
			KEY_K: key_dialog()
			_: return
	get_viewport().set_input_as_handled()

func choose_file(title: String, filters: PackedStringArray, action: Callable, initial_dir := "") -> void:
	if exporting: return
	stop()
	var dialog := FileDialog.new()
	dialog.title = title
	dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	dialog.filters = filters
	add_child(dialog)
	if not initial_dir.is_empty() and DirAccess.dir_exists_absolute(initial_dir): dialog.current_dir = initial_dir
	dialog.file_selected.connect(func(path): action.call(path); dialog.queue_free())
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered_ratio(0.7)

func choose_directory(title: String, action: Callable) -> void:
	if exporting: return
	stop()
	var dialog := FileDialog.new()
	dialog.title = title
	dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_DIR
	add_child(dialog)
	dialog.dir_selected.connect(func(path): action.call(path); dialog.queue_free())
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered_ratio(0.7)

func confirm_action(text: String, action: Callable) -> void:
	var dialog := ConfirmationDialog.new()
	dialog.dialog_text = text
	add_child(dialog)
	dialog.confirmed.connect(func(): dialog.hide(); dialog.queue_free(); action.call())
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered()

func load_scene(path: String) -> void:
	if exporting: return
	if path.get_extension().to_lower() != "glb": source_import.start(path, false); return
	stop()
	var error: String = renderer.import_scene(path)
	if not error.is_empty(): message(error); return
	source = path
	scene_name.text = "Scene: " + source.get_file() + "   •   1920 × 1080"
	changed()
	message("Scene loaded. " + "Static GLB geometry/materials; imported animations are not played.")

func save() -> void:
	if exporting: return
	finish_stroke()
	pose_editor.finish_drag()
	if project_folder.is_empty(): save_as(); return
	var error := Storage.save_project(project_folder, video, keys, layers, source, frame, audio_clip, {}, renderer.model_state())
	if error.is_empty():
		dirty = false
		var resolved := Recovery.resolve(recovery_root.path_join(recovery_session))
		if not recovered_from.is_empty():
			var recovered_error := Recovery.resolve(recovered_from)
			if not recovered_error.is_empty(): resolved = recovered_error
			else: recovered_from = ""
		recovery_status.text = "Project saved" if resolved.is_empty() else "Saved; recovery copy retained"
		message("Saved editable project: " + project_folder)
	else: message(error)

func save_as() -> void:
	choose_directory("Choose/create a project directory", func(path):
		if FileAccess.file_exists(path.path_join("project.json")):
			confirm_action("Replace this project's manifest? Its previous manifest will be backed up.", func(): project_folder = path; save())
		else: project_folder = path; save())

func open_dialog() -> void:
	var action := func(): choose_directory("Open project directory", open_project)
	if dirty: confirm_action("Discard unsaved edits and open another project?", action)
	else: action.call()

func open_project(folder: String, manifest_name := "project.json") -> bool:
	if exporting: return false
	var data := Storage.load_project(folder, manifest_name)
	if data.has("error"): message(data.error); return false
	var prepared: Dictionary = renderer.prepare_model(data.model)
	if prepared.has("error"): message(prepared.error); return false
	var error: String = renderer.import_scene(data.source)
	if not error.is_empty():
		if prepared.model: prepared.model.root.free()
		message(error)
		return false
	renderer.install_model(prepared)
	pose_editor.rebuild_tree()
	stop()
	finish_stroke()
	release_mouse()
	source = data.source
	video = data.video
	keys = data.camera_keys
	layers = data.layers
	audio_clip = data.audio
	project_folder = folder
	active_layer = mini(active_layer, layers.size() - 1)
	layer_choice.clear()
	for layer in layers: layer_choice.add_item(layer.name)
	layer_choice.select(active_layer)
	history.clear()
	redo_history.clear()
	history_bytes = 0
	mode.select(0)
	scene_name.text = "Scene: " + source.get_file() + "   •   %d × %d" % [video.width, video.height]
	refresh_workspace()
	frame_box.max_value = video.duration_frames
	rebuild_audio()
	var saved_editor = data.get("editor", {})
	var saved_frame := 0
	if saved_editor is Dictionary and Storage.integer(saved_editor.get("frame"), 0, video.duration_frames):
		saved_frame = int(saved_editor.frame)
	set_frame(saved_frame)
	dirty = false
	begin_recovery_session()
	message("Opened " + folder)
	return true

func export_dialog() -> void:
	choose_directory("Choose export parent directory (a new run folder will be created)", func(path): export_movie(path))

func export_movie(parent: String) -> String:
	if exporting: return "Export already running."
	finish_stroke()
	pose_editor.finish_drag()
	stop()
	release_mouse()
	var capabilities := Encoder.detect(encoder_path.text)
	if not capabilities.ok:
		message("FFmpeg missing or libx264/AAC unavailable. Turn on Advanced, then locate a compatible FFmpeg in Movie encoder.")
		return status.text
	var folder := parent.path_join("render_%d_%d" % [Time.get_unix_time_from_system(), Time.get_ticks_msec()])
	if DirAccess.make_dir_recursive_absolute(folder) != OK:
		message("Cannot create export directory.")
		return status.text
	last_export_folder = folder
	exporting = true
	export_controls(self, true)
	cancel_export = false
	cancel_button.visible = true
	var old_mode := mode.selected
	var old_transform: Transform3D = renderer.camera.transform
	var old_fov: float = renderer.camera.fov
	var error := ""
	var export_keys := keys.duplicate(true)
	var export_layers := layers.duplicate(true)
	for n in range(video.duration_frames):
		if cancel_export: error = "Export cancelled. PNG frames preserved."; break
		message("Rendering %d / %d • %s" % [n + 1, video.duration_frames, folder])
		var image: Image = await renderer.capture(export_keys, export_layers, n, true)
		if image.save_png(folder.path_join("frame_%06d.png" % (n + 1))) != OK:
			error = "Could not write PNG (check disk space/permissions). Frames preserved."
			break
	if cancel_export and error.is_empty():
		error = "Export cancelled. PNG frames preserved."
	if error.is_empty():
		var mix_path := ""
		if not audio_clip.is_empty():
			message("Writing synchronized audio mix…")
			mix_path = folder.path_join("mixed_audio.wav")
			if audio_mix.is_empty() or audio_mix.stream.save_to_wav(mix_path) != OK:
				error = "Cannot write synchronized WAV mix. PNGs preserved."
		if error.is_empty():
			message("Encoding H.264 MP4… Cancel remains available.")
			encoder = Encoder.new()
			error = await encoder.encode(get_tree(), encoder_path.text, folder, video, mix_path)
	encoder = null
	exporting = false
	export_controls(self, false)
	pose_editor.sync_enabled()
	cancel_button.visible = false
	mode.select(old_mode)
	if old_mode in [1, 2]:
		renderer.camera.transform = old_transform
		renderer.camera.fov = old_fov
	else: renderer.evaluate(keys, frame)
	pose_editor.apply_frame()
	message("Exported " + folder.path_join("movie.mp4") if error.is_empty() else error + "\n" + folder)
	return error

func export_controls(node: Node, busy: bool) -> void:
	if node == cancel_button: return
	if node is BaseButton: node.disabled = busy
	if node is SpinBox or node is LineEdit: node.editable = not busy
	for child in node.get_children(): export_controls(child, busy)

func show_notices() -> void:
	var dialog := AcceptDialog.new()
	dialog.title = "Credits / open source notices"
	dialog.dialog_text = "Godot Engine 4.6 — MIT\nCopyright (c) 2014-present Godot Engine contributors.\nCopyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.\nhttps://godotengine.org/license/\n\nFFmpeg is invoked as your separately installed executable.\nThis installed build enables GPL/version3; no binary is bundled.\nhttps://ffmpeg.org/legal.html\n\nRoom fixture: original procedural geometry; no downloaded models.\nApplication license: owner decision pending.\nFull records: THIRD_PARTY_NOTICES.md and docs/licenses.md."
	add_child(dialog)
	dialog.confirmed.connect(dialog.queue_free)
	dialog.popup_centered(Vector2i(720, 430))

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if source_import and source_import.pid > 0:
			source_import.cancel()
			message("Cancelling Source preparation. Close again after it stops.")
		elif exporting:
			cancel_export = true
			if encoder: encoder.cancel()
			message("Cancelling export. Close again after it stops.")
		elif dirty: confirm_action("Close with unsaved edits?", func(): get_tree().quit())
		else: get_tree().quit()
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		if pose_editor: pose_editor.finish_drag()
		finish_stroke()
		release_mouse()
		if canvas: canvas.panning = false
		if timeline: timeline.dragging = false

func smoke() -> void:
	# Integration checks are in a separate runner, loaded only when requested.
	var runner = load("res://tests/app_smoke.gd").new()
	add_child(runner)
	await runner.run(self)

func audio_smoke() -> void:
	var runner = load("res://tests/audio_editor_smoke.gd").new()
	add_child(runner)
	await runner.run(self)

func ui_smoke() -> void:
	var runner = load("res://tests/ui_smoke.gd").new()
	add_child(runner)
	await runner.run(self)

func recovery_smoke() -> void:
	var runner = load("res://tests/recovery_smoke.gd").new()
	add_child(runner)
	await runner.run(self)

func pose_smoke() -> void:
	var runner = load("res://tests/pose_smoke.gd").new()
	add_child(runner)
	await runner.run(self)

func begin_recovery_session() -> void:
	recovered_from = ""
	if recovery_root.is_empty(): recovery_root = ProjectSettings.globalize_path("res://output/recovery")
	recovery_session = "%d_%s" % [Time.get_unix_time_from_system(), str(ResourceUID.create_id())]
	checkpoint_revision = -1
	autosave_due = Time.get_ticks_msec() + int(autosave_interval.value * 1000)

func has_dialog(node: Node) -> bool:
	for child in node.get_children():
		if child is Window and child.visible: return true
		if has_dialog(child): return true
	return false

func autosave_tick(force := false) -> void:
	if not autosave_enabled.button_pressed and not force: return
	if not dirty or recovery_revision == checkpoint_revision: return
	if drawing or navigating or playing or exporting or pose_editor.dragging: return
	if has_dialog(self): return
	if not force and Time.get_ticks_msec() < autosave_due: return
	autosave_due = Time.get_ticks_msec() + int(autosave_interval.value * 1000)
	var started := Time.get_ticks_usec()
	var error := Recovery.checkpoint(recovery_root, recovery_session, video, keys, layers, source, frame, audio_clip, project_folder, recovery_revision, renderer.model_state())
	last_recovery_ms = (Time.get_ticks_usec() - started) / 1000.0
	if error.is_empty():
		checkpoint_revision = recovery_revision
		recovery_status.text = "Recovery copy saved"
	else:
		recovery_status.text = "Recovery failed — save manually"
		message(error)

func show_recovery() -> void:
	if exporting: return
	stop()
	finish_stroke()
	release_mouse()
	# Review our own sessions too, with actual checkpoint times; other live apps stay hidden.
	var entries := Recovery.candidates(recovery_root, "", true)
	var dialog := AcceptDialog.new()
	dialog.title = "Recover work"
	dialog.ok_button_text = "Restore as unsaved copy"
	dialog.dialog_hide_on_ok = false
	dialog.add_cancel_button("Later")
	add_child(dialog)
	var box := VBoxContainer.new()
	dialog.add_child(box)
	label(box, "Recovery keeps your manual project intact. Restore, then choose Save as.")
	var list := ItemList.new()
	list.custom_minimum_size = Vector2(620, 220)
	box.add_child(list)
	for entry in entries:
		var age := maxi(0, int((Time.get_unix_time_from_system() - entry.saved_at) / 60))
		list.add_item(("Untitled" if entry.origin.is_empty() else entry.origin.get_file()) + " • %dm ago • " % age + ("previous checkpoint" if entry.manifest == "project.backup.json" else "latest checkpoint"))
	if not entries.is_empty(): list.select(0)
	else: label(box, "No pending checkpoints. Advanced > Recovery can open a project's saved backup.")
	dialog.get_ok_button().disabled = entries.is_empty()
	dialog.confirmed.connect(func():
		var selected := list.get_selected_items()
		if selected.is_empty(): return
		var entry: Dictionary = entries[selected[0]]
		dialog.queue_free()
		request_recovery(entry))
	var dismiss := dialog.add_button("Dismiss session", true, "dismiss")
	dismiss.tooltip_text = "Hide both checkpoints for this session; keep their files in the recovery cache."
	dismiss.disabled = entries.is_empty()
	dialog.custom_action.connect(func(action):
		if action != "dismiss" or list.get_selected_items().is_empty(): return
		var error := Recovery.resolve(entries[list.get_selected_items()[0]].folder)
		message("Checkpoint dismissed; files retained in recovery cache." if error.is_empty() else error)
		dialog.queue_free())
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered()

func request_recovery(entry: Dictionary) -> void:
	if dirty: confirm_action("Replace the current unsaved edits with this recovery copy?", func(): restore_checkpoint(entry))
	else: restore_checkpoint(entry)

func restore_checkpoint(entry: Dictionary) -> bool:
	if not open_project(entry.folder, entry.get("manifest", "project.json")): return false
	if entry.get("recovery", true): recovered_from = entry.folder
	project_folder = ""
	changed()
	message("Recovered as an unsaved copy. Use Save to choose a project folder; the old manual save is untouched.")
	return true

func preview_seconds() -> float:
	if audio_clock and audio_player.playing:
		var time := audio_player.get_playback_position() + AudioServer.get_time_since_last_mix() - audio_latency
		last_audio_time = maxf(last_audio_time, time)
		return last_audio_time
	return Timeline.seconds(play_start, video) + (Time.get_ticks_usec() - play_origin) / 1000000.0

func audio_finished() -> void:
	if playing and audio_clock:
		stop()
		set_frame(video.duration_frames - 1)

func import_audio_dialog(path: String) -> void:
	if audio_clip.is_empty(): import_audio(path)
	else: confirm_action("Replace the current audio clip? Undo restores it.", func(): import_audio(path))

func import_audio(path: String) -> String:
	if exporting: return "Cannot import during export."
	stop()
	var decoded := AudioTrack.read_wav(path)
	if decoded.has("error"): message(decoded.error); return decoded.error
	var candidate := AudioTrack.make_clip(decoded)
	var mixed := AudioTrack.mix(candidate, video)
	if mixed.has("error"): message(mixed.error); return mixed.error
	var before := audio_clip.duplicate(true)
	audio_clip = candidate
	commit_audio(before)
	inspector_scroll.ensure_control_visible.call_deferred(audio_mute)
	message("Audio added. Set its start frame and Apply. Advanced reveals trim and volume; existing settings stay active in Simple.")
	return ""

func rebuild_audio() -> void:
	refresh_workspace()
	stop()
	audio_mix = {}
	if not audio_clip.is_empty():
		var mixed := AudioTrack.mix(audio_clip, video)
		if mixed.has("error"): message(mixed.error)
		else: audio_mix = mixed
	refresh_audio_controls()
	refresh_timeline()

func refresh_audio_controls() -> void:
	audio_start.max_value = video.duration_frames - 1
	if audio_clip.is_empty():
		audio_info.text = "No audio clip"
		audio_mute.set_pressed_no_signal(false)
		audio_start.value = 0
		audio_trim.value = 0
		audio_gain.value = 0
	else:
		audio_info.text = "%s\n%.2f s • %d Hz • %s" % [audio_clip.source.name.left(35), float(audio_clip.source.frames) / audio_clip.source.rate, audio_clip.source.rate, "stereo" if audio_clip.source.channels == 2 else "mono"]
		audio_start.value = audio_clip.start_frame
		audio_trim.value = float(audio_clip.source_in_sample) * 1000 / audio_clip.source.rate
		audio_gain.value = audio_clip.gain_db
		audio_mute.set_pressed_no_signal(audio_clip.muted)

func commit_audio(before: Dictionary) -> void:
	push_history({"type": "audio", "before": before, "after": audio_clip.duplicate(true), "bytes": (before.source.pcm.size() if before.has("source") else 0) + (audio_clip.source.pcm.size() if audio_clip.has("source") else 0)})
	rebuild_audio()
	changed()

func apply_audio_settings() -> void:
	if exporting or audio_clip.is_empty(): return
	stop()
	var trimmed := roundi(audio_trim.value / 1000 * audio_clip.source.rate)
	if trimmed >= audio_clip.source.frames:
		message("Source trim must be before the end of the WAV. Previous settings preserved.")
		return
	var before := audio_clip.duplicate(true)
	audio_clip.start_frame = int(audio_start.value)
	audio_clip.source_in_sample = trimmed
	audio_clip.gain_db = float(audio_gain.value)
	commit_audio(before)
	message("Audio timing/gain applied; preview and export updated.")

func remove_audio() -> void:
	if exporting or audio_clip.is_empty(): return
	var before := audio_clip.duplicate(true)
	audio_clip = {}
	commit_audio(before)
