extends RefCounted
const Drawing = preload("res://src/drawing.gd")
const AudioTrack = preload("res://src/audio_track.gd")
const Model = preload("res://src/model.gd")

static func safe_relative(path: String) -> bool:
	if path.is_empty() or path.is_absolute_path() or path.contains(":") or path.contains("\\"):
		return false
	for part in path.split("/"):
		if part in ["..", ".", ""]:
			return false
	return true

static func image_hash(image: Image) -> String:
	var hash := HashingContext.new()
	hash.start(HashingContext.HASH_SHA256)
	hash.update(image.get_data())
	return hash.finish().hex_encode()

static func managed_copy(source: String, target: String, expected: String) -> String:
	if FileAccess.file_exists(target) and FileAccess.get_sha256(target) == expected: return ""
	var temp := target + ".import.tmp"
	if DirAccess.copy_absolute(source, temp) != OK or FileAccess.get_sha256(temp) != expected:
		return "Cannot copy/verify managed asset; previous manifest preserved."
	if DirAccess.rename_absolute(temp, target) != OK: return "Cannot commit managed asset; previous manifest preserved."
	return ""

static func readable_manifest(path: String) -> bool:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 1024 * 1024: return false
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK or not parser.data is Dictionary: return false
	return integer(parser.data.get("schema_version"), 1, 3) and parser.data.get("layers") is Array and parser.data.get("camera_keys") is Array

static func save_project(folder: String, video: Dictionary, keys: Array, layers: Array, source: String, frame: int, audio: Dictionary = {}, recovery: Dictionary = {}, model: Dictionary = {}) -> String:
	if not FileAccess.file_exists(source):
		return "Scene source is missing; save aborted."
	var revision := "%d_%d" % [Time.get_unix_time_from_system() * 1000, Time.get_ticks_usec()]
	var cel_dir := "cels/" + revision
	if not recovery.is_empty(): cel_dir = "cels/content"
	for sub in ["assets", cel_dir]:
		var error := DirAccess.make_dir_recursive_absolute(folder.path_join(sub))
		if error != OK:
			return "Cannot create project directory: " + error_string(error)
	var hash := FileAccess.get_sha256(source)
	var asset := "assets/" + hash + ".glb"
	var scene_error := managed_copy(source, folder.path_join(asset), hash)
	if not scene_error.is_empty(): return scene_error
	var tracks := []
	for layer in layers:
		var track := {"id": layer.id, "name": layer.name, "visible": layer.visible, "cels": []}
		for cel in layer.cels:
			var path := cel_dir.path_join(str(cel.id) + ".png")
			var pixels := ""
			if not recovery.is_empty():
				pixels = image_hash(cel.image)
				path = cel_dir.path_join(pixels + ".png")
			var reuse := false
			if not pixels.is_empty() and FileAccess.file_exists(folder.path_join(path)):
				var existing := FileAccess.open(folder.path_join(path), FileAccess.READ)
				if existing != null and existing.get_length() <= 32 * 1024 * 1024 and existing.get_buffer(8) == PackedByteArray([137, 80, 78, 71, 13, 10, 26, 10]):
					var cached := Image.load_from_file(folder.path_join(path))
					if cached != null:
						cached.convert(Image.FORMAT_RGBA8)
						reuse = image_hash(cached) == pixels
				if existing: existing.close()
			if not reuse:
				var temporary := folder.path_join(path) + ".tmp.png"
				if cel.image.save_png(temporary) != OK or DirAccess.rename_absolute(temporary, folder.path_join(path)) != OK:
					return "Cannot commit cel PNG; previous project manifest preserved."
			var entry := {"id": cel.id, "start": cel.start, "duration": cel.duration, "path": path}
			if not pixels.is_empty(): entry["pixel_sha256"] = pixels
			track.cels.append(entry)
		tracks.append(track)
	var saved_audio := {}
	if not audio.is_empty():
		if FileAccess.get_sha256(audio.source.path) != audio.source.sha256:
			return "Audio source changed or disappeared. Re-import it before saving; previous manifest preserved."
		var audio_asset: String = "assets/" + audio.source.sha256 + ".wav"
		var audio_error := managed_copy(audio.source.path, folder.path_join(audio_asset), audio.source.sha256)
		if not audio_error.is_empty(): return audio_error
		saved_audio = {"id": audio.id, "path": audio_asset, "sha256": audio.source.sha256, "source_name": audio.source.name, "start_frame": audio.start_frame, "source_in_sample": audio.source_in_sample, "gain_db": audio.gain_db, "muted": audio.muted}
	var saved_model := model.duplicate(true)
	if not model.is_empty():
		var model_error := Model.validate(model, video.duration_frames)
		if not model_error.is_empty(): return model_error
		if not model.get("source") is String or FileAccess.get_sha256(model.source) != model.sha256: return "Model source changed or disappeared. Re-import before saving."
		var model_asset: String = "assets/" + model.sha256 + ".glb"
		model_error = managed_copy(model.source, folder.path_join(model_asset), model.sha256)
		if not model_error.is_empty(): return model_error
		saved_model.erase("source")
		saved_model["path"] = model_asset
	var manifest := {"schema_version": 3, "model": saved_model, "video": video, "camera_keys": keys, "layers": tracks, "audio": saved_audio, "scene": {"path": asset, "sha256": hash, "source_name": source.get_file(), "provenance": "unknown / must verify"}, "editor": {"frame": frame}}
	if not recovery.is_empty(): manifest.editor["recovery"] = recovery
	var serialized := JSON.stringify(manifest, "\t")
	if serialized.to_utf8_buffer().size() > 1024 * 1024: return "Project metadata exceeds 1 MiB. Reduce pose keys/metadata; previous manifest preserved."
	var temp := folder.path_join("project.json.tmp")
	var file := FileAccess.open(temp, FileAccess.WRITE)
	if file == null:
		return "Cannot write manifest; previous save preserved."
	file.store_string(serialized)
	file.flush()
	var write_error := file.get_error()
	file.close()
	if write_error != OK:
		return "Manifest write failed. Previous save preserved."
	var target := folder.path_join("project.json")
	if FileAccess.file_exists(target) and readable_manifest(target):
		if DirAccess.copy_absolute(target, folder.path_join("project.backup.json")) != OK:
			return "Cannot back up previous manifest; replacement aborted."
	var error := DirAccess.rename_absolute(temp, target)
	return "" if error == OK else "Cannot replace manifest: " + error_string(error)

