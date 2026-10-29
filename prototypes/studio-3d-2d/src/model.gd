extends RefCounted
# One source-independent model contract. Native adapters supply GLB + metadata;
# instances and poses never edit that GLB or require PMD/Source-specific UI code.
const Timeline = preload("res://src/timeline.gd")
var root: Node3D
var base_root := Transform3D.IDENTITY
var data := {}
var bones := {}
var order: Array[String] = []

static func identity() -> Dictionary:
	return {"position": [0, 0, 0], "rotation_xyzw": [0, 0, 0, 1]}

static func definition(path: String) -> Dictionary:
	return {"format": "studio_model_1", "id": str(ResourceUID.create_id()), "name": path.get_file(), "source": path, "sha256": FileAccess.get_sha256(path), "position": [0, 0, 0], "rotation_xyzw": [0, 0, 0, 1], "scale": 1.0, "visible": true, "reference_only": false, "pose": {}, "draft_frame": 0, "pose_keys": [], "metadata": {}}

static func numbers(value, count: int) -> bool:
	if not value is Array or value.size() != count: return false
	for v in value:
		if not (v is int or v is float) or not is_finite(float(v)) or absf(float(v)) > 100000: return false
	return true

static func transform_valid(value) -> bool:
	if not value is Dictionary or not numbers(value.get("position"), 3) or not numbers(value.get("rotation_xyzw"), 4): return false
	var q: Array = value.rotation_xyzw
	return Vector4(q[0], q[1], q[2], q[3]).length() > 0.001

static func pose_valid(value) -> bool:
	if not value is Dictionary or value.size() > 512: return false
	for key in value:
		if not key is String or key.length() > 512 or not transform_valid(value[key]): return false
	return true

static func scale_valid(value) -> bool:
	return (value is float or value is int) and is_finite(float(value)) and value >= 0.001 and value <= 10000

static func validate(value, duration: int) -> String:
	if not value is Dictionary: return "Invalid model record."
	if value.is_empty(): return ""
	if value.get("format") != "studio_model_1" or not value.get("id") is String or not value.get("name") is String or not value.get("sha256") is String or not value.get("visible") is bool or not value.get("reference_only") is bool or not transform_valid(value): return "Invalid standard model identity/transform."
	if not scale_valid(value.get("scale")): return "Invalid model scale."
	if not pose_valid(value.get("pose")) or not value.get("metadata") is Dictionary or not value.get("pose_keys") is Array or value.pose_keys.size() > 241: return "Invalid model pose data."
	if not (value.get("draft_frame") is int or value.get("draft_frame") is float) or value.draft_frame != floor(value.draft_frame) or value.draft_frame < 0 or value.draft_frame > duration: return "Invalid pose draft frame."
	var last := -1
	for key in value.pose_keys:
		if not key is Dictionary or not (key.get("frame") is int or key.get("frame") is float) or key.frame != floor(key.frame) or key.frame <= last or key.frame < 0 or key.frame > duration or not key.get("interpolation") in ["hold", "linear", "ease"] or not pose_valid(key.get("pose")): return "Invalid or unsorted model pose keys."
		if not transform_valid(key.get("transform")) or not scale_valid(key.transform.get("scale")): return "Invalid model root pose key."
		last = int(key.frame)
	return ""

func inventory(node: Node) -> void:
	if node is Skeleton3D:
		for i in range(node.get_bone_count()):
			var id := str(root.get_path_to(node)) + "::" + str(node.get_bone_name(i))
			bones[id] = {"skeleton": node, "index": i, "name": str(node.get_bone_name(i)), "base": node.get_bone_pose(i), "path": str(root.get_path_to(node))}
			order.append(id)
	for child in node.get_children(): inventory(child)

func check_bindings() -> String:
	if order.size() > 512: return "Model exceeds prototype limit of 512 bones."
	var poses: Array = [data.pose]
	for key in data.pose_keys: poses.append(key.pose)
	for pose in poses:
		for id in pose:
			if not bones.has(id): return "Stored pose refers to a missing bone: " + id
	return ""

