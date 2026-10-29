extends Node
const Model = preload("res://src/model.gd")
const Timeline = preload("res://src/timeline.gd")
var app
var panel: VBoxContainer
var tree: Tree
var search: LineEdit
var operation: OptionButton
var space: OptionButton
var snap: CheckButton
var fields: Array[SpinBox] = []
var locks: Array[CheckBox] = []
var scale_field: SpinBox
var interpolation: OptionButton
var visible_toggle: CheckButton
var reference_toggle: CheckButton
var info: Label
var selected := "@root"
var tree_items := {}
var handles: Array = []
var joints: Array = []
var dragging := false
var drag_before := {}
var drag_start := Vector2.ZERO
var drag_axis := Vector3.ZERO
var drag_world := Transform3D.IDENTITY
var drag_screen_axis := Vector2.ZERO
var drag_pixels := 80.0
var drag_units := 1.0
var import_control: Button
var scale_apply: Button

func setup(owner_app, parent: Node) -> void:
	app = owner_app
	panel = app.section(parent, "Model / pose", "scene")
	import_control = app.button(panel, "Add / replace model…", import_dialog)
	app.advanced(import_control)
	app.button(panel, "Frame model", frame_model)
	app.button(panel, "Record pose key", record_dialog)
	info = app.label(panel, "Add a prepared GLB model. Native imports share this standard pose system.")
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	search = LineEdit.new()
	search.placeholder_text = "Find bone…"
	search.text_changed.connect(func(_text): rebuild_tree())
	panel.add_child(search)
	tree = Tree.new()
	tree.custom_minimum_size = Vector2(220, 125)
	tree.hide_root = false
	tree.item_selected.connect(func():
		if tree.get_selected(): selected = tree.get_selected().get_metadata(0); refresh_values())
	var system_font := SystemFont.new()
	system_font.font_names = PackedStringArray(["Yu Gothic UI", "Segoe UI", "Arial"])
	tree.add_theme_font_override("font", system_font)
	panel.add_child(tree)
	operation = OptionButton.new()
	operation.add_item("Rotate")
	operation.add_item("Move")
	operation.item_selected.connect(func(_index): refresh_values())
	panel.add_child(operation)
	space = OptionButton.new()
	space.add_item("Local axes")
	space.add_item("World axes")
	panel.add_child(space)
	panel.move_child(operation, 4)
	panel.move_child(space, 5)
	snap = CheckButton.new()
	snap.text = "Snap (15° / 0.1 units)"
	panel.add_child(app.advanced(snap))
	for axis in ["X", "Y", "Z"]:
		fields.append(app.advanced_spin(panel, "Local " + axis, -100000, 100000, 0))
	app.advanced(app.button(panel, "Apply local values", apply_numeric))
	var lock_row := HBoxContainer.new()
	panel.add_child(lock_row)
	app.advanced(lock_row)
	for axis in ["X", "Y", "Z"]:
		var lock := CheckBox.new()
		lock.text = "Lock " + axis
		lock_row.add_child(lock)
		locks.append(lock)
	scale_field = app.advanced_spin(panel, "Model uniform scale", 0.001, 10000, 1)
	scale_field.step = 0.001
	scale_apply = app.button(panel, "Apply model scale", func():
		if not app.renderer.model: return
		var before: Dictionary = app.renderer.model.data.duplicate(true)
		begin_draft()
		app.renderer.model.data.scale = scale_field.value
		commit(before))
	app.advanced(scale_apply)
	app.advanced(app.button(panel, "Reset selected", reset_selected))
	interpolation = OptionButton.new()
	for name in ["ease", "linear", "hold"]: interpolation.add_item(name)
	panel.add_child(app.advanced(interpolation))
	app.advanced(app.button(panel, "Delete pose key", delete_key))
	app.advanced(app.button(panel, "Save view as camera key", app.key_dialog))
	visible_toggle = CheckButton.new()
	visible_toggle.text = "Show model"
	visible_toggle.toggled.connect(func(value): set_flag("visible", value))
	panel.add_child(visible_toggle)
	reference_toggle = CheckButton.new()
	reference_toggle.text = "Reference only (hide in movie)"
	reference_toggle.toggled.connect(func(value): set_flag("reference_only", value))
	panel.add_child(reference_toggle)
	app.advanced(app.button(panel, "Remove model", func():
		if app.renderer.model: app.confirm_action("Remove this model? Undo restores it.", func(): restore_state({})) ))
	app.label(panel, "Click a joint, then drag a colored handle.\nEsc cancels a pose drag.\nRecord edits explicitly for animation.").autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rebuild_tree()

