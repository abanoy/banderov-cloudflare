extends RefCounted

static func box(root: Node3D, label: String, position: Vector3, size: Vector3, color: Color) -> void:
	var mesh := MeshInstance3D.new()
	mesh.name = label
	var shape := BoxMesh.new()
	shape.size = size
	mesh.mesh = shape
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.85
	mesh.material_override = material
	root.add_child(mesh)
	mesh.position = position
	mesh.owner = root

static func make_fixture(path: String) -> Error:
	var root := Node3D.new()
	root.name = "OriginalStudioRoom"
	box(root, "Floor", Vector3(0, -0.15, -2), Vector3(12, 0.3, 14), Color("414b59"))
	box(root, "Back", Vector3(0, 2, -8), Vector3(12, 4, 0.25), Color("c3aa8c"))
	box(root, "Left", Vector3(-6, 2, -2), Vector3(0.25, 4, 12), Color("778c99"))
	box(root, "Stage", Vector3(0, 0.2, -4), Vector3(4, 0.4, 3), Color("ac7955"))
	box(root, "Bench", Vector3(2.8, 0.6, -1.2), Vector3(2.6, 1.2, 1), Color("487f86"))
	for i in range(5):
		box(root, "WallPanel%d" % i, Vector3(-4.0 + i * 2.0, 2.4, -7.8), Vector3(0.6, 2.5, 0.2), Color("ece0c8"))
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var error := document.append_from_scene(root, state)
	if error == OK:
		error = document.write_to_filesystem(state, path)
	root.free()
	return error

static func load_glb(path: String) -> Dictionary:
	if path.get_extension().to_lower() != "glb":
		return {"error": "This slice imports self-contained .glb files; convert .gltf sidecars first."}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 128 * 1024 * 1024:
		return {"error": "Cannot read GLB or file exceeds prototype limit of 128 MiB."}
	var bytes := file.get_buffer(file.get_length())
	if bytes.size() < 20 or bytes.slice(0, 4).get_string_from_ascii() != "glTF":
		return {"error": "Not a valid binary glTF file."}
	if bytes.decode_u32(4) != 2 or bytes.decode_u32(8) != bytes.size() or bytes.decode_u32(16) != 0x4e4f534a:
		return {"error": "Invalid GLB version, length, or JSON chunk."}
	# Only self-contained GLBs. Prevent external resource traversal/network references.
	var json_size := bytes.decode_u32(12)
	if json_size > bytes.size() - 20:
		return {"error": "Broken GLB JSON chunk."}
	var parser := JSON.new()
	if parser.parse(bytes.slice(20, 20 + json_size).get_string_from_utf8()) != OK:
		return {"error": "Invalid GLB JSON."}
	var data = parser.data
	if not data is Dictionary:
		return {"error": "Invalid GLB JSON."}
	for group in [data.get("buffers", []), data.get("images", [])]:
		if not group is Array:
			return {"error": "Invalid GLB resource list."}
		for item in group:
			if not item is Dictionary or item.has("uri") and not item.uri is String:
				return {"error": "Invalid GLB resource entry."}
			if item.has("uri") and not str(item.uri).begins_with("data:"):
				return {"error": "External GLB resources unsupported. Embed textures and buffers when exporting."}
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	var error := doc.append_from_buffer(bytes, "", state)
	if error != OK:
		return {"error": "GLB importer failed: %s" % error_string(error)}
	var scene := doc.generate_scene(state)
	if scene == null:
		return {"error": "GLB contains no usable scene."}
	return {"scene": scene, "warning": "Static environment only; embedded animation is not played. Unsupported material extensions may render differently."}

static func make_pose_fixture(path: String) -> Error:
	var root := Node3D.new()
	root.name = "OriginalPoseFixture"
	var skeleton := Skeleton3D.new()
	skeleton.name = "Rig"
	root.add_child(skeleton)
	skeleton.owner = root
	skeleton.add_bone("hip")
	skeleton.add_bone("arm")
	skeleton.set_bone_parent(1, 0)
	skeleton.set_bone_rest(0, Transform3D.IDENTITY)
	skeleton.set_bone_rest(1, Transform3D(Basis.IDENTITY, Vector3(0, 1, 0)))
	skeleton.reset_bone_poses()
	for bone in range(2):
		var shape := BoxMesh.new()
		shape.size = Vector3(0.4, 1, 0.4) if bone == 0 else Vector3(1.5, 0.25, 0.25)
		var arrays := shape.surface_get_arrays(0)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		for i in range(vertices.size()): vertices[i] += Vector3(0, 0.5, 0) if bone == 0 else Vector3(0.75, 1, 0)
		arrays[Mesh.ARRAY_VERTEX] = vertices
		var bones := PackedInt32Array()
		var weights := PackedFloat32Array()
		bones.resize(vertices.size() * 4); weights.resize(vertices.size() * 4)
		for i in range(vertices.size()): bones[i * 4] = bone; weights[i * 4] = 1
		arrays[Mesh.ARRAY_BONES] = bones
		arrays[Mesh.ARRAY_WEIGHTS] = weights
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var instance := MeshInstance3D.new()
		instance.name = "Body" if bone == 0 else "Arm"
		instance.mesh = mesh
		root.add_child(instance)
		instance.owner = root
		instance.skeleton = instance.get_path_to(skeleton)
		instance.skin = skeleton.create_skin_from_rest_transforms()
		var material := StandardMaterial3D.new()
		material.albedo_color = Color("79c6bd") if bone == 0 else Color("eab26f")
		instance.material_override = material
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var error := document.append_from_scene(root, state)
	if error == OK: error = document.write_to_filesystem(state, path)
	root.free()
	return error
