extends RefCounted
const RATE := 48000
const MAX_SECONDS := 60

static func read_wav(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() < 44 or file.get_length() > 32 * 1024 * 1024:
		return {"error": "WAV missing, too short, or larger than 32 MiB."}
	var bytes := file.get_buffer(file.get_length())
	if bytes.slice(0, 4).get_string_from_ascii() != "RIFF" or bytes.slice(8, 12).get_string_from_ascii() != "WAVE" or bytes.decode_u32(4) + 8 != bytes.size():
		return {"error": "Invalid RIFF/WAVE file or truncated length."}
	var cursor := 12
	var channels := 0
	var rate := 0
	var pcm := PackedByteArray()
	var found_fmt := false
	var found_data := false
	while cursor + 8 <= bytes.size():
		var kind := bytes.slice(cursor, cursor + 4).get_string_from_ascii()
		var length := bytes.decode_u32(cursor + 4)
		cursor += 8
		if length > bytes.size() - cursor:
			return {"error": "Truncated WAV chunk."}
		if kind == "fmt ":
			if found_fmt or length < 16:
				return {"error": "Invalid or duplicate WAV format chunk."}
			found_fmt = true
			channels = bytes.decode_u16(cursor + 2)
			rate = bytes.decode_u32(cursor + 4)
			if bytes.decode_u16(cursor) != 1 or bytes.decode_u16(cursor + 14) != 16 or not channels in [1, 2] or rate < 8000 or rate > 96000 or bytes.decode_u16(cursor + 12) != channels * 2 or bytes.decode_u32(cursor + 8) != rate * channels * 2:
				return {"error": "Use PCM 16-bit mono/stereo WAV, 8–96 kHz. Float/24-bit/compressed WAV is not supported yet."}
		elif kind == "data":
			if found_data: return {"error": "Multiple WAV data chunks are unsupported."}
			found_data = true
			pcm = bytes.slice(cursor, cursor + length)
		cursor += length + (length % 2)
	if not found_fmt or not found_data or pcm.is_empty() or pcm.size() % (channels * 2) != 0:
		return {"error": "WAV is missing complete PCM samples."}
	var frames := pcm.size() / (channels * 2)
	if frames > rate * MAX_SECONDS:
		return {"error": "This audio slice supports WAV clips up to 60 seconds."}
	return {"path": path, "name": path.get_file(), "sha256": FileAccess.get_sha256(path), "pcm": pcm, "channels": channels, "rate": rate, "frames": frames}

static func sample_index(frame: int, video: Dictionary) -> int:
	# Nearest sample from exact rational time, with no cumulative delta/float drift.
	return (frame * RATE * int(video.fps_den) + int(video.fps_num) / 2) / int(video.fps_num)

static func source_value(source: Dictionary, frame: int, channel: int) -> float:
	var index := (clampi(frame, 0, source.frames - 1) * int(source.channels) + mini(channel, source.channels - 1)) * 2
	return source.pcm.decode_s16(index)

static func mix(clip: Dictionary, video: Dictionary) -> Dictionary:
	var count := sample_index(video.duration_frames, video)
	if count < 1 or count > RATE * MAX_SECONDS:
		return {"error": "Audio preview/export supports sequences up to 60 seconds."}
	var pcm := PackedByteArray()
	pcm.resize(count * 4)
	pcm.fill(0)
	var peaks := PackedFloat32Array()
	peaks.resize(256)
	peaks.fill(0)
	if not clip.is_empty() and not clip.muted:
		var source: Dictionary = clip.source
		var start := sample_index(clip.start_frame, video)
		var gain := db_to_linear(clip.gain_db)
		for index in range(start, count):
			var source_time: float = float(index - start) * source.rate / RATE + clip.source_in_sample
			var before := floori(source_time)
			if before >= source.frames: break
			var fraction := source_time - before
			var peak := 0.0
			for channel in range(2):
				var value := lerpf(source_value(source, before, channel), source_value(source, before + 1, channel), fraction) * gain
				var sample := clampi(roundi(value), -32768, 32767)
				pcm.encode_s16(index * 4 + channel * 2, sample)
				peak = maxf(peak, absf(sample / 32768.0))
			var bucket := mini(255, index * 256 / count)
			peaks[bucket] = maxf(peaks[bucket], peak)
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = RATE
	stream.stereo = true
	stream.data = pcm
	return {"stream": stream, "pcm": pcm, "peaks": peaks, "samples": count}

static func make_clip(source: Dictionary) -> Dictionary:
	return {"id": str(ResourceUID.create_id()), "source": source, "start_frame": 0, "source_in_sample": 0, "gain_db": 0.0, "muted": false}