func sync_enabled(node: Node = panel) -> void:
	for child in node.get_children():
		if child == import_control: continue
		if child is BaseButton: child.disabled = app.renderer.model == null
		if child is SpinBox or child is LineEdit: child.editable = app.renderer.model != null
		sync_enabled(child)

func import_dialog() -> void:
	var action := func(): app.choose_file("Add GLB or installed Source model", ["*.glb", "*.mdl", "*.gma", "*.bin"], add_model, app.source_import.default_browse_dir())
	if app.renderer.model: app.confirm_action("Replace the model slot? This increment supports one model beside the environment.", action)
	else: action.call()

func add_model(path: String) -> String:
	if path.get_extension().to_lower() != "glb": app.source_import.start(path, true); return ""
	var data := Model.definition(path)
	var report := path.get_base_dir().path_join("parameters.json")
	var file := FileAccess.open(report, FileAccess.READ) if FileAccess.file_exists(report) else null
	if FileAccess.file_exists(report):
		if file == null or file.get_length() > 256 * 1024:
			app.message("Cannot preserve parameter report (unreadable or over 256 KiB). Model not replaced.")
			return app.status.text
		var parser := JSON.new()
		if parser.parse(file.get_as_text()) != OK or not parser.data is Dictionary:
			app.message("Parameter report is invalid JSON; model not replaced.")
			return app.status.text
		data.name = str(parser.data.get("source_file", data.name)).left(200)
		data.metadata = {"native_parameters": parser.data, "external_bundle": path.get_base_dir(), "note": "Keep full native preparation bundle; only GLB and this supplied report are managed here. Native fidelity is not implied."}
	var error := restore_state(data)
	if error.is_empty():
		app.mode.select(2)
		app.change_mode(2)
		app.message("Model added through the standard GLB contract. Select a bone to pose; record keys for animation.")
	return error

func restore_state(data: Dictionary, history := true) -> String:
	app.stop()
	var before: Dictionary = app.renderer.model_state().duplicate(true)
	var error := Model.validate(data, app.video.duration_frames)
	if not error.is_empty(): app.message(error); return error
	if app.renderer.model and not data.is_empty() and app.renderer.model.data.source == data.source and app.renderer.model.data.sha256 == data.sha256:
		app.renderer.model.data = data.duplicate(true)
	else:
		var prepared: Dictionary = app.renderer.prepare_model(data)
		if prepared.has("error"): app.message(prepared.error); return prepared.error
		app.renderer.install_model(prepared)
	if history:
		app.push_history({"type": "model", "before": before, "after": data.duplicate(true)})
		app.changed()
	rebuild_tree()
	apply_frame()
	return ""

func commit(before: Dictionary) -> void:
	app.stop()
	var after: Dictionary = app.renderer.model.data.duplicate(true)
	if JSON.stringify(before) != JSON.stringify(after):
		app.push_history({"type": "model", "before": before, "after": after})
		app.changed()
	apply_frame()
	refresh_values()

func rebuild_tree() -> void:
	sync_enabled()
	tree.clear()
	tree_items.clear()
	if not app.renderer.model:
		info.text = "No model. Add a prepared GLB to pose."
		return
	var rig = app.renderer.model
	var root_item := tree.create_item()
	root_item.set_text(0, rig.data.name + " / root")
	root_item.set_metadata(0, "@root")
	tree_items["@root"] = root_item
	for id in rig.order:
		if search.text.is_empty(): make_tree_item(id)
		elif rig.bones[id].name.to_lower().contains(search.text.to_lower()):
			var item := tree.create_item(root_item)
			item.set_text(0, rig.bones[id].name)
			item.set_metadata(0, id)
			tree_items[id] = item
	if not tree_items.has(selected): selected = "@root"
	tree_items[selected].select(0)
	tree.scroll_to_item(tree_items[selected])
	visible_toggle.set_pressed_no_signal(rig.data.visible)
	reference_toggle.set_pressed_no_signal(rig.data.reference_only)
	refresh_values()

func make_tree_item(id: String) -> TreeItem:
	if tree_items.has(id): return tree_items[id]
	var rig = app.renderer.model
	var parent: String = rig.parent_id(id)
	var item := tree.create_item(tree_items["@root"] if parent == "@root" else make_tree_item(parent))
	item.set_text(0, rig.bones[id].name)
	item.set_metadata(0, id)
	item.set_tooltip_text(0, id)
	tree_items[id] = item
	return item