static func blend(a: Dictionary, b: Dictionary, t: float) -> Dictionary:
	var result := {}
	var ids := a.keys()
	for id in b:
		if not id in ids: ids.append(id)
	for id in ids:
		var aa: Dictionary = a.get(id, identity())
		var bb: Dictionary = b.get(id, identity())
		var p := Timeline.vector(aa.position).lerp(Timeline.vector(bb.position), t)
		var q := Timeline.quaternion(aa.rotation_xyzw).slerp(Timeline.quaternion(bb.rotation_xyzw), t)
		result[id] = {"position": [p.x, p.y, p.z], "rotation_xyzw": [q.x, q.y, q.z, q.w]}
	return result

func sample(frame: int, editing := false) -> Dictionary:
	if data.pose_keys.is_empty() or editing and data.draft_frame == frame: return data.pose.duplicate(true)
	var pair := key_pair(frame)
	return blend(pair.a.pose, pair.b.pose, pair.t)

func key_pair(frame: int) -> Dictionary:
	var a: Dictionary = data.pose_keys[0]
	var b: Dictionary = data.pose_keys[-1]
	if frame <= a.frame: b = a
	elif frame >= b.frame: a = b
	else:
		for i in range(data.pose_keys.size() - 1):
			if frame >= data.pose_keys[i].frame and frame < data.pose_keys[i + 1].frame:
				a = data.pose_keys[i]; b = data.pose_keys[i + 1]; break
	var t: float = 0 if a.frame == b.frame else float(frame - a.frame) / (b.frame - a.frame)
	if a.interpolation == "hold": t = 0
	elif a.interpolation == "ease": t = t * t * (3 - 2 * t)
	return {"a": a, "b": b, "t": t}

func sample_transform(frame: int, editing := false) -> Dictionary:
	if data.pose_keys.is_empty() or editing and data.draft_frame == frame:
		return {"position": data.position.duplicate(), "rotation_xyzw": data.rotation_xyzw.duplicate(), "scale": data.scale}
	var pair := key_pair(frame)
	var a: Dictionary = pair.a.transform
	var b: Dictionary = pair.b.transform
	var result: Dictionary = blend({"root": a}, {"root": b}, pair.t).root
	result["scale"] = lerpf(a.scale, b.scale, pair.t)
	return result

func apply(frame: int, editing := false, final := false) -> void:
	var transform := sample_transform(frame, editing)
	root.transform = Transform3D(Basis(Timeline.quaternion(transform.rotation_xyzw)).scaled(Vector3.ONE * transform.scale), Timeline.vector(transform.position)) * base_root
	root.visible = data.visible and not (final and data.reference_only)
	var pose := sample(frame, editing)
	for id in order:
		var info: Dictionary = bones[id]
		var base: Transform3D = info.base
		var delta: Dictionary = pose.get(id, identity())
		info.skeleton.set_bone_pose_position(info.index, base.origin + Timeline.vector(delta.position))
		info.skeleton.set_bone_pose_rotation(info.index, base.basis.get_rotation_quaternion() * Timeline.quaternion(delta.rotation_xyzw))
		info.skeleton.set_bone_pose_scale(info.index, base.basis.get_scale())
	var updated := []
	for id in order:
		var skeleton: Skeleton3D = bones[id].skeleton
		if not skeleton in updated:
			skeleton.force_update_all_bone_transforms()
			updated.append(skeleton)

func bone_transform(id: String) -> Transform3D:
	if id == "@root": return root.global_transform
	var info: Dictionary = bones[id]
	return info.skeleton.global_transform * info.skeleton.get_bone_global_pose(info.index)

func parent_id(id: String) -> String:
	var info: Dictionary = bones[id]
	var parent: int = info.skeleton.get_bone_parent(info.index)
	return "@root" if parent < 0 else info.path + "::" + str(info.skeleton.get_bone_name(parent))
