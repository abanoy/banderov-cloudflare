extends RefCounted
const Storage = preload("res://src/storage.gd")
const MAX_BYTES := 512 * 1024 * 1024

static func read_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 1024 * 1024: return {}
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK: return {}
	var parsed = parser.data
	return parsed if parsed is Dictionary else {}

static func write_json(path: String, data: Dictionary) -> String:
	var file := FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null: return "Cannot write recovery state."
	file.store_string(JSON.stringify(data))
	file.flush()
	var error := file.get_error()
	file.close()
	if error != OK: return "Cannot flush recovery state."
	return "" if DirAccess.rename_absolute(path + ".tmp", path) == OK else "Cannot commit recovery state."

static func bytes_in(folder: String, depth := 0) -> int:
	if not DirAccess.dir_exists_absolute(folder): return 0
	if depth > 4: return MAX_BYTES
	var size := 0
	for name in DirAccess.get_files_at(folder):
		var file := FileAccess.open(folder.path_join(name), FileAccess.READ)
		if file: size += file.get_length()
		if size >= MAX_BYTES: return size
	for name in DirAccess.get_directories_at(folder):
		size += bytes_in(folder.path_join(name), depth + 1)
		if size >= MAX_BYTES: break
	return size

static func checkpoint(root: String, session: String, video: Dictionary, keys: Array, layers: Array, source: String, frame: int, audio: Dictionary, origin: String, revision: int, model: Dictionary = {}) -> String:
	# Conservative global budget: reserve full uncompressed cels and input assets.
	var estimate := 1024 * 1024
	for layer in layers:
		for cel in layer.cels: estimate += cel.image.get_data_size()
	for path in [source, audio.source.path if not audio.is_empty() else "", model.source if not model.is_empty() else ""]:
		if not path.is_empty():
			var file := FileAccess.open(path, FileAccess.READ)
			if file: estimate += file.get_length()
	if bytes_in(root) + estimate > MAX_BYTES:
		return "Recovery cache budget reached (512 MiB). Save manually; review output/recovery before removing old copies."
	var folder := root.path_join(session)
	if DirAccess.make_dir_recursive_absolute(folder) != OK: return "Cannot create recovery directory."
	var error := write_json(folder.path_join("session.json"), {"pid": OS.get_process_id()})
	if not error.is_empty(): return error
	return Storage.save_project(folder, video, keys, layers, source, frame, audio,
		{"origin": origin, "revision": revision, "saved_at": Time.get_unix_time_from_system()}, model)

static func resolve(folder: String) -> String:
	var primary := folder.path_join("project.json")
	if not FileAccess.file_exists(primary) and not FileAccess.file_exists(folder.path_join("project.backup.json")): return ""
	return write_json(folder.path_join("resolved.json"), {"sha256": FileAccess.get_sha256(primary) if FileAccess.file_exists(primary) else "missing"})

static func candidates(root: String, exclude := "", include_current := false) -> Array:
	var found: Array = []
	if not DirAccess.dir_exists_absolute(root): return found
	for session in DirAccess.get_directories_at(root):
		if session == exclude: continue
		var folder := root.path_join(session)
		var owner := read_json(folder.path_join("session.json"))
		if Storage.integer(owner.get("pid"), 1, 2147483647) and OS.is_process_running(int(owner.pid)):
			if not include_current or int(owner.pid) != OS.get_process_id(): continue
		var primary := folder.path_join("project.json")
		var resolved := read_json(folder.path_join("resolved.json"))
		var fingerprint := FileAccess.get_sha256(primary) if FileAccess.file_exists(primary) else "missing"
		if resolved.get("sha256", "none") == fingerprint: continue
		for manifest in ["project.json", "project.backup.json"]:
			var data := read_json(folder.path_join(manifest))
			var editor = data.get("editor", {})
			var info = editor.get("recovery", {}) if editor is Dictionary else {}
			if info is Dictionary and info.get("origin") is String and Storage.integer(info.get("revision"), 0, 2147483647) and (info.get("saved_at") is float or info.get("saved_at") is int):
				found.append({"folder": folder, "manifest": manifest, "origin": info.origin, "saved_at": info.saved_at})
				# Keep both generations available; full asset validation occurs on restore.
	found.sort_custom(func(a, b): return a.saved_at > b.saved_at)
	return found
