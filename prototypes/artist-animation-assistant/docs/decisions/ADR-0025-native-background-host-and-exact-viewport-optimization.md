# ADR0025 — Native background host and exact viewport optimization

Status: experimental selected host route retained; 2026-10-21 18:56 EDT.

Keep the proven base App/CREDITS code unchanged and extend its host through NativeApp. Choose cooperative stdlib worker threads for native I/O/effects with immutable packed snapshots, main-thread-only Tk, serial task limits, explicit import review and source/revision guards. Existing proposal processes remain. Reject synchronous long native calls and flattened cached-native artwork as a replacement for editable sources. Thread/GIL and cancellation limitations are measured, not assumed away.

Source-only CREDITS equivalence is supplemented with fresh withdrawn entry/controller tests; no owner report or OS acceptance is invented. Original .aaa atomic save path gains staging/cancel/concurrent-file protection and dirty-state handling in background. Exact sparse integer compositor and shared zero-tile sampling address measured UI stalls without changing output pixels.

Updated 2026-10-21 18:56 EDT. Full master/all twenty requirements remain ACTIVE and unfinished.

EXP0029 integrates the actual native animation route into the selected standalone:
scripts/standalone.py now starts NativeApp, a modular extension of the unchanged
base App. Native panel selects source/layers/native interval and explicit style
policy. Index/import never replace current artwork automatically; Open ready window
requires explicit review and unchanged current document/source signature. Windows
retain exact selected native payloads, original XML/style/profile bytes and source
archive identity; full original archive stays external and unselected layers/keys
are explicitly excluded. Strict native styles still refuse by default; experimental
shadows/glows or retained raw styles require explicit selection. No mask/vector/HDR/
other-profile/native export or all-six-archive support claim.

NativeJobs performs native identity/index/decode, styled preview and project Open/
Save on bounded cooperative threads. Worker never calls Tk/network. Main thread
polls an outcome queue; session/revision/view/source fingerprints prevent stale
previews or imports from replacing newer edits, including edit+undo. One full RGBA
frame cache per effects controller; pan/zoom reuse it. Up to four small snapshot
references reuse exact input projects across frames; hash tamper refuses. Full
frames persist as lossless PNG instead of large raw buffers. Derived work remains
private;1.5GiB existing-storage threshold prevents unbounded new task accumulation
without deleting review history (plus at most one bounded task's outputs).

Background project Open verifies file identity before/after load. Atomic Save writes
an owned staging project, checks cancellation/concurrent destination change, then
replaces the chosen assistant project. Original native archive is never a save
destination. If edits occur while saving, the earlier snapshot is saved and current
document stays dirty. Late cancellation after a completed atomic save is reported
as a completed save. Cooperative cancellation can wait for a bounded archive load/
serialization; no force kill or guarantee of instantaneous cancellation is claimed.

Experimental styled frame appears on the main canvas. Source/proposal editing and
playback remain explicitly RAW; effects refresh after editing/pausing. Saved native
effect-enabled projects restore styled preview intent on reopen. Enabled/size/
opacity/RGB controls create normal undoable revisions and respect parent/layer
locks. Scrollable native controls and focus-follow avoid the observed633px tall
panel clipping. Default core CREDITS remains exact inherited code; added host/source
binding and withdrawn own-widget evidence do not invent owner/OS acceptance.

Actual first animation part: full visible175-frame clip,9raster layers and180drawings/
exposures imported in38.065s, consuming225,230,848allocated decoded tile bytes and
40,753,218native payload bytes; exact packed save/reopen succeeds. These counts are
per-layer assets, not actor drawing states, peak RSS, or a whole original16-node native
document. Other five actual parts remain inventoried. Full-clip background Open
measured1.849s; styled preview20.055s; current frame matches retained EXP0028 effects
RGBA exactly, and hidden main-loop maximum heartbeat gap.133987s in that own-widget
test. Save while editing preserves exact earlier snapshot, newer dirty edit, source
manifest/originals and input project file. Native RGB parity gap remains77,335pixels/
max4 at cached frame0; alpha exact. No native parity/artist-usefulness acceptance.

Initial actual0..6 UI flow exposed.541584s max heartbeat gap and.312922s raw688x387
viewport render. Independent exact sparse uint32 integer-opacity composition and
shared tile layout/zero-tile fast paths reduced that viewport to.062577s; other
tested view sizes/crop match retained renderer exactly. All256integer opacities
match both retained results and permanent independent scalar-oracle tests. Zero
tile reads still enforce identity instead of bypassing store integrity. Subsequent
actual UI flow max gap.175652s, index1.752s/import5.917s/effects14.156s. Runs have
different concurrent loads; timings are observations, not a universal performance
guarantee. Raw24fps playback and physical pointer/tablet/OS layout are not proven.

Hidden synthetic controls verify index/import review, edit-during-import refusal,
style edits, retiming, cancel, heartbeat continuation, edit+undo staleness, source/
original retention and background Save/Open/style restoration. All tests keep root
withdrawn and use fixed own-canvas geometry. No foreground app/editor/browser, no
OS input/screen-reader claim. New CREDITS proof validates unchanged base App plus
source-bound NativeApp/NativePanel/entry and fresh inherited offline controls; a
missing selected extension proof or source changes fail closed. Earlier owner
HTML/native visibility/Return/Escape evidence remains unmodified and historical.

103APA references/full existing runtime notices. Added primary Python threading,
queue and Tk8.6canvas docs; refreshed Tk threading-model scope. Existing cleared
Python3.13.1/Tk8.6.15/CPU NumPy2.4.1 only. No new packages/models, upstream code
copy/execution, paid compute, art training/upload/distribution or public deployment.
All procedural/existing/adapted/custom neural approaches remain eligible by evidence.
