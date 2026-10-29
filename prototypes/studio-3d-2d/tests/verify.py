"""Run real Godot + FFmpeg checks. Rendering tests open their own temporary window."""
from pathlib import Path
import array
import hashlib
import json
import math
import os
import shutil
import subprocess
import struct
import sys
import time
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from run import command


def run(args, **kwargs):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                            encoding="utf-8", errors="replace", timeout=120, **kwargs)
    if result.returncode:
        raise RuntimeError(f"Exit {result.returncode}: {args}\n{result.stdout}\n{result.stderr}")
    return result.stdout + result.stderr


def main():
    output = ROOT / "output"
    output.mkdir(exist_ok=True)
    results = {}
    fixtures = output / "fixtures"
    fixtures.mkdir(exist_ok=True)
    raw = array.array("h", (int(16000 * math.sin(2 * math.pi * 1000 * n / 44100)) for n in range(22050)))
    if sys.byteorder != "little": raw.byteswap()
    with wave.open(str(fixtures / "voice — тест.wav"), "wb") as wav:
        wav.setparams((1, 2, 44100, 0, "NONE", "not compressed"))
        wav.writeframes(raw.tobytes())
    payload = b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 3, 1, 44100, 176400, 4, 32) + b"data" + struct.pack("<I", 400) + bytes(400)
    (fixtures / "float.wav").write_bytes(b"RIFF" + struct.pack("<I", len(payload)) + payload)
    tests = [("unit", "tests/unit.gd", True, "UNIT 24 checks; failures=0"),
             ("spikes", "tests/spikes.gd", False, "SPIKES failures=0"),
             ("editor", None, False, '"failures":0'),
             ("export_failures", "tests/export_failures.gd", False, "EXPORT_FAILURES failures=0"),
             ("audio_editor", None, False, '"failures":0'),
             ("audio_dummy", None, False, 'AUDIO_DUMMY failures=0'),
             ("ui", None, False, 'UI_SMOKE '),
             ("recovery_write", None, False, "RECOVERY_WRITE failures=0"),
             ("recovery", None, False, "RECOVERY_SMOKE "),
             ("pose", None, False, "POSE_SMOKE ")]
    launch_args = {
        "editor": ["--", "--smoke"],
        "ui": ["--", "--ui-smoke"],
        "audio_editor": ["--", "--audio-smoke"],
        "audio_dummy": ["--audio-driver", "Dummy", "--", "--audio-smoke", "--dummy-audio-test"],
        "recovery_write": ["--", "--recovery-smoke", "--recovery-write"],
        "recovery": ["--", "--recovery-smoke"],
        "pose": ["--", "--pose-smoke"],
    }
    for name, script, headless, marker in tests:
        start = time.perf_counter()
        extra = launch_args.get(name, [])
        text = run(command(script, headless, extra))
        (output / f"{name}-stdout.log").write_text(text, encoding="utf-8")
        if marker not in text or any(error in text for error in ("SCRIPT ERROR", "FAIL ", "ObjectDB instances leaked")) or (name in ("ui", "recovery", "pose") and '"failures":0' not in text):
            raise RuntimeError(f"{name} failed; inspect output/{name}-stdout.log\n{text}")
        results[name] = {"exit": 0, "seconds": round(time.perf_counter() - start, 3)}
        print(f"PASS {name}: {results[name]['seconds']}s")

    ffmpeg = os.environ.get("HYBRID_FFMPEG", shutil.which("ffmpeg") or r"C:\Program Files\ffmpeg\bin\ffmpeg.exe")
    ffprobe = str(Path(ffmpeg).with_name("ffprobe.exe" if os.name == "nt" else "ffprobe"))
    # Spike B fixture: 48kHz, exact silence until frame 24, then a 0.2s 1kHz tone.
    spike = output / "spikes"
    samples = array.array("h", (int(16000 * math.sin(2 * math.pi * 1000 * n / 48000))
                               if 48000 <= n < 57600 else 0 for n in range(96000)))
    if sys.byteorder != "little":
        samples.byteswap()
    tone = spike / "known tone.wav"
    with wave.open(str(tone), "wb") as wav:
        wav.setparams((1, 2, 48000, 0, "NONE", "not compressed"))
        wav.writeframes(samples.tobytes())
    # Also exercises the application's encoder adapter with audio, independently of editor Stage 2.
    run(command("tests/audio_spike.gd"))
    for name, movie in [("silent", Path(json.loads((output / "editor-smoke/result.json").read_text())["export"]) / "movie.mp4"),
                        ("tone", spike / "movie.mp4"),
                        ("editor_audio", Path(json.loads((output / "audio-editor/result.json").read_text())["export"]) / "movie.mp4")]:
        metadata = json.loads(run([ffprobe, "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(movie)]))
        video = next(s for s in metadata["streams"] if s["codec_type"] == "video")
        assert video["codec_name"] == "h264" and video["nb_read_frames"] == "48"
        assert video["width"] == 1920 and video["height"] == 1080 and video["r_frame_rate"] == "24/1"
        assert abs(float(metadata["format"]["duration"]) - 2) < 0.01
        if name in ("tone", "editor_audio"):
            assert any(s["codec_name"] == "aac" for s in metadata["streams"])
        else:
            assert not any(s["codec_type"] == "audio" for s in metadata["streams"])
        (output / f"{name}-ffprobe.json").write_text(json.dumps(metadata, indent=2))
        results[name + "_video"] = {"frames": 48, "fps": "24/1", "duration": metadata["format"]["duration"]}
    pose_report = json.loads((output / "pose-smoke/result.json").read_text(encoding="utf-8"))
    for index, movie in enumerate(pose_report["movies"]):
        metadata = json.loads(run([ffprobe, "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", movie]))
        video = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
        assert video["codec_name"] == "h264" and video["nb_read_frames"] == "48"
        assert video["width"] == 1920 and video["height"] == 1080 and video["r_frame_rate"] == "24/1"
        assert abs(float(metadata["format"]["duration"]) - 2) < 0.01
        results[f"posed_model_video_{index}"] = {"frames": 48, "fps": "24/1", "duration": metadata["format"]["duration"]}
    results["pose_checks"] = pose_report["checks"]
    results["actual_mmd_tested"] = pose_report["actual_mmd_tested"]
    decoded = spike / "decoded.wav"
    run([ffmpeg, "-v", "error", "-y", "-i", str(spike / "movie.mp4"), "-vn", "-c:a", "pcm_s16le", str(decoded)])
    with wave.open(str(decoded), "rb") as wav:
        pcm = array.array("h", wav.readframes(wav.getnframes()))
        if sys.byteorder != "little": pcm.byteswap()
        rate = wav.getframerate()
    # AAC can ring around transients. Use 10ms RMS windows and a documented tolerance.
    onset = None
    for index in range(0, len(pcm) - 480, 480):
        rms = math.sqrt(sum(v * v for v in pcm[index:index + 480]) / 480)
        if rms > 1500:
            onset = index / rate
            break
    assert onset is not None and abs(onset - 1.0) <= 0.02, onset
    results["tone_onset_seconds"] = onset
    editor_report = json.loads((output / "audio-editor/result.json").read_text())
    editor_movie = Path(editor_report["export"]) / "movie.mp4"
    editor_pcm = output / "audio-editor/decoded.wav"
    run([ffmpeg, "-v", "error", "-y", "-i", str(editor_movie), "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(editor_pcm)])
    with wave.open(str(editor_pcm), "rb") as wav:
        pcm = array.array("h", wav.readframes(wav.getnframes()))
        if sys.byteorder != "little": pcm.byteswap()
    first = next((n / 48000 for n in range(0, len(pcm) - 480, 480)
                  if math.sqrt(sum(v*v for v in pcm[n:n+480]) / 480) > 1500), None)
    assert first is not None and abs(first - 1.0) <= 0.02, first
    rms = math.sqrt(sum(v*v for v in pcm[52800:57600]) / 4800)
    assert 5300 < rms < 6000, rms  # 16000 amplitude at -6dB, allowing AAC loss.
    results["editor_audio"] = {"onset_seconds": first, "rms_at_1_1s": rms,
                               "audio_driver": editor_report["audio_driver"]}
    results["representative_png_sha256"] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                           for p in [spike / "frame_000001.png", spike / "frame_000025.png", spike / "frame_000048.png"]}
    (output / "verification.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
