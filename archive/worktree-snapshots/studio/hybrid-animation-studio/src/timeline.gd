extends RefCounted

# Godot coordinates: right-handed, +Y up, camera looks down -Z. Quaternion XYZW.
static func key(frame: int, position: Vector3, rotation: Quaternion, fov: float, interpolation := "ease") -> Dictionary:
	return {"frame": frame, "position": [position.x, position.y, position.z], "rotation_xyzw": [rotation.x, rotation.y, rotation.z, rotation.w], "fov": fov, "interpolation": interpolation}

static func vector(a: Array) -> Vector3:
	return Vector3(a[0], a[1], a[2])

static func quaternion(a: Array) -> Quaternion:
	return Quaternion(a[0], a[1], a[2], a[3]).normalized()

static func sample(keys: Array, frame: int) -> Dictionary:
	var a: Dictionary = keys[0]
	var b: Dictionary = keys[-1]
	if frame <= a.frame:
		b = a
	elif frame >= b.frame:
		a = b
	else:
		for i in range(keys.size() - 1):
			if frame >= keys[i].frame and frame < keys[i + 1].frame:
				a = keys[i]
				b = keys[i + 1]
				break
	var t: float = 0.0 if a.frame == b.frame else float(frame - a.frame) / (b.frame - a.frame)
	if a.interpolation == "hold":
		t = 0.0
	elif a.interpolation == "ease":
		t = t * t * (3.0 - 2.0 * t)
	return {"position": vector(a.position).lerp(vector(b.position), t), "rotation": quaternion(a.rotation_xyzw).slerp(quaternion(b.rotation_xyzw), t), "fov": lerpf(a.fov, b.fov, t)}

static func put_key(keys: Array, value: Dictionary) -> void:
	for i in range(keys.size()):
		if keys[i].frame == value.frame:
			keys[i] = value
			return
	keys.append(value)
	keys.sort_custom(func(a, b): return a.frame < b.frame)

static func seconds(frame: int, video: Dictionary) -> float:
	return float(frame) * video.fps_den / video.fps_num