static func numeric_array(value, length: int) -> bool:
	if not value is Array or value.size() != length:
		return false
	for v in value:
		if not (v is int or v is float) or not is_finite(float(v)):
			return false
	return true

static func integer(value, minimum: int, maximum: int) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) == floor(float(value)) and value >= minimum and value <= maximum

static func load_project(folder: String, manifest_name := "project.json") -> Dictionary:
	if manifest_name not in ["project.json", "project.backup.json"]: return {"error": "Unsupported manifest name."}
	var manifest_path := folder.path_join(manifest_name)
	if not FileAccess.file_exists(manifest_path):
		return {"error": "No project.json in selected directory."}
	var file := FileAccess.open(manifest_path, FileAccess.READ)
	if file == null or file.get_length() > 1024 * 1024:
		return {"error": "Cannot read manifest or it exceeds 1 MiB."}
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK:
		return {"error": "Corrupt JSON manifest: " + parser.get_error_message()}
	var data = parser.data
	if not data is Dictionary or not integer(data.get("schema_version"), 1, 3):
		return {"error": "Invalid manifest or unsupported schema. Previous project stays open."}
	var video = data.get("video")
	if not video is Dictionary:
		return {"error": "Missing video settings."}
	for prop in ["width", "height", "fps_num", "fps_den", "duration_frames"]:
		if not integer(video.get(prop), 1, 1920):
			return {"error": "Invalid video setting: " + prop}
	if video.width != 1920 or video.height != 1080 or video.duration_frames > 240 or video.fps_num > 120 or video.fps_den > 1001:
		return {"error": "Prototype supports 1920x1080, <=240 frames, FPS numerator <=120."}
	var keys = data.get("camera_keys")
	if not keys is Array or keys.is_empty() or keys.size() > 241:
		return {"error": "Missing or excessive camera keys."}
	var previous := -1
	for key in keys:
		if not key is Dictionary or not integer(key.get("frame"), 0, 240) or key.frame <= previous or not numeric_array(key.get("position"), 3) or not numeric_array(key.get("rotation_xyzw"), 4):
			return {"error": "Invalid or unsorted camera key."}
		if not integer(key.get("fov"), 1, 179) and not ((key.get("fov") is float) and key.fov > 1 and key.fov < 179):
			return {"error": "Invalid camera FOV."}
		var q: Array = key.rotation_xyzw
		if Vector4(q[0], q[1], q[2], q[3]).length() < 0.001 or not key.get("interpolation") in ["hold", "linear", "ease"]:
			return {"error": "Invalid camera rotation/interpolation."}
		previous = int(key.frame)
	var scene = data.get("scene")
	if not scene is Dictionary or not scene.get("path") is String or not safe_relative(scene.path):
		return {"error": "Unsafe or missing scene path."}
	var source := folder.path_join(scene.path)
	if not FileAccess.file_exists(source) or FileAccess.get_sha256(source) != scene.get("sha256"):
		return {"error": "Scene missing or checksum differs. Original project preserved."}
	var layers = data.get("layers")
	if not layers is Array or layers.is_empty() or layers.size() > 4:
		return {"error": "Expected 1–4 drawing layers."}
	var count := 0
	for layer in layers:
		if not layer is Dictionary or not layer.get("name") is String or not layer.get("id") is String or not layer.get("visible") is bool or not layer.get("cels") is Array:
			return {"error": "Invalid drawing layer."}
		var end := 0
		for cel in layer.cels:
			count += 1
			if not cel is Dictionary or not cel.get("id") is String or not cel.get("path") is String or not safe_relative(cel.path) or not integer(cel.get("start"), 0, video.duration_frames - 1) or not integer(cel.get("duration"), 1, video.duration_frames):
				return {"error": "Invalid cel or unsafe path."}
			if cel.start < end or cel.start + cel.duration > video.duration_frames or count > 32:
				return {"error": "Overlapping/out-of-range cels or >32 cels (memory limit)."}
			end = int(cel.start + cel.duration)
			var path := folder.path_join(cel.path)
			if not FileAccess.file_exists(path) or FileAccess.get_file_as_bytes(path).size() > 32 * 1024 * 1024:
				return {"error": "Cel missing or exceeds 32 MiB."}
			var image := Image.load_from_file(path)
			if image == null or image.get_width() != video.width or image.get_height() != video.height:
				return {"error": "Cel image has wrong dimensions or is unreadable."}
			image.convert(Image.FORMAT_RGBA8)
			if cel.has("pixel_sha256") and image_hash(image) != cel.pixel_sha256:
				return {"error": "Recovery cel checksum differs. Try its previous checkpoint."}
			cel.image = image
	var audio = data.get("audio", {})
	if not audio is Dictionary:
		return {"error": "Invalid audio clip metadata."}
	if not audio.is_empty():
		if data.schema_version < 2 or not audio.get("id") is String or not audio.get("path") is String or not safe_relative(audio.path) or not audio.get("sha256") is String or not audio.get("muted") is bool:
			return {"error": "Invalid audio identity or unsafe asset path."}
		if not integer(audio.get("start_frame"), 0, video.duration_frames - 1) or not integer(audio.get("source_in_sample"), 0, AudioTrack.MAX_SECONDS * 96000) or not (audio.get("gain_db") is int or audio.get("gain_db") is float) or not is_finite(float(audio.gain_db)) or audio.gain_db < -60 or audio.gain_db > 12:
			return {"error": "Invalid audio timing/gain."}
		var audio_path := folder.path_join(audio.path)
		if not FileAccess.file_exists(audio_path) or FileAccess.get_sha256(audio_path) != audio.sha256:
			return {"error": "Audio asset missing or checksum changed. Open aborted."}
		var decoded := AudioTrack.read_wav(audio_path)
		if decoded.has("error"): return decoded
		if audio.get("source_name") is String: decoded.name = audio.source_name.left(200)
		if audio.source_in_sample >= decoded.frames:
			return {"error": "Audio trim starts past end of source."}
		audio["source"] = decoded
		if AudioTrack.sample_index(video.duration_frames, video) > AudioTrack.RATE * AudioTrack.MAX_SECONDS:
			return {"error": "Audio projects are limited to 60 seconds for this increment."}
	data["audio"] = audio
	var model = data.get("model", {})
	var model_error := Model.validate(model, video.duration_frames)
	if not model_error.is_empty(): return {"error": model_error}
	if not model.is_empty():
		if data.schema_version != 3 or not model.get("path") is String or not safe_relative(model.path): return {"error": "Invalid model asset path/schema."}
		model["source"] = folder.path_join(model.path)
		if not FileAccess.file_exists(model.source) or FileAccess.get_sha256(model.source) != model.sha256: return {"error": "Model asset missing or checksum changed."}
	data["model"] = model
	data["source"] = source
	return data
