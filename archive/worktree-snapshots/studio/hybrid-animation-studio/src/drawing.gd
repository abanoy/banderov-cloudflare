extends RefCounted

static func blank(width: int, height: int) -> Image:
	var image := Image.create(width, height, false, Image.FORMAT_RGBA8)
	image.fill(Color.TRANSPARENT)
	return image

static func cel_at(layer: Dictionary, frame: int) -> Dictionary:
	for cel in layer.cels:
		if frame >= cel.start and frame < cel.start + cel.duration:
			return cel
	return {}

static func insert(layer: Dictionary, frame: int, end: int, image: Image) -> Dictionary:
	# Split the active exposure; later cels retain their original boundaries.
	var next := end
	for cel in layer.cels:
		if cel.start == frame:
			cel.image = image
			return cel
		if cel.start < frame and cel.start + cel.duration > frame:
			next = mini(next, cel.start + cel.duration)
			cel.duration = frame - cel.start
		if cel.start > frame:
			next = mini(next, cel.start)
	var cel := {"id": str(ResourceUID.create_id()), "start": frame, "duration": maxi(1, next - frame), "image": image}
	layer.cels.append(cel)
	layer.cels.sort_custom(func(a, b): return a.start < b.start)
	return cel

static func stroke(image: Image, from: Vector2, to: Vector2, radius: float, color: Color, erase: bool) -> Rect2i:
	var rect := Rect2i(Vector2i((from.min(to) - Vector2.ONE * (radius + 1)).floor()), Vector2i((from.max(to) - from.min(to) + Vector2.ONE * (radius * 2 + 3)).ceil()))
	rect = rect.intersection(Rect2i(0, 0, image.get_width(), image.get_height()))
	# Distance-to-segment brush: no gaps even with sparse mouse events.
	var delta := to - from
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			var p := Vector2(x + 0.5, y + 0.5)
			var u := 0.0 if delta.length_squared() == 0 else clampf((p - from).dot(delta) / delta.length_squared(), 0, 1)
			var coverage := clampf(radius + 0.5 - p.distance_to(from + delta * u), 0, 1)
			if coverage == 0:
				continue
			var old := image.get_pixel(x, y)
			if erase:
				old.a *= 1.0 - coverage
				image.set_pixel(x, y, old)
			else:
				var paint := color
				paint.a *= coverage
				image.set_pixel(x, y, old.blend(paint))
	return rect

static func composite(layers: Array, frame: int, width: int, height: int) -> Image:
	var result := blank(width, height)
	for layer in layers:
		if not layer.visible:
			continue
		var cel := cel_at(layer, frame)
		if not cel.is_empty():
			result.blend_rect(cel.image, Rect2i(0, 0, width, height), Vector2i.ZERO)
	return result
