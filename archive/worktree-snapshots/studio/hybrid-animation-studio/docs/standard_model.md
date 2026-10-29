# One standard model and pose contract

Both the environment and the character use the same self-contained GLB loader.
Native adapters prepare data for that loader; the pose editor never branches on
PMD, PMX, MDL or an add-on name. The current bounded increment adds **one model
slot beside the existing environment**, not a separate MMD workspace.

## Working interface

1. **Add scene** imports the environment. **Add model** adds a prepared character
   GLB without replacing the environment. The actual provided Miku fixture is at
   `output/compatibility/miku-tested/scene.glb` in this local delivery.
2. Choose **Pose model**. **Frame model** provides a temporary close view.
   Select a bone in the searchable hierarchy or click a visible joint.
3. Choose Rotate or Move, then Local or World axes. Drag a colored handle:
   red X, green Y, blue Z. A drag is one undo operation; Escape cancels it.
   Middle-drag pans the view and wheel zooms it. Camera free-flight remains in
   Scene/camera mode with the owner's existing mouse gestures.
4. Advanced reveals 15-degree/0.1-unit snapping, axis locks, local numeric XYZ,
   root uniform scale, reset and pose interpolation/deletion. Local numeric values
   are always local even when the viewport handles use World axes.
5. Select the model's root item to move/rotate/scale the whole character. Bone
   edits are offsets from the imported base pose; rotating a parent moves children.
6. **Record pose key** explicitly stores bones and root placement at the current
   master frame. Record another at frame 48, then scrub/play frames 0–47. Purple
   diamonds distinguish model keys from camera keys and drawing exposures.
7. A model with no pose keys uses its static pose in preview/export. Once there
   are keys, animation/export use recorded keys. Unrecorded edits are a draft for
   that frame in Pose mode; Record is required to put them into the animation.
   The draft is still saved/recovered. Scrubbing does not silently record it.
8. **Show model** affects preview/output. **Reference only** keeps it visible in
   the working preview but excludes it from exported frames/movie. Bone guides
   and handles are UI overlays and never enter exported imagery.
9. Frame model's view is temporary. Advanced > **Save view as camera key** stores
   it explicitly; existing camera keys require replacement confirmation.

Simple remains the launch default. Detailed controls do not change the underlying
model state when hidden. Pose controls are disabled when no model is loaded.

## Project record

Project schema **3** adds an optional `model`; schema 1 and 2 still read with no
model. Older app versions should reject schema 3 rather than silently drop poses.
The record's `format` is `studio_model_1`, independent of the native source:

- Stable instance ID, readable name, source GLB SHA256 and managed relative path.
- Root position/quaternion/uniform scale, visibility and reference-only flag.
- Working `pose` dictionary and `draft_frame`.
- `pose_keys`: frame, hold/linear/ease interpolation, root `transform`, and a
  sparse dictionary of local bone position/quaternion offsets.
- `metadata`: preserved source adapter information, including the supplied native
  parameter report when present. Unknown report fields remain data, not commands.

Bone identities combine the GLB checksum with skeleton-relative path/native bone
name. There is no guessed humanoid renaming or automatic retargeting. Reopening
validates bindings before replacing the live scene. Reimporting a changed GLB
at the same path rebuilds its runtime rig rather than reusing stale bones.

The renderer samples camera, root and bones at the same integer frame for preview
and export. Quaternion slerp interpolates rotations; position/scale interpolate
linearly with the selected easing. Native scene animation players are stopped
so they do not compete with the master frame clock. Source GLBs stay unchanged.

Current bounds: one model, up to 512 bones, 241 pose keys, 128 MiB per GLB, 1 MiB
project manifest. Parameter reports above 256 KiB or invalid JSON produce an
explicit error rather than silently discarding their contents. These are prototype
limits, not general claims about model formats.

## Native compatibility and preservation limits

MMD preparation already provides standard skinning and native bone names. Actual
Miku has 126 runtime bones, including import helpers, and 15 morph channels. Posing
uses exactly the same code as the original two-bone fixture. Source/GMod conversion
now emits this same GLB/model record and attaches native metadata. The supplied
77-bone ValveBiped model uses these identical pose controls and timeline. Native
file selection invokes an isolated preparation worker; see source_import.md.

The supplied `parameters.json` is copied into the project record as metadata.
The full native/Blender preparation directory remains external: keep it intact.
Native PMD/PMX editing or lossless round-trip export is not implemented. Native
rigid bodies, constraints, IK, bone/material/group morph semantics, toon/sphere/edge
shading and Source bodygroups/flex/pose parameters are not made functional merely
by preserving their metadata. Facial morph controls are still pending. Imported IK/control bones do not solve IK;
use deforming FK bones (the Miku test uses 左腕).

This is manual FK posing and root animation. There is no IK solver, live ragdoll
physics, child world-position lock, bone scaling, pose library or multi-character
scene editor yet. Framing uses imported mesh bounds, not a dynamically recomputed
skinned silhouette. Rotation handles use a provisional screen-drag sensitivity;
physical mouse/tablet comfort and all rig/DPI combinations need owner feedback.

## Actual evidence

`python run.py --test pose` creates an original skinned GLB, exercises the real
bone tree, handles, world movement through a rotated/scaled parent, snapping/locks,
undo/redo, explicit pose recording, root/skin interpolation, save/reopen, malformed
bone rejection, recovery, reference exclusion and real MP4 export. On this machine
it also exercises the supplied prepared Miku: native arm selection, skin deformation,
animated export, frame-24 PNG equality and pose reopen with unchanged GLB SHA256.

`python tests/verify.py` includes this runner and ffprobe checks for its movies:
1920×1080 H.264, 24 fps, 48 frames, 2 seconds. The actual Miku portion reports a
clear skip when that private local fixture is absent; original-rig checks remain
mandatory in a clean source checkout. Test output/native assets stay outside Git.

Primary APIs checked: [Skeleton3D](https://docs.godotengine.org/en/4.6/classes/class_skeleton3d.html)
and [Camera3D projection](https://docs.godotengine.org/en/4.6/classes/class_camera3d.html).
GMod workflow references and native conversion limitations remain in
[legacy_compatibility.md](legacy_compatibility.md). No GMod Lua or third-party
posing implementation is copied or executed.
