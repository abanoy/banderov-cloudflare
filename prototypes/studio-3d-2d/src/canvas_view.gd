extends Control
signal pointer(event: InputEvent, point: Vector2)
var background: Texture2D
var overlay: Texture2D
var zoom := 1.0
var pan := Vector2.ZERO
var panning := false
var scene_navigation := false
var pose_lines: Array = []
var pose_joints: Array = []
const RESOLUTION := Vector2(1920, 1080)

func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL
	resized.connect(queue_redraw)

func image_rect() -> Rect2:
	var scale_factor := minf(size.x / RESOLUTION.x, size.y / RESOLUTION.y) * zoom
	var extent := RESOLUTION * scale_factor
	return Rect2((size - extent) / 2 + pan, extent)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("7e8f9e"))
	var rect := image_rect()
	if background:
		draw_texture_rect(background, rect, false)
	if overlay:
		draw_texture_rect(overlay, rect, false)
	for line in pose_lines:
		draw_line(rect.position + line.a / RESOLUTION * rect.size, rect.position + line.b / RESOLUTION * rect.size, line.color, 2, true)
	for joint in pose_joints:
		draw_circle(rect.position + joint.point / RESOLUTION * rect.size, 4 if joint.selected else 2, Color("ffe086") if joint.selected else Color("a0e5f5"))
	draw_rect(rect, Color("dce8f2"), false, 1)

func _gui_input(event: InputEvent) -> void:
	if scene_navigation:
		if event is InputEventMouseButton and event.pressed: grab_focus()
		if event is InputEventMouse: pointer.emit(event, Vector2.ZERO)
		return
	if event is InputEventMouseButton:
		grab_focus()
		if event.button_index == MOUSE_BUTTON_MIDDLE:
			panning = event.pressed
			return
		if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			zoom = clampf(zoom * (1.15 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.15), 0.25, 4)
			queue_redraw()
			return
	if event is InputEventMouseMotion and panning:
		pan += event.relative
		queue_redraw()
		return
	if event is InputEventMouse:
		var rect := image_rect()
		var point: Vector2 = (event.position - rect.position) / rect.size * RESOLUTION
		pointer.emit(event, point)
