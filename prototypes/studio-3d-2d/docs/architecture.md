# Architecture, schema 2 (legacy schema 1 readable)

`main.tscn` launches a standalone application shell (`src/app.gd`), not an engine
editor plugin. `canvas_view.gd` maps window/zoom/pan coordinates to 1920×1080;
`timeline_view.gd` displays camera diamonds and cel exposures with click/drag seek.

`timeline.gd` is the time authority: integer frame, rational FPS, sorted camera keys,
position/FOV interpolation and quaternion slerp. Each key's interpolation controls
its outgoing interval. Export samples `n*fps_den/fps_num`, never wall-clock delta.
Interactive preview uses the audio playback position, compensated for time since last
mix and estimated output latency, when a clip and hardware driver exist. Otherwise it
uses monotonic time with an explicit silent fallback on Dummy audio. Visual frames
may drop under load; export duration never changes. Playback runs once and stops at
the final frame. Switching mode preserves frame and restores the sampled shot; a temporary
navigation camera transform is only committed by an explicit key operation.

`scene3d.gd` creates the original box-built fixture and imports GLB using GLTFDocument
at runtime. Only embedded resources are accepted; no external URI/network loading.
128 MiB GLB limit. The current import is static geometry/materials. Camera keys are
independent of imported cameras and file animation. Godot uses right-handed +Y up,
camera facing -Z; keys store quaternion XYZW. Model units are interpreted as meters.
No automatic re-centering or source-file modification occurs.

`renderer.gd` owns a full-HD SubViewport, independent World3D, application light and
camera. Preview displays its texture beneath a transparent ImageTexture. Export
samples the same camera and cel functions, waits for frame_post_draw and reads the
GPU texture; it composites the identical cel overlay into an RGBA PNG. Geometry and
paint never share mutable state. Lighting is deliberately simple and may combine
with imported lights; material/import compatibility is limited by Godot.

`drawing.gd` stores layers of independent Image resources. An exposure is `[start,
start+duration)`; a duplicate copies pixels while holds reuse them. Painting is
screen-space RGBA8, assumed sRGB, normal straight-alpha composition. There is no
linear-light/HDR/ICC pipeline. A distance-to-segment brush prevents gaps from sparse
mouse events. Stroke history stores before/after 64×64 touched tiles. History is
charged conservatively and trimmed to 64 MiB (a single large structural command
can exceed this); current raster data is capped at 32 cels (~253 MiB). No cold cache
yet. Full overlay composition/upload is limited to once per dirty application frame;
measured baseline precedes any GPU brush/tiled upload redesign.

`storage.gd` writes schema-versioned JSON and original managed assets. Schema 2 adds
one audio clip and its checksummed WAV. Schema 1 loads with no audio. Both integer
and JSON's numeric representations of supported schema versions are validated.
Scene names
use real SHA256; a fresh immutable cel generation is written per save. Only after
all images succeed is a flushed temporary manifest renamed over the live one.
The previous manifest is copied to project.backup.json before replacement. Loading
validates schema/types/frame bounds, sorted keys, exposure overlap, relative paths,
scene checksum and dimensions, then swaps the active document only on success.
It rejects `..`, absolute paths, URLs and Windows backslashes. Use ordinary local
directories: junction/symlink escape hardening and hostile-input fuzzing are not
complete. Saves are recoverable via backup/new PNG generations; power-loss fsync
guarantees and recovery/autosave UI are not claimed. Old generations remain for
recovery and consume disk; no automatic garbage collection deletes them.

`encoder.gd` detects libx264/AAC, passes an argument array to FFmpeg via nonblocking
pipes, drains errors, exposes cancellation and checks process exit. It never invokes
a shell. New export folders preserve PNGs/logs on failure. Encoding uses exact video
duration, pads audio if supplied, and avoids -shortest truncation. No external source
asset is overwritten. Editor export includes its deterministic WAV mix when a clip
exists, otherwise silent video. UI edits are disabled while exporting and export evaluation
uses a snapshot. Closing while busy cancels before allowing another close.

`audio_track.gd` parses bounded RIFF/WAVE PCM16 mono/stereo files. It rejects unsupported
codecs, malformed chunks and oversized sources before playback. One clip has exact
integer start_frame/source_in_sample, gain and mute. Original WAV bytes remain intact.
A 48kHz stereo PCM16 project mix is generated from exact rational frame-to-sample
addresses, linear interpolation for resampling, and explicit int16 clipping. Preview
plays that same mix; offline export writes it unchanged before AAC encoding. A peak
waveform describes this project-time mix, including silence. Source files may be up
to 60s/32MiB; mixed sequences are bounded to 60s. Linear resampling and positive-gain
clipping are prototype limits, not mastering-quality processing. Mixing currently
runs synchronously on edit; long/high-rate cases need worker/timing measurements.

Normal play uses Godot AudioStreamPlayer with no loop. User pause stops at the exact
displayed frame; seeking remains silent and the next play starts at that frame's
timestamp. Monotonic clamping prevents tiny backwards visual jumps in the audio clock.
Latency estimates do not establish real speaker/monitor lip sync. A captured app bus
tests actual sample generation; listening and driver/device variation remain owner tests.

