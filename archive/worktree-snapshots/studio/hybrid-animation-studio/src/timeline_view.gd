extends Control
signal seek(frame: int)
var keys: Array = []
var layers: Array = []
var duration := 48
var frame := 0
var dragging := false
var audio_clip := {}
var waveform := PackedFloat32Array()
var pose_keys: Array = []
var has_model := false
var cel_style := preload("res://src/studio_theme.gd").surface("e2f3ff", "91bedd", "729bb8", 0)
const LEFT := 95.0

func x(f: int) -> float:
	return LEFT + float(f) / duration * maxf(1, size.x - LEFT - 16)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("f5f8fb"))
	for f in range(0, duration + 1, maxi(1, duration / 12)):
		draw_line(Vector2(x(f), 18), Vector2(x(f), size.y), Color("d3dce5"))
		draw_string(ThemeDB.fallback_font, Vector2(x(f) + 3, 15), str(f), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("425a70"))
	draw_string(ThemeDB.fallback_font, Vector2(8, 43), "Camera", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("283c51"))
	for key in keys:
		var p := Vector2(x(key.frame), 38)
		draw_colored_polygon(PackedVector2Array([p + Vector2(0, -6), p + Vector2(6, 0), p + Vector2(0, 6), p + Vector2(-6, 0)]), Color("ce922e"))
	var shift := 24 if has_model else 0
	if has_model:
		draw_string(ThemeDB.fallback_font, Vector2(8, 68), "Model pose", HORIZONTAL_ALIGNMENT_LEFT, 85, 13, Color("283c51"))
		for key in pose_keys:
			var p := Vector2(x(key.frame), 63)
			draw_colored_polygon(PackedVector2Array([p + Vector2(0, -5), p + Vector2(5, 0), p + Vector2(0, 5), p + Vector2(-5, 0)]), Color("8b66bf"))
	for i in range(layers.size()):
		var y := 55.0 + shift + i * 30
		draw_string(ThemeDB.fallback_font, Vector2(8, y + 18), layers[i].name, HORIZONTAL_ALIGNMENT_LEFT, 80, 14, Color("283c51"))
		for cel in layers[i].cels:
			var rect := Rect2(x(cel.start) + 1, y, maxf(2, x(cel.start + cel.duration) - x(cel.start) - 2), 23)
			if layers[i].visible: cel_style.draw(get_canvas_item(), rect)
			else: draw_rect(rect, Color("c5cbd1"))
			draw_string(ThemeDB.fallback_font, rect.position + Vector2(4, 16), "%d–%d" % [cel.start, cel.start + cel.duration - 1], HORIZONTAL_ALIGNMENT_LEFT, rect.size.x - 4, 12, Color("1e4159"))
	var audio_y := 57.0 + shift + layers.size() * 30
	draw_string(ThemeDB.fallback_font, Vector2(8, audio_y + 18), "Audio", HORIZONTAL_ALIGNMENT_LEFT, 80, 14, Color("283c51"))
	if not audio_clip.is_empty():
		var source: Dictionary = audio_clip.source
		var seconds: float = float(source.frames - audio_clip.source_in_sample) / source.rate
		var end_frame := mini(duration, audio_clip.start_frame + ceili(seconds * audio_clip.get("fps", 24.0)))
		draw_rect(Rect2(x(audio_clip.start_frame), audio_y, x(end_frame) - x(audio_clip.start_frame), 29), Color("c6d0d5") if audio_clip.muted else Color("e1edd5"))
		for i in range(waveform.size()):
			var xx := LEFT + float(i) / waveform.size() * maxf(1, size.x - LEFT - 16)
			var amplitude := waveform[i] * 11
			draw_line(Vector2(xx, audio_y + 14 - amplitude), Vector2(xx, audio_y + 14 + amplitude), Color("467d45"))
		draw_string(ThemeDB.fallback_font, Vector2(x(audio_clip.start_frame) + 4, audio_y + 11), source.name.left(24) + (" [mute]" if audio_clip.muted else ""), HORIZONTAL_ALIGNMENT_LEFT, size.x - x(audio_clip.start_frame) - 20, 11, Color("315835"))
	draw_line(Vector2(x(frame), 0), Vector2(x(frame), size.y), Color("bf613c"), 2)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		dragging = event.pressed
	if event is InputEventMouse and (dragging or event is InputEventMouseButton and event.pressed):
		seek.emit(clampi(roundi((event.position.x - LEFT) / maxf(1, size.x - LEFT - 16) * duration), 0, duration))
