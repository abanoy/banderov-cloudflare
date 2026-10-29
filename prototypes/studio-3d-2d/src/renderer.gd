extends Node
const SceneIO = preload("res://src/scene3d.gd")
const Timeline = preload("res://src/timeline.gd")
const Drawing = preload("res://src/drawing.gd")
const Model = preload("res://src/model.gd")
var viewport: SubViewport
var world: Node3D
var camera: Camera3D
var environment_scene: Node3D
var model: RefCounted

func setup(width := 1920, height := 1080) -> void:
	viewport = SubViewport.new()
	viewport.size = Vector2i(width, height)
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	world = Node3D.new()
	viewport.add_child(world)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color("263646")
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color("d2e2f2")
	env.environment.ambient_light_energy = 0.7
	world.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40, -30, 0)
	light.light_energy = 1.2
	world.add_child(light)
	camera = Camera3D.new()
	camera.far = 2000
	world.add_child(camera)
	camera.current = true

func import_scene(path: String) -> String:
	var result := SceneIO.load_glb(path)
	if result.has("error"):
		return result.error
	if environment_scene != null:
		world.remove_child(environment_scene)
		environment_scene.queue_free()
	environment_scene = result.scene
	world.add_child(environment_scene)
	# Imported cameras must not take over the independently animated shot.
	disable_cameras(environment_scene)
	camera.current = true
	return ""

func disable_cameras(node: Node) -> void:
	if node is Camera3D:
		node.current = false
	if node is AnimationPlayer: node.stop()
	for child in node.get_children():
		disable_cameras(child)

func evaluate(keys: Array, frame: int) -> void:
	var value := Timeline.sample(keys, frame)
	camera.position = value.position
	camera.quaternion = value.rotation
	camera.fov = value.fov
	if model: model.apply(frame)

func prepare_model(data: Dictionary) -> Dictionary:
	if data.is_empty(): return {"model": null}
	var result := SceneIO.load_glb(data.source)
	if result.has("error"): return result
	var candidate := Model.new()
	candidate.root = result.scene
	candidate.base_root = candidate.root.transform
	candidate.data = data
	candidate.inventory(candidate.root)
	var error := candidate.check_bindings()
	if not error.is_empty():
		candidate.root.free()
		return {"error": error}
	return {"model": candidate}

func install_model(prepared: Dictionary) -> void:
	if model:
		world.remove_child(model.root)
		model.root.queue_free()
	model = prepared.model
	if model:
		world.add_child(model.root)
		disable_cameras(model.root)
		model.apply(0)
	camera.current = true

func model_state() -> Dictionary:
	return model.data if model else {}

func scene_bounds(node: Node = environment_scene) -> AABB:
	var bounds := AABB()
	if node == null: return bounds
	if node is MeshInstance3D and node.mesh:
		bounds = node.global_transform * node.get_aabb()
	for child in node.get_children():
		var child_bounds := scene_bounds(child)
		if child_bounds.size.length_squared() > 0:
			bounds = child_bounds if bounds.size.length_squared() == 0 else bounds.merge(child_bounds)
	return bounds

func frame_scene(node: Node = environment_scene) -> bool:
	var bounds := scene_bounds(node)
	if bounds.size.length_squared() == 0: return false
	var distance := bounds.size.length() * 0.5 / sin(deg_to_rad(camera.fov * 0.5)) * 1.15
	camera.position = bounds.get_center() + Vector3(0.35, 0.2, 1).normalized() * distance
	camera.look_at(bounds.get_center(), Vector3.UP)
	camera.far = maxf(2000, distance * 4)
	return true

func capture(keys: Array, layers: Array, frame: int, final := false) -> Image:
	evaluate(keys, frame)
	if model: model.apply(frame, false, final)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	await RenderingServer.frame_post_draw
	var image := viewport.get_texture().get_image()
	image.convert(Image.FORMAT_RGBA8)
	var overlay := Drawing.composite(layers, frame, image.get_width(), image.get_height())
	image.blend_rect(overlay, Rect2i(Vector2i.ZERO, viewport.size), Vector2i.ZERO)
	return image