func refresh_values() -> void:
	if not app.renderer.model: return
	var rig = app.renderer.model
	var value: Dictionary = rig.sample_transform(app.frame, true) if selected == "@root" else rig.sample(app.frame, true).get(selected, Model.identity())
	var values := Timeline.vector(value.position) if operation.selected == 1 else Timeline.quaternion(value.rotation_xyzw).get_euler() * 180.0 / PI
	for i in range(3):
		fields[i].step = 0.01 if operation.selected == 1 else 1
		fields[i].set_value_no_signal(values[i])
	scale_field.set_value_no_signal(rig.sample_transform(app.frame, true).scale)
	info.text = "%s • %d bones\n%s" % [rig.data.name, rig.order.size(), "Reference only: hidden in movie." if rig.data.reference_only else "Static pose: included in movie." if rig.data.pose_keys.is_empty() else "Animation uses recorded keys. Record this frame after editing."]

func apply_frame() -> void:
	if app.renderer.model: app.renderer.model.apply(app.frame, app.mode.selected == 2 and not app.playing)
	app.canvas.queue_redraw()

func begin_draft() -> void:
	var rig = app.renderer.model
	if rig.data.draft_frame != app.frame:
		var transform: Dictionary = rig.sample_transform(app.frame)
		rig.data.position = transform.position
		rig.data.rotation_xyzw = transform.rotation_xyzw
		rig.data.scale = transform.scale
		rig.data.pose = rig.sample(app.frame)
		rig.data.draft_frame = app.frame

func set_delta(position: Vector3, rotation: Quaternion) -> void:
	begin_draft()
	var value := {"position": [position.x, position.y, position.z], "rotation_xyzw": [rotation.x, rotation.y, rotation.z, rotation.w]}
	if selected == "@root":
		app.renderer.model.data.position = value.position
		app.renderer.model.data.rotation_xyzw = value.rotation_xyzw
	else:
		app.renderer.model.data.pose[selected] = value

func apply_numeric() -> void:
	if not app.renderer.model: return
	var before: Dictionary = app.renderer.model.data.duplicate(true)
	var old: Dictionary = app.renderer.model.sample_transform(app.frame, true) if selected == "@root" else app.renderer.model.sample(app.frame, true).get(selected, Model.identity())
	var values := Vector3(fields[0].value, fields[1].value, fields[2].value)
	var p := Timeline.vector(old.position)
	var r := Timeline.quaternion(old.rotation_xyzw).get_euler() * 180 / PI
	for i in range(3):
		if not locks[i].button_pressed:
			if operation.selected == 0: r[i] = snappedf(values[i], 15) if snap.button_pressed else values[i]
			else: p[i] = snappedf(values[i], 0.1) if snap.button_pressed else values[i]
	set_delta(p, Quaternion.from_euler(r * PI / 180))
	commit(before)

func reset_selected() -> void:
	if not app.renderer.model: return
	var before: Dictionary = app.renderer.model.data.duplicate(true)
	set_delta(Vector3.ZERO, Quaternion.IDENTITY)
	commit(before)

func set_flag(flag: String, value: bool) -> void:
	if not app.renderer.model: return
	var before: Dictionary = app.renderer.model.data.duplicate(true)
	app.renderer.model.data[flag] = value
	commit(before)

func record_dialog() -> void:
	if not app.renderer.model: return
	app.stop()
	for key in app.renderer.model.data.pose_keys:
		if key.frame == app.frame:
			app.confirm_action("Replace pose key at frame %d? Undo restores it." % app.frame, record_key)
			return
	record_key()

func record_key() -> void:
	if not app.renderer.model: return
	app.stop()
	var rig = app.renderer.model
	var before: Dictionary = rig.data.duplicate(true)
	Timeline.put_key(rig.data.pose_keys, {"frame": app.frame, "pose": rig.sample(app.frame, true), "transform": rig.sample_transform(app.frame, true), "interpolation": interpolation.get_item_text(interpolation.selected)})
	commit(before)
	app.message("Pose key recorded at frame %d." % app.frame)

func delete_key() -> void:
	if not app.renderer.model: return
	var before: Dictionary = app.renderer.model.data.duplicate(true)
	app.renderer.model.data.pose_keys = app.renderer.model.data.pose_keys.filter(func(key): return key.frame != app.frame)
	commit(before)

func frame_model() -> void:
	if not app.renderer.model: return
	app.mode.select(2)
	app.change_mode(2)
	app.renderer.frame_scene(app.renderer.model.root)
	app.message("Model framed for posing. This view is temporary; Advanced has Save view as camera key.")