Future multiple audio clips, rigs and sequences must evaluate through this same project time;
no independent ticking playback engine may redefine frame identity.

## Requested legacy asset track

The owner now requests Source/GMod and MMD maps/models, with Ragdoll Mover/SMH as
interaction references. tools/asset_audit.py inventories GMA/LZMA/PMD/PMX without
executing embedded scripts. tools/prepare_mmd.py stages native files/dependencies in
a NEW output directory and invokes a factory-started external Blender/MMD Tools
worker, tools/blender_mmd_bridge.py. It retains native files, packed editable.blend,
parameters.json and GLB. The Godot renderer remains standard-format based.

The studio has scene framing and manual FK posing of the tested prepared rigs.
The whole native preservation bundle is not yet copied by managed project save,
so retain the preparation directory. Source decoding now uses prepare_source.py /
blender_source_bridge.py and the same standard GLB loader. See legacy_compatibility.md
for concrete status, parameter preservation contract and source references.


## Workspace presentation

src/studio_theme.gd creates original vector icons and gradient nine-patch surfaces
in memory. No second framework or external artwork. app.gd keeps advanced_controls
and contextual Drawing/Camera/Audio sections. set_advanced only changes visibility;
project keys/cels/audio/renderer and playback clocks have no alternative Simple path.
No project-schema changes or preference writes. Console run.py remains diagnostic;
launch.pyw uses the windowed installed engine and captures launcher diagnostics.
Default boot splash is off; app sets its own title/icon while retaining About credits.


## Recovery

recovery.gd manages bounded discovery, process ownership, checkpoint budget and
resolved fingerprints. app.gd schedules writes between edits and owns restore UI.
Storage takes optional recovery editor metadata and immutable raster hashes; normal
manual project serialization is unchanged. Backup manifest loading is an explicit
allowlisted path. Validation completes before changing the live scene; failed opens
preserve it. Recovery does not redirect Save into the cache. A restored project
requires choosing a normal save folder and keeps its source recovery until saved.


## Source-independent model / pose increment

model.gd owns studio_model_1 data validation, imported base poses, native bone identity,
root and sparse-pose sampling. renderer.gd prepares/binds before replacing the live
model, and uses the same evaluator for preview/export. pose_editor.gd handles FK
selection, local/world gizmos, gesture undo and explicit recording. Guides are canvas
UI only. Environment and model use the same GLB loader; no source-format branches in
posing. Schema3 adds one optional model, with old projects defaulting to no model.
Native report metadata is retained; full native bundle packing is still open.

## Source preparation

source_import.gd provides native model/map pickers, member selection, unit scale,
an extra content mount, asynchronous worker status and cooperative cancellation.
prepare_source.py stages resource-only GMA/legacy archives or direct MDL sidecars /
BSP copies into a new bundle. The pinned SourceIO decoder runs in isolated external
Blender, with deterministic explicit read-only mounts and no Steam autodiscovery.
Our bridge constructs simple PBR materials instead of invoking Source shader nodes.
It loads map prop geometry and records missing dependencies. Completed GLBs enter
renderer/model.gd normally; no source-format condition is present in pose evaluation.
Only the adapter and file-choice routing know about Source. Full details/limits are
in source_import.md. Existing schema3 storage and the master frame clock are reused.


## Installed Source content browser - 2026-10-29

Owner prioritized a searchable in-app library and more complete dependency discovery.
Installed navbar/source-dialog shortcut now open source_browser.gd: asynchronous
location discovery, selected-package indexing, global asset search, model/map filters,
original member/path display, dependency checkboxes, saved extra roots, cancellation
and actual import. Loose/VPK/GMA/legacy-bin members all feed the same GLB/model path.
No separate rig or scene engine. Original gradient UI is reused with a light modal
background; old modal windows hide before replacement dialogs/progress open.

source_content.py owns bounded stdlib indexes and read-only KeyValues/Steam/mount
path discovery; source_browser.py is its data-only worker. VPK import extracts only
the selected MDL/BSP and available sidecars, with CRC checks. An original bounded
GMA provider supplies cross-addon resources selectively. Native Source imports also
honor saved mount settings, not just imports from the new browser. Only selected
asset resources and enabled locations resolve dependencies; addons/SFM default off.
No game configs are edited, scripts executed or assets downloaded.

Research found GMod already includes most CS:S/episode content (Facepunch July2025
update); actual included CSS VPK indexes1361models and chair texture import works.
SFM was initially absent, but its real files/manifest appeared during this session
without an install/download/launch by this assistant. Actual gameinfo search paths
were read and installed SFM content can be explicitly enabled. The private shrine
improves from112/525to524/525props and13to34textures; one corrupt embedded material
CRC remains an explicit error. Both standard GLBs render in Godot and the improved
map saves/reopens. SFM session/DMX animation, procedural rigs/effects, exact live
GMod mount-state emulation, native shading/lightmap fidelity and thumbnails remain
unsupported. Full instructions, primary sources and bounds: installed_content.md.