func update_gizmo() -> void:
	app.canvas.pose_lines = []
	app.canvas.pose_joints = []
	handles.clear(); joints.clear()
	if app.mode.selected != 2 or not app.renderer.model or not app.renderer.model.root.visible: return
	var rig = app.renderer.model
	var camera: Camera3D = app.renderer.camera
	for id in rig.order:
		var transform: Transform3D = rig.bone_transform(id)
		if camera.is_position_behind(transform.origin): continue
		var point := camera.unproject_position(transform.origin)
		joints.append({"id": id, "point": point})
		app.canvas.pose_joints.append({"point": point, "selected": id == selected})
		var parent: String = rig.parent_id(id)
		if parent != "@root":
			var origin: Vector3 = rig.bone_transform(parent).origin
			if not camera.is_position_behind(origin): app.canvas.pose_lines.append({"a": point, "b": camera.unproject_position(origin), "color": Color(0.5, 0.9, 1, 0.55)})
	var transform: Transform3D = rig.bone_transform(selected)
	if camera.is_position_behind(transform.origin): return
	var center := camera.unproject_position(transform.origin)
	var depth := maxf(camera.near, -camera.to_local(transform.origin).z)
	var radius := camera.project_position(center + Vector2(70, 0), depth).distance_to(transform.origin)
	var basis := transform.basis.orthonormalized() if space.selected == 0 else Basis.IDENTITY
	var colors := [Color("ef5b50"), Color("6bd978"), Color("6c9eff")]
	for axis in range(3):
		if locks[axis].button_pressed: continue
		var direction: Vector3 = basis[axis]
		var points: Array[Vector2] = []
		if operation.selected == 1:
			points = [center, camera.unproject_position(transform.origin + direction * radius)]
		else:
			for i in range(49):
				var angle := TAU * i / 48
				var point: Vector3 = transform.origin + (basis[(axis + 1) % 3] * cos(angle) + basis[(axis + 2) % 3] * sin(angle)) * radius
				points.append(camera.unproject_position(point))
		for i in range(points.size() - 1):
			app.canvas.pose_lines.append({"a": points[i], "b": points[i + 1], "color": colors[axis]})
		handles.append({"axis": direction, "points": points, "world": transform, "units": radius})
	app.canvas.queue_redraw()

func input(event: InputEvent, point: Vector2) -> void:
	if not app.renderer.model: return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if not event.pressed: finish_drag(); return
		var threshold: float = 10.0 * 1920 / maxf(1, app.canvas.image_rect().size.x)
		var best := threshold
		var hit := {}
		for handle in handles:
			for i in range(handle.points.size() - 1):
				var distance: float = point.distance_to(Geometry2D.get_closest_point_to_segment(point, handle.points[i], handle.points[i + 1]))
				if distance < best: best = distance; hit = handle
		if not hit.is_empty():
			dragging = true
			drag_before = app.renderer.model.data.duplicate(true)
			drag_start = point; drag_axis = hit.axis; drag_world = hit.world; drag_units = hit.units
			drag_screen_axis = hit.points[-1] - hit.points[0] if operation.selected == 1 else Vector2(1, -1)
			drag_pixels = maxf(1, drag_screen_axis.length())
			return
		for joint in joints:
			if point.distance_to(joint.point) < best:
				best = point.distance_to(joint.point)
				selected = joint.id
		if tree_items.has(selected): tree_items[selected].select(0); tree.scroll_to_item(tree_items[selected])
		refresh_values()
	if event is InputEventMouseMotion and dragging:
		var value: Dictionary = drag_before if selected == "@root" else app.renderer.model.sample(app.frame, true).get(selected, Model.identity())
		# Always derive from the gesture's original state, so events do not accumulate error.
		var old_data: Dictionary = app.renderer.model.data
		app.renderer.model.data = drag_before
		value = app.renderer.model.sample_transform(app.frame, true) if selected == "@root" else app.renderer.model.sample(app.frame, true).get(selected, Model.identity())
		app.renderer.model.data = old_data
		var position := Timeline.vector(value.position)
		var rotation := Timeline.quaternion(value.rotation_xyzw)
		if operation.selected == 0:
			var angle := (point - drag_start).dot(Vector2(1, -1)) * 0.01
			if snap.button_pressed: angle = snappedf(angle, deg_to_rad(15))
			if selected == "@root": rotation = Quaternion(drag_axis, angle) * rotation
			else: rotation = rotation * Quaternion((drag_world.basis.orthonormalized().inverse() * drag_axis).normalized(), angle)
		else:
			var amount := (point - drag_start).dot(drag_screen_axis.normalized()) / drag_pixels * drag_units
			if snap.button_pressed: amount = snappedf(amount, 0.1)
			var delta := drag_axis * amount
			if selected != "@root":
				var rig = app.renderer.model
				var parent: String = rig.parent_id(selected)
				var parent_basis: Basis = rig.bones[selected].skeleton.global_basis if parent == "@root" else rig.bone_transform(parent).basis
				delta = parent_basis.inverse() * delta
			position += delta
		set_delta(position, rotation.normalized())
		apply_frame()
		refresh_values()

func finish_drag(cancel := false) -> void:
	if not dragging: return
	dragging = false
	if cancel: restore_state(drag_before, false)
	else: commit(drag_before)
